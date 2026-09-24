import { z } from "zod";

/** A discriminated target keeps new target types explicit without a polymorphic FK. */
export const artifactAssociationTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), id: z.string().min(1) }).strict(),
]);

export const artifactAssociationRoleSchema = z.string().trim().min(1).max(100);
export const artifactAssociationProvenanceSchema = z
  .object({
    kind: z.enum(["manual", "upload", "import", "legacy"]),
    ref: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const artifactAssociationDtoSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  target: artifactAssociationTargetSchema,
  artifactId: z.string().min(1),
  role: artifactAssociationRoleSchema,
  revisionId: z.string().min(1).nullable(),
  provenance: artifactAssociationProvenanceSchema,
  attachedByUserId: z.string().min(1),
  createdAt: z.string().datetime(),
  disassociatedAt: z.string().datetime().nullable(),
  disassociatedByUserId: z.string().min(1).nullable(),
});

export type ArtifactAssociationTarget = z.infer<typeof artifactAssociationTargetSchema>;
export type ArtifactAssociationProvenance = z.infer<typeof artifactAssociationProvenanceSchema>;
export type ArtifactAssociationDto = z.infer<typeof artifactAssociationDtoSchema>;
