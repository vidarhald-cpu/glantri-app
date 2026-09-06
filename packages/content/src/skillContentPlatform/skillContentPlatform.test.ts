import type { SkillContentRelease } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { sha256 } from "../integrity/canonicalSha256";
import { pilotSkillContentReleaseV1 } from "../pilotSkillContentRelease";
import {
  buildSkillContentRelease,
  computeSkillContentReleaseIntegrity,
  projectSkillContentReleaseForReference,
  validateSkillContentRelease,
} from ".";

const proposalMetadata = {
  provenance: { kind: "proposal", reference: "forgejo:recovery-admin/glantri-app#23" },
  recordVersion: "1",
  status: "proposal",
} as const;
const envelope = {
  coreTasks: ["Assess an injury"],
  limits: ["Does not perform surgery"],
  methods: ["Observation and examination"],
  useGuidance: "Use for diagnosis and non-operative treatment.",
} as const;

const candidateInput = {
  accessExceptions: [
    {
      basis: "teacher",
      competencyIds: ["spec:diagnostic-medicine"],
      explanation: "A named teacher opens this route and grants no competence.",
      grantsCompetence: 0,
      historyIds: ["hist:temple-infirmary"],
      id: "access:teacher-neseret",
      metadata: proposalMetadata,
      profileId: "profile:mogreb",
    },
  ],
  compatibility: {
    characterMigrationReviewRequired: true,
    classification: "migration-review-required",
    rationale: "Candidate structured semantics require review before Character adoption.",
  },
  competencies: [
    {
      description:
        "Medicine covers diagnosis, prognosis, and non-operative treatment within a coherent tradition.",
      domainId: "domain:healing",
      id: "skill:medicine",
      kind: "skill",
      metadata: proposalMetadata,
      name: "Medicine",
      prerequisites: [],
      shortDescription: "Diagnose and treat illness and injury without surgery.",
      shortLabel: "Medicine",
      taskEnvelope: envelope,
      weight: 3,
    },
    {
      description:
        "Spoken Mogrebi represents conversation and oral comprehension; it grants no writing.",
      domainId: "domain:languages-text",
      familyIds: ["language-family:mogrebi"],
      id: "spoken:mogrebi",
      kind: "spoken-language",
      metadata: proposalMetadata,
      name: "Spoken Mogrebi",
      prerequisites: [],
      shortDescription: "Speak and understand Mogrebi.",
      shortLabel: "Mogrebi",
      taskEnvelope: { ...envelope, coreTasks: ["Speak and understand Mogrebi"] },
      weight: 2,
    },
    {
      description:
        "Written Mogrebi binds Mogrebi language, Sacred Mogrebi script, and written conventions.",
      domainId: "domain:languages-text",
      id: "written:mogrebi:sacred-mogrebi",
      kind: "written-tradition",
      metadata: proposalMetadata,
      name: "Written Mogrebi in Sacred Mogrebi",
      prerequisites: [],
      scriptId: "script:sacred-mogrebi",
      shortDescription: "Read and write Mogrebi using the Sacred Mogrebi tradition.",
      shortLabel: "Written Mogrebi",
      spokenLanguageId: "spoken:mogrebi",
      taskEnvelope: { ...envelope, coreTasks: ["Read and write Mogrebi"] },
      weight: 2,
    },
    {
      acquisitionWeight: 1,
      description: "Diagnostic Medicine applies Medicine to difficult differential diagnosis.",
      domainId: "domain:healing",
      id: "spec:diagnostic-medicine",
      kind: "specialization",
      metadata: proposalMetadata,
      name: "Diagnostic Medicine",
      parentCompetencyId: "skill:medicine",
      prerequisites: [{ competencyId: "skill:medicine", threshold: 6 }],
      shortDescription: "Specialized differential diagnosis.",
      shortLabel: "Diagnosis",
      taskEnvelope: { ...envelope, coreTasks: ["Resolve a difficult differential diagnosis"] },
      transfer: { kind: "explicit-relationships", relationshipIds: ["rel:medicine-diagnosis"] },
      weight: 1,
    },
  ],
  contentVersion: "pilot-skills-content/2.0.0-candidate.1",
  domains: [
    {
      description: "Healing practice navigation only.",
      id: "domain:healing",
      kind: "domain",
      mechanics: "none",
      metadata: proposalMetadata,
      name: "Healing & Medicine",
    },
    {
      description: "Language and text navigation only.",
      id: "domain:languages-text",
      kind: "domain",
      mechanics: "none",
      metadata: proposalMetadata,
      name: "Languages & Written Tradition",
    },
  ],
  histories: [
    {
      context: "Temple clinical training.",
      fixedCompetencyIds: ["skill:medicine"],
      id: "hist:temple-infirmary",
      metadata: proposalMetadata,
      name: "Temple Infirmary",
      selectionSlots: [],
    },
  ],
  id: "content-release:pilot-skills:2-candidate-1",
  profiles: [
    {
      accessBand: "AB3",
      developmentStage: "DS3",
      id: "profile:mogreb",
      metadata: proposalMetadata,
      name: "Mogreb",
      normalRoutes: [
        {
          accessBand: "AB3",
          competencyIds: ["skill:medicine", "spoken:mogrebi", "written:mogrebi:sacred-mogrebi"],
          description: "Temple route.",
          id: "route:mogreb-temple",
          metadata: proposalMetadata,
        },
      ],
      overrides: [
        {
          attributionId: "access:teacher-neseret",
          availability: "restricted",
          competencyIds: ["spec:diagnostic-medicine"],
          explanation: "Named teaching route.",
        },
      ],
    },
  ],
  provenance: ["docs/decisions/rules/0003-skill-documentation-and-release-integrity.md"],
  relationships: [
    {
      direction: "source-to-target",
      id: "rel:medicine-diagnosis",
      metadata: proposalMetadata,
      rationale: "Shared diagnostic foundation.",
      sourceCompetencyId: "skill:medicine",
      strength: 50,
      targetCompetencyId: "spec:diagnostic-medicine",
    },
  ],
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: "skill-content-release/v2",
  scripts: [
    {
      description: "Sacred Mogrebi script identity.",
      familyIds: ["script-family:mogrebi"],
      id: "script:sacred-mogrebi",
      kind: "script",
      metadata: proposalMetadata,
      name: "Sacred Mogrebi",
    },
  ],
  status: "proposal",
  title: "Documentation-complete Pilot candidate",
} as const satisfies Omit<SkillContentRelease, "manifest">;

