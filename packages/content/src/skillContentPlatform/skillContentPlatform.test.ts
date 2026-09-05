import type { SkillContentRelease } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { pilotSkillContentReleaseV1 } from "../pilotSkillContentRelease";
import {
  buildSkillContentRelease,
  computeSkillContentReleaseIntegrity,
  projectSkillContentReleaseForReference,
  validateSkillContentRelease,
} from ".";

const decisionMetadata = {
  provenance: { kind: "decision", reference: "docs/decisions/rules/0003" },
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
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
      name: "Healing & Medicine",
    },
    {
      description: "Language and text navigation only.",
      id: "domain:languages-text",
      kind: "domain",
      mechanics: "none",
      metadata: decisionMetadata,
      name: "Languages & Written Tradition",
    },
  ],
  histories: [
    {
      context: "Temple clinical training.",
      fixedCompetencyIds: ["skill:medicine"],
      id: "hist:temple-infirmary",
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
      name: "Mogreb",
      normalRoutes: [
        {
          accessBand: "AB3",
          competencyIds: ["skill:medicine", "spoken:mogrebi", "written:mogrebi:sacred-mogrebi"],
          description: "Temple route.",
          id: "route:mogreb-temple",
          metadata: decisionMetadata,
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
      metadata: decisionMetadata,
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
      metadata: decisionMetadata,
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
    const edited = buildSkillContentRelease(input);
    expect(edited.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(edited.manifest.semanticDigest).toBe(original.manifest.semanticDigest);
  });

  it("changes both integrity values for structured mechanical edits", () => {
    const original = candidate();
    const input = structuredClone(candidateInput) as unknown as Omit<
      SkillContentRelease,
      "manifest"
    >;
    input.competencies[0].weight = 2;
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

  it("projects proposal and canonical releases for read-only Admin consumption", () => {
    const release = candidate();
    const projection = projectSkillContentReleaseForReference(release);
    expect(projection).toMatchObject({
      id: release.id,
      status: "proposal",
      records: {
        competencies: expect.any(Array),
        domains: expect.any(Array),
        scripts: expect.any(Array),
      },
    });
    expect(
      projection.records.competencies.find(({ kind }) => kind === "specialization"),
    ).toMatchObject({ domainId: "domain:healing", parentCompetencyId: "skill:medicine" });
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
