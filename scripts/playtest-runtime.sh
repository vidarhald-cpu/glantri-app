#!/bin/sh
set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_directory/.." && pwd)

. "$repository_root/scripts/bootstrap/select-node.sh"

selected_node=$(glantri_select_node "$repository_root")
selected_node_directory=$(dirname -- "$selected_node")
PATH="$selected_node_directory:$PATH"
export PATH

pnpm_binary=$(command -v pnpm 2>/dev/null || true)

if test -z "$pnpm_binary"; then
  printf '%s\n' "pnpm is required for the standing playtest runtime." >&2
  exit 1
fi

expected_pnpm=$(
  "$selected_node" -e \
    'const value=require(process.argv[1]).packageManager||"";process.stdout.write(value.replace(/^pnpm@/,""))' \
    "$repository_root/package.json"
)
actual_pnpm=$("$pnpm_binary" --version)

if test "$actual_pnpm" != "$expected_pnpm"; then
  printf '%s\n' \
    "Required pnpm ${expected_pnpm} was not found; selected ${pnpm_binary} reports ${actual_pnpm}." >&2
  exit 1
fi

export GLANTRI_PLAYTEST_NODE_BIN="$selected_node"
export GLANTRI_PLAYTEST_PNPM_BIN="$pnpm_binary"

exec "$selected_node" "$repository_root/scripts/playtest/runtimeController.mjs" "$@"
