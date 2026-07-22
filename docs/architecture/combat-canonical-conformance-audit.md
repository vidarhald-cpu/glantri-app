# Combat canonical-conformance audit

Audit date: 2026-07-23

Branch: `feature/player-general-encounter-screen`

Scope: read-only audit of current combat domain, API, and web integration

## 1. Executive summary

The canonical architecture is established and is used by most current combat paths:

- `CombatProgressionProjection` is the authoritative task graph.
- presentation tasks preserve task, execution-group, process, stage, owner, facet, and safe status;
- `CurrentActionPresentation` normally creates one immutable command descriptor;
- current API routes normally compare `Encounter.updatedAt`, authorize a projected task, and validate
  task-specific domain identities;
- tracker live attention is indexed from projected task facets rather than inspector selection;
- player-safe projection retains visible task and completion status while removing private facts.

The repository is not yet fully conformant. The existing
`combat-task-integration-matrix.md` overstates completion. This audit found one P0 authority gap and
several P1 gameplay/conformance defects:

1. Four legacy GM mutation endpoints remain externally callable without revision, task, or
   execution-group authorization.
2. The boundary endpoint validates revision, task, and boundaries, but not execution-group identity.
3. attack, parry, hit-location, and critical routes re-check compatibility cursor state after exact
   projected-task authorization; valid tasks can therefore be rejected by stale compatibility state.
4. ordinary attack opportunity identity is dropped when an attack result is recorded, while later
   stages recover data by participant/phase or “latest snapshot.” This is unsafe groundwork for an
   additional same-phase action such as Attacking Parry.
5. GM declaration/modifier-review submission can bind the canonical task identity to form data from
   the currently inspected participant.
6. ownerless GM tasks sometimes fabricate tracker ownership from `currentCursor`, and Round End UI
   context independently selects an executable SU task instead of following Current Action.
7. weapon/distance modifier normalization is duplicated in API and web and silently falls back to
   the first available weapon.

No P0 path is used by the current main panel according to repository searches, but it remains a
public authenticated mutation surface and therefore an authority violation, not harmless dead code.

**Conclusion:** Attacking Parry should not be implemented next. First close the legacy mutation
routes and make attack opportunity/source lineage survive from task through attack result and all
downstream stages. Otherwise Attacking Parry would add another same-phase opportunity to code that
still assumes participant + phase or “latest result” identifies one attack.

## 2. Confirmed canonical invariants

| Invariant | Result | Evidence |
| --- | --- | --- |
| 1. Live task identity comes only from progression projection | Partial | Task builders are canonical, but `buildCombatRoundEndProcessPlan` uses `currentCursor` to prefer a participant, and legacy API routes derive work solely from cursors. |
| 2. Invocation comes only from `CurrentActionCommandDescriptor` | Partial | Main buttons resolve descriptors, but GM declaration/review and attack payloads still obtain task-sensitive data from inspector/local phase models. Legacy endpoints need no descriptor. |
| 3. API validates exact task and execution group | Partial | `parseCombatTaskCommandIdentity` plus `authorizeCombatTaskCommand` is the normal path. `advance-current-step` does not accept a group, and legacy routes accept neither task nor group. |
| 4. Tracker current ownership comes from required actor and facet | Partial | `buildCombatProgressionTrackerIndex` does this correctly. Several ownerless GM task builders assign `trackerOwner`/`trackerParticipantId` from a cursor or proposal participant. |
| 5. Inspector Current task uses the same task | Partial | `buildCombatRoundLiveInspectorContext` is canonical. `CombatRoundManagerPanel` falls back to cursor-owner/first task and independently chooses an SU task. |
| 6. Result lifetime uses canonical boundary/opportunity identity | Partial | live result lifetime is boundary-based, but normal attack opportunity identity is not retained and orphan event mapping falls back to generic phase placement. |
| 7. UI serializes but does not infer canonical identity | Violated | GM/player attack handlers rebuild source/stats from local loadout and inspector models; distance modifier generation separately resolves by weapon name with a default fallback. |
| 8. Player-safe projection preserves safe status | Conformant in inspected paths | `combatProgressionProjection/presentation.ts` preserves IDs, state, blockers, ownership when visible, and explicit waiting-for-GM state while sanitizing subjects and detail identities. |
| 9. Historical inspection cannot retarget live mutation | Partial | descriptor task identity cannot be retargeted, but inspector-derived form/loadout state can change the values submitted for the descriptor's participant. |
| 10. Missing identity fails closed | Violated | legacy mutation endpoints infer cursor context; attack/damage paths use latest snapshots; distance modifier projection defaults the weapon; boundary group identity is optional/absent. |

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

