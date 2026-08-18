import {
  COMBAT_ROUND_STEPS,
  type CombatObservationAttempt,
  type CombatObservationRelationship,
  type CombatRoundStep,
} from "@glantri/domain";

interface HistoricalObservationEvent {
  readonly facts: {
    readonly involvedOutcome?: Readonly<Record<string, unknown>>;
  };
  readonly id?: string;
  readonly ownerParticipantId?: string;
  readonly sequence: number;
  readonly step: CombatRoundStep;
  readonly targetParticipantId?: string;
  readonly type: string;
}

function stepIndex(step: CombatRoundStep): number {
  return COMBAT_ROUND_STEPS.indexOf(step);
}

function numberFact(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringFact(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Replays only the viewer-visible observation facts through the selected step boundary.
 * The completed round's terminal relationship is intentionally not an input because it
 * may contain progress earned after the selected tracker cell.
 */
export function buildHistoricalObservationRelationships(input: {
  attempts?: readonly CombatObservationAttempt[];
  baselineRelationships?: readonly CombatObservationRelationship[];
  events: readonly HistoricalObservationEvent[];
  observerParticipantId: string;
  selectedStep: CombatRoundStep;
}): {
  relationships: readonly CombatObservationRelationship[];
  selectedCanonicalSequenceCutoff?: number;
  visibleEventIds: readonly string[];
} {
  const selectedStepIndex = stepIndex(input.selectedStep);
  const visibleEvents = input.events
    .filter((event) => stepIndex(event.step) <= selectedStepIndex)
    .slice()
    .sort((left, right) => left.sequence - right.sequence);
  const relationships = new Map(
    (input.baselineRelationships ?? [])
      .filter(
        (relationship) =>
          relationship.observerParticipantId === input.observerParticipantId,
      )
      .map((relationship) => [relationship.id, relationship]),
  );

  for (const event of visibleEvents) {
    if (
      event.type !== "observation" ||
      event.ownerParticipantId !== input.observerParticipantId
    ) {
      continue;
    }
    const outcome = event.facts.involvedOutcome;
    if (!outcome) continue;
    const relationshipId = stringFact(outcome.relationshipId);
    const targetParticipantId =
      stringFact(outcome.targetParticipantId) ?? event.targetParticipantId;
    if (!relationshipId || !targetParticipantId) continue;

    const previous = relationships.get(relationshipId);
    const completedAttempts =
      numberFact(outcome.completedAttempts) ?? previous?.completedAttempts ?? 0;
    const attemptId = stringFact(outcome.observationAttemptId);
    const attempt = attemptId
      ? input.attempts?.find((candidate) => candidate.id === attemptId)
      : undefined;

    relationships.set(relationshipId, {
      bestBonus: numberFact(outcome.bestBonusAfter) ?? previous?.bestBonus ?? 0,
      completedAttempts,
      id: relationshipId,
      lastAttempt: attempt ?? previous?.lastAttempt,
      lastCompletedAttemptRevision:
        attempt?.completedAtRevision ?? previous?.lastCompletedAttemptRevision,
      observerParticipantId: input.observerParticipantId,
      roundsTowardNextAttempt:
        numberFact(outcome.roundsTowardNextAttempt) ??
        previous?.roundsTowardNextAttempt ??
        0,
      targetParticipantId,
    });
  }

  return {
    relationships: [...relationships.values()],
    selectedCanonicalSequenceCutoff: visibleEvents.at(-1)?.sequence,
    visibleEventIds: visibleEvents.flatMap((event) => (event.id ? [event.id] : [])),
  };
}
