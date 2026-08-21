# @glantri/database

Databaselag basert på Prisma 6 + PostgreSQL. Eksponerer services utad — repositories er interne implementasjonsdetaljer.

## Struktur

```
src/
  services/       ← public API: CharacterService, ScenarioService, …
  repositories/   ← interne: aldri importer direkte utenfra
  client.ts       ← Prisma-klientinstans
prisma/
  schema.prisma   ← kilde til sannhet for datamodell og enums
  migrations/     ← alle migrasjoner
```

## Enums

Prisma-enums i `schema.prisma` må holdes i sync med Zod-skjemaer i `@glantri/domain`. Sync-tester ligger i `src/prismaEnumSync.test.ts` — disse feiler hvis noen legger til en enum-verdi i kun én av de to kildene.

## Tester

| Type                  | Fil                     | Krav                                    |
| --------------------- | ----------------------- | --------------------------------------- |
| Unit (mock DB)        | `*.test.ts`             | Ingen                                   |
| Integrasjon (ekte DB) | `*.integration.test.ts` | Guarded, disposable `DATABASE_URL_TEST` |

Integrasjonstester tilbakestiller egne tabeller mellom suites via `beforeEach`.
Fra en linked Builder/QA-worktree brukes `pnpm db:task:setup -- --task <issue>` og
`pnpm db:task:test`; se `docs/dev-database.md`. Test-targeten avvises hvis den er
den beskyttede normale databasen, deler database med `DATABASE_URL`, ikke er lokal,
ikke slutter med `_test`, eller ikke tilhører den faktiske nåværende worktree-en
og dens verifiserte containeretiketter.

Før vanlig applikasjonsarbeid sammenlignes anvendt Prisma-historikk med den
innebygde migrasjonsmanifesten. `pnpm release:readiness:database` kjører den samme
skrivebeskyttede kontrollen direkte for en checkout/release-kandidat. En database
med ukjent migrasjon eller avvikende checksum avvises uten at
migrasjonshistorikken endres; API-readiness returnerer bare en sanert feilklasse.

## Importregel

`packages/database` importeres kun av `apps/api`. `apps/web` skal aldri importere direkte — bruk domeneklienter i `apps/web/src/lib/api/`.
