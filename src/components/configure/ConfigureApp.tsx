'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigureProps } from '../../lib/configureProps';
import { FooterLinks } from './ContributeLinks';
import { TAB_DEFS, NAV_GROUPS } from './configureUiData';
import { countSelectedCatalogs, buildInstanceNote } from '../../lib/installCountNote';
import { PERVERZIJA_CATALOG_IDS, FREEPORNVIDEOS_CATALOG_IDS, YESPORN_CATALOG_IDS, WATCHPORN_CATALOG_IDS, HQPORNER_CATALOG_IDS } from '../../lib/configureConstants';
import { useProfile } from './useProfile';
import { ProfileModal, OverwriteConfirmModal } from './ProfileModal';
import { ContributePanel } from './panels/ContributePanel';
import { HentaiPanel } from './panels/HentaiPanel';
import { SukebeiPanel } from './panels/SukebeiPanel';
import { StripchatPanel } from './panels/StripchatPanel';
import { TpdbCatPanel } from './panels/TpdbCatPanel';
import { StashdbCatPanel } from './panels/StashdbCatPanel';
import { DisplayPanel } from './panels/DisplayPanel';
import { SetupPanel } from './panels/SetupPanel';
import { CatalogsPanel } from './panels/CatalogsPanel';
import { PornripsPanel } from './panels/PornripsPanel';
import { TubeCatalogPanel } from './panels/TubeCatalogPanel';

