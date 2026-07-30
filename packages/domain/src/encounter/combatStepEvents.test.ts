import { describe, expect, it } from "vitest";

import {
  combatRoundCommandSchema,
  combatRoundEndReviewSchema,
  combatRoundParticipantStateSchema,
  combatRoundPhaseResolutionResultSchema,
  combatRoundStepSnapshotSchema,
  combatStepEventSchema,
  combatStepEventStatusSchema,
  combatStepEventTypeSchema,
  deriveLegacyCombatStepEvents,
  type CombatRoundCommand,
} from "../index";

const ENCOUNTER_ID = "encounter-1";
const ATTACKER_ID = "attacker-1";
const DEFENDER_ID = "defender-1";
const ATTACK_RESULT_ID = `1:phase1:${ATTACKER_ID}:${DEFENDER_ID}`;

function command(input: {
  createdAt: string;
  facts?: Record<string, unknown>;
  id: string;
  participantId: string;
  phase?: "phase1" | "phase2";
  step?: "DE" | "M2" | "i1" | "A1" | "P1" | "D1" | "SU";
  type: CombatRoundCommand["type"];
}): CombatRoundCommand {
  const step = input.step ?? "DE";
  return combatRoundCommandSchema.parse({
    afterCursor: { participantId: input.participantId, roundNumber: 1, step },
    beforeCursor: { participantId: input.participantId, roundNumber: 1, step },
    createdAt: input.createdAt,
    facts: input.facts ?? {},
    id: input.id,
    participantId: input.participantId,
    phase: input.phase,
    roundNumber: 1,
    step,
    type: input.type,
  });
}

function attackResult(rolledAt = "2026-01-01T00:03:00.000Z") {
  return {
    actionId: "single_attack",
    attackerParticipantId: ATTACKER_ID,
    defenderDb: 8,
    defenderParryModifier: -1,
    defenderParticipantId: DEFENDER_ID,
    grazing: false,
    hit: true,
    kind: "attackRoll" as const,
    lookupTotal: 26,
    marginOverMissThreshold: 5,
    ob: 12,
    openEndedD10s: [4],
    phase: "phase1" as const,
    rollD20: 18,
    rollTotal: 22,
    rolledAt,
    tableResult: "Hit",
    weaponName: "Broad sword",
  };
}

function participants() {
  return [
    combatRoundParticipantStateSchema.parse({
      attackResults: { phase1: attackResult() },
      declaration: {
        actionId: "single_attack",
        roundNumber: 1,
        submittedAt: "2026-01-01T00:01:00.000Z",
        submittedBy: "player",
      },
      initiatives: {
        phase1: {
          baseInitiative: 3,
          modifierAdjustment: 1,
          rolls: [5],
          rollTotal: 5,
          total: 9,
        },
      },
      label: "Not projected into events",
      participantId: ATTACKER_ID,
    }),
    combatRoundParticipantStateSchema.parse({
      label: "Also not projected",
      participantId: DEFENDER_ID,
    }),
  ];
}

