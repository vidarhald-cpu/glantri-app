# Rule decision 0005: Critical effect semantics and timing

- Status: approved
- Date: 2026-09-17
- Product owner: Vidar Hald
- Related portfolio areas: Forgejo #111 Criticals / Injury; Forgejo #116 Combat Actions / Turn Flow / Review
- Complements: [decision 0001](./0001-c1-critical-injury-recalibration.md), [decision 0004](./0004-c1-critical-authoring-and-adjudication.md), and [Combat Round End & Review V1](../../architecture/combat-round-end-review.md)
- Supersedes: decision 0004 and other existing documentation only where they treat Stun as a variable numeric family, consume the creation round as a promised full round, generalize legacy Health cadence to future Bleed, or lose independent effect-source identity
- Superseded by: none

## Question

What named effects, stacking rules, duration semantics, Bleed behavior, treatment dependencies, and catalogue structure govern the complete future Critical catalogue and the shared Combat effect model?

## Evidence and limitation

This decision records the Product Owner ruling **Record Approved Critical Effect Rules**. It resolves the target semantics that the complete Critical catalogue must consume. Recovered Critical material, the accepted representative C1 fixtures, inert physiology evaluators, and current runtime behavior remain evidence; none of them overrides this ruling.

This is a rules and documentation decision only. It does not change runtime behavior, schemas, migrations, fixtures, existing tables, active effects, persisted combat state, or the currently integrated C1 adapter. Historical C1 behavior that conflicts with this target remains readable as historical/current implementation evidence until separately authorized implementation and migration work reconciles it.

The exact authoritative Critical-family names, hit-location taxonomy, and severity or grade scale remain under bounded recovery. This decision must not invent them.

## Named effects

### Stunned

**Stunned** is one canonical named effect:

```text
Stunned — General -4
```

The particular Critical that creates Stunned authors its duration. That duration may be fixed, rolled, check-based, or condition/event based. Stunned has no generic recovery roll; a recovery roll exists only when the authored Critical explicitly specifies one.

Stunned is not a variable `-1`/`-2`/`-4`/`-8` family. Future Critical authoring must not vary the numerical meaning of the Stunned name to express severity. Severe Criticals, especially substantial head or body trauma, are expected to be a common source of Stunned, but severity comes from the complete consequence composition rather than from changing Stunned's canonical value.

Historical content that labels another numeric value as Stun remains evidence until reconciliation. This decision does not automatically rename or remap such a row. The complete catalogue authoring pass must express it as Dazed, an ordinary modifier, a different semantic effect, or another approved consequence only when the authored outcome supports that choice.

### Dazed

**Dazed** preserves the lighter historical condition as a distinct named effect:

```text
Dazed — General -2
```

Dazed is not Stunned. It represents lesser disorientation, imbalance, or partial dazing and has an independently authored duration.

## Stacking and source identity

Independent modifier and effect sources stack additively unless an explicit rule says otherwise.

- Dazed `-2` plus Stunned `-4` produces current aggregate General `-6`.
- Two Stunned effects from distinct wounds produce current aggregate General `-8`.
- Identical effects caused by distinct wounds remain distinct sources.

The application may display aggregate totals, but each source remains authoritative for its own duration, treatment, recovery, expiry, provenance, and history. Sources must not be merged into one effect with an invented combined duration.

Duplicate application of the exact same event or source is an idempotency defect. It is not legitimate stacking.

Stunned, Dazed, Bleed, and other consequences caused by one wound also remain separate effects. Sharing one wound source does not collapse them into one lifecycle.

## Bleed stacking and identity

All Bleed sources stack. Each wound retains its own Bleed source with independent:

- exact or fractional rate;
- external or internal classification;
- treatment and control state;
- recovery; and
- provenance.

Aggregate HP loss may be calculated from every active source, but treating or stopping one source does not affect another.

Example:

```text
Wound A
- Stunned -4, 2 rounds
- External Bleed 0.2 HP/round

Wound B
- Dazed -2, 1 round
- External Bleed 0.1 HP/round

Current aggregate
- General -6
- Bleed 0.3 HP/round
```

All four sources remain independently tracked despite the displayed aggregate values.

## Round scale and fixed durations

A Combat round is approximately three seconds. Fixed round durations use this canonical rule:

> **N rounds means the remainder of the round in which the effect is created plus N complete subsequent rounds.**

Therefore:

- remainder of the current round is not the same as one round;
- an effect created during Round 7 with duration one round remains active throughout Round 8 and expires at the end of Round 8; and
- an effect created during Round 7 with duration two rounds remains active throughout Rounds 8 and 9 and expires at the end of Round 9.

Any current implementation that consumes the creation round as one of the promised complete rounds is inconsistent with the approved target and must be reconciled during separately authorized implementation.

Critical authors must evaluate durations, reroll cadence, and Bleed rates against the real-time scale:

```text
1 round ≈ 3 seconds
20 rounds ≈ 1 minute
```

This is an authoring constraint. Bleed rates are mechanical HP-equivalent rates rather than literal blood-volume measurements, but authors must still consider their per-minute implications.

## Temporal structures

Criticals and effects may legitimately use different temporal structures:

