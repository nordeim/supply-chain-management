/**
 * Session guard for admin/programmatic server actions.
 *
 * After the reference-parity remediation the UI exposes no lifecycle
 * controls (the reference app has none), so the suggestion/order actions in
 * `src/server/actions.ts` are pure admin paths. This guard keeps them
 * invocable only by signed-in callers — closing the §10 "mutations do not
 * require a session" finding without touching any reference-parity surface
 * (public reads, the New Product dialog, and auth stay open exactly like
 * the reference app).
 */

import { fail, type ActionFailure } from './result';

/**
 * Returns an UNAUTHENTICATED denial for anonymous/invalid callers, or null
 * when the caller is signed in and the action may proceed. The denial is a
 * plain ActionFailure, assignable to any ActionResult<T> return type.
 *
 * Design note: `null` means "allowed" so action bodies read as
 * `const denied = requireSignedIn(...); if (denied) return denied;`
 * with no double negation.
 */
export function requireSignedIn(userId: string | null): ActionFailure | null {
  if (!userId || userId.length === 0) {
    return fail('UNAUTHENTICATED', 'Sign in to perform this action.');
  }
  return null;
}
