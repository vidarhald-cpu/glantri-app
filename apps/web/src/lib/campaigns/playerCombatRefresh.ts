import type {
  CombatHistoryProjection,
  EncounterSession,
  EncounterSessionRevision,
  ScenarioParticipant,
  ScenarioPlayerProjection,
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
  | { kind: "unchanged"; projection: ScenarioPlayerProjection }
  | { kind: "stale" }
  | {
      encounter: EncounterSession;
      history: RevisionKeyedCombatHistory;
      kind: "updated";
      participants: readonly ScenarioParticipant[];
      projection: ScenarioPlayerProjection;
    };

export function getPlayerCombatProjectionCacheKey(projection: ScenarioPlayerProjection): string {
  return JSON.stringify(projection);
}

export function createPlayerCombatRefreshRequestCoordinator() {
  let latestRequestId = 0;

  return {
    begin() {
      latestRequestId += 1;
      return latestRequestId;
    },
    invalidate() {
      latestRequestId += 1;
    },
    isCurrent(requestId: number) {
      return requestId === latestRequestId;
    },
  };
}

/** Loads one player-safe operational snapshot and adopts nothing until every revision agrees. */
export async function pollPlayerCombatSnapshot(input: {
  acceptedRevision?: string;
  acceptedProjectionKey?: string;
  encounterId: string;
  loadEncounter: (encounterId: string) => Promise<EncounterSession>;
  loadHistory: (encounter: EncounterSession) => Promise<RevisionKeyedCombatHistory>;
  loadParticipants: (scenarioId: string) => Promise<ScenarioParticipant[]>;
  loadProjection: () => Promise<ScenarioPlayerProjection>;
  loadRevision: (encounterId: string) => Promise<EncounterSessionRevision>;
  onNewerRevision?: (revision: EncounterSessionRevision) => void;
  onProjectionChanged?: (projection: ScenarioPlayerProjection) => void;
}): Promise<PlayerCombatSnapshotPollResult> {
  const encounterResult = await pollActiveEncounterRevision({
    acceptedRevision: input.acceptedRevision,
    encounterId: input.encounterId,
    loadEncounter: input.loadEncounter,
    loadRevision: input.loadRevision,
    onNewerRevision: input.onNewerRevision,
  });
  if (encounterResult.kind === "stale") return encounterResult;
  if (encounterResult.kind === "unchanged") {
    const projection = await input.loadProjection();
    if (
      !input.acceptedProjectionKey ||
      getPlayerCombatProjectionCacheKey(projection) === input.acceptedProjectionKey
    ) {
      return { kind: "unchanged", projection };
    }

    input.onProjectionChanged?.(projection);
    const encounter = await input.loadEncounter(input.encounterId);
    if (
      encounter.id !== input.encounterId ||
      encounter.updatedAt !== input.acceptedRevision ||
      !encounter.scenarioId
    ) {
      return { kind: "stale" };
    }
    return loadCoherentPlayerCombatSnapshot({
      encounter,
      input,
      projection,
      scenarioId: encounter.scenarioId,
    });
  }
  if (!encounterResult.encounter.scenarioId) return { kind: "stale" };

  const projection = await input.loadProjection();
  return loadCoherentPlayerCombatSnapshot({
    encounter: encounterResult.encounter,
    input,
    projection,
    scenarioId: encounterResult.encounter.scenarioId,
  });
}

async function loadCoherentPlayerCombatSnapshot(input: {
  encounter: EncounterSession;
  input: {
    encounterId: string;
    loadHistory: (encounter: EncounterSession) => Promise<RevisionKeyedCombatHistory>;
    loadParticipants: (scenarioId: string) => Promise<ScenarioParticipant[]>;
    loadRevision: (encounterId: string) => Promise<EncounterSessionRevision>;
  };
  projection: ScenarioPlayerProjection;
  scenarioId: string;
}): Promise<PlayerCombatSnapshotPollResult> {
  const [history, participants, confirmedRevision] = await Promise.all([
    input.input.loadHistory(input.encounter),
    input.input.loadParticipants(input.scenarioId),
    input.input.loadRevision(input.input.encounterId),
  ]);
  if (
    confirmedRevision.encounterId !== input.input.encounterId ||
    confirmedRevision.revision !== input.encounter.updatedAt ||
    history.identity.encounterId !== input.input.encounterId ||
    history.identity.revision !== confirmedRevision.revision ||
    history.history.sourceEncounterId !== input.input.encounterId ||
    history.history.sourceUpdatedAt !== confirmedRevision.revision
  ) {
    return { kind: "stale" };
  }

  return {
    encounter: input.encounter,
    history,
    kind: "updated",
    participants,
    projection: input.projection,
  };
}

export function getPlayerCombatHistoryRequestKey(identity: PlayerCombatHistoryIdentity): string {
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
