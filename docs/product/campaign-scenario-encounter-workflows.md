# Campaign, Scenario, and Encounter Workflows

This guide defines the product responsibilities for the Campaign, Scenario, and Encounter workspaces. These pages should help GMs and players understand what they can do now without exposing admin-only state, internal read-model mechanics, or future implementation notes.

## Workspace Boundaries

Character development, Campaign, Scenario, and Encounter are separate workspaces.

Character development is where a character is created, advanced, equipped, and reviewed. It is about who the character is over time, not where they are currently present in play.

Campaign is the broad container for play. It manages the campaign roster, campaign-level context, and which characters or templates are available for use in that campaign.

Scenario is a concrete story situation inside a campaign. It manages the actors who are currently part of that scenario and the scenario-level setup used by encounters.

Encounter is a specific moment of play inside a scenario. It manages the actors who are present in that encounter, the current player-facing situation, access, membership, visibility, and participant descriptions. Skill rolls, Character, and Combat are tools used inside that shared encounter context rather than separate encounter universes.

## Campaign Workspace

The Campaign workspace answers: "Who and what is available to this campaign?"

GM responsibilities:

- Maintain the campaign title, description, and campaign-level context.
- Manage the campaign roster of available characters, NPCs, and templates.
- Create and organize scenarios.
- Decide which player characters and GM-controlled actors are available for future scenario use.

Player responsibilities:

- Review campaign information that is safe to show to players.
- See accessible scenarios when the GM has made them available.
- Navigate to player-safe scenario or encounter views when available.

Important rule: campaign roster means available to the campaign, not currently present in a scene. A roster member is not automatically in a scenario or encounter.

Campaigns are not self-join spaces. The GM controls campaign roster membership. A character may join or open a live scenario only when that character is already in the campaign roster and the scenario is currently live.

Player Campaign pages should not show:

- GM-only notes.
- Admin controls.
- Internal campaign IDs or access mechanics.
- Hidden scenarios.
- Implementation details about why a scenario is accessible.

## Scenario Workspace

The Scenario workspace answers: "Who is concretely in this story situation?"

GM responsibilities:

- Maintain the scenario title, summary, and GM-facing notes.
- Add concrete actors from the campaign roster.
- Create temporary actors from templates when needed.
- Mark scenario participants as active, inactive, or otherwise available for encounters.
- Create and manage encounters inside the scenario.
- Decide which scenario participants are eligible for each encounter.

Player responsibilities:

- Review player-safe scenario information.
- See active scenario participants that are safe for the player to know about.
- See accessible encounters when the player has an assigned or default-eligible participant.
- Open the Encounter when available.

Current design rules:

- Scenario participants are concrete actors in a scenario.
- Scenario participants are not the same as campaign roster entries.
- Scenario kind is an internal/model-level classification for now, not a workflow control that should be emphasized in Campaign or Player pages.
- Template sources are not participants until the GM creates concrete actors from them.
- Player pages should not expose whether hidden or GM-only participants exist.

Player Scenario pages should not show:

- GM-only scenario notes.
- Template-management internals.
- Hidden scenario participants.
- GM assignment controls.
- Visibility models or read-model source labels.
- Internal fallback mechanics.

## Encounter Workspace

The Encounter workspace answers: "Who is present in this specific moment, and what is currently happening?"

GM responsibilities:

- Manage encounter title, status, type, and GM-facing notes.
- Set the player-facing situation message.
- Control encounter participant membership when needed.
- Manage visibility between participants.
- Maintain participant names, short descriptions, and detailed encounter descriptions.

Player responsibilities:

- Read the player-facing encounter title, context, and situation.
- See only visible PCs/NPCs.
- Receive clear empty states when not assigned or when no encounter is available.

The current workspace tabs should read:

- Campaign
- Scenario
- Encounter
- Skill rolls
- Player skill rolls
- Character
- Combat
- Player combat

Skill rolls is the GM encounter roll manager. It owns GM skill roll assignment, calculations, ranked roll results, and the GM action log.

