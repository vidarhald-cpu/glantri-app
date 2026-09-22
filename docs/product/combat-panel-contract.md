# Combat Panel Contract

## 1. Overall Principles

### Function

- Players roll for their own characters.
- The GM may roll as proxy when the rules or table need it.
- The GM can review, override, commit forward, and clear backward within the active round.
- The inspector must show progress: what is pending, what is rolled or submitted, and who owes action.
- Player choices and results that are private must stay private until the relevant GM commit point.
- Shared and pairwise systems are not owned by one participant merely because they are displayed during that participant's review.

### UI

- Panels show the minimum needed for the current decision.
- Action panels do not become rule encyclopedias.
- Read-only facts stay compact and close to the choice or result they affect.
- Global and pairwise review belongs in shared sections, not repeated inside every participant unless the repetition has a clear task purpose.
- Tracker markers must have explicit meanings.
- If a player owes a roll or action, Player Combat must show that action directly instead of only saying "Waiting for GM."

### Architecture

- Command-backed actions own state changes.
- Result panels display command facts and must not recompute authoritative outcomes from current mutable state.
- Declaration modifiers are generated on declaration or modifier commit, not hidden later in attack resolution.
- Attack resolution consumes visible, persisted modifiers.
- When multiple snapshots exist, the canonical state source must be named before wiring UI.
- When rendering a panel, the parent component must identify the canonical source for the selected context before projecting display state.
- Stale scenario participant state, live participant snapshots, declaration combat context, command facts, and historical command snapshots must not be mixed without an explicit precedence rule.
- Current views show current mutable state. Historical views show stored command, declaration, or result facts from the inspected point in time.
- A panel must not silently combine current character state with historical combat results.
- Each new command must define Clear and undo behavior.
- GM and player views may share components, but permission and visibility rules belong in the parent panel or explicit helpers.

## 2. GM Combat Round Manager

- Purpose: the authoritative encounter command and review surface for the active combat round.
- GM-managed combat work should be categorized before implementation:
  1. **Pool-based steps** collect equivalent inputs from multiple participants before the GM resolves and advances. Examples: declarations and initiative rolls.
  2. **Sequential opposed steps** resolve participants in a defined order. Later actions in the same combat step may depend on earlier results. Examples: attack, parry, hit location, damage, and effect setting.
  3. **Player-rolled review steps** are not order-sensitive, but players still roll for their own character effects while the GM reviews and overrides. Examples: health checks for bleed or other ongoing effects.
  4. **GM-only review steps** adjust combat state without player rolls. Players observe relevant changes on their own screens. Examples: GM distance overrides, manual status changes, and combat-state corrections.
- New combat features must identify which category they belong to before UI, command, or tracker behavior is added.
- The GM can inspect every participant, including hidden or pending declarations where the current rules allow GM knowledge.
- The GM can proxy declarations, movement choices, rolls, clears, and round-end commits.
- The GM can clear or undo active-round commands through supported command paths.
- The GM can set and review global and pairwise state, including distance.
- The GM Combat inspector must show progress and blockers before the round advances.
- The GM may see private player choices before public commit, but the UI must not leak those choices into Player Combat.
- Shared systems such as pairwise distance control may be displayed while one participant is selected, but the GM panel must treat them as shared round state.
- Required player-owned rolls must not be hidden behind one GM-only button unless that button is explicitly a GM proxy roll.
- Current examples: the distance matrix is GM-editable pairwise state; combat modifiers are reviewable participant state; round distance control is pairwise round-end state.

## 3. Player Combat

- Purpose: the player's command surface for their own eligible combat choices and rolls.
- A player declares their own action, phase choices, and movement or distance preferences when permissions allow it.
- A player rolls their own eligible attack, parry, damage, skill, and round-end rolls.
- A player sees their own pending choices, submitted declarations, roll results, and current public facts.
- A player does not see other participants' hidden declarations, CE choices, back-out choices, or distance preferences before the commit point that makes them public.
- If the player owes a roll or action, Player Combat must show the action.
- "Waiting for GM" is correct only when no player-owned action is pending.
- GM proxy results for the player's character may be shown when they become part of the visible command history.

## 4. Action Selector and Shared Phase Panels

### Action Selector

- Purpose: the player's round-level action declaration surface.
- Actions are chosen only in the Action Selector during declaration or permitted declaration review.
- The primary action may determine which secondary dropdowns, phase panels, target fields, weapon fields, movement fields, and notes are relevant.
- The open text area is for player-to-GM intent, table notes, and exceptions that structured fields do not capture.
- Open text is private to the declaring player and GM unless a combat action explicitly makes it public.
- The Action Selector stores intent; it does not resolve rolls, damage, or round advancement.

### Shared Phase Panels

- Purpose: compact display and permitted editing of phase-specific details for the selected round action.
- Phase panels belong to the selected action and show how that action applies in phase 1 and phase 2.
- Phase panels may collect action-specific choices such as opponent, weapon, shield, attack location intent, parry source, and distance preference context.
- Phase panels show facts needed before commit, including offensive values, defensive values, target, weapon, shield, and read-only distance to target.
- Phase panels may be editable only when the parent panel grants edit permission.
- GM Combat may use the same phase component with broader permissions.
- Player Combat may use the same phase component with player-scoped permissions.
- Phase panels do not own sequencing, privacy, command persistence, or round advancement.
- When inspecting history, phase panels show the values as they were when the relevant action was committed or rolled, not the current mutable character state.
- Historical phase panels must show a compact history marker such as `History` or `Previous` so users know they are not looking at the current editable state.

## 5. Combat Modifiers Panel

- Purpose: display the modifier buckets that apply to the selected participant and selected phase context.
- The canonical input is the current persisted or explicitly projected combat context selected by the parent panel.
- The panel has two sources of modifiers:
  1. **Persisted character effects** from the character or participant state, such as wounds, fatigue, ongoing effects, and other character-sheet consequences.
  2. **Situational combat effects** from declarations and combat events, such as action-generated modifiers, Combat Experience results, back-out effects, distance modifiers, and other round-scoped effects.
- Character-state changes should appear immediately when the inspector is showing current state.
- Generated declaration modifiers appear after declaration or modifier commit.
- Distance modifiers follow the same lifecycle as action-generated modifiers.
- Attack resolution consumes the visible persisted Skill/OB, DB/Parry, and related modifier buckets.
- When the inspector is at the current point in the active round, the panel shows current modifiers.
- When inspecting history, the panel shows the modifiers as they were at the end of the inspected action or step.
- Historical modifier views must show a compact history marker such as `History` or `Previous`.
- The panel must not hide committed declaration modifiers behind stale participant snapshot state.
- Manual modifier edits are explicit commands or edits.
- Generated rows should identify their source, duration, value, and details without turning the panel into a rules document.

## 6. Tracker / Timeline

- Purpose: visualize round progress, blockers, and navigation targets.
- Selecting a tracker cell is inspection or navigation, not automatically a command.
- Markers must be documented by meaning in code, title text, or nearby UI affordance.
- Pending player-owned rolls should have visible markers, such as `?` or a pending count.
- A marker must clear when the blocking action is submitted, rolled, cleared, or superseded.
- Tracker state may point the GM to a command surface, but the tracker should not own command logic.
- Completed prior rounds are read-only except for explicit supported review flows.

## 7. Action Result Panel

- Purpose: display command facts, roll outcomes, and calculation details for completed actions.
- The data source is the command result or stored command facts.
- The panel should not recompute authoritative results from current mutable state.
- The panel may format calculation details for readability.
- The panel should keep naturally connected results together. For example, an attack sequence may include attack, parry, location, damage, and effects until a later result needs the panel.
- The GM sees full calculations and command facts allowed by the GM role.
- A player sees full calculations for their own character's rolls and outcomes.
- A player sees outcome-level information for other visible participants, such as hit, miss, parried, initiative sequence, movement outcome, damage outcome, or committed distance change.
- A player does not see hidden opponent calculations, hidden modifiers, or private choices before the relevant commit point.
- The panel should show enough detail to audit the player's own modifiers, rolls, target values, and final outcomes.
- If a command used a generated modifier, the result should explain the consumed modifier through command facts.

