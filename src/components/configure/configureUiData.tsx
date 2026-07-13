// Static configure-UI data and presentational icons, extracted from
// ConfigureApp.tsx as a structure-preserving refactor (no behaviour change).

// Flat ordered tab defs. `tabVisible`, fallback selection, and panel wiring in
// ConfigureApp look tabs up here by id. The old `tokens` (Vault) and `streams`
// (Routing) tabs merged into one `setup` (Sources & Keys) tab; the four cards it
// holds render in SetupPanel in the order: Active Sources, Debrid, TPDB/PornDB,
// MediaFlow Proxy. Labels name their source ("TPB Studios", "PornRips",
// "ThePornDB") instead of the old generic "Library"/"Scenes"/"TPDB Tags".
export const TAB_DEFS = [
  { id: 'setup', label: 'Sources & Keys', sourceKey: null as string | null, icon: <path d="M14 2a4 4 0 0 0-3.87 5L4 13.13V20h6.87L17 13.87A4 4 0 1 0 14 2Zm0 2a2 2 0 0 1 1.87 2.76l-.32.81.81.32A2 2 0 1 1 14 4Z" /> },
  { id: 'catalogs', label: 'TPB Studios', sourceKey: 'piratebay', icon: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></> },
  { id: 'pornrips', label: 'PornRips', sourceKey: 'pornrips', icon: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v1.7a2.5 2.5 0 0 0 0 5.6v1.7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-1.7a2.5 2.5 0 0 0 0-5.6Z" /> },
  { id: 'stripchat', label: 'Stripchat', sourceKey: 'stripchat', icon: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" /> },
  { id: 'tpdb-cat', label: 'ThePornDB', sourceKey: null, catalogTab: true, icon: <path d="M2.7 11.4 11 3.1 20.9 13l-8.3 8.3a1.5 1.5 0 0 1-2.1 0L2.7 13.5a1.5 1.5 0 0 1 0-2.1Z" /> },
  { id: 'stashdb-cat', label: 'StashDB Tags', sourceKey: null, catalogTab: true, icon: <path d="M6 3h12a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.2.7L12 17l-5.8 3.9a.8.8 0 0 1-1.2-.7V4a1 1 0 0 1 1-1Z" /> },
  { id: 'hentai', label: 'HentaiMama', sourceKey: 'hentai', icon: <path d="m12 2.5 2.95 6 6.55.95-4.75 4.6 1.12 6.55L12 17.9l-5.87 3.2 1.12-6.55-4.75-4.6 6.55-.95Z" /> },
  { id: 'sukebei', label: 'Sukebei', sourceKey: 'sukebei', badge: 'Beta', icon: <path d="M12 2.2 20.6 7v10L12 21.8 3.4 17V7Z" /> },
  { id: 'perverzija', label: 'Perverzija', sourceKey: 'perverzija', icon: <><path d="M4 5h16v10H4z" /><path d="M9 19h6M12 15v4" /></> },
  { id: 'freepornvideos', label: 'FreePornVideos', sourceKey: 'freepornvideos', icon: <><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></> },
  { id: 'yesporn', label: 'YesPorn', sourceKey: 'yesporn', icon: <><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></> },
  { id: 'watchporn', label: 'WatchPorn', sourceKey: 'watchporn', icon: <><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></> },
  { id: 'hqporner', label: 'HQporner', sourceKey: 'hqporner', icon: <><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3z" /></> },
  { id: 'display', label: 'Tuning', sourceKey: null, icon: <><rect x="4" y="10" width="3.6" height="10" rx="1.5" /><rect x="10.2" y="5" width="3.6" height="15" rx="1.5" /><rect x="16.4" y="13" width="3.6" height="7" rx="1.5" /></> },
  { id: 'contribute', label: 'Contribute', sourceKey: null, icon: <path d="M12 21.4 3.9 13a5.2 5.2 0 0 1 7.4-7.3l.7.7.7-.7A5.2 5.2 0 0 1 20.1 13Z" /> },
] as const;

// Left-nav grouping. `null` id = ungrouped top-level items. A labeled group is
// rendered as an always-expanded non-interactive header with indented sub-tabs.
// The Catalogs group holds every catalog-config tab; Sources & Keys, Tuning,
// and Contribute stay top-level.
export const NAV_GROUPS: ReadonlyArray<{ id: string | null; label?: string; items: string[] }> = [
  { id: null, items: ['setup'] },
  { id: 'catalogs', label: 'Catalogs', items: ['catalogs', 'pornrips', 'stripchat', 'tpdb-cat', 'stashdb-cat', 'hentai', 'sukebei', 'perverzija', 'freepornvideos', 'yesporn', 'watchporn', 'hqporner'] },
  { id: null, items: ['display', 'contribute'] },
];

export function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ChevIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}