- **Fixed duration:** a known duration followed by expiry.
- **Scheduled uncertain reroll/check:** the current state persists until another uncertainty-resolution point becomes due.
- **Bounded uncertain reroll/check:** repeated uncertainty has an authored maximum number of checkpoints or forced transition.
- **Condition/event termination:** a named treatment, condition, event, or other rule ends the effect.
- **Persistent injury or physiology consequence:** the consequence persists according to its own injury or physiology rule.

Do not force every Critical into one timer model. In particular, “roll/check again in N rounds” schedules the next uncertainty-resolution point. It does not mean the current state deterministically expires then.

## Bleed and Health target rule

C1-style Bleed is the target direction for future Criticals:

- exact and fractional rate handling;
- source-specific external and internal Bleed;
- explicit treatment and control states; and
- first full accrual only after one complete subsequent round, never at the creation-round boundary.

The legacy automatic Health-every-ten-rounds rule must not be generalized to C1 or future Bleed. A Health check occurs only where the particular Critical or recovery rule explicitly specifies it. Legacy Health cadence remains legacy behavior until deliberately migrated under separate authority.

## Source-specific treatment dependencies

Treatment and removal dependencies belong to the source that authored them.

- `until staunched` resolves only when the associated external Bleed source is actually staunched;
- `until stabilised` resolves only against the associated internal source; and
- `until care` resolves only through the explicit qualifying treatment event defined by that effect.

Partial control is not staunched. Treating one wound must not clear another wound or an unrelated effect.

## Physiology and shock boundary

Existing inert physiology or shock evaluators remain calibration and future-design evidence only. Do not activate them in current Combat or Critical work until the complete Injury/Critical model is approved and implementation is separately authorized.

## Ordinary and special modifiers

Ordinary modifiers are numerical contributions to established modifier categories.

Special modifiers and effects retain:

- semantic name;
- description;
- source;
- any numerical channels;
- timing and recovery; and
- visibility.

A special effect may have no numerical modifier when its consequence is semantic or adjudicative. When a special effect contributes a number to an aggregate total, that aggregation must not erase its meaning or source identity.

## Complete Critical catalogue structure

The approved structural direction is:

```text
Critical family × hit location × severity
```

The Critical roll selects the authored outcome within that space.

- Attacks and weapons map to Critical families instead of receiving bespoke tables by default.
- Armor modifies Critical resolution instead of multiplying the catalogue into armor-specific tables.
- A Critical is a structured composition of independent consequences.
- Severity is judged by the combined burden of damage, Bleed, Dazed, Stunned, ordinary modifiers, special effects, duration, recovery uncertainty, incapacity, and persistent injury. It does not change the canonical numerical meaning of Stunned or Dazed.
- Player-facing prose and structured mechanical consequences remain distinct.

The exact family names, location taxonomy, and severity or grade scale remain recovery inputs and are not resolved by this decision.

## Full-catalogue authoring contract

These rules are controlling inputs for the upcoming complete Critical catalogue. The target is a full catalogue, not another representative sample.

Every target Critical must define, where applicable:

- immediate consequence or damage;
- Bleed;
- Dazed;
- Stunned;
- ordinary modifiers;
- special effects;
- timing;
- recovery or check structure;
- persistent injury; and
- other interactions.

Catalogue-wide severity and distribution review follows the full authoring pass.

## Executable examples

These examples are future acceptance cases. They do not authorize implementation now.

1. A Round 7 Stunned effect with duration one round remains active for all of Round 8 and expires at the end of Round 8.
2. Dazed from one wound and Stunned from another produce General `-6`; removing Dazed leaves Stunned and General `-4`.
3. Two independently sourced Stunned effects produce General `-8`; expiry of one leaves the other source and General `-4`.
4. Applying the same source event twice creates one source and reports an idempotency defect rather than stacking it.
5. External Bleed `0.2` and external Bleed `0.1` remain separate sources while producing aggregate `0.3 HP/round`; staunching the first leaves the second active.
6. Bleed created in Round 7 does not accrue at the end of Round 7. Its first full accrual is at the end of Round 8.
7. “Roll again in two rounds” retains the current state until the scheduled check resolves it; reaching the checkpoint does not itself expire the state.
8. A Health check is absent unless the authored Critical or recovery rule explicitly requires one.

## Implementation consequences and boundary

Future implementation must audit and reconcile:

- variable Stun labels and values;
- Dazed representation;
- source-preserving additive stacking;
- duplicate-event idempotency;
- fixed-duration off-by-one behavior;
- scheduled-check versus deterministic-expiry handling;
- source-specific Bleed accumulation and treatment;
- legacy automatic Health cadence; and
- semantic special-effect presentation and history.

No item in that audit is authorized for runtime change, fixture change, migration, or data rewrite by this documentation task.

## Verification and traceability

- [Decision 0004](./0004-c1-critical-authoring-and-adjudication.md) remains authoritative for its six-kind C1 atom model, immutable canonical facts, GM-delta boundary, exact Bleed source arithmetic, and non-executable periodic-loss boundary except where this successor explicitly supersedes it.
- [Combat Round End & Review V1](../../architecture/combat-round-end-review.md) remains authoritative for visible timing, review order, and explicit new-round transition.
- [Glantri Critical Effects](../../rules/combat-critical-effects.md) continues to document current runtime and historical behavior; current behavior that conflicts with this target requires a separately authorized reconciliation.
