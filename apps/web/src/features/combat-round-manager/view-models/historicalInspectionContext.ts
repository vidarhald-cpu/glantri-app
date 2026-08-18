import {
  getCombatObservationRequiredRounds,
  type CombatObservationRelationship,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepSnapshot,
} from "@glantri/domain";

import { buildHistoricalObservationRelationships } from "@/features/combat-history/view-models/buildHistoricalObservationRelationships";

export interface HistoricalInspectionContext {
  readonly archivedSnapshotIdentity?: string;
  readonly observationRelationships: readonly CombatObservationRelationship[];
  readonly participantId: string;
  readonly roundNumber: number;
  readonly selectedCanonicalSequenceCutoff?: number;
  readonly selectedStep: CombatRoundStep;
  readonly trackerCellIdentity: string;
  readonly viewer: "gm";
  readonly visibleEventIds: readonly string[];
}

/**
 * Resolves immutable historical facts at the selected step boundary. Completed-round terminal
 * state is deliberately not a fallback for facts, such as observation progress, that changed
 * later in the same round.
 */
export function buildHistoricalInspectionContext(input: {
  participantId: string;
  previousRoundState?: CombatRoundState;
  roundState: CombatRoundState;
  snapshot?: CombatRoundStepSnapshot;
  step: CombatRoundStep;
}): HistoricalInspectionContext {
  const observation = buildHistoricalObservationRelationships({
    attempts: input.roundState.observationAttempts,
    baselineRelationships: input.previousRoundState?.observationRelationships,
    events: input.roundState.events,
    observerParticipantId: input.participantId,
    selectedStep: input.step,
  });

  return {
    archivedSnapshotIdentity: input.snapshot?.id,
    observationRelationships: observation.relationships,
    participantId: input.participantId,
    roundNumber: input.roundState.roundNumber,
    selectedCanonicalSequenceCutoff: observation.selectedCanonicalSequenceCutoff,
    selectedStep: input.step,
    trackerCellIdentity: `${input.roundState.roundNumber}:${input.participantId}:${input.step}`,
    viewer: "gm",
    visibleEventIds: observation.visibleEventIds,
  };
}

export function getHistoricalObservationRequiredRounds(
  relationship: CombatObservationRelationship,
): number {
  return getCombatObservationRequiredRounds(relationship.completedAttempts);
}
