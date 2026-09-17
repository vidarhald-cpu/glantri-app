# Target Critical catalogue V1

Status: complete rules/content candidate from Forgejo #216; non-runtime

Authority: Forgejo #216, Rule Decision 0005, and Combat Round End & Review V1

Catalogue package: [Target Critical catalogue V1](../source/combat/target-critical-catalogue-v1/README.md)

## Purpose and boundary

This document states the common rules consumed by the complete 608-key target catalogue. The
catalogue is future implementation and QA fixture authority after acceptance. Neither this document
nor the package changes current Critical lookup, production tables, representative fixtures, Combat,
rules-engine, API, web behavior, persistence, schemas, migrations, routing, armor arithmetic, or
Round End behavior.

Historical workbook rows and current runtime behavior remain traceable evidence. The authored target
objects and Rule Decision 0005 control where that evidence conflicts with the future model.

## Critical resolution

```text
attack / hit
  -> damage lookup
  -> Critical grade A-F
  -> closed Critical roll + grade modifier - armor Critical modifier
  -> resolved Critical index
  -> family + location scope + index
  -> authored outcome
```

Armor protection is subtracted from the Critical result.

- result `<= 0`: no Critical effect;
- result `01–16`: direct catalogue lookup;
- result `> 16`: use result `16`.

There are no authored indexes above 16, exploding Critical rolls, or continuation tables in V1.
Attack/weapon routing to the frozen eight families remains future implementation work.

## Catalogue axes

The catalogue key is `Critical family × applicable location scope × resolved Critical index`.
Critical grade A–F is not an axis.

Frozen families:

- `sharp`
- `blunt`
- `pointed_weapons`
- `arrows_bolts`
- `teeth_claws`
- `firearms`
- `falling_crushing`
- `fire_energy`

Frozen location scopes:

- `head`
- `arm`
- `chest`
- `abdomen`
- `upper_leg`
- `lower_leg`
- `whole_body`

The first six families use the six regional scopes. Falling/Crushing and Fire/Energy use only
`whole_body`. This yields exactly 608 positions. Left/right and narrower anatomy are consequence
context, not selector axes.

## Authoring bands

| Index | Band         |
| ----- | ------------ |
| 01–03 | Minor        |
| 04–06 | Moderate     |
| 07–09 | Serious      |
| 10–12 | Severe       |
| 13–14 | Catastrophic |
| 15–16 | Fatal        |

Lower-leg 15–16 is Catastrophic. Band is a combined-burden calibration tool and does not itself add
death, incapacity, Stunned, Bleed, or persistent injury.

## Consequence composition

An outcome is a composition of independent consequences. Its readable prose cannot create
mechanics. The six kinds are damage floor, modifier, periodic loss, condition, operation, and
information.

Every active consequence has a structured target, timing, visibility, source identity, and
termination or lifecycle where applicable. Persistent or terminal facts without an authorized
runtime consumer are structured non-runtime content rather than free prose.

### Damage floor

The damage-floor rule is:

```text
final total physical damage = max(reviewed physical damage, authored minimum total damage)
```

The floor never creates a second damage stream.

### Dazed and Stunned

- Dazed: General `-2`.
- Stunned: General `-4`.
- Independent sources add and retain separate duration, recovery, treatment, expiry, history, and
  provenance.
- A duplicate of the exact same event/source is an idempotency defect.
- Dazed and Stunned from one wound remain separate consequences.
- No result varies the numerical meaning of either name.

Semantic action state is not inferred from a named modifier. Collapse, prone, fall, unconsciousness,
function loss, item drop, incapacity, and `action_limited_to_parry` require separate conditions or
operations. The only parry-only outcomes are `sharp|chest|04` and `blunt|chest|04`.

### Ordinary modifiers and function

Ordinary modifiers contribute to their named channel and keep a structured anatomical or functional
target. Function impairment or loss is a separate condition. A fall is an immediate operation;
prone is a condition. An item drop is an operation and does not remove permanent inventory.

