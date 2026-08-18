import type {
  EncounterSession,
  EncounterSessionRevision,
  ScenarioParticipant,
} from "@glantri/domain";

import { pollActiveEncounterRevision } from "./activeEncounterPolling";

export type GmCombatRefreshResult =
  | { kind: "unchanged" }
  | { kind: "stale" }
  | {
      encounter: EncounterSession;
      kind: "updated";
      participants: readonly ScenarioParticipant[];
      revision: string;
    };

/**
 * Loads one revision-bound GM combat snapshot. The second compact revision read prevents the GM
 * from adopting encounter state and participant context across two different accepted mutations.
 */
export async function pollGmCombatSnapshot(input: {
  acceptedRevision?: string;
  encounterId: string;
  loadEncounter: (encounterId: string) => Promise<EncounterSession>;
  loadParticipants: (scenarioId: string) => Promise<ScenarioParticipant[]>;
  loadRevision: (encounterId: string) => Promise<EncounterSessionRevision>;
}): Promise<GmCombatRefreshResult> {
  const encounterResult = await pollActiveEncounterRevision({
    acceptedRevision: input.acceptedRevision,
    encounterId: input.encounterId,
    loadEncounter: input.loadEncounter,
    loadRevision: input.loadRevision,
  });

  if (encounterResult.kind !== "updated") return encounterResult;
  const scenarioId = encounterResult.encounter.scenarioId;
  if (!scenarioId) return { kind: "stale" };

  const [participants, confirmedRevision] = await Promise.all([
    input.loadParticipants(scenarioId),
    input.loadRevision(input.encounterId),
  ]);
  if (
    confirmedRevision.encounterId !== input.encounterId ||
    confirmedRevision.revision !== encounterResult.encounter.updatedAt
  ) {
    return { kind: "stale" };
  }

  return {
    encounter: encounterResult.encounter,
    kind: "updated",
    participants,
    revision: confirmedRevision.revision,
  };
}
