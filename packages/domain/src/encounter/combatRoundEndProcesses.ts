import {
  combatRoundStateSchema,
  getPendingCombatObservationAttempts,
  getCombatRoundEndDistanceProposalLifecycle,
  sortCombatRoundParticipantsByInitiative,
  type CombatRoundCommandType,
  type CombatRoundState,
} from "./combatRoundManager";

export type CombatRoundEndProcessKind =
  | "continued_contact_maintenance"
  | "distance"
  | "effect_review"
  | "health_review"
  | "observation"
  | "participant_review"
  | "round_end";

export type CombatRoundEndProcessStageKind =
  | "boundary"
  | "contest"
  | "effect"
  | "health"
  | "participant"
  | "proposal_commit"
  | "review"
  | "roll";

export type CombatRoundEndProcessTaskKind =
  | "continued_contact_maintenance_roll"
  | "distance_commit"
  | "distance_roll"
  | "effect_review"
  | "gm_advance_boundary"
  | "health_review"
  | "observation_roll"
  | "round_end_prepare";

export interface CombatRoundEndProcessTaskPlan {
  readonly allowedActors?: readonly ("combatant" | "gm")[];
  readonly expectedCommand: CombatRoundCommandType;
  readonly healthRollId?: string;
  readonly continuedContactId?: string;
  readonly contestId?: string;
  readonly key: string;
  readonly kind: CombatRoundEndProcessTaskKind;
  readonly opponentParticipantId?: string;
  readonly observationAttemptId?: string;
  readonly ownerParticipantId?: string;
  readonly ownerRole: "gm" | "participant";
  readonly pairId?: string;
  readonly proposalId?: string;
  readonly relationshipId?: string;
  readonly trackerParticipantId?: string;
}

export interface CombatRoundEndProcessStagePlan {
  readonly executionStrategy: "gm_review" | "ordered_all" | "parallel_all" | "single_task";
  readonly groupTasksTogether?: boolean;
  readonly id: string;
  readonly key?: string;
  readonly kind: CombatRoundEndProcessStageKind;
  readonly state: "active" | "complete" | "pending";
  readonly tasks: readonly CombatRoundEndProcessTaskPlan[];
}

export interface CombatRoundEndChildProcessPlan {
  readonly id: string;
  readonly key?: string;
  readonly kind: CombatRoundEndProcessKind;
  readonly stages: readonly CombatRoundEndProcessStagePlan[];
}

export interface CombatRoundEndProcessPlan {
  readonly activeParticipantId?: string;
  readonly complete: boolean;
  readonly id: string;
  readonly processes: readonly CombatRoundEndChildProcessPlan[];
  readonly roundNumber: number;
}

export interface OrderedParticipantIterationEntry {
  readonly participantId: string;
  readonly state: "active" | "complete" | "pending";
}

/** Pure ordered-iteration primitive shared by processes that visit each combat participant once. */
export function buildOrderedParticipantIteration(input: {
  readonly completedParticipantIds: ReadonlySet<string>;
  readonly participantIds: readonly string[];
  readonly preferredParticipantId?: string;
}): readonly OrderedParticipantIterationEntry[] {
  const preferredIsPending =
    input.preferredParticipantId !== undefined &&
    input.participantIds.includes(input.preferredParticipantId) &&
    !input.completedParticipantIds.has(input.preferredParticipantId);
  const activeParticipantId = preferredIsPending
    ? input.preferredParticipantId
    : input.participantIds.find(
        (participantId) => !input.completedParticipantIds.has(participantId),
      );

  return input.participantIds.map((participantId) => ({
    participantId,
    state: input.completedParticipantIds.has(participantId)
      ? "complete"
      : participantId === activeParticipantId
        ? "active"
        : "pending",
  }));
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  return value;
}

function processId(roundNumber: number, kind: CombatRoundEndProcessKind, key?: string): string {
  return `round:${roundNumber}:round-end-process:${kind}${key ? `:${key}` : ""}`;
}

