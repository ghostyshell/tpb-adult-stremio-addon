import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  getStripchatPdkeys,
  resetStripchatPdkeysCache,
  pickStripchatPkey,
  resolveStripchatPdkey,
  decryptMouflonUri,
  decodeMouflonPlaylist,
} from './stripchatMouflon';

const TEST_PDKEYS = {
  PD_KEY_1: 'Ook7quaiNgiyuhai:EQueeGh2kaewa3ch',
  PD_KEY_2: 'Zeechoej4aleeshi:ubahjae7goPoodi6',
};

beforeEach(() => {
  vi.stubEnv('PD_KEY_1', TEST_PDKEYS.PD_KEY_1);
  vi.stubEnv('PD_KEY_2', TEST_PDKEYS.PD_KEY_2);
  resetStripchatPdkeysCache();
});

describe('getStripchatPdkeys', () => {
  it('loads pkey:pdkey pairs from PD_KEY_* env vars', () => {
    expect(getStripchatPdkeys()).toEqual({
      Ook7quaiNgiyuhai: 'EQueeGh2kaewa3ch',
      Zeechoej4aleeshi: 'ubahjae7goPoodi6',
    });
  });
});

describe('pickStripchatPkey', () => {
  it('prefers a pkey we can decrypt', () => {
    const m3u8 = [
      '#EXT-X-MOUFLON:PSCH:v2:1Dzcc6OjP73LKbtI',
      '#EXT-X-MOUFLON:PSCH:v2:Ook7quaiNgiyuhai',
    ].join('\n');
    expect(pickStripchatPkey(m3u8)).toBe('Ook7quaiNgiyuhai');
  });
});

describe('resolveStripchatPdkey', () => {
  it('maps known pkeys', () => {
    expect(resolveStripchatPdkey('Ook7quaiNgiyuhai')).toBe('EQueeGh2kaewa3ch');
    expect(resolveStripchatPdkey('unknown')).toBeNull();
  });
});

describe('decodeMouflonPlaylist', () => {
  it('replaces placeholder segment lines with decrypted MOUFLON URIs', () => {
    const encrypted = 'https://media-hls.doppiocdn.com/b-hls-16/94190182/94190182_1536_gjJHf3ZVwpfKPh9k7v97V2_1782130340.mp4';
    const pdkey = 'EQueeGh2kaewa3ch';
    const decrypted = decryptMouflonUri(encrypted, pdkey);
    expect(decrypted).toBe('https://media-hls.doppiocdn.com/b-hls-16/94190182/94190182_1536_wOwbVLqyDRL5NYgC_1782130340.mp4');

    const input = [
      '#EXTM3U',
      `#EXT-X-MOUFLON:URI:${encrypted}`,
      'https://media-hls.doppiocdn.com/b-hls-16/media.mp4',
    ].join('\n');
    const out = decodeMouflonPlaylist(input, pdkey);
    expect(out).toContain(decrypted!);
    expect(out).not.toContain('media.mp4');
    expect(out).not.toContain('#EXT-X-MOUFLON:URI:');
  });
});
