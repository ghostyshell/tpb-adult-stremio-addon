// DisplayPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import { ToggleRow } from '../ToggleRow';

interface DisplayPanelProps {
  activeTab: string;
  hideFromHome: boolean;
  setHideFromHome: React.Dispatch<React.SetStateAction<boolean>>;
  maxResultsRef: { current: HTMLInputElement | null };
  minSeedersRef: { current: HTMLInputElement | null };
}

export function DisplayPanel({ activeTab, hideFromHome, setHideFromHome, maxResultsRef, minSeedersRef }: DisplayPanelProps) {
  return (
    <div className={`panel${activeTab === 'display' ? ' active' : ''}`} data-panel="display">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="20" height="14" rx="2.5" /><rect x="10.5" y="17" width="3" height="3.4" /><rect x="6.5" y="20" width="11" height="2" rx="1" /></svg></div>
          <div><div className="card-title">Home Placement</div><div className="card-desc">Control where this addon shows up inside Stremio.</div></div>
        </div>
        <ToggleRow id="hideFromHome" name="hideFromHome" label="Hide catalogs from Stremio Home screen" desc="Removes catalog rows from the Home/Board tab only. They remain in Discover and Search. Does not affect Continue Watching (built from your watch history). You must remove old add-on instances and install the new URLs for this to take effect." checked={hideFromHome} onChange={setHideFromHome} />
      </div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.5 2.5a8 8 0 1 0 4.9 14.3l4.4 4.4a1.5 1.5 0 0 0 2.1-2.1l-4.4-4.4A8 8 0 0 0 10.5 2.5Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" /></svg></div>
          <div><div className="card-title">Result Limits</div><div className="card-desc">Fine-tune catalog result counts and seeder filters.</div></div>
        </div>
        <div className="row-2">
          <div className="field-wrap">
            <label className="field-label" htmlFor="maxResults">Max Results</label>
            <input ref={maxResultsRef} type="number" id="maxResults" name="maxResults" className="field-input" defaultValue={20} min={1} max={100} />
          </div>
          <div className="field-wrap">
            <label className="field-label" htmlFor="minSeeders">Min Seeders</label>
            <input ref={minSeedersRef} type="number" id="minSeeders" name="minSeeders" className="field-input" defaultValue={3} min={0} />
          </div>
        </div>
      </div>
    </div>
  );
}