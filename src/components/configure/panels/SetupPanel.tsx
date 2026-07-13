// SetupPanel - the merged Sources & Keys page. Combines the old Vault
// (TokensPanel) and Routing (StreamsPanel) into one panel whose four cards
// render in order: Active Sources, Debrid, TPDB/PornDB, MediaFlow Proxy.
// Form field names are unchanged from the original panels, so installBuilder
// parsing and saved profiles are unaffected.

import React from 'react';
import type { ConfigureProps } from '../../../lib/configureProps';
import { ToggleRow } from '../ToggleRow';
import { EyeIcon, ChevIcon } from '../configureUiData';

interface SetupPanelProps {
  activeTab: string;
  // Active Sources (was StreamsPanel)
  primarySources: ConfigureProps['primarySources'];
  sources: Record<string, boolean>;
  handleSourceChange: (value: string, checked: boolean) => void;
  extraIndexers: boolean;
  setExtraIndexers: React.Dispatch<React.SetStateAction<boolean>>;
  enable1337x: boolean;
  setEnable1337x: React.Dispatch<React.SetStateAction<boolean>>;
  envStashdbKey: boolean;
  // Debrid + TPDB/PornDB (was TokensPanel)
  tpdbKey: string;
  setTpdbKey: React.Dispatch<React.SetStateAction<string>>;
  stashdbKey: string;
  setStashdbKey: React.Dispatch<React.SetStateAction<string>>;
  enableTpdbCatalog: boolean;
  setEnableTpdbCatalog: React.Dispatch<React.SetStateAction<boolean>>;
  enableStashdbCatalog: boolean;
  setEnableStashdbCatalog: React.Dispatch<React.SetStateAction<boolean>>;
  envTpdbKey: boolean;
  debridTokenUi: ConfigureProps['debridTokenUi'];
  debridTokens: Record<string, string>;
  setDebridTokens: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hideP2P: boolean;
  setHideP2P: React.Dispatch<React.SetStateAction<boolean>>;
  hasDebridKey: boolean;
  pwVisible: Record<string, boolean>;
  setPwVisible: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  // MediaFlow Proxy (was StreamsPanel)
  proxyDebridStreams: boolean;
  setProxyDebridStreams: React.Dispatch<React.SetStateAction<boolean>>;
  mediaFlowProxyUrlRef: { current: HTMLInputElement | null };
  mediaFlowApiPasswordRef: { current: HTMLInputElement | null };
  sourceStatuses: Record<string, string>;
}

