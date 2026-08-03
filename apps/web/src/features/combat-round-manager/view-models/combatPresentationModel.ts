import {
  COMBAT_ROUND_STEPS,
  buildCombatProgressionProjection,
  deriveCombatHistoryStepOutcome,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundTimelineRoundStates,
  getCombatRoundInitiativeTotal,
  projectActiveCombatParticipation,
  projectCombatProgressionPresentation,
  type ScenarioParticipant,
  type CombatProgressionPresentationProjection,
  type CombatProgressionPresentationTask,
  type CombatRoundAttackRollResult,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepStatus,
} from "@glantri/domain";

import {
  buildCombatProgressionTrackerIndex,
  buildCombatTrackerCellKey,
  buildCombatTrackerModel,
  buildCurrentActionPresentation,
  getCombatProgressionPresentationTasks,
  type CombatProgressionTrackerIndex,
  type CombatTrackerCellFacts,
  type CombatTrackerModel,
  type CurrentActionPresentation,
} from "@/features/combat-history";
import { measureCombatPerformanceStage } from "@/lib/performance/combatPerformance";
import {
  buildActiveCombatLogPresentation,
  createActiveInspectorPresentationStore,
  type ActiveInspectorPresentationStore,
} from "./activeInspectorPresentation";
import {
  buildArchivedInspectorPresentationIndex,
  type ArchivedHistoricalActionResultBuilder,
  type ArchivedInspectorPresentationIndex,
} from "./archivedInspectorPresentation";
import {
  buildCombatRoundLiveInspectorContext,
  getCombatRoundLiveInspectorSelection,
  getCombatRoundManagerDisplayParticipantIds,
  getCombatRoundRenderedInspectorSelection,
  type CombatRoundSelectionTarget,
} from "../combatRoundSelection";

type CombatRoundParticipant = CombatRoundState["participants"][number];

export interface ArchivedCombatPresentation {
  readonly identity: string;
  readonly inspectorPresentation: ArchivedInspectorPresentationIndex;
  readonly roundNumbers: readonly number[];
  readonly roundStates: readonly CombatRoundState[];
  readonly tracker: CombatTrackerModel;
  readonly trackerCellFacts: readonly CombatTrackerCellFacts[];
}

export interface ActiveCombatPresentation {
  readonly combatLog: ReturnType<typeof buildActiveCombatLogPresentation>["combatLog"];
  readonly currentAction?: CurrentActionPresentation;
  readonly currentTask?: CombatProgressionPresentationTask;
  readonly currentTaskSelection?: CombatRoundSelectionTarget;
  readonly displayParticipants: readonly CombatRoundParticipant[];
  readonly gmEvents: ReturnType<typeof buildActiveCombatLogPresentation>["gmEvents"];
  readonly resultEvents: ReturnType<typeof buildActiveCombatLogPresentation>["resultEvents"];
  readonly identity: string;
  readonly inspectorPresentation: ActiveInspectorPresentationStore;
  readonly liveInspectorContext: ReturnType<typeof buildCombatRoundLiveInspectorContext>;
  readonly progression: CombatProgressionPresentationProjection;
  readonly progressionProjection: ReturnType<typeof buildCombatProgressionProjection>;
  readonly progressionTrackerIndex: CombatProgressionTrackerIndex;
  readonly projectedCurrentTasks: readonly CombatProgressionPresentationTask[];
  readonly roundState: CombatRoundState;
  readonly tracker: CombatTrackerModel;
  readonly trackerCellFacts: readonly CombatTrackerCellFacts[];
}

export interface CombatSelectionOverlay {
  readonly identity: string;
  readonly renderedInspectionSelection: CombatRoundSelectionTarget;
  readonly selectedRoundIsActive: boolean;
  readonly selectedRoundNumber: number;
  readonly selectedRoundState: CombatRoundState;
}

export interface CombatPendingOverlay {
  readonly error?: string;
  readonly identity: string;
  readonly saving: boolean;
  readonly workflow: string;
}

export interface CombatPresentationModel {
  readonly active: ActiveCombatPresentation;
  readonly archived: ArchivedCombatPresentation;
  readonly pending: CombatPendingOverlay;
  readonly selection: CombatSelectionOverlay;
  readonly timelineRoundNumbers: readonly number[];
  readonly timelineRoundStates: readonly CombatRoundState[];
  readonly tracker: CombatTrackerModel;
}

