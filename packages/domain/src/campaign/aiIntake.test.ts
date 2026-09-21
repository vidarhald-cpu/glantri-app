import { describe, expect, it } from "vitest";

import { aiIntakeGmNotes, normalizeIntakeLabel, parseAiIntakeContext } from "./aiIntake";

const valid = {
  format: "glantri-intake",
  version: 1,
  entries: [
    {
      represents: "item",
      filename: "torn-map.png",
      title: "Torn Treasure Map",
      kind: "map",
      description: "A salt-stained sea chart.",
      gmNotes: "The harbourmaster holds the other half.",
      playerDescription: "A torn sea chart.",
      suggestedVisibility: "campaign",
      tags: ["clue"],
      relatedTo: "Captain Varro",
    },
  ],
};

describe("AI intake context", () => {
  it("accepts a complete documented context", () => {
    const result = parseAiIntakeContext(JSON.stringify(valid));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.entries[0]!.title).toBe("Torn Treasure Map");
  });

  it("fails closed on a truncated paste rather than salvaging part of it", () => {
    const truncated = JSON.stringify(valid).slice(0, 60);
    const result = parseAiIntakeContext(truncated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("not valid JSON");
  });

  it("rejects an unknown field rather than ignoring it", () => {
    const result = parseAiIntakeContext(
      JSON.stringify({
        ...valid,
        entries: [{ ...valid.entries[0], sha256: "a".repeat(64) }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toMatch(/unrecognized|Unrecognized/);
  });

  it("rejects a partial entry that omits a required semantic fact", () => {
    const result = parseAiIntakeContext(
      JSON.stringify({ ...valid, entries: [{ represents: "artifact", filename: "a.png" }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("requires a pure Artifact to name its file and any file to state a kind", () => {
    const noFile = parseAiIntakeContext(
      JSON.stringify({ ...valid, entries: [{ represents: "artifact", title: "Portrait" }] }),
    );
    expect(noFile.ok).toBe(false);
    const noKind = parseAiIntakeContext(
      JSON.stringify({
        ...valid,
        entries: [{ represents: "item", title: "Sword", filename: "sword.png" }],
      }),
    );
    expect(noKind.ok).toBe(false);
    if (!noKind.ok) expect(noKind.problems.join(" ")).toContain("must state a kind");
  });

  it("refuses a context that describes one file twice or repeats a title", () => {
    const entry = valid.entries[0]!;
    const twice = parseAiIntakeContext(
      JSON.stringify({ ...valid, entries: [entry, { ...entry, title: "Other" }] }),
    );
    expect(twice.ok).toBe(false);
    const repeated = parseAiIntakeContext(
      JSON.stringify({
        ...valid,
        entries: [entry, { ...entry, filename: "second.png", title: "torn  TREASURE map" }],
      }),
    );
    expect(repeated.ok).toBe(false);
  });

  it("rejects an unknown format or version", () => {
    expect(parseAiIntakeContext(JSON.stringify({ ...valid, version: 2 })).ok).toBe(false);
    expect(parseAiIntakeContext(JSON.stringify({ ...valid, format: "other" })).ok).toBe(false);
  });

  it("normalizes labels only by case and whitespace", () => {
    expect(normalizeIntakeLabel("  Captain   VARRO ")).toBe("captain varro");
    expect(normalizeIntakeLabel("Captain Varros")).not.toBe("captain varro");
  });

  it("retains tags and the visibility suggestion as GM notes, never as structure", () => {
    const notes = aiIntakeGmNotes(
      {
        represents: "item",
        tags: ["clue", "harbour"],
        title: "Map",
        suggestedVisibility: "campaign",
        gmNotes: "Hidden under the floor.",
      },
      "From the session-three chat.",
    );
    expect(notes).toContain("Hidden under the floor.");
    expect(notes).toContain("Suggested tags: clue, harbour");
    expect(notes).toContain("always created GM-private");
    expect(notes).toContain("From the session-three chat.");
  });
});
