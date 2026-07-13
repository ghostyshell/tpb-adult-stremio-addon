import { describe, it, expect } from 'vitest';
import { isSafeUrl, assertSafeUrl } from './safeUrl';

// ── isSafeUrl ────────────────────────────────────────────────────────────────

describe('isSafeUrl', () => {
  // Basic validation
  it('rejects empty string', () => {
    expect(isSafeUrl('')).toEqual({ ok: false, reason: 'empty url' });
  });
  it('rejects invalid URL', () => {
    expect(isSafeUrl('not a url')).toEqual({ ok: false, reason: 'invalid url' });
  });
  it('rejects ftp protocol', () => {
    expect(isSafeUrl('ftp://example.com/file')).toEqual({ ok: false, reason: 'only http/https allowed' });
  });
  it('rejects file protocol', () => {
    expect(isSafeUrl('file:///etc/passwd')).toEqual({ ok: false, reason: 'only http/https allowed' });
  });
  it('rejects URL with username', () => {
    expect(isSafeUrl('http://user@example.com/')).toEqual({ ok: false, reason: 'embedded credentials not allowed' });
  });
  it('rejects URL with password', () => {
    expect(isSafeUrl('http://user:pass@example.com/')).toEqual({ ok: false, reason: 'embedded credentials not allowed' });
  });
  // Blocked hosts (BLOCKED_HOSTS set)
  it('rejects localhost', () => {
    expect(isSafeUrl('http://localhost/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects metadata.google.internal', () => {
    expect(isSafeUrl('http://metadata.google.internal/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects metadata.goog', () => {
    expect(isSafeUrl('http://metadata.goog/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 169.254.169.254.nip.io', () => {
    expect(isSafeUrl('http://169.254.169.254.nip.io/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });

  // BLOCKED_HOST_PATTERNS
  it('rejects metadata.internal', () => {
    expect(isSafeUrl('http://metadata.internal/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects metadata.cluster.internal', () => {
    expect(isSafeUrl('http://metadata.cluster.internal/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 169-254-169-254.nip.io (pattern)', () => {
    expect(isSafeUrl('http://169-254-169-254.nip.io/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });

  // BLOCKED_IP_LITERALS
  it('rejects 169.254.169.254 IP literal', () => {
    expect(isSafeUrl('http://169.254.169.254/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });

  // Private IPv4 via isPrivateIPv4
  it('rejects 0.x.x.x (0.0.0.0/8)', () => {
    expect(isSafeUrl('http://0.1.2.3/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 10.x.x.x', () => {
    expect(isSafeUrl('http://10.0.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 127.x.x.x loopback', () => {
    expect(isSafeUrl('http://127.0.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 169.254.x.x link-local', () => {
    expect(isSafeUrl('http://169.254.1.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 172.16.x.x', () => {
    expect(isSafeUrl('http://172.16.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 172.31.x.x', () => {
    expect(isSafeUrl('http://172.31.255.255/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 192.168.x.x', () => {
    expect(isSafeUrl('http://192.168.1.100/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 192.0.0.x', () => {
    expect(isSafeUrl('http://192.0.0.5/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 192.0.2.x (documentation)', () => {
    expect(isSafeUrl('http://192.0.2.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 198.51.100.x (documentation)', () => {
    expect(isSafeUrl('http://198.51.100.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 203.0.113.x (documentation)', () => {
    expect(isSafeUrl('http://203.0.113.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 224.x.x.x multicast', () => {
    expect(isSafeUrl('http://224.0.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 239.x.x.x multicast', () => {
    expect(isSafeUrl('http://239.255.255.255/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 240.x.x.x reserved', () => {
    expect(isSafeUrl('http://240.0.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 255.x.x.x reserved', () => {
    expect(isSafeUrl('http://255.255.255.255/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 100.64.x.x CGNAT', () => {
    expect(isSafeUrl('http://100.64.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects 100.127.x.x CGNAT', () => {
    expect(isSafeUrl('http://100.127.0.1/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });

  // parseIPv4 null paths (non-IPv4 hostnames → isPrivateIPv4 returns false)
  it('allows public dotted hostname (3 parts, not IPv4)', () => {
    // parseIPv4('a.b.c') → null (3 parts), isPrivateIPv4 → false
    const r = isSafeUrl('http://a.b.c/');
    // Not blocked as private; should be allowed (ok: true)
    expect(r.ok).toBe(true);
  });
  it('allows non-numeric IPv4-like hostname', () => {
    // parseIPv4('a.b.c.d') → null (NaN), isPrivateIPv4 → false
    const r = isSafeUrl('http://a.b.c.d/');
    expect(r.ok).toBe(true);
  });
  // 172.15 is NOT in the private range (only 172.16-172.31)
  it('allows 172.15.x.x (outside RFC1918 range)', () => {
    expect(isSafeUrl('http://172.15.0.1/')).toMatchObject({ ok: true });
  });
  it('allows 172.32.x.x (outside RFC1918 range)', () => {
    expect(isSafeUrl('http://172.32.0.1/')).toMatchObject({ ok: true });
  });
  it('allows 100.63.x.x (below CGNAT range)', () => {
    expect(isSafeUrl('http://100.63.0.1/')).toMatchObject({ ok: true });
  });
  it('allows 100.128.x.x (above CGNAT range)', () => {
    expect(isSafeUrl('http://100.128.0.1/')).toMatchObject({ ok: true });
  });

  // IPv6 literals
  it('rejects ::1 IPv6 loopback', () => {
    expect(isSafeUrl('http://[::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects fe80:: link-local IPv6', () => {
    expect(isSafeUrl('http://[fe80::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects fe90:: link-local IPv6 (fe[89ab])', () => {
    expect(isSafeUrl('http://[fe90::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects fea0:: link-local IPv6', () => {
    expect(isSafeUrl('http://[fea0::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects feb0:: link-local IPv6', () => {
    expect(isSafeUrl('http://[feb0::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects ff00:: multicast IPv6', () => {
    expect(isSafeUrl('http://[ff00::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects fc00:: unique local IPv6', () => {
    expect(isSafeUrl('http://[fc00::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects fd00:: unique local IPv6', () => {
    expect(isSafeUrl('http://[fd00::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects :: (unspecified IPv6 address)', () => {
    expect(isSafeUrl('http://[::]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });
  it('rejects other IPv6 literals (2001:db8::)', () => {
    expect(isSafeUrl('http://[2001:db8::1]/')).toEqual({ ok: false, reason: 'host points to private/reserved/metadata endpoint' });
  });

  // Allowed URLs
  it('allows public HTTP URL', () => {
    expect(isSafeUrl('http://example.com/path')).toEqual({ ok: true, url: 'http://example.com/path' });
  });
  it('allows public HTTPS URL', () => {
    expect(isSafeUrl('https://thepiratebay.org/search')).toEqual({ ok: true, url: 'https://thepiratebay.org/search' });
  });
  it('allows URL with port', () => {
    expect(isSafeUrl('https://tracker.example.com:8080/announce')).toMatchObject({ ok: true });
  });
  it('trims whitespace from input', () => {
    expect(isSafeUrl('  https://example.com/  ')).toMatchObject({ ok: true });
  });
});

// ── assertSafeUrl ─────────────────────────────────────────────────────────────

describe('assertSafeUrl', () => {
  it('returns URL for safe URLs', () => {
    expect(assertSafeUrl('https://example.com/')).toBe('https://example.com/');
  });
  it('throws for unsafe URLs', () => {
    expect(() => assertSafeUrl('http://localhost/')).toThrow('Unsafe URL');
  });
  it('throws with reason in message', () => {
    expect(() => assertSafeUrl('')).toThrow('empty url');
  });
});