function stage(input: {
  executionStrategy: CombatRoundEndProcessStagePlan["executionStrategy"];
  groupTasksTogether?: boolean;
  key?: string;
  kind: CombatRoundEndProcessStageKind;
  processId: string;
  state: CombatRoundEndProcessStagePlan["state"];
  tasks?: readonly CombatRoundEndProcessTaskPlan[];
}): CombatRoundEndProcessStagePlan {
  return {
    executionStrategy: input.executionStrategy,
    groupTasksTogether: input.groupTasksTogether,
    id: `${input.processId}:stage:${input.kind}${input.key ? `:${input.key}` : ""}`,
    key: input.key,
    kind: input.kind,
    state: input.state,
    tasks: input.tasks ?? [],
  };
}

/**
 * Builds Round End's complete child-process graph once from persisted facts. The plan describes
 * sequencing only; existing commands remain the sole writers of distance, Health, and effects.
 */
export function buildCombatRoundEndProcessPlan(state: CombatRoundState): CombatRoundEndProcessPlan {
  const normalized = combatRoundStateSchema.parse(state);
  const roundNumber = normalized.roundNumber;
  const review = normalized.roundEndReview;
  const validReview = review?.roundNumber === roundNumber ? review : undefined;
  const distanceProcessId = processId(roundNumber, "distance");

  if (!validReview) {
    return freeze({
      complete: false,
      id: `round:${roundNumber}:round-end-plan`,
      processes: [
        {
          id: distanceProcessId,
          kind: "distance",
          stages: [
            stage({
              executionStrategy: "gm_review",
              kind: "review",
              processId: distanceProcessId,
              state: "active",
              tasks: [
                {
                  allowedActors: ["gm"],
                  expectedCommand: "prepare_round_end_review",
                  key: `round:${roundNumber}`,
                  kind: "round_end_prepare",
                  ownerRole: "gm",
                },
              ],
            }),
          ],
        },
      ],
      roundNumber,
    });
  }

  const maintenanceProcesses: CombatRoundEndChildProcessPlan[] =
    validReview.continuedContactMaintenanceContests.map((contest) => {
      const maintenanceProcessId = processId(
        roundNumber,
        "continued_contact_maintenance",
        contest.id,
      );
      const tasks: CombatRoundEndProcessTaskPlan[] =
        contest.status !== "awaiting_rolls"
          ? []
          : [
              ...(contest.controllerRollRecorded
                ? []
                : [
                    {
                      allowedActors: contest.reviewRequiredReason ? [] : undefined,
                      continuedContactId: contest.continuedContactId,
                      contestId: contest.id,
                      expectedCommand: "roll_continued_contact_maintenance" as const,
                      key: `${contest.id}:${contest.controllerParticipantId}`,
                      kind: "continued_contact_maintenance_roll" as const,
                      opponentParticipantId: contest.affectedParticipantId,
                      ownerParticipantId: contest.controllerParticipantId,
                      ownerRole: "participant" as const,
                      trackerParticipantId: contest.controllerParticipantId,
                    },
                  ]),
              ...(contest.affectedRollRecorded
                ? []
                : [
                    {
                      allowedActors: contest.reviewRequiredReason ? [] : undefined,
                      continuedContactId: contest.continuedContactId,
                      contestId: contest.id,
                      expectedCommand: "roll_continued_contact_maintenance" as const,
                      key: `${contest.id}:${contest.affectedParticipantId}`,
                      kind: "continued_contact_maintenance_roll" as const,
                      opponentParticipantId: contest.controllerParticipantId,
                      ownerParticipantId: contest.affectedParticipantId,
                      ownerRole: "participant" as const,
                      trackerParticipantId: contest.affectedParticipantId,
                    },
                  ]),
            ];
      return {
        id: maintenanceProcessId,
        key: contest.id,
        kind: "continued_contact_maintenance",
        stages: [
          stage({
            executionStrategy: "parallel_all",
            groupTasksTogether: true,
            kind: "contest",
            processId: maintenanceProcessId,
            state: tasks.length > 0 ? "active" : "complete",
            tasks,
          }),
        ],
      };
    });
  const maintenancePending = maintenanceProcesses.some((process) =>
    process.stages.some((maintenanceStage) => maintenanceStage.state !== "complete"),
  );

  const distanceRollTasks: CombatRoundEndProcessTaskPlan[] = maintenancePending
    ? []
    : validReview.proposedDistances.flatMap((proposal) => {
        if (
          !proposal.accepted ||
          getCombatRoundEndDistanceProposalLifecycle(proposal) !== "pending_rolls"
        ) {
          return [];
        }
        return [
          ...(proposal.participantA.status === "pending"
            ? [
                {
                  expectedCommand: "roll_round_end_distance_control" as const,
                  key: `${proposal.id}:${proposal.participantAId}`,
                  kind: "distance_roll" as const,
                  opponentParticipantId: proposal.participantBId,
                  ownerParticipantId: proposal.participantAId,
                  ownerRole: "participant" as const,
                  pairId: proposal.pairKey,
                  proposalId: proposal.id,
                  trackerParticipantId: proposal.participantAId,
                },
              ]
            : []),
          ...(proposal.participantB.status === "pending"
            ? [
                {
                  expectedCommand: "roll_round_end_distance_control" as const,
                  key: `${proposal.id}:${proposal.participantBId}`,
                  kind: "distance_roll" as const,
                  opponentParticipantId: proposal.participantAId,
                  ownerParticipantId: proposal.participantBId,
                  ownerRole: "participant" as const,
                  pairId: proposal.pairKey,
                  proposalId: proposal.id,
                  trackerParticipantId: proposal.participantBId,
                },
              ]
            : []),
        ];
      });
  const distanceCommit = maintenancePending
    ? undefined
    : validReview.proposedDistances.find(
        (proposal) =>
          proposal.accepted && getCombatRoundEndDistanceProposalLifecycle(proposal) === "resolved",
      );
  const distancePending =
    maintenancePending || distanceRollTasks.length > 0 || distanceCommit !== undefined;
  const distanceProcess: CombatRoundEndChildProcessPlan = {
    id: distanceProcessId,
    kind: "distance",
    stages: [
      stage({
        executionStrategy: "parallel_all",
        kind: "roll",
        processId: distanceProcessId,
        state: maintenancePending
          ? "pending"
          : distanceRollTasks.length > 0
            ? "active"
            : "complete",
        tasks: distanceRollTasks,
      }),
      stage({
        executionStrategy:
          distanceCommit?.controlMode === "continued_contact" ? "single_task" : "gm_review",
        kind: "proposal_commit",
        processId: distanceProcessId,
        state:
          maintenancePending || distanceRollTasks.length > 0
            ? "pending"
            : distanceCommit
              ? "active"
              : "complete",
        tasks:
          distanceRollTasks.length === 0 && distanceCommit
            ? [
                {
                  allowedActors:
                    distanceCommit.controlMode === "continued_contact"
                      ? (["combatant", "gm"] as const)
                      : (["gm"] as const),
                  expectedCommand: "commit_round_end_distance_control",
                  key: distanceCommit.id,
                  kind: "distance_commit",
                  opponentParticipantId:
                    distanceCommit.controlMode === "continued_contact"
                      ? distanceCommit.affectedParticipantId
                      : undefined,
                  ownerParticipantId:
                    distanceCommit.controlMode === "continued_contact"
                      ? distanceCommit.controllerParticipantId
                      : undefined,
                  ownerRole:
                    distanceCommit.controlMode === "continued_contact" ? "participant" : "gm",
                  pairId: distanceCommit.pairKey,
                  proposalId: distanceCommit.id,
                  trackerParticipantId:
                    distanceCommit.controlMode === "continued_contact"
                      ? distanceCommit.controllerParticipantId
                      : undefined,
                },
              ]
            : [],
      }),
    ],
  };

  const participantIds = sortCombatRoundParticipantsByInitiative({
    phase: "phase2",
    state: normalized,
  }).map((participant) => participant.participantId);
  const pendingObservationAttempts = getPendingCombatObservationAttempts(normalized);
  const completedParticipantIds = new Set(
    participantIds.filter(
      (participantId) =>
        validReview.participantReviews[participantId]?.status === "complete" &&
        !pendingObservationAttempts.some(
          (attempt) => attempt.observerParticipantId === participantId,
        ),
    ),
  );
  const iteration = buildOrderedParticipantIteration({
    completedParticipantIds,
    participantIds,
  });
  const activeParticipantId = distancePending
    ? undefined
    : iteration.find((entry) => entry.state === "active")?.participantId;
  const participantProcessId = processId(roundNumber, "participant_review");
  const participantProcess: CombatRoundEndChildProcessPlan = {
    id: participantProcessId,
    kind: "participant_review",
    stages: iteration.map((entry) =>
      stage({
        executionStrategy: "ordered_all",
        key: entry.participantId,
        kind: "participant",
        processId: participantProcessId,
        state:
          distancePending ||
          (entry.state === "active" && entry.participantId !== activeParticipantId)
            ? "pending"
            : entry.state,
      }),
    ),
  };

  const processes: CombatRoundEndChildProcessPlan[] = [
    ...maintenanceProcesses,
    distanceProcess,
    participantProcess,
  ];
  if (activeParticipantId) {
    const participantReview = validReview.participantReviews[activeParticipantId];
    const healthProcessId = processId(roundNumber, "health_review", activeParticipantId);
    const healthTasks: CombatRoundEndProcessTaskPlan[] = (
      participantReview?.proposedHealthRolls ?? []
    )
      .filter((proposal) => proposal.accepted && proposal.status === "pending")
      .map((proposal) => ({
        expectedCommand: "roll_round_end_health_check",
        healthRollId: proposal.id,
        key: proposal.id,
        kind: "health_review",
        ownerParticipantId: activeParticipantId,
        ownerRole: "participant",
        proposalId: proposal.id,
        trackerParticipantId: activeParticipantId,
      }));
    processes.push({
      id: healthProcessId,
      key: activeParticipantId,
      kind: "health_review",
      stages: [
        stage({
          executionStrategy: "parallel_all",
          kind: "health",
          processId: healthProcessId,
          state: healthTasks.length > 0 ? "active" : "complete",
          tasks: healthTasks,
        }),
      ],
    });

    const effectProcessId = processId(roundNumber, "effect_review", activeParticipantId);
    const readyForEffectReview =
      healthTasks.length === 0 && participantReview?.status === "review_ready";
    processes.push({
      id: effectProcessId,
      key: activeParticipantId,
      kind: "effect_review",
      stages: [
        stage({
          executionStrategy: "gm_review",
          kind: "effect",
          processId: effectProcessId,
          state: readyForEffectReview ? "active" : "pending",
          tasks: readyForEffectReview
            ? [
                {
                  allowedActors: ["gm"],
                  expectedCommand: "commit_round_end_participant_review",
                  key: activeParticipantId,
                  kind: "effect_review",
                  ownerParticipantId: activeParticipantId,
                  ownerRole: "gm",
                  trackerParticipantId: activeParticipantId,
                },
              ]
            : [],
        }),
      ],
    });
  }

  const participantReviewsComplete =
    !distancePending && completedParticipantIds.size === participantIds.length;
  const observationProcessId = processId(roundNumber, "observation");
  const observationTasks = !distancePending && activeParticipantId
    ? pendingObservationAttempts
        .filter((attempt) => attempt.observerParticipantId === activeParticipantId)
        .map((attempt) => ({
        expectedCommand: "roll_observation" as const,
        key: attempt.attemptId,
        kind: "observation_roll" as const,
        observationAttemptId: attempt.attemptId,
        opponentParticipantId: attempt.targetParticipantId,
        ownerParticipantId: attempt.observerParticipantId,
        ownerRole: "participant" as const,
        relationshipId: attempt.relationshipId,
        trackerParticipantId: attempt.observerParticipantId,
      }))
    : [];
  processes.push({
    id: observationProcessId,
    kind: "observation",
    stages: [
      stage({
        executionStrategy: "ordered_all",
        kind: "contest",
        processId: observationProcessId,
        state:
          observationTasks.length > 0
            ? "active"
            : participantReviewsComplete
              ? "complete"
              : "pending",
        tasks: observationTasks,
      }),
    ],
  });

  const complete = participantReviewsComplete && observationTasks.length === 0;
  const boundaryProcessId = processId(roundNumber, "round_end");
  processes.push({
    id: boundaryProcessId,
    kind: "round_end",
    stages: [
      stage({
        executionStrategy: "gm_review",
        kind: "boundary",
        processId: boundaryProcessId,
        state: complete ? "active" : "pending",
        tasks: complete
          ? [
              {
                allowedActors: ["gm"],
                expectedCommand: "complete_round",
                key: `round:${roundNumber}`,
                kind: "gm_advance_boundary",
                ownerRole: "gm",
              },
            ]
          : [],
      }),
    ],
  });

  return freeze({
    activeParticipantId,
    complete,
    id: `round:${roundNumber}:round-end-plan`,
    processes,
    roundNumber,
  });
}
