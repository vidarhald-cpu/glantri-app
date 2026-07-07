# Combat UI Audit

Audit source of truth: `docs/product/combat-panel-contract.md`.

Scope: GM Combat Round Manager, Player Combat, shared player-combat panels, modifiers, tracker/timeline, Action Result Panel, Action Button Area, round-end SU review, distance controls, and combat state/reference panels.

This is an audit-only document. It identifies contract violations and implementation risks without proposing a broad redesign.

Cleanup note, 2026-07-06: the focused CE/action-area pass removed duplicate Player Combat CE waiting copy, moved GM CE start/update ownership into the primary Action Button Area, hid the internal effective CE table line from normal Action Result panels, normalized modifier-review status copy, and fixed player-safe distance projection so visible player distance uses the materialized round distance edge instead of falling back to melee distance `2`.

Cleanup note, 2026-07-06: the focused modifier/context pass clarified combat modifier source and scope display, split Initiative context from Combat Experience context, limited phase Combat Experience context to the selected participant, and kept other participants' phase-choice progress out of the selected-context panel.

Cleanup note, 2026-07-06: the focused combat display hygiene pass made modifier source/scope rows readable, filtered meaningless +0 draft rows from submitted modifier display, kept modifier-review and initiative contexts task-specific, simplified phase Combat Experience context copy, and routed submitted phase CE/back-out outcomes to Action Result/latest-event display.

Cleanup note, 2026-07-06: Slice 5 separated participant SU review from shared Round distance control, removed round-end distance roll/apply buttons from the distance-control body, and routed GM proxy roll/apply through the primary Action Button Area with compact pair/override controls.

Cleanup note, 2026-07-06: Slice 6 marked GM historical inspector panels with compact History/current-reference markers and stopped committed phase panels from silently filling missing snapshot phase facts, target distance, attack stats, or defense stats from current mutable state.

Cleanup note, 2026-07-06: Slice 7 added a compact GM tracker legend and explicit marker title text for completed, required, pending-count, roll-result, skipped/not-applicable, and not-reached cells, including round-end health/distance blockers.

Cleanup note, 2026-07-06: Slice 7 follow-up now derives the legend from the same marker-kind helper used by rendered tracker cells, so `?` appears in the legend whenever a required-action/roll cell is visible. Tracker cell titles were shortened to one participant/round/step summary with one blocker or result detail.

Cleanup note, 2026-07-06: Tracker initiative titles now avoid the ambiguous `GM edited` phrase. Initiative roll commands submitted from the GM path display `rolled by GM`, future explicit override facts can display `GM override`, and legacy GM-completed cells without command provenance fall back to `resolved by GM`.

Cleanup note, 2026-07-06: Slice 8 clarified round-level controls versus the selected/current action by labelling the GM timeline controls as round-level controls, renaming the shared Action Button Area heading to Current action, and marking participant SU review, health check review, round-end distance control, and the distance matrix with explicit ownership text.

Cleanup note, 2026-07-06: Player Damage Result Parity expanded Player Combat Action Result visibility for involved attackers and defenders, adding hit-location dice/selection, critical dice/final/effect summary, and persistent recorded-damage/effect summaries while keeping uninvolved players out of damage-chain detail selection.

Cleanup note, 2026-07-06: Damage Roll Ownership Labels clarified that D1/D2 hit-location and critical rolls are attacker-owned while damage/effects review is defender-recipient, with Player Combat and GM Combat action/status labels naming that split.

Cleanup note, 2026-07-06: GM Damage Review Declutter separated the GM D1/D2 damage/effects review card into context, outcome summary, proposed recorded effects, GM adjustments, calculation details, and commit readiness sections while preserving review controls and the primary Current action commit path.

Cleanup note, 2026-07-06: Player Mutation Response Sanitization routes non-GM player-owned combat roll mutation responses through a response-only player-safe sanitizer, preserving GM full responses while removing unrelated current phase results, unrelated attack results, and damage review details from non-GM roll responses. Historical snapshot/command projection hardening remains a separate follow-up.

