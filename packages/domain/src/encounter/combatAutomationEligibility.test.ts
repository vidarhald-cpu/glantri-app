import { describe, expect, it } from "vitest";

import type { CombatParticipationOwnership } from "./combatParticipation";
import {
  CANONICAL_COMBAT_AUTOMATION_ELIGIBILITY_SCHEMA_VERSION,
  combatAutomationEligibilityStatusSchema,
  combatAutomationWorkClassSchema,
  projectCombatTaskAutomationEligibility,
  projectPlayerSafeCombatAutomationEligibility,
  type CombatAutomationParticipationInput,
  type CombatAutomationTaskInput,
} from "./combatAutomationEligibility";

function participation(
  overrides: Partial<CombatAutomationParticipationInput> & {
    ownership?: CombatParticipationOwnership;
  } = {},
): CombatAutomationParticipationInput {
  return {
    completeness: "complete",
    factId: "participation-1",
    ordering: "participant_sequence",
    ownership: { kind: "gm_controlled_participant", participantId: "hero" },
    reason: "response_required",
    status: "required",
    workClass: "gm_roll",
    ...overrides,
  };
}

function task(
  kind: CombatAutomationTaskInput["kind"],
  overrides: Partial<CombatAutomationTaskInput> = {},
): CombatAutomationTaskInput {
  return {
    blockerCount: 0,
    expectedCommand: "roll_attack",
    identity: {},
    kind,
    ownerParticipantId: "hero",
    state: "executable",
    taskId: `task:${kind}`,
    ...overrides,
  };
}

function classify(
  kind: CombatAutomationTaskInput["kind"],
  taskOverrides: Partial<CombatAutomationTaskInput> = {},
  participationOverrides: Parameters<typeof participation>[0] = {},
) {
  return projectCombatTaskAutomationEligibility({
    participation: participation(participationOverrides),
    task: task(kind, taskOverrides),
  });
}

