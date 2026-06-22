FROM node:24-alpine

LABEL org.opencontainers.image.title="TPB Porn Stremio Addon" \
      org.opencontainers.image.description="Stremio addon: adult torrent catalogs with Real-Debrid" \
      org.opencontainers.image.source="https://github.com/akshatsinghkaushik/stremio-tpb-porn"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/
COPY next.config.js tsconfig.json next-env.d.ts ./

RUN npm run build

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:7000/health || exit 1

CMD ["npm", "start"]
