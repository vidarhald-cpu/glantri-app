import { z } from "zod";

const idSchema = z.string().min(1);
const optionalTrimmedText = z.string().trim().max(4000).optional();

export const artifactKindSchema = z.enum(["map", "image", "portrait", "document", "handout"]);
export const artifactLifecycleSchema = z.enum(["active", "archived", "deleted"]);
/**
 * The writable V1 Artifact access model: exactly two canonical states.
 *
 * Content authoring §18.24 and Campaign Material §2.4 settle this — `GM only`
 * and `shared with Campaign players`. There is no third state, and no code
 * path may newly write one.
 */
export const artifactAudienceSchema = z.enum(["gm_private", "campaign"]);

/**
 * Fail-closed resolution of a *persisted* audience column onto the two
 * canonical states. Used only where persisted rows are read.
 *
 * This is a **closed default**, not a special case for the retired legacy
 * `scenario` value: exactly `"campaign"` resolves to player-visible access and
 * **everything else** — `"gm_private"`, the legacy `"scenario"`, any
 * unrecognised string, `null`, `undefined` — resolves to `"gm_private"`.
 * Content authoring §18.24: residual legacy state "must never be treated as,
 * or widened into, player access".
 */
export function resolvePersistedArtifactAudience(value: unknown): ArtifactAudience {
  return value === "campaign" ? "campaign" : "gm_private";
}

/**
 * Legacy-tolerant parse of a persisted audience value. Separately named from
 * {@link artifactAudienceSchema} on purpose: the writable model stays two
 * states, and only reads of persisted rows tolerate anything else.
 */
export const persistedArtifactAudienceSchema = z
  .unknown()
  .transform(resolvePersistedArtifactAudience);
export const artifactStorageStateSchema = z.enum([
  "pending",
  "ready",
  "failed",
  "legacy_reference",
  "deleted",
]);
export const artifactStorageProviderSchema = z.enum(["local", "azure", "legacy"]);
export const artifactProvenanceKindSchema = z.enum(["user_upload", "imported", "generated"]);
export const artifactMediaTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
export const scenarioArtifactReferenceStateSchema = z.enum(["attached", "published", "withdrawn"]);

export const artifactUploadMetadataSchema = z
  .object({
    altText: z.string().trim().max(1000).optional(),
    artifactKind: artifactKindSchema,
    description: optionalTrimmedText,
    provenanceKind: artifactProvenanceKindSchema.default("user_upload"),
    sourceLabel: z.string().trim().max(500).optional(),
    sourceUri: z.string().trim().url().max(2000).optional(),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const artifactMetadataUpdateSchema = z
  .object({
    altText: z.string().trim().max(1000).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    expectedMetadataVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const artifactAudienceUpdateSchema = z
  .object({
    audience: z.enum(["gm_private", "campaign"]),
    expectedMetadataVersion: z.number().int().positive(),
  })
  .strict();

export const scenarioArtifactReferenceMutationSchema = z
  .object({
    altText: z.string().trim().max(1000).nullable().optional(),
    caption: z.string().trim().max(2000).nullable().optional(),
    expectedArtifactVersion: z.number().int().positive(),
    expectedReferenceVersion: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().min(-10000).max(10000).nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const artifactGmDtoSchema = z.object({
  altText: z.string().optional(),
  artifactKind: artifactKindSchema,
  audience: artifactAudienceSchema,
  byteSize: z.number().int().positive().optional(),
  campaignId: idSchema,
  cleanupRequired: z.boolean(),
  createdAt: z.string().min(1),
  description: z.string().optional(),
  /** GM-private notes. Deliberately absent from the player-facing projection. */
  gmNotes: z.string().optional(),
  digest: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  id: idSchema,
  legacyNeedsUpload: z.boolean(),
  lifecycle: artifactLifecycleSchema,
  mediaType: artifactMediaTypeSchema.optional(),
  metadataVersion: z.number().int().positive(),
  originalFilename: z.string().optional(),
  provenanceKind: artifactProvenanceKindSchema.optional(),
  sourceLabel: z.string().optional(),
  sourceUri: z.string().optional(),
  storageState: artifactStorageStateSchema,
  title: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const artifactCommonDtoSchema = artifactGmDtoSchema.pick({
  altText: true,
  artifactKind: true,
  campaignId: true,
  description: true,
  id: true,
  mediaType: true,
  title: true,
});

export const scenarioArtifactReferenceDtoSchema = z.object({
  altText: z.string().optional(),
  artifactId: idSchema,
  caption: z.string().optional(),
  id: idSchema,
  scenarioId: idSchema,
  sortOrder: z.number().int().optional(),
  state: scenarioArtifactReferenceStateSchema,
  title: z.string().min(1),
  version: z.number().int().positive(),
});

export const artifactBlackboardCandidateSchema = z.object({
  altText: z.string().trim().min(1).max(1000),
  artifactKind: z.enum(["map", "image"]),
  id: idSchema,
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  title: z.string().min(1),
});

export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ArtifactLifecycle = z.infer<typeof artifactLifecycleSchema>;
export type ArtifactAudience = z.infer<typeof artifactAudienceSchema>;
export type ArtifactStorageState = z.infer<typeof artifactStorageStateSchema>;
export type ArtifactStorageProvider = z.infer<typeof artifactStorageProviderSchema>;
export type ArtifactProvenanceKind = z.infer<typeof artifactProvenanceKindSchema>;
export type ArtifactMediaType = z.infer<typeof artifactMediaTypeSchema>;
export type ArtifactUploadMetadata = z.infer<typeof artifactUploadMetadataSchema>;
export type ArtifactMetadataUpdate = z.infer<typeof artifactMetadataUpdateSchema>;
export type ArtifactGmDto = z.infer<typeof artifactGmDtoSchema>;
export type ArtifactCommonDto = z.infer<typeof artifactCommonDtoSchema>;
export type ScenarioArtifactReferenceDto = z.infer<typeof scenarioArtifactReferenceDtoSchema>;
export type ArtifactBlackboardCandidate = z.infer<typeof artifactBlackboardCandidateSchema>;
