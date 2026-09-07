#!/bin/sh

# Sourced by repository entry points that must not trust the host's default Node.

glantri_node_version() {
  tr -d '[:space:]' < "$1/.node-version"
}

glantri_node_matches() {
  candidate=$1
  required=$2

  test -x "$candidate" || return 1
  actual=$("$candidate" -p 'process.versions.node' 2>/dev/null) || return 1
  test "$actual" = "$required"
}

glantri_select_node() {
  repository_root=$1
  required=$(glantri_node_version "$repository_root")

  if test -n "${GLANTRI_NODE_BIN:-}"; then
    if glantri_node_matches "$GLANTRI_NODE_BIN" "$required"; then
      printf '%s\n' "$GLANTRI_NODE_BIN"
      return 0
    fi

    printf '%s\n' \
      "GLANTRI_NODE_BIN does not provide required Node ${required}; refusing fallback." >&2
    return 1
  fi

  path_node=$(command -v node 2>/dev/null || true)
  candidates=""

  if test -n "${PNPM_HOME:-}"; then
    candidates="${candidates}
${PNPM_HOME}/node"
  fi

  candidates="${candidates}
${HOME}/Library/pnpm/node
${HOME}/.local/share/mise/installs/node/${required}/bin/node
${HOME}/.asdf/installs/nodejs/${required}/bin/node
${HOME}/.nvm/versions/node/v${required}/bin/node
${HOME}/.fnm/node-versions/v${required}/installation/bin/node
${HOME}/.volta/tools/image/node/${required}/bin/node
/opt/homebrew/opt/node@22/bin/node
/usr/local/opt/node@22/bin/node
${path_node}"

  old_ifs=$IFS
  IFS='
'
  for candidate in $candidates; do
    if glantri_node_matches "$candidate" "$required"; then
      IFS=$old_ifs
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  IFS=$old_ifs

  printf '%s\n' \
    "Required Node ${required} was not found. Install that version or set GLANTRI_NODE_BIN to its executable; the host PATH Node is never accepted unless it matches exactly." >&2
  return 1
}
