import { expect, test } from '@playwright/test';

/**
 * Procurement E2E — 15 orders in the reference row order (orderNumber asc,
 * 2AF134 first), MM.DD.YY dates, and the Order Details slide-over panel
 * with the reference's Approval Date row.
 */
test.describe('Procurement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/purchase-orders');
  });

  test('lists 15 orders with the reference first row (2AF134, Approved)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Procurement' })).toBeVisible();
    await expect(page.getByText('15 orders')).toBeVisible();

    const firstRow = page.getByRole('button', { name: 'Order details for 2AF134' });
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toContainText('#2AF134');
    await expect(firstRow).toContainText('Approved');
    await expect(firstRow).toContainText('$7,000');
    await expect(firstRow).toContainText('50mm f1.8 Prime Lens');
  });

  test('shows reference dates in MM.DD.YY format', async ({ page }) => {
    await expect(page.getByText('07.12.26').first()).toBeVisible();
    await expect(page.getByText('07.06.26').first()).toBeVisible();
  });

  test('status filter narrows the list', async ({ page }) => {
    await page.getByRole('combobox', { name: /filter by status/i }).click();
    await page.getByRole('option', { name: 'Suggested' }).click();
    await expect(page).toHaveURL(/status=Suggested/);
    const rows = page.getByRole('button', { name: /^Order details for/ });
    await expect(rows).toHaveCount(11);
  });

  test('clicking a row opens the Order Details panel with reference fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Order details for 2AF134' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByText('Order Details')).toBeVisible();
    await expect(dialog.getByText('Order #')).toBeVisible();
    await expect(dialog.getByText('#2AF134')).toBeVisible();
    await expect(dialog.getByText('Unit Cost')).toBeVisible();
    await expect(dialog.getByText('$280')).toBeVisible();
    await expect(dialog.getByText('Quantity')).toBeVisible();
    await expect(dialog.getByText('25', { exact: true })).toBeVisible();
    // Reference parity: non-Suggested orders carry an Approval Date row.
    await expect(dialog.getByText('Approval Date')).toBeVisible();

    await dialog.getByRole('button', { name: 'Close order details' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('panel exposes no status transition buttons (reference parity)', async ({ page }) => {
    await page.getByRole('button', { name: 'Order details for 2AF134' }).click();
    await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /deliver/i })).toHaveCount(0);
  });
});
