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
- packages/shared
- packages/schemas
- packages/rules-engine
- packages/importers
- packages/test-scenarios
- packages/config

## Principle
Anything that changes combat outcomes must live in `packages/rules-engine`.
