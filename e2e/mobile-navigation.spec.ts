import { devices, expect, test } from '@playwright/test';

/**
 * Mobile navigation E2E — pins the reference app's floating bottom pill
 * (computed-style audit, session 9): visible only below `lg`, frosted
 * container (42px, radius 100px, rgba(255,255,255,0.1) + 20px blur), a
 * white 48px active pill carrying the section label, and 34px #DFDFDF
 * icon circles for the inactive sections. The desktop rail and the
 * header's New Product button are their `lg`/`md` counterparts.
 *
 * The whole file runs at the iPhone 14 viewport (390x844, touch) via
 * test.use — it executes under every project (chromium, webkit) so the
 * mobile-Safari path is covered by the webkit job on hosted CI. The
 * device's defaultBrowserType is dropped so each project keeps its own
 * engine (the descriptor defaults to webkit, which would hijack the
 * chromium project into launching a webkit binary it may not have).
 */
const { defaultBrowserType: _engine, ...iPhoneViewport } = devices['iPhone 14'];
test.use(iPhoneViewport);

test.describe('Mobile navigation', () => {
  test('renders the bottom pill with Dashboard active on the dashboard', async ({ page }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(nav).toBeVisible();

    // Active section: white pill with the 14px icon + label.
    const active = nav.getByRole('link', { name: 'Dashboard' });
    await expect(active).toBeVisible();
    await expect(active).toHaveAttribute('aria-current', 'page');
    await expect(active.getByText('Dashboard', { exact: true })).toBeVisible();

    // Inactive sections render as icon-only circles.
    for (const label of ['Products', 'AI Suggestions', 'Procurement', 'Suppliers', 'Market Trends']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });

  test('tapping an inactive circle navigates and moves the active pill', async ({ page }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    // Hydration-race discipline (AGENTS.md): wrap interact→assert in
    // toPass — actions don't retry and the pill is a client island.
    await expect(async () => {
      await nav.getByRole('link', { name: 'Products', exact: true }).tap();
      await expect(page).toHaveURL(/\/products$/);
    }).toPass({ timeout: 20_000 });

    const productsPill = nav.getByRole('link', { name: 'Products' });
    await expect(productsPill).toHaveAttribute('aria-current', 'page');
    await expect(productsPill.getByText('Products', { exact: true })).toBeVisible();
    // Dashboard collapses back to an icon circle (no label).
    await expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('marks the section active on a detail route and on direct loads', async ({ page }) => {
    await page.goto('/suppliers');
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(nav.getByRole('link', { name: 'Suppliers' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goto('/purchase-orders');
    await expect(nav.getByRole('link', { name: 'Procurement' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('hides the desktop rail, New Product, and keeps the header pills at 390px', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'New Product' })).toBeHidden();

    // The reference keeps both brand pills on mobile (SupplyChain black,
    // Inventory Manager orange — the label wraps on narrow screens).
    await expect(page.getByRole('link', { name: 'SupplyChain' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Inventory Manager', exact: true }),
    ).toBeVisible();
  });

  test('never overflows the viewport horizontally on any route', async ({ page }) => {
    for (const path of ['/', '/products', '/ai-suggestions', '/purchase-orders', '/suppliers', '/market-trends']) {
      await page.goto(path);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} overflows at 390px`).toBeLessThanOrEqual(390);
    }
  });

  test('the bottom pill is fixed at the viewport bottom with the frosted container', async ({
    page,
  }) => {
    await page.goto('/');

    const pill = page.getByRole('navigation', { name: 'Mobile navigation' }).locator('div').first();
    const box = await pill.boundingBox();
    expect(box).not.toBeNull();
    // 42px tall container, 100px radius, translucent white + blur backdrop.
    expect(Math.round(box!.height)).toBe(42);
    const styles = await pill.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        position: getComputedStyle(el.parentElement!).position,
        radius: cs.borderRadius,
        backdrop: cs.backdropFilter,
        bg: cs.backgroundColor,
      };
    });
    expect(styles.position).toBe('fixed');
    expect(styles.radius).toBe('100px');
    expect(styles.backdrop).toContain('blur');
  });
});

test.describe('Mobile navigation breakpoints (desktop counterpart)', () => {
  test('the rail replaces the bottom pill at lg and New Product appears at md', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Product' })).toBeVisible();

    // md (768px): rail still hidden, bottom pill still shown, New Product back.
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Product' })).toBeVisible();
  });
});