export interface CombatPresentationParticipantRow {
  readonly label: string;
  readonly participantId: string;
}

type ResolveStepStatus = (input: {
  participantId: string;
  roundState: CombatRoundState;
  status: CombatRoundStepStatus;
  step: CombatRoundStep;
}) => CombatRoundStepStatus;

function attackPhaseForStep(step: CombatRoundStep): CombatRoundPhase | undefined {
  if (step === "phase_1_actions") return "phase1";
  if (step === "phase_2_actions") return "phase2";
  return undefined;
}

function immutableRoundIdentity(
  state: Pick<
    CombatRoundState,
    | "commands"
    | "events"
    | "observationAttempts"
    | "observationRelationships"
    | "roundNumber"
    | "stepSnapshots"
  >,
): string {
  return [
    state.roundNumber,
    state.commands.map((command) => command.id).join(","),
    state.events.map((event) => event.id).join(","),
    state.stepSnapshots
      .map((snapshot) => `${snapshot.roundNumber}:${snapshot.participantId}:${snapshot.step}`)
      .join(","),
    state.observationAttempts.map((attempt) => attempt.id).join(","),
    state.observationRelationships
      .map(
        (relationship) =>
          `${relationship.observerParticipantId}:${relationship.targetParticipantId}:${relationship.lastCompletedAttemptRevision ?? ""}`,
      )
      .join(","),
  ].join("|");
}

/**
 * Archive identity follows immutable round lineage rather than the active encounter revision.
 * Equivalent archive arrays therefore retain the same presentation object across live mutations.
 */
export function buildArchivedCombatPresentationIdentity(input: {
  participantRows: readonly CombatPresentationParticipantRow[];
  roundState: CombatRoundState;
}): string {
  return [
    input.roundState.rounds.map(immutableRoundIdentity).join("~"),
    input.participantRows.map((row) => `${row.participantId}:${row.label}`).join(","),
  ].join("::");
}

export interface CombatPresentationLayerCache {
  resolveActive(identity: string, build: () => ActiveCombatPresentation): ActiveCombatPresentation;
  resolveArchived(
    identity: string,
    build: () => ArchivedCombatPresentation,
  ): ArchivedCombatPresentation;
  resolveSelection(identity: string, build: () => CombatSelectionOverlay): CombatSelectionOverlay;
  resolveTrackerBase(identity: string, build: () => CombatTrackerModel): CombatTrackerModel;
  resolveTracker(identity: string, build: () => CombatTrackerModel): CombatTrackerModel;
}

/**
 * A panel-scoped cache makes layer ownership explicit. It is deliberately
 * identity-driven: React renders and transient overlays are not cache keys.
 */
export function createCombatPresentationLayerCache(): CombatPresentationLayerCache {
  let active: { identity: string; value: ActiveCombatPresentation } | undefined;
  let archived: { identity: string; value: ArchivedCombatPresentation } | undefined;
  let selection: { identity: string; value: CombatSelectionOverlay } | undefined;
  let trackerBase: { identity: string; value: CombatTrackerModel } | undefined;
  let tracker: { identity: string; value: CombatTrackerModel } | undefined;

  return {
    resolveActive(identity, build) {
      if (active?.identity !== identity) active = { identity, value: build() };
      return active.value;
    },
    resolveArchived(identity, build) {
      if (archived?.identity !== identity) archived = { identity, value: build() };
      return archived.value;
    },
    resolveSelection(identity, build) {
      if (selection?.identity !== identity) selection = { identity, value: build() };
      return selection.value;
    },
    resolveTrackerBase(identity, build) {
      if (trackerBase?.identity !== identity) trackerBase = { identity, value: build() };
      return trackerBase.value;
    },
    resolveTracker(identity, build) {
      if (tracker?.identity !== identity) tracker = { identity, value: build() };
      return tracker.value;
    },
  };
}

