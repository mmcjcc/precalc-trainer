#!/bin/sh
# 20-config.sh — runs at container start, before nginx. (The official nginx image executes
# every executable *.sh in /docker-entrypoint.d; the Dockerfile installs this file there.)
#
# Writes the runtime config the SPA loads from /config.js (index.html: <script src="/config.js">):
#
#     window.__PRECALC_CONFIG__ = { pinHash: "<sha256 hex>", signOutUrl: "<path or empty>" };
#
# to /tmp/precalc/config.js, which nginx.conf serves as /config.js (the image itself is never
# written to after the build, so it also runs on a read-only root file system).
#
# signOutUrl is /.auth/logout unless AUTH_ALLOWLIST=off and SIGN_OUT_URL is empty, which means
# there is no sign-in layer; Settings shows a Sign out link when it is set. On Azure that path is
# answered by Container Apps sign-in, not nginx. Behind any other sign-in proxy set SIGN_OUT_URL:
# this script then also writes /tmp/precalc/sign-out.conf, which makes nginx answer /.auth/logout
# with a redirect to that URL. The app and the 403 page keep one same-site sign-out path that way.
#
# Inputs (environment):
#   APP_PIN_HASH  64-char SHA-256 hex of the PIN; used verbatim (lower-cased) when set — lets
#                 the plaintext PIN stay out of Azure entirely. Wins over APP_PIN.
#   APP_PIN       plaintext PIN; hashed here with sha256sum over the exact bytes (no trailing
#                 newline), which is what the browser computes with crypto.subtle over the PIN
#                 as typed. Whitespace is significant on both sides.
#   APP_PIN_HASH_FILE, APP_PIN_FILE
#                 the same two values read from a file (a mounted secret such as
#                 /run/secrets/APP_PIN); line ends are dropped. The plain variable wins over its
#                 file, and a hash still wins over a PIN. A file that cannot be read aborts start-up.
#   neither/empty -> pinHash "" -> the app shows no PIN gate.
#   SIGN_OUT_URL  absolute http(s) URL of the sign-in layer's sign-out page, for hosts other than
#                 Azure. Example: https://auth.example.com/oauth2/sign_out?rd=https%3A%2F%2Fapp.example.com%2F
#                 Empty (Azure, local runs): nginx does not answer /.auth/logout itself.
#
# A malformed hash aborts start-up on purpose: shipping it would lock everyone out silently.
# The hash is public by design (any visitor can GET /config.js): the PIN is a deterrent, not
# authentication. See deploy/azure.md, "Security honesty".
set -eu

DIR="${PRECALC_RUNTIME_DIR:-/tmp/precalc}"       # override only for local tests
OUT="${PRECALC_CONFIG_PATH:-$DIR/config.js}"     # override only for local tests
me="$(basename "$0")"
log() { echo "$me: $*"; }

# need_file <NAME> <path> — aborts unless the file a *_FILE variable names can be read.
need_file() {
  if [ ! -f "$2" ] || [ ! -r "$2" ]; then
    log "ERROR: $1 is set but that file cannot be read. Refusing to start."
    exit 1
  fi
}

hash=""
source="none"
if [ -n "${APP_PIN_HASH:-}" ]; then
  hash=$(printf '%s' "$APP_PIN_HASH" | tr 'A-F' 'a-f')
  source="APP_PIN_HASH"
elif [ -n "${APP_PIN_HASH_FILE:-}" ]; then
  need_file APP_PIN_HASH_FILE "$APP_PIN_HASH_FILE"
  hash=$(tr -d '\r\n' < "$APP_PIN_HASH_FILE" | tr 'A-F' 'a-f')
  source="APP_PIN_HASH_FILE"
elif [ -n "${APP_PIN:-}" ] || [ -n "${APP_PIN_FILE:-}" ]; then
  if [ -n "${APP_PIN:-}" ]; then
    pin="$APP_PIN"
    source="APP_PIN"
  else
    need_file APP_PIN_FILE "$APP_PIN_FILE"
    pin=$(tr -d '\r\n' < "$APP_PIN_FILE")
    source="APP_PIN_FILE"
    if [ -z "$pin" ]; then
      log "ERROR: APP_PIN_FILE is set but that file is empty. Refusing to start."
      exit 1
    fi
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    hash=$(printf '%s' "$pin" | sha256sum | cut -d' ' -f1)
  else
    hash=$(printf '%s' "$pin" | openssl dgst -sha256 | sed 's/^.*= *//')
  fi
  unset pin
fi

# case, not grep: grep -E tests one line at a time, so a value with a newline in it would pass
# the pattern and write a broken /config.js.
bad=0
if [ -n "$hash" ]; then
  case "$hash" in
    *[!0-9a-f]*) bad=1 ;;
    *) [ "${#hash}" -eq 64 ] || bad=1 ;;
  esac
elif [ "$source" = "APP_PIN_HASH_FILE" ]; then
  bad=1   # the file was named, so an empty one is a mistake, not "no PIN"
fi
if [ "$bad" -eq 1 ]; then
  log "ERROR: $source is not a 64-character SHA-256 hex string (got ${#hash} chars). Refusing to start."
  exit 1
fi

# SIGN_OUT_URL is written into nginx config inside double quotes, so only plain URL characters
# are let through (no quote, backslash, $, ;, braces or white space).
signouturl="${SIGN_OUT_URL:-}"
if [ -n "$signouturl" ]; then
  bad=0
  case "$signouturl" in
    *[!A-Za-z0-9._~:/?\&=%+@-]*) bad=1 ;;
    https://?*|http://?*) ;;
    *) bad=1 ;;
  esac
  if [ "$bad" -eq 1 ]; then
    log "ERROR: SIGN_OUT_URL must be an http(s) URL made of A-Z a-z 0-9 . _ ~ : / ? & = % + @ - only. Refusing to start."
    exit 1
  fi
fi

signout=""
if [ "${AUTH_ALLOWLIST:-on}" != "off" ] || [ -n "$signouturl" ]; then
  signout="/.auth/logout?post_logout_redirect_uri=/"
fi

mkdir -p "$DIR" "$(dirname "$OUT")"
tmp="$OUT.tmp"
{
  echo "// Generated at container start by /docker-entrypoint.d/20-config.sh — do not edit."
  echo "window.__PRECALC_CONFIG__ = { pinHash: \"$hash\", signOutUrl: \"$signout\" };"
} > "$tmp"
mv "$tmp" "$OUT"

# Included inside nginx.conf's server {}. The location is open on purpose: an account that is not
# on the list has to be able to sign out too, and it only ever redirects to the one URL set here.
tmp="$DIR/sign-out.conf.tmp"
{
  echo "# Generated at container start by /docker-entrypoint.d/20-config.sh - do not edit."
  if [ -n "$signouturl" ]; then
    echo "location = /.auth/logout { return 302 \"$signouturl\"; }"
  fi
} > "$tmp"
mv "$tmp" "$DIR/sign-out.conf"

if [ -n "$hash" ]; then
  log "PIN gate enabled (pinHash from $source: $(printf '%s' "$hash" | cut -c1-8)...)"
else
  log "no APP_PIN / APP_PIN_HASH set: PIN gate disabled"
fi
[ -z "$signouturl" ] || log "sign-out: /.auth/logout redirects to $signouturl"
