import { z } from "zod";

import {
  SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
  SKILL_CONTENT_RELEASE_SERIALIZATION,
  type SkillContentCompetencyRecord,
  type SkillContentReferenceProjection,
  type SkillContentRelease,
  type SkillContentReleaseManifest,
} from "@glantri/domain";

import { canonicalize, sha256 } from "../integrity/canonicalSha256";

const stableId = z.string().regex(/^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/);
const nonBlank = z.string().trim().min(1);
const metadata = z
  .object({
    recordVersion: nonBlank,
    status: z.enum(["canonical", "proposal", "evidence", "legacy"]),
    provenance: z
      .object({
        kind: z.enum(["decision", "evidence", "legacy", "proposal"]),
        reference: nonBlank,
        note: nonBlank.optional(),
      })
      .strict(),
  })
  .strict();
const taskEnvelope = z
  .object({
    coreTasks: z.array(nonBlank).min(1),
    limits: z.array(nonBlank),
    methods: z.array(nonBlank).min(1),
    useGuidance: nonBlank,
  })
  .strict();
const prerequisite = z
  .object({
    competencyId: stableId,
    justification: nonBlank.optional(),
    threshold: z.number().int().positive(),
  })
  .strict();
const documentation = {
  description: nonBlank,
  name: nonBlank,
  shortDescription: nonBlank,
  shortLabel: nonBlank,
  taskEnvelope,
};
const competencyBase = z.object({
  ...documentation,
  domainId: stableId,
  id: stableId,
  metadata,
  prerequisites: z.array(prerequisite),
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
const competency = z.discriminatedUnion("kind", [
  competencyBase.extend({ kind: z.literal("skill") }).strict(),
  competencyBase
    .extend({ familyIds: z.array(stableId), kind: z.literal("spoken-language") })
    .strict(),
  competencyBase
    .extend({
      kind: z.literal("written-tradition"),
      scriptId: stableId,
      spokenLanguageId: stableId,
    })
    .strict(),
  competencyBase
    .extend({
      acquisitionWeight: z.union([z.literal(1), z.literal(2)]),
      kind: z.literal("specialization"),
      parentCompetencyId: stableId,
      transfer: z.discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("explicit-relationships"),
            relationshipIds: z.array(stableId).min(1),
          })
          .strict(),
        z.object({ kind: z.literal("zero-transfer"), rationale: nonBlank }).strict(),
      ]),
    })
    .strict(),
]);
const domain = z
  .object({
    description: nonBlank,
    id: stableId,
    kind: z.literal("domain"),
    mechanics: z.literal("none"),
    metadata,
    name: nonBlank,
  })
  .strict();
const script = z
  .object({
    description: nonBlank,
    familyIds: z.array(stableId),
    id: stableId,
    kind: z.literal("script"),
    metadata,
    name: nonBlank,
  })
  .strict();
const relationship = z
  .object({
    direction: z.literal("source-to-target"),
    id: stableId,
    metadata,
    rationale: nonBlank,
    sourceCompetencyId: stableId,
    strength: z.union([z.literal(100), z.literal(75), z.literal(50), z.literal(25)]),
    targetCompetencyId: stableId,
  })
  .strict();
const selectionSlot = z
  .object({
    candidateCompetencyIds: z.array(stableId),
    chooseCount: z.number().int().positive(),
    id: stableId,
    label: nonBlank,
  })
  .strict();
const history = z
  .object({
    context: nonBlank,
    fixedCompetencyIds: z.array(stableId),
    id: stableId,
    metadata,
    name: nonBlank,
    selectionSlots: z.array(selectionSlot),
  })
  .strict();
const accessRoute = z
  .object({
    accessBand: z.enum(["AB1", "AB2", "AB3", "AB4"]),
    competencyIds: z.array(stableId),
    description: nonBlank,
    id: stableId,
    metadata,
  })
  .strict();
const profile = z
  .object({
    accessBand: z.enum(["AB1", "AB2", "AB3", "AB4"]),
    developmentStage: z.enum(["DS1", "DS2", "DS3", "DS4", "DS5", "DS6"]),
    id: stableId,
    metadata,
    name: nonBlank,
    normalRoutes: z.array(accessRoute),
    overrides: z.array(
      z
        .object({
          attributionId: stableId,
          availability: z.enum(["available", "restricted", "unavailable"]),
          competencyIds: z.array(stableId),
          explanation: nonBlank,
        })
        .strict(),
    ),
  })
  .strict();
