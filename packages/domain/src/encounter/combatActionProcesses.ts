import {
  parseCombatRoundState,
  buildCombatRoundDeclaredAttackOpportunities,
  getCombatRoundAttackResultId,
  getCombatRoundAttackResultForOpportunity,
  getCombatRoundDamageSubstate,
  getCombatRoundDoubleAttackPhase2Decision,
  getCombatRoundOffensiveParryAttemptIdentity,
  getCombatRoundParryDisarmAttemptIdentity,
  isCombatRoundAttackResolvedWithoutDefenseReview,
  getCombatRoundPendingMissileIncomingAttack,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundParticipantAttackResults,
  type CombatRoundAttackOpportunity,
  type CombatRoundCommandType,
  type CombatRoundPhase,
  type CombatRoundState,
} from "./combatRoundManager";
import { buildCombatAdjustDistanceProposalId } from "./combatAdjustDistance";
import { validateCombatDeclarationCompatibility } from "./combatDeclarationCompatibility";
import { buildCombatFeintProposalId } from "./combatFeint";

export const COMBAT_ACTION_PROCESS_ACTION_KINDS = [
  "single_attack",
  "reactive_attack",
  "double_attack",
  "feint_attack",
  "adjust_distance_attack",
] as const;

export type CombatActionProcessActionKind = (typeof COMBAT_ACTION_PROCESS_ACTION_KINDS)[number];

export type CombatActionProcessStageKind =
  | "attack"
  | "defense"
  | "offensive_parry_contest"
  | "hit_location"
  | "damage"
  | "critical"
  | "commit";

export type CombatActionProcessStageState = "complete" | "pending" | "ready" | "skipped";

export interface CombatActionProcessPrerequisite {
  readonly kind:
    | "action_turn_open"
    | "attack_opportunity"
    | "double_attack_continued"
    | "maneuver_complete"
    | "proposal"
    | "reactive_trigger"
    | "target";
  readonly satisfied: boolean;
}

export type CombatManeuverKind = "adjust_distance" | "feint";

export type CombatManeuverStageKind =
  | "participant_response"
  | "gm_adjustment"
  | "attacker_roll"
  | "defender_roll"
  | "opposed_rolls"
  | "proposal_review"
  | "proposal_commit";

export interface CombatManeuverTaskDescriptor {
  readonly expectedCommand: CombatRoundCommandType;
  readonly kind:
    | "adjust_distance_adjustment"
    | "adjust_distance_attacker_roll"
    | "adjust_distance_commit"
    | "adjust_distance_defender_roll"
    | "adjust_distance_response"
    | "feint_attacker_roll"
    | "feint_commit"
    | "feint_defender_roll";
  readonly opportunityId: string;
  readonly ownerParticipantId?: string;
  readonly ownerRole: "participant" | "gm";
  readonly pairId: string;
  readonly phase: "phase1";
  readonly proposalId: string;
}

export interface CombatManeuverProcessStagePlan {
  readonly executionStrategy: "gm_review" | "ordered_all" | "parallel_all" | "single_task";
  readonly id: string;
  readonly kind: CombatManeuverStageKind;
  readonly state: CombatActionProcessStageState;
  readonly task?: CombatManeuverTaskDescriptor;
  readonly tasks?: readonly CombatManeuverTaskDescriptor[];
  readonly trackerFacet: "attack";
}

export interface CombatManeuverProcessPlan {
  readonly actionKind: "adjust_distance_attack" | "feint_attack";
  readonly completion: {
    readonly complete: boolean;
    readonly reason?: "allowed" | "committed" | "impossible" | "successful" | "unsuccessful";
  };
  readonly downstreamProcessIds: readonly string[];
  readonly id: string;
  readonly maneuverKind: CombatManeuverKind;
  readonly metadata: Readonly<Record<string, boolean | number | string | undefined>>;
  readonly ownerParticipantId: string;
  readonly pairId: string;
  readonly phase: "phase1";
  readonly prerequisites: readonly CombatActionProcessPrerequisite[];
  readonly proposalId: string;
  readonly stages: readonly CombatManeuverProcessStagePlan[];
  readonly targetParticipantId?: string;
}

export interface CombatActionProcessTaskDescriptor {
  readonly attackResultId?: string;
  readonly contestId?: string;
  readonly declarationId?: string;
  readonly declaredOpponentParticipantId?: string;
  readonly expectedCommand: CombatRoundCommandType;
  readonly opportunityId: string;
  readonly offensiveParryAttemptId?: string;
  readonly owner:
    | "attacker"
    | "defender"
    | "gm"
    | "offensive_parry_controller"
    | "offensive_parry_responder";
  readonly parryPurpose?: "ordinary_defense" | "offensive_parry" | "parry_disarm";
  readonly parryResultId?: string;
  readonly parrySourceId?: string;
  readonly phase: CombatRoundPhase;
}

export interface CombatActionProcessStage {
  readonly id: string;
  readonly kind: CombatActionProcessStageKind;
  readonly state: CombatActionProcessStageState;
  readonly task?: CombatActionProcessTaskDescriptor;
  readonly tasks?: readonly CombatActionProcessTaskDescriptor[];
  readonly trackerFacet: "attack" | "damage" | "parry";
}

