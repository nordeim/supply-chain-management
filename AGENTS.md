# AGENTS.md

Instructions for AI coding agents working in this repository. Every line answers: "would you get this wrong without being told?" Verified against the toolchain on 2026-09-20 (v1.2: session guard, coverage gate, hosted CI).

## Commands

Run from the repo root. Bun is the runtime and package manager (never `npm`/`yarn`/`pnpm`).

| Command | What it does |
|---|---|
| `bun install` | Install dependencies |
| `bun run dev` | Dev server on :3000 (Turbopack), logs to `dev.log` |
| `bun run lint` | ESLint 9 flat config — must exit 0 before committing |
| `bun run typecheck` | `tsc --noEmit` — strict mode, must exit 0 |
| `bun run db:push` | Push `prisma/schema.prisma` to SQLite (destructive-tolerant) |
| `bun run db:seed` | Idempotent seed (natural-key upserts). Demo user creds via `SEED_DEMO_EMAIL`/`SEED_DEMO_PASSWORD` env, safe defaults otherwise |
| `bun run verify:analytics` | Checks the seeded ledger reproduces the reference KPIs (velocity 1.5/1.2/0.8/0.7/0.4/0.0, low-stock −1, 11 suggestions, inventory value **$202,610 cost basis**, movers badges +2/−1/0/+1/+2) |
| `bun run test` | Vitest unit suite — 85 tests (`src/domain/*.test.ts` + `src/lib/env.test.ts`), no DB required |
| `bun run test:watch` | Same suite in watch mode |
| `bun run test:coverage` | Same suite with v8 coverage + thresholds (95/85/95/95 over `src/domain/**` + `src/lib/env.ts`) |
| `bun run test:e2e` | Playwright E2E — 31 chromium tests in `e2e/` against `next start` on :3002 (needs `bun run build` first; override with `E2E_PORT`/`E2E_BASE_URL`). Webkit project is configured but needs system libs |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Serve the standalone production build on :3000 |

Order for a clean check: `bun run lint && bun run typecheck && bun run test` (no DB needed). CI (`.github/workflows/ci.yml`) runs the same gate plus coverage, seed, analytics, build, and chromium E2E on every push/PR to main. With a database: `db:push → db:seed → verify:analytics` before feature work so the demo state is present. Before shipping UI changes: `bun run build && bun run test:e2e`. Re-running `db:seed` resets the 15 seeded purchase orders but never deletes ledger movements or user-created rows.

## Architecture invariants

- **Single-app App Router.** All routes live under `src/app/`. There is no monorepo, no `apps/` workspace. The reference design (scandihaven-style monorepo) was deliberately collapsed into one deployable.
- **Layer direction is enforced:** `src/app/*` (pages/components) → `src/server/*` (queries + actions) → `src/domain/*` (pure logic) → `src/lib/db.ts` (Prisma). The domain layer imports NOTHING from app/server/lib — it is pure and unit-testable without a database.
- **Mutations go through Server Actions only** (`src/server/actions.ts`). There are no REST endpoints for UI mutations; the only route handlers are `/api/health` and `/api/suppliers` (dialog data). Every action returns `ActionResult<T>` (`src/domain/result.ts`) — never throw across the action boundary. Failure codes include `UNAUTHENTICATED` (see the session guard below).
- **Money is integer minor units (cents), always.** `src/domain/money.ts` is the only formatting/parsing seam. Floats never touch money; `priceMinor < costMinor` is rejected at the action layer.
- **Velocity, forecasts, and KPIs are DERIVED, never stored.** The movement ledger (`StockMovement`) is the source of truth; `src/domain/replenishment.ts` computes everything from it. Do not add denormalized analytics columns to `Product` — regenerate from the ledger instead.
- **Analytics rule:** velocity = sales in the window `min(150, days since first sale)` / that window. The capped-since-first-sale rule is what reproduces the reference velocities (225 sales/150d = 1.5, 110/137 = 0.8) — do not "simplify" it to a bare 150-day average.
- **AI suggestion reasoning: reference-parity split.** The reference app renders ONE static sentence for every suggestion on its list — the clone reproduces that with `REFERENCE_AI_REASONING` (exported from `src/domain/replenishment.ts`) on the AI Suggestions surface. `buildAiReasoning()` (four truth branches, composed from real numbers) remains the engine for programmatically generated suggestions. Do not hardcode reasoning strings outside these two seams.
- **The reference UI is read-only.** AI Suggestions rows and the Procurement Order Details panel expose NO mutation buttons — keep it that way. The stock feed's Order/Review buttons deep-link to `/products/:id`. Mutations exist only in the server action layer (kept for programmatic use and unit-tested) plus the UI surfaces the reference actually has: New Product dialog and sign-in/up/out.
- **Admin actions require a session (ADR-008).** `approveSuggestionAction`, `dismissSuggestionAction`, `updateOrderStatusAction`, and `generateSuggestionsAction` refuse anonymous callers via `requireSignedIn()` (`src/domain/guard.ts`) with an `UNAUTHENTICATED` result. The reference-parity open surfaces (reads, `createProductAction`, auth) must stay open — the live reference serves the New Product form to anonymous visitors.

