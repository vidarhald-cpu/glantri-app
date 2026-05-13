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
    expect(source).toContain("currentUserId: currentUser?.id");
  });

  it("renders player scenario links and useful empty states", () => {
    const source = readSource();

    expect(source).toContain("Accessible scenarios:");
    expect(source).toContain('tab: "scenario"');
    expect(source).toContain("No accessible scenario selected.");
    expect(source).toContain("Choose a scenario to open the player scenario view.");
    expect(source).toContain("No player encounter is currently available.");
    expect(source).toContain("Waiting for GM to add you to an encounter.");
  });
});
