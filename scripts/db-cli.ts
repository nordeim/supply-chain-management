#!/usr/bin/env bun
/**
 * Prisma CLI wrapper — anchors DATABASE_URL at the repo root before the
 * CLI runs, so `file:../db/custom.db` always opens `<repo>/db/custom.db`
 * (the .env.example contract).
 *
 * Why: the Prisma CLI resolves env-provided relative `file:` URLs against
 * the directory it loaded `.env` from (the repo root), which lands one
 * level ABOVE the repo — the runtime seam (src/lib/db-path.ts) fixes the
 * server/seed side; this wrapper fixes `db:push` / `db:migrate` /
 * `db:reset` by exporting an ABSOLUTE URL, which real environment
 * variables always win over .env values in the CLI's own dotenv loading.
 *
 * Usage: bun scripts/db-cli.ts <prisma args…>
 *   e.g. bun scripts/db-cli.ts db push --accept-data-loss
 */
import { spawnSync } from 'node:child_process';

import { resolveDatabaseUrl } from '../src/lib/db-path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: bun scripts/db-cli.ts <prisma args…> (e.g. "db push --accept-data-loss")');
  process.exit(1);
}

const rawUrl = process.env.DATABASE_URL?.trim();
const resolvedUrl = resolveDatabaseUrl(rawUrl);
if (rawUrl && !resolvedUrl) {
  console.error('[db-cli] DATABASE_URL is set but could not be resolved for the Prisma CLI.');
  process.exit(1);
}

const env: NodeJS.ProcessEnv = { ...process.env };
if (resolvedUrl) env.DATABASE_URL = resolvedUrl;

const command = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const result = spawnSync(command, args, { env, stdio: 'inherit' });
if (result.error) {
  console.error(`[db-cli] failed to launch the Prisma CLI: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
