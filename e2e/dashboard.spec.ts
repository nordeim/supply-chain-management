import { expect, test } from '@playwright/test';

/**
 * Dashboard E2E — verifies the reference app's KPI values, gauge geometry,
 * chart card, movers badges, and the 12-card stock feed against the seeded
 * movement ledger. Reference values: 6 SKUs, low-stock −1, 11 pending POS,
 * $202,610 inventory value.
 */
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the four KPI cards with reference values', async ({ page }) => {
    await expect(page.getByText('Total SKUs', { exact: true })).toBeVisible();
    await expect(page.getByText('Low Stock Alerts', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending POS', { exact: true })).toBeVisible();
    await expect(page.getByText('Inventory Value', { exact: true })).toBeVisible();

    await expect(page.getByText('6', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Low Stock Alerts: -1' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pending POS: 11' })).toBeVisible();
    await expect(page.getByText('$202,610')).toBeVisible();
  });

  test('KPI cards navigate to their reference targets', async ({ page }) => {
    // Total SKUs -> /products
    await page.getByRole('link', { name: 'Total SKUs: 6' }).click();
    await expect(page).toHaveURL(/\/products$/);

    // Pending POS -> /ai-suggestions
    await page.goBack();
    await page.getByRole('link', { name: 'Pending POS: 11' }).click();
    await expect(page).toHaveURL(/\/ai-suggestions$/);
  });

  test('low-stock gauge shows the -20/-10/0 scale with a red marker', async ({ page }) => {
    const card = page.getByRole('link', { name: 'Low Stock Alerts: -1' });
    await expect(card).toBeVisible();
    await expect(card.getByText('-20', { exact: true })).toBeVisible();
    await expect(card.getByText('-10', { exact: true })).toBeVisible();
    await expect(card.getByText('0', { exact: true })).toBeVisible();
    await expect(card.locator('.bg-destructive').last()).toBeVisible();
  });

  test('pending POS gauge renders 0/60 scale labels', async ({ page }) => {
    const card = page.getByRole('link', { name: 'Pending POS: 11' });
    await expect(card).toBeVisible();
    await expect(card.getByText('60', { exact: true })).toBeVisible();
    await expect(card.locator('figure')).toBeVisible();
  });

  test('inventory value chart renders the dot plot with y-axis dollar ticks', async ({ page }) => {
    const chart = page.getByRole('img', { name: /inventory value over the last 90 days/i });
    await expect(chart).toBeVisible();
    await expect(page.getByText('$0k')).toBeVisible();
    await expect(page.getByText('Top 5 Fastest-Moving Products')).toBeVisible();
  });

  test('top movers show the reference badges +2/-1/0/+1/+2', async ({ page }) => {
    await expect(page.getByText('1.5', { exact: true })).toBeVisible();
    await expect(page.getByText('1.2', { exact: true })).toBeVisible();
    for (const badge of ['+2', '-1', '0', '+1']) {
      await expect(page.locator('li').filter({ hasText: 'total sales' }).getByText(badge, { exact: true }).first()).toBeVisible();
    }
    // Velocity values and sales counts
    await expect(page.getByText('225 total sales')).toBeVisible();
    await expect(page.getByText('195 total sales')).toBeVisible();
  });

  test('stock feed renders 12 cards: 1 attention + 11 suggestions', async ({ page }) => {
    await expect(page.getByText('Stock Feed')).toBeVisible();
    const cards = page.locator('article');
    await expect(cards).toHaveCount(12);
    await expect(page.getByText('Out of Stock')).toBeVisible();
    await expect(page.getByText('AI suggests ordering 50 units')).toHaveCount(11);
    // The out-of-stock card links to the product detail page.
    await page.getByRole('link', { name: /^Order/ }).click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.getByText('Back to Products')).toBeVisible();
  });

  test('header shows the Inventory Manager h1 and New Product + Sign In actions', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Inventory Manager' })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Product/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});
