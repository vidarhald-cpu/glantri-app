# Combat states and controllers

## Status and scope

This document defines the canonical vocabulary and ownership rules for persistent combat state and
temporary tactical control. It is an architecture contract for current and future combat mechanics.
The initial concrete consumer is Continued Contact ownership of the existing Round End distance
commit and its later Round End maintenance/escape contest; no parallel controller subsystem or
persistence table is introduced.

The current concrete models remain authoritative:

- `CombatEffect` records participant effects and their initiative timing;
- `ContinuedContact` records the exact Offensive Parry relationship and source lineage;
- `UnbalancedCombatCondition` records the condition created by Continued Contact;
- `CombatProgressionProjection` remains the only source of executable combat work.

These records may be generalized incrementally when a real consumer requires it. A second generic
state collection must not be introduced alongside them merely to mirror the same fact.

## Combat states

A **Combat State** is an authoritative, source-linked fact describing a persistent tactical or
physical condition in an encounter. It survives beyond the mutation that created it and remains
available until its lifecycle says that it is no longer effective.

Examples include:

- Continued Contact;
- Unbalanced;
- Bleeding;
- Fatigue.

A combat state is not automatically a numeric modifier. Depending on its rule, it may:

- contribute one or more modifier facts;
- restrict equipment, movement, or action legality;
- establish a controller relationship;
- qualify a later combat opportunity;
- exist only for presentation and provenance.

Every combat state must have enough canonical identity to answer:

- what kind of state it is;
- which participant or participant pair it concerns;
- which exact command, event, opportunity, result, or relationship created it;
- when it was created and when it becomes effective;
- when it expires or ends;
- which viewers may see it;
- which modifier, capability, restriction, or opportunity consumes it.

The source lineage is part of identity. A live consumer must not recover a state from the latest
attack, current cursor, inspector selection, display label, or participant pair alone.

### Relationship-bearing states

Some combat states establish a relationship between participants. Continued Contact is the first
such state. Its persisted record is both the state fact and the source of the controller
relationship; the relationship is not a duplicate persisted condition.

Other states, such as Bleeding or Fatigue, normally affect one participant and establish no
controller.

## Controller relationships

A **Controller Relationship** is a directional, temporary grant of narrowly scoped tactical
authority from an active combat state.

Conceptually, a relationship identifies:

- the source combat-state ID and kind;
- the controller participant;
- the affected participant;
- the exact granted capability;
- its pending, active, or expired lifecycle;
- the round, phase, initiative group, and source-result lineage that established it.

The initial controller capability is:

| Source state      | Controller capability | Meaning                                                                                                          |
| ----------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Continued Contact | Distance Control      | The controller chooses engagement distance only where the Continued Contact rule explicitly permits that choice. |

Controller status does **not** grant general ownership of the affected participant. In particular,
it does not grant permission to:

- declare the affected participant's action;
- choose their equipment, attack source, or attack mode;
- roll their participant-owned task;
- inspect private calculations;
- bypass a projected task or API authorization.

A future mechanic may add another controller capability only when its rule needs a distinct,
explicit authority. Mechanics must not reuse Distance Control as a generic “controls opponent”
flag.

## Initiative timing

Combat-state effectiveness follows
[combat initiative-group timing](./combat-initiative-group-timing.md).

The canonical effective lifecycle is:

