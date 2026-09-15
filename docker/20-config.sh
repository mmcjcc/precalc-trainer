#!/bin/sh
# 20-config.sh — runs at container start, before nginx. (The official nginx image executes
# every executable *.sh in /docker-entrypoint.d; the Dockerfile installs this file there.)
#
# Writes the runtime config the SPA loads from /config.js (index.html: <script src="/config.js">):
#
#     window.__PRECALC_CONFIG__ = { pinHash: "<sha256 hex>" };
#
# Inputs (environment):
#   APP_PIN_HASH  64-char SHA-256 hex of the PIN; used verbatim (lower-cased) when set — lets
#                 the plaintext PIN stay out of Azure entirely. Wins over APP_PIN.
#   APP_PIN       plaintext PIN; hashed here with sha256sum over the exact bytes (no trailing
#                 newline), which is what the browser computes with crypto.subtle over the PIN
#                 as typed. Whitespace is significant on both sides.
#   neither/empty -> pinHash "" -> the app shows no PIN gate.
#
# A malformed hash aborts start-up on purpose: shipping it would lock everyone out silently.
# The hash is public by design (any visitor can GET /config.js): the PIN is a deterrent, not
# authentication. See deploy/azure.md, "Security honesty".
set -eu

OUT="${PRECALC_CONFIG_PATH:-/usr/share/nginx/html/config.js}"   # override only for local tests
me="$(basename "$0")"
log() { echo "$me: $*"; }

hash=""
source="none"
if [ -n "${APP_PIN_HASH:-}" ]; then
  hash=$(printf '%s' "$APP_PIN_HASH" | tr 'A-F' 'a-f')
  source="APP_PIN_HASH"
elif [ -n "${APP_PIN:-}" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    hash=$(printf '%s' "$APP_PIN" | sha256sum | cut -d' ' -f1)
  else
    hash=$(printf '%s' "$APP_PIN" | openssl dgst -sha256 | sed 's/^.*= *//')
  fi
  source="APP_PIN"
fi

if [ -n "$hash" ] && ! printf '%s' "$hash" | grep -Eq '^[0-9a-f]{64}$'; then
  log "ERROR: $source is not a 64-character SHA-256 hex string (got ${#hash} chars). Refusing to start."
  exit 1
fi

tmp="$OUT.tmp"
{
  echo "// Generated at container start by /docker-entrypoint.d/20-config.sh — do not edit."
  echo "window.__PRECALC_CONFIG__ = { pinHash: \"$hash\" };"
} > "$tmp"
mv "$tmp" "$OUT"

if [ -n "$hash" ]; then
  log "PIN gate enabled (pinHash from $source: $(printf '%s' "$hash" | cut -c1-8)...)"
else
  log "no APP_PIN / APP_PIN_HASH set: PIN gate disabled"
fi
