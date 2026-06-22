import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { buildInstallInstances } from './installBuilder';

function mockReq(body: Record<string, string>): Request {
  return {
    method: 'POST',
    body,
    protocol: 'https',
    get: (h: string) => (h === 'host' ? 'addon.test' : undefined),
  } as unknown as Request;
}

describe('buildInstallInstances catalog selection', () => {
  it('includes main XXX and Trans bases when submitted alongside studio bases', () => {
    const result = buildInstallInstances(mockReq({
      src_piratebay: '1',
      cat_xxx: '1',
      cat_xxx_trans: '1',
      cat_xxx_studio_vixen: '1',
    }));

    const names = result.instances[0]?.names ?? [];
    expect(names.some((n) => n.startsWith('XXX '))).toBe(true);
    expect(names.some((n) => n.startsWith('Trans '))).toBe(true);
    expect(names.some((n) => n.includes('Vixen'))).toBe(true);
  });

  it('omits main catalogs when only studio cat_ fields are posted', () => {
    const result = buildInstallInstances(mockReq({
      src_piratebay: '1',
      cat_xxx_studio_vixen: '1',
    }));

    const names = result.instances[0]?.names ?? [];
    expect(names.some((n) => n.startsWith('XXX '))).toBe(false);
    expect(names.some((n) => n.startsWith('Trans '))).toBe(false);
    expect(names.some((n) => n.includes('Vixen'))).toBe(true);
  });
});