| Status    | Meaning                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pending` | The state is committed, authoritative, and visible, but its creating simultaneous initiative group is still open. Its modifiers, restrictions, capabilities, and opportunity qualifications do not affect sibling work in that same group. |
| `active`  | The activation boundary has passed. The state may contribute its rule-defined modifiers, restrictions, capabilities, and opportunity qualifications.                                                                                       |
| `expired` | The state remains available for history and provenance but no longer contributes authority or mechanics.                                                                                                                                   |

Pending does not mean provisional. Undo removes a pending state only when its source consequence is
undone. Otherwise, the state becomes active automatically when its initiative-group boundary
closes; no GM review or activation command is required.

Current storage schemas may use more specific terminal values such as `ended`, `resolved`,
`superseded`, or `expired`. Those storage reasons remain intact. A consumer treats a stored state as
canonically expired only when it is no longer effective for that consumer. This document does not
require a persistence migration or replace the existing status enums.

For exact initiative ties:

- every sibling opportunity calculates from the same pre-group effective state;
- a newly committed state is visible as pending;
- it cannot modify or control a sibling opportunity in the creating group;
- it becomes active after all source and child work in that group completes.

Reload derives the same effective lifecycle from the state and current initiative-group boundary.
Undoing group completion returns a surviving state to pending. Undoing the source result removes
the state and any state-derived facts through the existing source-lineage cleanup.

## Ownership and authority

Combat uses several independent ownership axes. They must not be collapsed into a single
“controller” or “current participant” field.

| Axis                    | Canonical meaning                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------- |
| State subject           | The participant whose condition, capability, or restriction the state describes.       |
| Relationship controller | The participant granted one named tactical capability over the affected participant.   |
| Affected participant    | The other participant in a directional relationship.                                   |
| Opportunity actor       | The participant who may receive a later canonical opportunity.                         |
| Task required actor     | The participant who must perform the currently projected task.                         |
| Decision authority      | The participant allowed to make one specific rule choice.                              |
| Viewer                  | A user allowed to see a safe projection of the state, relationship, or task.           |
| GM proxy                | GM authority to execute a projected participant-owned task without changing its owner. |

The following authority rules apply:

### Engagement distance

When an active state explicitly grants Distance Control, its controller owns the engagement-distance
choice allowed by that rule. This does not imply authority over unrelated participant pairs,
distance increases or decreases outside the rule, or general round-end distance handling.

Continued Contact is the initial grant of Distance Control. At Round End, one active relationship
suppresses the ordinary opposed Dodge distance contest for that exact participant pair. The
controller receives the existing canonical `distance_commit` task, chooses distance 0–8, and the
choice is committed to the ordinary distance matrix for the next round. The proposal persists:

- controller and affected participant IDs;
- source Continued Contact ID;
- previous and chosen distance;
- reason `continued_contact`;
- next-round applicability.

The affected participant receives no competing roll or choice. The GM may proxy the controller
through the exact projected task. Reload derives the same task, and command undo restores the prior
edge and unresolved controller choice. Unrelated pairs retain ordinary distance resolution.

### Escape contests

After Continued Contact has survived into a later round and that complete round reaches Round End,
maintenance is mandatory for that relationship. The controller owns one ordinary Brawling roll and
the affected participant owns one ordinary Brawling escape roll. The two
`continued_contact_maintenance_roll` tasks share one `parallel_all` execution group, and GM proxy
follows the same descriptor authorization as participant execution.

The affected participant's roll carries `rollPurpose: escape_continued_contact`. The shared
modifier resolver excludes only the Continued Contact–sourced Unbalanced row for that purpose;
other active general, skill, and situational modifiers remain authoritative. The condition is not
temporarily removed.

A strictly higher controller total maintains the relationship and its Unbalanced condition. A
higher affected-participant total or a tie ends both. The terminal contest result retains the
contact, condition, round, participants, both roll identities, and signed comparison. Undoing the
final roll reopens exactly one participant-owned task and restores the prior relationship,
condition, effect, and distance state.

### Declarations

Each participant continues to own their own declaration and declaration choices. A controller
relationship may affect legality or available options once a future rule integrates it, but the
controller cannot submit, replace, or select declaration facts for the affected participant.

## Relationship to Current Action

A combat state or controller relationship never creates an actionable button by itself.

`CombatProgressionProjection` may consume an active state to create a deterministic opportunity and
task. Only that projected task can become Current Action. Its descriptor must retain the exact
state, relationship, participant, opportunity, process, stage, execution-group, initiative-group,
and revision identities required by the command.

Current Action therefore answers “who acts now?” from the task's required actor, not from:

- the state subject;
- the relationship controller;
- the affected participant;
- the inspector selection;
- the latest state of that kind.

A participant whose state may matter later receives an ordinary waiting presentation until
canonical work is projected. Historical inspection of a state never retargets Current Action.

For Continued Contact maintenance, the projected Current Action says **Maintain Continued
Contact** to the controller and **Attempt to escape Continued Contact** to the affected participant.
After either participant rolls, that participant sees a normal waiting state until the parallel
contest completes. No completed maintenance task remains actionable.

## Relationship to the tracker

The tracker represents canonical tasks and recorded results, not passive relationships.

- A pending or active combat state does not create a tracker marker on its own.
- A controller relationship does not mark either participant merely because it exists.
- When a state qualifies a canonical task, the marker belongs to the task's exact round, facet, and
  tracker participant.
- Required-actor ownership comes from the projected task; it is not automatically assigned to the
  controller.
- Expired states remain historical facts but do not create live attention.

Continued Contact maintenance is projected in the source round's `SU` facet. Both unresolved
rollers may be marked while the contest is open; completing one roll clears only that participant's
attention. Distance work remains gated until the contest resolves.

This preserves round isolation and the existing tracker marker contract. Future controller-driven
work must use the same task projection and cannot introduce a relationship-derived marker fallback.

## Relationship to the modifier system

A combat state may produce zero or more modifier-bearing `CombatEffect` facts. The state or its
source relationship provides rule provenance; `CombatEffect` and the shared modifier projection
provide the arithmetic source of truth.

The invariants are:

- one source consequence creates one deterministic effect identity;
- modifier bucket, value, duration, exclusions, target, and initiative timing remain on the
  authoritative effect;
- pending effects are visible but excluded from arithmetic;
- active effects flow through the shared modifier projection;
- expired effects do not contribute;
- relationship existence alone never adds a numeric modifier;
- consumers do not reimplement a state's modifier in a maneuver-specific formula.
- attack and parry descriptors carry the canonical effect cutoff and contribution fingerprint;
  GM proxy and participant execution consume the same resolved modifier facts;
- percentage-bearing skill contributions remain raw workbook percentage inputs until the shared
  workbook adjustment table produces the persisted effective skill.

The current Offensive Parry mapping follows this split:

- Continued Contact is the relationship-bearing state;
- Unbalanced is the affected-participant condition;
- its linked combat-wide `general` effect contributes the canonical −2% modifier;
- `escape_continued_contact` excludes that Unbalanced contribution under the existing rule.

Because Unbalanced is combat-wide General state, it participates in ordinary attack and parry
validation through the shared contribution resolver. It must not be omitted merely because a
presentation context separately lists DB/Parry rows. Offensive Parry parry-quality Brawling
contributions likewise remain percentages: a raw `+2%` is table-adjusted with the base skill rather
than added as two points.

When maintenance ends Continued Contact, the relationship and `UnbalancedCombatCondition` become
terminal in the same domain mutation and the linked Unbalanced `CombatEffect` becomes expired in
the participant state. A maintained relationship leaves all three facts active. This synchronization
prevents a live Unbalanced modifier without its source Continued Contact relationship.

Bleeding and Fatigue are already represented by participant combat effects. They are Combat States
under this vocabulary but do not require separate controller records.

## Relationship to combat opportunities

An active state or controller capability may be a prerequisite for a combat opportunity. It is not
itself an opportunity and does not authorize execution.

A state-qualified opportunity must be deterministic and bind, where relevant:

- the source state and relationship IDs;
- controller and affected participant IDs;
- the exact source command, event, opportunity, and result lineage;
- round, phase, initiative group, and effect cutoff;
- action index or opportunity slot;
- any declared source, mode, target, or distance identity.

The progression projection creates the task only while all prerequisites are valid. Expiration,
undo, cancellation, equipment invalidation, or source-result removal must remove or cancel the
derived opportunity through exact lineage. No consumer may substitute a newer state, another
participant pair, or the first compatible source.

Continued Contact maintenance is an implemented state-qualified Round End child process. Its
deterministic contest ID binds the source contact and maintenance round; its two tasks bind exact
contest/contact, participant/opponent, process, stage, execution-group, purpose, and revision
identity. The Round End distance choice remains a separate use of the existing distance proposal
and commit process.

## Current model mapping

| Current fact                         | Canonical interpretation                                                                                   | Current effect                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ContinuedContact`                   | Relationship-bearing Combat State with controller, affected participant, and exact Offensive Parry lineage | Supplies the controller for the exact pair's Round End engagement-distance choice.           |
| `UnbalancedCombatCondition`          | Participant Combat State sourced by Continued Contact                                                      | Identifies the affected participant and canonical −2% consequence.                           |
| Linked Unbalanced `CombatEffect`     | Modifier-bearing effect derived from Unbalanced                                                            | Supplies shared combat arithmetic and initiative timing.                                     |
| `ContinuedContactMaintenanceContest` | Round End state-qualified contest                                                                          | Supplies two participant-owned Brawling tasks and either maintains or ends the relationship. |
| Bleed/Fatigue `CombatEffect`         | Participant Combat State represented directly as an effect                                                 | Supplies its existing damage, modifier, duration, and review behavior.                       |
| `CombatProgressionTask`              | Executable work, not state ownership                                                                       | Supplies required actor, tracker facet, descriptor, and authorization identity.              |
| Committed declaration                | Participant-owned intent, not a controller relationship                                                    | Supplies declared action facts and opportunity prerequisites.                                |

