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
    expect(source).toContain("PlayerCombatAttackStatsTable");
    expect(source).toContain("PlayerCombatAttackTargetSelector");
    expect(source).toContain("PlayerCombatAttackLocationSelector");
    expect(source).toContain("PlayerCombatDefenseStatsTable");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("playerCombatTopPanelRowStyle");
    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("buildPlayerCombatPhasePanelModel");
    expect(source).toContain("buildPlayerCombatLoadoutSummary");
    expect(source).toContain("buildPlayerCombatDefenseStats");
    expect(source).toContain("getPlayerCombatActionButtonLabel");
    expect(source).toContain("buildEncounterLiveCombatModifierSummary");
    expect(source).toContain("getCombatRoundModifierPhaseForStep");
    expect(source).toContain("const currentModifierPhase = getCombatRoundModifierPhaseForStep(currentCombatStep)");
    expect(source).toContain("phaseKey: currentModifierPhase");
    expect(source).toContain("validateCombatDeclarationTargets");
    expect(source).toContain("targetValidation");
    expect(source).toContain("declarationTargetValidationMessage");
    expect(source).toContain("validationMessage={declarationTargetValidationMessage}");
    expect(source).toContain("mergeCombatContextWithCurrentModifierBuckets");
    expect(source).toContain("combatEffects: selectedParticipant?.state.combatEffects");
    expect(source).toContain("liveCombatModifiers");
    expect(source).toContain('workspaceTab = "player-encounter"');
    expect(source).toContain(
      "displayedParticipant?.displayName ? ` — ${displayedParticipant.displayName}`",
    );
    expect(source).toContain("showParticipantSelector = true");
    expect(source).toContain("if (!showParticipantSelector) {");
    expect(source).toContain("readOnlyInspection = false");
    expect(source).not.toContain("GM player-view inspection is read-only.");
    expect(source).toContain("declarationStepOpen");
    expect(source).toContain("selectedDeclarationStepStatus");
    expect(source).toContain("selectedParticipantDeclaredThisRound");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("Current step: ${currentCombatStepLabel}");
    expect(source).not.toContain("Current step: ${currentCombatStepAbbreviation}");
    expect(source).toContain("Declared.");
    expect(source).toContain("selectedParticipantHasDeclared");
    expect(source).toContain("gmStatusSuffix");
    expect(source).toContain('" Initiative rolled."');
    expect(source).toContain('" Modifiers declared."');
    expect(source).not.toContain("GM can save or revise this participant declaration.");
    expect(source).toContain("Declaration closed.");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("rollInitiative");
    expect(source).toContain("currentInitiativePhase");
    expect(source).toContain("Initiative rolled.");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).toContain("buildEncounterInitiativeModifierCalculation");
    expect(source).toContain("initiativeCalculation");
    expect(source).toContain(
      "initiativeModifierAdjustment: initiativeCalculation.modifierAdjustment",
    );
    expect(source).toContain("formatPlayerCombatInitiativeRank");
    expect(source).toContain("getCombatRoundInitiativeRanks");
    expect(source).toContain("rank.tiedCount > 1");
    expect(source).toContain("tied with ${rank.tiedCount}");
    expect(source).toContain("selectedCurrentInitiative");
    expect(source).toContain("rankLabel: selectedCurrentInitiativeRankLabel");
    expect(source).toContain("declarationButtonLabel");
    expect(source).toContain("buttonLabel={declarationButtonLabel}");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("combatDeclarationDraftDirty");
    expect(source).toContain("buildPlayerCombatDeclarationDraftKey");
    expect(source).toContain("buildPlayerCombatDeclarationDraft");
    expect(source).toContain("buildPlayerCombatPhaseContexts");
    expect(source).toContain("applyDefaultPlayerCombatPhaseContext");
    expect(source).toContain("phaseCombatContextDrafts");
    expect(source).toContain("phaseContexts: phaseCombatContextDrafts");
    expect(source).toContain(
      'const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2"',
    );
    expect(source).toContain("setPhaseCombatContextDrafts((current) => ({");
    expect(source).toContain("selectedRoundDeclaration");
    expect(source).toContain("markCombatDeclarationDraftDirty");
    expect(source).toContain("combatDeclarationDraftKey === selectedCombatDeclarationDraftKey");
    expect(source).toContain("(isGameMaster || declarationStepOpen)");
    expect(source).toContain("setCombatDeclarationDraftDirty(false)");
    expect(source).toContain("onAddEntry={");
    expect(source).toContain("isGameMaster");
    expect(source).toContain("(bucketKey, entry) =>");
    expect(source).toContain("entry ?? createModifierEntryDraft()");
    expect(source).toContain("readOnly={!isGameMaster}");
    expect(source).toContain("roundNumber={combatRoundState?.roundNumber}");
    expect(source).toContain("mainHandParryItemLabel");
    expect(source).toContain("offHandParryItemLabel");
    expect(source).toContain("phaseModel.showAttackStats");
    expect(source).toContain("phaseModel.showAttackLocationSelector");
    expect(source).toContain("targetOptions={targetOptions}");
    expect(source).toContain("getPlayerEncounterOpponentParticipants");
    expect(source).toContain("projectionVisibleParticipants: projection?.visibleParticipants");
    expect(source).toContain("selectedParticipantId: selectedParticipant?.id");
    expect(source).toContain("phaseModel.showDefenseContext");
    expect(source).not.toContain("movementLabel=");
    expect(source).not.toContain('description: selectedSecondaryActionId ? "" : "Open"');
    expect(source).not.toContain("formatCombatInitiativeRoll(selectedRoundParticipant");
    expect(source).not.toContain("Attack - Parry ·");
    expect(source).not.toContain("visibleOpponentOptions");
    expect(source).toContain("isGameMaster");
    expect(source).not.toContain("will appear here in the next phase");
    expect(source).not.toContain("will expand into this area");
  });
});
