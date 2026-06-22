import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import {
  detectQuality, qualityTag, parseTorrentTitle, buildTorrentKey,
  extractInfoHash, buildMagnet, encodeItemId, decodeItemId, decodeGroupId,
  shortHash, parseInfoHashFromTorrentBuffer, fetchInfoHashFromTorrentUrl,
  isPornripsUrl, pornripsSlug, stableMetaId, encodeMediaFlowProxyUrl,
} from './torrent';
import axios from 'axios';

// ── detectQuality ────────────────────────────────────────────────────────────

describe('detectQuality', () => {
  it.each([
    ['Movie 2160p BluRay', '2160p'],
    ['Movie 4K BluRay', '2160p'],
    ['Movie UHD BluRay', '2160p'],
    ['Movie Ultra.HD BluRay', '2160p'],
    ['Movie 1080p BluRay', '1080p'],
    ['Movie FHD BluRay', '1080p'],
    ['Movie Full.HD BluRay', '1080p'],
    ['Movie 720p BluRay', '720p'],
    ['Movie HD BluRay', '720p'],
    ['Movie 480p WEB', '480p'],
    ['Movie SD WEB', '480p'],
    ['Movie Title', 'unknown'],
  ])('detects %s → %s', (name, expected) => {
    expect(detectQuality(name)).toBe(expected);
  });
});

// ── qualityTag ───────────────────────────────────────────────────────────────

describe('qualityTag', () => {
  it('builds full tag with quality HDR codec source', () => {
    expect(qualityTag('Movie 2160p HDR10 x265 BluRay')).toBe('2160p HDR10 X265 BLURAY');
  });
  it('builds tag with quality only', () => {
    expect(qualityTag('Movie 1080p')).toBe('1080p');
  });
  it('adds HDR without quality', () => {
    expect(qualityTag('Movie Dolby.Vision release')).toContain('DOLBY.VISION');
  });
  it('adds codec without quality', () => {
    expect(qualityTag('Movie x264 release')).toContain('X264');
  });
  it('adds source without quality', () => {
    expect(qualityTag('Movie Web-DL release')).toContain('WEB-DL');
  });
  it('returns Unknown when no patterns match', () => {
    expect(qualityTag('Some Random Title Here')).toBe('Unknown');
  });
  it('handles webrip source', () => {
    expect(qualityTag('Movie 720p WEBRip')).toBe('720p WEBRIP');
  });
  it('handles av1 codec', () => {
    expect(qualityTag('Movie 1080p AV1')).toBe('1080p AV1');
  });
  it('handles hlg hdr', () => {
    expect(qualityTag('Movie 4K HLG')).toBe('2160p HLG');
  });
  it('handles remux source', () => {
    expect(qualityTag('Movie 4K Remux')).toBe('2160p REMUX');
  });
});

// ── parseTorrentTitle ────────────────────────────────────────────────────────

describe('parseTorrentTitle', () => {
  it('extracts title and year from dotted name', () => {
    expect(parseTorrentTitle('Movie.Name.2023.2160p.UHD.BluRay.x265')).toEqual({
      title: 'Movie Name',
      year: '2023',
    });
  });
  it('handles underscores as separators', () => {
    expect(parseTorrentTitle('Movie_Title_2020_1080p')).toEqual({
      title: 'Movie Title',
      year: '2020',
    });
  });
  it('strips quality without year', () => {
    const r = parseTorrentTitle('Movie.Title.1080p.BluRay');
    expect(r.title).toBe('Movie Title');
    expect(r.year).toBeNull();
  });
  it('returns full title when no year or quality', () => {
    const r = parseTorrentTitle('Plain Title');
    expect(r.title).toBe('Plain Title');
    expect(r.year).toBeNull();
  });
  it('handles 19xx year', () => {
    expect(parseTorrentTitle('Classic.Movie.1994.BluRay')).toEqual({
      title: 'Classic Movie',
      year: '1994',
    });
  });
  it('handles empty name (stripped || cleaned fallback)', () => {
    const r = parseTorrentTitle('');
    expect(r.title).toBe('');
    expect(r.year).toBeNull();
  });
  it('collapses multiple spaces', () => {
    const r = parseTorrentTitle('Movie..Title');
    expect(r.title).toBe('Movie Title');
  });
});

