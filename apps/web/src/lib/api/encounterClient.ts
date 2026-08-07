import {
  activeCombatMutationResponseSchema,
  applyActiveCombatMutationResponse,
  type ActiveCombatDeterministicAdvanceDescriptor,
  encounterSessionRevisionSchema,
  encounterSessionSummarySchema,
  type EncounterSessionRevision,
  type EncounterSessionSummary,
  CombatAttackSourceRef,
  CombatHistoryProjection,
  CombatProgressionBoundaryKind,
  CombatParryPurpose,
  CombatRoundAttackRollResult,
  CombatRoundBulkStepBlocker,
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
  ScenarioParticipantSecondaryActionContext,
} from "@glantri/domain";

import { sendJson } from "./apiClient";
import {
  combatPerformanceNow,
  getCombatPerformanceRequestHeaders,
  recordCombatPerformanceStage,
} from "../performance/combatPerformance";

const ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER = "x-glantri-combat-response";
const ACTIVE_COMBAT_MUTATION_RESPONSE_VERSION = "active-v1";

function combatMutationBody(input: { currentEncounter?: EncounterSession }): string {
  const { currentEncounter: _localAuthoritativeState, ...requestBody } = input;
  return JSON.stringify(requestBody);
}

async function sendCombatMutationJson<TResponse extends object>(
  path: string,
  init: Omit<RequestInit, "credentials">,
  currentEncounter?: EncounterSession,
): Promise<TResponse> {
  if (!currentEncounter) {
    return sendJson<TResponse>(path, init);
  }

  let body = init.body;
  if (typeof body === "string") {
    const parsedBody = JSON.parse(body) as Record<string, unknown>;
    delete parsedBody.currentEncounter;
    body = JSON.stringify(parsedBody);
  }
  const responsePayload = await sendJson<unknown>(path, {
    ...init,
    body,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      [ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER]: ACTIVE_COMBAT_MUTATION_RESPONSE_VERSION,
      ...getCombatPerformanceRequestHeaders(),
    },
  });
  const activeResponseStartedAt = combatPerformanceNow();
  const compact = activeCombatMutationResponseSchema.parse(responsePayload);
  const updatedParticipants = compact.updatedParticipants;
  const nextEncounter = applyActiveCombatMutationResponse({
    currentEncounter,
    response: compact,
  });
  recordCombatPerformanceStage(
    "active_response_parse_and_projection",
    combatPerformanceNow() - activeResponseStartedAt,
  );

  return {
    ...(compact.mutationPresentation ?? {}),
    commandEnvelope: compact.commandEnvelope,
    deterministicAdvance: compact.deterministicAdvance,
    encounter: nextEncounter,
    participant: updatedParticipants?.[0],
    participants: updatedParticipants,
  } as TResponse;
}

export async function loadScenarioEncounters(scenarioId: string): Promise<EncounterSession[]> {
  const payload = await sendJson<{ encounters: EncounterSession[] }>(
    `/scenarios/${scenarioId}/encounters`,
    {
      method: "GET",
    },
  );

  return payload.encounters;
}

export async function loadScenarioEncounterSummaries(
  scenarioId: string,
): Promise<EncounterSessionSummary[]> {
  const payload = await sendJson<{ encounters: unknown[] }>(
    `/scenarios/${scenarioId}/encounter-summaries`,
    {
      method: "GET",
    },
  );

  return payload.encounters.map((encounter) => encounterSessionSummarySchema.parse(encounter));
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
    cache: "no-store",
    method: "GET",
  });

  return payload.encounter;
}

