/**
 * Reference-order rules — the live reference app renders its demo data in a
 * fixed display order that is not derivable from any sortable column (the
 * Base44 demo list is stored in its own insertion order). These pure helpers
 * reproduce the observed order so the seeded demo renders identically.
 */

/** The reference's market-trends card order (live capture). */
export const MARKET_TREND_ORDER = [
  'Office',
  'Apparel',
  'Food & Beverage',
  'Household',
  'Electronics',
  'Beauty',
] as const;

/** Rank of a category in {@link MARKET_TREND_ORDER}; unknown categories rank last (equal). */
export function marketTrendRank(category: string): number {
  const index = MARKET_TREND_ORDER.indexOf(category as (typeof MARKET_TREND_ORDER)[number]);
  return index === -1 ? MARKET_TREND_ORDER.length : index;
}

/**
 * Sort trend views into the reference's display order. Unknown categories keep
 * their relative input order after all known ones (stable sort).
 */
export function sortMarketTrends<T extends { category: string }>(trends: readonly T[]): T[] {
  return [...trends].sort((a, b) => marketTrendRank(a.category) - marketTrendRank(b.category));
}

/**
 * Average lead time across a supplier's products, rounded to whole days —
 * the "Avg Lead Time" stat shown on the reference's supplier detail page
 * (e.g. Electronics Direct: (14 + 14 + 7) / 3 → 12).
 */
export function supplierAvgLeadTimeDays(
  products: ReadonlyArray<{ leadTimeDays: number }>,
): number | null {
  if (products.length === 0) return null;
  const total = products.reduce((sum, p) => sum + p.leadTimeDays, 0);
  return Math.round(total / products.length);
}
