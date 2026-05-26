import type { EncounterSession, ScenarioParticipant, ScenarioParticipantCombatContext } from "@glantri/domain";

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

export async function updateEncounterOnServer(input: {
  encounterId: string;
  session: EncounterSession;
}): Promise<EncounterSession> {
  const payload = await sendJson<{ encounter: EncounterSession }>(`/encounters/${input.encounterId}`, {
    body: JSON.stringify({
      session: input.session,
    }),
    method: "PUT",
  });

  return payload.encounter;
}

export async function submitCombatDeclarationOnServer(input: {
  actionId?: string;
  additionalActionNotes?: string;
  combatContext: ScenarioParticipantCombatContext;
  encounterId: string;
  movementId?: string;
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
        scenarioParticipantId: input.scenarioParticipantId,
        secondaryActionId: input.secondaryActionId,
      }),
      method: "POST",
    },
  );

  return payload;
}

export async function rollCombatInitiativeOnServer(input: {
  encounterId: string;
  scenarioParticipantId: string;
}): Promise<{ encounter: EncounterSession; initiative: number }> {
  const payload = await sendJson<{ encounter: EncounterSession; initiative: number }>(
    `/encounters/${input.encounterId}/combat-initiative`,
    {
      body: JSON.stringify({
        scenarioParticipantId: input.scenarioParticipantId,
      }),
      method: "POST",
    },
  );

  return payload;
}

export async function clearCurrentCombatRoundStepOnServer(input: {
  encounterId: string;
}): Promise<{ encounter: EncounterSession; participants: ScenarioParticipant[] }> {
  const payload = await sendJson<{ encounter: EncounterSession; participants: ScenarioParticipant[] }>(
    `/encounters/${input.encounterId}/combat-round/clear-current-step`,
    {
      method: "POST",
    },
  );

  return payload;
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
