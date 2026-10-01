#!/bin/sh
# 30-tutor.sh — runs at container start, before nginx (last of this image's hooks). The official
# nginx image executes every executable *.sh in /docker-entrypoint.d; the Dockerfile installs it.
#
# Writes where nginx sends /api/ (the tutor sidecar, server/), included by nginx.conf inside
# `location /api/`:
#
#     /tmp/precalc/tutor.conf
#
# Inputs (environment):
#   TUTOR_UPSTREAM   host:port of the tutor. Default 127.0.0.1:3000: the sidecar in the same
#                    Container Apps replica shares nginx's localhost. Where the tutor is its own
#                    container on a shared Docker network, name it: tutor:3000.
#
# An IPv4 address (or localhost) is written as it always was:
#
#     proxy_pass http://127.0.0.1:3000;
#
# A name is different. nginx looks a literal name up once, at start-up, and refuses to start when
# that fails; it would also keep the first address for good. So a name goes through a variable,
# which makes nginx look it up per request with the container's own DNS servers (/etc/resolv.conf;
# Docker's embedded DNS is 127.0.0.11) and forget the answer after 10 s:
#
#     resolver 127.0.0.11 valid=10s ipv6=off;
#     resolver_timeout 2s;
#     set $precalc_tutor "tutor:3000";
#     proxy_pass http://$precalc_tutor;
#
# nginx therefore starts whether or not the tutor exists, and finds a re-created tutor (new
# address) by itself. While the name does not resolve or nothing answers, /api/ gets the same
# 503 {"error":"tutor offline"} as with no sidecar (nginx.conf, @tutor_offline).
#
# A value that is not host:port aborts start-up: it is written into nginx config.
set -eu

DIR="${PRECALC_RUNTIME_DIR:-/tmp/precalc}"   # override only for local tests
me="$(basename "$0")"
log() { echo "$me: $*"; }

upstream="${TUTOR_UPSTREAM:-127.0.0.1:3000}"
host="${upstream%:*}"
port="${upstream##*:}"
bad=0
case "$upstream" in
  *[!A-Za-z0-9.:-]*|*:*:*) bad=1 ;;
  ?*:?*) ;;
  *) bad=1 ;;
esac
case "$host" in
  [.-]*|*[.-]) bad=1 ;;
esac
case "$port" in
  ''|0*|*[!0-9]*) bad=1 ;;
  *) { [ "${#port}" -le 5 ] && [ "$port" -le 65535 ]; } || bad=1 ;;
esac
if [ "$bad" -eq 1 ]; then
  log "ERROR: TUTOR_UPSTREAM must be host:port (a name or an IPv4 address, then a port from 1 to 65535). Refusing to start."
  exit 1
fi

mkdir -p "$DIR"
tmp="$DIR/tutor.conf.tmp"
echo "# Generated at container start by /docker-entrypoint.d/30-tutor.sh - do not edit." > "$tmp"

named=1
case "$host" in
  localhost) named=0 ;;
  *[!0-9.]*) ;;
  *) named=0 ;;
esac

if [ "$named" -eq 0 ]; then
  echo "proxy_pass http://$upstream;" >> "$tmp"
  mv "$tmp" "$DIR/tutor.conf"
  [ -z "${TUTOR_UPSTREAM:-}" ] || log "/api/ goes to $upstream"
  exit 0
fi

# The container's DNS servers; an IPv6 one needs brackets in nginx. One with a zone (fe80::1%eth0)
# is skipped: nginx can't use it.
resolvers=""
if [ -r /etc/resolv.conf ]; then
  while read -r key value _; do
    [ "$key" = nameserver ] || continue
    case "$value" in
      ''|*[!0-9A-Fa-f.:]*) continue ;;
      *:*) value="[$value]" ;;
    esac
    resolvers="$resolvers $value"
  done < /etc/resolv.conf
fi
[ -n "$resolvers" ] || resolvers=" 127.0.0.11"

{
  echo "resolver$resolvers valid=10s ipv6=off;"
  echo "resolver_timeout 2s;"
  echo "set \$precalc_tutor \"$upstream\";"
  echo "proxy_pass http://\$precalc_tutor;"
} >> "$tmp"
mv "$tmp" "$DIR/tutor.conf"
log "/api/ goes to $upstream, looked up through$resolvers"
