import {
  getCombatRoundAdjustDistanceProposal,
  getCombatRoundDamageSubstate,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundAttackResultId,
  getCombatRoundFeintProposal,
  getCombatRoundPhaseAttackCandidates,
  getCombatRoundPhaseResolutionResultForAttack,
  isCombatRoundPhaseResolutionComplete,
  type CombatRoundPhase,
} from "../combatRoundManager";
import {
  GM_IDENTITY,
  buildProcess,
  getCombatProgressionBoundaryTarget,
  getCombatProgressionProcessId,
  trackerStepForPhase,
  type ProjectionBuildContext,
  type StageSpec,
  type TaskDependency,
  type TaskSpec,
} from "./internal";
import type { CombatProgressionProcess, CombatProgressionStageKind } from "./types";

function buildFeintProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
  participantId: string,
): CombatProgressionProcess {
  const proposal = getCombatRoundFeintProposal({
    attackerParticipantId: participantId,
    state: context.state,
  });
  const trackerStep = trackerStepForPhase(phase, "attack");
  const attacker = context.identities.get(participantId);
  const activeStage: CombatProgressionStageKind =
    !proposal ||
    proposal.status === "awaiting_action_turn" ||
    proposal.status === "awaiting_feasibility"
      ? "feasibility"
      : proposal.status === "awaiting_rolls"
        ? "roll"
        : proposal.status === "awaiting_review"
          ? "review"
          : "commit";
  let task: TaskSpec;
  if (!proposal) {
    task = {
      dependencies: [{ message: "The active Feint has no proposal.", type: "proposal_pending" }],
      expectedCommand: "review_feint_feasibility",
      kind: "resolve_feint",
      owner: attacker,
      trackerOwner: attacker,
      trackerStep,
    };
  } else if (proposal.status === "awaiting_rolls") {
    const owner = context.identities.get(
      proposal.attackerRoll ? proposal.defenderParticipantId : proposal.attackerParticipantId,
    );
    task = {
      expectedCommand: "roll_feint",
      kind: "resolve_feint",
      owner,
      trackerOwner: attacker,
      trackerStep,
    };
  } else if (proposal.status === "awaiting_review") {
    task = {
      allowedActors: ["gm"],
      expectedCommand: "commit_feint_result",
      kind: "resolve_feint",
      owner: GM_IDENTITY,
      trackerOwner: attacker,
      trackerStep,
    };
  } else {
    task = {
      allowedActors: ["gm"],
      expectedCommand: "review_feint_feasibility",
      kind: "resolve_feint",
      owner: GM_IDENTITY,
      trackerOwner: attacker,
      trackerStep,
    };
  }
  const order: CombatProgressionStageKind[] = ["feasibility", "roll", "review", "commit"];
  const activeIndex = order.indexOf(activeStage);
  return buildProcess(
    context,
    "feint",
    order.map((kind, index) => ({
      kind,
      state: index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
      strategy:
        kind === "roll"
          ? "ordered_all"
          : kind === "review" || kind === "feasibility"
            ? "gm_review"
            : "single_task",
      tasks: index === activeIndex ? [task] : [],
    })),
  );
}

function buildAdjustDistanceProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
  participantId: string,
): CombatProgressionProcess {
  const proposal = getCombatRoundAdjustDistanceProposal({
    attackerParticipantId: participantId,
    state: context.state,
  });
  const trackerStep = trackerStepForPhase(phase, "attack");
  const attacker = context.identities.get(participantId);
  const activeStage: CombatProgressionStageKind =
    !proposal ||
    proposal.status === "awaiting_action_turn" ||
    proposal.status === "awaiting_defender_response"
      ? "response"
      : proposal.status === "awaiting_gm_adjustment"
        ? "review"
        : proposal.status === "awaiting_rolls"
          ? "roll"
          : "commit";
  let task: TaskSpec;
  if (!proposal) {
    task = {
      dependencies: [
        { message: "The active Adjust Distance action has no proposal.", type: "proposal_pending" },
      ],
      expectedCommand: "respond_adjust_distance",
      kind: "resolve_adjust_distance",
      owner: attacker,
      trackerOwner: attacker,
      trackerStep,
    };
  } else if (proposal.status === "awaiting_defender_response") {
    task = {
      expectedCommand: "respond_adjust_distance",
      kind: "resolve_adjust_distance",
      owner: context.identities.get(proposal.defenderParticipantId),
      trackerOwner: attacker,
      trackerStep,
    };
  } else if (proposal.status === "awaiting_gm_adjustment") {
    task = {
      allowedActors: ["gm"],
      expectedCommand: "review_adjust_distance_roll_adjustment",
      kind: "resolve_adjust_distance",
      owner: GM_IDENTITY,
      trackerOwner: attacker,
      trackerStep,
    };
  } else if (proposal.status === "awaiting_rolls") {
    const owner = context.identities.get(
      proposal.attackerRoll ? proposal.defenderParticipantId : proposal.attackerParticipantId,
    );
    task = {
      expectedCommand: "roll_adjust_distance",
      kind: "resolve_adjust_distance",
      owner,
      trackerOwner: attacker,
      trackerStep,
    };
  } else {
    task = {
      allowedActors: ["gm"],
      expectedCommand: "commit_adjust_distance",
      kind: "resolve_adjust_distance",
      owner: GM_IDENTITY,
      trackerOwner: attacker,
      trackerStep,
    };
  }
  const order: CombatProgressionStageKind[] = ["response", "review", "roll", "commit"];
  const activeIndex = order.indexOf(activeStage);
  return buildProcess(
    context,
    "adjust_distance",
    order.map((kind, index) => ({
      kind,
      state: index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
      strategy:
        kind === "roll"
          ? "ordered_all"
          : kind === "review" || kind === "commit"
            ? "gm_review"
            : "single_task",
      tasks: index === activeIndex ? [task] : [],
    })),
  );
}

function buildAttackProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess {
  const cursor = context.state.currentCursor;
  const phaseCursor = context.state.phaseResolutionCursor;
  const trackerAttack = trackerStepForPhase(phase, "attack");
  const trackerParry = trackerStepForPhase(phase, "parry");
  const trackerDamage = trackerStepForPhase(phase, "damage");
  const substep =
    phaseCursor?.phase === phase
      ? phaseCursor.substep
      : cursor?.step === trackerParry
        ? "parry"
        : cursor?.step === trackerDamage
          ? "damage"
          : "attack";
  const participantId =
    phaseCursor?.phase === phase ? phaseCursor.participantId : cursor?.participantId;
  const facetOwner = participantId ? context.identities.get(participantId) : undefined;
  const stages: StageSpec[] = [
    {
      kind: "attack",
      state: substep === "attack" ? "active" : "complete",
      strategy: "single_task",
    },
    {
      kind: "defense",
      state: substep === "parry" ? "active" : substep === "attack" ? "pending" : "complete",
      strategy: "single_task",
    },
    {
      kind: "damage",
      state:
        substep === "damage"
          ? "active"
          : substep === "attack" || substep === "parry"
            ? "pending"
            : "complete",
      strategy: "single_task",
    },
    {
      kind: "commit",
      state: substep === "effects" || substep === "done" ? "active" : "pending",
      strategy: "gm_review",
    },
  ];

  if (substep === "attack") {
    const owner = participantId ? context.identities.get(participantId) : undefined;
    const candidate = getCombatRoundPhaseAttackCandidates({ phase, state: context.state }).find(
      (entry) => entry.participantId === participantId,
    );
    const dependencies: TaskDependency[] = [];
    if (!candidate)
      dependencies.push({
        message: "The active attack has no declared source.",
        owner,
        type: "invalid_source",
      });
    if (!candidate?.targetParticipantId || !context.identities.has(candidate.targetParticipantId))
      dependencies.push({
        message: "The active attack target is missing or invalid.",
        owner,
        type: "invalid_target",
      });
    stages[0] = {
      ...stages[0],
      tasks: [
        {
          dependencies,
          expectedCommand: "roll_attack",
          identity: { opportunityId: candidate?.id, phase },
          kind: "attack",
          owner,
          trackerOwner: owner,
          trackerStep: trackerAttack,
        },
      ],
    };
  } else if (substep === "parry") {
    const owner = participantId ? context.identities.get(participantId) : undefined;
    const attack = participantId
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId,
          phase,
          state: context.state,
        })
      : undefined;
    stages[1] = {
      ...stages[1],
      tasks: [
        {
          dependencies: attack
            ? undefined
            : [
                {
                  message: "The active parry has no incoming attack.",
                  owner,
                  type: "invalid_source",
                },
              ],
          expectedCommand: "roll_parry",
          identity: {
            attackResultId: attack
              ? getCombatRoundAttackResultId({
                  result: attack,
                  roundNumber: context.state.roundNumber,
                })
              : undefined,
            opportunityId: attack?.attackOpportunityId,
            phase,
          },
          kind: "parry",
          owner,
          trackerOwner: owner,
          trackerStep: trackerParry,
        },
      ],
    };
  } else if (substep === "damage") {
    const attack = participantId
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId,
          phase,
          state: context.state,
        })
      : undefined;
    const resolution = attack
      ? getCombatRoundPhaseResolutionResultForAttack({ attackResult: attack, state: context.state })
      : undefined;
    const damageSubstate = getCombatRoundDamageSubstate(resolution);
    const attacker = attack ? context.identities.get(attack.attackerParticipantId) : undefined;
    const missingSource = attack
      ? undefined
      : [
          {
            message: "The active damage task has no attack result.",
            type: "invalid_source" as const,
          },
        ];
    if (damageSubstate === "location_pending") {
      stages[2] = {
        ...stages[2],
        tasks: [
          {
            dependencies: missingSource,
            expectedCommand: "roll_hit_location",
            kind: "hit_location",
            owner: attacker,
            trackerOwner: facetOwner,
            trackerStep: trackerDamage,
          },
        ],
      };
    } else if (damageSubstate === "critical_pending") {
      stages[2] = {
        ...stages[2],
        tasks: [
          {
            expectedCommand: "roll_critical",
            kind: "critical",
            owner: attacker,
            trackerOwner: facetOwner,
            trackerStep: trackerDamage,
          },
        ],
      };
    } else if (damageSubstate === "location_rolled") {
      stages[2] = {
        ...stages[2],
        tasks: [
          {
            allowedActors: ["gm"],
            expectedCommand: "resolve_damage",
            kind: "damage_review",
            owner: GM_IDENTITY,
            trackerOwner: facetOwner,
            trackerStep: trackerDamage,
          },
        ],
      };
    } else {
      stages[2] = { ...stages[2], state: "complete" };
      stages[3] = {
        ...stages[3],
        state: "active",
        tasks: [
          {
            allowedActors: ["gm"],
            expectedCommand: "commit_phase_damage",
            kind: "damage_review",
            owner: GM_IDENTITY,
            trackerOwner: facetOwner,
            trackerStep: trackerDamage,
          },
        ],
      };
    }
  } else {
    stages[3] = {
      ...stages[3],
      tasks: [
        {
          allowedActors: ["gm"],
          expectedCommand:
            phase === "phase1" ? "complete_damage_review_phase1" : "complete_damage_review_phase2",
          kind: "damage_review",
          owner: GM_IDENTITY,
          trackerOwner: facetOwner,
          trackerStep: trackerDamage,
        },
      ],
    };
  }
  return buildProcess(context, "attack", stages);
}

