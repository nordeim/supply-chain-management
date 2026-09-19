/**
 * Idempotent seed — recreates the reference application's demo dataset.
 *
 * Conventions (scandihaven): natural-key upserts make re-runs safe; the seed
 * never fabricates analytics — velocity, inventory value curves, and
 * forecasts are derived by the domain engine from the movement ledger below.
 *
 * The movement ledger is engineered so the derived analytics land on the
 * reference values (velocity 1.5/1.2/0.8/0.7/0.4/0.0 units/day, 50mm exactly
 * out of stock today, stock history that never goes negative).
 *
 * Run: bun prisma/seed.ts   (or: bun run db:seed)
 * Demo user credentials come from SEED_DEMO_EMAIL / SEED_DEMO_PASSWORD env
 * (safe defaults; see .env.example).
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { buildAiReasoning, daysOfCover, projectedStockAtLeadTime, velocityPerDay } from '../src/domain/replenishment';

const db = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number, hour = 10): Date => {
  const d = new Date(now.getTime() - n * DAY_MS);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/* ------------------------------------------------------------------ */
/* Movement ledger construction                                        */
/* ------------------------------------------------------------------ */

interface LedgerSpec {
  sku: string;
  historyDays: number; // days since the 'initial' movement
  totalSales: number; // lifetime sales units
  restocks: ReadonlyArray<{ daysAgo: number; qty: number }>;
  targetStock: number; // stock that must remain today
}

interface LedgerMovement {
  delta: number;
  reason: 'initial' | 'restock' | 'sale';
  occurredAt: Date;
}

/** Evenly spread `totalSales` sale units across `days` days, distributing
 *  the remainder on evenly-spaced days (2/day alternating when 1.5/day). */
function dailySalesPattern(days: number, totalSales: number): number[] {
  const pattern = new Array<number>(days).fill(0);
  if (totalSales <= 0 || days <= 0) return pattern;
  const base = Math.floor(totalSales / days);
  const remainder = totalSales - base * days;
  for (let i = 0; i < days; i += 1) pattern[i] = base;
  if (remainder > 0) {
    const gap = days / remainder;
    for (let k = 0; k < remainder; k += 1) {
      const idx = Math.min(days - 1, Math.floor(k * gap));
      pattern[idx] += 1;
    }
  }
  return pattern;
}

/** Build a ledger that ends at targetStock and never dips below zero.
 *  Self-balancing: when the simulated running stock dips negative, the
 *  initial count is raised and the final restock reduced by the same amount,
 *  preserving the exact ending position. */
function buildLedger(spec: LedgerSpec): LedgerMovement[] {
  const pattern = dailySalesPattern(spec.historyDays, spec.totalSales);
  // Deep-copy so the self-balancing mutation below never touches the frozen
  // literal seed data.
  const restocks = spec.restocks.map((r) => ({ daysAgo: r.daysAgo, qty: r.qty })).sort((a, b) => b.daysAgo - a.daysAgo); // oldest first
  const restockByDay = new Map<number, number>();
  for (const r of restocks) restockByDay.set(Math.round(r.daysAgo), r.qty);

  const totalRestock = restocks.reduce((sum, r) => sum + r.qty, 0);
  let initial = Math.max(0, spec.targetStock + spec.totalSales - totalRestock);

  // Rebalance until the running stock never dips below zero (bounded loops).
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const lastDay = restocks.length > 0 ? restocks[restocks.length - 1].daysAgo : spec.historyDays;
    let running = initial;
    let minRunning = initial;
    let minDay = spec.historyDays;
    for (let day = spec.historyDays - 1; day >= 0; day -= 1) {
      const restock = restockByDay.get(day);
      if (restock) running += restock;
      running -= pattern[spec.historyDays - 1 - day] ?? 0;
      if (running < minRunning) {
        minRunning = running;
        minDay = day;
      }
    }
    if (minRunning >= 0 && running === spec.targetStock) break;
    if (minRunning < 0) {
      if (minDay <= lastDay) {
        throw new Error(
          `seed: ${spec.sku} dips below zero AFTER the last restock (day ${minDay}) — the target ending stock is unreachable; rebalance restock days`,
        );
      }
      const deficit = -minRunning;
      initial += deficit;
      const last = restocks[restocks.length - 1];
      if (last.qty - deficit < 0) {
        throw new Error(`seed: ${spec.sku} cannot balance (needs ${deficit} extra units) — add an earlier restock`);
      }
      restockByDay.set(Math.round(last.daysAgo), last.qty - deficit);
      last.qty -= deficit;
      continue;
    }
    throw new Error(
      `seed: ${spec.sku} ends at ${running}, expected ${spec.targetStock} — internal seed bug`,
    );
  }

  const movements: LedgerMovement[] = [
    { delta: initial, reason: 'initial', occurredAt: daysAgo(spec.historyDays, 9) },
  ];
  for (let day = spec.historyDays - 1; day >= 0; day -= 1) {
    const restock = restockByDay.get(day);
    if (restock && restock > 0) {
      movements.push({ delta: restock, reason: 'restock', occurredAt: daysAgo(day, 8) });
    }
    const sold = pattern[spec.historyDays - 1 - day] ?? 0;
    if (sold > 0) {
      movements.push({ delta: -sold, reason: 'sale', occurredAt: daysAgo(day, 12) });
    }
  }
  return movements;
}