Player skill rolls is the player-facing roll view. Players see their own assigned rolls, ranked results, and character roll log. GMs can open the same player-facing screen for a selected participant through the participant picker/shuffler and operate it as a GM-authorized action for NPCs, absent players, testing, or player assistance.

Character is the encounter participant state/control tool. It owns the current character loadout and Physical state panel for the selected/controlled participant.

Combat is the GM encounter round/action manager tool. It should be reachable for the selected encounter when the GM wants to use combat flow; roleplay and combat are not separate encounter universes.

Player combat is the only player-facing combat/action view in the workspace. Players see their own combat controls and context there; the GM Combat tab remains the GM Combat Round Manager only. Legacy or accidental player requests for the Combat tab should resolve to Player combat rather than exposing a second player combat surface.

Player Combat owns the canonical combat-action declaration UI. During the DE step, players choose Action, Secondary action, Movement, and Description, then commit with Declare action. Attack-capable declarations are not complete until their required phase target fields are selected; incomplete declarations may be saved or restored as drafts, but they remain editable for the controlling player while DE is still open. Committing a valid declaration stores it on the participant combat state, appends the same undoable declaration command used by GM declarations, and freezes the player controls for that round; GM advancement locks unfinished declarations. Combat modifiers are GM-controlled; players may see General/Fatigue, Initiative, Skill/OB, and DB/Parry values but cannot add, edit, or delete modifier entries. DB/Parry is stored internally with the backward-compatible `situationDb` key, but it applies to both DB and Parry/P in encounter-context combat. The phase panels are compact consequence summaries, not large forms: attack rows show weapon, I, OB, DMB, AM, and MC, while defense/parry rows show source, DB, DM, and P. The modifier editor uses compact Mod, Dur, and Details fields for GM-entered manual modifiers; Dur records an optional number of rounds. The GM Combat inspector mirrors the same declaration selector for the selected participant; the GM can save or revise participant declarations and modifiers at any round step for NPCs, absent players, corrections, and testing.

Phase 1 and Phase 2 are separate combat phase contexts. Each phase can hold its own attack target location, defense/parry direction choices, and future opponent, modifier, and result snapshots. Generated action modifiers are phase-aware: Phase 1 generated rows only appear in Phase 1 views, Phase 2 generated rows only appear in Phase 2 views, and broad manual modifiers without a source phase can appear in no-phase, Phase 1, and Phase 2 views. No-phase views such as Declaration and Round summary do not sum phase-specific generated modifiers together as active modifiers. When the GM commits a round-manager step, the current combat round state records per-participant step snapshots for that committed cell. Selecting a committed GM grid cell shows the saved snapshot when available; selecting an uncommitted cell falls back to the current live phase-aware read model. After phase initiative is rolled, phase resolution proceeds actor-by-actor in initiative order. Each actor resolves attack/action, defender parry, defender damage result/review, and defender effects-review placeholder before the cursor moves to the next actor. Actors without an attack in the current phase are not offered an attack roll; they begin at the phase review placeholder and can be marked reviewed/done. Phase 1 and Phase 2 attacks can currently be rolled by the GM from the Combat inspector for hit/miss/grazing using the canonical Combat To Hit table. To-hit uses open-ended `1d20` in both directions with the same convention as skill rolls, and hit lookup total is `OB - DB + open-ended roll total`. Normal damage uses a second lookup: `damage lookup total = hit lookup total + weapon DMB + defender DM + armor modifier`; that row gives final table damage, critical grade, and minimum damage. Attack result lines show final modified OB and DB totals without exposing the opponent's modifier breakdown. If an attack hits or grazes, the GM resolves parry from the defender's P1/P2 cell for that incoming attack. The first parry slice assumes direction and hit-location coverage are valid, lets the GM choose the defender's main-hand and off-hand sources for the selected incoming attack, uses General/Fatigue plus DB/Parry modifier adjustment, and succeeds on parry total `21` or higher. Future combat rules should write phase-specific context and result data into the matching phase slot rather than treating both phases as one shared live context.

