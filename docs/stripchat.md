# Stripchat Live Cams

How the addon proxies [Stripchat](https://stripchat.com) live cam streams into Stremio as playable HLS.

Stripchat obfuscates its media playlists with a MOUFLON v2 scheme: segment URIs are encrypted and gated behind a rotating `pkey`/`pdkey` pair. The addon decrypts them server-side and serves a plain, web-ready HLS playlist so Stremio's internal `hls.js` player plays the stream inline (no external-player handoff).

---

## End-to-end flow

```
Stremio catalog request (/catalog/Porn/sc_girls.json)
      |
      v
Go backend proxies Stripchat broadcasts API -> live model list
      |
      v
User opens a model -> /stream/Porn/sc:<username>.json
      |
      v
stripchatStreams() (src/services/stripchatHls.ts)
  |- fetchCam(username)         -> CamData { streamName, isLive }
  |- getPkey(streamName)        -> pkey extracted from master m3u8 PSCH tag
  |- getMaster(...)             -> master m3u8 with pkey appended
  |- parseVariants(master)      -> [{ name: "1920x1080", url, bandwidth }, ...]
  \- returns one stream entry per variant, each with behaviorHints.notWebReady = false
      |
      v
Stremio picks a variant and requests the stream URL:
  /stripchat/hls/<username>/<quality>
      |
      v
stripchat HLS proxy (src/createExpressApp.ts:198)
  |- fetchCam + getPkey
  |- fetchWithPkey(variantUrl, pkey) -> raw m3u8
  |- isAdvertPlaylist(raw)?          -> 502 + refreshPkey (stale)
  |- decodeMouflonPlaylist(raw, pdkey)  -> decrypts #EXT-X-MOUFLON:URI: tags
  |- normalizeStripchatM3u8(body)       -> strips LL-HLS tags (PART, PRELOAD-HINT, ...)
  |- rewriteM3u8Urls(body, baseUrl)     -> absolute CDN segment URLs
  \- serves application/vnd.apple.mpegurl (no CSP header)
      |
      v
Stremio's hls.js player fetches each segment via:
  /stripchat/seg?url=<encoded doppiocdn URL>
      |
      v
stripchat seg proxy (src/createExpressApp.ts:256)
  |- SSRF guard: only edge-hls|media-hls.doppiocdn.* hosts
  |- .m3u8 sub-playlist -> fetch with pkey, decrypt, rewrite, recurse
  \- segment / init -> passthrough stream pipe
```

---

## Why it plays in the Stremio internal player

Two changes were needed (shipped in 1.9.78 and 1.9.79):

1. **`behaviorHints.notWebReady = false`** on every variant (`src/services/stripchatHls.ts`). The `/stripchat/hls` proxy serves a standard, MOUFLON-decrypted HLS playlist with direct CDN segments - fully web-ready, the same shape debrid streams play inline. The prior `notWebReady: true` told Stremio to skip its internal player and hand off to external players, of which only MPV could play live HLS.
2. **CSP skipped on `/stripchat/*`** (`src/createExpressApp.ts`). The global CSP middleware (added in 1.9.71) set `Content-Security-Policy` including `frame-ancestors https://web.stremio.com ...` on every response, including the `/stripchat/hls` and `/stripchat/seg` media-proxy responses. Stripchat stream URLs point at the addon's own proxy (unlike debrid streams, which point at external CDNs and never receive the addon CSP), so Stremio's player was handed a CSP-gated m3u8 - the playlist loaded but playback never started. CSP and `frame-ancestors` are document headers with no security value on non-HTML `application/vnd.apple.mpegurl` / `video/MP2T` subresource responses; the middleware now skips CSP on `/stripchat/*` (alongside the existing `/configure` HTML-GET skip).

---

## Files

| File | Role |
|------|------|
| `src/services/stripchatHls.ts` | Broadcasts API client, master m3u8 fetch + variant parsing, segment URL rewriting, stream entry builder (`stripchatStreams`). Exports: `fetchCam`, `getMaster`, `getVariants`, `parseVariants`, `withPkeyParams`, `fetchWithPkey`, `rewriteM3u8Urls`, `isAdvertPlaylist`, `stripchatStreams`, `ALLOWED_CDN_RE`. |
| `src/services/stripchatKeys.ts` | `pkey` extraction from the master m3u8 (`getPkey`, `refreshPkey`, `invalidatePkey`). Cached in `stripchatKeyCache`; auto-invalidated when a stale-advert playlist is detected. |
| `src/services/stripchatMouflon.ts` | MOUFLON v2 `pdkey` registry loaded from `PD_KEY_*` env vars (`getStripchatPdkeys`), segment URI decryption (`decryptMouflonUri`, `decodeMouflonPlaylist`), and LL-HLS tag stripping (`normalizeStripchatM3u8`). |

---

## Routes

Both routes are registered in `src/createExpressApp.ts` **before** the `/:config` catch-all. They take no config prefix - the proxy is stateless and the `pkey` is auto-extracted from the master m3u8.

### `GET /stripchat/hls/:username/:quality`

Serves a decrypted, web-ready master or variant m3u8.

| Param | Value |
|-------|-------|
| `username` | Stripchat model username |
| `quality` | `auto` / `source` (picks the highest-bandwidth variant), or a resolution string like `1920x1080` |

Response: `application/vnd.apple.mpegurl`, `Cache-Control: no-cache`. No CSP header (see above).

On a stale-advert playlist (the upstream rotated its `pkey`), returns 502 and triggers a background `refreshPkey(streamName)` so the next request gets the fresh key.

### `GET /stripchat/seg?url=<encoded>`

Fetches a segment or sub-playlist from the doppiocdn CDN. **SSRF guard:** only `edge-hls.doppiocdn.{com,org,net,media}` and `media-hls.doppiocdn.{com,org,net,media}` hosts are allowed (`ALLOWED_CDN_RE`); any other host returns 403.

- Sub-playlist (`*.m3u8` / `*.m3u`): fetched with the current `pkey`, MOUFLON-decrypted, normalized, and rewritten (recursive).
- Segment / init segment (`*.ts`, `*.mp4`, `*.m4s`, `_init.m4s`): passthrough stream pipe, no `pkey` needed.

---

## Configuration

The MOUFLON v2 `pdkey` pairs are **not** in the repo. Load them as environment variables of the form:

```
PD_KEY_<pkey>=<pkey>:<pdkey>
```

One per known pair. `stripchatMouflon.ts` parses every `PD_KEY_*` env var at first access and caches the `{ pkey: pdkey }` map for the lifetime of the process. The `pkey` half is what the master m3u8's `#EXT-X-MOUFLON:PSCH:v2:` tag carries; the addon matches it to a loaded `pdkey` and uses that to decrypt the segment URIs.

Source for the key pairs and decode algorithm: community reverse-engineering linked in `src/services/stripchatMouflon.ts` (StreaMonitor, goondvr).

Stripchat catalog visibility (`sc_girls`, `sc_couples`, `sc_guys`, `sc_trans`) is configured on the configure page. Fresh installs default to Girls and Couples on, Guys and Trans off (changed in 1.9.76).

---

## Caching

| Cache (Redis prefix) | Contents | TTL |
|---------------------|----------|-----|
| `stripchat:key:v1:` | Last extracted `pkey` (per-process singleton, invalidated on stale advert) | short |
| `stripchat:variant:v1:` | Parsed variant list per `(username, streamName)` | short |

Both degrade to no-ops when Redis is unavailable; the proxy re-extracts the `pkey` and re-fetches the master m3u8 on every request.
