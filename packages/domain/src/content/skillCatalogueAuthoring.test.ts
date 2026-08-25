import { describe, expect, expectTypeOf, it } from "vitest";

import {
  PROVISIONAL_SKILL_SCOPE_CLASSES,
  SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION,
  SKILL_CATALOGUE_AUTHORING_STATUSES,
  type ProvisionalSkillEconomicWeight,
  type SkillCatalogueRecordMetadata,
} from "./skillCatalogueAuthoring";

describe("Skill Catalogue authoring contracts", () => {
  it("pins a versioned schema and explicit authority statuses", () => {
    expect(SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION).toBe("skill-catalogue-authoring/v1");
    expect(SKILL_CATALOGUE_AUTHORING_STATUSES).toEqual([
      "canonical",
      "proposal",
      "evidence",
      "legacy",
    ]);
  });

  it("keeps provisional scope metadata structurally separate from runtime pricing", () => {
    const weight: ProvisionalSkillEconomicWeight = {
      pricingAuthority: "none",
      rationale: "Author comparison only.",
      relativeScope: "narrow",
      status: "provisional",
    };

    expect(PROVISIONAL_SKILL_SCOPE_CLASSES).toContain(weight.relativeScope);
    expect(weight.pricingAuthority).toBe("none");
    expectTypeOf(weight).not.toHaveProperty("price");
  });

  it("can distinguish accepted authoring authority from non-canonical evidence", () => {
    const canonical: SkillCatalogueRecordMetadata = {
      recordVersion: "1",
      status: "canonical",
      provenance: {
        kind: "decision",
        reference: "decision:example",
      },
    };
    const legacy: SkillCatalogueRecordMetadata = {
      recordVersion: "1",
      status: "legacy",
      provenance: {
        kind: "legacy",
        reference: "source:legacy-example",
      },
    };

    expect(canonical.status).not.toBe(legacy.status);
    expect(canonical.provenance.kind).toBe("decision");
    expect(legacy.provenance.kind).toBe("legacy");
  });
});
