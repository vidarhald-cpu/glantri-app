# @glantri/content

Statisk spillinnhold: utstyrsmaler, ferdighetsdata, profesjoner og sample-data for utvikling.

Importerer fra `@glantri/domain` og `@glantri/shared`.

## Struktur

```
src/
  equipment/      ← våpen-, rustnings-, skjold-, gear- og verdisaker-maler
                  ← sampleLoadouts.ts — sample-utstyr for dev/test
  seeds/          ← genererte seed-data (ikke rediger manuelt)
  skills/         ← ferdighetsinnhold
  professions/    ← profesjonsinnhold
```

## Eksportpunkter

| Import | Innhold |
|---|---|
| `@glantri/content` | Hoved-barrel: alle maler og sample-data |
| `@glantri/content/equipment` | Kun utstyrsmaler og sample-loadouts |

## Sample-data

`sampleLoadouts.ts` inneholder dev-data for utstyrsfeatures. Denne er tillatt i produksjonskode (i motsetning til `@glantri/test-scenarios`).

## Importregel

`packages/content` importeres av `apps/api` og `apps/web`. Den importerer **aldri** fra `apps/*`, `packages/database`, eller `packages/rules-engine`.
