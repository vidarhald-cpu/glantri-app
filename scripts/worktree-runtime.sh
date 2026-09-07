#!/bin/sh
set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_directory/.." && pwd)

. "$repository_root/scripts/bootstrap/select-node.sh"

selected_node=$(glantri_select_node "$repository_root")
exec "$selected_node" "$repository_root/scripts/bootstrap/worktreeBootstrap.mjs" \
  --selected-node "$selected_node" --run "$@"