| Task kind | Status | Audit result |
| --- | --- | --- |
| `submit_declaration` | Confirmed violation | Projection, descriptor, parsing, and authorization are exact. GM submission uses `inspectorDraft`, phase loadout summaries, and generated context without proving those values belong to the descriptor participant. |
| `combat_experience` | Fully conformant | Declaration and A1/A2 triggers are task-bound; phase/opportunity/trigger are recorded; player-safe result facts retain completion. |
| `modifier_review` | Confirmed violation | Task identity is exact, but the shared GM declaration/review handler submits the current inspector draft/loadout for the descriptor participant. |
| `roll_initiative` | Fully conformant | Participant, phase, group, task, revision, actor, and authoritative initiative inputs are checked. Local UI values are calculation input, not task identity. |
| `commit_initiative` | Minor conformance risk | Current endpoint is descriptor-bound, but the ownerless task fabricates tracker ownership from `currentCursor`. |
| `attack` | Confirmed violation | Exact task authorization is followed by `getPlayerCombatCurrentRollAction`; weapon/stat context is reconstructed from local UI and latest phase snapshots. Normal opportunity identity is not persisted on the result. |
| `parry` | Confirmed violation | Descriptor/API identity is exact, but API again requires cursor-derived `getPlayerCombatCurrentRollAction` after authorization. |
| `damage_roll` | Confirmed violation | Task and roll expression are exact, but DMB, defender DM, and armor class are recovered from latest phase snapshots rather than an attack-specific canonical source. |
| `hit_location` | Confirmed violation | Exact attack/result/task/group checks are followed by cursor-derived current-action validation and latest-snapshot damage inputs. |
| `critical` | Confirmed violation | Exact critical identities are validated, then cursor-derived current-action state is required again. |
| `damage_review` | Fully conformant | Both resolution and commit validate exact attack/result/review/group/task identities; editable review rows remain intentional GM input. |
| `double_attack_decision` | Fully conformant | Choice is form input; participant, phase, opportunity, group, task, and revision are descriptor-bound. |
| `feint_attacker_roll` / `feint_defender_roll` | Fully conformant | Current roll routes require exact proposal, participant, group, task, and revision. An adjacent obsolete feasibility route remains a P0 API gap. |
| `feint_commit` | Fully conformant | Proposal and task identities are exact; GM adjustment/review values are intentional command input. |
| Adjust Distance response/adjustment/roll/commit | Fully conformant | Proposal/pair/opportunity/participant identities are validated. GM adjustment participant is editable input but domain-limited to the proposal's attacker/defender. |
| `distance_roll` | Fully conformant | Both player and GM proxy routes authorize exact participant, opponent, pair, proposal, group, task, and revision. |
| `distance_commit` | Minor conformance risk | Mutation is exact. The ownerless task assigns its tracker facet to participant A and GM UI separately chooses a projected SU task. |
| `health_review` | Fully conformant | Participant, health-roll, proposal, group, task, revision, and proxy authority are exact. |
| `participant_review` | Not applicable | This is a process/stage kind, not a currently emitted task. The actual mutation task is `effect_review`. Keeping it in `CombatProgressionTaskKind` is a P3 type/matrix ambiguity. |
| `effect_review` | Fully conformant | Exact active participant, group, task, and revision; ownerless GM mutation is authoritative. |
| `round_end_prepare` | Minor conformance risk | Invocation uses the exact descriptor and is keyed by task + revision. Its tracker participant is fabricated from `currentCursor`. |
| `gm_advance_boundary` | Confirmed violation | Revision/task/current/target boundary checks are strict, but the execution-group ID is neither submitted nor authorized. Some ownerless boundary tasks also fabricate a tracker owner. |

