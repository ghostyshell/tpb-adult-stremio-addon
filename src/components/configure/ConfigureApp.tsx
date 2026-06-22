'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigureProps } from '../../lib/configureProps';
import { AdultAddonsLink, FooterLinks, RedditLinks, SourceCodeLinks, SupportLinks } from './ContributeLinks';
import { ToggleRow } from './ToggleRow';

const TAB_DEFS = [
  { id: 'tokens', label: 'Vault', sourceKey: null as string | null, icon: <path d="M12 2 4 5v6.5c0 4.9 3.3 8.7 8 10.5 4.7-1.8 8-5.6 8-10.5V5L12 2Z" /> },
  { id: 'streams', label: 'Routing', sourceKey: null, icon: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><rect x="7" y="4.8" width="10" height="2.4" rx="1.2" /><rect x="10.8" y="6" width="2.4" height="9.5" rx="1.2" /></> },
  { id: 'catalogs', label: 'Library', sourceKey: 'piratebay', icon: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></> },
  { id: 'pornrips', label: 'Scenes', sourceKey: 'pornrips', badge: 'Beta', icon: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v1.7a2.5 2.5 0 0 0 0 5.6v1.7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-1.7a2.5 2.5 0 0 0 0-5.6Z" /> },
  { id: 'hentai', label: 'Hentai', sourceKey: 'hentai', icon: <path d="m12 2.5 2.95 6 6.55.95-4.75 4.6 1.12 6.55L12 17.9l-5.87 3.2 1.12-6.55-4.75-4.6 6.55-.95Z" /> },
  { id: 'sukebei', label: 'Sukebei', sourceKey: 'sukebei', badge: 'Beta', icon: <path d="M12 2.2 20.6 7v10L12 21.8 3.4 17V7Z" /> },
  { id: 'stripchat', label: 'Stripchat', sourceKey: 'stripchat', badge: 'Beta', icon: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" /> },
  { id: 'tpdb-cat', label: 'TPDB Tags', sourceKey: null, catalogTab: true, icon: <path d="M2.7 11.4 11 3.1 20.9 13l-8.3 8.3a1.5 1.5 0 0 1-2.1 0L2.7 13.5a1.5 1.5 0 0 1 0-2.1Z" /> },
  { id: 'stashdb-cat', label: 'StashDB Tags', sourceKey: null, catalogTab: true, icon: <path d="M6 3h12a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.2.7L12 17l-5.8 3.9a.8.8 0 0 1-1.2-.7V4a1 1 0 0 1 1-1Z" /> },
  { id: 'display', label: 'Tuning', sourceKey: null, icon: <><rect x="4" y="10" width="3.6" height="10" rx="1.5" /><rect x="10.2" y="5" width="3.6" height="15" rx="1.5" /><rect x="16.4" y="13" width="3.6" height="7" rx="1.5" /></> },
  { id: 'contribute', label: 'Contribute', sourceKey: null, icon: <path d="M12 21.4 3.9 13a5.2 5.2 0 0 1 7.4-7.3l.7.7.7-.7A5.2 5.2 0 0 1 20.1 13Z" /> },
] as const;

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function ConfigureApp(props: ConfigureProps) {
  const {
    addonName, addonVersion, maxBases, totalBases, envTpdbKey, envStashdbKey,
    debridTokenUi, debridKeys, primarySources, hiddenCatalogBases, studioGroups,
    studioTotal, pornripsStudios, tpdbCategories, stashdbCategories,
    catTotal, catDefaultCount, stashCatTotal, stashCatDefaultCount, initialSources,
  } = props;

  const [activeTab, setActiveTab] = useState('tokens');
  const [sources, setSources] = useState(initialSources);
  const [debridTokens, setDebridTokens] = useState<Record<string, string>>({});
  const [tpdbKey, setTpdbKey] = useState('');
  const [stashdbKey, setStashdbKey] = useState('');
  const [enableTpdbCatalog, setEnableTpdbCatalog] = useState(false);
  const [enableStashdbCatalog, setEnableStashdbCatalog] = useState(false);
  const [hideP2P, setHideP2P] = useState(false);
  const [hideFromHome, setHideFromHome] = useState(false);
  const [extraIndexers, setExtraIndexers] = useState(false);
  const [enable1337x, setEnable1337x] = useState(false);
  const [compactStudios, setCompactStudios] = useState(false);
  const [proxyDebridStreams, setProxyDebridStreams] = useState(false);
  const [ctRecent, setCtRecent] = useState(true);
  const [ctTop, setCtTop] = useState(true);
  const [qual4k, setQual4k] = useState(true);
  const [qual1080p, setQual1080p] = useState(false);
  const [trans4k, setTrans4k] = useState(false);
  const [trans1080p, setTrans1080p] = useState(false);
  const [prCatalogs, setPrCatalogs] = useState({ pr_recent: true, pr_studio: true, pr_tag: true, pr_search: true });
  const [hentaiCatalogs, setHentaiCatalogs] = useState({
    hentai_new: true, hentai_top: true, hentai_all: true,
    hentai_studios: true, hentai_years: true, hentai_search: true,
  });
  const [sukebeiCatalogs, setSukebeiCatalogs] = useState({ sukebei_top: true, sukebei_recent: true });
  const [stripchatCatalogs, setStripchatCatalogs] = useState({
    sc_girls: true, sc_couples: true, sc_guys: true, sc_trans: true,
  });
  const [catalogChecks, setCatalogChecks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const b of hiddenCatalogBases) init[b.base] = b.defaultChecked;
    for (const g of studioGroups) {
      for (const e of g.entries) init[e.base] = e.defaultChecked;
    }
    return init;
  });
  const [prStudios, setPrStudios] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pornripsStudios.map((s) => [s, true])));
  const [tpdbCats, setTpdbCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tpdbCategories.map((c) => [c.slug, c.default])));
  const [stashdbCats, setStashdbCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stashdbCategories.map((c) => [c.slug, c.default])));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(studioGroups.map((g) => g.key)),
  );
  const [studioSearch, setStudioSearch] = useState('');
  const [prStudioSearch, setPrStudioSearch] = useState('');
  const [pwVisible, setPwVisible] = useState<Record<string, boolean>>({});

  // Profile save/load modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const disabledPrStudiosRef = useRef<HTMLInputElement>(null);
  const tpdbCategoriesRef = useRef<HTMLInputElement>(null);
  const stashdbCategoriesRef = useRef<HTMLInputElement>(null);
  // Refs for uncontrolled inputs that need imperitive update on profile load
  const mediaFlowProxyUrlRef = useRef<HTMLInputElement>(null);
  const mediaFlowApiPasswordRef = useRef<HTMLInputElement>(null);
  const maxResultsRef = useRef<HTMLInputElement>(null);
  const minSeedersRef = useRef<HTMLInputElement>(null);
  const namePostfixRef = useRef<HTMLInputElement>(null);

  const hasDebridKey = useMemo(
    () => debridKeys.some((k) => (debridTokens[k.field] || '').trim() !== ''),
    [debridKeys, debridTokens],
  );

  const countSelectedCatalogs = useCallback(() => {
    const hidden = hiddenCatalogBases.filter((b) => catalogChecks[b.base]).length;
    const studios = studioGroups.flatMap((g) => g.entries).filter((e) => catalogChecks[e.base]).length;
    return hidden + studios;
  }, [hiddenCatalogBases, catalogChecks, studioGroups]);

  const instanceNote = useMemo(() => {
    const providers = Math.max(debridKeys.filter((k) => (debridTokens[k.field] || '').trim()).length, 1);
    const cats = countSelectedCatalogs() || totalBases;
    const groups = Math.max(Math.ceil(cats / maxBases), 1);
    const total = providers * groups;
    if (total <= 1) {
      return { warn: false, html: 'This will generate <strong>1 add-on</strong> to install.' };
    }
    const parts: string[] = [];
    if (providers > 1) parts.push(`${providers} debrid providers`);
    if (groups > 1) parts.push(`${groups} catalog parts to stay under Stremio's manifest size limit`);
    return {
      warn: true,
      html: `This will generate <strong>${total} add-ons</strong> to install `
        + `<strong>all ${total}</strong> in Stremio`
        + (parts.length ? ` (${parts.join(' × ')}).` : '.')
        + '<br>Each add-on is separately titled so you can tell them apart.',
    };
  }, [debridKeys, debridTokens, countSelectedCatalogs, totalBases, maxBases]);

  const studioEnabledCount = useMemo(
    () => studioGroups.flatMap((g) => g.entries).filter((e) => catalogChecks[e.base]).length,
    [studioGroups, catalogChecks],
  );

  const prStudioEnabledCount = useMemo(
    () => Object.values(prStudios).filter(Boolean).length,
    [prStudios],
  );

  const tpdbCatEnabledCount = useMemo(
    () => Object.entries(tpdbCats).filter(([, v]) => v).length,
    [tpdbCats],
  );

  const stashdbCatEnabledCount = useMemo(
    () => Object.entries(stashdbCats).filter(([, v]) => v).length,
    [stashdbCats],
  );

  const tabVisible = useCallback((tabId: string) => {
    const def = TAB_DEFS.find((t) => t.id === tabId);
    if (!def) return true;
    if (def.sourceKey) return sources[def.sourceKey];
    if (tabId === 'tpdb-cat') return enableTpdbCatalog;
    if (tabId === 'stashdb-cat') return enableStashdbCatalog;
    return true;
  }, [sources, enableTpdbCatalog, enableStashdbCatalog]);

  useEffect(() => {
    if (!tabVisible(activeTab)) {
      const fallback = TAB_DEFS.find((t) => tabVisible(t.id));
      if (fallback) setActiveTab(fallback.id);
    }
  }, [activeTab, tabVisible]);

  const setCatalogCheck = (base: string, checked: boolean) => {
    setCatalogChecks((prev) => ({ ...prev, [base]: checked }));
  };

  // Apply a 4K/1080p quality toggle to one main catalog's two bases (4K base +
  // _fhd base). The two qualities are mutually exclusive within a catalog, like
  // a radio: checking one clears the other's base, unchecking keeps the other.
  // Per-studio 4K/1080p are controlled by their own checkboxes below.
  const setQualityGroup = (bases: [string, string], quality: '4k' | '1080p', checked: boolean) => {
    setCatalogChecks((prev) => {
      const next = { ...prev };
      for (const base of bases) {
        const is1080p = base.includes('_fhd');
        if (quality === '1080p') next[base] = checked ? is1080p : !is1080p ? prev[base] : false;
        else next[base] = checked ? !is1080p : is1080p ? prev[base] : false;
      }
      return next;
    });
  };

  const setQuality = (quality: '4k' | '1080p', checked: boolean) => {
    if (quality === '4k') setQual4k(checked);
    else setQual1080p(checked);
    setQualityGroup(['xxx', 'xxx_fhd'], quality, checked);
  };

  const setTransQuality = (quality: '4k' | '1080p', checked: boolean) => {
    if (quality === '4k') setTrans4k(checked);
    else setTrans1080p(checked);
    setQualityGroup(['xxx_trans', 'xxx_trans_fhd'], quality, checked);
  };

  const setAllStudios = (checked: boolean) => {
    setCatalogChecks((prev) => {
      const next = { ...prev };
      for (const g of studioGroups) {
        for (const e of g.entries) next[e.base] = checked;
      }
      return next;
    });
  };

  const setStudiosByQuality = (quality: '4k' | 'fhd', checked: boolean) => {
    setCatalogChecks((prev) => {
      const next = { ...prev };
      for (const g of studioGroups) {
        for (const e of g.entries) {
          if ((quality === 'fhd') === e.isFhd) next[e.base] = checked;
        }
      }
      return next;
    });
  };

  const setStudioGroup = (group: string, checked: boolean) => {
    setCatalogChecks((prev) => {
      const next = { ...prev };
      for (const g of studioGroups) {
        if (g.key !== group) continue;
        for (const e of g.entries) next[e.base] = checked;
      }
      return next;
    });
  };

  const setStudioGroupByQuality = (group: string, quality: '4k' | 'fhd', checked: boolean) => {
    setCatalogChecks((prev) => {
      const next = { ...prev };
      for (const g of studioGroups) {
        if (g.key !== group) continue;
        for (const e of g.entries) {
          if ((quality === 'fhd') === e.isFhd) next[e.base] = checked;
        }
      }
      return next;
    });
  };

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSourceChange = (value: string, checked: boolean) => {
    setSources((prev) => ({ ...prev, [value]: checked }));
  };

  const handleSubmit = () => {
    const disabledPr = pornripsStudios.filter((s) => !prStudios[s]);
    if (disabledPrStudiosRef.current) {
      disabledPrStudiosRef.current.value = JSON.stringify(disabledPr);
    }
    if (tpdbCategoriesRef.current) {
      tpdbCategoriesRef.current.value = enableTpdbCatalog
        ? JSON.stringify(Object.entries(tpdbCats).filter(([, v]) => v).map(([k]) => k))
        : '[]';
    }
    if (stashdbCategoriesRef.current) {
      stashdbCategoriesRef.current.value = enableStashdbCatalog
        ? JSON.stringify(Object.entries(stashdbCats).filter(([, v]) => v).map(([k]) => k))
        : '[]';
    }
  };

  useEffect(() => {
    if (studioSearch) {
      setCollapsedGroups(new Set());
    }
  }, [studioSearch]);

  function buildProfile() {
    return {
      sources, debridTokens, tpdbKey, stashdbKey, enableTpdbCatalog, enableStashdbCatalog,
      hideP2P, hideFromHome, extraIndexers, enable1337x, compactStudios, proxyDebridStreams,
      ctRecent, ctTop, qual4k, qual1080p, trans4k, trans1080p,
      prCatalogs, hentaiCatalogs, sukebeiCatalogs, stripchatCatalogs, catalogChecks, prStudios, tpdbCats, stashdbCats,
      mediaFlowProxyUrl: mediaFlowProxyUrlRef.current?.value ?? '',
      mediaFlowApiPassword: mediaFlowApiPasswordRef.current?.value ?? '',
      maxResults: maxResultsRef.current?.value ?? '20',
      minSeeders: minSeedersRef.current?.value ?? '3',
      namePostfix: namePostfixRef.current?.value ?? '',
    };
  }

  function loadFromProfile(d: any) {
    if (d.sources)           setSources(d.sources);
    if (d.debridTokens)      setDebridTokens(d.debridTokens);
    if (d.tpdbKey != null)   setTpdbKey(d.tpdbKey);
    if (d.stashdbKey != null) setStashdbKey(d.stashdbKey);
    if (d.enableTpdbCatalog != null) setEnableTpdbCatalog(d.enableTpdbCatalog);
    if (d.enableStashdbCatalog != null) setEnableStashdbCatalog(d.enableStashdbCatalog);
    if (d.hideP2P != null)   setHideP2P(d.hideP2P);
    if (d.hideFromHome != null) setHideFromHome(d.hideFromHome);
    if (d.extraIndexers != null) setExtraIndexers(d.extraIndexers);
    if (d.enable1337x != null) setEnable1337x(d.enable1337x);
    if (d.compactStudios != null) setCompactStudios(d.compactStudios);
    if (d.proxyDebridStreams != null) setProxyDebridStreams(d.proxyDebridStreams);
    if (d.ctRecent != null)  setCtRecent(d.ctRecent);
    if (d.ctTop != null)     setCtTop(d.ctTop);
    if (d.qual4k != null)    setQual4k(d.qual4k);
    if (d.qual1080p != null) setQual1080p(d.qual1080p);
    if (d.trans4k != null)   setTrans4k(d.trans4k);
    if (d.trans1080p != null) setTrans1080p(d.trans1080p);
    if (d.prCatalogs)        setPrCatalogs(d.prCatalogs);
    if (d.hentaiCatalogs)    setHentaiCatalogs(d.hentaiCatalogs);
    if (d.sukebeiCatalogs)   setSukebeiCatalogs(d.sukebeiCatalogs);
    if (d.stripchatCatalogs) setStripchatCatalogs(d.stripchatCatalogs);
    if (d.catalogChecks)     setCatalogChecks(d.catalogChecks);
    if (d.prStudios)         setPrStudios(d.prStudios);
    if (d.tpdbCats)          setTpdbCats(d.tpdbCats);
    if (d.stashdbCats)       setStashdbCats(d.stashdbCats);
    if (d.mediaFlowProxyUrl != null && mediaFlowProxyUrlRef.current)   mediaFlowProxyUrlRef.current.value = d.mediaFlowProxyUrl;
    if (d.mediaFlowApiPassword != null && mediaFlowApiPasswordRef.current) mediaFlowApiPasswordRef.current.value = d.mediaFlowApiPassword;
    if (d.maxResults != null && maxResultsRef.current)   maxResultsRef.current.value = d.maxResults;
    if (d.minSeeders != null && minSeedersRef.current)   minSeedersRef.current.value = d.minSeeders;
    if (d.namePostfix != null && namePostfixRef.current) namePostfixRef.current.value = d.namePostfix;
  }

  async function handleProfileSave() {
    setProfileStatus(null);
    const res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: profileId, config: buildProfile() }),
    });
    const json = await res.json().catch(() => ({}));
    const msg = res.ok ? 'Settings saved.' : (json.error || 'Save failed.');
    setProfileStatus({ ok: res.ok, msg });
    if (res.ok) setTimeout(() => setProfileStatus(null), 4000);
  }

  async function handleProfileLoad() {
    setProfileStatus(null);
    const res = await fetch('/api/profile/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: profileId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setProfileStatus({ ok: false, msg: json.error || 'Load failed.' }); return; }
    loadFromProfile(json.config);
    setProfileStatus({ ok: true, msg: 'Settings loaded.' });
    setTimeout(() => { setProfileStatus(null); setProfileOpen(false); }, 1500);
  }

  async function handleProfileDelete() {
    setProfileStatus(null);
    const res = await fetch('/api/profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: profileId }),
    });
    const json = await res.json().catch(() => ({}));
    setProfileStatus({ ok: res.ok, msg: res.ok ? 'Profile deleted.' : (json.error || 'Delete failed.') });
    if (res.ok) setTimeout(() => setProfileStatus(null), 3000);
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <img src="/icon.svg" className="logo" alt={`${addonName} logo`} />
          <div className="brand-text">
            <h1>{addonName}</h1>
            <p className="tagline">Adult catalogs · 4K &amp; 1080p · Debrid streams · metadata</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <button type="button" className="btn-account" onClick={() => { setProfileOpen(true); setProfileStatus(null); }}>Account</button>
          <div className="version"><span className="vdot" />v{addonVersion}</div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Configuration sections">
        {TAB_DEFS.map((tab) => {
          if (!tabVisible(tab.id)) return null;
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab${activeTab === tab.id ? ' active' : ''}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">{tab.icon}</svg>
              <span className="tab-label">{tab.label}</span>
              {'badge' in tab && tab.badge ? <span className="tab-badge">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>

      <form id="configForm" action="/configure/install" method="post" autoComplete="off" noValidate onSubmit={handleSubmit}>
        {/* TOKENS */}
        <div className={`panel${activeTab === 'tokens' ? ' active' : ''}`} data-panel="tokens">
          <details className="card collapsible">
            <summary className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.6 2 2 3.3 2 5v14c0 1.7 4.5 3 10 3s10-1.3 10-3V5c0-1.7-4.5-3-10-3Zm0 1.7c4.3 0 7.5.8 7.5 1.5S16.3 6.7 12 6.7 4.5 5.9 4.5 5.2 7.7 3.7 12 3.7Z" /></svg></div>
              <div><div className="card-title">ThePornDB &amp; StashDB</div><div className="card-desc">Two independent metadata sources, merged per-field. API tokens enable metadata enrichment; use the catalog toggles below to add TPDB/StashDB category tabs.</div></div>
              <span className="card-chev"><ChevIcon /></span>
            </summary>
            <div className="field-wrap">
              <label className="field-label" htmlFor="tpdbToken">ThePornDB API token</label>
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
              <label className="field-label" htmlFor="stashdbToken">StashDB API key</label>
              <div className="pw-wrap">
                <input type={pwVisible.stashdbToken ? 'text' : 'password'} id="stashdbToken" name="stashdbKey" className="field-input" placeholder="Paste your StashDB API key here" autoComplete="off" spellCheck={false} value={stashdbKey} onChange={(e) => setStashdbKey(e.target.value)} />
                <button type="button" className="pw-toggle" aria-label="Toggle visibility" onClick={() => setPwVisible((p) => ({ ...p, stashdbToken: !p.stashdbToken }))}><EyeIcon /></button>
              </div>
              <span className="field-help">Free invite required. Request one at <a href="https://stashdb.org" target="_blank" rel="noopener noreferrer">stashdb.org</a> (Discourse/Discord). Read-only access is enough. Independent of ThePornDB: leave either blank to disable just that source.</span>
            </div>
            <div className="sw-list" style={{ marginTop: 10 }}>
              <ToggleRow id="enableStashdbCatalog" name="enableStashdbCatalog" label="Enable StashDB catalog" desc={envStashdbKey ? 'Show the StashDB Cat. tab and install category catalogs in Stremio' : 'Unavailable: requires a StashDB API key configured on the server'} checked={enableStashdbCatalog} disabled={!envStashdbKey} onChange={setEnableStashdbCatalog} />
            </div>
          </details>

          <details className="card collapsible">
            <summary className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></svg></div>
              <div><div className="card-title">Debrid Providers</div><div className="card-desc">Add a key for any service you use. That provider handles your streams. Leave all blank for P2P-only.</div></div>
              <span className="card-chev"><ChevIcon /></span>
            </summary>
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
            <div className="sw-list" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <ToggleRow id="hideP2P" name="hideP2P" label="Hide P2P fallback links" desc="Suppress direct magnet streams when a debrid key is active" checked={hideP2P} disabled={!hasDebridKey} onChange={setHideP2P} />
            </div>
          </details>
        </div>

        {/* STREAMS */}
        <div className={`panel${activeTab === 'streams' ? ' active' : ''}`} data-panel="streams">
          <details className="card collapsible">
            <summary className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3.6" rx="1.8" /><rect x="3" y="10.2" width="18" height="3.6" rx="1.8" /><rect x="3" y="16.4" width="18" height="3.6" rx="1.8" /></svg></div>
              <div><div className="card-title">Active Sources</div><div className="card-desc">Enable one or both sources. Catalogs will appear for each enabled source.</div></div>
              <span className="card-chev"><ChevIcon /></span>
            </summary>
            <div className="sw-list">
              {primarySources.map((s) => (
                <ToggleRow
                  key={s.value}
                  id={`src_${s.value}`}
                  name={`src_${s.value}`}
                  label={s.label}
                  desc={'requiresStashdb' in s && s.requiresStashdb && !envStashdbKey
                    ? 'Nyaa adult index · StashDB metadata only (add your StashDB API key below)'
                    : s.desc}
                  badge={'badge' in s ? s.badge : undefined}
                  checked={sources[s.value]}
                  onChange={(c) => handleSourceChange(s.value, c)}
                />
              ))}
              {sources['piratebay'] && (
                <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', marginTop: 4 }}>
                  <ToggleRow
                    id="extraIndexers"
                    name="extraIndexers"
                    label="Extra indexers"
                    desc="Add Knaben & Bitsearch to search, plus XxxClub to browse. Lower debrid hit rate - more volume."
                    checked={extraIndexers}
                    onChange={setExtraIndexers}
                  />
                  {extraIndexers && (
                    <p style={{ margin: '4px 0 8px', fontSize: '0.78rem', color: 'var(--text-muted, #aaa)' }}>
                      <strong>Note:</strong> Extra indexer results surface all qualities regardless of your 1080p or 4K Library selection.
                    </p>
                  )}
                  <ToggleRow
                    id="enable1337x"
                    name="enable1337x"
                    label="1337x search"
                    desc="Include 1337x results in search. Due to Cloudflare, results are very slow, so only cached results are returned. The first request queues an item for caching and might only return results after a few hours."
                    checked={enable1337x}
                    onChange={setEnable1337x}
                  />
                </div>
              )}
            </div>
          </details>

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

        {/* CATALOGS */}
        <div className={`panel${activeTab === 'catalogs' ? ' active' : ''}`} data-panel="catalogs">
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg></div>
              <div><div className="card-title">Browse Modes</div><div className="card-desc">Pick which catalog types appear in your Stremio sidebar.</div></div>
            </div>
            <div className="sw-list">
              <ToggleRow id="ct_recent" name="ct_recent" label="Recent" desc="Newest releases sorted by publish date" checked={ctRecent} onChange={setCtRecent} />
              <ToggleRow id="ct_top" name="ct_top" label="Top" desc="Most seeded releases" checked={ctTop} onChange={setCtTop} />
            </div>
          </div>

          <details className="card studio-card collapsible">
            <summary className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3.6" rx="1.8" /><rect x="3" y="10.2" width="18" height="3.6" rx="1.8" /><rect x="3" y="16.4" width="18" height="3.6" rx="1.8" /></svg></div>
              <div><div className="card-title">Quality &amp; Studios</div><div className="card-desc">Choose which catalogs appear in Stremio. XXX 4K is enabled by default; individual studios are listed below.</div></div>
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
              {studioGroups.map((g) => {
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
              })}
            </div>
          </details>
        </div>

        {/* PORNRIPS */}
        <div className={`panel${activeTab === 'pornrips' ? ' active' : ''}`} data-panel="pornrips">
          <div className="panel-beta">Beta: this source is new and may have rough edges. Please report any issues on Discord.</div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 5C6.4 5 1.7 8.4 0 12c1.7 3.6 6.4 7 12 7s10.3-3.4 12-7c-1.7-3.6-6.4-7-12-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" /></svg></div>
              <div><div className="card-title">Browse Modes</div><div className="card-desc">Choose which browsing categories appear in your Stremio sidebar.</div></div>
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
              <div><div className="card-title">Studio Directory</div><div className="card-desc">Choose which studios appear in the Studio dropdown within Stremio.</div></div>
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

        {/* HENTAI */}
        <div className={`panel${activeTab === 'hentai' ? ' active' : ''}`} data-panel="hentai">
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2.7 8.7a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm5.4 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm-6.7 1.1a5 5 0 0 0 8.6 0 3.2 3.2 0 0 0-8.6 0Z" /></svg></div>
              <div><div className="card-title">Browse Modes</div><div className="card-desc">Hentai series streamed as direct video (no debrid). Episodes appear as stream options.</div></div>
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

        {/* SUKEBEI */}
        <div className={`panel${activeTab === 'sukebei' ? ' active' : ''}`} data-panel="sukebei">
          <div className="panel-beta">Beta: only torrents matched in StashDB appear.</div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5H3V5Z" /><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /></svg></div>
              <div><div className="card-title">Browse Modes</div><div className="card-desc">Nyaa adult RSS lists enriched via StashDB. Streams use your debrid key and optional MediaFlow proxy.</div></div>
            </div>
            <div className="sw-list">
              <ToggleRow id="cat_sukebei_top" name="cat_sukebei_top" label="Top" desc="Most seeded releases" checked={sukebeiCatalogs.sukebei_top} onChange={(c) => setSukebeiCatalogs((p) => ({ ...p, sukebei_top: c }))} />
              <ToggleRow id="cat_sukebei_recent" name="cat_sukebei_recent" label="Recent" desc="Newest uploads" checked={sukebeiCatalogs.sukebei_recent} onChange={(c) => setSukebeiCatalogs((p) => ({ ...p, sukebei_recent: c }))} />
            </div>
          </div>
        </div>

        {/* STRIPCHAT */}
        <div className={`panel${activeTab === 'stripchat' ? ' active' : ''}`} data-panel="stripchat">
          <div className="panel-beta">Beta: live public cams only. Catalog browse and username search; no torrent streams.</div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" /></svg></div>
              <div><div className="card-title">Live Categories</div><div className="card-desc">Browse Stripchat models by category or search a username directly from any catalog row.</div></div>
            </div>
            <div className="sw-list">
              <ToggleRow id="cat_sc_girls" name="cat_sc_girls" label="Girls" desc="Female performers" checked={stripchatCatalogs.sc_girls} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_girls: c }))} />
              <ToggleRow id="cat_sc_couples" name="cat_sc_couples" label="Couples" desc="Couple cams" checked={stripchatCatalogs.sc_couples} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_couples: c }))} />
              <ToggleRow id="cat_sc_guys" name="cat_sc_guys" label="Guys" desc="Male performers" checked={stripchatCatalogs.sc_guys} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_guys: c }))} />
              <ToggleRow id="cat_sc_trans" name="cat_sc_trans" label="Trans" desc="Trans performers" checked={stripchatCatalogs.sc_trans} onChange={(c) => setStripchatCatalogs((p) => ({ ...p, sc_trans: c }))} />
            </div>
          </div>
        </div>

        {/* TPDB CATEGORIES */}
        <div className={`panel${activeTab === 'tpdb-cat' ? ' active' : ''}`} data-panel="tpdb-cat">
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.6 2.6H10a2 2 0 0 1 1.4.6l10 10a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-2.8 0l-10-10a2 2 0 0 1-.6-1.4V4.6a2 2 0 0 1 2-2Zm3.9 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg></div>
              <div><div className="card-title">TPDB Category Picks</div><div className="card-desc">Choose which category browse catalogs appear in Stremio. Defaults ({catDefaultCount} checked) are the most popular categories; opt-in categories are available below. Changing the selection only affects which catalogs the warmer fills. It does not restrict search.</div></div>
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

        {/* STASHDB CATEGORIES */}
        <div className={`panel${activeTab === 'stashdb-cat' ? ' active' : ''}`} data-panel="stashdb-cat">
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.6 2.6H10a2 2 0 0 1 1.4.6l10 10a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-2.8 0l-10-10a2 2 0 0 1-.6-1.4V4.6a2 2 0 0 1 2-2Zm3.9 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg></div>
              <div><div className="card-title">StashDB Category Picks</div><div className="card-desc">Choose which category browse catalogs appear in Stremio. Defaults ({stashCatDefaultCount} checked) are the most popular categories; opt-in categories are available below. Changing the selection only affects which catalogs the warmer fills. It does not restrict search.</div></div>
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
                  <div className="sw-row-body"><div className="sw-row-text"><div className="sw-row-title">{c.name}</div></div></div>
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

        {/* DISPLAY */}
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

        {/* CONTRIBUTE */}
        <div className={`panel${activeTab === 'contribute' ? ' active' : ''}`} data-panel="contribute">
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.4 3.9 13a5.2 5.2 0 0 1 7.4-7.3l.7.7.7-.7A5.2 5.2 0 0 1 20.1 13Z" /></svg></div>
              <div><div className="card-title">Support &amp; Community</div><div className="card-desc">Get help, share feedback, or support ongoing development.</div></div>
            </div>
            <SupportLinks />
          </div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" /></svg></div>
              <div><div className="card-title">Adult Addons Directory</div><div className="card-desc">Browse and install adult Stremio and Nuvio addons in one place.</div></div>
            </div>
            <AdultAddonsLink />
          </div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.48.1-3.08 0 0 .97-.31 3.2 1.18a11 11 0 0 1 5.82 0c2.22-1.5 3.2-1.18 3.2-1.18.63 1.6.23 2.78.11 3.07.75.82 1.2 1.85 1.2 3.1 0 4.44-2.7 5.41-5.28 5.69.42.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" /></svg></div>
              <div><div className="card-title">Source Code</div><div className="card-desc">Free and open-source. Fork, self-host, report bugs, or contribute code.</div></div>
            </div>
            <SourceCodeLinks />
          </div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24m5.01 4.74c.38 0 .69.31.69.69 0 .38-.31.69-.69.69-.38 0-.69-.31-.69-.69 0-.38.31-.69.69-.69m-4.6.93c1.66 0 3.18.27 4.4.78a2.2 2.2 0 0 1 3.78 1.53 2.2 2.2 0 0 1-1.52 2.09c.04.24.06.49.06.74 0 2.66-3.1 4.82-6.92 4.82s-6.92-2.16-6.92-4.82c0-.25.02-.5.06-.74a2.2 2.2 0 0 1-1.52-2.09 2.2 2.2 0 0 1 3.78-1.53c1.22-.51 2.74-.78 4.4-.78m-3.12 3.04a1.02 1.02 0 1 0 0 2.04 1.02 1.02 0 0 0 0-2.04m6.24 0a1.02 1.02 0 1 0 0 2.04 1.02 1.02 0 0 0 0-2.04m-3.16 3.27a.28.28 0 0 0-.28.25c0 .59-.48 1.07-1.07 1.07-.59 0-1.07-.48-1.07-1.07a.28.28 0 0 0-.56 0c0 .59-.48 1.07-1.07 1.07-.59 0-1.07-.48-1.07-1.07a.28.28 0 0 0-.56 0c0 1.01.82 1.83 1.83 1.83.63 0 1.18-.32 1.51-.8.33.48.88.8 1.51.8 1.01 0 1.83-.82 1.83-1.83a.28.28 0 0 0-.28-.25" /></svg></div>
              <div><div className="card-title">Reddit Communities</div><div className="card-desc">Guides, discussion and addon recommendations from the community.</div></div>
            </div>
            <RedditLinks />
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-hdr-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm-7 16.5c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2.5Z" /></svg></div>
            <div><div className="card-title">Add-on Name</div><div className="card-desc">Make this install easy to identify in Stremio.</div></div>
          </div>
          <div className="field-wrap">
            <label className="field-label" htmlFor="namePostfix">Custom name postfix (optional)</label>
            <input ref={namePostfixRef} type="text" id="namePostfix" name="namePostfix" className="field-input" placeholder="e.g. Mine" maxLength={30} autoComplete="off" />
            <span className="field-help">Appended to the installed add-on&apos;s name so multiple installs don&apos;t overwrite each other.</span>
          </div>
        </div>

        <div id="instanceNote" className={`instance-note${instanceNote.warn ? ' warn' : ''}`} dangerouslySetInnerHTML={{ __html: instanceNote.html }} />

        <div className="submit-bar">
          <button type="submit" id="generateBtn" className="btn-primary">Generate Install URLs</button>
        </div>

        <FooterLinks />
      </form>

      {profileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setProfileOpen(false)}>
          <dialog open style={{ position: 'relative', background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border, #333)', borderRadius: '12px', padding: '24px', width: '340px', maxWidth: '90vw', margin: 0, color: 'inherit' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setProfileOpen(false)} style={{ position: 'absolute', top: '12px', right: '14px', background: 'none', border: 'none', color: 'var(--text-muted, #aaa)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }} aria-label="Close">×</button>
            <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Saved Config</h2>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted, #aaa)' }}>Stremio auth key</label>
            <input
              type="password"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="Settings > About in Stremio app"
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border, #333)', background: 'var(--bg-input, #111)', color: 'inherit', fontSize: '0.9rem', marginBottom: '4px' }}
            />
            <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: 'var(--text-muted, #aaa)' }}>Find your auth key in Settings &gt; About inside the Stremio app.</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleProfileLoad} disabled={!profileId.trim()} className="btn-primary" style={{ flex: 1 }}>Load settings</button>
              <button type="button" onClick={handleProfileSave} disabled={!profileId.trim()} className="btn-primary" style={{ flex: 1 }}>Save settings</button>
            </div>
            {profileStatus && (
              <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: profileStatus.ok ? 'var(--accent, #7c6af7)' : '#e05' }}>{profileStatus.msg}</p>
            )}
            {profileStatus?.ok === false && (
              <button type="button" onClick={handleProfileDelete} disabled={!profileId.trim()} style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-muted, #aaa)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Delete saved profile</button>
            )}
          </dialog>
        </div>
      )}
    </div>
  );
}