Player Combat shows human-readable step names such as Declare action, Review modifiers, and Phase 1 initiative. Compact timeline abbreviations such as DE, M1, and i1 are GM round-grid headers only. Player Combat shows `Waiting for GM` when the player cannot currently act, including after declaration, after initiative is rolled, or after the GM has advanced past a player-editable step. Player initiative order/rank is hidden until all required initiative rolls for that phase are complete; before then, a player may see their own roll as rolled and waiting for others. The player Action result keeps the latest relevant result for that participant and phase, such as initiative after the cursor advances to A1/A2, until an attack, parry, location, damage, or critical result replaces it. Player roll availability is driven by the combat round `currentCursor`: the attacker may roll A1/A2 attack, D1/D2 hit location, and D1/D2 critical; the defender may roll P1/P2 parry; and the GM may roll any current roll or use Clear current step for rollback. During A1/A2, the controlling player and the GM can both roll the one currently open attack identified by the combat round current cursor; the guarded command path rejects duplicate or stale attempts so the first recorded attack result wins. During P1/P2, the defending player and the GM can roll the one currently open parry in the same command-backed path. During D1/D2, the attacking player may roll hit location for their own attack, and may roll the critical die when that attack's damage proposal has a critical grade. Unrelated players do not see those roll actions, and player views do not expose Clear or reroll controls. GM-facing Player Combat and Combat inspector action buttons use step-aware labels such as Declare action, Declare modifiers, Roll phase 1 initiative, and Review phase 1 effects. These labels prepare the workflow for later step-specific tools without changing combat resolution in this pass.

