#!/usr/bin/env bash
set -euo pipefail

helper="scripts/ci/current-run-services.mjs"
state_directory="$(mktemp -d "${TMPDIR:-/tmp}/glantri-ci-isolation.XXXXXX")"
synthetic_tag="glantri-ci-isolation-synthetic-${CI_RESOURCE_SUFFIX}"
synthetic_source_image="${CI_SYNTHETIC_IMAGE:-node:22-alpine}"
stale_name="glantri-ci-isolation-stale-${CI_RESOURCE_SUFFIX}"
current_name="glantri-ci-isolation-current-${CI_RESOURCE_SUFFIX}"
failure_name="glantri-ci-isolation-failure-${CI_RESOURCE_SUFFIX}"
stale_id=""
current_id=""
failure_id=""
host_port=""

cleanup() {
  cleanup_status=0
  if [ -f "$state_directory/failure.json" ]; then
    node "$helper" cleanup "$state_directory" failure || cleanup_status=1
  elif [ -n "$failure_id" ]; then
    docker rm -f "$failure_id" >/dev/null 2>&1 || true
  fi
  if [ -f "$state_directory/current.json" ]; then
    node "$helper" cleanup "$state_directory" current || cleanup_status=1
  elif [ -n "$current_id" ]; then
    docker rm -f "$current_id" >/dev/null 2>&1 || true
  fi
  if [ -n "$stale_id" ]; then
    docker rm -f "$stale_id" >/dev/null 2>&1 || true
  fi
  docker image rm "$synthetic_tag" >/dev/null 2>&1 || true

  if [ -n "$current_id" ] && docker inspect "$current_id" >/dev/null 2>&1; then
    echo "Synthetic current container remains after cleanup."
    cleanup_status=1
  fi
  if [ -n "$stale_id" ] && docker inspect "$stale_id" >/dev/null 2>&1; then
    echo "Synthetic stale container remains after cleanup."
    cleanup_status=1
  fi
  if [ -n "$failure_id" ] && docker inspect "$failure_id" >/dev/null 2>&1; then
    echo "Synthetic readiness-failure container remains after cleanup."
    cleanup_status=1
  fi
  if docker image inspect "$synthetic_tag" >/dev/null 2>&1; then
    echo "Synthetic image tag remains after cleanup."
    cleanup_status=1
  fi
  find "$state_directory" -maxdepth 1 -type f -delete
  rmdir "$state_directory"
  return "$cleanup_status"
}
trap cleanup EXIT

docker tag "$synthetic_source_image" "$synthetic_tag"
synthetic_image_id="$(docker image inspect --format '{{.Id}}' "$synthetic_tag")"

stale_id="$(
  docker run -d --name "$stale_name" -p 0:8080 "$synthetic_tag" \
    node -e 'require("node:http").createServer((_request,response)=>response.end("stale-service")).listen(8080,"0.0.0.0")'
)"
host_port="$(docker port "$stale_id" 8080/tcp | sed -n '1s/.*://p')"
test -n "$host_port"
stale_response=""
for attempt in $(seq 1 20); do
  if stale_response="$(curl -fsS "http://${CI_DIND_HOST}:${host_port}" 2>/dev/null)"; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "Synthetic stale service did not become healthy."
    exit 1
  fi
  sleep 0.1
done
test "$stale_response" = "stale-service"

if node "$helper" assert-ports-free "$CI_DIND_HOST" "$host_port"; then
  echo "A retained healthy stale service incorrectly passed the later-run port gate."
  exit 1
fi
echo "Retained healthy stale service was rejected before later-run startup."

docker rm -f "$stale_id" >/dev/null
if docker inspect "$stale_id" >/dev/null 2>&1; then
  echo "Synthetic stale service remains after exact removal."
  exit 1
fi
stale_id=""

node "$helper" assert-ports-free "$CI_DIND_HOST" "$host_port"
current_id="$(
  docker run -d --name "$current_name" -p "${host_port}:8080" "$synthetic_tag" \
    node -e 'require("node:http").createServer((_request,response)=>response.end("current-service")).listen(8080,"0.0.0")'
)"
node "$helper" record \
  "$state_directory" current "$current_id" "$synthetic_image_id" "$synthetic_tag" 8080 "$host_port"
node "$helper" verify "$state_directory" current
node "$helper" wait-http "$state_directory" current "http://127.0.0.1:8080" 10 250
test "$(curl -fsS "http://${CI_DIND_HOST}:${host_port}")" = "current-service"
echo "Clean current service passed exact container, image, port, and readiness checks."

failure_id="$(
  docker run -d --name "$failure_name" -p 0:8080 "$synthetic_tag" \
    node -e 'console.log("Starting API"); console.log(JSON.stringify({session:{id:"qa-multiline-session"},sessionId:["qa-array-session"],cookie:"sid=qa-cookie-fixed",status:503},null,2)); console.log("Readiness failed"); require("node:http").createServer((_request,response)=>{response.statusCode=503;response.end("deliberate-not-ready")}).listen(8080,"0.0.0.0")'
)"
failure_port="$(docker port "$failure_id" 8080/tcp | sed -n '1s/.*://p')"
test -n "$failure_port"
failure_logs=""
for attempt in $(seq 1 20); do
  failure_logs="$(docker logs "$failure_id" 2>&1)"
  if [[ "$failure_logs" == *"Readiness failed"* ]]; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "Synthetic readiness-failure service did not emit its fixture log."
    exit 1
  fi
  sleep 0.1
done
node "$helper" record \
  "$state_directory" failure "$failure_id" "$synthetic_image_id" "$synthetic_tag" 8080 "$failure_port"
set +e
failure_output="$(
  node "$helper" wait-http "$state_directory" failure "http://127.0.0.1:8080" 1 0 2>&1
)"
failure_status=$?
set -e
if [ "$failure_status" -eq 0 ]; then
  echo "Synthetic readiness-failure service unexpectedly passed."
  exit 1
fi
for secret in qa-multiline-session qa-array-session qa-cookie-fixed; do
  if [[ "$failure_output" == *"$secret"* ]]; then
    echo "Synthetic secret leaked through readiness-failure log collection."
    exit 1
  fi
done
for diagnostic in "Starting API" '"status": 503' "Readiness failed" "[REDACTED]"; do
  if [[ "$failure_output" != *"$diagnostic"* ]]; then
    echo "Readiness-failure log collection lost required diagnostic structure."
    exit 1
  fi
done
echo "Readiness-failure collector preserved multiline secret context and safe diagnostics."
