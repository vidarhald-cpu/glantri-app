# Character Sheet Calculation Inventory

Date: 2026-05-02

Status: read-only audit. No app behavior or canonical content was changed.

## A. Scope And Files Inspected

This inventory starts with the Character Detail / Character Sheet page and includes the adjacent character loadout/combat surfaces because they are part of the current Character section and expose many calculation-heavy values.

Primary UI files inspected:

| Area | File |
| --- | --- |
| Character Detail / Character Sheet | `apps/web/app/(app)/characters/[id]/CharacterDetail.tsx` |
| Character sheet route alias | `apps/web/app/(app)/characters/[id]/sheet/CharacterSheet.tsx` |
| Character sheet row helpers | `apps/web/src/lib/characters/characterSheet.ts` |
| Character edit persistence helpers | `apps/web/src/lib/characters/characterEdit.ts` |
| Character loadout page | `apps/web/app/(app)/characters/[id]/loadout/page.tsx` |
| Loadout module/read model | `apps/web/src/features/equipment/loadoutModule.tsx` |
| Combat state panel model | `apps/web/src/features/equipment/combatStatePanel.ts` |
| Combat state panel UI | `apps/web/src/features/equipment/components/CombatStatePanel.tsx` |

Primary derivation/rules files inspected:

| Area | File |
| --- | --- |
| Character sheet summary | `packages/rules-engine/src/sheets/buildCharacterSheetSummary.ts` |
| Chargen draft and skill rows | `packages/rules-engine/src/chargen/primaryAllocation.ts` |
| Stat resolution | `packages/rules-engine/src/chargen/statResolution.ts` |
| Characteristic GMs | `packages/rules-engine/src/stats/characteristicGms.ts` |
| Adjusted stats | `packages/rules-engine/src/stats/calculateAdjustedStats.ts` |
| Skill group levels | `packages/rules-engine/src/skills/calculateGroupLevel.ts` |
| Skill levels | `packages/rules-engine/src/skills/calculateSkillLevel.ts` |
| Specialization levels | `packages/rules-engine/src/skills/calculateSpecializationLevel.ts` |
| Best group contribution | `packages/rules-engine/src/skills/selectBestSkillGroupContribution.ts` |
| Derived relationship grants | `packages/rules-engine/src/skills/deriveSkillRelationships.ts` |
| Education | `packages/rules-engine/src/education/calculateEducation.ts` |
| Legacy sheet equipment summary | `packages/rules-engine/src/equipment/manageCharacterEquipment.ts` |
| Workbook combat math | `packages/rules-engine/src/combat/workbookCombatMath.ts` |
| Equipment selectors | `apps/web/src/features/equipment/equipmentSelectors.ts` |
| Armor summary | `apps/web/src/features/equipment/armorSummary.ts` |
| Movement summary | `apps/web/src/features/equipment/movementSummary.ts` |
| Combat state derivation | `apps/web/src/features/equipment/combatStateDerivation.ts` |

## B. Character Sheet Displayed Values Inventory

### Character Identity And Source Fields

| UI label/value | Where it appears | Source component/file | Calculation/source file | Stored or derived | Formula or source | Rounding/clamping | Documentation status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Character Sheet title | Page header | `CharacterDetail.tsx` | local `getCharacterName` helper | Derived display | `build.name.trim()` or unnamed placeholder | Trim only | Missing |
| Character name | Summary input | `CharacterDetail.tsx` | `characterEdit.ts` setters | Stored | `build.name` | None | Missing |
| Title | Summary input | `CharacterDetail.tsx` | `characterEdit.ts` setters | Stored | `build.profile.title ?? ""` | None | Missing |
| Age | Summary input | `CharacterDetail.tsx` | `characterEdit.ts` setters | Stored | `build.profile.age ?? ""` | None | Missing |
| Gender | Summary select | `CharacterDetail.tsx` | `characterEdit.ts` setters | Stored | `build.profile.gender ?? ""` | UI enum only | Missing |
| Society | Summary | `CharacterDetail.tsx` | `buildCharacterSheetSummary.ts` | Derived from stored IDs | Finds `societyLevels` row matching `build.societyId` and `build.societyLevel` | None | Missing |
| Social class | Summary | `CharacterDetail.tsx` | build data | Stored | `build.socialClass ?? build.profile.socialClassResult ?? "Not set"` | None | Missing |
| Social class roll | Summary, parenthetical | `CharacterDetail.tsx` | build data | Stored | Appends `build.profile.socialClassRoll` when present | None | Missing |
| Profession | Summary | `CharacterDetail.tsx` | `buildCharacterSheetSummary.ts` | Derived label from stored ID | Finds `content.professions` by `build.professionId`; falls back to profession ID | None | Missing |
| Profession family | Summary | `CharacterDetail.tsx` | local `getProfessionFamilyName` | Derived label | Finds profession family from content | None | Missing |
| Chargen rules | Summary | `CharacterDetail.tsx` | local `getChargenRuleSetName` | Stored snapshot or fallback | `build.chargenRuleSet?.name ?? "Legacy default"` | None | Missing |
| Notes | Notes textarea | `CharacterDetail.tsx` | `characterEdit.ts` setters | Stored | `build.profile.notes ?? ""` | None | Missing |

