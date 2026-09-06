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
const competencyName = z
  .string()
  .trim()
  .min(2, "Competency name must contain at least 2 characters.");
const competencyShortLabel = z
  .string()
  .trim()
  .min(2, "Competency short label must contain at least 2 characters.");
const competencyShortDescription = z
  .string()
  .trim()
  .min(12, "Competency short description must contain at least 12 characters.");
const competencyDescription = z
  .string()
  .trim()
  .min(40, "Competency description must contain at least 40 characters.");
const STANDARD_SPECIALIZATION_PREREQUISITE_THRESHOLDS = new Set([6, 11]);
const PROVENANCE_KIND_BY_STATUS = {
  canonical: "decision",
  evidence: "evidence",
  legacy: "legacy",
  proposal: "proposal",
} as const;
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
    limits: z.array(nonBlank).min(1),
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
  description: competencyDescription,
  name: competencyName,
  shortDescription: competencyShortDescription,
  shortLabel: competencyShortLabel,
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

function compareCanonicalValues(left: unknown, right: unknown): number {
  const leftJson = JSON.stringify(canonicalize(left));
  const rightJson = JSON.stringify(canonicalize(right));
  return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
}

function semanticSet<T, U>(values: readonly T[], project: (value: T) => U): U[] {
  return values.map(project).sort(compareCanonicalValues);
}

