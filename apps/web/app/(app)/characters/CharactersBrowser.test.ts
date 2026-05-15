import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CharactersBrowser.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CharactersBrowser scenario join UI", () => {
  it("loads joinable scenarios for the selected character instead of campaign self-join", () => {
    const source = readSource();

    expect(source).toContain("loadJoinableScenarios(characterId)");
    expect(source).toContain("No live scenario is currently available for this character.");
    expect(source).toContain('tab: "scenario"');
    expect(source).not.toContain("No active scenarios are currently available from the campaign list.");
    expect(source).not.toContain("Player self-join");
  });

  it("keeps scenario kind/status out of the join chooser labels", () => {
    const source = readSource();

    expect(source).toContain("{scenario.campaignName} - {scenario.scenarioName}");
    expect(source).not.toContain("{scenario.kind}");
    expect(source).not.toContain("{scenario.status}");
  });
});
