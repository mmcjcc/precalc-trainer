#!/bin/sh
# 10-listen.sh — runs at container start, before nginx (first of this image's hooks). The official
# nginx image executes every executable *.sh in /docker-entrypoint.d; the Dockerfile installs it.
#
# Creates the run-time directory and writes the port nginx listens on:
#
#     /tmp/precalc/listen.conf      listen <LISTEN_PORT>;        (included by nginx.conf's server {})
#
# Everything this image writes after it is built lives in /tmp/precalc: this file, config.js and
# sign-out.conf (20-config.sh), allowlist.map and identity.conf (25-allowlist.sh), nginx's temp
# directories; nginx's pid file is /tmp/nginx.pid. Nothing else in the image is written to, so it
# also runs as any non-root user on a read-only root file system, given a writable /tmp (a tmpfs
# is enough). On Azure Container Apps it runs as before: root, writable, port 80.
#
# Inputs (environment):
#   LISTEN_PORT   the port nginx listens on, plain HTTP, all IPv4 addresses. Default 80, which is
#                 what Azure's ingress targets (--target-port 80). Use a port above 1024 (8080)
#                 where the container has no right to bind low ports. The image's HEALTHCHECK
#                 follows the same variable.
#
# Anything that is not a port number aborts start-up: it is written into nginx config.
set -eu

DIR="${PRECALC_RUNTIME_DIR:-/tmp/precalc}"   # override only for local tests
me="$(basename "$0")"
log() { echo "$me: $*"; }

port="${LISTEN_PORT:-80}"
bad=0
case "$port" in
  ''|0*|*[!0-9]*) bad=1 ;;
  *) { [ "${#port}" -le 5 ] && [ "$port" -le 65535 ]; } || bad=1 ;;
esac
if [ "$bad" -eq 1 ]; then
  log "ERROR: LISTEN_PORT must be a port number from 1 to 65535. Refusing to start."
  exit 1
fi

if ! mkdir -p "$DIR" 2>/dev/null || ! [ -w "$DIR" ]; then
  log "ERROR: cannot write $DIR. This image keeps its start-up files under /tmp: mount a tmpfs there when the root file system is read-only. Refusing to start."
  exit 1
fi

tmp="$DIR/listen.conf.tmp"
{
  echo "# Generated at container start by /docker-entrypoint.d/10-listen.sh - do not edit."
  echo "listen $port;"
} > "$tmp"
mv "$tmp" "$DIR/listen.conf"

[ "$port" = 80 ] || log "listening on port $port"