function candidate(): SkillContentRelease {
  return buildSkillContentRelease(structuredClone(candidateInput));
}

describe("documentation-complete Skill content platform", () => {
  it("uses the standard SHA-256 algorithm for release integrity", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("builds a deterministic candidate with package and semantic integrity", () => {
    const first = candidate();
    const second = candidate();
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.packageDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.manifest.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(validateSkillContentRelease(first)).toEqual({
      diagnostics: [],
      releaseId: first.id,
      valid: true,
    });
    expect(computeSkillContentReleaseIntegrity(first)).toEqual({
      packageDigest: first.manifest.packageDigest,
      semanticDigest: first.manifest.semanticDigest,
    });
  });

  it("changes only package integrity for presentation-only edits", () => {
    const original = candidate();
    const input = structuredClone(candidateInput) as unknown as Omit<
      SkillContentRelease,
      "manifest"
    >;
    input.competencies[0].shortLabel = "Med.";
    input.competencies[0].shortDescription = "Diagnose and treat without operative surgery.";
    input.competencies[0].description +=
      " This editorial clarification does not alter the task boundary.";
    input.competencies[3].prerequisites[0]!.justification = "Editorial source explanation.";
    input.histories[0]!.name = "Mogrebi Temple Infirmary";
    input.profiles[0]!.normalRoutes[0]!.description = "Temple and medical-text route.";
    input.profiles[0]!.overrides[0]!.explanation = "Named teaching route for review.";
    input.accessExceptions[0]!.explanation =
      "The named teacher opens the route while granting no competence.";
    const edited = buildSkillContentRelease(input);
    expect(edited.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(edited.manifest.semanticDigest).toBe(original.manifest.semanticDigest);
  });

  it("normalizes presentation ordering out of semantic integrity", () => {
    const original = candidate();
    const input = structuredClone(candidateInput) as unknown as Omit<
      SkillContentRelease,
      "manifest"
    >;
    input.competencies = [...input.competencies].reverse();
    input.domains = [...input.domains].reverse();
    const reordered = buildSkillContentRelease(input);
    expect(reordered.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(reordered.manifest.semanticDigest).toBe(original.manifest.semanticDigest);
    expect(validateSkillContentRelease(reordered).valid).toBe(true);
  });

  it("changes both integrity values for structured mechanical edits", () => {
    const original = candidate();
    const input = structuredClone(candidateInput) as unknown as Omit<
      SkillContentRelease,
      "manifest"
    >;
    input.competencies[0].weight = 2;
    input.competencies[0].taskEnvelope.coreTasks = ["Assess and diagnose an injury"];
    const edited = buildSkillContentRelease(input);
    expect(edited.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(edited.manifest.semanticDigest).not.toBe(original.manifest.semanticDigest);
  });

  it("keeps compatibility classification explicit rather than inferred from digests", () => {
    const release = candidate();
    release.compatibility = {
      characterMigrationReviewRequired: false,
      classification: "presentation-only",
      rationale: "Editorial correction only.",
    };
    const resigned = buildSkillContentRelease({
      ...release,
      compatibility: release.compatibility,
    } as Omit<SkillContentRelease, "manifest">);
    expect(validateSkillContentRelease(resigned).valid).toBe(true);
    const invalid = structuredClone(resigned);
    invalid.compatibility.characterMigrationReviewRequired = true;
    invalid.manifest = { ...invalid.manifest, ...computeSkillContentReleaseIntegrity(invalid) };
    expect(validateSkillContentRelease(invalid).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SKILL_CONTENT_INVALID_COMPATIBILITY" }),
      ]),
    );
  });

  it("validates domain, relationship, prerequisite, script, and language bindings", () => {
    const mutations: Array<[string, (release: SkillContentRelease) => void]> = [
      [
        "SKILL_CONTENT_UNKNOWN_DOMAIN",
        (release) => {
          release.competencies[0]!.domainId = "domain:unknown";
        },
      ],
      [
        "SKILL_CONTENT_UNKNOWN_RELATIONSHIP_ENDPOINT",
        (release) => {
          release.relationships[0]!.sourceCompetencyId = "skill:unknown";
        },
      ],
      [
        "SKILL_CONTENT_UNKNOWN_PREREQUISITE",
        (release) => {
          release.competencies[3]!.prerequisites[0]!.competencyId = "skill:unknown";
        },
      ],
      [
        "SKILL_CONTENT_UNKNOWN_SCRIPT",
        (release) => {
          if (release.competencies[2]!.kind === "written-tradition")
            release.competencies[2]!.scriptId = "script:unknown";
        },
      ],
      [
        "SKILL_CONTENT_INVALID_LANGUAGE_BINDING",
        (release) => {
          if (release.competencies[2]!.kind === "written-tradition")
            release.competencies[2]!.spokenLanguageId = "skill:medicine";
        },
      ],
    ];
    mutations.forEach(([code, mutate]) => {
      const release = candidate();
      mutate(release);
      release.manifest = { ...release.manifest, ...computeSkillContentReleaseIntegrity(release) };
      expect(validateSkillContentRelease(release).diagnostics, code).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    });
  });

  it("validates record provenance, complete task envelopes, and Specialization parents", () => {
    const mutations: Array<[string, (release: SkillContentRelease) => void]> = [
      [
        "SKILL_CONTENT_STATUS_PROVENANCE_MISMATCH",
        (release) => {
          release.domains[0]!.metadata.provenance.kind = "decision";
        },
      ],
      [
        "SKILL_CONTENT_INVALID_SHAPE",
        (release) => {
          release.competencies[0]!.taskEnvelope.limits = [];
        },
      ],
      [
        "SKILL_CONTENT_SPECIALIZATION_PARENT_PREREQUISITE_MISSING",
        (release) => {
          release.competencies[3]!.prerequisites = [];
        },
      ],
    ];
    mutations.forEach(([code, mutate]) => {
      const release = candidate();
      mutate(release);
      release.manifest = { ...release.manifest, ...computeSkillContentReleaseIntegrity(release) };
      expect(validateSkillContentRelease(release).diagnostics, code).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    });
  });

  it("rejects a zero-transfer declaration that contradicts an authored parent edge", () => {
    const contradictory = candidate();
    const specialization = contradictory.competencies[3]!;
    expect(specialization.kind).toBe("specialization");
    if (specialization.kind !== "specialization") return;
    specialization.transfer = {
      kind: "zero-transfer",
      rationale: "This declaration contradicts the authored relationship edge.",
    };
    contradictory.manifest = {
      ...contradictory.manifest,
      ...computeSkillContentReleaseIntegrity(contradictory),
    };
    expect(validateSkillContentRelease(contradictory).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_CONTRADICTORY_SPECIALIZATION_TRANSFER",
          path: "competencies[3].transfer",
        }),
      ]),
    );

    const zeroTransfer = candidate();
    const zeroTransferSpecialization = zeroTransfer.competencies[3]!;
    expect(zeroTransferSpecialization.kind).toBe("specialization");
    if (zeroTransferSpecialization.kind !== "specialization") return;
    zeroTransferSpecialization.transfer = {
      kind: "zero-transfer",
      rationale: "No parent-to-Specialization relationship is authored.",
    };
    zeroTransfer.relationships = [];
    zeroTransfer.manifest.counts.relationships = 0;
    zeroTransfer.manifest = {
      ...zeroTransfer.manifest,
      ...computeSkillContentReleaseIntegrity(zeroTransfer),
    };
    expect(validateSkillContentRelease(zeroTransfer).valid).toBe(true);
  });

  it("requires justification only for nonstandard prerequisite thresholds", () => {
    const unexplained = candidate();
    unexplained.competencies[3]!.prerequisites[0]!.threshold = 7;
    unexplained.manifest = {
      ...unexplained.manifest,
      ...computeSkillContentReleaseIntegrity(unexplained),
    };
    expect(validateSkillContentRelease(unexplained).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_NONSTANDARD_PREREQUISITE_JUSTIFICATION_REQUIRED",
          path: "competencies[3].prerequisites[0].justification",
        }),
      ]),
    );

    const explained = candidate();
    explained.competencies[3]!.prerequisites[0]!.justification =
      "This narrow diagnostic practice is taught after seven acquired ranks.";
    explained.competencies[3]!.prerequisites[0]!.threshold = 7;
    explained.manifest = {
      ...explained.manifest,
      ...computeSkillContentReleaseIntegrity(explained),
    };
    expect(validateSkillContentRelease(explained).valid).toBe(true);
  });

  it("requires substantive competency presentation fields with deterministic diagnostics", () => {
    const mutations: Array<[string, string, (release: SkillContentRelease) => void]> = [
      [
        "competencies[0].name",
        "Competency name must contain at least 2 characters.",
        (release) => (release.competencies[0]!.name = "M"),
      ],
      [
        "competencies[0].shortLabel",
        "Competency short label must contain at least 2 characters.",
        (release) => (release.competencies[0]!.shortLabel = "M"),
      ],
      [
        "competencies[0].shortDescription",
        "Competency short description must contain at least 12 characters.",
        (release) => (release.competencies[0]!.shortDescription = "M"),
      ],
      [
        "competencies[0].description",
        "Competency description must contain at least 40 characters.",
        (release) => (release.competencies[0]!.description = "M"),
      ],
    ];
    mutations.forEach(([path, message, mutate]) => {
      const release = candidate();
      mutate(release);
      release.manifest = { ...release.manifest, ...computeSkillContentReleaseIntegrity(release) };
      expect(validateSkillContentRelease(release).diagnostics, path).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "SKILL_CONTENT_INVALID_SHAPE", message, path }),
        ]),
      );
    });

    const boundary = candidate();
    boundary.competencies[0]!.name = "Me";
    boundary.competencies[0]!.shortLabel = "Rx";
    boundary.competencies[0]!.shortDescription = "x".repeat(12);
    boundary.competencies[0]!.description = "x".repeat(40);
    boundary.manifest = {
      ...boundary.manifest,
      ...computeSkillContentReleaseIntegrity(boundary),
    };
    expect(validateSkillContentRelease(boundary).valid).toBe(true);
  });

  it("rejects duplicate IDs, targets, relationship edges, and impossible history choices", () => {
    const mutations: Array<[string, (release: SkillContentRelease) => void]> = [
      [
        "SKILL_CONTENT_DUPLICATE_ID",
        (release) => {
          release.profiles[0]!.normalRoutes[0]!.id = release.domains[0]!.id;
        },
      ],
      [
        "SKILL_CONTENT_DUPLICATE_TARGET",
        (release) => {
          release.accessExceptions[0]!.competencyIds = [
            "spec:diagnostic-medicine",
            "spec:diagnostic-medicine",
          ];
        },
      ],
      [
        "SKILL_CONTENT_DUPLICATE_RELATIONSHIP_EDGE",
        (release) => {
          release.relationships = [
            ...release.relationships,
            {
              ...structuredClone(release.relationships[0]!),
              id: "rel:medicine-diagnosis-copy",
            },
          ];
        },
      ],
      [
        "SKILL_CONTENT_INVALID_SELECTION_SLOT",
        (release) => {
          release.histories[0]!.selectionSlots = [
            {
              candidateCompetencyIds: ["skill:medicine"],
              chooseCount: 2,
              id: "slot:impossible-choice",
              label: "Impossible choice",
            },
          ];
        },
      ],
    ];
    mutations.forEach(([code, mutate]) => {
      const release = candidate();
      mutate(release);
      release.manifest = { ...release.manifest, ...computeSkillContentReleaseIntegrity(release) };
      expect(validateSkillContentRelease(release).diagnostics, code).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    });
  });

  it("projects proposal and canonical releases for read-only Admin consumption", () => {
    const release = candidate();
    const projection = projectSkillContentReleaseForReference(release);
    expect(projection).toMatchObject({
      compatibility: release.compatibility,
      id: release.id,
      provenance: release.provenance,
      rulesVersion: "pilot-skill-rules/v1",
      schemaVersion: "skill-content-release/v2",
      status: "proposal",
      records: {
        accessExceptions: expect.any(Array),
        competencies: expect.any(Array),
        domains: expect.any(Array),
        scripts: expect.any(Array),
      },
    });
    expect(
      projection.records.competencies.find(({ kind }) => kind === "specialization"),
    ).toMatchObject({ domainId: "domain:healing", parentCompetencyId: "skill:medicine" });
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.records.competencies[0]!.metadata)).toBe(true);
    release.competencies[0]!.name = "Changed after projection";
    expect(projection.records.competencies[0]!.name).toBe("Medicine");

    const canonical = candidate();
    canonical.status = "canonical";
    const metadataRecords = [
      ...canonical.domains,
      ...canonical.scripts,
      ...canonical.competencies,
      ...canonical.histories,
      ...canonical.profiles,
      ...canonical.profiles.flatMap(({ normalRoutes }) => normalRoutes),
      ...canonical.relationships,
      ...canonical.accessExceptions,
    ];
    metadataRecords.forEach((record) => {
      record.metadata = {
        provenance: { kind: "decision", reference: "docs/decisions/rules/0003" },
        recordVersion: "1",
        status: "canonical",
      };
    });
    canonical.manifest = {
      ...canonical.manifest,
      ...computeSkillContentReleaseIntegrity(canonical),
    };
    expect(validateSkillContentRelease(canonical).valid).toBe(true);
    expect(projectSkillContentReleaseForReference(canonical).status).toBe("canonical");

    const mixedStatusCandidate = candidate();
    mixedStatusCandidate.domains[0]!.metadata = {
      provenance: { kind: "evidence", reference: "source:healing-domain" },
      recordVersion: "1",
      status: "evidence",
    };
    mixedStatusCandidate.domains[1]!.metadata = {
      provenance: { kind: "legacy", reference: "legacy:language-domain" },
      recordVersion: "1",
      status: "legacy",
    };
    mixedStatusCandidate.manifest = {
      ...mixedStatusCandidate.manifest,
      ...computeSkillContentReleaseIntegrity(mixedStatusCandidate),
    };
    expect(validateSkillContentRelease(mixedStatusCandidate).valid).toBe(true);
  });

  it("does not mutate or reinterpret the accepted 1.0.1 release", () => {
    expect(pilotSkillContentReleaseV1).toMatchObject({
      id: "content-release:pilot-skills:1",
      contentVersion: "pilot-skills-content/1.0.1",
      schemaVersion: "pilot-skill-content-release/v1",
    });
    expect(pilotSkillContentReleaseV1.manifest.payloadDigest).toBe(
      "sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419",
    );
  });
});