## 8. Action Button Area

- Purpose: expose the single primary action for the current inspector state.
- The Action Button Area is for the next command, not for explaining prior results.
- Results, roll breakdowns, and outcome notes belong in the Action Result Panel unless they are needed to choose the next command.
- The area contains one dominant action button whose label states exactly what it will do, such as `Declare combat action`, `Roll phase 1 initiative`, `Roll distance control for The Gladiator`, or `Commit damage review`.
- When the current task needs a selection before the action, place the required selector above the button.
- The area above the button may contain only controls needed for the next action, such as review choices, override dropdowns, target confirmation, or distance-control selection.
- The area below the button explains the current action state and confirms completion, such as `Declared`, `Rolled`, `Pending`, or `Waiting for GM commit`.
- Avoid competing primary buttons inside review bodies. Progress lists may show status for multiple participants, but the selected/current task determines the primary action button.
- If one task has multiple possible outcomes, use a selector or dropdown to choose the outcome, then use the single primary action button to commit it.
- A separate Save button is allowed only for GM review/edit flows where the GM saves draft modifier or review changes, reviews them again, and later uses the primary action button to commit and advance.
- Player-owned choices such as `Roll CE` versus `Back out` should be selected through the task controls, then committed through the primary action button.
- GM proxy actions should use the selected/current participant or clearly state whose roll the GM is proxying.

## 9. Round-End / SU Review

- Participant SU owns participant-specific end-round effects such as bleed, duration changes, health changes, and status review.
- Shared and pairwise systems are round-level or pair-level state.
- Pairwise distance control may be displayed during SU, but it is not owned by one participant.
- Each pairwise distance-control item resolves once per unordered pair per round.
- Player-owned round-end rolls must surface in Player Combat.
- GM Combat must show who still owes round-end rolls and which shared results are ready to commit.
- The GM commits shared round-end results after required rolls and reviews are complete.
- Round-end distance changes affect the next round and must not retroactively alter current-round attack modifiers.

## 10. Combat State / Character Reference Panels

- Purpose: read-only reference for the selected character or participant.
- These panels may show stats, equipment, skills, armor, and derived combat state.
- These panels are not round command surfaces.
- These panels should not contain hidden sequencing, mutation logic, or command side effects.
- Reference panels may explain where a number comes from, but they do not decide combat lifecycle.

## 11. Implementation Checklist

- Which panel owns this behavior?
- Who may act: player, GM proxy, or GM only?
- Who may see it before commit?
- What is the canonical state source?
- Which command changes state?
- What does Clear or undo do?
- Is this declaration, initiative, attack, parry, damage, SU, or round-level state?
- Which GM work category is this: pool-based, sequential opposed, player-rolled review, or GM-only review?
- Does the tracker need a marker?
- Does Player Combat show the action if the player owes it?
- Does the Action Button Area have one clear primary action for the selected/current task?
- Are results and calculation notes kept out of the Action Button Area unless needed for the next command?
- If multiple outcomes are possible, are they selected through controls rather than competing action buttons?
- Is any extra Save button limited to a GM review/edit draft flow?
- If this is a historical view, do phase panels and modifiers show history markers and historical values?
- Does the result panel read command facts rather than recomputing?

## 12. Consolidating Actions and tasks into the Combat Inspector

Recorded 2026-09-22 from the Product Owner specification in Forgejo issue #287, against
`dev` at `c2c0f2a96f86d12686a325d173ef57d12704d781`. This section extends the panel
ownership rules in sections 1-11; it does not restate them, and it changes no decision
already recorded above.

