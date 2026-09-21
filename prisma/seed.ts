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
import { resolveDatabaseUrl } from '../src/lib/db-path';

const db = new PrismaClient({ datasourceUrl: resolveDatabaseUrl(process.env.DATABASE_URL) });

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number, hour = 10): Date => {
  const d = new Date(now.getTime() - n * DAY_MS);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

/** The reference app's capture date. Purchase-order dates (and the market
 *  trend quarter) are pinned to it — the live reference displays these as
 *  fixed dates (07.06.26, 07.12.26, Q3 2026) that never drift, so the
 *  clone must render the same dates on every future day instead of sliding
 *  them with `now`. The movement ledger, in contrast, stays `now`-relative
 *  because velocity/forecast math needs live windows. */
const REFERENCE_ANCHOR = new Date('2026-09-20T09:00:00.000Z');
const anchorDaysAgo = (n: number, hour = 9): Date => {
  const d = new Date(REFERENCE_ANCHOR.getTime() - n * DAY_MS);
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
  recentDelta?: number; // sales in last 30d minus prior 30d (movers badge)
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

/** Adjust the daily-sales pattern so salesDelta30d lands EXACTLY on the
 *  reference app's mover-badge values (+2/−1/0/+1/+2). Two mechanisms:
 *  - a cross-window move (prior→recent or recent→prior) shifts the delta by
 *    ±2 (one side gains, the other loses a unit);
 *  - an odd remainder is closed by moving a single unit between the region
 *    outside the 60-day horizon and the recent window (delta ±1).
 *  Total sales and the ending stock never change; the balancing loop in
 *  buildLedger still validates that stock never dips below zero. */
function applyRecentDelta(pattern: number[], targetDelta: number): number[] {
  if (pattern.length < 62) return pattern;
  const days = pattern.length;
  const recentLo = days - 30; // pattern index of dayOffset 29
  const priorLo = days - 60; // pattern index of dayOffset 59
  const sum = (lo: number, hi: number): number => {
    let s = 0;
    for (let i = lo; i <= hi; i += 1) s += pattern[i] ?? 0;
    return s;
  };
  const current = sum(recentLo, days - 1) - sum(priorLo, recentLo - 1);
  let needed = targetDelta - current;

  const moveOne = (fromLo: number, fromHi: number, toLo: number, toHi: number): boolean => {
    let src = -1;
    for (let i = fromLo; i <= fromHi && src < 0; i += 1) if ((pattern[i] ?? 0) > 0) src = i;
    if (src < 0) return false;
    pattern[src]! -= 1;
    let tgt = toHi;
    while (tgt > toLo && (pattern[tgt] ?? 0) === 0) tgt -= 1;
    pattern[tgt]! += 1;
    return true;
  };

  // Even part: cross-window moves (each worth ±2 of delta).
  const cross = Math.trunc(needed / 2);
  for (let k = 0; k < Math.abs(cross); k += 1) {
    const moved =
      cross > 0
        ? moveOne(priorLo, recentLo - 1, recentLo, days - 1)
        : moveOne(recentLo, days - 1, priorLo, recentLo - 1);
    if (!moved) break;
    needed -= cross > 0 ? 2 : -2;
  }
  // Odd remainder: one unit between outside-60 and the recent window (±1).
  if (needed > 0) {
    if (moveOne(0, days - 61, recentLo, days - 1)) needed -= 1;
  } else if (needed < 0) {
    if (moveOne(recentLo, days - 1, 0, days - 61)) needed += 1;
  }
  return pattern;
}

/** Build a ledger that ends at targetStock and never dips below zero.
 *  Self-balancing: when the simulated running stock dips negative, the
 *  initial count is raised and the final restock reduced by the same amount,
 *  preserving the exact ending position. */
function buildLedger(spec: LedgerSpec): LedgerMovement[] {
  const pattern = applyRecentDelta(
    dailySalesPattern(spec.historyDays, spec.totalSales),
    spec.recentDelta ?? 0,
  );
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
    phone: null,
    rating: 4,
    paymentTerms: 'Net 30',
    leadTimeDays: 0,
    notes: null,
    createdDaysAgo: 64, // oldest -> last card
  },
  {
    name: 'Nordic Supply Co.',
    contactName: 'Anna Lindgren',
    email: 'anna@nordicsupply.com',
    phone: '+46 70 123 4567',
    rating: 4,
    paymentTerms: 'Net 45',
    leadTimeDays: 10,
    notes: 'Scandinavian distributor',
    createdDaysAgo: 61, // newest -> first card (reference order)
  },
  {
    name: 'Pacific Rim Traders',
    contactName: 'James Chen',
    email: 'james@pacificrimtraders.com',
    phone: '+1 415 987 6543',
    rating: 3,
    paymentTerms: 'Net 30',
    leadTimeDays: 14,
    notes: 'Asia-Pacific sourcing',
    createdDaysAgo: 63,
  },
  {
    name: 'Atlas Logistics',
    contactName: 'Maria Santos',
    email: 'maria@atlaslogistics.com',
    phone: '+34 91 234 5678',
    rating: 1,
    paymentTerms: 'Net 60',
    leadTimeDays: 7,
    notes: 'European freight specialist',
    createdDaysAgo: 62,
  },
] as const;

const PRODUCTS = [
  {
    name: 'Full Frame Sensor Mirrorless Camera',
    sku: 'ELEC-CAM-001',
    category: 'Electronics',
    costMinor: 232000,
    priceMinor: 240000,
    stock: 8,
    reorderPoint: 5,
    reorderQty: 5,
    leadTimeDays: 14,
    location: null,
    supplier: 'Electronics Direct',
    imageUrl: '/products/elec-cam-001.svg',
    description: 'Sleek black compact digital camera with LCD display, intuitive controls, and high-quality optics.',
    ledger: { historyDays: 150, totalSales: 225, restocks: [{ daysAgo: 140, qty: 50 }, { daysAgo: 85, qty: 50 }, { daysAgo: 40, qty: 50 }], targetStock: 8, recentDelta: 2 },
  },
  {
    name: 'APS-C Sensor Mirrorless Camera',
    sku: 'ELEC-CAM-002',
    category: 'Electronics',
    costMinor: 142000,
    priceMinor: 145000,
    stock: 15,
    reorderPoint: 5,
    reorderQty: 10,
    leadTimeDays: 14,
    location: null,
    supplier: 'Electronics Direct',
    imageUrl: '/products/elec-cam-002.svg',
    description: 'Professional compact digital camera with OLED display showing 1/250s shutter speed and f8.',
    ledger: { historyDays: 162, totalSales: 195, restocks: [{ daysAgo: 150, qty: 60 }, { daysAgo: 70, qty: 60 }, { daysAgo: 25, qty: 55 }], targetStock: 15, recentDelta: -1 },
  },
  {
    name: 'Full-Frame sensor Mirrorless Professional Camera',
    sku: 'ELEC-CAM-003',
    category: 'Electronics',
    costMinor: 305000,
    priceMinor: 320000,
    stock: 15,
    reorderPoint: 5,
    reorderQty: 10,
    leadTimeDays: 14,
    location: null,
    supplier: 'Nordic Supply Co.',
    imageUrl: '/products/elec-cam-003.svg',
    description: 'Full-frame mirrorless camera body with OLED EVF and advanced autofocus system.',
    ledger: { historyDays: 135, totalSales: 54, restocks: [{ daysAgo: 70, qty: 39 }], targetStock: 15, recentDelta: 2 },
  },
  {
    name: '50mm f1.8 Prime Lens',
    sku: 'ELEC-LENS-001',
    category: 'Electronics',
    costMinor: 162000,
    priceMinor: 165000,
    stock: 0,
    reorderPoint: 10,
    reorderQty: 20,
    leadTimeDays: 10,
    location: null,
    supplier: 'Atlas Logistics',
    imageUrl: '/products/elec-lens-001.svg',
    description: 'Professional 50mm f/1.8 prime lens with fast autofocus and superior low-light performance.',
    ledger: { historyDays: 137, totalSales: 110, restocks: [{ daysAgo: 120, qty: 60 }, { daysAgo: 30, qty: 20 }], targetStock: 0, recentDelta: 0 },
  },
  {
    name: '35mm f1.8 Prime Lens',
    sku: 'ELEC-LENS-002',
    category: 'Electronics',
    costMinor: 220000,
    priceMinor: 225000,
    stock: 25,
    reorderPoint: 10,
    reorderQty: 20,
    leadTimeDays: 10,
    location: null,
    supplier: 'Pacific Rim Traders',
    imageUrl: '/products/elec-lens-002.svg',
    description: 'Compact 35mm f/1.8 wide-angle lens, ideal for street and portrait photography.',
    ledger: { historyDays: 120, totalSales: 84, restocks: [{ daysAgo: 100, qty: 50 }, { daysAgo: 20, qty: 34 }], targetStock: 25, recentDelta: 1 },
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
    location: null,
    supplier: 'Electronics Direct',
    imageUrl: '/products/elec-lens-003.svg',
    description: 'Professional 85mm f/2.8 prime lens with fast autofocus and superior low-light performance.',
    ledger: { historyDays: 90, totalSales: 0, restocks: [], targetStock: 25, recentDelta: 0 },
  },
] as const;

const PURCHASE_ORDERS = [
  // List order = the reference app's procurement row order (createdAt desc).
  // orderNumber, sku, supplier, qty, unitCostMinor, status, orderDaysAgo, createdDaysAgo
  { orderNumber: '2AF140', sku: 'ELEC-CAM-003', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 180000, status: 'Cancelled', daysAgo: 70, createdDaysAgo: 40 },
  { orderNumber: '2AF134', sku: 'ELEC-LENS-001', supplier: 'Electronics Direct', quantity: 25, unitCostMinor: 28000, status: 'Approved', daysAgo: 70, createdDaysAgo: 41 },
  { orderNumber: '2AF136', sku: 'ELEC-CAM-003', supplier: 'Electronics Direct', quantity: 15, unitCostMinor: 180000, status: 'Approved', daysAgo: 70, createdDaysAgo: 42 },
  { orderNumber: '2AF138', sku: 'ELEC-CAM-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 232000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 44 },
  { orderNumber: '2AF13E', sku: 'ELEC-LENS-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 28000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 45 },
  { orderNumber: '2AF13B', sku: 'ELEC-CAM-003', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 180000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 47 },
  { orderNumber: '2AF13C', sku: 'ELEC-CAM-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 142000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 43 },
  { orderNumber: '2AF139', sku: 'ELEC-LENS-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 28000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 50 },
  { orderNumber: '2AF142', sku: 'ELEC-CAM-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 232000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 49 },
  { orderNumber: '2AF141', sku: 'ELEC-CAM-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 142000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 48 },
  { orderNumber: '2AF13D', sku: 'ELEC-CAM-001', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 232000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 53 },
  { orderNumber: '2AF13F', sku: 'ELEC-LENS-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 26000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 46 },
  { orderNumber: '2AF135', sku: 'ELEC-LENS-002', supplier: 'Electronics Direct', quantity: 10, unitCostMinor: 26000, status: 'Approved', daysAgo: 70, createdDaysAgo: 52 },
  { orderNumber: '2AF13A', sku: 'ELEC-LENS-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 26000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 51 },
  { orderNumber: '2AF137', sku: 'ELEC-CAM-002', supplier: 'Electronics Direct', quantity: 50, unitCostMinor: 142000, status: 'Suggested', daysAgo: 76, createdDaysAgo: 52 },
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

  // 1. Suppliers (natural key: name) — createdAt seeded for the reference
  //    card order (Nordic newest first, Electronics Direct oldest last).
  const supplierIdByName = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const { createdDaysAgo: supplierCreatedDaysAgo, ...supplierFields } = s;
    const createdAt = daysAgo(supplierCreatedDaysAgo, 9);
    const record = await db.supplier.upsert({
      where: { name: s.name },
      update: { ...supplierFields, createdAt },
      create: { ...supplierFields, createdAt },
    });
    supplierIdByName.set(s.name, record.id);
  }
  console.log(`  suppliers: ${supplierIdByName.size}`);

  // 2. Products (natural key: sku) + movement ledger. createdAt is seeded
  //    so the catalog lists newest-first in the reference app's exact row order.
  const PRODUCT_CREATED_DAYS_AGO: Record<string, number> = {
    'ELEC-LENS-003': 50, // newest -> first row
    'ELEC-LENS-001': 51,
    'ELEC-LENS-002': 52,
    'ELEC-CAM-003': 53,
    'ELEC-CAM-002': 54,
    'ELEC-CAM-001': 55, // oldest -> last row
  };
  const productIdBySku = new Map<string, string>();
  for (const p of PRODUCTS) {
    const { ledger, supplier, ...productFields } = p;
    const createdAt = daysAgo(PRODUCT_CREATED_DAYS_AGO[p.sku] ?? 60, 9);
    const record = await db.product.upsert({
      where: { sku: p.sku },
      update: { ...productFields, supplierId: supplierIdByName.get(supplier), createdAt },
      create: { ...productFields, supplierId: supplierIdByName.get(supplier), createdAt },
    });
    productIdBySku.set(p.sku, record.id);

    // Ledger: create only when the product has no movements yet (re-running
    // the seed must never wipe runtime history the user created). The six
    // seeded products' engineered ledgers are ALSO rebuilt when their newest
    // sale no longer falls on today (UTC): the movers badges are day-bucketed
    // 30d-vs-prior-30d windows (src/domain/replenishment.ts salesDelta30d),
    // so a ledger that has crossed UTC midnight drifts off the reference
    // +2/-1/0/+1/+2 values. Rebuilding re-anchors the demo data to the
    // current day and keeps `db:seed && verify:analytics` self-healing
    // (Product.stock is reset by the upsert above, so the rebuilt ledger
    // stays consistent with the stored stock).
    const existing = await db.stockMovement.findMany({
      where: { productId: record.id },
      select: { reason: true, delta: true, createdAt: true },
    });
    const newestSale = existing.reduce<Date | null>((acc, m) => {
      if (m.reason !== 'sale' || m.delta >= 0) return acc;
      return acc === null || m.createdAt > acc ? m.createdAt : acc;
    }, null);
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const staleLedger = newestSale !== null && newestSale < startOfToday;
    if (existing.length === 0 || staleLedger) {
      if (staleLedger) {
        await db.stockMovement.deleteMany({ where: { productId: record.id } });
        console.log(
          `  product ${p.sku}: ledger crossed UTC midnight (newest sale ${newestSale!.toISOString().slice(0, 10)}) — rebuilt for today`,
        );
      }
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
    const orderDate = anchorDaysAgo(po.daysAgo, 9);
    // Reference parity: Suggested orders display their order date as the
    // Delivery date (2026-07-06); approved history lands order date + lead time.
    const delivery =
      po.status === 'Suggested'
        ? orderDate
        : new Date(orderDate.getTime() + supplier.leadTimeDays * DAY_MS);

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
        orderDate,
        expectedDelivery: delivery,
        createdAt: anchorDaysAgo(po.createdDaysAgo, 9),
      },
      create: {
        orderNumber: po.orderNumber,
        productId,
        supplierId,
        quantity: po.quantity,
        unitCostMinor: po.unitCostMinor,
        status: po.status,
        aiReasoning,
        orderDate,
        expectedDelivery: delivery,
        createdAt: anchorDaysAgo(po.createdDaysAgo, 9),
      },
    });
  }
  console.log(`  purchase orders: ${PURCHASE_ORDERS.length}`);

  // 4. Market trends (natural key: category). The quarter is pinned to the
  //    reference capture ("Q3 2026") — see REFERENCE_ANCHOR above.
  const quarter = `Q${Math.floor((REFERENCE_ANCHOR.getUTCMonth() + 3) / 3)} ${REFERENCE_ANCHOR.getUTCFullYear()}`;
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
