# Combat Presentation Conformance Audit

**Status:** Recorded architecture audit

**Normative reference:** [Combat Presentation Guidelines](./combat-presentation-guidelines.md)

**Related architecture:**

- [Combat Architecture Overview](./combat-architecture-overview.md)
- [Combat Canonical Conformance Audit](./combat-canonical-conformance-audit.md)
- [Combat Performance Audit](./combat-performance-audit.md)

This document records the conformance state of combat presentation at the audited
commit. It describes the implementation; it does not weaken, replace, or reinterpret
the normative presentation guidelines. A behavior recorded as conformant here may
still require reevaluation if its canonical rule, privacy contract, or source facts
change.

## 1. Executive summary

The combat presentation rests on sound canonical foundations:

- server-owned, descriptor-driven progression;
- revision-owned active presentation;
- immutable archive-owned historical presentation;
- server-side player-safe projection;
- monotonic canonical event sequence;
- snapshot-correct archived calculations, modifiers, declarations, and results.

The largest presentation problems are shared rather than maneuver-specific:

1. Calculation panels do not use one semantic grammar.
2. Multi-event actions are frequently presented as several top-level results instead
   of one result with subordinate facts.
3. Results often omit complete consequences, table bands, standard-versus-adjusted
   values, or provenance.
4. Opponent-specific modifiers can be canonical in command resolution while remaining
   absent from category totals and target-aware live tables.
5. Empty modifier categories create persistent visual noise.
6. Some manually entered combat-result notes are incorrectly modeled as private
   `gmReview` facts.
7. Table-driven maneuvers do not consistently share one structured rules source
   between domain resolution, combat UI, and published documentation.
8. Completed facts and explanatory prose sometimes appear outside the panel that owns
   them.

No evidence was found that later state rewrites canonical archived calculations or
snapshots. The result-ledger defect is grouping and grammar, not event persistence
order or historical immutability.

## 2. Audit scope and method

The audit covered:

- GM Combat;
- Player Combat;
- GM Player Combat;
- active rounds and current tasks;
- archived rounds and tracker-cell inspection;
- Current Action;
- Current step results;
- Combat Modifiers;
- calculation mini-panels;
- live loadout, weapon, defense, and combat tables;
- combat log and projected history;
- manually entered combat notes;
- maneuver-table sources and published rules documentation;
- player-safe visibility and GM/player presentation parity.

The method was:

1. inspect canonical domain commands, events, progression, visibility, and history
   projection;
2. inventory active and archived presentation ownership;
3. inspect GM and player presentation components and view-model builders;
4. trace representative Feint, attack/parry, Observe Opponent, Adjust Distance,
   damage, initiative, Combat Experience, health, SU, and history paths;
5. run focused domain tests and the web test suite;
6. classify conformance against
   [combat-presentation-guidelines.md](./combat-presentation-guidelines.md).

The audit did not mutate an authenticated live encounter. Browser-dependent pixel
geometry, focus, and responsive layout are therefore classified from source and
component coverage rather than a new authenticated browser recording.

## 3. Action and process inventory

The canonical round steps and command surface are defined by
`packages/domain/src/encounter/combatRoundManager.ts`, notably
`COMBAT_ROUND_STEPS` and `combatRoundCommandTypeSchema`. Canonical history event
families are defined by
`packages/domain/src/encounter/combatStepEventSchema.ts`.

