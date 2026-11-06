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
  it("hydrates and presents canonical missile preparation progress for player continuation", () => {
    const source = readSource();

    expect(source).toContain("setMissileAimLevel(currentMissileReadiness.aimLevel)");
    expect(source).toContain("currentMissileReadiness.baseRequiredRounds");
    expect(source).toContain("currentMissileReadiness.aimRequiredRounds");
    expect(source).toContain("Readiness: {currentMissileReadiness.status}");
  });
  it("keeps Player and GM Player combat in tracker, workspace, log, ancillary order", () => {
    const source = readSource();
    const tracker = source.indexOf("<CombatTracker");
    const historicalWorkspace = source.indexOf("<PlayerCombatHistoryInspector", tracker);
    const activeWorkspace = source.indexOf("<div style={playerCombatTopPanelRowStyle}", tracker);
    const combatLog = source.indexOf("<CombatLog", tracker);
    const ancillaryTools = source.indexOf("<EquipmentLoadoutModule", combatLog);

    expect(tracker).toBeGreaterThan(-1);
    // A3, Forgejo issue #335 — the standalone `GenericCombatActionPanel` that used to sit between
    // the tracker and the workspace is gone from both this surface's audiences.
    expect(source).not.toContain("<GenericCombatActionPanel");
    expect(historicalWorkspace).toBeGreaterThan(tracker);
    expect(activeWorkspace).toBeGreaterThan(tracker);
    expect(combatLog).toBeGreaterThan(historicalWorkspace);
    expect(combatLog).toBeGreaterThan(activeWorkspace);
    expect(ancillaryTools).toBeGreaterThan(combatLog);
    expect(source.slice(tracker, activeWorkspace)).not.toContain("<CombatLog");
    expect(source).toContain("followCurrent={!historyInspection}");
    expect(source).not.toContain('"Continue combat"');
    expect(source).toContain('? "Resume current task"');
  });

  /**
   * A3, Forgejo issue #335 — Combat Panel Contract §12.15. The retired
   * `GenericCombatActionPanel` carried the declaration intent for this surface's GM branch. The
   * §12.4 destination for intent text is the Action Selector, and that wiring is what survives
   * here; no adjudication panel of its own remains on the player surface.
   */
  it("keeps the declaration intent wiring on the Action Selector and mounts no generic action panel", () => {
    const source = readSource();

    expect(source).not.toContain("GenericCombatActionPanel");
    expect(source).toContain("declarationIntent={declarationIntent}");
    expect(source).toContain("onDeclarationIntentChange={(intent) => {");
    expect(source).toContain("setDeclarationIntent(intent)");
  });

  /**
   * A3, Forgejo issue #335 — action and task history is read from the Combat Log, its §12.4
   * destination, and this surface mounts no second declaration channel of its own.
   *
   * Forgejo issue #834 — the Item half of this test is now an absence. The persistent
   * `Items in this Combat` block is removed from the player Combat surface for Alpha with no
   * replacement, so neither the panel nor the Action Selector slot that carried it may reappear
   * here. The Action Selector itself is asserted positively, so the absences below are measured
   * against a surface that still mounts the region the block used to sit in.
   */
  it("keeps task history on the Combat Log and mounts no Item declaration surface", () => {
    const source = readSource();

    expect(source).not.toContain("showGenericDeclarationControls");
    expect(source).toContain("<CombatLog");
    expect(source).toContain("<PlayerCombatActionSelectorPanel");
    expect(source).not.toContain("CombatItemInteractionPanel");
    expect(source).not.toContain("itemInteractionControls");
    expect(source).not.toContain("Items in this Combat");
  });

  it("uses canonical board positioning for Current task and tracker-local keyboard navigation", () => {
    const source = readSource();

    expect(source).toContain("canonicalOperationalPosition.trackerFacet.step");
    expect(source).toContain("onClick={selectCurrentTrackerPosition}");
    expect(source).toContain("positionCurrentRequest={trackerPositionRequest}");
    expect(source).toContain("tableRef={trackerRef}");
    expect(source).toContain("onKeyDown={handleTrackerKeyDown}");
    expect(source).toContain("getCombatRoundTimelineArrowMove({");
    expect(source).toContain("event.preventDefault()");
  });

  it("renders tracker, Current Action, and inspector only from a coherent revision perspective", () => {
    const source = readSource();

    expect(source).toContain(
      "revisionBoundHistory.history.sourceEncounterId === encounterSession.id",
    );
    expect(source).toContain(
      "revisionBoundHistory.history.sourceUpdatedAt === encounterSession.updatedAt",
    );
    expect(source).toContain("perspectiveParticipantId: isGameMaster");
    expect(source).toContain("revision: encounterSession.updatedAt");
  });

  it("renders the server-filtered revision-bound continuing consequences", () => {
    const source = readSource();

    expect(source).toContain("combatHistory?.currentConsequences");
    expect(source).not.toContain("consequence.participantId");
    expect(source).toContain("<PlayerCombatCurrentConsequences consequences={currentConsequences}");
  });

  it("uses only the server player projection for non-GM participant and target visibility", () => {
    const source = readSource();

    expect(source).toContain("return projection?.visibleParticipants ?? []");
    expect(source).toContain(
      "playerPerspectiveVisibleParticipants.flatMap((participant) => [participant.id])",
    );
    expect(source).toContain(".filter((candidate) => candidate.selectable)");
    expect(source).not.toContain("projection.visibleParticipants.concat");
  });

  it("shows passive exact-identity recent-result feedback for player and GM rolls", () => {
    const source = readSource();

    expect(source).not.toContain("isGameMaster && selectedRoundParticipant");
    expect(source).toContain("const candidate = selectedRoundParticipant");
    expect(source).toContain("createCombatRecentResultCandidate({");
    expect(source).toContain("resolveCombatRecentResultFocus({");
    expect(source).toContain("selectCombatRecentResultPresentation({");
    expect(source).toContain("recentPresentation={recentResultPresentation}");
    expect(source).not.toContain('aria-label="Post-roll inspection hold"');
    expect(source).not.toContain("Continue combat");
    expect(source).not.toContain("latestResult");
    expect(source).not.toContain("setTimeout");
  });

  it("uses the shared Feint-Attack declaration and owned-roll controls", () => {
    const source = readSource();

    expect(source).toContain('selectedActionId === "feint_attack"');
    expect(source).toContain("Feint method");
    expect(source).toContain("<FeintSkillPreview preview={feintSkillPreview}");
    expect(source).toContain("Defender resists with their highest close-combat skill");
    expect(source).toContain("resolveCombatFeintWeaponSkill");
    expect(source).toContain("buildFeintSkillPreview({");
    expect(source).toContain("rollCombatFeintOnServer");
    expect(source).toContain("resolveCombatFeintDeclarationRequestTarget");
    expect(source).toContain('case "roll_feint"');
    expect(source).toContain("CurrentActionCommandDescriptor");
    expect(source).not.toContain("reviewCombatFeintFeasibilityOnServer");
    expect(source).not.toContain("commitCombatFeintResultOnServer");
  });

  it("executes player-owned Continued Contact maintenance through the canonical command", () => {
    const source = readSource();

    expect(source).toContain("rollContinuedContactMaintenanceOnServer");
    expect(source).toContain("async function rollContinuedContactMaintenance(");
    expect(source).toContain('case "roll_continued_contact_maintenance"');
    expect(source).toContain("contestId: descriptor.contestId");
    expect(source).toContain("continuedContactId: descriptor.continuedContactId");
    expect(source).toContain("opponentParticipantId: descriptor.opponentParticipantId");
    expect(source).toContain("scenarioParticipantId: selectedParticipant.id");
  });

  it("executes participant-owned Break Off rolls through the exact projected task", () => {
    const source = readSource();

    expect(source).toContain("rollCombatBreakOffOnServer");
    expect(source).toContain("async function rollBreakOff(");
    expect(source).toContain('case "roll_break_off"');
    expect(source).toContain("proposalId: descriptor.proposalId");
    expect(source).toContain("scenarioParticipantId: descriptor.participantId");
    expect(source).toContain("executionGroupId: descriptor.executionGroupId!");
    expect(source).toContain("expectedRevision: descriptor.expectedRevision");
    expect(source).toContain("taskId: descriptor.taskId");
  });

  it("keeps the recovered combat panel importable without future placeholder panels", () => {
    const source = readSource();

    expect(source).toContain("export default function ScenarioPlayerCombatPageContent");
    expect(source).toContain("PlayerCombatActionSelectorPanel");
    expect(source).toContain("PlayerCombatActionButtonPanel");
    expect(source).toContain("CombatStepResultList");
    expect(source).toContain("<CombatLog");
    expect(source).toContain("combatHistory?.combatLog");
    expect(source).toContain("handleCombatLogSelection");
    expect(source).toContain("playerCombatPanelRowStyle");
    expect(source).toContain("EquipmentLoadoutModule");
    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("PlayerCombatPhasePanel");
    expect(source).toContain("PlayerCombatAttackStatsTable");
    expect(source).toContain("PlayerCombatAttackTargetSelector");
    expect(source).toContain("PlayerCombatAttackLocationSelector");
    // #771: the player phase panel composes the Defense / Parry group, which owns the DB/DM/P
    // mini-table, the parry source selector in its source/name cell and the hand/orientation
    // controls below it. The page no longer places the mini-table itself.
    expect(source).toContain("PlayerCombatDefenseGroup");
    expect(source).not.toContain("<PlayerCombatDefenseStatsTable");
    expect(source).toContain(
      "showParrySourceSelector={isPlayerEncounterParryAllocationDeclaration(",
    );
    expect(source).toContain("separatedFromAttack={phaseAttackGroupRendered}");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("perspectiveParticipantId,");
    expect(source).toContain("setHistoryInspection(undefined)");
    expect(source).toContain("resolveProjectedCombatHistoryPanelSnapshot");
    expect(source).toContain("playerCombatTopPanelRowStyle");
    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("buildPlayerCombatPhasePanelModel");
    expect(source).toContain("buildPlayerCombatLoadoutSummary");
    expect(source).toContain("resolveScenarioCombatEquipmentState");
    expect(source).toContain("getScenarioCombatEquipmentStatus");
    expect(source).toContain("formatScenarioCombatEquipmentDiagnostic");
    expect(source).not.toContain("Refresh participant equipment");
    expect(source).not.toContain("refreshScenarioParticipantEquipmentOnServer");
    expect(source).toContain("buildCombatDeclarationAttackSelection");
    expect(source).toContain("phaseAttackSources: declarationAttackSelection.phaseAttackSources");
    expect(source).toContain("renderedDeclarationAttackSelection.phaseContexts[phaseKey]");
    expect(source).toContain("emptyState={phaseLoadoutSummary.attackModeUnavailableMessage}");
    expect(source).toContain("selectedAttackModeId={phaseModel.phaseContext.attackModeId}");
    expect(source).not.toContain("itemId: phaseCombatLoadoutSummaries");
    expect(source).toContain("visibleAtStep: currentCombatStep");
    expect(source).toContain("buildPlayerCombatDefenseStats");
    expect(source).toContain("buildCurrentActionPresentation");
    expect(source).toContain("resolveEncounterParticipantByRollParticipantId({");
    expect(source).toContain("buildCombatParticipantCandidates({");
    expect(source).toContain("encounterRevision: combatHistory?.sourceUpdatedAt");
    expect(source).toContain("presentation={currentActionPresentation}");
    expect(source).toContain("onDeclareAction={invokePlayerCurrentAction}");
    expect(source).toContain("buildTargetAwareEncounterLiveCombatModifierSummary");
    expect(source).toContain("resolveEncounterLiveCombatModifierContext");
    expect(source).toContain("projectCombatActionGeneratedModifiers");
    expect(source).toContain("projectedCombatContextDraft");
    expect(source).toContain("combatContext: projectedCombatContextDraft");
    expect(source).toContain("movementIntent: selectedMovementIntent");
    expect(source).toContain("resolvedEquipmentState: controlledEquipmentState ?? undefined");
    expect(source).toContain("getPlayerCombatModifierDisplayPhase");
    expect(source).toContain("const currentModifierPhase = getPlayerCombatModifierDisplayPhase({");
    expect(source).toContain("phaseKey: currentModifierPhase");
    expect(source).toContain("validateCombatDeclarationTargets");
    expect(source).toContain("participantIdentities: combatRoundState?.participants");
    expect(source).toContain("canonicalizeCombatObserveTargetContext({");
    expect(source).toContain("secondaryActionContext: requestSecondaryActionContext");
    expect(source).toContain("targetValidation");
    expect(source).toContain("declarationTargetValidationMessage");
    expect(source).toContain("combatExperienceValidationMessage ??");
    expect(source).toContain("declarationTargetValidationMessage ??");
    expect(source).toContain("currentAttackSourceValidationMessage");
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
    expect(source).not.toContain("getPlayerCombatStepLabel");
    expect(source).not.toContain("gmStatusSuffix");
    expect(source).not.toContain("Modifiers declared");
    expect(source).not.toContain("Phase 2 modifiers declared");
    expect(source).not.toContain("GM can save or revise this participant declaration.");
    expect(source).toContain("rollCombatAttackOnServer");
    expect(source).toContain("const { encounter, participant } = await rollCombatAttackOnServer");
    expect(source).toContain("entry.id === participant.id ? participant : entry");
    expect(source).toContain("attackModeId: descriptor.attackModeId");
    expect(source).toContain("opportunityId: descriptor.opportunityId");
    expect(source).toContain("weaponSourceId: descriptor.weaponSourceId");
    expect(source).not.toContain("weaponCriticalCode: phaseAttackStats.weaponCriticalCode");
    expect(source).not.toContain("weaponDamageClass: phaseAttackStats.weaponDamageClass");
    expect(source).toContain("buildPlayerCombatAttackModifierRequest");
    const attackRequestSource = source.slice(
      source.indexOf("async function rollPhaseAttack"),
      source.indexOf("async function rollCurrentParry"),
    );
    expect(attackRequestSource).not.toContain(
      "defenderDbParryRaw: modifierRequest.defenderDbParryRaw",
    );
    expect(attackRequestSource).not.toContain(
      "defenderModifierFingerprint: modifierRequest.defenderModifierFingerprint",
    );
    expect(source).toContain("expectedRevision: modifierRequest.expectedRevision");
    expect(source).toContain("initiativeGroupId: modifierRequest.initiativeGroupId");
    expect(attackRequestSource).not.toContain("obSkillRaw:");
    expect(source).toContain("createPlayerCombatHistoryRequestCoordinator");
    expect(source).toContain("isMatchingPlayerCombatHistory");
    expect(source).toContain("rollCombatParryOnServer");
    expect(source).toContain("buildCombatParryModifierRequest({");
    expect(source).not.toContain("dbParryRaw: modifierRequest.dbParryRaw");
    expect(source).toContain("if (participant) {");
    expect(source).toContain("chooseRoundEndContinuedContactDistanceOnServer({");
    expect(source).toContain("baseDefenseStats: buildPlayerCombatDefenseStats({");
    expect(source).toContain(".baseDefenseStats?.parry");
    expect(source).not.toContain("modifierBreakdown: currentParryModifierBreakdown");
    expect(source).toContain("rollCombatInitiativeOnServer");
    expect(source).toContain("rollInitiative");
    expect(source).toContain("rollPhaseAttack");
    expect(source).toContain("rollCurrentParry");
    expect(source).toContain('descriptor.commandType !== "roll_parry"');
    expect(source).toContain("taskId: descriptor.taskId");
    expect(source).toContain("expectedRevision: descriptor.expectedRevision");
    expect(source).not.toContain('currentRollAction?.kind !== "parry"');
    expect(source).toContain("currentInitiativePhase");
    expect(source).not.toContain("formatCombatInitiativeFormula");
    expect(source).toContain("buildEncounterInitiativeModifierCalculation");
    expect(source).toContain("initiativeCalculation");
    expect(source).not.toContain(
      "initiativeModifierAdjustment: initiativeCalculation.modifierAdjustment",
    );
    expect(source).toContain("formatPlayerCombatInitiativeRank");
    expect(source).not.toContain("getCombatRoundInitiativeRanks");
    expect(source).toContain("boundary: combatHistory.progression.boundary.kind");
    expect(source).toContain("rank.tiedCount > 1");
    expect(source).toContain("tied with ${rank.tiedCount}");
    expect(source).toContain("selectedCurrentInitiative");
    expect(source).not.toContain("selectedRelevantInitiativeResultPanel");
    expect(source).not.toContain("selectedRelevantInitiativeRankLabel");
    expect(source).not.toContain("latestRolledInitiativePhase");
    expect(source).not.toContain("getCombatRoundOutgoingAttackResultForParticipantPhase");
    expect(source).not.toContain("getCombatRoundDisplayIncomingAttackResultForParticipantPhase");
    expect(source).not.toContain("buildPlayerCombatDistanceModifierSection");
    expect(source).not.toContain("formatCombatDistanceModifierDetailLine");
    expect(source).not.toContain("distanceModifierDetail");
    expect(source).toContain("phaseWeaponNames: {");
    expect(source).toContain("phase1: phaseCombatLoadoutSummaries.phase1.attackStats?.weaponName");
    expect(source).toContain("phase2: phaseCombatLoadoutSummaries.phase2.attackStats?.weaponName");
    expect(source).toContain('title: "To hit"');
    expect(source).not.toContain('title: "Distance"');
    expect(source).not.toContain("getCombatRoundPhaseResolutionResultForAttack");
    expect(source).toContain("getCombatRoundResolutionPhaseForStep");
    expect(source).not.toContain("selectedCurrentAttackResultPanel");
    expect(source).not.toContain("getLatestRelevantPlayerCombatAttackResult");
    expect(source).not.toContain("selectedLatestRelevantAttackResult");
    expect(source).not.toContain("selectedCurrentPhaseResolutionResultPanel");
    expect(source).not.toContain("selectedAttackerPrivilegedResolution");
    expect(source).toContain("resolveCombatTaskCommandContext({");
    expect(source).not.toContain("selectedAttackerPrivilegedAttackResult");
    expect(source).toContain("getCombatRoundAttackResultById");
    expect(source).not.toContain("const attackResult = selectedCurrentResolutionAttackResult");
    expect(source).toContain("rollCombatHitLocationOnServer");
    expect(source).toContain("rollCombatCriticalOnServer");
    expect(source).toContain("formatCombatPhaseResolutionResultLines");
    expect(source).toContain("formatCombatParryCalculationLine");
    expect(source).toContain("Parry: P ${resolution.combinedParryScore}");
    expect(source).toContain("Result: ${parry.resultLabel}");
    expect(source).toContain("Parry: ${formatResolutionStatusLabel");
    expect(source).toContain("Damage roll: ${formatResolutionStatusLabel");
    expect(source).toContain("Proposal: ${formatResolutionStatusLabel");
    expect(source).toContain("Defense: DB ${input.result.defenderDb}");
    expect(source).toContain("Main: ${input.result.weaponName} OB");
    expect(source).toContain("buildCombatStepResultPresentation({");
    expect(source).toContain("buildCombatStepResultPresentation({");
    expect(source).toContain("events: combatHistory.activeRound.events");
    expect(source).toContain("participantId: selectedRoundParticipant.participantId");
    expect(source).toContain("boundary: combatHistory.progression.boundary.kind");
    expect(source).not.toContain("selectPlayerCombatActionResultPanel<");
    expect(source).not.toContain("const declarationButtonLabel");
    expect(source).not.toContain("const playerActionButtonLabel");
    expect(source).toContain("selectedParticipantStoredDeclarationThisRound");
    expect(source).toContain("selectedStoredDeclarationTargetValidation");
    expect(source).toContain("selectedStoredDeclarationComplete");
    expect(source).toContain("declarationIncomplete");
    expect(source).toContain("declarationStepHardLocked");
    expect(source).toContain("declarationSubmittedAndComplete");
    expect(source).not.toContain("currentAttackAction?.label");
    expect(source).not.toContain("buttonLabel={playerActionButtonLabel}");
    expect(source).toContain('rollAttackerPrivilegedCombatDie("hitLocation", descriptor)');
    expect(source).toContain('rollAttackerPrivilegedCombatDie("critical", descriptor)');
    expect(source).toContain('case "roll_attack"');
    expect(source).toContain("rollPhaseAttack(descriptor)");
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
    expect(source).toContain("descriptor.opportunityId");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("loadRevision: loadEncounterRevision");
    expect(source).toContain("buildProjectedCombatTrackerModel");
    expect(source).toContain("operationalParticipantId: selectedRoundParticipant?.participantId");
    expect(source).toContain("combatHistory?.progression");
    expect(source).toContain("perspectiveParticipantId,");
    expect(source).not.toContain("buildCombatProgressionProjection");
    expect(source).toContain("<CombatTracker");
    expect(source).toContain("setHistoryInspection({");
    expect(source).toContain("setHistoryInspection(undefined)");
    expect(source).toContain("cell.cellKey === playerCombatTrackerModel.operationalCursorCellKey");
    /*
     * #862 V1 row 6. The player cursor used to refuse to move onto any non-`inspectable` cell
     * (`if (!nextCell?.inspectable) return false;`) while the GM surface wrote the selection
     * unconditionally. The Product Owner ruled that every rendered cell is a landing and the
     * inspector may show nothing, so the guard is now a cell-existence check plus the shared-stage
     * condition the tracker model already applies to the inspection cursor — borrowed from
     * `buildProjectedCombatTrackerModel` rather than re-derived here, so a destination this handler
     * accepts is always one the tracker will draw the cursor on.
     *
     * Both directions are asserted because the source text is a weak instrument on its own. The
     * rendered proof is `apps/web/e2e/combat-visibility-v1.spec.ts`, which drives the whole round
     * on the player surface after the shared board has reached every step and holds the
     * one-highlighted-cell invariant and a no-private-field check after every press.
     */
    expect(source).toContain("if (!nextCell) return false;");
    expect(source).not.toContain("if (!nextCell?.inspectable) return");
    expect(source).toContain("isProjectedCombatTrackerStageReached({");
    expect(source).toContain("activeRoundNumber: currentRound.roundNumber,");
    /*
     * #771. The visible-step wrapper, not the guard above, is what keeps the inspector off a step
     * with no rendered column: this surface still builds a `pre_declaration` cell, so that step
     * has a cell — and can even be inspectable — while having no column.
     *
     * Corrected mechanism (#783 F2): that cell is not inspectable through `combat_experience`
     * completion evidence. `buildProjectedCombatTrackerModel.ts` reads no completion evidence for
     * `inspectable`, and the Combat Experience event keys to `DE` canonically and to
     * `select_actions` in the legacy mapping; what reaches the cell is the events and snapshots
     * written with `step: normalized.currentStep` while the round is in `pre_declaration`.
     */
    expect(source).toContain("getAdjacentVisibleCombatRoundTimelineStepSelection({");
    expect(source).toContain("visibleSteps: playerCombatTrackerModel.steps,");
    expect(source).not.toContain("getAdjacentCombatRoundTimelineStepSelection({");
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
    expect(source).toContain("buildCombatParticipantCandidates");
    expect(source).toContain("allowedParticipantIds");
    expect(source).toContain("getEncounterScenarioParticipantIds");
    expect(source).toContain("playerPerspectiveVisibleParticipants");
    expect(source).toContain("visibleParticipantIds");
    expect(source).toContain(
      "selectedParticipant.state.combat.lastDeclaredEncounterId === encounterId",
    );
    expect(source).toContain("phaseModel.showDefenseContext");
    expect(source).toContain("getLatestPlayerSafeCombatDefenseReview({");
    expect(source).toContain("events: combatHistory.activeRound.events");
    expect(source).toContain("PlayerCombatCommittedDefenseReview review={committedDefenseReview}");
    expect(source).toContain("committedDefenseReview ? (");
    expect(source).not.toContain("movementLabel=");
    expect(source).not.toContain('description: selectedSecondaryActionId ? "" : "Open"');
    expect(source).not.toContain("formatCombatInitiativeRoll(selectedRoundParticipant");
    expect(source).not.toContain("Attack - Parry ·");
    expect(source).not.toContain("visibleOpponentOptions");
    expect(source).toContain("isGameMaster");
    expect(source).not.toContain("will appear here in the next phase");
    expect(source).not.toContain("will expand into this area");
  });

  it("separates slow context from revision-bound encounter and history refresh", () => {
    const source = readSource();
    const slowContextStart = source.indexOf("async function loadSlowContext()");
    const slowContextEnd = source.indexOf("useEffect(() => {", slowContextStart + 20);
    const slowContext = source.slice(slowContextStart, slowContextEnd);
    const brawlingStart = source.indexOf("async function rollCurrentOffensiveParryBrawling");
    const brawlingEnd = source.indexOf(
      "async function rollAttackerPrivilegedCombatDie",
      brawlingStart,
    );
    const brawlingHandler = source.slice(brawlingStart, brawlingEnd);
    const acceptStart = source.indexOf("const acceptEncounterSession = useCallback");
    const acceptEnd = source.indexOf("useEffect(() => {", acceptStart);
    const acceptHandler = source.slice(acceptStart, acceptEnd);

    expect(slowContext).toContain("loadScenarioPlayerProjection(scenarioId)");
    expect(slowContext).toContain("loadContent: loadCanonicalContent");
    expect(slowContext).toContain("loadScenarioParticipants(scenarioId)");
    expect(slowContext).not.toContain("loadEncounterById");
    expect(slowContext).not.toContain("loadCombatHistory");
    expect(source).toContain("pollPlayerCombatSnapshot({");
    expect(source).toContain("loadProjection: () => loadScenarioPlayerProjection(scenarioId)");
    expect(source).toContain("setProjection(result.projection)");
    expect(source).toContain("setRevisionBoundHistory(undefined)");
    expect(source).toContain("setCombatItemOptions(undefined)");
    expect(source).toContain("historyCoordinator.clear()");
    expect(source).toContain("acceptedProjectionKey: acceptedProjectionKeyRef.current");
    expect(source).toContain("onProjectionChanged: (nextProjection) => {");
    expect(source).toContain("const refreshRequestId = refreshCoordinator.begin()");
    expect(source).toContain("!refreshCoordinator.isCurrent(refreshRequestId)");
    expect(source).toContain("refreshCoordinator.invalidate()");
    expect(source).toContain("setEncounterSession(undefined)");
    // Forgejo issue #834 — the removed `Items in this Combat` block carried
    // `key={`${encounterSession.id}:${projectionCacheKey}`}`, which re-mounted it when the
    // viewer's privacy-filtered projection changed without the encounter revision moving. That
    // React key is gone with the block. The same projection-keyed invalidation survives for the
    // Item options this surface still consumes (the canonical Disarm weapons), as the effect's
    // own dependency, and that is what is pinned here instead.
    expect(source).toContain("}, [encounterId, encounterSession?.updatedAt, projectionCacheKey]);");
    expect(source).toContain("loadRevision: loadEncounterRevision");
    expect(source).toContain("setRevisionBoundHistory(result.history)");
    expect(source).toContain("setSelectableParticipants([...result.participants])");
    expect(source).toContain("historyCoordinator.request(identity)");
    expect(source).not.toContain("loadCombatHistory(");
    expect(source).not.toContain("encounterSession?.updatedAt, isGameMaster");
    expect(acceptHandler).not.toContain("setRevisionBoundHistory(undefined);");
    expect(source).toContain("currentEncounter: encounterSession");
    expect(brawlingHandler).toContain("acceptEncounterSession(encounter)");
    expect(brawlingHandler).not.toContain("loadCombatHistory");
  });

  it("keeps required A1 context failures scoped to Current Action", () => {
    const source = readSource();

    expect(source).toContain("projectPlayerCombatAttackContextAvailability({");
    expect(source).toContain('code === "attack_context_unavailable"');
    expect(source).toContain("setAttackContextFailure(");
    expect(source).toContain("scenarioParticipantId: selectedParticipant.id");
    expect(source).not.toContain(
      'setCombatActionError("Attack or defender combat summary is not available.")',
    );
  });

  /**
   * #922 repair cycle 1, finding 3 — this page had a branch for the two refusals #690 split out
   * and none for the ones the server learned to describe afterwards, so a cause-aware refusal
   * landed in the generic `combatActionError` instead of the slot kept for a failure the player
   * cannot retry out of.
   *
   * This surface has no component harness, so the wiring is pinned here and the decision itself —
   * which codes a reload cannot repair, and that the server's sentence is the one shown — is
   * tested for real in `src/lib/campaigns/combatRefusalPresentation.test.ts`, the module both this
   * page and the GM panel read it from.
   */
  it("routes every refusal a reload cannot repair into the Current Action slot", () => {
    const source = readSource();

    expect(source).toContain("readCombatRefusalPayload(caughtError)");
    expect(source).toContain("getCombatRefusalSentence(refusal)");
    expect(source).toContain("setAttackContextFailure(getCombatRefusalSentence(refusal))");
    // The generic slot stays the fallback for everything else, and only for everything else.
    expect(source).toContain('"Unable to roll combat attack."');
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
    expect(source).not.toContain("selectedInvolvedDamageResolution");
    expect(source).not.toContain("selectedInvolvedDamageResultPanel");
    expect(source).toContain("events: combatHistory.activeRound.events");
    expect(source).toContain('viewer: { kind: "player" }');
    expect(source).not.toContain("selectedUninvolvedDamageResultPanel");
  });

  it("selects current phase-resolution facts for the selected participant before stale fallbacks", () => {
    const source = readSource();

    expect(source).not.toContain("selectedCurrentIncomingResolutionAttackResult");
    expect(source).not.toContain("selectedCurrentOutgoingResolutionAttackResult");
    expect(source).toContain("attackResultId: descriptor.attackResultId");
    expect(source).not.toContain("getLatestRelevantPlayerCombatAttackResult");
    expect(source).not.toContain("selectedLatestRelevantAttackResultPanel");
    expect(source).toContain("currentStepResultPresentation");
    expect(source).not.toContain(
      "currentPhaseResolution: selectedCurrentPhaseResolutionResultPanel",
    );
    expect(source).not.toContain("involvedDamage: selectedInvolvedDamageResultPanel");
    expect(source).not.toContain("latestAttack: selectedLatestRelevantAttackResultPanel");
  });

  it("lets players roll or confirm their own Combat Experience before declaring", () => {
    const source = readSource();

    expect(source).toContain("getCombatRoundRequiredCombatExperienceTrigger");
    expect(source).toContain("getCombatRoundPhaseCombatExperienceRequirement");
    expect(source).toContain("rollCombatExperienceOnServer");
    expect(source).toContain("backOutPhaseAttackOnServer");
    expect(source).toContain("backOutPhaseAttack(descriptor)");
    expect(source).toContain("getCombatRoundCombatExperienceDifficulty");
    expect(source).toContain("getParticipantCombatExperienceSkillTotalLookup");
    expect(source).toContain("buildCharacterSheetSummary");
    expect(source).toContain("formatCombatExperienceStatus");
    expect(source).not.toContain("formatCombatExperienceResultLine");
    expect(source).not.toContain("formatCombatExperienceEffectiveTableLine");
    expect(source).not.toContain("Effective CE table result");
    expect(source).toContain("Active, no roll required");
    expect(source).toContain("Attack continues, no roll required");
    expect(source).toContain("No attack made");
    expect(source).toContain("selectedCombatExperienceRequired");
    expect(source).toContain("selectedCombatExperienceTrigger");
    expect(source).toContain("visibility: encounterSession?.roleplayState?.visibility");
    expect(source).toContain("selectedCombatExperienceResult");
    expect(source).toContain("const selectedCombatExperienceSkillLookup = useMemo(");
    expect(source).toContain("sheetSummary: selectedSheetSummary");
    expect(source).toContain("selectedCombatExperienceSkillTotal");
    expect(source).toContain(
      "const selectedCombatExperienceSkillTotal = selectedCombatExperienceSkillLookup.skillTotal",
    );
    expect(source).toContain("selectedCombatExperienceDifficulty");
    expect(source).toContain("selectedPhaseCombatExperienceRequirement");
    expect(source).toContain("selectedPhaseAttackBackOutOpportunity");
    expect(source).toContain("getCombatRoundPhaseAttackBackOutOpportunity");
    expect(source).toContain("canBackOutCombatRoundPhaseAttack");
    expect(source).not.toContain("selectedCombatExperienceResultPanel");
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
    expect(source).toContain(
      'selectedAdjustDistanceProposal?.status === "awaiting_defender_response"',
    );
    expect(source).toContain("selectedPhaseAttackChoiceControls");
    expect(source).toContain("if (selectedPhaseAttackChoiceIsBackOut)");
    expect(source).toContain("void backOutPhaseAttack(descriptor)");
    expect(source).not.toContain("phaseInitiativeChoice: selectedPhaseInitiativeChoiceResultPanel");
    expect(source).not.toContain("buildPhaseInitiativeChoiceResultPanel");
    expect(source).not.toContain("secondaryButtonLabel=");
    expect(source).not.toContain("secondaryButtonDisabled=");
    expect(source).not.toContain("onSecondaryAction=");
    expect(source).toContain('case "roll_combat_experience"');
    expect(source).toContain('case "roll_round_end_health_check"');
    expect(source).toContain("rollRoundEndHealthCheckOnServer");
    expect(source).toContain("selectedHealthProgressionTask");
    expect(source).not.toContain("getCombatRoundEndHealthCheckPendingRolls");
    expect(source).toContain("selectedPendingHealthRoll");
    expect(source).toContain("rollHealthCheck(descriptor)");
    expect(source).toContain("Round-end health check");
    expect(source).toContain("Health check required");
    expect(source).toContain('selectedVisibleHealthRoll.status === "pending"');
    expect(source).toContain('"Health check rolled"');
    expect(source).toContain("Roll your Health check for round-end bleed review.");
    expect(source).toContain("formatRoundEndHealthCheckResultLine");
    expect(source).toContain('case "roll_round_end_distance_control"');
    expect(source).toContain('case "commit_round_end_distance_control"');
    expect(source).toContain("rollRoundEndDistanceControlOnServer");
    expect(source).toContain("chooseRoundEndContinuedContactDistanceOnServer");
    expect(source).toContain("Continued Contact — engagement distance");
    expect(source).toContain("No opposing distance roll is required.");
    expect(source).toContain("setContinuedContactDistanceChoice");
    expect(source).toContain("Roll your Dodge for distance control.");
    expect(source).toContain("formatDistanceControlOpponentStatus");
    expect(source).toContain("selectedDistanceControlCommittedDistance");
    expect(source).not.toContain("selectedDistanceControlResultPanel");
    expect(source).toContain("Waiting for opponent distance-control roll.");
    expect(source).toContain("Waiting for GM to commit distance control.");
    expect(source).toContain("Distance control committed: distance");
    expect(source).toContain('aria-label="Your accepted distance-control result"');
    expect(source).toContain("selectedDistanceControlOwnCalculation");
    expect(source).not.toContain("opponentSide.desiredDistance");
    expect(source).not.toContain("opponentSide.result");
    expect(source).not.toContain("combatExperienceStatusText");
    expect(source).toContain("combatExperienceValidationMessage");
    expect(source).toContain("rollCombatExperience(descriptor)");
    expect(source).toContain("continuePhaseAttackOnServer");
    expect(source).toContain("Skill total {selectedCombatExperienceSkillTotal}");
    expect(source).toContain("Difficulty {selectedCombatExperienceDifficulty}");
    expect(source).toContain("Incoming attacker(s):");
    expect(source).toContain("selectedPhaseCombatExperienceThreats");
    expect(source).toContain("selectedCombatExperienceSkillLookup.warning");
    expect(source).toContain("selectedCombatExperienceRequired");
    expect(source).toContain(
      "controlsDisabled || playerDeclarationLocked || selectedCombatExperienceRequired",
    );
    expect(source).not.toContain("const playerActionButtonDisabled =");
    expect(source).toContain("resolveCombatTaskCommandContext({");
    expect(source).toContain("presentation: currentActionPresentation");
    expect(source).toContain('case "roll_combat_experience"');
    expect(source).toContain(
      'requiredFields: ["executionGroupId", "expectedRevision", "participantId", "taskId"]',
    );
    expect(source).toContain("Combat Experience");
    expect(source).not.toContain("Phase initiative choices");
    expect(source).not.toContain("Waiting for GM to roll Combat Experience.");
  });

  it("keeps phase Combat Experience errors recoverable and invokes the projected CE task", () => {
    const source = readSource();
    const dispatchStart = source.indexOf('case "submit_phase_initiative_choice"');
    const dispatchEnd = source.indexOf('case "roll_combat_experience"', dispatchStart);
    const phaseChoiceDispatch = source.slice(dispatchStart, dispatchEnd);
    const rollStart = source.indexOf(
      "async function rollCombatExperience(descriptor: CurrentActionCommandDescriptor)",
    );
    const rollEnd = source.indexOf("async function", rollStart + 20);
    const rollHandler = source.slice(rollStart, rollEnd);
    const catchStart = rollHandler.indexOf("} catch (caughtError) {");
    const catchHandler = rollHandler.slice(catchStart);

    expect(source).toContain("const [combatActionError, setCombatActionError]");
    expect(source).toContain(
      "{combatActionError ? <div style={panelStyle}>{combatActionError}</div> : null}",
    );
    expect(phaseChoiceDispatch).toContain("selectedPhaseCombatExperienceRequirement");
    expect(phaseChoiceDispatch).toContain("rollCombatExperience(descriptor)");
    expect(rollHandler).toContain("setCombatActionError(");
    expect(catchHandler).not.toContain("setError(");
  });

  it("opts the live player modifier rows in to duration labels, and no other surface does", () => {
    const rowsCall = readSource().match(/buildPlayerCombatModifierRows\(\{[\s\S]*?\}\),/);

    expect(rowsCall?.[0]).toContain("includeEntryDurations: true");
    for (const other of [
      "../../../../../../../../src/features/combat-round-manager/CombatRoundManagerPanel.tsx",
      "../../../../../../../../src/features/combat-history/components/PlayerCombatHistoryInspector.tsx",
    ]) {
      expect(readFileSync(join(dirname(sourcePath), other), "utf8")).not.toContain(
        "includeEntryDurations",
      );
    }
  });

  /**
   * Forgejo #1011 — the mount-time revision race.
   *
   * The retry policy itself is measured where it lives, in
   * `src/lib/campaigns/playerCombatRefresh.test.ts`, and the surfaces are measured by the forced
   * race against a running stack. What these three cases pin is this file's half: that the mount
   * no longer carries its own immediate single retry, that the error surface carries a way out,
   * and that the refresh copy says only what the branch renders.
   */
  it("retries a mount-time revision race instead of terminating on it", () => {
    const source = readSource();

    expect(source).toContain("adoptCoherentPlayerCombatSnapshot({");
    expect(source).toContain("isAbandoned: () => cancelled || encounterRequestIdRef.current !==");
    // The immediate single retry this replaced. The writer holds a 1233 ms chain of writes, so one
    // extra attempt with no backoff lands inside the same chain.
    expect(source).not.toContain('first.kind === "stale" ? await loadSnapshot() : first');
  });

  it("keeps the player's confirmed state on screen through a history revision race", () => {
    const source = readSource();
    const ensureHistory = source.slice(
      source.indexOf("const ensureCombatHistory = useCallback("),
      source.indexOf("const acceptEncounterSession = useCallback("),
    );

    expect(ensureHistory).toContain("if (isPlayerCombatHistoryRevisionMismatch(caughtError)) {");
    // The copy promised a degraded display the branch never rendered: it told the player the
    // latest confirmed state was on screen while the error branch rendered only that sentence.
    expect(source).not.toContain("Showing the latest confirmed state");
    expect(ensureHistory).toContain('setError("Combat view could not refresh.")');
  });

  it("gives the error surface a retry control that re-runs the load", () => {
    const source = readSource();
    // Anchored on the line start: the unanchored forms also match nested branches further up.
    const errorBranch = source.slice(
      source.indexOf("\n  if (error) {"),
      source.indexOf("\n  if (!projection) {"),
    );

    expect(errorBranch).toContain("Try again");
    expect(errorBranch).toContain("setRecoveryAttempt((current) => current + 1)");
    expect(errorBranch).toContain("setError(undefined)");
    // Without the dependency the control would render and change nothing. Read from the dependency
    // array of the slow-context effect itself rather than from a formatted spelling of it.
    const afterSlowContext = source.slice(source.indexOf("async function loadSlowContext()"));
    const slowContextDependencies = afterSlowContext.slice(0, afterSlowContext.indexOf("]);") + 3);

    expect(slowContextDependencies).toContain("recoveryAttempt");
  });
});
