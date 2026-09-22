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
orphan_name="glantri-ci-isolation-orphan-${CI_RESOURCE_SUFFIX}"
active_name="glantri-ci-isolation-active-${CI_RESOURCE_SUFFIX}"
legacy_name="glantri-web-test-legacy-${CI_RESOURCE_SUFFIX}"
job_name="FORGEJO-ACTIONS-TASK-999999_WORKFLOW-$(printf 'f%.0s' $(seq 1 64))_JOB-glantri-synthetic"
dead_job_container="$(printf 'a%.0s' $(seq 1 64))"
orphan_id=""
active_id=""
legacy_id=""
job_id=""

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
  for lifecycle_id in "$orphan_id" "$active_id" "$legacy_id" "$job_id"; do
    if [ -n "$lifecycle_id" ]; then
      docker rm -f "$lifecycle_id" >/dev/null 2>&1 || true
    fi
  done
  docker image rm "$legacy_name" >/dev/null 2>&1 || true
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
  for lifecycle_id in "$orphan_id" "$active_id" "$legacy_id" "$job_id"; do
    if [ -n "$lifecycle_id" ] && docker inspect "$lifecycle_id" >/dev/null 2>&1; then
      echo "Synthetic service-lifecycle container remains after cleanup."
      cleanup_status=1
    fi
  done
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
    node -e 'console.log(`Starting API
