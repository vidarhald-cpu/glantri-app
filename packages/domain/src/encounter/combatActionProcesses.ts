import {
  combatRoundStateSchema,
  buildCombatRoundDeclaredAttackOpportunities,
  getCombatRoundAttackResultId,
  getCombatRoundDamageSubstate,
  getCombatRoundDoubleAttackPhase2Decision,
  type CombatRoundAttackOpportunity,
  type CombatRoundCommandType,
  type CombatRoundPhase,
  type CombatRoundState,
} from "./combatRoundManager";

export const COMBAT_ACTION_PROCESS_ACTION_KINDS = [
  "single_attack",
  "reactive_attack",
  "double_attack",
] as const;

export type CombatActionProcessActionKind = (typeof COMBAT_ACTION_PROCESS_ACTION_KINDS)[number];

export type CombatActionProcessStageKind =
  | "attack"
  | "defense"
  | "hit_location"
  | "damage"
  | "critical"
  | "commit";

export type CombatActionProcessStageState = "complete" | "pending" | "ready" | "skipped";

export interface CombatActionProcessPrerequisite {
  readonly kind: "attack_opportunity" | "double_attack_continued" | "reactive_trigger" | "target";
  readonly satisfied: boolean;
}

export interface CombatActionProcessTaskDescriptor {
  readonly attackResultId?: string;
  readonly expectedCommand: CombatRoundCommandType;
  readonly opportunityId: string;
  readonly owner: "attacker" | "defender" | "gm";
  readonly phase: CombatRoundPhase;
}

export interface CombatActionProcessStage {
  readonly id: string;
  readonly kind: CombatActionProcessStageKind;
  readonly state: CombatActionProcessStageState;
  readonly task?: CombatActionProcessTaskDescriptor;
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
  readonly declarationActionId: "attack_parry" | "double_attack" | "parry_attack";
  buildProcessPlan(context: CombatActionProcessContext): CombatActionProcessPlan;
}

const STAGE_ORDER: readonly CombatActionProcessStageKind[] = [
  "attack",
  "defense",
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
  return "damage";
}

function taskForStage(input: {
  attackResultId?: string;
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
      return { ...shared, expectedCommand: "roll_parry", owner: "defender" };
    case "hit_location":
      return { ...shared, expectedCommand: "roll_hit_location", owner: "attacker" };
    case "damage":
      return { ...shared, expectedCommand: "resolve_damage", owner: "gm" };
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

  const attack = input.state.participants.find(
    (participant) => participant.participantId === input.ownerParticipantId,
  )?.attackResults[input.opportunity.phase];
  if (!attack) {
    pending.attack = "ready";
    return { completion: { complete: false }, states: pending };
  }
  pending.attack = "complete";
  if (!attack.hit) {
    for (const kind of STAGE_ORDER.slice(1)) pending[kind] = "skipped";
    return { completion: { complete: true, reason: "miss" }, states: pending };
  }

  const attackResultId = getCombatRoundAttackResultId({
    result: attack,
    roundNumber: input.state.roundNumber,
  });
  const resolution = input.state.phaseResolutionResults.find(
    (entry) => entry.attackResultId === attackResultId,
  );
  if (!resolution || resolution.parryResolution.status === "pending") {
    pending.defense = "ready";
    return { completion: { complete: false }, states: pending };
  }
  pending.defense = "complete";
  if (resolution.parryResolution.status === "resolved" && resolution.parryResolution.success) {
    for (const kind of STAGE_ORDER.slice(2)) pending[kind] = "skipped";
    return { completion: { complete: true, reason: "parried" }, states: pending };
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
  const attack = input.state.participants.find(
    (participant) => participant.participantId === input.ownerParticipantId,
  )?.attackResults[input.opportunity.phase];
  const attackResultId = attack
    ? getCombatRoundAttackResultId({ result: attack, roundNumber: input.state.roundNumber })
    : undefined;
  const processId = `round:${input.state.roundNumber}:action:${input.ownerParticipantId}:${input.actionKind}:attack:${input.opportunity.id}`;
  const { completion, states } = stageStates({
    opportunity: input.opportunity,
    ownerParticipantId: input.ownerParticipantId,
    prerequisitesSatisfied: input.prerequisites
      .filter(
        (entry) => entry.kind === "double_attack_continued" || entry.kind === "reactive_trigger",
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
    stages: STAGE_ORDER.map((kind) => ({
      id: `${processId}:stage:${kind}`,
      kind,
      state: states[kind],
      task:
        states[kind] === "ready"
          ? taskForStage({
              attackResultId,
              kind,
              opportunityId: input.opportunity.id,
              phase: input.opportunity.phase,
            })
          : undefined,
      trackerFacet: stageTrackerFacet(kind),
    })),
    targetParticipantId: input.opportunity.targetParticipantId,
  };
}

function buildAdapter(input: {
  actionKind: CombatActionProcessActionKind;
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
      const firstAttackComplete = Boolean(participant.attackResults.phase1);
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
            .flatMap((entry) => entry.attackResults.phase1 ?? [])
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

export const combatActionProcessAdapters: readonly CombatActionProcessAdapter[] = [
  buildAdapter({ actionKind: "single_attack", declarationActionId: "attack_parry" }),
  buildAdapter({ actionKind: "reactive_attack", declarationActionId: "parry_attack" }),
  buildAdapter({ actionKind: "double_attack", declarationActionId: "double_attack" }),
];

/** Builds each migrated action plan once for one normalized encounter revision. */
export function buildCombatActionProcessPlans(
  state: CombatRoundState,
): readonly CombatActionProcessPlan[] {
  const normalized = combatRoundStateSchema.parse(state);
  const attackOpportunities = normalized.participants.flatMap((participant) => {
    const declaration = participant.declaration;
    if (!declaration) return [];
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
      const actionId = participant.declaration?.actionId;
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
