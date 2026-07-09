import type { CombatRoundState, CombatRoundStep } from "@glantri/domain";
import {
  getCombatRoundStepForCursorStep,
  isGlobalCombatRoundCursorStep,
  setCombatRoundSelection,
  sortCombatRoundParticipantsByInitiative,
} from "@glantri/domain";

export interface CombatRoundSelectionTarget {
  participantId?: string;
  step: CombatRoundStep;
}

export function getCurrentCombatRoundTaskSelection(
  state: CombatRoundState,
): CombatRoundSelectionTarget | undefined {
  const cursor = state.currentCursor;

  if (!cursor || cursor.roundNumber !== state.roundNumber) {
    return undefined;
  }

  if (
    cursor.participantId &&
    !state.participants.some((participant) => participant.participantId === cursor.participantId)
  ) {
    return undefined;
  }

  return {
    participantId: cursor.participantId,
    step: getCombatRoundStepForCursorStep(cursor.step),
  };
}

export function isSelectedCombatRoundStepExecutable(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): boolean {
  const currentTask = getCurrentCombatRoundTaskSelection(input.state);

  return Boolean(
    currentTask &&
      currentTask.participantId === input.participantId &&
      currentTask.step === input.step,
  );
}

export function isGlobalCombatRoundParticipantStep(step: CombatRoundStep): boolean {
  return (
    step === "select_actions" ||
    step === "review_action_modifiers" ||
    step === "initiative_phase_1" ||
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2" ||
    step === "round_summary"
  );
}

function getInitiativeSortPhase(step: CombatRoundStep): "phase1" | "phase2" | undefined {
  if (step === "phase_1_actions" || step === "review_phase_2_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions" || step === "review_phase_2_damage") {
    return "phase2";
  }

  return undefined;
}

export function getCombatRoundManagerDisplayParticipantIds(
  state: CombatRoundState,
): string[] {
  const phase = getInitiativeSortPhase(state.currentStep);

  if (!phase) {
    return state.participants.map((participant) => participant.participantId);
  }

  const hasCompleteInitiative = state.participants.every(
    (participant) => participant.initiatives[phase] !== undefined,
  );

  return (hasCompleteInitiative
    ? sortCombatRoundParticipantsByInitiative({ phase, state })
    : state.participants
  ).map((participant) => participant.participantId);
}

export function getNextCombatRoundParticipantSelection(input: {
  fromParticipantId?: string;
  participantIds: string[];
  step: CombatRoundStep;
}): CombatRoundSelectionTarget {
  const participantIndex = input.participantIds.indexOf(input.fromParticipantId ?? "");

  if (participantIndex < 0 || participantIndex >= input.participantIds.length - 1) {
    return {
      participantId: input.fromParticipantId,
      step: input.step,
    };
  }

  return {
    participantId: input.participantIds[participantIndex + 1],
    step: input.step,
  };
}

export function applyCombatRoundSelectionTarget(input: {
  selection: CombatRoundSelectionTarget;
  state: CombatRoundState;
}): CombatRoundState {
  if (!input.selection.participantId) {
    return {
      ...input.state,
      selectedParticipantId: undefined,
      selectedStep: input.selection.step,
    };
  }

  return setCombatRoundSelection({
    participantId: input.selection.participantId,
    state: input.state,
    step: input.selection.step,
  });
}

function isValidSelection(input: {
  participantIds: string[];
  selection?: CombatRoundSelectionTarget;
  step: CombatRoundStep;
}): boolean {
  return Boolean(
    input.selection?.participantId &&
      input.selection.step === input.step &&
      input.participantIds.includes(input.selection.participantId),
  );
}

export function normalizeCombatRoundManagerSelection(input: {
  manualSelection?: CombatRoundSelectionTarget;
  pendingSelection?: CombatRoundSelectionTarget;
  state: CombatRoundState;
}): CombatRoundState {
  if (!isGlobalCombatRoundParticipantStep(input.state.currentStep)) {
    return input.state;
  }

  const participantIds = getCombatRoundManagerDisplayParticipantIds(input.state);
  const pendingSelection = input.pendingSelection;
  const manualSelection = input.manualSelection;
  const cursorStep = input.state.currentCursor
    ? getCombatRoundStepForCursorStep(input.state.currentCursor.step)
    : undefined;
  const cursorSelection: CombatRoundSelectionTarget | undefined =
    input.state.currentCursor &&
    input.state.currentCursor.roundNumber === input.state.roundNumber &&
    isGlobalCombatRoundCursorStep(input.state.currentCursor.step) &&
    cursorStep === input.state.currentStep
      ? {
          participantId: input.state.currentCursor.participantId,
          step: cursorStep,
        }
      : undefined;
  let selection: CombatRoundSelectionTarget;

  if (
    cursorSelection &&
    isValidSelection({
      participantIds,
      selection: cursorSelection,
      step: input.state.currentStep,
    })
  ) {
    selection = cursorSelection;
  } else if (
    pendingSelection &&
    isValidSelection({
      participantIds,
      selection: pendingSelection,
      step: input.state.currentStep,
    })
  ) {
    selection = pendingSelection;
  } else if (
    manualSelection &&
    isValidSelection({
      participantIds,
      selection: manualSelection,
      step: input.state.currentStep,
    })
  ) {
    selection = manualSelection;
  } else {
    selection = {
      participantId: participantIds[0],
      step: input.state.currentStep,
    };
  }

  return applyCombatRoundSelectionTarget({
    selection,
    state: input.state,
  });
}
