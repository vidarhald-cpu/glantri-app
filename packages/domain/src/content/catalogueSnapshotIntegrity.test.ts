import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CATALOGUE_SNAPSHOT_FIELD_CLASSIFICATIONS,
  DERIVED_SKILL_GRANT_FIELD_CLASSIFICATION,
  MECHANICAL_CATALOGUE_FIELD_NAMES,
  MELEE_CROSS_TRAINING_FIELD_CLASSIFICATION,
  READER_FACING_CATALOGUE_FIELD_NAMES,
  SKILL_DEPENDENCY_FIELD_CLASSIFICATION,
  SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION,
  SKILL_GROUP_SELECTION_SLOT_FIELD_CLASSIFICATION,
  SKILL_GROUP_SKILL_MEMBERSHIP_FIELD_CLASSIFICATION,
  TARGET_SKILL_DEFINITION_FIELD_CLASSIFICATION,
  TARGET_SPECIALIZATION_FIELD_CLASSIFICATION,
  canonicalJsonKey,
  catalogueIntegrityKey,
} from "./catalogueSnapshotIntegrity";
import {
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
 * The guard the Product Owner's reconciliation on Forgejo #764 asked for: the mechanical
 * field set is characterized explicitly, *and* no field of a compared catalogue shape may
 * be left unclassified. A field added to one of these schemas later fails this suite until
 * someone classifies it, rather than silently escaping the integrity comparison.
 */
const CLASSIFIED_SHAPES = [
  [
    "targetSkillDefinition",
    targetRuntimeSkillDefinitionSchema,
    TARGET_SKILL_DEFINITION_FIELD_CLASSIFICATION,
  ],
  [
    "targetSpecialization",
    targetRuntimeSpecializationSchema,
    TARGET_SPECIALIZATION_FIELD_CLASSIFICATION,
  ],
  ["skillGroupDefinition", skillGroupDefinitionSchema, SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION],
  ["skillDependency", skillDependencySchema, SKILL_DEPENDENCY_FIELD_CLASSIFICATION],
  ["derivedSkillGrant", derivedSkillGrantSchema, DERIVED_SKILL_GRANT_FIELD_CLASSIFICATION],
  ["meleeCrossTraining", meleeCrossTrainingSchema, MELEE_CROSS_TRAINING_FIELD_CLASSIFICATION],
  [
    "skillGroupSkillMembership",
    skillGroupSkillMembershipSchema,
    SKILL_GROUP_SKILL_MEMBERSHIP_FIELD_CLASSIFICATION,
  ],
  [
    "skillGroupSelectionSlot",
    skillGroupSelectionSlotSchema,
    SKILL_GROUP_SELECTION_SLOT_FIELD_CLASSIFICATION,
  ],
] as const;

/**
 * Collects every object shape reachable from `schema`, keyed by the path it was reached on,
 * descending through the wrappers these catalogue schemas actually use (`optional`, `default`,
 * `nullable`, arrays, `preprocess`/`transform`, unions, `lazy`, records).
 */
function collectObjectShapes(
  schema: z.ZodTypeAny,
  path: string,
  into: Map<string, readonly string[]>,
  seen: Set<z.ZodTypeAny>,
): void {
  if (seen.has(schema)) return;
  seen.add(schema);

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as z.ZodRawShape;
    into.set(path, Object.keys(shape).sort());
    for (const [field, child] of Object.entries(shape)) {
      collectObjectShapes(child, `${path}.${field}`, into, seen);
    }
    return;
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    collectObjectShapes(schema.unwrap(), path, into, seen);
    return;
  }
  if (schema instanceof z.ZodDefault) {
    collectObjectShapes(schema._def.innerType, path, into, seen);
    return;
  }
  if (schema instanceof z.ZodArray) {
    collectObjectShapes(schema.element, `${path}[]`, into, seen);
    return;
  }
  if (schema instanceof z.ZodEffects) {
    collectObjectShapes(schema.innerType(), path, into, seen);
    return;
  }
  if (schema instanceof z.ZodUnion) {
    for (const [index, option] of (schema.options as z.ZodTypeAny[]).entries()) {
      collectObjectShapes(option, `${path}|${index}`, into, seen);
    }
    return;
  }
  if (schema instanceof z.ZodLazy) {
    collectObjectShapes(schema.schema as z.ZodTypeAny, path, into, seen);
    return;
  }
  if (schema instanceof z.ZodRecord) {
    collectObjectShapes(schema.valueSchema, `${path}{}`, into, seen);
  }
}

