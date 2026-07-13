# Providers and Streams

This document covers how streams are resolved: the debrid providers, their individual flows, the adult torrent content sources, and how metadata is enriched from TPDB and StashDB.

---

## How Stream Resolution Works

When Stremio asks for streams for an item, the addon:

1. Decodes the item ID (`jstrm:…`) to recover the torrent's infoHash, magnet link, and URLs.
2. Looks up the stored torrent record in Redis (`torrentStore`).
3. If a debrid provider is configured, passes the magnet/infoHash to that provider.
4. If the provider returns playable file URLs, those are returned as debrid streams.
5. If the provider returns nothing (torrent not cached on debrid), falls back to a P2P magnet stream (unless `hideP2P` is true).

```
Item ID (jstrm:…)
      │
      ▼
decodeItemId() + getTorrent()
      │
      ├─ has infoHash? ──yes──► provider.resolve(apiKey, hash, magnet, userIp)
      │                                │
      │                     files resolved?
      │                         yes → filesToStreams()
      │                         no  → try .torrent file upload
      │
      ├─ PornRips no-hash ──────────► resolvePornripsTorrentUrl()
      │                                       │
      │                                magnet → provider.resolve()
      │                                .torrent → provider.resolveFile()
      │
      └─ P2P fallback (unless hideP2P):
             torrentStreams() → { infoHash, sources: [...trackers, dht:hash] }
```

---

## Debrid Providers

The addon supports 12 debrid providers. Each is implemented as a standalone module in `src/services/`. All providers expose the same interface:

```js
resolveStreams(apiKey, infoHash, magnetLink, userIp?) → Promise<FileResult[]>
resolveStreamsFromTorrentFile(apiKey, torrentUrl, userIp?) → Promise<FileResult[]>
```

`FileResult` is `{ fileName: string, fileSize: number, url: string }`.

### Priority Order

When multiple debrid keys are set (e.g. in a misconfigured URL), only the highest-priority one is used:

1. Real-Debrid (`rdKey`)
2. TorBox (`tbKey`)
3. Premiumize (`pmKey`)
4. EasyDebrid (`edKey`)
5. Debrid-Link (`dlKey`)
6. Offcloud (`ocKey`)
7. Put.io (`puKey`)
8. Deepbrid (`dpKey`)
9. LinkSnappy (`lsKey`)
10. Mega-Debrid (`mgKey`)
11. Debrider (`drKey`)
12. Seedr (`srKey`)

### IP Forwarding

Only **Real-Debrid** and **TorBox** support attributing API calls to the end user's public IP, which is how their CDN links are bound to the user's location rather than the server's. The addon extracts the public client IP from `req.ip` (after trust-proxy processing) and forwards it as:

- Real-Debrid: `ip=<userIp>` in the form body of `/addMagnet` and `/unrestrict/link`.
- TorBox: `user_ip=<userIp>` query parameter.

All other providers run entirely server-side with no IP forwarding.

---

## Provider Flows

### Real-Debrid

```
1. GET  /torrents/instantAvailability/{hash}
        └── cached? skip polling, go to step 3
2. POST /torrents/addMagnet    → { id }
3. POST /torrents/selectFiles/{id}   body: files=all
4. GET  /torrents/info/{id}    poll until status=downloaded (2 s interval, 2 min max)
5. POST /unrestrict/link       body: link=<download_link>
        └── returns { download: "https://…" }  ← playable CDN URL per file
```

Stream cache key: `scope(apiKey, userIp) + infoHash`.

### TorBox

```
1. POST /torrents/createtorrent  body: magnet=… user_ip=…  → { data.torrent_id }
2. GET  /torrents/mylist/{id}    poll until download_state=cached|seeding|uploading|downloading
3. POST /torrents/requestdl      body: torrent_id=… file_id=…  → { data: "https://…" }
```

### Premiumize

```
1. POST /transfer/create   body: src=<magnet>  → { id }
   (or directdl check first: POST /cache/check → if cached, use /transfer/directdl)
2. GET  /transfer/status/{id}  poll until status=finished
3. GET  /folder/list?id=…  → file list
```

### EasyDebrid

```
POST /link/generate   body: link=<magnet>  → { generated_links: [{ link }] }
```

EasyDebrid resolves synchronously from the cache; no polling needed.

### Debrid-Link

```
1. POST /seedbox/add      body: url=<magnet>  → { value.id }
2. GET  /seedbox/{id}     poll until downloadPercent=100
3. Returns value.files[].downloadUrl directly
```

### Offcloud

```
1. POST /cloud/add         body: url=<magnet>  → { requestId }
2. GET  /cloud/status/{id} poll until status=downloaded
3. Returns links array from status response
```

### Put.io

```
1. POST /transfers/add   body: url=<magnet>  → { transfer.id }
2. GET  /transfers/{id}  poll until status=SEEDING|COMPLETED
3. GET  /files/{file_id}/stream  → HLS or direct URL
```

### Deepbrid

```
1. POST /torrents/add    body: src=<magnet>  → { id }
2. GET  /torrents/{id}   poll until status=seeding or downloaded
3. GET  /torrents/links/{id}  → { links: [...] }
```

### LinkSnappy

```
1. POST /api.php   action=addmagnet, login=user:pass, magnet=…  → { hash }
2. GET  /api.php   action=torrents  → find by hash, poll until complete
3. GET  /api.php   action=getfile → downloadLink per file
```

### Mega-Debrid

```
1. POST /uploadTorrent   params: token, url=<magnet>  → { id }
2. GET  /getTorrent      params: token, id  → poll until status=finish
3. GET  /getLink         params: token, link  → { downloadLink }
```

### Debrider

```
POST /link/generate   params: apikey=…, link=<magnet>  → { links: [{ link }] }
```

