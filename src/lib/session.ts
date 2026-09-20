/**
 * Session — HMAC-signed stateless cookie sessions (scandihaven pattern:
 * signed cookie holding a token, DB keyed by user id; no third-party dep).
 *
 * The cookie value is `userId.expiry.hmac(secret)`. Tampering with any
 * segment breaks the HMAC; expired sessions verify as signed-out.
 */

import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';

const SESSION_COOKIE = 'scm_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
  // Validated lazily through the env contract (call time, not import time,
  // so `next build` never requires it). Production refuses the insecure
  // default here — see src/lib/env.ts getServerEnv().
  return getServerEnv().SESSION_SECRET;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** Create a session cookie value for a user id. */
export function createSessionToken(userId: string, now: Date = new Date()): string {
  const expiry = now.getTime() + SESSION_TTL_MS;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a session cookie value; returns the user id or null. */
export function verifySessionToken(token: string, now: Date = new Date()): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiryRaw, mac] = parts;
  const payload = `${userId}.${expiryRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < now.getTime()) return null;
  return userId;
}

/** Read the current session from the request cookies (server only). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const { db } = await import('@/lib/db');
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
  return user ?? null;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Verify a scrypt password hash (`scrypt:salt:hex`) against a plaintext. */
export function verifyPassword(plaintext: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const candidate = scryptSync(plaintext, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
