# syntax=docker/dockerfile:1
# Precalc Trainer tutor sidecar (server/) — its own small image, run as a second container in the
# same Container App replica as the nginx web image. nginx proxies /api/ to it on 127.0.0.1:3000.
#   build   : node:22-alpine, `npm ci` + esbuild -> one file, server/dist/tutor.mjs (SDKs inside)
#   runtime : node:22-alpine running that file as the unprivileged `node` user; no node_modules
#
# Build from the REPOSITORY ROOT (it needs package.json and src/shared/tutor.ts):
#   docker build --platform linux/amd64 -f server/Dockerfile -t precalc-tutor .
# Run alone with the mock provider (HOST=0.0.0.0 only because docker's port mapping needs it; on
# Azure it stays on 127.0.0.1, reachable only from nginx in the same replica):
#   docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e TUTOR_PROVIDER=mock -e ALLOWED_USERS=kid@example.com precalc-tutor
#   curl -s -H 'X-MS-CLIENT-PRINCIPAL-NAME: kid@example.com' http://localhost:3000/api/tutor/status
# Configuration (environment): server/src/config.ts. Contract checks: deploy/smoke-tutor.sh.

# ---- build stage --------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src/shared/tutor.ts src/shared/tutor.ts
COPY server server
RUN node server/build.mjs

# ---- runtime stage ------------------------------------------------------------------------
FROM node:22-alpine

ARG SOURCE_URL=https://github.com/OWNER/precalc-trainer
LABEL org.opencontainers.image.source=$SOURCE_URL \
      org.opencontainers.image.title="Precalc Trainer tutor" \
      org.opencontainers.image.description="Ask-a-question coach sidecar for Precalc Trainer (Gemini or Claude)"

ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=3000

WORKDIR /app
COPY --from=build /app/server/dist/tutor.mjs /app/tutor.mjs
# The monthly JSONL logs go to TUTOR_LOG_DIR; on Azure that is an Azure Files mount owned by uid 1000.
RUN mkdir -p /data/tutor-log && chown node:node /data/tutor-log
USER node

EXPOSE 3000
# Container Apps ignores Docker HEALTHCHECK (it has its own probes); this is for local runs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1

CMD ["node", "/app/tutor.mjs"]