Cleanup note, 2026-07-06: Player read-path combat projection now uses the same current-round result sanitizer as non-GM roll mutation responses, so player GET payloads keep involved attacker/defender result facts while removing unrelated current attack results, unrelated phase results, and damage review details. Historical snapshots and command-history projection remain separate follow-ups.

## Canonical Surfaces Inspected

- GM Combat Round Manager: `apps/web/src/features/combat-round-manager/CombatRoundManagerPanel.tsx`
- Player Combat: `apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent.tsx`
- Shared panels: `apps/web/src/features/player-combat/PlayerCombatPanels.tsx`
- Shared phase projection: `apps/web/src/features/combat-round-manager/combatRoundPhasePanelProjection.ts`
- Distance modifier projection: `apps/web/src/features/combat-round-manager/combatDistanceModifierProjection.ts`
- Timeline helpers: `apps/web/src/features/combat-round-manager/combatRoundTimelineNavigation.ts`
- Combat reference panels: `apps/web/src/features/equipment/components/CombatStatePanel.tsx` and `apps/web/src/features/equipment/combatStatePanel.ts`
- Domain round manager state and commands: `packages/domain/src/encounter/combatRoundManager.ts`

## Findings By Panel And Priority

### Player Combat

#### P0 - Player-owned round-end health rolls are not surfaced in Player Combat

Observed behavior:

- `CombatRoundManagerPanel.advanceInspectorRoundEndReview()` rolls SU health checks for the selected participant from the GM screen.
- `ScenarioPlayerCombatPageContent` exposes player actions for initiative, attack, parry, damage, Combat Experience, and distance control, but it does not expose a player-owned round-end health check action.
- `apps/web/src/lib/api/encounterClient.ts` has a player-facing distance-control roll helper, but no matching helper for round-end health checks.

Contract risk:

- Player-owned rolls must be visible and executable from Player Combat.
- GM proxy behavior is allowed, but it must not replace the player-owned path.
- "Waiting for GM" is only valid when the player has no pending player-owned work.

Impact:

- A player can owe an SU health roll while Player Combat still presents the work as GM-owned or unavailable.
- This is a command ownership problem and can cause the GM-only path to become the de facto canonical path.

Recommended slice:

- See "Slice 1 - Surface Player-Owned Round-End Health Checks".

#### P0 - Player distance-control UI can reveal opponent precommit preferences/results

Observed behavior:

- `ScenarioPlayerCombatPageContent` builds a selected distance-control proposal from `roundEndReview.proposedDistances`.
- The Player Combat distance-control card shows the player's desired distance and the opponent side's desired distance.
- The same card can show opponent roll/final distance information before the GM commits the round-level outcome.

Contract risk:

- Player privacy prohibits revealing other participants' hidden distance preferences before commit.
- The player may see own pending choices and public committed facts, but not another player's hidden preference or precommit roll details.

Impact:

- This can leak tactical intent during a contested pairwise round-end decision.
- It also blurs whether pending distance-control state is public, private, or GM-only.

Recommended slice:

- See "Slice 2 - Hide Opponent Distance-Control Private Data Before Commit".

#### P1 - Multiple outcome buttons compete in the Player Combat Action Button Area

Observed behavior:

- `PlayerCombatActionButtonPanel` accepts `secondaryButtonLabel` and renders a second command button below the primary button.
- Player Combat uses that secondary button for "Back out of attack" while the primary button can say "Continue attack" or another active command.

Contract risk:

- When multiple outcomes are possible, a selector/dropdown must appear before one primary action button.
- Review bodies and action areas must not contain competing primary commands for the same decision.

Impact:

- It is easy to add future phase decisions as extra buttons instead of routing them through the contract's selector-plus-primary pattern.
- Player intent can become ambiguous when both buttons look like valid commands for the same current decision.

Recommended slice:

- See "Slice 3 - Convert Continue/Back-Out Decisions To Selector Plus One Primary Button".

### GM Combat Round Manager

#### P1 - GM Step Controller competes with the inspector Action Button Area

Observed behavior:

- The Step Controller at the top of `CombatRoundManagerPanel` has a dominant commit/advance button.
- The selected inspector below also renders `PlayerCombatActionButtonPanel` with its own primary command.
- In sequential phases, the top button can still present round-level progress while the inspector owns participant-level work.

