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

| Type | Fil | Krav |
|---|---|---|
| Unit (mock DB) | `*.test.ts` | Ingen |
| Integrasjon (ekte DB) | `*.integration.test.ts` | `DATABASE_URL_TEST` |

Integrasjonstester tilbakestiller egne tabeller mellom suites via `beforeEach`.

## Importregel

`packages/database` importeres kun av `apps/api`. `apps/web` skal aldri importere direkte — bruk domeneklienter i `apps/web/src/lib/api/`.
