import {
  combatRoundStateSchema,
  getCombatRoundEndDistanceProposalLifecycle,
  type CombatRoundCommandType,
  type CombatRoundState,
} from "./combatRoundManager";

export type CombatRoundEndProcessKind =
  | "distance"
  | "effect_review"
  | "health_review"
  | "participant_review"
  | "round_end";

export type CombatRoundEndProcessStageKind =
  | "boundary"
  | "effect"
  | "health"
  | "participant"
  | "proposal_commit"
  | "review"
  | "roll";

export type CombatRoundEndProcessTaskKind =
  | "distance_commit"
  | "distance_roll"
  | "effect_review"
  | "gm_advance_boundary"
  | "health_review"
  | "round_end_prepare";

export interface CombatRoundEndProcessTaskPlan {
  readonly allowedActors?: readonly ("combatant" | "gm")[];
  readonly expectedCommand: CombatRoundCommandType;
  readonly healthRollId?: string;
  readonly key: string;
  readonly kind: CombatRoundEndProcessTaskKind;
  readonly opponentParticipantId?: string;
  readonly ownerParticipantId?: string;
  readonly ownerRole: "gm" | "participant";
  readonly pairId?: string;
  readonly proposalId?: string;
  readonly trackerParticipantId?: string;
}

export interface CombatRoundEndProcessStagePlan {
  readonly executionStrategy: "gm_review" | "ordered_all" | "parallel_all" | "single_task";
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
  key?: string;
  kind: CombatRoundEndProcessStageKind;
  processId: string;
  state: CombatRoundEndProcessStagePlan["state"];
  tasks?: readonly CombatRoundEndProcessTaskPlan[];
}): CombatRoundEndProcessStagePlan {
  return {
    executionStrategy: input.executionStrategy,
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
                  trackerParticipantId: normalized.currentCursor?.participantId,
                },
              ],
            }),
          ],
        },
      ],
      roundNumber,
    });
  }

  const distanceRollTasks: CombatRoundEndProcessTaskPlan[] = validReview.proposedDistances.flatMap(
    (proposal) => {
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
    },
  );
  const distanceCommit = validReview.proposedDistances.find(
    (proposal) =>
      proposal.accepted && getCombatRoundEndDistanceProposalLifecycle(proposal) === "resolved",
  );
  const distancePending = distanceRollTasks.length > 0 || distanceCommit !== undefined;
  const distanceProcess: CombatRoundEndChildProcessPlan = {
    id: distanceProcessId,
    kind: "distance",
    stages: [
      stage({
        executionStrategy: "parallel_all",
        kind: "roll",
        processId: distanceProcessId,
        state: distanceRollTasks.length > 0 ? "active" : "complete",
        tasks: distanceRollTasks,
      }),
      stage({
        executionStrategy: "gm_review",
        kind: "proposal_commit",
        processId: distanceProcessId,
        state: distanceRollTasks.length > 0 ? "pending" : distanceCommit ? "active" : "complete",
        tasks:
          distanceRollTasks.length === 0 && distanceCommit
            ? [
                {
                  allowedActors: ["gm"],
                  expectedCommand: "commit_round_end_distance_control",
                  key: distanceCommit.id,
                  kind: "distance_commit",
                  ownerRole: "gm",
                  pairId: distanceCommit.pairKey,
                  proposalId: distanceCommit.id,
                  trackerParticipantId: distanceCommit.participantAId,
                },
              ]
            : [],
      }),
    ],
  };

  const participantIds = normalized.participants.map((participant) => participant.participantId);
  const completedParticipantIds = new Set(
    participantIds.filter(
      (participantId) => validReview.participantReviews[participantId]?.status === "complete",
    ),
  );
  const iteration = buildOrderedParticipantIteration({
    completedParticipantIds,
    participantIds,
    preferredParticipantId:
      normalized.currentCursor?.step === "SU" && normalized.currentCursor.participantId
        ? normalized.currentCursor.participantId
        : undefined,
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

  const processes: CombatRoundEndChildProcessPlan[] = [distanceProcess, participantProcess];
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

  const complete = !distancePending && completedParticipantIds.size === participantIds.length;
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
