import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CharacterWorkspacePanel.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CharacterWorkspacePanel", () => {
  it("reuses the loadout view with Physical state and without future combat-state placeholders", () => {
    const source = readSource();

    expect(source).toContain("CharacterLoadoutView");
    expect(source).toContain("physicalStateGeneralHitpoints");
    expect(source).toContain("physicalStateCurrentRoundNumber={currentRoundNumber}");
    expect(source).toContain("selectedCandidate.scenarioParticipant.state.health.maxHp");
    expect(source).toContain("physicalStateCombatContext={");
    expect(source).toContain("selectedCandidate.scenarioParticipant.state.combat.combatContext");
    expect(source).toContain("preferCurrentCharacterRecord");
    expect(source).not.toContain("Combat arena");
  });

  it("keeps player and GM character controls separate", () => {
    const source = readSource();

    expect(source).toContain("You are not currently assigned to a character in this scenario.");
    expect(source).toContain("WorkspaceParticipantInspectionHeader");
    expect(source).toContain('screenName="Character"');
    expect(source).toContain("onSelectParticipantId={onSelectParticipantId}");
  });

  it("enables manual combat effect editing only for the GM character workspace", () => {
    const source = readSource();

    expect(source).toContain("updateScenarioParticipantStateOnServer");
    expect(source).toContain("combatEffects: nextCombatEffects");
    expect(source).toContain("canEditCombatEffects={isGameMaster}");
    expect(source).toContain(
      "onCombatEffectsChange={isGameMaster ? updateSelectedCombatEffects : undefined}",
    );
  });

  it("recommits explicit GM loadout edits through the canonical scenario equipment operation", () => {
    const source = readSource();

    expect(source).toContain("refreshScenarioParticipantEquipmentOnServer");
    expect(source).toContain("refreshSelectedScenarioEquipment");
    expect(source).toContain(
      "onEquipmentStateChange={isGameMaster ? refreshSelectedScenarioEquipment : undefined}",
    );
    expect(source).toContain("onScenarioParticipantUpdated?.(participant)");
    expect(source).toContain("Scenario equipment was reconciled");
  });
});
