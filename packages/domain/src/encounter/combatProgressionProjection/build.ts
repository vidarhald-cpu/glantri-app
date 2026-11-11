import {
  parseCombatRoundState,
  getCombatRoundCurrentInitiativeExecutionGroup,
  getCombatRoundInitiativeExecutionGroups,
  getCombatRoundStepForCursorStep,
  sortCombatRoundParticipantsByInitiative,
  type CombatRoundCommandCurrentTask,
  type CombatRoundState,
} from "../combatRoundManager";
import { buildCombatActionProcessPlans } from "../combatActionProcesses";
import type { CombatParticipationProjection } from "../combatParticipation";
import { validateCombatDeclarationCompatibility } from "../combatDeclarationCompatibility";
import {
  boundaryForCursorStep,
  boundaryForStep,
  deepFreeze,
  type ProjectionBuildContext,
} from "./internal";
import {
  buildDeclarationProcesses,
  buildInitiativeProcess,
  buildModifierReviewProcesses,
  buildModifierReviewProcess,
} from "./declaration";
import { buildResolutionProcesses } from "./resolution";
import { addDiagnostics, buildRoundEndProcesses } from "./roundEnd";
import type {
  CombatantIdentity,
  CombatProgressionBoundaryKind,
  CombatProgressionExecutionOrder,
  CombatProgressionProcess,
  CombatProgressionProjection,
} from "./types";

/**
 * The order the tracker renders, and the derived initiative groups beside it.
 *
 * Forgejo issue #875 (Product Owner ruling of 2026-11-03): `participantIds` is **read from the
 * record the GM's initiative commit wrote**, not recomputed. Only a commit appends a record, so
 * advancing a phase, completing a resolution or withdrawing an action cannot re-sort the rows, and
 * a round standing before its own first commit renders the previous commit's order. Participants
 * no longer in the round are dropped; participants the record does not name — those who joined
 * after the last commit — are not added here, and the trackers place them after the recorded order.
 *
 * `initiativeGroups` and the current group beside them stay **derived from current state**. They
 * are the value that decides whether an effect is deferred or in force (#884), which the ruling
 * keeps calculated: "the current state is in other words always calculated, and does not rely on
 * history." Nothing here reads the record to answer anything but "in what order are the rows".
 *
 * With no record — a round state stored before this existed, or a combat before its first commit —
 * the pre-existing derived order is returned unchanged at the boundaries that had one, and no
 * order at the boundaries that had none. No order is fabricated for a commit that never happened.
 */
function committedExecutionOrder(
  state: CombatRoundState,
  boundaryKind: CombatProgressionBoundaryKind,
): CombatProgressionExecutionOrder | undefined {
  const phase =
    boundaryKind === "phase1_resolution" ||
    boundaryKind === "phase2_modifier_review" ||
    boundaryKind === "phase2_initiative"
      ? "phase1"
      : boundaryKind === "phase2_resolution" ||
          boundaryKind === "round_end" ||
          boundaryKind === "round_boundary"
        ? "phase2"
        : undefined;
  const recordedOrder = state.committedInitiativeOrders.at(-1);
  if (!phase && !recordedOrder) return undefined;

  const initiativeGroups = phase ? getCombatRoundInitiativeExecutionGroups({ phase, state }) : [];
  const currentGroup = initiativeGroups.find((group) => group.status === "current");
  const presentParticipantIds = new Set(
    state.participants.map((participant) => participant.participantId),
  );
  const derivedParticipantIds = phase
    ? sortCombatRoundParticipantsByInitiative({ phase, state }).map(
        (participant) => participant.participantId,
      )
    : [];
  return {
    ...(initiativeGroups.length > 0
      ? {
          currentInitiativeGroupId: currentGroup?.id,
          currentInitiativeValue: currentGroup?.initiativeValue,
          initiativeGroups: initiativeGroups.map((group) => ({
            id: group.id,
            initiativeValue: group.initiativeValue,
            opportunityIds: group.opportunityIds,
            participantIds: group.participantIds,
            status: group.status,
          })),
        }
      : {}),
    participantIds: recordedOrder
      ? recordedOrder.entries
          .map((entry) => entry.participantId)
          .filter((participantId) => presentParticipantIds.has(participantId))
      : derivedParticipantIds,
    phase: phase ?? recordedOrder!.phase,
  };
}

/**
 * Pure read model for the current combat progression. It neither advances nor repairs state.
 * The runtime freeze is intentional: callers cannot turn projected work into a second state store.
 */
