import { describe, expect, it } from "vitest";

import {
  blackboardCreateSchema,
  blackboardGmCreateSchema,
  blackboardPlacementUpdateSchema,
  blackboardRevisionSchema,
  serializeBlackboardCommonDto,
  serializeBlackboardViewerCapabilities,
} from "./blackboard";

describe("Campaign Blackboard domain contract", () => {
  it("accepts exactly the four strict pilot categories", () => {
    for (const input of [
      { category: "clue_fact", fact: "Blue lantern", title: "Password" },
      { category: "document_text", documentText: "A letter", title: "Letter" },
      { category: "image_map", sourceArtifactId: "artifact-1", title: "Map" },
      { category: "recap", recapText: "The party arrived.", title: "Recap" },
    ]) {
      expect(blackboardCreateSchema.safeParse(input).success).toBe(true);
    }
    expect(blackboardCreateSchema.safeParse({ category: "item", title: "Forbidden" }).success).toBe(
      false,
    );
    expect(
      blackboardCreateSchema.safeParse({
        category: "clue_fact",
        fact: "Public",
        hiddenCount: 1,
        title: "Unknown field",
      }).success,
    ).toBe(false);
  });

  it("keeps restricted authoring GM-only at the parsing boundary", () => {
    const input = {
      category: "document_text" as const,
      documentText: "Public",
      restrictedDetails: [{ detailText: "Secret", sortOrder: 0 }],
      title: "Letter",
    };
    expect(blackboardCreateSchema.safeParse(input).success).toBe(false);
    expect(blackboardGmCreateSchema.safeParse(input).success).toBe(true);
    expect(
      blackboardRevisionSchema.safeParse({
        category: "document_text",
        changeKind: "correction",
        documentText: "Public",
        expectedEntryVersion: 1,
        restrictedDetails: [],
        title: "Letter",
      }).success,
    ).toBe(false);
  });

  it("enforces spatial and optimistic-concurrency bounds", () => {
    expect(
      blackboardPlacementUpdateSchema.safeParse({
        expectedLayoutVersion: 1,
        expectedRowVersion: 1,
        height: 80,
        layer: 0,
        width: 120,
        x: -100000,
        y: 100000,
      }).success,
    ).toBe(true);
    expect(
      blackboardPlacementUpdateSchema.safeParse({
        expectedLayoutVersion: 1,
        expectedRowVersion: 1,
        height: 79,
        layer: 0,
        width: 120,
        x: 0,
        y: 0,
      }).success,
    ).toBe(false);
  });

  it("serializes one canonical common ordering without restricted inputs", () => {
    const entries = [
      {
        category: "clue_fact" as const,
        entryVersion: 1,
        fact: "Second",
        id: "b",
        state: "Current" as const,
        title: "Zulu",
        updatedAt: "2026-08-25T00:00:00.000Z",
        updatedByLabel: "Ari",
      },
      {
        category: "document_text" as const,
        documentText: "First",
        entryVersion: 2,
        id: "a",
        state: "Corrected" as const,
        title: "Alpha",
        updatedAt: "2026-08-25T00:00:00.000Z",
        updatedByLabel: "Bea",
      },
    ];
    const result = serializeBlackboardCommonDto({
      catalogue: entries,
      layout: { placements: [], version: 0 },
      tombstones: [],
    });
    expect(result.catalogue.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(JSON.stringify(result)).not.toMatch(/role|character|unit|grant|audit/i);
  });

  it("serializes only bounded viewer action capabilities without owner identity", () => {
    const result = serializeBlackboardViewerCapabilities([
      { canCorrect: false, canRemove: false, entryId: "entry-b" },
      { canCorrect: true, canRemove: true, entryId: "entry-a" },
    ]);

    expect(result.entries).toEqual([
      { canCorrect: true, canRemove: true, entryId: "entry-a" },
      { canCorrect: false, canRemove: false, entryId: "entry-b" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/owner|userId|label|content|source/i);
  });
});
