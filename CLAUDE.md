---
IMPORTANT: File is read fresh for every conversation. Be brief and practical.
---

# Supply Chain Management

## Core Identity & Purpose

An inventory-intelligence web application: a dashboard-driven control room for stock levels, AI replenishment suggestions, procurement, suppliers, and market trends. It is a single-app Next.js 16 clone of the reference Base44 application (`https://supply-chain-management-app.base44.app/`), rebuilt on the architecture conventions of the scandihaven foundation (ActionResult boundaries, integer minor-unit money, derived analytics, strict TypeScript) adapted to a single deployable with Prisma/SQLite.

Maintained by nordeim. The movement ledger is the source of truth; every KPI, velocity, forecast, and AI suggestion derives from it at read time.

## Foundational Principles

### Meticulous Approach (Six-Phase Workflow)

Follow this six-phase workflow for all implementation tasks:

1. **ANALYZE** — Deep, multi-dimensional requirement mining. Never make surface-level assumptions. Identify explicit requirements, implicit needs, and potential ambiguities. Explore multiple solution approaches. Perform risk assessment.
2. **PLAN** — Structured execution roadmap. Create a detailed plan with sequential phases. Present the plan for explicit user confirmation. Never proceed without validation.
3. **VALIDATE** — Explicit confirmation checkpoint. Obtain explicit user approval before implementation. Address any concerns or modifications.
4. **IMPLEMENT** — Modular, tested, documented builds. Set up the proper environment. Implement in logical, testable components. Create documentation alongside code.
5. **VERIFY** — Rigorous QA against success criteria. Execute comprehensive testing. Review for best practices, security, performance. Consider edge cases and accessibility.
6. **DELIVER** — Complete handoff with knowledge transfer. Provide the complete solution with instructions. Document challenges and solutions. Suggest improvements and next steps.

### Project-Specific Principles

- **Derived over stored analytics.** Velocity, KPI scores, forecasts, and reasoning text are computed from the `StockMovement` ledger by pure functions in `src/domain/` — never denormalized into columns.
- **Money is integer cents.** No exceptions; `src/domain/money.ts` is the only formatting seam.
- **Truthful AI text.** Suggestion reasoning is composed from real numbers (`buildAiReasoning`) with four branches so no sentence can contradict the data.
- **Server Actions for mutations, ActionResult-shaped.** No REST-for-UI, no thrown errors across the boundary. Admin lifecycle actions (approve/dismiss/status/generate) require a signed-in session (`requireSignedIn` → `UNAUTHENTICATED`); the reference-parity surfaces (New Product, auth, reads) stay open.

## Implementation Standards

### General Coding Practices
- **Early Returns**: Prefer early returns over deeply nested conditionals
- **Composition over Inheritance**: Favor composition patterns
- **Self-Documenting Code**: Clear naming and structure
- **Test-Driven Development**: Follow Red-Green-Refactor cycle for domain logic (pure functions make this cheap)

### Language & Framework Guidelines

**TypeScript Strict Mode**
- `strict: true` in tsconfig; never use `any` — prefer `unknown`
- Prefer `interface` for structural definitions, `type` for unions/intersections and `z.infer` aliases
- Explicit return types on exported functions where inference is non-obvious

**Next.js 16 App Router**
- `params` / `searchParams` / `cookies()` are async — always `await`
- Page files export only `default`, `metadata`/`generateMetadata`, `revalidate`, `dynamic` — move anything else to `src/components/` or `src/server/`
- Client components (`'use client'`) only where interactivity demands it (dialogs, filters, charts, forms); pages stay server components
- Every page declares `export const dynamic = 'force-dynamic'` (root layout reads cookies anyway)

**React 19**
- Server Components by default; client islands for `useState`/`useTransition`/router interactions
- Handle all UI states: loading, error, empty, success — empty lists get explicit friendly messages
- Disable buttons during async operations; use `useTransition` for router-refresh mutations

**Tailwind CSS v4 (CSS-first)**
- Brand tokens in `:root` + `@theme inline` in `globals.css` — Session 2 parity palette: orange `#FF9000` primary with dark-navy `#0F1729` foreground text, `#EFEFEF` background, `#DFDFDF` inactive pills, `#F13A15` destructive, `#22C55E` success, black `#111111` KPI tile, white cards at `32px` radius
- Use semantic tokens (`bg-primary`, `text-muted-foreground`) instead of raw hex; hardcoded hex is acceptable only for reference-app fidelity
- Responsive: mobile-first with the reference's breakpoints — the nav rail renders at `lg` and up; below `lg` the floating frosted bottom-nav pill navigates (both share `nav-items.tsx`); the header's New Product appears at `md`; tables scroll horizontally on small screens

