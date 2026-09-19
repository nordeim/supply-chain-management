/**
 * Server environment contract — parse once, fail fast, actionable messages
 * (scandihaven boot-validation convention, adapted to this single app).
 *
 * The app intentionally runs with only DATABASE_URL required: every other
 * variable is optional with a safe default so a fresh clone boots after
 * `bun install && bun run db:push && bun run db:seed`.
 */

export interface ServerEnv {
  DATABASE_URL: string;
  NODE_ENV: string;
  SESSION_SECRET: string;
}

const DEFAULT_SESSION_SECRET = 'dev-only-insecure-session-secret-change-me';

export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const errors: string[] = [];

  const databaseUrl = source.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required (e.g. "file:./db/custom.db" for local SQLite). See .env.example.');
  }

  const sessionSecret = source.SESSION_SECRET?.trim() ?? '';
  const isDev = (source.NODE_ENV ?? 'development') !== 'production';

  if (!isDev && (!sessionSecret || sessionSecret === DEFAULT_SESSION_SECRET)) {
    errors.push('SESSION_SECRET must be set to a strong random value in production (openssl rand -base64 32).');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server environment:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    DATABASE_URL: databaseUrl!,
    NODE_ENV: source.NODE_ENV ?? 'development',
    SESSION_SECRET: sessionSecret || DEFAULT_SESSION_SECRET,
  };
}
