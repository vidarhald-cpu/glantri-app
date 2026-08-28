import { z } from "zod";

import type { PilotSkillContentRelease } from "@glantri/domain";

export interface PilotSkillContentReleaseValidation {
  diagnostics: readonly { code: string; message: string; path: string }[];
  releaseId: string;
  valid: boolean;
}

const STABLE_ID = /^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;
const accessBand = z.enum(["AB1", "AB2", "AB3", "AB4"]);
const developmentStage = z.enum(["DS1", "DS2", "DS3", "DS4", "DS5", "DS6"]);
const stableReference = z.string().min(1);
const stableReferences = z.array(stableReference);

const competency = z
  .object({
    description: z.string(),
    domainId: stableReference,
    id: stableReference,
    kind: z.enum(["skill", "spoken-language", "written-tradition"]),
    name: z.string().min(1),
    weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

const specialization = z
  .object({
    acquisitionWeight: z.union([z.literal(1), z.literal(2)]),
    description: z.string(),
    id: stableReference,
    kind: z.literal("specialization"),
    name: z.string().min(1),
    prerequisites: z.array(
      z
        .object({
          competencyId: stableReference,
          justification: z.string().optional(),
          threshold: z.number().int().positive(),
        })
        .strict(),
    ),
    transfer: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("explicit-relationships"),
          relationshipIds: stableReferences,
        })
        .strict(),
      z
        .object({
          kind: z.literal("zero-transfer"),
          rationale: z.string().min(1),
        })
        .strict(),
    ]),
  })
  .strict();

