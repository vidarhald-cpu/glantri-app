# Local Development Database Workflow

Role authority, visible Builder/QA lanes, and standing execution boundaries are
defined in the
[canonical development operating model](./process/development-operating-model.md).
This document owns database isolation and safety procedure.

The normal database at `localhost:5432/glantri` is **protected shared user state**. It can contain valuable development users, characters, campaigns, scenarios, and other records. A separate Git worktree only isolates files; it does not isolate PostgreSQL. The draft/development-stage data policy in `AGENTS.md` does not make this database disposable: it governs whether preservation and migration work is a product requirement, not whether a worker may touch protected shared state.

## Two Supported Database Modes

### Normal primary checkout

The primary checkout may use the protected shared database through its own `.env`:

```text
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/glantri
```

Root database commands print the sanitized host, port, database name, and `protected-shared-user-state` marker before connecting. Do not copy this `.env` into a linked Builder/QA worktree.

Start Postgres and use the normal developer commands only from the primary checkout:

```bash
pnpm db:up
pnpm db:migrate
pnpm db:generate
```

`pnpm db:up` and `pnpm db:down` are deliberately refused in linked worktrees because the root Compose service is the protected normal container.

### Builder/QA linked worktree

Every database-capable Builder/QA task owns one disposable PostgreSQL 16 container with two distinct databases:

```text
owner: issue-<task>-<worktree-key>
container: glantri-task-issue-<task>-<worktree-key>-pg16
application database: glantri_task_issue_<task>_<worktree_key>
test database: glantri_task_issue_<task>_<worktree_key>_test
```

The worktree key is derived from the linked worktree's own full, resolved filesystem path (its directory name plus a short digest of that path), not merely its parent directory name. Two sibling worktrees that share a parent directory (for example a Builder at `/private/tmp/glantri-260-builder` and QA at `/private/tmp/glantri-260-qa`) still get distinct keys. Every operation derives that key again from the current linked worktree; values declared by `.env.task` are never accepted as proof on their own. Docker chooses an unused loopback port. Names and ownership are deterministic; the port is recorded explicitly in the generated `.env.task`.

Set up and verify the target:

```bash
pnpm db:task:setup -- --task 312
pnpm db:task:verify
```

#### Independent QA quick-start

QA that needs PostgreSQL uses only its own linked worktree and issue number:

```bash
pnpm db:task:setup -- --task <issue>
pnpm db:task:verify
pnpm db:task:migrate
pnpm db:task:test
# run any database-capable app/check through the guarded environment
pnpm db:task:exec -- <command>
pnpm db:task:cleanup
```

After setup and verification, run `db:task:migrate` before any guarded
application or check; setup creates the databases, while `db:task:test` migrates
only the test database. Before the first database-capable command, record the
sanitized ownership marker, loopback host/port, application and `_test`
database names, and PostgreSQL 16 result printed by verification. Never copy
the primary checkout `.env`, inherit another worktree's environment, use
`localhost:5432/glantri`, run direct Prisma commands, or clean a container whose
current-worktree ownership labels do not match. On any guard mismatch, stop as
`BLOCKED`; do not repair around the guard. Record cleanup or the explicit reason
an owned disposable target was retained.

This quick-start is sufficient ordinary database reading for QA. The primary
checkout, backup, and recovery-administration sections below are on-demand and
do not belong in routine QA startup.

Setup creates an ignored, mode-`0600` `.env.task` with all six required values:

- `GLANTRI_DB_MODE=task`
- `GLANTRI_DB_TASK=<issue>`
- `GLANTRI_DB_OWNER`
- `GLANTRI_DB_CONTAINER`
- `DATABASE_URL`
- `DATABASE_URL_TEST`

Do not create this file by copying `.env` or another worktree's `.env.task`. The guard fails closed if it is missing, is not a regular mode-`0600` file, is incomplete, does not match the current worktree-derived task identity, points at the protected database, has database names that do not match its owner, aliases application and test databases, uses a non-local test host, or conflicts with inherited shell variables. Repeated setup refuses an existing file with unsafe permissions instead of silently retaining them.

## Task Database Commands

The supported task workflow is:

```bash
pnpm db:task:migrate
pnpm db:task:reset -- --target application --confirm
pnpm db:task:seed
pnpm db:task:test
pnpm db:task:exec -- pnpm dev
pnpm db:task:cleanup
```

