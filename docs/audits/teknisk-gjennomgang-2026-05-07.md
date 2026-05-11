# Teknisk gjennomgang av glantri-app

> Dato: 2026-05-07  
> Utarbeidet av ekstern statisk analyse

## 1. Sammendrag

Tilstanden er: repoet er funksjonelt strukturert som et TypeScript-monorepo, men det har nylig fått svært mye ny kode og innhold. Det gjør det vanskeligere å skille mellom reelle produksjonsfeil, teknisk gjeld og støy fra store genererte filer.

Den mest sannsynlige årsaken til produksjonsfeilen `Failed to fetch` er en miljøvariabel-feil i web-deployen:

```ts
// apps/web/src/lib/api/localServiceClient.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
```

og samme mønster finnes i:

```ts
// apps/web/app/(app)/chargen/ChargenWizard.tsx
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
```

Men Azure/Bicep setter dette:

```bicep
// infra/modules/appservice.bicep
name: 'NEXT_PUBLIC_API_URL'
value: 'https://${prefix}-api.azurewebsites.net'
```

Det betyr at frontend-koden ikke leser verdien som infra setter. Siden Docker-builden for web heller ikke sender inn noen build-arg eller `ENV` for `NEXT_PUBLIC_API_BASE_URL`, blir fallback-verdien sannsynligvis bakt inn i Next.js-bundlen som `http://localhost:4000`.

I en browser hos en bruker betyr det at frontend prøver å kalle brukerens egen maskin på port 4000. Det feiler naturlig nok med `Failed to fetch`.

Dette er ekstra viktig fordi `NEXT_PUBLIC_*`-variabler i Next.js normalt blir inlinet i JavaScript-bundlen under `next build`. De kan derfor ikke behandles som vanlige runtime app settings dersom de brukes direkte i klientkode.

Andre viktige risikoer:

| Risiko | Kort vurdering |
|---|---|
| Azure App Service port | Dockerfilene eksponerer 3000 og 4000, men infra setter ikke `WEBSITES_PORT`. Azure custom container antar port 80 hvis ikke annen port settes. |
| CORS | API tillater bare eksakt `WEB_ORIGIN`, og tillatte metoder mangler `DELETE`. |
| Cookies/session | Cookie settes med `SameSite=Lax`; ved web og API på ulike origins kan autentisering feile for cross-origin fetch. |
| CI/CD | CI kjører typecheck/lint/test, men ikke root `pnpm build`, Docker smoke test eller post-deploy health check. |
| Kodebase | Ca. 129k kode-/innholdslinjer i `apps`, `packages` og `data/import`, med flere svært store filer og klient-/API-filer over 1000 linjer. |

---

## 2. Sannsynlig årsak til «Failed to fetch»

### Hoveddiagnose

Frontend bruker `NEXT_PUBLIC_API_BASE_URL`:

```ts
// apps/web/src/lib/api/localServiceClient.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
```

```ts
// apps/web/app/(app)/chargen/ChargenWizard.tsx
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
```

API-kall bruker denne verdien direkte:

```ts
// apps/web/src/lib/api/localServiceClient.ts
const response = await fetch(`${API_BASE_URL}${path}`, {
  ...init,
  credentials: "include",
  headers: {
    "content-type": "application/json",
    ...(init?.headers ?? {})
  }
});
```

Session-provider kjøres globalt i root layout og gjør API-kall ved oppstart:

```tsx
// apps/web/src/lib/auth/SessionUserContext.tsx
useEffect(() => {
  refresh().catch(() => {
    setCurrentUser(null);
    setLoading(false);
  });
}, []);
```

`refresh()` kaller `getCurrentSessionUser()` som igjen kaller:

```ts
const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
```

Altså: nesten alle sider kan utløse fetch mot feil base-URL allerede ved lasting.

Infra setter derimot feil navn:

```bicep
// infra/modules/appservice.bicep
name: 'NEXT_PUBLIC_API_URL'
value: 'https://${prefix}-api.azurewebsites.net'
```

Det finnes ingen tilsvarende `NEXT_PUBLIC_API_BASE_URL` i `.env.example`. Docker-builden for web setter heller ikke public API-url, og deploy-workflowen sender ingen build-args.

**Konklusjon:** høy sannsynlighet for at produksjonsbundle inneholder `http://localhost:4000` som API-url. Dette forklarer `Failed to fetch` direkte.

### Prioritert hypoteseliste

| Hypotese | Sannsynlighet | Konsekvens | Minimal fix |
|---|---:|---|---|
| Frontend bruker `NEXT_PUBLIC_API_BASE_URL`, infra setter `NEXT_PUBLIC_API_URL` | Høy | Browser prøver `http://localhost:4000` | Standardiser på `NEXT_PUBLIC_API_BASE_URL` overalt |
| `NEXT_PUBLIC_API_BASE_URL` settes ikke ved Docker build | Høy | Azure App Setting ignoreres av klientbundle | Legg `ARG`/`ENV` i web Dockerfile før `next build` |
| Azure App Service mangler `WEBSITES_PORT` | Middels | App Service router feil til container | Sett `WEBSITES_PORT=3000/4000` |
| CORS mangler `DELETE` | Middels | Noen API-kall blokkeres av browser | Legg til `DELETE` i `access-control-allow-methods` |
| `SameSite=Lax` ved cross-origin session | Middels | Login virker ustabilt | Same-origin proxy eller `SameSite=None; Secure` |

---

## 3. Arkitektur

