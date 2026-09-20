import { describe, expect, it } from 'vitest';
import {
  formatMoneyPlain,
  formatMoneyWhole,
  lineTotalMinor,
  parseMoneyToMinor,
} from './money';

describe('formatMoneyWhole', () => {
  it('formats whole dollars with grouping: 20261000 -> $202,610', () => {
    expect(formatMoneyWhole(20261000)).toBe('$202,610');
  });

  it('renders the reference KPI values exactly', () => {
    expect(formatMoneyWhole(13536000)).toBe('$135,360');
    expect(formatMoneyWhole(0)).toBe('$0');
  });

  it('keeps a minus sign for negative amounts', () => {
    expect(formatMoneyWhole(-1400)).toBe('-$14');
  });
});

describe('formatMoneyPlain (reference product-detail tile format)', () => {
  it('formats 232000 as "$2320.0" — one decimal, no grouping (reference parity)', () => {
    expect(formatMoneyPlain(232000)).toBe('$2320.0');
  });

  it('formats 240000 as "$2400.0"', () => {
    expect(formatMoneyPlain(240000)).toBe('$2400.0');
  });

  it('formats 258000 as "$2580.0"', () => {
    expect(formatMoneyPlain(258000)).toBe('$2580.0');
  });

  it('keeps a single decimal even for whole dollars: 34900 -> "$349.0"', () => {
    expect(formatMoneyPlain(34900)).toBe('$349.0');
  });

  it('handles negative amounts', () => {
    expect(formatMoneyPlain(-162000)).toBe('-$1620.0');
  });
});

describe('parseMoneyToMinor', () => {
  it('parses plain dollars: "2400" -> 240000', () => {
    expect(parseMoneyToMinor('2400')).toBe(240000);
  });

  it('parses decimals: "2320.50" -> 232050', () => {
    expect(parseMoneyToMinor('2320.50')).toBe(232050);
  });

  it('rejects garbage', () => {
    expect(parseMoneyToMinor('abc')).toBeNull();
    expect(parseMoneyToMinor('-5')).toBeNull();
    expect(parseMoneyToMinor('')).toBeNull();
    expect(parseMoneyToMinor('1.234')).toBeNull();
  });
});

describe('lineTotalMinor', () => {
  it('reference PO math: 50 units at 2320.00 = $116,000 (11600000 minor)', () => {
    expect(lineTotalMinor(232000, 50)).toBe(11600000);
  });

  it('25 units at 280.00 = $7,000', () => {
    expect(lineTotalMinor(28000, 25)).toBe(700000);
  });
});
