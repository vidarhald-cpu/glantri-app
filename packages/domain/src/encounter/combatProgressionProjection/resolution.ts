import {
  getCombatRoundCriticalResultId,
  getCombatRoundDamageReviewId,
  getCombatRoundDamageSubstate,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundAttackResultId,
  getCombatRoundHitLocationResultId,
  getCombatRoundPhaseAttackCandidates,
  getCombatRoundPhaseResolutionResultForAttack,
  isCombatRoundPhaseResolutionComplete,
  type CombatRoundPhase,
} from "../combatRoundManager";
import type {
  CombatActionProcessStage,
  CombatManeuverProcessPlan,
  CombatManeuverProcessStagePlan,
  StandardAttackProcessPlan,
} from "../combatActionProcesses";
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

function presentationActionKind(actionId: string | undefined): string | undefined {
  switch (actionId) {
    case "attack_parry":
      return "single_attack";
    case "parry_attack":
      return "reactive_attack";
    case "adjust_range_attack":
      return "adjust_distance_attack";
    default:
      return actionId;
  }
}

function maneuverStageKind(stage: CombatManeuverProcessStagePlan): CombatProgressionStageKind {
  return stage.kind;
}

function buildAdapterManeuverProcess(
  context: ProjectionBuildContext,
  plan: CombatManeuverProcessPlan,
): CombatProgressionProcess {
  const maneuverOwner = context.identities.get(plan.ownerParticipantId);
  const maneuverTarget = plan.targetParticipantId
    ? context.identities.get(plan.targetParticipantId)
    : undefined;
  const feintProposal =
    plan.maneuverKind === "feint"
      ? context.state.feintProposals.find((proposal) => proposal.id === plan.proposalId)
      : undefined;
  const adjustDistanceProposal =
    plan.maneuverKind === "adjust_distance"
      ? context.state.adjustDistanceProposals.find((proposal) => proposal.id === plan.proposalId)
      : undefined;
  const stages: StageSpec[] = plan.stages.map((stage) => {
    const dependencies: TaskDependency[] = [];
    for (const prerequisite of plan.prerequisites) {
      if (prerequisite.satisfied) continue;
      dependencies.push({
        message:
          prerequisite.kind === "proposal"
            ? `The active ${plan.maneuverKind.replace("_", " ")} has no proposal.`
            : prerequisite.kind === "target"
              ? "The maneuver target is missing or invalid."
              : "The maneuver is waiting for its Phase 1 action turn.",
        owner: maneuverOwner,
        type:
          prerequisite.kind === "proposal"
            ? "proposal_pending"
            : prerequisite.kind === "target"
              ? "invalid_target"
              : "participant_input_pending",
      });
    }
    const taskDescriptors =
      stage.state === "ready" ? (stage.tasks ?? (stage.task ? [stage.task] : [])) : [];
    const taskSpecs: TaskSpec[] = taskDescriptors.map((task) => {
      const owner =
        task.ownerRole === "gm"
          ? GM_IDENTITY
          : task.ownerParticipantId
            ? context.identities.get(task.ownerParticipantId)
            : undefined;
      return {
        allowedActors: task.ownerRole === "gm" ? (["gm"] as const) : undefined,
        dependencies,
        expectedCommand: task.expectedCommand,
        identity: {
          opportunityId: task.opportunityId,
          opponentParticipantId:
            task.ownerParticipantId === plan.targetParticipantId
              ? plan.ownerParticipantId
              : plan.targetParticipantId,
          pairId: task.pairId,
          phase: task.phase,
          proposalId: task.proposalId,
        },
        key: `${task.proposalId}:${task.kind}`,
        kind: task.kind,
        owner,
        presentationContext: {
          actionKind: plan.actionKind,
          actor: maneuverOwner,
          distance: adjustDistanceProposal
            ? {
                current: adjustDistanceProposal.currentDistance,
                direction: adjustDistanceProposal.direction,
                requested: adjustDistanceProposal.requestedDistance,
              }
            : undefined,
          responder: owner?.kind === "combatant" ? owner : undefined,
          skill:
            task.kind === "feint_attacker_roll"
              ? {
                  id: feintProposal?.attackerSkillId,
                  label: feintProposal?.attackerSkillLabel,
                }
              : task.kind === "feint_defender_roll"
                ? {
                    id: feintProposal?.defenderSkillId,
                    label: feintProposal?.defenderSkillLabel,
                  }
                : task.kind === "adjust_distance_attacker_roll" ||
                    task.kind === "adjust_distance_defender_roll"
                  ? { label: "Dodge" }
                  : undefined,
          target: maneuverTarget,
        },
        // Participant-owned maneuver input belongs to the required actor's row. The final GM
        // commit is process work and must not leave a participant roll marker pending.
        trackerOwner:
          task.kind === "adjust_distance_commit"
            ? undefined
            : owner?.kind === "combatant"
              ? owner
              : maneuverOwner,
        trackerStep: "A1" as const,
      };
    });
    const base: StageSpec = {
      kind: maneuverStageKind(stage),
      state:
        stage.state === "ready" ? "active" : stage.state === "pending" ? "pending" : "complete",
      strategy: stage.executionStrategy,
    };
    return stage.executionStrategy === "parallel_all" && taskSpecs.length > 0
      ? {
          ...base,
          executionGroups: [
            {
              key: `${plan.proposalId}:${stage.kind}`,
              tasks: taskSpecs,
            },
          ],
        }
      : { ...base, tasks: taskSpecs };
  });
  return buildProcess(context, plan.maneuverKind, stages, {
    key: plan.proposalId,
    planId: plan.id,
  });
}

