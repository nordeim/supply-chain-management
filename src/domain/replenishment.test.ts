import { describe, expect, it } from 'vitest';
import {
  LOW_STOCK_SCALE_MAX,
  LOW_STOCK_SCALE_MIN,
  VELOCITY_WINDOW_DAYS,
  buildAiReasoning,
  buildStockHistory,
  daysOfCover,
  expectedDeliveryDate,
  formatTableDate,
  gaugeAngleFraction,
  lowStockScore,
  lowStockTickIndex,
  salesDelta30d,
  suggestedOrderQty,
  totalSales,
  velocityPerDay,
  type MovementRecord,
} from './replenishment';

/** Build a sale movement `daysAgo` days before `now` for `qty` units. */
function sale(daysAgo: number, qty: number, now: Date): MovementRecord {
  return {
    delta: -qty,
    reason: 'sale',
    occurredAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  };
}

/** Build a restock movement `daysAgo` days before `now` for `qty` units. */
function restock(daysAgo: number, qty: number, now: Date): MovementRecord {
  return {
    delta: qty,
    reason: 'restock',
    occurredAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  };
}

const NOW = new Date('2026-09-20T12:00:00.000Z');

describe('velocityPerDay (ADR-004 rule)', () => {
  it('mature product: 225 sales over a 150-day window = 1.5/day (reference ELEC-CAM-001)', () => {
    const movements: MovementRecord[] = [];
    // 225 sales evenly spread over 150 days, first sale exactly 150 days ago.
    for (let i = 0; i < 225; i += 1) {
      movements.push(sale(150 - (150 / 225) * i, 1, NOW));
    }
    expect(velocityPerDay(movements, NOW)).toBe(1.5);
  });

  it('younger product: 110 sales since first sale 137 days ago = 0.8/day (reference ELEC-LENS-001)', () => {
    const movements: MovementRecord[] = [];
    for (let i = 0; i < 110; i += 1) {
      movements.push(sale(137 - (137 / 110) * i, 1, NOW));
    }
    expect(velocityPerDay(movements, NOW)).toBe(0.8);
  });

  it('returns 0 for a product with no sales (reference ELEC-LENS-003)', () => {
    expect(velocityPerDay([restock(90, 25, NOW)], NOW)).toBe(0);
  });

  it('ignores restocks when counting sales', () => {
    const mixed = [restock(140, 50, NOW), ...Array.from({ length: 150 }, (_, i) => sale(149 - i, 1, NOW))];
    expect(velocityPerDay(mixed, NOW)).toBe(1);
  });
});

describe('salesDelta30d (reference top-movers badge semantics)', () => {
  it('computes the integer difference of units sold: last 30d minus prior 30d', () => {
    // 5 sales in the last 30 days, 3 in days 31-60 -> +2 (reference CAM-001 badge)
    const movements = [
      sale(10, 1, NOW), sale(12, 1, NOW), sale(15, 1, NOW), sale(20, 1, NOW), sale(25, 1, NOW),
      sale(35, 1, NOW), sale(40, 1, NOW), sale(55, 1, NOW),
    ];
    expect(salesDelta30d(movements, NOW)).toBe(2);
  });

  it('returns -1 when the prior window sold one more unit (reference CAM-002 badge)', () => {
    const movements = [
      sale(10, 1, NOW), sale(20, 1, NOW),
      sale(35, 1, NOW), sale(40, 1, NOW), sale(50, 1, NOW),
    ];
    expect(salesDelta30d(movements, NOW)).toBe(-1);
  });

  it('returns 0 for symmetric windows (reference LENS-001 badge)', () => {
    const movements = [sale(10, 1, NOW), sale(35, 1, NOW)];
    expect(salesDelta30d(movements, NOW)).toBe(0);
  });

  it('never counts movements outside the 60-day horizon', () => {
    const movements = [sale(5, 1, NOW), sale(100, 1, NOW)];
    expect(salesDelta30d(movements, NOW)).toBe(1);
  });

  it('handles bulk deltas (qty > 1 per movement)', () => {
    const movements = [sale(10, 4, NOW), sale(40, 2, NOW)];
    expect(salesDelta30d(movements, NOW)).toBe(2);
  });
});

