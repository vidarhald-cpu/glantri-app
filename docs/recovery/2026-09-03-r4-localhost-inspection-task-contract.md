# R4 task contract: Run the accepted Glantri app for local product-owner inspection

Status: **Prepared / Ready, not yet executed or dispatched.**

## Outcome

Verify and run the current accepted Glantri application from canonical Forgejo `dev` on this Mac so the product owner can inspect it before any new product development begins.

R4 is an operational verification task, not a release or feature task. Success means the accepted code starts from a clean disposable local environment, its core journeys pass bounded smoke checks, and the runtime remains available on loopback URLs for product-owner inspection.

## Authorization boundary

R4 may be executed only after separate control-plane authorization. R3C prepares this contract but does not start the app, install dependencies, create a runtime/database, seed data, dispatch a Work thread, or reserve implementation hotspots.

R4 authorizes no source, test, migration, schema, rules, content, UX, or dependency changes. If the accepted app does not run, record the exact failure and stop. Do not repair it under R4.

Explicitly forbidden:

- using or changing the protected shared database at `localhost:5432/glantri`;
- copying the primary checkout `.env` or another worktree's `.env.task`;
- connecting to Azure or any production database, storage account, identity, secret, or service;
- changing `main`, deploying, publishing to the LAN/Internet, or using Tailscale/Funnel;
- changing product code, generated content, migrations, lockfiles, fixtures, or tests;
- opening a PR, merging, or dispatching Builder/QA work; and
- treating a smoke pass as production-release acceptance.

## Exact accepted baseline gate

At dispatch, the orchestrator must insert the exact R3C final Forgejo `dev` SHA from the R3C completion report. Then:

1. verify Forgejo `refs/heads/dev` equals that full SHA;
2. create a fresh clean linked worktree at that exact commit;
3. verify `git status --short` is empty and `git rev-parse HEAD` matches;
4. record the product-code baseline `d533b47a31dc437fe77857339fa983e2ec7ebfbc` in ancestry; and
5. stop for contract refresh if canonical `dev` has moved.

The R3C commits are documentation-only. No later commit may be silently substituted.

## Required reading

- `AGENTS.md`
- `docs/process/control-plane.md`
- `docs/process/development-baseline.md`
- `docs/dev-database.md`
- `docs/testing-regression-matrix.md`
- `.env.example`
- `package.json`
- `packages/database/scripts/seedLocalDev.ts`
- `apps/api/src/server.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/global-setup.ts`
- `docs/recovery/2026-09-03-local-control-plane-recovery-baseline.md`
- `docs/recovery/2026-09-03-forgejo-operational-portfolio-crosswalk.md`
- `docs/product/ui-interaction-preservation.md`

## Clean local runtime and database

Use a fresh linked worktree and the repository-owned disposable PostgreSQL 16 workflow with task identity `r4-localhost`. Do not use the normal primary-checkout Compose database.

Required sequence from the clean worktree:

```bash
pnpm install --frozen-lockfile
pnpm db:task:setup -- --task r4-localhost
pnpm db:task:verify
pnpm db:task:migrate
pnpm db:task:seed
pnpm --filter @glantri/content build
```

The seed command is expected to create or normalize only the disposable application database with:

| Seed fact | Expected value |
| --- | --- |
| Login email | `local-gm@example.com` |
| Local-only password | `devpassword123` |
| Display name | `Local GM` |
| Roles | `player`, `game_master` |
| Campaign | `Local Dev Campaign` (draft) |
| Reusable entity | `Training Bandit` |

These are repository-defined disposable-development credentials, not production credentials. Do not reuse them elsewhere. No manual first-GM bootstrap is expected after the seed.

Use a unique disposable Artifact directory outside the web public tree, for example `/private/tmp/glantri-r4-localhost-artifacts`. It may be removed after the inspection only after confirming that it contains no user-created material the product owner wants retained.

## Loopback-only launch and exact URLs

First verify ports `3000` and `4000` are unused. If either is occupied, stop and report the owner/process; do not silently select a different URL.

Start the API and web processes through the owned task environment in separate terminals:

```bash
pnpm db:task:exec -- env API_HOST=127.0.0.1 API_PORT=4000 WEB_ORIGIN=http://localhost:3000 ARTIFACT_STORAGE_PROVIDER=local ARTIFACT_LOCAL_ROOT=/private/tmp/glantri-r4-localhost-artifacts pnpm --filter @glantri/api dev
```

