import type {
  CombatAttackSourceRef,
  CombatHistoryProjection,
  CombatProgressionBoundaryKind,
  CombatRoundAttackRollResult,
  CombatRoundCommand,
  CombatRoundCommandEnvelope,
  CombatRoundDamageReview,
  CombatRoundCombatExperienceResult,
  CombatDistanceEdge,
  CombatRoundInitiativeResult,
  CombatRoundPhase,
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
  adjustDistance?: { requestedDistance: number; targetParticipantId: string };
  actionId?: string;
  additionalActionNotes?: string;
  combatContext: ScenarioParticipantCombatContext;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  movementId?: string;
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseAttackSources?: Partial<Record<"phase1" | "phase2", CombatAttackSourceRef>>;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
  scenarioParticipantId: string;
  secondaryActionId?: string;
  taskId: string;
  feint?: {
    attackerSkillId?: string;
    method: "movement" | "weapon";
    targetParticipantId: string;
  };
}): Promise<{
  commandEnvelope?: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    commandEnvelope?: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-declaration`, {
    body: JSON.stringify({
      actionId: input.actionId,
      adjustDistance: input.adjustDistance,
      additionalActionNotes: input.additionalActionNotes,
      combatContext: input.combatContext,
      movementId: input.movementId,
      movementIntent: input.movementIntent,
      phaseContexts: input.phaseContexts,
      phaseAttackSources: input.phaseAttackSources,
      phaseWeaponNames: input.phaseWeaponNames,
      feint: input.feint,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      scenarioParticipantId: input.scenarioParticipantId,
      secondaryActionId: input.secondaryActionId,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function respondCombatAdjustDistanceOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  proposalId: string;
  response: "allow" | "oppose";
  scenarioParticipantId: string;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/respond-adjust-distance`,
    { body: JSON.stringify(input), method: "POST" },
  );
  return payload.encounter;
}

export async function reviewCombatAdjustDistanceOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  notes?: string;
  participantId?: string;
  proposalId: string;
  value: number;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/review-adjust-distance`,
    { body: JSON.stringify(input), method: "POST" },
  );
  return payload.encounter;
}

export async function rollCombatAdjustDistanceOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  proposalId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-adjust-distance`,
    { body: JSON.stringify(input), method: "POST" },
  );
  return payload.encounter;
}