export interface StandardAttackProcessPlan {
  readonly actionKind: CombatActionProcessActionKind;
  readonly attackResultId?: string;
  readonly completion: {
    readonly complete: boolean;
    readonly reason?: "cancelled" | "damage_committed" | "miss" | "parried";
  };
  readonly id: string;
  readonly opportunity: Readonly<CombatRoundAttackOpportunity>;
  readonly ownerParticipantId: string;
  readonly phase: CombatRoundPhase;
  readonly prerequisites: readonly CombatActionProcessPrerequisite[];
  readonly stages: readonly CombatActionProcessStage[];
  readonly targetParticipantId?: string;
}

export interface CombatActionProcessDecisionGate {
  readonly decision?: "cancel" | "continue";
  readonly id: string;
  readonly opportunityId?: string;
  readonly ownerParticipantId: string;
  readonly required: boolean;
  readonly state: "complete" | "locked" | "ready";
}

export interface CombatActionProcessPlan {
  readonly actionKind: CombatActionProcessActionKind;
  readonly completion: {
    readonly complete: boolean;
  };
  readonly decisionGate?: CombatActionProcessDecisionGate;
  readonly id: string;
  readonly maneuver?: CombatManeuverProcessPlan;
  readonly ownerParticipantId: string;
  readonly prerequisites: readonly CombatActionProcessPrerequisite[];
  readonly standardAttacks: readonly StandardAttackProcessPlan[];
  readonly trackerFacets: readonly ("attack" | "damage" | "parry")[];
}

export interface CombatActionProcessContext {
  /** Optional pre-indexed opportunities used when all adapters are built for one revision. */
  readonly attackOpportunities?: readonly (CombatRoundAttackOpportunity & {
    readonly participantId: string;
  })[];
  readonly participantId: string;
  readonly state: CombatRoundState;
}

export interface CombatActionProcessAdapter {
  readonly actionKind: CombatActionProcessActionKind;
  readonly declarationActionId:
    | "adjust_range_attack"
    | "attack_parry"
    | "double_attack"
    | "feint_attack"
    | "parry_attack";
  buildProcessPlan(context: CombatActionProcessContext): CombatActionProcessPlan;
}

const STAGE_ORDER: readonly CombatActionProcessStageKind[] = [
  "attack",
  "defense",
  "offensive_parry_contest",
  "hit_location",
  "damage",
  "critical",
  "commit",
];

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return value;
}

function stageTrackerFacet(kind: CombatActionProcessStageKind): "attack" | "damage" | "parry" {
  if (kind === "attack") return "attack";
  if (kind === "defense") return "parry";
  if (kind === "offensive_parry_contest") return "parry";
  return "damage";
}

function taskForStage(input: {
  attackResultId?: string;
  defenseReviewRequired?: boolean;
  grazing: boolean;
  kind: CombatActionProcessStageKind;
  opportunityId: string;
  phase: CombatRoundPhase;
}): CombatActionProcessTaskDescriptor | undefined {
  const shared = {
    attackResultId: input.attackResultId,
    opportunityId: input.opportunityId,
    phase: input.phase,
  };
  switch (input.kind) {
    case "attack":
      return { ...shared, expectedCommand: "roll_attack", owner: "attacker" };
    case "defense":
      return input.defenseReviewRequired
        ? { ...shared, expectedCommand: "commit_defense_review", owner: "gm" }
        : { ...shared, expectedCommand: "roll_parry", owner: "defender" };
    case "offensive_parry_contest":
      return undefined;
    case "hit_location":
      return { ...shared, expectedCommand: "roll_hit_location", owner: "attacker" };
    case "damage":
      return {
        ...shared,
        expectedCommand: "resolve_damage",
        owner: input.grazing ? "attacker" : "gm",
      };
    case "critical":
      return { ...shared, expectedCommand: "roll_critical", owner: "attacker" };
    case "commit":
      return { ...shared, expectedCommand: "commit_phase_damage", owner: "gm" };
  }
}

