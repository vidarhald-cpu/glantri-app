#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
SOURCE_DIR="$REPOSITORY_ROOT/infra/forgejo-actions"
RUNNER_HOME=${GLANTRI_RUNNER_HOME:-}
FORGEJO_CONTAINER=${GLANTRI_FORGEJO_CONTAINER:-glantri-forgejo}
RUNNER_NAME=${GLANTRI_RUNNER_NAME:-glantri-private-ci}
RUNNER_LABEL=glantri-private-ci
RUNNER_SCOPE=recovery-admin/glantri-app
RUNNER_VERSION=13.1.0
# The one Forgejo address literal in this file. Everything else resolves the
# address through resolve_forgejo_url, so the rendered configuration and the
# address verify probes cannot disagree.
FORGEJO_URL_DEFAULT='http://host.docker.internal:3001/'
# Deliberately strict: http or https, dot-separated host labels of letters,
# digits and inner hyphens, an optional one-to-five-digit port, exactly one
# trailing slash, and nothing else. The address is substituted into the rendered
# configuration literally, so admitting a path, credentials, a query, whitespace
# or any shell or sed metacharacter is not required and is not accepted.
FORGEJO_URL_LABEL='[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?'
FORGEJO_URL_PATTERN="^https?://$FORGEJO_URL_LABEL(\\.$FORGEJO_URL_LABEL)*(:[0-9]{1,5})?/\$"
FORGEJO_URL=""
RENDERED_FORGEJO_URL=""
VERIFY_FORGEJO_URL=""

usage() {
  printf '%s\n' \
    'Usage: GLANTRI_RUNNER_HOME=/absolute/path scripts/ci/forgejo-runner-service.sh <command>' \
    '' \
    'Commands:' \
    '  bootstrap  Register the repository-scoped runner and start the service.' \
    '  up         Start an already-bootstrapped service.' \
    '  restart    Restart the service and verify it returns healthy.' \
    '  status     Show the two service containers.' \
    '  verify     Verify versions, isolation, health, and restart policy.' \
    '  pause      Gracefully stop only the runner after its current job.' \
    '  migrate-label  Replace the legacy ubuntu-latest label while stopped.' \
    '  down       Stop the service, retaining registration and DIND cache.' \
    '  refresh-config  Re-render the external configuration without starting anything.' \
    '  print-endpoint [service|bootstrap|verify]  Print only the resolved Forgejo address.' \
    '' \
    'The Forgejo address is read from GLANTRI_FORGEJO_URL at bootstrap and then' \
    'from state/forgejo-url. refresh-config and print-endpoint exist so that the' \
    'resolution and the rendered configuration can be exercised without Docker;' \
    'print-endpoint prints an address only, never the registration token.'
}

