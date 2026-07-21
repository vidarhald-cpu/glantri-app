import type { CombatRoundState } from "@glantri/domain";

export interface CombatRoundViewStateRevision {
  encounterId: string;
  encounterRevision?: string;
}

/**
 * Applies a local state-only update without dropping the accepted encounter
 * revision that binds projected commands. Canonical server responses use the
 * separate acceptance path in the round manager.
 */
export function updateCombatRoundViewState(input: {
  current: CombatRoundViewStateRevision;
  encounterId: string;
  encounterRevision?: string;
  state: CombatRoundState;
}) {
  return {
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision ?? input.current.encounterRevision,
    state: input.state,
  };
}
