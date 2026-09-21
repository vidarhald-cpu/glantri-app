import { randomUUID } from "node:crypto";
import {
  artifactPackageSchema,
  type ArtifactImportPreview,
  type ArtifactPackage,
  type ArtifactRelationshipBinding,
  ARTIFACT_PACKAGE_LIMITS,
} from "@glantri/domain";
import {
  ArtifactImportRepository,
  type StagedResource,
} from "../repositories/artifactImportRepository";
import {
  type ArtifactBinaryStore,
  ArtifactStorageUnavailableError,
} from "../artifacts/artifactBinaryStore";
import {
  validateArtifactUpload,
  sanitizeArtifactFilename,
  ArtifactUploadValidationError,
} from "../artifacts/artifactUploadValidation";
import { ArtifactConflictError, ArtifactNotFoundError } from "./artifactService";

export class ArtifactImportService {
  constructor(
    private readonly store: ArtifactBinaryStore,
    private readonly repository = new ArtifactImportRepository(),
  ) {}
  async begin(campaignId: string, userId: string, input: unknown) {
    await this.repository.assertOwner(campaignId, userId);
    const manifest = artifactPackageSchema.parse(input);
    return this.repository.create(campaignId, userId, manifest);
  }
  async assertOwner(campaignId: string, userId: string) {
    return this.repository.assertOwner(campaignId, userId);
  }
  async uploadResource(input: {
    campaignId: string;
    userId: string;
    id: string;
    resourceId: string;
    content: AsyncIterable<Uint8Array>;
    mediaType: string;
    filename?: string;
  }) {
    const session = await this.repository.get(input.campaignId, input.userId, input.id);
    if (session.state !== "uploading") throw new ArtifactConflictError();
    const manifest = artifactPackageSchema.parse(session.manifestJson);
    const declaration = manifest.resources.find((x) => x.id === input.resourceId);
    const resources = session.resourcesJson as unknown as StagedResource[];
    if (
      !declaration ||
      resources.some((x) => x.id === input.resourceId) ||
      declaration.mediaType !== input.mediaType
    )
      throw new ArtifactUploadValidationError("Unexpected or duplicate package resource.");
    const remaining =
      ARTIFACT_PACKAGE_LIMITS.totalBytes - resources.reduce((sum, x) => sum + x.byteSize, 0);
    const limited = async function* () {
      let bytes = 0;
      for await (const chunk of input.content) {
        bytes += chunk.length;
        if (bytes > remaining)
          throw new ArtifactUploadValidationError("The package exceeds 100 MiB.");
        yield chunk;
      }
    };
    const validated = validateArtifactUpload({
      artifactKind: declaration.mediaType === "application/pdf" ? "document" : "image",
      content: limited(),
      declaredMediaType: input.mediaType,
    });
    void validated.result.catch(() => undefined);
    const resource: StagedResource = {
      id: input.resourceId,
      key: randomUUID().replaceAll("-", ""),
      provider: this.store.provider,
      mediaType: input.mediaType,
      byteSize: 0,
      sha256: declaration.sha256,
      filename: sanitizeArtifactFilename(input.filename),
    };
    resources.push(resource);
    // Persist the opaque key before touching storage so interrupted uploads remain cleanable.
    await this.repository.resources(session.id, resources);
    const written = await this.store.put({ key: resource.key, content: validated.content });
    const result = await validated.result;
    if (
      result.sha256Digest !== declaration.sha256 ||
      result.sha256Digest !== written.sha256Digest ||
      result.byteSize !== written.byteSize
    )
      throw new ArtifactUploadValidationError("A package resource failed its integrity check.");
    resource.byteSize = result.byteSize;
    await this.repository.resources(session.id, resources);
  }
  async finish(campaignId: string, userId: string, id: string) {
    const session = await this.repository.get(campaignId, userId, id);
    const manifest = artifactPackageSchema.parse(session.manifestJson);
    const resources = session.resourcesJson as unknown as StagedResource[];
    if (resources.length !== manifest.resources.length || resources.some((x) => !x.byteSize))
      throw new ArtifactUploadValidationError("Package resources are incomplete.");
    await this.repository.ready(id);
    return this.repository.preview(
      campaignId,
      userId,
      id,
      manifest.objects.map((x) => x.id),
    );
  }
  async preview(
    campaignId: string,
    userId: string,
    id: string,
    selected: string[],
    bindings: ArtifactRelationshipBinding[] = [],
  ) {
    return this.repository.preview(campaignId, userId, id, selected, bindings);
  }
  async get(campaignId: string, userId: string, id: string): Promise<ArtifactImportPreview> {
    const session = await this.repository.get(campaignId, userId, id);
    const manifest = artifactPackageSchema.parse(session.manifestJson);
    return {
      ...((session.previewJson as unknown as ArtifactImportPreview) ?? {
        id,
        title: manifest.title,
        items: [],
        valid: false,
        previewToken: "",
      }),
      state: session.state,
      result: session.resultJson as Record<string, string> | undefined,
      error: session.error ?? undefined,
    };
  }
  async list(campaignId: string, userId: string) {
    return (await this.repository.list(campaignId, userId)).map((x) => ({
      id: x.id,
      title: (x.manifestJson as unknown as ArtifactPackage).title,
      state: x.state,
      createdAt: x.createdAt.toISOString(),
      error: x.error,
      cleanupPending: x.cleanupPending,
    }));
  }
  async accept(
    campaignId: string,
    userId: string,
    id: string,
    token: string,
    approvedUpdates: string[],
  ) {
    const session = await this.repository.get(campaignId, userId, id);
    try {
      if (session.state !== "accepted") {
        const preview = session.previewJson as unknown as ArtifactImportPreview | null;
        const resources = session.resourcesJson as unknown as StagedResource[];
        for (const resource of resources.filter((r) =>
          preview?.items.some((x) => x.selected && x.resourceId === r.id && x.status !== "present"),
        ))
          await this.verifyResource(resource);
      }
      await this.repository.accept(campaignId, userId, id, token, approvedUpdates);
      return this.get(campaignId, userId, id);
    } catch (error) {
      const conflict =
        error instanceof ArtifactConflictError ||
        ["P2034", "P2002"].includes((error as { code?: string }).code ?? "");
      const message = conflict
        ? "Content changed or approval is incomplete. Refresh the preview and review again."
        : "Import could not complete. No partial content was accepted. Retry after checking storage.";
      await this.repository.failure(id, message);
      if (conflict) throw new ArtifactConflictError(message);
      throw error;
    }
  }
  async read(campaignId: string, userId: string, id: string, resourceId: string) {
    const session = await this.repository.get(campaignId, userId, id);
    if (!["ready", "review"].includes(session.state)) throw new ArtifactNotFoundError();
    const resource = (session.resourcesJson as unknown as StagedResource[]).find(
      (x) => x.id === resourceId,
    );
    if (!resource) throw new ArtifactNotFoundError();
    await this.verifyResource(resource);
    return { mediaType: resource.mediaType, body: await this.store.read({ key: resource.key }) };
  }
  private async verifyResource(resource: StagedResource) {
    if (resource.provider !== this.store.provider) throw new ArtifactStorageUnavailableError();
    const stat = await this.store.stat(resource.key);
    if (!stat || stat.byteSize !== resource.byteSize || stat.sha256Digest !== resource.sha256)
      throw new ArtifactStorageUnavailableError();
  }
  async cleanup(campaignId: string, userId: string, id: string) {
    const resources = await this.repository.claimCleanup(campaignId, userId, id);
    return this.cleanResources(id, resources);
  }
  private async cleanResources(id: string, resources: StagedResource[]) {
    let pending = false;
    for (const resource of resources) {
      try {
        if (resource.provider !== this.store.provider) throw new ArtifactStorageUnavailableError();
        await this.store.delete(resource.key);
      } catch {
        pending = true;
      }
    }
    await this.repository.cleaned(id, pending);
    return { cleanupPending: pending };
  }
  async abort(campaignId: string, userId: string, id: string) {
    await this.repository.failure(id, "Package upload failed. No content was accepted.");
    await this.cleanResources(id, await this.repository.claimCleanup(campaignId, userId, id, true));
  }
}
