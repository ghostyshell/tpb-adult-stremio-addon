// TpdbCatPanel, extracted from ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

import React from 'react';
import type { ConfigureProps } from '../../../lib/configureProps';

interface TpdbCatPanelProps {
  activeTab: string;
  tpdbCategories: ConfigureProps['tpdbCategories'];
  tpdbCats: Record<string, boolean>;
  setTpdbCats: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  tpdbCatEnabledCount: number;
  catTotal: number;
  catDefaultCount: number;
  tpdbCategoriesRef: { current: HTMLInputElement | null };
  maintenance?: boolean;
  down?: boolean;
}

export function TpdbCatPanel({
  activeTab, tpdbCategories, tpdbCats, setTpdbCats, tpdbCatEnabledCount, catTotal, catDefaultCount, tpdbCategoriesRef,
  maintenance, down,
}: TpdbCatPanelProps) {
  const maintBadge = maintenance ? <span className="src-badge src-maint">WIP</span> : null;
  const downBadge = down ? <span className="src-badge src-down">Down</span> : null;
  return (
    <div className={`panel${activeTab === 'tpdb-cat' ? ' active' : ''}`} data-panel="tpdb-cat">
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.6 2.6H10a2 2 0 0 1 1.4.6l10 10a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-2.8 0l-10-10a2 2 0 0 1-.6-1.4V4.6a2 2 0 0 1 2-2Zm3.9 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg></div>
          <div><div className="card-title">TPDB Category Picks{maintBadge}{downBadge}</div><div className="card-desc">Choose which category browse catalogs appear in Stremio. Defaults ({catDefaultCount} checked) are the most popular categories; opt-in categories are available below. Changing the selection only affects which catalogs the warmer fills. It does not restrict search.</div></div>
        </div>
        <div className="studio-global-hdr">
          <span className="studio-global-count"><span id="tpdbCatEnabledCount">{tpdbCatEnabledCount}</span> of {catTotal} enabled</span>
          <div className="studio-global-btns">
            <button type="button" className="btn-ghost" onClick={() => setTpdbCats(Object.fromEntries(tpdbCategories.map((c) => [c.slug, true])))}>Enable all</button>
            <button type="button" className="btn-ghost" onClick={() => setTpdbCats(Object.fromEntries(tpdbCategories.map((c) => [c.slug, false])))}>Disable all</button>
          </div>
        </div>
        <div className="sw-list cat-list tpdb-cat-list">
          {tpdbCategories.map((c, idx) => (
            <div key={c.slug} className="sw-row cat-row tpdb-cat-row" data-label={c.name.toLowerCase()}>
              <div className="sw-row-body"><div className="sw-row-text"><div className="sw-row-title">{c.name}</div></div></div>
              <label className="sw-wrap" htmlFor={`tpdb_cat_${idx}`} aria-label={c.name}>
                <input type="checkbox" id={`tpdb_cat_${idx}`} value="1" checked={tpdbCats[c.slug] ?? false} onChange={(e) => setTpdbCats((p) => ({ ...p, [c.slug]: e.target.checked }))} />
                <span className="sw-track" />
              </label>
            </div>
          ))}
        </div>
        <input type="hidden" name="tpdbCategories" id="tpdbCategories" ref={tpdbCategoriesRef} defaultValue="" />
      </div>
    </div>
  );
}