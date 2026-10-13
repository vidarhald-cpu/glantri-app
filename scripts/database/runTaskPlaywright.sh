#!/bin/sh
# Runs the Playwright suite against this worktree's own disposable task stack.
#
# Launch it ONLY through the guarded environment, against a freshly created, migrated, UNSEEDED
# target (see "Running the browser suite locally" in docs/dev-database.md):
#
#   pnpm db:task:e2e [playwright arguments, for example e2e/chargen]
#
# which is `pnpm db:task:exec -- sh scripts/database/runTaskPlaywright.sh ...`. This script
# composes existing commands only. It reads no .env file, opens no database connection of its
# own, and does not touch any guard: the database URLs, the derived ports and the Playwright
# addresses all come from `db:task:exec`. It builds and starts the production web server
# (`next start`) rather than `next dev` because `next dev` fails to discover any route when the
# machine has exhausted its FSEvents watchers (EMFILE), which happens whenever several lanes run
# dev servers at once. The API likewise runs from its built `dist` (root `pnpm build` is a
# prerequisite) rather than `tsx watch`: on a busy machine a broad `pkill` aimed at some other
# lane's `pnpm --filter @glantri/api dev` was observed killing this lane's API mid-run.
set -u

if [ "${GLANTRI_DB_MODE:-}" != "task" ] || [ -z "${PLAYWRIGHT_API_URL:-}" ] || [ -z "${WEB_PORT:-}" ] || [ -z "${API_PORT:-}" ]; then
  echo "Refusing to run: launch this through 'pnpm db:task:e2e', which runs it inside 'pnpm db:task:exec'." >&2
  exit 2
fi

REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LOG_DIR="${TMPDIR:-/tmp}/glantri-task-e2e-$$"
mkdir -p "$LOG_DIR"
# The artifact specs need this on the stack's own processes, not only on Playwright's.
ARTIFACT_LOCAL_ROOT="${ARTIFACT_LOCAL_ROOT:-$LOG_DIR/artifacts}"
mkdir -p "$ARTIFACT_LOCAL_ROOT"
export ARTIFACT_LOCAL_ROOT
API_PID=""
WEB_PID=""

stop_stack() {
  # Kill the process trees, then whatever still listens on this stack's own derived ports.
  for pid in $API_PID $WEB_PID; do
    pkill -P "$pid" 2>/dev/null
    kill "$pid" 2>/dev/null
  done
  for port in "$API_PORT" "$WEB_PORT"; do
    pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null)
    [ -n "$pids" ] && kill $pids 2>/dev/null
  done
}
trap stop_stack EXIT INT TERM

echo "Task Playwright run: api=$PLAYWRIGHT_API_URL web=$PLAYWRIGHT_BASE_URL logs=$LOG_DIR"

# NEXT_PUBLIC_API_BASE_URL is inlined at build time, so the build must run in this environment.
[ -f "$REPO_ROOT/apps/api/dist/server.js" ] || { echo "apps/api/dist/server.js is missing: run the root 'pnpm build' first." >&2; exit 1; }
pnpm --filter @glantri/web exec next build >"$LOG_DIR/web-build.log" 2>&1 || {
  echo "next build failed; see $LOG_DIR/web-build.log (run the root 'pnpm build' first)." >&2
  exit 1
}

node "$REPO_ROOT/apps/api/dist/server.js" >"$LOG_DIR/api.log" 2>&1 &
API_PID=$!
pnpm --filter @glantri/web exec next start --hostname "$WEB_HOST" --port "$WEB_PORT" >"$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!

attempts=0
until curl -sf "$PLAYWRIGHT_API_URL/health" >/dev/null && curl -sf -o /dev/null "$PLAYWRIGHT_BASE_URL/"; do
  attempts=$((attempts + 1))
  if [ "$attempts" -gt 60 ]; then
    echo "The stack did not become ready; see $LOG_DIR/api.log and $LOG_DIR/web.log." >&2
    exit 1
  fi
  sleep 2
done

pnpm --filter @glantri/web exec playwright test "$@"
status=$?

# A stack process that was killed mid-run (for example by another lane's broad pkill) turns every
# later spec into a fast, misleading failure. Say so rather than let it read as product failures.
for pid in $API_PID $WEB_PID; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "WARNING: a stack process (pid $pid) died during the run; results after that point are invalid. Re-run on a freshly recreated target." >&2
    [ "$status" -eq 0 ] && status=1
  fi
done
exit "$status"