function stageStates(input: {
  opportunity: CombatRoundAttackOpportunity;
  ownerParticipantId: string;
  prerequisitesSatisfied: boolean;
  state: CombatRoundState;
}): {
  completion: StandardAttackProcessPlan["completion"];
  states: Readonly<Record<CombatActionProcessStageKind, CombatActionProcessStageState>>;
} {
  const pending = Object.fromEntries(STAGE_ORDER.map((kind) => [kind, "pending"])) as Record<
    CombatActionProcessStageKind,
    CombatActionProcessStageState
  >;
  if (input.opportunity.status === "cancelled") {
    return {
      completion: { complete: true, reason: "cancelled" },
      states: Object.fromEntries(STAGE_ORDER.map((kind) => [kind, "skipped"])) as Record<
        CombatActionProcessStageKind,
        CombatActionProcessStageState
      >,
    };
  }
  if (!input.prerequisitesSatisfied) return { completion: { complete: false }, states: pending };

  const attack = getCombatRoundAttackResultForOpportunity({
    opportunityId: input.opportunity.id,
    state: input.state,
  });
  const pendingMissileAttack = attack
    ? undefined
    : getCombatRoundPendingMissileIncomingAttack({
        opportunityId: input.opportunity.id,
        state: input.state,
      });
  const incomingAttack = attack ?? pendingMissileAttack;
  if (!incomingAttack) {
    pending.attack = "ready";
    return { completion: { complete: false }, states: pending };
  }
  pending.attack = "complete";
  const attackResultId = getCombatRoundAttackResultId({
    result: incomingAttack,
    roundNumber: input.state.roundNumber,
  });
  const resolution = input.state.phaseResolutionResults.find(
    (entry) => entry.attackResultId === attackResultId,
  );
  // Forgejo #874. A melee miss resolved at its attack-result commit owes no defense review.
  if (
    attack &&
    resolution &&
    !resolution.defenseSnapshotId &&
    isCombatRoundAttackResolvedWithoutDefenseReview({ attackResultId, state: input.state })
  ) {
    for (const kind of STAGE_ORDER.slice(1)) pending[kind] = "skipped";
    return { completion: { complete: true, reason: "miss" }, states: pending };
  }
  if (!resolution?.defenseSnapshotId) {
    pending.defense = "ready";
    return { completion: { complete: false }, states: pending };
  }
  if (!attack) {
    throw new RangeError("Reviewed missile defense is missing its materialized attack result.");
  }
  const offensiveParryAttempt = getCombatRoundOffensiveParryAttemptIdentity({
    attackResult: attack,
    state: input.state,
  });
  const parryDisarmAttempt = getCombatRoundParryDisarmAttemptIdentity({
    attackResult: attack,
    state: input.state,
  });
  if (!attack.hit && !offensiveParryAttempt && !parryDisarmAttempt) {
    for (const kind of STAGE_ORDER.slice(1)) pending[kind] = "skipped";
    pending.defense = "complete";
    return { completion: { complete: true, reason: "miss" }, states: pending };
  }
  if (resolution.parryResolution.status === "pending") {
    pending.defense = "ready";
    return { completion: { complete: false }, states: pending };
  }
  pending.defense = "complete";
  if (resolution.parryResolution.status === "resolved" && resolution.parryResolution.success) {
    const contest = input.state.offensiveParryContests.find(
      (entry) =>
        entry.attackResultId === attackResultId &&
        entry.opportunityId === input.opportunity.id &&
        entry.status !== "cancelled",
    );
    if (contest?.status === "awaiting_rolls") {
      pending.offensive_parry_contest = "ready";
      for (const kind of STAGE_ORDER.slice(3)) pending[kind] = "skipped";
      return { completion: { complete: false }, states: pending };
    }
    pending.offensive_parry_contest = contest ? "complete" : "skipped";
    for (const kind of STAGE_ORDER.slice(3)) pending[kind] = "skipped";
    return { completion: { complete: true, reason: "parried" }, states: pending };
  }
  pending.offensive_parry_contest = "skipped";
  if (!attack.hit) {
    for (const kind of STAGE_ORDER.slice(3)) pending[kind] = "skipped";
    return { completion: { complete: true, reason: "miss" }, states: pending };
  }

  const damageSubstate = getCombatRoundDamageSubstate(resolution);
  if (damageSubstate === "location_pending") {
    pending.hit_location = "ready";
  } else {
    pending.hit_location = "complete";
    if (damageSubstate === "location_rolled") {
      pending.damage = "ready";
    } else {
      pending.damage = "complete";
      if (damageSubstate === "critical_pending") {
        pending.critical = "ready";
      } else {
        pending.critical =
          resolution.criticalRoll.status === "not_required" ? "skipped" : "complete";
        if (damageSubstate === "committed") {
          pending.commit = "complete";
          return {
            completion: { complete: true, reason: "damage_committed" },
            states: pending,
          };
        }
        pending.commit = "ready";
      }
    }
  }
  return { completion: { complete: false }, states: pending };
}