// ── buildTorrentKey ──────────────────────────────────────────────────────────

describe('buildTorrentKey', () => {
  it('prefixes with lowercase website', () => {
    expect(buildTorrentKey('TPB', 'Some Title 2023')).toBe('tpb:some-title-2023');
  });
  it('returns key without prefix when website is empty', () => {
    expect(buildTorrentKey('', 'Some Title')).toBe('some-title');
  });
  it('replaces slashes and colons', () => {
    expect(buildTorrentKey('site', 'A/B:C')).toBe('site:a-b-c');
  });
  it('replaces backslashes', () => {
    expect(buildTorrentKey('site', 'A\\B')).toBe('site:a-b');
  });
});

// ── extractInfoHash ──────────────────────────────────────────────────────────

describe('extractInfoHash', () => {
  it('returns null for null input', () => {
    expect(extractInfoHash(null)).toBeNull();
  });
  it('returns null for undefined input', () => {
    expect(extractInfoHash(undefined)).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(extractInfoHash('')).toBeNull();
  });
  it('returns null when no btih in magnet', () => {
    expect(extractInfoHash('magnet:?xt=urn:something:abc&dn=Name')).toBeNull();
  });
  it('extracts 40-char hex hash', () => {
    const hash = 'a'.repeat(40);
    expect(extractInfoHash(`magnet:?xt=urn:btih:${hash}&dn=Title`)).toBe(hash);
  });
  it('lowercases hex hash', () => {
    const hash = 'ABCDEF1234567890ABCDEF1234567890ABCDEF12';
    expect(extractInfoHash(`magnet:?xt=urn:btih:${hash}&dn=Title`)).toBe(hash.toLowerCase());
  });
  it('decodes valid base32 hash to hex', () => {
    // AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA... 32 chars of base32 A = all zeros in hex
    const base32 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4'; // 32 chars, valid base32
    const result = extractInfoHash(`magnet:?xt=urn:btih:${base32}&dn=Title`);
    expect(result).toBeTruthy();
    expect(result).toHaveLength(40);
  });
});

// ── buildMagnet ──────────────────────────────────────────────────────────────

describe('buildMagnet', () => {
  it('builds magnet URI', () => {
    const m = buildMagnet('abc123', 'My Movie');
    expect(m).toBe('magnet:?xt=urn:btih:abc123&dn=My%20Movie');
  });
  it('handles empty display name', () => {
    const m = buildMagnet('abc123', '');
    expect(m).toBe('magnet:?xt=urn:btih:abc123&dn=');
  });
});

// ── encodeItemId / decodeItemId ───────────────────────────────────────────────

describe('encodeItemId / decodeItemId', () => {
  it('round-trips a full record with short keys', () => {
    const record = { h: 'hash1', t: 'title', u: 'http://t.com/a.torrent', w: 'tpb' };
    const id = encodeItemId(record);
    expect(id).toMatch(/^jstrm:/);
    expect(decodeItemId(id)).toMatchObject(record);
  });
  it('falls back to long-form keys', () => {
    const record = { infoHash: 'hash2', title: 'My Title', torrentUrl: 'http://x.com/b.torrent', website: 'tpb' };
    const id = encodeItemId(record);
    const decoded = decodeItemId(id);
    expect(decoded?.h).toBe('hash2');
    expect(decoded?.t).toBe('My Title');
  });
  it('includes detailUrl when present (short key)', () => {
    const record = { h: 'h', t: 't', u: 'u', w: 'w', d: 'http://detail.com' };
    const id = encodeItemId(record);
    expect(decodeItemId(id)?.d).toBe('http://detail.com');
  });
  it('includes detailUrl when present (long key)', () => {
    const record = { h: 'h', t: 't', u: 'u', w: 'w', detailUrl: 'http://detail.com' };
    const id = encodeItemId(record);
    expect(decodeItemId(id)?.d).toBe('http://detail.com');
  });
  it('includes q when present (short key)', () => {
    const id = encodeItemId({ h: 'h', t: 't', u: 'u', w: 'w', q: '4k' });
    expect(decodeItemId(id)?.q).toBe('4k');
  });
  it('includes q when present (long key)', () => {
    const id = encodeItemId({ h: 'h', t: 't', u: 'u', w: 'w', quality: 'fhd' });
    expect(decodeItemId(id)?.q).toBe('fhd');
  });
  it('omits q when absent', () => {
    const id = encodeItemId({ h: 'h', t: 't', u: 'u', w: 'w' });
    expect(decodeItemId(id)?.q).toBeUndefined();
  });
  it('omits d key when no detailUrl', () => {
    const id = encodeItemId({ h: 'h', t: 't', u: '', w: '' });
    expect(decodeItemId(id)?.d).toBeUndefined();
  });
  it('falls back to empty strings', () => {
    const id = encodeItemId({});
    const decoded = decodeItemId(id);
    expect(decoded?.h).toBe('');
    expect(decoded?.t).toBe('');
  });

  it('decodeItemId returns null for empty string', () => {
    expect(decodeItemId('')).toBeNull();
  });
  it('decodeItemId returns null for non-jstrm id', () => {
    expect(decodeItemId('tt12345')).toBeNull();
  });
  it('decodeItemId returns null for corrupted payload', () => {
    expect(decodeItemId('jstrm:!!!notbase64!!!')).toBeNull();
  });
});