require_runner_home() {
  case "$RUNNER_HOME" in
    /*) ;;
    *)
      printf 'GLANTRI_RUNNER_HOME must be an absolute path.\n' >&2
      exit 2
      ;;
  esac
}

validate_forgejo_url() {
  if [[ $1 =~ $FORGEJO_URL_PATTERN ]]; then
    return 0
  fi
  printf '%s is not an accepted Forgejo address: %s\n' "$2" "$1" >&2
  printf 'Expected scheme://host[:port]/ with scheme http or https, one trailing slash, and no path, credentials, query, or other characters.\n' >&2
  exit 2
}

persist_forgejo_url() {
  umask 077
  mkdir -p "$RUNNER_HOME/state"
  temporary_url="$RUNNER_HOME/state/forgejo-url.tmp"
  printf '%s\n' "$1" >"$temporary_url"
  chmod 600 "$temporary_url"
  mv "$temporary_url" "$RUNNER_HOME/state/forgejo-url"
}

# Sets FORGEJO_URL. Mode bootstrap may adopt GLANTRI_FORGEJO_URL for an
# installation that has no persisted address yet; mode service may not, because
# a registered runner must not be repointed at another server by a routine up.
resolve_forgejo_url() {
  mode=$1
  url_file="$RUNNER_HOME/state/forgejo-url"
  requested=${GLANTRI_FORGEJO_URL:-}
  if [ -n "$requested" ]; then
    validate_forgejo_url "$requested" 'GLANTRI_FORGEJO_URL'
  fi

  if [ -s "$url_file" ]; then
    FORGEJO_URL=$(cat "$url_file")
    validate_forgejo_url "$FORGEJO_URL" "$url_file"
  elif [ "$mode" = bootstrap ] && [ -n "$requested" ]; then
    FORGEJO_URL=$requested
    persist_forgejo_url "$FORGEJO_URL"
  else
    # An installation bootstrapped before the address became configurable keeps
    # the address it was registered against.
    FORGEJO_URL=$FORGEJO_URL_DEFAULT
    persist_forgejo_url "$FORGEJO_URL"
  fi

  if [ -n "$requested" ] && [ "$requested" != "$FORGEJO_URL" ]; then
    printf 'GLANTRI_FORGEJO_URL is %s but this installation is registered against %s.\n' \
      "$requested" "$FORGEJO_URL" >&2
    printf 'Refusing to repoint a registered runner. Write the intended address into %s and run restart.\n' \
      "$url_file" >&2
    exit 2
  fi
}

# Sets RENDERED_FORGEJO_URL from the configuration the runner actually loads.
rendered_forgejo_url() {
  config_path="$RUNNER_HOME/state/runner-config.yml"
  test -s "$config_path"
  RENDERED_FORGEJO_URL=$(sed -n 's/^      url: \(.*\)$/\1/p' "$config_path")
  validate_forgejo_url "$RENDERED_FORGEJO_URL" "$config_path"
}

# Sets VERIFY_FORGEJO_URL to the address the running runner is configured to
# poll, after proving that it is the persisted address.
verify_forgejo_url() {
  rendered_forgejo_url
  resolve_forgejo_url service
  if [ "$RENDERED_FORGEJO_URL" != "$FORGEJO_URL" ]; then
    printf 'Rendered runner configuration uses %s but this installation is registered against %s.\n' \
      "$RENDERED_FORGEJO_URL" "$FORGEJO_URL" >&2
    printf 'Run restart to re-render the configuration from the persisted address.\n' >&2
    exit 1
  fi
  VERIFY_FORGEJO_URL=$RENDERED_FORGEJO_URL
}

compose() {
  docker compose --project-directory "$RUNNER_HOME" --file "$RUNNER_HOME/compose.yaml" "$@"
}

wait_for_service() {
  attempts=0
  while [ "$attempts" -lt 60 ]; do
    attempts=$((attempts + 1))
    dind_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' glantri-forgejo-actions-dind 2>/dev/null || true)
    runner_state=$(docker inspect --format '{{.State.Status}}' glantri-forgejo-actions-runner 2>/dev/null || true)
    if [ "$dind_health" = healthy ] && [ "$runner_state" = running ]; then
      return 0
    fi
    sleep 1
  done
  printf 'Runner service did not become healthy within 60 seconds.\n' >&2
  compose ps >&2 || true
  exit 1
}

render_config() {
  uuid=$1
  endpoint=$2
  case "$uuid" in
    ????????-????-????-????-????????????) ;;
    *)
      printf 'Runner configuration does not contain a valid UUID.\n' >&2
      exit 1
      ;;
  esac
  validate_forgejo_url "$endpoint" 'The resolved Forgejo address'

  template=$(cat "$SOURCE_DIR/runner-config.template.yml")
  for placeholder in __RUNNER_UUID__ __FORGEJO_URL__; do
    case "$template" in
      *"$placeholder"*) ;;
      *)
        printf 'Runner configuration template does not contain the %s placeholder.\n' "$placeholder" >&2
        exit 1
        ;;
    esac
  done
  # Literal parameter substitution, not sed: a URL contains the delimiter and
  # the metacharacters a sed replacement would reinterpret.
  rendered=${template//__RUNNER_UUID__/$uuid}
  rendered=${rendered//__FORGEJO_URL__/$endpoint}

  config_path="$RUNNER_HOME/state/runner-config.yml"
  temporary_config="$config_path.tmp"
  umask 077
  printf '%s\n' "$rendered" >"$temporary_config"
  chmod 600 "$temporary_config"
  rendered_endpoint=$(sed -n 's/^      url: \(.*\)$/\1/p' "$temporary_config")
  if [ "$rendered_endpoint" != "$endpoint" ]; then
    rm -f "$temporary_config"
    printf 'Rendered runner configuration does not carry the resolved Forgejo address %s.\n' "$endpoint" >&2
    exit 1
  fi
  mv "$temporary_config" "$config_path"
}

refresh_config() {
  config_path="$RUNNER_HOME/state/runner-config.yml"
  test -s "$config_path"
  uuid=$(sed -n 's/^      uuid: \(.*\)$/\1/p' "$config_path")
  resolve_forgejo_url service
  render_config "$uuid" "$FORGEJO_URL"
}

refresh_config_only() {
  refresh_config
  printf 'External runner configuration re-rendered for %s; restart to apply it.\n' "$FORGEJO_URL"
}

print_endpoint() {
  case "${1:-}" in
    "" | service)
      resolve_forgejo_url service
      printf '%s\n' "$FORGEJO_URL"
      ;;
    bootstrap)
      resolve_forgejo_url bootstrap
      printf '%s\n' "$FORGEJO_URL"
      ;;
    verify)
      verify_forgejo_url
      printf '%s\n' "$VERIFY_FORGEJO_URL"
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

bootstrap() {
  if [ -e "$RUNNER_HOME/state/runner-token" ] && [ -e "$RUNNER_HOME/state/runner-config.yml" ]; then
    printf 'Runner token already exists; use up or restart instead of rotating it.\n' >&2
    exit 2
  fi

  resolve_forgejo_url bootstrap

  umask 077
  mkdir -p "$RUNNER_HOME/state"
  cp "$SOURCE_DIR/compose.yaml" "$RUNNER_HOME/compose.yaml"
  cp "$SOURCE_DIR/dind-daemon.json" "$RUNNER_HOME/dind-daemon.json"

  printf 'RUNNER_UID=%s\nRUNNER_GID=%s\n' "$(id -u)" "$(id -g)" >"$RUNNER_HOME/.env"

  if [ -e "$RUNNER_HOME/state/runner-token" ]; then
    secret=$(<"$RUNNER_HOME/state/runner-token")
  else
    secret=$(docker exec --user git "$FORGEJO_CONTAINER" forgejo forgejo-cli actions generate-secret)
  fi
  case "$secret" in
    *[!0-9a-f]*)
      printf 'Forgejo returned an invalid runner secret.\n' >&2
      exit 1
      ;;
  esac
  if [ "${#secret}" -ne 40 ]; then
    printf 'Forgejo returned an invalid runner secret.\n' >&2
    exit 1
  fi
  printf '%s' "$secret" >"$RUNNER_HOME/state/runner-token"
  chmod 600 "$RUNNER_HOME/state/runner-token"

  uuid=$(printf '%s' "$secret" | docker exec -i --user git "$FORGEJO_CONTAINER" forgejo forgejo-cli actions register \
    --secret-stdin=1 \
    --scope "$RUNNER_SCOPE" \
    --labels "$RUNNER_LABEL" \
    --name "$RUNNER_NAME" \
    --version "$RUNNER_VERSION" | tail -n 1)
  case "$uuid" in
    ????????-????-????-????-????????????) ;;
    *)
      printf 'Forgejo did not return a valid runner UUID.\n' >&2
      exit 1
      ;;
  esac

  render_config "$uuid" "$FORGEJO_URL"
  unset secret

  compose up --detach
  wait_for_service
  verify
  printf 'Repository-scoped Forgejo runner bootstrapped against %s without exposing its token.\n' \
    "$FORGEJO_URL"
}

up() {
  test -s "$RUNNER_HOME/state/runner-token"
  test -s "$RUNNER_HOME/state/runner-config.yml"
  refresh_config
  cp "$SOURCE_DIR/compose.yaml" "$RUNNER_HOME/compose.yaml"
  cp "$SOURCE_DIR/dind-daemon.json" "$RUNNER_HOME/dind-daemon.json"
  compose up --detach
  wait_for_service
  verify
}

restart() {
  refresh_config
  compose restart
  wait_for_service
  verify
}

status() {
  compose ps
}

verify() {
  verify_forgejo_url

  runner_version=$(docker exec glantri-forgejo-actions-runner forgejo-runner --version)
  test "$runner_version" = "forgejo-runner version v$RUNNER_VERSION"

  dind_server=$(docker exec glantri-forgejo-actions-dind docker version --format '{{.Server.Version}}')
  case "$dind_server" in
    29.*) ;;
    *)
      printf 'Expected Docker 29 in DIND, got %s.\n' "$dind_server" >&2
      exit 1
      ;;
  esac

  host_socket_mounts=$(docker inspect glantri-forgejo-actions-runner glantri-forgejo-actions-dind \
    --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' | grep -c '/var/run/docker.sock' || true)
  test "$host_socket_mounts" -eq 0

  published_ports=$(docker inspect glantri-forgejo-actions-runner glantri-forgejo-actions-dind \
    --format '{{range $port, $bindings := .NetworkSettings.Ports}}{{if $bindings}}{{println $port}}{{end}}{{end}}' | sed '/^$/d' | wc -l | tr -d ' ')
  test "$published_ports" -eq 0

  runner_privileged=$(docker inspect --format '{{.HostConfig.Privileged}}' glantri-forgejo-actions-runner)
  test "$runner_privileged" = false

  runner_restart=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' glantri-forgejo-actions-runner)
  dind_restart=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' glantri-forgejo-actions-dind)
  test "$runner_restart" = unless-stopped
  test "$dind_restart" = unless-stopped

  verify_network=glantri-runner-verify
  docker exec glantri-forgejo-actions-dind docker network rm "$verify_network" >/dev/null 2>&1 || true
  docker exec glantri-forgejo-actions-dind docker network create "$verify_network" >/dev/null
  set +e
  docker exec glantri-forgejo-actions-dind docker run --rm --network "$verify_network" \
    --env "FORGEJO_HEALTH_URL=${VERIFY_FORGEJO_URL}api/healthz" \
    docker.io/library/node:22-bookworm@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d \
    sh -c 'test "$(node --version)" = v22.23.2 && curl --fail --silent --show-error "$FORGEJO_HEALTH_URL" >/dev/null'
  route_status=$?
  set -e
  docker exec glantri-forgejo-actions-dind docker network rm "$verify_network" >/dev/null
  if [ "$route_status" -ne 0 ]; then
    printf 'Pinned Node job image could not reach Forgejo at %s through a nested job network.\n' \
      "$VERIFY_FORGEJO_URL" >&2
    exit "$route_status"
  fi

  printf 'Runner v%s, Docker %s, Node v22.23.2, Forgejo route to %s, isolation, and restart policy verified.\n' \
    "$RUNNER_VERSION" "$dind_server" "$VERIFY_FORGEJO_URL"
}

pause() {
  docker stop --signal TERM --timeout 700 glantri-forgejo-actions-runner >/dev/null
  printf 'Runner paused after graceful shutdown; DIND and its cache remain available.\n'
}

migrate_label() {
  runner_state=$(docker inspect --format '{{.State.Status}}' glantri-forgejo-actions-runner 2>/dev/null || true)
  if [ "$runner_state" = running ]; then
    printf 'Pause the runner before changing its label.\n' >&2
    exit 2
  fi

  config_path="$RUNNER_HOME/state/runner-config.yml"
  test -s "$config_path"
  verify_forgejo_url
  if grep -q "^    - $RUNNER_LABEL:docker://" "$config_path"; then
    printf 'Runner already uses the dedicated %s label.\n' "$RUNNER_LABEL"
    return
  fi
  if ! grep -q '^    - ubuntu-latest:docker://' "$config_path"; then
    printf 'Runner config does not contain the expected legacy label.\n' >&2
    exit 2
  fi

  umask 077
  temporary_config="$config_path.tmp"
  sed "s/^    - ubuntu-latest:docker:/    - $RUNNER_LABEL:docker:/" "$config_path" >"$temporary_config"
  chmod 600 "$temporary_config"
  mv "$temporary_config" "$config_path"
  printf 'Runner config now uses the dedicated %s label.\n' "$RUNNER_LABEL"
}

down() {
  compose down
  printf 'Runner stopped; repository registration, token, and DIND cache were retained.\n'
}

require_runner_home
command=${1:-}
case "$command" in
  bootstrap) bootstrap ;;
  up) up ;;
  restart) restart ;;
  status) status ;;
  verify) verify ;;
  pause) pause ;;
  migrate-label) migrate_label ;;
  down) down ;;
  refresh-config) refresh_config_only ;;
  print-endpoint) print_endpoint "${2:-}" ;;
  *)
    usage >&2
    exit 2
    ;;
esac
