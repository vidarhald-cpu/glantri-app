import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildPlayerCharacterCanonicalDetailLinks } from "./CharacterWorkspacePanel";

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

describe("CharacterWorkspacePanel canonical Character click-through", () => {
  it("routes only to player-reachable, Character-owned destinations", () => {
    expect(buildPlayerCharacterCanonicalDetailLinks("character-scyrian")).toEqual([
      { href: "/characters/character-scyrian", label: "Open the full character sheet" },
      {
        href: "/characters/character-scyrian/equipment",
        label: "Open the full equipment inventory",
      },
    ]);
  });

  it("never routes a player at a Campaign-owned equipment destination", () => {
    const source = readSource();

    for (const href of buildPlayerCharacterCanonicalDetailLinks("character-scyrian").map(
      (link) => link.href,
    )) {
      expect(href.startsWith("/characters/")).toBe(true);
      expect(href).not.toContain("/campaigns/");
      expect(href).not.toContain("tab=items");
    }

    expect(source).not.toContain("tab=items");
    expect(source).not.toContain("Campaign Equipment");
  });

  it("renders the click-through for the player perspective only, leaving the GM view unchanged", () => {
    const source = readSource();

    expect(source).toContain("{!isGameMaster && selectedCandidate ? (");
    expect(source).toContain('aria-label="Character detail"');
    expect(source).toContain(
      "buildPlayerCharacterCanonicalDetailLinks(selectedCandidate.characterId)",
    );
  });

  it("introduces no Reveal, Share, Place or Remove vocabulary and adjudicates no knowledge", () => {
    const source = readSource();

    for (const reserved of [
      "reveal",
      "Reveal",
      "share",
      "Share",
      "placement",
      "Placement",
      "placeOn",
      "canKnow",
      "canSee",
    ]) {
      expect(source).not.toContain(reserved);
    }
  });
});
