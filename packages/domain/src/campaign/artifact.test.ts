import { describe, expect, it } from "vitest";

import {
  artifactAudienceSchema,
  artifactAudienceUpdateSchema,
  artifactCommonDtoSchema,
  artifactUploadMetadataSchema,
  persistedArtifactAudienceSchema,
  resolvePersistedArtifactAudience,
  scenarioArtifactReferenceMutationSchema,
} from "./artifact";

describe("Artifact contracts", () => {
  it("accepts only the bounded V1 Artifact vocabulary", () => {
    expect(
      artifactUploadMetadataSchema.parse({
        artifactKind: "portrait",
        provenanceKind: "generated",
        title: "Court portrait",
      }),
    ).toEqual({ artifactKind: "portrait", provenanceKind: "generated", title: "Court portrait" });
    expect(() =>
      artifactUploadMetadataSchema.parse({
        artifactKind: "video",
        title: "Not supported",
      }),
    ).toThrow();
    expect(() =>
      artifactUploadMetadataSchema.parse({
        artifactKind: "image",
        storageUrl: "https://example",
        title: "x",
      }),
    ).toThrow();
  });

  it("keeps player/common DTOs free of locators and provenance internals", () => {
    expect(Object.keys(artifactCommonDtoSchema.shape).sort()).toEqual([
      "altText",
      "artifactKind",
      "campaignId",
      "description",
      "id",
      "mediaType",
      "title",
    ]);
    const dto = artifactCommonDtoSchema.parse({
      altText: "A mountain pass",
      artifactKind: "map",
      campaignId: "campaign-1",
      id: "artifact-1",
      mediaType: "image/png",
      title: "Northern pass",
    });
    expect(dto).not.toHaveProperty("storageKey");
    expect(dto).not.toHaveProperty("storageUrl");
    expect(dto).not.toHaveProperty("digest");
    expect(dto).not.toHaveProperty("originalFilename");
    expect(dto).not.toHaveProperty("sourceUri");
  });

  it("models Artifact access as exactly two writable states", () => {
    // Content authoring §18.24 / Campaign Material §2.4.
    expect(artifactAudienceSchema.options).toEqual(["gm_private", "campaign"]);
    expect(() => artifactAudienceSchema.parse("scenario")).toThrow();
    expect(() =>
      artifactAudienceUpdateSchema.parse({ audience: "scenario", expectedMetadataVersion: 1 }),
    ).toThrow();
  });

  it("SYNTHETIC: resolves any persisted audience that is not `campaign` closed to GM only", () => {
    // Acceptance criterion 8. These inputs are **synthetic by construction**:
    // no writable V1 path can produce them. The point is that the resolver is
    // a closed default rather than a `scenario`-specific special case.
    expect(resolvePersistedArtifactAudience("campaign")).toBe("campaign");
    for (const value of [
      "gm_private",
      "scenario",
      "players",
      "public",
      "Campaign",
      "campaign ",
      "",
      null,
      undefined,
      0,
      1,
      true,
      {},
      ["campaign"],
    ]) {
      expect(resolvePersistedArtifactAudience(value), String(value)).toBe("gm_private");
      expect(persistedArtifactAudienceSchema.parse(value), String(value)).toBe("gm_private");
    }
  });

  it("requires optimistic versions for Scenario publication mutations", () => {
    expect(
      scenarioArtifactReferenceMutationSchema.parse({ expectedArtifactVersion: 2 }),
    ).toMatchObject({ expectedArtifactVersion: 2 });
    expect(() => scenarioArtifactReferenceMutationSchema.parse({})).toThrow();
  });
});