function semanticStringSet(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function semanticCompetency(record: SkillContentCompetencyRecord): unknown {
  const base = {
    domainId: record.domainId,
    id: record.id,
    kind: record.kind,
    prerequisites: semanticSet(record.prerequisites, ({ competencyId, threshold }) => ({
      competencyId,
      threshold,
    })),
    taskEnvelope: {
      coreTasks: semanticStringSet(record.taskEnvelope.coreTasks),
      limits: semanticStringSet(record.taskEnvelope.limits),
      methods: semanticStringSet(record.taskEnvelope.methods),
      useGuidance: record.taskEnvelope.useGuidance,
    },
    weight: record.weight,
  };
  if (record.kind === "spoken-language")
    return { ...base, familyIds: semanticStringSet(record.familyIds) };
  if (record.kind === "written-tradition") {
    return { ...base, scriptId: record.scriptId, spokenLanguageId: record.spokenLanguageId };
  }
  if (record.kind === "specialization") {
    const transfer =
      record.transfer.kind === "explicit-relationships"
        ? {
            kind: record.transfer.kind,
            relationshipIds: semanticStringSet(record.transfer.relationshipIds),
          }
        : { kind: record.transfer.kind };
    return {
      ...base,
      acquisitionWeight: record.acquisitionWeight,
      parentCompetencyId: record.parentCompetencyId,
      transfer,
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
      accessExceptions: semanticSet(
        release.accessExceptions,
        ({ basis, competencyIds, grantsCompetence, historyIds, id, profileId }) => ({
          basis,
          competencyIds: semanticStringSet(competencyIds),
          grantsCompetence,
          historyIds: semanticStringSet(historyIds),
          id,
          profileId,
        }),
      ),
      competencies: semanticSet(release.competencies, semanticCompetency),
      domains: semanticSet(release.domains, ({ id, kind, mechanics }) => ({
        id,
        kind,
        mechanics,
      })),
      histories: semanticSet(release.histories, ({ fixedCompetencyIds, id, selectionSlots }) => ({
        fixedCompetencyIds: semanticStringSet(fixedCompetencyIds),
        id,
        selectionSlots: semanticSet(
          selectionSlots,
          ({ candidateCompetencyIds, chooseCount, id }) => ({
            candidateCompetencyIds: semanticStringSet(candidateCompetencyIds),
            chooseCount,
            id,
          }),
        ),
      })),
      id: release.id,
      profiles: semanticSet(
        release.profiles,
        ({ accessBand, developmentStage, id, normalRoutes, overrides }) => ({
          accessBand,
          developmentStage,
          id,
          normalRoutes: semanticSet(normalRoutes, ({ accessBand, competencyIds, id }) => ({
            accessBand,
            competencyIds: semanticStringSet(competencyIds),
            id,
          })),
          overrides: semanticSet(overrides, ({ attributionId, availability, competencyIds }) => ({
            attributionId,
            availability,
            competencyIds: semanticStringSet(competencyIds),
          })),
        }),
      ),
      relationships: semanticSet(
        release.relationships,
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
      scripts: semanticSet(release.scripts, ({ familyIds, id, kind }) => ({
        familyIds: semanticStringSet(familyIds),
        id,
        kind,
      })),
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

function addDuplicateTargetDiagnostics(input: {
  add: (code: string, path: string, message: string) => void;
  code?: string;
  label: string;
  path: string;
  values: readonly string[];
}): void {
  const firstIndexByTarget = new Map<string, number>();
  input.values.forEach((target, index) => {
    const firstIndex = firstIndexByTarget.get(target);
    if (firstIndex === undefined) {
      firstIndexByTarget.set(target, index);
      return;
    }
    input.add(
      input.code ?? "SKILL_CONTENT_DUPLICATE_TARGET",
      `${input.path}[${index}]`,
      `${input.label} target "${target}" duplicates ${input.path}[${firstIndex}].`,
    );
  });
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
    const recordEntries = [
      ...release.domains.map((record, index) => ({ path: `domains[${index}]`, record })),
      ...release.scripts.map((record, index) => ({ path: `scripts[${index}]`, record })),
      ...release.competencies.map((record, index) => ({
        path: `competencies[${index}]`,
        record,
      })),
      ...release.histories.map((record, index) => ({ path: `histories[${index}]`, record })),
      ...release.profiles.map((record, index) => ({ path: `profiles[${index}]`, record })),
      ...release.profiles.flatMap((profile, profileIndex) =>
        profile.normalRoutes.map((record, routeIndex) => ({
          path: `profiles[${profileIndex}].normalRoutes[${routeIndex}]`,
          record,
        })),
      ),
      ...release.relationships.map((record, index) => ({
        path: `relationships[${index}]`,
        record,
      })),
      ...release.accessExceptions.map((record, index) => ({
        path: `accessExceptions[${index}]`,
        record,
      })),
    ];
    const idEntries = [
      ...recordEntries,
      ...release.histories.flatMap((history, historyIndex) =>
        history.selectionSlots.map((record, slotIndex) => ({
          path: `histories[${historyIndex}].selectionSlots[${slotIndex}]`,
          record,
        })),
      ),
    ];
    const firstPathById = new Map<string, string>();
    idEntries.forEach(({ path, record }) => {
      const firstPath = firstPathById.get(record.id);
      if (firstPath)
        add(
          "SKILL_CONTENT_DUPLICATE_ID",
          `${path}.id`,
          `Stable identity "${record.id}" duplicates ${firstPath}.id.`,
        );
      else firstPathById.set(record.id, path);
    });
    recordEntries.forEach(({ path, record }) => {
      const expectedProvenance = PROVENANCE_KIND_BY_STATUS[record.metadata.status];
      if (record.metadata.provenance.kind !== expectedProvenance)
        add(
          "SKILL_CONTENT_STATUS_PROVENANCE_MISMATCH",
          `${path}.metadata.provenance.kind`,
          `Record status "${record.metadata.status}" requires "${expectedProvenance}" provenance, not "${record.metadata.provenance.kind}".`,
        );
    });
    addDuplicateTargetDiagnostics({
      add,
      label: "Release provenance",
      path: "provenance",
      values: release.provenance,
    });
    const domainIds = new Set(release.domains.map(({ id }) => id));
    const scriptIds = new Set(release.scripts.map(({ id }) => id));
    const competencyById = new Map(release.competencies.map((record) => [record.id, record]));
    const historyIds = new Set(release.histories.map(({ id }) => id));
    const relationshipById = new Map(release.relationships.map((record) => [record.id, record]));
    release.competencies.forEach((record, index) => {
      addDuplicateTargetDiagnostics({
        add,
        label: `Competency "${record.id}" prerequisite competency`,
        path: `competencies[${index}].prerequisites`,
        values: record.prerequisites.map(({ competencyId }) => competencyId),
      });
      addDuplicateTargetDiagnostics({
        add,
        label: `Competency "${record.id}" core task`,
        path: `competencies[${index}].taskEnvelope.coreTasks`,
        values: record.taskEnvelope.coreTasks,
      });
      addDuplicateTargetDiagnostics({
        add,
        label: `Competency "${record.id}" task-envelope limit`,
        path: `competencies[${index}].taskEnvelope.limits`,
        values: record.taskEnvelope.limits,
      });
      addDuplicateTargetDiagnostics({
        add,
        label: `Competency "${record.id}" method`,
        path: `competencies[${index}].taskEnvelope.methods`,
        values: record.taskEnvelope.methods,
      });
      if (!domainIds.has(record.domainId))
        add(
          "SKILL_CONTENT_UNKNOWN_DOMAIN",
          `competencies[${index}].domainId`,
          `Unknown domain "${record.domainId}".`,
        );
      record.prerequisites.forEach(
        ({ competencyId, justification, threshold }, prerequisiteIndex) => {
          if (!competencyById.has(competencyId))
            add(
              "SKILL_CONTENT_UNKNOWN_PREREQUISITE",
              `competencies[${index}].prerequisites[${prerequisiteIndex}]`,
              `Unknown prerequisite "${competencyId}".`,
            );
          if (
            !STANDARD_SPECIALIZATION_PREREQUISITE_THRESHOLDS.has(threshold) &&
            justification === undefined
          )
            add(
              "SKILL_CONTENT_NONSTANDARD_PREREQUISITE_JUSTIFICATION_REQUIRED",
              `competencies[${index}].prerequisites[${prerequisiteIndex}].justification`,
              `Prerequisite threshold ${threshold} requires authored justification because the standard thresholds are 6 and 11.`,
            );
        },
      );
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
      if (record.kind === "spoken-language")
        addDuplicateTargetDiagnostics({
          add,
          label: `Spoken language "${record.id}" family`,
          path: `competencies[${index}].familyIds`,
          values: record.familyIds,
        });
      if (record.kind === "specialization") {
        if (competencyById.get(record.parentCompetencyId)?.kind !== "skill")
          add(
            "SKILL_CONTENT_INVALID_SPECIALIZATION_PARENT",
            `competencies[${index}].parentCompetencyId`,
            `Specialization parent must be a concrete Skill.`,
          );
        if (
          !record.prerequisites.some(
            ({ competencyId }) => competencyId === record.parentCompetencyId,
          )
        )
          add(
            "SKILL_CONTENT_SPECIALIZATION_PARENT_PREREQUISITE_MISSING",
            `competencies[${index}].prerequisites`,
            `Specialization must declare its parent Skill as a prerequisite.`,
          );
        if (record.transfer.kind === "explicit-relationships") {
          addDuplicateTargetDiagnostics({
            add,
            label: `Specialization "${record.id}" transfer relationship`,
            path: `competencies[${index}].transfer.relationshipIds`,
            values: record.transfer.relationshipIds,
          });
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
        } else {
          release.relationships
            .filter(
              ({ sourceCompetencyId, targetCompetencyId }) =>
                sourceCompetencyId === record.parentCompetencyId &&
                targetCompetencyId === record.id,
            )
            .forEach((edge) =>
              add(
                "SKILL_CONTENT_CONTRADICTORY_SPECIALIZATION_TRANSFER",
                `competencies[${index}].transfer`,
                `Specialization "${record.id}" declares zero transfer but relationship "${edge.id}" authors a ${edge.strength}% parent-to-Specialization transfer edge.`,
              ),
            );
        }
      }
    });
    release.scripts.forEach((record, index) =>
      addDuplicateTargetDiagnostics({
        add,
        label: `Script "${record.id}" family`,
        path: `scripts[${index}].familyIds`,
        values: record.familyIds,
      }),
    );
    const firstRelationshipIndexByEdge = new Map<string, number>();
    release.relationships.forEach((record, index) => {
      const edge = `${record.sourceCompetencyId}->${record.targetCompetencyId}`;
      const firstEdgeIndex = firstRelationshipIndexByEdge.get(edge);
      if (firstEdgeIndex === undefined) firstRelationshipIndexByEdge.set(edge, index);
      else
        add(
          "SKILL_CONTENT_DUPLICATE_RELATIONSHIP_EDGE",
          `relationships[${index}]`,
          `Relationship edge "${edge}" duplicates relationships[${firstEdgeIndex}].`,
        );
      if (record.sourceCompetencyId === record.targetCompetencyId)
        add(
          "SKILL_CONTENT_SELF_RELATIONSHIP",
          `relationships[${index}]`,
          `Relationship "${record.id}" cannot target its own source competency.`,
        );
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
      const memberIds = [
        ...record.fixedCompetencyIds,
        ...record.selectionSlots.flatMap(({ candidateCompetencyIds }) => candidateCompetencyIds),
      ];
      addDuplicateTargetDiagnostics({
        add,
        label: `History "${record.id}" competency membership`,
        path: `histories[${index}]`,
        values: memberIds,
      });
      if (memberIds.length === 0)
        add(
          "SKILL_CONTENT_EMPTY_HISTORY",
          `histories[${index}]`,
          `History "${record.id}" must contain at least one competency membership.`,
        );
      memberIds.forEach((id) => {
        if (!competencyById.has(id))
          add(
            "SKILL_CONTENT_UNKNOWN_HISTORY_MEMBER",
            `histories[${index}]`,
            `Unknown history competency "${id}".`,
          );
      });
      record.selectionSlots.forEach((slot, slotIndex) => {
        if (slot.chooseCount > slot.candidateCompetencyIds.length)
          add(
            "SKILL_CONTENT_INVALID_SELECTION_SLOT",
            `histories[${index}].selectionSlots[${slotIndex}]`,
            `Selection slot "${slot.id}" has an impossible choose count.`,
          );
      });
    });
    release.profiles.forEach((record, index) => {
      record.normalRoutes.forEach((route, routeIndex) =>
        addDuplicateTargetDiagnostics({
          add,
          label: `Access route "${route.id}" competency`,
          path: `profiles[${index}].normalRoutes[${routeIndex}].competencyIds`,
          values: route.competencyIds,
        }),
      );
      const overrideTargets = record.overrides.flatMap(({ competencyIds }) => competencyIds);
      addDuplicateTargetDiagnostics({
        add,
        code: "SKILL_CONTENT_DUPLICATE_PROFILE_OVERRIDE",
        label: `Profile "${record.id}" override competency`,
        path: `profiles[${index}].overrides`,
        values: overrideTargets,
      });
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
      addDuplicateTargetDiagnostics({
        add,
        label: `Access exception "${record.id}" competency`,
        path: `accessExceptions[${index}].competencyIds`,
        values: record.competencyIds,
      });
      addDuplicateTargetDiagnostics({
        add,
        label: `Access exception "${record.id}" history`,
        path: `accessExceptions[${index}].historyIds`,
        values: record.historyIds,
      });
      if (record.competencyIds.length === 0 && record.historyIds.length === 0)
        add(
          "SKILL_CONTENT_EMPTY_ACCESS_EXCEPTION",
          `accessExceptions[${index}]`,
          `Access exception "${record.id}" must target a competency or history.`,
        );
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
  return deepReadonlyClone({
    compatibility: release.compatibility,
    contentVersion: release.contentVersion,
    id: release.id,
    manifest: release.manifest,
    provenance: release.provenance,
    records: {
      accessExceptions: release.accessExceptions,
      competencies: release.competencies,
      domains: release.domains,
      histories: release.histories,
      profiles: release.profiles,
      relationships: release.relationships,
      scripts: release.scripts,
    },
    rulesVersion: release.rulesVersion,
    schemaVersion: release.schemaVersion,
    status: release.status,
    title: release.title,
  });
}

function deepReadonlyClone<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(deepReadonlyClone)) as T;
  if (value !== null && typeof value === "object") {
    const clone = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, deepReadonlyClone(entry)]),
    );
    return Object.freeze(clone) as T;
  }
  return value;
}