Contract risk:

- The current work surface should have one primary Action Button Area.
- Pool-based, sequential opposed, player-rolled review, and GM-only review work must be visually distinct so commands are not placed in competing areas.

Impact:

- Future implementation may put phase commands in both the global Step Controller and the participant inspector.
- Users can lose track of whether the active command applies to the round, the selected participant, or the selected pair.

Recommended slice:

- See "Slice 8 - Clarify Round-Level Controls Versus Current Action".

#### P1 - Combat Experience difficulty command lives inside the review body

Observed behavior:

- The GM Combat Experience section in `CombatRoundManagerPanel` renders a difficulty input and a body-level button such as "Start Combat Experience rolls" or "Update CE difficulty".
- The primary Action Button Area can simultaneously display a disabled "Set CE difficulty first" action.

Contract risk:

- Required selectors or inputs should appear before the primary action button.
- The body of a review panel should not contain the competing command that starts or updates the active flow.

Impact:

- The CE review body becomes both explanation and command surface.
- This weakens the rule that the Action Button Area owns the active command.

Recommended slice:

- See "Slice 4 - Move Combat Experience Difficulty Commit Into The Action Button Area".

#### P1 - Round distance-control review is structurally attached to one participant SU review

Observed behavior:

- `CombatRoundEndReviewPanel` renders "Round distance control" inside the selected participant's round-end review card.
- It lists all proposed pairwise distances, not only state owned by that participant.

Contract risk:

- Shared and pairwise state must not be owned by a participant SU panel.
- Distance-control outcomes are shared pairwise round-level state.

Impact:

- The UI can imply that the selected participant owns all pairwise distance-control work.
- Future mechanics may incorrectly store or advance pairwise outcomes through participant SU review.

Recommended slice:

- See "Slice 5 - Separate Round Distance Control From Participant SU Review".

#### P1 - Round distance-control review contains in-body proxy/action buttons

Observed behavior:

- `CombatRoundEndReviewPanel` renders per-pair buttons such as "Roll for [participant]", "Roll for [opponent]", and "Apply distance" inside the round-end review body.
- These appear alongside the inspector's main Action Button Area.

Contract risk:

- No competing primary buttons should live inside review bodies.
- GM proxy actions should be selected as current work and executed through the Action Button Area.

Impact:

- The GM can execute round-end pairwise commands from a nested review body instead of from the canonical active command area.
- This makes it harder to reason about undo, permissions, and command history.

Recommended slice:

- See "Slice 5 - Separate Round Distance Control From Participant SU Review".

### Tracker / Timeline

#### P1 - Tracker markers are not explicit enough for current GM work

Status, 2026-07-06: Addressed for the GM tracker. A compact legend explains only marker kinds present in the timeline, including `?` whenever a rendered tracker cell has a required action/roll marker. Cell titles/aria labels now use a concise participant/round/step summary with one CE requirement, initiative result, declaration pending, round-end health or distance-control blocker, skipped/cancelled action, or completion detail. Initiative titles use command provenance for `rolled by GM` and no longer use the ambiguous `GM edited` wording. Distance-control commit pending remains a title/current-task distinction rather than a unique visible marker.

Observed behavior:

- The GM timeline uses compact markers such as check marks, dots, dashes, question marks, and numeric counts.
- Some markers have titles or aria labels, but there is no visible legend in the manager.
- Distance-control pending counts are explicit, while pending round-end health work appears only as generic participant status.

Contract risk:

- Tracker markers must make meaning and source explicit.
- Player-owned pending work should be visible in the tracker rather than hidden behind generic pending state.

Impact:

- GM progress can look complete or merely pending without showing which category of work remains.
- Once player-owned health checks are added to Player Combat, the tracker needs to distinguish who owes the roll and whether GM proxy is being used.

Recommended slice:

- See "Slice 7 - Add Explicit Tracker Marker Meanings For Pending Work".

### Shared Action Button Area And Action Result Panel

#### P1 - Shared Action Button component permits a second command button

Observed behavior:

- `PlayerCombatActionButtonPanel` renders an optional `secondaryButtonLabel` and `onSecondaryAction`.
- Both GM Combat and Player Combat use this for phase choices such as continuing or backing out of an attack.

