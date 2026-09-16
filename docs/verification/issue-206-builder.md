# Issue 206 — combined target Chargen Builder evidence

Status: Builder candidate for independent immutable-head QA. The Product Owner resolved P09/P14 in the bounded continuation from `79382951f872d06805f8f01840ed9db81c346c32`: P09 F09/G06 and P14 F30/G08 are mutually exclusive Profession group purchases. No other exclusivity is inferred.

## Provenance and authority

- Baseline: `065248929f5274caf1da0d356ffc47b5ac68074f` on canonical Forgejo `dev`.
- Branch: `codex/206-chargen-target-groups-professions`; immutable candidate SHA is recorded in the PR/publication return.
- Builder task: `01a0ab3b-7fa1-7671-a614-4d9ff4f73148`; parent: `01a09f39-f5ff-7980-8f94-5a252f87d2f5`; worktree: `/Users/vidarhald/.codex/worktrees/490a/glantri-app-forgejo`.
- Exact Profession source: `docs/source/professions/Glantri_Full_Profession_Catalogue_PO_Proposal.md.txt`, SHA256 `548a81ec323321609fb7af1a2a78459450556dc32a4df5818965c10b2b48def6`.
- Deterministic parsed manifest: `sha256:11fb66385c82db84ca1097ee8be63638d5bf64470795e100f8eb93040e648a48`; 84 families, 115 group and 88 direct opportunities, 21 explicit Section G military tracks. Reuses the existing 172-competency and 59-group exports; 151 base memberships and 9 access-only Specialization memberships.
- PO6056 controls additive family menus and explicit tracks. PO6073 preserves existing global Admin Character reads; deferred #207 owns future policy consideration. No security-policy change is included.

## Implementation boundary

One target runtime projection supplies the existing wizard, route resolver, group quotes and finalization. Group memberships grant no automatic ranks. Base-only group prices, existing pool fallback, best group contribution and immediate-parent Specialization eligibility remain in the canonical rules paths. Server and local Character writes reject forged target identities, memberships and prices. Saved target metadata supports readable sheet names; old authenticated competency snapshots remain valid.

The Character build retains `civilizationId` so the existing mother-tongue grant can be validated at finalization. It also retains family/track/source identity and approved group definitions. No Prisma schema, migration, persistent database, CI/toolchain, Combat or Item change is included. Synthetic historical drafts preserve actual legacy identities and recorded spending in a read-only view; no extra legacy acquisition catalogue or completion mode is added. Personal browser drafts were not inspected and remain unverified/nonblocking.

## Verification

Node 22.23.2 and the existing frozen dependency lockfile were used.

- Focused content/domain/rules/wizard/sheet regressions: 216 tests passed across 21 files; subsequent group fallback/groupless coverage passes the expanded 7-test combined rules file.
- Local-storage boundary regressions: 18 passed, including synthetic target draft roundtrip, legacy recorded-spend preservation, and rejected forged target track/price writes.
- API/database: 14 passed across combined target API, prior target metadata API and CharacterService integration files. Use `--no-file-parallelism`: concurrent execution produced one serializable ledger transaction conflict; sequential execution passed without an implementation change.
- Combined target API proves owner save/read, ordinary unrelated-player denial without Character payload, preserved Admin200 with the same owner-visible build under PO6073, five forged payload rejections with no database insertion, and retained headless finalization.
- Application build, lint and typechecks: `turbo typecheck lint build --filter=@glantri/web --filter=@glantri/api`, 24 tasks successful.
- Changed-file Prettier passes. Full baseline-to-candidate `git diff --check` exits2 for52 inherited trailing-whitespace lines in the exact imported `.md.txt` source. Excluding only that source, the code/documentation diff check passes. The exact source is deliberately preserved byte-for-byte and its digest verified; no whitespace gate or Git attributes were changed. The initial precommit unstaged check omitted newly added files, so the initial blanket PASS report was corrected after commit.

