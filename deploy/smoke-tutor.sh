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
#   * the other way to run the pair, as on a plain Docker host: two containers on one network,
#     both locked down (non-root, read-only root file system, no capabilities), nginx finding the
#     tutor by name (TUTOR_UPSTREAM) and passing it the account from another sign-in proxy's
#     header; nginx starts before the tutor exists, and finds a re-created tutor at a new address
#     without a restart. There the tutor runs as a uid the image doesn't know (10003), creates its
#     log directory inside a mounted /data, and both containers read the lists from mounted files
#     (ALLOWED_USERS_FILE, PARENT_USERS_FILE); and of everything a sign-in proxy adds to a
#     request, the tutor receives the account under its one header and nothing else
#
# Usage: bash deploy/smoke-tutor.sh <tutor-image> [web-image]    (needs docker + curl; run by CI)
#   docker build --platform linux/amd64 -f server/Dockerfile -t precalc-tutor . \
#     && bash deploy/smoke-tutor.sh precalc-tutor precalc-trainer
# SMOKE_PORT [18081] is the host port (bound to 127.0.0.1). SMOKE_NAME [precalc-tutor-smoke]
# prefixes the containers and the volume, SMOKE_NET [<name>-net] names the network, for a shared
# host where test resources have to be recognisable.
set -euo pipefail

IMAGE="${1:?usage: smoke-tutor.sh <tutor-image> [web-image]}"
WEB="${2:-}"
PORT="${SMOKE_PORT:-18081}"
NAME="${SMOKE_NAME:-precalc-tutor-smoke}"
NET="${SMOKE_NET:-$NAME-net}"
BASE="http://127.0.0.1:$PORT"
U='X-MS-CLIENT-PRINCIPAL-NAME'
KID='kid@example.com'
PARENT='parent@example.org'
CIDS=()
VOL="$NAME-$$"
SECRETS=""