const accessException = z
  .object({
    basis: z.enum([
      "biography",
      "contact",
      "domain",
      "institution",
      "profile",
      "teacher",
      "text",
      "tradition",
    ]),
    competencyIds: z.array(stableId),
    explanation: nonBlank,
    grantsCompetence: z.literal(0),
    historyIds: z.array(stableId),
    id: stableId,
    metadata,
    profileId: stableId,
  })
  .strict();
const manifest = z
  .object({
    counts: z
      .object({
        accessExceptions: z.number().int().nonnegative(),
        competencies: z.number().int().nonnegative(),
        domains: z.number().int().nonnegative(),
        histories: z.number().int().nonnegative(),
        profiles: z.number().int().nonnegative(),
        relationships: z.number().int().nonnegative(),
        scripts: z.number().int().nonnegative(),
      })
      .strict(),
    packageDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    semanticDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    serialization: z.literal(SKILL_CONTENT_RELEASE_SERIALIZATION),
  })
  .strict();
const releaseSchema = z
  .object({
    accessExceptions: z.array(accessException),
    compatibility: z
      .object({
        characterMigrationReviewRequired: z.boolean(),
        classification: z.enum([
          "presentation-only",
          "mechanically-compatible",
          "migration-review-required",
        ]),
        rationale: nonBlank,
      })
      .strict(),
    competencies: z.array(competency),
    contentVersion: nonBlank,
    domains: z.array(domain),
    histories: z.array(history),
    id: stableId,
    manifest,
    profiles: z.array(profile),
    provenance: z.array(nonBlank).min(1),
    relationships: z.array(relationship),
    rulesVersion: nonBlank,
    schemaVersion: z.literal(SKILL_CONTENT_RELEASE_SCHEMA_VERSION),
    scripts: z.array(script),
    status: z.enum(["proposal", "canonical"]),
    title: nonBlank,
  })
  .strict();

export interface SkillContentReleaseDiagnostic {
  code: string;
  message: string;
  path: string;
}

export interface SkillContentReleaseValidation {
  diagnostics: readonly SkillContentReleaseDiagnostic[];
  releaseId: string;
  valid: boolean;
}

function releaseWithoutIntegrity(release: SkillContentRelease): unknown {
  const {
    packageDigest: _packageDigest,
    semanticDigest: _semanticDigest,
    ...manifestFacts
  } = release.manifest;
  return { ...release, manifest: manifestFacts };
}

function semanticCompetency(record: SkillContentCompetencyRecord): unknown {
  const base = {
    domainId: record.domainId,
    id: record.id,
    kind: record.kind,
    prerequisites: record.prerequisites,
    taskEnvelope: record.taskEnvelope,
    weight: record.weight,
  };
  if (record.kind === "spoken-language") return { ...base, familyIds: record.familyIds };
  if (record.kind === "written-tradition") {
    return { ...base, scriptId: record.scriptId, spokenLanguageId: record.spokenLanguageId };
  }
  if (record.kind === "specialization") {
    return {
      ...base,
      acquisitionWeight: record.acquisitionWeight,
      parentCompetencyId: record.parentCompetencyId,
      transfer: record.transfer,
    };
  }
  return base;
}

export function serializeSkillContentPackage(release: SkillContentRelease): string {
  return JSON.stringify(canonicalize(releaseWithoutIntegrity(release)));
}

export function serializeSkillContentSemantics(release: SkillContentRelease): string {
  return JSON.stringify(
    canonicalize({
      accessExceptions: release.accessExceptions,
      competencies: release.competencies.map(semanticCompetency),
      domains: release.domains.map(({ id, kind, mechanics }) => ({ id, kind, mechanics })),
      histories: release.histories.map(({ fixedCompetencyIds, id, selectionSlots }) => ({
        fixedCompetencyIds,
        id,
        selectionSlots,
      })),
      id: release.id,
      profiles: release.profiles,
      relationships: release.relationships.map(
        ({ direction, id, sourceCompetencyId, strength, targetCompetencyId }) => ({
          direction,
          id,
          sourceCompetencyId,
          strength,
          targetCompetencyId,
        }),
      ),
      rulesVersion: release.rulesVersion,
      schemaVersion: release.schemaVersion,
      scripts: release.scripts.map(({ familyIds, id, kind }) => ({ familyIds, id, kind })),
    }),
  );
}

export function computeSkillContentReleaseIntegrity(
  release: SkillContentRelease,
): Pick<SkillContentReleaseManifest, "packageDigest" | "semanticDigest"> {
  return {
    packageDigest: `sha256:${sha256(serializeSkillContentPackage(release))}`,
    semanticDigest: `sha256:${sha256(serializeSkillContentSemantics(release))}`,
  };
}

