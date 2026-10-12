import {
  COMBAT_ROUND_STEPS,
  buildCombatLogProjection,
  buildCombatRoundInspector,
  deriveCombatHistoryStepOutcome,
  getCombatRoundEventsWithDerivedResultCoverage,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  type CombatRoundAttackRollResult,
  type CombatRoundParryModifierBreakdownEntry,
  type CombatRoundPhaseResolutionResult,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepSnapshot,
  type ProjectedCombatHistoryEvent,
  type ScenarioParticipantCombatContext,
} from "@glantri/domain";

import {
  buildCombatEventResultModel,
  buildCombatStepResultPresentation,
  resolveCombatHistoryPanelSnapshot,
  selectCombatEventsForTrackerCell,
  type CombatCalculationPresentation,
  type CombatEventResultModel,
  type CombatStepResultPresentation,
} from "@/features/combat-history";
import type {
  PlayerCombatModifierBucketView,
  PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import { applyDefaultPlayerCombatPhaseContext } from "@/features/player-combat/playerCombatPhaseModel";
import type { PlayerCombatLoadoutSummary } from "@/features/player-combat/playerCombatPhaseModel";
import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";
import { measureCombatPerformanceStage } from "@/lib/performance/combatPerformance";
import {
  buildCombatRoundPhasePanelProjection,
  type CombatRoundPhasePanelProjection,
} from "../combatRoundPhasePanelProjection";
import {
  buildActiveAttackResolutionPresentation,
  projectGmCombatEvents,
} from "./activeInspectorPresentation";
import {
  buildHistoricalInspectionContext,
  type HistoricalInspectionContext,
} from "./historicalInspectionContext";

export interface ArchivedHistoricalActionResult {
  readonly detailLines?: readonly string[];
  readonly interpretedResult: string;
  readonly rankLabel?: string;
  readonly resultLabel?: string;
  readonly sections?: readonly {
    readonly calculations: readonly CombatCalculationPresentation[];
    readonly resultLine?: string;
    readonly title: string;
  }[];
}

export type ArchivedHistoricalActionResultBuilder = (input: {
  participantId?: string;
  snapshot?: CombatRoundStepSnapshot;
  step?: CombatRoundStep;
}) => ArchivedHistoricalActionResult;

export interface ArchivedAttackResolutionPresentation {
  readonly attackResult?: CombatRoundAttackRollResult;
  readonly parry: {
    readonly base?: number;
    readonly modifierAdjustment: number;
    readonly modifierBreakdown: readonly CombatRoundParryModifierBreakdownEntry[];
    readonly selection: {
      readonly usedMainHand: boolean;
      readonly usedOffHand: boolean;
    };
    readonly sources?: {
      readonly combinedLabel?: string;
      readonly combinedScore?: number;
      readonly mainHand?: { readonly label: string; readonly score: number };
      readonly offHand?: { readonly label: string; readonly score: number };
    };
  };
  readonly phaseResolutionOwnerParticipantId?: string;
  readonly phaseResolutionOwnerStatus?: ReturnType<
    typeof buildActiveAttackResolutionPresentation
  >["phaseResolutionOwnerStatus"];
  readonly resolutionAttackResult?: CombatRoundAttackRollResult;
  readonly resolutionResult?: CombatRoundPhaseResolutionResult;
}

export interface ArchivedInspectorPresentation {
  readonly attackResolution: ArchivedAttackResolutionPresentation;
  readonly canonicalActionResultEvents: readonly ProjectedCombatHistoryEvent[];
  readonly canonicalActionResultModel: CombatEventResultModel;
  readonly currentStepResults?: CombatStepResultPresentation;
  readonly historicalActionResult?: ArchivedHistoricalActionResult;
  readonly historicalStatusLabel?: string;
  readonly historicalContext: HistoricalInspectionContext;
  readonly inspector: ReturnType<typeof buildCombatRoundInspector>;
  readonly modifierRows: readonly PlayerCombatModifierBucketView[];
  readonly phaseLoadouts: Readonly<Record<"phase1" | "phase2", PlayerCombatLoadoutSummary>>;
  readonly panelSnapshot?: CombatRoundStepSnapshot;
  readonly phasePanels: Readonly<
    Record<"phase1" | "phase2", CombatRoundPhasePanelProjection | undefined>
  >;
  readonly roundNumber: number;
  readonly snapshot?: CombatRoundStepSnapshot;
  readonly stepOutcome: ReturnType<typeof deriveCombatHistoryStepOutcome>;
}

export interface ArchivedInspectorPresentationIndex {
  readonly entries: ReadonlyMap<string, ArchivedInspectorPresentation>;
  get(input: {
    participantId?: string;
    roundNumber: number;
    step: CombatRoundStep;
  }): ArchivedInspectorPresentation | undefined;
}

export function buildArchivedInspectorPresentationKey(input: {
  participantId?: string;
  roundNumber: number;
  step: CombatRoundStep;
}): string {
  return `${input.roundNumber}:${input.participantId ?? "none"}:${input.step}`;
}

function createUnrecordedHistoricalPhaseContext(): ScenarioParticipantCombatContext {
  return applyDefaultPlayerCombatPhaseContext(createEmptyPlayerEncounterCombatContext());
}

function resolvePanelSnapshot(input: {
  participantId: string;
  roundState: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundStepSnapshot | undefined {
  const resolve = (isValid?: (snapshot: CombatRoundStepSnapshot) => boolean) =>
    resolveCombatHistoryPanelSnapshot({
      getParticipantId: (snapshot) => snapshot.participantId,
      isValid,
      participantId: input.participantId,
      roundNumber: input.roundState.roundNumber,
      selectedStep: input.step,
      snapshots: input.roundState.stepSnapshots,
    });
  const base = resolve();
  if (!base) return undefined;

  const exact = getCombatRoundStepSnapshot({
    participantId: input.participantId,
    roundNumber: input.roundState.roundNumber,
    state: input.roundState,
    step: input.step,
  });
  const recordedDeclaration = input.roundState.events.find(
    (event) =>
      event.type === "declaration" &&
      event.ownerParticipantId === input.participantId &&
      event.step === "select_actions",
  );
  const declarationOutcome = recordedDeclaration?.facts.involvedOutcome;
  const archivedDeclaration = input.roundState.participants.find(
    (participant) => participant.participantId === input.participantId,
  )?.declaration;
  const declarationFromEvent =
    declarationOutcome && typeof declarationOutcome.actionId === "string"
      ? {
          actionId: declarationOutcome.actionId,
          additionalActionNotes: archivedDeclaration?.additionalActionNotes,
          movementId:
            typeof declarationOutcome.movementId === "string"
              ? declarationOutcome.movementId
              : archivedDeclaration?.movementId,
          movementIntent: archivedDeclaration?.movementIntent,
          movementPreferenceTargets: input.roundState.participants
            .filter((participant) => participant.participantId !== input.participantId)
            .map((participant) => ({
              displayName: participant.label,
              id: participant.participantId,
            })),
          secondaryActionContext: archivedDeclaration?.secondaryActionContext,
          secondaryActionId:
            typeof declarationOutcome.secondaryActionId === "string"
              ? declarationOutcome.secondaryActionId
              : archivedDeclaration?.secondaryActionId,
        }
      : undefined;

  return {
    ...base,
    ...exact,
    declarationSummary:
      resolve((snapshot) => Boolean(snapshot.declarationSummary))?.declarationSummary ??
      declarationFromEvent,
    modifierSummary: resolve((snapshot) => Boolean(snapshot.modifierSummary))?.modifierSummary,
    phasePanels: {
      phase1: resolve((snapshot) => Boolean(snapshot.phasePanels?.phase1))?.phasePanels?.phase1,
      phase2: resolve((snapshot) => Boolean(snapshot.phasePanels?.phase2))?.phasePanels?.phase2,
    },
    step: input.step,
  };
}

const HISTORICAL_PHASE_CARDS: Readonly<Record<"phase1" | "phase2", PlayerCombatPhaseCardView>> = {
  phase1: {
    description: "",
    phaseLabel: "Phase 1",
    stats: [],
    title: "",
  },
  phase2: {
    description: "",
    phaseLabel: "Phase 2",
    stats: [],
    title: "",
  },
};

function buildHistoricalPhasePanel(input: {
  panelSnapshot?: CombatRoundStepSnapshot;
  participantId: string;
  phaseKey: "phase1" | "phase2";
  step: CombatRoundStep;
}): CombatRoundPhasePanelProjection | undefined {
  const snapshot = input.panelSnapshot?.phasePanels?.[input.phaseKey];
  if (!snapshot) return undefined;

  return buildCombatRoundPhasePanelProjection({
    actionId:
      (input.panelSnapshot?.declarationSummary?.actionId as
        | Parameters<typeof buildCombatRoundPhasePanelProjection>[0]["actionId"]
        | undefined) ?? "",
    attackStats: null,
    participantId: input.participantId,
    phaseCard: HISTORICAL_PHASE_CARDS[input.phaseKey],
    phaseContext: snapshot.phaseContext ?? createUnrecordedHistoricalPhaseContext(),
    phaseDefenseStats: null,
    phaseKey: input.phaseKey,
    secondaryActionId:
      (input.panelSnapshot?.declarationSummary?.secondaryActionId as
        | Parameters<typeof buildCombatRoundPhasePanelProjection>[0]["secondaryActionId"]
        | undefined) ?? "",
    selectedStep: input.step,
    snapshotAttackStats: snapshot.attackSummary,
    snapshotDefenseStats: snapshot.defenseSummary,
  });
}

function buildHistoricalPhaseLoadout(input: {
  panelSnapshot?: CombatRoundStepSnapshot;
  phaseKey: "phase1" | "phase2";
  snapshot?: CombatRoundStepSnapshot;
}): PlayerCombatLoadoutSummary {
  const phaseSnapshot = input.panelSnapshot?.phasePanels?.[input.phaseKey];
  return {
    attackModeOptions: [],
    // Archived history is read-only; it offers no attack source to choose.
    attackSourceOptions: [],
    attackStats: phaseSnapshot?.attackSummary ?? null,
    mainHandParryItemLabel: phaseSnapshot?.mainHandParryItemLabel ?? "Unarmed",
    offHandParryItemLabel: phaseSnapshot?.offHandParryItemLabel ?? "Unarmed",
    passiveInitiative: input.snapshot?.initiativeResult?.baseInitiative ?? 0,
    reference: null,
    // Archived history replays a committed snapshot; no reference is derived, so nothing here
    // can have come from the unarmed execution fallback.
    referenceUsedUnarmedExecutionFallback: false,
    selectedAttackModeId: phaseSnapshot?.phaseContext.attackModeId,
    selectedAttackModeUsedFallback: false,
  };
}

function getHistoricalStatusLabel(
  outcome: ReturnType<typeof deriveCombatHistoryStepOutcome>,
): string | undefined {
  if (!outcome) return undefined;
  if (outcome.category === "not_required") return "Not required";
  if (outcome.category === "not_applicable") return "Not applicable";
  return "Skipped";
}

function getAttackPhaseForStep(step: CombatRoundStep): "phase1" | "phase2" | undefined {
  if (step === "phase_1_actions") return "phase1";
  if (step === "phase_2_actions") return "phase2";
  return undefined;
}

function buildArchivedAttackResolutionPresentation(input: {
  panelSnapshot?: CombatRoundStepSnapshot;
  participantId: string;
  roundState: CombatRoundState;
  step: CombatRoundStep;
}): ArchivedAttackResolutionPresentation {
  const presentation = buildActiveAttackResolutionPresentation({
    attackPhase: getAttackPhaseForStep(input.step),
    participantId: input.participantId,
    resolutionPhase: getCombatRoundResolutionPhaseForStep(input.step),
    roundState: input.roundState,
  });
  const resolution = presentation.resolutionResult?.parryResolution;
  const phaseSnapshot = getCombatRoundResolutionPhaseForStep(input.step)
    ? input.panelSnapshot?.phasePanels?.[getCombatRoundResolutionPhaseForStep(input.step)!]
    : undefined;
  const mainHandScore = resolution?.mainHandParryScore;
  const offHandScore = resolution?.offHandParryScore;

  return {
    attackResult: presentation.attackResult,
    parry: {
      base:
        resolution?.combinedParryScore ??
        (mainHandScore !== undefined || offHandScore !== undefined
          ? (mainHandScore ?? 0) + (offHandScore ?? 0)
          : undefined),
      modifierAdjustment: resolution?.modifierAdjustment ?? 0,
      modifierBreakdown: resolution?.modifierBreakdown ?? [],
      selection: {
        usedMainHand: resolution?.usedMainHand ?? mainHandScore !== undefined,
        usedOffHand: resolution?.usedOffHand ?? offHandScore !== undefined,
      },
      sources: resolution
        ? {
            combinedLabel: resolution.parrySourceLabel,
            combinedScore: resolution.combinedParryScore,
            mainHand:
              mainHandScore !== undefined
                ? {
                    label: phaseSnapshot?.mainHandParryItemLabel ?? "Main hand",
                    score: mainHandScore,
                  }
                : undefined,
            offHand:
              offHandScore !== undefined
                ? {
                    label: phaseSnapshot?.offHandParryItemLabel ?? "Off hand",
                    score: offHandScore,
                  }
                : undefined,
          }
        : undefined,
    },
    phaseResolutionOwnerParticipantId: presentation.phaseResolutionOwnerParticipantId,
    phaseResolutionOwnerStatus: presentation.phaseResolutionOwnerStatus,
    resolutionAttackResult: presentation.resolutionAttackResult,
    resolutionResult: presentation.resolutionResult,
  };
}

/**
 * Builds every immutable completed-round inspector candidate once. Selection
 * later performs a map lookup and never participates in archive ownership.
 */
export function buildArchivedInspectorPresentationIndex(input: {
  buildHistoricalActionResult: ArchivedHistoricalActionResultBuilder;
  roundStates: readonly CombatRoundState[];
}): ArchivedInspectorPresentationIndex {
  const entries = new Map<string, ArchivedInspectorPresentation>();

  for (const [roundIndex, roundState] of input.roundStates.entries()) {
    const previousRoundState = input.roundStates[roundIndex - 1];
    const resultEvents = getCombatRoundEventsWithDerivedResultCoverage({
      commands: roundState.commands,
      encounterId: roundState.encounterId ?? "combat-history",
      events: roundState.events,
      participants: roundState.participants,
      phaseResolutionResults: roundState.phaseResolutionResults,
      roundEndReview: roundState.roundEndReview,
      roundNumber: roundState.roundNumber,
      stepSnapshots: roundState.stepSnapshots,
    });
    const gmEvents = projectGmCombatEvents({
      events: resultEvents,
      participants: roundState.participants,
    });
    const combatLog = buildCombatLogProjection({
      encounterId: roundState.encounterId ?? "combat-history",
      sourceRevision: `round:${roundState.roundNumber}:archived`,
      state: roundState,
    });
    const projectedEventById = new Map(gmEvents.map((event) => [event.id, event]));

    for (const participant of roundState.participants) {
      for (const step of COMBAT_ROUND_STEPS) {
        const key = buildArchivedInspectorPresentationKey({
          participantId: participant.participantId,
          roundNumber: roundState.roundNumber,
          step,
        });
        const inspector = measureCombatPerformanceStage(
          "panel_build_combat_round_inspector",
          () =>
            buildCombatRoundInspector({
              participantId: participant.participantId,
              state: roundState,
              step,
            }),
          { archivedPresentationBuild: true },
        );
        const snapshot = getCombatRoundStepSnapshot({
          participantId: participant.participantId,
          roundNumber: roundState.roundNumber,
          state: roundState,
          step,
        });
        const panelSnapshot = measureCombatPerformanceStage(
          "panel_historical_snapshot_resolution",
          () =>
            resolvePanelSnapshot({
              participantId: participant.participantId,
              roundState,
              step,
            }),
          { archivedPresentationBuild: true },
        );
        const stepOutcome = deriveCombatHistoryStepOutcome(snapshot);
        const historicalContext = buildHistoricalInspectionContext({
          participantId: participant.participantId,
          previousRoundState,
          roundState,
          snapshot,
          step,
        });
        const selectedEvents = selectCombatEventsForTrackerCell({
          events: resultEvents,
          participantId: participant.participantId,
          retainLatestWhenEmpty: false,
          step,
        });
        const canonicalActionResultEvents = selectedEvents.flatMap((event) => {
          const projected = projectedEventById.get(event.id);
          return projected ? [projected] : [];
        });
        const canonicalActionResultModel = buildCombatEventResultModel(
          canonicalActionResultEvents,
          {
            calculationStage: "panel_historical_calculation_presentation",
            resultStage: "panel_historical_attack_parry_result_presentation",
          },
        );
        const phasePanels = measureCombatPerformanceStage(
          "panel_phase_summary_presentation",
          () => ({
            phase1: buildHistoricalPhasePanel({
              panelSnapshot,
              participantId: participant.participantId,
              phaseKey: "phase1",
              step,
            }),
            phase2: buildHistoricalPhasePanel({
              panelSnapshot,
              participantId: participant.participantId,
              phaseKey: "phase2",
              step,
            }),
          }),
          { archivedPresentationBuild: true, historical: true },
        );
        const historicalActionResult = measureCombatPerformanceStage(
          "panel_historical_attack_parry_result_presentation",
          () =>
            stepOutcome
              ? { interpretedResult: stepOutcome.message }
              : input.buildHistoricalActionResult({
                  participantId: participant.participantId,
                  snapshot,
                  step,
                }),
          { archivedPresentationBuild: true },
        );
        const phaseLoadouts = {
          phase1: buildHistoricalPhaseLoadout({
            panelSnapshot,
            phaseKey: "phase1",
            snapshot,
          }),
          phase2: buildHistoricalPhaseLoadout({
            panelSnapshot,
            phaseKey: "phase2",
            snapshot,
          }),
        } as const;
        const attackResolution = measureCombatPerformanceStage(
          "panel_historical_attack_parry_result_presentation",
          () =>
            buildArchivedAttackResolutionPresentation({
              panelSnapshot,
              participantId: participant.participantId,
              roundState,
              step,
            }),
          { archivedPresentationBuild: true },
        );

        entries.set(key, {
          attackResolution,
          canonicalActionResultEvents,
          canonicalActionResultModel,
          currentStepResults: buildCombatStepResultPresentation({
            boundary: "round_boundary",
            combatLog,
            encounterId: roundState.encounterId ?? "combat-history",
            encounterRevision: `round:${roundState.roundNumber}:archived`,
            events: gmEvents,
            participantId: participant.participantId,
            roundNumber: roundState.roundNumber,
            step,
            viewer: { kind: "gm" },
          }),
          historicalActionResult,
          historicalContext,
          historicalStatusLabel: getHistoricalStatusLabel(stepOutcome),
          inspector,
          modifierRows: panelSnapshot?.modifierSummary?.rows ?? [],
          panelSnapshot,
          phaseLoadouts,
          phasePanels,
          roundNumber: roundState.roundNumber,
          snapshot,
          stepOutcome,
        });
      }
    }
  }

  return {
    entries,
    get(selection) {
      return entries.get(buildArchivedInspectorPresentationKey(selection));
    },
  };
}