function buildTrackerCellFactsForRound(input: {
  activeRoundNumber: number;
  participantRows: readonly CombatPresentationParticipantRow[];
  progressionTrackerIndex?: CombatProgressionTrackerIndex;
  resolveStepStatus: ResolveStepStatus;
  roundState: CombatRoundState;
}): CombatTrackerCellFacts[] {
  const { roundState } = input;
  const snapshotByCellKey = new Map(
    roundState.stepSnapshots.map((snapshot) => [
      buildCombatTrackerCellKey({
        participantId: snapshot.participantId,
        roundNumber: snapshot.roundNumber,
        step: snapshot.step,
      }),
      snapshot,
    ]),
  );
  const feintByAttackerId = new Map(
    roundState.feintProposals
      .filter((proposal) => proposal.roundNumber === roundState.roundNumber)
      .map((proposal) => [proposal.attackerParticipantId, proposal]),
  );
  const adjustDistanceByAttackerId = new Map(
    roundState.adjustDistanceProposals
      .filter((proposal) => proposal.roundNumber === roundState.roundNumber)
      .map((proposal) => [proposal.attackerParticipantId, proposal]),
  );
  const outgoingAttackByParticipantPhase = new Map<string, CombatRoundAttackRollResult>();
  const incomingAttackByParticipantPhase = new Map<string, CombatRoundAttackRollResult>();

  for (const participant of roundState.participants) {
    for (const phase of ["phase1", "phase2"] as const) {
      const key = `${participant.participantId}:${phase}`;
      const outgoing = getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: participant.participantId,
        phase,
        state: roundState,
      });
      const incoming = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: participant.participantId,
        phase,
        state: roundState,
      });
      if (outgoing) outgoingAttackByParticipantPhase.set(key, outgoing);
      if (incoming) incomingAttackByParticipantPhase.set(key, incoming);
    }
  }

  const facts: CombatTrackerCellFacts[] = [];
  for (const participantRow of input.participantRows) {
    const roundParticipant =
      roundState.participants.find(
        (candidate) => candidate.participantId === participantRow.participantId,
      ) ??
      ({
        declaration: undefined,
        initiatives: {},
        label: participantRow.label,
        participantId: participantRow.participantId,
        stepStatuses: {},
      } as CombatRoundParticipant);

    for (const step of COMBAT_ROUND_STEPS) {
      const status = input.resolveStepStatus({
        participantId: participantRow.participantId,
        roundState,
        status: roundParticipant.stepStatuses[step] ?? "pending",
        step,
      });
      const initiative =
        step === "initiative_phase_1"
          ? roundParticipant.initiatives.phase1
          : step === "initiative_phase_2"
            ? roundParticipant.initiatives.phase2
            : undefined;
      const attackPhase = attackPhaseForStep(step);
      const cellKey = buildCombatTrackerCellKey({
        participantId: participantRow.participantId,
        roundNumber: roundState.roundNumber,
        step,
      });
      const snapshot = snapshotByCellKey.get(cellKey);
      const canonicalAttackResult = attackPhase
        ? outgoingAttackByParticipantPhase.get(`${participantRow.participantId}:${attackPhase}`)
        : undefined;
      const attackResult = canonicalAttackResult ?? snapshot?.attackResult;
      const resolutionPhase = getCombatRoundResolutionPhaseForStep(step);
      const resolutionAttackResult = snapshot
        ? snapshot.attackResult
        : resolutionPhase
          ? incomingAttackByParticipantPhase.get(
              `${participantRow.participantId}:${resolutionPhase}`,
            )
          : undefined;
      const phaseResolutionResult = snapshot
        ? snapshot.phaseResolutionResult
        : resolutionAttackResult
          ? getCombatRoundPhaseResolutionResultForAttack({
              attackResult: resolutionAttackResult,
              state: roundState,
            })
          : undefined;
      const feintProposal =
        step === "phase_1_actions"
          ? feintByAttackerId.get(participantRow.participantId)
          : undefined;
      const feintModifier = feintProposal?.review
        ? (feintProposal.review.gmDefenderObDbModifier ??
          feintProposal.review.proposedDefenderObDbModifier)
        : undefined;
      const adjustDistanceProposal =
        step === "phase_1_actions"
          ? adjustDistanceByAttackerId.get(participantRow.participantId)
          : undefined;
      const adjustDistanceRollRecorded =
        step === "phase_1_actions"
          ? roundState.adjustDistanceProposals.some(
              (proposal) =>
                proposal.roundNumber === roundState.roundNumber &&
                ((proposal.attackerParticipantId === participantRow.participantId &&
                  proposal.attackerRollRecorded) ||
                  (proposal.defenderParticipantId === participantRow.participantId &&
                    proposal.defenderRollRecorded)),
            )
          : false;
      const progression =
        roundState.roundNumber === input.activeRoundNumber
          ? input.progressionTrackerIndex?.byCellKey[cellKey]
          : undefined;

      facts.push({
        adjustDistance: adjustDistanceProposal
          ? {
              committedDistance: adjustDistanceProposal.review?.committedDistance,
              currentDistance: adjustDistanceProposal.currentDistance,
              defenderLabel: roundState.participants.find(
                (participant) =>
                  participant.participantId === adjustDistanceProposal.defenderParticipantId,
              )?.label,
              requestedDistance: adjustDistanceProposal.requestedDistance,
              status: adjustDistanceProposal.status === "committed" ? "committed" : "pending",
            }
          : undefined,
        adjustDistanceRollRecorded,
        actionResultStatus: snapshot?.actionResultStatus,
        attackAttackerLabel: attackResult
          ? roundState.participants.find(
              (participant) => participant.participantId === attackResult.attackerParticipantId,
            )?.label
          : undefined,
        attackDefenderLabel: attackResult
          ? roundState.participants.find(
              (participant) => participant.participantId === attackResult.defenderParticipantId,
            )?.label
          : undefined,
        attackResult,
        commands: roundState.commands,
        declarationSubmittedBy: roundParticipant.declaration?.submittedBy,
        feint: feintProposal
          ? {
              defenderLabel: roundState.participants.find(
                (participant) => participant.participantId === feintProposal.defenderParticipantId,
              )?.label,
              defenderPhase2Modifier: feintModifier,
              method: feintProposal.method,
              status:
                feintProposal.status === "committed"
                  ? "committed"
                  : feintProposal.status === "impossible"
                    ? "impossible"
                    : "pending",
            }
          : undefined,
        inspectable: Boolean(
          progression ||
          snapshot ||
          attackResult ||
          phaseResolutionResult ||
          feintProposal ||
          adjustDistanceProposal ||
          adjustDistanceRollRecorded ||
          initiative ||
          status !== "pending",
        ),
        initiativeCommitted:
          step === "initiative_phase_1" || step === "initiative_phase_2"
            ? roundState.commands.some(
                (command) =>
                  command.type === "commit_phase_initiative_resolution" &&
                  command.roundNumber === roundState.roundNumber &&
                  command.phase === (step === "initiative_phase_1" ? "phase1" : "phase2"),
              )
            : undefined,
        initiativeRollRecorded: Boolean(initiative),
        initiativeResolutionType:
          initiative && "resolutionType" in initiative ? initiative.resolutionType : undefined,
        initiativeTotal: getCombatRoundInitiativeTotal(initiative),
        participantId: participantRow.participantId,
        participantLabel: participantRow.label,
        phaseResolutionResult,
        progression,
        roundNumber: roundState.roundNumber,
        selected: false,
        status,
        step,
        stepOutcome: deriveCombatHistoryStepOutcome(snapshot),
      });
    }
  }

  return facts;
}

