#!/bin/sh
# 25-allowlist.sh — runs at container start, before nginx (after 20-config.sh). The official
# nginx image executes every executable *.sh in /docker-entrypoint.d; the Dockerfile installs it.
#
# Writes the two files that decide who may load the app (both included by nginx.conf):
#
#     /tmp/precalc/identity.conf    set $precalc_identity $http_<the sign-in layer's header>;
#     /tmp/precalc/allowlist.map    the body of: map $precalc_identity $precalc_allowed { ... }
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
#   ALLOWED_USERS_FILE
#                   the same list read from a file (a mounted secret such as
#                   /run/secrets/ALLOWED_USERS), for hosts where the addresses must not sit in a
#                   setting; line ends separate entries too. ALLOWED_USERS wins when both are set.
#                   A file that cannot be read aborts start-up, and an entry from a file is never
#                   printed, not even when it is refused.
#   AUTH_ALLOWLIST  "off" lets every request through. For local `docker run` and CI only.
#   neither         nobody is allowed: every page answers 403, /healthz still answers 200.
#                   Failing closed means a forgotten setting can't open the app to everyone.
#   AUTH_HEADER     the request header that carries the signed-in account. Default
#                   X-MS-CLIENT-PRINCIPAL-NAME (Azure). Behind another sign-in proxy name its
#                   header, for example X-Auth-Request-Email (oauth2-proxy). Exactly one header
#                   is trusted, never both: a sign-in layer only strips its own header from
#                   outside requests, so a second trusted name would be one any visitor can send.
#
# An entry with a character outside A-Z a-z 0-9 . _ % + @ - aborts start-up: entries are written
# into nginx config, where anything else could change what the config means. The same goes for
# an AUTH_HEADER that is not letters, digits and dashes.
#
# The header is only trustworthy while sign-in is switched on in front of the container. On Azure
# check with `bash deploy/azure-setup.sh check`; the deploy workflow refuses to roll out when it
# is off.
set -eu

DIR="${PRECALC_RUNTIME_DIR:-/tmp/precalc}"            # override only for local tests
OUT="${PRECALC_ALLOWLIST_PATH:-$DIR/allowlist.map}"   # override only for local tests
me="$(basename "$0")"
log() { echo "$me: $*"; }

header="${AUTH_HEADER:-X-MS-CLIENT-PRINCIPAL-NAME}"
case "$header" in
  *[!A-Za-z0-9-]*|-*|*-)
    log "ERROR: AUTH_HEADER must be a header name made of letters, digits and dashes. Refusing to start."
    exit 1
    ;;
esac
# nginx exposes the request header Some-Name as $http_some_name.
variable="http_$(printf '%s' "$header" | tr 'A-Z-' 'a-z_')"

mkdir -p "$DIR" "$(dirname "$OUT")"
tmp="$DIR/identity.conf.tmp"
{
  echo "# Generated at container start by /docker-entrypoint.d/25-allowlist.sh - do not edit."
  echo "set \$precalc_identity \$$variable;"
} > "$tmp"
mv "$tmp" "$DIR/identity.conf"
[ -z "${AUTH_HEADER:-}" ] || log "the signed-in account is read from the $header header"

# The list: ALLOWED_USERS, or else the file ALLOWED_USERS_FILE names. A named file that can't be
# read stops the container here, whatever else is set: carrying on would mean an empty list.
users="${ALLOWED_USERS:-}"
from="ALLOWED_USERS"
# A variable holding only blanks or commas counts as not set, as it does for the tutor.
[ -n "$(printf '%s' "$users" | tr -d ' ,\t\r\n')" ] || users=""
if [ -z "$users" ] && [ -n "${ALLOWED_USERS_FILE:-}" ]; then
  if [ ! -f "$ALLOWED_USERS_FILE" ] || [ ! -r "$ALLOWED_USERS_FILE" ]; then
    log "ERROR: ALLOWED_USERS_FILE is set but that file cannot be read. Refusing to start."
    exit 1
  fi
  users=$(tr ',\r\n' '   ' < "$ALLOWED_USERS_FILE")
  from="ALLOWED_USERS_FILE"
fi

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
for user in $(printf '%s' "$users" | tr ',' ' '); do
  if ! printf '%s' "$user" | grep -Eq '^[A-Za-z0-9._%+@-]+$'; then
    if [ "$from" = "ALLOWED_USERS" ]; then
      log "ERROR: ALLOWED_USERS entry \"$user\" has a character outside A-Z a-z 0-9 . _ % + @ -. Refusing to start."
    else
      log "ERROR: ALLOWED_USERS_FILE entry $((count + 1)) has a character outside A-Z a-z 0-9 . _ % + @ -. Refusing to start."
    fi
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

if [ "$count" -eq 0 ] && [ "$from" = "ALLOWED_USERS_FILE" ]; then
  log "ALLOWED_USERS_FILE has no entries: every page answers 403 until the list is set"
elif [ "$count" -eq 0 ]; then
  log "no ALLOWED_USERS set: every page answers 403 until the list is set"
elif [ "$from" = "ALLOWED_USERS_FILE" ]; then
  log "sign-in allowlist: $count account(s), from ALLOWED_USERS_FILE"
else
  log "sign-in allowlist: $count account(s)"
fi
