import type { z } from "zod";

import type {
  derivedSkillGrantSchema,
  meleeCrossTrainingSchema,
  skillDependencySchema,
  skillGroupDefinitionSchema,
  skillGroupSelectionSlotSchema,
  skillGroupSkillMembershipSchema,
  targetRuntimeSkillDefinitionSchema,
  targetRuntimeSpecializationSchema,
} from "./skills";

/**
 * Character snapshot integrity (Forgejo #764).
 *
 * A Character stores a `targetDefinition` snapshot of the catalogue entry it was built
 * from, and a read compares that snapshot against the live catalogue. Two properties of
 * that comparison are *not* properties of the game:
 *
 * 1. **Object key order.** The snapshot round-trips through `Character.build`, a Prisma
 *    `Json` column, which is PostgreSQL `jsonb`. `jsonb` canonicalizes object keys by
 *    length then bytewise, at every nesting depth, while the live catalogue object is in
 *    source-declaration order. `JSON.stringify` is order-sensitive, so a byte-identical
 *    snapshot compares unequal. Object key order carries no game semantics and must never
 *    produce an integrity failure.
 *
 *    **Array order is deliberately preserved.** `jsonb` stores array elements in order and
 *    returns them in order, so array order cannot be disturbed by the round-trip; and some
 *    compared arrays are order-bearing (`linkedStats` is an ordered stat pair, `groupIds`
 *    privileges its first element as `groupId`). Array order therefore stays compared.
 *
 * 2. **Reader-facing prose.** Product Owner ruling on #764: "Character snapshots protect
 *    mechanically consequential catalogue state, not descriptive wording [...] Reader-facing
 *    text should be read from the current authoritative catalogue." Authored prose is
 *    therefore excluded from the comparison, so re-wording the catalogue cannot retroactively
 *    invalidate an existing Character. Nothing here rewrites a persisted snapshot: the
 *    excluded text is simply not compared.
 *
 * The classification below is **total and guarded**. Every field of every catalogue shape
 * that enters a snapshot comparison is named here as `mechanical` or `reader-facing`, the
 * `Record<keyof …>` types make that total at compile time, and
 * `catalogueSnapshotIntegrity.test.ts` asserts it again at runtime against each schema's
 * own `shape`. A field added to the catalogue later fails the suite loudly until someone
 * classifies it, instead of silently escaping comparison.
 */
export type CatalogueSnapshotFieldClass = "mechanical" | "reader-facing";

type FieldClassification<TSchema extends z.ZodType> = Readonly<
  Record<keyof z.infer<TSchema>, CatalogueSnapshotFieldClass>
>;

/**
 * `description` / `shortDescription` / `fullDescription` are authored reader text.
 *
 * `name` stays **mechanical**: it is the designation of the entry the Character committed
 * to rather than descriptive wording, and the ruling's reader-facing list is prose. Keeping
 * it compared errs toward integrity, which is the safe direction.
 */
export const TARGET_SKILL_DEFINITION_FIELD_CLASSIFICATION: FieldClassification<
  typeof targetRuntimeSkillDefinitionSchema
> = {
  allowsSpecializations: "mechanical",
  catalogueSource: "mechanical",
  category: "mechanical",
  categoryId: "mechanical",
  competencyType: "mechanical",
  dependencies: "mechanical",
  dependencySkillIds: "mechanical",
  derivedGrants: "mechanical",
  description: "reader-facing",
  groupId: "mechanical",
  groupIds: "mechanical",
  id: "mechanical",
  isTheoretical: "mechanical",
  linkedStats: "mechanical",
  meleeCrossTraining: "mechanical",
  name: "mechanical",
  requiresLiteracy: "mechanical",
  secondaryOfSkillId: "mechanical",
  shortDescription: "reader-facing",
  societyLevel: "mechanical",
  sortOrder: "mechanical",
  specializationOfSkillId: "mechanical",
};

export const TARGET_SPECIALIZATION_FIELD_CLASSIFICATION: FieldClassification<
  typeof targetRuntimeSpecializationSchema
> = {
  catalogueSource: "mechanical",
  competencyType: "mechanical",
  description: "reader-facing",
  id: "mechanical",
  linkedStats: "mechanical",
  minimumGroupLevel: "mechanical",
  minimumParentLevel: "mechanical",
  name: "mechanical",
  skillId: "mechanical",
  sortOrder: "mechanical",
};

/**
 * `boundaries` is **reader-facing**, and this is the one classification that needs saying
 * out loud rather than being allowed to pass unnoticed. Its text reads as rule-bearing —
 * "Unarmed fighting is a different practice and is not taught here" — but it is authored
 * prose: no code consumes it, nothing derives a permission, cost, rank or roll from it, and
 * it is a `string[]` of sentences. Under the ruling's own test ("carries no machine-consumed
 * value") it is reader-facing, so a re-wording of a boundary statement must not invalidate a
 * Character. The rule it *describes* is enforced by the mechanical fields next to it
 * (`skillMemberships`, `selectionSlots`, `specializationIds`), which stay compared.
 *
 * `sortOrder` is a mechanical value and stays compared, per the ruling's scope notes.
 */
export const SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION: FieldClassification<
  typeof skillGroupDefinitionSchema
