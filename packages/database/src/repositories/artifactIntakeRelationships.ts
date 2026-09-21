import { Prisma } from "@prisma/client";
import {
  normalizeIntakeLabel,
  type ArtifactImportRelationshipPreview,
  type ArtifactPackage,
  type ArtifactPackageObject,
  type ArtifactRelationshipBinding,
  type ArtifactRelationshipCandidate,
} from "@glantri/domain";

/**
 * Conservative resolution of a human-readable relationship.
 *
 * A relationship is proposed automatically only when the supplied name matches
 * exactly one candidate, on an exact case-insensitive whitespace-normalized
 * comparison. Zero matches and several matches are both surfaced to the GM for
 * binding; neither is ever guessed at, and neither can be confirmed as is.
 */
const CANDIDATE_LIMIT = 200;

export interface RelationshipContext {
  /** Normalized label to the campaign Items carrying it. */
  itemsByLabel: Map<string, ArtifactRelationshipCandidate[]>;
  /** Normalized label to the campaign Artifacts carrying it. */
  artifactsByLabel: Map<string, ArtifactRelationshipCandidate[]>;
  /** Identity lookups used to validate an explicit GM binding. */
  itemsById: Map<string, string>;
  artifactsById: Map<string, string>;
}

export function objectLabel(object: ArtifactPackageObject): string {
  return object.itemMetadata?.title ?? object.metadata?.title ?? object.id;
}

function localCandidates(
  manifest: ArtifactPackage,
  selfId: string,
): Map<string, ArtifactRelationshipCandidate[]> {
  const grouped = new Map<string, ArtifactRelationshipCandidate[]>();
  for (const object of manifest.objects) {
    if (object.id === selfId) continue;
    const label = objectLabel(object);
    const key = normalizeIntakeLabel(label);
    grouped.set(key, [...(grouped.get(key) ?? []), { kind: "local", id: object.id, label }]);
  }
  return grouped;
}

export async function loadRelationshipContext(
  tx: Prisma.TransactionClient,
  campaignId: string,
  manifest: ArtifactPackage,
  bindings: readonly ArtifactRelationshipBinding[],
): Promise<RelationshipContext> {
  const labels = [
    ...new Set(
      manifest.objects.flatMap((object) =>
        object.relationshipLabel ? [normalizeIntakeLabel(object.relationshipLabel)] : [],
      ),
    ),
  ];
  const boundItemIds = bindings.flatMap((binding) =>
    binding.target?.kind === "item" ? [binding.target.itemId] : [],
  );
  const boundArtifactIds = [
    ...bindings.flatMap((binding) =>
      binding.target?.kind === "artifact" ? [binding.target.artifactId] : [],
    ),
    ...manifest.objects.flatMap((object) =>
      object.attachments.flatMap((attachment) =>
        attachment.kind === "existing" ? [attachment.artifactId] : [],
      ),
    ),
  ];

  const matchedItems = labels.length
    ? await tx.$queryRaw<Array<{ id: string; label: string }>>(Prisma.sql`
        SELECT "id", COALESCE("displayName", '') AS "label"
        FROM "CharacterEquipmentItem"
        WHERE "campaignContextId" = ${campaignId}
          AND lower(regexp_replace(btrim(COALESCE("displayName", '')), '\\s+', ' ', 'g')) = ANY(${labels})
        ORDER BY "id"
        LIMIT ${CANDIDATE_LIMIT}`)
    : [];
  const matchedArtifacts = labels.length
    ? await tx.$queryRaw<Array<{ id: string; label: string }>>(Prisma.sql`
        SELECT "id", "title" AS "label"
        FROM "CampaignAsset"
        WHERE "campaignId" = ${campaignId}
          AND "lifecycleState" = 'active'
          AND "storageState" = 'ready'
          AND lower(regexp_replace(btrim("title"), '\\s+', ' ', 'g')) = ANY(${labels})
        ORDER BY "id"
        LIMIT ${CANDIDATE_LIMIT}`)
    : [];

  const boundItems = boundItemIds.length
    ? await tx.characterEquipmentItem.findMany({
        select: { displayName: true, id: true },
        where: { campaignContextId: campaignId, id: { in: [...new Set(boundItemIds)] } },
      })
    : [];
  const boundArtifacts = boundArtifactIds.length
    ? await tx.campaignAsset.findMany({
        select: { id: true, title: true },
        where: {
          campaignId,
          id: { in: [...new Set(boundArtifactIds)] },
          lifecycleState: "active",
          storageState: "ready",
        },
      })
    : [];

  const groupItems = (rows: Array<{ id: string; label: string }>) => {
    const grouped = new Map<string, ArtifactRelationshipCandidate[]>();
    for (const row of rows) {
      const key = normalizeIntakeLabel(row.label);
      grouped.set(key, [
        ...(grouped.get(key) ?? []),
        { kind: "item", id: row.id, label: row.label },
      ]);
    }
    return grouped;
  };
  const itemsByLabel = groupItems(matchedItems);
  const artifactsByLabel = new Map<string, ArtifactRelationshipCandidate[]>();
  for (const row of matchedArtifacts) {
    const key = normalizeIntakeLabel(row.label);
    artifactsByLabel.set(key, [
      ...(artifactsByLabel.get(key) ?? []),
      { kind: "artifact", id: row.id, label: row.label },
    ]);
  }

  return {
    artifactsByLabel,
    artifactsById: new Map([
      ...boundArtifacts.map((row) => [row.id, row.title] as const),
      ...matchedArtifacts.map((row) => [row.id, row.label] as const),
    ]),
    itemsByLabel,
    itemsById: new Map([
      ...boundItems.map((row) => [row.id, row.displayName ?? row.id] as const),
      ...matchedItems.map((row) => [row.id, row.label] as const),
    ]),
  };
}

