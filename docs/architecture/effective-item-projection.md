# Canonical effective-Item projection

## Authority and boundary

`projectEquipmentItem(item, template)` is the canonical live authority for a template-backed
Item:

```text
template + sparse typed Item characteristics/contributions -> effective Item projection
```

The contract implements issue
[#307](https://github.com/vidarhald-cpu/glantri-app/issues/307) and the accepted product-owner
decisions in #289, especially the
[relative template model](https://github.com/vidarhald-cpu/glantri-app/issues/289#issuecomment-5332308433),
[visibility, initiative, and final-OB rules](https://github.com/vidarhald-cpu/glantri-app/issues/289#issuecomment-5339733317),
[closed typed vocabulary](https://github.com/vidarhald-cpu/glantri-app/issues/289#issuecomment-5353188315),
[cross-characteristic first slice](https://github.com/vidarhald-cpu/glantri-app/issues/289#issuecomment-5353239872),
and [DMB/Critical boundary](https://github.com/vidarhald-cpu/glantri-app/issues/289#issuecomment-5353353019).
Issue [#306](https://github.com/vidarhald-cpu/glantri-app/issues/306) still owns unresolved
equipment vocabulary and nullability decisions.

The projector is pure and deterministic. It does not read or write a database, mutate the Item
or template inputs, change ownership/storage/loadout, or recalculate historical resolved actions.
It returns the effective template plus a sorted characteristic ledger. Consumers use the ledger
for base/contribution/effective/provenance presentation and the effective template for later
calculation adoption.

## Mechanical state and privacy

Mechanical facts have exactly three valid states:

| Visibility | Active  | Canonical state   | Mechanical effect                    | Player-safe projection         |
| ---------- | ------- | ----------------- | ------------------------------------ | ------------------------------ |
| `gm_only`  | `false` | hidden+dormant    | none                                 | fact and provenance absent     |
| `revealed` | `false` | revealed+inactive | none                                 | visible, inactive contribution |
| `revealed` | `true`  | revealed+active   | applied once by its composition rule | visible, active contribution   |

Persisted V1 JSON without `active` remains compatible: revealed mechanics parse active and GM-only
mechanics parse dormant. Explicit hidden+active input is rejected. Template-normal truth remains
revealed; reveal state applies to instance facts.

The GM projection includes hidden dormant contributions for audit. Pass `{ audience: "player" }`
for the player-safe contract; hidden fact IDs, values, provenance, and unsupported/descriptive
facts are omitted before the projection is returned.

## Supported authored characteristics

All supported mechanical adjustments are signed integer deltas with explicit scopes. Duplicate
kind+scope facts are rejected.

| Family               | Typed facts                                                                                                 | Scope/composition                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Attack mode          | `attack_mode_ob_delta`, `attack_mode_dmb_delta`, `attack_mode_initiative_delta`                             | exact attack-mode ID; additive      |
| Initiative fallback  | `fallback_initiative_delta`                                                                                 | equipment fallback; additive        |
| Weapon defense       | `weapon_parry_delta`, `weapon_defensive_value_delta`                                                        | equipment; additive                 |
| Shield defense       | `shield_parry_delta`, `shield_defensive_value_delta`                                                        | equipment; additive                 |
| Armor locations      | `armor_location_value_delta`, `armor_location_critical_modifier_delta`                                      | one stable armor location; additive |
| Armor general inputs | `armor_general_critical_modifier_delta`, `armor_activity_modifier_delta`, `armor_perception_modifier_delta` | equipment; additive                 |

Numeric DMB adds directly. Dice-backed DMB changes only `flatModifier`; `diceCount`, `diceSides`,
`textModifier`, and source `raw` remain unchanged. `special` and `unresolved` DMB formulas are
projected but reject authored deltas.

An active armor-location adjustment changes only that location. The projector recomputes the
existing derived general armor contract (mean of the nine canonical locations and `Math.round`
for the rounded output). `armorRating` and `generalArmorRounded` are derived and never direct
authoring targets.

Maximum durability, base encumbrance, and base value use the existing typed Item fields
`durabilityMax`, `encumbranceOverride`, and `valueOverride` as replacement contributions. Maximum
durability retains the positive-integer Item invariant. Formula-backed non-numeric encumbrance is
read-only for new authoring; an existing compatibility replacement is still projected faithfully.
`durabilityCurrent` is returned separately as mutable Item state and is never treated as a template
variation.

## Legacy compatibility

`weapon_initiative_override` remains accepted durable input, but never remains an absolute live
authority. The projector derives one relative delta:

```text
legacy Item value - source template fallback value = compatibility delta
```

It applies that delta to the fallback and every exact existing attack-mode initiative. Thus source
template `2`, legacy Item `1` becomes delta `-1`; exact modes `2` and `3` become `1` and `2`.
The original fact ID/value/visibility and optional source template ID, value, version, source, and
migration provenance remain attached to each explicit scoped contribution. When older JSON lacks
source provenance, the current matching template fallback is the compatibility source. Typed and
legacy initiative facts cannot coexist, preventing competing authority.

`final_attack_ob_delta` remains a separate characteristic with calculation stage
`final_attack_ob`. It never changes attack-mode OB in `effectiveTemplate`.
`getFinalAttackObDelta(projection)` is the consumer boundary: apply the returned integral value
exactly once immediately before attack roll/table lookup, after earlier modifiers, percentages,
and rounding. The projector does not broadly migrate Combat in this slice.

## Projected read-only truth

The ledger faithfully exposes inherited values but marks these non-authorable with a reason:

- attack-mode/free-form range;
- attack-mode and legacy Critical codes and second Critical;
- attack-mode and legacy free-string armor modifiers;
- `shieldBonus` and shield movement aliases;
- armor location type strings, mobility, movement, and factor fields;
- derived general/rounded armor;
- special or unresolved DMB formulas.

The complete cloned effective template also preserves structural fields and unsupported component,
class, skill, handling, capability, ammunition, readiness, and formula truth. New Item authoring for
those fields must wait for an accepted unit, scope, composition, calculation-stage, nullability, and
closed-vocabulary contract—normally #306 or a separate rule decision. There is no arbitrary field
path or generic number fallback.

## Persistence and adoption

`EquipmentItemFactsV1` gains an optional `characteristics` list, so existing JSON and database
rows remain valid without schema or migration changes. The campaign Item write parser accepts and
validates the typed list but no workshop/UI is adopted here. Package-root exports are unchanged:
the existing `@glantri/domain/equipment` and `@glantri/rules-engine` exports already expose the
schema and projector modules.

Current Combat, planning, loadout, and existing encumbrance/value compatibility consumers remain
unchanged in this slice to protect behavior before deliberate adoption. They are migration targets,
not a license to add another calculation path. New consumers must call the projector rather than
read raw Item facts. Historical action snapshots must continue to use their stored values and must
not invoke the live projector during replay.

## Conformance evidence

`packages/rules-engine/src/equipment/projectEquipmentItem.test.ts` is the golden contract for
ordinary/unique weapons, numeric and dice DMB, legacy initiative/provenance, all three mechanical
states, player redaction, late final OB, shield values/aliases, armor isolation/derivation,
read-only unsupported values, typed Item basics, deterministic serialization/reload, and input/
ownership/storage immutability. Domain and API parser tests protect schema and durable input
compatibility.
