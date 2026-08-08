import type { CombatParticipationOwnership } from "../combatParticipation";
import type {
  CombatProgressionTaskKind,
  CombatProgressionTaskPresentationContext,
} from "../combatProgressionProjection/types";
import {
  CANONICAL_COMBAT_AUTOMATION_ELIGIBILITY_SCHEMA_VERSION,
  combatAutomationEligibilityFactSchema,
  type CombatAutomationAuthority,
  type CombatAutomationEligibilityFact,
  type CombatAutomationReason,
  type PlayerSafeCombatAutomationEligibilityFact,
} from "./types";

export interface CombatAutomationParticipationInput {
  readonly completeness: "complete" | "partial" | "legacy_incomplete" | "unsupported";
  readonly factId: string;
  readonly ordering:
    | "none"
    | "participant_sequence"
    | "initiative_order"
    | "initiative_group"
    | "pair_order"
    | "ownerless_boundary";
  readonly ownership: CombatParticipationOwnership;
  readonly reason: string;
  readonly status: "required" | "conditional" | "not_required" | "blocked" | "already_resolved";
  readonly workClass:
    | "human_decision"
    | "player_roll"
    | "gm_roll"
    | "deterministic_transition"
    | "no_work";
}

export interface CombatAutomationTaskInput {
  readonly blockerCount: number;
  readonly expectedCommand: string;
  readonly identity: {
    readonly attackResultId?: string;
    readonly contestId?: string;
    readonly continuedContactId?: string;
    readonly criticalResultId?: string;
    readonly damageRollExpression?: string;
    readonly defenderParticipantId?: string;
    readonly healthRollId?: string;
    readonly hitLocationResultId?: string;
    readonly observationAttemptId?: string;
    readonly opponentParticipantId?: string;
    readonly opportunityId?: string;
    readonly pairId?: string;
    readonly parrySourceId?: string;
    readonly participantId?: string;
    readonly phase?: "phase1" | "phase2";
    readonly proposalId?: string;
    readonly relationshipId?: string;
  };
  readonly kind: CombatProgressionTaskKind;
  readonly ownerParticipantId?: string;
  readonly presentationContext?: CombatProgressionTaskPresentationContext;
  readonly state: "executable" | "waiting";
  readonly taskId: string;
}

const PURE_ROLL_KINDS = new Set<CombatProgressionTaskKind>([
  "adjust_distance_attacker_roll",
  "adjust_distance_defender_roll",
  "attack",
  "combat_experience",
  "continued_contact_maintenance_roll",
  "critical",
  "damage_roll",
  "distance_roll",
  "feint_attacker_roll",
  "feint_defender_roll",
  "health_review",
  "hit_location",
  "observation_roll",
  "offensive_parry_brawling_roll",
  "parry",
  "roll_initiative",
]);

function freeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  return value;
}

function authorityFor(
  ownership: CombatParticipationOwnership | undefined,
  participantId: string | undefined,
): CombatAutomationAuthority {
  if (!ownership) return { kind: "unknown", participantId };
  switch (ownership.kind) {
    case "player_owned":
      return { kind: "player", participantId: ownership.participantId ?? participantId };
    case "gm_proxy":
      return {
        kind: "gm_proxy",
        participantId: ownership.participantId ?? participantId,
        proxyUserId: ownership.proxyUserId,
      };
    case "gm_controlled_participant":
      return {
        kind: "gm_controlled_participant",
        participantId: ownership.participantId ?? participantId,
      };
    case "gm_owned":
      return { kind: "gm", participantId: ownership.participantId ?? participantId };
    case "ownerless":
      return { kind: "ownerless" };
    case "shared_pair": {
      const role = ownership.roles?.find((candidate) => candidate.participantId === participantId);
      if (role?.authority === "player") return { kind: "player", participantId };
      if (role?.authority === "gm") return { kind: "gm_controlled_participant", participantId };
      return { kind: "shared_pair", participantId };
    }
    case "unknown":
      return { kind: "unknown", participantId: ownership.participantId ?? participantId };
  }
}

