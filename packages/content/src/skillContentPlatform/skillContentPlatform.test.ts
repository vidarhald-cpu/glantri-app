import type { SkillContentRelease, SkillContentWrittenTraditionRecord } from "@glantri/domain";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { sha256 } from "../integrity/canonicalSha256";
import { pilotSkillContentReleaseV1 } from "../pilotSkillContentRelease";
import {
  buildSkillContentRelease,
  computeSkillContentReleaseIntegrity,
  projectSkillContentReleaseForReference,
  validateSkillContentRelease,
} from ".";
import { pilotSkillContentReleaseProposalInput } from "./pilotSkillContentReleaseProposal";

const repositoryRoot = path.resolve(__dirname, "..", "..", "..", "..");

function candidate(): SkillContentRelease {
  return buildSkillContentRelease(structuredClone(pilotSkillContentReleaseProposalInput));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTaskText(
  releaseRecord: (typeof pilotSkillContentReleaseProposalInput.competencies)[number],
  text: string,
): string {
  return normalizeWhitespace(text)
    .replace(new RegExp(escapeRegExp(releaseRecord.id), "gi"), "")
    .replace(new RegExp(escapeRegExp(releaseRecord.description), "gi"), "")
    .replace(new RegExp(escapeRegExp(releaseRecord.shortDescription), "gi"), "")
    .replace(new RegExp(escapeRegExp(releaseRecord.shortLabel), "gi"), "")
    .replace(new RegExp(escapeRegExp(releaseRecord.name), "gi"), "")
    .replace(
      /\b(?:skill|spec|written|spoken|hist|rel|access|route|profile|domain|script|language):[a-z0-9-']+/gi,
      "",
    )
    .replace(
      /\b(?:name|core|specialization|transfer|history|prerequisite|path|scope|limits|methods|guidance)\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAdversarialTaskText(
  releaseRecord: (typeof pilotSkillContentReleaseProposalInput.competencies)[number],
  text: string,
): string {
  const normalized = normalizeTaskText(releaseRecord, text).toLowerCase();
  const commonTokens = new Set([
    ...releaseRecord.description.toLowerCase().split(/\W+/),
    ...releaseRecord.shortDescription.toLowerCase().split(/\W+/),
  ]);
  let scrubbed = normalized;
  for (const token of commonTokens) {
    if (token.length <= 4) continue;
    if (/^[a-z-']+$/.test(token)) {
      scrubbed = scrubbed.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "g"), "");
    }
  }
  const suffixTokens = releaseRecord.id
    .split(":")
    .flatMap((segment) => segment.split("-"))
    .filter((token) => token.length > 3);
  for (const token of suffixTokens) {
    scrubbed = scrubbed.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "g"), "");
  }
  return normalizeWhitespace(scrubbed);
}

function resolveProvenancePath(reference: string): { path: string; line: number; lines: string[] } {
  const match =
    /^http:\/\/127\.0\.0\.1:3001\/recovery-admin\/glantri-app\/src\/commit\/([0-9a-f]{40})\/(.+?)#L([0-9]+)$/.exec(
      reference,
    );
  if (!match) {
    throw new Error(`Malformed provenance reference ${reference}`);
  }
  const [, sourceRevision, rawPath, rawLine] = match;
  const absolutePath = path.resolve(repositoryRoot, rawPath);
  const source = execFileSync("git", ["show", `${sourceRevision}:${rawPath}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const lines = source.split(/\r?\n/);
  const line = Number(rawLine);
  if (!Number.isFinite(line) || line <= 0 || line > lines.length) {
    throw new Error(`Invalid provenance line ${rawLine} for ${reference}`);
  }
  return { path: absolutePath, line, lines };
}

type MetadataRecord = {
  id: string;
  metadata: {
    provenance: {
      reference: string;
    };
  };
};

function hasMetadataRecord(value: unknown): value is MetadataRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string" &&
    "metadata" in value &&
    typeof (value as { metadata?: unknown }).metadata === "object" &&
    (value as { metadata?: { provenance?: unknown } }).metadata !== null &&
    "provenance" in ((value as { metadata?: { provenance?: unknown } }).metadata ?? {}) &&
    typeof (value as { metadata?: { provenance?: { reference?: unknown } } }).metadata?.provenance
      ?.reference === "string"
  );
}

function collectMetadataRecords(release: SkillContentRelease): readonly MetadataRecord[] {
  const metadataRecords: MetadataRecord[] = [
    ...release.domains,
    ...release.scripts,
    ...release.competencies,
    ...release.histories,
    ...release.profiles,
    ...release.relationships,
    ...release.accessExceptions,
    ...release.profiles.flatMap((profile) => profile.normalRoutes),
  ];
  release.profiles
    .flatMap((profile) => profile.overrides)
    .forEach((record) => {
      if (hasMetadataRecord(record)) {
        metadataRecords.push(record);
      }
    });
  return metadataRecords;
}

function specializationIndex(release: SkillContentRelease): number {
  const index = release.competencies.findIndex((record) => record.kind === "specialization");
  if (index < 0) throw new Error("No specialization competency found in release fixture");
  return index;
}

function writtenTraditionIndex(release: SkillContentRelease): number {
  const index = release.competencies.findIndex((record) => record.kind === "written-tradition");
  if (index < 0) throw new Error("No written-tradition competency found in release fixture");
  return index;
}

function profileWithOverrideIndex(release: SkillContentRelease): number {
  const index = release.profiles.findIndex((record) => record.overrides.length > 0);
  if (index < 0) throw new Error("No profile with overrides found in release fixture");
  return index;
}

function profileWithOverrideAttributionIndex(
  release: SkillContentRelease,
  attributionId: string,
): number {
  const index = release.profiles.findIndex((record) =>
    record.overrides.some(
      ({ attributionId: candidateAttributionId }) => candidateAttributionId === attributionId,
    ),
  );
  if (index < 0)
    throw new Error(`No profile with override attribution ${attributionId} found in fixture`);
  return index;
}

function explicitTransferSpecializationIndex(release: SkillContentRelease): number {
  const index = release.competencies.findIndex(
    (record) =>
      record.kind === "specialization" && record.transfer.kind === "explicit-relationships",
  );
  if (index < 0)
    throw new Error("No specialization with explicit transfer found in release fixture");
  return index;
}

function competencyById(
  release: SkillContentRelease,
  id: string,
): (typeof release.competencies)[number] | undefined {
  return release.competencies.find((record) => record.id === id);
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

  it("uses resolvable issue and authority references", () => {
    const release = candidate();
    expect(release.provenance).toEqual(
      expect.arrayContaining([
        "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25",
        "http://127.0.0.1:3001/recovery-admin/glantri-app/pulls/64",
        "docs/decisions/rules/0002-skill-catalogue-qualitative-architecture.md",
        "docs/decisions/rules/0003-skill-documentation-and-release-integrity.md",
        "docs/rules/pilot-skill-rules-v1.md",
        "docs/rules/pilot-skill-content-release-v1.md",
      ]),
    );
    expect(release.provenance).toEqual(
      expect.arrayContaining([
        "docs/process/task-contract.md",
        "docs/rules/pilot-skill-rules-v1.md",
      ]),
    );
    expect(release.compatibility.classification).toBe("mechanically-compatible");
    expect(
      release.provenance.some((entry) => entry.startsWith("docs/process/recovery-legacy/")),
    ).toBe(false);
  });

  it("changes only package integrity for presentation-only edits", () => {
    const original = candidate();
    const input = structuredClone(candidate());
    const profileOverrideIndex = profileWithOverrideIndex(input);
    input.competencies[0].shortLabel = "Med.";
    input.competencies[0].shortDescription = "Diagnose and treat without operative surgery.";
    input.competencies[0].description +=
      " This editorial clarification does not alter the task boundary.";
    input.competencies[specializationIndex(input)]!.prerequisites[0]!.justification =
      "Editorial source explanation.";
    input.histories[0]!.name = "Mogrebi Temple Infirmary";
    input.profiles[0]!.normalRoutes[0]!.description = "Temple and medical-text route.";
    input.profiles[profileOverrideIndex]!.overrides[0]!.explanation =
      "Named teaching route for review.";
    input.accessExceptions[0]!.explanation =
      "The named teacher opens the route while granting no competence.";
    const edited = buildSkillContentRelease(input);
    expect(edited.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(edited.manifest.semanticDigest).toBe(original.manifest.semanticDigest);
  });

  it("normalizes presentation ordering out of semantic integrity", () => {
    const original = candidate();
    const input = structuredClone(candidate());
    input.competencies = [...input.competencies].reverse();
    input.domains = [...input.domains].reverse();
    const reordered = buildSkillContentRelease(input);
    expect(reordered.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(reordered.manifest.semanticDigest).toBe(original.manifest.semanticDigest);
    expect(validateSkillContentRelease(reordered).valid).toBe(true);
  });

  it("changes both integrity values for structured mechanical edits", () => {
    const original = candidate();
    const input = structuredClone(candidate());
    input.competencies[0].weight = 2;
    input.competencies[0].taskEnvelope.coreTasks = ["Assess and diagnose an injury"];
    const edited = buildSkillContentRelease(input);
    expect(edited.manifest.packageDigest).not.toBe(original.manifest.packageDigest);
    expect(edited.manifest.semanticDigest).not.toBe(original.manifest.semanticDigest);
  });

  it("repairs accepted access semantics and specificity boundaries", () => {
    const release = candidate();
    const copperLatch = release.accessExceptions.find(
      ({ id }) => id === "access:iest-contact-copper-latch",
    );
    expect(copperLatch).toBeDefined();
    expect(copperLatch?.competencyIds).toHaveLength(0);
    expect(copperLatch?.historyIds).toContain("hist:iest-night-entry-crew");

    const iestProfile = release.profiles.find(({ id }) => id === "profile:iest-commercial-city");
    expect(iestProfile).toBeDefined();
    expect(
      iestProfile?.normalRoutes.some((route) => route.id === "route:iest-night-entry-crew"),
    ).toBe(false);
    expect(
      iestProfile?.normalRoutes.every(
        ({ competencyIds }) => !competencyIds.includes("skill:lockpicking"),
      ),
    ).toBe(true);

    const scythian = release.profiles.find(({ id }) => id === "profile:scythian-pastoral-clan");
    expect(scythian).toBeDefined();
    expect(scythian?.normalRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "route:scythian-olog-unavailable",
          competencyIds: expect.arrayContaining([
            "skill:law:olog-princely",
            "spec:court-administration",
          ]),
        }),
      ]),
    );
    const scythianUnavailability = scythian?.overrides.find(
      ({ attributionId }) => attributionId === "route:scythian-olog-unavailable",
    );
    expect(scythianUnavailability).toMatchObject({
      availability: "unavailable",
      competencyIds: expect.arrayContaining([
        "skill:law:olog-princely",
        "spec:court-administration",
      ]),
    });
    const report = validateSkillContentRelease(release);
    expect(report.valid).toBe(true);
  });

  it("enforces authored task envelopes, anti-boilerplate content, and deep-clone boundaries", () => {
    const release = candidate();
    expect(release.competencies).toHaveLength(61);
    expect(
      release.competencies.every(
        (record) =>
          record.description.length >= 40 && !/Bounded pilot practice:/i.test(record.description),
      ),
    ).toBe(true);
    const normalizedEnvelopeSignatures = release.competencies.map((record) =>
      normalizeAdversarialTaskText(
        record,
        [
          ...record.taskEnvelope.coreTasks,
          ...record.taskEnvelope.limits,
          ...record.taskEnvelope.methods,
          record.taskEnvelope.useGuidance,
        ].join(" "),
      ),
    );
    expect(new Set(normalizedEnvelopeSignatures).size).toBe(release.competencies.length);
    expect(
      release.competencies
        .filter(
          (record) =>
            !record.taskEnvelope.coreTasks.every((entry) => entry.length >= 20) ||
            !record.taskEnvelope.limits.every((entry) => entry.length >= 20) ||
            !record.taskEnvelope.methods.every((entry) => entry.length >= 20) ||
            record.taskEnvelope.useGuidance.length < 65 ||
            !record.taskEnvelope.methods.some((entry) => /Failure mode/i.test(entry)),
        )
        .map((record) => record.id),
    ).toEqual([]);
    expect(release.competencies.every((record) => record.taskEnvelope.methods.length > 0)).toBe(
      true,
    );
    expect(
      release.competencies.every(
        (record) =>
          record.description.length >= 40 &&
          record.shortDescription.length >= 10 &&
          !/This competency is fully documented/i.test(record.shortDescription),
      ),
    ).toBe(true);
    expect(release.competencies[0]!.taskEnvelope.coreTasks).toHaveLength(1);
    expect(release.competencies[0]!.taskEnvelope.methods).toHaveLength(2);

    const baseHistorySlot = pilotSkillContentReleaseV1.histories[0]!.selectionSlots[0]!;
    const baseProfileRoute = pilotSkillContentReleaseV1.profiles[0]!.normalRoutes[0]!;
    const baseSpecialization = pilotSkillContentReleaseV1.specializations.find(
      ({ id }) => id === "spec:diagnostic-medicine",
    );
    const mutated = candidate();
    (mutated.histories[0]!.selectionSlots[0]!.candidateCompetencyIds as string[]).push(
      "skill:medicine",
    );
    (mutated.profiles[0]!.normalRoutes[0]!.competencyIds as string[]).push("skill:medicine");
    const diagnosticSpecialization = competencyById(mutated, "spec:diagnostic-medicine")!;
    if (diagnosticSpecialization.kind === "specialization") {
      diagnosticSpecialization.prerequisites[0]!.competencyId = "skill:surgery";
    }
    expect(baseHistorySlot.candidateCompetencyIds).not.toContain("skill:medicine");
    expect(baseProfileRoute.competencyIds).not.toContain("skill:medicine");
    expect(baseSpecialization).toBeDefined();
    if (baseSpecialization) {
      expect(baseSpecialization.prerequisites[0]!.competencyId).not.toBe("skill:surgery");
    }
  });

  it("enforces per-record provenance resolution over shared issue-level URLs", () => {
    const release = candidate();
    const metadataRecords = collectMetadataRecords(release);
    expect(metadataRecords.length).toBeGreaterThan(20);
    const references = metadataRecords.map((record) => record.metadata.provenance.reference);
    const malformed = references.filter(
      (reference) =>
        !/^http:\/\/127\.0\.0\.1:3001\/recovery-admin\/glantri-app\/src\/commit\/[0-9a-f]{40}\/[^#]+#L\d+$/.test(
          reference,
        ),
    );
    expect(malformed).toHaveLength(0);
    expect(references.every((reference) => !reference.includes("/src/branch/dev/"))).toBe(true);
    const duplicateReferences = [...new Set(references)]
      .filter((reference) => references.filter((candidate) => candidate === reference).length > 1)
      .map((reference) => ({
        reference,
        count: references.filter((candidate) => candidate === reference).length,
      }));
    expect(duplicateReferences).toEqual([]);
    for (const reference of references) {
      const resolved = resolveProvenancePath(reference);
      const metadataRecord = metadataRecords.find(
        (record) => record.metadata.provenance.reference === reference,
      );
      expect(metadataRecord).toBeDefined();
      if (!metadataRecord) continue;
      expect(resolved.lines.join("\n")).toContain(`"${metadataRecord.id}"`);
    }
    expect(references.every((reference) => !reference.includes("/issues/"))).toBe(true);
    expect(references.every((reference) => !reference.includes("/pulls/"))).toBe(true);
  });

  it("rejects proposal-source fallback task-envelope generation", () => {
    const proposalSource = readFileSync(
      path.resolve(
        repositoryRoot,
        "packages/content/src/skillContentPlatform/pilotSkillContentReleaseProposal.ts",
      ),
      "utf8",
    );
    expect(proposalSource).not.toMatch(/\bbuild(?:Shared|Record)?TaskEnvelope\b/);
    expect(proposalSource).not.toMatch(/fallback\s+task\s+envelope/i);
    expect(proposalSource.match(/generated common envelope/i)).toBeNull();
  });

  it("prevents proposal-input mutation from reusing immutable v1 nested arrays", () => {
    const proposalInput = structuredClone(pilotSkillContentReleaseProposalInput);
    const baseHistorySlot = pilotSkillContentReleaseV1.histories[0]!.selectionSlots[0]!;
    const baseProfileRoute = pilotSkillContentReleaseV1.profiles[0]!.normalRoutes[0]!;
    const baseSpecialization = pilotSkillContentReleaseV1.specializations.find(
      ({ id }) => id === "spec:diagnostic-medicine",
    );
    expect(baseSpecialization).toBeDefined();
    if (!baseSpecialization) return;

    const mutableHistory = proposalInput.histories.find(
      ({ id }) => id === "hist:glantri-household-retainer-service",
    );
    expect(mutableHistory).toBeDefined();
    if (!mutableHistory || !mutableHistory.selectionSlots[0]) return;
    const mutableProfile = proposalInput.profiles[0];
    expect(mutableProfile).toBeDefined();
    if (!mutableProfile || !mutableProfile.normalRoutes[0]) return;
    const mutableSpecialization = proposalInput.competencies.find(
      ({ id }) => id === "spec:diagnostic-medicine",
    );
    expect(mutableSpecialization).toBeDefined();
    if (mutableSpecialization?.kind !== "specialization") return;

    (mutableHistory.selectionSlots[0].candidateCompetencyIds as string[]).push("skill:medicine");
    (mutableProfile.normalRoutes[0].competencyIds as string[]).push("skill:medicine");
    if (mutableSpecialization.transfer.kind === "explicit-relationships") {
      (mutableSpecialization.transfer.relationshipIds as string[]).push(
        "rel:diagnostic-medicine:test",
      );
    }
    mutableSpecialization.prerequisites[0]!.competencyId = "skill:surgery";

    expect(baseHistorySlot.candidateCompetencyIds).not.toContain("skill:medicine");
    expect(baseProfileRoute.competencyIds).not.toContain("skill:medicine");
    if (baseSpecialization.kind === "specialization") {
      if (baseSpecialization.transfer.kind === "explicit-relationships") {
        expect(
          (
            baseSpecialization as (typeof pilotSkillContentReleaseV1.specializations)[number] & {
              transfer: { relationshipIds: readonly string[] };
            }
          ).transfer.relationshipIds,
        ).not.toContain("rel:diagnostic-medicine:test");
      }
      expect(baseSpecialization.prerequisites[0]!.competencyId).not.toBe("skill:surgery");
    }
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
          release.competencies[specializationIndex(release)]!.prerequisites[0]!.competencyId =
            "skill:unknown";
        },
      ],
      [
        "SKILL_CONTENT_UNKNOWN_SCRIPT",
        (release) => {
          const index = writtenTraditionIndex(release);
          (release.competencies[index]! as SkillContentWrittenTraditionRecord).scriptId =
            "script:unknown";
        },
      ],
      [
        "SKILL_CONTENT_INVALID_LANGUAGE_BINDING",
        (release) => {
          const index = writtenTraditionIndex(release);
          (release.competencies[index]! as SkillContentWrittenTraditionRecord).spokenLanguageId =
            "skill:medicine";
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

  it("resolves profile override attribution against the same-profile authored source scope", () => {
    expect(validateSkillContentRelease(candidate()).valid).toBe(true);

    const routeAttributed = candidate();
    const routeAttributedProfileIndex = profileWithOverrideAttributionIndex(
      routeAttributed,
      "access:mogreb-surgeon-neseret",
    );
    routeAttributed.profiles[routeAttributedProfileIndex]!.overrides[0]!.attributionId =
      "route:mogreb-temple";
    routeAttributed.profiles[routeAttributedProfileIndex]!.overrides[0]!.competencyIds = [
      "skill:medicine",
      "skill:first-aid",
    ];
    routeAttributed.manifest = {
      ...routeAttributed.manifest,
      ...computeSkillContentReleaseIntegrity(routeAttributed),
    };
    expect(validateSkillContentRelease(routeAttributed).valid).toBe(true);

    const unresolved = candidate();
    unresolved.profiles[routeAttributedProfileIndex]!.overrides[0]!.attributionId =
      "source:does-not-exist";
    unresolved.manifest = {
      ...unresolved.manifest,
      ...computeSkillContentReleaseIntegrity(unresolved),
    };
    expect(validateSkillContentRelease(unresolved).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_UNKNOWN_OVERRIDE_ATTRIBUTION",
          path: `profiles[${routeAttributedProfileIndex}].overrides[0].attributionId`,
        }),
      ]),
    );

    const missing = candidate();
    delete (
      missing.profiles[routeAttributedProfileIndex]!.overrides[0] as Partial<{
        attributionId: string;
      }>
    ).attributionId;
    expect(validateSkillContentRelease(missing).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_INVALID_SHAPE",
          path: `profiles[${routeAttributedProfileIndex}].overrides[0].attributionId`,
        }),
      ]),
    );

    const wrongProfile = candidate();
    const wrongProfileAttributionProfileIndex = profileWithOverrideIndex(wrongProfile);
    wrongProfile.profiles = [
      ...wrongProfile.profiles,
      {
        ...structuredClone(wrongProfile.profiles[wrongProfileAttributionProfileIndex]!),
        id: "profile:other",
        name: "Other",
        normalRoutes: [
          {
            ...structuredClone(
              wrongProfile.profiles[wrongProfileAttributionProfileIndex]!.normalRoutes[0]!,
            ),
            id: "route:other-medicine",
            competencyIds: ["skill:medicine"],
          },
        ],
        overrides: [],
      },
    ];
    wrongProfile.profiles[wrongProfileAttributionProfileIndex]!.overrides[0]!.attributionId =
      "route:other-medicine";
    wrongProfile.manifest.counts.profiles = wrongProfile.profiles.length;
    wrongProfile.manifest = {
      ...wrongProfile.manifest,
      ...computeSkillContentReleaseIntegrity(wrongProfile),
    };
    expect(validateSkillContentRelease(wrongProfile).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_OVERRIDE_ATTRIBUTION_PROFILE_MISMATCH",
          path: `profiles[${wrongProfileAttributionProfileIndex}].overrides[0].attributionId`,
        }),
      ]),
    );

    const wrongScope = candidate();
    wrongScope.profiles[routeAttributedProfileIndex]!.overrides[0]!.attributionId =
      "access:mogreb-surgeon-neseret";
    wrongScope.profiles[routeAttributedProfileIndex]!.overrides[0]!.competencyIds = [
      "skill:lockpicking",
    ];
    wrongScope.manifest = {
      ...wrongScope.manifest,
      ...computeSkillContentReleaseIntegrity(wrongScope),
    };
    expect(validateSkillContentRelease(wrongScope).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_OVERRIDE_ATTRIBUTION_SCOPE_MISMATCH",
          path: `profiles[${routeAttributedProfileIndex}].overrides[0].competencyIds[0]`,
        }),
      ]),
    );
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
          release.competencies[specializationIndex(release)]!.prerequisites = [];
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
    const specializationIndexInRelease = explicitTransferSpecializationIndex(contradictory);
    const specialization = contradictory.competencies[specializationIndexInRelease]!;
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
          path: `competencies[${specializationIndexInRelease}].transfer`,
        }),
      ]),
    );

    const zeroTransfer = candidate();
    const zeroTransferSpecializationIndex = specializationIndex(zeroTransfer);
    const zeroTransferSpecialization = zeroTransfer.competencies[zeroTransferSpecializationIndex]!;
    expect(zeroTransferSpecialization.kind).toBe("specialization");
    if (zeroTransferSpecialization.kind !== "specialization") return;
    zeroTransferSpecialization.transfer = {
      kind: "zero-transfer",
      rationale: "No parent-to-Specialization relationship is authored.",
    };
    zeroTransfer.relationships = zeroTransfer.relationships.filter(
      ({ targetCompetencyId }) => targetCompetencyId !== zeroTransferSpecialization.id,
    );
    zeroTransfer.manifest.counts.relationships = zeroTransfer.relationships.length;
    zeroTransfer.manifest = {
      ...zeroTransfer.manifest,
      ...computeSkillContentReleaseIntegrity(zeroTransfer),
    };
    expect(validateSkillContentRelease(zeroTransfer).valid).toBe(true);
  });

  it("requires justification only for nonstandard prerequisite thresholds", () => {
    const unexplained = candidate();
    const targetSpecializationIndex = specializationIndex(unexplained);
    unexplained.competencies[targetSpecializationIndex]!.prerequisites[0]!.threshold = 7;
    unexplained.manifest = {
      ...unexplained.manifest,
      ...computeSkillContentReleaseIntegrity(unexplained),
    };
    expect(validateSkillContentRelease(unexplained).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SKILL_CONTENT_NONSTANDARD_PREREQUISITE_JUSTIFICATION_REQUIRED",
          path: `competencies[${targetSpecializationIndex}].prerequisites[0].justification`,
        }),
      ]),
    );

    const explained = candidate();
    const explainedTargetIndex = specializationIndex(explained);
    explained.competencies[explainedTargetIndex]!.prerequisites[0]!.justification =
      "This narrow diagnostic practice is taught after seven acquired ranks.";
    explained.competencies[explainedTargetIndex]!.prerequisites[0]!.threshold = 7;
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
      projection.records.competencies.find(({ id }) => id === "spec:diagnostic-medicine"),
    ).toMatchObject({
      domainId: "domain:healing",
      id: "spec:diagnostic-medicine",
      parentCompetencyId: "skill:medicine",
    });
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.records.competencies[0]!.metadata)).toBe(true);
    const projectedMedicine = projection.records.competencies.find(
      ({ id }) => id === "skill:medicine",
    )!;
    const mutableMedicine = release.competencies.find(({ id }) => id === "skill:medicine")!;
    mutableMedicine.name = "Changed after projection";
    expect(projectedMedicine.name).toBe("Medicine");

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
