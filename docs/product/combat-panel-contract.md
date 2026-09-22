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
