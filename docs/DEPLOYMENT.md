# Deployment Runbook — supply-chain-management

This runbook ships with the repo because deploying a Next.js app with a
git-ignored SQLite file has a well-known trap class (documented across this
project's sessions and in the sample runbook this file is based on): the
database file is **deliberately git-ignored** (it is runtime data), so a fresh
clone plus `bun run build` ships no data layer — and a relative `DATABASE_URL`
resolves differently for the Prisma CLI, the runtime, and a server started
from an unexpected working directory. The clone was engineered against those
exact failure modes (`src/lib/db-path.ts`, §4 below), but the operator still
has to run the provisioning steps in order.

Follow the steps below and the app comes up green.

## 1. Provision the runtime environment

The standalone server (`.next/standalone/server.js`) loads `.env` **from its
own working directory at startup** — run the server from the repo root, or
export the variables through your process manager (systemd, PM2, Docker):

```bash
cp .env.example .env
```

Then set, at minimum:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `file:/absolute/path/to/db/custom.db` | **Use an absolute path in production** — relative `file:` URLs are anchored at `prisma/` by the db-path contract (see §4); absolute removes all ambiguity |
| `SESSION_SECRET` | `openssl rand -base64 32` | HMAC-signs session cookies. **Production refuses to boot the session path without it** — `src/lib/env.ts` rejects the documented dev placeholder at first session use (sign-in fails closed, the app itself keeps serving) |
| `SEED_DEMO_EMAIL` | e.g. `ops@your-domain` | Optional — demo account created by the seed; also read by the auth E2E spec |
| `SEED_DEMO_PASSWORD` | ≥ 8 characters | Optional — same |

No `NEXT_PUBLIC_*` build-time variables exist in this app (no site URL is
inlined), so a rebuild is not required for env changes beyond the server's
own `.env` load.

## 2. Provision the database (the step a repo-only deploy misses)

```bash
bun install                                  # or: npm install
bun run db:push                              # schema push (no migrations dir in this repo)
SEED_DEMO_PASSWORD=… bun run db:seed         # 6 products + ledger + 15 POs + 4 suppliers + demo user
bun run verify:analytics                     # proves the data layer (see §3)
bun run build                                # standalone output in .next/standalone
bun run start                                # NODE_ENV=production bun .next/standalone/server.js
```

Notes:

- This repo uses **`db:push`, not `migrate deploy`** — there is no
  `prisma/migrations/` baseline; the schema is pushed straight from
  `prisma/schema.prisma` (the `db:push`/`db:migrate`/`db:reset` scripts route
  through `scripts/db-cli.ts` so the Prisma CLI sees the same resolved URL as
  the runtime).
- The seed is **idempotent** (natural-key upserts) and **self-healing**: it
  pins purchase-order dates and the market-trends quarter to the reference
  capture (`REFERENCE_ANCHOR`, 2026-09-20) and rebuilds a product's movement
  ledger when its newest sale has crossed UTC midnight, so
  `db:seed && verify:analytics` always converges to the reference KPIs.
- `db/` is git-ignored by design; on a fresh machine the two commands above
  recreate the entire demo dataset.
- The seeded dataset is **demo data**: values (costs, velocities, the $202,610
  inventory value, the 11 suggestions) reproduce the reference app's capture.
  Real usage should treat the seed as a starting point, not production content.

## 3. Verify (health proves connectivity — analytics proves data)

```bash
curl -s https://your-domain/api/health
# → {"status":"ok","database":"up",...}  — anything else is a regression
```

One honest caveat: `/api/health` executes `SELECT 1`, so it proves the server
reaches *a* SQLite file — an auto-created **empty** file would still answer
`ok` (the exact masking mode observed on the sample project's first deploy).
After first provisioning, also verify the data layer:

```bash
bun run verify:analytics
# velocities 1.5/1.2/0.8/0.7/0.4/0.0 · low-stock −1 · 11 suggestions
# inventory value $202,610 (cost basis) · badges +2/−1/0/+1/+2 — all must PASS
```

Then sign in via the header's **Sign In** button with the seeded demo
credentials and confirm the dashboard renders (KPI grid, dot plot, 12-card
stock feed) and `/products` lists 6 SKUs.

## 4. SQLite path resolution (the trap, and how the app handles it)

**How resolution works.** The Prisma *CLI* resolves a relative `file:` URL
against the **schema directory** (`prisma/`), so the documented
`DATABASE_URL="file:../db/custom.db"` places the database at
`<repo>/db/custom.db`. Since session 9, `src/lib/db-path.ts` re-anchors
relative `file:` URLs at runtime the same way (module-location walk-up with
CWD fallback, memoized, never throws), wired into `src/lib/db.ts` (the
running server), `prisma/seed.ts`, and `scripts/verify-analytics.ts`, and the
`db:*` scripts route the CLI through `scripts/db-cli.ts` — migrate, seed,
`next build`, and the running server all agree on one file. A mis-resolved
path can no longer silently fork the database.

**What can still override `.env`:** a `DATABASE_URL` exported in the service
environment (or picked up from a stray parent-directory `.env`) wins over the
repo's `.env` — this was reproduced in this project's sandbox (session 9):
the DB landed one directory above the repo while health stayed green. Check
the process environment first when the server connects to an unexpected file:

```bash
bun -e 'console.log(process.env.DATABASE_URL)'
```

For servers, an absolute path remains the most explicit and recommended form:

- `DATABASE_URL=file:/var/lib/supply-chain-management/custom.db` (absolute;
  the directory exists and is writable by the service user).
- Keep the file on a persistent volume; SQLite = the file is the backup
  (`cp` while the service is stopped, or `sqlite3 .backup`).

For multi-instance or managed deployments, switch to PostgreSQL (the schema is
provider-portable): set `provider = "postgresql"` in `prisma/schema.prisma`,
point `DATABASE_URL` at the instance, re-run `db:push && db:seed`.

## 5. TLS termination and the session cookie

The session cookie's `Secure` flag follows the **request protocol**, not
`NODE_ENV` (`src/lib/session.ts` → `isHttpsRequest()`, honoring the first
`x-forwarded-proto` entry): behind a TLS-terminating proxy the cookie is
marked `Secure`; on plain HTTP (local dev, plain-HTTP staging) it is not —
so WebKit/Safari never silently drop the session on non-HTTPS transports.
Consequences for deployment:

- Terminate TLS at your proxy (nginx/Caddy/ALB) and pass
  `X-Forwarded-Proto: https` — the standard configuration.
- Do not strip that header; the cookie downgrades silently to non-Secure.

The mutation layer (approve/dismiss/status-transition server actions) refuses
anonymous callers with `ActionResult` code `UNAUTHENTICATED` — the read-only
reference-parity surfaces stay public by design, exactly like the live
reference app.

## 6. Deploying updates & the shipped quality gates

```bash
git pull && bun install && bun run db:push && bun run db:seed && bun run build && systemctl restart …  # or your manager
```

Every push to `main` runs the full gate on GitHub Actions (`.github/workflows/ci.yml`):
lint → typecheck → unit + coverage thresholds → db push/seed → verify:analytics →
production build → Playwright E2E (chromium **and** webkit, both blocking;
results also render as public annotations on the run page). Deploy the
current `main` and the same checks have already passed for that commit.

## 7. Post-deploy E2E fidelity check (optional but recommended)

The Playwright suite can smoke-test the live deployment directly — every spec
is read-only or session-only (none writes business data; the auth spec signs
in/out with the demo account):

```bash
E2E_BASE_URL=https://your-domain npx playwright test --project=chromium
```

Notes:

- The auth round-trip needs the seeded demo credentials — either keep the
  defaults or export `SEED_DEMO_EMAIL`/`SEED_DEMO_PASSWORD` to match what the
  seed created (never point CI logs at a real secret).
- WebKit locally requires system GTK/GStreamer libraries; chromium is the
  practical local gate — CI covers both engines on hosted runners.
- The specs assert the reference dataset's values (6 SKUs, 11 suggestions,
  fixed PO dates like 07.06.26/07.12.26). If you reseed with your own data,
  run the page-level smoke instead: dashboard KPIs render, product detail
  links work, procurement rows open the Order Details panel.
