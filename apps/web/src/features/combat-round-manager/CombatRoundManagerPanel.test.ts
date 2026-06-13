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
    expect(source).toContain('"Complete round"');
    expect(source).toContain("Current task");
    expect(source).toContain("Return to the current unresolved combat step");
    expect(source).toContain("Clear current step");
    expect(source).toContain("canClearCombatRoundStep");
    expect(source).toContain("clearCurrentStepAvailable");
    expect(source).toContain("disabled={saving || !clearCurrentStepAvailable}");
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
      "buildDeclarationDraft(selectedScenarioParticipant, selectedRoundDeclaration,",
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
    expect(source).toContain("getCombatRoundModifierPhaseForStep");
    expect(source).toContain(
      "const inspectorModifierPhase = getCombatRoundModifierPhaseForStep(inspector.step)",
    );
    expect(source).toContain("getCombatRoundStepSnapshot");
    expect(source).toContain("inspectorSnapshot");
    expect(source).toContain("inspectorDisplayDraft");
    expect(source).toContain("inspectorDisplayModifierRows");
    expect(source).toContain("Committed");
    expect(source).toContain("phaseKey: inspectorModifierPhase");
    expect(source).toContain("validateCombatDeclarationTargets");
    expect(source).toContain("inspectorTargetValidation");
    expect(source).toContain("inspectorTargetValidationMessage");
    expect(source).toContain("validationMessage={inspectorActionValidationMessage}");
    expect(source).toContain("hasScenarioParticipantCombatDeclarationForEncounterRound");
    expect(source).toContain("selectedScenarioParticipant?.state.combatEffects");
    expect(source).toContain("saveInspectorDeclaration");
    expect(source).toContain("onAddEntry={(bucketKey, entry) =>");
    expect(source).toContain("entry ?? createModifierEntryDraft()");
    expect(source).toContain("getGmCombatStepActionLabel");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("buttonLabel={inspectorActionButtonLabel}");
    expect(source).not.toContain("GM can save or revise this declaration at any round step.");
    expect(source).toContain("inspectorStatusSuffix");
    expect(source).toContain('" Declared."');
    expect(source).toContain('" Initiative rolled."');
    expect(source).toContain("statusText={`Current step: ${getPlayerCombatStepLabel(");
    expect(source).toContain("rollInspectorInitiative");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("rollInspectorPhaseAttack");
    expect(source).toContain("rollCombatAttackOnServer");
    expect(source).toContain("rollInspectorParry");
    expect(source).toContain("rollOpenEndedD20");
    expect(source).toContain("resolveCombatParry");
    expect(source).toContain("recordCombatRoundParryResult");
    expect(source).toContain("recordCombatRoundDamageResult");
    expect(source).toContain("recordCombatRoundNoAttackPhaseReview");
    expect(source).toContain("formatOpenEndedD20RollBreakdown");
    expect(source).toContain("formatCombatDefenseResultMainLine");
    expect(source).toContain("formatCombatParryCalculationLine");
    expect(source).toContain("formatCombatParryModifierBreakdown");
    expect(source).toContain("getCombatRoundOutgoingAttackResultForParticipantPhase");
    expect(source).toContain("getCombatRoundDisplayIncomingAttackResultForParticipantPhase");
    expect(source).toContain("ensureCombatRoundPhaseResolutionResultsForPhase");
    expect(source).toContain("getCombatRoundPhaseResolutionResultForAttack");
    expect(source).toContain("getCombatRoundPhaseResolutionStatus");
    expect(source).toContain("getCombatRoundResolutionPhaseForStep");
    expect(source).toContain("getCombatRoundEffectiveDamageResult");
    expect(source).toContain("getHitLocationFullLabel");
    expect(source).toContain("completeCombatRoundPhaseResolutionForParticipant");
    expect(source).toContain("advanceCombatRoundPhaseResolutionSubstepForParticipant");
    expect(source).toContain("combatRoundParticipantHasPhaseAttack");
    expect(source).toContain("formatCombatResolutionSubstepLabel");
    expect(source).toContain("formatCombatResolutionNextLabel");
    expect(source).toContain("getCombatResolutionButtonLabel");
    expect(source).toContain("formatCombatPhaseResolutionResultLines");
    expect(source).toContain("getCombatRoundDamageSubstate");
    expect(source).toContain("recordCombatRoundHitLocationRoll");
    expect(source).toContain("recordCombatRoundCriticalRoll");
    expect(source).toContain("formatCombatToHitCalculationLine");
    expect(source).toContain("Parry: ${formatResolutionStatusLabel");
    expect(source).toContain("sourcePrefix");
    expect(source).toContain("modifiedParryBeforeRoll");
    expect(source).toContain("buildCombatRoundPhasePanelProjection");
    expect(source).toContain("selectedResolutionContext");
    expect(source).toContain('label: "attack result"');
    expect(source).toContain("value: attackResultModifier");
    expect(source).toContain("extraRawModifiers: inspectorParryExtraRawModifiers");
    expect(source).toContain("loadoutModel: baseLoadoutModel");
    expect(source).toContain("parrySourceLabel");
    expect(source).toContain("modifierBreakdown: parry.rawModifiers");
    expect(source).toContain("rawModifierTotal: parry.rawModifierTotal");
    expect(source).toContain("Parry successful");
    expect(source).toContain("Parry failed");
    expect(source).toContain("Roll hit location");
    expect(source).toContain("Roll critical");
    expect(source).toContain("Resolve damage");
    expect(source).toContain("Commit phase damage");
    expect(source).toContain("Phase damage committed");
    expect(source).toContain("Damage review");
    expect(source).toContain("criticalEffectProposal");
    expect(source).toContain("Critical table mapping unavailable");
    expect(source).toContain("App rolls:");
    expect(source).toContain("Additional immediate effects");
    expect(source).toContain("Add modifier effect");
    expect(source).toContain("Add note effect");
    expect(source).toContain("Save review");
    expect(source).toContain("reviewCombatRoundDamageResult");
    expect(source).toContain("commitCombatRoundPhaseDamage");
    expect(source).toContain("updateScenarioParticipantStateOnServer");
    expect(source).toContain("combatEffects: committed.combatEffects");
    expect(source).toContain("selectedHitLocationOverride: effectiveDamage?.effectiveSelectedHitLocation");
    expect(source).toContain("criticalGradeOverride: effectiveDamage?.effectiveCriticalGrade ?? \"none\"");
    expect(source).toContain("armorModifierOverride: effectiveDamage?.effectiveArmorModifier.toString()");
    expect(source).toContain(
      "armorCriticalModifierOverride: effectiveCritical.armorCriticalModifier?.toString()",
    );
    expect(source).toContain(
      "criticalTypeModifierOverride: effectiveCritical.criticalTypeModifier?.toString()",
    );
    expect(source).toContain(
      "finalCriticalRollOverride: effectiveCritical.finalCriticalRoll?.toString()",
    );
    expect(source).toContain("totalDamageOverride: effectiveDamage?.effectiveTotalDamage.toString()");
    expect(source).toContain("selectedHitLocationValue !== effectiveDamage.computedSelectedHitLocation");
    expect(source).toContain("armorModifier !== effectiveDamage.computedArmorModifier");
    expect(source).toContain("reviewWithoutTotalDamageOverride");
    expect(source).toContain("totalDamage !== draftEffectiveDamage.effectiveTotalDamage");
    expect(source).not.toContain('<option value="">Computed</option>');
    expect(source).not.toContain("Computed: {computedLocation}");
    expect(source).not.toContain("Effective: {effectiveLocation}");
    expect(source).toContain("`${referenceLabel}; roll ${rollLabel}");
    expect(source).toContain("hit ${hitLookupTotal} + DMB ${damage.dmb}");
    expect(source).toContain("table damage ${tableDamage}");
    expect(source).toContain("Location: ${selected}");
    expect(source).toContain("Armor: not applied yet");
    expect(source).toContain('title: "To hit"');
    expect(source).toContain('title: "Parry"');
    expect(source).toContain('title: "Location"');
    expect(source).toContain('title: "Damage"');
    expect(source).toContain('title: "Critical"');
    expect(source).toContain("Critical roll required");
    expect(source).toContain("Result: critical roll");
    expect(source).toContain("sections: inspectorPhaseResolutionLines.sections");
    expect(source).toContain("resultLine: `Result: ${formatCombatAttackTableResultLabel");
    expect(source).toContain("damage${formatCombatDamageResultLocationSuffix(damageResult)}");
    expect(source).toContain("targetLocation:");
    expect(source).toContain("attackerRoundParticipant?.declaration?.phaseContexts?.[phase]?.targetLocation");
    expect(source).toContain("Damage roll: ${formatResolutionStatusLabel");
    expect(source).toContain("Proposal: ${formatResolutionStatusLabel");
    expect(source).toContain("Effects: ${damageResult.review.additionalEffects");
    expect(source).toContain("rollCombatAttackOnServer({");
    expect(source).toContain("defenderScenarioParticipantId: targetScenarioParticipant.id");
    expect(source).toContain("scenarioParticipantId: selectedScenarioParticipant.id");
    expect(source).toContain("weaponCriticalCode: phaseModel.attackStats.weaponCriticalCode");
    expect(source).toContain("weaponDamageClass: phaseModel.attackStats.weaponDamageClass");
    expect(source).toContain("completeInspectorPhaseResolution");
    expect(source).toContain("getCombatRoundInitiativeRanks");
    expect(source).toContain("getCombatRoundInitiativeTotal");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).toContain("formatCombatAttackResultMainLine");
    expect(source).toContain("formatCombatAttackResultLine");
    expect(source).toContain("Result: ${inspectorDisplayAttackResult.tableResult}");
    expect(source).toContain("inspectorDisplayPhaseResolutionResult");
    expect(source).toContain("inspectorPhaseResolutionCursor");
    expect(source).toContain("inspectorPhaseResolutionStatus");
    expect(source).toContain("inspectorIsCursorParticipant");
    expect(source).toContain("inspectorCurrentPhaseHasAttack");
    expect(source).toContain("inspectorCanRollPhaseAttack");
    expect(source).toContain("inspectorSelectedAttackAlreadyRolled");
    expect(source).toContain("inspectorCanRollParry");
    expect(source).toContain('inspectorResolutionStepKind === "parry"');
    expect(source).toContain("inspectorPhaseResolutionOwnerParticipantId");
    expect(source).toContain("CombatParryResolutionPanel");
    expect(source).toContain("Main hand");
    expect(source).toContain("Off hand");
    expect(source).toContain("Roll parry");
    expect(source).toContain('"Attack already rolled"');
    expect(source).toContain("inspectorActionButtonLabel");
    expect(source).toContain("advanceInspectorPhaseResolutionSubstep");
    expect(source).toContain("Current actor:");
    expect(source).toContain("Next:");
    expect(source).toContain("${phaseLabel} attack roll");
    expect(source).toContain("${phaseLabel} parry review");
    expect(source).toContain("phaseResolutionResult");
    expect(source).toContain("phaseResolutionStatus");
    expect(source).toContain("Resolution review pending.");
    expect(source).toContain("getCombatRoundParticipantPhaseStepStatus");
    expect(source).toContain("formatSelectedCombatParrySourceName");
    expect(source).toContain("phaseProjection.phaseModel");
    expect(source).toContain("phaseDefenseStats");
    expect(source).not.toContain("input.sources.mainHand.label} P");
    expect(source).not.toContain("input.sources.offHand.label} P");
    expect(source).toContain("No ${formatCombatPhaseLabel");
    expect(source).toContain(
      "const inspectorAttackPhase = getCombatAttackPhaseForStep(inspector.step)",
    );
    expect(source).toContain(
      "const inspectorResolutionPhase = getCombatRoundResolutionPhaseForStep(inspector.step)",
    );
    expect(source).toContain(
      "const inspectorSelectedStepIsSequential = isSequentialResolutionStep(inspector.step)",
    );
    expect(source).toContain("const inspectorCurrentAttackPhase = inspectorAttackPhase");
    expect(source).not.toContain(
      "const inspectorCurrentAttackPhase = getCombatAttackPhaseForStep(roundState.currentStep)",
    );
    expect(source).toContain('step === "phase_2_actions"');
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
    expect(source).toContain(
      "const phaseCombatContext = inspectorDisplayDraft.phaseContexts[phaseKey]",
    );
    expect(source).not.toContain("formatCombatInitiativeRoll(inspector");
    expect(source).not.toContain("Action status:");
    expect(source).not.toContain("Damage review:");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("phaseModel.showAttackStats");
    expect(source).toContain("phaseModel.showAttackLocationSelector");
    expect(source).toContain("inspectorAttackSourceValidationMessage");
    expect(source).toContain("No ${formatCombatPhaseLabel(inspectorCurrentAttackPhase)} attack source available.");
    expect(source).toContain("phaseKey: input.phaseKey");
    expect(source).toContain("inspectorTargetOptions");
    expect(source).toContain("getPlayerEncounterOpponentParticipants");
    expect(source).toContain("allowedParticipantIds: encounterScenarioParticipantIds");
    expect(source).toContain("getEncounterScenarioParticipantIds");
    expect(source).toContain("targetOptions={inspectorTargetOptions}");
    expect(source).toContain("phaseModel.showDefenseContext");
    expect(source).toContain("actionId: inspectorDisplayDraft.actionId");
    expect(source).toContain("secondaryActionId: inspectorDisplayDraft.secondaryActionId");
    expect(source).not.toContain("inspectorOpponentOptions");
    expect(source).not.toContain("moveSelectedParticipantDown");
    expect(source).toContain("const actedParticipantId = selectedEncounterParticipant.id");
    expect(source).toContain("fromParticipantId: actedParticipantId");
    expect(source).toContain("pendingSelectionRef");
    expect(source).toContain("manualSelectionRef");
    expect(source).toContain("normalizeCombatRoundManagerSelection");
    expect(source).toContain("getCurrentCombatRoundTaskSelection");
    expect(source).toContain("getNextCombatRoundParticipantSelection");
    expect(source).toContain(
      "const shouldUsePersistedCursor = isGlobalCombatRoundParticipantStep(actedStep)",
    );
    expect(source).toContain("const nextSelection = shouldUsePersistedCursor");
    expect(source).toContain("? normalizeCombatRoundManagerSelection({");
    expect(source).toContain("pendingSelectionRef.current = undefined");
    expect(source).toContain("manualSelectionRef.current = undefined");
    expect(source).toContain("Use inspector for phase resolution");
    expect(source).toContain("isSequentialResolutionStep(inspector.step)");
    expect(source).toContain("disabled={saving || inspectorSelectedStepIsSequential}");
    expect(source).toContain("const commandParticipantId =");
    expect(source).toContain("advanceCombatRoundStep(stateForCommit, advanceInput)");
    expect(source).toContain("command: {");
    expect(source).toContain("participantId: commandParticipantId");
    expect(source).toContain("inspectorSelectedAttackAlreadyRolled ||");
    expect(source).toContain("inspectorDamageCommitted ||");
    expect(source).toContain("Select a participant step to inspect combat details.");
    expect(source).toContain("Previous participant");
    expect(source).toContain("Next participant");
    expect(source).toContain("Previous step");
    expect(source).toContain("Next step");
  });

  it("returns from inspection to the current task without mutating combat state", () => {
    const source = readSource();

    expect(source).toContain("const currentTaskSelection = getCurrentCombatRoundTaskSelection");
    expect(source).toContain("function selectCurrentTask()");
    expect(source).toContain("manualSelectionRef.current = undefined");
    expect(source).toContain("pendingSelectionRef.current = undefined");
    expect(source).toContain("applyCombatRoundSelectionTarget({");
    expect(source).toContain("disabled={saving || !currentTaskSelection}");
    expect(source).toContain("onClick={selectCurrentTask}");
    expect(source).not.toContain("selectCurrentTaskOnServer");
  });

  it("persists combat round updates through narrow encounter commands", () => {
    const source = readSource();

    expect(source).toContain("updateEncounterOnServer");
    expect(source).toContain("buildCombatRoundStepSnapshots");
    expect(source).toContain("const stateForCommit = resolutionPhase");
    expect(source).toContain("advanceCombatRoundStep(stateForCommit, advanceInput)");
    expect(source).toContain("const commandParticipantId =");
    expect(source).toContain("attackResult");
    expect(source).toContain("combatRoundState: nextRoundState");
    expect(source).toContain("currentRound: nextRoundState.roundNumber");
    expect(source).toContain("submitCombatDeclarationOnServer");
    expect(source).toContain("clearCurrentCombatRoundStepOnServer");
    expect(source).toContain("updateScenarioParticipantStateOnServer");
    expect(source).toContain("const clearedSelection: CombatRoundSelectionTarget =");
    expect(source).toContain("participantId: inspector.participant?.participantId");
    expect(source).toContain("step: inspector.step");
    expect(source).toContain("participantId: clearedSelection.participantId");
    expect(source).toContain("step: clearedSelection.step");
    expect(source).not.toContain("actionLog:");
  });

  it("uses the server-returned selection after command-stack Clear", () => {
    const source = readSource();

    expect(source).toContain("const clearedSelection: CombatRoundSelectionTarget =");
    expect(source).toContain("const nextSelection: CombatRoundSelectionTarget =");
    expect(source).toContain(
      "participantId: nextRoundState.selectedParticipantId ?? clearedSelection.participantId",
    );
    expect(source).toContain("step: nextRoundState.selectedStep ?? clearedSelection.step");
    expect(source).toContain("pendingSelectionRef.current = nextSelection");
    expect(source).toContain("manualSelectionRef.current = nextSelection");
  });

  it("keeps Clear current step visible by avoiding explicit scroll after clear", () => {
    const source = readSource();

    expect(source).toContain("function focusRoundTable(input: { scrollIntoView?: boolean } = {})");
    expect(source).toContain("input.scrollIntoView !== false");
    expect(source).toContain("focusRoundTable({ scrollIntoView: false })");
    expect(source).toContain("Clear current step");
  });

  it("uses the selected cell as the authoritative inspector mode", () => {
    const source = readSource();

    expect(source).toContain(
      'inspector.step === "initiative_phase_1" || inspector.step === "initiative_phase_2"',
    );
    expect(source).toContain(
      "const inspectorCurrentResolutionPhase = inspectorAttackPhase ?? inspectorResolutionPhase",
    );
    expect(source).toContain(
      "roundState.phaseResolutionCursor?.phase === inspectorCurrentResolutionPhase",
    );
    expect(source).toContain("inspector.participant?.stepStatuses[inspector.step]");
    expect(source).toContain("step: inspector.step");
    expect(source).toContain("getAdvanceButtonLabel(inspector.step)");
    expect(source).toContain("statusText={`Current step: ${getPlayerCombatStepLabel(");
    expect(source).toContain("inspector.step,");
    expect(source).not.toContain("inspectorSnapshot ? inspector.step : roundState.currentStep");
    expect(source).not.toContain('roundState.currentStep === "review_action_modifiers" &&');
    expect(source).not.toContain('roundState.currentStep === "review_phase_2_modifiers" &&');
  });

  it("guards recorded attack results against accidental re-rolls", () => {
    const source = readSource();

    expect(source).toContain("const inspectorSelectedAttackAlreadyRolled = Boolean(");
    expect(source).toContain("const inspectorActionButtonLabel = inspectorSelectedAttackAlreadyRolled");
    expect(source).toContain('? "Attack already rolled"');
    expect(source).toContain(
      "const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({",
    );
    expect(source).toContain('Clear ${phase === "phase1" ? "A1" : "A2"} before rolling again.');
    expect(source).toContain("if (existingAttackResult) {");
    expect(source).toContain("return;");
  });
});
