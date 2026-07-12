import type {
  CombatHistoryProjection,
  CombatRoundAttackRollResult,
  CombatRoundCommand,
  CombatRoundCommandEnvelope,
  CombatRoundDamageReview,
  CombatRoundCombatExperienceResult,
  CombatDistanceEdge,
  CombatRoundInitiativeResult,
  CombatRoundPhaseContexts,
  CombatRoundStep,
  CombatRoundStepSnapshot,
  EncounterParticipant,
  EncounterParticipantMembershipMode,
  EncounterSession,
  EncounterStatus,
  MovementIntent,
  ScenarioParticipant,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";

import { sendJson } from "./apiClient";

export async function loadScenarioEncounters(scenarioId: string): Promise<EncounterSession[]> {
  const payload = await sendJson<{ encounters: EncounterSession[] }>(
    `/scenarios/${scenarioId}/encounters`,
    {
      method: "GET",
    },
  );

  return payload.encounters;
}

export async function createEncounterOnServer(input: {
  scenarioId: string;
  session: EncounterSession;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/scenarios/${input.scenarioId}/encounters`,
    {
      body: JSON.stringify({
        session: input.session,
      }),
      method: "POST",
    },
  );

  return payload.encounter;
}

export async function loadEncounterById(encounterId: string): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(`/encounters/${encounterId}`, {
    method: "GET",
  });

  return payload.encounter;
}

export async function loadCombatHistory(
  encounterId: string,
  input: { perspectiveParticipantId?: string } = {},
): Promise<CombatHistoryProjection> {
  const query = input.perspectiveParticipantId
    ? `?perspectiveParticipantId=${encodeURIComponent(input.perspectiveParticipantId)}`
    : "";
  const payload = await sendJson<{ history: CombatHistoryProjection }>(
    `/encounters/${encounterId}/combat-history${query}`,
    { method: "GET" },
  );

  return payload.history;
}

export async function updateEncounterOnServer(input: {
  encounterId: string;
  session: EncounterSession;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}`,
    {
      body: JSON.stringify({
        session: input.session,
      }),
      method: "PUT",
    },
  );

  return payload.encounter;
}

export async function updateEncounterStatusOnServer(input: {
  encounterId: string;
  status: EncounterStatus;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/status`,
    {
      body: JSON.stringify({
        status: input.status,
      }),
      method: "PATCH",
    },
  );

  return payload.encounter;
}

export async function updateEncounterParticipantsOnServer(input: {
  encounterId: string;
  participantMembershipMode?: EncounterParticipantMembershipMode;
  participants: EncounterParticipant[];
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/participants`,
    {
      body: JSON.stringify({
        participantMembershipMode: input.participantMembershipMode,
        participants: input.participants,
      }),
      method: "PATCH",
    },
  );

  return payload.encounter;
}

export async function submitCombatDeclarationOnServer(input: {
  actionId?: string;
  additionalActionNotes?: string;
  combatContext: ScenarioParticipantCombatContext;
  encounterId: string;
  movementId?: string;
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
  scenarioParticipantId: string;
  secondaryActionId?: string;
}): Promise<{ encounter: EncounterSession; participant: ScenarioParticipant }> {
  const payload = await sendJson<{ encounter: EncounterSession; participant: ScenarioParticipant }>(
    `/encounters/${input.encounterId}/combat-declaration`,
    {
      body: JSON.stringify({
        actionId: input.actionId,
        additionalActionNotes: input.additionalActionNotes,
        combatContext: input.combatContext,
        movementId: input.movementId,
        movementIntent: input.movementIntent,
        phaseContexts: input.phaseContexts,
        phaseWeaponNames: input.phaseWeaponNames,
        scenarioParticipantId: input.scenarioParticipantId,
        secondaryActionId: input.secondaryActionId,
      }),
      method: "POST",
    },
  );

  return payload;
}

export async function rollCombatExperienceOnServer(input: {
  encounterId: string;
  scenarioParticipantId: string;
}): Promise<{
  combatExperience: CombatRoundCombatExperienceResult;
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    combatExperience: CombatRoundCombatExperienceResult;
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/roll-combat-experience`, {
    body: JSON.stringify({
      scenarioParticipantId: input.scenarioParticipantId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollRoundEndDistanceControlOnServer(input: {
  distanceProposalId: string;
  encounterId: string;
  scenarioParticipantId: string;
}): Promise<{
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/roll-distance-control`, {
    body: JSON.stringify({
      distanceProposalId: input.distanceProposalId,
      scenarioParticipantId: input.scenarioParticipantId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollCurrentRoundEndDistanceControlOnServer(input: {
  encounterId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/roll-current-distance-control`, {
    method: "POST",
  });
}

export async function rollRoundEndHealthCheckOnServer(input: {
  encounterId: string;
  healthRollId: string;
  scenarioParticipantId: string;
}): Promise<{
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/roll-health-check`, {
    body: JSON.stringify({
      healthRollId: input.healthRollId,
      scenarioParticipantId: input.scenarioParticipantId,
    }),
    method: "POST",
  });

  return payload;
}

export async function backOutPhaseAttackOnServer(input: {
  encounterId: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
}): Promise<{
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/back-out-phase-attack`, {
    body: JSON.stringify({
      phase: input.phase,
      scenarioParticipantId: input.scenarioParticipantId,
    }),
    method: "POST",
  });

  return payload;
}

export async function continuePhaseAttackOnServer(input: {
  encounterId: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
}): Promise<{
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/continue-phase-attack`, {
    body: JSON.stringify({
      phase: input.phase,
      scenarioParticipantId: input.scenarioParticipantId,
    }),
    method: "POST",
  });

  return payload;
}

export async function commitPhaseInitiativeResolutionOnServer(input: {
  encounterId: string;
  phase: "phase1" | "phase2";
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participants: ScenarioParticipant[];
}> {
  const payload = await sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participants: ScenarioParticipant[];
  }>(`/encounters/${input.encounterId}/combat-round/commit-phase-initiative-resolution`, {
    body: JSON.stringify({
      phase: input.phase,
    }),
    method: "POST",
  });

  return payload;
}

export async function setCombatExperienceDifficultyOnServer(input: {
  difficulty: number;
  encounterId: string;
}): Promise<{
  difficulty: number;
  encounter: EncounterSession;
}> {
  const payload = await sendJson<{
    difficulty: number;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/combat-experience-difficulty`, {
    body: JSON.stringify({
      difficulty: input.difficulty,
    }),
    method: "POST",
  });

  return payload;
}

export async function setPairDistanceOnServer(input: {
  distance: number;
  encounterId: string;
  participantAId: string;
  participantBId: string;
}): Promise<{
  edge?: CombatDistanceEdge;
  encounter: EncounterSession;
  participants?: ScenarioParticipant[];
}> {
  const payload = await sendJson<{
    edge?: CombatDistanceEdge;
    encounter: EncounterSession;
    participants?: ScenarioParticipant[];
  }>(`/encounters/${input.encounterId}/combat-round/pair-distance`, {
    body: JSON.stringify({
      distance: input.distance,
      participantAId: input.participantAId,
      participantBId: input.participantBId,
    }),
    method: "POST",
  });

  return payload;
}

export async function advanceCombatRoundCurrentStepOnServer(input: {
  encounterId: string;
  stepSnapshots?: CombatRoundStepSnapshot[];
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  const payload = await sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/advance-current-step`, {
    body: JSON.stringify({
      stepSnapshots: input.stepSnapshots,
    }),
    method: "POST",
  });

  return payload;
}

export async function skipCombatRoundCurrentActionOnServer(input: {
  encounterId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  const payload = await sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/skip-current-action`, {
    method: "POST",
  });

  return payload;
}

export async function advanceCurrentCombatPhaseResolutionOnServer(input: {
  encounterId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  const payload = await sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/advance-current-phase-resolution`, {
    method: "POST",
  });

  return payload;
}

export async function completeCurrentCombatPhaseResolutionOnServer(input: {
  encounterId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  const payload = await sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/complete-current-phase-resolution`, {
    method: "POST",
  });

  return payload;
}

export async function commitCurrentCombatPhaseDamageOnServer(input: {
  encounterId: string;
  review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/commit-phase-damage`, {
    body: JSON.stringify({ review: input.review }),
    method: "POST",
  });
}

export async function saveCurrentCombatDamageReviewOnServer(input: {
  encounterId: string;
  review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/save-damage-review`, {
    body: JSON.stringify({ review: input.review }),
    method: "POST",
  });
}

export async function rollCombatInitiativeOnServer(input: {
  encounterId: string;
  initiativeBase?: number;
  initiativeModifierAdjustment?: number;
  scenarioParticipantId: string;
}): Promise<{ encounter: EncounterSession; initiative: CombatRoundInitiativeResult }> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    initiative: CombatRoundInitiativeResult;
  }>(`/encounters/${input.encounterId}/combat-initiative`, {
    body: JSON.stringify({
      initiativeBase: input.initiativeBase,
      initiativeModifierAdjustment: input.initiativeModifierAdjustment,
      scenarioParticipantId: input.scenarioParticipantId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollCombatAttackOnServer(input: {
  actionId?: string;
  defenderDb?: number;
  defenderScenarioParticipantId: string;
  encounterId: string;
  ob?: number;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName?: string;
}): Promise<{
  attackResult: CombatRoundAttackRollResult;
  command?: CombatRoundCommand;
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant?: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    attackResult: CombatRoundAttackRollResult;
    command?: CombatRoundCommand;
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant?: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/roll-attack`, {
    body: JSON.stringify({
      actionId: input.actionId,
      defenderDb: input.defenderDb,
      defenderScenarioParticipantId: input.defenderScenarioParticipantId,
      ob: input.ob,
      phase: input.phase,
      scenarioParticipantId: input.scenarioParticipantId,
      weaponCriticalCode: input.weaponCriticalCode,
      weaponDamageClass: input.weaponDamageClass,
      weaponName: input.weaponName,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollCombatParryOnServer(input: {
  attackResultId: string;
  encounterId: string;
  mainHandParryScore?: number;
  modifierBreakdown: Array<{ label: string; value: number }>;
  offHandParryScore?: number;
  parryBase: number;
  parrySourceLabel?: string;
  scenarioParticipantId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-parry`,
    {
      body: JSON.stringify({
        attackResultId: input.attackResultId,
        mainHandParryScore: input.mainHandParryScore,
        modifierBreakdown: input.modifierBreakdown,
        offHandParryScore: input.offHandParryScore,
        parryBase: input.parryBase,
        parrySourceLabel: input.parrySourceLabel,
        scenarioParticipantId: input.scenarioParticipantId,
        usedMainHand: input.usedMainHand,
        usedOffHand: input.usedOffHand,
      }),
      method: "POST",
    },
  );

  return payload.encounter;
}

export async function rollCombatParryCommandOnServer(input: {
  attackResultId: string;
  encounterId: string;
  mainHandParryScore?: number;
  modifierBreakdown: Array<{ label: string; value: number }>;
  offHandParryScore?: number;
  parryBase: number;
  parrySourceLabel?: string;
  scenarioParticipantId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
}): Promise<{
  command?: CombatRoundCommand;
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  const payload = await sendJson<{
    command?: CombatRoundCommand;
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/roll-parry`, {
    body: JSON.stringify({
      attackResultId: input.attackResultId,
      mainHandParryScore: input.mainHandParryScore,
      modifierBreakdown: input.modifierBreakdown,
      offHandParryScore: input.offHandParryScore,
      parryBase: input.parryBase,
      parrySourceLabel: input.parrySourceLabel,
      scenarioParticipantId: input.scenarioParticipantId,
      usedMainHand: input.usedMainHand,
      usedOffHand: input.usedOffHand,
    }),
    method: "POST",
  });

  return payload;
}

export async function clearCurrentCombatRoundStepOnServer(input: {
  encounterId: string;
  participantId?: string;
  step?: CombatRoundStep;
}): Promise<{ encounter: EncounterSession; participants: ScenarioParticipant[] }> {
  const body =
    input.participantId || input.step
      ? JSON.stringify({
          participantId: input.participantId,
          step: input.step,
        })
      : undefined;
  const payload = await sendJson<{
    encounter: EncounterSession;
    participants: ScenarioParticipant[];
  }>(`/encounters/${input.encounterId}/combat-round/clear-current-step`, {
    body,
    method: "POST",
  });

  return payload;
}

export async function rollCombatHitLocationOnServer(input: {
  attackResultId: string;
  encounterId: string;
  scenarioParticipantId: string;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-hit-location`,
    {
      body: JSON.stringify({
        attackResultId: input.attackResultId,
        scenarioParticipantId: input.scenarioParticipantId,
      }),
      method: "POST",
    },
  );

  return payload.encounter;
}

export async function rollCombatCriticalOnServer(input: {
  attackResultId: string;
  encounterId: string;
  scenarioParticipantId: string;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-critical`,
    {
      body: JSON.stringify({
        attackResultId: input.attackResultId,
        scenarioParticipantId: input.scenarioParticipantId,
      }),
      method: "POST",
    },
  );

  return payload.encounter;
}

export async function submitPlayerRoleplayRollOnServer(input: {
  encounterId: string;
  pendingRollId: string;
  roll: {
    dieResult: number;
    openEndedD10s: number[];
    rollD20: number;
  };
  supportRoll?: {
    dieResult: number;
    openEndedD10s: number[];
    rollD20: number;
  };
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/player-roll`,
    {
      body: JSON.stringify({
        pendingRollId: input.pendingRollId,
        roll: input.roll,
        supportRoll: input.supportRoll,
      }),
      method: "POST",
    },
  );

  return payload.encounter;
}
