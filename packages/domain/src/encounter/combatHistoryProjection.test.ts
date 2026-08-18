import { describe, expect, it } from "vitest";

import {
  canonicalCombatModifierEffectSchema,
  combatRoundCommandSchema,
  combatRoundStateSchema,
  combatStepEventSchema,
  buildCombatHistorySourceViewFromState,
  buildCombatRoundAttackRollResult,
  buildCombatRoundPhaseResolutionResult,
  deriveCombatHistoryStepOutcome,
  projectCombatHistory,
  projectCombatHistoryEvent,
  type CombatStepEvent,
  type CombatRoundState,
} from "../index";

const participants = [
  { displayName: "Aria", participantId: "aria" },
  { displayName: "Borin", participantId: "borin" },
  { displayName: "Cyra", participantId: "cyra" },
  { displayName: "Hidden foe", participantId: "hidden" },
];

function historySource(state: CombatRoundState, revision = "revision-1") {
  return buildCombatHistorySourceViewFromState({
    revision,
    state: {
      ...state,
      encounterId: state.encounterId ?? "encounter-1",
    },
  });
}

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
  it("does not project a carried initiative result as an attack-step result", () => {
    const state = combatRoundStateSchema.parse({
      participants: [{ label: "Aria", participantId: "aria" }],
      roundNumber: 1,
      stepSnapshots: [
        {
          actionResultStatus: "recorded",
          actionResultSummary: "Aria attacked.",
          committedAt: "2026-01-01T00:00:00.000Z",
          id: "attack-snapshot",
          initiativeResult: {
            baseInitiative: 3,
            modifierAdjustment: 0,
            rollTotal: 6,
            rolls: [6],
            total: 9,
          },
          participantId: "aria",
          participantLabel: "Aria",
          roundNumber: 1,
          step: "phase_1_actions",
        },
      ],
    });
    const projection = projectCombatHistory({
      participants,
      source: historySource(state),
      viewer: { kind: "gm" },
    });

    expect(
      projection.activeRound.snapshots[0]?.panels.actionResult.initiativeResult,
    ).toBeUndefined();
  });

  it("projects a missing selector summary from the archived declaration facts", () => {
    const state = combatRoundStateSchema.parse({
      events: [
        event({
          facts: {
            gmReview: {},
            involvedOutcome: {
              actionId: "single_attack",
              movementId: "maintain_distance",
            },
            publicOutcome: {},
            rollerPrivate: {},
          },
          id: "declaration-aria",
          ownerParticipantId: "aria",
          sequence: 1,
          step: "select_actions",
          type: "declaration",
          visibility: {
            identityRefs: [{ participantId: "aria", role: "actor" }],
            involvedParticipantIds: ["aria"],
            outcomeScope: "involved",
          },
        }),
      ],
      participants: [
        {
          declaration: {
            actionId: "single_attack",
            additionalActionNotes: "Hold the line",
            movementId: "maintain_distance",
            roundNumber: 1,
            submittedBy: "player",
          },
          label: "Aria",
          participantId: "aria",
        },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 1,
      stepSnapshots: [
        {
          committedAt: "2026-01-01T00:03:00.000Z",
          id: "snapshot-without-selector",
          participantId: "aria",
          participantLabel: "Aria",
          roundNumber: 1,
          step: "review_action_modifiers",
        },
      ],
    });
    const projection = projectCombatHistory({
      participants,
      source: historySource(state),
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.activeRound.snapshots[0]?.panels.actionSelector).toMatchObject({
      actionId: "single_attack",
      additionalActionNotes: "Hold the line",
      movementId: "maintain_distance",
    });
  });

  it("projects revision-correct archived observation relationships without current-state fallback", () => {
    const state = combatRoundStateSchema.parse({
      observationRelationships: [
        {
          bestBonus: 3,
          completedAttempts: 2,
          id: "observation:aria:borin",
          observerParticipantId: "aria",
          roundsTowardNextAttempt: 4,
          targetParticipantId: "borin",
        },
      ],
      roundNumber: 2,
      rounds: [
        {
          observationRelationships: [
            {
              bestBonus: 1,
              completedAttempts: 1,
              id: "observation:aria:borin",
              observerParticipantId: "aria",
              roundsTowardNextAttempt: 0,
              targetParticipantId: "borin",
            },
          ],
          roundNumber: 1,
        },
      ],
    });
    const observer = projectCombatHistory({
      participants,
      source: historySource(state),
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const target = projectCombatHistory({
      participants,
      source: historySource(state),
      viewer: player(["borin"], ["aria", "borin"]),
    });

    expect(observer.archivedRounds[0]?.observationRelationships[0]).toMatchObject({
      bestBonus: 1,
      completedAttempts: 1,
      roundsTowardNextAttempt: 0,
    });
    expect(observer.activeRound.observationRelationships[0]).toMatchObject({
      bestBonus: 3,
      completedAttempts: 2,
      roundsTowardNextAttempt: 4,
    });
    expect(target.archivedRounds[0]?.observationRelationships).toEqual([]);
    expect(target.activeRound.observationRelationships).toEqual([]);
  });

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

  it("keeps Offensive Parry contest totals involved-safe while hiding the opponent roll", () => {
    const brawling = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: {},
        involvedOutcome: {
          affectedParticipantId: "borin",
          affectedTotal: 24,
          contestId: "contest-1",
          controllerParticipantId: "aria",
          controllerTotal: 27,
          difference: 3,
          resolved: true,
          winnerParticipantId: "aria",
        },
        publicOutcome: { resolved: true, winnerParticipantId: "aria" },
        rollerPrivate: {
          brawlingBaseValue: 15,
          finalTotal: 27,
          generalModifier: 0,
          parryQualityModifier: 1,
          rollTotal: 11,
          skillContestCalculation: {
            baseSkill: 15,
            calculationId: "contest-1:aria",
            completeness: "complete",
            contestType: "offensive_parry_brawling",
            derivedIntegerAdjustment: 1,
            finalResult: 27,
            governingStat: {
              id: "str_dex_average",
              label: "Strength / Dexterity average",
              value: 10,
            },
            missingContributionPoints: [],
            openEndedDie: { openEndedD10s: [], rollD20: 11, rollTotal: 11 },
            opponentParticipantId: "borin",
            participantId: "aria",
            percentageContributions: [
              {
                category: "maneuver",
                id: "parry-quality",
                label: "Parry quality",
                unit: "percentage",
                value: 1,
              },
            ],
            preDieTotal: 16,
            role: "offensive_parry_controller",
            skill: { id: "brawling", label: "Brawling", totalXp: 5 },
            totalPercentageAdjustment: 1,
            visibility: "roller_and_gm",
          },
          skillModifier: 0,
        },
      },
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      type: "offensive_parry_brawling",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "defender" },
          { participantId: "aria", role: "roller" },
          { participantId: "borin", role: "attacker" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });

    const controller = projectCombatHistoryEvent({
      event: brawling,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const affected = projectCombatHistoryEvent({
      event: brawling,
      participants,
      viewer: player(["borin"], ["aria", "borin"]),
    });

    expect(controller?.facts.privateCalculation).toMatchObject({
      brawlingBaseValue: 15,
      finalTotal: 27,
      skillContestCalculation: expect.objectContaining({
        contestType: "offensive_parry_brawling",
      }),
    });
    expect(affected?.facts.involvedOutcome).toMatchObject({
      affectedTotal: 24,
      controllerTotal: 27,
      difference: 3,
    });
    expect(affected?.facts.privateCalculation).toBeUndefined();
  });

  it("shows an involved phase CE opponent the broad outcome without exact roll facts", () => {
    const combatExperience = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: {},
        involvedOutcome: {
          modifierValue: 0,
          phaseAttackCancelled: false,
          success: true,
        },
        publicOutcome: {},
        rollerPrivate: { difficulty: 26, finalTotal: 27, rollD20: 17, skillTotal: 10 },
      },
      ownerParticipantId: "aria",
      phase: "phase2",
      rollerParticipantId: "aria",
      step: "phase_2_actions",
      targetParticipantId: "borin",
      type: "combat_experience",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "actor" },
          { participantId: "aria", role: "roller" },
          { participantId: "borin", role: "target" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });

    const other = projectCombatHistoryEvent({
      event: combatExperience,
      participants,
      viewer: player(["borin"], ["aria", "borin"]),
    });

    expect(other?.facts.involvedOutcome).toEqual({
      modifierValue: 0,
      phaseAttackCancelled: false,
      success: true,
    });
    expect(other?.facts.privateCalculation).toBeUndefined();
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
      source: historySource(state, "revision-ce"),
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.activeRound.events).toContainEqual(
      expect.objectContaining({
        facts: expect.objectContaining({
          involvedOutcome: expect.objectContaining({
            success: true,
          }),
          privateCalculation: expect.objectContaining({
            difficulty: 26,
            finalTotal: 27,
            rollD20: 17,
            skillTotal: 10,
          }),
        }),
        type: "combat_experience",
      }),
    );
    expect(projection.combatLog?.events.some((event) => event.category !== "round")).toBe(false);
  });

  it("reconstructs an accepted declaration result with its public note for current and history", () => {
    const declarationCommand = combatRoundCommandSchema.parse({
      afterCursor: { participantId: "aria", roundNumber: 1, step: "DE" },
      beforeCursor: { participantId: "aria", roundNumber: 1, step: "DE" },
      createdAt: "2026-01-01T00:01:00.000Z",
      facts: { status: "submitted" },
      id: "declaration-command",
      participantId: "aria",
      roundNumber: 1,
      step: "DE",
      type: "declare_action",
    });
    const round = {
      commands: [declarationCommand],
      participants: [
        {
          declaration: {
            actionId: "parry",
            additionalActionNotes: "Guard the bridge.",
            movementIntent: { distancePreferences: [], mode: "hold_position" as const },
            roundNumber: 1,
            secondaryActionContext: {
              action: "observe_opponent" as const,
              targetParticipantId: "borin",
            },
            secondaryActionId: "observe_opponent",
            submittedAt: "2026-01-01T00:01:00.000Z",
            submittedBy: "player" as const,
          },
          label: "Aria",
          participantId: "aria",
        },
      ],
      roundNumber: 1,
    };
    const state = combatRoundStateSchema.parse({
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 2,
      rounds: [round],
    });
    const projection = projectCombatHistory({
      participants,
      source: historySource(state, "revision-declaration"),
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.archivedRounds[0]?.events).toContainEqual(
      expect.objectContaining({
        facts: expect.objectContaining({
          involvedOutcome: expect.objectContaining({
            actionLabel: "Parry",
            movementLabel: "Hold position",
          }),
        }),
        resultEnvelope: expect.objectContaining({
          publicCombatNote: "Guard the bridge.",
        }),
        step: "select_actions",
        type: "declaration",
      }),
    );

    const targetProjection = projectCombatHistory({
      participants,
      source: historySource(state, "revision-declaration"),
      viewer: player(["borin"], ["aria", "borin"]),
    });
    const targetEvent = targetProjection.archivedRounds[0]?.events.find(
      (candidate) => candidate.type === "declaration",
    );
    expect(targetEvent?.facts.involvedOutcome).toBeUndefined();
    expect(targetEvent?.resultEnvelope).toMatchObject({
      conciseOutcome: { details: [], label: "Declaration" },
      publicCombatNote: undefined,
    });
    expect(targetEvent?.identities).not.toContainEqual(
      expect.objectContaining({ participantId: "borin", role: "target" }),
    );
  });

  it("delivers player-safe live progression from the same state revision", () => {
    const state = combatRoundStateSchema.parse({
      currentCursor: { participantId: "aria", roundNumber: 1, step: "DE" },
      currentStep: "select_actions",
      encounterId: "encounter-1",
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Hidden foe", participantId: "hidden" },
      ],
      roundNumber: 1,
    });
    const currentAttackModifierValidation = {
      actionId: "attack_parry",
      attackContextAvailability: "complete" as const,
      attackerModifierFingerprint: "v1:attacker",
      attackerParticipantId: "aria",
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
      source: historySource(state, "revision-7"),
      viewer: player(["aria"], ["aria"]),
    });
    const serialized = JSON.stringify(projection.progression);

    expect(projection.sourceUpdatedAt).toBe("revision-7");
    expect(projection.sourceEncounterId).toBe("encounter-1");
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
      source: historySource(state),
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
      source: historySource(state),
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

  it("projects the same public result note to GM and authorized player envelopes only", () => {
    const committed = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: { diagnosticCode: "armor_override" },
        involvedOutcome: { proposalId: "feint-1" },
        publicOutcome: {},
        resultPresentation: {
          actionInstanceId: "feint-1",
          calculationReferences: [],
          committedConsequences: [
            {
              affectedParticipantId: "borin",
              key: "defenderPhase2SkillObModifier",
              label: "Defender Skill/OB · Phase 2",
              value: -2,
            },
          ],
          conciseOutcome: { details: ["Margin 7"], label: "Feint committed" },
          privateDiagnostics: [],
          publicCombatNote: "Borin commits to the false opening.",
          standardConsequences: [
            {
              affectedParticipantId: "borin",
              key: "defenderPhase2SkillObModifier",
              label: "Defender Skill/OB · Phase 2",
              value: -2,
            },
          ],
          subordinateEventReferences: [],
        },
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

    const gm = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: { kind: "gm" },
    });
    const playerProjection = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const gmPlayerProjection = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const uninvolved = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["cyra"], ["aria", "borin", "cyra"]),
    });

    expect(gm?.resultEnvelope?.publicCombatNote).toBe("Borin commits to the false opening.");
    expect(playerProjection?.resultEnvelope).toEqual(gmPlayerProjection?.resultEnvelope);
    expect(playerProjection?.resultEnvelope?.publicCombatNote).toBe(
      "Borin commits to the false opening.",
    );
    expect(playerProjection?.resultEnvelope?.privateDiagnostics).toEqual([]);
    expect(JSON.stringify(playerProjection)).not.toContain("diagnosticCode");
    expect(uninvolved).toBeUndefined();
  });

  it("preserves the public result envelope in immutable archived history", () => {
    const committed = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: { diagnosticCode: "do-not-project" },
        involvedOutcome: { difference: 7 },
        publicOutcome: {},
        resultPresentation: {
          calculationReferences: [],
          committedConsequences: [],
          conciseOutcome: { details: ["Margin 7"], label: "Feint committed" },
          privateDiagnostics: [],
          publicCombatNote: "Borin commits to the false opening.",
          standardConsequences: [],
          subordinateEventReferences: [],
        },
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
    const state = combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      roundNumber: 2,
      rounds: [{ events: [committed], roundNumber: 1 }],
    });
    const projection = projectCombatHistory({
      participants,
      source: historySource(state, "revision-after-archive"),
      viewer: player(["aria"], ["aria", "borin"]),
    });

    expect(projection.archivedRounds[0]?.events[0]?.resultEnvelope?.publicCombatNote).toBe(
      "Borin commits to the false opening.",
    );
    expect(JSON.stringify(projection.archivedRounds[0])).not.toContain("diagnosticCode");
  });

  it("keeps distance rolls private to the roller and omits hidden or uninvolved pairs", () => {
    const roll = event({
      distanceProposalId: "distance-1",
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {
          movementBurden: {
            carriedItems: [
              {
                effectiveEncumbrance: 4,
                itemId: "private-carried-item",
                templateId: "private-equipment-template",
              },
            ],
            finalMovementModifier: 2,
          },
        },
      },
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

    const rollerProjection = projectCombatHistoryEvent({
      event: roll,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const opponentProjection = projectCombatHistoryEvent({
      event: roll,
      participants,
      viewer: player(["borin"], ["aria", "borin"]),
    });
    expect(rollerProjection?.facts.privateCalculation).toBeDefined();
    expect(JSON.stringify(rollerProjection)).toContain("private-carried-item");
    expect(opponentProjection?.facts.privateCalculation).toBeUndefined();
    expect(JSON.stringify(opponentProjection)).not.toContain("private-carried-item");
    expect(JSON.stringify(opponentProjection)).not.toContain("private-equipment-template");
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
      source: historySource(state),
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
    const exactModifierEffect = canonicalCombatModifierEffectSchema.parse({
      applicability: {
        combatWide: false,
        opponentParticipantId: "borin",
        phase: "phase1",
        rollPurposes: ["weapon_defense"],
        roundNumber: 1,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      createdRevision: "revision-private-source",
      createdSequence: 4,
      id: "effect-feint-db",
      lifecycle: {
        duration: {
          expiresAt: "phase_boundary",
          kind: "phase",
          phase: "phase1",
          startPhase: "phase1",
          startRound: 1,
          startSequence: 4,
        },
        state: "active",
      },
      lineage: {},
      missingFacts: [],
      ownerParticipantId: "aria",
      payload: {
        category: "db_parry",
        contributionScope: "calculation",
        kind: "numeric",
        unit: "percentage",
        value: -2,
      },
      privateDiagnostic: { code: "private-source", referenceId: "command-private" },
      provenanceCompleteness: "complete",
      publicLabel: "Feint",
      schemaVersion: 1,
      sourceFamily: "feint",
      sourceReferences: { commandId: "command-private", resultId: "result-private" },
      version: 1,
      visibility: { audience: "owner", sourceIdentity: "hidden" },
    });
    const ownSnapshot = {
      actionResultStatus: "no_result" as const,
      committedAt: "2026-01-01T00:00:00.000Z",
      id: "snapshot-own",
      modifierSummary: {
        dbRaw: -2,
        effects: [exactModifierEffect],
        generalFatigueRaw: 0,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [
          {
            bucketKey: "situation_db" as const,
            entries: [
              {
                application: "percentage" as const,
                canonicalLifecycle: exactModifierEffect,
                id: "row-effect-feint-db",
                scope: "until" as const,
                value: -2,
              },
            ],
            label: "DB/Parry",
            total: -2,
          },
        ],
      },
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
        secondaryActionContext: {
          action: "observe_opponent" as const,
          targetParticipantId: "borin",
        },
        secondaryActionId: "observe_opponent",
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
      source: historySource(state),
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
      secondaryActionId: "observe_opponent",
      secondaryActionTargetParticipantId: "borin",
    });
    expect(projection.activeRound.snapshots[0]?.panels.phase1).toMatchObject({
      mainHandParryItemLabel: "Long sword",
      phaseContext: { targetParticipantId: undefined },
    });
    expect(projection.activeRound.snapshots[0]?.panels.modifiers).toMatchObject({
      effects: [
        {
          id: "effect-feint-db",
          payload: { category: "db_parry", unit: "percentage", value: -2 },
          publicLabel: "Feint",
        },
      ],
    });
    expect(JSON.stringify(projection.activeRound.snapshots[0]?.panels.modifiers)).not.toContain(
      "command-private",
    );
    expect(JSON.stringify(projection.activeRound.snapshots[0]?.panels.modifiers)).not.toContain(
      "private-source",
    );
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
