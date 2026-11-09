# Alpha deployment and GitHub-handling runbook

This runbook is for the external maintainer (Joakim) and Claude, who deploy Glantri Alpha drafts, the release candidate (RC) and the final release to Azure. It assumes **no access to Forgejo**: everything you need is here or in the repository at the exact SHA you were given.

Conventions:

- Every factual claim carries a repository file reference, relative to the repository root, at the baseline this document was written against (`dev` `4cbe40cb`). If your checkout differs, re-check the referenced files.
- A claim that could not be verified from source is marked **UNVERIFIED**. Do not treat it as fact.
- Steps marked **[Azure shell]** must run from a shell that is logged in to Azure (`az login`) with rights on the target resource group. Steps marked **[local]** need only a checkout.
- Never write a secret value (database URL, password, client secret) into a ticket, a commit or this file. Secrets are referred to here by name only.

## 1. The release flow

```
Forgejo dev  ->  exact SHA on Forgejo branch release/alpha-draft-N (or RC branch)
             ->  same SHA pushed to a GitHub NON-main branch  ->  deploy (section 3)
             ->  (final release only) same SHA merged to GitHub main  ->  deploy.yml runs
             ->  reconcile released main back into dev
```

### Rules that follow from the workflows

- **`main` is the production deploy trigger.** `.github/workflows/deploy.yml` runs on `push: branches: [main]`, its `deploy` job uses `environment: production`, runs `prisma migrate deploy` and then `azure/webapps-deploy`. **Never push a draft or an RC to `main`.** Drafts go to a non-`main` branch such as `alpha-draft-1` (`deploy.yml` lines 3-6; `docs/process/development-baseline.md`, "Pushes to `dev` run `.github/workflows/ci.yml`. They do not trigger `.github/workflows/deploy.yml`, whose push trigger is restricted to `main`").
- **The escape hatch.** `deploy.yml` skips everything when the head commit message contains `[skip cd]` (`detect-changes` job `if: "!contains(github.event.head_commit.message, '[skip cd]')"`). Use it only for a `main` push that must not deploy (for example a documentation-only or reconciliation commit). Check: the `ci` and `deploy` jobs depend on `detect-changes`, so a skipped `detect-changes` skips them too (`needs:`). The draft and RC branches are not `main`, so they never need it.
- **Only some pushes deploy.** `deploy.yml` filters changed paths (`dorny/paths-filter`): the API image and App Service are rebuilt only if `apps/api/**`, `packages/**`, `pnpm-lock.yaml`, `package.json` or `tsconfig*.json` changed; the Web image likewise for `apps/web/**` plus the same shared paths; migrations only if `packages/database/prisma/**` changed. For the first Alpha deploy from the old `main` the migration directory has changed, so the migration step will run (not verified against the real GitHub range: UNVERIFIED).
- **`.github/workflows/ci.yml`** (the Forgejo CI) runs on pushes to `dev` and `main` and on pull requests. It is not the deploy workflow.

### Verify that the SHA on GitHub is the announced SHA

You are given: a full 40-character SHA and the name of a Forgejo release branch. Before deploying anything:

1. **[local]** In a checkout of the GitHub repository: `git fetch origin && git rev-parse origin/<draft-branch>`. The output must equal the announced SHA exactly. If it differs by even one character, stop and ask.
2. Check out that SHA detached: `git checkout --detach <sha>` and confirm `git rev-parse HEAD`.
3. Check the tree is clean: `git status --short` prints nothing.
4. Every image you build is tagged with this SHA (section 3), so the deployed artefact is traceable to the announced SHA.

### After a release: reconcile `main` back into `dev`

After every production release (the final push to `main`), the released `main` state must be reconciled back into `dev` before a newer baseline is accepted (`docs/process/development-baseline.md`, lines "After every production release, reconcile the released `main` state back into `dev`" and step 8 of the flow). This is done on the Forgejo side by the Product Owner or the Orchestrator: tell them the exact released `main` SHA and that production verification passed. You do not need Forgejo access for this; you only report the SHA.

## 2. Prerequisites and secrets used by `deploy.yml`

Names only. Values live in the GitHub `production` environment and Azure, never in this repository.

