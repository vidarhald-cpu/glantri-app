import type { EncounterSession } from "@glantri/domain";

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

export async function submitPlayerRoleplayRollOnServer(input: {
  encounterId: string;
  pendingRollId: string;
  roll: {
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
      }),
      method: "POST",
    },
  );

  return payload.encounter;
}
