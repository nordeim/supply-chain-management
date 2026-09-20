'use server';

/**
 * Server Actions — the only mutation seam (scandihaven convention: no REST
 * endpoints for UI mutations; actions return ActionResult<T> and never throw
 * across the boundary). Every action validates its input with zod before
 * touching the database.
 */

import { randomBytes, scryptSync } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok, toActionResult, type ActionResult } from '@/domain/result';
import { parseMoneyToMinor } from '@/domain/money';
import { buildAiReasoning, velocityPerDay, daysOfCover, projectedStockAtLeadTime } from '@/domain/replenishment';
import {
  clearSessionCookie,
  getSessionUser,
  setSessionCookie,
  verifyPassword,
} from '@/lib/session';

/* ------------------------------------------------------------------ */
/* Product creation                                                    */
/* ------------------------------------------------------------------ */

const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  sku: z.string().trim().min(1, 'SKU is required').max(40).regex(/^[A-Za-z0-9-]+$/, 'SKU may contain letters, digits, and dashes'),
  category: z.string().trim().min(1, 'Category is required').max(60),
  status: z.enum(['Active', 'Discontinued']).default('Active'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  imageUrl: z
    .string()
    .trim()
    .max(600_000)
    .refine(
      (v) => v === '' || /^https?:\/\//.test(v) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(v),
      'Must be an image URL or data URL',
    )
    .optional()
    .or(z.literal('')),
  cost: z.string().trim().min(1, 'Cost is required'),
  price: z.string().trim().min(1, 'Price is required'),
  stock: z.number().int('Stock must be a whole number').min(0).max(1_000_000),
  reorderPoint: z.number().int().min(0).max(100_000).default(10),
  reorderQty: z.number().int().min(1).max(100_000).default(25),
  supplierId: z.string().trim().min(1, 'Supplier is required'),
  leadTimeDays: z.number().int().min(0).max(365).default(7),
  location: z.string().trim().max(120).optional().or(z.literal('')),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export async function createProductAction(input: CreateProductInput): Promise<ActionResult<{ id: string }>> {
  return toActionResult(async () => {
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const data = parsed.data;

    const costMinor = parseMoneyToMinor(data.cost);
    if (costMinor === null) return fail('VALIDATION', 'Cost must be a valid amount like 2480.00');
    const priceMinor = parseMoneyToMinor(data.price);
    if (priceMinor === null) return fail('VALIDATION', 'Price must be a valid amount like 2580.00');
    if (priceMinor < costMinor) return fail('DOMAIN', 'Sale price cannot be below cost');

    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) return fail('NOT_FOUND', 'Supplier not found');

    const existingSku = await db.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) return fail('DOMAIN', `SKU ${data.sku} already exists`);

    const session = await getSessionUser();
    const product = await db.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        category: data.category,
        status: data.status,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        costMinor,
        priceMinor,
        stock: data.stock,
        reorderPoint: data.reorderPoint,
        reorderQty: data.reorderQty,
        supplierId: supplier.id,
        leadTimeDays: data.leadTimeDays,
        location: data.location || null,
      },
    });

    // Opening stock becomes the first ledger entry so history starts honestly.
    if (data.stock > 0) {
      await db.stockMovement.create({
        data: { productId: product.id, delta: data.stock, reason: 'initial' },
      });
    }

    console.info(
      '[action] product created',
      { sku: product.sku, by: session?.email ?? 'anonymous' },
    );
    revalidatePath('/');
    revalidatePath('/products');
    return ok({ id: product.id });
  });
}

/* ------------------------------------------------------------------ */
/* Suggestion review (approve / dismiss)                                */
/* ------------------------------------------------------------------ */

