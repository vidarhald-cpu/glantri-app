#!/usr/bin/env bash
# Host free-disk guardrail for heavy Glantri work (issue #557).
#
# READ-ONLY toward the system. It measures free space with `df` and prints a verdict;
# the only thing it ever writes is its own log line, and only when --log is given.
# It deletes nothing, calls no `docker` command, and has no destructive flag.
#
# Usage:
#   scripts/ops/disk-guard.sh [--path DIR] [--free-gib N] [--quiet] [--log] [--notify]
#
# --log     append the verdict to $GLANTRI_OPS_LOG_DIR/disk-guard.log (default ~/Glantri-Server/ops-logs)
# --notify  on WARN/HOLD/STOP raise a macOS notification (best effort; never changes the exit status)
#
# Exit status (stable contract; agents branch on it):
#   0   OK     free >= 100 GiB
#   10  WARN   free <  100 GiB  - tell the Orchestrator/operator; continue
#   20  HOLD   free <   60 GiB  - do NOT start new heavy worktrees, installs or builds
#   30  STOP   free <   40 GiB  - stop work and escalate to the operator now
#   2   usage or measurement error (treat as HOLD; never treat as OK)
#
# --free-gib N simulates a measurement (for worked examples and tests only).
set -euo pipefail

WARN_GIB=100
HOLD_GIB=60
STOP_GIB=40

path="${HOME:-/}"
simulated=""
quiet=0
log=0
notify=0
while [ $# -gt 0 ]; do
  case "$1" in
    --path) path="${2:?--path needs a value}"; shift 2 ;;
    --free-gib) simulated="${2:?--free-gib needs a value}"; shift 2 ;;
    --quiet) quiet=1; shift ;;
    --log) log=1; shift ;;
    --notify) notify=1; shift ;;
    -h | --help) sed -n '2,21p' "$0"; exit 0 ;;
    *) printf 'disk-guard: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [ -n "$simulated" ]; then
  case "$simulated" in
    '' | *[!0-9]*) printf 'disk-guard: --free-gib must be a non-negative integer\n' >&2; exit 2 ;;
  esac
  free_gib="$simulated"
  source="simulated"
else
  # POSIX df: 1024-byte blocks, column 4 is Available. Whole GiB, rounded down.
  avail_kib=$(df -Pk "$path" 2>/dev/null | awk 'NR==2 {print $4}') || avail_kib=""
  case "$avail_kib" in
    '' | *[!0-9]*) printf 'disk-guard: could not measure free space for %s\n' "$path" >&2; exit 2 ;;
  esac
  free_gib=$((avail_kib / 1024 / 1024))
  source="df $path"
fi

if [ "$free_gib" -lt "$STOP_GIB" ]; then
  level=STOP; code=30
  action="STOP and intervene: halt agents, free space or notify the operator now."
elif [ "$free_gib" -lt "$HOLD_GIB" ]; then
  level=HOLD; code=20
  action="HOLD: do not start new heavy worktrees, pnpm installs or builds. Release pushed worktrees."
elif [ "$free_gib" -lt "$WARN_GIB" ]; then
  level=WARN; code=10
  action="WARN: report to the Orchestrator; check the DinD build cache (scripts/ops/dind-cache.sh status)."
else
  level=OK; code=0
  action="OK."
fi

if [ "$quiet" -eq 0 ] || [ "$code" -ne 0 ]; then
  printf 'DISK_GUARD level=%s free_gib=%s warn<%s hold<%s stop<%s source="%s"\n' \
    "$level" "$free_gib" "$WARN_GIB" "$HOLD_GIB" "$STOP_GIB" "$source"
  printf '%s\n' "$action"
fi
if [ "$log" -eq 1 ]; then
  log_dir="${GLANTRI_OPS_LOG_DIR:-$HOME/Glantri-Server/ops-logs}"
  mkdir -p "$log_dir"
  printf '%s level=%s free_gib=%s\n' "$(date -u +%FT%TZ)" "$level" "$free_gib" >>"$log_dir/disk-guard.log"
fi
if [ "$notify" -eq 1 ] && [ "$code" -ne 0 ] && command -v osascript >/dev/null 2>&1; then
  osascript -e "display notification \"$level: ${free_gib} GiB free. $action\" with title \"Glantri host disk\"" >/dev/null 2>&1 || true
fi
exit "$code"