describe("catalogue snapshot field classification is total and guarded", () => {
  for (const [name, schema, classification] of CLASSIFIED_SHAPES) {
    it(`classifies every ${name} field, with no unclassified field permitted`, () => {
      const schemaFields = Object.keys(schema.shape).sort();
      const classifiedFields = Object.keys(classification).sort();

      // Both directions: an unclassified schema field and a classification for a field that
      // no longer exists are each a failure.
      expect(classifiedFields).toEqual(schemaFields);
      for (const field of schemaFields) {
        expect(["mechanical", "reader-facing"]).toContain(
          (classification as Record<string, string>)[field],
        );
      }
    });
  }

  it("registers every classified shape in the derived name sets", () => {
    expect(Object.keys(CATALOGUE_SNAPSHOT_FIELD_CLASSIFICATIONS).sort()).toEqual(
      CLASSIFIED_SHAPES.map(([name]) => name).sort(),
    );
  });

  it("keeps the two classes disjoint, so no mechanical field is dropped by name collision", () => {
    const collisions = [...READER_FACING_CATALOGUE_FIELD_NAMES].filter((field) =>
      MECHANICAL_CATALOGUE_FIELD_NAMES.has(field),
    );
    expect(collisions).toEqual([]);
  });

  it("names exactly the authored reader text as reader-facing", () => {
    expect([...READER_FACING_CATALOGUE_FIELD_NAMES].sort()).toEqual([
      "boundaries",
      "description",
      "fullDescription",
      "shortDescription",
    ]);
  });

  it("keeps sortOrder, name and selection-slot label mechanical", () => {
    expect(SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION.sortOrder).toBe("mechanical");
    expect(SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION.name).toBe("mechanical");
    expect(TARGET_SKILL_DEFINITION_FIELD_CLASSIFICATION.sortOrder).toBe("mechanical");
    expect(SKILL_GROUP_SELECTION_SLOT_FIELD_CLASSIFICATION.label).toBe("mechanical");
  });

  it("classifies boundaries as reader-facing, explicitly and not by omission", () => {
    expect(SKILL_GROUP_DEFINITION_FIELD_CLASSIFICATION.boundaries).toBe("reader-facing");
  });

  /**
   * The totality guard above checks only the shapes listed in `CLASSIFIED_SHAPES`, while
   * `canonicalize` omits by field NAME at every depth of any object. A nested object shape
   * introduced later — `z.object({ description, cost })` on one of these schemas — therefore
   * escaped both guards: classifying the parent field satisfied the per-shape check and the
   * `Record<keyof …>` type, while a divergence on the nested `description` went undetected
   * because the name is in the dropped set. This walks every nested object shape reachable
   * from a compared catalogue shape and fails if one is not itself a registered classified
   * shape, so introducing such a shape is a loud failure rather than a silent exclusion.
   */
  it("classifies every NESTED object shape reachable from a compared catalogue shape", () => {
    const reachable = new Map<string, readonly string[]>();
    for (const [name, schema] of CLASSIFIED_SHAPES) {
      collectObjectShapes(schema, name, reachable, new Set());
    }

    const registeredFieldSets = Object.values(CATALOGUE_SNAPSHOT_FIELD_CLASSIFICATIONS).map(
      (classification) => JSON.stringify(Object.keys(classification).sort()),
    );
    const unregistered = [...reachable.entries()]
      .filter(([, fields]) => !registeredFieldSets.includes(JSON.stringify(fields)))
      .map(([path, fields]) => `${path} { ${fields.join(", ")} }`);

    // Every nested object shape must have its own entry in
    // CATALOGUE_SNAPSHOT_FIELD_CLASSIFICATIONS and its own row in CLASSIFIED_SHAPES. Classifying
    // only the parent field is not enough: reader-facing names are dropped at every depth.
    expect(unregistered).toEqual([]);
    // Positive control: the walk really does descend into nested shapes rather than reporting an
    // empty set, which would make the assertion above vacuous.
    expect([...reachable.keys()]).toContain("skillGroupDefinition.selectionSlots[]");
    expect([...reachable.keys()]).toContain("targetSkillDefinition.meleeCrossTraining");
    expect(reachable.size).toBeGreaterThan(CLASSIFIED_SHAPES.length);
  });
});

