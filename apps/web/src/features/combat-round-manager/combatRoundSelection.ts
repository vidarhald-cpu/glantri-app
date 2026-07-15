import type { CombatRoundState, CombatRoundStep } from "@glantri/domain";
import {
  getCombatRoundStepForCursorStep,
  isGlobalCombatRoundCursorStep,
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

/**
 * GM declaration editing stays open for every participant while the active round is still in
 * DE. Recording one declaration advances the row cursor for data-entry convenience, but does not
 * advance canonical combat progression beyond select_actions. Other steps remain bound to the
 * exact current task cursor.
 */
export function isSelectedCombatRoundStepCurrentForGm(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): boolean {
  if (
    input.step === "select_actions" &&
    input.state.currentStep === "select_actions" &&
    input.participantId &&
    input.state.participants.some(
      (participant) => participant.participantId === input.participantId,
    )
  ) {
    return true;
  }

  return isSelectedCombatRoundStepExecutable(input);
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

function getInitiativeSortPhase(state: CombatRoundState): "phase1" | "phase2" | undefined {
  const phase2Complete = state.participants.every(
    (participant) => participant.initiatives.phase2 !== undefined,
  );

  if (phase2Complete) {
    return "phase2";
  }

  const phase1Complete = state.participants.every(
    (participant) => participant.initiatives.phase1 !== undefined,
  );

  return phase1Complete ? "phase1" : undefined;
}

export function getCombatRoundManagerDisplayParticipantIds(
  state: CombatRoundState,
): string[] {
  const phase = getInitiativeSortPhase(state);

  if (!phase) {
    return state.participants.map((participant) => participant.participantId);
  }

  return sortCombatRoundParticipantsByInitiative({ phase, state }).map(
    (participant) => participant.participantId,
  );
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

function isValidSelection(input: {
  participantIds: string[];
  selection?: CombatRoundSelectionTarget;
  step?: CombatRoundStep;
}): boolean {
  return Boolean(
    input.selection?.participantId &&
      (input.step === undefined || input.selection.step === input.step) &&
      input.participantIds.includes(input.selection.participantId),
  );
}

export function getCombatRoundManagerInspectionSelection(input: {
  manualSelection?: CombatRoundSelectionTarget;
  pendingSelection?: CombatRoundSelectionTarget;
  state: CombatRoundState;
}): CombatRoundSelectionTarget | undefined {
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

  if (
    isValidSelection({
      participantIds,
      selection: pendingSelection,
      step: input.state.currentStep,
    })
  ) {
    return pendingSelection;
  }

  if (
    isValidSelection({
      participantIds,
      selection: manualSelection,
    })
  ) {
    return manualSelection;
  }

  if (
    isGlobalCombatRoundParticipantStep(input.state.currentStep) &&
    isValidSelection({
      participantIds,
      selection: cursorSelection,
      step: input.state.currentStep,
    })
  ) {
    return cursorSelection;
  }

  const currentTask = getCurrentCombatRoundTaskSelection(input.state);

  if (
    isValidSelection({
      participantIds,
      selection: currentTask,
    })
  ) {
    return currentTask;
  }

  if (isGlobalCombatRoundParticipantStep(input.state.currentStep) && participantIds[0]) {
    return {
      participantId: participantIds[0],
      step: input.state.currentStep,
    };
  }

  if (input.state.participants[0]) {
    return {
      participantId: input.state.participants[0].participantId,
      step: input.state.currentStep,
    };
  }

  return undefined;
}
