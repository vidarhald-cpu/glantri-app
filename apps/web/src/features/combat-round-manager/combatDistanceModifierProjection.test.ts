import { describe, expect, it } from "vitest";

import {
  buildCombatRoundAttackRollResult,
  combatRoundStateSchema,
  encounterSessionSchema,
  initializeCombatRoundState,
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
});