Contract risk:

- The Action Button Area should expose one primary action for the current selected outcome.
- Multiple outcomes should be chosen with a selector before that button.

Impact:

- The shared component makes the contract violation easy to repeat.
- Future flows may add more ad hoc secondary command buttons instead of modeling outcome selection.

Recommended slice:

- See "Slice 3 - Convert Continue/Back-Out Decisions To Selector Plus One Primary Button".

#### P2 - Action Result Panel separation mostly holds, but status text can drift into command explanation

Observed behavior:

- `PlayerCombatActionResultPanel` is a separate component and generally receives result data separately from the action button.
- Some button-area status text explains why a flow is waiting, such as distance-control or CE readiness.

Contract risk:

- Static result text and result explanations belong in the Action Result Panel.
- The Action Button Area should stay focused on current command availability and short blockers.

Impact:

- This is currently a low-risk readability issue, not a behavior bug.
- As more action-specific flows are added, long explanations could creep into the Action Button Area.

Recommended broad fix:

- Keep only short blockers in `PlayerCombatActionButtonPanel.statusText`.
- Move durable result/explanation text to `PlayerCombatActionResultPanel`.

### Shared Phase Panels And Combat Modifiers

#### P1 - Historical inspector views can silently mix snapshot and current draft state

Status, 2026-07-06: Addressed for GM inspector display. Historical Action Selector, phase panels, and Combat Modifiers now show source markers; unrecorded historical phase facts show as not recorded or hidden instead of using current mutable phase context.

Observed behavior:

- `CombatRoundManagerPanel` builds committed-step display state from `inspectorSnapshot` where possible.
- For phase contexts, it overlays only the snapshot's own phase onto the current `inspectorDraft.phaseContexts`; other phase panels can still read current draft context.
- The modifier panel can use snapshot rows, but the shared phase panels do not consistently show a visible history/current marker.

Contract risk:

- Current and historical state must never be silently mixed.
- Historical panels must clearly show they are history or previous-state views.
- Canonical source and precedence must be explicit.

Impact:

- A committed step can display some historical facts and some current mutable facts in the same inspector.
- If declarations, modifiers, equipment, or distance changed after the snapshot, the user can see combat facts that did not belong to the committed step.

Recommended slice:

- See "Slice 6 - Mark Historical Panels And Stop Silent Snapshot/Current Mixing".

#### P1 - Combat Modifier Panel does not show source mode in historical review

Status, 2026-07-06: Addressed for GM inspector display. Snapshot modifier rows are marked History; if a historical modifier snapshot is unavailable and current generated rows are used as a reference, the panel is marked History · Current reference.

Observed behavior:

- `PlayerCombatModifierPanel` shows rows and editable controls depending on `readOnly`.
- In GM committed/snapshot mode it becomes read-only, but the panel title and row display do not identify whether values are historical, current generated values, or draft edits.

Contract risk:

- Canonical state source and precedence must be visible for current versus history panels.

Impact:

- Read-only can mean "not editable right now" rather than "historical snapshot".
- This matters when modifiers affect displayed combat facts and later result interpretation.

Recommended slice:

- See "Slice 6 - Mark Historical Panels And Stop Silent Snapshot/Current Mixing".

### Action Selector

#### P2 - Secondary action controls are always structurally available

Observed behavior:

- `PlayerCombatActionSelectorPanel` has a general "Secondary action" select.
- The selector is shown as part of the declaration surface even when the active phase decision is unrelated to secondary action selection.

Contract risk:

- The primary action should determine which relevant selectors are shown before the primary command.

Impact:

- This is mostly wording and layout confusion today.
- It becomes riskier if phase choices continue to use separate secondary buttons instead of a specific outcome selector.

Recommended broad fix:

- Keep declaration selectors grouped by declaration purpose.
- Add any phase-choice selector as a distinct current-action control rather than overloading the declaration secondary-action field.

### Distance Matrix And Distance Controls

#### P1 - GM distance matrix is mostly correctly shared, but round-end controls duplicate pairwise command ownership

Observed behavior:

