import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDatabaseUrl, resetSchemaDirCache } from './db-path';

/** The repo root, derived from this test file's own location (src/lib). */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Pins the DATABASE_URL resolution contract documented in `.env.example`:
 *
 *   "A RELATIVE `file:` URL is resolved against prisma/schema.prisma —
 *    exactly like the Prisma CLI — so `file:../db/custom.db` points at
 *    <repo>/db/custom.db for the CLI (migrate/seed), `next build`, and
 *    the running server alike, regardless of the process working
 *    directory."
 *
 * The base directory passed in each test stands in for the repo's
 * `prisma/` folder (the schema location the relative URL is anchored
 * to), so the tests are pure and independent of where vitest runs.
 */
describe('resolveDatabaseUrl', () => {
  it('resolves the documented default relative URL to the repo-root db folder', () => {
    // <repo>/prisma + ../db/custom.db => <repo>/db/custom.db
    expect(resolveDatabaseUrl('file:../db/custom.db', '/opt/repo/prisma')).toBe(
      'file:/opt/repo/db/custom.db',
    );
  });

  it('resolves a same-directory relative URL against the base', () => {
    expect(resolveDatabaseUrl('file:./dev.db', '/opt/repo/prisma')).toBe(
      'file:/opt/repo/prisma/dev.db',
    );
  });

  it('normalizes parent traversal segments', () => {
    expect(resolveDatabaseUrl('file:../db/../db/custom.db', '/opt/repo/prisma')).toBe(
      'file:/opt/repo/db/custom.db',
    );
  });

  it('passes absolute file URLs through untouched', () => {
    expect(resolveDatabaseUrl('file:/var/lib/app/custom.db', '/opt/repo/prisma')).toBe(
      'file:/var/lib/app/custom.db',
    );
  });

  it('passes non-file URLs (PostgreSQL et al.) through untouched', () => {
    const pg = 'postgresql://user:password@localhost:5432/designer_portfolio';
    expect(resolveDatabaseUrl(pg, '/opt/repo/prisma')).toBe(pg);
  });

  it('preserves SQLite connection query parameters', () => {
    expect(
      resolveDatabaseUrl('file:../db/custom.db?connection_limit=1&socket_timeout=5', '/opt/repo/prisma'),
    ).toBe('file:/opt/repo/db/custom.db?connection_limit=1&socket_timeout=5');
  });

  it('trims surrounding whitespace before resolving', () => {
    expect(resolveDatabaseUrl('  file:../db/custom.db  \n', '/opt/repo/prisma')).toBe(
      'file:/opt/repo/db/custom.db',
    );
  });

  it('returns undefined for a missing URL so the env contract reports it', () => {
    expect(resolveDatabaseUrl(undefined, '/opt/repo/prisma')).toBeUndefined();
    expect(resolveDatabaseUrl('', '/opt/repo/prisma')).toBeUndefined();
    expect(resolveDatabaseUrl('   ', '/opt/repo/prisma')).toBeUndefined();
  });

  it('returns the raw value when no base directory can be located (fail-open)', () => {
    // Path resolution must never throw — a mis-anchored URL is a connection
    // problem for Prisma to report, not a boot crash.
    expect(resolveDatabaseUrl('file:../db/custom.db', null)).toBe('file:../db/custom.db');
  });

  describe('default anchor (schema-directory walk-up)', () => {
    it('anchors relative URLs at the real repo schema directory', () => {
      resetSchemaDirCache();
      // This test runs from the actual repo checkout — the module-located
      // walk-up must find <repo>/prisma/schema.prisma and anchor there.
      expect(resolveDatabaseUrl('file:../db/custom.db')).toBe(
        `file:${path.join(repoRoot, 'db', 'custom.db')}`,
      );
    });

    it('memoizes the anchor without changing results across calls', () => {
      const first = resolveDatabaseUrl('file:../db/custom.db');
      const second = resolveDatabaseUrl('file:../db/custom.db');
      expect(second).toBe(first);
      expect(first).toBe(`file:${path.join(repoRoot, 'db', 'custom.db')}`);
    });

    it('resetSchemaDirCache forces a fresh lookup that finds the same anchor', () => {
      resetSchemaDirCache();
      expect(resolveDatabaseUrl('file:./dev.db')).toBe(
        `file:${path.join(repoRoot, 'prisma', 'dev.db')}`,
      );
    });
  });
});
