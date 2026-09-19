/**
 * Domain view types — the shapes the UI renders.
 *
 * These are decoupled from Prisma models so the presentation layer never
 * imports the persistence layer's generated types directly, and so pure
 * domain functions (replenishment, forecasting) can be tested without a DB.
 */

export type ProductStatus = 'Active' | 'Discontinued';
export type PurchaseOrderStatus = 'Suggested' | 'Approved' | 'Delivered' | 'Cancelled';
export type TrendDirection = 'Up' | 'Down' | 'Stable';
export type MovementReason = 'sale' | 'restock' | 'adjustment' | 'initial';

/** One point of the 90-day inventory-value series (dashboard chart). */
export interface InventoryValuePoint {
  date: string; // ISO yyyy-mm-dd
  valueMinor: number;
}

/** One point of a product's stock-level history (product detail chart). */
export interface StockHistoryPoint {
  date: string; // ISO yyyy-mm-dd
  stock: number;
}

/** One point of the 30-day demand forecast (product detail chart). */
export interface ForecastPoint {
  date: string; // ISO yyyy-mm-dd
  demand: number; // projected units
  lower: number; // conservative band
  upper: number; // optimistic band
}

/** Analytic snapshot for a single product (all values derived, never stored). */
export interface ProductAnalytics {
  velocityPerDay: number; // trailing window average units/day
  velocityDelta: number; // change vs previous window, units/day (signed)
  totalSales: number; // lifetime sales units from the movement ledger
  daysOfCover: number | null; // stock / velocity; null when velocity is 0
  stockGap: number; // stock - reorderPoint (signed)
  forecast: ForecastPoint[]; // next 30 days
}

export interface SupplierView {
  id: string;
  name: string;
  contactName: string;
  email: string;
  rating: number; // 1..5
  paymentTerms: string;
  leadTimeDays: number;
  productCount: number;
}

export interface MarketTrendView {
  id: string;
  category: string;
  trendScore: number; // 0..100
  changePct: number;
  direction: TrendDirection;
  quarter: string;
  description: string;
  source: string;
}

/** A stock-feed entry: a product at/below reorder point plus its open suggestion. */
export interface StockFeedItem {
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  reorderPoint: number;
  velocityPerDay: number;
  outOfStock: boolean;
  supplierName: string | null;
  supplierLeadTimeDays: number | null;
  suggestionOrderId: string | null;
  suggestedQty: number | null;
  aiReasoning: string | null;
}