function attackResolution() {
  return combatRoundPhaseResolutionResultSchema.parse({
    attackResultId: ATTACK_RESULT_ID,
    attackerParticipantId: ATTACKER_ID,
    criticalRoll: {
      armorCriticalModifier: 0,
      attackResultId: ATTACK_RESULT_ID,
      attackerParticipantId: ATTACKER_ID,
      criticalDice: [5, 6],
      criticalDiceTotal: 11,
      criticalGrade: "B",
      criticalTypeModifier: 1,
      defenderParticipantId: DEFENDER_ID,
      finalCriticalRoll: 12,
      rolledAt: "2026-01-01T00:06:00.000Z",
      rolledByParticipantId: ATTACKER_ID,
      selectedHitLocation: "chest",
      status: "rolled",
    },
    damageProposal: {
      committedCombatEffectEventId: "effect-event-1",
      committedCombatEffectIds: ["effect-1"],
      proposedEffects: [],
      status: "committed",
    },
    damageRoll: { rolls: [4], status: "rolled", total: 4 },
    damageResult: {
      armorCoverage: {},
      attackResultId: ATTACK_RESULT_ID,
      attackerParticipantId: ATTACKER_ID,
      createdAt: "2026-01-01T00:05:00.000Z",
      criticalGrade: "B",
      damageRoll: { required: true, rolls: [4], total: 4 },
      defenderDm: -2,
      defenderParticipantId: DEFENDER_ID,
      dmb: 6,
      grazing: false,
      kind: "damage_result",
      parryResultId: "parry-result-1",
      phase: "phase1",
      review: {
        additionalEffects: [],
        notes: "GM-only review note",
        operationalConsequences: [],
      },
      selectedHitLocation: "chest",
      totalDamage: 7,
    },
    defenderParticipantId: DEFENDER_ID,
    hitLocationRoll: {
      attackResultId: ATTACK_RESULT_ID,
      attackerParticipantId: ATTACKER_ID,
      defenderParticipantId: DEFENDER_ID,
      hitLocationRolls: [12],
      rolledAt: "2026-01-01T00:04:30.000Z",
      rolledByParticipantId: ATTACKER_ID,
      selectedHitLocation: "chest",
      selectedHitLocationRoll: 12,
      selectionReason: "single_roll",
      status: "rolled",
      targetLocation: "none",
    },
    parryResolution: {
      combinedParryScore: 8,
      modifierAdjustment: -1,
      modifierBreakdown: [{ label: "DB/Parry", value: -1 }],
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 9,
      rollTotal: 9,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 16,
    },
    phase: "phase1",
    roundNumber: 1,
    updatedAt: "2026-01-01T00:07:00.000Z",
  });
}

function attackCommands(): CombatRoundCommand[] {
  return [
    command({
      createdAt: "2026-01-01T00:01:00.000Z",
      facts: { actionId: "single_attack" },
      id: "command-declaration",
      participantId: ATTACKER_ID,
      type: "declare_action",
    }),
    command({
      createdAt: "2026-01-01T00:02:00.000Z",
      id: "command-initiative",
      participantId: ATTACKER_ID,
      phase: "phase1",
      step: "i1",
      type: "roll_initiative_phase1",
    }),
    command({
      createdAt: "2026-01-01T00:03:00.000Z",
      facts: { attackResultId: ATTACK_RESULT_ID, defenderParticipantId: DEFENDER_ID },
      id: "command-attack",
      participantId: ATTACKER_ID,
      phase: "phase1",
      step: "A1",
      type: "roll_attack",
    }),
    command({
      createdAt: "2026-01-01T00:04:00.000Z",
      facts: {
        attackResultId: ATTACK_RESULT_ID,
        attackerParticipantId: ATTACKER_ID,
        defenderParticipantId: DEFENDER_ID,
        success: false,
      },
      id: "command-parry",
      participantId: DEFENDER_ID,
      phase: "phase1",
      step: "P1",
      type: "roll_parry",
    }),
    command({
      createdAt: "2026-01-01T00:04:30.000Z",
      facts: {
        attackResultId: ATTACK_RESULT_ID,
        attackerParticipantId: ATTACKER_ID,
        defenderParticipantId: DEFENDER_ID,
        rolledByParticipantId: ATTACKER_ID,
      },
      id: "command-location",
      participantId: DEFENDER_ID,
      phase: "phase1",
      step: "D1",
      type: "roll_hit_location",
    }),
    command({
      createdAt: "2026-01-01T00:05:00.000Z",
      facts: {
        attackResultId: ATTACK_RESULT_ID,
        attackerParticipantId: ATTACKER_ID,
        damageResultId: `${ATTACK_RESULT_ID}:damage`,
        defenderParticipantId: DEFENDER_ID,
      },
      id: "command-damage-proposal",
      participantId: DEFENDER_ID,
      phase: "phase1",
      step: "D1",
      type: "resolve_damage",
    }),
    command({
      createdAt: "2026-01-01T00:06:00.000Z",
      facts: {
        attackResultId: ATTACK_RESULT_ID,
        attackerParticipantId: ATTACKER_ID,
        defenderParticipantId: DEFENDER_ID,
        rolledByParticipantId: ATTACKER_ID,
      },
      id: "command-critical",
      participantId: DEFENDER_ID,
      phase: "phase1",
      step: "D1",
      type: "roll_critical",
    }),
    command({
      createdAt: "2026-01-01T00:07:00.000Z",
      facts: {
        attackResultId: ATTACK_RESULT_ID,
        attackerParticipantId: ATTACKER_ID,
        createdCombatEffectEventId: "effect-event-1",
        createdCombatEffectIds: ["effect-1"],
        defenderParticipantId: DEFENDER_ID,
        finalCommittedDamage: 7,
      },
      id: "command-damage-commit",
      participantId: DEFENDER_ID,
      phase: "phase1",
      step: "D1",
      type: "commit_phase_damage",
    }),
  ];
}

