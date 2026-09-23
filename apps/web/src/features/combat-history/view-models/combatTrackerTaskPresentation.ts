import type {
  CombatProgressionBoundaryKind,
  CombatProgressionPresentationTask,
  CombatProgressionTaskKind,
} from "@glantri/domain";

import type {
  CombatTrackerAttention,
  CombatTrackerFacetStatus,
  CombatTrackerHoverPresentation,
  CombatTrackerLiveFacet,
  CombatTrackerMarkerKind,
} from "../types";

const BOUNDARY_LABELS: Record<CombatProgressionBoundaryKind, string> = {
  declaration: "declarations",
  phase1_modifier_review: "Phase 1 modifier review",
  phase1_initiative: "Phase 1 initiative",
  phase1_resolution: "Phase 1 resolution",
  phase2_modifier_review: "Phase 2 modifier review",
  phase2_initiative: "Phase 2 initiative",
  phase2_resolution: "Phase 2 resolution",
  round_end: "round end",
  round_boundary: "the next round",
};

/**
 * Presentation-only attention policy. It is exhaustive so a new progression task cannot silently
 * inherit question-mark semantics merely by becoming current.
 */
export function classifyCombatTrackerTaskAttention(
  task: Pick<CombatProgressionPresentationTask, "kind">,
): CombatTrackerAttention {
  switch (task.kind) {
    case "attack":
    case "missile_readiness":
    case "commit_initiative":
    case "effect_review":
    case "gm_advance_boundary":
    case "modifier_review":
    case "participant_review":
    case "roll_initiative":
    case "round_end_prepare":
    case "submit_declaration":
      return "ordinary";
    case "adjust_distance_adjustment":
    case "adjust_distance_attacker_roll":
    case "adjust_distance_commit":
    case "adjust_distance_defender_roll":
    case "adjust_distance_response":
    case "break_off_review":
    case "break_off_escapee_roll":
    case "break_off_attacker_roll":
    case "break_off_commit":
    case "disarm_actor_roll":
    case "disarm_holder_roll":
    case "disarm_commit":
    case "combat_experience":
    case "continued_contact_maintenance_roll":
    case "critical":
    case "damage_roll":
    case "damage_review":
    case "defense_review":
    case "distance_commit":
    case "distance_roll":
    case "double_attack_decision":
    case "feint_attacker_roll":
    case "feint_commit":
    case "feint_defender_roll":
    case "health_review":
    case "hit_location":
    case "offensive_parry_brawling_roll":
    case "observation_roll":
    case "parry":
    case "combat_task_advance":
    case "combat_task_resolve":
    case "combat_task_review":
    case "combat_task_roll":
      return "exceptional";
    default: {
      const exhaustive: never = task.kind;
      return exhaustive;
    }
  }
}

function phaseLabel(task: CombatProgressionPresentationTask): string | undefined {
  return task.identity.phase === "phase1"
    ? "Phase 1"
    : task.identity.phase === "phase2"
      ? "Phase 2"
      : undefined;
}

function combatantLabel(
  identity: CombatProgressionPresentationTask["owner"] | undefined,
): string | undefined {
  return identity?.kind === "combatant" ? identity.label : undefined;
}

function actionLabel(kind: CombatProgressionTaskKind): string {
  switch (kind) {
    case "submit_declaration":
      return "Declaration";
    case "combat_experience":
      return "Combat Experience";
    case "modifier_review":
      return "Modifier review";
    case "roll_initiative":
    case "commit_initiative":
      return "Initiative";
    case "attack":
      return "Attack";
    case "missile_readiness":
      return "Missile preparation";
    case "break_off_review":
    case "break_off_escapee_roll":
    case "break_off_attacker_roll":
    case "break_off_commit":
      return "Break Off";
    case "disarm_actor_roll":
    case "disarm_holder_roll":
    case "disarm_commit":
      return "Disarm";
    case "parry":
      return "Parry";
    case "offensive_parry_brawling_roll":
      return "Offensive Parry";
    case "continued_contact_maintenance_roll":
      return "Continued Contact";
    case "observation_roll":
      return "Observe Opponent";
    case "hit_location":
      return "Hit location";
    case "critical":
      return "Critical";
    case "damage_roll":
      return "Graze damage";
    case "damage_review":
      return "Damage review";
    case "defense_review":
      return "Defense review";
    case "double_attack_decision":
      return "Double Attack";
    case "feint_attacker_roll":
    case "feint_defender_roll":
    case "feint_commit":
      return "Feint";
    case "adjust_distance_response":
    case "adjust_distance_adjustment":
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
    case "adjust_distance_commit":
      return "Adjust Distance";
    case "distance_roll":
    case "distance_commit":
      return "Distance control";
    case "health_review":
      return "Health check";
    case "participant_review":
      return "Participant review";
    case "effect_review":
      return "Effect review";
    case "round_end_prepare":
      return "Round end";
    case "gm_advance_boundary":
      return "Round progression";
    case "combat_task_advance":
    case "combat_task_resolve":
    case "combat_task_review":
    case "combat_task_roll":
      return "Perform Task";
  }
}

