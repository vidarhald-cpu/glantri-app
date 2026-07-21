import { describe, expect, it } from "vitest";

import {
  combatRoundCommandSchema,
  combatRoundStateSchema,
  combatStepEventSchema,
  buildCombatRoundAttackRollResult,
  buildCombatRoundPhaseResolutionResult,
  deriveCombatHistoryStepOutcome,
  projectCombatHistory,
  projectCombatHistoryEvent,
  type CombatStepEvent,
} from "../index";

const participants = [
  { displayName: "Aria", participantId: "aria" },
  { displayName: "Borin", participantId: "borin" },
  { displayName: "Cyra", participantId: "cyra" },
  { displayName: "Hidden foe", participantId: "hidden" },
];

function event(input: Partial<CombatStepEvent> & Pick<CombatStepEvent, "type">): CombatStepEvent {
  return combatStepEventSchema.parse({
    completeness: "complete",
    encounterId: "encounter-1",
    facts: {
      gmReview: { override: "private" },
      involvedOutcome: { outcome: "hit" },
      publicOutcome: {},
      rollerPrivate: { calculation: "18 + 4", rollD20: 18 },
    },
    id: `event-${input.type}`,
    missingFacts: [],
    occurredAt: "2026-01-01T00:00:00.000Z",
    roundNumber: 1,
    schemaVersion: 1,
    sequence: 0,
    source: { kind: "canonical", sourceIds: [] },
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

const player = (controlled: string[], visible: string[]) => ({
  controlledParticipantIds: new Set(controlled),
  kind: "player" as const,
  visibleParticipantIds: new Set(visible),
});

describe("combat history projection", () => {
  it("retains safe declaration completion facts for every visible participant", () => {
    const declaration = event({
      facts: {
        gmReview: { privateNote: "hidden" },
        involvedOutcome: { actionId: "attack_parry" },
        publicOutcome: {},
        rollerPrivate: {},
      },
      ownerParticipantId: "borin",
      type: "declaration",
      visibility: {
        identityRefs: [{ participantId: "borin", role: "actor" }],
        involvedParticipantIds: ["borin"],
        outcomeScope: "involved",
      },
    });

    const projected = projectCombatHistoryEvent({
      event: declaration,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projected?.ownerParticipantId).toBe("borin");
    expect(projected?.facts.involvedOutcome).toBeUndefined();
    expect(projected?.facts.gmReview).toBeUndefined();
    expect(JSON.stringify(projected)).not.toContain("privateNote");
  });

  it("shows Combat Experience outcome and calculation only to the GM and roller", () => {
    const combatExperience = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: {},
        involvedOutcome: { difficulty: 26, finalTotal: 27, success: true },
        publicOutcome: {},
        rollerPrivate: { rollD20: 17, rollTotal: 17, skillTotal: 10 },
      },
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      step: "select_actions",
      type: "combat_experience",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "actor" },
          { participantId: "aria", role: "roller" },
        ],
        involvedParticipantIds: ["aria"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });

    const gm = projectCombatHistoryEvent({
      event: combatExperience,
      participants,
      viewer: { kind: "gm" },
    });
    const own = projectCombatHistoryEvent({
      event: combatExperience,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const other = projectCombatHistoryEvent({
      event: combatExperience,
      participants,
      viewer: player(["borin"], ["aria", "borin"]),
    });

    expect(gm?.facts).toMatchObject({
      involvedOutcome: { difficulty: 26, finalTotal: 27, success: true },
      privateCalculation: { rollD20: 17, rollTotal: 17, skillTotal: 10 },
    });
    expect(own?.facts).toMatchObject({
      involvedOutcome: { difficulty: 26, finalTotal: 27, success: true },
      privateCalculation: { rollD20: 17, rollTotal: 17, skillTotal: 10 },
    });
    expect(other).toBeUndefined();
  });

  it("reconstructs the live Combat Experience presentation event from persisted command facts", () => {
    const command = combatRoundCommandSchema.parse({
      afterCursor: { participantId: "aria", roundNumber: 1, step: "DE" },
      beforeCursor: { participantId: "aria", roundNumber: 1, step: "DE" },
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
      id: "ce-command",
      participantId: "aria",
      roundNumber: 1,
      step: "DE",
      type: "roll_combat_experience",
    });
    const state = combatRoundStateSchema.parse({
      commands: [command],
      currentStep: "select_actions",
      encounterId: "encounter-1",
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 1,
    });

    const projection = projectCombatHistory({
      participants,
      sourceUpdatedAt: "revision-ce",
      state,
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.activeRound.events).toContainEqual(
      expect.objectContaining({
        facts: expect.objectContaining({
          involvedOutcome: expect.objectContaining({
            difficulty: 26,
            finalTotal: 27,
            success: true,
          }),
          privateCalculation: expect.objectContaining({ rollD20: 17, skillTotal: 10 }),
        }),
        type: "combat_experience",
      }),
    );
    expect(projection.combatLog?.events.some((event) => event.category !== "round")).toBe(false);
  });

  it("delivers player-safe live progression from the same state revision", () => {
    const state = combatRoundStateSchema.parse({
      currentCursor: { participantId: "aria", roundNumber: 1, step: "DE" },
      currentStep: "select_actions",
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Hidden foe", participantId: "hidden" },
      ],
      roundNumber: 1,
    });
    const currentAttackModifierValidation = {
      actionId: "attack_parry",
      attackerModifierFingerprint: "v1:attacker",
      attackerParticipantId: "aria",
      defenderDbParryRaw: -2,
      defenderModifierFingerprint: "v1:defender",
      defenderParticipantId: "borin",
      encounterId: "encounter-1",
      expectedRevision: "revision-7",
      obSkillRaw: -2,
      pairKey: "aria::borin",
      phase: "phase1" as const,
      taskId: "attack-task",
    };
    const originalValidation = structuredClone(currentAttackModifierValidation);
    const projection = projectCombatHistory({
      currentAttackModifierValidation,
      participants,
      sourceUpdatedAt: "revision-7",
      state,
      viewer: player(["aria"], ["aria"]),
    });
    const serialized = JSON.stringify(projection.progression);

    expect(projection.sourceUpdatedAt).toBe("revision-7");
    expect(projection.currentAttackModifierValidation).toEqual(originalValidation);
    expect(currentAttackModifierValidation).toEqual(originalValidation);
    expect(projection.progression).toMatchObject({
      boundary: { kind: "declaration", roundNumber: 1 },
      roundNumber: 1,
      taskVisibility: "available",
    });
    expect(serialized).toContain("aria");
    expect(serialized).not.toContain("Hidden foe");
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain("diagnostic");
  });

  it("keeps both visible declaration completion events in the player live round", () => {
    const state = combatRoundStateSchema.parse({
      currentStep: "select_actions",
      events: [
        event({
          id: "declaration-aria",
          ownerParticipantId: "aria",
          sequence: 1,
          type: "declaration",
          visibility: {
            identityRefs: [{ participantId: "aria", role: "actor" }],
            involvedParticipantIds: ["aria"],
            outcomeScope: "involved",
          },
        }),
        event({
          id: "declaration-borin",
          ownerParticipantId: "borin",
          sequence: 2,
          type: "declaration",
          visibility: {
            identityRefs: [{ participantId: "borin", role: "actor" }],
            involvedParticipantIds: ["borin"],
            outcomeScope: "involved",
          },
        }),
      ],
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 1,
    });

    const projection = projectCombatHistory({
      participants,
      state,
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.activeRound.events.map((entry) => entry.ownerParticipantId)).toEqual([
      "aria",
      "borin",
    ]);
  });

  it("distinguishes historical non-applicability, non-required resolution, and explicit skips", () => {
    const miss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "aria",
      defenderDb: 12,
      defenderParticipantId: "borin",
      ob: 10,
      phase: "phase1",
      rollD20: 2,
      rollTotal: 2,
      rolledAt: "2026-01-01T00:01:00.000Z",
      weaponName: "Long sword",
    });
    const resolution = buildCombatRoundPhaseResolutionResult({
      attackResult: miss,
      roundNumber: 1,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const base = {
      committedAt: "2026-01-01T00:03:00.000Z",
      id: "snapshot-outcome",
      participantId: "borin",
      participantLabel: "Borin",
      roundNumber: 1,
    };

    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        actionResultStatus: "no_attack",
        phase: "phase1",
        step: "phase_1_actions",
      }),
    ).toMatchObject({ category: "not_applicable", reason: "no_declared_attack" });
    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        attackResult: miss,
        phase: "phase1",
        phaseResolutionResult: resolution,
        step: "review_phase_2_actions",
      }),
    ).toEqual({
      category: "not_required",
      message: "No parry required. The incoming attack missed.",
      reason: "incoming_attack_missed",
    });
    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        attackResult: miss,
        phase: "phase1",
        phaseResolutionResult: resolution,
        step: "phase_1_damage",
      }),
    ).toMatchObject({ category: "not_required", reason: "damage_not_required" });
    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        actionResultStatus: "skipped",
        step: "phase_2_actions",
      }),
    ).toMatchObject({ category: "skipped", reason: "action_explicitly_skipped" });
    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        actionResultReason: "double_attack_cancelled",
        actionResultStatus: "skipped",
        phase: "phase2",
        step: "phase_2_actions",
      }),
    ).toEqual({
      category: "skipped",
      message: "Attack 2 was cancelled after Attack 1.",
      reason: "double_attack_cancelled",
    });
  });
  it("shows attack calculation only to the roller and involved outcome to the defender", () => {
    const attack = event({
      attackerParticipantId: "aria",
      defenderParticipantId: "borin",
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      type: "attack",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "attacker" },
          { participantId: "borin", role: "defender" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });
    const roller = projectCombatHistoryEvent({
      event: attack,
      participants,
      viewer: player(["aria"], ["aria", "borin", "cyra"]),
    });
    const defender = projectCombatHistoryEvent({
      event: attack,
      participants,
      viewer: player(["borin"], ["aria", "borin", "cyra"]),
    });
    const uninvolved = projectCombatHistoryEvent({
      event: attack,
      participants,
      viewer: player(["cyra"], ["aria", "borin", "cyra"]),
    });

    expect(roller?.facts.privateCalculation).toEqual({ calculation: "18 + 4", rollD20: 18 });
    expect(defender?.facts).toMatchObject({ involvedOutcome: { outcome: "hit" } });
    expect(defender?.facts.privateCalculation).toBeUndefined();
    expect(defender?.facts.gmReview).toBeUndefined();
    expect(defender?.identities).toContainEqual({
      displayName: "Aria",
      participantId: "aria",
      role: "attacker",
      visibility: "visible",
    });
    expect(uninvolved).toBeUndefined();
    expect(roller?.ownerParticipantId).toBe("aria");
  });

  it("shows parry outcome to the attacker without defender calculation", () => {
    const parry = event({
      rollerParticipantId: "borin",
      type: "parry",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "attacker" },
          { participantId: "borin", role: "defender" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "borin",
      },
    });
    const projection = projectCombatHistoryEvent({
      event: parry,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection?.facts.involvedOutcome).toEqual({ outcome: "hit" });
    expect(projection?.facts.privateCalculation).toBeUndefined();
    expect(projection?.identities.some((identity) => identity.participantId === "borin")).toBe(
      true,
    );
  });

  it("keeps each feint roll private to its roller while sharing the opposed outcome", () => {
    const attackerRoll = event({
      actorParticipantId: "aria",
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      targetParticipantId: "borin",
      type: "feint_roll",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "actor" },
          { participantId: "borin", role: "target" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });
    const committed = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: { notes: "private ruling" },
        involvedOutcome: {
          defenderPhase2DbParryModifier: -2,
          defenderPhase2SkillObModifier: -2,
        },
        publicOutcome: {},
        rollerPrivate: {},
      },
      ownerParticipantId: "aria",
      targetParticipantId: "borin",
      type: "feint_committed",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "actor" },
          { participantId: "borin", role: "target" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
      },
    });

    const attacker = projectCombatHistoryEvent({
      event: attackerRoll,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const defender = projectCombatHistoryEvent({
      event: attackerRoll,
      participants,
      viewer: player(["borin"], ["aria", "borin"]),
    });
    const defenderOutcome = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["borin"], ["aria", "borin"]),
    });

    expect(attacker?.facts.privateCalculation).toEqual({
      calculation: "18 + 4",
      rollD20: 18,
    });
    expect(defender?.facts.privateCalculation).toBeUndefined();
    expect(defenderOutcome?.facts.involvedOutcome).toEqual({
      defenderPhase2DbParryModifier: -2,
      defenderPhase2SkillObModifier: -2,
    });
    expect(defenderOutcome?.facts.gmReview).toBeUndefined();
  });

  it("sanitizes a perceived hidden attacker without exposing its id or row", () => {
    const attack = event({
      defenderParticipantId: "aria",
      ownerParticipantId: "hidden",
      rollerParticipantId: "hidden",
      type: "attack",
      visibility: {
        identityRefs: [
          {
            hiddenIdentityFallback: "unseen_attacker",
            participantId: "hidden",
            role: "attacker",
          },
          { participantId: "aria", role: "defender" },
        ],
        involvedParticipantIds: ["hidden", "aria"],
        outcomeScope: "perceived",
        rollerParticipantId: "hidden",
      },
    });
    const state = combatRoundStateSchema.parse({ encounterId: "encounter-1", events: [attack] });
    const projection = projectCombatHistory({
      participants,
      state,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const serialized = JSON.stringify(projection);

    expect(projection.rows.map((row) => row.participantId)).toEqual(["aria", "borin"]);
    expect(projection.activeRound.events[0]?.identities).toContainEqual({
      displayName: "an unseen attacker",
      role: "attacker",
      visibility: "unseen",
    });
    expect(projection.activeRound.events[0]?.ownerParticipantId).toBeUndefined();
    expect(serialized).not.toContain("hidden");
    expect(serialized).not.toContain("Unknown participant");
  });

  it("omits damage proposals but projects committed consequences without GM review", () => {
    const proposed = event({ type: "damage_proposed" });
    const committed = event({
      facts: {
        gmReview: { rejectedRows: ["secret"] },
        involvedOutcome: { damage: 7, effectIds: ["effect-1"] },
        publicOutcome: {},
        rollerPrivate: {},
      },
      type: "damage_committed",
      visibility: {
        identityRefs: [{ participantId: "borin", role: "defender" }],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
      },
    });
    const viewer = player(["borin"], ["aria", "borin"]);

    expect(projectCombatHistoryEvent({ event: proposed, participants, viewer })).toBeUndefined();
    const safeCommit = projectCombatHistoryEvent({ event: committed, participants, viewer });
    expect(safeCommit?.facts.involvedOutcome).toEqual({ damage: 7, effectIds: ["effect-1"] });
    expect(safeCommit?.facts.gmReview).toBeUndefined();
    expect(JSON.stringify(safeCommit)).not.toContain("rejectedRows");
  });

  it("keeps distance rolls private to the roller and omits hidden or uninvolved pairs", () => {
    const roll = event({
      distanceProposalId: "distance-1",
      rollerParticipantId: "aria",
      type: "distance_control_roll",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "roller" },
          { participantId: "borin", role: "target" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });

    expect(
      projectCombatHistoryEvent({
        event: roll,
        participants,
        viewer: player(["aria"], ["aria", "borin"]),
      })?.facts.privateCalculation,
    ).toBeDefined();
    expect(
      projectCombatHistoryEvent({
        event: roll,
        participants,
        viewer: player(["borin"], ["aria", "borin"]),
      })?.facts.privateCalculation,
    ).toBeUndefined();
    expect(
      projectCombatHistoryEvent({
        event: roll,
        participants,
        viewer: player(["cyra"], ["aria", "borin", "cyra"]),
      }),
    ).toBeUndefined();
    expect(
      projectCombatHistoryEvent({
        event: {
          ...roll,
          visibility: { ...roll.visibility, involvedParticipantIds: ["aria", "hidden"] },
        },
        participants,
        viewer: player(["aria"], ["aria"]),
      }),
    ).toBeUndefined();
  });

  it("does not expose initiative ranks and keeps only the roller's calculation", () => {
    const initiative = event({
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      step: "initiative_phase_1",
      type: "initiative",
      visibility: {
        identityRefs: [{ participantId: "aria", role: "roller" }],
        involvedParticipantIds: ["aria"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });
    const state = combatRoundStateSchema.parse({
      events: [initiative],
      stepSnapshots: [
        {
          committedAt: "2026-01-01T00:00:00.000Z",
          id: "snapshot-initiative",
          initiativeRank: { rank: 2, rankTotal: 18, tiedCount: 1 },
          initiativeResult: {
            baseInitiative: 4,
            modifierAdjustment: 2,
            rolls: [6, 6],
            rollTotal: 12,
            total: 18,
          },
          participantId: "aria",
          participantLabel: "Aria",
          roundNumber: 1,
          step: "initiative_phase_1",
        },
      ],
    });
    const projection = projectCombatHistory({
      participants,
      state,
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.activeRound.events[0]?.facts.privateCalculation).toBeDefined();
    expect(projection.activeRound.snapshots[0]?.panels.actionResult.initiativeResult).toMatchObject(
      { rolls: [6, 6], total: 18 },
    );
    expect(JSON.stringify(projection)).not.toContain("initiativeRank");
    expect(JSON.stringify(projection)).not.toContain("rankTotal");
  });

  it("sanitizes active and archived snapshots and preserves incomplete history", () => {
    const ownSnapshot = {
      actionResultStatus: "no_result" as const,
      committedAt: "2026-01-01T00:00:00.000Z",
      id: "snapshot-own",
      declarationSummary: {
        actionId: "attack_parry",
        additionalActionNotes: "Hold the bridge",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 2,
              source: "player_declared" as const,
              targetParticipantId: "borin",
            },
            {
              desiredDistance: 3,
              source: "player_declared" as const,
              targetParticipantId: "hidden",
            },
          ],
          mode: "set_distance_preferences" as const,
        },
      },
      participantId: "aria",
      participantLabel: "Aria old label",
      phasePanels: {
        phase1: {
          mainHandParryItemLabel: "Long sword",
          phaseContext: { targetParticipantId: "hidden" },
          targetOptions: [
            { displayName: "Hidden old label", id: "hidden" },
            { displayName: "Borin old label", id: "borin" },
          ],
        },
      },
      roundNumber: 1,
      step: "phase_1_actions" as const,
    };
    const hiddenSnapshot = {
      ...ownSnapshot,
      id: "snapshot-hidden",
      participantId: "hidden",
      participantLabel: "Hidden old label",
    };
    const state = combatRoundStateSchema.parse({
      roundNumber: 2,
      rounds: [{ roundNumber: 1, stepSnapshots: [ownSnapshot, hiddenSnapshot] }],
      stepSnapshots: [ownSnapshot, hiddenSnapshot],
    });
    const projection = projectCombatHistory({
      participants,
      state,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const serialized = JSON.stringify(projection);

    expect(projection.activeRound.snapshots).toHaveLength(1);
    expect(projection.archivedRounds[0]?.snapshots).toHaveLength(1);
    expect(projection.activeRound.snapshots[0]).toMatchObject({
      completeness: "incomplete",
      incompleteMessage: "Complete historical result details are unavailable.",
      participant: { displayName: "Aria", participantId: "aria" },
    });
    expect(projection.activeRound.snapshots[0]?.panels.actionSelector).toMatchObject({
      actionId: "attack_parry",
      additionalActionNotes: "Hold the bridge",
      movementIntent: {
        distancePreferences: [{ desiredDistance: 2, targetParticipantId: "borin" }],
      },
    });
    expect(projection.activeRound.snapshots[0]?.panels.phase1).toMatchObject({
      mainHandParryItemLabel: "Long sword",
      phaseContext: { targetParticipantId: undefined },
    });
    expect(serialized).toContain("Borin");
    expect(serialized).not.toContain("Hidden old label");
    expect(serialized).not.toContain('"hidden"');
  });

  it("gives GM all fact groups", () => {
    const projection = projectCombatHistoryEvent({
      event: event({ rollerParticipantId: "aria", type: "critical" }),
      participants,
      viewer: { kind: "gm" },
    });

    expect(projection?.facts.gmReview).toEqual({ override: "private" });
    expect(projection?.facts.privateCalculation).toEqual({ calculation: "18 + 4", rollD20: 18 });
  });
});