export function buildCombatProgressionProjection(
  state: CombatRoundState,
  options: { readonly participation?: CombatParticipationProjection } = {},
): CombatProgressionProjection {
  const normalized = parseCombatRoundState(state);
  const cursor = normalized.currentCursor;
  const boundaryKind = cursor
    ? boundaryForCursorStep(cursor.step, Boolean(cursor.participantId))
    : boundaryForStep(normalized.currentStep, normalized);
  const boundaryId = `round:${normalized.roundNumber}:boundary:${boundaryKind}`;
  const identities = new Map<string, CombatantIdentity>();
  for (const participant of normalized.participants) {
    const identity: CombatantIdentity = {
      characterId: participant.characterId,
      kind: "combatant",
      label: participant.label,
      participantId: participant.participantId,
      scenarioParticipantId: participant.scenarioParticipantId,
    };
    identities.set(participant.participantId, identity);
    if (participant.scenarioParticipantId)
      identities.set(participant.scenarioParticipantId, identity);
    if (participant.characterId) identities.set(participant.characterId, identity);
  }
  const context: ProjectionBuildContext = {
    actionProcessPlans:
      boundaryKind === "round_end" || boundaryKind === "round_boundary"
        ? []
        : buildCombatActionProcessPlans(normalized),
    blockers: new Map(),
    boundaryId,
    boundaryKind,
    diagnostics: [],
    identities,
    initiativeGroup:
      boundaryKind === "phase1_resolution"
        ? getCombatRoundCurrentInitiativeExecutionGroup({ phase: "phase1", state: normalized })
        : boundaryKind === "phase2_resolution"
          ? getCombatRoundCurrentInitiativeExecutionGroup({ phase: "phase2", state: normalized })
          : undefined,
    participation: options.participation,
    roundNumber: normalized.roundNumber,
    state: normalized,
  };
  const unavailableDeclaration =
    boundaryKind === "declaration"
      ? undefined
      : normalized.participants
          .map((participant) => {
            const actionId = participant.declaration?.actionId;
            const secondaryActionId = participant.declaration?.secondaryActionId;
            const availability = validateCombatDeclarationCompatibility({
              movementKind: participant.declaration?.movementIntent?.mode,
              primaryAction: actionId,
              secondaryAction: secondaryActionId,
            });
            return availability.valid ? undefined : { availability, participant };
          })
          .find((entry) => entry !== undefined);
  let processes: CombatProgressionProcess[];
  if (unavailableDeclaration) {
    const blockerId = `${boundaryId}:blocker:invalid_source:unavailable-declaration:${unavailableDeclaration.participant.participantId}`;
    context.blockers.set(blockerId, {
      id: blockerId,
      message: unavailableDeclaration.availability.message ?? "Combat action is not yet available.",
      owner: identities.get(unavailableDeclaration.participant.participantId),
      taskIds: [],
      type: "invalid_source",
    });
    context.diagnostics.push({
      code: "repair_required",
      message: "An active legacy declaration cannot enter canonical execution.",
      relatedIds: [blockerId, unavailableDeclaration.participant.participantId],
      severity: "warning",
    });
    processes = [];
  } else if (boundaryKind === "declaration") processes = buildDeclarationProcesses(context);
  else if (boundaryKind === "phase1_modifier_review")
    processes = [buildModifierReviewProcess(context, "phase1")];
  else if (boundaryKind === "phase2_modifier_review")
    processes = buildModifierReviewProcesses(context, "phase2");
  else if (boundaryKind === "phase1_initiative")
    processes = [buildInitiativeProcess(context, "phase1")];
  else if (boundaryKind === "phase2_initiative")
    processes = [buildInitiativeProcess(context, "phase2")];
  else if (boundaryKind === "phase1_resolution")
    processes = buildResolutionProcesses(context, "phase1");
  else if (boundaryKind === "phase2_resolution")
    processes = buildResolutionProcesses(context, "phase2");
  else processes = buildRoundEndProcesses(context);
  addDiagnostics(context, processes);

  const currentTaskEquivalent: CombatRoundCommandCurrentTask | undefined = cursor
    ? {
        cursorStep: cursor.step,
        participantId: cursor.participantId,
        roundNumber: cursor.roundNumber,
        step: getCombatRoundStepForCursorStep(cursor.step),
      }
    : undefined;
  return deepFreeze({
    blockers: [...context.blockers.values()],
    boundary: {
      blockerIds: [...context.blockers.keys()],
      id: boundaryId,
      kind: boundaryKind,
      processes,
      roundNumber: normalized.roundNumber,
    },
    currentCursorEquivalent: cursor ? { ...cursor } : undefined,
    currentTaskEquivalent,
    diagnostics: context.diagnostics,
    executionOrder: committedExecutionOrder(normalized, boundaryKind),
    phaseResolutionCursorEquivalent: normalized.phaseResolutionCursor
      ? { ...normalized.phaseResolutionCursor }
      : undefined,
    roundNumber: normalized.roundNumber,
  });
}
