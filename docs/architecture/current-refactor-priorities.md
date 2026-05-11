# Current Refactor Priorities

Source: GitHub open and closed issue exports for `vidarhald-cpu/glantri-app`, reviewed 2026-05-11.

This document is a planning aid only. It does not supersede issue state in GitHub.

## Open Issues Summary

| Issue | Theme | Current reading | Suggested priority |
| --- | --- | --- | --- |
| #49 | Bicep/App Service container drift | Real infra bug: `linuxFxVersion` says Node while deployment uses containers. | P1 |
| #92 | Characterization tests for chargen/campaign/encounter flows | Open, but comment says duplicate. Still valuable as safety work before further UI/domain refactors. | P1 |
| #99 | Move generated game content from TS to JSON | Open, but matching closed/superseded issues exist. Broad content-loader refactor. | P2 |
| #103 | API contract layer / DTOs | Open, but matching closed/superseded issues exist. Important boundary cleanup before more API expansion. | P1 |
| #105 | Split `ChargenWizard` | Partially done. `ChargenWizard.tsx` is small; remaining risk moved to `ChargenWizardExperience.tsx`. | P1 |
| #107 | Split scenario/encounter/templates components | Open duplicate comment, but still directionally relevant after recent scenario/roleplay feature growth. | P2 |
| #108 | Shared admin table/filter components | Open duplicate comment. Useful cleanup, lower urgency than domain/API boundaries. | P3 |
| #110 | Standardize web styling | Open duplicate comment. Broad visual/dependency cleanup; defer until active feature churn slows. | P3 |

## Closed/Superseded Issue Summary

The closed export has 75 closed issues, all marked `completed` by GitHub state reason. They cluster into these useful buckets:

| Bucket | Issues | Reading |
| --- | --- | --- |
| Deploy, security, database, monitoring foundation | #16-30, #39-45, #49 open remainder | Most production/deployment setup was completed. #49 remains the main open infra drift. |
| Pre-refactor test and CI safety | #57-66, #113/#118 | Regression matrix, golden tests, coverage/CI gates, smoke tests, and API/service test foundations were mostly completed. |
| Early architecture boundary cleanup | #74-90, #93-98 | Earlier T-01 through T-16 batch was closed, but several later open duplicates still exist. Treat issue state as noisy until triaged. |
| Database/content/docs follow-up refactors | #100-102, #104, #106, #109, #111-112, #114-117 | Later duplicates/refinements for validator splits, DB service splits, docs, format scripts, lint docs, and data README were completed. |
| Chargen split progress | #93 closed, #105 open with progress comment | The shell was split, but `ChargenWizardExperience.tsx` still needs staged extraction. |

## Duplicate Groups

These look like duplicate or successor issue pairs/groups. The open issue comments often say “duplicate,” but the open issues were not closed, so GitHub currently sends mixed signals.

| Refactor task | Open issue | Closed/superseded issues | Recommendation |
| --- | --- | --- | --- |
| T-06 characterization tests | #92 | #80 | Decide whether #92 should remain the tracking issue. If yes, update body with completed coverage and remaining gaps. |
| T-09 content TS to JSON | #99 | #86 | Confirm whether #86 completed enough. If not, keep #99 as the continuation issue. |
| T-12 API contract layer | #103 | #91 | Keep as active only if DTO boundary work is still incomplete. |
| T-13 Chargen split | #105 | #93 | Keep #105 active; it has a fresh partial-progress comment and clear next slices. |
| T-14 scenario/encounter/templates split | #107 | #95 | Keep as future cleanup if current large scenario/encounter files remain risky. |
| T-15 admin table/filter components | #108 | #97 | Defer or close if shared admin component extraction is no longer worth the churn. |
| T-16 styling strategy | #110 | #98 | Defer until feature churn slows; close one side of the duplicate group. |
| T-17 DB service/repository split | none open | #102, #112 | Closed; do not reopen unless concrete new pain appears. |
| T-18 through T-22 docs/format/coverage | none open | #104/#114, #106/#115, #109/#116, #111/#117, #113/#118 | Closed; treat as completed foundation work. |

## Recommended Priority Order

1. Triage duplicate issue state before starting more refactor tickets.
2. Fix #49 infra drift so Bicep accurately represents container deploys.
3. Use #92-style characterization tests as the safety net for active flows before splitting more UI.
4. Continue #105 in small slices: civilization/profession, skill allocation, review/finalize.
5. Start #103 API contract layer where route/model coupling causes active feature risk.
6. Split scenario/encounter/template UI files from #107 after tests cover current behavior.
7. Defer #99 JSON content migration until active content/export work settles.
8. Defer #108 shared admin components until admin pages need another functional pass.
9. Defer #110 styling standardization until broad page churn is lower.

## Pre-Refactor Safety Work

- Confirm which duplicate issue is canonical and close or update the other ticket before implementation.
- For each refactor slice, add or verify characterization tests around the exact user flow before moving code.
- Keep each slice behavior-preserving and small enough to review independently.
- Run `pnpm test`, `pnpm lint`, and `pnpm build` before merging refactor work.
- Avoid schema/database changes unless the refactor explicitly requires them.
- Do not combine refactors with feature behavior changes unless the issue explicitly calls for both.
- For spreadsheet-backed or rules-heavy code, cite source formulas before changing calculations.

## Risky Files/Areas During Parallel Feature Work

Avoid broad edits here while scenario/roleplay/campaign features are still moving:

- `apps/web/app/(app)/chargen/ChargenWizardExperience.tsx`
- `apps/web/app/(app)/campaigns/[campaignId]/CampaignDetailPageContent.tsx`
- `apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/ScenarioDetailPageContent.tsx`
- `apps/web/app/(app)/encounters/[id]/RoleplayEncounterScreens.tsx`
- `apps/web/src/lib/api/localServiceClient.ts`
- `apps/api/src/routes/scenarios.ts`
- `packages/database/src/services/scenarioService.ts`
- `packages/database/src/repositories/scenarioRepository.ts`
- `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts`
- `packages/content/src/validators.ts`
- `packages/domain/src/encounter/roleplay.ts`
- `packages/rules-engine/src/skills/*`
- `infra/modules/appservice.bicep`

Preferred approach: add narrow adapters, tests, or extracted leaf components first; avoid moving large stateful blocks while feature branches are active.

## Recommended Next 5 Tasks

1. Clean up GitHub issue hygiene: choose canonical issues for #92/#99/#103/#105/#107/#108/#110, then close or update duplicates.
2. Fix #49 by aligning `infra/modules/appservice.bicep` with container deploy settings and checking deploy workflow assumptions.
3. Expand/confirm characterization tests for chargen, campaign workspace, and encounter/roleplay screens before more structural edits.
4. Continue #105 with the next safe Chargen slice: extract civilization/profession UI from `ChargenWizardExperience.tsx`.
5. Start a narrow API contract pilot for #103 on one active domain, preferably campaign/scenario/encounter read models, before applying the pattern repo-wide.
