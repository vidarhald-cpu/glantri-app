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
    expect(source).toContain("Update Scenario equipment");
    expect(source).toContain("Updating…");
    expect(source).toContain('participant.sourceType === "character"');
    expect(source).toContain("await refreshScenario()");
    expect(source).toContain("Scenario equipment was updated");
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

  it("does not offer a direct-field temporary actor for a page-authored archetype Template (#851)", () => {
    const source = readScenarioDetailSource();

    expect(source).toContain("function isArchetypeTemplateEntity");
    expect(source).toContain('record.templateKind === "humanoid_npc_archetype"');
    expect(source).toContain('record.actorClass !== "campaign_npc"');
    expect(source).toContain('record.actorClass !== "generated_npc"');
    expect(source).toContain("fieldableTemplateSources");
    expect(source).toContain("templateSources={fieldableTemplateSources}");
    expect(source).not.toContain("templateSources={templateSources}");
    expect(source).toContain("fieldableTemplateSources.find(");
  });

  it("signposts hidden archetype Templates to Generate NPC on the Templates page (#1094)", () => {
    const source = readScenarioDetailSources();

    expect(source).toContain(
      "hasHiddenArchetypeTemplates={fieldableTemplateSources.length < templateSources.length}",
    );
    expect(source).toContain("Page-authored Templates are used through Generate NPC on the");
    expect(source).toContain('<Link href="/templates">Templates page</Link>');
    expect(source).toContain("No template sources are available.");
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
    expect(source).toContain("fieldableTemplateSources[0]");
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
    const terminalStart = source.indexOf("if (isScenarioReadOnly(scenario.status))");
    const liveStart = source.indexOf("const selectedTemplateSource", terminalStart);
    const terminalSource = source.slice(terminalStart, liveStart);

    expect(terminalStart).toBeGreaterThan(-1);
    expect(terminalSource).toContain("Read-only Scenario history");
    expect(terminalSource).toContain("<ScenarioSessionPanel");

    // The lifecycle control is the ONLY mutation affordance the terminal branch
    // renders, and it is the section that carries `completed -> archived`.
    expect(terminalSource).toContain("<ScenarioSummarySection");

    // Every live-session affordance must stay outside this branch. These are the
    // refusals that a loosening of the terminal guard would silently convert into
    // offered operations.
    for (const liveOnlySection of [
      "<ScenarioSessionManagement",
      "<ScenarioEncountersSection",
      "<ScenarioEncounterAssignmentSection",
      "<ScenarioCampaignRosterPickerSection",
      "<ScenarioTemplateSourcesSection",
      "<ScenarioEventLogSection",
    ]) {
      expect(terminalSource).not.toContain(liveOnlySection);
    }

    for (const liveOnlyHandler of [
      "handleCreateEncounter",
      "handleUpdateEncounterStatus",
      "handleEncounterParticipantToggle",
      "handleRosterParticipantToggle",
      "handleParticipantActiveToggle",
      "handleRefreshParticipantEquipment",
      "handleCreateTemporaryActorFromTemplate",
      "handleSaveScenarioSession",
    ]) {
      expect(terminalSource).not.toContain(liveOnlyHandler);
    }

    // The branch renders no bare control of its own: the archive affordance lives
    // inside `ScenarioSummarySection`, which derives it from the domain vocabulary.
    expect(terminalSource).not.toContain("<button");
    expect(terminalSource).not.toContain("<select");
  });

  it("derives terminal, read-only and lifecycle judgements from the domain vocabulary", () => {
    const source = readScenarioDetailSource();
    const summarySource = readComponentSource("ScenarioSummarySection.tsx");

    // The hand-maintained twins of the domain lifecycle helpers are gone from both
    // files, so a change to the domain vocabulary now reaches them via the compiler.
    expect(source).toContain("isScenarioReadOnly");
    expect(source).not.toContain(
      'scenario.status === "completed" || scenario.status === "archived"',
    );

    expect(summarySource).toContain("isScenarioReadOnly(scenarioStatus)");
    expect(summarySource).toContain("scenarioLifecycleTransitions[scenarioStatus]");
    expect(summarySource).not.toContain('scenarioStatus === "draft"');
    expect(summarySource).not.toContain('scenarioStatus === "paused"');
  });

  it("offers the campaign roster picker only where the server admits the participant write", () => {
    const source = readScenarioDetailSource();
    const rosterSource = readComponentSource("ScenarioCampaignRosterPickerSection.tsx");

    // The client affordance is derived from the SAME domain predicate the API gate
    // uses (`participantRoutes.ts` -> `isScenarioLiveInteractive`), not from a
    // hand-maintained twin that could drift away from it.
    expect(source).toContain("isScenarioLiveInteractive");
    expect(source).toContain("{isScenarioLiveInteractive(scenario.status) ? (");
    expect(source).toContain("<ScenarioCampaignRosterNotLiveSection />");
    expect(source).not.toContain('scenario.status === "live"');

    // The reconciliation is local to the render site. The terminal guard is still
    // `isScenarioReadOnly` alone, so the other refusals it carries are untouched.
    expect(source).toContain("if (isScenarioReadOnly(scenario.status)) {");

    // The picker itself stays purely presentational over its existing props: it gains
    // no status argument, so no second, divergent gate can appear inside it.
    expect(rosterSource).not.toContain("scenarioStatus");
    expect(rosterSource).not.toContain("ScenarioStatus");
  });
});
