import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "../campaign/scenario";

import {
  buildCombatRoundAttackRollResult,
  buildCombatRoundPhaseResolutionResult,
  combatRoundStateSchema,
  type ActiveCombatRoundState,
} from "./combatRoundManager";
import {
  CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  canonicalCombatModifierReviewInputSchema,
  type CanonicalCombatModifierReviewInput,
} from "./combatModifierReview";
import {
  CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION,
  combatParticipationStatusSchema,
  combatParticipationWorkClassSchema,
  projectCombatParticipation,
  projectActiveCombatParticipation,
  projectParticipantProcessParticipation,
  projectPhaseInitiativeParticipation,
  projectPlayerSafeCombatParticipation,
  projectSuParticipation,
  type CombatParticipationFact,
  type CombatParticipationProjectionInput,
} from "./combatParticipation";
import { buildCombatProgressionProjection } from "./combatProgressionProjection";

const REVISION = "2026-08-03T12:00:00.000Z";
const NOW = "2026-08-03T11:00:00.000Z";

function participant(
  id: string,
  declaration?: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    characterId: `character-${id}`,
    declaration,
    label: id === "hero" ? "Hero" : id === "guard" ? "Guard" : id,
    participantId: id,
    scenarioParticipantId: `scenario-${id}`,
    ...overrides,
  };
}

function declaration(
  actionId: string,
  targetParticipantId?: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    actionId,
    phaseContexts: targetParticipantId
      ? {
          phase1: { targetParticipantId },
          phase2: { targetParticipantId },
        }
      : undefined,
    roundNumber: 2,
    submittedBy: "player",
    ...overrides,
  };
}

function activeState(
  input: {
    currentStep?: string;
    overrides?: Record<string, unknown>;
    participants?: Record<string, unknown>[];
    roundNumber?: number;
  } = {},
): ActiveCombatRoundState {
  const full = combatRoundStateSchema.parse({
    currentStep: input.currentStep ?? "select_actions",
    encounterId: "encounter-1",
    participants: input.participants ?? [participant("hero"), participant("guard")],
    roundNumber: input.roundNumber ?? 2,
    ...input.overrides,
  });
  const { rounds: _rounds, ...active } = full;
  return active;
}

function review(
  participantId: string,
  phase: "M1" | "M2",
  overrides: Partial<CanonicalCombatModifierReviewInput> = {},
): CanonicalCombatModifierReviewInput {
  return canonicalCombatModifierReviewInputSchema.parse({
    automaticProposals: [],
    canonicalCutoff: 0,
    decisions: [],
    encounterId: "encounter-1",
    expectedEncounterRevision: REVISION,
    inputEffects: [],
    participantId,
    phase,
    requiredRolls: [],
    reviewId: `review:${participantId}:${phase}`,
    roundNumber: 2,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
    ...overrides,
  });
}

function defaultReviews(participantIds: readonly string[]) {
  return participantIds.flatMap((participantId) => [
    review(participantId, "M1"),
    review(participantId, "M2"),
  ]);
}

function project(
  state: ActiveCombatRoundState,
  overrides: Partial<CombatParticipationProjectionInput> = {},
) {
  const participantIds = state.participants.map((entry) => entry.participantId);
  return projectCombatParticipation({
    encounterRevision: REVISION,
    modifierReviews: defaultReviews(participantIds),
    participantAuthorities: participantIds.map((participantId, index) => ({
      authority: index === 0 ? ("player" as const) : ("gm" as const),
      participantId,
      playerUserId: index === 0 ? "player-1" : undefined,
    })),
    state,
    ...overrides,
  });
}

function fact(
  projection: ReturnType<typeof project>,
  input: {
    family: CombatParticipationFact["identity"]["processFamily"];
    participantId?: string;
    phase?: "phase1" | "phase2";
    step?: string;
  },
) {
  const match = projection.facts.find(
    (candidate) =>
      candidate.identity.processFamily === input.family &&
      candidate.identity.participantId === input.participantId &&
      candidate.identity.phase === input.phase &&
      (input.step === undefined || candidate.identity.step === input.step),
  );
  if (!match) throw new Error(`Missing ${input.family} participation fact.`);
  return match;
}

function attackResult(input: {
  attacker?: string;
  defender?: string;
  hit: boolean;
  opportunityId?: string;
  phase?: "phase1" | "phase2";
}) {
  const phase = input.phase ?? "phase1";
  const attacker = input.attacker ?? "hero";
  return {
    ...buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: attacker,
      defenderDb: input.hit ? 0 : 40,
      defenderParticipantId: input.defender ?? "guard",
      ob: input.hit ? 80 : 0,
      phase,
      rollD20: input.hit ? 20 : 1,
      rollTotal: input.hit ? 20 : 1,
      rolledAt: NOW,
      weaponName: "Sword",
    }),
    attackOpportunityId:
      input.opportunityId ??
      `round:2:participant:${attacker}:${phase}:${phase === "phase1" ? "attack_1" : "attack_2"}`,
  };
}

