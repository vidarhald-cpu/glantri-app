#!/usr/bin/env bash
# Inspect, record and (as a backstop) bound the BuildKit cache inside the
# dedicated Forgejo Actions Docker-in-Docker daemon (issue #557).
#
# Usage:
#   scripts/ops/dind-cache.sh status          print inner `docker system df` + verdict
#   scripts/ops/dind-cache.sh record          status + append to the log + notify on alert
#   scripts/ops/dind-cache.sh prune           backstop prune (age, then size ceiling)
#
# Exit status: 0 healthy, 10 cache above alert level, 2 error/refused.
#
# VOLUME SAFETY IS STRUCTURAL, NOT BEHAVIOURAL
#   1. Every docker call goes through inner(), the ONLY place `docker` is run. It
#      executes `docker exec <fixed DinD container> docker <args>`, and refuses
#      any <args> that are not on the closed allowlist in allowed_inner().
#   2. The allowlist contains only `system df`, `ps`, and `builder prune`. There is
#      no `system prune`, `volume ...`, `container rm`, `rm`, `rmi`, `image prune`
#      or `--volumes`. `builder prune` calls the daemon's /build/prune endpoint,
#      which can only delete BuildKit cache records; it has no volume code path.
#   3. The commands run in the DinD daemon's own namespace. Forgejo and PostgreSQL
#      volumes live in the Docker Desktop host daemon; DinD has no host mount and
#      no docker.sock (re-asserted below before any prune), so they are not visible
#      to it at all.
# scripts/ops/dind-cache.test.mjs executes this script against a recording fake
# `docker` and proves points 1 and 2 by asserting the exact argv sequences.
set -euo pipefail

DIND_CONTAINER="glantri-forgejo-actions-dind"
CEILING_GB=40          # keep in step with infra/forgejo-actions/dind-daemon.json
ALERT_GB=32            # 80% of the ceiling: GC should be holding the line; above it, look
MAX_AGE_HOURS=336      # 14 days
LOG_DIR="${GLANTRI_OPS_LOG_DIR:-$HOME/Glantri-Server/ops-logs}"
LOG_FILE="$LOG_DIR/dind-cache.log"

allowed_inner() {
  case "$*" in
    "system df" | "system df -v") return 0 ;;
    "ps -q") return 0 ;;
    "builder prune --force --all --filter unused-for=${MAX_AGE_HOURS}h") return 0 ;;
    "builder prune --force --all --max-used-space ${CEILING_GB}GB") return 0 ;;
  esac
  return 1
}

inner() {
  if ! allowed_inner "$@"; then
    printf 'dind-cache: refusing non-allowlisted inner docker command: %s\n' "$*" >&2
    exit 2
  fi
  docker exec "$DIND_CONTAINER" docker "$@"
}

assert_dind_is_isolated() {
  local mounts
  mounts=$(docker inspect --format '{{range .Mounts}}{{.Source}} {{.Destination}}{{"\n"}}{{end}}' "$DIND_CONTAINER") || {
    printf 'dind-cache: cannot inspect %s (is Docker Desktop up?)\n' "$DIND_CONTAINER" >&2
    exit 2
  }
  if printf '%s' "$mounts" | grep -q 'docker\.sock'; then
    printf 'dind-cache: %s mounts a docker.sock; refusing (not an isolated inner daemon)\n' "$DIND_CONTAINER" >&2
    exit 2
  fi
  if printf '%s' "$mounts" | awk 'NF {print $2}' | grep -vxE '/var/lib/docker|/etc/docker/daemon.json' | grep -q .; then
    printf 'dind-cache: %s has unexpected mounts; refusing\n%s\n' "$DIND_CONTAINER" "$mounts" >&2
    exit 2
  fi
}

# Build Cache size in whole GB (rounded down) from `docker system df`.
cache_gb() {
  inner system df | awk '
    /^Build Cache/ {
      v = $5; u = v; gsub(/[0-9.]/, "", u); gsub(/[A-Za-z]/, "", v)
      if (u == "TB") v *= 1000; else if (u == "MB") v /= 1000; else if (u == "kB" || u == "B") v = 0
      printf "%d\n", v; found = 1
    }
    END { if (!found) print "0" }'
}

notify() {
  # Best effort desktop notification on the operator's Mac; never fails the run.
  command -v osascript >/dev/null 2>&1 || return 0
  osascript -e "display notification \"$1\" with title \"Glantri CI cache\"" >/dev/null 2>&1 || true
}

status() {
  inner system df
  local gb
  gb=$(cache_gb)
  if [ "$gb" -ge "$ALERT_GB" ]; then
    printf 'DIND_CACHE level=ALERT build_cache_gb=%s alert>=%s ceiling=%s\n' "$gb" "$ALERT_GB" "$CEILING_GB"
    return 10
  fi
  printf 'DIND_CACHE level=OK build_cache_gb=%s alert>=%s ceiling=%s\n' "$gb" "$ALERT_GB" "$CEILING_GB"
}

record() {
  mkdir -p "$LOG_DIR"
  local out rc=0 gb
  out=$(status) || rc=$?
  gb=$(printf '%s\n' "$out" | sed -n 's/.*build_cache_gb=\([0-9]*\).*/\1/p' | tail -1)
  printf '%s build_cache_gb=%s rc=%s\n%s\n' "$(date -u +%FT%TZ)" "${gb:-?}" "$rc" "$out" >>"$LOG_FILE"
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    notify "DinD BuildKit cache is ${gb:-?} GB (alert at ${ALERT_GB} GB, ceiling ${CEILING_GB} GB). See docs/ci/actions-disk-and-cache.md"
  fi
  return "$rc"
}

prune() {
  assert_dind_is_isolated
  if [ -n "$(inner ps -q)" ]; then
    printf 'dind-cache: inner containers are running (a CI job is active); not pruning\n' >&2
    exit 2
  fi
  printf '== before ==\n'; inner system df
  inner builder prune --force --all --filter "unused-for=${MAX_AGE_HOURS}h"
  inner builder prune --force --all --max-used-space "${CEILING_GB}GB"
  printf '== after ==\n'; inner system df
}

case "${1:-}" in
  status) assert_dind_is_isolated; status ;;
  record) assert_dind_is_isolated; record ;;
  prune) prune ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
