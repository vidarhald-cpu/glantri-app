import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "ScenarioPlayerCombatPageContent.tsx",
);

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("ScenarioPlayerCombatPageContent", () => {
  it("keeps the recovered combat panel importable without future placeholder panels", () => {
    const source = readSource();

    expect(source).toContain("export default function ScenarioPlayerCombatPageContent");
    expect(source).toContain("PlayerCombatActionSelectorPanel");
    expect(source).toContain("PlayerCombatActionButtonPanel");
    expect(source).toContain("PlayerCombatActionResultPanel");
    expect(source).toContain("playerCombatPanelRowStyle");
    expect(source).toContain("EquipmentLoadoutModule");
    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("PlayerCombatPhasePanel");
    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("getPlayerCombatActionButtonLabel");
    expect(source).toContain("buildEncounterLiveCombatModifierSummary");
    expect(source).toContain("combatEffects: selectedParticipant?.state.combatEffects");
    expect(source).toContain("liveCombatModifiers");
    expect(source).toContain('workspaceTab = "player-encounter"');
    expect(source).toContain("displayedParticipant?.displayName ? ` — ${displayedParticipant.displayName}`");
    expect(source).toContain("showParticipantSelector = true");
    expect(source).toContain("readOnlyInspection = false");
    expect(source).not.toContain("GM player-view inspection is read-only.");
    expect(source).toContain("declarationStepOpen");
    expect(source).toContain("selectedDeclarationStepStatus");
    expect(source).toContain("selectedParticipantDeclaredThisRound");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("Current step: ${currentCombatStepLabel}");
    expect(source).not.toContain("Current step: ${currentCombatStepAbbreviation}");
    expect(source).toContain("Declared.");
    expect(source).toContain("Declaration closed.");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("rollInitiative");
    expect(source).toContain("currentInitiativePhase");
    expect(source).toContain("Initiative rolled.");
    expect(source).toContain("declarationButtonLabel");
    expect(source).toContain("buttonLabel={declarationButtonLabel}");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("combatDeclarationDraftDirty");
    expect(source).toContain("buildPlayerCombatDeclarationDraftKey");
    expect(source).toContain("buildPlayerCombatDeclarationDraft");
    expect(source).toContain("selectedRoundDeclaration");
    expect(source).toContain("markCombatDeclarationDraftDirty");
    expect(source).toContain("combatDeclarationDraftKey === selectedCombatDeclarationDraftKey");
    expect(source).toContain("(isGameMaster || declarationStepOpen)");
    expect(source).toContain("setCombatDeclarationDraftDirty(false)");
    expect(source).toContain("readOnly={!isGameMaster}");
    expect(source).toContain("isGameMaster");
    expect(source).not.toContain("will appear here in the next phase");
    expect(source).not.toContain("will expand into this area");
  });
});
