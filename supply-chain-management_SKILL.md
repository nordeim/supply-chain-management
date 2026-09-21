---
name: supply-chain-management
description: >
  Complete engineering skill for the supply-chain-management codebase — a
  production-grade Next.js 16 clone of the Base44 reference app
  (https://supply-chain-management-app.base44.app/). Covers the architecture,
  reference-parity methodology, data contracts, test gates, anti-patterns,
  and every hard-won lesson from ten remediation sessions. Use this skill to
  extend, debug, onboarding onto, or replicate the codebase.
version: 1.0.0
last_updated: 2026-09-21
project_state: PAD v1.7 · 111 unit / 38 E2E tests green · reference parity verified (Session 10)
---

# Supply Chain Management — Engineering Skill

> **How to use this document:** Read §1–§5 before touching any file (identity, stack, architecture). When changing visual surfaces, §4 + §17–§19 are the contract. When a gate fails, go to §10. Before pushing, run §11. Every claim below is verifiable against a specific file or command — paths are exact.

---

## §1 Project Identity & Design Philosophy

**What:** A dashboard-driven inventory-intelligence application — product catalog, AI replenishment suggestions, procurement lifecycle, supplier scorecards, and market trends — cloned to **visual and functional parity** from the live reference app at `https://supply-chain-management-app.base44.app/`.

**Who/why:** A single-deployable Next.js app whose seed data reproduces the reference's demo dataset exactly (velocity 1.5/1.2/0.8/0.7/0.4/0.0 units/day, inventory value $202,610, movers badges +2/−1/0/+1/+2, 11 suggestions, 15 POs, 4 suppliers, 6 trend categories).

**Design thesis:** The reference is the spec. Every visual token (colors, radii, pill geometry, fonts, row heights) was extracted from the live app via computed-style audits, not invented. When the codebase and the live reference disagree, the reference wins — but only after verifying the disagreement is real (see §9's display-artifact lesson).

**Non-negotiable rules:**
1. **No invented design tokens.** Colors/sizes come from live reference measurements (§4, §19). The primary is `#FF9000` (measured `rgb(255,144,0)`), NOT Tailwind's `#F97316`.
2. **Analytics are derived, never stored.** Velocity, coverage, forecasts, inventory value — all computed from the movement ledger by pure functions (`src/domain/replenishment.ts`). Product.stock is the only stored counter.
3. **Money is Int minor units** end-to-end; formatting happens at the display edge (`src/domain/money.ts`).
4. **The domain layer imports nothing** — no React, no Prisma, no Next.js. It is pure TypeScript, unit-testable in-process, <1s suite.
5. **The interaction model is informational** on list surfaces (no Approve/Dismiss buttons in the UI) — exactly like the reference. The mutation layer exists as guarded server actions for programmatic use.
6. **Never weaken a guardrail to go green** (no `ignoreBuildErrors`, no deleted tests, no loosened thresholds — fix the cause).

**Anti-generic mandate:** No default shadcn look, no purple gradients, no drop shadows heavier than `0 1px 2px rgba(0,0,0,0.05)`, no rounded-xl soup — the reference's precise geometry (32px card radius, 22px row radius, black header bars) is the law.

## §2 Tech Stack & Environment

| Layer | Technology | Version | Critical Note |
|---|---|---|---|
| Framework | next | 16.1.3 (^16.1.1) | App Router, Turbopack dev; `output: standalone` build |
| UI runtime | react / react-dom | 19.x | RSC-first; client islands only where interaction demands |
| Styling | tailwindcss | 4.x | **CSS-first config** — no `tailwind.config.js`; tokens in `globals.css` `:root` + `@theme inline` |
| ORM | prisma / @prisma/client | 6.11.1 | SQLite default; schema is PostgreSQL-portable |
| Database | SQLite | file at `<repo>/db/custom.db` | `DATABASE_URL="file:../db/custom.db"` resolves against `prisma/` (see §3) |
| Validation | zod | 4.x | Server-action input validation |
| Charts | recharts | 2.15.x | Stock history line + forecast band |
| Icons | lucide-react | 0.525.x | Nav glyphs are custom inline SVGs (`nav-items.tsx`), not lucide |
| Unit tests | vitest | 5.x | node env, `@` alias, v8 coverage (95/85/95/95 thresholds) |
| E2E | @playwright/test | 1.63.x | Runs against `next start` :3002, NOT dev |
| Language | typescript | 5.x strict | `tsc --noEmit` must exit 0 — build enforces types |
| Lint | eslint | 9.x flat | next config |
| Runtime | bun | ≥1.1 | Install, scripts, seed (`node` also works for scripts) |

**Env vars (3 + 3 optional):**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | SQLite file URL (or PG URL after provider switch) |
| `SESSION_SECRET` | prod | insecure dev placeholder | HMAC secret for session cookies; production REFUSES the default at first session use (`src/lib/env.ts`) |
| `NODE_ENV` | auto | — | Production mode activates the secret check |
| `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` | no | demo@supplychain.local / demo-password | Demo account (also read by auth E2E) |
| `E2E_PORT` / `E2E_BASE_URL` | no | 3002 / — | Playwright webServer overrides |

## §3 Bootstrapping & Configuration

```bash
git clone https://github.com/nordeim/supply-chain-management.git
cd supply-chain-management
bun install
cp .env.example .env          # DATABASE_URL="file:../db/custom.db" — already correct
bun run db:push               # schema → <repo>/db/custom.db
bun run db:seed               # idempotent demo data + self-healing ledger
bun run dev                   # http://localhost:3000
```

**The database-path contract (most-misunderstood piece):**
- A RELATIVE `file:` URL is anchored at `prisma/schema.prisma` by Prisma — so `file:../db/custom.db` = `<repo>/db/custom.db`. This is implemented for the runtime, seed, and analytics verifier by `src/lib/db-path.ts` (module-location walk-up, memoized, never throws), and for the Prisma CLI by `scripts/db-cli.ts` (the `db:push`/`db:migrate`/`db:reset` wrapper that exports the absolute URL).
- An EXPORTED `DATABASE_URL` in the shell wins over `.env` (standard precedence). Sandboxes that leak a workspace-level absolute `DATABASE_URL` will put the file in the wrong place — run DB commands with `env -u DATABASE_URL` (see §9 / §10).

**Config files:** `next.config.ts` (standalone output, types enforced, `devIndicators: false` so the badge never overlaps mobile captures), `tsconfig.json` (strict, `@/*` → `src/*`), `eslint.config.mjs`, `vitest.config.ts` (node env, coverage thresholds), `playwright.config.ts` (chromium + webkit projects, `next start` webServer on 3002 with a local fallback `SESSION_SECRET`), `postcss.config.mjs`.

**Health probe:** `GET /api/health` → `{"status":"ok","database":"up"}` — the readiness endpoint for load balancers and capture scripts.

## §4 The Design System (Code-First)

Tokens live in `src/app/globals.css` — `:root` block (the source) mapped through `@theme inline` (the Tailwind v4 utilities). **Both blocks must be updated together when adding a token** (`--success` shows the pattern).

**Typography (three font roles):**

| Role | Font | Where |
|---|---|---|
| Body | system-ui stack | `--font-sans` — the reference's body is system-ui |
| Branded labels (header pills, nav, buttons, row text) | Inter | `--font-brand` ← `next/font` `--font-inter` |
| Numeric cells (qty, costs, dates, stat values) | Hanken Grotesk 300 | `--font-numeric` ← `next/font` `--font-hanken-grotesk` |

**Core geometry:**

| Token | Value | Usage |
|---|---|---|
| Card radius | 32px (`rounded-[32px]`) | Every white surface |
| List row radius | 22px (`rounded-[22px]`) | Gray pill rows, expander panels |
| Filter/search radius | 40px (`rounded-[40px]`) | Search pills, status chips |
| Nav pill radius | 100px | Mobile container + active pill |
| Card elevation | `0 1px 2px rgba(0,0,0,0.05)` | The ONLY shadow |
| Header height | 50px | Logo circle 50px, pills 50px |
| Black list header bar | 37px, 22px radius | White Inter 14px/400 labels |
| List row heights | Products 56px · AI 78px · Procurement 77px | + 41px AI expander + 21px "Suggested:" note |
| Shell padding | `16px 0 80px` | Header floats at y=16; 80px bottom clearance for the mobile pill |

**The list pattern (v1.7's biggest surface):** ONE white card per tabular page (`src/components/app/list-pattern.tsx`): title (Inter 14px/500) + count INSIDE the card → black `#111111` header bar → `#EFEFEF` pill rows (16px gaps) with 40×40 product images (8px radius), Inter 14px/500 names, Hanken numerals. Below `sm`: AI/Procurement rows become stacked mobile cards (2-col grid, square images, 32px `#DFDFDF` chips); Products hides columns per breakpoint instead.

## §5 Component Architecture & Patterns

**Layer model (imports flow downward only):**

```
src/domain/*        pure logic — ZERO imports (no React/Prisma/Next) — 111-test suite
src/lib/*           framework seams (db, session, env, db-path, utils)
src/server/queries.ts    Prisma reads → plain typed rows (pages never touch Prisma)
src/server/actions.ts    mutations → ActionResult<T> envelope, Zod-validated, guarded
src/app/**/page.tsx      RSC pages — async, force-dynamic, compose queries + components
src/components/app/*     presentational + client islands ('use client' only when needed)
src/components/ui/*      shadcn primitives (48 files, unmodified)
```

**Component census:** 19 app components (12 client: mobile-nav, header-bar, nav-sidebar, suggestion-row, procurement-table, order-details-panel, both filter bars, sign-in/new-product dialogs, stock-feed, order-status-badge is server-safe) + 48 ui primitives.

**Golden patterns:**
- **Query seam:** pages call `listProducts()` / `getSupplierDetail(id)` etc. — never `db.*` directly. PurchaseOrderRow/SuggestionRow interfaces carry `imageUrl` so rows render product photos.
- **ActionResult envelope:** every action returns `ok(data)` / `fail(code, message)`; the client toasts failures; no thrown errors cross the boundary.
- **Session:** `getSessionUser()` in RSC/layout; `requireSignedIn()` guard on the four no-UI admin actions (approve/dismiss/status/generate) — reference-parity surfaces (public reads, New Product, sign-in/up/out) intentionally stay open.
- **URL-driven filters:** search/category/status push query params; `name="q"` inputs give pre-hydration Enter a browser-native GET fallback (the hydration-race fix — §12 L4).

## §6 "Hooks" Deep Dive (the interactive seams)

This codebase has few custom hooks (a React 19 + RSC-first design). The interactive seams to know:

- **`usePathname` nav model** (`src/components/app/nav-items.tsx`): ONE shared item model (items, order, `isNavItemActive`, inline SVG glyphs byte-identical to the reference) drives BOTH the desktop rail and the mobile pill — 6 unit tests pin it. Never fork the two navs.
- **`useTransition` filters:** both filter bars push params inside `startTransition` and set `data-pending` for progressive indication.
- **Expander state:** `SuggestionRow` keeps `open` local — the reference expands rows independently, one at a time per row group.
- **Panel state:** `ProcurementTable` owns `selected: PurchaseOrderRow | null` — the slide-over is pure presentation.

## §7 Data & Seed Architecture

- **Models (6):** User, Supplier, Product, StockMovement, PurchaseOrder, MarketTrend — natural-key upserts make `db:seed` idempotent.
- **The movement ledger is the source of truth for analytics.** `buildLedger()` (in `prisma/seed.ts`) engineers per-SKU histories that land EXACTLY on the reference KPIs: 225 sales/150d = 1.5/day, 50mm exactly out of stock today, badges via cross-window unit moves (`applyRecentDelta`).
- **Dates are two-clock:** PO dates + market-trend quarter pin to `REFERENCE_ANCHOR` (2026-09-20 — the capture day; the reference shows fixed 07.06.26/07.12.26/Q3 2026 dates); the ledger stays `now`-relative because velocity needs live windows. A stale ledger (newest sale not today) is auto-rebuilt by the seed — `db:seed && verify:analytics` is self-healing.
- **Reference display orders are NOT derivable from columns** — they're pinned: suggestions/stock-feed follow PO `createdAt desc` (seed assigns createdDaysAgo for the CAM-002-first order), procurement is `orderNumber asc`, suppliers follow `createdAt` (Nordic→Atlas→Pacific→Electronics), market trends follow the fixed order in `src/domain/reference-order.ts` (Office, Apparel, F&B, Household, Electronics, Beauty).
- **Reference data noise (documented, deliberately not chased):** the reference's supplier-detail dates disagree with its own procurement table; its "Lead Time (Days)" for Electronics Direct reads 0 (display-only there). The clone shows consistent orderDate and the supplier's own figure in the facts grid, while "Avg Lead Time" averages the supplier's PRODUCTS' lead days ((14+14+7)/3 → 12).

## §8 Accessibility Notes

- Radix primitives power dialogs/selects (focus traps, ESC, aria wiring for free).
- Every interactive row/button carries an explicit `aria-label` (e.g. `Order details for 2AF134`, `Open <product name>`, `Suggestion <SKU>` groups) — this is also what makes the E2E specs resilient.
- The mobile nav wrapper is `pointer-events-none` with the pill `pointer-events-auto` — pass-through by design.
- Contrast: `#0F1729` on `#FF9000` (navy-on-orange), `#111` on white, `#343434` muted on white — all AA+; the black KPI tile uses white/orange numerals.
- `prefers-reduced-motion` respected by Radix; motion is subtle (chevron rotates, dialogs fade).

## §9 Anti-Patterns & Common Bugs (from 10 sessions)

| # | Anti-pattern | Symptom | Fix / rule |
|---|---|---|---|
| 1 | Trusting a leaked `DATABASE_URL` | DB file lands outside the repo; health says "up" anyway | Run DB commands with `env -u DATABASE_URL`; let the repo `.env` govern |
| 2 | `wait --load networkidle` against `next dev` | Every wait burns its full 30s timeout (HMR websocket never idles) | Use fixed sleeps or `domcontentloaded` in capture scripts; warm routes with curl first |
| 3 | Cold-compiles + browser automation | `open`/eval time out during 8–11s Turbopack first compiles; screenshots silently miss | curl every route before the browser visits it |
| 4 | "Fixing" display artifacts | `branches: ain]` in ci.yml, `const ode, setMode]` in sources LOOK broken through text layers | `[m` is an ANSI escape being eaten by the display pipeline — verify on-disk bytes (Read tool / char codes) before editing |
| 5 | Storing derived analytics | KPIs drift from the ledger after mutations | Compute at read time from StockMovement (velocity, coverage, forecast, value) |
| 6 | Chasing the reference's data noise | Wasted sessions replicating impossible states (0-day lead times in projections) | Document as "reference noise"; keep the clone internally consistent |
| 7 | `tbody tr` locators in E2E | Whole suites break on layout parity work | Use roles/aria-labels (`Order details for <n>`, `Suggestion <SKU>`) — they survive DOM refactors |
| 8 | Pinning E2E values to clone state instead of reference values | 8 specs fail after every parity fix | Specs pin REFERENCE values (CAM-002/$71,000 first; 2AF134/$280 + Approval Date) |
| 9 | `Secure` cookie on plain HTTP | WebKit/Safari silently drops the session cookie; chromium passes | `secure: await isHttpsRequest()` — follow `x-forwarded-proto`, never `NODE_ENV` |
| 10 | Actions without retry in E2E | `fill`+Enter lands pre-hydration → no-op URL change | Wrap interact→assert in `expect(async () => {...}).toPass()` + `name="q"` implicit-GET fallback |
| 11 | Relative `file:` URLs assumed CWD-relative | DB lands one directory above the repo | `src/lib/db-path.ts` anchors at `prisma/`; `scripts/db-cli.ts` for the CLI |
| 12 | Seed dates relative to seed-day | E2E date assertions fail after UTC midnight | Pin to `REFERENCE_ANCHOR`; rebuild stale ledgers on seed |
| 13 | `next start` E2E without `SESSION_SECRET` | Sign-in 500s before cookie signing in production mode | CI sets it at job level; playwright.config injects a local fallback |
| 14 | Weakened gates (`ignoreBuildErrors`, deleted tests) | Silent regressions | Never — the gate exists because the failure existed |

## §10 Debugging Guide

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid server environment: DATABASE_URL is required` | `.env` missing | `cp .env.example .env` |
| `SESSION_SECRET must be set…` on `next start` | Production boot with empty secret | Set a real secret (`openssl rand -base64 32`) — or the E2E fallback handles local runs |
| DB file at repo parent | Exported `DATABASE_URL` in shell | `env -u DATABASE_URL bun run db:seed` |
| Movers badges drifted (−1/−2 off) | Ledger crossed UTC midnight (day-bucketed 30d windows) | `bun run db:seed && bun run verify:analytics` (self-heal rebuilds the ledger) |
| `verify:analytics` fails after seed edits | Impossible ledger spec | Read the thrown spec name; rebalance restock days/qty in `PRODUCTS[].ledger` |
| Turbopack "internal error" / stale cache | Corrupt `.next` | `rm -rf .next` and restart dev |
| E2E webkit missing binaries locally | Sandbox lacks GTK/GStreamer system libs | `npx playwright test --project=chromium` locally; webkit runs on CI |
| E2E auth round-trip fails locally only | webServer booted without a secret (pre-v1.7 config) | Config now injects the fallback — rebuild if on an old checkout |
| Dashboard KPIs wrong after data edits | Stored stock diverged from ledger | The seed upserts stock AND rebuilds ledgers — re-run it |
| Screenshot script writes nothing | Page still compiling when captured | Warm routes with curl; sleep after `open` (§9 #3) |

## §11 Pre-Ship Checklist

```bash
bun run lint            # 0 errors
bun run typecheck       # 0 errors
env -u DATABASE_URL bun run db:push && bun run db:seed   # DB at <repo>/db/custom.db
env -u DATABASE_URL bun run verify:analytics            # all KPI checks PASS
env -u DATABASE_URL bun run test          # 111/111 unit
env -u DATABASE_URL bun run build         # types enforced
env -u DATABASE_URL bun run test:e2e      # 38/38 chromium
```

Then: CI green on both jobs (chromium + webkit on ubuntu-24.04), all 8 routes render without console errors, mobile nav at 390px has zero horizontal overflow, and — after any visual change — fresh reference-parity verification (§15's methodology) plus updated `docs/screenshots/` captures.

## §12 Lessons Learnt & How to Avoid Them

1. **(L1) The reference is the spec — but verify the disagreement is real.** Session 9 nearly "fixed" a display artifact: `ci.yml` showed `branches: ain]` through every text layer; the on-disk bytes were `[main]`. Rule: verify bytes (Read tool, char codes) before editing anything that looks corrupted.
2. **(L2) Day-bucketed analytics are a time bomb.** The movers badges (30d-vs-prior-30d) drift when a day crosses UTC midnight between seed and test. Fixed by anchoring PO dates to `REFERENCE_ANCHOR` and rebuilding stale ledgers on seed. Rule: any `now`-relative assertion needs a clock contract.
3. **(L3) Playwright actions don't retry; assertions do.** The webkit hydration-race flake was a `fill`+Enter landing pre-hydration. Fixed two-layer (`toPass()` retry + `name="q"` implicit GET). Rule: wrap act→assert units in `toPass()` when the page has a client island.
4. **(L4) `Secure` must follow the transport, not `NODE_ENV`.** WebKit dropped the session cookie on plain-HTTP E2E (even loopback) while chromium passed — a browser-correctness difference, not flake. Rule: `secure: await isHttpsRequest()`.
5. **(L5) Layout parity work must re-pin E2E specs to REFERENCE values.** After the v1.7 list rebuild, 8 specs failed because they pinned pre-remediation clone values. Rule: E2E asserts what the reference shows, never what the clone happened to render.
6. **(L6) Cold compiles break browser automation.** Turbopack's 8–11s first compiles made `open`/eval time out and screenshots silently skip. Rule: warm every route with curl before automating, and never wait on `networkidle` against dev mode (HMR websocket never idles).
7. **(L7) Sandboxes leak environment.** A workspace-level `DATABASE_URL` exported into every shell overrode the repo `.env` — the DB landed in the parent directory while health checks still passed. Rule: `env -u DATABASE_URL` for all DB commands in shared sandboxes.
8. **(L8) One shared model beats parallel copies.** The nav item model drives rail + mobile pill + header from one file; the list pattern drives three pages from one component. Duplication is where parity drifts.

## §13 Pitfalls to Avoid

- **Don't** add a color outside the `:root` + `@theme inline` pair — the utility won't exist.
- **Don't** use `#F97316` for primary — the measured reference orange is `#FF9000`.
- **Don't** import `@/server/queries` or `@/lib/db` from a client component — pages fetch, components render.
- **Don't** store velocity/coverage/forecasts — derive them (`src/domain/replenishment.ts`).
- **Don't** render money with `toFixed` at call sites — `formatMoney*` in `src/domain/money.ts` owns every format (whole / cent / one-decimal reference style `$2320.0`).
- **Don't** add Approve/Dismiss buttons to list surfaces — the reference is informational; the guarded actions exist for programmatic use only.
- **Don't** sort market trends by score or suppliers alphabetically — reference orders are pinned (`src/domain/reference-order.ts`, supplier `createdAt`).
- **Don't** run E2E against `next dev` — hydration and HMR diverge from the shipped artifact; the config boots `next start` on 3002 for that reason.
- **Don't** create branches — all commits go to main; CI runs on push.
- **Don't** edit `skills/` content as part of app fixes — the folder is reference material excluded from checking/testing/compilation.

## §14 Best Practices

- TDD for domain logic: red first (`*.test.ts` colocated), then implement; the suite runs in <1s with no DB.
- Every server action: Zod-validate → guard → domain → `ActionResult`; toast the failure envelope on the client.
- Idempotent seeds via natural keys (sku, orderNumber, name, category, email).
- URL as state for filters (`/products?q=50mm&category=Electronics`) — shareable, SSR-correct.
- `aria-label`s on every interactive row — a11y and E2E resilience in one move.
- Memoized env parsing (`getServerEnv()`) so `next build` never requires a production secret; the first session use enforces it.
- Document display-noise decisions in the PAD rather than "fixing" them silently.

## §15 Coding Patterns (copy-pasteable)

**Reference-parity verification (the core methodology):**

```js
// agent-browser eval against BOTH apps at the same viewport; compare JSON
(() => {
  const pill = document.querySelector('nav[aria-label="Mobile navigation"]').firstElementChild;
  const cs = getComputedStyle(pill);
  const active = document.querySelector('a[aria-current="page"]');
  return JSON.stringify({
    pill: { w: pill.getBoundingClientRect().width, h: pill.getBoundingClientRect().height,
            radius: cs.borderRadius, bg: cs.backgroundColor, blur: cs.backdropFilter },
    active: active ? { w: active.getBoundingClientRect().width, h: active.getBoundingClientRect().height } : null,
    hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  });
})()
// Clone: pill 327×42 / 100px / 0.1-alpha white / blur(20px); active 129×48 white — matches reference exactly.
```

**Query seam (rows with images):**

```ts
// src/server/queries.ts — join what the view needs, return plain rows
const orders = await db.purchaseOrder.findMany({
  where: { AND: [search ? { OR: [...] } : {}, status !== 'All Statuses' ? { status } : {}] },
  include: { product: true, supplier: true },
  orderBy: { orderNumber: 'asc' }, // reference row order
});
return orders.map((o) => ({ ...row, imageUrl: o.product.imageUrl }));
```

**Server action (guard + validate + envelope):**

```ts
export async function approveSuggestionAction(orderId: string): Promise<ActionResult<{ orderNumber: string }>> {
  return toActionResult(async () => {
    const denied = requireSignedIn((await getSessionUser())?.id ?? null);
    if (denied) return denied;
    const id = z.string().min(1).safeParse(orderId);
    if (!id.success) return fail('VALIDATION', 'Order id is required');
    // ... domain rules, update, revalidatePath('/'), ok({ orderNumber })
  });
}
```

## §16 Coding Anti-Patterns

- `'use client'` at the top of a page that only composes server data (client islands go in leaf components).
- `new PrismaClient()` in a component (breaks the layering; also: the seed/scripts must pass `datasourceUrl: resolveDatabaseUrl(...)`).
- `Number(priceMinor) / 100` inline in JSX (use the money formatters).
- `orderBy: { score: 'desc' }` for market trends (breaks the pinned reference order).
- `Math.floor` on dates without anchoring (breaks the REFERENCE_ANCHOR contract).
- Photo-driven pixel diffs as the only parity check (product photography differs by design — verify geometry/styles, then diff).

## §17 Responsive Breakpoint Reference

| Breakpoint | What changes |
|---|---|
| `< sm (640)` | Mobile nav pill + stacked cards everywhere; AI/Procurement rows → 2-col mobile cards (`grid sm:hidden`); Products hides SKU/Category/Reorder/Supplier/Velocity columns progressively; KPI grid: [Total SKUs \| Inventory Value] row + full-width gauges |
| `≥ sm` | Products columns return per `sm/md/lg`; gauges sit side-by-side |
| `< md (768)` | Header auth + New Product collapse to 50px `#DFDFDF` circles (34px black core); orange "Inventory Manager" label wraps to two lines |
| `≥ lg (1024)` | **The nav swap:** floating bottom pill disappears, desktop rail appears (`lg:hidden` / `hidden lg:flex`) |
| `≥ xl (1280)` | Supplier-detail stat tiles go 2×2 → 4-up; product detail 4-stat row |

## §18 Z-Index Layer Map

| Layer | z | Element |
|---|---|---|
| Base | auto | content |
| Mobile nav / header | 50 | `z-50` both — they never overlap (bottom vs top) |
| Radix overlays | 50+ | dialogs, selects (Radix manages internally) |
| Order Details slide-over | 50 | fixed inset-0 with `bg-black/30` scrim |
| Dev indicator | — | disabled (`devIndicators: false`) so captures stay clean |

## §19 Color Reference (Complete)

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#FF9000` | Active nav pill, gauge markers, Inventory Value tile, New Product |
| `--primary-foreground` | `#0F1729` | Navy text on orange surfaces |
| `--background` | `#EFEFEF` | App background — content sits directly on gray |
| `--foreground` | `#111111` | Body text; black KPI tile; list black header bar |
| `--muted-foreground` | `#343434` | Secondary labels, SKU lines, mobile card captions |
| `--secondary` | `#EFEFEF` (utility surfaces) | Filter pills, avatar circle |
| `--destructive` | `#F13A15` | Low-stock dot/numbers, out-of-stock, negative badges |
| `--success` | `#22C55E` | Positive movers badges, rising trends |
| Inactive pill | `#DFDFDF` | Nav circles, mobile chips, image placeholders |
| List row pill | `#EFEFEF` on white card | `rounded-[22px]` rows |
| Health badge text | `#64E03C` green / `#FF9000` orange / `#F13A15` red on `#111111` pill | Supplier-detail product status |
| Suggestion text | `#898989` | "AI Reasoning" expanders, "Suggested:" notes, hero notes |

## §20 Key Interfaces (TypeScript)

```ts
// ActionResult envelope (src/domain/result.ts)
type ActionResult<T> = { ok: true; data: T } | { ok: false; code: ActionErrorCode; message: string };

// Movement record (the analytics input — src/domain/replenishment.ts)
type MovementRecord = { delta: number; reason: 'initial' | 'restock' | 'sale'; occurredAt: Date };

// Session user (src/lib/session.ts)
interface SessionUser { id: string; email: string; name: string | null }

// Server env contract (src/lib/env.ts)
interface ServerEnv { DATABASE_URL: string; NODE_ENV: string; SESSION_SECRET: string }

// List-pattern row inputs (src/server/queries.ts)
interface PurchaseOrderRow { id, orderNumber, productId, productName, productCategory, sku,
  imageUrl: string | null, supplierName, quantity, unitCostMinor, totalCostMinor,
  status: 'Suggested'|'Approved'|'Delivered'|'Cancelled', orderDate, expectedDelivery }
interface SuggestionRow { orderId, productId, productName, sku, supplierName, quantity,
  totalCostMinor, expectedDelivery, aiReasoning, orderDate, imageUrl: string | null }

// Reference display orders (src/domain/reference-order.ts)
const MARKET_TREND_ORDER = ['Office','Apparel','Food & Beverage','Household','Electronics','Beauty'] as const;
function supplierAvgLeadTimeDays(products: ReadonlyArray<{ leadTimeDays: number }>): number | null
```

## Appendix A — Gate Facts (verified this session)

- Unit: **111/111** across 8 files (result 6, env 8, db-path 12, reference-order 8, guard 4, nav-items 6, + domain suites)
- E2E: **38/38 chromium** across 8 spec files (webkit needs system GTK/GStreamer locally; CI runs both as blocking jobs)
- Analytics: all PASS — velocities 1.5/1.2/0.8/0.7/0.4/0.0, low-stock −1, 11 suggestions, $202,610, badges +2/−1/0/+1/+2
- Lint 0 · tsc 0 · production build with types enforced
- Screenshots: 18 in `docs/screenshots/` (11 desktop full-page @1440 + 7 mobile @390×844)

## Appendix B — File Map (the 20 files that matter)

```
prisma/schema.prisma            6 models, Int minor money, natural keys
prisma/seed.ts                  idempotent seed, ledger builder, REFERENCE_ANCHOR
src/domain/replenishment.ts     pure engine: velocity, cover, projection, forecast, badges
src/domain/reference-order.ts   pinned display orders + supplier avg lead time
src/domain/money.ts             formatters (whole / cents / $2320.0 reference style)
src/domain/result.ts            ActionResult envelope
src/lib/db-path.ts              relative file: URL anchoring (12 tests)
src/lib/env.ts                  parseServerEnv + getServerEnv seam
src/lib/session.ts              scrypt + HMAC cookies; protocol-aware Secure flag
src/server/queries.ts           all reads; reference orderings; typed rows
src/server/actions.ts           guarded mutations (ActionResult)
src/app/page.tsx                dashboard (asymmetric KPI grid, dot plot, feed)
src/app/products/page.tsx + [id] catalog list pattern + hero detail card
src/app/ai-suggestions/page.tsx  list card + reasoning expanders
src/app/purchase-orders/page.tsx filter bar + pill rows + slide-over
src/app/suppliers/page.tsx + [id] 4-col scorecards + partner profile
src/app/market-trends/page.tsx  3-col gauge cards (fixed order)
src/components/app/list-pattern.tsx  THE shared list primitives
src/components/app/mobile-nav.tsx   floating frosted bottom pill
e2e/*.spec.ts                   38 specs pinning reference behavior
```

## Appendix C — Quick Reference Card

```bash
bun run dev                                  # :3000, logs to dev.log
bun run build && bun run start               # standalone production server
env -u DATABASE_URL bun run db:seed          # reseed (self-healing)
env -u DATABASE_URL bun run verify:analytics # KPI regression
bun run test / test:coverage                 # 111 unit / +thresholds
bun run test:e2e                             # 38 chromium vs next start :3002
agent-browser open http://localhost:3000     # parity verification
```

Reference login (operator account, live parity audits): see the repo's operator prompt docs (`docs/prompt-to-create.md`) — never paste it into new files; demo sign-in for the clone: `demo@supplychain.local` / `demo-password` (env-overridable, safe defaults documented in `.env.example`).

