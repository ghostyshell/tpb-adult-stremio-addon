// PornripsPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import type { ConfigureProps } from '../../../lib/configureProps';
import { ToggleRow } from '../ToggleRow';
import { SearchIcon, ChevIcon } from '../configureUiData';

interface PornripsPanelProps {
  activeTab: string;
  prCatalogs: Record<string, boolean>;
  setPrCatalogs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  prStudioSearch: string;
  setPrStudioSearch: React.Dispatch<React.SetStateAction<string>>;
  prStudios: Record<string, boolean>;
  setPrStudios: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pornripsStudios: ConfigureProps['pornripsStudios'];
  prStudioEnabledCount: number;
  disabledPrStudiosRef: { current: HTMLInputElement | null };
  maintenance?: boolean;
  down?: boolean;
}

export function PornripsPanel({
  activeTab, prCatalogs, setPrCatalogs, prStudioSearch, setPrStudioSearch, prStudios, setPrStudios,
  pornripsStudios, prStudioEnabledCount, disabledPrStudiosRef, maintenance, down,
}: PornripsPanelProps) {
  const maintBadge = maintenance ? <span className="src-badge src-maint">WIP</span> : null;
  const downBadge = down ? <span className="src-badge src-down">Down</span> : null;
  return (
    <div className={`panel${activeTab === 'pornrips' ? ' active' : ''}`} data-panel="pornrips">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 5C6.4 5 1.7 8.4 0 12c1.7 3.6 6.4 7 12 7s10.3-3.4 12-7c-1.7-3.6-6.4-7-12-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" /></svg></div>
          <div><div className="card-title">Browse Modes{maintBadge}{downBadge}</div><div className="card-desc">Choose which browsing categories appear in your Stremio sidebar.</div></div>
        </div>
        <div className="sw-list">
          {(['pr_recent', 'pr_studio', 'pr_tag', 'pr_search'] as const).map((id) => (
            <ToggleRow
              key={id}
              id={`cat_${id}`}
              name={`cat_${id}`}
              label={id === 'pr_recent' ? 'Recent' : id === 'pr_studio' ? 'Studio' : id === 'pr_tag' ? 'Tag' : 'Search'}
              desc={id === 'pr_recent' ? 'Newest releases sorted by publish date' : id === 'pr_studio' ? 'Browse by network or individual site · Hidden from Home; pick a studio in Discover' : id === 'pr_tag' ? 'Browse by content tag · Hidden from Home; pick a tag in Discover' : 'Free-text search across PornRips · Search-only'}
              checked={prCatalogs[id]}
              onChange={(c) => setPrCatalogs((p) => ({ ...p, [id]: c }))}
            />
          ))}
        </div>
      </div>
      <details className="card studio-card collapsible">
        <summary className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3.6" rx="1.8" /><rect x="3" y="10.2" width="18" height="3.6" rx="1.8" /><rect x="3" y="16.4" width="18" height="3.6" rx="1.8" /></svg></div>
          <div><div className="card-title">Studio Directory{maintBadge}{downBadge}</div><div className="card-desc">Choose which studios appear in the Studio dropdown within Stremio.</div></div>
          <span className="card-chev"><ChevIcon /></span>
        </summary>
        <div className="studio-search-wrap">
          <SearchIcon />
          <input type="text" id="prStudioSearch" className="studio-search" placeholder="Search studios…" autoComplete="off" value={prStudioSearch} onChange={(e) => setPrStudioSearch(e.target.value)} />
        </div>
        <div className="studio-global-hdr">
          <span className="studio-global-count"><span id="prStudioEnabledCount">{prStudioEnabledCount}</span> of {pornripsStudios.length} enabled</span>
          <div className="studio-global-btns">
            <button type="button" className="btn-ghost" onClick={() => setPrStudios(Object.fromEntries(pornripsStudios.map((s) => [s, true])))}>Enable all</button>
            <button type="button" className="btn-ghost" onClick={() => setPrStudios(Object.fromEntries(pornripsStudios.map((s) => [s, false])))}>Disable all</button>
          </div>
        </div>
        <div className="sw-list studio-list pr-studio-list">
          {pornripsStudios.map((name, idx) => {
            const q = prStudioSearch.toLowerCase();
            const hidden = q && !name.toLowerCase().includes(q);
            return (
              <div key={name} className={`sw-row studio-row pr-studio-row${hidden ? ' hidden' : ''}`} data-label={name.toLowerCase()}>
                <div className="sw-row-body"><div className="sw-row-text"><div className="sw-row-title">{name}</div></div></div>
                <label className="sw-wrap" htmlFor={`pr_studio_${idx}`} aria-label={name}>
                  <input type="checkbox" id={`pr_studio_${idx}`} value="1" checked={prStudios[name] ?? true} onChange={(e) => setPrStudios((p) => ({ ...p, [name]: e.target.checked }))} />
                  <span className="sw-track" />
                </label>
              </div>
            );
          })}
        </div>
        <input type="hidden" name="disabledPrStudios" id="disabledPrStudios" ref={disabledPrStudiosRef} defaultValue="" />
      </details>
      <p className="pr-attribution">
        PornRips catalogs &amp; metadata are inspired by the{' '}
        <a href="https://stremio-addons.net/addons/adult-stremio-addon" target="_blank" rel="noopener noreferrer">Adult Stremio Addon</a>.
      </p>
    </div>
  );
}