### Stats And Characteristics

| UI label/value | Where it appears | Source component/file | Calculation/source file | Stored or derived | Formula or source | Rounding/clamping | Documentation status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stat label | Profile Stats table | `CharacterDetail.tsx` | `@glantri/domain` labels/order | Static content | Uses `glantriCharacteristicOrder` and `glantriCharacteristicLabels` | None | Missing |
| Original | Profile Stats table | `CharacterDetail.tsx` | build data | Stored | `build.profile.rolledStats[stat]` | None | Missing |
| Current | Profile Stats table | `CharacterDetail.tsx` | `buildCharacterSheetSummary.ts`, `calculateAdjustedStats.ts` | Derived | Resolved stats plus stat modifiers; fallback to original if missing | Additive modifiers only | Missing |
| GM | Profile Stats table | `CharacterDetail.tsx` | `characteristicGms.ts` | Derived | `Math.trunc((currentValue - 11) / 2)` | Truncates toward zero | Partly implicit in tests, not user-facing |
| Distraction Original/Current | Profile Stats table | `CharacterDetail.tsx` | build data | Stored | `sheetSummary.distractionLevel` from `build.profile.distractionLevel` | None | Missing |
| Distraction GM | Profile Stats table | `CharacterDetail.tsx` | UI constant | Display-only | Always `-` | None | Missing |

Related stat derivations not directly displayed as separate formulas:

| Derived value | Source file | Formula |
| --- | --- | --- |
| Resolved CHA | `statResolution.ts` | `cha + getGlantriStatModifier(com)` |
| Resolved DEX | `statResolution.ts` | `dex + getDexteritySizeModifier(siz)` |
| Resolved HEALTH | `statResolution.ts` | `health + getGlantriStatModifier(con)` |
| Resolved STR | `statResolution.ts` | `str + getGlantriStatModifier(siz)` |
| Size-based DEX modifier | `characteristicGms.ts` | If `siz > 14`, `-(sizeGm - 1)`; if `siz > 9`, `0`; otherwise `-sizeGm` |
| Glantri stat modifier table | `characteristicGms.ts` | Lookup table for values 1-25, not the same as the displayed GM formula |

### Summary Values

| UI label/value | Where it appears | Source component/file | Calculation/source file | Stored or derived | Formula or source | Rounding/clamping | Documentation status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skill points spent | Summary | `CharacterDetail.tsx` | `primaryAllocation.ts` | Derived | `draftView.totalSkillPointsInvested` | None | Missing |
| Skill points remaining | Summary | `CharacterDetail.tsx` | `primaryAllocation.ts` | Derived | `draftView.primaryPoolAvailable + draftView.secondaryPoolAvailable` | Each pool clamps to `Math.max(0, total - spent)` | Missing |
| Skill group name | Summary | `CharacterDetail.tsx` | `buildCharacterSheetSummary.ts` | Derived from progression/content | Current groups where `groupLevel > 0` | None | Missing |
| Skill group level | Summary | `CharacterDetail.tsx` | `calculateGroupLevel.ts` | Derived | `ranks + gms` | None | Missing |
| Education | Summary | `CharacterDetail.tsx` | `calculateEducation.ts` | Derived | `baseEducation + socialClassEducationValue + count(theoretical skills with ranks > 0)` | Count is integer | Missing and ambiguous label |

