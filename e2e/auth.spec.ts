import { expect, test } from '@playwright/test';

/**
 * Auth E2E — the sign-in dialog structure (reference parity) and a full
 * sign-in / sign-out round-trip with the seeded demo account.
 */
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL?.trim() || 'demo@supplychain.local';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD?.trim() || 'demo-password';

test.describe('Authentication', () => {
  test('sign-in dialog matches the reference structure', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Welcome to Supply Chain Management app')).toBeVisible();
    await expect(page.getByText('Sign in to continue')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Need an account? Sign up' })).toBeVisible();
  });

  test('signs in with the demo account and signs out', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('button', { name: /Sign Out/ })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Sign Out/ }).click();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('rejects wrong credentials with the reference vague message', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText('Invalid email or password').first()).toBeVisible({ timeout: 15_000 });
  });
});
