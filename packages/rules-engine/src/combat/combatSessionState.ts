import {
  normalizeCombatAllocationState,
  type CombatAllocationState
} from "./combatAllocationState";

export interface CombatActor {
  actorId: string;
  characterId?: string;
  allocation: CombatAllocationState;
}

export interface CombatSessionState {
  sessionId: string;
  actors: CombatActor[];
  round: number;
  phase: "setup" | "active" | "resolved";
  activeActorId: string | null;
}

function createSessionId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `combat-session-${randomId}` : `combat-session-${Date.now()}`;
}

function normalizeCombatActor(actor: CombatActor): CombatActor {
  return {
    actorId: actor.actorId,
    characterId: actor.characterId,
    allocation: normalizeCombatAllocationState(actor.allocation)
  };
}

export function createCombatSession(actors: CombatActor[]): CombatSessionState {
  const normalizedActors = actors.map(normalizeCombatActor);

  return {
    sessionId: createSessionId(),
    actors: normalizedActors,
    round: 1,
    phase: "setup",
    activeActorId: normalizedActors[0]?.actorId ?? null
  };
}

export function updateActorAllocation(
  session: CombatSessionState,
  actorId: string,
  allocation: CombatAllocationState
): CombatSessionState {
  return {
    ...session,
    actors: session.actors.map((actor) =>
      actor.actorId === actorId
        ? {
            ...actor,
            allocation: normalizeCombatAllocationState(allocation)
          }
        : actor
    )
  };
}

export function getActorAllocation(
  session: CombatSessionState,
  actorId: string
): CombatAllocationState | null {
  const actor = session.actors.find((candidate) => candidate.actorId === actorId);
  return actor ? actor.allocation : null;
}
