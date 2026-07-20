import { describe, expect, it } from "vitest";

import {
  buildCombatLogProjection,
  completedCombatRoundSchema,
  combatRoundStateSchema,
  combatStepEventSchema,
  projectCombatLogForViewer,
  projectCombatHistory,
  type CombatRoundState,
  type CombatStepEvent,
} from "../index";

const occurredAt = (minute: number) => `2026-07-20T10:${String(minute).padStart(2, "0")}:00.000Z`;

function event(
  input: Partial<CombatStepEvent> & Pick<CombatStepEvent, "id" | "sequence" | "type">,
): CombatStepEvent {
  return combatStepEventSchema.parse({
    completeness: "complete",
    encounterId: "encounter-1",
    facts: {
      gmReview: {},
      involvedOutcome: {},
      publicOutcome: {},
      rollerPrivate: {},
    },
    missingFacts: [],
    occurredAt: occurredAt(input.sequence + 1),
    roundNumber: 1,
    schemaVersion: 1,
    source: { kind: "canonical", sourceIds: [input.id] },
    status: "recorded",
    step: "phase_1_actions",
    visibility: {
      identityRefs: [],
      involvedParticipantIds: [],
      outcomeScope: "involved",
    },
    ...input,
  });
}

function state(overrides: Partial<CombatRoundState> = {}): CombatRoundState {
  return combatRoundStateSchema.parse({
    encounterId: "encounter-1",
    participants: [
      { label: "The Gladiator", participantId: "gladiator" },
      { label: "Scyrian Cavalry", participantId: "scyrian" },
    ],
    roundNumber: 1,
    ...overrides,
  });
}

function project(roundState: CombatRoundState) {
  return buildCombatLogProjection({
    encounterId: "encounter-1",
    sourceRevision: "revision-7",
    state: roundState,
  });
}