| Family | Implemented actions and processes | Presentation status |
| --- | --- | --- |
| Round workflow | Declaration; M1/M2 modifier review; i1/i2 initiative; A1/P1/D1; A2/P2/D2; SU; round boundary | Fully integrated |
| GM workflow | Perform current action; skip participant; complete remaining modifier review; complete remaining initiative; backout; undo | Integrated |
| Standard attacks | Single Attack/Parry (`attack_parry`); Reactive Attack (`parry_attack`); Double Attack | Integrated through the shared attack process |
| Defensive actions | Parry; Offensive Parry; Offensive Parry Brawling | Integrated |
| Contact and distance | Continued Contact; later-round SU maintenance; distance control | Integrated |
| Feint | Attacker roll; defender roll; result-table proposal; GM review/adjustment; commit; generated modifiers | Integrated |
| Observe Opponent | Secondary declaration; progress; observer-owned SU roll; ordered relationship; canonical pair modifier; history/privacy | Integrated |
| Adjust Distance/Range | Defender response; situational adjustment; opposed rolls; proposal; GM commit; subsequent attack | Integrated |
| Attack consequences | Hit/miss; parry; hit location; critical; damage proposal/review/commit | Integrated |
| Combat Experience | Opening threshold; participant rolls; phase CE; generated effects and expiry | Integrated |
| Round end | Effect review; health and bleed checks; observation; participant review; distance; boundary | Integrated |
| Counterattack | Selectable and accepted as a generic targeted attack, without a dedicated counterattack process or presenter | Partial |
| Disarm | Selectable and partly accepted through generic attack validation, without a dedicated disarm resolution presenter | Partial |
| Parry–Disarm | Declaration shell exists; no dedicated canonical process was found | Presentation shell |
| Break Off Engagement | Declaration shell exists; no dedicated canonical process was found | Presentation shell |
| Other | Selectable declaration shell | No action-specific presentation |
| Historical operations | Tracker navigation; archived inspector; combat log; immutable result/calculation/modifier snapshots; undo | Integrated |

The selectable declaration inventory is exposed by
`apps/web/src/lib/campaigns/playerEncounter.ts:PlayerCombatPrimaryActionId`.
Declaration compatibility is owned by
`packages/domain/src/encounter/combatDeclarationCompatibility.ts`, while the
implemented multi-stage process adapters are in
`packages/domain/src/encounter/combatActionProcesses.ts`.

## 4. Presentation architecture inventory

Combat presentation has four explicit ownership layers in
`apps/web/src/features/combat-round-manager/view-models/combatPresentationModel.ts`:

| Layer | Current owner and contents |
| --- | --- |
| Archived Presentation | `ArchivedCombatPresentation`: immutable tracker facts, archived round states, and `ArchivedInspectorPresentationIndex` |
| Active Presentation | `ActiveCombatPresentation`: current task/action, active tracker, active log, progression, and `ActiveInspectorPresentationStore` |
| Selection Overlay | `CombatSelectionOverlay`: selected round, participant, tracker cell, result, and inspector identities |
| Pending Overlay | `CombatPendingOverlay`: saving, errors, and GM workflow selection |

Relevant builders and components include:

- `buildArchivedCombatPresentation` and `buildActiveCombatPresentation` in
  `apps/web/src/features/combat-round-manager/view-models/combatPresentationModel.ts`;
- `buildArchivedInspectorPresentationIndex` in
  `apps/web/src/features/combat-round-manager/view-models/archivedInspectorPresentation.ts`;
- active inspector stores in
  `apps/web/src/features/combat-round-manager/view-models/activeInspectorPresentation.ts`;
- `buildCurrentActionPresentation` in
  `apps/web/src/features/combat-history/view-models/currentActionPresentation.ts`;
- `buildCombatStepResultPresentation` in
  `apps/web/src/features/combat-history/view-models/buildCombatStepResultPresentation.ts`;
- `buildCombatEventResultModel` in
  `apps/web/src/features/combat-history/view-models/buildCombatEventResultModel.ts`;
- calculation helpers in
  `apps/web/src/features/combat-history/view-models/combatCalculationPresentation.ts`;
- `buildPlayerCombatModifierRows` and `PlayerCombatModifierPanel` in
  `apps/web/src/features/player-combat/PlayerCombatPanels.tsx`;
- `CombatStepResultList`, `CombatEventResultList`, `CombatLog`, `CombatTracker`, and
  `PlayerCombatHistoryInspector` under
  `apps/web/src/features/combat-history/components/`;
- `CombatRoundManagerPanel` for GM Combat;
- `ScenarioPlayerCombatPageContent` and shared `PlayerCombatPanels` for Player
  Combat;
- `CampaignWorkspaceShell`, which mounts the same player presentation for GM Player
  Combat with only the existing participant-selection difference.

Canonical event visibility is projected by
`packages/domain/src/encounter/combatHistoryProjection.ts:projectCombatHistoryEvent`.
The player client does not receive `gmReview` or unauthorized calculation facts and
then hide them visually.

## 5. Guideline conformance matrix

Classification:

- **Compliant:** the audited implementation satisfies the guideline;
- **Partially compliant:** the foundation is sound but one or more required facts or
  surfaces differ;
- **Non-compliant:** the current presentation conflicts with the guideline;
- **Not applicable:** the guideline does not apply to that surface;
- **Unable to verify:** source and tests do not establish the behavior completely.