- `db:task:migrate` replays committed migrations on both owned databases by default. Use `--target application` or `--target test` to select one.
- `db:task:reset` accepts only `application` or `test` and requires `--confirm`.
- `db:task:seed` seeds only the owned application database.
- `db:task:test` migrates the owned test database, then runs the database integration suite with the explicit test URL.
- `db:task:exec` supplies both owned URLs, the task stack's own loopback host and ports, and the browser proof suite's own base URLs, to application or other database-capable commands.
- `db:task:cleanup` re-derives current-worktree ownership and verifies the Docker task/worktree ownership labels before removing the exact disposable container and `.env.task`.

Each migration, reset, seed, application, client, and integration-test path validates the current `.env.task`, current-worktree identity, PostgreSQL 16 image, ownership labels, running state, and bound port before database access. It prints a preflight line containing only the ownership marker, host, port, and database name. Passwords are never printed. Direct Prisma commands are unsupported; Prisma's configuration and every repository-owned direct `PrismaClient` construction path apply the same worktree environment guard so they cannot use a copied environment or an inherited protected/foreign target.

Two distinct linked worktrees — including sibling worktrees for the same issue under one shared parent directory, such as a Builder and QA lane — necessarily get different ownership markers, container names, ports, application databases, and test databases, because the worktree key is derived from each worktree's own full resolved path rather than its parent directory name. A copied foreign `.env.task`, a foreign full shell environment, and a cleanup attempt through foreign ownership all fail before container or database access. Builder and independent QA each set up and clean up their own target.

## Task Stack Ports and Addresses

Worktree filesystem isolation is not database isolation, and a disposable database is not stack
isolation either. A task-isolated stack that keeps the shared application defaults — API `4000`,
Web `3000` — competes for those ports with every other stack on the machine, including the primary
checkout's own `pnpm dev` and the standing playtest runtime.

That competition does not fail cleanly. On macOS and BSD a wildcard bind (`0.0.0.0:4000`) succeeds
even while another process already holds `127.0.0.1:4000`, and the kernel keeps delivering loopback
traffic to the more specific listener. The second stack reports itself as started, receives nothing,
and the browser that was meant to reach it talks to the first stack instead — including that
stack's database. Forgejo #276 records the incident: a correctly provisioned, correctly cleaned-up
QA lane wrote two rows into the shared playtest database while doing everything else right.

`db:task:exec` therefore owns the stack's network identity as well as its database identity:

- **Ports are derived from the same worktree key as the database target**, so the two can never
  drift apart. The API port falls in `4100`–`4499` and the Web port in `3100`–`3499`, clear of the
  shared defaults and clear of the macOS ephemeral range. Derivation is deterministic, so one
  worktree always reaches the same URLs.
- **`API_HOST`, `API_PORT`, `WEB_HOST`, `WEB_PORT`, `WEB_ORIGIN` and `NEXT_PUBLIC_API_BASE_URL` are
  propagated together**, so the frontend, the API bind and the API's allowed origin all name the
  same stack. `turbo.json` declares each of them on the `dev` task; Turborepo's strict environment
  mode drops anything undeclared.
- **The browser proof suite is steered by the same addresses.** `PLAYWRIGHT_BASE_URL`,
  `PLAYWRIGHT_API_URL` and `PLAYWRIGHT_BROWSER_API_URL` are propagated from the same derived
  addresses, because `apps/web/e2e/global-setup.ts` creates real accounts with
  `POST /auth/register` before the first spec runs. An unpropagated Playwright URL is not an
  unconfigured test run — it falls back to the shared `localhost:4000` default and writes those
  accounts into whatever process holds that port. Playwright does not run under Turborepo, so
  these three need no `turbo.json` declaration; `db:task:exec` places them in the child
  environment directly. Run the suite as `pnpm db:task:exec -- pnpm --filter @glantri/web
playwright`, never with literal ports copied from a document.
- **Addresses use the `127.0.0.1` literal**, not `localhost`. The bind address and both
  browser-facing URLs are then byte-identical, so CORS matches exactly and no resolver decides
  between `127.0.0.1` and `::1`. `127.0.0.1` is still a secure context, so Web Crypto works.
- **A wildcard bind is refused when `GLANTRI_DB_MODE=task`.** The API requires an explicit
  `API_HOST` and `API_PORT` in task mode and rejects `0.0.0.0` and `::`. Outside task mode the
  API's wildcard default is unchanged, because a container must bind its whole namespace, so
  `docker run -p 4000:4000` keeps working.