describe('buildAiReasoning (reference canonical sentence)', () => {
  const base = {
    productName: 'Full Frame Sensor Mirrorless Camera',
    stock: 8,
    reorderPoint: 5,
    velocityPerDay: 1.5,
    leadTimeDays: 14,
    daysOfCover: 5.3,
    projectedStock: -13,
  } as const;

  it('produces the reference app\'s exact reasoning sentence', () => {
    expect(buildAiReasoning(base)).toBe(
      'Stock is projected to fall below the reorder point before the next replenishment cycle. Ordering now accounts for supplier lead time and maintains a safety buffer.',
    );
  });

  it('uses the same canonical sentence for the out-of-stock branch (reference parity)', () => {
    expect(buildAiReasoning({ ...base, stock: 0, reorderPoint: 10, velocityPerDay: 0.8 })).toBe(
      'Stock is projected to fall below the reorder point before the next replenishment cycle. Ordering now accounts for supplier lead time and maintains a safety buffer.',
    );
  });

  it('uses the same canonical sentence for the healthy-buffer branch', () => {
    expect(buildAiReasoning({ ...base, stock: 25, reorderPoint: 10, projectedStock: 15 })).toBe(
      'Stock is projected to fall below the reorder point before the next replenishment cycle. Ordering now accounts for supplier lead time and maintains a safety buffer.',
    );
  });
});

describe('lowStockScore', () => {
  it('reference catalog scores -1 (deepest shortfall: stock 0 vs reorder 10)', () => {
    const catalog = [
      { stock: 8, reorderPoint: 5 },
      { stock: 15, reorderPoint: 5 },
      { stock: 15, reorderPoint: 5 },
      { stock: 0, reorderPoint: 10 },
      { stock: 25, reorderPoint: 10 },
      { stock: 25, reorderPoint: 10 },
    ];
    expect(lowStockScore(catalog)).toBe(-1);
  });

  it('returns 0 when every product is at or above its reorder point', () => {
    expect(lowStockScore([{ stock: 50, reorderPoint: 10 }])).toBe(0);
  });

  it('clamps to the -20 scale floor', () => {
    expect(lowStockScore([{ stock: 0, reorderPoint: 500 }])).toBe(LOW_STOCK_SCALE_MIN);
    expect(lowStockScore([{ stock: 0, reorderPoint: 10 }])).toBe(-1);
  });

  it('scale bounds are -20..0', () => {
    expect(LOW_STOCK_SCALE_MIN).toBe(-20);
    expect(LOW_STOCK_SCALE_MAX).toBe(0);
  });
});

describe('lowStockTickIndex (gauge marker position)', () => {
  it('places the -1 marker near the right end of a 20-tick scale (reference geometry)', () => {
    // -1 maps to 95% of the [-20, 0] scale -> tick index 19 of 20 (0-based)
    expect(lowStockTickIndex(-1, 20)).toBe(19);
  });

  it('places 0 at the last tick', () => {
    expect(lowStockTickIndex(0, 20)).toBe(20);
  });

  it('places -20 at the first tick', () => {
    expect(lowStockTickIndex(-20, 20)).toBe(0);
  });

  it('places -10 at the middle tick', () => {
    expect(lowStockTickIndex(-10, 20)).toBe(10);
  });
});

describe('gaugeAngleFraction (Pending POS semicircle gauge)', () => {
  it('11 of 60 -> ~0.183 fraction (reference marker position)', () => {
    expect(gaugeAngleFraction(11, 60)).toBeCloseTo(0.1833, 3);
  });

  it('0 -> 0 (left end of the arc)', () => {
    expect(gaugeAngleFraction(0, 60)).toBe(0);
  });

  it('max -> 1 (right end of the arc)', () => {
    expect(gaugeAngleFraction(60, 60)).toBe(1);
  });

  it('clamps out-of-range values', () => {
    expect(gaugeAngleFraction(99, 60)).toBe(1);
    expect(gaugeAngleFraction(-5, 60)).toBe(0);
  });
});

