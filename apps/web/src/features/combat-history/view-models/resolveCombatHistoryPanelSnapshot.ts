import {
  COMBAT_ROUND_STEPS,
  type CombatRoundStep,
  type ProjectedCombatHistorySnapshot,
} from "@glantri/domain";

type CombatHistorySnapshotLike = {
  roundNumber: number;
  step: CombatRoundStep;
};

/**
 * Resolves immutable panel context without consulting current combat state.
 * Exact snapshots win; otherwise only earlier snapshots in the same round and
 * participant are eligible.
 */
export function resolveCombatHistoryPanelSnapshot<TSnapshot extends CombatHistorySnapshotLike>(
  input: {
    getParticipantId: (snapshot: TSnapshot) => string | undefined;
    isValid?: (snapshot: TSnapshot) => boolean;
    participantId: string;
    roundNumber: number;
    selectedStep: CombatRoundStep;
    snapshots: readonly TSnapshot[];
  },
): TSnapshot | undefined {
  const selectedStepIndex = COMBAT_ROUND_STEPS.indexOf(input.selectedStep);

  return input.snapshots
    .map((snapshot, sourceIndex) => ({ snapshot, sourceIndex }))
    .filter(({ snapshot }) => {
      const stepIndex = COMBAT_ROUND_STEPS.indexOf(snapshot.step);
      return (
        snapshot.roundNumber === input.roundNumber &&
        input.getParticipantId(snapshot) === input.participantId &&
        stepIndex >= 0 &&
        stepIndex <= selectedStepIndex &&
        (input.isValid?.(snapshot) ?? true)
      );
    })
    .sort(
      (left, right) =>
        COMBAT_ROUND_STEPS.indexOf(right.snapshot.step) -
          COMBAT_ROUND_STEPS.indexOf(left.snapshot.step) ||
        right.sourceIndex - left.sourceIndex,
    )[0]?.snapshot;
}

function hasPanelFacts(panel: object | undefined): boolean {
  return Boolean(panel && Object.keys(panel).length > 0);
}

/** Builds contextual projected panels while leaving Action Result exact-step only. */
export function resolveProjectedCombatHistoryPanelSnapshot(input: {
  participantId: string;
  roundNumber: number;
  selectedStep: CombatRoundStep;
  snapshots: readonly ProjectedCombatHistorySnapshot[];
}): ProjectedCombatHistorySnapshot | undefined {
  const resolve = (
    isValid?: (snapshot: ProjectedCombatHistorySnapshot) => boolean,
  ): ProjectedCombatHistorySnapshot | undefined =>
    resolveCombatHistoryPanelSnapshot({
      ...input,
      getParticipantId: (snapshot) => snapshot.participant.participantId,
      isValid,
    });
  const base = resolve();
  if (!base) return undefined;

  const exact = input.snapshots.find(
    (snapshot) =>
      snapshot.roundNumber === input.roundNumber &&
      snapshot.participant.participantId === input.participantId &&
      snapshot.step === input.selectedStep,
  );

  return {
    ...base,
    id: exact?.id ?? base.id,
    panels: {
      actionResult: exact?.panels.actionResult ?? {},
      actionSelector:
        resolve((snapshot) => hasPanelFacts(snapshot.panels.actionSelector))?.panels
          .actionSelector ?? {},
      modifiers:
        resolve((snapshot) => hasPanelFacts(snapshot.panels.modifiers))?.panels.modifiers ?? {},
      phase1: resolve((snapshot) => hasPanelFacts(snapshot.panels.phase1))?.panels.phase1 ?? {},
      phase2: resolve((snapshot) => hasPanelFacts(snapshot.panels.phase2))?.panels.phase2 ?? {},
    },
    step: input.selectedStep,
  };
}
