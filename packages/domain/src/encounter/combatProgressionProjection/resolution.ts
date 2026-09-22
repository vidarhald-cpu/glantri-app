import {
  getCombatRoundCriticalResultId,
  getCanonicalAttackOpportunityIdentity,
  getCombatRoundDamageReviewId,
  getCombatRoundDamageSubstate,
  getCombatRoundGrazeDamageRollContext,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundPendingDefenseAttackResult,
  getCombatRoundPendingMissileIncomingAttackForParticipantPhase,
  getCombatRoundAttackResultForOpportunity,
  getCombatRoundAttackResultId,
  getCombatRoundHitLocationResultId,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundPhaseAttackCandidates,
  getCombatRoundPhaseInitiativeChoiceStatuses,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundOffensiveParryAttemptIdentity,
  getCombatRoundOpenPerformTaskForParticipant,
  getCombatRoundParryDisarmAttemptIdentity,
  isCombatRoundPhaseResolutionComplete,
  type CombatRoundPhase,
} from "../combatRoundManager";
import {
  getCombatGenericActionOpportunityAdvances,
  isCombatGenericActionFinalOpportunity,
  type CombatGenericAction,
} from "../combatGenericAction";
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
import { isCombatMissileReady } from "../combatMissile";

function buildPhaseCombatExperienceProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess | undefined {
  const candidatesByParticipantId = new Map(
    getCombatRoundPhaseAttackCandidates({ phase, state: context.state }).map((candidate) => [
      candidate.participantId,
      candidate,
    ]),
  );
  const tasks = getCombatRoundPhaseInitiativeChoiceStatuses({ phase, state: context.state })
    .filter((status) => status.unresolved)
    .map<TaskSpec>((status) => {
      const owner = context.identities.get(status.participantId);
      const candidate = candidatesByParticipantId.get(status.participantId);
      const incomingAttackerId = status.threats[0]?.attackerParticipantId;
      return {
        expectedCommand: "submit_phase_initiative_choice",
        identity: {
          opponentParticipantId: incomingAttackerId,
          opportunityId: candidate?.id,
          phase,
        },
        key: `${status.participantId}:phase-choice`,
        kind: "combat_experience",
        owner,
        presentationContext: {
          actor: owner,
          difficulty: status.ceRequired
            ? getCombatRoundCombatExperienceDifficulty(context.state)
            : undefined,
          reason: status.ceRequired ? "attacked_while_attacking" : "phase_attack_choice",
          responder: owner,
          target: incomingAttackerId ? context.identities.get(incomingAttackerId) : undefined,
        },
        trackerOwner: owner,
        trackerStep: phase === "phase1" ? "A1" : "A2",
      };
    });
  if (tasks.length === 0) return undefined;

  return buildProcess(
    context,
    "combat_experience",
    [
      {
        executionGroups: [{ key: `${phase}:choices`, tasks }],
        kind: "input",
        state: "active",
        strategy: "parallel_all",
      },
    ],
    { key: phase },
  );
}

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

