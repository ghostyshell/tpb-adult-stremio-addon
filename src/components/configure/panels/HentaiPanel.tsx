// HentaiPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import { ToggleRow } from '../ToggleRow';

interface HentaiPanelProps {
  activeTab: string;
  hentaiCatalogs: Record<string, boolean>;
  setHentaiCatalogs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  maintenance?: boolean;
  down?: boolean;
}

export function HentaiPanel({ activeTab, hentaiCatalogs, setHentaiCatalogs, maintenance, down }: HentaiPanelProps) {
  return (
    <div className={`panel${activeTab === 'hentai' ? ' active' : ''}`} data-panel="hentai">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2.7 8.7a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm5.4 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm-6.7 1.1a5 5 0 0 0 8.6 0 3.2 3.2 0 0 0-8.6 0Z" /></svg></div>
          <div><div className="card-title">Browse Modes{maintenance ? <span className="src-badge src-maint">WIP</span> : null}{down ? <span className="src-badge src-down">Down</span> : null}</div><div className="card-desc">Hentai series streamed as direct video (no debrid). Episodes appear as stream options.</div></div>
        </div>
        <div className="sw-list">
          {([
            ['hentai_new', 'New', 'Latest releases (this week / month / year)'],
            ['hentai_top', 'Top Rated', 'Highest rated · pick a genre in Discover'],
            ['hentai_all', 'All', 'Browse everything · pick a genre in Discover'],
            ['hentai_studios', 'Studios', 'Browse by studio · Hidden from Home; pick a studio in Discover'],
            ['hentai_years', 'Year', 'Browse by release year · Hidden from Home; pick a year in Discover'],
            ['hentai_search', 'Search', 'Free-text search · Search-only'],
          ] as const).map(([id, label, desc]) => (
            <ToggleRow key={id} id={`cat_${id}`} name={`cat_${id}`} label={label} desc={desc} checked={hentaiCatalogs[id]} onChange={(c) => setHentaiCatalogs((p) => ({ ...p, [id]: c }))} />
          ))}
        </div>
      </div>
      <p className="pr-attribution">
        Hentai catalogs &amp; metadata are inspired by the{' '}
        <a href="https://stremio-addons.net/addons/hentaistream" target="_blank" rel="noopener noreferrer">HentaiStream</a> addon, with episodes from HentaiMama.
      </p>
    </div>
  );
}