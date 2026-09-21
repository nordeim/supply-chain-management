import { existsSync } from "node:fs";
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

// `next start` boots with NODE_ENV=production, where the env contract
// (src/lib/env.ts) refuses an empty SESSION_SECRET — the sign-in round-trip
// would 500 before any cookie is signed. CI sets SESSION_SECRET at the job
// level (.github/workflows/ci.yml); this fallback keeps bare local runs of
// `bun run test:e2e` self-contained. It is NOT a deployment secret.
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || 'e2e-local-not-a-deployment-secret';

// A workspace-level .env can leak a stale DATABASE_URL into the shell
// (the sandbox-env class documented in AGENTS.md "Prisma SQLite URL
// resolution"): the webServer inherits it, `next start` resolves it
// absolutely, finds no file, and the boot dies before serving. Strip the
// inherited value ONLY when it is an absolute `file:` URL pointing at a
// missing file — the repo `.env` then governs and db-path anchors it at
// <repo>/db/custom.db. An exported URL that exists, a relative one, or a
// non-file: (PostgreSQL) URL still wins, preserving the standard
// precedence rule for intentional overrides.
const leakedDbUrl = process.env.DATABASE_URL ?? "";
const stripLeakedDbUrl =
  leakedDbUrl.startsWith("file:/") && !existsSync(leakedDbUrl.slice("file:".length))
    ? "env -u DATABASE_URL"
    : "";

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
        command: `${stripLeakedDbUrl} SESSION_SECRET='${SESSION_SECRET}' npx next start --port ${PORT}`.trim(),
        url: baseURL,
        reuseExistingServer: true,
        timeout: 90_000,
      },
});
