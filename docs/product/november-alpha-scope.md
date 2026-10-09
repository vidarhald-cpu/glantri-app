# November Alpha — scope and acceptance

**Status:** Current control-plane position for the November Alpha, recorded 2026-10-09. This document
records rulings already made; it makes none.
**Scope:** What the November Alpha must demonstrate, what it deliberately does not, and how that is
judged.
**Audience:** Product owner, Orchestrator, Builders, reviewers and QA who must cite the Alpha standard
without having been present for the conversation that produced it.
**Not a visual design system:** This is an Alpha scope and acceptance document. It does not specify
colours, tokens, typography, spacing or components.

**Authority:** Control-plane rulings recorded on Forgejo #458 (the Alpha decision packet, comment
13607, and the recorded rulings and recut, comment 13621) and in the authorized lane issues #538 to
#544. If this document and a later control-plane ruling disagree, the ruling controls and this
document should be corrected.

**Related:** [Product & Presentation Principles](./product-presentation-principles.md),
[Combat Panel Contract](./combat-panel-contract.md),
[Chargen and Competency Experience](./chargen-competency-experience-contract.md),
[Campaign Blackboard V1](./campaign-blackboard-v1.md).

## 1. Dates

- **Target Alpha freeze: 23 October.**
- **Absolute latest: 26 October.**

Time after the freeze is protected for end-to-end testing of the running application.

## 2. The three Alpha gates

