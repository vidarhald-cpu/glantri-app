import type { ArtifactStorageProvider } from "@glantri/domain";

export interface ArtifactBinaryPutResult {
  byteSize: number;
  sha256Digest: string;
}

export interface ArtifactBinaryReadResult {
  byteSize: number;
  content: AsyncIterable<Uint8Array>;
}

export interface ArtifactBinaryStatResult {
  byteSize: number;
}

export interface ArtifactBinaryStore {
  readonly provider: Exclude<ArtifactStorageProvider, "legacy">;
  delete(key: string): Promise<void>;
  put(input: {
    content: AsyncIterable<Uint8Array>;
    key: string;
    signal?: AbortSignal;
  }): Promise<ArtifactBinaryPutResult>;
  read(input: { key: string; signal?: AbortSignal }): Promise<ArtifactBinaryReadResult>;
  stat(key: string): Promise<ArtifactBinaryStatResult | null>;
}

export class ArtifactStorageUnavailableError extends Error {
  constructor(message = "Artifact storage is unavailable.") {
    super(message);
    this.name = "ArtifactStorageUnavailableError";
  }
}
