# Combat Presentation Guidelines

**Status:** Normative combat presentation guidance

**Audience:** Developers and designers working on combat presentation

**Scope:** Presentation of canonical combat facts; not combat rules, authorization,
canonical progression, persistence, or calculation semantics

This document defines how the Glantri combat interface presents canonical combat
facts. It is normative for combat presentation. Where current implementation or
older presentation guidance differs, the discrepancy must be recorded and audited;
the guideline must not be weakened merely to describe existing behavior.

## 1. Purpose

The goals of combat presentation are:

- immediate situational awareness;
- low cognitive load;
- stable spatial orientation;
- chronological correctness;
- consistent presentation across actions;
- trustworthy current and historical state;
- sufficient operational context without rules explanation.

The combat interface presents canonical combat facts. It does not teach the rules.
Nothing in this document defines whether an action is legal, how a command
progresses, how a calculation is resolved, or what a player is authorized to see.

## 2. Operational interface

The combat screen is an operational instrument panel.

It shows:

- current state;
- current context;
- current choices;
- current modifiers;
- calculations;
- committed consequences;
- warnings requiring attention.

It does not show:

- explanatory rule prose;
- tutorial text;
- design rationale;
- repeated definitions;
- unnecessary status explanations.

Rules explanations and examples belong in documentation. Canonical rule tables
needed to resolve an action are operational context and may appear in the combat
interface.

## 3. Stable spatial layout

The GM combat interface uses a stable three-column by two-row, six-panel structure,
with the Action Button Area in the centre of the lower row.

Panel widths and horizontal placement remain stable. Panels may grow vertically
when their content requires it. Prefer appending new content at the bottom of the
appropriate panel rather than moving or reordering existing content.

The most stable panels belong in the upper row so necessary vertical growth causes
the least disruption to spatial orientation. Concise presentation should prevent
unnecessary vertical growth.

## 4. One responsibility per panel

Each panel has one presentation responsibility:

- **Current Action** answers what is unresolved now.
- **Current step results** answers what has happened in the current step.
- **Combat Modifiers** answers what currently affects the selected participant in
  the applicable context.
- **Calculation presentation** answers how a numeric value was obtained.
- **Live weapon and combat tables** show current canonical combat values.
- **History** reproduces earlier committed facts from immutable snapshots.

A fact belongs with the responsibility it serves. Do not repeat it across panels
merely to make one action self-contained.

## 5. Current Action

Current Action contains unresolved work only.

It may contain:

- the action and involved participants;
- current canonical or provisional values;
- the rule table required for resolution;
- the highlighted applicable outcome;
- bounded GM-adjustable outcomes;
- a player-visible combat note;
- action controls.

Committed historical results do not belong in Current Action. A completed fact
moves to Current step results or immutable History; it must not remain presented as
unresolved work.

## 6. Canonical maneuver tables

A table-driven combat maneuver presents the exact rule-table structure relevant to
that maneuver:

- canonical rows or outcome bands;
- canonical columns;
- canonical terminology;
- canonical standard values.

The applicable row is clearly highlighted. A GM-adjusted outcome is clearly
distinguished from the standard result without explanatory prose.

The combat interface and published combat documentation must consume the same
structured maneuver-table source. They must not maintain independent copies that
can drift.

## 7. Current step results

Current step results are an append-only chronological ledger for the current combat
step.

Each committed action creates one coherent result entry. Subordinate rolls,
responses, consequences, and calculations belong within that result entry or as
canonically ordered subordinate events. Later events append below earlier events.

Existing results must not:

- disappear;
- move;
- be renumbered because a later result appears;
- be reconstructed into a different order;
- lose calculation details;
- duplicate calculation details.

Canonical undo is the only ordinary mechanism that may remove a committed result.

## 8. Result content

A result entry presents, where relevant:

- the action;
- the participants;
- a concise outcome;
- opposed totals or margin;
- the canonical table row or outcome band;
- all committed consequence columns;
- the distinction between standard and GM-adjusted consequences;
- the player-visible combat note;
- calculation snapshots.

Outcome prose describes the mechanical consequence, not merely “success” or
“failure”.

Zero-valued columns in a resolved maneuver outcome may remain visible because they
document the complete committed table outcome. They do not create live modifier
rows merely by being recorded.

## 9. Calculation grammar

All calculation mini-panels use one semantic order:

1. contributing stat and value;
2. skill name and Skill XP;
3. applicable modifiers, one after another;
4. total modifiers;
5. Skill total or the calculation-specific combat total;
6. Roll, including bounded open-ended roll facts when applicable;
7. Final total or the canonical numeric Result used for lookup.

Use canonical Glantri calculation terminology. `Skill XP` means the canonical total
skill XP used by combat calculations, not only direct allocation or only
group-derived contribution. Use a more specific canonical label instead of `Skill
total`, `Roll`, or `Final total` when that calculation already has one.

Calculation mini-panels do not show:

- success or failure prose;
- outcome descriptions;
- table-band descriptions;
- internal identifiers;
- duplicated facts;
- irrelevant non-contributing data.

Success, failure, margin, table outcome, and consequences belong in result
presentation.

## 10. Live calculations and calculation snapshots

Live attack, parry, weapon, and combat tables use current canonical modifiers.

If a modifier appears in Combat Modifiers and applies to the calculation context,
the live value includes it. Live values update immediately after an accepted
canonical command changes applicable modifiers, including changes within the same
combat step.

Provisional values may carry a concise `Provisional` marker. Do not add explanatory
prose.

Committed result calculations are immutable snapshots. They retain the exact
inputs, modifiers, rolls, open-ended roll facts, and totals used when the command
resolved. Later modifier changes update live calculations but never rewrite earlier
calculation snapshots.

