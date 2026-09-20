import { afterEach, describe, expect, it } from 'vitest';
import { getServerEnv, parseServerEnv, resetServerEnvCache } from './env';

/**
 * Environment contract (src/lib/env.ts).
 *
 * parseServerEnv is the pure parser (fail-fast, actionable messages).
 * getServerEnv is the memoized runtime seam: it validates lazily (call time,
 * never import time, so `next build` never requires a production secret) and
 * caches per process. Session HMAC signing goes through it, which is what
 * makes the documented "production refuses the insecure default" contract
 * actually enforced at runtime.
 */

const BASE = { DATABASE_URL: 'file:../db/custom.db' };

afterEach(() => {
  resetServerEnvCache();
  delete process.env.SESSION_SECRET;
  delete process.env.DATABASE_URL;
});

describe('parseServerEnv', () => {
  it('requires DATABASE_URL', () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL is required/);
  });

  it('accepts the minimal dev environment with a safe default secret', () => {
    const env = parseServerEnv({ ...BASE });
    expect(env.DATABASE_URL).toBe(BASE.DATABASE_URL);
    expect(env.SESSION_SECRET).toBe('dev-only-insecure-session-secret-change-me');
    expect(env.NODE_ENV).toBe('development');
  });

  it('refuses an empty SESSION_SECRET in production', () => {
    expect(() => parseServerEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('refuses the insecure default SESSION_SECRET in production', () => {
    expect(() =>
      parseServerEnv({ ...BASE, NODE_ENV: 'production', SESSION_SECRET: 'dev-only-insecure-session-secret-change-me' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('accepts a strong SESSION_SECRET in production', () => {
    const env = parseServerEnv({ ...BASE, NODE_ENV: 'production', SESSION_SECRET: 'a-random-32-byte-secret' });
    expect(env.SESSION_SECRET).toBe('a-random-32-byte-secret');
  });

  it('collects every problem into one actionable error', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL[\s\S]*SESSION_SECRET/);
  });
});

describe('getServerEnv', () => {
  it('parses and memoizes the process environment once', () => {
    process.env.DATABASE_URL = BASE.DATABASE_URL;
    const first = getServerEnv();
    const second = getServerEnv();
    expect(second).toBe(first); // memoized: identical reference
  });

  it('re-parses after the cache is reset (test seam)', () => {
    process.env.DATABASE_URL = BASE.DATABASE_URL;
    const first = getServerEnv();
    resetServerEnvCache();
    const second = getServerEnv();
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
