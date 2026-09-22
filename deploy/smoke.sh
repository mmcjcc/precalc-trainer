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
#
# Usage: bash deploy/smoke.sh <image>      (needs docker + curl; run by .github/workflows/*)
#   docker build --platform linux/amd64 -t precalc-trainer . && bash deploy/smoke.sh precalc-trainer
set -euo pipefail

IMAGE="${1:?usage: smoke.sh <image>}"
PORT="${SMOKE_PORT:-18080}"
BASE="http://127.0.0.1:$PORT"
CID=""
OPEN=(-e AUTH_ALLOWLIST=off)          # no sign-in layer in these checks: let every request through
U='X-MS-CLIENT-PRINCIPAL-NAME'        # set by Container Apps authentication in front of nginx

cleanup() { if [ -n "$CID" ]; then docker rm -f "$CID" >/dev/null 2>&1 || true; CID=""; fi; }
trap cleanup EXIT

fail() {
  echo "SMOKE FAIL: $*" >&2
  if [ -n "$CID" ]; then echo "--- container logs ---" >&2; docker logs "$CID" >&2 || true; fi
  exit 1
}
pass() { echo "  ok   $*"; }

# start [docker run options...] — (re)starts the image and waits for /healthz
start() {
  cleanup
  CID=$(docker run -d -p "$PORT:80" "$@" "$IMAGE")
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
  out=$(timeout 20 docker run --rm --name precalc-smoke-bad "$@" "$IMAGE" 2>&1)
  rc=$?
  set -e
  docker rm -f precalc-smoke-bad >/dev/null 2>&1 || true
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

echo "SMOKE OK"