Reload and undo are generally canonical: task IDs are deterministic projections of surviving facts,
and undo removes/reverts the underlying command facts. The important limitation is that task/group
identity is not persisted on commands/events, so audit provenance and exact opportunity lineage rely
on deterministic reconstruction rather than a recorded invocation identity.

## 5. Confirmed violations

### P0 — legacy GM mutation endpoints bypass projected authorization

`apps/api/src/routes/scenarios/encounterRoutes.ts` still exposes:

- `POST .../combat-round/feint-feasibility`;
- `POST .../combat-round/skip-current-action`;
- `POST .../combat-round/advance-current-phase-resolution`;
- `POST .../combat-round/complete-current-phase-resolution`.

The first mutates a proposal by proposal ID. The other three derive participant/phase from
`currentCursor` or `phaseResolutionCursor`. None parses `expectedRevision`, `taskId`, or
`executionGroupId`; none calls projected task authorization. They are GM-only, and current panel
tests assert that the main panel no longer calls some of them, but authenticated GM access is not a
replacement for progression authorization. An external or stale client can still mutate state
outside the canonical task graph.

Required action: delete the obsolete routes/clients if no supported workflow uses them, or require
the exact current descriptor and canonical task rule. Do not retain cursor-derived fallback.

### P1 — boundary command omits execution-group identity

`parseCombatRoundAdvanceBody`, `advanceCombatRoundCurrentStepOnServer`, and
`advanceCombatProgressionBoundary` carry revision, task ID, current boundary, and target boundary,
but no execution-group ID. The domain authorizer resolves a unique boundary task and checks task ID,
so this is not a current broad bypass; it is nevertheless a direct violation of the exact-task/group
contract and makes boundary commands structurally different from all other commands.

Required action: use `parseCombatTaskCommandIdentity`, pass the group, and authorize through the
same command-task helper before applying the boundary transition.

### P1 — canonical authorization is followed by cursor-derived rejection

In `encounterRoutes.ts`, the following routes first authorize an exact projected task and then call
`getPlayerCombatCurrentRollAction`:

- `roll-attack`;
- `roll-parry`;
- `roll-hit-location`;
- `roll-critical`.

The second check is redundant and less authoritative. If compatibility cursor state disagrees with
the projected task, the valid command is rejected. This is the exact class of edge-layer mismatch
the canonical architecture is intended to remove.

Required action: after successful projected authorization, use `authorization.task` and its identity;
retain only task-specific domain validation of immutable facts.

### P1 — attack opportunity/source lineage is dropped and later reconstructed

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

Required action:

1. persist the opportunity ID for every attack result and canonical combat event;
2. persist or resolve the exact declared attack source/mode for that opportunity;
3. have downstream task identities and mutations use that lineage;
4. remove participant/phase and latest-snapshot recovery where exact identity exists.

### P1 — attack invocation reconstructs source and calculations in React

`CombatRoundManagerPanel.rollInspectorPhaseAttack` authorizes the descriptor, then builds the
phase model from `inspectorDraft` and `inspectorPhaseLoadoutSummaries`. Player Combat similarly reads
`phaseCombatLoadoutSummaries`, `selectedActionId`, and a locally resolved target. The descriptor has
no declaration/action ID, weapon source ID, or attack-mode ID.

The server validates raw modifiers and target, which prevents blind trust in the client, but source
selection is still duplicated and can disagree before reaching the server. This is a confirmed
canonical integration violation even where validation fails closed.

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

### P1 — distance modifier source normalization silently defaults a weapon

API `buildCombatActionDistanceModifierInputs` resolves by a normalized weapon name and falls back to
`getDefaultAttackWeaponTemplate`. Web `combatDistanceModifierProjection.ts` independently implements
name matching and falls back to the first candidate weapon. The implementations use different source
sets (API also includes content templates and ready items).

A missing canonical weapon source can therefore become a modifier for an unrelated first weapon,
and GM/web preview can differ from server persistence. This contradicts fail-closed source handling.