## 11. Combat Modifiers

Combat Modifiers show the complete current modifier state relevant to the selected
participant and applicable context.

A visible modifier is active and applicable. Expired, consumed, inactive, and
future modifiers do not appear in the live modifier panel.

Modifiers must not appear only because their source action is selected. Every
applicable modifier appears independently of the current inspector selection.

This includes:

- General/Fatigue modifiers;
- Initiative modifiers;
- Skill/OB modifiers;
- DB/Parry modifiers;
- phase-specific modifiers;
- opponent-specific modifiers;
- provisional declaration modifiers when the UI is presenting provisional state;
- cross-round effects;
- special effects that alter canonical combat calculations or choices.

Cross-round and special modifiers retain sufficient compact provenance, scope,
opponent, and duration information to be operationally clear.

Provide a concise warning or indicator when a participant has active special
effects that may otherwise be overlooked.

## 12. Empty modifier categories

In ordinary summary presentation, suppress modifier rows and categories that do not
exist. Do not show noise such as `Initiative +0` merely because Initiative is a
possible category.

In explicit modifier-review or editing workflows, standard empty categories may
appear compactly when needed to add or review a modifier.

A zero-valued resolved outcome may remain in the result ledger without creating a
live modifier row.

## 13. Modifier reconciliation

Committed consequences, the live modifier panel, and live combat calculations
reconcile.

For every active generated modifier, these facts agree across canonical result
presentation and modifier presentation:

- value;
- source;
- target;
- opponent or scope;
- phase;
- duration.

If a visible modifier applies to a live calculation, that calculation includes it.
When the modifier expires, it disappears from live modifiers and live calculations,
while the originating result remains unchanged in History.

## 14. Combat notes

Manually entered combat notes are always player-visible. They are not private GM
notes.

A committed combat note belongs to the result that accepted it and persists into
Current step results and immutable History. Hidden system facts, diagnostics, and
separately defined GM-only scenario or review data remain restricted according to
their canonical visibility rules; they are not combat notes under this contract.

Use concise labels such as `Combat note` or `Result note`. Do not label committed
combat commentary in a way that implies private GM visibility.

## 15. History

When a step or round becomes historical, preserve:

- event order;
- result grouping;
- committed consequences;
- notes;
- calculations;
- table outcomes;
- standard-versus-adjusted distinctions;
- modifier provenance.

History uses archived snapshots rather than current participant, equipment,
modifier, calculation, or rule state. Nothing that occurs later may rewrite the
historical presentation.

## 16. Progressive disclosure and concision

Default presentation is concise.

Prefer:

- labels and values over prose;
- compact rows over paragraphs;
- canonical tables over textual rule explanation;
- expansion for calculations and detailed provenance;
- hidden empty sections;
- stable ordering.

Clean presentation remains operationally complete, but must not solve ambiguity by
adding rules explanation to the combat screen.

## 17. Shared presentation grammar

The same presentation grammar applies to all combat actions and processes,
including:

- declarations;
- initiative;
- attack;
- parry;
- Feint;
- Observe Opponent;
- Counterattack;
- Disarm;
- Break Off Engagement;
- movement and distance;
- hit location;
- damage;
- criticals;
- Combat Experience;
- health checks;
- round-end processes;
- future actions.

Actions may use different canonical data and rule tables, but they do not invent
incompatible calculation, result, modifier, note, or History presentation.

## 18. Presentation invariants

Combat presentation must preserve all of the following:

- the combat screen is an operational interface, not rules explanation;
- the GM interface retains its stable six-panel, three-column by two-row layout;
- panel widths and horizontal positions remain fixed;
- panels grow vertically only when necessary;
- new content is appended at the bottom of the responsible panel where practical;
- each panel has one responsibility;
- Current Action contains unresolved work only;
- Current step results are append-only and chronological;
- one committed action and its subordinate facts remain an atomic result group;
- committed results are not deleted or reordered except by canonical undo;
- calculation panels use one consistent semantic order;
- calculation panels contain arithmetic facts, not outcome prose;
- current applicable modifiers are reflected immediately in live values;
- committed calculation snapshots are immutable;
- all active applicable modifiers are visible in Combat Modifiers;
- every visible modifier is applied in its relevant live calculation;
- empty modifier categories are suppressed outside explicit review/edit workflows;
- table-driven maneuvers use canonical maneuver tables;
- the UI and published documentation share one structured maneuver-table source;
- manually entered combat notes are player-visible and persist with their result;
- historical presentation is immutable and snapshot-based;
- all combat actions use the shared presentation grammar.

## 19. Conformance

All combat presentation must be audited against this document.

Deviations must be documented explicitly. They must not be introduced as
action-specific exceptions without a canonical reason. A canonical reason means a
real difference in authoritative facts, privacy, or action structure—not an
implementation shortcut or existing UI inconsistency.

This document does not authorize commands or alter player-safe projection. The
descriptor-driven progression, canonical revision, server-side visibility, and
snapshot rules in the wider combat architecture continue to govern the facts that
presentation may consume.

### Discrepancies reserved for the presentation audit

The repository review for this document identified these known presentation
discrepancies. They are recorded for a later implementation audit and are not
resolved by this documentation change:

1. The recommended calculation standard in
   [combat-presentation-contract.md](./combat-presentation-contract.md) includes
   outcome prose in calculation presentation. This guideline instead reserves
   calculation panels for arithmetic facts and places outcomes in result
   presentation.
2. Current combat review paths include controls labelled as private GM notes. A
   later audit must distinguish restricted GM review/diagnostic data from manually
   entered combat commentary. Committed combat or result notes governed by this
   guideline are player-visible; truly GM-only facts require a separate, explicit
   canonical field and label.