| Guideline | GM live | Player and GM Player | History | Evidence and likely remediation owner |
| --- | --- | --- | --- | --- |
| Operational interface rather than rules instruction | Partially compliant | Partially compliant | Partially compliant | Modifier review, Combat Experience, Feint, distance, and phase panels include explanatory status or rule prose. Composition/copy layer. |
| Stable six-panel geometry | Partially compliant | Partially compliant | Partially compliant | `playerCombatPanelRowStyle` establishes three columns, but centre-column context cards can move Current Action vertically. Exact responsive geometry is browser-dependent. Component layout. |
| One responsibility per panel | Partially compliant | Partially compliant | Partially compliant | Completed initiative, CE, distance, and review facts can remain in centre context panels instead of Results. Presentation composition. |
| Current Action contains unresolved work only | Partially compliant | Partially compliant | Compliant | Canonical task/descriptor ownership is sound; adjacent context sometimes contains committed facts or repeated status prose. Active inspector composition. |
| Canonical maneuver tables | Non-compliant | Non-compliant | Non-compliant | Feint uses independent rules-engine, UI, and documentation definitions. Only hit location is registered as a structured documentation table. Domain/rules table source plus adapters. |
| Append-only chronological results | Compliant | Compliant | Compliant | Canonical events receive monotonic sequences and presenters sort deterministically. Domain event persistence. |
| Atomic action grouping | Non-compliant | Non-compliant | Non-compliant | Feint, distance, and attack-consequence chains can appear as sibling top-level results. Shared result presentation. |
| Complete result content | Non-compliant | Non-compliant | Non-compliant | Damage and Feint omit some canonical bands, consequence columns, adjustment distinctions, or provenance. Result-envelope projection. |
| Consistent calculation grammar | Non-compliant | Non-compliant | Non-compliant | Bespoke Observation, Brawling, attack, Dodge, and generic fact renderers use incompatible structures. Shared calculation contract. |
| Arithmetic-only calculation panels | Non-compliant | Non-compliant | Non-compliant | Contest calculations include result/consequence prose; Dodge calculation includes Outcome. Calculation presenter. |
| Current modifiers reflected in live values | Partially compliant | Partially compliant | Not applicable | General live modifiers reach loadout models, but opponent-specific context is absent from normal summary totals and live tables. Active modifier/loadout presentation. |
| Immutable calculation snapshots | Compliant | Compliant | Compliant | Archived projection consumes snapshotted calculation facts rather than current participant sheets. Domain event/history facts. |
| Complete active modifier visibility | Partially compliant | Partially compliant | Compliant for recorded snapshots | Normal contributions are projected; opponent-specific rows are separate from category totals, and there is no comprehensive special-effect indicator. Modifier presentation. |
| Empty modifier-category suppression | Non-compliant | Non-compliant | Non-compliant | `PlayerCombatModifierPanel` renders all four category headers even when they have no visible entry. Modifier presentation. |
| Result/modifier/calculation reconciliation | Non-compliant | Non-compliant | Partially compliant | Canonical attack validation includes observation, while live category totals/tables and result grammar do not consistently expose the same contribution. Shared canonical contribution projection and presenters. |
| Player-visible combat notes | Non-compliant | Non-compliant | Non-compliant | Declaration descriptions persist publicly, while Feint, distance, and damage/effects review notes are currently modeled as private `gmReview`. Result envelope and visibility projection. |
| Snapshot-correct history | Compliant | Compliant | Compliant | Archived presentation is keyed to immutable archive/history identity and recorded snapshots. Archived Presentation. |
| Identical live/history grammar | Non-compliant | Non-compliant | Non-compliant | Current results and archived results use separate semantic builders and calculation structures. Shared result/calculation presenters. |
| GM/player privacy parity | Compliant | Compliant | Compliant | Server-side history projection removes unauthorized facts; GM Player reuses Player Combat presentation. Domain projection and shared player UI. |
| Concision and progressive disclosure | Partially compliant | Partially compliant | Partially compliant | Calculation expansion exists, but empty modifier groups and repeated explanatory status copy add noise. Presentation components. |

## 6. Action-family conformance matrix

