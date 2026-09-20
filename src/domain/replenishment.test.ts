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
