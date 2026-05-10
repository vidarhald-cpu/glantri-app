# System Overview

## Hva er Glantri?

Glantri er en digital bordspill-assistent for rollespillsystemet Rolemaster. Systemet håndterer karaktergenerering, karakterark, kampanjehåndtering og taktiske møter med regler hentet direkte fra kildebøker og regneark.

## Monorepo-struktur

```
glantri-app/
├── apps/
│   ├── api/          # Fastify REST API
│   └── web/          # Next.js frontend
├── packages/
│   ├── auth/         # Autentiseringstyper og session-hjelpefunksjoner
│   ├── config/       # Delte bygg-konfigurasjoner (ESLint, Prettier, Vitest, tsconfig)
│   ├── content/      # Statisk spillinnhold (våpen, rustning, skjold, ferdigheter)
│   ├── database/     # Prisma ORM, repositories og services
│   ├── domain/       # Delte TypeScript-typer og domene-skjemaer (Zod)
│   ├── importers/    # Import av spilldata fra Excel-arbeidsbok (Themistogenes)
│   ├── rules-engine/ # Spillregelberegninger (stats, ferdigheter, kamp, utvikling)
│   ├── schemas/      # Delte Zod-validerings-skjemaer
│   ├── shared/       # Felles hjelpefunksjoner på tvers av pakker
│   └── test-scenarios/ # Testfiksturer — kun for tester, aldri runtime
├── infra/            # Azure Bicep-infrastruktur
├── docs/             # Arkitektur, revisjoner, backlog og implementeringsguider
└── data/             # Arbeidsbok-snapshot og spilldata (ikke i git)
```

Pakkebehandling: **pnpm workspaces**. Turbo brukes for parallell kjøring av build/test/lint.

## Tech stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | Next.js 15 (App Router), React 19 |
| Backend | Fastify 5, Node.js 22 |
| Database | PostgreSQL via Prisma 6 |
| Auth | Iron Session (kryptert cookie) |
| Validering | Zod (domene- og API-grenser) |
| Testing | Vitest, Playwright, @testing-library/react |
| Infra | Azure App Service (B1), Azure PostgreSQL Flexible Server, Azure Key Vault |
| CI/CD | GitHub Actions |
| Monorepo | pnpm workspaces + Turborepo |

## API-struktur (`apps/api`)

Fastify-serveren eksponerer følgende rute-grupper:

| Prefix | Fil | Ansvar |
|--------|-----|--------|
| `/health` | `app.ts` | Liveness-sjekk (Fastify er oppe) |
| `/ready` | `app.ts` + `lib/readiness.ts` | Readiness-sjekk (DB + migrasjoner OK) |
| `/auth` | `routes/auth.ts` | Login, logout, session |
| `/api/admin` | `routes/adminContent.ts` | Admin-innhold (GM-only) |
| `/content` | `routes/content.ts` | Spillinnhold (regler, utstyr) |
| `/chargen` | `routes/chargen.ts` | Karaktergenererings-API |
| `/characters` | `routes/characters.ts` + `characterEquipment.ts` | Karakterer og utstyr |
| `/sync` | `routes/sync.ts` | Synkronisering |
| (ingen prefix) | `routes/scenarios.ts` | Orchestrator for scenario-domener |

`routes/scenarios.ts` er en tynn orchestrator som registrerer fem domenefiler:

| Domenefil | Ruter |
|-----------|-------|
| `scenarios/templateRoutes.ts` | `/templates/*`, `/entities/*` |
| `scenarios/campaignRoutes.ts` | `/campaigns/*`, `/campaign-assets/*` |
| `scenarios/scenarioRoutes.ts` | `/scenarios/joinable`, `/scenarios/:id` (CRUD, live-state, events) |
| `scenarios/encounterRoutes.ts` | `/scenarios/:id/encounters`, `/encounters/:id` |
| `scenarios/participantRoutes.ts` | `/scenarios/:id/participants/*` |

Delt parsing-logikk: `scenarios/parsing.ts`. Tilgangskontroll: `scenarios/access.ts`.

## Pakkeansvar

### `packages/domain`
Kilden til sannhet for alle TypeScript-typer og Zod-skjemaer som brukes på tvers av pakker. Ingen forretningslogikk. Importeres av alle andre pakker.

### `packages/database`
Prisma-klient og all databasetilgang. Eksponerer services (ikke repositories direkte) til API-laget. Repositories er interne. Services: `AuthService`, `CharacterService`, `CharacterEquipmentWriteService`, `ChargenRuleSetService`, `EncounterService`, `ScenarioService`.

### `packages/rules-engine`
Ren beregningslogikk uten I/O. Implementerer Rolemaster-reglene: stats, ferdigheter, kamp, utvikling. Alle beregninger er deterministiske funksjoner — testes med golden tests mot kildearkeark.

### `packages/content`
Statisk spillinnhold kompilert inn i applikasjonen: våpen-templates, rustning, skjold, ferdighetsrelasjoner. Importert fra Themistogenes-arbeidsboken via `packages/importers`.

### `packages/auth`
Typer og hjelpefunksjoner for Iron Session-basert autentisering. Ingen egne ruter — brukes av `apps/api/src/lib/sessionAuth.ts`.

## Frontend-struktur (`apps/web`)

Next.js App Router med følgende rute-grupper:

```
app/
├── auth/              # Login-side
└── (app)/             # Beskyttede sider (krever innlogging)
    ├── admin/         # Admin-paneler
    ├── campaigns/     # Kampanje-visninger (GM og spiller)
    ├── characters/    # Karakterliste og -ark
    ├── chargen/       # Karaktergenererings-veiviser
    ├── encounters/    # Møte-skjermer (taktisk og rollespill)
    └── templates/     # GM-templates for NPC-er
```

API-klient: `apps/web/src/lib/api/` med domenespesifikke klienter (`authClient.ts`, `campaignClient.ts`, `characterClient.ts`, `chargenClient.ts`, `encounterClient.ts`, `equipmentClient.ts`, `scenarioClient.ts`). `localServiceClient.ts` er en bakoverkompatibel barrel-eksport. `apiConfig.ts` er eneste sted `NEXT_PUBLIC_API_BASE_URL` refereres.

## Infrastruktur

Azure-ressurser provisjonert via Bicep i `infra/`:

- **Azure App Service Plan** (B1 Linux) — delt mellom API og web
- **API App Service** — Node 22 LTS, Docker-container, DB-URL fra Key Vault
- **Web App Service** — Next.js standalone-build som Docker-container
- **Azure PostgreSQL Flexible Server** — produksjonsdatabase
- **Azure Key Vault** — hemmeligheter (database-URL)

## CI/CD-pipeline

`.github/workflows/ci.yml`:
1. `ci` — typecheck, lint, test, build (alle pakker)
2. `docker-test` — bygger Docker-images, starter Postgres, kjører DB-integrasjonstester og Playwright smoke suite

`.github/workflows/deploy.yml`:
- Trigger: push til `main`
- Bygger Docker-images, pusher til Azure Container Registry, deployer til App Service
- Post-deploy smoke: sjekker `/ready` på API

## Autentisering

Iron Session med kryptert, signert HTTP-only cookie (`glantri_session`). I produksjon: `SameSite=None; Secure` for cross-origin. Fastify CORS med `credentials: true` og eksplisitt origin-whitelist.

Roller: `player`, `game_master`, `admin`. Kontrollert via `requireAuthenticatedUser` / `requireAdminUser` i `apps/api/src/lib/sessionAuth.ts`.