describe("canonicalJsonKey", () => {
  it("is invariant under object key reordering at every nesting depth", () => {
    const declared = {
      id: "M01",
      selectionSlots: [{ id: "slot", required: true, candidateSkillIds: ["a", "b"] }],
      sortOrder: 24,
    };
    const reordered = {
      sortOrder: 24,
      selectionSlots: [{ candidateSkillIds: ["a", "b"], required: true, id: "slot" }],
      id: "M01",
    };

    expect(JSON.stringify(declared)).not.toBe(JSON.stringify(reordered));
    expect(canonicalJsonKey(declared)).toBe(canonicalJsonKey(reordered));
  });

  it("still distinguishes a changed nested value", () => {
    expect(canonicalJsonKey({ a: { b: 1 } })).not.toBe(canonicalJsonKey({ a: { b: 2 } }));
  });

  it("does NOT normalize array order", () => {
    expect(canonicalJsonKey({ ids: ["a", "b"] })).not.toBe(canonicalJsonKey({ ids: ["b", "a"] }));
  });

  it("treats an absent key and an explicitly undefined key as the same state", () => {
    expect(canonicalJsonKey({ a: 1, b: undefined })).toBe(canonicalJsonKey({ a: 1 }));
  });

  it("omits nothing", () => {
    expect(canonicalJsonKey({ description: "x" })).not.toBe(canonicalJsonKey({}));
  });
});

describe("catalogueIntegrityKey", () => {
  it("omits reader-facing text at every nesting depth", () => {
    const withProse = {
      id: "M01",
      description: "old wording",
      boundaries: ["old boundary"],
      selectionSlots: [{ id: "slot", description: "old slot prose", chooseCount: 1 }],
    };
    const withNewProse = {
      id: "M01",
      description: "new wording",
      boundaries: ["new boundary", "and another"],
      selectionSlots: [{ id: "slot", description: "new slot prose", chooseCount: 1 }],
    };

    expect(catalogueIntegrityKey(withProse)).toBe(catalogueIntegrityKey(withNewProse));
  });

  it("still fails on a mechanical difference", () => {
    expect(catalogueIntegrityKey({ id: "M01", sortOrder: 24 })).not.toBe(
      catalogueIntegrityKey({ id: "M01", sortOrder: 25 }),
    );
    expect(catalogueIntegrityKey({ chooseCount: 1 })).not.toBe(
      catalogueIntegrityKey({ chooseCount: 2 }),
    );
  });

  /**
   * `canonicalJsonKey` has its own order-invariance test above, but `catalogueIntegrityKey` is
   * the function the snapshot comparisons actually call, and it had none of its own. Removing
   * the key sort from `canonicalize` left the comparison order-sensitive again while every
   * `catalogueIntegrityKey` assertion in this file still passed.
   */
  it("is invariant under object key reordering at every nesting depth", () => {
    const declared = {
      id: "M01",
      name: "Mounted Warfare",
      description: "declared-order prose",
      skillMemberships: [{ skillId: "riding", relevance: "core" }],
      selectionSlots: [
        {
          candidateSkillIds: ["lance", "polearms"],
          chooseCount: 1,
          id: "slot",
          label: "Pick one",
          required: true,
        },
      ],
      specializationIds: ["F07"],
      sortOrder: 24,
    };
    // The same value after a PostgreSQL `jsonb` round-trip: keys by length, then bytewise, at
    // every depth, with array order left intact.
    const jsonbOrdered = {
      id: "M01",
      name: "Mounted Warfare",
      sortOrder: 24,
      description: "declared-order prose",
      selectionSlots: [
        {
          id: "slot",
          label: "Pick one",
          required: true,
          chooseCount: 1,
          candidateSkillIds: ["lance", "polearms"],
        },
      ],
      skillMemberships: [{ skillId: "riding", relevance: "core" }],
      specializationIds: ["F07"],
    };

    expect(JSON.stringify(declared)).not.toBe(JSON.stringify(jsonbOrdered));
    expect(catalogueIntegrityKey(declared)).toBe(catalogueIntegrityKey(jsonbOrdered));
  });

  it("still separates a mechanical divergence carried on a reordered value", () => {
    const declared = {
      id: "M01",
      selectionSlots: [{ chooseCount: 1, id: "slot", required: true }],
      sortOrder: 24,
    };
    const reorderedAndDiverged = {
      sortOrder: 24,
      selectionSlots: [{ id: "slot", required: true, chooseCount: 2 }],
      id: "M01",
    };

    expect(catalogueIntegrityKey(declared)).not.toBe(catalogueIntegrityKey(reorderedAndDiverged));
  });

  it("does NOT normalize array order", () => {
    expect(catalogueIntegrityKey({ ids: ["a", "b"] })).not.toBe(
      catalogueIntegrityKey({ ids: ["b", "a"] }),
    );
  });
});
