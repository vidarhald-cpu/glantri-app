# Private Forgejo Actions runner

## Purpose and fixed gate contract

The protected `dev` branch depends on executable Forgejo Actions. The workflow
name and job identifiers in `.github/workflows/ci.yml` intentionally keep the
four established contexts:

| Event          | Context                           | Branch-required                                                        |
| -------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `push`         | `CI / ci (push)`                  | No                                                                     |
| `push`         | `CI / docker-test (push)`         | No; the job is deliberately skipped and still reaches a terminal state |
| `pull_request` | `CI / ci (pull_request)`          | Yes                                                                    |
| `pull_request` | `CI / docker-test (pull_request)` | Yes                                                                    |

Do not rename the workflow or either job, or change required-context policy,
without control-plane review. Forgejo 15 reads `.github/workflows` only because
there is no `.forgejo/workflows` directory.

## Architecture and security boundary

One repository-scoped Forgejo Runner 13.1.0 polls only
`recovery-admin/glantri-app`. It runs as a non-root user with all Linux
capabilities dropped, `no-new-privileges`, a read-only root filesystem, no host
ports, no administrator credential, and capacity one.

Both jobs request the dedicated `glantri-private-ci` label. The runner advertises
only that label, never Forgejo's generic `ubuntu-latest` label. Labels select a
runner but do not form part of the `CI / <job> (<event>)` status-context name.
This keeps unrelated or historical `ubuntu-latest` work ineligible without
changing the protected branch's required-context policy.

Jobs run as root inside a fresh container created by a dedicated Docker 29.8
Docker-in-Docker (DIND) daemon. DIND is privileged inside Docker Desktop's Linux
VM because nested containers require it, but it receives no host filesystem
mount and never receives the Docker Desktop socket. A workflow therefore cannot
inspect or mutate the Forgejo container, the protected `glantri-postgres`
container, Builder/QA task databases, or other host-daemon resources. The
runner's registration token can poll and report jobs only for this repository;
it is not a Forgejo user, API, Git, administration, protection-bypass, `main`,
Azure, deployment, or production credential.

The only application endpoint jobs need is the loopback Forgejo instance.
Docker Desktop makes it available inside nested jobs as
`http://host.docker.internal:3001/`; no public listener is created. The DIND API
has no TLS because it is reachable only on the private Compose network and from
its own nested containers. It is never published to the Mac.

The runner, DIND, Node job, PostgreSQL service, and Dockerfile base image inputs
are pinned by immutable multi-architecture digest. The job image provides Node
22.23.2, and Corepack resolves the repository declaration `pnpm@10.6.0`. The
workflow asserts both versions before installing dependencies. Forgejo Runner
executes JavaScript actions with that job-container Node binary, so the old
GitHub-hosted-runner `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` assumption is removed.
Remote Forgejo actions are fully qualified and pinned to commits, so the
instance's compiled default Actions URL is not part of the gate.

No repository or runner secrets are injected into jobs. The PostgreSQL password
is a disposable job-local value. Forgejo creates a per-job repository token and
destroys it when the job finishes; pull-request tokens are read-only. The
registration token is mode `0600` under the external runner state directory and
is loaded through `token_url`, never stored in Git, Compose, logs, or command
arguments.

The runner cache proxy is disabled initially because it is not directly
reachable across the nested network and cross-job cache sharing expands the
trust boundary. The persistent DIND volume retains pulled base layers and build
cache. Capacity one prevents concurrent jobs from inspecting one another
through that daemon. Each `docker-test` run uses run-specific names and has an
`always()` teardown for its API/Web containers and tagged images. Forgejo Runner
removes job, step, service containers, and its job network. Periodically inspect
and prune only the dedicated DIND cache when disk use warrants it.

The Node job image receives the DIND Docker client and CLI plugins through two
read-only mounts. Forgejo Runner permits only those exact public executable
paths in `container.valid_volumes`; workflows cannot request any other host or
DIND filesystem mount. The client connects only to the isolated DIND TCP daemon
through `DOCKER_HOST`.

## Current workflow audit

`ci` runs for branch pushes and pull requests. It checks changed-file formatting
and whitespace, typechecks, lints, runs unit tests and coverage, builds all
workspaces, and reports file sizes. It needs Git history, Node, Corepack/pnpm,
network access for the frozen install, CPU, memory, and disk; it needs no Docker,
database, browser, or user-managed secret.

`docker-test` is emitted for both triggers but executes only for pull requests.
It provisions a PostgreSQL 16 service inside DIND, deploys committed migrations,
runs database integration tests, builds and starts the API and Web images,
checks readiness, installs the lockfile-pinned Chromium build and Linux browser
dependencies, then runs the single-worker Playwright smoke suite. A CI-only Node
TCP proxy binds `127.0.0.1:5432` inside the disposable job container and forwards
only to `dind.docker.internal:5432`; this preserves the repository's fail-closed
local/disposable database guard without trusting another hostname or exposing a
port. Separate proxy processes exist only for the integration-test and
Playwright steps and are stopped by their respective shell traps. Playwright's
direct database helpers receive the same guarded disposable URL, while its
browser-route matching uses the actual DIND-visible API origin. The job needs
the isolated DIND daemon but no protected local database. Its 60-minute workflow
limit and the runner's 90-minute hard limit ensure terminal failure instead of
an indefinite gate. Runner capacity one is the concurrency boundary; Forgejo
also cancels superseded push and pull-request synchronize runs.