export function buildArchivedCombatPresentation(input: {
  buildHistoricalActionResult: ArchivedHistoricalActionResultBuilder;
  identity: string;
  participantRows: readonly CombatPresentationParticipantRow[];
  resolveStepStatus: ResolveStepStatus;
  roundState: CombatRoundState;
}): ArchivedCombatPresentation {
  const timeline = getCombatRoundTimelineRoundStates(input.roundState);
  const archivedRoundStates = timeline.filter(
    (state) => state.roundNumber !== input.roundState.roundNumber,
  );
  const trackerCellFacts = archivedRoundStates.flatMap((state) =>
    buildTrackerCellFactsForRound({
      activeRoundNumber: input.roundState.roundNumber,
      participantRows: input.participantRows,
      resolveStepStatus: input.resolveStepStatus,
      roundState: state,
    }),
  );

  return {
    identity: input.identity,
    inspectorPresentation: buildArchivedInspectorPresentationIndex({
      buildHistoricalActionResult: input.buildHistoricalActionResult,
      roundStates: archivedRoundStates,
    }),
    roundNumbers: archivedRoundStates.map((state) => state.roundNumber),
    roundStates: archivedRoundStates,
    tracker: buildCombatTrackerModel({
      activeRoundNumber: input.roundState.roundNumber,
      cellFacts: trackerCellFacts,
      rounds: archivedRoundStates.map((state) => ({ roundNumber: state.roundNumber })),
      rows: input.participantRows.map((participant) => ({
        ...participant,
        selected: false,
      })),
      steps: COMBAT_ROUND_STEPS,
    }),
    trackerCellFacts,
  };
}

