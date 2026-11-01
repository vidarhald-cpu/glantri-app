# Combat Declarations — Actions, Secondary Actions and Movement

**Status:** Product Owner approved

**Date:** 2026-09-15

**Scope:** Combat declaration model only. This document does not redesign the complete combat engine or define all resolution modifiers.

**Provenance:** Faithful transcription of the Product Owner-approved specification from
ChatGPT task _Current Combat Inventory_ (`6aa8e60f-0ec8-83eb-b14d-1767b61edfc3`),
assistant message `7a609190-547b-48ee-a415-419a8701531d`, approved for durable
transcription on 2026-09-15. The latest explicit Product Owner clarification
permits **zero or more** required Skill rolls and **zero or more** required Stat
rolls in section 5.2, superseding the source's “one or more” wording. This is an
approved specification, not a claim of implemented mechanics. The Product Owner's
2026-09-17 Combat Declaration UX ruling further controls the single player-facing
declaration surface, Perform Task adjudication boundary, secondary-action details,
movement fields, and adjacent Item-location dependency recorded below.

## 1. Core principle

A combat declaration records the character's **intended plan for the whole combat round**.

It does **not** assert that the plan is feasible, legal in the current physical situation, or successfully executed.

Players declare their intentions without seeing the other players' declarations. This permits effectively simultaneous declaration of intent while giving the GM the information needed to resolve the round.

The application should assist declaration through sensible defaults and pre-population, but should avoid enforcing combinations that require a complete simulation of the physical situation.

Player Combat has one declaration system:

> **Primary Action + Secondary Action + Movement**

Relative position, movement direction, facing, and action-specific details are
structured parts of those three dimensions. There must not be a parallel
player-facing `Actions and tasks`, generic-action, or similar declaration workflow.
Players record intent here; the GM adjudicates it through the established Combat
workflow.

Recorded from the 2026-09-17 Combat Declaration UX ruling: the standalone player
panel that combined `Items in this Combat`, generic action/task declaration, Skill
or Perception selection, Difficulty, and timing was a known nonconforming surface.
It is not part of the target declaration architecture. Removing or replacing it
required separately authorized implementation.