const history = z
  .object({
    context: z.string().min(1),
    fixedCompetencyIds: stableReferences,
    id: stableReference,
    intensity: z.object({ maximum: z.literal(4), minimum: z.literal(1) }).strict(),
    name: z.string().min(1),
    selectionSlots: z.array(
      z
        .object({
          candidateCompetencyIds: stableReferences,
          chooseCount: z.number().int().positive(),
          id: stableReference,
          label: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

const profession = z
  .object({
    id: stableReference,
    mechanics: z.literal("none"),
    name: z.string().min(1),
    suggestedCompetencyIds: stableReferences,
    suggestedHistoryIds: stableReferences,
  })
  .strict();

const background = z
  .object({
    id: stableReference,
    name: z.string().min(1),
    profileId: stableReference,
    startingSpokenLanguageId: stableReference,
    startingSpokenLanguageRule: z.literal("max(11,education)"),
  })
  .strict();

const accessRoute = z
  .object({
    accessBand,
    competencyIds: stableReferences,
    description: z.string().min(1),
    id: stableReference,
  })
  .strict();

const applicabilityOverride = z
  .object({
    attributionId: stableReference,
    availability: z.enum(["available", "restricted", "unavailable"]),
    competencyIds: stableReferences,
    explanation: z.string().min(1),
  })
  .strict();

const profile = z
  .object({
    accessBand,
    developmentStage,
    id: stableReference,
    name: z.string().min(1),
    normalRoutes: z.array(accessRoute),
    overrides: z.array(applicabilityOverride),
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
    competencyIds: stableReferences,
    grantsCompetence: z.literal(0),
    historyIds: stableReferences,
    id: stableReference,
    profileId: stableReference,
    explanation: z.string().min(1),
  })
  .strict();

const relationship = z
  .object({
    direction: z.literal("source-to-target"),
    futureCascadeRisk: z.string(),
    id: stableReference,
    rationale: z.string(),
    reverseEdge: z.literal("not-inferred"),
    rulesVersion: z.literal("pilot-skill-rules/v1"),
    sourceCompetencyId: stableReference,
    strength: z.union([z.literal(100), z.literal(75), z.literal(50), z.literal(25)]),
    targetCompetencyId: stableReference,
  })
  .strict();

const character = z
  .object({
    accessExceptionIds: stableReferences,
    backgroundId: stableReference,
    concept: z.string().min(1),
    directAcquisitions: z.array(
      z.object({ competencyId: stableReference, ranks: z.number().int().positive() }).strict(),
    ),
    expected: z
      .object({
        flexSpent: z.number().int().nonnegative(),
        groupCost: z.number().int().nonnegative(),
        totalCost: z.number().int().nonnegative(),
      })
      .strict(),
    histories: z.array(
      z
        .object({
          historyId: stableReference,
          level: z.number().int(),
          selectedCompetencyIds: stableReferences,
        })
        .strict(),
    ),
    id: stableReference,
    professionId: stableReference,
    specializationAcquisitions: z.array(
      z.object({ competencyId: stableReference, ranks: z.literal(2) }).strict(),
    ),
    startingSpokenLanguageRanks: z.literal(11),
  })
  .strict();

const releaseSchema = z
  .object({
    accessExceptions: z.array(accessException),
    backgrounds: z.array(background),
    characters: z.array(character),
    competencies: z.array(competency),
    contentVersion: z.literal("pilot-skills-content/1.0.1"),
    histories: z.array(history),
    id: z.literal("content-release:pilot-skills:1"),
    manifest: z
      .object({
        counts: z
          .object({
            accessExceptions: z.literal(4),
            backgrounds: z.literal(8),
            characters: z.literal(8),
            competencies: z.literal(53),
            histories: z.literal(17),
            professions: z.literal(8),
            profiles: z.literal(7),
            relationships: z.literal(15),
            specializations: z.literal(8),
          })
          .strict(),
        payloadDigest: z.string().regex(SHA256_DIGEST),
        serialization: z.literal("canonical-json-lexicographic-keys/v1"),
      })
      .strict(),
    policies: z
      .object({
        accessGrantsCompetence: z.literal(0),
        navigationTaxonomyMechanics: z.literal("none"),
        professionMechanics: z.literal("none"),
        relationshipInference: z.literal("explicit-directional-only"),
        relationshipRecursion: z.literal("non-recursive-pilot-v1"),
        spokenLanguageImpliesWriting: z.literal(false),
      })
      .strict(),
    professions: z.array(profession),
    profiles: z.array(profile),
    provenance: z.array(z.string().min(1)),
    relationships: z.array(relationship),
    rulesVersion: z.literal("pilot-skill-rules/v1"),
    schemaVersion: z.literal("pilot-skill-content-release/v1"),
    specializations: z.array(specialization),
    status: z.literal("canonical-bounded-pilot"),
    title: z.string().min(1),
  })
  .strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function releaseIdOf(value: unknown): string {
  return isRecord(value) && typeof value.id === "string" ? value.id : "<invalid-release>";
}

function diagnosticPath(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (result, part) =>
      typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${part}` : part,
    "",
  );
}

function sortDiagnostics(
  diagnostics: Array<{ code: string; message: string; path: string }>,
): void {
  diagnostics.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path) ||
      left.message.localeCompare(right.message),
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

/** Browser-safe synchronous SHA-256 for the canonical release payload. */
function sha256(value: string): string {
  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const encoded = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((encoded.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(encoded);
  bytes[encoded.length] = 0x80;
  const bitLength = encoded.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]!;
      const right = words[index - 2]!;
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const temporary1 = (h! + sum1 + choice + constants[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0]! + a!) >>> 0;
    hash[1] = (hash[1]! + b!) >>> 0;
    hash[2] = (hash[2]! + c!) >>> 0;
    hash[3] = (hash[3]! + d!) >>> 0;
    hash[4] = (hash[4]! + e!) >>> 0;
    hash[5] = (hash[5]! + f!) >>> 0;
    hash[6] = (hash[6]! + g!) >>> 0;
    hash[7] = (hash[7]! + h!) >>> 0;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, "0")).join("");
}

export function serializePilotSkillContentReleasePayload(
  release: PilotSkillContentRelease,
): string {
  const { manifest: _manifest, ...payload } = release;
  return JSON.stringify(canonicalize(payload));
}

export function validatePilotSkillContentRelease(
  input: unknown,
): PilotSkillContentReleaseValidation {
  const diagnostics: Array<{ code: string; message: string; path: string }> = [];
  const add = (code: string, path: string, message: string) =>
    diagnostics.push({ code, message, path });
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      add("PILOT_CONTENT_INVALID_SHAPE", diagnosticPath(issue.path), issue.message);
    }
    sortDiagnostics(diagnostics);
    return { diagnostics, releaseId: releaseIdOf(input), valid: false };
  }

  const release = parsed.data as PilotSkillContentRelease;
  const collections = {
    accessExceptions: release.accessExceptions,
    backgrounds: release.backgrounds,
    characters: release.characters,
    competencies: release.competencies,
    histories: release.histories,
    professions: release.professions,
    profiles: release.profiles,
    relationships: release.relationships,
    specializations: release.specializations,
  } as const;
  const allRecords = Object.entries(collections).flatMap(([collection, records]) =>
    records.map((record, index) => ({ collection, index, record })),
  );
  const recordById = new Map<string, { collection: string; index: number }>();

  for (const { collection, index, record } of allRecords) {
    const path = `${collection}[${index}].id`;
    if (!STABLE_ID.test(record.id)) {
      add("PILOT_CONTENT_INVALID_STABLE_ID", path, `Invalid stable ID "${record.id}".`);
    }
    const existing = recordById.get(record.id);
    if (existing) {
      add(
        "PILOT_CONTENT_DUPLICATE_ID",
        path,
        `ID "${record.id}" duplicates ${existing.collection}[${existing.index}].`,
      );
    } else recordById.set(record.id, { collection, index });
  }

  for (const [collection, expected] of Object.entries(release.manifest.counts)) {
    const actual = collections[collection as keyof typeof collections].length;
    if (actual !== expected) {
      add(
        "PILOT_CONTENT_MANIFEST_COUNT_MISMATCH",
        `manifest.counts.${collection}`,
        `Manifest declares ${expected}; release contains ${actual}.`,
      );
    }
  }

  const competencyIds = new Set(release.competencies.map(({ id }) => id));
  const specializationIds = new Set(release.specializations.map(({ id }) => id));
  const competenceIds = new Set([...competencyIds, ...specializationIds]);
  const relationshipIds = new Set(release.relationships.map(({ id }) => id));
  const historyById = new Map(release.histories.map((entry) => [entry.id, entry]));
  const backgroundById = new Map(release.backgrounds.map((entry) => [entry.id, entry]));
  const professionIds = new Set(release.professions.map(({ id }) => id));
  const profileIds = new Set(release.profiles.map(({ id }) => id));
  const exceptionIds = new Set(release.accessExceptions.map(({ id }) => id));

  release.histories.forEach((entry, historyIndex) => {
    const allMembers = [
      ...entry.fixedCompetencyIds,
      ...entry.selectionSlots.flatMap((slot) => slot.candidateCompetencyIds),
    ];
    allMembers.forEach((id) => {
      if (!competenceIds.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_HISTORY_MEMBER",
          `histories[${historyIndex}]`,
          `Unknown competency "${id}".`,
        );
      }
    });
    entry.selectionSlots.forEach((slot, slotIndex) => {
      if (slot.chooseCount > slot.candidateCompetencyIds.length) {
        add(
          "PILOT_CONTENT_INVALID_SELECTION_SLOT",
          `histories[${historyIndex}].selectionSlots[${slotIndex}]`,
          `Selection slot "${slot.id}" has an impossible choose count.`,
        );
      }
    });
  });

  release.relationships.forEach((entry, index) => {
    if (
      !competenceIds.has(entry.sourceCompetencyId) ||
      !competenceIds.has(entry.targetCompetencyId)
    ) {
      add(
        "PILOT_CONTENT_UNKNOWN_RELATIONSHIP_ENDPOINT",
        `relationships[${index}]`,
        `Relationship "${entry.id}" has an unknown endpoint.`,
      );
    }
  });

  release.specializations.forEach((entry, index) => {
    entry.prerequisites.forEach(({ competencyId }) => {
      if (!competencyIds.has(competencyId)) {
        add(
          "PILOT_CONTENT_UNKNOWN_SPECIALIZATION_PREREQUISITE",
          `specializations[${index}]`,
          `Specialization "${entry.id}" references unknown prerequisite "${competencyId}".`,
        );
      }
    });
    if (entry.transfer.kind === "explicit-relationships") {
      entry.transfer.relationshipIds.forEach((id) => {
        if (!relationshipIds.has(id)) {
          add(
            "PILOT_CONTENT_UNKNOWN_SPECIALIZATION_TRANSFER",
            `specializations[${index}].transfer`,
            `Unknown relationship "${id}".`,
          );
        }
      });
    }
  });

  release.backgrounds.forEach((entry, index) => {
    const language = release.competencies.find(({ id }) => id === entry.startingSpokenLanguageId);
    if (language?.kind !== "spoken-language") {
      add(
        "PILOT_CONTENT_BACKGROUND_LANGUAGE_NOT_SPOKEN",
        `backgrounds[${index}]`,
        `Background "${entry.id}" must grant one spoken-language identity.`,
      );
    }
    if (!profileIds.has(entry.profileId)) {
      add(
        "PILOT_CONTENT_UNKNOWN_BACKGROUND_PROFILE",
        `backgrounds[${index}]`,
        `Unknown profile "${entry.profileId}".`,
      );
    }
  });

  release.profiles.forEach((entry, index) => {
    [
      ...entry.normalRoutes.flatMap(({ competencyIds }) => competencyIds),
      ...entry.overrides.flatMap(({ competencyIds }) => competencyIds),
    ].forEach((id) => {
      if (!competenceIds.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_PROFILE_COMPETENCY",
          `profiles[${index}]`,
          `Profile "${entry.id}" references unknown competency "${id}".`,
        );
      }
    });
  });

  release.professions.forEach((entry, index) => {
    entry.suggestedCompetencyIds.forEach((id) => {
      if (!competenceIds.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_PROFESSION_SUGGESTION",
          `professions[${index}]`,
          `Unknown suggested competency "${id}".`,
        );
      }
    });
    entry.suggestedHistoryIds.forEach((id) => {
      if (!historyById.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_PROFESSION_HISTORY",
          `professions[${index}]`,
          `Unknown suggested history "${id}".`,
        );
      }
    });
  });

  release.accessExceptions.forEach((entry, index) => {
    if (!profileIds.has(entry.profileId)) {
      add(
        "PILOT_CONTENT_ACCESS_EXCEPTION_INVALID",
        `accessExceptions[${index}]`,
        `Access exception "${entry.id}" needs a known profile and must grant zero competence.`,
      );
    }
    entry.competencyIds.forEach((id) => {
      if (!competenceIds.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_EXCEPTION_COMPETENCY",
          `accessExceptions[${index}]`,
          `Unknown exception competency "${id}".`,
        );
      }
    });
    entry.historyIds.forEach((id) => {
      if (!historyById.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_EXCEPTION_HISTORY",
          `accessExceptions[${index}]`,
          `Unknown exception history "${id}".`,
        );
      }
    });
  });

  release.characters.forEach((entry, index) => {
    if (!backgroundById.has(entry.backgroundId) || !professionIds.has(entry.professionId)) {
      add(
        "PILOT_CONTENT_CHARACTER_CONTEXT_UNKNOWN",
        `characters[${index}]`,
        `Character "${entry.id}" needs a known profession and background.`,
      );
    }
    entry.accessExceptionIds.forEach((id) => {
      if (!exceptionIds.has(id)) {
        add(
          "PILOT_CONTENT_CHARACTER_EXCEPTION_UNKNOWN",
          `characters[${index}]`,
          `Unknown access exception "${id}".`,
        );
      }
    });
    [...entry.directAcquisitions, ...entry.specializationAcquisitions].forEach(
      ({ competencyId }) => {
        if (!competenceIds.has(competencyId)) {
          add(
            "PILOT_CONTENT_CHARACTER_ACQUISITION_UNKNOWN",
            `characters[${index}]`,
            `Unknown acquired competency "${competencyId}".`,
          );
        }
      },
    );
    entry.histories.forEach((selection, selectionIndex) => {
      const selectedHistory = historyById.get(selection.historyId);
      if (
        !selectedHistory ||
        selection.level < selectedHistory.intensity.minimum ||
        selection.level > selectedHistory.intensity.maximum
      ) {
        add(
          "PILOT_CONTENT_CHARACTER_HISTORY_INVALID",
          `characters[${index}].histories[${selectionIndex}]`,
          `Unknown history or invalid level for "${selection.historyId}".`,
        );
        return;
      }
      const selected = new Set(selection.selectedCompetencyIds);
      const expectedSelectedCount = selectedHistory.selectionSlots.reduce(
        (sum, slot) => sum + slot.chooseCount,
        0,
      );
      const candidates = new Set(
        selectedHistory.selectionSlots.flatMap((slot) => slot.candidateCompetencyIds),
      );
      if (
        selected.size !== expectedSelectedCount ||
        [...selected].some((id) => !candidates.has(id))
      ) {
        add(
          "PILOT_CONTENT_CHARACTER_HISTORY_CHOICES_INVALID",
          `characters[${index}].histories[${selectionIndex}]`,
          `Resolved choices for "${selection.historyId}" do not match its authored slots.`,
        );
      }
    });
  });

  const computedDigest = `sha256:${sha256(serializePilotSkillContentReleasePayload(release))}`;
  if (release.manifest.payloadDigest !== computedDigest) {
    add(
      "PILOT_CONTENT_DIGEST_MISMATCH",
      "manifest.payloadDigest",
      `Manifest digest does not match canonical payload digest ${computedDigest}.`,
    );
  }

  sortDiagnostics(diagnostics);
  return { diagnostics, releaseId: release.id, valid: diagnostics.length === 0 };
}
