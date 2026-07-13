import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Regression test for the profile auth bypass.
//
// verifyAuthKey previously trusted the client-supplied identifier when Stremio's
// getUser returned a valid result without an email field. That let anyone with
// any valid authKey claim any user's identity (the encryption key is derived
// from the identifier, so the AES-GCM on profile slots provided no protection).
// It must now fail closed.

async function freshVerifyAuthKey() {
  vi.resetModules();
  const mod = await import('./profile');
  return mod.verifyAuthKey;
}

function stubGetUser(result: { result?: { email?: string } | null; error?: unknown }, ok = true) {
  const json = vi.fn().mockResolvedValue(result);
  (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok, json });
}

describe('verifyAuthKey fail-closed', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    (globalThis as any).fetch = realFetch;
  });

  it('rejects when getUser returns a valid result with no email', async () => {
    // The bypass: { result: {} } with no email previously returned true.
    stubGetUser({ result: {} });
    const verify = await freshVerifyAuthKey();
    expect(await verify('attacker-key', 'victim@example.com')).toBe(false);
  });

  it('authenticates when getUser email matches the claimed identifier', async () => {
    stubGetUser({ result: { email: 'victim@example.com' } });
    const verify = await freshVerifyAuthKey();
    expect(await verify('valid-key', 'victim@example.com')).toBe(true);
  });

  it('rejects when getUser email does not match', async () => {
    stubGetUser({ result: { email: 'someone-else@example.com' } });
    const verify = await freshVerifyAuthKey();
    expect(await verify('valid-key', 'victim@example.com')).toBe(false);
  });

  it('rejects when getUser returns an error', async () => {
    stubGetUser({ error: 'invalid authKey' });
    const verify = await freshVerifyAuthKey();
    expect(await verify('bad-key', 'victim@example.com')).toBe(false);
  });
});