export async function approveSuggestionAction(orderId: string): Promise<ActionResult<{ orderNumber: string }>> {
  return toActionResult(async () => {
    const id = z.string().min(1).safeParse(orderId);
    if (!id.success) return fail('VALIDATION', 'Order id is required');

    const order = await db.purchaseOrder.findUnique({ where: { id: orderId }, include: { product: true } });
    if (!order) return fail('NOT_FOUND', 'Purchase order not found');
    if (order.status !== 'Suggested') return fail('DOMAIN', `Order ${order.orderNumber} is already ${order.status}`);

    await db.purchaseOrder.update({
      where: { id: orderId },
      data: { status: 'Approved' },
    });
    console.info('[action] suggestion approved', { order: order.orderNumber });
    revalidatePath('/');
    revalidatePath('/ai-suggestions');
    revalidatePath('/purchase-orders');
    return ok({ orderNumber: order.orderNumber });
  });
}

export async function dismissSuggestionAction(orderId: string): Promise<ActionResult<{ orderNumber: string }>> {
  return toActionResult(async () => {
    const id = z.string().min(1).safeParse(orderId);
    if (!id.success) return fail('VALIDATION', 'Order id is required');

    const order = await db.purchaseOrder.findUnique({ where: { id: orderId } });
    if (!order) return fail('NOT_FOUND', 'Purchase order not found');
    if (order.status !== 'Suggested') return fail('DOMAIN', `Order ${order.orderNumber} is already ${order.status}`);

    await db.purchaseOrder.update({
      where: { id: orderId },
      data: { status: 'Cancelled' },
    });
    console.info('[action] suggestion dismissed', { order: order.orderNumber });
    revalidatePath('/');
    revalidatePath('/ai-suggestions');
    revalidatePath('/purchase-orders');
    return ok({ orderNumber: order.orderNumber });
  });
}

/* ------------------------------------------------------------------ */
/* Purchase order lifecycle                                             */
/* ------------------------------------------------------------------ */

