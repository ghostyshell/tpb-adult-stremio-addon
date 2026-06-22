# TPB 4K Porn - Stremio Addon

**Live configure page:** [tpb-adult-addon.click/configure](https://tpb-adult-addon.click/configure)
**Docs:** [ghostyshell.github.io/tpb-adult-stremio-addon](https://ghostyshell.github.io/tpb-adult-stremio-addon/)
**Source:** [github.com/ghostyshell/tpb-adult-stremio-addon](https://github.com/ghostyshell/tpb-adult-stremio-addon)

---

## What is this?

A self-hosted Stremio addon for 4K and 1080p adult content. It provides browse and search catalogs sourced from ThePirateBay/HiddenBay, PornRips, Hentai, and Sukebei JAV, with optional stream resolution through any of 14 debrid providers. Your debrid key stays in your personal install URL and never touches the server.

## Install

1. Go to [tpb-adult-addon.click/configure](https://tpb-adult-addon.click/configure)
2. Enter your debrid API key (see table below for where to get one)
3. Toggle the catalogs and quality tiers you want
4. Click **Generate Install URLs**
5. Click **Install in Stremio** - done

No account needed. No signup. Open the page, configure, install.

---

## Debrid providers supported

| Provider | Where to get your key |
|----------|----------------------|
| Real-Debrid | [real-debrid.com/apitoken](https://real-debrid.com/apitoken) |
| AllDebrid | [alldebrid.com/apikeys](https://alldebrid.com/apikeys) |
| TorBox | [torbox.app/settings](https://torbox.app/settings) |
| Premiumize | [premiumize.me/account](https://www.premiumize.me/account) |
| EasyDebrid | [easydebrid.com/settings](https://easydebrid.com/settings) |
| Debrid-Link | [debrid-link.com/webapp/apikey](https://debrid-link.com/webapp/apikey) |
| Offcloud | [offcloud.com/#/account](https://offcloud.com/#/account) |
| Put.io | [put.io/oauth/apps](https://put.io/oauth/apps) |
| Deepbrid | [deepbrid.com/devices](https://www.deepbrid.com/devices) |
| LinkSnappy | [linksnappy.com/myaccount](https://linksnappy.com/myaccount) (`username:password`) |
| Mega-Debrid | [mega-debrid.eu](https://www.mega-debrid.eu/index.php?page=api) |
| Debrider | [debrider.app/dashboard/account](https://debrider.app/dashboard/account) |
| Seedr | [seedr.cc](https://www.seedr.cc/) (`email:password`) |
| PikPak | [mypikpak.com](https://mypikpak.com/) (refresh token) |

No debrid? The addon still works with P2P magnet links as a fallback.

---

## Content sources

| Source | Content |
|--------|---------|
| ThePirateBay / HiddenBay | 4K and 1080p adult torrents, Top and Recent sort |
| PornRips | Scene releases with studio, tag, and quality browsing |
| Hentai | Episode-level streams via HentaiMama |
| Sukebei | JAV torrents with StashDB metadata (StashDB key required) |
| TPDB / StashDB categories | Performer and category-browsable catalogs (server key required) |

---

## Self-hosting

The addon is open source and Docker-ready. You need to run it alongside the [torrent-search-go](https://github.com/ghostyshell/torrent-search-go) backend which handles all scraping and metadata.

```bash
docker build -t stremio-tpb-porn .
docker run -p 7000:7000 -e BACKEND_URL=https://your-backend.example.com stremio-tpb-porn
```

See the full [README](../README.md) and [docs/](../docs/) for all environment variables and configuration options.

---

## Community

- [r/StremioAddons - 4K adult content thread](https://www.reddit.com/r/StremioAddons/comments/1tsi6nu/nsfw_addon_for_4k_adult_content/)
- [r/StremioAddonsNSFW](https://www.reddit.com/r/StremioAddonsNSFW/)
- [r/TPB4KPorn](https://www.reddit.com/r/TPB4KPorn/)
- [Discord](https://discord.gg/EbHcTNAqca)
- [Adult Addons directory](https://adult-addons.click)
