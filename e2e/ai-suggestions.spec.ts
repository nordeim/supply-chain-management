import { expect, test } from '@playwright/test';

/**
 * AI Suggestions E2E — 11 pending suggestions, reference row order, costs,
 * delivery dates, and the canonical reasoning sentence.
 */
test.describe('AI Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-suggestions');
  });

  test('shows the 11 pending suggestions with table headers', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AI Suggestions' })).toBeVisible();
    await expect(page.getByText('11 pending suggestions')).toBeVisible();

    for (const header of ['Product', 'Supplier', 'Qty', 'Total Cost', 'Delivery']) {
      await expect(page.getByText(header, { exact: true }).first()).toBeVisible();
    }
  });

  test('first row matches the reference suggestion (CAM-001, $116,000)', async ({ page }) => {
    const firstRow = page.locator('article').first();
    await expect(firstRow).toContainText('Full Frame Sensor Mirrorless Camera');
    await expect(firstRow).toContainText('ELEC-CAM-001');
    await expect(firstRow).toContainText('$116,000');
    await expect(firstRow).toContainText('2026-07-06');
    await expect(firstRow).toContainText('Suggested: 2026-07-06');
  });

  test('rows carry the reference total costs', async ({ page }) => {
    for (const cost of ['$116,000', '$14,000', '$90,000', '$71,000', '$13,000']) {
      await expect(page.getByText(cost).first()).toBeVisible();
    }
  });

  test('expands the AI Reasoning panel with the canonical sentence', async ({ page }) => {
    await page.getByRole('button', { name: /AI Reasoning/ }).first().click();
    await expect(
      page.getByText('Stock is projected to fall below the reorder point before the next replenishment cycle.'),
    ).toBeVisible();
  });

  test('exposes no mutation buttons (reference is informational)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  });
});
