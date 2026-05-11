# Glantri Skill System AI Export Schema

This document describes the generated JSON in plain English. It is intentionally not a formal JSON Schema.

## metadata
Export version, generation timestamp, source path, optional git commit, and import-safety warning.

## civilizations
Civilization/culture records with display names, descriptions, linked society model, society stage, and language names.

## societies
Society-model records. `societyLevel` / `stage` is the 1-6 society-stage scale. `classBands` are the social class rows available inside that society.

## socialClasses
Flattened society class-band records. `classBand` is the 1-4 social class band, not the society stage. These rows include education values, profession IDs, skill group IDs, skill IDs, and notes where available.

## skills
Skill definitions with category, player-facing category, linked stats, description, group membership, specialization-only marker, dependencies, literacy requirement, and admin notes.

## skillGroups
Skill group definitions. `fixedSkills` are always part of the group. `selectionSlots` describe choices. `allReachableSkillIds` includes fixed skills plus slot candidates. Economics explain fixed and slot-dependent cost data.

## specializations
Specialization definitions keyed to parent skills. These are not selectable as ordinary skills.

## professions
Profession subtype definitions with family, effective package, direct grants, reach metrics, availability, and warnings.

## professionFamilies
Profession family definitions and their profession subtype IDs.

## professionPackages
Admin-facing package view: core/optional groups, direct grants, reachable skills, and group fan details.

## availability
Flattened profession availability by profession, civilization, society, society stage, and class band. Some civilization fields may be null when availability exists at society-model level without a specific civilization.

## relationships
Explicit graph-style records for AI modeling. Each row has a `type`, `from`, `to`, and `metadata`.

Relationship types include:
- `skill_in_group`
- `group_has_selection_slot`
- `slot_can_select_skill`
- `specialization_of_skill`
- `profession_grants_group`
- `profession_grants_skill`
- `profession_available_in_society_class`
- `civilization_uses_society`
- `language_materialized_from_language_choice`
- `derived_skill_relationship`

## derivedRules
Readable derived/cross-training/specialization bridge rules. These describe rule sources and targets, factors/thresholds where available, and whether the relationship contributes derived XP.

## adminMetrics
`professionReach` contains unique/group/direct-only reach metrics. `groupWeightedValues` contains weighted group values and small-group exceptions. `validationWarnings` contains non-blocking content warnings.
