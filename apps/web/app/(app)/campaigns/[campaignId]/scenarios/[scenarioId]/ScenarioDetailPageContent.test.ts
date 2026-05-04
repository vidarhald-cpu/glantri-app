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
    expect(source).toContain("Concrete scenario participants");
    expect(source).toContain("Add from campaign roster");
    expect(source).toContain("Toggle ${participant.snapshot.displayName} active scenario status");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Add player character</h2>");
    expect(source).not.toContain("Add participant from template or campaign NPC");
  });

  it("keeps summary editing together and removes prominent scenario-level live state", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Scenario summary");
    expect(source).toContain("setScenarioDescription");
    expect(source).not.toContain("setScenarioKind");
    expect(source).not.toContain("value={scenarioKind}");
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
    expect(source).toContain("isParticipantInEncounter(encounter, participant)");
    expect(source).toContain("Encounter Assignment");
    expect(source).toContain("Assign selected");
    expect(source).toContain("Withdraw selected");
    expect(source).toContain("Bulk assignment encounter");
    expect(source).toContain("Encounter-specific details");
  });

  it("separates templates as sources for temporary actors", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Template sources");
    expect(source).toContain("handleCreateTemporaryActorFromTemplate");
    expect(source).toContain("Create temporary actor");
    expect(source).toContain("templateSources[0]");
    expect(source).toContain("setParticipants((current) =>");
    expect(source).toContain("Temporary actor");
    expect(source).toContain(".filter((entry) => entry.category !== \"template\")");
  });

  it("renders scenario participant filters for roster candidates and concrete actors", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Scenario participant status filter");
    expect(source).toContain("In scenario / Active");
    expect(source).toContain("Available / Not in scenario");
    expect(source).toContain("Scenario participant type filter");
    expect(source).toContain("Temporary actors");
    expect(source).toContain("All civilizations");
    expect(source).toContain("All professions");
    expect(source).toContain("All skill groups");
    expect(source).toContain("Search scenario participants");
    expect(source).toContain("filteredConcreteParticipants");
    expect(source).toContain("filteredScenarioRosterCandidates");
  });
});