Required action: build distance modifiers from the persisted `CombatAttackSourceRef` and one shared
domain resolver. No name or first-weapon fallback should run after declaration commitment.

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

## 8. Duplicate normalization findings

| Concept | Canonical path | Duplicate/risk |
| --- | --- | --- |
| Participant membership/aliases | `session.ts`: `resolveEncounterParticipantMembership`, `resolveEncounterParticipantForViewer`, `resolveEncounterParticipantByRollParticipantId` | web `resolveCanonicalCombatTargetIdentity`; API local `find*ByAlias` wrappers; fallback can collapse encounter/scenario IDs. |
| Pair identity | domain `getCombatDistancePairKey` / distance alias helpers | Most current routes use it correctly; local pair option construction still deserves guard coverage but no conflicting formula was found. |
| Weapon source | persisted `CombatAttackSourceRef`, API `resolveDeclaredWeaponSource` | local phase loadout builders, name-based API lookup, web name-based distance projection, latest attack snapshot. |
| Attack mode | domain `resolvePreferredAttackMode` before commitment; committed source mode afterward | UI phase model may deliberately select a fallback before commitment; live attacks still rebuild mode/source indirectly rather than carrying committed identity. |
| Declaration phase source | `phaseAttackSources` on committed declaration | descriptor does not carry it; API attack path searches phase opportunity and uses snapshot/body weapon facts. |
| Revision comparison | `combatViewRevision.ts` for Player | separate `combatRoundViewState.ts` implementation for GM. |
| Result/proposal identity | deterministic result/proposal ID helpers | ordinary attack opportunity is optional after persistence; legacy orphan event mapper recovers partial identity from command facts. |

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
2. standard attack events/results do not guarantee top-level opportunity identity;
3. some event command records do not retain the authorizing task/group;
4. Round End distance events have incomplete pair/proposal detail for calculation attachment.

The Combat Log remains fiction-facing and does not drive commands. CE remains excluded from it.
Current-step result lifetime is based on accepted projection boundary and active-round events; no
current latest-result priority chain was found in that projection.

## 10. Recommended cleanup slices

### Slice 0 — close authority bypasses (required first)

- remove or canonically authorize the four P0 legacy routes;
- remove unused web client exports and route tests that preserve obsolete behavior;
- add an assertion that every supported live combat mutation route parses exact task identity, with
  explicit allow-list exceptions for administrative distance edit and undo.

Risk: medium because old bookmarks/tests or undocumented GM tooling may still call the endpoints.

Non-goal: changing rules represented by current canonical tasks.

### Slice 1 — canonical attack lineage (required before Attacking Parry)

- persist opportunity ID for every attack result/event;
- bind committed declaration/action/source/mode identity to the attack task/descriptor or resolve it
  server-side from the exact opportunity;
- make downstream parry/location/critical/damage tasks inherit this lineage;
- remove participant+phase and latest-snapshot source recovery.

Risk: high but bounded to attack identity and replay compatibility.

Non-goal: formulas, damage tables, parry legality, or Attacking Parry itself.

### Slice 2 — remove compatibility authorization shadows

- delete post-authorization `getPlayerCombatCurrentRollAction` checks;
- use the returned authorized task as the only live command context;
- retain domain fact validation and duplicate-roll checks.

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

### Slice 5 — consolidate normalization and legacy event fallbacks

- move committed weapon/source resolution into domain/shared API input;
- remove first-weapon/name fallbacks from live modifier generation;
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

## 12. Attacking Parry readiness conclusion

Attacking Parry should **not** proceed immediately.

Minimum prerequisites:

1. close or descriptor-bind the P0 legacy mutation routes;
2. make boundary authorization include execution-group identity;
3. persist exact opportunity and committed attack source/mode for all attacks;
4. remove cursor-derived post-authorization checks from downstream attack routes;
5. prove with a multi-opportunity test that attack, response, result, and damage lineage do not use
   participant + phase or latest-result lookup.

After those items, Attacking Parry can be added as another projected process/task without extending
the current ambiguity. Ownerless tracker cleanup and normalization consolidation should follow soon,
but they do not independently block the domain design once exact attack lineage is guaranteed.