export async function loadEncounterRevision(
  encounterId: string,
): Promise<EncounterSessionRevision> {
  const payload = await sendJson<{ encounter: unknown }>(`/encounters/${encounterId}/revision`, {
    cache: "no-store",
    method: "GET",
  });

  return encounterSessionRevisionSchema.parse(payload.encounter);
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
  expectedParticipantRevision?: string;
  movementId?: string;
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseAttackSources?: Partial<Record<"phase1" | "phase2", CombatAttackSourceRef>>;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
  reviewStepSnapshot?: CombatRoundStepSnapshot;
  scenarioParticipantId: string;
  secondaryActionContext?: ScenarioParticipantSecondaryActionContext;
  secondaryActionId?: string;
  taskId: string;
  currentEncounter?: EncounterSession;
  feint?: {
    attackerSkillId?: string;
    method: "movement" | "weapon";
    targetParticipantId: string;
  };
}): Promise<{
  commandEnvelope?: CombatRoundCommandEnvelope;
  deterministicAdvance?: ActiveCombatDeterministicAdvanceDescriptor;
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendCombatMutationJson<{
    commandEnvelope?: CombatRoundCommandEnvelope;
    deterministicAdvance?: ActiveCombatDeterministicAdvanceDescriptor;
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-declaration`,
    {
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
        reviewStepSnapshot: input.reviewStepSnapshot,
        feint: input.feint,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        expectedParticipantRevision: input.expectedParticipantRevision,
        scenarioParticipantId: input.scenarioParticipantId,
        secondaryActionContext: input.secondaryActionContext,
        secondaryActionId: input.secondaryActionId,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function respondCombatAdjustDistanceOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  proposalId: string;
  response: "allow" | "oppose";
  scenarioParticipantId: string;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/respond-adjust-distance`,
    { body: combatMutationBody(input), method: "POST" },
    input.currentEncounter,
  );
  return payload.encounter;
}

export async function reviewCombatAdjustDistanceOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  notes?: string;
  participantId?: string;
  proposalId: string;
  value: number;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/review-adjust-distance`,
    { body: combatMutationBody(input), method: "POST" },
    input.currentEncounter,
  );
  return payload.encounter;
}

export async function rollCombatAdjustDistanceOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  proposalId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-adjust-distance`,
    { body: combatMutationBody(input), method: "POST" },
    input.currentEncounter,
  );
  return payload.encounter;
}