describe('daysOfCover', () => {
  it('8 units at 1.5/day = 5.3 days', () => {
    expect(daysOfCover(8, 1.5)).toBe(5.3);
  });

  it('null when velocity is zero', () => {
    expect(daysOfCover(25, 0)).toBeNull();
  });
});

describe('suggestedOrderQty', () => {
  it('returns at least the reorder quantity', () => {
    const product = {
      stock: 25, reorderPoint: 10, reorderQty: 25, leadTimeDays: 14, supplierLeadTimeDays: null,
      movements: [restock(90, 25, NOW)], now: NOW,
    };
    expect(suggestedOrderQty(product)).toBeGreaterThanOrEqual(25);
  });

  it('scales with lead-time demand for a fast mover', () => {
    const movements: MovementRecord[] = [];
    for (let i = 0; i < 225; i += 1) movements.push(sale(150 - (150 / 225) * i, 1, NOW));
    const product = {
      stock: 8, reorderPoint: 5, reorderQty: 5, leadTimeDays: 14, supplierLeadTimeDays: null,
      movements, now: NOW,
    };
    // 1.5/day * 14 = 21 units lead-time demand + 5 (one reorder cycle) = 26,
    // rounded up to the next multiple of reorderQty 5 -> 30
    expect(suggestedOrderQty(product)).toBe(30);
  });
});

describe('totalSales', () => {
  it('sums sale movements only', () => {
    const movements = [sale(10, 2, NOW), restock(50, 50, NOW), sale(60, 3, NOW)];
    expect(totalSales(movements)).toBe(5);
  });
});

describe('formatTableDate (reference MM.DD.YY)', () => {
  it('2026-07-06 -> "07.06.26"', () => {
    expect(formatTableDate(new Date('2026-07-06T00:00:00.000Z'))).toBe('07.06.26');
  });

  it('2026-07-12 -> "07.12.26"', () => {
    expect(formatTableDate(new Date('2026-07-12T00:00:00.000Z'))).toBe('07.12.26');
  });
});

describe('expectedDeliveryDate', () => {
  it('adds lead time in days and returns ISO yyyy-mm-dd', () => {
    expect(expectedDeliveryDate(14, new Date('2026-09-20T00:00:00.000Z'))).toBe('2026-10-04');
  });
});

describe('buildStockHistory', () => {
  it('replays the ledger backwards from current stock without going negative', () => {
    const movements = [
      restock(5, 10, NOW),
      sale(2, 3, NOW),
    ];
    const series = buildStockHistory(movements, 10, 7, NOW);
    expect(series).toHaveLength(10);
    expect(series.at(-1)?.stock).toBe(7);
    // The sale day (2 days ago) closes at 7 units (after the sale of 3)...
    const saleDay = series.find((p) => p.date === new Date(NOW.getTime() - 2 * 86400000).toISOString().slice(0, 10));
    expect(saleDay?.stock).toBe(7);
    // ...and the day before it closed at 10 units.
    const dayBefore = series.find((p) => p.date === new Date(NOW.getTime() - 3 * 86400000).toISOString().slice(0, 10));
    expect(dayBefore?.stock).toBe(10);
    const minStock = Math.min(...series.map((p) => p.stock));
    expect(minStock).toBeGreaterThanOrEqual(0);
  });
});

describe('engine constants', () => {
  it('velocity window stays pinned to 150 days (ADR-004)', () => {
    expect(VELOCITY_WINDOW_DAYS).toBe(150);
  });
});

/* ------------------------------------------------------------------ */
/* Pinning tests for previously uncovered engine surfaces              */
/* ------------------------------------------------------------------ */

import {
  analyzeProduct,
  buildLedgerDaySeries,
  forecastDemand,
  needsReplenishment,
  projectedStockAtLeadTime,
  velocityDelta,
} from './replenishment';

