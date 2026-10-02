#!/usr/bin/env bash
# deploy/smoke.sh — boot a built image and check the container-level contract:
#   * sign-in allowlist: without X-MS-CLIENT-PRINCIPAL-NAME every path but /healthz answers 403
#     with the not-allowed page; listed accounts get in (any letter case); near misses don't;
#     no ALLOWED_USERS lets nobody in; an unsafe entry aborts start-up
#   * /config.js carries sha256(APP_PIN); APP_PIN_HASH is honored verbatim; no PIN -> "";
#     signOutUrl is set unless AUTH_ALLOWLIST=off
#   * a malformed APP_PIN_HASH aborts start-up instead of locking everyone out
#   * / and deep links serve index.html (SPA fallback); a missing /assets/* is a real 404
#   * /assets/* immutable for a year; index.html and /config.js no-cache
#   * gzip on the JS bundle, security headers present, server_tokens off
#   * /api/ without the tutor sidecar answers 503 {"error":"tutor offline"} (JSON), /healthz answers
#     200, image under 60 MB. The sidecar itself, and nginx in front of it: deploy/smoke-tutor.sh
#   * the defaults stay Azure's: only X-MS-CLIENT-PRINCIPAL-NAME carries the account, and nginx
#     leaves /.auth/logout alone
#   * locked down behind another sign-in proxy (non-root, read-only root file system, no
#     capabilities, a tmpfs on /tmp): LISTEN_PORT, AUTH_HEADER, SIGN_OUT_URL, APP_PIN_FILE, the
#     list from ALLOWED_USERS_FILE and a TUTOR_UPSTREAM name that does not resolve all work, the
#     HEALTHCHECK turns healthy, and the log has no permission or read-only complaints and no
#     address from the file; a bad value for any of them aborts start-up
#
# Usage: bash deploy/smoke.sh <image>      (needs docker + curl; run by .github/workflows/*)
#   docker build --platform linux/amd64 -t precalc-trainer . && bash deploy/smoke.sh precalc-trainer
# SMOKE_PORT [18080] is the host port (bound to 127.0.0.1); SMOKE_NAME [precalc-smoke] names the
# containers, for a shared host where test containers have to be recognisable.
set -euo pipefail

IMAGE="${1:?usage: smoke.sh <image>}"
PORT="${SMOKE_PORT:-18080}"
NAME="${SMOKE_NAME:-precalc-smoke}"
BASE="http://127.0.0.1:$PORT"
CID=""
CPORT=80                              # the port nginx listens on inside the container
SECRETS=""
OPEN=(-e AUTH_ALLOWLIST=off)          # no sign-in layer in these checks: let every request through
U='X-MS-CLIENT-PRINCIPAL-NAME'        # set by Container Apps authentication in front of nginx

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; CID=""; }
trap 'cleanup; [ -z "$SECRETS" ] || rm -rf "$SECRETS"' EXIT

fail() {
  echo "SMOKE FAIL: $*" >&2
  if [ -n "$CID" ]; then echo "--- container logs ---" >&2; docker logs "$CID" >&2 || true; fi
  exit 1
}
pass() { echo "  ok   $*"; }

# start [docker run options...] — (re)starts the image and waits for /healthz
start() {
  cleanup
  CID=$(docker run -d --name "$NAME" -p "127.0.0.1:$PORT:$CPORT" "$@" "$IMAGE")
  for _ in $(seq 1 30); do
    if curl -fsS "$BASE/healthz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "container did not answer /healthz within 30s"
}

# expect_abort <what> <message> [docker run options...] — the container must refuse to start,
# and say why: a non-zero exit alone would also pass if the image were broken some other way.
expect_abort() {
  local what="$1" want="$2" rc out
  shift 2
  cleanup
  set +e
  out=$(timeout 20 docker run --rm --name "$NAME-bad" "$@" "$IMAGE" 2>&1)
  rc=$?
  set -e
  docker rm -f "$NAME-bad" >/dev/null 2>&1 || true
  ABORT_OUT=$out   # for a caller that also checks what the message leaves out
  { [ "$rc" -ne 0 ] && [ "$rc" -ne 124 ]; } || fail "$what must abort start-up (rc=$rc); output: $out"
  grep -q "$want" <<<"$out" || fail "$what should abort saying \"$want\"; got: $out"
  pass "$what aborts start-up, naming the reason"
}

