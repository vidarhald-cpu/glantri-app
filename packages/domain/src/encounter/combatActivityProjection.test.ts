import { describe, expect, it } from "vitest";

import {
  scenarioEventLogSchema,
  scenarioParticipantSchema,
  type ScenarioEventLog,
} from "../campaign/scenario";
import { projectScenarioObjectiveHistory } from "../campaign/scenarioSession";
import {
  buildCombatActivityFacts,
  COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY,
  COMBAT_ACTIVITY_INVOLVED_OUTCOME_WHITELIST,
  COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND,
  COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES,
  COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES,
  isCombatActivityEventKindPublished,
  isCombatStepEventPublishedToActivity,
  readCombatActivityFacts,
  renderCombatActivitySummary,
} from "./combatActivityProjection";
import { buildCombatBreakOffProposalId, combatBreakOffProposalSchema } from "./combatBreakOff";
import type { CombatDisarmRoll } from "./combatDisarm";
import { buildCombatDefenseSnapshotId, combatDefenseSnapshotSchema } from "./combatDefenseSnapshot";
import { makeDistancePairKey, setDistanceBetween } from "./combatDistance";
import type { CombatEffectsState } from "./combatEffects";
import { buildDamagePersistentLifecycle } from "./combatPersistentModifierLifecycle";
import {
  advanceCombatRoundStep,
  buildCombatRoundAttackRollResult,
  combatRoundStateSchema,
  commitCombatRoundBreakOff,
  getCombatRoundAttackResultId,
  commitCombatRoundDisarm,
  initializeCombatRoundPhaseResolutionCursor,
  initializeCombatRoundState,
  openCombatRoundDisarmAfterContact,
  prepareCombatRoundEndReview,
  recordCombatRoundAttackResult,
  recordCombatRoundBreakOffRoll,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDamageResult,
  recordCombatRoundDeclaration,
  recordCombatRoundDefenseReview,
  recordCombatRoundDisarmRoll,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundParryResult,
  reviewCombatRoundBreakOff,
  setCombatRoundParticipantInitiative,
  rollCombatRoundEndDistanceControl,
  rollCombatRoundEndHealthCheck,
  type CombatRoundEndDistanceRollResult,
} from "./combatRoundManager";
import {
  combatStepEventSchema,
  combatStepEventTypeSchema,
  type CombatStepEvent,
  type CombatStepEventType,
} from "./combatStepEventSchema";
import {
  encounterSessionSchema,
  type EncounterParticipant,
  type EncounterSession,
} from "./session";

/**
 * The classification settled in combat-panel-contract.md 12.13 and Forgejo issue #317, written out
 * member by member. This is a **positive** list: the exhaustiveness assertion below fails loudly
 * when a `combatStepEventTypeSchema` member is added without being classified here.
 */
const EXPECTED_CLASSIFICATION: Readonly<Record<CombatStepEventType, "publish" | "suppress">> = {
  action_skipped: "suppress",
  adjust_distance_adjustment: "suppress",
  adjust_distance_committed: "publish",
  adjust_distance_response: "suppress",
  adjust_distance_result: "publish",
  adjust_distance_roll: "suppress",
  attack: "publish",
  break_off_committed: "publish",
  break_off_result: "publish",
  break_off_review: "suppress",
  break_off_roll: "suppress",
  combat_experience: "suppress",
  continued_contact_maintenance: "suppress",
  critical: "publish",
  damage_committed: "publish",
  damage_proposed: "suppress",
  declaration: "suppress",
  disarm_committed: "publish",
  disarm_opened: "suppress",
  disarm_result: "publish",
  disarm_roll: "suppress",
  distance_control_applied: "suppress",
  distance_control_result: "publish",
  distance_control_roll: "suppress",
  effect_review: "suppress",
  feint_committed: "publish",
  feint_feasibility: "suppress",
  feint_impossible: "suppress",
  feint_result: "publish",
  feint_roll: "suppress",
  health_check: "publish",
  hit_location: "publish",
  initiative: "suppress",
  missile_readiness: "suppress",
  modifier_review: "suppress",
  observation: "suppress",
  offensive_parry_brawling: "suppress",
  parry: "publish",
  participant_su_review: "suppress",
  round_boundary: "suppress",
  task_resolved: "publish",
};

function buildEvent(overrides: Partial<CombatStepEvent>): CombatStepEvent {
  return combatStepEventSchema.parse({
    completeness: "complete",
    encounterId: "encounter-1",
    facts: { gmReview: {}, involvedOutcome: {}, publicOutcome: {}, rollerPrivate: {} },
    id: "event-1",
    missingFacts: [],
    occurredAt: "2026-09-24T10:00:00.000Z",
    roundNumber: 1,
    schemaVersion: 1,
    sequence: 1,
    source: { kind: "canonical", sourceIds: [] },
    status: "recorded",
    step: "phase_1_actions",
    type: "attack",
    visibility: { identityRefs: [], involvedParticipantIds: [], outcomeScope: "public" },
    ...overrides,
  });
}

const identity = (participantId: string | undefined) => participantId;

/**
 * ---------------------------------------------------------------------------
 * Real-lifecycle fixtures
 * ---------------------------------------------------------------------------
 *
 * Every fixture below is the `CombatStepEvent` a production emitter in
 * `combatRoundManager` actually produced, harvested from the driven state — never a hand-built
 * `facts` record. A hand-built fixture is what previously hid a total defect: it asserted a
 * `publicOutcome.success` shape no emitter writes, so the renderer looked correct while every
 * real outcome rendered without its result.
 */

const LIFECYCLE_SCENARIO_ID = "scenario-1";
const LIFECYCLE_ENCOUNTER_ID = "encounter-1";
const LIFECYCLE_AT = "2026-01-01T00:00:00.000Z";

const LIFECYCLE_PARTICIPANTS = [
  { encounterParticipantId: "gladiator", label: "The Gladiator", userId: "user-gladiator" },
  { encounterParticipantId: "guard", label: "City guard", userId: "user-guard" },
] as const;

function toScenarioParticipantId(participantId: string | undefined): string | undefined {
  if (!participantId) return undefined;
  const match = LIFECYCLE_PARTICIPANTS.find(
    (entry) =>
      entry.encounterParticipantId === participantId ||
      `scenario-${entry.encounterParticipantId}` === participantId,
  );
  return match ? `scenario-${match.encounterParticipantId}` : undefined;
}

