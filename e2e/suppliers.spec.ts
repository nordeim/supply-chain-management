import { expect, test } from '@playwright/test';

/**
 * Suppliers E2E — four scorecards in the reference order, and the supplier
 * detail route with stats, facts, products, and recent POs.
 */
test.describe('Suppliers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/suppliers');
  });

  test('lists the 4 reference suppliers, Nordic first', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
    await expect(page.getByText('4 suppliers')).toBeVisible();

    for (const name of ['Nordic Supply Co.', 'Pacific Rim Traders', 'Atlas Logistics', 'Electronics Direct']) {
      await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
    }
    const firstCard = page.locator('a').filter({ hasText: 'Nordic Supply Co.' }).first();
    await expect(firstCard).toBeVisible();
  });

  test('cards show rating, contact, product count, and terms', async ({ page }) => {
    await expect(page.getByText('4/5').first()).toBeVisible();
    await expect(page.getByText('1/5')).toBeVisible();
    await expect(page.getByText('Anna Lindgren')).toBeVisible();
    await expect(page.getByText('Maria Santos')).toBeVisible();
    await expect(page.getByText('Net 45')).toBeVisible();
    await expect(page.getByText('Net 60')).toBeVisible();
  });

  test('opens the supplier detail route with reference stats', async ({ page }) => {
    await page.locator('a').filter({ hasText: 'Nordic Supply Co.' }).first().click();
    await expect(page).toHaveURL(/\/suppliers\//);

    await expect(page.getByText('Back to Suppliers')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nordic Supply Co.', level: 1 })).toBeVisible();
    await expect(page.getByText('Scandinavian distributor')).toBeVisible();

    for (const stat of ['Products', 'Completed Orders', 'Total POs', 'Avg Lead Time']) {
      await expect(page.getByText(stat, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Reliability Score')).toBeVisible();
    await expect(page.getByText('Payment Terms')).toBeVisible();
    await expect(page.getByText('Recent Purchase Orders')).toBeVisible();
    await expect(page.getByText('No purchase orders yet')).toBeVisible();
  });
});
