#!/usr/bin/env bash
# deploy/smoke-tutor.sh — boot the tutor sidecar image with the MOCK provider (no key, no network)
# and check its contract; then, given the web image too, run the two containers the way Container
# Apps does (one network namespace, the tutor on 127.0.0.1:3000) and check nginx in front of it:
#   * /healthz; runs as the unprivileged node user; image under 250 MB
#   * no signed-in account -> 403; listed accounts in any letter case -> status JSON
#   * ask streams Server-Sent Events (delta..., done with the remaining count)
#   * the daily limit ends with an error event "limit"; a body over 32 KB -> 413
#   * the log is parent-only; with TUTOR_LOG_DIR on a volume a restart keeps today's count
#   * an unknown TUTOR_PROVIDER or an unwritable TUTOR_LOG_DIR stops start-up, saying why
#   * through nginx: the allowlist gate, SSE arriving word by word (not buffered), and
#     503 {"error":"tutor offline"} once the sidecar is gone
#
# Usage: bash deploy/smoke-tutor.sh <tutor-image> [web-image]    (needs docker + curl; run by CI)
#   docker build --platform linux/amd64 -f server/Dockerfile -t precalc-tutor . \
#     && bash deploy/smoke-tutor.sh precalc-tutor precalc-trainer
set -euo pipefail

IMAGE="${1:?usage: smoke-tutor.sh <tutor-image> [web-image]}"
WEB="${2:-}"
PORT="${SMOKE_PORT:-18081}"
BASE="http://127.0.0.1:$PORT"
U='X-MS-CLIENT-PRINCIPAL-NAME'
KID='kid@example.com'
PARENT='parent@example.org'
CIDS=()
VOL="precalc-tutor-smoke-$$"

cleanup() {
  local c
  for c in "${CIDS[@]:-}"; do [ -n "$c" ] && docker rm -f "$c" >/dev/null 2>&1 || true; done
  CIDS=()
  docker volume rm -f "$VOL" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "SMOKE FAIL: $*" >&2
  local c
  for c in "${CIDS[@]:-}"; do
    [ -n "$c" ] || continue
    echo "--- logs of $c ---" >&2
    docker logs "$c" >&2 || true
  done
  exit 1
}
pass() { echo "  ok   $*"; }

wait_health() {
  for _ in $(seq 1 30); do
    if curl -fsS "$BASE/healthz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "nothing answered $BASE/healthz within 30s"
}