| Action family | Current Action | Results and history | Calculation | Modifier/live reconciliation | Overall |
| --- | --- | --- | --- | --- | --- |
| Declarations | Compliant | Partially compliant | Not applicable | Partially compliant | Partially compliant |
| Modifier review | Partially compliant | Partially compliant | Not applicable | Partially compliant | Partially compliant |
| Initiative | Partially compliant | Partially compliant | Non-compliant | Partially compliant | Partially compliant |
| Attack and ordinary parry | Partially compliant | Partially compliant | Non-compliant | Non-compliant | Non-compliant |
| Double and Reactive Attack | Partially compliant | Partially compliant | Non-compliant | Partially compliant | Partially compliant |
| Offensive Parry and Brawling | Partially compliant | Partially compliant | Non-compliant | Partially compliant | Partially compliant |
| Continued Contact | Partially compliant | Partially compliant | Non-compliant | Partially compliant | Partially compliant |
| Feint | Partially compliant | Non-compliant | Non-compliant | Partially compliant | Non-compliant |
| Observe Opponent | Partially compliant | Partially compliant | Partially compliant | Non-compliant in live summaries; compliant in canonical resolution | Partially compliant |
| Adjust Distance/Range | Partially compliant | Non-compliant | Non-compliant | Partially compliant | Non-compliant |
| Hit location | Partially compliant | Partially compliant | Non-compliant | Not applicable | Partially compliant |
| Damage and critical | Partially compliant | Non-compliant | Non-compliant | Partially compliant | Non-compliant |
| Combat Experience | Partially compliant | Partially compliant | Non-compliant | Partially compliant | Partially compliant |
| Health and bleed | Partially compliant | Partially compliant | Non-compliant | Partially compliant | Partially compliant |
| SU and round boundary | Partially compliant | Partially compliant | Not applicable | Partially compliant | Partially compliant |
| Counterattack and Disarm | Unable to verify | Unable to verify | Unable to verify | Unable to verify | Partial canonical implementation |
| Parry–Disarm, Break Off, Other | Unable to verify | Unable to verify | Unable to verify | Unable to verify | Declaration shell only |
| Undo and historical inspection | Not applicable | Partially compliant | Non-compliant | Not applicable | Partially compliant |

## 7. Shared systemic defects

### 7.1 Live modifier reconciliation

Observe Opponent is correctly included exactly once in canonical attack and parry
validation by
`packages/domain/src/encounter/combatAttackModifierValidation.ts`, using
`buildCombatObservationModifierContributions`.

The remaining defect is presentation:

- `buildPlayerCombatModifierRows` has no opponent relationship input;
- observation bonuses are appended separately by `PlayerCombatModifierPanel`;
- normal Skill/OB and DB/Parry category totals do not include the displayed
  relationship row;
- target-aware live loadout/weapon summaries cannot always reconcile with the
  canonical target-specific command calculation.

This is not a missing gameplay modifier. It is a visibility, category-total,
live-table, and presentation-reconciliation defect.

### 7.2 Fragmented result grammar

The canonical event ledger is ordered correctly, but a single action lifecycle can
produce several numbered sibling entries. Typical examples are:

- Feint roll, resistance roll, opposed result, and GM commit;
- Adjust Distance response, adjustment, rolls, proposal, and commit;
- attack, parry, hit location, critical, damage proposal, and damage commit.

The action lineage should remain one coherent result envelope with ordered
subordinate events and calculation snapshots.

### 7.3 Competing calculation presenters

The implementation includes:

- Observation-specific calculation lines;
- Brawling contest presentation;
- compact attack equations;
- concise Dodge rows;
- generic `Object.entries` calculation-fact rendering.

These differ in terminology, ordering, completeness, and separation of arithmetic
from outcomes. The generic fallback may expose humanized internal field names or
irrelevant facts.

### 7.4 Separate current and historical grammar

Current results use `buildCombatStepResultPresentation` and
`CombatStepResultList`. Historical results use `buildCombatEventResultModel` and
`CombatEventResultList`. Their different grouping and calculation rules create a
continuing drift risk even though both consume canonical data.

### 7.5 Note visibility conflict

The current UI and event model use private `gmReview` facts for some manually entered
combat-result notes. That conflicts with the accepted combat-note product decision
recorded in section 13.

### 7.6 Table-source fragmentation

Table-driven actions can have separate rule logic, UI rows, and prose documentation.
This creates an avoidable correctness and maintenance risk.

### 7.7 Panel noise and responsibility leakage