### Skills Table

| UI label/value | Where it appears | Source component/file | Calculation/source file | Stored or derived | Formula or source | Rounding/clamping | Documentation status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skill category heading | Skills section | `CharacterDetail.tsx` | `characterSheet.ts`, `chargenBrowse` | Derived | `getPlayerFacingSkillBucket(skill)` then grouped by bucket | None | Missing |
| Skill count | Category heading | `CharacterDetail.tsx` | `characterSheet.ts` | Derived | Number of visible rows in bucket | None | Missing |
| Skill | Skills table | `CharacterDetail.tsx` | `characterSheet.ts` | Derived label | Skill name; language rows display `Skill (Language)` | None | Missing |
| Derived source label | Under skill name | `CharacterDetail.tsx` | `derivedSkillLabels`, `deriveSkillRelationships.ts` | Derived | Cross-training, specialization bridge, or explicit grant source label when relationship grant exists | None | Missing |
| Stats | Skills table | `CharacterDetail.tsx` | `characterSheet.ts` | Static content | Unique linked stats uppercased and joined with `/` | None | Missing |
| Avg stats | Skills table | `CharacterDetail.tsx` | `primaryAllocation.ts`, fallback in `characterSheet.ts` | Derived | Linked stat average from draft view; fallback is floor average of `build.profile.rolledStats` | `Math.floor(total / count)` in fallback | Missing and may need adjusted-stat clarification |
| Skill group XP | Skills table | `CharacterDetail.tsx` | `selectBestSkillGroupContribution.ts` | Derived | Best active contributing group level for the skill; fallback to row group level | Ties sorted by higher level, lower sortOrder, name, then ID | Missing |
| Owned XP | Skills table | `CharacterDetail.tsx` | `primaryAllocation.ts` | Derived from progression | `grantedRanks + primaryRanks + secondaryRanks` as `specificSkillLevel` | None | Missing |
| Derived XP | Not currently a visible column on Character Detail | `characterSheet.ts` stores `grantedXp` | `deriveSkillRelationships.ts` | Derived | Relationship grant ranks are included in Total XP and exposed only by source label | Uses floors in relationship calculations | Missing; UI/docs mismatch |
| Total XP | Skills table | `CharacterDetail.tsx` | `primaryAllocation.ts` | Derived | `effectiveSkillNumber`; fallback is `skillGroupXp + ownedXp + derivedXp` | Relationship grants use floors | Missing |
| Total skill level | Skills table | `CharacterDetail.tsx` | `primaryAllocation.ts` | Derived | `linkedStatAverage + effectiveSkillNumber` | Linked stat average rounded/floored upstream | Missing |

Skill rows are omitted when `totalXp <= 0`. Specialization-only skill definitions are skipped from the main skills table.

### Skill XP Columns

| Column | Meaning in current code | Important formula | Edge cases |
| --- | --- | --- | --- |
| Skill group XP | Best contributing group level, not a sum of all groups | `selectBestSkillGroupContribution(activeGroups)?.groupLevel ?? 0` | A skill may belong to multiple active groups, but only the best one is shown and counted |
| Owned XP | Direct/specific skill ranks on the character row | `grantedRanks + primaryRanks + secondaryRanks` | Language rows are keyed by language name |
| Derived XP / Derived preview | Relationship minimum grant from cross-training, specialization bridge, or explicit grant | Stored in row helpers as `grantedXp`, folded into Total XP | No separate Character Detail column, despite previous UI terminology elsewhere |
| Total XP | Workbook-equivalent skill XP before stat average | `groupContribution + ownedXp + relationshipGrantedXp` | This is the value combat math should consume for skill XP |
| Total skill level | Stat average plus total XP | `linkedStatAverage + effectiveSkillNumber` | Depends on which stat block feeds linked stat average |

### Specializations