The Combat Round Manager advances the shared round timeline. DE, M1, i1, M2, and i2 are global setup, review, and initiative steps that the GM works participant-by-participant in the current table order; after the inspector action completes for one participant, selection moves down one row and stays in the same column. These global steps are not driven by the phase-resolution cursor: a fresh DE pass starts at the first displayed participant unless the GM has manually selected another valid DE cell. In the first command-stack migration slice, GM completions in DE/M1/i1/M2/i2 also append a command record and update `currentCursor` to that command's `afterCursor`; web selection for those global steps follows `currentCursor` after refresh. Phase resolution also publishes the active A/P/D task through `currentCursor`, so A1/A2/P1/P2/D1/D2 player roll eligibility and the GM Current task button use the same authoritative cursor as command undo. Player declarations, player initiative rolls, and player phase rolls append the same undoable commands as GM-originated actions, so repeated Clear current step unwinds command history back to the start of the round rather than stopping at the first player-originated state. A1/A2 attack rolls now append `roll_attack` commands with the attacker's A1/A2 `beforeCursor` and an explicit `afterCursor`: defender P1/P2 for a hit or grazing hit, the next actor A1/A2 for a miss, or the next phase boundary when no actor remains. P1/P2 parry rolls now append `roll_parry` commands with the defender's P1/P2 `beforeCursor` and an explicit `afterCursor`: the next actor A1/A2 for a successful parry, the next phase boundary when that parry completes the last actor, or defender D1/D2 for a failed parry. D1/D2 now use command-backed internal substates without adding visible timeline columns: `roll_hit_location` records the attacker-privileged closed d20 location roll and keeps the cursor on defender D1/D2; `resolve_damage` creates a reviewable damageResult proposal; `roll_critical` records the attacker-privileged 2d8 critical roll when the proposal has a critical grade; and `commit_phase_damage` writes source-linked combatEffects rows, marks that proposal committed, and moves to the next actor A1/A2 or the next phase boundary. Phase 1 resolves A1/P1/D1 in initiative order; when no phase-one actors remain, the cursor moves to M2 for phase-two setup. Phase 2 resolves A2/P2/D2 in initiative order; when no phase-two actors remain, the cursor moves to SU. SU is a command-backed round review/completion step: completing SU writes visible `complete_round` markers, and Clear unwinds those markers in reverse command order. Creating the next combat round remains a separate follow-up workflow from command-backed SU completion. The proposal preserves the computed hit location, armor, damage lookup, table damage, and critical metadata while allowing compact GM review overrides for selected location, armor modifier, total damage, critical grade, critical roll modifiers/result/location, notes, and additional immediate effect rows; commit uses the effective reviewed values. Combat round declarations, commands, attack results, phase-resolution results, snapshots, cursors, and selected inspector state are scoped to the active encounter and round. New encounters discard any copied combat progress and start with empty command/result/snapshot state, and participant-level "last declaration" metadata is only treated as current when it is scoped to the same encounter and round. Remembered or manual inspector selections are applied only when they are valid for the active encounter and round; invalid selections and unsupported legacy phase cursors are discarded in favor of the current task or the first declaration cell. Clear is command-stack undo by default: it removes the latest undoable current-round command, clears the marker/status and dependent state created by that command, and restores `currentCursor`, selected cell, and inspector mode to the command's `beforeCursor`. Clear current step is disabled or treated as a no-op when the active encounter has no command-backed or legacy state to clear. Current task returns the GM from manual inspection to the active `currentCursor` selection, including valid A1/A2/P1/P2/D1/D2 phase tasks, without recording a command or changing combat state. Manual cell selection is inspection and does not choose the undo target while later undoable commands exist. If no undoable command exists, Clear falls back to selected-cell local clear for legacy or non-command state. A future UI may split this into separate Undo last step and Clear selected cell controls if both workflows are needed. D1/D2 damage proposals now consume command-backed hit-location rolls; live armor-modifier application from equipped armor, automatic critical/effect application, bleeding automation, and final wound typing remain future work. The current commit creates the reviewed numeric physical damage row at the effective reviewed hit location when one is available, applying any max-damage cap before the row is written; General damage is used only when no specific location is available. It also creates any accepted reviewed immediate modifier, fatigue, special, or note rows, including critical-table proposal rows that the GM keeps in the review. Modifier rows use the existing combatEffects live modifier path, so committed phase-one rows can affect phase-two combat where General/Fatigue, OB/Skill, and DB/Parry are already supported. The current final-damage sequence is attack result, parry, attacker hit location with closed 1d20, armor modifier when a safe source is available, damage/effect proposal, attacker critical roll when required, table-driven critical proposal, GM review, and GM commit. The top Commit/Advance button creates commands only for open global rows that receive visible accepted, locked, complete, or skipped markers, so top-button DE/M1/i1/M2/i2/SU commits and skips are undoable through the same Clear behavior as inspector actions; mass advance appends one command per affected participant in displayed order so Clear unwinds those rows one at a time in reverse order. It does not push every participant into P1/P2 or D1/D2, because those are conditional defender substeps rather than global phases. A committed step snapshot stores the participant label, selected declaration, relevant phase context, phase-filtered modifier summary, attack/defense summaries when available, initiative result/rank when relevant, P1/P2 or D1/D2 resolution scaffold status when available, and participant phase-resolution status. The visible columns are `DE M1 i1 A1 P1 D1 M2 i2 A2 P2 D2 SU`: A1/A2 are attack/action roll columns owned by the attacker, P1/P2 are parry/defense columns owned by the defender of an incoming attack, and D1/D2 are damage/effects review columns owned by the defender. A/P/D results are step-specific current-round state and should not bleed into DE display after a declaration is cleared, replaced, or a new round starts. A1/A2 show done only when that actor's attack/action roll is resolved or the actor is explicitly skipped. A1/A2 no-attack completion is command-backed as `skip_phase_action`, which removes the skipped/review marker and restores the actor's A1/A2 cursor when undone. Once an A1/A2 attack roll is recorded, the normal action button treats it as already rolled and will not roll again; undoing the `roll_attack` command removes the attack result, dependent defender P/D scaffold, matching snapshots, and stale markers before returning to the attacker A1/A2 cell for correction or re-roll. Once a P1/P2 parry roll is recorded, undoing the `roll_parry` command removes the parry result, dependent D1/D2 scaffold, matching snapshots, and stale markers while keeping the attack result and returning to the defender P1/P2 cell for correction or re-roll. Once hit location is rolled, undoing `roll_hit_location` removes only that location result and returns defender D1/D2 to location pending after later damage/critical commands have already been unwound. Once a D1/D2 damage result is recorded, undoing the `resolve_damage` command removes the damage result, review overrides, additional effect drafts, and matching snapshots while keeping attack, parry, and hit-location results and returning to the defender D1/D2 cell. Once a critical roll is recorded, undoing `roll_critical` removes only the critical roll data plus critical-table-generated proposal rows, keeps attack/parry/location/damage proposal intact, and returns to critical pending. Once phase damage is committed, undoing `commit_phase_damage` removes only the CombatEffectEvent and CombatEffect rows listed in that command's facts, keeps attack/parry/damageResult with review overrides, critical roll, and additional effects intact, and returns to the defender D1/D2 proposal. Committed damage and effect rows remain active through phase boundaries, SU completion, and SU undo unless the specific `commit_phase_damage` command that created them is undone. P1/P2 remain neutral before phase resolution and pending for an incoming hit or grazing hit until parry is resolved; they show not applicable only when current-round state explicitly makes defense irrelevant, such as an attack miss or a skipped defense. D1/D2 remain neutral before phase resolution, location-pending after failed parry, proposal-ready after `resolve_damage`, critical-pending when a critical grade awaits `roll_critical`, and complete after `commit_phase_damage`; a successful parry can make D1/D2 not required. Lookup totals 17 and 18 are resolved in the current table, normal hit damage uses hit lookup plus DMB, defender DM, and armor modifier as the damage lookup, grazing-hit damage rolls 1d of the table damage at reference lookup `12 + DMB + DM + armor`, rows with max damage use `17 + attacker STR GM` as the cap, and lookup totals above the displayed table continue by adding 1 damage per row. Non-initiative cells use consistent semantic markers: `.` means pending/open or not started, `✓` means submitted/reviewed/completed, and `–` means explicitly not relevant or not applicable. DE cells show declaration state, not “active participant” state. M1/M2 can be marked reviewed even when the GM enters no modifier values. The GM can use arrow keys to move the selected timeline cell when focus is on the grid. A/P/D resolution uses the inspector action button and phase-resolution cursor: recording a hit or grazing hit selects the defender's parry cell, recording a miss marks defender P/D not applicable and moves to the next actor or phase boundary, successful parry moves to the next actor or phase boundary, failed parry selects the defender's D1/D2 damage cell, hit-location roll keeps D1/D2 selected, resolving damage keeps D1/D2 selected for critical/review, rolling critical keeps D1/D2 selected for review, and committing phase damage moves to the next actor or phase boundary. Commit actions return focus to the round table so the updated column is visible, while Clear current step avoids explicit page scrolling so the command controls stay in view where possible. Clear undoes the latest visible command or state change in one click: invisible no-op commands should not be recorded, and skipped commands should not require extra Clear clicks. When the latest command is the attack that opened a defender P1/P2 prompt, Clear undoes that attack and returns to the attacker's A1/A2 cell. When the latest command is the parry that opened D1/D2 or the next actor, Clear undoes that parry and returns to the defender's P1/P2 cell. When the latest command is committed phase damage, Clear removes the command-created rows and returns to defender D1/D2 with the reviewed damage proposal still visible. When the latest command is a critical roll, Clear removes the critical roll and generated critical proposal rows, then returns to critical pending. When the latest command is a damage result proposal, Clear undoes that proposal and returns to defender D1/D2 with hit location still rolled. When the latest command is a hit-location roll, Clear removes the location result and returns to defender D1/D2 location pending. When the latest command is SU completion, Clear removes that SU marker and returns to the participant's SU cell without touching committed damage/effect rows. Legacy clearing a resolved P1/P2 without a later command resets parry plus dependent damage/effects status while keeping the attack and returns to the defender's P1/P2 cell. Clearing D1/D2 without a later command resets damage/effects scaffold state while keeping attack and parry, returning to D1/D2 when damage review is ready or P1/P2 when damage is not ready. Clearing removes matching snapshots for the undone command or fallback selected substep and dependent A/P/D chain so stale results do not remain visible; for `commit_phase_damage`, it also removes only the source-linked combatEffects rows created by that command.

