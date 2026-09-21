import { describe, expect, it } from "vitest";

import {
  aiIntakeArtifactSuggestionNotes,
  aiIntakeGmNotes,
  aiIntakeObjectGmNotes,
  normalizeIntakeLabel,
  parseAiIntakeContext,
  type AiIntakeEntry,
} from "./aiIntake";

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

  it("rejects an unknown field rather than ignoring it, and says so plainly", () => {
    const result = parseAiIntakeContext(
      JSON.stringify({
        ...valid,
        entries: [{ ...valid.entries[0], sha256: "a".repeat(64) }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const problems = result.problems.join(" ");
      expect(problems).toContain("“Torn Treasure Map”");
      expect(problems).toContain("“sha256”");
      expect(problems).toContain("does not define");
      // No raw validation vocabulary reaches the GM.
      expect(problems).not.toMatch(/Unrecognized key|entries\.\d|Invalid literal|Expected string/);
    }
  });

  it("never shows raw validation output for a malformed entry", () => {
    const wrongTypes = parseAiIntakeContext(
      JSON.stringify({
        ...valid,
        entries: [{ ...valid.entries[0], tags: [["clue"]] }],
      }),
    );
    expect(wrongTypes.ok).toBe(false);
    if (!wrongTypes.ok) {
      const problems = wrongTypes.problems.join(" ");
      expect(problems).toContain("“tags”");
      expect(problems).toContain("short plain-text tags");
      expect(problems).not.toMatch(/Expected|received|entries\.\d|\bpath\b/);
    }

    const missingTitle = parseAiIntakeContext(
      JSON.stringify({ ...valid, entries: [{ represents: "artifact", filename: "a.png" }] }),
    );
    expect(missingTitle.ok).toBe(false);
    if (!missingTitle.ok) {
      const problems = missingTitle.problems.join(" ");
      expect(problems).toContain("Entry 1");
      expect(problems).toContain("“title”");
      expect(problems).not.toMatch(/Required|Invalid|entries\.\d/);
    }
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

  it("rejects an unknown format or version without naming literals or paths", () => {
    for (const broken of [
      { ...valid, version: 2 },
      { ...valid, format: "other" },
    ]) {
      const result = parseAiIntakeContext(JSON.stringify(broken));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.problems).toEqual([
          "This is not a Glantri intake context, or it was written for a different version of the format. Ask for the documented format again and paste the whole reply.",
        ]);
      }
    }
  });

  it("normalizes labels only by case and whitespace", () => {
    expect(normalizeIntakeLabel("  Captain   VARRO ")).toBe("captain varro");
    expect(normalizeIntakeLabel("Captain Varros")).not.toBe("captain varro");
  });

  it("keeps intake scaffolding out of the notes that belong to the object itself", () => {
    const entry: AiIntakeEntry = {
      represents: "item",
      tags: ["clue", "harbour"],
      title: "Map",
      suggestedVisibility: "campaign",
      gmNotes: "Hidden under the floor.",
    };
    const objectNotes = aiIntakeObjectGmNotes(entry, "From the session-three chat.");
    expect(objectNotes).toBe("Hidden under the floor.\n\nFrom the session-three chat.");
    expect(objectNotes).not.toContain("Suggested tags");
    expect(objectNotes).not.toContain("Suggested visibility");

    const suggestions = aiIntakeArtifactSuggestionNotes(entry);
    expect(suggestions).toContain("Suggested tags: clue, harbour");
    expect(suggestions).toContain("always created GM-private");
    expect(suggestions).not.toContain("Hidden under the floor.");
    expect(aiIntakeArtifactSuggestionNotes({ represents: "item", title: "Map" })).toBeUndefined();
  });

  it("retains tags and the visibility suggestion as Artifact GM notes, never as structure", () => {
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
