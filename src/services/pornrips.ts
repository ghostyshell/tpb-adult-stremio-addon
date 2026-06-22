/**
 * pornrips.js
 * PornRips.to scraper for adult scene releases.
 *
 * Scraped directly in the addon (like torrentgalaxy/magnetdl) so catalogs work
 * even when the torrent-search backend is the Go service, which does not yet
 * implement a PornRips scraper.
 *
 * Listings:
 *   - Browse/search: https://pornrips.to/page/{page}/?s={query}
 *   - Page 1 with a query: https://pornrips.to/?s={query}
 *   - Page 1 with no query: https://pornrips.to/
 *
 * The .torrent / magnet URL lives on each post's detail page.
 */


import axios from 'axios';
import cheerio from 'cheerio';
import { buildMagnet, fetchInfoHashFromTorrentUrl, pornripsSlug } from '../utils/torrent';
import { pornripsMagnetCache } from '../utils/cache';
import { isSafeUrl } from '../utils/safeUrl';

const BASE_URL = 'https://pornrips.to';
const HTTP_TIMEOUT = 15000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  Connection: 'keep-alive',
};

/**
 * Browse latest PornRips releases (no search query).
 */
async function browseAdult(page = 1) {
  return fetchListings('', page);
}

/**
 * Search PornRips releases.
 */
async function searchAdult(query: string, page = 1) {
  return fetchListings(String(query || '').trim(), page);
}

async function fetchListings(query: string, page: number) {
  const qs = query ? `?s=${encodeURIComponent(query).replace(/%20/g, '+')}` : '';
  const pagePath = page > 1 ? `/page/${page}` : '';
  const url = `${BASE_URL}${pagePath}/${qs}`;

  try {
    const html = await fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const articles = $('#content article, section#primary article, .site-content article').toArray();
    if (!articles.length) return [];

    const listingText = articles.map((a) => $(a).text()).join(' ');
    if (/Nothing Found/i.test(listingText)) {
      return [];
    }

    // Build entries straight from the listing - do NOT fetch each post's detail
    // page here. Resolving ~50 detail pages serially (~500ms each) overran the
    // Stremio/proxy catalog timeout and left catalogs empty. The magnet/infoHash
    // isn't needed at catalog time: the stream route resolves it lazily from
    // detailUrl when the user clicks a result (see routes/stream.js,
    // resolvePornripsTorrentUrl → resolveDownloadUrl).
    const results: any[] = [];

    for (const article of articles) {
      const entry = parseArticle($, article);
      if (!entry.title) continue;

      results.push({
        title: entry.title,
        size: entry.size,
        seeders: 0,
        leechers: 0,
        infoHash: '',
        magnetLink: '',
        torrentUrl: '',
        detailUrl: entry.detailUrl || '',
        website: 'pornrips',
        indexer: 'pornrips',
      });
    }

    return results;
  } catch (err: any) {
    console.error('[pornrips] fetch error:', err.message);
    return [];
  }
}

async function fetchPage(url: string, referer: any = null) {
  try {
    const headers: any = { ...HEADERS };
    if (referer) headers.Referer = referer;

    const res = await axios.get(url, { headers, timeout: HTTP_TIMEOUT, maxRedirects: 5 });
    return res.data;
  } catch (err: any) {
    console.error('[pornrips] page fetch error:', err.message);
    return null;
  }
}

function parseArticle($: any, article: any) {
  const $art = $(article);

  const $titleLink = $art.find('header h2 a').first();
  const title = $titleLink.text().trim();
  const detailPath = $titleLink.attr('href') || '';
  const detailUrl = detailPath.startsWith('http') ? detailPath : `${BASE_URL}${detailPath}`;

  let size = 'Unknown';
  const metaText = $art.find('.wrapper-excerpt-content p, .entry-summary p, p').text() || '';
  const sizeMatch = metaText.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|GiB|MiB|TB))/i);
  if (sizeMatch) size = sizeMatch[0];

  return { title, detailUrl, size };
}

async function fetchDownloadLinks(detailUrl: string, referer: any = null) {
  try {
    const html = await fetchPage(detailUrl, referer);
    if (!html) return {};

    const $ = cheerio.load(html);

    const magnetLink = $('a[href^="magnet:?xt=urn:btih:"]').first().attr('href') || '';
    if (magnetLink) return { magnetLink };

    const torrentUrl = $('a[href$=".torrent"]').first().attr('href') || '';
    if (torrentUrl) {
      const abs = absoluteUrl(torrentUrl, detailUrl);
      const infoHash = await fetchInfoHashFromTorrentUrl(abs, referer).catch(() => '');
      return {
        torrentUrl: abs,
        infoHash,
        magnetLink: infoHash ? buildMagnet(infoHash, '') : '',
      };
    }

    return {};
  } catch (err: any) {
    console.error('[pornrips] detail fetch error:', err.message);
    return {};
  }
}

function absoluteUrl(src: string, base: string) {
  if (!src) return src;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return src.startsWith('//') ? `https:${src}` : src;
  }
  try {
    return new URL(src, base).toString();
  } catch (_: any) {
    return src;
  }
}

/**
 * Resolve a PornRips post URL (or pass through an existing .torrent / magnet URL)
 * to a direct download link usable by debrid providers.
 *
 * The detail-page scrape (and any .torrent fetch) is the slow part of opening a
 * PornRips stream, so the resolved link is cached in Redis keyed by post slug -
 * a post's download link is immutable, so every later click (any user) is an
 * instant hit. Pass-through inputs (already a magnet/.torrent) skip the cache.
 */
async function resolveDownloadUrl(url: string) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const safe = isSafeUrl(raw);
  if (!safe.ok) {
    console.warn(`[pornrips] unsafe download URL rejected: ${safe.reason} (${raw.slice(0, 80)})`);
    return '';
  }

  if (raw.startsWith('magnet:') || /\.torrent(\?|$)/i.test(raw)) return raw;

  const slug = pornripsSlug(raw);
  if (slug) {
    const cached = await pornripsMagnetCache.get(slug);
    if (cached !== undefined) return cached || '';
  }

  const download = await fetchDownloadLinks(raw);
  const resolved = download.magnetLink || download.torrentUrl || '';
  // Cache positive results long-term; cache an empty result briefly so a
  // transient miss is retried soon rather than pinned for 30 days.
  if (slug) await pornripsMagnetCache.set(slug, resolved, resolved ? undefined : 10 * 60);
  return resolved;
}

export { browseAdult, searchAdult, resolveDownloadUrl };
