/**
 * ActionResult<T> — the action-boundary contract (scandihaven convention).
 *
 * Server Actions and every mutation seam return this union instead of
 * throwing across the boundary. A thrown error inside an action becomes an
 * INTERNAL result; validation problems become VALIDATION; expected domain
 * rule violations become DOMAIN. The UI renders the message verbatim —
 * operator-level detail is logged server-side, never shipped to the client.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'VALIDATION' | 'DOMAIN' | 'NOT_FOUND' | 'INTERNAL'; message: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: 'VALIDATION' | 'DOMAIN' | 'NOT_FOUND' | 'INTERNAL',
  message: string,
): ActionResult<T> {
  return { ok: false, code, message };
}

/** Wraps an action body: thrown Errors become INTERNAL results with the
 *  message preserved for the UI and the stack logged server-side. */
export async function toActionResult<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    console.error('[action] internal error', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return { ok: false, code: 'INTERNAL', message };
  }
}
