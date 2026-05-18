import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CampaignWorkspaceShell.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignWorkspaceShell roleplay encounter routing", () => {
  it("routes player roleplay encounters to the player roleplaying screen", () => {
    const source = readSource();

    expect(source).toContain("PlayerRoleplayingEncounterScreen");
    expect(source).toContain('activeEncounter?.kind === "roleplay"');
    expect(source).toContain("ScenarioPlayerCombatPageContent");
    expect(source).toContain("loadScenarioParticipants");
    expect(source).toContain("loadScenarioMyParticipant");
    expect(source).toContain('workspaceAccess.accessMode === "player"');
    expect(source).toContain("currentUserId: currentUser?.id");
  });

  it("renders player scenario links and useful empty states", () => {
    const source = readSource();

    expect(source).toContain("Available scenarios");
    expect(source).toContain('tab: "scenario"');
    expect(source).toContain("No active scenario is currently available.");
    expect(source).toContain("No player encounter is currently available.");
    expect(source).toContain("Waiting for GM to add you to an encounter.");
    expect(source).toContain("You are in this scenario, but not assigned to this encounter.");
    expect(source).toContain("refreshWorkspaceContextWithErrorHandling");
    expect(source).toContain("visibilitychange");
    expect(source).not.toContain("Accessible scenarios:");
  });

  it("routes the workspace Character tab through the encounter-context panel", () => {
    const source = readSource();

    expect(source).toContain("CharacterWorkspacePanel");
    expect(source).toContain('workspaceState.activeTab === "character"');
    expect(source).toContain('tab: "character"');
    expect(source).toContain("selectedParticipantId={searchParams.get(\"participantId\")}");
    expect(source).toContain("isGameMaster={canAccessGmEncounter}");
    expect(source).toContain("currentRoundNumber={activeScenario?.liveState?.roundNumber}");
  });

  it("routes the workspace Combat tab through the recovered combat panel", () => {
    const source = readSource();

    expect(source).toContain('workspaceState.activeTab === "combat"');
    expect(source).toContain("ScenarioPlayerCombatPageContent");
    expect(source).toContain('workspaceTab="combat"');
    expect(source).toContain("Select a scenario to open the combat panel.");
    expect(source).toContain("No combat encounter is currently available.");
  });
});
