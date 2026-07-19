import {
  combatRoundStateSchema,
  getCombatRoundStepForCursorStep,
  sortCombatRoundParticipantsByInitiative,
  type CombatRoundCommandCurrentTask,
  type CombatRoundState,
} from "../combatRoundManager";
import {
  boundaryForCursorStep,
  boundaryForStep,
  deepFreeze,
  type ProjectionBuildContext,
} from "./internal";
import {
  buildDeclarationProcesses,
  buildInitiativeProcess,
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
  if (!phase) return undefined;

  return {
    participantIds: sortCombatRoundParticipantsByInitiative({ phase, state }).map(
      (participant) => participant.participantId,
    ),
    phase,
  };
}

/**
 * Pure read model for the current combat progression. It neither advances nor repairs state.
 * The runtime freeze is intentional: callers cannot turn projected work into a second state store.
 */
export function buildCombatProgressionProjection(
  state: CombatRoundState,
): CombatProgressionProjection {
  const normalized = combatRoundStateSchema.parse(state);
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
    blockers: new Map(),
    boundaryId,
    boundaryKind,
    diagnostics: [],
    identities,
    roundNumber: normalized.roundNumber,
    state: normalized,
  };
  let processes: CombatProgressionProcess[];
  if (boundaryKind === "declaration") processes = buildDeclarationProcesses(context);
  else if (boundaryKind === "phase1_modifier_review")
    processes = [buildModifierReviewProcess(context, "phase1")];
  else if (boundaryKind === "phase2_modifier_review")
    processes = [buildModifierReviewProcess(context, "phase2")];
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
