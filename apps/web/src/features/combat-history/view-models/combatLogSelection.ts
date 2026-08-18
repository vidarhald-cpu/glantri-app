import type {
  CombatLogEventPresentation,
  CombatLogProjection,
  CombatRoundState,
  CombatStepEvent,
} from "@glantri/domain";

export type CombatLogSelectionMode = "automatic" | "cleared" | "explicit";

export interface CombatLogPresentationSelection {
  encounterId: string;
  mode: CombatLogSelectionMode;
  selectedCombatLogEventId?: string;
  selectedPresentationTargetId?: string;
  sourceRevision: string;
}

export interface CombatLogEventSelection {
  combatLogEventId: string;
  presentationTargetId?: string;
}

function newestTargetEvent(
  events: readonly CombatLogEventPresentation[],
): CombatLogEventPresentation | undefined {
  return [...events].reverse().find((event) => event.presentationTargetId);
}

function selectionForEvent(input: {
  encounterId: string;
  event: CombatLogEventPresentation;
  mode: "automatic" | "explicit";
  sourceRevision: string;
}): CombatLogPresentationSelection {
  return {
    encounterId: input.encounterId,
    mode: input.mode,
    selectedCombatLogEventId: input.event.id,
    selectedPresentationTargetId: input.event.presentationTargetId,
    sourceRevision: input.sourceRevision,
  };
}

export function createDefaultCombatLogSelection(
  projection: CombatLogProjection,
): CombatLogPresentationSelection {
  const event = newestTargetEvent(projection.events);
  return event
    ? selectionForEvent({
        encounterId: projection.encounterId,
        event,
        mode: "automatic",
        sourceRevision: projection.sourceRevision,
      })
    : {
        encounterId: projection.encounterId,
        mode: "automatic",
        sourceRevision: projection.sourceRevision,
      };
}

export function selectCombatLogEvent(input: {
  eventId: string;
  projection: CombatLogProjection;
}): CombatLogPresentationSelection {
  const event = input.projection.events.find((candidate) => candidate.id === input.eventId);
  if (!event) {
    return {
      encounterId: input.projection.encounterId,
      mode: "cleared",
      sourceRevision: input.projection.sourceRevision,
    };
  }
  return selectionForEvent({
    encounterId: input.projection.encounterId,
    event,
    mode: "explicit",
    sourceRevision: input.projection.sourceRevision,
  });
}

/**
 * Carries one accepted selection across encounter revisions without jumping to
 * a newer unrelated result. A fresh mount gets the newest target by default;
 * undo/removal clears the missing selection until the viewer chooses again.
 */
export function reconcileCombatLogSelection(input: {
  current: CombatLogPresentationSelection;
  projection: CombatLogProjection;
}): CombatLogPresentationSelection {
  const { current, projection } = input;
  if (current.encounterId !== projection.encounterId) {
    return createDefaultCombatLogSelection(projection);
  }

  if (current.selectedPresentationTargetId) {
    const exactEvent = projection.events.find(
      (event) =>
        event.id === current.selectedCombatLogEventId &&
        event.presentationTargetId === current.selectedPresentationTargetId,
    );
    const targetEvent =
      exactEvent ??
      [...projection.events]
        .reverse()
        .find((event) => event.presentationTargetId === current.selectedPresentationTargetId);
    if (targetEvent) {
      return selectionForEvent({
        encounterId: projection.encounterId,
        event: targetEvent,
        mode: current.mode === "explicit" ? "explicit" : "automatic",
        sourceRevision: projection.sourceRevision,
      });
    }
    return {
      encounterId: projection.encounterId,
      mode: "cleared",
      sourceRevision: projection.sourceRevision,
    };
  }

  if (current.selectedCombatLogEventId) {
    const event = projection.events.find(
      (candidate) => candidate.id === current.selectedCombatLogEventId,
    );
    return event
      ? selectionForEvent({
          encounterId: projection.encounterId,
          event,
          mode: "explicit",
          sourceRevision: projection.sourceRevision,
        })
      : {
          encounterId: projection.encounterId,
          mode: "cleared",
          sourceRevision: projection.sourceRevision,
        };
  }

  if (current.mode === "automatic") {
    return createDefaultCombatLogSelection(projection);
  }

  return { ...current, sourceRevision: projection.sourceRevision };
}

function proposalId(event: CombatStepEvent): string | undefined {
  if (event.distanceProposalId) return event.distanceProposalId;
  const value = event.facts.involvedOutcome.proposalId;
  return typeof value === "string" ? value : undefined;
}

/** Resolves only facts attached to the selected log target; it has no latest-result fallback. */
export function resolveCombatLogPresentationTargetEvents(input: {
  roundStates: readonly CombatRoundState[];
  selection: CombatLogPresentationSelection;
  projection: CombatLogProjection;
}): CombatStepEvent[] {
  const selectedEvent = input.projection.events.find(
    (event) => event.id === input.selection.selectedCombatLogEventId,
  );
  if (
    !selectedEvent?.presentationTargetId ||
    selectedEvent.presentationTargetId !== input.selection.selectedPresentationTargetId
  ) {
    return [];
  }

  const roundState = input.roundStates.find(
    (round) => round.roundNumber === selectedEvent.roundNumber,
  );
  if (!roundState) return [];
  const sourceIds = new Set(selectedEvent.sourceEventIds);
  const exactSources = roundState.events.filter((event) => sourceIds.has(event.id));
  const related = roundState.events.filter((event) => {
    if (selectedEvent.presentationTargetKind === "attack") {
      return Boolean(
        selectedEvent.presentationTargetSourceId &&
        event.attackResultId === selectedEvent.presentationTargetSourceId,
      );
    }
    if (selectedEvent.presentationTargetKind === "defense") {
      return Boolean(
        selectedEvent.presentationTargetSourceId &&
        event.parryResultId === selectedEvent.presentationTargetSourceId,
      );
    }
    if (selectedEvent.presentationTargetKind === "damage") {
      return Boolean(
        selectedEvent.presentationTargetSourceId &&
        event.damageResultId === selectedEvent.presentationTargetSourceId,
      );
    }
    if (selectedEvent.presentationTargetKind === "maneuver") {
      return Boolean(
        selectedEvent.presentationTargetSourceId &&
        proposalId(event) === selectedEvent.presentationTargetSourceId,
      );
    }
    return false;
  });

  return [
    ...new Map([...exactSources, ...related].map((event) => [event.id, event])).values(),
  ].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}