code()    { curl -s -o /dev/null -w '%{http_code}' "$@"; }
headers() { curl -s -o /dev/null -D - "$@"; }

echo "== smoke: $IMAGE"

SIZE=$(docker image inspect --format '{{.Size}}' "$IMAGE")
[ "$SIZE" -lt $((60 * 1024 * 1024)) ] || fail "image is $((SIZE / 1024 / 1024)) MB; budget is 60 MB"
pass "image size $((SIZE / 1024 / 1024)) MB (< 60 MB)"

# ---- PIN via APP_PIN --------------------------------------------------------------------
PIN=1234
WANT=$(printf '%s' "$PIN" | sha256sum | cut -d' ' -f1)
start "${OPEN[@]}" -e APP_PIN="$PIN"
CFG=$(curl -fsS "$BASE/config.js")
[[ "$CFG" == *"pinHash: \"$WANT\""* ]] || fail "/config.js should contain pinHash \"$WANT\"; got: $CFG"
pass "/config.js pinHash = sha256(APP_PIN)"
[[ "$CFG" == *'signOutUrl: ""'* ]] || fail "AUTH_ALLOWLIST=off should give an empty signOutUrl; got: $CFG"
pass "/config.js signOutUrl empty with AUTH_ALLOWLIST=off"
headers "$BASE/config.js" | grep -qi '^cache-control: no-cache' || fail "/config.js must be no-cache"
pass "/config.js no-cache"

# ---- SPA --------------------------------------------------------------------------------
[ "$(code "$BASE/")" = 200 ] || fail "/ should be 200"
curl -fsS "$BASE/m/inequalities/deep/link" | grep -q '<div id="root">' || fail "deep link should fall back to index.html"
pass "SPA fallback"
headers "$BASE/" | grep -qi '^cache-control: no-cache' || fail "index.html must be no-cache"
pass "index.html no-cache"

ASSET=$(curl -fsS "$BASE/" | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1)
[ -n "$ASSET" ] || fail "could not find the hashed entry script in index.html"
H=$(headers -H 'Accept-Encoding: gzip' "$BASE$ASSET")
grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$H" || fail "$ASSET must be immutable; headers: $H"
grep -qi '^content-encoding: gzip' <<<"$H" || fail "$ASSET should be gzipped; headers: $H"
pass "/assets immutable + gzip ($ASSET)"
[ "$(code "$BASE/assets/does-not-exist.js")" = 404 ] || fail "a missing asset must be 404, not the SPA fallback"
pass "missing asset -> 404"

# ---- misc -------------------------------------------------------------------------------
[ "$(code "$BASE/api/explain")" = 503 ] || fail "/api/ without the tutor sidecar should answer 503"
[ "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/tutor/ask")" = 503 ] || fail "POST /api/tutor/ask without the sidecar should answer 503"
BODY=$(curl -s "$BASE/api/tutor/status")
[ "$BODY" = '{"error":"tutor offline"}' ] || fail "/api/ without the sidecar should answer {\"error\":\"tutor offline\"}; got: $BODY"
headers "$BASE/api/tutor/status" | grep -qi '^content-type: application/json' || fail "the tutor-offline answer should be application/json"
pass "/api/ without the sidecar -> 503 {\"error\":\"tutor offline\"}"
H=$(headers "$BASE/")
grep -qi  '^x-content-type-options: nosniff' <<<"$H" || fail "missing X-Content-Type-Options; headers: $H"
grep -qi  '^content-security-policy:'        <<<"$H" || fail "missing Content-Security-Policy; headers: $H"
grep -qiE '^server: nginx[[:space:]]*$'      <<<"$H" || fail "Server header should be bare 'nginx' (server_tokens off); headers: $H"
pass "security headers + server_tokens off"

# ---- sign-in allowlist ------------------------------------------------------------------
start -e ALLOWED_USERS="kid@example.com, Parent+precalc@Example.org"
for p in / /m/inequalities/deep/link /config.js "$ASSET" /api/explain /favicon.svg; do
  [ "$(code "$BASE$p")" = 403 ] || fail "$p without a signed-in account must be 403"
