# Combat canonical-conformance audit

## Physical persistence conformance

Normal combat routes persist through `updateCombatEncounter` with the accepted
encounter revision. Metadata, active state, and the bounded archive delta commit in
one transaction. Ordinary combat routes no longer invoke generic full-session
persistence. Split reads fail closed on partial storage and never fall back to the
legacy combat tree.

Audit date: 2026-07-23

Branch: `feature/player-general-encounter-screen`

Scope: audit of current combat domain, API, and web integration, with authority-remediation status

Authority remediation: 2026-07-23

Attack-lineage remediation: 2026-07-23

Workspace loading remediation: 2026-07-26

Combat read-boundary remediation: 2026-07-26

Campaign workspace lists now use the strict shared
`EncounterSessionSummary` contract and the GM database path does not select
`sessionJson`. Summary facts authorize no combat command and cannot project
progression; the exact selected encounter remains the sole live combat source.

GM polling is keyed by exact encounter ID and canonical `updatedAt` revision.
Only a newer revision triggers one exact encounter load. Selection request
tokens, encounter-ID checks, and latest-revision adoption prevent late list,
selection, or poll responses from replacing newer mutation state. Scenario
authorization for summary, full, and revision endpoints remains unchanged.

Read-only combat routes now declare one strict source contract. Revision uses
metadata only; history uses active history facts plus immutable archived rounds;
and explicit full encounter reads remain available for exact encounter and
mutation consumers. `projectCombatHistory` cannot accept an
`EncounterSession`. Player authorization and viewer-aware sanitation still
occur before an outward history response, and every read view carries the exact
persisted encounter revision. The transitional repository still materializes
the unified `sessionJson` for active/archive/history views; this is a storage
cost, not a fallback authority path.

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
8. **Fixed:** round-start reset now removes canonical opportunity-keyed attack results from the
   active participant state while preserving them in the completed-round archive. Tracker marker
   input can no longer associate a prior-round miss with the new round's A1 facet.

The removed P0 paths were not used by the current main panel according to repository searches, but
their public authenticated mutation surface was still an authority violation rather than harmless
dead code.

**Conclusion:** the authority and canonical attack-lineage prerequisites are complete. Offensive
Parry Slice 1 now uses them for its exact successful-parry trigger and descriptor-bound parallel
Brawling contest, without participant + phase, latest-result, inspector, or default-weapon recovery.
The unrelated presentation-source risks below remain cleanup work.

## 2. Confirmed canonical invariants

| Invariant                                                        | Result                                   | Evidence                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Live task identity comes only from progression projection     | Partial                                  | Normal mutation routes are canonical; `buildCombatRoundEndProcessPlan` still uses `currentCursor` to prefer a participant.                                                                                                                                                                         |
| 2. Invocation comes only from `CurrentActionCommandDescriptor`   | Partial                                  | All supported normal commands are descriptor-authorized, but GM declaration/review and attack payloads still obtain task-sensitive data from inspector/local phase models.                                                                                                                         |
| 3. API validates exact task and execution group                  | Conformant in supported normal mutations | Boundary commands now use the same strict task/group/command identity contract. The four unprojected legacy mutation routes were removed.                                                                                                                                                          |
| 4. Tracker current ownership comes from required actor and facet | Partial                                  | `buildCombatProgressionTrackerIndex` does this correctly. Several ownerless GM task builders assign `trackerOwner`/`trackerParticipantId` from a cursor or proposal participant.                                                                                                                   |
| 5. Inspector Current task uses the same task                     | Partial                                  | `buildCombatRoundLiveInspectorContext` is canonical. `CombatRoundManagerPanel` falls back to cursor-owner/first task and independently chooses an SU task.                                                                                                                                         |
| 6. Result lifetime uses canonical boundary/opportunity identity  | Conformant for new live attack lineage   | Live result lifetime remains boundary-based; each new attack event/result carries its exact opportunity and source identity. Round transition archives those results and clears both active legacy and opportunity-keyed attack slots. Legacy incomplete records are read-only compatibility data. |
| 7. UI serializes but does not infer canonical identity           | Conformant for live attack invocation    | GM/player attack handlers serialize opportunity/source/mode from the immutable descriptor. Editable declaration previews may still use draft loadout values before commitment.                                                                                                                     |
| 8. Player-safe projection preserves safe status                  | Conformant in inspected paths            | `combatProgressionProjection/presentation.ts` preserves IDs, state, blockers, ownership when visible, and explicit waiting-for-GM state while sanitizing subjects and detail identities.                                                                                                           |
| 9. Historical inspection cannot retarget live mutation           | Partial                                  | descriptor task identity cannot be retargeted, but inspector-derived form/loadout state can change the values submitted for the descriptor's participant.                                                                                                                                          |
| 10. Missing identity fails closed                                | Conformant for live attack lineage       | Incomplete live opportunities are non-executable; attack parsing and authorization require exact source/mode/index identity. Historical-only snapshot fallback cannot authorize commands.                                                                                                          |

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