Cold runs download dependencies, the PostgreSQL image, two Node base images,
and Playwright Chromium, and build both application images. Warm DIND pulls and
build layers reduce later runtime; pnpm and Playwright downloads are not shared
across jobs. Record actual cold/warm timings from the proof PR rather than
replacing them with estimates.

## Bootstrap on this Mac

Prerequisites are Docker Desktop, the running loopback `glantri-forgejo`
container at Forgejo 15.0.7, and a clean checkout containing these files.
Bootstrap is an infrastructure mutation: run it only under an authorized
runner task. It creates one repository-scoped runner registration through the
local Forgejo CLI and does not create an administrator or user token.

Choose an absolute state directory outside all Git worktrees:

```bash
export GLANTRI_RUNNER_HOME=/Users/vidarhald/Glantri-Server/forgejo-actions-runner
scripts/ci/forgejo-runner-service.sh bootstrap
scripts/ci/forgejo-runner-service.sh status
```

The script refuses to rotate an existing token. `compose.yaml` and `.env` are
copied into the external directory; the token and rendered configuration live
under its `state/` directory. Back up that directory only to an approved secure
local target. Never paste its contents into an issue, PR, terminal transcript,
or chat.

Verify the runner is visible as one online repository runner named
`glantri-private-ci` with label `glantri-private-ci`. There must still be zero
user-owner and instance runners.

## Restart, stop, maintenance, and recovery

Both containers use `restart: unless-stopped`; after Docker Desktop and the
loopback Forgejo container return, the runner reconnects without interaction.
`up` and `restart` atomically refresh the rendered external configuration from
the committed template while retaining the existing UUID and token; they do not
rotate or print either credential.
Exercise and verify restart with:

```bash
export GLANTRI_RUNNER_HOME=/Users/vidarhald/Glantri-Server/forgejo-actions-runner
scripts/ci/forgejo-runner-service.sh restart
scripts/ci/forgejo-runner-service.sh verify
```

Stop without deleting registration, token, or cache:

```bash
scripts/ci/forgejo-runner-service.sh pause
```

`pause` sends `TERM` only to the runner and allows up to ten minutes for its
current job and cleanup to finish. DIND remains running so its cache and cleanup
state can be inspected. Use this when preserving queued Actions history. Confirm
the runner is stopped and that it did not claim another task before treating the
pause as complete.

An existing stopped runner configured with the legacy generic label can be
migrated in place without rotating its registration token:

```bash
scripts/ci/forgejo-runner-service.sh migrate-label
scripts/ci/forgejo-runner-service.sh up
```

`migrate-label` refuses to operate while the runner is running and changes only
the label in its external rendered configuration. After `up`, confirm Forgejo
shows only `glantri-private-ci` and that no `ubuntu-latest` task was claimed.

Stop both service containers without deleting registration, token, or cache:

```bash
scripts/ci/forgejo-runner-service.sh down
```

Inspect dedicated cache use with
`docker exec glantri-forgejo-actions-dind docker system df`. If pruning is
required, first stop or confirm the runner is idle, then prune only through that
DIND container. Never run host-daemon cleanup as part of runner maintenance.

If the token may have been disclosed, stop the runner immediately and have the
Forgejo repository owner delete that runner registration. Remove the external
state directory through an approved recoverable deletion, then bootstrap a new
registration. Deleting a runner is intentionally not automated by the service
script.

## Move to the future Mac mini

1. Install and start Docker Desktop; do not expose its daemon over the network.
2. Restore/start the loopback Forgejo service and confirm its health at
   `127.0.0.1:3001`.
3. Stop this MacBook runner so two machines never share one registration.
4. Check out the accepted Glantri `dev` revision on the Mac mini.
5. Choose an absolute Mac-mini-local `GLANTRI_RUNNER_HOME` and run `bootstrap`.
   Create a fresh repository-scoped registration; do not copy the MacBook token.
6. Confirm exactly one online repository runner, then run `verify` and the proof
   workflow. Remove the offline MacBook registration through repository
   settings after evidence is captured.

The Compose inputs are multi-architecture and work on Apple Silicon. A host
move does not authorize a Forgejo URL, branch protection, credential, `main`,
Azure, deployment, or production change.

## Gate proof and failure handling

Use a disposable branch and pull request targeting `dev`; never use `main`.
Capture the exact head and all four contexts. A passing head must end with both
required pull-request contexts successful. Then add one harmless deliberate
failure on the disposable branch (for example, a temporary command that exits
nonzero in `ci`), prove the corresponding required context fails and merge is
blocked, and remove the throwaway commit before any integration decision.

After the restored passing head, verify an ordinary allowlisted Orchestrator can
merge only after both required contexts succeed. Separately verify Builder
protected push/merge and QA code push remain denied. Do not retry or bypass an
accepted PR merge, weaken branch protection, fabricate statuses, or merge the
throwaway proof behavior. Confirm `main` is unchanged before and after the proof.

When a job fails or is canceled, first verify `docker-test` reached a terminal
state. Check the workflow's final cleanup step and the dedicated DIND daemon for
run-specific `glantri-api-test-*` / `glantri-web-test-*` containers and images.
Remove only resources bearing that exact run suffix. Forgejo job logs and failed
Playwright reports remain in Forgejo under the configured retention policy.