- The GM distance matrix is rendered as a shared matrix outside participant cards.
- Round-end distance-control commands are also rendered inside `CombatRoundEndReviewPanel`, which is selected participant scoped.

Contract risk:

- Shared/pairwise state should have one clear owner in the UI.
- Pairwise command execution should not be structurally nested under one participant.

Impact:

- The matrix and the SU review can imply two different ownership models for distance state.

Recommended slice:

- See "Slice 5 - Separate Round Distance Control From Participant SU Review".

#### P2 - Distance matrix source details are mostly title-only

Observed behavior:

- Matrix cells expose source, preferred distance, and notes in cell titles.
- The visible cell text is compact and focused on the current distance.

Contract risk:

- Tracker and state markers should be clear enough without relying only on hidden hover text.

Impact:

- This is a readability issue, not a command bug.
- It may be acceptable for compact GM tooling, but source labels should be visible when resolving contested distance changes.

Recommended broad fix:

- Add compact visible labels only where the source affects command choice or review.

### Combat State / Character Reference Panels

#### P2 - Combat State Panel is read-only, but its current-state role should stay explicit

Observed behavior:

- `CombatStatePanel` and `combatStatePanel.ts` present derived current combat facts from the character/loadout model.
- The panel does not issue combat commands.

Contract risk:

- Combat reference panels should not be confused with historical result panels or action command surfaces.

Impact:

- This currently looks safe.
- The main risk is future wiring that reads current character state for historical combat result display without an explicit snapshot/current marker.

Recommended broad fix:

- Keep the panel labeled and used as current character reference.
- Do not use it as the source for committed combat result review unless snapshot provenance is shown.

## Recommended Implementation Slices

### Slice 1 - Surface Player-Owned Round-End Health Checks

- Status: addressed in this branch by adding a player-owned round-end health-check route, Player Combat action, result display, and focused tests while preserving GM proxy roll behavior.
- Affected files/components: `ScenarioPlayerCombatPageContent.tsx`, `apps/web/src/lib/api/encounterClient.ts`, the relevant scenario encounter API route/handler, `CombatRoundManagerPanel.tsx` only for GM proxy preservation, and Player Combat tests.
- Contract rule: player-owned rolls must appear in Player Combat; GM proxy must not replace player rolls; "Waiting for GM" only when no player-owned action is pending.
- Why it matters: current SU health rolls are only executable from GM Combat, which is a P0 command ownership issue.
- Intended behavior: when a player's participant owes a round-end health check, Player Combat shows one primary action to roll it and displays the result in the Action Result Panel. GM Combat remains able to proxy the roll.
- Test focus: Player Combat renders a health-roll action instead of "Waiting for GM"; the API enforces participant ownership or GM proxy; GM proxy path still works.
- Before combat action completion: yes.

### Slice 2 - Hide Opponent Distance-Control Private Data Before Commit

- Status: addressed in this branch by filtering player-safe combat round state and Player Combat rendering so precommit distance-control proposals expose own-side details plus generic opponent status only; GM state remains full visibility.
- Affected files/components: `ScenarioPlayerCombatPageContent.tsx`, any extracted player distance-control projection helper, and Player Combat tests.
- Contract rule: player privacy; other participants' hidden distance preferences and precommit roll details are not visible to the player.
- Why it matters: contested pairwise distance choices can reveal tactical intent before commit.
- Intended behavior: before commit, the player sees own desired distance and roll state plus public progress such as "opponent submitted" or "opponent pending", without opponent desired distance or roll total. After commit, public final distance can be shown.
- Test focus: pending proposals do not render opponent desired distance, opponent final total, or hidden notes in Player Combat.
- Before combat action completion: yes.

### Slice 3 - Convert Continue/Back-Out Decisions To Selector Plus One Primary Button

- Status: addressed in this branch by routing Player and GM continue/back-out phase choices through a default-Continue selector plus one primary action button. The shared action button now has a pre-action control slot; the existing secondary-button props remain only for non-choice utility commands such as GM skip.
- Affected files/components: `PlayerCombatActionButtonPanel`, `ScenarioPlayerCombatPageContent.tsx`, `CombatRoundManagerPanel.tsx`, and shared panel tests.
- Contract rule: multiple possible outcomes use a selector/dropdown before one primary Action Button Area command.
- Why it matters: the shared component currently makes competing command buttons easy to add.
- Intended behavior: continue/back-out is selected in a small current-action selector, then committed through a single primary button.
- Test focus: phase choice flows render one primary command; selected outcome controls which command is submitted; disabled states still prevent invalid submission.
- Before combat action completion: preferably yes, before adding more action-specific roll flows.