describe('velocityDelta (change vs previous 30-day window)', () => {
  it('falling demand: 1/day now vs 2/day prior window = -1.0', () => {
    const movements: MovementRecord[] = [];
    for (let d = 1; d <= 30; d += 1) movements.push(sale(d, 1, NOW)); // current window
    for (let d = 31; d <= 60; d += 1) movements.push(sale(d, 2, NOW)); // 2/day prior window
    expect(velocityDelta(movements, NOW)).toBe(-1.0);
  });

  it('rising demand: 2/day now vs 1/day prior window = +1.0', () => {
    const movements: MovementRecord[] = [];
    for (let d = 1; d <= 30; d += 1) movements.push(sale(d, 2, NOW));
    for (let d = 31; d <= 60; d += 1) movements.push(sale(d, 1, NOW));
    expect(velocityDelta(movements, NOW)).toBe(1.0);
  });

  it('no history at all = 0', () => {
    expect(velocityDelta([], NOW)).toBe(0);
  });
});

describe('projectedStockAtLeadTime', () => {
  const now = NOW;
  // 300 sales over a mature 150-day ledger => exactly 2.0/day.
  const twoPerDay: MovementRecord[] = [];
  for (let d = 1; d <= 150; d += 1) twoPerDay.push(sale(d, 2, now));
  // 45 sales over 150 days => 0.3/day (rounding branch).
  const slow: MovementRecord[] = [];
  for (let d = 1; d <= 150; d += 1) slow.push(sale(d, 0.3, now)); // fractional deltas are allowed

  it('prefers the supplier lead time when present', () => {
    const p = { stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 5, supplierLeadTimeDays: 10, movements: twoPerDay, now };
    expect(projectedStockAtLeadTime(p)).toBe(80); // 100 - 2.0 * 10
  });

  it('falls back to the product lead time when supplier lead is null', () => {
    const p = { stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 5, supplierLeadTimeDays: null, movements: twoPerDay, now };
    expect(projectedStockAtLeadTime(p)).toBe(90); // 100 - 2.0 * 5
  });

  it('rounds the projection to a whole unit', () => {
    // 45 units / 150 days = 0.3/day; 100 - 0.3*10 = 97.0
    const p = { stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 10, supplierLeadTimeDays: null, movements: slow, now };
    expect(projectedStockAtLeadTime(p)).toBe(97);
  });
});

describe('needsReplenishment', () => {
  it('is true immediately when stock is at or below the reorder point', () => {
    const p = { stock: 5, reorderPoint: 10, reorderQty: 25, leadTimeDays: 7, supplierLeadTimeDays: null, movements: [], now: NOW };
    expect(needsReplenishment(p)).toBe(true);
  });

  it('is true when the lead-time projection dips below the reorder point', () => {
    const twoPerDay: MovementRecord[] = [];
    for (let d = 1; d <= 150; d += 1) twoPerDay.push(sale(d, 2, NOW));
    const p = { stock: 15, reorderPoint: 10, reorderQty: 25, leadTimeDays: 10, supplierLeadTimeDays: null, movements: twoPerDay, now: NOW };
    expect(needsReplenishment(p)).toBe(true); // projected 15 - 20 = -5 < 10
  });

  it('is false for a healthy position', () => {
    const p = { stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 7, supplierLeadTimeDays: null, movements: [], now: NOW };
    expect(needsReplenishment(p)).toBe(false); // no sales => projected = stock
  });
});