## Framework quirks (verified the hard way)

- **Next.js 16:** `params` and `searchParams` in pages are Promises — always `await` them (see any page file). `cookies()` is async too. Page files may export ONLY `default`, `metadata`/`generateMetadata`, `revalidate`, `dynamic` — a stray named export fails the build (the `OrderStatusBadge` component lives in `src/components/app/` for exactly this reason).
- **Root layout reads cookies** (`getSessionUser`), so every route is effectively dynamic; pages additionally declare `export const dynamic = 'force-dynamic'` to be explicit and future-proof.
- **Tailwind v4 CSS-first config:** brand tokens live in `:root` inside `src/app/globals.css` and are mapped through `@theme inline`. The Session 2 parity audit extracted the reference palette: orange `#FF9000` primary, `#EFEFEF` app background, `#DFDFDF` inactive pills, `#F13A15` destructive, black `#111111` KPI tile, dark-navy `#0F1729` on-orange text, white cards at `32px` radius. There is no `tailwind.config.js`. New semantic colors must be added to BOTH the `:root` block and the `@theme inline` mapping (`--success` shows the pattern).
- **Prisma SQLite URL resolution:** relative `file:` paths resolve against `prisma/schema.prisma`, not the repo root or CWD. The documented default `file:../db/custom.db` lands at `<repo>/db/custom.db` — keep that shape in `.env.example` and docs.
- **`recharts` typing:** `stroke` wants a string; `stroke={false}` is a type error in this version. Use `stroke="none"`.
- **TDD for domain changes:** new/changed behavior in `src/domain/*` gets a failing test first (`*.test.ts` colocated), then the implementation, then `bun run test`. E2E specs in `e2e/` run against the production build, not dev — dev HMR hydration can diverge from prod (scandihaven audit finding).
- **Stock-feed product images** live in `public/products/` (SVG per SKU, `elec-*.svg`). Products created through the dialog default to a placeholder image path — keep the naming scheme if you add more.
- **zod v4:** `.default()` inside an object schema makes the input field optional and the output required — the `CreateProductInput` type alias documents the correct `z.infer` usage (an `interface extends z.infer<…> {}` is an ESLint error).
- **ESLint tsconfig excludes:** `examples/`, `tests/`, and `skills/` are excluded from typecheck because they are scaffold material, not product code. Do not "fix" their type errors; leave the exclusions.

## Conventions that differ from defaults

- **ActionResult union, not exceptions:** UI renders `result.message` verbatim on failure; operator detail goes to `console.error`/`console.info` server-side only (`[action]` prefix).
- **Status transitions are a matrix, not a free string:** `allowedStatusTransitions` in `actions.ts`. Suggested → Approved/Cancelled; Approved → Delivered/Cancelled; Delivered/Cancelled are terminal. `Delivered` performs stock increment + ledger `restock` entry in the same action. (Note: no UI surface invokes these post-parity — they are programmatic/admin paths.)
- **Sessions:** HMAC-signed cookie (`scm_session`), value `userId.expiry.hmac(secret)`. Password hashes are `scrypt:salt:hex`. No auth library — verify the shape in `src/lib/session.ts` before adding auth features.
- **Order numbers are hex counters:** `nextOrderNumber()` parses the current max (e.g. `2AF142`) as hex and increments — keep the `2AF` prefix scheme.
- **Seed idempotency contract:** upsert by natural keys (`sku`, supplier `name`, `orderNumber`, `category`, user `email`). Ledger movements are created only when a product has none. The ledger builder (`buildLedger`) self-balances and THROWS on impossible specs — if you change seeded stock/sales numbers, run `bun run db:seed` and read the error, don't guess.
- **All routes are public-readable (like the reference app); sign-in only personalizes the header.** Do not add auth gates to pages without coordinating — the demo flow depends on anonymous access.
- **No `any`.** Strict TS with `@/*` path alias to `./src/*`.

## Environment

`.env.example` documents every variable. Only `DATABASE_URL` is required; `SESSION_SECRET` must be a strong random value in production — session HMAC signing reads it through the memoized `getServerEnv()` seam (`src/lib/env.ts`), so a production process with the missing/placeholder secret fails on first session use; seed credentials default to `demo@supplychain.local` / `demo-password`. Add new variables in `src/lib/env.ts` (fail-fast with actionable messages), never read `process.env` ad hoc in components.

## Reference

- `Project_Architecture_Document.md` — the full blueprint (ADRs, layer model, data architecture, security posture).
- `CLAUDE.md` — the agent operating contract (six-phase workflow, standards).
- `README.md` — human onboarding (setup, verification, feature tour).
- `docs/screenshots/` — verified dev-server captures of every page.