function buildStandardAttackProcess(input: {
  actionKind: CombatActionProcessActionKind;
  opportunity: CombatRoundAttackOpportunity;
  ownerParticipantId: string;
  prerequisites: readonly CombatActionProcessPrerequisite[];
  state: CombatRoundState;
}): StandardAttackProcessPlan {
  const attack = getCombatRoundAttackResultForOpportunity({
    opportunityId: input.opportunity.id,
    state: input.state,
  });
  const pendingMissileAttack = attack
    ? undefined
    : getCombatRoundPendingMissileIncomingAttack({
        opportunityId: input.opportunity.id,
        state: input.state,
      });
  const incomingAttack = attack ?? pendingMissileAttack;
  const attackResultId = incomingAttack
    ? getCombatRoundAttackResultId({
        result: incomingAttack,
        roundNumber: input.state.roundNumber,
      })
    : undefined;
  const defenseReviewRequired = attackResultId
    ? !input.state.phaseResolutionResults.find((entry) => entry.attackResultId === attackResultId)
        ?.defenseSnapshotId
    : false;
  const processId = `round:${input.state.roundNumber}:action:${input.ownerParticipantId}:${input.actionKind}:attack:${input.opportunity.id}`;
  const { completion, states } = stageStates({
    opportunity: input.opportunity,
    ownerParticipantId: input.ownerParticipantId,
    prerequisitesSatisfied: input.prerequisites
      .filter(
        (entry) =>
          entry.kind === "double_attack_continued" ||
          entry.kind === "maneuver_complete" ||
          entry.kind === "reactive_trigger",
      )
      .every((entry) => entry.satisfied),
    state: input.state,
  });
  return {
    actionKind: input.actionKind,
    attackResultId,
    completion,
    id: processId,
    opportunity: input.opportunity,
    ownerParticipantId: input.ownerParticipantId,
    phase: input.opportunity.phase,
    prerequisites: input.prerequisites,
    stages: STAGE_ORDER.map((kind) => {
      const contest =
        kind === "offensive_parry_contest"
          ? input.state.offensiveParryContests.find(
              (entry) =>
                entry.attackResultId === attackResultId &&
                entry.opportunityId === input.opportunity.id &&
                entry.status === "awaiting_rolls",
            )
          : undefined;
      const contestShared = contest
        ? {
            attackResultId,
            contestId: contest.id,
            declarationId: contest.declarationId,
            declaredOpponentParticipantId: contest.declaredOpponentParticipantId,
            offensiveParryAttemptId: contest.offensiveParryAttemptId,
            opportunityId: contest.opportunityId,
            parryPurpose: "offensive_parry" as const,
            parryResultId: contest.parryResultId,
            phase: contest.phase,
          }
        : undefined;
      return {
        id: `${processId}:stage:${kind}`,
        kind,
        state: states[kind],
        task:
          states[kind] === "ready" && kind !== "offensive_parry_contest"
            ? taskForStage({
                attackResultId,
                defenseReviewRequired: kind === "defense" && defenseReviewRequired,
                grazing: attack?.grazing === true,
                kind,
                opportunityId: input.opportunity.id,
                phase: input.opportunity.phase,
              })
            : undefined,
        tasks:
          states[kind] === "ready" && contest && contestShared
            ? [
                ...(contest.initiatorRollRecorded
                  ? []
                  : [
                      {
                        ...contestShared,
                        expectedCommand: "roll_offensive_parry_brawling" as const,
                        owner: "offensive_parry_controller" as const,
                      },
                    ]),
                ...(contest.responderRollRecorded
                  ? []
                  : [
                      {
                        ...contestShared,
                        expectedCommand: "roll_offensive_parry_brawling" as const,
                        owner: "offensive_parry_responder" as const,
                      },
                    ]),
              ]
            : undefined,
        trackerFacet: stageTrackerFacet(kind),
      };
    }),
    targetParticipantId: input.opportunity.targetParticipantId,
  };
}

function buildStandardAdapter(input: {
  actionKind: "double_attack" | "reactive_attack" | "single_attack";
  declarationActionId: CombatActionProcessAdapter["declarationActionId"];
}): CombatActionProcessAdapter {
  return {
    actionKind: input.actionKind,
    declarationActionId: input.declarationActionId,
    buildProcessPlan(context) {
      const state = context.state;
      const participant = state.participants.find(
        (entry) => entry.participantId === context.participantId,
      );
      if (participant?.declaration?.actionId !== input.declarationActionId) {
        throw new RangeError(
          `${input.actionKind} adapter requires a ${input.declarationActionId} declaration.`,
        );
      }
      const contextualOpportunities =
        context.attackOpportunities ??
        ((participant.declaration.attackOpportunities?.length ?? 0) > 0
          ? (participant.declaration.attackOpportunities ?? [])
          : buildCombatRoundDeclaredAttackOpportunities({
              actionId: participant.declaration.actionId,
              participantId: context.participantId,
              phaseContexts: participant.declaration.phaseContexts,
              roundNumber: state.roundNumber,
              secondaryActionId: participant.declaration.secondaryActionId,
            })
        ).map((opportunity) => ({
          ...opportunity,
          participantId: context.participantId,
        }));
      const allOpportunities = contextualOpportunities.filter(
        (entry) => entry.participantId === context.participantId,
      );
      const firstAttackComplete = Boolean(
        getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: context.participantId,
          phase: "phase1",
          state,
        }),
      );
      const decision =
        input.actionKind === "double_attack"
          ? getCombatRoundDoubleAttackPhase2Decision({
              participantId: context.participantId,
              state,
            })
          : undefined;
      const decisionRequired = input.actionKind === "double_attack" && firstAttackComplete;
      const visibleOpportunities = allOpportunities.filter(
        (opportunity) =>
          input.actionKind !== "double_attack" ||
          opportunity.phase === "phase1" ||
          decision === "continue",
      );
      const standardAttacks = visibleOpportunities.map((opportunity) => {
        const targetExists = state.participants.some(
          (entry) =>
            entry.participantId === opportunity.targetParticipantId ||
            entry.scenarioParticipantId === opportunity.targetParticipantId ||
            entry.characterId === opportunity.targetParticipantId,
        );
        const prerequisites: CombatActionProcessPrerequisite[] = [
          { kind: "attack_opportunity", satisfied: opportunity.status === "committed" },
          { kind: "target", satisfied: targetExists },
        ];
        if (input.actionKind === "reactive_attack") {
          const trigger = state.participants
            .flatMap((entry) =>
              getCombatRoundParticipantAttackResults({
                participant: entry,
                roundNumber: state.roundNumber,
              }).filter((attackResult) => attackResult.phase === "phase1"),
            )
            .filter((attackResult) => attackResult.defenderParticipantId === context.participantId)
            .some(
              (attackResult) =>
                opportunity.targetParticipantId !== undefined &&
                (attackResult.attackerParticipantId === opportunity.targetParticipantId ||
                  state.participants.some(
                    (entry) =>
                      entry.participantId === attackResult.attackerParticipantId &&
                      (entry.scenarioParticipantId === opportunity.targetParticipantId ||
                        entry.characterId === opportunity.targetParticipantId),
                  )),
            );
          prerequisites.push({ kind: "reactive_trigger", satisfied: trigger });
        }
        if (input.actionKind === "double_attack" && opportunity.phase === "phase2") {
          prerequisites.push({
            kind: "double_attack_continued",
            satisfied: decision === "continue",
          });
        }
        return buildStandardAttackProcess({
          actionKind: input.actionKind,
          opportunity,
          ownerParticipantId: context.participantId,
          prerequisites,
          state,
        });
      });
      const decisionGate =
        input.actionKind === "double_attack"
          ? {
              decision,
              id: `round:${state.roundNumber}:action:${context.participantId}:double_attack:decision:phase2`,
              opportunityId: allOpportunities.find((entry) => entry.phase === "phase2")?.id,
              ownerParticipantId: context.participantId,
              required: decisionRequired,
              state: decision
                ? ("complete" as const)
                : decisionRequired
                  ? ("ready" as const)
                  : ("locked" as const),
            }
          : undefined;
      const prerequisites = standardAttacks.flatMap((attack) => attack.prerequisites);
      const completion =
        input.actionKind === "double_attack"
          ? Boolean(
              standardAttacks.find((attack) => attack.phase === "phase1")?.completion.complete &&
              (!decisionRequired ||
                decision === "cancel" ||
                (decision === "continue" &&
                  standardAttacks.find((attack) => attack.phase === "phase2")?.completion
                    .complete)),
            )
          : Boolean(standardAttacks[0]?.completion.complete);
      return deepFreeze({
        actionKind: input.actionKind,
        completion: { complete: completion },
        decisionGate,
        id: `round:${state.roundNumber}:action:${context.participantId}:${input.actionKind}`,
        ownerParticipantId: context.participantId,
        prerequisites,
        standardAttacks,
        trackerFacets: ["attack", "parry", "damage"],
      });
    },
  };
}