describe("canonical combat participation", () => {
  it("uses a versioned contract with distinct statuses and A/B/C/D/E work classes", () => {
    expect(combatParticipationStatusSchema.options).toEqual([
      "required",
      "conditional",
      "not_required",
      "blocked",
      "already_resolved",
    ]);
    expect(combatParticipationWorkClassSchema.options).toEqual([
      "human_decision",
      "player_roll",
      "gm_roll",
      "deterministic_transition",
      "no_work",
    ]);
    expect(project(activeState()).schemaVersion).toBe(
      CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION,
    );
  });

  it("keeps player rolls, GM-controlled rolls, and exact GM proxy authority distinct", () => {
    const state = activeState({
      participants: [
        participant("hero", declaration("attack_parry", "guard")),
        participant("guard", declaration("attack_parry", "hero")),
      ],
    });
    const ordinary = project(state);
    expect(
      fact(ordinary, { family: "initiative", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ ownership: { kind: "player_owned" }, workClass: "player_roll" });
    expect(
      fact(ordinary, { family: "initiative", participantId: "guard", phase: "phase1" }),
    ).toMatchObject({ ownership: { kind: "gm_controlled_participant" }, workClass: "gm_roll" });

    const proxied = project(state, {
      proxyAuthorities: [
        {
          active: true,
          participantId: "hero",
          phase: "phase1",
          processFamily: "initiative",
          proxyUserId: "gm-1",
        },
      ],
    });
    expect(
      fact(proxied, { family: "initiative", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ ownership: { kind: "gm_proxy", proxyUserId: "gm-1" }, workClass: "gm_roll" });
  });

  it("keeps ownerless work participant-free", () => {
    const projection = project(activeState());
    const boundary = fact(projection, { family: "boundary", step: "prepare_round_end" });
    expect(boundary.ownership).toEqual({ kind: "ownerless" });
    expect(boundary.identity.participantId).toBeUndefined();
    expect(boundary.ordering).toBe("ownerless_boundary");
  });

  it("requires declarations conservatively and permits forced no-action only from complete facts", () => {
    const state = activeState();
    const conservative = project(state);
    expect(fact(conservative, { family: "declaration", participantId: "hero" })).toMatchObject({
      completeness: "legacy_incomplete",
      reason: "declaration_required",
      status: "required",
    });
    const forced = project(state, {
      declarationSources: [
        {
          completeness: "complete",
          forcedNoAction: true,
          legalChoiceCount: 0,
          participantId: "hero",
        },
      ],
    });
    expect(fact(forced, { family: "declaration", participantId: "hero" })).toMatchObject({
      completeness: "complete",
      status: "not_required",
      workClass: "no_work",
    });
  });

  it("does not treat a draft action id as an accepted declaration", () => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("parry"), {
            stepStatuses: { select_actions: "pending" },
          }),
          participant("guard"),
        ],
      }),
    );

    expect(fact(projection, { family: "declaration", participantId: "hero" })).toMatchObject({
      reason: "declaration_required",
      status: "required",
    });
  });

  it.each([
    ["player submission", "submitted"],
    ["GM submission or NPC proposal acceptance", "gmEdited"],
  ] as const)("accepts %s as canonical DE completion evidence", (_label, status) => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("parry"), {
            stepStatuses: { select_actions: status },
          }),
          participant("guard"),
        ],
      }),
    );

    expect(fact(projection, { family: "declaration", participantId: "hero" })).toMatchObject({
      reason: "already_resolved",
      status: "already_resolved",
    });
  });

  it("blocks unavailable legacy declarations rather than guessing participation", () => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("counterattack", "guard")),
          participant("guard"),
        ],
      }),
    );
    expect(fact(projection, { family: "declaration", participantId: "hero" })).toMatchObject({
      completeness: "unsupported",
      reason: "stale_or_invalid_source",
      status: "blocked",
    });
  });

  it("classifies empty, proposed, and blocked modifier reviews as GM checkpoints", () => {
    const state = activeState();
    const empty = project(state);
    expect(
      fact(empty, { family: "modifier_review", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({
      ownership: { kind: "gm_owned", participantId: "hero" },
      reason: "modifier_review_required",
      status: "required",
      workClass: "human_decision",
    });
    expect(
      fact(empty, { family: "modifier_review", participantId: "hero", phase: "phase2" }),
    ).toMatchObject({
      reason: "modifier_review_required",
      status: "required",
      workClass: "human_decision",
    });

    const humanReview = review("hero", "M1", {
      automaticProposals: [
        {
          effectId: "effect-1",
          expectedVersion: 1,
          id: "proposal-1",
          mayOverride: true,
          nextState: "expired",
          owner: "modifier_review",
          reason: "natural_expiry",
          transitionType: "expire",
        },
      ],
    });
    const automaticReview = review("guard", "M1", {
      automaticProposals: [
        {
          effectId: "effect-2",
          expectedVersion: 1,
          id: "proposal-2",
          mayOverride: false,
          nextState: "expired",
          owner: "modifier_review",
          reason: "natural_expiry",
          transitionType: "expire",
        },
      ],
    });
    const classified = project(state, {
      modifierReviews: [humanReview, review("hero", "M2"), automaticReview, review("guard", "M2")],
    });
    expect(
      fact(classified, { family: "modifier_review", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({
      reason: "modifier_review_required",
      status: "required",
      workClass: "human_decision",
    });
    expect(
      fact(classified, { family: "modifier_review", participantId: "guard", phase: "phase1" }),
    ).toMatchObject({
      reason: "modifier_review_required",
      status: "required",
      workClass: "human_decision",
    });

    const blocked = project(state, {
      modifierReviews: [
        review("hero", "M1", {
          requiredRolls: [
            {
              blocksReview: true,
              id: "required-1",
              kind: "gm_review",
              owner: "modifier_review",
              resolved: false,
            },
          ],
        }),
        review("hero", "M2"),
        review("guard", "M1"),
        review("guard", "M2"),
      ],
    });
    expect(
      fact(blocked, { family: "modifier_review", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ status: "blocked", workClass: "human_decision" });
  });

  it("projects sparse phase initiative without fabricating initiative zero", () => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("attack_parry", "guard")),
          participant("guard", declaration("attack_parry", "hero")),
          participant("idle-1", declaration("parry")),
          participant("idle-2", declaration("parry")),
          participant("idle-3", declaration("parry")),
          participant("idle-4", declaration("parry")),
        ],
      }),
      {
        participantAuthorities: [
          { authority: "player", participantId: "hero", playerUserId: "player-1" },
          { authority: "gm", participantId: "guard" },
          { authority: "gm", participantId: "idle-1" },
          { authority: "gm", participantId: "idle-2" },
          { authority: "gm", participantId: "idle-3" },
          { authority: "gm", participantId: "idle-4" },
        ],
      },
    );
    const phase1 = projection.facts.filter(
      (entry) => entry.identity.processFamily === "initiative" && entry.identity.phase === "phase1",
    );
    expect(phase1.filter((entry) => entry.status === "required")).toHaveLength(2);
    expect(phase1.filter((entry) => entry.status === "not_required")).toHaveLength(4);
    expect(phase1.every((entry) => entry.identity.step === "i1")).toBe(true);
  });

  it("classifies a sole ordinary actor as action-required but initiative-not-required", () => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("attack_parry", "guard")),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, { family: "initiative", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ reason: "sole_actor_order_irrelevant", status: "not_required" });
    expect(
      fact(projection, {
        family: "phase_action",
        participantId: "hero",
        phase: "phase1",
        step: "attack",
      }),
    ).toMatchObject({ reason: "attack_opportunity", status: "required" });
  });

  it("retains ordered-maneuver initiative for a sole Feint actor", () => {
    const projection = project(
      activeState({
        participants: [
          participant(
            "hero",
            declaration("feint_attack", "guard", {
              feint: {
                attackerSkillId: "sword",
                attackerSkillLabel: "Sword",
                defenderSkillId: "sword",
                defenderSkillLabel: "Sword",
                method: "weapon",
                targetParticipantId: "guard",
              },
            }),
          ),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, { family: "initiative", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ reason: "initiative_order_required", status: "required" });
    expect(projection.facts.some((entry) => entry.identity.processFamily === "feint")).toBe(true);
  });

  it("retains ordered-maneuver initiative for a sole Adjust Distance actor", () => {
    const projection = project(
      activeState({
        participants: [
          participant(
            "hero",
            declaration("adjust_range_attack", "guard", {
              adjustDistance: {
                currentDistance: 3,
                requestedDistance: 2,
                targetParticipantId: "guard",
              },
            }),
          ),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, { family: "initiative", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ reason: "initiative_order_required", status: "required" });
    expect(
      projection.facts.some((entry) => entry.identity.processFamily === "adjust_distance"),
    ).toBe(true);
  });

  it("blocks an invalidated target and does not create initiative participation", () => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("attack_parry", "missing-target")),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, { family: "initiative", participantId: "hero", phase: "phase1" }),
    ).toMatchObject({ reason: "no_executable_phase_action", status: "not_required" });
    expect(
      fact(projection, {
        family: "phase_action",
        participantId: "hero",
        phase: "phase1",
        step: "attack",
      }),
    ).toMatchObject({
      completeness: "partial",
      reason: "stale_or_invalid_source",
      status: "blocked",
    });
  });

  it("classifies a miss as resolved attack work with no Parry or damage participation", () => {
    const miss = attackResult({ hit: false });
    const projection = project(
      activeState({
        currentStep: "phase_1_actions",
        participants: [
          participant("hero", declaration("attack_parry", "guard"), {
            attackResults: { phase1: miss },
            attackResultsByOpportunity: { [miss.attackOpportunityId]: miss },
          }),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, {
        family: "phase_action",
        participantId: "hero",
        phase: "phase1",
        step: "attack",
      }),
    ).toMatchObject({ status: "already_resolved" });
    expect(
      fact(projection, {
        family: "phase_response",
        participantId: "guard",
        phase: "phase1",
        step: "defense",
      }),
    ).toMatchObject({ status: "not_required", workClass: "no_work" });
    const damageFacts = projection.facts.filter(
      (entry) =>
        entry.identity.processFamily === "damage_chain" &&
        entry.identity.opportunityId === miss.attackOpportunityId,
    );
    expect(damageFacts.every((entry) => entry.status === "not_required")).toBe(true);
  });

  it("classifies a hit as a required response with conditional damage-chain work", () => {
    const hit = attackResult({ hit: true });
    const resolution = buildCombatRoundPhaseResolutionResult({
      attackResult: hit,
      roundNumber: 2,
      updatedAt: NOW,
    });
    const projection = project(
      activeState({
        currentStep: "phase_1_actions",
        overrides: { phaseResolutionResults: [resolution] },
        participants: [
          participant("hero", declaration("attack_parry", "guard"), {
            attackResults: { phase1: hit },
            attackResultsByOpportunity: { [hit.attackOpportunityId]: hit },
          }),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, {
        family: "phase_response",
        participantId: "guard",
        phase: "phase1",
        step: "defense",
      }),
    ).toMatchObject({ reason: "response_required", status: "required" });
    expect(
      projection.facts.some(
        (entry) =>
          entry.identity.processFamily === "damage_chain" && entry.status === "conditional",
      ),
    ).toBe(true);
    expect(
      fact(projection, {
        family: "damage_chain",
        phase: "phase1",
        step: "commit",
      }),
    ).toMatchObject({
      ordering: "ownerless_boundary",
      ownership: { kind: "ownerless" },
      reason: "deterministic_boundary",
      status: "conditional",
      workClass: "deterministic_transition",
    });
  });

  it("classifies successful Parry descendants as not required rather than absent", () => {
    const hit = attackResult({ hit: true });
    const resolution = {
      ...buildCombatRoundPhaseResolutionResult({
        attackResult: hit,
        roundNumber: 2,
        updatedAt: NOW,
      }),
      damageRoll: { status: "not_required" as const },
      parryResolution: {
        resultLabel: "Parried",
        status: "resolved" as const,
        success: true,
        targetNumber: 21,
        total: 25,
      },
    };
    const projection = project(
      activeState({
        currentStep: "phase_1_actions",
        overrides: { phaseResolutionResults: [resolution] },
        participants: [
          participant("hero", declaration("attack_parry", "guard"), {
            attackResults: { phase1: hit },
            attackResultsByOpportunity: { [hit.attackOpportunityId]: hit },
          }),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    const damageFacts = projection.facts.filter(
      (entry) => entry.identity.processFamily === "damage_chain",
    );
    expect(damageFacts.length).toBeGreaterThan(0);
    expect(damageFacts.every((entry) => entry.status === "not_required")).toBe(true);
  });

  it("classifies unresolved Double Attack Phase 2 choice as human work", () => {
    const first = attackResult({ hit: false });
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("double_attack", "guard"), {
            attackResults: { phase1: first },
            attackResultsByOpportunity: { [first.attackOpportunityId]: first },
          }),
          participant("guard", declaration("parry")),
        ],
      }),
    );
    expect(
      fact(projection, {
        family: "double_attack_decision",
        participantId: "hero",
        phase: "phase2",
      }),
    ).toMatchObject({
      reason: "unresolved_choice",
      status: "required",
      workClass: "human_decision",
    });
  });

  it("classifies Health-only SU work without manufacturing generic effect review", () => {
    const projection = project(
      activeState({
        currentStep: "round_summary",
        overrides: {
          roundEndReview: {
            participantReviews: {
              guard: { participantId: "guard", status: "complete" },
              hero: {
                participantId: "hero",
                proposedHealthRolls: [
                  {
                    accepted: true,
                    bleedType: "external",
                    difficulty: 21,
                    healthStat: 12,
                    id: "health:hero",
                    label: "Health check",
                    participantId: "hero",
                    sourceEffectId: "bleed:hero",
                    status: "pending",
                  },
                ],
                status: "health_roll_pending",
              },
            },
            roundNumber: 2,
          },
        },
      }),
    );
    expect(
      fact(projection, { family: "health_bleed", participantId: "hero", step: "health_check" }),
    ).toMatchObject({ reason: "health_check_due", status: "required", workClass: "player_roll" });
    expect(
      fact(projection, { family: "effect_review", participantId: "hero", step: "SU_effect" }),
    ).toMatchObject({ reason: "no_su_work", status: "not_required", workClass: "no_work" });
  });

  it("classifies typed automatic SU transitions as deterministic and empty SU as no work", () => {
    const projection = project(
      activeState({
        currentStep: "round_summary",
        overrides: {
          roundEndReview: {
            participantReviews: {
              guard: { participantId: "guard", status: "review_ready" },
              hero: {
                canonicalReview: {
                  canonicalCutoff: 3,
                  effectVersions: { "effect-1": 1 },
                  participantId: "hero",
                  proposals: [
                    {
                      automatic: true,
                      effectId: "effect-1",
                      expectedEffectVersion: 1,
                      id: "su-proposal-1",
                      mayOverride: false,
                      nextDuration: {
                        creationRoundCounts: true,
                        kind: "rounds",
                        remaining: 1,
                        startRound: 1,
                        startSequence: 1,
                        transitionBoundary: "round_boundary",
                      },
                      nextState: "active",
                      owner: "su",
                      priorDuration: {
                        creationRoundCounts: true,
                        kind: "rounds",
                        remaining: 2,
                        startRound: 1,
                        startSequence: 1,
                        transitionBoundary: "round_boundary",
                      },
                      priorState: "active",
                      reason: "duration_decremented",
                      transitionType: "update",
                    },
                  ],
                  requirements: [],
                  reviewId: "su-review-hero",
                  roundNumber: 2,
                  schemaVersion: 1,
                  state: "ready",
                },
                participantId: "hero",
                status: "review_ready",
              },
            },
            roundNumber: 2,
          },
        },
      }),
    );
    expect(
      fact(projection, { family: "effect_review", participantId: "hero", step: "SU_effect" }),
    ).toMatchObject({ status: "required", workClass: "deterministic_transition" });
    expect(
      fact(projection, { family: "effect_review", participantId: "guard", step: "SU_effect" }),
    ).toMatchObject({ reason: "no_su_work", status: "not_required" });
  });

  it("classifies completed SU as a GM-owned board checkpoint rather than a deterministic suffix", () => {
    const projection = project(
      activeState({
        currentStep: "round_summary",
        overrides: {
          roundEndReview: {
            participantReviews: {
              guard: { participantId: "guard", status: "complete" },
              hero: { participantId: "hero", status: "complete" },
            },
            roundNumber: 2,
          },
        },
      }),
    );

    expect(fact(projection, { family: "boundary", step: "round_boundary" })).toMatchObject({
      ownership: { kind: "gm_owned" },
      reason: "unresolved_choice",
      status: "required",
      workClass: "human_decision",
    });
  });

  it("classifies Continued Contact and distance control with distinct pair roles", () => {
    const projection = project(
      activeState({
        currentStep: "round_summary",
        overrides: {
          roundEndReview: {
            continuedContactMaintenanceContests: [
              {
                affectedParticipantId: "guard",
                affectedRollRecorded: false,
                continuedContactId: "contact-1",
                controllerParticipantId: "hero",
                controllerRollRecorded: false,
                id: "contest-1",
                resultId: "contest-1:result",
                roundNumber: 2,
                status: "awaiting_rolls",
                unbalancedConditionId: "unbalanced-1",
              },
            ],
            participantReviews: {
              guard: { participantId: "guard", status: "complete" },
              hero: { participantId: "hero", status: "complete" },
            },
            proposedDistances: [
              {
                accepted: true,
                appliesFromRound: 3,
                currentDistance: 2,
                currentDistanceSource: "canonical",
                id: "distance-1",
                pairKey: "guard::hero",
                participantA: {
                  calculationReadiness: {
                    completeness: "complete",
                    reasons: [],
                    schemaVersion: 1,
                  },
                  participantId: "hero",
                  status: "pending",
                },
                participantAId: "hero",
                participantB: {
                  calculationReadiness: {
                    completeness: "complete",
                    reasons: [],
                    schemaVersion: 1,
                  },
                  participantId: "guard",
                  status: "pending",
                },
                participantBId: "guard",
                requiresContest: true,
                status: "pending_rolls",
              },
            ],
            roundNumber: 2,
          },
        },
      }),
    );
    const contact = fact(projection, {
      family: "continued_contact",
      participantId: "hero",
      step: "maintenance_roll",
    });
    expect(contact).toMatchObject({ reason: "continued_contact_due", status: "required" });
    expect(contact.ownership).toMatchObject({
      kind: "shared_pair",
      roles: [
        { authority: "player", participantId: "hero", role: "controller" },
        { authority: "gm", participantId: "guard", role: "affected" },
      ],
    });
    const distance = fact(projection, {
      family: "distance_control",
      participantId: "hero",
      step: "distance_roll",
    });
    expect(distance).toMatchObject({
      completeness: "complete",
      identity: { opponentParticipantId: "guard" },
      ownership: { kind: "player_owned", participantId: "hero" },
      reason: "distance_control_due",
      status: "required",
    });
  });

  it("projects pending Observe Opponent work without leaking it to another player", () => {
    const state = activeState({
      currentStep: "round_summary",
      overrides: {
        observationRelationships: [
          {
            completedAttempts: 0,
            id: "observation:hero:guard",
            observerParticipantId: "hero",
            roundsTowardNextAttempt: 2,
            targetParticipantId: "guard",
          },
        ],
        roundEndReview: {
          participantReviews: {
            guard: { participantId: "guard", status: "complete" },
            hero: { participantId: "hero", status: "review_ready" },
          },
          roundNumber: 2,
        },
      },
      participants: [
        participant("hero", {
          actionId: "parry",
          roundNumber: 2,
          secondaryActionContext: {
            action: "observe_opponent",
            targetParticipantId: "guard",
          },
          secondaryActionId: "observe_opponent",
          submittedBy: "player",
        }),
        participant("guard", declaration("parry")),
      ],
    });
    const projection = project(state);
    const observation = fact(projection, {
      family: "observation",
      participantId: "hero",
      step: "observation_roll",
    });
    expect(observation).toMatchObject({ reason: "observation_attempt_due", status: "required" });
    expect(observation.identity.opponentParticipantId).toBe("guard");

    const playerSafe = projectPlayerSafeCombatParticipation({
      controlledParticipantIds: new Set(["hero"]),
      projection,
    });
    const safeObservation = playerSafe.facts.find(
      (entry) => entry.identity.processFamily === "observation",
    );
    expect(safeObservation?.identity).not.toHaveProperty("opponentParticipantId");
    expect(playerSafe.facts.some((entry) => entry.identity.participantId === "guard")).toBe(false);
  });

  it("is immutable, deterministic, and independent of participant creation order", () => {
    const firstState = activeState({
      participants: [
        participant("hero", declaration("attack_parry", "guard")),
        participant("guard", declaration("attack_parry", "hero")),
      ],
    });
    const secondState = activeState({
      participants: [...firstState.participants].reverse(),
    });
    const authorities = [
      { authority: "player" as const, participantId: "hero", playerUserId: "player-1" },
      { authority: "gm" as const, participantId: "guard" },
    ];
    const first = project(firstState, { participantAuthorities: authorities });
    const second = project(secondState, { participantAuthorities: authorities });
    expect(first.facts).toEqual(second.facts);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.facts)).toBe(true);
    expect(project(firstState, { participantAuthorities: authorities })).toEqual(first);
  });

  it("provides bounded participant, initiative, and SU selectors without rebuilding", () => {
    const projection = project(
      activeState({
        participants: [
          participant("hero", declaration("attack_parry", "guard")),
          participant("guard", declaration("attack_parry", "hero")),
        ],
      }),
    );
    expect(
      projectParticipantProcessParticipation({
        participantId: "hero",
        phase: "phase1",
        processFamily: "phase_action",
        projection,
      }).every((entry) => entry.identity.participantId === "hero"),
    ).toBe(true);
    expect(projectPhaseInitiativeParticipation({ phase: "phase1", projection })).toHaveLength(2);
    expect(
      projectSuParticipation({ participantId: "hero", projection }).every(
        (entry) => entry.identity.participantId === "hero",
      ),
    ).toBe(true);
  });

  it("does not read archived rounds or alter current progression output", () => {
    const active = activeState({
      participants: [
        participant("hero", declaration("attack_parry", "guard")),
        participant("guard", declaration("parry")),
      ],
    });
    const full = combatRoundStateSchema.parse({ ...active, rounds: [] });
    const beforeState = structuredClone(full);
    const beforeProjection = buildCombatProgressionProjection(full);
    project(active);
    expect(full).toEqual(beforeState);
    expect(buildCombatProgressionProjection(full)).toEqual(beforeProjection);
    expect(() =>
      projectCombatParticipation({
        encounterRevision: REVISION,
        modifierReviews: defaultReviews(["hero", "guard"]),
        participantAuthorities: [
          { authority: "player", participantId: "hero" },
          { authority: "gm", participantId: "guard" },
        ],
        state: full as unknown as ActiveCombatRoundState,
      }),
    ).toThrow();
  });
});

describe("combat progression participation consumption", () => {
  it("attaches canonical participation and automation eligibility to every current task", () => {
    const active = activeState({
      currentStep: "initiative_phase_1",
      participants: [
        participant("hero", declaration("attack_parry", "guard")),
        participant("guard", declaration("attack_parry", "hero")),
      ],
    });
    const participation = project(active, {
      participantAuthorities: active.participants.map((entry) => ({
        authority: "gm" as const,
        participantId: entry.participantId,
      })),
    });
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(tasks.map((task) => task.kind)).toEqual(["roll_initiative", "roll_initiative"]);
    expect(tasks.every((task) => task.participation !== undefined)).toBe(true);
    expect(
      tasks.every((task) => task.automation.participationFactId === task.participation?.factId),
    ).toBe(true);
    expect(tasks.map((task) => task.automation)).toEqual([
      expect.objectContaining({
        authority: expect.objectContaining({ kind: "gm_controlled_participant" }),
        eligibility: "eligible",
        workClass: "gm_roll",
      }),
      expect.objectContaining({
        authority: expect.objectContaining({ kind: "gm_controlled_participant" }),
        eligibility: "eligible",
        workClass: "gm_roll",
      }),
    ]);
  });

  it("retains legacy modifier review when canonical lifecycle completeness is unknown", () => {
    const active = activeState({
      currentStep: "review_action_modifiers",
      participants: [participant("hero", declaration("move_only"))],
    });
    const legacyParticipant = {
      controlledByUserId: "player-1",
      id: "scenario-hero",
      state: {
        combat: {
          combatContext: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
      },
    } as unknown as ScenarioParticipant;
    const participation = projectActiveCombatParticipation({
      encounterRevision: REVISION,
      scenarioParticipants: [legacyParticipant],
      state: active,
    });
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const task = progression.boundary.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((candidate) => candidate.kind === "modifier_review");

    expect(
      fact(participation, {
        family: "modifier_review",
        participantId: "hero",
        phase: "phase1",
      }),
    ).toMatchObject({ completeness: "legacy_incomplete", status: "blocked" });
    expect(task).toBeDefined();
  });

  it("retains complete empty M1 reviews as ordered GM checkpoints", () => {
    const active = activeState({
      currentStep: "review_action_modifiers",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "M1" },
      },
      participants: [
        participant("hero", declaration("move_only"), {
          stepStatuses: { review_action_modifiers: "pending" },
        }),
        participant("guard", declaration("move_only"), {
          stepStatuses: { review_action_modifiers: "pending" },
        }),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(tasks.filter((task) => task.kind === "modifier_review")).toHaveLength(2);
    expect(tasks).toContainEqual(
      expect.objectContaining({
        kind: "modifier_review",
        owner: expect.objectContaining({ participantId: "hero" }),
        participation: expect.objectContaining({
          completeness: "complete",
          status: "required",
          workClass: "human_decision",
        }),
      }),
    );
    expect(tasks.some((task) => task.kind === "gm_advance_boundary")).toBe(false);
  });

  it("retains a complete empty M2 review as an ordered GM checkpoint", () => {
    const active = activeState({
      currentStep: "review_phase_2_modifiers",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "M2" },
      },
      participants: [
        participant("hero", declaration("move_only"), {
          stepStatuses: { review_phase_2_modifiers: "pending" },
        }),
        participant("guard", declaration("move_only"), {
          stepStatuses: { review_phase_2_modifiers: "pending" },
        }),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(tasks.filter((task) => task.kind === "modifier_review")).toHaveLength(2);
    expect(tasks[0]?.participation).toMatchObject({
      status: "required",
      workClass: "human_decision",
    });
    expect(tasks.some((task) => task.kind === "gm_advance_boundary")).toBe(false);
  });

  it("keeps an explicitly restored empty M1 as GM-owned human work", () => {
    const active = activeState({
      currentStep: "review_action_modifiers",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "M1" },
        gmBacktrackHold: {
          participantId: "hero",
          roundNumber: 2,
          step: "review_action_modifiers",
        },
      },
      participants: [
        participant("hero", declaration("move_only"), {
          stepStatuses: { review_action_modifiers: "pending" },
        }),
        participant("guard", declaration("move_only"), {
          stepStatuses: { review_action_modifiers: "pending" },
        }),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(
      fact(participation, {
        family: "modifier_review",
        participantId: "hero",
        phase: "phase1",
      }),
    ).toMatchObject({
      completeness: "complete",
      reason: "modifier_review_required",
      status: "required",
      workClass: "human_decision",
    });
    expect(tasks).toContainEqual(
      expect.objectContaining({
        kind: "modifier_review",
        owner: expect.objectContaining({ participantId: "hero" }),
        state: "executable",
      }),
    );
    expect(tasks.some((task) => task.kind === "gm_advance_boundary")).toBe(false);
  });

  it("keeps an explicitly restored empty M2 as GM-owned human work", () => {
    const active = activeState({
      currentStep: "review_phase_2_modifiers",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "M2" },
        gmBacktrackHold: {
          participantId: "hero",
          roundNumber: 2,
          step: "review_phase_2_modifiers",
        },
      },
      participants: [
        participant("hero", declaration("move_only"), {
          stepStatuses: { review_phase_2_modifiers: "pending" },
        }),
        participant("guard", declaration("move_only"), {
          stepStatuses: { review_phase_2_modifiers: "pending" },
        }),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(
      fact(participation, {
        family: "modifier_review",
        participantId: "hero",
        phase: "phase2",
      }),
    ).toMatchObject({
      completeness: "complete",
      reason: "modifier_review_required",
      status: "required",
      workClass: "human_decision",
    });
    expect(tasks).toContainEqual(
      expect.objectContaining({
        kind: "modifier_review",
        owner: expect.objectContaining({ participantId: "hero" }),
        state: "executable",
      }),
    );
    expect(tasks.some((task) => task.kind === "gm_advance_boundary")).toBe(false);
  });

  it("turns a restored initiative commit into an explicit GM continuation", () => {
    const active = activeState({
      currentStep: "initiative_phase_1",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "i1" },
        gmBacktrackHold: {
          participantId: "hero",
          roundNumber: 2,
          step: "initiative_phase_1",
        },
      },
      participants: [participant("hero", declaration("attack_parry", "guard"))],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const commit = progression.boundary.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.kind === "commit_initiative");

    expect(commit?.participation).toMatchObject({
      reason: "unresolved_choice",
      status: "required",
      workClass: "human_decision",
    });
  });

  it("retains M1 review when a canonical proposal requires work", () => {
    const active = activeState({
      currentStep: "review_action_modifiers",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "M1" },
      },
      participants: [participant("hero", declaration("move_only"))],
    });
    const automatic = review("hero", "M1", {
      automaticProposals: [
        {
          effectId: "effect-1",
          expectedVersion: 1,
          id: "proposal-1",
          mayOverride: false,
          nextState: "expired",
          owner: "modifier_review",
          reason: "natural_expiry",
          transitionType: "expire",
        },
      ],
    });
    const participation = project(active, {
      modifierReviews: [automatic, review("hero", "M2")],
    });
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const task = progression.boundary.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((candidate) => candidate.kind === "modifier_review");

    expect(task?.participation).toMatchObject({
      completeness: "complete",
      status: "required",
      workClass: "human_decision",
    });
  });

  it("suppresses initiative without an executable action and never fabricates initiative zero", () => {
    const active = activeState({
      currentStep: "initiative_phase_1",
      overrides: {
        currentCursor: { participantId: "hero", roundNumber: 2, step: "i1" },
      },
      participants: [
        participant("hero", declaration("move_only"), {
          stepStatuses: { initiative_phase_1: "pending" },
        }),
        participant("guard", declaration("move_only"), {
          stepStatuses: { initiative_phase_1: "pending" },
        }),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(tasks.filter((task) => task.kind === "roll_initiative")).toEqual([]);
    expect(tasks).toContainEqual(
      expect.objectContaining({ kind: "commit_initiative", state: "executable" }),
    );
    expect(active.participants.every((participant) => participant.initiatives.phase1 == null)).toBe(
      true,
    );
  });

  it("opens a sole ordinary actor directly without an initiative task", () => {
    const active = activeState({
      currentStep: "initiative_phase_1",
      participants: [
        participant("hero", declaration("attack_parry", "guard")),
        participant("guard", declaration("parry")),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const tasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(tasks.filter((task) => task.kind === "roll_initiative")).toEqual([]);
    expect(tasks).toContainEqual(
      expect.objectContaining({ kind: "commit_initiative", state: "executable" }),
    );
  });

  it("retains initiative for a sole ordered Feint maneuver", () => {
    const active = activeState({
      currentStep: "initiative_phase_1",
      participants: [
        participant(
          "hero",
          declaration("feint_attack", "guard", {
            feint: {
              attackerSkillId: "sword",
              attackerSkillLabel: "Sword",
              defenderSkillId: "sword",
              defenderSkillLabel: "Sword",
              method: "weapon",
              targetParticipantId: "guard",
            },
          }),
        ),
        participant("guard", declaration("parry")),
      ],
    });
    const participation = project(active);
    const progression = buildCombatProgressionProjection(
      combatRoundStateSchema.parse({ ...active, rounds: [] }),
      { participation },
    );
    const initiativeTasks = progression.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) =>
        stage.tasks.filter((task) => task.kind === "roll_initiative"),
      ),
    );

    expect(initiativeTasks).toHaveLength(1);
    expect(initiativeTasks[0]?.owner).toMatchObject({
      kind: "combatant",
      participantId: "hero",
    });
    expect(initiativeTasks[0]?.participation).toMatchObject({
      completeness: "complete",
      status: "required",
      workClass: "player_roll",
    });
  });
});
