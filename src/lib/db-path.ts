import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * DATABASE_URL resolution seam — pins the `.env.example` contract:
 *
 *   A RELATIVE `file:` URL is resolved against `prisma/schema.prisma`,
 *   so `file:../db/custom.db` points at `<repo>/db/custom.db` regardless
 *   of the process working directory.
 *
 * Why this exists (audited 2026-09-20): Prisma 6.11 resolves env-provided
 * relative `file:` URLs against the process CWD, not the schema location —
 * so `file:../db/custom.db` executed from the repo root landed one level
 * ABOVE the repo. The runtime (src/lib/db.ts), the seed, and the analytics
 * verifier pass their URL through `resolveDatabaseUrl()` here, anchoring
 * every consumer at the same `<repo>/db/custom.db` file.
 *
 * Non-`file:` URLs (PostgreSQL, etc.) pass through untouched, and the
 * function never throws: a missing/odd URL is reported by the env
 * contract or by Prisma's connection errors, not by a boot crash.
 */

const SCHEMA_RELATIVE_PATH = path.join('prisma', 'schema.prisma');

let cachedSchemaDir: string | null | undefined;

function walkUpForSchemaDir(startDir: string): string | null {
  let dir = path.resolve(startDir);
  // Bounded walk: file systems are finite; the guard keeps the loop honest
  // even on exotic mount layouts.
  for (let i = 0; i < 32; i += 1) {
    if (existsSync(path.join(dir, SCHEMA_RELATIVE_PATH))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Locate the schema directory by finding `prisma/schema.prisma` — first
 * walking up from this module's own location (dev, seed, bun-run scripts),
 * then from the process CWD (standalone build: the module is bundled into
 * `.next/standalone/`, but `bun run start` / `next start` still execute
 * from the repo root). Returns the directory CONTAINING the schema file
 * (i.e. `<repo>/prisma`) — the base a relative `file:` URL anchors to, so
 * `file:../db/custom.db` reaches `<repo>/db/custom.db`. Memoized; null
 * when neither anchor finds the repo.
 */
function defaultSchemaDir(): string | null {
  if (cachedSchemaDir === undefined) {
    let fromModule: string | null = null;
    try {
      fromModule = walkUpForSchemaDir(path.dirname(fileURLToPath(import.meta.url)));
    } catch {
      // import.meta.url unavailable (exotic bundlers) — CWD is the fallback.
      fromModule = null;
    }
    const repoRoot = fromModule ?? walkUpForSchemaDir(process.cwd());
    cachedSchemaDir = repoRoot === null ? null : path.join(repoRoot, 'prisma');
  }
  return cachedSchemaDir;
}

/** Test seam: reset the memoized repo-root lookup. */
export function resetSchemaDirCache(): void {
  cachedSchemaDir = undefined;
}

/**
 * Resolve a DATABASE_URL. `baseDir` is the directory the relative `file:`
 * path anchors to — the schema directory (`prisma/`) by default. Pass an
 * explicit base in tests; pass `null` to simulate an unlocatable repo.
 */
export function resolveDatabaseUrl(
  rawUrl: string | undefined | null,
  baseDir: string | null = defaultSchemaDir(),
): string | undefined {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('file:')) return trimmed;

  const filePath = trimmed.slice('file:'.length);
  const queryStart = filePath.indexOf('?');
  const location = queryStart === -1 ? filePath : filePath.slice(0, queryStart);
  const query = queryStart === -1 ? '' : filePath.slice(queryStart);

  if (!location || path.isAbsolute(location)) return trimmed;
  if (!baseDir) return trimmed; // fail-open: Prisma reports the connection error

  return `file:${path.resolve(baseDir, location)}${query}`;
}