Initiative is recorded per participant during i1 and i2 using open-ended 1d6: roll a d6, add it, and keep rolling while the result is 6. The character/equipment section remains a theoretical pre-encounter view and shows `I` without live encounter effects or a roll; Player Combat and the Combat Round Manager show the live initiative result. The combat round state stores the individual rolls, the die total, the derived initiative base, the live modifier adjustment, and the final result. Initiative has its own GM-controlled combat modifier bucket. Spreadsheet-era `Game sheet!G10/G11` initiative entries map to this GM-reviewed situational Initiative bucket rather than to a separate modern calculation path. General/Fatigue and Initiative raw modifiers are summed, passed through the workbook percentage modifier helper against the base initiative, and then the open-ended d6 roll is added. Skill/OB and DB/Parry do not affect initiative unless later rules explicitly add them. For example, `I 3`, General/Fatigue `-1`, and Initiative `+2` make a raw live modifier of `+1`; the app applies `percentageAdjustment(3, +1)` and then adds the open-ended d6 roll. The action-result display follows the skill-roll calculation style, for example `Main: I 3 + [Gen/Fatigue + Initiative] -1 + roll 7 = 9`. Initiative cells show the final initiative result instead of a done marker after rolling. During action/review phases, the round grid sorts rolled participants by highest initiative first and leaves unrolled participants at the bottom without a position. The GM inspector can report the selected participant's initiative roll, total, and position for the relevant phase; player-facing rank/order appears only after the phase initiative set is complete.

