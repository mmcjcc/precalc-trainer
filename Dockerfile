# syntax=docker/dockerfile:1
# Precalc Trainer — multi-stage image.
#   build   : node:22-alpine, `npm ci` + `vite build`  -> /app/dist (~2.5 MB of static files)
#   runtime : nginx:stable-alpine-slim serving dist/ with nginx.conf; ~20-25 MB on disk
#
# Build (linux/amd64 is the only architecture Azure Container Apps runs; matters on ARM Macs):
#   docker build --platform linux/amd64 -t precalc-trainer .
# Run locally (AUTH_ALLOWLIST=off: no sign-in layer in front, so let every request through):
#   docker run --rm -p 8080:80 -e AUTH_ALLOWLIST=off precalc-trainer
#   curl -s http://localhost:8080/config.js
# Full recipe and the Azure steps: deploy/azure.md
#
# One image, two kinds of host. The defaults are Azure's: root, port 80, the account in
# X-MS-CLIENT-PRINCIPAL-NAME, the tutor on 127.0.0.1:3000. The image is never written to after
# the build (everything written at start-up goes to /tmp/precalc), so it also runs locked down
# on a plain Docker host behind another sign-in proxy, with the tutor as a second container:
#   docker run --rm --user 10002:10002 --read-only --tmpfs /tmp:size=64m --cap-drop ALL \
#     --security-opt no-new-privileges -p 127.0.0.1:8080:8080 -e LISTEN_PORT=8080 \
#     -e AUTH_HEADER=X-Auth-Request-Email -e ALLOWED_USERS=kid@example.com \
#     -e 'SIGN_OUT_URL=https://auth.example.com/oauth2/sign_out?rd=https%3A%2F%2Fapp.example.com%2F' \
#     -e TUTOR_UPSTREAM=tutor:3000 precalc-trainer
# Every setting is an environment variable, documented at the top of its hook in docker/.

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

# Site config: sign-in allowlist, SPA fallback, cache policy, headers, /api/ proxy to the tutor
# sidecar (503 JSON "tutor offline" when there is none, as in this image alone). Replaces the
# stock default.conf, which the image's /etc/nginx/nginx.conf includes inside http {}.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Start-up hooks. The stock entrypoint runs every *executable* *.sh in /docker-entrypoint.d, in
# name order, before nginx starts; a hook that exits non-zero stops the container. Each writes
# into /tmp/precalc, never into the image, and documents its environment variables at its top.
#   10-listen.sh     listen.conf (LISTEN_PORT), and creates /tmp/precalc
#   20-config.sh     config.js (PIN hash, sign-out link) and sign-out.conf (SIGN_OUT_URL)
#   25-allowlist.sh  allowlist.map from ALLOWED_USERS (who may load the app), identity.conf (AUTH_HEADER)
#   30-tutor.sh      tutor.conf (TUTOR_UPSTREAM: where /api/ goes)
# not-allowed.html is the 403 page for signed-in accounts that are not on the list.
COPY docker/10-listen.sh docker/20-config.sh docker/25-allowlist.sh docker/30-tutor.sh /docker-entrypoint.d/
COPY docker/not-allowed.html /usr/share/nginx/errors/not-allowed.html
# In order:
#   * sed strips CRLF in case the files were checked out on Windows; chmod makes the hooks executable.
#   * The stock main config is made to work without root and without a writable image: the pid
#     file moves to /tmp, and the `user nginx;` line goes. Started as root (Azure) the workers
#     still drop to nginx:nginx, the user this nginx is compiled with; started as anyone else the
#     line would only log a warning. The two greps fail the build if a new base image words those
#     lines differently.
#   * The stock IPv6 hook is removed: it only ever edits the packaged default.conf, which this
#     image replaces, and on a read-only file system it logs a misleading "can not modify" line.
#   * The hooks run twice, with the defaults and with every optional setting, and `nginx -t`
#     checks each result, so a typo in nginx.conf or in a hook's output fails the build. What
#     they wrote is deleted again: a container that somehow starts without its hooks finds no
#     listen.conf or allowlist and nginx refuses to start, which keeps it closed.
#   * The stock html goes before dist/ lands.
RUN cd /docker-entrypoint.d \
 && sed -i 's/\r$//' 10-listen.sh 20-config.sh 25-allowlist.sh 30-tutor.sh \
 && chmod 0755 10-listen.sh 20-config.sh 25-allowlist.sh 30-tutor.sh \
 && sed -i -e '/^user[[:space:]]/d' -e 's,^pid[[:space:]].*,pid        /tmp/nginx.pid;,' /etc/nginx/nginx.conf \
 && grep -q '^pid        /tmp/nginx.pid;$' /etc/nginx/nginx.conf \
 && ! grep -q '^[[:space:]]*user[[:space:]]' /etc/nginx/nginx.conf \
 && rm -f 10-listen-on-ipv6-by-default.sh \
 && ./10-listen.sh && ./20-config.sh && ./25-allowlist.sh && ./30-tutor.sh && nginx -t \
 && export LISTEN_PORT=8080 AUTH_HEADER=X-Auth-Request-Email ALLOWED_USERS=kid@example.com \
      SIGN_OUT_URL='https://auth.example.com/oauth2/sign_out?rd=https%3A%2F%2Fapp.example.com%2F' \
      TUTOR_UPSTREAM=tutor:3000 \
 && ./10-listen.sh && ./20-config.sh && ./25-allowlist.sh && ./30-tutor.sh && nginx -t \
 && rm -rf /tmp/precalc /tmp/nginx.pid /usr/share/nginx/html/*

# config.js is left out on purpose: public/config.js is the dev default (no PIN, no sign-out
# link), and the real one is written at start-up and served from /tmp/precalc.
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/config.js

# 80 is the default port (Azure's ingress targets it); LISTEN_PORT changes it, and the check follows.
EXPOSE 80
# Container Apps ignores Docker HEALTHCHECK (it has its own probes); this is for Docker hosts.
# /healthz is outside the allowlist, so this works whether or not anyone is allowed in. The first
# 10 s are checked every 2 s, so a started container shows as healthy within seconds.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${LISTEN_PORT:-80}/healthz" >/dev/null 2>&1 || exit 1

# ENTRYPOINT/CMD are inherited from the nginx image: /docker-entrypoint.sh nginx -g 'daemon off;'