function participantPairId(ownerParticipantId: string, targetParticipantId?: string): string {
  return targetParticipantId
    ? [ownerParticipantId, targetParticipantId].sort().join("::")
    : `${ownerParticipantId}::missing-target`;
}

function maneuverTask(input: {
  expectedCommand: CombatRoundCommandType;
  kind: CombatManeuverTaskDescriptor["kind"];
  opportunityId: string;
  ownerParticipantId?: string;
  ownerRole?: "gm" | "participant";
  pairId: string;
  proposalId: string;
}): CombatManeuverTaskDescriptor {
  return {
    expectedCommand: input.expectedCommand,
    kind: input.kind,
    opportunityId: input.opportunityId,
    ownerParticipantId: input.ownerParticipantId,
    ownerRole: input.ownerRole ?? "participant",
    pairId: input.pairId,
    phase: "phase1",
    proposalId: input.proposalId,
  };
}

function maneuverStage(input: {
  kind: CombatManeuverStageKind;
  processId: string;
  state: CombatActionProcessStageState;
  strategy?: CombatManeuverProcessStagePlan["executionStrategy"];
  task?: CombatManeuverTaskDescriptor;
  tasks?: readonly CombatManeuverTaskDescriptor[];
}): CombatManeuverProcessStagePlan {
  return {
    executionStrategy: input.strategy ?? "single_task",
    id: `${input.processId}:stage:${input.kind}`,
    kind: input.kind,
    state: input.state,
    task: input.task,
    tasks: input.tasks,
    trackerFacet: "attack",
  };
}

