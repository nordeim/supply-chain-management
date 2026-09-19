/**
 * Replenishment & forecasting engine — pure functions, no I/O.
 *
 * This module is the analytical heart of the app: everything the dashboard
 * KPIs, the AI Suggestions page, and the product forecasts render is derived
 * here from the movement ledger. Keeping it pure means it is unit-testable
 * without a database and deterministic for a given ledger.
 *
 * Business rules (mirroring the reference application):
 * - Velocity = units sold in the trailing VELOCITY_WINDOW_DAYS, averaged
 *   per day (e.g. 225 sales / 150 days = 1.5/day).
 * - Low-stock score = the deepest shortfall below reorder point, expressed
 *   in "reorder-point decades": round(min(stock - reorderPoint) / 10),
 *   clamped to [-20, 0]. A product with stock 0 / reorder 10 scores -1.
 * - A product needs replenishment when stock <= reorderPoint OR projected
 *   stock at the end of supplier lead time falls below the reorder point.
 * - Suggested quantity covers lead-time demand plus one review cycle of
 *   safety buffer, rounded up to the next multiple of the reorder quantity.
 */

import type { ForecastPoint, ProductAnalytics } from './types';

export const VELOCITY_WINDOW_DAYS = 150;
export const VELOCITY_PREVIOUS_WINDOW_DAYS = 30;
export const FORECAST_HORIZON_DAYS = 30;
export const LOW_STOCK_SCALE_MIN = -20;
export const LOW_STOCK_SCALE_MAX = 0;

/** One ledger entry: when and how much stock moved (delta < 0 = sale). */
export interface MovementRecord {
  delta: number;
  reason: string;
  occurredAt: Date;
}