The Alpha is met when all three gates are met and the rendered-product review
([section 5](#5-rendered-product-review-a-required-gate)) has been run.

### Gate A — a representative session experience

The surfaces a participant uses in a session are representative of the intended product:

- **Situation**
- **Encounter / Combat**
- **Maps**
- **Blackboard V1**

Participants are meant to see, understand and meaningfully discuss the intended product. Each surface
is judged against the [per-surface Alpha test](#4-the-per-surface-alpha-test).

### Gate B — human-usable Chargen

A non-developer can create a Character without developer intervention, covering Skills, Professions,
required Learning Groups, and the acquisition and calculation flow.

### Gate C — reader-facing content

Skill and profession descriptions, and Learning Group explanation where it is required, are
**surfaced to the human user** in the running application. **Repository documents alone do not satisfy
this gate.** Content that exists only under `/admin/` does not count toward Gate B or Gate C.

## 3. The seven consolidated rulings

Numbering follows the Alpha decision packet on #458 (comment 13607). Detail is taken from the packet
and from the lane issues that authorize the work.

1. **Visual standard.** There is no existing global visual definition, so a minimal shared baseline is
   approved for Alpha. **Combat is the primary visual reference and Chargen the secondary.** Every
   visual value introduced for Alpha must be traceable to an existing Combat or Chargen treatment; a
   value that cannot be traced to one of them is not introduced. The baseline is an extraction of what
   those surfaces already do, not a new look. Blackboard is explicitly not a visual reference. Product
   attention, not styling mechanics, is the measure of which surfaces lead. Builders do not invent
   colour themes, decorative systems, unusual typography, new card or panel idioms, animation or
   bespoke visual metaphors, and do not restructure layout merely for styling (#538).
2. **Combat.** No wholesale Combat restyle before the freeze. A capped spike (half a day) tests
   whether the shared baseline can reach Combat from outside, at its single mount point, without
   editing the Combat panel. If it materially improves typography, buttons and panel chrome, proceed;
   otherwise fall back to the Combat Tracker region and re-heading the first-seen surfaces. The aim is
   mainly that surrounding surfaces align to Combat, not that Combat is redesigned (#541).
3. **Situation.** Situation remains a player-only surface. No GM Situation surface is added for
   Alpha. The work is presentation against the shared baseline (#539).
4. **Blackboard.** Blackboard is present so participants can see and discuss the concept. Drag is
   added only if a one-hour check shows it can reuse the existing placement path with no schema and no
   persistence change; if so, the arrow-button controls are retained. If not, the current interaction
   ships and drag is deferred. Presentation is brought into the same panel and hierarchy language
   as the rest of the application (#542).
5. **Maps.** Presentation only. No pan or zoom: a static map with backgrounds, markers and layers is
   the Alpha target, and the approved wireframe's pan/zoom line is recorded as deliberately unmet for
   Alpha. Current map, layer and marker behaviour is preserved (#540).
6. **Typical Uses and Boundaries.** Skill Typical Uses and Boundaries stay unsurfaced. They are
   authored for all 172 catalogue entries but are not in the runtime schema. The full descriptions
   satisfy Gate C.
7. **This document.** The gates, rulings, boundary and deferred items are written into `docs/`
   rather than left only in Forgejo, so that the standard is readable by whoever is held to it.

## 4. The per-surface Alpha test

This is the acceptance criterion reviewers cite for each Gate A surface:

> Can a user immediately understand the major areas of the screen, their hierarchy, and where actions
> belong, and does the screen look recognisably part of the same application as Combat and Chargen?

The rendered-product review asks six questions of the running UI: can the major functional areas be
told apart; is primary versus secondary information clear; are controls visibly associated with the
panel or action they belong to; is text readable without explaining the layout; does the surface look
recognisably related to Combat and Chargen; and is anything obviously developer-grade, broken,
overflowing or confusing.

**Visual baseline, by reference only.** Combat is the primary visual reference and Chargen the
secondary. Tokens introduced for Alpha must be traceable to those surfaces. This document does not
restate or extend them; the extraction is recorded with its citations in #538.

## 5. Rendered-product review: a required gate

Source inspection is insufficient for Gate A. The acceptance question is whether a human can
understand the rendered application, so a rendered-product review (#544) is a **required Alpha
gate**, not an optional extra.

- **Two passes.** A first pass after the shared baseline has landed and before the presentation lanes
  are considered finished; a final quick pass after all Gate A work is integrated and before the
  freeze.
- **Surfaces, at minimum:** Situation, Combat / Encounter, Maps (with a real background, markers and
  layers), Blackboard, Chargen, and the Skills and Profession reader surfaces.
- **Authority boundary.** The review is not permission for a worker to redesign a screen on taste.
  Obvious implementation defects (overflow, a broken control, unreadable contrast, a panel that will
  not close) may be fixed by the owning Builder within its contract. New aesthetic or layout
  decisions return to the Product Owner with screenshots.
- **Chargen observations.** While the application is running, the review also records, without
  fixing under that issue, the state of the known Chargen reliability unknowns listed in #544.

## 6. Environment prerequisite: Artifact storage

Map backgrounds require Artifact storage to be configured in the Alpha environment; without it the
map background route returns 404 and no styling work can compensate. This is an operator-level check,
not Builder work.

**Maps is not Alpha-ready until a real rendered map confirms that its background loads.** The
rendered-product review discharges this check.

## 7. Alpha, Beta and Later

| Band      | Meaning                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------- |
| **Alpha** | What the three gates and the rendered-product review require, nothing more.                              |
| **Beta**  | Designed work the control plane has deliberately kept out of Alpha: Blackboard notes and change history. |
| **Later** | Work held at `priority/Future` with no authorization, for example live GM map sketching (#424).          |

Items below that are post-Alpha but not yet assigned by the control plane to Beta or to Later are
listed as **deferred** in [section 8](#8-explicitly-deferred-items) and are not placed in either band
here.

## 8. Explicitly deferred items

None of these is part of the Alpha. Do not pull them in without a new control-plane ruling.

- **Maps pan and zoom.**
- **Blackboard pan and zoom, notes, and change history.** They are designed, which is the reason they
  are not pulled into Alpha.
- **Skill Typical Uses and Boundaries surfacing.** Authored, kept out of the runtime schema, and not
  to be surfaced or extended for Alpha.
- **#518 C1 to C7** (Combat Controls V1 design follow-ups). Post-Alpha. The one possible exception is
  C7, a documentation-only reconciliation, which may be taken only if it cannot jeopardise the freeze.
- **#536**, shield attack modes that carry no competency reference. `priority/Future`.
- **#537**, declaration and resolution reading different attack modes for stale scenario snapshots.
  Recorded as a real but low-priority defect; not an Alpha concern.
- **The #521 deferred duration and tick semantics** for player-visible modifier rows.
- **A GM Situation surface**, and **live GM map sketching (#424)**.

## 9. What would change this document

A new control-plane ruling on #458 or on a lane issue. A Builder or reviewer who finds that a gate
cannot be judged as written should report that rather than reinterpret it.