function gmText(task: CombatProgressionPresentationTask, owner: string | undefined): string {
  switch (task.kind) {
    case "combat_experience":
      return "Awaiting GM: Open Combat Experience.";
    case "commit_initiative":
      return `Awaiting GM: Commit ${phaseLabel(task) ?? "phase"} initiative.`;
    case "modifier_review":
      return `Awaiting GM: Review ${phaseLabel(task) ?? "phase"} modifiers${owner ? ` for ${owner}` : ""}.`;
    case "feint_commit":
      return `Awaiting GM: Review Feint${owner ? ` for ${owner}` : ""}.`;
    case "break_off_review":
      return `Awaiting GM: Review Break Off${owner ? ` for ${owner}` : ""}.`;
    case "break_off_commit":
      return `Awaiting GM: Commit Break Off${owner ? ` for ${owner}` : ""}.`;
    case "disarm_commit":
      return `Awaiting GM: Commit Disarm${owner ? ` for ${owner}` : ""}.`;
    case "adjust_distance_adjustment":
      return `Awaiting GM: Enter the Adjust Distance roll adjustment${owner ? ` for ${owner}` : ""}.`;
    case "adjust_distance_commit":
      return `Awaiting GM: Review Adjust Distance${owner ? ` for ${owner}` : ""}.`;
    case "distance_commit":
      return `Awaiting GM: Review distance control${owner ? ` for ${owner}` : ""}.`;
    case "damage_review":
      return `Awaiting GM: Review damage${owner ? ` for ${owner}` : ""}.`;
    case "defense_review":
      return `Awaiting GM: Review awareness and defense sources${owner ? ` for ${owner}` : ""}.`;
    case "effect_review":
      return `Awaiting GM: Review round-end effects${owner ? ` for ${owner}` : ""}.`;
    case "participant_review":
      return `Awaiting GM: Review ${owner ?? "the participant"}.`;
    case "round_end_prepare":
      return "Awaiting GM: Prepare round end.";
    case "combat_task_review":
      return `Awaiting GM: Review the declared task${owner ? ` for ${owner}` : ""}.`;
    case "combat_task_resolve":
      return `Awaiting GM: Resolve the task${owner ? ` for ${owner}` : ""}.`;
    case "gm_advance_boundary":
      if (
        task.transition?.currentBoundary === "round_boundary" ||
        task.transition?.targetBoundary === "declaration"
      ) {
        return "Awaiting GM: Start next round.";
      }
      return `Awaiting GM: Open ${task.transition ? BOUNDARY_LABELS[task.transition.targetBoundary] : "the next combat boundary"}.`;
    default:
      return "Awaiting GM action before combat can continue.";
  }
}