cleanup() {
  docker rm -f "$NAME-tutor" "$NAME-web" "$NAME-filler" "$NAME-echo" >/dev/null 2>&1 || true
  CIDS=()
  docker volume rm -f "$VOL" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap 'cleanup; [ -z "$SECRETS" ] || rm -rf "$SECRETS"' EXIT

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
  CIDS=("$(docker run -d --name "$NAME-tutor" -p "127.0.0.1:$PORT:3000" -e HOST=0.0.0.0 -e TUTOR_PROVIDER=mock -e TUTOR_MOCK_DELAY_MS=0 \
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
  # --sig-proxy=false and -k: if the tutor ever ignores the stop signal, the CLI is killed 5 s later
  # and the container removed by name, so this check can fail but never hang the job.
  out=$(timeout -k 5 30 docker run --rm --sig-proxy=false --name "$NAME-abort" -e ALLOWED_USERS="$KID" "$@" "$IMAGE" 2>&1)
  rc=$?
  docker rm -f "$NAME-abort" >/dev/null 2>&1 || true
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
CIDS=("$(docker run -d --name "$NAME-tutor" -p "127.0.0.1:$PORT:3000" -e HOST=0.0.0.0 -e TUTOR_PROVIDER=mock -e ALLOWED_USERS="$KID" \
  -e TUTOR_DAILY_LIMIT=3 -e TUTOR_LOG_DIR=/data/tutor-log -v "$VOL:/data/tutor-log" "$IMAGE")")
wait_health
[[ "$(curl -fsS -H "$U: $KID" "$BASE/api/tutor/status")" == *'"remaining":2'* ]] || fail "after a restart today's question should still count"
docker exec "${CIDS[0]}" sh -c 'cat /data/tutor-log/tutor-*.jsonl' | grep -q '"question":"before the restart"' || fail "the JSONL log should hold the question"
pass "file log survives a restart and keeps the daily count"

expect_abort "TUTOR_PROVIDER=openai" "TUTOR_PROVIDER must be" -e TUTOR_PROVIDER=openai
expect_abort "a read-only TUTOR_LOG_DIR" "cannot write the log directory" -e TUTOR_PROVIDER=mock -e TUTOR_LOG_DIR=/usr/tutor-log
# Recursive mkdir under /proc can spin forever instead of failing: the start-up timeout must end it.
expect_abort "a TUTOR_LOG_DIR that never answers" "cannot write the log directory" -e TUTOR_PROVIDER=mock -e TUTOR_LOG_DIR=/proc/tutor-log

# ---- behind nginx, sharing one network namespace like a Container App replica ---------------
if [ -n "$WEB" ]; then
  echo "== smoke: $WEB in front of $IMAGE"
  cleanup
  WEBCID=$(docker run -d --name "$NAME-web" -p "127.0.0.1:$PORT:80" -e ALLOWED_USERS="$KID" "$WEB")
  CIDS=("$WEBCID")
  wait_health
  # Default HOST (127.0.0.1), exactly as on Azure: reachable only from inside the replica.
  CIDS+=("$(docker run -d --name "$NAME-tutor" --network "container:$WEBCID" -e TUTOR_PROVIDER=mock -e TUTOR_MOCK_DELAY_MS=150 \
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

  # ---- two containers on one Docker network, the tutor found by name: a plain Docker host. ----
  # ---- Both locked down; the account arrives in another sign-in proxy's header (AUTH_HEADER) --
  # ---- and nginx hands it to the tutor in the one header the tutor reads. --------------------
  echo "== smoke: $WEB and $IMAGE as two containers on a network (TUTOR_UPSTREAM=tutor:3000)"
  cleanup
  docker network create "$NET" >/dev/null
  LOCKED=(--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges)
  P='X-Auth-Request-Email'
  # The lists as mounted secrets, one file for both containers: CRLF and LF line ends.
  SECRETS=$(mktemp -d)
  printf '%s\r\nParent@Example.org\n' "$KID" > "$SECRETS/ALLOWED_USERS"
  printf '%s\n' "$PARENT" > "$SECRETS/PARENT_USERS"
  chmod 0755 "$SECRETS"
  chmod 0644 "$SECRETS"/*
  LISTS=(-e ALLOWED_USERS_FILE=/run/secrets/ALLOWED_USERS -v "$SECRETS/ALLOWED_USERS:/run/secrets/ALLOWED_USERS:ro")
  # by_name <the /data mount> — starts the tutor on the network under the alias `tutor`, as a uid
  # the image has no user for, with /data mounted over the image's own.
  by_name() {
    docker run -d --name "$NAME-tutor" --network "$NET" --network-alias tutor --user 10003:10003 "${LOCKED[@]}" \
      -e TUTOR_LOG_DIR=/data/tutor-log \
      -e HOST=0.0.0.0 -e TUTOR_PROVIDER=mock -e TUTOR_MOCK_DELAY_MS=0 "${LISTS[@]}" \
      -e PARENT_USERS_FILE=/run/secrets/PARENT_USERS -v "$SECRETS/PARENT_USERS:/run/secrets/PARENT_USERS:ro" "$@" "$IMAGE"
  }
  # wait_status <code> — until /api/tutor/status through nginx answers it (nginx re-resolves every 10 s)
  wait_status() {
    for _ in $(seq 1 40); do
      if [ "$(code -H "$P: $KID" "$BASE/api/tutor/status")" = "$1" ]; then return 0; fi
      sleep 1
    done
    fail "status through nginx should become $1; got $(code -H "$P: $KID" "$BASE/api/tutor/status")"
  }
  address() { docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" "$1"; }

  WEBCID=$(docker run -d --name "$NAME-web" --network "$NET" --user 10002:10002 "${LOCKED[@]}" -p "127.0.0.1:$PORT:8080" \
    -e LISTEN_PORT=8080 -e AUTH_HEADER="$P" "${LISTS[@]}" -e TUTOR_UPSTREAM=tutor:3000 "$WEB")
  CIDS=("$WEBCID")
  wait_health
  BODY=$(curl -s -H "$P: $KID" "$BASE/api/tutor/status")
  [ "$BODY" = '{"error":"tutor offline"}' ] || fail "before the tutor exists nginx should answer tutor offline; got: $BODY"
  [ "$(code -H "$P: $KID" "$BASE/api/tutor/status")" = 503 ] || fail "before the tutor exists nginx should answer 503"
  pass "nginx starts before the tutor exists: 503 tutor offline"

  # A tmpfs owned by the uid stands in for a host directory that uid owns: empty, so the log
  # directory inside it does not exist yet.
  CIDS+=("$(by_name --tmpfs /data:uid=10003,gid=10003,mode=0750)")
  wait_status 200
  [[ "$(curl -fsS -H "$P: $KID" "$BASE/api/tutor/status")" == *'"isParent":false'* ]] || fail "the tutor should see the student's account"
  [[ "$(curl -fsS -H "$P: $PARENT" "$BASE/api/tutor/status")" == *'"isParent":true'* ]] || fail "the tutor should see the parent's account from $P"
  [[ "$(curl -fsS -H "$P: $KID" -H "$U: $PARENT" "$BASE/api/tutor/status")" == *'"isParent":false'* ]] \
    || fail "a client-sent $U must not reach the tutor: nginx sets it from $P"
  [ "$(code -H "$U: $KID" "$BASE/api/tutor/status")" = 403 ] || fail "with AUTH_HEADER=$P nginx must not trust $U"
  OUT=$(curl -s -N -H "$P: $KID" -H 'Content-Type: application/json' -d "$(ask_body 'by name?')" "$BASE/api/tutor/ask")
  grep -q '^data: {"type":"done"' <<<"$OUT" || fail "a complete answer should arrive through nginx by name; got: $OUT"
  pass "by name: status and an answer through nginx; the tutor gets the account from $P only"

  [ "$(docker exec "${CIDS[1]}" id -u)" = 10003 ] || fail "the tutor should run as the uid it was given"
  [[ "$(curl -fsS -H "$P: $KID" "$BASE/api/tutor/status")" == *'"logging":"file"'* ]] || fail "the tutor should log to TUTOR_LOG_DIR"
  docker exec "${CIDS[1]}" sh -c 'cat /data/tutor-log/tutor-*.jsonl' | grep -q '"question":"by name?"' \
    || fail "the tutor should have created /data/tutor-log in the mounted /data and logged the question there"
  HEALTH=starting
  for _ in $(seq 1 60); do
    HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "${CIDS[1]}")
    [ "$HEALTH" = healthy ] && break
    sleep 1
  done
  [ "$HEALTH" = healthy ] || fail "the tutor's HEALTHCHECK should turn healthy as uid 10003 (got $HEALTH)"
  if docker logs "${CIDS[1]}" 2>&1 | grep -E '[A-Za-z0-9]@[A-Za-z0-9]'; then
    fail "the tutor's log must not show an address from the list files"
  fi
  pass "tutor as uid 10003, read-only: healthy, lists from files, log directory created in the mounted /data"

  OLD=$(address "$NAME-tutor")
  docker rm -f "$NAME-tutor" >/dev/null
  CIDS=("$WEBCID")
  wait_status 503
  [ "$(curl -s -H "$P: $KID" "$BASE/api/tutor/status")" = '{"error":"tutor offline"}' ] || fail "with the tutor gone nginx should answer tutor offline"
  [ "$(code "$BASE/healthz")" = 200 ] || fail "nginx should stay up without the tutor"

  # What nginx hands the tutor. In the tutor's place: a server that answers with the request
  # headers it received. The request carries everything a sign-in proxy (or a client) might add.
  docker run -d --name "$NAME-echo" --network "$NET" --network-alias tutor --user 10003:10003 "${LOCKED[@]}" --entrypoint node "$IMAGE" \
    -e "require('http').createServer((q, s) => s.end(JSON.stringify(q.headers))).listen(3000)" >/dev/null
  wait_status 200
  SEEN=$(curl -fsS -H "$P: $KID" -H "$U: $PARENT" -H 'Authorization: Bearer t' -H 'Cookie: _oauth2_proxy=c' \
    -H 'X-Auth-Request-User: u' -H 'X-Auth-Request-Groups: g' -H 'X-Auth-Request-Preferred-Username: n' \
    -H 'X-Auth-Request-Access-Token: t' -H 'X-Forwarded-Email: e@example.com' -H 'X-Forwarded-User: u' \
    -H 'X-Forwarded-Groups: g' -H 'X-Forwarded-Access-Token: t' -H 'X-MS-CLIENT-PRINCIPAL: c' \
    -H 'X-MS-TOKEN-GOOGLE-ID-TOKEN: t' "$BASE/api/tutor/status")
  [[ "$SEEN" == *"\"x-ms-client-principal-name\":\"$KID\""* ]] || fail "the tutor should receive the account from $P under $U; it received: $SEEN"
  for h in authorization cookie x-auth-request-email x-auth-request-user x-auth-request-groups x-auth-request-preferred-username \
           x-auth-request-access-token x-forwarded-email x-forwarded-user x-forwarded-groups x-forwarded-access-token \
           x-ms-client-principal x-ms-token-google-id-token; do
    [[ "$SEEN" != *"\"$h\":"* ]] || fail "nginx must not pass $h on to the tutor; it received: $SEEN"
  done
  pass "the tutor receives the account under $U and none of the sign-in proxy's other headers"
  docker rm -f "$NAME-echo" >/dev/null
  # A container that takes the old address, so the new tutor is certain to get another one.
  docker run -d --name "$NAME-filler" --network "$NET" --entrypoint sleep "$IMAGE" 300 >/dev/null
  # This time /data is a new named volume, which Docker fills from the image's /data, owner and
  # mode included: the tutor, still uid 10003, has to be able to write its log there too.
  CIDS+=("$(by_name -v "$VOL:/data")")
  NEW=$(address "$NAME-tutor")
  [ "$NEW" != "$OLD" ] || fail "the re-created tutor should have a new address for this check (still $OLD)"
  wait_status 200
  [ "$(docker inspect -f '{{.RestartCount}}' "$WEBCID")" = 0 ] || fail "nginx should not have restarted"
  pass "tutor re-created at a new address ($OLD -> $NEW): found again without restarting nginx"
  [[ "$(curl -fsS -H "$P: $KID" "$BASE/api/tutor/status")" == *'"logging":"file"'* ]] || fail "the tutor should log to a new named volume at /data"
  pass "tutor as uid 10003 on a new named volume at /data: file log"
fi

echo "SMOKE OK"
