// ponytail: server-only. Reads the public addon-status API on the Go backend
// (the same one the adult-addons site consumes) to find which sources are not
// LIVE, so the configure UI can badge them (MAINTENANCE / DOWN). Never throws:
// any backend hiccup, timeout, or unset BACKEND_URL just yields no badges so
// the page never breaks.

// Report source id -> configure key. The 5 primary sources map to their
// sourceKey; TPDB/StashDB map to their catalog tab ids (tpdb-cat / stashdb-cat),
// which are also the lookup keys used in the Tokens API fields and the
// TPDB/StashDB catalog panels.
const REPORT_TO_KEY: Record<string, string> = {
  tpb: 'piratebay',
  pornrips: 'pornrips',
  hentai: 'hentai',
  sukebei: 'sukebei',
  stripchat: 'stripchat',
  perverzija: 'perverzija',
  freepornvideos: 'freepornvideos',
  yesporn: 'yesporn',
  watchporn: 'watchporn',
  hqporner: 'hqporner',
  tpdb: 'tpdb-cat',
  stashdb: 'stashdb-cat',
};

// Seeded report id in torrent-search-go (pkg/mongo/addon_status.go) and the
// adult-addons FEATURED_ADDON id.
const TPB_STATUS_ID = 'tpb-4k-porn';

export type NonLiveStatus = 'MAINTENANCE' | 'DOWN';

interface AddonStatusSource {
  id: string;
  status: string; // LIVE | DOWN | MAINTENANCE
}

/**
 * Returns a map of configure source key -> non-LIVE status (MAINTENANCE or
 * DOWN), sourced from the Go backend's /api/addon-status/<id> report
 * (ISR 60s, 3s abort). Empty map on any error or when BACKEND_URL is unset.
 */
export async function getSourceStatuses(): Promise<Record<string, NonLiveStatus>> {
  const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (!base) return {};
  try {
    const res = await fetch(`${base}/api/addon-status/${TPB_STATUS_ID}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { success?: boolean; report?: { sources?: AddonStatusSource[] } };
    if (!body?.success || !body?.report?.sources) return {};
    const out: Record<string, NonLiveStatus> = {};
    for (const s of body.report.sources) {
      if (s.status === 'MAINTENANCE' || s.status === 'DOWN') {
        const key = REPORT_TO_KEY[s.id];
        if (key) out[key] = s.status;
      }
    }
    return out;
  } catch {
    return {};
  }
}