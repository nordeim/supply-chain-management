import { expect, test } from '@playwright/test';

/**
 * Products & catalog E2E — reference row order (newest first), table values,
 * search filter, and the product detail page layout.
 */
test.describe('Products', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
  });

  test('lists all 6 SKUs in the reference order', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expect(page.getByText('6 Products', { exact: false })).toBeVisible();

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toContainText('ELEC-LENS-003');
    const lastRow = page.locator('tbody tr').last();
    await expect(lastRow).toContainText('ELEC-CAM-001');

    for (const sku of ['ELEC-LENS-003', 'ELEC-LENS-001', 'ELEC-LENS-002', 'ELEC-CAM-003', 'ELEC-CAM-002', 'ELEC-CAM-001']) {
      await expect(page.getByText(sku, { exact: true })).toBeVisible();
    }
  });

  test('shows velocity and supplier columns with reference values', async ({ page }) => {
    await expect(page.getByText('1.5 / day')).toBeVisible();
    await expect(page.getByText('0.8 / day')).toBeVisible();
    await expect(page.getByText('0.0 / day')).toBeVisible();
    await expect(page.getByText('Electronics Direct').first()).toBeVisible();
    await expect(page.getByText('Atlas Logistics')).toBeVisible();
  });

  test('search filters the catalog', async ({ page }) => {
    await page.getByRole('searchbox').fill('50mm');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/q=50mm/);
    await expect(page.getByText('ELEC-LENS-001')).toBeVisible();
    await expect(page.getByText('ELEC-CAM-001')).toHaveCount(0);
  });

  test('opens the product detail page with reference stat tiles', async ({ page }) => {
    await page.getByRole('link', { name: 'Full Frame Sensor Mirrorless Camera' }).click();
    await expect(page).toHaveURL(/\/products\//);

    await expect(page.getByText('Back to Products')).toBeVisible();
    await expect(page.getByText('ELEC-CAM-001')).toBeVisible();
    // Reference money format: one decimal, no grouping.
    await expect(page.getByText('$2320.0')).toBeVisible();
    await expect(page.getByText('$2400.0')).toBeVisible();
    await expect(page.getByText('Stock Level History')).toBeVisible();
    await expect(page.getByText('Demand Forecast (Next 30 Days)')).toBeVisible();
    await expect(page.getByText('Purchase Orders')).toBeVisible();
    // Replenishment policy: reference values for CAM-001 (point 5, qty 5).
    await expect(page.getByText('Reorder Point')).toBeVisible();
  });
});