```bash
pnpm db:task:exec -- env NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 pnpm --filter @glantri/web exec next dev --hostname 127.0.0.1 --port 3000
```

Expected owner-facing URLs:

- Application: `http://localhost:3000`
- Sign in: `http://localhost:3000/auth`
- Chargen: `http://localhost:3000/chargen`
- Characters: `http://localhost:3000/characters`
- Campaigns: `http://localhost:3000/campaigns`
- API health: `http://localhost:4000/health`
- API/database readiness: `http://localhost:4000/ready`

The listeners must resolve only through loopback. R4 does not expose them on the LAN or Internet.

## Smoke checks

Record status, relevant response/result, and any screenshot needed for each check without changing product code:

1. **Runtime identity:** exact Git SHA, clean worktree, Node/pnpm versions, owned database marker, PostgreSQL 16, and loopback listener bindings.
2. **API health:** `GET http://localhost:4000/health` returns `{"service":"@glantri/api","status":"ok"}`, and `GET http://localhost:4000/ready` returns `{"service":"@glantri/api","status":"ready"}` against the owned R4 database.
3. **Web shell:** `http://localhost:3000` loads without an unhandled browser or server error and unauthenticated navigation reaches the sign-in flow.
4. **Seed login:** sign in at `/auth` with the disposable seed user; `/auth/me` identifies `Local GM` with player and game-master roles.
5. **Campaign data:** `/campaigns` shows `Local Dev Campaign`; its page loads and the seeded `Training Bandit` is available through the current reusable-entity/template journey where the accepted UI exposes it.
6. **Chargen preservation:** `/chargen` renders the existing vertically composed numbered journey. Observe, but do not decide or repair, the five open #394 questions.
7. **Character surface:** `/characters` loads its accepted empty/seed state without a server or browser error.
8. **Core automated smoke:** run the existing Playwright `smoke.spec.ts` against the two running services with `PLAYWRIGHT_BASE_URL=http://localhost:3000` and `PLAYWRIGHT_API_URL=http://localhost:4000`. Its global setup may create deterministic smoke users, Character, Campaign, Scenario, and encounter data only in the disposable R4 database.
9. **Combat visibility:** use the deterministic smoke data or the current UI to open a combat-capable Encounter/Combat Manager and confirm the tracker, six-panel shell, Current Action, Results, and Combat Log/history render as currently implemented. Do not interpret missing future #391 behavior as a failure.
10. **Known B2 risk:** record whether the intermittent equipment read-model race appears. A clean pass does not close Forgejo #8; a recurrence is evidence for that still-unapproved investigation.
11. **No external interaction:** confirm no Azure/production endpoint, `main` change, deployment, or non-loopback listener was used.

R4 should distinguish startup/runtime failures from product observations. Product observations and unresolved UX questions go back to the architecture/control plane; they are not repaired in place.

## Product-owner inspection handoff

Leave the API, web process, disposable database, and seed data running until the product owner confirms inspection is complete. Return:

- the exact web and health URLs;
- the disposable login shown above;
- the exact `dev` SHA and clean-worktree path;
- a concise PASS/FAIL result for every smoke check;
- any known limitations, including B2 if observed; and
- explicit confirmation that no production/Azure/main/product-code action occurred.

Do not call R4 complete merely because the processes started; the product owner must be able to open the application.

## Cleanup

After the product owner confirms inspection is finished:

1. stop only the two R4 API/web processes;
2. run `pnpm db:task:cleanup` from the exact R4 worktree;
3. verify the owned disposable PostgreSQL container and `.env.task` are gone;
4. remove the exact R4 worktree through the repository's normal safe Git procedure; and
5. remove the exact disposable Artifact directory only if no retained inspection material exists.

Record cleanup. Do not remove or reset any broader directory, protected shared database, Forgejo data, recovery evidence, or user-created files.

## Stopping state

- `READY FOR PRODUCT-OWNER LOCAL INSPECTION` while the verified runtime remains available.
- `COMPLETE` only after inspection and requested cleanup are both confirmed.
- `BLOCKED` on a reproducible startup/runtime failure, baseline mismatch, occupied required port, unsafe database target, missing required dependency that cannot be installed under existing authority, or any need for code repair.
