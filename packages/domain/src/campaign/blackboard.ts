import { z } from "zod";

const idSchema = z.string().min(1);
const titleSchema = z.string().trim().min(1).max(200);
const optionalContextSchema = z.string().trim().max(2000).optional();
const actorLabelSchema = z.string().trim().min(1).max(200);

export const blackboardCategorySchema = z.enum([
  "clue_fact",
  "document_text",
  "image_map",
  "recap",
]);
export const blackboardEntryStateSchema = z.enum(["published", "retracted", "archived"]);
export const blackboardRevisionKindSchema = z.enum([
  "initial",
  "correction",
  "replacement",
  "refresh",
]);
export const blackboardSourceStatusSchema = z.enum([
  "unchanged",
  "source_changed",
  "source_unavailable",
]);
export const blackboardGrantStateSchema = z.enum(["granted", "revoked"]);

export const blackboardRestrictedDetailInputSchema = z
  .object({
    detailText: z.string().trim().min(1).max(4000),
    label: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).max(63),
    unitKey: idSchema.optional(),
  })
  .strict();

const restrictedDetailsSchema = z
  .array(blackboardRestrictedDetailInputSchema)
  .max(64)
  .superRefine((details, context) => {
    const keys = details.flatMap((detail) => (detail.unitKey ? [detail.unitKey] : []));
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Detail keys must be unique." });
    }
    const orders = details.map((detail) => detail.sortOrder);
    if (new Set(orders).size !== orders.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Detail order must be unique." });
    }
  });

const clueCreateShape = {
  category: z.literal("clue_fact"),
  context: optionalContextSchema,
  fact: z.string().trim().min(1).max(4000),
  title: titleSchema,
};
const documentCreateShape = {
  category: z.literal("document_text"),
  context: optionalContextSchema,
  documentText: z.string().trim().min(1).max(20000),
  title: titleSchema,
};
const imageCreateShape = {
  caption: optionalContextSchema,
  category: z.literal("image_map"),
  sourceArtifactId: idSchema,
  title: titleSchema,
};
const recapCreateShape = {
  category: z.literal("recap"),
  recapText: z.string().trim().min(1).max(20000),
  title: titleSchema,
};

export const blackboardCreateSchema = z.discriminatedUnion("category", [
  z.object(clueCreateShape).strict(),
  z.object(documentCreateShape).strict(),
  z.object(imageCreateShape).strict(),
  z.object(recapCreateShape).strict(),
]);

export const blackboardGmCreateSchema = z.discriminatedUnion("category", [
  z.object({ ...clueCreateShape, restrictedDetails: restrictedDetailsSchema.optional() }).strict(),
  z
    .object({ ...documentCreateShape, restrictedDetails: restrictedDetailsSchema.optional() })
    .strict(),
  z.object({ ...imageCreateShape, restrictedDetails: restrictedDetailsSchema.optional() }).strict(),
  z.object({ ...recapCreateShape, restrictedDetails: restrictedDetailsSchema.optional() }).strict(),
]);

const revisionBase = {
  changeKind: z.enum(["correction", "replacement"]),
  expectedEntryVersion: z.number().int().positive(),
};

const clueRevisionShape = {
  ...revisionBase,
  category: z.literal("clue_fact"),
  context: optionalContextSchema,
  fact: z.string().trim().min(1).max(4000),
  title: titleSchema,
};
const documentRevisionShape = {
  ...revisionBase,
  category: z.literal("document_text"),
  context: optionalContextSchema,
  documentText: z.string().trim().min(1).max(20000),
  title: titleSchema,
};
const imageRevisionShape = {
  ...revisionBase,
  caption: optionalContextSchema,
  category: z.literal("image_map"),
  sourceArtifactId: idSchema,
  title: titleSchema,
};
const imageRefreshShape = {
  category: z.literal("image_map"),
  changeKind: z.literal("refresh"),
  expectedEntryVersion: z.number().int().positive(),
};
const recapRevisionShape = {
  ...revisionBase,
  category: z.literal("recap"),
  recapText: z.string().trim().min(1).max(20000),
  title: titleSchema,
};

export const blackboardRevisionSchema = z.union([
  z.object(clueRevisionShape).strict(),
  z.object(documentRevisionShape).strict(),
  z.object(imageRevisionShape).strict(),
  z.object(imageRefreshShape).strict(),
  z.object(recapRevisionShape).strict(),
]);

