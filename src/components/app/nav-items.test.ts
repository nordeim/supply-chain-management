import { describe, expect, it } from 'vitest';

import { isNavItemActive, NAV_ITEMS } from './nav-items';

/**
 * Pins the nav-active predicate shared by the desktop rail and the mobile
 * bottom pill: exact match for the dashboard, prefix match (with trailing
 * slash) for every other section — the reference app highlights a section
 * while any of its detail routes is open.
 */
describe('isNavItemActive', () => {
  it('activates the dashboard only on the exact root path', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/products', '/')).toBe(false);
    expect(isNavItemActive('/products/abc123', '/')).toBe(false);
  });

  it('activates a section on its exact path', () => {
    expect(isNavItemActive('/products', '/products')).toBe(true);
    expect(isNavItemActive('/ai-suggestions', '/ai-suggestions')).toBe(true);
    expect(isNavItemActive('/purchase-orders', '/purchase-orders')).toBe(true);
    expect(isNavItemActive('/suppliers', '/suppliers')).toBe(true);
    expect(isNavItemActive('/market-trends', '/market-trends')).toBe(true);
  });

  it('activates a section on its detail routes (trailing-slash prefix)', () => {
    expect(isNavItemActive('/products/clx123', '/products')).toBe(true);
    expect(isNavItemActive('/suppliers/clx456', '/suppliers')).toBe(true);
  });

  it('never activates on a mere string prefix without a slash boundary', () => {
    // /procurement-extra must NOT light up the /purchase-orders-style
    // prefixes; only a true path segment boundary counts.
    expect(isNavItemActive('/products-extra', '/products')).toBe(false);
    expect(isNavItemActive('/market-trends-today', '/market-trends')).toBe(false);
  });

  it('deactivates every section on an unknown path', () => {
    expect(isNavItemActive('/settings', '/products')).toBe(false);
    expect(isNavItemActive('/settings', '/')).toBe(false);
  });

  it('exposes the six reference sections in reference order', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/',
      '/products',
      '/ai-suggestions',
      '/purchase-orders',
      '/suppliers',
      '/market-trends',
    ]);
    // Labels are rendered by both navs and asserted by E2E — pin them.
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Dashboard',
      'Products',
      'AI Suggestions',
      'Procurement',
      'Suppliers',
      'Market Trends',
    ]);
  });
});
