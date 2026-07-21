import type { CombatRoundState } from "@glantri/domain";

export interface CombatRoundViewStateRevision {
  encounterId: string;
  encounterRevision?: string;
}

export interface CombatRoundViewState extends CombatRoundViewStateRevision {
  state: CombatRoundState;
}

export function canAcceptCombatRoundViewRevision(input: {
  accepted: CombatRoundViewStateRevision;
  candidateEncounterId: string;
  candidateRevision?: string;
}): boolean {
  if (input.accepted.encounterId !== input.candidateEncounterId) {
    return true;
  }
  if (!input.accepted.encounterRevision || !input.candidateRevision) {
    return true;
  }

  const acceptedTime = Date.parse(input.accepted.encounterRevision);
  const candidateTime = Date.parse(input.candidateRevision);

  return Number.isNaN(acceptedTime) || Number.isNaN(candidateTime)
    ? input.candidateRevision === input.accepted.encounterRevision
    : candidateTime >= acceptedTime;
}

/**
 * Applies a local state-only update without dropping the accepted encounter
 * revision that binds projected commands. Canonical server responses use the
 * separate acceptance path in the round manager.
 */
export function updateCombatRoundViewState(input: {
  current: CombatRoundViewState;
  encounterId: string;
  encounterRevision?: string;
  state: CombatRoundState;
}): CombatRoundViewState {
  if (
    input.encounterRevision &&
    !canAcceptCombatRoundViewRevision({
      accepted: input.current,
      candidateEncounterId: input.encounterId,
      candidateRevision: input.encounterRevision,
    })
  ) {
    return input.current;
  }

  if (
    input.encounterRevision &&
    input.current.encounterId === input.encounterId &&
    input.current.encounterRevision === input.encounterRevision &&
    JSON.stringify(input.current.state) !== JSON.stringify(input.state)
  ) {
    return input.current;
  }

  return {
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision ?? input.current.encounterRevision,
    state: input.state,
  };
}