This is **composition and routing**. It is not authorization to redesign Combat. Where a
capability cannot be routed without changing a panel's meaning or the combat domain, this
section records the conflict in
[12.6 Returned contract mismatches — unresolved](#126-returned-contract-mismatches--unresolved)
and stops there.

### 12.1 The Round Manager is retained

The Combat Round Manager remains. It is fundamental shared board-game state showing round,
phase and participant progression, and it is not removed, replaced or redesigned by this
work. Its purpose is unchanged from [section 2](#2-gm-combat-round-manager) and
[section 6](#6-tracker--timeline). Player Play V1 records the same retention for the player
round tracker in
[Player Play V1 section 10.1](../architecture/player-play-v1.md#101-round-tracker).

### 12.2 The standalone Actions and tasks surface is removed

`GenericCombatActionPanel` (`apps/web/src/features/combat-generic-actions/GenericCombatActionPanel.tsx`)
renders a second, parallel action system. Its heading is `Actions and tasks` for the GM and
`Items and task history` for the player. It is rendered above the Combat Inspector in
`apps/web/src/features/combat-round-manager/CombatRoundManagerPanel.tsx` and in
`apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent.tsx`,
and it embeds `CombatItemInteractionPanel` and `EncounterItemsPanel`.

It must stop existing as a separate action system. Its capabilities belong to the Combat
Inspector panels already contracted above, entering through the approved declaration path
rather than a parallel action channel. The Combat Inspector's form and layout stay
substantially as they are.

**Generic task and action functionality enters through the approved Perform Task or other
appropriate declaration path.** A second declaration channel is not reopened because a
control does not fit.

### 12.3 Panel destinations

These restate no panel's purpose; they name which existing contract receives the work.

| Destination                                                                 | Receives                                                                                                                    | Still must not own                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Action selector ([section 4](#4-action-selector-and-shared-phase-panels))   | Declaration input: primary action, secondary action, movement and facing, conditional declaration fields, declaration notes | Roll resolution, damage, round advancement |
| Phase 1 / Phase 2 ([section 4](#4-action-selector-and-shared-phase-panels)) | Their existing combat, loadout and calculation role                                                                         | Unrelated task authoring                   |
| Combat situation ([section 5](#5-combat-modifiers-panel))                   | Current combat state, modifiers, planning information                                                                       | Action entry                               |
| Current action ([section 8](#8-action-button-area))                         | What the current step requires, and the commit/declaration/resolution command for that step                                 | Explanation of prior results               |
| Current step results ([section 7](#7-action-result-panel))                  | The result of the current step                                                                                              | Declaration controls                       |
| Combat Log ([section 7](#7-action-result-panel))                            | Accepted Combat outcomes and events under its existing contract                                                             | Draft declarations or raw calculations     |
| Round Manager ([section 2](#2-gm-combat-round-manager))                     | Shared progression and tracking, unchanged in purpose                                                                       | Command logic belonging to a panel above   |

Item and Encounter context presented today inside Actions and tasks becomes **context
supplied to the correct existing declaration path**, not another action system.

### 12.4 Capability mapping

Derived from the code at the recorded baseline. Line numbers are orientation, not contract.

| Current capability                                                                | Current implementation site                                                                                                              | Destination panel                   | Existing governing contract                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intent text, `What do you intend to do?`                                          | `GenericCombatActionPanel.tsx:433`                                                                                                       | Action selector                     | Perform Task `description` (max 2000) in `packages/domain/src/encounter/combatDeclarationIntent.ts`; rendered as `Task description` in `apps/web/src/features/player-combat/PlayerCombatPanels.tsx`                                                                                      |
| Generic action preset `look_around` / `other`                                     | `GenericCombatActionPanel.tsx:416`                                                                                                       | Action selector                     | Primary/secondary action ids in `packages/domain/src/encounter/combatDeclarationCompatibility.ts` — see [M1](#126-returned-contract-mismatches--unresolved)                                                                                                                              |
| Duration: one phase / one round / several rounds / GM decides                     | `GenericCombatActionPanel.tsx:443-479`                                                                                                   | Action selector, conditional        | No declaration-intent field exists — see [M2](#126-returned-contract-mismatches--unresolved)                                                                                                                                                                                             |
| Roll basis (none / Skill / Stat), Skill, Stat, Difficulty                         | `GenericCombatActionPanel.tsx:480-535`                                                                                                   | Action selector, conditional        | Held only on `CombatGenericAction` (`packages/domain/src/encounter/combatGenericAction.ts`) — see [M2](#126-returned-contract-mismatches--unresolved)                                                                                                                                    |
| Reference: participant / Item / environment                                       | `GenericCombatActionPanel.tsx:536-583`                                                                                                   | Action selector, conditional        | `combatGenericActionReferenceSchema` in `packages/domain/src/encounter/combatGenericAction.ts` — see [M2](#126-returned-contract-mismatches--unresolved)                                                                                                                                 |
| `Declare generic action` submit                                                   | `GenericCombatActionPanel.tsx:584`; POST `/encounters/:id/combat-round/generic-actions`                                                  | Current action                      | `submit_declaration` descriptor in [Combat task integration matrix](../architecture/combat-task-integration-matrix.md) — see [M3](#126-returned-contract-mismatches--unresolved)                                                                                                         |
| Action and task history selector and read-only detail                             | `GenericCombatActionPanel.tsx:594-683`                                                                                                   | Combat Log                          | `packages/domain/src/encounter/combatLogProjection.ts` — see [M4](#126-returned-contract-mismatches--unresolved)                                                                                                                                                                         |
| GM review adjustments (duration, roll, Skill, Stat, Difficulty, reference)        | `GenericCombatActionPanel.tsx:684-868`                                                                                                   | Action selector under GM permission | Permitted declaration review, [section 4](#4-action-selector-and-shared-phase-panels); GM draft/commit split, [section 8](#8-action-button-area) — see [M5](#126-returned-contract-mismatches--unresolved)                                                                               |
| Lifecycle commands: Start action, Roll, Resolve, Interrupt, Cancel                | `GenericCombatActionPanel.tsx:870-941`                                                                                                   | Current action                      | Current combat-step command, `CombatRoundCommandType` in `packages/domain/src/encounter/combatRoundManager.ts` — see [M3](#126-returned-contract-mismatches--unresolved)                                                                                                                 |
| Player-safe result text and `Who receives this result?` audience                  | `GenericCombatActionPanel.tsx:887-921`                                                                                                   | Current action, then Combat Log     | Outcome visibility, [section 7](#7-action-result-panel); projection authority, [Product & Presentation Principles 4.5](./product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility) — see [M6](#126-returned-contract-mismatches--unresolved) |
| Item operations: draw/ready, drop, pass/give, pick up, stow/unequip, use/interact | `apps/web/src/features/combat-generic-actions/CombatItemInteractionPanel.tsx:198`; POST `/encounters/:id/combat-round/item-interactions` | Action selector, secondary action   | Secondary `equip_unequip` / `small_action` in `combatDeclarationCompatibility.ts`, versus `combatItemInteractionOperationSchema` — see [M7](#126-returned-contract-mismatches--unresolved)                                                                                               |
| Pass recipient and per-Item intent detail                                         | `CombatItemInteractionPanel.tsx:158-197`                                                                                                 | Action selector, secondary action   | As above — see [M7](#126-returned-contract-mismatches--unresolved)                                                                                                                                                                                                                       |
| Encounter Item presence: add, remove, Players / GM only visibility                | `apps/web/src/features/encounters/EncounterItemsPanel.tsx:99-191`; PUT `/encounters/:id`                                                 | Not a Combat Inspector panel        | `encounterItemReferenceSchema` (presence and audience only) in `packages/domain/src/encounter/session.ts` — see [M8](#126-returned-contract-mismatches--unresolved)                                                                                                                      |
| Player `Items and task history` read-only view                                    | `ScenarioPlayerCombatPageContent.tsx` player render of `GenericCombatActionPanel`                                                        | Combat Log                          | Combat Log contract, [section 7](#7-action-result-panel) — subject to [M4](#126-returned-contract-mismatches--unresolved)                                                                                                                                                                |

Perform Task already materializes a `CombatGenericAction` server-side in
`apps/api/src/routes/scenarios/encounterRoutes.ts`, and the secondary equivalent
materializes `small_action`. Declarations and the generic-action record therefore already
meet; the mismatches below are about which fields and which commands that meeting carries.

### 12.5 Reference panels and the surface that becomes redundant

Once 12.4 is routed, `GenericCombatActionPanel` has no remaining responsibility and is the
surface that becomes redundant. `EncounterItemsPanel` does not, because it is also rendered
outside Combat in `apps/web/src/features/roleplay/RoleplayEncounterScreens.tsx`; only its
Combat embedding is in scope.

### 12.6 Returned contract mismatches — unresolved

These are genuine conflicts between two existing contracts, or capabilities with no clean
existing destination. They are recorded, not resolved. Each requires a Product Owner
decision before the affected row in 12.4 may be implemented. **Do not invent semantics to
make a control fit.**

- **M1 — `look_around` has no declaration identity.** The preset selects a static
  Perception roll, but there is no `look_around` primary action id. The nearest existing
  concept, `observe_opponent`, is primary-ineligible and is selectable only as a typed Parry
  secondary declaration with an independently persisted participant target, per the
  declaration-context ownership rule in
  [Combat task integration matrix](../architecture/combat-task-integration-matrix.md).
  Routing `look_around` to either would change a declaration's meaning.
- **M2 — Perform Task carries no rule inputs.** The Perform Task declaration path records
  only `actionId`, `description` and `taskId`, and materializes a generic action with a
  fixed `gm_decided` duration. Duration, roll basis, Skill, Stat, Difficulty and reference
  exist only on the `CombatGenericAction` record and are reachable only through GM review
  after declaration. Carrying them on the declaration would extend the declaration intent
  contract; leaving them behind would lose the capability.
- **M3 — generic actions are not progression tasks.** `CombatGenericAction` lifecycle
  operations (declare, review, activate, roll, resolve, interrupt, cancel) are not
  `CombatRoundCommandType` values, project no task, and appear nowhere in the
  [Combat task integration matrix](../architecture/combat-task-integration-matrix.md). The
  Current action panel owns the _projected_ current step and its descriptor-bound command.
  Routing these commands into Current action requires the combat domain to project generic
  tasks — a subsystem change, excluded by 12.8.
- **M4 — the Combat Log cannot currently show tasks.** `buildCombatLogProjection` is built
  from `CombatStepEvent` records. Generic actions emit none. A resolved task therefore has
  no event to log, and the history selector cannot simply move into the Combat Log without a
  new event source.
- **M5 — two contracts plausibly own GM declaration review.** Section 4 gives the Action
  Selector "permitted declaration review"; section 8 allows a GM draft Save separate from
  the primary commit button. The GM review fieldset is both. Which panel owns it decides
  whether a second Save button appears inside the Action Selector.
- **M6 — per-result audience authoring has no contracted home.** The GM composes
  player-safe result text and selects recipients. Current step results must not own
  declaration controls; the Combat Log must not own draft state; Current action is the next
  command, not prior results. The capability is also a privacy control and cannot be dropped.
- **M7 — Item interaction is governed by two contracts at once.** The same act is expressible
  as a secondary declaration (`equip_unequip`, `small_action`) and as a
  `combatItemInteractionOperationSchema` operation on its own route with its own
  `expectedItemRevision` guard. Both plausibly own it; they carry different authority and
  different undo behaviour.
- **M8 — Encounter Item presence is not combat declaration context.** Adding, removing and
  changing the audience of Encounter Items authors encounter state. Section 10 reference
  panels are read-only and are explicitly not command surfaces, so there is no Combat
  Inspector panel that may receive it. Its canonical home is an Encounter authoring surface,
  which this section does not define.

### 12.7 Logging and the Activity projection

**Do not introduce another independent log.** Detailed canonical Combat history is preserved;
what changes is which projection publishes what.

- **Situation Activity** carries concise, player-safe, narratively meaningful outcomes: GM
  announcements, meaningful visible events, concise Skill and Combat outcomes, and important
  visible state changes.
- Situation Activity **must not** carry routine process noise: round and phase bookkeeping,
  declaration and review steps, routine round-end persistence updates, raw calculations, or
  debug and reconciliation events.
- **Action and Combat detail** may retain detailed outcome and calculation appropriate to the
  player. **GM audit and history** may expose more detailed authorized records.

> **Privacy and narrative selection are enforced in the projection and at the data boundary,
> not by hiding fields client-side.**

This is binding, not advisory. An implementation satisfies it only if the excluded events are
**not written into, or not selected by, the Activity projection on the server**. Filtering an
already-published Activity payload in a React component, in a view-model, or in any code that
runs after the payload leaves the API does **not** satisfy it, even when the rendered result
looks correct and every gate passes. The governing principle is
[Product & Presentation Principles 4.5](./product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility):
client-side hiding is not an adequate privacy boundary. The QA failure on issue #271 turned on
exactly this class of defect, with all gates green, and that precedent applies here.

At the recorded baseline the data boundary does not yet meet this rule:

- `packages/database/src/services/encounterService.ts` forwards **every** new `CombatStepEvent`
  as an Activity `objectiveEvent`, and
  `packages/database/src/repositories/encounterRepository.ts` writes each one as an
  `encounter_combat_outcome` row whose summary is derived mechanically from the event type.
  `declaration`, `modifier_review`, `round_boundary`, `combat_experience`, `initiative`,
  `damage_proposed`, `participant_su_review`, `effect_review` and the feint, break-off,
  adjust-distance and disarm intermediates are all included. This is the round and phase
  bookkeeping the rule excludes, and it is already persisted.
- `projectScenarioObjectiveHistory` in `packages/domain/src/campaign/scenarioSession.ts` filters
  by event **type** and by viewer entitlement. It does not narrow within
  `encounter_combat_outcome`, so the bookkeeping passes through.
- Conversely, `CombatGenericAction` lifecycle operations record only an `encounter_updated`
  event, which is not an allowed Activity type and is therefore dropped for every viewer. A
  resolved task — a narratively meaningful outcome — currently reaches Activity not at all.

> **Correction, recorded 2026-09-22 and confirmed by the control plane on Forgejo issue #287.**
> The sentence immediately above is **true for Perform Task and false for Item interactions.**
> `packages/database/src/services/combatItemInteractionService.ts` already writes an
> `encounter_combat_outcome` row carrying `eventKind: "item_resolution"`, a GM-authored
> player-safe summary and an audience intersected from the interaction and its resolution, with
> `canViewCurrentItemOutcome` in `packages/domain/src/campaign/scenarioSession.ts` re-verifying
> entitlement at projection time. **That is a working, tested template, and the publication half
> of [A2](#1213-a2--player-safe-activity-projection) follows it rather than redesigning it.**

That last point is the sharper constraint. The 2026-09-22 Product Owner ruling on Forgejo
issue #284 (comment 7792) makes the player-safe Activity projection the **exclusive** source
for an AI session summary. It follows that **anything that ought to appear in a session recap
must exist as a player-visible Activity event.** Narrowing Activity to remove process noise
must therefore be paired with publishing the meaningful task and Item outcomes that Activity
does not carry today; narrowing alone would make the recap source poorer, not cleaner. The
ruling is cross-referenced, not restated.

Activity remains one event model with several projections, per
[Player Play V1 section 9.2](../architecture/player-play-v1.md#92-the-visibility-rule).

### 12.8 Exclusions

This work does not authorize: replacing the Combat Inspector; redesigning the Action Selector;
redesigning Phase 1 or Phase 2; redesigning Combat Situation; replacing the Round Manager;
adding new Combat rules; or implementing Player Play navigation or composition.

If the mapping in 12.4 cannot be achieved without redesigning a panel, it is returned under
12.6 rather than designed.

### 12.9 Player Play integration boundary — record only

Recorded so that later composition work is not surprised by it. **No relocation is performed
or designed here.**

When Player Play composition reaches Action, general Character information currently
duplicated around and below Combat should move to the Play Character view where appropriate.
Only combat-specific planning information is preserved in Combat situation. Full Character,
Physical State, Skill tables and equipment management remain in their canonical
Character and Campaign locations with click-throughs.

That side is already governed by
[Player Play V1 section 10](../architecture/player-play-v1.md#10-action-composition) and its
[canonical-detail and click-through rule](../architecture/player-play-v1.md#13-canonical-detail-and-click-through-rule).
Those decisions are cross-referenced, not duplicated or reopened.

### 12.10 Proposed bounded implementation slice

Proposed only. Not authorized and not dispatched by this section.

**Slice 287-1 — retire the standalone surface for the player.**

- **Outcome visible to the player:** the player's Combat screen no longer shows a second
  `Items and task history` block above the Combat Inspector. The same task and Item history is
  reachable from the existing Combat Log area inside the Inspector. Nothing the player can do
  changes; one duplicated surface disappears.
- **Reused, by path:** `apps/web/src/features/combat-history/components/CombatLog.tsx`;
  `apps/web/src/features/combat-generic-actions/GenericCombatActionPanel.tsx` (its read-only
  player branch only); `apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent.tsx`.
  No new route, no new client, no new component family.
- **New glue:** placement of the existing read-only history beside the existing Combat Log,
  and removal of the player render of `GenericCombatActionPanel`.
- **Out of scope:** every row in 12.4 that references a mismatch M1-M8; the GM surface; the
  Activity projection; `EncounterItemsPanel`; `CombatItemInteractionPanel`.
- **Dependencies:** none. It is blocked by no mismatch because it moves no declaration and no
  command.
- **Hotspots,** per [reserved integration hotspots](../architecture/ownership.md#reserved-integration-hotspots):
  none of the reserved hotspots are written. `ScenarioPlayerCombatPageContent.tsx` and
  `CombatRoundManagerPanel.tsx` are not reserved but are heavily contended Combat experience
  surfaces; issues #180 and #182 both claim `CombatRoundManagerPanel.tsx`, and #180 is under an
  explicit stop. This slice must therefore be serialized against those lanes, and must not
  touch `CombatRoundManagerPanel.tsx` beyond removing one render.
- **Persistence or schema changes:** none. No migration, no stored-data semantics, no
  authorization change.
- **Character:** composition and thin adaptation. It requires no subsystem redesign.
- **QA level:** ordinary independent immutable-head QA. The mandatory QA floor in
  [AGENTS.md](../../AGENTS.md#mandatory-qa-floor) is not engaged by this slice, and the floor
  is not downgradable for any later slice that is.

**What cannot yet be sliced.** The GM Actions and tasks surface, the Item interaction routing
and the Encounter Item presence surface all depend on M1-M8 and must not be implemented before
those decisions. The Activity projection work in 12.7 changes persisted event semantics and a
privacy projection, so it is **floor class** under
[AGENTS.md](../../AGENTS.md#mandatory-qa-floor): full adversarial independent QA at the
strongest reasonably capable model, in a visible dedicated QA session, non-downgradable. It is
also coupled to the #284 exclusive-source ruling and should not be narrowed without the
matching publication of meaningful outcomes.

### 12.11 The four convergence contracts — status and reading order

Recorded 2026-09-22 against `dev` at `c7ec1800df48a5f375088322b0feec122cab8a87`, under the two
Product Owner rulings on Forgejo issue #287 — _M3/M4 domain change authorized in principle;
A1/A2/A3 decomposition required_ and _A1 QA class, Perform Task timing, A2-Q1, M7 and M8
settled_ — the ruling _M5 and M6 settled_, and the control-plane decomposition analysis that precedes
them. **Those rulings are authoritative and are cross-referenced, not re-decided.**

**All eight mismatches M1-M8 are now resolved or ruled, and issue #287 carries no remaining open
Product Owner question.** These contracts therefore hold no open-decision section.

**These are task contracts, not authorization.** Nothing here is dispatched. Each contract
becomes executable only after a Forgejo issue body carries it through the canonical
[task contract](../process/task-contract.md) lifecycle to `Authorized` and the control plane
approves the final decomposition.

They **extend** [12.4's mapping](#124-capability-mapping) and
[12.6's mismatches](#126-returned-contract-mismatches--unresolved). They introduce no competing
Combat architecture, and [12.8's exclusions](#128-exclusions) govern all four: no Combat
Inspector replacement, no Action Selector, Phase 1/2 or Combat Situation redesign, no Round
Manager replacement, no new Combat rules.

| Contract                                          | Character                        | QA class        | Depends on                           |
| ------------------------------------------------- | -------------------------------- | --------------- | ------------------------------------ |
| [A1](#1212-a1--combat-task-lifecycle-convergence) | Combat domain subsystem change   | **Floor class** | none of M5-M8                        |
| [A2](#1213-a2--player-safe-activity-projection)   | Data-boundary and privacy change | **Floor class** | A1 (for `task_resolved`)             |
| [M7](#1214-m7--item-interaction-authority)        | Declaration/service seam         | **Floor class** | A1                                   |
| [A3](#1215-a3--ui-consolidation)                  | Composition and routing          | Ordinary        | A1, A2, M7, parity matrix, M8 access |

**Relationship to [12.10's slice 287-1](#1210-proposed-bounded-implementation-slice).** That
slice relocates the existing read-only player component verbatim and therefore keeps
`GenericCombatActionPanel`'s read-only branch alive. It is cosmetic de-duplication, **not the
retirement**, and its "blocked by no mismatch" claim holds only under that reading. Retirement
belongs to A3 alone. If 287-1 runs, it serializes with A1/A2/M7/A3 like everything else in
[12.16](#1216-serialization-hotspots-and-merge-order).

**Introduce-then-retire governs the whole set.** No surface is removed before replacement parity
is demonstrated on the surface that replaces it.

---

### 12.12 A1 — Combat task lifecycle convergence

**Outcome.** A declared Perform Task is a first-class Combat task for its whole life. The GM and
the owning player drive it from the Combat Inspector's Current action panel at the actor's normal
primary-action opportunity, its required Skill, difficulty, timing and context semantics survive,
and resolving it emits canonical Combat outcome data the Combat Log projects. The parallel
generic-action channel stops being the only way a task can be advanced.

**Settled input this contract builds on, and must not re-decide.** Perform Task is a **normal
primary action**. It uses the **same initiative ordering and action opportunity as other primary
actions** and has **no parallel generic-action clock**. A one-round task resolves at the actor's
normal primary-action opportunity; an **N-round task advances once at that corresponding
opportunity in each round and completes after N advances**; GM adjudication may interrupt or rule
feasibility. This settles the question the control-plane analysis returned as A1's largest risk:
`combatGenericActionDurationSchema` maps onto the actor's own primary-action opportunity, **not
onto a separate boundary model**, and `COMBAT_ROUND_STEPS` reasoning in
`canCompleteCombatGenericAction` is not a second timing authority.

#### Scope

In scope:

- Project an active `CombatGenericAction` as a combat task at its owner's primary-action
  opportunity, so Current action can render and authorize it.
- New `CombatRoundCommandType` members for the task lifecycle, with matching
  `CombatStepEventType` members and descriptor authorization entries.
- Event emission on resolution, plus **compact versioned inverse undo facts**. Full
  `CombatRoundState` snapshots are forbidden for new commits by the
  [integration matrix](../architecture/combat-task-integration-matrix.md).
- A `CombatLogSummaryFacts` variant for the resolved task.
- Converge the parallel route so it authorizes on task and boundary identity rather than an
  arbitrary client-supplied action id, closing the **second creation path**.
- Rule inputs (duration, roll basis, Skill, Stat, Difficulty, reference) set on the task through
  a **canonical GM review command**. Under the settled M5 split, the Action Selector owns those
  **fields** and Current action owns the **command**; **no second Save or commit control appears
  inside the Action Selector**.
- The task **resolve command carries audience selection and, because Perform Task is a
  GM-adjudicated outcome, the GM-authored player-safe result text — both as command inputs**,
  under the settled M6 ruling. Existing audience semantics are preserved; no new privacy mode is
  invented unless implementation proves them insufficient.
- A new row in `docs/architecture/combat-task-integration-matrix.md`, which today states _"There
  are no remaining task-integration gaps."_

Out of scope: every [12.8](#128-exclusions) exclusion; Activity projection changes (A2); Item
interaction authority (M7); removing any surface (A3); widening
`combatDeclarationPrimaryIntentSchema`.

#### Dependencies and gates

- **Not blocked by M5 or M6, which are now settled.** A1 keeps `GenericCombatActionPanel` alive
  as a temporary invoker regardless — introduce-then-retire requires it.
- Blocks A2 (`task_resolved` must exist before A2's publish list is fixed), M7 and A3.
- May be split as **A1a** (domain projection, commands, authorization, event emission, undo
  facts, Combat Log rendering) and **A1b** (route convergence and closing the second creation
  path). The split is a sizing choice for the control plane, not a contract change.

#### Reused, by path

- `packages/domain/src/encounter/combatRoundManager.ts` — `combatRoundCommandTypeSchema`,
  `CombatRoundCommandType`, descriptor projection. **Reserved hotspot.**
- `packages/domain/src/encounter/combatStepEventSchema.ts` — `combatStepEventTypeSchema`,
  `combatStepEventOutcomeScopeSchema`, `combatStepEventStatusSchema`.
- `packages/domain/src/encounter/combatGenericAction.ts` — `combatGenericActionSchema` and its
  existing `declarationKind`, `duration`, `progress`, `reference`, `resolution`, `rollRequest`,
  `awarenessContext` fields. **`CombatGenericAction` needs no new fields.**
- `packages/domain/src/encounter/combatDeclarationCompatibility.ts` — `perform_task` is already a
  real, available primary action.
- `packages/domain/src/encounter/combatDeclarationIntent.ts` — `description` (max 2000) and
  `taskId`. **Not widened.**
- `packages/domain/src/encounter/combatLogProjection.ts` — `CombatLogSummaryFacts`,
  `buildCombatLogProjection`.
- `apps/api/src/routes/scenarios/encounterRoutes.ts` — `materializeCombatDeclarationTasks` and
  `POST /encounters/:encounterId/combat-round/generic-actions`. **Reserved hotspot.**
- `apps/web/src/features/combat-history/components/CombatLog.tsx`;
  `apps/web/src/features/player-combat/PlayerCombatPanels.tsx`.

#### Minimal new domain, API and UI

- New members of `combatRoundCommandTypeSchema` for task advance, roll, resolve, interrupt and
  cancel, each with a descriptor authorization entry.
- New member(s) of `combatStepEventTypeSchema` — at minimum `task_resolved`.
- A new `CombatLogSummaryFacts` variant for the resolved task.
- A canonical GM review command carrying the rule inputs M2 names.
- No new component family. Current action and Combat Log render the new projected task and its
  summary facts through their existing contracts.

#### Persistence and schema

**No Prisma migration.** A1 must assert that positively in evidence. **But new persisted command
and event type values and new inverse undo facts are written into
`EncounterActiveCombatState.stateJson` and archived round rows**, which is a change to stored
data semantics.

#### Hotspots

Reserved, per [reserved integration hotspots](../architecture/ownership.md#reserved-integration-hotspots):
`apps/api/src/routes/scenarios/encounterRoutes.ts`;
`packages/domain/src/encounter/combatRoundManager.ts`; package root exports; Encounter API
clients and mutation responses. Prisma schema and migrations are **not** touched.
`apps/web/src/features/combat-round-manager/CombatRoundManagerPanel.tsx` is not reserved but is
heavily contended — A1 should avoid it entirely if Current-action invocation can be proven from
the player surface.

#### QA level

**Floor class, non-downgradable.** [AGENTS.md's mandatory QA floor](../../AGENTS.md#mandatory-qa-floor)
item 1 covers _any change to persisted schema **or stored data semantics**_, and A1 changes
persisted command and event semantics, undo facts and archived state. Full adversarial
independent QA at the strongest reasonably capable model, in a visible dedicated QA session.
The Product Owner ruling of 2026-09-22 confirms this and supersedes the earlier ruling's
classification, which named only A2.

#### Redundant surface

**None retired by A1.** `GenericCombatActionPanel` stays mounted as the temporary invoker.

#### Acceptance checks

Mismatches discharged, and how each is demonstrated:

- **M1** — `look_around` becomes a **preset of the Perform Task declaration**, not a new action
  id: `rollRequest.basis` set to Perception and the existing
  `awarenessContext: { kind: "survey" }` retained. No id is added and `observe_opponent` is
  untouched. **A behaviour loss requires explicit Product Owner acceptance inside this
  contract's issue body before `Ready`: today `look_around` can be declared mid-round; routed
  through declaration it can only be declared at the declaration boundary.**
- **M2** — rule inputs reach the task through the canonical GM review command.
  `combatDeclarationPrimaryIntentSchema` is unchanged; demonstrated by a test asserting the
  declaration intent schema's members are identical to baseline.
- **M3** — demonstrated by the task appearing as a projected `CurrentActionCommandDescriptor`
  and by every lifecycle mutation being rejected without the exact projected task, execution
  group, boundary and revision.
- **M4** — demonstrated by a resolved task appearing in `buildCombatLogProjection` output, and
  by undo restoring exactly the pre-resolution state from the compact inverse facts with no
  state snapshot written.

Also required: a one-round task resolves at the actor's primary-action opportunity; an N-round
task advances once per round at that opportunity and completes after exactly N advances; GM
adjudication can interrupt it; the second creation path no longer accepts an arbitrary client id.

---

### 12.13 A2 — player-safe Activity projection

**Outcome.** Situation Activity carries the concise, player-safe, narratively meaningful
outcomes [12.7](#127-logging-and-the-activity-projection) requires and stops carrying round and
phase bookkeeping — **in both directions at once**, so the recap source becomes cleaner without
becoming poorer.

**Why both directions are one contract.** Because
[§11.2 of the People / Artifact / GM-authoring model](./people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source)
makes the player-safe Activity projection the **exclusive** source for an AI session summary,
anything suppressed is permanently unrecappable. Narrowing alone is a regression.

#### Scope

In scope:

- Write-side narrowing: which `CombatStepEvent` records `packages/database/src/services/encounterService.ts`
  forwards as Activity `objectiveEvents` at all.
- **Projection-side narrowing keyed on `payloadJson.eventKind`**, because **historical rows are
  not backfilled** and roughly eleven bookkeeping types are already persisted.
- Publishing the meaningful task and Item outcomes Activity does not carry today.
- Producing the Activity summary **through the authorized viewer projection**.

Out of scope: A1's domain work; M7; A3's deletion; any backfill; any new player log.

#### The A2-Q1 ruling, and what it requires

**Settled, and not re-decided here.** Where **player-visible identity can differ by viewer**, a
**single stored summary string is not authoritative player text**. A2 must **persist sufficient
structured event facts and produce the Activity summary through the authorized viewer
projection**. Both options as originally posed — publish only public-scope plus
involved-audience rows, or write per-audience rows — are rejected.

Concretely: `CombatStepEvent.visibility.identityRefs` already supports per-viewer identity
fallbacks (`unseen_attacker` / `unseen_target`), and one stored string on
`encounter_combat_outcome` cannot express them. **Activity summaries derive from the same
`CombatLogSummaryFacts` the Combat Log already uses** — which satisfies _do not introduce
another independent log_ and stops a second summariser drifting.

**The two paths divide cleanly, and A2 must implement both.** The settled M6 ruling bounds A2-Q1
rather than competing with it:

| Outcome class                                     | Player-facing text is                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Automatic** combat outcomes                     | derived from persisted structured facts at projection time, per viewer                      |
| **GM-adjudicated** outcomes, such as Perform Task | GM-authored, supplied as an input to the resolve command, under existing audience semantics |

**Neither path uses a single stored rendered string as cross-viewer authority**, and neither
invents a new privacy mode unless implementation proves the existing audience semantics
insufficient.

#### Positive publish list — asserted by test, never a deny list

**A2 must be specified as a positive publish list asserted by test.** A deny list silently loses
any event type added later; a positive list fails loudly.

Recorded from the control-plane analysis, confirmed by the control plane:

- **Publish:** `attack`, `parry`, `damage_committed`, `hit_location`, `critical`, `observation`,
  visible `health_check`, and the **terminal** `*_result` / `*_committed` members of feint,
  break-off, adjust-distance, disarm and distance-control — plus the new `task_resolved` from
  [A1](#1212-a1--combat-task-lifecycle-convergence) and the existing `item_resolution`
  `eventKind`. `parry` is on this list because
  [Player Play V1 §9.2](../architecture/player-play-v1.md#92-the-visibility-rule)'s own worked
  example is _"Sergeant attacks Test Hunter — PARRIED"_.
- **Suppress:** `declaration`, `modifier_review`, `initiative`, `combat_experience`,
  `action_skipped`, `missile_readiness`, `damage_proposed`, `participant_su_review`,
  `effect_review`, `round_boundary`, and the `*_roll` / `*_response` / `*_review` /
  `*_feasibility` intermediates.
- **`round_boundary` is safe to suppress** because `ScenarioEventLog.roundNumber` already exists
  and is populated. Temporal structure survives as a row attribute without publishing the event.
  Confirmed by the control plane.

**Residual itemization, to be completed before this contract is `Ready`.** Six members of
`combatStepEventTypeSchema` fall under neither recorded set and must be assigned explicitly
rather than by pattern: `offensive_parry_brawling`, `continued_contact_maintenance`,
`feint_impossible`, `adjust_distance_adjustment`, `distance_control_applied` and `disarm_opened`.
The positive-list test must enumerate **every** member of the enum, so no member can be left
unclassified.

#### Dependencies and gates

- **Blocked on A1** for `task_resolved`, so the publish list includes it from the start.
- **Not blocked on M5 or M6, which are now settled.**
- One decision must be taken **before dispatch, not during**: whether already-persisted
  bookkeeping rows are retained for GM audit under a distinct `eventType`. Retaining them leaves
  historical encounters inconsistent unless backfilled — **and a backfill would be a migration**,
  which changes A2's shape.

#### Reused, by path

- `packages/database/src/services/encounterService.ts` — `collectCombatStepEvents` and the
  `objectiveEvents` forward.
- `packages/database/src/repositories/encounterRepository.ts` — the `encounter_combat_outcome`
  write.
- `packages/domain/src/campaign/scenarioSession.ts` — `scenarioObjectiveHistoryEventTypeSchema`,
  `projectScenarioObjectiveHistory`, `canViewCurrentItemOutcome`.
- `packages/domain/src/encounter/combatLogProjection.ts` — `CombatLogSummaryFacts`.
- `packages/domain/src/encounter/combatStepEventSchema.ts` — the enum the positive list asserts
  against.
- **`packages/database/src/services/combatItemInteractionService.ts` — the working template**, per
  the correction in [12.7](#127-logging-and-the-activity-projection). Copy it; do not redesign it.

#### Minimal new domain, API and UI

No new event type beyond A1's. No new route. No new panel. The change is which rows are written,
which rows the projection selects, and where the player-facing sentence is produced.

#### Persistence and schema

**No Prisma migration** — `ScenarioEventLog.eventType` is a `String`. **But stored-data semantics
change three ways:** which rows are written at all; what `summary` _means_ (today mechanically
derived from the event type, afterwards produced per viewer from structured facts); and which
`payloadJson` fields projection authority depends on. A2 must assert positively that Prisma schema
and migrations are untouched.

#### Hotspots

Package root exports. `packages/domain/src/campaign/scenarioSession.ts` is the shared privacy
projection and must be treated as a coordination surface even though it is not listed as reserved.

#### QA level

**Floor class, non-downgradable** on two independent grounds:
[floor](../../AGENTS.md#mandatory-qa-floor) item 1 (stored-data semantics) and item 2 (privacy
projection). Full adversarial independent QA at the strongest reasonably capable model, in a
visible dedicated QA session.

**The #271 precedent applies directly.** An implementation satisfies
[12.7](#127-logging-and-the-activity-projection) only if excluded events are **not written into,
or not selected by, the Activity projection on the server**. Filtering an already-published
payload in a React component or a view-model does not satisfy it, even when the rendered result
looks correct and every gate passes.

#### Redundant surface

**None retired by A2.**

#### Acceptance checks

- **Positive publish assertion:** a test enumerating every `combatStepEventTypeSchema` member and
  asserting its publish/suppress classification. Adding a member without classifying it fails.
- **Negative payload assertions on the API response**, not the DOM: suppressed types absent;
  non-entitled viewers receive no row for a `gm_only` or unperceived outcome.
- **Per-viewer identity:** a partially perceived event yields different authorized sentences for
  two viewers from the same stored facts, with no single stored string treated as authoritative.
- **Item parity:** existing `item_resolution` behaviour and its intersected audience are
  unchanged, re-verified by `canViewCurrentItemOutcome` at projection time.
- **Recap sufficiency:** a resolved Perform Task and a resolved Item interaction both appear in
  the player-safe Activity projection for their entitled audience.

**M1-M8 discharged: none directly.** A2 discharges
[12.7](#127-logging-and-the-activity-projection)'s binding rule and carries
[M4](#126-returned-contract-mismatches--unresolved)'s resolved event substrate onward into
Activity. It is named as a discharge route for no M row, and its acceptance must not be credited
against one.

---

### 12.14 M7 — Item interaction authority

**Outcome.** A Combat declaration can name an Item and the act to perform on it, and resolution
delegates to the existing Item interaction authority. No second Item-action channel is created,
and no revision, transaction or staleness guarantee is duplicated or weakened.

**Settled input this contract builds on, and must not re-decide.** The **existing Item
interaction service remains authoritative** for Item mutation, revision/staleness protection and
transaction semantics. **Declarations may identify the Item and action, but resolution delegates
to that authority rather than duplicating it.** **Item identity is preserved in declarations
where necessary.** M7 gets **its own contract, settled before A3**.

**Why it cannot be folded into A3.** These are not two spellings of one act. The Item service
carries `expectedItemRevision` guards, serializable transactions with retry,
`CombatItemUnavailableError` and its own Activity publication.
`materializeCombatDeclarationTasks` carries **none of that**, and a `small_action` today
materializes a generic action with **no Item identity at all**. That missing identity is exactly
what "preserve Item identity in declarations where necessary" closes.

#### Scope

In scope: carry Item identity and operation on the secondary declaration; delegate resolution to
the Item interaction service; preserve its guards, errors and existing `item_resolution`
publication unchanged.

Out of scope: moving Item mutation into `combatRoundManager.ts`; changing
`combatItemInteractionOperationSchema`; changing undo or staleness behaviour; Encounter Item
presence editing (that is [M8](#126-returned-contract-mismatches--unresolved), settled as
Encounter/context management and **not** an Inspector action); removing any surface.

#### Dependencies and gates

- **Blocked on A1**, whose declaration-to-task convergence it extends.
- **Blocks A3** — A3's parity check P6 cannot pass without it.
- Not blocked on M5 or M6, which are now settled.

#### Reused, by path

- `packages/database/src/services/combatItemInteractionService.ts` — the authority. Unchanged in
  its guarantees.
- `apps/api/src/routes/scenarios/combatItemInteractionRoutes.ts` —
  `POST /encounters/:encounterId/combat-round/item-interactions` and its `/options` sibling.
- `packages/domain/src/encounter/combatGenericAction.ts` —
  `combatItemInteractionOperationSchema`, `combatItemInteractionSchema`,
  `combatItemInteractionStateSchema`.
- `packages/domain/src/encounter/combatDeclarationCompatibility.ts` — secondary `equip_unequip`
  and `small_action`.
- `apps/api/src/routes/scenarios/encounterRoutes.ts` — `materializeCombatDeclarationTasks`.
  **Reserved hotspot.**
- `apps/web/src/features/combat-generic-actions/CombatItemInteractionPanel.tsx` — pass recipient
  and per-Item intent detail, as the temporary invoker.

#### Minimal new domain, API and UI

Item identity and operation carried on the secondary declaration context. No new service, no new
route, no new panel.

#### Persistence and schema

**No Prisma migration.** Declaration context gains Item identity, which is persisted combat state
and therefore a stored-data-semantics change. Must be asserted positively in evidence.

#### Hotspots

`apps/api/src/routes/scenarios/encounterRoutes.ts` (reserved); Combat Item services/projections
and shared Item/Combat/Lost Seal fixtures (reserved); Campaign/Scenario Item routes, services,
repositories and UI (reserved).

#### QA level

**Floor class, non-downgradable.** It changes persisted declaration semantics and sits directly
on the Item revision/staleness authority whose fixtures are a reserved hotspot; a weakened guard
here is exactly the adversarial case the [floor](../../AGENTS.md#mandatory-qa-floor) exists for.

#### Redundant surface

**None retired by M7.** `CombatItemInteractionPanel` stays mounted until A3.

#### Acceptance checks

- **M7 discharged**, demonstrated by: a secondary declaration naming an Item resolves through
  `combatItemInteractionService.ts` and not through a duplicate path; `expectedItemRevision`
  still rejects a stale revision with `CombatItemUnavailableError`; the serializable transaction
  and its retry are unchanged; `item_resolution` still publishes with its intersected audience.
- A `small_action` declaration that names an Item retains that Item identity through
  materialization — the specific gap the control-plane analysis identified.

---

### 12.15 A3 — UI consolidation

**Outcome.** One Combat action system. `GenericCombatActionPanel` is removed, its capabilities
reach the player and the GM through the Combat Inspector panels
[12.3](#123-panel-destinations) and [12.4](#124-capability-mapping) already name, and **no
capability is lost**.

**A3 is gated on the parity matrix and on M8's Encounter-management access, not on any open
Product Owner question.** M5 and M6 are settled; the destinations they fix are recorded in
[12.17](#1217-m5-and-m6--settled-and-the-remaining-blockers-to-a3).

#### Scope

In scope: route the [12.4](#124-capability-mapping) rows into their destination panels; remove
the player and GM renders of `GenericCombatActionPanel`; remove its Combat embedding of
`CombatItemInteractionPanel` and `EncounterItemsPanel`; delete the panel in **one deletion commit
after the parity matrix passes**.

Out of scope: all of [12.8](#128-exclusions); `EncounterItemsPanel` itself, which stays because
it is also rendered outside Combat in
`apps/web/src/features/roleplay/RoleplayEncounterScreens.tsx` — **only its Combat embedding is in
scope**, per [12.5](#125-reference-panels-and-the-surface-that-becomes-redundant); any Activity or
domain change (A1, A2, M7 own those); Player Play navigation or composition.

#### Dependencies and gates

- **Blocked on A1, A2 and M7**, all three integrated.
- **Not blocked on M5 or M6.** Both are settled; where A3 routes each
  [12.4](#124-capability-mapping) row under them is recorded in
  [12.17](#1217-m5-and-m6--settled-and-the-remaining-blockers-to-a3).
- **M8's gate:** Encounter Item presence editing is **GM Encounter/context management, not an
  Inspector action**, and no writable Combat Inspector panel may be invented for it. Combat
  consumes Item presence as **read-only context**; player Item operations use normal Combat
  declarations. **A3's removal of the old Combat embedding is gated on appropriate
  Encounter-management access existing.** A3 does not build that access and does not define that
  surface.
- **Blocked on the nine-check parity matrix below.**

#### Reused, by path

- `apps/web/src/features/combat-round-manager/CombatRoundManagerPanel.tsx` — **one render
  removal only.**
- `apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent.tsx`
  — player render removal.
- `apps/web/src/features/combat-history/components/CombatLog.tsx`;
  `apps/web/src/features/player-combat/PlayerCombatPanels.tsx`;
  `apps/web/src/features/encounters/EncounterItemsPanel.tsx` (retained, embedding removed);
  `apps/web/src/features/combat-generic-actions/CombatItemInteractionPanel.tsx` (embedding
  removed).
- `apps/api/src/routes/scenarios/encounterRoutes.ts` — removal of the superseded generic-action
  creation path. **Reserved hotspot.**

#### Minimal new domain, API and UI

**None.** If A3 needs a new domain type, an API change or a new panel, A1/A2/M7 did not finish
and A3 is not ready. Composition and routing only.

#### Persistence and schema

**None.** No migration, no stored-data semantics, no authorization change. A3 must assert this
positively.

#### Hotspots

`CombatRoundManagerPanel.tsx` is not reserved but is heavily contended and is claimed by **#180,
under an explicit STOP**, and by **#182**. A3 touches it for **exactly one render removal** and
nothing else. `apps/api/src/routes/scenarios/encounterRoutes.ts` is reserved.

#### QA level

**Ordinary independent immutable-head QA.** The [floor](../../AGENTS.md#mandatory-qa-floor) is not
engaged by A3 itself — it introduces no persisted-data, privacy-projection, `dev`-gate, CI or
branch-protection change. **The floor is not thereby downgraded for A1, A2 or M7**, and if A3's
scope ever grows to include any of their work, the floor governs the whole task.

**A3's QA additionally verifies the parity matrix before the deletion commit**, and that
verification is where A3's real adversarial value sits.

#### Redundant surface, and when

`GenericCombatActionPanel.tsx` (954 lines) becomes redundant, and **only at the end of A3**, in
one deletion commit after every parity row is ticked. Introduce-then-retire: **nothing is removed
before replacement parity is demonstrated.**

#### Acceptance gate — the nine-check parity matrix

**One evidence line per [12.4](#124-capability-mapping) row**, verified by independent QA before
the deletion commit, with **every check run with `GenericCombatActionPanel` unmounted** and every
assertion made **on API payloads, not the DOM** — the #271 lesson.

| Check   | Assertion                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**  | GM drives a full task lifecycle from the Combat Inspector.                                                                                      |
| **P2**  | The same, for a player-owned task.                                                                                                              |
| **P3**  | A resolved task appears in the Combat Log, and is **absent from the API payload** for non-entitled players.                                     |
| **P4**  | It appears in Activity for the entitled audience, and is absent from the payload for others.                                                    |
| **P4'** | **The enumerated publish list is present** — a positive assertion, not a deny check.                                                            |
| **P5**  | Suppressed event types are absent from the payload.                                                                                             |
| **P6**  | Item operations behave with unchanged staleness and `item_resolution` semantics, **or M7 is returned and the Combat embedding is not removed**. |
| **P7**  | History is readable from the Combat Log **including archived rounds**.                                                                          |
| **P8**  | Existing e2e specs pass, or are replaced by demonstrated equivalents.                                                                           |
| **P9**  | **Every [12.4](#124-capability-mapping) row is demonstrated or explicitly returned. None silently dropped.**                                    |

**Any unticked row blocks the deletion commit.**

#### M1-M8 discharged by A3

- **M1, M2, M3, M4** — not resolved by A3; **demonstrated** by it, through P1, P2, P3, P7 and P9
  running against A1's converged lifecycle with the old panel unmounted.
- **M7** — demonstrated by P6, or the embedding is not removed.
- **M8** — discharged by A3 only in the sense the ruling settles: the capability is **relocated,
  not the panel**. A3 removes the Combat embedding once appropriate Encounter-management access
  exists, and invents no Inspector surface. If that access does not exist at dispatch time, A3's
  removal of the `EncounterItemsPanel` embedding is deferred and P9 records it as an explicit
  return, not a silent drop.
- **M5** — discharged by routing the GM review fieldset's **fields** into the Action Selector
  while the **command** stays in Current action. Demonstrated by P1 and P9, plus a negative
  presentation check that **no second Save or commit control exists inside the Action Selector**
  and that Current step results renders no declaration control.
- **M6** — discharged by carrying audience selection, and the GM-authored player-safe text for
  GM-adjudicated outcomes, as **inputs to the resolve command** in Current action. Demonstrated
  by P4 and P5 on the API payload: the authored text and its audience reach only the entitled
  viewers, and Current action renders no prior result.

---

### 12.16 Serialization, hotspots and merge order

**A1, A2, M7 and A3 must not run concurrently.** This is a hard constraint, not a preference.

- A1, M7 and A3 all write `apps/api/src/routes/scenarios/encounterRoutes.ts` — a reserved
  hotspot, and coordination rule 1 in
  [ownership](../architecture/ownership.md#coordination-rules) gives a hotspot to one active task
  at a time.
- A1 and A3 both touch
  `apps/web/src/features/combat-round-manager/CombatRoundManagerPanel.tsx` if A1 cannot prove
  Current-action invocation from the player surface. That file is **also claimed by #180, which
  is under an explicit STOP, and by #182**. All four contracts serialize against those lanes too.
- A1 and A2 both touch package root exports.
- A2's projection changes are **consumed by A3's parity proof**, so they cannot be in flight
  together.

**Merge order:** A1 (optionally A1a then A1b) → A2 → M7 → A3. A2 follows A1 so the publish list
carries `task_resolved` from the start. M7 precedes A3 so P6 can pass.

Each contract asserts positively in its evidence that **Prisma schema and migrations are not
touched**.

---

### 12.17 M5 and M6 — settled, and the remaining blockers to A3

**Both are settled by the Product Owner ruling of 2026-09-22 on Forgejo issue #287.** They are
cross-referenced, not restated or reopened. **With them, all eight mismatches M1-M8 in
[12.6](#126-returned-contract-mismatches--unresolved) are resolved or ruled, and #287 carries no
remaining open Product Owner question.**

#### M5 — GM declaration review ownership

> **The Action Selector owns the declaration and review fields. Current action owns commands,
> including any existing draft-save and the relevant commit/resolve action. No second
> Save/commit control is added inside the Action Selector. Current step results remains
> read-only and owns no declaration controls.**

This adopts the split the control-plane decomposition offered as an option —
[section 8](#8-action-button-area) owns the **command**,
[section 4](#4-action-selector-and-shared-phase-panels) owns only the **fields** — and therefore
does **not** trigger the panel-shape change [12.8](#128-exclusions) forbids.

**Where A3 routes it.** The [12.4](#124-capability-mapping) row for GM review adjustments —
duration, roll, Skill, Stat, Difficulty and reference — becomes fields in the Action Selector
under GM permission, with its commit arriving through Current action's existing command control.

#### M6 — result audience and player-safe narrative

> **Audience and privacy selection belongs to the resolve command in Current action. Where a
> GM-adjudicated outcome requires player-safe narrative text, that text is also an input to the
> resolve command.**

**This does not make Current action a history or results panel.** Its contract is **the command
currently required by the Combat step, plus the inputs necessary to execute that command
correctly and safely.** A player-safe string needed to execute a resolve safely is such an input;
the panel carries command inputs, not narrative. After execution,
[Current step results](#7-action-result-panel) displays the resolved outcome, the Combat Log
records the authorized Combat outcome, and player Situation Activity receives only the
appropriate player-safe projection.

**Where A3 routes it.** The [12.4](#124-capability-mapping) row for player-safe result text and
`Who receives this result?` becomes resolve-command input in Current action.

#### How A2-Q1 bounds M6

The settled A2-Q1 ruling is **preserved** and constrains M6 rather than competing with it.
**Automatic** combat outcomes persist structured facts and derive viewer-appropriate summaries at
projection time. **GM-adjudicated** outcomes, such as Perform Task, carry authored text as a
resolve-command input under the **existing audience semantics**. **Neither path uses one stored
rendered summary string as authority where different viewers may legitimately know different
identities or facts**, and no new privacy mode is invented unless implementation proves the
existing semantics insufficient. [A2](#1213-a2--player-safe-activity-projection) implements both
paths.

#### Remaining blockers to A3

No Product Owner decision remains. What still stands between these contracts and A3's dispatch is
sequencing and evidence:

1. **A1, A2 and M7 integrated**, in that order — [12.16](#1216-serialization-hotspots-and-merge-order).
2. **M8's access gate.** A3's removal of the Combat embedding of `EncounterItemsPanel` is gated
   on **appropriate Encounter-management access existing**. The ruling relocates the capability
   rather than the panel, and [12.8](#128-exclusions) still forbids designing an Inspector
   surface for it. **A3 neither builds that access nor defines that surface.** If it does not
   exist when A3 is dispatched, that one embedding removal is deferred and P9 records it as an
   explicit return, not a silent drop. **This is the only substantive gate A3 does not control.**
3. **The nine-check parity matrix ticked in full** by independent QA before the deletion commit —
   [12.15](#1215-a3--ui-consolidation).
4. **Control-plane approval of the final decomposition**, and a Forgejo issue body carrying each
   contract to `Authorized`.

**One acceptance A1 still needs, and it is not a blocker to A3.** The M1 behaviour loss —
`look_around` can be declared mid-round today, but only at the declaration boundary once routed
through declaration — must be explicitly accepted in A1's issue body before A1 reaches `Ready`.
