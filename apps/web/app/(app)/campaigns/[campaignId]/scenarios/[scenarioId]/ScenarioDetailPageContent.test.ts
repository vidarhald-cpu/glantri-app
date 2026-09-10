import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "ScenarioDetailPageContent.tsx");
const componentsPath = join(dirname(fileURLToPath(import.meta.url)), "components");

const componentFiles = [
  "ScenarioSummarySection.tsx",
  "ScenarioEncountersSection.tsx",
  "ScenarioEncounterAssignmentSection.tsx",
  "ScenarioCampaignRosterPickerSection.tsx",
  "ScenarioTemplateSourcesSection.tsx",
  "ScenarioEventLogSection.tsx",
  "scenarioScreenHelpers.ts",
  "scenarioScreenTypes.ts",
];

function readScenarioDetailSource(): string {
  return readFileSync(sourcePath, "utf8");
}

function readComponentSource(fileName: string): string {
  return readFileSync(join(componentsPath, fileName), "utf8");
}

function readScenarioDetailSources(): string {
  return [
    readScenarioDetailSource(),
    ...componentFiles.map((fileName) => readComponentSource(fileName)),
  ].join("\n");
}

describe("ScenarioDetailPageContent GM scenario manager UI", () => {
  it("owns explicit character equipment reconciliation in the participant assignment grid", () => {
    const source = readScenarioDetailSources();

    expect(source).toContain("refreshScenarioParticipantEquipmentOnServer");
    expect(source).toContain("handleRefreshParticipantEquipment");
    expect(source).toContain("Reconcile equipment");
    expect(source).toContain("Reconciling…");
    expect(source).toContain('participant.sourceType === "character"');
    expect(source).toContain("await refreshScenario()");
    expect(source).toContain("Scenario equipment was reconciled");
  });

  it("uses compact roster sources instead of a separate concrete participant section", () => {
    const source = readScenarioDetailSources();

    expect(source).toContain("Toggle ${candidate.name} scenario participation");
    expect(source).toContain("Add from campaign roster");
    expect(source).toContain("Toggle ${participant.snapshot.displayName} active scenario status");
    expect(source).not.toContain(">Scenario participants</h2>");
    expect(source).not.toContain("Concrete scenario participants");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Add player character</h2>");
    expect(source).not.toContain("Add participant from template or campaign NPC");
  });

  it("keeps summary editing together and removes prominent scenario-level live state", () => {
    const source = [
      readScenarioDetailSource(),
      readComponentSource("ScenarioSummarySection.tsx"),
    ].join("\n");

    expect(source).toContain("Scenario summary");
    expect(source).toContain('aria-label="Scenario summary"');
    expect(source).toContain("gridTemplateColumns");
    expect(source).toContain("setScenarioDescription");
    expect(source).not.toContain("<textarea");
    expect(source).not.toContain("setScenarioKind");
    expect(source).not.toContain("value={scenarioKind}");
    expect(source).not.toContain('{scenario.description || "No description yet."}');
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Live state</h2>");
    expect(source).not.toContain("handleUpdateLiveState");
  });

  it("supports situational Encounters with activity emphasis and lifecycle controls", () => {
    const source = readScenarioDetailSources();
    const encountersSource = readComponentSource("ScenarioEncountersSection.tsx");

    expect(source).toContain('<option value="combat">Combat emphasis</option>');
    expect(source).toContain('<option value="roleplay">Roleplaying emphasis</option>');
    expect(source).toContain("Timeline</th>");
    expect(source).toContain("Participants</th>");
    expect(source).toContain("handleUpdateEncounterStatus");
    expect(source).toContain("updateEncounterStatusOnServer");
    expect(source).toContain("updateEncounterParticipantsOnServer");
    expect(source).not.toContain("updateEncounterOnServer");
    expect(source).toContain('"active"');
    expect(source).toContain('"paused"');
    expect(source).toContain('"archived"');
    expect(source).toContain('"completed"');
    expect(source).not.toContain("participants.map((participant) => (");
    expect(encountersSource).toMatch(
      /onUpdateEncounterStatus\(encounter, "paused"\)[\s\S]*?type="button"/,
    );
    expect(encountersSource).toMatch(
      /onUpdateEncounterStatus\(encounter, "archived"\)[\s\S]*?type="button"/,
    );
  });

  it("assigns encounter participants from concrete scenario participant rows", () => {
    const source = readScenarioDetailSources();
    const assignmentSource = readComponentSource("ScenarioEncounterAssignmentSection.tsx");

    expect(source).toContain("handleEncounterParticipantToggle");
    expect(source).toContain("nonArchivedEncounters");
    expect(source).toContain("scenarioParticipantId");
    expect(source).toContain('participantType: "scenario"');
    expect(source).toContain("isParticipantInEncounter(encounter, participant)");
    expect(source).toContain("Encounter Assignment");
    expect(source).toContain("Assign selected");
    expect(source).toContain("Withdraw selected");
    expect(source).toContain("Bulk assignment encounter");
    expect(assignmentSource).toMatch(/>\s*Select\s*<\/th>/);
    expect(assignmentSource).toMatch(/>\s*Name\s*<\/th>/);
    expect(assignmentSource).toMatch(/>\s*Type\s*<\/th>/);
    expect(assignmentSource).not.toContain(">Active</th>");
    expect(assignmentSource).not.toContain(">Controller</th>");
    expect(assignmentSource).not.toContain(">Status</th>");
    expect(assignmentSource).not.toContain(">Details</th>");
    expect(assignmentSource).toContain(
      "Toggle ${participant.snapshot.displayName} assignment details",
    );
    expect(assignmentSource).toContain("aria-expanded={expanded}");
    expect(source).toContain("Encounter-specific details");
    expect(source).toContain("ScenarioEncounterManagementProjection");
    expect(source).toContain("participantMemberships");
    expect(source).toContain("participantCount");
    expect(source).toContain("await loadEncounterById(encounter.id)");
    expect(source).toContain("fullEncounter.participants");
    expect(source).toContain("loadScenarioEncounterManagementProjections");
    expect(source).not.toContain("loadScenarioEncounters");
  });

  it("clears a stale load error after a successful refresh", () => {
    const source = readScenarioDetailSource();
    const refreshStart = source.indexOf("async function refreshScenario()");
    const refreshEnd = source.indexOf("async function handleCreateEncounter()", refreshStart);
    const refreshSource = source.slice(refreshStart, refreshEnd);

    expect(refreshSource).toContain("setError(undefined)");
  });

  it("separates templates as sources for temporary actors", () => {
    const source = readScenarioDetailSources();

    expect(source).toContain("Template sources");
    expect(source).toContain("handleCreateTemporaryActorFromTemplate");
    expect(source).toContain("Create temporary actor");
    expect(source).toContain("Temporary actor count");
    expect(source).toContain("temporaryActorCount");
    expect(source).toContain("templateSources[0]");
    expect(source).toContain("setParticipants((current) =>");
    expect(source).toContain("Temporary actor");
    expect(source).toContain('.filter((entry) => entry.category !== "template")');
  });

  it("renders filters on Encounter Assignment", () => {
    const source = readScenarioDetailSources();

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
    const source = readScenarioDetailSources();
    const rosterSource = readComponentSource("ScenarioCampaignRosterPickerSection.tsx");

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
    expect(rosterSource).toMatch(/>\s*Add\s*<\/th>/);
    expect(rosterSource).not.toContain(">Status</th>");
    expect(source).not.toContain("Campaign roster status filter");
    expect(source).not.toContain("${user.displayName} (${user.email})");
  });

  it("keeps the scenario workflow sections in the intended order", () => {
    const source = readScenarioDetailSource();
    const summaryIndex = source.indexOf("<ScenarioSummarySection");
    const encountersIndex = source.indexOf("<ScenarioEncountersSection");
    const assignmentIndex = source.indexOf("<ScenarioEncounterAssignmentSection");
    const rosterIndex = source.indexOf("<ScenarioCampaignRosterPickerSection");
    const templatesIndex = source.indexOf("<ScenarioTemplateSourcesSection");
    const eventLogIndex = source.indexOf("<ScenarioEventLogSection");

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(encountersIndex).toBeGreaterThan(summaryIndex);
    expect(assignmentIndex).toBeGreaterThan(encountersIndex);
    expect(rosterIndex).toBeGreaterThan(assignmentIndex);
    expect(templatesIndex).toBeGreaterThan(rosterIndex);
    expect(eventLogIndex).toBeGreaterThan(templatesIndex);
    expect(readComponentSource("ScenarioEventLogSection.tsx")).not.toContain(">Select</th>");
    expect(readComponentSource("ScenarioEventLogSection.tsx")).not.toContain(">Status</th>");
  });

  it("returns terminal Scenarios as read-only history before rendering live management", () => {
    const source = readScenarioDetailSource();
    const terminalStart = source.indexOf('scenario.status === "completed"');
    const liveStart = source.indexOf("const selectedTemplateSource", terminalStart);
    const terminalSource = source.slice(terminalStart, liveStart);

    expect(terminalSource).toContain("Read-only Scenario history");
    expect(terminalSource).toContain("<ScenarioSessionPanel");
    expect(terminalSource).not.toContain("<ScenarioSessionManagement");
    expect(terminalSource).not.toContain("<ScenarioEncountersSection");
    expect(terminalSource).not.toContain("<ScenarioEncounterAssignmentSection");
    expect(terminalSource).not.toContain("<button");
  });
});
