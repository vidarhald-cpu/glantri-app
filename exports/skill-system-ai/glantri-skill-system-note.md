# Glantri Skill System AI Export Notes

## Regenerating the export

`glantri-skill-system-export.json` is gitignored (~190k lines). Regenerate locally with:

```bash
pnpm --filter @glantri/content export:skill-system-ai
```

## Purpose

This export is for AI review/modeling and possible later import proposals. It is not canonical content by itself, and generated suggestions must not be reimported without validation.

## Society/Class Model

- Society stage/level uses a 1-6 scale.
- Social class band uses a 1-4 scale.
- Class 4 is elite/high-status.
- Low social rolls still need playable options.
- Class 3 should support upward mobility.

## Skill Model

- Ordinary skills are the main skill rows used for broad learned capability.
- Secondary skills are narrower or more contextual skills.
- Specializations are not normal skill choices; they depend on a parent skill and minimum parent/group level.
- Concrete languages are materialized rather than relying on a raw generic Language skill.

## Skill-Group Economics

- Learning Group price: ceil(2/3 × weighted useful competence), charged ONCE for the complete purchased bundle — never per group and never per rank. Rule decision 0011 retired the earlier floor(0.6 x total individual cost) group scalar; packages/rules-engine/src/skills/learningGroupAcquisition.ts is the single shared calculation.
- Active group skills = fixed group skills + selected slot skills.
- Unselected slot candidates do not count.
- Normal groups should usually represent about 6+ weighted skill points unless deliberately narrow/allowed.

## Skill-Group Guardrails

- Dodge and Parry must not be taught alone.
- Any group containing Dodge or Parry must include melee weapon context.
- Combat support groups such as Defensive Soldiering and Veteran Soldiering should contain non-combat/military support skills, not ordinary weapon/Dodge/Parry fundamentals.
- Weapon slots should not include specialization-only entries.
- Longbow is a base combat Skill related to Bow by an authored qualitative "helpful" dependency, with no numeric transfer in either direction. It is taught by F41 (with Hunting) and is a candidate in the M04 and M05 military missile slots, but it is deliberately NOT a candidate in the legacy basic/advanced missile training slots.

## Profession/Package Principles

- Profession reach measures unique skills reachable from granted groups plus direct grants not already covered by groups.
- Avoid isolated combat skills in non-combat professions.
- Use coherent packages.
- C4 should not be crowded by ordinary labor/common roles when elite equivalents exist.
- C3 mobility paths are desirable.
- Low-class playable paths are intentional.

## Craft/Choice-Slot Model

- Craft professions can use common social/business/technical training plus craft choice slots.
- Master craft should usually choose craft specialties rather than automatically gaining all crafts.

## Import Caution

- Do not reimport generated suggestions without validation.
- Preserve stable IDs where possible.
- Retired IDs/compatibility aliases may exist.
- Run content validators and admin reach audits after changes.
