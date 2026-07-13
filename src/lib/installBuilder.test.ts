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

// Decode the raw per-user config baked into a manifest URL (base64url + JSON),
// without the frontend's default-filling, so we can assert exactly what
// installBuilder encoded.
function rawCfg(manifestUrl: string): Record<string, unknown> {
  const m = manifestUrl.match(/\/([^/]+)\/manifest\.json$/);
  if (!m) throw new Error(`unexpected manifestUrl: ${manifestUrl}`);
  const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

describe('buildInstallInstances multi-part split', () => {
  it('pins XXX/Trans to part 1 and keeps studios globally alphabetical across parts', () => {
    // All piratebay bases (no cat_ selection) -> splits into 2+ parts.
    const result = buildInstallInstances(mockReq({ src_piratebay: '1' }));
    expect(result.groupTotal).toBeGreaterThan(1);

    const isMain = (n: string) => n.startsWith('XXX ') || n.startsWith('Trans ');

    // The backend sorts the main XXX/Trans browse catalogs into its first board
    // block, ahead of every studio. installBuilder must place them in part 1
    // (so they lead the whole board), never in a later part.
    const part0 = result.instances[0].names;
    expect(part0.some(isMain)).toBe(true);
    const firstStudioIdx = part0.findIndex((n) => !isMain(n));
    const lastMainIdx = part0.map(isMain).lastIndexOf(true);
    expect(firstStudioIdx).toBeGreaterThan(-1);
    expect(lastMainIdx).toBeLessThan(firstStudioIdx);
    for (let i = 1; i < result.instances.length; i++) {
      expect(result.instances[i].names.some(isMain)).toBe(false);
    }

    // Studio names concatenated across parts in install order are non-decreasing
    // (case-insensitive): the backend's per-part sort then composes a globally
    // alphabetical studio block across installed parts.
    const studios: string[] = [];
    for (const inst of result.instances) {
      studios.push(...inst.names.filter((n) => !isMain(n)).map((n) => n.toLowerCase()));
    }
    expect(studios.length).toBeGreaterThan(0);
    for (let i = 1; i < studios.length; i++) {
      expect(studios[i] >= studios[i - 1]).toBe(true);
    }
  });

  it('attaches TPDB/StashDB categories only to part 1 (no duplication)', () => {
    const result = buildInstallInstances(mockReq({
      src_piratebay: '1',
      enableTpdbCatalog: '1',
      enableStashdbCatalog: '1',
    }));
    expect(result.groupTotal).toBeGreaterThan(1);

    const part0 = rawCfg(result.instances[0].manifestUrl);
    const part1 = rawCfg(result.instances[1].manifestUrl);

    // Part 1 carries the resolved category arrays; parts 2..N carry an
    // explicit empty array so the backend (which emits TPDB/StashDB only when
    // len(categories) > 0) suppresses them there.
    expect(Array.isArray(part0.tpdbCategories)).toBe(true);
    expect((part0.tpdbCategories as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(part0.stashdbCategories)).toBe(true);
    expect((part0.stashdbCategories as unknown[]).length).toBeGreaterThan(0);
    expect(part1.tpdbCategories).toEqual([]);
    expect(part1.stashdbCategories).toEqual([]);
  });

  it('suppresses TPDB/StashDB on parts 2..N even when a key + default slugs are set', () => {
    // When the user keeps the default slugs AND provides a tpdbKey/stashdbKey,
    // installBuilder leaves part 1's field unset so the backend fills defaults
    // from the key (one emission on part 1). Parts 2..N must still send an
    // explicit empty array: omitting the field there would let the backend
    // fill defaults from the (shared) key on every part and re-emit TPDB/StashDB
    // across all parts. The empty array is what suppresses that.
    const result = buildInstallInstances(mockReq({
      src_piratebay: '1',
      enableTpdbCatalog: '1',
      tpdbKey: 'tok',
      enableStashdbCatalog: '1',
      stashdbKey: 'tok',
    }));
    expect(result.groupTotal).toBeGreaterThan(1);

    const part0 = rawCfg(result.instances[0].manifestUrl);
    expect(part0.tpdbCategories).toBeUndefined();
    expect(part0.stashdbCategories).toBeUndefined();

    for (let i = 1; i < result.instances.length; i++) {
      const cfg = rawCfg(result.instances[i].manifestUrl);
      expect(cfg.tpdbCategories).toEqual([]);
      expect(cfg.stashdbCategories).toEqual([]);
    }
  });
});

describe('buildInstallInstances tube sources (perverzija / freepornvideos)', () => {
  it('a tube-only install keeps both sources and does NOT force piratebay on', () => {
    // The piratebayOn fallback disjunction must include the tube sources, else a
    // perverzija+freepornvideos-only install would fall back to piratebay and
    // pull in the whole TPB catalog split.
    const result = buildInstallInstances(mockReq({
      src_perverzija: '1',
      src_freepornvideos: '1',
    }));
    expect(result.groupTotal).toBe(1);
    expect(result.instances).toHaveLength(1);

    const cfg = rawCfg(result.instances[0].manifestUrl);
    expect(cfg.sources).toEqual(['perverzija', 'freepornvideos']);
    // No piratebay bases on a tube-only install.
    expect(cfg.enabledCatalogs).toBeUndefined();
  });

  it('attaches tube catalogs to part 1 only and suppresses only unchecked ones', () => {
    // piratebay on (multi-part) + perverzija on with cat_pvz_studio UNCHECKED.
    // The other four pvz catalogs stay enabled; pvz_studio lands in
    // disabledCatalogs on part 1 only, never on parts 2..N.
    const result = buildInstallInstances(mockReq({
      src_piratebay: '1',
      src_perverzija: '1',
      cat_pvz_recent: '1',
      cat_pvz_tag: '1',
      cat_pvz_performer: '1',
      cat_pvz_search: '1',
      // cat_pvz_studio deliberately omitted -> disabled
    }));
    expect(result.groupTotal).toBeGreaterThan(1);

    const part0 = rawCfg(result.instances[0].manifestUrl);
    expect(part0.sources).toContain('perverzija');
    const disabled = part0.disabledCatalogs as string[];
    expect(disabled).toContain('pvz_studio');
    expect(disabled).not.toContain('pvz_recent');
    expect(disabled).not.toContain('pvz_search');

    for (let i = 1; i < result.instances.length; i++) {
      const cfg = rawCfg(result.instances[i].manifestUrl);
      expect(cfg.sources).not.toContain('perverzija');
      expect((cfg.disabledCatalogs as string[] ?? []).some((d) => d.startsWith('pvz_'))).toBe(false);
    }
  });

  it('emits display names per enabled tube catalog', () => {
    // Like pornrips, tube catalogs are opt-in per cat_ field (absent = disabled).
    const result = buildInstallInstances(mockReq({
      src_perverzija: '1',
      cat_pvz_recent: '1',
      cat_pvz_search: '1',
    }));
    const names = result.instances[0]?.names ?? [];
    expect(names).toContain('Perverzija · recent');
    expect(names).toContain('Perverzija · search');
    expect(names).not.toContain('Perverzija · studio');
  });
});
