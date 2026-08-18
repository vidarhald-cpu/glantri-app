import type { CombatRoundState, CombatRoundStep } from "@glantri/domain";
import { COMBAT_ROUND_STEPS } from "@glantri/domain";

export interface CombatRoundTimelineSelection {
  participantId?: string;
  roundNumber: number;
  step: CombatRoundStep;
}

export type CombatRoundTimelineArrowMove = { participantOffset: number } | { stepOffset: number };

/** Shared tracker-local keyboard ownership used by GM, GM Player, and Player surfaces. */
export function getCombatRoundTimelineArrowMove(input: {
  key: string;
  targetIsContentEditable?: boolean;
  targetTagName?: string;
}): CombatRoundTimelineArrowMove | undefined {
  if (
    input.targetIsContentEditable ||
    (input.targetTagName && ["INPUT", "SELECT", "TEXTAREA"].includes(input.targetTagName))
  ) {
    return undefined;
  }
  switch (input.key) {
    case "ArrowRight":
      return { stepOffset: 1 };
    case "ArrowLeft":
      return { stepOffset: -1 };
    case "ArrowDown":
      return { participantOffset: 1 };
    case "ArrowUp":
      return { participantOffset: -1 };
    default:
      return undefined;
  }
}

export function getCombatRoundTimelineCellKey(
  selection: CombatRoundTimelineSelection,
): string {
  return `${selection.roundNumber}:${selection.participantId ?? ""}:${selection.step}`;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

export function getAdjacentCombatRoundTimelineStepSelection(input: {
  participantId?: string;
  roundNumbers: number[];
  selectedRoundNumber: number;
  step: CombatRoundStep;
  stepOffset: number;
}): CombatRoundTimelineSelection {
  const cells = input.roundNumbers.flatMap((roundNumber) =>
    COMBAT_ROUND_STEPS.map((step) => ({
      roundNumber,
      step,
    })),
  );
  const currentIndex = cells.findIndex(
    (cell) => cell.roundNumber === input.selectedRoundNumber && cell.step === input.step,
  );
  const nextCell = cells[clampIndex((currentIndex === -1 ? 0 : currentIndex) + input.stepOffset, cells.length)] ?? {
    roundNumber: input.selectedRoundNumber,
    step: input.step,
  };

  return {
    participantId: input.participantId,
    roundNumber: nextCell.roundNumber,
    step: nextCell.step,
  };
}

export function getAdjacentCombatRoundTimelineParticipantSelection(input: {
  participantId?: string;
  participantIds: string[];
  roundNumber: number;
  step: CombatRoundStep;
  participantOffset: number;
}): CombatRoundTimelineSelection {
  const participantIndex = input.participantIds.indexOf(input.participantId ?? "");
  const nextParticipantId =
    input.participantIds[
      clampIndex(
        (participantIndex === -1 ? 0 : participantIndex) + input.participantOffset,
        input.participantIds.length,
      )
    ] ?? input.participantId;

  return {
    participantId: nextParticipantId,
    roundNumber: input.roundNumber,
    step: input.step,
  };
}

export function getParticipantIdsForTimelineRound(input: {
  fallbackParticipantIds: string[];
  roundNumber: number;
  timelineRoundStates: CombatRoundState[];
}): string[] {
  return (
    input.timelineRoundStates
      .find((round) => round.roundNumber === input.roundNumber)
      ?.participants.map((participant) => participant.participantId) ??
    input.fallbackParticipantIds
  );
}
