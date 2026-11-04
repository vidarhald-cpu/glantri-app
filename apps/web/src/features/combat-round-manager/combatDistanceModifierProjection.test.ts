import { describe, expect, it } from "vitest";

import {
  buildCombatRoundAttackRollResult,
  buildCombatRoundDeclaredAttackOpportunities,
  combatRoundStateSchema,
  encounterSessionSchema,
  initializeCombatRoundState,
  isAttackPhaseDefensivePenaltyModifier,
  scenarioParticipantCombatContextSchema,
  setDistanceBetween,
  type CombatRoundPhaseContexts,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "@glantri/domain";

import { buildPlayerCombatModifierRows } from "@/features/player-combat/PlayerCombatPanels";
import type { EquipmentFeatureState } from "@/features/equipment/types";

import { projectCombatActionGeneratedModifiers } from "./combatDistanceModifierProjection";

function emptyModifierBuckets() {
  return scenarioParticipantCombatContextSchema.parse({}).modifierBuckets;
}

const attackParryDistanceRow: ScenarioCombatModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:distance:phase1:ob-skill",
  notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
  scope: "until",
  sourceActionId: "attack_parry",
  sourcePhase: "phase1",
  sourceRule: "distance-ob-skill-phase1",
  value: -2,
};

const phaseContexts: CombatRoundPhaseContexts = {
  phase1: {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId: "scenario-gladiator",
  },
};