export function buildResolutionProcesses(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess[] {
  if (isCombatRoundPhaseResolutionComplete({ phase, state: context.state })) {
    const completedProcess = buildProcess(context, "attack", [
      { kind: "attack", state: "complete", strategy: "single_task" },
      { kind: "defense", state: "complete", strategy: "single_task" },
      { kind: "damage", state: "complete", strategy: "single_task" },
      { kind: "commit", state: "complete", strategy: "gm_review" },
    ]);
    const trackerStep = phase === "phase1" ? "A1" : "A2";
    const transitionProcess = buildProcess(context, "boundary_transition", [
      {
        kind: "boundary",
        state: "active",
        strategy: "gm_review",
        tasks: [
          {
            allowedActors: ["gm"],
            expectedCommand: "advance_combat_boundary",
            kind: "gm_advance_boundary",
            owner: GM_IDENTITY,
            trackerStep,
            transition: {
              currentBoundary: context.boundaryKind,
              requiredCompletedProcessIds: [getCombatProgressionProcessId(context, "attack")],
              targetBoundary: getCombatProgressionBoundaryTarget(context.boundaryKind)!,
            },
          },
        ],
      },
    ]);

    return [completedProcess, transitionProcess];
  }
  const participantId =
    context.state.phaseResolutionCursor?.phase === phase
      ? context.state.phaseResolutionCursor.participantId
      : context.state.currentCursor?.participantId;
  const participant = context.state.participants.find(
    (entry) => entry.participantId === participantId,
  );
  const substep =
    context.state.phaseResolutionCursor?.phase === phase
      ? context.state.phaseResolutionCursor.substep
      : undefined;
  if (
    participantId &&
    (substep === "feint" ||
      (participant?.declaration?.actionId === "feint_attack" &&
        getCombatRoundFeintProposal({ attackerParticipantId: participantId, state: context.state })
          ?.status !== "committed"))
  ) {
    return [buildFeintProcess(context, phase, participantId)];
  }
  if (
    participantId &&
    (substep === "adjust_distance" ||
      (participant?.declaration?.actionId === "adjust_range_attack" &&
        getCombatRoundAdjustDistanceProposal({
          attackerParticipantId: participantId,
          state: context.state,
        })?.status !== "committed"))
  ) {
    return [buildAdjustDistanceProcess(context, phase, participantId)];
  }
  return [buildAttackProcess(context, phase)];
}