function lifecycleEncounterParticipant(input: { id: string; label: string }): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

function lifecycleEncounter(overrides: Partial<EncounterSession> = {}): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: LIFECYCLE_AT,
    currentRound: 3,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: LIFECYCLE_ENCOUNTER_ID,
    kind: "combat",
    participantMembershipMode: "explicit",
    participants: LIFECYCLE_PARTICIPANTS.map((entry) =>
      lifecycleEncounterParticipant({ id: entry.encounterParticipantId, label: entry.label }),
    ),
    scenarioId: LIFECYCLE_SCENARIO_ID,
    status: "active",
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: LIFECYCLE_AT,
    ...overrides,
  });
}

const lifecycleScenarioParticipants = LIFECYCLE_PARTICIPANTS.map((entry) =>
  scenarioParticipantSchema.parse({
    controlledByUserId: entry.userId,
    createdAt: LIFECYCLE_AT,
    id: `scenario-${entry.encounterParticipantId}`,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: LIFECYCLE_SCENARIO_ID,
    snapshot: { displayName: entry.label },
    sourceType: "character",
    state: { combat: {}, equipment: {}, health: {}, resources: {} },
    updatedAt: LIFECYCLE_AT,
  }),
);

/**
 * Builds the Activity row for a real event exactly as
 * `packages/database/src/repositories/encounterRepository.ts` writes it — same audience
 * derivation, same `eventKind`, same `activityFacts` builder — and round-trips it through JSON so
 * the assertions run against what a persisted `payloadJson` can actually hold.
 */
function buildLifecycleActivityRow(input: {
  event: CombatStepEvent;
  sequence: number;
}): ScenarioEventLog {
  const audienceParticipantIds =
    input.event.visibility.outcomeScope === "public"
      ? undefined
      : input.event.visibility.involvedParticipantIds.flatMap((participantId) => {
          const scenarioParticipantId = toScenarioParticipantId(participantId);
          return scenarioParticipantId ? [scenarioParticipantId] : [];
        });
  const actorParticipantId = toScenarioParticipantId(input.event.actorParticipantId);
  return scenarioEventLogSchema.parse({
    createdAt: LIFECYCLE_AT,
    eventType: "encounter_combat_outcome",
    id: `row-${input.event.id}`,
    payload: JSON.parse(
      JSON.stringify({
        ...(audienceParticipantIds ? { audienceParticipantIds } : {}),
        [COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY]: buildCombatActivityFacts({
          event: input.event,
          toScenarioParticipantId,
        }),
        ...(actorParticipantId ? { actorParticipantId } : {}),
        combatEventId: input.event.id,
        encounterId: LIFECYCLE_ENCOUNTER_ID,
        eventKind: input.event.type,
        sourceOccurredAt: input.event.occurredAt,
      }),
    ),
    scenarioId: LIFECYCLE_SCENARIO_ID,
    sequence: input.sequence,
    summary: `Combat: ${input.event.type.replaceAll("_", " ")}.`,
  });
}

/** Runs the real server-side Activity projection over rows built from real events. */
function projectLifecycleActivity(input: {
  events: readonly CombatStepEvent[];
  viewer: "gm" | (typeof LIFECYCLE_PARTICIPANTS)[number]["encounterParticipantId"];
}) {
  const viewerParticipant =
    input.viewer === "gm"
      ? undefined
      : LIFECYCLE_PARTICIPANTS.find((entry) => entry.encounterParticipantId === input.viewer);
  return projectScenarioObjectiveHistory({
    controlledParticipantIds: new Set(
      viewerParticipant ? [`scenario-${viewerParticipant.encounterParticipantId}`] : [],
    ),
    eventLogs: input.events.map((event, index) =>
      buildLifecycleActivityRow({ event, sequence: index + 1 }),
    ),
    itemOutcomeContext: {
      encounters: [lifecycleEncounter()],
      participants: lifecycleScenarioParticipants,
      userId: viewerParticipant?.userId ?? "gm-1",
    },
    viewerMode: input.viewer === "gm" ? "gm" : "player",
  });
}

function lifecycleSummaryFor(input: {
  events: readonly CombatStepEvent[];
  eventType: CombatStepEventType;
  viewer: "gm" | "gladiator" | "guard";
}): string | undefined {
  return projectLifecycleActivity({ events: input.events, viewer: input.viewer }).find(
    (entry) => entry.eventKind === input.eventType,
  )?.summary;
}

function eventOfType(
  events: readonly CombatStepEvent[],
  type: CombatStepEventType,
): CombatStepEvent {
  const match = events.find((event) => event.type === type);
  if (!match) {
    throw new Error(
      `The driven lifecycle emitted no ${type} event; the fixture no longer drives production.`,
    );
  }
  return match;
}