export async function commitCombatAdjustDistanceOnServer(input: {
  committedDistance: number;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  notes?: string;
  outcome: "successful" | "unsuccessful" | "allowed";
  proposalId: string;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/commit-adjust-distance`,
    { body: JSON.stringify(input), method: "POST" },
  );
  return payload.encounter;
}

export async function rollCombatFeintOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  proposalId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession }> {
  return sendJson(`/encounters/${input.encounterId}/combat-round/roll-feint`, {
    body: JSON.stringify({
      proposalId: input.proposalId,
      scenarioParticipantId: input.scenarioParticipantId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });
}

export async function commitCombatFeintOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  gmAttackerDbParryModifier?: number;
  gmDefenderDbParryModifier?: number;
  gmDefenderObDbModifier?: number;
  gmDefenderSkillObModifier?: number;
  notes?: string;
  proposalId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession; participants: ScenarioParticipant[] }> {
  return sendJson(`/encounters/${input.encounterId}/combat-round/commit-feint`, {
    body: JSON.stringify({
      gmAttackerDbParryModifier: input.gmAttackerDbParryModifier,
      gmDefenderDbParryModifier: input.gmDefenderDbParryModifier,
      gmDefenderObDbModifier: input.gmDefenderObDbModifier,
      gmDefenderSkillObModifier: input.gmDefenderSkillObModifier,
      notes: input.notes,
      proposalId: input.proposalId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });
}

export async function decideDoubleAttackPhase2OnServer(input: {
  decision: "continue" | "cancel";
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opportunityId?: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession; participant: ScenarioParticipant }> {
  return sendJson(`/encounters/${input.encounterId}/combat-round/double-attack-phase2-decision`, {
    body: JSON.stringify({
      decision: input.decision,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      opportunityId: input.opportunityId,
      scenarioParticipantId: input.scenarioParticipantId,
      taskId: input.taskId,
    }),
    method: "POST",
  });
}

export async function rollCombatExperienceOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opportunityId?: string;
  phase?: "phase1" | "phase2";
  scenarioParticipantId: string;
  taskId: string;
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
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      opportunityId: input.opportunityId,
      phase: input.phase,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollRoundEndDistanceControlOnServer(input: {
  distanceProposalId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opponentParticipantId: string;
  pairId: string;
  scenarioParticipantId: string;
  taskId: string;
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
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      opponentParticipantId: input.opponentParticipantId,
      pairId: input.pairId,
      scenarioParticipantId: input.scenarioParticipantId,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollCurrentRoundEndDistanceControlOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opponentParticipantId: string;
  pairId: string;
  participantId: string;
  proposalId: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/roll-current-distance-control`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function commitRoundEndDistanceControlOnServer(input: {
  distanceOverride?: number;
  distanceProposalId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  pairId: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/commit-distance-control`, {
    body: JSON.stringify({
      distanceOverride: input.distanceOverride,
      distanceProposalId: input.distanceProposalId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      pairId: input.pairId,
      taskId: input.taskId,
    }),
    method: "POST",
  });
}

export async function commitRoundEndParticipantReviewOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/commit-participant-review`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function rollRoundEndHealthCheckOnServer(input: {
  difficulty?: number;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  healthRollId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(`/encounters/${input.encounterId}/combat-round/roll-health-check`, {
    body: JSON.stringify({
      difficulty: input.difficulty,
      healthRollId: input.healthRollId,
      scenarioParticipantId: input.scenarioParticipantId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function backOutPhaseAttackOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  taskId: string;
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
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function continuePhaseAttackOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  taskId: string;
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
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function commitPhaseInitiativeResolutionOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  phase: "phase1" | "phase2";
  taskId: string;
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
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function setCombatExperienceDifficultyOnServer(input: {
  difficulty: number;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  taskId: string;
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
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
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
  commandType: "advance_combat_boundary" | "complete_round";
  encounterId: string;
  executionGroupId: string;
  expectedBoundary: CombatProgressionBoundaryKind;
  expectedRevision: string;
  stepSnapshots?: CombatRoundStepSnapshot[];
  taskId: string;
  targetBoundary: CombatProgressionBoundaryKind;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participants: ScenarioParticipant[];
}> {
  const payload = await sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participants: ScenarioParticipant[];
  }>(`/encounters/${input.encounterId}/combat-round/advance-current-step`, {
    body: JSON.stringify({
      commandType: input.commandType,
      executionGroupId: input.executionGroupId,
      expectedBoundary: input.expectedBoundary,
      expectedRevision: input.expectedRevision,
      stepSnapshots: input.stepSnapshots,
      taskId: input.taskId,
      targetBoundary: input.targetBoundary,
    }),
    method: "POST",
  });

  return payload;
}

export async function prepareCombatRoundEndReviewOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession }> {
  return sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/prepare-round-end-review`,
    {
      body: JSON.stringify({
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
  );
}

export interface CombatDownstreamTaskRequestIdentity {
  attackResultId: string;
  attackerParticipantId: string;
  criticalResultId: string;
  damageRollExpression?: string;
  damageReviewId: string;
  defenderParticipantId: string;
  executionGroupId: string;
  expectedRevision: string;
  hitLocationResultId: string;
  opportunityId?: string;
  phase: CombatRoundPhase;
  taskId: string;
}

export async function commitCurrentCombatPhaseDamageOnServer(
  input: CombatDownstreamTaskRequestIdentity & {
    commandType: "commit_phase_damage";
    encounterId: string;
    review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
  },
): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/commit-phase-damage`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function saveCurrentCombatDamageReviewOnServer(
  input: CombatDownstreamTaskRequestIdentity & {
    commandType: "commit_phase_damage";
    encounterId: string;
    review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
  },
): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/save-damage-review`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function resolveCurrentCombatPhaseDamageOnServer(
  input: CombatDownstreamTaskRequestIdentity & {
    commandType: "resolve_damage";
    encounterId: string;
    scenarioParticipantId?: string;
  },
): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(`/encounters/${input.encounterId}/combat-round/resolve-phase-damage`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function rollCombatInitiativeOnServer(input: {
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  initiativeBase?: number;
  initiativeModifierAdjustment?: number;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession; initiative: CombatRoundInitiativeResult }> {
  const payload = await sendJson<{
    encounter: EncounterSession;
    initiative: CombatRoundInitiativeResult;
  }>(`/encounters/${input.encounterId}/combat-initiative`, {
    body: JSON.stringify({
      initiativeBase: input.initiativeBase,
      initiativeModifierAdjustment: input.initiativeModifierAdjustment,
      scenarioParticipantId: input.scenarioParticipantId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      taskId: input.taskId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollCombatAttackOnServer(input: {
  actionId?: string;
  attackIndex: number;
  attackModeId: string;
  attackerModifierFingerprint?: string;
  defenderDb?: number;
  defenderDbParryRaw?: number;
  defenderModifierFingerprint?: string;
  declarationId: string;
  defenderParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  modifierValidationTaskId?: string;
  ob: number;
  obSkillRaw: number;
  opportunityId: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  taskId: string;
  weaponInstanceId?: string;
  weaponSourceId: string;
  weaponSourceSlot: string;
  weaponTemplateId: string;
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
      attackIndex: input.attackIndex,
      attackModeId: input.attackModeId,
      attackerModifierFingerprint: input.attackerModifierFingerprint,
      defenderDb: input.defenderDb,
      defenderDbParryRaw: input.defenderDbParryRaw,
      defenderModifierFingerprint: input.defenderModifierFingerprint,
      declarationId: input.declarationId,
      defenderParticipantId: input.defenderParticipantId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      modifierValidationTaskId: input.modifierValidationTaskId,
      ob: input.ob,
      obSkillRaw: input.obSkillRaw,
      opportunityId: input.opportunityId,
      phase: input.phase,
      scenarioParticipantId: input.scenarioParticipantId,
      taskId: input.taskId,
      weaponInstanceId: input.weaponInstanceId,
      weaponSourceId: input.weaponSourceId,
      weaponSourceSlot: input.weaponSourceSlot,
      weaponTemplateId: input.weaponTemplateId,
    }),
    method: "POST",
  });

  return payload;
}

export async function rollCombatParryOnServer(input: {
  attackResultId: string;
  attackerParticipantId: string;
  dbParryRaw: number;
  defenderParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  mainHandParryScore?: number;
  offHandParryScore?: number;
  opportunityId?: string;
  parryBase: number;
  parrySourceLabel?: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  taskId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-parry`,
    {
      body: JSON.stringify({
        attackResultId: input.attackResultId,
        attackerParticipantId: input.attackerParticipantId,
        dbParryRaw: input.dbParryRaw,
        defenderParticipantId: input.defenderParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        mainHandParryScore: input.mainHandParryScore,
        offHandParryScore: input.offHandParryScore,
        opportunityId: input.opportunityId,
        parryBase: input.parryBase,
        parrySourceLabel: input.parrySourceLabel,
        phase: input.phase,
        scenarioParticipantId: input.scenarioParticipantId,
        taskId: input.taskId,
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
  attackerParticipantId: string;
  dbParryRaw: number;
  defenderParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  mainHandParryScore?: number;
  offHandParryScore?: number;
  opportunityId?: string;
  parryBase: number;
  parrySourceLabel?: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  taskId: string;
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
      attackerParticipantId: input.attackerParticipantId,
      dbParryRaw: input.dbParryRaw,
      defenderParticipantId: input.defenderParticipantId,
      executionGroupId: input.executionGroupId,
      expectedRevision: input.expectedRevision,
      mainHandParryScore: input.mainHandParryScore,
      offHandParryScore: input.offHandParryScore,
      opportunityId: input.opportunityId,
      parryBase: input.parryBase,
      parrySourceLabel: input.parrySourceLabel,
      phase: input.phase,
      scenarioParticipantId: input.scenarioParticipantId,
      taskId: input.taskId,
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

export async function rollCombatHitLocationOnServer(
  input: Omit<CombatDownstreamTaskRequestIdentity, "criticalResultId" | "damageReviewId"> & {
    encounterId: string;
    scenarioParticipantId: string;
  },
): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-hit-location`,
    {
      body: JSON.stringify(input),
      method: "POST",
    },
  );

  return payload.encounter;
}

export async function rollCombatCriticalOnServer(
  input: Omit<CombatDownstreamTaskRequestIdentity, "damageReviewId"> & {
    encounterId: string;
    scenarioParticipantId: string;
  },
): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-critical`,
    {
      body: JSON.stringify(input),
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