describe("CombatStepEvent schema", () => {
  it("accepts the canonical shape with typed visibility and separated facts", () => {
    const event = combatStepEventSchema.parse({
      actorParticipantId: ATTACKER_ID,
      combatEffectIds: [],
      completeness: "legacy_derived",
      encounterId: ENCOUNTER_ID,
      facts: {
        gmReview: { override: 2 },
        involvedOutcome: { tableResult: "Hit" },
        publicOutcome: { hit: true },
        rollerPrivate: { rollD20: 18 },
      },
      id: "event-1",
      missingFacts: [],
      occurredAt: "2026-01-01T00:03:00.000Z",
      ownerParticipantId: ATTACKER_ID,
      phase: "phase1",
      rollerParticipantId: ATTACKER_ID,
      roundNumber: 1,
      schemaVersion: 1,
      sequence: 0,
      source: { commandType: "roll_attack", kind: "legacy_command", sourceIds: ["c1"] },
      status: "recorded",
      step: "phase_1_actions",
      type: "attack",
      visibility: {
        identityRefs: [
          {
            hiddenIdentityFallback: "unseen_attacker",
            participantId: ATTACKER_ID,
            role: "attacker",
          },
        ],
        involvedParticipantIds: [ATTACKER_ID, DEFENDER_ID],
        outcomeScope: "involved",
        rollerParticipantId: ATTACKER_ID,
      },
    });

    expect(event.facts.publicOutcome).toEqual({ hit: true });
    expect(event.facts.rollerPrivate).toEqual({ rollD20: 18 });
    expect(event.visibility.identityRefs[0]?.role).toBe("attacker");
  });

  it("enforces event type and status unions", () => {
    expect(combatStepEventTypeSchema.safeParse("attack").success).toBe(true);
    expect(combatStepEventTypeSchema.safeParse("unknown_event").success).toBe(false);
    expect(combatStepEventStatusSchema.safeParse("committed").success).toBe(true);
    expect(combatStepEventStatusSchema.safeParse("latest").success).toBe(false);
  });
});