function localTarget(
  manifest: ArtifactPackage,
  id: string,
): ArtifactRelationshipCandidate | undefined {
  const object = manifest.objects.find((candidate) => candidate.id === id);
  return object ? { kind: "local", id, label: objectLabel(object) } : undefined;
}

function targetObjectType(
  target: ArtifactRelationshipCandidate,
  manifest: ArtifactPackage,
): string | undefined {
  if (target.kind === "item") return "Item";
  if (target.kind === "artifact") return "Artifact";
  return manifest.objects.find((object) => object.id === target.id)?.type;
}

/** Only the Item/Artifact representation pair from #268 is expressible in V1. */
function compatible(objectType: string, targetType: string | undefined): boolean {
  return (
    (objectType === "Artifact" && targetType === "Item") ||
    (objectType === "Item" && targetType === "Artifact")
  );
}

export function resolveRelationship(input: {
  binding: ArtifactRelationshipBinding | undefined;
  context: RelationshipContext;
  manifest: ArtifactPackage;
  object: ArtifactPackageObject;
}): ArtifactImportRelationshipPreview | undefined {
  const { binding, context, manifest, object } = input;
  const label = object.relationshipLabel;
  if (!label) return undefined;
  const key = normalizeIntakeLabel(label);
  const candidates = [
    ...(context.itemsByLabel.get(key) ?? []),
    ...(context.artifactsByLabel.get(key) ?? []),
    ...(localCandidates(manifest, object.id).get(key) ?? []),
  ];

  if (binding && binding.target === null)
    return {
      candidates,
      explanation: `You cleared the suggested link to “${label}”. Nothing will be linked.`,
      label,
      status: "cleared",
    };

  if (binding?.target) {
    const target = binding.target;
    const bound: ArtifactRelationshipCandidate | undefined =
      target.kind === "item"
        ? context.itemsById.has(target.itemId)
          ? { kind: "item", id: target.itemId, label: context.itemsById.get(target.itemId)! }
          : undefined
        : target.kind === "artifact"
          ? context.artifactsById.has(target.artifactId)
            ? {
                kind: "artifact",
                id: target.artifactId,
                label: context.artifactsById.get(target.artifactId)!,
              }
            : undefined
          : localTarget(manifest, target.id);
    if (!bound)
      return {
        candidates,
        explanation: `The target you chose for \u201c${label}\u201d is no longer available. Choose another, or clear the link.`,
        label,
        status: "not_found",
      };
    if (!compatible(object.type, targetObjectType(bound, manifest)))
      return {
        candidates,
        explanation:
          "This version can only attach an Artifact to an Item as its representation. Choose an Item, or clear the link.",
        label,
        status: "unsupported",
        target: bound,
      };
    return {
      candidates,
      explanation: `You bound \u201c${label}\u201d to \u201c${bound.label}\u201d.`,
      label,
      status: "bound",
      target: bound,
    };
  }

  if (candidates.length === 0)
    return {
      candidates,
      explanation: `Nothing in this Campaign or this proposal is named “${label}”. Glantri will not guess — choose a target or clear the link before confirming.`,
      label,
      status: "not_found",
    };
  if (candidates.length > 1)
    return {
      candidates,
      explanation: `“${label}” matches ${candidates.length} candidates. Glantri will not guess — choose one or clear the link before confirming.`,
      label,
      status: "ambiguous",
    };
  const only = candidates[0]!;
  if (!compatible(object.type, targetObjectType(only, manifest)))
    return {
      candidates,
      explanation:
        "This version can only attach an Artifact to an Item as its representation. Choose an Item, or clear the link.",
      label,
      status: "unsupported",
      target: only,
    };
  return {
    candidates,
    explanation: `“${label}” matched exactly one candidate, “${only.label}”. Change it or clear it if that is wrong.`,
    label,
    status: "resolved",
    target: only,
  };
}

/** Statuses the GM must still resolve; confirmation stays blocked until they do. */
export function relationshipBlocks(relationship: ArtifactImportRelationshipPreview): boolean {
  return ["ambiguous", "not_found", "unsupported"].includes(relationship.status);
}
