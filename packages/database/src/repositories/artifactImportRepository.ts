import { randomUUID, createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  artifactPackageSchema,
  ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
  validateArtifactSelection,
  type ArtifactPackage,
  type ArtifactImportPreview,
  type ArtifactImportPreviewItem,
} from "@glantri/domain";
import { prisma } from "../client";
import { ArtifactConflictError, ArtifactNotFoundError } from "../services/artifactService";

export interface StagedResource {
  id: string;
  key: string;
  provider: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  filename?: string;
}
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const artifactObjectFingerprint = (manifest: ArtifactPackage, id: string) => {
  const object = manifest.objects.find((x) => x.id === id)!;
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...object,
        resource: manifest.resources.find((x) => x.id === object.resourceId),
      }),
    )
    .digest("hex");
};

export class ArtifactImportRepository {
  constructor(private readonly client: PrismaClient = prisma) {}
  async assertOwner(campaignId: string, actorUserId: string) {
    if (
      !(await this.client.campaign.findFirst({
        where: { id: campaignId, gmUserId: actorUserId },
        select: { id: true },
      }))
    )
      throw new ArtifactNotFoundError();
  }
  async create(campaignId: string, actorUserId: string, manifest: ArtifactPackage) {
    return this.client.artifactImportSession.create({
      data: { campaignId, actorUserId, manifestJson: json(manifest) },
    });
  }
  async get(campaignId: string, actorUserId: string, id: string) {
    await this.assertOwner(campaignId, actorUserId);
    const session = await this.client.artifactImportSession.findFirst({
      where: { id, campaignId, actorUserId },
    });
    if (!session) throw new ArtifactNotFoundError();
    return session;
  }
  async list(campaignId: string, actorUserId: string) {
    await this.assertOwner(campaignId, actorUserId);
    return this.client.artifactImportSession.findMany({
      where: { campaignId, actorUserId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async resources(id: string, resources: StagedResource[]) {
    const result = await this.client.artifactImportSession.updateMany({
      where: { id, state: "uploading" },
      data: { resourcesJson: json(resources) },
    });
    if (result.count !== 1) throw new ArtifactConflictError();
  }
  async ready(id: string) {
    const result = await this.client.artifactImportSession.updateMany({
      where: { id, state: "uploading" },
      data: { state: "ready" },
    });
    if (result.count !== 1) throw new ArtifactConflictError();
  }
  async failure(id: string, message: string) {
    await this.client.artifactImportSession.updateMany({
      where: { id, state: { notIn: ["accepted", "cleaning", "cleaned"] } },
      data: { error: message },
    });
  }
  private async plan(
    tx: Prisma.TransactionClient,
    campaignId: string,
    manifest: ArtifactPackage,
    selected: string[],
  ): Promise<ArtifactImportPreviewItem[]> {
    const errors = validateArtifactSelection(manifest, selected);
    const mappings = await tx.artifactSourceMapping.findMany({
      where: {
        campaignId,
        producer: manifest.producer,
        packageId: manifest.packageId,
        sourceId: {
          in: manifest.objects.flatMap((object) => (object.sourceId ? [object.sourceId] : [])),
        },
      },
    });
    const targetIds = [
      ...mappings.map((mapping) => mapping.artifactId),
      ...manifest.objects.flatMap((object) => [
        ...(object.targetArtifactId ? [object.targetArtifactId] : []),
        ...object.dependencies.flatMap((reference) =>
          reference.kind === "existing" ? [reference.artifactId] : [],
        ),
      ]),
    ];
    const assets = await tx.campaignAsset.findMany({
      where: { campaignId, id: { in: [...new Set(targetIds)] } },
    });
    const declaredDigests = manifest.resources.map((resource) => resource.sha256);
    const duplicateAssets = await tx.campaignAsset.findMany({
      where: {
        campaignId,
        lifecycleState: { not: "deleted" },
        sha256Digest: { in: declaredDigests },
        storageState: "ready",
      },
      select: { id: true, sha256Digest: true, title: true },
    });
    return manifest.objects.map((object) => {
      const reasons = [...(errors.get(object.id) ?? []), ...(errors.get("package") ?? [])];
      const warnings: string[] = [];
      const item: ArtifactImportPreviewItem = {
        id: object.id,
        title: object.metadata?.title ?? object.id,
        selected: selected.includes(object.id),
        optional: object.optional,
        status: "create",
        reasons,
        warnings,
        resourceId: object.resourceId,
      };
      if (
        manifest.resources.find((resource) => resource.id === object.resourceId)?.mediaType ===
          "application/pdf" &&
        ["map", "image", "portrait"].includes(object.metadata?.artifactKind ?? "")
      )
        reasons.push("Visual Artifacts require an image resource.");
      const source = object.sourceId
        ? mappings.find((x) => x.sourceId === object.sourceId)
        : undefined;
      const targetId = object.targetArtifactId ?? source?.artifactId;
      const resourceDigest = manifest.resources.find(
        (resource) => resource.id === object.resourceId,
      )?.sha256;
      if (!targetId && resourceDigest) {
        const matches = duplicateAssets.filter((asset) => asset.sha256Digest === resourceDigest);
        if (matches.length === 1)
          warnings.push(
            `The file matches existing Artifact “${matches[0]!.title}”. Accepting will still create a separate Artifact.`,
          );
        else if (matches.length > 1)
          warnings.push(
            `The file matches ${matches.length} existing Artifacts. Accepting will still create a separate Artifact.`,
          );
      }
      if (source && object.targetArtifactId && source.artifactId !== object.targetArtifactId)
        reasons.push("The explicit update target conflicts with the recorded source identity.");
      if (targetId) {
        const target = assets.find((x) => x.id === targetId);
        if (
          !target ||
          target.lifecycleState !== "active" ||
          target.storageState !== "ready" ||
          target.artifactKind !== object.metadata?.artifactKind
        ) {
          reasons.push("The update target is unavailable or incompatible.");
          item.status = "conflict";
        } else {
          item.targetArtifactId = target.id;
          item.existingTitle = target.title;
          item.expectedVersion = target.metadataVersion;
          const unchanged =
            source?.fingerprint === artifactObjectFingerprint(manifest, object.id) &&
            target.sha256Digest ===
              manifest.resources.find((x) => x.id === object.resourceId)?.sha256 &&
            target.title === object.metadata?.title &&
            (target.description ?? undefined) === object.metadata?.description &&
            (target.altText ?? undefined) === object.metadata?.altText;
          item.status = unchanged ? "present" : "update";
          if (
            target.audience !== "gm_private" &&
            ["map", "image", "portrait"].includes(target.artifactKind ?? "") &&
            !object.metadata?.altText?.trim()
          )
            reasons.push("Shared visual content needs alt text.");
        }
      }
      for (const ref of object.dependencies)
        if (
          ref.kind === "existing" &&
          !assets.some(
            (x) =>
              x.id === ref.artifactId &&
              x.storageState === "ready" &&
              x.lifecycleState !== "deleted",
          )
        )
          reasons.push("An existing Artifact dependency is unavailable in this Campaign.");
      if (
        targetId &&
        manifest.objects.filter(
          (other) =>
            (other.targetArtifactId ??
              mappings.find((mapping) => mapping.sourceId === other.sourceId)?.artifactId) ===
              targetId && selected.includes(other.id),
        ).length > 1
      )
        reasons.push("Select only one proposed update for each existing Artifact.");
      if (reasons.length) item.status = item.status === "conflict" ? "conflict" : "invalid";
      return item;
    });
  }
  async preview(
    campaignId: string,
    actorUserId: string,
    id: string,
    selected: string[],
  ): Promise<ArtifactImportPreview> {
    return this.client.$transaction(
      async (tx) => {
        await this.lockOwner(tx, campaignId, actorUserId);
        const session = await tx.artifactImportSession.findFirst({
          where: { id, campaignId, actorUserId },
        });
        if (!session) throw new ArtifactNotFoundError();
        if (!["ready", "review"].includes(session.state))
          throw new ArtifactConflictError("This import is no longer available for review.");
        const manifest = artifactPackageSchema.parse(session.manifestJson);
        const items = await this.plan(tx, campaignId, manifest, selected);
        const structural = validateArtifactSelection(manifest, selected);
        const preview: ArtifactImportPreview = {
          id,
          title: manifest.title,
          state: "review",
          previewToken: randomUUID(),
          items,
          valid:
            structural.size === 0 &&
            items
              .filter((x) => x.selected)
              .every((x) => !["invalid", "conflict"].includes(x.status)),
        };
        await tx.artifactImportSession.update({
          where: { id },
          data: {
            state: "review",
            previewToken: preview.previewToken,
            previewJson: json(preview),
            error: null,
          },
        });
        return preview;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
  }
  async accept(
    campaignId: string,
    actorUserId: string,
    id: string,
    token: string,
    approvedUpdates: string[],
  ) {
    return this.client.$transaction(
      async (tx) => {
        await this.lockOwner(tx, campaignId, actorUserId);
        const session = await tx.artifactImportSession.findFirst({
          where: { id, campaignId, actorUserId },
        });
        if (!session) throw new ArtifactNotFoundError();
        if (session.previewToken !== token)
          throw new ArtifactConflictError("Review the latest preview before accepting.");
        if (session.state === "accepted") return session.resultJson as Record<string, string>;
        if (session.state !== "review") throw new ArtifactConflictError();
        const preview = session.previewJson as unknown as ArtifactImportPreview;
        if (!preview.valid)
          throw new ArtifactConflictError("Resolve the selected content before accepting.");
        const manifest = artifactPackageSchema.parse(session.manifestJson);
        const selected = preview.items.filter((x) => x.selected).map((x) => x.id);
        const items = await this.plan(tx, campaignId, manifest, selected);
        if (canonical(items) !== canonical(preview.items))
          throw new ArtifactConflictError(
            "Content changed since review. Refresh the preview and approve again.",
          );
        const targets = items.filter((x) => x.selected && x.status === "update");
        if (
          targets.some((x) => !approvedUpdates.includes(x.id)) ||
          approvedUpdates.some((id) => !targets.some((x) => x.id === id))
        )
          throw new ArtifactConflictError("Approve each proposed update explicitly.");
        const resources = session.resourcesJson as unknown as StagedResource[];
        const result: Record<string, string> = {};
        for (const item of items.filter((x) => x.selected)) {
          if (item.status === "present") {
            result[item.id] = item.targetArtifactId!;
            continue;
          }
          const object = manifest.objects.find((x) => x.id === item.id)!;
          const resource = resources.find((x) => x.id === object.resourceId)!;
          if (!resource || !object.metadata) throw new ArtifactConflictError();
          const artifactId = item.targetArtifactId ?? randomUUID();
          const metadata = object.metadata;
          const ordinaryUpload =
            manifest.producer === ORDINARY_ARTIFACT_UPLOAD_PRODUCER &&
            !object.sourceId &&
            !object.targetArtifactId;
          const representation = {
            storageKey: resource.key,
            storageProvider: resource.provider,
            byteSize: BigInt(resource.byteSize),
            mediaTypeDetected: resource.mediaType,
            mimeType: resource.mediaType,
            sha256Digest: resource.sha256,
            originalFilename: resource.filename,
          };
          if (item.status === "create") {
            await tx.campaignAsset.create({
              data: {
                id: artifactId,
                campaignId,
                createdByUserId: actorUserId,
                title: metadata.title,
                artifactKind: metadata.artifactKind,
                type: metadata.artifactKind === "portrait" ? "image" : metadata.artifactKind,
                description: metadata.description,
                altText: metadata.altText,
                provenanceKind: ordinaryUpload ? metadata.provenanceKind : "imported",
                sourceLabel: ordinaryUpload
                  ? metadata.sourceLabel
                  : (metadata.sourceLabel ?? manifest.producer),
                sourceUri: metadata.sourceUri,
                audience: "gm_private",
                visibility: "gm_only",
                lifecycleState: "active",
                storageState: "ready",
                storageUrl: `artifact-internal:${artifactId}`,
                ...representation,
              },
            });
          } else {
            const updated = await tx.campaignAsset.updateMany({
              where: {
                id: artifactId,
                campaignId,
                metadataVersion: item.expectedVersion,
                lifecycleState: "active",
              },
              data: {
                title: metadata.title,
                description: metadata.description ?? null,
                altText: metadata.altText ?? null,
                metadataVersion: { increment: 1 },
                ...representation,
              },
            });
            if (updated.count !== 1) throw new ArtifactConflictError();
          }
          const last = await tx.artifactRevision.aggregate({
            where: { artifactId },
            _max: { number: true },
          });
          const revision = await tx.artifactRevision.create({
            data: {
              artifactId,
              number: (last._max.number ?? 0) + 1,
              storageKey: resource.key,
              storageProvider: resource.provider,
              byteSize: BigInt(resource.byteSize),
              mediaType: resource.mediaType,
              sha256Digest: resource.sha256,
              originalFilename: resource.filename,
              actorUserId,
              note: ordinaryUpload
                ? "Uploaded through Artifact review"
                : `Imported from ${manifest.title} (${manifest.version})`,
            },
          });
          await tx.campaignAsset.update({
            where: { id: artifactId },
            data: { currentRevisionId: revision.id },
          });
          if (object.sourceId)
            await tx.artifactSourceMapping.upsert({
              where: {
                campaignId_producer_packageId_sourceId: {
                  campaignId,
                  producer: manifest.producer,
                  packageId: manifest.packageId,
                  sourceId: object.sourceId,
                },
              },
              create: {
                campaignId,
                producer: manifest.producer,
                packageId: manifest.packageId,
                sourceId: object.sourceId,
                artifactId,
                fingerprint: artifactObjectFingerprint(manifest, object.id),
                importId: id,
              },
              update: { fingerprint: artifactObjectFingerprint(manifest, object.id), importId: id },
            });
          await tx.artifactAuditEvent.create({
            data: {
              campaignId,
              artifactId,
              actorUserId,
              action: item.status === "create" ? "import_create" : "revision",
              metadataJson: {
                importId: id,
                packageId: manifest.packageId,
                version: manifest.version,
                localId: item.id,
                dependencies: json(object.dependencies),
              },
            },
          });
          result[item.id] = artifactId;
        }
        await tx.artifactImportSession.update({
          where: { id },
          data: {
            state: "accepted",
            resultJson: json(result),
            error: null,
            previewJson: json({
              ...preview,
              approvedUpdates,
              acceptedAt: new Date().toISOString(),
            }),
          },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
  }
  private async lockOwner(tx: Prisma.TransactionClient, campaignId: string, actorUserId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Campaign" WHERE "id" = ${campaignId} AND "gmUserId" = ${actorUserId} FOR UPDATE`,
    );
    if (!rows.length) throw new ArtifactNotFoundError();
  }
  async claimCleanup(campaignId: string, actorUserId: string, id: string, abortUnaccepted = false) {
    if (!abortUnaccepted) await this.get(campaignId, actorUserId, id);
    return this.client.$transaction(async (tx) => {
      if (!abortUnaccepted) await this.lockOwner(tx, campaignId, actorUserId);
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "ArtifactImportSession" WHERE "id" = ${id} AND "campaignId" = ${campaignId} AND "actorUserId" = ${actorUserId} FOR UPDATE`,
      );
      if (!rows.length) throw new ArtifactNotFoundError();
      const session = await tx.artifactImportSession.findUniqueOrThrow({ where: { id } });
      // An in-flight upload may lose authority; compensation still removes only
      // its own unaccepted bytes and can never remove an accepted revision.
      if (abortUnaccepted && session.state === "accepted") return [];
      await tx.artifactImportSession.update({
        where: { id },
        data: {
          state: session.state === "accepted" ? "accepted" : "cleaning",
          cleanupPending: true,
        },
      });
      const resources = session.resourcesJson as unknown as StagedResource[];
      const retained = await tx.artifactRevision.findMany({
        where: { storageKey: { in: resources.map((x) => x.key) } },
        select: { storageKey: true },
      });
      return resources.filter((x) => !retained.some((r) => r.storageKey === x.key));
    });
  }
  async cleaned(id: string, pending: boolean) {
    await this.client.artifactImportSession.updateMany({
      where: { id, state: "cleaning" },
      data: { state: pending ? "cleaning" : "cleaned", cleanupPending: pending },
    });
    await this.client.artifactImportSession.updateMany({
      where: { id, state: "accepted" },
      data: { cleanupPending: pending },
    });
  }
}
