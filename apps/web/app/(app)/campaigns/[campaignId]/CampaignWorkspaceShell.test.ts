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
  });
});
