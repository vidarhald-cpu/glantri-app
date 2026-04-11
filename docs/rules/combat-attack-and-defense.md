# Combat Attack And Defense

This document defines the current Glantri combat-system design as it exists in the repository after weapon import, enrichment, formula normalization, and loadout combat-state derivation.

The goal is to make the combat model explicit for developers and Codex. This is a rules and implementation reference, not a full in-play combat procedure.

## Design Principle

- Combat-facing values should be derived from current state, not stored as a second source of truth.
- Source layers stay separate:
  - raw import
  - manual enrichment
  - formula normalization
  - current-state derivation
- Canonical weapon content should preserve source truth even when a value cannot yet be turned into a single number.
- Current loadout matters:
  - worn armor
  - ready shield
  - active primary weapon
  - active secondary weapon
  - active missile weapon
- Combat read models should expose exact values where the repository already has enough information, and clearly mark interim values where deeper rules are not yet encoded.

## Core Combat Outputs

The core combat outputs currently recognized by the project are:

| Output       | Meaning                                                             | Current status                                                                                       |
| ------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `OB`         | Offensive bonus / attack-side modifier for a chosen attack mode     | Exact at template-mode level; full character-total OB still interim in loadout panel                 |
| `DMB`        | Damage modifier / damage-side modifier for a chosen attack mode     | Exact when numeric, structured when formula-based                                                    |
| `DB`         | Defensive bonus, primarily dodge/shield-side defensive contribution | Exact only for currently available shield contribution in loadout panel                              |
| `DM`         | Defensive modifier / weapon or shield defensive contribution        | Exact when taken directly from imported template defensive values                                    |
| `Parry`      | Parry-capable defense value for a weapon/mode setup                 | Exact only when directly present on the weapon template; full skill-driven parry remains future work |
| `Initiative` | Initiative contribution of a weapon/mode setup                      | Exact when present on imported weapon templates                                                      |

Current project direction from existing rules-engine code:

- `calculateBaseOB` currently follows:
  - `OB = skill + weaponBonus + situationalModifier`
- `calculateDB` currently follows:
  - `DB = dex + shieldBonus + situationalModifier`
- `calculateParryValue` currently follows:
  - `Parry = allocatedOb + parryModifier`

These formulas exist in the rules-engine and define the project’s direction, even when the persisted equipment/loadout panel does not yet have all required character-stat inputs.

## Weapon Attack Modes

Weapon templates may define `attackModes[]`.

Each attack mode may carry:

- `id`
- `label`
- `damageClass`
- `ob`
- `obRaw`
- `dmb`
- `dmbRaw`
- `dmbFormula`
- `crit`
- `armorModifier`
- `provenance`
- `notes`

Current intended usage:

- `attackModes[]` is the primary source for combat-mode derivation.
- Legacy compatibility fields such as `ob1`, `dmb1`, `ob2`, `dmb2`, `primaryAttackType`, and `secondaryAttackType` may remain for compatibility, but `attackModes[]` is the better source for future derivation.

### Damage Classes

Current weapon damage classes are:

- `blunt`
- `edged`
- `pointed`

Current policy:

- Damage class should come from imported / enriched attack-mode data.
- If a weapon has multiple modes, each mode may have a different damage class.
- The combat-state layer should present mode label and damage class together when useful.

## Offensive Calculation

### OB Structure And Components

### Combat Skill XP Input

- Combat calculations use total skill XP only.
- The canonical combat skill XP value is `effectiveSkillNumber`.
- `effectiveSkillNumber` is the workbook-equivalent skill input because it combines:
  - best contributing skill-group XP
  - direct skill XP
- Combat math must not use only `specificSkillLevel`, only group level, or other partial skill fragments.
- `totalSkill` remains useful for read-only character-sheet display because it adds linked-stat average, but it is not the canonical workbook combat-XP input.

Current project direction:

- Full future offensive derivation should be mode-specific.
- The intended structure is:
  - selected weapon or unarmed mode
  - selected attack mode
  - character skill / stat inputs
  - weapon bonus or situational modifiers

Current exact pieces available in the persisted loadout combat panel:

- template-mode `OB` from imported `attackModes[].ob`
- mode label
- damage class
- crit
- armor modifier
- initiative

Current interim pieces in the persisted loadout combat panel:

- skill-based OB contribution
- stat-based OB contribution
- profession / specialization / situational OB layering
- final in-play attack total

Implementation rule:

- If the panel only has equipment/loadout state and templates, it should show exact template-mode `OB` values and avoid fabricating full character attack totals.

## Damage Calculation

### DMB

Current design:

- `DMB` is mode-specific.
- `DMB` may be:
  - exact numeric
  - structured formula
  - special / variable text
  - unresolved source text

### Numeric DMB

When imported DMB is directly numeric:

- preserve the numeric value in `attackModes[].dmb`
- preserve the original source text in `attackModes[].dmbRaw`

### Formula DMB

When imported DMB is not directly numeric:

- preserve the source text in `dmbRaw`
- normalize into `dmbFormula` when safe

Current normalized DMB forms include:

- `numeric`
- `dice`
- `special`
- `unresolved`

Examples:

| Source        | Normalized handling       |
| ------------- | ------------------------- |
| `2d6`         | `dice`                    |
| `3d10-2`      | `dice` with flat modifier |
| `2d6 + GMstr` | `dice` with text modifier |
| `Var`         | `special`                 |
| `4d6/2d10*`   | `unresolved`              |

Policy:

- Use structured DMB formulas in read models instead of discarding them.
- Do not force formula DMB into fake numeric approximations.
- If a formula still requires rules inputs not yet encoded, present it as a formula/interim value.

## Defensive System

### DB

Current design direction:

- `DB` is the dodge / shield-side defensive side of the system.
- Existing rules-engine direction is:
  - `DB = dex + shieldBonus + situationalModifier`

Current exact values available in the persisted loadout combat panel:

- ready shield bonus when a shield is present and the current grip supports shield use

Current interim values:

- dexterity contribution
- full dodge calculation
- all non-shield situational contributions
- final stacked DB total

### DM

Current design:

- `DM` is the defensive contribution directly provided by weapon/shield template data.
- In current weapon data this is represented by `defensiveValue`.

Current exact values:

- imported weapon template `defensiveValue`
- imported shield template `defensiveValue`

Current interim values:

- final combined defensive stack across shield, weapon, skill, and posture

### Parry

Current design direction:

- Parry is a separate defensive output from DB.
- Existing rules-engine direction is:
  - `Parry = allocatedOb + parryModifier`

Current exact values available in weapon/loadout derivation:

- imported weapon template `parry` when directly present

Current interim values:

- allocation-based parry from current character skill state
- shield-vs-weapon parry selection logic in the loadout combat panel
- final in-play parry totals

## Hand-Use / Grip Model

Current persisted loadout semantics provide:

- one worn armor item
- one ready shield item
- one active primary weapon
- one active secondary weapon
- one active missile weapon

Current grip / hand-use states recognized by derivation:

- `Unarmed`
- `Shield-ready, otherwise unarmed`
- `Missile ready`
- `One-handed`
- `One-handed + shield`
- `Two-handed primary`
- `Dual-wield / paired weapons ready`

Conservative derivation rules:

- A two-handed or polearm primary weapon should be treated as a two-handed setup.
- A shield can only contribute as ready defense when the current weapon use allows it.
- A primary plus secondary weapon with no ready shield is treated as dual-wield / paired.
- Missile-ready state is separate from melee hand-use.

Swap behavior and readiness policy:

- Loadout selections define what is considered actively ready.
- Other with-you items may still exist in inventory, but they are not the current fighting setup unless selected into the active loadout.

## Unarmed / Brawling

Current policy:

- Unarmed / brawling must always have a visible home in the combat model.
- The repository should not pretend the full unarmed rules are complete when they are not.

Current exact status:

- Unarmed remains a fallback fighting state.
- If a ready shield exists, exact shield defensive values may still apply to the unarmed fallback summary.

Current interim status:

- strike / grapple mode list
- unarmed OB
- unarmed DMB
- unarmed crit mapping
- full brawling defensive behavior

## Armor System

Current armor templates provide general values such as:

- `armorRating`
- `mobilityPenalty`
- base encumbrance

Current exact armor behavior:

- worn armor item is part of current loadout state
- armor rating is exact at the general-item level
- mobility penalty is exact at the general-item level

Current interim armor behavior:

- body-location coverage
- location-specific armor values
- location-specific crit modifiers
- detailed armor type mapping by body region

Policy:

- The UI may show a location table structure now, but it must clearly label non-general rows as interim until location-based armor derivation exists.

## Encumbrance System

Encumbrance is currently a real derived input, not just flavor text.

### Core Rules

- Encumbrance is quantity-aware.
- Item effective encumbrance is derived from:
  - base encumbrance
  - quantity
  - material factor
  - quality factor
  - carry factor