| Task kind                                       | Status                 | Audit result                                                                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit_declaration`                            | Confirmed violation    | Projection, descriptor, parsing, and authorization are exact. GM submission uses `inspectorDraft`, phase loadout summaries, and generated context without proving those values belong to the descriptor participant.                     |
| `combat_experience`                             | Fully conformant       | Declaration and A1/A2 triggers are task-bound; phase/opportunity/trigger are recorded; player-safe result facts retain completion.                                                                                                       |
| `modifier_review`                               | Confirmed violation    | Task identity is exact, but the shared GM declaration/review handler submits the current inspector draft/loadout for the descriptor participant.                                                                                         |
| `roll_initiative`                               | Fully conformant       | Participant, phase, group, task, revision, actor, and authoritative initiative inputs are checked. Local UI values are calculation input, not task identity.                                                                             |
| `commit_initiative`                             | Minor conformance risk | Current endpoint is descriptor-bound, but the ownerless task fabricates tracker ownership from `currentCursor`.                                                                                                                          |
| `attack`                                        | Fully conformant       | The exact opportunity, declaration, attack index, target, weapon source/template/instance, mode, task, execution/initiative group, revision, effect cutoff, and modifier fingerprints flow through GM/player invocation and persistence. |
| `parry`                                         | Fully conformant       | Task/group/attack-result identities authorize directly and retain the exact upstream opportunity lineage.                                                                                                                                |
| `damage_roll`                                   | Fully conformant       | Task and roll expression are exact; new attack results persist the opportunity-specific weapon DMB and armor class used by downstream damage.                                                                                            |
| `hit_location`                                  | Fully conformant       | Exact attack/result/opportunity lineage is retained; new live attacks use persisted source-specific DMB/armor inputs. Legacy snapshot fallback is read-only compatibility.                                                               |
| `critical`                                      | Fully conformant       | Exact critical identities authorize against an attack result that retains its opportunity and source lineage.                                                                                                                            |
| `damage_review`                                 | Fully conformant       | Both resolution and commit validate exact attack/result/review/group/task identities; editable review rows remain intentional GM input.                                                                                                  |
| `double_attack_decision`                        | Fully conformant       | Choice is form input; participant, phase, opportunity, group, task, and revision are descriptor-bound.                                                                                                                                   |
| `feint_attacker_roll` / `feint_defender_roll`   | Fully conformant       | Current roll routes require exact proposal, participant, group, task, and revision. The obsolete feasibility mutation route was removed.                                                                                                 |
| `feint_commit`                                  | Fully conformant       | Proposal and task identities are exact; GM adjustment/review values are intentional command input.                                                                                                                                       |
| Adjust Distance response/adjustment/roll/commit | Fully conformant       | Proposal/pair/opportunity/participant identities are validated. GM adjustment participant is editable input but domain-limited to the proposal's attacker/defender.                                                                      |
| `distance_roll`                                 | Fully conformant       | Both player and GM proxy routes authorize exact participant, opponent, pair, proposal, group, task, and revision.                                                                                                                        |
| `distance_commit`                               | Minor conformance risk | Mutation is exact. The ownerless task assigns its tracker facet to participant A and GM UI separately chooses a projected SU task.                                                                                                       |
| `health_review`                                 | Fully conformant       | Participant, health-roll, proposal, group, task, revision, and proxy authority are exact.                                                                                                                                                |
| `participant_review`                            | Not applicable         | This is a process/stage kind, not a currently emitted task. The actual mutation task is `effect_review`. Keeping it in `CombatProgressionTaskKind` is a P3 type/matrix ambiguity.                                                        |
| `effect_review`                                 | Fully conformant       | Exact active participant, group, task, and revision; ownerless GM mutation is authoritative.                                                                                                                                             |
| `round_end_prepare`                             | Minor conformance risk | Invocation uses the exact descriptor and is keyed by task + revision. Its tracker participant is fabricated from `currentCursor`.                                                                                                        |
| `gm_advance_boundary`                           | Minor conformance risk | Authority is fully descriptor-bound, including command, revision, task, group, current boundary, and target boundary. Some ownerless boundary tasks still fabricate a tracker owner.                                                     |

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

Previously `CombatRoundManagerPanel.rollInspectorPhaseAttack` authorized the descriptor but rebuilt
submitted raw OB/DB modifier values from inspector and participant snapshot contexts. That omitted
initiative-cutoff effect activation and could disagree with the server immediately after a higher
initiative group completed. Player Combat already consumed the server-projected modifier validation.

Resolution: both handlers now serialize the canonical descriptor fields. GM proxy resolves raw
modifier totals and fingerprints from the exact projected task, current encounter revision, and
initiative-group cutoff; inspector selection is not an input. Player Combat consumes the matching
server projection. The API retains strict revision, task/group, opportunity, raw-total, and
fingerprint comparison with typed mismatch codes.

### P1 — accepted mutation retained a prior task descriptor — fixed

The final Round End participant-review handler discarded its returned command envelope and selected
a manual `round_summary` inspection tuple. This left the rendered Open declarations action paired
with pre-review identity until another refresh. Initiative changes exposed the same general risk
when locally reconstructed attack modifier facts survived a new effect cutoff.

Resolution: accepted GM mutations use the authoritative returned encounter and envelope to replace
revision, round state, Current Action, and inspection selection. The final SU response selects the
new boundary task directly. Player Combat invalidates revision-mismatched sanitized history while
the exact post-mutation projection reloads. Genuine cross-client conflicts still reject, refresh,
and require an explicit retry.

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
facts.

The declaration surface follows the Phase 1 opponent-binding pattern used by Feint and Adjust
Distance. Its deterministic `flat_db` row remains one canonical fact through preview, GM review,
participant state, snapshot provenance, and effective defender DB. Attack authorization continues
to validate the ordinary DB/Parry contribution fingerprint, while attack resolution composes the
flat row with the exact defender snapshot instead of trusting a stale sheet value or request.

The Slice 1 trigger is now an active counter-technique rather than an ordinary-parry side effect.
The declaration persists one selected encounter opponent. Each surviving canonical attack
opportunity/result from that opponent can project one deterministic `parry` task with purpose
`offensive_parry`, even when the source attack missed. The composed attack process keeps that child
work open; it does not reopen a completed phase through cursor state. A hit uses that same task as
the attack's one ordinary-mechanics parry, so no duplicate defensive roll exists. Successful exact
attempt lineage opens Brawling; failure does not. The lifecycle repairs below do not change
Continued Contact establishment, distance ownership, or maintenance/escape rules.

Attack validation projection now selects the first executable task after applying the viewer's
participant ownership constraint. Previously, a different participant's earlier tied task could be
selected and then rejected, leaving the owning player without a validation tuple while unrestricted
GM proxy continued to work. Attack descriptors bind revision, task, execution group, initiative
group, opportunity, effect cutoff, source/mode, raw modifier totals, and fingerprints.

Parry validation now uses the same canonical contribution resolver in projection, GM proxy,
participant request construction, and API authorization. The tuple includes exact task/group,
initiative group and cutoff, opportunity/result, purpose, source, process/stage,
attack-result modifier, combined DB/Parry plus combat-wide General modifier, and fingerprint.
Inspector-local totals cannot omit an active condition such as Unbalanced.

Offensive Parry Brawling parry-quality rows are raw workbook percentage inputs. The accepted route
persists the shared workbook trace, percentage adjustment, effective skill, and final total. For
base 15 and raw `+2%`, the canonical table produces effective skill 18; the raw value is not added
as two flat skill points.

The domain rejects a parry resolution when the exact attack result already has one. Once Brawling
or the exact source Continued Contact exists, that source cannot recreate its parent parry task,
result, or contest even if a stale client submits the old descriptor.

Canonical result identity suppresses compatibility copies of the same attack result or parry
result without collapsing distinct opportunities. Player-safe task identity retains the Brawling
contest ID, and a successful mutation immediately reloads the accepted history revision; the first
parallel roll therefore becomes a waiting state instead of a stale parent-parry action.

Player Combat refresh preserves that identity through one
encounter/revision/perspective-keyed history coordinator. Initial loading,
external revision changes, ordinary mutations, and Offensive Parry Brawling no
longer use separate history paths. Older encounter/history responses cannot
replace a newer mutation result, and the compact revision response never
authorizes a command or supplies hidden combat facts.

Ownerless tracker cleanup and descriptor-keyed GM editing remain unrelated conformance cleanup; the
new Brawling path does not depend on either.

Tracker round isolation is enforced before marker classification. `M` remains a canonical recorded
miss for an exact A1/A2 cell. The round-reset defect was in domain state, not React: the active
participant retained `attackResultsByOpportunity`, after which the GM tracker correctly keyed that
retained value using the active state's new round number. Round start now clears that active map,
while the completed-round archive keeps it. Empty cells are non-inspectable, and rendered tracker
cell keys use the full round/participant/facet identity. That tracker repair itself did not include
initiative sequencing; the subsequent timing slice is recorded below.

## 13. Initiative-group timing status

A1/A2 progression is now group-keyed by round, phase, and committed initiative value rather than
authorized from the compatibility cursor. Only the highest unresolved value projects; exact ties
expose all sibling opportunities. Source attack completion is insufficient: defense, maneuver,
contest, hit-location, critical, damage, GM review, and effect commit all contribute to group
completion.

Effect timing persists the creating group, activation boundary, affected participant, source
attack result, and source opportunity where available. Canonical modifier resolution receives the
current-group cutoff, excluding same-group effects and including them for later groups. Activation
is idempotent across reload and reversible under undo without a cursor/latest-effect fallback.

Damage operational action cancellation keeps existing consequence semantics for later initiative
groups. Exact-tie sibling opportunities are excluded because their legality was established at
group start. No new incapacitation or interruption rule was invented.

## 14. Initiative-commit undo conformance

New `commit_phase_initiative_resolution` commands use
`combatRoundInitiativeCommitUndoFactsSchema` version 1. The inverse binds the exact command, round,
and phase and stores only prior navigation plus changed phase/action/proposal facts. It contains no
participant arrays, command history, events, snapshots, completed rounds, or unknown JSON.

Undo validates the compact identity against the command before applying it. Removing the exact
commit restores initiative-group availability because group identity/effect cutoff are derived from
the unchanged initiative/effect facts and committed-command presence. A legacy-only fallback still
parses old `facts.previousState` values, but source-conformance and serialization-growth tests
prevent new commits from writing them.

The initiative route retains strict task/group/revision authorization. Its response now carries the
saved encounter and canonical command envelope without returning the same command separately.

## 15. Active-only mutation response conformance

Production GM Combat, Player Combat, and GM Player Combat send the versioned
`active-v1` response preference. The strict shared response contains canonical
revision, active combat state, command envelope, concise next-task identity,
updated participant shells, and bounded mutation-specific presentation only.
It rejects archived rounds, full encounter/history fields, and duplicated
top-level command payloads.

The API transforms the legacy internal route payload before serialization, so
strict authorization and player-safe route sanitation remain unchanged. The
client applies the active state only to the matching encounter and passes the
result through existing monotonic revision acceptance. Revision-keyed history
is fetched once and cannot be replaced by an older encounter, revision, or GM
perspective response. The local current encounter is never serialized into the
command request.

Legacy full responses remain header-gated for rollback compatibility; exact
encounter GET is unchanged. This response migration does not weaken revision,
task, execution-group, initiative-group, effect-cutoff, lineage, source, or
modifier-fingerprint checks. See `active-combat-mutation-response.md`.

## 16. Split first-write conflict conformance

Exact encounter GET and revision polling perform no combat or participant
persistence. Presentation normalization on GET is in-memory only, so initialization,
focus refresh, and Strict Mode requests cannot race the first canonical mutation
as hidden writers.

The split persistence adapter retries only typed Prisma `P2034` failures and
restarts the entire serializable transaction. Every attempt re-reads storage mode
and revision while retaining the command's original expected revision. A committed
competing command therefore becomes `stale_revision`, never a successful replay.
Retry exhaustion becomes the typed `transaction_conflict` response; validation,
authorization, duplicate-command, domain, and other Prisma errors are not retried.

The GM CE control also has a synchronous in-flight guard in addition to its
disabled state. One deliberate action produces one POST even if two click events
arrive before React commits the pending render.

## 17. Observe Opponent V1 conformance

Observe Opponent is a typed secondary action, with a maximum of one secondary action in V1.
Compatibility validation permits it only beside Parry and preserves legacy declarations without
the collection field. Its target belongs to the secondary action rather than any primary attack
context.

The active round owns one ordered observer-to-target relationship. During the completing round's SU
boundary, the domain resolver reads that round's committed declaration and exact attack outcomes; a
hit by the observed target suppresses only that round. A due contest projects one observer-owned
task. Its accepted command resolves the observer's open-ended roll and the hidden target roll
server-side in one revision, using Intelligence-substituted Dodge or close-combat skill profiles.
The relationship alone owns progress, attempts, and best bonus. Modifier contributions are derived
once per explicit opposing pair, so mutual observations coexist without cancellation or duplicated
arithmetic.

Observation-roll and boundary command facts contain compact per-relationship inverse records rather
than prior combat state. The relationship is carried into the next active round and archived with
the completed round. The revision-keyed history round now carries that exact archived relationship
snapshot. Final SU review records one observer-only status event per declared relationship, while
the roll event snapshots both calculations and replaces its pending period result without duplicate
narration. Player-safe active/history projection retains only relationships and results owned by a
controlled observer, including the observer-safe latest attempt, and removes the hidden target
calculation; other participants' Observe declaration context is also suppressed. No client counts
rounds, resolves contests, constructs modifiers, or derives historical calculation facts.

## 18. Canonical GM bulk step completion

The GM workflow selector delegates modifier-review and initiative bulk work to the
`complete_remaining_step` command. Authorization aliases that command to the exact currently
projected review or initiative task; revision, participant, task, execution group, process, stage,
and phase remain descriptor-bound. The route invokes one domain mutation and one revision-guarded
combat persistence call, then returns the authoritative active state and final command envelope.

The domain iterator follows canonical participant order. Modifier reviews accept the current
declaration contexts unchanged and stop before malformed or unresolved declarations. Initiative
uses a bulk-specific eligibility predicate. It records an explicit `bulk_skipped` result with total
zero and no die for GM-owned passive work and for a sole ordinary phase action when initiative
ordering cannot affect another phase action. It stops before player-owned initiative, invalid
declarations, ordered Feint/Adjust Distance work, or competing executable phase actions whose order
is consequential. The command carries versioned compact inverse facts for only touched statuses,
initiative results, and navigation.
Undo removes the one bulk command and restores the exact pre-command task without a recursive state
snapshot. Manual review and roll commands remain unchanged.

## 19. Combat presentation ownership

GM Combat composes Archived Presentation, Active Presentation, Selection
Overlay, and Pending Overlay without creating a second canonical combat model.
Active inspector candidates are keyed to accepted active revision dependencies.
Completed-round inspector candidates are built solely from immutable archived
round participants, snapshots, modifiers, events, results, and calculations.
Historical selection performs an identity lookup and cannot consult current
participant equipment, modifiers, or calculation inputs.

An active revision cannot replace archived inspector identity. Archive
replacement or canonical boundary undo changes archive lineage and therefore
rebuilds the affected immutable candidates. These presentation caches authorize
no command and do not alter descriptor, privacy, history, or undo semantics.
