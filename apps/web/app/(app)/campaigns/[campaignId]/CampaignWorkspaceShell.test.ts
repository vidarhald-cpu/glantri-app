import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CampaignWorkspaceShell.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignWorkspaceShell roleplay encounter routing", () => {
  it("renders the shared Blackboard as a Campaign-level GM and player destination", () => {
    const source = readSource();

    expect(source).toContain("BlackboardWorkspace");
    expect(source).toContain('workspaceState.activeTab === "blackboard"');
    expect(source).toContain("isGameMaster={canAccessGmEncounter}");
  });

  it("pushes explicit linked-Map navigation while replacing ordinary Map route sync", () => {
    const source = readSource();

    expect(source).toContain('history: "push" | "replace" = "replace"');
    expect(source).toContain('if (history === "push") router.push(href);');
    expect(source).toContain("else router.replace(href);");
  });

  it("renders the real GM campaign Items workspace without changing global navigation", () => {
    const source = readSource();

    expect(source).toContain("CampaignItemsWorkspace");
    expect(source).toContain('workspaceState.activeTab === "items"');
    expect(source).toMatch(/canAccessGmEncounter\s*\?\s*\(\s*<CampaignItemsWorkspace/);
    expect(source).not.toContain("appNavigation");
  });

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

  it("renders role-appropriate current Scenario context and useful empty states", () => {
    const source = readSource();

    expect(source).toContain('aria-label="Current Scenario and Encounter"');
    expect(source).not.toContain("Choose the current Scenario you want to continue.");
    expect(source).not.toContain("Continue the current Scenario and its active Encounters.");
    expect(source).toContain("Open Scenario");
    expect(source).toContain("Open Encounter");
    expect(source).toContain("Open Combat");
    expect(source).toContain('tab: canAccessGmEncounter ? "combat" : "player-combat"');
    expect(source).toContain('tab: "scenario"');
    expect(source).toContain("No active Scenario is currently available.");
    expect(source).toContain("Campaign Home and completed history remain");
    expect(source).toContain("No encounter is currently available.");
    expect(source).toContain("No skill rolls are currently available.");
    expect(source).toContain("Waiting for GM to add you to an encounter.");
    expect(source).toContain("You are in this scenario, but not assigned to this encounter.");
    expect(source).toContain("loadScenarioEncounterSummaries");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("const searchParamString = searchParams.toString()");
    expect(source).not.toContain("Accessible scenarios:");
    expect(source).toContain("ArtifactPanel");
    expect(source).toMatch(/canAccessGmEncounter[\s\S]*?<ArtifactPanel campaignId=\{campaignId\}/);
  });

  it("keeps the selected Scenario and Encounter linked through canonical object routes", () => {
    const source = readSource();

    expect(source).toContain('aria-label="Scenario and Encounter context"');
    expect(source).toContain("{activeScenario.name}");
    expect(source).toContain("{activeEncounterSummary.title}");
    expect(source).toContain("buildCampaignScenarioHref");
    expect(source).toContain("buildCampaignEncounterHref");
    expect(source).toContain("encounterId: activeEncounterSummary.id");
    expect(source).toContain("scenarioId: activeScenario.id");
  });

  it("uses a task-oriented Campaign shell and keeps runtime tools contextual", () => {
    const source = readSource();

    expect(source).toContain('aria-label="Campaign tasks"');
    expect(source).toContain('label: "Membership"');
    expect(source).toContain('label: "Scenarios"');
    expect(source).toContain('label: "Campaign history"');
    expect(source).toContain('label: "Create material"');
    expect(source).toContain('label: "Notes & material"');
    expect(source).toContain("scroll={false}");
    expect(source).toContain("new MutationObserver");
    expect(source).toContain("observer.observe(document.body, { childList: true, subtree: true })");
    expect(source).toContain('target.scrollIntoView({ block: "start" })');
    expect(source).toContain("observer.disconnect()");
    expect(source).toContain('aria-label="Scenario and Encounter tools"');
    expect(source).not.toContain('aria-label="Live play context"');
  });

  it("separates completed Scenario history and omits archives from ordinary selection", () => {
    const source = readSource();

    expect(source).toContain("const liveScenarios = scenarios.filter(isLiveCampaignScenario)");
    expect(source).toContain("const completedScenarios = scenarios.filter");
    expect(source).toContain("Completed history");
    expect(source).toContain("scenarios={liveScenarios}");
    expect(source).toContain('scenario.status === "completed"');
  });

  it("routes the workspace Character tab through the encounter-context panel", () => {
    const source = readSource();

    expect(source).toContain("CharacterWorkspacePanel");
    expect(source).toContain('workspaceState.activeTab === "character"');
    expect(source).toContain('tab: "character"');
    expect(source).toContain('selectedParticipantId={searchParams.get("participantId")}');
    expect(source).toContain("isGameMaster={canAccessGmEncounter}");
    expect(source).toContain("currentRoundNumber={activeScenarioRoundNumber}");
    expect(source).toContain('activeScenario && "liveState" in activeScenario');
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

  it("refreshes workspace context on focus and keeps combat polling scoped to the selected encounter", () => {
    const source = readSource();

    expect(source.match(/loadCampaignWorkspaceAccessForUser\(\{/g)).toHaveLength(1);
    expect(source).toContain("const refreshWorkspaceContext = useCallback(");
    expect(source).toContain("workspaceContextRequestIdRef.current !== requestId");
    expect(source).toContain("isWorkspaceAuthorizationDenial");
    expect(source).toContain("clearUnauthorizedWorkspaceContext");
    expect(source).toContain('router.replace("/campaigns")');
    expect(source).toContain("await refreshWorkspaceContext(false)");
    expect(source).toContain('window.addEventListener("focus", refreshVisibleWorkspace)');
    expect(source).toContain(
      'document.addEventListener("visibilitychange", refreshVisibleWorkspace)',
    );
    expect(source).toContain("encounterSummaries");
    expect(source).toContain("activeEncounterIdRef.current !== polledEncounterId");
    expect(source).toContain("activeEncounterRequestIdRef.current !== requestId");
    expect(source).toContain('result.kind !== "updated"');
    expect(source).toContain("caughtError.status === 404");
    expect(source).toContain("const intervalId = window.setInterval(refreshVisibleCombat");
    expect(source).not.toContain("loadScenarioEncounters");
  });

  it("keeps operational Campaign load failure separate from access denial", () => {
    const source = readSource();

    expect(source).toContain("CampaignWorkspaceLoadErrorState");
    expect(source).toContain("setWorkspaceLoadError(true)");
    expect(source).toContain("setLoadAttempt((current) => current + 1)");
    expect(source).toContain("handleWorkspaceAuthorizationDenial");
    expect(source).toContain("initial || workspaceContextRequestIdRef.current !== requestId");
    expect(source).toContain('setAccessMode("none")');
    expect(source).toContain(
      'setError("We couldn\'t refresh the Campaign context. Try again or reload the page.")',
    );
    expect(source).toContain(
      'setAccessMode(canManageCampaignWorkspace(currentUser) ? "gm" : "player")',
    );
    expect(source).toContain('accessMode === "none"');
  });

  it("does not eagerly load a full encounter on Campaign, Items, or Scenario tabs", () => {
    const source = readSource();

    expect(source).toContain("const shouldLoadActiveEncounter =");
    expect(source).toContain('["character", "combat", "player-combat", "player-skill-rolls"]');
    expect(source).toContain(
      "const encounterId = shouldLoadActiveEncounter ? activeEncounterId : undefined",
    );
    expect(source).toContain("setError(undefined)");
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
    // Two mounts, both on the `player-combat` tab: the GM inspection mount and
    // the player's own. The third mount was the `player-skill-rolls` Action
    // composition, removed by #848 so that Skill rolls renders only the Skill
    // roll screen.
    expect(source.match(/<ScenarioPlayerCombatPageContent/g)).toHaveLength(2);
    expect(source).not.toContain("canComposeActionCombat");
  });
});
