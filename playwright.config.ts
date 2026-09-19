import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config — adapted from scandihaven/apps/web/playwright.config.ts
 * for single-app home-financing (ModFii).
 *
 * Requires a migrated+seeded Postgres (see `npm run db:setup`) and a
 * production build (`npm run build`) — `webServer` runs `next start`
 * (not `next dev`) to validate the shipped artifact, mirroring scandihaven's
 * 2026-09-10 audit finding that dev HMR hydration diverged from prod.
 *
 * Env:
 *   E2E_PORT     — port for webServer (default 3000)
 *   E2E_BASE_URL — full base URL to reuse an external server (CI: set to reuse)
 */
const PORT = Number(process.env.E2E_PORT ?? 3002);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 90_000,
      },
});
