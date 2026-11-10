import os from "node:os";
import path from "node:path";

import { ArtifactStorageUnavailableError, type ArtifactBinaryStore } from "@glantri/database";

import { createManagedIdentityAzureArtifactStore } from "./azureArtifactBinaryStore";
import { LocalArtifactBinaryStore } from "./localArtifactBinaryStore";

class UnavailableArtifactBinaryStore implements ArtifactBinaryStore {
  readonly provider = "local" as const;

  private unavailable(): never {
    throw new ArtifactStorageUnavailableError();
  }

  async delete(): Promise<void> {
    this.unavailable();
  }
  async put(): Promise<never> {
    return this.unavailable();
  }
  async read(): Promise<never> {
    return this.unavailable();
  }
  async stat(): Promise<never> {
    return this.unavailable();
  }
}

export interface ArtifactStorageRuntime {
  enabled: boolean;
  store: ArtifactBinaryStore;
}

export function createArtifactStorageRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): ArtifactStorageRuntime {
  const provider =
    environment.ARTIFACT_STORAGE_PROVIDER?.trim().toLowerCase() ||
    (environment.NODE_ENV !== "production" ? "local" : undefined);

  if (provider === "local" && environment.NODE_ENV !== "production") {
    return {
      enabled: true,
      store: new LocalArtifactBinaryStore(
        environment.ARTIFACT_LOCAL_ROOT ?? path.join(os.tmpdir(), "glantri-artifacts-local"),
      ),
    };
  }

  if (provider === "local" && environment.NODE_ENV === "production") {
    // Explicit in-house opt-in only; never fall back to the temporary directory.
    const root = environment.ARTIFACT_LOCAL_ROOT;
    if (
      environment.ARTIFACT_LOCAL_ALLOW_PRODUCTION === "true" &&
      root !== undefined &&
      path.isAbsolute(root)
    ) {
      return { enabled: true, store: new LocalArtifactBinaryStore(root) };
    }
  }

  if (provider === "azure") {
    const accountUrl = environment.ARTIFACT_AZURE_ACCOUNT_URL?.trim();
    const containerName = environment.ARTIFACT_AZURE_CONTAINER?.trim();
    if (accountUrl && containerName) {
      return {
        enabled: true,
        store: createManagedIdentityAzureArtifactStore({ accountUrl, containerName }),
      };
    }
  }

  return { enabled: false, store: new UnavailableArtifactBinaryStore() };
}