Repeated status prose, empty modifier categories, and committed context in the centre
column are shared presentation issues. They should not be fixed independently for
each maneuver.

## 8. Action-specific findings

### Attack and parry

Canonical calculation correctly includes target-specific contributions. Historical
attack presentation compresses arithmetic into an `OB + Roll - DB` equation and
lacks the shared stat/Skill XP/modifier grammar. The live modifier category total and
target-specific live table can disagree with the canonical command calculation.

### Feint

The live GM table is operationally useful and highlights the selected band. Its rows,
however, are duplicated in:

- `packages/rules-engine/src/combat/resolveCombatFeint.ts`;
- `CombatRoundManagerPanel`'s `COMBAT_FEINT_REFERENCE_ROWS`;
- `docs/rules/combat-action-rule-inventory.md`.

The result lifecycle is fragmented, committed results do not consistently retain the
full standard-versus-adjusted comparison, and the manually entered note is private.

### Observe Opponent

Progress, ordered relationship identity, privacy, opposed calculations, undo, and
canonical pair-specific modifier application are well covered. Its calculation
presentation is the closest current implementation to the normative grammar, but it
places Skill before Intelligence and does not consistently expose a separate total
modifier fact. Live summary totals still do not reconcile the displayed relationship
bonus.

### Adjust Distance/Range

Defender response, situational adjustment, rolls, proposal, and commit are presented
as separate events. The committed result does not provide a single compact
standard-versus-adjusted result, and its manually entered note is private.

### Damage and critical

Event summaries are concise but do not reliably reproduce the complete committed
outcome, table columns, provenance, or standard-versus-adjusted review. Damage/effect
review explicitly presents its manually entered note as private.

### Offensive Parry and Continued Contact

Canonical facts, ownership, and player-safe visibility are present. Calculation and
result grammar differs from both Observation and ordinary attack/parry.

### Initiative, Combat Experience, health, and SU

Event order and privacy are generally sound. Calculation presentation is incomplete
or inconsistent, and completed status can remain in centre-column context rather than
the result ledger.

### Counterattack, Disarm, and Break Off

Dedicated presentation conformance cannot be determined until their canonical action
processes are completed. Existing declaration shells must not establish a new
action-specific grammar when those workflows are implemented.

## 9. Rule-table and documentation findings

### Feint

Feint is the clearest drift risk. The resolver, UI reference rows, and documentation
are independently maintained. These must be replaced by one structured canonical
table consumed through bounded adapters.

### Hit location

Hit location is the strongest current shared-source example:
`HIT_LOCATION_RULE_TABLE` is canonical domain data and is registered by
`apps/web/src/lib/rulesDocs.ts` for structured documentation expansion.

### To-hit

`packages/domain/src/encounter/toHitTable.ts:COMBAT_TO_HIT_RULE_TABLE` is canonical
structured domain data. It is not registered with the general documentation
directive used by hit location, and the combat presentation normally renders only
the selected outcome rather than the relevant table context.

### Criticals, Combat Experience, Offensive Parry, and other tables

These have domain/rules or prose-documentation sources but no uniform contract by
which domain resolution, Current Action, Result, History, and published documentation
consume one structured table.

The correct ownership is:

```text
canonical domain/rules table
  -> rules-engine resolution
  -> combat presentation adapter
  -> documentation adapter
```

## 10. Modifier completeness and reconciliation

### Conformant foundations

- Active, pending, expired, and future modifier lifetimes are distinct.
- Phase and initiative-group applicability are canonical.
- Imported, generated, character-state, and persistent rows retain provenance.
- Observe Opponent is pair-specific and applied once in canonical attack/parry
  validation.
- Historical modifier presentation uses recorded snapshots.

### Non-conformances

- Empty General/Fatigue, Initiative, Skill/OB, and DB/Parry categories render in
  ordinary summary presentation.
- Observation bonuses are separate from the displayed category totals.
- Live loadout summaries do not carry all target context needed for pair-specific
  contributions.
- There is no consistent concise indicator for active nonnumeric or special effects
  that may alter choices.
- Provisional declaration-derived values are not consistently marked as provisional.

The normalization must preserve one canonical modifier source. It must not persist a
second presentation-only copy of relationship or generated modifiers.

## 11. Result ordering and immutability

Canonical chronological event storage is sound:

