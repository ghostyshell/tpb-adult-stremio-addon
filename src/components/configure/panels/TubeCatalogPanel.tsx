// TubeCatalogPanel - shared catalog-toggle panel for the direct-play tube
// sources (Perverzija, FreePornVideos, YesPorn, WatchPorn, HQporner). Most share
// the 5-catalog shape (recent/studio/tag/performer/search); HQporner has no studio
// catalog (4 ids). One parameterized component renders all of them via catalogIds
// instead of near-duplicate panels. Mirrors SukebeiPanel's card shape.

import React from 'react';
import { ToggleRow } from '../ToggleRow';

interface TubeCatalogPanelProps {
  activeTab: string;
  sourceKey: string; // tab id, e.g. 'perverzija' | 'freepornvideos'
  label: string; // display name, e.g. 'Perverzija'
  icon: React.ReactNode; // matches this source's tab icon (see configureUiData TAB_DEFS)
  catalogIds: readonly string[];
  catalogs: Record<string, boolean>;
  setCatalogs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  maintenance?: boolean;
  down?: boolean;
}

const SUFFIX: Record<string, { label: string; desc: string }> = {
  recent: { label: 'Recent', desc: 'Newest scenes sorted by publish date' },
  studio: { label: 'Studio', desc: 'Browse by studio · Hidden from Home; pick a studio in Discover' },
  tag: { label: 'Tag', desc: 'Browse by content tag · Hidden from Home; pick a tag in Discover' },
  performer: { label: 'Performer', desc: 'Browse by performer · Hidden from Home; pick a performer in Discover' },
  search: { label: 'Search', desc: 'Free-text search across the source · Search-only' },
};

export function TubeCatalogPanel({
  activeTab, sourceKey, label, icon, catalogIds, catalogs, setCatalogs, maintenance, down,
}: TubeCatalogPanelProps) {
  const maintBadge = maintenance ? <span className="src-badge src-maint">WIP</span> : null;
  const downBadge = down ? <span className="src-badge src-down">Down</span> : null;
  return (
    <div className={`panel${activeTab === sourceKey ? ' active' : ''}`} data-panel={sourceKey}>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor">{icon}</svg></div>
          <div><div className="card-title">Browse Modes{maintBadge}{downBadge}</div><div className="card-desc">{label} direct-play catalogs. Streams resolve to multi-quality HLS or mp4 on demand.</div></div>
        </div>
        <div className="sw-list">
          {catalogIds.map((id) => {
            const meta = SUFFIX[id.slice(4)] ?? { label: id, desc: '' };
            return (
              <ToggleRow
                key={id}
                id={`cat_${id}`}
                name={`cat_${id}`}
                label={meta.label}
                desc={meta.desc}
                checked={catalogs[id]}
                onChange={(c) => setCatalogs((p) => ({ ...p, [id]: c }))}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}