export function buildSkillContentRelease(
  input: Omit<SkillContentRelease, "manifest">,
): SkillContentRelease {
  const counts = {
    accessExceptions: input.accessExceptions.length,
    competencies: input.competencies.length,
    domains: input.domains.length,
    histories: input.histories.length,
    profiles: input.profiles.length,
    relationships: input.relationships.length,
    scripts: input.scripts.length,
  };
  const provisional = {
    ...input,
    manifest: {
      counts,
      packageDigest: `sha256:${"0".repeat(64)}` as const,
      semanticDigest: `sha256:${"0".repeat(64)}` as const,
      serialization: SKILL_CONTENT_RELEASE_SERIALIZATION,
    },
  } satisfies SkillContentRelease;
  return {
    ...provisional,
    manifest: { ...provisional.manifest, ...computeSkillContentReleaseIntegrity(provisional) },
  };
}

function pathOf(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (result, part) =>
      typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${part}` : part,
    "",
  );
}

export function validateSkillContentRelease(input: unknown): SkillContentReleaseValidation {
  const diagnostics: SkillContentReleaseDiagnostic[] = [];
  const add = (code: string, path: string, message: string) =>
    diagnostics.push({ code, message, path });
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) =>
      add("SKILL_CONTENT_INVALID_SHAPE", pathOf(issue.path), issue.message),
    );
  } else {
    const release = parsed.data as SkillContentRelease;
    const records = [
      ...release.domains,
      ...release.scripts,
      ...release.competencies,
      ...release.histories,
      ...release.profiles,
      ...release.relationships,
      ...release.accessExceptions,
    ];
    const seen = new Set<string>();
    records.forEach((record) => {
      if (seen.has(record.id))
        add("SKILL_CONTENT_DUPLICATE_ID", record.id, `Duplicate stable identity "${record.id}".`);
      seen.add(record.id);
    });
    const domainIds = new Set(release.domains.map(({ id }) => id));
    const scriptIds = new Set(release.scripts.map(({ id }) => id));
    const competencyById = new Map(release.competencies.map((record) => [record.id, record]));
    const historyIds = new Set(release.histories.map(({ id }) => id));
    const relationshipById = new Map(release.relationships.map((record) => [record.id, record]));
    release.competencies.forEach((record, index) => {
      if (!domainIds.has(record.domainId))
        add(
          "SKILL_CONTENT_UNKNOWN_DOMAIN",
          `competencies[${index}].domainId`,
          `Unknown domain "${record.domainId}".`,
        );
      record.prerequisites.forEach(({ competencyId }, prerequisiteIndex) => {
        if (!competencyById.has(competencyId))
          add(
            "SKILL_CONTENT_UNKNOWN_PREREQUISITE",
            `competencies[${index}].prerequisites[${prerequisiteIndex}]`,
            `Unknown prerequisite "${competencyId}".`,
          );
      });
      if (record.kind === "written-tradition") {
        if (!scriptIds.has(record.scriptId))
          add(
            "SKILL_CONTENT_UNKNOWN_SCRIPT",
            `competencies[${index}].scriptId`,
            `Unknown script "${record.scriptId}".`,
          );
        if (competencyById.get(record.spokenLanguageId)?.kind !== "spoken-language")
          add(
            "SKILL_CONTENT_INVALID_LANGUAGE_BINDING",
            `competencies[${index}].spokenLanguageId`,
            `Written tradition must bind a spoken-language identity.`,
          );
      }
      if (record.kind === "specialization") {
        if (competencyById.get(record.parentCompetencyId)?.kind !== "skill")
          add(
            "SKILL_CONTENT_INVALID_SPECIALIZATION_PARENT",
            `competencies[${index}].parentCompetencyId`,
            `Specialization parent must be a concrete Skill.`,
          );
        if (record.transfer.kind === "explicit-relationships") {
          record.transfer.relationshipIds.forEach((relationshipId, relationshipIndex) => {
            const edge = relationshipById.get(relationshipId);
            if (
              !edge ||
              edge.targetCompetencyId !== record.id ||
              edge.sourceCompetencyId !== record.parentCompetencyId
            )
              add(
                "SKILL_CONTENT_INVALID_SPECIALIZATION_TRANSFER",
                `competencies[${index}].transfer.relationshipIds[${relationshipIndex}]`,
                `Transfer edge must connect the declared parent to this Specialization.`,
              );
          });
        }
      }
    });
    release.relationships.forEach((record, index) => {
      if (
        !competencyById.has(record.sourceCompetencyId) ||
        !competencyById.has(record.targetCompetencyId)
      )
        add(
          "SKILL_CONTENT_UNKNOWN_RELATIONSHIP_ENDPOINT",
          `relationships[${index}]`,
          `Relationship must connect known competencies.`,
        );
    });
    release.histories.forEach((record, index) => {
      [
        ...record.fixedCompetencyIds,
        ...record.selectionSlots.flatMap(({ candidateCompetencyIds }) => candidateCompetencyIds),
      ].forEach((id) => {
        if (!competencyById.has(id))
          add(
            "SKILL_CONTENT_UNKNOWN_HISTORY_MEMBER",
            `histories[${index}]`,
            `Unknown history competency "${id}".`,
          );
      });
    });
    release.profiles.forEach((record, index) => {
      [
        ...record.normalRoutes.flatMap(({ competencyIds }) => competencyIds),
        ...record.overrides.flatMap(({ competencyIds }) => competencyIds),
      ].forEach((id) => {
        if (!competencyById.has(id))
          add(
            "SKILL_CONTENT_UNKNOWN_ACCESS_TARGET",
            `profiles[${index}]`,
            `Unknown access target "${id}".`,
          );
      });
    });
    const profileIds = new Set(release.profiles.map(({ id }) => id));
    release.accessExceptions.forEach((record, index) => {
      if (!profileIds.has(record.profileId))
        add(
          "SKILL_CONTENT_UNKNOWN_EXCEPTION_PROFILE",
          `accessExceptions[${index}].profileId`,
          `Unknown profile "${record.profileId}".`,
        );
      record.competencyIds.forEach((id) => {
        if (!competencyById.has(id))
          add(
            "SKILL_CONTENT_UNKNOWN_EXCEPTION_TARGET",
            `accessExceptions[${index}]`,
            `Unknown exception competency "${id}".`,
          );
      });
      record.historyIds.forEach((id) => {
        if (!historyIds.has(id))
          add(
            "SKILL_CONTENT_UNKNOWN_EXCEPTION_HISTORY",
            `accessExceptions[${index}]`,
            `Unknown exception history "${id}".`,
          );
      });
    });
    const expectedCounts = {
      accessExceptions: release.accessExceptions.length,
      competencies: release.competencies.length,
      domains: release.domains.length,
      histories: release.histories.length,
      profiles: release.profiles.length,
      relationships: release.relationships.length,
      scripts: release.scripts.length,
    };
    if (JSON.stringify(release.manifest.counts) !== JSON.stringify(expectedCounts))
      add(
        "SKILL_CONTENT_COUNT_MISMATCH",
        "manifest.counts",
        "Manifest counts do not match release collections.",
      );
    const expectedIntegrity = computeSkillContentReleaseIntegrity(release);
    if (release.manifest.packageDigest !== expectedIntegrity.packageDigest)
      add(
        "SKILL_CONTENT_PACKAGE_DIGEST_MISMATCH",
        "manifest.packageDigest",
        "Package digest does not match the complete release.",
      );
    if (release.manifest.semanticDigest !== expectedIntegrity.semanticDigest)
      add(
        "SKILL_CONTENT_SEMANTIC_DIGEST_MISMATCH",
        "manifest.semanticDigest",
        "Semantic digest does not match structured interpretation facts.",
      );
    const needsReview = release.compatibility.classification === "migration-review-required";
    if (release.compatibility.characterMigrationReviewRequired !== needsReview)
      add(
        "SKILL_CONTENT_INVALID_COMPATIBILITY",
        "compatibility",
        "Compatibility classification and migration-review flag must agree explicitly.",
      );
  }
  diagnostics.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path) ||
      left.message.localeCompare(right.message),
  );
  const releaseId =
    typeof input === "object" && input !== null && "id" in input && typeof input.id === "string"
      ? input.id
      : "<invalid-release>";
  return { diagnostics, releaseId, valid: diagnostics.length === 0 };
}

/** Read-only candidate/canonical projection for the later Admin reference; no publication occurs. */
export function projectSkillContentReleaseForReference(
  release: SkillContentRelease,
): SkillContentReferenceProjection {
  return {
    contentVersion: release.contentVersion,
    id: release.id,
    manifest: release.manifest,
    records: {
      competencies: release.competencies,
      domains: release.domains,
      histories: release.histories,
      profiles: release.profiles,
      relationships: release.relationships,
      scripts: release.scripts,
    },
    status: release.status,
    title: release.title,
  };
}