- **One behaviour does change outside task mode, deliberately.** The web dev script is now
  `next dev --hostname ${WEB_HOST:-0.0.0.0} --port ${WEB_PORT:-3000}`. The addresses are the same
  ones Next already defaulted to, but stating the port on the command line makes Next's
  `portSource` `cli`, and Next only retries the next free port when `portSource` is `default`. So
  the **primary checkout's `pnpm dev` now fails on a busy `3000` instead of quietly starting on
  `3001`.** That is the intended outcome — a dev server that silently moves is how a browser ends
  up on a stack nobody meant to start — but it is a real change to the primary checkout, not a
  task-mode-only one. Stop whatever holds `3000`, or set `WEB_PORT` explicitly.
- **A held port fails the stack before any process starts.** `db:task:exec` probes each port on
  the loopback address — both a bind and a connect, because a wildcard holder is invisible to the
  bind alone — and refuses to continue when either is contended. The probe itself never binds a
  wildcard address.

A `Stack preflight:` line is printed next to the database preflight lines, naming the owner, the
API base URL, the Web origin and the bind address. Record it in handoff evidence alongside the
database markers, and open the stack at the printed `http://127.0.0.1:<port>` addresses.

**Expect derived-port collisions on a busy machine.** A single offset is shared by both ports, so
the figure that governs is the birthday rate over the 400-slot window, not the 1-in-400 chance
that two _named_ worktrees collide: with `n` worktrees the expected number of colliding pairs is
about `n(n-1)/800`, which passes one at about 29 worktrees. Measured on this repository's own
machine, 82 real worktrees produced **10 colliding offsets** — for example
`/private/tmp/glantri-271-privacy-repair` and `/private/tmp/glantri-po-decisions-docs` both derive
api `4358` / web `3358`.

This is an availability property, not a correctness one. A collision costs nothing unless both
worktrees run a stack at the same time, and when they do the second one refuses to start with a
named contended port rather than redirecting silently — which is the behaviour that matters.
When it happens, set `GLANTRI_TASK_API_PORT` and `GLANTRI_TASK_WEB_PORT` explicitly before
`db:task:exec`. That is the supported escape hatch; a conflicting inherited `API_PORT`,
`NEXT_PUBLIC_API_BASE_URL` or `PLAYWRIGHT_API_URL` is refused rather than silently preferred,
exactly as a conflicting inherited `DATABASE_URL` already is.

`scripts/database/taskStackIsolation.test.ts` is the regression proof: it starts two stacks
concurrently, follows each one's `NEXT_PUBLIC_API_BASE_URL`, and asserts that each reaches only its
own API and its own database, and that a port collision surfaces as a loud refusal rather than a
silent redirection. It also asserts that the propagated Playwright URLs are byte-identical to the
stack's own Web and API addresses, and scans `apps/web/e2e` for any variable that falls back to a
shared default port without being propagated.

This is the developer-machine model. The CI service and port model is a deliberately separate
document — see [the private Forgejo Actions runner](./ci/forgejo-actions-runner.md), whose fixed
DIND ports are safe for a different reason (runner capacity one) and whose isolation problem is
orphaned containers rather than environment propagation.

## Protected Shared Database Backup Expectations

Before an explicitly authorized migration, reset, seed replacement, or other administrative mutation of the protected normal database, create and verify a backup:

```bash
pnpm db:backup
```

Backups are written to `data/snapshots/local-db/` with timestamped filenames. `db:backup` prefers a local `pg_dump` and falls back to `docker exec glantri-postgres pg_dump`.

No task or credential implicitly authorizes mutation of protected shared data. The task contract must state the authorization and target. A reset additionally requires:

```bash
pnpm db:backup
pnpm db:reset:local -- --confirm
pnpm db:seed
```

If a backup cannot be completed and verified, do not run the administrative mutation. Installing PostgreSQL client tools still requires the approval described in `docs/process/control-plane.md`.

## Handoff Evidence

Database-capable Builder/QA handoffs record:

- the explicit ownership marker;
- sanitized application and test host, port, and database names;
- PostgreSQL 16 verification;
- migration/reset/seed/integration commands actually run;
- the `Stack preflight:` line when a dev stack was started, so the API base URL, Web origin and bind address are on record;
- proof that concurrent targets did not see or mutate each other's sentinel data when concurrency is in scope; and
- cleanup result, including any intentionally retained disposable target.

Never include database passwords in logs, PRs, issue comments, or handoffs.
