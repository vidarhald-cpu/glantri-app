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

/**
 * Forgejo #1011 — the history coordinator's revision mismatch, carried as a type.
 *
 * A mount that reads the Encounter at revision R and asks for its history while the GM's
 * autonomous round advance lands revision R+1 gets history keyed to R+1 for an identity keyed to
 * R. That is a transient disagreement about which revision is current, not a failure to report:
 * the next read sees one revision throughout. The coordinator still rejects, because its direct
 * caller on the refresh path has to know its request was not adopted, but the rejection now
 * carries a type so `pollPlayerCombatSnapshot` can route it into the retryable `stale` path.
 *
 * The type, never the sentence. Discriminating on the message text would make that copy
 * load-bearing, which is how a reworded string silently restores a defect.
 */
export class PlayerCombatHistoryRevisionMismatchError extends Error {
  constructor() {
    super("Combat history did not match the accepted encounter revision.");
    this.name = "PlayerCombatHistoryRevisionMismatchError";
  }
}

export function isPlayerCombatHistoryRevisionMismatch(error: unknown): boolean {
  return error instanceof PlayerCombatHistoryRevisionMismatchError;
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
  /*
   * Forgejo #1011 — a history revision mismatch is reported as `stale`, like every other
   * disagreement this function measures, instead of rejecting out of the whole poll. Before this,
   * the mismatch was the one non-coherent outcome that threw: it was therefore not
   * `{ kind: "stale" }`, so neither the mount's retry nor the five-second refresh's `stale`
   * branch ever saw it, and it replaced the player's whole combat surface with one sentence.
   *
   * Only this one condition is translated. Any other rejection still propagates on the first
   * attempt, so a 404 or an API refusal reaches the surface immediately rather than being retried
   * into a delay.
   */
  const [historyAttempt, participants, confirmedRevision] = await Promise.all([
    input.input.loadHistory(input.encounter).then(
      (history) => ({ history, kind: "loaded" as const }),
      (error: unknown) => {
        if (isPlayerCombatHistoryRevisionMismatch(error)) return { kind: "stale" as const };
        throw error;
      },
    ),
    input.input.loadParticipants(input.scenarioId),
    input.input.loadRevision(input.input.encounterId),
  ]);
  if (historyAttempt.kind === "stale") return { kind: "stale" };
  const history = historyAttempt.history;
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

/**
 * Forgejo #1011 — the mount's retry schedule, taken from the writer it has to survive.
 *
 * The GM's own browser POSTs `/combat-round/advance-deterministic` with no click
 * (`CombatRoundManagerPanel.tsx:5486`). On a passing local run the round-boundary advance held a
 * chain of writes open for **1233 ms** — 2.6x to 14x longer than any other advance in the same
 * run — and the player's next mount issued its first request 312 ms after that chain finished, on
 * hardware faster than the CI runner (measured on #1004, comment 22644). An immediate single
 * retry with no backoff is precisely what such a chain defeats: both attempts land inside it.
 *
 * Four delays, so five attempts, and **2250 ms** of backoff before the attempts' own durations
 * are counted: 1.82x the measured chain. The growth is exponential so the ordinary case — one
 * write that has already landed — recovers on the first 150 ms retry instead of paying the whole
 * budget, while the measured worst case is still covered.
 */
export const PLAYER_COMBAT_SNAPSHOT_RETRY_DELAYS_MS: readonly number[] = [150, 300, 600, 1200];

export type CoherentPlayerCombatSnapshot = Extract<
  PlayerCombatSnapshotPollResult,
  { kind: "updated" }
>;

/**
 * Adopts one coherent revision, retrying a revision race rather than terminating on it.
 *
 * Retrying is what the five-second refresh has always done with a non-coherent read — return, and
 * try again on the next tick. Only the mount treated the same race as terminal, which is the
 * asymmetry #1011 records. Nothing about the coherence protocol itself is relaxed: an attempt is
 * still adopted only when every revision agrees (`loadCoherentPlayerCombatSnapshot`), and a
 * rejection that is not a revision race is not retried at all.
 */
export async function adoptCoherentPlayerCombatSnapshot(input: {
  delaysMs?: readonly number[];
  isAbandoned?: () => boolean;
  loadSnapshot: () => Promise<PlayerCombatSnapshotPollResult>;
  sleep?: (ms: number) => Promise<void>;
}): Promise<CoherentPlayerCombatSnapshot> {
  const delays = input.delaysMs ?? PLAYER_COMBAT_SNAPSHOT_RETRY_DELAYS_MS;
  const sleep =
    input.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    const result = await input.loadSnapshot();
    if (result.kind === "updated") return result;
    if (attempt === delays.length || input.isAbandoned?.()) break;
    await sleep(delays[attempt]!);
    if (input.isAbandoned?.()) break;
  }

  throw new Error("Unable to adopt one coherent player combat revision.");
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
            throw new PlayerCombatHistoryRevisionMismatchError();
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
