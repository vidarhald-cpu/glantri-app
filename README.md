# glantri-app

Starter monorepo for the Glantri RPG app.

## Stack

- pnpm workspaces
- Turborepo
- TypeScript
- Next.js
- Prisma
- Zod
- Vitest
- Docker Postgres

## Packages

- apps/web
- packages/database
- packages/domain
- packages/shared
- packages/rules-engine
- packages/importers
- packages/test-scenarios
- packages/config

## Principle

Anything that changes combat outcomes must live in `packages/rules-engine`.

## Local playtest

Use the [standing local playtest operator guide](docs/local-playtest.md) for the
persistent Product Owner runtime. Builder and QA worktrees use the separate
[disposable database workflow](docs/dev-database.md).
