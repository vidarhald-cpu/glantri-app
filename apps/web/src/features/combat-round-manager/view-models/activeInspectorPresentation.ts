import {
  buildCombatLogProjection,
  buildCombatRoundInspector,
  buildCombatRoundPhaseResolutionResult,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundPhaseResolutionStatus,
  projectCombatHistoryEvent,
  type CombatLogProjection,
  type CombatProgressionBoundaryKind,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStep,
  type ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import {
  buildCombatStepResultPresentation,
  selectCombatEventsForTrackerCell,
  type CombatStepResultPresentation,
} from "@/features/combat-history";
import {
  combatPerformanceNow,
  isCombatPerformanceEnabled,
  measureCombatPerformanceStage,
  recordCombatPerformanceStage,
} from "@/lib/performance/combatPerformance";

type ActiveInspectorPresentationEntry = {
  readonly dependencies: readonly unknown[];
  readonly value: unknown;
};

export interface ActiveInspectorPresentationStore {
  resolve<T>(input: { build: () => T; dependencies: readonly unknown[]; key: string }): T;
}

function dependenciesMatch(left: readonly unknown[], right: readonly unknown[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
  );
}

/**
 * Revision-owned active inspector models live here rather than in React hook
 * caches. Keys identify a presentation candidate; dependencies identify the
 * canonical or slow-context facts used to build it. Selection and pending
 * overlays never participate unless their values genuinely affect a model.
 */
export function createActiveInspectorPresentationStore(): ActiveInspectorPresentationStore {
  const entries = new Map<string, ActiveInspectorPresentationEntry>();
  const measureCache = isCombatPerformanceEnabled();

  return {
    resolve<T>({
      build,
      dependencies,
      key,
    }: {
      build: () => T;
      dependencies: readonly unknown[];
      key: string;
    }): T {
      const startedAt = measureCache ? combatPerformanceNow() : 0;
      const existing = entries.get(key);
      const reused = Boolean(existing && dependenciesMatch(existing.dependencies, dependencies));
      if (reused) {
        if (measureCache) {
          recordCombatPerformanceStage(
            "panel_active_inspector_presentation_cache",
            combatPerformanceNow() - startedAt,
            {
              activeInspectorRebuilt: false,
              submodel: key,
            },
          );
        }
        return existing!.value as T;
      }

      const value = build();
      entries.set(key, {
        dependencies: [...dependencies],
        value,
      });
      if (measureCache) {
        recordCombatPerformanceStage(
          "panel_active_inspector_presentation_cache",
          combatPerformanceNow() - startedAt,
          {
            activeInspectorRebuilt: true,
            submodel: key,
          },
        );
      }
      return value;
    },
  };
}

export function projectGmCombatEvents(input: {
  events: CombatRoundState["events"];
  participants: CombatRoundState["participants"];
}): ProjectedCombatHistoryEvent[] {
  const participantInputs = input.participants.map((participant) => ({
    displayName: participant.label,
    participantId: participant.participantId,
  }));
  const labels = new Map(
    participantInputs.map((participant) => [participant.participantId, participant.displayName]),
  );

  return input.events.flatMap((event) => {
    const projected = projectCombatHistoryEvent({
      event,
      participants: participantInputs,
      viewer: { kind: "gm" },
    });
    if (!projected) return [];

    const identities = [...projected.identities];
    for (const [index, participantId] of event.visibility.involvedParticipantIds.entries()) {
      if (identities.some((identity) => identity.participantId === participantId)) continue;
      const displayName = labels.get(participantId);
      if (!displayName) continue;
      identities.push({
        displayName,
        participantId,
        role: index === 0 ? "actor" : "target",
        visibility: "visible",
      });
    }
    return [{ ...projected, identities }];
  });
}

export interface ActiveCombatLogPresentation {
  readonly combatLog: CombatLogProjection;
  readonly gmEvents: readonly ProjectedCombatHistoryEvent[];
}

export function buildActiveCombatLogPresentation(input: {
  encounterId: string;
  encounterRevision: string;
  roundState: CombatRoundState;
}): ActiveCombatLogPresentation {
  return {
    combatLog: buildCombatLogProjection({
      encounterId: input.encounterId,
      sourceRevision: input.encounterRevision,
      state: input.roundState,
    }),
    gmEvents: projectGmCombatEvents({
      events: input.roundState.events,
      participants: input.roundState.participants,
    }),
  };
}

export interface ActiveInspectorCorePresentation {
  readonly canonicalActionResultEvents: readonly ProjectedCombatHistoryEvent[];
  readonly currentStepResults?: CombatStepResultPresentation;
  readonly inspector: ReturnType<typeof buildCombatRoundInspector>;
}

export function buildActiveInspectorCorePresentation(input: {
  boundary: CombatProgressionBoundaryKind;
  combatLog: CombatLogProjection;
  encounterId: string;
  encounterRevision: string;
  gmEvents: readonly ProjectedCombatHistoryEvent[];
  participantId?: string;
  roundState: CombatRoundState;
  step: CombatRoundStep;
}): ActiveInspectorCorePresentation {
  const inspector = measureCombatPerformanceStage("panel_build_combat_round_inspector", () =>
    buildCombatRoundInspector({
      participantId: input.participantId,
      state: input.roundState,
      step: input.step,
    }),
  );
  const selectedEvents = selectCombatEventsForTrackerCell({
    events: input.roundState.events,
    participantId: inspector.participant?.participantId,
    retainLatestWhenEmpty: false,
    step: inspector.step,
  });
  const projectedEventById = new Map(input.gmEvents.map((event) => [event.id, event]));

  return {
    canonicalActionResultEvents: selectedEvents.flatMap((event) => {
      const projected = projectedEventById.get(event.id);
      return projected ? [projected] : [];
    }),
    currentStepResults: measureCombatPerformanceStage("panel_current_event_result_selection", () =>
      inspector.participant
        ? buildCombatStepResultPresentation({
            boundary: input.boundary,
            combatLog: input.combatLog,
            encounterId: input.encounterId,
            encounterRevision: input.encounterRevision,
            events: input.gmEvents,
            participantId: inspector.participant.participantId,
            roundNumber: input.roundState.roundNumber,
            step: input.step,
            viewer: { kind: "gm" },
          })
        : undefined,
    ),
    inspector,
  };
}

export interface ActiveAttackResolutionPresentation {
  readonly attackResult: ReturnType<typeof getCombatRoundOutgoingAttackResultForParticipantPhase>;
  readonly phaseResolutionOwnerParticipantId?: string;
  readonly phaseResolutionOwnerStatus?: ReturnType<typeof getCombatRoundPhaseResolutionStatus>;
  readonly resolutionAttackResult: ReturnType<
    typeof getCombatRoundDisplayIncomingAttackResultForParticipantPhase
  >;
  readonly resolutionResult?: ReturnType<typeof buildCombatRoundPhaseResolutionResult>;
}

export function buildActiveAttackResolutionPresentation(input: {
  attackPhase?: CombatRoundPhase;
  participantId?: string;
  resolutionPhase?: CombatRoundPhase;
  roundState: CombatRoundState;
}): ActiveAttackResolutionPresentation {
  const attackResult =
    input.participantId && input.attackPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: input.participantId,
          phase: input.attackPhase,
          state: input.roundState,
        })
      : undefined;
  const resolutionAttackResult =
    input.participantId && input.resolutionPhase
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: input.participantId,
          phase: input.resolutionPhase,
          state: input.roundState,
        })
      : undefined;
  const resolutionResult = resolutionAttackResult
    ? (getCombatRoundPhaseResolutionResultForAttack({
        attackResult: resolutionAttackResult,
        state: input.roundState,
      }) ??
      buildCombatRoundPhaseResolutionResult({
        attackResult: resolutionAttackResult,
        roundNumber: input.roundState.roundNumber,
        updatedAt: resolutionAttackResult.rolledAt,
      }))
    : undefined;
  const phaseResolutionOwnerParticipantId =
    resolutionAttackResult?.attackerParticipantId ?? input.participantId;

  return {
    attackResult,
    phaseResolutionOwnerParticipantId,
    phaseResolutionOwnerStatus:
      phaseResolutionOwnerParticipantId && input.resolutionPhase
        ? getCombatRoundPhaseResolutionStatus({
            participantId: phaseResolutionOwnerParticipantId,
            phase: input.resolutionPhase,
            state: input.roundState,
          })
        : undefined,
    resolutionAttackResult,
    resolutionResult,
  };
}
