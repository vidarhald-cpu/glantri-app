import { describe, expect, it } from "vitest";

import {
  canonicalCombatModifierEffectSchema,
  buildDamagePersistentLifecycle,
  combatRoundCommandSchema,
  combatRoundStateSchema,
  combatStepEventSchema,
  buildCombatCommittedDamagePublicOutcome,
  buildCombatHistorySourceViewFromState,
  buildCombatRoundAttackRollResult,
  buildCombatRoundPhaseResolutionResult,
  combatEffectSchema,
  deriveCombatHistoryStepOutcome,
  getLatestPlayerSafeCombatDefenseReview,
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
  it("projects exact C1 consequences without source identity to affected-player and GM only", () => {
    const effect = combatEffectSchema.parse({
      createdAt: "2026-08-29T08:00:00.000Z",
      criticalRuntime: {
        bleed: {
          allowedControlStates: ["active", "partial", "staunched_zero", "resolved"],
          controlState: "active",
          firstTickRound: 2,
          kind: "external",
          rate: { denominator: 3, numerator: 1 },
          sourceEffectKey: "private-source-effect",
          sourceRate: "1 HP / 3 rounds",
        },
        criticalKey: "private|critical|key",
        fixtureVersion: "c1-2026-08-28",
        kind: "bleed",
      },
      damage: 0,
      effectGroup: "bleed",
      generalDamage: 0,
      id: "private-runtime-effect",
      sourceEventId: "private-runtime-event",
      status: "active",
      targetParticipantId: "scenario-participant-aria",
      type: "bleed",
      updatedAt: "2026-08-29T08:00:00.000Z",
    });
    const state = combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 2,
    });
    const projectionInput = {
      continuingConsequences: [
        {
          criticalEffects: [effect],
          effects: [],
          ownerParticipantId: "scenario-participant-aria",
          participantId: "aria",
        },
      ],
      participants,
      source: historySource(state, "revision-c1"),
    };
    const affected = projectCombatHistory({
      ...projectionInput,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const gm = projectCombatHistory({ ...projectionInput, viewer: { kind: "gm" } });
    const other = projectCombatHistory({
      ...projectionInput,
      viewer: player(["borin"], ["aria", "borin"]),
    });

    expect(affected.currentConsequences).toEqual([
      {
        detail: "active",
        durationLabel: "Until resolved",
        summary: "Bleed 1/3 HP per round",
      },
    ]);
    expect(gm.currentConsequences).toEqual(affected.currentConsequences);
    expect(other.currentConsequences).toEqual([]);
    const serialized = JSON.stringify(affected.currentConsequences);
    [
      "private|critical|key",
      "private-source-effect",
      "private-runtime-effect",
      "private-runtime-event",
      "scenario-participant-aria",
    ].forEach((secret) => expect(serialized).not.toContain(secret));
  });

  it("keeps an active typed Critical consequence visible only to the affected Player and GM", () => {
    const activeBleed = buildDamagePersistentLifecycle({
      context: {
        commandId: "private-critical-command",
        createdAt: "2026-08-24T08:00:00.000Z",
        createdRevision: "revision-1",
        createdSequence: 12,
        encounterId: "encounter-1",
        eventId: "private-critical-event",
        ownerParticipantId: "scenario-participant-aria",
        roundNumber: 1,
      },
      effectId: "private-critical-effect",
      isStunned: false,
      label: "External bleed",
      modifierValue: 5,
      notes: "External bleeding",
      sourceCritKey: "pointed_weapons|arm|12",
      sourceEffectKey: "pointed_weapons|arm|12|03",
      status: "active",
      type: "bleed",
    });
    expect(activeBleed).toBeDefined();
    const resolvedBleed = {
      ...activeBleed!,
      id: "resolved-private-critical-effect",
      lifecycle: { ...activeBleed!.lifecycle, state: "resolved" as const },
    };
    const misattachedBleed = {
      ...activeBleed!,
      id: "misattached-private-critical-effect",
      ownerParticipantId: "scenario-participant-borin",
      publicNote: "Another character's private consequence",
    };
    const state = combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 2,
    });
    const projectionInput = {
      continuingConsequences: [
        {
          effects: [activeBleed!, resolvedBleed, misattachedBleed],
          ownerParticipantId: "scenario-participant-aria",
          participantId: "aria",
        },
      ],
      participants,
      source: historySource(state, "revision-2"),
    };

    const affectedPlayer = projectCombatHistory({
      ...projectionInput,
      viewer: player(["aria"], ["aria", "borin"]),
    });
    const otherPlayer = projectCombatHistory({
      ...projectionInput,
      viewer: player(["borin"], ["aria", "borin"]),
    });
    const gm = projectCombatHistory({ ...projectionInput, viewer: { kind: "gm" } });

    expect(affectedPlayer.currentConsequences).toEqual([
      {
        detail: "External bleeding",
        durationLabel: "Until cleared",
        summary: "Bleed 5/10 HP per round",
      },
    ]);
    expect(gm.currentConsequences).toEqual(affectedPlayer.currentConsequences);
    expect(otherPlayer.currentConsequences).toEqual([]);
    const serialized = JSON.stringify(affectedPlayer.currentConsequences);
    [
      "pointed_weapons",
      "private-critical-command",
      "private-critical-event",
      "private-critical-effect",
      "Another character's private consequence",
      "aria",
      "scenario-participant-aria",
    ].forEach((secret) => expect(serialized).not.toContain(secret));
  });

  it("projects only defender-safe committed defense facts and orders tied events by sequence", () => {
    const defenseEvent = (sequence: number, aware: boolean) =>
      event({
        attackerParticipantId: "hidden",
        defenderParticipantId: "aria",
        facts: {
          gmReview: {
            defenseSnapshot: {
              attackerParticipantId: "hidden",
              itemRevision: "secret-revision",
              templateId: "secret-template",
            },
          },
          involvedOutcome: {},
          publicOutcome: { hit: true },
          rollerPrivate: {
            attackDirection: sequence === 3 ? "rear" : "front",
            aware,
            ordinaryDodgeAvailable: aware,
            sources: [
              {
                included: sequence !== 2,
                kind: "shield",
                label: "Round shield",
                slot: "offHand",
              },
            ],
          },
        },
        id: `attack:hidden:item-hidden-sword:${sequence}`,
        ownerParticipantId: "aria",
        phase: "phase1",
        rollerParticipantId: "aria",
        sequence,
        type: "attack",
        visibility: {
          identityRefs: [
            { participantId: "hidden", role: "attacker" },
            { participantId: "aria", role: "defender" },
          ],
          involvedParticipantIds: ["hidden", "aria"],
          outcomeScope: "involved",
        },
      });
    const defenderEvents = [1, 2, 3].map((sequence) =>
      projectCombatHistoryEvent({
        event: defenseEvent(sequence, sequence !== 2),
        participants,
        viewer: player(["aria"], ["aria"]),
      }),
    );
    const projected = defenderEvents.filter(
      (candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate),
    );

    expect(projected).toHaveLength(3);
    expect(
      getLatestPlayerSafeCombatDefenseReview({
        defenderParticipantId: "aria",
        events: projected,
        phase: "phase1",
        roundNumber: 1,
      }),
    ).toMatchObject({ attackDirection: "rear", aware: true, eventSequence: 3 });
    const serialized = JSON.stringify(projected);
    ["hidden", "item-hidden-sword", "secret-revision", "secret-template"].forEach((secret) =>
      expect(serialized).not.toContain(secret),
    );

    const attacker = projectCombatHistoryEvent({
      event: defenseEvent(3, true),
      participants,
      viewer: player(["hidden"], ["hidden"]),
    });
    expect(attacker?.facts.defenseReview).toBeUndefined();
    expect(
      projectCombatHistoryEvent({
        event: defenseEvent(3, true),
        participants,
        viewer: player(["cyra"], ["cyra"]),
      }),
    ).toBeUndefined();
  });

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

  // Forgejo #676. A Parry step reached on a connected attack by a defender with no eligible Parry
  // source resolves to nothing and advances to damage. Historically that has to read as its own
  // outcome: "No parry required." would tell a GM the step never needed to happen, when in fact it
  // happened and found nothing to resolve.
  it("distinguishes a Parry step that found no eligible source from one that was never required", () => {
    const hit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "aria",
      defenderDb: 0,
      defenderParticipantId: "borin",
      ob: 120,
      phase: "phase1",
      rollD20: 15,
      rollTotal: 15,
      rolledAt: "2026-01-01T00:01:00.000Z",
      weaponName: "Long sword",
    });
    expect(hit.hit).toBe(true);
    const pending = buildCombatRoundPhaseResolutionResult({
      attackResult: hit,
      roundNumber: 1,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const base = {
      committedAt: "2026-01-01T00:03:00.000Z",
      id: "snapshot-no-eligible-parry",
      participantId: "borin",
      participantLabel: "Borin",
      phase: "phase1" as const,
      roundNumber: 1,
      step: "review_phase_2_actions" as const,
    };

    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        attackResult: hit,
        phaseResolutionResult: {
          ...pending,
          parryResolution: {
            ...pending.parryResolution,
            noEligibleParrySource: true,
            resultLabel: "No Parry available",
            status: "not_applicable",
          },
        },
      }),
    ).toEqual({
      category: "not_required",
      message:
        "No Parry available. The defender wielded no Parry-eligible source, so the attack " +
        "advanced to damage.",
      reason: "no_eligible_parry_source",
    });

    // The pre-existing outcome for the same status without the flag is unchanged, so the two
    // cannot be confused for each other.
    expect(
      deriveCombatHistoryStepOutcome({
        ...base,
        attackResult: hit,
        phaseResolutionResult: {
          ...pending,
          parryResolution: { ...pending.parryResolution, status: "not_applicable" },
        },
      }),
    ).toEqual({
      category: "not_required",
      message: "No parry required.",
      reason: "parry_not_required",
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
    /*
     * #862 V1. This used to assert `uninvolved` was `undefined` — the whole event was dropped for
     * a viewer controlling neither side. Under the Product Owner's board-game rule (#854 ruling
     * 19297) an attack and its hit/miss are table state, so the event now reaches a bystander.
     * The assertion is re-pinned, not relaxed: what this test is actually about — the calculation
     * reaching only the roller and the involved detail only the two parties — is asserted harder
     * on the bystander than a single `toBeUndefined()` could manage.
     */
    expect(uninvolved, "the attack event itself is table state and now arrives").toBeDefined();
    expect(uninvolved?.facts.publicOutcome).toEqual({});
    expect(uninvolved?.facts.involvedOutcome).toBeUndefined();
    expect(uninvolved?.facts.privateCalculation).toBeUndefined();
    expect(uninvolved?.facts.gmReview).toBeUndefined();
    expect(JSON.stringify(uninvolved)).not.toContain("18 + 4");
    expect(JSON.stringify(uninvolved)).not.toContain("rollD20");
    expect(roller?.ownerParticipantId).toBe("aria");
  });
  it("gives no player the attack result's workbook import provenance; the GM keeps it (#517 ruling E2)", () => {
    const workbookProvenance = {
      rawRow: { A: "T. Javelin", B: "12" },
      row: 17,
      sheet: "Weapon2",
      sourceColumns: { name: "A" },
      sourceRange: "A17:K17",
      workbook: "Themistogenes 1.07.xlsx",
    };
    // The missile DMB roll as production stored it on 17-18 August 2026: its `provenance` names the
    // workbook sheet and row. Players receive no part of it; the DMB value stays in `weaponDmb`.
    const dmbRoll = {
      diceCount: 1,
      diceSides: 6,
      flatModifier: 0,
      provenance: "Weapon2:17:1d6",
      rolls: [4],
      total: 4,
    };
    const attack = event({
      attackerParticipantId: "aria",
      defenderParticipantId: "borin",
      facts: {
        gmReview: {},
        involvedOutcome: {
          status: "shot_committed",
          weaponDmb: 4,
          weaponDmbRoll: dmbRoll,
          weaponModeRange: "3.0",
          weaponModeSourceMetadata: workbookProvenance,
          weaponName: "Javelin",
        },
        publicOutcome: {
          status: "shot_committed",
          weaponDmbRoll: dmbRoll,
          weaponModeSourceMetadata: workbookProvenance,
        },
        rollerPrivate: {
          rollD20: 14,
          weaponDmbRoll: dmbRoll,
          weaponModeSourceMetadata: workbookProvenance,
        },
      },
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
    const project = (viewer: Parameters<typeof projectCombatHistoryEvent>[0]["viewer"]) =>
      projectCombatHistoryEvent({ event: attack, participants, viewer });
    const roller = project(player(["aria"], ["aria", "borin"]));
    const defender = project(player(["borin"], ["aria", "borin"]));
    const gm = project({ kind: "gm" });

    for (const viewer of [roller, defender]) {
      expect(viewer?.facts.involvedOutcome).toEqual({
        status: "shot_committed",
        weaponDmb: 4,
        weaponModeRange: "3.0",
        weaponName: "Javelin",
      });
      expect(viewer?.facts.publicOutcome).toEqual({ status: "shot_committed" });
      expect(JSON.stringify(viewer)).not.toContain("Weapon2");
    }
    expect(roller?.facts.privateCalculation).toEqual({ rollD20: 14 });
    expect(gm?.facts.involvedOutcome?.weaponModeSourceMetadata).toEqual(workbookProvenance);
    expect(gm?.facts.publicOutcome.weaponModeSourceMetadata).toEqual(workbookProvenance);
    expect(gm?.facts.privateCalculation?.weaponModeSourceMetadata).toEqual(workbookProvenance);
    for (const facts of [
      gm?.facts.involvedOutcome,
      gm?.facts.publicOutcome,
      gm?.facts.privateCalculation,
    ]) {
      expect(facts?.weaponDmbRoll).toEqual(dmbRoll);
    }
  });

  it("keeps missile preparation progress private to the actor while targets see safe status", () => {
    const readiness = event({
      actorParticipantId: "aria",
      facts: {
        gmReview: { gmPreparationAdjustment: 4 },
        involvedOutcome: { status: "preparing" },
        publicOutcome: { status: "preparing" },
        rollerPrivate: {
          aimCompletedRounds: 1,
          aimLevel: 2,
          aimRequiredRounds: 4,
          baseCompletedRounds: 1,
          baseRequiredRounds: 2,
          family: "short_bow",
          status: "preparing",
        },
      },
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      targetParticipantId: "borin",
      type: "missile_readiness",
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
    const actor = projectCombatHistoryEvent({
      event: readiness,
      participants,
      viewer: player(["aria"], ["aria", "borin", "cyra"]),
    });
    const target = projectCombatHistoryEvent({
      event: readiness,
      participants,
      viewer: player(["borin"], ["aria", "borin", "cyra"]),
    });
    const uninvolved = projectCombatHistoryEvent({
      event: readiness,
      participants,
      viewer: player(["cyra"], ["aria", "borin", "cyra"]),
    });
    const gm = projectCombatHistoryEvent({
      event: readiness,
      participants,
      viewer: { kind: "gm" },
    });

    expect(actor?.facts.privateCalculation).toMatchObject({
      aimCompletedRounds: 1,
      aimLevel: 2,
      aimRequiredRounds: 4,
      baseCompletedRounds: 1,
      baseRequiredRounds: 2,
    });
    expect(actor?.facts.gmReview).toBeUndefined();
    expect(target?.facts).toMatchObject({ involvedOutcome: { status: "preparing" } });
    expect(target?.facts.privateCalculation).toBeUndefined();
    expect(JSON.stringify(target)).not.toMatch(/aimRequiredRounds|baseRequiredRounds/);
    expect(target?.facts.gmReview).toBeUndefined();
    expect(uninvolved).toBeUndefined();
    expect(gm?.facts.gmReview).toEqual({ gmPreparationAdjustment: 4 });
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
      id: "event:hidden:attack-result:hidden:aria",
      ownerParticipantId: "hidden",
      opportunityId: "opportunity:hidden:aria",
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
    expect(projection.activeRound.events[0]).toMatchObject({
      id: "round:1:event:0",
      opportunityId: undefined,
    });
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

  it("keeps authentic Critical provenance GM-only while both combatants see safe consequences", () => {
    const committed = event({
      attackerParticipantId: "aria",
      defenderParticipantId: "borin",
      facts: {
        gmReview: {
          acceptedSourceEffectKeys: ["sharp|arm|12|03"],
          critKey: "sharp|arm|12",
          rejectedSourceEffectKeys: ["sharp|arm|12|06", "sharp|arm|12|07"],
        },
        involvedOutcome: {
          damage: 5,
          effects: [{ label: "Bleed", rateValuePerRound: 30 }],
        },
        publicOutcome: {},
        rollerPrivate: {},
      },
      type: "damage_committed",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "attacker" },
          { participantId: "borin", role: "defender" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
      },
    });
    const attacker = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["aria"], ["aria", "borin", "cyra"]),
    });
    const defender = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["borin"], ["aria", "borin", "cyra"]),
    });
    const uninvolved = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: player(["cyra"], ["aria", "borin", "cyra"]),
    });
    const gm = projectCombatHistoryEvent({
      event: committed,
      participants,
      viewer: { kind: "gm" },
    });

    for (const combatant of [attacker, defender]) {
      expect(combatant?.facts.involvedOutcome).toEqual({
        damage: 5,
        effects: [{ label: "Bleed", rateValuePerRound: 30 }],
      });
      expect(combatant?.facts.gmReview).toBeUndefined();
      expect(JSON.stringify(combatant)).not.toContain("sharp|arm|12");
    }
    /*
     * #863 rows 2 and 3 changed this expectation deliberately. `damage_committed` is now a
     * table-visible outcome type, so a bystander who can see both combatants receives the event
     * rather than having it dropped. **What it carries is the whole point of the change**, and this
     * event is a pre-#863 record whose `publicOutcome` is empty: the bystander therefore receives
     * the two visible identities and nothing else. The authentic Critical provenance this test
     * exists for stays GM-only on that path too, and so does the Bleed rate — which #863 defers to
     * #871 — so the assertion is strengthened rather than relaxed.
     */
    expect(uninvolved, "a bystander now receives the event itself").toBeDefined();
    expect(uninvolved?.facts.publicOutcome).toEqual({});
    expect(uninvolved?.facts.involvedOutcome).toBeUndefined();
    expect(uninvolved?.facts.gmReview).toBeUndefined();
    expect(uninvolved?.facts.privateCalculation).toBeUndefined();
    expect(JSON.stringify(uninvolved)).not.toContain("sharp|arm|12");
    expect(JSON.stringify(uninvolved)).not.toContain("rateValuePerRound");
    expect(JSON.stringify(uninvolved)).not.toContain("Bleed");
    expect(gm?.facts.gmReview).toMatchObject({ critKey: "sharp|arm|12" });
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

  /*
   * #862 V1 — the board-game rule (#854 ruling comment 19297) for a **bystander**: a viewer who
   * controls no participant in the exchange and is not the roller.
   *
   * The fixture is deliberately three participations wide. A two-participation encounter cannot
   * express this defect for `attack` or `parry`, because the viewer's own Character is then one of
   * the two sides and the viewer is `involved`; only a third participation makes the viewer a
   * bystander to the exchange. `cyra` controls nothing in any exchange below.
   *
   * Every event's facts are written in the buckets the production writers use, measured at this
   * baseline. Each row is asserted in **both** directions on the projected payload: the public
   * fact arrives, and the named private fields do not.
   */
  describe("#862 V1 — table-visible outcomes reach a bystander and private calculation does not", () => {
    /** `cyra` sees Aria and Borin, controls only herself, and rolls nothing below. */
    const bystander = player(["cyra"], ["aria", "borin", "cyra"]);

    const initiativeEvent = event({
      facts: {
        gmReview: { gmInitiativeNote: "gm-only" },
        involvedOutcome: {},
        publicOutcome: { resolutionType: "rolled", total: 18 },
        rollerPrivate: {
          baseInitiative: 4,
          modifierAdjustment: 2,
          rolls: [6, 6],
          rollTotal: 12,
          total: 18,
        },
      },
      id: "event-initiative-aria",
      ownerParticipantId: "aria",
      rollerParticipantId: "aria",
      sequence: 0,
      step: "initiative_phase_1",
      type: "initiative",
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

    const attackEvent = event({
      facts: {
        gmReview: { gmAttackNote: "gm-only" },
        involvedOutcome: { tableResult: "Hit for 7", weaponDmb: 3, weaponName: "Broadsword" },
        publicOutcome: { grazing: false, hit: true },
        rollerPrivate: {
          defenderDb: -12,
          lookupTotal: 94,
          ob: 80,
          openEndedD10s: [],
          rollD20: 14,
          rollTotal: 94,
        },
      },
      id: "event-attack-aria-borin",
      ownerParticipantId: "aria",
      phase: "phase1",
      rollerParticipantId: "aria",
      sequence: 1,
      step: "phase_1_actions",
      type: "attack",
      visibility: {
        identityRefs: [
          { participantId: "borin", role: "target" },
          { participantId: "aria", role: "attacker" },
          { participantId: "borin", role: "defender" },
          { participantId: "aria", role: "roller" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });

    const parryEvent = event({
      facts: {
        gmReview: { gmParryNote: "gm-only" },
        involvedOutcome: { resultLabel: "Parry held", status: "resolved", success: true },
        publicOutcome: {
          attackHit: true,
          brawlingContestOpened: false,
          parryPurpose: "defensive",
          status: "resolved",
          success: true,
        },
        rollerPrivate: {
          combinedParryScore: 46,
          modifierAdjustment: -2,
          modifierBreakdown: [{ label: "Shield", value: 4 }],
          openEndedD10s: [],
          rollD20: 11,
          rollTotal: 55,
          targetNumber: 50,
          total: 55,
        },
      },
      id: "event-parry-borin",
      ownerParticipantId: "borin",
      phase: "phase1",
      rollerParticipantId: "borin",
      sequence: 2,
      step: "review_phase_2_actions",
      type: "parry",
      visibility: {
        identityRefs: [
          { participantId: "aria", role: "target" },
          { participantId: "aria", role: "attacker" },
          { participantId: "borin", role: "defender" },
          { participantId: "borin", role: "roller" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "borin",
      },
    });

    /** Negative control: the same event type, with one identity this viewer cannot see. */
    const unseenAttackEvent = event({
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: { grazing: false, hit: true },
        rollerPrivate: { ob: 77 },
      },
      id: "event-attack-hidden-borin",
      ownerParticipantId: "hidden",
      phase: "phase1",
      rollerParticipantId: "hidden",
      sequence: 3,
      step: "phase_1_actions",
      type: "attack",
      visibility: {
        identityRefs: [
          { participantId: "borin", role: "target" },
          { participantId: "hidden", role: "attacker" },
          { participantId: "borin", role: "defender" },
          { participantId: "hidden", role: "roller" },
        ],
        involvedParticipantIds: ["hidden", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "hidden",
      },
    });

    /** Negative control: a type #862 does not admit, between the same two visible participants. */
    const criticalEvent = event({
      facts: {
        gmReview: { authenticProvenance: "gm-only" },
        involvedOutcome: { criticalGrade: "C", criticalTitle: "Shattered knee" },
        publicOutcome: {},
        rollerPrivate: { finalCriticalRoll: 88 },
      },
      id: "event-critical-aria-borin",
      ownerParticipantId: "aria",
      phase: "phase1",
      rollerParticipantId: "aria",
      sequence: 4,
      step: "phase_1_damage",
      type: "critical",
      visibility: {
        identityRefs: [
          { participantId: "borin", role: "target" },
          { participantId: "aria", role: "attacker" },
          { participantId: "aria", role: "roller" },
        ],
        involvedParticipantIds: ["aria", "borin"],
        outcomeScope: "involved",
        rollerParticipantId: "aria",
      },
    });

    /*
     * `currentStep` is what `buildCombatProgressionProjection` derives the canonical boundary from,
     * measured: `initiative_phase_1` yields boundary `phase1_initiative` and `phase_1_actions`
     * yields `phase1_resolution`. Initiative is committed only *past* its own boundary, so those
     * two values are the two sides of the publication-timing rule (#862 F1) and the default below
     * is the committed one.
     */
    const roundState = (currentStep: CombatRoundState["currentStep"] = "phase_1_actions") =>
      combatRoundStateSchema.parse({
        currentStep,
        encounterId: "encounter-1",
        events: [initiativeEvent, attackEvent, parryEvent, unseenAttackEvent, criticalEvent],
        participants: [
          { label: "Aria", participantId: "aria" },
          { label: "Borin", participantId: "borin" },
          { label: "Cyra", participantId: "cyra" },
        ],
        roundNumber: 1,
      });

    const projectionFor = (
      viewer: Parameters<typeof projectCombatHistory>[0]["viewer"],
      currentStep?: CombatRoundState["currentStep"],
    ) =>
      projectCombatHistory({
        participants,
        source: historySource(roundState(currentStep)),
        viewer,
      });

    const bystanderProjection = (currentStep?: CombatRoundState["currentStep"]) =>
      projectionFor(bystander, currentStep);

    const bystanderEvent = (id: string) =>
      bystanderProjection().activeRound.events.find((candidate) => candidate.id === id);

    it("row 1 — delivers the committed initiative total and withholds the roller's calculation", () => {
      const projection = bystanderProjection();
      const projected = projection.activeRound.events.find(
        (candidate) => candidate.type === "initiative",
      );

      // Direction 1: the public fact arrives for a viewer who controls nobody in this roll.
      expect(projected, "the initiative event must reach a bystander at all").toBeDefined();
      expect(projected?.facts.publicOutcome).toEqual({ resolutionType: "rolled", total: 18 });

      // Direction 2: every field #862 names private is absent from the projected payload.
      expect(projected?.facts.privateCalculation).toBeUndefined();
      expect(projected?.facts.involvedOutcome).toBeUndefined();
      expect(projected?.facts.gmReview).toBeUndefined();
      const serialized = JSON.stringify(projected);
      for (const field of ["baseInitiative", "modifierAdjustment", "rolls", "rollTotal"]) {
        expect(serialized, `initiative ${field} must stay owner-only`).not.toContain(field);
      }
      // Ruled explicitly: total public, calculation and rank private.
      const whole = JSON.stringify(projection);
      expect(whole).not.toContain("initiativeRank");
      expect(whole).not.toContain("rankTotal");
      // The envelope stays involved-restricted, so `outcomeScope` is still `"involved"` and the
      // bystander gets no calculation access. Admission is the only thing that changed.
      expect(projected?.resultEnvelope?.visibility).toMatchObject({
        calculationAccess: "none",
        outcomeScope: "involved",
      });
      expect(projected?.resultEnvelope?.calculationReferences).toEqual([]);
      expect(projected?.resultEnvelope?.privateDiagnostics).toEqual([]);
    });

    /*
     * #862 F1. Initiative carries its own publication-timing rule, exactly as declarations do: the
     * ruling makes the *final* number public, not one the round is still producing. #862's row 1
     * said `initiativeIsCommitted` "already gates the reveal", which is true of the web tracker's
     * hover and false of the combat-history inspector — `buildCombatEventResultModel` takes no
     * progression, boundary or commitment input at all, so a web-layer condition would leave the
     * total in the payload and merely decline to draw it. The condition therefore lives at the
     * admission gate, and the tests below assert **both sides of the boundary** and **all three**
     * audiences that must not change.
     */
    describe("initiative publication timing", () => {
      /** Boundary `phase1_initiative`: the round is still taking the phase-1 rolls. */
      const UNCOMMITTED = "initiative_phase_1" as const;
      /** Boundary `phase1_resolution`: the round has moved past them. */
      const COMMITTED = "phase_1_actions" as const;
      const initiativeOf = (projection: ReturnType<typeof projectCombatHistory>) =>
        projection.activeRound.events.find((candidate) => candidate.type === "initiative");

      it("withholds an uncommitted initiative total from a bystander entirely", () => {
        const projection = bystanderProjection(UNCOMMITTED);

        // Not reduced — absent. The fact never enters the payload, so no reader can render it.
        expect(initiativeOf(projection)).toBeUndefined();
        const serialized = JSON.stringify(projection.activeRound.events);
        expect(serialized).not.toContain("event-initiative-aria");
        expect(serialized, "the total itself must not appear anywhere").not.toContain("18");
      });

      it("delivers it to the same bystander once the boundary has passed", () => {
        const projected = initiativeOf(bystanderProjection(COMMITTED));

        expect(projected, "the committed total is table state").toBeDefined();
        expect(projected?.facts.publicOutcome).toEqual({ resolutionType: "rolled", total: 18 });
        expect(projected?.facts.privateCalculation).toBeUndefined();
        expect(projected?.facts.involvedOutcome).toBeUndefined();
        expect(projected?.facts.gmReview).toBeUndefined();
      });

      it("archives are published in full regardless of the active round's boundary", () => {
        // An archived round is past; `historical` settles it without consulting the boundary.
        const archived = projectCombatHistory({
          participants,
          source: historySource(
            combatRoundStateSchema.parse({
              currentStep: UNCOMMITTED,
              encounterId: "encounter-1",
              events: [],
              participants: [
                { label: "Aria", participantId: "aria" },
                { label: "Cyra", participantId: "cyra" },
              ],
              roundNumber: 2,
              rounds: [
                {
                  encounterId: "encounter-1",
                  events: [initiativeEvent],
                  participants: [
                    { label: "Aria", participantId: "aria" },
                    { label: "Cyra", participantId: "cyra" },
                  ],
                  roundNumber: 1,
                },
              ],
            }),
          ),
          viewer: bystander,
        });

        const projected = archived.archivedRounds[0]?.events.find(
          (candidate) => candidate.type === "initiative",
        );
        expect(projected?.facts.publicOutcome).toEqual({ resolutionType: "rolled", total: 18 });
        expect(projected?.facts.privateCalculation).toBeUndefined();
      });

      /*
       * The three audiences the repair must not touch. Each is asserted on **both** sides of the
       * boundary, because "unchanged" is a claim about both states, not about the convenient one.
       */
      it("changes nothing for the roller, an involved party or the GM, on either side", () => {
        const roller = player(["aria"], ["aria", "borin", "cyra"]);
        const involved = player(["borin"], ["aria", "borin", "cyra"]);

        for (const currentStep of [UNCOMMITTED, COMMITTED] as const) {
          const rollerInitiative = initiativeOf(projectionFor(roller, currentStep));
          expect(rollerInitiative, `roller, ${currentStep}`).toBeDefined();
          expect(rollerInitiative?.facts.publicOutcome).toEqual({
            resolutionType: "rolled",
            total: 18,
          });
          expect(
            rollerInitiative?.facts.privateCalculation,
            `roller calc, ${currentStep}`,
          ).toMatchObject({ baseInitiative: 4, rolls: [6, 6], rollTotal: 12 });

          const gmInitiative = initiativeOf(projectionFor({ kind: "gm" }, currentStep));
          expect(gmInitiative, `GM, ${currentStep}`).toBeDefined();
          expect(gmInitiative?.facts.privateCalculation, `GM calc, ${currentStep}`).toMatchObject({
            rolls: [6, 6],
          });
          expect(gmInitiative?.facts.gmReview, `GM review, ${currentStep}`).toEqual({
            gmInitiativeNote: "gm-only",
          });

          /*
           * The involved party is the control that proves the condition is confined to the
           * bystander carve-out. Borin controls no participant in Aria's *initiative* roll and so
           * is a bystander to it — he must be refused before commitment like any other. What must
           * not change is his access to the exchange he *is* involved in, which is asserted next.
           */
          const involvedProjection = projectionFor(involved, currentStep);
          const involvedAttack = involvedProjection.activeRound.events.find(
            (candidate) => candidate.id === "event-attack-aria-borin",
          );
          expect(
            involvedAttack?.facts.involvedOutcome,
            `involved attack, ${currentStep}`,
          ).toMatchObject({ weaponName: "Broadsword" });
          const involvedParry = involvedProjection.activeRound.events.find(
            (candidate) => candidate.id === "event-parry-borin",
          );
          expect(
            involvedParry?.facts.privateCalculation,
            `involved parry, ${currentStep}`,
          ).toMatchObject({ combinedParryScore: 46 });
        }
      });

      it("admits attack and parry on both sides of the initiative boundary", () => {
        // The condition is attached to the initiative arm only; rows 2-4 are unaffected by it.
        for (const currentStep of [UNCOMMITTED, COMMITTED] as const) {
          const types = bystanderProjection(currentStep)
            .activeRound.events.map((candidate) => candidate.type)
            .sort();
          expect(types, `admitted types at ${currentStep}`).toEqual(
            currentStep === UNCOMMITTED ? ["attack", "parry"] : ["attack", "initiative", "parry"],
          );
        }
      });
    });

    it("rows 2 and 3 — delivers attacker, target and hit/miss without the attack calculation", () => {
      const projected = bystanderEvent("event-attack-aria-borin");

      expect(projected, "the attack event must reach a bystander at all").toBeDefined();
      expect(projected?.facts.publicOutcome).toEqual({ grazing: false, hit: true });
      expect(
        projected?.identities.map((identity) => `${identity.role}:${identity.displayName}`),
      ).toEqual(["target:Borin", "attacker:Aria", "defender:Borin", "roller:Aria"]);

      expect(projected?.facts.privateCalculation).toBeUndefined();
      expect(projected?.facts.involvedOutcome).toBeUndefined();
      expect(projected?.facts.gmReview).toBeUndefined();
      expect(projected?.facts.defenseReview).toBeUndefined();
      const serialized = JSON.stringify(projected);
      for (const field of [
        "defenderDb",
        "lookupTotal",
        '"ob"',
        "openEndedD10s",
        "rollD20",
        "rollTotal",
        "weaponName",
        "weaponDmb",
        "tableResult",
      ]) {
        expect(serialized, `attack ${field} must not reach a bystander`).not.toContain(field);
      }
      expect(serialized).not.toContain("Broadsword");
      expect(serialized).not.toContain("Hit for 7");
    });

    it("row 4 — delivers the parry outcome without the defender's parry calculation", () => {
      const projected = bystanderEvent("event-parry-borin");

      expect(projected, "the parry event must reach a bystander at all").toBeDefined();
      expect(projected?.facts.publicOutcome).toEqual({
        attackHit: true,
        brawlingContestOpened: false,
        parryPurpose: "defensive",
        status: "resolved",
        success: true,
      });

      expect(projected?.facts.privateCalculation).toBeUndefined();
      expect(projected?.facts.involvedOutcome).toBeUndefined();
      expect(projected?.facts.gmReview).toBeUndefined();
      const serialized = JSON.stringify(projected);
      for (const field of [
        "combinedParryScore",
        "modifierAdjustment",
        "modifierBreakdown",
        "targetNumber",
        "rollD20",
        "rollTotal",
        "resultLabel",
      ]) {
        expect(serialized, `parry ${field} must not reach a bystander`).not.toContain(field);
      }
      expect(serialized).not.toContain("Parry held");
    });

    it("admits none of it when a participant in the exchange is not visible", () => {
      const projection = bystanderProjection();

      expect(
        projection.activeRound.events.find(
          (candidate) => candidate.id === "event-attack-hidden-borin",
        ),
        "an exchange with an unseen participant stays withheld in full",
      ).toBeUndefined();
      const serialized = JSON.stringify(projection.activeRound.events);
      expect(serialized).not.toContain('"hidden"');
      expect(serialized).not.toContain("unseen attacker");
    });

    it("does not widen any event type outside the three #862 admits", () => {
      const projection = bystanderProjection();

      // `critical` between the same two visible participants: still dropped. The carve-out is
      // type-scoped, so this proves it is not a general relaxation of the involvement scope.
      expect(
        projection.activeRound.events.find((candidate) => candidate.type === "critical"),
      ).toBeUndefined();
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain("Shattered knee");
      expect(serialized).not.toContain("criticalGrade");
      expect(serialized).not.toContain("finalCriticalRoll");
      expect(serialized).not.toContain("authenticProvenance");

      // And the admitted set is exactly the three types plus nothing else from this fixture.
      expect(projection.activeRound.events.map((candidate) => candidate.type).sort()).toEqual([
        "attack",
        "initiative",
        "parry",
      ]);
    });

    it("keeps every one of those facts for the parties who already had them", () => {
      // Positive control on the other side of the gate: the change must not have narrowed the
      // roller's or the GM's view of the same three events.
      const gm = projectCombatHistory({
        participants,
        source: historySource(
          combatRoundStateSchema.parse({ events: [initiativeEvent, attackEvent, parryEvent] }),
        ),
        viewer: { kind: "gm" },
      });
      const gmInitiative = gm.activeRound.events.find(
        (candidate) => candidate.type === "initiative",
      );
      expect(gmInitiative?.facts.privateCalculation).toMatchObject({ rolls: [6, 6], total: 18 });
      expect(gmInitiative?.facts.gmReview).toEqual({ gmInitiativeNote: "gm-only" });

      const defender = projectCombatHistory({
        participants,
        source: historySource(combatRoundStateSchema.parse({ events: [attackEvent, parryEvent] })),
        viewer: player(["borin"], ["aria", "borin"]),
      });
      const defenderAttack = defender.activeRound.events.find(
        (candidate) => candidate.type === "attack",
      );
      expect(defenderAttack?.facts.involvedOutcome).toMatchObject({ weaponName: "Broadsword" });
      expect(defenderAttack?.facts.privateCalculation).toBeUndefined();
      const defenderParry = defender.activeRound.events.find(
        (candidate) => candidate.type === "parry",
      );
      expect(defenderParry?.facts.privateCalculation).toMatchObject({ combinedParryScore: 46 });
    });
  });
});

/*
 * #863 — three rows of the board-game visibility ruling become public table state.
 *
 * `cyra` is the bystander throughout: she sees Aria and Borin, controls only herself, declares
 * nothing and rolls nothing. Every claim is measured in **both** directions on the projected
 * payload — the public fact arrives, and the named private fields do not — and the timing rows are
 * additionally driven in both states of the gate rather than only in the state that passes.
 *
 * Assertions are field by field. These buckets are persisted in a Prisma `Json` (`jsonb`) column,
 * which does not preserve key order, so a stringify comparison would be an unsound instrument.
 */
describe("#863 V2 — declaration content after the step closes, committed damage, and critical facts", () => {
  /** `cyra` sees Aria and Borin, controls only herself, and declares and rolls nothing below. */
  const bystander = player(["cyra"], ["aria", "borin", "cyra"]);
  const declarer = player(["aria"], ["aria", "borin", "cyra"]);

  const ariaDeclaration = (overrides: Record<string, unknown> = {}) => ({
    declaration: {
      actionId: "attack_parry",
      additionalActionNotes: "Hold the doorway.",
      movementIntent: { distancePreferences: [], mode: "hold_position" },
      phaseContexts: {
        phase1: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "borin",
        },
      },
      roundNumber: 1,
      secondaryActionId: "talk_shout",
      submittedAt: "2026-01-01T00:01:00.000Z",
      submittedBy: "player",
      ...overrides,
    },
    label: "Aria",
    participantId: "aria",
  });

  /**
   * `currentStep` is what `buildCombatProgressionProjection` derives the canonical boundary from.
   * `select_actions` and `pre_declaration` both map onto the `declaration` boundary
   * (`boundaryForStep`), and every later step maps onto a later boundary — so these are the two
   * sides of the declaration publication-timing rule.
   */
  const declarationRound = (
    currentStep: CombatRoundState["currentStep"],
    declarationOverrides: Record<string, unknown> = {},
  ) =>
    combatRoundStateSchema.parse({
      currentStep,
      encounterId: "encounter-1",
      events: [],
      participants: [
        ariaDeclaration(declarationOverrides),
        { label: "Borin", participantId: "borin" },
        { label: "Cyra", participantId: "cyra" },
      ],
      roundNumber: 1,
    });

  const declarationEventFor = (
    viewer: Parameters<typeof projectCombatHistory>[0]["viewer"],
    currentStep: CombatRoundState["currentStep"],
    declarationOverrides: Record<string, unknown> = {},
  ) => {
    const projection = projectCombatHistory({
      participants,
      source: historySource(declarationRound(currentStep, declarationOverrides)),
      viewer,
    });
    return projection.activeRound.events.find(
      (entry) => entry.type === "declaration" && entry.ownerParticipantId === "aria",
    );
  };

  it("withholds declaration content from a bystander while the declaration step is open, and publishes it once the step closes (#863 row 1)", () => {
    /*
     * The withheld direction first, and this is the direction a test that only drove a closed
     * step could not see. The event itself must still arrive: its admission is a safe progression
     * fact (#507 Tier 3) that lets the DE tracker cell distinguish submitted work from a pending
     * declaration, and this lane must not take that back.
     */
    for (const openStep of ["pre_declaration", "select_actions"] as const) {
      const open = declarationEventFor(bystander, openStep);
      expect(
        open,
        `bystander, ${openStep}: the declaration event itself is still admitted`,
      ).toBeDefined();
      expect(
        open?.facts.publicOutcome,
        `bystander, ${openStep}: no committed declaration content`,
      ).toEqual({});
      expect(
        open?.facts.involvedOutcome,
        `bystander, ${openStep}: the involved bucket still requires involvement`,
      ).toBeUndefined();
      expect(
        open?.identities.map((identity) => identity.role),
        `bystander, ${openStep}: the declared target is not named`,
      ).not.toContain("target");
    }

    // The published direction, on the same fixture with only the step moved on.
    const closed = declarationEventFor(bystander, "review_action_modifiers");
    expect(closed?.facts.publicOutcome.actionLabel).toBe("Single attack");
    expect(closed?.facts.publicOutcome.secondaryActionLabel).toBe("Talk / Shout");
    expect(closed?.facts.publicOutcome.movementLabel).toBe("Hold position");
    expect(
      closed?.identities.find((identity) => identity.role === "target"),
      "bystander, step closed: the declared target rides free on the Declaration row",
    ).toMatchObject({ displayName: "Borin", participantId: "borin", visibility: "visible" });
    expect(
      closed?.facts.involvedOutcome,
      "bystander, step closed: still no involved bucket — only the public one opened",
    ).toBeUndefined();
    expect(closed?.facts.privateCalculation).toBeUndefined();
    expect(closed?.facts.gmReview).toBeUndefined();

    // Field by field, every private declaration field #863 names.
    for (const key of [
      "additionalActionNotes",
      "intent",
      "movementIntent",
      "phaseContexts",
      "secondaryActionContext",
      "secondaryActionId",
      "submittedBy",
    ]) {
      expect(
        Object.hasOwn(closed?.facts.publicOutcome ?? {}, key),
        `bystander, step closed: ${key} must not reach the public bucket`,
      ).toBe(false);
    }

    /*
     * The two viewers who were never gated, as controls: a lane that broke either of these would
     * look identical on the bystander assertions above.
     */
    const ownDeclarationWhileOpen = declarationEventFor(declarer, "select_actions");
    expect(
      ownDeclarationWhileOpen?.facts.involvedOutcome,
      "the declarer's own declaration is unchanged while the step is open",
    ).toMatchObject({ actionLabel: "Single attack", submittedBy: "player" });
    expect(ownDeclarationWhileOpen?.facts.publicOutcome.actionLabel).toBe("Single attack");
    const gmWhileOpen = declarationEventFor({ kind: "gm" }, "select_actions");
    expect(gmWhileOpen?.facts.involvedOutcome).toMatchObject({
      additionalActionNotes: "Hold the doorway.",
    });
    expect(
      gmWhileOpen?.identities.find((identity) => identity.role === "target")?.displayName,
    ).toBe("Borin");
  });

  it("withholds the observed opponent from a bystander even after the step closes (#863 row 1)", () => {
    /*
     * `declarationTargetParticipantId` reads `secondaryActionContext.targetParticipantId` first,
     * so on an observing declaration the event's target slot holds the *observed* opponent. The
     * session body screens exactly that from a non-controller, and publishing it here would route
     * the same fact through a second channel.
     */
    const observing = declarationEventFor(bystander, "review_action_modifiers", {
      secondaryActionContext: { action: "observe_opponent", targetParticipantId: "borin" },
      secondaryActionId: "observe_opponent",
    });
    expect(observing?.facts.publicOutcome.actionLabel).toBe("Single attack");
    expect(Object.hasOwn(observing?.facts.publicOutcome ?? {}, "secondaryActionLabel")).toBe(false);
    expect(
      observing?.identities.map((identity) => identity.role),
      "bystander: the observed opponent is not named",
    ).not.toContain("target");

    // The GM still sees both, so this is a projection rather than a deletion.
    const gmObserving = declarationEventFor({ kind: "gm" }, "review_action_modifiers", {
      secondaryActionContext: { action: "observe_opponent", targetParticipantId: "borin" },
      secondaryActionId: "observe_opponent",
    });
    expect(gmObserving?.facts.involvedOutcome?.secondaryActionLabel).toBe("Observe Opponent");
    expect(
      gmObserving?.identities.find((identity) => identity.role === "target")?.displayName,
    ).toBe("Borin");
  });

  /*
   * Rows 2 and 3. The event's facts are written in the buckets the production writers use: the
   * public bucket is built by the one shared definition both writers call, so this fixture cannot
   * drift from what they author. `combatRoundManager.test.ts` measures that authoring end to end
   * through the real commit; this measures what the projection then releases, and to whom.
   */
  const damageCommittedEvent = event({
    facts: {
      gmReview: {
        additionalEffects: [],
        computedCriticalGrade: "c",
        operationalConsequences: [],
        review: {
          bleedRate: "1/3",
          criticalEffectProposal: { title: "Shattered knee" },
          mortality: "none",
          selfStaunch: false,
          treatment: "surgery",
          urgency: "immediate",
        },
      },
      involvedOutcome: {
        criticalGrade: "c",
        criticalTitle: "Shattered knee",
        finalCommittedDamage: 17,
        hitLocation: "leg",
      },
      publicOutcome: buildCombatCommittedDamagePublicOutcome({
        criticalGrade: "c",
        criticalTitle: "Shattered knee",
        finalCommittedDamage: 17,
        hitLocation: "leg",
      }),
      rollerPrivate: {
        armorModifier: -8,
        damageLookupTotal: 94,
        damageRoll: 12,
        defenderDm: 0,
        dmb: 8,
        hitLookupTotal: 94,
      },
    },
    id: "event-damage-committed-aria-borin",
    ownerParticipantId: "borin",
    phase: "phase1",
    rollerParticipantId: "aria",
    sequence: 1,
    status: "committed",
    step: "phase_1_damage",
    type: "damage_committed",
    visibility: {
      identityRefs: [
        { participantId: "aria", role: "attacker" },
        { participantId: "borin", role: "defender" },
        { participantId: "borin", role: "target" },
      ],
      involvedParticipantIds: ["aria", "borin"],
      outcomeScope: "involved",
      rollerParticipantId: "aria",
    },
  });

  /** Negative control: the proposal stage of the same exchange, which stays refused outright. */
  const damageProposedEvent = event({
    facts: {
      gmReview: {},
      involvedOutcome: { criticalGrade: "c", selectedHitLocation: "leg", totalDamage: 19 },
      publicOutcome: {},
      rollerPrivate: { armorModifier: -8, damageRoll: 12 },
    },
    id: "event-damage-proposed-aria-borin",
    ownerParticipantId: "borin",
    phase: "phase1",
    rollerParticipantId: "aria",
    sequence: 0,
    status: "proposed",
    step: "phase_1_damage",
    type: "damage_proposed",
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

  const damageProjection = (viewer: Parameters<typeof projectCombatHistory>[0]["viewer"]) =>
    projectCombatHistory({
      continuingConsequences: [
        {
          criticalEffects: [],
          effects: [],
          ownerParticipantId: "scenario-participant-borin",
          participantId: "borin",
        },
      ],
      participants,
      source: historySource(
        combatRoundStateSchema.parse({
          currentStep: "phase_1_damage",
          encounterId: "encounter-1",
          events: [damageProposedEvent, damageCommittedEvent],
          participants: [
            { label: "Aria", participantId: "aria" },
            { label: "Borin", participantId: "borin" },
            { label: "Cyra", participantId: "cyra" },
          ],
          roundNumber: 1,
        }),
      ),
      viewer,
    });

  it("publishes the committed damage amount, critical grade, hit location and title to a bystander, and nothing else from that event (#863 rows 2-3)", () => {
    const projection = damageProjection(bystander);
    const committed = projection.activeRound.events.find(
      (entry) => entry.type === "damage_committed",
    );
    if (!committed)
      throw new Error("Expected the bystander to receive the damage_committed event.");

    expect(committed.facts.publicOutcome.finalCommittedDamage).toBe(17);
    expect(committed.facts.publicOutcome.criticalGrade).toBe("c");
    expect(committed.facts.publicOutcome.hitLocation).toBe("leg");
    expect(committed.facts.publicOutcome.criticalTitle).toBe("Shattered knee");
    expect(committed.facts.publicOutcome.status).toBe("committed");
    expect(
      committed.identities.map((identity) => identity.displayName).sort(),
      "the exchange's visible identities, which the Combat Log already names to every player",
    ).toEqual(["Aria", "Borin", "Borin"]);

    // The other three buckets, which this lane does not widen.
    expect(committed.facts.involvedOutcome).toBeUndefined();
    expect(committed.facts.privateCalculation).toBeUndefined();
    expect(committed.facts.gmReview).toBeUndefined();
    expect(committed.facts.defenseReview).toBeUndefined();

    /*
     * The negative assertion, taken on the serialized payload rather than on any one bucket,
     * because a field can reach a reader through a bucket nobody was looking at. Every damage
     * arithmetic input and every resolved-critical field #863 defers to #871.
     */
    const serialized = JSON.stringify(committed);
    for (const field of [
      "armorModifier",
      "bleed",
      "bleedKind",
      "bleedRate",
      "computedCriticalGrade",
      "condition",
      "damageLookupTotal",
      "damageRoll",
      "defenderDm",
      "dmb",
      "gmReview",
      "hitLookupTotal",
      "mortality",
      "operationalConsequences",
      "selfStaunch",
      "totalDamage",
      "treatment",
      "urgency",
    ]) {
      expect(
        serialized,
        `bystander: ${field} must not appear anywhere in the projected damage_committed payload`,
      ).not.toContain(field);
    }

    // `resultPresentation` stays restricted because `outcomeScope` was not widened.
    expect(committed.resultEnvelope?.publicCombatNote).toBeUndefined();
    expect(committed.resultEnvelope?.standardConsequences).toEqual([]);
    expect(committed.resultEnvelope?.committedConsequences).toEqual([]);
    expect(committed.resultEnvelope?.privateDiagnostics).toEqual([]);

    // `damage_proposed` is still refused outright.
    expect(
      projection.activeRound.events.some((entry) => entry.type === "damage_proposed"),
      "bystander: damage_proposed stays refused",
    ).toBe(false);

    /*
     * The continuing-consequence rule this lane must not moot: `currentConsequences` is
     * GM-or-affected-controller, and the only consequence here belongs to Borin.
     */
    expect(
      projection.currentConsequences,
      "bystander: no continuing-consequence entry for a participant the viewer does not control",
    ).toEqual([]);
  });

  it("leaves the involved parties and the GM with exactly what they had (#863 rows 2-3)", () => {
    const involved = damageProjection(player(["borin"], ["aria", "borin", "cyra"]));
    const committed = involved.activeRound.events.find(
      (entry) => entry.type === "damage_committed",
    );
    expect(committed?.facts.involvedOutcome).toMatchObject({
      criticalGrade: "c",
      criticalTitle: "Shattered knee",
      finalCommittedDamage: 17,
      hitLocation: "leg",
    });
    expect(
      committed?.facts.gmReview,
      "an involved party is not the GM and receives no GM review",
    ).toBeUndefined();
    expect(
      committed?.facts.privateCalculation,
      "the defender did not roll the damage, so the roller-private calculation stays withheld",
    ).toBeUndefined();
    /*
     * Measured, not assumed: `damage_proposed` is refused to *every* player, involved or not —
     * `shouldProjectPlayerEvent` refuses it before any visibility question is asked. The GM below
     * is therefore the control for that refusal, and this lane leaves it exactly as it was.
     */
    expect(
      involved.activeRound.events.some((entry) => entry.type === "damage_proposed"),
      "an involved party does not reach the proposal stage either",
    ).toBe(false);

    const roller = damageProjection(player(["aria"], ["aria", "borin", "cyra"]));
    expect(
      roller.activeRound.events.find((entry) => entry.type === "damage_committed")?.facts
        .privateCalculation,
    ).toMatchObject({ armorModifier: -8, damageLookupTotal: 94 });

    const gm = damageProjection({ kind: "gm" });
    expect(
      gm.activeRound.events.find((entry) => entry.type === "damage_committed")?.facts.gmReview,
    ).toMatchObject({ computedCriticalGrade: "c" });
    expect(
      gm.activeRound.events.some((entry) => entry.type === "damage_proposed"),
      "control for the refusal: the proposal stage exists in the round and only the GM reaches it",
    ).toBe(true);
  });

  it("stays sane at the Alpha sizing floor of roughly 200 participants (#819 standing rule 2)", () => {
    /*
     * One declaration per even participant plus one committed-damage event per pair, projected for
     * the bystander, at the Alpha sizing floor.
     *
     * **The correctness claim is the projected counts**, which is what this test asserts: the
     * bystander reaches every one of the 100 damage events and 100 declarations, so the gate is a
     * per-event decision that does not degrade or truncate at size.
     *
     * The wall-clock bound is a crash barrier, not the sizing evidence, and it is deliberately
     * loose because a timing assertion in a unit suite is a flake generator. The sizing evidence
     * is a differential measured against the baseline tree and recorded on the PR: at 200
     * participants the bystander went from 101 projected events at 4710-5114 ms (baseline
     * `847fb53a`) to 200 projected events at 3983-4539 ms (this head), with the GM unchanged at
     * 200 events and 4450-4870 ms in both trees. So this lane doubles what a bystander receives
     * without adding wall clock, and the four-to-five seconds at this size is pre-existing
     * projection cost that the GM has always paid — reported, not introduced.
     */
    const size = 200;
    const roster = Array.from({ length: size }, (_, index) => ({
      displayName: `Combatant ${index}`,
      participantId: `p-${index}`,
    }));
    const started = Date.now();
    const projection = projectCombatHistory({
      participants: roster,
      source: historySource(
        combatRoundStateSchema.parse({
          currentStep: "phase_1_damage",
          encounterId: "encounter-1",
          events: Array.from({ length: size / 2 }, (_, index) =>
            event({
              ...damageCommittedEvent,
              id: `event-damage-${index}`,
              ownerParticipantId: `p-${index * 2 + 1}`,
              rollerParticipantId: `p-${index * 2}`,
              sequence: index,
              visibility: {
                identityRefs: [
                  { participantId: `p-${index * 2}`, role: "attacker" },
                  { participantId: `p-${index * 2 + 1}`, role: "defender" },
                ],
                involvedParticipantIds: [`p-${index * 2}`, `p-${index * 2 + 1}`],
                outcomeScope: "involved",
                rollerParticipantId: `p-${index * 2}`,
              },
            }),
          ),
          participants: roster.map((entry, index) => ({
            ...(index % 2 === 0
              ? {
                  declaration: {
                    actionId: "attack_parry",
                    roundNumber: 1,
                    submittedAt: "2026-01-01T00:01:00.000Z",
                    submittedBy: "player",
                  },
                }
              : {}),
            label: entry.displayName,
            participantId: entry.participantId,
          })),
          roundNumber: 1,
        }),
      ),
      viewer: {
        controlledParticipantIds: new Set(["p-0"]),
        kind: "player",
        visibleParticipantIds: new Set(roster.map((entry) => entry.participantId)),
      },
    });
    const elapsedMs = Date.now() - started;

    expect(projection.rows).toHaveLength(size);
    expect(
      projection.activeRound.events.filter((entry) => entry.type === "damage_committed"),
    ).toHaveLength(size / 2);
    expect(
      projection.activeRound.events.filter((entry) => entry.type === "declaration"),
    ).toHaveLength(size / 2);
    expect(
      projection.activeRound.events.find(
        (entry) => entry.type === "damage_committed" && entry.ownerParticipantId === "p-3",
      )?.facts.publicOutcome.finalCommittedDamage,
      "a bystander's view of an exchange it is not part of still carries the committed amount at this size",
    ).toBe(17);
    // Loose on purpose: see the comment at the top of this test. The measured range on this
    // machine is 4.0-5.4s for either viewer, in both the baseline and this tree.
    expect(elapsedMs, `projection took ${elapsedMs}ms at ${size} participants`).toBeLessThan(
      30_000,
    );
  });
});

/**
 * #931. A declaration event records its `phaseContexts` whole into `involvedOutcome`, which an
 * `involved` viewer receives — and the declaring player is one. A by-response-key sweep of real
 * player reads measured `supersededGmFigure` arriving there, four levels down. The Product Owner's
 * ruling (comment 21255) is that the supersession is GM workflow and reaches no player; the
 * disposition on comment 21269 authorizes keeping this lane's own field out of the bucket without
 * narrowing the bucket, which stays #528's.
 */
describe("the superseded GM figure never reaches a player through an event fact bucket (#931)", () => {
  const supersededRow = {
    application: "percentage",
    generated: true,
    id: "generated:attack-phase-penalty:round:1:participant:aria:phase2:attack_2:db-parry",
    notes: "Double Attack second attack cancelled: DB/Parry -2% in phase2",
    scope: "until",
    sourceActionId: "double_attack",
    sourcePhase: "phase2",
    supersededGmFigure: { text: "committed weapon attack: DB/Parry -4% in phase2", value: -1 },
    value: -2,
  };

  const declarationWithSupersededRow = () =>
    event({
      actorParticipantId: "aria",
      facts: {
        gmReview: {},
        involvedOutcome: {
          actionId: "double_attack",
          phaseContexts: {
            phase2: {
              modifierBuckets: {
                general: [],
                situationDb: [supersededRow],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
          },
        },
        publicOutcome: { actionLabel: "Double Attack" },
        rollerPrivate: {},
      },
      ownerParticipantId: "aria",
      step: "select_actions",
      type: "declaration",
      visibility: {
        identityRefs: [{ participantId: "aria", role: "actor" }],
        involvedParticipantIds: ["aria"],
        outcomeScope: "involved",
      },
    });

  it("keeps it for the GM and removes it for the declaring player", () => {
    const declaration = declarationWithSupersededRow();
    // The instrument is alive: the event really carries the figure before projection.
    expect(JSON.stringify(declaration)).toContain("supersededGmFigure");

    const gm = projectCombatHistoryEvent({
      event: declaration,
      participants,
      viewer: { kind: "gm" },
    });
    const own = projectCombatHistoryEvent({
      event: declaration,
      participants,
      viewer: player(["aria"], ["aria", "borin"]),
    });

    // The GM's own read is unchanged: the figure is still there, and so is the rest of the bucket.
    expect(JSON.stringify(gm)).toContain("supersededGmFigure");
    expect(gm?.facts.involvedOutcome).toBeDefined();

    // The declaring player receives the bucket, and the row, without the figure.
    expect(own?.facts.involvedOutcome).toBeDefined();
    expect(JSON.stringify(own)).not.toContain("supersededGmFigure");
    expect(JSON.stringify(own)).toContain(
      "Double Attack second attack cancelled: DB/Parry -2% in phase2",
    );
  });
});
