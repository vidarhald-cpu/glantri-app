import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";
import { validateCanonicalContent } from "../validators";
import { representativeSkillCatalogueAuthoringDocument } from "./fixtures";
import { invalidSkillCatalogueAuthoringDocuments } from "./invalidFixtures";
import { validateSkillCatalogueAuthoringDocument } from "./validator";

describe("representative Skill Catalogue authoring document", () => {
  it("validates the deliberately small non-runtime proposal document", () => {
    expect(
      validateSkillCatalogueAuthoringDocument(representativeSkillCatalogueAuthoringDocument),
    ).toEqual({
      diagnostics: [],
      documentId: "catalogue:proposal:issue-365",
      valid: true,
    });
  });

  it("makes the two Medicine-like practices legibly different by task envelope", () => {
    const localPractice = representativeSkillCatalogueAuthoringDocument.skills.find(
      (skill) => skill.id === "skill:proposal:wayfarers-physic",
    )!;
    const learnedPractice = representativeSkillCatalogueAuthoringDocument.skills.find(
      (skill) => skill.id === "skill:proposal:collegiate-medicine",
    )!;

    expect(localPractice.name).not.toBe(learnedPractice.name);
    expect(localPractice.description).not.toBe(learnedPractice.description);
    expect(localPractice.taskEnvelope).not.toEqual(learnedPractice.taskEnvelope);
    expect(localPractice.taskEnvelope.limits.join(" ")).toContain("scholarly");
    expect(learnedPractice.taskEnvelope.methods.join(" ")).toContain("textual tradition");
  });

  it("authors Medicine to First Aid as exact inclusion only after containing its core tasks", () => {
    const medicine = representativeSkillCatalogueAuthoringDocument.skills.find(
      (skill) => skill.id === "skill:proposal:collegiate-medicine",
    )!;
    const firstAid = representativeSkillCatalogueAuthoringDocument.skills.find(
      (skill) => skill.id === "skill:proposal:first-aid",
    )!;
    const inclusion = representativeSkillCatalogueAuthoringDocument.relationships.find(
      (relationship) => relationship.kind === "inclusion",
    )!;

    expect(inclusion).toMatchObject({
      direction: "source-to-target",
      includedCorePercent: 100,
      reverseEdge: "not-inferred",
      sourceCompetencyId: medicine.id,
      targetCompetencyId: firstAid.id,
    });
    expect(medicine.taskEnvelope.coreTasks.join(" ")).toContain(
      "Perform every core First Aid task",
    );
    expect(firstAid.economicWeight).toMatchObject({
      pricingAuthority: "none",
      relativeScope: "narrow",
      status: "provisional",
    });
  });

  it("keeps specialization prerequisite and transfer authorship separate", () => {
    const specialization = representativeSkillCatalogueAuthoringDocument.specializations[0]!;
    const prerequisite = representativeSkillCatalogueAuthoringDocument.relationships.find(
      (relationship) => relationship.id === specialization.basePrerequisiteEdgeIds[0],
    )!;
    const transfer = representativeSkillCatalogueAuthoringDocument.relationships.find(
      (relationship) => relationship.id === specialization.transferEdgeIds[0],
    )!;

    expect(prerequisite.kind).toBe("prerequisite");
    expect(prerequisite).toMatchObject({
      enforcement: "not-implemented",
      sourceCompetencyId: "skill:proposal:surgery",
      targetCompetencyId: specialization.id,
      threshold: { status: "placeholder" },
    });
    expect(transfer.kind).toBe("related");
    expect(transfer.id).not.toBe(prerequisite.id);
    expect(transfer).toMatchObject({ calibration: "unresolved", effect: "transfer" });
  });

  it("represents fixed and selected group membership plus contextual overlap", () => {
    const [infirmary, campaign] = representativeSkillCatalogueAuthoringDocument.learningGroups;
    const fixedOverlap = infirmary!.fixedCompetencyIds.filter((competencyId) =>
      campaign!.fixedCompetencyIds.includes(competencyId),
    );

    expect(infirmary!.fixedCompetencyIds).toHaveLength(3);
    expect(infirmary!.selectedMemberships[0]).toMatchObject({ chooseCount: 1 });
    expect(fixedOverlap).toEqual(["skill:proposal:first-aid"]);
    expect(infirmary!.context.description).not.toBe(campaign!.context.description);
  });

  it("authors both directions of an asymmetric pair separately", () => {
    const forward = representativeSkillCatalogueAuthoringDocument.relationships.find(
      (relationship) => relationship.id === "relationship:proposal:wayfarers-to-collegiate",
    )!;
    const reverse = representativeSkillCatalogueAuthoringDocument.relationships.find(
      (relationship) => relationship.id === "relationship:proposal:collegiate-to-wayfarers",
    )!;

    expect(forward).toMatchObject({
      effect: "familiarity",
      sourceCompetencyId: reverse.targetCompetencyId,
      targetCompetencyId: reverse.sourceCompetencyId,
    });
    expect(reverse).toMatchObject({ effect: "learning-advantage" });
    expect(forward.id).not.toBe(reverse.id);
  });

  it("binds written traditions to language and script without inferring shared-script competence", () => {
    const [oldSerevan, harborSerevan] =
      representativeSkillCatalogueAuthoringDocument.writtenTraditions;
    const relatedWrittenTraditionEdge =
      representativeSkillCatalogueAuthoringDocument.relationships.find(
        (relationship) =>
          relationship.sourceCompetencyId === oldSerevan!.id &&
          relationship.targetCompetencyId === harborSerevan!.id,
      );

    expect(oldSerevan!.spokenLanguageId).not.toBe(harborSerevan!.spokenLanguageId);
    expect(oldSerevan!.scriptId).toBe(harborSerevan!.scriptId);
    expect(relatedWrittenTraditionEdge).toBeUndefined();
    expect(
      representativeSkillCatalogueAuthoringDocument.families.every(
        (family) => family.membershipMeaning === "authoring-only" && family.mechanics === "none",
      ),
    ).toBe(true);
  });

  it("expresses DS/AB defaults and attributable profile/contact/teacher overrides only", () => {
    const bases = new Set(
      representativeSkillCatalogueAuthoringDocument.applicabilityProfiles.flatMap((profile) =>
        profile.overrides.map((override) => override.basis),
      ),
    );

    expect(
      representativeSkillCatalogueAuthoringDocument.applicabilityProfiles.map(
        (profile) => profile.developmentStage,
      ),
    ).toEqual(["DS2", "DS6"]);
    expect(bases).toEqual(new Set(["contact", "profile", "teacher"]));
    expect(
      representativeSkillCatalogueAuthoringDocument.applicabilityProfiles.every(
        (profile) => profile.eligibilityEnforcement === "not-implemented",
      ),
    ).toBe(true);
  });

  it("keeps proposal, evidence, and legacy records explicit and outside runtime content", () => {
    const statuses = new Set([
      ...representativeSkillCatalogueAuthoringDocument.skills.map((skill) => skill.metadata.status),
      ...representativeSkillCatalogueAuthoringDocument.families.map(
        (family) => family.metadata.status,
      ),
    ]);

    expect(statuses).toEqual(new Set(["evidence", "legacy", "proposal"]));
    expect(representativeSkillCatalogueAuthoringDocument.runtimeIntegration).toBe("none");
  });

  it("does not mutate or replace current canonical Skill content", () => {
    const before = JSON.stringify(defaultCanonicalContent);

    validateSkillCatalogueAuthoringDocument(representativeSkillCatalogueAuthoringDocument);

    expect(JSON.stringify(defaultCanonicalContent)).toBe(before);
    expect(validateCanonicalContent(defaultCanonicalContent)).toEqual(defaultCanonicalContent);
  });
});