### Slice 4 - Move Combat Experience Difficulty Commit Into The Action Button Area

- Affected files/components: `CombatRoundManagerPanel.tsx`, potentially `PlayerCombatActionButtonPanel` if the primary area needs a small pre-button control slot, and GM panel tests.
- Contract rule: inputs/selectors required for an outcome appear before the primary button; review bodies do not own active commands.
- Why it matters: CE difficulty currently has a command button inside the review body while the primary action button tells the GM to set difficulty first.
- Intended behavior: the CE difficulty input remains visible as task setup, and the primary Action Button Area starts or updates CE difficulty.
- Test focus: no body-level "Start Combat Experience rolls" command; primary action submits the chosen difficulty and preserves validation.
- Before combat action completion: yes for CE action completion work.

### Slice 5 - Separate Round Distance Control From Participant SU Review

- Status: addressed in this branch for display and action ownership. Participant SU review and Round distance control now render as sibling cards; the distance body is status/progress only. A future pair-level `currentCursor` could make shared SU tasks more explicit, but the UI no longer nests pair commands inside participant review.
- Affected files/components: `CombatRoundEndParticipantReviewPanel` and `CombatRoundEndDistanceControlPanel` in `CombatRoundManagerPanel.tsx`, plus distance-control tests.
- Contract rule: shared/pairwise state is not participant-owned; no competing primary buttons inside review bodies.
- Why it matters: all pairwise proposals are displayed inside the selected participant's SU review, with direct command buttons in the body.
- Intended behavior: participant SU review shows participant-owned effects and health review. Round distance control is a separate round-level/pairwise section. GM proxy roll/apply actions are selected as current work and executed through the primary Action Button Area.
- Test focus: pairwise proposals are not rendered as selected participant-owned state; per-pair command buttons are removed or demoted to a selector-driven current action.
- Before combat action completion: yes before expanding round-end review.

### Slice 6 - Mark Historical Panels And Stop Silent Snapshot/Current Mixing

- Status, 2026-07-06: Addressed for the GM inspector. Remaining limitation: fields not stored in the committed snapshot cannot be reconstructed and are shown as Not recorded/hidden; no schema expansion was added.
- Affected files/components: `CombatRoundManagerPanel.tsx`, `PlayerCombatPanels.tsx`, `combatRoundPhasePanelProjection.ts`, modifier panel tests, and timeline/inspector tests.
- Contract rule: current and historical state must not be silently mixed; historical panels need visible history/current markers; canonical source precedence must be explicit.
- Why it matters: committed inspector views can combine snapshot values with current draft phase contexts.
- Intended behavior: committed inspector views visibly mark Action Selector, phase panels, modifiers, and result data as history/previous state. Values that are not available in the snapshot are hidden, marked as current reference, or explicitly sourced.
- Test focus: committed snapshot render does not fall back to current mutable phase facts without a label; history markers render for committed cells/panels.
- Before combat action completion: yes for reliable review, undo, and result interpretation.

### Slice 7 - Add Explicit Tracker Marker Meanings For Pending Work

- Status, 2026-07-06: Addressed for the GM tracker. Follow-up addressed `?` legend inclusion by deriving legend entries from the rendered cell marker kind, shortened repetitive cell tooltips, and replaced ambiguous tracker `GM edited` initiative wording with command-provenance wording. Remaining ambiguity: distance-control commit pending does not have a separate symbol; it is exposed through cell title text and the current Action Button Area.
- Affected files/components: `CombatRoundManagerPanel.tsx`, `combatRoundTimelineNavigation.ts`, and GM timeline tests.
- Contract rule: tracker markers must be explicit, including pending player-owned work and GM-only review.
- Why it matters: compact symbols are not enough to distinguish CE requirements, distance-control rolls, health rolls, completed review, skipped work, and current work.
- Intended behavior: add a compact visible legend or inline marker labels, and add a distinct marker/count for pending round-end health checks once Player Combat owns those rolls.
- Test focus: marker legend exists; pending CE, distance-control, and health work have distinguishable labels or titles.
- Before combat action completion: yes once Slice 1 adds player-owned health work.

