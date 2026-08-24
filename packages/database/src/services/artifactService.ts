import { randomUUID } from "node:crypto";

import {
  artifactBlackboardCandidateSchema,
  artifactCommonDtoSchema,
  artifactGmDtoSchema,
  scenarioArtifactReferenceDtoSchema,
  type ArtifactCommonDto,
  type ArtifactGmDto,
  type ArtifactMetadataUpdate,
  type ArtifactUploadMetadata,
  type ScenarioArtifactReferenceDto,
} from "@glantri/domain";

import {
  ArtifactStorageUnavailableError,
  type ArtifactBinaryReadResult,
  type ArtifactBinaryStore,
} from "../artifacts/artifactBinaryStore";
import {
  sanitizeArtifactFilename,
  validateArtifactUpload,
} from "../artifacts/artifactUploadValidation";
import { ArtifactRepository, type ArtifactRecord } from "../repositories/artifactRepository";
import { CampaignService } from "./campaignService";
import { ScenarioService } from "./scenarioService";

export class ArtifactNotFoundError extends Error {
  constructor() {
    super("Artifact not found.");
    this.name = "ArtifactNotFoundError";
  }
}

export class ArtifactConflictError extends Error {
  constructor(message = "Artifact changed. Refresh and review.") {
    super(message);
    this.name = "ArtifactConflictError";
  }
}

export class ArtifactLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactLifecycleError";
  }
}

function optionalString(value: string | null): string | undefined {
  return value ?? undefined;
}

