import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const situationDirectory = dirname(fileURLToPath(import.meta.url));

function readSituationSources(): Array<{ name: string; source: string }> {
  return readdirSync(situationDirectory)
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => ({ name, source: readFileSync(join(situationDirectory, name), "utf8") }));
}

/**
 * Scenario Play Workspace §4.5 and ruling PO-SPW-2: `reveal` names the GM
 * visibility operation and nothing else, and the Blackboard vocabulary
 * `share` / `place` / `placement` never names that operation. The Situation
 * view performs none of those operations — it only presents material the
 * player can already access — so none of that vocabulary belongs here.
 */
describe("Situation view vocabulary", () => {
  it("names no Reveal, Share, Place or Remove operation", () => {
    for (const { name, source } of readSituationSources()) {
      expect(source, name).not.toMatch(/reveal/i);
      expect(source, name).not.toMatch(/\bplacement\b/i);
      expect(source, name).not.toMatch(/\bshared with\b/i);
    }
  });

  it("offers the canonical click-through as Open full view", () => {
    const inspector = readFileSync(join(situationDirectory, "SituationInspector.tsx"), "utf8");

    expect(inspector).toContain("Open full view");
  });

  it("adds no visibility field to the available-object presentation", () => {
    for (const { name, source } of readSituationSources()) {
      expect(source, name).not.toContain("gm_only");
      expect(source, name).not.toContain("object.visibility");
    }
  });
});
