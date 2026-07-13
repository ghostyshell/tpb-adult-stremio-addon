import { describe, it, expect } from 'vitest';
import { countSelectedCatalogs, buildInstanceNote } from './installCountNote';

const KEYS = [{ field: 'rdKey', inputId: 'rd' }, { field: 'tbKey', inputId: 'tb' }];

describe('countSelectedCatalogs', () => {
  it('counts checked hidden bases + checked studio entries', () => {
    const hidden = [{ base: 'xxx', orientation: 'straight', defaultChecked: true }, { base: 'gay', orientation: 'gay', defaultChecked: false }];
    const checks = { xxx: true, gay: false, vixen4k: true, vixen_fhd: false };
    const groups = [{ entries: [{ base: 'vixen4k' }, { base: 'vixen_fhd' }] }];
    expect(countSelectedCatalogs(hidden, checks, groups)).toBe(2);
  });
});

describe('buildInstanceNote', () => {
  it('renders a single add-on when total <= 1 (no providers, falls back to totalBases=1)', () => {
    const note = buildInstanceNote(KEYS, {}, 0, 1, 30);
    expect(note.warn).toBe(false);
    expect(note.html).toBe('This will generate <strong>1 add-on</strong> to install.');
  });

  it('warns and multiplies providers x catalog parts', () => {
    const tokens = { rdKey: 'abc', tbKey: 'def' }; // 2 providers
    // selectedCatalogs=0 falls back to totalBases=80; maxBases=30 -> ceil(80/30)=3 groups
    const note = buildInstanceNote(KEYS, tokens, 0, 80, 30);
    expect(note.warn).toBe(true);
    expect(note.html).toContain('<strong>6 add-ons</strong>');
    expect(note.html).toContain('2 debrid providers');
    expect(note.html).toContain('3 catalog parts');
  });

  it('uses selectedCatalogs when non-zero', () => {
    const tokens = { rdKey: 'abc' }; // 1 provider
    // 45 catalogs / 30 maxBases = 2 groups, 1 provider -> 2 total
    const note = buildInstanceNote(KEYS, tokens, 45, 80, 30);
    expect(note.warn).toBe(true);
    expect(note.html).toContain('<strong>2 add-ons</strong>');
    expect(note.html).not.toContain('debrid providers');
  });
});