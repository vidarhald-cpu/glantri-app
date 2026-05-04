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
    expect(source).toContain("Concrete participant roster");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Add player character</h2>");
    expect(source).not.toContain("Add participant from template or campaign NPC");
  });

  it("keeps summary editing together and removes prominent scenario-level live state", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Scenario summary");
    expect(source).toContain("setScenarioDescription");
    expect(source).toContain("setScenarioKind");
    expect(source).not.toContain("{scenario.description || \"No description yet.\"}");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Live state</h2>");
    expect(source).not.toContain("handleUpdateLiveState");
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
    expect(source).not.toContain("participants.map((participant) => (");
  });

  it("assigns encounter participants from concrete scenario participant rows", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("handleEncounterParticipantToggle");
    expect(source).toContain("nonArchivedEncounters");
    expect(source).toContain("scenarioParticipantId");
    expect(source).toContain('participantType: "scenario"');
  });

  it("separates templates as sources for temporary actors", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Template sources");
    expect(source).toContain("handleCreateTemporaryActorFromTemplate");
    expect(source).toContain("Create temporary actor");
    expect(source).toContain(".filter((entry) => entry.category !== \"template\")");
  });
});
