import { describe, expect, it } from "vitest";

import { campaignMapMutationSchema } from "./map";

const baseMarker = {
  description: "",
  destinationMapId: null,
  entityLabelSnapshot: null,
  entityReferenceId: null,
  entityReferenceType: null,
  id: "marker-1",
  kind: "annotation" as const,
  label: "Old Gate",
  presentation: "gate",
  sortOrder: 0,
  visibility: "inherit" as const,
  x: 0.25,
  y: 0.75,
};

function mutation(marker: Record<string, unknown> = baseMarker) {
  return {
    access: "players" as const,
    backgroundArtifactId: null,
    description: "A district Map",
    expectedVersion: 1,
    layers: [
      {
        id: "layer-1",
        markers: [marker],
        name: "Places",
        sortOrder: 0,
        visibility: "player_visible" as const,
      },
    ],
    name: "Old Quarter",
    role: "area" as const,
  };
}

describe("Campaign Map aggregate input", () => {
  it("accepts finite normalized coordinates and annotation-only fields", () => {
    expect(campaignMapMutationSchema.parse(mutation()).layers[0]?.markers[0]).toMatchObject({
      x: 0.25,
      y: 0.75,
    });
  });

  it("rejects coordinates outside normalized Map-local space", () => {
    expect(() => campaignMapMutationSchema.parse(mutation({ ...baseMarker, x: 1.01 }))).toThrow();
    expect(() =>
      campaignMapMutationSchema.parse(mutation({ ...baseMarker, y: Number.NaN })),
    ).toThrow();
  });

  it("enforces exact kind-specific reference combinations", () => {
    expect(() =>
      campaignMapMutationSchema.parse(
        mutation({ ...baseMarker, destinationMapId: "map-2", kind: "annotation" }),
      ),
    ).toThrow("Only Map links");
    expect(() =>
      campaignMapMutationSchema.parse(mutation({ ...baseMarker, kind: "entity_reference" })),
    ).toThrow("Entity markers require");
    expect(
      campaignMapMutationSchema.parse(
        mutation({ ...baseMarker, destinationMapId: "map-2", kind: "map_link" }),
      ).layers[0]?.markers[0]?.kind,
    ).toBe("map_link");
  });

  it("rejects duplicate Layer, marker and ordering identities", () => {
    const value = mutation();
    value.layers.push({ ...value.layers[0]!, name: "Duplicate" });
    expect(() => campaignMapMutationSchema.parse(value)).toThrow();
  });
});