function buildLegacyAttackProcess(
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
    const participant = context.state.participants.find(
      (entry) => entry.participantId === participantId,
    );
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
          identity: {
            opponentParticipantId: candidate?.targetParticipantId,
            opportunityId: candidate?.id,
            phase,
          },
          kind: "attack",
          owner,
          presentationContext: {
            actionKind: presentationActionKind(participant?.declaration?.actionId),
            actor: owner,
            target: candidate?.targetParticipantId
              ? context.identities.get(candidate.targetParticipantId)
              : undefined,
          },
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
            opponentParticipantId: attack?.attackerParticipantId,
            phase,
          },
          kind: "parry",
          owner,
          presentationContext: {
            actionKind: presentationActionKind(
              attack
                ? context.state.participants.find(
                    (entry) => entry.participantId === attack.attackerParticipantId,
                  )?.declaration?.actionId
                : undefined,
            ),
            actor: attack ? context.identities.get(attack.attackerParticipantId) : undefined,
            responder: owner,
            target: owner,
          },
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
    const attackResultId = attack
      ? getCombatRoundAttackResultId({
          result: attack,
          roundNumber: context.state.roundNumber,
        })
      : undefined;
    const downstreamIdentity = attackResultId
      ? {
          attackResultId,
          attackerParticipantId: attack?.attackerParticipantId,
          criticalResultId: getCombatRoundCriticalResultId({ attackResultId }),
          damageReviewId: getCombatRoundDamageReviewId({ attackResultId }),
          defenderParticipantId: attack?.defenderParticipantId,
          hitLocationResultId: getCombatRoundHitLocationResultId({ attackResultId }),
          opportunityId: attack?.attackOpportunityId,
          opponentParticipantId: attack?.defenderParticipantId,
          phase,
        }
      : { opponentParticipantId: attack?.defenderParticipantId, phase };
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
            identity: downstreamIdentity,
            kind: "hit_location",
            owner: attacker,
            presentationContext: {
              actor: attacker,
              responder: attacker,
              target: attack ? context.identities.get(attack.defenderParticipantId) : undefined,
            },
            trackerOwner: attacker,
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
            identity: downstreamIdentity,
            kind: "critical",
            owner: attacker,
            presentationContext: {
              actor: attacker,
              responder: attacker,
              target: attack ? context.identities.get(attack.defenderParticipantId) : undefined,
            },
            trackerOwner: attacker,
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
            identity: downstreamIdentity,
            kind: "damage_review",
            owner: GM_IDENTITY,
            presentationContext: {
              actor: attacker,
              target: attack ? context.identities.get(attack.defenderParticipantId) : undefined,
            },
            trackerOwner: undefined,
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
            identity: downstreamIdentity,
            kind: "damage_review",
            owner: GM_IDENTITY,
            presentationContext: {
              actor: attacker,
              target: attack ? context.identities.get(attack.defenderParticipantId) : undefined,
            },
            trackerOwner: undefined,
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

function adapterStageTaskKind(stage: CombatActionProcessStage): TaskSpec["kind"] | undefined {
  switch (stage.kind) {
    case "attack":
      return "attack";
    case "defense":
      return "parry";
    case "hit_location":
      return "hit_location";
    case "damage":
    case "commit":
      return "damage_review";
    case "critical":
      return "critical";
  }
}

