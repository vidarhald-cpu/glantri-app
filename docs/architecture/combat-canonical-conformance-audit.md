# Combat canonical-conformance audit

Audit date: 2026-07-23

Branch: `feature/player-general-encounter-screen`

Scope: audit of current combat domain, API, and web integration, with authority-remediation status

Authority remediation: 2026-07-23

Attack-lineage remediation: 2026-07-23

## 1. Executive summary

The canonical architecture is established and is used by most current combat paths:

- `CombatProgressionProjection` is the authoritative task graph.
- presentation tasks preserve task, execution-group, process, stage, owner, facet, and safe status;
- `CurrentActionPresentation` normally creates one immutable command descriptor;
- current API routes normally compare `Encounter.updatedAt`, authorize a projected task, and validate
  task-specific domain identities;
- tracker live attention is indexed from projected task facets rather than inspector selection;
- player-safe projection retains visible task and completion status while removing private facts.

The repository is not yet fully conformant. The original audit found one P0 authority gap and
several P1 gameplay/conformance defects. This slice closed the authority findings while preserving
the remaining attack-lineage and presentation risks:

1. **Fixed:** four obsolete GM mutation endpoints were removed; they had no projected task and no
   current application caller.
2. **Fixed:** every boundary command now requires and validates exact task, execution group,
   command type, revision, current boundary, and target boundary.
3. **Fixed:** attack, parry, hit-location, and critical no longer re-check compatibility cursor state
   after exact projected-task authorization.
4. **Fixed:** every newly committed attack preserves one deterministic declaration/opportunity,
   attack index, target, weapon source, weapon template/instance, and attack-mode identity through
   the task descriptor, request, command, result, downstream process, and presentation event.
5. GM declaration/modifier-review submission can bind the canonical task identity to form data from
   the currently inspected participant.
6. ownerless GM tasks sometimes fabricate tracker ownership from `currentCursor`, and Round End UI
   context independently selects an executable SU task instead of following Current Action.
7. **Fixed for live attacks:** distance modifiers are derived from the explicit declared attack
   source; the API and web no longer silently select the first/default weapon when the source is
   absent. Web name matching remains only in the declaration editor preview.

The removed P0 paths were not used by the current main panel according to repository searches, but
their public authenticated mutation surface was still an authority violation rather than harmless
dead code.

**Conclusion:** the authority and canonical attack-lineage prerequisites are complete. Offensive
Parry Slice 1 now uses them for its exact successful-parry trigger and descriptor-bound parallel
Brawling contest, without participant + phase, latest-result, inspector, or default-weapon recovery.
The unrelated presentation-source risks below remain cleanup work.

## 2. Confirmed canonical invariants

| Invariant                                                        | Result                                   | Evidence                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Live task identity comes only from progression projection     | Partial                                  | Normal mutation routes are canonical; `buildCombatRoundEndProcessPlan` still uses `currentCursor` to prefer a participant.                                                                |
| 2. Invocation comes only from `CurrentActionCommandDescriptor`   | Partial                                  | All supported normal commands are descriptor-authorized, but GM declaration/review and attack payloads still obtain task-sensitive data from inspector/local phase models.                |
| 3. API validates exact task and execution group                  | Conformant in supported normal mutations | Boundary commands now use the same strict task/group/command identity contract. The four unprojected legacy mutation routes were removed.                                                 |
| 4. Tracker current ownership comes from required actor and facet | Partial                                  | `buildCombatProgressionTrackerIndex` does this correctly. Several ownerless GM task builders assign `trackerOwner`/`trackerParticipantId` from a cursor or proposal participant.          |
| 5. Inspector Current task uses the same task                     | Partial                                  | `buildCombatRoundLiveInspectorContext` is canonical. `CombatRoundManagerPanel` falls back to cursor-owner/first task and independently chooses an SU task.                                |
| 6. Result lifetime uses canonical boundary/opportunity identity  | Conformant for new live attack lineage   | live result lifetime remains boundary-based; each new attack event/result carries its exact opportunity and source identity. Legacy incomplete records are read-only compatibility data.  |
| 7. UI serializes but does not infer canonical identity           | Conformant for live attack invocation    | GM/player attack handlers serialize opportunity/source/mode from the immutable descriptor. Editable declaration previews may still use draft loadout values before commitment.            |
| 8. Player-safe projection preserves safe status                  | Conformant in inspected paths            | `combatProgressionProjection/presentation.ts` preserves IDs, state, blockers, ownership when visible, and explicit waiting-for-GM state while sanitizing subjects and detail identities.  |
| 9. Historical inspection cannot retarget live mutation           | Partial                                  | descriptor task identity cannot be retargeted, but inspector-derived form/loadout state can change the values submitted for the descriptor's participant.                                 |
| 10. Missing identity fails closed                                | Conformant for live attack lineage       | Incomplete live opportunities are non-executable; attack parsing and authorization require exact source/mode/index identity. Historical-only snapshot fallback cannot authorize commands. |