function buildFeintManeuver(input: {
  downstreamProcessIds: readonly string[];
  ownerParticipantId: string;
  state: CombatRoundState;
  targetParticipantId?: string;
}): CombatManeuverProcessPlan {
  const proposal = input.state.feintProposals.find(
    (entry) =>
      entry.roundNumber === input.state.roundNumber &&
      entry.attackerParticipantId === input.ownerParticipantId,
  );
  const proposalId =
    proposal?.id ??
    buildCombatFeintProposalId({
      attackerParticipantId: input.ownerParticipantId,
      roundNumber: input.state.roundNumber,
    });
  const targetParticipantId = proposal?.defenderParticipantId ?? input.targetParticipantId;
  const pairId =
    proposal?.pairId ?? participantPairId(input.ownerParticipantId, targetParticipantId);
  const opportunityId =
    proposal?.phase1OpportunityId ??
    `round:${input.state.roundNumber}:participant:${input.ownerParticipantId}:phase1:feint`;
  const processId = `round:${input.state.roundNumber}:action:${input.ownerParticipantId}:feint_attack:maneuver:${proposalId}`;
  const prerequisites: CombatActionProcessPrerequisite[] = [
    { kind: "proposal", satisfied: Boolean(proposal) },
    {
      kind: "target",
      satisfied: Boolean(
        targetParticipantId &&
        input.state.participants.some(
          (entry) =>
            entry.participantId === targetParticipantId ||
            entry.scenarioParticipantId === targetParticipantId ||
            entry.characterId === targetParticipantId,
        ),
      ),
    },
    {
      kind: "action_turn_open",
      satisfied: Boolean(
        proposal &&
        proposal.status !== "awaiting_action_turn" &&
        proposal.status !== "awaiting_feasibility",
      ),
    },
  ];
  const pending =
    proposal?.status === "awaiting_action_turn" || proposal?.status === "awaiting_feasibility";
  const complete = proposal?.status === "committed" || proposal?.status === "impossible";
  const attackerState: CombatActionProcessStageState = complete
    ? proposal?.attackerRoll
      ? "complete"
      : "skipped"
    : pending
      ? "pending"
      : proposal?.attackerRoll
        ? "complete"
        : "ready";
  const defenderState: CombatActionProcessStageState = complete
    ? proposal?.defenderRoll
      ? "complete"
      : "skipped"
    : pending || !proposal?.attackerRoll
      ? "pending"
      : proposal.defenderRoll
        ? "complete"
        : "ready";
  const reviewState: CombatActionProcessStageState = complete
    ? proposal?.review
      ? "complete"
      : "skipped"
    : proposal?.status === "awaiting_review"
      ? "complete"
      : "pending";
  const commitState: CombatActionProcessStageState = complete
    ? proposal?.status === "committed"
      ? "complete"
      : "skipped"
    : proposal?.status === "awaiting_review"
      ? "ready"
      : "pending";
  return {
    actionKind: "feint_attack",
    completion: {
      complete,
      reason:
        proposal?.status === "committed"
          ? "committed"
          : proposal?.status === "impossible"
            ? "impossible"
            : undefined,
    },
    downstreamProcessIds: input.downstreamProcessIds,
    id: processId,
    maneuverKind: "feint",
    metadata: { method: proposal?.method },
    ownerParticipantId: input.ownerParticipantId,
    pairId,
    phase: "phase1",
    prerequisites,
    proposalId,
    stages: [
      maneuverStage({
        kind: "attacker_roll",
        processId,
        state: attackerState,
        strategy: "ordered_all",
        task:
          attackerState === "ready"
            ? maneuverTask({
                expectedCommand: "roll_feint",
                kind: "feint_attacker_roll",
                opportunityId,
                ownerParticipantId: input.ownerParticipantId,
                pairId,
                proposalId,
              })
            : undefined,
      }),
      maneuverStage({
        kind: "defender_roll",
        processId,
        state: defenderState,
        strategy: "ordered_all",
        task:
          defenderState === "ready"
            ? maneuverTask({
                expectedCommand: "roll_feint",
                kind: "feint_defender_roll",
                opportunityId,
                ownerParticipantId: targetParticipantId,
                pairId,
                proposalId,
              })
            : undefined,
      }),
      maneuverStage({
        kind: "proposal_review",
        processId,
        state: reviewState,
        strategy: "gm_review",
      }),
      maneuverStage({
        kind: "proposal_commit",
        processId,
        state: commitState,
        strategy: "gm_review",
        task:
          commitState === "ready"
            ? maneuverTask({
                expectedCommand: "commit_feint_result",
                kind: "feint_commit",
                opportunityId,
                ownerRole: "gm",
                pairId,
                proposalId,
              })
            : undefined,
      }),
    ],
    targetParticipantId,
  };
}