### Slice 8 - Clarify Round-Level Controls Versus Current Action

- Affected files/components: `CombatRoundManagerPanel.tsx` Step Controller and inspector action area.
- Status, 2026-07-06: addressed with concise UI ownership labels. The top timeline controls are marked as round-level controls, the shared primary command panel is titled Current action, participant SU/health review is participant-owned, and distance-control/matrix surfaces are marked as round-level state. No command semantics or sequencing changed.
- Contract rule: one primary Action Button Area for current work; the four GM work categories must be visually distinct.
- Why it matters: top-level commit/advance and inspector primary actions can look like competing command surfaces.
- Intended behavior: round-level navigation/advance controls are clearly labeled as round controls, while selected participant/pair commands live in the Action Button Area. If a commit is the current task, expose it through the same current-action pattern.
- Test focus: one dominant command is visible for the selected current task; round-level controls do not duplicate participant/pair commands.
- Before combat action completion: before adding more GM work categories or action-specific completion flows.

### Player Combat Display Regression Follow-Up

- Status, 2026-07-07: addressed visible Player Combat regressions. Modifier rows use readable Source/Mod/Dur/Details columns in read-only and editable modes, distance modifier context no longer renders as an attack result section, and tracker initiative provenance suppresses GM wording for player-submitted command facts.
- Affected files/components: `PlayerCombatPanels.tsx`, `ScenarioPlayerCombatPageContent.tsx`, and tracker tooltip provenance in `CombatRoundManagerPanel.tsx`.
- Contract rule: modifiers/context are not command results; result panels show command facts; tracker titles should describe provenance without overstating GM intervention.

### GM Player Combat Perspective Reuse

- Status, 2026-07-07: addressed. The GM Player Combat tab continues to supply the GM-only participant selector, but the embedded combat surface now follows the same player-facing perspective rules for action availability, status text, modifier display, target visibility, and result precedence. GM review/edit controls remain in GM Combat/Combat Inspector.
- Affected files/components: `CampaignWorkspaceShell.tsx`, `ScenarioPlayerCombatPageContent.tsx`, and `playerCombatResultSelection.ts`.
- Contract rule: GM Player Combat is a copy of the selected participant's player view; it must not maintain separate action/result interpretation.

## Safe To Fix Broadly

- Naming and label consistency for tracker markers, phase titles, and status labels.
- Adding visible title/tooltips or a compact legend for existing tracker markers.
- Moving static, mechanically inert result/explanation text out of `PlayerCombatActionButtonPanel.statusText` and into `PlayerCombatActionResultPanel`.
- Compact wording changes that do not alter enabled/disabled logic.
- Non-behavioral layout grouping that clarifies current reference panels versus historical result panels.
- Keeping distance matrix source labels visible when they are already public and do not change command behavior.

## Must Fix Step By Step

- Player versus GM permission or proxy behavior.
- Player-owned roll availability, including round-end health checks.
- Any command sequencing changes in GM Combat or Player Combat.
- Undo behavior or command-history interpretation.
- Current/history source precedence and snapshot fallback rules.
- Player privacy for hidden declarations, CE/back-out choices, distance preferences, and precommit roll details.
- Action-specific roll flows, including attack/parry/hit location/critical and round-end rolls.
- Shared round-level review flows such as distance control and SU review.

## First Recommended Cleanup Target

Start with Slice 1 - Surface Player-Owned Round-End Health Checks.

Reason: this is the clearest P0 command ownership gap. The domain already has a round-end health roll command and GM proxy path, but Player Combat does not expose the player-owned path. Fixing this first also gives the tracker and Action Button Area cleanup concrete pending player-owned work to model.

After the two P0 player-facing issues are fixed, the highest-repeat structural cleanup is Slice 3: remove secondary command buttons from `PlayerCombatActionButtonPanel` and route continue/back-out through selector plus one primary action.