/* ------------------------------------------------------------------ */
/* Seed data (mirrors the reference application)                       */
/* ------------------------------------------------------------------ */

const SUPPLIERS = [
  {
    name: 'Electronics Direct',
    contactName: 'Sales Team',
    email: 'orders@electronicsdirect.com',
    rating: 4,
    paymentTerms: 'Net 30',
    leadTimeDays: 14,
    notes: 'Broad-line electronics distributor; primary source for camera bodies.',
  },
  {
    name: 'Nordic Supply Co.',
    contactName: 'Anna Lindgren',
    email: 'anna@nordicsupply.com',
    rating: 4,
    paymentTerms: 'Net 45',
    leadTimeDays: 14,
    notes: 'Specialist professional photo equipment importer.',
  },
  {
    name: 'Pacific Rim Traders',
    contactName: 'James Chen',
    email: 'james@pacificrimtraders.com',
    rating: 3,
    paymentTerms: 'Net 30',
    leadTimeDays: 10,
    notes: 'Optics trading house; competitive on prime lenses.',
  },
  {
    name: 'Atlas Logistics',
    contactName: 'Maria Santos',
    email: 'maria@atlaslogistics.com',
    rating: 1,
    paymentTerms: 'Net 60',
    leadTimeDays: 10,
    notes: 'Budget freight forwarder; frequent delays.',
  },
] as const;

const PRODUCTS = [
  {
    name: 'Full Frame Sensor Mirrorless Camera',
    sku: 'ELEC-CAM-001',
    category: 'Electronics',
    costMinor: 232000,
    priceMinor: 289900,
    stock: 8,
    reorderPoint: 5,
    reorderQty: 50,
    leadTimeDays: 7,
    location: 'Warehouse A',
    supplier: 'Electronics Direct',
    description: 'Full-frame mirrorless camera with 24MP sensor, in-body stabilization, and 4K60 video.',
    ledger: { historyDays: 150, totalSales: 225, restocks: [{ daysAgo: 140, qty: 50 }, { daysAgo: 85, qty: 50 }, { daysAgo: 40, qty: 50 }], targetStock: 8 },
  },
  {
    name: 'APS-C Sensor Mirrorless Camera',
    sku: 'ELEC-CAM-002',
    category: 'Electronics',
    costMinor: 142000,
    priceMinor: 176900,
    stock: 15,
    reorderPoint: 5,
    reorderQty: 50,
    leadTimeDays: 7,
    location: 'Warehouse A',
    supplier: 'Electronics Direct',
    description: 'Compact APS-C mirrorless body with hybrid autofocus and dual SD slots.',
    ledger: { historyDays: 162, totalSales: 195, restocks: [{ daysAgo: 150, qty: 60 }, { daysAgo: 70, qty: 60 }, { daysAgo: 25, qty: 55 }], targetStock: 15 },
  },
  {
    name: 'Full-Frame sensor Mirrorless Professional Camera',
    sku: 'ELEC-CAM-003',
    category: 'Electronics',
    costMinor: 180000,
    priceMinor: 224900,
    stock: 15,
    reorderPoint: 5,
    reorderQty: 50,
    leadTimeDays: 7,
    location: 'Warehouse B',
    supplier: 'Nordic Supply Co.',
    description: 'Professional full-frame body with 45MP sensor, weather sealing, and dual processors.',
    ledger: { historyDays: 135, totalSales: 54, restocks: [{ daysAgo: 70, qty: 39 }], targetStock: 15 },
  },
  {
    name: '50mm f1.8 Prime Lens',
    sku: 'ELEC-LENS-001',
    category: 'Electronics',
    costMinor: 28000,
    priceMinor: 34900,
    stock: 0,
    reorderPoint: 10,
    reorderQty: 50,
    leadTimeDays: 7,
    location: 'Warehouse A',
    supplier: 'Atlas Logistics',
    description: 'Lightweight 50mm f/1.8 prime lens; the workhorse standard focal length.',
    ledger: { historyDays: 137, totalSales: 110, restocks: [{ daysAgo: 120, qty: 60 }, { daysAgo: 30, qty: 20 }], targetStock: 0 },
  },
  {
    name: '35mm f1.8 Prime Lens',
    sku: 'ELEC-LENS-002',
    category: 'Electronics',
    costMinor: 26000,
    priceMinor: 32900,
    stock: 25,
    reorderPoint: 10,
    reorderQty: 50,
    leadTimeDays: 7,
    location: 'Warehouse A',
    supplier: 'Pacific Rim Traders',
    description: 'Versatile 35mm f/1.8 prime ideal for street and documentary work.',
    ledger: { historyDays: 120, totalSales: 84, restocks: [{ daysAgo: 100, qty: 50 }, { daysAgo: 20, qty: 34 }], targetStock: 25 },
  },
  {
    name: '85mm f2.8 Prime lens',
    sku: 'ELEC-LENS-003',
    category: 'Electronics',
    costMinor: 248000,
    priceMinor: 258000,
    stock: 25,
    reorderPoint: 10,
    reorderQty: 25,
    leadTimeDays: 7,
    location: 'Warehouse C',
    supplier: 'Electronics Direct',
    description: 'Professional 85mm f/2.8 prime lens with fast autofocus and superior low-light performance.',
    ledger: { historyDays: 90, totalSales: 0, restocks: [], targetStock: 25 },
  },
] as const;

