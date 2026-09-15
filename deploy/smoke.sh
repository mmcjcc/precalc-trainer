#!/usr/bin/env bash
# deploy/smoke.sh — boot a built image and check the container-level contract:
#   * /config.js carries sha256(APP_PIN); APP_PIN_HASH is honored verbatim; no PIN -> ""
#   * a malformed APP_PIN_HASH aborts start-up instead of locking everyone out
#   * / and deep links serve index.html (SPA fallback); a missing /assets/* is a real 404
#   * /assets/* immutable for a year; index.html and /config.js no-cache
#   * gzip on the JS bundle, security headers present, server_tokens off
#   * /api/ answers 503, /healthz answers 200, image under 60 MB
#
# Usage: bash deploy/smoke.sh <image>      (needs docker + curl; run by .github/workflows/*)
#   docker build --platform linux/amd64 -t precalc-trainer . && bash deploy/smoke.sh precalc-trainer
set -euo pipefail

IMAGE="${1:?usage: smoke.sh <image>}"
PORT="${SMOKE_PORT:-18080}"
BASE="http://127.0.0.1:$PORT"
CID=""

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

code()    { curl -s -o /dev/null -w '%{http_code}' "$@"; }
headers() { curl -s -o /dev/null -D - "$@"; }

echo "== smoke: $IMAGE"

SIZE=$(docker image inspect --format '{{.Size}}' "$IMAGE")
[ "$SIZE" -lt $((60 * 1024 * 1024)) ] || fail "image is $((SIZE / 1024 / 1024)) MB; budget is 60 MB"
pass "image size $((SIZE / 1024 / 1024)) MB (< 60 MB)"

# ---- PIN via APP_PIN --------------------------------------------------------------------
PIN=1234
WANT=$(printf '%s' "$PIN" | sha256sum | cut -d' ' -f1)
start -e APP_PIN="$PIN"
CFG=$(curl -fsS "$BASE/config.js")
[[ "$CFG" == *"pinHash: \"$WANT\""* ]] || fail "/config.js should contain pinHash \"$WANT\"; got: $CFG"
pass "/config.js pinHash = sha256(APP_PIN)"
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
[ "$(code "$BASE/api/explain")" = 503 ] || fail "/api/ stub should answer 503"
pass "/api/ -> 503"
H=$(headers "$BASE/")
grep -qi  '^x-content-type-options: nosniff' <<<"$H" || fail "missing X-Content-Type-Options; headers: $H"
grep -qi  '^content-security-policy:'        <<<"$H" || fail "missing Content-Security-Policy; headers: $H"
grep -qiE '^server: nginx[[:space:]]*$'      <<<"$H" || fail "Server header should be bare 'nginx' (server_tokens off); headers: $H"
pass "security headers + server_tokens off"

# ---- PIN via APP_PIN_HASH (verbatim, wins over APP_PIN) ---------------------------------
start -e APP_PIN_HASH="$WANT" -e APP_PIN=ignored
CFG=$(curl -fsS "$BASE/config.js")
[[ "$CFG" == *"pinHash: \"$WANT\""* ]] || fail "APP_PIN_HASH should be used verbatim; got: $CFG"
pass "APP_PIN_HASH honored"

# ---- no PIN -> empty hash -> no gate -----------------------------------------------------
start
CFG=$(curl -fsS "$BASE/config.js")
[[ "$CFG" == *'pinHash: ""'* ]] || fail "no APP_PIN should give an empty pinHash; got: $CFG"
pass "no PIN -> empty hash"

# ---- malformed hash refuses to start ----------------------------------------------------
cleanup
set +e
timeout 20 docker run --rm --name precalc-smoke-bad -e APP_PIN_HASH=nope "$IMAGE" >/dev/null 2>&1
rc=$?
set -e
docker rm -f precalc-smoke-bad >/dev/null 2>&1 || true
{ [ "$rc" -ne 0 ] && [ "$rc" -ne 124 ]; } || fail "a malformed APP_PIN_HASH must abort start-up (rc=$rc)"
pass "malformed APP_PIN_HASH aborts start-up"

echo "SMOKE OK"