describe("deriveLegacyCombatStepEvents", () => {
  it("derives a linked chronological attack chain without display names", () => {
    const events = deriveLegacyCombatStepEvents({
      commands: attackCommands(),
      encounterId: ENCOUNTER_ID,
      participants: participants(),
      phaseResolutionResults: [attackResolution()],
      roundNumber: 1,
    });
    const byType = Object.fromEntries(events.map((event) => [event.type, event]));

    expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index));
    expect(events.map((event) => event.type)).toEqual([
      "declaration",
      "initiative",
      "attack",
      "parry",
      "hit_location",
      "damage_proposed",
      "critical",
      "damage_committed",
    ]);
    expect(byType.attack).toMatchObject({
      attackResultId: ATTACK_RESULT_ID,
      attackerParticipantId: ATTACKER_ID,
      commandId: "command-attack",
      defenderParticipantId: DEFENDER_ID,
      facts: {
        involvedOutcome: {
          actionId: "single_attack",
        },
      },
      ownerParticipantId: ATTACKER_ID,
    });
    expect(byType.parry).toMatchObject({
      attackResultId: ATTACK_RESULT_ID,
      ownerParticipantId: DEFENDER_ID,
      parryResultId: "parry-result-1",
      step: "review_phase_2_actions",
    });
    expect(byType.hit_location.attackResultId).toBe(ATTACK_RESULT_ID);
    expect(byType.critical.attackResultId).toBe(ATTACK_RESULT_ID);
    expect(byType.damage_proposed.damageResultId).toBe(`${ATTACK_RESULT_ID}:damage`);
    expect(byType.damage_committed.combatEffectIds).toEqual(["effect-1"]);
    expect(JSON.stringify(events)).not.toContain("Not projected into events");
    expect(JSON.stringify(events)).not.toContain("Also not projected");
  });

  it("is deterministic and preserves repeated event occurrence order", () => {
    const repeated = participants();
    repeated[0] = combatRoundParticipantStateSchema.parse({
      ...repeated[0],
      attackResults: {
        phase1: attackResult("2026-01-01T00:03:00.000Z"),
        phase2: { ...attackResult("2026-01-01T00:08:00.000Z"), phase: "phase2" },
      },
    });
    const input = {
      encounterId: ENCOUNTER_ID,
      participants: repeated,
      roundNumber: 1,
    };

    const first = deriveLegacyCombatStepEvents(input);
    const second = deriveLegacyCombatStepEvents(input);
    const attacks = first.filter((event) => event.type === "attack");

    expect(second).toEqual(first);
    expect(attacks.map((event) => event.phase)).toEqual(["phase1", "phase2"]);
    expect(new Set(attacks.map((event) => event.id)).size).toBe(2);
  });

  it("uses command order and stable source indexes when timestamps tie", () => {
    const tiedCommands = attackCommands()
      .slice(0, 3)
      .map((entry) => ({
        ...entry,
        createdAt: "2026-01-01T00:00:00.000Z",
      }));
    const tiedParticipants = participants();
    tiedParticipants[0] = combatRoundParticipantStateSchema.parse({
      ...tiedParticipants[0],
      declaration: {
        ...tiedParticipants[0]?.declaration,
        submittedAt: "2026-01-01T00:00:00.000Z",
      },
      attackResults: {
        phase1: attackResult("2026-01-01T00:00:00.000Z"),
      },
    });
    const events = deriveLegacyCombatStepEvents({
      commands: tiedCommands,
      encounterId: ENCOUNTER_ID,
      participants: tiedParticipants,
      roundNumber: 1,
    });

    expect(events.slice(0, 3).map((event) => event.type)).toEqual([
      "declaration",
      "initiative",
      "attack",
    ]);
  });

  it("keeps dice private and GM review separate from outcomes", () => {
    const events = deriveLegacyCombatStepEvents({
      commands: attackCommands(),
      encounterId: ENCOUNTER_ID,
      participants: participants(),
      phaseResolutionResults: [attackResolution()],
      roundNumber: 1,
    });
    const attack = events.find((event) => event.type === "attack");
    const proposal = events.find((event) => event.type === "damage_proposed");

    expect(attack?.facts.rollerPrivate).toMatchObject({ rollD20: 18, rollTotal: 22 });
    expect(attack?.facts.publicOutcome).toEqual({ grazing: false, hit: true });
    expect(attack?.facts.publicOutcome).not.toHaveProperty("rollD20");
    expect(proposal?.facts.gmReview).toMatchObject({ notes: "GM-only review note" });
    expect(proposal?.facts.involvedOutcome).not.toHaveProperty("notes");
  });

  it("derives Combat Experience as an involved result without making its roll public", () => {
    const events = deriveLegacyCombatStepEvents({
      commands: [
        command({
          createdAt: "2026-01-01T00:01:00.000Z",
          facts: {
            difficulty: 26,
            finalTotal: 27,
            openEndedD10s: [],
            resultBand: "active",
            resultLabel: "Active",
            rollD20: 17,
            rollTotal: 17,
            skillTotal: 10,
          },
          id: "command-combat-experience",
          participantId: ATTACKER_ID,
          type: "roll_combat_experience",
        }),
      ],
      encounterId: ENCOUNTER_ID,
      roundNumber: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorParticipantId: ATTACKER_ID,
      completeness: "legacy_derived",
      facts: {
        involvedOutcome: {
          resultBand: "active",
          resultLabel: "Active",
          success: true,
        },
        publicOutcome: {},
        rollerPrivate: {
          difficulty: 26,
          finalTotal: 27,
          rollD20: 17,
          rollTotal: 17,
          skillTotal: 10,
        },
      },
      ownerParticipantId: ATTACKER_ID,
      rollerParticipantId: ATTACKER_ID,
      step: "select_actions",
      type: "combat_experience",
      visibility: {
        involvedParticipantIds: [ATTACKER_ID],
        outcomeScope: "involved",
        rollerParticipantId: ATTACKER_ID,
      },
    });
  });

  it("places phase Combat Experience in its action facet with opportunity and threat identity", () => {
    const events = deriveLegacyCombatStepEvents({
      commands: [
        command({
          createdAt: "2026-01-01T00:02:00.000Z",
          facts: {
            difficulty: 26,
            finalTotal: 18,
            modifierValue: -2,
            opportunityId: "phase2-opportunity",
            phaseAttackCancelled: false,
            phaseCombatExperienceThreats: [{ attackerParticipantId: DEFENDER_ID }],
            resultBand: "active_penalty",
            resultLabel: "Attack continues",
            rollD20: 8,
            rollTotal: 8,
            skillTotal: 10,
          },
          id: "command-phase2-combat-experience",
          participantId: ATTACKER_ID,
          phase: "phase2",
          step: "A1",
          type: "roll_combat_experience",
        }),
      ],
      encounterId: ENCOUNTER_ID,
      roundNumber: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      opportunityId: "phase2-opportunity",
      phase: "phase2",
      step: "phase_2_actions",
      targetParticipantId: DEFENDER_ID,
      visibility: {
        involvedParticipantIds: [ATTACKER_ID, DEFENDER_ID],
      },
    });
  });

  it("publishes the selected declaration facts and public note without unselected options", () => {
    const declaredParticipant = combatRoundParticipantStateSchema.parse({
      declaration: {
        actionId: "parry",
        additionalActionNotes: "Hold the doorway.",
        movementIntent: { distancePreferences: [], mode: "hold_position" },
        roundNumber: 1,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: DEFENDER_ID,
        },
        secondaryActionId: "observe_opponent",
        submittedAt: "2026-01-01T00:01:00.000Z",
        submittedBy: "gm",
      },
      label: "Observer",
      participantId: ATTACKER_ID,
    });
    const events = deriveLegacyCombatStepEvents({
      commands: [
        command({
          createdAt: "2026-01-01T00:01:00.000Z",
          id: "declaration-command",
          participantId: ATTACKER_ID,
          type: "declare_action",
        }),
      ],
      encounterId: ENCOUNTER_ID,
      participants: [declaredParticipant],
      roundNumber: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      facts: {
        involvedOutcome: {
          actionId: "parry",
          actionLabel: "Parry",
          additionalActionNotes: "Hold the doorway.",
          movementLabel: "Hold position",
          secondaryActionLabel: "Observe Opponent",
          submittedBy: "gm",
          targetParticipantId: DEFENDER_ID,
        },
        resultPresentation: {
          publicCombatNote: "Hold the doorway.",
        },
      },
      targetParticipantId: DEFENDER_ID,
      type: "declaration",
    });
    expect(events[0]?.facts.involvedOutcome).not.toHaveProperty("attackModeId");
  });

  it("publishes accepted reviews, skips, effect review, and round boundary as bounded results", () => {
    const events = deriveLegacyCombatStepEvents({
      commands: [
        command({
          createdAt: "2026-01-01T00:01:00.000Z",
          id: "modifier-review",
          participantId: ATTACKER_ID,
          type: "review_modifiers_phase1",
        }),
        command({
          createdAt: "2026-01-01T00:02:00.000Z",
          facts: { reason: "gm_skip" },
          id: "action-skip",
          participantId: ATTACKER_ID,
          phase: "phase1",
          step: "A1",
          type: "skip_phase_action",
        }),
        command({
          createdAt: "2026-01-01T00:03:00.000Z",
          facts: { choice: "back_out" },
          id: "choice-back-out",
          participantId: DEFENDER_ID,
          phase: "phase1",
          step: "A1",
          type: "submit_phase_initiative_choice",
        }),
        command({
          createdAt: "2026-01-01T00:03:30.000Z",
          facts: { decision: "cancel" },
          id: "double-attack-cancel",
          participantId: ATTACKER_ID,
          phase: "phase2",
          step: "M2",
          type: "decide_double_attack_phase2",
        }),
        command({
          createdAt: "2026-01-01T00:04:00.000Z",
          facts: {
            attackResultId: ATTACK_RESULT_ID,
            attackerParticipantId: ATTACKER_ID,
            defenderParticipantId: DEFENDER_ID,
          },
          id: "effect-review",
          participantId: DEFENDER_ID,
          phase: "phase1",
          step: "D1",
          type: "complete_damage_review_phase1",
        }),
        command({
          createdAt: "2026-01-01T00:05:00.000Z",
          id: "round-complete",
          participantId: ATTACKER_ID,
          step: "SU",
          type: "complete_round",
        }),
      ],
      encounterId: ENCOUNTER_ID,
      roundNumber: 1,
    });

    expect(events.map((event) => event.type)).toEqual([
      "modifier_review",
      "action_skipped",
      "action_skipped",
      "action_skipped",
      "effect_review",
      "round_boundary",
    ]);
    expect(events[0]?.facts.involvedOutcome).toMatchObject({
      acceptedModifiers: [],
      resultLabel: "Modifier state accepted",
    });
    expect(events[1]).toMatchObject({ status: "skipped", step: "phase_1_actions" });
    expect(events[2]?.facts.involvedOutcome).toMatchObject({
      reason: "Attack backed out",
      resolutionType: "skipped",
    });
    expect(events[3]).toMatchObject({
      status: "skipped",
      step: "phase_2_actions",
    });
    expect(events[3]?.facts.involvedOutcome).toMatchObject({
      reason: "Double Attack phase 2 cancelled",
    });
    expect(events[4]).toMatchObject({
      attackResultId: ATTACK_RESULT_ID,
      ownerParticipantId: DEFENDER_ID,
      step: "phase_1_damage",
    });
    expect(events[5]?.facts.involvedOutcome).toMatchObject({
      resolutionType: "round_completed",
    });
  });

  it("records only accepted modifier-review changes against the preceding snapshot", () => {
    const snapshots = [
      combatRoundStepSnapshotSchema.parse({
        committedAt: "2026-01-01T00:00:30.000Z",
        id: "declaration-snapshot",
        modifierSummary: {
          dbRaw: -1,
          generalFatigueRaw: 0,
          initiativeRaw: 0,
          obSkillRaw: 0,
          rows: [
            {
              bucketKey: "situation_db",
              entries: [
                {
                  durationRounds: 1,
                  id: "prior-db",
                  notes: "Old stance",
                  scope: "until",
                  value: -1,
                },
              ],
              label: "DB/Parry",
              total: -1,
            },
          ],
        },
        participantId: ATTACKER_ID,
        participantLabel: "Observer",
        roundNumber: 1,
        step: "select_actions",
      }),
      combatRoundStepSnapshotSchema.parse({
        committedAt: "2026-01-01T00:01:30.000Z",
        id: "review-snapshot",
        modifierSummary: {
          dbRaw: -2,
          generalFatigueRaw: 0,
          initiativeRaw: 0,
          obSkillRaw: 2,
          rows: [
            {
              bucketKey: "situation_db",
              entries: [
                {
                  durationRounds: 1,
                  id: "prior-db",
                  notes: "Old stance",
                  scope: "until",
                  value: -2,
                },
              ],
              label: "DB/Parry",
              total: -2,
            },
            {
              bucketKey: "situation_ob_skill",
              entries: [
                {
                  durationRounds: 1,
                  id: "new-ob",
                  notes: "Tactical edge",
                  scope: "until",
                  value: 2,
                },
              ],
              label: "Skill/OB",
              total: 2,
            },
          ],
        },
        participantId: ATTACKER_ID,
        participantLabel: "Observer",
        roundNumber: 1,
        step: "review_action_modifiers",
      }),
    ];
    const events = deriveLegacyCombatStepEvents({
      commands: [
        command({
          createdAt: "2026-01-01T00:01:30.000Z",
          id: "modifier-review",
          participantId: ATTACKER_ID,
          type: "review_modifiers_phase1",
        }),
      ],
      encounterId: ENCOUNTER_ID,
      roundNumber: 1,
      stepSnapshots: snapshots,
    });

    expect(events[0]?.facts.involvedOutcome).toMatchObject({
      changed: true,
      changes: [
        {
          category: "DB/Parry",
          changeType: "changed",
          id: "prior-db",
          previousValue: -1,
          value: -2,
        },
        {
          category: "Skill/OB",
          changeType: "added",
          id: "new-ob",
          value: 2,
        },
      ],
    });
  });

  it("marks absent dice and linkage as incomplete without inventing values", () => {
    const incompleteInitiative = combatRoundParticipantStateSchema.parse({
      initiatives: { phase1: 7 },
      label: "Legacy",
      participantId: ATTACKER_ID,
    });
    const partialAttackCommand = command({
      createdAt: "2026-01-01T00:03:00.000Z",
      facts: {},
      id: "partial-attack",
      participantId: ATTACKER_ID,
      phase: "phase1",
      step: "A1",
      type: "roll_attack",
    });
    const events = deriveLegacyCombatStepEvents({
      commands: [partialAttackCommand],
      encounterId: ENCOUNTER_ID,
      participants: [incompleteInitiative],
      roundNumber: 1,
    });
    const initiative = events.find((event) => event.type === "initiative");
    const attack = events.find((event) => event.type === "attack");

    expect(initiative?.completeness).toBe("incomplete");
    expect(initiative?.missingFacts).toContain("facts.rollerPrivate.rolls");
    expect(initiative?.facts.rollerPrivate.rolls).toEqual([]);
    expect(attack?.completeness).toBe("incomplete");
    expect(attack?.missingFacts).toEqual(
      expect.arrayContaining(["attackResultId", "defenderParticipantId"]),
    );
    expect(attack?.attackResultId).toBeUndefined();
    expect(attack?.defenderParticipantId).toBeUndefined();
  });

  it("projects bulk-skipped initiative as a complete skipped resolution without dice", () => {
    const bulkSkipped = combatRoundParticipantStateSchema.parse({
      initiatives: {
        phase1: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          resolutionType: "bulk_skipped",
          rolls: [],
          rollTotal: 0,
          total: 0,
        },
      },
      label: "Bulk skipped",
      participantId: ATTACKER_ID,
    });
    const initiative = deriveLegacyCombatStepEvents({
      commands: [
        command({
          createdAt: "2026-01-01T00:02:00.000Z",
          facts: {
            completedParticipantIds: [ATTACKER_ID],
            phase: "phase1",
            resolutionType: "bulk_skipped",
          },
          id: "bulk-initiative",
          participantId: ATTACKER_ID,
          phase: "phase1",
          step: "i1",
          type: "complete_remaining_step",
        }),
      ],
      encounterId: ENCOUNTER_ID,
      participants: [bulkSkipped],
      roundNumber: 1,
    }).find((event) => event.type === "initiative");

    expect(initiative).toMatchObject({
      completeness: "legacy_derived",
      facts: {
        publicOutcome: {
          resolutionType: "bulk_skipped",
          total: 0,
        },
        rollerPrivate: {
          resolutionType: "bulk_skipped",
          rolls: [],
          total: 0,
        },
      },
      missingFacts: [],
      status: "skipped",
    });
  });

  it("fails safely for malformed source rows and uses incomplete snapshot fallback", () => {
    const events = deriveLegacyCombatStepEvents({
      commands: [{ type: "roll_attack" }],
      encounterId: ENCOUNTER_ID,
      participants: [{ participantId: 7 }],
      roundNumber: 1,
      stepSnapshots: [
        {
          actionResultStatus: "recorded",
          actionResultSummary: "Legacy-only summary",
          committedAt: "2026-01-01T00:08:00.000Z",
          id: "legacy-snapshot",
          participantId: DEFENDER_ID,
          participantLabel: "Display name must not be copied",
          roundNumber: 1,
          step: "round_summary",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      completeness: "incomplete",
      missingFacts: ["source.structuredFacts"],
      source: { kind: "legacy_snapshot", sourceIds: ["legacy-snapshot"] },
    });
    expect(JSON.stringify(events)).not.toContain("Display name must not be copied");
  });

  it("classifies legacy snapshot fallback by its exact step rather than carried initiative", () => {
    const events = deriveLegacyCombatStepEvents({
      encounterId: ENCOUNTER_ID,
      roundNumber: 1,
      stepSnapshots: [
        {
          actionResultStatus: "recorded",
          actionResultSummary: "Legacy attack summary",
          committedAt: "2026-01-01T00:08:00.000Z",
          id: "legacy-attack-snapshot",
          initiativeResult: {
            baseInitiative: 3,
            modifierAdjustment: 0,
            rollTotal: 6,
            rolls: [6],
            total: 9,
          },
          participantId: ATTACKER_ID,
          participantLabel: "Attacker",
          roundNumber: 1,
          step: "phase_1_actions",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("attack");
    expect(events[0]?.step).toBe("phase_1_actions");
  });

  it("derives distance rolls before result/apply and preserves health/SU ownership", () => {
    const roundEndReview = combatRoundEndReviewSchema.parse({
      participantReviews: {
        [ATTACKER_ID]: {
          committedAt: "2026-01-01T00:13:00.000Z",
          participantId: ATTACKER_ID,
          proposedHealthRolls: [
            {
              bleedType: "external",
              difficulty: 12,
              healthStat: 4,
              id: "health-roll-1",
              label: "Bleed check",
              participantId: ATTACKER_ID,
              result: {
                difficulty: 12,
                finalTotal: 17,
                healthStat: 4,
                openEndedD10s: [],
                rolledAt: "2026-01-01T00:12:00.000Z",
                rollD20: 13,
                rollTotal: 13,
                success: true,
              },
              sourceEffectId: "bleed-effect-1",
              status: "rolled",
            },
          ],
          status: "committed",
        },
      },
      proposedDistances: [
        {
          accepted: true,
          appliedDistance: 3,
          appliesFromRound: 2,
          currentDistance: 2,
          id: "distance-1",
          outcome: "participant_a_wins",
          pairKey: "pair-1",
          participantA: {
            participantId: ATTACKER_ID,
            result: {
              dodgeSkillTotal: 5,
              finalTotal: 18,
              generalFatigueModifier: -1,
              openEndedD10s: [],
              rolledAt: "2026-01-01T00:09:00.000Z",
              rolledAtRound: 1,
              rollD20: 14,
              rollTotal: 14,
            },
            status: "rolled",
          },
          participantAId: ATTACKER_ID,
          participantB: {
            participantId: DEFENDER_ID,
            result: {
              dodgeSkillTotal: 4,
              finalTotal: 14,
              generalFatigueModifier: 0,
              openEndedD10s: [],
              rolledAt: "2026-01-01T00:10:00.000Z",
              rolledAtRound: 1,
              rollD20: 10,
              rollTotal: 10,
            },
            status: "rolled",
          },
          participantBId: DEFENDER_ID,
          proposedDistance: 3,
          requiresContest: true,
          status: "committed",
          winnerParticipantId: ATTACKER_ID,
        },
      ],
      roundNumber: 1,
    });
    const commands = [
      command({
        createdAt: "2026-01-01T00:09:00.000Z",
        facts: { distanceProposalId: "distance-1", rolledParticipantId: ATTACKER_ID },
        id: "distance-roll-a",
        participantId: ATTACKER_ID,
        step: "SU",
        type: "roll_round_end_distance_control",
      }),
      command({
        createdAt: "2026-01-01T00:10:00.000Z",
        facts: { distanceProposalId: "distance-1", rolledParticipantId: DEFENDER_ID },
        id: "distance-roll-b",
        participantId: DEFENDER_ID,
        step: "SU",
        type: "roll_round_end_distance_control",
      }),
      command({
        createdAt: "2026-01-01T00:11:00.000Z",
        facts: { appliedDistance: 3, distanceProposalId: "distance-1" },
        id: "distance-commit",
        participantId: ATTACKER_ID,
        step: "SU",
        type: "commit_round_end_distance_control",
      }),
      command({
        createdAt: "2026-01-01T00:12:00.000Z",
        facts: { healthRollId: "health-roll-1" },
        id: "health-command",
        participantId: ATTACKER_ID,
        step: "SU",
        type: "roll_round_end_health_check",
      }),
      command({
        createdAt: "2026-01-01T00:13:00.000Z",
        id: "su-review-command",
        participantId: ATTACKER_ID,
        step: "SU",
        type: "commit_round_end_participant_review",
      }),
    ];
    const events = deriveLegacyCombatStepEvents({
      commands,
      encounterId: ENCOUNTER_ID,
      roundEndReview,
      roundNumber: 1,
    });

    expect(events.map((event) => event.type)).toEqual([
      "distance_control_roll",
      "distance_control_roll",
      "distance_control_result",
      "distance_control_applied",
      "health_check",
      "participant_su_review",
    ]);
    expect(events[0]).toMatchObject({
      distanceProposalId: "distance-1",
      ownerParticipantId: ATTACKER_ID,
      rollerParticipantId: ATTACKER_ID,
    });
    expect(events[4]).toMatchObject({
      healthRollId: "health-roll-1",
      ownerParticipantId: ATTACKER_ID,
      rollerParticipantId: ATTACKER_ID,
    });
    expect(events[5]?.ownerParticipantId).toBe(ATTACKER_ID);
  });
});
