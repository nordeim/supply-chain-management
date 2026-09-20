/**
 * Money — integer minor units everywhere (scandihaven invariant).
 *
 * All monetary values are stored and passed as integer cents. Floating-point
 * arithmetic never touches money. Formatting is centralized here so the UI
 * renders one consistent shape ("$202,610", "$2,480.00").
 */

export const MINOR_UNITS_PER_MAJOR = 100;

/** Format integer cents as a compact whole-dollar amount: 202610 -> "$202,610". */
export function formatMoneyWhole(minor: number): string {
  const negative = minor < 0;
  const major = Math.abs(Math.round(minor)) / MINOR_UNITS_PER_MAJOR;
  const formatted = major.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
  return `${negative ? '-' : ''}$${formatted}`;
}

/** Format integer cents with cents when they matter: 258000 -> "$2,580.00". */
export function formatMoney(minor: number): string {
  const negative = minor < 0;
  const major = Math.abs(Math.round(minor)) / MINOR_UNITS_PER_MAJOR;
  const hasFraction = Math.round(minor) % MINOR_UNITS_PER_MAJOR !== 0;
  const formatted = major.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${negative ? '-' : ''}$${formatted}`;
}

/**
 * Format integer cents in the reference app's product-tile shape:
 * one decimal, no digit grouping — 232000 -> "$2320.0", 258000 -> "$2580.0".
 * Matches the reference product-detail Cost/Price tiles exactly.
 */
export function formatMoneyPlain(minor: number): string {
  const negative = minor < 0;
  const major = Math.abs(Math.round(minor)) / MINOR_UNITS_PER_MAJOR;
  const fixed = major.toFixed(1);
  return `${negative ? '-' : ''}$${fixed}`;
}

/** Parse a user-supplied decimal amount ("2480.00") into integer cents.
 *  Returns null when the input is not a valid non-negative money amount. */
export function parseMoneyToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major)) return null;
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

/** Total cost of an order line: integer multiplication only. */
export function lineTotalMinor(unitCostMinor: number, quantity: number): number {
  return unitCostMinor * quantity;
}
