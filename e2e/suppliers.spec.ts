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
    // Reference shows the notes both in the hero card (gray) and the facts
    // grid (black) — the locator must be scoped to exactly one of them.
    await expect(page.locator('section[aria-label="Nordic Supply Co."]').getByText('Scandinavian distributor')).toBeVisible();
    await expect(page.getByText('Scandinavian distributor').nth(1)).toBeVisible();

    for (const stat of ['Products', 'Completed Orders', 'Total POs', 'Avg Lead Time']) {
      await expect(page.getByText(stat, { exact: true }).first()).toBeVisible();
    }
    // Nordic has exactly one product (CAM-003, lead 14 days): the reference
    // derives Avg Lead Time from the products, not the supplier's own figure.
    await expect(page.getByText('14 days')).toBeVisible();
    await expect(page.getByText('Reliability Score')).toBeVisible();
    await expect(page.getByText('Payment Terms')).toBeVisible();
    await expect(page.getByText('Recent Purchase Orders')).toBeVisible();
    // Every seeded PO is booked against Electronics Direct, so Nordic's
    // recent-orders list stays empty in the reference dataset.
    await expect(page.getByText('No purchase orders yet')).toBeVisible();
  });
});
