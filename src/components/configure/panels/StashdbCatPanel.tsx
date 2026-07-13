// StashdbCatPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import type { ConfigureProps } from '../../../lib/configureProps';
import { isStashdbLowResult } from '../../../utils/categoryCatalogs';

interface StashdbCatPanelProps {
  activeTab: string;
  stashdbCategories: ConfigureProps['stashdbCategories'];
  stashdbCats: Record<string, boolean>;
  setStashdbCats: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  stashdbCatEnabledCount: number;
  stashCatTotal: number;
  stashCatDefaultCount: number;
  stashdbCategoriesRef: { current: HTMLInputElement | null };
  maintenance?: boolean;
  down?: boolean;
}

export function StashdbCatPanel({
  activeTab, stashdbCategories, stashdbCats, setStashdbCats, stashdbCatEnabledCount, stashCatTotal, stashCatDefaultCount, stashdbCategoriesRef,
  maintenance, down,
}: StashdbCatPanelProps) {
  const maintBadge = maintenance ? <span className="src-badge src-maint">WIP</span> : null;
  const downBadge = down ? <span className="src-badge src-down">Down</span> : null;
  return (
    <div className={`panel${activeTab === 'stashdb-cat' ? ' active' : ''}`} data-panel="stashdb-cat">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.6 2.6H10a2 2 0 0 1 1.4.6l10 10a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-2.8 0l-10-10a2 2 0 0 1-.6-1.4V4.6a2 2 0 0 1 2-2Zm3.9 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg></div>
          <div><div className="card-title">StashDB Category Picks{maintBadge}{downBadge}</div><div className="card-desc">Choose which category browse catalogs appear in Stremio. Defaults ({stashCatDefaultCount} checked) are the most popular categories; opt-in categories are available below. Changing the selection only affects which catalogs the warmer fills. It does not restrict search.</div></div>
        </div>
        <div className="studio-global-hdr">
          <span className="studio-global-count"><span id="stashdbCatEnabledCount">{stashdbCatEnabledCount}</span> of {stashCatTotal} enabled</span>
          <div className="studio-global-btns">
            <button type="button" className="btn-ghost" onClick={() => setStashdbCats(Object.fromEntries(stashdbCategories.map((c) => [c.slug, true])))}>Enable all</button>
            <button type="button" className="btn-ghost" onClick={() => setStashdbCats(Object.fromEntries(stashdbCategories.map((c) => [c.slug, false])))}>Disable all</button>
          </div>
        </div>
        <div className="sw-list cat-list stashdb-cat-list">
          {stashdbCategories.map((c, idx) => (
            <div key={c.slug} className="sw-row cat-row stashdb-cat-row" data-label={c.name.toLowerCase()}>
              <div className="sw-row-body"><div className="sw-row-text"><div className="sw-row-title">{c.name}</div>{isStashdbLowResult(c.slug) ? <div className="sw-row-desc">Low results on StashDB</div> : null}</div></div>
              <label className="sw-wrap" htmlFor={`stashdb_cat_${idx}`} aria-label={c.name}>
                <input type="checkbox" id={`stashdb_cat_${idx}`} value="1" checked={stashdbCats[c.slug] ?? false} onChange={(e) => setStashdbCats((p) => ({ ...p, [c.slug]: e.target.checked }))} />
                <span className="sw-track" />
              </label>
            </div>
          ))}
        </div>
        <input type="hidden" name="stashdbCategories" id="stashdbCategories" ref={stashdbCategoriesRef} defaultValue="" />
      </div>
    </div>
  );
}