The central domain authorization helper itself is strong. `authorizeCombatProgressionTask` filters
boundary, process, stage, kind, expected command, task-specific identities, execution group, task,
diagnostics, state, and actor when those identities are supplied. The conformance problems are
primarily callers omitting identities or adding a second compatibility check after authorization.

## 3. Search methodology

The audit read the required architecture/product documents and inspected current code rather than
assuming that prior migrations were complete. Searches covered:

- every `CombatProgressionTaskKind` declaration and task builder;
- `COMMAND_TASK_RULES` and every call to `authorizeCombatProgressionTask` /
  `authorizeCombatTaskCommand`;
- every `/combat-round/` POST route;
- Current Action descriptor construction/resolution and GM/player command handlers;
- tracker indexing, live inspector selection, and historical selection;
- all uses of `currentCursor`, `phaseResolutionCursor`, inspector selection, “latest” result/snapshot,
  proposal and source fallbacks in live paths;
- event persistence/mapping for declaration, CE, initiative, action, parry, damage, and SU;
- participant, pair, revision, weapon-source, and attack-mode normalization helpers.

Principal files inspected:

- `packages/domain/src/encounter/combatProgressionProjection/{types,build,internal,authorization,declaration,resolution,presentation,advance}.ts`
- `packages/domain/src/encounter/{combatActionProcesses,combatRoundEndProcesses,combatRoundManager,combatStepEvents,combatStepEventPersistence,combatHistoryProjection,combatLogProjection,session}.ts`
- `apps/api/src/routes/scenarios/encounterRoutes.ts`
- `apps/web/src/features/combat-history/view-models/{currentActionPresentation,buildCombatProgressionTrackerModel,buildProjectedCombatTrackerModel,buildCombatStepResultPresentation,combatViewRevision}.ts`
- `apps/web/src/features/combat-round-manager/{CombatRoundManagerPanel,combatRoundSelection,combatRoundViewState,combatDistanceModifierProjection}.tsx/.ts`
- `apps/web/src/features/player-combat/playerCombatPhaseModel.ts`
- `apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent.tsx`
- the corresponding domain, API, and web tests protecting those paths.

The classification used by this audit is:

- **P0:** active authority violation or play blocker;
- **P1:** demonstrated architecture violation with a credible gameplay failure path;
- **P2:** duplication or conformance risk without a demonstrated current mutation failure;
- **P3:** cleanup or documentation mismatch only.

## 4. Task-kind conformance matrix

“Fully conformant” here means the current task-specific path, not adjacent obsolete API routes.

