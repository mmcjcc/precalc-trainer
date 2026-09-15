#!/bin/sh
# 25-allowlist.sh — runs at container start, before nginx (after 20-config.sh). The official
# nginx image executes every executable *.sh in /docker-entrypoint.d; the Dockerfile installs it.
#
# Writes the body of the nginx map that decides who may load the app:
#
#     map $http_x_ms_client_principal_name $precalc_allowed { include /etc/nginx/precalc/allowlist.map; }
#
# On Azure, Container Apps authentication ("Sign in with Google") sits in front of nginx. Every
# signed-in request reaches nginx with X-MS-CLIENT-PRINCIPAL-NAME set to the account's email
# (GitHub sign-in: the username), and requests from the internet cannot set that header while
# sign-in is on. Anyone with a Google account can finish that sign-in, so this list is what
# narrows it down to the family.
#
# Inputs (environment):
#   ALLOWED_USERS   emails (or GitHub usernames) separated by commas or spaces; each must match
#                   the whole header, ignoring case. Example: "kid@gmail.com, parent@gmail.com"
#   AUTH_ALLOWLIST  "off" lets every request through. For local `docker run` and CI only.
#   neither         nobody is allowed: every page answers 403, /healthz still answers 200.
#                   Failing closed means a forgotten setting can't open the app to everyone.
#
# An entry with a character outside A-Z a-z 0-9 . _ % + @ - aborts start-up: entries are written
# into nginx config, where anything else could change what the config means.
#
# The header is only trustworthy while sign-in is switched on for the container app. Check with
# `bash deploy/azure-setup.sh check`; the deploy workflow refuses to roll out when it is off.
set -eu

OUT="${PRECALC_ALLOWLIST_PATH:-/etc/nginx/precalc/allowlist.map}"   # override only for local tests
me="$(basename "$0")"
log() { echo "$me: $*"; }

mkdir -p "$(dirname "$OUT")"
tmp="$OUT.tmp"
echo "# Generated at container start by /docker-entrypoint.d/25-allowlist.sh - do not edit." > "$tmp"

if [ "${AUTH_ALLOWLIST:-on}" = "off" ]; then
  echo "default 1;" >> "$tmp"
  mv "$tmp" "$OUT"
  log "AUTH_ALLOWLIST=off: every request is allowed (local and CI use only)"
  exit 0
fi

echo "default 0;" >> "$tmp"
count=0
set -f   # an entry like "*" must not expand to file names
for user in $(printf '%s' "${ALLOWED_USERS:-}" | tr ',' ' '); do
  if ! printf '%s' "$user" | grep -Eq '^[A-Za-z0-9._%+@-]+$'; then
    log "ERROR: ALLOWED_USERS entry \"$user\" has a character outside A-Z a-z 0-9 . _ % + @ -. Refusing to start."
    rm -f "$tmp"
    exit 1
  fi
  # Case-insensitive, anchored regex; . and + are the only allowed characters that mean something in a regex.
  pattern=$(printf '%s' "$user" | sed 's/[.+]/\\&/g')
  echo "~*^${pattern}\$ 1;" >> "$tmp"
  count=$((count + 1))
done
set +f
mv "$tmp" "$OUT"

if [ "$count" -eq 0 ]; then
  log "no ALLOWED_USERS set: every page answers 403 until the list is set"
else
  log "sign-in allowlist: $count account(s)"
fi