describe("Skill Catalogue authoring rejection diagnostics", () => {
  const diagnosticsByDocument = new Map(
    invalidSkillCatalogueAuthoringDocuments.map((document) => [
      document.id,
      validateSkillCatalogueAuthoringDocument(document).diagnostics,
    ]),
  );

  it.each([
    ["catalogue:invalid:duplicate-stable-id", "DUPLICATE_STABLE_ID"],
    ["catalogue:invalid:active-domain", "NON_MECHANICAL_IDENTITY_MARKED_ACTIVE"],
    ["catalogue:invalid:active-domain", "NON_MECHANICAL_IDENTITY_HAS_ACTIVE_FIELD"],
    ["catalogue:invalid:missing-relationship-target", "RELATIONSHIP_UNKNOWN_TARGET"],
    ["catalogue:invalid:partial-inclusion", "INCLUSION_NOT_EXACT_100_PERCENT"],
    ["catalogue:invalid:specialization-prerequisite", "SPECIALIZATION_INVALID_BASE_PREREQUISITE"],
    ["catalogue:invalid:specialization-prerequisite", "SPECIALIZATION_TRANSFER_SLOT_MISSING"],
    ["catalogue:invalid:written-tradition-binding", "WRITTEN_TRADITION_UNKNOWN_LANGUAGE"],
    ["catalogue:invalid:written-tradition-binding", "WRITTEN_TRADITION_UNKNOWN_SCRIPT"],
    ["catalogue:invalid:learning-group", "LEARNING_GROUP_CONTEXT_MISSING"],
    ["catalogue:invalid:learning-group", "LEARNING_GROUP_UNKNOWN_MEMBER"],
    ["catalogue:invalid:applicability", "INVALID_DEVELOPMENT_STAGE"],
    ["catalogue:invalid:applicability", "INVALID_ACCESS_BAND"],
    ["catalogue:invalid:applicability", "APPLICABILITY_DEFAULT_REFERENCE_INVALID"],
    ["catalogue:invalid:applicability", "APPLICABILITY_OVERRIDE_REFERENCE_INVALID"],
    ["catalogue:invalid:undifferentiated-proposal", "AUTHORING_STATUS_OR_PROVENANCE_MISSING"],
    ["catalogue:invalid:live-pricing", "ECONOMIC_WEIGHT_NOT_INERT"],
    ["catalogue:invalid:live-pricing", "LIVE_PRICING_FIELD_FORBIDDEN"],
    ["catalogue:invalid:inferred-mechanics", "AUTHORING_POLICY_RUNTIME_OR_INFERENCE_LEAK"],
    ["catalogue:invalid:inferred-mechanics", "FAMILY_MEMBERSHIP_MECHANICALLY_ACTIVE"],
    ["catalogue:invalid:inferred-mechanics", "RELATIONSHIP_DIRECTION_OR_REVERSE_IMPLIED"],
    ["catalogue:invalid:related-arithmetic", "UNRESOLVED_RELATIONSHIP_ARITHMETIC_FIELD"],
  ])("reports %s with %s", (documentId, code) => {
    expect(diagnosticsByDocument.get(documentId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, documentId })]),
    );
  });

  it("returns deterministic author-readable errors", () => {
    for (const document of invalidSkillCatalogueAuthoringDocuments) {
      const first = validateSkillCatalogueAuthoringDocument(document);
      const second = validateSkillCatalogueAuthoringDocument(structuredClone(document));

      expect(first.valid).toBe(false);
      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(
        first.diagnostics.every(
          (diagnostic) =>
            diagnostic.code.length > 0 &&
            diagnostic.path.length > 0 &&
            diagnostic.message.length > 0,
        ),
      ).toBe(true);
    }
  });
});