function humanDecisionReason(task: CombatAutomationTaskInput): CombatAutomationReason {
  if (task.kind === "modifier_review") return "gm_modifier_pending";
  if (task.kind === "effect_review" || task.kind === "participant_review") {
    return "effect_review_pending";
  }
  if (task.kind === "damage_review") return "damage_review_pending";
  if (task.kind === "double_attack_decision") return "double_attack_choice";
  if (task.kind === "adjust_distance_response") return "continue_backout_choice";
  if (task.kind === "combat_experience" && task.expectedCommand !== "roll_combat_experience") {
    return "continue_backout_choice";
  }
  if (task.kind === "parry") return "response_choice";
  return "human_decision_required";
}

function missingPureRollFact(task: CombatAutomationTaskInput): CombatAutomationReason | undefined {
  switch (task.kind) {
    case "attack":
      if (!task.identity.opponentParticipantId) return "multiple_targets";
      if (!task.identity.opportunityId) return "multiple_weapons";
      return undefined;
    case "parry":
      if (!task.identity.attackResultId) return "relationship_ambiguity";
      if (!task.identity.parrySourceId || task.identity.parrySourceId === "auto") {
        return "multiple_parry_sources";
      }
      return undefined;
    case "roll_initiative":
      return task.identity.phase ? undefined : "incomplete_canonical_facts";
    case "feint_attacker_roll":
    case "feint_defender_roll":
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
      return task.identity.proposalId && task.identity.opponentParticipantId
        ? undefined
        : "relationship_ambiguity";
    case "continued_contact_maintenance_roll":
      return task.identity.contestId &&
        task.identity.continuedContactId &&
        task.identity.opponentParticipantId
        ? undefined
        : "relationship_ambiguity";
    case "distance_roll":
      return task.identity.proposalId && task.identity.pairId
        ? undefined
        : "relationship_ambiguity";
    case "observation_roll":
      return task.identity.observationAttemptId &&
        task.identity.opponentParticipantId &&
        task.identity.relationshipId
        ? undefined
        : "relationship_ambiguity";
    case "health_review":
      return task.identity.healthRollId ? undefined : "incomplete_canonical_facts";
    case "offensive_parry_brawling_roll":
      return task.identity.contestId && task.identity.opponentParticipantId
        ? undefined
        : "relationship_ambiguity";
    case "hit_location":
      return task.identity.attackResultId && task.identity.hitLocationResultId
        ? undefined
        : "incomplete_canonical_facts";
    case "critical":
      return task.identity.attackResultId && task.identity.criticalResultId
        ? undefined
        : "incomplete_canonical_facts";
    case "damage_roll":
      return task.identity.attackResultId && task.identity.damageRollExpression
        ? undefined
        : "incomplete_canonical_facts";
    default:
      return undefined;
  }
}

function processWarnings(task: CombatAutomationTaskInput): CombatAutomationReason[] {
  if (
    task.kind === "feint_attacker_roll" ||
    task.kind === "feint_defender_roll" ||
    task.kind === "adjust_distance_attacker_roll" ||
    task.kind === "adjust_distance_defender_roll"
  ) {
    return ["ordered_maneuver"];
  }
  return [];
}

/**
 * Classifies one already-projected canonical task. It never selects inputs or changes progression.
 * Missing or incomplete participation is deliberately conservative.
 */
