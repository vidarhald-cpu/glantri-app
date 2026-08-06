import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CampaignWorkspaceShell.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignWorkspaceShell roleplay encounter routing", () => {
  it("routes shared Encounter and Skill rolls tabs through player-safe roleplay surfaces", () => {
    const source = readSource();

    expect(source).toContain("PlayerRoleplayingEncounterScreen");
    expect(source).toContain('workspaceState.activeTab === "encounter"');
    expect(source).toContain('workspaceState.activeTab === "skill-rolls"');
    expect(source).toContain('surface="encounter"');
    expect(source).toContain('surface="skill-rolls"');
    expect(source).toContain("EncounterDetail");
    expect(source).toContain("ScenarioPlayerCombatPageContent");
    expect(source).toContain("loadScenarioParticipants");
    expect(source).toContain("loadScenarioMyParticipant");
    expect(source).toContain("loadCampaignWorkspaceInitialData");
    expect(source).toContain("currentUserId: currentUser?.id");
    expect(source).toContain("WorkspaceParticipantInspectionHeader");
    expect(source).toContain("buildGmCharacterWorkspaceCandidates");
  });

  it("renders player scenario links and useful empty states", () => {
    const source = readSource();

    expect(source).toContain("Available scenarios");
    expect(source).toContain('tab: "scenario"');
    expect(source).toContain("No active scenario is currently available.");
    expect(source).toContain("No encounter is currently available.");
    expect(source).toContain("No skill rolls are currently available.");
    expect(source).toContain("Waiting for GM to add you to an encounter.");
    expect(source).toContain("You are in this scenario, but not assigned to this encounter.");
    expect(source).toContain("loadScenarioEncounterSummaries");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("const searchParamString = searchParams.toString()");
    expect(source).not.toContain("Accessible scenarios:");
  });

  it("routes the workspace Character tab through the encounter-context panel", () => {
    const source = readSource();

    expect(source).toContain("CharacterWorkspacePanel");
    expect(source).toContain('workspaceState.activeTab === "character"');
    expect(source).toContain('tab: "character"');
    expect(source).toContain('selectedParticipantId={searchParams.get("participantId")}');
    expect(source).toContain("isGameMaster={canAccessGmEncounter}");
    expect(source).toContain("currentRoundNumber={activeScenario?.liveState?.roundNumber}");
  });

  it("keeps GM Skill rolls focused on GM tools and routes player operation separately", () => {
    const source = readSource();

    expect(source).toContain('workspaceState.activeTab === "skill-rolls"');
    expect(source).toContain('workspaceState.activeTab === "player-skill-rolls"');
    expect(source).toContain('screenName="Player skill rolls"');
    expect(source).toContain("inspectionParticipantId={selectedGmInspectableCandidate.id}");
    expect(source).toContain("showWorkspaceHeader={false}");
    expect(source).toContain(
      'selectInspectableParticipant({ participantId, tab: "player-skill-rolls" })',
    );
    expect(source).toContain('workspaceScreenName="Player skill rolls"');
    expect(source).not.toContain("Player view");
  });

  it("routes the workspace Combat tab through the recovered combat panel", () => {
    const source = readSource();

    expect(source).toContain('workspaceState.activeTab === "combat"');
    expect(source).toContain("CombatRoundManagerPanel");
    expect(source).toContain("key={selectedActiveEncounter.id}");
    expect(source).toContain("canAccessGmEncounter && selectedActiveEncounter");
    expect(source).toContain("sortedActiveScenarioEncounters");
    expect(source).toContain("Select an encounter to open the Combat Round Manager.");
    expect(source).toContain("Create or open an encounter on Scenario tab");
    expect(source).toContain("onEncounterUpdated");
    expect(source).toContain("onScenarioParticipantsUpdated");
    expect(source).toContain("scenarioParticipants={scenarioParticipants}");
    expect(source).toContain("ScenarioPlayerCombatPageContent");
    expect(source).not.toContain('workspaceTab="combat"');
    expect(source).toContain("GM_COMBAT_REFRESH_INTERVAL_MS");
    expect(source).toContain('workspaceState.activeTab !== "combat"');
    expect(source).toContain("pollGmCombatSnapshot");
    expect(source).toContain("loadEncounterRevision");
    expect(source).toContain("loadEncounterById");
    expect(source).toContain("loadParticipants: loadScenarioParticipants");
    expect(source).not.toContain("refreshWorkspaceContextWithErrorHandling");
    expect(source).toContain("Combat Round Manager is a GM tool.");
    expect(source).toContain("Open Player combat");
    expect(source).toContain("No encounter is currently available for combat tools.");
    expect(source).not.toContain("Player combat inspection");
    expect(source).not.toContain('screenName="Combat"');
    expect(source).toContain("selectLatestCombatViewRevision({");
  });

  it("initializes once from summaries and keeps polling scoped to the selected encounter", () => {
    const source = readSource();

    expect(source.match(/loadCampaignWorkspaceAccessForUser\(\{/g)).toHaveLength(1);
    expect(source).toContain("async function initializeWorkspace()");
    expect(source).toContain("encounterSummaries");
    expect(source).toContain("activeEncounterIdRef.current !== polledEncounterId");
    expect(source).toContain("activeEncounterRequestIdRef.current !== requestId");
    expect(source).toContain("result.kind !== \"updated\"");
    expect(source).toContain("caughtError.status === 404");
    expect(source).toContain("const intervalId = window.setInterval(refreshVisibleCombat");
    expect(source).not.toContain("loadScenarioEncounters");
  });

  it("routes Player combat through its own GM inspection tab", () => {
    const source = readSource();

    expect(source).toContain('workspaceState.activeTab === "player-combat"');
    expect(source).toContain('screenName="Player combat"');
    expect(source).toContain("ScenarioPlayerCombatPageContent");
    expect(source).toContain('workspaceTab="player-combat"');
    expect(source).toContain("showParticipantSelector={false}");
    expect(source).toContain(
      "key={`${selectedActiveEncounter.id}:${selectedGmInspectableCandidate.id}`}",
    );
    expect(source).toContain(
      'selectInspectableParticipant({ participantId, tab: "player-combat" })',
    );
    expect(source).toContain("if (nextHref !== currentHref) {");
    expect(source).toContain("No participant is available for player combat.");
    expect(source.match(/<ScenarioPlayerCombatPageContent/g)).toHaveLength(2);
  });
});