Current domain direction from existing code:

- `backpack` applies a reduced carry factor
- `mount` and `stored` do not count toward current personal carried load in the same way

### Availability Classes

Locations are divided into:

- `with_you`
- `elsewhere`

Current policy:

- `with_you` means the item is physically present with the character
- `elsewhere` means the item is not part of the immediate combat state

### Carry Modes

Current carry modes include:

- `equipped`
- `on_person`
- `backpack`
- `mount`
- `stored`

Current interpretation:

- `equipped` and `on_person` are the most combat-relevant current carried state
- `backpack` still counts toward personal carried load, but is slower to access
- `mount` contributes to mount load rather than immediate personal fighting state
- `stored` is not combat-ready

### Normalized Encumbrance Formulas

Weapon encumbrance may also have structured normalized forms:

- `numeric`
- `ammo_linked`
- `special`
- `unresolved`

Policy:

- preserve source truth
- use structured encumbrance notes when present
- do not invent a single “true” numeric value when the source is still conditional or ammo-linked

## Movement And Perception

Current exact pieces:

- armor mobility penalty when present on worn armor
- current personal encumbrance total
- current mount load
- current with-you/backpack state

Current interim pieces:

- full movement formula from encumbrance
- full movement modifier stacking
- full perception penalty formula
- action-skill penalties tied to carried state

Policy:

- movement and perception summaries should use the exact carried-state inputs now available
- they should remain explicit that final movement/perception penalties are still incomplete unless the formula is actually encoded

## Initiative

Current design:

- Initiative is treated as a mode/template-facing combat output.
- Weapon initiative values come directly from imported weapon data when present.

Current exact pieces:

- imported weapon initiative

Current interim pieces:

- stat-based initiative
- broader posture/readiness initiative stacking
- full action-order system

## Exact Vs Interim Policy

The combat system should always distinguish between:

- exact
  - directly imported, normalized, or safely derived from current repository state
- interim
  - plausible future rules direction, but not yet fully encoded

### Exact Today

- current loadout selections
- imported weapon attack modes
- mode labels after manual enrichment
- damage class
- mode-level OB from template data
- numeric DMB
- structured formula DMB presentation
- crit
- armor modifier
- initiative from template
- parry when directly present on the template
- shield bonus and shield defensive value
- armor rating and mobility penalty at the general armor-item level
- quantity-aware encumbrance totals
- with_you vs elsewhere availability semantics

### Interim Today

- final character-total attack values
- full DB formula in the loadout panel
- full DM / DB / Parry stacking
- full unarmed system
- location-based armor
- final movement/perception penalties
- full initiative stack

## Implementation Guidance

Current preferred layering is:

1. import
2. enrichment
3. normalization
4. derivation

### Import

- Preserve workbook/source truth.
- Do not over-interpret formula or ambiguous text in the importer.

### Enrichment

- Apply explicit manual overrides only where source structure is known to be incomplete.
- Example: missing attack labels for certain weapon modes.

### Normalization

- Structure non-numeric but meaningful source values.
- Preserve raw source values and provenance.
- Do not collapse variable or ambiguous text into fake numbers.

### Derivation

- Build current-state combat read models from:
  - persisted equipment state
  - active loadout
  - canonical weapon templates
- Prefer structured fields like `attackModes[]`, `dmbFormula`, and normalized encumbrance notes.
- Keep derivation reusable and separate from UI rendering.

## Next Steps

- Add live character combat inputs to the persisted loadout combat read model:
  - relevant skill totals
  - dexterity and other stat contributions
  - parry allocation decisions
- Formalize DB / DM / Parry stacking order.
- Add explicit unarmed / brawling mode definitions.
- Add location-based armor coverage and protection derivation.
- Add explicit movement and perception formulas once source-backed rules are available.
- Keep the ambiguity log updated when a combat rule is intentionally deferred rather than guessed.

## Data sources for derivation

Combat derivation consumes:

- Character:
  - characteristics (Dex, Str, etc.)
  - skill totals
- Equipment (from persisted state):
  - CharacterEquipmentItem
  - CharacterLoadout
  - CharacterStorageLocation
- Weapon templates:
  - attackModes[]
  - dmb / dmbFormula
  - armor modifiers
  - defensive values
- Derived equipment state:
  - with_you vs elsewhere
  - current use (grip)
  - encumbrance summary

These map to:

- combatStateDerivation.ts (current read-model)
- future rules-engine functions for full calculation