status=503
{"session": {
  "id": "qa-truncated-object"
Readiness failed
sessionId = [
  "qa-truncated-array"
Readiness failed
{"session": {
  "id": "qa-mismatched-session"
]
Readiness failed
session = {
"nested":{"id":"qa-nested-unclosed-session"}
Readiness failed
sessionId = [
"qa-truncated-string-session
Readiness failed
session = {
id: "qa-unquoted-property-session"
Readiness failed`); require("node:http").createServer((_request,response)=>{response.statusCode=503;response.end("deliberate-not-ready")}).listen(8080,"0.0.0.0")'
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
for secret in \
  qa-truncated-object \
  qa-truncated-array \
  qa-mismatched-session \
  qa-nested-unclosed-session \
  qa-truncated-string-session \
  qa-unquoted-property-session; do
  if [[ "$failure_output" == *"$secret"* ]]; then
    echo "Synthetic secret leaked through readiness-failure log collection."
    exit 1
  fi
done
for diagnostic in "Starting API" "status=503" "Readiness failed" "[REDACTED]"; do
  if [[ "$failure_output" != *"$diagnostic"* ]]; then
    echo "Readiness-failure log collection lost required diagnostic structure."
    exit 1
  fi
done
echo "Readiness-failure collector failed closed for incomplete sensitive structures and preserved safe diagnostics."

# Cancelled-run orphan recovery, active-run protection, and indeterminate-liveness refusal.
serve_synthetic() {
  docker run -d "$@" "$synthetic_tag" \
    node -e 'require("node:http").createServer((_request,response)=>response.end(process.env.SYNTHETIC_BODY)).listen(8080,"0.0.0.0")'
}

job_id="$(docker run -d --name "$job_name" "$synthetic_tag" sleep 900)"
job_container_id="$(docker inspect --format '{{.Id}}' "$job_id")"

orphan_id="$(
  serve_synthetic --name "$orphan_name" -p 0:8080 -e SYNTHETIC_BODY=orphan-service \
    --label com.glantri.ci.owner=glantri-browser-service \
    --label "com.glantri.ci.resource-suffix=orphan-${CI_RESOURCE_SUFFIX}" \
    --label "com.glantri.ci.job-container=$dead_job_container"
)"
active_id="$(
  serve_synthetic --name "$active_name" -p 0:8080 -e SYNTHETIC_BODY=active-service \
    --label com.glantri.ci.owner=glantri-browser-service \
    --label "com.glantri.ci.resource-suffix=active-${CI_RESOURCE_SUFFIX}" \
    --label "com.glantri.ci.job-container=$job_container_id"
)"
legacy_id="$(serve_synthetic --name "$legacy_name" -p 0:8080 -e SYNTHETIC_BODY=legacy-service)"

orphan_port="$(docker port "$orphan_id" 8080/tcp | sed -n '1s/.*://p')"
active_port="$(docker port "$active_id" 8080/tcp | sed -n '1s/.*://p')"
test -n "$orphan_port"
test -n "$active_port"
for endpoint in "$orphan_port:orphan-service" "$active_port:active-service"; do
  endpoint_port="${endpoint%%:*}"
  endpoint_body="${endpoint##*:}"
  for attempt in $(seq 1 20); do
    if [ "$(curl -fsS "http://${CI_DIND_HOST}:${endpoint_port}" 2>/dev/null)" = "$endpoint_body" ]; then
      break
    fi
    if [ "$attempt" -eq 20 ]; then
      echo "Synthetic lifecycle service $endpoint_body did not become healthy."
      exit 1
    fi
    sleep 0.1
  done
done

if node "$helper" assert-ports-free "$CI_DIND_HOST" "$orphan_port"; then
  echo "A cancelled run's orphaned service incorrectly passed the later-run port gate."
  exit 1
fi
echo "Cancelled-run orphan reproduced the later-run port blockage."

reclaim_output="$(node "$helper" reclaim-stale "$state_directory" "$CI_RESOURCE_SUFFIX" 2>&1)"
printf '%s\n' "$reclaim_output"

# Self-identification must be proven, not merely survived. Without this the
# whole synthetic is satisfied equally by a working mechanism and by a run that
# could not identify its own job container at all.
if [[ "$reclaim_output" != *"This job runs in runner job container "* ]]; then
  echo "Reclamation could not prove which runner job container it runs in, so this synthetic proves nothing about ownership anchoring."
  exit 1
fi
echo "Self-identification through the Docker daemon was proven against a real daemon."

if docker inspect "$orphan_id" >/dev/null 2>&1; then
  echo "Cancelled-run orphan survived stale service reclamation."
  exit 1
fi
orphan_id=""
node "$helper" assert-ports-free "$CI_DIND_HOST" "$orphan_port"
echo "Cancelled-run orphan was reclaimed and its port became available again."

test "$(docker inspect --format '{{.State.Running}}' "$active_id")" = true
test "$(curl -fsS "http://${CI_DIND_HOST}:${active_port}")" = "active-service"
test "$(docker inspect --format '{{.State.Running}}' "$job_id")" = true
echo "An actually active run's service and its owning job container were left untouched."

test "$(docker inspect --format '{{.State.Running}}' "$legacy_id")" = true
echo "Unanchored debris was refused while a concurrent job container could not be ruled out."

# Sole-running-job reclamation, against a real daemon. With the synthetic job
# container stopped, this job container is the only running runner job
# container, so unanchored legacy debris becomes provably reclaimable. This is
# the only path that clears pre-anchor debris, and it is unreachable while any
# other job container runs.
docker stop "$job_id" >/dev/null
test "$(docker inspect --format '{{.State.Running}}' "$job_id")" = false

sole_output="$(node "$helper" reclaim-stale "$state_directory" "$CI_RESOURCE_SUFFIX" 2>&1)"
printf '%s\n' "$sole_output"
if [[ "$sole_output" != *"This job runs in runner job container "* ]]; then
  echo "Sole-job reclamation could not prove which runner job container it runs in."
  exit 1
fi
if [[ "$sole_output" != *"this job container is the only running job container, so no other run is live"* ]]; then
  echo "The sole-running-job reclamation branch did not execute against a real daemon."
  exit 1
fi
if docker inspect "$legacy_id" >/dev/null 2>&1; then
  echo "Unanchored debris survived sole-running-job reclamation."
  exit 1
fi
legacy_id=""
if docker inspect "$active_id" >/dev/null 2>&1; then
  echo "A service whose owning job container has since stopped survived reclamation."
  exit 1
fi
active_id=""
echo "Unanchored debris was reclaimed once this job container was provably the only running job container, and the service whose owner had since stopped was reclaimed with it."