| Name                                                          | Used for                                                                                                              | Source reference                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GitHub environment `production`                               | Gate on the `deploy` job                                                                                              | `deploy.yml` `deploy.environment`                                                           |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Azure login by OIDC (`azure/login@v2`); job has `permissions: id-token: write`                                        | `deploy.yml` "Log in to Azure"                                                              |
| `REGISTRY_LOGIN_SERVER`                                       | Container registry host; image names `<server>/glantri-api` and `<server>/glantri-web`                                | `deploy.yml` `env:`                                                                         |
| `REGISTRY_NAME`                                               | `az acr login --name`                                                                                                 | `deploy.yml` "Log in to Container Registry"                                                 |
| `AZURE_API_APP_NAME`, `AZURE_WEB_APP_NAME`                    | App Service names; the Web image bakes `https://<AZURE_API_APP_NAME>.azurewebsites.net` as `NEXT_PUBLIC_API_BASE_URL` | `deploy.yml` build and deploy steps; `apps/web/Dockerfile` (`ARG NEXT_PUBLIC_API_BASE_URL`) |
| `DATABASE_URL`                                                | Used by `prisma migrate deploy` from the runner                                                                       | `deploy.yml` "Run database migrations"                                                      |

Other facts the workflow hard-codes:

- Resource group `rg_glantri` (`deploy.yml` app-settings steps). Port settings `WEBSITES_PORT=4000` (API) and `3000` (Web).
- Runner is `ubuntu-latest` (amd64). The images were rehearsed only as arm64 locally, so the amd64 build is **UNVERIFIED** until the first real run.
- Pipeline order is: CI (`pnpm typecheck`, `pnpm lint`, `pnpm test`) -> sync app settings -> build and push images -> `prisma migrate deploy` -> App Service deploy -> `/ready` smoke test (12 attempts, 15 s apart). **Migration runs before the new images are deployed** (`deploy.yml` step order).

Infrastructure (`infra/main.bicep`):

- `environment` parameter allows only `dev` and `prod` (`@allowed(['dev', 'prod'])`); the only parameter file is `infra/dev.bicepparam`. There is **no staging environment** and no `prod.bicepparam`. Creating one is a separate change, not part of this runbook.
- App Services are on a Basic B1 plan with system-assigned managed identities (`infra/modules/appservice.bicep`). AlwaysOn is not set there, which is why the first request after idle is slow (section 8).
- PostgreSQL Flexible Server 16, Burstable `Standard_B1ms`, 7-day backup retention, no geo-redundancy, TLS required, firewall rule `AllowAzureServices` (`infra/modules/postgres.bicep`).
- The API reads `DATABASE_URL`, `WEB_ORIGIN` and the App Insights connection string through Key Vault references (`infra/modules/appservice.bicep`).
- The Map storage module and its three `ARTIFACT_*` app settings are delivered separately (section 6).

## 3. Deploying a draft without `main`

A draft branch does not trigger `deploy.yml`, and the workflow has no `workflow_dispatch` trigger (`deploy.yml` `on:` has only `push` to `main`). So a draft is deployed by hand, replicating the workflow. Run from a checkout detached at the announced SHA (section 1). Replace the placeholders with the names from section 2; **do not paste secret values into shared logs**.

Order matters: back up first (section 4), then migrate, then swap the images. Be aware the old API is broken against the migrated schema (section 4), so keep the window short and announce it.

**[Azure shell]** unless stated otherwise.

1. Log in and select the subscription: `az login`, `az account set --subscription <id>`.
2. Log in to the registry: `az acr login --name <REGISTRY_NAME>`.
3. Record the **current** API and Web image tags first (needed for rollback): `az webapp config container show --resource-group rg_glantri --name <app>` for both apps. Write them down.
4. Sync app settings as the workflow does (`deploy.yml` "Sync API/Web app settings"):
   - API: `az webapp config appsettings set --resource-group rg_glantri --name <api-app> --settings WEBSITES_PORT=4000` and `az webapp config set ... --startup-file ""`.
   - Web: same with `WEBSITES_PORT=3000`.
