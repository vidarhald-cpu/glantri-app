# Source Mapping

Track how workbook columns and rule text map into app structures.

## Character Profile Model

- Source-of-truth status: partially reconciled from checked-in source files.
- Shared/domain targets updated:
  - `packages/domain/src/character/profiles.ts`
  - `packages/rules-engine/src/chargen/generateProfiles.ts`
  - `packages/rules-engine/src/chargen/summarizeRolledProfile.ts`
  - dependent stat/education/UI consumers

## Source Files Used

- `data/raw/glantri/Themistogenes 1.07.xlsx`
  - `Character sheet entry`
    - rows `A3:A16` for the stat/profile field list shown on the sheet
  - `Game sheet`
    - rows `A14:A16`, `H41:K44` for social class, education, distraction, and distracted-skill presentation
  - `Stats rules`
    - repeated blocks `A1:M14`, `A16:M29`, ... through `A286:M299`
    - used for the actual chargen roll formulas and the count of candidate profiles
  - `stat modifiers`
    - rows `A2:B26` for the GM/modifier lookup table used by `Str`, `Dex`, `Health`, and `Cha`
- `data/raw/glantri/sosial klasse 6ex.pdf`
  - first page, `SCANDIA` section
  - used for the social-class roll ranges and class-specific `Edu` values
- `data/raw/glantri/Skills and Societies.xlsx`
  - `Reference`
    - rows `A2:B8` for linked-stat guidance, averaging rule, theoretical-skill note, and class-roll table reference fields
  - `SocietyLevelAccess`
    - header row `A1:J1` and example row `A2:F2` for `base_education` and `class_roll_table_id`
  - `SkillDefinition`
    - rows `A1:Q67` for actual source stat abbreviations and linked-stat pairs
- `data/raw/glantri/skill-groups_skills_specializations.xlsx`
  - `skills_primary_secondary`
    - rows `A1:N108` for source-backed linked-stat and `is_theoretical` examples
  - `skill_groups`
    - rows `A1:F17` for source-backed group linked stats
- `data/raw/glantri/Skill table & system.xlsx`
  - `CharGen`
    - rows `A8:B17` for chargen point-spend notes
  - `Basic skill system`
    - rows `A21:C27` for the distracted-skill modifier context

## Reconciled Mapping

- Characteristic keys:
  - Source-backed set is `Str`, `Dex`, `Con`, `Health`, `Siz`, `Com`, `Cha`, `Int`, `Pow`, `Lck`, `Will`
  - App keys are normalized to lowercase source abbreviations:
    - `str`
    - `dex`
    - `con`
    - `health`
    - `siz`
    - `com`
    - `cha`
    - `int`
    - `pow`
    - `lck`
    - `will`
- Characteristic generation:
  - `Stats rules` labels the base rolls as `3d6`, but the actual formulas roll four d6 cells and compute `SUM(...) - MIN(...)`
  - Implemented rule: roll `4d6`, drop the lowest, for each base stat
  - Source-backed dependent adjustments:
    - `Str = raw Str + GM(Siz)`
    - `Dex = raw Dex + size-based modifier from the workbook formula`
    - `Health = raw Health + GM(Con)`
    - `Cha = raw Cha + GM(Com)`
    - all other listed stats stay at their rolled value
- Candidate profile count:
  - `Stats rules` contains 20 repeated chargen blocks
  - App default generation now produces 20 rolled profiles
- Distraction level:
  - `Stats rules` uses two `RANDBETWEEN(1,3)` cells summed together
  - Implemented rule: `2d3`, resulting in `2..6`
- Social class roll/result:
  - `Stats rules` uses two `RANDBETWEEN(1,20)` cells and keeps the higher result
  - Implemented rule: `2d20`, keep highest
  - `sosial klasse 6ex.pdf` `SCANDIA` page maps rolls to:
    - `01-10` -> `Bønder` (`Edu 2`)
    - `11-15` -> `Håndverkere` (`Edu 4`)
    - `16-18` -> `Storbønder` (`Edu 6`)
    - `19-20` -> `Adelen` (`Edu 8`)

## Remaining Gaps

- The full education-total rule is still not explicit in the checked-in source files.
- The repository currently contains only one readable social-class table (`scandia_social_class_v1`), while the workbook metadata suggests tables may vary by society.
