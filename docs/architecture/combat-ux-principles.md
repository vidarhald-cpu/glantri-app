# Combat UX Principles

**Status:** Normative combat UX guidance

**Scope:** Layout and presentation of canonical combat facts; not combat rules,
authorization, progression, persistence, privacy, or calculation semantics

## Purpose

Combat presentation provides immediate operational awareness with low cognitive
load. It presents canonical facts concisely and consistently without teaching the
rules or creating a second source of combat state.

## Information hierarchy

Combat surfaces use this vertical order:

1. combat identity and bounded role-specific controls;
2. Combat Tracker and current-task control;
3. inspector heading, navigation, and the six-panel workspace;
4. Combat Log;
5. ancillary tools.

Operational work precedes history. Ancillary tools do not interrupt the tracker,
inspector, or result flow.

## Shared conversation model

Combat in Glantri is a shared tabletop conversation.

The tracker is the shared reference point for the whole table. It communicates:

- current canonical execution order;
- current combat position;
- completed actions;
- next actor;
- current task.

GM Combat, GM Player Combat, and Player Combat must show the same tracker order. No
subsystem should process participants in an order that differs from the visible
tracker unless an explicit combat rule requires it.

## Stable layout

The combat workspace keeps a stable three-column by two-row arrangement:

| Declaration      | Phase 1                              | Phase 2 |
| ---------------- | ------------------------------------ | ------- |
| Combat Situation | Current Action or Historical Context | Results |

Panel widths and horizontal ownership remain stable. Content expands vertically
when necessary. A panel does not move another responsibility to a different
position merely because its content changes.

## Tracker

The tracker appears before the inspector on every combat surface. It uses canonical
execution order and one shared presentation grammar. Live entry, a new round, and
the current-task control position the current cell without overriding deliberate
historical inspection or ordinary manual scrolling.

Tracker selection is an inspection overlay. It never changes canonical progression.

### Tracker as the combat board

The tracker is the canonical visual state of combat. At one accepted encounter
revision, every client shares one canonical operational position: round, step,
process/stage, execution group, and current task where that detail is safe to show.
Visibility and authority may change what a viewer knows or can do at that position,
but may never move that viewer to a different apparent combat stage.

The canonical operational position is not the viewer-actionable task. They coincide
when the viewer owns the current work, and may differ for explicitly parallel work
within the same canonical stage; otherwise Current Action presents a waiting state at the canonical position. A
redacted task retains its safe round/step marker without exposing participant identity
or private task detail.

Historical/manual selection is an overlay and never replaces the canonical board
position. `Current task` clears that overlay and returns focus to the shared live
position.

The amber live marker and green inspection cursor have separate meanings. Amber
marks where combat is; green marks the exact context rendered in the panels below.
During auto-follow they coincide. Explicit history navigation moves only the green
cursor, and `Current task` returns it to the canonical operational context.

Canonical stage order gates active-round presentation. Suppressing a participant's
unneeded task does not complete or open a later cell: a future no-work stage remains
neutral until the shared board reaches it.

A tracker check is accepted canonical completion evidence for that participant and
step. The absence or suppression of a task, an unrelated same-cell result, a generic
snapshot, viewer filtering, or a workflow boundary event is not completion evidence.

SU is a shared board checkpoint. Deterministic work may prepare SU and close empty
participant reviews without restoring per-participant acknowledgement controls, but
the deterministic suffix stops after that work. The final SU-to-next-round action is
an explicit GM round-end checkpoint so every surface can present SU before the round
boundary is accepted.

## Current Action

Current Action decides. It contains only unresolved work, its bounded inputs, and
the control that accepts the current canonical command. Completed outcomes move to
Results.

## GM Step Automation and Workflow Status

GM Step Automation is an explicit GM-started request to perform a contiguous prefix
of routine GM-controlled NPC work. It is bounded to the current combat step and may
execute only canonically eligible work in canonical task order. Deterministic closure
may expose the next step, but the run never performs substantive work from that next
step and never makes a tactical choice.

Workflow Status describes application operation: what the explicit run processed,
where it stopped, and whose attention is required. It is one transient GM-only story
near Current Action, not a result, game-world event, technical log, or permanent
history. A new run replaces the prior story.

Combat Log describes the game world. Underlying accepted declarations, reviews, and
rolls retain their normal canonical events and results; operational summaries such as
processed counts and stop reasons never enter Combat Log or Results.

NPC declaration proposals are conservative carry-forward of the immediately prior
round's accepted intent. The GM explicitly starts acceptance during DE. The proposal
retains the same canonical action, targets, sources, movement, and options; it never
infers tactics, substitutes a target or weapon, or interprets free text. Changed,
invalid, ambiguous, or incomplete circumstances stop before mutation and Workflow
Status returns the exact NPC declaration to the GM. Completing DE may expose M1, but
the declaration run never processes M1.

## Combat Situation

Combat Situation explains. It shows the active modifiers, conditions,
restrictions, target-specific context, and pending lifecycle facts that currently
affect the selected participant. It is not an editor or event history.

## Results

Results prove. They are chronological, append-only presentations of accepted
actions, calculations, and consequences. One canonical process remains one coherent
result group. Undo is the ordinary mechanism that removes a committed result.
Workflow transitions such as boundary advancement remain available as provenance
and concise Combat Log narration, but are not participant combat Results.

## History

History replays immutable archived presentation through the same six-panel grammar.
It is read-only, snapshot-owned, sequence-bounded, and never reconstructed from
current participant state. Historical selection never retargets the live task.

## Calculations

Calculations use the shared arithmetic grammar and authoritative snapshots. They
show contributing facts, modifiers, totals, rolls, and the final lookup value;
outcome prose belongs in Results. Live presentation does not independently
recalculate combat rules.

## Modifier presentation

Modifier presentation is contextual, compact, target-aware, and explicit about
units. Every applied contribution is independently traceable, including when a
category total is zero. Empty groups are suppressed outside review.

## Review

Review shows current state, proposed transitions, GM decisions, and the resulting
state in a bounded transaction. Draft editing remains local until commit. Review
does not displace Combat Situation or turn ordinary inspection into an editor.

## Transient feedback

Transient feedback is for transient actions. Permanent UI is for persistent state.

Short-lived confirmation may hold or announce a newly accepted roll long enough to
be perceived. It must not create a permanent duplicate result panel or replace the
durable Results ledger.

## GM/Player parity

GM Combat, GM Player Combat, and Player Combat share tracker order, panel meaning,
result grammar, history grammar, and vertical composition. Role-specific controls
and server-projected privacy may differ; spatial meaning does not.

## Wording

Use concise operational labels and canonical game terminology. Prefer labels and
values to prose. Do not expose internal identifiers, implementation status, design
rationale, repeated instructions, or rule explanations.

## Performance

Layout, scrolling, and selection remain presentation work. They do not request new
server data, rebuild tracker facts, rebuild archived presentation, recalculate
rules, or write canonical state. Live auto-positioning is bounded to rendered
cells; historical inspection remains stable until the user resumes live combat.