describe('forecastDemand', () => {
  const twoPerDay: MovementRecord[] = [];
  for (let d = 1; d <= 150; d += 1) twoPerDay.push(sale(d, 2, NOW));

  it('produces 30 daily points with the ±25% confidence band', () => {
    const points = forecastDemand({ stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 5, supplierLeadTimeDays: null, movements: twoPerDay, now: NOW });
    expect(points).toHaveLength(30);
    expect(points[0]).toMatchObject({ demand: 2, lower: 1.5, upper: 2.5 });
    expect(points[29]).toMatchObject({ demand: 60, lower: 45, upper: 75 });
  });

  it('advances one calendar day per point', () => {
    const points = forecastDemand({ stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 5, supplierLeadTimeDays: null, movements: twoPerDay, now: NOW });
    const day = 24 * 60 * 60 * 1000;
    for (let i = 1; i < points.length; i += 1) {
      expect(Date.parse(points[i]!.date) - Date.parse(points[i - 1]!.date)).toBe(day);
    }
    const expectedFirst = new Date(NOW.getTime() + day).toISOString().slice(0, 10);
    expect(points[0]!.date).toBe(expectedFirst);
  });

  it('zero velocity forecasts flat zero demand', () => {
    const points = forecastDemand({ stock: 100, reorderPoint: 10, reorderQty: 25, leadTimeDays: 5, supplierLeadTimeDays: null, movements: [], now: NOW });
    expect(points).toHaveLength(30);
    expect(points.every((pt) => pt.demand === 0 && pt.lower === 0 && pt.upper === 0)).toBe(true);
  });
});

describe('analyzeProduct (composed snapshot)', () => {
  it('derives every field from the ledger and policy in one call', () => {
    // Even 2/day over a mature window: velocity 2.0, deltas 0, cover 50.
    const movements: MovementRecord[] = [];
    for (let d = 1; d <= 150; d += 1) movements.push(sale(d, 2, NOW));
    const snapshot = analyzeProduct({
      stock: 100,
      reorderPoint: 10,
      reorderQty: 25,
      leadTimeDays: 5,
      supplierLeadTimeDays: 7,
      movements,
      now: NOW,
    });
    expect(snapshot.velocityPerDay).toBe(2);
    // velocityDelta is time-based (<= 30d) => 60 vs 60 = 0; salesDelta30d is
    // day-bucketed (recent = day offsets 0..29) => 58 vs 60 = -2. The two
    // window semantics are intentionally different (reference parity).
    expect(snapshot.velocityDelta).toBe(0);
    expect(snapshot.salesDelta30d).toBe(-2);
    expect(snapshot.totalSales).toBe(300);
    expect(snapshot.daysOfCover).toBe(50);
    expect(snapshot.stockGap).toBe(90);
    expect(snapshot.forecast).toHaveLength(30);
    expect(snapshot.forecast[29]!.demand).toBe(60);
  });
});

describe('buildLedgerDaySeries (90-day chart data)', () => {
  it('walks the ledger backwards day-by-day on a cost basis', () => {
    const movements: MovementRecord[] = [
      restock(5, 10, NOW),
      sale(4, 1, NOW),
      sale(3, 1, NOW),
      sale(2, 1, NOW),
    ];
    const series = buildLedgerDaySeries([{ costMinor: 1000, movements }], 7, NOW);
    // daily stock walking back from 7: [7,7,7,8,9,10,0] -> oldest-first series
    expect(series.map((p) => p.valueMinor)).toEqual([0, 10000, 9000, 8000, 7000, 7000, 7000]);
  });

  it('aggregates multiple products and ignores movement-free products', () => {
    const movements: MovementRecord[] = [restock(1, 4, NOW), sale(1, 1, NOW)];
    const series = buildLedgerDaySeries(
      [
        { costMinor: 1000, movements },
        { costMinor: 2000, movements: [] },
      ],
      3,
      NOW,
    );
    // Product A: current stock 3; day values are END-of-day stock, so the
    // restock+sale day (yesterday) closes at 3 and the day before is 0.
    expect(series.map((p) => p.valueMinor)).toEqual([0, 3000, 3000]);
  });

  it('emits one ISO date per day ending today', () => {
    const series = buildLedgerDaySeries([{ costMinor: 100, movements: [] }], 5, NOW);
    expect(series).toHaveLength(5);
    const startOfToday = new Date(NOW);
    startOfToday.setHours(0, 0, 0, 0);
    expect(series[4]!.date).toBe(startOfToday.toISOString().slice(0, 10));
    const day = 24 * 60 * 60 * 1000;
    for (let i = 1; i < series.length; i += 1) {
      expect(Date.parse(series[i]!.date) - Date.parse(series[i - 1]!.date)).toBe(day);
    }
  });
});