export const blackboardGmRevisionSchema = z.union([
  z
    .object({ ...clueRevisionShape, restrictedDetails: restrictedDetailsSchema.optional() })
    .strict(),
  z
    .object({ ...documentRevisionShape, restrictedDetails: restrictedDetailsSchema.optional() })
    .strict(),
  z
    .object({ ...imageRevisionShape, restrictedDetails: restrictedDetailsSchema.optional() })
    .strict(),
  z
    .object({ ...imageRefreshShape, restrictedDetails: restrictedDetailsSchema.optional() })
    .strict(),
  z
    .object({ ...recapRevisionShape, restrictedDetails: restrictedDetailsSchema.optional() })
    .strict(),
]);

export const blackboardExpectedEntryVersionSchema = z
  .object({ expectedEntryVersion: z.number().int().positive() })
  .strict();

export const blackboardArchiveSchema = z
  .object({
    expectedEntryVersion: z.number().int().positive(),
    expectedLayoutVersion: z.number().int().nonnegative(),
  })
  .strict();

export const blackboardGrantCommandSchema = z
  .object({
    action: z.enum(["grant", "revoke"]),
    expectedEntryVersion: z.number().int().positive(),
    expectedGrantVersion: z.number().int().nonnegative(),
    unitVersion: z.number().int().positive(),
  })
  .strict();

const placementShape = {
  expectedLayoutVersion: z.number().int().nonnegative(),
  groupId: idSchema.nullable().optional(),
  height: z.number().int().min(80).max(2400),
  layer: z.number().int().min(0).max(10000),
  width: z.number().int().min(120).max(2400),
  x: z.number().int().min(-100000).max(100000),
  y: z.number().int().min(-100000).max(100000),
};

export const blackboardPlacementCreateSchema = z
  .object({ entryId: idSchema, ...placementShape })
  .strict();
export const blackboardPlacementUpdateSchema = z
  .object({
    ...placementShape,
    expectedRowVersion: z.number().int().positive(),
  })
  .strict();
export const blackboardPlacementDeleteSchema = z
  .object({
    expectedLayoutVersion: z.number().int().nonnegative(),
    expectedRowVersion: z.number().int().positive(),
  })
  .strict();
export const blackboardPlacementGroupSchema = z
  .object({
    entryIds: z.array(idSchema).min(1).max(64),
    expectedLayoutVersion: z.number().int().nonnegative(),
    expectedRowVersions: z.record(idSchema, z.number().int().positive()),
    groupId: idSchema.nullable().optional(),
  })
  .strict();

const artifactSnapshotSchema = z
  .object({
    altText: z.string().trim().min(1).max(1000),
    artifactKind: z.enum(["map", "image"]),
    id: idSchema,
    mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    title: titleSchema,
  })
  .strict();

const commonBase = {
  entryVersion: z.number().int().positive(),
  id: idSchema,
  state: z.enum(["Current", "Corrected"]),
  updatedAt: z.string().datetime(),
  updatedByLabel: actorLabelSchema,
};

export const blackboardCommonEntrySchema = z.discriminatedUnion("category", [
  z
    .object({
      ...commonBase,
      category: z.literal("clue_fact"),
      context: z.string().max(2000).optional(),
      fact: z.string().min(1).max(4000),
      title: titleSchema,
    })
    .strict(),
  z
    .object({
      ...commonBase,
      category: z.literal("document_text"),
      context: z.string().max(2000).optional(),
      documentText: z.string().min(1).max(20000),
      title: titleSchema,
    })
    .strict(),
  z
    .object({
      ...commonBase,
      artifact: artifactSnapshotSchema,
      caption: z.string().max(2000).optional(),
      category: z.literal("image_map"),
      content: z.object({ artifactId: idSchema }).strict().optional(),
      sourceStatus: blackboardSourceStatusSchema,
      title: titleSchema,
    })
    .strict(),
  z
    .object({
      ...commonBase,
      approvedAt: z.string().datetime(),
      approvedByLabel: actorLabelSchema,
      category: z.literal("recap"),
      recapText: z.string().min(1).max(20000),
      title: titleSchema,
    })
    .strict(),
]);

export const blackboardPlacementDtoSchema = z
  .object({
    entryId: idSchema,
    groupId: idSchema.optional(),
    height: z.number().int(),
    layer: z.number().int(),
    rowVersion: z.number().int().positive(),
    updatedAt: z.string().datetime(),
    updatedByLabel: actorLabelSchema,
    width: z.number().int(),
    x: z.number().int(),
    y: z.number().int(),
  })
  .strict();