const allowedStatusTransitions: Record<string, string[]> = {
  Suggested: ['Approved', 'Cancelled'],
  Approved: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export async function updateOrderStatusAction(
  orderId: string,
  nextStatus: 'Approved' | 'Delivered' | 'Cancelled',
): Promise<ActionResult<{ orderNumber: string; newStatus: string }>> {
  return toActionResult(async () => {
    const id = z.string().min(1).safeParse(orderId);
    const status = z.enum(['Approved', 'Delivered', 'Cancelled']).safeParse(nextStatus);
    if (!id.success || !status.success) return fail('VALIDATION', 'Invalid order or status');

    const order = await db.purchaseOrder.findUnique({ where: { id: orderId }, include: { product: true } });
    if (!order) return fail('NOT_FOUND', 'Purchase order not found');

    const allowed = allowedStatusTransitions[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return fail('DOMAIN', `Cannot move order ${order.orderNumber} from ${order.status} to ${nextStatus}`);
    }

    await db.purchaseOrder.update({ where: { id: orderId }, data: { status: nextStatus } });

    // Receiving a delivery lands in the warehouse: stock + ledger entry.
    if (nextStatus === 'Delivered') {
      await db.product.update({
        where: { id: order.productId },
        data: { stock: { increment: order.quantity } },
      });
      await db.stockMovement.create({
        data: { productId: order.productId, delta: order.quantity, reason: 'restock' },
      });
    }

    console.info('[action] order status updated', { order: order.orderNumber, to: nextStatus });
    revalidatePath('/');
    revalidatePath('/purchase-orders');
    revalidatePath('/products');
    if (order.product) revalidatePath(`/products/${order.productId}`);
    return ok({ orderNumber: order.orderNumber, newStatus: nextStatus });
  });
}

/* ------------------------------------------------------------------ */
/* Replenishment suggestion generation (the "AI engine")                */
/* ------------------------------------------------------------------ */

export async function generateSuggestionsAction(): Promise<ActionResult<{ created: number }>> {
  return toActionResult(async () => {
    const products = await db.product.findMany({ include: { supplier: true, movements: true } });
    const now = new Date();

    // Avoid stacking: skip products that already have an open suggestion.
    const openSuggestions = await db.purchaseOrder.findMany({
      where: { status: 'Suggested' },
      select: { productId: true },
    });
    const productsWithOpenSuggestion = new Set(openSuggestions.map((s) => s.productId));

    let created = 0;
    for (const p of products) {
      if (p.status !== 'Active') continue;
      if (productsWithOpenSuggestion.has(p.id)) continue;

      const movements = p.movements.map((m) => ({ delta: m.delta, reason: m.reason, occurredAt: m.createdAt }));
      const velocity = velocityPerDay(movements, now);
      const engineProduct = {
        stock: p.stock,
        reorderPoint: p.reorderPoint,
        reorderQty: p.reorderQty,
        leadTimeDays: p.leadTimeDays,
        supplierLeadTimeDays: p.supplier?.leadTimeDays ?? null,
        movements,
        now,
      };
      const projected = projectedStockAtLeadTime(engineProduct);
      const needsOrder = p.stock <= p.reorderPoint || projected < p.reorderPoint;
      if (!needsOrder) continue;

      const supplier = p.supplier;
      if (!supplier) continue;

      const quantity = Math.max(
        p.reorderQty,
        Math.ceil((velocity * (supplier.leadTimeDays ?? p.leadTimeDays) + p.reorderQty) / p.reorderQty) * p.reorderQty,
      );
      const lead = supplier.leadTimeDays ?? p.leadTimeDays;
      const reasoning = buildAiReasoning({
        productName: p.name,
        stock: p.stock,
        reorderPoint: p.reorderPoint,
        velocityPerDay: velocity,
        leadTimeDays: lead,
        daysOfCover: daysOfCover(p.stock, velocity),
        projectedStock: projected,
      });

      const orderNumber = await nextOrderNumber();
      await db.purchaseOrder.create({
        data: {
          orderNumber,
          productId: p.id,
          supplierId: supplier.id,
          quantity,
          unitCostMinor: p.costMinor,
          status: 'Suggested',
          aiReasoning: reasoning,
          orderDate: now,
          expectedDelivery: new Date(now.getTime() + lead * 24 * 60 * 60 * 1000),
        },
      });
      created += 1;
    }

    console.info('[action] suggestions generated', { created });
    revalidatePath('/');
    revalidatePath('/ai-suggestions');
    revalidatePath('/purchase-orders');
    return ok({ created });
  });
}

/** Next order number in the reference app's style: hex-ish "2AF143". */
async function nextOrderNumber(): Promise<string> {
  const last = await db.purchaseOrder.findFirst({
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const prefix = '2AF';
  if (!last || !/^[0-9A-F]{6}$/.test(last.orderNumber)) return `${prefix}150`;
  const num = parseInt(last.orderNumber, 16);
  return (num + 1).toString(16).toUpperCase().padStart(6, '0');
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function signInAction(input: { email: string; password: string }): Promise<ActionResult<{ email: string }>> {
  return toActionResult(async () => {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) {
      return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid credentials');
    }
    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      // Deliberately vague: never reveal which half failed.
      return fail('DOMAIN', 'Invalid email or password');
    }
    await setSessionCookie(user.id);
    console.info('[action] user signed in', { email: user.email });
    return ok({ email: user.email });
  });
}

export async function signOutAction(): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    await clearSessionCookie();
    return ok(null);
  });
}

export async function signUpAction(input: { email: string; password: string; name?: string }): Promise<ActionResult<{ email: string }>> {
  return toActionResult(async () => {
    const schema = z.object({
      email: z.string().trim().email('Enter a valid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().trim().max(120).optional(),
    });
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const email = parsed.data.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return fail('DOMAIN', 'An account with this email already exists');

    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(parsed.data.password, salt, 64).toString('hex');
    const user = await db.user.create({
      data: { email, name: parsed.data.name || null, passwordHash: `scrypt:${salt}:${hash}` },
    });
    await setSessionCookie(user.id);
    console.info('[action] user signed up', { email });
    return ok({ email });
  });
}