/** Product fields the engine reasons over. */
export interface EngineProduct {
  stock: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  supplierLeadTimeDays: number | null;
  movements: MovementRecord[];
  now?: Date;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Units sold (negative deltas with reason 'sale') inside a trailing window. */
export function salesInWindow(
  movements: MovementRecord[],
  windowDays: number,
  now: Date,
): number {
  let sold = 0;
  for (const m of movements) {
    if (m.reason !== 'sale' || m.delta >= 0) continue;
    if (daysBetween(m.occurredAt, now) <= windowDays) {
      sold += -m.delta;
    }
  }
  return sold;
}

/** Lifetime sales units from the ledger. */
export function totalSales(movements: MovementRecord[]): number {
  let sold = 0;
  for (const m of movements) {
    if (m.reason === 'sale' && m.delta < 0) sold += -m.delta;
  }
  return sold;
}

/** Trailing velocity in units/day. The effective window is the time since
 *  the product's first sale, capped at VELOCITY_WINDOW_DAYS — so a product
 *  whose ledger began 120 days ago averages over those 120 days (matching
 *  the reference app's "since launch" rate), while a mature product uses
 *  the full 150-day window. */
export function velocityPerDay(movements: MovementRecord[], now: Date): number {
  const sales = movements.filter((m) => m.reason === 'sale' && m.delta < 0);
  if (sales.length === 0) return 0;
  const firstSaleMs = Math.min(...sales.map((m) => m.occurredAt.getTime()));
  const firstSaleAgeDays = Math.max(1, Math.ceil((now.getTime() - firstSaleMs) / (24 * 60 * 60 * 1000)));
  const effectiveWindow = Math.min(VELOCITY_WINDOW_DAYS, firstSaleAgeDays);
  const inWindow = salesInWindow(movements, effectiveWindow, now);
  return round1(inWindow / effectiveWindow);
}

/** Signed change of velocity vs the previous 30-day window, in units/day. */
export function velocityDelta(movements: MovementRecord[], now: Date): number {
  const current = salesInWindow(movements, VELOCITY_PREVIOUS_WINDOW_DAYS, now) / VELOCITY_PREVIOUS_WINDOW_DAYS;
  const previousFrom = VELOCITY_PREVIOUS_WINDOW_DAYS;
  const previousTo = VELOCITY_PREVIOUS_WINDOW_DAYS * 2;
  let previousSold = 0;
  for (const m of movements) {
    if (m.reason !== 'sale' || m.delta >= 0) continue;
    const age = daysBetween(m.occurredAt, now);
    if (age > previousFrom && age <= previousTo) previousSold += -m.delta;
  }
  const previous = previousSold / VELOCITY_PREVIOUS_WINDOW_DAYS;
  return round1(current - previous);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Days of remaining stock at current velocity; null when nothing is moving. */
export function daysOfCover(stock: number, velocity: number): number | null {
  if (velocity <= 0) return null;
  return round1(stock / velocity);
}

/** Stock projected at the end of the supplier lead time at current velocity. */
export function projectedStockAtLeadTime(product: EngineProduct): number {
  const velocity = velocityPerDay(product.movements, product.now ?? new Date());
  const lead = product.supplierLeadTimeDays ?? product.leadTimeDays;
  return Math.round(product.stock - velocity * lead);
}

/** The dashboard "Low Stock Alerts" score: deepest shortfall in reorder-point
 *  decades, clamped to [-20, 0]. Zero means no product is below its point. */
export function lowStockScore(products: Array<{ stock: number; reorderPoint: number }>): number {
  let deepest = 0;
  for (const p of products) {
    const gap = Math.round((p.stock - p.reorderPoint) / 10);
    if (gap < deepest) deepest = gap;
  }
  return Math.max(LOW_STOCK_SCALE_MIN, deepest);
}

/** Does this product need a replenishment suggestion right now? */
export function needsReplenishment(product: EngineProduct): boolean {
  if (product.stock <= product.reorderPoint) return true;
  return projectedStockAtLeadTime(product) < product.reorderPoint;
}

/** Suggested order quantity: lead-time demand + safety buffer, rounded up
 *  to a multiple of reorderQty, minimum reorderQty. */
export function suggestedOrderQty(product: EngineProduct): number {
  const velocity = velocityPerDay(product.movements, product.now ?? new Date());
  const lead = product.supplierLeadTimeDays ?? product.leadTimeDays;
  const leadTimeDemand = velocity * lead;
  const target = Math.max(product.reorderQty, Math.ceil((leadTimeDemand + product.reorderQty) / product.reorderQty) * product.reorderQty);
  return Math.max(product.reorderQty, target);
}

/** 30-day demand forecast with a conservative/optimistic band (±25%). */
export function forecastDemand(product: EngineProduct): ForecastPoint[] {
  const now = product.now ?? new Date();
  const velocity = velocityPerDay(product.movements, now);
  const points: ForecastPoint[] = [];
  let cumulative = 0;
  for (let day = 1; day <= FORECAST_HORIZON_DAYS; day += 1) {
    cumulative += velocity;
    const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    points.push({
      date: date.toISOString().slice(0, 10),
      demand: Math.round(cumulative * 10) / 10,
      lower: Math.round(cumulative * 0.75 * 10) / 10,
      upper: Math.round(cumulative * 1.25 * 10) / 10,
    });
  }
  return points;
}

/** Full analytic snapshot for one product. */
export function analyzeProduct(product: EngineProduct): ProductAnalytics {
  const now = product.now ?? new Date();
  const velocity = velocityPerDay(product.movements, now);
  return {
    velocityPerDay: velocity,
    velocityDelta: velocityDelta(product.movements, now),
    totalSales: totalSales(product.movements),
    daysOfCover: daysOfCover(product.stock, velocity),
    stockGap: product.stock - product.reorderPoint,
    forecast: forecastDemand(product),
  };
}

/**
 * The AI suggestion reasoning text. Deterministic template generation that
 * mirrors the reference application's phrasing — the engine explains itself
 * from real numbers so the text stays truthful. An LLM provider can be
 * layered on top later through the same seam (see docs).
 */
export function buildAiReasoning(input: {
  productName: string;
  stock: number;
  reorderPoint: number;
  velocityPerDay: number;
  leadTimeDays: number;
  daysOfCover: number | null;
  projectedStock: number;
}): string {
  const parts: string[] = [];
  if (input.stock <= 0) {
    parts.push(
      `${input.productName} is out of stock while still selling ${input.velocityPerDay.toFixed(1)} units/day, so every day without a purchase order loses sales.`,
    );
  } else if (input.stock <= input.reorderPoint) {
    parts.push(
      `Current stock (${input.stock}) is at or below the reorder point (${input.reorderPoint}); at ${input.velocityPerDay.toFixed(1)} units/day the position erodes before the next replenishment cycle.`,
    );
  } else if (input.projectedStock < input.reorderPoint) {
    parts.push(
      `Projected stock at the end of the ${input.leadTimeDays}-day supplier lead time (${input.projectedStock}) falls below the reorder point (${input.reorderPoint}) at current velocity.`,
    );
  } else {
    parts.push(
      `Stock (${input.stock}) is above the reorder point (${input.reorderPoint}), but at ${input.velocityPerDay.toFixed(1)} units/day the lead-time demand keeps this SKU close to its trigger; the suggestion maintains a safety buffer.`,
    );
  }
  if (input.daysOfCover !== null) {
    parts.push(
      `Days of cover: ${input.daysOfCover.toFixed(1)} vs a ${input.leadTimeDays}-day lead time — ordering now accounts for supplier lead time and maintains a safety buffer.`,
    );
  } else {
    parts.push(
      `Ordering now accounts for the ${input.leadTimeDays}-day supplier lead time and maintains a safety buffer before the position turns critical.`,
    );
  }
  return parts.join(' ');
}

/** Expected delivery date for an order placed today (ISO yyyy-mm-dd). */
export function expectedDeliveryDate(leadTimeDays: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() + leadTimeDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Daily stock series for one product, derived by replaying its ledger
 *  backwards from today's stock (recent last). Used for the product-detail
 *  "Stock Level History" chart. */
export function buildStockHistory(
  movements: MovementRecord[],
  days: number,
  currentStock: number,
  now: Date,
): Array<{ date: string; stock: number }> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  // Bucket movements by day offset from today (0 = today).
  const deltasByDay = new Map<number, number>();
  for (const m of movements) {
    const dayOffset = Math.floor(
      (startOfToday.getTime() - new Date(m.occurredAt).setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000),
    );
    deltasByDay.set(dayOffset, (deltasByDay.get(dayOffset) ?? 0) + m.delta);
  }
  // Walk backwards from current stock at day 0.
  const series: Array<{ date: string; stock: number }> = [];
  let stock = currentStock;
  for (let day = 0; day < days; day += 1) {
    const date = new Date(startOfToday.getTime() - day * 24 * 60 * 60 * 1000);
    series.push({ date: date.toISOString().slice(0, 10), stock });
    stock -= deltasByDay.get(day) ?? 0; // undo this day's delta to get yesterday's close
  }
  return series.reverse();
}

/** Daily inventory-value series (integer cents) for the whole catalog,
 *  computed by replaying every product's ledger backwards from current
 *  stock — one series point per day, most recent last. */
export function buildLedgerDaySeries(
  products: Array<{ costMinor: number; movements: MovementRecord[] }>,
  days: number,
  now: Date,
): Array<{ date: string; valueMinor: number }> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  // Per-product daily stock (walking backwards from current stock).
  const perProductDaily: number[][] = products.map((p) => {
    const deltasByDay = new Map<number, number>();
    let currentStock = 0;
    for (const m of p.movements) {
      currentStock += m.delta;
      const dayOffset = Math.floor(
        (startOfToday.getTime() - new Date(m.occurredAt).setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000),
      );
      deltasByDay.set(dayOffset, (deltasByDay.get(dayOffset) ?? 0) + m.delta);
    }
    const daily: number[] = [];
    let stock = currentStock;
    for (let day = 0; day < days; day += 1) {
      daily.push(stock);
      stock -= deltasByDay.get(day) ?? 0;
    }
    return daily; // index 0 = today, walking back
  });

  const series: Array<{ date: string; valueMinor: number }> = [];
  for (let day = days - 1; day >= 0; day -= 1) {
    const date = new Date(startOfToday.getTime() - day * 24 * 60 * 60 * 1000);
    let value = 0;
    for (let i = 0; i < products.length; i += 1) {
      value += (perProductDaily[i]?.[day] ?? 0) * products[i]!.costMinor;
    }
    series.push({ date: date.toISOString().slice(0, 10), valueMinor: value });
  }
  return series;
}

/** Human-readable date for tables: "07.12.26". */
export function formatTableDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(2);
  return `${mm}.${dd}.${yy}`;
}
