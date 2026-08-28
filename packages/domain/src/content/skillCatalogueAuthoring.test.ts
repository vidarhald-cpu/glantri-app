import { describe, expect, expectTypeOf, it } from "vitest";

import {
  PILOT_SKILL_ACCESS_AVAILABILITIES,
  PILOT_SKILL_ACCESS_EXCEPTION_BASES,
  PILOT_SKILL_COMPETENCE_BANDS,
  PROVISIONAL_SKILL_SCOPE_CLASSES,
  PILOT_SKILL_ECONOMIC_WEIGHTS,
  PILOT_SKILL_RELATIONSHIP_STRENGTHS,
  PILOT_SKILL_RULES_VERSION,
  PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS,
  SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION,
  SKILL_CATALOGUE_AUTHORING_STATUSES,
  type PilotSkillEconomicWeightAuthoring,
  type PilotSkillRelationshipAuthoring,
  type PilotSpecializationEconomicsAuthoring,
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

  it("defines the accepted Pilot Skill Rules v1 quantitative vocabulary", () => {
    const weight: PilotSkillEconomicWeightAuthoring = {
      rationale: "A demanding concrete practice.",
      rulesVersion: PILOT_SKILL_RULES_VERSION,
      value: 3,
    };
    const relationship: PilotSkillRelationshipAuthoring = {
      id: "relationship:medicine-to-first-aid",
      rulesVersion: PILOT_SKILL_RULES_VERSION,
      sourceCompetencyId: "skill:medicine",
      strength: 100,
      targetCompetencyId: "skill:first-aid",
    };
    const specialization: PilotSpecializationEconomicsAuthoring = {
      acquisitionWeight: 1,
      initiationCost: 2,
      prerequisites: [{ competencyId: "skill:medicine", threshold: 6 }],
      rulesVersion: PILOT_SKILL_RULES_VERSION,
    };

    expect(PILOT_SKILL_ECONOMIC_WEIGHTS).toEqual([1, 2, 3]);
    expect(PILOT_SPECIALIZATION_ECONOMIC_WEIGHTS).toEqual([1, 2]);
    expect(PILOT_SKILL_RELATIONSHIP_STRENGTHS).toEqual([100, 75, 50, 25]);
    expect(PILOT_SKILL_ACCESS_AVAILABILITIES).toEqual(["available", "restricted", "unavailable"]);
    expect(PILOT_SKILL_ACCESS_EXCEPTION_BASES).toContain("text");
    expect(PILOT_SKILL_COMPETENCE_BANDS.map((band) => band.minimum)).toEqual([1, 6, 11, 16, 21]);
    expect(weight.value).toBe(3);
    expect(relationship.strength).toBe(100);
    expect(specialization).toMatchObject({ acquisitionWeight: 1, initiationCost: 2 });
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
