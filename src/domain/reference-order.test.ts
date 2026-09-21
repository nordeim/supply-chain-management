import { describe, expect, it } from 'vitest';
import {
  MARKET_TREND_ORDER,
  marketTrendRank,
  sortMarketTrends,
  supplierAvgLeadTimeDays,
} from './reference-order';

describe('marketTrendRank', () => {
  it('assigns the reference display order to the six seeded categories', () => {
    // Reference order (live capture): Office, Apparel, Food & Beverage,
    // Household, Electronics, Beauty — reproduced on the market-trends page.
    expect(MARKET_TREND_ORDER).toEqual([
      'Office',
      'Apparel',
      'Food & Beverage',
      'Household',
      'Electronics',
      'Beauty',
    ]);
  });

  it('ranks known categories before unknown ones', () => {
    expect(marketTrendRank('Office')).toBeLessThan(marketTrendRank('Beauty'));
    expect(marketTrendRank('Beauty')).toBeLessThan(marketTrendRank('Zymology'));
    expect(marketTrendRank('Aardvark')).toBe(marketTrendRank('Zymology'));
  });

  it('is stable for unknown categories (equal rank)', () => {
    expect(marketTrendRank('X')).toBe(marketTrendRank('Y'));
  });
});

describe('sortMarketTrends', () => {
  const view = (category: string) => ({ category }) as { category: string };

  it('sorts the six seeded categories into the reference order', () => {
    const input = ['Beauty', 'Electronics', 'Household', 'Food & Beverage', 'Apparel', 'Office'].map(view);
    expect(sortMarketTrends(input).map((t) => t.category)).toEqual([
      'Office',
      'Apparel',
      'Food & Beverage',
      'Household',
      'Electronics',
      'Beauty',
    ]);
  });

  it('keeps unknown categories after known ones without dropping them', () => {
    const input = ['Zymology', 'Office', 'Aardvark'].map(view);
    const sorted = sortMarketTrends(input).map((t) => t.category);
    expect(sorted[0]).toBe('Office');
    expect(sorted.slice(1)).toEqual(expect.arrayContaining(['Zymology', 'Aardvark']));
  });
});

describe('supplierAvgLeadTimeDays', () => {
  it('returns null for a supplier with no products', () => {
    expect(supplierAvgLeadTimeDays([])).toBeNull();
  });

  it('averages the product-level lead times, rounded to whole days', () => {
    // Electronics Direct in the reference: (14 + 14 + 7) / 3 = 11.67 -> 12.
    expect(
      supplierAvgLeadTimeDays([
        { leadTimeDays: 14 },
        { leadTimeDays: 14 },
        { leadTimeDays: 7 },
      ]),
    ).toBe(12);
  });

  it('returns the single product lead time unchanged', () => {
    expect(supplierAvgLeadTimeDays([{ leadTimeDays: 10 }])).toBe(10);
  });
});