// ── decodeGroupId ────────────────────────────────────────────────────────────

describe('decodeGroupId', () => {
  it('decodes a multi-member group payload', () => {
    // Build a jstrg: id from two member records (4K + 1080p of one scene).
    const members = [
      { h: 'hash4k', t: 'Vixen - Scene 2160p', u: 'http://t/4k.torrent', w: 'tpb', q: '4k' },
      { h: 'hash1080', t: 'Vixen - Scene 1080p', u: 'http://t/1080.torrent', w: 'tpb', q: 'fhd' },
    ];
    const b64 = Buffer.from(JSON.stringify(members)).toString('base64url');
    const decoded = decodeGroupId(`jstrg:${b64}`);
    expect(decoded).toHaveLength(2);
    expect(decoded?.[0].h).toBe('hash4k');
    expect(decoded?.[0].q).toBe('4k');
    expect(decoded?.[1].q).toBe('fhd');
  });
  it('decodes a single-member group', () => {
    const b64 = Buffer.from(JSON.stringify([{ h: 'h', t: 't', u: 'u', w: 'w' }])).toString('base64url');
    expect(decodeGroupId(`jstrg:${b64}`)).toHaveLength(1);
  });
  it('returns null for empty string', () => {
    expect(decodeGroupId('')).toBeNull();
  });
  it('returns null for non-jstrg id', () => {
    expect(decodeGroupId('jstrm:abc')).toBeNull();
  });
  it('returns null for corrupted payload', () => {
    expect(decodeGroupId('jstrg:!!!notbase64!!!')).toBeNull();
  });
  it('returns null when payload is not an array', () => {
    const b64 = Buffer.from(JSON.stringify({ h: 'h', t: 't' })).toString('base64url');
    expect(decodeGroupId(`jstrg:${b64}`)).toBeNull();
  });
});

// ── shortHash ────────────────────────────────────────────────────────────────

describe('shortHash', () => {
  it('returns 16-char hex string', () => {
    expect(shortHash('hello')).toHaveLength(16);
    expect(shortHash('hello')).toMatch(/^[0-9a-f]{16}$/);
  });
  it('is deterministic', () => {
    expect(shortHash('same')).toBe(shortHash('same'));
  });
  it('differs for different inputs', () => {
    expect(shortHash('a')).not.toBe(shortHash('b'));
  });
});

// ── parseInfoHashFromTorrentBuffer ────────────────────────────────────────────

function buildTorrentBuf(infoContent: string): Buffer {
  // Outer dict: d 4:info <infoContent> e
  return Buffer.from(`d4:info${infoContent}e`);
}