/** Builds safe live hover context from the sanitized projected task only. */
export function buildCombatTrackerTaskHover(
  task: CombatProgressionPresentationTask,
): CombatTrackerHoverPresentation {
  const owner = combatantLabel(task.owner);
  const facetOwner = task.trackerFacet.owner?.label;
  const opponent = task.opponent?.label;
  const gmActionRequired = task.actorAccess.gm && !task.actorAccess.combatant;
  const requiredActorLabel = gmActionRequired ? "Game Master" : owner;
  const phase = phaseLabel(task);
  const action =
    task.kind === "parry" && task.identity.parryPurpose === "offensive_parry"
      ? "Offensive Parry"
      : actionLabel(task.kind);
  let text: string;

  if (gmActionRequired) {
    text = gmText(task, facetOwner ?? opponent);
  } else {
    switch (task.kind) {
      case "submit_declaration":
        text = owner ? `Declaration open for ${owner}.` : "A declaration is required.";
        break;
      case "combat_experience":
        text = owner
          ? `Combat Experience roll required for ${owner}.`
          : "Combat Experience input is required before combat can continue.";
        break;
      case "roll_initiative":
        text = owner
          ? `${phase ?? "Initiative"} initiative roll open for ${owner}.`
          : "An initiative roll is required.";
        break;
      case "attack":
        text = owner
          ? `${owner} may make ${phase ? `${phase.toLowerCase()} ` : ""}attack${opponent ? ` against ${opponent}` : ""}.`
          : "An attack is ready.";
        break;
      case "missile_readiness":
        text = owner
          ? `${owner} must prepare a missile weapon${opponent ? ` for an attack against ${opponent}` : ""}.`
          : "Missile preparation is required before combat can continue.";
        break;
      case "parry":
        text = owner
          ? task.identity.parryPurpose === "offensive_parry"
            ? `${owner} must attempt Offensive Parry against ${opponent ? `${opponent}’s` : "another combatant’s"} attack.`
            : `${owner} must respond to ${opponent ? `${opponent}’s` : "another combatant’s"} attack.`
          : "Another combatant must respond before combat can continue.";
        break;
      case "offensive_parry_brawling_roll":
        text = owner
          ? `${owner} must roll Brawling${opponent ? ` against ${opponent}` : ""}.`
          : "A Brawling roll is required before combat can continue.";
        break;
      case "continued_contact_maintenance_roll":
        text = owner
          ? `${owner} must roll Brawling${opponent ? ` against ${opponent}` : ""} for Continued Contact.`
          : "A Continued Contact Brawling roll is required.";
        break;
      case "observation_roll":
        text = owner
          ? `${owner} must roll Observe Opponent${opponent ? ` against ${opponent}` : ""}.`
          : "An Observe Opponent roll is required.";
        break;
      case "adjust_distance_response":
        text = owner
          ? `${owner} must respond to ${opponent ?? "another combatant"} attempting to adjust distance.`
          : "Another combatant must respond before combat can continue.";
        break;
      case "adjust_distance_attacker_roll":
      case "adjust_distance_defender_roll":
        text = owner
          ? `${owner} must roll Dodge for Adjust Distance${opponent ? ` against ${opponent}` : ""}.`
          : "A Dodge roll is required before combat can continue.";
        break;
      case "break_off_escapee_roll":
      case "break_off_attacker_roll":
        text = owner
          ? `${owner} must roll Dodge for Break Off${opponent ? ` against ${opponent}` : ""}.`
          : "A Break Off Dodge roll is required before combat can continue.";
        break;
      case "disarm_actor_roll":
      case "disarm_holder_roll":
        text = owner
          ? `${owner} must roll weapon control for Disarm${opponent ? ` against ${opponent}` : ""}.`
          : "A Disarm roll is required before combat can continue.";
        break;
      case "feint_attacker_roll":
        text = owner
          ? `${owner} must roll Feint${opponent ? ` against ${opponent}` : ""}.`
          : "A Feint roll is required before combat can continue.";
        break;
      case "feint_defender_roll":
        text = owner
          ? `${owner} must respond to ${opponent ? `${opponent}’s` : "another combatant’s"} Feint.`
          : "Another combatant must respond before combat can continue.";
        break;
      case "double_attack_decision":
        text = owner
          ? `${owner} must continue or cancel the second Double Attack.`
          : "A Double Attack decision is required.";
        break;
      case "hit_location":
        text = owner
          ? `${owner} must roll hit location${opponent ? ` against ${opponent}` : ""}.`
          : "A hit-location roll is required.";
        break;
      case "critical":
        text = owner
          ? `${owner} must roll the critical${opponent ? ` against ${opponent}` : ""}.`
          : "A critical roll is required.";
        break;
      case "damage_roll":
        text = owner
          ? `${owner} must roll graze damage${opponent ? ` against ${opponent}` : ""}.`
          : "A graze damage roll is required.";
        break;
      case "distance_roll":
        text = owner
          ? `${owner} must roll distance control${opponent ? ` against ${opponent}` : ""}.`
          : "A distance-control roll is required.";
        break;
      case "health_review":
        text = owner ? `Health check required for ${owner}.` : "A Health check is required.";
        break;
      case "combat_task_roll":
        text = owner
          ? `${owner} must roll for the declared task.`
          : "A task roll is required before combat can continue.";
        break;
      case "combat_task_advance":
        text = owner
          ? `${owner} continues the declared task this round.`
          : "A task must be advanced before combat can continue.";
        break;
      case "modifier_review":
      case "commit_initiative":
      case "feint_commit":
      case "break_off_review":
      case "break_off_commit":
      case "disarm_commit":
      case "adjust_distance_adjustment":
      case "adjust_distance_commit":
      case "distance_commit":
      case "damage_review":
      case "defense_review":
      case "effect_review":
      case "participant_review":
      case "round_end_prepare":
      case "gm_advance_boundary":
      case "combat_task_review":
      case "combat_task_resolve":
        text = "Combat is waiting for the required review.";
        break;
    }
  }

  return {
    actionLabel: action,
    actorLabel: task.kind === "parry" || task.kind.includes("defender") ? opponent : owner,
    gmActionRequired,
    phaseLabel: phase,
    requiredActorLabel,
    targetLabel: task.kind === "parry" || task.kind.includes("defender") ? owner : opponent,
    text,
    waiting: task.state === "waiting",
  };
}

export function getCombatTrackerPendingMarkerKind(
  liveFacet: CombatTrackerLiveFacet | undefined,
): CombatTrackerMarkerKind {
  return liveFacet?.current && liveFacet.attention === "exceptional" ? "required" : "not_reached";
}

export function getCombatTrackerFacetStatus(input: {
  historical: boolean;
  liveFacet?: CombatTrackerLiveFacet;
  markerKind: CombatTrackerMarkerKind;
}): CombatTrackerFacetStatus {
  if (input.historical) return "historical";
  if (input.markerKind === "skipped") return "unsuccessful";
  if (["attack_hit", "attack_miss", "complete", "roll_result"].includes(input.markerKind)) {
    return "completed";
  }
  if (input.liveFacet?.waiting) return "waiting";
  if (input.liveFacet?.current) return "open";
  return "unopened";
}