## Actual browser observations

Synthetic account and isolated application database only, using the in-app browser against loopback web3206/API4206. Screenshots and DOM observations are retained in the Builder task transcript.

1. Hunter and Trapper selected under San Forager Bands / Band1, with all five family opportunities inspectable. Selection retained zero purchases. Tracking and hunting group bought for4, removed/refunded to0, then repurchased for4. Finalized Character `8bbb6b60-b946-4fd0-95ef-e2aae3cafcad` reopened with its Profession name.
2. Military archer selected under the same unbound context. Its F36+F38 package and complete F38 Bow + Formation Fighting membership inspected. F38 bought for2; draft reload retained track, name and spending. No F39/F40 access is supplied by this track; forged/access denial is also tested in rules/API.
3. At390px, Falconry displayed Animal Training as immediate parent, level11 requirement and disabled purchase. Complete group disclosure remained readable. Initial page-wide overflow was corrected with bounded section overflow; DOM measurement was390px document width and390px scroll width.
4. At390px, Character `70af1c9d-e2ee-4edf-874d-cffa4a97e589` finalized and reopened. Reload at desktop retained Soldier — Military archer and Military bow and formation practice (Level1). The sheet group summary now reads retained target groups rather than filtering them away against legacy group IDs.
5. Temporary viewport override reset. No personal browser storage was inspected.

These are Builder observations, not independent QA certification. A fresh immutable-head QA task and protected checks remain required.

## Cleanup and remaining gates

Owned target `issue-206-490a`, container `glantri-task-issue-206-490a-pg16`, loopback49746, databases `glantri_task_issue_206_490a` and `glantri_task_issue_206_490a_test`. Supported setup/verify/migrate/exec/cleanup tooling used. Web/API processes stopped; cleanup removed the container, anonymous volumes and `.env.task`. No protected database or playtest data touched.

The former P09 source line503 and P14 source line700 questions are resolved by the current #206 PO ruling. Family menus and explicit tracks are preserved; the two scoped group alternatives are enforced during ordinary/flexible purchase preview, direct primary purchase, finalization, API and local Character validation. Direct competency purchases remain unaffected; P14 G08+F35 remains allowed. No new track or route-composition workflow is introduced. Parent owns fresh immutable-head QA, protected checks and any conditional dev integration. Independent-QA repair cycles remain zero.

## Bounded PO continuation verification

Entry HEAD `79382951f872d06805f8f01840ed9db81c346c32`, clean same branch/worktree; fetched live dev still `065248929f5274caf1da0d356ffc47b5ac68074f`. Source bytes and deterministic source manifest remain unchanged. Profession runtime metadata contains only the two approved exclusion pairs.

Focused tests cover both purchase orders, unchanged state/pools on refusal in both purchase entry points, each route alone, refund then switch, forged combined submissions, unaffected direct Skill purchases and unrelated Professions, and allowed P14 G08+F35. API tests save each route alone and reject both forged ordering combinations without inserting a Character. Existing owner/unrelated-player/Admin6073 and headless checks remain in the same API test.

Continuation checks:62 affected regression tests PASS;2 API integration files PASS (including valid individual routes and four forged pair/order rejections); application build/lint/typechecks24 tasks PASS. Changed-file formatting and continuation diff checks PASS. The prior full-baseline raw-source whitespace exception remains unchanged. No further browser run is claimed for this bounded continuation; package text and purchase-preview restrictions use the existing inspected UI paths and require independent QA review. Supported cleanup removed the continuation container, anonymous volumes and `.env.task`. The new task target uses owner `issue-issue-206-490a`, loopback51888, container `glantri-task-issue-issue-206-490a-pg16` and application/test databases `glantri_task_issue_issue_206_490a` / `glantri_task_issue_issue_206_490a_test`; the repeated word in the generated owner name is harmless and no previous lease or protected target is reused.