| Task kind                                       | Status                 | Audit result                                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit_declaration`                            | Confirmed violation    | Projection, descriptor, parsing, and authorization are exact. GM submission uses `inspectorDraft`, phase loadout summaries, and generated context without proving those values belong to the descriptor participant. |
| `combat_experience`                             | Fully conformant       | Declaration and A1/A2 triggers are task-bound; phase/opportunity/trigger are recorded; player-safe result facts retain completion.                                                                                   |
| `modifier_review`                               | Confirmed violation    | Task identity is exact, but the shared GM declaration/review handler submits the current inspector draft/loadout for the descriptor participant.                                                                     |
| `roll_initiative`                               | Fully conformant       | Participant, phase, group, task, revision, actor, and authoritative initiative inputs are checked. Local UI values are calculation input, not task identity.                                                         |
| `commit_initiative`                             | Minor conformance risk | Current endpoint is descriptor-bound, but the ownerless task fabricates tracker ownership from `currentCursor`.                                                                                                      |
| `attack`                                        | Fully conformant       | The exact opportunity, declaration, attack index, target, weapon source/template/instance, mode, task, group, and revision flow through GM/player invocation and persistence.                                        |
| `parry`                                         | Fully conformant       | Task/group/attack-result identities authorize directly and retain the exact upstream opportunity lineage.                                                                                                            |
| `damage_roll`                                   | Fully conformant       | Task and roll expression are exact; new attack results persist the opportunity-specific weapon DMB and armor class used by downstream damage.                                                                        |
| `hit_location`                                  | Fully conformant       | Exact attack/result/opportunity lineage is retained; new live attacks use persisted source-specific DMB/armor inputs. Legacy snapshot fallback is read-only compatibility.                                           |
| `critical`                                      | Fully conformant       | Exact critical identities authorize against an attack result that retains its opportunity and source lineage.                                                                                                        |
| `damage_review`                                 | Fully conformant       | Both resolution and commit validate exact attack/result/review/group/task identities; editable review rows remain intentional GM input.                                                                              |
| `double_attack_decision`                        | Fully conformant       | Choice is form input; participant, phase, opportunity, group, task, and revision are descriptor-bound.                                                                                                               |
| `feint_attacker_roll` / `feint_defender_roll`   | Fully conformant       | Current roll routes require exact proposal, participant, group, task, and revision. The obsolete feasibility mutation route was removed.                                                                             |
| `feint_commit`                                  | Fully conformant       | Proposal and task identities are exact; GM adjustment/review values are intentional command input.                                                                                                                   |
| Adjust Distance response/adjustment/roll/commit | Fully conformant       | Proposal/pair/opportunity/participant identities are validated. GM adjustment participant is editable input but domain-limited to the proposal's attacker/defender.                                                  |
| `distance_roll`                                 | Fully conformant       | Both player and GM proxy routes authorize exact participant, opponent, pair, proposal, group, task, and revision.                                                                                                    |
| `distance_commit`                               | Minor conformance risk | Mutation is exact. The ownerless task assigns its tracker facet to participant A and GM UI separately chooses a projected SU task.                                                                                   |
| `health_review`                                 | Fully conformant       | Participant, health-roll, proposal, group, task, revision, and proxy authority are exact.                                                                                                                            |
| `participant_review`                            | Not applicable         | This is a process/stage kind, not a currently emitted task. The actual mutation task is `effect_review`. Keeping it in `CombatProgressionTaskKind` is a P3 type/matrix ambiguity.                                    |
| `effect_review`                                 | Fully conformant       | Exact active participant, group, task, and revision; ownerless GM mutation is authoritative.                                                                                                                         |
| `round_end_prepare`                             | Minor conformance risk | Invocation uses the exact descriptor and is keyed by task + revision. Its tracker participant is fabricated from `currentCursor`.                                                                                    |
| `gm_advance_boundary`                           | Minor conformance risk | Authority is fully descriptor-bound, including command, revision, task, group, current boundary, and target boundary. Some ownerless boundary tasks still fabricate a tracker owner.                                 |

Reload and undo are generally canonical: task IDs are deterministic projections of surviving facts,
and undo removes/reverts the underlying command facts. The important limitation is that task/group
identity is not persisted on commands/events, so audit provenance and exact opportunity lineage rely
on deterministic reconstruction rather than a recorded invocation identity.

## 5. Confirmed violations

### P0 — legacy GM mutation endpoints bypass projected authorization — fixed

The original audit found these routes in `apps/api/src/routes/scenarios/encounterRoutes.ts`:

- `POST .../combat-round/feint-feasibility`;
- `POST .../combat-round/skip-current-action`;
- `POST .../combat-round/advance-current-phase-resolution`;
- `POST .../combat-round/complete-current-phase-resolution`.

The first mutated a proposal by proposal ID. The other three derived participant/phase from
`currentCursor` or `phaseResolutionCursor`. None parsed `expectedRevision`, `taskId`, or
`executionGroupId`; none called projected task authorization. They were GM-only, but authenticated
GM access was not a replacement for progression authorization. An external or stale client could
therefore mutate state outside the canonical task graph.

Resolution: all four operations were classified as obsolete duplicate normal-progression paths, not
canonical gameplay tasks and not administrative repairs. The API routes, browser clients, exports,
and obsolete behavior tests were removed. Requests now return `404`, and regression coverage proves
that no encounter write occurs. No compatibility wrapper remains.

### P1 — boundary command omits execution-group identity — fixed

The original boundary path carried revision, task ID, current boundary, and target boundary, but no
execution-group ID. It relied on a uniquely resolved task instead of validating the rendered group.

Resolution: the boundary request now requires `commandType`, `expectedRevision`, `taskId`,
`executionGroupId`, `expectedBoundary`, and `targetBoundary`. The domain transition authorizes the
exact projected task and group. Missing, wrong, stale, or mismatched identities fail closed with
typed `identity_mismatch`, `task_mismatch`, `execution_group_mismatch`, `boundary_mismatch`, or
`stale_revision` responses.

### P1 — canonical authorization is followed by cursor-derived rejection — fixed

The original routes first authorized an exact projected task and then called
`getPlayerCombatCurrentRollAction`:

- `roll-attack`;
- `roll-parry`;
- `roll-hit-location`;
- `roll-critical`.

That second check was redundant and less authoritative. If compatibility cursor state disagreed
with the projected task, the valid command was rejected.

Resolution: all four post-authorization cursor checks were removed. The routes use the authorized
task as live eligibility and retain factual validation for exact participant, phase, opportunity,
attack/result identity, prior result existence, and duplicate mutation protection.

### P1 — attack opportunity/source lineage is dropped and later reconstructed — fixed

The attack task and request contain `opportunityId`, but `recordCombatRoundAttackResult` writes
`attackOpportunityId` only when the candidate origin is `double_attack`. Ordinary Single, Reactive,
Feint follow-up, and Adjust Distance follow-up results can therefore lose the canonical opportunity.
The attack event also places this value only in structured outcome facts when present, not as a
guaranteed event identity.

The API compounds this by selecting a committed declaration opportunity with a participant/phase
`.find(...)`, rather than resolving exactly `body.opportunityId`, and by using reverse-found phase
snapshots for weapon, DMB, defender DB/DM, and armor class in attack/hit-location/damage paths.

This is a blocker for Attacking Parry. A new same-phase opportunity cannot safely coexist with code
that treats participant + phase or latest phase snapshot as unique.

Resolution:

1. `CanonicalAttackOpportunityIdentity` now captures declaration, opportunity, participant pair,
   phase, action kind/index, weapon source/template/instance, and attack mode;
2. declaration submission creates and persists the identity once with deterministic IDs;
3. projected attack tasks and `CurrentActionCommandDescriptor` carry the identity unchanged;
4. attack parsing/authorization requires the identity and resolves the exact persisted opportunity;
5. commands, attack results, events, downstream processes, and historical presentation retain the
   same `opportunityId`/`attackResultId` chain;
6. new results persist source-specific DMB and armor class, so hit-location/graze damage no longer
   chooses an attacker snapshot by participant + phase;
7. old records without lineage remain readable through explicitly historical compatibility paths
   but cannot create an executable live task.

### P1 — attack invocation reconstructs source and calculations in React — fixed

`CombatRoundManagerPanel.rollInspectorPhaseAttack` authorizes the descriptor, then builds the
phase model from `inspectorDraft` and `inspectorPhaseLoadoutSummaries`. Player Combat similarly reads
`phaseCombatLoadoutSummaries`, `selectedActionId`, and a locally resolved target. The descriptor has
no declaration/action ID, weapon source ID, or attack-mode ID.

Resolution: both GM and Player handlers require the canonical descriptor fields and serialize them
directly. React still reads the rendered combat summary for submitted numeric OB/DB calculation
inputs, which the server validates against canonical modifier facts, but it no longer selects or
normalizes the live weapon source, mode, target, action, or opportunity.

### P1 — GM declaration/modifier review can mix canonical identity with inspected values

`CombatRoundManagerPanel.saveInspectorDeclaration` resolves a descriptor participant, but submits:

- `inspectorDraft` action/movement/phase contexts;
- `inspectorGeneratedCombatContext`;
- `inspectorPhaseLoadoutSummaries` attack sources and weapon names;
- the locally selected inspection step for follow-up navigation.

The task identity remains canonical, so historical selection cannot change which participant the API
authorizes. It can, however, supply another inspected participant's editable data to that canonical
participant. This is especially unsafe for `modifier_review`, where the same handler is reused.

Required action: key editable drafts by descriptor participant + round + phase, resolve that exact
draft at invocation, and fail closed if it is not available.

### P1 — Round End live context independently chooses a task

`CombatRoundManagerPanel` builds `inspectorRoundEndTask` by scanning all executable SU tasks and
matching `roundState.currentCursor.participantId`, then taking the first task. It uses the selected
task to choose distance proposal/control context and panel availability. This selection is separate
from `currentActionPresentation.taskId`.

The mutation handlers still resolve descriptors, so this does not directly retarget authorization.
It can display or edit context for a different task and is therefore a presentation-source violation.

Required action: resolve SU context by the current presentation task ID only; support an explicit
multi-task chooser only when the projection's execution group intentionally exposes parallel tasks.

### P1 — distance modifier source normalization silently defaults a weapon — fixed for live lineage

API `buildCombatActionDistanceModifierInputs` resolves by a normalized weapon name and falls back to
`getDefaultAttackWeaponTemplate`. Web `combatDistanceModifierProjection.ts` independently implements
name matching and falls back to the first candidate weapon. The implementations use different source
sets (API also includes content templates and ready items).

A missing canonical weapon source can therefore become a modifier for an unrelated first weapon,
and GM/web preview can differ from server persistence. This contradicts fail-closed source handling.

Resolution: API declaration and recomputation paths build distance inputs from the explicit
`CombatAttackSourceRef` persisted on the opportunity. Missing sources produce no guessed modifier.
The web declaration editor may resolve its currently edited named source for preview, but no longer
falls back to the first candidate. Live execution does not use that preview to identify a weapon.

### P1 — ownerless GM task facets sometimes fabricate participant ownership

Examples:

- declaration CE difficulty and declaration boundary tasks use `currentCursor` as tracker owner;
- initiative commit uses `currentCursor` as tracker owner;
- Round End prepare uses `currentCursor` as tracker participant;
- Round End distance commit uses participant A as tracker participant even though the task owner is GM.

`buildCombatProgressionTrackerIndex` correctly trusts `task.trackerFacet.owner`; consequently the
fabricated owner becomes a live participant marker. Ownerless tasks need an ownerless phase context,
not a compatibility row.

## 6. Minor risks

### P2 — Current Action to inspector fallback can manufacture live context

`CombatRoundManagerPanel` chooses `projectedCurrentTask` by Current Action task ID, then falls back to
a task matching `currentCursor.participantId`, then the first task. The canonical helper
`buildCombatRoundLiveInspectorContext` is correct once given a task, but the fallback means a missing
or conflicted Current Action identity can still make an unrelated task appear live.

Fail closed when the Current Action task cannot be resolved. Local inspection may remain visible as
historical, but it must not become the live context.

### P2 — Round End ordered iteration accepts compatibility cursor preference

`buildCombatRoundEndProcessPlan` calls `buildOrderedParticipantIteration` with
`preferredParticipantId` from the SU `currentCursor`. Completion facts still constrain the result,
and this may preserve legacy ordering after reload, so this audit does not label it an active defect.
It does mean current task identity is partly cursor-dependent. Persist an explicit iteration fact or
derive solely from canonical participant order + completion before removing the cursor.

### P2 — task/group identity is not persisted with commands/events

The API consumes task and group at authorization, but domain mutation command builders generally do
not record them. Process and stage are also presentation-only. Deterministic reprojection supports
reload and undo, but audit/history cannot prove which task/group authorized a persisted command.
This becomes more important with multiple same-kind tasks in one phase.

### P2 — participant alias normalization has a web-only fallback

`session.ts` provides canonical `resolveEncounterParticipantMembership` and
`resolveEncounterParticipantForViewer`, including ambiguity checks and implicit membership.
`playerCombatPhaseModel.resolveCanonicalCombatTargetIdentity` separately matches aliases and may
fabricate encounter/scenario identity as the same fallback ID. Access routes use the canonical domain
resolver, so authorization remains safe, but request construction and labels can diverge.

### P2 — revision comparison is duplicated

Player Combat uses `combatViewRevision.ts`; GM Combat uses `combatRoundViewState.ts`. Both compare
timestamp strings, but invalid/non-date handling differs. The current descriptor gates are cautious,
and no current stale acceptance was proved in this audit. Consolidating the helper would prevent the
two views from drifting again.

### P2 — orphan event placement contains hard-coded phase fallbacks

`combatStepEvents.orphanCommandCandidates` places missing-phase attack/damage/critical/hit-location
commands in Phase 1 and missing-phase parry in P1. CE correctly uses A1/A2 when command phase is
present and Declaration only for initial CE. These fallbacks are limited to reconstructing legacy
orphan commands, but they can misclassify malformed newer history rather than surface incomplete
identity.

### P2 — round-end distance history lacks full identity

The live result presenter explicitly suppresses some distance-control calculations because projected
history does not retain enough pair/proposal identity to attach them safely. The safe suppression is
correct; the missing identity remains a result-projection gap.

### P3 — type/matrix ambiguity and dead branch

- `participant_review` is a process/stage but remains in the task-kind union and is described as a
  descriptor-bound task in the existing matrix.
- `saveInspectorDeclaration` contains an unreachable `resolve_damage` / `damage_roll` guard although
  its resolver accepts only declaration/modifier commands.

## 7. Safe legacy and compatibility uses

The audit did not classify every cursor or selection reference as a violation. These uses are safe:

- domain commands record `beforeCursor`/`afterCursor` for compatibility, history, undo, and legacy
  step navigation after a task has already been authorized;
- `getCombatRoundLiveInspectorSelection` uses a cursor/first row only to display an ownerless
  phase-wide task, while `isCombatRoundInspectionSelectionLive` ignores row ownership for that scope;
- tracker `selected` state is visual inspection only; live marker ownership comes from the
  progression tracker index;
- historical tracker/result builders use snapshots and selected cells without exposing command
  descriptors;
- local declaration, choice, GM adjustment, review rows, and notes remain valid editable values when
  they are keyed to the descriptor identity and domain-validated;
- Combat Log selection does not construct a task or command and remains independent from Current
  Action;
- player-safe projection may remove raw rolls/calculations and detail targets while retaining safe
  task status, owner context, and completion facts.

`clear-current-step` remains a separate GM-only undo/repair endpoint and a visually separate “Clear
current step” control; it is not reachable through Current Action and does not share a normal
progression route. It still accepts an explicitly selected participant/step and does not yet require
a repair reason or confirmation. That provenance/UX hardening is deferred because no normal command
can reach it and it was not one of the audited P0/P1 authority bypasses.

## 8. Duplicate normalization findings

| Concept                        | Canonical path                                                                                                                                  | Duplicate/risk                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Participant membership/aliases | `session.ts`: `resolveEncounterParticipantMembership`, `resolveEncounterParticipantForViewer`, `resolveEncounterParticipantByRollParticipantId` | web `resolveCanonicalCombatTargetIdentity`; API local `find*ByAlias` wrappers; fallback can collapse encounter/scenario IDs.                                  |
| Pair identity                  | domain `getCombatDistancePairKey` / distance alias helpers                                                                                      | Most current routes use it correctly; local pair option construction still deserves guard coverage but no conflicting formula was found.                      |
| Weapon source                  | persisted `CombatAttackSourceRef` and `CanonicalAttackOpportunityIdentity`, API `resolveDeclaredWeaponSource`                                   | declaration editing may still resolve a displayed name before commitment; live commands, results, downstream work, and modifiers use the committed source ID. |
| Attack mode                    | domain declaration normalization before commitment; committed opportunity mode afterward                                                        | UI phase models may select a legal editable value before commitment; missing live mode identity now fails closed instead of selecting a default.              |
| Declaration phase source       | `phaseAttackSources` persisted on the canonical opportunity                                                                                     | no live duplicate remains: descriptor/request/API authorization all require the exact opportunity source and mode.                                            |
| Revision comparison            | `combatViewRevision.ts` for Player                                                                                                              | separate `combatRoundViewState.ts` implementation for GM.                                                                                                     |
| Result/proposal identity       | deterministic opportunity-scoped result/proposal ID helpers                                                                                     | only historical records predating lineage may use read-only event/snapshot compatibility; those records cannot authorize live work.                           |

Pre-commit UI fallback is not inherently wrong. The violation begins after a declaration/opportunity is
committed: live execution must use the committed source, not repeat selection heuristics.

## 9. Event and boundary classification findings

Confirmed correct placement in current structured paths:

- declarations and initial CE: Declaration;
- phase CE: A1/A2, after initiative commit, with phase/opportunity command facts;
- initiative: i1/i2;
- Feint and Adjust Distance: A1;
- attack: A1/A2;
- parry: P1/P2 (legacy step names `review_phase_2_actions` / `review_phase_2_damage`);
- hit location, critical, damage roll/review: D1/D2;
- distance control, Health, participant/effect review: SU.

Risks:

1. orphan command reconstruction defaults missing phase to Phase 1/P1 rather than marking placement
   unresolved;
2. ~~standard attack events/results do not guarantee top-level opportunity identity;~~ fixed for
   every newly recorded attack;
3. some event command records do not retain the authorizing task/group;
4. Round End distance events have incomplete pair/proposal detail for calculation attachment.

The Combat Log remains fiction-facing and does not drive commands. CE remains excluded from it.
Current-step result lifetime is based on accepted projection boundary and active-round events; no
current latest-result priority chain was found in that projection.

## 10. Recommended cleanup slices

### Slice 0 — close authority bypasses — complete

- removed the four P0 legacy routes and unused browser clients;
- removed obsolete route/client behavior tests and added no-write/404 coverage;
- added focused source guards for removed routes, cursor-shadow eligibility, and strict boundary
  identity propagation.

Risk: medium because old bookmarks/tests or undocumented GM tooling may still call the endpoints.

Non-goal: changing rules represented by current canonical tasks.

### Slice 1 — canonical attack lineage — complete

- persist opportunity ID for every attack result/event;
- bind committed declaration/action/source/mode identity to the attack task/descriptor or resolve it
  server-side from the exact opportunity;
- make downstream parry/location/critical/damage tasks inherit this lineage;
- remove participant+phase and latest-snapshot source recovery.

Risk: high but bounded to attack identity and replay compatibility.

Non-goal: formulas, damage tables, parry legality, or Attacking Parry itself.

### Slice 2 — remove compatibility authorization shadows — complete

- deleted post-authorization `getPlayerCombatCurrentRollAction` checks;
- use the returned authorized task as the only live command eligibility context;
- retained domain fact validation and duplicate-roll checks.

Risk: low-to-medium.

Non-goal: removing compatibility cursors from persistence/history.

### Slice 3 — descriptor-keyed GM editing

- key declaration/modifier-review drafts by task participant/round/phase;
- make Current task navigation select that draft;
- fail closed if an unrelated inspector selection is active;
- resolve all SU pre-action context by Current Action task ID.

Risk: medium UI state coordination.

Non-goal: form redesign.

### Slice 4 — ownerless facets and Round End iteration

- remove fabricated tracker participants for GM-only phase tasks;
- formalize ownerless tracker/current-inspector presentation;
- replace Round End cursor preference with explicit iteration state or canonical ordered completion.

Risk: medium presentation/history compatibility.

Non-goal: Round End rules.

### Slice 5 — consolidate remaining normalization and legacy event fallbacks — partially complete

- ~~move committed weapon/source resolution into domain/shared API input;~~ complete for attack
  lineage;
- ~~remove first-weapon/name fallbacks from live modifier generation;~~ complete;
- reuse one participant/revision helper;
- mark incomplete legacy event placement explicitly instead of silently choosing Phase 1 where safe
  migration data exists.

Risk: medium; fixtures with incomplete legacy JSON need explicit migration expectations.

Non-goal: equipment or history schema redesign unless exact source identity cannot otherwise survive.

## 11. Recommended guard tests

1. Enumerate registered combat mutation routes and require a documented authorization policy:
   canonical task identity, administrative edit, or undo. Fail on an unclassified route.
2. Require `taskId`, `executionGroupId`, and `expectedRevision` in every canonical command parser,
   including boundary transitions.
3. Assert that no live API route calls `getPlayerCombatCurrentRollAction` after successful projected
   authorization.
4. Assert that every recorded attack result/event has the exact projected `opportunityId`, including
   Single, Reactive, Feint follow-up, Adjust Distance follow-up, Double Attack, and future action kinds.
5. Assert that downstream task/result identities retain attack opportunity and committed source/mode.
6. Make attack-source resolution return an error for a missing committed source; prohibit default
   weapon/mode fallback in live execution and modifier generation.
7. Build the tracker index without any inspection/cursor parameter and assert ownerless tasks produce
   no participant cell owner.
8. Given conflicting inspector selection and Current Action, assert the descriptor-keyed draft is
   submitted or the action fails closed.
9. Assert that the Round End panel's selected proposal/task ID equals Current Action task ID.
10. Feed event mappers a phase CE trigger and assert A1/A2; feed malformed new commands with missing
    phase and assert diagnostic/incomplete placement rather than Phase 1 fallback.
11. Assert GM and Player request builders serialize the same committed participant/opportunity/source
    identities for an equivalent task.
12. Assert player-safe projections retain `state`, completion, owner/facet, and safe result linkage
    after private calculations are removed.
13. Add a static source guard preventing `latest*`, `.reverse().find(...)`, inspector selection, or
    cursor helpers inside canonical mutation adapters except an explicit reviewed allow-list.

Implemented authority guards now cover removed legacy route registration, absence of
`getPlayerCombatCurrentRollAction` from canonical mutation routes, strict boundary task/group/command
propagation, wrong/missing group rejection, stale revision rejection, and player rejection for GM
boundary commands. Attack-lineage guards now cover deterministic opportunity IDs/indices, two
same-phase attacks against one defender, exact source/mode persistence on command/result/event facts,
strict API identity mismatch rejection, and removal of first/default-weapon fallback.

## 12. Offensive Parry status

The first Offensive Parry slice has proceeded on the completed authority and attack-lineage
foundation.

Minimum prerequisites:

1. ~~close or descriptor-bind the P0 legacy mutation routes;~~ complete;
2. ~~make boundary authorization include execution-group identity;~~ complete;
3. ~~persist exact opportunity and committed attack source/mode for all attacks;~~ complete;
4. ~~remove cursor-derived post-authorization checks from downstream attack routes;~~ complete;
5. ~~prove with a multi-opportunity test that attack/result lineage does not use participant + phase
   or latest-result lookup;~~ complete for two same-phase attacks and distinct Double Attack slots.

`offensive_parry_brawling_roll` is now a fully descriptor-bound participant task in a parallel
execution group. Its identity retains the declaration, opportunity, attack result, parry result,
contest, process, stage, task, and group. Continued Contact and Unbalanced are separate canonical
facts. Phase 2 follow-up attack generation and round-end maintenance/escape remain future slices.

Ownerless tracker cleanup and descriptor-keyed GM editing remain unrelated conformance cleanup; the
new Brawling path does not depend on either.
