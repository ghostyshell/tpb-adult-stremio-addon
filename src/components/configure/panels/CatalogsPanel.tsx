// CatalogsPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import type { ConfigureProps } from '../../../lib/configureProps';
import { ToggleRow } from '../ToggleRow';
import { ChevIcon, SearchIcon } from '../configureUiData';

interface CatalogsPanelProps {
  activeTab: string;
  ctRecent: boolean;
  setCtRecent: React.Dispatch<React.SetStateAction<boolean>>;
  ctTop: boolean;
  setCtTop: React.Dispatch<React.SetStateAction<boolean>>;
  qual4k: boolean;
  qual1080p: boolean;
  trans4k: boolean;
  trans1080p: boolean;
  setQuality: (quality: '4k' | '1080p', checked: boolean) => void;
  setTransQuality: (quality: '4k' | '1080p', checked: boolean) => void;
  compactStudios: boolean;
  setCompactStudios: React.Dispatch<React.SetStateAction<boolean>>;
  studioSearch: string;
  setStudioSearch: React.Dispatch<React.SetStateAction<string>>;
  studioGroups: ConfigureProps['studioGroups'];
  catalogChecks: Record<string, boolean>;
  setCatalogCheck: (base: string, checked: boolean) => void;
  setAllStudios: (checked: boolean) => void;
  setStudiosByQuality: (quality: '4k' | 'fhd', checked: boolean) => void;
  setStudioGroupByQuality: (group: string, quality: '4k' | 'fhd', checked: boolean) => void;
  collapsedGroups: Set<string>;
  toggleGroupCollapsed: (key: string) => void;
  studioEnabledCount: number;
  studioTotal: number;
  maintenance?: boolean;
  down?: boolean;
}