describe("CombatLogProjection", () => {
  it("projects round openings and declaration facts with action and target context", () => {
    const roundState = state({
      participants: [
        {
          attackResults: {},
          declaration: {
            actionId: "attack_parry",
            phaseContexts: {
              phase1: {
                modifierBuckets: {
                  general: [],
                  situationDb: [],
                  situationInitiative: [],
                  situationObSkill: [],
                },
                targetParticipantId: "scyrian",
              },
            },
            roundNumber: 1,
            submittedAt: occurredAt(1),
            submittedBy: "player",
          },
          label: "The Gladiator",
          initiatives: {},
          participantId: "gladiator",
          stepStatuses: {},
        },
        {
          attackResults: {},
          declaration: {
            actionId: "double_attack",
            phaseContexts: {
              phase1: {
                modifierBuckets: {
                  general: [],
                  situationDb: [],
                  situationInitiative: [],
                  situationObSkill: [],
                },
                targetParticipantId: "gladiator",
              },
            },
            roundNumber: 1,
            submittedAt: occurredAt(2),
            submittedBy: "player",
          },
          label: "Scyrian Cavalry",
          initiatives: {},
          participantId: "scyrian",
          stepStatuses: {},
        },
      ],
    });

    const result = project(roundState);

    expect(result.events.map((entry) => entry.summary)).toEqual([
      "Round 1 began.",
      "The Gladiator declared Single Attack against Scyrian Cavalry.",
      "Scyrian Cavalry declared Double Attack against The Gladiator.",
    ]);
    expect(result.events[1]).toMatchObject({
      actor: { participantId: "gladiator" },
      category: "declaration",
      phase: "declaration",
      summaryFacts: { actionId: "attack_parry", kind: "declaration_submitted" },
      target: { participantId: "scyrian" },
    });
  });

  it("projects final attacks, narratively relevant parries, and committed damage", () => {
    const events = [
      event({
        actorParticipantId: "gladiator",
        attackResultId: "attack-hit",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "scyrian",
        facts: {
          gmReview: {},
          involvedOutcome: {
            actionId: "attack_parry",
            attackOpportunityId: "opportunity-1",
            hit: true,
            weaponName: "Long Sword",
          },
          publicOutcome: { hit: true },
          rollerPrivate: { modifier: -2, rollD20: 17, rollTotal: 17 },
        },
        id: "attack-event-hit",
        sequence: 0,
        targetParticipantId: "scyrian",
        type: "attack",
      }),
      event({
        actorParticipantId: "scyrian",
        attackResultId: "attack-hit",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "scyrian",
        facts: {
          gmReview: {},
          involvedOutcome: { status: "resolved", success: false },
          publicOutcome: { status: "resolved", success: false },
          rollerPrivate: { rollD20: 4, total: 8 },
        },
        id: "parry-event-failed",
        parryResultId: "parry-1",
        sequence: 1,
        targetParticipantId: "gladiator",
        type: "parry",
      }),
      event({
        actorParticipantId: "gladiator",
        attackResultId: "attack-hit",
        attackerParticipantId: "gladiator",
        damageResultId: "damage-1",
        defenderParticipantId: "scyrian",
        facts: {
          gmReview: { calculation: "private", notes: "private" },
          involvedOutcome: { finalCommittedDamage: 8 },
          publicOutcome: { status: "committed" },
          rollerPrivate: { dice: [8], modifierTotal: 3 },
        },
        id: "damage-event",
        sequence: 2,
        status: "committed",
        targetParticipantId: "scyrian",
        type: "damage_committed",
      }),
      event({
        actorParticipantId: "scyrian",
        attackResultId: "attack-parried",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "scyrian",
        facts: {
          gmReview: {},
          involvedOutcome: { status: "resolved", success: true },
          publicOutcome: { status: "resolved", success: true },
          rollerPrivate: { rollD20: 20 },
        },
        id: "parry-event-success",
        parryResultId: "parry-2",
        sequence: 3,
        targetParticipantId: "gladiator",
        type: "parry",
      }),
      event({
        actorParticipantId: "gladiator",
        attackResultId: "attack-miss",
        attackerParticipantId: "gladiator",
        defenderParticipantId: "scyrian",
        facts: {
          gmReview: {},
          involvedOutcome: { hit: false, weaponName: "Long Sword" },
          publicOutcome: { grazing: false, hit: false },
          rollerPrivate: { rollD20: 1 },
        },
        id: "attack-event-miss",
        sequence: 4,
        targetParticipantId: "scyrian",
        type: "attack",
      }),
    ];

    const result = project(state({ events }));
    const summaries = result.events.map((entry) => entry.summary);

    expect(summaries).toContain(
      "The Gladiator attacked Scyrian Cavalry with Long Sword. The attack hit.",
    );
    expect(summaries).toContain("Scyrian Cavalry’s parry failed.");
    expect(summaries).toContain("Scyrian Cavalry’s parry succeeded.");
    expect(summaries).toContain("Scyrian Cavalry suffered 8 damage.");
    expect(summaries).toContain(
      "The Gladiator attacked Scyrian Cavalry with Long Sword. The attack missed.",
    );
    expect(
      result.events.find((entry) => entry.summaryFacts.kind === "attack_resolved"),
    ).toMatchObject({
      attackResultId: "attack-hit",
      detailResultId: "attack-hit",
      opportunityId: "opportunity-1",
      presentationTargetId: "combat-presentation:attack:attack-hit",
      presentationTargetKind: "attack",
      presentationTargetSourceId: "attack-hit",
    });
    expect(JSON.stringify(result)).not.toMatch(/rollD20|modifierTotal|calculation|private/);
  });

  it("projects Feint attempt, resistance, and only the committed final result", () => {
    const proposal = {
      attackerParticipantId: "gladiator",
      attackerRoll: {
        adjustment: 0,
        characteristic: "dex" as const,
        characteristicValue: 12,
        finalTotal: 23,
        id: "feint-attacker-roll",
        openEndedD10s: [],
        participantId: "gladiator",
        rollD20: 11,
        rollTotal: 11,
        rolledAt: occurredAt(2),
        skillId: "skill-1",
        skillLabel: "Long Sword",
        skillXp: 12,
      },
      attackerRollRecorded: true,
      attackerSkillId: "skill-1",
      attackerSkillLabel: "Long Sword",
      defenderParticipantId: "scyrian",
      defenderRollRecorded: true,
      defenderSkillId: "skill-2",
      defenderSkillLabel: "Close Combat",
      difference: -2,
      feasibility: "possible" as const,
      feasibilityAdjustment: 0,
      id: "feint-proposal",
      method: "weapon" as const,
      pairId: "gladiator::scyrian",
      phase1OpportunityId: "feint-a1",
      phase2AttackOpportunityId: "feint-a2",
      review: { proposedAttackerDbParryModifier: -1, proposedDefenderObDbModifier: 0 },
      roundNumber: 1,
      status: "committed" as const,
      tableResult: {
        attackerPhase1DbParryModifier: -1,
        band: "balanced" as const,
        defenderObDbModifier: 0,
      },
    };
    const events = [
      event({
        actorParticipantId: "gladiator",
        facts: {
          gmReview: {},
          involvedOutcome: { proposalId: proposal.id, side: "defender" },
          publicOutcome: {},
          rollerPrivate: { rollD20: 14 },
        },
        id: "feint-defender-roll-event",
        sequence: 1,
        targetParticipantId: "scyrian",
        type: "feint_roll",
      }),
      event({
        actorParticipantId: "gladiator",
        facts: {
          gmReview: { notes: "do not show" },
          involvedOutcome: { difference: -2, proposalId: proposal.id },
          publicOutcome: {},
          rollerPrivate: {},
        },
        id: "feint-proposed-event",
        sequence: 2,
        status: "proposed",
        targetParticipantId: "scyrian",
        type: "feint_result",
      }),
      event({
        actorParticipantId: "gladiator",
        facts: {
          gmReview: { notes: "do not show" },
          involvedOutcome: { difference: -2, proposalId: proposal.id },
          publicOutcome: {},
          rollerPrivate: {},
        },
        id: "feint-committed-event",
        sequence: 3,
        status: "committed",
        targetParticipantId: "scyrian",
        type: "feint_committed",
      }),
    ];

    const result = project(state({ events, feintProposals: [proposal] }));

    expect(result.events.map((entry) => entry.summary)).toEqual([
      "Round 1 began.",
      "The Gladiator attempted to feint Scyrian Cavalry.",
      "Scyrian Cavalry attempted to resist The Gladiator’s feint.",
      "The Gladiator’s feint failed.",
    ]);
    expect(
      result.events.some((entry) => entry.sourceEventIds.includes("feint-proposed-event")),
    ).toBe(false);
  });

  it("projects Adjust Distance attempt, response, final contest, and committed movement", () => {
    const proposal = {
      attackerParticipantId: "scyrian",
      attackerRollRecorded: true,
      currentDistance: 3 as const,
      defenderParticipantId: "gladiator",
      defenderResponse: "oppose" as const,
      defenderRollRecorded: true,
      difference: 4,
      direction: "closer" as const,
      id: "distance-proposal",
      pairId: "gladiator::scyrian",
      phase1OpportunityId: "distance-a1",
      phase2AttackOpportunityId: "distance-a2",
      requestedDistance: 2 as const,
      review: { acceptedOutcome: "successful" as const, committedDistance: 2 as const },
      roundNumber: 1,
      standardOutcome: "successful" as const,
      standardProposedDistance: 2 as const,
      status: "committed" as const,
    };
    const events = [
      event({
        actorParticipantId: "gladiator",
        facts: {
          gmReview: {},
          involvedOutcome: { proposalId: proposal.id, response: "oppose" },
          publicOutcome: {},
          rollerPrivate: {},
        },
        id: "distance-response-event",
        sequence: 0,
        targetParticipantId: "scyrian",
        type: "adjust_distance_response",
      }),
      event({
        actorParticipantId: "scyrian",
        facts: {
          gmReview: { notes: "private" },
          involvedOutcome: {
            committedDistance: 2,
            outcome: "successful",
            previousDistance: 3,
            proposalId: proposal.id,
          },
          publicOutcome: {},
          rollerPrivate: {},
        },
        id: "distance-commit-event",
        sequence: 1,
        status: "committed",
        targetParticipantId: "gladiator",
        type: "adjust_distance_committed",
      }),
    ];

    const result = project(state({ adjustDistanceProposals: [proposal], events }));

    expect(result.events.map((entry) => entry.summary)).toEqual([
      "Round 1 began.",
      "Scyrian Cavalry attempted to move closer to The Gladiator.",
      "The Gladiator opposed the movement.",
      "Scyrian Cavalry won the distance contest.",
      "Distance between Scyrian Cavalry and The Gladiator changed from 3 to 2.",
    ]);
    expect(result.events.at(-1)).toMatchObject({
      detailResultId: proposal.id,
      presentationTargetId: `combat-presentation:maneuver:${proposal.id}`,
      presentationTargetKind: "maneuver",
      presentationTargetSourceId: proposal.id,
      proposalId: proposal.id,
      summaryFacts: { kind: "distance_changed", nextDistance: 2, previousDistance: 3 },
    });
  });

  it("excludes routine mechanics and proposal-only results", () => {
    const excludedTypes = [
      "initiative",
      "damage_proposed",
      "health_check",
      "adjust_distance_adjustment",
    ] as const;
    const events = excludedTypes.map((type, sequence) =>
      event({
        facts: {
          gmReview: { notes: "secret" },
          involvedOutcome: { proposedDamage: 12 },
          publicOutcome: {},
          rollerPrivate: { calculation: "10 + 2", rollD20: 10 },
        },
        id: `excluded-${type}`,
        sequence,
        status: type === "damage_proposed" ? "proposed" : "recorded",
        type,
      }),
    );

    expect(project(state({ events })).events).toEqual([
      expect.objectContaining({ category: "round", summary: "Round 1 began." }),
    ]);
  });

  it("projects committed bleed damage and participant review without raw Health facts", () => {
    const review = event({
      actorParticipantId: "scyrian",
      facts: {
        gmReview: { acceptedHealthRollIds: ["health-roll"] },
        involvedOutcome: {
          damageApplied: [{ amount: 2, bleedType: "internal", proposalId: "bleed-1" }],
          status: "complete",
        },
        publicOutcome: {},
        rollerPrivate: { healthRoll: 18 },
      },
      id: "su-review-event",
      ownerParticipantId: "scyrian",
      sequence: 0,
      status: "committed",
      step: "round_summary",
      type: "participant_su_review",
    });

    const result = project(state({ events: [review] }));

    expect(result.events.map((entry) => entry.summary)).toContain(
      "Scyrian Cavalry suffered 2 damage from internal bleeding.",
    );
    expect(result.events.map((entry) => entry.summary)).toContain(
      "Scyrian Cavalry completed round-end review.",
    );
    expect(JSON.stringify(result)).not.toMatch(/healthRoll|acceptedHealthRollIds/);
  });

  it("is deterministic, immutable, reload-idempotent, and removes undone source events only", () => {
    const attack = event({
      actorParticipantId: "gladiator",
      attackResultId: "attack-1",
      attackerParticipantId: "gladiator",
      defenderParticipantId: "scyrian",
      facts: {
        gmReview: {},
        involvedOutcome: { hit: true },
        publicOutcome: { hit: true },
        rollerPrivate: {},
      },
      id: "attack-event",
      sequence: 0,
      targetParticipantId: "scyrian",
      type: "attack",
    });
    const roundState = state({ events: [attack] });
    const originalState = structuredClone(roundState);
    const first = project(roundState);
    const reloaded = project(combatRoundStateSchema.parse(JSON.parse(JSON.stringify(roundState))));

    expect(reloaded).toEqual(first);
    expect(roundState).toEqual(originalState);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.events)).toBe(true);
    expect(Object.isFrozen(first.events[0])).toBe(true);
    expect(first.events.map((entry) => entry.sequence)).toEqual([0, 1]);
    expect(new Set(first.events.map((entry) => entry.id)).size).toBe(first.events.length);

    const afterUndo = project(state({ events: [] }));
    expect(afterUndo.events.map((entry) => entry.category)).toEqual(["round"]);
    expect(afterUndo.events[0]?.id).toBe(first.events[0]?.id);
  });

  it("orders archived and active rounds oldest-to-newest without reinterpreting snapshots", () => {
    const active = state({
      roundNumber: 2,
      rounds: [
        completedCombatRoundSchema.parse({
          currentStep: "round_summary",
          encounterId: "encounter-1",
          participants: state().participants,
          roundNumber: 1,
        }),
      ],
    });

    const result = project(active);

    expect(result.events.map((entry) => entry.summary)).toEqual([
      "Round 1 began.",
      "Round 2 began.",
    ]);
    expect(result.events.map((entry) => entry.sequence)).toEqual([0, 1]);
  });

  it("projects the same ordered log through GM and player viewer boundaries", () => {
    const roundState = state();
    const participants = roundState.participants.map((participant) => ({
      displayName: participant.label,
      participantId: participant.participantId,
    }));
    const gm = projectCombatHistory({
      participants,
      sourceUpdatedAt: "revision-7",
      state: roundState,
      viewer: { kind: "gm" },
    });
    const player = projectCombatHistory({
      participants,
      sourceUpdatedAt: "revision-7",
      state: roundState,
      viewer: {
        controlledParticipantIds: new Set(["gladiator"]),
        kind: "player",
        visibleParticipantIds: new Set(["gladiator", "scyrian"]),
      },
    });

    expect(gm.combatLog).toMatchObject({
      encounterId: "encounter-1",
      sourceRevision: "revision-7",
    });
    expect(player.combatLog).toMatchObject({
      encounterId: "encounter-1",
      sourceRevision: "revision-7",
    });
    expect(player.combatLog?.events).toHaveLength(gm.combatLog?.events.length ?? 0);
  });

  it("uses viewer-relative wording and removes private presentation targets for uninvolved players", () => {
    const roundState = state({
      events: [
        event({
          actorParticipantId: "gladiator",
          attackResultId: "attack-result-1",
          facts: {
            gmReview: {},
            involvedOutcome: {},
            publicOutcome: { hit: true },
            rollerPrivate: {},
          },
          id: "attack-event",
          sequence: 1,
          targetParticipantId: "scyrian",
          type: "attack",
        }),
      ],
    });
    const projection = project(roundState);
    const actorView = projectCombatLogForViewer({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["gladiator"]),
        kind: "player",
        visibleParticipantIds: new Set(["gladiator", "scyrian"]),
      },
    });
    const targetView = projectCombatLogForViewer({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["scyrian"]),
        kind: "player",
        visibleParticipantIds: new Set(["gladiator", "scyrian"]),
      },
    });
    const otherView = projectCombatLogForViewer({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["other"]),
        kind: "player",
        visibleParticipantIds: new Set(["other"]),
      },
    });

    const actorEvent = actorView.events.find((entry) => entry.id.includes("attack-event"));
    const targetEvent = targetView.events.find((entry) => entry.id.includes("attack-event"));
    const otherEvent = otherView.events.find((entry) => entry.id.includes("attack-event"));
    expect(actorEvent?.summary).toContain("you attacked Scyrian Cavalry");
    expect(targetEvent?.summary).toContain("The Gladiator attacked you");
    expect(actorEvent?.presentationTargetId).toBeDefined();
    expect(targetEvent?.presentationTargetId).toBeDefined();
    expect(otherEvent?.summary).toContain("another combatant");
    expect(otherEvent?.presentationTargetId).toBeUndefined();
    expect(otherEvent?.detailResultId).toBeUndefined();
    expect(otherEvent?.attackResultId).toBeUndefined();
    expect(otherEvent?.sequence).toBe(actorEvent?.sequence);
    expect(otherEvent?.sourceRevision).toBe("revision-7");
  });

  it("preserves event identity, category, ordering, and state during sanitization", () => {
    const projection = project(state());
    const player = projectCombatLogForViewer({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["gladiator"]),
        kind: "player",
        visibleParticipantIds: new Set(["gladiator", "scyrian"]),
      },
    });
    expect(player.events.map((entry) => [entry.id, entry.category, entry.sequence, entry.state])).toEqual(
      projection.events.map((entry) => [entry.id, entry.category, entry.sequence, entry.state]),
    );
  });
});
