import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config — adapted from scandihaven/apps/web/playwright.config.ts
 * for this single-app supply chain management clone.
 *
 * Requires a pushed+seeded SQLite database (`bun run db:push` + `bun run
 * db:seed`) and a production build (`bun run build`) — `webServer` runs
 * `next start` (not `next dev`) on port 3002 to validate the shipped
 * artifact, mirroring scandihaven's 2026-09-10 audit finding that dev
 * HMR hydration can diverge from prod.
 *
 * Projects: chromium (default gate) and webkit (needs system libs; skip
 * with `npx playwright test --project=chromium` where webkit deps are
 * unavailable).
 *
 * Env:
 *   E2E_PORT     — port for webServer (default 3002)
 *   E2E_BASE_URL — full base URL to reuse an external server (CI: set to reuse)
 *
 * Reporting: `list` (stdout) + HTML (playwright-report/) + JUnit
 * (test-results/junit.xml — parsed by scripts/e2e-summary.ts, which CI
 * appends to $GITHUB_STEP_SUMMARY so failures are visible without log
 * access). The webkit project gets a longer per-test timeout: it runs on
 * hosted CI as an exploratory job and WebKit hydration/clicks are slower
 * there than chromium.
 */
const PORT = Number(process.env.E2E_PORT ?? 3002);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // WebKit is slower in headless automation (hydration, actionability
    // checks), and its CI job runs on shared hosted runners — give the
    // exploratory project more headroom without loosening chromium's gate.
    { name: "webkit", use: { ...devices["Desktop Safari"] }, timeout: 60_000 },
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