5. **[local, Docker]** Build and push the API image (`deploy.yml` "Build and push API image"):
   `docker build -t <registry>/glantri-api:<sha> -f apps/api/Dockerfile .` then `docker push <registry>/glantri-api:<sha>`.
   Prefer pushing only the SHA tag for a draft. The workflow also moves `:latest`; the Bicep default image reference is `:latest` (`infra/modules/appservice.bicep`), so moving `:latest` makes a restart pick up the draft. Decide deliberately.
6. **[local, Docker]** Build and push the Web image (`NEXT_PUBLIC_API_BASE_URL` is baked into the client at build time, so it must be the API's real public URL):
   `docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://<api-app>.azurewebsites.net -t <registry>/glantri-web:<sha> -f apps/web/Dockerfile .` then push.
   Build on amd64, or with `--platform linux/amd64` on an Apple-silicon machine (the App Service plan is Linux; the architecture requirement is **UNVERIFIED** for the plan, the workflow builds on amd64).
7. **Migrate.** The API image contains no Prisma CLI, so migrations run from the checkout (as the workflow does): `pnpm install --frozen-lockfile`, then with `DATABASE_URL` set in the environment of that one command only: `pnpm --filter @glantri/database exec prisma migrate deploy` (`deploy.yml` "Run database migrations"). The database firewall allows only Azure services (`infra/modules/postgres.bicep`), so a laptop may be blocked: either add a temporary firewall rule for your IP and remove it afterwards, or run the command from an Azure-hosted shell. **UNVERIFIED** which the maintainer actually has.
8. **Deploy the images** to the App Services:
   `az webapp config container set --resource-group rg_glantri --name <api-app> --container-image-name <registry>/glantri-api:<sha>` and the same for Web. This is a manual equivalent of `azure/webapps-deploy`; the exact CLI form for the maintainer's registry credentials is **UNVERIFIED**, so confirm with `az webapp config container set --help`.
9. **Readiness:** poll `https://<api-app>.azurewebsites.net/ready` until it returns 200 (the workflow allows 3 minutes, `deploy.yml` "Smoke test API readiness"). `/health` reports process liveness; `/ready` also checks the database and returns 503 `not_ready` otherwise (`apps/api/src/app.ts`).
10. Continue with first-start (section 5) if the database is new, then the smoke checklist (section 7).

For the **final release** the same SHA is pushed to GitHub `main` and `deploy.yml` performs steps 2 to 9 itself. Watch the run and then do sections 5 to 7.

## 4. The database

### Backup before any migration

Take a backup **before** running `migrate deploy`, every time.

- Azure PostgreSQL automatic backups exist with 7-day retention (`infra/modules/postgres.bicep`), which allows point-in-time restore (PITR). Record the current UTC timestamp just before migrating so you can restore to exactly that point.
- Also take an on-demand logical dump (`pg_dump --format=custom`) of the `glantri` database before migrating (**[Azure shell]** or any host that can reach the server). Keep the file private; it contains user data and password hashes.
- Record the existing rows of `_prisma_migrations` (read-only `SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`).

### What the migration does

- The migration path from GitHub `main` `5032dba5` to the Alpha was rehearsed locally on 2026-11-08 (Forgejo #1053 comment 23999, not reproduced here): 16 new migrations, all applied in about 1.4 s on small data. **Some are lossy** (an enum recreation, constraint/index/foreign-key drop-and-recreate with data `UPDATE`s). Expect `Applying migration` lines for 16 migrations and 30 rows in `_prisma_migrations` afterwards if Azure is currently at the old `main`. Confirm the starting row count on Azure before trusting these numbers (**UNVERIFIED** against the live Azure database).
- Do not use `prisma migrate diff` against `schema.prisma` as a post-deploy check: it reports differences on a clean install too (hand-authored foreign keys and defaults). Compare the `_prisma_migrations` list instead.
- **Image-only rollback is unsafe after migrating.** The previous API image against the migrated schema breaks the Encounter routes (400 on the encounter lists) and `prepared` Scenario writes (the enum value was removed). Treat the release as a short maintenance window from the migration step until the new API is warm.
- **Note on `CampaignAsset.artifactKind` (F4).** A `CampaignAsset` row written by the _old_ app **after** the migration has `artifactKind = NULL`, because the backfill ran once. The new app then shows a map row as an image. This only matters if the old app writes during the window. Source: column `artifactKind String?` in `packages/database/prisma/schema.prisma`; behaviour from the rehearsal (comment 23999), not re-measured here.

## 5. First start on a new database, and the first GM

A brand-new database has no users and no fixed GM account.

### What the code does

- A visitor registers at `/auth` (`POST /auth/register`, `apps/api/src/routes/auth.ts`). Every new account is created with the **`player`** role only (`createUser` in `packages/database/src/repositories/authRepository.ts`). Registration signs the user in (it sets the session cookie).
- While no user holds an `admin`, `game_master` or legacy `gm` role, `GET /auth/me` and `GET /auth/bootstrap-status` report `canBootstrapGameMaster: true` (`authService.canBootstrapGameMaster` -> `anyPrivilegedUserExists`, `packages/database/src/services/authService.ts`, `authRepository.ts`).
- The `/auth` page then shows a **Claim GM role** button to a signed-in user who is neither admin nor GM (`apps/web/app/auth/page.tsx`; `canShowClaimGameMasterAction` in `apps/web/src/lib/auth/authBootstrap.ts`).
- The button calls `POST /auth/bootstrap-gm` (`apps/api/src/routes/auth.ts:143`), which requires a signed-in user and calls `atomicBootstrapGameMaster`. Inside one transaction it re-counts privileged users; if there is any it returns nothing (the API answers 403 "Bootstrap GM claim is no longer available."). Otherwise it **replaces all of the user's roles with `game_master`** (`userRole.deleteMany` then create) (`authRepository.ts`, `atomicBootstrapGameMaster`).
- Consequence: the claim is **once only** and atomic. The claiming user gets **`game_master` only**; they are **not** given `admin`, and they lose the `player` role.

### Security step (do this first)

**Immediately after the first start, and before the URL is shared with anyone, register your own account and claim GM.** Until a GM exists, any signed-in visitor can claim it, because `POST /auth/bootstrap-gm` only checks that the caller is signed in and that no privileged user exists. There is no password to set or rotate for this path.

Procedure:

1. Open the Web URL `/auth` in a fresh browser profile.
2. Register with the maintainer's real email and a strong password (minimum 8 characters, `packages/auth/src/schemas.ts`).
3. Click **Claim GM role**. Expected feedback: "Claimed GM role for <email>.".
4. Reload `/auth`: the claim button must be gone, and `GET <api>/auth/bootstrap-status` must return `{"canBootstrapGameMaster":false}`.

### How further GMs and admins are assigned

- Role changes use `POST /auth/users/:id/role` with a body of one role (`player`, `game_master` or `admin`). It is **strict admin only**: it requires the `admin` role, and answers 403 "Admin role required." otherwise (`requireStrictAdminUser` in `apps/api/src/lib/sessionAuth.ts`). The call **replaces** the user's roles with that one role (`replaceUserRoles`).
- In the UI this is **Admin -> Players** (`apps/web/app/(app)/admin/players/PlayersAdminPage.tsx`): a role dropdown (Player, GM, Admin) per user. The page is shown to users who are admin **or** GM (`useCanAccessAdmin` -> `canAccessAdmin`), but the API underneath is strict admin. The **Admin -> Access** page is a different feature (profession and society skill matrices, `AccessAdminPage.tsx`); it does not manage roles.
- **Open gap, found while writing this runbook:** the first-start claim produces a `game_master`, not an `admin`, and no code path I found creates an `admin` (the local seed assigns `player` and `game_master`, `packages/database/scripts/seedLocalDev.ts`). So on a fresh database **nobody can use Admin -> Players to promote other users**: a GM who changes a role will get "Admin role required.". I did not find an in-app way to create the first admin (**UNVERIFIED** that none exists; re-check `apps/api/src/routes` at your SHA).
  - Players need no promotion: a registered player keeps the `player` role (and, by default, is a player).
  - If a second GM or an admin is needed for the Alpha, the Product Owner must decide how. One possibility, **untested and UNVERIFIED**, is a direct database update of the `UserRole` table (tables are `User`, `Role`, `UserRole` in `packages/database/prisma/schema.prisma`; `Role.name` values are `player`, `game_master`, `admin`). Do not run SQL against production without a backup and without the Product Owner's go-ahead.

### Do NOT run the local seed against production

`packages/database/scripts/seedLocalDev.ts` (`pnpm db:seed`) is for local development. Its defaults are the email `local-gm@example.com` and the password `devpassword123`, with campaign "Local Dev Campaign" and an entity "Training Bandit", all overridable by `GLANTRI_LOCAL_SEED_EMAIL`, `_PASSWORD`, `_DISPLAY_NAME`, `_CAMPAIGN_NAME` and `_ENTITY_NAME`. Running it unmodified on Azure would create a GM account with a publicly known password (finding F3, comment 23999). Worse, if a user with that email already exists it **overwrites that user's password and sets their roles to `player` + `game_master`**.

- Default position: **do not seed production at all.** Use the first-GM claim above and create the Campaign in the app.
- If you ever must seed, override **every** `GLANTRI_LOCAL_SEED_*` value with non-default values, and never reuse an existing user's email. The guarded `pnpm db:seed` only labels a non-local target; it does not refuse it (comment 23999, F3).
- **Training Bandit.** The seed is the only source of the "Training Bandit" entity (`seedLocalDev.ts`). For the Alpha smoke it is **not needed**: per the Product Owner's play rule, use **Generate NPC** on the Templates page instead (`apps/web/src/features/templates/TemplatesPageContent.tsx` contains the Generate NPC action). The rule itself is from the work order and is **UNVERIFIED** in source. A Template fielded directly as a temporary actor cannot be attacked (409 `defense_context_unavailable`, finding F1 in comment 23999; same class as #1001/#851), so do not smoke-test with an un-generated Template.

## 6. Map storage

Maps and Artifacts need Azure Blob storage. Without it they are unavailable: the production API refuses the `local` storage provider, and with no `ARTIFACT_*` settings storage is disabled (`apps/api/src/artifacts/artifactStorageConfig.ts`).

- The set-up (storage account, private container, role assignment for the API app's managed identity, the three app settings `ARTIFACT_STORAGE_PROVIDER`, `ARTIFACT_AZURE_ACCOUNT_URL`, `ARTIFACT_AZURE_CONTAINER`, and the Bicep `what-if` before applying) is in **[`docs/operations/azure-artifact-storage.md`](azure-artifact-storage.md)**. That file arrives with the Alpha draft 1 storage infrastructure change (Forgejo PR #1080); it is **not** in `dev` at `4cbe40cb`. Follow it; do not duplicate its steps here.
- No key or connection string is used: the API authenticates with its managed identity (`DefaultAzureCredential`, `azureArtifactBinaryStore.ts`). The Azure store has only been unit-tested, never run end-to-end against real Azure, so the Map smoke test below is the first real proof.
- **If storage cannot be proven end to end, report Maps as unavailable for the release.** Do not improvise a local-disk fallback in production.
- **Map end-to-end smoke test** (after storage is configured, in Safari and Chrome):
  1. The GM uploads one prepared map.
  2. The background renders.
  3. The GM places a pin and makes it player-visible.
  4. The player sees the map and that pin.
  5. The GM places a second pin and keeps it GM-only; the player does not see it.
  6. Restart or reopen (restart the API app); the map and both pins persist.

## 7. Smoke-test checklist for a draft

Run in **Chrome and Safari**. Record what you see, including failures, and report them to the Product Owner as observations (they will be filed as issues).

1. **Health and readiness.** `GET <api>/health` returns 200 `{"status":"ok"}`; `GET <api>/ready` returns 200 `{"status":"ready"}` (`apps/api/src/app.ts`). Web `/` returns 200.
2. **Sign-in and reload.** Register or sign in, reload, direct-open a deep URL: still signed in. Session lasts 7 days (`SESSION_DURATION_MS`, `authService.ts`). In Safari, see section 8.
3. **The GM claim.** Section 5. After claiming, `bootstrap-status` is `false`.
4. **Campaign.** Create a Campaign, then a Scenario.
5. **Generate NPC.** On Templates, generate an NPC and add it to the Scenario (not an un-generated Template, section 5).
6. **A full round.** Start an Encounter with a player character and the NPC; the player declares; the GM resolves one miss (no defence review) and one hit (defence review, damage applied); reach the round summary.
7. **A Map.** The six-step test in section 6.
8. **The player's view.** A second browser profile, registered as a player, joined to the Campaign: the player sees their own character, the outcomes of the round, and only the player-visible map pins.
9. **Rules Docs and Chargen.** A page under Admin -> Rules Docs shows content; `/chargen` loads; the Web container log has no `ENOENT` (smoke list in comment 23999; log location: App Service log stream, **[Azure shell]** `az webapp log tail`).

Pass only if every step passes (or an accepted gap is recorded with the Product Owner). Any failure of 1, 2, 3 or 6 is a rollback candidate (section 9).

## 8. Known limitations to relay to players

- **Safari sign-in (#714).** The Web and API apps are on separate `*.azurewebsites.net` hosts, a public suffix, so the session cookie is cross-site (`SameSite=None; Secure`) (`apps/api/src/lib/sessionAuth.ts`, `resolveSessionCookieSecurityPosture`). Safari may refuse it, so **Safari users may be unable to sign in**. This could not be reproduced locally (no WebKit, same-site HTTP) and is **UNVERIFIED** on Azure until tested. Tell players to use Chrome until verified.
- **Cold start.** One B1 instance, no AlwaysOn (`infra/modules/appservice.bicep`). The first request after idle can take 15-30 s (measured 12.6 s on `/health`, with a 15 s timeout twice, in the #1053 baseline). Tell players to wait and retry.
- **GM release notes (#1059).** Point GMs at the GM release notes tracked in Forgejo issue #1059. No in-repository link exists at this baseline (**UNVERIFIED** where it will be published); the Product Owner provides the link.

## 9. Rollback

There is **no automatic rollback**; migrations are forward-only.

- **Never roll back by redeploying the old images alone** against the migrated database (section 4).
- Decision: roll back if smoke steps 1, 2, 3 or 6 fail and cannot be fixed forward within the agreed window. Record the decision with the Product Owner.
- Procedure (the restore path is rehearsed locally but **not on Azure**: **UNVERIFIED**):
  1. Stop traffic or announce downtime.
  2. **[Azure shell]** Restore the database: either point-in-time restore of the PostgreSQL Flexible Server to the timestamp recorded just before the migration (this creates a **new server**), or `pg_restore` the pre-migration dump into a new database.
  3. Repoint the API at the restored database: update the Key Vault secret `database-url` that the API reads (`infra/modules/appservice.bicep`, `secrets/database-url`), then restart the API app.
  4. Redeploy the **previous** image tags recorded in section 3, step 3, to both apps.
  5. Check `/ready`, then re-run smoke steps 1 to 3.
- Everything written after the pre-migration backup is lost by a restore.
- Afterwards, report the failure to the Product Owner with the observations. If the database is restored and the old images are redeployed, reconciliation of `main` is not needed for a draft (it never touched `main`).

## 10. Later: the RC and the final release

- **RC (Tuesday evening plan):** the same procedure as a draft, on a new non-`main` branch and SHA. Re-verify the SHA (section 1), back up, deploy, smoke.
- **Final release (Wednesday evening plan):** after the Product Owner's GO decision, the RC SHA is merged to GitHub `main`. `deploy.yml` then runs automatically (section 3). Watch the run, run sections 5-7, and report the result. Then report the released `main` SHA so `main` can be reconciled back into `dev` (section 1).

## Open items and unverified claims (summary)

- How the first **admin** is created (section 5): no code path found; role management by a GM-only first user is not possible via the API.
- Whether the maintainer's network can reach the database for `migrate deploy`, and the exact `az webapp config container set` form (section 3).
- amd64 image builds in the real workflow; the real Azure `_prisma_migrations` starting state (sections 2 and 4).
- Safari sign-in against Azure (#714); the restore and repoint path on Azure (section 9).
- The Generate NPC play rule and the location of the GM release notes (#1059).
- `docs/operations/azure-artifact-storage.md` exists only once the storage infrastructure change is merged.