# tutor [docker run options...] — (re)starts the tutor alone, published on $PORT
tutor() {
  cleanup
  CIDS=("$(docker run -d -p "$PORT:3000" -e HOST=0.0.0.0 -e TUTOR_PROVIDER=mock -e TUTOR_MOCK_DELAY_MS=0 \
    -e ALLOWED_USERS="$KID, Parent@Example.org" -e PARENT_USERS="$PARENT" "$@" "$IMAGE")")
  wait_health
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
ask_body() { printf '{"question":"%s","context":{"problemId":"inequalities/ineq.distribute-negative@1/k3","attemptId":"inequalities/ineq.distribute-negative@1/k3#a1","moduleId":"inequalities","subject":"precalculus","kind":"inequality","title":"Solve the inequality","instructions":"Solve for x.","statement":"-2(x - 3) <= 10","work":["-2(x - 3) <= 10","-2x <= 4"],"verdict":{"status":"rejected","line":"x <= -2","mistake":{"id":"no_sign_flip","title":"Forgot to flip the inequality","lesson":"Dividing by a negative reverses the inequality.","witness":"You divided by -2 and kept <=."}},"canonical":["-2x <= 4","x >= -2"],"answer":"[-2, inf)","finished":false,"revealed":false}}' "${1:-why was my line rejected?}"; }
ask() { curl -s -N -H "$U: ${2:-$KID}" -H 'Content-Type: application/json' -d "$(ask_body "${1:-}")" "$BASE/api/tutor/ask"; }

# expect_abort <what> <message> [docker run options...] — the tutor must refuse to start, saying why
expect_abort() {
  local what="$1" want="$2" rc out
  shift 2
  cleanup
  set +e
  out=$(timeout 20 docker run --rm -e ALLOWED_USERS="$KID" "$@" "$IMAGE" 2>&1)
  rc=$?
  set -e
  { [ "$rc" -ne 0 ] && [ "$rc" -ne 124 ]; } || fail "$what must stop start-up (rc=$rc); output: $out"
  grep -q "$want" <<<"$out" || fail "$what should stop start-up saying \"$want\"; got: $out"
  pass "$what stops start-up, naming the reason"
}

echo "== smoke: $IMAGE"

SIZE=$(docker image inspect --format '{{.Size}}' "$IMAGE")
[ "$SIZE" -lt $((250 * 1024 * 1024)) ] || fail "image is $((SIZE / 1024 / 1024)) MB; budget is 250 MB"
pass "image size $((SIZE / 1024 / 1024)) MB (< 250 MB)"

# ---- alone, mock provider, memory log -----------------------------------------------------
tutor -e TUTOR_DAILY_LIMIT=2
[ "$(curl -fsS "$BASE/healthz")" = ok ] || fail "/healthz should answer ok"
[ "$(docker exec "${CIDS[0]}" id -u)" = 1000 ] || fail "the tutor should run as the node user (uid 1000)"
pass "/healthz ok, runs as uid 1000"

[ "$(code "$BASE/api/tutor/status")" = 403 ] || fail "status without an account must be 403"
[ "$(code -H "$U: stranger@example.com" "$BASE/api/tutor/status")" = 403 ] || fail "an unlisted account must be 403"
[ "$(code -H "$U: kid@example.com.evil.net" "$BASE/api/tutor/status")" = 403 ] || fail "a near miss must be 403"
pass "no account / unlisted / near miss -> 403"

ST=$(curl -fsS -H "$U: KID@Example.com" "$BASE/api/tutor/status")
for want in '"configured":true' '"provider":"mock"' '"limit":2' '"remaining":2' '"isParent":false' '"logging":"memory"'; do
  [[ "$ST" == *"$want"* ]] || fail "status should contain $want; got: $ST"
done
[[ "$(curl -fsS -H "$U: $PARENT" "$BASE/api/tutor/status")" == *'"isParent":true'* ]] || fail "the parent should be isParent"
pass "status JSON (any letter case; parent recognised)"

CT=$(curl -s -o /dev/null -w '%{content_type}' -H "$U: $KID" -H 'Content-Type: application/json' -d "$(ask_body)" "$BASE/api/tutor/ask")
[[ "$CT" == text/event-stream* ]] || fail "ask should answer text/event-stream; got $CT"
OUT=$(ask "second question")
grep -q '^event: delta$' <<<"$OUT" || fail "ask should stream delta events; got: $OUT"
grep -q '^data: {"type":"done","id":"[^"]*","remaining":0,"limit":2}$' <<<"$OUT" || fail "the done event should report remaining 0; got: $OUT"
# The reply streams in several delta events ("(Mock " then the rest): join their texts first.
TEXT=$(sed -n 's/^data: {"type":"delta","text":"\(.*\)"}$/\1/p' <<<"$OUT" | tr -d '\n')
grep -q 'Mock tutor' <<<"$TEXT" || fail "the mock reply should arrive; joined text: $TEXT; raw: $OUT"
pass "ask -> SSE deltas + done with the remaining count"
OUT=$(ask "third question")
grep -q '^data: {"type":"error","code":"limit"' <<<"$OUT" || fail "the third question should hit the limit; got: $OUT"
pass "daily limit -> error event \"limit\""

BIG=$(head -c 40000 /dev/zero | tr '\0' 'x')
[ "$(code -H "$U: $PARENT" -H 'Content-Type: application/json' -d "{\"question\":\"$BIG\"}" "$BASE/api/tutor/ask")" = 413 ] || fail "a body over 32 KB should be 413"
[ "$(code -H "$U: $PARENT" -H 'Content-Type: application/json' -d '{"question":"hi"}' "$BASE/api/tutor/ask")" = 400 ] || fail "a body without context should be 400"
pass "body cap -> 413, bad body -> 400"

[ "$(code -H "$U: $KID" "$BASE/api/tutor/log")" = 403 ] || fail "the log must be parent-only"
LOG=$(curl -fsS -H "$U: $PARENT" "$BASE/api/tutor/log")
grep -q '"question":"second question"' <<<"$LOG" || fail "the parent's log should list her questions; got: $LOG"
pass "log: parent only, lists the questions"

# ---- file log on a named volume (docker creates it, owned by node): a restart keeps today's count --
tutor -e TUTOR_DAILY_LIMIT=3 -e TUTOR_LOG_DIR=/data/tutor-log -v "$VOL:/data/tutor-log"
ask "before the restart" >/dev/null
[[ "$(curl -fsS -H "$U: $KID" "$BASE/api/tutor/status")" == *'"logging":"file"'* ]] || fail "status should say file logging"
docker stop -t 10 "${CIDS[0]}" >/dev/null   # SIGTERM: the tutor flushes its log and exits
docker rm -f "${CIDS[0]}" >/dev/null
CIDS=("$(docker run -d -p "$PORT:3000" -e HOST=0.0.0.0 -e TUTOR_PROVIDER=mock -e ALLOWED_USERS="$KID" \
  -e TUTOR_DAILY_LIMIT=3 -e TUTOR_LOG_DIR=/data/tutor-log -v "$VOL:/data/tutor-log" "$IMAGE")")
wait_health
[[ "$(curl -fsS -H "$U: $KID" "$BASE/api/tutor/status")" == *'"remaining":2'* ]] || fail "after a restart today's question should still count"
docker exec "${CIDS[0]}" sh -c 'cat /data/tutor-log/tutor-*.jsonl' | grep -q '"question":"before the restart"' || fail "the JSONL log should hold the question"
pass "file log survives a restart and keeps the daily count"

expect_abort "TUTOR_PROVIDER=openai" "TUTOR_PROVIDER must be" -e TUTOR_PROVIDER=openai
expect_abort "an unwritable TUTOR_LOG_DIR" "cannot write the log directory" -e TUTOR_PROVIDER=mock -e TUTOR_LOG_DIR=/proc/tutor-log

# ---- behind nginx, sharing one network namespace like a Container App replica ---------------
if [ -n "$WEB" ]; then
  echo "== smoke: $WEB in front of $IMAGE"
  cleanup
  WEBCID=$(docker run -d -p "$PORT:80" -e ALLOWED_USERS="$KID" "$WEB")
  CIDS=("$WEBCID")
  wait_health
  # Default HOST (127.0.0.1), exactly as on Azure: reachable only from inside the replica.
  CIDS+=("$(docker run -d --network "container:$WEBCID" -e TUTOR_PROVIDER=mock -e TUTOR_MOCK_DELAY_MS=150 \
    -e ALLOWED_USERS="$KID" "$IMAGE")")
  for _ in $(seq 1 30); do
    if [ "$(code -H "$U: $KID" "$BASE/api/tutor/status")" = 200 ]; then break; fi
    sleep 1
  done
  [ "$(code -H "$U: $KID" "$BASE/api/tutor/status")" = 200 ] || fail "status through nginx should be 200"
  [ "$(code "$BASE/api/tutor/status")" = 403 ] || fail "nginx should refuse /api/ without an account"
  [ "$(code -H "$U: stranger@example.com" "$BASE/api/tutor/status")" = 403 ] || fail "nginx should refuse an unlisted account"
  [[ "$(curl -fsS -H "$U: $KID" "$BASE/api/tutor/status")" == *'"provider":"mock"'* ]] || fail "status through nginx should come from the tutor"
  pass "through nginx: gate, then the tutor's status"

  # With ~150 ms per word the whole reply takes several seconds; the first delta must arrive
  # within 3 s, which it can't if anything between here and the tutor buffers the stream.
  set +e
  FIRST=$(timeout 3 curl -s -N -H "$U: $KID" -H 'Content-Type: application/json' -d "$(ask_body 'streaming?')" "$BASE/api/tutor/ask" | head -c 300)
  set -e
  grep -q 'event: delta' <<<"$FIRST" || fail "the first delta should arrive before the answer is complete (buffering?); got: $FIRST"
  pass "SSE through nginx arrives word by word"
  sleep 1
  OUT=$(curl -s -N -H "$U: $KID" -H 'Content-Type: application/json' -d "$(ask_body 'whole answer?')" "$BASE/api/tutor/ask")
  grep -q '^data: {"type":"done"' <<<"$OUT" || fail "a complete answer should end with done through nginx; got: $OUT"
  pass "complete answer through nginx"

  docker rm -f "${CIDS[1]}" >/dev/null
  CIDS=("$WEBCID")
  BODY=$(curl -s -H "$U: $KID" "$BASE/api/tutor/status")
  [ "$BODY" = '{"error":"tutor offline"}' ] || fail "with the sidecar gone nginx should answer {\"error\":\"tutor offline\"}; got: $BODY"
  [ "$(code -H "$U: $KID" "$BASE/api/tutor/status")" = 503 ] || fail "with the sidecar gone nginx should answer 503"
  pass "sidecar gone -> 503 tutor offline"
fi

echo "SMOKE OK"
