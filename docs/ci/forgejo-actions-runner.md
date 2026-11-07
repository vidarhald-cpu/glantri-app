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

The only application endpoint jobs need is the Forgejo instance itself, and its
address is configuration rather than a constant. The service script resolves the
address once, persists it, renders it into the runner configuration, and reads it
back out of that rendered configuration when it probes the route, so the address
the runner polls and the address `verify` checks cannot disagree; see
[Forgejo address configuration](#forgejo-address-configuration). The default is
`http://host.docker.internal:3001/`, which on a Docker Desktop host whose Forgejo
listens on that host's own loopback interface reaches it from inside nested jobs
and creates no public listener. Whether a configured address is loopback-only is
a property of that host and that Forgejo listener rather than of the runner, and
this document does not claim it for an address it has not measured. The DIND API
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
removes job, step, service containers, and its job network. The DIND build cache is bounded by a
daemon-level ceiling and monitored; see
[Actions cache bound and host disk guardrails](./actions-disk-and-cache.md).

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
direct database helpers receive the same guarded disposable URL. A second
CI-only TCP proxy binds browser-facing Web and API routes to `127.0.0.1:3000`
and `127.0.0.1:4000` inside the job, forwarding only to the matching DIND ports.
Chromium therefore uses the normal `http://localhost` secure-context exception
needed by Web Crypto while the application containers remain isolated inside
DIND. The browser proxy has no public bind and stops with the Playwright step.
The job needs the isolated DIND daemon but no protected local database. Its
60-minute workflow limit and the runner's 90-minute hard limit ensure terminal
failure instead of an indefinite gate. Runner capacity one is the concurrency
boundary; Forgejo also cancels superseded push and pull-request synchronize
runs.

Cold runs download dependencies, the PostgreSQL image, two Node base images,
and Playwright Chromium, and build both application images. Warm DIND pulls and
build layers reduce later runtime; pnpm and Playwright downloads are not shared
across jobs. Record actual cold/warm timings from the proof PR rather than
replacing them with estimates.

### The job container cannot observe its own resource budget — recorded 2026-10-11

**A job's real budget is 10 CPUs and 6 GiB, and nothing inside the job can see
either number.** `infra/forgejo-actions/compose.yaml` sets `cpus: 10` and
`mem_limit: 6g` on `glantri-forgejo-actions-dind`. Job containers are nested
inside that daemon, so they inherit the cap through the parent cgroup while
carrying no limit of their own. Measured inside the pinned `node:22-bookworm`
job image on 2026-10-11:

| Observed inside the job container               | Value        |
| ----------------------------------------------- | ------------ |
| `nproc`, `getconf _NPROCESSORS_ONLN`            | 18           |
| `os.availableParallelism()`, `os.cpus().length` | 18           |
| `/sys/fs/cgroup/cpu.max`                        | `max 100000` |
| `/sys/fs/cgroup/memory.max`                     | `max`        |
| `os.totalmem()`                                 | 7932 MB      |

Every one of those reports the Docker VM, not the budget. Any tool that sizes a
worker pool, a build parallelism, or a heap limit from them over-subscribes
before it has run a single test.

The consequence is visible in the live DIND cgroup counters, which are
cumulative over the daemon's uptime rather than attributable to one run:

| Counter                                          | Reading                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| `memory.peak`                                    | 6 442 455 040 bytes — the 6 GiB ceiling, exactly |
| `memory.events` `max`                            | 11 608 limit hits                                |
| `memory.events` `oom_kill`                       | 0                                                |
| `memory.stat` `pgmajfault`                       | 492 517                                          |
| `memory.stat` `workingset_refault_anon`          | 460 835                                          |
| `memory.stat` `pgscan_direct` / `pgsteal_direct` | 5 222 350 / 4 502 094                            |
| `cpu.stat` `nr_throttled` / `nr_periods`         | 6 661 / 60 107 (11.1%)                           |
| `cpu.stat` `throttled_usec` / `usage_usec`       | 2 549 872 040 / 15 211 810 657 (16.8%)           |

**Nothing is ever killed, so the symptom is a stall rather than a crash.** Work
is suspended in direct reclaim, or waiting out a throttled quota period, and a
test whose own budget is wall-clock reports a timeout. That is the mechanism
behind the second flake class recorded in Forgejo #553, and it is why
`packages/config/vitest.base.ts` bounds the Vitest fork pool explicitly instead
of trusting `availableParallelism()`.

**Two remedies at this boundary remain unexecuted, because both are operator
actions that restart DIND:** giving the job container its own matching cgroup
limits through the runner's `container.options`, so that tools inside it can
observe the truth, and raising `mem_limit` if 6 GiB is simply too small for the
suite. Neither is a Builder action. Until one is taken, a tool added to CI that
sizes itself from the host is a new instance of this defect rather than a new
defect.

## CI service lifecycle and port model

`application-docker-test` publishes its API and Web containers on the fixed DIND
ports 4000 and 3000 and names them `glantri-api-test-<run>-<attempt>` and
`glantri-web-test-<run>-<attempt>` from `CI_RESOURCE_SUFFIX`. Those ports are
fixed because the runner has capacity one and advertises a single
`glantri-private-ci` label, so two `application-docker-test` jobs cannot execute
at the same time on this instance. Fixed ports are therefore safe against
concurrency, but they are not safe against debris: a container that outlives its
own run keeps holding port 3000 or 4000 and blocks every later run.

A cancelled or aborted run is exactly that case. Forgejo Runner destroys the job
container immediately, so the workflow's `always()` teardown never executes and
the service containers it created over the DIND daemon survive as orphans.
Nothing inside a killed job can clean up after itself, and Docker offers no way
to bind a sibling container's lifetime to the job container that created it.
The guarantee is therefore recovery-based: orphans may briefly exist, but they
can never block a later run.

### Ownership attribution

Every browser-service container is created with three labels:

| Label                            | Value                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `com.glantri.ci.owner`           | `glantri-browser-service`                                                                                             |
| `com.glantri.ci.resource-suffix` | the owning run's `CI_RESOURCE_SUFFIX`                                                                                 |
| `com.glantri.ci.job-container`   | the full ID of the owning runner job container, or empty when that run could not prove which job container it runs in |

The owner label defines the scope the lifecycle helper may act on. The resource
suffix identifies the owning run and attempt. The job-container label is the
liveness anchor. `verify` additionally refuses a container whose labelled
resource suffix is not the current run's, so a recorded service identity can
never silently point at another run's container.

The job discovers its own runner job container by writing a freshly generated
token inside itself and then proving possession of that token through the DIND
daemon, testing each running container named
`FORGEJO-ACTIONS-TASK-<task>_WORKFLOW-<hash>_JOB-<job>`. The proven ID is written
to `<CI_SERVICE_STATE_DIR>/owner-job-container` and applied as the anchor label.
Nothing is inferred from a hostname or a name convention alone.

When that proof fails the file is empty, the anchor label is applied empty, and
the service is thereafter indistinguishable from unanchored debris: it keeps the
owner and resource-suffix labels, but it loses its liveness attribution. The
direction is safe — an unanchored container is refused, never reclaimed on a
guess — but the degradation is not silent. Each service-start step emits a
workflow warning naming the missing anchor, so a run whose self-identification
broke is visible in the job log rather than only in a later run's refusal.

### Reclamation, and what happens when liveness is unknown

`node scripts/ci/current-run-services.mjs reclaim-stale <state-dir> <suffix>`
runs as the first Docker step of `application-docker-test`, before the retained
port assertion. For each in-scope container it decides:

| Observation                                                                   | Decision                                 |
| ----------------------------------------------------------------------------- | ---------------------------------------- |
| Carries the current run's resource suffix                                     | Retained; it is this run's own container |
| Anchored to a job container that is still running                             | Retained; that run is genuinely active   |
| Anchored to a job container that no longer runs                               | Reclaimed; its run is finished           |
| Unanchored, and this job container is provably the only running job container | Reclaimed; no other run can be live      |
| Unanchored while another job container is running                             | Refused and reported                     |
| This process could not prove which job container it runs in                   | Refused and reported                     |

The helper never removes a container on a guess. When liveness cannot be
established it reclaims nothing, prints why, and exits successfully; the
unchanged port assertion then fails the run closed with the occupied ports
named. Refusing to clean up is always preferred to terminating a live run's
services.

The retained `assert-ports-free` check is deliberately kept after reclamation so
that a genuine within-run collision — including one caused by a container the
helper declined to touch — still refuses to start browser services.

### If runner capacity is ever raised

Capacity one is what makes fixed ports 3000/4000 sufficient. Raising it does not
silently corrupt a run: the anchor label makes a concurrent run's services
visibly active, reclamation declines to touch them, and the port assertion fails
closed. It would, however, make `application-docker-test` unable to run
concurrently with itself. Per-run dynamic host-port allocation is the change
that capacity above one would require, and it is deliberately not implemented
while capacity is one.

### Regression coverage

`scripts/ci/current-run-services.test.mjs` covers the decision table as pure
logic, including the cancelled-run orphan, the active-run protection, the
unanchored cases and the token-possession self-identification.
`scripts/ci/current-run-services.synthetic.sh` proves the same behaviour against
a real Docker daemon: it creates an orphan anchored to a dead job container,
confirms the port gate rejects it, reclaims it, confirms the port is free again,
and confirms that a service anchored to a running job container and its owning
job container are both left untouched.

It then stops its own fake job container, which makes the job container running
the synthetic the only running runner job container, and proves the
sole-running-job branch with a throwaway module written into its disposable
state directory. That proof decides the branch from real daemon state — the
helper's own live job-container enumeration and its own token-possession
self-identification — over a container list restricted, by construction, to the
containers the synthetic created. It never removes anything, and it is not a
fifth committed helper, so the gate's exact-path tooling classification is
unchanged.

The branch is proven rather than invoked deliberately. Invoking it runs
reclamation over every in-scope container on the daemon, which is correct for
`application-docker-test`, whose run owns that population, and wrong for the
synthetic's sole-job phase, which must never remove bystander containers.
Phase 1's `reclaim-stale` call is deliberately destructive within a bounded
radius: it may reclaim a service container whose owning job container is
provably dead, because that is the production reclamation behaviour being
tested. The radius is exactly the in-scope containers carrying a 64-hex
ownership anchor whose owning job container is not in the running-job list —
nothing unanchored, nothing keyed only to the current resource suffix, nothing
anchored to a live job; those remain refused and reported per the decision
table above. The sole-running-job branch therefore still belongs to
`application-docker-test` alone; the test suites establish its decision, not
its effect. See issue #289 for the remaining hardening follow-ups, including
this residual radius.

The synthetic asserts that reclamation reported the job container it proved it
runs in, in both phases. Self-identification silently failing therefore fails the
synthetic rather than passing it, and so does identifying the wrong container:
the sole-job proof requires exactly one running job container and requires the
token-possession probe to have identified that one, so the synthetic cannot pass
unless self-identification was both successful and correct. The reclamation
decisions are only meaningful when the job knows which job container is its
own. Both suites run in the `tooling` job
and in `application-docker-test`, and the `tooling` job runs whenever these
scripts change, so the real-Docker proof does not depend on the runtime gate
selecting `application-docker-test`.

A Docker call that never returns is abandoned after `CI_DOCKER_TIMEOUT_MS`
milliseconds, defaulting to 60000, and is then treated as a failed call. A
wedged daemon therefore cannot hold a job open to its workflow timeout, and
because an abandoned call proves nothing about liveness, the outcome is always a
refusal and never a reclamation.

## Bootstrap on this Mac

Prerequisites are Docker Desktop, the running `glantri-forgejo` container at
Forgejo 15.0.7 reachable at the address configured below, and a clean checkout
containing these files.
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

### Forgejo address configuration

| Setting      | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Variable     | `GLANTRI_FORGEJO_URL`, read from the environment of `bootstrap` |
| Default      | `http://host.docker.internal:3001/`                             |
| Persisted at | `$GLANTRI_RUNNER_HOME/state/forgejo-url`, mode `0600`           |
| Mac Studio   | `http://192.168.1.66:3001/`                                     |

`bootstrap` resolves the address from `GLANTRI_FORGEJO_URL`, or from the default
when that variable is unset, validates it, and writes it to `state/forgejo-url`.
`up`, `restart`, `verify` and `migrate-label` read that file. An installation
bootstrapped before the address became configurable has no such file, so they
fall back to the default, record it, and behave exactly as they did before. The
external configuration is re-rendered from the committed template and the
persisted address on every `up` and `restart`, so a configured address survives
both.

An accepted address is a scheme, a host, an optional port and one trailing
slash: `http` or `https`, dot-separated host labels of letters, digits and inner
hyphens, an optional one-to-five-digit port, and nothing else. A path,
credentials, a query, whitespace or any other character is refused, because the
address is substituted into the rendered configuration literally.

`GLANTRI_FORGEJO_URL` cannot repoint a runner that is already registered. When
it disagrees with the persisted address the command refuses, names both
addresses, and exits 2. Repointing an existing installation is deliberate
operator work: write the intended address into `state/forgejo-url`, then
`restart`. Changing the address does not re-register the runner, so a Forgejo
instance that does not already hold this registration still needs a fresh
`bootstrap`.

`verify` takes the address it probes from the rendered
`state/runner-config.yml`, the configuration the runner itself loads, and
refuses when that address is not the persisted one. What is verified is
therefore what the runner uses.

Two commands make that resolution inspectable, and exercisable by the regression
tests, without Docker:

```bash
export GLANTRI_RUNNER_HOME=/Users/vidarhald/Glantri-Server/forgejo-actions-runner
# The address up, restart, verify and migrate-label resolve.
scripts/ci/forgejo-runner-service.sh print-endpoint
# The address bootstrap would register against, including GLANTRI_FORGEJO_URL.
scripts/ci/forgejo-runner-service.sh print-endpoint bootstrap
# The rendered address verify probes, after its agreement check.
scripts/ci/forgejo-runner-service.sh print-endpoint verify
# Re-render the external configuration only; restart applies it.
scripts/ci/forgejo-runner-service.sh refresh-config
```

`print-endpoint` prints an address and nothing else. Neither command reads,
copies or prints the registration token.

`scripts/ci/dev-integration-gate.test.mjs` covers this behaviour by driving the
real script in a disposable runner home: the default address when nothing is
configured, a configured address adopted and persisted at bootstrap, that
address surviving repeated re-renders, the refusal when the environment
disagrees with the persisted file, the refusal when the rendered address
disagrees with it, the rejected address forms, and the reintroduction of an
address literal in either the template or the script.

## Restart, stop, maintenance, and recovery

Both containers use `restart: unless-stopped`; after Docker Desktop and the
configured Forgejo instance return, the runner reconnects without interaction.
`up` and `restart` atomically refresh the rendered external configuration from
the committed template while retaining the existing UUID, the persisted Forgejo
address, and the token; they do not rotate or print either credential.
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

Inspect dedicated cache use with `scripts/ops/dind-cache.sh status`. If pruning is
required, use `scripts/ops/dind-cache.sh prune`, which refuses while a job is active and
prunes only through the DIND container. Never run host-daemon cleanup as part of runner
maintenance, and never `docker system prune` or any volume command. Details and the
volume-safety argument are in
[Actions cache bound and host disk guardrails](./actions-disk-and-cache.md).

If the token may have been disclosed, stop the runner immediately and have the
Forgejo repository owner delete that runner registration. Remove the external
state directory through an approved recoverable deletion, then bootstrap a new
registration. Deleting a runner is intentionally not automated by the service
script.

## Move to another Mac

The move in progress is to the Mac Studio, where Forgejo serves
`http://192.168.1.66:3001/`.

1. Install and start Docker Desktop; do not expose its daemon over the network.
2. Restore/start the Forgejo service on the new host and confirm its health at
   the address step 5 configures — on the Mac Studio,
   `http://192.168.1.66:3001/api/healthz`.
3. Stop the runner on the old host so two machines never share one
   registration.
4. Check out the accepted Glantri `dev` revision on the new host.
5. Choose an absolute host-local `GLANTRI_RUNNER_HOME`, export
   `GLANTRI_FORGEJO_URL` when that host's Forgejo is not at the default address,
   and run `bootstrap`. `print-endpoint bootstrap` prints the address
   `bootstrap` will register against. Create a fresh repository-scoped
   registration; do not copy the old host's token.
6. Confirm exactly one online repository runner, then run `verify` and the proof
   workflow. Remove the offline old registration through repository settings
   after evidence is captured.

The Compose inputs are multi-architecture and work on Apple Silicon. A host move
configures the runner's own Forgejo address through `GLANTRI_FORGEJO_URL`; it
does not authorize widening Forgejo's listener, or any branch-protection,
credential, `main`, Azure, deployment, or production change.

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
A cancelled run cannot run its own teardown, so such containers are expected;
the next `application-docker-test` reclaims them automatically, as described in
[CI service lifecycle and port model](#ci-service-lifecycle-and-port-model).
Hand removal is a last resort for debris the helper reports that it refused to
touch, and then only for resources bearing that exact run suffix. Forgejo job logs plus the
Playwright HTML report, retained trace/test results, and API/Web container logs
remain in Forgejo under the configured seven-day retention policy when
Playwright fails.