function buildAdjustDistanceManeuver(input: {
  downstreamProcessIds: readonly string[];
  ownerParticipantId: string;
  state: CombatRoundState;
  targetParticipantId?: string;
}): CombatManeuverProcessPlan {
  const proposal = input.state.adjustDistanceProposals.find(
    (entry) =>
      entry.roundNumber === input.state.roundNumber &&
      entry.attackerParticipantId === input.ownerParticipantId,
  );
  const proposalId =
    proposal?.id ??
    buildCombatAdjustDistanceProposalId({
      attackerParticipantId: input.ownerParticipantId,
      roundNumber: input.state.roundNumber,
    });
  const targetParticipantId = proposal?.defenderParticipantId ?? input.targetParticipantId;
  const pairId =
    proposal?.pairId ?? participantPairId(input.ownerParticipantId, targetParticipantId);
  const opportunityId =
    proposal?.phase1OpportunityId ??
    `round:${input.state.roundNumber}:participant:${input.ownerParticipantId}:phase1:adjust-distance`;
  const processId = `round:${input.state.roundNumber}:action:${input.ownerParticipantId}:adjust_distance_attack:maneuver:${proposalId}`;
  const prerequisites: CombatActionProcessPrerequisite[] = [
    { kind: "proposal", satisfied: Boolean(proposal) },
    {
      kind: "target",
      satisfied: Boolean(
        targetParticipantId &&
        input.state.participants.some(
          (entry) =>
            entry.participantId === targetParticipantId ||
            entry.scenarioParticipantId === targetParticipantId ||
            entry.characterId === targetParticipantId,
        ),
      ),
    },
    {
      kind: "action_turn_open",
      satisfied: Boolean(proposal && proposal.status !== "awaiting_action_turn"),
    },
  ];
  const locked = proposal?.status === "awaiting_action_turn";
  const complete = proposal?.status === "committed";
  const allowed = proposal?.defenderResponse === "allow";
  const responseState: CombatActionProcessStageState =
    complete || (proposal && proposal.defenderResponse !== "pending")
      ? "complete"
      : locked
        ? "pending"
        : "ready";
  const adjustmentState: CombatActionProcessStageState = allowed
    ? "skipped"
    : complete || proposal?.gmRollAdjustment
      ? "complete"
      : proposal?.status === "awaiting_gm_adjustment"
        ? "ready"
        : "pending";
  const opposedRollsState: CombatActionProcessStageState = allowed
    ? "skipped"
    : complete || (proposal?.attackerRoll && proposal.defenderRoll)
      ? "complete"
      : proposal?.status === "awaiting_rolls"
        ? "ready"
        : "pending";
  const reviewState: CombatActionProcessStageState =
    complete || proposal?.status === "awaiting_review" ? "complete" : "pending";
  const commitState: CombatActionProcessStageState = complete
    ? "complete"
    : proposal?.status === "awaiting_review"
      ? "ready"
      : "pending";
  return {
    actionKind: "adjust_distance_attack",
    completion: {
      complete,
      reason: complete
        ? proposal?.review?.acceptedOutcome === "allowed"
          ? "allowed"
          : proposal?.review?.acceptedOutcome
        : undefined,
    },
    downstreamProcessIds: input.downstreamProcessIds,
    id: processId,
    maneuverKind: "adjust_distance",
    metadata: {
      defenderResponse: proposal?.defenderResponse,
      direction: proposal?.direction,
    },
    ownerParticipantId: input.ownerParticipantId,
    pairId,
    phase: "phase1",
    prerequisites,
    proposalId,
    stages: [
      maneuverStage({
        kind: "participant_response",
        processId,
        state: responseState,
        task:
          responseState === "ready"
            ? maneuverTask({
                expectedCommand: "respond_adjust_distance",
                kind: "adjust_distance_response",
                opportunityId,
                ownerParticipantId: targetParticipantId,
                pairId,
                proposalId,
              })
            : undefined,
      }),
      maneuverStage({
        kind: "gm_adjustment",
        processId,
        state: adjustmentState,
        strategy: "gm_review",
        task:
          adjustmentState === "ready"
            ? maneuverTask({
                expectedCommand: "review_adjust_distance_roll_adjustment",
                kind: "adjust_distance_adjustment",
                opportunityId,
                ownerRole: "gm",
                pairId,
                proposalId,
              })
            : undefined,
      }),
      maneuverStage({
        kind: "opposed_rolls",
        processId,
        state: opposedRollsState,
        strategy: "parallel_all",
        tasks:
          opposedRollsState === "ready"
            ? [
                !proposal?.attackerRoll
                  ? maneuverTask({
                      expectedCommand: "roll_adjust_distance",
                      kind: "adjust_distance_attacker_roll",
                      opportunityId,
                      ownerParticipantId: input.ownerParticipantId,
                      pairId,
                      proposalId,
                    })
                  : undefined,
                !proposal?.defenderRoll
                  ? maneuverTask({
                      expectedCommand: "roll_adjust_distance",
                      kind: "adjust_distance_defender_roll",
                      opportunityId,
                      ownerParticipantId: targetParticipantId,
                      pairId,
                      proposalId,
                    })
                  : undefined,
              ].filter((task): task is CombatManeuverTaskDescriptor => Boolean(task))
            : [],
      }),
      maneuverStage({
        kind: "proposal_review",
        processId,
        state: reviewState,
        strategy: "gm_review",
      }),
      maneuverStage({
        kind: "proposal_commit",
        processId,
        state: commitState,
        strategy: "gm_review",
        task:
          commitState === "ready"
            ? maneuverTask({
                expectedCommand: "commit_adjust_distance",
                kind: "adjust_distance_commit",
                opportunityId,
                ownerRole: "gm",
                pairId,
                proposalId,
              })
            : undefined,
      }),
    ],
    targetParticipantId,
  };
}

