# Ambiguity Log

Track unresolved rules questions and implementation decisions.

## Education Total Formula

- Status: unresolved after source pass
- Scope:
  - `packages/rules-engine/src/education/calculateEducation.ts`
  - `packages/rules-engine/src/chargen/primaryAllocation.ts`
  - advancement/sheet views that display education breakdown
- Source facts confirmed:
  - `Skills and Societies.xlsx` defines `base_education`
  - `sosial klasse 6ex.pdf` defines class-specific `Edu` values for the Scandia table
  - `Skills and Societies.xlsx` and `skill-groups_skills_specializations.xlsx` mark some skills as theoretical and note that theoretical skills count toward an education bonus
- What is still missing:
  - No checked-in formula explicitly shows how `base_education`, class `Edu`, and theoretical skills combine into the final education total used in play
  - No checked-in source ties a `GM Int` term directly into the education formula
- Decision in code:
  - Remove the old provisional `memory`/`intuition`-based education logic
  - Keep only source-backed education components in the helper:
    - `baseEducation`
    - `socialClassEducationValue`
    - learned theoretical-skill count
  - Preserve the existing `EducationBreakdown` shape for compatibility, with `gmInt` held at `0` until a source formula is available

## Society-Specific Social Class Tables

- Status: isolated
- Scope:
  - `packages/rules-engine/src/chargen/generateProfiles.ts`
  - future content import / society mapping work
- Source facts confirmed:
  - `Skills and Societies.xlsx` includes a `class_roll_table_id` field
  - only one readable table is currently available locally: `scandia_social_class_v1` from `sosial klasse 6ex.pdf`
- Decision in code:
  - Support the known Scandia table explicitly
  - Throw for unknown table ids rather than inventing additional mappings
- Follow-up:
  - Add the remaining society/class-roll source pages or tables before making social-class generation depend on selected society end-to-end

## Secondary Critical `Sec` Grammar

- Status: **resolved** by the Forgejo #223 Product Owner ruling ("PRODUCT OWNER RULING — Secondary
  Criticals, all four questions settled"); reconciled from source and ratified
- Scope:
  - `docs/rules/secondary-critical-sec-grammar.md`
  - `docs/decisions/rules/0006-secondary-critical-resolution.md` (as amended 2026-09-21)
  - `data/raw/glantri/Themistogenes 1.07.xlsx`, sheet `Weapon1`, column `Q`
- Source facts confirmed:
  - `Weapon1!Q` (`Second crit.`) is populated in exactly twelve rows, every value two characters,
    grade letter `A`-`D` and family letter `S`/`P`/`C`
  - the family letter routes `S` to `sharp`, `P` to `pointed_weapons`, and `C` to `blunt`
  - no workbook formula reads `Weapon1!Q`; the widest weapon-table ranges stop at column `P`
- Resolved by the ruling (all four questions the source alone could not settle):
  - the `Crit 1` grade letter and the `Sec` first character are **maxima**, not reduction anchors;
    the grade reduction from the resolved Primary grade is a **universal two-grade-step reduction**,
    the same for every weapon, and the `Sec` first character then **caps** the reduced grade
  - the recognized vocabulary is the six attested codes (`AP, AC, AS, BS, CC, DC`); unknown codes
    fail closed, and future content may add codes explicitly
  - `Sec` applies only where an authored recognized value exists, so the present source is
    melee-only; this is **not a permanent prohibition** on future non-melee authoring
  - the Secondary Critical reuses the Primary Critical's hit location; only the Critical result uses
    a fresh independent 2d8
- Decision in code:
  - none; no runtime Secondary Critical work is authorized by this resolution
  - parsing work preserves the raw code and provenance and fails closed on unrecognized grammar
