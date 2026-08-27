import type { SkillCatalogueAuthoringDocument } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";
import { validateCanonicalContent } from "../validators";
import { representativeSkillCatalogueAuthoringDocument } from "./fixtures";
import { invalidSkillCatalogueAuthoringDocuments } from "./invalidFixtures";
import { validateSkillCatalogueAuthoringDocument } from "./validator";

type Mutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

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

  it("allows a valid specialization to omit transfer edges without inventing a reverse relation", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const specialization = document.specializations[0]!;
    const prerequisiteId = specialization.basePrerequisiteEdgeIds[0]!;
    const transferIds = new Set(specialization.transferEdgeIds);

    specialization.transferEdgeIds = [];
    document.relationships = document.relationships.filter(
      (relationship) => !transferIds.has(relationship.id),
    );

    expect(validateSkillCatalogueAuthoringDocument(document)).toMatchObject({
      diagnostics: [],
      valid: true,
    });
    expect(specialization.basePrerequisiteEdgeIds).toEqual([prerequisiteId]);
    expect(
      document.relationships.some(
        (relationship) =>
          relationship.kind === "related" &&
          (relationship.sourceCompetencyId === specialization.id ||
            relationship.targetCompetencyId === specialization.id),
      ),
    ).toBe(false);
  });

  it("expresses accepted v0.2 specialization probes without authored transfer edges", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const probes = [
      {
        baseId: "skill:probe:fibre-working",
        baseName: "Fibre Working",
        specializationId: "specialization:probe:cordage-ropemaking",
        specializationName: "Cordage / Ropemaking",
        task: "Prepare fibre and twist or lay it into society-appropriate cordage.",
      },
      {
        baseId: "skill:probe:tailoring",
        baseName: "Tailoring",
        specializationId: "specialization:probe:sailmaking",
        specializationName: "Sailmaking",
        task: "Cut, reinforce, fit, and repair sails within a tailoring foundation.",
      },
      {
        baseId: "skill:probe:battle-tactics",
        baseName: "Battle Tactics",
        specializationId: "specialization:probe:siege-operations",
        specializationName: "Siege Operations",
        task: "Apply battle tactics to assault, defence, breach, sortie, and reserve sequencing.",
      },
    ] as const;

    for (const probe of probes) {
      const base = structuredClone(document.skills[3]!);
      base.id = probe.baseId;
      base.name = probe.baseName;
      base.description = `A non-canonical conformance probe for the ${probe.baseName} task foundation.`;
      base.taskEnvelope.coreTasks = [probe.task];
      document.skills.push(base);

      const specialization = structuredClone(document.specializations[0]!);
      specialization.id = probe.specializationId;
      specialization.name = probe.specializationName;
      specialization.description = `A non-canonical specialization probe rooted in ${probe.baseName}.`;
      specialization.taskEnvelope.coreTasks = [probe.task];
      specialization.basePrerequisiteEdgeIds = [
        `relationship:probe:${probe.baseId.split(":").at(-1)}-prerequisite-${probe.specializationId
          .split(":")
          .at(-1)}`,
      ];
      specialization.transferEdgeIds = [];
      document.specializations.push(specialization);

      const prerequisite = structuredClone(document.relationships[3]!);
      prerequisite.id = specialization.basePrerequisiteEdgeIds[0]!;
      prerequisite.name = `${probe.baseName} prerequisite for ${probe.specializationName}`;
      prerequisite.sourceCompetencyId = base.id;
      prerequisite.targetCompetencyId = specialization.id;
      document.relationships.push(prerequisite);
    }

    expect(validateSkillCatalogueAuthoringDocument(document)).toMatchObject({
      diagnostics: [],
      valid: true,
    });
    expect(
      document.specializations.slice(-probes.length).map((specialization) => ({
        name: specialization.name,
        transferEdgeIds: specialization.transferEdgeIds,
      })),
    ).toEqual(probes.map((probe) => ({ name: probe.specializationName, transferEdgeIds: [] })));
  });

  it("accepts either explicitly authored transfer direction without synthesizing a reverse edge", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const specialization = document.specializations[0]!;
    const transfer = document.relationships.find(
      (relationship) => relationship.id === specialization.transferEdgeIds[0],
    )!;
    const relationshipCount = document.relationships.length;

    transfer.sourceCompetencyId = specialization.id;
    transfer.targetCompetencyId = "skill:proposal:surgery";

    expect(validateSkillCatalogueAuthoringDocument(document)).toMatchObject({
      diagnostics: [],
      valid: true,
    });
    expect(document.relationships).toHaveLength(relationshipCount);
    expect(transfer).toMatchObject({
      direction: "source-to-target",
      reverseEdge: "not-inferred",
      sourceCompetencyId: specialization.id,
      targetCompetencyId: "skill:proposal:surgery",
    });
  });

  it("allows transfers to any authored base while rejecting unrelated endpoints", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const specialization = document.specializations[0]!;
    const secondBase = structuredClone(document.skills[3]!);
    secondBase.id = "skill:proposal:shipboard-surgery";
    secondBase.name = "Shipboard Surgery";
    document.skills.push(secondBase);

    const secondPrerequisite = structuredClone(document.relationships[3]!);
    secondPrerequisite.id = "relationship:proposal:shipboard-prerequisite-campaign";
    secondPrerequisite.name = "Shipboard Surgery prerequisite for Campaign Wound Surgery";
    secondPrerequisite.sourceCompetencyId = secondBase.id;
    document.relationships.push(secondPrerequisite);
    specialization.basePrerequisiteEdgeIds.push(secondPrerequisite.id);

    const secondTransfer = structuredClone(document.relationships[4]!);
    secondTransfer.id = "relationship:proposal:campaign-transfer-shipboard";
    secondTransfer.name = "Campaign Wound Surgery transfer to Shipboard Surgery";
    secondTransfer.sourceCompetencyId = specialization.id;
    secondTransfer.targetCompetencyId = secondBase.id;
    document.relationships.push(secondTransfer);
    specialization.transferEdgeIds.push(secondTransfer.id);

    expect(validateSkillCatalogueAuthoringDocument(document)).toMatchObject({
      diagnostics: [],
      valid: true,
    });

    secondTransfer.targetCompetencyId = "language:proposal:old-serevan";
    expect(validateSkillCatalogueAuthoringDocument(document).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SPECIALIZATION_INVALID_TRANSFER_EDGE",
          path: "specializations[0].transferEdgeIds",
        }),
      ]),
    );
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

  it("accepts inert text and tradition applicability exception bases", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[1]!;
    const source = profile.overrides[0]!;

    profile.overrides.push(
      {
        ...structuredClone(source),
        attributionId: "text:probe:field-surgery-manual",
        basis: "text",
        competencyId: "skill:proposal:first-aid",
        explanation: "A named text supplies an authored access exception without competence.",
      },
      {
        ...structuredClone(source),
        attributionId: "tradition:probe:campaign-operators",
        basis: "tradition",
        competencyId: "skill:proposal:wayfarers-physic",
        explanation: "A named tradition supplies an authored access exception without competence.",
      },
    );

    expect(validateSkillCatalogueAuthoringDocument(document)).toMatchObject({
      diagnostics: [],
      valid: true,
    });
    expect(profile.overrides.slice(-2).map((override) => override.basis)).toEqual([
      "text",
      "tradition",
    ]);
  });

  it("accepts a first-class domain-scoped DS/AB override without expanding competencies", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[0]!;
    const competencyDefaultCount = profile.defaults.length;
    const competencyOverrideCount = profile.overrides.length;

    profile.domainOverrides.push({
      accessBand: "AB3",
      attributionId: "profile-trait:probe:river-clan-healing-school",
      availability: "restricted",
      basis: "profile",
      domainId: "domain:proposal:healing",
      explanation:
        "This profile varies Healing-domain availability and access without inferring skill entries.",
    });

    expect(validateSkillCatalogueAuthoringDocument(document)).toMatchObject({
      diagnostics: [],
      valid: true,
    });
    expect(profile).toMatchObject({
      developmentStage: "DS2",
      eligibilityEnforcement: "not-implemented",
    });
    expect(profile.defaults).toHaveLength(competencyDefaultCount);
    expect(profile.overrides).toHaveLength(competencyOverrideCount);
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
    ["catalogue:invalid:written-tradition-binding", "WRITTEN_TRADITION_UNKNOWN_LANGUAGE"],
    ["catalogue:invalid:written-tradition-binding", "WRITTEN_TRADITION_UNKNOWN_SCRIPT"],
    ["catalogue:invalid:learning-group", "LEARNING_GROUP_CONTEXT_MISSING"],
    ["catalogue:invalid:learning-group", "LEARNING_GROUP_UNKNOWN_MEMBER"],
    ["catalogue:invalid:applicability", "INVALID_DEVELOPMENT_STAGE"],
    ["catalogue:invalid:applicability", "INVALID_ACCESS_BAND"],
    ["catalogue:invalid:applicability", "APPLICABILITY_DEFAULT_REFERENCE_INVALID"],
    ["catalogue:invalid:applicability", "INVALID_APPLICABILITY_ATTRIBUTION_ID"],
    ["catalogue:invalid:applicability-basis", "APPLICABILITY_OVERRIDE_REFERENCE_INVALID"],
    ["catalogue:invalid:domain-applicability", "INVALID_ACCESS_BAND"],
    ["catalogue:invalid:domain-applicability", "DOMAIN_APPLICABILITY_OVERRIDE_REFERENCE_INVALID"],
    ["catalogue:invalid:undifferentiated-proposal", "AUTHORING_STATUS_OR_PROVENANCE_MISSING"],
    ["catalogue:invalid:live-pricing", "ECONOMIC_WEIGHT_NOT_INERT"],
    ["catalogue:invalid:live-pricing", "LIVE_PRICING_FIELD_FORBIDDEN"],
    ["catalogue:invalid:inferred-mechanics", "AUTHORING_POLICY_RUNTIME_OR_INFERENCE_LEAK"],
    ["catalogue:invalid:inferred-mechanics", "FAMILY_MEMBERSHIP_MECHANICALLY_ACTIVE"],
    ["catalogue:invalid:inferred-mechanics", "RELATIONSHIP_DIRECTION_OR_REVERSE_IMPLIED"],
    ["catalogue:invalid:related-arithmetic", "UNRESOLVED_RELATIONSHIP_ARITHMETIC_FIELD"],
    ["catalogue:invalid:collection-kind-mismatch", "COLLECTION_KIND_MISMATCH"],
    ["catalogue:invalid:specialization-transfer-unrelated", "SPECIALIZATION_INVALID_TRANSFER_EDGE"],
  ])("reports %s with %s", (documentId, code) => {
    expect(diagnosticsByDocument.get(documentId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, documentId })]),
    );
  });

  it.each([
    ["missing", "domain:missing:healing"],
    ["wrong-kind", "skill:proposal:first-aid"],
  ] as const)("rejects a %s domain-scoped applicability target", (_case, domainId) => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[0]!;
    profile.domainOverrides.push({
      accessBand: "AB2",
      attributionId: "profile-trait:invalid:domain-target",
      availability: "restricted",
      basis: "profile",
      domainId,
      explanation: "Negative probe for deterministic domain target validation.",
    });

    const first = validateSkillCatalogueAuthoringDocument(document);
    const second = validateSkillCatalogueAuthoringDocument(structuredClone(document));

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(first.diagnostics).toEqual([
      {
        code: "DOMAIN_APPLICABILITY_OVERRIDE_REFERENCE_INVALID",
        documentId: representativeSkillCatalogueAuthoringDocument.id,
        message: `Domain-scoped applicability override in "${profile.name}" needs a valid domain plus an explicit profile/contact/teacher/institution/biography/text/tradition attribution and explanation.`,
        path: "applicabilityProfiles[0].domainOverrides[0]",
      },
    ]);
  });

  it.each(["missing", "invalid"] as const)(
    "rejects a specialization with %s prerequisite structure even when transfer is omitted",
    (prerequisiteCase) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as Mutable<SkillCatalogueAuthoringDocument>;
      const specialization = document.specializations[0]!;
      specialization.transferEdgeIds = [];

      if (prerequisiteCase === "missing") {
        specialization.basePrerequisiteEdgeIds = [];
      } else {
        const prerequisite = document.relationships[3] as unknown as {
          threshold: { label: string };
        };
        prerequisite.threshold.label = "";
      }

      const diagnostics = validateSkillCatalogueAuthoringDocument(document).diagnostics;
      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code:
              prerequisiteCase === "missing"
                ? "SPECIALIZATION_BASE_PREREQUISITE_MISSING"
                : "PREREQUISITE_THRESHOLD_STRUCTURE_INVALID",
            path:
              prerequisiteCase === "missing"
                ? "specializations[0].basePrerequisiteEdgeIds"
                : "relationships[3].threshold",
          }),
        ]),
      );
      expect(diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "SPECIALIZATION_TRANSFER_SLOT_MISSING" }),
        ]),
      );
    },
  );

  it.each(["domain", "competency"] as const)(
    "rejects unknown %s applicability availability deterministically without mutation",
    (overrideKind) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as Mutable<SkillCatalogueAuthoringDocument>;
      const profile = document.applicabilityProfiles[0]!;

      if (overrideKind === "domain") {
        profile.domainOverrides.push({
          accessBand: "AB2",
          attributionId: "profile-trait:invalid:unknown-availability",
          availability: "sometimes" as "available",
          basis: "profile",
          domainId: "domain:proposal:healing",
          explanation: "Negative probe for the closed applicability availability vocabulary.",
        });
      } else {
        (profile.overrides[0] as unknown as { availability: string }).availability = "sometimes";
      }

      const before = JSON.stringify(document);
      const first = validateSkillCatalogueAuthoringDocument(document);
      const second = validateSkillCatalogueAuthoringDocument(document);

      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(JSON.stringify(document)).toBe(before);
      expect(first.diagnostics).toEqual([
        expect.objectContaining({
          code: "INVALID_APPLICABILITY_AVAILABILITY",
          path:
            overrideKind === "domain"
              ? "applicabilityProfiles[0].domainOverrides[0].availability"
              : "applicabilityProfiles[0].overrides[0].availability",
        }),
      ]);
    },
  );

  it.each(["domain", "competency"] as const)(
    "rejects malformed %s applicability attribution identity deterministically",
    (overrideKind) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as Mutable<SkillCatalogueAuthoringDocument>;
      const profile = document.applicabilityProfiles[0]!;

      if (overrideKind === "domain") {
        profile.domainOverrides.push({
          accessBand: "AB2",
          attributionId: "not namespaced",
          availability: "restricted",
          basis: "profile",
          domainId: "domain:proposal:healing",
          explanation: "Negative probe for stable authored attribution identity validation.",
        });
      } else {
        profile.overrides[0]!.attributionId = "not namespaced";
      }

      const before = JSON.stringify(document);
      const first = validateSkillCatalogueAuthoringDocument(document);
      const second = validateSkillCatalogueAuthoringDocument(document);

      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(JSON.stringify(document)).toBe(before);
      expect(first.diagnostics).toEqual([
        expect.objectContaining({
          code: "INVALID_APPLICABILITY_ATTRIBUTION_ID",
          path:
            overrideKind === "domain"
              ? "applicabilityProfiles[0].domainOverrides[0].attributionId"
              : "applicabilityProfiles[0].overrides[0].attributionId",
        }),
      ]);
    },
  );

  it("rejects exact duplicate domain applicability overrides deterministically", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[0]!;
    const override = {
      accessBand: "AB2" as const,
      attributionId: "profile-trait:invalid:duplicate-domain-override",
      availability: "restricted" as const,
      basis: "profile" as const,
      domainId: "domain:proposal:healing",
      explanation: "Negative probe for duplicate domain override identity validation.",
    };
    profile.domainOverrides.push(structuredClone(override), structuredClone(override));

    const before = JSON.stringify(document);
    const first = validateSkillCatalogueAuthoringDocument(document);
    const second = validateSkillCatalogueAuthoringDocument(document);

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(JSON.stringify(document)).toBe(before);
    expect(first.diagnostics).toEqual([
      expect.objectContaining({
        code: "DUPLICATE_DOMAIN_APPLICABILITY_OVERRIDE",
        path: "applicabilityProfiles[0].domainOverrides[1]",
      }),
    ]);
  });

  it("rejects structurally distinct domain overrides sharing one target", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[0]!;
    const override = {
      accessBand: "AB2" as const,
      attributionId: "profile-trait:probe:shared-domain-attribution",
      availability: "restricted" as const,
      basis: "profile" as const,
      domainId: "domain:proposal:healing",
      explanation: "One distinct authored statement sharing a target and attribution.",
    };
    profile.domainOverrides.push(override, {
      ...override,
      explanation: "A second distinct authored statement sharing a target and attribution.",
    });

    const before = JSON.stringify(document);
    const first = validateSkillCatalogueAuthoringDocument(document);
    const second = validateSkillCatalogueAuthoringDocument(document);

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(JSON.stringify(document)).toBe(before);
    expect(first.diagnostics).toEqual([
      expect.objectContaining({
        code: "DUPLICATE_DOMAIN_APPLICABILITY_OVERRIDE",
        path: "applicabilityProfiles[0].domainOverrides[1]",
      }),
    ]);
  });

  it("rejects a second competency override for the same target", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[0]!;
    profile.overrides.push({
      attributionId: "text:invalid:second-surgery-route",
      availability: "restricted",
      basis: "text",
      competencyId: "skill:proposal:surgery",
      explanation: "A structurally distinct second route for the same competency target.",
    });

    const before = JSON.stringify(document);
    const first = validateSkillCatalogueAuthoringDocument(document);
    const second = validateSkillCatalogueAuthoringDocument(document);

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(JSON.stringify(document)).toBe(before);
    expect(first.diagnostics).toEqual([
      expect.objectContaining({
        code: "DUPLICATE_APPLICABILITY_OVERRIDE",
        path: "applicabilityProfiles[0].overrides[1]",
      }),
    ]);
  });

  it("accepts valid neighboring domain and competency override targets", () => {
    const document = structuredClone(
      representativeSkillCatalogueAuthoringDocument,
    ) as Mutable<SkillCatalogueAuthoringDocument>;
    const profile = document.applicabilityProfiles[0]!;
    profile.domainOverrides.push(
      {
        accessBand: "AB2",
        attributionId: "profile-trait:probe:healing-route",
        availability: "restricted",
        basis: "profile",
        domainId: "domain:proposal:healing",
        explanation: "A valid Healing-domain neighbor.",
      },
      {
        accessBand: "AB3",
        attributionId: "institution:probe:language-text-route",
        availability: "available",
        basis: "institution",
        domainId: "domain:proposal:language-text",
        explanation: "A valid Language and Text domain neighbor.",
      },
    );
    profile.overrides.push({
      attributionId: "teacher:probe:first-aid-route",
      availability: "available",
      basis: "teacher",
      competencyId: "skill:proposal:first-aid",
      explanation: "A valid competency neighbor beside the existing Surgery override.",
    });

    const before = JSON.stringify(document);
    expect(validateSkillCatalogueAuthoringDocument(document)).toEqual({
      diagnostics: [],
      documentId: representativeSkillCatalogueAuthoringDocument.id,
      valid: true,
    });
    expect(JSON.stringify(document)).toBe(before);
  });

  it.each([
    ["domainOverrides", "missing", undefined, "DOMAIN_APPLICABILITY_OVERRIDES_INVALID"],
    ["domainOverrides", "null", null, "DOMAIN_APPLICABILITY_OVERRIDES_INVALID"],
    ["domainOverrides", "non-array", "not-an-array", "DOMAIN_APPLICABILITY_OVERRIDES_INVALID"],
    ["overrides", "missing", undefined, "APPLICABILITY_OVERRIDES_INVALID"],
    ["overrides", "null", null, "APPLICABILITY_OVERRIDES_INVALID"],
    ["overrides", "non-array", "not-an-array", "APPLICABILITY_OVERRIDES_INVALID"],
  ] as const)(
    "returns a deterministic diagnostic for %s with %s collection shape",
    (collectionName, _case, value, code) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as unknown as Record<string, unknown>;
      const profiles = document.applicabilityProfiles as Record<string, unknown>[];

      if (value === undefined) {
        delete profiles[0]![collectionName];
      } else {
        profiles[0]![collectionName] = value;
      }

      const before = JSON.stringify(document);
      const first = validateSkillCatalogueAuthoringDocument(
        document as unknown as SkillCatalogueAuthoringDocument,
      );
      const second = validateSkillCatalogueAuthoringDocument(
        document as unknown as SkillCatalogueAuthoringDocument,
      );

      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(JSON.stringify(document)).toBe(before);
      expect(first.diagnostics).toEqual([
        expect.objectContaining({
          code,
          path: `applicabilityProfiles[0].${collectionName}`,
        }),
      ]);
    },
  );

  it.each([
    ["domainOverrides", null, "DOMAIN_APPLICABILITY_OVERRIDE_ENTRY_INVALID"],
    ["domainOverrides", "not-a-record", "DOMAIN_APPLICABILITY_OVERRIDE_ENTRY_INVALID"],
    ["overrides", null, "APPLICABILITY_OVERRIDE_ENTRY_INVALID"],
    ["overrides", "not-a-record", "APPLICABILITY_OVERRIDE_ENTRY_INVALID"],
  ] as const)(
    "returns a deterministic diagnostic for a non-record %s entry",
    (collectionName, value, code) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as unknown as Record<string, unknown>;
      const profiles = document.applicabilityProfiles as Record<string, unknown>[];
      profiles[0]![collectionName] = [value];

      const before = JSON.stringify(document);
      const first = validateSkillCatalogueAuthoringDocument(
        document as unknown as SkillCatalogueAuthoringDocument,
      );
      const second = validateSkillCatalogueAuthoringDocument(
        document as unknown as SkillCatalogueAuthoringDocument,
      );

      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(JSON.stringify(document)).toBe(before);
      expect(first.diagnostics).toEqual([
        expect.objectContaining({
          code,
          path: `applicabilityProfiles[0].${collectionName}[0]`,
        }),
      ]);
    },
  );

  it.each([
    ["domains", ["domain"], "skill"],
    ["categories", ["category"], "skill"],
    ["skills", ["skill"], "domain"],
    ["specializations", ["specialization"], "skill"],
    ["spokenLanguages", ["spoken-language"], "skill"],
    ["scripts", ["script"], "skill"],
    ["writtenTraditions", ["written-tradition"], "skill"],
    ["families", ["language-family", "script-family"], "skill"],
    ["learningGroups", ["learning-group"], "skill"],
    ["relationships", ["inclusion", "prerequisite", "related"], "skill"],
    ["applicabilityProfiles", ["applicability-profile"], "skill"],
  ] as const)(
    "rejects cross-kind runtime records in %s",
    (collectionName, expectedKinds, invalidKind) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as unknown as Record<string, unknown>;
      const collection = document[collectionName] as unknown[];
      const misplacedSkill = structuredClone(
        representativeSkillCatalogueAuthoringDocument.skills[4]!,
      ) as unknown as Record<string, unknown>;
      const recordIndex = collection.length;
      misplacedSkill.id = `skill:invalid:cross-kind-${collectionName.toLowerCase()}`;
      misplacedSkill.name = `Cross-kind ${collectionName} record`;
      misplacedSkill.kind = invalidKind;
      collection.push(misplacedSkill);

      const first = validateSkillCatalogueAuthoringDocument(
        document as unknown as SkillCatalogueAuthoringDocument,
      );
      const second = validateSkillCatalogueAuthoringDocument(
        structuredClone(document) as unknown as SkillCatalogueAuthoringDocument,
      );

      expect(first.valid).toBe(false);
      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(first.diagnostics).toEqual([
        {
          code: "COLLECTION_KIND_MISMATCH",
          documentId: representativeSkillCatalogueAuthoringDocument.id,
          message: `Authoring collection entry "${collectionName}[${recordIndex}]" must declare ${expectedKinds
            .map((kind) => `kind "${kind}"`)
            .join(" or ")}; received "${invalidKind}".`,
          path: `${collectionName}[${recordIndex}].kind`,
        },
      ]);
    },
  );

  it.each(["blank-label", "invalid-status", "invalid-enforcement"] as const)(
    "does not establish a specialization base from an invalid prerequisite: %s",
    (invalidStructure) => {
      const document = structuredClone(
        representativeSkillCatalogueAuthoringDocument,
      ) as Mutable<SkillCatalogueAuthoringDocument>;
      const prerequisite = document.relationships[3] as unknown as {
        enforcement: string;
        threshold: { label: string; status: string };
      };

      if (invalidStructure === "blank-label") prerequisite.threshold.label = "";
      if (invalidStructure === "invalid-status") prerequisite.threshold.status = "resolved";
      if (invalidStructure === "invalid-enforcement") prerequisite.enforcement = "runtime";

      const first = validateSkillCatalogueAuthoringDocument(document);
      const second = validateSkillCatalogueAuthoringDocument(structuredClone(document));

      expect(first.diagnostics).toEqual(second.diagnostics);
      expect(first.diagnostics.map(({ code, path }) => ({ code, path }))).toEqual([
        {
          code: "PREREQUISITE_THRESHOLD_STRUCTURE_INVALID",
          path: "relationships[3].threshold",
        },
        {
          code: "SPECIALIZATION_INVALID_TRANSFER_EDGE",
          path: "specializations[0].transferEdgeIds",
        },
      ]);
    },
  );

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