| UI label/value | Where it appears | Source component/file | Calculation/source file | Stored or derived | Formula or source | Rounding/clamping | Documentation status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Specialization | Specializations section | `CharacterDetail.tsx` | `characterSheet.ts` | Derived label | Finds specialization definition by ID | None | Missing |
| Derived source label | Under specialization name | `CharacterDetail.tsx` | `derivedSkillLabels`, `deriveSkillRelationships.ts` | Derived | Usually specialization bridge parent label | None | Missing |
| Parent skill | Specializations table | `CharacterDetail.tsx` | `primaryAllocation.ts` | Derived label | `specializationView.parentSkillName` | None | Missing |
| Owned XP | Specializations table | `CharacterDetail.tsx` | `primaryAllocation.ts` | Stored-derived | `specializationView.secondaryRanks` | None | Missing |
| Derived XP | Not currently a visible column | `characterSheet.ts` stores `grantedXp` | `deriveSkillRelationships.ts` | Derived | `relationshipGrantedSpecializationLevel` | Uses floors and thresholds | Missing; hidden from table |
| Total | Specializations table | `CharacterDetail.tsx` | `calculateSpecializationLevel.ts` | Derived | `floor(parentGroupLevel / 2) + ownedSpecializationXp + relationshipGrant` | `Math.floor(groupLevel / 2)` | Missing |

### Legacy Sheet Combat Summary

`buildCharacterSheetSummary.ts` returns a `combat` object, but the current Character Detail page does not render it directly. The adjacent loadout page uses a newer combat-state model.

| Value | Source file | Stored or derived | Formula |
| --- | --- | --- | --- |
| Sheet dodge | `buildCharacterSheetSummary.ts`, `manageCharacterEquipment.ts` | Derived | `calculateDB({ dex: adjustedStats.dex, shieldBonus })` |
| Sheet parry | `buildCharacterSheetSummary.ts`, `manageCharacterEquipment.ts` | Derived | Max `parryValue` across equipped weapons |
| Has shield | `manageCharacterEquipment.ts` | Derived | Any equipped shield item |
| Weapon base OB | `manageCharacterEquipment.ts` | Derived | `skillTotal + weaponBonus + situationalModifier?` |
| Weapon parry | `manageCharacterEquipment.ts` | Derived | `allocatedOb + parryModifier?` |

This legacy summary appears simpler than the workbook combat panel and should be documented as either historical, hidden, or internal if it remains unused on the visible sheet.

### Character Loadout And Combat Panel

The following values are visible in the Character section loadout page, not in the main Character Detail page.

