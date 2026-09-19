/**
 * Analytics verification — checks that the seeded ledger produces the
 * reference application's derived values (velocity per product, low-stock
 * score, pending suggestions, inventory value curve).
 * Run: bun scripts/verify-analytics.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  analyzeProduct,
  lowStockScore,
  velocityPerDay,
  buildLedgerDaySeries,
} from '../src/domain/replenishment';

const db = new PrismaClient();

async function main(): Promise<void> {
  const products = await db.product.findMany({ include: { supplier: true, movements: true } });
  const now = new Date();

  const expectedVelocity: Record<string, number> = {
    'ELEC-CAM-001': 1.5,
    'ELEC-CAM-002': 1.2,
    'ELEC-CAM-003': 0.4,
    'ELEC-LENS-001': 0.8,
    'ELEC-LENS-002': 0.7,
    'ELEC-LENS-003': 0.0,
  };

  console.log('=== Velocity check (engine rule) ===');
  let failures = 0;
  for (const p of products) {
    const movements = p.movements.map((m) => ({ delta: m.delta, reason: m.reason, occurredAt: m.createdAt }));
    const velocity = velocityPerDay(movements, now);
    const expected = expectedVelocity[p.sku] ?? -1;
    const pass = velocity === expected;
    if (!pass) failures += 1;
    console.log(`  ${p.sku}: velocity=${velocity} expected=${expected} ${pass ? 'PASS' : 'FAIL'}`);
  }

  console.log('=== Low stock score (expected -1) ===');
  const score = lowStockScore(products.map((p) => ({ stock: p.stock, reorderPoint: p.reorderPoint })));
  const pass = score === -1;
  if (!pass) failures += 1;
  console.log(`  score=${score} ${pass ? 'PASS' : 'FAIL'}`);

  console.log('=== Pending suggestions (expected 11) ===');
  const pending = await db.purchaseOrder.count({ where: { status: 'Suggested' } });
  const pendingPass = pending === 11;
  if (!pendingPass) failures += 1;
  console.log(`  count=${pending} ${pendingPass ? 'PASS' : 'FAIL'}`);

  console.log('=== Inventory value (cost basis) ===');
  const value = products.reduce((sum, p) => sum + p.stock * p.costMinor, 0);
  console.log(`  $${(value / 100).toLocaleString('en-US')}`);

  console.log('=== 90-day inventory value series sanity ===');
  const series = buildLedgerDaySeries(
    products.map((p) => ({
      costMinor: p.costMinor,
      movements: p.movements.map((m) => ({ delta: m.delta, reason: m.reason, occurredAt: m.createdAt })),
    })),
    90,
    now,
  );
  const first = series[0]?.valueMinor ?? 0;
  const last = series[series.length - 1]?.valueMinor ?? 0;
  console.log(`  start=$${(first / 100).toLocaleString('en-US')} end=$${(last / 100).toLocaleString('en-US')} points=${series.length}`);
  const lastMatches = last === value;
  if (!lastMatches) failures += 1;
  console.log(`  end matches live value: ${lastMatches ? 'PASS' : 'FAIL'}`);

  console.log('=== Product analytics snapshot ===');
  for (const p of products) {
    const analytics = analyzeProduct({
      stock: p.stock,
      reorderPoint: p.reorderPoint,
      reorderQty: p.reorderQty,
      leadTimeDays: p.leadTimeDays,
      supplierLeadTimeDays: p.supplier?.leadTimeDays ?? null,
      movements: p.movements.map((m) => ({ delta: m.delta, reason: m.reason, occurredAt: m.createdAt })),
    });
    console.log(
      `  ${p.sku}: sales=${analytics.totalSales} velocity=${analytics.velocityPerDay} delta=${analytics.velocityDelta} cover=${analytics.daysOfCover ?? '-'} gap=${analytics.stockGap}`,
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} FAILURES`);
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
