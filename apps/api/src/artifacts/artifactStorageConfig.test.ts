import { describe, expect, it } from "vitest";

import { ArtifactStorageUnavailableError } from "@glantri/database";

import { createArtifactStorageRuntime } from "./artifactStorageConfig";

describe("Artifact storage configuration", () => {
  it("fails closed in production when private Azure configuration is incomplete", async () => {
    const runtime = createArtifactStorageRuntime({ NODE_ENV: "production" });
    expect(runtime.enabled).toBe(false);
    await expect(runtime.store.stat("a".repeat(32))).rejects.toBeInstanceOf(
      ArtifactStorageUnavailableError,
    );
  });

  it("allows an explicit private local root only outside production", () => {
    const runtime = createArtifactStorageRuntime({
      ARTIFACT_LOCAL_ROOT: "/tmp/artifacts-test",
      ARTIFACT_STORAGE_PROVIDER: "local",
      NODE_ENV: "test",
    });
    expect(runtime.enabled).toBe(true);
    expect(runtime.store.provider).toBe("local");
    expect(
      createArtifactStorageRuntime({
        ARTIFACT_LOCAL_ROOT: "/tmp/artifacts-test",
        ARTIFACT_STORAGE_PROVIDER: "local",
        NODE_ENV: "production",
      }).enabled,
    ).toBe(false);
  });

  describe("production local opt-in", () => {
    const optIn = {
      ARTIFACT_LOCAL_ALLOW_PRODUCTION: "true",
      ARTIFACT_LOCAL_ROOT: "/var/glantri/artifacts",
      ARTIFACT_STORAGE_PROVIDER: "local",
      NODE_ENV: "production",
    };

    it("enables local storage at the absolute root when all three conditions hold", () => {
      const runtime = createArtifactStorageRuntime(optIn);
      expect(runtime.enabled).toBe(true);
      expect(runtime.store.provider).toBe("local");
      expect((runtime.store as unknown as { root?: string }).root).toBe("/var/glantri/artifacts");
    });

    it.each([
      ["provider missing", { ARTIFACT_STORAGE_PROVIDER: undefined }],
      ["opt-in missing", { ARTIFACT_LOCAL_ALLOW_PRODUCTION: undefined }],
      ["opt-in not exactly true", { ARTIFACT_LOCAL_ALLOW_PRODUCTION: "TRUE" }],
      ["root missing", { ARTIFACT_LOCAL_ROOT: undefined }],
      ["root empty", { ARTIFACT_LOCAL_ROOT: "" }],
      ["root relative", { ARTIFACT_LOCAL_ROOT: "artifacts/relative" }],
    ])("stays disabled when %s", (_label, override) => {
      expect(createArtifactStorageRuntime({ ...optIn, ...override }).enabled).toBe(false);
    });

    it("leaves non-production defaults and the Azure branch unchanged", () => {
      expect(createArtifactStorageRuntime({ NODE_ENV: "development" }).enabled).toBe(true);
      expect(
        createArtifactStorageRuntime({
          ARTIFACT_AZURE_ACCOUNT_URL: "https://example.blob.core.windows.net",
          ARTIFACT_AZURE_CONTAINER: "artifacts",
          ARTIFACT_STORAGE_PROVIDER: "azure",
          NODE_ENV: "production",
        }).store.provider,
      ).toBe("azure");
    });
  });
});