export function ConfigureApp(props: ConfigureProps) {
  const {
    addonName, addonVersion, maxBases, totalBases, envTpdbKey, envStashdbKey,
    debridTokenUi, debridKeys, primarySources, hiddenCatalogBases, studioGroups,
    studioTotal, pornripsStudios, tpdbCategories, stashdbCategories,
    catTotal, catDefaultCount, stashCatTotal, stashCatDefaultCount, initialSources,
    sourceStatuses,
  } = props;

  const maint = useCallback((key: string) => sourceStatuses[key] === 'MAINTENANCE', [sourceStatuses]);
  const down = useCallback((key: string) => sourceStatuses[key] === 'DOWN', [sourceStatuses]);

  const [activeTab, setActiveTab] = useState('setup');
  const [sources, setSources] = useState(initialSources);
  const [debridTokens, setDebridTokens] = useState<Record<string, string>>({});
  const [tpdbKey, setTpdbKey] = useState('');
  const [stashdbKey, setStashdbKey] = useState('');
  const [enableTpdbCatalog, setEnableTpdbCatalog] = useState(envTpdbKey);
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
  const [prCatalogs, setPrCatalogs] = useState<Record<string, boolean>>({ pr_recent: true, pr_studio: true, pr_tag: true, pr_search: true });
  const [hentaiCatalogs, setHentaiCatalogs] = useState<Record<string, boolean>>({
    hentai_new: true, hentai_top: true, hentai_all: true,
    hentai_studios: true, hentai_years: true, hentai_search: true,
  });
  const [sukebeiCatalogs, setSukebeiCatalogs] = useState<Record<string, boolean>>({ sukebei_top: true, sukebei_recent: true });
  const [stripchatCatalogs, setStripchatCatalogs] = useState<Record<string, boolean>>({
    sc_girls: true, sc_couples: true, sc_guys: false, sc_trans: false,
  });
  const [perverzijaCatalogs, setPerverzijaCatalogs] = useState<Record<string, boolean>>({
    pvz_recent: true, pvz_studio: true, pvz_tag: true, pvz_performer: true, pvz_search: true,
  });
  const [freepornvideosCatalogs, setFreepornvideosCatalogs] = useState<Record<string, boolean>>({
    fpv_recent: true, fpv_studio: true, fpv_tag: true, fpv_performer: true, fpv_search: true,
  });
  const [yespornCatalogs, setYespornCatalogs] = useState<Record<string, boolean>>({
    ypv_recent: true, ypv_studio: true, ypv_tag: true, ypv_performer: true, ypv_search: true,
  });
  const [watchpornCatalogs, setWatchpornCatalogs] = useState<Record<string, boolean>>({
    wpt_recent: true, wpt_studio: true, wpt_tag: true, wpt_performer: true, wpt_search: true,
  });
  const [hqpornerCatalogs, setHqpornerCatalogs] = useState<Record<string, boolean>>({
    hqp_recent: true, hqp_tag: true, hqp_performer: true, hqp_search: true,
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

  const disabledPrStudiosRef = useRef<HTMLInputElement>(null);
  const tpdbCategoriesRef = useRef<HTMLInputElement>(null);
  const stashdbCategoriesRef = useRef<HTMLInputElement>(null);
  // Refs for uncontrolled inputs that need imperitive update on profile load
  const mediaFlowProxyUrlRef = useRef<HTMLInputElement>(null);
  const mediaFlowApiPasswordRef = useRef<HTMLInputElement>(null);
  const maxResultsRef = useRef<HTMLInputElement>(null);
  const minSeedersRef = useRef<HTMLInputElement>(null);
  const namePostfixRef = useRef<HTMLInputElement>(null);

  // Profile save/load feature - self-contained state + handlers. buildProfile
  // and loadFromProfile (defined below) read/write the rest of the form state
  // and the uncontrolled-input refs, so they stay here and are passed in.
  const profile = useProfile({ buildProfile, loadFromProfile, namePostfixRef });

  const hasDebridKey = useMemo(
    () => debridKeys.some((k) => (debridTokens[k.field] || '').trim() !== ''),
    [debridKeys, debridTokens],
  );

  const instanceNote = useMemo(
    () => buildInstanceNote(
      debridKeys,
      debridTokens,
      countSelectedCatalogs(hiddenCatalogBases, catalogChecks, studioGroups),
      totalBases,
      maxBases,
    ),
    [debridKeys, debridTokens, hiddenCatalogBases, catalogChecks, studioGroups, totalBases, maxBases],
  );

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
      prCatalogs, hentaiCatalogs, sukebeiCatalogs, stripchatCatalogs, perverzijaCatalogs, freepornvideosCatalogs, yespornCatalogs, watchpornCatalogs, hqpornerCatalogs, catalogChecks, prStudios, tpdbCats, stashdbCats,
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
    if (d.perverzijaCatalogs) setPerverzijaCatalogs(d.perverzijaCatalogs);
    if (d.freepornvideosCatalogs) setFreepornvideosCatalogs(d.freepornvideosCatalogs);
    if (d.yespornCatalogs)      setYespornCatalogs(d.yespornCatalogs);
    if (d.watchpornCatalogs)   setWatchpornCatalogs(d.watchpornCatalogs);
    if (d.hqpornerCatalogs)    setHqpornerCatalogs(d.hqpornerCatalogs);
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
          <button type="button" className="btn-account" onClick={profile.openAccount}>Account</button>
          <div className="version"><span className="vdot" />v{addonVersion}</div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Configuration sections">
        {NAV_GROUPS.map((group) => {
          const tabs = group.items
            .map((id) => TAB_DEFS.find((t) => t.id === id))
            .filter((t): t is NonNullable<typeof t> => !!t && tabVisible(t.id));
          if (tabs.length === 0) return null;
          return (
            <div key={group.id ?? 'top-' + group.items.join(',')} className="tab-group-wrap">
              {group.label ? <div className="tab-group" role="presentation" aria-hidden="true">{group.label}</div> : null}
              {tabs.map((tab) => {
                const badgeKey = tab.sourceKey || tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`tab${group.label ? ' tab-sub' : ''}${activeTab === tab.id ? ' active' : ''}`}
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">{tab.icon}</svg>
                    <span className="tab-label">{tab.label}</span>
                    {'badge' in tab && tab.badge ? <span className="tab-badge">{tab.badge}</span> : null}
                    {maint(badgeKey) ? <span className="tab-badge tab-maint">WIP</span> : null}
                    {down(badgeKey) ? <span className="tab-badge tab-down">Down</span> : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <form id="configForm" action="/configure/install" method="post" autoComplete="off" noValidate onSubmit={handleSubmit}>
        {/* SOURCES & KEYS (merged Vault + Routing) */}
        <SetupPanel
          activeTab={activeTab}
          primarySources={primarySources}
          sources={sources}
          handleSourceChange={handleSourceChange}
          extraIndexers={extraIndexers}
          setExtraIndexers={setExtraIndexers}
          enable1337x={enable1337x}
          setEnable1337x={setEnable1337x}
          envStashdbKey={envStashdbKey}
          tpdbKey={tpdbKey}
          setTpdbKey={setTpdbKey}
          stashdbKey={stashdbKey}
          setStashdbKey={setStashdbKey}
          enableTpdbCatalog={enableTpdbCatalog}
          setEnableTpdbCatalog={setEnableTpdbCatalog}
          enableStashdbCatalog={enableStashdbCatalog}
          setEnableStashdbCatalog={setEnableStashdbCatalog}
          envTpdbKey={envTpdbKey}
          debridTokenUi={debridTokenUi}
          debridTokens={debridTokens}
          setDebridTokens={setDebridTokens}
          hideP2P={hideP2P}
          setHideP2P={setHideP2P}
          hasDebridKey={hasDebridKey}
          pwVisible={pwVisible}
          setPwVisible={setPwVisible}
          proxyDebridStreams={proxyDebridStreams}
          setProxyDebridStreams={setProxyDebridStreams}
          mediaFlowProxyUrlRef={mediaFlowProxyUrlRef}
          mediaFlowApiPasswordRef={mediaFlowApiPasswordRef}
          sourceStatuses={sourceStatuses}
        />

        {/* CATALOGS */}
        <CatalogsPanel
          activeTab={activeTab}
          ctRecent={ctRecent}
          setCtRecent={setCtRecent}
          ctTop={ctTop}
          setCtTop={setCtTop}
          qual4k={qual4k}
          qual1080p={qual1080p}
          trans4k={trans4k}
          trans1080p={trans1080p}
          setQuality={setQuality}
          setTransQuality={setTransQuality}
          compactStudios={compactStudios}
          setCompactStudios={setCompactStudios}
          studioSearch={studioSearch}
          setStudioSearch={setStudioSearch}
          studioGroups={studioGroups}
          catalogChecks={catalogChecks}
          setCatalogCheck={setCatalogCheck}
          setAllStudios={setAllStudios}
          setStudiosByQuality={setStudiosByQuality}
          setStudioGroupByQuality={setStudioGroupByQuality}
          collapsedGroups={collapsedGroups}
          toggleGroupCollapsed={toggleGroupCollapsed}
          studioEnabledCount={studioEnabledCount}
          studioTotal={studioTotal}
          maintenance={maint('piratebay')}
          down={down('piratebay')}
        />

        {/* PORNRIPS */}
        <PornripsPanel
          activeTab={activeTab}
          prCatalogs={prCatalogs}
          setPrCatalogs={setPrCatalogs}
          prStudioSearch={prStudioSearch}
          setPrStudioSearch={setPrStudioSearch}
          prStudios={prStudios}
          setPrStudios={setPrStudios}
          pornripsStudios={pornripsStudios}
          prStudioEnabledCount={prStudioEnabledCount}
          disabledPrStudiosRef={disabledPrStudiosRef}
          maintenance={maint('pornrips')}
          down={down('pornrips')}
        />

        {/* HENTAI */}
        <HentaiPanel activeTab={activeTab} hentaiCatalogs={hentaiCatalogs} setHentaiCatalogs={setHentaiCatalogs} maintenance={maint('hentai')} down={down('hentai')} />

        {/* SUKEBEI */}
        <SukebeiPanel activeTab={activeTab} sukebeiCatalogs={sukebeiCatalogs} setSukebeiCatalogs={setSukebeiCatalogs} maintenance={maint('sukebei')} down={down('sukebei')} />

        {/* STRIPCHAT */}
        <StripchatPanel activeTab={activeTab} stripchatCatalogs={stripchatCatalogs} setStripchatCatalogs={setStripchatCatalogs} maintenance={maint('stripchat')} down={down('stripchat')} />

        {/* PERVERZIJA */}
        <TubeCatalogPanel activeTab={activeTab} sourceKey="perverzija" label="Perverzija" icon={<><path d="M4 5h16v10H4z" /><path d="M9 19h6M12 15v4" /></>} catalogIds={PERVERZIJA_CATALOG_IDS} catalogs={perverzijaCatalogs} setCatalogs={setPerverzijaCatalogs} maintenance={maint('perverzija')} down={down('perverzija')} />

        {/* FREEPORNVIDEOS */}
        <TubeCatalogPanel activeTab={activeTab} sourceKey="freepornvideos" label="FreePornVideos" icon={<><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></>} catalogIds={FREEPORNVIDEOS_CATALOG_IDS} catalogs={freepornvideosCatalogs} setCatalogs={setFreepornvideosCatalogs} maintenance={maint('freepornvideos')} down={down('freepornvideos')} />

        {/* YESPORN */}
        <TubeCatalogPanel activeTab={activeTab} sourceKey="yesporn" label="YesPorn" icon={<><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></>} catalogIds={YESPORN_CATALOG_IDS} catalogs={yespornCatalogs} setCatalogs={setYespornCatalogs} maintenance={maint('yesporn')} down={down('yesporn')} />

        {/* WATCHPORN */}
        <TubeCatalogPanel activeTab={activeTab} sourceKey="watchporn" label="WatchPorn" icon={<><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></>} catalogIds={WATCHPORN_CATALOG_IDS} catalogs={watchpornCatalogs} setCatalogs={setWatchpornCatalogs} maintenance={maint('watchporn')} down={down('watchporn')} />

        {/* HQPORNER */}
        <TubeCatalogPanel activeTab={activeTab} sourceKey="hqporner" label="HQporner" icon={<><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></>} catalogIds={HQPORNER_CATALOG_IDS} catalogs={hqpornerCatalogs} setCatalogs={setHqpornerCatalogs} maintenance={maint('hqporner')} down={down('hqporner')} />

        {/* TPDB CATEGORIES */}
        <TpdbCatPanel
          activeTab={activeTab}
          tpdbCategories={tpdbCategories}
          tpdbCats={tpdbCats}
          setTpdbCats={setTpdbCats}
          tpdbCatEnabledCount={tpdbCatEnabledCount}
          catTotal={catTotal}
          catDefaultCount={catDefaultCount}
          tpdbCategoriesRef={tpdbCategoriesRef}
          maintenance={maint('tpdb-cat')}
          down={down('tpdb-cat')}
        />

        {/* STASHDB CATEGORIES */}
        <StashdbCatPanel
          activeTab={activeTab}
          stashdbCategories={stashdbCategories}
          stashdbCats={stashdbCats}
          setStashdbCats={setStashdbCats}
          stashdbCatEnabledCount={stashdbCatEnabledCount}
          stashCatTotal={stashCatTotal}
          stashCatDefaultCount={stashCatDefaultCount}
          stashdbCategoriesRef={stashdbCategoriesRef}
          maintenance={maint('stashdb-cat')}
          down={down('stashdb-cat')}
        />

        {/* DISPLAY */}
        <DisplayPanel
          activeTab={activeTab}
          hideFromHome={hideFromHome}
          setHideFromHome={setHideFromHome}
          maxResultsRef={maxResultsRef}
          minSeedersRef={minSeedersRef}
        />

        {/* CONTRIBUTE */}
        <ContributePanel activeTab={activeTab} />

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
          {profile.profileId && (
            <button type="button" onClick={() => profile.handleSlotSave()} disabled={profile.savingConfig} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {profile.savingConfig && <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
              {profile.savingConfig ? 'Saving...' : 'Save config'}
            </button>
          )}
          {profile.saveStatus && (
            <span style={{ fontSize: '0.82rem', color: profile.saveStatus.ok ? 'var(--accent, #7c6af7)' : '#e05', textAlign: 'center' }}>{profile.saveStatus.msg}</span>
          )}
        </div>

        <FooterLinks />
      </form>

      <ProfileModal {...profile} />
      <OverwriteConfirmModal {...profile} />
    </div>
  );
}
