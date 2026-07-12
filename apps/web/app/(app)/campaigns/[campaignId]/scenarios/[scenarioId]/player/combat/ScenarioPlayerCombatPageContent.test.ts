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
    expect(source).toContain("perspectiveParticipantId: selectedParticipantId");
    expect(source).toContain("setHistoryInspection(undefined)");
    expect(source).toContain("resolveProjectedCombatHistoryPanelSnapshot");
    expect(source).toContain("playerCombatTopPanelRowStyle");
    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("buildPlayerCombatPhasePanelModel");
    expect(source).toContain("buildPlayerCombatLoadoutSummary");
    expect(source).toContain("buildPlayerCombatDefenseStats");
    expect(source).toContain("getPlayerCombatActionButtonLabel");
    expect(source).toContain("buildEncounterLiveCombatModifierSummary");
    expect(source).toContain("projectCombatActionGeneratedModifiers");
    expect(source).toContain("projectedCombatContextDraft");
    expect(source).toContain("combatContext: projectedCombatContextDraft");
    expect(source).toContain("movementIntent: selectedMovementIntent");
    expect(source).toContain("resolvedEquipmentState: controlledEquipmentState ?? undefined");
    expect(source).toContain(
      "Reactive attack: no phase 1 attack received, so no phase 2 attack opens.",
    );
    expect(source).toContain("Target switch is GM-adjudicated.");
    expect(source).toContain("getPlayerCombatModifierDisplayPhase");
    expect(source).toContain("const currentModifierPhase = getPlayerCombatModifierDisplayPhase({");
    expect(source).toContain("phaseKey: currentModifierPhase");
    expect(source).toContain("validateCombatDeclarationTargets");
    expect(source).toContain("targetValidation");
    expect(source).toContain("declarationTargetValidationMessage");
    expect(source).toContain(
      "combatExperienceValidationMessage ??\n                  declarationTargetValidationMessage ??\n                  currentAttackSourceValidationMessage",
    );
    expect(source).not.toContain(
      "declarationTargetValidationMessage ?? currentAttackSourceValidationMessage",
    );
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
    expect(source).toContain("selectedParticipantStoredDeclarationThisRound");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("Current step: ${currentCombatStepLabel}");
    expect(source).not.toContain("Current step: ${currentCombatStepAbbreviation}");
    expect(source).toContain("Declared.");
    expect(source).toContain("selectedParticipantHasDeclared");
    expect(source).not.toContain("gmStatusSuffix");
    expect(source).toContain(". Initiative rolled.");
    expect(source).toContain(". Reviewed.");
    expect(source).not.toContain("Modifiers declared");
    expect(source).not.toContain("Phase 2 modifiers declared");
    expect(source).not.toContain("GM can save or revise this participant declaration.");
    expect(source).toContain("Declaration closed.");
    expect(source).toContain("rollCombatAttackOnServer");
    expect(source).toContain("const { encounter, participant } = await rollCombatAttackOnServer");
    expect(source).toContain("entry.id === participant.id ? participant : entry");
    expect(source).toContain("weaponCriticalCode: phaseAttackStats.weaponCriticalCode");
    expect(source).toContain("weaponDamageClass: phaseAttackStats.weaponDamageClass");
    expect(source).toContain("rollCombatParryOnServer");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("rollInitiative");
    expect(source).toContain("rollPhaseAttack");
    expect(source).toContain("rollCurrentParry");
    expect(source).toContain("currentInitiativePhase");
    expect(source).toContain("Initiative rolled.");
    expect(source).toContain("Initiative rolled — waiting for others");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).toContain("buildEncounterInitiativeModifierCalculation");
    expect(source).toContain("initiativeCalculation");
    expect(source).toContain(
      "initiativeModifierAdjustment: initiativeCalculation.modifierAdjustment",
    );
    expect(source).toContain("formatPlayerCombatInitiativeRank");
    expect(source).toContain("getCombatRoundInitiativeRanks");
    expect(source).toContain("isCombatRoundPhaseInitiativeComplete");
    expect(source).toContain("rank.tiedCount > 1");
    expect(source).toContain("tied with ${rank.tiedCount}");
    expect(source).toContain("selectedCurrentInitiative");
    expect(source).toContain("selectedRelevantInitiativeResultPanel");
    expect(source).toContain("selectedRelevantInitiativeRankLabel");
    expect(source).toContain("latestRolledInitiativePhase");
    expect(source).toContain(
      "currentModifierPhase ?? currentInitiativePhase ?? latestRolledInitiativePhase",
    );
    expect(source).toContain("getCombatRoundOutgoingAttackResultForParticipantPhase");
    expect(source).toContain("getCombatRoundDisplayIncomingAttackResultForParticipantPhase");
    expect(source).not.toContain("buildPlayerCombatDistanceModifierSection");
    expect(source).not.toContain("formatCombatDistanceModifierDetailLine");
    expect(source).not.toContain("distanceModifierDetail");
    expect(source).toContain("phaseWeaponNames: {");
    expect(source).toContain("phase1: phaseCombatLoadoutSummaries.phase1.attackStats?.weaponName");
    expect(source).toContain("phase2: phaseCombatLoadoutSummaries.phase2.attackStats?.weaponName");
    expect(source).toContain('title: "To hit"');
    expect(source).not.toContain('title: "Distance"');
    expect(source).toContain("getCombatRoundPhaseResolutionResultForAttack");
    expect(source).toContain("getCombatRoundResolutionPhaseForStep");
    expect(source).toContain("selectedCurrentAttackResult");
    expect(source).toContain("selectedCurrentAttackResultPanel");
    expect(source).toContain("getLatestRelevantPlayerCombatAttackResult");
    expect(source).toContain("selectedLatestRelevantAttackResult");
    expect(source).toContain("selectedLatestRelevantAttackResultPanel");
    expect(source).toContain("selectedCurrentPhaseResolutionResultPanel");
    expect(source).toContain("currentParryAction");
    expect(source).toContain("Roll parry");
    expect(source).toContain("selectedAttackerPrivilegedResolution");
    expect(source).toContain("selectedAttackerPrivilegedAttackResult");
    expect(source).toContain("getCombatRoundDamageSubstate");
    expect(source).toContain("getCombatRoundAttackResultById");
    expect(source).toContain("rollCombatHitLocationOnServer");
    expect(source).toContain("rollCombatCriticalOnServer");
    expect(source).toContain("Roll hit location as attacker");
    expect(source).toContain("Roll critical as attacker");
    expect(source).toContain("selectedAttackerCriticalContext");
    expect(source).toContain("selectedAttackerCriticalStatusContext");
    expect(source).toContain("Critical context: ${attackerPrivilegedAction.statusContext}.");
    expect(source).toContain("Attacker hit location rolled");
    expect(source).toContain("Attacker critical rolled");
    expect(source).toContain(
      "The attacker rolls; the defender receives the damage/effects review.",
    );
    expect(source).toContain(
      "Attacker roll recorded; defender damage/effects review waits for GM.",
    );
    expect(source).toContain("formatCombatPhaseResolutionResultLines");
    expect(source).toContain("formatCombatParryCalculationLine");
    expect(source).toContain("Parry: P ${resolution.combinedParryScore}");
    expect(source).toContain("Result: ${parry.resultLabel}");
    expect(source).toContain("Parry: ${formatResolutionStatusLabel");
    expect(source).toContain("Damage roll: ${formatResolutionStatusLabel");
    expect(source).toContain("Proposal: ${formatResolutionStatusLabel");
    expect(source).toContain("Defense: DB ${input.result.defenderDb}");
    expect(source).toContain("Main: ${input.result.weaponName} OB");
    expect(source).toContain("resultLine: `Result: ${selectedCurrentAttackResult.tableResult}`");
    expect(source).toContain(
      "selectPlayerCombatActionResultPanel<PlayerCombatActionResultPanelView>",
    );
    expect(source).toContain("healthCheck: selectedHealthCheckResultPanel");
    expect(source).toContain("attackerPrivileged: selectedAttackerPrivilegedResultPanel");
    expect(source).toContain("currentPhaseResolution: selectedCurrentPhaseResolutionResultPanel");
    expect(source).toContain("currentAttack: selectedCurrentAttackResultPanel");
    expect(source).toContain("involvedDamage: selectedInvolvedDamageResultPanel");
    expect(source).toContain("latestAttack: selectedLatestRelevantAttackResultPanel");
    expect(source).toContain("relevantInitiative: selectedRelevantInitiativeResultPanel");
    expect(source).toContain("declarationButtonLabel");
    expect(source).toContain("playerActionButtonLabel");
    expect(source).toContain("selectedParticipantStoredDeclarationThisRound");
    expect(source).toContain("selectedStoredDeclarationTargetValidation");
    expect(source).toContain("selectedStoredDeclarationComplete");
    expect(source).toContain("declarationIncomplete");
    expect(source).toContain("declarationStepHardLocked");
    expect(source).toContain("declarationSubmittedAndComplete");
    expect(source).toContain("Incomplete declaration.");
    expect(source).toContain("!playerDeclarationLocked || declarationIncomplete");
    expect(source).toContain("currentAttackAction?.label");
    expect(source).toContain("buttonLabel={playerActionButtonLabel}");
    expect(source).toContain("rollAttackerPrivilegedCombatDie(attackerPrivilegedAction.kind)");
    expect(source).toContain("currentAttackAction");
    expect(source).toContain("rollPhaseAttack()");
    expect(source).toContain("getPlayerCombatCurrentRollAction");
    expect(source).toContain("currentRollAction");
    expect(source).toContain("currentAttackPhaseContext");
    expect(source).toContain("currentAttackTargetParticipantId");
    expect(source).toContain("selectedRoundDeclaration?.phaseContexts?.[currentAttackPhase]");
    expect(source).toContain("Boolean(currentAttackTargetParticipantId)");
    expect(source).toContain("currentAttackSourceValidationMessage");
    expect(source).toContain(
      'No ${currentAttackPhase === "phase1" ? "phase 1" : "phase 2"} attack source available.',
    );
    expect(source).toContain("phaseKey,");
    expect(source).toContain("Roll phase 1 attack");
    expect(source).toContain("Roll phase 2 attack");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("loadCombatHistory(encounterId)");
    expect(source).toContain("buildProjectedCombatTrackerModel");
    expect(source).toContain("<CombatTracker");
    expect(source).toContain("setHistoryInspection({");
    expect(source).toContain("setHistoryInspection(undefined)");
    expect(source).toContain("PlayerCombatHistoryInspector");
    expect(source).toContain("historyInspection ? (");
    expect(source).not.toContain("commitCurrentCombatPhaseDamageOnServer");
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
    expect(source).toContain("declarationStepOpen");
    expect(source).toContain("setCombatDeclarationDraftDirty(false)");
    expect(source).not.toContain("onAddEntry={");
    expect(source).toContain("isGameMaster");
    expect(source).not.toContain("(bucketKey, entry) =>");
    expect(source).not.toContain("entry ?? createModifierEntryDraft()");
    expect(source).toContain("readOnly");
    expect(source).not.toContain("readOnly={!isGameMaster}");
    expect(source).toContain("roundNumber={combatRoundState?.roundNumber}");
    expect(source).toContain("mainHandParryItemLabel");
    expect(source).toContain("offHandParryItemLabel");
    expect(source).toContain("phaseModel.showAttackStats");
    expect(source).toContain("phaseModel.showAttackLocationSelector");
    expect(source).toContain("targetOptions={targetOptions}");
    expect(source).toContain("getDistanceEdgeBetweenParticipantAliases");
    expect(source).toContain("participant.characterId === phaseCombatContext.targetParticipantId");
    expect(source).toContain("distanceLabel={");
    expect(source).toContain('Distance: ${distanceEdge?.distance ?? "—"}');
    expect(source).toContain(
      'const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2"',
    );
    expect(source).not.toContain("Distance matrix");
    expect(source).toContain("getPlayerEncounterOpponentParticipants");
    expect(source).toContain("allowedParticipantIds: encounterScenarioParticipantIds");
    expect(source).toContain("getEncounterScenarioParticipantIds");
    expect(source).toContain("playerPerspectiveVisibleParticipants");
    expect(source).toContain("projectionVisibleParticipants: playerPerspectiveVisibleParticipants");
    expect(source).toContain("selectedParticipantId: selectedParticipant?.id");
    expect(source).toContain("hasScenarioParticipantCombatDeclarationForEncounterRound");
    expect(source).toContain(
      "selectedParticipant.state.combat.lastDeclaredEncounterId === encounterId",
    );
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

  it("shows player-owned damage-chain facts only to involved attackers and defenders", () => {
    const source = readSource();

    expect(source).toContain("getCombatRoundEffectiveDamageResult");
    expect(source).toContain("getCombatRoundEffectiveCriticalRoll");
    expect(source).toContain("getCombatRoundArmorCriticalModifierForDamageResult");
    expect(source).toContain("lookupCombatCriticalModifier");
    expect(source).toContain("formatPlayerCombatLocationCalculationLine");
    expect(source).toContain("formatPlayerCombatCriticalContextLine");
    expect(source).toContain("formatPlayerCombatCriticalCalculationLine");
    expect(source).toContain("formatPlayerCombatRecordedDamageLine");
    expect(source).toContain("formatPlayerCombatRecordedEffectsLine");
    expect(source).toContain('title: "Hit location"');
    expect(source).toContain('title: "Critical"');
    expect(source).toContain("title:");
    expect(source).toContain('"Recorded damage"');
    expect(source).toContain("getHitLocationFullLabel(locationRoll.selectedHitLocation)");
    expect(source).toContain("Critical roll required: ${contextLine}");
    expect(source).toContain("MC ${input.attackResult.weaponCriticalCode}");
    expect(source).toContain("type mod ${formatSignedPlayerCombatNumber");
    expect(source).toContain("armor crit ${formatSignedPlayerCombatNumber");
    expect(source).toContain('`2d8 ${criticalRoll.criticalDice.join(" + ")}');
    expect(source).toContain("} - armor crit mod ${");
    expect(source).toContain("proposal?.title");
    expect(source).toContain(
      "Recorded damage: ${effectiveDamage.effectiveTotalDamage}${formatPlayerCombatDamageLocationSuffix",
    );
    expect(source).toContain("Recorded effects: ${labels.join");
    expect(source).toContain("isPlayerInvolvedInPhaseResolution");
    expect(source).toContain("isPlayerVisibleDamageResolution");
    expect(source).toContain("input.resolution.attackerParticipantId === input.participantId");
    expect(source).toContain("input.resolution.defenderParticipantId === input.participantId");
    expect(source).toContain("getLatestPlayerVisibleDamageResolution");
    expect(source).toContain("selectedInvolvedDamageResolution");
    expect(source).toContain("selectedInvolvedDamageResultPanel");
    expect(source).toContain("sections: selectedAttackerPrivilegedResolutionLines.sections");
    expect(source).toContain("sections: selectedInvolvedDamageResolutionLines.sections");
    expect(source).not.toContain("selectedUninvolvedDamageResultPanel");
  });

  it("selects current phase-resolution facts for the selected participant before stale fallbacks", () => {
    const source = readSource();

    expect(source).toContain("selectedCurrentIncomingResolutionAttackResult");
    expect(source).toContain("selectedCurrentOutgoingResolutionAttackResult");
    expect(source).toContain(
      "selectedCurrentIncomingResolutionAttackResult ?? selectedCurrentOutgoingResolutionAttackResult",
    );
    expect(source).toContain("getLatestRelevantPlayerCombatAttackResult");
    expect(source).toContain("selectedLatestRelevantAttackResultPanel");
    expect(source).toContain("currentPhaseResolution: selectedCurrentPhaseResolutionResultPanel");
    expect(source).toContain("involvedDamage: selectedInvolvedDamageResultPanel");
    expect(source).toContain("latestAttack: selectedLatestRelevantAttackResultPanel");
  });

  it("lets players roll or confirm their own Combat Experience before declaring", () => {
    const source = readSource();

    expect(source).toContain("getCombatRoundRequiredCombatExperienceTrigger");
    expect(source).toContain("getCombatRoundPhaseCombatExperienceRequirement");
    expect(source).toContain("rollCombatExperienceOnServer");
    expect(source).toContain("backOutPhaseAttackOnServer");
    expect(source).toContain("backOutPhaseAttack()");
    expect(source).toContain("getCombatRoundCombatExperienceDifficulty");
    expect(source).toContain("isCombatRoundCombatExperienceWindowOpen");
    expect(source).toContain("getParticipantCombatExperienceSkillTotalLookup");
    expect(source).toContain("buildCharacterSheetSummary");
    expect(source).toContain("formatCombatExperienceStatus");
    expect(source).toContain("formatCombatExperienceResultLine");
    expect(source).not.toContain("formatCombatExperienceEffectiveTableLine");
    expect(source).not.toContain("Effective CE table result");
    expect(source).toContain("Active, no roll required");
    expect(source).toContain("Attack continues, no roll required");
    expect(source).toContain("No attack made");
    expect(source).toContain("Result: OB");
    expect(source).toContain("Result: Active, no modifier");
    expect(source).toContain("Result: attack cancelled");
    expect(source).toContain("selectedCombatExperienceRequired");
    expect(source).toContain("selectedCombatExperienceTrigger");
    expect(source).toContain("visibility: encounterSession?.roleplayState?.visibility");
    expect(source).toContain("selectedCombatExperienceResult");
    expect(source).toContain("selectedCombatExperienceWindowOpen");
    expect(source).toContain("const selectedCombatExperienceSkillLookup = useMemo(");
    expect(source).toContain("sheetSummary: selectedSheetSummary");
    expect(source).toContain("selectedCombatExperienceSkillTotal");
    expect(source).toContain(
      "const selectedCombatExperienceSkillTotal = selectedCombatExperienceSkillLookup.skillTotal",
    );
    expect(source).toContain("selectedCombatExperienceDifficulty");
    expect(source).toContain("selectedCombatExperienceNoRollAvailable");
    expect(source).toContain("selectedPhaseCombatExperienceRequirement");
    expect(source).toContain("selectedPhaseAttackBackOutOpportunity");
    expect(source).toContain("getCombatRoundPhaseAttackBackOutOpportunity");
    expect(source).toContain("canBackOutCombatRoundPhaseAttack");
    expect(source).toContain("selectedCombatExperienceResultPanel");
    expect(source).toContain("selectedCombatExperienceActionAvailable");
    expect(source).toContain("selectedPhaseCombatExperienceBackOutAvailable");
    expect(source).toContain("selectedPhaseAttackBackOutOpportunity &&");
    expect(source).toContain("PhaseAttackChoiceSelection");
    expect(source).toContain('useState<PhaseAttackChoiceSelection>("continue")');
    expect(source).toContain('setPhaseAttackChoiceSelection("continue")');
    expect(source).toContain("selectedPhaseAttackChoiceSelectorAvailable");
    expect(source).toContain("selectedPhaseAttackChoiceIsBackOut");
    expect(source).toContain("selectedPhaseAttackChoiceControls");
    expect(source).toContain("showInitiativeContextPanel");
    expect(source).toContain("showPhaseCombatExperienceContextPanel");
    expect(source).toContain("showModifierReviewContextPanel");
    expect(source).toContain("showCombatStartExperienceContextPanel");
    expect(source).toContain("Base initiative {initiativeCalculation.baseInitiative}");
    expect(source).toContain("Pending rolls: {currentInitiativeRollCounts.pending} of");
    expect(source).toContain("Effective before roll {initiativeCalculation.modifiedInitiative}");
    expect(source).toContain("Phase Combat Experience");
    expect(source).toContain("Effective CE {selectedCombatExperienceSkillTotal}");
    expect(source).toContain("CE roll required — attacked while attacking.");
    expect(source).toContain("No CE roll required — back-out available.");
    expect(source).toContain("Phase choice submitted. Waiting for GM commit.");
    expect(source).toContain("Review generated and manual modifiers before advancing.");
    expect(source).not.toContain("CE roll required:");
    expect(source).not.toContain("Selected choice:");
    expect(source).not.toContain("Initiative: {threat.participantInitiative}");
    expect(source).toContain('"Continue and roll CE"');
    expect(source).toContain('"Back out of attack (-2 DB/Parry penalty)"');
    expect(source).toContain('"Back out of attack (no CE roll)"');
    expect(source).toContain('<option value="continue">');
    expect(source).toContain("preActionControls={selectedPhaseAttackChoiceControls}");
    expect(source).toContain("? backOutPhaseAttack()");
    expect(source).toContain("phaseInitiativeChoice: selectedPhaseInitiativeChoiceResultPanel");
    expect(source).toContain("buildPhaseInitiativeChoiceResultPanel");
    expect(source).not.toContain("secondaryButtonLabel=");
    expect(source).not.toContain("secondaryButtonDisabled=");
    expect(source).not.toContain("onSecondaryAction=");
    expect(source).toContain('"Roll Combat Experience"');
    expect(source).toContain('"Confirm Combat Experience"');
    expect(source).toContain('"Roll health check"');
    expect(source).toContain("rollRoundEndHealthCheckOnServer");
    expect(source).toContain("getCombatRoundEndHealthCheckPendingRolls");
    expect(source).toContain("selectedPendingHealthRoll");
    expect(source).toContain("selectedHealthCheckActionAvailable");
    expect(source).toContain("rollHealthCheck()");
    expect(source).toContain("Round-end health check");
    expect(source).toContain("Health check required");
    expect(source).toContain("Health check rolled. Waiting for GM review.");
    expect(source).toContain("Roll your Health check for round-end bleed review.");
    expect(source).toContain("formatRoundEndHealthCheckResultLine");
    expect(source).toContain('"Roll distance control"');
    expect(source).toContain("rollRoundEndDistanceControlOnServer");
    expect(source).toContain("selectedDistanceControlActionAvailable");
    expect(source).toContain("Roll your Dodge for distance control.");
    expect(source).toContain("formatDistanceControlOpponentStatus");
    expect(source).toContain("selectedDistanceControlCommittedDistance");
    expect(source).toContain("selectedDistanceControlResultPanel");
    expect(source).toContain("Waiting for opponent distance-control roll.");
    expect(source).toContain("Waiting for other distance-control roll(s).");
    expect(source).toContain("Waiting for GM to commit distance control.");
    expect(source).toContain("Distance control committed: distance");
    expect(source).not.toContain("opponentSide.desiredDistance");
    expect(source).not.toContain("opponentSide.result");
    expect(source).toContain('"Back out of attack"');
    expect(source).toContain('"Waiting for GM"');
    expect(source).toContain("Waiting for GM to start CE.");
    expect(source.match(/Waiting for GM to start Combat Experience rolls\./g) ?? []).toHaveLength(
      0,
    );
    expect(source).toContain("combatExperienceStatusText");
    expect(source).toContain("combatExperienceValidationMessage");
    expect(source).toContain("rollCombatExperience()");
    expect(source).toContain(
      "Back out submitted; GM commit will cancel the attack and soften the phase DB/Parry penalty.",
    );
    expect(source).toContain("continuePhaseAttackOnServer");
    expect(source).toContain('"Continue attack"');
    expect(source).toContain("Skill total {selectedCombatExperienceSkillTotal}");
    expect(source).toContain("Difficulty {selectedCombatExperienceDifficulty}");
    expect(source).toContain("Incoming attacker(s):");
    expect(source).toContain("selectedPhaseCombatExperienceThreats");
    expect(source).toContain("selectedCombatExperienceSkillLookup.warning");
    expect(source).toContain("selectedCombatExperienceRequired");
    expect(source).toContain(
      "controlsDisabled || playerDeclarationLocked || selectedCombatExperienceRequired",
    );
    expect(source).toContain("const playerActionButtonDisabled =");
    expect(source).toContain("Combat Experience");
    expect(source).not.toContain("Phase initiative choices");
    expect(source).not.toContain("Waiting for GM to roll Combat Experience.");
  });
});
