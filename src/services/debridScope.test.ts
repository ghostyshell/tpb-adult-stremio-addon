import { describe, it, expect } from 'vitest';
import { scopeKey } from './debridUtils';

// Regression test for the Premiumize cross-account cache leak.
// Premiumize previously built cache keys as `pm:files:${infoHash}` with no
// account scoping, so one user's resolved CDN links were served to every
// other user for the same hash. The fix threads scopeKey(apiKey) into the
// key; this test pins that scopeKey actually distinguishes accounts.

describe('scopeKey account isolation', () => {
  it('produces different keys for different apiKeys', () => {
    expect(scopeKey('user-a-key')).not.toBe(scopeKey('user-b-key'));
  });

  it('produces the same key for the same apiKey', () => {
    expect(scopeKey('user-a-key')).toBe(scopeKey('user-a-key'));
  });

  it('is stable at 16 hex chars', () => {
    expect(scopeKey('x')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('never leaks the raw apiKey into the digest', () => {
    const key = 'super-secret-debrid-key-12345';
    expect(scopeKey(key)).not.toContain(key);
  });

  it('makes the full PM cache keys differ per account', () => {
    // Mirrors the key shape now used in premiumize.ts.
    const infoHash = 'abcdef0123456789abcdef0123456789abcdef01';
    const keyA = `pm:files:${scopeKey('user-a')}:${infoHash}`;
    const keyB = `pm:files:${scopeKey('user-b')}:${infoHash}`;
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain(infoHash);
  });
});
