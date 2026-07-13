FROM node:24-alpine

LABEL org.opencontainers.image.title="TPB Porn Stremio Addon" \
      org.opencontainers.image.description="Stremio addon: adult 4K/1080p torrent catalogs from 12 providers (HiddenBay, PornRips, Hentai, Sukebei, TPDB, StashDB) with debrid stream resolution, Stripchat live HLS, and a React/Next.js configure UI" \
      org.opencontainers.image.source="https://github.com/akshatsinghkaushik/stremio-tpb-porn"

WORKDIR /app

COPY package.json package-lock.json ./
# The install command and the prod/dev split below are both load-bearing for
# building cold on the Sliplane builder (SLIPLANE_SKIP_CACHE forces every build
# cold). Root cause: vitest 4 / vite 7 / @vitest/coverage-v8 (devDependencies)
# pull a native-binary stack whose fetch hangs on the Sliplane builder. Two
# things must both hold or the build hangs for the 1h timeout:
#   1. npm ci must NOT install those dev deps -> --omit=dev. vitest/vite/
#      @vitest/coverage-v8 stay absent (the only devDeps left).
#   2. `next build` must NOT auto-install them. Next 16 auto-installs EVERY
#      devDep (including vitest) when `typescript` is missing from node_modules,
#      and that re-fetch hangs the same way. So typescript + @types/* are moved
#      to `dependencies` in package.json: --omit=dev still installs them (they
#      are prod now), next build finds typescript present, and the auto-install
#      never fires. vitest is never fetched, by either step.
# --ignore-scripts additionally skips the esbuild/@rolldown/binding postinstall
# binary fetches; their platform binaries ship as npm optionalDeps that
# esbuild/rolldown locate at require time, so next build + the tsx runtime work
# with scripts skipped. Verified on node:24-alpine: cold npm ci ~6s (typescript
# present, vitest absent), next build ~9s with no "Installing devDependencies"
# banner, BUILD_ID present, no auto-install of vitest.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY src/ ./src/
COPY public/ ./public/
COPY next.config.js tsconfig.json next-env.d.ts ./

RUN npm run build

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:7000/health || exit 1

CMD ["npm", "start"]
