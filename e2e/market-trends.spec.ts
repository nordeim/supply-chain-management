import { expect, test } from '@playwright/test';

/**
 * Market Trends & health E2E — the 6 category cards, summary stats, and the
 * /api/health readiness probe.
 */
test.describe('Market Trends', () => {
  test('renders the 6 reference categories and summary stats', async ({ page }) => {
    await page.goto('/market-trends');

    await expect(page.getByRole('heading', { name: 'Market Trends' })).toBeVisible();
    await expect(page.getByText('6 categories · Q3 2026')).toBeVisible();

    await expect(page.getByText('Avg Trend Score')).toBeVisible();
    await expect(page.getByText('68', { exact: true })).toBeVisible();
    await expect(page.getByText('Rising Categories')).toBeVisible();
    await expect(page.getByText('Top Gainer')).toBeVisible();
    await expect(page.getByText('+19.2%').first()).toBeVisible();

    for (const category of ['Electronics', 'Apparel', 'Food & Beverage', 'Beauty', 'Household', 'Office']) {
      await expect(page.getByRole('heading', { name: category, level: 2 })).toBeVisible();
    }
  });

  test('category cards carry change %, direction, and source', async ({ page }) => {
    await page.goto('/market-trends');
    await expect(page.getByText('IDC Global')).toBeVisible();
    await expect(page.getByText('Euromonitor')).toBeVisible();
    await expect(page.getByText('Gartner')).toBeVisible();
    await expect(page.getByText('-5.7').first()).toBeVisible();
  });
});

test.describe('Health probe', () => {
  test('GET /api/health returns ok with database up', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
  });
});