describe('parseInfoHashFromTorrentBuffer', () => {
  it('returns empty for empty buffer', () => {
    expect(parseInfoHashFromTorrentBuffer(Buffer.from(''))).toBe('');
  });

  it('returns empty for buffer > 20 MB', () => {
    const big = Buffer.alloc(21 * 1024 * 1024);
    expect(parseInfoHashFromTorrentBuffer(big)).toBe('');
  });

  it('returns empty when no info key', () => {
    expect(parseInfoHashFromTorrentBuffer(Buffer.from('d4:name4:teste'))).toBe('');
  });

  it('returns empty when info value is not a dict', () => {
    // info value is an integer, not a dict
    const buf = Buffer.from('d4:infoi42ee');
    expect(parseInfoHashFromTorrentBuffer(buf)).toBe('');
  });

  it('returns sha1 of info dict for valid torrent buffer', () => {
    const infoStr = 'd4:name4:test6:lengthi100ee';
    const buf = buildTorrentBuf(infoStr);
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(result).toHaveLength(40);
    expect(result).toMatch(/^[0-9a-f]{40}$/);
    // Verify it matches the expected sha1
    const key = Buffer.from('4:info');
    const start = buf.indexOf(key) + key.length;
    const expected = crypto.createHash('sha1').update(buf.subarray(start, buf.length - 1)).digest('hex');
    expect(result).toBe(expected);
  });

  it('handles info dict with integer values (int branch in skipBencodeValue)', () => {
    const infoStr = 'd6:lengthi12345e4:name4:testee';
    // Wait - need proper nesting: info dict with length integer and name string
    const buf = buildTorrentBuf('d6:lengthi12345e4:name4:testee');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(result).toHaveLength(40);
  });

  it('handles info dict with list values (list branch in skipBencodeValue)', () => {
    // info dict with a list value
    const buf = buildTorrentBuf('d5:filesl4:fileeee');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(result).toHaveLength(40);
  });

  it('handles malformed integer with no closing e (end<0 ternary branch)', () => {
    // No 'e' bytes after the 'i' - forces end<0 path in int branch
    const buf = Buffer.from('d4:infod5:counti42');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(typeof result).toBe('string');
  });

  it('handles byte string with no colon (colon<0 branch)', () => {
    // '3xxx' starts with digit but has no ':' after it in buffer
    const buf = Buffer.from('d4:infod4:name3xxx');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(typeof result).toBe('string');
  });

  it('handles byte string with non-digit before colon (!^\\d+$ branch)', () => {
    // 'a:text' - letter before colon fails digit-only check
    const buf = Buffer.from('d4:infod4:namea:textee');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(typeof result).toBe('string');
  });

  it('handles byte string claiming length beyond buffer (overflow branch)', () => {
    // '9:x' claims 9 bytes but only 1 char follows in buffer
    const buf = Buffer.from('d4:infod4:name9:xee');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(typeof result).toBe('string');
  });

  it('handles deeply nested info dict (depth limit branch)', () => {
    // 34 levels of nesting to trigger depth > MAX_BENCODE_DEPTH (32)
    const leaf = '4:name4:test';
    let inner = `d${leaf}e`;
    for (let i = 0; i < 33; i++) inner = `d1:a${inner}e`;
    const buf = buildTorrentBuf(inner);
    // Must not crash, may return '' or a hash
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(typeof result).toBe('string');
  });

  it('handles empty info dict', () => {
    const buf = buildTorrentBuf('de');
    const result = parseInfoHashFromTorrentBuffer(buf);
    expect(result).toHaveLength(40);
  });
});

// ── fetchInfoHashFromTorrentUrl ───────────────────────────────────────────────

describe('fetchInfoHashFromTorrentUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty for empty URL', async () => {
    expect(await fetchInfoHashFromTorrentUrl('', undefined)).toBe('');
  });
  it('returns empty for non-torrent URL', async () => {
    expect(await fetchInfoHashFromTorrentUrl('http://example.com/file.zip', undefined)).toBe('');
  });
  it('returns empty for unsafe host', async () => {
    expect(await fetchInfoHashFromTorrentUrl('http://localhost/file.torrent', undefined)).toBe('');
  });
  it('returns empty for URL with query params but no .torrent', async () => {
    expect(await fetchInfoHashFromTorrentUrl('http://example.com/dl?id=1', undefined)).toBe('');
  });

  it('fetches and parses a valid torrent URL', async () => {
    const infoStr = 'd4:name4:test6:lengthi100ee';
    const torrentBuf = buildTorrentBuf(infoStr);
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: torrentBuf });

    const result = await fetchInfoHashFromTorrentUrl('http://example.com/file.torrent', undefined);
    expect(result).toHaveLength(40);
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });

  it('sends Referer header when provided', async () => {
    const infoStr = 'd4:name4:test6:lengthi100ee';
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: buildTorrentBuf(infoStr) });

    await fetchInfoHashFromTorrentUrl('http://example.com/file.torrent', 'http://example.com');
    const callArgs = (axios.get as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers.Referer).toBe('http://example.com');
  });

  it('handles .torrent?query URL', async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: buildTorrentBuf('d4:name4:teste') });
    const result = await fetchInfoHashFromTorrentUrl('http://example.com/file.torrent?key=1', undefined);
    expect(result).toHaveLength(40);
  });
});

