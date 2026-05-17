# Campaign, Scenario, and Encounter Workflows

This guide defines the product responsibilities for the Campaign, Scenario, and Encounter workspaces. These pages should help GMs and players understand what they can do now without exposing admin-only state, internal read-model mechanics, or future implementation notes.

## Workspace Boundaries

Character development, Campaign, Scenario, and Encounter are separate workspaces.

Character development is where a character is created, advanced, equipped, and reviewed. It is about who the character is over time, not where they are currently present in play.

Campaign is the broad container for play. It manages the campaign roster, campaign-level context, and which characters or templates are available for use in that campaign.

Scenario is a concrete story situation inside a campaign. It manages the actors who are currently part of that scenario and the scenario-level setup used by encounters.

Encounter is a specific moment of play inside a scenario. It manages the actors who are present in that encounter, the current player-facing situation, and encounter-specific resolution such as roleplay rolls or combat.

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
- Open the Player Encounter when available.

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
- Assign and resolve roleplay rolls.
- Run combat encounter tools when applicable.
- Review action logs, hidden data, and GM-only roll information.

Player responsibilities:

- Read the player-facing encounter title, context, and situation.
- See only visible PCs/NPCs.
- Resolve assigned non-silent rolls for the player's controlled participant.
- Review player-safe ranked results and character log entries.
- Receive clear empty states when not assigned or when no encounter is available.

Combat Panel is part of the Encounter workflow. It is separate from Character control for now: Character control tracks the current character/loadout/physical state, while the Combat Panel is the scenario or encounter workspace for combat action context. Future damage tracking, round recording, and combat-effect automation should build on these workflows without rendering inactive placeholders.

Current design rules:

- Encounter participants are actors in a specific encounter.
- Encounter participants are not the same as campaign roster entries.
- Encounter participants are not automatically the same as scenario participants once the GM explicitly controls encounter membership.
- Encounter default fallback is an internal read-model behavior and should not be exposed to players.
- If an encounter has never had explicit participant membership, the app may internally treat active concrete scenario participants as eligible for access.
- Once explicit encounter membership is controlled, player access should follow explicit encounter membership only.

Player Encounter pages should not show:

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
- Character control now includes a first Physical state scaffold with Hitpoints and damage, Combat effects by sum, and Combat effects.
- Combat events describe what happened. Combat effects are the canonical tracked state rows caused by those events.
- One combat event may create multiple combat effect rows, and each effect keeps its origin through `sourceEventId`.
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

Encounter pages should focus on the current moment of play, player-safe visibility, assigned rolls, current results, and concise logs.

Player pages should always prefer safety over completeness. If the system cannot confidently show something without revealing GM-only information, it should show less.