export function buildActiveCombatPresentation(input: {
  combatLogSourceRevision?: string;
  encounterId: string;
  encounterRevision: string;
  participantRows?: readonly CombatPresentationParticipantRow[];
  resolveStepStatus: ResolveStepStatus;
  roundState: CombatRoundState;
  scenarioParticipants?: readonly ScenarioParticipant[];
}): ActiveCombatPresentation {
  const activeCombatLogPresentation = measureCombatPerformanceStage(
    "panel_combat_log_presentation",
    () =>
      buildActiveCombatLogPresentation({
        encounterId: input.encounterId,
        encounterRevision: input.combatLogSourceRevision ?? input.encounterRevision,
        roundState: input.roundState,
      }),
  );
  const participation = input.scenarioParticipants
    ? projectActiveCombatParticipation({
        encounterRevision: input.encounterRevision,
        scenarioParticipants: input.scenarioParticipants,
        state: input.roundState,
      })
    : undefined;
  const progressionProjection = buildCombatProgressionProjection(input.roundState, {
    participation,
  });
  const progression = projectCombatProgressionPresentation({
    projection: progressionProjection,
    viewer: { kind: "gm" },
  });
  const progressionTrackerIndex = buildCombatProgressionTrackerIndex(progression);
  const participantById = new Map(
    input.roundState.participants.map((participant) => [participant.participantId, participant]),
  );
  const displayParticipants = getCombatRoundManagerDisplayParticipantIds(
    input.roundState,
    progression,
  )
    .map((participantId) => participantById.get(participantId))
    .filter((participant): participant is CombatRoundParticipant => Boolean(participant));
  const participantRows =
    input.participantRows ??
    displayParticipants.map((participant) => ({
      label: participant.label,
      participantId: participant.participantId,
    }));
  const projectedCurrentTasks = getCombatProgressionPresentationTasks(progression).filter(
    (task) => task.contributesToProgression,
  );
  const currentAction = measureCombatPerformanceStage(
    "panel_current_task_action_presentation",
    () =>
      buildCurrentActionPresentation({
        encounterId: input.encounterId,
        encounterRevision: input.encounterRevision,
        progression,
        viewer: { kind: "gm" },
      }) ?? undefined,
  );
  const currentTask =
    projectedCurrentTasks.find((task) => task.id === currentAction?.taskId) ??
    projectedCurrentTasks[0];
  const liveInspectorContext = buildCombatRoundLiveInspectorContext(currentTask);
  const currentTaskSelection = getCombatRoundLiveInspectorSelection({
    context: liveInspectorContext,
    state: input.roundState,
  });
  const trackerCellFacts = buildTrackerCellFactsForRound({
    activeRoundNumber: input.roundState.roundNumber,
    participantRows,
    progressionTrackerIndex,
    resolveStepStatus: input.resolveStepStatus,
    roundState: input.roundState,
  });

  return {
    combatLog: activeCombatLogPresentation.combatLog,
    currentAction,
    currentTask,
    currentTaskSelection,
    displayParticipants,
    gmEvents: activeCombatLogPresentation.gmEvents,
    resultEvents: activeCombatLogPresentation.resultEvents,
    identity: `${input.encounterId}:${input.encounterRevision}`,
    inspectorPresentation: createActiveInspectorPresentationStore(),
    liveInspectorContext,
    progression,
    progressionProjection,
    progressionTrackerIndex,
    projectedCurrentTasks,
    roundState: input.roundState,
    tracker: buildCombatTrackerModel({
      activeRoundNumber: input.roundState.roundNumber,
      cellFacts: trackerCellFacts,
      rounds: [
        {
          currentStep: input.roundState.currentStep,
          roundNumber: input.roundState.roundNumber,
        },
      ],
      rows: displayParticipants.map((participant) => ({
        label: participant.label,
        participantId: participant.participantId,
        selected: false,
      })),
      steps: COMBAT_ROUND_STEPS,
    }),
    trackerCellFacts,
  };
}