// ── isPornripsUrl ─────────────────────────────────────────────────────────────

describe('isPornripsUrl', () => {
  it('returns true for pornrips.to URL', () => {
    expect(isPornripsUrl('https://pornrips.to/some-release/')).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(isPornripsUrl('https://PornRips.TO/some-release/')).toBe(true);
  });
  it('returns false for other URLs', () => {
    expect(isPornripsUrl('https://example.com/')).toBe(false);
  });
  it('returns false for null', () => {
    expect(isPornripsUrl(null)).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(isPornripsUrl(undefined)).toBe(false);
  });
});

// ── pornripsSlug ──────────────────────────────────────────────────────────────

describe('pornripsSlug', () => {
  it('extracts slug from pornrips URL', () => {
    expect(pornripsSlug('https://pornrips.to/some-release-1080p-prt/')).toBe('some-release-1080p-prt');
  });
  it('returns empty for non-pornrips URL', () => {
    expect(pornripsSlug('https://example.com/page')).toBe('');
  });
  it('returns empty for null', () => {
    expect(pornripsSlug(null)).toBe('');
  });
  it('returns empty for empty string', () => {
    expect(pornripsSlug('')).toBe('');
  });
  it('stops slug at query string', () => {
    expect(pornripsSlug('https://pornrips.to/slug?foo=bar')).toBe('slug');
  });
  it('stops slug at fragment', () => {
    expect(pornripsSlug('https://pornrips.to/slug#section')).toBe('slug');
  });
});

// ── stableMetaId ─────────────────────────────────────────────────────────────

describe('stableMetaId', () => {
  it('returns pr:<slug> for pornrips with a valid detailUrl', () => {
    expect(stableMetaId({ website: 'pornrips', detailUrl: 'https://pornrips.to/my-release/', infoHash: 'ignored' }))
      .toBe('pr:my-release');
  });
  it('returns empty for pornrips with no detailUrl', () => {
    expect(stableMetaId({ website: 'pornrips', detailUrl: '', infoHash: 'ih' })).toBe('');
  });
  it('returns infoHash for non-pornrips', () => {
    expect(stableMetaId({ website: 'tpb', infoHash: 'abc123' })).toBe('abc123');
  });
  it('returns empty for non-pornrips with no infoHash', () => {
    expect(stableMetaId({ website: 'tpb' })).toBe('');
  });
  it('handles missing argument', () => {
    expect(stableMetaId()).toBe('');
  });
});

// ── encodeMediaFlowProxyUrl ───────────────────────────────────────────────────

describe('encodeMediaFlowProxyUrl', () => {
  it('builds proxy URL without trailing slash', () => {
    const url = encodeMediaFlowProxyUrl('http://proxy:8888', 'http://cdn.com/stream', 'secret', {});
    expect(url).toBe('http://proxy:8888/proxy/stream?d=http%3A%2F%2Fcdn.com%2Fstream&api_password=secret');
  });
  it('removes trailing slash from proxyUrl', () => {
    const url = encodeMediaFlowProxyUrl('http://proxy:8888/', 'http://cdn.com/s', 'pw', {});
    expect(url).toContain('http://proxy:8888/proxy/stream');
  });
  it('adds response headers with r_ prefix', () => {
    const url = encodeMediaFlowProxyUrl('http://proxy', 'http://cdn.com/s', 'pw', {
      'X-Custom': 'value',
    });
    expect(url).toContain('r_X-Custom=value');
  });
  it('skips response headers block when null', () => {
    // TypeScript allows null at runtime even though type says Record<string,string>
    const url = encodeMediaFlowProxyUrl('http://proxy', 'http://cdn.com/s', 'pw', null as any);
    expect(url).not.toContain('r_');
  });
});
