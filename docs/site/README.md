# TPB 4K Porn Stremio Addon — marketing site

Single-file static landing page for [stremio-tpb-porn](https://github.com/akshatsinghkaushik/stremio-tpb-porn). No build step.

## Stack

- `docs/index.html` — hand-written HTML, Tailwind via Play CDN, vanilla JS for the dynamic year.
- `docs/privacy.html` — privacy policy page, same theme and CDN.
- Google Fonts: **Space Grotesk** (display/hero) + **Inter** (body).
- SVG-only assets — `favicon.svg`, `og-image.svg` — fully text-diffable.

## Design system

- Background: `#0F0F23` · Primary: `#1E1B4B` · Secondary: `#4338CA`
- Accent/CTA: `#22C55E` (play green) · Foreground: `#F8FAFC`
- Muted: `#27273B` · Border: `#312E81`
- Style: Cinematic Vibrant / block-based, dark.

## SEO checklist (applied)

- Semantic `<header>`, `<main>`, `<section>`, `<footer>`, `<article>`, `<ol>`, `<details>`.
- Single `<h1>`; sequential heading hierarchy.
- `<title>`, `<meta description>`, `<meta keywords>`, `<link rel="canonical">`.
- Open Graph + Twitter Card with 1200×630 SVG OG image.
- JSON-LD: `SoftwareApplication`, `FAQPage`, `WebSite`.
- `robots.txt` + `sitemap.xml` (lists index.html, privacy.html, and all .md docs).
- `site.webmanifest` for PWA / install prompt.
- `prefers-reduced-motion` respected (animations gated).
- WCAG-conscious contrast: slate-100 on `#0F0F23`, `#22C55E` accents on dark surfaces.
- Skip-link for keyboard users.
- `aria-label`s on icon-only SVGs; `aria-hidden` on decorative ones.
- Visible `:focus-visible` ring (2px solid accent).

## Layout

```
docs/
├── index.html          Landing page (GitHub Pages root)
├── privacy.html        Privacy policy
├── .nojekyll           Disables Jekyll processing
├── architecture.md     Technical docs
├── code-structure.md
├── configuration.md
├── providers-and-streams.md
├── development.md
└── site/               Supporting assets (this folder)
    ├── favicon.svg
    ├── og-image.svg    1200×630 SVG social card
    ├── robots.txt
    ├── sitemap.xml
    ├── site.webmanifest
    └── README.md       (this file)
```

## Local preview

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

- **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/docs`.
- Site publishes to `https://akshatsinghkaushik.github.io/stremio-tpb-porn/`.
- All canonical / OG / sitemap / manifest URLs already point there.
- To switch to a custom domain: search-and-replace `akshatsinghkaushik.github.io/stremio-tpb-porn` → your domain in `index.html`, `privacy.html`, and `docs/site/{robots.txt,sitemap.xml,site.webmanifest}`.

## Updating

When a new release ships, update in `docs/index.html`:

1. The version string in the JSON-LD `softwareVersion` field.
2. The hero pill text if the tagline changes.

Bump `<lastmod>` in `docs/site/sitemap.xml` on any non-trivial copy change.
