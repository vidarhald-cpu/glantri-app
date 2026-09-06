# Chargen and Combat Manager interaction preservation

Status: partially approved product/architecture contract recovered on 2026-09-03 and refreshed by
Forgejo #51 on 2026-09-06. The preservation boundaries below are approved. Four named questions
remain open; the former #391/manual-damage coexistence question is resolved below.

## Authority and provenance

### Repository-derived evidence

The recovered repository contains the mature Chargen and Combat Manager product surfaces, their source/tests, and the established interaction contracts in:

- `docs/product/product-presentation-principles.md`;
- `docs/product/combat-panel-contract.md`;
- `docs/product/combat-ui-audit.md`;
- `docs/architecture/character-lifecycle-authority.md`;
- `docs/architecture/combat-ux-principles.md`;
- `docs/architecture/combat-presentation-contract.md`;
- `docs/architecture/combat-presentation-guidelines.md`; and
- `docs/architecture/combat-undo-facts.md`.

The recovered `dev` history also contains the #383 retained-Character/headless Chargen foundation and the #387 Critical runtime foundation.

### Chat-recovered decision evidence

The former #394 read-only audit and architecture/control-plane conversation preserve the product owner's acceptance of the boundaries below. GitHub became unavailable before that audit could be durably published. R3C records the accepted boundary without presenting the audit's recommendations or the five open questions as approved decisions.

## Preserved Chargen surface

- Chargen is a mature product surface and the presumptive baseline for future Character creation.
- Preserve its vertically composed, numbered journey, its visible section/progress model, its existing rules/content dependency flow, and its review/finalization shape.
- “Future Character builder” means preserve and extend existing Chargen with the integrated #383 retained-Character/headless foundation. It does not mean a greenfield replacement, a route-per-step wizard, or a new navigation model.
- Existing server-first finalization and canonical Character authority remain governed by `docs/architecture/character-lifecycle-authority.md`.
- Reuse of components or read models does not authorize changing journey ownership, ordering, numbering, restoration behavior, or authority roles.

A replacement, reordering, new Next/Back navigation model, or merged create/edit authority journey requires explicit product/control-plane approval.

## Preserved Combat Manager surface

Preserve the current Combat Manager product shell and meanings:

- the round tracker/timeline and its inspection/navigation behavior;
- the six-panel shell and established panel meanings/order;
- Current Action as the authoritative current-step command and commit surface;
- the existing proposal → review → authoritative commit grammar;
- Results as committed outcome proof;
- Combat Log/history as immutable chronology and the existing historical-inspection surface;
- current terminology and round/step command vocabulary; and
- current control placement, including progression/advance ownership and command-backed Clear/undo.

New mechanics may add capability-backed rows, fields, inline controls, summaries, or lifecycle labels inside the existing owning review surface. They must not create another command owner or another current-versus-history truth.

## #391 Critical-review placement

Forgejo #3 (recovered GitHub #391) must extend the existing Damage/effects review inside Current Action.

- The canonical default Critical proposal is server-authored.
- Any allowed GM adjudication remains a bounded review of that proposal.
- The one authoritative commit remains in Current Action.
- Accepted/current consequences belong in existing Results and player-safe projections.
- Immutable adjudication evidence belongs in the existing Combat Log/history path.
- Rejected/suppressed atoms and private GM reasons remain outside player current and history projections unless a later ruling explicitly changes that boundary.
- Existing manual damage/effect rows may co-commit independently with provenance `manual`. They are
  not canonical C1 atoms or C1 adjudication telemetry and do not redefine, suppress, or replace a C1
  atom.
- Minimal ordinary-Bleed control stays inside Current Action and may expose only an existing,
  source-specific lifecycle transition. Results shows the accepted current state; Combat Log/history
  records the immutable command; existing persistence/reload and command-backed Clear/undo restore
  prior state. No new medical check, equipment, time, assistance, healing, or recovery rule is
  implied.

#391 does not authorize a new general Combat panel, Critical panel, navigation system, round-control shell, progression button, second review grammar, or broad layout redesign.

## Changes requiring explicit control-plane approval

No feature task may independently introduce:

- a new general Combat panel or parallel Critical-review panel;
- changed Combat navigation, tracker meaning, round-management shell, or control placement;
- a second proposal/review/commit grammar or moving commit ownership out of Current Action;
- mutable proposal state in Results/history or history inspection that changes the live cursor;
- a broad Combat Manager or Chargen layout redesign;
- a greenfield Character builder that replaces existing Chargen;
- new cross-surface terminology or a generalized design-system rewrite; or
- client-only privacy or automatic replay/merge after stale/conflicted state.

## Exactly four unresolved #394 questions

These questions remain open and are not decided by this record:

1. **Local draft restoration promise:** resolve Chargen's “Draft saved locally” promise versus the absence of a restore flow.
2. **`9b` numbering:** confirm whether section `9b` numbering is intentional.
3. **Narrow-layout contract:** define the narrow-layout Chargen contract.
4. **Create/owner-edit/GM-edit authority journeys:** confirm whether create, owner-edit, and GM-edit remain separate authority journeys.

Until the product owner rules, Builders must not choose answers locally. A future task may proceed only around an open question if its contract explicitly avoids that behavior.

Forgejo #51 resolved the former fifth question through
[decision 0004](../decisions/rules/0004-c1-critical-authoring-and-adjudication.md): manual rows may
co-commit independently with `manual` provenance and are not C1 override telemetry.

## Builder and QA contract consequences

Any future extension of Chargen or Combat Manager must name:

- the exact accepted `dev` SHA;
- preserved section/panel ownership, order, navigation, terminology, authority, result/history placement, and recovery behavior;
- exact allowed extension points;
- GM/player/owner/other-player and current/history perspective expectations;
- wide and narrow layout plus keyboard/focus behavior; and
- every unresolved question that blocks or constrains the task.

Independent QA must treat an unapproved preservation difference as a contract failure, not a reviewer preference.

## Implementation and release boundary

This document records product/architecture decisions only. It implements no UI or runtime behavior and grants no Builder, QA, `main`, Azure, production, deployment, or release authority.
