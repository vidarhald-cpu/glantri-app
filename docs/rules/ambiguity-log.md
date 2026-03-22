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
