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

export function getCombatRoundTimelineCellKey(selection: CombatRoundTimelineSelection): string {
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
  const nextCell = cells[
    clampIndex((currentIndex === -1 ? 0 : currentIndex) + input.stepOffset, cells.length)
  ] ?? {
    roundNumber: input.selectedRoundNumber,
    step: input.step,
  };

  return {
    participantId: input.participantId,
    roundNumber: nextCell.roundNumber,
    step: nextCell.step,
  };
}

/**
 * #771 — `Previous step` / `Next step` must land on a step the tracker actually draws a column
 * for, instead of parking the inspector on a column-less state.
 *
 * **The traversal order above is not changed, because it is rule-bound.** #215 ruling 2 puts
 * `pre_declaration` first in every round — the ruling is carried on the step enum itself
 * (`combatRoundStep.ts`) and pinned by this module's own test — so what the navigation *visits*
 * stays exactly as ruled. What changed under #771 R2-2 is which of those steps the tracker
 * *renders*: `pre_declaration` left `VISIBLE_COMBAT_ROUND_TRACKER_STEPS` while remaining in the
 * enum, in the cursor vocabulary and in both tracker builders' cell maps. A single raw step
 * backwards from `select_actions` therefore reaches a step with no cell in the rendered grid. So
 * the repair belongs in what the navigation *skips*, which is this wrapper, and not in the order.
 *
 * **The predicate is "this step has a column on this surface"**, supplied as `visibleSteps` and
 * read by both callers from their own tracker model's `steps` array — the same array the header
 * row and the body cells are rendered from, so it cannot drift from what the user can see.
 *
 * It is deliberately **not** cell `inspectable`, which is a different predicate that only happens
 * to coincide for `PD` on the GM surface today:
 *
 * - *visible but inert* is a legitimate destination. Most steps of the current round are
 *   `pending`, and the GM's whole purpose for this cursor is to move onto a step and watch it.
 *   Skipping non-inspectable cells would make `Next step` jump past the entire rest of the round
 *   to whatever is inspectable, or stall with nowhere to go.
 * - *hidden but inspectable* is live, not hypothetical. The player's `pre_declaration` cell can
 *   be `inspectable` while having no column, so a cell-inspectability guard does not prevent a
 *   column-less landing there. **Corrected mechanism (#783 F2):** this is not completion
 *   evidence. `buildProjectedCombatTrackerModel.ts` derives `inspectable` from
 *   `stageReached && (current || selected || snapshot || participantResultEvents.length > 0)` and
 *   reads no completion evidence at all; and the Combat Experience event does not key to that
 *   cell either — the canonical `roll_combat_experience` command routes its event to `DE`
 *   (`combatRoundManager.ts`) and the legacy mapping to `select_actions`
 *   (`combatStepEvents.ts`). What makes the hidden cell inspectable is the events and snapshots
 *   written with `step: normalized.currentStep` while the round *is* in `pre_declaration`.
 *
 * **Ends of the range are a no-op.** If there is no visible step left in the direction of travel,
 * the caller's current selection is returned unchanged, which is what the underlying clamp already
 * did at the true first and last cell. The controls are not disabled, so pressing one at the end
 * does nothing and the inspector keeps a valid, highlighted selection — never an empty one.
 */
export function getAdjacentVisibleCombatRoundTimelineStepSelection(input: {
  participantId?: string;
  roundNumbers: number[];
  selectedRoundNumber: number;
  step: CombatRoundStep;
  stepOffset: number;
  visibleSteps: readonly CombatRoundStep[];
}): CombatRoundTimelineSelection {
  const origin: CombatRoundTimelineSelection = {
    participantId: input.participantId,
    roundNumber: input.selectedRoundNumber,
    step: input.step,
  };
  const direction = Math.sign(input.stepOffset);
  if (direction === 0 || input.visibleSteps.length === 0) {
    return origin;
  }

  let cursor = origin;
  let landed = origin;
  let remaining = Math.abs(input.stepOffset);
  /*
   * One raw step at a time, counting only the visible landings. The loop terminates because each
   * iteration either advances the underlying cell index by one in a finite list or hits the clamp
   * and breaks, so a run of hidden steps cannot spin and cannot skip forever.
   */
  while (remaining > 0) {
    const next = getAdjacentCombatRoundTimelineStepSelection({
      participantId: input.participantId,
      roundNumbers: input.roundNumbers,
      selectedRoundNumber: cursor.roundNumber,
      step: cursor.step,
      stepOffset: direction,
    });
    if (next.roundNumber === cursor.roundNumber && next.step === cursor.step) {
      break;
    }
    cursor = next;
    if (input.visibleSteps.includes(next.step)) {
      landed = next;
      remaining -= 1;
    }
  }

  return landed;
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
      ?.participants.map((participant) => participant.participantId) ?? input.fallbackParticipantIds
  );
}