done
PAGE=$(curl -s "$BASE/")
grep -q 'on the list' <<<"$PAGE" || fail "the 403 should serve the not-allowed page; got: $PAGE"
grep -q '/.auth/logout' <<<"$PAGE" || fail "the not-allowed page should link to sign-out"
grep -qi '^content-security-policy:' <<<"$(headers "$BASE/")" || fail "the 403 page should keep the security headers"
grep -q 'on the list' <<<"$(curl -s "$BASE/api/tutor/status")" || fail "a 403 on /api/ should serve the not-allowed page too"
pass "not signed in -> 403 not-allowed page on every path"
[ "$(code "$BASE/healthz")" = 200 ] || fail "/healthz must stay open"
pass "/healthz open without an account"

[ "$(code -H "$U: kid@example.com" "$BASE/")" = 200 ] || fail "a listed account should get /"
[ "$(code -H "$U: KID@Example.COM" "$BASE/m/inequalities/deep/link")" = 200 ] || fail "the match should ignore letter case"
[ "$(code -H "$U: parent+precalc@example.org" "$BASE$ASSET")" = 200 ] || fail "the second account (with +) should get assets"
pass "listed accounts get in (any case; + in an address)"
for who in kid@exampleXcom notkid@example.com kid@example.com.evil.net parentprecalc@example.org kid; do
  [ "$(code -H "$U: $who" "$BASE/")" = 403 ] || fail "\"$who\" must not get in"
done
pass "near misses -> 403 (dots and + are literal, whole value must match)"
CFG=$(curl -fsS -H "$U: kid@example.com" "$BASE/config.js")
[[ "$CFG" == *'signOutUrl: "/.auth/logout?post_logout_redirect_uri=/"'* ]] || fail "behind sign-in /config.js should carry the sign-out URL; got: $CFG"
pass "/config.js signOutUrl set behind sign-in"
[ "$(code -H 'X-Auth-Request-Email: kid@example.com' "$BASE/")" = 403 ] || fail "by default only $U may carry the account"
pass "another proxy's header is not trusted by default"
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "$U: kid@example.com" "$BASE/.auth/logout")" = "200 " ] \
  || fail "without SIGN_OUT_URL nginx must not answer /.auth/logout itself (Container Apps does, in front of it)"
pass "/.auth/logout left alone without SIGN_OUT_URL"

start
[ "$(code -H "$U: kid@example.com" "$BASE/")" = 403 ] || fail "with no ALLOWED_USERS nobody may get in"
pass "no ALLOWED_USERS -> nobody gets in (fail closed)"

expect_abort "an ALLOWED_USERS entry with ';'" "ALLOWED_USERS entry" -e 'ALLOWED_USERS=kid@example.com;default 1'
expect_abort "an ALLOWED_USERS entry with '*'" "ALLOWED_USERS entry" -e 'ALLOWED_USERS=*'

# ---- PIN via APP_PIN_HASH (verbatim, wins over APP_PIN) ---------------------------------
start "${OPEN[@]}" -e APP_PIN_HASH="$WANT" -e APP_PIN=ignored
CFG=$(curl -fsS "$BASE/config.js")
[[ "$CFG" == *"pinHash: \"$WANT\""* ]] || fail "APP_PIN_HASH should be used verbatim; got: $CFG"
pass "APP_PIN_HASH honored"

# ---- no PIN -> empty hash -> no gate -----------------------------------------------------
start "${OPEN[@]}"
CFG=$(curl -fsS "$BASE/config.js")
[[ "$CFG" == *'pinHash: ""'* ]] || fail "no APP_PIN should give an empty pinHash; got: $CFG"
pass "no PIN -> empty hash"

# ---- malformed hash refuses to start ----------------------------------------------------
expect_abort "a malformed APP_PIN_HASH" "64-character SHA-256" -e APP_PIN_HASH=nope
expect_abort "a two-line APP_PIN_HASH" "64-character SHA-256" -e "APP_PIN_HASH=$WANT
$WANT"

