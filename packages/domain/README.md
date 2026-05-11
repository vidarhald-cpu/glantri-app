# @glantri/domain

Bunnlaget i avhengighetsstabelen. Inneholder Zod-skjemaer, TypeScript-typer og konstanter for alle spilldomener.

**Ingen imports fra andre `@glantri/*`-pakker.**

## Innhold

| Mappe | Ansvar |
|---|---|
| `src/campaign/` | Kampanje- og scenarioskjemaer, deltaker- og synlighetstyper |
| `src/character/` | Karakterbygg, utstyr, progresjon, profiler |
| `src/combat/` | Kampkontekst og modifikatorer |
| `src/content/` | Ferdigheter, profesjoner |
| `src/encounter/` | Møte-session, deltakere, handlinger |
| `src/equipment/` | Utstyrsskjemaer, bæremodusar, lokasjonstyper |
| `src/profession/` | Profesjonsstruktur og treningsgrupper |
| `src/api/` | Delte API request/response-kontrakter |

## Bruk

```ts
import { campaignStatusSchema } from "@glantri/domain";
import { CarryModeSchema } from "@glantri/domain/equipment";
```

## Importregel

`packages/domain` importeres av alle lag over — `rules-engine`, `database`, `content`, `apps/*`. Den importerer ingenting fra disse.