function toGmDto(record: ArtifactRecord): ArtifactGmDto {
  return artifactGmDtoSchema.parse({
    altText: optionalString(record.altText),
    artifactKind: record.artifactKind ?? "image",
    audience: record.audience,
    byteSize: record.byteSize === null ? undefined : Number(record.byteSize),
    campaignId: record.campaignId,
    cleanupRequired: record.storageDeletePending,
    createdAt: record.createdAt.toISOString(),
    description: optionalString(record.description),
    digest: optionalString(record.sha256Digest),
    id: record.id,
    legacyNeedsUpload: record.storageState === "legacy_reference",
    lifecycle: record.lifecycleState,
    mediaType: optionalString(record.mediaTypeDetected),
    metadataVersion: record.metadataVersion,
    originalFilename: optionalString(record.originalFilename),
    provenanceKind: optionalString(record.provenanceKind),
    sourceLabel: optionalString(record.sourceLabel),
    sourceUri: optionalString(record.sourceUri),
    storageState: record.storageState,
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toCommonDto(
  record: ArtifactRecord,
  snapshot?: { altText?: string; caption?: string; title: string },
): ArtifactCommonDto {
  return artifactCommonDtoSchema.parse({
    altText: snapshot?.altText ?? optionalString(record.altText),
    artifactKind: record.artifactKind ?? "image",
    campaignId: record.campaignId,
    description: snapshot?.caption ?? optionalString(record.description),
    id: record.id,
    mediaType: optionalString(record.mediaTypeDetected),
    title: snapshot?.title ?? record.title,
  });
}

function ensureVisualAlt(record: ArtifactRecord, altText?: string | null): void {
  const visual = ["map", "image", "portrait"].includes(record.artifactKind ?? "image");
  if (visual && !(altText ?? record.altText)?.trim()) {
    throw new ArtifactLifecycleError("Add alt text before publishing visual content.");
  }
}

export class ArtifactService {
  constructor(
    private readonly store: ArtifactBinaryStore,
    private readonly repository = new ArtifactRepository(),
    private readonly campaignService = new CampaignService(),
    private readonly scenarioService = new ScenarioService(),
  ) {}

  async assertOwningGm(campaignId: string, userId: string): Promise<void> {
    await this.requireOwningGm(campaignId, userId);
  }

  async upload(input: {
    campaignId: string;
    content: AsyncIterable<Uint8Array>;
    declaredMediaType: string;
    metadata: ArtifactUploadMetadata;
    originalFilename?: string;
    userId: string;
    signal?: AbortSignal;
  }): Promise<ArtifactGmDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const artifactId = randomUUID();
    const storageKey = randomUUID().replaceAll("-", "");
    const validated = validateArtifactUpload({
      artifactKind: input.metadata.artifactKind,
      content: input.content,
      declaredMediaType: input.declaredMediaType,
    });
    void validated.result.catch(() => undefined);

    await this.repository.createPending({
      altText: input.metadata.altText,
      artifactKind: input.metadata.artifactKind,
      campaignId: input.campaignId,
      createdByUserId: input.userId,
      description: input.metadata.description,
      id: artifactId,
      originalFilename: sanitizeArtifactFilename(input.originalFilename),
      provenanceKind: input.metadata.provenanceKind,
      sourceLabel: input.metadata.sourceLabel,
      sourceUri: input.metadata.sourceUri,
      storageKey,
      storageProvider: this.store.provider,
      title: input.metadata.title,
    });

    let stored = false;
    try {
      const putResult = await this.store.put({
        content: validated.content,
        key: storageKey,
        signal: input.signal,
      });
      stored = true;
      const validation = await validated.result;
      if (
        putResult.byteSize !== validation.byteSize ||
        putResult.sha256Digest !== validation.sha256Digest
      ) {
        throw new Error("Artifact storage integrity check failed.");
      }
      return toGmDto(
        await this.repository.markReady({
          actorUserId: input.userId,
          artifactId,
          byteSize: validation.byteSize,
          mediaType: validation.mediaType,
          sha256Digest: validation.sha256Digest,
        }),
      );
    } catch (error) {
      await validated.result.catch(() => undefined);
      let cleanupPending = false;
      if (stored) {
        try {
          await this.store.delete(storageKey);
        } catch {
          cleanupPending = true;
        }
      }
      await this.repository.markFailed({ artifactId, cleanupPending });
      throw error;
    }
  }

  async listForGm(campaignId: string, userId: string): Promise<ArtifactGmDto[]> {
    await this.requireOwningGm(campaignId, userId);
    return (await this.repository.listForCampaign(campaignId)).map(toGmDto);
  }

  async getForGm(campaignId: string, artifactId: string, userId: string): Promise<ArtifactGmDto> {
    await this.requireOwningGm(campaignId, userId);
    const artifact = await this.repository.get(campaignId, artifactId);
    if (!artifact) throw new ArtifactNotFoundError();
    return toGmDto(artifact);
  }

  async listVisible(campaignId: string, userId: string): Promise<ArtifactCommonDto[]> {
    const owner = await this.repository.getCampaignOwner(campaignId);
    if (owner === userId) {
      return (await this.repository.listForCampaign(campaignId))
        .filter((record) => record.lifecycleState !== "deleted" && record.storageState === "ready")
        .map((record) => toCommonDto(record));
    }

    const accessibleCampaigns = await this.campaignService.listCampaignsByUserAccess(userId);
    if (!accessibleCampaigns.some((campaign) => campaign.id === campaignId)) {
      throw new ArtifactNotFoundError();
    }

    const visible = new Map<string, ArtifactCommonDto>();
    for (const artifact of await this.repository.listCampaignPublished(campaignId)) {
      visible.set(artifact.id, toCommonDto(artifact));
    }
    for (const reference of await this.repository.listScenarioPublished(campaignId)) {
      if (
        await this.scenarioService.userHasPlayerScenarioAccess({
          scenarioId: reference.scenarioId,
          userId,
        })
      ) {
        visible.set(
          reference.artifact.id,
          toCommonDto(reference.artifact, {
            altText: reference.altText,
            caption: reference.caption,
            title: reference.title,
          }),
        );
      }
    }
    return [...visible.values()].sort(
      (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
    );
  }

  async getVisible(
    campaignId: string,
    artifactId: string,
    userId: string,
  ): Promise<ArtifactCommonDto> {
    const visible = await this.listVisible(campaignId, userId);
    const artifact = visible.find((entry) => entry.id === artifactId);
    if (!artifact) throw new ArtifactNotFoundError();
    return artifact;
  }

  async readContent(input: {
    artifactId: string;
    campaignId: string;
    signal?: AbortSignal;
    userId: string;
  }): Promise<{ body: ArtifactBinaryReadResult; mediaType: string }> {
    await this.getVisible(input.campaignId, input.artifactId, input.userId);
    const artifact = await this.repository.get(input.campaignId, input.artifactId);
    if (
      !artifact ||
      artifact.storageState !== "ready" ||
      !artifact.storageKey ||
      artifact.storageProvider === "legacy"
    ) {
      throw new ArtifactNotFoundError();
    }
    if (artifact.storageProvider !== this.store.provider) {
      throw new ArtifactStorageUnavailableError();
    }
    const stat = await this.store.stat(artifact.storageKey);
    if (!stat || stat.byteSize !== Number(artifact.byteSize)) {
      throw new ArtifactStorageUnavailableError("Artifact content is temporarily unavailable.");
    }
    return {
      body: await this.store.read({ key: artifact.storageKey, signal: input.signal }),
      mediaType: artifact.mediaTypeDetected ?? "application/octet-stream",
    };
  }

  async updateMetadata(input: {
    artifactId: string;
    campaignId: string;
    update: ArtifactMetadataUpdate;
    userId: string;
  }): Promise<ArtifactGmDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const artifact = await this.repository.updateMetadata({
      actorUserId: input.userId,
      altText: input.update.altText,
      artifactId: input.artifactId,
      campaignId: input.campaignId,
      description: input.update.description,
      expectedVersion: input.update.expectedMetadataVersion,
      title: input.update.title,
    });
    if (!artifact) throw new ArtifactConflictError();
    return toGmDto(artifact);
  }

  async setAudience(input: {
    artifactId: string;
    audience: "gm_private" | "campaign";
    campaignId: string;
    expectedVersion: number;
    userId: string;
  }): Promise<ArtifactGmDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const current = await this.repository.get(input.campaignId, input.artifactId);
    if (!current) throw new ArtifactNotFoundError();
    if (input.audience === "campaign") ensureVisualAlt(current);
    const artifact = await this.repository.setAudience({
      actorUserId: input.userId,
      artifactId: input.artifactId,
      audience: input.audience,
      campaignId: input.campaignId,
      expectedVersion: input.expectedVersion,
    });
    if (!artifact) throw new ArtifactConflictError();
    return toGmDto(artifact);
  }

  async mutateScenarioReference(input: {
    action: "attach" | "publish" | "withdraw";
    altText?: string | null;
    artifactId: string;
    campaignId: string;
    caption?: string | null;
    expectedArtifactVersion: number;
    expectedReferenceVersion?: number;
    scenarioId: string;
    sortOrder?: number | null;
    title?: string;
    userId: string;
  }): Promise<{ artifact: ArtifactGmDto; reference: ScenarioArtifactReferenceDto }> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const current = await this.repository.get(input.campaignId, input.artifactId);
    if (!current) throw new ArtifactNotFoundError();
    const scenario = await this.scenarioService.getScenarioById(input.scenarioId);
    if (!scenario || scenario.campaignId !== input.campaignId) throw new ArtifactNotFoundError();
    if (input.action === "publish") ensureVisualAlt(current, input.altText);
    const result = await this.repository.mutateReference({
      ...input,
      actorUserId: input.userId,
    });
    if (!result) throw new ArtifactConflictError();
    return {
      artifact: toGmDto(result.artifact),
      reference: scenarioArtifactReferenceDtoSchema.parse({
        altText: optionalString(result.reference.altTextSnapshot),
        artifactId: result.reference.artifactId,
        caption: optionalString(result.reference.captionSnapshot),
        id: result.reference.id,
        scenarioId: result.reference.scenarioId,
        sortOrder: result.reference.sortOrder ?? undefined,
        state: result.reference.state,
        title: result.reference.titleSnapshot,
        version: result.reference.version,
      }),
    };
  }

  async setLifecycle(input: {
    artifactId: string;
    campaignId: string;
    expectedVersion: number;
    lifecycle: "active" | "archived";
    userId: string;
  }): Promise<ArtifactGmDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const artifact = await this.repository.setLifecycle({
      actorUserId: input.userId,
      artifactId: input.artifactId,
      campaignId: input.campaignId,
      expectedVersion: input.expectedVersion,
      lifecycle: input.lifecycle,
    });
    if (!artifact) throw new ArtifactConflictError();
    return toGmDto(artifact);
  }

  async delete(input: {
    artifactId: string;
    campaignId: string;
    expectedVersion: number;
    userId: string;
  }): Promise<ArtifactGmDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    let artifact;
    try {
      artifact = await this.repository.tombstone({
        actorUserId: input.userId,
        artifactId: input.artifactId,
        campaignId: input.campaignId,
        expectedVersion: input.expectedVersion,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("withdrawn")) {
        throw new ArtifactLifecycleError(error.message);
      }
      throw error;
    }
    if (!artifact) throw new ArtifactConflictError();

    if (artifact.storageKey && artifact.storageProvider !== "legacy") {
      let pending = false;
      try {
        if (artifact.storageProvider !== this.store.provider)
          throw new ArtifactStorageUnavailableError();
        await this.store.delete(artifact.storageKey);
      } catch {
        pending = true;
      }
      await this.repository.recordCleanup({
        actorUserId: input.userId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
        pending,
      });
      artifact = (await this.repository.get(input.campaignId, input.artifactId)) ?? artifact;
    }
    return toGmDto(artifact);
  }

  async retryCleanup(input: {
    artifactId: string;
    campaignId: string;
    userId: string;
  }): Promise<ArtifactGmDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    let artifact = await this.repository.get(input.campaignId, input.artifactId);
    if (!artifact || !artifact.storageDeletePending || !artifact.storageKey) {
      throw new ArtifactNotFoundError();
    }
    if (artifact.storageProvider === "legacy") throw new ArtifactNotFoundError();

    let pending = false;
    try {
      if (artifact.storageProvider !== this.store.provider) {
        throw new ArtifactStorageUnavailableError();
      }
      await this.store.delete(artifact.storageKey);
    } catch {
      pending = true;
    }
    await this.repository.recordCleanup({
      actorUserId: input.userId,
      artifactId: artifact.id,
      campaignId: artifact.campaignId,
      pending,
    });
    artifact = (await this.repository.get(input.campaignId, input.artifactId)) ?? artifact;
    if (pending) throw new ArtifactStorageUnavailableError("Artifact cleanup is still pending.");
    return toGmDto(artifact);
  }

  async listAudit(campaignId: string, artifactId: string, userId: string) {
    await this.requireOwningGm(campaignId, userId);
    if (!(await this.repository.get(campaignId, artifactId))) throw new ArtifactNotFoundError();
    return (await this.repository.listAudit(campaignId, artifactId)).map((event) => ({
      action: event.action,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString(),
      id: event.id,
      metadata: event.metadataJson,
    }));
  }

  async listReferencesForGm(
    campaignId: string,
    userId: string,
  ): Promise<ScenarioArtifactReferenceDto[]> {
    await this.requireOwningGm(campaignId, userId);
    return (await this.repository.listReferences(campaignId)).map((reference) =>
      scenarioArtifactReferenceDtoSchema.parse({
        altText: optionalString(reference.altTextSnapshot),
        artifactId: reference.artifactId,
        caption: optionalString(reference.captionSnapshot),
        id: reference.id,
        scenarioId: reference.scenarioId,
        sortOrder: reference.sortOrder ?? undefined,
        state: reference.state,
        title: reference.titleSnapshot,
        version: reference.version,
      }),
    );
  }

  async listBlackboardCandidates(campaignId: string, userId: string) {
    const owner = await this.repository.getCampaignOwner(campaignId);
    if (owner !== userId) {
      const campaigns = await this.campaignService.listCampaignsByUserAccess(userId);
      if (!campaigns.some((campaign) => campaign.id === campaignId)) {
        throw new ArtifactNotFoundError();
      }
    }
    return (await this.repository.listBlackboardCandidates(campaignId)).map((record) =>
      artifactBlackboardCandidateSchema.parse({
        altText: optionalString(record.altText),
        artifactKind: record.artifactKind,
        id: record.id,
        mediaType: record.mediaTypeDetected,
        title: record.title,
      }),
    );
  }

  private async requireOwningGm(campaignId: string, userId: string): Promise<void> {
    if ((await this.repository.getCampaignOwner(campaignId)) !== userId) {
      throw new ArtifactNotFoundError();
    }
  }
}