- `appendCombatStepEventForCommand` allocates `max(sequence) + 1`;
- derived legacy events receive deterministic sequence;
- current and historical selectors sort by canonical sequence and stable identity;
- observation/SU sequencing has focused regression coverage;
- undo removes or reverts the canonical source facts.

Historical snapshot immutability is also sound:

- archived inspector models consume immutable archive facts;
- calculation and modifier snapshots are not recalculated from current participant
  or equipment state;
- later active revisions do not rebuild archive-owned presentation.

The defect is therefore not event persistence order and not archive mutation. It is
that presentation does not consistently group one accepted action and its
subordinate rolls, responses, consequences, notes, and calculations into one stable
result entry.

## 12. Calculation grammar

The required grammar is:

1. contributing stat and value;
2. skill and total Skill XP;
3. contributing modifiers in canonical order;
4. modifier total;
5. pre-roll Skill total or action-specific combat total;
6. Roll and bounded open-ended facts;
7. final numeric total/result used for lookup.

Current violations include:

- missing contributing stat and Skill XP outside specialized Observation facts;
- incomplete modifier provenance and total;
- attack arithmetic collapsed into one equation;
- inconsistent `Skill`, `Effective skill`, `Total`, `Result`, and `Final total`
  terminology;
- outcome and consequence prose inside contest calculation panels;
- `Outcome` inside Dodge calculation rows;
- arbitrary generic fact rendering;
- different live and historical calculation presenters.

The shared contract must consume snapshotted canonical facts and must never
recalculate combat rules in React.

## 13. Combat notes

### Accepted product decision

Manually entered combat notes are always player-visible result commentary.

This includes notes entered during:

- Feint;
- Adjust Distance or Adjust Range;
- damage/effects review;
- other combat-result workflows.

A committed combat note:

- belongs to the accepted result;
- is visible wherever that result is player-visible;
- persists in Current step results;
- persists in immutable History;
- is not private GM metadata.

Private diagnostics or adjudication metadata may remain private only when modeled as
a distinct field with a distinct purpose and label.

### Current non-conformance

Declaration `additionalActionNotes` are retained in snapshots and are player-visible.
In contrast:

- Feint review stores `notes` under `facts.gmReview`;
- Adjust Distance review uses a `GM note` control and private review data;
- damage/effects review labels the field `GM note (private, optional)`.

`projectCombatHistoryEvent` correctly removes `gmReview` from player projections, so
these manually entered notes never reach the player. The privacy sanitizer is
behaving according to the current schema; the schema and labels assign the wrong
semantic ownership to player-intended combat commentary.

Remediation must introduce or reuse an explicit public result-note fact. It must not
weaken sanitization by making all `gmReview` data public.

## 14. GM/player parity

Conformant behavior:

- GM Player Combat reuses Player Combat presentation;
- GM Player differs only by the existing participant selector/proxy context;
- `gmReview` is removed server-side;
- private calculations are projected only to authorized rollers/viewers;
- Observe Opponent relationships and target calculations preserve ordered-pair
  privacy;
- archived snapshots are sanitized before reaching clients.

Remaining risks:

- GM current, player current, and archived results can use different visual grammar
  for the same visible fact;
- opponent totals are visible for some involved-player contests and hidden for
  others. Each case must remain governed by its canonical action privacy contract
  during shared calculation migration;
- public combat notes must be added to the player-safe projection without exposing
  unrelated diagnostics.

## 15. Recommended normalization slices

This is the approved dependency order. A slice may refine internal names, but it must
not bypass or reorder these ownership dependencies without updating this audit.

### 15.1 Canonical Result Envelope and Public Combat Notes

- **Purpose:** establish one stable action/result identity and an explicit
  player-visible combat-note fact.
- **Defects addressed:** fragmented result ownership, incomplete action lineage,
  private player-intended notes, absent standard-versus-adjusted result facts.
- **Likely ownership:** domain event/result schemas and projection, followed by shared
  result view models.
- **Dependencies:** none; this is the semantic foundation for later slices.
- **Acceptance criteria:** one accepted action has one result envelope; public notes
  are visible to every viewer authorized to see the result; private diagnostics stay
  private; reload, undo, and history preserve identity and facts.
- **Exclusions:** no calculation grammar rewrite, modifier changes, maneuver-rule
  changes, or layout cleanup.

### 15.2 Shared Calculation Presentation Contract

- **Purpose:** define bounded canonical calculation facts and one arithmetic-only
  presentation grammar.