| UI label/value | Where it appears | Source component/file | Calculation/source file | Stored or derived | Formula or source | Rounding/clamping | Documentation status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primary weapon | Loadout controls | `loadoutModule.tsx` | equipment state | Stored loadout selection | Selected item/template | Validated against item category/slot | Missing |
| Shield | Loadout controls | `loadoutModule.tsx` | equipment state | Stored loadout selection | Selected shield item/template | Mutually exclusive with second hand weapon in UI flow | Missing |
| Armor | Loadout controls | `loadoutModule.tsx` | equipment state | Stored loadout selection | Selected armor item/template | None | Missing |
| Second hand weapon | Loadout controls | `loadoutModule.tsx` | equipment state | Stored loadout selection | Selected off-hand item/template | Clears incompatible shield/two-handed choices | Missing |
| Missile weapon | Loadout controls | `loadoutModule.tsx` | equipment state | Stored loadout selection | Selected ranged item/template | None | Missing |
| Throwing weapon | Loadout controls | `loadoutModule.tsx` | equipment state | Stored loadout selection | Selected throwing item/template | None | Missing |
| Hitpoints | Combat stats and skills | `loadoutModule.tsx` | build data | Stored | `build.profile.rolledStats.health` | None | Missing and possibly should clarify rolled vs current |
| GMR | Combat stats and skills | `loadoutModule.tsx` | `buildCharacterSheetSummary.ts` adjusted stats | Derived | `adjustedStats.pow + adjustedStats.lck - 3` | None | Missing |
| Encumbrance capacity | Defence and movement | `combatStateDerivation.ts`, `movementSummary.ts` | `workbookCombatMath.ts` | Derived | `round(str + siz + 0.5 * con)` | `Math.round` | Missing |
| Enc/count/lvl | Defence and movement | `combatStateDerivation.ts`, `movementSummary.ts` | `workbookCombatMath.ts` | Derived | Total personal encumbrance, percent, and threshold-derived encumbrance level | Percent rounded; level counts exceeded thresholds | Missing |
| Mov/mod | Defence and movement | `combatStateDerivation.ts`, `movementSummary.ts` | `workbookCombatMath.ts` | Derived | Base move minus workbook movement adjustment; modifier is `round(encumbranceLevel / 2 + shieldMoveModifier)` | `Math.round` | Missing |
| Armor | Armor panel | `armorSummary.ts` | equipment template | Derived label | Armor template name/display | None | Missing |
| General armor | Armor panel | `armorSummary.ts` | equipment template | Derived | `template.generalArmorRounded ?? round(template.armorRating)` plus type | `Math.round` fallback | Missing |
| AA modifier | Armor panel | `armorSummary.ts` | equipment template | Stored template value | `template.armorActivityModifier` | None | Missing |
| Perception modifier | Armor panel | `armorSummary.ts` | equipment template | Stored template value | `template.perceptionModifier` | None | Missing |
| Armor coverage locations | Armor coverage table | `armorSummary.ts` | equipment template | Stored-derived | Location values and armor type from template | None | Missing |
| Weapon mode | Weapons table | `combatStateDerivation.ts` | equipment template | Derived | Primary, shield, secondary, missile, throwing, brawling, punch, kick, combined defense | None | Missing |
| Weapon name | Weapons table | `combatStateDerivation.ts` | equipment state/template | Derived | Selected item/template or built-in unarmed label | None | Missing |
| I / Initiative | Weapons table | `combatStateDerivation.ts` | `workbookCombatMath.ts` | Derived | Melee uses workbook melee initiative; missile/thrown uses `weaponInitiative + dexterityGm` | Skill initiative lookup uses bands | Missing |
| Attack labels | Weapons table | `combatStateDerivation.ts` | equipment template/modes | Derived | Attack mode labels from template | None | Missing |
| OB | Weapons table | `combatStateDerivation.ts` | `workbookCombatMath.ts` | Derived | Melee: workbook melee OB; projectile: workbook projectile OB; fallback: `skillXp + weaponBonus + modifier` | Uses `Math.round(skillXp / 2)` and percentage adjustment table | Missing |
| DMB | Weapons table | `combatStateDerivation.ts` | `workbookCombatMath.ts` | Derived | Melee: workbook melee DMB; thrown: `strengthGm + weaponDmb`; otherwise template value | Workbook melee DMB uses reference weapon OB adjustment | Missing |
| Crit | Weapons table | `combatStateDerivation.ts` | equipment template/modes | Stored template value | Critical value from attack mode | None | Missing |
| Sec | Weapons table | `combatStateDerivation.ts` | equipment template/modes | Stored template value | Secondary/seconds value from attack mode | None | Missing |
| AM | Weapons table | `combatStateDerivation.ts` | equipment template/modes | Stored template value | Attack modifier/ammo mode value from attack mode | None | Missing |
| DB | Weapons/defense table | `combatStateDerivation.ts` | `workbookCombatMath.ts` | Derived | Base DB plus equipment/to-hit modifier percentage adjustment | Base DB is `round(dodgeXp / 2) + 4 + dexterityGm` | Missing |
| DM | Weapons/defense table | `combatStateDerivation.ts` | `workbookCombatMath.ts` | Derived | Difference between full adjusted DB and no-to-hit adjusted DB | Uses same workbook adjustment table | Missing |
| Parry | Weapons/defense table | `combatStateDerivation.ts` | `workbookCombatMath.ts` | Derived | `round(parryXp / 2) + 1 + dexterityGm`, adjusted by armor and weapon parry modifier | Uses percentage adjustment table | Missing |
| Encumbrance-dependent skill name | Encumbrance dependent skills | `loadoutModule.tsx` | content/read model | Derived | Skills classified as combat, covert/physical, or athletics by group IDs/names | None | Missing |
| Encumbrance-dependent initiative | Encumbrance dependent skills | `loadoutModule.tsx` | `workbookCombatMath.ts` | Derived | `dexterityGm + lookupWorkbookSkillInitiativeModifier(effectiveSkillNumber)` | Skill initiative modifier null outside known range | Missing |
| Encumbrance-dependent stat average | Encumbrance dependent skills | `loadoutModule.tsx` | local helper | Derived | Rounded average of adjusted linked stats | Uses rounded average | Missing |
| Encumbrance-dependent XP | Encumbrance dependent skills | `loadoutModule.tsx` | `primaryAllocation.ts` | Derived | `effectiveSkillNumber` | None | Missing |
| Encumbrance-dependent skill level | Encumbrance dependent skills | `loadoutModule.tsx` | local helpers | Derived | Usually rounded linked stat average plus XP; Perception uses armor-adjusted perception formula | Rounding differs by helper | Missing |
| Encumbered | Encumbrance dependent skills | `loadoutModule.tsx` | workbook composite adjustment helper | Derived | Base total minus movement-modifier adjustment | Uses workbook lookup | Missing |

