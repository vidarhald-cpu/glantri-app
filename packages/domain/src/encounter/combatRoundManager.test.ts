import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";
import type { HitLocationTarget } from "./hitLocation";

import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEPS,
  COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY,
  advanceCombatRoundPhaseResolutionSubstepForParticipant,
  advanceCombatRoundStep,
  backOutCombatRoundPhaseAttack,
  buildCombatRoundDamageArmorCoverageFromEquipmentState,
  buildCombatRoundDamageResult,
  buildCombatRoundCommandEnvelope,
  buildCombatRoundPhaseResolutionResult,
  buildCombatRoundAttackRollResult,
  buildCombatRoundDeclaredAttackOpportunities,
  buildCombatRoundInspector,
  buildCombatRoundInitiativeResult,
  canBackOutCombatRoundPhaseAttack,
  canClearCombatRoundStep,
  canPlayerRollCombatAttack,
  canPlayerSubmitCombatDeclaration,
  canPlayerRollCombatInitiative,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  completeRemainingCombatRoundStep,
  combatRoundInitiativeCommitUndoFactsSchema,
  combatRoundStateSchema,
  combatRoundStepSnapshotSchema,
  combatRoundParticipantHasExecutablePhaseAttack,
  combatRoundParticipantHasPhaseAttack,
  combatRoundParticipantWasAttackedInPhase,
  decideCombatRoundDoubleAttackPhase2,
  commitCombatRoundPhaseDamage,
  completeCombatRoundPhaseResolutionForParticipant,
  combatRoundAttackRollResultSchema,
  commitCombatRoundPhaseInitiativeResolution,
  continueCombatRoundPhaseAttack,
  ensureCombatRoundEndReviewPrepared,
  evaluateCombatExperienceResult,
  getCombatRoundPhaseResolutionOrder,
  getCombatRoundPhaseResolutionStatus,
  getCombatRoundPhaseAttackCandidates,
  getPlayerCombatCurrentRollAction,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundInitiativePositions,
  getCombatRoundInitiativeRanks,
  getCombatRoundAttackResultsForParticipantPhase,
  getCombatRoundAttackResultForOpportunity,
  getCombatRoundAttackResultId,
  getCanonicalAttackOpportunityIdentity,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundDisplayPhaseResolutionResultForParticipantPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundParticipantPhaseStepStatus,
  getCombatRoundPhaseDamageCommitReadiness,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  getCombatRoundTimelineRoundStates,
  getLatestCombatEventSummary,
  getCombatRoundEffectiveDamageResult,
  getCombatRoundArmorCriticalModifierForDamageResult,
  getCombatRoundDamageSubstate,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundRequiredCombatExperienceTrigger,
  getCombatRoundPhaseAttackBackOutOpportunity,
  getCombatRoundPhaseCombatExperienceRequirement,
  getCombatRoundPhaseCombatExperienceDetectionReport,
  getCombatRoundPhaseInitiativeChoice,
  getCombatRoundPhaseInitiativeChoiceStatuses,
  getReactiveAttackPhase2InitiativeModifier,
  getCombatRoundEndDistanceControlPendingRollCount,
  getCombatRoundEndDistanceProposalLifecycle,
  getCombatRoundEndHealthCheckPendingRollCount,
  getCombatRoundEndHealthCheckPendingRolls,
  getCombatRoundEndHealthAutomationReviewDisposition,
  getNextCombatRoundEndTask,
  getFirstCombatStartExperienceRequiredParticipantId,
  getFirstCombatRoundPhaseCombatExperienceRequiredParticipantId,
  getFirstCombatRoundDeclarationRequiredParticipantId,
  getCombatRoundStartNextRoundBlocker,
  getCombatExperienceSkillTotalFromSnapshot,
  getParticipantCombatExperienceSkillTotalLookup,
  getPreviousCombatRoundStep,
  initializeCombatRoundState,
  isCombatRoundCombatExperienceWindowOpen,
  isCombatRoundEndReviewComplete,
  isCombatRoundPhaseCombatExperienceRollRequired,
  isCombatRoundPhaseInitiativeResolutionOpen,
  mapHitLocationAndDirectionToArmorRegion,
  parseCombatRoundArmorCoverageLabel,
  ensureCombatRoundPhaseResolutionResultsForPhase,
  initializeCombatRoundPhaseResolutionCursor,
  isCombatRoundPhaseInitiativeComplete,
  recordCombatRoundDeclaration,
  recordCombatRoundAttackResult,
  recordCombatRoundDamageReviewPlaceholder,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundCriticalRoll,
  reviewCombatRoundDamageResult,
  recordCombatRoundInitiative,
  recordCombatRoundNoAttackPhaseReview,
  recordCombatRoundParryResult,
  recordCombatRoundParryResolution,
  synchronizeCombatRoundFeintDeclarationTarget,
  recordCombatRoundParticipantStepReview,
  prepareCombatRoundEndReview,
  commitCombatRoundEndDistanceControl,
  commitCombatRoundEndParticipantReview,
  removeCombatRoundCombatExperienceEffects,
  removeCombatRoundCombatExperienceCombatContextModifiers,
  restoreCombatRoundBackOutCombatContextModifiers,
  removeCombatRoundEndHealthCheckEffects,
  removeCombatRoundEndParticipantReviewEffects,
  rollCombatRoundCombatExperience,
  hasCombatRoundCombatExperienceRoll,
  holdCombatRoundForGmBacktrack,
  rollCombatRoundEndHealthCheck,
  rollCombatRoundEndDistanceControl,
  removeCombatRoundCommittedDamageEffects,
  rollOpenEndedD6,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundActiveParticipant,
  setCombatRoundParticipantInitiative,
  setCombatRoundParticipantStepStatus,
  skipCombatRoundCurrentPhaseAction,
  sortCombatRoundParticipantsByInitiative,
  undoLatestCombatRoundCommand,
  type CombatRoundEndDistanceRollResult,
} from "./combatRoundManager";
import { combatStepEventSchema } from "./combatStepEventSchema";
import {
  applyCombatActionGeneratedModifiers,
  DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
  REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
} from "./combatActionModifiers";
import { encounterSessionSchema } from "./session";
import { getDistanceBetween, makeDistancePairKey, setDistanceBetween } from "./combatDistance";
import type { CombatRoundStepSnapshot } from "./combatRoundManager";
import { combatEffectsStateSchema, type CombatEffectsState } from "./combatEffects";
import {
  buildLiveCombatModifierContributionProjection,
  mergePersistentCombatEffectModifiers,
} from "./combatModifierProjection";
import {
  buildCombatExperiencePersistentLifecycle,
  buildDamagePersistentLifecycle,
} from "./combatPersistentModifierLifecycle";
import type { CombatModifierContribution } from "./combatModifierContributions";
import {
  advanceCombatProgressionBoundary,
  buildCombatProgressionProjection,
} from "./combatProgressionProjection";
import {
  resolveCombatAttackPhaseDefensivePenalties,
  resolveCombatAttackPhaseDefensivePenalty,
} from "./combatAttackPhasePenalty";

function participant(input: {
  id: string;
  initiative?: number;
  label: string;
}): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: input.initiative ?? 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

function encounter(input: Partial<EncounterSession> = {}): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 3,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  });
}

function roundEndDistanceRollResult(input: {
  baseSkill: number;
  dieResult: number;
  finalTotal?: number;
  generalFatigueModifier?: number;
  opponentParticipantId: string;
  participantId: string;
  percentageAdjustment?: number;
  rolledAt: string;
  rolledBy: "gm_proxy" | "player";
}): CombatRoundEndDistanceRollResult {
  const finalTotal = input.finalTotal ?? input.baseSkill + input.dieResult;
  const derivedIntegerAdjustment = finalTotal - input.baseSkill - input.dieResult;
  return {
    dodgeSkillTotal: input.baseSkill,
    finalTotal,
    generalFatigueModifier: input.generalFatigueModifier ?? 0,
    openEndedD10s: [],
    rolledAt: input.rolledAt,
    rolledAtRound: 3,
    rolledBy: input.rolledBy,
    rollD20: input.dieResult,
    rollTotal: input.dieResult,
    skillContestCalculation: {
      baseSkill: input.baseSkill,
      calculationId: `round-end-distance:${input.participantId}:${input.rolledAt}`,
      completeness: "partial",
      contestType: "round_end_adjust_distance",
      derivedIntegerAdjustment,
      finalResult: finalTotal,
      governingStat: { id: "dex", label: "Dexterity", value: input.baseSkill },
      missingContributionPoints: ["movement_mm", "encumbrance"],
      openEndedDie: {
        openEndedD10s: [],
        rollD20: input.dieResult,
        rollTotal: input.dieResult,
      },
      opponentParticipantId: input.opponentParticipantId,
      participantId: input.participantId,
      percentageContributions: [],
      preDieTotal: input.baseSkill + derivedIntegerAdjustment,
      role: "contestant",
      skill: { id: "dodge", label: "Dodge", totalXp: 0 },
      totalPercentageAdjustment: input.percentageAdjustment ?? 0,
      visibility: "roller_and_gm",
    },
  };
}

function stepSnapshot(
  input: Partial<CombatRoundStepSnapshot> & Pick<CombatRoundStepSnapshot, "participantId" | "step">,
): CombatRoundStepSnapshot {
  return {
    ...input,
    committedAt: "2026-01-01T00:02:00.000Z",
    id: `snapshot-${input.participantId}-${input.step}`,
    participantId: input.participantId,
    participantLabel: input.participantId,
    roundNumber: 3,
  };
}

function advanceToStep(
  state: ReturnType<typeof initializeCombatRoundState>,
  step: (typeof COMBAT_ROUND_STEPS)[number],
): ReturnType<typeof initializeCombatRoundState> {
  let current = state;

  for (let guard = 0; guard < 50 && current.currentStep !== step; guard += 1) {
    current = advanceCombatRoundStep(current);
  }

  if (current.currentStep !== step) {
    throw new Error(
      `Could not advance combat round to ${step}; stopped at ${current.currentStep}.`,
    );
  }

  return current;
}

function advanceBoundary(
  state: ReturnType<typeof initializeCombatRoundState>,
  expectedBoundary: Parameters<typeof advanceCombatProgressionBoundary>[0]["expectedBoundary"],
  targetBoundary: Parameters<typeof advanceCombatProgressionBoundary>[0]["targetBoundary"],
): ReturnType<typeof initializeCombatRoundState> {
  const boundaryTask = buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .find(
      (task) =>
        task.kind === "gm_advance_boundary" &&
        task.transition?.currentBoundary === expectedBoundary &&
        task.transition.targetBoundary === targetBoundary,
    );
  if (!boundaryTask) throw new Error("Expected an executable boundary task in the test fixture.");
  return advanceCombatProgressionBoundary({
    command: {
      createdAt: "2026-01-01T00:10:00.000Z",
      createdByUserId: "gm-1",
    },
    expectedBoundary,
    expectedCommandType: boundaryTask.expectedCommand as
      | "advance_combat_boundary"
      | "complete_round",
    expectedExecutionGroupId: boundaryTask.executionGroupId,
    expectedTaskId: boundaryTask.id,
    state,
    targetBoundary,
  });
}

function openCombatExperienceWindow(
  state: ReturnType<typeof initializeCombatRoundState>,
  difficulty = COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY,
): ReturnType<typeof initializeCombatRoundState> {
  return setCombatRoundCombatExperienceDifficulty({
    difficulty,
    state,
  });
}

function prepareCleanRoundEndReview(
  state: ReturnType<typeof initializeCombatRoundState>,
): ReturnType<typeof initializeCombatRoundState> {
  return prepareCombatRoundEndReview({
    command: {
      createdAt: "2026-01-01T00:09:00.000Z",
      createdByUserId: "gm-1",
    },
    state,
  });
}

function completeCleanRoundEndReview(
  state: ReturnType<typeof initializeCombatRoundState>,
): ReturnType<typeof initializeCombatRoundState> {
  const reviewed = prepareCleanRoundEndReview(state);

  return reviewed.participants.reduce((current, participant, index) => {
    const review = current.roundEndReview?.participantReviews[participant.participantId];

    if (review?.status === "complete") {
      return current;
    }

    return commitCombatRoundEndParticipantReview({
      command: {
        createdAt: `2026-01-01T00:09:${String(index + 1).padStart(2, "0")}.000Z`,
        createdByUserId: "gm-1",
      },
      participantId: participant.participantId,
      scenarioParticipantId: `scenario-${participant.participantId}`,
      state: current,
    }).state;
  }, reviewed);
}

describe("canonical Dodge resolution in round-end distance control", () => {
  it("uses normalized General/Fatigue and Dodge-scoped contributions when rolling", () => {
    let state = initializeCombatRoundState({ encounter: encounter() });
    state = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            { desiredDistance: 3, source: "gm_proxy", targetParticipantId: "guard" },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: state.roundNumber,
      },
      participantId: "gladiator",
      state,
      submittedBy: "gm",
    });
    state = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            { desiredDistance: 1, source: "gm_proxy", targetParticipantId: "gladiator" },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: state.roundNumber,
      },
      participantId: "guard",
      state,
      submittedBy: "gm",
    });
    state = {
      ...state,
      currentCursor: { participantId: "gladiator", roundNumber: state.roundNumber, step: "SU" },
      currentStep: "round_summary",
      selectedParticipantId: "gladiator",
      selectedStep: "round_summary",
    };

    const contribution = (
      id: string,
      ownerParticipantId: string,
      value: number,
      applicability: CombatModifierContribution["applicability"] = { skillId: "dodge" },
      bucket: CombatModifierContribution["bucket"] = "general_fatigue",
    ): CombatModifierContribution => ({
      id,
      schemaVersion: 1,
      ownerParticipantId,
      sourceKind: "persistent_effect",
      sourceId: id,
      bucket,
      value,
      label: id,
      applicability,
      lifetime: { kind: "persistent", status: "active" },
      editPolicy: "source_only",
      readOnly: true,
    });
    const participantInputs = {
      gladiator: {
        dodgeSkillTotal: 8,
        modifierContributions: [
          contribution("gladiator-fatigue", "scenario-gladiator", -1),
          contribution(
            "gladiator-pair",
            "scenario-gladiator",
            3,
            {
              pairKey: "scenario-gladiator::scenario-guard",
              skillId: "dodge",
            },
            "skill_ob",
          ),
        ],
        modifierEncounterId: "encounter-1",
        modifierOwnerParticipantId: "scenario-gladiator",
      },
      guard: {
        dodgeSkillTotal: 4,
        modifierContributions: [contribution("guard-dodge", "scenario-guard", 2)],
        modifierEncounterId: "encounter-1",
        modifierOwnerParticipantId: "scenario-guard",
      },
    };
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: { distanceControl: participantInputs.gladiator },
        guard: { distanceControl: participantInputs.guard },
      },
      state,
    });
    const proposal = reviewed.roundEndReview?.proposedDistances[0];
    expect(proposal).toBeDefined();

    const rolled = rollCombatRoundEndDistanceControl({
      command: { createdAt: "2026-01-01T00:11:00.000Z" },
      distanceProposalId: proposal?.id,
      participantId: "gladiator",
      result: roundEndDistanceRollResult({
        baseSkill: 8,
        dieResult: 10,
        finalTotal: 20,
        generalFatigueModifier: -1,
        opponentParticipantId: "guard",
        participantId: "gladiator",
        percentageAdjustment: 2,
        rolledAt: "2026-01-01T00:11:00.000Z",
        rolledBy: "player",
      }),
      state: reviewed,
    });

    expect(rolled.state.roundEndReview?.proposedDistances[0]?.participantA.result).toMatchObject({
      dodgeSkillTotal: 8,
      generalFatigueModifier: -1,
      finalTotal: 20,
    });
  });
});

describe("canonical GM bulk step completion", () => {
  function stateWithDeclarations(input: {
    gladiatorActionId?: string;
    scyrianActionId?: string;
    step: "initiative_phase_1" | "review_action_modifiers";
  }) {
    const initial = initializeCombatRoundState({
      encounter: encounter({
        participants: [
          participant({ id: "gladiator", label: "The Gladiator" }),
          participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
        ],
      }),
    });
    const declared = declareTestRoundAction({
      actionId: input.scyrianActionId ?? "parry",
      participantId: "scyrian",
      phase1Target: "scenario-gladiator",
      phase2Target: "scenario-gladiator",
      state: declareTestRoundAction({
        actionId: input.gladiatorActionId ?? "parry",
        participantId: "gladiator",
        phase1Target: "scenario-scyrian",
        phase2Target: "scenario-scyrian",
        state: initial,
      }),
    });
    return advanceToStep(declared, input.step);
  }

  it("accepts every unchanged valid modifier proposal in one command", () => {
    const before = stateWithDeclarations({ step: "review_action_modifiers" });
    const result = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state: before,
    });

    expect(result.completedParticipantIds).toEqual(["gladiator", "scyrian"]);
    expect(
      result.state.participants.map((entry) => entry.stepStatuses.review_action_modifiers),
    ).toEqual(["gmEdited", "gmEdited"]);
    expect(result.state.participants.map((entry) => entry.declaration?.submittedBy)).toEqual([
      "gm",
      "gm",
    ]);
    expect(result.state.commands).toHaveLength(before.commands.length + 1);
    expect(result.command.type).toBe("complete_remaining_step");
    expect(result.command.facts.resolutionType).toBe("accepted_unchanged");
    expect(buildCombatRoundCommandEnvelope({ state: result.state }).latestEvent).toMatchObject({
      shortTitle: "Remaining modifier review completed",
      summaryText: expect.stringContaining("GM completed remaining modifier review."),
    });
    const nextTask = buildCombatProgressionProjection(result.state)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.state === "executable");
    expect(nextTask).toMatchObject({
      expectedCommand: "advance_combat_boundary",
      kind: "gm_advance_boundary",
    });
  });

  it("stops modifier review at the first invalid declaration", () => {
    const valid = stateWithDeclarations({ step: "review_action_modifiers" });
    const before = combatRoundStateSchema.parse({
      ...valid,
      participants: valid.participants.map((entry) =>
        entry.participantId === "scyrian" ? { ...entry, declaration: undefined } : entry,
      ),
    });
    const result = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state: before,
    });

    expect(result.completedParticipantIds).toEqual(["gladiator"]);
    expect(result.stoppedAtParticipantId).toBe("scyrian");
    expect(result.state.currentCursor?.participantId).toBe("scyrian");
    expect(result.state.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("bulk-skips one timing-bearing action when no competing phase action makes order consequential", () => {
    const before = stateWithDeclarations({
      gladiatorActionId: "parry",
      scyrianActionId: "attack_parry",
      step: "initiative_phase_1",
    });
    const result = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state: before,
    });

    expect(result.completedParticipantIds).toEqual(["gladiator", "scyrian"]);
    expect(result.stoppedAtParticipantId).toBeUndefined();
    expect(result.state.participants.map((participant) => participant.initiatives.phase1)).toEqual([
      expect.objectContaining({
        resolutionType: "bulk_skipped",
        rolls: [],
        total: 0,
      }),
      expect.objectContaining({
        resolutionType: "bulk_skipped",
        rolls: [],
        total: 0,
      }),
    ]);
    expect(
      result.state.participants.map((participant) => participant.stepStatuses.initiative_phase_1),
    ).toEqual(["skipped", "skipped"]);
    const nextTask = buildCombatProgressionProjection(result.state)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.state === "executable");
    expect(nextTask).toMatchObject({
      expectedCommand: "commit_phase_initiative_resolution",
      kind: "commit_initiative",
    });
  });

  it("stops after eligible initiative when the next participant has an unresolved ordered maneuver", () => {
    const before = stateWithDeclarations({
      gladiatorActionId: "parry",
      scyrianActionId: "feint_attack",
      step: "initiative_phase_1",
    });
    const result = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state: before,
    });

    expect(result.completedParticipantIds).toEqual(["gladiator"]);
    expect(result.blocker).toEqual({
      code: "initiative_roll_required",
      message:
        "Bulk initiative stopped at Scyrian cavalry guy: this action requires an initiative roll.",
      participantId: "scyrian",
    });
    expect(result.stoppedAtParticipantId).toBe("scyrian");
    expect(result.state.currentCursor?.participantId).toBe("scyrian");
    expect(result.state.participants[0]?.initiatives.phase1).toMatchObject({
      resolutionType: "bulk_skipped",
      rolls: [],
      total: 0,
    });
    expect(result.state.participants[1]?.initiatives.phase1).toBeUndefined();
    expect(buildCombatRoundCommandEnvelope({ state: result.state }).currentTask).toMatchObject({
      participantId: "scyrian",
      step: "initiative_phase_1",
    });
  });

  it("preserves player-owned initiative as a precise bulk blocker", () => {
    const before = stateWithDeclarations({ step: "initiative_phase_1" });
    const result = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      playerOwnedParticipantIds: new Set(["scyrian"]),
      state: before,
    });

    expect(result.completedParticipantIds).toEqual(["gladiator"]);
    expect(result.blocker).toEqual({
      code: "initiative_player_owned",
      message: "Bulk initiative stopped at Scyrian cavalry guy: initiative is player-owned.",
      participantId: "scyrian",
    });
    expect(result.state.participants[1]?.initiatives.phase1).toBeUndefined();

    expect(() =>
      completeRemainingCombatRoundStep({
        command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
        phase: "phase1",
        playerOwnedParticipantIds: new Set(["gladiator"]),
        state: before,
      }),
    ).toThrow("Bulk initiative stopped at The Gladiator: initiative is player-owned.");
  });

  it("resolves all decision-free initiative and undo restores the exact prior task", () => {
    const before = stateWithDeclarations({ step: "initiative_phase_1" });
    const result = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state: before,
    });
    const undone = undoLatestCombatRoundCommand({ state: result.state });

    expect(result.completedParticipantIds).toEqual(["gladiator", "scyrian"]);
    expect(isCombatRoundPhaseInitiativeComplete({ phase: "phase1", state: result.state })).toBe(
      true,
    );
    expect(undone).toEqual(before);
  });
});

describe("canonical attack opportunity lineage", () => {
  const emptyContext = {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
  };

  it("ignores persisted generic attack opportunities owned by an unsupported legacy declaration", () => {
    const legacyOpportunity = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "attack_parry",
      participantId: "hero",
      phaseContexts: { phase1: { ...emptyContext, targetParticipantId: "guard" } },
      roundNumber: 1,
      sources: {
        phase1: {
          attackModeId: "mode-1",
          sourceKind: "unarmed",
          weaponSourceSlot: "virtual",
          weaponTemplateId: "virtual-weapon-template-punch",
        },
      },
    })[0]!;
    const state = combatRoundStateSchema.parse({
      currentStep: "phase_1_actions",
      participants: [
        {
          declaration: {
            actionId: "counterattack",
            attackOpportunities: [legacyOpportunity],
            phaseContexts: { phase1: { ...emptyContext, targetParticipantId: "guard" } },
            roundNumber: 1,
            submittedBy: "gm",
          },
          label: "Hero",
          participantId: "hero",
          stepStatuses: { select_actions: "gmEdited" },
        },
        { label: "Guard", participantId: "guard" },
      ],
      roundNumber: 1,
    });

    expect(getCombatRoundPhaseAttackCandidates({ phase: "phase1", state })).toEqual([]);
    expect(getFirstCombatRoundDeclarationRequiredParticipantId(state)).toBe("hero");
  });

  it("creates stable, distinct Double Attack identities with explicit sources and indices", () => {
    const input = {
      actionId: "double_attack",
      participantId: "hero",
      phaseContexts: {
        phase1: { ...emptyContext, targetParticipantId: "guard" },
        phase2: { ...emptyContext, targetParticipantId: "guard" },
      },
      roundNumber: 3,
      sources: {
        phase1: {
          attackModeId: "mode-2",
          itemId: "hero-broad-sword",
          sourceKind: "weapon" as const,
          weaponInstanceId: "hero-broad-sword",
          weaponSourceSlot: "primary" as const,
          weaponTemplateId: "weapon-template-broad-sword",
        },
        phase2: {
          attackModeId: "mode-2",
          itemId: "hero-broad-sword",
          sourceKind: "weapon" as const,
          weaponInstanceId: "hero-broad-sword",
          weaponSourceSlot: "primary" as const,
          weaponTemplateId: "weapon-template-broad-sword",
        },
      },
    };

    const opportunities = buildCombatRoundDeclaredAttackOpportunities(input);
    const reloaded = buildCombatRoundDeclaredAttackOpportunities(input);
    const identities = opportunities.map((opportunity) =>
      getCanonicalAttackOpportunityIdentity({
        actionId: input.actionId,
        attackerParticipantId: input.participantId,
        opportunity,
        roundNumber: input.roundNumber,
      }),
    );

    expect(reloaded).toEqual(opportunities);
    expect(opportunities.map((opportunity) => opportunity.id)).toEqual([
      "round:3:participant:hero:phase1:attack_1",
      "round:3:participant:hero:phase2:attack_2",
    ]);
    expect(identities).toMatchObject([
      {
        attackIndex: 1,
        attackModeId: "mode-2",
        defenderParticipantId: "guard",
        weaponSourceId: "weapon:hero-broad-sword",
      },
      {
        attackIndex: 2,
        attackModeId: "mode-2",
        defenderParticipantId: "guard",
        weaponSourceId: "weapon:hero-broad-sword",
      },
    ]);
  });

  it("keeps two same-phase attacks against one defender isolated by opportunity", () => {
    const firstOpportunity = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "attack_parry",
      participantId: "hero",
      phaseContexts: { phase1: { ...emptyContext, targetParticipantId: "guard" } },
      roundNumber: 1,
      sources: {
        phase1: {
          attackModeId: "mode-1",
          sourceKind: "unarmed",
          weaponSourceSlot: "virtual",
          weaponTemplateId: "virtual-weapon-template-punch",
        },
      },
    })[0]!;
    const secondOpportunity = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "attack_parry",
      participantId: "rival",
      phaseContexts: { phase1: { ...emptyContext, targetParticipantId: "guard" } },
      roundNumber: 1,
      sources: {
        phase1: {
          attackModeId: "mode-1",
          sourceKind: "unarmed",
          weaponSourceSlot: "virtual",
          weaponTemplateId: "virtual-weapon-template-kick",
        },
      },
    })[0]!;
    const baseState = combatRoundStateSchema.parse({
      currentStep: "phase_1_actions",
      participants: [
        {
          declaration: {
            actionId: "attack_parry",
            attackOpportunities: [firstOpportunity],
            phaseContexts: { phase1: { ...emptyContext, targetParticipantId: "guard" } },
            roundNumber: 1,
            submittedBy: "player",
          },
          label: "Hero",
          participantId: "hero",
        },
        {
          declaration: {
            actionId: "attack_parry",
            attackOpportunities: [secondOpportunity],
            phaseContexts: { phase1: { ...emptyContext, targetParticipantId: "guard" } },
            roundNumber: 1,
            submittedBy: "player",
          },
          label: "Rival",
          participantId: "rival",
        },
        { label: "Guard", participantId: "guard" },
      ],
      roundNumber: 1,
    });
    const record = (
      state: typeof baseState,
      participantId: "hero" | "rival",
      opportunity: typeof firstOpportunity,
      weaponName: string,
    ) =>
      recordCombatRoundAttackResult({
        participantId,
        result: buildCombatRoundAttackRollResult({
          actionId: "attack_parry",
          attackOpportunityId: opportunity.id,
          attackerParticipantId: participantId,
          defenderDb: 10,
          defenderParticipantId: "guard",
          ob: 10,
          phase: "phase1",
          rollD20: 10,
          rollTotal: 10,
          rolledAt: `2026-01-01T00:0${participantId === "hero" ? "1" : "2"}:00.000Z`,
          weaponName,
        }),
        state,
        submittedBy: "player",
      });

    const afterFirst = record(baseState, "hero", firstOpportunity, "Punch");
    const afterSecond = record(afterFirst, "rival", secondOpportunity, "Kick");
    const firstResult = getCombatRoundAttackResultForOpportunity({
      opportunityId: firstOpportunity.id,
      state: afterSecond,
    });
    const secondResult = getCombatRoundAttackResultForOpportunity({
      opportunityId: secondOpportunity.id,
      state: afterSecond,
    });

    expect(firstResult).toMatchObject({
      attackOpportunityId: firstOpportunity.id,
      attackerParticipantId: "hero",
      defenderParticipantId: "guard",
      weaponSourceId: "unarmed:virtual-weapon-template-punch",
    });
    expect(secondResult).toMatchObject({
      attackOpportunityId: secondOpportunity.id,
      attackerParticipantId: "rival",
      defenderParticipantId: "guard",
      weaponSourceId: "unarmed:virtual-weapon-template-kick",
    });
    expect(
      firstResult && getCombatRoundAttackResultId({ result: firstResult, roundNumber: 1 }),
    ).not.toBe(
      secondResult && getCombatRoundAttackResultId({ result: secondResult, roundNumber: 1 }),
    );
  });
});

function declareRoundAction(input: {
  actionId: string;
  participantId: string;
  state: ReturnType<typeof initializeCombatRoundState>;
}): ReturnType<typeof initializeCombatRoundState> {
  const targetParticipantId = input.participantId === "gladiator" ? "guard" : "gladiator";

  return recordCombatRoundDeclaration({
    declaration: {
      actionId: input.actionId,
      phaseContexts: {
        phase1: testPhaseContext(targetParticipantId),
        phase2: testPhaseContext(targetParticipantId),
      },
      roundNumber: 3,
    },
    participantId: input.participantId,
    state: input.state,
    submittedBy: "gm",
  });
}

function testPhaseContext(targetParticipantId: string) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId,
  };
}

function committedAttackPenaltiesFor(input: {
  participantId: string;
  state: Parameters<typeof getCombatRoundPhaseAttackCandidates>[0]["state"];
}) {
  const opportunities = (["phase1", "phase2"] as const).flatMap((phase) =>
    getCombatRoundPhaseAttackCandidates({ phase, state: input.state }).filter(
      (opportunity) => opportunity.participantId === input.participantId,
    ),
  );
  return resolveCombatAttackPhaseDefensivePenalties({
    commitment: "committed",
    opportunities,
    participantId: input.participantId,
    roundNumber: input.state.roundNumber,
  });
}

function combatEffectsWith(
  effects: Array<Partial<CombatEffectsState["effects"][number]> & { id: string }>,
): CombatEffectsState {
  return {
    effects: effects.map((effect) => ({
      createdAt: "2026-01-01T00:00:00.000Z",
      damage: 0,
      effectGroup: "none",
      generalDamage: 0,
      roundNumber: 3,
      sourceEventId: "event-1",
      status: "active",
      targetParticipantId: "scenario-gladiator",
      type: "special",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...effect,
    })),
    events: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        description: "Test effect",
        id: "event-1",
        sourceLabel: "Test effect",
        sourceType: "manual",
        targetParticipantId: "scenario-gladiator",
      },
    ],
  };
}

function fixedChestLocationSelection() {
  return {
    hitLocationRolls: [12],
    hitLocationSelectionReason: "single_roll" as const,
    selectedHitLocation: "chest" as const,
    selectedHitLocationRoll: 12,
  };
}

function recordTestHitLocation(input: {
  attackResult: ReturnType<typeof buildCombatRoundAttackRollResult>;
  command?: {
    createdAt?: string;
    createdByUserId?: string;
  };
  hitLocationRolls?: number[];
  rolledByParticipantId?: string;
  state: ReturnType<typeof initializeCombatRoundState>;
  targetLocation?: HitLocationTarget;
  updatedAt?: string;
}): ReturnType<typeof initializeCombatRoundState> {
  const updatedAt = input.updatedAt ?? input.command?.createdAt ?? "2026-01-01T00:04:30.000Z";

  return recordCombatRoundHitLocationRoll({
    attackResult: input.attackResult,
    command: input.command
      ? {
          createdAt: input.command.createdAt ?? updatedAt,
          createdByUserId: input.command.createdByUserId,
        }
      : undefined,
    hitLocationRolls: input.hitLocationRolls ?? [12],
    rolledByParticipantId: input.rolledByParticipantId ?? input.attackResult.attackerParticipantId,
    state: input.state,
    submittedBy: "gm",
    targetLocation: input.targetLocation,
    updatedAt,
  });
}

function preparePhaseResolutionState(input: {
  guardAlreadyDone?: boolean;
  guardActionId: string;
  gladiatorActionId: string;
  phase: "phase1" | "phase2";
  reactivePhase1Incoming?: boolean;
}): ReturnType<typeof initializeCombatRoundState> {
  const withDeclarations = declareRoundAction({
    actionId: input.guardActionId,
    participantId: "guard",
    state: declareRoundAction({
      actionId: input.gladiatorActionId,
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    }),
  });
  const withReactiveIncoming =
    input.phase === "phase2" &&
    input.reactivePhase1Incoming !== false &&
    (input.guardActionId === "parry_attack" || input.gladiatorActionId === "parry_attack")
      ? addReactivePhase1IncomingAttacksForDeclarations(withDeclarations)
      : withDeclarations;
  const withInitiatives = setCombatRoundParticipantInitiative({
    initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
    participantId: "guard",
    phase: input.phase,
    state: setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: input.phase,
      state: withReactiveIncoming,
    }),
  });
  const withCursor = initializeCombatRoundPhaseResolutionCursor({
    phase: input.phase,
    state: withInitiatives,
    updatedAt: "2026-01-01T00:02:00.000Z",
  });

  return input.guardAlreadyDone
    ? completeCombatRoundPhaseResolutionForParticipant({
        participantId: "guard",
        phase: input.phase,
        state: withCursor,
        submittedBy: "gm",
        updatedAt: "2026-01-01T00:02:30.000Z",
      })
    : withCursor;
}

function buildTestPhase1AttackResult(input: {
  attackerParticipantId?: string;
  defenderParticipantId?: string;
  hit?: boolean;
}) {
  return buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackerParticipantId: input.attackerParticipantId ?? "guard",
    defenderDb: 10,
    defenderParticipantId: input.defenderParticipantId ?? "gladiator",
    ob: 10,
    phase: "phase1",
    rollD20: input.hit === false ? 8 : 14,
    rollTotal: input.hit === false ? 8 : 14,
    rolledAt: "2026-01-01T00:02:30.000Z",
    weaponName: "Long sword",
  });
}

function addPhase1IncomingAttack(input: {
  attackResult?: ReturnType<typeof buildCombatRoundAttackRollResult>;
  damageResult?: ReturnType<typeof buildCombatRoundDamageResult>;
  parryResolution?: NonNullable<
    ReturnType<typeof buildCombatRoundPhaseResolutionResult>["parryResolution"]
  >;
  state: ReturnType<typeof initializeCombatRoundState>;
}): ReturnType<typeof initializeCombatRoundState> {
  const attackResult = input.attackResult ?? buildTestPhase1AttackResult({});
  const resolution = {
    ...buildCombatRoundPhaseResolutionResult({
      attackResult,
      roundNumber: input.state.roundNumber,
      updatedAt: "2026-01-01T00:03:00.000Z",
    }),
    ...(input.damageResult
      ? {
          criticalRoll: input.damageResult.criticalGrade
            ? {
                attackResultId: input.damageResult.attackResultId,
                attackerParticipantId: input.damageResult.attackerParticipantId,
                criticalGrade: input.damageResult.criticalGrade,
                defenderParticipantId: input.damageResult.defenderParticipantId,
                rollPrivilege: "attacker" as const,
                status: "pending" as const,
              }
            : { status: "not_required" as const },
          damageProposal: {
            proposedEffects: [],
            status: "drafted" as const,
          },
          damageResult: input.damageResult,
          damageRoll: {
            required: false,
            status: "rolled" as const,
            total: input.damageResult.totalDamage,
          },
          hitLocationRoll: {
            attackResultId: input.damageResult.attackResultId,
            attackerParticipantId: input.damageResult.attackerParticipantId,
            defenderParticipantId: input.damageResult.defenderParticipantId,
            hitLocationRolls: input.damageResult.hitLocationRolls,
            rolledAt: input.damageResult.createdAt,
            rolledByParticipantId: input.damageResult.attackerParticipantId,
            rollPrivilege: "attacker" as const,
            selectedHitLocation: input.damageResult.selectedHitLocation,
            selectedHitLocationRoll: input.damageResult.selectedHitLocationRoll,
            selectionReason: input.damageResult.hitLocationSelectionReason,
            status: "rolled" as const,
            targetLocation: input.damageResult.targetLocation,
          },
        }
      : {}),
    ...(input.parryResolution ? { parryResolution: input.parryResolution } : {}),
  };

  return combatRoundStateSchema.parse({
    ...input.state,
    participants: input.state.participants.map((participant) =>
      participant.participantId === attackResult.attackerParticipantId
        ? {
            ...participant,
            attackResults: {
              ...participant.attackResults,
              phase1: attackResult,
            },
          }
        : participant,
    ),
    phaseResolutionResults: [...input.state.phaseResolutionResults, resolution],
  });
}

function findRoundParticipantIdForTestTarget(
  state: ReturnType<typeof initializeCombatRoundState>,
  targetParticipantId: string | undefined,
): string | undefined {
  if (!targetParticipantId) {
    return undefined;
  }

  return state.participants.find((participant) =>
    [
      participant.participantId,
      participant.scenarioParticipantId,
      participant.characterId,
    ].includes(targetParticipantId),
  )?.participantId;
}

function addReactivePhase1IncomingAttacksForDeclarations(
  state: ReturnType<typeof initializeCombatRoundState>,
): ReturnType<typeof initializeCombatRoundState> {
  return state.participants.reduce((current, participant) => {
    if (participant.declaration?.actionId !== "parry_attack") {
      return current;
    }

    const attackerParticipantId =
      findRoundParticipantIdForTestTarget(
        current,
        participant.declaration.phaseContexts?.phase2?.targetParticipantId,
      ) ??
      current.participants.find(
        (candidate) => candidate.participantId !== participant.participantId,
      )?.participantId;

    return addPhase1IncomingAttack({
      attackResult: buildTestPhase1AttackResult({
        attackerParticipantId,
        defenderParticipantId: participant.participantId,
        hit: false,
      }),
      state: current,
    });
  }, state);
}

function preparePhaseInitiativeCompleteState(input: {
  actionId: string;
  encounterParticipants?: EncounterParticipant[];
  guardInitiative?: number;
  gladiatorInitiative?: number;
  phase: "phase1" | "phase2";
}): ReturnType<typeof initializeCombatRoundState> {
  const withDeclarations = declareRoundAction({
    actionId: input.actionId,
    participantId: "guard",
    state: declareRoundAction({
      actionId: input.actionId,
      participantId: "gladiator",
      state: initializeCombatRoundState({
        encounter: encounter({
          participants: input.encounterParticipants ?? [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
          ],
        }),
      }),
    }),
  });
  const atInitiativeStep = advanceToStep(
    input.phase === "phase2" && input.actionId === "parry_attack"
      ? addReactivePhase1IncomingAttacksForDeclarations(withDeclarations)
      : withDeclarations,
    input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2",
  );

  return setCombatRoundParticipantInitiative({
    initiative: {
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [Math.min(6, input.guardInitiative ?? 4)],
      rollTotal: input.guardInitiative ?? 4,
      total: input.guardInitiative ?? 4,
    },
    participantId: "guard",
    phase: input.phase,
    state: setCombatRoundParticipantInitiative({
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [Math.min(6, input.gladiatorInitiative ?? 6)],
        rollTotal: input.gladiatorInitiative ?? 6,
        total: input.gladiatorInitiative ?? 6,
      },
      participantId: "gladiator",
      phase: input.phase,
      state: atInitiativeStep,
    }),
  });
}

function declareTestRoundAction(input: {
  actionId?: string;
  participantId: string;
  phase1Target?: string;
  phase2Target?: string;
  state: ReturnType<typeof initializeCombatRoundState>;
}): ReturnType<typeof initializeCombatRoundState> {
  return recordCombatRoundDeclaration({
    declaration: {
      actionId: input.actionId,
      phaseContexts: {
        phase1: testPhaseContext(input.phase1Target ?? "guard"),
        phase2: testPhaseContext(input.phase2Target ?? "guard"),
      },
      roundNumber: input.state.roundNumber,
    },
    participantId: input.participantId,
    state: input.state,
    submittedBy: "gm",
  });
}

function prepareScenarioTargetPhaseInitiativeCompleteState(input: {
  gladiatorActionId?: string;
  gladiatorInitiative?: number;
  phase: "phase1" | "phase2";
  scyrianActionId?: string;
  scyrianInitiative?: number;
}): ReturnType<typeof initializeCombatRoundState> {
  const encounterParticipants = [
    participant({ id: "gladiator", label: "The Gladiator" }),
    participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
  ];
  const combatExperienceOpen = openCombatExperienceWindow(
    initializeCombatRoundState({
      encounter: encounter({ currentRound: 1, participants: encounterParticipants }),
    }),
  );
  const gladiatorCombatExperienceResolved = rollCombatRoundCombatExperience({
    command: {
      createdAt: "2026-01-01T00:01:00.000Z",
      createdByUserId: "player-gladiator",
    },
    participantId: "gladiator",
    skillTotal: 26,
    state: combatExperienceOpen,
  }).state;
  const scyrianCombatExperienceResolved = rollCombatRoundCombatExperience({
    command: {
      createdAt: "2026-01-01T00:01:10.000Z",
      createdByUserId: "player-scyrian",
    },
    participantId: "scyrian",
    skillTotal: 26,
    state: gladiatorCombatExperienceResolved,
  }).state;
  const withDeclarations = declareTestRoundAction({
    actionId: input.scyrianActionId ?? "attack_parry",
    participantId: "scyrian",
    phase1Target: "scenario-gladiator",
    phase2Target: "scenario-gladiator",
    state: declareTestRoundAction({
      actionId: input.gladiatorActionId ?? "attack_parry",
      participantId: "gladiator",
      phase1Target: "scenario-scyrian",
      phase2Target: "scenario-scyrian",
      state: scyrianCombatExperienceResolved,
    }),
  });
  const withReactiveIncoming =
    input.phase === "phase2" &&
    ((input.gladiatorActionId ?? "attack_parry") === "parry_attack" ||
      (input.scyrianActionId ?? "attack_parry") === "parry_attack")
      ? addReactivePhase1IncomingAttacksForDeclarations(withDeclarations)
      : withDeclarations;
  const atInitiativeStep = advanceToStep(
    withReactiveIncoming,
    input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2",
  );

  return setCombatRoundParticipantInitiative({
    initiative: {
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [Math.min(6, input.scyrianInitiative ?? 5)],
      rollTotal: input.scyrianInitiative ?? 5,
      total: input.scyrianInitiative ?? 5,
    },
    participantId: "scyrian",
    phase: input.phase,
    state: setCombatRoundParticipantInitiative({
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [Math.min(6, input.gladiatorInitiative ?? 5)],
        rollTotal: input.gladiatorInitiative ?? 5,
        total: input.gladiatorInitiative ?? 5,
      },
      participantId: "gladiator",
      phase: input.phase,
      state: atInitiativeStep,
    }),
  });
}

function prepareScenarioTargetPhaseInitiativeStepState(input: {
  currentRound?: number;
  gladiatorActionId?: string;
  phase: "phase1" | "phase2";
  scyrianActionId?: string;
}): ReturnType<typeof initializeCombatRoundState> {
  const encounterParticipants = [
    participant({ id: "gladiator", label: "The Gladiator" }),
    participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
  ];
  const withDeclarations = declareTestRoundAction({
    actionId: input.scyrianActionId ?? "attack_parry",
    participantId: "scyrian",
    phase1Target: "scenario-gladiator",
    phase2Target: "scenario-gladiator",
    state: declareTestRoundAction({
      actionId: input.gladiatorActionId ?? "attack_parry",
      participantId: "gladiator",
      phase1Target: "scenario-scyrian",
      phase2Target: "scenario-scyrian",
      state: initializeCombatRoundState({
        encounter: encounter({
          currentRound: input.currentRound ?? 2,
          participants: encounterParticipants,
        }),
      }),
    }),
  });

  const withReactiveIncoming =
    input.phase === "phase2" &&
    ((input.gladiatorActionId ?? "attack_parry") === "parry_attack" ||
      (input.scyrianActionId ?? "attack_parry") === "parry_attack")
      ? addReactivePhase1IncomingAttacksForDeclarations(withDeclarations)
      : withDeclarations;

  return advanceToStep(
    withReactiveIncoming,
    input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2",
  );
}

function prepareScenarioTargetPhaseCombatExperienceGate(input: {
  gladiatorActionId?: string;
  phase: "phase1" | "phase2";
  scyrianActionId?: string;
}): {
  state: ReturnType<typeof initializeCombatRoundState>;
  visibility: {
    "scenario-gladiator": { "scenario-scyrian": boolean };
    "scenario-scyrian": { "scenario-gladiator": boolean };
  };
} {
  const visibility = {
    "scenario-gladiator": { "scenario-scyrian": true },
    "scenario-scyrian": { "scenario-gladiator": true },
  };
  const atInitiative = prepareScenarioTargetPhaseInitiativeStepState(input);
  const afterGladiatorRoll = recordCombatRoundInitiative({
    command: {
      createdAt: "2026-01-01T00:02:00.000Z",
      createdByUserId: "gm-1",
    },
    initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
    participantId: "gladiator",
    phase: input.phase,
    state: atInitiative,
    submittedBy: "gm",
    visibility,
  });
  const inputsRecorded = recordCombatRoundInitiative({
    command: {
      createdAt: "2026-01-01T00:02:30.000Z",
      createdByUserId: "gm-1",
    },
    initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
    participantId: "scyrian",
    phase: input.phase,
    state: afterGladiatorRoll,
    submittedBy: "gm",
    visibility,
  });

  const state = commitCombatRoundPhaseInitiativeResolution({
    command: {
      createdAt: "2026-01-01T00:02:45.000Z",
      createdByUserId: "gm-1",
    },
    phase: input.phase,
    state: inputsRecorded,
    visibility,
  }).state;

  return { state, visibility };
}

function commitPreparedPhaseInitiative(input: {
  phase: "phase1" | "phase2";
  state: ReturnType<typeof initializeCombatRoundState>;
  visibility?: Record<string, Record<string, boolean>>;
}): ReturnType<typeof initializeCombatRoundState> {
  return commitCombatRoundPhaseInitiativeResolution({
    command: {
      createdAt: "2026-01-01T00:02:45.000Z",
      createdByUserId: "gm-1",
    },
    phase: input.phase,
    state: input.state,
    visibility: input.visibility,
  }).state;
}

function prepareFailedParryPendingDamage(input: {
  actionId?: string;
  defenderDb?: number;
  ob?: number;
  phase?: "phase1" | "phase2";
  rollD20?: number;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
}): {
  attackResult: ReturnType<typeof buildCombatRoundAttackRollResult>;
  state: ReturnType<typeof initializeCombatRoundState>;
} {
  const phase = input.phase ?? "phase1";
  const actionId = input.actionId ?? "attack_parry";
  const state = initializeCombatRoundPhaseResolutionCursor({
    phase,
    state: setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase,
      state: declareRoundAction({
        actionId,
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    }),
    updatedAt: "2026-01-01T00:02:00.000Z",
  });
  const attackResult = buildCombatRoundAttackRollResult({
    actionId,
    attackerParticipantId: "gladiator",
    defenderDb: input.defenderDb ?? 10,
    defenderParticipantId: "guard",
    ob: input.ob ?? 10,
    phase,
    rollD20: input.rollD20 ?? 14,
    rollTotal: input.rollD20 ?? 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponCriticalCode: input.weaponCriticalCode,
    weaponDamageClass: input.weaponDamageClass,
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: {
      createdAt: attackResult.rolledAt,
      createdByUserId: "gm-1",
    },
    participantId: "gladiator",
    result: attackResult,
    state,
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult,
    command: {
      createdAt: "2026-01-01T00:04:00.000Z",
      createdByUserId: "gm-1",
    },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });

  return {
    attackResult,
    state: afterParry,
  };
}

function commitFailedParryDamage(input: {
  actionId: string;
  phase: "phase1" | "phase2";
  state: ReturnType<typeof initializeCombatRoundState>;
}) {
  const result = buildCombatRoundAttackRollResult({
    actionId: input.actionId,
    attackerParticipantId: "gladiator",
    defenderDb: 10,
    defenderParticipantId: "guard",
    ob: 10,
    phase: input.phase,
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: {
      createdAt: result.rolledAt,
      createdByUserId: "gm-1",
    },
    participantId: "gladiator",
    result,
    state: input.state,
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult: result,
    command: {
      createdAt: "2026-01-01T00:04:00.000Z",
      createdByUserId: "gm-1",
    },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult: result,
    command: {
      createdAt: "2026-01-01T00:04:30.000Z",
      createdByUserId: "gm-1",
    },
    hitLocationRolls: [12],
    rolledByParticipantId: "gladiator",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult: result,
    command: {
      createdAt: "2026-01-01T00:05:00.000Z",
      createdByUserId: "gm-1",
    },
    defenderDm: 0,
    dmb: 8,
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const afterCritical = recordCombatRoundCriticalRoll({
    attackResult: result,
    command: {
      createdAt: "2026-01-01T00:05:30.000Z",
      createdByUserId: "gm-1",
    },
    criticalDice: [4, 5],
    rolledByParticipantId: "gladiator",
    state: afterDamage,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:30.000Z",
  });

  return commitCombatRoundPhaseDamage({
    attackerScenarioParticipantId: "scenario-gladiator",
    command: {
      createdAt: "2026-01-01T00:06:00.000Z",
      createdByUserId: "gm-1",
    },
    defenderScenarioParticipantId: "scenario-guard",
    encounterId: "encounter-1",
    scenarioId: "scenario-1",
    state: afterCritical,
  });
}

describe("combat round manager", () => {
  it("derives both Feint phase targets and the A2 opportunity from one declaration target", () => {
    const declaration = synchronizeCombatRoundFeintDeclarationTarget({
      actionId: "feint_attack",
      attackOpportunities: [
        {
          id: "feint-a2",
          origin: "feint_attack",
          phase: "phase2",
          slot: "attack_2",
          status: "committed",
          targetParticipantId: "stale-target",
        },
      ],
      feint: {
        attackerSkillId: "dodge",
        attackerSkillLabel: "Dodge",
        defenderSkillId: "one-handed-edged",
        defenderSkillLabel: "1-h edged",
        method: "movement",
        targetParticipantId: "encounter-defender",
      },
      phaseContexts: {
        phase1: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "stale-target",
        },
        phase2: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
      roundNumber: 3,
      submittedBy: "gm",
    });

    expect(declaration.feint?.targetParticipantId).toBe("encounter-defender");
    expect(declaration.phaseContexts?.phase1?.targetParticipantId).toBe("encounter-defender");
    expect(declaration.phaseContexts?.phase2?.targetParticipantId).toBe("encounter-defender");
    expect(declaration.attackOpportunities?.[0]?.targetParticipantId).toBe("encounter-defender");
  });
  it("defines the compact round timeline steps in order", () => {
    expect(COMBAT_ROUND_STEPS.map((step) => COMBAT_ROUND_STEP_ABBREVIATIONS[step])).toEqual([
      "DE",
      "M1",
      "i1",
      "A1",
      "P1",
      "D1",
      "M2",
      "i2",
      "A2",
      "P2",
      "D2",
      "SU",
    ]);
  });

  it("initializes round state from encounter participants", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });

    expect(state.roundNumber).toBe(3);
    expect(state.currentStep).toBe("select_actions");
    expect(state.commands).toEqual([]);
    expect(state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(state.phaseResolutionResults).toEqual([]);
    expect(state.phaseResolutionStatuses).toEqual({});
    expect(state.stepSnapshots).toEqual([]);
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.participants.map((entry) => entry.participantId)).toEqual(["gladiator", "guard"]);
    expect(state.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(state.participants[0]?.stepStatuses.round_summary).toBe("pending");
    expect(state.participants[0]?.attackResults).toEqual({});
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
  });

  it("materializes default distance edges during round initialization", () => {
    const state = initializeCombatRoundState({
      encounter: encounter({
        participants: [
          participant({ id: "gladiator", label: "The Gladiator" }),
          participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
          participant({ id: "guard", label: "City guard" }),
        ],
      }),
      weaponsByParticipantId: {
        gladiator: [{ range: "3.0" }],
        guard: [],
        scyrian: [{ preferredDistances: [2] }],
      },
    });
    const pairKey = makeDistancePairKey("gladiator", "scyrian");

    expect(Object.keys(state.distanceState.edges)).toHaveLength(3);
    expect(state.distanceState.edges[pairKey]).toMatchObject({
      distance: 3,
      lastChangedRound: 3,
      source: "default_weapon_reach",
    });
    expect(state.distanceState.edges[pairKey]?.notes).toBeUndefined();
    expect(getDistanceBetween(state.distanceState, "gladiator", "scyrian")).toBe(3);
  });

  it("preserves GM-set distance edges while materializing missing pairs", () => {
    const baseEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
      ],
    });
    const initial = initializeCombatRoundState({
      encounter: baseEncounter,
      weaponsByParticipantId: {
        gladiator: [{ range: "3.0" }],
        scyrian: [{ preferredDistances: [2] }],
      },
    });
    const withGmDistance = {
      ...initial,
      distanceState: setDistanceBetween({
        distance: 1,
        participantAId: "gladiator",
        participantBId: "scyrian",
        source: "gm_set",
        state: initial.distanceState,
      }),
    };
    const state = initializeCombatRoundState({
      encounter: {
        ...baseEncounter,
        combatRoundState: withGmDistance,
        participants: [
          ...baseEncounter.participants,
          participant({ id: "guard", label: "City guard" }),
        ],
      },
      weaponsByParticipantId: {
        gladiator: [{ range: "3.0" }],
        guard: [{ preferredDistances: [4] }],
        scyrian: [{ preferredDistances: [2] }],
      },
    });
    const gmPairKey = makeDistancePairKey("gladiator", "scyrian");

    expect(state.distanceState.edges[gmPairKey]).toMatchObject({
      distance: 1,
      source: "gm_set",
    });
    expect(getDistanceBetween(state.distanceState, "gladiator", "guard")).toBe(4);
    expect(getDistanceBetween(state.distanceState, "guard", "scyrian")).toBe(4);
  });

  it("preserves alias-keyed materialized distance edges over fallback melee defaults", () => {
    const baseEncounter = encounter({
      participants: [
        {
          ...participant({ id: "gladiator", label: "The Gladiator" }),
          characterId: "character-gladiator",
        },
        {
          ...participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
          characterId: "character-scyrian",
        },
      ],
    });
    const initial = initializeCombatRoundState({ encounter: baseEncounter });
    const aliasDistanceState = setDistanceBetween({
      distance: 3,
      participantAId: "scenario-gladiator",
      participantBId: "character-scyrian",
      source: "default_weapon_reach",
      state: initial.distanceState,
    });
    const state = initializeCombatRoundState({
      encounter: {
        ...baseEncounter,
        combatRoundState: {
          ...initial,
          distanceState: aliasDistanceState,
        },
      },
    });
    const pairKey = makeDistancePairKey("gladiator", "scyrian");

    expect(state.distanceState.edges[pairKey]).toMatchObject({
      distance: 3,
      participantAId: "gladiator",
      participantBId: "scyrian",
      source: "default_weapon_reach",
    });
    expect(state.distanceState.edges[pairKey]?.notes).toBeUndefined();
    expect(getDistanceBetween(state.distanceState, "gladiator", "scyrian")).toBe(3);
  });

  it("stamps initialized combat round state with the owning encounter id", () => {
    const state = initializeCombatRoundState({ encounter: encounter({ id: "encounter-a" }) });

    expect(state.encounterId).toBe("encounter-a");
  });

  it("maps Combat Experience result bands", () => {
    expect(evaluateCombatExperienceResult(5, { panicDurationRounds: 8 })).toMatchObject({
      durationRounds: 8,
      effectiveTableTotal: 5,
      label: "Panic",
      modifierValue: -4,
      needsEffectRow: true,
      resultBand: "panic",
    });
    expect(evaluateCombatExperienceResult(10)).toMatchObject({
      durationRounds: 4,
      effectiveTableTotal: 10,
      label: "Passive",
      modifierValue: -2,
      resultBand: "passive",
    });
    expect(evaluateCombatExperienceResult(15)).toMatchObject({
      durationRounds: 2,
      effectiveTableTotal: 15,
      label: "Active",
      modifierValue: -2,
      resultBand: "active_penalty",
    });
    expect(evaluateCombatExperienceResult(20)).toMatchObject({
      durationRounds: 1,
      effectiveTableTotal: 20,
      label: "Active",
      modifierValue: -1,
      resultBand: "active_penalty",
    });
    expect(evaluateCombatExperienceResult(21)).toMatchObject({
      durationRounds: 0,
      effectiveTableTotal: 21,
      label: "Active",
      modifierValue: 0,
      needsEffectRow: false,
      resultBand: "active",
    });
  });

  it("maps Combat Experience through the difficulty-adjusted table total", () => {
    expect(evaluateCombatExperienceResult(21, { difficulty: 21 })).toMatchObject({
      difficultyShift: 0,
      effectiveTableTotal: 21,
      modifierValue: 0,
      resultBand: "active",
    });
    expect(evaluateCombatExperienceResult(26, { difficulty: 26 })).toMatchObject({
      difficultyShift: 5,
      effectiveTableTotal: 21,
      modifierValue: 0,
      resultBand: "active",
    });
    expect(evaluateCombatExperienceResult(27, { difficulty: 36 })).toMatchObject({
      difficultyShift: 15,
      durationRounds: 2,
      effectiveTableTotal: 12,
      modifierValue: -2,
      resultBand: "active_penalty",
    });
    expect(evaluateCombatExperienceResult(36, { difficulty: 36 })).toMatchObject({
      difficultyShift: 15,
      effectiveTableTotal: 21,
      modifierValue: 0,
      resultBand: "active",
    });
    expect(evaluateCombatExperienceResult(20, { difficulty: 26 })).toMatchObject({
      difficultyShift: 5,
      durationRounds: 2,
      effectiveTableTotal: 15,
      modifierValue: -2,
      resultBand: "active_penalty",
    });
  });

  it("shifts Combat Experience panic and passive thresholds with high difficulty", () => {
    expect(
      evaluateCombatExperienceResult(20, { difficulty: 36, panicDurationRounds: 7 }),
    ).toMatchObject({
      difficultyShift: 15,
      durationRounds: 7,
      effectiveTableTotal: 5,
      modifierValue: -4,
      resultBand: "panic",
    });
    expect(evaluateCombatExperienceResult(25, { difficulty: 36 })).toMatchObject({
      difficultyShift: 15,
      durationRounds: 4,
      effectiveTableTotal: 10,
      modifierValue: -2,
      resultBand: "passive",
    });
  });

  it("reads displayed effective Combat Experience skill total from participant sheet summary", () => {
    const lookup = getParticipantCombatExperienceSkillTotalLookup({
      snapshot: {
        sheetSummary: {
          draftView: {
            skills: [
              { effectiveSkillNumber: 5, name: "Perception", skillId: "perception" },
              {
                effectiveSkillNumber: 7,
                linkedStatAverage: 14,
                name: "Combat Experience",
                skillId: "combat_experience",
                totalSkill: 21,
              },
            ],
          },
        },
      },
    });

    expect(lookup).toMatchObject({
      matchedIdentifier: "combat_experience",
      skillTotal: 21,
      source: "participant.snapshot.sheetSummary.draftView.skills.totalSkill",
    });
    expect(
      getCombatExperienceSkillTotalFromSnapshot({
        sheetSummary: {
          draftView: {
            skills: [
              {
                effectiveSkillNumber: 7,
                linkedStatAverage: 14,
                name: "Combat Experience",
                skillId: "combat_experience",
                totalSkill: 21,
              },
            ],
          },
        },
      }),
    ).toBe(21);
    expect(getCombatExperienceSkillTotalFromSnapshot({ sheetSummary: {} })).toBe(0);
  });

  it("computes displayed Combat Experience total from stats and XP when total is absent", () => {
    expect(
      getParticipantCombatExperienceSkillTotalLookup({
        snapshot: {
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 14,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                },
              ],
            },
          },
        },
      }),
    ).toMatchObject({
      matchedIdentifier: "combat_experience",
      skillTotal: 21,
      source:
        "participant.snapshot.sheetSummary.draftView.skills.linkedStatAverage+effectiveSkillNumber",
    });
  });

  it("supports normalized Combat Experience names and displayed total fields", () => {
    expect(
      getParticipantCombatExperienceSkillTotalLookup({
        snapshot: {
          sheetSummary: {
            draftView: {
              skills: [
                {
                  name: "combatExperience",
                  skillId: "combatExperience",
                  totalSkillLevel: 21,
                },
              ],
            },
          },
        },
      }),
    ).toMatchObject({
      matchedIdentifier: "combatExperience",
      skillTotal: 21,
      source: "participant.snapshot.sheetSummary.draftView.skills.totalSkillLevel",
    });
  });

  it("uses XP-only Combat Experience only as an explicit fallback", () => {
    expect(
      getParticipantCombatExperienceSkillTotalLookup({
        snapshot: {
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                },
              ],
            },
          },
        },
      }),
    ).toMatchObject({
      matchedIdentifier: "combat_experience",
      skillTotal: 7,
      source: "participant.snapshot.sheetSummary.draftView.skills.effectiveSkillNumber",
      warning: "Combat Experience displayed total was unavailable; using XP-only fallback.",
    });
  });

  it("keeps Combat Experience rolls closed until the GM opens the shared difficulty", () => {
    const state = initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) });

    expect(isCombatRoundCombatExperienceWindowOpen(state)).toBe(false);
    expect(getCombatRoundCombatExperienceDifficulty(state)).toBe(26);
    expect(() =>
      rollCombatRoundCombatExperience({
        command: {
          createdAt: "2026-01-01T00:01:00.000Z",
        },
        participantId: "gladiator",
        rng: () => 0.2,
        skillTotal: 10,
        state,
      }),
    ).toThrow("Combat Experience rolls are not open. Set Combat Experience difficulty first.");

    const opened = openCombatExperienceWindow(state);

    expect(isCombatRoundCombatExperienceWindowOpen(opened)).toBe(true);
    expect(getCombatRoundCombatExperienceDifficulty(opened)).toBe(26);
    expect(hasCombatRoundCombatExperienceRoll(opened)).toBe(false);
  });

  it("rolls Combat Experience with default difficulty and creates a shifted passive row", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      createdRevision: "revision-ce-1",
      participantId: "gladiator",
      rng: () => 0.2,
      scenarioParticipantId: "scenario-gladiator",
      skillTotal: 10,
      state,
    });

    expect(rolled.result).toMatchObject({
      difficulty: COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY,
      difficultyShift: 5,
      durationRounds: 4,
      effectiveTableTotal: 10,
      finalTotal: 15,
      label: "Passive",
      modifierValue: -2,
      resultBand: "passive",
      rollD20: 5,
      rollTotal: 5,
      skillTotal: 10,
    });
    expect(rolled.state.participants[0]?.combatExperience).toEqual(rolled.result);
    expect(rolled.state.commands.at(-1)).toMatchObject({
      facts: {
        createdCombatEffectIds: expect.arrayContaining([
          expect.stringContaining("combat-experience"),
        ]),
        difficulty: 26,
        difficultyShift: 5,
        effectiveTableTotal: 10,
        modifierValue: -2,
      },
      type: "roll_combat_experience",
    });
    expect(rolled.combatEffects.effects).toHaveLength(1);
    expect(rolled.combatEffects.effects[0]).toMatchObject({
      canonicalLifecycle: {
        applicability: { combatWide: true },
        lifecycle: {
          duration: { creationRoundCounts: true, kind: "rounds", remaining: 4 },
          state: "active",
        },
        payload: { category: "general_fatigue", unit: "percentage", value: -2 },
        provenanceCompleteness: "complete",
      },
      combatWide: true,
      description: "combat exp passive",
      duration: "4 rounds",
      effectGroup: "general",
      modifierValue: -2,
      status: "active",
      targetParticipantId: "scenario-gladiator",
      type: "general_modifier",
    });
    const projection = buildLiveCombatModifierContributionProjection({
      combatEffects: rolled.combatEffects,
      currentRound: 1,
      encounterId: "encounter-1",
      ownerParticipantId: "scenario-gladiator",
    });
    expect(projection.contributions).toHaveLength(1);
    expect(projection.contributions[0]).toMatchObject({
      bucket: "general_fatigue",
      value: -2,
    });
  });

  it("uses Combat Experience skill total 21 when rolling instead of falling back to zero", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const lookup = getParticipantCombatExperienceSkillTotalLookup({
      sheetSummary: {
        draftView: {
          skills: [
            {
              effectiveSkillNumber: 7,
              linkedStatAverage: 14,
              name: "Combat Experience",
              skillId: "combat_experience",
              totalSkill: 21,
            },
          ],
        },
      },
    });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.2,
      skillTotal: lookup.skillTotal,
      skillTotalSource: lookup.source,
      state,
    });

    expect(rolled.result).toMatchObject({
      difficultyShift: 5,
      effectiveTableTotal: 21,
      finalTotal: 26,
      rollD20: 5,
      rollTotal: 5,
      skillTotal: 21,
      skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
    });
    expect(rolled.state.commands.at(-1)?.facts).toMatchObject({
      difficulty: 26,
      difficultyShift: 5,
      effectiveTableTotal: 21,
      finalTotal: 26,
      rollTotal: 5,
      skillTotal: 21,
      skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
    });
  });

  it("confirms no-roll Combat Experience using displayed total instead of XP-only", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      21,
    );
    let rngCalls = 0;
    const lookup = getParticipantCombatExperienceSkillTotalLookup({
      sheetSummary: {
        draftView: {
          skills: [
            {
              effectiveSkillNumber: 7,
              linkedStatAverage: 14,
              name: "Combat Experience",
              skillId: "combat_experience",
              totalSkill: 21,
            },
          ],
        },
      },
    });
    const confirmed = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => {
        rngCalls += 1;
        return 0.2;
      },
      skillTotal: lookup.skillTotal,
      skillTotalSource: lookup.source,
      state,
    });

    expect(rngCalls).toBe(0);
    expect(confirmed.result).toMatchObject({
      difficulty: 21,
      effectiveTableTotal: 21,
      finalTotal: 21,
      noRollRequired: true,
      skillTotal: 21,
      skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
    });
  });

  it("confirms Combat Experience without rolling when skill total meets difficulty", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    let rngCalls = 0;
    const confirmed = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => {
        rngCalls += 1;
        return 0.2;
      },
      skillTotal: 26,
      state,
    });

    expect(rngCalls).toBe(0);
    expect(confirmed.result).toMatchObject({
      difficulty: 26,
      difficultyShift: 5,
      effectiveTableTotal: 21,
      finalTotal: 26,
      label: "Active",
      modifierValue: 0,
      needsEffectRow: false,
      noRollRequired: true,
      resultBand: "active",
      skillTotal: 26,
    });
    expect(confirmed.result.rollD20).toBeUndefined();
    expect(confirmed.result.rollTotal).toBeUndefined();
    expect(confirmed.combatEffects.effects).toEqual([]);
    expect(confirmed.state.participants[0]?.combatExperience).toEqual(confirmed.result);
    expect(confirmed.state.commands.at(-1)).toMatchObject({
      facts: {
        createdCombatEffectIds: [],
        difficulty: 26,
        difficultyShift: 5,
        effectiveTableTotal: 21,
        finalTotal: 26,
        modifierValue: 0,
        noRollRequired: true,
        skillTotal: 26,
      },
      type: "roll_combat_experience",
    });
  });

  it("stores a shared Combat Experience difficulty and uses it for later rolls", () => {
    const state = initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) });
    const edited = setCombatRoundCombatExperienceDifficulty({
      difficulty: 36,
      state,
    });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.36,
      skillTotal: 19,
      state: edited,
    });

    expect(getCombatRoundCombatExperienceDifficulty(edited)).toBe(36);
    expect(
      getCombatRoundCombatExperienceDifficulty(
        initializeCombatRoundState({
          encounter: {
            ...encounter({ combatRoundState: edited, currentRound: 1 }),
          },
        }),
      ),
    ).toBe(36);
    expect(rolled.result).toMatchObject({
      difficulty: 36,
      effectiveTableTotal: 12,
      finalTotal: 27,
      modifierValue: -2,
    });
    expect(rolled.state.combatExperienceDifficulty).toBe(36);
  });

  it("locks the shared Combat Experience difficulty after the first CE result", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      36,
    );
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.36,
      skillTotal: 19,
      state,
    });

    expect(hasCombatRoundCombatExperienceRoll(rolled.state)).toBe(true);
    expect(() =>
      setCombatRoundCombatExperienceDifficulty({
        difficulty: 26,
        state: rolled.state,
      }),
    ).toThrow(
      "Combat Experience difficulty cannot be changed after rolls have been recorded. Clear Combat Experience results first.",
    );
  });

  it("requires a Combat Experience roll when the GM raises difficulty above skill total", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      36,
    );
    let rngCalls = 0;
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => {
        rngCalls += 1;
        return 0.2;
      },
      skillTotal: 26,
      state,
    });

    expect(rngCalls).toBe(1);
    expect(rolled.result).toMatchObject({
      difficulty: 36,
      difficultyShift: 15,
      durationRounds: 1,
      effectiveTableTotal: 16,
      finalTotal: 31,
      noRollRequired: false,
      resultBand: "active_penalty",
      rollD20: 5,
      rollTotal: 5,
      skillTotal: 26,
    });
  });

  it("applies a GM-raised Combat Experience difficulty to the created modifier row", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      36,
    );
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.36,
      scenarioParticipantId: "scenario-gladiator",
      skillTotal: 19,
      state,
    });

    expect(rolled.result).toMatchObject({
      difficulty: 36,
      difficultyShift: 15,
      durationRounds: 2,
      effectiveTableTotal: 12,
      finalTotal: 27,
      label: "Active",
      modifierValue: -2,
      resultBand: "active_penalty",
      rollD20: 8,
      rollTotal: 8,
      skillTotal: 19,
    });
    expect(rolled.state.commands.at(-1)?.facts).toMatchObject({
      difficulty: 36,
      difficultyShift: 15,
      durationRounds: 2,
      effectiveTableTotal: 12,
      finalTotal: 27,
      modifierValue: -2,
      resultBand: "active_penalty",
    });
    expect(rolled.combatEffects.effects[0]).toMatchObject({
      description: "combat exp active -2",
      duration: "2 rounds",
      modifierValue: -2,
      type: "general_modifier",
    });
    expect(getLatestCombatEventSummary(rolled.state)?.summaryText).toBe(
      "Round 1, DE: The Gladiator Combat Experience 19 + roll 8 = 27 vs 36. Result: Active. General -2 for 2 rounds.",
    );
  });

  it("uses the shifted default difficulty table result for final total 20", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.2,
      skillTotal: 15,
      state,
    });

    expect(rolled.result).toMatchObject({
      difficulty: 26,
      durationRounds: 2,
      effectiveTableTotal: 15,
      finalTotal: 20,
      modifierValue: -2,
      resultBand: "active_penalty",
    });
  });

  it("confirms no-roll Combat Experience when skill meets an edited difficulty", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      36,
    );
    let rngCalls = 0;
    const confirmed = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => {
        rngCalls += 1;
        return 0.36;
      },
      skillTotal: 36,
      state,
    });

    expect(rngCalls).toBe(0);
    expect(confirmed.result).toMatchObject({
      difficulty: 36,
      difficultyShift: 15,
      effectiveTableTotal: 21,
      finalTotal: 36,
      modifierValue: 0,
      needsEffectRow: false,
      noRollRequired: true,
      resultBand: "active",
    });
    expect(confirmed.combatEffects.effects).toEqual([]);
  });

  it("rolls panic duration as 1d6 + 4 and stores 5-10 rounds", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const rolls = [0.2, 0.95];
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => rolls.shift() ?? 0,
      skillTotal: 0,
      state,
    });

    expect(rolled.result).toMatchObject({
      durationRounds: 10,
      label: "Panic",
      modifierValue: -4,
      resultBand: "panic",
    });
    expect(rolled.combatEffects.effects[0]?.duration).toBe("10 rounds");
  });

  it("creates active -1 duration 1 and no row for active 21+", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const activePenalty = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.2,
      skillTotal: 16,
      state,
    });
    const activeNoPenalty = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:10.000Z",
      },
      combatEffects: activePenalty.combatEffects,
      participantId: "guard",
      rng: () => 0.5,
      skillTotal: 15,
      state: activePenalty.state,
    });

    expect(activePenalty.result).toMatchObject({
      durationRounds: 1,
      finalTotal: 21,
      modifierValue: -1,
    });
    expect(activePenalty.combatEffects.effects[0]).toMatchObject({
      duration: "1 round",
      modifierValue: -1,
    });
    expect(activeNoPenalty.result).toMatchObject({
      durationRounds: 0,
      finalTotal: 26,
      modifierValue: 0,
      needsEffectRow: false,
      resultBand: "active",
    });
    expect(activeNoPenalty.combatEffects.effects).toHaveLength(1);
  });

  it("resolves combat-start Combat Experience in non-top-to-bottom order", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const rolledGuard = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "player-guard",
      },
      participantId: "guard",
      rng: () => 0.6,
      skillTotal: 20,
      state,
    });
    const rolledGladiator = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "player-gladiator",
      },
      participantId: "gladiator",
      rng: () => 0.6,
      skillTotal: 20,
      state: rolledGuard.state,
    });

    expect(rolledGuard.state.participants[1]?.combatExperience).toBeDefined();
    expect(rolledGuard.state.participants[0]?.combatExperience).toBeUndefined();
    expect(rolledGladiator.state.commands.map((command) => command.participantId)).toEqual([
      "guard",
      "gladiator",
    ]);
    expect(
      getFirstCombatStartExperienceRequiredParticipantId(rolledGladiator.state),
    ).toBeUndefined();
  });

  it("blocks declaration until CE is resolved and allows it before others complete CE", () => {
    const state = initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) });

    expect(() =>
      recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: testPhaseContext("guard"),
            phase2: testPhaseContext("guard"),
          },
          roundNumber: 1,
        },
        participantId: "gladiator",
        state,
        submittedBy: "player",
      }),
    ).toThrow("Roll Combat Experience before declaring an action.");
    expect(canPlayerSubmitCombatDeclaration({ participantId: "gladiator", state })).toBe(false);

    const opened = openCombatExperienceWindow(state);
    const rolledGladiator = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.6,
      skillTotal: 20,
      state: opened,
    });
    const declaredGladiator = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("guard"),
          phase2: testPhaseContext("guard"),
        },
        roundNumber: 1,
      },
      participantId: "gladiator",
      state: rolledGladiator.state,
      submittedBy: "player",
    });

    expect(getFirstCombatStartExperienceRequiredParticipantId(declaredGladiator)).toBe("guard");
    expect(declaredGladiator.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(declaredGladiator.participants[1]?.combatExperience).toBeUndefined();
  });

  it("keeps command-backed DE until every combat-start CE and declaration is complete", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const blocked = advanceCombatRoundStep(state, {
      command: {
        createdAt: "2026-01-01T00:00:30.000Z",
      },
    });

    expect(blocked.currentStep).toBe("select_actions");
    expect(blocked.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 1,
      step: "DE",
    });

    const rolledGladiator = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.6,
      skillTotal: 20,
      state: blocked,
    });
    const stillBlocked = advanceCombatRoundStep(rolledGladiator.state, {
      command: {
        createdAt: "2026-01-01T00:01:30.000Z",
      },
    });

    expect(stillBlocked.currentStep).toBe("select_actions");
    expect(stillBlocked.currentCursor?.participantId).toBe("guard");

    const rolledGuard = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
      },
      participantId: "guard",
      rng: () => 0.6,
      skillTotal: 20,
      state: stillBlocked,
    });
    const advanced = advanceCombatRoundStep(rolledGuard.state, {
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
      },
    });

    expect(getFirstCombatRoundDeclarationRequiredParticipantId(rolledGuard.state)).toBe(
      "gladiator",
    );
    expect(advanced.currentStep).toBe("select_actions");
    expect(advanced.currentCursor?.participantId).toBe("gladiator");

    const declaredGladiator = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("guard"),
          phase2: testPhaseContext("guard"),
        },
        roundNumber: 1,
      },
      participantId: "gladiator",
      state: rolledGuard.state,
      submittedBy: "player",
    });
    const declarationBlocked = advanceCombatRoundStep(declaredGladiator, {
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
      },
    });

    expect(declarationBlocked.currentStep).toBe("select_actions");
    expect(declarationBlocked.currentCursor?.participantId).toBe("guard");

    const declaredGuard = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("gladiator"),
          phase2: testPhaseContext("gladiator"),
        },
        roundNumber: 1,
      },
      participantId: "guard",
      state: declaredGladiator,
      submittedBy: "player",
    });
    const fullyAdvanced = advanceCombatRoundStep(declaredGuard, {
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
      },
    });

    expect(fullyAdvanced.currentStep).toBe("review_action_modifiers");
  });

  it("rejects duplicate Combat Experience rolls for the same participant", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      participantId: "gladiator",
      rng: () => 0.6,
      skillTotal: 20,
      state,
    });

    expect(() =>
      rollCombatRoundCombatExperience({
        command: {
          createdAt: "2026-01-01T00:02:00.000Z",
        },
        participantId: "gladiator",
        rng: () => 0.6,
        skillTotal: 20,
        state: rolled.state,
      }),
    ).toThrow("Combat Experience already rolled for this participant.");
  });

  it("requires phase1 CE for both reciprocal attackers when initiative difference is 3 or less", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      gladiatorInitiative: 6,
      guardInitiative: 4,
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const beforeCommit = state;

    expect(beforeCommit.currentStep).toBe("initiative_phase_1");
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: beforeCommit,
        visibility,
      }),
    ).toBeUndefined();
    const advanced = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state: beforeCommit,
      visibility,
    }).state;
    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.currentCursor?.step).toBe("A1");
    expect(advanced.phaseResolutionCursor).toBeUndefined();
    expect(
      getFirstCombatRoundPhaseCombatExperienceRequiredParticipantId({
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe("gladiator");
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toMatchObject({
      reason: "attacked_while_attacking",
      threats: [
        {
          attackerInitiative: 4,
          attackerParticipantId: "guard",
          initiativeDifference: 2,
          participantInitiative: 6,
          reason: "close_initiative",
        },
      ],
      trigger: "phase1_attack",
    });
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "guard",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: advanced,
        visibility,
      }),
    ).toBe("phase1_attack");
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
      }),
    ).toBe(false);
  });

  it("detects the round-1 reciprocal A1 scenario-target case before opening attack rolls", () => {
    const state = prepareScenarioTargetPhaseInitiativeCompleteState({
      gladiatorInitiative: 5,
      phase: "phase1",
      scyrianInitiative: 5,
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const beforeCommitReport = getCombatRoundPhaseCombatExperienceDetectionReport({
      phase: "phase1",
      state,
      visibility,
    });
    expect(beforeCommitReport.every((entry) => entry.required === false)).toBe(true);
    const advanced = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state,
      visibility,
    }).state;
    const report = getCombatRoundPhaseCombatExperienceDetectionReport({
      phase: "phase1",
      state: advanced,
      visibility,
    });
    const gladiatorReport = report.find((entry) => entry.participantId === "gladiator");
    const scyrianReport = report.find((entry) => entry.participantId === "scyrian");

    expect(gladiatorReport).toMatchObject({
      actionId: "attack_parry",
      hasA1A2AlreadyResolved: false,
      initiativeTotal: 5,
      phaseAttackCapable: true,
      phaseTargetActiveInEncounter: true,
      phaseTargetId: "scenario-scyrian",
      required: true,
    });
    expect(gladiatorReport?.detectedIncomingAttackers).toEqual([
      expect.objectContaining({
        actionId: "attack_parry",
        aware: true,
        initiativeTotal: 5,
        participantId: "scyrian",
        phaseAttackCapable: true,
        targetId: "scenario-gladiator",
        targetMatchesParticipant: true,
      }),
    ]);
    expect(scyrianReport).toMatchObject({
      actionId: "attack_parry",
      hasA1A2AlreadyResolved: false,
      initiativeTotal: 5,
      phaseAttackCapable: true,
      phaseTargetActiveInEncounter: true,
      phaseTargetId: "scenario-gladiator",
      required: true,
    });
    expect(scyrianReport?.detectedIncomingAttackers).toEqual([
      expect.objectContaining({
        actionId: "attack_parry",
        aware: true,
        initiativeTotal: 5,
        participantId: "gladiator",
        phaseAttackCapable: true,
        targetId: "scenario-scyrian",
        targetMatchesParticipant: true,
      }),
    ]);
    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 1,
      step: "A1",
    });
    expect(advanced.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: advanced,
        visibility,
      }),
    ).toBe("phase1_attack");
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "scyrian",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
      }),
    ).toBe(false);
  });

  it("opens the phase initiative resolution review rather than direct A1 attack after equal reciprocal i1", () => {
    const state = prepareScenarioTargetPhaseInitiativeCompleteState({
      gladiatorInitiative: 5,
      phase: "phase1",
      scyrianInitiative: 5,
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state,
        visibility,
      }),
    ).toBeUndefined();
    const advanced = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state,
      visibility,
    }).state;

    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 1,
      step: "A1",
    });
    expect(advanced.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: advanced,
        visibility,
      }),
    ).toBe("phase1_attack");
  });

  it("keeps the final command-backed i1 roll at initiative until GM commit opens CE", () => {
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const atInitiative = prepareScenarioTargetPhaseInitiativeStepState({ phase: "phase1" });
    const afterGladiatorRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "gladiator",
      phase: "phase1",
      state: atInitiative,
      submittedBy: "gm",
      visibility,
    });
    const afterScyrianRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "scyrian",
      phase: "phase1",
      state: afterGladiatorRoll,
      submittedBy: "gm",
      visibility,
    });

    expect(isCombatRoundPhaseInitiativeComplete({ phase: "phase1", state: afterScyrianRoll })).toBe(
      true,
    );
    expect(afterScyrianRoll.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "scyrian",
        roundNumber: 2,
        step: "i1",
      },
      beforeCursor: {
        participantId: "scyrian",
        roundNumber: 2,
        step: "i1",
      },
      type: "roll_initiative_phase1",
    });
    expect(afterScyrianRoll.currentStep).toBe("initiative_phase_1");
    expect(afterScyrianRoll.currentCursor).toEqual({
      participantId: "scyrian",
      roundNumber: 2,
      step: "i1",
    });
    expect(afterScyrianRoll.selectedParticipantId).toBe("scyrian");
    expect(afterScyrianRoll.selectedStep).toBe("initiative_phase_1");
    expect(afterScyrianRoll.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: afterScyrianRoll,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: afterScyrianRoll,
      }),
    ).toBe(false);

    const committed = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state: afterScyrianRoll,
      visibility,
    }).state;
    expect(committed.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "A1",
    });
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: committed,
        visibility,
      }),
    ).toBe("phase1_attack");
  });

  it("permits backing out after phase1 initiative commit", () => {
    const { state: gate, visibility } = prepareScenarioTargetPhaseCombatExperienceGate({
      gladiatorActionId: "double_attack",
      phase: "phase1",
      scyrianActionId: "double_attack",
    });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties: committedAttackPenaltiesFor({
        participantId: "gladiator",
        state: gate,
      }),
      combatContext: testPhaseContext("scenario-scyrian"),
    });

    expect(
      canBackOutCombatRoundPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: gate,
        visibility,
      }),
    ).toBe(true);

    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: gate,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility,
    });

    expect(backedOut.command).toMatchObject({
      facts: {
        attackActionId: "double_attack",
        choice: "back_out",
        reason: "Backed out while attacked",
        skippedAttack: true,
        softenedModifierIds: [expect.stringContaining("attack-phase-penalty")],
        source: "phase_initiative_resolution",
        trigger: "phase1_attack",
      },
      phase: "phase1",
      step: "A1",
      type: "submit_phase_initiative_choice",
    });
    expect(
      backedOut.state.commands.some((command) => command.type === "roll_combat_experience"),
    ).toBe(false);
    expect(
      backedOut.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.combatExperience,
    ).toBeUndefined();
    expect(
      backedOut.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.stepStatuses.phase_1_actions,
    ).toBe("skipped");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: backedOut.state,
      }).substep,
    ).toBe("done");
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: backedOut.state,
      }),
    ).toBe(false);
    expect(backedOut.state.currentCursor).toEqual({
      participantId: "scyrian",
      roundNumber: 2,
      step: "A1",
    });
    expect(backedOut.state.phaseResolutionCursor).toEqual({
      participantId: "scyrian",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      backedOut.combatContext.modifierBuckets.situationDb.find(
        (entry) => entry.sourceActionId === "double_attack" && entry.sourcePhase === "phase1",
      )?.value,
    ).toBe(-2);
    expect(
      backedOut.combatContext.modifierBuckets.situationDb.find(
        (entry) => entry.sourceActionId === "double_attack" && entry.sourcePhase === "phase2",
      )?.value,
    ).toBe(-4);
    expect(
      backedOut.combatContext.modifierBuckets.situationObSkill.find(
        (entry) => entry.id === DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
      )?.value,
    ).toBe(-1);
  });

  it("clears a submitted phase1 back-out choice back to the unresolved A1 gate", () => {
    const { state: gate, visibility } = prepareScenarioTargetPhaseCombatExperienceGate({
      gladiatorActionId: "double_attack",
      phase: "phase1",
      scyrianActionId: "double_attack",
    });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties: committedAttackPenaltiesFor({
        participantId: "gladiator",
        state: gate,
      }),
      combatContext: testPhaseContext("scenario-scyrian"),
    });
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: gate,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility,
    });
    const cleared = clearCombatRoundStep({
      state: backedOut.state,
      step: "phase_1_actions",
    });
    const restoredContext = restoreCombatRoundBackOutCombatContextModifiers({
      combatContext: backedOut.combatContext,
      command: backedOut.command,
    });

    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "A1",
    });
    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: cleared,
        visibility,
      }),
    ).toBe("phase1_attack");
    expect(
      cleared.participants.find((participant) => participant.participantId === "gladiator")
        ?.stepStatuses.phase_1_actions,
    ).toBe("pending");
    expect(
      getCombatRoundPhaseInitiativeChoice({
        participantId: "gladiator",
        phase: "phase1",
        state: cleared,
      }),
    ).toBeUndefined();
    expect(
      restoredContext.modifierBuckets.situationDb.find(
        (entry) => entry.sourceActionId === "double_attack" && entry.sourcePhase === "phase1",
      )?.value,
    ).toBe(-4);
  });

  it("backs out even when no generated DB/Parry modifier can be softened", () => {
    const { state: gate, visibility } = prepareScenarioTargetPhaseCombatExperienceGate({
      phase: "phase1",
    });
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext: testPhaseContext("scenario-scyrian"),
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: gate,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility,
    });

    expect(backedOut.command.facts.modifierSofteningWarning).toBe(
      "No generated attack DB/Parry -4 modifier was found to soften.",
    );
    expect(backedOut.combatContext.modifierBuckets.situationDb).toEqual([]);
    expect(
      backedOut.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.stepStatuses.phase_1_actions,
    ).toBe("skipped");
    expect(
      getCombatRoundPhaseInitiativeChoice({
        participantId: "gladiator",
        phase: "phase1",
        state: backedOut.state,
      })?.choice,
    ).toBe("back_out");
  });

  it("explicit initiative commit opens A1 after completed i1", () => {
    const atInitiative = prepareScenarioTargetPhaseInitiativeStepState({ phase: "phase1" });
    const state = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "scyrian",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [5],
          rollTotal: 5,
          total: 5,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: atInitiative,
      }),
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });

    expect(advanced.commands.at(-1)?.type).toBe("commit_phase_initiative_resolution");
    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "A1",
    });
    expect(advanced.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: advanced,
        visibility,
      }),
    ).toBe("phase1_attack");
  });

  it.each(["phase1", "phase2"] as const)(
    "persists compact %s initiative undo facts and restores the exact pre-commit state after reload",
    (phase) => {
      const beforeCommit = preparePhaseInitiativeCompleteState({
        actionId: "attack_parry",
        gladiatorInitiative: 6,
        guardInitiative: 6,
        phase,
      });
      const committed = commitCombatRoundPhaseInitiativeResolution({
        command: {
          createdAt: phase === "phase1" ? "2026-01-01T00:03:00.000Z" : "2026-01-01T00:06:00.000Z",
          createdByUserId: "gm-1",
        },
        phase,
        state: beforeCommit,
      });
      const command = committed.command;
      const undoFacts = combatRoundInitiativeCommitUndoFactsSchema.parse(
        command.facts.initiativeCommitUndo,
      );

      expect(command.facts).not.toHaveProperty("previousState");
      expect(undoFacts).toMatchObject({
        commandId: command.id,
        phase,
        roundNumber: beforeCommit.roundNumber,
        version: 1,
      });
      expect(JSON.stringify(command).length).toBeLessThan(20_000);

      const reloaded = combatRoundStateSchema.parse(
        JSON.parse(JSON.stringify(committed.state)) as unknown,
      );
      const undone = clearCombatRoundStep({
        state: reloaded,
        step: phase === "phase1" ? "phase_1_actions" : "phase_2_actions",
      });

      expect(undone).toEqual(beforeCommit);
    },
  );

  it("restores initiative-opened Feint and Adjust Distance proposal status and ordering", () => {
    const base = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      phase: "phase1",
    });
    const beforeCommit = combatRoundStateSchema.parse({
      ...base,
      adjustDistanceProposals: [
        {
          attackerParticipantId: "gladiator",
          currentDistance: 3,
          defenderParticipantId: "guard",
          direction: "closer",
          id: "adjust-gladiator",
          pairId: "gladiator:guard",
          phase1OpportunityId: "adjust-gladiator-a1",
          phase2AttackOpportunityId: "adjust-gladiator-a2",
          requestedDistance: 1,
          roundNumber: base.roundNumber,
          status: "awaiting_action_turn",
        },
        {
          attackerParticipantId: "guard",
          currentDistance: 3,
          defenderParticipantId: "gladiator",
          direction: "unchanged",
          id: "adjust-guard",
          pairId: "gladiator:guard",
          phase1OpportunityId: "adjust-guard-a1",
          phase2AttackOpportunityId: "adjust-guard-a2",
          requestedDistance: 3,
          roundNumber: base.roundNumber,
          status: "committed",
        },
      ],
      feintProposals: [
        {
          attackerParticipantId: "gladiator",
          attackerSkillId: "dodge",
          attackerSkillLabel: "Dodge",
          defenderParticipantId: "guard",
          defenderSkillId: "brawling",
          defenderSkillLabel: "Brawling",
          id: "feint-gladiator",
          method: "movement",
          pairId: "gladiator:guard",
          phase1OpportunityId: "feint-gladiator-a1",
          phase2AttackOpportunityId: "feint-gladiator-a2",
          roundNumber: base.roundNumber,
          status: "awaiting_action_turn",
        },
        {
          attackerParticipantId: "guard",
          attackerSkillId: "dodge",
          attackerSkillLabel: "Dodge",
          defenderParticipantId: "gladiator",
          defenderSkillId: "brawling",
          defenderSkillLabel: "Brawling",
          id: "feint-guard",
          method: "movement",
          pairId: "gladiator:guard",
          phase1OpportunityId: "feint-guard-a1",
          phase2AttackOpportunityId: "feint-guard-a2",
          roundNumber: base.roundNumber,
          status: "committed",
        },
      ],
    });
    const committed = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state: beforeCommit,
    });

    expect(committed.state.feintProposals.map((proposal) => proposal.id)).toEqual([
      "feint-guard",
      "feint-gladiator",
    ]);
    expect(committed.state.adjustDistanceProposals.map((proposal) => proposal.id)).toEqual([
      "adjust-guard",
      "adjust-gladiator",
    ]);
    expect(
      clearCombatRoundStep({
        state: combatRoundStateSchema.parse(JSON.parse(JSON.stringify(committed.state)) as unknown),
        step: "phase_1_actions",
      }),
    ).toEqual(beforeCommit);
  });

  it("keeps initiative undo facts bounded when unrelated command history grows", () => {
    const base = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      phase: "phase1",
    });
    const withLargeUnrelatedHistory = combatRoundStateSchema.parse({
      ...base,
      commands: base.commands.map((command, index) => ({
        ...command,
        facts: {
          ...command.facts,
          unrelatedAuditText: `${index}:`.padEnd(100_000, "x"),
        },
      })),
    });
    const compactBase = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state: base,
    }).command;
    const compactWithHistory = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state: withLargeUnrelatedHistory,
    }).command;
    const baseSize = JSON.stringify(compactBase).length;
    const historySize = JSON.stringify(compactWithHistory).length;

    expect(historySize).toBeLessThan(20_000);
    expect(Math.abs(historySize - baseSize)).toBeLessThan(200);
    expect(JSON.stringify(compactWithHistory)).not.toContain("unrelatedAuditText");
    expect(compactWithHistory.facts).not.toHaveProperty("previousState");
  });

  it("rejects recursive command and history fields in compact initiative undo facts", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      phase: "phase1",
    });
    const command = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state,
    }).command;
    const undoFacts = command.facts.initiativeCommitUndo;

    expect(
      combatRoundInitiativeCommitUndoFactsSchema.safeParse({
        ...(undoFacts as Record<string, unknown>),
        commands: state.commands,
      }).success,
    ).toBe(false);
    expect(
      combatRoundInitiativeCommitUndoFactsSchema.safeParse({
        ...(undoFacts as Record<string, unknown>),
        previousState: state,
      }).success,
    ).toBe(false);
  });

  it("continues to undo legacy initiative commits containing previousState", () => {
    const beforeCommit = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      phase: "phase1",
    });
    const committed = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase1",
      state: beforeCommit,
    });
    const legacyCommand = {
      ...committed.command,
      facts: {
        ...committed.command.facts,
        initiativeCommitUndo: undefined,
        previousState: beforeCommit,
      },
    };
    const legacyState = combatRoundStateSchema.parse({
      ...committed.state,
      commands: [...committed.state.commands.slice(0, -1), legacyCommand],
    });

    expect(
      clearCombatRoundStep({
        state: legacyState,
        step: "phase_1_actions",
      }),
    ).toEqual(beforeCommit);
  });

  it("keeps completed i1 in initiative review until GM commits normal A1", () => {
    const atInitiative = prepareScenarioTargetPhaseInitiativeStepState({
      phase: "phase1",
      scyrianActionId: "parry_attack",
    });
    const afterGladiatorRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "gladiator",
      phase: "phase1",
      state: atInitiative,
      submittedBy: "gm",
    });
    const afterScyrianRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "scyrian",
      phase: "phase1",
      state: afterGladiatorRoll,
      submittedBy: "gm",
    });

    expect(afterScyrianRoll.currentStep).toBe("initiative_phase_1");
    expect(afterScyrianRoll.currentCursor).toMatchObject({
      step: "i1",
    });
    expect(
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: "phase1",
        state: afterScyrianRoll,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: afterScyrianRoll,
      }),
    ).toBe(false);

    const committed = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase1",
      state: afterScyrianRoll,
    });

    expect(committed.state.currentStep).toBe("phase_1_actions");
    expect(committed.state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "A1",
    });
    expect(committed.state.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: committed.state,
      }),
    ).toBe(true);
  });

  it("opens A1 for a participant after their only required phase CE check is resolved", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
      participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
    ];
    const declared = declareTestRoundAction({
      actionId: "attack_parry",
      participantId: "scyrian",
      phase1Target: "scenario-gladiator",
      phase2Target: "scenario-gladiator",
      state: declareTestRoundAction({
        actionId: "parry_attack",
        participantId: "guard",
        phase1Target: "scenario-gladiator",
        phase2Target: "scenario-gladiator",
        state: declareTestRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          phase1Target: "scenario-guard",
          phase2Target: "scenario-guard",
          state: initializeCombatRoundState({
            encounter: encounter({ participants: encounterParticipants }),
          }),
        }),
      }),
    });
    const atInitiative = advanceToStep(declared, "initiative_phase_1");
    const state = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [1], rollTotal: 1, total: 1 },
      participantId: "guard",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "scyrian",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [6],
            rollTotal: 6,
            total: 6,
          },
          participantId: "gladiator",
          phase: "phase1",
          state: atInitiative,
        }),
      }),
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
    };
    const gate = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-gladiator",
      },
      participantId: "gladiator",
      skillTotal: 26,
      state: gate,
      visibility,
    });

    expect(gate.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(gate.phaseResolutionCursor).toBeUndefined();
    expect(rolled.result).toMatchObject({
      noRollRequired: true,
      trigger: "phase1_attack",
    });
    expect(
      rolled.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.combatExperience?.trigger,
    ).toBe("phase1_attack");
    expect(rolled.state.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: rolled.state,
      }),
    ).toBe(true);
  });

  it("requires phase1 CE only for the lower-initiative reciprocal attacker when difference is greater than 3", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      gladiatorInitiative: 9,
      guardInitiative: 4,
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });

    expect(advanced.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A1",
    });
    expect(
      getCombatRoundPhaseInitiativeChoiceStatuses({
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toMatchObject([
      { participantId: "gladiator", ceRequired: false, unresolved: true },
      { participantId: "guard", ceRequired: true, unresolved: true },
    ]);
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe(false);
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "guard",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toMatchObject({
      threats: [
        {
          attackerInitiative: 9,
          attackerParticipantId: "gladiator",
          initiativeDifference: 5,
          participantInitiative: 4,
          reason: "lower_initiative",
        },
      ],
    });
    expect(
      getCombatRoundPhaseAttackBackOutOpportunity({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toMatchObject({
      ceRequired: false,
      reason: "attacked_while_attacking",
      threats: [
        {
          attackerInitiative: 4,
          attackerParticipantId: "guard",
          initiativeDifference: 5,
          participantInitiative: 9,
          reason: "higher_initiative",
        },
      ],
    });
    expect(
      canBackOutCombatRoundPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
    expect(
      canBackOutCombatRoundPhaseAttack({
        participantId: "guard",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
  });

  it("backs out a higher-initiative threatened attacker without recording phase CE", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      gladiatorInitiative: 9,
      guardInitiative: 4,
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      attackPhaseDefensivePenalties: committedAttackPenaltiesFor({
        participantId: "gladiator",
        state: advanced,
      }),
      combatContext: testPhaseContext("guard"),
    });
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: advanced,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility,
    });

    expect(backedOut.command).toMatchObject({
      facts: {
        backOutAvailableReason: "attacked_while_attacking",
        ceWasRequired: false,
        initiativeComparison: [
          {
            attackerParticipantId: "guard",
            initiativeDifference: 5,
            reason: "higher_initiative",
          },
        ],
        skippedAttack: true,
        source: "phase_initiative_resolution",
      },
      type: "submit_phase_initiative_choice",
    });
    expect(
      backedOut.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.combatExperience,
    ).toBeUndefined();
    expect(
      backedOut.state.commands.some((command) => command.type === "roll_combat_experience"),
    ).toBe(false);
    expect(
      backedOut.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.stepStatuses.phase_1_actions,
    ).toBe("skipped");
    expect(
      backedOut.combatContext.modifierBuckets.situationDb.find(
        (entry) => entry.sourceActionId === "attack_parry" && entry.sourcePhase === "phase1",
      )?.value,
    ).toBe(-2);
    expect(backedOut.state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A1",
    });
    expect(backedOut.state.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "guard",
        phase: "phase1",
        state: backedOut.state,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      canPlayerRollCombatAttack({
        participantId: "guard",
        phase: "phase1",
        state: backedOut.state,
      }),
    ).toBe(true);
  });

  it("allows a higher-initiative threatened attacker to continue normally after required CE clears", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      gladiatorInitiative: 9,
      guardInitiative: 4,
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });
    const guardConfirmed = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      skillTotal: 30,
      state: advanced,
      visibility,
    });

    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "gladiator",
        phase: "phase1",
        state: guardConfirmed.state,
        visibility,
      }),
    ).toBe(false);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: guardConfirmed.state,
      }),
    ).toBe(true);
    expect(
      canBackOutCombatRoundPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: guardConfirmed.state,
        visibility,
      }),
    ).toBe(true);

    const continued = continueCombatRoundPhaseAttack({
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: guardConfirmed.state,
      visibility,
    });
    expect(continued.state.currentStep).toBe("phase_1_actions");
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: continued.state,
      }),
    ).toBe(true);
  });

  it("requires phase CE when attacked by a seen third party while attacking", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
      participant({ id: "archer", label: "Hidden archer" }),
    ];
    const declared = declareTestRoundAction({
      actionId: "attack_parry",
      participantId: "archer",
      phase1Target: "gladiator",
      phase2Target: "gladiator",
      state: declareTestRoundAction({
        participantId: "guard",
        state: declareTestRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          phase1Target: "guard",
          phase2Target: "guard",
          state: initializeCombatRoundState({
            encounter: encounter({ participants: encounterParticipants }),
          }),
        }),
      }),
    });
    const atInitiative = advanceToStep(declared, "initiative_phase_1");
    const state = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 9, total: 9 },
      participantId: "archer",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [2],
            rollTotal: 2,
            total: 2,
          },
          participantId: "guard",
          phase: "phase1",
          state: atInitiative,
        }),
      }),
    });
    const visibility = {
      gladiator: { archer: true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });

    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toMatchObject({
      threats: [
        {
          attackerParticipantId: "archer",
          initiativeDifference: 5,
          reason: "lower_initiative",
        },
      ],
    });
  });

  it("offers third-party back-out without CE when the threatened attacker wins initiative by more than 3", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
      participant({ id: "archer", label: "Hidden archer" }),
    ];
    const declared = declareTestRoundAction({
      actionId: "attack_parry",
      participantId: "archer",
      phase1Target: "gladiator",
      phase2Target: "gladiator",
      state: declareTestRoundAction({
        participantId: "guard",
        state: declareTestRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          phase1Target: "guard",
          phase2Target: "guard",
          state: initializeCombatRoundState({
            encounter: encounter({ participants: encounterParticipants }),
          }),
        }),
      }),
    });
    const atInitiative = advanceToStep(declared, "initiative_phase_1");
    const state = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "archer",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 9,
          total: 9,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [2],
            rollTotal: 2,
            total: 2,
          },
          participantId: "guard",
          phase: "phase1",
          state: atInitiative,
        }),
      }),
    });
    const visibility = {
      gladiator: { archer: true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });

    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundPhaseAttackBackOutOpportunity({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toMatchObject({
      ceRequired: false,
      threats: [
        {
          attackerParticipantId: "archer",
          initiativeDifference: 5,
          reason: "higher_initiative",
        },
      ],
    });
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
      }),
    ).toBe(true);
    expect(
      canBackOutCombatRoundPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
  });

  it("does not require phase CE when the incoming third-party attacker is unseen", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
      participant({ id: "archer", label: "Hidden archer" }),
    ];
    const declared = declareTestRoundAction({
      actionId: "attack_parry",
      participantId: "archer",
      phase1Target: "gladiator",
      phase2Target: "gladiator",
      state: declareTestRoundAction({
        participantId: "guard",
        state: declareTestRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          phase1Target: "guard",
          phase2Target: "guard",
          state: initializeCombatRoundState({
            encounter: encounter({ participants: encounterParticipants }),
          }),
        }),
      }),
    });
    const atInitiative = advanceToStep(declared, "initiative_phase_1");
    const state = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 9, total: 9 },
      participantId: "archer",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [2],
            rollTotal: 2,
            total: 2,
          },
          participantId: "guard",
          phase: "phase1",
          state: atInitiative,
        }),
      }),
    });
    const visibility = {
      gladiator: { archer: false },
    };
    const advanced = advanceCombatRoundStep(state, { visibility });

    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundPhaseAttackBackOutOpportunity({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
  });

  it("does not require phase CE for a participant who is not attacking in that phase", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
      participant({ id: "archer", label: "Hidden archer" }),
    ];
    const declared = declareTestRoundAction({
      actionId: "attack_parry",
      participantId: "archer",
      phase1Target: "gladiator",
      phase2Target: "gladiator",
      state: declareTestRoundAction({
        participantId: "guard",
        state: declareTestRoundAction({
          actionId: "parry_attack",
          participantId: "gladiator",
          phase1Target: "guard",
          phase2Target: "guard",
          state: initializeCombatRoundState({
            encounter: encounter({ participants: encounterParticipants }),
          }),
        }),
      }),
    });
    const atInitiative = advanceToStep(declared, "initiative_phase_1");
    const state = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 9, total: 9 },
      participantId: "archer",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [2],
            rollTotal: 2,
            total: 2,
          },
          participantId: "guard",
          phase: "phase1",
          state: atInitiative,
        }),
      }),
    });
    const visibility = {
      gladiator: { archer: true },
    };
    const advanced = advanceCombatRoundStep(state, { visibility });

    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundPhaseAttackBackOutOpportunity({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
      }),
    ).toBeUndefined();
  });

  it("requires phase2 CE for both reciprocal scenario-target attackers at equal initiative", () => {
    const state = prepareScenarioTargetPhaseInitiativeCompleteState({
      gladiatorActionId: "parry_attack",
      gladiatorInitiative: 5,
      phase: "phase2",
      scyrianActionId: "parry_attack",
      scyrianInitiative: 5,
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const beforeCommit = state;

    expect(beforeCommit.currentStep).toBe("initiative_phase_2");
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "gladiator",
        phase: "phase2",
        state: beforeCommit,
        visibility,
      }),
    ).toBe(false);
    const advanced = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-01-01T00:03:00.000Z" },
      phase: "phase2",
      state: beforeCommit,
      visibility,
    }).state;
    expect(advanced.currentStep).toBe("phase_2_actions");
    expect(advanced.currentCursor?.step).toBe("A2");
    expect(advanced.phaseResolutionCursor).toBeUndefined();
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "gladiator",
        phase: "phase2",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "scyrian",
        phase: "phase2",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
  });

  it("keeps the final command-backed i2 roll at initiative until GM commit opens CE", () => {
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const atInitiative = prepareScenarioTargetPhaseInitiativeStepState({
      gladiatorActionId: "parry_attack",
      phase: "phase2",
      scyrianActionId: "parry_attack",
    });
    const afterGladiatorRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "gladiator",
      phase: "phase2",
      state: atInitiative,
      submittedBy: "gm",
      visibility,
    });
    const afterScyrianRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "scyrian",
      phase: "phase2",
      state: afterGladiatorRoll,
      submittedBy: "gm",
      visibility,
    });

    expect(isCombatRoundPhaseInitiativeComplete({ phase: "phase2", state: afterScyrianRoll })).toBe(
      true,
    );
    expect(afterScyrianRoll.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "scyrian",
        roundNumber: 2,
        step: "i2",
      },
      beforeCursor: {
        participantId: "scyrian",
        roundNumber: 2,
        step: "i2",
      },
      type: "roll_initiative_phase2",
    });
    expect(afterScyrianRoll.currentStep).toBe("initiative_phase_2");
    expect(afterScyrianRoll.currentCursor).toEqual({
      participantId: "scyrian",
      roundNumber: 2,
      step: "i2",
    });
    expect(afterScyrianRoll.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: afterScyrianRoll,
        visibility,
      }),
    ).toBeUndefined();

    const committed = commitPreparedPhaseInitiative({
      phase: "phase2",
      state: afterScyrianRoll,
      visibility,
    });
    expect(committed.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "A2",
    });
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: committed,
        visibility,
      }),
    ).toBe("phase2_attack");
  });

  it("backs out from a phase2 CE gate and softens the phase2 DB/Parry attack modifier", () => {
    const { state: gate, visibility } = prepareScenarioTargetPhaseCombatExperienceGate({
      gladiatorActionId: "parry_attack",
      phase: "phase2",
      scyrianActionId: "parry_attack",
    });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      attackPhaseDefensivePenalties: committedAttackPenaltiesFor({
        participantId: "gladiator",
        state: gate,
      }),
      combatContext: testPhaseContext("scenario-scyrian"),
    });
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase2",
      state: gate,
      updatedAt: "2026-01-01T00:05:00.000Z",
      visibility,
    });

    expect(backedOut.command).toMatchObject({
      facts: {
        attackActionId: "parry_attack",
        choice: "back_out",
        softenedModifierIds: [expect.stringContaining("attack-phase-penalty")],
        trigger: "phase2_attack",
      },
      phase: "phase2",
      step: "A2",
      type: "submit_phase_initiative_choice",
    });
    expect(
      backedOut.state.participants.find((participant) => participant.participantId === "gladiator")
        ?.stepStatuses.phase_2_actions,
    ).toBe("skipped");
    expect(
      backedOut.combatContext.modifierBuckets.situationDb.find(
        (entry) => entry.sourceActionId === "parry_attack" && entry.sourcePhase === "phase2",
      )?.value,
    ).toBe(-2);
  });

  it("does not create phase1 CE from a Parry-Attack declaration without a phase1 attack", () => {
    const state = prepareScenarioTargetPhaseInitiativeCompleteState({
      gladiatorActionId: "attack_parry",
      gladiatorInitiative: 5,
      phase: "phase1",
      scyrianActionId: "parry_attack",
      scyrianInitiative: 5,
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });

    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "scyrian",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(advanced.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
      }),
    ).toBe(true);
  });

  it("does not require scenario-target phase CE from unseen reciprocal attackers", () => {
    const state = prepareScenarioTargetPhaseInitiativeCompleteState({
      gladiatorInitiative: 5,
      phase: "phase1",
      scyrianInitiative: 5,
    });
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": false },
      "scenario-scyrian": { "scenario-gladiator": false },
    };
    const advanced = advanceCombatRoundStep(state, { visibility });
    const report = getCombatRoundPhaseCombatExperienceDetectionReport({
      phase: "phase1",
      state: advanced,
      visibility,
    });

    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "gladiator",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundPhaseCombatExperienceRequirement({
        participantId: "scyrian",
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(report).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: "gladiator",
          reasonIfNo: "incoming phase attacker is not visible or known to this participant",
          required: false,
        }),
        expect.objectContaining({
          participantId: "scyrian",
          reasonIfNo: "incoming phase attacker is not visible or known to this participant",
          required: false,
        }),
      ]),
    );
    expect(advanced.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
  });

  it("opens A1 after all required phase-1 CE rolls are resolved in any order", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const gate = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });
    const rolledGuard = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-guard",
      },
      participantId: "guard",
      skillTotal: 26,
      state: gate,
      visibility,
    });
    const rolledGladiator = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "player-gladiator",
      },
      participantId: "gladiator",
      skillTotal: 26,
      state: rolledGuard.state,
      visibility,
    });

    expect(rolledGuard.result).toMatchObject({
      noRollRequired: true,
      trigger: "phase1_attack",
    });
    expect(rolledGuard.command).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      phase: "phase1",
      step: "A1",
      type: "roll_combat_experience",
    });
    expect(rolledGuard.state.currentCursor?.participantId).toBe("gladiator");
    expect(rolledGladiator.state.currentStep).toBe("phase_1_actions");
    expect(rolledGladiator.state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(rolledGladiator.state.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: rolledGladiator.state,
        visibility,
      }),
    ).toBeUndefined();
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: rolledGladiator.state,
      }),
    ).toBe(true);
    expect(rolledGladiator.state.commands.at(-1)).toMatchObject({
      facts: {
        trigger: "phase1_attack",
      },
      phase: "phase1",
      step: "A1",
      type: "roll_combat_experience",
    });
    expect(getLatestCombatEventSummary(rolledGladiator.state)?.summaryText).toBe(
      "Round 3, A1: The Gladiator Combat Experience 26 vs 26. Result: Attack continues, no roll required. No modifier.",
    );
  });

  it("does not gate phase CE for attacks from explicitly unseen opponents", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: false },
      guard: { gladiator: false },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });

    expect(
      getFirstCombatRoundPhaseCombatExperienceRequiredParticipantId({
        phase: "phase1",
        state: advanced,
        visibility,
      }),
    ).toBeUndefined();
    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(advanced.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
  });

  it("gates A2 behind the same phase CE check after i2", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "parry_attack",
      gladiatorInitiative: 6,
      guardInitiative: 4,
      phase: "phase2",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const advanced = commitPreparedPhaseInitiative({ phase: "phase2", state, visibility });

    expect(advanced.currentStep).toBe("phase_2_actions");
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A2",
    });
    expect(advanced.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: advanced,
        visibility,
      }),
    ).toBe("phase2_attack");
    expect(
      isCombatRoundPhaseCombatExperienceRollRequired({
        participantId: "guard",
        phase: "phase2",
        state: advanced,
        visibility,
      }),
    ).toBe(true);
  });

  it("cancels the pending phase attack on a phase CE result of 5 or less", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      gladiatorInitiative: 9,
      guardInitiative: 4,
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const gate = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
      },
      participantId: "guard",
      rng: () => 0.2,
      skillTotal: 0,
      state: gate,
      visibility,
    });

    expect(rolled.result).toMatchObject({
      effectiveTableTotal: 0,
      label: "No attack",
      modifierValue: 0,
      trigger: "phase1_attack",
    });
    expect(rolled.command.facts).toMatchObject({
      phaseAttackCancelled: true,
      trigger: "phase1_attack",
    });
    expect(rolled.state.participants[1]?.stepStatuses.phase_1_actions).toBe("skipped");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "guard",
        phase: "phase1",
        state: rolled.state,
      }),
    ).toMatchObject({ substep: "done" });
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "guard",
        phase: "phase1",
        state: rolled.state,
      }),
    ).toBeUndefined();

    expect(rolled.command.facts.phaseAttackCancelled).toBe(true);

    const cleared = clearCombatRoundStep({ state: rolled.state, step: "phase_1_actions" });

    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.participants[1]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(
      getCombatRoundPhaseInitiativeChoice({
        participantId: "guard",
        phase: "phase1",
        state: cleared,
      })?.choice,
    ).toBeUndefined();
  });

  it("applies phase CE OB modifiers only to the phase attack and clears them with the CE result", () => {
    const state = preparePhaseInitiativeCompleteState({
      actionId: "attack_parry",
      gladiatorInitiative: 9,
      guardInitiative: 4,
      phase: "phase1",
    });
    const visibility = {
      gladiator: { guard: true },
      guard: { gladiator: true },
    };
    const gate = commitPreparedPhaseInitiative({ phase: "phase1", state, visibility });
    const rolled = rollCombatRoundCombatExperience({
      combatEffects: { effects: [], events: [] },
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
      },
      combatContext: testPhaseContext("gladiator"),
      participantId: "guard",
      rng: () => 0.2,
      scenarioParticipantId: "scenario-guard",
      skillTotal: 10,
      state: gate,
      visibility,
    });
    const clearedState = clearCombatRoundStep({ state: rolled.state, step: "phase_1_actions" });
    const clearedContext = removeCombatRoundCombatExperienceCombatContextModifiers({
      combatContext: rolled.combatContext,
      command: rolled.command,
    });

    expect(rolled.result).toMatchObject({
      effectiveTableTotal: 10,
      modifierValue: -4,
      needsEffectRow: false,
      trigger: "phase1_attack",
    });
    expect(rolled.combatEffects.effects).toHaveLength(0);
    expect(rolled.combatContext.modifierBuckets.situationObSkill).toMatchObject([
      {
        generated: true,
        sourcePhase: "phase1",
        sourceRule: "combat-experience-phase1-attacked-while-attacking",
        value: -4,
      },
    ]);
    expect(clearedState.currentStep).toBe("phase_1_actions");
    expect(clearedState.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A1",
    });
    expect(clearedState.phaseResolutionCursor).toBeUndefined();
    expect(clearedState.participants[1]?.combatExperience).toBeUndefined();
    expect(
      getCombatRoundPhaseInitiativeChoice({
        participantId: "guard",
        phase: "phase1",
        state: clearedState,
      })?.choice,
    ).toBeUndefined();
    expect(clearedContext.modifierBuckets.situationObSkill).toEqual([]);
  });

  it("clears a command-backed phase CE result back to the A1 CE gate after final i1 advanced there", () => {
    const visibility = {
      "scenario-gladiator": { "scenario-scyrian": true },
      "scenario-scyrian": { "scenario-gladiator": true },
    };
    const atInitiative = prepareScenarioTargetPhaseInitiativeStepState({ phase: "phase1" });
    const afterGladiatorRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "gladiator",
      phase: "phase1",
      state: atInitiative,
      submittedBy: "gm",
      visibility,
    });
    const inputsRecorded = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "scyrian",
      phase: "phase1",
      state: afterGladiatorRoll,
      submittedBy: "gm",
      visibility,
    });
    const gate = commitPreparedPhaseInitiative({
      phase: "phase1",
      state: inputsRecorded,
      visibility,
    });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      skillTotal: 26,
      state: gate,
      visibility,
    });
    const cleared = clearCombatRoundStep({ state: rolled.state, step: "phase_1_actions" });

    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 2,
      step: "A1",
    });
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.phaseResolutionCursor).toBeUndefined();
    expect(
      getCombatRoundRequiredCombatExperienceTrigger({
        participantId: "gladiator",
        state: cleared,
        visibility,
      }),
    ).toBe("phase1_attack");
  });

  it("clears Combat Experience roll state and removes only created CE effects", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const existingEffects = combatEffectsWith([
      {
        description: "Existing modifier",
        effectGroup: "general",
        id: "existing-modifier",
        modifierValue: -1,
        type: "general_modifier",
      },
    ]);
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      combatEffects: existingEffects,
      participantId: "gladiator",
      rng: () => 0.2,
      skillTotal: 10,
      state,
    });
    const command = rolled.state.commands.at(-1);
    const clearedState = clearCombatRoundStep({ state: rolled.state, step: "select_actions" });
    const clearedEffects = command
      ? removeCombatRoundCombatExperienceEffects({
          combatEffects: rolled.combatEffects,
          command,
        })
      : rolled.combatEffects;
    const contextWithImportedEffect = mergePersistentCombatEffectModifiers({
      combatEffects: rolled.combatEffects,
    });
    const contextAfterUndo = mergePersistentCombatEffectModifiers({
      combatContext: contextWithImportedEffect,
      combatEffects: clearedEffects,
    });

    expect(clearedState.participants[0]?.combatExperience).toBeUndefined();
    expect(clearedState.currentStep).toBe("select_actions");
    expect(clearedState.commands).toHaveLength(0);
    expect(clearedEffects.effects.map((effect) => effect.id)).toEqual(["existing-modifier"]);
    expect(contextWithImportedEffect.modifierBuckets.general).toContainEqual(
      expect.objectContaining({
        sourceEffectId: rolled.combatEffects.effects[1]?.id,
        sourceType: "character_effect",
      }),
    );
    expect(contextAfterUndo.modifierBuckets.general).toEqual([]);
  });

  it("clears no-roll Combat Experience confirmation without removing unrelated effects", () => {
    const state = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const existingEffects = combatEffectsWith([
      {
        description: "Existing modifier",
        effectGroup: "general",
        id: "existing-modifier",
        modifierValue: -1,
        type: "general_modifier",
      },
    ]);
    const confirmed = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      combatEffects: existingEffects,
      participantId: "gladiator",
      skillTotal: 26,
      state,
    });
    const command = confirmed.state.commands.at(-1);
    const clearedState = clearCombatRoundStep({ state: confirmed.state, step: "select_actions" });
    const clearedEffects = command
      ? removeCombatRoundCombatExperienceEffects({
          combatEffects: confirmed.combatEffects,
          command,
        })
      : confirmed.combatEffects;

    expect(confirmed.result.noRollRequired).toBe(true);
    expect(confirmed.combatEffects.effects.map((effect) => effect.id)).toEqual([
      "existing-modifier",
    ]);
    expect(clearedState.participants[0]?.combatExperience).toBeUndefined();
    expect(clearedState.commands).toHaveLength(0);
    expect(clearedEffects.effects.map((effect) => effect.id)).toEqual(["existing-modifier"]);
  });

  it("ticks CE modifier rows through normal SU duration countdown", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        description: "combat exp active -1",
        duration: "1 round",
        effectGroup: "general",
        id: "ce-active-1",
        modifierValue: -1,
        type: "general_modifier",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
        },
      },
      state: roundSummaryState,
    });

    expect(
      reviewed.roundEndReview?.participantReviews.gladiator?.proposedRemovals[0],
    ).toMatchObject({
      effectId: "ce-active-1",
      kind: "duration_expire",
    });
  });

  it("retains a deterministic empty SU completion event without publishing a review result", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      "round_summary",
    );
    const reviewed = prepareCombatRoundEndReview({ state: roundSummaryState });
    const committed = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:10:00.000Z" },
      deterministicNoWorkCompletion: true,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });
    const event = committed.state.events.at(-1);

    expect(committed.command.facts.deterministicNoWorkCompletion).toBe(true);
    expect(event).toMatchObject({ type: "participant_su_review" });
    expect(event?.facts.publicOutcome).toEqual({ changed: false, workflowOnly: true });
    expect(event?.facts.resultPresentation).toBeUndefined();
  });

  it("persists canonical CE duration transitions through SU and reload", () => {
    const declarationState = openCombatExperienceWindow(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
    );
    const rolled = rollCombatRoundCombatExperience({
      command: { createdAt: "2026-01-01T00:01:00.000Z" },
      createdRevision: "revision-ce-created",
      encounterId: "encounter-1",
      participantId: "gladiator",
      rng: () => 0.2,
      scenarioParticipantId: "scenario-gladiator",
      skillTotal: 10,
      state: declarationState,
    });
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 1 }) }),
      "round_summary",
    );
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: { combatEffects: rolled.combatEffects },
      },
      state: roundSummaryState,
    });
    const committed = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:10:00.000Z" },
      combatEffects: rolled.combatEffects,
      createdRevision: "revision-ce-reviewed",
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });
    const reloaded = combatEffectsStateSchema.parse(
      JSON.parse(JSON.stringify(committed.combatEffects)),
    );
    const effect = reloaded.effects[0];

    expect(effect?.canonicalLifecycle).toMatchObject({
      lifecycle: { duration: { kind: "rounds", remaining: 3 }, state: "active" },
      version: 2,
    });
    expect(effect?.canonicalTransitions?.[0]).toMatchObject({
      reason: "duration_decremented",
      transitionType: "update",
    });
    expect(
      buildLiveCombatModifierContributionProjection({
        combatEffects: reloaded,
        currentRound: 2,
        encounterId: "encounter-1",
        ownerParticipantId: "scenario-gladiator",
      }).contributions,
    ).toHaveLength(1);
  });

  it("does not reuse combat round state stamped for another encounter", () => {
    const encounterAState = combatRoundStateSchema.parse({
      ...preparePhaseResolutionState({
        guardActionId: "attack_parry",
        gladiatorActionId: "attack_parry",
        phase: "phase1",
      }),
      encounterId: "encounter-a",
    });
    const encounterBState = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: encounterAState,
        id: "encounter-b",
      }),
    });

    expect(encounterBState.encounterId).toBe("encounter-b");
    expect(encounterBState.commands).toEqual([]);
    expect(encounterBState.currentStep).toBe("select_actions");
    expect(encounterBState.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(encounterBState.phaseResolutionCursor).toBeUndefined();
    expect(encounterBState.phaseResolutionResults).toEqual([]);
    expect(encounterBState.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(encounterBState.selectedParticipantId).toBe("gladiator");
    expect(encounterBState.selectedStep).toBe("select_actions");
  });

  it("does not treat a clean initial round as clearable state", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const declared = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("guard"),
        },
        roundNumber: state.roundNumber,
      },
      participantId: "gladiator",
      state,
      submittedBy: "gm",
    });

    expect(canClearCombatRoundStep({ state, step: "select_actions" })).toBe(false);
    expect(canClearCombatRoundStep({ state: declared, step: "select_actions" })).toBe(true);
  });

  it("parses legacy round state without commands or current cursor", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const { commands, currentCursor, ...legacyState } = state;
    const parsed = combatRoundStateSchema.parse(legacyState);

    expect(commands).toEqual([]);
    expect(currentCursor).toMatchObject({ step: "DE" });
    expect(parsed.commands).toEqual([]);
    expect(parsed.currentCursor).toBeUndefined();
  });

  it("falls back to the first participant when persisted selection is invalid", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          selectedParticipantId: "missing",
          selectedStep: "select_actions",
        },
      }),
    });

    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("preserves a legacy manual DE participant selection when no current cursor exists", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const { currentCursor, ...legacyExisting } = existing;
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...legacyExisting,
          selectedParticipantId: "guard",
          selectedStep: "select_actions",
        },
      }),
    });

    expect(currentCursor).toMatchObject({ step: "DE" });
    expect(state.selectedParticipantId).toBe("guard");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("uses persisted currentCursor over stale selected participant for global steps", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          currentCursor: {
            participantId: "guard",
            roundNumber: existing.roundNumber,
            step: "DE",
          },
          selectedParticipantId: "gladiator",
          selectedStep: "select_actions",
        },
      }),
    });

    expect(state.selectedParticipantId).toBe("guard");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("resets stale phase selection when reinitializing a DE round", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          currentStep: "select_actions",
          phaseResolutionCursor: {
            participantId: "guard",
            phase: "phase1",
            substep: "damage",
          },
          selectedParticipantId: "guard",
          selectedStep: "phase_1_damage",
        },
      }),
    });

    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("repairs an unsupported A1 current cursor with no commands back to round start", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          commands: [],
          currentCursor: {
            participantId: "guard",
            roundNumber: existing.roundNumber,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: existing.participants.map((participant) =>
            participant.participantId === "guard"
              ? {
                  ...participant,
                  stepStatuses: {
                    ...participant.stepStatuses,
                    phase_1_actions: "gmEdited",
                  },
                }
              : participant,
          ),
          phaseResolutionCursor: undefined,
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          selectedParticipantId: "guard",
          selectedStep: "phase_1_actions",
          stepSnapshots: [
            stepSnapshot({
              id: "stale-a1-snapshot",
              participantId: "guard",
              roundNumber: existing.roundNumber,
              step: "phase_1_actions",
            }),
          ],
        },
      }),
    });

    expect(state.commands).toEqual([]);
    expect(state.currentStep).toBe("select_actions");
    expect(state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: existing.roundNumber,
      step: "DE",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(state.phaseResolutionResults).toEqual([]);
    expect(state.phaseResolutionStatuses).toEqual({});
    expect(state.stepSnapshots).toEqual([]);
    expect(state.selectedParticipantId).toBe("gladiator");
    expect(state.selectedStep).toBe("select_actions");
    expect(state.participants[1]?.stepStatuses.phase_1_actions).toBe("pending");
  });

  it("repairs a bare phaseResolutionCursor at A1 when no command or result supports it", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: {
          ...existing,
          commands: [],
          currentCursor: undefined,
          currentStep: "phase_1_actions",
          phaseResolutionCursor: {
            participantId: "guard",
            phase: "phase1",
            substep: "attack",
          },
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          selectedParticipantId: "guard",
          selectedStep: "phase_1_actions",
          stepSnapshots: [],
        },
      }),
    });

    expect(state.currentStep).toBe("select_actions");
    expect(state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: existing.roundNumber,
      step: "DE",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
  });

  it("keeps a command-supported A1 phase cursor intact after refresh", () => {
    const initial = initializeCombatRoundState({ encounter: encounter() });
    const withDeclarations = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:00:10.000Z",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("guard"),
        },
        roundNumber: initial.roundNumber,
      },
      participantId: "gladiator",
      state: recordCombatRoundDeclaration({
        command: {
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: testPhaseContext("gladiator"),
          },
          roundNumber: initial.roundNumber,
        },
        participantId: "guard",
        state: initial,
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const initiativeState = {
      ...withDeclarations,
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "gladiator",
      selectedStep: "initiative_phase_1" as const,
    };
    const withGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const withGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:10.000Z",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "guard",
      phase: "phase1",
      state: withGladiatorInitiative,
      submittedBy: "gm",
    });
    const openA1 = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withGuardInitiative,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const state = initializeCombatRoundState({
      encounter: encounter({ combatRoundState: openA1 }),
    });

    expect(state.currentStep).toBe("phase_1_actions");
    expect(state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: initial.roundNumber,
      step: "A1",
    });
    expect(state.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
  });

  it("repairs command-supported A1 when the declared target is outside the encounter", () => {
    const initial = initializeCombatRoundState({ encounter: encounter() });
    const withDeclaration = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("scyrian-from-another-encounter"),
        },
        roundNumber: initial.roundNumber,
      },
      participantId: "guard",
      state: initial,
      submittedBy: "gm",
    });
    const initiativeState = {
      ...withDeclaration,
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "guard",
      selectedStep: "initiative_phase_1" as const,
    };
    const withInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "guard",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const staleA1 = {
      ...withInitiative,
      currentCursor: {
        participantId: "guard",
        roundNumber: initial.roundNumber,
        step: "A1" as const,
      },
      currentStep: "phase_1_actions" as const,
      phaseResolutionCursor: {
        participantId: "guard",
        phase: "phase1" as const,
        substep: "attack" as const,
      },
      selectedParticipantId: "guard",
      selectedStep: "phase_1_actions" as const,
    };
    const state = initializeCombatRoundState({
      encounter: encounter({ combatRoundState: staleA1 }),
    });
    const guard = state.participants.find((participant) => participant.participantId === "guard");

    expect(state.currentStep).toBe("select_actions");
    expect(state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: initial.roundNumber,
      step: "DE",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(state.selectedParticipantId).toBe("guard");
    expect(state.selectedStep).toBe("select_actions");
    expect(guard?.declaration?.actionId).toBe("attack_parry");
    expect(guard?.declaration?.phaseContexts?.phase1?.targetParticipantId).toBeUndefined();
    expect(guard?.stepStatuses.select_actions).toBe("pending");
    expect(guard?.stepStatuses.phase_1_actions).toBe("pending");
  });

  it("advances steps in order and resets after round summary", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const reviewState = advanceCombatRoundStep(state);

    expect(reviewState.currentStep).toBe("review_action_modifiers");
    expect(reviewState.selectedStep).toBe("review_action_modifiers");
    expect(reviewState.participants[0]?.stepStatuses.select_actions).toBe("locked");

    const phase1Initiative = advanceCombatRoundStep(reviewState);
    const phase1Resolution = advanceCombatRoundStep(phase1Initiative);
    const phase2Review = advanceBoundary(
      phase1Resolution,
      "phase1_resolution",
      "phase2_modifier_review",
    );
    const phase2Initiative = advanceCombatRoundStep(phase2Review);
    const phase2Resolution = advanceCombatRoundStep(phase2Initiative);
    const roundSummaryState = advanceBoundary(phase2Resolution, "phase2_resolution", "round_end");
    const nextRoundState = advanceBoundary(
      completeCleanRoundEndReview(roundSummaryState),
      "round_boundary",
      "declaration",
    );

    expect(roundSummaryState.currentStep).toBe("round_summary");
    expect(nextRoundState.currentStep).toBe("select_actions");
    expect(nextRoundState.roundNumber).toBe(4);
    expect(nextRoundState.selectedParticipantId).toBe("gladiator");
    expect(nextRoundState.participants[0]?.stepStatuses.select_actions).toBe("pending");
  });

  it("starts a new round without stale declaration, initiative, attack, or phase-resolution state", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDeclaration = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const withInitiative = setCombatRoundParticipantInitiative({
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: withDeclaration,
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withInitiative,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const roundSummaryState: ReturnType<typeof initializeCombatRoundState> = {
      ...withResolution,
      currentStep: "round_summary",
      selectedParticipantId: "guard",
      selectedStep: "phase_1_damage",
    };
    const nextRoundState = advanceCombatRoundStep(completeCleanRoundEndReview(roundSummaryState));

    expect(nextRoundState.currentStep).toBe("select_actions");
    expect(nextRoundState.roundNumber).toBe(4);
    expect(nextRoundState.phaseResolutionCursor).toBeUndefined();
    expect(nextRoundState.phaseResolutionResults).toEqual([]);
    expect(nextRoundState.phaseResolutionStatuses).toEqual({});
    expect(nextRoundState.selectedParticipantId).toBe("gladiator");
    expect(nextRoundState.participants[0]?.declaration).toBeUndefined();
    expect(nextRoundState.participants[0]?.initiatives).toEqual({});
    expect(nextRoundState.participants[0]?.attackResults).toEqual({});
  });

  it("commits per-participant snapshots when advancing a step", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const snapshot = stepSnapshot({
      modifierSummary: {
        dbRaw: -4,
        generalFatigueRaw: -1,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [
          {
            bucketKey: "situation_db",
            entries: [
              {
                durationRounds: 1,
                generated: true,
                id: "generated-db",
                notes: "double attack",
                scope: "until",
                sourcePhase: "phase1",
                sourceRule: "double-attack-phase1-db-parry",
                value: -4,
              },
            ],
            label: "DB/Parry",
            total: -4,
          },
        ],
      },
      phasePanels: {
        phase1: {
          attackSummary: {
            attackMode: "Slash",
            dmb: "8",
            initiative: "12",
            maxCrits: "2",
            ob: "9",
            weaponName: "Broadsword",
          },
          distanceLabel: "Distance: 2",
          phaseContext: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetLocation: "chest",
            targetParticipantId: "guard",
          },
          targetOptions: [{ displayName: "City guard", id: "guard" }],
        },
        phase2: {
          defenseSummary: {
            db: "14",
            dm: "2",
            parry: "11",
            sourceName: "Broadsword / shield",
          },
          phaseContext: {
            mainHandParryDirection: "left_forward",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            offHandParryDirection: "right_forward",
          },
          targetOptions: [{ displayName: "City guard", id: "guard" }],
        },
      },
      participantId: "gladiator",
      phase: "phase1",
      phaseContext: {
        mainHandParryDirection: "left_forward",
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      step: "review_action_modifiers",
    });
    const advanced = advanceCombatRoundStep(state, { stepSnapshots: [snapshot] });

    expect(advanced.currentStep).toBe("initiative_phase_1");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: advanced,
        step: "review_action_modifiers",
      }),
    ).toMatchObject({
      modifierSummary: {
        dbRaw: -4,
        rows: [
          expect.objectContaining({
            bucketKey: "situation_db",
            total: -4,
          }),
        ],
      },
      participantId: "gladiator",
      phase: "phase1",
      step: "review_action_modifiers",
    });
  });

  it("keeps committed snapshots stable when later live state changes", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const advanced = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          modifierSummary: {
            dbRaw: -4,
            generalFatigueRaw: 0,
            initiativeRaw: 0,
            obSkillRaw: 0,
            rows: [],
          },
          participantId: "gladiator",
          phase: "phase1",
          step: "review_action_modifiers",
        }),
      ],
    });
    const liveChanged = recordCombatRoundDeclaration({
      declaration: {
        actionId: "double_attack",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: advanced,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: liveChanged,
        step: "review_action_modifiers",
      })?.modifierSummary?.dbRaw,
    ).toBe(-4);
  });

  it("preserves strict action selector and modifier panel facts in step snapshots", () => {
    const snapshot = combatRoundStepSnapshotSchema.parse({
      committedAt: "2026-01-01T00:02:00.000Z",
      declarationSummary: {
        actionId: "double_attack",
        actionLabel: "Double Attack",
        additionalActionNotes: "Press the guard",
        movementId: "step",
        movementLabel: "Step",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 2,
              source: "player_declared",
              targetParticipantId: "guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        movementPreferenceTargets: [{ displayName: "City guard", id: "guard" }],
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "goblin",
        },
        secondaryActionId: "observe_opponent",
        secondaryActionLabel: "Observe Opponent",
      },
      id: "snapshot-selector-modifiers",
      modifierSummary: {
        dbRaw: -4,
        generalFatigueRaw: -1,
        initiativeRaw: 2,
        obSkillRaw: -1,
        rows: [
          {
            bucketKey: "situation_db",
            entries: [
              {
                durationRounds: 1,
                generated: true,
                id: "double-attack-db",
                notes: "double attack",
                scope: "until",
                sourceActionId: "double_attack",
                sourcePhase: "phase1",
                sourceRule: "double-attack-phase1-db-parry",
                value: -4,
              },
            ],
            label: "DB/Parry",
            total: -4,
          },
        ],
      },
      phasePanels: {
        phase1: {
          attackSummary: {
            attackMode: "Slash",
            dmb: "8",
            initiative: "12",
            maxCrits: "2",
            ob: "9",
            weaponName: "Broadsword",
          },
          distanceLabel: "Distance: 2",
          phaseContext: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetLocation: "chest",
            targetParticipantId: "guard",
          },
          targetOptions: [{ displayName: "City guard", id: "guard" }],
        },
        phase2: {
          defenseSummary: {
            db: "14",
            dm: "2",
            parry: "11",
            sourceName: "Broadsword / shield",
          },
          phaseContext: {
            mainHandParryDirection: "left_forward",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            offHandParryDirection: "right_forward",
          },
          targetOptions: [{ displayName: "City guard", id: "guard" }],
        },
      },
      participantId: "gladiator",
      participantLabel: "The Gladiator",
      roundNumber: 3,
      step: "review_action_modifiers",
    });
    const changedLiveFacts = {
      actionId: "other",
      distanceLabel: "Distance: 8",
      modifierValue: 99,
      weaponName: "Current weapon",
    };

    expect(snapshot.declarationSummary).toMatchObject({
      actionId: "double_attack",
      actionLabel: "Double Attack",
      movementLabel: "Step",
      secondaryActionLabel: "Observe Opponent",
    });
    expect(snapshot.modifierSummary).toMatchObject({
      dbRaw: -4,
      generalFatigueRaw: -1,
      initiativeRaw: 2,
      obSkillRaw: -1,
      rows: [
        expect.objectContaining({
          entries: [expect.objectContaining({ notes: "double attack", value: -4 })],
          total: -4,
        }),
      ],
    });
    expect(snapshot.declarationSummary?.actionId).not.toBe(changedLiveFacts.actionId);
    expect(snapshot.modifierSummary?.rows[0]?.total).not.toBe(changedLiveFacts.modifierValue);
    expect(snapshot.phasePanels?.phase1).toMatchObject({
      attackSummary: { weaponName: "Broadsword" },
      distanceLabel: "Distance: 2",
      phaseContext: { targetLocation: "chest", targetParticipantId: "guard" },
      targetOptions: [{ displayName: "City guard", id: "guard" }],
    });
    expect(snapshot.phasePanels?.phase2).toMatchObject({
      defenseSummary: { parry: "11", sourceName: "Broadsword / shield" },
      phaseContext: {
        mainHandParryDirection: "left_forward",
        offHandParryDirection: "right_forward",
      },
    });
    expect(snapshot.phasePanels?.phase1?.attackSummary?.weaponName).not.toBe(
      changedLiveFacts.weaponName,
    );
    expect(snapshot.phasePanels?.phase1?.distanceLabel).not.toBe(changedLiveFacts.distanceLabel);
  });

  it("keeps legacy snapshot panel facts identifiable as incomplete", () => {
    const legacySnapshot = combatRoundStepSnapshotSchema.parse({
      committedAt: "2026-01-01T00:02:00.000Z",
      id: "legacy-snapshot",
      participantId: "gladiator",
      participantLabel: "The Gladiator",
      roundNumber: 3,
      step: "review_action_modifiers",
    });

    expect(legacySnapshot.declarationSummary).toBeUndefined();
    expect(legacySnapshot.modifierSummary).toBeUndefined();
    expect(legacySnapshot.phasePanels).toBeUndefined();
  });

  it("finds the previous combat round step", () => {
    expect(getPreviousCombatRoundStep("select_actions")).toBeUndefined();
    expect(getPreviousCombatRoundStep("review_action_modifiers")).toBe("select_actions");
    expect(getPreviousCombatRoundStep("initiative_phase_1")).toBe("review_action_modifiers");
  });

  it("clears a single combat round step without mutating other step statuses", () => {
    const state = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state: setCombatRoundParticipantStepStatus({
        participantId: "gladiator",
        state: advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
        status: "complete",
        step: "review_action_modifiers",
      }),
      status: "submitted",
      step: "select_actions",
    });
    const cleared = clearCombatRoundStep({
      state,
      step: "review_action_modifiers",
    });

    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(state.participants[0]?.stepStatuses.review_action_modifiers).toBe("complete");
  });

  it("clears snapshots for the cleared step and later steps only", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const withSnapshots = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          phase: "phase1",
          step: "review_action_modifiers",
        }),
      ],
    });
    const withLaterSnapshot = advanceCombatRoundStep(withSnapshots, {
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          phase: "phase1",
          step: "initiative_phase_1",
        }),
      ],
    });
    const clearableState = {
      ...withLaterSnapshot,
      participants: withLaterSnapshot.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                review_action_modifiers: "complete" as const,
              },
            }
          : participant,
      ),
      selectedParticipantId: "gladiator",
      selectedStep: "review_action_modifiers" as const,
    };
    const cleared = clearCombatRoundStep({
      state: clearableState,
      step: "review_action_modifiers",
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "review_action_modifiers",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "initiative_phase_1",
      }),
    ).toBeUndefined();
  });

  it("clears initiative values when clearing initiative steps", () => {
    const state = setCombatRoundParticipantInitiative({
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const cleared = clearCombatRoundStep({
      state,
      step: "initiative_phase_1",
    });

    expect(state.participants[0]?.initiatives.phase1).toEqual({
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [],
      rollTotal: 14,
      total: 14,
    });
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
  });

  it("clears i1 for the selected participant and returns to the selected i1 cell", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: 14,
        participantId: "gladiator",
        phase: "phase1",
        state: baseState,
      }),
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: {
        ...withInitiatives,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withAttack,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[1]?.initiatives.phase1).toMatchObject({ total: 12 });
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
  });

  it("clears the current step and rewinds to the previous step", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const withCompleteReview = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state,
      status: "complete",
      step: "review_action_modifiers",
    });
    const rewound = clearCurrentCombatRoundStepAndRewind(withCompleteReview);

    expect(withCompleteReview.currentStep).toBe("review_action_modifiers");
    expect(rewound.currentStep).toBe("select_actions");
    expect(rewound.selectedStep).toBe("select_actions");
    expect(rewound.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(rewound.participants[0]?.stepStatuses.select_actions).toBe("locked");
  });

  it("consumes an exact GM backtrack hold only when the restored review is completed", () => {
    const state = combatRoundStateSchema.parse({
      ...advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
      currentCursor: { participantId: "gladiator", roundNumber: 3, step: "M1" },
      currentStep: "review_action_modifiers",
      selectedParticipantId: "gladiator",
      selectedStep: "review_action_modifiers",
    });
    const held = holdCombatRoundForGmBacktrack({
      participantId: "gladiator",
      state,
      step: "review_action_modifiers",
    });
    const reviewed = recordCombatRoundParticipantStepReview({
      command: {
        commandId: "backtrack-review",
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: held,
      step: "review_action_modifiers",
      submittedBy: "gm",
      suppressNoChangeResult: true,
    });

    expect(held.gmBacktrackHold).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "review_action_modifiers",
    });
    expect(
      initializeCombatRoundState({
        encounter: { ...encounter(), combatRoundState: held },
      }).gmBacktrackHold,
    ).toEqual(held.gmBacktrackHold);
    expect(reviewed.gmBacktrackHold).toBeUndefined();
    expect(reviewed.commands.at(-1)?.facts.suppressNoChangeResult).toBe(true);
    expect(undoLatestCombatRoundCommand({ state: reviewed })?.gmBacktrackHold).toEqual(
      held.gmBacktrackHold,
    );
  });

  it("clears DE in place when called directly on the first step", () => {
    const state = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const cleared = clearCurrentCombatRoundStepAndRewind(state);

    expect(cleared.currentStep).toBe("select_actions");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("pending");
    expect(cleared.participants[0]?.declaration).toBeUndefined();
  });

  it("clears stale A/P/D state when DE is cleared for the attacker", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDeclaration = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withDeclaration,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withSnapshots = {
      ...withResolution,
      selectedParticipantId: "gladiator",
      selectedStep: "select_actions" as const,
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
      ],
    };
    const cleared = clearCombatRoundStep({
      state: withSnapshots,
      step: "select_actions",
    });

    expect(cleared.participants[0]?.declaration).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionCursor).toBeUndefined();
    expect(cleared.phaseResolutionResults).toEqual([]);
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.phase_1_damage).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
  });

  it("clears stale outgoing A/P/D state when a declaration is replaced", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDeclaration = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const withAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withDeclaration,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const redeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: withResolution,
      submittedBy: "gm",
    });

    expect(redeclared.participants[0]?.declaration).toMatchObject({
      actionId: "parry_attack",
    });
    expect(redeclared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(redeclared.phaseResolutionResults).toEqual([]);
    expect(redeclared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: redeclared,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
  });

  it("clears declaration snapshots when DE is cleared", () => {
    const state = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const withSnapshots = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          declarationSummary: {
            actionId: "attack_parry",
            movementId: "hold",
          },
          participantId: "gladiator",
          step: "select_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshots,
      step: "select_actions",
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "select_actions",
      }),
    ).toBeUndefined();
  });

  it("sets the active participant marker", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = setCombatRoundActiveParticipant(state, "guard");

    expect(nextState.activeParticipantId).toBe("guard");
    expect(nextState.selectedParticipantId).toBe("guard");
  });

  it("marks participant declaration status without advancing the whole round", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state,
      status: "submitted",
      step: "select_actions",
    });

    expect(nextState.currentStep).toBe("select_actions");
    expect(nextState.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(nextState.participants[1]?.stepStatuses.select_actions).toBe("pending");
  });

  it("records player and GM declaration statuses for DE cells", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const playerDeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry",
        additionalActionNotes: "Hold the bridge.",
        movementId: "hold",
        phaseContexts: {
          phase1: {
            mainHandParryDirection: "left",
            targetParticipantId: "guard",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
          phase2: {
            offHandParryDirection: "right_forward",
            targetParticipantId: "goblin",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        roundNumber: state.roundNumber,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "goblin",
        },
        secondaryActionId: "observe_opponent",
        submittedAt: "2026-01-01T00:01:00.000Z",
        submittedByUserId: "player-1",
      },
      participantId: "gladiator",
      state,
      submittedBy: "player",
    });
    const gmDeclared = recordCombatRoundDeclaration({
      participantId: "guard",
      state: playerDeclared,
      submittedBy: "gm",
    });

    expect(gmDeclared.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(gmDeclared.participants[0]?.declaration).toMatchObject({
      actionId: "parry",
      additionalActionNotes: "Hold the bridge.",
      movementId: "hold",
      phaseContexts: {
        phase1: expect.objectContaining({
          mainHandParryDirection: "left",
          targetParticipantId: "guard",
        }),
        phase2: expect.objectContaining({
          offHandParryDirection: "right_forward",
          targetParticipantId: "goblin",
        }),
      },
      roundNumber: 3,
      secondaryActionContext: {
        action: "observe_opponent",
        targetParticipantId: "goblin",
      },
      secondaryActionId: "observe_opponent",
      submittedBy: "player",
      submittedByUserId: "player-1",
    });
    expect(gmDeclared.participants[1]?.stepStatuses.select_actions).toBe("gmEdited");
    expect(
      canPlayerSubmitCombatDeclaration({ participantId: "gladiator", state: gmDeclared }),
    ).toBe(false);
  });

  it("records and undoes player declaration commands like GM declaration commands", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const playerDeclared = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "player-1",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "guard",
          },
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state,
      submittedBy: "player",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...playerDeclared,
        selectedParticipantId: "guard",
        selectedStep: "select_actions",
      },
      step: "select_actions",
    });

    expect(playerDeclared.commands).toHaveLength(1);
    expect(playerDeclared.commands[0]).toMatchObject({
      beforeCursor: { participantId: "gladiator", step: "DE" },
      createdByUserId: "player-1",
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("select_actions");
    expect(cleared.participants[0]?.declaration).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("pending");
  });

  it("allows a player to correct an incomplete submitted declaration during DE", () => {
    const invalidSubmitted = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const validSubmitted = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "guard",
          },
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const lockedInvalid = {
      ...invalidSubmitted,
      participants: invalidSubmitted.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                select_actions: "locked" as const,
              },
            }
          : participant,
      ),
    };

    expect(invalidSubmitted.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(
      canPlayerSubmitCombatDeclaration({ participantId: "gladiator", state: invalidSubmitted }),
    ).toBe(true);
    expect(
      canPlayerSubmitCombatDeclaration({ participantId: "gladiator", state: validSubmitted }),
    ).toBe(false);
    expect(
      canPlayerSubmitCombatDeclaration({ participantId: "gladiator", state: lockedInvalid }),
    ).toBe(false);
  });

  it("records declare_action commands and advances the current cursor row by row", () => {
    const threeParticipantEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "guard", label: "City guard" }),
        participant({ id: "archer", label: "Archer" }),
      ],
    });
    const initial = initializeCombatRoundState({ encounter: threeParticipantEncounter });
    const afterTop = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: initial.roundNumber,
      },
      participantId: "gladiator",
      state: initial,
      submittedBy: "gm",
    });
    const afterMiddle = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "parry_attack",
        roundNumber: initial.roundNumber,
      },
      participantId: "guard",
      state: afterTop,
      submittedBy: "gm",
    });
    const afterBottom = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "double_attack",
        roundNumber: initial.roundNumber,
      },
      participantId: "archer",
      state: afterMiddle,
      submittedBy: "gm",
    });

    expect(afterTop.commands).toHaveLength(1);
    expect(afterTop.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "DE",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "DE",
      },
      createdByUserId: "gm-1",
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(afterTop.currentCursor).toEqual(afterTop.commands[0]?.afterCursor);
    expect(afterTop.selectedParticipantId).toBe("guard");
    expect(afterTop.selectedStep).toBe("select_actions");
    expect(afterMiddle.currentCursor).toMatchObject({
      participantId: "archer",
      step: "DE",
    });
    expect(afterBottom.currentCursor).toMatchObject({
      participantId: "archer",
      step: "DE",
    });
    expect(afterBottom.selectedParticipantId).toBe("archer");
    expect(afterBottom.commands.map((command) => command.type)).toEqual([
      "declare_action",
      "declare_action",
      "declare_action",
    ]);
  });

  it("lets GM declaration recommits supersede the active DE declaration without duplicate attacks", () => {
    const initial = initializeCombatRoundState({ encounter: encounter() });
    const declare = (
      state: typeof initial,
      actionId: "attack_parry" | "double_attack" | "parry_attack",
      createdAt: string,
    ) =>
      recordCombatRoundDeclaration({
        command: { createdAt, createdByUserId: "gm-1" },
        declaration: {
          actionId,
          phaseContexts: {
            phase1: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
              targetParticipantId: "guard",
            },
            phase2: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
              targetParticipantId: "guard",
            },
          },
          roundNumber: initial.roundNumber,
        },
        participantId: "gladiator",
        state,
        submittedBy: "gm",
      });
    const first = declare(initial, "attack_parry", "2026-01-01T00:01:00.000Z");
    const second = declare(first, "double_attack", "2026-01-01T00:02:00.000Z");
    const corrected = declare(second, "attack_parry", "2026-01-01T00:03:00.000Z");

    expect(corrected.currentStep).toBe("select_actions");
    expect(corrected.participants[0]?.declaration).toMatchObject({
      actionId: "attack_parry",
      submittedBy: "gm",
    });
    expect(corrected.commands.filter((command) => command.type === "declare_action")).toHaveLength(
      3,
    );
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: corrected,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: corrected,
      }),
    ).toBe(false);
  });

  it("undoes the latest DE command even when an older DE cell is selected", () => {
    const threeParticipantEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "guard", label: "City guard" }),
        participant({ id: "archer", label: "Archer" }),
      ],
    });
    const initial = initializeCombatRoundState({ encounter: threeParticipantEncounter });
    const afterTop = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: initial.roundNumber,
      },
      participantId: "gladiator",
      state: initial,
      submittedBy: "gm",
    });
    const afterGuard = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "parry_attack",
        roundNumber: initial.roundNumber,
      },
      participantId: "guard",
      state: afterTop,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterGuard,
        selectedParticipantId: "gladiator",
        selectedStep: "select_actions",
      },
      step: "select_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "DE",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("select_actions");
    expect(cleared.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("gmEdited");
    expect(cleared.participants[1]?.declaration).toBeUndefined();
    expect(cleared.participants[1]?.stepStatuses.select_actions).toBe("pending");
  });

  it("blocks command-backed DE top advance until declarations are complete", () => {
    const initial = initializeCombatRoundState({ encounter: encounter() });
    const advanced = advanceCombatRoundStep(initial, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
    });

    expect(advanced.currentStep).toBe("select_actions");
    expect(advanced.commands).toEqual([]);
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(advanced.selectedParticipantId).toBe("gladiator");
    expect(advanced.selectedStep).toBe("select_actions");
  });

  it("maps initiative and action review steps to their initiative phase", () => {
    expect(getCombatRoundInitiativePhaseForStep("initiative_phase_1")).toBe("phase1");
    expect(getCombatRoundInitiativePhaseForStep("phase_1_actions")).toBe("phase1");
    expect(getCombatRoundInitiativePhaseForStep("review_phase_2_actions")).toBe("phase1");
    expect(getCombatRoundInitiativePhaseForStep("initiative_phase_2")).toBe("phase2");
    expect(getCombatRoundInitiativePhaseForStep("select_actions")).toBeUndefined();
  });

  it("maps round steps to their modifier phase context", () => {
    expect(getCombatRoundModifierPhaseForStep("select_actions")).toBeUndefined();
    expect(getCombatRoundModifierPhaseForStep("review_action_modifiers")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("initiative_phase_1")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("phase_1_actions")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("review_phase_2_actions")).toBe("phase1");
    expect(getCombatRoundModifierPhaseForStep("review_phase_2_modifiers")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("initiative_phase_2")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("phase_2_actions")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("review_phase_2_damage")).toBe("phase2");
    expect(getCombatRoundModifierPhaseForStep("round_summary")).toBeUndefined();
  });

  it("records initiative and marks the initiative step submitted", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
    );
    const nextState = recordCombatRoundInitiative({
      initiative: 18,
      participantId: "gladiator",
      phase: "phase1",
      state,
      submittedBy: "player",
    });

    expect(state.currentStep).toBe("initiative_phase_1");
    expect(nextState.participants[0]?.initiatives.phase1).toEqual({
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [],
      rollTotal: 18,
      total: 18,
    });
    expect(nextState.participants[0]?.stepStatuses.initiative_phase_1).toBe("submitted");
    expect(
      canPlayerRollCombatInitiative({
        participantId: "gladiator",
        phase: "phase1",
        state: nextState,
      }),
    ).toBe(false);
  });

  it("records global review and initiative commands with same-step cursor movement", () => {
    const reviewPhase1 = advanceCombatRoundStep(
      initializeCombatRoundState({ encounter: encounter() }),
    );
    const reviewedPhase1 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const rolledPhase1 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    expect(rolledPhase1.events).toEqual([
      expect.objectContaining({
        ownerParticipantId: "gladiator",
        rollerParticipantId: "gladiator",
        sequence: 0,
        step: "initiative_phase_1",
        type: "initiative",
      }),
    ]);
    const reviewPhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_phase_2_modifiers",
    );
    const reviewedPhase2 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase2,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const initiativePhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_2",
    );
    const rolledPhase2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 9,
      participantId: "gladiator",
      phase: "phase2",
      state: initiativePhase2,
      submittedBy: "gm",
    });

    expect(reviewedPhase1.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "M1" },
      beforeCursor: { participantId: "gladiator", step: "M1" },
      type: "review_modifiers_phase1",
    });
    expect(reviewedPhase1.currentCursor).toMatchObject({ participantId: "guard", step: "M1" });
    expect(rolledPhase1.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "i1" },
      beforeCursor: { participantId: "gladiator", step: "i1" },
      type: "roll_initiative_phase1",
    });
    expect(rolledPhase1.currentCursor).toMatchObject({ participantId: "guard", step: "i1" });
    expect(reviewedPhase2.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "M2" },
      beforeCursor: { participantId: "gladiator", step: "M2" },
      type: "review_modifiers_phase2",
    });
    expect(reviewedPhase2.currentCursor).toMatchObject({ participantId: "guard", step: "M2" });
    expect(rolledPhase2.commands[0]).toMatchObject({
      afterCursor: { participantId: "guard", step: "i2" },
      beforeCursor: { participantId: "gladiator", step: "i2" },
      type: "roll_initiative_phase2",
    });
    expect(rolledPhase2.currentCursor).toMatchObject({ participantId: "guard", step: "i2" });
  });

  it("undoes M1 and M2 review commands without clearing declarations", () => {
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const reviewPhase1 = advanceToStep(declared, "review_action_modifiers");
    const reviewedPhase1 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const clearedPhase1 = clearCombatRoundStep({
      state: {
        ...reviewedPhase1,
        selectedParticipantId: "gladiator",
        selectedStep: "review_action_modifiers",
      },
      step: "review_action_modifiers",
    });
    const reviewPhase2 = advanceToStep(declared, "review_phase_2_modifiers");
    const reviewedPhase2 = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase2,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const clearedPhase2 = clearCombatRoundStep({
      state: {
        ...reviewedPhase2,
        selectedParticipantId: "gladiator",
        selectedStep: "review_phase_2_modifiers",
      },
      step: "review_phase_2_modifiers",
    });

    expect(clearedPhase1.commands).toEqual([]);
    expect(clearedPhase1.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(clearedPhase1.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(clearedPhase1.participants[0]?.stepStatuses.select_actions).toBe("gmEdited");
    expect(clearedPhase1.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(clearedPhase2.commands).toEqual([]);
    expect(clearedPhase2.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M2",
    });
    expect(clearedPhase2.participants[0]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
    expect(clearedPhase2.participants[0]?.declaration?.actionId).toBe("attack_parry");
  });

  it("unwinds top-advance M1 commands in reverse participant order", () => {
    const reviewPhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_action_modifiers",
    );
    const advanced = advanceCombatRoundStep(reviewPhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "gladiator",
      },
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          step: "review_action_modifiers",
        }),
        stepSnapshot({
          participantId: "guard",
          step: "review_action_modifiers",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: advanced,
      step: "initiative_phase_1",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "review_action_modifiers",
    });

    expect(advanced.currentStep).toBe("initiative_phase_1");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands[0]).toMatchObject({
      beforeCursor: { participantId: "gladiator", step: "M1" },
      participantId: "gladiator",
      type: "review_modifiers_phase1",
    });
    expect(advanced.commands[1]).toMatchObject({
      beforeCursor: { participantId: "guard", step: "M1" },
      facts: expect.objectContaining({
        source: "advance_step",
        status: "complete",
      }),
      participantId: "guard",
      type: "review_modifiers_phase1",
    });
    expect(advanced.participants[0]?.stepStatuses.review_action_modifiers).toBe("complete");
    expect(advanced.participants[1]?.stepStatuses.review_action_modifiers).toBe("complete");
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "review_modifiers_phase1",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "M1",
    });
    expect(cleared.currentStep).toBe("review_action_modifiers");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_action_modifiers");
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("complete");
    expect(cleared.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "review_action_modifiers",
      }),
    ).toMatchObject({
      participantId: "gladiator",
      step: "review_action_modifiers",
    });
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_action_modifiers",
      }),
    ).toBeUndefined();
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(clearedAgain.selectedParticipantId).toBe("gladiator");
    expect(clearedAgain.selectedStep).toBe("review_action_modifiers");
    expect(clearedAgain.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("unwinds top-advance M2 commands in reverse participant order", () => {
    const reviewPhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_phase_2_modifiers",
    );
    const advanced = advanceCombatRoundStep(reviewPhase2, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      stepSnapshots: [
        stepSnapshot({
          participantId: "gladiator",
          step: "review_phase_2_modifiers",
        }),
        stepSnapshot({
          participantId: "guard",
          step: "review_phase_2_modifiers",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...advanced,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_2",
      },
      step: "initiative_phase_2",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "review_phase_2_modifiers",
    });

    expect(advanced.currentStep).toBe("initiative_phase_2");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands.map((command) => command.type)).toEqual([
      "review_modifiers_phase2",
      "review_modifiers_phase2",
    ]);
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "M2",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_phase_2_modifiers");
    expect(cleared.participants[0]?.stepStatuses.review_phase_2_modifiers).toBe("complete");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M2",
    });
    expect(clearedAgain.participants[0]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.review_phase_2_modifiers).toBe("pending");
  });

  it("undoes i1 commands and clears phase 1 downstream state for the participant", () => {
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const withReviewedModifiers = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state: declared,
      status: "gmEdited",
      step: "review_action_modifiers",
    });
    const initiativePhase1 = setCombatRoundParticipantStepStatus({
      participantId: "gladiator",
      state: advanceToStep(withReviewedModifiers, "initiative_phase_1"),
      status: "gmEdited",
      step: "review_action_modifiers",
    });
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDownstreamPhaseState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: afterGuardRoll,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withDownstreamPhaseState,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_initiative_phase1",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 14 });
    expect(cleared.participants[1]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("gmEdited");
  });

  it("undoes M1 commands by clearing dependent i1 and phase 1 state", () => {
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const reviewPhase1 = advanceToStep(declared, "review_action_modifiers");
    const reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const withInitiative = recordCombatRoundInitiative({
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: reviewed,
      submittedBy: "gm",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDownstreamPhaseState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withInitiative,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withDownstreamPhaseState,
        selectedParticipantId: "gladiator",
        selectedStep: "review_action_modifiers",
      },
      step: "review_action_modifiers",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(cleared.participants[0]?.stepStatuses.initiative_phase_1).toBe("pending");
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionCursor).toBeUndefined();
  });

  it("unwinds top-advance i1 skip commands in reverse participant order", () => {
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const advanced = advanceCombatRoundStep(initiativePhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "gladiator",
      },
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...advanced,
        selectedParticipantId: "gladiator",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });
    const clearedAgain = clearCombatRoundStep({
      state: cleared,
      step: "initiative_phase_1",
    });

    expect(advanced.currentStep).toBe("phase_1_actions");
    expect(advanced.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(advanced.commands.map((command) => command.type)).toEqual([
      "roll_initiative_phase1",
      "roll_initiative_phase1",
    ]);
    expect(advanced.commands[1]).toMatchObject({
      beforeCursor: { participantId: "guard", step: "i1" },
      facts: expect.objectContaining({
        source: "advance_step",
        status: "complete",
      }),
      participantId: "guard",
      type: "roll_initiative_phase1",
    });
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.currentStep).toBe("initiative_phase_1");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[0]?.stepStatuses.initiative_phase_1).toBe("complete");
    expect(cleared.participants[1]?.stepStatuses.initiative_phase_1).toBe("pending");
    expect(cleared.phaseResolutionCursor).toBeUndefined();
    expect(clearedAgain.commands).toEqual([]);
    expect(clearedAgain.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "i1",
    });
    expect(clearedAgain.selectedParticipantId).toBe("gladiator");
    expect(clearedAgain.selectedStep).toBe("initiative_phase_1");
    expect(clearedAgain.participants[0]?.stepStatuses.initiative_phase_1).toBe("pending");
    expect(clearedAgain.participants[1]?.stepStatuses.initiative_phase_1).toBe("pending");
  });

  it("does not add invisible top-advance i1 commands after the final initiative roll completes", () => {
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const afterGladiatorRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: afterGladiatorRoll,
      submittedBy: "gm",
    });

    expect(afterGuardRoll.currentStep).toBe("initiative_phase_1");
    expect(afterGuardRoll.currentCursor).toMatchObject({ step: "i1" });
    expect(
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: "phase1",
        state: afterGuardRoll,
      }),
    ).toBe(true);
    expect(afterGuardRoll.commands).toHaveLength(2);
    expect(afterGuardRoll.commands.map((command) => command.type)).toEqual([
      "roll_initiative_phase1",
      "roll_initiative_phase1",
    ]);
    expect(afterGuardRoll.participants[0]?.initiatives.phase1).toMatchObject({ total: 14 });
    expect(afterGuardRoll.participants[1]?.initiatives.phase1).toMatchObject({ total: 12 });
    expect(afterGuardRoll.participants[0]?.stepStatuses.initiative_phase_1).toBe("gmEdited");
    expect(afterGuardRoll.participants[1]?.stepStatuses.initiative_phase_1).toBe("gmEdited");
  });

  it("undoes i2 commands and clears phase 2 downstream state for the participant", () => {
    const initiativePhase2 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_2",
    );
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 11,
      participantId: "gladiator",
      phase: "phase2",
      state: initiativePhase2,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 9,
      participantId: "guard",
      phase: "phase2",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "double_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withDownstreamPhaseState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: afterGuardRoll,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withDownstreamPhaseState,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_2",
      },
      step: "initiative_phase_2",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_initiative_phase2",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i2",
    });
    expect(cleared.participants[0]?.initiatives.phase2).toMatchObject({ total: 11 });
    expect(cleared.participants[1]?.initiatives.phase2).toBeUndefined();
    expect(cleared.participants[0]?.attackResults.phase2).toEqual(result);
  });

  it("manual selection of an older DE cell still undoes the latest i1 command", () => {
    const declared = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const initiativePhase1 = {
      ...advanceToStep(declared, "initiative_phase_1"),
      selectedParticipantId: "gladiator",
      selectedStep: "initiative_phase_1" as const,
    };
    const rolled = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...rolled,
        selectedParticipantId: "gladiator",
        selectedStep: "select_actions",
      },
      step: "select_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "declare_action",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.currentStep).toBe("initiative_phase_1");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[0]?.declaration?.actionId).toBe("attack_parry");
    expect(cleared.participants[0]?.initiatives.phase1).toBeUndefined();
  });

  it("falls back to the latest command undo when selected empty A1 has no local state", () => {
    const initiativePhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "initiative_phase_1",
    );
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "gladiator",
      phase: "phase1",
      state: initiativePhase1,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterGuardRoll,
        currentStep: "phase_1_actions",
        selectedParticipantId: "guard",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_initiative_phase1",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "i1",
    });
    expect(cleared.currentStep).toBe("initiative_phase_1");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("initiative_phase_1");
    expect(cleared.participants[1]?.initiatives.phase1).toBeUndefined();
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 14 });
  });

  it("falls back from selected empty A1 to the latest M1 command", () => {
    const reviewPhase1 = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "review_action_modifiers",
    );
    const reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: reviewPhase1,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...reviewed,
        currentStep: "phase_1_actions",
        selectedParticipantId: "guard",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "M1",
    });
    expect(cleared.currentStep).toBe("review_action_modifiers");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("review_action_modifiers");
    expect(cleared.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("falls back from selected empty A1 to the latest DE command", () => {
    const declared = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...declared,
        currentStep: "phase_1_actions",
        selectedParticipantId: "guard",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(cleared.currentStep).toBe("select_actions");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("select_actions");
    expect(cleared.participants[0]?.declaration).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.select_actions).toBe("pending");
  });

  it("leaves selected empty A1 unchanged when there is no local state or command to undo", () => {
    const state = {
      ...initializeCombatRoundState({ encounter: encounter() }),
      currentStep: "phase_1_actions" as const,
      selectedParticipantId: "guard",
      selectedStep: "phase_1_actions" as const,
    };
    const cleared = clearCombatRoundStep({
      state,
      step: "phase_1_actions",
    });

    expect(cleared).toEqual(state);
  });

  it("builds a P1 attack result from the canonical to-hit table", () => {
    expect(
      buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackerParticipantId: "gladiator",
        defenderDb: 11,
        defenderParticipantId: "guard",
        ob: 9,
        openEndedD10s: [],
        phase: "phase1",
        rollD20: 18,
        rollTotal: 18,
        rolledAt: "2026-01-01T00:03:00.000Z",
        rolledByUserId: "gm-1",
        weaponName: "Broad sword",
      }),
    ).toEqual({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 11,
      defenderParryModifier: -1,
      defenderParticipantId: "guard",
      grazing: false,
      hit: true,
      kind: "attackRoll",
      lookupTotal: 16,
      marginOverMissThreshold: 6,
      ob: 9,
      openEndedD10s: [],
      phase: "phase1",
      roll: undefined,
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      rolledByUserId: "gm-1",
      tableResult: "Hit",
      weaponName: "Broad sword",
    });
  });

  it("uses open-ended roll totals for P1 attack lookup totals", () => {
    expect(
      buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackerParticipantId: "gladiator",
        defenderDb: 11,
        defenderParticipantId: "guard",
        ob: 9,
        openEndedD10s: [7],
        phase: "phase1",
        rollD20: 20,
        rollTotal: 27,
        rolledAt: "2026-01-01T00:03:00.000Z",
        weaponName: "Broad sword",
      }),
    ).toMatchObject({
      hit: true,
      lookupTotal: 25,
      openEndedD10s: [7],
      rollD20: 20,
      rollTotal: 27,
      tableResult: "Hit",
    });
  });

  it("normalizes legacy closed-roll attack results into the open-ended result shape", () => {
    expect(
      combatRoundAttackRollResultSchema.parse({
        actionId: "attack_parry",
        attackerParticipantId: "gladiator",
        defenderDb: 10,
        defenderParticipantId: "guard",
        grazing: false,
        hit: false,
        kind: "attackRoll",
        lookupTotal: 10,
        marginOverMissThreshold: 0,
        ob: 10,
        phase: "phase1",
        roll: 10,
        rolledAt: "2026-01-01T00:03:00.000Z",
        tableResult: "Miss",
        weaponName: "Broad sword",
      }),
    ).toMatchObject({
      openEndedD10s: [],
      roll: 10,
      rollD20: 10,
      rollTotal: 10,
    });
  });

  it("records P1 attack results and marks P1 submitted", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "attack_parry",
      gladiatorActionId: "attack_parry",
      phase: "phase1",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const nextState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(state.currentStep).toBe("phase_1_actions");
    expect(nextState.participants[0]?.attackResults.phase1).toMatchObject({
      grazing: true,
      hit: true,
      lookupTotal: 11,
      rollD20: 11,
      rollTotal: 11,
      tableResult: "Grazing hit",
    });
    expect(nextState.participants[0]?.stepStatuses.phase_1_actions).toBe("gmEdited");
  });

  it("records A1 hit attack commands with defender P1 as the explicit after cursor", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const attackPhaseDefensivePenalty = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      executionState: "executed",
      opportunity: {
        actionId: "attack_parry",
        id: "round:3:participant:gladiator:phase1:attack_1",
        phase: "phase1",
        slot: "attack_1",
        status: "committed",
        targetParticipantId: "guard",
      },
      participantId: "gladiator",
      roundNumber: 3,
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackPhaseDefensivePenalty,
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands).toHaveLength(1);
    expect(nextState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "P1",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      facts: {
        attackResultId: "3:phase1:gladiator:guard",
        defenderParticipantId: "guard",
        grazing: false,
        hit: true,
        nextStepOpened: {
          participantId: "guard",
          step: "P1",
        },
      },
      participantId: "gladiator",
      phase: "phase1",
      step: "A1",
      type: "roll_attack",
    });
    expect(nextState.currentCursor).toEqual(nextState.commands[0]?.afterCursor);
    expect(nextState.currentStep).toBe("review_phase_2_actions");
    expect(nextState.selectedParticipantId).toBe("guard");
    expect(nextState.selectedStep).toBe("review_phase_2_actions");
    expect(nextState.events.at(-1)).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      attackerParticipantId: "gladiator",
      defenderParticipantId: "guard",
      ownerParticipantId: "gladiator",
      rollerParticipantId: "gladiator",
      step: "phase_1_actions",
      type: "attack",
    });
    expect(nextState.events.at(-1)?.facts.resultPresentation).toMatchObject({
      committedConsequences: [expect.objectContaining({ value: -4 })],
      standardConsequences: [expect.objectContaining({ value: -4 })],
    });
    expect(nextState.participants[0]?.declaration?.attackPhaseDefensivePenalties).toEqual([
      expect.objectContaining({
        attackOpportunityId: "round:3:participant:gladiator:phase1:attack_1",
        executionState: "executed",
        penalty: -4,
      }),
    ]);
  });

  it("records A1 miss attack commands with the next actor A1 as the explicit after cursor", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands).toHaveLength(1);
    expect(nextState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase1:gladiator:guard",
        defenderParticipantId: "guard",
        hit: false,
        nextStepOpened: {
          participantId: "guard",
          step: "A1",
        },
      }),
      participantId: "gladiator",
      phase: "phase1",
      step: "A1",
      type: "roll_attack",
    });
    expect(nextState.currentCursor).toEqual(nextState.commands[0]?.afterCursor);
    expect(nextState.currentStep).toBe("phase_1_actions");
    expect(nextState.selectedParticipantId).toBe("guard");
    expect(nextState.selectedStep).toBe("phase_1_actions");
  });

  it("records A2 attack commands with phase 2 cursor metadata", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "guard",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "P2",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        defenderParticipantId: "gladiator",
        hit: true,
      }),
      participantId: "guard",
      phase: "phase2",
      step: "A2",
      type: "roll_attack",
    });
    expect(nextState.currentCursor).toEqual(nextState.commands[0]?.afterCursor);
    expect(nextState.currentStep).toBe("review_phase_2_damage");
    expect(nextState.selectedStep).toBe("review_phase_2_damage");
  });

  it.each([
    { phase: "phase1" as const, step: "A1" as const, weaponName: "Broad sword", ob: 9 },
    { phase: "phase2" as const, step: "A2" as const, weaponName: "Broad sword", ob: 8 },
  ])("records Double Attack $step rolls through the normal roll_attack command", (caseInput) => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: caseInput.phase,
      state: declareRoundAction({
        actionId: "double_attack",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "double_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: caseInput.ob,
      phase: caseInput.phase,
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: caseInput.weaponName,
    });
    const nextState = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(nextState.commands[0]).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: caseInput.step,
      },
      facts: expect.objectContaining({
        attackResultId: `3:${caseInput.phase}:gladiator:guard`,
        defenderParticipantId: "guard",
      }),
      participantId: "gladiator",
      phase: caseInput.phase,
      step: caseInput.step,
      type: "roll_attack",
    });
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: caseInput.phase,
        state: nextState,
      }),
    ).toMatchObject({
      actionId: "double_attack",
      ob: caseInput.ob,
      weaponName: caseInput.weaponName,
    });
  });

  it("records successful P1 parry commands and undoes them back to the defender P1", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const parryResolution = {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry successful",
      rollD20: 12,
      rollTotal: 12,
      status: "resolved" as const,
      success: true,
      targetNumber: 21,
      total: 21,
    };
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution,
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(afterParry.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "P1",
      },
      facts: {
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "guard",
        nextStepOpened: {
          participantId: "guard",
          step: "A1",
        },
        success: true,
      },
      participantId: "guard",
      phase: "phase1",
      step: "P1",
      type: "roll_parry",
    });
    expect(afterParry.currentCursor).toEqual(afterParry.commands.at(-1)?.afterCursor);
    expect(afterParry.selectedStep).toBe("phase_1_actions");
    expect(afterParry.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: true,
    });
    expect(afterParry.phaseResolutionResults[0]?.damageRoll.status).toBe("not_required");
    expect(afterParry.events.at(-1)).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      ownerParticipantId: "guard",
      parryResultId: "3:phase1:gladiator:guard:parry",
      rollerParticipantId: "guard",
      step: "review_phase_2_actions",
      type: "parry",
    });

    const withSnapshots = {
      ...afterParry,
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: afterParry.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: afterParry.phaseResolutionResults[0],
          step: "phase_1_damage",
        }),
      ],
    };
    const cleared = clearCombatRoundStep({
      state: withSnapshots,
      step: "review_phase_2_actions",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_attack",
    });
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults).toHaveLength(1);
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "P1",
    });
    expect(cleared.currentStep).toBe("review_phase_2_actions");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_phase_2_actions");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: cleared,
      }).substep,
    ).toBe("parry");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      attackResult: result,
      step: "phase_1_actions",
    });
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBeUndefined();
  });

  it("records failed P2 parry commands and undoes their D2 opening", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "guard",
        phase: "phase2",
        state: declareRoundAction({
          actionId: "parry_attack",
          participantId: "guard",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(afterParry.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "D2",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "P2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        attackerParticipantId: "guard",
        defenderParticipantId: "gladiator",
        success: false,
      }),
      participantId: "gladiator",
      phase: "phase2",
      step: "P2",
      type: "roll_parry",
    });
    expect(afterParry.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "D2",
    });
    expect(afterParry.currentStep).toBe("phase_2_damage");
    expect(afterParry.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "damage",
    });

    const cleared = clearCombatRoundStep({
      state: afterParry,
      step: "phase_2_damage",
    });

    expect(cleared.commands).toHaveLength(1);
    expect(cleared.participants[1]?.attackResults.phase2).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "P2",
    });
    expect(cleared.currentStep).toBe("review_phase_2_damage");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "parry",
    });
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("review_phase_2_damage");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "review_phase_2_damage",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_damage",
      }),
    ).toBe("pending");
  });

  it("manual selection of an older i1 cell still undoes the latest roll_parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterParry,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(afterParry.commands.at(-1)).toMatchObject({
      participantId: "guard",
      type: "roll_parry",
    });
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_attack",
    });
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 6 });
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "P1",
    });
    expect(cleared.currentStep).toBe("review_phase_2_actions");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("review_phase_2_actions");
  });

  it("records and undoes D1 placeholder damage review commands after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamageReview = recordCombatRoundDamageReviewPlaceholder({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterDamageReview,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterParry,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
    expect(afterDamageReview.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      facts: {
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "guard",
        nextStepOpened: {
          participantId: "guard",
          step: "A1",
        },
        status: "deferred",
      },
      participantId: "guard",
      phase: "phase1",
      step: "D1",
      type: "complete_damage_review_phase1",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterDamageReview,
        step: "phase_1_damage",
      }),
    ).toBe("gmEdited");
    expect(afterDamageReview.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
    expect(afterDamageReview.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.commands.at(-1)).toMatchObject({
      participantId: "guard",
      type: "roll_parry",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.currentStep).toBe("phase_1_damage");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "damage",
    });
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("phase_1_damage");
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
  });

  it("records and undoes D1 damage result commands after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
          participantId: "guard",
          phase: "phase1",
          state: declareRoundAction({
            actionId: "attack_parry",
            participantId: "guard",
            state: declareRoundAction({
              actionId: "attack_parry",
              participantId: "gladiator",
              state: initializeCombatRoundState({ encounter: encounter() }),
            }),
          }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterDamage,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(afterDamage.commands.at(-1)).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase1:gladiator:guard",
        attackerParticipantId: "gladiator",
        damageResultId: "3:phase1:gladiator:guard:damage",
        defenderParticipantId: "guard",
        status: "resolved",
        totalDamage: 9,
      }),
      participantId: "guard",
      phase: "phase1",
      step: "D1",
      type: "resolve_damage",
    });
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      armorModifier: 0,
      attackResultId: "3:phase1:gladiator:guard",
      attackerParticipantId: "gladiator",
      defenderDm: 0,
      defenderParticipantId: "guard",
      dmb: 8,
      grazing: false,
      hitLookupTotal: 14,
      kind: "damage_result",
      criticalGrade: "b",
      damageLookupTotal: 22,
      minDamage: 1,
      tableDamage: 9,
      totalDamage: 9,
      weaponName: "Broad sword",
    });
    expect(afterDamage.phaseResolutionResults[0]?.damageRoll).toMatchObject({
      status: "rolled",
      total: 9,
    });
    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
    expect(afterLocation.events.at(-1)).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      ownerParticipantId: "guard",
      rollerParticipantId: "gladiator",
      type: "hit_location",
    });
    expect(afterDamage.events.at(-1)).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      damageResultId: "3:phase1:gladiator:guard:damage",
      ownerParticipantId: "guard",
      type: "damage_proposed",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterDamage,
        step: "phase_1_damage",
      }),
    ).toBe("ready");
    expect(cleared.commands.at(-1)).toMatchObject({
      participantId: "guard",
      type: "roll_hit_location",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.currentStep).toBe("phase_1_damage");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("phase_1_damage");
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.hitLocationRoll.status).toBe("rolled");
    expect(cleared.phaseResolutionResults[0]?.damageProposal.proposedEffects).toEqual([]);
  });

  it("records D1 damage results for refreshed 17/18 hit rows", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 17,
      rollTotal: 17,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
    });

    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    expect(result.lookupTotal).toBe(17);
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      criticalGrade: "c",
      damageRoll: {
        required: false,
      },
      damageLookupTotal: 25,
      hitLookupTotal: 17,
      minDamage: 2,
      tableDamage: 12,
      totalDamage: 12,
    });
    expect(afterDamage.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        totalDamage: 12,
      }),
      type: "resolve_damage",
    });
  });

  it("records one-roll and targeted two-roll hit-location commands", () => {
    const pending = prepareFailedParryPendingDamage({});
    const afterSingleLocation = recordCombatRoundHitLocationRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "gladiator",
      state: pending.state,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const targetedPending = prepareFailedParryPendingDamage({});
    const afterTargetedLocation = recordCombatRoundHitLocationRoll({
      attackResult: targetedPending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [7, 14],
      rolledByParticipantId: "gladiator",
      state: targetedPending.state,
      submittedBy: "gm",
      targetLocation: "head",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });

    expect(afterSingleLocation.phaseResolutionResults[0]?.hitLocationRoll).toMatchObject({
      hitLocationRolls: [12],
      rolledByParticipantId: "gladiator",
      rollPrivilege: "attacker",
      selectedHitLocation: "chest",
      selectedHitLocationRoll: 12,
      selectionReason: "single_roll",
      status: "rolled",
    });
    expect(afterSingleLocation.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        hitLocationRolls: [12],
        rolledByParticipantId: "gladiator",
        rollPrivilege: "attacker",
        selectedHitLocation: "chest",
      }),
      participantId: "guard",
      step: "D1",
      type: "roll_hit_location",
    });
    expect(afterTargetedLocation.phaseResolutionResults[0]?.hitLocationRoll).toMatchObject({
      hitLocationRolls: [7, 14],
      selectedHitLocation: "chest",
      selectedHitLocationRoll: 14,
      selectionReason: "targeted_closest",
      targetLocation: "head",
    });
  });

  it("can draft the damage proposal immediately after hit-location roll", () => {
    const pending = prepareFailedParryPendingDamage({});
    const afterLocationAndDamage = recordCombatRoundHitLocationRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      damageProposal: {
        defenderDm: 0,
        dmb: 8,
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "gladiator",
      state: pending.state,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const resolution = afterLocationAndDamage.phaseResolutionResults[0];

    expect(resolution?.hitLocationRoll.status).toBe("rolled");
    expect(resolution?.damageProposal.status).toBe("drafted");
    expect(resolution?.damageResult).toMatchObject({
      defenderDm: 0,
      dmb: 8,
      selectedHitLocation: "chest",
    });
    expect(getCombatRoundDamageSubstate(resolution)).toBe("critical_pending");
    expect(afterLocationAndDamage.commands.slice(-2).map((command) => command.type)).toEqual([
      "roll_hit_location",
      "resolve_damage",
    ]);
    expect(afterLocationAndDamage.currentCursor).toMatchObject({
      participantId: "guard",
      step: "D1",
    });
  });

  it("requires location before damage and tracks critical substates", () => {
    const pending = prepareFailedParryPendingDamage({});

    expect(() =>
      recordCombatRoundDamageResult({
        attackResult: pending.attackResult,
        command: {
          createdAt: "2026-01-01T00:05:00.000Z",
          createdByUserId: "gm-1",
        },
        defenderDm: 0,
        dmb: 8,
        state: pending.state,
        submittedBy: "gm",
        updatedAt: "2026-01-01T00:05:00.000Z",
      }),
    ).toThrow("Hit location roll required before resolving damage.");

    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    expect(getCombatRoundDamageSubstate(afterLocation.phaseResolutionResults[0])).toBe(
      "location_rolled",
    );
    expect(afterDamage.phaseResolutionResults[0]?.criticalRoll.status).toBe("pending");
    expect(getCombatRoundDamageSubstate(afterDamage.phaseResolutionResults[0])).toBe(
      "critical_pending",
    );
  });

  it("records and unwinds critical rolls before damage and location", () => {
    const pending = prepareFailedParryPendingDamage({});
    const attackResult = {
      ...pending.attackResult,
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
    };
    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const afterCriticalUndo = clearCombatRoundStep({
      state: afterCritical,
      step: "phase_1_damage",
    });
    const afterDamageUndo = clearCombatRoundStep({
      state: afterCriticalUndo,
      step: "phase_1_damage",
    });
    const afterLocationUndo = clearCombatRoundStep({
      state: afterDamageUndo,
      step: "phase_1_damage",
    });

    expect(afterCritical.phaseResolutionResults[0]?.criticalRoll).toMatchObject({
      armorCriticalModifier: 0,
      criticalDice: [4, 5],
      criticalDiceTotal: 9,
      criticalGrade: "b",
      criticalTypeModifier: -4,
      finalCriticalRoll: 5,
      rolledByParticipantId: "gladiator",
      rollPrivilege: "attacker",
      selectedHitLocation: "chest",
      status: "rolled",
    });
    expect(afterCritical.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        criticalDice: [4, 5],
        finalCriticalRoll: 5,
        rollPrivilege: "attacker",
      }),
      type: "roll_critical",
    });
    expect(afterCritical.events.at(-1)).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      ownerParticipantId: "guard",
      rollerParticipantId: "gladiator",
      type: "critical",
    });
    expect(afterCriticalUndo.events.map((event) => event.type)).not.toContain("critical");
    expect(afterCriticalUndo.events.map((event) => event.type)).toEqual([
      "attack",
      "parry",
      "hit_location",
      "damage_proposed",
    ]);
    expect(
      afterCritical.phaseResolutionResults[0]?.damageResult?.review?.criticalEffectProposal,
    ).toMatchObject({
      critKey: "sharp|chest|05",
      title: expect.any(String),
      warnings: [],
    });
    expect(
      afterCritical.phaseResolutionResults[0]?.damageResult?.review?.additionalEffects.some(
        (effect) => effect.sourceKind === "critical_table",
      ),
    ).toBe(true);
    expect(afterCriticalUndo.phaseResolutionResults[0]?.criticalRoll.status).toBe("pending");
    expect(afterCriticalUndo.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(
      afterCriticalUndo.phaseResolutionResults[0]?.damageResult?.review?.criticalEffectProposal,
    ).toBeUndefined();
    expect(
      afterCriticalUndo.phaseResolutionResults[0]?.damageResult?.review?.additionalEffects.some(
        (effect) => effect.sourceKind === "critical_table",
      ),
    ).toBe(false);
    expect(afterDamageUndo.phaseResolutionResults[0]?.criticalRoll.status).toBe("not_required");
    expect(afterDamageUndo.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(afterDamageUndo.phaseResolutionResults[0]?.hitLocationRoll.status).toBe("rolled");
    expect(afterLocationUndo.phaseResolutionResults[0]?.hitLocationRoll.status).toBe("pending");
  });

  it("preserves a committed Double Attack A2 after drop-only critical damage and reload", () => {
    const declared = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: declareRoundAction({
        actionId: "double_attack",
        participantId: "guard",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const guardPhase1Attack = buildCombatRoundAttackRollResult({
      actionId: "double_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase1",
      rollD20: 2,
      rollTotal: 2,
      rolledAt: "2026-01-01T00:01:00.000Z",
      weaponName: "Broad sword",
    });
    const withSnapshot = combatRoundStateSchema.parse({
      ...declared,
      participants: declared.participants.map((participant) =>
        participant.participantId === "guard"
          ? {
              ...participant,
              attackResults: { ...participant.attackResults, phase1: guardPhase1Attack },
              stepStatuses: { ...participant.stepStatuses, phase_1_actions: "gmEdited" },
            }
          : participant,
      ),
      stepSnapshots: [
        stepSnapshot({
          attackSummary: {
            attackMode: "Slash",
            dmb: "8",
            initiative: "2",
            maxCrits: "FS",
            ob: "12",
            weaponName: "Broad sword",
          },
          participantId: "guard",
          phase: "phase2",
          step: "phase_2_actions",
        }),
      ],
    });
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: withSnapshot,
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result: attackResult,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [17],
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterReview = reviewCombatRoundDamageResult({
      attackResultId: "3:phase1:gladiator:guard",
      reviewedAt: "2026-01-01T00:05:15.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: [],
        criticalEffectProposal:
          afterDamage.phaseResolutionResults[0]?.damageResult?.review?.criticalEffectProposal,
        criticalGradeOverride: "a",
        operationalConsequences: [],
      },
      state: afterDamage,
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [3, 4],
      rolledByParticipantId: "gladiator",
      state: afterReview,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const operationalConsequences =
      afterCritical.phaseResolutionResults[0]?.damageResult?.review?.operationalConsequences ?? [];

    expect(afterCritical.phaseResolutionResults[0]?.damageResult?.review).toMatchObject({
      criticalEffectProposal: {
        critKey: "sharp|arm|01",
      },
    });
    expect(operationalConsequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accepted: true,
          itemLabel: "Broad sword",
          kind: "drop_item",
          sourceEffectKey: "sharp|arm|01|02",
        }),
      ]),
    );
    expect(operationalConsequences).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "cancel_pending_action" })]),
    );

    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-critical-drop",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: { effects: [], events: [] },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const dropEffectId =
      "commit-critical-drop:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:operational-critical-operational-sharp-arm-01-02-drop-Broad-sword";
    const clearedCommitState = clearCombatRoundStep({
      state: committed.state,
      step: "phase_1_damage",
    });
    const cleanedCombatEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: committed.command,
    });

    expect(committed.command.facts).toMatchObject({
      cancelledActions: [],
      createdOperationalCombatEffectIds: [dropEffectId],
      operationalConsequences: expect.arrayContaining([
        expect.objectContaining({ kind: "drop_item" }),
      ]),
    });
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        description: "Dropped Broad sword.",
        effectGroup: "special",
        id: dropEffectId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "special",
      }),
    );
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: committed.state,
        step: "phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "guard",
        phase: "phase2",
        state: committed.state,
      }).substep,
    ).toBe("pending");
    expect(
      committed.state.participants.find((participant) => participant.participantId === "guard")
        ?.declaration,
    ).toMatchObject({
      actionId: "double_attack",
    });
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: dropEffectId }),
    );
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: clearedCommitState,
        step: "phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "guard",
        phase: "phase2",
        state: clearedCommitState,
      }).substep,
    ).toBe("pending");
    expect(
      clearedCommitState.phaseResolutionResults[0]?.damageResult?.review?.operationalConsequences,
    ).toEqual(operationalConsequences);

    const phase2Review = advanceBoundary(
      committed.state,
      "phase1_resolution",
      "phase2_modifier_review",
    );
    const continued = decideCombatRoundDoubleAttackPhase2({
      command: { createdAt: "2026-01-01T00:06:30.000Z", createdByUserId: "gm-1" },
      decision: "continue",
      participantId: "guard",
      state: phase2Review,
    });
    expect(continued.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "M2",
    });
    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(continued)));
    const withPhase2Initiative = setCombatRoundParticipantInitiative({
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [5],
        rollTotal: 5,
        total: 5,
      },
      participantId: "guard",
      phase: "phase2",
      state: reloaded,
    });
    const phase2 = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: withPhase2Initiative,
      updatedAt: "2026-01-01T00:07:00.000Z",
    });

    expect(getCombatRoundPhaseAttackCandidates({ phase: "phase2", state: phase2 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origin: "double_attack",
          participantId: "guard",
          status: "committed",
        }),
      ]),
    );
    expect(phase2.currentCursor).toMatchObject({ participantId: "guard", step: "A2" });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "guard",
        phase: "phase2",
        state: phase2,
      }),
    ).toBe(true);
  });

  it("raises committed damage to critical minimum and cancels pending no-action attacks", () => {
    const declared = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "guard",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const withSnapshot = combatRoundStateSchema.parse({
      ...declared,
      stepSnapshots: [
        stepSnapshot({
          attackSummary: {
            attackMode: "Slash",
            dmb: "8",
            initiative: "2",
            maxCrits: "FS",
            ob: "12",
            weaponName: "Broad sword",
          },
          participantId: "guard",
          phase: "phase2",
          step: "phase_2_actions",
        }),
      ],
    });
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: withSnapshot,
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result: attackResult,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [17],
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      armorModifier: -7,
      armorModifierSource: {
        label: "Test armor adjustment",
        status: "applied",
      },
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterReview = reviewCombatRoundDamageResult({
      attackResultId: "3:phase1:gladiator:guard",
      reviewedAt: "2026-01-01T00:05:15.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: [],
        armorModifierOverride: -7,
        criticalGradeOverride: "f",
        operationalConsequences: [],
      },
      state: afterDamage,
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [5, 5],
      rolledByParticipantId: "gladiator",
      state: afterReview,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const damageResult = afterCritical.phaseResolutionResults[0]?.damageResult;
    const effectiveDamage = damageResult
      ? getCombatRoundEffectiveDamageResult(damageResult)
      : undefined;

    expect(damageResult?.review?.criticalEffectProposal).toMatchObject({
      critKey: "sharp|arm|13",
    });
    const criticalBodyText = damageResult?.review?.criticalEffectProposal?.bodyText;

    if (!criticalBodyText) {
      throw new Error("Expected critical body text.");
    }
    expect(criticalBodyText).toContain("Your blow severs your opponent's arm");
    expect(effectiveDamage).toMatchObject({
      preCriticalEffectiveDamage: 2,
      criticalMinTotalDamage: 5,
      criticalMinApplied: true,
      criticalMinExtra: 3,
      effectiveTotalDamage: 5,
      finalCommittedDamage: 5,
    });
    expect(damageResult?.review?.operationalConsequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accepted: true,
          kind: "cancel_pending_action",
          phase: "phase2",
          step: "A2",
        }),
        expect.objectContaining({
          accepted: true,
          kind: "note",
          label: "No combat action possible",
        }),
      ]),
    );

    const afterCriticalWithCanonicalGuardAttack = combatRoundStateSchema.parse({
      ...afterCritical,
      participants: afterCritical.participants.map((participant) =>
        participant.participantId === "guard" && participant.declaration
          ? {
              ...participant,
              declaration: {
                ...participant.declaration,
                attackOpportunities: [
                  {
                    actionId: "parry_attack",
                    id: "round:3:participant:guard:phase2:attack_2",
                    origin: "declared",
                    phase: "phase2",
                    slot: "attack_2",
                    status: "committed",
                    targetParticipantId: "gladiator",
                  },
                ],
              },
            }
          : participant,
      ),
    });
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-critical-min-no-action",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: { effects: [], events: [] },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCriticalWithCanonicalGuardAttack,
    });
    const clearedCommitState = clearCombatRoundStep({
      state: committed.state,
      step: "phase_1_damage",
    });

    expect(committed.command.facts).toMatchObject({
      cancelledActions: [
        expect.objectContaining({
          attackPhaseDefensivePenalty: expect.objectContaining({
            executionState: "invalidated",
            penalty: -4,
            reason: "invalid_after_commitment",
          }),
          participantId: "guard",
          phase: "phase2",
          previousStepStatus: "pending",
          step: "A2",
        }),
      ],
      criticalMinApplied: true,
      criticalMinExtra: 3,
      criticalMinTotalDamage: 5,
      finalCommittedDamage: 5,
      preCriticalEffectiveDamage: 2,
      totalDamage: 5,
    });
    expect(committed.command.facts).toMatchObject({
      createdOperationalCombatEffectIds: [
        expect.stringContaining("operational-critical-operational-sharp-arm-13-05-drop"),
      ],
      operationalConsequences: expect.arrayContaining([
        expect.objectContaining({ kind: "cancel_pending_action" }),
        expect.objectContaining({ kind: "note", label: "No combat action possible" }),
      ]),
    });
    expect(
      (committed.command.facts.createdOperationalCombatEffectIds as string[]).some((effectId) =>
        effectId.split("combat-effect:")[1]?.includes("no-action"),
      ),
    ).toBe(false);
    expect(committed.combatEffects.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          damage: 5,
          location: "rightArm",
          targetParticipantId: "scenario-guard",
          type: "physical_damage",
        }),
        expect.objectContaining({
          description: expect.stringContaining("No combat action possible"),
          effectGroup: "special",
          targetParticipantId: "scenario-guard",
          type: "special",
        }),
      ]),
    );
    expect(
      committed.combatEffects.effects.filter(
        (effect) =>
          effect.type === "special" && /No combat action possible/.test(effect.description ?? ""),
      ),
    ).toHaveLength(1);
    expect(committed.combatEffects.events[0]?.description).toContain(criticalBodyText);
    for (const effect of committed.combatEffects.effects) {
      expect(effect.description).not.toContain(criticalBodyText);
    }
    expect(committed.combatEffects.events[0]?.description).toContain(
      "Critical minimum raised damage from 2 to 5",
    );
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: committed.state,
        step: "phase_2_actions",
      }),
    ).toBe("skipped");
    expect(
      committed.state.participants.find((participant) => participant.participantId === "guard")
        ?.declaration,
    ).toMatchObject({
      actionId: "parry_attack",
      attackPhaseDefensivePenalties: [
        expect.objectContaining({ executionState: "invalidated", penalty: -4 }),
      ],
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: clearedCommitState,
        step: "phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      clearedCommitState.participants.find((participant) => participant.participantId === "guard")
        ?.declaration?.attackPhaseDefensivePenalties,
    ).toBeUndefined();
  });

  it("creates one visible no-action row when only the operational consequence provides it", () => {
    const pending = prepareFailedParryPendingDamage({});
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 0,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterReview = reviewCombatRoundDamageResult({
      attackResultId: "3:phase1:gladiator:guard",
      reviewedAt: "2026-01-01T00:05:15.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: [],
        operationalConsequences: [
          {
            accepted: true,
            id: "manual-operational-no-action",
            kind: "note",
            label: "No combat action possible",
            participantId: "guard",
            reason: "GM accepted a clear operational no-action consequence.",
          },
        ],
      },
      state: afterDamage,
    });
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-operational-no-action-only",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: { effects: [], events: [] },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterReview,
    });

    expect(committed.command.facts).toMatchObject({
      createdAdditionalCombatEffectIds: [],
      createdOperationalCombatEffectIds: [
        expect.stringContaining("operational-manual-operational-no-action"),
      ],
      operationalConsequences: [
        expect.objectContaining({ kind: "note", label: "No combat action possible" }),
      ],
    });
    expect(
      committed.combatEffects.effects.filter(
        (effect) =>
          effect.type === "special" && effect.description === "No combat action possible.",
      ),
    ).toHaveLength(1);

    const restoredState = clearCombatRoundStep({
      state: committed.state,
      step: "phase_1_damage",
    });
    const restoredEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: committed.command,
    });

    expect(restoredEffects.effects).toEqual([]);
    expect(
      restoredState.phaseResolutionResults[0]?.damageResult?.review?.operationalConsequences,
    ).toEqual(afterReview.phaseResolutionResults[0]?.damageResult?.review?.operationalConsequences);
  });

  it("commits a parry-only critical as one specific row without generic no-action overlap", () => {
    const declared = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "guard",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const withSnapshot = combatRoundStateSchema.parse({
      ...declared,
      stepSnapshots: [
        stepSnapshot({
          attackSummary: {
            attackMode: "Slash",
            dmb: "8",
            initiative: "2",
            maxCrits: "FS",
            ob: "12",
            weaponName: "Broad sword",
          },
          participantId: "guard",
          phase: "phase2",
          step: "phase_2_actions",
        }),
      ],
    });
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: withSnapshot,
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result: attackResult,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [19],
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterReview = reviewCombatRoundDamageResult({
      attackResultId: "3:phase1:gladiator:guard",
      reviewedAt: "2026-01-01T00:05:15.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: [],
        criticalGradeOverride: "b",
        operationalConsequences: [],
      },
      state: afterDamage,
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [3, 3],
      rolledByParticipantId: "gladiator",
      state: afterReview,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const damageResult = afterCritical.phaseResolutionResults[0]?.damageResult;

    expect(damageResult?.review?.criticalEffectProposal).toMatchObject({
      critKey: "sharp|head|02",
    });
    expect(damageResult?.review?.additionalEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          durationRounds: 2,
          label: "Action limited to parry",
          rowCategory: "no_combat_action",
          sourceEffectKey: "sharp|head|02|01",
        }),
      ]),
    );
    expect(damageResult?.review?.operationalConsequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "cancel_pending_action",
          phase: "phase2",
          sourceEffectKey: "sharp|head|02|01",
          step: "A2",
        }),
        expect.objectContaining({
          kind: "note",
          label: "Action limited to parry",
          sourceEffectKey: "sharp|head|02|01",
        }),
      ]),
    );
    expect(damageResult?.review?.operationalConsequences).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "note",
          label: "No combat action possible",
          sourceEffectKey: "sharp|head|02|01",
        }),
      ]),
    );

    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-head-parry-only",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: { effects: [], events: [] },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const parryRows = committed.combatEffects.effects.filter(
      (effect) =>
        effect.type === "special" && /Action limited to parry/.test(effect.description ?? ""),
    );
    const noActionRows = committed.combatEffects.effects.filter(
      (effect) =>
        effect.type === "special" && /No combat action possible/.test(effect.description ?? ""),
    );

    expect(committed.command.facts).toMatchObject({
      cancelledActions: [
        expect.objectContaining({
          participantId: "guard",
          phase: "phase2",
          previousStepStatus: "pending",
          sourceEffectKey: "sharp|head|02|01",
          step: "A2",
        }),
      ],
      createdOperationalCombatEffectIds: [],
      operationalConsequences: expect.arrayContaining([
        expect.objectContaining({ kind: "cancel_pending_action" }),
        expect.objectContaining({ kind: "note", label: "Action limited to parry" }),
      ]),
    });
    expect(parryRows).toHaveLength(1);
    expect(parryRows[0]).toMatchObject({
      description: "Action limited to parry next round.",
      duration: "2",
      effectGroup: "special",
      status: "active",
      targetParticipantId: "scenario-guard",
    });
    expect(noActionRows).toHaveLength(0);
  });

  it("commits a chest no-action critical as one next-round special row", () => {
    const pending = prepareFailedParryPendingDamage({
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [5, 5],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const damageResult = afterCritical.phaseResolutionResults[0]?.damageResult;

    expect(damageResult?.review?.criticalEffectProposal).toMatchObject({
      critKey: "sharp|chest|06",
    });
    expect(damageResult?.review?.additionalEffects).toContainEqual(
      expect.objectContaining({
        durationRounds: 2,
        rowCategory: "no_combat_action",
      }),
    );

    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-chest-no-action",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: { effects: [], events: [] },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const noActionRows = committed.combatEffects.effects.filter(
      (effect) =>
        effect.type === "special" && /No combat action possible/.test(effect.description ?? ""),
    );

    expect(committed.command.facts).toMatchObject({
      createdOperationalCombatEffectIds: [],
    });
    expect(noActionRows).toHaveLength(1);
    expect(noActionRows[0]).toMatchObject({
      description: "No combat action possible next round.",
      duration: "2",
      effectGroup: "special",
      status: "active",
      targetParticipantId: "scenario-guard",
    });
  });

  it("uses a second table lookup for normal hit damage", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 15,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 19,
      rollTotal: 19,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const highDmbDamage = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: {
        ...fixedChestLocationSelection(),
        hitLocationRolls: [14],
        selectedHitLocationRoll: 14,
      },
      roundNumber: 3,
    });
    const armoredDamage = buildCombatRoundDamageResult({
      armorModifier: -2,
      armorModifierSource: {
        armorClass: "C",
        label: "Leather vs weapon armor class A",
        status: "applied",
        weaponArmorClass: "A",
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: {
        hitLocationRolls: [19, 4],
        hitLocationSelectionReason: "targeted_closest",
        selectedHitLocation: "head",
        selectedHitLocationRoll: 19,
        targetLocation: "head",
      },
      roundNumber: 3,
    });
    const noDmbDamage = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 0,
      hitLocationSelection: fixedChestLocationSelection(),
      roundNumber: 3,
    });
    const continuedDamage = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 21,
      hitLocationSelection: fixedChestLocationSelection(),
      roundNumber: 3,
    });

    expect(result.lookupTotal).toBe(14);
    expect(highDmbDamage).toMatchObject({
      armorModifier: 0,
      criticalGrade: "b",
      damageLookupTotal: 22,
      defenderDm: 0,
      dmb: 8,
      hitLookupTotal: 14,
      hitLocationRolls: [14],
      hitLocationSelectionReason: "single_roll",
      minDamage: 1,
      selectedHitLocation: "chest",
      selectedHitLocationRoll: 14,
      tableDamage: 9,
      totalDamage: 9,
    });
    expect(highDmbDamage.armorModifierSource.status).toBe("not_applied");
    expect(armoredDamage).toMatchObject({
      armorModifier: -2,
      armorModifierSource: {
        armorClass: "C",
        status: "applied",
        weaponArmorClass: "A",
      },
      criticalGrade: "b",
      damageLookupTotal: 22,
      hitLookupTotal: 14,
      hitLocationRolls: [19, 4],
      hitLocationSelectionReason: "targeted_closest",
      selectedHitLocation: "head",
      selectedHitLocationRoll: 19,
      tableDamage: 9,
      targetLocation: "head",
      totalDamage: 7,
    });
    expect(noDmbDamage).toMatchObject({
      armorModifier: 0,
      damageLookupTotal: 14,
      defenderDm: 0,
      dmb: 0,
      hitLookupTotal: 14,
      tableDamage: 2,
      totalDamage: 2,
    });
    expect(noDmbDamage.criticalGrade).toBeUndefined();
    expect(continuedDamage).toMatchObject({
      criticalGrade: "f",
      damageLookupTotal: 35,
      hitLookupTotal: 14,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      tableDamage: 22,
      totalDamage: 22,
    });
  });

  it("maps hit location and direction to armor coverage regions", () => {
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "front", hitLocation: "head" }),
    ).toMatchObject({ armorRegion: "head", armorRegionLabel: "Head" });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "front", hitLocation: "chest" }),
    ).toMatchObject({ armorRegion: "chest" });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "back", hitLocation: "abdomen" }),
    ).toMatchObject({ armorRegion: "abdomen" });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "front", hitLocation: "leftArm" }),
    ).toMatchObject({ armorRegion: "frontArm" });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "back", hitLocation: "rightArm" }),
    ).toMatchObject({ armorRegion: "backArm" });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "front", hitLocation: "upperLeftLeg" }),
    ).toMatchObject({
      armorRegion: "frontThigh",
    });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "back", hitLocation: "upperRightLeg" }),
    ).toMatchObject({
      armorRegion: "backThigh",
    });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "front", hitLocation: "lowerLeftLeg" }),
    ).toMatchObject({
      armorRegion: "frontFoot",
    });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "back", hitLocation: "lowerRightLeg" }),
    ).toMatchObject({
      armorRegion: "backFoot",
    });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "front", hitLocation: "leftLeg" }),
    ).toMatchObject({
      armorRegion: "frontThigh",
      note: "Legacy whole-leg hit mapped to front thigh; review as upper or lower leg when critical or armor precision matters.",
    });
    expect(
      mapHitLocationAndDirectionToArmorRegion({ direction: "back", hitLocation: "rightLeg" }),
    ).toMatchObject({
      armorRegion: "backThigh",
      note: "Legacy whole-leg hit mapped to back thigh; review as upper or lower leg when critical or armor precision matters.",
    });
  });

  it("parses armor coverage labels and applies armor after table damage", () => {
    expect(parseCombatRoundArmorCoverageLabel("5C")).toEqual({
      armorClass: "C",
      armorValue: 5,
    });
    expect(parseCombatRoundArmorCoverageLabel("0A")).toEqual({
      armorClass: "A",
      armorValue: 0,
    });

    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorCoverage: {
        chest: {
          armorClass: "C",
          coverageLabel: "5C",
          label: "Chest",
          value: 5,
        },
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: fixedChestLocationSelection(),
      roundNumber: 3,
      weaponArmorClass: "C",
    });

    expect(damageResult).toMatchObject({
      armorClass: "C",
      armorCoverageLabel: "5C",
      armorDamageModifier: 0,
      armorRegion: "chest",
      armorRegionLabel: "Chest",
      armorValue: 5,
      damageLookupTotal: 26,
      minimumDamageAfterArmor: 3,
      minDamage: 3,
      provisionalDamageAfterArmor: 8,
      tableDamage: 13,
      totalDamage: 8,
      weaponArmorClass: "C",
    });

    const lowerLegDamageResult = buildCombatRoundDamageResult({
      armorCoverage: {
        frontThigh: {
          armorClass: "C",
          coverageLabel: "5C",
          label: "Front Thigh",
          value: 5,
        },
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: {
        hitLocationRolls: [1],
        hitLocationSelectionReason: "single_roll",
        selectedHitLocation: "lowerLeftLeg",
        selectedHitLocationRoll: 1,
      },
      roundNumber: 3,
      weaponArmorClass: "C",
    });

    expect(lowerLegDamageResult).toMatchObject({
      armorCoverageLabel: "0A",
      armorModifierSource: {
        reason: "Front Foot armor coverage was not available; using 0A.",
        status: "not_applied",
      },
      armorRegion: "frontFoot",
      armorRegionLabel: "Front Foot",
      armorValue: 0,
    });
    expect(lowerLegDamageResult.armorWarnings).toContain(
      "Front Foot armor coverage was not available; using 0A.",
    );
  });

  it("builds damage armor coverage from participant equipment snapshots", () => {
    const armorCoverage = buildCombatRoundDamageArmorCoverageFromEquipmentState({
      characterId: "guard-character",
      equipmentState: {
        activeLoadoutByCharacterId: {
          "guard-character": {
            wornArmorItemId: "armor-item-leather-jerkin",
          },
        },
        itemsById: {
          "armor-item-leather-jerkin": {
            id: "armor-item-leather-jerkin",
            templateId: "armor-template-leather-jerkin",
          },
        },
        templates: {
          templatesById: {
            "armor-template-leather-jerkin": {
              category: "armor",
              criticalModifierByArea: {
                chest: 1,
                frontFoot: 1,
              },
              id: "armor-template-leather-jerkin",
              locationTypes: {
                chest: "B",
                frontFoot: "B",
              },
              locationValues: {
                chest: 3,
                frontFoot: 3,
              },
              name: "Leather Jerkin",
            },
          },
        },
      },
    });

    expect(armorCoverage.chest).toMatchObject({
      armorClass: "B",
      coverageLabel: "3B",
      criticalModifier: 1,
      label: "Chest",
      value: 3,
    });
    expect(armorCoverage.frontFoot).toMatchObject({
      armorClass: "B",
      coverageLabel: "3B",
      criticalModifier: 1,
      label: "Front Foot",
      value: 3,
    });
  });

  it("uses defender armor coverage and weapon armor class without false fallback warnings", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorCoverage: {
        chest: {
          armorClass: "B",
          coverageLabel: "3B",
          criticalModifier: 1,
          label: "Chest",
          value: 3,
        },
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: fixedChestLocationSelection(),
      roundNumber: 3,
      weaponArmorClass: "C",
    });
    const effectiveDamage = getCombatRoundEffectiveDamageResult(damageResult);

    expect(effectiveDamage).toMatchObject({
      effectiveArmorClass: "B",
      effectiveArmorCoverageLabel: "3B",
      effectiveArmorModifier: 0,
      effectiveArmorRegion: "chest",
      effectiveArmorValue: 3,
      effectiveWeaponArmorClass: "C",
    });
    expect(effectiveDamage.effectiveArmorWarnings).toEqual([]);
    expect(damageResult.armorModifierSource).toMatchObject({
      armorClass: "B",
      status: "applied",
      weaponArmorClass: "C",
    });
  });

  it("derives armor critical modifier from the selected armor region when data exists", () => {
    const pending = prepareFailedParryPendingDamage({
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      armorCoverage: {
        chest: {
          armorClass: "B",
          coverageLabel: "3B",
          criticalModifier: 1,
          label: "Chest",
          value: 3,
        },
      },
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
      weaponArmorClass: "C",
    });
    const damageResult = afterDamage.phaseResolutionResults[0]?.damageResult;

    if (!damageResult) {
      throw new Error("Expected damage result.");
    }

    expect(getCombatRoundArmorCriticalModifierForDamageResult(damageResult)).toMatchObject({
      armorCriticalModifier: 1,
      source: {
        status: "applied",
      },
    });

    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });

    expect(afterCritical.phaseResolutionResults[0]?.criticalRoll).toMatchObject({
      armorCriticalModifier: 1,
      armorCriticalModifierSource: {
        status: "applied",
      },
      criticalDiceTotal: 9,
      criticalTypeModifier: -4,
      finalCriticalRoll: 4,
      selectedHitLocation: "chest",
    });
    expect(afterCritical.commands.at(-1)?.facts).toMatchObject({
      armorCriticalModifier: 1,
      armorCriticalModifierSource: {
        status: "applied",
      },
    });

    const heavierArmorState = {
      ...afterDamage,
      phaseResolutionResults: afterDamage.phaseResolutionResults.map((resolution) =>
        resolution.damageResult
          ? {
              ...resolution,
              damageResult: {
                ...resolution.damageResult,
                armorCoverage: {
                  ...resolution.damageResult.armorCoverage,
                  chest: {
                    ...resolution.damageResult.armorCoverage.chest!,
                    criticalModifier: 3,
                  },
                },
              },
            }
          : resolution,
      ),
    };
    const afterHeavierArmorCritical = recordCombatRoundCriticalRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "gladiator",
      state: heavierArmorState,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });

    expect(afterHeavierArmorCritical.phaseResolutionResults[0]?.criticalRoll).toMatchObject({
      armorCriticalModifier: 3,
      criticalDiceTotal: 9,
      criticalTypeModifier: -4,
      finalCriticalRoll: 2,
    });
  });

  it("derives effective D1 damage values from GM review overrides without replacing computed values", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 15,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 19,
      rollTotal: 19,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: {
        ...fixedChestLocationSelection(),
        hitLocationRolls: [14],
        selectedHitLocationRoll: 14,
      },
      roundNumber: 3,
    });
    const reviewedDamageResult = {
      ...damageResult,
      review: {
        additionalEffects: [],
        armorModifierOverride: -2,
        criticalGradeOverride: "a",
        notes: "armor adjusted manually",
        operationalConsequences: [],
        reviewedAt: "2026-01-01T00:06:00.000Z",
        selectedHitLocationOverride: "rightArm" as const,
      },
    };

    expect(getCombatRoundEffectiveDamageResult(reviewedDamageResult)).toMatchObject({
      computedArmorModifier: 0,
      computedCriticalGrade: "b",
      computedDamageLookupTotal: 22,
      computedSelectedHitLocation: "chest",
      computedTableDamage: 9,
      computedTotalDamage: 9,
      effectiveArmorModifier: -2,
      effectiveCriticalGrade: "a",
      effectiveDamageLookupTotal: 22,
      effectiveSelectedHitLocation: "rightArm",
      effectiveTableDamage: 9,
      effectiveTotalDamage: 7,
      hasReviewOverrides: true,
      requiresTotalDamageOverride: false,
    });
  });

  it("caps max damage before committing a location-specific D1 physical damage row", () => {
    const { attackResult, state } = prepareFailedParryPendingDamage({
      defenderDb: 10,
      ob: 10,
      rollD20: 18,
    });
    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [8],
      state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      attackerStrengthGm: 4,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 18,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [5, 6],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-capped",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const cleanedCombatEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: committed.command,
    });
    const damageResult = afterDamage.phaseResolutionResults[0]?.damageResult;
    const expectedCommitEffectId =
      "commit-capped:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:physical-damage-abdomenLowerBack";

    expect(damageResult).toMatchObject({
      attackerStrengthGm: 4,
      cappedTotalDamage: 21,
      criticalGrade: "f",
      damageLookupTotal: 36,
      maxDamageApplied: true,
      maxDamageCap: 21,
      rawTotalDamage: 23,
      selectedHitLocation: "abdomen",
      tableDamage: 23,
      totalDamage: 23,
    });
    expect(
      damageResult ? getCombatRoundEffectiveDamageResult(damageResult) : undefined,
    ).toMatchObject({
      computedMaxDamageApplied: true,
      computedMaxDamageCap: 21,
      computedTotalDamage: 23,
      effectiveMaxDamageApplied: true,
      effectiveMaxDamageCap: 21,
      effectiveRawTotalDamage: 23,
      effectiveTotalDamage: 21,
    });
    expect(committed.command).toMatchObject({
      facts: expect.objectContaining({
        createdDamageEffectIds: [expectedCommitEffectId],
        effectivePhysicalDamageLocation: expect.objectContaining({
          id: "abdomenLowerBack",
          label: "Abdomen/lower back",
        }),
        maxDamageApplied: true,
        maxDamageCap: 21,
        rawTotalDamage: 23,
        totalDamage: 21,
      }),
      type: "commit_phase_damage",
    });
    const committedDamageEvent = committed.state.events.find(
      (event) => event.type === "damage_committed",
    );
    expect(committedDamageEvent?.facts.resultPresentation).toMatchObject({
      actionInstanceId: "3:phase1:gladiator:guard:damage",
      committedConsequences: expect.arrayContaining([
        expect.objectContaining({ key: "totalDamage", value: 21 }),
        expect.objectContaining({ key: "criticalGrade", value: "f" }),
      ]),
      standardConsequences: expect.arrayContaining([
        expect.objectContaining({ key: "totalDamage", value: 21 }),
        expect.objectContaining({ key: "criticalGrade", value: "f" }),
      ]),
    });
    expect(committedDamageEvent?.facts.resultPresentation?.adjustment).toBeUndefined();
    expect(committedDamageEvent?.facts.resultPresentation?.publicCombatNote).toBeUndefined();
    expect(
      (committedDamageEvent?.facts.gmReview.review as Record<string, unknown> | undefined)?.notes,
    ).toBeUndefined();
    expect(committed.combatEffects.events[0]?.description).toContain(
      "Maximum damage capped raw 23 to 21",
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        damage: 21,
        generalDamage: 0,
        id: expectedCommitEffectId,
        location: "abdomenLowerBack",
        targetParticipantId: "scenario-guard",
        type: "physical_damage",
      }),
    );
    expect(cleanedCombatEffects).toEqual({ effects: [], events: [] });
  });

  it("applies the max damage cap to GM total damage overrides", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackerStrengthGm: 4,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 18,
      hitLocationSelection: {
        ...fixedChestLocationSelection(),
        hitLocationRolls: [8],
        selectedHitLocation: "abdomen",
        selectedHitLocationRoll: 8,
      },
      roundNumber: 3,
    });
    const reviewedDamageResult = {
      ...damageResult,
      review: {
        additionalEffects: [],
        operationalConsequences: [],
        reviewedAt: "2026-01-01T00:05:30.000Z",
        totalDamageOverride: 30,
      },
    };

    expect(getCombatRoundEffectiveDamageResult(reviewedDamageResult)).toMatchObject({
      effectiveMaxDamageApplied: false,
      effectiveMaxDamageCap: 21,
      effectiveRawTotalDamage: 30,
      effectiveTotalDamage: 30,
    });
  });

  it.each([
    { effectLocation: "head", roll: 19 },
    { effectLocation: "rightArm", roll: 18 },
    { effectLocation: "leftArm", roll: 16 },
    { effectLocation: "chestBack", roll: 12 },
    { effectLocation: "upperRightLeg", roll: 5 },
    { effectLocation: "lowerRightLeg", roll: 4 },
    { effectLocation: "upperLeftLeg", roll: 2 },
    { effectLocation: "lowerLeftLeg", roll: 1 },
  ])("commits hit location roll $roll to physical damage location $effectLocation", (caseInput) => {
    const { attackResult, state } = prepareFailedParryPendingDamage({});
    const afterLocation = recordTestHitLocation({
      attackResult,
      hitLocationRolls: [caseInput.roll],
      state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 0,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: `commit-${caseInput.effectLocation}`,
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterDamage,
    });

    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        damage: 2,
        generalDamage: 0,
        location: caseInput.effectLocation,
        targetParticipantId: "scenario-guard",
        type: "physical_damage",
      }),
    );
  });

  it("records and undoes grazing D1 damage rolls after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: declareRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [1],
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      rng: () => 0,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: afterDamage,
      step: "phase_1_damage",
    });

    expect(result.lookupTotal).toBe(11);
    expect(result.grazing).toBe(true);
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      damageLookupTotal: 20,
      damageRoll: {
        grazingDieSides: 7,
        grazingReferenceDamage: 7,
        grazingReferenceDamageLookupTotal: 20,
        grazingReferenceHitLookupTotal: 12,
        grazingReferenceTableDamage: 7,
        derivedFromLookupTotal: 12,
        derivedNormalDamageTotal: 7,
        diceExpression: "1d7",
        rawGrazingDamage: 1,
        required: true,
        rolls: [1],
        total: 1,
      },
      dmb: 8,
      grazing: true,
      hitLocationRolls: [1],
      hitLocationSelectionReason: "single_roll",
      hitLookupTotal: 11,
      selectedHitLocation: "lowerLeftLeg",
      selectedHitLocationRoll: 1,
      tableDamage: 7,
      totalDamage: 1,
    });
    expect(afterDamage.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        totalDamage: 1,
      }),
      type: "resolve_damage",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.hitLocationRoll.status).toBe("rolled");
  });

  it("uses raw reference table damage for the grazing die before armor modifier", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorModifier: -2,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: {
        ...fixedChestLocationSelection(),
        hitLocationRolls: [8],
        selectedHitLocation: "abdomen",
        selectedHitLocationRoll: 8,
      },
      rng: () => 0,
      roundNumber: 3,
    });

    expect(damageResult).toMatchObject({
      armorModifier: -2,
      damageLookupTotal: 20,
      damageRoll: {
        diceExpression: "1d7",
        grazingDieSides: 7,
        grazingReferenceDamage: 7,
        grazingReferenceDamageLookupTotal: 20,
        grazingReferenceHitLookupTotal: 12,
        grazingReferenceTableDamage: 7,
        rawGrazingDamage: 1,
        required: true,
        rolls: [1],
        total: 1,
      },
      hitLookupTotal: 11,
      selectedHitLocation: "abdomen",
      tableDamage: 7,
      totalDamage: 0,
    });
    expect(
      getCombatRoundEffectiveDamageResult({
        ...damageResult,
        review: {
          additionalEffects: [],
          armorModifierOverride: -2,
          operationalConsequences: [],
          reviewedAt: "2026-01-01T00:06:00.000Z",
        },
      }),
    ).toMatchObject({
      effectiveDamageRoll: expect.objectContaining({
        diceExpression: "1d7",
        rawGrazingDamage: 1,
      }),
      effectiveProvisionalDamageAfterArmor: -1,
      effectiveRawTotalDamage: 0,
      effectiveTotalDamage: 0,
      requiresTotalDamageOverride: false,
    });
  });

  it("applies armor value after the raw grazing roll", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorCoverage: {
        chest: {
          armorClass: "B",
          coverageLabel: "3B",
          label: "Chest",
          value: 3,
        },
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 7,
      hitLocationSelection: fixedChestLocationSelection(),
      rng: () => 0.2,
      roundNumber: 3,
    });

    expect(damageResult).toMatchObject({
      armorValue: 3,
      damageLookupTotal: 19,
      damageRoll: {
        diceExpression: "1d6",
        grazingDieSides: 6,
        grazingReferenceDamage: 6,
        grazingReferenceTableDamage: 6,
        rawGrazingDamage: 2,
        rolls: [2],
        total: 2,
      },
      minDamage: undefined,
      provisionalDamageAfterArmor: -1,
      tableDamage: 6,
      totalDamage: 0,
    });
  });

  it("applies minimum damage after armor reduces a grazing roll", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorCoverage: {
        chest: {
          armorClass: "B",
          coverageLabel: "3B",
          label: "Chest",
          value: 3,
        },
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 10,
      hitLocationSelection: fixedChestLocationSelection(),
      rng: () => 0,
      roundNumber: 3,
    });

    expect(damageResult).toMatchObject({
      armorValue: 3,
      damageLookupTotal: 22,
      damageRoll: {
        diceExpression: "1d9",
        grazingDieSides: 9,
        grazingReferenceDamage: 9,
        grazingReferenceTableDamage: 9,
        rawGrazingDamage: 1,
        rolls: [1],
        total: 1,
      },
      minDamage: 1,
      minimumDamageAfterArmor: 1,
      provisionalDamageAfterArmor: -2,
      totalDamage: 1,
    });
  });

  it("applies critical minimum after armor-adjusted grazing damage", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorCoverage: {
        chest: {
          armorClass: "B",
          coverageLabel: "3B",
          label: "Chest",
          value: 3,
        },
      },
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 7,
      hitLocationSelection: fixedChestLocationSelection(),
      rng: () => 0.2,
      roundNumber: 3,
    });
    const reviewedDamageResult = {
      ...damageResult,
      review: {
        additionalEffects: [
          {
            id: "critical-min-floor",
            kind: "note" as const,
            label: "Minimum damage floor 5",
            minTotalDamage: 5,
            notes: "Critical minimum damage floor.",
          },
        ],
        operationalConsequences: [],
        reviewedAt: "2026-01-01T00:06:00.000Z",
      },
    };

    expect(getCombatRoundEffectiveDamageResult(reviewedDamageResult)).toMatchObject({
      criticalMinApplied: true,
      criticalMinExtra: 5,
      criticalMinTotalDamage: 5,
      effectiveRawTotalDamage: 0,
      effectiveTotalDamage: 5,
      preCriticalEffectiveDamage: 0,
    });
  });

  it("uses at least a 1-sided grazing damage die with no DMB, DM, or armor modifier", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const damageResult = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult: result,
      createdAt: "2026-01-01T00:05:00.000Z",
      defenderDm: 0,
      dmb: 0,
      hitLocationSelection: fixedChestLocationSelection(),
      rng: () => 0,
      roundNumber: 3,
    });

    expect(damageResult).toMatchObject({
      damageLookupTotal: 12,
      damageRoll: {
        grazingDieSides: 1,
        grazingReferenceDamage: 1,
        grazingReferenceDamageLookupTotal: 12,
        grazingReferenceHitLookupTotal: 12,
        grazingReferenceTableDamage: 1,
        derivedFromLookupTotal: 12,
        derivedNormalDamageTotal: 1,
        diceExpression: "1d1",
        rawGrazingDamage: 1,
        required: true,
        rolls: [1],
        total: 1,
      },
      grazing: true,
      hitLookupTotal: 11,
      tableDamage: 1,
      totalDamage: 1,
    });
  });

  it("commits a valid non-critical damage proposal by attack id without a saved review", () => {
    const pending = prepareFailedParryPendingDamage({});
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 0,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const damageResult = afterDamage.phaseResolutionResults[0]?.damageResult;

    if (!damageResult) {
      throw new Error("Expected damage result.");
    }

    const readiness = getCombatRoundPhaseDamageCommitReadiness({
      attackResultId: damageResult.attackResultId,
      state: {
        ...afterDamage,
        phaseResolutionCursor: undefined,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
    });
    const committed = commitCombatRoundPhaseDamage({
      attackResultId: damageResult.attackResultId,
      command: {
        commandId: "commit-by-attack-id",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-guard",
      state: {
        ...afterDamage,
        phaseResolutionCursor: undefined,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
    });

    expect(readiness).toMatchObject({
      attackResultId: damageResult.attackResultId,
      ready: true,
    });
    expect(readiness.warnings).toContain("Chest armor coverage was not available; using 0A.");
    expect(committed.command).toMatchObject({
      facts: expect.objectContaining({
        attackResultId: damageResult.attackResultId,
        totalDamage: 2,
      }),
      type: "commit_phase_damage",
    });
    expect(committed.state.events.at(-1)).toMatchObject({
      attackResultId: damageResult.attackResultId,
      commandId: "commit-by-attack-id",
      damageResultId: `${damageResult.attackResultId}:damage`,
      ownerParticipantId: "guard",
      type: "damage_committed",
    });
    expect(committed.state.events.at(-1)?.facts.gmReview).toBeDefined();
    expect(committed.state.events.at(-1)?.facts.publicOutcome).toEqual({
      status: "committed",
    });
    expect(committed.state.phaseResolutionResults[0]?.damageProposal.status).toBe("committed");
  });

  it("allows base damage commit when critical effect proposal mapping is unavailable", () => {
    const pending = prepareFailedParryPendingDamage({});
    const attackResult = {
      ...pending.attackResult,
      weaponCriticalCode: "ZZ",
      weaponDamageClass: "unknown",
    };
    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const damageResult = afterCritical.phaseResolutionResults[0]?.damageResult;

    if (!damageResult) {
      throw new Error("Expected damage result.");
    }

    const readiness = getCombatRoundPhaseDamageCommitReadiness({
      attackResultId: damageResult.attackResultId,
      state: afterCritical,
    });
    const committed = commitCombatRoundPhaseDamage({
      attackResultId: damageResult.attackResultId,
      command: {
        commandId: "commit-critical-warning",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-guard",
      state: afterCritical,
    });

    expect(damageResult.review?.criticalEffectProposal?.warnings.length).toBeGreaterThan(0);
    expect(readiness.ready).toBe(true);
    expect(
      readiness.warnings.some((warning) => warning.includes("Critical effects unavailable")),
    ).toBe(true);
    expect(committed.command).toMatchObject({
      facts: expect.objectContaining({
        attackResultId: damageResult.attackResultId,
        createdDamageEffectIds: expect.arrayContaining([expect.any(String)]),
        status: "committed",
      }),
      type: "commit_phase_damage",
    });
    expect(
      committed.command.facts.review as
        | {
            criticalEffectProposal?: {
              warnings?: string[];
            };
          }
        | undefined,
    ).toMatchObject({
      criticalEffectProposal: {
        warnings: expect.any(Array),
      },
    });
  });

  it("blocks critical damage commit with a specific reason until the critical roll exists", () => {
    const pending = prepareFailedParryPendingDamage({});
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const damageResult = afterDamage.phaseResolutionResults[0]?.damageResult;

    if (!damageResult) {
      throw new Error("Expected damage result.");
    }

    expect(
      getCombatRoundPhaseDamageCommitReadiness({
        attackResultId: damageResult.attackResultId,
        state: afterDamage,
      }),
    ).toMatchObject({
      ready: false,
      reason: "Cannot commit: critical roll is required.",
    });
    expect(() =>
      commitCombatRoundPhaseDamage({
        attackResultId: damageResult.attackResultId,
        command: {
          commandId: "commit-before-critical",
          createdAt: "2026-01-01T00:06:00.000Z",
          createdByUserId: "gm-1",
        },
        defenderScenarioParticipantId: "scenario-guard",
        state: afterDamage,
      }),
    ).toThrow("Cannot commit: critical roll is required.");
    expect(afterDamage.commands.at(-1)?.type).toBe("resolve_damage");
  });

  it("treats final critical rolls below 1 as no effect and still commits base damage", () => {
    const pending = prepareFailedParryPendingDamage({});
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [1, 1],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const damageResult = afterCritical.phaseResolutionResults[0]?.damageResult;

    if (!damageResult) {
      throw new Error("Expected damage result.");
    }

    expect(afterCritical.phaseResolutionResults[0]?.criticalRoll.finalCriticalRoll).toBe(-2);
    expect(damageResult.review?.criticalEffectProposal).toMatchObject({
      criticalIndexStatus: "no_effect",
      warnings: [],
    });
    expect(damageResult.review?.criticalEffectProposal?.critKey).toBeUndefined();
    expect(damageResult.review?.additionalEffects).toEqual([]);
    expect(
      getCombatRoundPhaseDamageCommitReadiness({
        attackResultId: damageResult.attackResultId,
        state: afterCritical,
      }),
    ).toMatchObject({
      ready: true,
    });

    const committed = commitCombatRoundPhaseDamage({
      attackResultId: damageResult.attackResultId,
      command: {
        commandId: "commit-no-critical-effect",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-guard",
      state: afterCritical,
    });

    expect(committed.command.type).toBe("commit_phase_damage");
  });

  it("regenerates critical proposals when the GM overrides the effective critical index", () => {
    const pending = prepareFailedParryPendingDamage({ weaponDamageClass: "edged" });
    const afterLocation = recordTestHitLocation({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [17],
      state: pending.state,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: pending.attackResult,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [1, 1],
      rolledByParticipantId: "gladiator",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const noEffectDamage = afterCritical.phaseResolutionResults[0]?.damageResult;

    if (!noEffectDamage) {
      throw new Error("Expected damage result.");
    }

    expect(noEffectDamage.review?.criticalEffectProposal).toMatchObject({
      criticalIndexStatus: "no_effect",
    });

    const overrideToIndex = reviewCombatRoundDamageResult({
      attackResultId: noEffectDamage.attackResultId,
      reviewedAt: "2026-01-01T00:05:45.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: [],
        finalCriticalRollOverride: 3,
        operationalConsequences: [],
      },
      state: afterCritical,
    });
    const overriddenDamage = overrideToIndex.phaseResolutionResults[0]?.damageResult;

    expect(overriddenDamage?.review?.criticalEffectProposal).toMatchObject({
      criticalIndexStatus: "table_lookup",
      critIndex: 3,
      critKey: "sharp|arm|03",
    });
    expect(overriddenDamage?.review?.additionalEffects.length).toBeGreaterThan(0);
    expect(overrideToIndex.phaseResolutionResults[0]?.criticalRoll.finalCriticalRoll).toBe(-2);

    const overrideToNoEffect = reviewCombatRoundDamageResult({
      attackResultId: noEffectDamage.attackResultId,
      reviewedAt: "2026-01-01T00:05:50.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: overriddenDamage?.review?.additionalEffects ?? [],
        finalCriticalRollOverride: 0,
        operationalConsequences: overriddenDamage?.review?.operationalConsequences ?? [],
      },
      state: overrideToIndex,
    });
    const removedDamage = overrideToNoEffect.phaseResolutionResults[0]?.damageResult;

    expect(removedDamage?.review?.criticalEffectProposal).toMatchObject({
      criticalIndexStatus: "no_effect",
      warnings: [],
    });
    expect(removedDamage?.review?.criticalEffectProposal?.critKey).toBeUndefined();
    expect(removedDamage?.review?.additionalEffects).toEqual([]);
    expect(overrideToNoEffect.phaseResolutionResults[0]?.criticalRoll.finalCriticalRoll).toBe(-2);
  });

  it("commits D1 damage rows and clears commit before clearing the proposal", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase1",
        state: declareRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [18, 7],
      state: afterParry,
      targetLocation: "chest",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterReview = reviewCombatRoundDamageResult({
      attackResultId: "3:phase1:gladiator:guard",
      reviewedAt: "2026-01-01T00:05:30.000Z",
      reviewedByUserId: "gm-1",
      review: {
        additionalEffects: [
          {
            durationRounds: 2,
            id: "guard-stun",
            kind: "modifier",
            label: "Stunned",
            modifierBucket: "general",
            modifierValue: -4,
            notes: "critical stun manual",
            phase: "untilCleared",
          },
          {
            id: "guard-note",
            kind: "note",
            label: "Dropped weapon",
            notes: "manual special note",
          },
          {
            id: "guard-no-action",
            kind: "special",
            label: "No combat action possible",
            notes: "Unconscious.",
            rowCategory: "no_combat_action",
          },
          {
            id: "guard-bleed",
            kind: "special",
            label: "Bleed",
            notes: "Bleed: 2/10 HP per round until treated.",
            rateValuePerRound: 2,
            rowCategory: "bleed",
          },
          {
            durationRounds: 3,
            id: "guard-loss-of-use",
            kind: "special",
            label: "Loss of use",
            notes:
              "Loss of use: no actions with affected right arm. Until treated. Duration roll d6 = 3.",
            rollReports: [
              {
                effectKey: "sharp|arm|05|02",
                formula: "d6",
                purpose: "duration",
                rolls: [3],
                sourceField: "durationRoll",
                total: 3,
              },
            ],
            rowCategory: "loss_of_use",
          },
          {
            durationRounds: 1,
            id: "guard-parry-only",
            kind: "special",
            label: "Action limited to parry",
            notes: "Action limited to parry. Duration: next round.",
            rowCategory: "no_combat_action",
          },
          {
            accepted: false,
            id: "guard-declined-db",
            kind: "modifier",
            label: "Declined DB row",
            modifierBucket: "db",
            modifierValue: -8,
            notes: "GM declined this row.",
            rowCategory: "db_parry_modifier",
          },
        ],
        armorModifierOverride: -2,
        criticalGradeOverride: "a",
        notes: "armor adjusted manually",
        operationalConsequences: [],
        totalDamageOverride: 6,
      },
      state: afterDamage,
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:45.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "gladiator",
      state: afterReview,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:45.000Z",
    });
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          effectGroup: "general",
          generalDamage: 0,
          id: "existing-stun",
          modifierValue: -1,
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "scenario-guard",
          type: "stun",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing effect",
          sourceType: "manual",
          targetParticipantId: "scenario-guard",
        },
      ],
    };
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-gladiator",
      command: {
        commandId: "commit-d1",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      createdRevision: "revision-damage-1",
      defenderScenarioParticipantId: "scenario-guard",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const commitCommand = committed.command;
    const expectedCommitEventId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:physical-damage-abdomenLowerBack";
    const expectedStunEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:additional-guard-stun";
    const expectedNoteEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:additional-guard-note";
    const expectedNoActionEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:additional-guard-no-action";
    const expectedBleedEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:additional-guard-bleed";
    const expectedLossOfUseEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:additional-guard-loss-of-use";
    const expectedParryOnlyEffectId =
      "commit-d1:r3:phase1:3-phase1-gladiator-guard:3-phase1-gladiator-guard-damage:combat-effect:additional-guard-parry-only";
    const clearedCommitState = clearCombatRoundStep({
      state: {
        ...committed.state,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });
    const cleanedCombatEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: commitCommand,
    });
    const clearedCriticalState = clearCombatRoundStep({
      state: clearedCommitState,
      step: "phase_1_damage",
    });
    const clearedProposalState = clearCombatRoundStep({
      state: clearedCriticalState,
      step: "phase_1_damage",
    });

    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(afterDamage.phaseResolutionResults[0]?.damageResult).toMatchObject({
      hitLocationRolls: [18, 7],
      hitLocationSelectionReason: "targeted_closest",
      selectedHitLocation: "abdomen",
      selectedHitLocationRoll: 7,
      targetLocation: "chest",
    });
    const reviewedDamageResult = afterReview.phaseResolutionResults[0]?.damageResult;

    expect(reviewedDamageResult?.review).toMatchObject({
      additionalEffects: [
        expect.objectContaining({
          id: "guard-stun",
          kind: "modifier",
          modifierBucket: "general",
          modifierValue: -4,
        }),
        expect.objectContaining({
          id: "guard-note",
          kind: "note",
        }),
        expect.objectContaining({
          id: "guard-no-action",
          rowCategory: "no_combat_action",
        }),
        expect.objectContaining({
          id: "guard-bleed",
          rateValuePerRound: 2,
          rowCategory: "bleed",
        }),
        expect.objectContaining({
          durationRounds: 3,
          id: "guard-loss-of-use",
          rowCategory: "loss_of_use",
        }),
        expect.objectContaining({
          durationRounds: 1,
          id: "guard-parry-only",
          rowCategory: "no_combat_action",
        }),
        expect.objectContaining({
          accepted: false,
          id: "guard-declined-db",
        }),
      ],
      armorModifierOverride: -2,
      criticalGradeOverride: "a",
      notes: "armor adjusted manually",
      reviewedAt: "2026-01-01T00:05:30.000Z",
      reviewedByUserId: "gm-1",
      totalDamageOverride: 6,
    });
    if (!reviewedDamageResult) {
      throw new Error("Expected reviewed damage result.");
    }
    expect(getCombatRoundEffectiveDamageResult(reviewedDamageResult)).toMatchObject({
      computedTotalDamage: 9,
      effectiveArmorModifier: -2,
      effectiveCriticalGrade: "a",
      effectiveDamageLookupTotal: 22,
      effectiveTotalDamage: 6,
    });
    expect(afterDamage.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        hitLocationRolls: [18, 7],
        hitLocationSelectionReason: "targeted_closest",
        selectedHitLocation: "abdomen",
        selectedHitLocationRoll: 7,
        targetLocation: "chest",
      }),
      type: "resolve_damage",
    });
    expect(committed.command).toMatchObject({
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase1:gladiator:guard",
        additionalEffects: [
          expect.objectContaining({
            id: "guard-stun",
            modifierValue: -4,
          }),
          expect.objectContaining({
            id: "guard-note",
          }),
          expect.objectContaining({
            id: "guard-no-action",
            rowCategory: "no_combat_action",
          }),
          expect.objectContaining({
            id: "guard-bleed",
            rowCategory: "bleed",
          }),
          expect.objectContaining({
            durationRounds: 3,
            id: "guard-loss-of-use",
            rowCategory: "loss_of_use",
          }),
          expect.objectContaining({
            durationRounds: 1,
            id: "guard-parry-only",
            rowCategory: "no_combat_action",
          }),
        ],
        attackerParticipantId: "gladiator",
        createdAdditionalCombatEffectIds: [
          expectedStunEffectId,
          expectedNoteEffectId,
          expectedNoActionEffectId,
          expectedBleedEffectId,
          expectedLossOfUseEffectId,
          expectedParryOnlyEffectId,
        ],
        createdCombatEffectEventId: expectedCommitEventId,
        createdCombatEffectIds: [
          expectedCommitEffectId,
          expectedStunEffectId,
          expectedNoteEffectId,
          expectedNoActionEffectId,
          expectedBleedEffectId,
          expectedLossOfUseEffectId,
          expectedParryOnlyEffectId,
        ],
        createdDamageEffectIds: [expectedCommitEffectId],
        criticalGrade: "a",
        criticalRoll: expect.objectContaining({
          criticalDice: [4, 5],
          criticalDiceTotal: 9,
          criticalGrade: "a",
          criticalTypeModifier: -6,
          finalCriticalRoll: 3,
          selectedHitLocation: "abdomen",
        }),
        damageResultId: "3:phase1:gladiator:guard:damage",
        defenderParticipantId: "guard",
        effectiveArmorModifier: -2,
        effectiveDamageLookupTotal: 22,
        effectiveProvisionalDamageAfterArmor: 7,
        review: expect.objectContaining({
          notes: "armor adjusted manually",
          totalDamageOverride: 6,
        }),
        status: "committed",
        totalDamage: 6,
      }),
      participantId: "guard",
      phase: "phase1",
      step: "D1",
      type: "commit_phase_damage",
    });
    const committedDamageEvent = committed.state.events.find(
      (event) => event.type === "damage_committed",
    );
    expect(committedDamageEvent?.facts.resultPresentation).toMatchObject({
      actionInstanceId: "3:phase1:gladiator:guard:damage",
      adjustment: {
        adjustedBy: "gm",
        entries: expect.arrayContaining([
          expect.objectContaining({
            committedValue: 6,
            consequenceKey: "totalDamage",
            standardValue: 9,
          }),
          expect.objectContaining({
            committedValue: "a",
            consequenceKey: "criticalGrade",
            standardValue: "b",
          }),
        ]),
      },
      committedConsequences: expect.arrayContaining([
        expect.objectContaining({ key: "totalDamage", value: 6 }),
        expect.objectContaining({ key: "criticalGrade", value: "a" }),
      ]),
      publicCombatNote: "armor adjusted manually",
      standardConsequences: expect.arrayContaining([
        expect.objectContaining({ key: "totalDamage", value: 9 }),
        expect.objectContaining({ key: "criticalGrade", value: "b" }),
      ]),
    });
    expect(
      (committedDamageEvent?.facts.gmReview.review as Record<string, unknown> | undefined)?.notes,
    ).toBeUndefined();
    expect(committed.combatEffects.events).toContainEqual(
      expect.objectContaining({
        description: expect.stringContaining("armor adjusted manually"),
        id: expectedCommitEventId,
        sourceActorId: "scenario-gladiator",
        sourceType: "combat_action",
        targetParticipantId: "scenario-guard",
      }),
    );
    expect(
      committed.combatEffects.events.find((event) => event.id === expectedCommitEventId)
        ?.description,
    ).toContain(
      "Accepted rows: Stunned, Dropped weapon, No combat action possible, Bleed, Loss of use, Action limited to parry.",
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        damage: 6,
        id: expectedCommitEffectId,
        location: "abdomenLowerBack",
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "physical_damage",
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        canonicalLifecycle: expect.objectContaining({
          lifecycle: expect.objectContaining({
            duration: expect.objectContaining({ kind: "rounds", remaining: 2 }),
          }),
          payload: expect.objectContaining({ effectKind: "stunned", kind: "restriction" }),
          sourceFamily: "stunned",
        }),
        combatModifierBucket: "general",
        description: "Stunned: critical stun manual. Until cleared.",
        duration: "2",
        effectGroup: "general",
        id: expectedStunEffectId,
        modifierValue: -4,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "general_modifier",
      }),
    );
    expect(
      mergePersistentCombatEffectModifiers({
        combatEffects: committed.combatEffects,
      }).modifierBuckets.general,
    ).toContainEqual(
      expect.objectContaining({
        id: `import:character_effect:${expectedStunEffectId}:general`,
        sourceEffectId: expectedStunEffectId,
        value: -4,
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        description: "Dropped weapon: manual special note.",
        effectGroup: "special",
        id: expectedNoteEffectId,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "special",
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        description: "No combat action possible.",
        effectGroup: "special",
        id: expectedNoActionEffectId,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "special",
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        canonicalLifecycle: expect.objectContaining({
          payload: expect.objectContaining({
            category: "bleed_rate",
            contributionScope: "state",
            unit: "bleed_rate",
            value: 2,
          }),
          sourceFamily: "bleed",
        }),
        description: "Bleed: 2/10 HP per round until treated.",
        effectGroup: "bleed",
        id: expectedBleedEffectId,
        modifierValue: 2,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "bleed",
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        description: "No actions with affected right arm. Until treated. Duration roll d6 = 3.",
        duration: "3",
        effectGroup: "special",
        id: expectedLossOfUseEffectId,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "special",
      }),
    );
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        description: "Action limited to parry next round.",
        duration: "1",
        effectGroup: "special",
        id: expectedParryOnlyEffectId,
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-guard",
        type: "special",
      }),
    );
    expect(committed.combatEffects.effects).not.toContainEqual(
      expect.objectContaining({
        id: expect.stringContaining("guard-declined-db"),
      }),
    );
    expect(committed.state.phaseResolutionResults[0]?.damageProposal).toMatchObject({
      committedCombatEffectEventId: expectedCommitEventId,
      committedCombatEffectIds: [
        expectedCommitEffectId,
        expectedStunEffectId,
        expectedNoteEffectId,
        expectedNoActionEffectId,
        expectedBleedEffectId,
        expectedLossOfUseEffectId,
        expectedParryOnlyEffectId,
      ],
      status: "committed",
    });
    expect(clearedCommitState.commands.at(-1)).toMatchObject({
      type: "roll_critical",
    });
    expect(clearedCommitState.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(clearedCommitState.phaseResolutionResults[0]?.damageResult).toMatchObject({
      hitLocationRolls: [18, 7],
      review: expect.objectContaining({
        additionalEffects: [
          expect.objectContaining({
            id: "guard-stun",
            modifierValue: -4,
          }),
          expect.objectContaining({
            id: "guard-note",
          }),
          expect.objectContaining({
            id: "guard-no-action",
            rowCategory: "no_combat_action",
          }),
          expect.objectContaining({
            id: "guard-bleed",
            rowCategory: "bleed",
          }),
          expect.objectContaining({
            durationRounds: 3,
            id: "guard-loss-of-use",
            rowCategory: "loss_of_use",
          }),
          expect.objectContaining({
            durationRounds: 1,
            id: "guard-parry-only",
            rowCategory: "no_combat_action",
          }),
          expect.objectContaining({
            accepted: false,
            id: "guard-declined-db",
          }),
        ],
        armorModifierOverride: -2,
        totalDamageOverride: 6,
      }),
      selectedHitLocation: "abdomen",
      targetLocation: "chest",
    });
    expect(clearedCommitState.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(clearedCommitState.phaseResolutionResults[0]?.criticalRoll.status).toBe("rolled");
    expect(cleanedCombatEffects.effects).toContainEqual(
      expect.objectContaining({
        id: "existing-stun",
        sourceEventId: "existing-event",
        status: "active",
      }),
    );
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEffectId }),
    );
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedStunEffectId }),
    );
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedNoteEffectId }),
    );
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedNoActionEffectId }),
    );
    expect(cleanedCombatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedBleedEffectId }),
    );
    expect(cleanedCombatEffects.events).toContainEqual(
      expect.objectContaining({
        id: "existing-event",
        sourceLabel: "Existing effect",
      }),
    );
    expect(cleanedCombatEffects.events).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEventId }),
    );
    expect(clearedCriticalState.commands.at(-1)).toMatchObject({
      type: "resolve_damage",
    });
    expect(clearedCriticalState.phaseResolutionResults[0]?.criticalRoll.status).toBe("pending");
    expect(clearedCriticalState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(clearedProposalState.commands.at(-1)).toMatchObject({
      type: "roll_hit_location",
    });
    expect(clearedProposalState.phaseResolutionResults[0]?.damageResult).toBeUndefined();
    expect(clearedProposalState.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(clearedProposalState.phaseResolutionResults[0]?.hitLocationRoll.status).toBe("rolled");
  });

  it("commits D2 damage rows and clears commit before clearing the proposal", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "guard",
        phase: "phase2",
        state: declareRoundAction({
          actionId: "parry_attack",
          participantId: "guard",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordTestHitLocation({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "guard",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "scenario-guard",
      command: {
        commandId: "commit-d2",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderScenarioParticipantId: "scenario-gladiator",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const expectedCommitEventId =
      "commit-d2:r3:phase2:3-phase2-guard-gladiator:3-phase2-guard-gladiator-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d2:r3:phase2:3-phase2-guard-gladiator:3-phase2-guard-gladiator-damage:combat-effect:physical-damage-chestBack";
    const clearedCommitState = clearCombatRoundStep({
      state: committed.state,
      step: "phase_2_damage",
    });
    const cleanedCombatEffects = removeCombatRoundCommittedDamageEffects({
      combatEffects: committed.combatEffects,
      command: committed.command,
    });

    expect(afterDamage.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(committed.command).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "D2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        attackerParticipantId: "guard",
        createdCombatEffectEventId: expectedCommitEventId,
        createdDamageEffectIds: [expectedCommitEffectId],
        createdCombatEffectIds: [expectedCommitEffectId],
        criticalRoll: expect.objectContaining({
          criticalDice: [4, 5],
          criticalDiceTotal: 9,
          criticalGrade: "b",
          criticalTypeModifier: -4,
          finalCriticalRoll: 5,
          selectedHitLocation: "chest",
        }),
        damageResultId: "3:phase2:guard:gladiator:damage",
        defenderParticipantId: "gladiator",
        status: "committed",
        totalDamage: 9,
      }),
      participantId: "gladiator",
      phase: "phase2",
      step: "D2",
      type: "commit_phase_damage",
    });
    expect(committed.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        damage: 9,
        id: expectedCommitEffectId,
        location: "chestBack",
        sourceEventId: expectedCommitEventId,
        status: "active",
        targetParticipantId: "scenario-gladiator",
        type: "physical_damage",
      }),
    );
    expect(committed.state.phaseResolutionResults[0]?.damageProposal).toMatchObject({
      committedCombatEffectEventId: expectedCommitEventId,
      committedCombatEffectIds: [expectedCommitEffectId],
      status: "committed",
    });
    expect(clearedCommitState.commands.at(-1)).toMatchObject({
      type: "roll_critical",
    });
    expect(clearedCommitState.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "D2",
    });
    expect(clearedCommitState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(clearedCommitState.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
    expect(cleanedCombatEffects).toEqual({ effects: [], events: [] });
  });

  it("advances from committed D1 damage to the next phase-one actor", () => {
    const committed = commitFailedParryDamage({
      actionId: "attack_parry",
      phase: "phase1",
      state: preparePhaseResolutionState({
        guardActionId: "attack_parry",
        gladiatorActionId: "attack_parry",
        phase: "phase1",
      }),
    });
    const cleared = clearCombatRoundStep({
      state: committed.state,
      step: committed.state.currentStep,
    });

    expect(committed.command).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      type: "commit_phase_damage",
    });
    expect(committed.state.currentStep).toBe("phase_1_actions");
    expect(committed.state.selectedParticipantId).toBe("guard");
    expect(committed.state.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
  });

  it("waits for GM progression after final phase-one D1 damage", () => {
    const committed = commitFailedParryDamage({
      actionId: "attack_parry",
      phase: "phase1",
      state: preparePhaseResolutionState({
        guardActionId: "attack_parry",
        gladiatorActionId: "attack_parry",
        guardAlreadyDone: true,
        phase: "phase1",
      }),
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...committed.state,
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(committed.command).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D1",
      },
      type: "commit_phase_damage",
    });
    expect(committed.state.currentStep).toBe("phase_1_actions");
    expect(committed.state.phaseResolutionCursor).toBeUndefined();
    expect(committed.state.selectedParticipantId).toBe("guard");
    expect(
      buildCombatProgressionProjection(committed.state).boundary.processes.flatMap((process) =>
        process.stages.flatMap((stage) => stage.tasks),
      ),
    ).toContainEqual(
      expect.objectContaining({
        expectedCommand: "advance_combat_boundary",
        kind: "gm_advance_boundary",
        transition: {
          currentBoundary: "phase1_resolution",
          requiredCompletedProcessIds: ["round:3:boundary:phase1_resolution:process:attack"],
          targetBoundary: "phase2_modifier_review",
        },
      }),
    );
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D1",
    });
    expect(cleared.phaseResolutionResults[0]?.damageProposal.status).toBe("drafted");
  });

  it("advances from committed D2 damage to the next phase-two actor", () => {
    const committed = commitFailedParryDamage({
      actionId: "parry_attack",
      phase: "phase2",
      state: preparePhaseResolutionState({
        guardActionId: "parry_attack",
        gladiatorActionId: "parry_attack",
        phase: "phase2",
      }),
    });
    const cleared = clearCombatRoundStep({
      state: committed.state,
      step: committed.state.currentStep,
    });

    expect(committed.command).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A2",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D2",
      },
      type: "commit_phase_damage",
    });
    expect(committed.state.currentStep).toBe("phase_2_actions");
    expect(committed.state.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase2",
      substep: "attack",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D2",
    });
    expect(
      cleared.phaseResolutionResults.find((result) => result.phase === "phase2")?.damageProposal
        .status,
    ).toBe("drafted");
  });

  it("waits for GM progression after final phase-two D2 damage", () => {
    const committed = commitFailedParryDamage({
      actionId: "parry_attack",
      phase: "phase2",
      state: preparePhaseResolutionState({
        guardActionId: "parry_attack",
        gladiatorActionId: "parry_attack",
        guardAlreadyDone: true,
        phase: "phase2",
      }),
    });
    const cleared = clearCombatRoundStep({
      state: committed.state,
      step: committed.state.currentStep,
    });

    expect(committed.command).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A2",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "D2",
      },
      type: "commit_phase_damage",
    });
    expect(committed.state.currentStep).toBe("phase_2_actions");
    expect(committed.state.phaseResolutionCursor).toBeUndefined();
    expect(committed.state.selectedParticipantId).toBe("guard");
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "D2",
    });
    expect(
      cleared.phaseResolutionResults.find((result) => result.phase === "phase2")?.damageProposal
        .status,
    ).toBe("drafted");
  });

  it("waits for GM progression after a final phase-one attack miss", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 18,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 2,
      rollTotal: 2,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state: preparePhaseResolutionState({
        guardActionId: "attack_parry",
        gladiatorActionId: "attack_parry",
        guardAlreadyDone: true,
        phase: "phase1",
      }),
      submittedBy: "gm",
    });
    const command = afterMiss.commands[afterMiss.commands.length - 1];

    expect(command).toMatchObject({
      afterCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      type: "roll_attack",
    });
    expect(afterMiss.currentStep).toBe("phase_1_actions");
    expect(afterMiss.phaseResolutionCursor).toBeUndefined();
  });

  it("waits for GM progression after a final successful phase-two parry", () => {
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 20,
      phase: "phase2",
      rollD20: 15,
      rollTotal: 15,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state: preparePhaseResolutionState({
        guardActionId: "parry_attack",
        gladiatorActionId: "parry_attack",
        guardAlreadyDone: true,
        phase: "phase2",
      }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 12,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry succeeded",
        rollD20: 10,
        rollTotal: 10,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 22,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: afterParry,
      step: "round_summary",
    });
    const command = afterParry.commands[afterParry.commands.length - 1];

    expect(command).toMatchObject({
      afterCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "A2",
      },
      beforeCursor: {
        participantId: "guard",
        roundNumber: 3,
        step: "P2",
      },
      type: "roll_parry",
    });
    expect(afterParry.currentStep).toBe("phase_2_actions");
    expect(afterParry.phaseResolutionCursor).toBeUndefined();
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "P2",
    });
  });

  it("waits for GM progression after a final phase-one no-attack skip", () => {
    const skipped = recordCombatRoundNoAttackPhaseReview({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase1",
      state: preparePhaseResolutionState({
        guardActionId: "parry_attack",
        gladiatorActionId: "parry_attack",
        guardAlreadyDone: true,
        phase: "phase1",
      }),
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:03:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: skipped,
      step: "review_phase_2_modifiers",
    });
    const command = skipped.commands[skipped.commands.length - 1];

    expect(command).toMatchObject({
      afterCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A1",
      },
      type: "skip_phase_action",
    });
    expect(skipped.currentStep).toBe("phase_1_actions");
    expect(skipped.phaseResolutionCursor).toBeUndefined();
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
  });

  it("lets the GM skip the current executable action and undo the skip", () => {
    const skipped = skipCombatRoundCurrentPhaseAction({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      phase: "phase2",
      reason: "GM skipped action",
      state: preparePhaseResolutionState({
        guardActionId: "parry_attack",
        gladiatorActionId: "parry_attack",
        phase: "phase2",
      }),
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:03:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: skipped,
      step: "phase_2_actions",
    });

    expect(skipped.commands[skipped.commands.length - 1]).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "A2",
      },
      facts: {
        attackPhaseDefensivePenalty: expect.objectContaining({
          executionState: "skipped",
          penalty: -4,
          reason: "skipped_after_commitment",
          sourceException: "none",
        }),
        reason: "GM skipped action",
        status: "skipped",
      },
      type: "skip_phase_action",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: skipped,
        step: "phase_2_actions",
      }),
    ).toBe("skipped");
    expect(skipped.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A2",
    });
    expect(
      skipped.participants.find((participant) => participant.participantId === "gladiator")
        ?.declaration,
    ).toMatchObject({
      actionId: "parry_attack",
      attackPhaseDefensivePenalties: [
        expect.objectContaining({ executionState: "skipped", penalty: -4 }),
      ],
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A2",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      cleared.participants.find((participant) => participant.participantId === "gladiator")
        ?.declaration?.attackPhaseDefensivePenalties,
    ).toBeUndefined();
  });

  it("blocks starting the next round until SU review is prepared and complete", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );

    expect(getCombatRoundStartNextRoundBlocker(roundSummaryState)).toBe(
      "Round-end review incomplete.",
    );
    expect(() => advanceCombatRoundStep(roundSummaryState)).toThrow("Round-end review incomplete.");

    const reviewed = prepareCleanRoundEndReview(roundSummaryState);

    expect(isCombatRoundEndReviewComplete(reviewed)).toBe(false);
    expect(getCombatRoundStartNextRoundBlocker(reviewed)).toBe(
      "Round-end review incomplete for The Gladiator.",
    );

    const completedReview = completeCleanRoundEndReview(roundSummaryState);

    expect(isCombatRoundEndReviewComplete(completedReview)).toBe(true);
    expect(getCombatRoundStartNextRoundBlocker(completedReview)).toBeUndefined();
  });

  it("auto-prepares SU review for the first participant when requested", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const prepared = ensureCombatRoundEndReviewPrepared({
      command: {
        createdAt: "2026-01-01T00:09:00.000Z",
        createdByUserId: "gm-1",
      },
      state: roundSummaryState,
    });

    expect(prepared.roundEndReview?.participantReviews.gladiator?.status).toBe("review_ready");
    expect(prepared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "SU",
    });
    expect(prepared.commands.at(-1)).toMatchObject({
      type: "prepare_round_end_review",
    });
  });

  it("requires explicit SU acknowledgement for participants with no proposals", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const reviewed = prepareCleanRoundEndReview(roundSummaryState);

    expect(reviewed.roundEndReview?.participantReviews.gladiator?.status).toBe("review_ready");
    expect(reviewed.roundEndReview?.participantReviews.guard?.status).toBe("review_ready");
    expect(reviewed.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "SU",
    });

    const committedGladiator = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });

    expect(committedGladiator.state.roundEndReview?.participantReviews.gladiator?.status).toBe(
      "complete",
    );
    expect(committedGladiator.state.roundEndReview?.participantReviews.guard?.status).toBe(
      "review_ready",
    );
    expect(committedGladiator.state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "SU",
    });
    expect(committedGladiator.state.selectedParticipantId).toBe("guard");
    expect(committedGladiator.command.afterCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "SU",
    });
    expect(committedGladiator.command.facts).toMatchObject({
      nextReviewStatus: "complete",
      previousReviewStatus: "review_ready",
    });
    expect(getCombatRoundStartNextRoundBlocker(committedGladiator.state)).toBe(
      "Round-end review incomplete for City guard.",
    );

    const restored = clearCombatRoundStep({
      state: committedGladiator.state,
      step: "round_summary",
    });

    expect(restored.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "SU",
    });
    expect(restored.roundEndReview?.participantReviews.gladiator?.status).toBe("review_ready");
    expect(restored.roundEndReview?.participantReviews.guard?.status).toBe("review_ready");
  });

  it("keeps SU current on a participant until required health rolls are complete", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const guardEffects = combatEffectsWith([
      {
        description: "Guard bleeding",
        effectGroup: "bleed",
        id: "guard-bleed",
        modifierValue: 2,
        roundNumber: 1,
        targetParticipantId: "scenario-guard",
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        guard: {
          combatEffects: guardEffects,
          healthStat: 6,
        },
      },
      state: roundSummaryState,
    });
    const committedGladiator = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });

    expect(committedGladiator.state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 10,
      step: "SU",
    });

    expect(committedGladiator.state.roundEndReview?.participantReviews.guard?.status).toBe(
      "health_roll_pending",
    );
    expect(committedGladiator.state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 10,
      step: "SU",
    });
    expect(getCombatRoundStartNextRoundBlocker(committedGladiator.state)).toBe(
      "Health roll pending for City guard.",
    );

    const rolled = rollCombatRoundEndHealthCheck({
      command: {
        createdAt: "2026-01-01T00:12:00.000Z",
      },
      combatEffects: guardEffects,
      participantId: "guard",
      roll: {
        dieResult: 10,
        openEndedD10s: [],
        rollD20: 10,
      },
      state: committedGladiator.state,
    });

    expect(rolled.state.roundEndReview?.participantReviews.guard?.status).toBe("review_ready");
    expect(rolled.state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 10,
      step: "SU",
    });
    expect(getCombatRoundStartNextRoundBlocker(rolled.state)).toBe(
      "Round-end review incomplete for City guard.",
    );

    const completedGuard = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:13:00.000Z",
      },
      combatEffects: rolled.combatEffects,
      participantId: "guard",
      scenarioParticipantId: "scenario-guard",
      state: rolled.state,
    });

    expect(completedGuard.state.currentCursor).toEqual({
      roundNumber: 10,
      step: "SU",
    });
    expect(getCombatRoundStartNextRoundBlocker(completedGuard.state)).toBeUndefined();
  });

  it("stores declared distance preferences for one or more opponents", () => {
    const state = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "player_declared",
              targetParticipantId: "guard",
            },
            {
              desiredDistance: 4,
              source: "player_declared",
              targetParticipantId: "scenario-scout",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scout", label: "Scout" }),
          ],
        }),
      }),
      submittedBy: "player",
    });

    expect(state.participants[0]?.declaration?.movementIntent).toMatchObject({
      distancePreferences: [
        { desiredDistance: 3, targetParticipantId: "guard" },
        { desiredDistance: 4, targetParticipantId: "scenario-scout" },
      ],
      mode: "set_distance_preferences",
    });
  });

  it("does not double-resolve a stale Adjust Distance-Attack through generic movement", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 2,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const forged = recordCombatRoundDeclaration({
      declaration: {
        actionId: "adjust_range_attack",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 1,
              operation: "close",
              source: "player_declared",
              targetParticipantId: "guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: { ...baseState, distanceState },
      submittedBy: "player",
    });
    const reviewed = prepareCombatRoundEndReview({
      state: {
        ...forged,
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      },
    });

    expect(reviewed.roundEndReview?.proposedDistances).toEqual([]);
    expect(getDistanceBetween(reviewed.distanceState, "gladiator", "guard")).toBe(2);
  });

  it("routes Move only relative close through canonical round-end distance control", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 2,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const declared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "move_only",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 1,
              operation: "close",
              source: "player_declared",
              targetParticipantId: "guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: { ...baseState, distanceState },
      submittedBy: "player",
    });
    const reviewed = prepareCombatRoundEndReview({
      state: {
        ...declared,
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      },
    });

    expect(reviewed.roundEndReview?.proposedDistances).toMatchObject([
      {
        currentDistance: 2,
        pairKey: makeDistancePairKey("gladiator", "guard"),
        participantA: { desiredDistance: 1, participantId: "gladiator" },
        requiresContest: true,
        status: "pending_rolls",
      },
    ]);
    expect(getDistanceBetween(reviewed.distanceState, "gladiator", "guard")).toBe(2);
  });

  it("keeps environmental movement out of participant pair distance state", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 2,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const moved = recordCombatRoundDeclaration({
      declaration: {
        actionId: "move_only",
        movementIntent: {
          distancePreferences: [],
          environmentalMovement: {
            actionId: "round:3:participant:gladiator:declaration:environmental-movement",
            destination: { description: "doorway", kind: "description" },
            duration: { kind: "rounds", rounds: 3 },
            pace: "walk",
          },
          mode: "move_in_environment",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: { ...baseState, distanceState },
      submittedBy: "player",
    });
    const reviewed = prepareCombatRoundEndReview({
      state: {
        ...moved,
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      },
    });

    expect(reviewed.roundEndReview?.proposedDistances).toEqual([]);
    expect(getDistanceBetween(reviewed.distanceState, "gladiator", "guard")).toBe(2);
  });

  it("rejects distance preferences outside 0-8", () => {
    expect(() =>
      recordCombatRoundDeclaration({
        declaration: {
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 9 as never,
                source: "player_declared",
                targetParticipantId: "guard",
              },
            ],
            mode: "set_distance_preferences",
          },
          roundNumber: 3,
        },
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
        submittedBy: "player",
      }),
    ).toThrow();
  });

  it("builds canonical same-distance proposals without a Dodge contest", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 2,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const withGladiatorPreference = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "player_declared",
              targetParticipantId: "scenario-guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: { ...baseState, distanceState },
      submittedBy: "player",
    });
    const withMatchingGuardPreference = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "player_declared",
              targetParticipantId: "scenario-gladiator",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "guard",
      state: withGladiatorPreference,
      submittedBy: "player",
    });
    const reviewed = prepareCombatRoundEndReview({
      state: {
        ...withMatchingGuardPreference,
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      },
    });
    const proposal = reviewed.roundEndReview?.proposedDistances[0];

    expect(proposal).toMatchObject({
      currentDistance: 2,
      outcome: "uncontested",
      pairKey: makeDistancePairKey("gladiator", "guard"),
      proposedDistance: 3,
      requiresContest: false,
      status: "review_ready",
    });
    expect(proposal?.participantA.status).toBe("not_required");
    expect(proposal?.participantB.status).toBe("not_required");
    expect(reviewed.roundEndReview?.proposedDistances).toHaveLength(1);
    expect(reviewed.roundEndReview?.participantReviews.gladiator?.proposedDistances).toEqual([]);
    expect(reviewed.roundEndReview?.participantReviews.guard?.proposedDistances).toEqual([]);
    expect(reviewed.roundEndReview?.participantReviews.gladiator?.status).toBe("review_ready");
    expect(getNextCombatRoundEndTask({ state: reviewed })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_commit",
      pairKey: proposal?.pairKey,
      participantId: "gladiator",
    });
    expect(getCombatRoundStartNextRoundBlocker(reviewed)).toBe(
      "Distance control for The Gladiator ↔ City guard must be applied before starting the next round.",
    );
  });

  it("keeps a same-distance application complete through persisted reload and starts one next round", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 3,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const gladiatorDeclared = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "gm_proxy",
              targetParticipantId: "guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: { ...baseState, distanceState },
      submittedBy: "gm",
    });
    const bothDeclared = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "gm_proxy",
              targetParticipantId: "gladiator",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "guard",
      state: gladiatorDeclared,
      submittedBy: "gm",
    });
    const prepared = prepareCombatRoundEndReview({
      command: { createdAt: "2026-01-01T00:09:00.000Z", createdByUserId: "gm-1" },
      state: {
        ...bothDeclared,
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      },
    });
    const proposalId = prepared.roundEndReview?.proposedDistances[0]?.id ?? "missing";
    const applied = commitCombatRoundEndDistanceControl({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      distanceProposalId: proposalId,
      state: prepared,
    }).state;
    const gladiatorComplete = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:11:00.000Z", createdByUserId: "gm-1" },
      combatEffects: combatEffectsWith([]),
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: applied,
    }).state;
    const roundComplete = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:12:00.000Z", createdByUserId: "gm-1" },
      combatEffects: combatEffectsWith([]),
      participantId: "guard",
      scenarioParticipantId: "scenario-guard",
      state: gladiatorComplete,
    }).state;
    const persistedWithLegacyStatus = combatRoundStateSchema.parse({
      ...JSON.parse(JSON.stringify(roundComplete)),
      currentCursor: { roundNumber: 3, step: "SU" },
      roundEndReview: {
        ...roundComplete.roundEndReview,
        proposedDistances: roundComplete.roundEndReview?.proposedDistances.map((proposal) => ({
          ...proposal,
          // Reproduces the persisted conflict: the apply event/command survived while the
          // proposal lifecycle fields were stale.
          appliedDistance: undefined,
          status: "review_ready",
        })),
      },
      selectedParticipantId: "guard",
      selectedStep: "select_actions",
    });

    expect(
      getCombatRoundEndDistanceProposalLifecycle(
        persistedWithLegacyStatus.roundEndReview!.proposedDistances[0]!,
      ),
    ).toBe("resolved");

    const reloaded = initializeCombatRoundState({
      encounter: encounter({ combatRoundState: persistedWithLegacyStatus, currentRound: 3 }),
    });

    expect(reloaded.roundEndReview?.proposedDistances[0]).toMatchObject({
      appliedDistance: 3,
      currentDistance: 3,
      status: "committed",
    });
    expect(getNextCombatRoundEndTask({ state: reloaded })).toEqual({ kind: "round_boundary" });
    expect(isCombatRoundEndReviewComplete(reloaded)).toBe(true);

    const nextRound = advanceCombatRoundStep(reloaded, {
      command: { createdAt: "2026-01-01T00:13:00.000Z", createdByUserId: "gm-1" },
    });

    expect(nextRound.roundNumber).toBe(4);
    expect(nextRound.rounds.map((round) => round.roundNumber)).toEqual([3]);
    expect(getDistanceBetween(nextRound.distanceState, "gladiator", "guard")).toBe(3);
    expect(nextRound.roundEndReview).toBeUndefined();
  });

  it("rolls conflicting Dodge distance control and commits the winner for the next round", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 2,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const withGladiatorPreference = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "gm_proxy",
              targetParticipantId: "guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: { ...baseState, distanceState },
      submittedBy: "gm",
    });
    const withGuardPreference = recordCombatRoundDeclaration({
      declaration: {
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 1,
              source: "gm_proxy",
              targetParticipantId: "gladiator",
            },
          ],
          mode: "set_distance_preferences",
        },
        roundNumber: 3,
      },
      participantId: "guard",
      state: withGladiatorPreference,
      submittedBy: "gm",
    });
    const roundSummaryState = {
      ...withGuardPreference,
      currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" as const },
      currentStep: "round_summary" as const,
      selectedParticipantId: "gladiator",
      selectedStep: "round_summary" as const,
    };
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          distanceControl: {
            dodgeSkillTotal: 8,
            generalFatigueModifier: -1,
          },
        },
        guard: {
          distanceControl: {
            dodgeSkillTotal: 4,
            generalFatigueModifier: 0,
          },
        },
      },
      state: roundSummaryState,
    });
    const proposal = reviewed.roundEndReview?.proposedDistances[0];

    expect(reviewed.roundEndReview?.participantReviews.gladiator?.status).toBe("review_ready");
    expect(proposal).toMatchObject({
      currentDistance: 2,
      requiresContest: true,
      status: "pending_rolls",
    });
    expect(proposal?.participantA).toMatchObject({ participantId: "gladiator", status: "pending" });
    expect(proposal?.participantB).toMatchObject({ participantId: "guard", status: "pending" });
    expect(getNextCombatRoundEndTask({ state: reviewed })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_roll",
      opponentParticipantId: "guard",
      pairKey: proposal?.pairKey,
      participantId: "gladiator",
    });
    expect(reviewed.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "SU",
    });
    expect(() =>
      commitCombatRoundEndParticipantReview({
        command: {
          createdAt: "2026-01-01T00:10:30.000Z",
        },
        participantId: "gladiator",
        scenarioParticipantId: "scenario-gladiator",
        state: reviewed,
      }),
    ).toThrow("Round-end distance control must be completed before participant SU review.");
    expect(
      getCombatRoundEndDistanceControlPendingRollCount({
        participantId: "gladiator",
        state: reviewed,
      }),
    ).toBe(1);
    expect(
      getCombatRoundEndDistanceControlPendingRollCount({
        participantId: "guard",
        state: reviewed,
      }),
    ).toBe(1);

    const gladiatorRolled = rollCombatRoundEndDistanceControl({
      command: {
        createdAt: "2026-01-01T00:11:00.000Z",
      },
      distanceProposalId: proposal?.id,
      participantId: "gladiator",
      result: roundEndDistanceRollResult({
        baseSkill: 7,
        dieResult: 10,
        opponentParticipantId: "guard",
        participantId: "gladiator",
        rolledAt: "2026-01-01T00:11:00.000Z",
        rolledBy: "player",
      }),
      state: reviewed,
    });
    const afterFirstRoll = gladiatorRolled.state.roundEndReview?.proposedDistances[0];

    expect(afterFirstRoll).toMatchObject({
      outcome: "contest_pending",
      proposedDistance: undefined,
      status: "pending_rolls",
    });
    expect(afterFirstRoll?.participantA).toMatchObject({
      result: { finalTotal: 17, rolledBy: "player", rolledAtRound: 3 },
      status: "rolled",
    });
    expect(afterFirstRoll?.participantB).toMatchObject({ status: "pending" });
    expect(getNextCombatRoundEndTask({ state: gladiatorRolled.state })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_roll",
      opponentParticipantId: "gladiator",
      pairKey: proposal?.pairKey,
      participantId: "guard",
    });
    expect(gladiatorRolled.state.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "SU",
    });
    expect(
      getCombatRoundEndDistanceControlPendingRollCount({
        participantId: "gladiator",
        state: gladiatorRolled.state,
      }),
    ).toBe(0);
    expect(
      getCombatRoundEndDistanceControlPendingRollCount({
        participantId: "guard",
        state: gladiatorRolled.state,
      }),
    ).toBe(1);
    expect(
      gladiatorRolled.state.events.filter((event) => event.type === "distance_control_roll"),
    ).toHaveLength(1);
    expect(gladiatorRolled.state.events.at(-1)).toMatchObject({
      distanceProposalId: proposal?.id,
      ownerParticipantId: "gladiator",
      rollerParticipantId: "gladiator",
      type: "distance_control_roll",
      visibility: {
        involvedParticipantIds: ["gladiator", "guard"],
      },
    });
    expect(gladiatorRolled.state.events.at(-1)?.facts.publicOutcome).toEqual({});
    expect(gladiatorRolled.state.events.at(-1)?.facts.rollerPrivate).toMatchObject({
      finalTotal: 17,
      rollD20: 10,
    });

    const rolled = rollCombatRoundEndDistanceControl({
      command: {
        createdAt: "2026-01-01T00:11:30.000Z",
      },
      distanceProposalId: proposal?.id,
      participantId: "guard",
      result: roundEndDistanceRollResult({
        baseSkill: 4,
        dieResult: 12,
        opponentParticipantId: "gladiator",
        participantId: "guard",
        rolledAt: "2026-01-01T00:11:30.000Z",
        rolledBy: "gm_proxy",
      }),
      state: gladiatorRolled.state,
    });
    const rolledProposal = rolled.state.roundEndReview?.proposedDistances[0];

    expect(rolledProposal).toMatchObject({
      outcome: "participant_a_wins",
      proposedDistance: 3,
      status: "rolled",
      winnerParticipantId: "gladiator",
    });
    expect(rolledProposal?.participantA.result?.finalTotal).toBe(17);
    expect(rolledProposal?.participantB.result?.finalTotal).toBe(16);
    expect(rolledProposal?.participantB.result?.rolledBy).toBe("gm_proxy");
    expect(getNextCombatRoundEndTask({ state: rolled.state })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_commit",
      pairKey: proposal?.pairKey,
      participantId: "gladiator",
    });
    expect(rolled.state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "SU",
    });
    expect(rolled.state.events.map((event) => event.type)).toEqual([
      "distance_control_roll",
      "distance_control_roll",
      "distance_control_result",
    ]);
    expect(new Set(rolled.state.events.map((event) => event.id)).size).toBe(3);
    expect(rolled.state.events[1]).toMatchObject({
      ownerParticipantId: "guard",
      rollerParticipantId: "guard",
    });
    expect(rolled.state.events[2]).toMatchObject({
      distanceProposalId: proposal?.id,
      facts: {
        involvedOutcome: {
          outcome: "participant_a_wins",
          proposedDistance: 3,
          winnerParticipantId: "gladiator",
        },
      },
      type: "distance_control_result",
    });
    expect(rolled.state.events.map((event) => event.sequence)).toEqual([0, 1, 2]);
    expect(getLatestCombatEventSummary(rolled.state)?.summaryText).toBe(
      "Round 3, SU: City guard rolled distance control 16 for The Gladiator ↔ City guard.",
    );
    expect(getLatestCombatEventSummary(rolled.state)?.details).toBe(
      "Proposed distance 3 next round.",
    );

    const unrolled = clearCombatRoundStep({ state: rolled.state, step: "round_summary" });

    expect(unrolled.roundEndReview?.proposedDistances[0]).toMatchObject({
      outcome: "contest_pending",
      proposedDistance: undefined,
      status: "pending_rolls",
    });
    expect(unrolled.roundEndReview?.proposedDistances[0]?.participantA.result).toBeDefined();
    expect(unrolled.roundEndReview?.proposedDistances[0]?.participantB.result).toBeUndefined();
    expect(unrolled.events.map((event) => event.type)).toEqual(["distance_control_roll"]);

    const committed = commitCombatRoundEndDistanceControl({
      command: {
        createdAt: "2026-01-01T00:12:00.000Z",
      },
      distanceProposalId: rolledProposal?.id ?? "missing",
      state: rolled.state,
    });

    expect(getDistanceBetween(committed.state.distanceState, "gladiator", "guard")).toBe(3);
    expect(committed.state.roundEndReview?.proposedDistances[0]).toMatchObject({
      appliedDistance: 3,
      appliesFromRound: 4,
      status: "committed",
    });
    expect(getNextCombatRoundEndTask({ state: committed.state })).toEqual({
      kind: "participant_review",
      participantId: "gladiator",
    });
    expect(committed.state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "SU",
    });
    expect(committed.state.events.map((event) => event.type)).toEqual([
      "distance_control_roll",
      "distance_control_roll",
      "distance_control_result",
      "distance_control_applied",
    ]);
    expect(committed.state.events.at(-1)).toMatchObject({
      distanceProposalId: proposal?.id,
      facts: {
        involvedOutcome: {
          appliedDistance: 3,
          previousDistance: 2,
          status: "committed",
        },
      },
      status: "committed",
    });
    expect(getLatestCombatEventSummary(committed.state)?.summaryText).toBe(
      "Round 3, SU: Distance control applied for The Gladiator ↔ City guard: distance 3 next round.",
    );

    const undone = clearCombatRoundStep({ state: committed.state, step: "round_summary" });

    expect(getDistanceBetween(undone.distanceState, "gladiator", "guard")).toBe(2);
    expect(undone.roundEndReview?.proposedDistances[0]).toMatchObject({
      status: "rolled",
    });
    expect(undone.roundEndReview?.proposedDistances[0]?.appliedDistance).toBeUndefined();
    expect(getNextCombatRoundEndTask({ state: undone })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_commit",
      pairKey: proposal?.pairKey,
      participantId: "gladiator",
    });
    expect(undone.events.map((event) => event.type)).toEqual([
      "distance_control_roll",
      "distance_control_roll",
      "distance_control_result",
    ]);
  });

  it("gives an active Continued Contact controller the next-round engagement-distance choice", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const distanceState = setDistanceBetween({
      distance: 4,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const reviewed = prepareCombatRoundEndReview({
      command: { createdAt: "2026-01-01T00:10:00.000Z", createdByUserId: "gm-1" },
      state: combatRoundStateSchema.parse({
        ...baseState,
        continuedContacts: [
          {
            affectedParticipantId: "guard",
            brawlingContestResultId: "contest-result-1",
            controllerParticipantId: "gladiator",
            establishedPhase: "phase1",
            establishedRound: 3,
            id: "continued-contact-1",
            sourceActionId: "offensive_parry",
            sourceAttackResultId: "attack-result-1",
            sourceDeclarationId: "declaration-1",
            sourceOpportunityId: "opportunity-1",
            sourceParryResultId: "parry-result-1",
            status: "active",
          },
        ],
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        distanceState,
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      }),
    });
    const proposal = reviewed.roundEndReview?.proposedDistances[0];

    expect(reviewed.roundEndReview?.proposedDistances).toHaveLength(1);
    expect(proposal).toMatchObject({
      affectedParticipantId: "guard",
      appliesFromRound: 4,
      continuedContactId: "continued-contact-1",
      controllerParticipantId: "gladiator",
      controlMode: "continued_contact",
      currentDistance: 4,
      outcome: "controller_choice",
      proposedDistance: undefined,
      reason: "continued_contact",
      requiresContest: false,
      status: "review_ready",
    });
    expect(proposal?.participantA.status).toBe("not_required");
    expect(proposal?.participantB.status).toBe("not_required");
    expect(
      getCombatRoundEndDistanceControlPendingRollCount({
        participantId: "gladiator",
        state: reviewed,
      }),
    ).toBe(0);
    expect(getNextCombatRoundEndTask({ state: reviewed })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_commit",
      pairKey: proposal?.pairKey,
      participantId: "gladiator",
    });

    const progressionTask = buildCombatProgressionProjection(reviewed)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "distance_commit");
    expect(progressionTask).toMatchObject({
      allowedActors: ["combatant", "gm"],
      identity: {
        opponentParticipantId: "guard",
        participantId: "gladiator",
        proposalId: proposal?.id,
      },
      owner: { kind: "combatant", participantId: "gladiator" },
      presentationContext: {
        actionKind: "continued_contact_distance_control",
        reason: "Continued Contact is active.",
      },
      state: "executable",
      trackerFacet: { owner: { participantId: "gladiator" }, step: "SU" },
    });
    expect(() =>
      commitCombatRoundEndDistanceControl({
        chosenDistance: 2,
        command: { createdAt: "2026-01-01T00:11:00.000Z" },
        distanceProposalId: proposal?.id ?? "missing",
        participantId: "guard",
        state: reviewed,
      }),
    ).toThrow("Only the Continued Contact controller may choose engagement distance.");

    const committed = commitCombatRoundEndDistanceControl({
      chosenDistance: 2,
      command: { createdAt: "2026-01-01T00:11:00.000Z", createdByUserId: "player-1" },
      distanceProposalId: proposal?.id ?? "missing",
      participantId: "gladiator",
      state: reviewed,
    }).state;

    expect(getDistanceBetween(committed.distanceState, "gladiator", "guard")).toBe(2);
    expect(committed.roundEndReview?.proposedDistances[0]).toMatchObject({
      appliedDistance: 2,
      chosenDistance: 2,
      continuedContactId: "continued-contact-1",
      controllerParticipantId: "gladiator",
      reason: "continued_contact",
      status: "committed",
    });
    expect(committed.events.map((event) => event.type)).toEqual(["distance_control_applied"]);
    expect(committed.events[0]).toMatchObject({
      actorParticipantId: "gladiator",
      facts: {
        involvedOutcome: {
          appliedDistance: 2,
          chosenDistance: 2,
          previousDistance: 4,
          reason: "continued_contact",
        },
      },
      targetParticipantId: "guard",
    });
    expect(committed.events[0]?.source.sourceIds).toEqual(
      expect.arrayContaining([proposal?.id, proposal?.pairKey, "continued-contact-1"]),
    );

    const undone = clearCombatRoundStep({ state: committed, step: "round_summary" });
    expect(getDistanceBetween(undone.distanceState, "gladiator", "guard")).toBe(4);
    expect(undone.roundEndReview?.proposedDistances[0]).toMatchObject({
      status: "review_ready",
    });
    expect(undone.roundEndReview?.proposedDistances[0]?.chosenDistance).toBeUndefined();
    expect(getNextCombatRoundEndTask({ state: undone })).toEqual({
      distanceProposalId: proposal?.id,
      kind: "distance_commit",
      pairKey: proposal?.pairKey,
      participantId: "gladiator",
    });

    const reloaded = initializeCombatRoundState({
      encounter: encounter({ combatRoundState: committed, currentRound: 3 }),
    });
    expect(reloaded.roundEndReview?.proposedDistances[0]?.chosenDistance).toBe(2);
    expect(getDistanceBetween(reloaded.distanceState, "gladiator", "guard")).toBe(2);

    const gladiatorComplete = commitCombatRoundEndParticipantReview({
      combatEffects: combatEffectsWith([]),
      command: { createdAt: "2026-01-01T00:12:00.000Z" },
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reloaded,
    }).state;
    const roundComplete = commitCombatRoundEndParticipantReview({
      combatEffects: combatEffectsWith([]),
      command: { createdAt: "2026-01-01T00:13:00.000Z" },
      participantId: "guard",
      scenarioParticipantId: "scenario-guard",
      state: gladiatorComplete,
    }).state;
    const nextRound = advanceCombatRoundStep(roundComplete, {
      command: { createdAt: "2026-01-01T00:14:00.000Z" },
    });

    expect(nextRound.roundNumber).toBe(4);
    expect(getDistanceBetween(nextRound.distanceState, "gladiator", "guard")).toBe(2);
    expect(nextRound.continuedContacts).toMatchObject([
      { controllerParticipantId: "gladiator", status: "active" },
    ]);
    expect(nextRound.participants.every((participant) => !participant.declaration)).toBe(true);
  });

  it("changes only the Continued Contact pair when other participant pairs exist", () => {
    const baseState = initializeCombatRoundState({
      encounter: encounter({
        participants: [
          participant({ id: "gladiator", label: "The Gladiator" }),
          participant({ id: "guard", label: "City guard" }),
          participant({ id: "scout", label: "Scout" }),
        ],
      }),
    });
    const withContactDistance = setDistanceBetween({
      distance: 4,
      participantAId: "gladiator",
      participantBId: "guard",
      source: "gm_set",
      state: baseState.distanceState,
    });
    const distanceState = setDistanceBetween({
      distance: 6,
      participantAId: "guard",
      participantBId: "scout",
      source: "gm_set",
      state: withContactDistance,
    });
    const reviewed = prepareCombatRoundEndReview({
      state: combatRoundStateSchema.parse({
        ...baseState,
        continuedContacts: [
          {
            affectedParticipantId: "guard",
            brawlingContestResultId: "contest-result-1",
            controllerParticipantId: "gladiator",
            establishedPhase: "phase1",
            establishedRound: 3,
            id: "continued-contact-1",
            sourceActionId: "offensive_parry",
            sourceAttackResultId: "attack-result-1",
            sourceDeclarationId: "declaration-1",
            sourceOpportunityId: "opportunity-1",
            sourceParryResultId: "parry-result-1",
            status: "active",
          },
        ],
        currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        distanceState,
        selectedParticipantId: "gladiator",
        selectedStep: "round_summary",
      }),
    });
    const proposal = reviewed.roundEndReview?.proposedDistances[0];
    const committed = commitCombatRoundEndDistanceControl({
      chosenDistance: 1,
      command: { createdAt: "2026-01-01T00:11:00.000Z" },
      distanceProposalId: proposal?.id ?? "missing",
      participantId: "gladiator",
      state: reviewed,
    }).state;

    expect(reviewed.roundEndReview?.proposedDistances).toHaveLength(1);
    expect(getDistanceBetween(committed.distanceState, "gladiator", "guard")).toBe(1);
    expect(getDistanceBetween(committed.distanceState, "guard", "scout")).toBe(6);
  });

  it("builds SU duration proposals for active round-based effects", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const reviewed = prepareCombatRoundEndReview({
      command: {
        createdAt: "2026-01-01T00:09:00.000Z",
      },
      participantInputs: {
        gladiator: {
          combatEffects: combatEffectsWith([
            {
              description: "Off balance",
              duration: "1 round",
              effectGroup: "special",
              id: "effect-expire",
              type: "special",
            },
            {
              description: "Arm penalty",
              duration: "2 rounds",
              effectGroup: "db",
              id: "effect-decay",
              modifierValue: -2,
              type: "db_modifier",
            },
          ]),
        },
      },
      state: roundSummaryState,
    });
    const review = reviewed.roundEndReview?.participantReviews.gladiator;

    expect(review?.proposedRemovals).toHaveLength(1);
    expect(review?.proposedRemovals[0]).toMatchObject({
      effectId: "effect-expire",
      kind: "duration_expire",
    });
    expect(review?.proposedEffects).toHaveLength(1);
    expect(review?.proposedEffects[0]).toMatchObject({
      effectId: "effect-decay",
      kind: "duration_update",
      nextDuration: "1 round",
    });
    expect(review?.canonicalReview).toMatchObject({
      participantId: "gladiator",
      reviewId: "round-end:3:gladiator:review",
      state: "ready",
    });
  });

  it("binds typed CE countdown to an exact SU lifecycle proposal", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const canonicalLifecycle = buildCombatExperiencePersistentLifecycle({
      context: {
        commandId: "ce-command",
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: "revision-1",
        createdSequence: 2,
        encounterId: "encounter-1",
        eventId: "ce-event",
        ownerParticipantId: "scenario-gladiator",
        roundNumber: 3,
      },
      durationRounds: 2,
      effectId: "ce-effect",
      modifierValue: -2,
      status: "active",
    });
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: combatEffectsWith([
            {
              canonicalLifecycle,
              description: "Combat Experience",
              duration: "2 rounds",
              effectGroup: "general",
              id: "ce-effect",
              modifierValue: -2,
              type: "general_modifier",
            },
          ]),
        },
      },
      state: roundSummaryState,
    });

    expect(
      reviewed.roundEndReview?.participantReviews.gladiator?.canonicalReview?.proposals[0],
    ).toMatchObject({
      effectId: "ce-effect",
      expectedEffectVersion: 1,
      nextDuration: { kind: "rounds", remaining: 1 },
      reason: "duration_decremented",
      transitionType: "update",
    });
  });

  it("does not decrement phase-scoped CE during SU", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const canonicalLifecycle = buildCombatExperiencePersistentLifecycle({
      context: {
        commandId: "phase-ce-command",
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: "revision-1",
        createdSequence: 2,
        encounterId: "encounter-1",
        eventId: "phase-ce-event",
        ownerParticipantId: "scenario-gladiator",
        roundNumber: 3,
      },
      durationRounds: 1,
      effectId: "phase-ce-effect",
      modifierValue: -1,
      phase: "phase2",
      status: "active",
    });
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: combatEffectsWith([
            {
              canonicalLifecycle,
              description: "Phase Combat Experience",
              duration: "1 round",
              effectGroup: "general",
              id: "phase-ce-effect",
              modifierValue: -1,
              type: "general_modifier",
            },
          ]),
        },
      },
      state: roundSummaryState,
    });
    const review = reviewed.roundEndReview?.participantReviews.gladiator;

    expect(review?.canonicalReview?.proposals).toEqual([]);
    expect(review?.proposedEffects).toEqual([]);
    expect(review?.proposedRemovals).toEqual([]);
  });

  it("expires typed round Stunned without inventing an unresolved recovery roll", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const canonicalLifecycle = buildDamagePersistentLifecycle({
      context: {
        commandId: "stun-command",
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: "revision-1",
        createdSequence: 2,
        encounterId: "encounter-1",
        eventId: "stun-event",
        ownerParticipantId: "scenario-gladiator",
        roundNumber: 3,
      },
      durationRounds: 1,
      effectId: "stunned-effect",
      isStunned: true,
      label: "Stunned",
      status: "active",
      type: "special",
    })!;
    const combatEffects = combatEffectsWith([
      {
        canonicalLifecycle,
        description: "Stunned",
        duration: "1 round",
        effectGroup: "special",
        id: "stunned-effect",
        type: "special",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: { gladiator: { combatEffects } },
      state: roundSummaryState,
    });
    const review = reviewed.roundEndReview?.participantReviews.gladiator;

    expect(review?.canonicalReview?.requirements).toEqual([]);
    expect(review?.canonicalReview?.proposals[0]).toMatchObject({
      effectId: "stunned-effect",
      nextState: "expired",
      reason: "natural_expiry",
    });
    const committed = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:10:00.000Z" },
      combatEffects,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });
    expect(
      committed.combatEffects.effects.find((effect) => effect.id === "stunned-effect"),
    ).toMatchObject({
      canonicalLifecycle: { lifecycle: { state: "expired" }, version: 2 },
      status: "expired",
    });
  });

  it("keeps unresolved Stunned condition-bound recovery as non-fabricated context", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const canonicalLifecycle = buildDamagePersistentLifecycle({
      context: {
        commandId: "stun-command",
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: "revision-1",
        createdSequence: 2,
        encounterId: "encounter-1",
        eventId: "stun-event",
        ownerParticipantId: "scenario-gladiator",
        roundNumber: 3,
      },
      effectId: "stunned-effect",
      isStunned: true,
      label: "Stunned",
      status: "active",
      type: "special",
    })!;
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: combatEffectsWith([
            {
              canonicalLifecycle,
              description: "Stunned",
              effectGroup: "special",
              id: "stunned-effect",
              type: "special",
            },
          ]),
        },
      },
      state: roundSummaryState,
    });
    const review = reviewed.roundEndReview?.participantReviews.gladiator;

    expect(review?.canonicalReview?.proposals).toEqual([]);
    expect(review?.canonicalReview?.requirements).toEqual([
      expect.objectContaining({
        blocksReview: false,
        completeness: "unsupported_ambiguity",
        kind: "condition",
        resolved: false,
      }),
    ]);
    expect(review?.proposedHealthRolls).toEqual([]);
    expect(review?.status).toBe("review_ready");
  });

  it("keeps next-round no-action effects active through the next round", () => {
    const roundThreeState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 3 }) }),
      "round_summary",
    );
    const initialEffects = combatEffectsWith([
      {
        description: "No combat action possible next round.",
        duration: "2 rounds",
        effectGroup: "special",
        id: "next-round-no-action",
        type: "special",
      },
    ]);
    const reviewedRoundThree = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: initialEffects,
        },
      },
      state: roundThreeState,
    });

    expect(
      reviewedRoundThree.roundEndReview?.participantReviews.gladiator?.proposedEffects[0],
    ).toMatchObject({
      effectId: "next-round-no-action",
      nextDuration: "1 round",
    });

    const committedRoundThree = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      combatEffects: initialEffects,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewedRoundThree,
    });
    const activeNextRoundEffect = committedRoundThree.combatEffects.effects.find(
      (effect) => effect.id === "next-round-no-action",
    );

    expect(activeNextRoundEffect).toMatchObject({
      duration: "1 round",
      status: "active",
    });

    const roundFourState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 4 }) }),
      "round_summary",
    );
    const reviewedRoundFour = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: committedRoundThree.combatEffects,
        },
      },
      state: roundFourState,
    });

    expect(
      reviewedRoundFour.roundEndReview?.participantReviews.gladiator?.proposedRemovals[0],
    ).toMatchObject({
      effectId: "next-round-no-action",
      kind: "duration_expire",
    });

    const committedRoundFour = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:30.000Z",
      },
      combatEffects: committedRoundThree.combatEffects,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewedRoundFour,
    });

    expect(
      committedRoundFour.combatEffects.effects.find(
        (effect) => effect.id === "next-round-no-action",
      ),
    ).toMatchObject({
      status: "expired",
    });
  });

  it("keeps next-round parry-only effects active through the next round", () => {
    const roundThreeState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 3 }) }),
      "round_summary",
    );
    const initialEffects = combatEffectsWith([
      {
        description: "Action limited to parry next round.",
        duration: "2 rounds",
        effectGroup: "special",
        id: "next-round-parry-only",
        type: "special",
      },
    ]);
    const reviewedRoundThree = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: initialEffects,
        },
      },
      state: roundThreeState,
    });

    expect(
      reviewedRoundThree.roundEndReview?.participantReviews.gladiator?.proposedEffects[0],
    ).toMatchObject({
      effectId: "next-round-parry-only",
      nextDuration: "1 round",
    });

    const committedRoundThree = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      combatEffects: initialEffects,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewedRoundThree,
    });
    const activeNextRoundEffect = committedRoundThree.combatEffects.effects.find(
      (effect) => effect.id === "next-round-parry-only",
    );

    expect(activeNextRoundEffect).toMatchObject({
      duration: "1 round",
      status: "active",
    });

    const roundFourState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 4 }) }),
      "round_summary",
    );
    const reviewedRoundFour = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: committedRoundThree.combatEffects,
        },
      },
      state: roundFourState,
    });

    expect(
      reviewedRoundFour.roundEndReview?.participantReviews.gladiator?.proposedRemovals[0],
    ).toMatchObject({
      effectId: "next-round-parry-only",
      kind: "duration_expire",
    });
  });

  it("accumulates bleed 1 as tenths without HP damage until the 10th round", () => {
    const roundNineState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 9 }) }),
      "round_summary",
    );
    const roundNineEffects = combatEffectsWith([
      {
        bleedState: {
          accumulatedTenths: 8,
          initializedRound: 1,
        },
        effectGroup: "bleed",
        id: "bleed-1",
        modifierValue: 1,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const roundNineReviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: roundNineEffects,
        },
      },
      state: roundNineState,
    });
    const roundNineProposal =
      roundNineReviewed.roundEndReview?.participantReviews.gladiator?.proposedDamage[0];

    expect(roundNineProposal).toMatchObject({
      accumulatedTenths: 9,
      amount: 0,
      previousAccumulatedTenths: 8,
      remainingAccumulatedTenths: 9,
      roundsUntilHealthCheck: 1,
    });
    expect(
      roundNineReviewed.roundEndReview?.participantReviews.gladiator?.proposedHealthRolls,
    ).toEqual([]);

    const roundTenState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const roundTenEffects = combatEffectsWith([
      {
        bleedState: {
          accumulatedTenths: 9,
          initializedRound: 1,
        },
        effectGroup: "bleed",
        id: "bleed-1",
        modifierValue: 1,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const roundTenReviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: roundTenEffects,
          healthStat: 0,
        },
      },
      state: roundTenState,
    });
    const roundTenReview = roundTenReviewed.roundEndReview?.participantReviews.gladiator;

    expect(roundTenReview?.proposedDamage[0]).toMatchObject({
      accumulatedTenths: 10,
      amount: 1,
      healthCheckDue: true,
      remainingAccumulatedTenths: 0,
    });
    expect(roundTenReview?.proposedHealthRolls[0]).toMatchObject({
      difficulty: 21,
      previousBleedRate: 1,
      status: "pending",
    });
  });

  it("accumulates bleed 3 using tenths and remainder", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const threeRoundEffects = combatEffectsWith([
      {
        bleedState: {
          accumulatedTenths: 6,
          initializedRound: 3,
        },
        effectGroup: "bleed",
        id: "bleed-3",
        modifierValue: 3,
        type: "bleed",
      },
    ]);
    const threeRoundReviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: threeRoundEffects,
        },
      },
      state: roundSummaryState,
    });

    expect(
      threeRoundReviewed.roundEndReview?.participantReviews.gladiator?.proposedDamage[0],
    ).toMatchObject({
      accumulatedTenths: 9,
      amount: 0,
      remainingAccumulatedTenths: 9,
    });

    const fourRoundEffects = combatEffectsWith([
      {
        bleedState: {
          accumulatedTenths: 9,
          initializedRound: 3,
        },
        effectGroup: "bleed",
        id: "bleed-3",
        modifierValue: 3,
        type: "bleed",
      },
    ]);
    const fourRoundReviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: fourRoundEffects,
        },
      },
      state: roundSummaryState,
    });

    expect(
      fourRoundReviewed.roundEndReview?.participantReviews.gladiator?.proposedDamage[0],
    ).toMatchObject({
      accumulatedTenths: 12,
      amount: 1,
      remainingAccumulatedTenths: 2,
    });
  });

  it("does not create a general damage row when accumulated bleed is below 10 tenths", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        bleedState: {
          accumulatedTenths: 5,
          initializedRound: 3,
        },
        effectGroup: "bleed",
        id: "bleed-1",
        modifierValue: 1,
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
        },
      },
      state: roundSummaryState,
    });
    const committed = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      combatEffects,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });

    expect(committed.combatEffects.effects.some((effect) => effect.type === "general_damage")).toBe(
      false,
    );
    expect(
      committed.combatEffects.effects.find((effect) => effect.id === "bleed-1")?.bleedState
        ?.accumulatedTenths,
    ).toBe(6);
  });

  it("proposes health rolls only at the 10-round bleed interval", () => {
    const roundTwoState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 2 }) }),
      "round_summary",
    );
    const roundTenState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        effectGroup: "bleed",
        id: "bleed-interval",
        modifierValue: 2,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const roundTwoReviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 5,
        },
      },
      state: roundTwoState,
    });
    const roundTenReviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 5,
        },
      },
      state: roundTenState,
    });

    expect(
      roundTwoReviewed.roundEndReview?.participantReviews.gladiator?.proposedHealthRolls,
    ).toEqual([]);
    expect(
      roundTenReviewed.roundEndReview?.participantReviews.gladiator?.proposedHealthRolls[0],
    ).toMatchObject({
      difficulty: 21,
      status: "pending",
    });
  });

  it("exposes pending player-owned SU health rolls for participants with due bleed checks", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        description: "Bleeding wound",
        effectGroup: "bleed",
        id: "bleed-player-owned",
        modifierValue: 2,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 8,
        },
      },
      state: roundSummaryState,
    });
    const pendingHealthRolls = getCombatRoundEndHealthCheckPendingRolls({
      participantId: "gladiator",
      state: reviewed,
    });

    expect(
      getCombatRoundEndHealthCheckPendingRollCount({ participantId: "gladiator", state: reviewed }),
    ).toBe(1);
    expect(pendingHealthRolls[0]).toMatchObject({
      bleedType: "external",
      difficulty: 21,
      healthStat: 8,
      label: "Health check vs bleed 21",
      status: "pending",
    });
  });

  it("reduces external bleed on successful health roll and restores it on undo", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        canonicalLifecycle: buildDamagePersistentLifecycle({
          context: {
            commandId: "damage-command-health",
            createdAt: "2026-01-01T00:00:00.000Z",
            createdRevision: "revision-bleed-created",
            createdSequence: 2,
            encounterId: "encounter-1",
            eventId: "event-external-bleed",
            ownerParticipantId: "scenario-gladiator",
            roundNumber: 1,
          },
          effectId: "external-bleed",
          isStunned: false,
          label: "Bleed",
          modifierValue: 3,
          status: "active",
          type: "bleed",
        }),
        effectGroup: "bleed",
        id: "external-bleed",
        modifierValue: 3,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 0,
        },
      },
      state: roundSummaryState,
    });
    const rolled = rollCombatRoundEndHealthCheck({
      command: {
        createdAt: "2026-01-01T00:11:00.000Z",
        createdByUserId: "player-1",
      },
      combatEffects,
      createdRevision: "revision-health-check",
      participantId: "gladiator",
      roll: {
        dieResult: 21,
        openEndedD10s: [1],
        rollD20: 20,
      },
      rolledBy: "player",
      state: reviewed,
    });
    const reducedEffect = rolled.combatEffects.effects.find(
      (effect) => effect.id === "external-bleed",
    );
    const restoredState = clearCombatRoundStep({
      state: rolled.state,
      step: "round_summary",
    });
    const restoredEffects = removeCombatRoundEndHealthCheckEffects({
      combatEffects: rolled.combatEffects,
      command: rolled.command,
    });

    expect(reducedEffect?.modifierValue).toBe(2);
    expect(reducedEffect?.bleedState?.lastHealthCheckRound).toBe(10);
    expect(reducedEffect?.canonicalLifecycle).toMatchObject({
      payload: {
        bleedState: { lastHealthCheckRound: 10 },
        unit: "bleed_rate",
        value: 2,
      },
      version: 2,
    });
    expect(reducedEffect?.canonicalTransitions?.[0]).toMatchObject({
      reason: "check_succeeded",
      transitionType: "update",
    });
    expect(
      rolled.state.roundEndReview?.participantReviews.gladiator?.proposedHealthRolls[0],
    ).toMatchObject({
      nextBleedRate: 2,
      previousBleedRate: 3,
      result: expect.objectContaining({
        difficulty: 21,
        rolledBy: "player",
        rolledByUserId: "player-1",
      }),
      status: "rolled",
    });
    expect(rolled.command.facts).toMatchObject({
      healthRollId: "round-end:10:gladiator:external-bleed:external-bleed:health",
      rolledBy: "player",
      success: true,
    });
    expect(rolled.state.events.at(-1)).toMatchObject({
      combatEffectIds: ["external-bleed"],
      healthRollId: "round-end:10:gladiator:external-bleed:external-bleed:health",
      ownerParticipantId: "gladiator",
      rollerParticipantId: "gladiator",
      type: "health_check",
    });
    expect(rolled.state.events.at(-1)?.facts.resultPresentation).toMatchObject({
      actionInstanceId: "round-end:10:gladiator:review",
      conciseOutcome: { label: "Health check" },
    });
    expect(
      rolled.state.roundEndReview?.participantReviews.gladiator?.canonicalReview,
    ).toMatchObject({
      requirements: expect.arrayContaining([
        expect.objectContaining({ kind: "health_check", resolved: true }),
      ]),
      state: "ready",
    });
    expect(rolled.state.events.at(-1)?.facts.rollerPrivate).toMatchObject({
      difficulty: 21,
      rollD20: 20,
      rollTotal: 21,
    });
    expect(rolled.state.events.at(-1)?.facts.publicOutcome).toEqual({});
    expect(restoredState.roundEndReview?.participantReviews.gladiator?.status).toBe(
      "health_roll_pending",
    );
    expect(restoredState.events.some((event) => event.type === "health_check")).toBe(false);
    expect(
      restoredEffects.effects.find((effect) => effect.id === "external-bleed")?.modifierValue,
    ).toBe(3);
    expect(
      restoredEffects.effects.find((effect) => effect.id === "external-bleed")?.canonicalLifecycle,
    ).toEqual(combatEffects.effects[0]?.canonicalLifecycle);
    expect(
      getCombatRoundEndHealthAutomationReviewDisposition({
        participantId: "gladiator",
        state: rolled.state,
      }),
    ).toBe("automatic");
  });

  it("keeps legacy Bleed and unrelated effect work outside automatic Health closure", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const legacyEffects = combatEffectsWith([
      {
        effectGroup: "bleed",
        id: "legacy-bleed",
        modifierValue: 2,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const legacyReview = prepareCombatRoundEndReview({
      participantInputs: { gladiator: { combatEffects: legacyEffects, healthStat: 0 } },
      state: roundSummaryState,
    });
    const legacyRolled = rollCombatRoundEndHealthCheck({
      command: { createdAt: "2026-01-01T00:11:00.000Z" },
      combatEffects: legacyEffects,
      participantId: "gladiator",
      roll: { dieResult: 21, openEndedD10s: [1], rollD20: 20 },
      state: legacyReview,
    });

    expect(
      getCombatRoundEndHealthAutomationReviewDisposition({
        participantId: "gladiator",
        state: legacyRolled.state,
      }),
    ).toBe("incomplete_legacy_state");

    const canonicalEffects = combatEffectsWith([
      {
        canonicalLifecycle: buildDamagePersistentLifecycle({
          context: {
            commandId: "damage-command-health-review",
            createdAt: "2026-01-01T00:00:00.000Z",
            createdRevision: "revision-created",
            createdSequence: 2,
            encounterId: "encounter-1",
            eventId: "event-health-review",
            ownerParticipantId: "scenario-gladiator",
            roundNumber: 1,
          },
          effectId: "canonical-bleed",
          isStunned: false,
          label: "Bleed",
          modifierValue: 2,
          status: "active",
          type: "bleed",
        }),
        effectGroup: "bleed",
        id: "canonical-bleed",
        modifierValue: 2,
        roundNumber: 1,
        type: "bleed",
      },
      {
        canonicalLifecycle: buildDamagePersistentLifecycle({
          context: {
            commandId: "damage-command-stunned-review",
            createdAt: "2026-01-01T00:00:00.000Z",
            createdRevision: "revision-created",
            createdSequence: 3,
            encounterId: "encounter-1",
            eventId: "event-stunned-review",
            ownerParticipantId: "scenario-gladiator",
            roundNumber: 1,
          },
          effectId: "stunned-review",
          isStunned: true,
          label: "Stunned",
          modifierValue: -2,
          status: "active",
          type: "general_modifier",
        }),
        effectGroup: "general",
        id: "stunned-review",
        modifierValue: -2,
        roundNumber: 1,
        type: "general_modifier",
      },
    ]);
    const decisionReview = prepareCombatRoundEndReview({
      participantInputs: { gladiator: { combatEffects: canonicalEffects, healthStat: 0 } },
      state: roundSummaryState,
    });
    const decisionRolled = rollCombatRoundEndHealthCheck({
      command: { createdAt: "2026-01-01T00:12:00.000Z" },
      combatEffects: canonicalEffects,
      participantId: "gladiator",
      roll: { dieResult: 21, openEndedD10s: [1], rollD20: 20 },
      state: decisionReview,
    });

    expect(
      getCombatRoundEndHealthAutomationReviewDisposition({
        participantId: "gladiator",
        state: decisionRolled.state,
      }),
    ).not.toBe("automatic");
  });

  it("does not reduce bleed on failed health roll", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        effectGroup: "bleed",
        id: "failed-bleed",
        modifierValue: 3,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 0,
        },
      },
      state: roundSummaryState,
    });
    const rolled = rollCombatRoundEndHealthCheck({
      command: {
        createdAt: "2026-01-01T00:11:00.000Z",
      },
      combatEffects,
      participantId: "gladiator",
      roll: {
        dieResult: 5,
        openEndedD10s: [],
        rollD20: 5,
      },
      state: reviewed,
    });
    const bleedEffect = rolled.combatEffects.effects.find((effect) => effect.id === "failed-bleed");

    expect(bleedEffect?.modifierValue).toBe(3);
    expect(bleedEffect?.bleedState?.lastHealthCheckRound).toBe(10);
    expect(
      rolled.state.roundEndReview?.participantReviews.gladiator?.proposedHealthRolls[0]?.result,
    ).toMatchObject({
      success: false,
    });
  });

  it("expires bleed when a successful health roll reduces the rate to 0", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        effectGroup: "bleed",
        id: "nearly-stopped-bleed",
        modifierValue: 1,
        roundNumber: 1,
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 0,
        },
      },
      state: roundSummaryState,
    });
    const rolled = rollCombatRoundEndHealthCheck({
      command: {
        createdAt: "2026-01-01T00:11:00.000Z",
      },
      combatEffects,
      participantId: "gladiator",
      roll: {
        dieResult: 21,
        openEndedD10s: [1],
        rollD20: 20,
      },
      state: reviewed,
    });
    const bleedEffect = rolled.combatEffects.effects.find(
      (effect) => effect.id === "nearly-stopped-bleed",
    );

    expect(bleedEffect).toMatchObject({
      modifierValue: 0,
      status: "expired",
    });
  });

  it("commits SU bleed accumulation damage and restores effect rows on undo", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        canonicalLifecycle: buildDamagePersistentLifecycle({
          context: {
            commandId: "damage-command-1",
            createdAt: "2026-01-01T00:08:00.000Z",
            createdRevision: "revision-bleed-created",
            createdSequence: 12,
            encounterId: "encounter-1",
            eventId: "bleed-event-1",
            ownerParticipantId: "scenario-gladiator",
            roundNumber: 3,
          },
          effectId: "bleed-1",
          isStunned: false,
          label: "Bleed",
          modifierValue: 2,
          status: "active",
          type: "bleed",
        }),
        description: "Bleeding wound",
        bleedState: {
          accumulatedTenths: 8,
          initializedRound: 3,
        },
        duration: "2 rounds",
        effectGroup: "bleed",
        id: "bleed-1",
        modifierValue: 2,
        type: "bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      command: {
        createdAt: "2026-01-01T00:09:00.000Z",
      },
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 9,
        },
      },
      state: roundSummaryState,
    });
    const review = reviewed.roundEndReview?.participantReviews.gladiator;

    expect(review?.proposedDamage[0]).toMatchObject({
      accumulatedTenths: 10,
      amount: 1,
      bleedType: "external",
      previousAccumulatedTenths: 8,
      remainingAccumulatedTenths: 0,
    });
    expect(review?.proposedHealthRolls).toEqual([]);

    const committed = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      combatEffects,
      createdRevision: "revision-bleed-reviewed",
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });
    const bleedEffect = committed.combatEffects.effects.find((effect) => effect.id === "bleed-1");
    const bleedDamage = committed.combatEffects.effects.find(
      (effect) => effect.type === "general_damage" && effect.generalDamage === 1,
    );

    expect(bleedEffect?.duration).toBe("1 round");
    expect(bleedEffect?.bleedState?.accumulatedTenths).toBe(0);
    expect(bleedEffect?.canonicalLifecycle).toMatchObject({
      payload: { bleedState: { accumulatedTenths: 0 }, unit: "bleed_rate", value: 2 },
      version: 3,
    });
    expect(bleedEffect?.canonicalTransitions).toEqual([
      expect.objectContaining({ reason: "duration_decremented", transitionType: "update" }),
      expect.objectContaining({ reason: "bleed_state_updated", transitionType: "update" }),
    ]);
    expect(bleedDamage).toBeDefined();
    expect(committed.state.roundEndReview?.participantReviews.gladiator?.status).toBe("complete");
    expect(committed.state.events.at(-1)).toMatchObject({
      combatEffectEventId: committed.command.facts.createdCombatEffectEventId,
      ownerParticipantId: "gladiator",
      status: "committed",
      type: "participant_su_review",
    });
    expect(committed.state.events.at(-1)?.facts.publicOutcome).toEqual({
      changed: true,
      workflowOnly: false,
    });
    expect(committed.state.events.at(-1)?.facts.gmReview).toMatchObject({
      acceptedDamageProposalIds: expect.any(Array),
      updatedEffects: expect.any(Array),
    });

    const restoredEffects = removeCombatRoundEndParticipantReviewEffects({
      combatEffects: committed.combatEffects,
      command: committed.command,
    });
    const restoredState = clearCombatRoundStep({
      state: committed.state,
      step: "round_summary",
    });

    expect(restoredEffects.effects.find((effect) => effect.id === "bleed-1")?.duration).toBe(
      "2 rounds",
    );
    expect(
      restoredEffects.effects.find((effect) => effect.id === "bleed-1")?.bleedState
        ?.accumulatedTenths,
    ).toBe(8);
    expect(
      restoredEffects.effects.find((effect) => effect.id === "bleed-1")?.canonicalLifecycle,
    ).toEqual(combatEffects.effects[0]?.canonicalLifecycle);
    expect(
      restoredEffects.effects.some(
        (effect) => effect.type === "general_damage" && effect.generalDamage === 1,
      ),
    ).toBe(false);
    expect(restoredState.events.some((event) => event.type === "participant_su_review")).toBe(
      false,
    );
  });

  it("rolls SU health checks with open-ended d20 plus health stat", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter({ currentRound: 10 }) }),
      "round_summary",
    );
    const combatEffects = combatEffectsWith([
      {
        description: "Internal bleeding",
        effectGroup: "bleed",
        id: "internal-bleed-1",
        modifierValue: 4,
        roundNumber: 1,
        type: "internal_bleed",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects,
          healthStat: 7,
        },
      },
      state: roundSummaryState,
    });
    const rolled = rollCombatRoundEndHealthCheck({
      command: {
        createdAt: "2026-01-01T00:11:00.000Z",
      },
      combatEffects,
      participantId: "gladiator",
      roll: {
        dieResult: 20,
        openEndedD10s: [5],
        rollD20: 15,
      },
      state: reviewed,
    });
    const result =
      rolled.state.roundEndReview?.participantReviews.gladiator?.proposedHealthRolls[0]?.result;
    const internalBleed = rolled.combatEffects.effects.find(
      (effect) => effect.id === "internal-bleed-1",
    );

    expect(result).toMatchObject({
      difficulty: 26,
      finalTotal: 27,
      healthStat: 7,
      rolledBy: "gm_proxy",
      rollTotal: 20,
      success: true,
    });
    expect(rolled.command.facts).toMatchObject({
      rolledBy: "gm_proxy",
      success: true,
    });
    expect(internalBleed?.modifierValue).toBe(3);
    expect(internalBleed?.bleedState?.lastHealthCheckRound).toBe(10);
    expect(rolled.state.roundEndReview?.participantReviews.gladiator?.status).toBe("review_ready");
  });

  it("advances SU review participant-by-participant and enables next round after completion", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const gladiatorEffects = combatEffectsWith([
      {
        description: "Gladiator effect",
        duration: "1 round",
        id: "gladiator-effect",
        type: "special",
      },
    ]);
    const guardEffects = combatEffectsWith([
      {
        description: "Guard effect",
        duration: "1 round",
        id: "guard-effect",
        targetParticipantId: "scenario-guard",
        type: "special",
      },
    ]);
    const reviewed = prepareCombatRoundEndReview({
      participantInputs: {
        gladiator: {
          combatEffects: gladiatorEffects,
        },
        guard: {
          combatEffects: guardEffects,
        },
      },
      state: roundSummaryState,
    });

    expect(reviewed.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "SU",
    });

    const committedGladiator = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
      },
      combatEffects: gladiatorEffects,
      participantId: "gladiator",
      scenarioParticipantId: "scenario-gladiator",
      state: reviewed,
    });

    expect(committedGladiator.state.roundEndReview?.participantReviews.gladiator?.status).toBe(
      "complete",
    );
    expect(committedGladiator.state.roundEndReview?.participantReviews.guard?.status).toBe(
      "review_ready",
    );
    expect(committedGladiator.state.currentCursor).toMatchObject({
      participantId: "guard",
      step: "SU",
    });
    expect(committedGladiator.state.selectedParticipantId).toBe("guard");
    expect(getCombatRoundStartNextRoundBlocker(committedGladiator.state)).toBe(
      "Round-end review incomplete for City guard.",
    );

    const committedGuard = commitCombatRoundEndParticipantReview({
      command: {
        createdAt: "2026-01-01T00:11:00.000Z",
      },
      combatEffects: guardEffects,
      participantId: "guard",
      scenarioParticipantId: "scenario-guard",
      state: committedGladiator.state,
    });

    expect(isCombatRoundEndReviewComplete(committedGuard.state)).toBe(true);
    expect(committedGuard.state.currentCursor).toEqual({
      roundNumber: 3,
      step: "SU",
    });
    expect(committedGuard.state.selectedParticipantId).toBeUndefined();
    expect(getCombatRoundStartNextRoundBlocker(committedGuard.state)).toBeUndefined();
  });

  it("archives SU completion commands and starts a clean next round", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const reviewedRoundSummaryState = completeCleanRoundEndReview(roundSummaryState);
    const seededEvent = combatStepEventSchema.parse({
      actorParticipantId: "gladiator",
      combatEffectIds: [],
      commandId: "seed-command",
      completeness: "complete",
      encounterId: "encounter-1",
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: { total: 9 },
        rollerPrivate: { rolls: [5] },
      },
      id: "seed-event",
      missingFacts: [],
      occurredAt: "2026-01-01T00:09:00.000Z",
      ownerParticipantId: "gladiator",
      phase: "phase1",
      rollerParticipantId: "gladiator",
      roundNumber: reviewedRoundSummaryState.roundNumber,
      schemaVersion: 1,
      sequence: 0,
      source: {
        commandType: "roll_initiative_phase1",
        kind: "canonical",
        sourceIds: ["seed-command"],
      },
      status: "recorded",
      step: "initiative_phase_1",
      type: "initiative",
      visibility: {
        identityRefs: [{ participantId: "gladiator", role: "roller" }],
        involvedParticipantIds: ["gladiator"],
        outcomeScope: "involved",
        rollerParticipantId: "gladiator",
      },
    });
    const completed = advanceCombatRoundStep(
      { ...reviewedRoundSummaryState, events: [seededEvent] },
      {
        command: {
          createdAt: "2026-01-01T00:10:00.000Z",
          createdByUserId: "gm-1",
        },
      },
    );
    const clearedAtNewRoundStart = clearCombatRoundStep({
      state: completed,
      step: "select_actions",
    });
    const archivedRound = completed.rounds.find(
      (round) => round.roundNumber === roundSummaryState.roundNumber,
    );

    expect(completed.currentStep).toBe("select_actions");
    expect(completed.roundNumber).toBe(roundSummaryState.roundNumber + 1);
    expect(completed.commands).toEqual([]);
    expect(completed.events).toEqual([]);
    expect(completed.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: roundSummaryState.roundNumber + 1,
      step: "DE",
    });
    expect(
      completed.participants.map((participant) => participant.stepStatuses.select_actions),
    ).toEqual(["pending", "pending"]);
    expect(archivedRound?.commands.map((command) => command.type)).toEqual([
      "prepare_round_end_review",
      "commit_round_end_participant_review",
      "commit_round_end_participant_review",
      "complete_round",
      "complete_round",
    ]);
    expect(
      archivedRound?.commands.find((command) => command.type === "complete_round")?.facts,
    ).toMatchObject({
      completedRoundNumber: roundSummaryState.roundNumber,
      nextRoundNumber: roundSummaryState.roundNumber + 1,
      participantIds: ["gladiator", "guard"],
    });
    expect(
      archivedRound?.participants.map((participant) => participant.stepStatuses.round_summary),
    ).toEqual(["complete", "complete"]);
    expect(archivedRound?.events).toEqual([seededEvent]);
    expect(clearedAtNewRoundStart).toEqual(completed);
  });

  it("returns completed and active rounds as separate timeline states", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const reviewedRoundSummaryState = completeCleanRoundEndReview(roundSummaryState);
    const nextRoundState = advanceCombatRoundStep(reviewedRoundSummaryState, {
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
        createdByUserId: "gm-1",
      },
    });
    const timelineRounds = getCombatRoundTimelineRoundStates(nextRoundState);

    expect(timelineRounds.map((round) => round.roundNumber)).toEqual([
      roundSummaryState.roundNumber,
      roundSummaryState.roundNumber + 1,
    ]);
    expect(timelineRounds[0]?.currentStep).toBe("round_summary");
    expect(timelineRounds[0]?.participants[0]?.stepStatuses.round_summary).toBe("complete");
    expect(timelineRounds[1]?.currentStep).toBe("select_actions");
    expect(timelineRounds[1]?.commands).toEqual([]);
    expect(timelineRounds[1]?.participants[0]?.declaration).toBeUndefined();
  });

  it("keeps opportunity-keyed attack results in their completed round only", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "single_attack",
      attackOpportunityId: "round-3-gladiator-phase1-attack-1",
      attackerParticipantId: "gladiator",
      defenderDb: 15,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 13,
      rollTotal: 13,
      rolledAt: "2026-01-01T00:08:00.000Z",
      weaponName: "Long sword",
    });
    const withCanonicalAttack = combatRoundStateSchema.parse({
      ...roundSummaryState,
      participants: roundSummaryState.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              attackResultsByOpportunity: {
                [attackResult.attackOpportunityId!]: attackResult,
              },
            }
          : participant,
      ),
    });
    const nextRoundState = advanceCombatRoundStep(
      completeCleanRoundEndReview(withCanonicalAttack),
      {
        command: {
          createdAt: "2026-01-01T00:10:00.000Z",
          createdByUserId: "gm-1",
        },
      },
    );
    const [completedRound, activeRound] = getCombatRoundTimelineRoundStates(nextRoundState);

    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: completedRound!,
      }),
    ).toEqual(attackResult);
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: activeRound!,
      }),
    ).toBeUndefined();
    expect(activeRound?.participants[0]?.attackResultsByOpportunity).toEqual({});
    expect(activeRound?.participants[0]?.attackResults).toEqual({});
    expect(activeRound?.participants[0]?.initiatives).toEqual({});
    expect(
      activeRound?.participants.every(
        (participant) =>
          Object.keys(participant.attackResultsByOpportunity ?? {}).length === 0 &&
          Object.keys(participant.attackResults).length === 0 &&
          Object.keys(participant.initiatives).length === 0,
      ),
    ).toBe(true);
    expect(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: "guard",
        phase: "phase1",
        state: activeRound!,
      }),
    ).toBeUndefined();
    expect(activeRound?.currentStep).toBe("select_actions");
    expect(activeRound?.currentCursor).toMatchObject({
      roundNumber: roundSummaryState.roundNumber + 1,
      step: "DE",
    });
  });

  it("summarizes the latest archived round-start event", () => {
    const roundSummaryState = advanceToStep(
      initializeCombatRoundState({ encounter: encounter() }),
      "round_summary",
    );
    const nextRoundState = advanceCombatRoundStep(completeCleanRoundEndReview(roundSummaryState), {
      command: {
        createdAt: "2026-01-01T00:10:00.000Z",
        createdByUserId: "gm-1",
      },
    });
    const latestEvent = getLatestCombatEventSummary(nextRoundState);

    expect(latestEvent).toMatchObject({
      roundNumber: roundSummaryState.roundNumber + 1,
      shortTitle: "New round started",
      summaryText: `Round ${roundSummaryState.roundNumber + 1}: New round started.`,
    });
  });

  it("summarizes committed damage with critical effect counts", () => {
    const base = initializeCombatRoundState({ encounter: encounter() });
    const state = combatRoundStateSchema.parse({
      ...base,
      commands: [
        {
          afterCursor: {
            participantId: "gladiator",
            roundNumber: base.roundNumber,
            step: "A1",
          },
          beforeCursor: {
            participantId: "guard",
            roundNumber: base.roundNumber,
            step: "D1",
          },
          createdAt: "2026-01-01T00:10:00.000Z",
          facts: {
            additionalEffects: [
              {
                id: "critical-note",
                kind: "note",
                label: "Critical note",
                sourceKind: "critical_table",
              },
            ],
            attackerParticipantId: "gladiator",
            criticalGrade: "a",
            criticalRoll: {
              finalCriticalRoll: 1,
              selectedHitLocation: "rightArm",
            },
            damageResultId: "damage-1",
            defenderParticipantId: "guard",
            effectiveHitLocation: "rightArm",
            status: "committed",
            totalDamage: 8,
          },
          id: "commit-damage-1",
          participantId: "guard",
          phase: "phase1",
          roundNumber: base.roundNumber,
          step: "D1",
          type: "commit_phase_damage",
        },
      ],
    });
    const latestEvent = getLatestCombatEventSummary(state);

    expect(latestEvent?.summaryText).toBe(
      "Round 3, Phase 1: The Gladiator hit City guard for 8 damage to right arm. Critical A pending, critical roll 1 to right arm.",
    );
    expect(latestEvent?.details).toBe("Critical effects committed: 1 row.");
  });

  it("records and undoes D2 placeholder damage review commands after failed parry", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "guard",
        phase: "phase2",
        state: declareRoundAction({
          actionId: "parry_attack",
          participantId: "guard",
          state: initializeCombatRoundState({ encounter: encounter() }),
        }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterDamageReview = recordCombatRoundDamageReviewPlaceholder({
      attackResult: result,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const cleared = clearCombatRoundStep({
      state: afterDamageReview,
      step: "phase_2_damage",
    });

    expect(afterDamageReview.commands.at(-1)).toMatchObject({
      beforeCursor: {
        participantId: "gladiator",
        roundNumber: 3,
        step: "D2",
      },
      facts: expect.objectContaining({
        attackResultId: "3:phase2:guard:gladiator",
        status: "deferred",
      }),
      participantId: "gladiator",
      phase: "phase2",
      step: "D2",
      type: "complete_damage_review_phase2",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: afterDamageReview,
        step: "phase_2_damage",
      }),
    ).toBe("gmEdited");
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "D2",
    });
    expect(cleared.currentStep).toBe("phase_2_damage");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_2_damage");
    expect(cleared.participants[1]?.attackResults.phase2).toEqual(result);
    expect(cleared.phaseResolutionResults[0]?.parryResolution).toMatchObject({
      status: "resolved",
      success: false,
    });
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_damage",
      }),
    ).toBe("pending");
  });

  it("committed P1 snapshots can include an attack result", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(
        advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
      ),
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const advanced = advanceCombatRoundStep(state, {
      stepSnapshots: [
        stepSnapshot({
          actionResultStatus: "recorded",
          actionResultSummary: "Main: Broad sword OB 10 - DB 10 + roll 10 = 10\nResult: Miss",
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
      ],
    });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: advanced,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      actionResultStatus: "recorded",
      attackResult: {
        hit: false,
        lookupTotal: 10,
        rollTotal: 10,
        tableResult: "Miss",
      },
      participantId: "gladiator",
      phase: "phase1",
      step: "phase_1_actions",
    });
  });

  it("clears P1 attack result, snapshot, and status without clearing declaration", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(
        advanceCombatRoundStep(
          recordCombatRoundDeclaration({
            declaration: {
              actionId: "attack_parry",
              movementId: "hold",
              roundNumber: 3,
            },
            participantId: "gladiator",
            state: initializeCombatRoundState({ encounter: encounter() }),
            submittedBy: "player",
          }),
        ),
      ),
    );
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withSnapshot = advanceCombatRoundStep(withResult, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
      step: "phase_1_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.declaration).toMatchObject({ actionId: "attack_parry" });
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
  });

  it("builds and records P2 attack results with attacker and defender lookup", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "parry_attack",
      gladiatorActionId: "parry_attack",
      phase: "phase2",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 14,
      defenderParticipantId: "guard",
      ob: 11,
      openEndedD10s: [7],
      phase: "phase2",
      rollD20: 20,
      rollTotal: 27,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const nextState = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });

    expect(result).toMatchObject({
      hit: true,
      lookupTotal: 24,
      phase: "phase2",
      tableResult: "Hit",
    });
    expect(nextState.participants[0]?.attackResults.phase2).toEqual(result);
    expect(nextState.participants[0]?.stepStatuses.phase_2_actions).toBe("gmEdited");
    expect(
      getCombatRoundAttackResultsForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: nextState,
      }).outgoing,
    ).toEqual(result);
    expect(
      getCombatRoundAttackResultsForParticipantPhase({
        participantId: "guard",
        phase: "phase2",
        state: nextState,
      }).incoming,
    ).toEqual([result]);
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: nextState,
      }),
    ).toEqual(result);
    expect(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: "guard",
        phase: "phase2",
        state: nextState,
      }),
    ).toEqual(result);
    expect(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: nextState,
      }),
    ).toBeUndefined();
  });

  it("clears P2 attack result, snapshot, and status without clearing declaration", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "parry_attack",
      gladiatorActionId: "parry_attack",
      phase: "phase2",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "gladiator",
      defenderDb: 14,
      defenderParticipantId: "guard",
      ob: 11,
      phase: "phase2",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withSnapshot = combatRoundStateSchema.parse({
      ...withResult,
      stepSnapshots: [
        ...withResult.stepSnapshots,
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase2",
          step: "phase_2_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
      step: "phase_2_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase2).toBeUndefined();
    expect(cleared.participants[0]?.declaration).toMatchObject({ actionId: "parry_attack" });
    expect(cleared.participants[0]?.stepStatuses.phase_2_actions).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_2_actions",
      }),
    ).toBeUndefined();
  });

  it("builds phase resolution scaffolds for misses and hits", () => {
    const miss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const hit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });

    expect(
      buildCombatRoundPhaseResolutionResult({
        attackResult: miss,
        roundNumber: 3,
        updatedAt: "2026-01-01T00:04:00.000Z",
      }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      damageProposal: { proposedEffects: [], status: "not_ready" },
      damageRoll: { status: "not_required" },
      parryResolution: { resultLabel: "Attack missed", status: "not_applicable" },
    });
    expect(
      buildCombatRoundPhaseResolutionResult({
        attackResult: hit,
        roundNumber: 3,
        updatedAt: "2026-01-01T00:04:00.000Z",
      }),
    ).toMatchObject({
      damageProposal: { proposedEffects: [], status: "not_ready" },
      damageRoll: { notes: "Awaiting parry resolution.", status: "pending" },
      parryResolution: { status: "pending" },
    });
  });

  it("creates and retrieves phase1 and phase2 resolution scaffolds from attack results", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const phase1Attack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const phase2Attack = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const withPhase1Attack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result: phase1Attack,
      state,
      submittedBy: "gm",
    });
    const withPhase2Attack = recordCombatRoundAttackResult({
      participantId: "guard",
      result: phase2Attack,
      state: withPhase1Attack,
      submittedBy: "gm",
    });
    const withPhase1Resolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withPhase2Attack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withBothResolutions = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase2",
      state: withPhase1Resolution,
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    expect(getCombatRoundResolutionPhaseForStep("review_phase_2_actions")).toBe("phase1");
    expect(getCombatRoundResolutionPhaseForStep("review_phase_2_damage")).toBe("phase2");
    expect(withBothResolutions.phaseResolutionResults).toHaveLength(2);
    expect(
      getCombatRoundDisplayPhaseResolutionResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: withBothResolutions,
      }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      parryResolution: { status: "pending" },
    });
    expect(
      getCombatRoundDisplayPhaseResolutionResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase2",
        state: withBothResolutions,
      }),
    ).toMatchObject({
      attackResultId: "3:phase2:guard:gladiator",
      damageRoll: { status: "not_required" },
      parryResolution: { status: "not_applicable" },
    });
  });

  it("stores resolved parry rolls with open-ended d20 breakdown", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withParry = recordCombatRoundParryResolution({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        mainHandParryScore: 4,
        modifiedParryBeforeRoll: 8,
        modifierAdjustment: -1,
        modifierBreakdown: [
          { label: "DB/Parry", value: -1 },
          { label: "attack result", value: -3 },
        ],
        offHandParryScore: 5,
        openEndedD10s: [7],
        parrySourceLabel: "Sword / shield",
        rawModifierTotal: -4,
        resultLabel: "Parry successful",
        rollD20: 20,
        rollTotal: 27,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 35,
        usedMainHand: true,
        usedOffHand: true,
      },
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(
      getCombatRoundDisplayPhaseResolutionResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: withParry,
      }),
    ).toMatchObject({
      damageProposal: { proposedEffects: [], status: "not_ready" },
      damageRoll: { status: "not_required" },
      parryResolution: {
        combinedParryScore: 9,
        modifiedParryBeforeRoll: 8,
        modifierAdjustment: -1,
        modifierBreakdown: [
          { label: "DB/Parry", value: -1 },
          { label: "attack result", value: -3 },
        ],
        openEndedD10s: [7],
        parrySourceLabel: "Sword / shield",
        rawModifierTotal: -4,
        resultLabel: "Parry successful",
        rollD20: 20,
        rollTotal: 27,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 35,
      },
    });
  });

  it("stores defender parry modifiers from the attack hit lookup row", () => {
    const lowHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const lookup18 = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const highOpenEnded = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 0,
      defenderParticipantId: "guard",
      ob: 0,
      openEndedD10s: [10, 5],
      phase: "phase1",
      rollD20: 20,
      rollTotal: 35,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const legacySerialized = JSON.parse(JSON.stringify(lowHit)) as Record<string, unknown>;
    delete legacySerialized.defenderParryModifier;

    expect(lowHit).toMatchObject({
      defenderParryModifier: 0,
      lookupTotal: 14,
    });
    expect(lookup18).toMatchObject({
      defenderParryModifier: -3,
      lookupTotal: 18,
    });
    expect(highOpenEnded).toMatchObject({
      defenderParryModifier: -10,
      lookupTotal: 35,
    });
    expect(combatRoundAttackRollResultSchema.parse(legacySerialized)).toMatchObject({
      defenderParryModifier: 0,
    });
  });

  it("derives A1/P1/D1 markers from attack, parry, and damage state", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const hit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const miss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterHit = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result: hit,
      state,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: afterHit,
        step: "phase_1_actions",
      }),
    ).toBe("gmEdited");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterHit,
        step: "review_phase_2_actions",
      }),
    ).toBe("pending");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterHit,
        step: "phase_1_damage",
      }),
    ).toBe("pending");

    const afterSuccessfulParry = recordCombatRoundParryResolution({
      attackResult: hit,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        purpose: "ordinary_defense",
        resultLabel: "Parry successful",
        rollD20: 12,
        rollTotal: 12,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 21,
      },
      state: afterHit,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterSuccessfulParry,
        step: "review_phase_2_actions",
      }),
    ).toBe("complete");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterSuccessfulParry,
        step: "phase_1_damage",
      }),
    ).toBe("skipped");

    const afterFailedParry = recordCombatRoundParryResolution({
      attackResult: hit,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterHit,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterFailedParry,
        step: "review_phase_2_actions",
      }),
    ).toBe("complete");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterFailedParry,
        step: "phase_1_damage",
      }),
    ).toBe("pending");

    const afterMiss = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result: miss,
      state,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterMiss,
        step: "review_phase_2_actions",
      }),
    ).toBe("skipped");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "guard",
        state: afterMiss,
        step: "phase_1_damage",
      }),
    ).toBe("skipped");
  });

  it("clears P1 parry without clearing the A1 attack result", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withResolvedParry = recordCombatRoundParryResolution({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: withResolution,
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const withSnapshot = advanceCombatRoundStep(withResolution, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "phase_1_damage",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withSnapshot,
        phaseResolutionResults: withResolvedParry.phaseResolutionResults,
        selectedParticipantId: "guard",
        selectedStep: "review_phase_2_actions",
      },
      step: "review_phase_2_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase1).toEqual(result);
    expect(cleared.participants[0]?.attackResults.phase1?.defenderParryModifier).toBe(-3);
    expect(cleared.phaseResolutionResults).toHaveLength(1);
    expect(cleared.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(cleared.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      attackResult: result,
      step: "phase_1_actions",
    });
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBeUndefined();
  });

  it("clears A1 attack result and its downstream P1/D1 resolution", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 18,
      rollTotal: 18,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withSnapshot = advanceCombatRoundStep(withResolution, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          participantId: "guard",
          phase: "phase1",
          step: "phase_1_actions",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: withSnapshot,
      step: "phase_1_actions",
    });

    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.phaseResolutionResults).toEqual([]);
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.phase_1_damage).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toMatchObject({
      participantId: "guard",
      step: "phase_1_actions",
    });
  });

  it("undoes a command-backed A1 hit from the auto-opened defender P1 cell", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const attackPhaseDefensivePenalty = resolveCombatAttackPhaseDefensivePenalty({
      commitment: "committed",
      executionState: "executed",
      opportunity: {
        actionId: "attack_parry",
        id: "round:3:participant:gladiator:phase1:attack_1",
        phase: "phase1",
        slot: "attack_1",
        status: "committed",
        targetParticipantId: "guard",
      },
      participantId: "gladiator",
      roundNumber: 3,
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackPhaseDefensivePenalty,
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: afterAttack,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const withSnapshot = advanceCombatRoundStep(withResolution, {
      stepSnapshots: [
        stepSnapshot({
          attackResult: result,
          participantId: "gladiator",
          phase: "phase1",
          step: "phase_1_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "review_phase_2_actions",
        }),
        stepSnapshot({
          attackResult: result,
          participantId: "guard",
          phase: "phase1",
          phaseResolutionResult: withResolution.phaseResolutionResults[0],
          step: "phase_1_damage",
        }),
      ],
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...withSnapshot,
        selectedParticipantId: "guard",
        selectedStep: "review_phase_2_actions",
      },
      step: "review_phase_2_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.declaration?.attackPhaseDefensivePenalties).toBeUndefined();
    expect(cleared.phaseResolutionResults).toEqual([]);
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.review_phase_2_actions).toBe("pending");
    expect(cleared.participants[1]?.stepStatuses.phase_1_damage).toBe("pending");
    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: cleared,
        step: "phase_1_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "review_phase_2_actions",
      }),
    ).toBeUndefined();
    expect(
      getCombatRoundStepSnapshot({
        participantId: "guard",
        state: cleared,
        step: "phase_1_damage",
      }),
    ).toBeUndefined();
  });

  it("undoes a command-backed selected A1 miss back to the attacker A1 cell", () => {
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const reparsedHistoricalAttack = combatRoundStateSchema.parse(afterAttack);

    expect(reparsedHistoricalAttack.commands.at(-1)?.type).toBe("roll_attack");
    expect(reparsedHistoricalAttack.commands.at(-1)?.facts).not.toHaveProperty("obSkillRaw");
    expect(reparsedHistoricalAttack.participants[0]?.attackResults.phase1?.ob).toBe(10);

    const cleared = clearCombatRoundStep({
      state: {
        ...afterAttack,
        selectedParticipantId: "gladiator",
        selectedStep: "phase_1_actions",
      },
      step: "phase_1_actions",
    });

    expect(cleared.commands).toEqual([]);
    expect(cleared.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.selectedParticipantId).toBe("gladiator");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.stepStatuses.phase_1_actions).toBe("pending");
  });

  it("manual selection of old i1 after later A1 attacks still undoes the latest roll_attack", () => {
    const threeParticipantEncounter = encounter({
      participants: [
        participant({ id: "gladiator", label: "The Gladiator" }),
        participant({ id: "guard", label: "City guard" }),
        participant({ id: "scout", label: "Scout" }),
      ],
    });
    const declared = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: threeParticipantEncounter }),
      }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "guard",
        phase: "phase1",
        state: setCombatRoundParticipantInitiative({
          initiative: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [2],
            rollTotal: 2,
            total: 2,
          },
          participantId: "scout",
          phase: "phase1",
          state: declared,
        }),
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const gladiatorMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterGladiatorMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: gladiatorMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result: gladiatorMiss,
      state: withCursor,
      submittedBy: "gm",
    });
    const guardMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:04:00.000Z",
      weaponName: "Spear",
    });
    const afterGuardMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: guardMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      result: guardMiss,
      state: afterGladiatorMiss,
      submittedBy: "gm",
    });
    const cleared = clearCombatRoundStep({
      state: {
        ...afterGuardMiss,
        currentCursor: {
          participantId: "scout",
          roundNumber: 3,
          step: "i1",
        },
        currentStep: "phase_1_actions",
        selectedParticipantId: "gladiator",
        selectedStep: "initiative_phase_1",
      },
      step: "initiative_phase_1",
    });

    expect(afterGuardMiss.commands.map((command) => command.participantId)).toEqual([
      "gladiator",
      "guard",
    ]);
    expect(cleared.commands).toHaveLength(1);
    expect(cleared.commands[0]).toMatchObject({
      participantId: "gladiator",
      type: "roll_attack",
    });
    expect(cleared.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A1",
    });
    expect(cleared.currentStep).toBe("phase_1_actions");
    expect(cleared.selectedParticipantId).toBe("guard");
    expect(cleared.selectedStep).toBe("phase_1_actions");
    expect(cleared.participants[0]?.attackResults.phase1).toEqual(gladiatorMiss);
    expect(cleared.participants[1]?.attackResults.phase1).toBeUndefined();
    expect(cleared.participants[0]?.initiatives.phase1).toMatchObject({ total: 6 });
  });

  it("committed D1 snapshots preserve resolution scaffold status", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const withResult = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const withResolution = ensureCombatRoundPhaseResolutionResultsForPhase({
      phase: "phase1",
      state: withResult,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const snapshot = stepSnapshot({
      actionResultStatus: "recorded",
      actionResultSummary:
        "Main: Broad sword OB 10 - DB 10 + roll 12 = 12 · Result: Hit\nParry: Pending · Damage roll: Pending\nProposal: Not ready",
      attackResult: result,
      participantId: "gladiator",
      phase: "phase1",
      phaseResolutionResult: withResolution.phaseResolutionResults[0],
      step: "review_phase_2_actions",
    });
    const advanced = advanceCombatRoundStep(withResolution, { stepSnapshots: [snapshot] });

    expect(
      getCombatRoundStepSnapshot({
        participantId: "gladiator",
        state: advanced,
        step: "review_phase_2_actions",
      }),
    ).toMatchObject({
      actionResultStatus: "recorded",
      actionResultSummary: expect.stringContaining("Parry: Pending"),
      phaseResolutionResult: {
        damageProposal: { proposedEffects: [], status: "not_ready" },
        damageRoll: { status: "pending" },
        parryResolution: { status: "pending" },
      },
      step: "review_phase_2_actions",
    });
  });

  it("keeps step-specific initiative, attack, and resolution result facts immutable", () => {
    const initiative = buildCombatRoundInitiativeResult({
      baseInitiative: 8,
      roll: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [6, 6],
        rollTotal: 12,
        total: 12,
      },
    });
    const initiativeSnapshot = combatRoundStepSnapshotSchema.parse({
      actionResultStatus: "recorded",
      committedAt: "2026-01-01T00:02:01.000Z",
      id: "initiative-history",
      initiativeRank: { rank: 1, rankTotal: 2, tiedCount: 1 },
      initiativeResult: initiative,
      participantId: "gladiator",
      participantLabel: "The Gladiator",
      roundNumber: 3,
      step: "initiative_phase_1",
    });
    const attack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const attackSnapshot = combatRoundStepSnapshotSchema.parse({
      actionResultStatus: "recorded",
      attackResult: attack,
      committedAt: "2026-01-01T00:03:01.000Z",
      id: "attack-history",
      participantId: "gladiator",
      participantLabel: "The Gladiator",
      roundNumber: 3,
      step: "phase_1_actions",
    });
    const missingSnapshot = combatRoundStepSnapshotSchema.parse({
      committedAt: "2026-01-01T00:01:00.000Z",
      id: "legacy-result-history",
      participantId: "gladiator",
      participantLabel: "The Gladiator",
      roundNumber: 3,
      step: "review_action_modifiers",
    });
    const laterAttack = { ...attack, tableResult: "Later phase result" };

    expect(initiativeSnapshot).toMatchObject({
      actionResultStatus: "recorded",
      initiativeRank: { rank: 1 },
      initiativeResult: { rolls: [6, 6], total: 20 },
    });
    expect(attackSnapshot.attackResult?.tableResult).toBe(attack.tableResult);
    expect(attackSnapshot.attackResult?.tableResult).not.toBe(laterAttack.tableResult);
    expect(missingSnapshot.actionResultStatus).toBeUndefined();
    expect(missingSnapshot.attackResult).toBeUndefined();
    expect(missingSnapshot.initiativeResult).toBeUndefined();
    expect(missingSnapshot.phaseResolutionResult).toBeUndefined();
  });

  it("initializes phase1 cursor from initiative order with unrolled participants last", () => {
    const baseState = initializeCombatRoundState({
      encounter: encounter({
        participants: [
          participant({ id: "gladiator", label: "The Gladiator" }),
          participant({ id: "guard", label: "City guard" }),
          participant({ id: "scout", label: "Scout" }),
        ],
      }),
    });
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "scout",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "guard",
        state: declareRoundAction({
          actionId: "attack_parry",
          participantId: "gladiator",
          state: baseState,
        }),
      }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "gladiator",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "guard",
        phase: "phase1",
        state: withDeclarations,
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(getCombatRoundPhaseResolutionOrder({ phase: "phase1", state: withCursor })).toEqual([
      "guard",
      "gladiator",
      "scout",
    ]);
    expect(withCursor.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(withCursor.selectedParticipantId).toBe("guard");
  });

  it("advances cursor through one participant and then to the next initiative participant", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        state: baseState,
      }),
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [4],
          rollTotal: 4,
          total: 4,
        },
        participantId: "guard",
        phase: "phase1",
        state: withDeclarations,
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withCursor,
      submittedBy: "gm",
    });

    expect(afterAttack.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterAttack,
      }).substep,
    ).toBe("parry");

    const afterDone = completeCombatRoundPhaseResolutionForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });

    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterDone,
      }).substep,
    ).toBe("done");
    expect(afterDone.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(afterDone.selectedParticipantId).toBe("guard");
  });

  it("clear A1/P1/D1 returns to the redo point in the phase1 dependency chain", () => {
    const state = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state: withCursor,
      submittedBy: "gm",
    });
    const afterPendingP1Clear = clearCombatRoundStep({
      state: afterAttack,
      step: "review_phase_2_actions",
    });

    expect(afterPendingP1Clear.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(afterPendingP1Clear.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(afterPendingP1Clear.selectedParticipantId).toBe("gladiator");
    expect(afterPendingP1Clear.selectedStep).toBe("phase_1_actions");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterPendingP1Clear,
      }).substep,
    ).toBe("pending");

    const afterP1Clear = clearCombatRoundStep({
      state: afterAttack,
      step: "phase_1_actions",
    });

    expect(afterP1Clear.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(afterP1Clear.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterP1Clear,
      }).substep,
    ).toBe("pending");

    const withFailedParry = recordCombatRoundParryResolution({
      attackResult: result,
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      updatedAt: "2026-01-01T00:06:00.000Z",
    });
    const afterResolvedP1Clear = clearCombatRoundStep({
      state: withFailedParry,
      step: "review_phase_2_actions",
    });

    expect(afterResolvedP1Clear.participants[0]?.attackResults.phase1).toEqual(result);
    expect(afterResolvedP1Clear.phaseResolutionResults[0]?.parryResolution.status).toBe("pending");
    expect(afterResolvedP1Clear.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "parry",
    });
    expect(afterResolvedP1Clear.selectedParticipantId).toBe("guard");
    expect(afterResolvedP1Clear.selectedStep).toBe("review_phase_2_actions");

    const afterD1Clear = clearCombatRoundStep({
      state: {
        ...withFailedParry,
        selectedParticipantId: "guard",
        selectedStep: "phase_1_damage",
      },
      step: "phase_1_damage",
    });

    expect(afterD1Clear.participants[0]?.attackResults.phase1).toEqual(result);
    expect(afterD1Clear.phaseResolutionResults[0]?.parryResolution.status).toBe("resolved");
    expect(afterD1Clear.phaseResolutionResults[0]?.damageRoll.status).toBe("pending");
    expect(afterD1Clear.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "damage",
    });
    expect(afterD1Clear.selectedParticipantId).toBe("guard");
    expect(afterD1Clear.selectedStep).toBe("phase_1_damage");
  });

  it("phase2 cursor follows phase2 initiative and substeps", () => {
    const declared = declareRoundAction({
      actionId: "parry_attack",
      participantId: "guard",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const state = addReactivePhase1IncomingAttacksForDeclarations(declared);
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [2], rollTotal: 2, total: 2 },
      participantId: "gladiator",
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [5],
          rollTotal: 5,
          total: 5,
        },
        participantId: "guard",
        phase: "phase2",
        state,
      }),
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "parry_attack",
      attackerParticipantId: "guard",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase2",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Long sword",
    });
    const afterMiss = recordCombatRoundAttackResult({
      participantId: "guard",
      result,
      state: withCursor,
      submittedBy: "gm",
    });

    expect(withCursor.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase2",
      substep: "attack",
    });
    expect(afterMiss.phaseResolutionCursor).toBeUndefined();
    expect(afterMiss.currentCursor).toEqual({
      participantId: "guard",
      roundNumber: 3,
      step: "A2",
    });
    expect(afterMiss.currentStep).toBe("phase_2_actions");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "guard",
        phase: "phase2",
        state: afterMiss,
      }).substep,
    ).toBe("done");
  });

  it("detects phase attack availability from the declared phase model", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withAttackParry = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const withParryAttack = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        roundNumber: 3,
      },
      participantId: "guard",
      state: withAttackParry,
      submittedBy: "gm",
    });
    const withDoubleAttack = recordCombatRoundDeclaration({
      declaration: {
        actionId: "double_attack",
        roundNumber: 3,
      },
      participantId: "scout",
      state: initializeCombatRoundState({
        encounter: encounter({
          participants: [participant({ id: "scout", label: "Scout" })],
        }),
      }),
      submittedBy: "gm",
    });

    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: withParryAttack,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: withParryAttack,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "guard",
        phase: "phase1",
        state: withParryAttack,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "guard",
        phase: "phase2",
        state: withParryAttack,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "scout",
        phase: "phase1",
        state: withDoubleAttack,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "scout",
        phase: "phase2",
        state: withDoubleAttack,
      }),
    ).toBe(true);
  });

  it("publishes currentCursor when phase resolution opens an attack task", () => {
    const withCursor = preparePhaseResolutionState({
      guardActionId: "attack_parry",
      gladiatorActionId: "attack_parry",
      phase: "phase1",
    });

    expect(withCursor.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase1",
      substep: "attack",
    });
    expect(withCursor.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(withCursor.currentStep).toBe("phase_1_actions");
    expect(withCursor.selectedParticipantId).toBe("gladiator");
    expect(withCursor.selectedStep).toBe("phase_1_actions");
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: withCursor,
      }),
    ).toBe(true);
  });

  it("waits for GM progression when phase one has no executable attackers", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withDeclaration = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        roundNumber: 3,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const withCursor = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state: withDeclaration,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(withCursor.phaseResolutionCursor).toBeUndefined();
    expect(withCursor.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "A1",
    });
    expect(withCursor.currentStep).toBe("phase_1_actions");
    expect(withCursor.selectedParticipantId).toBe("gladiator");
    expect(withCursor.selectedStep).toBe("phase_1_actions");
  });

  it("advances parry and damage placeholders before completing effects review", () => {
    const state = declareRoundAction({
      actionId: "attack_parry",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "gladiator",
      result,
      state,
      submittedBy: "gm",
    });
    const afterParry = advanceCombatRoundPhaseResolutionSubstepForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterAttack,
      updatedAt: "2026-01-01T00:06:00.000Z",
    });
    const afterDamage = advanceCombatRoundPhaseResolutionSubstepForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterParry,
      updatedAt: "2026-01-01T00:07:00.000Z",
    });
    const afterEffects = completeCombatRoundPhaseResolutionForParticipant({
      participantId: "gladiator",
      phase: "phase1",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:08:00.000Z",
    });

    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterParry,
      }).substep,
    ).toBe("damage");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterDamage,
      }).substep,
    ).toBe("effects");
    expect(
      getCombatRoundPhaseResolutionStatus({
        participantId: "gladiator",
        phase: "phase1",
        state: afterEffects,
      }).substep,
    ).toBe("done");
  });

  it("rolls open-ended d6 initiative", () => {
    const openedOnceValues = [5 / 6, 1 / 6];
    const openedTwiceValues = [5 / 6, 5 / 6, 3 / 6];
    const singleRoll = rollOpenEndedD6({ randomFn: () => 2 / 6 });
    const openedOnce = rollOpenEndedD6({
      randomFn: () => openedOnceValues.shift() ?? 0,
    });
    const openedTwice = rollOpenEndedD6({
      randomFn: () => openedTwiceValues.shift() ?? 0,
    });

    expect(singleRoll).toMatchObject({ isOpenEnded: false, rolls: [3], total: 3 });
    expect(openedOnce).toMatchObject({ isOpenEnded: true, rolls: [6, 2], total: 8 });
    expect(openedTwice).toMatchObject({ isOpenEnded: true, rolls: [6, 6, 4], total: 16 });
  });

  it("combines initiative base with open-ended die roll total", () => {
    expect(
      buildCombatRoundInitiativeResult({
        baseInitiative: 3,
        roll: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6, 4],
          rollTotal: 10,
          total: 10,
        },
      }),
    ).toEqual({
      baseInitiative: 3,
      modifierAdjustment: 0,
      rolls: [6, 4],
      rollTotal: 10,
      total: 13,
    });

    expect(
      buildCombatRoundInitiativeResult({
        baseInitiative: 3,
        modifierAdjustment: -1,
        roll: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6, 4],
          rollTotal: 10,
          total: 10,
        },
      }),
    ).toEqual({
      baseInitiative: 3,
      modifierAdjustment: -1,
      rolls: [6, 4],
      rollTotal: 10,
      total: 12,
    });
  });

  it("guards open-ended initiative against endless sixes", () => {
    const result = rollOpenEndedD6({ maxRolls: 3, randomFn: () => 0.999 });

    expect(result.rolls).toEqual([6, 6, 6]);
    expect(result.total).toBe(18);
  });

  it("records participant step reviews without creating modifier data", () => {
    const state = advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() }));
    const reviewed = recordCombatRoundParticipantStepReview({
      participantId: "gladiator",
      state,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });

    expect(state.participants[0]?.stepStatuses.review_action_modifiers).toBe("pending");
    expect(reviewed.participants[0]?.stepStatuses.review_action_modifiers).toBe("gmEdited");
    expect(reviewed.participants[1]?.stepStatuses.review_action_modifiers).toBe("pending");
  });

  it("allows player initiative only on the matching open initiative step", () => {
    const state = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: encounter() })),
    );

    expect(state.currentStep).toBe("initiative_phase_1");
    expect(
      canPlayerRollCombatInitiative({ participantId: "gladiator", phase: "phase1", state }),
    ).toBe(true);
    expect(
      canPlayerRollCombatInitiative({ participantId: "gladiator", phase: "phase2", state }),
    ).toBe(false);
  });

  it("marks phase initiative complete only after every participant is rolled or non-pending", () => {
    const baseState = initializeCombatRoundState({ encounter: encounter() });
    const withGladiatorInitiative = recordCombatRoundInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "gladiator",
      phase: "phase1",
      state: baseState,
      submittedBy: "player",
    });

    expect(
      isCombatRoundPhaseInitiativeComplete({
        phase: "phase1",
        state: withGladiatorInitiative,
      }),
    ).toBe(false);

    const withSkippedGuard = setCombatRoundParticipantStepStatus({
      participantId: "guard",
      state: withGladiatorInitiative,
      status: "skipped",
      step: "initiative_phase_1",
    });

    expect(
      isCombatRoundPhaseInitiativeComplete({
        phase: "phase1",
        state: withSkippedGuard,
      }),
    ).toBe(true);
  });

  it("opens the next executable A1 actor when the phase-one initiative winner has no A1", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "attack_parry",
      gladiatorActionId: "parry_attack",
      phase: "phase1",
    });

    expect(state.currentStep).toBe("phase_1_actions");
    expect(state.currentCursor).toMatchObject({
      participantId: "guard",
      step: "A1",
    });
    expect(state.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "guard",
        phase: "phase1",
        state,
      }),
    ).toBe(true);
  });

  it("waits for GM progression when phase-one initiative has no A1 actors", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "parry_attack",
      gladiatorActionId: "parry_attack",
      phase: "phase1",
    });

    expect(state.currentStep).toBe("phase_1_actions");
    expect(state.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "A1",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
  });

  it("opens A1 for a valid Double Attack participant after phase-one initiative", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "parry_attack",
      gladiatorActionId: "double_attack",
      phase: "phase1",
    });

    expect(state.currentStep).toBe("phase_1_actions");
    expect(state.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "A1",
    });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase1",
        state,
      }),
    ).toBe(true);
  });

  it("repairs an unsupported stale A1 after completed i1 to the next A1 instead of i1", () => {
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const withGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: withDeclarations,
      submittedBy: "gm",
    });
    const withCompleteInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "guard",
      phase: "phase1",
      state: withGladiatorInitiative,
      submittedBy: "gm",
    });
    const staleState = combatRoundStateSchema.parse({
      ...withCompleteInitiative,
      currentCursor: {
        participantId: "gladiator",
        roundNumber: withCompleteInitiative.roundNumber,
        step: "A1",
      },
      currentStep: "phase_1_actions",
      phaseResolutionCursor: {
        participantId: "gladiator",
        phase: "phase1",
        substep: "attack",
      },
      selectedParticipantId: "gladiator",
      selectedStep: "phase_1_actions",
    });
    const repaired = initializeCombatRoundState({
      encounter: encounter({ combatRoundState: staleState }),
    });

    expect(repaired.currentStep).toBe("phase_1_actions");
    expect(repaired.currentCursor).toMatchObject({
      participantId: "guard",
      step: "A1",
    });
    expect(repaired.phaseResolutionCursor).toEqual({
      participantId: "guard",
      phase: "phase1",
      substep: "attack",
    });
  });

  it("keeps Reactive attack A2 closed when no phase-one attack was received", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "parry_attack",
      gladiatorActionId: "parry_attack",
      phase: "phase2",
      reactivePhase1Incoming: false,
    });

    expect(state.currentStep).toBe("phase_2_actions");
    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(
      combatRoundParticipantWasAttackedInPhase({
        participantId: "gladiator",
        phase: "phase1",
        state,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state,
      }),
    ).toBe(false);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase2",
        state,
      }),
    ).toBe(false);
    expect(getPlayerCombatCurrentRollAction({ participantId: "gladiator", state })).toBeUndefined();
  });

  it("opens A2 for a Reactive attack participant after a phase-one attack was received", () => {
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const withIncomingAttack = addPhase1IncomingAttack({
      attackResult: buildTestPhase1AttackResult({ hit: false }),
      state: withDeclarations,
    });
    const withInitiatives = setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "guard",
      phase: "phase2",
      state: setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [6],
          rollTotal: 6,
          total: 6,
        },
        participantId: "gladiator",
        phase: "phase2",
        state: withIncomingAttack,
      }),
    });
    const state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase2",
      state: withInitiatives,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    expect(state.currentStep).toBe("phase_2_actions");
    expect(state.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "A2",
    });
    expect(state.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "attack",
    });
    expect(
      combatRoundParticipantWasAttackedInPhase({
        participantId: "gladiator",
        phase: "phase1",
        state,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase2",
        state,
      }),
    ).toBe(true);
    expect(getPlayerCombatCurrentRollAction({ participantId: "gladiator", state })).toMatchObject({
      kind: "attack",
      phase: "phase2",
    });
  });

  it("keeps a triggering miss and Reactive A2 eligibility when phase-two modifiers are reviewed", () => {
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const withIncomingAttack = addPhase1IncomingAttack({
      attackResult: buildTestPhase1AttackResult({ hit: false }),
      state: withDeclarations,
    });
    const atPhase2Review = combatRoundStateSchema.parse({
      ...withIncomingAttack,
      currentStep: "review_phase_2_modifiers",
      selectedParticipantId: "guard",
      selectedStep: "review_phase_2_modifiers",
    });
    const guardDeclaration = atPhase2Review.participants.find(
      (participant) => participant.participantId === "guard",
    )?.declaration;
    const reviewed = recordCombatRoundDeclaration({
      declaration: guardDeclaration,
      participantId: "guard",
      state: atPhase2Review,
      submittedBy: "gm",
    });

    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "guard",
        phase: "phase1",
        state: reviewed,
      }),
    ).toMatchObject({ hit: false });
    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state: reviewed,
      }),
    ).toMatchObject({
      category: "no_hit_no_parry_needed",
      value: 6,
    });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: reviewed,
      }),
    ).toBe(true);
  });

  it("does not open Reactive A2 for an incoming attack from a different target", () => {
    const participants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
      participant({ id: "archer", label: "Archer" }),
    ];
    const baseState = initializeCombatRoundState({
      encounter: encounter({ participants }),
    });
    const withDeclaration = recordCombatRoundDeclaration({
      declaration: {
        actionId: "parry_attack",
        phaseContexts: {
          phase2: testPhaseContext("guard"),
        },
        roundNumber: baseState.roundNumber,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const attackedByArcher = addPhase1IncomingAttack({
      attackResult: buildTestPhase1AttackResult({
        attackerParticipantId: "archer",
        defenderParticipantId: "gladiator",
        hit: false,
      }),
      state: withDeclaration,
    });

    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state: attackedByArcher,
      }),
    ).toBeUndefined();
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: attackedByArcher,
      }),
    ).toBe(false);
  });

  it("keeps persisted Single attack vs Reactive attack on Scyrian A2 after A1 is recorded", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
    ];
    const baseState = initializeCombatRoundState({
      encounter: encounter({ currentRound: 2, participants: encounterParticipants }),
    });
    const withDeclarations = declareTestRoundAction({
      actionId: "parry_attack",
      participantId: "scyrian",
      phase1Target: "scenario-gladiator",
      phase2Target: "scenario-gladiator",
      state: declareTestRoundAction({
        actionId: "attack_parry",
        participantId: "gladiator",
        phase1Target: "scenario-scyrian",
        phase2Target: "scenario-scyrian",
        state: baseState,
      }),
    });
    const atI1 = advanceToStep(withDeclarations, "initiative_phase_1");
    const withGladiatorI1 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [6, 1],
        rollTotal: 7,
        total: 7,
      },
      participantId: "gladiator",
      phase: "phase1",
      state: atI1,
      submittedBy: "gm",
    });
    const atI1Review = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [6, 6],
        rollTotal: 12,
        total: 12,
      },
      participantId: "scyrian",
      phase: "phase1",
      state: withGladiatorI1,
      submittedBy: "gm",
    });
    const atA1 = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:02:45.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase1",
      state: atI1Review,
    }).state;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 13,
      defenderParticipantId: "scyrian",
      ob: 10,
      phase: "phase1",
      rollD20: 5,
      rollTotal: 5,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const afterA1 = recordCombatRoundAttackResult({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      result: attackResult,
      state: atA1,
      submittedBy: "gm",
    });
    const attackEnvelope = buildCombatRoundCommandEnvelope({
      latestResult: {
        attackResultId: "2:phase1:gladiator:scyrian",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "scyrian",
        kind: "attack",
        phase: "phase1",
      },
      state: afterA1,
    });
    const reloadedAfterA1 = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: afterA1,
        currentRound: 2,
        participants: encounterParticipants,
      }),
    });
    const scyrianReactiveModifier = reloadedAfterA1.participants
      .find((participant) => participant.participantId === "scyrian")
      ?.declaration?.combatContext?.modifierBuckets.situationInitiative.find(
        (entry) => entry.id === REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
      );
    const atM2 = advanceBoundary(reloadedAfterA1, "phase1_resolution", "phase2_modifier_review");

    expect(atI1Review.currentStep).toBe("initiative_phase_1");
    expect(
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: "phase1",
        state: atI1Review,
      }),
    ).toBe(true);
    expect(atA1.currentStep).toBe("phase_1_actions");
    expect(atA1.currentCursor).toMatchObject({ participantId: "gladiator", step: "A1" });
    expect(afterA1.currentStep).toBe("phase_1_actions");
    expect(attackEnvelope).toMatchObject({
      currentTask: {
        cursorStep: "A1",
        participantId: "gladiator",
        step: "phase_1_actions",
      },
      latestEvent: {
        resultId: "2:phase1:gladiator:scyrian",
        shortTitle: "Attack rolled",
      },
      latestResult: {
        attackResultId: "2:phase1:gladiator:scyrian",
        kind: "attack",
      },
    });
    expect(attackEnvelope).not.toHaveProperty("commands");
    expect(attackEnvelope).not.toHaveProperty("state");
    expect(afterA1.commands.at(-1)).toMatchObject({
      facts: {
        attackResultId: expect.stringContaining("phase1:gladiator:scyrian"),
        defenderParticipantId: "scyrian",
        hit: false,
        nextStepOpened: {
          participantId: "gladiator",
          step: "A1",
        },
      },
      participantId: "gladiator",
      step: "A1",
      type: "roll_attack",
    });
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: reloadedAfterA1,
      }),
    ).toMatchObject({
      defenderParticipantId: "scyrian",
      tableResult: "Miss",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: reloadedAfterA1,
        step: "phase_1_actions",
      }),
    ).toBe("gmEdited");
    expect(scyrianReactiveModifier).toMatchObject({
      generated: true,
      notes: "reactive attack: phase 1 attack missed; no parry needed",
      sourceActionId: "parry_attack",
      sourcePhase: "phase2",
      value: 6,
    });
    expect(
      combatRoundParticipantWasAttackedInPhase({
        participantId: "scyrian",
        phase: "phase1",
        state: reloadedAfterA1,
      }),
    ).toBe(true);

    const withGladiatorM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: atM2,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const withScyrianM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:40.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "scyrian",
      state: withGladiatorM2Reviewed,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const atI2 = advanceCombatRoundStep(withScyrianM2Reviewed);
    const withGladiatorI2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [6, 2],
        rollTotal: 8,
        total: 8,
      },
      participantId: "gladiator",
      phase: "phase2",
      state: atI2,
      submittedBy: "gm",
    });
    const afterI2Rolls = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 6, rolls: [6], rollTotal: 6, total: 12 },
      participantId: "scyrian",
      phase: "phase2",
      state: withGladiatorI2,
      submittedBy: "gm",
    });
    const reloadedAfterI2Rolls = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: afterI2Rolls,
        currentRound: 2,
        participants: encounterParticipants,
      }),
    });
    const afterI2Commit = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:04:45.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase2",
      state: reloadedAfterI2Rolls,
    }).state;
    const reloadedAfterI2 = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: afterI2Commit,
        currentRound: 2,
        participants: encounterParticipants,
      }),
    });

    expect(atI2.currentStep).toBe("initiative_phase_2");
    expect(reloadedAfterI2Rolls.currentStep).toBe("initiative_phase_2");
    expect(
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: "phase2",
        state: reloadedAfterI2Rolls,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "scyrian",
        phase: "phase2",
        state: reloadedAfterI2Rolls,
      }),
    ).toBe(false);
    expect(reloadedAfterI2.currentStep).toBe("phase_2_actions");
    expect(reloadedAfterI2.currentCursor).toMatchObject({
      participantId: "scyrian",
      step: "A2",
    });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "scyrian",
        phase: "phase2",
        state: reloadedAfterI2,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "scyrian",
        phase: "phase2",
        state: reloadedAfterI2,
      }),
    ).toBe(true);
  });

  it("keeps persisted Reactive attack vs Single attack on Gladiator A2 after incoming A1 is recorded", () => {
    const encounterParticipants = [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
    ];
    const baseState = initializeCombatRoundState({
      encounter: encounter({ currentRound: 4, participants: encounterParticipants }),
    });
    const withDeclarations = declareTestRoundAction({
      actionId: "attack_parry",
      participantId: "scyrian",
      phase1Target: "scenario-gladiator",
      phase2Target: "scenario-gladiator",
      state: declareTestRoundAction({
        actionId: "parry_attack",
        participantId: "gladiator",
        phase1Target: "scenario-scyrian",
        phase2Target: "scenario-scyrian",
        state: baseState,
      }),
    });
    const atI1 = advanceToStep(withDeclarations, "initiative_phase_1");
    const withGladiatorI1 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [6, 6],
        rollTotal: 12,
        total: 12,
      },
      participantId: "gladiator",
      phase: "phase1",
      state: atI1,
      submittedBy: "gm",
    });
    const atI1Review = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [6],
        rollTotal: 6,
        total: 6,
      },
      participantId: "scyrian",
      phase: "phase1",
      state: withGladiatorI1,
      submittedBy: "gm",
    });
    const atA1 = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:02:45.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase1",
      state: atI1Review,
    }).state;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "scyrian",
      defenderDb: 13,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase1",
      rollD20: 5,
      rollTotal: 5,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterA1 = recordCombatRoundAttackResult({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "scyrian",
      result: attackResult,
      state: atA1,
      submittedBy: "gm",
    });
    const reloadedAfterA1 = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: afterA1,
        currentRound: 4,
        participants: encounterParticipants,
      }),
    });
    const gladiatorReactiveModifier = reloadedAfterA1.participants
      .find((participant) => participant.participantId === "gladiator")
      ?.declaration?.combatContext?.modifierBuckets.situationInitiative.find(
        (entry) => entry.id === REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
      );
    const atM2 = advanceBoundary(reloadedAfterA1, "phase1_resolution", "phase2_modifier_review");

    expect(atI1Review.currentStep).toBe("initiative_phase_1");
    expect(
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: "phase1",
        state: atI1Review,
      }),
    ).toBe(true);
    expect(atA1.currentStep).toBe("phase_1_actions");
    expect(atA1.currentCursor).toMatchObject({ participantId: "scyrian", step: "A1" });
    expect(afterA1.currentStep).toBe("phase_1_actions");
    expect(afterA1.commands.at(-1)).toMatchObject({
      facts: {
        attackResultId: expect.stringContaining("phase1:scyrian:gladiator"),
        defenderParticipantId: "gladiator",
        hit: false,
        nextStepOpened: {
          participantId: "scyrian",
          step: "A1",
        },
      },
      participantId: "scyrian",
      step: "A1",
      type: "roll_attack",
    });
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "scyrian",
        phase: "phase1",
        state: reloadedAfterA1,
      }),
    ).toMatchObject({
      defenderParticipantId: "gladiator",
      tableResult: "Miss",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: reloadedAfterA1,
        step: "phase_1_actions",
      }),
    ).toBe("skipped");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "scyrian",
        state: reloadedAfterA1,
        step: "phase_1_actions",
      }),
    ).toBe("gmEdited");
    expect(gladiatorReactiveModifier).toMatchObject({
      generated: true,
      notes: "reactive attack: phase 1 attack missed; no parry needed",
      sourceActionId: "parry_attack",
      sourcePhase: "phase2",
      value: 6,
    });
    expect(
      combatRoundParticipantWasAttackedInPhase({
        participantId: "gladiator",
        phase: "phase1",
        state: reloadedAfterA1,
      }),
    ).toBe(true);

    const withGladiatorM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state: atM2,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const withScyrianM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:40.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "scyrian",
      state: withGladiatorM2Reviewed,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const atI2 = advanceCombatRoundStep(withScyrianM2Reviewed);
    const withScyrianI2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [5], rollTotal: 5, total: 5 },
      participantId: "scyrian",
      phase: "phase2",
      state: atI2,
      submittedBy: "gm",
    });
    const afterI2Rolls = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 6, rolls: [2], rollTotal: 2, total: 8 },
      participantId: "gladiator",
      phase: "phase2",
      state: withScyrianI2,
      submittedBy: "gm",
    });
    const reloadedAfterI2Rolls = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: afterI2Rolls,
        currentRound: 4,
        participants: encounterParticipants,
      }),
    });
    const afterI2Commit = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:04:45.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase2",
      state: reloadedAfterI2Rolls,
    });
    const i2CommitEnvelope = buildCombatRoundCommandEnvelope({
      latestResult: {
        kind: "phase_initiative_commit",
        phase: "phase2",
      },
      state: afterI2Commit.state,
    });
    const reloadedAfterI2 = initializeCombatRoundState({
      encounter: encounter({
        combatRoundState: afterI2Commit.state,
        currentRound: 4,
        participants: encounterParticipants,
      }),
    });

    expect(atI2.currentStep).toBe("initiative_phase_2");
    expect(reloadedAfterI2Rolls.currentStep).toBe("initiative_phase_2");
    expect(
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: "phase2",
        state: reloadedAfterI2Rolls,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: reloadedAfterI2Rolls,
      }),
    ).toBe(false);
    expect(i2CommitEnvelope).toMatchObject({
      currentTask: {
        cursorStep: "A2",
        participantId: "gladiator",
        step: "phase_2_actions",
      },
      latestResult: {
        kind: "phase_initiative_commit",
        phase: "phase2",
      },
    });
    expect(i2CommitEnvelope).not.toHaveProperty("commands");
    expect(i2CommitEnvelope).not.toHaveProperty("state");
    expect(reloadedAfterI2.currentStep).toBe("phase_2_actions");
    expect(reloadedAfterI2.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "A2",
    });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: reloadedAfterI2,
      }),
    ).toBe(true);
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: reloadedAfterI2,
      }),
    ).toBe(true);
  });

  it("calculates Reactive attack phase-two initiative from a missed phase-one attack", () => {
    const state = addPhase1IncomingAttack({
      attackResult: buildTestPhase1AttackResult({ hit: false }),
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });

    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state,
      }),
    ).toMatchObject({
      category: "no_hit_no_parry_needed",
      value: 6,
    });
  });

  it("calculates Reactive attack phase-two initiative from parry margins", () => {
    const attackResult = buildTestPhase1AttackResult({ hit: true });
    const baseState = declareRoundAction({
      actionId: "parry_attack",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const highMarginState = addPhase1IncomingAttack({
      attackResult,
      parryResolution: {
        openEndedD10s: [],
        purpose: "ordinary_defense",
        resultLabel: "Parry successful",
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 27,
      },
      state: baseState,
    });
    const lowMarginState = addPhase1IncomingAttack({
      attackResult,
      parryResolution: {
        openEndedD10s: [],
        purpose: "ordinary_defense",
        resultLabel: "Parry successful",
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 25,
      },
      state: baseState,
    });

    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state: highMarginState,
      }),
    ).toMatchObject({
      category: "no_hit_parry_margin_6_plus",
      parryMargin: 6,
      value: 6,
    });
    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state: lowMarginState,
      }),
    ).toMatchObject({
      category: "no_hit_parry_margin_0_to_5",
      parryMargin: 4,
      value: 0,
    });
  });

  it("persists a zero Reactive attack phase-two initiative modifier after a low parry margin", () => {
    const attackResult = buildTestPhase1AttackResult({ hit: true });
    const withDeclarations = declareRoundAction({
      actionId: "attack_parry",
      participantId: "guard",
      state: declareRoundAction({
        actionId: "parry_attack",
        participantId: "gladiator",
        state: initializeCombatRoundState({ encounter: encounter() }),
      }),
    });
    const afterAttack = recordCombatRoundAttackResult({
      participantId: "guard",
      result: attackResult,
      state: withDeclarations,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResolution({
      attackResult,
      parryResolution: {
        openEndedD10s: [],
        resultLabel: "Parry successful",
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 25,
      },
      state: afterAttack,
      updatedAt: "2026-01-01T00:03:00.000Z",
    });
    const reactiveModifier = afterParry.participants
      .find((participant) => participant.participantId === "gladiator")
      ?.declaration?.combatContext?.modifierBuckets.situationInitiative.find(
        (entry) => entry.id === REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
      );

    expect(reactiveModifier).toMatchObject({
      generated: true,
      notes: "reactive attack: phase 1 parry succeeded by 4",
      sourceActionId: "parry_attack",
      sourcePhase: "phase2",
      value: 0,
    });
  });

  it("calculates Reactive attack phase-two initiative from hit and critical outcomes", () => {
    const attackResult = buildTestPhase1AttackResult({ hit: true });
    const baseState = declareRoundAction({
      actionId: "parry_attack",
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
    });
    const hitState = addPhase1IncomingAttack({
      attackResult,
      parryResolution: {
        openEndedD10s: [],
        purpose: "ordinary_defense",
        resultLabel: "Parry failed",
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 16,
      },
      state: baseState,
    });
    const damageResult = buildCombatRoundDamageResult({
      armorModifier: 0,
      attackResult,
      createdAt: "2026-01-01T00:04:00.000Z",
      defenderDm: 0,
      dmb: 8,
      hitLocationSelection: fixedChestLocationSelection(),
      roundNumber: baseState.roundNumber,
    });
    const criticalState = addPhase1IncomingAttack({
      attackResult,
      damageResult,
      parryResolution: {
        openEndedD10s: [],
        purpose: "ordinary_defense",
        resultLabel: "Parry failed",
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 16,
      },
      state: baseState,
    });

    expect(damageResult.criticalGrade).toBe("b");
    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state: hitState,
      }),
    ).toMatchObject({
      category: "hit",
      value: -3,
    });
    expect(
      getReactiveAttackPhase2InitiativeModifier({
        participantId: "gladiator",
        state: criticalState,
      }),
    ).toMatchObject({
      category: "critical_hit",
      value: -6,
    });
  });

  it("opens A2 for a valid Double Attack participant after phase-two initiative", () => {
    const state = preparePhaseResolutionState({
      guardActionId: "double_attack",
      gladiatorActionId: "double_attack",
      phase: "phase2",
    });

    expect(state.currentStep).toBe("phase_2_actions");
    expect(state.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "A2",
    });
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state,
      }),
    ).toBe(true);
  });

  it("reopens a valid Round 5 A2 actor after stale phase-two done state survives backtracking to i2", () => {
    const baseState = initializeCombatRoundState({
      encounter: encounter({ currentRound: 5 }),
    });
    const withGladiatorDeclaration = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "parry_attack",
        phaseContexts: {
          phase1: testPhaseContext("guard"),
          phase2: testPhaseContext("guard"),
        },
        roundNumber: 5,
      },
      participantId: "gladiator",
      state: baseState,
      submittedBy: "gm",
    });
    const withGuardDeclaration = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:30.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("gladiator"),
          phase2: testPhaseContext("gladiator"),
        },
        roundNumber: 5,
      },
      participantId: "guard",
      state: withGladiatorDeclaration,
      submittedBy: "gm",
    });
    const withIncomingAttack = addPhase1IncomingAttack({
      attackResult: buildTestPhase1AttackResult({ hit: false }),
      state: withGuardDeclaration,
    });
    const withGladiatorI2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase2",
      state: withIncomingAttack,
      submittedBy: "gm",
    });
    const withGuardI2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:30.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "guard",
      phase: "phase2",
      state: withGladiatorI2,
      submittedBy: "gm",
    });
    const staleBacktrackedI2State = combatRoundStateSchema.parse({
      ...withGuardI2,
      currentCursor: {
        participantId: "gladiator",
        roundNumber: 5,
        step: "i2",
      },
      currentStep: "initiative_phase_2",
      phaseResolutionCursor: {
        participantId: "gladiator",
        phase: "phase2",
        substep: "attack",
      },
      phaseResolutionStatuses: {
        ...withGuardI2.phaseResolutionStatuses,
        gladiator: {
          ...withGuardI2.phaseResolutionStatuses.gladiator,
          phase2: {
            substep: "done",
            updatedAt: "2026-01-01T00:03:00.000Z",
          },
        },
      },
      participants: withGuardI2.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                phase_2_actions: "complete" as const,
              },
            }
          : participant,
      ),
      roundNumber: 5,
      rounds: [1, 2, 3, 4].map((roundNumber) => ({
        currentStep: "round_summary" as const,
        participants: withGuardI2.participants,
        roundNumber,
      })),
      selectedParticipantId: "gladiator",
      selectedStep: "initiative_phase_2",
    });

    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: staleBacktrackedI2State,
      }),
    ).toBe(true);
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "gladiator",
        state: staleBacktrackedI2State,
        step: "phase_2_actions",
      }),
    ).toBe("pending");

    const advanced = advanceCombatRoundStep(staleBacktrackedI2State, {
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
    });

    expect(advanced.roundNumber).toBe(5);
    expect(advanced.currentStep).toBe("phase_2_actions");
    expect(advanced.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 5,
      step: "A2",
    });
    expect(advanced.phaseResolutionCursor).toEqual({
      participantId: "gladiator",
      phase: "phase2",
      substep: "attack",
    });
    expect(advanced.phaseResolutionStatuses.gladiator?.phase2?.substep).toBe("attack");
    expect(
      advanced.participants.find((participant) => participant.participantId === "gladiator")
        ?.stepStatuses.phase_2_actions,
    ).toBe("pending");
    expect(advanced.rounds.map((round) => round.roundNumber)).toEqual([1, 2, 3, 4]);
  });

  it("allows player attack only for the current unresolved attack cursor and rejects duplicates", () => {
    const openState = preparePhaseResolutionState({
      guardActionId: "attack_parry",
      gladiatorActionId: "attack_parry",
      phase: "phase1",
    });

    expect(openState.currentStep).toBe("phase_1_actions");
    expect(openState.currentCursor).toMatchObject({
      participantId: "gladiator",
      step: "A1",
    });
    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: openState,
      }),
    ).toBe(true);

    const submittedMarkerOpenState = {
      ...openState,
      participants: openState.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                phase_1_actions: "submitted" as const,
              },
            }
          : participant,
      ),
    };

    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: submittedMarkerOpenState,
      }),
    ).toBe(true);

    const phase2PreparedState = preparePhaseResolutionState({
      guardActionId: "parry_attack",
      gladiatorActionId: "parry_attack",
      phase: "phase2",
    });
    const phase2OpenState = {
      ...phase2PreparedState,
      currentCursor: {
        participantId: "gladiator",
        roundNumber: phase2PreparedState.roundNumber,
        step: "A2" as const,
      },
      currentStep: "phase_2_actions" as const,
      participants: phase2PreparedState.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              stepStatuses: {
                ...participant.stepStatuses,
                phase_2_actions: "submitted" as const,
              },
            }
          : participant,
      ),
      selectedParticipantId: "gladiator",
      selectedStep: "phase_2_actions" as const,
    };

    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase2",
        state: phase2OpenState,
      }),
    ).toBe(true);

    expect(
      canPlayerRollCombatAttack({
        participantId: "guard",
        phase: "phase1",
        state: openState,
      }),
    ).toBe(false);

    const result = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: result.rolledAt,
      },
      participantId: "gladiator",
      result,
      state: openState,
      submittedBy: "player",
    });

    expect(
      canPlayerRollCombatAttack({
        participantId: "gladiator",
        phase: "phase1",
        state: afterAttack,
      }),
    ).toBe(false);
    expect(() =>
      recordCombatRoundAttackResult({
        command: {
          createdAt: "2026-01-01T00:05:01.000Z",
        },
        participantId: "gladiator",
        result: {
          ...result,
          rolledAt: "2026-01-01T00:05:01.000Z",
        },
        state: afterAttack,
        submittedBy: "player",
      }),
    ).toThrow("Attack already rolled for this participant and phase.");
  });

  it("selects player roll privilege from the authoritative current cursor", () => {
    const openState = preparePhaseResolutionState({
      guardActionId: "attack_parry",
      gladiatorActionId: "attack_parry",
      phase: "phase1",
    });

    expect(
      getPlayerCombatCurrentRollAction({ participantId: "gladiator", state: openState }),
    ).toMatchObject({
      kind: "attack",
      phase: "phase1",
      step: "A1",
    });
    expect(getPlayerCombatCurrentRollAction({ participantId: "guard", state: openState })).toBe(
      undefined,
    );

    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
      },
      participantId: "gladiator",
      result: attackResult,
      state: openState,
      submittedBy: "player",
    });

    expect(
      getPlayerCombatCurrentRollAction({ participantId: "guard", state: afterAttack }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      kind: "parry",
      phase: "phase1",
      step: "P1",
    });
    expect(
      getPlayerCombatCurrentRollAction({ participantId: "gladiator", state: afterAttack }),
    ).toBe(undefined);

    const afterParry = recordCombatRoundParryResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:06:00.000Z",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "player",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });

    expect(
      getPlayerCombatCurrentRollAction({ participantId: "gladiator", state: afterParry }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      kind: "hit_location",
      phase: "phase1",
      step: "D1",
    });
    expect(getPlayerCombatCurrentRollAction({ participantId: "guard", state: afterParry })).toBe(
      undefined,
    );

    const afterLocation = recordTestHitLocation({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:06:30.000Z",
      },
      state: afterParry,
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:07:00.000Z",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:07:00.000Z",
    });

    expect(
      getPlayerCombatCurrentRollAction({ participantId: "gladiator", state: afterDamage }),
    ).toMatchObject({
      attackResultId: "3:phase1:gladiator:guard",
      kind: "critical",
      phase: "phase1",
      step: "D1",
    });
  });

  it("unwinds command-backed multiplayer round history back to the first declaration", () => {
    let state = initializeCombatRoundState({ encounter: encounter() });

    state = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "player-1",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("guard"),
        },
        roundNumber: 3,
        submittedAt: "2026-01-01T00:01:00.000Z",
        submittedByUserId: "player-1",
      },
      participantId: "gladiator",
      state,
      submittedBy: "player",
    });
    state = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:10.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testPhaseContext("gladiator"),
        },
        roundNumber: 3,
        submittedAt: "2026-01-01T00:01:10.000Z",
        submittedByUserId: "gm-1",
      },
      participantId: "guard",
      state,
      submittedBy: "gm",
    });
    state = advanceCombatRoundStep(state);
    state = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "gladiator",
      state,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    state = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:02:10.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "guard",
      state,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    state = advanceCombatRoundStep(state);
    state = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state,
      submittedBy: "player",
    });
    state = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:03:10.000Z",
        createdByUserId: "gm-1",
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [4], rollTotal: 4, total: 4 },
      participantId: "guard",
      phase: "phase1",
      state,
      submittedBy: "gm",
    });
    state = initializeCombatRoundPhaseResolutionCursor({
      phase: "phase1",
      state,
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "gladiator",
      defenderDb: 10,
      defenderParticipantId: "guard",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:05:00.000Z",
      weaponName: "Broad sword",
    });
    state = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        createdByUserId: "player-1",
      },
      participantId: "gladiator",
      result: attackResult,
      state,
      submittedBy: "player",
    });
    state = recordCombatRoundParryResult({
      attackResult,
      command: {
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "player-2",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry successful",
        rollD20: 16,
        rollTotal: 16,
        status: "resolved",
        success: true,
        targetNumber: 21,
        total: 25,
      },
      state,
      submittedBy: "player",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });

    expect(state.commands.map((command) => command.type)).toEqual([
      "declare_action",
      "declare_action",
      "review_modifiers_phase1",
      "review_modifiers_phase1",
      "roll_initiative_phase1",
      "roll_initiative_phase1",
      "roll_attack",
      "roll_parry",
    ]);

    while (state.commands.length > 0) {
      const previousCommandCount = state.commands.length;

      state = clearCombatRoundStep({ state, step: state.currentStep });

      expect(state.commands.length).toBe(previousCommandCount - 1);
      if (state.currentCursor?.participantId) {
        expect(
          state.participants.some(
            (participant) => participant.participantId === state.currentCursor?.participantId,
          ),
        ).toBe(true);
      }
    }

    expect(state.currentStep).toBe("select_actions");
    expect(state.currentCursor).toEqual({
      participantId: "gladiator",
      roundNumber: 3,
      step: "DE",
    });
    expect(state.participants[0]?.declaration).toBeUndefined();
    expect(state.participants[1]?.declaration).toBeUndefined();
    expect(state.participants[0]?.initiatives.phase1).toBeUndefined();
    expect(state.participants[1]?.initiatives.phase1).toBeUndefined();
    expect(state.participants[0]?.attackResults.phase1).toBeUndefined();
    expect(state.phaseResolutionResults).toEqual([]);
  });

  it("locks pending declarations when advancing past DE while preserving submitted markers", () => {
    const state = recordCombatRoundDeclaration({
      participantId: "gladiator",
      state: initializeCombatRoundState({ encounter: encounter() }),
      submittedBy: "player",
    });
    const nextState = advanceCombatRoundStep(state);

    expect(nextState.currentStep).toBe("review_action_modifiers");
    expect(nextState.participants[0]?.stepStatuses.select_actions).toBe("submitted");
    expect(nextState.participants[1]?.stepStatuses.select_actions).toBe("locked");
    expect(canPlayerSubmitCombatDeclaration({ participantId: "guard", state: nextState })).toBe(
      false,
    );
  });

  it("sorts participants by phase initiative values when available", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const withGuardInitiative = setCombatRoundParticipantInitiative({
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state,
    });
    const withGladiatorInitiative = setCombatRoundParticipantInitiative({
      initiative: 18,
      participantId: "gladiator",
      phase: "phase1",
      state: withGuardInitiative,
    });

    expect(
      sortCombatRoundParticipantsByInitiative({
        phase: "phase1",
        state: withGladiatorInitiative,
      }).map((entry) => entry.participantId),
    ).toEqual(["gladiator", "guard"]);
  });

  it("sorts unrolled participants below rolled initiatives and assigns positions only to rolled participants", () => {
    const state = setCombatRoundParticipantInitiative({
      initiative: 12,
      participantId: "guard",
      phase: "phase1",
      state: initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
          ],
        }),
      }),
    });

    expect(
      sortCombatRoundParticipantsByInitiative({
        phase: "phase1",
        state,
      }).map((entry) => entry.participantId),
    ).toEqual(["guard", "gladiator", "scyrian"]);
    expect(getCombatRoundInitiativePositions({ phase: "phase1", state })).toEqual({
      guard: 1,
    });
    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toEqual({
      guard: {
        rank: 1,
        rankTotal: 1,
        tiedCount: 1,
      },
    });
  });

  it("assigns shared initiative ranks to tied participants", () => {
    const state = [
      ["gladiator", 4],
      ["guard", 4],
    ].reduce(
      (nextState, [participantId, initiative]) =>
        setCombatRoundParticipantInitiative({
          initiative: initiative as number,
          participantId: participantId as string,
          phase: "phase1",
          state: nextState,
        }),
      initializeCombatRoundState({ encounter: encounter() }),
    );

    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toEqual({
      gladiator: {
        rank: 1,
        rankTotal: 2,
        tiedCount: 2,
      },
      guard: {
        rank: 1,
        rankTotal: 2,
        tiedCount: 2,
      },
    });
  });

  it("uses competition ranking after initiative ties", () => {
    const state = [
      ["gladiator", 4],
      ["guard", 4],
      ["scyrian", 2],
    ].reduce(
      (nextState, [participantId, initiative]) =>
        setCombatRoundParticipantInitiative({
          initiative: initiative as number,
          participantId: participantId as string,
          phase: "phase1",
          state: nextState,
        }),
      initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
          ],
        }),
      }),
    );

    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toEqual({
      gladiator: {
        rank: 1,
        rankTotal: 3,
        tiedCount: 2,
      },
      guard: {
        rank: 1,
        rankTotal: 3,
        tiedCount: 2,
      },
      scyrian: {
        rank: 3,
        rankTotal: 3,
        tiedCount: 1,
      },
    });
  });

  it("skips ranks after lower-position initiative ties", () => {
    const state = [
      ["gladiator", 6],
      ["guard", 4],
      ["scyrian", 4],
      ["archer", 2],
    ].reduce(
      (nextState, [participantId, initiative]) =>
        setCombatRoundParticipantInitiative({
          initiative: initiative as number,
          participantId: participantId as string,
          phase: "phase1",
          state: nextState,
        }),
      initializeCombatRoundState({
        encounter: encounter({
          participants: [
            participant({ id: "gladiator", label: "The Gladiator" }),
            participant({ id: "guard", label: "City guard" }),
            participant({ id: "scyrian", label: "Scyrian cavalry guy" }),
            participant({ id: "archer", label: "Another guard" }),
          ],
        }),
      }),
    );

    expect(getCombatRoundInitiativeRanks({ phase: "phase1", state })).toMatchObject({
      gladiator: {
        rank: 1,
        rankTotal: 4,
        tiedCount: 1,
      },
      guard: {
        rank: 2,
        rankTotal: 4,
        tiedCount: 2,
      },
      scyrian: {
        rank: 2,
        rankTotal: 4,
        tiedCount: 2,
      },
      archer: {
        rank: 4,
        rankTotal: 4,
        tiedCount: 1,
      },
    });
  });

  it("builds inspector data for the selected participant and step", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const nextState = advanceCombatRoundStep(state);
    const inspector = buildCombatRoundInspector({
      participantId: "gladiator",
      state: nextState,
      step: "select_actions",
    });

    expect(inspector.participant?.label).toBe("The Gladiator");
    expect(inspector.step).toBe("select_actions");
    expect(inspector.status).toBe("locked");
  });

  it("keeps phase-owned inspector work ownerless", () => {
    const state = initializeCombatRoundState({ encounter: encounter() });
    const inspector = buildCombatRoundInspector({
      state,
      step: "select_actions",
    });

    expect(inspector.participant).toBeUndefined();
    expect(inspector.snapshot).toBeUndefined();
    expect(inspector.status).toBeUndefined();
  });

  it("does not alter combat effects or action log when advancing round steps", () => {
    const session = encounter({
      actionLog: [
        {
          attackRoll: { baseOb: 10, defenseTarget: 5, hit: true, margin: 5, roll: 50, total: 60 },
          attackerParticipantId: "gladiator",
          declaration: {
            actionType: "attack",
            defenseFocus: "none",
            defensePosture: "none",
            targetLocation: "any",
          },
          defenderParticipantId: "guard",
          defense: {
            dbApplied: false,
            dbValue: 0,
            defending: false,
            parryAttempted: false,
            parryBase: 0,
            parrySucceeded: false,
          },
          encounterId: "encounter-1",
          id: "attack-1",
          order: 0,
          outcome: "hit",
          resolvedAt: "2026-01-01T00:00:00.000Z",
          roundNumber: 3,
        },
      ],
    });
    const state = initializeCombatRoundState({ encounter: session });
    const nextState = advanceCombatRoundStep(state);
    const nextSession = encounterSessionSchema.parse({
      ...session,
      combatRoundState: nextState,
    });

    expect(nextSession.actionLog).toEqual(session.actionLog);
    expect(nextSession.combatRoundState?.currentStep).toBe("review_action_modifiers");
  });

  it("cancels and undoes Double Attack 2 without creating a second phase-2 scheduler", () => {
    const basePhaseContexts = {
      phase1: testPhaseContext("guard"),
      phase2: testPhaseContext("guard"),
    };
    const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "double_attack",
      participantId: "hero",
      phaseContexts: basePhaseContexts,
      roundNumber: 1,
    });
    const attackPhaseDefensivePenalties = resolveCombatAttackPhaseDefensivePenalties({
      commitment: "committed",
      opportunities: attackOpportunities,
      participantId: "hero",
      roundNumber: 1,
    });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties,
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
    });
    const phaseContexts = {
      phase1: { ...combatContext, targetParticipantId: "guard" },
      phase2: { ...combatContext, targetParticipantId: "guard" },
    };
    const state = combatRoundStateSchema.parse({
      currentStep: "review_phase_2_modifiers",
      currentCursor: { participantId: "hero", roundNumber: 1, step: "M2" },
      participants: [
        {
          attackResults: {
            phase1: buildCombatRoundAttackRollResult({
              actionId: "double_attack",
              attackerParticipantId: "hero",
              defenderDb: 10,
              defenderParticipantId: "guard",
              ob: 10,
              phase: "phase1",
              roll: 5,
              rolledAt: "2026-01-01T00:00:00.000Z",
              weaponName: "Dagger",
            }),
          },
          declaration: {
            actionId: "double_attack",
            attackOpportunities,
            attackPhaseDefensivePenalties,
            combatContext,
            phaseContexts,
            roundNumber: 1,
            submittedBy: "player",
          },
          label: "Hero",
          participantId: "hero",
        },
        { label: "Guard", participantId: "guard" },
      ],
      roundNumber: 1,
    });

    const cancelled = decideCombatRoundDoubleAttackPhase2({
      command: { createdAt: "2026-01-01T00:01:00.000Z", createdByUserId: "user-1" },
      decision: "cancel",
      participantId: "hero",
      state,
    });
    const hero = cancelled.participants[0];
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "hero",
        phase: "phase2",
        state: cancelled,
      }),
    ).toBe(false);
    expect(hero?.declaration?.combatContext?.modifierBuckets.situationObSkill).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sourcePhase: "phase2" })]),
    );
    expect(hero?.declaration?.combatContext?.modifierBuckets.situationDb).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourcePhase: "phase2", value: -2 })]),
    );

    const restored = undoLatestCombatRoundCommand({ state: cancelled });
    expect(restored).toBeDefined();
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "hero",
        phase: "phase2",
        state: restored!,
      }),
    ).toBe(true);
    expect(
      restored?.participants[0]?.declaration?.combatContext?.modifierBuckets.situationDb,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourcePhase: "phase2", value: -4 })]),
    );
  });
});
