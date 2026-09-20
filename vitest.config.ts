import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      // The unit-tested surface is the pure domain layer plus the env
      // contract (both DB- and Next-free). Other lib files (db client,
      // session cookie plumbing) need the Next runtime and are covered by
      // the Playwright E2E suite instead.
      provider: "v8",
      include: ["src/domain/**", "src/lib/env.ts"],
      reporter: ["text"],
      // Regression gate (PAD §10): measured at 97.9/90.9/100/100 before
      // thresholds landed — 95/85/95/95 leaves drift headroom while still
      // catching real coverage regressions.
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 95,
        lines: 95,
      },
    },
  },
});
