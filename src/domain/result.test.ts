import { describe, expect, it } from 'vitest';
import { fail, ok, toActionResult } from './result';

describe('ok', () => {
  it('wraps success data', () => {
    const r = ok({ id: 1 });
    expect(r).toEqual({ ok: true, data: { id: 1 } });
  });
});

describe('fail', () => {
  it('wraps a typed failure', () => {
    const r = fail('VALIDATION', 'SKU is required');
    expect(r).toEqual({ ok: false, code: 'VALIDATION', message: 'SKU is required' });
  });

  it('narrows the code union', () => {
    const r = fail('DOMAIN', 'terminal');
    if (r.ok) throw new Error('unreachable');
    expect(['VALIDATION', 'DOMAIN', 'NOT_FOUND', 'INTERNAL']).toContain(r.code);
  });
});

describe('toActionResult', () => {
  it('passes successful results through', async () => {
    const r = await toActionResult(async () => ok(42));
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it('converts thrown errors into INTERNAL results (no throw across the boundary)', async () => {
    const r = await toActionResult(async () => {
      throw new Error('boom');
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('INTERNAL');
    expect(r.message).toBe('boom');
  });
});

describe('toActionResult (non-Error throws)', () => {
  it('converts thrown non-Errors into INTERNAL with a generic message', async () => {
    const r = await toActionResult(async () => {
      throw 'not an error'; // deliberate non-Error throw
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('INTERNAL');
    expect(r.message).toBe('Unexpected server error');
  });
});
