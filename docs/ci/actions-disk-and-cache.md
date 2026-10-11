# Actions cache bound and host disk guardrails

Operational runbook for [issue #557](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/557).
It covers the Forgejo Actions Docker-in-Docker (DinD) BuildKit cache, the host free-disk
thresholds, and prompt release of delegated worktrees. Runner architecture and security
boundary stay in [Private Forgejo Actions runner](./forgejo-actions-runner.md).

## What happened

On 2026-10-09/10 the host disk filled and took Forgejo down for about a day, blocking every
merge, pull request and CI run.

**Root cause: the BuildKit cache inside `glantri-forgejo-actions-dind` was unbounded.** It held
721.4 GB across 2,596 cache records. `docker builder prune -a -f` inside DinD took it to 0 B and
host Docker local volumes fell from about 677 GB to about 9.5 GB.

Agent worktrees were a minor contributor (about 15 GB, roughly 2%). They are **not** the cause
and are not the fix. Worktree release (below) is hygiene kept on its own merits.

## Where the cache lives

| Item                                | Location                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Inner daemon                        | container `glantri-forgejo-actions-dind` (`docker:29-dind`, privileged inside Docker VM)                                          |
| Cache, images, volumes              | `/var/lib/docker` in that container, backed by host volume `glantri-forgejo-actions-docker-data`                                  |
| Host disk impact                    | grows `Docker.raw` inside Docker Desktop; the VM disk is sparse and shares the Mac's free space                                   |
| Inner volume contents               | disposable CI state only (job containers, per-run PostgreSQL service volumes)                                                     |
| Not inside DinD, never to be pruned | `glantri-forgejo` data, `glantri-postgres`, `glantri-playtest-pg16`, task databases, `glantri-forgejo-actions-docker-data` itself |

Host capacity at the time of writing: 926 GiB disk, about 680 GiB free after recovery.

## Controls

### 1. Bounded retention (automatic, in the inner daemon)

`infra/forgejo-actions/dind-daemon.json` configures the DinD daemon's BuildKit garbage
collector, mounted read-only at `/etc/docker/daemon.json`:

- records unused for 14 days (336 h) are evicted regardless of size;
- total build cache is kept at or under **40 GB**; least recently used records go first.

The collector runs after builds finish and never evicts records an in-flight build is using, so
the real peak is the ceiling plus one build's footprint. One cold `docker-test` build writes
about the sum of the API (about 0.7 GB), Web (about 0.35 GB) and Node base (about 1.6 GB) images,
roughly 3 GB, so the expected worst case is under 45 GB.

**Why 40 GB.** The number is derived from capacity and measured use, not copied:

- Capacity 926 GiB; the ruled WARN line is 100 GiB free, so about 580 GiB can be consumed before
  anyone is warned. The incident cache was 721 GB, or 78% of the whole disk.
- Measured warm working set after recovery: 3.8 GB across 27 records, plus 4.7 GB of inner
  images. 40 GB is about ten times the measured warm set, enough to keep several lockfile and
  base-image generations warm.
- 40 GB is about 4.3% of the disk and about 7% of the space above the WARN line, so with the
  other consumers (host Docker cache about 24 GB, task worktrees about 1.6 GB each, PostgreSQL)
  the cache alone can no longer move the host from healthy to HOLD.
- It is 18 times smaller than the incident cache. A cache that is 10x too small costs rebuild time;
  one that is unbounded costs the host.

The alert level used for monitoring is 80% of the ceiling (32 GB): the collector should be holding
the line well before that, so crossing it means the policy is not working.

**Verified on a disposable daemon (agent-run, not the live DinD).** A throwaway DinD of the same
pinned image started with this policy at a 1 GB ceiling accepted the configuration, grew to 5.6 GB
of reclaimable cache, and on the next build finished evicted down to the in-use 1.4 GB. The
manual `builder prune --all --max-used-space` and `--filter unused-for=` forms were also run
there and accepted. Records referenced by a tagged image are held, not evicted; CI removes its
tagged images at teardown, which is what lets the collector reclaim them. The throwaway
container and its volume were removed afterwards.

### 2. Backstop prune (scheduled, scoped)

`scripts/ops/dind-cache.sh prune` runs, inside DinD only:

```text
docker builder prune --force --all --filter unused-for=336h
docker builder prune --force --all --max-used-space 40GB
```

It refuses while any inner container is running (a job is active) or if the DinD container has a
`docker.sock` or any mount other than its data volume and `daemon.json`. `launchd` runs it weekly
(Sunday 04:30); it exists because the daemon collector is configuration that fails silent if the
mount is ever missing.

### 3. Monitoring

`scripts/ops/ops-monitor.sh` runs hourly under `launchd` and:

1. records host free space and the inner `docker system df` to
   `~/Glantri-Server/ops-logs/disk-guard.log` and `dind-cache.log` (one line per hour plus the
   full `docker system df` table);
2. raises a **macOS notification on the operator's desktop** when host free space is below
   100 GiB or the inner cache is at or above 32 GB.

The notification is what a human routinely sees. The log is the trend record; read it with
`tail -n 40 ~/Glantri-Server/ops-logs/dind-cache.log`. The Orchestrator also calls
`scripts/ops/disk-guard.sh` before dispatching any heavy task (below), so a degraded host also
surfaces in dispatch reports.

### 4. Host disk guardrails

`scripts/ops/disk-guard.sh` is read-only and is the single place the thresholds live. Agents and
humans call it; the exit status is a stable contract.

| Free space   | Level | Exit | Required behaviour                                                    |
| ------------ | ----- | ---- | --------------------------------------------------------------------- |
| >= 100 GiB   | OK    | 0    | Proceed.                                                              |
| < 100 GiB    | WARN  | 10   | Warn the Orchestrator/operator; check the DinD cache; continue.       |
| < 60 GiB     | HOLD  | 20   | **Do not** start new heavy worktrees, `pnpm install` or builds.       |
| < 40 GiB     | STOP  | 30   | **Stop and intervene**: halt agents and escalate to the operator now. |
| unmeasurable | error | 2    | Treat as HOLD. Never treat a failed measurement as OK.                |

The thresholds are measured in whole GiB of space available to the user on the filesystem holding
`$HOME` (the same volume as Docker Desktop's disk image). Worked examples (`--free-gib` simulates
a reading; omit it for the real measurement):

```text
$ scripts/ops/disk-guard.sh --free-gib 150      # exit 0
DISK_GUARD level=OK free_gib=150 warn<100 hold<60 stop<40 source="simulated"
$ scripts/ops/disk-guard.sh --free-gib 99       # exit 10
DISK_GUARD level=WARN free_gib=99 ...
$ scripts/ops/disk-guard.sh --free-gib 59       # exit 20
DISK_GUARD level=HOLD free_gib=59 ...
$ scripts/ops/disk-guard.sh --free-gib 39       # exit 30
DISK_GUARD level=STOP free_gib=39 ...
```

An agent preflight before starting a worktree, install or build:

```bash
scripts/ops/disk-guard.sh --quiet || { rc=$?; [ "$rc" -eq 10 ] || exit "$rc"; }
```

(`--quiet` prints nothing at OK. WARN is allowed to continue after it has been reported; HOLD,
STOP and a measurement error all end the task start.)

### 5. Prompt worktree release

Release a delegated worktree **as soon as its branch is pushed**, not when the lane closes. Each
worktree with its own `pnpm install` is about 1.6 GB; in the incident, removing them bought the
headroom to diagnose, but they were about 2% of the problem.

```bash
scripts/ops/release-worktree.sh /path/to/worktree            # dry run: runs every check
scripts/ops/release-worktree.sh /path/to/worktree --execute  # removes it if all checks pass
```

**Hard rule: never delete a worktree holding the only copy of unpushed work.** Before removal the
script verifies, and refuses unless all hold:

1. the path is a registered linked worktree, not the primary checkout;
2. the working tree is clean: no modified, staged or untracked files;
3. HEAD is reachable from the branch tip on `origin`, read from the remote itself rather than a
   possibly stale local ref; a detached HEAD is refused.

Rationale: this rule is what preserved the #554 work through the outage. A worktree holding
unpushed work was not deleted, so nothing was lost when space was being recovered under pressure. Removal uses plain
`git worktree remove` (never `--force`), keeps the branch, and never touches another worktree.
Do not replace the script with `rm -rf` or `git worktree remove --force`.

## What must never be pruned

- `glantri-forgejo-actions-docker-data` and any Docker volume on the **host** daemon:
  `glantri-forgejo`, `glantri-postgres`, `glantri-playtest-pg16`, task and per-worktree
  PostgreSQL volumes. Never run `docker system prune`, `docker volume prune`,
  `docker volume rm`, `docker compose down -v`, or `docker system prune --volumes` on the host.
- Anything under `~/Glantri-Server/forgejo*` and `~/Glantri-Server/playtest-db`.

### Why the automation cannot reach them

The guarantee is structural, in three independent layers:

1. **No capable command exists in the code.** All docker access in `dind-cache.sh` goes through one
   function, `inner()`, which executes `docker exec glantri-forgejo-actions-dind docker <args>`
   and first checks `<args>` against a closed allowlist: `system df`, `ps -q` and the two exact
   `builder prune` forms above. Anything else exits 2 before running. There is no `system prune`,
   `volume`, `rm`, `rmi` or `--volumes` anywhere, and `disk-guard.sh` runs no docker command at
   all. `builder prune` calls the daemon's build-cache endpoint, which has no volume code path.
2. **The target daemon cannot see the protected data.** The commands run inside DinD's own
   namespace. Forgejo and PostgreSQL volumes belong to the Docker Desktop host daemon; DinD has
   no host mount and no `docker.sock`. `dind-cache.sh` re-checks this on every run and refuses if
   the container has a socket mount or any mount besides `/var/lib/docker` and
   `/etc/docker/daemon.json`. Even a mis-aimed `builder prune` on the host daemon could remove
   only build cache.
3. **Tests lock both in.** `scripts/ops/ops.test.mjs` (run by `pnpm test`) runs the scripts against
   a recording fake `docker` and asserts the exact argv: every call is a read-only `inspect` or an
   `exec` into the fixed container, only the two scoped prune commands appear, and no
   volume/system/image/container prune, `rm` or `--volumes` is ever issued. A second test scans
   every `scripts/ops/*.sh` for those verbs, so adding one breaks CI.

The daemon-side collector in `dind-daemon.json` is configuration for BuildKit's cache manager and
likewise has no volume semantics.

## Diagnosing a recurrence

1. `scripts/ops/disk-guard.sh` for the host level, then `df -h /` and
   `ls -la ~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw` (apparent size is
   the VM maximum; `du -sh` shows real use).
2. `docker exec glantri-forgejo-actions-dind docker system df` for the inner split, and
   `tail -n 60 ~/Glantri-Server/ops-logs/dind-cache.log` for the trend.
3. `docker system df` on the host. The host daemon has its own build cache (about 24 GB when this
   was written) that this work does not manage; pruning it is a separate operator decision.
4. Check the collector is configured:
   `docker exec glantri-forgejo-actions-dind cat /etc/docker/daemon.json`. A missing or directory
   mount means the stack was started without `forgejo-runner-service.sh up`.
5. If the inner cache is over the ceiling and no job is running, run
   `scripts/ops/dind-cache.sh prune`. If it is still large, stop the runner first with
   `scripts/ci/forgejo-runner-service.sh pause` and re-run. Do not reach for a blanket prune.
6. Freed space may not return to the Mac immediately: the VM disk is sparse. Check
   `df` on the host, and ask the operator before any Docker Desktop disk reclaim.

## Operator steps

Agents authored the files; **an operator applies them**. Agents must not restart or reconfigure
Docker Desktop, DinD, the runner or Forgejo.

1. Merge the pull request and update the canonical checkout to the merged `dev`.
2. Apply the DinD configuration. This recreates only the `glantri-forgejo-actions-dind` and
   runner containers (the data volume is kept). Do it while no job is running; `pause` waits up to
   ten minutes for the current job:

   ```bash
   export GLANTRI_RUNNER_HOME=/Users/vidarhald/Glantri-Server/forgejo-actions-runner
   scripts/ci/forgejo-runner-service.sh pause
   scripts/ci/forgejo-runner-service.sh up
   docker exec glantri-forgejo-actions-dind cat /etc/docker/daemon.json
   ```

   `up` copies `compose.yaml` and `dind-daemon.json` into the runner home, recreates the changed
   service, and runs `verify`. `restart` does **not** apply compose changes.

3. Install the schedules (substitute the checkout and home paths):

   ```bash
   mkdir -p ~/Glantri-Server/ops-logs
   for name in com.glantri.ops-monitor com.glantri.dind-cache-prune; do
     sed -e "s|__CHECKOUT__|/Users/vidarhald/dev/glantri-app-forgejo|g" -e "s|__HOME__|$HOME|g" \
       infra/forgejo-actions/launchd/$name.plist > ~/Library/LaunchAgents/$name.plist
     launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/$name.plist
   done
   launchctl kickstart "gui/$(id -u)/com.glantri.ops-monitor"
   tail -n 5 ~/Glantri-Server/ops-logs/disk-guard.log ~/Glantri-Server/ops-logs/dind-cache.log
   ```

4. Confirm a notification appears once by running
   `scripts/ops/disk-guard.sh --free-gib 50 --notify` (simulated; the notification text will say
   HOLD). `launchd` agents can only notify while the operator is logged in.
5. Run one pull request through CI and confirm both required contexts pass, then check
   `scripts/ops/dind-cache.sh status` shows the cache within the ceiling.

To remove the schedules: `launchctl bootout "gui/$(id -u)/com.glantri.ops-monitor"` and the same
for `com.glantri.dind-cache-prune`, then delete the two plists under `~/Library/LaunchAgents`.
