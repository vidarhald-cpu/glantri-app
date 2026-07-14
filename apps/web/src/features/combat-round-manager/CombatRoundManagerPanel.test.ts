import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CombatRoundManagerPanel.tsx");
const combatHistoryPath = join(dirname(fileURLToPath(import.meta.url)), "../combat-history");

function readSource(): string {
  return [
    sourcePath,
    join(combatHistoryPath, "components/CombatTracker.tsx"),
    join(combatHistoryPath, "view-models/buildCombatTrackerModel.ts"),
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

function readPanelSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CombatRoundManagerPanel", () => {
  it("renders the GM round manager orchestration controls", () => {
    const source = readSource();

    expect(source).toContain("Combat Round Manager");
    expect(source).toContain("buildCombatAttackSourceRef");
    expect(source).toContain("formatScenarioCombatEquipmentDiagnostic");
    expect(source).not.toContain("refreshScenarioParticipantEquipmentOnServer");
    expect(source).not.toContain("Refresh participant equipment");
    expect(source).not.toContain("itemId: inspectorPhaseLoadoutSummaries");
    expect(source).not.toContain("Round {roundState.roundNumber} · Current step:");
    expect(source).not.toContain("Rows are participants. Columns are round timeline cells.");
    expect(source).toContain("Commit");
    expect(source).toContain("and advance to");
    expect(source).toContain('"Start next round"');
    expect(source).toContain("Current task");
    expect(source).toContain("Return to the current unresolved combat step");
    expect(source).toContain("Clear current step");
    expect(source).toContain("canClearCombatRoundStep");
    expect(source).toContain("clearCurrentStepAvailable");
    expect(source).toContain("disabled={saving || !clearCurrentStepAvailable}");
    expect(source).toContain("clearCurrentCombatRoundStepOnServer");
    expect(source).toContain("Step controller");
    expect(source).not.toContain("Round-level controls");
    expect(source).not.toContain("Timeline controls; not part of the current attack/parry step.");
    expect(source).toContain("Latest combat event");
    expect(source).toContain("getLatestCombatEventSummary");
    expect(source).toContain("latestCombatEventSummary.summaryText");
  });

  it("delegates tracker presentation while retaining GM inspection orchestration", () => {
    const source = readSource();

    expect(source).toContain("buildCombatTrackerModel({");
    expect(source).toContain(
      "const trackerAttackResult = trackerCanonicalAttackResult ?? trackerSnapshot?.attackResult",
    );
    expect(source).toContain("<CombatTracker");
    expect(source).toContain("model={trackerModel}");
    expect(source).toContain("selectInspector(cell.participantId, cell.step, cell.roundNumber)");
    expect(source).toContain("onKeyDown={handleTimelineKeyDown}");
    expect(source).toContain("timelineCellRefs.current[cellKey] = node");
    expect(source).toContain("activeCurrentCellRef.current = node");
    expect(source).toContain("getCombatRoundTimelineRoundStates");
    expect(source).toContain("getCombatRoundStepSnapshot");
    expect(source).toContain("const trackerPhaseResolutionResult = trackerSnapshot");
    expect(source).not.toContain("commitCurrentStep(participant.participantId");
  });

  it("keeps the extracted tracker model and component presentation-only", () => {
    const source = readSource();

    expect(source).toContain("CombatTrackerModel");
    expect(source).toContain("input.model.legend");
    expect(source).toContain("input.model.rows");
    expect(source).toContain("input.model.rounds");
    expect(source).toContain("input.model.cells[cellKey]");
    expect(source).toContain("COMBAT_TRACKER_MARKER_MEANINGS");
    expect(source).toContain('marker: "H"');
    expect(source).toContain('marker: "M"');
    expect(source).toContain('marker: "✓"');
    expect(source).toContain('marker: "–"');
    expect(source).toContain('marker: "?"');
    expect(source).toContain('marker: "·"');
    expect(source).toContain("const markerKind = getCombatTrackerCellMarkerKind(facts)");
    expect(source).toContain("hoverText:");
    expect(source).toContain("onClick={() => input.onInspect(cell)}");
  });

  it("surfaces phase Combat Experience requirements in the grid and inspector", () => {
    const source = readSource();

    expect(source).toContain("getCombatRoundPhaseCombatExperienceRequirement");
    expect(source).toContain("phaseCombatExperienceMarkerRequired");
    expect(source).toContain("phase CE required.");
    expect(source).toContain('marker: "?"');
    expect(source).toContain('return "required"');
    expect(source).toContain("inspectorPhaseCombatExperienceRequirement");
    expect(source).toContain("Phase Combat Experience");
    expect(source).toContain("CE roll required — attacked while attacking.");
    expect(source).toContain("No CE roll required — back-out available.");
    expect(source).toContain("Phase choice submitted. Waiting for GM commit.");
    expect(source).not.toContain("CE roll required:");
    expect(source).not.toContain("Reason: attacked while attacking");
    expect(source).toContain("Incoming attacker(s):");
    expect(source).not.toContain("Initiative: {threat.participantInitiative}");
    expect(source).toContain("showInspectorPhaseCombatExperienceContextPanel");
    expect(source).toContain("inspectorPhaseCombatExperienceThreats");
    expect(source).not.toContain("Phase initiative choices");
  });

  it("renders compact GM distance matrix controls below the inspector", () => {
    const source = readPanelSource();

    expect(source).toContain("Distance matrix");
    expect(source).toContain("Round-level distance matrix");
    expect(source).toContain(
      "Pair distances shared by the round; not part of the current action command.",
    );
    expect(source).not.toContain("Participant A");
    expect(source).not.toContain("Participant B");
    expect(source.indexOf('aria-label="Distance matrix"')).toBeGreaterThan(
      source.indexOf('aria-label="Combat round inspector"'),
    );
    expect(source.indexOf('aria-label="Distance matrix"')).toBeGreaterThan(
      source.indexOf('aria-label="Combat round timeline grid"'),
    );
    expect(source).toContain("buildCombatDistanceTableRows");
    expect(source).toContain("getCombatDistanceTableRowForParticipants");
    expect(source).toContain("ensureDistanceEdgesForParticipantPairs");
    expect(source).toContain("state: input.roundState.distanceState");
    expect(source).toContain("getCombatDistanceParticipantAliases");
    expect(source).toContain("resolvedEquipmentStateByScenarioParticipantId");
    expect(source).toContain("setPairDistanceOnServer");
    expect(source).toContain("Combat distance must be an integer from 0 to 8.");
    expect(source).toContain("dirtyCombatDistanceRows");
    expect(source).toContain("unsaved distance");
    expect(source).toContain("Save distance changes");
    expect(source).toContain("Reset changes");
    expect(source).toContain("saveCombatDistanceChanges()");
    expect(source).toContain("setPairDistanceOnServer({");
    expect(source).toContain("rowParticipant.participantId === columnParticipant.participantId");
    expect(source).toContain("rowIndex < columnIndex");
    expect(source).toContain("distanceDrafts[distanceRow.edge.pairKey]");
    expect(source).toContain("[distanceRow.edge.pairKey]: event.target.value");
    expect(source).toContain("formatCombatDistanceSource(distanceRow.edge.source)");
    expect(source).toContain("distanceRow.preferredDistanceLabel");
    expect(source).toContain('className="distanceMatrix"');
    expect(source).toContain('className="distanceMatrixHeaderCell"');
    expect(source).toContain('className="distanceMatrixHeaderLabel"');
    expect(source).toContain('className="distanceMatrixRowLabel"');
    expect(source).toContain('className="distanceMatrixCell distanceMatrixNumericCell"');
    expect(source).toContain("distanceMatrixCellSize");
    expect(source).toContain("distanceMatrixCellBorder");
    expect(source).toContain("distanceMatrixCellStyle");
    expect(source).toContain("distanceMatrixInputStyle");
    expect(source).toContain("distanceMatrixRowHeaderStyle");
    expect(source).toContain("distanceMatrixColumnHeaderStyle");
    expect(source).toContain("distanceMatrixColumnHeaderTextStyle");
    expect(source).toContain('height: "4.75rem"');
    expect(source).toContain('overflow: "visible"');
    expect(source).toContain('bottom: "0.1rem"');
    expect(source).toContain('width: "6.5rem"');
    expect(source).toContain('transform: "translateX(-0.15rem) rotate(-45deg)"');
    expect(source).toContain('textOverflow: "ellipsis"');
    expect(source).toContain('position: "absolute"');
    expect(source).toContain("title={participant.label}");
    expect(source).toContain("title={rowParticipant.label}");
    expect(source).toContain("distanceLabel={");
    expect(source).toContain('Distance: ${phaseDistanceRow?.edge.distance ?? "—"}');
    expect(source).toContain(
      'const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2"',
    );
    expect(source).toContain("PlayerCombatAttackTargetSelector");
    expect(source).not.toContain("Participant A");
    expect(source).not.toContain("Participant B");
    expect(source).not.toContain("Pairwise distance notes");
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
    expect(source).toContain(
      "currentContext: declaration\n      ? (declaration.combatContext ?? scopedCombat?.combatContext)",
    );
    expect(source).toContain(
      "currentContext: declaration\n        ? (declaration.combatContext ?? scopedCombat?.combatContext)",
    );
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
    expect(source).toContain("historicalPhasePanel?.distanceLabel");
    expect(source).toContain('`Distance: ${phaseDistanceRow?.edge.distance ?? "—"}`');
    expect(source).not.toContain("formatCombatDistanceModifierDetailLine");
    expect(source).not.toContain("buildCombatDistanceModifierSection");
    expect(source).not.toContain("distanceModifierDetail");
    expect(source).not.toContain('title: "Distance"');
    expect(source).toContain("playerCombatTopPanelRowStyle");
    expect(source).toContain("buildPlayerCombatPhasePanelModel");
    expect(source).toContain("buildPlayerCombatLoadoutSummary");
    expect(source).toContain("resolveScenarioCombatEquipmentState");
    expect(source).toContain(
      'inspector.step === "select_actions" && inspectorDraft.actionId === "double_attack"',
    );
    expect(source).toContain("buildPlayerCombatDefenseStats");
    expect(source).toContain("loadCanonicalContent");
    expect(source).toContain("buildEquipmentLoadoutModuleModel");
    expect(source).toContain("buildCombatRoundDamageArmorCoverageFromEquipmentState");
    expect(source).toContain("loadServerCharacterById");
    expect(source).toContain("loadCharacterEquipmentState");
    expect(source).toContain("resolvedCharacterStateByParticipantId");
    expect(source).toContain("hydrateInspectorCharacterState");
    expect(source).toContain("buildEncounterLiveCombatModifierSummary");
    expect(source).toContain("projectCombatActionGeneratedModifiers");
    expect(source).toContain("inspectorGeneratedCombatContext");
    expect(source).toContain("combatContext: inspectorGeneratedCombatContext");
    expect(source).toContain("resolvedEquipmentState: inspectorEquipmentState ?? undefined");
    expect(source).toContain("phaseWeaponNames: {");
    expect(source).toContain(
      "phase1: inspectorPhaseLoadoutSummaries.phase1.attackStats?.weaponName",
    );
    expect(source).toContain(
      "phase2: inspectorPhaseLoadoutSummaries.phase2.attackStats?.weaponName",
    );
    expect(source).toContain("participants ?? []");
    expect(source).toContain("getCombatRoundModifierPhaseForStep");
    expect(source).toContain("getPlayerCombatModifierDisplayPhase");
    expect(source).toContain(
      "const inspectorModifierPhase = getPlayerCombatModifierDisplayPhase({",
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
    expect(source).toContain("buttonLabel={inspectorEffectiveActionButtonLabel}");
    expect(source).not.toContain("GM can save or revise this declaration at any round step.");
    expect(source).toContain("inspectorStatusSuffix");
    expect(source).toContain('" Declared."');
    expect(source).toContain('" Reviewed."');
    expect(source).not.toContain("Modifiers declared");
    expect(source).not.toContain("Phase 2 modifiers declared");
    expect(source).toContain('" Initiative rolled."');
    expect(source).toContain("Historical step:");
    expect(source).toContain("inspectorHistoricalStepOutcome?.message ??");
    expect(source).toContain(": `Current step: ${getPlayerCombatStepLabel(");
    expect(source).toContain("rollInspectorInitiative");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("rollInspectorPhaseAttack");
    expect(source).toContain("rollCombatAttackOnServer");
    expect(source).toContain("rollInspectorParry");
    expect(source).toContain("rollCombatParryCommandOnServer");
    expect(source).not.toContain("rollOpenEndedD20");
    expect(source).not.toContain("resolveCombatParry");
    expect(source).not.toContain("recordCombatRoundParryResult");
    expect(source).toContain("recordCombatRoundDamageResult");
    expect(source).toContain("advanceCurrentCombatPhaseResolutionOnServer");
    expect(source).toContain("completeCurrentCombatPhaseResolutionOnServer");
    expect(source).not.toContain("recordCombatRoundNoAttackPhaseReview");
    expect(source).toContain("formatOpenEndedD20RollBreakdown");
    expect(source).toContain("formatCombatDefenseResultMainLine");
    expect(source).toContain("formatCombatParryCalculationLine");
    expect(source).toContain("formatCombatParryModifierBreakdown");
    expect(source).toContain("getCombatRoundOutgoingAttackResultForParticipantPhase");
    expect(source).toContain("getCombatRoundDisplayIncomingAttackResultForParticipantPhase");
    expect(source).toContain("getCombatRoundPhaseResolutionResultForAttack");
    expect(source).toContain("getCombatRoundPhaseResolutionStatus");
    expect(source).toContain("getCombatRoundResolutionPhaseForStep");
    expect(source).toContain("getCombatRoundEffectiveDamageResult");
    expect(source).toContain("getHitLocationFullLabel");
    expect(source).not.toContain("completeCombatRoundPhaseResolutionForParticipant");
    expect(source).not.toContain("advanceCombatRoundPhaseResolutionSubstepForParticipant");
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
    expect(source).toContain("dbParryRaw: getMergedCombatDbParryModifierTotal({");
    expect(source).not.toContain("modifierBreakdown: rawModifiers");
    expect(source).toContain('Roll hit location for ${inspectorDamageAttackerLabel ?? "attacker"}');
    expect(source).toContain('Roll critical for ${inspectorDamageAttackerLabel ?? "attacker"}');
    expect(source).not.toContain("Resolve damage");
    expect(source).toContain("Prepare damage review");
    expect(source).toContain("Commit phase damage");
    expect(source).toContain("Phase damage committed");
    expect(source).toContain("Damage/effects review");
    expect(source).toContain("The attacker rolls;");
    expect(source).toContain("receives the damage/effects");
    expect(source).toContain("Attacker: ${input.attackerLabel}.");
    expect(source).toContain("attackerLabel={inspectorDamageAttackerLabel}");
    expect(source).toContain("defenderLabel={inspectorDamageDefenderLabel}");
    expect(source).toContain("Outcome summary");
    expect(source).toContain("Proposed recorded effects");
    expect(source).toContain("Rows proposed for commit. Review accepted rows before saving.");
    expect(source).toContain("Character-sheet rows");
    expect(source).toContain("No character-sheet rows proposed.");
    expect(source).toContain("GM adjustments");
    expect(source).toContain(
      "Review overrides and accepted rows here; commit stays in Current action.",
    );
    expect(source).toContain("criticalEffectProposal");
    expect(source).toContain("Critical table proposal");
    expect(source).toContain("Critical table mapping unavailable");
    expect(source).not.toContain("Critical-derived rows:");
    expect(source).toContain("Critical effects unavailable:");
    expect(source).toContain("No critical effect.");
    expect(source).toContain('criticalIndexStatus === "no_effect"');
    expect(source).toContain("Critical effects not accepted/committed yet.");
    expect(source).toContain("getCombatRoundPhaseDamageCommitReadiness");
    expect(source).toContain("Ready to commit");
    expect(source).toContain("Cannot commit:");
    expect(source).toContain("inspectorDamageCommitValidationMessage");
    expect(source).toContain("await commitCurrentCombatPhaseDamageOnServer({");
    expect(source).toContain("App-side rolls:");
    expect(source).toContain("Operational consequences");
    expect(source).toContain("operationalConsequences");
    expect(source).toContain("title={consequence.reason}");
    expect(source).not.toContain("Consequence notes");
    expect(source).toContain("Critical minimum raises damage from");
    expect(source).toContain("Calculation details");
    expect(source).toContain("No additional calculation notes.");
    expect(source).toContain("Commit readiness");
    expect(source).toContain("Commit readiness appears after required damage rolls are resolved.");
    expect(source).toContain("Save review");
    expect(source).toContain("Skip current action");
    expect(source).toContain("skipCombatRoundCurrentActionOnServer");
    expect(source).not.toContain("skipCombatRoundCurrentPhaseAction");
    expect(source).toContain("inspectorCanSkipCurrentPhaseAction");
    expect(source).toContain("InspectorCurrentActionOutcomeSelection");
    expect(source).toContain('useState<InspectorCurrentActionOutcomeSelection>("normal")');
    expect(source).toContain("inspectorSkipActionOutcomeSelectorAvailable");
    expect(source).toContain("inspectorCurrentActionOutcomeControls");
    expect(source).toContain("inspectorSkipActionSelected");
    expect(source).toContain(">Action outcome</span>");
    expect(source).toContain('<option value="normal">{inspectorActionButtonLabel}</option>');
    expect(source).toContain('<option value="skip">Skip current action</option>');
    expect(source).toContain("buttonLabel={inspectorEffectiveActionButtonLabel}");
    expect(source).toContain("disabled={inspectorEffectiveActionButtonDisabled}");
    expect(source).toContain("? skipInspectorCurrentPhaseAction()");
    expect(source).not.toContain(
      "onSecondaryAction={() => void skipInspectorCurrentPhaseAction()}",
    );
    expect(source).not.toContain("secondaryButtonLabel={");
    expect(source).not.toContain("Edit character-sheet rows");
    expect(source).toContain("Add manual row");
    expect(source).toContain("getCombatDamageReviewDraftEffectRowType");
    expect(source).toContain("getCombatDamageReviewDraftEffectTarget");
    expect(source).toContain("Add modifier row");
    expect(source).toContain("Add note row");
    expect(source).toContain("Save review");
    expect(source).toContain("reviewCombatRoundDamageResult");
    expect(source).toContain("commitCurrentCombatPhaseDamageOnServer");
    expect(source).toContain("updateScenarioParticipantStateOnServer");
    expect(source).toContain("combatEffects: committed.combatEffects");
    expect(source).toContain(
      "selectedHitLocationOverride: effectiveDamage?.effectiveSelectedHitLocation",
    );
    expect(source).toContain(
      'criticalGradeOverride: effectiveDamage?.effectiveCriticalGrade ?? "none"',
    );
    expect(source).toContain(
      "armorModifierOverride: effectiveDamage?.effectiveArmorModifier.toString()",
    );
    expect(source).toContain(
      'attackDirectionOverride: effectiveDamage?.effectiveAttackDirection ?? "front"',
    );
    expect(source).toContain("Direction");
    expect(source).toContain(
      "armorCriticalModifierOverride: effectiveCritical.armorCriticalModifier?.toString()",
    );
    expect(source).toContain(
      "criticalTypeModifierOverride: effectiveCritical.criticalTypeModifier?.toString()",
    );
    expect(source).toContain(
      "finalCriticalRollOverride: effectiveCritical.finalCriticalRoll?.toString()",
    );
    expect(source).toContain("Critical roll / effect index");
    expect(source).toContain("} - armor crit mod ${");
    expect(source).toContain(
      "totalDamageOverride: effectiveDamage?.effectiveTotalDamage.toString()",
    );
    expect(source).toContain(
      "selectedHitLocationValue !== effectiveDamage.computedSelectedHitLocation",
    );
    expect(source).toContain("armorModifier !== effectiveDamage.computedArmorModifier");
    expect(source).toContain("reviewWithoutTotalDamageOverride");
    expect(source).toContain("totalDamage !== draftEffectiveDamage.effectiveTotalDamage");
    expect(source).not.toContain('<option value="">Computed</option>');
    expect(source).not.toContain("Computed: {computedLocation}");
    expect(source).not.toContain("Effective: {effectiveLocation}");
    expect(source).toContain("raw grazing die");
    expect(source).toContain("raw reference damage");
    expect(source).not.toContain("armor-adjusted reference damage");
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
    expect(source).toContain("Result: No critical effect");
    expect(source).toContain("Result: critical roll");
    expect(source).toContain("sections: inspectorPhaseResolutionLines.sections");
    expect(source).toContain("resultLine: `Result: ${formatCombatAttackTableResultLabel");
    expect(source).toContain("damage${formatCombatDamageResultLocationSuffix(damageResult)}");
    expect(source).toContain("targetLocation:");
    expect(source).toContain(
      "attackerRoundParticipant?.declaration?.phaseContexts?.[phase]?.targetLocation",
    );
    expect(source).toContain("damageProposal,");
    expect(source).toContain("Damage roll: ${formatResolutionStatusLabel");
    expect(source).toContain("Proposal: ${formatResolutionStatusLabel");
    expect(source).toContain("Effects: ${damageResult.review.additionalEffects");
    expect(source).toContain("rollCombatAttackOnServer({");
    expect(source).toContain("const { encounter: nextEncounter, participant }");
    expect(source).toContain("[participant.id]: participant");
    expect(source).toContain("onScenarioParticipantsUpdated?.([participant])");
    expect(source).toContain("defenderScenarioParticipantId: targetScenarioParticipant.id");
    expect(source).toContain("scenarioParticipantId: selectedScenarioParticipant.id");
    expect(source).toContain("weaponCriticalCode: phaseModel.attackStats.weaponCriticalCode");
    expect(source).toContain("weaponDamageClass: phaseModel.attackStats.weaponDamageClass");
    expect(source).toContain("obSkillRaw: getMergedCombatSkillObModifierTotal({");
    expect(source).toContain(
      "weaponArmorClass: normalizeCombatArmorModifierClass(attackStats.weaponArmorClass)",
    );
    expect(source).toContain("armorCoverage: inspectorParryDefenderPhaseSummary?.armorCoverage");
    expect(source).toContain("completeInspectorPhaseResolution");
    expect(source).toContain("getCombatRoundInitiativeRanks");
    expect(source).toContain("getCombatRoundInitiativeTotal");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).toContain("formatCombatAttackResultMainLine");
    expect(source).toContain("formatCombatAttackResultLine");
    expect(source).toContain("getLatestRelevantPlayerCombatAttackResult");
    expect(source).toContain("inspectorCanShowLatestRelevantAttackResult");
    expect(source).toContain("inspectorLatestRelevantAttackResult");
    expect(source).toContain(
      "!inspectorIsHistorical && inspectorCanShowLatestRelevantAttackResult",
    );
    expect(source).toContain("buildHistoricalCombatActionResult");
    expect(source).toContain('interpretedResult: "No recorded result for this step."');
    expect(source).toContain('snapshot.actionResultStatus === "skipped"');
    expect(source).toContain('snapshot.actionResultStatus === "no_attack"');
    expect(source).toContain("const inspectorActionResult = inspectorIsHistorical");
    expect(source).toContain(
      "const inspectorIsHistorical = !selectedRoundIsActive || !inspectorSelectionIsCurrentTask",
    );
    expect(source).toContain("readOnly={inspectorIsHistorical}");
    expect(source).toContain("? inspectorHistoricalActionResult");
    expect(source).toContain("buildCombatAttackResultPanel");
    expect(source).toContain("Result: ${input.result.tableResult}");
    expect(source).toContain("selectCombatEventsForTrackerCell");
    expect(source).toContain("projectGmCombatEvents");
    expect(source).toContain("inspectorCanonicalActionResultEvents");
    expect(source).toContain("inspectorHasCanonicalActionResult");
    expect(source).toContain(
      "<CombatEventResultList events={inspectorCanonicalActionResultEvents} />",
    );
    expect(source).not.toContain("Legacy result · canonical event history unavailable");
    expect(source).toContain("Some historical result details are unavailable.");
    expect(source).toContain("deriveCombatHistoryStepOutcome");
    expect(source).toContain(") : inspectorActionResult ? (");
    expect(source).toContain("<PlayerCombatActionResultPanel result={null} />");
    expect(source.indexOf("inspectorLatestRelevantAttackResult")).toBeLessThan(
      source.indexOf("No ${formatCombatPhaseLabel(inspectorResolutionPhase)} attack result."),
    );
    expect(source).toContain("inspectorDisplayPhaseResolutionResult");
    expect(source).toContain("inspectorPhaseResolutionCursor");
    expect(source).toContain("inspectorPhaseResolutionStatus");
    expect(source).toContain("inspectorIsCursorParticipant");
    expect(source).toContain("inspectorCanExecuteSelectedStep");
    expect(source).toContain("inspectorIsInspectionOnly");
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
    expect(source).toContain("Inspecting step - use Current task to resume");
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
    expect(source).toContain("movementIntent: inspectorDraft.movementIntent");
    expect(source).toContain("phaseContexts: inspectorDraft.phaseContexts");
    expect(source).toContain(
      'const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2"',
    );
    expect(source).toContain(
      "const historicalPhasePanel = inspectorPanelSnapshot?.phasePanels?.[phaseKey]",
    );
    expect(source).toContain(": inspectorDisplayDraft.phaseContexts[phaseKey]");
    expect(source).not.toContain("formatCombatInitiativeRoll(inspector");
    expect(source).not.toContain("Action status:");
    expect(source).not.toContain("Damage review:");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("phaseModel.showAttackStats");
    expect(source).toContain("phaseModel.showAttackLocationSelector");
    expect(source).toContain("inspectorAttackSourceValidationMessage");
    expect(source).toContain(
      "No ${formatCombatPhaseLabel(inspectorCurrentAttackPhase)} attack source available.",
    );
    expect(source).toContain("phaseKey: input.phaseKey");
    expect(source).toContain("inspectorTargetOptions");
    expect(source).toContain("getPlayerEncounterOpponentParticipants");
    expect(source).toContain("allowedParticipantIds: encounterScenarioParticipantIds");
    expect(source).toContain("getEncounterScenarioParticipantIds");
    expect(source).toContain("historicalPhasePanel?.targetOptions ?? inspectorTargetOptions");
    expect(source).toContain("phaseModel.showDefenseContext");
    expect(source).toContain("actionId: inspectorDisplayDraft.actionId");
    expect(source).toContain("secondaryActionId: inspectorDisplayDraft.secondaryActionId");
    expect(source).not.toContain("inspectorOpponentOptions");
    expect(source).not.toContain("moveSelectedParticipantDown");
    expect(source).toContain("const actedParticipantId = selectedEncounterParticipant.id");
    expect(source).toContain("fromParticipantId: actedParticipantId");
    expect(source).toContain("pendingSelectionRef");
    expect(source).toContain("manualSelectionRef");
    expect(source).toContain("getCombatRoundManagerInspectionSelection");
    expect(source).toContain("getCurrentCombatRoundTaskSelection");
    expect(source).toContain("getNextCombatRoundParticipantSelection");
    expect(source).toContain(
      "const shouldUsePersistedCursor = isGlobalCombatRoundParticipantStep(actedStep)",
    );
    expect(source).toContain("const nextSelection = shouldUsePersistedCursor");
    expect(source).toContain("? resolveCombatRoundInspectionSelection({");
    expect(source).toContain("pendingSelectionRef.current = undefined");
    expect(source).toContain("manualSelectionRef.current = undefined");
    expect(source).toContain("Use inspector for phase resolution");
    expect(source).toContain("isSequentialResolutionStep(inspector.step)");
    expect(source).toContain("roundEndStartNextRoundBlocker");
    expect(source).toContain("getCombatRoundStartNextRoundBlocker");
    expect(source).toContain("isCombatRoundEndReviewComplete");
    expect(source).not.toContain("Build/Review round-end effects");
    expect(source).toContain("Preparing round-end review");
    expect(source).toContain("Round-end review is preparing automatically.");
    expect(source).toContain("Commit participant SU review");
    expect(source).toContain("Mark SU review complete");
    expect(source).toContain("Roll health check");
    expect(source).toContain("CombatRoundEndParticipantReviewPanel");
    expect(source).toContain("CombatRoundEndDistanceControlPanel");
    expect(source).toContain("ensureCombatRoundEndReviewPrepared");
    expect(source).toContain("commitCombatRoundEndParticipantReview");
    expect(source).toContain("commitCombatRoundEndDistanceControl");
    expect(source).toContain("rollCombatRoundEndHealthCheck");
    expect(source).toContain("rollCurrentRoundEndDistanceControlOnServer");
    expect(source).toContain("getCombatRoundEndHealthCheckPendingRollCount");
    expect(source).toContain("getRoundEndDistancePendingRollOptions");
    expect(source).toContain("isRoundEndDistanceCommitReady");
    expect(source).toContain("getNextCombatRoundEndTask");
    expect(source).toContain("rollRoundEndDistanceControlFromPrimaryAction");
    expect(source).toContain("inspectorRoundEndDistanceControls");
    expect(source).toContain("Round-end distance control");
    expect(source).not.toContain(
      "Shared round-level pair review. These controls are not part of the current attack/parry",
    );
    expect(source).toContain("Participant review");
    expect(source).toContain("Participant round-end review");
    expect(source).toContain("Health check review");
    expect(source).toContain("No participant-owned round-end changes proposed.");
    expect(source).not.toContain("Roll for {participantALabel}");
    expect(source).not.toContain("Roll for {participantBLabel}");
    expect(source).toContain("getCombatRoundEndDistanceControlPendingRollCount");
    expect(source).toContain("distance-control roll${");
    expect(source).toContain(
      "Roll distance control for ${inspectorRoundEndDistanceAction.option.participantLabel}",
    );
    expect(source).toContain('"Apply distance control"');
    expect(source).toContain("Distance roll");
    expect(source).toContain("Distance pair");
    expect(source).toContain("GM override");
    expect(source).toContain("roundEndDistanceOverrideDrafts");
    expect(source).toContain("advanceCombatRoundCurrentStepOnServer({");
    expect(source).toContain("stepSnapshots,");
    expect(source).toContain("inspectorSelectedAttackAlreadyRolled ||");
    expect(source).toContain("inspectorDamageCommitted ||");
    expect(source).toContain("Select a participant step to inspect combat details.");
    expect(source).toContain("Previous participant");
    expect(source).toContain("Next participant");
    expect(source).toContain("Previous step");
    expect(source).toContain("Next step");
    expect(source).toContain("getAdjacentCombatRoundTimelineStepSelection");
    expect(source).toContain("getAdjacentCombatRoundTimelineParticipantSelection");
    expect(source).toContain("getParticipantIdsForTimelineRound");
    expect(source).toContain("roundNumbers: timelineRoundNumbers");
    expect(source).toContain("selectedRoundNumber");
  });

  it("marks historical inspector panels and prevents silent current-state fallbacks", () => {
    const source = readSource();

    expect(source).toContain("type CombatInspectorSourceMode =");
    expect(source).toContain('return "History";');
    expect(source).toContain("buildInspectorDisplayDraft({");
    expect(source).toContain("buildHistoricalInspectorPhaseContexts");
    expect(source).toContain("createUnrecordedHistoricalPhaseContext");
    expect(source).toContain("combatContext: createEmptyPlayerEncounterCombatContext()");
    expect(source).toContain(
      "phaseContexts: buildHistoricalInspectorPhaseContexts(input.snapshot)",
    );
    expect(source).toContain("sourceLabel={inspectorSourceLabel}");
    expect(source).toContain("sourceLabel={phaseSourceLabel}");
    expect(source).toContain("sourceLabel={inspectorModifierSourceLabel}");
    expect(source).toContain("historicalPhasePanel");
    expect(source).toContain("inspectorPanelSnapshot?.phasePanels?.[phaseKey]");
    expect(source).toContain("historicalPhasePanel?.distanceLabel");
    expect(source).toContain("historicalPhasePanel?.targetOptions ?? inspectorTargetOptions");
    expect(source).toContain("snapshotAttackStats: historicalPhasePanel?.attackSummary");
    expect(source).toContain("snapshotDefenseStats: historicalPhasePanel?.defenseSummary");
    expect(source).toContain("liveModifiers: inspectorIsHistorical");
    expect(source).toContain("? undefined\n                        : phaseKey");
    expect(source).toContain(
      "attackStats: inspectorIsHistorical ? null : phaseLoadoutSummary.attackStats",
    );
    expect(source).toContain("phaseDefenseStats: inspectorIsHistorical ? null : phaseDefenseStats");
    expect(source).toContain("inspectorPanelSnapshot?.modifierSummary?.rows ?? []");
    expect(source).toContain("const recordedModifierRows = buildRecordedCombatModifierRows({");
    expect(source).toContain(
      "Phase filtering belongs to calculation totals, not historical visibility.",
    );
    expect(source).toContain(": inspectorModifierRows;");
    expect(source).toContain("No information available for this panel.");
    expect(source).toContain("resolveCombatHistoryPanelSnapshot");
    expect(source).toContain("inspectorHistoricalSelectorFactsComplete");
    expect(source).toContain("movementPreferenceTargets");
    expect(source).toContain('phase1: buildPhasePanelSnapshot("phase1")');
    expect(source).toContain('phase2: buildPhasePanelSnapshot("phase2")');
    expect(source).not.toContain("History · Current reference");
    expect(source).not.toContain("...inspectorDraft,\n        actionId:");
  });

  it("separates participant SU review from shared distance-control review", () => {
    const source = readSource();
    const participantPanelStart = source.indexOf("function CombatRoundEndParticipantReviewPanel");
    const distancePanelStart = source.indexOf("function CombatRoundEndDistanceControlPanel");
    const renderParticipantPanel = source.indexOf("<CombatRoundEndParticipantReviewPanel");
    const renderDistancePanel = source.indexOf("<CombatRoundEndDistanceControlPanel");
    const distancePanelSource = source.slice(
      distancePanelStart,
      source.indexOf("function resolveCombatRoundInspectionSelection", distancePanelStart),
    );

    expect(participantPanelStart).toBeGreaterThan(-1);
    expect(distancePanelStart).toBeGreaterThan(participantPanelStart);
    expect(renderDistancePanel).toBeGreaterThan(renderParticipantPanel);
    expect(source.slice(participantPanelStart, distancePanelStart)).not.toContain(
      "proposedDistances",
    );
    expect(distancePanelSource).toContain("const distanceProposals");
    expect(distancePanelSource).toContain('proposal.status !== "committed"');
    expect(distancePanelSource).toContain(
      "if (input.roundReview && distanceProposals.length === 0)",
    );
    expect(distancePanelSource.match(/distanceProposals\.map/g) ?? []).toHaveLength(1);
    expect(distancePanelSource).not.toContain("<button");
    expect(distancePanelSource).not.toContain("<select");
    expect(distancePanelSource).not.toContain("<label");
    expect(distancePanelSource).not.toContain("onClick");
    expect(source).toContain("preActionControls={inspectorPreActionControls}");
    expect(source).toContain('inspectorRoundEndDistanceAction?.kind === "roll"');
    expect(source).toContain('inspectorRoundEndDistanceAction?.kind === "commit"');
    expect(source).toContain('inspectorRoundEndTask?.kind === "distance_roll"');
    expect(source).toContain('inspectorRoundEndTask?.kind === "distance_commit"');
    expect(source).toContain("inspectorRoundEndDistanceControlComplete ? (");
    expect(source).toContain('latestCombatEventSummary.shortTitle === "Distance control rolled"');
    expect(source).toContain('latestCombatEventSummary.shortTitle === "Distance control applied"');
    expect(source).toContain("commitRoundEndDistanceControl(");
    expect(source).toContain("inspectorRoundEndDistanceAction.proposal.id");
  });

  it("returns from inspection to the current task without mutating combat state", () => {
    const source = readSource();

    expect(source).toContain("const currentTaskSelection = getCurrentCombatRoundTaskSelection");
    expect(source).toContain("function selectCurrentTask()");
    expect(source).toContain("manualSelectionRef.current = undefined");
    expect(source).toContain("pendingSelectionRef.current = undefined");
    expect(source).toContain("setInspectionSelection(");
    expect(source).toContain("resolveCombatRoundInspectionSelection({");
    expect(source).toContain("scrollToCurrent: true");
    expect(source).toContain('scrollMode: "center"');
    expect(source).toContain("disabled={saving || !currentTaskSelection}");
    expect(source).toContain("onClick={selectCurrentTask}");
    expect(source).not.toContain("selectCurrentTaskOnServer");
    expect(source).not.toContain("applyCombatRoundSelectionTarget");
  });

  it("initially selects and scrolls to the active current task when present", () => {
    const source = readSource();

    expect(source).toContain("const currentTaskSelection =");
    expect(source).toContain("!pendingSelection && !manualSelection");
    expect(source).toContain("manualSelection: manualSelection ?? currentTaskSelection");
    expect(source).toContain(
      "const nextInspectionSelection = resolveCombatRoundInspectionSelection",
    );
    expect(source).toContain("scrollTimelineCellIntoView(");
    expect(source).toContain('"center"');
  });

  it("routes current-step advance through a narrow encounter command", () => {
    const source = readSource();

    expect(source).toContain("updateEncounterOnServer");
    expect(source).toContain("buildCombatRoundStepSnapshots");
    expect(source).toContain("advanceCombatRoundCurrentStepOnServer");
    expect(source).toContain("prepareCombatRoundEndReviewOnServer");
    expect(source).toContain("await advanceCombatRoundCurrentStepOnServer({");
    expect(source).toContain("stepSnapshots,");
    expect(source).toContain("getCombatRoundManagerStateFromCommandEnvelope({");
    expect(source).not.toContain("advanceCombatRoundStep(");
    expect(source).toContain("attackResult");
    expect(source).toContain("autoPrepareRoundEndReviewState(nextRoundState)");
    expect(source).toContain("combatRoundState: stateToPersist");
    expect(source).toContain("currentRound: stateToPersist.roundNumber");
    expect(source).toContain("submitCombatDeclarationOnServer");
    expect(source).toContain("phaseWeaponNames: {");
    expect(source).toContain("clearCurrentCombatRoundStepOnServer");
    expect(source).toContain("updateScenarioParticipantStateOnServer");
    expect(source).toContain(
      "const currentSelection = getCurrentCombatRoundTaskSelection(roundState)",
    );
    expect(source).toContain("const clearedSelection: CombatRoundSelectionTarget =");
    expect(source).toContain("participantId: currentSelection?.participantId");
    expect(source).toContain("step: currentSelection?.step ?? roundState.currentStep");
    expect(source).toContain("participantId: clearedSelection.participantId");
    expect(source).toContain("step: clearedSelection.step");
    expect(source).not.toContain("actionLog:");
  });

  it("routes phase damage commit through a narrow command instead of browser mutation", () => {
    const source = readSource();
    const commitStart = source.indexOf("await commitCurrentCombatPhaseDamageOnServer({");
    const commitEnd = source.indexOf("setSaveError(undefined);", commitStart);
    const commitHandler = source.slice(commitStart, commitEnd);

    expect(commitStart).toBeGreaterThan(-1);
    expect(commitHandler).toContain("review: buildCombatDamageReviewFromDraft({");
    expect(commitHandler).toContain("getCombatRoundManagerStateFromCommandEnvelope({");
    expect(commitHandler).toContain("onEncounterUpdated?.(nextEncounter)");
    expect(commitHandler).not.toContain("commitCombatRoundPhaseDamage({");
    expect(commitHandler).not.toContain("updateEncounterOnServer({");
    expect(commitHandler).not.toContain("updateScenarioParticipantStateOnServer({");
  });

  it("routes damage review save through a narrow command instead of browser mutation", () => {
    const source = readSource();
    const saveStart = source.indexOf("async function saveInspectorDamageReview()");
    const saveEnd = source.indexOf("async function advanceInspectorRoundEndReview()", saveStart);
    const saveHandler = source.slice(saveStart, saveEnd);

    expect(saveStart).toBeGreaterThan(-1);
    expect(saveHandler).toContain("await saveCurrentCombatDamageReviewOnServer({");
    expect(saveHandler).toContain("review: buildCombatDamageReviewFromDraft({");
    expect(saveHandler).toContain("getCombatRoundManagerStateFromCommandEnvelope({");
    expect(saveHandler).toContain("setRoundState(nextRoundState)");
    expect(saveHandler).toContain("onEncounterUpdated?.(nextEncounter)");
    expect(saveHandler).not.toContain("reviewCombatRoundDamageResult({");
    expect(saveHandler).not.toContain("persistRoundState(");
    expect(saveHandler).not.toContain("updateEncounterOnServer({");
  });

  it("routes the GM current distance-control roll through a narrow command", () => {
    const source = readSource();
    const rollStart = source.indexOf(
      "async function rollRoundEndDistanceControlFromPrimaryAction()",
    );
    const rollEnd = source.indexOf(
      "async function advanceInspectorPhaseResolutionSubstep",
      rollStart,
    );
    const rollHandler = source.slice(rollStart, rollEnd);

    expect(rollStart).toBeGreaterThan(-1);
    expect(rollHandler).toContain("await rollCurrentRoundEndDistanceControlOnServer({");
    expect(rollHandler).toContain("getCombatRoundManagerStateFromCommandEnvelope({");
    expect(rollHandler).toContain("setRoundState(nextRoundState)");
    expect(rollHandler).toContain("onEncounterUpdated?.(nextEncounter)");
    expect(rollHandler).not.toContain("rollCombatRoundEndDistanceControl({");
    expect(rollHandler).not.toContain("persistRoundState(");
    expect(rollHandler).not.toContain("updateEncounterOnServer({");
  });

  it("uses canonical current task selection after command-stack Clear", () => {
    const source = readSource();

    expect(source).toContain("const clearedSelection: CombatRoundSelectionTarget =");
    expect(source).toContain("const nextSelection = resolveCombatRoundInspectionSelection({");
    expect(source).toContain("manualSelection: getCurrentCombatRoundTaskSelection(nextRoundState)");
    expect(source).toContain("pendingSelectionRef.current = undefined");
    expect(source).toContain("manualSelectionRef.current = undefined");
    expect(source).toContain("setInspectionSelection(nextSelection)");
    expect(source).not.toContain(
      "nextRoundState.selectedParticipantId ?? clearedSelection.participantId",
    );
    expect(source).not.toContain("nextRoundState.selectedStep ?? clearedSelection.step");
  });

  it("keeps Clear current step visible by avoiding explicit scroll after clear", () => {
    const source = readSource();

    expect(source).toContain("function focusRoundTable(");
    expect(source).toContain("scrollMode?: CombatRoundTimelineScrollMode");
    expect(source).toContain("input.scrollIntoView !== false");
    expect(source).toContain(
      "focusRoundTable({ scrollIntoView: false, scrollToCurrent: true, state: nextRoundState })",
    );
    expect(source).toContain("Clear current step");
  });

  it("uses the locally inspected cell as the authoritative inspector display mode", () => {
    const source = readSource();

    expect(source).toContain("const [inspectionSelection, setInspectionSelection]");
    expect(source).toContain(
      'inspector.step === "initiative_phase_1" || inspector.step === "initiative_phase_2"',
    );
    expect(source).toContain(
      "const inspectorCurrentResolutionPhase = inspectorAttackPhase ?? inspectorResolutionPhase",
    );
    expect(source).toContain(
      "selectedTimelineRoundState.phaseResolutionCursor?.phase === inspectorCurrentResolutionPhase",
    );
    expect(source).toContain("inspector.participant?.stepStatuses[inspector.step]");
    expect(source).toContain("step: inspector.step");
    expect(source).toContain(
      "const currentTaskStep = currentTaskSelection?.step ?? roundState.currentStep",
    );
    expect(source).toContain("getAdvanceButtonLabel(currentTaskStep)");
    expect(source).toContain("Historical step:");
    expect(source).toContain("inspectorHistoricalStepOutcome?.message ??");
    expect(source).toContain(": `Current step: ${getPlayerCombatStepLabel(");
    expect(source).toContain("inspector.step,");
    expect(source).not.toContain("inspectorSnapshot ? inspector.step : roundState.currentStep");
    expect(source).not.toContain('roundState.currentStep === "review_action_modifiers" &&');
    expect(source).not.toContain('roundState.currentStep === "review_phase_2_modifiers" &&');
  });

  it("uses the GM initiative commit action once phase initiative is complete", () => {
    const source = readSource();

    expect(source).toContain("const inspectorPhaseInitiativeCommitLabel =");
    expect(source).toContain("`Commit ${formatCombatPhaseLabel");
    expect(source).toContain("initiative`");
    expect(source).toMatch(
      /inspectorPhaseInitiativeCommitLabel\s+\? inspectorPhaseInitiativeCommitLabel/,
    );
    expect(source).toMatch(/inspectorPhaseInitiativeCommitLabel\s+\? commitCurrentStep\(\)/);
    expect(source.indexOf("inspectorPhaseInitiativeCommitLabel")).toBeLessThan(
      source.search(/inspectorCurrentStepIsInitiative\s+\? rollInspectorInitiative\(\)/),
    );
  });

  it("uses canonical command envelopes for initiative commit and attack roll state selection", () => {
    const source = readSource();

    expect(source).toContain("getCombatRoundManagerStateFromCommandEnvelope");
    expect(source).toContain("commandEnvelope?: CombatRoundCommandEnvelope");
    expect(source).toContain("commandEnvelope,");
    expect(source).toContain("encounter: nextEncounter,");
    expect(source).toContain("await advanceCombatRoundCurrentStepOnServer({");
    expect(source).toContain("participants,");
    expect(source).toContain("await commitPhaseInitiativeResolutionOnServer({");
    expect(source).toContain("participant,");
    expect(source).toContain("await rollCombatAttackOnServer({");
    expect(source).toContain("manualSelection: currentTaskSelection");
    expect(source).toContain("pendingSelection: currentTaskSelection");
    expect(source).toContain("inspectionSelection: nextInspectionSelection");
    expect(source).toContain("setInspectionSelection(nextInspectionSelection)");
    expect(source).not.toContain("commandEnvelope.commands");
    expect(source).not.toContain("commandEnvelope.state");
    expect(source.indexOf("await commitPhaseInitiativeResolutionOnServer({")).toBeLessThan(
      source.indexOf("getCombatRoundManagerStateFromCommandEnvelope({"),
    );
    expect(source.indexOf("await rollCombatAttackOnServer({")).toBeLessThan(
      source.lastIndexOf("getCombatRoundManagerStateFromCommandEnvelope({"),
    );
  });

  it("guards recorded attack results against accidental re-rolls", () => {
    const source = readSource();

    expect(source).toContain("const inspectorSelectedAttackAlreadyRolled = Boolean(");
    expect(source).toContain(
      "const inspectorActionButtonLabel = inspectorSelectedAttackAlreadyRolled",
    );
    expect(source).toContain('? "Attack already rolled"');
    expect(source).toContain(
      "const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({",
    );
    expect(source).toContain('Clear ${phase === "phase1" ? "A1" : "A2"} before rolling again.');
    expect(source).toContain("if (existingAttackResult) {");
    expect(source).toContain("return;");
  });

  it("requires Combat Experience before ordinary DE declaration", () => {
    const source = readSource();

    expect(source).toContain("getCombatRoundRequiredCombatExperienceTrigger");
    expect(source).toContain("rollCombatExperienceOnServer");
    expect(source).toContain("getCombatRoundCombatExperienceDifficulty");
    expect(source).toContain("isCombatRoundCombatExperienceWindowOpen");
    expect(source).toContain("hasCombatRoundCombatExperienceRoll");
    expect(source).toContain("setCombatExperienceDifficultyOnServer");
    expect(source).toContain("getParticipantCombatExperienceSkillTotalLookup");
    expect(source).toContain("formatCombatExperienceStatus");
    expect(source).toContain("formatCombatExperienceCalculation");
    expect(source).not.toContain("formatCombatExperienceEffectiveTableLine");
    expect(source).not.toContain("Effective CE table result");
    expect(source).toContain("formatCombatExperienceEffectLine");
    expect(source).toContain("const inspectorCombatExperienceRequired =");
    expect(source).toContain("const inspectorCombatExperienceIsCombatStart =");
    expect(source).toContain("visibility: encounter.roleplayState?.visibility");
    expect(source).toContain("const inspectorCombatExperienceWindowOpen =");
    expect(source).toContain("const combatExperienceRollRecorded =");
    expect(source).toContain("const activeCombatExperienceDifficulty =");
    expect(source).toContain("const inspectorCombatExperienceDifficulty =");
    expect(source).toContain("const inspectorCombatExperienceSkillLookup = useMemo(");
    expect(source).toContain("sheetSummary: inspectorSheetSummary");
    expect(source).toContain(
      "const inspectorCombatExperienceSkillTotal = inspectorCombatExperienceSkillLookup.skillTotal",
    );
    expect(source).toContain("${roundState.roundNumber}:combat-experience");
    expect(source).toContain("const inspectorCombatExperienceNoRollAvailable =");
    expect(source).toContain(
      "inspectorCombatExperienceSkillTotal >= activeCombatExperienceDifficulty",
    );
    expect(source).toContain("const inspectorCombatExperienceDifficultyCommandPending =");
    expect(source).toContain("const inspectorCombatExperienceActionLabel =");
    expect(source).toContain("const combatExperienceDifficultyControlsDisabled =");
    expect(source).toContain("Start Combat Experience rolls");
    expect(source).toContain("Update CE difficulty");
    expect(source).toContain("Enter CE difficulty.");
    expect(source).toContain("CE difficulty");
    expect(source).toContain("Difficulty locked after the first CE result.");
    expect(source).toContain("Confirm Combat Experience");
    expect(source).toContain("Roll Combat Experience");
    expect(source).toContain("Roll Combat Experience before declaring an action.");
    expect(source).toContain("Boolean(inspectorSnapshot) ||");
    expect(source).toContain("inspectorCombatExperienceRequired");
    expect(source).toContain("value={inspectorCombatExperienceDifficulty}");
    expect(source).toContain("Skill total {inspectorCombatExperienceSkillTotal}");
    expect(source).toContain("inspectorCombatExperienceSkillLookup.warning");
    expect(source).toContain("setCombatExperienceDifficultyDrafts");
    expect(source).toContain("saveCombatExperienceDifficultyDraft");
    expect(source).not.toContain("onBlur={(event) =>");
    expect(source).not.toContain('event.key !== "Enter"');
    expect(source).toContain('inspectorIsInspectionOnly && inspector.step !== "select_actions"');
    expect(source).toContain("showInspectorInitiativeContextPanel");
    expect(source).toContain("showInspectorPhaseCombatExperienceContextPanel");
    expect(source).toContain("showInspectorCombatStartExperienceContextPanel");
    expect(source).toContain("Base initiative {inspectorInitiativeCalculation.baseInitiative}");
    expect(source).toContain("Pending rolls: {inspectorInitiativeRollCounts.pending} of");
    expect(source).toContain("Effective CE {inspectorCombatExperienceSkillTotal}");
    expect(source).toContain("showInspectorModifierReviewContextPanel");
    expect(source).toContain("Review generated and manual modifiers before advancing.");
    expect(source).not.toContain("Selected choice:");
    expect(source).not.toContain(">Status:");
    expect(source).not.toContain("inspectorPhaseInitiativeChoiceStatuses");
    expect(source).not.toContain("Phase initiative choices");
    expect(source).toContain("inspectorCombatExperienceRequired");
    expect(source).toContain("rollInspectorCombatExperience()");
    expect(source).toContain("backOutPhaseAttackOnServer");
    expect(source).toContain("backOutInspectorPhaseAttack()");
    expect(source).toContain("continuePhaseAttackOnServer");
    expect(source).toContain("commitPhaseInitiativeResolutionOnServer");
    expect(source).toContain("inspectorPhaseAttackBackOutOpportunity");
    expect(source).toContain("getCombatRoundPhaseAttackBackOutOpportunity");
    expect(source).toContain("canBackOutCombatRoundPhaseAttack");
    expect(source).toContain("const inspectorCanBackOutPhaseAttack =");
    expect(source).toContain("PhaseAttackChoiceSelection");
    expect(source).toContain('useState<PhaseAttackChoiceSelection>("continue")');
    expect(source).toContain('setInspectorPhaseAttackChoiceSelection("continue")');
    expect(source).toContain("inspectorPhaseAttackChoiceSelectorAvailable");
    expect(source).toContain("inspectorPhaseAttackChoiceIsBackOut");
    expect(source).toContain("inspectorActionButtonDisabled");
    expect(source).toContain("inspectorPhaseAttackChoiceControls");
    expect(source).toContain('"Continue and roll CE"');
    expect(source).toContain('"Back out of attack (-2 DB/Parry penalty)"');
    expect(source).toContain('"Back out of attack (no CE roll)"');
    expect(source).toContain("inspectorPhaseInitiativeChoiceResultPanel");
    expect(source).toContain("buildPhaseInitiativeChoiceResultPanel");
    expect(source).toContain('<option value="continue">');
    expect(source).toContain("preActionControls={inspectorPreActionControls}");
    expect(source).toContain("? saveCombatExperienceDifficultyDraft()");
    expect(source).toContain("? backOutInspectorPhaseAttack()");
    expect(source).toContain("inspectorSkipActionOutcomeSelectorAvailable");
    expect(source).toContain("inspectorCurrentActionOutcomeControls");
    expect(source).toContain("inspectorEffectiveActionButtonLabel");
    expect(source).toContain("inspectorEffectiveActionButtonDisabled");
    expect(source).toContain("inspectorSkipActionSelected");
    expect(source).not.toMatch(/secondaryButtonLabel=\{[^}]*Back out of attack/s);
    expect(source).not.toContain(
      "onSecondaryAction={() => void skipInspectorCurrentPhaseAction()}",
    );
    expect(source).toContain("Back out of attack");
    expect(source.indexOf("? rollInspectorCombatExperience()")).toBeLessThan(
      source.indexOf(": inspectorCurrentStepIsInitiative"),
    );
    expect(source.indexOf("? rollInspectorCombatExperience()")).toBeLessThan(
      source.search(/rollInspectorPhaseAttack\(\s*inspectorCurrentAttackPhase/s),
    );
    expect(source).toContain("Combat Experience");
    expect(source).toContain("Latest combat event");
  });

  it("uses stable unique keys for repeated warning rows", () => {
    const source = readSource();

    expect(source).not.toContain("key={warning}");
    expect(source).not.toContain("warnings.map((warning) =>");
    expect(source).toContain("critical-effect-proposal-warning");
    expect(source).toContain("damage-commit-readiness-warning");
    expect(source).toContain("end-review-health-roll-warning");
    expect(source).toContain("end-review-warning");
  });
});
