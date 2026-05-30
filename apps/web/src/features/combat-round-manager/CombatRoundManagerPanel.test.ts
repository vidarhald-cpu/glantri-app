import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CombatRoundManagerPanel.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CombatRoundManagerPanel", () => {
  it("renders the GM round manager orchestration controls", () => {
    const source = readSource();

    expect(source).toContain("Combat Round Manager");
    expect(source).not.toContain("Round {roundState.roundNumber} · Current step:");
    expect(source).not.toContain("Rows are participants. Columns are round timeline cells.");
    expect(source).toContain("Commit");
    expect(source).toContain("and advance to");
    expect(source).toContain("Clear current step");
    expect(source).toContain("clearCurrentCombatRoundStepOnServer");
    expect(source).toContain("Step controller");
  });

  it("renders participants as rows and round steps as timeline columns", () => {
    const source = readSource();

    expect(source).toContain("Combat round timeline grid");
    expect(source).toContain("timelineRoundNumbers");
    expect(source).toContain("Round {roundNumber}");
    expect(source).toContain("COMBAT_ROUND_STEPS.map");
    expect(source).toContain("COMBAT_ROUND_STEP_ABBREVIATIONS[step]");
    expect(source).toContain("COMBAT_ROUND_STEP_LABELS[step]");
    expect(source).toContain("Participant");
    expect(source).not.toContain("Set active");
    expect(source).not.toContain("▶ Active");
    expect(source).toContain("getStatusMarker");
    expect(source).toContain("participant.stepStatuses[step]");
    expect(source).toContain("getParticipantDeclarationStatus");
    expect(source).toContain("participant.initiatives.phase1");
    expect(source).toContain("participant.initiatives.phase2");
    expect(source).toContain('color: initiativeTotal !== undefined ? "#1f7a4d" : undefined');
    expect(source).toContain('case "submitted":');
    expect(source).toContain('case "gmEdited":');
    expect(source).toContain('return "✓";');
    expect(source).toContain('return "·";');
    expect(source).not.toContain('return "▶";');
    expect(source).not.toContain('return input.current ? "O" : "·";');
    expect(source).toContain("step === roundState.currentStep");
    expect(source).toContain('overflowX: "auto"');
    expect(source).toContain("tableContainerRef");
    expect(source).toContain("handleTimelineKeyDown");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("ArrowDown");
    expect(source).toContain("focusRoundTable");
  });

  it("renders inspector details for the selected participant and step", () => {
    const source = readSource();

    expect(source).toContain("Combat round inspector");
    expect(source).toContain("Combat inspector —");
    expect(source).toContain("COMBAT_ROUND_STEP_LABELS[inspector.step]");
    expect(source).toContain("COMBAT_ROUND_STEP_LABELS[inspector.step]");
    expect(source).toContain("buildCombatRoundInspector");
    expect(source).toContain("selectedRoundDeclaration");
    expect(source).toContain("buildInspectorDraftKey");
    expect(source).toContain("buildInspectorPhaseContexts");
    expect(source).toContain("mergeCombatContextWithCurrentModifierBuckets");
    expect(source).toContain("applyDefaultPlayerCombatPhaseContext");
    expect(source).toContain(
      "buildDeclarationDraft(selectedScenarioParticipant, selectedRoundDeclaration)",
    );
    expect(source).toContain("draftKey.startsWith(`${participant.id}:`)");
    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("PlayerCombatActionSelectorPanel");
    expect(source).toContain("PlayerCombatActionButtonPanel");
    expect(source).toContain("PlayerCombatActionResultPanel");
    expect(source).toContain("PlayerCombatPhasePanel");
    expect(source).toContain("PlayerCombatAttackStatsTable");
    expect(source).toContain("PlayerCombatAttackTargetSelector");
    expect(source).toContain("PlayerCombatDefenseStatsTable");
    expect(source).toContain("PlayerCombatAttackLocationSelector");
    expect(source).toContain("playerCombatTopPanelRowStyle");
    expect(source).toContain("buildPlayerCombatPhasePanelModel");
    expect(source).toContain("buildPlayerCombatLoadoutSummary");
    expect(source).toContain("buildPlayerCombatDefenseStats");
    expect(source).toContain("loadCanonicalContent");
    expect(source).toContain("buildEquipmentLoadoutModuleModel");
    expect(source).toContain("loadServerCharacterById");
    expect(source).toContain("loadCharacterEquipmentState");
    expect(source).toContain("resolvedCharacterStateByParticipantId");
    expect(source).toContain("hydrateInspectorCharacterState");
    expect(source).toContain("buildEncounterLiveCombatModifierSummary");
    expect(source).toContain("selectedScenarioParticipant?.state.combatEffects");
    expect(source).toContain("saveInspectorDeclaration");
    expect(source).toContain("onAddEntry={(bucketKey, entry) =>");
    expect(source).toContain("entry ?? createModifierEntryDraft()");
    expect(source).toContain("getGmCombatStepActionLabel");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("buttonLabel={getGmCombatStepActionLabel(roundState.currentStep)}");
    expect(source).not.toContain("GM can save or revise this declaration at any round step.");
    expect(source).toContain("inspectorStatusSuffix");
    expect(source).toContain('" Declared."');
    expect(source).toContain('" Initiative rolled."');
    expect(source).toContain("statusText={`Current step: ${getPlayerCombatStepLabel(");
    expect(source).toContain("rollInspectorInitiative");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("getCombatRoundInitiativeRanks");
    expect(source).toContain("getCombatRoundInitiativeTotal");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).not.toContain("phaseLabel: formatCombatInitiativeRoll");
    expect(source).toContain("formatInitiativeRankLabel");
    expect(source).toContain("rankLabel");
    expect(source).toContain("rank.tiedCount > 1");
    expect(source).toContain("tied with ${rank.tiedCount}");
    expect(source).toContain("buildEncounterInitiativeModifierCalculation");
    expect(source).toContain("inspectorInitiativeCalculation");
    expect(source).toContain(
      "initiativeModifierAdjustment: inspectorInitiativeCalculation.modifierAdjustment",
    );
    expect(source).toContain("phaseContexts: inspectorDraft.phaseContexts");
    expect(source).toContain(
      'const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2"',
    );
    expect(source).toContain("const phaseCombatContext = inspectorDraft.phaseContexts[phaseKey]");
    expect(source).not.toContain("formatCombatInitiativeRoll(inspector");
    expect(source).not.toContain("Action status:");
    expect(source).not.toContain("Damage review:");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("phaseModel.showAttackStats");
    expect(source).toContain("phaseModel.showAttackLocationSelector");
    expect(source).toContain("inspectorTargetOptions");
    expect(source).toContain("getPlayerEncounterOpponentParticipants");
    expect(source).toContain("targetOptions={inspectorTargetOptions}");
    expect(source).toContain("phaseModel.showDefenseContext");
    expect(source).toContain("actionId: inspectorDraft.actionId");
    expect(source).toContain("secondaryActionId: inspectorDraft.secondaryActionId");
    expect(source).not.toContain("inspectorOpponentOptions");
    expect(source).toContain("moveSelectedParticipantDown");
    expect(source).toContain("Select a participant step to inspect combat details.");
    expect(source).toContain("Previous participant");
    expect(source).toContain("Next participant");
    expect(source).toContain("Previous step");
    expect(source).toContain("Next step");
  });

  it("persists combat round updates through narrow encounter commands", () => {
    const source = readSource();

    expect(source).toContain("updateEncounterOnServer");
    expect(source).toContain("combatRoundState: nextRoundState");
    expect(source).toContain("currentRound: nextRoundState.roundNumber");
    expect(source).toContain("submitCombatDeclarationOnServer");
    expect(source).toContain("clearCurrentCombatRoundStepOnServer");
    expect(source).not.toContain("actionLog:");
  });
});
