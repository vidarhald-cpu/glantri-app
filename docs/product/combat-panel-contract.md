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
