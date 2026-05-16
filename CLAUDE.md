# Glantri — AI-assistentguide

## Hva er dette prosjektet?

Digital bordspill-assistent for Rolemaster. Se `docs/architecture/system-overview.md` for full systemforståelse. Se `docs/audits/teknisk-gjennomgang-2026-05-07.md` for teknisk kontekst og kjente problemområder.

## Viktige kommandoer

```bash
# Installer avhengigheter
pnpm install

# Kjør alle sjekker (gjør dette før du committer)
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# Per pakke
pnpm --filter @glantri/api typecheck
pnpm --filter @glantri/api test
pnpm --filter @glantri/web test
pnpm --filter @glantri/web typecheck

# DB-integrasjonstester (krever DATABASE_URL_TEST)
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/glantri_test pnpm --filter @glantri/database test

# Playwright smoke (krever kjørende API og web)
PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_API_URL=http://localhost:4000 pnpm --filter @glantri/web playwright
```

## Kodekonvensjoner

### Generelt
- **Ingen kommentarer** med mindre WHY er ikke-åpenbart (skjulte invarianter, workarounds, ikke-intuitive valg)
- **Ikke design for fremtiden** — tre like linjer er bedre enn tidlig abstraksjon
- **Ingen feilhåndtering** for scenarior som ikke kan skje. Bare valider ved systemgrenser (brukerinput, eksterne API-er)

### TypeScript
- Zod-skjemaer defineres i `packages/domain` og deles på tvers. Aldri dupliser skjemaer
- `packages/test-scenarios` er kun for tester — aldri importer i runtime-kode
- `apiConfig.ts` er eneste sted `NEXT_PUBLIC_API_BASE_URL` refereres i web-appen

### API (`apps/api`)
- Ruter er organisert i `routes/` med én fil per domene
- `scenarios/`-mappen er en faset-struktur: `scenarios.ts` orchestrerer, domenefiler håndterer faktiske ruter
- Auth-kontroll via `requireAuthenticatedUser` (spiller+) eller `requireAdminUser` (GM/admin)
- Parsing av request-input via hjelpefunksjoner i `scenarios/parsing.ts` — ikke inline parsing i handlers

### Database (`packages/database`)
- Services eksponeres utad, repositories er interne
- Integrasjonstester (`.integration.test.ts`) krever `DATABASE_URL_TEST` og tilbakestiller egne tabeller mellom suites
- Aldri importer fra `@glantri/test-scenarios` i produksjonskode

### Web (`apps/web`)
- API-kall går via domeneklienter i `src/lib/api/` — ikke direkte `fetch` i komponenter
- **Ny kode importerer alltid direkte fra domeneklienten** (`characterClient`, `campaignClient` osv.) — ikke fra `localServiceClient.ts` (bakoverkompatibilitetsbarrel)
- `apps/web/app/` er **kun** route-lag: routing, layout og adgangskontroll. Ingen state, ingen fetch, ingen forretningslogikk
- All featurelogikk hører i `apps/web/src/features/<feature>/` — se `features/chargen/` som referanseimplementasjon

### Ny kode — hvor legger du det?

| Kode | Rett sted |
|------|-----------|
| Ny UI-feature | `apps/web/src/features/<feature>/` med tynn route i `app/.../page.tsx` |
| Ny API-rutegruppe | `apps/api/src/routes/<feature>/` med `routes.ts`, `handlers.ts`, `parse.ts`, `access.ts` |
| Ny domenetype eller Zod-schema | `packages/domain/src/<domain>/` |
| Ren spillregelberegning | `packages/rules-engine/src/<domain>/` |
| Ny databaseoperasjon | `packages/database/src/services/<domain>/` — repositories er interne |
| API request/response-kontrakt | `packages/domain/src/api/` |
| Ny testfixture | `packages/test-scenarios` — kun `*.test.ts`, `*.test.tsx`, `e2e/` |

### Importregler

1. `apps/*` kan importere fra `packages/*` — aldri omvendt
2. `packages/rules-engine` importerer kun fra `packages/domain` — ikke fra `apps/*` eller `packages/database`
3. `packages/domain` er bunn i lagkaken: ingen imports fra `content`, `database`, `rules-engine`, `apps/*`
4. `@glantri/test-scenarios` er forbudt utenfor `*.test.ts`, `*.test.tsx` og `e2e/`
5. `apps/web/app/` bruker `@/`-alias til `apps/web/src/` — ikke lange `../../src/`-stier
6. Repositories i `packages/database` er interne — utsiden bruker services
7. Ny beregningslogikk hører i `packages/rules-engine`, ikke i web-features

### Feature-mønster (`apps/web/src/features/<feature>/`)

Store features følger denne strukturen:

```
<feature>/
  README.md          ← ansvar, entrypoints, state, API-kall, testkommandoer
  index.ts
  components/        ← rene presentasjonskomponenter, ingen sideeffekter
  hooks/             ← datalasting og sideeffekter (useXData.ts)
  state/             ← reducer/state machine med useReducer, ikke mange useState
  view-models/       ← filtrering, sortering og displaymodeller (rene funksjoner)
  tests/
```

- `page.tsx` i `app/` er tynn wrapper — ingen state, ingen fetch, bare layout
- State-maskin i `state/` er testbar uten React
- View models er rene funksjoner — testbare uten DOM
- Komponenter i `components/` renderer data, sender events — ingen forretningslogikk

### Filstørrelse

Over ~500 linjer er et tegn på at filen har for mange ansvar. Unntakene er generert data og testfiler. Se `routes/scenarios/` (API) og feature-mønsteret (web) som referanse for hvordan splitt gjøres.

## Dokumentasjonspolicy

**Oppdater alltid dette før ny kode:**
1. Lukk issues som er ferdig (referér til PR-nummer i kommentar)
2. Oppdater `docs/testing-regression-matrix.md` hvis ny testdekning er lagt til
3. Oppdater denne filen (`CLAUDE.md`) hvis nye konvensjoner er etablert
4. Oppdater `docs/architecture/system-overview.md` ved strukturelle endringer

## Issue- og branch-workflow

- Branch fra `main`: `refactor/`, `feat/`, `fix/`, `test/`, `ci/`, `docs/`
- Commit-meldinger refererer issue-nummer: `feat: legg til /ready endpoint (#43)`
- PR til `main` — CI må være grønt før merge
- Etter merge: lukk issues med kommentar om hvilken PR som løste det

## CI-signaler

CI kjøres i to jobber:
1. **`ci`** — typecheck + lint + test + build
2. **`docker-test`** — Docker-images + Postgres + DB-integrasjonstester + Playwright smoke

Post-deploy: `GET /ready` sjekkes mot produksjons-API.

## Kjente mønstre å følge

- **Splitt store filer** etter domene, ikke etter teknisk lag. Se `routes/scenarios/` som referanseimplementasjon
- **Golden tests** for rules-engine: hardkod forventede verdier fra kildearbeidsboken, ikke beregn via produksjonskoden. Oppgi workbook/sheet/celle-referanse i testnavn
- **Kontraktstester** for API-endepunkter: test at HTTP-kontrakten (statuskoder, svarform) er stabil, ikke implementasjonsdetaljer