Parry context belongs in the phase panels rather than the action selector. The relevant phase panel records per-item parry coverage intent for the main hand and off hand/shield; opponent/location awareness is intentionally not shown in this compact panel pass. Coverage directions use the explicit direction wheel from left/backward through right/backward; the current first pass clamps two-steps-right coverage at the edge rather than wrapping because no source rule has approved wraparound yet. The Combat Round Manager inspector is a context/time view: phase mini tables show effective values for the selected participant and selected step/context, including relevant round/phase modifiers from declared actions, General/Fatigue, OB/Skill, DB/Parry, active committed combatEffects, and manual GM modifiers. Situational resolution modifiers, such as the attack-result parry penalty, apply only when the selected context is that specific incoming attack/parry resolution; they do not follow the participant into unrelated later attacks or inspections. During P1/P2 review after a hit or grazing hit, the GM chooses the defender's available main-hand and off-hand parry sources for that selected incoming attack and rolls open-ended `1d20`. The calculation is `Parry/P base + modifier adjustment + roll total`, with success at `21` or higher. The modifier adjustment uses General/Fatigue, DB/Parry, and the stored attack-result defender parry modifier through the same percentage adjustment model used for live DB/P. The parry report starts from the selected base parry source, then shows raw components such as DB/Parry and attack result once before the adjusted pre-roll P value. Detailed modifier breakdowns live in Action result rather than the compact mini tables. This first implementation assumes valid direction and coverage and does not allocate parry sources across multiple opponents.

