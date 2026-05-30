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

Player Combat owns the canonical combat-action declaration UI. During the DE step, players choose Action, Secondary action, Movement, and Description, then commit with Declare action. Committing stores the declaration on the participant combat state and freezes the player controls for that round. Combat modifiers are GM-controlled; players may see General/Fatigue, Initiative, Skill/OB, and DB/Parry values but cannot add, edit, or delete modifier entries. DB/Parry is stored internally with the backward-compatible `situationDb` key, but it applies to both DB and Parry/P in encounter-context combat. The phase panels are compact consequence summaries, not large forms: attack rows show weapon, I, OB, DMB, AM, and MC, while defense/parry rows show source, DB, DM, and P. The modifier editor uses compact Mod, Dur, and Details fields for GM-entered manual modifiers; Dur records an optional number of rounds. The GM Combat inspector mirrors the same declaration selector for the selected participant; the GM can save or revise participant declarations and modifiers at any round step for NPCs, absent players, corrections, and testing.

Phase 1 and Phase 2 are separate combat phase contexts. Each phase can hold its own attack target location, defense/parry direction choices, and future opponent, modifier, and result snapshots. Generated action modifiers are phase-aware: Phase 1 generated rows only appear in Phase 1 views, Phase 2 generated rows only appear in Phase 2 views, and broad manual modifiers without a source phase can appear in no-phase, Phase 1, and Phase 2 views. No-phase views such as Declaration and Round summary do not sum phase-specific generated modifiers together as active modifiers. When Phase 1 is resolved later, its saved context should become historical and must not keep changing while Phase 2 is edited. Future committed steps should preserve a step/phase snapshot; until those snapshots exist, selecting a prior GM grid cell shows a phase-aware live view of the current declaration state. Phase 2 may differ because positioning, opponents, parry coverage, target location, or situational modifiers can change after Phase 1. Future combat rules should write phase-specific context and result data into the matching phase slot rather than treating both phases as one shared live context.

Player Combat shows human-readable step names such as Declare action, Review modifiers, and Phase 1 initiative. Compact timeline abbreviations such as DE, M1, and i1 are GM round-grid headers only. Player Combat shows `Waiting for GM` when the player cannot currently act, including after declaration, after initiative is rolled, or after the GM has advanced past a player-editable step. GM-facing Player Combat and Combat inspector action buttons use step-aware labels such as Declare action, Declare modifiers, Roll phase 1 initiative, and Review phase 1 effects. These labels prepare the workflow for later step-specific tools without changing combat resolution in this pass.

The Combat Round Manager advances the shared round timeline. Its Advance button commits the current step for the round and moves to the next step even if some participants have not declared. Non-initiative cells use consistent semantic markers: neutral means no data, a done marker means submitted/reviewed/completed, and a locked marker means the step is closed without submission. DE cells show declaration state, not “active participant” state. M1/M2 can be marked reviewed even when the GM enters no modifier values. The GM can use arrow keys to move the selected timeline cell when focus is on the grid, and participant-specific inspector saves move the selection down to the next participant. Commit and clear actions return focus to the round table so the updated column is visible. The GM can also Clear current step to correct the current timeline column and rewind one step; clearing DE resets declarations and action selections for the current round, while clearing later steps leaves earlier submitted declarations intact. Clearing does not delete the encounter/action log or Combat Effects in the first implementation.

Initiative is recorded per participant during i1 and i2 using open-ended 1d6: roll a d6, add it, and keep rolling while the result is 6. The character/equipment section remains a theoretical pre-encounter view and shows `I` without live encounter effects or a roll; Player Combat and the Combat Round Manager show the live initiative result. The combat round state stores the individual rolls, the die total, the derived initiative base, the live modifier adjustment, and the final result. Initiative has its own GM-controlled combat modifier bucket. Spreadsheet-era `Game sheet!G10/G11` initiative entries map to this GM-reviewed situational Initiative bucket rather than to a separate modern calculation path. General/Fatigue and Initiative raw modifiers are summed, passed through the workbook percentage modifier helper against the base initiative, and then the open-ended d6 roll is added. Skill/OB and DB/Parry do not affect initiative unless later rules explicitly add them. For example, `I 3`, General/Fatigue `-1`, and Initiative `+2` make a raw live modifier of `+1`; the app applies `percentageAdjustment(3, +1)` and then adds the open-ended d6 roll. The action-result display follows the skill-roll calculation style, for example `Main: I 3 + [Gen/Fatigue + Initiative] -1 + roll 7 = 9`. Initiative cells show the final initiative result instead of a done marker after rolling. During action/review phases, the round grid sorts rolled participants by highest initiative first and leaves unrolled participants at the bottom without a position. The inspector reports the selected participant's initiative roll, total, and position for the relevant phase.

Parry context belongs in the phase panels rather than the action selector. The relevant phase panel records per-item parry coverage intent for the main hand and off hand/shield; opponent/location awareness is intentionally not shown in this compact panel pass. Coverage directions use the explicit direction wheel from left/backward through right/backward; the current first pass clamps two-steps-right coverage at the edge rather than wrapping because no source rule has approved wraparound yet. This is context capture only and does not implement final parry legality, hit-location, or coverage resolution.

Attack target and target location also belong to the phase panel. The Target dropdown appears above Attack location in attack-capable phases and records a phase-specific participant target; player options are limited to visible encounter participants, while the GM can choose from active encounter participants except the acting participant. The target location selector records No target, Head, Right arm, Left arm, Chest, Abdomen, Right leg, or Left leg for the phase that includes the attack. If an attack later hits, hit location is rolled on a closed `1d20`. An aimed location lets the attacker roll twice and use the roll closer to the target location, with ties using the first roll. This pass records the phase-specific declaration and helper rules only; full attack, damage, and critical resolution remain future work.

Attack - Parry currently creates one generated phase 1 DB/Parry modifier: `-4`, duration `1`, details `attack parry`. Parry - Attack mirrors this in phase 2 with one generated DB/Parry modifier: `-4`, duration `1`, details `parry attack`. Double Attack creates generated Skill/OB `-1` and DB/Parry `-4` modifiers in both phase 1 and phase 2, each with duration `1` and details `double attack`. Repeated saves keep generated action lines idempotent, and changing away from the matching action removes generated lines without deleting manual modifiers. If a GM manually removes a generated action line while the action remains selected, a later declaration save may recreate it because the line is derived from the action choice. Phase 2 initiative consequences for Parry - Attack remain a follow-up after phase 1 defense results are modeled.

Canonical reusable rule tables, including hit location, live in Admin -> Tables. Page/workflow docs may explain how tables are used, but should avoid duplicating the canonical table rows.

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