export function SetupPanel({
  activeTab, primarySources, sources, handleSourceChange, extraIndexers, setExtraIndexers,
  enable1337x, setEnable1337x, envStashdbKey, tpdbKey, setTpdbKey, stashdbKey, setStashdbKey,
  enableTpdbCatalog, setEnableTpdbCatalog, enableStashdbCatalog, setEnableStashdbCatalog,
  envTpdbKey, debridTokenUi, debridTokens, setDebridTokens, hideP2P, setHideP2P, hasDebridKey,
  pwVisible, setPwVisible, proxyDebridStreams, setProxyDebridStreams, mediaFlowProxyUrlRef,
  mediaFlowApiPasswordRef, sourceStatuses,
}: SetupPanelProps) {
  const tpdbStatus = sourceStatuses['tpdb-cat'];
  const stashdbStatus = sourceStatuses['stashdb-cat'];
  const statusBadge = (status?: string) =>
    status === 'MAINTENANCE' ? <span className="src-badge src-maint">WIP</span>
    : status === 'DOWN' ? <span className="src-badge src-down">Down</span>
    : null;

  return (
    <div className={`panel${activeTab === 'setup' ? ' active' : ''}`} data-panel="setup">
      {/* Active Sources */}
      <details className="card collapsible">
        <summary className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3.6" rx="1.8" /><rect x="3" y="10.2" width="18" height="3.6" rx="1.8" /><rect x="3" y="16.4" width="18" height="3.6" rx="1.8" /></svg></div>
          <div><div className="card-title">Active Sources</div><div className="card-desc">Enable one or both sources. Catalogs will appear for each enabled source.</div></div>
          <span className="card-chev"><ChevIcon /></span>
        </summary>
        <div className="sw-list">
          {primarySources.map((s) => (
            <React.Fragment key={s.value}>
              <ToggleRow
                id={`src_${s.value}`}
                name={`src_${s.value}`}
                label={s.label}
                desc={'requiresStashdb' in s && s.requiresStashdb && !envStashdbKey
                  ? 'Nyaa adult index · StashDB metadata only (add your StashDB API key below)'
                  : s.desc}
                badge={'badge' in s ? s.badge : undefined}
                maintenance={sourceStatuses[s.value] === 'MAINTENANCE'}
                down={sourceStatuses[s.value] === 'DOWN'}
                checked={sources[s.value]}
                onChange={(c) => handleSourceChange(s.value, c)}
              />
              {s.value === 'piratebay' && sources['piratebay'] && (
                <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', marginTop: 4 }}>
                  <ToggleRow
                    id="extraIndexers"
                    name="extraIndexers"
                    label="Extra indexers"
                    desc="Add Knaben to search, plus XxxClub to browse. Lower debrid hit rate - more volume. Enabling this also surfaces lower-resolution streams regardless of your 1080p or 4K catalog selection."
                    checked={extraIndexers}
                    onChange={setExtraIndexers}
                  />
                  <ToggleRow
                    id="enable1337x"
                    name="enable1337x"
                    label="1337x search"
                    desc="Include 1337x results in search. Adds a broad general torrent index for extra coverage."
                    checked={enable1337x}
                    onChange={setEnable1337x}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </details>

      {/* Debrid Providers */}
      <details className="card collapsible">
        <summary className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></svg></div>
          <div><div className="card-title">Debrid Providers</div><div className="card-desc">Add a key for any service you use. That provider handles your streams. Leave all blank for P2P-only.</div></div>
          <span className="card-chev"><ChevIcon /></span>
        </summary>
        <div className="sw-list" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <ToggleRow id="hideP2P" name="hideP2P" label="Hide P2P fallback links" desc="Suppress direct magnet streams when a debrid key is active" checked={hideP2P} disabled={!hasDebridKey} onChange={setHideP2P} />
        </div>
        {debridTokenUi.map((t) => (
          <div key={t.field} className="field-wrap">
            <label className="field-label" htmlFor={t.inputId}>{t.label}</label>
            <div className="pw-wrap">
              <input
                type={pwVisible[t.inputId] ? 'text' : 'password'}
                id={t.inputId}
                name={t.field}
                className="field-input"
                placeholder={`Paste your ${t.label.toLowerCase()} here`}
                autoComplete="off"
                spellCheck={false}
                value={debridTokens[t.field] || ''}
                onChange={(e) => setDebridTokens((p) => ({ ...p, [t.field]: e.target.value }))}
              />
              <button type="button" className="pw-toggle" aria-label="Toggle visibility" onClick={() => setPwVisible((p) => ({ ...p, [t.inputId]: !p[t.inputId] }))}><EyeIcon /></button>
            </div>
            <span className="field-help">Find your key at <a href={t.href} target="_blank" rel="noopener noreferrer">{t.hrefText}</a>.</span>
          </div>
        ))}
      </details>

      {/* ThePornDB & StashDB */}
      <details className="card collapsible">
        <summary className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.6 2 2 3.3 2 5v14c0 1.7 4.5 3 10 3s10-1.3 10-3V5c0-1.7-4.5-3-10-3Zm0 1.7c4.3 0 7.5.8 7.5 1.5S16.3 6.7 12 6.7 4.5 5.9 4.5 5.2 7.7 3.7 12 3.7Z" /></svg></div>
          <div><div className="card-title">ThePornDB &amp; StashDB</div><div className="card-desc">Two independent metadata sources, merged per-field. API tokens enable metadata enrichment; use the catalog toggles below to add TPDB/StashDB category tabs.</div></div>
          <span className="card-chev"><ChevIcon /></span>
        </summary>
        <div className="field-wrap">
          <label className="field-label" htmlFor="tpdbToken">ThePornDB API token{statusBadge(tpdbStatus)}</label>
          <div className="pw-wrap">
            <input type={pwVisible.tpdbToken ? 'text' : 'password'} id="tpdbToken" name="tpdbKey" className="field-input" placeholder="Paste your API token here" autoComplete="off" spellCheck={false} value={tpdbKey} onChange={(e) => setTpdbKey(e.target.value)} />
            <button type="button" className="pw-toggle" aria-label="Toggle visibility" onClick={() => setPwVisible((p) => ({ ...p, tpdbToken: !p.tpdbToken }))}><EyeIcon /></button>
          </div>
          <span className="field-help">Free account required. Sign up at <a href="https://theporndb.net" target="_blank" rel="noopener noreferrer">theporndb.net</a>, then go to Profile → API Tokens. Metadata enrichment turns on automatically once a token is saved.</span>
        </div>
        <div className="sw-list" style={{ marginTop: 10 }}>
          <ToggleRow id="enableTpdbCatalog" name="enableTpdbCatalog" label="Enable TPDB catalog" desc={envTpdbKey ? 'Show the TPDB Cat. tab and install category catalogs in Stremio' : 'Unavailable: requires a TPDB API key configured on the server'} checked={enableTpdbCatalog} disabled={!envTpdbKey} onChange={setEnableTpdbCatalog} />
        </div>
        <div className="field-wrap" style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="stashdbToken">StashDB API key{statusBadge(stashdbStatus)}</label>
          <div className="pw-wrap">
            <input type={pwVisible.stashdbToken ? 'text' : 'password'} id="stashdbToken" name="stashdbKey" className="field-input" placeholder="Paste your StashDB API key here" autoComplete="off" spellCheck={false} value={stashdbKey} onChange={(e) => setStashdbKey(e.target.value)} />
            <button type="button" className="pw-toggle" aria-label="Toggle visibility" onClick={() => setPwVisible((p) => ({ ...p, stashdbToken: !p.stashdbToken }))}><EyeIcon /></button>
          </div>
          <span className="field-help">Free invite required. Request one at <a href="https://stashdb.org" target="_blank" rel="noopener noreferrer">stashdb.org</a> (see the <a href="https://guidelines.stashdb.org/docs/faq_getting-started/stashdb/accessing-stashdb/" target="_blank" rel="noopener noreferrer">access guide</a> for an invite). Read-only access is enough. Independent of ThePornDB: leave either blank to disable just that source.</span>
        </div>
        <div className="sw-list" style={{ marginTop: 10 }}>
          <ToggleRow id="enableStashdbCatalog" name="enableStashdbCatalog" label="Enable StashDB catalog" desc={envStashdbKey ? 'Show the StashDB Cat. tab and install category catalogs in Stremio' : 'Unavailable: requires a StashDB API key configured on the server'} checked={enableStashdbCatalog} disabled={!envStashdbKey} onChange={setEnableStashdbCatalog} />
        </div>
      </details>

      {/* MediaFlow Proxy */}
      <details className="card collapsible">
        <summary className="card-hdr">
          <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="13" width="3.4" height="8" rx="1.1" /><rect x="10.3" y="9" width="3.4" height="12" rx="1.1" /><rect x="17.6" y="5" width="3.4" height="16" rx="1.1" /></svg></div>
          <div><div className="card-title">MediaFlow Proxy</div><div className="card-desc">Route debrid streams through your own proxy.</div></div>
          <span className="card-chev"><ChevIcon /></span>
        </summary>
        <ToggleRow id="proxyDebridStreams" name="proxyDebridStreams" label="Proxy stream URLs through MediaFlow" desc="Requires URL and API password below" checked={proxyDebridStreams} onChange={setProxyDebridStreams} />
        <div className="field-wrap" style={{ marginTop: 12 }}>
          <label className="field-label" htmlFor="mediaFlowProxyUrl">Proxy URL</label>
          <input ref={mediaFlowProxyUrlRef} type="text" id="mediaFlowProxyUrl" name="mediaFlowProxyUrl" className="field-input" placeholder="http://your-server:8888" autoComplete="off" disabled={!proxyDebridStreams} defaultValue="" />
        </div>
        <div className="field-wrap">
          <label className="field-label" htmlFor="mediaFlowApiPassword">API Password</label>
          <input ref={mediaFlowApiPasswordRef} type="password" id="mediaFlowApiPassword" name="mediaFlowApiPassword" className="field-input" placeholder="API password" autoComplete="off" disabled={!proxyDebridStreams} defaultValue="" />
        </div>
      </details>
    </div>
  );
}