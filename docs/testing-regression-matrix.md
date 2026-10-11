# Testing And Refactor Safety

This document is the pre-refactor safety map for the Glantri monorepo. It tracks
which product workflows are protected by automated tests, where manual smoke
checks are still needed, and which areas should get characterization tests before
large structural changes.

## Pre-Refactor Verification

Run these commands before and after broad refactors:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use this command when you need a coverage snapshot:

```bash
pnpm coverage
```

Coverage is report-only for most packages, but refactor-critical packages use
baseline Vitest thresholds that pass today's suite while preventing silent
regression: rules-engine protects statements and branches, domain protects
statements, and database protects service statements.

### The bounded Vitest worker budget — recorded 2026-10-11

**A timeout in a test file the branch does not touch is a resource symptom, not
a product failure.** Forgejo #553. Vitest's `forks` pool defaults to
`availableParallelism() - 1` workers per suite, `minForks` defaults to the same
number so the pool is reserved eagerly, and `turbo test` schedules several
package suites concurrently. `packages/config/vitest.base.ts` therefore sets an
explicit `maxWorkers` — one quarter of the reported parallelism — with
`minWorkers: 1` so a three-file package stops reserving a full-width pool.
`GLANTRI_TEST_WORKERS` overrides the cap, and
`packages/config/vitest.base.test.ts` protects it, because losing the bound
fails nothing directly: it re-arms the intermittency.

Measured on this Mac (18 CPUs) at `62e25e84`, running three full
`@glantri/web` suites concurrently, nine suite runs per setting:

| Per-suite cap                | `pnpm test` | `pnpm coverage` | `@glantri/web` alone | Web peak RSS | Failures |
| ---------------------------- | ----------- | --------------- | -------------------- | ------------ | -------- |
| 17 (Vitest default)          | 63 s        | 35 s            | 11.4 s               | 4943 MB      | 6–8 of 9 |
| 9 (half)                     | 62 s        | 38 s            | —                    | —            | 0 of 9   |
| 4 (quarter, now the default) | 65 s        | 64 s            | 24.0 s               | 2083 MB      | 0 of 9   |