- **Defects addressed:** incompatible formatters, missing stat/Skill XP/modifiers,
  generic fact dumping, outcomes inside calculations.
- **Likely ownership:** domain/shared calculation projection with pure web
  presentation adapters.
- **Dependencies:** result envelopes must provide stable calculation ownership.
- **Acceptance criteria:** all supported calculations render the normative semantic
  order; arithmetic reconciles exactly; no internal identifiers or outcome prose;
  current and history consume the same presenter over snapshots.
- **Exclusions:** no gameplay formula changes and no recalculation from current
  character sheets.

### 15.3 Atomic Chronological Result Ledger

- **Purpose:** present each committed action as one stable result with ordered
  subordinate events.
- **Defects addressed:** fragmented Feint, distance, attack/parry, location, critical,
  and damage entries; unstable conceptual numbering.
- **Likely ownership:** shared result-ledger view model using result-envelope identity
  and canonical event sequence.
- **Dependencies:** slices 15.1 and 15.2.
- **Acceptance criteria:** later results append; subordinate events remain ordered;
  existing entries do not move or duplicate; canonical undo removes/reverts only the
  affected envelope; live and history use the same ledger grammar.
- **Exclusions:** no event-sequence rewrite and no archive persistence migration.

### 15.4 Modifier Completeness and Live-Value Reconciliation

- **Purpose:** reconcile visible modifiers, category totals, live tables, command
  signatures, and calculation snapshots.
- **Defects addressed:** target-specific visibility gaps, observation excluded from
  summary totals/live tables, empty-category noise, incomplete special-effect
  indication.
- **Likely ownership:** canonical modifier contribution projection, Active
  Presentation, loadout presentation, and modifier components.
- **Dependencies:** shared calculation facts and ledger result consequences.
- **Acceptance criteria:** every visible applicable modifier is included once in each
  relevant live value; opponent-specific rows apply only to the matching opponent;
  expired/future rows are excluded; empty categories are hidden outside review;
  history remains unchanged.
- **Exclusions:** no new modifier rules, no duplicate persisted modifiers, and no
  change to Observe Opponent progression.

### 15.5 Canonical Maneuver Tables and Documentation

- **Purpose:** make table-driven resolution, UI, and published documentation consume
  one structured source.
- **Defects addressed:** duplicated Feint rows and other table drift; missing
  standard-versus-adjusted table context.
- **Likely ownership:** domain/rules structured table definitions with rules-engine,
  UI, and documentation adapters.
- **Dependencies:** result envelopes and calculation grammar must be able to retain
  table identity and selected band.
- **Acceptance criteria:** resolver, UI, tests, and docs reference the same table;
  applicable row is highlighted; committed results preserve table identity, standard
  values, and adjusted values.
- **Exclusions:** no rule-value invention or spreadsheet approximation.

### 15.6 Historical Grammar Conformance

- **Purpose:** apply the normalized result, note, calculation, modifier, and table
  grammar to immutable archive facts.
- **Defects addressed:** live/history grammar drift and incomplete historical
  presentation.
- **Likely ownership:** Archived Presentation and shared presenters.
- **Dependencies:** slices 15.1 through 15.5.
- **Acceptance criteria:** current and historical facts use the same grammar;
  snapshots remain immutable; later active state cannot contaminate history; legacy
  incomplete records have an explicit bounded compatibility presentation.
- **Exclusions:** no archive rewrite, history virtualization, or storage migration.

### 15.7 Panel Responsibility and Concision

- **Purpose:** restore stable panel responsibility and remove presentation noise.
- **Defects addressed:** committed facts in centre context, explanatory prose, empty
  sections, and avoidable vertical movement.
- **Likely ownership:** GM/player composition components and Selection/Pending
  overlays.
- **Dependencies:** normalized result, calculation, modifier, and history models.
- **Acceptance criteria:** Current Action contains unresolved work only; Results own
  committed facts; six-panel horizontal geometry remains stable; empty sections are
  suppressed; no rules-teaching prose.
- **Exclusions:** no canonical progression or rules changes and no broad visual
  redesign.

### 15.8 Action-Family Completion and Migration

- **Purpose:** migrate every implemented action to the shared grammar and ensure new
  actions begin conformant.
- **Defects addressed:** residual action-specific presenters and incomplete
  Counterattack, Disarm, Parry–Disarm, Break Off, or future workflow presentation.
