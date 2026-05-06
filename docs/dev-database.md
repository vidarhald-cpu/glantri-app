# Local Development Database Workflow

Use the local database workflow below to avoid casually wiping valuable development data.

## Normal Day-to-Day Commands

Start Postgres:

```bash
pnpm db:up
```

Apply local migrations:

```bash
pnpm db:migrate
```

Regenerate the Prisma client after schema changes:

```bash
pnpm db:generate
```

## Before Any Destructive Reset

`pnpm db:reset:local` is intentionally destructive. It wipes local Postgres-backed data, including:

- auth users and sessions
- server-backed characters
- campaigns, scenarios, participants, and assets
- other local records stored in Postgres

Back up first:

```bash
pnpm db:backup
```

Backups are written to `data/snapshots/local-db/` with timestamped filenames.

## Allowed Reset Workflow

Only use a reset when migrations or local state are unrecoverably broken.

```bash
pnpm db:backup
pnpm db:reset:local -- --confirm
pnpm db:seed
```

The reset command refuses to run unless you pass `--confirm`.

## Local Seed / Bootstrap

After a reset, restore a predictable local baseline:

```bash
pnpm db:seed
```

The seed command creates or refreshes:

- a local email/password user
- `player` and `game_master` roles for that user
- one starter campaign
- one reusable GM entity

Default credentials:

- email: `local-gm@example.com`
- password: `devpassword123`

Optional overrides:

- `GLANTRI_LOCAL_SEED_EMAIL`
- `GLANTRI_LOCAL_SEED_PASSWORD`
- `GLANTRI_LOCAL_SEED_DISPLAY_NAME`
- `GLANTRI_LOCAL_SEED_CAMPAIGN_NAME`
- `GLANTRI_LOCAL_SEED_ENTITY_NAME`

## Backup Notes

`pnpm db:backup` prefers a local `pg_dump` binary. If that is unavailable, it falls back to `docker exec glantri-postgres pg_dump`.

If neither path is available, install PostgreSQL client tools locally or make sure the repo's Docker Postgres container is running with `pnpm db:up`.