function buildEncounter() {
  return encounterSessionSchema.parse({
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "encounter-1",
    participants: [
      {
        id: "scyrian",
        label: "Scyrian cavalry guy",
        participantType: "scenario",
        scenarioParticipantId: "scenario-scyrian",
      },
      {
        id: "gladiator",
        label: "The Gladiator",
        participantType: "scenario",
        scenarioParticipantId: "scenario-gladiator",
      },
    ],
    title: "Test encounter",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function buildRoundStateWithDistance(distance: number) {
  const roundState = initializeCombatRoundState({ encounter: buildEncounter() });

  return combatRoundStateSchema.parse({
    ...roundState,
    distanceState: setDistanceBetween({
      distance,
      lastChangedRound: roundState.roundNumber,
      participantAId: "scyrian",
      participantBId: "gladiator",
      source: "gm_set",
      state: roundState.distanceState,
    }),
  });
}

function buildWeaponEquipmentState() {
  return {
    activeLoadoutByCharacterId: {},
    itemsById: {},
    templates: {
      templatesById: {
        broadSword: {
          category: "weapon",
          id: "broadSword",
          name: "Broad sword",
          range: 2,
        },
      },
    },
  };
}

function buildCommittedContext(): ScenarioParticipantCombatContext {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [
        {
          durationRounds: 1,
          generated: true,
          id: "generated:attack-parry:phase1:db-parry",
          notes: "single attack",
          scope: "until",
          sourceActionId: "attack_parry",
          sourcePhase: "phase1",
          sourceRule: "attack-parry-db-parry-phase1",
          value: -4,
        },
      ],
      situationInitiative: [],
      situationObSkill: [attackParryDistanceRow],
    },
  };
}

describe("projectCombatActionGeneratedModifiers", () => {
  it("projects Parry's Dodge-derived percentage modifier into declaration and review rows", () => {
    const roundState = buildRoundStateWithDistance(3);
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      dodgeSkillValue: 17,
      encounterParticipant: buildEncounter().participants[0],
      roundState,
    });
    const modifierRows = buildPlayerCombatModifierRows({
      combatContext: projectedContext,
      currentRound: roundState.roundNumber,
      encounterId: roundState.encounterId,
      phaseKey: "phase1",
    });
    const dbRow = modifierRows.find((row) => row.bucketKey === "situation_db");

    expect(dbRow).toMatchObject({
      entries: [
        expect.objectContaining({
          application: "percentage",
          id: "generated:parry:round:db-parry-percentage",
          notes: expect.stringContaining("Dodge 17"),
          sourceActionId: "parry",
          value: 3,
        }),
      ],
      total: 3,
    });
  });

  it("preserves the committed Parry row at M1 while Dodge hydration is unavailable", () => {
    const roundState = buildRoundStateWithDistance(3);
    const committedContext = projectCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      dodgeSkillValue: 7,
      encounterParticipant: buildEncounter().participants[0],
      roundState,
    });
    const m1Context = projectCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: committedContext,
      encounterParticipant: buildEncounter().participants[0],
      roundState,
    });
    const phase1Rows = buildPlayerCombatModifierRows({
      combatContext: m1Context,
      currentRound: roundState.roundNumber,
      encounterId: roundState.encounterId,
      phaseKey: "phase1",
    });
    const phase2Rows = buildPlayerCombatModifierRows({
      combatContext: m1Context,
      currentRound: roundState.roundNumber,
      encounterId: roundState.encounterId,
      phaseKey: "phase2",
    });

    expect(m1Context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        application: "percentage",
        id: "generated:parry:round:db-parry-percentage",
        sourceRoundNumber: roundState.roundNumber,
        value: 1,
      }),
    ]);
    expect(phase1Rows.find((row) => row.bucketKey === "situation_db")).toMatchObject({
      entries: [expect.objectContaining({ value: 1 })],
      total: 1,
    });
    expect(phase2Rows.find((row) => row.bucketKey === "situation_db")).toMatchObject({
      entries: [expect.objectContaining({ value: 1 })],
      total: 1,
    });
  });

  it("does not preserve the committed Parry row after the action changes", () => {
    const roundState = buildRoundStateWithDistance(3);
    const committedContext = projectCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      dodgeSkillValue: 7,
      roundState,
    });
    const changedContext = projectCombatActionGeneratedModifiers({
      actionId: "full_defense",
      combatContext: committedContext,
      roundState,
    });

    expect(changedContext.modifierBuckets.situationDb).toEqual([]);
  });

  it("projects the Offensive Parry round DB/Parry percentage drawback", () => {
    const roundState = buildRoundStateWithDistance(3);
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "offensive_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      encounterParticipant: buildEncounter().participants[0],
      roundState,
    });
    const modifierRows = buildPlayerCombatModifierRows({
      combatContext: projectedContext,
      currentRound: roundState.roundNumber,
      encounterId: roundState.encounterId,
      phaseKey: "phase1",
    });
    const dbRow = modifierRows.find((row) => row.bucketKey === "situation_db");

    expect(dbRow).toMatchObject({
      entries: [
        expect.objectContaining({
          application: "percentage",
          expiresAtRound: roundState.roundNumber,
          id: "generated:offensive-parry:round:percentage-db",
          sourceActionId: "offensive_parry",
          sourceRoundNumber: roundState.roundNumber,
          value: -2,
        }),
      ],
      total: -2,
    });
  });

  it("uses a Single attack declared farther distance for the visible Skill/OB penalty", () => {
    const encounter = buildEncounter();
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      encounterParticipant: encounter.participants[0],
      movementIntent: {
        distancePreferences: [
          {
            desiredDistance: 4,
            source: "player_declared",
            targetParticipantId: "scenario-gladiator",
          },
        ],
        mode: "set_distance_preferences",
      },
      phaseContexts,
      phaseWeaponNames: { phase1: "Broad sword" },
      resolvedEquipmentState: buildWeaponEquipmentState() as unknown as EquipmentFeatureState,
      roundState: buildRoundStateWithDistance(2),
    });

    expect(projectedContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("declared 4"),
        sourcePhase: "phase1",
        value: -4,
      }),
    ]);
  });

  it("applies attack-distance modifiers to Feint's Phase 2 attack, not its Phase 1 contest", () => {
    const encounter = buildEncounter();
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "feint_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      encounterParticipant: encounter.participants[0],
      phaseContexts: {
        phase1: {
          modifierBuckets: emptyModifierBuckets(),
          targetParticipantId: "scenario-gladiator",
        },
        phase2: {
          modifierBuckets: emptyModifierBuckets(),
          targetParticipantId: "scenario-gladiator",
        },
      },
      phaseWeaponNames: { phase2: "Broad sword" },
      resolvedEquipmentState: buildWeaponEquipmentState() as unknown as EquipmentFeatureState,
      roundState: buildRoundStateWithDistance(3),
    });

    expect(projectedContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase2:ob-skill",
        sourceActionId: "feint_attack",
        sourcePhase: "phase2",
        value: -2,
      }),
    ]);
  });

  it("projects the Reactive attack phase 2 Initiative row after a phase-one attack", () => {
    const encounter = buildEncounter();
    const baseRoundState = initializeCombatRoundState({ encounter });
    const declared = combatRoundStateSchema.parse({
      ...baseRoundState,
      participants: baseRoundState.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              declaration: {
                actionId: "parry_attack",
                phaseContexts: {
                  phase2: {
                    modifierBuckets: {
                      general: [],
                      situationDb: [],
                      situationInitiative: [],
                      situationObSkill: [],
                    },
                    targetParticipantId: "scenario-scyrian",
                  },
                },
                roundNumber: baseRoundState.roundNumber,
                submittedBy: "gm",
              },
            }
          : participant,
      ),
    });
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "scyrian",
      defenderDb: 10,
      defenderParticipantId: "gladiator",
      ob: 10,
      phase: "phase1",
      rollD20: 8,
      rollTotal: 8,
      rolledAt: "2026-01-01T00:02:00.000Z",
      weaponName: "Long sword",
    });
    const withIncomingAttack = combatRoundStateSchema.parse({
      ...declared,
      participants: declared.participants.map((participant) =>
        participant.participantId === "scyrian"
          ? {
              ...participant,
              attackResults: {
                ...participant.attackResults,
                phase1: attackResult,
              },
            }
          : participant,
      ),
    });
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      encounterParticipant: encounter.participants[1],
      phaseContexts: {
        phase2: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "scenario-scyrian",
        },
      },
      roundState: withIncomingAttack,
    });

    expect(projectedContext.modifierBuckets.situationInitiative).toEqual([
      expect.objectContaining({
        id: "generated:parry-attack:phase2:initiative",
        notes: "reactive attack: phase 1 attack missed; no parry needed",
        sourcePhase: "phase2",
        value: 6,
      }),
    ]);
  });

  it("projects a pending Reactive attack phase 2 Initiative context before phase one resolves", () => {
    const encounter = buildEncounter();
    const baseRoundState = initializeCombatRoundState({ encounter });
    const declared = combatRoundStateSchema.parse({
      ...baseRoundState,
      participants: baseRoundState.participants.map((participant) =>
        participant.participantId === "gladiator"
          ? {
              ...participant,
              declaration: {
                actionId: "parry_attack",
                phaseContexts: {
                  phase2: {
                    modifierBuckets: {
                      general: [],
                      situationDb: [],
                      situationInitiative: [],
                      situationObSkill: [],
                    },
                    targetParticipantId: "scenario-scyrian",
                  },
                },
                roundNumber: baseRoundState.roundNumber,
                submittedBy: "gm",
              },
            }
          : participant,
      ),
    });
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      encounterParticipant: encounter.participants[1],
      phaseContexts: {
        phase2: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "scenario-scyrian",
        },
      },
      roundState: declared,
    });
    const modifierRows = buildPlayerCombatModifierRows({
      combatContext: projectedContext,
      phaseKey: "phase2",
    });
    const initiativeRow = modifierRows.find((row) => row.bucketKey === "situation_initiative");

    expect(initiativeRow?.entries).toEqual([
      expect.objectContaining({
        id: "generated:parry-attack:phase2:initiative",
        notes: "reactive attack: phase 2 initiative pending phase 1 incoming result",
        sourcePhase: "phase2",
        value: 6,
      }),
    ]);
  });

  it("keeps a committed declaration distance row when the browser display projection lacks phase weapon names", () => {
    const declarationCombatContext = buildCommittedContext();
    const staleScenarioParticipantCombatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: declarationCombatContext.modifierBuckets.situationDb,
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: declarationCombatContext,
      phaseContexts,
    });
    const modifierRows = buildPlayerCombatModifierRows({
      combatContext: projectedContext,
      phaseKey: "phase1",
    });
    const skillObRow = modifierRows.find((row) => row.bucketKey === "situation_ob_skill");
    const browserVisibleTrace = {
      currentRoundNumber: 1,
      declarationExists: true,
      declarationSituationObSkill: declarationCombatContext.modifierBuckets.situationObSkill,
      finalCombatContext: projectedContext,
      finalRenderedModifierRows: modifierRows,
      finalRenderedSkillObSummary: skillObRow?.total,
      finalSkillObRows: skillObRow?.entries ?? [],
      scenarioParticipantSituationObSkill:
        staleScenarioParticipantCombatContext.modifierBuckets.situationObSkill,
      selectedParticipantId: "scyrian",
      selectedScenarioParticipantId: "scenario-scyrian",
      selectedStep: "review_action_modifiers",
    };

    expect(projectedContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        provisional: true,
        sourceActionId: "attack_parry",
        sourcePhase: "phase1",
        sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
        value: -4,
      }),
    ]);
    expect(projectedContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("Broad sword preferred 2"),
        sourcePhase: "phase1",
        value: -2,
      }),
    ]);
    expect(browserVisibleTrace).toMatchObject({
      declarationExists: true,
      finalRenderedSkillObSummary: -2,
      finalSkillObRows: [
        expect.objectContaining({
          id: "generated:distance:phase1:ob-skill",
          value: -2,
        }),
      ],
      scenarioParticipantSituationObSkill: [],
      selectedParticipantId: "scyrian",
      selectedScenarioParticipantId: "scenario-scyrian",
    });
  });

  it("removes a committed distance row when the action no longer has an attack phase", () => {
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "full_defense",
      combatContext: buildCommittedContext(),
      phaseContexts,
    });

    expect(projectedContext.modifierBuckets.situationObSkill).toEqual([]);
  });

  it.each([
    ["feint_attack", "phase2"],
    ["adjust_range_attack", "phase2"],
  ] as const)("projects %s attack risk as provisional opportunity state", (actionId, phase) => {
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      phaseContexts: {
        phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target" },
        phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target" },
      },
    });

    expect(projectedContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        application: "percentage",
        provisional: true,
        sourceActionId: actionId,
        sourcePhase: phase,
        value: -4,
      }),
    ]);
  });

  it("reuses committed opportunity facts without a provisional marker", () => {
    const encounter = buildEncounter();
    const baseRoundState = initializeCombatRoundState({ encounter });
    const roundState = combatRoundStateSchema.parse({
      ...baseRoundState,
      participants: baseRoundState.participants.map((participant) =>
        participant.participantId === "scyrian"
          ? {
              ...participant,
              declaration: {
                actionId: "attack_parry",
                attackOpportunities: [
                  {
                    actionId: "attack_parry",
                    id: "round:1:participant:scyrian:phase1:attack_1",
                    origin: "declared",
                    phase: "phase1",
                    slot: "attack_1",
                    status: "committed",
                    targetParticipantId: "gladiator",
                  },
                ],
                roundNumber: baseRoundState.roundNumber,
                submittedBy: "gm",
              },
            }
          : participant,
      ),
    });
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      encounterParticipant: encounter.participants[0],
      phaseContexts,
      roundState,
    });

    expect(projectedContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        provisional: false,
        sourceOpportunityId: "round:1:participant:scyrian:phase1:attack_1",
        value: -4,
      }),
    ]);
  });

  /**
   * #901 option B on the client pass (#915 QA finding, verdict comment 20428).
   *
   * This projection is the fifth caller of `applyCombatActionGeneratedModifiers` and the only one
   * the client runs. It is the GM panel's modifier set and the player page's, and the panel submits
   * it verbatim as the modifier-review body whenever there are no local edits — so an ungated pass
   * here does not merely display the engine's figure, it writes it back over the GM's accepted one
   * on the panel's own next review commit. Driven through the production routes the loss was
   * `[phase1 -1, phase2 -4]` becoming `[phase1 -4, phase2 -4]` with a 200 and no refusal.
   *
   * The two projections below are identical but for the committed review command, which is the
   * gate's whole input, so the pair discriminates: remove the gate from the projection and the
   * first expectation reads -4.
   */
  describe("the modifier-review generation gate on the client pass", () => {
    const REVIEWED_PHASE_1_COMMAND = {
      afterCursor: { roundNumber: 1, step: "M1" },
      beforeCursor: { roundNumber: 1, step: "M1" },
      createdAt: "2026-01-01T00:05:00.000Z",
      facts: {},
      id: "command:review-phase-1",
      participantId: "scyrian",
      roundNumber: 1,
      type: "review_modifiers_phase1",
    } as const;

    function buildDoubleAttackRoundState(input: { reviewedPhase1: boolean }) {
      const encounter = buildEncounter();
      const baseRoundState = initializeCombatRoundState({ encounter });

      return combatRoundStateSchema.parse({
        ...baseRoundState,
        commands: input.reviewedPhase1 ? [REVIEWED_PHASE_1_COMMAND] : [],
        participants: baseRoundState.participants.map((participant) =>
          participant.participantId === "scyrian"
            ? {
                ...participant,
                declaration: {
                  actionId: "double_attack",
                  attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
                    actionId: "double_attack",
                    participantId: "scyrian",
                    phaseContexts: {
                      phase1: {
                        modifierBuckets: emptyModifierBuckets(),
                        targetParticipantId: "gladiator",
                      },
                      phase2: {
                        modifierBuckets: emptyModifierBuckets(),
                        targetParticipantId: "gladiator",
                      },
                    },
                    roundNumber: baseRoundState.roundNumber,
                  }),
                  roundNumber: baseRoundState.roundNumber,
                  submittedBy: "gm",
                },
              }
            : participant,
        ),
      });
    }

    function penaltyFiguresByPhase(combatContext: ScenarioParticipantCombatContext) {
      return Object.fromEntries(
        combatContext.modifierBuckets.situationDb
          .filter((entry) => isAttackPhaseDefensivePenaltyModifier(entry))
          .map((entry) => [entry.sourcePhase, entry.value]),
      );
    }

    /** The context the server holds after the GM commits -1 on the phase-1 row. */
    function storedContextAfterPhase1Review() {
      const declared = projectCombatActionGeneratedModifiers({
        actionId: "double_attack",
        combatContext: scenarioParticipantCombatContextSchema.parse({}),
        encounterParticipant: buildEncounter().participants[0],
        roundState: buildDoubleAttackRoundState({ reviewedPhase1: false }),
      });
      // -1 is a figure the generator cannot produce: the penalty is bounded -4..0 and both rule
      // reductions give -2. So a -1 that survives can only be the GM's.
      expect(penaltyFiguresByPhase(declared)).toEqual({ phase1: -4, phase2: -4 });

      return scenarioParticipantCombatContextSchema.parse({
        ...declared,
        modifierBuckets: {
          ...declared.modifierBuckets,
          situationDb: declared.modifierBuckets.situationDb.map((entry) =>
            isAttackPhaseDefensivePenaltyModifier(entry) && entry.sourcePhase === "phase1"
              ? { ...entry, value: -1 }
              : entry,
          ),
        },
      });
    }

    it("keeps the GM's committed phase-1 figure and still rebuilds the unreviewed phase", () => {
      const projected = projectCombatActionGeneratedModifiers({
        actionId: "double_attack",
        combatContext: storedContextAfterPhase1Review(),
        encounterParticipant: buildEncounter().participants[0],
        roundState: buildDoubleAttackRoundState({ reviewedPhase1: true }),
      });

      expect(penaltyFiguresByPhase(projected)).toEqual({ phase1: -1, phase2: -4 });
    });

    it("rebuilds the same row when no review is committed for the phase", () => {
      const projected = projectCombatActionGeneratedModifiers({
        actionId: "double_attack",
        combatContext: storedContextAfterPhase1Review(),
        encounterParticipant: buildEncounter().participants[0],
        roundState: buildDoubleAttackRoundState({ reviewedPhase1: false }),
      });

      expect(penaltyFiguresByPhase(projected)).toEqual({ phase1: -4, phase2: -4 });
    });

    it("does not re-create a row the GM removed in the reviewed phase", () => {
      const stored = storedContextAfterPhase1Review();
      const afterRemoval = scenarioParticipantCombatContextSchema.parse({
        ...stored,
        modifierBuckets: {
          ...stored.modifierBuckets,
          situationDb: stored.modifierBuckets.situationDb.filter(
            (entry) =>
              !(isAttackPhaseDefensivePenaltyModifier(entry) && entry.sourcePhase === "phase1"),
          ),
        },
      });

      const projected = projectCombatActionGeneratedModifiers({
        actionId: "double_attack",
        combatContext: afterRemoval,
        encounterParticipant: buildEncounter().participants[0],
        roundState: buildDoubleAttackRoundState({ reviewedPhase1: true }),
      });

      expect(penaltyFiguresByPhase(projected)).toEqual({ phase2: -4 });
    });

    it("reads only this participant's review, so another combatant's row still rebuilds", () => {
      const projected = projectCombatActionGeneratedModifiers({
        actionId: "double_attack",
        combatContext: storedContextAfterPhase1Review(),
        encounterParticipant: buildEncounter().participants[0],
        roundState: combatRoundStateSchema.parse({
          ...buildDoubleAttackRoundState({ reviewedPhase1: false }),
          commands: [{ ...REVIEWED_PHASE_1_COMMAND, participantId: "gladiator" }],
        }),
      });

      expect(penaltyFiguresByPhase(projected)).toEqual({ phase1: -4, phase2: -4 });
    });
  });
});