The quarter is chosen over the half on memory rather than on CPU: a CI job's
real ceiling is 6 GiB, which the half-width pool approaches again as soon as two
suites overlap. See
[the job container cannot observe its own resource budget](ci/forgejo-actions-runner.md#the-job-container-cannot-observe-its-own-resource-budget--recorded-2026-10-11)
for the measured limits and for the two operator remedies that remain open.

**The victims are predictable even though they vary.** On a quiet machine the
slowest single example, `CombatRoundManagerPanel.combatTask.component.test.tsx`

> "reaches a canonical handler for all six GM Combat Task commands", takes
> 1293 ms against a 5000 ms timeout — a margin of 3.9x. The next takes 719 ms, a
> margin of 7.0x. The tests are not unreasonably tight; the runner removes the
> margin. Raising the timeout on whichever example failed last only moves the
> report to the next-tightest one.

## Database Integration Tests

Database/service integration tests live under `packages/database/src/services`.
In a linked Builder/QA worktree, use the owned disposable PostgreSQL 16 workflow:

```bash
pnpm db:task:setup -- --task <issue>
pnpm db:task:test
```

The CI `docker-test` job starts Postgres, applies Prisma migrations to
`glantri_test`, and runs the same filtered database test command before building
the API and web containers. The test safety check rejects the protected normal
database, a test database that aliases `DATABASE_URL`, a non-local production-like
host, or a database name without the `_test` suffix. The test setup resets
service-owned tables between suites, so never bypass the guard or reuse local dev,
production, or another worktree's target.

The database safety regression suite also inventories every repository-owned
direct `PrismaClient` construction and covers copied `.env.task` files, foreign
full environments, missing ownership with a foreign test URL, container-label
and cleanup mismatches, and unsafe task-environment permissions. These checks
must remain green alongside a positive isolated target and two-worktree
concurrency proof.

## Playwright Smoke Tests

There are **two** Playwright projects, and they are not interchangeable:

- `apps/web/playwright.config.ts` drives the full end-to-end suite in
  `apps/web/e2e`, which is wired into the CI `docker-test` job after the API and
  web containers have started.
- `apps/web/browser-tests/playwright.config.ts` drives the narrow
  `**/*.spec.mts` browser checks in `apps/web/browser-tests`.

The suite is not read-only. `apps/web/e2e/global-setup.ts` seeds deterministic
smoke users, a campaign/scenario, and a player character **through the API**,
starting with `POST /auth/register`, before the first spec runs.
`PLAYWRIGHT_API_URL` therefore selects the database those accounts are written
into, and must always name the stack you actually started. Never copy a literal
port from this document: a hardcoded `localhost:4000` drives whichever process
holds that port, which on a developer machine is normally the primary
checkout's API on the shared playtest database.

**From a task-isolated worktree**, run the suite through `db:task:exec`, which
supplies this worktree's own `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL` and
`PLAYWRIGHT_BROWSER_API_URL` derived from the same worktree key as its database
target, so the browser proof and the disposable database cannot drift apart:

```bash
pnpm db:task:exec -- pnpm --filter @glantri/web playwright
```

Global setup prints a `Playwright smoke target:` line naming the resolved API
and web URLs before its first write; check it against the stack you intended.
Why those addresses are derived rather than chosen is the controlling subject of
[task stack ports and addresses](./dev-database.md#task-stack-ports-and-addresses),
and is not repeated here.

### Running the e2e suite without `db:task:exec` — recorded 2026-09-26

`pnpm db:task:exec` refuses to run Playwright while its own stack is already up,
so a worker that must start the stack first and then run the suite has to
propagate the environment by hand. **Exporting only `PLAYWRIGHT_BASE_URL` and
`PLAYWRIGHT_API_URL` is not sufficient**, and the shortfall surfaces as spurious
spec failures rather than as a configuration error. This supersedes the earlier
two-variable invocation this section documented.

Export **the whole of this worktree's own `.env.task`**, and set the artifact
root, before naming the Playwright addresses:

```bash
set -a && . ./.env.task && set +a
export ARTIFACT_LOCAL_ROOT="$(mktemp -d)"
PLAYWRIGHT_BASE_URL=http://127.0.0.1:<web-port> \
  PLAYWRIGHT_API_URL=http://127.0.0.1:<api-port> \
  pnpm --filter @glantri/web playwright
```

`.env.task` is created by `db:task:setup` and is never hand-written or copied;
its six required values and the guard that validates them are recorded in
[dev-database.md](./dev-database.md#task-database-commands).

Three traps, each of which has already been misreported as a product defect:

- **Specs that write through the database directly need `DATABASE_URL` and the
  `GLANTRI_DB_*` values**, which is why the whole file must be exported.
  `apps/web/e2e/lost-seal-scenario.spec.ts:31` and
  `apps/web/e2e/player-attack-initiative-identity.spec.ts:222` write through
  `setScenarioParticipantVisibilityForTest`. With only the two `PLAYWRIGHT_*`
  variables exported they fail; with the full `.env.task` exported and a
  recycled database they pass. **Neither is a pre-existing failure.**
- **`ARTIFACT_LOCAL_ROOT` must be set**, or three specs fail on a
  missing-environment assertion rather than on product behaviour — see
  `apps/web/e2e/blackboard.spec.ts:121-122` and
  `apps/web/e2e/artifactImports.spec.ts:231`. Setting it for the Playwright
  process alone is **not enough**; see
  [further environment traps](#further-environment-traps--recorded-2026-09-26).
- **`apps/web/e2e/global-setup.ts` is not idempotent.** A second run against the
  same database fails with `409 CHARACTER_ALREADY_IN_ACTIVE_CAMPAIGN`, so
  **every full e2e run needs a fresh, unseeded disposable database.**

To recycle that database between runs, use `db:task:cleanup`, then
`db:task:setup`, then `db:task:migrate`. **`db:task:reset -- --target
application --confirm` is not available to an automated worker**: it is blocked
by a Prisma AI-consent guard no automated worker can satisfy. The command stays
listed in
[dev-database.md](./dev-database.md#task-database-commands) because it remains
the supported interactive path; this note records only that agents must use the
cleanup/setup/migrate sequence instead.

### Further environment traps — recorded 2026-09-26

Three additional traps, each of which cost a real lane real time. They are
**additional to**, not replacements for, the three above.

- **`ARTIFACT_LOCAL_ROOT` must reach the application stack process, not only the
  Playwright process.** `turbo.json:11` lists it in the `dev` task's
  `passThroughEnv`, so it is propagated to the server **only if it is already
  exported on the command that starts the stack**. Exporting it just before
  invoking Playwright leaves the server without it, and
  `apps/web/e2e/blackboard.spec.ts:27` and
  `apps/web/e2e/artifactImports.spec.ts:228` then fail spuriously. Export it
  once, before starting the stack, and reuse the same directory for both
  processes.
- **`pnpm dev` is currently unusable on this machine for e2e.** Every web route
  returns 404 / `/_not-found`, with `Watchpack Error: EMFILE` in the log. This is
  **not** plain descriptor exhaustion: one lane confirmed `ulimit -n` at 1048576
  with `kern.num_files` well below its own limit, so raising the descriptor limit
  is not the fix. **That last sentence is corrected below**: the descriptor limit
  is implicated, but because it is too high — see
  [the macOS file limit behind the EMFILE 404s](#the-macos-file-limit-behind-the-emfile-404s--recorded-2026-09-29).
  Two independent lanes fell back to **`next start` against a
  build produced inside `db:task:exec`**, so that `NEXT_PUBLIC_API_BASE_URL`
  bakes to that worktree's own API rather than to a foreign stack. Record the
  fallback as the current working procedure. Caveat: `next start` warns about
  `output: standalone` (`apps/web/next.config.ts:5`); the warning is expected and
  is not the signal to act on. **The documented signal that the environment is
  satisfied is that real routes render and `blackboard.spec.ts:27` plus the
  environment-sensitive `artifactImports` cases pass.**
- **A local Playwright run leaves report artifacts behind, and `pnpm lint` then
  fails on them.** `apps/web/playwright-report/**` and
  `apps/web/test-results/**` are untracked, and lint fails on the minified trace
  bundles inside them. This has now cost **two** separate lanes a confusing lint
  failure attributed to their own change. Clear them with:

  ```bash
  rm -rf apps/web/playwright-report apps/web/test-results
  ```

  **Re-judge any lint failure on a clean tree before attributing it to a
  change.**

### The macOS file limit behind the EMFILE 404s — recorded 2026-09-29

**This corrects the "raising the descriptor limit is not the fix" sentence in the
`pnpm dev` trap above; the rest of that bullet, including the `next start`
fallback, stands.** The descriptor limit is implicated, but because it is **too
high**: the inherited `RLIMIT_NOFILE` soft limit of **1048576 exceeds macOS
`kern.maxfilesperproc` (184320)**, which makes `open()` and `fs.watch` fail
spuriously. Next's Watchpack then dies with `EMFILE: too many open files`, and
the dev server afterwards serves **404 for every page**. Nothing in that sequence
announces itself as an environment fault, so it reads as broad application or
test failure.

Two separate lanes reproduced this independently. What they established:

- **`ulimit -n 184320` inside the run fixes it**, with `EMFILE` occurrences
  dropping to zero. **10240, 12288, 30000 and 65536 were each tried and each
  still failed**, so do not treat an intermediate value as good enough.
- **It is intermittent.** One run can look fine and the next serve 404, so a
  single clean run is not proof that the environment is sound.
- **Gate on the web root before starting Playwright.** Both lanes refused to
  start Playwright unless the web root returned 200, and that gate is why the bad
  runs were caught rather than reported as product failures. The second lane's
  gate passed at about 20 seconds with zero `EMFILE` lines.

This records what those two lanes reproduced on this machine and nothing beyond
it: no cause is claimed for the intermittency, and nothing here is established
for CI runners or for non-macOS hosts. The environment requirements already above
— the single `db:task:exec`, `ARTIFACT_LOCAL_ROOT` exported before the stack
starts, and derived ports left alone — are unchanged.

### Which Playwright environment to trust — recorded 2026-09-26

**CI's `application-docker-test` is the trustworthy Playwright environment.**
Local full-suite e2e on this machine is currently unreliable under concurrent
lane load, for the reasons in
[further environment traps](#further-environment-traps--recorded-2026-09-26).

A lane that cannot obtain an attributable local run should **say so and run a
narrow base-versus-head A/B** on the contested specs only, rather than reporting
an unattributed full-suite result. Two lanes did exactly that on 2026-09-26 and
were right to; an unattributed local failure count is what produced the stale
baseline corrected below.

### Pre-existing Playwright failure baseline — recorded 2026-09-26

**Corrected 2026-09-26 against `2a18d1bf0525a0f9bc6a887ef61aad3e8cdc872b`. The baseline is two
failures, not four.** This is the third baseline this section has recorded — six, then four, now
two. It supersedes the four-failure baseline this section previously recorded, which itself
superseded the original six-failure baseline. What was believed at each stage, and why it
stopped being true, is kept below because that succession is itself the durable lesson.

The four-failure baseline was established by an independent floor-class QA lane using a
**controlled base-versus-head comparison**: a second worktree at `5c34b1f0`, its own disposable
database, and its own stack on its own derived ports, running the contested specs on both sides.

The current two-failure baseline was confirmed by the independent floor-class QA lane that
verified #363 (merged as PR #378). That change fixed the two
`apps/web/browser-tests/skill-reference.spec.mts` viewport-case failures the four-failure
baseline listed below. **Those two cases were stale assertions, not product failures**, and must
no longer be presented as a baseline a lane may ignore.

Two failures, both driven by `apps/web/playwright.config.ts`, in specs under `apps/web/e2e`:

| Spec                                      | Case                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/e2e/artifactImports.spec.ts:10` | creates, reuses, revises, retires and imports through review at narrow width      |
| `apps/web/e2e/artifacts.spec.ts:16`       | publishes a safe visual Artifact to entitled players without exposing GM controls |

**The `apps/web/browser-tests/playwright.config.ts` project has zero pre-existing failures.**
Because it has none, any `apps/web/browser-tests` failure is a real regression and must be
treated as one.

**A lane is not accountable for these two; it is accountable for not adding a
third.**

#### What was superseded, and why it went stale

The two `apps/web/browser-tests/skill-reference.spec.mts` viewport cases previously listed here
as part of the four-failure baseline — "Skill reference stays usable at 1440px" and the same
check at 390px — were **stale assertions, not product failures**. #363 (merged as PR #378) fixed
them, and they must no longer appear as a baseline a lane may ignore.

The two `apps/web/e2e/character-lifecycle-recovery.spec.ts` cases previously
listed here — `:85` "keeps canonical truth visible while a failed identity draft
is reviewed or discarded" and `:138` "restores canonical progression after
failure and retains explicit recovery controls" — **now pass on both sides of the
controlled comparison**, at `5c34b1f0` and at head. They appear to have been
fixed by commits intervening between the original baseline and current `dev`.

The original record was **not wrong about what was true when it was written**. It
was established at `445bb5c580db3bbfc800a281e72cd1ceb62b5dfb`; `dev` has since
moved to `3a91c867`, and the document **became stale relative to `dev`** — which
is precisely the failure mode a written baseline exists to prevent. Three
separate lanes disagreed about this section before a controlled experiment
settled it.

**A baseline is only meaningful against a stated SHA.** A lane that finds a
discrepancy between this section and its own run must **re-derive against current
`dev` and correct this document**, not work around it and not silently adopt a
different failure count.

#### Resolved discrepancies

- **`apps/web/e2e/blackboard.spec.ts:27` is not a baseline failure. It is
  expected to pass.** It passed at clean `445bb5c5`, at the lane head in two
  independent runs (19.2 s and 19.4 s), and on both sides of the 2026-09-26
  controlled comparison. A Builder reported it as a fourth pre-existing
  end-to-end failure: the _count_ of four was right at the time, the _identity_
  was wrong, most likely because that run was made against an already-seeded
  database. **Treat any failure of `blackboard.spec.ts` as a real regression**,
  not as baseline noise, and re-derive the run against a fresh disposable
  database before reporting it.
- **A reported failure of `acov4-combat-item-interactions.spec.ts:221` could not
  be reproduced, and no such case exists.**
  `apps/web/e2e/acov4-combat-item-interactions.spec.ts` declares **exactly one**
  test, at line 62 — "passes, drops, and picks up one canonical Item across
  narrow and desktop views" — and it passes. Line 221 falls inside that single
  test body. Do not carry this report forward.

Before attributing any failure above to a lane, confirm the run satisfied the
environment requirements in
[running the e2e suite without `db:task:exec`](#running-the-e2e-suite-without-dbtaskexec--recorded-2026-09-26)
and in [further environment traps](#further-environment-traps--recorded-2026-09-26).
Most reported extra failures so far have been environment shortfalls or a stale
baseline, not product defects.

## Which competency catalogue a Chargen reproduction must use — recorded 2026-09-27

**A reproduction is only meaningful against the catalogue the consumer actually
loads.** A legacy 59-group projection used to be reachable through a
Chargen-sounding content accessor, and a test or reproduction that built it proved
nothing about the player-facing surface. **Forgejo #387 retired that accessor**, so
there is now one catalogue any Chargen test can load.

- Chargen loads
  `withCompetencyContentV2(buildTargetRuntimeContent(createTargetCompetencyChargenSource(...)))`
  — `apps/web/src/features/chargen/useChargenWizardState.tsx:179`, from the source
  seeded at `:126` — which yields **95 Learning Groups**. `getApprovedV2RuntimeContent()`
  is the accessor that resolves it, and every Chargen and Character path uses it.
- **`F35`, `G08` and `G13` never existed in that catalogue.** They belonged to the
  retired 59-group projection, whose accessor is gone; the 95-group catalogue
  reports `F35=false G08=false G13=false`, while `F30` and `F24` exist.
- The legacy projection builder `withTargetLearningGroupsAndProfessions`
  (`packages/content/src/targetProfessions.ts:182`) still exists for its own direct
  consumer. **Retiring the accessor did not retire the projection** — that is
  Forgejo #252. Nothing in Chargen may reach for it.

Therefore a reproduction or acceptance claim about **player-facing Chargen
behaviour** must be built on the 95-group construction.

Where a rules-layer arithmetic case is **not reachable from any authored V2 pair**,
the regression test constructs the overlap shape explicitly on top of
`getApprovedV2RuntimeContent()` rather than loading another catalogue —
`packages/rules-engine/src/chargen/overlappingLearningGroupPricing.test.ts` does
this for the ruled `[6, 11, 16, 16, 15, 15]` negative-marginal sequence, which the
V2 melee cross-training data still produces but which no pair of the 95 canonical
Groups is authored to trigger. **Such a construction is rules-layer evidence only
and must not be read as evidence about the player-facing surface**, and it remains
prohibited for the browser acceptance case below.

### The withdrawn F35/G08 browser acceptance case — recorded 2026-09-27

The real-browser `F35`/`G08` acceptance case required by the 2026-09-27 ruling
**has been withdrawn by Product Owner ruling**, because those Learning Groups are
absent from the V2 Chargen projection and the case is therefore not reachable
through the browser surface. **Synthetic runtime content must not be added to
manufacture it.** Component coverage of the before/after training-cost notice
(`apps/web/src/features/chargen/components/TrainingCostChangeNotice.component.test.tsx`)
together with the exhaustive proof against the actual Chargen catalogue is
sufficient until a canonical V2 path makes the behaviour reachable. Chargen's own
strongest reachable overlap case stays covered in the browser by
`apps/web/e2e/chargen-overlapping-training-cost.spec.ts`.

## Selecting independent-QA regression breadth

The compact QA procedure is `docs/process/qa-execution.md`. INITIAL QA selects
the broad, proportionate rows and gaps relevant to the complete approved claim.
REPAIR QA re-runs the exact failed gate and directly affected regressions; it
may carry forward a prior PASS only for a direct-child repair whose actual delta
cannot affect that surface.

Escalate REPAIR QA to broader or full relevant regression when the delta
touches schema/migrations, shared authorization/projection/serialization/API or
domain authority, concurrency/transactions, cross-cutting exports/toolchain,
major Combat/Scenario projections, unexpectedly broad scope, or unclear
non-direct-child/rebased topology. Privacy/security, browser, and database gates
remain conditional on impact and are never skipped solely because the mode is
REPAIR.

## Refactor-Critical Areas

Treat these paths as high-value coverage targets:

- `packages/rules-engine/src/**`
- `packages/domain/src/**`
- `packages/content/src/**`
- `packages/database/src/services/**`
- `packages/database/src/repositories/**`
- `apps/api/src/lib/**`
- `apps/api/src/routes/**`
- `apps/web/src/lib/**`
- `apps/web/src/features/**`
- `apps/web/app/(app)/**`

## Stable vs Actively Evolving Areas

Stable/protected workflows should get the strongest characterization tests before
large refactors:

- Chargen
- Character Sheet
- Character Progression
- Admin Skills/Professions/content screens
- Rules Docs
- Campaign roster basics

Encounter workflows are still in active product design. Protect stable
invariants there, but avoid brittle tests that freeze current layout, section
order, table order, or exact button placement:

- GM Scenario screen
- Encounter and Skill rolls workspace screens
- Roleplay encounter roll UI
- Combat encounter UI

## Functional Regression Matrix

Artifact authoring, AI-assisted intake and package import share **one** staging/preview/explicit-accept pipeline with three entry points, so regression breadth for any one of them covers the others' surfaces and must cover the shared acceptance transaction. The controlling contract is [Content authoring, Scenario preparation and Artifact management](product/content-authoring-scenario-preparation-and-artifact-management.md).

| Workflow                         | Primary role      | Main modules                                                                                                                                                                                                                   | Current automated coverage                                                                                                                                                                                                                                                                                                              | Remaining gap                                                                                                                                                                                                | Refactor risk |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Auth/session                     | Player, GM, admin | `packages/auth`, `apps/api/src/lib/sessionAuth.ts`, `apps/web/src/lib/auth`                                                                                                                                                    | `packages/auth/src/session.test.ts`, `apps/api/src/lib/sessionAuth.test.ts`, `apps/web/src/lib/auth/authBootstrap.test.ts`, Playwright login smoke                                                                                                                                                                                      | Browser logout smoke test                                                                                                                                                                                    | Moderate      |
| API health/runtime               | System            | `apps/api/src/app.ts`, deploy workflows                                                                                                                                                                                        | `apps/api/src/app.test.ts`, `apps/api/src/lib/readiness.test.ts`, Docker readiness smoke in CI                                                                                                                                                                                                                                          | Deploy smoke still depends on real hosted DB availability                                                                                                                                                    | Moderate      |
| CORS/cookie contract             | Browser, API      | `apps/api/src/lib/sessionAuth.ts`                                                                                                                                                                                              | `apps/api/src/lib/sessionAuth.test.ts`                                                                                                                                                                                                                                                                                                  | Same-origin proxy strategy is not covered until chosen                                                                                                                                                       | Moderate      |
| Chargen rules                    | Player            | `packages/rules-engine/src/chargen`, `packages/domain/src/character`                                                                                                                                                           | `primaryAllocation.test.ts`, `selectionStructure.test.ts`, `statResolution.test.ts`, `importedContentIntegration.test.ts`; covers canonical content initialization, group pricing, required slot choices, and Longbow-as-specialization behavior                                                                                        | One or two UI smoke interactions for user-facing choice flows, avoiding full brittle end-to-end chargen scripts                                                                                              | High          |
| Chargen UI/helpers               | Player            | `apps/web/app/(app)/chargen/ChargenWizard.tsx`, `apps/web/src/lib/chargen`                                                                                                                                                     | `ChargenWizard.test.ts`, `ChargenWizard.component.test.tsx`, `chargenBrowse.test.ts`, Playwright chargen smoke                                                                                                                                                                                                                          | Rendered React interaction tests for deeper choices if setup remains lightweight                                                                                                                             | High          |
| Character Sheet/browser/edit     | Player, GM        | `apps/web/src/lib/characters`, `packages/database/src/services/characterService.ts`                                                                                                                                            | `characterBrowser.test.ts`, `characterSheet.test.ts`, `characterEdit.test.ts`, `characterService.test.ts`, Playwright characters-list smoke; sheet tests cover stat columns, skill XP columns, specialization XP, derived XP, total skill level, and current skill-point gains                                                          | Character sheet route smoke for browser rendering                                                                                                                                                            | Moderate      |
| Character Progression            | Player            | `packages/rules-engine/src/advancement`, `apps/web/src/lib/characters`                                                                                                                                                         | `advanceCharacter.test.ts`, `loadLocalCharacterAdvancementContext.test.ts`; covers requested/approved checks, requested-only rejection, point deduction, provisional rows, success/failure history, and progression-point gains separate from chargen points                                                                            | UI smoke test for advancement workflow                                                                                                                                                                       | High          |
| Equipment/loadout/combat stats   | Player, GM        | `apps/web/src/features/equipment`, `packages/database/src/services/characterEquipment*`, `packages/content/src/equipment`                                                                                                      | Equipment selector/loadout/movement/combat panel tests, importer/content tests, database equipment write integration tests                                                                                                                                                                                                              | Service read-model integration breadth                                                                                                                                                                       | High          |
| Canonical Field Equipment v1     | Player, GM        | Character equipment services, Campaign/Scenario Item routes and projections, Combat Item commands, inventory/loadout UI                                                                                                        | Preserve one concrete Item ID through assignment, transfer, Scenario availability/pickup, and Combat use; prove expected-revision atomic rollback, active-ammunition persistence/consumption, supported undo, and relationship-derived negative payloads                                                                                | Cover external `STALE` detection and explicit GM reconciliation separately from coherent authoritative in-play mutations; include reload/reconnect plus desktop and 390px Item/Combat/Lost Seal evidence     | High          |
| Combat calculations              | Player, GM        | `packages/rules-engine/src/combat`, `apps/web/src/features/equipment`                                                                                                                                                          | `workbookCombatMath.test.ts`, `combatVerification.test.ts`, `composeDefenseValues.test.ts`, `combatStateDerivation.test.ts`                                                                                                                                                                                                             | More spreadsheet-backed golden rows for varied loadouts                                                                                                                                                      | High          |
| Campaign roster/workspace        | GM, player        | `apps/web/src/lib/campaigns`, `apps/web/app/(app)/campaigns`, `apps/api/src/routes/scenarios/campaignRoutes.ts`, `packages/database/src/services/campaignService.ts`                                                           | Campaign workspace/detail tests, `campaignService.test.ts`, `scenarios.test.ts`, scenario service integration tests, Playwright seeded campaign smoke; roster service tests cover per-campaign membership, dedupe, unlink, and source preservation                                                                                      | Player-side browser smoke for campaign access                                                                                                                                                                | High          |
| Shared Campaign Blackboard       | GM, player        | `packages/domain/src/campaign/blackboard.ts`, `packages/database/src/{repositories,services}/blackboard*`, `apps/api/src/routes/scenarios/blackboardRoutes.ts`, `apps/web/src/features/blackboard`, Campaign workspace routing | Domain/service/API/component/database/Playwright Blackboard suites cover four-entry projection, authorship, common-payload privacy, restricted-detail exclusion, Artifact snapshots/content boundary, revision history, tombstones, layout concurrency, search/filter composition, stable entry links, reload, focus, and narrow layout | Independent QA should keep negative payload assertions explicit across unauthorized/cross-Campaign, removal/archive, correction/replacement, and Artifact withdrawal/access transitions                      | High          |
| Scenario/encounter API           | GM, player        | `apps/api/src/routes/scenarios/` (campaignRoutes, scenarioRoutes, encounterRoutes, participantRoutes, templateRoutes), `packages/database/src/services/scenarioService.ts`                                                     | `apps/api/src/routes/scenarios.test.ts`, `packages/database/src/services/scenarioService.test.ts`                                                                                                                                                                                                                                       | Narrow scenario/encounter API contract tests as read models are split                                                                                                                                        | High          |
| Encounter/roleplay screens       | GM, player        | `apps/web/app/(app)/encounters`, `packages/domain/src/encounter`                                                                                                                                                               | `EncounterDetail.test.ts`, `RoleplayEncounterScreens.test.ts`, `roleplay.test.ts`; encounter invariants are covered separately by issue #124                                                                                                                                                                                            | Keep tests focused on invariants such as session normalization, roll rules, opposed comparison, silent data hiding, and read-model contracts; defer detailed layout/browser tests while encounter UI evolves | Moderate      |
| Admin content/rules docs/players | Admin, GM         | `apps/web/app/(app)/admin`, `apps/web/src/lib/admin`, `apps/api/src/routes/adminContent.ts`, `apps/web/src/lib/rulesDocs.ts`                                                                                                   | `admin-ui.test.ts`, `PlayersAdminPage.test.ts`, `MarkdownRenderer.test.ts`, `viewModels.test.ts`, `rulesDocs.test.ts`; rules docs registry covers Chargen, Character Sheet, Equipment & Encumbrance, Equip Items, and Character Progression calculations                                                                                | API route characterization for admin content save conflicts                                                                                                                                                  | Moderate      |
| Web API client                   | Browser           | `apps/web/src/lib/api/localServiceClient.ts`                                                                                                                                                                                   | `apps/web/src/lib/api/localServiceClient.test.ts`                                                                                                                                                                                                                                                                                       | More methods can be added as domains are split                                                                                                                                                               | High          |

## Test Policy For Large Refactors

- Add characterization tests before moving code when behavior is not obvious.
- Prefer service/helper tests for logic and a few browser/e2e smoke tests for
  wiring.
- Put the strongest characterization coverage around stable/protected flows:
  Chargen, Character Sheet, Character Progression, Admin content/rules docs, and
  Campaign roster basics.
- For encounter screens, test stable invariants instead of current visual layout:
  encounter session normalization, roleplay roll rules, opposed roll comparison,
  scenario participant vs encounter participant boundaries, hidden/silent data
  not visible to players, and API/read-model contracts.
- For privacy-sensitive workflows, apply the
  [Authority and Information Projection Principle](./architecture/information-authority-and-projection.md):
  assert protected keys, values, identities, relationships, and executable state
  are absent from unauthorized payloads, DTOs, serialized responses, generated
  HTML, and rendered output across relevant roles and state transitions.
- Avoid detailed Playwright or component tests that lock current encounter table
  order, section order, or exact button placement until encounter product design
  settles.
- Keep spreadsheet-derived tests tied to exact workbook/sheet/cell references.
- Do not use coverage percentage alone as a quality signal; use this matrix to
  decide whether the touched workflow has the right kind of coverage.
