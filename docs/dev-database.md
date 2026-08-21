# Local Development Database Workflow

The normal database at `localhost:5432/glantri` is **protected shared user state**. It can contain valuable development users, characters, campaigns, scenarios, and other records. A separate Git worktree only isolates files; it does not isolate PostgreSQL.

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

The worktree key comes from the parent directory assigned to the Git worktree. Every operation derives that key again from the current linked worktree; values declared by `.env.task` are never accepted as proof on their own. Docker chooses an unused loopback port. Names and ownership are deterministic; the port is recorded explicitly in the generated `.env.task`.

Set up and verify the target:

```bash
pnpm db:task:setup -- --task 312
pnpm db:task:verify
```

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
- `db:task:exec` supplies both owned URLs to application or other database-capable commands.
- `db:task:cleanup` re-derives current-worktree ownership and verifies the Docker task/worktree ownership labels before removing the exact disposable container and `.env.task`.

Each migration, reset, seed, application, client, and integration-test path validates the current `.env.task`, current-worktree identity, PostgreSQL 16 image, ownership labels, running state, and bound port before database access. It prints a preflight line containing only the ownership marker, host, port, and database name. Passwords are never printed. Direct Prisma commands are unsupported; Prisma's configuration and every repository-owned direct `PrismaClient` construction path apply the same worktree environment guard so they cannot use a copied environment or an inherited protected/foreign target.

Two concurrent worktrees necessarily get different ownership markers, container names, ports, application databases, and test databases. A copied foreign `.env.task`, a foreign full shell environment, and a cleanup attempt through foreign ownership all fail before container or database access. Builder and independent QA each set up and clean up their own target.

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
- proof that concurrent targets did not see or mutate each other's sentinel data when concurrency is in scope; and
- cleanup result, including any intentionally retained disposable target.

Never include database passwords in logs, PRs, issue comments, or handoffs.
