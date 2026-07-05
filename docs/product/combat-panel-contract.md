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
- Each new command must define Clear and undo behavior.
- GM and player views may share components, but permission and visibility rules belong in the parent panel or explicit helpers.

## 2. GM Combat Round Manager

- Purpose: the authoritative encounter command and review surface for the active combat round.
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

## 4. Shared Phase Panels

- Purpose: compact display and permitted editing of phase-level combat choices.
- Phase panels may show action, weapon, target, distance, attack values, parry values, and local phase status.
- Target-row distance is read-only in phase panels.
- Phase panels may be editable only when the parent panel grants edit permission.
- GM Combat may use the same phase component with broader permissions.
- Player Combat may use the same phase component with player-scoped permissions.
- Phase panels do not own sequencing, privacy, command persistence, or round advancement.

## 5. Combat Modifiers Panel

- Purpose: display the current modifier buckets that apply to the selected participant and phase context.
- The canonical input is the current persisted or explicitly projected combat context selected by the parent panel.
- Generated declaration modifiers appear after declaration or modifier commit.
- Distance modifiers follow the same lifecycle as action-generated modifiers.
- Attack resolution consumes the visible persisted Skill/OB, DB/Parry, and related modifier buckets.
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
- The panel should show enough detail to audit modifiers, rolls, target values, and final outcomes.
- If a command used a generated modifier, the result should explain the consumed modifier through command facts.

## 8. Round-End / SU Review

- Participant SU owns participant-specific end-round effects such as bleed, duration changes, health changes, and status review.
- Shared and pairwise systems are round-level or pair-level state.
- Pairwise distance control may be displayed during SU, but it is not owned by one participant.
- Each pairwise distance-control item resolves once per unordered pair per round.
- Player-owned round-end rolls must surface in Player Combat.
- GM Combat must show who still owes round-end rolls and which shared results are ready to commit.
- The GM commits shared round-end results after required rolls and reviews are complete.
- Round-end distance changes affect the next round and must not retroactively alter current-round attack modifiers.

## 9. Combat State / Character Reference Panels

- Purpose: read-only reference for the selected character or participant.
- These panels may show stats, equipment, skills, armor, and derived combat state.
- These panels are not round command surfaces.
- These panels should not contain hidden sequencing, mutation logic, or command side effects.
- Reference panels may explain where a number comes from, but they do not decide combat lifecycle.

## 10. Implementation Checklist

- Which panel owns this behavior?
- Who may act: player, GM proxy, or GM only?
- Who may see it before commit?
- What is the canonical state source?
- Which command changes state?
- What does Clear or undo do?
- Is this declaration, initiative, attack, parry, damage, SU, or round-level state?
- Does the tracker need a marker?
- Does Player Combat show the action if the player owes it?
- Does the result panel read command facts rather than recomputing?