**Prisma + SQLite**
- Schema in `prisma/schema.prisma`; DB file at `db/custom.db` (`.env` keeps the relative URL `file:../db/custom.db`; `src/lib/db-path.ts` anchors it at the `prisma/` schema directory at runtime, and `scripts/db-cli.ts` does the same for the `db:*` CLI scripts — never invoke `prisma db push` raw)
- All reads through `src/server/queries.ts`; all writes through `src/server/actions.ts`
- Money fields are `Int` (`*Minor` suffix); statuses are strings validated in the domain/action layer

## Development Workflow

### Environment Setup

```bash
bun install
cp .env.example .env            # then set DATABASE_URL (and SESSION_SECRET for prod)
bun run db:push                 # create/refresh the SQLite schema
bun run db:seed                 # idempotent demo data (6 products, 4 suppliers, 15 POs)
bun run dev                     # http://localhost:3000
```

Optional demo sign-in account (seeded): `demo@supplychain.local` / `demo-password`, or override with `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` when seeding.

### Build Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | Run linter |
| `bun run typecheck` | Type checking |
| `bun run db:push` / `db:seed` / `verify:analytics` | Database schema / demo data / KPI regression check |
| `bun run test` / `test:watch` / `test:coverage` | Vitest unit suite (111 tests) / watch mode / with coverage thresholds |
| `bun run test:e2e` / `e2e:summary` | Playwright E2E (38 tests incl. mobile-viewport specs, `next start` on :3002; build first) / JUnit results → failure report |

## Testing Strategy

### Test Pyramid
- **Unit Tests (Vitest, 111)**: pure functions in `src/**/*.test.ts` — velocity windows, low-stock scoring, reorder-quantity math, forecasting, 30-day sales deltas, ledger day-series replay, money formatting/parsing, ActionResult shape, gauge/tick-scale helpers, the session guard, the reference reasoning sentence, the db-path DATABASE_URL contract, the shared nav model, and the reference display-order rules (market-trend rank, supplier avg lead time). TDD: Red → Green → Refactor; tests are colocated with the modules they cover. `bun run test:coverage` enforces 95/85/95/95 thresholds over the pure layer.
- **Integration Check**: `scripts/verify-analytics.ts` — asserts the seeded ledger reproduces the reference KPIs (velocity 1.5/1.2/0.8/0.7/0.4/0.0, low-stock score −1, 11 pending suggestions, inventory value $202,610 cost basis, movers badges +2/−1/0/+1/+2, 90-day series integrity)
- **E2E (Playwright, 38 tests)**: `e2e/*.spec.ts` run against the production build (`next start`, not dev) — every page renders with reference data, sign-in/out with the seeded demo account, product search, status filter, Order Details side panel, supplier detail navigation, AI reasoning expansion, health probe, plus the mobile bottom-nav pill suite (iPhone 14 viewport via `test.use`, runs under every project so hosted CI covers mobile Safari). CI runs chromium and webkit as **both-blocking** jobs (webkit promoted from exploratory in PAD v1.5 after a 3-run post-fix green streak) on pinned `ubuntu-24.04` runners with public failure annotations on the run page; locally webkit needs system libraries — run `--project=chromium` where unavailable. Hydration-race discipline: specs that act on SSR-rendered inputs wrap interact→assert in `toPass()` because Playwright actions don't retry.

### Test Commands

```bash
bun run test                       # 111 unit tests — no DB required
bun run test:coverage              # same suite + v8 coverage thresholds (95/85/95/95)
bun run verify:analytics           # DB-backed regression check against reference values
bun run lint && bun run typecheck  # static gates — both must exit 0
bun run build && bun run test:e2e  # full browser E2E against the shipped artifact
```

CI (`.github/workflows/ci.yml`) runs this exact sequence on every push/PR to main, plus the seed + analytics gates; the webkit E2E project runs in a second required job (promoted from exploratory non-blocking to blocking in PAD v1.5).

## Code Quality Standards

### Linting & Formatting

```bash
bun run lint
bun run typecheck
```

ESLint 9 flat config with `eslint-config-next`. Fix reported issues; never disable a rule or weaken types to make a gate pass.

## Git & Version Control

### Branching Strategy
- `main` is the only long-lived branch; short-lived feature branches (`feature/…`, `fix/…`) merge within 1–3 days

### Commit Standards
- Conventional Commits (`feat: …`, `fix: …`, `docs: …`, `chore: …`)
- Atomic commits — one logical change per commit
- Never commit `.env`, the SSH deploy key, or `db/*.db` (gitignore covers all three)