function StudioGroup({
  g, studioSearch, catalogChecks, setCatalogCheck, setStudioGroupByQuality, collapsedGroups, toggleGroupCollapsed,
}: {
  g: ConfigureProps['studioGroups'][number];
  studioSearch: string;
  catalogChecks: Record<string, boolean>;
  setCatalogCheck: (base: string, checked: boolean) => void;
  setStudioGroupByQuality: (group: string, quality: '4k' | 'fhd', checked: boolean) => void;
  collapsedGroups: Set<string>;
  toggleGroupCollapsed: (key: string) => void;
}) {
  const has4k = g.entries.some((e) => !e.isFhd);
  const hasFhd = g.entries.some((e) => e.isFhd);
  const collapsed = collapsedGroups.has(g.key);
  return (
    <div key={g.key} className={`studio-group${collapsed ? ' collapsed' : ''}`}>
      <div className="studio-group-hdr">
        <button type="button" className="studio-group-toggle" aria-expanded={!collapsed} onClick={() => toggleGroupCollapsed(g.key)}>
          <svg className="chev" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          <span className="studio-group-title">{g.title} <span className="studio-count">{g.entries.length}</span></span>
        </button>
        <div className="studio-group-btns">
          {has4k ? <button type="button" className="btn-ghost" onClick={() => setStudioGroupByQuality(g.key, '4k', true)}>Enable 4K</button> : null}
          {hasFhd ? <button type="button" className="btn-ghost" onClick={() => setStudioGroupByQuality(g.key, 'fhd', true)}>Enable 1080p</button> : null}
        </div>
      </div>
      <div className="sw-list studio-list">
        {g.entries.map((e) => {
          const q = studioSearch.toLowerCase();
          const hidden = q && !e.baseName.toLowerCase().includes(q);
          return (
            <div key={e.base} className={`sw-row studio-row${hidden ? ' hidden' : ''}`} data-group={g.key} data-quality={e.isFhd ? 'fhd' : '4k'} data-label={e.baseName}>
              <div className="sw-row-body">
                <div className="sw-row-text"><div className="sw-row-title">{e.baseName}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`studio-badge ${e.isFhd ? 'badge-fhd' : 'badge-4k'}`}>{e.isFhd ? '1080p' : '4K'}</span>
                <label className="sw-wrap" htmlFor={`cat_${e.base}`}>
                  <input
                    type="checkbox"
                    id={`cat_${e.base}`}
                    name={`cat_${e.base}`}
                    value="1"
                    checked={catalogChecks[e.base] ?? false}
                    onChange={(ev) => setCatalogCheck(e.base, ev.target.checked)}
                  />
                  <span className="sw-track" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CatalogsPanel({
  activeTab, ctRecent, setCtRecent, ctTop, setCtTop, qual4k, qual1080p, trans4k, trans1080p,
  setQuality, setTransQuality, compactStudios, setCompactStudios, studioSearch, setStudioSearch,
  studioGroups, catalogChecks, setCatalogCheck, setAllStudios, setStudiosByQuality,
  setStudioGroupByQuality, collapsedGroups, toggleGroupCollapsed, studioEnabledCount, studioTotal,
  maintenance, down,
}: CatalogsPanelProps) {
  const maintBadge = maintenance ? <span className="src-badge src-maint">WIP</span> : null;
  const downBadge = down ? <span className="src-badge src-down">Down</span> : null;
  return (
    <div className={`panel${activeTab === 'catalogs' ? ' active' : ''}`} data-panel="catalogs">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg></div>
          <div><div className="card-title">Browse Modes{maintBadge}{downBadge}</div><div className="card-desc">Pick which catalog types appear in your Stremio sidebar.</div></div>
        </div>
        <div className="sw-list">
          <ToggleRow id="ct_recent" name="ct_recent" label="Recent" desc="Newest releases sorted by publish date" checked={ctRecent} onChange={setCtRecent} />
          <ToggleRow id="ct_top" name="ct_top" label="Top" desc="Most seeded releases" checked={ctTop} onChange={setCtTop} />
        </div>
      </div>

      <details className="card studio-card collapsible">
        <summary className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3.6" rx="1.8" /><rect x="3" y="10.2" width="18" height="3.6" rx="1.8" /><rect x="3" y="16.4" width="18" height="3.6" rx="1.8" /></svg></div>
          <div><div className="card-title">Quality &amp; Studios{maintBadge}{downBadge}</div><div className="card-desc">Choose which catalogs appear in Stremio. XXX 4K is enabled by default; individual studios are listed below.</div></div>
          <span className="card-chev"><ChevIcon /></span>
        </summary>
        <div className="sw-list">
          <ToggleRow id="qual_4k" name="cat_xxx" label="XXX 4K" desc="2160p / UHD catalog" checked={qual4k} onChange={(c) => setQuality('4k', c)} />
          <ToggleRow id="qual_1080p" name="cat_xxx_fhd" label="XXX 1080p" desc="Full HD (1080p) catalog" checked={qual1080p} onChange={(c) => setQuality('1080p', c)} />
          <ToggleRow id="trans_4k" name="cat_xxx_trans" label="Trans 4K" desc="2160p / UHD trans catalog" checked={trans4k} onChange={(c) => setTransQuality('4k', c)} />
          <ToggleRow id="trans_1080p" name="cat_xxx_trans_fhd" label="Trans 1080p" desc="Full HD (1080p) trans catalog" checked={trans1080p} onChange={(c) => setTransQuality('1080p', c)} />
          <ToggleRow id="compactStudios" name="compactStudios" label="Compact studio catalogs" desc="Install each selected studio as one catalog named just the studio (e.g. Vixen), merging its selected qualities and sorts. 1080p is included only when an 1080p studio row is checked; otherwise only 4K." checked={compactStudios} onChange={setCompactStudios} />
        </div>
        <div className="studio-section-label">Studios</div>
        <div className="studio-search-wrap">
          <SearchIcon />
          <input type="text" id="studioSearch" className="studio-search" placeholder="Search studios…" autoComplete="off" value={studioSearch} onChange={(e) => setStudioSearch(e.target.value)} />
        </div>
        <div className="studio-global-hdr">
          <span className="studio-global-count"><span id="studioEnabledCount">{studioEnabledCount}</span> of {studioTotal} enabled</span>
          <div className="studio-global-btns">
            <button type="button" className="btn-ghost" onClick={() => setStudiosByQuality('4k', true)}>Enable 4K</button>
            <button type="button" className="btn-ghost" onClick={() => setStudiosByQuality('fhd', true)}>Enable 1080p</button>
            <button type="button" className="btn-ghost" onClick={() => setAllStudios(false)}>Disable all</button>
          </div>
        </div>
        <div id="studioGroupsContainer">
          {studioGroups.map((g) => (
            <StudioGroup
              key={g.key}
              g={g}
              studioSearch={studioSearch}
              catalogChecks={catalogChecks}
              setCatalogCheck={setCatalogCheck}
              setStudioGroupByQuality={setStudioGroupByQuality}
              collapsedGroups={collapsedGroups}
              toggleGroupCollapsed={toggleGroupCollapsed}
            />
          ))}
        </div>
      </details>
    </div>
  );
}