### Monorepo-struktur

| Område | Rolle |
|---|---|
| `apps/web` | Next.js 15 frontend, App Router |
| `apps/api` | Fastify API |
| `packages/domain` | Domenetyper og Zod-schemas |
| `packages/rules-engine` | Regellogikk: chargen, combat, advancement |
| `packages/content` | Canonical content, validators, generated seed |
| `packages/database` | Prisma schema, repositories, services |
| `packages/auth` | Auth-roller, session/user-kontrakter |
| `packages/shared` | Delte API-kontrakter og sync |
| `packages/test-scenarios` | Test- og sample-data (brukes også fra runtime) |
| `infra` | Azure Bicep |

### Arkitekturflyt

```
Browser → Azure App Service (web/Next.js)
        → Azure App Service (API/Fastify)
        → Azure PostgreSQL
```

### Vurdering

Arkitekturen er fornuftig for et hobbyprosjekt med mye domenelogikk. Men:

1. `packages/database` avhenger av `@glantri/test-scenarios` i produksjon
2. `apps/web` importerer `@glantri/test-scenarios` uten å deklarere det i `package.json`
3. Store UI-komponenter blander lasting, state, validering og rendering
4. `localServiceClient.ts` er over 1100 linjer
5. `apps/api/src/routes/scenarios.ts` er 1365 linjer
6. `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts` er 16k+ linjer generert TS

---

## 4. Deploy og runtime

### Mangler i CI/CD

- CI kjører ikke `pnpm build` — "CI grønn" beviser ikke at prod-build fungerer
- Ingen `--build-arg` til web Docker image for `NEXT_PUBLIC_API_BASE_URL`
- Ingen post-deploy `curl https://api/health`
- Ingen frontend smoke test
- Ingen rollback-strategi

### Docker

Web Dockerfile mangler:

```dockerfile
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
```

før `next build`. Resultatet er at `http://localhost:4000` bakes inn i bundlen.

### Azure/Bicep

Bicep definerer `linuxFxVersion: 'NODE|22-lts'` mens deploy bruker container images. Dette er drift mellom IaC og faktisk runtime.

Manglende App Settings:

```bicep
// Web
{ name: 'WEBSITES_PORT', value: '3000' }
{ name: 'NEXT_PUBLIC_API_BASE_URL', value: 'https://${prefix}-api.azurewebsites.net' }

// API
{ name: 'WEBSITES_PORT', value: '4000' }
```

### CORS

```ts
// apps/api/src/lib/sessionAuth.ts
reply.header("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
```

`DELETE` mangler men brukes av frontend. Bør være `GET,POST,PUT,DELETE,OPTIONS`.

### Health endpoint

`GET /health` sjekker bare at Fastify svarer. Bør suppleres med:

```
GET /ready  →  DB reachable + migrations OK
```

---

## 5. Kodekvalitet

### Store filer

| Fil | Linjer | Kommentar |
|---|---:|---|
| `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts` | 16 120 | Generert innhold i TS |
| `packages/content/src/equipment/armorTemplates.ts` | 9 795 | Innholdsdata |
| `packages/content/src/equipment/importedWeaponTemplates.ts` | 5 885 | Innholdsdata |
| `apps/web/app/(app)/chargen/ChargenWizard.tsx` | 4 364 | Altfor stor UI-komponent |
| `apps/api/src/routes/scenarios.ts` | 1 365 | Route-godzilla |
| `apps/web/src/lib/api/localServiceClient.ts` | 1 125 | Uformell SDK uten struktur |

### Kritisk arkitekturlukt

Runtime-kode gjør dynamisk import av test-fixtures:

```ts
// packages/database/src/services/characterEquipmentWriteService.ts
const sampleModule = await import(
  "@glantri/test-scenarios/equipment/sampleCharacterEquipment"
);
```

Hvis "bootstrap sample equipment" er en produktfunksjon, flytt data til `packages/content`. Hvis det er dev-only, gjør ruten dev-only.

---

## 6. Anbefalte strakstiltak

1. **Fiks API-base-URL.** Bruk `NEXT_PUBLIC_API_BASE_URL` i Bicep, `.env.example`, GitHub Actions og Docker build.
2. **Send API-url ved web Docker build.** `ARG`/`ENV` i Dockerfile + `--build-arg` i Actions.
3. **Sett `WEBSITES_PORT`.** `3000` for web, `4000` for API i Bicep/App Settings.
4. **Post-deploy smoke test.** `curl -fsS https://<api>/health` etter deploy.
5. **Legg til `DELETE` i CORS.**

---

## 7. Forbedringer på mellomlang sikt

1. Lag én `apiConfig.ts` i web — all API-URL-resolusjon ett sted
2. Split `localServiceClient.ts` etter domene
3. Split `scenarios.ts` API route
4. Ekstraher hooks/underkomponenter fra `ChargenWizard.tsx`
5. Flytt test-fixture-avhengigheter ut av runtime
6. Etabler `/ready` med DB-query
7. Vurder same-origin API via Next rewrites
8. Gjør Bicep til reell kilde for container-deploy
9. Behandle store genererte TS-filer som data/artifact

---

## 8. Ikke gjør dette nå

- Ikke start med å splitte `ChargenWizard.tsx` mens prod er nede
- Ikke bytt arkitektur til mikroservices/serverless
- Ikke bytt både auth, CORS og deploymodell i samme PR
- Ikke flytt store content-filer i første PR
- Ikke erstatt Fastify med Next API routes nå
