import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PlayerCombatPanels.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PlayerCombatPanels", () => {
  it("exposes reusable combat modifier rows with the shared player combat buckets", () => {
    const source = readSource();

    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("getPlayerEncounterCombatModifierTotals");
    expect(source).toContain("General/Fatigue");
    expect(source).toContain("liveModifiers?.generalFatigueRaw");
    expect(source).toContain("Skill/OB");
    expect(source).toContain("DB");
  });

  it("keeps player combat modifiers editable while allowing read-only inspector use", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("readOnly");
    expect(source).toContain("onAddEntry");
    expect(source).toContain("onRemoveEntry");
    expect(source).toContain("onUpdateEntry");
    expect(source).toContain("disabled={controlsDisabled}");
    expect(source).toContain("row.locked");
  });

  it("renders reusable phase panels for Phase 1 and Phase 2 combat summaries", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatPhasePanel");
    expect(source).toContain("phaseCard.phaseLabel");
    expect(source).toContain("phaseCard.title");
    expect(source).toContain("phaseCard.description");
    expect(source).toContain("phaseCard.stats");
    expect(source).toContain("PlayerCombatAttackStatsTable");
    expect(source).toContain("I");
    expect(source).toContain("OB");
    expect(source).toContain("DMB");
    expect(source).toContain("AM");
    expect(source).toContain("MC");
  });

  it("exposes the canonical combat action selector and declaration panels", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatActionSelectorPanel");
    expect(source).toContain("Action selector");
    expect(source).toContain("Secondary action");
    expect(source).toContain("Movement");
    expect(source).toContain("Additional");
    expect(source).toContain("roundNumber");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("Parry context");
    expect(source).toContain("PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS");
    expect(source).not.toContain("PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS");
    expect(source).toContain("PlayerCombatActionButtonPanel");
    expect(source).toContain("getPlayerCombatActionButtonLabel");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("getGmCombatStepActionLabel");
    expect(source).toContain("Declare action");
    expect(source).toContain("Review modifiers");
    expect(source).toContain("Phase 1 initiative");
    expect(source).not.toContain("Declare action — DE");
    expect(source).toContain("Waiting for GM");
    expect(source).toContain("Declare modifiers");
    expect(source).toContain("Set/Roll phase 1 initiative");
    expect(source).toContain("Set/Roll phase 2 initiative");
    expect(source).toContain("PlayerCombatActionResultPanel");
    expect(source).toContain("formatCombatInitiativeRoll");
  });
});
