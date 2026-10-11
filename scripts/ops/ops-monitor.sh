#!/usr/bin/env bash
# Hourly host monitor tick (issue #557), run by launchd. Records host free space and
# the inner DinD build-cache size, and raises a macOS notification when either is out
# of range. Read-only: it only calls disk-guard.sh and `dind-cache.sh record`, neither
# of which can delete anything. Always exits 0 so launchd does not throttle the job;
# the verdicts are in the logs and the notifications.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd -P)
"$here/disk-guard.sh" --quiet --log --notify || true
"$here/dind-cache.sh" record >/dev/null || true
exit 0