function buildManeuverAdapter(input: {
  actionKind: "adjust_distance_attack" | "feint_attack";
  declarationActionId: "adjust_range_attack" | "feint_attack";
  maneuverKind: CombatManeuverKind;
}): CombatActionProcessAdapter {
  return {
    actionKind: input.actionKind,
    declarationActionId: input.declarationActionId,
    buildProcessPlan(context) {
      const participant = context.state.participants.find(
        (entry) => entry.participantId === context.participantId,
      );
      if (participant?.declaration?.actionId !== input.declarationActionId) {
        throw new RangeError(
          `${input.actionKind} adapter requires a ${input.declarationActionId} declaration.`,
        );
      }
      const allOpportunities = (
        context.attackOpportunities ??
        buildCombatRoundDeclaredAttackOpportunities({
          actionId: participant.declaration.actionId,
          participantId: context.participantId,
          phaseContexts: participant.declaration.phaseContexts,
          roundNumber: context.state.roundNumber,
          secondaryActionId: participant.declaration.secondaryActionId,
        }).map((opportunity) => ({ ...opportunity, participantId: context.participantId }))
      ).filter((entry) => entry.participantId === context.participantId);
      const opportunity = allOpportunities.find((entry) => entry.phase === "phase2");
      const targetParticipantId =
        input.maneuverKind === "feint"
          ? participant.declaration.feint?.targetParticipantId
          : participant.declaration.adjustDistance?.targetParticipantId;
      const maneuverComplete =
        input.maneuverKind === "feint"
          ? context.state.feintProposals.some(
              (proposal) =>
                proposal.roundNumber === context.state.roundNumber &&
                proposal.attackerParticipantId === context.participantId &&
                (proposal.status === "committed" || proposal.status === "impossible"),
            )
          : context.state.adjustDistanceProposals.some(
              (proposal) =>
                proposal.roundNumber === context.state.roundNumber &&
                proposal.attackerParticipantId === context.participantId &&
                proposal.status === "committed",
            );
      const standardAttacks = opportunity
        ? [
            buildStandardAttackProcess({
              actionKind: input.actionKind,
              opportunity,
              ownerParticipantId: context.participantId,
              prerequisites: [
                { kind: "attack_opportunity", satisfied: opportunity.status === "committed" },
                {
                  kind: "target",
                  satisfied: Boolean(
                    opportunity.targetParticipantId &&
                    context.state.participants.some(
                      (entry) =>
                        entry.participantId === opportunity.targetParticipantId ||
                        entry.scenarioParticipantId === opportunity.targetParticipantId ||
                        entry.characterId === opportunity.targetParticipantId,
                    ),
                  ),
                },
                { kind: "maneuver_complete", satisfied: maneuverComplete },
              ],
              state: context.state,
            }),
          ]
        : [];
      const downstreamProcessIds = standardAttacks.map((attack) => attack.id);
      const maneuver =
        input.maneuverKind === "feint"
          ? buildFeintManeuver({
              downstreamProcessIds,
              ownerParticipantId: context.participantId,
              state: context.state,
              targetParticipantId,
            })
          : buildAdjustDistanceManeuver({
              downstreamProcessIds,
              ownerParticipantId: context.participantId,
              state: context.state,
              targetParticipantId,
            });
      return deepFreeze({
        actionKind: input.actionKind,
        completion: {
          complete: Boolean(
            maneuver.completion.complete && standardAttacks[0]?.completion.complete,
          ),
        },
        id: `round:${context.state.roundNumber}:action:${context.participantId}:${input.actionKind}`,
        maneuver,
        ownerParticipantId: context.participantId,
        prerequisites: [
          ...maneuver.prerequisites,
          ...standardAttacks.flatMap((attack) => attack.prerequisites),
        ],
        standardAttacks,
        trackerFacets: ["attack", "parry", "damage"],
      });
    },
  };
}

export const combatActionProcessAdapters: readonly CombatActionProcessAdapter[] = [
  buildStandardAdapter({ actionKind: "single_attack", declarationActionId: "attack_parry" }),
  buildStandardAdapter({ actionKind: "reactive_attack", declarationActionId: "parry_attack" }),
  buildStandardAdapter({ actionKind: "double_attack", declarationActionId: "double_attack" }),
  buildManeuverAdapter({
    actionKind: "feint_attack",
    declarationActionId: "feint_attack",
    maneuverKind: "feint",
  }),
  buildManeuverAdapter({
    actionKind: "adjust_distance_attack",
    declarationActionId: "adjust_range_attack",
    maneuverKind: "adjust_distance",
  }),
];

/** Builds each migrated action plan once for one normalized encounter revision. */
export function buildCombatActionProcessPlans(
  state: CombatRoundState,
): readonly CombatActionProcessPlan[] {
  const normalized = parseCombatRoundState(state);
  const attackOpportunities = normalized.participants.flatMap((participant) => {
    const declaration = participant.declaration;
    if (!declaration) return [];
    const compatibility = validateCombatDeclarationCompatibility({
      movementKind: declaration.movementIntent?.mode,
      primaryAction: declaration.actionId,
      secondaryAction: declaration.secondaryActionId,
    });
    if (!compatibility.valid) return [];
    const opportunities =
      (declaration.attackOpportunities?.length ?? 0) > 0
        ? (declaration.attackOpportunities ?? [])
        : buildCombatRoundDeclaredAttackOpportunities({
            actionId: declaration.actionId,
            participantId: participant.participantId,
            phaseContexts: declaration.phaseContexts,
            roundNumber: normalized.roundNumber,
            secondaryActionId: declaration.secondaryActionId,
          });
    return opportunities.map((opportunity) => ({
      ...opportunity,
      participantId: participant.participantId,
    }));
  });
  const adapterByActionId = new Map<string, CombatActionProcessAdapter>(
    combatActionProcessAdapters.map((adapter) => [adapter.declarationActionId, adapter]),
  );
  return deepFreeze(
    normalized.participants.flatMap((participant) => {
      const declaration = participant.declaration;
      const compatibility = validateCombatDeclarationCompatibility({
        movementKind: declaration?.movementIntent?.mode,
        primaryAction: declaration?.actionId,
        secondaryAction: declaration?.secondaryActionId,
      });
      if (!compatibility.valid) return [];
      const actionId = declaration?.actionId;
      const adapter = actionId ? adapterByActionId.get(actionId) : undefined;
      return adapter
        ? [
            adapter.buildProcessPlan({
              attackOpportunities,
              participantId: participant.participantId,
              state: normalized,
            }),
          ]
        : [];
    }),
  );
}
