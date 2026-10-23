import { describe, expect, it } from "vitest";

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
});