**Status, 2026-11-01: discharged — that panel no longer exists.** Its generic
action and task half was deleted with `GenericCombatActionPanel` under Forgejo
issue #335. Its Item half was removed from the Combat declaration and inspector
surfaces under Forgejo issue #834, by Product Owner authorization for Alpha with
no replacement panel and no Item operation offered anywhere on those surfaces;
current behaviour is in
[Combat Round, Loadout and Actions section 5](./combat-round-and-actions.md#5-items-in-the-fight).
The principle above therefore constrains new work; it no longer describes a mounted
surface awaiting removal.

For example:

- a player may declare movement to the right even though a wall ultimately prevents it;
- a player may attempt to decrease distance to an opponent while choosing a movement direction that makes that impossible;
- a defending character may choose not to retreat, even though this may cause a DB penalty or make maintaining distance difficult;
- a primary action, secondary action and movement plan may together prove incompatible.

Such cases are normally resolved by the rules and/or GM rather than rejected by the declaration UI.

## 2. Declaration structure

A round declaration consists of separate dimensions:

1. **Primary Action**
2. **Secondary Action**
3. **Relative Position**
4. **Movement Direction**
5. **Facing**
6. Conditional specifications and comments where required

Each selector must permit the player or GM to leave it blank where appropriate or explicitly choose **Pass** where that distinction is meaningful.

The system should not collapse these dimensions into compound action choices except where a compound action represents a distinct combat tactic in its own right.

---

## 3. Primary Actions

The declaration catalogue includes the existing implemented combat actions plus the following required actions:

- Single Attack
- Double Attack
- Reactive Attack
- Feint–Attack
- Adjust Distance and Attack
- Parry
- Offensive Parry
- **Pass**
- **Perform Task**
- **Break Off Combat**

The existing generic **Other** action is unnecessary once `Perform Task` exists and should be removed.

### 3.1 Adjust Distance and Attack

`Adjust Distance and Attack` remains a distinct primary action.

It represents a deliberate whole-round combat tactic: the character first attempts to create the desired fighting distance or opening and then attacks.

It must not be reduced to merely:

`Attack + relative movement preference`

because the allocation of the round to adjusting distance and subsequently attacking is itself the tactic being declared.

### 3.2 Pass

`Pass` means that the character intentionally performs no primary action.

It is distinct from an undeclared/unfinished action selection.

### 3.3 Perform Task

`Perform Task` covers substantial activities that require the character's primary attention and therefore replace ordinary participation in combat for that round.

Examples include:

- picking a locked door while allies hold off attackers;
- prying open a blocked door;
- operating machinery;
- carrying out another substantial physical or skilled task.

The declaration must contain a description of what the character is attempting.

Perform Task uses the shared **Combat Task** structure defined below.

`Perform Task` is selected through the ordinary Primary Action selector. It must not
open or depend on a separate generic-task declaration panel.

The player describes the intended task. The player does not select the authoritative
Skill, Difficulty, success or failure, timing, or mechanical outcome. The GM later
adjudicates the declaration through the normal Combat workflow and may:

- select or attach an appropriate Skill or roll;
- set Difficulty;
- attach timing or round requirements where appropriate; and
- determine what the attempt reveals or changes.

The player-facing declaration must not require the player to make those GM decisions.

### 3.4 Break Off Combat

`Break Off Combat` is a specific combat manoeuvre, not simply backward movement.

Its purpose is to get the character outside melee reach.

There is an existing canonical manoeuvre rule/table governing relevant OB/DB effects and the outcome. The precise rule should be recovered when this action is implemented rather than recreated from memory.

A successful break-off normally leaves the character approximately **3–4 metres away from the melee** and positioned to run or otherwise continue escaping.

Situation-specific consequences remain subject to normal adjudication.

---

## 4. Secondary Actions

Secondary Action choices are:

- **Pass**
- **Observe**
- **Shout / Talk**
- **Equip / Unequip**
- **Small Action**

A secondary action is attempted alongside the character's primary action.

Its presence does not guarantee that the combination is possible. The GM may determine that the action cannot be performed together with the declared primary action or may apply appropriate penalties.

### 4.1 Pass

The character intentionally performs no secondary action.

### 4.2 Observe

Observe is the existing combat observation mechanic.

It may only be combined with:

- **Pass** as the primary action; or
- **Parry** as the primary action.

Observe is distinct from general perception/searching.

### 4.3 Shout / Talk

The character attempts meaningful communication during the combat round.

Its declaration context should expose:

- a structured utterance-type selector; and
- a short text field containing what the character says.

This is a declaration aid, not a separate communications subsystem.

The approved utterance-type vocabulary is:

- **Speak**;
- **Shout**;
- **Whisper**; and
- **Other**.

The selector is accompanied by the short text field containing what the
character says.

These utterance types are roleplay and declaration structure only. They carry no
automatic mechanical effect: they do not modify rolls, initiative, detection, or
any other resolved combat value. A GM may still adjudicate consequences in play,
as with any other declared intent.

### 4.4 Equip / Unequip

`Equip / Unequip` records an intended equipment manipulation in a short text field.
Examples include:

- drawing or sheathing a weapon;
- dropping a weapon or shield;
- picking up an Item; and
- switching equipment.

The declaration does not change authoritative equipment state. During adjudication,
the GM may apply the equipment change through the ordinary controls, determine that
it cannot be completed as declared, or decide that the circumstances make it a task
requiring a roll or Difficulty. This declaration contract does not create bespoke
mechanical resolution for individual equipment manipulations.

### 4.5 Small Action

A Small Action is a limited activity that the character attempts while continuing to perform their primary action.

Examples include:

- holding onto a rope;
- pushing a door closed;
- similar minor physical activity.

There is no fixed rule that a Small Action must complete in one round. It may continue for multiple rounds.

The relevant criterion is whether the activity can reasonably be performed **without replacing the declared primary action**.

For example:

- holding a rope while parrying may be possible;
- pushing a door closed while parrying may be possible;
- manipulating something while throwing a dagger might be permitted with an OB penalty;
- other combinations may be impossible.

These decisions remain subject to GM/rules adjudication.

Small Action uses the same shared Combat Task structure as Perform Task.

---

## 5. Combat Tasks

`Perform Task` and `Small Action` use a common underlying **Combat Task** model.

Their difference is action economy:

- **Perform Task:** the task is the character's primary action.
- **Small Action:** the task is attempted concurrently with a primary action.

### 5.1 Player-facing task information

A Combat Task should support at least:

- description;
- optional target/subject;
- optional additional comment.

The action panel should expose the task description directly. Task specification should not depend solely on a general-purpose combat comment field.

These are declaration facts. Required Skill or Stat rolls, Difficulty, authoritative
timing, progress, success, failure, and mechanical outcome remain GM-controlled.

### 5.2 GM-controlled resolution information

The GM must be able to assign and change:

- zero or more required **skill rolls**;
- zero or more required **stat rolls**;
- the number of rounds until a check may be made;
- task status/progress;
- relevant GM notes.

The initial implementation does **not** require integrated combat skill-roll resolution.

The existing separate skill/stat roll facility can be used. Combat may provide a convenient trigger/link into that facility.

### 5.3 Timer

The timer is first-class Combat Task state.

It represents:

> **Rounds remaining until the next task check/resolution point.**

It does not necessarily represent fixed time until automatic completion.

Example:

`Pick lock → Lockpicking check in 3 rounds`

After the check the GM may decide:

- task complete;
- task failed;
- another check is allowed immediately;
- another check is allowed after N additional rounds;
- required skill/stat changes;
- timing changes because circumstances changed.

The GM must therefore be able to alter both the timer and check requirements while the task is active.

A task may persist over multiple combat rounds.

---

## 6. Relative Position

Relative Position describes the spatial relationship the character is trying to achieve or preserve relative to other people or a formation.

Supported intentions include:

- **Keep distance to a specified person**
- **Adjust distance to a specified target**
- **Hold formation**

The referenced person may be friend or foe.

A character may have **multiple simultaneous relative-position intentions**.

For example:

1. Keep appropriate fighting distance from Enemy A.
2. Remain beside Ally B.
3. Hold formation with the shield line.

Where multiple intentions exist, the declaration should support **priority**.

### 6.1 Keep Distance

The player chooses a specific person and intends to maintain the current or specified relationship/distance.

### 6.2 Adjust Distance

The player specifies:

- target;
- desired distance;
- intended speed.

This represents the desired spatial result. It does not guarantee that it can be achieved.

### 6.3 Hold Formation

This records the intention to remain in an established combat formation.

It anticipates future formation mechanics such as shield formations/phalanxes.

The declaration capability can exist before those future formation rules are implemented.

---

## 7. Movement Direction

Movement Direction records the absolute direction in which the character intends to move.

Choices are:

- Forward
- Forward/right
- Right
- Backward/right
- Backward
- Backward/left
- Left
- Forward/left
- None / blank

Relative-position intentions and absolute movement direction may be declared together.

They need not always be mutually achievable.

For example, a character may declare:

> Adjust distance toward an opponent + move forward-right.

Whether that movement actually reduces the distance depends on the situation.

Player-facing movement declaration does not include generic `How` or `Expected time`
fields. Such fields require a separate approved game rule. The declaration UI does
not reject movement merely because the current situation may make it impossible.

---

## 8. Facing

Facing records the direction/orientation the character intends to maintain or reach.

Choices use the same eight-direction model:

- Forward
- Forward-right
- Right
- Back-right
- Back
- Back-left
- Left
- Forward-left

Facing is independent of Movement Direction.

A character may therefore:

- retreat while continuing to face forward;
- sidestep while facing an opponent;
- remain stationary and change facing.

---

## 9. Item ownership and location dependency

Combat consumes ordinary Character and Encounter Item state. It does not create a
third `Items in Combat` ownership or location model.

An Item given to a Character enters that Character's ordinary inventory and should
normally default to being on the character's person. Receipt must not create a
special Combat questionnaire or player reconciliation workflow. Equipping, wielding,
dropping, and similar changes use ordinary Character/Combat controls and GM
adjudication.

Items physically present in an Encounter belong to the Encounter context. The GM may
see Encounter Items, while players may see only Encounter Items visible to them.

The controlling cross-domain contracts remain:

- [Canonical Field Equipment v1 authority](../decisions/architecture/0004-canonical-field-equipment-v1.md)
  for durable Item identity, Character inventory, Scenario projection, pickup,
  transfer, drop, and authoritative mutation; and
- [Campaign, Scenario, and Encounter workflows](../product/campaign-scenario-encounter-workflows.md)
  for Encounter ownership, visibility, and the single Player Combat surface.

This declaration document records only how Combat refers to those states. It does not
implement or redefine Item persistence or equipment mechanics.

### 9.1 Existing cross-domain wording to reconcile

The current Field Equipment and Scenario workflow documents describe an unheld
Campaign-context Item that is made available in a Scenario. The later Product Owner
ruling above states that an Item physically present in an Encounter belongs to that
Encounter context. Future Equipment/Encounter activation must reconcile those two
descriptions without creating a separate Combat Item identity or ownership system.
This documentation task records the conflict and the later target rule; it does not
choose a persistence representation or migration.

---

## 10. Defaults and declaration carry-forward

Combat selectors must **not start blank every round by default**.

At the beginning of a new declaration step, the application should normally create an editable draft based on the character's previous-round declaration.

The reasoning is both practical and simulation-oriented:

> A combatant who was attacking the same opponent or maintaining the same tactical relationship last round will commonly intend to continue doing so.

Carry-forward applies, where relevant, to:

- primary action;
- target;
- weapon/attack source choices;
- secondary action;
- relative-position intentions;
- priorities;
- target distances;
- speed;
- movement direction;
- facing;
- other structured action configuration.

The copied declaration remains **unsubmitted** until confirmed by the player or GM.

It is a suggested continuation of intent, not an automatic declaration.

The same behaviour applies to PCs and GM-controlled NPCs.

### 10.1 Persistent tasks

An ongoing Combat Task is not merely copied as a new task.

Its existing identity and state continue across rounds, including:

- description;
- remaining timer;
- required rolls;
- progress/status.

The new declaration allows the character to continue the ongoing task or abandon/change it.

### 10.2 Invalid or stale previous choices

The application must not silently substitute another choice.

For example, if the previous target is no longer valid, it must not automatically select another opponent.

The old choice may be displayed as unavailable or require correction.

### 10.3 Action-based defaults

When no previous declaration provides an appropriate value, selecting an action may pre-populate sensible related choices.

For example, choosing Parry may suggest:

- backward movement;
- facing the attacker;
- maintaining appropriate distance.

These are suggestions only. The player may override them.

---

## 11. Declaration versus resolution

The declaration UI should remain permissive.

It may:

- pre-populate likely choices;
- provide contextual suggestions;
- warn about obvious conflicts where useful.

It should generally **not** prohibit plans merely because they appear tactically poor, disadvantageous, or physically impossible based on information the current application cannot fully simulate.

The GM and combat-resolution rules determine:

- feasibility;
- resulting movement;
- modifiers;
- conflicts between intentions;
- success or failure.

This separation is intentional.

---

## 12. Perception and visibility — deferred

General perception/searching may later use the Combat Task mechanism.

Examples:

- spend the round searching for a hidden opponent;
- listen for movement behind a door;
- make a limited secondary attempt to inspect an area while fighting.

This is distinct from the existing **Observe Opponent** mechanic.

Character-specific encounter visibility/awareness is also required eventually so that a player cannot target an entity merely because the **player** knows it exists.

However:

> **Encounter visibility and awareness are explicitly deferred from the present action/movement work.**

The eventual system should distinguish character knowledge from player metaknowledge without requiring the initial implementation to provide a full geometric line-of-sight simulation.