export function buildCombatSelectionOverlay(input: {
  active: ActiveCombatPresentation;
  archived: ArchivedCombatPresentation;
  localSelection: CombatRoundSelectionTarget;
  manualSelection?: CombatRoundSelectionTarget;
  pendingSelection?: CombatRoundSelectionTarget;
  selectedRoundNumber: number;
}): CombatSelectionOverlay {
  const renderedInspectionSelection = getCombatRoundRenderedInspectorSelection({
    currentTaskSelection: input.active.currentTaskSelection,
    localSelection: input.localSelection,
    manualSelection: input.manualSelection,
    pendingSelection: input.pendingSelection,
  });
  const selectedRoundState =
    input.archived.roundStates.find(
      (candidate) => candidate.roundNumber === input.selectedRoundNumber,
    ) ?? input.active.roundState;
  const selectedRoundNumber = selectedRoundState.roundNumber;

  return {
    identity: `${selectedRoundNumber}:${renderedInspectionSelection.participantId}:${renderedInspectionSelection.step}`,
    renderedInspectionSelection,
    selectedRoundIsActive: selectedRoundNumber === input.active.roundState.roundNumber,
    selectedRoundNumber,
    selectedRoundState,
  };
}

export function buildCombatPendingOverlay(input: {
  error?: string;
  saving: boolean;
  workflow: string;
}): CombatPendingOverlay {
  return {
    error: input.error,
    identity: `${Number(input.saving)}:${input.workflow}:${input.error ?? ""}`,
    saving: input.saving,
    workflow: input.workflow,
  };
}

export function applyCombatTrackerSelectionOverlay(input: {
  base: CombatTrackerModel;
  selection: CombatSelectionOverlay;
}): CombatTrackerModel {
  const selectedParticipantId = input.selection.renderedInspectionSelection.participantId;
  const selectedCellKey = selectedParticipantId
    ? buildCombatTrackerCellKey({
        participantId: selectedParticipantId,
        roundNumber: input.selection.selectedRoundNumber,
        step: input.selection.renderedInspectionSelection.step,
      })
    : undefined;
  const selectedCell = selectedCellKey ? input.base.cells[selectedCellKey] : undefined;

  return {
    ...input.base,
    cells: selectedCell
      ? {
          ...input.base.cells,
          [selectedCellKey!]: {
            ...selectedCell,
            selected: true,
          },
        }
      : input.base.cells,
    rows: input.base.rows.map((row) =>
      row.participantId === input.selection.renderedInspectionSelection.participantId
        ? { ...row, selected: true }
        : row,
    ),
    selectedCellKey: selectedCell ? selectedCellKey : undefined,
  };
}

export function buildCombatTrackerBasePresentation(input: {
  active: ActiveCombatPresentation;
  archived: ArchivedCombatPresentation;
}): CombatTrackerModel {
  return {
    cells: {
      ...input.archived.tracker.cells,
      ...input.active.tracker.cells,
    },
    currentTaskCellKey: input.active.tracker.currentTaskCellKey,
    legend: input.active.tracker.legend,
    rounds: [
      ...input.archived.roundNumbers.map((roundNumber) => ({ roundNumber })),
      {
        currentStep: input.active.roundState.currentStep,
        roundNumber: input.active.roundState.roundNumber,
      },
    ],
    rows: input.active.tracker.rows,
    selectedCellKey: undefined,
    steps: COMBAT_ROUND_STEPS,
  };
}

export function composeCombatPresentationModel(input: {
  active: ActiveCombatPresentation;
  archived: ArchivedCombatPresentation;
  pending: CombatPendingOverlay;
  selection: CombatSelectionOverlay;
  tracker: CombatTrackerModel;
}): CombatPresentationModel {
  return {
    ...input,
    timelineRoundNumbers: [...input.archived.roundNumbers, input.active.roundState.roundNumber],
    timelineRoundStates: [...input.archived.roundStates, input.active.roundState],
  };
}
