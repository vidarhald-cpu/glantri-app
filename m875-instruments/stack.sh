#!/bin/sh
# #875 — starts this worktree's own API on the task stack's derived port, runs the command given to
# it, then stops the API by its exact PID. Must be run inside `pnpm db:task:exec`, which supplies
# the owned DATABASE_URL and the derived API_HOST/API_PORT; it refuses to run outside it.
#
# It never uses `pkill`: a pattern kill would take down every other lane's server.
set -e

if [ "$GLANTRI_DB_MODE" != "task" ]; then
  echo "[m875-stack] GLANTRI_DB_MODE is not 'task'. Run this inside pnpm db:task:exec." >&2
  exit 2
fi
if [ -z "$API_PORT" ] || [ -z "$API_HOST" ]; then
  echo "[m875-stack] API_HOST/API_PORT are unset; db:task:exec must supply them." >&2
  exit 2
fi
case "$API_PORT" in
  4000 | 3000 | 5440)
    echo "[m875-stack] refusing to touch port $API_PORT: that is the live Alpha stack." >&2
    exit 2
    ;;
esac
case "$DATABASE_URL" in
  */glantri | */glantri\?*)
    echo "[m875-stack] refusing to touch the protected database." >&2
    exit 2
    ;;
esac

API_URL="http://${API_HOST}:${API_PORT}"
LOG="${M875_STACK_LOG:-/tmp/m875-api.log}"
echo "[m875-stack] api=${API_URL} database=$(echo "$DATABASE_URL" | sed 's#.*/##') log=${LOG}"

pnpm --filter @glantri/api dev >"$LOG" 2>&1 &
API_PID=$!
echo "[m875-stack] api pid=${API_PID}"

stop() {
  if kill -0 "$API_PID" 2>/dev/null; then
    echo "[m875-stack] stopping api pid=${API_PID}"
    kill "$API_PID" 2>/dev/null || true
    # Bounded wait: never an unbounded `until` loop.
    i=0
    while [ "$i" -lt 20 ] && kill -0 "$API_PID" 2>/dev/null; do
      sleep 0.5
      i=$((i + 1))
    done
    kill -9 "$API_PID" 2>/dev/null || true
  fi
}
trap stop EXIT INT TERM

# Bounded readiness wait: 60 attempts, half a second apart, then give up.
ready=0
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "${API_URL}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
  i=$((i + 1))
done
if [ "$ready" -ne 1 ]; then
  echo "[m875-stack] api did not become ready in 30s; last log lines:" >&2
  tail -30 "$LOG" >&2
  exit 1
fi
echo "[m875-stack] api ready after $((i / 2))s"

"$@"
