import type {
  CombatHistoryProjection,
  EncounterSession,
  EncounterSessionRevision,
  ScenarioParticipant,
} from "@glantri/domain";

import { pollActiveEncounterRevision } from "./activeEncounterPolling";

export async function loadPlayerCombatSlowContext<TContent, TParticipant, TProjection>(input: {
  loadContent: () => Promise<TContent>;
  loadParticipants: () => Promise<TParticipant[]>;
  loadProjection: () => Promise<TProjection>;
}): Promise<{
  content: TContent;
  participants: TParticipant[];
  projection: TProjection;
}> {
  const [projection, content, participants] = await Promise.all([
    input.loadProjection(),
    input.loadContent(),
    input.loadParticipants(),
  ]);

  return { content, participants, projection };
}

export interface PlayerCombatHistoryIdentity {
  encounterId: string;
  perspectiveParticipantId?: string;
  revision: string;
}

export interface RevisionKeyedCombatHistory {
  history: CombatHistoryProjection;
  identity: PlayerCombatHistoryIdentity;
}

export type PlayerCombatSnapshotPollResult =
  | { kind: "unchanged" }
  | { kind: "stale" }
  | {
      encounter: EncounterSession;
      history: RevisionKeyedCombatHistory;
      kind: "updated";
      participants: readonly ScenarioParticipant[];
    };

/** Loads one player-safe operational snapshot and adopts nothing until every revision agrees. */
export async function pollPlayerCombatSnapshot(input: {
  acceptedRevision?: string;
  encounterId: string;
  loadEncounter: (encounterId: string) => Promise<EncounterSession>;
  loadHistory: (encounter: EncounterSession) => Promise<RevisionKeyedCombatHistory>;
  loadParticipants: (scenarioId: string) => Promise<ScenarioParticipant[]>;
  loadRevision: (encounterId: string) => Promise<EncounterSessionRevision>;
  onNewerRevision?: (revision: EncounterSessionRevision) => void;
}): Promise<PlayerCombatSnapshotPollResult> {
  const encounterResult = await pollActiveEncounterRevision({
    acceptedRevision: input.acceptedRevision,
    encounterId: input.encounterId,
    loadEncounter: input.loadEncounter,
    loadRevision: input.loadRevision,
    onNewerRevision: input.onNewerRevision,
  });
  if (encounterResult.kind !== "updated") return encounterResult;
  if (!encounterResult.encounter.scenarioId) return { kind: "stale" };

  const [history, participants, confirmedRevision] = await Promise.all([
    input.loadHistory(encounterResult.encounter),
    input.loadParticipants(encounterResult.encounter.scenarioId),
    input.loadRevision(input.encounterId),
  ]);
  if (
    confirmedRevision.encounterId !== input.encounterId ||
    confirmedRevision.revision !== encounterResult.encounter.updatedAt ||
    history.identity.encounterId !== input.encounterId ||
    history.identity.revision !== confirmedRevision.revision ||
    history.history.sourceEncounterId !== input.encounterId ||
    history.history.sourceUpdatedAt !== confirmedRevision.revision
  ) {
    return { kind: "stale" };
  }

  return {
    encounter: encounterResult.encounter,
    history,
    kind: "updated",
    participants,
  };
}

export function getPlayerCombatHistoryRequestKey(
  identity: PlayerCombatHistoryIdentity,
): string {
  return [
    identity.encounterId,
    identity.revision,
    identity.perspectiveParticipantId ?? "player",
  ].join(":");
}

export function isMatchingPlayerCombatHistory(input: {
  candidate: RevisionKeyedCombatHistory | undefined;
  identity: PlayerCombatHistoryIdentity;
}): boolean {
  return Boolean(
    input.candidate &&
      getPlayerCombatHistoryRequestKey(input.candidate.identity) ===
        getPlayerCombatHistoryRequestKey(input.identity),
  );
}

export function createPlayerCombatHistoryRequestCoordinator(input: {
  loadHistory: (
    encounterId: string,
    options: { perspectiveParticipantId?: string },
  ) => Promise<CombatHistoryProjection>;
}) {
  const completed = new Map<string, RevisionKeyedCombatHistory>();
  const inFlight = new Map<string, Promise<RevisionKeyedCombatHistory>>();

  return {
    clear() {
      completed.clear();
      inFlight.clear();
    },
    request(identity: PlayerCombatHistoryIdentity): Promise<RevisionKeyedCombatHistory> {
      const key = getPlayerCombatHistoryRequestKey(identity);
      const cached = completed.get(key);
      if (cached) return Promise.resolve(cached);

      const pending = inFlight.get(key);
      if (pending) return pending;

      const request = input
        .loadHistory(identity.encounterId, {
          perspectiveParticipantId: identity.perspectiveParticipantId,
        })
        .then((history) => {
          if (
            history.sourceEncounterId !== identity.encounterId ||
            history.sourceUpdatedAt !== identity.revision
          ) {
            throw new Error("Combat history did not match the accepted encounter revision.");
          }

          const result = { history, identity };
          completed.set(key, result);
          return result;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, request);
      return request;
    },
  };
}

export function shouldAcceptPlayerCombatEncounter(input: {
  accepted: EncounterSession | undefined;
  candidate: EncounterSession;
  expectedEncounterId: string;
}): boolean {
  if (input.candidate.id !== input.expectedEncounterId) return false;
  if (!input.accepted || input.accepted.id !== input.candidate.id) return true;
  return input.candidate.updatedAt >= input.accepted.updatedAt;
}
