import { describe, expect, it } from 'vitest';
import { requireSignedIn } from './guard';
import { fail } from './result';

/**
 * Session guard for the admin/programmatic action layer.
 *
 * PAD §10 (Medium): the four lifecycle actions (approve/dismiss suggestion,
 * order status transitions, suggestion generation) have no UI surface after
 * the reference-parity remediation — they are programmatic/admin paths, and
 * they must refuse anonymous callers. The reference app's public surfaces
 * (reads, New Product dialog, auth) stay open; this guard only protects the
 * seams the reference does not expose.
 */
describe('requireSignedIn', () => {
  it('denies an anonymous caller with an UNAUTHENTICATED ActionResult', () => {
    const denial = requireSignedIn(null);
    expect(denial).not.toBeNull();
    expect(denial!.ok).toBe(false);
    if (denial!.ok) throw new Error('unreachable');
    expect(denial!.code).toBe('UNAUTHENTICATED');
    expect(denial!.message).toMatch(/sign in/i);
  });

  it('returns null (allowed) for any signed-in user id', () => {
    expect(requireSignedIn('usr_123')).toBeNull();
    expect(requireSignedIn('any-nonempty-id')).toBeNull();
  });

  it('produces deniations shaped exactly like fail() results', () => {
    const denial = requireSignedIn(null);
    expect(denial).toEqual(fail('UNAUTHENTICATED', denial!.ok ? '' : denial!.message));
  });

  it('never allows an empty-string session (defensive)', () => {
    // An empty id would be a session-layer bug; treat it as anonymous.
    const denial = requireSignedIn('');
    expect(denial).not.toBeNull();
  });
});
