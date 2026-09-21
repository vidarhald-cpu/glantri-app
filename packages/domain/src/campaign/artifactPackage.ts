import { z } from "zod";
import { artifactMediaTypeSchema, artifactUploadMetadataSchema } from "./artifact";

export const ORDINARY_ARTIFACT_UPLOAD_PRODUCER = "glantri-app/ordinary-upload";

export const ARTIFACT_PACKAGE_LIMITS = {
  objects: 100,
  resources: 100,
  manifestBytes: 1024 * 1024,
  resourceBytes: 25 * 1024 * 1024,
  totalBytes: 100 * 1024 * 1024,
  references: 100,
  depth: 32,
} as const;
const localId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,100}$/)
  .refine(
    (value) => !["__proto__", "constructor", "prototype"].includes(value),
    "Reserved package identifier.",
  );
const identity = z.string().trim().min(1).max(200);
export const artifactPackageReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("local"), id: localId }).strict(),
  z.object({ kind: z.literal("existing"), artifactId: identity }).strict(),
]);
/**
 * Semantic facts for a proposed canonical Item. Technical identity is never
 * declared here: Glantri derives the database identity when the GM confirms.
 */
export const artifactPackageItemMetadataSchema = z
  .object({
    description: z.string().trim().max(4000).optional(),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const artifactPackageObjectSchema = z
  .object({
    id: localId,
    type: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,49}$/),
    optional: z.boolean().default(false),
    sourceId: identity.optional(),
    targetArtifactId: identity.optional(),
    resourceId: localId.optional(),
    metadata: artifactUploadMetadataSchema.optional(),
    itemMetadata: artifactPackageItemMetadataSchema.optional(),
    /** GM-private notes for the proposed Item or Artifact. Never player-facing. */
    gmNotes: z.string().trim().max(8000).optional(),
    /** Artifacts that represent this Item once the GM confirms. */
    attachments: z.array(artifactPackageReferenceSchema).max(100).default([]),
    /** Human-readable reference to another object; resolved server-side only. */
    relationshipLabel: z.string().trim().min(1).max(200).optional(),
    dependencies: z.array(artifactPackageReferenceSchema).max(100).default([]),
  })
  .strict();
export const artifactPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    packageId: identity,
    producer: identity,
    version: identity,
    title: z.string().trim().min(1).max(200),
    objects: z.array(artifactPackageObjectSchema).min(1).max(100),
    resources: z
      .array(
        z
          .object({
            id: localId,
            mediaType: artifactMediaTypeSchema,
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const entries of [value.objects, value.resources]) {
      if (new Set(entries.map((x) => x.id)).size !== entries.length)
        ctx.addIssue({ code: "custom", message: "Package identifiers must be unique." });
    }
    const sources = value.objects.flatMap((x) => (x.sourceId ? [x.sourceId] : []));
    if (new Set(sources).size !== sources.length)
      ctx.addIssue({ code: "custom", message: "Source identities must be unique." });
    if (value.objects.some((x) => /script|command|plugin|runtime|execute/i.test(x.type)))
      ctx.addIssue({ code: "custom", message: "Executable instructions are not supported." });
  });
export const artifactRelationshipTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), itemId: identity }).strict(),
  z.object({ kind: z.literal("artifact"), artifactId: identity }).strict(),
  z.object({ kind: z.literal("local"), id: localId }).strict(),
]);

/** A GM decision about one proposed relationship. `target: null` clears it. */
export const artifactRelationshipBindingSchema = z
  .object({ objectId: localId, target: artifactRelationshipTargetSchema.nullable() })
  .strict();

export const artifactImportSelectionSchema = z
  .object({
    bindings: z.array(artifactRelationshipBindingSchema).max(100).default([]),
    selected: z.array(localId).min(1).max(100),
  })
  .strict();
export const artifactImportAcceptanceSchema = z
  .object({ previewToken: z.string().uuid(), approvedUpdates: z.array(localId).max(100) })
  .strict();
export type ArtifactPackage = z.infer<typeof artifactPackageSchema>;
export type ArtifactPackageObject = ArtifactPackage["objects"][number];
export type ArtifactRelationshipTarget = z.infer<typeof artifactRelationshipTargetSchema>;
export type ArtifactRelationshipBinding = z.infer<typeof artifactRelationshipBindingSchema>;

/** Technical facts Glantri derived, shown so the GM can see they never supplied them. */
export interface ArtifactImportDerivedMetadata {
  byteSize: number;
  mediaType: string;
  originalFilename?: string;
  sha256: string;
  storageKey: string;
  storageProvider: string;
}

