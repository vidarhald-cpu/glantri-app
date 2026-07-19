import {
  getCombatRoundEndDistanceProposalLifecycle,
  getNextCombatRoundEndTask,
} from "../combatRoundManager";
import {
  GM_IDENTITY,
  boundaryForCursorStep,
  boundaryForStep,
  buildProcess,
  getCombatProgressionBoundaryTarget,
  getCombatProgressionProcessId,
  type ProjectionBuildContext,
  type TaskSpec,
} from "./internal";
import type { CombatProgressionProcess } from "./types";

export function buildRoundEndProcesses(
  context: ProjectionBuildContext,
): CombatProgressionProcess[] {
  const review = context.state.roundEndReview;
  if (!review || review.roundNumber !== context.state.roundNumber) {
    return [
      buildProcess(context, "round_end", [
        {
          kind: "review",
          state: "active",
          strategy: "gm_review",
          tasks: [
            {
              allowedActors: ["gm"],
              expectedCommand: "prepare_round_end_review",
              kind: "participant_review",
              owner: GM_IDENTITY,
              trackerOwner: context.identities.get(
                context.state.currentCursor?.participantId ?? "",
              ),
              trackerStep: "SU",
            },
          ],
        },
      ]),
    ];
  }
  const processes: CombatProgressionProcess[] = [];
  const distanceRolls = review.proposedDistances.flatMap<TaskSpec>((proposal) => {
    if (!proposal.accepted || proposal.status !== "pending_rolls") return [];
    return [
      ...(proposal.participantA.status === "pending"
        ? [
            {
              expectedCommand: "roll_round_end_distance_control" as const,
              key: `${proposal.id}:${proposal.participantAId}`,
              kind: "distance_roll" as const,
              owner: context.identities.get(proposal.participantAId),
              trackerOwner: context.identities.get(proposal.participantAId),
              trackerStep: "SU" as const,
            },
          ]
        : []),
      ...(proposal.participantB.status === "pending"
        ? [
            {
              expectedCommand: "roll_round_end_distance_control" as const,
              key: `${proposal.id}:${proposal.participantBId}`,
              kind: "distance_roll" as const,
              owner: context.identities.get(proposal.participantBId),
              trackerOwner: context.identities.get(proposal.participantBId),
              trackerStep: "SU" as const,
            },
          ]
        : []),
    ];
  });
  const distanceCommit = review.proposedDistances.find(
    (proposal) =>
      proposal.accepted && getCombatRoundEndDistanceProposalLifecycle(proposal) === "resolved",
  );
  if (distanceRolls.length > 0 || distanceCommit) {
    processes.push(
      buildProcess(context, "distance", [
        {
          kind: "roll",
          state: distanceRolls.length > 0 ? "active" : "complete",
          strategy: "parallel_all",
          tasks: distanceRolls,
        },
        {
          kind: "commit",
          state: distanceRolls.length > 0 ? "pending" : "active",
          strategy: "gm_review",
          tasks:
            distanceCommit && distanceRolls.length === 0
              ? [
                  {
                    allowedActors: ["gm"],
                    expectedCommand: "commit_round_end_distance_control",
                    key: distanceCommit.id,
                    kind: "distance_commit",
                    owner: GM_IDENTITY,
                    trackerOwner: context.identities.get(distanceCommit.participantAId),
                    trackerStep: "SU",
                  },
                ]
              : [],
        },
      ]),
    );
    return processes;
  }
  const nextTask = getNextCombatRoundEndTask({ state: context.state });
  if (nextTask?.kind === "participant_review") {
    const owner = context.identities.get(nextTask.participantId);
    const participantReview = review.participantReviews[nextTask.participantId];
    const healthTasks: TaskSpec[] = (participantReview?.proposedHealthRolls ?? [])
      .filter((proposal) => proposal.accepted && proposal.status === "pending")
      .map((proposal) => ({
        expectedCommand: "roll_round_end_health_check",
        key: proposal.id,
        kind: "health_review",
        owner,
        trackerOwner: owner,
        trackerStep: "SU",
      }));
    if (healthTasks.length > 0)
      processes.push(
        buildProcess(context, "health_review", [
          { kind: "health", state: "active", strategy: "ordered_all", tasks: healthTasks },
        ]),
      );
    processes.push(
      buildProcess(context, "participant_review", [
        {
          kind: "participant",
          state: healthTasks.length > 0 ? "pending" : "active",
          strategy: "gm_review",
          tasks: [
            {
              allowedActors: ["gm"],
              dependencies:
                healthTasks.length > 0
                  ? [
                      {
                        message: "Accepted Health checks must be resolved first.",
                        owner,
                        type: "participant_input_pending",
                      },
                    ]
                  : undefined,
              expectedCommand: "commit_round_end_participant_review",
              kind: "participant_review",
              owner,
              trackerOwner: owner,
              trackerStep: "SU",
            },
          ],
        },
      ]),
    );
    return processes;
  }
  return [
    buildProcess(context, "round_end", [
      {
        kind: "boundary",
        state: "active",
        strategy: "gm_review",
        tasks: [
          {
            allowedActors: ["gm"],
            expectedCommand: "complete_round",
            kind: "gm_advance_boundary",
            owner: GM_IDENTITY,
            trackerStep: "SU",
            transition: {
              currentBoundary: context.boundaryKind,
              requiredCompletedProcessIds: [getCombatProgressionProcessId(context, "round_end")],
              targetBoundary: getCombatProgressionBoundaryTarget(context.boundaryKind)!,
            },
          },
        ],
      },
    ]),
  ];
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
      const executable = stage.tasks.filter((task) => task.state === "executable");
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
      for (const task of stage.tasks) {
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