export const blackboardTombstoneSchema = z
  .object({
    id: idSchema,
    removedAt: z.string().datetime(),
    removedByLabel: actorLabelSchema,
    state: z.literal("Removed"),
  })
  .strict();

export const blackboardCommonDtoSchema = z
  .object({
    catalogue: z.array(blackboardCommonEntrySchema),
    layout: z
      .object({
        placements: z.array(blackboardPlacementDtoSchema),
        version: z.number().int().nonnegative(),
      })
      .strict(),
    tombstones: z.array(blackboardTombstoneSchema),
  })
  .strict();

export const blackboardExpandedDetailSchema = z
  .object({
    common: blackboardCommonEntrySchema,
    restrictedDetails: z.array(
      z
        .object({
          detailText: z.string().min(1).max(4000),
          label: z.string().min(1).max(200).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const blackboardRevisionContentSchema = z.discriminatedUnion("category", [
  z
    .object({
      category: z.literal("clue_fact"),
      context: z.string().max(2000).optional(),
      fact: z.string().min(1).max(4000),
      title: titleSchema,
    })
    .strict(),
  z
    .object({
      category: z.literal("document_text"),
      context: z.string().max(2000).optional(),
      documentText: z.string().min(1).max(20000),
      title: titleSchema,
    })
    .strict(),
  z
    .object({
      artifact: artifactSnapshotSchema,
      caption: z.string().max(2000).optional(),
      category: z.literal("image_map"),
      title: titleSchema,
    })
    .strict(),
  z
    .object({
      approvedAt: z.string().datetime(),
      approvedByLabel: actorLabelSchema,
      category: z.literal("recap"),
      recapText: z.string().min(1).max(20000),
      title: titleSchema,
    })
    .strict(),
]);

export const blackboardSafeHistorySchema = z
  .object({
    currentEntryVersion: z.number().int().positive(),
    entryId: idSchema,
    revisions: z.array(
      z
        .object({
          changeKind: blackboardRevisionKindSchema,
          changedAt: z.string().datetime(),
          changedByLabel: actorLabelSchema,
          content: blackboardRevisionContentSchema,
          revisionNumber: z.number().int().positive(),
        })
        .strict(),
    ),
  })
  .strict();

export type BlackboardCategory = z.infer<typeof blackboardCategorySchema>;
export type BlackboardCreate = z.infer<typeof blackboardCreateSchema>;
export type BlackboardGmCreate = z.infer<typeof blackboardGmCreateSchema>;
export type BlackboardRevision = z.infer<typeof blackboardRevisionSchema>;
export type BlackboardGmRevision = z.infer<typeof blackboardGmRevisionSchema>;
export type BlackboardRestrictedDetailInput = z.infer<typeof blackboardRestrictedDetailInputSchema>;
export type BlackboardCommonEntry = z.infer<typeof blackboardCommonEntrySchema>;
export type BlackboardPlacementDto = z.infer<typeof blackboardPlacementDtoSchema>;
export type BlackboardTombstone = z.infer<typeof blackboardTombstoneSchema>;
export type BlackboardCommonDto = z.infer<typeof blackboardCommonDtoSchema>;
export type BlackboardExpandedDetail = z.infer<typeof blackboardExpandedDetailSchema>;

function normalizedTitle(entry: BlackboardCommonEntry): string {
  return entry.title.normalize("NFKC").trim().toLocaleLowerCase("en");
}

/**
 * The sole common-surface serializer. Its input cannot contain role, Character,
 * grant, restricted-unit, Artifact-audit, or GM-only data.
 */
export function serializeBlackboardCommonDto(input: {
  catalogue: BlackboardCommonEntry[];
  layout: { placements: BlackboardPlacementDto[]; version: number };
  tombstones: BlackboardTombstone[];
}): BlackboardCommonDto {
  return blackboardCommonDtoSchema.parse({
    catalogue: [...input.catalogue].sort(
      (left, right) =>
        normalizedTitle(left).localeCompare(normalizedTitle(right), "en") ||
        left.id.localeCompare(right.id, "en"),
    ),
    layout: {
      placements: [...input.layout.placements].sort(
        (left, right) =>
          left.layer - right.layer || left.entryId.localeCompare(right.entryId, "en"),
      ),
      version: input.layout.version,
    },
    tombstones: [...input.tombstones].sort((left, right) => left.id.localeCompare(right.id, "en")),
  });
}