function projectedGrazeDamageRollExpression(input: {
  attackerParticipantId?: string;
  context: ProjectionBuildContext;
  defenderParticipantId?: string;
  phase: CombatRoundPhase;
}): string | undefined {
  if (!input.attackerParticipantId || !input.defenderParticipantId) return undefined;
  const phaseStep = input.phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  const attackerSnapshot = [...input.context.state.stepSnapshots]
    .reverse()
    .find(
      (snapshot) =>
        snapshot.roundNumber === input.context.state.roundNumber &&
        snapshot.participantId === input.attackerParticipantId &&
        snapshot.phase === input.phase &&
        snapshot.step === phaseStep &&
        snapshot.attackSummary,
    );
  const defenderSnapshot = [...input.context.state.stepSnapshots]
    .reverse()
    .find(
      (snapshot) =>
        snapshot.roundNumber === input.context.state.roundNumber &&
        snapshot.participantId === input.defenderParticipantId &&
        snapshot.phase === input.phase &&
        snapshot.step === phaseStep &&
        snapshot.defenseSummary,
    );
  const dmb = Number(attackerSnapshot?.attackSummary?.dmb);
  const defenderDm = Number(defenderSnapshot?.defenseSummary?.dm);
  return Number.isInteger(dmb) && Number.isInteger(defenderDm)
    ? getCombatRoundGrazeDamageRollContext({ defenderDm, dmb }).diceExpression
    : undefined;
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
      state:
        substep === "defense" || substep === "parry"
          ? "active"
          : substep === "attack"
            ? "pending"
            : "complete",
      strategy: "single_task",
    },
    {
      kind: "damage",
      state:
        substep === "damage"
          ? "active"
          : substep === "attack" || substep === "defense" || substep === "parry"
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
    const missileReadiness =
      candidate?.attackType === "missile"
        ? context.state.missileReadiness.find(
            (entry) =>
              entry.participantId === participantId &&
              entry.weaponItemId === candidate.weaponInstanceId &&
              entry.targetParticipantId === candidate.targetParticipantId,
          )
        : undefined;
    const needsMissileReadiness =
      candidate?.attackType === "missile" &&
      (!missileReadiness || !isCombatMissileReady(missileReadiness));
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
          expectedCommand: needsMissileReadiness ? "progress_missile_readiness" : "roll_attack",
          identity: {
            ammoItemId: missileReadiness?.ammoItemId,
            missileReadinessId: missileReadiness?.id,
            opponentParticipantId: candidate?.targetParticipantId,
            opportunityId: candidate?.id,
            phase,
            weaponInstanceId: candidate?.weaponInstanceId,
            weaponTemplateId: candidate?.weaponTemplateId,
          },
          kind: needsMissileReadiness ? "missile_readiness" : "attack",
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
  } else if (substep === "defense") {
    const defender = participantId ? context.identities.get(participantId) : undefined;
    const pendingMissile = participantId
      ? getCombatRoundPendingMissileIncomingAttackForParticipantPhase({
          defenderParticipantId: participantId,
          phase,
          state: context.state,
        })
      : undefined;
    const attack = participantId
      ? getCombatRoundPendingDefenseAttackResult({
          participantId,
          phase,
          state: context.state,
        })
      : undefined;
    const attackerParticipantId =
      pendingMissile?.attackerParticipantId ?? attack?.attackerParticipantId;
    const attackId = pendingMissile
      ? getCombatRoundAttackResultId({
          result: pendingMissile,
          roundNumber: context.state.roundNumber,
        })
      : attack
        ? getCombatRoundAttackResultId({
            result: attack,
            roundNumber: context.state.roundNumber,
          })
        : undefined;
    stages[1] = {
      ...stages[1],
      tasks: [
        {
          dependencies:
            attackId && attackerParticipantId && participantId
              ? undefined
              : [
                  {
                    message: "The active defense review has no exact incoming attack.",
                    owner: defender,
                    type: "invalid_source",
                  },
                ],
          expectedCommand: "commit_defense_review",
          identity: {
            attackResultId: attackId,
            attackerParticipantId,
            defenderParticipantId: participantId,
            opportunityId: pendingMissile?.attackOpportunityId ?? attack?.attackOpportunityId,
            opponentParticipantId: attackerParticipantId,
            phase,
          },
          kind: "defense_review",
          owner: GM_IDENTITY,
          presentationContext: {
            actionKind: presentationActionKind(
              attackerParticipantId
                ? context.state.participants.find(
                    (entry) => entry.participantId === attackerParticipantId,
                  )?.declaration?.actionId
                : undefined,
            ),
            actor: attackerParticipantId
              ? context.identities.get(attackerParticipantId)
              : undefined,
            responder: defender,
            target: defender,
          },
          trackerOwner: defender,
          trackerStep: trackerParry,
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
    if (attack?.attackType === "missile") {
      stages[1] = { ...stages[1], state: "complete", tasks: [] };
      stages[2] = { ...stages[2], state: "active" };
    } else {
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
              attackerParticipantId: attack?.attackerParticipantId,
              defenderParticipantId: attack?.defenderParticipantId,
              opportunityId: attack?.attackOpportunityId,
              opponentParticipantId: attack?.attackerParticipantId,
              parryPurpose: "ordinary_defense",
              parrySourceId: "auto",
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
              attackOutcome: attack?.hit === true ? "hit" : "miss",
              responder: owner,
              target: owner,
            },
            trackerOwner: owner,
            trackerStep: trackerParry,
          },
        ],
      };
    }
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
      const grazing = attack?.grazing === true;
      const damageRollExpression = grazing
        ? projectedGrazeDamageRollExpression({
            attackerParticipantId: attack?.attackerParticipantId,
            context,
            defenderParticipantId: attack?.defenderParticipantId,
            phase,
          })
        : undefined;
      stages[2] = {
        ...stages[2],
        tasks: [
          {
            expectedCommand: "resolve_damage",
            identity: { ...downstreamIdentity, damageRollExpression },
            kind: grazing ? "damage_roll" : "damage_review",
            owner: grazing ? attacker : GM_IDENTITY,
            presentationContext: {
              actor: attacker,
              damageRollExpression,
              responder: grazing ? attacker : undefined,
              target: attack ? context.identities.get(attack.defenderParticipantId) : undefined,
            },
            trackerOwner: grazing ? attacker : undefined,
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

function buildBreakOffProcess(
  context: ProjectionBuildContext,
  escapeeParticipantId: string,
): CombatProgressionProcess {
  const escapee = context.identities.get(escapeeParticipantId);
  const proposals = context.state.breakOffProposals
    .filter(
      (proposal) =>
        proposal.roundNumber === context.state.roundNumber &&
        proposal.escapeeParticipantId === escapeeParticipantId,
    )
    .sort((left, right) => left.pairKey.localeCompare(right.pairKey));
  const proposal = proposals.find((entry) => entry.status !== "committed");
  const attacker = proposal ? context.identities.get(proposal.attackerParticipantId) : undefined;
  const reviewActive = proposal?.status === "awaiting_gm_review";
  const rollsActive = proposal?.status === "awaiting_rolls";
  const commitActive = proposal?.status === "awaiting_commit";
  const sharedIdentity = proposal
    ? {
        opponentParticipantId: proposal.attackerParticipantId,
        pairId: proposal.pairKey,
        phase: "phase1" as const,
        proposalId: proposal.id,
      }
    : undefined;
  return buildProcess(
    context,
    "break_off",
    [
      {
        kind: "proposal_review",
        state: reviewActive ? "active" : proposal ? "complete" : "pending",
        strategy: "gm_review",
        tasks:
          reviewActive && sharedIdentity
            ? [
                {
                  allowedActors: ["gm"],
                  expectedCommand: "review_break_off",
                  identity: sharedIdentity,
                  kind: "break_off_review",
                  owner: GM_IDENTITY,
                  presentationContext: {
                    actionKind: "break_off_engagement",
                    actor: escapee,
                    reason: "GM reviews the circumstances and situational modifiers.",
                    target: attacker,
                  },
                  trackerOwner: escapee,
                  trackerStep: "A1",
                },
              ]
            : [],
      },
      {
        executionGroups:
          rollsActive && proposal && sharedIdentity
            ? [
                {
                  key: `${proposal.id}:dodge`,
                  tasks: [
                    ...(proposal.escapeeRoll
                      ? []
                      : [
                          {
                            expectedCommand: "roll_break_off" as const,
                            identity: sharedIdentity,
                            key: `${proposal.id}:escapee`,
                            kind: "break_off_escapee_roll" as const,
                            owner: escapee,
                            presentationContext: {
                              actionKind: "break_off_engagement",
                              actor: escapee,
                              responder: escapee,
                              skill: { label: "Dodge" },
                              target: attacker,
                            },
                            trackerOwner: escapee,
                            trackerStep: "A1" as const,
                          },
                        ]),
                    ...(proposal.attackerRoll
                      ? []
                      : [
                          {
                            expectedCommand: "roll_break_off" as const,
                            identity: sharedIdentity,
                            key: `${proposal.id}:attacker`,
                            kind: "break_off_attacker_roll" as const,
                            owner: attacker,
                            presentationContext: {
                              actionKind: "break_off_engagement",
                              actor: escapee,
                              responder: attacker,
                              skill: { label: "Dodge" },
                              target: attacker,
                            },
                            trackerOwner: attacker,
                            trackerStep: "A1" as const,
                          },
                        ]),
                  ],
                },
              ]
            : [],
        kind: "opposed_rolls",
        state: rollsActive ? "active" : commitActive || !proposal ? "complete" : "pending",
        strategy: "parallel_all",
      },
      {
        kind: "proposal_commit",
        state: commitActive ? "active" : !proposal ? "complete" : "pending",
        strategy: "gm_review",
        tasks:
          commitActive && sharedIdentity
            ? [
                {
                  allowedActors: ["gm"],
                  expectedCommand: "commit_break_off",
                  identity: sharedIdentity,
                  kind: "break_off_commit",
                  owner: GM_IDENTITY,
                  presentationContext: {
                    actionKind: "break_off_engagement",
                    actor: escapee,
                    target: attacker,
                  },
                  trackerOwner: escapee,
                  trackerStep: "A1",
                },
              ]
            : [],
      },
    ],
    { key: proposal?.id ?? `round:${context.state.roundNumber}:escapee:${escapeeParticipantId}` },
  );
}

function buildDisarmProcess(
  context: ProjectionBuildContext,
  attempt: ProjectionBuildContext["state"]["disarmAttempts"][number],
): CombatProgressionProcess {
  const actor = context.identities.get(attempt.actingParticipantId);
  const holder = context.identities.get(attempt.resistingParticipantId);
  const rollsActive = attempt.status === "awaiting_rolls";
  const commitActive = attempt.status === "awaiting_commit";
  const trackerStep = attempt.phase === "phase1" ? ("A1" as const) : ("A2" as const);
  const identity = {
    disarmAttemptId: attempt.id,
    opponentParticipantId: attempt.resistingParticipantId,
    phase: attempt.phase,
    weaponInstanceId: attempt.actingWeaponItemId,
  };
  return buildProcess(
    context,
    "disarm",
    [
      {
        executionGroups: rollsActive
          ? [
              {
                key: `${attempt.id}:contest`,
                tasks: [
                  ...(attempt.actingRoll
                    ? []
                    : [
                        {
                          expectedCommand: "roll_disarm" as const,
                          identity,
                          key: `${attempt.id}:actor`,
                          kind: "disarm_actor_roll" as const,
                          owner: actor,
                          presentationContext: {
                            actionKind: attempt.method === "proactive" ? "disarm" : "parry_disarm",
                            actor,
                            responder: actor,
                            target: holder,
                          },
                          trackerOwner: actor,
                          trackerStep,
                        },
                      ]),
                  ...(attempt.resistingRoll
                    ? []
                    : [
                        {
                          expectedCommand: "roll_disarm" as const,
                          identity,
                          key: `${attempt.id}:holder`,
                          kind: "disarm_holder_roll" as const,
                          owner: holder,
                          presentationContext: {
                            actionKind: attempt.method === "proactive" ? "disarm" : "parry_disarm",
                            actor,
                            responder: holder,
                            target: holder,
                          },
                          trackerOwner: holder,
                          trackerStep,
                        },
                      ]),
                ],
              },
            ]
          : [],
        kind: "opposed_rolls",
        state: rollsActive ? "active" : commitActive ? "complete" : "pending",
        strategy: "parallel_all",
      },
      {
        kind: "proposal_commit",
        state: commitActive ? "active" : attempt.status === "committed" ? "complete" : "pending",
        strategy: "gm_review",
        tasks: commitActive
          ? [
              {
                allowedActors: ["gm"],
                expectedCommand: "commit_disarm",
                identity,
                kind: "disarm_commit",
                owner: GM_IDENTITY,
                presentationContext: {
                  actionKind: attempt.method === "proactive" ? "disarm" : "parry_disarm",
                  actor,
                  target: holder,
                },
                trackerOwner: actor,
                trackerStep,
              },
            ]
          : [],
      },
    ],
    { key: attempt.id },
  );
}

function adapterStageTaskKind(stage: CombatActionProcessStage): TaskSpec["kind"] | undefined {
  switch (stage.kind) {
    case "attack":
      return "attack";
    case "defense":
      return "parry";
    case "offensive_parry_contest":
      return "offensive_parry_brawling_roll";
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
  const opportunityIdentity = getCanonicalAttackOpportunityIdentity({
    actionId: plan.opportunity.actionId,
    attackerParticipantId: plan.ownerParticipantId,
    opportunity: plan.opportunity,
    roundNumber: context.state.roundNumber,
  });
  const attackResult = getCombatRoundAttackResultForOpportunity({
    opportunityId: plan.opportunity.id,
    state: context.state,
  });
  const offensiveParryAttempt = attackResult
    ? getCombatRoundOffensiveParryAttemptIdentity({
        attackResult,
        state: context.state,
      })
    : undefined;
  const parryDisarmAttempt = attackResult
    ? getCombatRoundParryDisarmAttemptIdentity({ attackResult, state: context.state })
    : undefined;
  const attackSnapshot = [...context.state.stepSnapshots]
    .reverse()
    .find((snapshot) => snapshot.participantId === plan.ownerParticipantId);
  const weaponLabel =
    attackResult?.weaponName ??
    attackSnapshot?.phasePanels?.[plan.phase]?.attackSummary?.weaponName;
  const damageRollExpression = attackResult?.grazing
    ? projectedGrazeDamageRollExpression({
        attackerParticipantId: plan.ownerParticipantId,
        context,
        defenderParticipantId: plan.targetParticipantId,
        phase: plan.phase,
      })
    : undefined;
  const stages: StageSpec[] = plan.stages.map((stage) => {
    if (stage.kind === "offensive_parry_contest") {
      const contest = context.state.offensiveParryContests.find(
        (entry) =>
          entry.attackResultId === plan.attackResultId &&
          entry.opportunityId === plan.opportunity.id &&
          entry.status === "awaiting_rolls",
      );
      const taskSpecs: TaskSpec[] = (stage.tasks ?? []).map((task) => {
        const owner =
          task.owner === "offensive_parry_controller"
            ? context.identities.get(contest?.controllerParticipantId ?? "")
            : context.identities.get(contest?.affectedParticipantId ?? "");
        const opponentParticipantId =
          task.owner === "offensive_parry_controller"
            ? contest?.affectedParticipantId
            : contest?.controllerParticipantId;
        return {
          expectedCommand: task.expectedCommand,
          identity: {
            attackResultId: task.attackResultId,
            contestId: task.contestId,
            declarationId: task.declarationId,
            declaredOpponentParticipantId: task.declaredOpponentParticipantId,
            offensiveParryAttemptId: task.offensiveParryAttemptId,
            opponentParticipantId,
            opportunityId: task.opportunityId,
            parryPurpose: task.parryPurpose,
            parryResultId: task.parryResultId,
            phase: task.phase,
          },
          key: `${task.contestId}:${owner?.kind === "combatant" ? owner.participantId : "missing"}`,
          kind: "offensive_parry_brawling_roll",
          owner,
          presentationContext: {
            actionKind: "offensive_parry",
            actor: context.identities.get(contest?.controllerParticipantId ?? ""),
            responder: owner?.kind === "combatant" ? owner : undefined,
            skill: { id: "brawling", label: "Brawling" },
            target: context.identities.get(contest?.affectedParticipantId ?? ""),
          },
          trackerOwner: owner?.kind === "combatant" ? owner : undefined,
          trackerStep: trackerStepForPhase(plan.phase, "parry"),
        };
      });
      return {
        executionGroups:
          taskSpecs.length > 0
            ? [{ key: contest?.id ?? plan.opportunity.id, tasks: taskSpecs }]
            : undefined,
        kind: "offensive_parry_contest",
        state:
          stage.state === "ready" ? "active" : stage.state === "pending" ? "pending" : "complete",
        strategy: "parallel_all",
      };
    }
    const task = stage.task;
    const taskKind =
      task?.expectedCommand === "commit_defense_review"
        ? ("defense_review" as const)
        : stage.kind === "damage" && task?.owner === "attacker"
          ? ("damage_roll" as const)
          : adapterStageTaskKind(stage);
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
    if (!opportunityIdentity) {
      dependencies.push({
        message: "The active attack is missing its committed weapon source or attack mode.",
        owner: attacker,
        type: "invalid_source",
      });
    }
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
        task?.owner === "gm" || stage.kind === "commit" || (stage.kind === "damage" && !task)
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
                  actionId: opportunityIdentity?.actionId,
                  attackIndex: opportunityIdentity?.attackIndex,
                  attackModeId: opportunityIdentity?.attackModeId,
                  attackerParticipantId: plan.ownerParticipantId,
                  declarationId:
                    taskKind === "parry" && offensiveParryAttempt
                      ? offensiveParryAttempt.declarationId
                      : opportunityIdentity?.declarationId,
                  declaredOpponentParticipantId:
                    taskKind === "parry"
                      ? (offensiveParryAttempt?.declaredOpponentParticipantId ??
                        parryDisarmAttempt?.declaredOpponentParticipantId)
                      : undefined,
                  disarmAttemptId:
                    taskKind === "parry" ? parryDisarmAttempt?.disarmAttemptId : undefined,
                  damageRollExpression:
                    taskKind === "damage_roll" ? damageRollExpression : undefined,
                  defenderParticipantId: plan.targetParticipantId,
                  opponentParticipantId:
                    task.owner === "defender" ? plan.ownerParticipantId : plan.targetParticipantId,
                  opportunityId: task.opportunityId,
                  offensiveParryAttemptId:
                    taskKind === "parry"
                      ? offensiveParryAttempt?.offensiveParryAttemptId
                      : undefined,
                  parryPurpose:
                    taskKind === "parry"
                      ? (offensiveParryAttempt?.parryPurpose ??
                        parryDisarmAttempt?.parryPurpose ??
                        "ordinary_defense")
                      : undefined,
                  parrySourceId:
                    taskKind === "parry"
                      ? (offensiveParryAttempt?.parrySourceId ??
                        parryDisarmAttempt?.parrySourceId ??
                        "auto")
                      : undefined,
                  phase: task.phase,
                  weaponInstanceId: opportunityIdentity?.weaponInstanceId,
                  weaponSourceId: opportunityIdentity?.weaponSourceId,
                  weaponSourceSlot: opportunityIdentity?.weaponSourceSlot,
                  weaponTemplateId: opportunityIdentity?.weaponTemplateId,
                },
                key:
                  taskKind === "parry" && (offensiveParryAttempt || parryDisarmAttempt)
                    ? (offensiveParryAttempt?.offensiveParryAttemptId ??
                      parryDisarmAttempt!.disarmAttemptId)
                    : task.opportunityId,
                kind: taskKind,
                owner,
                presentationContext: {
                  actionKind:
                    taskKind === "parry" && offensiveParryAttempt
                      ? "offensive_parry"
                      : taskKind === "parry" && parryDisarmAttempt
                        ? "parry_disarm"
                        : plan.actionKind,
                  attackOutcome: attackResult?.hit === true ? "hit" : "miss",
                  actor: attacker,
                  damageRollExpression:
                    taskKind === "damage_roll" ? damageRollExpression : undefined,
                  responder:
                    taskKind === "defense_review"
                      ? defender
                      : owner?.kind === "combatant"
                        ? owner
                        : undefined,
                  target: defender,
                  weapon:
                    weaponLabel || plan.opportunity.itemId || plan.opportunity.weaponTemplateId
                      ? {
                          id: plan.opportunity.itemId ?? plan.opportunity.weaponTemplateId,
                          label: weaponLabel,
                        }
                      : undefined,
                },
                trackerOwner:
                  taskKind === "defense_review"
                    ? defender
                    : task.owner === "gm"
                      ? undefined
                      : trackerOwner,
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
  const phasePlans = context.actionProcessPlans
    .flatMap((plan) => plan.standardAttacks)
    .filter((attack) => attack.phase === phase);
  const activePlans = phasePlans.filter((attack) =>
    attack.stages.some((stage) => stage.state === "ready"),
  );
  if (activePlans.length === 1) return activePlans[0];

  const phaseCursor = context.state.phaseResolutionCursor;
  const participantId =
    phaseCursor?.phase === phase
      ? phaseCursor.participantId
      : context.state.currentCursor?.participantId;
  if (!participantId) return undefined;

  if (!phaseCursor || phaseCursor.phase !== phase || phaseCursor.substep === "attack") {
    return activePlans.find((attack) => attack.ownerParticipantId === participantId);
  }
  return activePlans.find(
    (attack) =>
      attack.ownerParticipantId === participantId || attack.targetParticipantId === participantId,
  );
}

/**
 * Projects the one canonical Perform Task holding this actor's Phase 1 primary-action opportunity.
 * Exactly one task is executable at a time, so the lifecycle stays a single authorized command.
 */
function buildPerformTaskProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
  participantId: string,
  action: CombatGenericAction,
): CombatProgressionProcess {
  const owner = context.identities.get(participantId);
  const trackerStep = trackerStepForPhase(phase, "attack");
  const identity = { actionId: action.id, participantId, phase } as const;
  const presentationContext = {
    actionKind: "perform_task",
    actor: owner,
    difficulty: action.rollRequest?.difficulty,
    skill:
      action.rollRequest?.basis.kind === "skill"
        ? {
            id: action.rollRequest.basis.skillId,
            label: action.rollRequest.basis.skillLabel,
          }
        : action.rollRequest?.basis.kind === "stat"
          ? {
              id: action.rollRequest.basis.statId,
              label: action.rollRequest.basis.statLabel,
            }
          : undefined,
  };
  const reviewPending = action.status === "declared" || action.status === "reviewed";
  const rollPending =
    action.status === "active" && Boolean(action.rollRequest) && !action.rollResult;
  const resolvable = isCombatGenericActionFinalOpportunity(action);
  const stage: CombatProgressionStageKind = reviewPending
    ? "review"
    : rollPending
      ? "roll"
      : resolvable
        ? "commit"
        : "input";
  const spec: TaskSpec = reviewPending
    ? {
        allowedActors: ["gm"],
        expectedCommand: "review_combat_task",
        identity,
        kind: "combat_task_review",
        owner: GM_IDENTITY,
        presentationContext,
        trackerOwner: owner,
        trackerStep,
      }
    : rollPending
      ? {
          expectedCommand: "roll_combat_task",
          identity,
          kind: "combat_task_roll",
          owner,
          presentationContext,
          trackerOwner: owner,
          trackerStep,
        }
      : resolvable
        ? {
            allowedActors: ["gm"],
            expectedCommand: "resolve_combat_task",
            identity,
            kind: "combat_task_resolve",
            owner: GM_IDENTITY,
            presentationContext,
            trackerOwner: owner,
            trackerStep,
          }
        : {
            expectedCommand: "advance_combat_task",
            identity,
            kind: "combat_task_advance",
            owner,
            presentationContext,
            trackerOwner: owner,
            trackerStep,
          };

  return buildProcess(
    context,
    "perform_task",
    [
      {
        kind: stage,
        state: "active",
        strategy: spec.allowedActors?.length === 1 ? "gm_review" : "single_task",
        tasks: [spec],
      },
    ],
    { key: action.id },
  );
}

/** The total primary-action opportunities the reviewed task still owns, for presentation only. */
export function getCombatPerformTaskRemainingAdvances(
  action: CombatGenericAction,
): number | undefined {
  const required = getCombatGenericActionOpportunityAdvances(action.duration);
  return required === undefined
    ? undefined
    : Math.max(required - action.progress.completedRounds, 0);
}

export function buildResolutionProcesses(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess[] {
  const phaseCombatExperienceProcess = buildPhaseCombatExperienceProcess(context, phase);
  if (phaseCombatExperienceProcess) return [phaseCombatExperienceProcess];
  const activeDisarm = context.state.disarmAttempts.find(
    (attempt) =>
      attempt.roundNumber === context.state.roundNumber &&
      attempt.phase === phase &&
      (attempt.status === "awaiting_rolls" || attempt.status === "awaiting_commit"),
  );
  if (activeDisarm) return [buildDisarmProcess(context, activeDisarm)];

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
  const initiativeParticipantIds = new Set(context.initiativeGroup?.participantIds ?? []);
  const groupManeuverPlans =
    phase === "phase1"
      ? context.actionProcessPlans
          .filter(
            (plan) =>
              initiativeParticipantIds.has(plan.ownerParticipantId) &&
              plan.maneuver &&
              !plan.maneuver.completion.complete &&
              plan.maneuver.stages.some((stage) => stage.state === "ready"),
          )
          .map((plan) => plan.maneuver!)
      : [];
  const groupAttackPlans = context.actionProcessPlans
    .flatMap((plan) => plan.standardAttacks)
    .filter(
      (attack) =>
        attack.phase === phase &&
        initiativeParticipantIds.has(attack.ownerParticipantId) &&
        attack.stages.some((stage) => stage.state === "ready"),
    );
  if (groupManeuverPlans.length > 0 || groupAttackPlans.length > 0) {
    return [
      ...groupManeuverPlans.map((plan) => buildAdapterManeuverProcess(context, plan)),
      ...groupAttackPlans.map((plan) => buildAdapterAttackProcess(context, plan)),
    ];
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
  if (phase === "phase1" && substep === "break_off" && participantId) {
    return [buildBreakOffProcess(context, participantId)];
  }
  // Perform Task is projected at whichever phase its reviewed duration schedules it into. The
  // getter only returns a task scheduled for the phase asked about, so a Phase 2 task is never
  // projected at Phase 1 nor the other way round.
  if (substep === "perform_task" && participantId) {
    const performTask = getCombatRoundOpenPerformTaskForParticipant({
      participantId,
      phase,
      state: context.state,
    });
    if (performTask) {
      return [buildPerformTaskProcess(context, phase, participantId, performTask)];
    }
  }
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
