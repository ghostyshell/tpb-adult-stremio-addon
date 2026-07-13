// StripchatPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import { STRIPCHAT_SOURCE_DESC, STRIPCHAT_WHITE_LABELS } from '../../../lib/configureConstants';
import { ToggleRow } from '../ToggleRow';

interface StripchatPanelProps {
  activeTab: string;
  stripchatCatalogs: Record<string, boolean>;
  setStripchatCatalogs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  maintenance?: boolean;
  down?: boolean;
}

export function StripchatPanel({ activeTab, stripchatCatalogs, setStripchatCatalogs, maintenance, down }: StripchatPanelProps) {
  const maintBadge = maintenance ? <span className="src-badge src-maint">WIP</span> : null;
  const downBadge = down ? <span className="src-badge src-down">Down</span> : null;
  return (
    <div className={`panel${activeTab === 'stripchat' ? ' active' : ''}`} data-panel="stripchat">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" /></svg></div>
          <div><div className="card-title">Stripchat network{maintBadge}{downBadge}</div><div className="card-desc">{STRIPCHAT_SOURCE_DESC}</div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" /></svg></div>
          <div><div className="card-title">Live Categories{maintBadge}{downBadge}</div><div className="card-desc">Browse by category or search a username from any catalog row. Usernames work across stripchat.com and {STRIPCHAT_WHITE_LABELS.join(', ')}.</div></div>
        </div>
        <div className="sw-list">
          <ToggleRow id="cat_sc_girls" name="cat_sc_girls" label="Girls" desc="Female performers" checked={stripchatCatalogs.sc_girls} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_girls: c }))} />
          <ToggleRow id="cat_sc_couples" name="cat_sc_couples" label="Couples" desc="Couple cams" checked={stripchatCatalogs.sc_couples} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_couples: c }))} />
          <ToggleRow id="cat_sc_guys" name="cat_sc_guys" label="Guys" desc="Male performers" checked={stripchatCatalogs.sc_guys} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_guys: c }))} />
          <ToggleRow id="cat_sc_trans" name="cat_sc_trans" label="Trans" desc="Trans performers" checked={stripchatCatalogs.sc_trans} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_trans: c }))} />
        </div>
      </div>
    </div>
  );
}