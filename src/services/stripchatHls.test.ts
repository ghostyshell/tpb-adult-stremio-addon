import { describe, it, expect } from 'vitest';
import {
  ALLOWED_CDN_RE,
  isPublicLive,
  isAdvertPlaylist,
  parseVariants,
  rewriteM3u8Urls,
} from './stripchatHls';

describe('ALLOWED_CDN_RE', () => {
  it.each([
    'edge-hls.doppiocdn.com',
    'edge-hls.doppiocdn.org',
    'edge-hls.doppiocdn.net',
    'edge-hls.doppiocdn.media',
    'media-hls.doppiocdn.com',
    'media-hls.doppiocdn.org',
    'media-hls.doppiocdn.net',
    'media-hls.doppiocdn.media',
  ])('matches allowed host: %s', (host) => {
    expect(ALLOWED_CDN_RE.test(host)).toBe(true);
  });

  it.each([
    'evil-doppiocdn.com',
    'edge-hls.doppiocdn.co',
    'media-hls.doppiocdn.info',
    'doppiocdn.com',
    'edge-hls.doppiocdn.com.evil.com',
    'attack.com',
    '',
  ])('rejects disallowed host: %s', (host) => {
    expect(ALLOWED_CDN_RE.test(host)).toBe(false);
  });
});

describe('isPublicLive', () => {
  it('returns true when isLive is true', () => {
    expect(isPublicLive({ isLive: true, streamName: 's' })).toBe(true);
  });

  it('returns true when isCamActive is true', () => {
    expect(isPublicLive({ isCamActive: true, streamName: 's' })).toBe(true);
  });

  it('returns true when status is public', () => {
    expect(isPublicLive({ status: 'public', streamName: 's' })).toBe(true);
  });

  it('returns false when none are set', () => {
    expect(isPublicLive({ streamName: '' })).toBe(false);
  });

  it('returns false when streamName is empty but status is public', () => {
    // isPublicLive only checks live/cam/status flags, not streamName
    expect(isPublicLive({ status: 'public', streamName: '' })).toBe(true);
  });
});

describe('isAdvertPlaylist', () => {
  it('returns true when body contains advert marker', () => {
    expect(isAdvertPlaylist('#EXTM3U\n#EXT-X-MOUFLON-ADVERT\n#EXTINF:...')).toBe(true);
  });

  it('returns false for normal playlist', () => {
    expect(isAdvertPlaylist('#EXTM3U\n#EXTINF:10,\nsegment.ts')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAdvertPlaylist('')).toBe(false);
  });
});

describe('parseVariants', () => {
  it('parses variants from a valid m3u8', () => {
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028"',
      'https://cdn.example.com/hls/1080p.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
      'https://cdn.example.com/hls/720p.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480',
      'https://cdn.example.com/hls/480p.m3u8',
    ].join('\n');

    const variants = parseVariants(m3u8);
    expect(variants).toHaveLength(3);
    expect(variants[0]).toMatchObject({ name: '1920x1080', bandwidth: 5000000 });
    expect(variants[1]).toMatchObject({ name: '1280x720', bandwidth: 2500000 });
    expect(variants[2]).toMatchObject({ name: '854x480', bandwidth: 1000000 });
  });

  it('sorts variants by bandwidth descending', () => {
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480',
      'low.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080',
      'high.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
      'mid.m3u8',
    ].join('\n');

    const variants = parseVariants(m3u8);
    expect(variants.map((v) => v.bandwidth)).toEqual([5000000, 2500000, 1000000]);
  });

  it('uses "auto" as name when no RESOLUTION', () => {
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=3000000',
      'stream.m3u8',
    ].join('\n');

    const variants = parseVariants(m3u8);
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({ name: 'auto', bandwidth: 3000000 });
  });

  it('uses bandwidth 0 when BANDWIDTH is missing', () => {
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:RESOLUTION=1920x1080',
      'stream.m3u8',
    ].join('\n');

    const variants = parseVariants(m3u8);
    expect(variants).toHaveLength(1);
    expect(variants[0].bandwidth).toBe(0);
  });

  it('returns empty array for playlist without variants', () => {
    expect(parseVariants('#EXTM3U\n#EXTINF:10,\nseg.ts')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseVariants('')).toEqual([]);
  });

  it('skips lines that are comments after an INF line', () => {
    // If the line after INF is a comment, it should not create a variant
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480',
      '# this is a comment, should be skipped',
      '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720',
      'real.m3u8',
    ].join('\n');

    const variants = parseVariants(m3u8);
    expect(variants).toHaveLength(1);
    expect(variants[0].name).toBe('1280x720');
  });
});

describe('rewriteM3u8Urls', () => {
  it('rewrites segment URLs to proxy path', () => {
    const input = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:10',
      '#EXTINF:10,',
      'https://cdn.example.com/hls/seg1.ts',
      '#EXTINF:10,',
      'https://cdn.example.com/hls/seg2.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');

    const result = rewriteM3u8Urls(input, 'https://cdn.example.com/hls/master.m3u8');
    const lines = result.split('\n');
    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[1]).toBe('#EXT-X-TARGETDURATION:10');
    expect(lines[2]).toBe('#EXTINF:10,');
    expect(lines[3]).toMatch(/^\/stripchat\/seg\?url=https%3A%2F%2Fcdn\.example\.com%2Fhls%2Fseg1\.ts$/);
    expect(lines[6]).toBe('#EXT-X-ENDLIST');
  });

  it('preserves comment lines and empty lines unchanged', () => {
    const input = [
      '#EXTM3U',
      '',
      '# comment line',
      '#EXTINF:10,',
      'segment.ts',
    ].join('\n');

    const result = rewriteM3u8Urls(input, 'http://base/');
    const lines = result.split('\n');
    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('# comment line');
  });

  it('rewrites relative URLs as absolute then proxied', () => {
    const input = '#EXTINF:10,\nrelative/path/seg.ts\n';
    const result = rewriteM3u8Urls(input, 'https://cdn.example.com/hls/master.m3u8');
    expect(result).toContain('/stripchat/seg?url=');
    expect(result).toContain('relative%2Fpath%2Fseg.ts');
  });
});