Attack target and target location also belong to the phase panel. The Target dropdown appears above Attack location in attack-capable phases and records a phase-specific participant target; player options are limited to visible encounter participants, while the GM can choose from active encounter participants except the acting participant. Every phase that contains an attack requires a selected target before the declaration can be saved; Attack - Parry requires a Phase 1 target, Parry - Attack requires a Phase 2 target, Double Attack requires targets in both phases, and Adjust Range - Attack requires a Phase 2 target. The target location selector records No target, Head, Right arm, Left arm, Chest, Abdomen, Right leg, or Left leg for the phase that includes the attack, and aimed target location remains optional. Current A1 and A2 attack resolution records hit, miss, or grazing hit. P1/P2 can display the incoming attack result and manual parry result. D1/D2 can display the attack/parry result, attacker-rolled hit location, command-backed damage result proposal, attacker-rolled critical result when present, critical-table proposal text/warnings/effect drafts, compact GM review overrides, manual immediate effect rows, and committed phase-damage status. Committed phase damage writes source-linked JSON-backed combatEffects rows immediately using the effective reviewed proposal values, while live armor-modifier application from equipped armor, automatic critical/effect application, and richer typed wound/effect rows remain future work.

Critical effects are table-driven proposals, not automatic commits. After the attacker rolls the D1/D2 `roll_critical` 2d8 result, the app maps the weapon damage class/MC, selected hit location, and final critical roll to the canonical critical table. If the mapping is safe, the D1/D2 review panel shows the critical title and full text, rolls any table-contained dice such as duration or bleed-rate dice, and adds source-linked editable draft rows to Additional immediate effects. If family, location, or index mapping is unsupported or ambiguous, the review panel shows warnings instead of guessing. GM review remains required before any critical-derived rows are committed. Physical critical rows use minimum total damage floors, not a second normal damage stream; rows that cannot yet be represented as safe typed combatEffects become editable special/note drafts. Commit phase damage writes only the accepted reviewed rows through the existing `commit_phase_damage` path, and Clear after `roll_critical` removes the critical roll plus generated critical proposals while preserving attack, parry, hit location, and the base damage proposal.

Attack - Parry currently creates one generated phase 1 DB/Parry modifier: `-4`, duration `1`, details `attack parry`. Parry - Attack mirrors this in phase 2 with one generated DB/Parry modifier: `-4`, duration `1`, details `parry attack`. Double Attack is modeled as an attack in Phase 1 and an attack in Phase 2; it creates generated Skill/OB `-1` and DB/Parry `-4` modifiers in both phase 1 and phase 2, each with duration `1` and details `double attack`. Adjust Range - Attack is currently an adapted declaration-level implementation only: Phase 1 is an adjust-range manoeuvre with generated DB/Parry `-2`, duration `1`, details `adjust range`, and Phase 2 is an attack with generated DB/Parry `-4`, duration `1`, details `adjust range attack`. Full distance/range state, opposed movement resolution, wrong-distance penalties, and attack resolution are deferred. Repeated saves keep generated action lines idempotent, and changing away from the matching action removes generated lines without deleting manual modifiers. If a GM manually removes a generated action line while the action remains selected, a later declaration save may recreate it because the line is derived from the action choice. Phase 2 initiative consequences for Parry - Attack remain a follow-up after phase 1 defense results are modeled.

Canonical reusable rule tables, including to-hit and hit location, live in Admin -> Tables. Page/workflow docs may explain how tables are used, but should avoid duplicating the canonical table rows.

Combat Panel is part of the Encounter workflow. It is separate from Character control for now: Character control tracks the current character/loadout/physical state, while the Combat Panel is the scenario or encounter workspace for combat action context. Future damage tracking, round recording, and combat-effect automation should build on these workflows without rendering inactive placeholders.

GM player-facing operation is separate from GM tooling. Player skill rolls is not embedded inside the GM Skill rolls manager, and Player combat is not embedded inside the GM Combat Round Manager. GM operation uses the same participant picker/shuffler pattern as Character control and does not require logging in as that player. Player-facing behavior remains controlled by normal access and visibility rules; normal players can only operate their own controlled participant.

Current design rules:

- Encounter participants are actors in a specific encounter.
- Encounter participants are not the same as campaign roster entries.
- Encounter participants are not automatically the same as scenario participants once the GM explicitly controls encounter membership.
- Encounter default fallback is an internal read-model behavior and should not be exposed to players.
- If an encounter has never had explicit participant membership, the app may internally treat active concrete scenario participants as eligible for access.
- Once explicit encounter membership is controlled, player access should follow explicit encounter membership only.