### Equipment And Encumbrance Inputs

| Value | Source file | Formula/source | Edge cases |
| --- | --- | --- | --- |
| Personal inventory encumbrance | `equipmentSelectors.ts` | Sum effective encumbrance for carried personal-load items | Items outside carried personal location return null/zero |
| Actual item encumbrance | `equipmentSelectors.ts` | Armor uses workbook armor formula if possible; otherwise `baseEncumbrance * quantity * materialFactor * qualityFactor` | Armor fallback differs from workbook armor path |
| Armor encumbrance | `armorSummary.ts` | `encumbranceFactor * quantity * characterSize` | Null if size or factor missing |
| Mount encumbrance | `equipmentSelectors.ts` | Sum base encumbrance of mount-carried items | Quantity/material/quality appear not to be applied |
| Coin count | `equipmentSelectors.ts` | Sum encounter-accessible coin quantities | Requires subtype `coins` |

## C. Calculation Dependency Map

Character Detail page:

```text
CharacterDetail.tsx
  -> loadLocalCharacterContext / characterEdit helpers
  -> buildCharacterSheetSummary(build, content)
    -> getResolvedProfileStats(profile)
    -> calculateAdjustedStats(resolvedStats, statModifiers)
    -> buildChargenDraftView(content, profile, progression, profession, society)
      -> recalculate progression rows
      -> calculateGroupLevel(ranks + gms)
      -> selectBestSkillGroupContribution(...)
      -> resolveRelationshipMinimumGrants(...)
      -> calculateEducation(...)
    -> buildCharacterEquipmentLoadoutSummary(...)
  -> buildCharacterSheetSkillRows(build, content, sheetSummary)
  -> buildCharacterSheetSpecializationRows(content, sheetSummary)
```

Stat dependency chain:

```text
rolledStats
  -> resolvedStats from chargen stat-resolution formulas
  -> adjustedStats from additive stat modifiers
  -> Profile Stats "Current"
  -> Profile Stats "GM" using Math.trunc((value - 11) / 2)
```

Skill dependency chain:

```text
progression.skillGroups + progression.skills + progression.specializations
  -> draftView.groups
  -> draftView.skills
    -> best active group contribution
    -> owned/specific ranks
    -> relationship granted ranks
    -> effectiveSkillNumber
    -> linkedStatAverage
    -> totalSkill
  -> Character Sheet skill rows
```

Derived relationship grant chain:

```text
non-relationship base XP
  -> explicit derived grants, melee cross-training, specialization bridges
  -> best minimum grant wins by XP/factor/source priority/name/id
  -> relationshipGrantedRanks
  -> effectiveSkillNumber / effectiveSpecializationNumber
```

Specialization dependency chain:

```text
parent skill active group contribution
  -> floor(parentGroupLevel / 2)
  -> plus owned specialization XP
  -> plus relationship granted specialization XP
  -> specialization total
```

Loadout/combat dependency chain:

```text
Character loadout state + equipment inventory + CharacterSheetSummary
  -> buildCombatStateCharacterInputs(...)
    -> adjusted stats
    -> workbook stat GMs
    -> effectiveSkillNumber for combat skills
  -> deriveCombatStateSnapshot(...)
    -> personal encumbrance
    -> movement summary
    -> armor summary
    -> weapon rows
    -> DB/DM/parry rows
  -> CombatStatePanel
```

## D. Missing Or Ambiguous Formulas

1. Character Detail does not display a separate Derived XP column even though row helpers calculate `grantedXp`. Derived relationship XP is folded into Total XP and only hinted by a source label.