export async function commitCombatAdjustDistanceOnServer(input: {
  currentEncounter?: EncounterSession;
  committedDistance: number;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  notes?: string;
  outcome: "successful" | "unsuccessful" | "allowed";
  proposalId: string;
  taskId: string;
}): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/commit-adjust-distance`,
    { body: combatMutationBody(input), method: "POST" },
    input.currentEncounter,
  );
  return payload.encounter;
}

export async function rollCombatFeintOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  proposalId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession }> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    completedParticipantIds: string[];
    encounter: EncounterSession;
    stoppedAtParticipantId?: string;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-feint`,
    {
      body: JSON.stringify({
        proposalId: input.proposalId,
        scenarioParticipantId: input.scenarioParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function commitCombatFeintOnServer(input: {
  currentEncounter?: EncounterSession;
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
  return sendCombatMutationJson(
    `/encounters/${input.encounterId}/combat-round/commit-feint`,
    {
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
    },
    input.currentEncounter,
  );
}

export async function decideDoubleAttackPhase2OnServer(input: {
  currentEncounter?: EncounterSession;
  decision: "continue" | "cancel";
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opportunityId?: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession; participant: ScenarioParticipant }> {
  return sendCombatMutationJson(
    `/encounters/${input.encounterId}/combat-round/double-attack-phase2-decision`,
    {
      body: JSON.stringify({
        decision: input.decision,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        opportunityId: input.opportunityId,
        scenarioParticipantId: input.scenarioParticipantId,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function rollCombatExperienceOnServer(input: {
  currentEncounter?: EncounterSession;
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
  const payload = await sendCombatMutationJson<{
    combatExperience: CombatRoundCombatExperienceResult;
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-combat-experience`,
    {
      body: JSON.stringify({
        scenarioParticipantId: input.scenarioParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        opportunityId: input.opportunityId,
        phase: input.phase,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function rollRoundEndDistanceControlOnServer(input: {
  currentEncounter?: EncounterSession;
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
  const payload = await sendCombatMutationJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-distance-control`,
    {
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
    },
    input.currentEncounter,
  );

  return payload;
}

export async function rollCurrentRoundEndDistanceControlOnServer(input: {
  currentEncounter?: EncounterSession;
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
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-current-distance-control`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function commitRoundEndDistanceControlOnServer(input: {
  currentEncounter?: EncounterSession;
  chosenDistance?: number;
  distanceOverride?: number;
  distanceProposalId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  pairId: string;
  scenarioParticipantId?: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/commit-distance-control`,
    {
      body: JSON.stringify({
        chosenDistance: input.chosenDistance,
        distanceOverride: input.distanceOverride,
        distanceProposalId: input.distanceProposalId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        pairId: input.pairId,
        scenarioParticipantId: input.scenarioParticipantId,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function chooseRoundEndContinuedContactDistanceOnServer(input: {
  currentEncounter?: EncounterSession;
  chosenDistance: number;
  distanceProposalId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  pairId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{
  command?: CombatRoundCommand;
  commandEnvelope?: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant?: ScenarioParticipant;
}> {
  return sendCombatMutationJson<{
    command?: CombatRoundCommand;
    commandEnvelope?: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant?: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/commit-distance-control`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function commitRoundEndParticipantReviewOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  expectedParticipantRevision: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/commit-participant-review`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function rollRoundEndHealthCheckOnServer(input: {
  currentEncounter?: EncounterSession;
  difficulty?: number;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  expectedParticipantRevision: string;
  healthRollId: string;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{
  encounter: EncounterSession;
  participant: ScenarioParticipant;
}> {
  const payload = await sendCombatMutationJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-health-check`,
    {
      body: JSON.stringify({
        difficulty: input.difficulty,
        healthRollId: input.healthRollId,
        scenarioParticipantId: input.scenarioParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        expectedParticipantRevision: input.expectedParticipantRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function backOutPhaseAttackOnServer(input: {
  currentEncounter?: EncounterSession;
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
  const payload = await sendCombatMutationJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/back-out-phase-attack`,
    {
      body: JSON.stringify({
        phase: input.phase,
        scenarioParticipantId: input.scenarioParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function continuePhaseAttackOnServer(input: {
  currentEncounter?: EncounterSession;
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
  const payload = await sendCombatMutationJson<{
    encounter: EncounterSession;
    participant: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/continue-phase-attack`,
    {
      body: JSON.stringify({
        phase: input.phase,
        scenarioParticipantId: input.scenarioParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function commitPhaseInitiativeResolutionOnServer(input: {
  currentEncounter?: EncounterSession;
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
  const payload = await sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participants: ScenarioParticipant[];
  }>(
    `/encounters/${input.encounterId}/combat-round/commit-phase-initiative-resolution`,
    {
      body: JSON.stringify({
        phase: input.phase,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function setCombatExperienceDifficultyOnServer(input: {
  currentEncounter?: EncounterSession;
  difficulty: number;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  taskId: string;
}): Promise<{
  difficulty: number;
  encounter: EncounterSession;
}> {
  const payload = await sendCombatMutationJson<{
    difficulty: number;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/combat-experience-difficulty`,
    {
      body: JSON.stringify({
        difficulty: input.difficulty,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function setPairDistanceOnServer(input: {
  currentEncounter?: EncounterSession;
  distance: number;
  encounterId: string;
  participantAId: string;
  participantBId: string;
}): Promise<{
  edge?: CombatDistanceEdge;
  encounter: EncounterSession;
  participants?: ScenarioParticipant[];
}> {
  const payload = await sendCombatMutationJson<{
    edge?: CombatDistanceEdge;
    encounter: EncounterSession;
    participants?: ScenarioParticipant[];
  }>(
    `/encounters/${input.encounterId}/combat-round/pair-distance`,
    {
      body: JSON.stringify({
        distance: input.distance,
        participantAId: input.participantAId,
        participantBId: input.participantBId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

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
  currentEncounter?: EncounterSession;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participants: ScenarioParticipant[];
}> {
  const payload = await sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participants: ScenarioParticipant[];
  }>(
    `/encounters/${input.encounterId}/combat-round/advance-current-step`,
    {
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
    },
    input.currentEncounter,
  );

  return payload;
}

export async function prepareCombatRoundEndReviewOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession }> {
  return sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/prepare-round-end-review`,
    {
      body: JSON.stringify({
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function advanceDeterministicCombatOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  executedTaskIds: string[];
  participants: ScenarioParticipant[];
  stopReason: string;
}> {
  return sendCombatMutationJson(
    `/encounters/${input.encounterId}/combat-round/advance-deterministic`,
    {
      body: JSON.stringify({
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
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
    currentEncounter?: EncounterSession;
    encounterId: string;
    review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
  },
): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/commit-phase-damage`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function saveCurrentCombatDamageReviewOnServer(
  input: CombatDownstreamTaskRequestIdentity & {
    commandType: "commit_phase_damage";
    currentEncounter?: EncounterSession;
    encounterId: string;
    review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
  },
): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/save-damage-review`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function resolveCurrentCombatPhaseDamageOnServer(
  input: CombatDownstreamTaskRequestIdentity & {
    commandType: "resolve_damage";
    currentEncounter?: EncounterSession;
    encounterId: string;
    scenarioParticipantId?: string;
  },
): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/resolve-phase-damage`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function rollCombatInitiativeOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  initiativeBase?: number;
  initiativeModifierAdjustment?: number;
  scenarioParticipantId: string;
  taskId: string;
}): Promise<{ encounter: EncounterSession; initiative: CombatRoundInitiativeResult }> {
  const payload = await sendCombatMutationJson<{
    encounter: EncounterSession;
    initiative: CombatRoundInitiativeResult;
  }>(
    `/encounters/${input.encounterId}/combat-initiative`,
    {
      body: JSON.stringify({
        initiativeBase: input.initiativeBase,
        initiativeModifierAdjustment: input.initiativeModifierAdjustment,
        scenarioParticipantId: input.scenarioParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function completeRemainingCombatStepOnServer(input: {
  currentEncounter: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  participantId?: string;
  phase: CombatRoundPhase;
  processId?: string;
  stageId?: string;
  taskId: string;
}): Promise<{
  blocker?: CombatRoundBulkStepBlocker;
  commandEnvelope: CombatRoundCommandEnvelope;
  completedParticipantIds: string[];
  encounter: EncounterSession;
  participants: ScenarioParticipant[];
  stoppedAtParticipantId?: string;
}> {
  return sendCombatMutationJson(
    `/encounters/${input.encounterId}/combat-round/complete-remaining-step`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function skipCurrentCombatPhaseActionOnServer(input: {
  currentEncounter: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  participantId: string;
  phase: CombatRoundPhase;
  processId?: string;
  stageId?: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/skip-current-phase-action`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function rollCombatAttackOnServer(input: {
  actionId?: string;
  attackIndex: number;
  attackModeId: string;
  attackerModifierFingerprint?: string;
  effectCutoffInitiativeGroupId?: string;
  declarationId: string;
  defenderParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
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
  currentEncounter?: EncounterSession;
}): Promise<{
  attackResult: CombatRoundAttackRollResult;
  command?: CombatRoundCommand;
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant?: ScenarioParticipant;
}> {
  const payload = await sendCombatMutationJson<{
    attackResult: CombatRoundAttackRollResult;
    command?: CombatRoundCommand;
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant?: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-attack`,
    {
      body: JSON.stringify({
        actionId: input.actionId,
        attackIndex: input.attackIndex,
        attackModeId: input.attackModeId,
        attackerModifierFingerprint: input.attackerModifierFingerprint,
        effectCutoffInitiativeGroupId: input.effectCutoffInitiativeGroupId,
        declarationId: input.declarationId,
        defenderParticipantId: input.defenderParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        initiativeGroupId: input.initiativeGroupId,
        initiativeValue: input.initiativeValue,
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
    },
    input.currentEncounter,
  );

  return payload;
}

export async function rollCombatParryOnServer(input: {
  attackResultModifier: number;
  attackResultId: string;
  attackerParticipantId: string;
  commandType: "roll_parry";
  dbParryRaw: number;
  defenderModifierFingerprint: string;
  declarationId?: string;
  declaredOpponentParticipantId?: string;
  defenderParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  effectCutoffInitiativeGroupId?: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  mainHandParryScore?: number;
  modifierValidationTaskId: string;
  offHandParryScore?: number;
  offensiveParryAttemptId?: string;
  opportunityId: string;
  parryBase: number;
  parryPurpose: CombatParryPurpose;
  parrySourceId: string;
  parrySourceLabel?: string;
  phase: "phase1" | "phase2";
  processId: string;
  scenarioParticipantId: string;
  taskId: string;
  stageId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
  currentEncounter?: EncounterSession;
}): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-parry`,
    {
      body: JSON.stringify({
        attackResultModifier: input.attackResultModifier,
        attackResultId: input.attackResultId,
        attackerParticipantId: input.attackerParticipantId,
        commandType: input.commandType,
        dbParryRaw: input.dbParryRaw,
        defenderModifierFingerprint: input.defenderModifierFingerprint,
        declarationId: input.declarationId,
        declaredOpponentParticipantId: input.declaredOpponentParticipantId,
        defenderParticipantId: input.defenderParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        effectCutoffInitiativeGroupId: input.effectCutoffInitiativeGroupId,
        initiativeGroupId: input.initiativeGroupId,
        initiativeValue: input.initiativeValue,
        mainHandParryScore: input.mainHandParryScore,
        modifierValidationTaskId: input.modifierValidationTaskId,
        offHandParryScore: input.offHandParryScore,
        offensiveParryAttemptId: input.offensiveParryAttemptId,
        opportunityId: input.opportunityId,
        parryBase: input.parryBase,
        parryPurpose: input.parryPurpose,
        parrySourceId: input.parrySourceId,
        parrySourceLabel: input.parrySourceLabel,
        phase: input.phase,
        processId: input.processId,
        scenarioParticipantId: input.scenarioParticipantId,
        taskId: input.taskId,
        stageId: input.stageId,
        usedMainHand: input.usedMainHand,
        usedOffHand: input.usedOffHand,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload.encounter;
}

export async function rollOffensiveParryBrawlingOnServer(input: {
  attackResultId: string;
  contestId: string;
  declarationId: string;
  declaredOpponentParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opponentParticipantId: string;
  offensiveParryAttemptId: string;
  opportunityId: string;
  parryResultId: string;
  phase: "phase1" | "phase2";
  processId: string;
  scenarioParticipantId: string;
  stageId: string;
  taskId: string;
  currentEncounter?: EncounterSession;
}): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-offensive-parry-brawling`,
    {
      body: JSON.stringify({
        attackResultId: input.attackResultId,
        contestId: input.contestId,
        declarationId: input.declarationId,
        declaredOpponentParticipantId: input.declaredOpponentParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        opponentParticipantId: input.opponentParticipantId,
        offensiveParryAttemptId: input.offensiveParryAttemptId,
        opportunityId: input.opportunityId,
        parryResultId: input.parryResultId,
        phase: input.phase,
        processId: input.processId,
        rollPurpose: "offensive_parry_brawling",
        scenarioParticipantId: input.scenarioParticipantId,
        stageId: input.stageId,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
  return payload.encounter;
}

export async function rollContinuedContactMaintenanceOnServer(input: {
  currentEncounter?: EncounterSession;
  contestId: string;
  continuedContactId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  opponentParticipantId: string;
  processId: string;
  scenarioParticipantId: string;
  stageId: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant?: ScenarioParticipant;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
    participant?: ScenarioParticipant;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-continued-contact-maintenance`,
    {
      body: JSON.stringify({
        commandType: "roll_continued_contact_maintenance",
        contestId: input.contestId,
        continuedContactId: input.continuedContactId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        opponentParticipantId: input.opponentParticipantId,
        processId: input.processId,
        rollPurpose: "escape_continued_contact",
        scenarioParticipantId: input.scenarioParticipantId,
        stageId: input.stageId,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function rollCombatObservationOnServer(input: {
  currentEncounter?: EncounterSession;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  observationAttemptId: string;
  opponentParticipantId: string;
  processId: string;
  relationshipId: string;
  scenarioParticipantId: string;
  stageId: string;
  taskId: string;
}): Promise<{
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  return sendCombatMutationJson<{
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-observation`,
    {
      body: JSON.stringify({
        commandType: "roll_observation",
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        observationAttemptId: input.observationAttemptId,
        opponentParticipantId: input.opponentParticipantId,
        processId: input.processId,
        relationshipId: input.relationshipId,
        scenarioParticipantId: input.scenarioParticipantId,
        stageId: input.stageId,
        taskId: input.taskId,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );
}

export async function rollCombatParryCommandOnServer(input: {
  attackResultModifier: number;
  attackResultId: string;
  attackerParticipantId: string;
  commandType: "roll_parry";
  dbParryRaw: number;
  defenderModifierFingerprint: string;
  declarationId?: string;
  declaredOpponentParticipantId?: string;
  defenderParticipantId: string;
  encounterId: string;
  executionGroupId: string;
  expectedRevision: string;
  effectCutoffInitiativeGroupId?: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  mainHandParryScore?: number;
  modifierValidationTaskId: string;
  offHandParryScore?: number;
  offensiveParryAttemptId?: string;
  opportunityId: string;
  parryBase: number;
  parryPurpose: CombatParryPurpose;
  parrySourceId: string;
  parrySourceLabel?: string;
  phase: "phase1" | "phase2";
  processId: string;
  scenarioParticipantId: string;
  taskId: string;
  stageId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
  currentEncounter?: EncounterSession;
}): Promise<{
  command?: CombatRoundCommand;
  commandEnvelope: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}> {
  const payload = await sendCombatMutationJson<{
    command?: CombatRoundCommand;
    commandEnvelope: CombatRoundCommandEnvelope;
    encounter: EncounterSession;
  }>(
    `/encounters/${input.encounterId}/combat-round/roll-parry`,
    {
      body: JSON.stringify({
        attackResultModifier: input.attackResultModifier,
        attackResultId: input.attackResultId,
        attackerParticipantId: input.attackerParticipantId,
        commandType: input.commandType,
        dbParryRaw: input.dbParryRaw,
        defenderModifierFingerprint: input.defenderModifierFingerprint,
        declarationId: input.declarationId,
        declaredOpponentParticipantId: input.declaredOpponentParticipantId,
        defenderParticipantId: input.defenderParticipantId,
        executionGroupId: input.executionGroupId,
        expectedRevision: input.expectedRevision,
        effectCutoffInitiativeGroupId: input.effectCutoffInitiativeGroupId,
        initiativeGroupId: input.initiativeGroupId,
        initiativeValue: input.initiativeValue,
        mainHandParryScore: input.mainHandParryScore,
        modifierValidationTaskId: input.modifierValidationTaskId,
        offHandParryScore: input.offHandParryScore,
        offensiveParryAttemptId: input.offensiveParryAttemptId,
        opportunityId: input.opportunityId,
        parryBase: input.parryBase,
        parryPurpose: input.parryPurpose,
        parrySourceId: input.parrySourceId,
        parrySourceLabel: input.parrySourceLabel,
        phase: input.phase,
        processId: input.processId,
        scenarioParticipantId: input.scenarioParticipantId,
        taskId: input.taskId,
        stageId: input.stageId,
        usedMainHand: input.usedMainHand,
        usedOffHand: input.usedOffHand,
      }),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function clearCurrentCombatRoundStepOnServer(input: {
  currentEncounter?: EncounterSession;
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
  const payload = await sendCombatMutationJson<{
    encounter: EncounterSession;
    participants: ScenarioParticipant[];
  }>(
    `/encounters/${input.encounterId}/combat-round/clear-current-step`,
    {
      body,
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload;
}

export async function rollCombatHitLocationOnServer(
  input: Omit<CombatDownstreamTaskRequestIdentity, "criticalResultId" | "damageReviewId"> & {
    currentEncounter?: EncounterSession;
    encounterId: string;
    scenarioParticipantId: string;
  },
): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-hit-location`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
  );

  return payload.encounter;
}

export async function rollCombatCriticalOnServer(
  input: Omit<CombatDownstreamTaskRequestIdentity, "damageReviewId"> & {
    currentEncounter?: EncounterSession;
    encounterId: string;
    scenarioParticipantId: string;
  },
): Promise<EncounterSession> {
  const payload = await sendCombatMutationJson<{ encounter: EncounterSession }>(
    `/encounters/${input.encounterId}/combat-round/roll-critical`,
    {
      body: combatMutationBody(input),
      method: "POST",
    },
    input.currentEncounter,
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
