import { describe, expect, expectTypeOf, it } from "vitest";

import {
  PROVISIONAL_SKILL_SCOPE_CLASSES,
  SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION,
  SKILL_CATALOGUE_AUTHORING_STATUSES,
  type ProvisionalSkillEconomicWeight,
  type SkillApplicabilityOverrideBasis,
  type SkillCatalogueRecordMetadata,
  type SkillDomainApplicabilityOverrideAuthoringRecord,
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

  it("types inert text/tradition exceptions and domain-scoped DS/AB overrides", () => {
    const bases: SkillApplicabilityOverrideBasis[] = ["text", "tradition"];
    const domainOverride: SkillDomainApplicabilityOverrideAuthoringRecord = {
      accessBand: "AB3",
      attributionId: "profile-trait:proposal:healing-school",
      availability: "restricted",
      basis: "tradition",
      domainId: "domain:proposal:healing",
      explanation: "Authoring provenance only; this grants no competence or eligibility.",
    };

    expect(bases).toEqual(["text", "tradition"]);
    expect(domainOverride).toMatchObject({ accessBand: "AB3", basis: "tradition" });
    expectTypeOf(domainOverride).not.toHaveProperty("competencyId");
    expectTypeOf(domainOverride).not.toHaveProperty("eligibility");
  });
});