2. Specializations also calculate/store relationship granted XP, but the visible table only shows Owned XP and Total.

3. The skill table's `Avg stats` fallback uses `build.profile.rolledStats`, while the loadout encumbrance-dependent skill table uses adjusted stats. The intended stat source for final sheet skills needs a rules decision.

4. There are two combat/equipment derivation families: a simple `buildCharacterEquipmentLoadoutSummary` object returned by `buildCharacterSheetSummary`, and the richer workbook combat state under `apps/web/src/features/equipment`. The manual should clarify which one is authoritative for visible combat values.

5. Education is displayed as a single number, but `calculateEducation.ts` returns it as `baseEducation + socialClassEducationValue + theoretical skill count`. The field name `theoreticalSkillCount` is misleading for documentation.

6. Hitpoints on the loadout combat panel use `build.profile.rolledStats.health`, not adjusted/current health.

7. GMR is displayed as `POW + LCK - 3`, but the source workbook/rules reference is not cited in code.

8. Combined parry can be calculated in combat state derivation, but `getCombinedParrySummary` currently returns `-`, so the summary text does not explain the calculated combined row.

9. Perception has an armor-adjusted workbook formula in the loadout panel and an interim note that encumbrance-specific perception remains unresolved.

10. Mount-carried encumbrance appears to sum item template base encumbrance only, unlike personal inventory encumbrance which applies quantity/material/quality and armor workbook formulas.

11. Remaining skill points are displayed as one combined total, while the underlying pools remain ordinary and flexible. A player-facing manual should explain the split.

12. Skill group XP displays only the best contributing group. This is correct for current mechanics, but could surprise users when a skill belongs to multiple purchased groups.

13. The loadout "Combat stats and skills" title currently contains Hitpoints and GMR, while the larger skill rows live elsewhere. Documentation should avoid implying all combat skills are in that mini-table.

## E. Recommended Documentation Structure

Suggested first manual page: "Character Sheet Calculations".

Recommended sections:

| Section | Contents |
| --- | --- |
| Character identity | Stored fields, chargen rule-set snapshot, society/social class/profession labels |
| Characteristics and GMs | Original/current stats, stat resolution, additive modifiers, displayed GM formula |
| Skill XP | Group XP, owned XP, derived XP, total XP, total skill level, best-group rule |
| Specializations | Parent skill contribution, owned specialization XP, bridge grants, total specialization formula |
| Skill points and education | Spent/remaining pools, ordinary/flexible split, education formula |
| Combat values | Combat skill XP source, OB/DMB/DB/DM/parry/initiative formulas, workbook lookup tables |
| Equipment and encumbrance | Personal load, armor encumbrance, capacity, encumbrance level, movement |
| Known interim calculations | Perception/encumbrance note, legacy equipment summary, combined parry summary gap |

For each calculation page, use a consistent mini-template:

| Field | Documentation content |
| --- | --- |
| UI label | Exact label from the app |
| Source values | Stored fields and content definitions used |
| Formula | Plain English plus pseudocode |
| Rounding | Floor, round, trunc, lookup table, or clamp behavior |
| Example | One small manual calculation |
| Edge cases | Missing data, fallback labels, hidden derived values |

## F. Suggested Next Implementation Pass

1. Create an in-app documentation page for Character Sheet basics: identity, stats, GMs, skill XP, total skill level, specializations, education, and chargen rule set.

2. Add a narrow character-sheet read-model documentation test or snapshot that enumerates displayed columns so future UI changes update the manual inventory.

3. Decide whether Character Detail should expose Derived XP as its own column for skills and specializations, or explicitly document that derived XP is folded into Total XP.

4. Resolve the stat-source question for skill `Avg stats`: rolled/resolved stats on Character Detail versus adjusted stats on loadout skill rows.

5. Document the workbook combat formulas separately from the main sheet, because they are table-heavy and deserve examples for OB, DMB, DB, DM, Parry, Initiative, encumbrance, and movement.

6. Mark or remove unused/legacy combat summary fields from `buildCharacterSheetSummary` if the workbook combat panel is the authoritative visible model.

7. Add workbook source references for GMR, hitpoints, perception adjustment, combined parry, and mount encumbrance before presenting those as fully settled manual rules.
