import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "ScenarioDetailPageContent.tsx"
);

function readScenarioDetailSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("ScenarioDetailPageContent GM scenario manager UI", () => {
  it("uses a roster-based scenario participant picker instead of legacy add forms", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Scenario participants");
    expect(source).toContain("Toggle ${candidate.name} scenario participation");
    expect(source).toContain("In scenario</th>");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Add player character</h2>");
    expect(source).not.toContain("Add participant from template or campaign NPC");
    expect(source).not.toContain("Create temporary scenario actor");
  });

  it("supports combat and roleplaying encounters with timeline/status controls", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("<option value=\"combat\">Combat</option>");
    expect(source).toContain("<option value=\"roleplay\">Roleplaying</option>");
    expect(source).toContain("Timeline</th>");
    expect(source).toContain("Participants</th>");
    expect(source).toContain("handleUpdateEncounterStatus");
    expect(source).toContain("\"active\"");
    expect(source).toContain("\"paused\"");
    expect(source).toContain("\"archived\"");
  });

  it("assigns encounter participants from scenario participants", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("handleEncounterParticipantToggle");
    expect(source).toContain("scenarioParticipantId");
    expect(source).toContain('participantType: "scenario"');
  });
});