const PURCHASE_ORDERS = [
  // orderNumber, sku, supplier, qty, unitCostMinor, status, daysAgo, reasoningKey
  { orderNumber: '2AF134', sku: 'ELEC-LENS-001', supplier: 'Electronics Direct', quantity: 25, unitCostMinor: 28000, status: 'Approved', daysAgo: 10 },
  { orderNumber: '2AF135', sku: 'ELEC-LENS-002', supplier: 'Electronics Direct', quantity: 10, unitCostMinor: 26000, status: 'Approved', daysAgo: 10 },
  { orderNumber: '2AF136', sku: 'ELEC-CAM-003', supplier: 'Electronics Direct', quantity: 15, unitCostMinor: 180000, status: 'Approved', daysAgo: 10 },
  { orderNumber: '2AF140', sku: 'ELEC-CAM-003', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 180000, status: 'Cancelled', daysAgo: 10 },
  { orderNumber: '2AF138', sku: 'ELEC-CAM-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 232000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF139', sku: 'ELEC-LENS-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 28000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF13A', sku: 'ELEC-LENS-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 26000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF13B', sku: 'ELEC-CAM-003', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 180000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF13C', sku: 'ELEC-CAM-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 142000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF13D', sku: 'ELEC-CAM-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 232000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF13E', sku: 'ELEC-LENS-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 28000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF13F', sku: 'ELEC-LENS-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 26000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF137', sku: 'ELEC-CAM-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 142000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF141', sku: 'ELEC-CAM-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 142000, status: 'Suggested', daysAgo: 6 },
  { orderNumber: '2AF142', sku: 'ELEC-CAM-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 232000, status: 'Suggested', daysAgo: 6 },
] as const;

const MARKET_TRENDS = [
  { category: 'Electronics', trendScore: 82, changePct: 14.5, direction: 'Up', description: 'AI-driven device demand surging across consumer and enterprise segments.', source: 'IDC Global' },
  { category: 'Apparel', trendScore: 65, changePct: 2.1, direction: 'Stable', description: 'Sustainable fabrics gaining traction; overall market steady.', source: 'Fashion Institute Analytics' },
  { category: 'Food & Beverage', trendScore: 72, changePct: 8.3, direction: 'Up', description: 'Health-conscious snacking and functional beverages driving growth.', source: 'Nielsen IQ' },
  { category: 'Beauty', trendScore: 90, changePct: 19.2, direction: 'Up', description: 'Skincare and biotech beauty products outperforming all other segments.', source: 'Euromonitor' },
  { category: 'Household', trendScore: 38, changePct: -5.7, direction: 'Down', description: 'Post-pandemic normalisation pulling down home improvement demand.', source: 'Statista' },
  { category: 'Office', trendScore: 61, changePct: 1.4, direction: 'Stable', description: 'Hybrid work models stabilising office supply procurement cycles.', source: 'Gartner' },
] as const;

/* ------------------------------------------------------------------ */
/* Seed execution                                                      */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log('Seeding supply-chain-management database…');

  // 1. Suppliers (natural key: name)
  const supplierIdByName = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const record = await db.supplier.upsert({
      where: { name: s.name },
      update: {
        contactName: s.contactName,
        email: s.email,
        rating: s.rating,
        paymentTerms: s.paymentTerms,
        leadTimeDays: s.leadTimeDays,
        notes: s.notes,
      },
      create: { ...s },
    });
    supplierIdByName.set(s.name, record.id);
  }
  console.log(`  suppliers: ${supplierIdByName.size}`);

  // 2. Products (natural key: sku) + movement ledger
  const productIdBySku = new Map<string, string>();
  for (const p of PRODUCTS) {
    const { ledger, supplier, ...productFields } = p;
    const record = await db.product.upsert({
      where: { sku: p.sku },
      update: { ...productFields, supplierId: supplierIdByName.get(supplier) },
      create: { ...productFields, supplierId: supplierIdByName.get(supplier) },
    });
    productIdBySku.set(p.sku, record.id);

    // Ledger: create only when the product has no movements yet (re-running
    // the seed must never wipe runtime history the user created).
    const existingMovements = await db.stockMovement.count({ where: { productId: record.id } });
    if (existingMovements === 0) {
      const movements = buildLedger({ sku: p.sku, ...ledger });
      await db.stockMovement.createMany({
        data: movements.map((m) => ({
          productId: record.id,
          delta: m.delta,
          reason: m.reason,
          createdAt: m.occurredAt,
        })),
      });
      console.log(`  product ${p.sku}: ${movements.length} ledger movements`);
    }
  }
  console.log(`  products: ${productIdBySku.size}`);

  // 3. Purchase orders (natural key: orderNumber). Suggested orders carry
  //    AI reasoning generated by the domain engine from the product's real
  //    stock position and velocity — the text is derived, never fabricated.
  for (const po of PURCHASE_ORDERS) {
    const productId = productIdBySku.get(po.sku);
    const supplierId = supplierIdByName.get(po.supplier);
    if (!productId || !supplierId) throw new Error(`seed: unknown sku/supplier for ${po.orderNumber}`);

    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { movements: true },
    });
    const supplier = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    const delivery =
      po.status === 'Suggested'
        ? new Date(now.getTime() + supplier.leadTimeDays * DAY_MS)
        : new Date(now.getTime() - (po.daysAgo - supplier.leadTimeDays) * DAY_MS);

    let aiReasoning: string | null = null;
    if (po.status === 'Suggested') {
      const movements = product.movements.map((m) => ({
        delta: m.delta,
        reason: m.reason,
        occurredAt: m.createdAt,
      }));
      const velocity = velocityPerDay(movements, now);
      const lead = supplier.leadTimeDays;
      const projected = projectedStockAtLeadTime({
        stock: product.stock,
        reorderPoint: product.reorderPoint,
        reorderQty: product.reorderQty,
        leadTimeDays: product.leadTimeDays,
        supplierLeadTimeDays: lead,
        movements,
      });
      aiReasoning = buildAiReasoning({
        productName: product.name,
        stock: product.stock,
        reorderPoint: product.reorderPoint,
        velocityPerDay: velocity,
        leadTimeDays: lead,
        daysOfCover: daysOfCover(product.stock, velocity),
        projectedStock: projected,
      });
    }

    await db.purchaseOrder.upsert({
      where: { orderNumber: po.orderNumber },
      update: {
        productId,
        supplierId,
        quantity: po.quantity,
        unitCostMinor: po.unitCostMinor,
        status: po.status,
        aiReasoning,
        orderDate: daysAgo(po.daysAgo, 9),
        expectedDelivery: delivery,
      },
      create: {
        orderNumber: po.orderNumber,
        productId,
        supplierId,
        quantity: po.quantity,
        unitCostMinor: po.unitCostMinor,
        status: po.status,
        aiReasoning,
        orderDate: daysAgo(po.daysAgo, 9),
        expectedDelivery: delivery,
      },
    });
  }
  console.log(`  purchase orders: ${PURCHASE_ORDERS.length}`);

  // 4. Market trends (natural key: category)
  const quarter = `Q${Math.floor((now.getUTCMonth() + 3) / 3)} ${now.getUTCFullYear()}`;
  for (const t of MARKET_TRENDS) {
    await db.marketTrend.upsert({
      where: { category: t.category },
      update: { ...t, quarter },
      create: { ...t, quarter },
    });
  }
  console.log(`  market trends: ${MARKET_TRENDS.length} (${quarter})`);

  // 5. Demo user (natural key: email)
  const demoEmail = process.env.SEED_DEMO_EMAIL?.trim() || 'demo@supplychain.local';
  const demoPassword = process.env.SEED_DEMO_PASSWORD?.trim() || 'demo-password';
  await db.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash: hashPassword(demoPassword) },
    create: { email: demoEmail, name: 'Supply Chain Demo', passwordHash: hashPassword(demoPassword) },
  });
  console.log(`  demo user: ${demoEmail}`);

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