export type ArtifactRelationshipStatus =
  | "resolved"
  | "bound"
  | "ambiguous"
  | "not_found"
  | "unsupported"
  | "cleared";

export interface ArtifactRelationshipCandidate {
  kind: "item" | "artifact" | "local";
  id: string;
  label: string;
}

export interface ArtifactImportRelationshipPreview {
  label: string;
  status: ArtifactRelationshipStatus;
  candidates: ArtifactRelationshipCandidate[];
  target?: ArtifactRelationshipCandidate;
  explanation: string;
}

export interface ArtifactImportPreviewItem {
  id: string;
  title: string;
  selected: boolean;
  optional: boolean;
  status: "create" | "update" | "present" | "conflict" | "invalid";
  reasons: string[];
  warnings?: string[];
  targetArtifactId?: string;
  existingTitle?: string;
  expectedVersion?: number;
  resourceId?: string;
  /** Whether confirming creates a canonical Artifact or a canonical Item. */
  objectType?: "Artifact" | "Item";
  derived?: ArtifactImportDerivedMetadata;
  /** Local ids of the Artifacts that will represent this Item. */
  attachedObjectIds?: string[];
  attachedArtifactIds?: string[];
  relationship?: ArtifactImportRelationshipPreview;
  itemDescription?: string;
  gmNotes?: string;
}
export interface ArtifactImportPreview {
  id: string;
  title: string;
  state: string;
  previewToken: string;
  items: ArtifactImportPreviewItem[];
  valid: boolean;
  bindings?: ArtifactRelationshipBinding[];
  result?: Record<string, string>;
  error?: string;
}

/** References constrain acceptance only; they never publish or mutate consumers. */
export function validateArtifactSelection(
  manifest: ArtifactPackage,
  selected: readonly string[],
): Map<string, string[]> {
  const errors = new Map<string, string[]>();
  const objects = new Map(manifest.objects.map((x) => [x.id, x]));
  const chosen = new Set(selected);
  const add = (id: string, message: string) => errors.set(id, [...(errors.get(id) ?? []), message]);
  if (chosen.size !== selected.length) add("package", "Select each object only once.");
  for (const id of selected) if (!objects.has(id)) add(id, "Unknown object selection.");
  for (const object of manifest.objects) {
    if (!chosen.has(object.id)) {
      if (!object.optional) add(object.id, "Required content must remain selected.");
      continue;
    }
    if (!["Artifact", "Item"].includes(object.type))
      add(object.id, "This object type cannot be imported. Exclude optional unsupported content.");
    if (object.type === "Artifact") {
      if (!object.metadata || !manifest.resources.some((x) => x.id === object.resourceId))
        add(object.id, "Artifact metadata and a declared resource are required.");
      if (object.itemMetadata || object.attachments.length)
        add(object.id, "Only an Item may carry Item details or attached representations.");
    }
    if (object.type === "Item") {
      if (!object.itemMetadata) add(object.id, "Item details are required for a proposed Item.");
      if (object.metadata || object.resourceId || object.targetArtifactId || object.sourceId)
        add(
          object.id,
          "An Item never declares Artifact media, media identity or an update target.",
        );
      for (const attachment of object.attachments) {
        if (attachment.kind !== "local") continue;
        const attached = objects.get(attachment.id);
        if (!attached || attached.type !== "Artifact")
          add(object.id, "An attached representation must be an Artifact in this proposal.");
        else if (!chosen.has(attachment.id))
          add(
            object.id,
            "Keep the Artifact that represents this Item selected, or exclude the Item too.",
          );
      }
    }
    for (const dep of object.dependencies)
      if (dep.kind === "local" && !chosen.has(dep.id))
        add(object.id, "A required dependency is missing from the selection.");
    const depths = new Map<string, number>();
    const visit = (id: string, path: Set<string>): number => {
      if (path.has(id)) {
        add(object.id, "Dependency cycles are not supported.");
        return 0;
      }
      if (depths.has(id)) return depths.get(id)!;
      let depth = 1;
      for (const ref of objects.get(id)?.dependencies ?? []) {
        if (ref.kind === "local")
          depth = Math.max(depth, 1 + visit(ref.id, new Set([...path, id])));
      }
      depths.set(id, depth);
      return depth;
    };
    if (visit(object.id, new Set()) > ARTIFACT_PACKAGE_LIMITS.depth)
      add(object.id, "Dependency graph is too deep.");
  }
  return errors;
}
