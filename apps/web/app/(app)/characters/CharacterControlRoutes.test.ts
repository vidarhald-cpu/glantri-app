import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routePath = dirname(fileURLToPath(import.meta.url));

function readRoute(relativePath: string): string {
  return readFileSync(join(routePath, relativePath), "utf8");
}

describe("character control routes", () => {
  it("keeps the existing Equip items route wired to the shared loadout view", () => {
    const source = readRoute("[id]/loadout/page.tsx");

    expect(source).toContain("CharacterLoadoutView");
    expect(source).toContain("<CharacterLoadoutView characterId={id} />");
    expect(source).not.toContain("showPhysicalState");
  });

  it("keeps the shared loadout view ready for workspace Character control without changing Equip items", () => {
    const sharedViewSource = readRoute("[id]/components/CharacterLoadoutView.tsx");

    expect(sharedViewSource).toContain("Equip items -");
    expect(sharedViewSource).toContain("PhysicalStateSection");
    expect(sharedViewSource).toContain("buildEncounterLiveCombatModifierSummary");
    expect(sharedViewSource).toContain("showPhysicalState");
    expect(sharedViewSource).toContain("liveCombatModifiers");
    expect(sharedViewSource).toContain("calculateCharacterGeneralHitpoints");
    expect(sharedViewSource).toContain("saveCombatEffect");
    expect(sharedViewSource).toContain("applyCombatEffectDraft");
    expect(sharedViewSource).toContain("removeCombatEffect");

    // #1118: the add/remove effect logic is shared with the GM NPC Physical state view.
    const combatEffectEditsSource = readFileSync(
      join(routePath, "../../../src/lib/characters/combatEffectEdits.ts"),
      "utf8",
    );
    expect(combatEffectEditsSource).toContain("draft.sourceEventId");
    expect(combatEffectEditsSource).toContain("existingEvent");
    expect(combatEffectEditsSource).toContain("buildCombatEffectsFromDraft");
    expect(combatEffectEditsSource).toContain("draft.locationIds.length > 0");
    expect(combatEffectEditsSource).toContain("generalDamage: isGeneralDamage ? draft.damage : 0");
    expect(sharedViewSource).toContain("physicalStateCurrentRoundNumber");
    expect(sharedViewSource).toContain("beforeEquipmentChoices=");
    expect(sharedViewSource).toContain("showPhysicalState ? 1240 : 900");
    expect(sharedViewSource).toContain("onSaveCombatEffect={saveCombatEffect}");
    expect(sharedViewSource).not.toContain("afterEquipmentChoices=");
    expect(sharedViewSource).not.toContain("rolledStats.health");
    expect(sharedViewSource).not.toContain("combat arena");
  });
});
