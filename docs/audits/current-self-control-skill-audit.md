# Current Self-Control Skill Audit

Date: 2026-05-02

This is a read-only design audit of `self_control` after the recent profession and skill-group cleanup passes. No canonical content changes are proposed here as implementation.

## A. Source / Origin

`self_control` is present in the imported source bundle, not newly invented during cleanup.

Source evidence:
- `data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json` defines `self_control` as `Self-Control`.
- The source places it in `mental_discipline`.
- The source description is: govern impulse, fear, pain response, and emotional reaction under pressure.
- The imported `mental_discipline` group contains `concentration`, `memory`, `self_control`, and `meditation`.

Current generated skill definition:

| Field | Current value |
| --- | --- |
| id | `self_control` |
| name | Self-Control |
| category | ordinary |
| player-facing category | mental |
| primary group | `mental_discipline` |
| linked stats | INT / POW |
| dependencies | none |
| current groupIds | `mental_discipline`, `mental_group`, `basic_missile_training`, `advanced_missile_training`, `defensive_soldiering`, `forestry_resource_work`, `mining_extraction` |

Conclusion: `self_control` is a valid imported mental skill, but recent cleanup has used it as a broad support/filler skill outside its natural mental-discipline context.

## B. Current Usages

Current skill groups containing `self_control`:

| Group | Membership | Fixed weighted value | Verdict |
| --- | --- | ---: | --- |
| `mental_discipline` | Concentration, Memory, Self-Control, Meditation | 8 | Good source-native use. |
| `mental_group` | Concentration, Memory, Self-Control, Meditation, Perception | 10 | Acceptable taxonomy/compatibility grouping. |
| `basic_missile_training` | Perception, Self-Control, Weapon Maintenance, plus choose 1 missile weapon | 5 fixed + 1 slot minimum | Needs small cleanup. |
| `advanced_missile_training` | Perception, Self-Control, Weapon Maintenance, Battlefield Awareness, Combat Experience, plus choose 3 missile weapons | 7 fixed + 3 slot minimum | Needs small cleanup. |
| `defensive_soldiering` | Formation Fighting, Battlefield Awareness, Perception, Self-Control, First Aid | 7 | Needs design correction. |
| `forestry_resource_work` | Perception, Search, Climb, Run, Self-Control, Carpentry, First Aid | 13 | Self-Control looks like filler. |
| `mining_extraction` | Perception, Search, Climb, Run, Self-Control, Stoneworking, Mechanics, First Aid | 15 | Self-Control looks like filler. |

Profession/package usage:

| Usage type | Current usage |
| --- | --- |
| Direct profession grant | `hermit` directly grants `self_control`. This is source-like and conceptually plausible. |
| Mental Discipline group grants | `healer`, `hermit`, `philosopher`, `shaman`, `soothsayer`, and `student` receive `mental_discipline`, which naturally includes `self_control`. |
| Indirect via newer groups | Any profession receiving Basic/Advanced Missile Training, Defensive Soldiering, Forestry / Resource Work, or Mining / Extraction now reaches `self_control`. These are the questionable usages. |

## C. Overlap Analysis

`self_control` overlaps with several nearby skills, but it is not a complete duplicate.

| Skill | Current meaning | Relationship to Self-Control |
| --- | --- | --- |
| `concentration` | Sustain attention and mental focus under distraction or pressure. | Better fit for aiming, marksmanship focus, ritual focus, and task attention. |
| `combat_experience` | Stay functional and rational under lethal danger and battlefield shock. | Better fit for military stress and battlefield hardening. |
| `memory` | Retain, recall, and organize learned details or patterns. | Distinct; no replacement role for Self-Control. |
| `meditation` | Disciplined stillness, breath, or contemplation to regulate inner state. | Adjacent but more contemplative and depends on Concentration. |
| `mental_discipline` | Trained inner control and focus. | Natural home for Self-Control. |

Design conclusion:

`self_control` should remain as a valid mental-discipline skill, but it should not be used as generic “hard job discipline” filler. If the learning process is aim/focus, use `concentration`. If the learning process is military stress and battlefield adaptation, use `combat_experience`. If the learning process is forestry/mining labor, prefer practical labor/resource skills or no replacement.

## D. Recommendation

Recommendation: keep `self_control` as a separate canonical skill, but narrow its use.

Classification:

`B. valid separate skill but currently misused`

It should mean emotional regulation, impulse control, fear/pain response, and inner discipline. It is appropriate in:

- `mental_discipline`
- `mental_group`
- hermit/monastic/ascetic/ritual contexts
- possibly some coercive endurance or extreme discipline roles if deliberately modeled

It should not be a default filler skill for:

- missile aiming
- ordinary military support
- forestry labor
- mining labor

## E. Recommended Replacements By Group

| Group | Recommendation | Replacement | Guardrail impact |
| --- | --- | --- | --- |
| `basic_missile_training` | Replace `self_control`. | Use `concentration`. | Fixed value remains 5; with required missile slot minimum remains 6+. Better represents aiming/focus. |
| `advanced_missile_training` | Replace `self_control`. | Use `concentration`. | Fixed value remains 7; slot minimum remains 10+. Better represents advanced range discipline. |
| `defensive_soldiering` | Replace `self_control`. | Use `combat_experience`. | Group value becomes 6, still meets the minimum. Better represents holding under battlefield stress without adding combat fundamentals. |
| `forestry_resource_work` | Remove `self_control`. | No replacement needed. If a replacement is desired later, prefer a practical resource skill, not a mental skill. | Group value drops from 13 to 11, still well above threshold. |
| `mining_extraction` | Remove `self_control`. | No replacement needed. If a replacement is desired later, prefer a practical extraction/safety skill, not a mental skill. | Group value drops from 15 to 13, still well above threshold. |
| `mental_discipline` | Keep. | None. | Source-native use. |
| `mental_group` | Keep for taxonomy/compatibility. | None. | Acceptable broad category grouping. |

## F. Later Implementation Plan

Recommended small implementation pass:

1. In `packages/content/scripts/generateRepoLocalGlantriSeed.mjs`, replace `self_control` with `concentration` in `basic_missile_training` and `advanced_missile_training`.
2. Replace `self_control` with `combat_experience` in `defensive_soldiering`.
3. Remove `self_control` from `forestry_resource_work` and `mining_extraction`.
4. Regenerate `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts`.
5. Update `packages/content/src/validators.test.ts` expectations for those groups and weighted values.
6. Add a focused guardrail test that `self_control` appears only in mental/ritual/hermit-style contexts unless explicitly allowed.
7. Run the usual content, rules-engine, web Chargen, full test, lint, and build checks.

No content-model refactor is needed for this correction. The larger future improvement would be clearer semantic tags for skill-group membership reasons, so a skill can be audited as “mental discipline,” “aim/focus,” “battlefield stress,” or “resource labor” rather than inferred from group membership alone.