## Future consumers

New mechanics should first identify their state and authority needs, then reuse these concepts rather
than adding maneuver-specific ownership rules.

### Offensive Parry

Continued Contact establishes the initial controller relationship and Distance Control capability;
Unbalanced remains a separate affected-participant state. The relationship survives the round
transition, while each participant makes an ordinary next-round declaration using the chosen
distance. After that complete round, its Round End maintenance contest either preserves the
relationship and returns controller-owned distance selection or ends both Continued Contact and
Unbalanced and restores ordinary opposed distance control. No special attack opportunity is
created.

### Disarm

A future Disarm may create weapon-availability or possession state. It grants controller authority
only if the verified rule names a tactical choice; disabling another participant's weapon alone
does not make the attacker their controller.

### Throws

A Throw may create positional, prone, or movement state and may grant a narrowly scoped positioning
capability. Opportunity and task ownership must remain explicit.

### Locks

A Lock is a likely relationship-bearing state with a locker, affected participant, restricted
actions, and participant-owned escape work. Its controller capability must be defined from the rule,
not inferred from the word “lock.”

### Observe Opponent

Observe Opponent may create directional knowledge or preparation state. An observer-to-subject
relationship does not imply tactical control unless the rule explicitly grants a controller
capability.

### Mounted Combat

Mounted Combat may need rider, mount, and opponent relationships with distinct action, movement, and
visibility ownership. Those capabilities must be named separately rather than overloading Distance
Control.

### Shield techniques

Shield techniques may create guarded, bound, or source-restriction states. A technique-specific
state may qualify tasks or modifiers without granting control of the opponent.

## Adoption rules

For each future consumer:

1. identify the canonical source result and deterministic state identity;
2. identify subject, controller, affected participant, and capability independently;
3. define pending, active, and expiration boundaries;
4. define modifier/effect contributions separately from relationship authority;
5. project opportunities and tasks from exact active-state lineage;
6. keep Current Action, tracker ownership, API authorization, reload, and undo task-derived;
7. preserve player-safe visibility without changing ownership;
8. add persistence fields only when the first concrete consumer requires them.

This model remains incremental: new controller capabilities and state-qualified mechanics must add
only the fields and behavior required by a verified rule.