- **Likely ownership:** each canonical action process plus the shared presentation
  adapters established by earlier slices.
- **Dependencies:** slices 15.1 through 15.7.
- **Acceptance criteria:** action-family conformance matrix reaches Compliant where
  applicable; no action creates a competing result/calculation/modifier/note grammar;
  parity, privacy, reload, undo, and history remain exact.
- **Exclusions:** action rules not separately approved for implementation and broad
  combat-engine redesign.

## 16. Acceptance tests for each slice

| Slice | Required acceptance coverage |
| --- | --- |
| Canonical Result Envelope and Public Combat Notes | Public note visible in GM, Player, and GM Player when the result is visible; note persists in current results and archive; private diagnostics remain absent; result identity survives reload; standard and adjusted values survive; undo is exact. |
| Shared Calculation Presentation Contract | Required semantic order; total Skill XP; complete contributing modifiers and total; exact arithmetic reconciliation; no IDs or outcome prose; open-ended facts retained; same presenter for current and archive. |
| Atomic Chronological Result Ledger | Feint and attack-consequence chains create one stable top-level result; subordinate facts stay ordered; later events do not renumber earlier actions; repeated projection does not duplicate; undo affects only the canonical envelope. |
| Modifier Completeness and Live-Value Reconciliation | A visible modifier appears exactly once in category total, live weapon/combat value, signature, and result calculation; opponent-specific value is absent against other targets; mutual values remain independent; expiry updates live state but not history; empty summary categories are hidden. |
| Canonical Maneuver Tables and Documentation | Rules resolver, Current Action, committed Result, tests, and docs consume one table source; selected band is highlighted; standard and adjusted values are distinguishable; table source has exact rule-backed expected rows. |
| Historical Grammar Conformance | Archived output remains semantically identical after current participant, equipment, modifier, or rule-display changes; notes/calculations/table bands persist; legacy incomplete facts display an explicit compatibility state; player-safe history remains sanitized. |
| Panel Responsibility and Concision | Stable three-column/two-row horizontal placement; Action Button Area remains centre-lower; completed facts appear only in Results/History; unresolved facts remain in Current Action; empty/noise sections suppressed; representative actions contain no explanatory rule prose. |
| Action-Family Completion and Migration | Per-family GM, Player, GM Player, privacy, result, calculation, modifier, history, reload, and undo tests; unimplemented action shells do not claim conformance; newly implemented actions use shared contracts only. |

## 17. Risks and uncertainties

- Exact pixel stability, responsive behavior, focus, and vertical motion need a
  browser-level audit after panel normalization.
- Legacy encounters may lack the bounded calculation and result facts required by
  the normalized grammar.
- Public combat-note migration must add a public field rather than exposing all
  existing `gmReview` data.
- Some special effects change available choices without a numeric contribution; the
  canonical source for their warning indicator must be explicit.
- Opponent-total visibility remains action-specific where canonical privacy requires
  it.
- Counterattack, Disarm, Parry–Disarm, Break Off, and Other cannot receive a complete
  presentation classification before their canonical workflows exist.
- Shared maneuver-table work must not invent missing rule rows or replace verified
  spreadsheet/rules sources with presentation approximations.
- The older
  [combat-presentation-contract.md](./combat-presentation-contract.md) includes
  calculation outcome prose that conflicts with the normative arithmetic-only
  guideline. Normalization must follow the guideline and record any required
  compatibility handling.

## 18. Audit baseline metadata

| Field | Baseline |
| --- | --- |
| Audit date | 2026-07-29 |
| Branch | `feature/player-general-encounter-screen` |
| Audited HEAD | `d3b1a7fd3f801b34bf57b151c7595fd44e318b1f` |
| Audited commit subject | `docs(combat): define combat presentation guidelines` |
| Worktree before audit-document edits | Clean; branch was one commit ahead of `origin/feature/player-general-encounter-screen` |
| Web verification | 106 test files passed; 909 tests passed; 1 skipped |
| Focused domain verification | 4 test files passed; 38 tests passed |
| Domain focus | Combat history projection, Observe Opponent, attack modifier validation, event persistence |
| Audit mutation policy | Source inspection and tests only; no authenticated encounter mutation |

The verification results establish current behavior; they do not imply that behavior
is presentation-conformant. Several tests intentionally characterize the current
private-note and calculation grammars recorded as non-conformances above.