### Bleed

Each external or internal Bleed is an exact rational source. Active source rates add only for HP
application. Source identities and lifecycles remain separate.

- External: `active -> controlled -> staunched -> resolved`.
- Internal: `active -> stabilised -> resolved`.
- First full accrual follows one complete subsequent round.
- Creation-round boundary accrual is zero.
- Treating one source changes only that source.
- No legacy automatic ten-round Health cadence exists.

### Treatment

Treatment dependencies are source-specific semantic events such as external-Bleed control,
stabilisation, controlled extraction, immobilisation, burn care, extinguishing flames, airway
support, or expert care. A generic source phrase does not manufacture a Skill, difficulty, equipment
requirement, or cure. A treatment event affects only the consequences that explicitly name it.

### Persistent and terminal content

Persistent injury, physiology, and terminal outcomes are fully structured target content and count
toward severity. They remain non-runtime until a separate task authorizes a consumer, lifecycle,
persistence contract, and migration. Their presence does not activate inert physiology evaluators or
current death mechanics.

### Fire/Energy

Fire/Energy retains cause conditionals inside outcomes rather than adding axes. Explosion/lightning
hearing effects, clothing/fur ignition, exposed-target effects, and equipment effects apply only
when their structured condition matches.

The approved non-Bleed content rates are:

| Key                           |           Rate | First accrual                       | End event                            |
| ----------------------------- | -------------: | ----------------------------------- | ------------------------------------ |
| `fire_energy\|whole_body\|06` | `1/4 HP/round` | after one complete subsequent round | flames extinguished                  |
| `fire_energy\|whole_body\|09` | `1/3 HP/round` | after one complete subsequent round | cooling and burn-shock stabilisation |
| `fire_energy\|whole_body\|10` | `1/2 HP/round` | after one complete subsequent round | airway and circulatory stabilisation |

These are target content only. No current executable non-Bleed periodic loss is authorized.

## Time and recovery

One round is approximately three seconds.

Fixed `N rounds` means the remainder of the creation round plus N complete subsequent rounds. A
fixed one-round effect created in Round 7 is active throughout Round 8 and expires at the end of
Round 8.

`rolled_fixed` is rolled once on application, then behaves as a fixed duration. A scheduled check
marks an uncertainty-resolution point; failure preserves the state and reaching the checkpoint never
causes automatic expiry. A bounded check defines both its maximum attempts and the state transition
after the final failure. Condition/event consequences end only through their named event.

All due fixed expiry, scheduled checks, and bounded checks process in the visible Round End Effects
slot while the current round remains open. GM Review follows. Only Start New Round creates the next
round.

## Combat Experience

Every resolved catalogue Critical schedules a fresh CE roll for the struck character in the next CE
pre-phase. The current CE state and modifier persist until the new roll replaces them. Round End may
show the schedule becoming due but does not perform the CE roll.

## Stacking and precedence

Unless an explicit entry rule says otherwise:

- independent modifier and effect sources coexist and add;
- Bleed rates aggregate for HP only;
- damage floors use the maximum against reviewed physical damage;
- semantic conditions coexist when their targets and meanings do not conflict;
- treatment changes only the named source;
- CE replaces prior CE state only when the fresh roll resolves; and
- exact-event duplication is rejected rather than stacked.

The concrete catalogue-created interactions and exceptions are recorded in
[`interaction-ledger.jsonl`](../source/combat/target-critical-catalogue-v1/interaction-ledger.jsonl).

## Source trace and verification

Every catalogue entry preserves exact result and effect coordinates. Every one of the 2,179 effect
rows has a final disposition in
[`source-dispositions.jsonl`](../source/combat/target-critical-catalogue-v1/source-dispositions.jsonl).
Distribution and canonical examples are part of the durable package. The verification record is
[Target Critical catalogue V1 audit](../audits/target-critical-catalogue-v1.md).