### Seedr

Two credential formats map to two Seedr APIs. A Personal Access Token (`sdp_...`,
recommended) drives REST v2; `email:password` drives the oauth_test v1 API
(transfers are premium-gated on v1, so free accounts must use a PAT).

```
PAT (sdp_…): REST v2  https://www.seedr.cc/api/v0.1/p/  Authorization: Bearer
  POST /tasks { torrent_magnet }              → { user_torrent_id }
  GET  /tasks/{id}                             poll until task.state = finished
  GET  /fs/folder/{folder_created_id}/contents → files[] (pick is_video)
  GET  /download/file/{id}/url                → { url }   (direct CDN, streamable)

email:password: oauth_test v1
  POST /oauth_test/token.php  grant_type=password client_id=seedr_chrome → access_token
  POST /oauth_test/resource.php  func=add_torrent  torrent_magnet=…       (premium only)
  POST /oauth_test/resource.php  func=list_contents  content_id=0        poll
  POST /oauth_test/resource.php  func=fetch_file   folder_file_id=…      → { url }
```

---

## Content Sources

### HiddenBay (piratebay)

The primary source. All catalog browse/search requests are proxied through the external torrent-search backend API (`BACKEND_URL`). The backend scrapes HiddenBay (a thepiratebay-style index) and returns torrent metadata including optional cover images from S3.

Category mapping:
- `507` - Adult 4K/UHD
- `505` - Adult 1080p (FHD)

### TorrentGalaxy (`torrentgalaxy`)

Scraped directly in-addon via `src/services/torrentgalaxy.js`. Category 47 (XXX). No Cloudflare protection.

### MagnetDL (`magnetdl`)

Scraped directly via `src/services/magnetdl.js`. `/XXX/` section, clean HTML.

### LimeTorrents (`limetorrents`)

Scraped directly via `src/services/limetorrents.js`. `/adult/` category.

### PornRips (`pornrips`)

Scene release blog sourced via two paths:
1. **Browse (recent/all):** proxied through the backend API as `website: 'pornrips'`.
2. **Studio/tag/search:** fetched from a reference external addon (catalog → torrent slug mapping). These lookups bypass pornrips.to's Cloudflare-protected search endpoint entirely.

Cover images for PornRips items come from the reference addon's catalog or from `og:image` tags on the detail page. The resolved magnet or `.torrent` URL is cached per slug in `prmagnet:v1:` (30 d TTL) so repeat stream clicks hit the cache rather than re-scraping.

### Hentai (`hentai`)

Proxied from a reference external addon. Series are mapped to one `hs:` item. The stream route fetches all episode direct-play URLs from the reference addon and returns them as individual stream entries (no debrid - these are HTTP streams, not torrents).

### Multi-Source Mode (`all`)

When `ADULT_SOURCE=all` (or the user selects all sources on the configure page), the catalog route fetches from all configured sources in parallel and deduplicates by infoHash (keeping the highest-seeded version when the same torrent appears in multiple sources). Results are sorted by seeders.

---

## Metadata Sources

### ThePornDB (TPDB)

API endpoint: `https://api.theporndb.net` (set via `TPDB_API_KEY` / `TPDB_API_URL`).

The client queries `/scenes?parse=<title>`, `/movies?parse=<title>`, and `/performers?parse=<title>` in sequence, accepting the first result whose title is a near-substring match of the torrent filename.

**Caching:**
- **Shared cache** (`tpdb-shared:v1:`, 30 d): keyed by infoHash. Once one user with a key matches a torrent, the metadata is available to all installs.
- **Per-key cache** (`tpdb:v1:`, 24 h): avoids burning the user's rate limit on repeat lookups.
- **Negative cache** (1 h, per-key): prevents re-querying junk titles within an hour.

TPDB calls are paced via a global request queue (default: 400 ms between calls) and a cooldown (default: 120 s) after a rate-limit response. These are tunable via `TPDB_MIN_INTERVAL_MS` and `TPDB_COOLDOWN_MS`.

### StashDB

API endpoint: `https://stashdb.org/graphql` (set via `STASHDB_API_KEY` / `STASHDB_API_URL`).

StashDB is a community-run scene database. The client queries scenes by URL (the torrent detail URL or PornRips post URL) and by title. Authentication uses a custom `ApiKey: <key>` header.

**Caching:** mirrors TPDB - `stashdb-shared:v1:` (30 d) and `stashdb:v1:` (24 h).

### Metadata Merge

TPDB and StashDB results are merged per-field by `src/utils/metaMerge.js`:

- `title`: TPDB wins if set; else StashDB; else torrent filename.
- `poster`: TPDB wins if set; else StashDB.
- `description`: TPDB wins if set; else StashDB.
- `year`: TPDB wins; else StashDB.
- `background`: TPDB wins; else StashDB; else falls back to poster.

### Reference Addon Fallback (PornRips)

For PornRips items where neither TPDB nor StashDB matched, the addon falls back to a reference external addon's metadata. This typically provides an og:image cover and the cleaned scene title. Cached in `refmeta:v1:` (7 d).

---

## Background Enrichment

Live TPDB/StashDB lookups are **off the request path**. The catalog and meta routes read only from the shared cache. The `metaEnricher.js` job:

1. Collects infoHashes/slugs added to `pendingMetaLookups` during catalog renders.
2. Every 60 s, drains up to 100 pending IDs.
3. Skips any ID already in the shared cache.
4. Makes live TPDB and StashDB calls (paced, one at a time per service).
5. Writes positive matches to `tpdb-shared:v1:` and `stashdb-shared:v1:`.

First-paint of a catalog is always fast (shared cache read only). Metadata appears on the next paint, typically within 60 s of the initial catalog browse.
