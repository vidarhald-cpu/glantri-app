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
  it("uses compact roster sources instead of a separate concrete participant section", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Toggle ${candidate.name} scenario participation");
    expect(source).toContain("Add from campaign roster");
    expect(source).toContain("Toggle ${participant.snapshot.displayName} active scenario status");
    expect(source).not.toContain(">Scenario participants</h2>");
    expect(source).not.toContain("Concrete scenario participants");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Add player character</h2>");
    expect(source).not.toContain("Add participant from template or campaign NPC");
  });

  it("keeps summary editing together and removes prominent scenario-level live state", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Scenario summary");
    expect(source).toContain('aria-label="Scenario summary"');
    expect(source).toContain("gridTemplateColumns");
    expect(source).toContain("setScenarioDescription");
    expect(source).not.toContain("<textarea");
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
    const assignmentSource = source.slice(
      source.indexOf(">Encounter Assignment</h2>"),
      source.indexOf(">Add from campaign roster</h2>")
    );

    expect(source).toContain("handleEncounterParticipantToggle");
    expect(source).toContain("nonArchivedEncounters");
    expect(source).toContain("scenarioParticipantId");
    expect(source).toContain('participantType: "scenario"');
    expect(source).toContain("isParticipantInEncounter(encounter, participant)");
    expect(source).toContain("Encounter Assignment");
    expect(source).toContain("Assign selected");
    expect(source).toContain("Withdraw selected");
    expect(source).toContain("Bulk assignment encounter");
    expect(assignmentSource).toContain(">Select</th>");
    expect(assignmentSource).toContain(">Name</th>");
    expect(assignmentSource).toContain(">Type</th>");
    expect(assignmentSource).not.toContain(">Active</th>");
    expect(assignmentSource).not.toContain(">Controller</th>");
    expect(assignmentSource).not.toContain(">Status</th>");
    expect(assignmentSource).not.toContain(">Details</th>");
    expect(assignmentSource).toContain("Toggle ${participant.snapshot.displayName} assignment details");
    expect(assignmentSource).toContain("aria-expanded={expanded}");
    expect(source).toContain("Encounter-specific details");
  });

  it("separates templates as sources for temporary actors", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Template sources");
    expect(source).toContain("handleCreateTemporaryActorFromTemplate");
    expect(source).toContain("Create temporary actor");
    expect(source).toContain("Temporary actor count");
    expect(source).toContain("temporaryActorCount");
    expect(source).toContain("templateSources[0]");
    expect(source).toContain("setParticipants((current) =>");
    expect(source).toContain("Temporary actor");
    expect(source).toContain(".filter((entry) => entry.category !== \"template\")");
  });

  it("renders filters on Encounter Assignment", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("Encounter assignment type filter");
    expect(source).toContain("Temporary actors");
    expect(source).toContain("All civilizations");
    expect(source).toContain("All professions");
    expect(source).toContain("All skill groups");
    expect(source).toContain("Search encounter participants");
    expect(source).toContain("filteredConcreteParticipants");
    expect(source).toContain("participant.isActive &&");
    expect(source).not.toContain("Encounter assignment status filter");
  });

  it("renders campaign roster filters for adding scenario participants", () => {
    const source = readScenarioDetailSource();
    const rosterSource = source.slice(
      source.indexOf(">Add from campaign roster</h2>"),
      source.indexOf(">Template sources</h2>")
    );

    expect(source).toContain("Campaign roster type filter");
    expect(source).toContain("Campaign roster controller filter");
    expect(source).toContain("Players");
    expect(source).toContain("GMs");
    expect(source).toContain("Campaign roster civilization filter");
    expect(source).toContain("Campaign roster profession filter");
    expect(source).toContain("Campaign roster skill group filter");
    expect(source).toContain("Search campaign roster candidates");
    expect(source).toContain("filteredScenarioRosterCandidates");
    expect(source).toContain("controllerLabel");
    expect(source).toContain("!candidate.existingParticipant?.isActive");
    expect(rosterSource).toContain(">Add</th>");
    expect(rosterSource).not.toContain(">Status</th>");
    expect(source).not.toContain("Campaign roster status filter");
    expect(source).not.toContain("${user.displayName} (${user.email})");
  });

  it("keeps the scenario workflow sections in the intended order", () => {
    const source = readScenarioDetailSource();
    const summaryIndex = source.indexOf('aria-label="Scenario summary"');
    const encountersIndex = source.indexOf(">Encounters</h2>");
    const assignmentIndex = source.indexOf(">Encounter Assignment</h2>");
    const rosterIndex = source.indexOf(">Add from campaign roster</h2>");
    const templatesIndex = source.indexOf(">Template sources</h2>");
    const eventLogIndex = source.indexOf(">Event log</h2>");

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(encountersIndex).toBeGreaterThan(summaryIndex);
    expect(assignmentIndex).toBeGreaterThan(encountersIndex);
    expect(rosterIndex).toBeGreaterThan(assignmentIndex);
    expect(templatesIndex).toBeGreaterThan(rosterIndex);
    expect(eventLogIndex).toBeGreaterThan(templatesIndex);
    expect(source.lastIndexOf(">Select</th>")).toBeLessThan(eventLogIndex);
    expect(source.lastIndexOf(">Status</th>")).toBeLessThan(eventLogIndex);
  });
});