Player-facing Encounter pages should not show:

- GM-only notes.
- GM action log.
- Silent or GM-only rolls.
- Visibility-grid internals or controls.
- Hidden participants.
- Hidden opponent names or results.
- Admin-only controls.
- Raw session JSON, read-model source names, fallback labels, or internal IDs.

## Character Workspace

The Character workspace answers: "What can this character do and control right now?"

Current first-pass rule:

- The Character page intentionally reuses the existing Equip Items interface as its equipment/loadout core.
- Equip Items remains available as its own route.
- Character control belongs in the Campaign/Scenario/Encounter workspace, not the general Characters section.
- Player Character tab shows only the player's current controlled scenario or encounter character.
- GM Character tab lets the GM inspect and shuffle through character-backed scenario or encounter participants.
- Character control now includes a Physical state panel with Hitpoints and damage, Combat effects by sum, and Combat effects.
- Combat events describe what happened. Combat effects are the canonical tracked state rows caused by those events.
- One combat event may create multiple combat effect rows, and each effect keeps its origin through `sourceEventId`.
- Combat effects should be displayed as a compact list during play, with the editor/tool row attached to the Combat effects list rather than separated above the summaries.
- Detailed fields belong in the selected effect editor/tool row, not as a permanently wide table.
- Effect Type is the player-facing/effect kind; Effect Group is the mechanical modifier bucket used for summaries.
- Combat effect summaries currently include General, OB/Skill, DB, Bleed, Internal bleed, Fatigue, and Special. Other is not a normal current combat-effect bucket.
- Event ids and source labels are internal. The list displays compact event numbers such as `E1`, `E2`, and `E3` so shared-origin rows are readable during play.
- The editor uses two compact lines: an event line for Round and Description, then an effect line for Type, location, damage, Group, modifier, duration, status, and details.
- Event labels are generated by the app. The GM primarily edits the event description and effect details fields.
- Multiple effect rows may share one event/source. Multi-location damage should be represented as multiple effect rows under the same event instead of one oversized row.
- Later healing, first aid, duration, or recovery changes should modify or supersede the existing combat effect row rather than creating an unrelated effect.
- Narrative and combat event history continues to belong in the encounter/action log, not a separate Character page event log.
- GM users can manually add combat effect events from the Character workspace as the first authoring workflow; player views remain read-only.
- Detailed damage application, bleed, stun, fatigue, duration processing, mental/combat effects, GM-set modifiers, adjusted stats, and combat action modules are future rule work.
- Future modules should not appear as visible placeholders until they are actionable.

## Player-Facing Copy Rules

Player pages should avoid admin/internal mechanics. If a player cannot act, the page should explain the actionable circumstance, not the implementation reason.

Visual placeholders for unimplemented features should not be rendered. If a feature is not available yet, omit it unless the player needs an actionable empty state.

Explanatory text should be minimal and only used for actionable circumstances. Prefer concise messages that tell the player what is true now or what they can do next.

Good examples:

- Skill not known (-3 default). GM may adjust or forbid.
- You are not assigned to this encounter.
- No active scenario is currently available.

Bad examples:

- Participants: 2 active scenario participants (default)
- Visibility model: all_active_participants
- Future phases will add...

## Responsibility Checklist

Campaign pages should focus on campaign availability and navigation.

Scenario pages should focus on concrete scenario actors, accessible encounters, and player-safe scenario context.

Encounter pages should focus on the current moment of play, player-safe visibility, situation, and visible participants.

Skill rolls pages should focus on GM roll assignment and GM roll management.

Player skill rolls pages should focus on assigned rolls, current ranked results, and concise player-safe roll logs.

Player pages should always prefer safety over completeness. If the system cannot confidently show something without revealing GM-only information, it should show less.