# ---- locked down behind another sign-in proxy: any non-root user, a read-only root file -----
# ---- system, no capabilities, a tmpfs on /tmp, a high port, the account in another header, --
# ---- the PIN as a mounted secret, the tutor under a name that does not resolve -------------
LOCKED=(--user 10002:10002 --read-only --tmpfs /tmp:size=64m --cap-drop ALL --security-opt no-new-privileges)
P='X-Auth-Request-Email'
OUT_URL='https://auth.example.com/oauth2/sign_out?rd=https%3A%2F%2Fapp.example.com%2F'
SECRETS=$(mktemp -d)
chmod 0755 "$SECRETS"
printf '%s\n' "$PIN" > "$SECRETS/APP_PIN"   # with the line end a secret file usually has
# The list as a mounted secret: CRLF and LF line ends, a comma and a space between entries.
printf 'kid@example.com\r\nParent@Example.org, third@example.net fourth@example.net\n' > "$SECRETS/ALLOWED_USERS"
printf 'kid@example.com\nnot-for-the-log@example.com;x\n' > "$SECRETS/UNSAFE_USERS"
chmod 0644 "$SECRETS"/*
LIST=(-e ALLOWED_USERS_FILE=/run/secrets/ALLOWED_USERS -v "$SECRETS/ALLOWED_USERS:/run/secrets/ALLOWED_USERS:ro")
CPORT=8080
start "${LOCKED[@]}" -e LISTEN_PORT=8080 -e AUTH_HEADER="$P" "${LIST[@]}" -e SIGN_OUT_URL="$OUT_URL" \
  -e TUTOR_UPSTREAM=tutor.invalid:3000 -e APP_PIN_FILE=/run/secrets/APP_PIN -v "$SECRETS/APP_PIN:/run/secrets/APP_PIN:ro"
CPORT=80
[ "$(docker exec "$CID" id -u)" = 10002 ] || fail "the container should run as the user it was given"
for who in kid@example.com parent@example.org third@example.net fourth@example.net; do
  [ "$(code -H "$P: $who" "$BASE/")" = 200 ] || fail "$who is in ALLOWED_USERS_FILE and should get /"
done
[ "$(code -H "$P: kid@example.com.evil.net" "$BASE/")" = 403 ] || fail "a near miss of an ALLOWED_USERS_FILE entry must not get in"
pass "ALLOWED_USERS_FILE: every entry gets in (CRLF, LF, comma and space separated)"
[ "$(code -H "$P: kid@example.com" "$BASE/")" = 200 ] || fail "a listed account in $P should get /"
[ "$(code -H "$P: KID@Example.com" "$BASE$ASSET")" = 200 ] || fail "a listed account in $P should get assets"
[ "$(code -H "$P: kid@example.com" "$BASE/m/inequalities/deep/link")" = 200 ] || fail "deep links should work locked down"
[ "$(code -H "$P: stranger@example.com" "$BASE/")" = 403 ] || fail "an unlisted account in $P must not get in"
[ "$(code -H "$U: kid@example.com" "$BASE/")" = 403 ] || fail "with AUTH_HEADER=$P, $U must not be trusted any more"
pass "locked down: uid 10002, port 8080, AUTH_HEADER is the one trusted header"
CFG=$(curl -fsS -H "$P: kid@example.com" "$BASE/config.js")
[[ "$CFG" == *"pinHash: \"$WANT\""* ]] || fail "APP_PIN_FILE should give sha256 of the PIN without its line end; got: $CFG"
[[ "$CFG" == *'signOutUrl: "/.auth/logout?post_logout_redirect_uri=/"'* ]] || fail "/config.js should carry the sign-out path; got: $CFG"
pass "locked down: /config.js served, PIN from APP_PIN_FILE"
[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/.auth/logout?post_logout_redirect_uri=/")" = "302 $OUT_URL" ] \
  || fail "with SIGN_OUT_URL, /.auth/logout should redirect there for anyone (the 403 page links to it)"
pass "SIGN_OUT_URL: /.auth/logout redirects to it"
BODY=$(curl -s -H "$P: kid@example.com" "$BASE/api/tutor/status")
[ "$BODY" = '{"error":"tutor offline"}' ] || fail "a TUTOR_UPSTREAM name that does not resolve should answer tutor offline; got: $BODY"
[ "$(code -H "$P: kid@example.com" "$BASE/api/tutor/status")" = 503 ] || fail "a TUTOR_UPSTREAM name that does not resolve should answer 503"
[ "$(code "$BASE/healthz")" = 200 ] || fail "nginx should stay up when the tutor's name does not resolve"
pass "TUTOR_UPSTREAM by name, not resolvable -> nginx starts, 503 {\"error\":\"tutor offline\"}"
HEALTH=starting
for _ in $(seq 1 60); do
  HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$CID")
  [ "$HEALTH" = healthy ] && break
  sleep 1
done
[ "$HEALTH" = healthy ] || fail "the HEALTHCHECK should turn healthy on LISTEN_PORT (got $HEALTH)"
pass "HEALTHCHECK healthy locked down"
LOGS=$(docker logs "$CID" 2>&1)
if grep -iE 'permission denied|read-only file system|\[(emerg|alert|crit|warn)\]' <<<"$LOGS"; then
  fail "the log of a locked-down start should have no permission, read-only or nginx warning lines"
fi
if grep -E '[A-Za-z0-9]@[A-Za-z0-9]' <<<"$LOGS"; then
  fail "the log must not show an address: the list came from a secret file, and requests are logged without the account"
fi
grep -q 'sign-in allowlist: 4 account(s), from ALLOWED_USERS_FILE' <<<"$LOGS" || fail "the log should say how many accounts the file gave; got: $LOGS"
pass "locked down: clean start-up log, the list's size but none of its addresses"

# The variable wins over the file; a file that isn't there, or holds an unsafe entry, stops the container.
start -e ALLOWED_USERS=only@example.com "${LIST[@]}"
[ "$(code -H "$U: only@example.com" "$BASE/")" = 200 ] || fail "ALLOWED_USERS should win over ALLOWED_USERS_FILE"
[ "$(code -H "$U: kid@example.com" "$BASE/")" = 403 ] || fail "with ALLOWED_USERS set, ALLOWED_USERS_FILE must not be read"
pass "ALLOWED_USERS wins over ALLOWED_USERS_FILE"
expect_abort "an ALLOWED_USERS_FILE that is not there" "ALLOWED_USERS_FILE is set but" -e ALLOWED_USERS_FILE=/run/secrets/ALLOWED_USERS
expect_abort "an ALLOWED_USERS_FILE that is not there, even with AUTH_ALLOWLIST=off" "ALLOWED_USERS_FILE is set but" "${OPEN[@]}" -e ALLOWED_USERS_FILE=/run/secrets/ALLOWED_USERS
expect_abort "an unsafe entry in ALLOWED_USERS_FILE" "ALLOWED_USERS_FILE entry 2 has a character" \
  -e ALLOWED_USERS_FILE=/run/secrets/ALLOWED_USERS -v "$SECRETS/UNSAFE_USERS:/run/secrets/ALLOWED_USERS:ro"
[[ "$ABORT_OUT" != *not-for-the-log* ]] || fail "a refused ALLOWED_USERS_FILE entry must not be printed; got: $ABORT_OUT"
pass "a refused ALLOWED_USERS_FILE entry is named by position, not printed"

expect_abort "a read-only root without a writable /tmp" "cannot write /tmp/precalc" --read-only "${OPEN[@]}"
expect_abort "a LISTEN_PORT that is not a number" "LISTEN_PORT must be" "${OPEN[@]}" -e LISTEN_PORT=http
expect_abort "an AUTH_HEADER with ';'" "AUTH_HEADER must be" -e 'AUTH_HEADER=X-Email; return 200'
expect_abort "a SIGN_OUT_URL with a quote" "SIGN_OUT_URL must be" "${OPEN[@]}" -e 'SIGN_OUT_URL=https://auth.example.com/"; }'
expect_abort "a SIGN_OUT_URL that is not http(s)" "SIGN_OUT_URL must be" "${OPEN[@]}" -e SIGN_OUT_URL=/sign-out
expect_abort "a TUTOR_UPSTREAM without a port" "TUTOR_UPSTREAM must be" "${OPEN[@]}" -e TUTOR_UPSTREAM=tutor
expect_abort "an APP_PIN_FILE that is not there" "APP_PIN_FILE is set but" "${OPEN[@]}" -e APP_PIN_FILE=/run/secrets/APP_PIN

echo "SMOKE OK"
