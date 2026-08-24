import { describe, expect, it } from "vitest";

import {
  artifactCommonDtoSchema,
  artifactUploadMetadataSchema,
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

  it("requires optimistic versions for Scenario publication mutations", () => {
    expect(
      scenarioArtifactReferenceMutationSchema.parse({ expectedArtifactVersion: 2 }),
    ).toMatchObject({ expectedArtifactVersion: 2 });
    expect(() => scenarioArtifactReferenceMutationSchema.parse({})).toThrow();
  });
});