export function projectCombatTaskAutomationEligibility(input: {
  readonly participation?: CombatAutomationParticipationInput;
  readonly task: CombatAutomationTaskInput;
}): CombatAutomationEligibilityFact {
  const { participation, task } = input;
  const authority = authorityFor(participation?.ownership, task.ownerParticipantId);
  const base = {
    authority,
    participationFactId: participation?.factId,
    schemaVersion: CANONICAL_COMBAT_AUTOMATION_ELIGIBILITY_SCHEMA_VERSION,
    taskId: task.taskId,
  } as const;
  const result = (fact: Omit<CombatAutomationEligibilityFact, keyof typeof base>) =>
    freeze(combatAutomationEligibilityFactSchema.parse({ ...base, ...fact }));

  if (!participation) {
    return result({
      eligibility: "unsupported",
      stopReason: "legacy_state",
      warnings: [],
      workClass: "not_applicable",
    });
  }
  if (participation.completeness !== "complete") {
    return result({
      eligibility: "unsupported",
      stopReason:
        participation.completeness === "legacy_incomplete"
          ? "legacy_state"
          : participation.completeness === "unsupported"
            ? "unsupported_process"
            : "incomplete_canonical_facts",
      warnings: [],
      workClass:
        participation.workClass === "player_roll"
          ? "player_roll"
          : participation.workClass === "gm_roll"
            ? "gm_roll"
            : "not_applicable",
    });
  }
  if (participation.status === "blocked") {
    return result({
      eligibility: "blocked",
      stopReason:
        participation.reason === "stale_or_invalid_source"
          ? "stale_revision"
          : "incomplete_canonical_facts",
      warnings: [],
      workClass: participation.workClass === "gm_roll" ? "gm_roll" : "human_decision",
    });
  }
  if (task.state !== "executable" || task.blockerCount > 0) {
    return result({
      eligibility: "blocked",
      stopReason: "task_not_executable",
      warnings: [],
      workClass:
        participation.workClass === "player_roll"
          ? "player_roll"
          : participation.workClass === "gm_roll"
            ? "gm_roll"
            : participation.workClass === "human_decision"
              ? "human_decision"
              : "not_applicable",
    });
  }
  if (participation.workClass === "deterministic_transition") {
    return result({
      eligibility: "not_allowed",
      stopReason: "deterministic_already_handled",
      warnings: [],
      workClass: authority.kind === "ownerless" ? "not_applicable" : "deterministic",
    });
  }
  if (
    participation.workClass === "human_decision" ||
    !PURE_ROLL_KINDS.has(task.kind) ||
    (task.kind === "combat_experience" && task.expectedCommand !== "roll_combat_experience")
  ) {
    return result({
      eligibility: "not_allowed",
      stopReason: humanDecisionReason(task),
      warnings: [],
      workClass: "human_decision",
    });
  }

  const missing = missingPureRollFact(task);
  if (missing) {
    return result({
      eligibility: "blocked",
      stopReason: missing,
      warnings: [],
      workClass: participation.workClass === "player_roll" ? "player_roll" : "gm_roll",
    });
  }
  if (authority.kind === "player") {
    return result({
      eligibility: "not_allowed",
      stopReason: "player_owned",
      warnings: ["proxy_required"],
      workClass: "player_roll",
    });
  }
  if (authority.kind === "unknown" || authority.kind === "shared_pair") {
    return result({
      eligibility: "unsupported",
      stopReason: "relationship_ambiguity",
      warnings: [],
      workClass: participation.workClass === "player_roll" ? "player_roll" : "gm_roll",
    });
  }

  const warnings = processWarnings(task);
  if (authority.kind === "gm_proxy") warnings.unshift("gm_proxy_authority");
  return result({
    eligibility: warnings.length > 0 ? "requires_warning" : "eligible",
    stopReason: warnings[0],
    warnings,
    workClass: "gm_roll",
  });
}

/** Removes proxy identity and suppresses another participant's automation authority and reasons. */
export function projectPlayerSafeCombatAutomationEligibility(input: {
  readonly controlledParticipantIds: ReadonlySet<string>;
  readonly fact: CombatAutomationEligibilityFact;
}): PlayerSafeCombatAutomationEligibilityFact {
  const participantId = input.fact.authority.participantId;
  if (participantId && input.controlledParticipantIds.has(participantId)) {
    return freeze({
      ...input.fact,
      authority: { kind: input.fact.authority.kind, participantId },
    });
  }
  return freeze({
    authority: { kind: "unknown" },
    eligibility: "unsupported",
    schemaVersion: input.fact.schemaVersion,
    taskId: input.fact.taskId,
    warnings: [],
    workClass: "not_applicable",
  });
}
