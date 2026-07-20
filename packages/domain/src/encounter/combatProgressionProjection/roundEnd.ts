import { buildCombatRoundEndProcessPlan } from "../combatRoundEndProcesses";
import {
  GM_IDENTITY,
  boundaryForCursorStep,
  boundaryForStep,
  buildProcess,
  getCombatProgressionBoundaryTarget,
  getCombatProgressionProcessId,
  type ProjectionBuildContext,
} from "./internal";
import type { CombatProgressionProcess } from "./types";

export function buildRoundEndProcesses(
  context: ProjectionBuildContext,
): CombatProgressionProcess[] {
  const plan = buildCombatRoundEndProcessPlan(context.state);
  const requiredCompletedProcessIds = plan.processes
    .filter((process) => process.kind !== "round_end")
    .map((process) => getCombatProgressionProcessId(context, process.kind, process.key));

  return plan.processes.map((process) =>
    buildProcess(
      context,
      process.kind,
      process.stages.map((stage) => ({
        key: stage.key,
        kind: stage.kind,
        state: stage.state,
        strategy: stage.executionStrategy,
        tasks: stage.tasks.map((task) => {
          const participantOwner = task.ownerParticipantId
            ? context.identities.get(task.ownerParticipantId)
            : undefined;
          const distanceProposal = task.proposalId
            ? context.state.roundEndReview?.proposedDistances.find(
                (proposal) => proposal.id === task.proposalId,
              )
            : undefined;
          const participantReview = task.ownerParticipantId
            ? context.state.roundEndReview?.participantReviews[task.ownerParticipantId]
            : undefined;
          const healthProposal = task.healthRollId
            ? participantReview?.proposedHealthRolls.find(
                (proposal) => proposal.id === task.healthRollId,
              )
            : undefined;
          return {
            allowedActors: task.allowedActors,
            expectedCommand: task.expectedCommand,
            identity: {
              healthRollId: task.healthRollId,
              opponentParticipantId: task.opponentParticipantId,
              pairId: task.pairId,
              participantId: task.ownerParticipantId,
              proposalId: task.proposalId,
            },
            key: task.key,
            kind: task.kind,
            owner: task.ownerRole === "gm" ? GM_IDENTITY : participantOwner,
            presentationContext: {
              actionKind: process.kind,
              actor:
                task.ownerRole === "gm" && task.trackerParticipantId
                  ? context.identities.get(task.trackerParticipantId)
                  : participantOwner,
              distance: distanceProposal
                ? {
                    current: distanceProposal.currentDistance,
                    requested: distanceProposal.proposedDistance,
                  }
                : undefined,
              reason: healthProposal?.label,
              responder: task.ownerRole === "participant" ? participantOwner : undefined,
              skill: task.kind === "health_review" ? { label: "Health" } : undefined,
              target: task.opponentParticipantId
                ? context.identities.get(task.opponentParticipantId)
                : undefined,
            },
            trackerOwner: task.trackerParticipantId
              ? context.identities.get(task.trackerParticipantId)
              : undefined,
            trackerStep: "SU" as const,
            transition:
              task.kind === "gm_advance_boundary"
                ? {
                    currentBoundary: context.boundaryKind,
                    requiredCompletedProcessIds,
                    targetBoundary: getCombatProgressionBoundaryTarget(context.boundaryKind)!,
                  }
                : undefined,
          };
        }),
      })),
      { key: process.key, planId: process.id },
    ),
  );
}

export function addDiagnostics(
  context: ProjectionBuildContext,
  processes: readonly CombatProgressionProcess[],
) {
  const cursor = context.state.currentCursor;
  const stepBoundary = boundaryForStep(context.state.currentStep, context.state);
  if (
    cursor &&
    boundaryForCursorStep(cursor.step, Boolean(cursor.participantId)) !== stepBoundary
  ) {
    context.diagnostics.push({
      code: "cursor_disagrees_with_process",
      message: `Cursor ${cursor.step} disagrees with current step ${context.state.currentStep}.`,
      relatedIds: [context.boundaryId],
      severity: "warning",
    });
  }
  if (!cursor || cursor.roundNumber !== context.state.roundNumber) {
    context.diagnostics.push({
      code: "repair_required",
      message: "The active combat cursor is missing or belongs to another round.",
      relatedIds: [context.boundaryId],
      severity: "warning",
    });
  } else if (cursor.participantId && !context.identities.has(cursor.participantId)) {
    context.diagnostics.push({
      code: "repair_required",
      message: "The active combat cursor references a missing combatant.",
      relatedIds: [context.boundaryId],
      severity: "warning",
    });
  }
  for (const process of processes) {
    for (const stage of process.stages) {
      const executable = stage.executionGroups
        .flatMap((group) => group.tasks)
        .filter((task) => task.state === "executable");
      if (
        executable.length > 1 &&
        stage.executionStrategy !== "parallel_all" &&
        stage.executionStrategy !== "initiative_groups"
      ) {
        context.diagnostics.push({
          code: "multiple_executable_tasks",
          message: `Stage ${stage.id} has multiple executable tasks for ${stage.executionStrategy}.`,
          relatedIds: executable.map((task) => task.id),
          severity: "warning",
        });
      }
      for (const task of stage.executionGroups.flatMap((group) => group.tasks)) {
        if (!task.owner)
          context.diagnostics.push({
            code: "missing_owner",
            message: `Task ${task.id} has no owner.`,
            relatedIds: [task.id],
            severity: "warning",
          });
        const blockerTypes = task.blockerIds.map((id) => context.blockers.get(id)?.type);
        if (blockerTypes.includes("proposal_pending"))
          context.diagnostics.push({
            code: "proposal_disagrees_with_task",
            message: `Task ${task.id} expects a proposal that is not present.`,
            relatedIds: [task.id],
            severity: "warning",
          });
        if (
          blockerTypes.includes("invalid_source") ||
          blockerTypes.includes("invalid_target") ||
          blockerTypes.includes("missing_owner")
        )
          context.diagnostics.push({
            code: "repair_required",
            message: `Task ${task.id} cannot be projected from valid source facts.`,
            relatedIds: [task.id],
            severity: "warning",
          });
      }
    }
  }
}