function disarmRoll(input: {
  finalTotal: number;
  opponentParticipantId: string;
  participantId: string;
  role: "disarm_actor" | "disarm_holder";
}): CombatDisarmRoll {
  return {
    calculation: {
      baseSkill: 10,
      calculationId: `calculation:${input.participantId}`,
      completeness: "complete",
      contestType: "disarm",
      derivedIntegerAdjustment: input.finalTotal - 20,
      finalResult: input.finalTotal,
      governingStat: { id: "strength", label: "Strength", value: 10 },
      missingContributionPoints: [],
      openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
      opponentParticipantId: input.opponentParticipantId,
      participantId: input.participantId,
      percentageContributions: [],
      preDieTotal: input.finalTotal - 10,
      role: input.role,
      skill: { id: "weapon-skill", label: "Weapon skill", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "roller_and_gm",
    },
    characteristicChoice: "strength",
    finalTotal: input.finalTotal,
    id: `roll:${input.participantId}`,
    participantId: input.participantId,
    rolledAt: LIFECYCLE_AT,
    skillChoice: "weapon_skill",
  };
}

/** Drives the real Disarm lifecycle: declaration, contact, both rolls, commit. */
function driveDisarmLifecycle(): CombatStepEvent[] {
  let state = initializeCombatRoundState({ encounter: lifecycleEncounter() });
  state = recordCombatRoundDeclaration({
    command: { commandId: "declare", createdAt: LIFECYCLE_AT },
    declaration: {
      actionId: "disarm",
      disarm: {
        actingWeapon: {
          capability: "trap",
          controlRating: 2,
          itemId: "item-main-gauche",
          itemRevision: LIFECYCLE_AT,
          label: "Main gauche",
          parryModifier: 2,
          templateId: "weapon-main-gauche",
        },
        method: "proactive",
        phase: "phase1",
        targetParticipantId: "guard",
        targetWeapon: {
          capability: "none",
          controlRating: 3,
          itemId: "item-spear",
          itemRevision: LIFECYCLE_AT,
          label: "Spear",
          parryModifier: -1,
          templateId: "weapon-spear-thrust",
        },
      },
      roundNumber: 3,
    },
    participantId: "gladiator",
    state,
    submittedBy: "player",
  });
  const attemptId = state.disarmAttempts[0]!.id;
  state = initializeCombatRoundState({
    encounter: lifecycleEncounter({ combatRoundState: state }),
  });
  state = combatRoundStateSchema.parse({
    ...state,
    currentCursor: { participantId: "gladiator", roundNumber: 3, step: "A1" },
    currentStep: "phase_1_actions",
    phaseResolutionCursor: { participantId: "gladiator", phase: "phase1", substep: "attack" },
    selectedParticipantId: "gladiator",
    selectedStep: "phase_1_actions",
  });
  state = openCombatRoundDisarmAfterContact({
    attackResultId: "attack:gladiator:phase1",
    attemptId,
    command: { commandId: "contact", createdAt: LIFECYCLE_AT },
    state,
  });
  state = recordCombatRoundDisarmRoll({
    attemptId,
    command: { commandId: "actor-roll", createdAt: LIFECYCLE_AT },
    result: disarmRoll({
      finalTotal: 31,
      opponentParticipantId: "guard",
      participantId: "gladiator",
      role: "disarm_actor",
    }),
    state,
  });
  state = recordCombatRoundDisarmRoll({
    attemptId,
    command: { commandId: "holder-roll", createdAt: LIFECYCLE_AT },
    result: disarmRoll({
      finalTotal: 15,
      opponentParticipantId: "gladiator",
      participantId: "guard",
      role: "disarm_holder",
    }),
    state,
  });
  state = commitCombatRoundDisarm({
    attemptId,
    command: { commandId: "commit", createdAt: LIFECYCLE_AT },
    state,
  });
  return [...state.rounds.flatMap((round) => round.events), ...state.events];
}

function breakOffRoll(input: {
  finalTotal: number;
  participantId: string;
  role: "break_off_escapee" | "break_off_attacker";
}) {
  return {
    calculation: {
      baseSkill: 10,
      calculationId: `calc:${input.participantId}`,
      completeness: "complete" as const,
      contestType: "break_off" as const,
      derivedIntegerAdjustment: 0,
      finalResult: input.finalTotal,
      governingStat: { id: "dex", label: "Dexterity", value: 10 },
      missingContributionPoints: [],
      movementBurden: {
        carriedItems: [],
        completeness: "complete" as const,
        missingFacts: [],
        participantId: input.participantId,
        provenance: {
          carriedLoadSource: "scenario_equipment_snapshot" as const,
          formula: "themistogenes_movement_modifier_v1" as const,
          sourceRange: "Calculations!L39:S42" as const,
          workbook: "Themistogenes 1.07.xlsx" as const,
        },
        schemaVersion: 1 as const,
        sourceSnapshotId: `snapshot:${input.participantId}`,
        visibility: "owner_and_gm" as const,
      },
      openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: input.finalTotal - 10 },
      participantId: input.participantId,
      percentageContributions: [],
      preDieTotal: 10,
      role: input.role,
      skill: { id: "dodge", label: "Dodge", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "involved" as const,
    },
    finalTotal: input.finalTotal,
    id: `roll:${input.participantId}`,
    participantId: input.participantId,
    rolledAt: LIFECYCLE_AT,
  };
}

/** Drives the real Break Off lifecycle: GM review, both rolls, commit. */
function driveBreakOffLifecycle(): CombatStepEvent[] {
  const proposalId = buildCombatBreakOffProposalId({
    attackerParticipantId: "gladiator",
    escapeeParticipantId: "guard",
    roundNumber: 1,
  });
  let state = combatRoundStateSchema.parse({
    breakOffProposals: [
      combatBreakOffProposalSchema.parse({
        attackerParticipantId: "gladiator",
        escapeeParticipantId: "guard",
        id: proposalId,
        pairKey: makeDistancePairKey("guard", "gladiator"),
        roundNumber: 1,
        status: "awaiting_gm_review",
      }),
    ],
    currentCursor: { participantId: "guard", roundNumber: 1, step: "A1" },
    currentStep: "phase_1_actions",
    encounterId: LIFECYCLE_ENCOUNTER_ID,
    participants: [
      {
        declaration: { actionId: "attack_parry", roundNumber: 1, submittedBy: "gm" },
        initiatives: { phase1: { rolls: [6], total: 18 } },
        label: "The Gladiator",
        participantId: "gladiator",
      },
      {
        declaration: { actionId: "break_off_engagement", roundNumber: 1, submittedBy: "player" },
        initiatives: { phase1: { rolls: [2], total: 2 } },
        label: "City guard",
        participantId: "guard",
      },
    ],
    phaseResolutionCursor: { participantId: "guard", phase: "phase1", substep: "break_off" },
    phaseResolutionStatuses: { guard: { phase1: { substep: "break_off" } } },
    roundNumber: 1,
  });
  state = reviewCombatRoundBreakOff({
    attackerAdjustment: 0,
    command: { createdAt: LIFECYCLE_AT },
    escapeeAdjustment: 0,
    proposalId,
    state,
  });
  state = recordCombatRoundBreakOffRoll({
    command: { createdAt: LIFECYCLE_AT },
    proposalId,
    result: breakOffRoll({ finalTotal: 30, participantId: "guard", role: "break_off_escapee" }),
    state,
  });
  state = recordCombatRoundBreakOffRoll({
    command: { createdAt: LIFECYCLE_AT },
    proposalId,
    result: breakOffRoll({
      finalTotal: 10,
      participantId: "gladiator",
      role: "break_off_attacker",
    }),
    state,
  });
  state = commitCombatRoundBreakOff({
    command: { createdAt: LIFECYCLE_AT },
    proposalId,
    state,
  });
  return [...state.rounds.flatMap((round) => round.events), ...state.events];
}

function distanceControlRoll(input: {
  baseSkill: number;
  dieResult: number;
  opponentParticipantId: string;
  participantId: string;
}): CombatRoundEndDistanceRollResult {
  const finalTotal = input.baseSkill + input.dieResult;
  return {
    dodgeSkillTotal: input.baseSkill,
    finalTotal,
    generalFatigueModifier: 0,
    openEndedD10s: [],
    rolledAt: LIFECYCLE_AT,
    rolledAtRound: 3,
    rolledBy: "player",
    rollD20: input.dieResult,
    rollTotal: input.dieResult,
    skillContestCalculation: {
      baseSkill: input.baseSkill,
      calculationId: `round-end-distance:${input.participantId}`,
      completeness: "partial",
      contestType: "round_end_adjust_distance",
      derivedIntegerAdjustment: 0,
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
      preDieTotal: input.baseSkill,
      role: "contestant",
      skill: { id: "dodge", label: "Dodge", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "roller_and_gm",
    },
  };
}

/** Drives the real round-end distance-control contest: conflicting preferences, both rolls. */
function driveDistanceControlLifecycle(): CombatStepEvent[] {
  const baseState = initializeCombatRoundState({ encounter: lifecycleEncounter() });
  const distanceState = setDistanceBetween({
    distance: 2,
    participantAId: "gladiator",
    participantBId: "guard",
    source: "gm_set",
    state: baseState.distanceState,
  });
  let state = recordCombatRoundDeclaration({
    declaration: {
      movementIntent: {
        distancePreferences: [
          { desiredDistance: 3, source: "gm_proxy", targetParticipantId: "guard" },
        ],
        mode: "set_distance_preferences",
      },
      roundNumber: 3,
    },
    participantId: "gladiator",
    state: { ...baseState, distanceState },
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
      roundNumber: 3,
    },
    participantId: "guard",
    state,
    submittedBy: "gm",
  });
  state = prepareCombatRoundEndReview({
    participantInputs: {
      gladiator: { distanceControl: { dodgeSkillTotal: 8, generalFatigueModifier: -1 } },
      guard: { distanceControl: { dodgeSkillTotal: 4, generalFatigueModifier: 0 } },
    },
    state: {
      ...state,
      currentCursor: { participantId: "gladiator", roundNumber: 3, step: "SU" as const },
      currentStep: "round_summary" as const,
      selectedParticipantId: "gladiator",
      selectedStep: "round_summary" as const,
    },
  });
  const distanceProposalId = state.roundEndReview?.proposedDistances[0]?.id;
  state = rollCombatRoundEndDistanceControl({
    command: { createdAt: LIFECYCLE_AT },
    distanceProposalId,
    participantId: "gladiator",
    result: distanceControlRoll({
      baseSkill: 7,
      dieResult: 10,
      opponentParticipantId: "guard",
      participantId: "gladiator",
    }),
    state,
  }).state;
  state = rollCombatRoundEndDistanceControl({
    command: { createdAt: LIFECYCLE_AT },
    distanceProposalId,
    participantId: "guard",
    result: distanceControlRoll({
      baseSkill: 4,
      dieResult: 12,
      opponentParticipantId: "gladiator",
      participantId: "guard",
    }),
    state,
  }).state;
  return [...state.rounds.flatMap((round) => round.events), ...state.events];
}

/** Drives a real attack through failed parry, hit location, damage and critical. */
function driveAttackDamageLifecycle(): CombatStepEvent[] {
  const actionId = "attack_parry";
  const declared = recordCombatRoundDeclaration({
    declaration: {
      actionId,
      phaseContexts: {
        phase1: { modifierBuckets: EMPTY_MODIFIER_BUCKETS, targetParticipantId: "guard" },
        phase2: { modifierBuckets: EMPTY_MODIFIER_BUCKETS, targetParticipantId: "guard" },
      },
      roundNumber: 3,
    },
    participantId: "gladiator",
    state: initializeCombatRoundState({ encounter: lifecycleEncounter() }),
    submittedBy: "gm",
  });
  const state = initializeCombatRoundPhaseResolutionCursor({
    phase: "phase1",
    state: setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: declared,
    }),
    updatedAt: "2026-01-01T00:02:00.000Z",
  });
  const attackResult = buildCombatRoundAttackRollResult({
    actionId,
    attackOpportunityId: "opportunity-1",
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
    command: { createdAt: attackResult.rolledAt, createdByUserId: "gm-1" },
    participantId: "gladiator",
    result: attackResult,
    state,
    submittedBy: "gm",
  });
  // The defender's own review of the incoming attack is a real command, not test state surgery.
  const attackId = getCombatRoundAttackResultId({ result: attackResult, roundNumber: 3 });
  const afterDefenseReview = recordCombatRoundDefenseReview({
    command: { createdAt: "2026-01-01T00:03:30.000Z", createdByUserId: "gm-1" },
    snapshot: combatDefenseSnapshotSchema.parse({
      attackDirection: "front",
      attackerParticipantId: "gladiator",
      attackId,
      attackOpportunityId: "opportunity-1",
      aware: true,
      awarenessDefault: true,
      awarenessOverridden: false,
      defenderParticipantId: "guard",
      id: buildCombatDefenseSnapshotId(attackId),
      ordinaryDodgeAvailable: true,
      phase: "phase1",
      reviewedAt: "2026-01-01T00:03:30.000Z",
      reviewedByUserId: "gm-1",
      roundNumber: 3,
      schemaVersion: 1,
      sources: [],
      status: "committed",
    }),
    state: afterAttack,
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult,
    command: { createdAt: "2026-01-01T00:04:00.000Z", createdByUserId: "gm-1" },
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
    state: afterDefenseReview,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult,
    command: { createdAt: "2026-01-01T00:04:30.000Z", createdByUserId: "gm-1" },
    hitLocationRolls: [17],
    rolledByParticipantId: "gladiator",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult,
    command: { createdAt: "2026-01-01T00:05:00.000Z", createdByUserId: "gm-1" },
    defenderDm: 0,
    dmb: 8,
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const afterCritical = recordCombatRoundCriticalRoll({
    attackResult,
    command: { createdAt: "2026-01-01T00:05:30.000Z", createdByUserId: "gm-1" },
    criticalDice: [4, 5],
    rolledByParticipantId: "gladiator",
    state: afterDamage,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:30.000Z",
  });
  return [...afterCritical.rounds.flatMap((round) => round.events), ...afterCritical.events];
}

/** Drives a real round-end Health check against an external bleed. */
function driveHealthCheckLifecycle(): CombatStepEvent[] {
  let roundSummaryState = initializeCombatRoundState({
    encounter: lifecycleEncounter({ currentRound: 10 }),
  });
  for (let guard = 0; guard < 50 && roundSummaryState.currentStep !== "round_summary"; guard += 1) {
    roundSummaryState = advanceCombatRoundStep(roundSummaryState);
  }
  const combatEffects: CombatEffectsState = {
    effects: [
      {
        canonicalLifecycle: buildDamagePersistentLifecycle({
          context: {
            commandId: "damage-command-health",
            createdAt: LIFECYCLE_AT,
            createdRevision: "revision-bleed-created",
            createdSequence: 2,
            encounterId: LIFECYCLE_ENCOUNTER_ID,
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
        createdAt: LIFECYCLE_AT,
        damage: 0,
        effectGroup: "bleed",
        generalDamage: 0,
        id: "external-bleed",
        modifierValue: 3,
        roundNumber: 1,
        sourceEventId: "event-external-bleed",
        status: "active",
        targetParticipantId: "scenario-gladiator",
        type: "bleed",
        updatedAt: LIFECYCLE_AT,
      },
    ],
    events: [
      {
        createdAt: LIFECYCLE_AT,
        description: "Bleeding wound",
        id: "event-external-bleed",
        sourceLabel: "Bleeding wound",
        sourceType: "manual",
        targetParticipantId: "scenario-gladiator",
      },
    ],
  };
  const reviewed = prepareCombatRoundEndReview({
    participantInputs: { gladiator: { combatEffects, healthStat: 0 } },
    state: roundSummaryState,
  });
  const rolled = rollCombatRoundEndHealthCheck({
    combatEffects,
    command: { createdAt: "2026-01-01T00:11:00.000Z", createdByUserId: "user-gladiator" },
    createdRevision: "revision-health-check",
    participantId: "gladiator",
    roll: { dieResult: 21, openEndedD10s: [1], rollD20: 20 },
    rolledBy: "player",
    state: reviewed,
  });
  return [...rolled.state.rounds.flatMap((round) => round.events), ...rolled.state.events];
}

const EMPTY_MODIFIER_BUCKETS = {
  general: [],
  situationDb: [],
  situationInitiative: [],
  situationObSkill: [],
};

const DISARM_LIFECYCLE_EVENTS = driveDisarmLifecycle();
const BREAK_OFF_LIFECYCLE_EVENTS = driveBreakOffLifecycle();
const DISTANCE_CONTROL_LIFECYCLE_EVENTS = driveDistanceControlLifecycle();
const ATTACK_LIFECYCLE_EVENTS = driveAttackDamageLifecycle();
const HEALTH_CHECK_LIFECYCLE_EVENTS = driveHealthCheckLifecycle();

const ALL_LIFECYCLE_EVENTS = [
  ...DISARM_LIFECYCLE_EVENTS,
  ...BREAK_OFF_LIFECYCLE_EVENTS,
  ...DISTANCE_CONTROL_LIFECYCLE_EVENTS,
  ...ATTACK_LIFECYCLE_EVENTS,
  ...HEALTH_CHECK_LIFECYCLE_EVENTS,
];

/**
 * The published outcomes whose result lives in `facts.involvedOutcome`, each pinned to the real
 * lifecycle that emits it and to the sentence its entitled audience must receive. Every expected
 * sentence below states the actual outcome; a renderer that lost the result would produce the
 * resultless wording asserted against at the end of the same test.
 */
const INVOLVED_OUTCOME_EVIDENCE = [
  {
    entitledViewer: "gladiator",
    events: DISARM_LIFECYCLE_EVENTS,
    eventType: "disarm_result",
    expected: {
      entitled: "You disarmed City guard and left them unbalanced.",
      gm: "The Gladiator disarmed City guard and left them unbalanced.",
    },
    resultless: "resolved a disarm against",
  },
  {
    entitledViewer: "gladiator",
    events: DISARM_LIFECYCLE_EVENTS,
    eventType: "disarm_committed",
    expected: {
      entitled: "You disarmed City guard and left them unbalanced.",
      gm: "The Gladiator disarmed City guard and left them unbalanced.",
    },
    resultless: "resolved a disarm against",
  },
  {
    entitledViewer: "guard",
    events: BREAK_OFF_LIFECYCLE_EVENTS,
    eventType: "break_off_result",
    expected: {
      entitled: "You broke off from The Gladiator.",
      gm: "City guard broke off from The Gladiator.",
    },
    resultless: "resolved a break-off",
  },
  {
    entitledViewer: "guard",
    events: BREAK_OFF_LIFECYCLE_EVENTS,
    eventType: "break_off_committed",
    expected: {
      entitled: "You broke off from The Gladiator.",
      gm: "City guard broke off from The Gladiator.",
    },
    resultless: "resolved a break-off",
  },
  {
    entitledViewer: "gladiator",
    events: DISTANCE_CONTROL_LIFECYCLE_EVENTS,
    eventType: "distance_control_result",
    expected: {
      entitled: "You won the distance contest.",
      gm: "The Gladiator won the distance contest.",
    },
    resultless: "resolved the distance contest",
  },
  {
    entitledViewer: "guard",
    events: ATTACK_LIFECYCLE_EVENTS,
    eventType: "hit_location",
    expected: {
      entitled: "You were struck in the right arm.",
      gm: "City guard was struck in the right arm.",
    },
    resultless: "was struck.",
  },
  {
    entitledViewer: "guard",
    events: ATTACK_LIFECYCLE_EVENTS,
    eventType: "critical",
    expected: {
      entitled: "You suffered a grade B critical result.",
      gm: "City guard suffered a grade B critical result.",
    },
    resultless: "suffered a critical result.",
  },
  {
    entitledViewer: "gladiator",
    events: HEALTH_CHECK_LIFECYCLE_EVENTS,
    eventType: "health_check",
    expected: {
      entitled: "You made a health check and succeeded.",
      gm: "The Gladiator made a health check and succeeded.",
    },
    resultless: "made a health check.",
  },
] as const satisfies readonly {
  entitledViewer: "gladiator" | "guard";
  events: readonly CombatStepEvent[];
  eventType: CombatStepEventType;
  expected: { entitled: string; gm: string };
  resultless: string;
}[];

describe("published outcomes carry their real result into the Activity payload", () => {
  it.each(INVOLVED_OUTCOME_EVIDENCE)(
    "renders the real $eventType outcome for its entitled audience and for the GM",
    (evidence) => {
      const entitled = lifecycleSummaryFor({
        eventType: evidence.eventType,
        events: evidence.events,
        viewer: evidence.entitledViewer,
      });
      const gm = lifecycleSummaryFor({
        eventType: evidence.eventType,
        events: evidence.events,
        viewer: "gm",
      });

      expect(entitled).toBe(evidence.expected.entitled);
      expect(gm).toBe(evidence.expected.gm);
      // The resultless wording is exactly what the defect produced: a terminal event published
      // without its outcome. It must not reappear for any viewer.
      expect(entitled).not.toContain(evidence.resultless);
      expect(gm).not.toContain(evidence.resultless);
      // The mechanically derived stored string is never the player-facing sentence.
      expect(entitled).not.toContain("Combat:");
    },
  );

  it("renders the same stored facts differently for an unentitled-identity viewer", () => {
    // The GM audit view and the involved audience differ, and a viewer who cannot identify the
    // other combatant receives the neutral fallback rather than a name.
    const guardView = projectScenarioObjectiveHistory({
      controlledParticipantIds: new Set(["scenario-guard"]),
      eventLogs: DISARM_LIFECYCLE_EVENTS.map((event, index) =>
        buildLifecycleActivityRow({ event, sequence: index + 1 }),
      ),
      // No encounter context: the viewer can identify nobody but the participant they control.
      itemOutcomeContext: {
        encounters: [],
        participants: lifecycleScenarioParticipants,
        userId: "user-guard",
      },
      viewerMode: "player",
    }).find((entry) => entry.eventKind === "disarm_result")?.summary;

    expect(guardView).toBe("Another combatant disarmed you and left them unbalanced.");
  });

  it("never carries gmReview, rollerPrivate or an unwhitelisted involvedOutcome field", () => {
    const published = ALL_LIFECYCLE_EVENTS.filter((event) =>
      isCombatStepEventPublishedToActivity(event.type),
    );
    expect(published.length).toBeGreaterThan(0);

    for (const event of published) {
      const facts = buildCombatActivityFacts({ event, toScenarioParticipantId });
      const serialized = JSON.stringify(facts);
      const whitelist: readonly string[] =
        (
          COMBAT_ACTIVITY_INVOLVED_OUTCOME_WHITELIST as Partial<
            Record<CombatStepEventType, readonly string[]>
          >
        )[event.type] ?? [];

      expect(Object.keys(facts.involvedOutcomeDigest).sort()).toEqual(
        Object.keys(event.facts.involvedOutcome)
          .filter((key) => whitelist.includes(key))
          .sort(),
      );
      for (const key of Object.keys(event.facts.gmReview)) {
        expect(serialized, `${event.type} leaked gmReview.${key}`).not.toContain(`"${key}"`);
      }
      for (const key of Object.keys(event.facts.rollerPrivate)) {
        expect(serialized, `${event.type} leaked rollerPrivate.${key}`).not.toContain(`"${key}"`);
      }
      // Only primitives are carried, so no nested object can smuggle an unreviewed field.
      for (const value of Object.values(facts.involvedOutcomeDigest)) {
        expect(["boolean", "number", "string"]).toContain(typeof value);
      }
    }
  });

  it("keeps a gm_only outcome away from every player viewer", () => {
    const gmOnly = combatStepEventSchema.parse({
      ...eventOfType(DISARM_LIFECYCLE_EVENTS, "disarm_result"),
      id: "event-gm-only-disarm",
      visibility: {
        ...eventOfType(DISARM_LIFECYCLE_EVENTS, "disarm_result").visibility,
        outcomeScope: "gm_only",
      },
    });

    expect(
      projectLifecycleActivity({ events: [gmOnly], viewer: "gladiator" }).map(
        (entry) => entry.eventKind,
      ),
    ).toEqual([]);
    expect(
      projectLifecycleActivity({ events: [gmOnly], viewer: "gm" }).map((entry) => entry.eventKind),
    ).toEqual(["disarm_result"]);
  });
});

describe("combat Activity positive publish list", () => {
  it("classifies every combatStepEventTypeSchema member exactly once", () => {
    const members = combatStepEventTypeSchema.options;
    const classified = Object.keys(EXPECTED_CLASSIFICATION).sort();

    // A member added to the enum without a classification fails here, not silently in production.
    expect(classified).toEqual([...members].sort());
    expect(members).toHaveLength(41);

    const published = members.filter((member) => EXPECTED_CLASSIFICATION[member] === "publish");
    const suppressed = members.filter((member) => EXPECTED_CLASSIFICATION[member] === "suppress");
    expect(published).toHaveLength(16);
    expect(suppressed).toHaveLength(25);

    expect([...COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES].sort()).toEqual([...published].sort());
    expect([...COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES].sort()).toEqual([...suppressed].sort());
    expect(
      COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES.filter((member) =>
        (COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES as readonly string[]).includes(member),
      ),
    ).toEqual([]);
  });

  it.each(combatStepEventTypeSchema.options)(
    "gates %s on the write side according to its settled classification",
    (member) => {
      expect(isCombatStepEventPublishedToActivity(member)).toBe(
        EXPECTED_CLASSIFICATION[member] === "publish",
      );
    },
  );

  it.each(combatStepEventTypeSchema.options)(
    "gates %s on the read side according to its settled classification",
    (member) => {
      expect(isCombatActivityEventKindPublished(member)).toBe(
        EXPECTED_CLASSIFICATION[member] === "publish",
      );
    },
  );

  it("publishes the item_resolution payload classification and suppresses unknown kinds", () => {
    expect(isCombatActivityEventKindPublished(COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND)).toBe(
      true,
    );
    // The eventKind helper falls back to the row's eventType for a legacy row that carries none.
    expect(isCombatActivityEventKindPublished("encounter_combat_outcome")).toBe(false);
    expect(isCombatActivityEventKindPublished("a_kind_nobody_classified")).toBe(false);
  });
});

describe("terminal-outcome coverage for suppressed intermediates", () => {
  /**
   * combat-panel-contract.md 12.13 section 4: where a suppressed intermediate leads to a meaningful
   * result, the terminal outcome must be published instead. Each suppressed intermediate below is
   * pinned to the published terminal event that carries its result into the recap.
   */
  const TERMINAL_COUNTERPART: Readonly<Record<string, readonly CombatStepEventType[]>> = {
    adjust_distance_adjustment: ["adjust_distance_result", "adjust_distance_committed"],
    adjust_distance_response: ["adjust_distance_result", "adjust_distance_committed"],
    adjust_distance_roll: ["adjust_distance_result", "adjust_distance_committed"],
    break_off_review: ["break_off_result", "break_off_committed"],
    break_off_roll: ["break_off_result", "break_off_committed"],
    damage_proposed: ["damage_committed"],
    declaration: ["attack", "parry"],
    disarm_opened: ["disarm_result", "disarm_committed"],
    disarm_roll: ["disarm_result", "disarm_committed"],
    distance_control_applied: ["distance_control_result"],
    distance_control_roll: ["distance_control_result"],
    feint_feasibility: ["feint_result", "feint_committed"],
    feint_roll: ["feint_result", "feint_committed"],
  };

  /**
   * Returned to the control plane as an implementation gap rather than closed by publishing the
   * mechanic (12.13 section 4). Each of these is itself the terminal record of its outcome and has
   * no published counterpart at this baseline:
   *
   * - `feint_impossible` is emitted *instead of* `feint_feasibility` with status
   *   `not_applicable`; no `feint_result` or `feint_committed` ever follows.
   * - `continued_contact_maintenance` is a Brawling skill contest whose own event is the only
   *   record of who won.
   * - `offensive_parry_brawling` carries `publicOutcome.contactEstablished`, which no other event
   *   reproduces; a following `damage_committed` or `parry` is not guaranteed.
   */
  const RETURNED_AS_IMPLEMENTATION_GAP = [
    "feint_impossible",
    "continued_contact_maintenance",
    "offensive_parry_brawling",
  ] as const;

  /**
   * 12.13 requires the counterpart be "asserted present in the player-safe Activity payload for its
   * entitled audience". Membership of the publish list is not that assertion: a terminal event
   * published without its result closes no hole. For the break-off, disarm and distance-control
   * families the counterpart must appear in the projected payload **carrying its outcome**.
   */
  const COUNTERPART_FAMILIES = [
    "break_off_review",
    "break_off_roll",
    "disarm_opened",
    "disarm_roll",
    "distance_control_applied",
    "distance_control_roll",
  ] as const;

  it.each(COUNTERPART_FAMILIES)(
    "publishes %s's terminal counterpart into the entitled audience's payload with its result",
    (member) => {
      const counterparts = TERMINAL_COUNTERPART[member] ?? [];
      expect(counterparts.length).toBeGreaterThan(0);

      for (const counterpart of counterparts) {
        const evidence = INVOLVED_OUTCOME_EVIDENCE.find((entry) => entry.eventType === counterpart);
        expect(evidence, `${counterpart} has no driven-lifecycle evidence`).toBeDefined();
        if (!evidence) continue;

        const payload = projectLifecycleActivity({
          events: evidence.events,
          viewer: evidence.entitledViewer,
        });

        // The suppressed intermediate itself never reaches the player payload...
        expect(payload.some((entry) => entry.eventKind === member)).toBe(false);
        // ...and the terminal counterpart does, carrying its result.
        const entry = payload.find((candidate) => candidate.eventKind === counterpart);
        expect(entry, `${counterpart} missing from the entitled payload`).toBeDefined();
        expect(entry?.summary).toBe(evidence.expected.entitled);
        expect(entry?.summary).not.toContain(evidence.resultless);
      }
    },
  );

  it("covers every suppressed intermediate by a published terminal event or a recorded return", () => {
    /**
     * Suppressed members that owe no terminal counterpart at all, because they record no
     * Scenario-history outcome to close.
     *
     * `observation` joins them under the Product Owner ruling of 2026-09-24: Observe Opponent is
     * combat-process and information-acquisition state whose result belongs to the private/GM
     * combat surfaces, not to the shared record. Its guard is discharged by publishing a later
     * *consequence* through that consequence's own event, never by republishing the observation
     * bookkeeping — so no terminal-counterpart return is owed here.
     */
    const bookkeeping = new Set([
      "combat_experience",
      "modifier_review",
      "initiative",
      "action_skipped",
      "missile_readiness",
      "observation",
      "participant_su_review",
      "effect_review",
      "round_boundary",
    ]);

    for (const member of COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES) {
      if (bookkeeping.has(member)) continue;
      if ((RETURNED_AS_IMPLEMENTATION_GAP as readonly string[]).includes(member)) continue;
      const counterparts = TERMINAL_COUNTERPART[member];
      expect(counterparts, `${member} has no recorded terminal counterpart`).toBeDefined();
      for (const counterpart of counterparts ?? []) {
        expect(isCombatStepEventPublishedToActivity(counterpart)).toBe(true);
      }
    }
  });

  it("keeps the returned gaps suppressed rather than publishing the mechanic", () => {
    for (const member of RETURNED_AS_IMPLEMENTATION_GAP) {
      expect(isCombatStepEventPublishedToActivity(member)).toBe(false);
    }
  });
});

describe("persisted structured facts", () => {
  it("carries only public-scope facts, never GM-only or roller-private material", () => {
    const facts = buildCombatActivityFacts({
      event: buildEvent({
        actorParticipantId: "p-attacker",
        attackerParticipantId: "p-attacker",
        defenderParticipantId: "p-defender",
        facts: {
          gmReview: { secretModifier: 17 },
          involvedOutcome: { weaponName: "Longsword" },
          publicOutcome: { hit: true },
          rollerPrivate: { rollD20: 3 },
        },
        type: "attack",
      }),
      summaryFacts: { kind: "attack_resolved", outcome: "hit", weaponName: "Longsword" },
      toScenarioParticipantId: identity,
    });

    expect(facts.publicOutcome).toEqual({ hit: true });
    expect(JSON.stringify(facts)).not.toContain("secretModifier");
    expect(JSON.stringify(facts)).not.toContain("rollD20");
    expect(facts.identities).toEqual(
      expect.arrayContaining([
        {
          hiddenIdentityFallback: "unseen_attacker",
          participantId: "p-attacker",
          role: "attacker",
        },
        { hiddenIdentityFallback: "unseen_target", participantId: "p-defender", role: "defender" },
      ]),
    );
  });

  it("round-trips through a payloadJson-shaped record", () => {
    const facts = buildCombatActivityFacts({
      event: buildEvent({ actorParticipantId: "p-1", type: "attack" }),
      toScenarioParticipantId: identity,
    });
    const payload = JSON.parse(
      JSON.stringify({ [COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY]: facts, eventKind: "attack" }),
    );
    expect(readCombatActivityFacts(payload)).toEqual(facts);
    expect(readCombatActivityFacts({ eventKind: "attack" })).toBeUndefined();
    expect(readCombatActivityFacts(undefined)).toBeUndefined();
  });
});

describe("per-viewer Activity summary", () => {
  const participantDisplayNames = new Map([
    ["p-attacker", "Sergeant"],
    ["p-defender", "Test Hunter"],
  ]);

  const attackFacts = buildCombatActivityFacts({
    event: buildEvent({
      actorParticipantId: "p-attacker",
      attackerParticipantId: "p-attacker",
      defenderParticipantId: "p-defender",
      facts: {
        gmReview: {},
        involvedOutcome: { weaponName: "Longsword" },
        publicOutcome: { hit: true },
        rollerPrivate: {},
      },
      type: "attack",
      visibility: {
        identityRefs: [],
        involvedParticipantIds: ["p-attacker", "p-defender"],
        outcomeScope: "perceived",
      },
    }),
    summaryFacts: { kind: "attack_resolved", outcome: "hit", weaponName: "Longsword" },
    toScenarioParticipantId: identity,
  });

  it("yields different authorized sentences for two viewers from the same stored facts", () => {
    const defenderView = renderCombatActivitySummary({
      facts: attackFacts,
      participantDisplayNames,
      viewer: {
        controlledParticipantIds: new Set(["p-defender"]),
        kind: "player",
        // The defender was struck but never perceived the attacker.
        visibleParticipantIds: new Set(["p-defender"]),
      },
    });
    const attackerView = renderCombatActivitySummary({
      facts: attackFacts,
      participantDisplayNames,
      viewer: {
        controlledParticipantIds: new Set(["p-attacker"]),
        kind: "player",
        visibleParticipantIds: new Set(["p-attacker", "p-defender"]),
      },
    });
    const gmView = renderCombatActivitySummary({
      facts: attackFacts,
      participantDisplayNames,
      viewer: { kind: "gm" },
    });

    expect(defenderView).toBe("An unseen attacker attacked you with Longsword. The attack hit.");
    expect(attackerView).toBe("You attacked Test Hunter with Longsword. The attack hit.");
    expect(gmView).toBe("Sergeant attacked Test Hunter with Longsword. The attack hit.");
    expect(defenderView).not.toBe(attackerView);
    // No stored rendered string is authority: the same facts produced three different sentences.
    expect(new Set([defenderView, attackerView, gmView]).size).toBe(3);
  });

  it("renders a parry from the defender's side, per Player Play V1 9.2", () => {
    const parryFacts = buildCombatActivityFacts({
      event: buildEvent({
        attackerParticipantId: "p-attacker",
        defenderParticipantId: "p-defender",
        facts: {
          gmReview: {},
          involvedOutcome: {},
          publicOutcome: { success: true },
          rollerPrivate: {},
        },
        type: "parry",
      }),
      summaryFacts: { defense: "parry", kind: "defense_resolved", outcome: "succeeded" },
      toScenarioParticipantId: identity,
    });

    expect(
      renderCombatActivitySummary({
        facts: parryFacts,
        participantDisplayNames,
        viewer: { kind: "gm" },
      }),
    ).toBe("Test Hunter’s parry succeeded.");
    expect(
      renderCombatActivitySummary({
        facts: parryFacts,
        participantDisplayNames,
        viewer: {
          controlledParticipantIds: new Set(["p-defender"]),
          kind: "player",
          visibleParticipantIds: new Set(["p-defender", "p-attacker"]),
        },
      }),
    ).toBe("Your parry succeeded.");
  });

  it("renders a lifecycle-emitted outcome the Combat Log does not project, per viewer", () => {
    // The fixture is the event the real Disarm lifecycle emitted, not a hand-built `facts` record.
    // A hand-built `publicOutcome: { success: true }` — a shape no emitter writes — is exactly what
    // previously hid the defect that every one of these outcomes rendered without its result.
    const disarmFacts = buildCombatActivityFacts({
      event: eventOfType(DISARM_LIFECYCLE_EVENTS, "disarm_result"),
      toScenarioParticipantId,
    });
    const lifecycleDisplayNames = new Map([
      ["scenario-gladiator", "The Gladiator"],
      ["scenario-guard", "City guard"],
    ]);

    expect(disarmFacts.publicOutcome).toEqual({});
    expect(disarmFacts.involvedOutcomeDigest).toEqual({ disarmed: true, unbalanced: true });
    expect(
      renderCombatActivitySummary({
        facts: disarmFacts,
        participantDisplayNames: lifecycleDisplayNames,
        viewer: { kind: "gm" },
      }),
    ).toBe("The Gladiator disarmed City guard and left them unbalanced.");
    expect(
      renderCombatActivitySummary({
        facts: disarmFacts,
        participantDisplayNames: lifecycleDisplayNames,
        viewer: {
          controlledParticipantIds: new Set(["scenario-guard"]),
          kind: "player",
          visibleParticipantIds: new Set(["scenario-guard", "scenario-gladiator"]),
        },
      }),
    ).toBe("The Gladiator disarmed you and left them unbalanced.");
  });
});
