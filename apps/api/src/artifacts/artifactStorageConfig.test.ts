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
});
