import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import type {
  ArtifactBinaryReadResult,
  ArtifactBinaryStatResult,
  ArtifactBinaryStore,
} from "@glantri/database";

function validateKey(key: string): void {
  if (!/^[a-f0-9]{32,64}$/.test(key)) throw new Error("Invalid Artifact storage key.");
}

export class AzureArtifactBinaryStore implements ArtifactBinaryStore {
  readonly provider = "azure" as const;

  constructor(private readonly container: ContainerClient) {}

  async put(input: { content: AsyncIterable<Uint8Array>; key: string; signal?: AbortSignal }) {
    validateKey(input.key);
    const digest = createHash("sha256");
    let byteSize = 0;
    const measuredContent = (async function* () {
      for await (const rawChunk of input.content) {
        const chunk = Buffer.from(rawChunk);
        byteSize += chunk.byteLength;
        digest.update(chunk);
        yield chunk;
      }
    })();
    await this.container
      .getBlockBlobClient(input.key)
      .uploadStream(Readable.from(measuredContent), 64 * 1024, 1, {
        abortSignal: input.signal,
        conditions: { ifNoneMatch: "*" },
      });
    return { byteSize, sha256Digest: digest.digest("hex") };
  }

  async read(input: { key: string; signal?: AbortSignal }): Promise<ArtifactBinaryReadResult> {
    validateKey(input.key);
    const response = await this.container.getBlobClient(input.key).download(0, undefined, {
      abortSignal: input.signal,
    });
    if (!response.readableStreamBody) throw new Error("Artifact object body unavailable.");
    const body = response.readableStreamBody;
    return {
      byteSize: response.contentLength ?? 0,
      content: (async function* () {
        for await (const chunk of body) yield Buffer.from(chunk);
      })(),
    };
  }

  async stat(key: string): Promise<ArtifactBinaryStatResult | null> {
    validateKey(key);
    try {
      const response = await this.container.getBlobClient(key).download();
      if (!response.readableStreamBody) throw new Error("Artifact object body unavailable.");
      const digest = createHash("sha256");
      let byteSize = 0;
      for await (const rawChunk of response.readableStreamBody) {
        const chunk = Buffer.from(rawChunk);
        byteSize += chunk.byteLength;
        digest.update(chunk);
      }
      if (response.contentLength !== undefined && response.contentLength !== byteSize) {
        throw new Error("Artifact object size changed during integrity verification.");
      }
      return { byteSize, sha256Digest: digest.digest("hex") };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    validateKey(key);
    await this.container.getBlobClient(key).deleteIfExists({ deleteSnapshots: "include" });
  }
}

export function createManagedIdentityAzureArtifactStore(input: {
  accountUrl: string;
  containerName: string;
}): AzureArtifactBinaryStore {
  const service = new BlobServiceClient(input.accountUrl, new DefaultAzureCredential());
  return new AzureArtifactBinaryStore(service.getContainerClient(input.containerName));
}