/**
 * #783 — the **entry-point** equivalent of the `Previous step` / `Next step` skip above.
 *
 * The navigation wrapper only protects selections that travel through the arrow controls. The
 * inspector's *initial* selection does not: `Start New Round` puts the round in
 * `pre_declaration` (#215 ruling 2, `combatRoundManager.ts` `currentStep: "pre_declaration"`),
 * `isGlobalCombatRoundStep("pre_declaration")` is true, and every producer the GM panel composes
 * — the cursor branch, the current-task selection and the `state.currentStep` fallback — therefore
 * reports `pre_declaration`. Since #771 R2-2 removed `PD` from the rendered column set, that
 * selection matches no cell: zero highlighted cells, every cell disabled, and a heading that
 * cannot name the step it is on. Round 1 is unaffected because it never visits `pre_declaration`
 * (its Combat Experience roll belongs to `select_actions`), so the defect starts at round 2 — and
 * it is not a flash, because the round *stays* in `pre_declaration` until every due Combat
 * Experience obligation is discharged.
 *
 * Because all three producers agree, the repair is not in any one of them; it is one normalization
 * applied to whatever they produce. **The predicate is the same one #781 chose — rendered-column
 * membership** (`visibleSteps`), not cell `inspectable`, for the reasons recorded on
 * `getAdjacentVisibleCombatRoundTimelineStepSelection` above.
 *
 * **Forward first, then backward.** `COMBAT_ROUND_STEPS` is the ruled round order, so the next
 * visible step after `pre_declaration` is `select_actions` — which is exactly where the player's
 * progression projection already routes `PD` (`combatProgressionProjection/declaration.ts`: "the
 * tracker reads **DE** while `currentStep` is `pre_declaration`"). The two surfaces therefore open
 * on the same column, which is what "the tracker for the player and GM must have the same
 * structure" requires. The backward fallback exists only so a hidden *last* step could never
 * produce a column-less selection; no step is hidden there today.
 *
 * **This does not restore the `PD` column and does not reinterpret any rule.** It changes only
 * which rendered column the inspector opens on while the round sits in a step that has no column.
 * If `pre_declaration` were ever returned to `VISIBLE_COMBAT_ROUND_TRACKER_STEPS`, this helper
 * becomes an identity for it automatically, exactly as #781's wrapper does.
 */
export function getVisibleCombatRoundTimelineStep(input: {
  step: CombatRoundStep;
  visibleSteps: readonly CombatRoundStep[];
}): CombatRoundStep {
  if (input.visibleSteps.includes(input.step)) {
    return input.step;
  }

  const stepIndex = COMBAT_ROUND_STEPS.indexOf(input.step);
  if (stepIndex === -1) {
    return input.step;
  }

  for (let index = stepIndex + 1; index < COMBAT_ROUND_STEPS.length; index += 1) {
    const candidate = COMBAT_ROUND_STEPS[index];
    if (candidate && input.visibleSteps.includes(candidate)) {
      return candidate;
    }
  }

  for (let index = stepIndex - 1; index >= 0; index -= 1) {
    const candidate = COMBAT_ROUND_STEPS[index];
    if (candidate && input.visibleSteps.includes(candidate)) {
      return candidate;
    }
  }

  return input.step;
}

/**
 * #783 — the one place the GM inspector's resolved selection is pinned to a rendered column.
 *
 * Kept next to the step helper and the navigation wrapper so the entry point and the arrow
 * controls cannot drift apart on which predicate they use.
 */
export function getVisibleCombatRoundTimelineSelection<
  TSelection extends { participantId?: string; step: CombatRoundStep },
>(input: { selection: TSelection; visibleSteps: readonly CombatRoundStep[] }): TSelection {
  const step = getVisibleCombatRoundTimelineStep({
    step: input.selection.step,
    visibleSteps: input.visibleSteps,
  });

  return step === input.selection.step ? input.selection : { ...input.selection, step };
}