> = {
  boundaries: "reader-facing",
  description: "reader-facing",
  fullDescription: "reader-facing",
  id: "mechanical",
  name: "mechanical",
  selectionSlots: "mechanical",
  shortDescription: "reader-facing",
  skillMemberships: "mechanical",
  specializationIds: "mechanical",
  sortOrder: "mechanical",
};

export const SKILL_DEPENDENCY_FIELD_CLASSIFICATION: FieldClassification<
  typeof skillDependencySchema
> = {
  skillId: "mechanical",
  strength: "mechanical",
};

export const DERIVED_SKILL_GRANT_FIELD_CLASSIFICATION: FieldClassification<
  typeof derivedSkillGrantSchema
> = {
  factor: "mechanical",
  skillId: "mechanical",
};

export const MELEE_CROSS_TRAINING_FIELD_CLASSIFICATION: FieldClassification<
  typeof meleeCrossTrainingSchema
> = {
  attackStyle: "mechanical",
  handClass: "mechanical",
};

export const SKILL_GROUP_SKILL_MEMBERSHIP_FIELD_CLASSIFICATION: FieldClassification<
  typeof skillGroupSkillMembershipSchema
> = {
  relevance: "mechanical",
  skillId: "mechanical",
};

/**
 * `label` stays **mechanical**: like `name` it designates the slot a Character made a
 * choice in rather than describing it, and the slot's mechanical effect is read through
 * `candidateSkillIds` / `chooseCount` / `required` alongside it.
 */
export const SKILL_GROUP_SELECTION_SLOT_FIELD_CLASSIFICATION: FieldClassification<
  typeof skillGroupSelectionSlotSchema
> = {
  candidateSkillIds: "mechanical",
  chooseCount: "mechanical",
  id: "mechanical",
  label: "mechanical",
  required: "mechanical",
};

/**
 * Every classification that governs a snapshot comparison, in one place so the drop set
 * below is *derived* from the classifications rather than restated beside them.
 */
export const CATALOGUE_SNAPSHOT_FIELD_CLASSIFICATIONS: Readonly<
  Record<string, Readonly<Record<string, CatalogueSnapshotFieldClass>>>
> = {
  derivedSkillGrant: DERIVED_SKILL_GRANT_FIELD_CLASSIFICATION,
  meleeCrossTraining: MELEE_CROSS_TRAINING_FIELD_CLASSIFICATION,
  skillDependency: SKILL_DEPENDENCY_FIELD_CLASSIFICATION,
  skillGroupDefinition: SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION,
  skillGroupSelectionSlot: SKILL_GROUP_SELECTION_SLOT_FIELD_CLASSIFICATION,
  skillGroupSkillMembership: SKILL_GROUP_SKILL_MEMBERSHIP_FIELD_CLASSIFICATION,
  targetSkillDefinition: TARGET_SKILL_DEFINITION_FIELD_CLASSIFICATION,
  targetSpecialization: TARGET_SPECIALIZATION_FIELD_CLASSIFICATION,
};

function collectFieldNames(fieldClass: CatalogueSnapshotFieldClass): ReadonlySet<string> {
  const names = new Set<string>();
  for (const classification of Object.values(CATALOGUE_SNAPSHOT_FIELD_CLASSIFICATIONS)) {
    for (const [field, value] of Object.entries(classification)) {
      if (value === fieldClass) names.add(field);
    }
  }
  return names;
}

/**
 * Derived, not hand-listed. The comparison drops exactly the fields the classifications
 * above call reader-facing, and the test suite asserts the two classes are disjoint, so a
 * field name can never be mechanical on one shape and dropped because of another.
 */
export const READER_FACING_CATALOGUE_FIELD_NAMES: ReadonlySet<string> =
  collectFieldNames("reader-facing");

export const MECHANICAL_CATALOGUE_FIELD_NAMES: ReadonlySet<string> =
  collectFieldNames("mechanical");

function canonicalize(value: unknown, omittedFieldNames: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    // Array order is preserved deliberately; see the module comment.
    return value.map((element) => canonicalize(element, omittedFieldNames));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const source = value as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};

  for (const key of Object.keys(source).sort()) {
    if (omittedFieldNames.has(key)) continue;
    // An absent key and a key carrying `undefined` are the same state after a `jsonb`
    // round-trip, so they must compare equal.
    if (source[key] === undefined) continue;
    canonical[key] = canonicalize(source[key], omittedFieldNames);
  }

  return canonical;
}

/**
 * Order-insensitive structural key for any value, with nothing omitted.
 *
 * Object keys are sorted at every depth; array order is preserved. Use this wherever a
 * persisted value is compared against a freshly computed one and object key order is not
 * meant to be part of the comparison.
 */
export function canonicalJsonKey(value: unknown): string {
  return JSON.stringify(canonicalize(value, new Set<string>()));
}

/**
 * Comparison key for a catalogue snapshot: order-insensitive over object keys, and with
 * reader-facing authored text omitted at every depth.
 *
 * Two snapshots with the same key are mechanically identical catalogue state. This reads;
 * it never writes, and it never rewrites or refreshes the value it was given.
 */
export function catalogueIntegrityKey(value: unknown): string {
  return JSON.stringify(canonicalize(value, READER_FACING_CATALOGUE_FIELD_NAMES));
}
