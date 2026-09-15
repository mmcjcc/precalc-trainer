# syntax=docker/dockerfile:1
# Precalc Trainer — multi-stage image.
#   build   : node:22-alpine, `npm ci` + `vite build`  -> /app/dist (~2.5 MB of static files)
#   runtime : nginx:stable-alpine-slim serving dist/ with nginx.conf; ~20-25 MB on disk
#
# Build (linux/amd64 is the only architecture Azure Container Apps runs; matters on ARM Macs):
#   docker build --platform linux/amd64 -t precalc-trainer .
# Run:
#   docker run --rm -p 8080:80 -e APP_PIN=1234 precalc-trainer
#   curl -s http://localhost:8080/config.js
# Full recipe and the Azure steps: deploy/azure.md

# ---- build stage --------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Vite is invoked through node on purpose: the repo's npm scripts are unreliable on the dev
# box (see CLAUDE.md) and `npm run build` would also repeat the typecheck that CI runs.
RUN node node_modules/vite/bin/vite.js build

# ---- runtime stage ------------------------------------------------------------------------
# nginx:alpine is ~69 MB on disk, which already blows the 60 MB budget; alpine-slim is ~19 MB
# and still ships what we use: the /docker-entrypoint.d hook, busybox (sha256sum, sed, grep,
# wget), gzip and openssl. For reproducible pulls pin a digest, e.g.
#   FROM nginx:stable-alpine-slim@sha256:<digest from `docker pull`>
FROM nginx:stable-alpine-slim

# Lets GHCR link the package to the repo; the deploy workflow passes the real URL.
ARG SOURCE_URL=https://github.com/OWNER/precalc-trainer
LABEL org.opencontainers.image.source=$SOURCE_URL \
      org.opencontainers.image.title="Precalc Trainer" \
      org.opencontainers.image.description="Step-by-step precalculus trainer (static SPA behind nginx)"

# Site config: SPA fallback, cache policy, headers, /api stub. Replaces the stock default.conf,
# which the image's /etc/nginx/nginx.conf includes inside http {}.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Start-up hook: writes /usr/share/nginx/html/config.js from APP_PIN / APP_PIN_HASH.
# The stock entrypoint runs every *executable* *.sh in /docker-entrypoint.d before nginx starts.
# sed strips CRLF in case the file was checked out on Windows; chmod makes it executable;
# nginx -t fails the build on a config typo; the stock html is removed before dist/ lands.
COPY docker/20-config.sh /docker-entrypoint.d/20-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/20-config.sh \
 && chmod 0755 /docker-entrypoint.d/20-config.sh \
 && nginx -t \
 && rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# Container Apps ignores Docker HEALTHCHECK (it has its own probes); this is for local runs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

# ENTRYPOINT/CMD are inherited from the nginx image: /docker-entrypoint.sh nginx -g 'daemon off;'
