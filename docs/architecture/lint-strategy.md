# Lint-strategi

## Én linter, én konfig

All linting i dette repoet kjøres via `pnpm lint` → `turbo lint` → ESLint med `eslint.config.mjs` (flat config).

Next.js sitt innebygde ESLint-pass under `next build` er **deaktivert**:

```ts
// apps/web/next.config.ts
eslint: {
  ignoreDuringBuilds: true
}
```

Dette er bevisst. Next.js bruker selv en eldre eslintrc-basert konfig som ville kollidert med flat config. Ved å deaktivere det unngår vi dobbelt linting med ulike regelsett på samme filer.

## CI-kjøring

```
pnpm typecheck   →  tsc --noEmit for alle pakker
pnpm lint        →  ESLint flat config (eslint.config.mjs)
pnpm test        →  Vitest
pnpm build       →  Turbo build-pipeline
```

`pnpm lint` er den eneste ESLint-passerings-steget i CI. `next build` i `pnpm build` kjører **ikke** ESLint.

## Importgrenser håndhevet av ESLint

`eslint.config.mjs` bruker `no-restricted-imports` til å håndheve arkitekturgrenser:

- `@glantri/test-scenarios` er forbudt utenfor `*.test.ts`, `*.test.tsx` og `e2e/`
- `@glantri/database` er forbudt direkte i `apps/web` (bruk domeneklienter i `src/lib/api/`)
