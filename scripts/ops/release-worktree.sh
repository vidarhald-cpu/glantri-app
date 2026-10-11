#!/usr/bin/env bash
# Safely release a delegated Git worktree once its work is durably pushed (#557).
#
# Usage:
#   scripts/ops/release-worktree.sh <worktree-path> [--execute]
#
# Default is a DRY RUN: it runs every check and prints the verdict, deleting nothing.
# With --execute it removes the worktree with plain `git worktree remove` (no --force)
# and only if ALL checks pass. It never deletes a branch, never touches any other
# worktree, and never runs rm.
#
# HARD RULE (do not weaken): never delete a worktree whose HEAD commit exists only
# there. The checks are:
#   1. <path> is a registered LINKED worktree (not the primary checkout, not unknown).
#   2. The working tree is clean: no modified, staged or untracked (non-ignored) files.
#   3. The worktree HEAD commit is reachable from the branch tip on `origin`, read
#      from the remote itself (git ls-remote + fetch of that exact ref), not from a
#      possibly stale local remote-tracking ref.
# Exit: 0 releasable (dry run) or released (--execute); 1 refused; 2 usage error.
set -euo pipefail

refuse() { printf 'release-worktree: REFUSED: %s\n' "$*" >&2; exit 1; }

[ $# -ge 1 ] || { sed -n '2,19p' "$0"; exit 2; }
target="$1"; shift
execute=0
while [ $# -gt 0 ]; do
  case "$1" in
    --execute) execute=1 ;;
    *) printf 'release-worktree: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

[ -d "$target" ] || refuse "not a directory: $target"
target=$(cd "$target" && pwd -P)

common=$(git -C "$target" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || refuse "not a git worktree: $target"
gitdir=$(git -C "$target" rev-parse --path-format=absolute --git-dir)
[ "$common" != "$gitdir" ] || refuse "$target is the primary checkout, not a linked worktree"

registered=0
while IFS= read -r line; do
  [ "$line" = "worktree $target" ] && registered=1
done < <(git -C "$target" worktree list --porcelain)
[ "$registered" -eq 1 ] || refuse "$target is not a registered linked worktree"

head_sha=$(git -C "$target" rev-parse HEAD)
branch=$(git -C "$target" symbolic-ref --quiet --short HEAD || true)
[ -n "$branch" ] || refuse "detached HEAD: no branch to compare against origin; push it to a branch first"

dirty=$(git -C "$target" status --porcelain --untracked-files=all)
[ -z "$dirty" ] || refuse "working tree is not clean (uncommitted or untracked work would be lost):
$dirty"

remote_line=$(git -C "$target" ls-remote --exit-code origin "refs/heads/$branch" 2>/dev/null) \
  || refuse "branch '$branch' does not exist on origin (not pushed)"
remote_sha=${remote_line%%[[:space:]]*}

if [ "$remote_sha" != "$head_sha" ]; then
  # Fetch only the exact branch tip into FETCH_HEAD (does not alter remote.origin.fetch).
  git -C "$target" fetch --quiet origin "refs/heads/$branch" 2>/dev/null \
    || refuse "could not fetch origin/$branch to verify reachability"
  git -C "$target" merge-base --is-ancestor "$head_sha" FETCH_HEAD \
    || refuse "HEAD $head_sha is NOT reachable from origin/$branch ($remote_sha); push first"
fi

printf 'release-worktree: OK: %s HEAD %s is reachable from origin/%s (%s); tree clean.\n' \
  "$target" "$head_sha" "$branch" "$remote_sha"

if [ "$execute" -eq 1 ]; then
  # Plain remove, never --force: git itself re-refuses a dirty tree. Run against the
  # common git dir so the command does not execute from inside the doomed directory.
  git --git-dir="$common" worktree remove "$target"
  printf 'release-worktree: released %s (branch %s kept; origin holds the commits)\n' "$target" "$branch"
else
  printf 'release-worktree: dry run; re-run with --execute to remove it.\n'
fi
