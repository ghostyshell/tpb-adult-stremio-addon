# TPB 4K Porn - Stremio Addon

[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/EbHcTNAqca)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/ghosty99)
[![Reddit](https://img.shields.io/badge/r/TPB4KPorn-FF4500?style=for-the-badge&logo=reddit&logoColor=white)](https://www.reddit.com/r/TPB4KPorn/)

A self-hosted Stremio addon for 4K and 1080p adult content with debrid stream resolution and a React/Next.js configure UI.

**Live instance:** [tpb-adult-addon.click/configure](https://tpb-adult-addon.click/configure)
**Docs site:** [ghostyshell.github.io/tpb-adult-stremio-addon](https://ghostyshell.github.io/tpb-adult-stremio-addon/)

---

## Features

- **Adult catalogs** from multiple sources:
  - **ThePirateBay / HiddenBay** - 4K (cat 507) and 1080p (cat 505), Top and Recent
  - **PornRips** - scene release blog with studio/tag/quality browsing
  - **Hentai** - episode-level streams via HentaiMama proxy
  - **Sukebei** - JAV torrents cross-referenced with StashDB metadata
  - **TPDB / StashDB categories** - performer/category-browsable catalogs (server key required)
- **14 debrid providers** for cached stream resolution - Real-Debrid, AllDebrid, TorBox, Premiumize, EasyDebrid, Debrid-Link, Offcloud, Put.io, Deepbrid, LinkSnappy, Mega-Debrid, Debrider, Seedr, PikPak
- **P2P fallback** with magnet links when no debrid key is set or cache miss occurs
- **MediaFlow proxy** support for IP-restricted CDN links
- **Redis caching** for stream resolution, catalog results, and metadata
- **MongoDB** optional persistent torrent store
- **Favorites** - Redis-backed per-instance favorites list with `/api/favorites` REST API
- **Multi-instance splitting** - divide catalogs across multiple addon installs to stay under Stremio's manifest size limit
- **Custom name postfix** - label each install (e.g. "RD", "4K only") so they're identifiable in Stremio

---

## Quick Start

### Deploy with Docker

```bash
docker build -t stremio-tpb-porn .
docker run -p 7000:7000 \
  -e BACKEND_URL=https://your-backend.example.com \
  stremio-tpb-porn
```

Open `http://localhost:7000/configure` to generate your personal install URL.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | Listen port (default `7000`) |
| `BACKEND_URL` | yes | Base URL of the [torrent-search-go](https://github.com/ghostyshell/torrent-search-go) backend - required for all catalog and meta endpoints |
| `ADDON_API_TOKEN` | no | Bearer token sent to the backend for auth |
| `TPDB_API_KEY` | no | ThePornDB / metadataapi.net key - enables TPDB category catalogs and metadata enrichment |
| `STASHDB_API_KEY` | no | StashDB API key - enables Sukebei catalog and StashDB category browsing |
| `REFERENCE_ADDON_URL` | no | URL of a reference Hentai addon to proxy catalogs and metadata from |
| `REDIS_URL` | no | Redis connection URL for caching (strongly recommended in production) |
| `REDIS_PASSWORD` | no | Redis auth password |
| `MONGODB_URI` | no | MongoDB URI for persistent torrent record storage |

> **Debrid keys** are per-user - each user enters their key on the configure page and it is encoded into their personal install URL. Keys never touch the server.

---

## Configure and Install

Open `/configure` on your instance:

1. **Tokens** - enter your debrid key and optional TPDB/StashDB tokens
2. **Streams** - configure debrid provider, P2P settings, and MediaFlow proxy
3. **Catalogs** - choose sources, quality tiers, sort variants, and studio/network picks
4. **Display** - set catalog visibility, hide from home screen, multi-instance split, and name postfix
5. Click **Generate Install URLs** then **Install in Stremio**

### Debrid API key sources

| Provider | Key location |
|----------|-------------|
| Real-Debrid | [real-debrid.com/apitoken](https://real-debrid.com/apitoken) |
| AllDebrid | [alldebrid.com/apikeys](https://alldebrid.com/apikeys) |
| TorBox | [torbox.app/settings](https://torbox.app/settings) |
| Premiumize | [premiumize.me/account](https://www.premiumize.me/account) - API section |
| EasyDebrid | [easydebrid.com/settings](https://easydebrid.com/settings) |
| Debrid-Link | [debrid-link.com/webapp/apikey](https://debrid-link.com/webapp/apikey) |
| Offcloud | [offcloud.com/#/account](https://offcloud.com/#/account) |
| Put.io | [put.io/oauth/apps](https://put.io/oauth/apps) |
| Deepbrid | [deepbrid.com/devices](https://www.deepbrid.com/devices) |
| LinkSnappy | [linksnappy.com/myaccount](https://linksnappy.com/myaccount) - enter as `username:password` |
| Mega-Debrid | [mega-debrid.eu](https://www.mega-debrid.eu/index.php?page=api) |
| Debrider | [debrider.app/dashboard/account](https://debrider.app/dashboard/account) |
| Seedr | [seedr.cc](https://www.seedr.cc/docs/api/rest/v1/) - enter as `email:password` |
| PikPak | [mypikpak.com](https://mypikpak.com/) - paste your `os.` refresh token |

---

## Architecture

The addon is a **Node.js/TypeScript** app combining **Express** (Stremio protocol endpoints and REST API) with **Next.js** (configure and install UI).

The **[torrent-search-go](https://github.com/ghostyshell/torrent-search-go) backend** handles all scraping, catalog serving, meta, and cover extraction. The Node addon is a thin edge layer responsible for:

- Proxying Stremio manifest/catalog/meta requests to Go via `BACKEND_URL`
- Debrid stream resolution (14 providers, per-user keys)
- Hentai episode streams
- Favorites REST API
- Configure/install UI

```
src/
├── server.ts                 HTTP server entry point
├── createExpressApp.ts       Express app (routes, middleware, Next.js integration)
├── index.ts                  Stremio addon entry (imported by server)
├── manifest.ts               Dynamic manifest builder
├── routes/
│   └── stream.ts             Stream handler - debrid resolution + P2P fallback
├── services/
│   ├── realdebrid.ts         Real-Debrid API client
│   ├── alldebrid.ts          AllDebrid API client
│   ├── torbox.ts             TorBox API client
│   ├── premiumize.ts         Premiumize API client
│   ├── easydebrid.ts         EasyDebrid API client
│   ├── debridlink.ts         Debrid-Link API client
│   ├── offcloud.ts           Offcloud API client
│   ├── putio.ts              Put.io API client
│   ├── deepbrid.ts           Deepbrid API client
│   ├── linksnappy.ts         LinkSnappy API client
│   ├── megadebrid.ts         Mega-Debrid API client
│   ├── debrider.ts           Debrider API client
│   ├── seedr.ts              Seedr API client
│   ├── pikpak.ts             PikPak API client
│   ├── hentai.ts             Hentai proxy (catalog filter + episode streams)
│   ├── pornrips.ts           PornRips torrent URL resolver
│   ├── porntube.ts           PornTube torrent resolver
│   └── backend.ts            Go backend API client (studios KV, auth headers)
├── utils/
│   ├── config.ts             Base64url config encode/decode
│   ├── cache.ts              Redis-backed cache (stream, catalog, meta, section)
│   ├── torrent.ts            Name parsing, ID encoding, quality detection, magnet utils
│   ├── torrentCache.ts       Per-item torrent record store (Redis + MongoDB)
│   ├── adultSections.ts      Catalog definitions (XXX/Trans/studios x Top/Recent)
│   ├── debridProviders.ts    Provider registry (field, tag, label, resolve fns)
│   ├── stremioGo.ts          Go backend proxy helper + fetchGoStreams
│   ├── redis.ts              Redis client wrapper
│   ├── mongo.ts              MongoDB client wrapper
│   └── safeUrl.ts            URL safety checks (blocks private IPs)
├── types/
│   ├── config.ts             AddonConfig interface
│   ├── debrid.ts             DebridProvider, DebridFile, StoredTorrent, etc.
│   ├── stremio.ts            StremioStream interface
│   └── express.d.ts          Express Request augmentation (addonConfig)
├── lib/
│   ├── installBuilder.ts     Install URL and multi-addon generator
│   ├── configureProps.ts     Server-side props for configure page
│   └── configureConstants.ts Debrid provider labels, catalog defaults
└── app/                      Next.js pages
    ├── configure/page.tsx    Configure page
    ├── configure/install/    Install page
    └── globals.css           Global styles
```

---

## Local Development

```bash
npm install
BACKEND_URL=https://your-backend.example.com node --watch src/server.ts
# Open http://localhost:7000/configure
```

Or with Docker:

```bash
docker build -t stremio-tpb-porn .
docker run -p 7000:7000 -e BACKEND_URL=https://your-backend.example.com stremio-tpb-porn
```

---

## Documentation

Full internal documentation in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | High-level overview, request flow, config and provider wiring |
| [`docs/code-structure.md`](docs/code-structure.md) | Module-by-module tour of every file in `src/` |
| [`docs/configuration.md`](docs/configuration.md) | All environment variables, defaults, and precedence rules |
| [`docs/providers-and-streams.md`](docs/providers-and-streams.md) | Debrid provider internals, sources, TPDB/StashDB metadata |
| [`docs/development.md`](docs/development.md) | Local setup, Docker, Redis, testing tips |

---

## Related

- **[Adult Addons](https://adult-addons.click)** - curated directory of NSFW Stremio addons with one-click install links
- **[torrent-search-go](https://github.com/ghostyshell/torrent-search-go)** - the Go backend that powers scraping, catalog, and meta
- **[r/StremioAddons thread](https://www.reddit.com/r/StremioAddons/comments/1tsi6nu/nsfw_addon_for_4k_adult_content/)** - NSFW addon for 4K adult content discussion
- **[r/StremioAddonsNSFW](https://www.reddit.com/r/StremioAddonsNSFW/)** - community for NSFW Stremio addons
- **[r/TPB4KPorn](https://www.reddit.com/r/TPB4KPorn/)** - this addon's subreddit

---

## License

GPL-3.0-or-later - see [LICENSE](LICENSE).