function buildAdapterAttackProcess(
  context: ProjectionBuildContext,
  plan: StandardAttackProcessPlan,
): CombatProgressionProcess {
  const attacker = context.identities.get(plan.ownerParticipantId);
  const defender = plan.targetParticipantId
    ? context.identities.get(plan.targetParticipantId)
    : undefined;
  const attackResult = context.state.participants.find(
    (participant) => participant.participantId === plan.ownerParticipantId,
  )?.attackResults[plan.phase];
  const attackSnapshot = [...context.state.stepSnapshots]
    .reverse()
    .find((snapshot) => snapshot.participantId === plan.ownerParticipantId);
  const weaponLabel =
    attackResult?.weaponName ??
    attackSnapshot?.phasePanels?.[plan.phase]?.attackSummary?.weaponName;
  const stages: StageSpec[] = plan.stages.map((stage) => {
    const task = stage.task;
    const taskKind = adapterStageTaskKind(stage);
    const owner =
      task?.owner === "gm" ? GM_IDENTITY : task?.owner === "defender" ? defender : attacker;
    // Tracker ownership follows the participant who must supply this stage's input.
    // In particular, hit-location and critical rolls belong to the attacker even
    // though they are displayed in the damage facet.
    const trackerOwner = task?.owner === "defender" ? defender : attacker;
    const dependencies: TaskDependency[] = [];
    const attackResultId = task?.attackResultId;
    const downstreamIdentity = attackResultId
      ? {
          attackResultId,
          attackerParticipantId: plan.ownerParticipantId,
          criticalResultId: getCombatRoundCriticalResultId({ attackResultId }),
          damageReviewId: getCombatRoundDamageReviewId({ attackResultId }),
          defenderParticipantId: plan.targetParticipantId,
          hitLocationResultId: getCombatRoundHitLocationResultId({ attackResultId }),
        }
      : {};
    for (const prerequisite of plan.prerequisites) {
      if (prerequisite.satisfied) continue;
      dependencies.push({
        message:
          prerequisite.kind === "target"
            ? "The active attack target is missing or invalid."
            : prerequisite.kind === "reactive_trigger"
              ? "Reactive Attack is waiting for its phase-1 trigger."
              : prerequisite.kind === "double_attack_continued"
                ? "Double Attack is waiting for its phase-2 decision."
                : "The active attack has no committed opportunity.",
        owner: attacker,
        type:
          prerequisite.kind === "target"
            ? "invalid_target"
            : prerequisite.kind === "attack_opportunity"
              ? "invalid_source"
              : "participant_input_pending",
      });
    }
    return {
      kind: stage.kind,
      state:
        stage.state === "ready" ? "active" : stage.state === "pending" ? "pending" : "complete",
      strategy:
        task?.owner === "gm" || stage.kind === "damage" || stage.kind === "commit"
          ? "gm_review"
          : "single_task",
      tasks:
        stage.state === "ready" && task && taskKind
          ? [
              {
                allowedActors: task.owner === "gm" ? (["gm"] as const) : undefined,
                dependencies,
                expectedCommand: task.expectedCommand,
                identity: {
                  ...downstreamIdentity,
                  opponentParticipantId:
                    task.owner === "defender" ? plan.ownerParticipantId : plan.targetParticipantId,
                  opportunityId: task.opportunityId,
                  phase: task.phase,
                },
                key: task.opportunityId,
                kind: taskKind,
                owner,
                presentationContext: {
                  actionKind: plan.actionKind,
                  actor: attacker,
                  responder: owner?.kind === "combatant" ? owner : undefined,
                  target: defender,
                  weapon:
                    weaponLabel || plan.opportunity.itemId || plan.opportunity.weaponTemplateId
                      ? {
                          id: plan.opportunity.itemId ?? plan.opportunity.weaponTemplateId,
                          label: weaponLabel,
                        }
                      : undefined,
                },
                trackerOwner: task.owner === "gm" ? undefined : trackerOwner,
                trackerStep: trackerStepForPhase(plan.phase, stage.trackerFacet),
              },
            ]
          : [],
    };
  });
  return buildProcess(context, "attack", stages, {
    key: plan.opportunity.id,
    planId: plan.id,
  });
}

function findAdapterAttackProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): StandardAttackProcessPlan | undefined {
  const phaseCursor = context.state.phaseResolutionCursor;
  const participantId =
    phaseCursor?.phase === phase
      ? phaseCursor.participantId
      : context.state.currentCursor?.participantId;
  if (!participantId) return undefined;

  if (!phaseCursor || phaseCursor.phase !== phase || phaseCursor.substep === "attack") {
    return context.actionProcessPlans
      .flatMap((plan) => plan.standardAttacks)
      .find((attack) => attack.phase === phase && attack.ownerParticipantId === participantId);
  }

  const incoming = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
    participantId,
    phase,
    state: context.state,
  });
  const outgoing = context.state.participants.find(
    (participant) => participant.participantId === participantId,
  )?.attackResults[phase];
  const attackResult = incoming ?? outgoing;
  return context.actionProcessPlans
    .flatMap((plan) => plan.standardAttacks)
    .find(
      (attack) =>
        attack.phase === phase &&
        (attackResult?.attackOpportunityId
          ? attack.opportunity.id === attackResult.attackOpportunityId
          : attack.ownerParticipantId === attackResult?.attackerParticipantId),
    );
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
  const maneuverPlan = participantId
    ? context.actionProcessPlans.find(
        (plan) =>
          plan.ownerParticipantId === participantId &&
          plan.maneuver &&
          (substep === plan.maneuver.maneuverKind ||
            (phase === "phase1" &&
              ((participant?.declaration?.actionId === "feint_attack" &&
                plan.maneuver.maneuverKind === "feint") ||
                (participant?.declaration?.actionId === "adjust_range_attack" &&
                  plan.maneuver.maneuverKind === "adjust_distance")) &&
              !plan.maneuver.completion.complete)),
      )?.maneuver
    : undefined;
  if (maneuverPlan && phase === "phase1") {
    return [buildAdapterManeuverProcess(context, maneuverPlan)];
  }
  const adapterAttack = findAdapterAttackProcess(context, phase);
  return [
    adapterAttack
      ? buildAdapterAttackProcess(context, adapterAttack)
      : buildLegacyAttackProcess(context, phase),
  ];
}