describe("canonical combat automation eligibility", () => {
  it("uses versioned, distinct automation and eligibility classes", () => {
    expect(combatAutomationWorkClassSchema.options).toEqual([
      "human_decision",
      "player_roll",
      "gm_roll",
      "deterministic",
      "not_applicable",
    ]);
    expect(combatAutomationEligibilityStatusSchema.options).toEqual([
      "eligible",
      "blocked",
      "not_allowed",
      "requires_warning",
      "unsupported",
    ]);
    expect(
      classify("health_review", {
        expectedCommand: "roll_round_end_health_check",
        identity: { healthRollId: "health-1" },
      }).schemaVersion,
    ).toBe(CANONICAL_COMBAT_AUTOMATION_ELIGIBILITY_SCHEMA_VERSION);
  });

  it("keeps player, explicit GM proxy, and GM-controlled roll authority distinct", () => {
    const initiativeTask = {
      expectedCommand: "roll_initiative_phase1",
      identity: { phase: "phase1" as const },
    };
    expect(
      classify("roll_initiative", initiativeTask, {
        ownership: { kind: "player_owned", participantId: "hero" },
        workClass: "player_roll",
      }),
    ).toMatchObject({
      authority: { kind: "player", participantId: "hero" },
      eligibility: "not_allowed",
      stopReason: "player_owned",
      warnings: ["proxy_required"],
      workClass: "player_roll",
    });
    expect(
      classify("roll_initiative", initiativeTask, {
        ownership: { kind: "gm_proxy", participantId: "hero", proxyUserId: "gm-1" },
      }),
    ).toMatchObject({
      authority: { kind: "gm_proxy", participantId: "hero", proxyUserId: "gm-1" },
      eligibility: "requires_warning",
      stopReason: "gm_proxy_authority",
      warnings: ["gm_proxy_authority"],
      workClass: "gm_roll",
    });
    expect(classify("roll_initiative", initiativeTask)).toMatchObject({
      authority: { kind: "gm_controlled_participant", participantId: "hero" },
      eligibility: "eligible",
      stopReason: undefined,
      warnings: [],
      workClass: "gm_roll",
    });
  });

  it.each([
    ["combat_experience", { expectedCommand: "roll_combat_experience", identity: {} }, []],
    [
      "health_review",
      {
        expectedCommand: "roll_round_end_health_check",
        identity: { healthRollId: "health-1" },
      },
      [],
    ],
    [
      "distance_roll",
      {
        expectedCommand: "roll_round_end_distance_control",
        identity: { pairId: "hero:guard", proposalId: "distance-1" },
      },
      [],
    ],
    [
      "continued_contact_maintenance_roll",
      {
        expectedCommand: "roll_continued_contact_maintenance",
        identity: {
          contestId: "contest-1",
          continuedContactId: "contact-1",
          opponentParticipantId: "guard",
        },
      },
      [],
    ],
    [
      "offensive_parry_brawling_roll",
      {
        expectedCommand: "roll_offensive_parry_brawling",
        identity: { contestId: "contest-1", opponentParticipantId: "guard" },
      },
      [],
    ],
    [
      "hit_location",
      {
        expectedCommand: "roll_hit_location",
        identity: { attackResultId: "attack-1", hitLocationResultId: "location-1" },
      },
      [],
    ],
    [
      "critical",
      {
        expectedCommand: "roll_critical",
        identity: { attackResultId: "attack-1", criticalResultId: "critical-1" },
      },
      [],
    ],
    [
      "damage_roll",
      {
        expectedCommand: "resolve_damage",
        identity: { attackResultId: "attack-1", damageRollExpression: "1d4" },
      },
      [],
    ],
  ] as const)("classifies fixed-input GM %s as eligible", (kind, overrides, warnings) => {
    expect(classify(kind, overrides)).toMatchObject({
      eligibility: warnings.length > 0 ? "requires_warning" : "eligible",
      warnings,
      workClass: "gm_roll",
    });
  });

  it("classifies ordered maneuvers and hidden Observe facts with safe typed warnings", () => {
    for (const kind of [
      "feint_attacker_roll",
      "feint_defender_roll",
      "adjust_distance_attacker_roll",
      "adjust_distance_defender_roll",
    ] as const) {
      expect(
        classify(kind, {
          identity: { opponentParticipantId: "guard", proposalId: `${kind}-proposal` },
        }),
      ).toMatchObject({
        eligibility: "requires_warning",
        stopReason: "ordered_maneuver",
        warnings: ["ordered_maneuver"],
      });
    }
    expect(
      classify("observation_roll", {
        expectedCommand: "roll_observation",
        identity: {
          observationAttemptId: "attempt-1",
          opponentParticipantId: "guard",
          relationshipId: "relationship-1",
        },
      }),
    ).toMatchObject({ eligibility: "eligible", warnings: [] });
    expect(
      classify("observation_roll", {
        expectedCommand: "roll_observation",
        identity: {
          observationAttemptId: "attempt-1",
          relationshipId: "relationship-1",
        },
      }),
    ).toMatchObject({ eligibility: "blocked", stopReason: "relationship_ambiguity" });
  });

  it("keeps one ordinary actor's exact attack eligible while tactical selection stays excluded", () => {
    expect(
      classify("attack", {
        identity: { opponentParticipantId: "guard", opportunityId: "attack-opportunity-1" },
      }),
    ).toMatchObject({ eligibility: "eligible", workClass: "gm_roll" });
    expect(
      classify(
        "submit_declaration",
        { expectedCommand: "declare_action" },
        { workClass: "human_decision" },
      ),
    ).toMatchObject({
      eligibility: "not_allowed",
      stopReason: "human_decision_required",
      workClass: "human_decision",
    });
  });

  it("requires exact target, weapon opportunity, and parry source identities", () => {
    expect(classify("attack")).toMatchObject({
      eligibility: "blocked",
      stopReason: "multiple_targets",
    });
    expect(classify("attack", { identity: { opponentParticipantId: "guard" } })).toMatchObject({
      eligibility: "blocked",
      stopReason: "multiple_weapons",
    });
    expect(
      classify("parry", {
        identity: { attackResultId: "attack-1", parrySourceId: "auto" },
      }),
    ).toMatchObject({ eligibility: "blocked", stopReason: "multiple_parry_sources" });
    expect(
      classify("parry", {
        identity: { attackResultId: "attack-1", parrySourceId: "shield:left" },
      }),
    ).toMatchObject({ eligibility: "eligible" });
  });

  it.each([
    ["modifier_review", "gm_modifier_pending"],
    ["effect_review", "effect_review_pending"],
    ["damage_review", "damage_review_pending"],
    ["double_attack_decision", "double_attack_choice"],
    ["adjust_distance_response", "continue_backout_choice"],
    ["adjust_distance_adjustment", "human_decision_required"],
    ["distance_commit", "human_decision_required"],
    ["feint_commit", "human_decision_required"],
  ] as const)("keeps %s as a non-automatable decision", (kind, stopReason) => {
    expect(classify(kind, {}, { workClass: "human_decision" })).toMatchObject({
      eligibility: "not_allowed",
      stopReason,
      workClass: "human_decision",
    });
  });

  it("marks ownerless round and initiative boundaries not applicable", () => {
    for (const kind of ["gm_advance_boundary", "commit_initiative", "round_end_prepare"] as const) {
      expect(
        classify(
          kind,
          { ownerParticipantId: undefined },
          {
            ordering: "ownerless_boundary",
            ownership: { kind: "ownerless" },
            workClass: "deterministic_transition",
          },
        ),
      ).toMatchObject({
        authority: { kind: "ownerless" },
        eligibility: "not_allowed",
        stopReason: "deterministic_already_handled",
        workClass: "not_applicable",
      });
    }
  });

  it("classifies automatic SU work as deterministic without treating it as a GM roll", () => {
    expect(
      classify(
        "effect_review",
        { expectedCommand: "commit_round_end_participant_review" },
        {
          ownership: { kind: "gm_owned", participantId: "hero" },
          workClass: "deterministic_transition",
        },
      ),
    ).toMatchObject({
      authority: { kind: "gm", participantId: "hero" },
      eligibility: "not_allowed",
      stopReason: "deterministic_already_handled",
      workClass: "deterministic",
    });
  });

  it("is conservative for legacy, partial, unsupported, blocked, and waiting work", () => {
    expect(
      classify(
        "roll_initiative",
        { identity: { phase: "phase1" } },
        {
          completeness: "legacy_incomplete",
        },
      ),
    ).toMatchObject({ eligibility: "unsupported", stopReason: "legacy_state" });
    expect(
      classify(
        "roll_initiative",
        { identity: { phase: "phase1" } },
        {
          completeness: "partial",
        },
      ),
    ).toMatchObject({
      eligibility: "unsupported",
      stopReason: "incomplete_canonical_facts",
    });
    expect(
      classify(
        "roll_initiative",
        { identity: { phase: "phase1" } },
        {
          completeness: "unsupported",
        },
      ),
    ).toMatchObject({ eligibility: "unsupported", stopReason: "unsupported_process" });
    expect(
      classify(
        "roll_initiative",
        { identity: { phase: "phase1" } },
        {
          reason: "stale_or_invalid_source",
          status: "blocked",
        },
      ),
    ).toMatchObject({ eligibility: "blocked", stopReason: "stale_revision" });
    expect(
      classify("roll_initiative", { identity: { phase: "phase1" }, state: "waiting" }),
    ).toMatchObject({ eligibility: "blocked", stopReason: "task_not_executable" });
  });

  it("projects deterministic immutable facts and hides foreign authority and reasons from players", () => {
    const projected = classify("observation_roll", {
      expectedCommand: "roll_observation",
      identity: {
        observationAttemptId: "attempt-1",
        opponentParticipantId: "guard",
        relationshipId: "relationship-1",
      },
    });
    expect(
      projectCombatTaskAutomationEligibility({
        participation: participation(),
        task: task("observation_roll", {
          expectedCommand: "roll_observation",
          identity: {
            observationAttemptId: "attempt-1",
            opponentParticipantId: "guard",
            relationshipId: "relationship-1",
          },
        }),
      }),
    ).toEqual(projected);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(
      projectPlayerSafeCombatAutomationEligibility({
        controlledParticipantIds: new Set(["other"]),
        fact: projected,
      }),
    ).toEqual({
      authority: { kind: "unknown" },
      eligibility: "unsupported",
      schemaVersion: 1,
      taskId: "task:observation_roll",
      warnings: [],
      workClass: "not_applicable",
    });
  });
});