## Error Handling & Debugging

### Error Handling Approach
- Server Actions catch everything in `toActionResult` and return `ActionResult` failures; UI shows `result.message` verbatim with a destructive toast
- Server-side detail logs use the `[action]` / `[health]` prefixes; never log secrets or password material
- `next/cache` revalidation happens on every successful mutation for the affected paths

### Debugging Tools
- `dev.log` (root) — dev server output; check after any runtime anomaly
- `/api/health` — liveness + database probe
- `bun run verify:analytics` — pinpoints ledger/analytics drift after schema or seed edits

## Communication & Documentation

### Documentation Standards
- Explain "why", not just "what"; document assumptions and constraints
- `AGENTS.md` = agent onboarding cheat-sheet; `Project_Architecture_Document.md` = full blueprint with ADRs; keep both in sync with reality when architecture changes

## Project-Specific Standards

### Architecture
```
src/app/        → routes (server components) + client islands
src/components/app/ → app-specific UI (shell, KPI grid/gauges, dot plot, stock feed,
                     order-details panel, procurement table, charts, dialogs, filters)
src/components/ui/  → shadcn/ui primitives (do not hand-modify)
src/server/     → queries.ts (reads) + actions.ts (mutations)
src/domain/     → pure business logic (no I/O, no imports from app/server/lib) + *.test.ts
src/lib/        → db client, session, env validation, utils
e2e/           → Playwright browser specs (run against next start)
prisma/         → schema + idempotent seed
public/products/ → product images for stock-feed cards
scripts/        → verification tooling
```

### API Design
- UI mutations: Server Actions returning `ActionResult<T>` only. Reference-parity note: the only mutation surfaces in the UI are the New Product dialog and sign-in/up/out; PO lifecycle actions remain in the server layer for programmatic/admin use
- Route handlers: `GET /api/health`, `GET /api/suppliers` — read-only, JSON
- No client-side secrets; all privileged logic stays server-side

### Database / Data Layer
- Prisma models: `User`, `Supplier`, `Product`, `StockMovement`, `PurchaseOrder`, `MarketTrend`
- Purchase-order status machine: Suggested → (Approved|Cancelled); Approved → (Delivered|Cancelled); terminal after that. `Delivered` writes stock increment + `restock` movement atomically
- Seed upserts by natural keys (`sku`, `name`, `orderNumber`, `category`, `email`)

### Environment Variables

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `DATABASE_URL` | yes | SQLite (or PostgreSQL) connection | `file:../db/custom.db` |
| `SESSION_SECRET` | prod | HMAC secret for session cookies — enforced at session-signing time via `getServerEnv()` | `openssl rand -base64 32` |
| `SEED_DEMO_EMAIL` | no | Demo sign-in email | `demo@supplychain.local` |
| `SEED_DEMO_PASSWORD` | no | Demo sign-in password | `demo-password` |
| `E2E_PORT` | no | Playwright web server port | `3002` |
| `E2E_BASE_URL` | no | Reuse an external server for E2E | `http://127.0.0.1:3002` |

## Success Metrics

You are successful when:
- `bun run lint`, `bun run typecheck`, `bun run test` (or `test:coverage`), and `bun run verify:analytics` all pass
- `bun run build && bun run test:e2e` passes (38 tests) after UI changes, and hosted CI is green on the pushed commit (both chromium and webkit jobs)
- The dashboard KPIs match the derived ledger state (no stale or denormalized numbers) and the reference values ($202,610 inventory value, 6 SKUs, −1 low stock, 11 pending suggestions)
- New features follow the layer rule (app → server → domain → db) and actions return `ActionResult`
- Docs (AGENTS/PAD/README) stay truthful after any change you make

## System Integration

### Available Tools
- **bash**: Execute terminal operations
- **read**: Read files and directories
- **glob**: Find files by pattern
- **edit**: Make exact string replacements
- **write**: Write files to filesystem

## Anti-Patterns to Avoid

- **Storing analytics on Product** (velocity/totalSales columns) — derive from the ledger
- **Float money** — integer minor units only
- **REST endpoints for UI mutations** — Server Actions
- **Thrown errors across action boundaries** — return `ActionResult`
- **Page-file named exports** other than the allowed four
- **Hardcoded AI reasoning strings** — use `buildAiReasoning` for generated suggestions or `REFERENCE_AI_REASONING` for the reference-parity list surface; nothing else
- **Editing `src/components/ui/*`** — wrap or restyle at the usage site
- **Committing secrets** — `.env`, deploy keys, and `db/*.db` stay out of the tree
