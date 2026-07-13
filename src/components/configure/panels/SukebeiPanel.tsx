// SukebeiPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import { ToggleRow } from '../ToggleRow';

interface SukebeiPanelProps {
  activeTab: string;
  sukebeiCatalogs: Record<string, boolean>;
  setSukebeiCatalogs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  maintenance?: boolean;
  down?: boolean;
}

export function SukebeiPanel({ activeTab, sukebeiCatalogs, setSukebeiCatalogs, maintenance, down }: SukebeiPanelProps) {
  return (
    <div className={`panel${activeTab === 'sukebei' ? ' active' : ''}`} data-panel="sukebei">
      <div className="panel-beta">Beta: only torrents matched in StashDB appear.</div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5H3V5Z" /><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /></svg></div>
          <div><div className="card-title">Browse Modes{maintenance ? <span className="src-badge src-maint">WIP</span> : null}{down ? <span className="src-badge src-down">Down</span> : null}</div><div className="card-desc">Nyaa adult RSS lists enriched via StashDB. Streams use your debrid key and optional MediaFlow proxy.</div></div>
        </div>
        <div className="sw-list">
          <ToggleRow id="cat_sukebei_top" name="cat_sukebei_top" label="Top" desc="Most seeded releases" checked={sukebeiCatalogs.sukebei_top} onChange={(c) => setSukebeiCatalogs((p) => ({ ...p, sukebei_top: c }))} />
          <ToggleRow id="cat_sukebei_recent" name="cat_sukebei_recent" label="Recent" desc="Newest uploads" checked={sukebeiCatalogs.sukebei_recent} onChange={(c) => setSukebeiCatalogs((p) => ({ ...p, sukebei_recent: c }))} />
        </div>
      </div>
    </div>
  );
}