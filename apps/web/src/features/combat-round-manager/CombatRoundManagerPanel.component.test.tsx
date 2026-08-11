import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCombatRoundCommandEnvelope,
  buildCombatRoundDeclaredAttackOpportunities,
  buildCombatProgressionProjection,
  advanceCombatRoundStep,
  combatRoundStateSchema,
  completeRemainingCombatRoundStep,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseInitiativeResolution,
  encounterSessionSchema,
  initializeCombatRoundState,
  prepareCombatRoundEndReview,
  recordCombatRoundFeintRoll,
  recordCombatRoundDeclaration,
  recordCombatObservationRoll,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundParticipantInitiative,
  type CombatProgressionTask,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  advanceDeterministic: vi.fn(),
  advanceCurrentStep: vi.fn(),
  clearCurrentStep: vi.fn(),
  commitParticipantReview: vi.fn(),
  runStepWorkflow: vi.fn(),
  loadEncounter: vi.fn(),
  loadParticipants: vi.fn(),
  rollAttack: vi.fn(),
  rollFeint: vi.fn(),
  rollObservation: vi.fn(),
  setCombatExperienceDifficulty: vi.fn(),
  submitDeclaration: vi.fn(),
}));

vi.mock("@/lib/api/encounterClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/encounterClient")>();
  return {
    ...actual,
    advanceDeterministicCombatOnServer: mocks.advanceDeterministic,
    advanceCombatRoundCurrentStepOnServer: mocks.advanceCurrentStep,
    clearCurrentCombatRoundStepOnServer: mocks.clearCurrentStep,
    runGmCombatStepWorkflowOnServer: mocks.runStepWorkflow,
    commitRoundEndParticipantReviewOnServer: mocks.commitParticipantReview,
    loadEncounterById: mocks.loadEncounter,
    rollCombatAttackOnServer: mocks.rollAttack,
    rollCombatFeintOnServer: mocks.rollFeint,
    rollCombatObservationOnServer: mocks.rollObservation,
    setCombatExperienceDifficultyOnServer: mocks.setCombatExperienceDifficulty,
    submitCombatDeclarationOnServer: mocks.submitDeclaration,
  };
});

vi.mock("@/lib/api/scenarioClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/scenarioClient")>();
  return {
    ...actual,
    loadScenarioParticipants: mocks.loadParticipants,
  };
});

vi.mock("@/features/player-combat/playerCombatPhaseModel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/player-combat/playerCombatPhaseModel")>();
  const reference = (input: {
    attackModeId: string;
    itemId: string;
    slot: "primary" | "secondary";
  }) => ({
    am: "C",
    am2: "C",
    attackMode: input.attackModeId === "mode-1" ? "Slash" : "Thrust",
    attackMode2: "Thrust",
    combinedDb: "13",
    combinedDm: "0",
    combinedParry: "9",
    combinedSourceName: "Long sword",
    crit: input.attackModeId === "mode-1" ? "FS" : "EP",
    crit2: "EP",
    damageClass: input.attackModeId === "mode-1" ? "edged" : "pointed",
    damageClass2: "pointed",
    db: "13",
    dmb: input.attackModeId === "mode-1" ? "5" : "3",
    dmb2: "3",
    dm: "0",
    initiative: "0",
    ob: input.attackModeId === "mode-1" ? "2" : "1",
    ob2: "1",
    parry: "9",
    secondCrit: "—",
    selectedWeapon: "Long sword",
    sourceAttackModeId: input.attackModeId,
    sourceItemId: input.itemId,
    sourceSlot: input.slot,
    sourceTemplateId: "weapon-template-longsword",
  });

  return {
    ...actual,
    buildPlayerCombatLoadoutSummary: vi.fn(
      (input: Parameters<typeof actual.buildPlayerCombatLoadoutSummary>[0]) => {
        const phase2 = input.actionId === "double_attack" && input.phaseKey === "phase2";
        const selectedAttackModeId = input.selectedAttackModeId ?? (phase2 ? "mode-2" : "mode-1");
        const selectedReference = reference({
          attackModeId: selectedAttackModeId,
          itemId: phase2 ? "long-sword-secondary" : "long-sword-primary",
          slot: phase2 ? "secondary" : "primary",
        });

        return {
          attackModeOptions: [
            {
              allowsRepeatedRoundAttack: false,
              id: "mode-1",
              label: "Slash",
            },
            {
              allowsRepeatedRoundAttack: false,
              id: "mode-2",
              label: "Thrust",
            },
          ],
          attackStats: {
            attackMode: selectedReference.am,
            dmb: selectedReference.dmb,
            initiative: selectedReference.initiative,
            maxCrits: selectedReference.crit,
            ob: selectedReference.ob,
            weaponName: selectedReference.selectedWeapon,
          },
          mainHandParryItemLabel: "Long sword",
          offHandParryItemLabel: "Unarmed",
          passiveInitiative: 0,
          reference: selectedReference,
          selectedAttackModeId,
          selectedAttackModeUsedFallback: input.selectedAttackModeId == null,
        };
      },
    ),
  };
});

import CombatRoundManagerPanel from "./CombatRoundManagerPanel";
import { buildActiveCombatPresentation } from "./view-models/combatPresentationModel";
import {
  beginCombatPerformanceInteraction,
  resetCombatPerformanceForTests,
} from "@/lib/performance/combatPerformance";

mocks.advanceDeterministic.mockImplementation(
  async (input: { currentEncounter: EncounterSession }) => ({
    encounter: input.currentEncounter,
    executedTaskIds: [],
    participants: [],
    stopReason: "blocked_or_human_work" as const,
  }),
);

function encounterParticipant(input: { id: string; label: string; scenarioParticipantId: string }) {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: input.scenarioParticipantId,
  };
}

function buildEncounter(): EncounterSession {
  const encounter = encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-07-23T10:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-double-attack-form",
    kind: "combat",
    participants: [
      encounterParticipant({
        id: "encounter-attacker",
        label: "The Gladiator",
        scenarioParticipantId: "scenario-attacker",
      }),
      encounterParticipant({
        id: "encounter-defender",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "scenario-defender",
      }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Rendered Double Attack",
    turnOrderMode: "manual",
    updatedAt: "2026-07-23T10:00:00.000Z",
  });
  const combatExperienceOpen = setCombatRoundCombatExperienceDifficulty({
    difficulty: 26,
    state: initializeCombatRoundState({ encounter }),
  });
  const attackerResolved = rollCombatRoundCombatExperience({
    command: {
      createdAt: "2026-07-23T10:00:00.100Z",
      createdByUserId: "gm-1",
    },
    participantId: "encounter-attacker",
    rng: () => 0.6,
    skillTotal: 26,
    state: combatExperienceOpen,
  }).state;
  const declarationReady = rollCombatRoundCombatExperience({
    command: {
      createdAt: "2026-07-23T10:00:00.200Z",
      createdByUserId: "gm-1",
    },
    participantId: "encounter-defender",
    rng: () => 0.6,
    skillTotal: 26,
    state: attackerResolved,
  }).state;

  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: declarationReady,
  });
}

function buildCombatExperiencePendingEncounter(): EncounterSession {
  const resolved = buildEncounter();
  const withoutCombatState = encounterSessionSchema.parse({
    ...resolved,
    combatRoundState: undefined,
  });

  return encounterSessionSchema.parse({
    ...withoutCombatState,
    combatRoundState: initializeCombatRoundState({ encounter: withoutCombatState }),
  });
}

function buildCombatExperienceOpenEncounter(): EncounterSession {
  const encounter = buildCombatExperiencePendingEncounter();
  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: combatRoundStateSchema.parse(encounter.combatRoundState),
    }),
    updatedAt: "2026-07-23T10:00:01.000Z",
  });
}

function buildModifierReviewEncounter(): EncounterSession {
  const encounter = buildEncounter();
  const base = combatRoundStateSchema.parse(encounter.combatRoundState);
  const withDeclarations = ["encounter-attacker", "encounter-defender"].reduce(
    (current, participantId, index) =>
      recordCombatRoundDeclaration({
        command: {
          createdAt: `2026-07-23T10:01:0${index}.000Z`,
          createdByUserId: "gm-1",
        },
        declaration: {
          actionId: "parry",
          combatContext: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
          id: `declaration:${participantId}`,
          roundNumber: base.roundNumber,
          submittedAt: `2026-07-23T10:01:0${index}.000Z`,
        },
        participantId,
        state: current,
        submittedBy: "gm",
      }),
    base,
  );
  let review = withDeclarations;
  for (let guard = 0; guard < 20 && review.currentStep !== "review_action_modifiers"; guard += 1) {
    review = advanceCombatRoundStep(review);
  }

  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: review,
    updatedAt: "2026-07-23T10:01:10.000Z",
  });
}

function buildInitiativeEncounter(): EncounterSession {
  const encounter = buildModifierReviewEncounter();
  const reviewed = completeRemainingCombatRoundStep({
    command: { createdAt: "2026-07-23T10:01:15.000Z", createdByUserId: "gm-1" },
    phase: "phase1",
    state: combatRoundStateSchema.parse(encounter.combatRoundState),
  });
  let initiative = reviewed.state;
  for (let guard = 0; guard < 20 && initiative.currentStep !== "initiative_phase_1"; guard += 1) {
    initiative = advanceCombatRoundStep(initiative);
  }

  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: initiative,
    updatedAt: "2026-07-23T10:01:20.000Z",
  });
}

function buildAttackReadyEncounter(): EncounterSession {
  const encounter = buildEncounter();
  const base = combatRoundStateSchema.parse(encounter.combatRoundState);
  const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
    actionId: "attack_parry",
    participantId: "encounter-attacker",
    phaseContexts: {
      phase1: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetParticipantId: "encounter-defender",
      },
    },
    roundNumber: base.roundNumber,
    sources: {
      phase1: {
        attackModeId: "mode-1",
        sourceKind: "weapon",
        weaponInstanceId: "long-sword-primary",
        weaponSourceId: "item:long-sword-primary",
        weaponSourceSlot: "primary",
        weaponTemplateId: "weapon-template-longsword",
      },
    },
  });
  const attackerDeclared = recordCombatRoundDeclaration({
    command: {
      createdAt: "2026-07-23T10:01:00.000Z",
      createdByUserId: "gm-1",
    },
    declaration: {
      actionId: "attack_parry",
      attackOpportunities,
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      id: "declaration:attacker",
      phaseContexts: {
        phase1: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "encounter-defender",
        },
      },
      roundNumber: 1,
      submittedAt: "2026-07-23T10:01:00.000Z",
    },
    participantId: "encounter-attacker",
    state: base,
    submittedBy: "gm",
  });
  const bothDeclared = recordCombatRoundDeclaration({
    command: {
      createdAt: "2026-07-23T10:01:10.000Z",
      createdByUserId: "gm-1",
    },
    declaration: {
      actionId: "offensive_parry",
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        selectedOpponentId: "encounter-attacker",
      },
      id: "declaration:defender",
      roundNumber: 1,
      submittedAt: "2026-07-23T10:01:10.000Z",
    },
    participantId: "encounter-defender",
    state: attackerDeclared,
    submittedBy: "gm",
  });
  let atInitiative = bothDeclared;
  for (let guard = 0; guard < 20 && atInitiative.currentStep !== "initiative_phase_1"; guard += 1) {
    atInitiative = advanceCombatRoundStep(atInitiative);
  }
  const withInitiative = ["encounter-attacker", "encounter-defender"].reduce(
    (current, participantId, index) =>
      setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [index === 0 ? 6 : 4],
          rollTotal: index === 0 ? 6 : 4,
          total: index === 0 ? 6 : 4,
        },
        participantId,
        phase: "phase1",
        state: current,
      }),
    atInitiative,
  );
  const state = commitCombatRoundPhaseInitiativeResolution({
    command: {
      createdAt: "2026-07-23T10:02:00.000Z",
      createdByUserId: "gm-1",
    },
    phase: "phase1",
    state: withInitiative,
    visibility: {
      "encounter-attacker": { "encounter-defender": true },
      "encounter-defender": { "encounter-attacker": true },
    },
  });
  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: state.state,
  });
}

function buildFeintRollEncounter(): {
  afterAttackerRoll: EncounterSession;
  beforeAttackerRoll: EncounterSession;
} {
  const encounter = buildAttackReadyEncounter();
  const base = combatRoundStateSchema.parse(encounter.combatRoundState);
  const beforeState = combatRoundStateSchema.parse({
    ...base,
    currentCursor: { participantId: "encounter-attacker", roundNumber: 1, step: "A1" },
    currentStep: "phase_1_actions",
    feintProposals: [
      {
        attackerParticipantId: "encounter-attacker",
        attackerSkillId: "dodge",
        attackerSkillLabel: "Dodge",
        defenderParticipantId: "encounter-defender",
        defenderSkillId: "sword",
        defenderSkillLabel: "Sword",
        feasibility: "possible",
        id: "feint-proposal",
        method: "movement",
        pairId: "encounter-attacker::encounter-defender",
        phase1OpportunityId: "feint-opportunity",
        phase2AttackOpportunityId: "feint-attack",
        roundNumber: 1,
        status: "awaiting_rolls",
      },
    ],
    participants: base.participants.map((participant) =>
      participant.participantId === "encounter-attacker"
        ? {
            ...participant,
            declaration: {
              actionId: "feint_attack",
              attackOpportunities: [
                {
                  id: "feint-attack",
                  origin: "feint_attack",
                  phase: "phase2",
                  slot: "attack_2",
                  status: "committed",
                  targetParticipantId: "encounter-defender",
                },
              ],
              feint: {
                attackerSkillId: "dodge",
                attackerSkillLabel: "Dodge",
                defenderSkillId: "sword",
                defenderSkillLabel: "Sword",
                method: "movement",
                targetParticipantId: "encounter-defender",
              },
              phaseContexts: {
                phase1: { targetParticipantId: "encounter-defender" },
                phase2: { targetParticipantId: "encounter-defender" },
              },
              id: "declaration:feint-attacker",
              roundNumber: 1,
              submittedAt: "2026-07-23T10:01:00.000Z",
              submittedBy: "gm",
            },
          }
        : {
            ...participant,
            declaration: {
              actionId: "parry",
              id: "declaration:feint-defender",
              roundNumber: 1,
              submittedAt: "2026-07-23T10:01:01.000Z",
              submittedBy: "gm",
            },
          },
    ),
    phaseResolutionCursor: {
      participantId: "encounter-attacker",
      phase: "phase1",
      substep: "feint",
    },
    selectedParticipantId: "encounter-attacker",
    selectedStep: "phase_1_actions",
  });
  const afterState = recordCombatRoundFeintRoll({
    command: { createdAt: "2026-07-23T10:02:10.000Z", createdByUserId: "gm-1" },
    proposalId: "feint-proposal",
    result: {
      adjustment: 0,
      characteristic: "dex",
      characteristicValue: 12,
      finalTotal: 29,
      id: "feint-attacker-roll",
      openEndedD10s: [],
      participantId: "encounter-attacker",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-07-23T10:02:10.000Z",
      skillContestCalculation: {
        baseSkill: 19,
        calculationId: "feint-attacker-roll",
        completeness: "partial",
        contestType: "movement_feint",
        derivedIntegerAdjustment: 0,
        finalResult: 29,
        governingStat: { id: "dex", label: "Dexterity", value: 12 },
        missingContributionPoints: ["withdrawal_backout"],
        openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
        opponentParticipantId: "encounter-defender",
        participantId: "encounter-attacker",
        percentageContributions: [],
        preDieTotal: 19,
        role: "movement_feint_initiator",
        skill: { id: "dodge", label: "Dodge", totalXp: 7 },
        totalPercentageAdjustment: 0,
        visibility: "roller_and_gm",
      },
      skillId: "dodge",
      skillLabel: "Dodge",
      skillXp: 7,
    },
    state: beforeState,
  });

  return {
    afterAttackerRoll: encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: afterState,
      updatedAt: "2026-07-23T10:02:10.000Z",
    }),
    beforeAttackerRoll: encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: beforeState,
      updatedAt: "2026-07-23T10:02:00.000Z",
    }),
  };
}

function buildSecondDeclarationReadyEncounter(): {
  accepted: EncounterSession;
  before: EncounterSession;
} {
  const encounter = buildEncounter();
  const base = combatRoundStateSchema.parse(encounter.combatRoundState);
  const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
    actionId: "attack_parry",
    participantId: "encounter-attacker",
    phaseContexts: {
      phase1: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetParticipantId: "encounter-defender",
      },
    },
    roundNumber: base.roundNumber,
    sources: {
      phase1: {
        attackModeId: "mode-1",
        sourceKind: "weapon",
        weaponInstanceId: "long-sword-primary",
        weaponSourceId: "item:long-sword-primary",
        weaponSourceSlot: "primary",
        weaponTemplateId: "weapon-template-longsword",
      },
    },
  });
  const attackerDeclared = recordCombatRoundDeclaration({
    command: { createdAt: "2026-07-23T10:01:00.000Z", createdByUserId: "gm-1" },
    declaration: {
      actionId: "attack_parry",
      attackOpportunities,
      phaseContexts: {
        phase1: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "encounter-defender",
        },
      },
      roundNumber: base.roundNumber,
    },
    participantId: "encounter-attacker",
    state: base,
    submittedBy: "gm",
  });
  const defenderAttackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
    actionId: "attack_parry",
    participantId: "encounter-defender",
    phaseContexts: {
      phase1: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetParticipantId: "encounter-attacker",
      },
    },
    roundNumber: base.roundNumber,
    sources: {
      phase1: {
        attackModeId: "mode-1",
        sourceKind: "weapon",
        weaponInstanceId: "long-sword-primary",
        weaponSourceId: "item:long-sword-primary",
        weaponSourceSlot: "primary",
        weaponTemplateId: "weapon-template-longsword",
      },
    },
  });
  const defenderDeclared = recordCombatRoundDeclaration({
    command: { createdAt: "2026-07-23T10:01:01.000Z", createdByUserId: "gm-1" },
    declaration: {
      actionId: "attack_parry",
      attackOpportunities: defenderAttackOpportunities,
      phaseContexts: {
        phase1: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: "encounter-attacker",
        },
      },
      roundNumber: base.roundNumber,
    },
    participantId: "encounter-defender",
    state: attackerDeclared,
    submittedBy: "gm",
  });

  return {
    accepted: encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: defenderDeclared,
      updatedAt: "2026-07-23T10:01:01.000Z",
    }),
    before: encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: attackerDeclared,
      updatedAt: "2026-07-23T10:01:00.000Z",
    }),
  };
}

function buildRemotePlayerDeclarationEncounters(): {
  before: EncounterSession;
  firstAccepted: EncounterSession;
  bothAcceptedAtM1: EncounterSession;
} {
  const before = buildEncounter();
  const base = combatRoundStateSchema.parse(before.combatRoundState);
  const first = recordCombatRoundDeclaration({
    command: { createdAt: "2026-07-23T10:01:00.000Z", createdByUserId: "player-attacker" },
    declaration: {
      actionId: "parry",
      id: "declaration:remote-attacker",
      roundNumber: base.roundNumber,
      submittedAt: "2026-07-23T10:01:00.000Z",
    },
    participantId: "encounter-attacker",
    state: base,
    submittedBy: "player",
  });
  const both = recordCombatRoundDeclaration({
    command: { createdAt: "2026-07-23T10:01:05.000Z", createdByUserId: "player-defender" },
    declaration: {
      actionId: "parry",
      id: "declaration:remote-defender",
      roundNumber: base.roundNumber,
      submittedAt: "2026-07-23T10:01:05.000Z",
    },
    participantId: "encounter-defender",
    state: first,
    submittedBy: "player",
  });
  let atM1 = both;
  for (let guard = 0; guard < 20 && atM1.currentStep !== "review_action_modifiers"; guard += 1) {
    atM1 = advanceCombatRoundStep(atM1);
  }

  return {
    before,
    firstAccepted: encounterSessionSchema.parse({
      ...before,
      combatRoundState: first,
      updatedAt: "2026-07-23T10:01:00.000Z",
    }),
    bothAcceptedAtM1: encounterSessionSchema.parse({
      ...before,
      combatRoundState: atM1,
      updatedAt: "2026-07-23T10:01:06.000Z",
    }),
  };
}

function buildFinalParticipantReviewEncounter(): {
  beforeFinalReview: EncounterSession;
  afterFinalReview: EncounterSession;
} {
  const encounter = buildEncounter();
  const base = combatRoundStateSchema.parse(encounter.combatRoundState);
  const atRoundEnd = combatRoundStateSchema.parse({
    ...base,
    currentCursor: {
      participantId: "encounter-attacker",
      roundNumber: base.roundNumber,
      step: "SU",
    },
    currentStep: "round_summary",
    selectedParticipantId: "encounter-attacker",
    selectedStep: "round_summary",
  });
  const prepared = prepareCombatRoundEndReview({
    command: { createdAt: "2026-07-23T10:03:00.000Z", createdByUserId: "gm-1" },
    state: atRoundEnd,
  });
  const firstCommitted = commitCombatRoundEndParticipantReview({
    command: { createdAt: "2026-07-23T10:03:10.000Z", createdByUserId: "gm-1" },
    participantId: "encounter-attacker",
    scenarioParticipantId: "scenario-attacker",
    state: prepared,
  });
  const finalCommitted = commitCombatRoundEndParticipantReview({
    command: { createdAt: "2026-07-23T10:03:20.000Z", createdByUserId: "gm-1" },
    participantId: "encounter-defender",
    scenarioParticipantId: "scenario-defender",
    state: firstCommitted.state,
  });

  return {
    afterFinalReview: encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: finalCommitted.state,
      updatedAt: "2026-07-23T10:03:20.000Z",
    }),
    beforeFinalReview: encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: firstCommitted.state,
      updatedAt: "2026-07-23T10:03:10.000Z",
    }),
  };
}

function buildFinalObservationEncounter(): {
  afterObservation: EncounterSession;
  beforeObservation: EncounterSession;
  boundaryTask: CombatProgressionTask;
  observationTask: CombatProgressionTask;
} {
  const { afterFinalReview } = buildFinalParticipantReviewEncounter();
  const finalReviewState = combatRoundStateSchema.parse(afterFinalReview.combatRoundState);
  const beforeState = combatRoundStateSchema.parse({
    ...finalReviewState,
    currentCursor: {
      participantId: "encounter-attacker",
      roundNumber: finalReviewState.roundNumber,
      step: "SU",
    },
    observationRelationships: [
      {
        bestBonus: 3,
        completedAttempts: 1,
        id: "observation:encounter-attacker:encounter-defender",
        observerParticipantId: "encounter-attacker",
        roundsTowardNextAttempt: 5,
        targetParticipantId: "encounter-defender",
      },
    ],
    participants: finalReviewState.participants.map((participant) =>
      participant.participantId === "encounter-attacker"
        ? {
            ...participant,
            declaration: {
              actionId: "parry",
              roundNumber: finalReviewState.roundNumber,
              secondaryActions: [
                {
                  action: "observe_opponent",
                  targetParticipantId: "encounter-defender",
                },
              ],
              secondaryActionContext: {
                action: "observe_opponent",
                targetParticipantId: "encounter-defender",
              },
              secondaryActionId: "observe_opponent",
              submittedBy: "gm",
            },
          }
        : participant,
    ),
    selectedParticipantId: "encounter-attacker",
    selectedStep: "round_summary",
  });
  const observationTask = buildCombatProgressionProjection(beforeState)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .find((task) => task.kind === "observation_roll");
  if (!observationTask) throw new Error("Expected an observation task.");
  const rolled = recordCombatObservationRoll({
    command: {
      createdAt: "2026-07-23T10:03:30.000Z",
      createdByUserId: "gm-1",
    },
    completedAtRevision: "2026-07-23T10:03:30.000Z",
    executionGroupId: observationTask.executionGroupId,
    observerBasis: { baseValue: 20, skillId: "dodge", skillLabel: "Dodge" },
    observerParticipantId: "encounter-attacker",
    observationAttemptId: observationTask.identity.observationAttemptId!,
    relationshipId: observationTask.identity.relationshipId!,
    rng: () => 0.5,
    state: beforeState,
    targetBasis: { baseValue: 10, skillId: "sword", skillLabel: "Sword" },
    targetParticipantId: "encounter-defender",
  });
  const boundaryTask = buildCombatProgressionProjection(rolled.state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .find((task) => task.kind === "gm_advance_boundary");
  if (!boundaryTask) throw new Error("Expected a round-boundary task.");

  return {
    afterObservation: encounterSessionSchema.parse({
      ...afterFinalReview,
      combatRoundState: rolled.state,
      updatedAt: "2026-07-23T10:03:30.000Z",
    }),
    beforeObservation: encounterSessionSchema.parse({
      ...afterFinalReview,
      combatRoundState: beforeState,
      updatedAt: "2026-07-23T10:03:20.000Z",
    }),
    boundaryTask,
    observationTask,
  };
}

function scenarioParticipant(input: {
  gmControlled?: boolean;
  id: string;
  name: string;
  order: number;
}): ScenarioParticipant {
  return {
    controlledByUserId: input.gmControlled ? undefined : `user-${input.id}`,
    createdAt: "2026-07-23T10:00:00.000Z",
    displayOrder: input.order,
    factionId: null,
    id: input.id,
    isActive: true,
    joinSource: "scenario_setup",
    role: input.gmControlled ? "npc" : "player_character",
    roleTag: null,
    scenarioId: "scenario-1",
    snapshot: {
      displayName: input.name,
      equipmentState: {
        activeLoadoutByCharacterId: {
          [input.id]: { activeAmmoItemIds: [] },
        },
        itemsById: {},
        locationsById: {},
        templatesById: {},
      },
      sourceUpdatedAt: "2026-07-23T10:00:00.000Z",
    },
    sourceType: "character",
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
      combatEffects: { effects: [], events: [] },
      equipment: {
        carriedItemIds: [],
        equippedItemIds: [],
        readyItemIds: [],
      },
      health: { currentHp: 10, maxHp: 10 },
      status: "active",
    },
    tacticalGroupId: null,
    updatedAt: "2026-07-23T10:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CombatRoundManagerPanel Combat Experience difficulty", () => {
  it("uses a non-submit action, sends one request, and disables it while saving", async () => {
    const encounter = buildCombatExperiencePendingEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const onEncounterUpdated = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const savedState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: combatRoundStateSchema.parse(encounter.combatRoundState),
    });
    let resolveRequest:
      | ((value: { difficulty: number; encounter: EncounterSession }) => void)
      | undefined;
    mocks.setCombatExperienceDifficulty.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(
      <form onSubmit={onSubmit}>
        <CombatRoundManagerPanel
          encounter={encounter}
          onEncounterUpdated={onEncounterUpdated}
          scenarioParticipants={participants}
        />
      </form>,
    );

    const action = await screen.findByRole("button", {
      name: "Open Combat Experience",
    });
    expect((action as HTMLButtonElement).type).toBe("button");
    fireEvent.click(action);
    fireEvent.click(action);

    expect(mocks.setCombatExperienceDifficulty).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect((action as HTMLButtonElement).disabled).toBe(true));

    resolveRequest?.({
      difficulty: 26,
      encounter: encounterSessionSchema.parse({
        ...encounter,
        combatRoundState: savedState,
        updatedAt: "2026-07-23T10:00:01.000Z",
      }),
    });
    await waitFor(() => expect(onEncounterUpdated).toHaveBeenCalledTimes(1));
    expect(mocks.setCombatExperienceDifficulty).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit or invoke the CE command when Enter is pressed in the difficulty input", async () => {
    const encounter = buildCombatExperiencePendingEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />
      </form>,
    );

    const difficulty = await screen.findByRole("spinbutton", { name: "CE difficulty" });
    fireEvent.keyDown(difficulty, { code: "Enter", key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.setCombatExperienceDifficulty).not.toHaveBeenCalled();
  });

  it("keeps the encounter rendered and shows a transaction conflict in the action error area", async () => {
    const encounter = buildCombatExperiencePendingEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.setCombatExperienceDifficulty.mockRejectedValue(
      new (await import("@/lib/api/apiClient")).ApiRequestError(
        "Combat state changed while saving. Refresh and try again.",
        409,
        { code: "transaction_conflict" },
      ),
    );

    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Combat Experience" }));

    expect(
      await screen.findByText("Combat state changed while saving. Refresh and try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Combat Round Manager" })).toBeInTheDocument();
    expect(screen.queryByText("Load failed")).not.toBeInTheDocument();
  });

  it("keeps the encounter rendered and normalizes a CE fetch failure in the action error area", async () => {
    const encounter = buildCombatExperiencePendingEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.setCombatExperienceDifficulty.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Combat Experience" }));

    expect(
      await screen.findByText("Could not reach the combat service. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Combat Round Manager" })).toBeInTheDocument();
    expect(screen.queryByText("Load failed")).not.toBeInTheDocument();
  });
});

describe("CombatRoundManagerPanel GM workflow selector", () => {
  it("offers one bounded GM Combat Experience workflow only after difficulty is fixed", async () => {
    const pendingEncounter = buildCombatExperiencePendingEncounter();
    const encounter = buildCombatExperienceOpenEncounter();
    const participants = [
      scenarioParticipant({
        gmControlled: true,
        id: "scenario-attacker",
        name: "The Gladiator",
        order: 0,
      }),
      scenarioParticipant({
        gmControlled: true,
        id: "scenario-defender",
        name: "Scyrian cavalry guy",
        order: 1,
      }),
    ];

    const pending = render(
      <CombatRoundManagerPanel encounter={pendingEncounter} scenarioParticipants={participants} />,
    );
    expect(screen.queryByRole("combobox", { name: "Workflow" })).not.toBeInTheDocument();
    pending.unmount();

    const initialState = combatRoundStateSchema.parse(encounter.combatRoundState);
    const firstRoll = rollCombatRoundCombatExperience({
      command: {
        commandId: "workflow-ce-command-1",
        createdAt: "2026-07-23T10:00:02.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-attacker",
      rng: () => 0.5,
      skillTotal: 11,
      state: initialState,
    });
    const updatedEncounter = encounterSessionSchema.parse({
      ...encounter,
      combatRoundState: firstRoll.state,
      updatedAt: "2026-07-23T10:00:02.000Z",
    });
    mocks.runStepWorkflow.mockResolvedValue({
      commandEnvelope: buildCombatRoundCommandEnvelope({ state: firstRoll.state }),
      encounter: updatedEncounter,
      participants,
      workflow: {
        acceptedTasks: [
          {
            commandId: "workflow-ce-command-1",
            executionGroupId: "workflow-ce-group-1",
            kind: "combat_experience",
            participantId: "encounter-attacker",
            taskId: "workflow-ce-task-1",
          },
        ],
        alreadyAccepted: false,
        attemptedTasks: [],
        finalRevision: updatedEncounter.updatedAt,
        identity: {
          encounterId: encounter.id,
          gmActorUserId: "gm-1",
          operationFamily: "roll_remaining",
          runId: "workflow-ce-run-1",
          schemaVersion: 1,
          startExecutionGroupId: "workflow-ce-group-1",
          startProcessId: "round:1:boundary:declaration:process:combat_experience",
          startingRevision: encounter.updatedAt,
          startingRound: 1,
          startingSequence: 2,
          startingStep: "select_actions",
          startTaskId: "workflow-ce-task-1",
        },
        processedCount: 1,
        stepComplete: false,
        stopParticipantId: "encounter-defender",
        stopReason: "combat_experience_review_required",
      },
    });

    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);
    fireEvent.change(await screen.findByRole("combobox", { name: "Workflow" }), {
      target: { value: "complete_remaining" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll remaining GM Combat Experience" }));

    await waitFor(() => expect(mocks.runStepWorkflow).toHaveBeenCalledTimes(1));
    expect(mocks.runStepWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: encounter.id,
        expectedProcessId: expect.any(String),
        operationFamily: "roll_remaining",
      }),
    );
    const status = await screen.findByRole("region", { name: "Workflow status" });
    expect(within(status).getByText("Rolled 1 NPC Combat Experience check.")).toBeInTheDocument();
    expect(within(status).getByText(/Combat Experience requires GM review/)).toBeInTheDocument();
  });

  it("keeps an explicitly cleared empty M1 open without issuing another deterministic request", async () => {
    const before = buildInitiativeEncounter();
    const restoredBase = buildModifierReviewEncounter();
    const restoredState = combatRoundStateSchema.parse({
      ...restoredBase.combatRoundState,
      currentCursor: { participantId: "encounter-attacker", roundNumber: 1, step: "M1" },
      currentStep: "review_action_modifiers",
      gmBacktrackHold: {
        participantId: "encounter-attacker",
        roundNumber: 1,
        step: "review_action_modifiers",
      },
      selectedParticipantId: "encounter-attacker",
      selectedStep: "review_action_modifiers",
    });
    const restored = encounterSessionSchema.parse({
      ...restoredBase,
      combatRoundState: restoredState,
      updatedAt: "2026-07-23T10:01:30.000Z",
    });
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.clearCurrentStep.mockResolvedValue({ encounter: restored, participants: [] });

    render(<CombatRoundManagerPanel encounter={before} scenarioParticipants={participants} />);

    await waitFor(() => expect(mocks.advanceDeterministic).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Clear current step" }));

    await waitFor(() => expect(mocks.clearCurrentStep).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByRole("button", { name: "Complete modifier review" }),
    ).toBeInTheDocument();
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]!);
    expect(screen.getByRole("button", { name: "Complete modifier review" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.advanceDeterministic).toHaveBeenCalledTimes(1);
    expect(mocks.clearCurrentStep).toHaveBeenCalledTimes(1);
  });

  it("keeps an empty modifier review as an editable GM checkpoint", async () => {
    const encounter = buildModifierReviewEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    expect(await screen.findByRole("button", { name: "Complete modifier review" })).toBeEnabled();
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]!);
    fireEvent.change(screen.getByLabelText(/modifier value/i), { target: { value: "-2" } });
    expect(screen.getByLabelText(/modifier value/i)).toHaveValue(-2);
    expect(mocks.advanceDeterministic).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox", { name: "Workflow" })).not.toBeInTheDocument();
    expect(mocks.runStepWorkflow).not.toHaveBeenCalled();
  });

  it("runs one GM step workflow request and renders transient status outside results and log", async () => {
    const encounter = buildModifierReviewEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const state = combatRoundStateSchema.parse(encounter.combatRoundState);
    mocks.runStepWorkflow.mockResolvedValue({
      commandEnvelope: buildCombatRoundCommandEnvelope({ state }),
      encounter,
      participants: [],
      workflow: {
        acceptedTasks: [
          {
            commandId: "workflow-command-1",
            executionGroupId: "workflow-group-1",
            kind: "modifier_review",
            participantId: "encounter-attacker",
            taskId: "workflow-task-1",
          },
        ],
        alreadyAccepted: false,
        attemptedTasks: [],
        finalRevision: encounter.updatedAt,
        finalTask: {
          executionGroupId: "workflow-group-2",
          kind: "modifier_review",
          participantId: "encounter-defender",
          taskId: "workflow-task-2",
        },
        identity: {
          encounterId: encounter.id,
          gmActorUserId: "gm-1",
          operationFamily: "accept_remaining",
          runId: "workflow-run-1",
          schemaVersion: 1,
          startExecutionGroupId: "workflow-group-1",
          startingRevision: encounter.updatedAt,
          startingRound: 1,
          startingSequence: 4,
          startingStep: "review_action_modifiers",
          startTaskId: "workflow-task-1",
        },
        processedCount: 1,
        stepComplete: false,
        stopParticipantId: "encounter-defender",
        stopReason: "modifier_review_required",
        stopTask: {
          executionGroupId: "workflow-group-2",
          kind: "modifier_review",
          participantId: "encounter-defender",
          taskId: "workflow-task-2",
        },
      },
    });
    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    fireEvent.change(await screen.findByRole("combobox", { name: "Workflow" }), {
      target: { value: "complete_remaining" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept remaining NPC reviews" }));

    await waitFor(() => expect(mocks.runStepWorkflow).toHaveBeenCalledTimes(1));
    expect(mocks.runStepWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: encounter.id,
        operationFamily: "accept_remaining",
      }),
    );
    const status = await screen.findByRole("region", { name: "Workflow status" });
    expect(within(status).getByText("Accepted 1 NPC review.")).toBeInTheDocument();
    expect(within(status).getByText(/Stopped at Scyrian cavalry guy/)).toBeInTheDocument();
    expect(screen.getByText("Combat Log")).toBeInTheDocument();
    expect(screen.queryByText("GM Step Automation")).not.toBeInTheDocument();
  });

  it("does not offer bulk initiative for canonical nonparticipants", async () => {
    const encounter = buildInitiativeEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    await waitFor(() => expect(mocks.advanceDeterministic).toHaveBeenCalledTimes(1));
    expect(mocks.advanceDeterministic.mock.calls[0]?.[0]).toMatchObject({
      encounterId: encounter.id,
      expectedRevision: encounter.updatedAt,
    });
    expect(screen.queryByRole("combobox", { name: "Workflow" })).not.toBeInTheDocument();
    expect(screen.queryByText("Complete remaining initiative")).not.toBeInTheDocument();
    expect(mocks.runStepWorkflow).not.toHaveBeenCalled();
  });
});

describe("CombatRoundManagerPanel declaration form", () => {
  it("submits the persisted Scyrian Observe target as the Gladiator combatant id", async () => {
    const gladiatorCombatantId = "scenario-cmp6v9wpm000fzgisztx5bho0";
    const scyrianCombatantId = "scenario-cmp6vb3gw000lzgisw3s2cojw";
    const gladiatorScenarioParticipantId = "cmp6v9wpm000fzgisztx5bho0";
    const scyrianScenarioParticipantId = "cmp6vb3gw000lzgisw3s2cojw";
    const baseEncounter = encounterSessionSchema.parse({
      ...buildEncounter(),
      combatRoundState: undefined,
      currentRound: 3,
      participants: [
        encounterParticipant({
          id: gladiatorCombatantId,
          label: "The Gladiator",
          scenarioParticipantId: gladiatorScenarioParticipantId,
        }),
        encounterParticipant({
          id: scyrianCombatantId,
          label: "Scyrian cavalry guy",
          scenarioParticipantId: scyrianScenarioParticipantId,
        }),
      ],
    });
    const initial = initializeCombatRoundState({ encounter: baseEncounter });
    const gladiatorDeclared = recordCombatRoundDeclaration({
      command: { createdAt: "2026-08-10T23:20:00.000Z", createdByUserId: "gm-1" },
      declaration: {
        actionId: "feint_attack",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: scyrianCombatantId,
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: scyrianCombatantId,
          },
        },
        roundNumber: 3,
      },
      participantId: gladiatorCombatantId,
      state: initial,
      submittedBy: "gm",
    });
    const roundState = combatRoundStateSchema.parse({
      ...gladiatorDeclared,
      currentCursor: { participantId: scyrianCombatantId, roundNumber: 3, step: "DE" },
      currentStep: "select_actions",
      observationRelationships: [
        {
          bestBonus: 0,
          completedAttempts: 0,
          id: `observation:${scyrianCombatantId}:${gladiatorCombatantId}`,
          observerParticipantId: scyrianCombatantId,
          roundsTowardNextAttempt: 2,
          targetParticipantId: gladiatorCombatantId,
        },
      ],
      selectedParticipantId: scyrianCombatantId,
      selectedStep: "select_actions",
    });
    const encounter = encounterSessionSchema.parse({
      ...baseEncounter,
      combatRoundState: roundState,
    });
    const participants = [
      scenarioParticipant({
        id: gladiatorScenarioParticipantId,
        name: "The Gladiator",
        order: 0,
      }),
      scenarioParticipant({
        id: scyrianScenarioParticipantId,
        name: "Scyrian cavalry guy",
        order: 1,
      }),
    ];
    mocks.submitDeclaration.mockResolvedValue({
      encounter: { ...encounter, updatedAt: "2026-08-10T23:21:00.000Z" },
      participant: participants[1],
    });
    const activePresentation = buildActiveCombatPresentation({
      encounterId: encounter.id,
      encounterRevision: encounter.updatedAt,
      resolveStepStatus: ({ status }) => status,
      roundState,
      scenarioParticipants: participants,
    });
    expect(activePresentation.currentAction?.primaryAction.descriptor?.participantId).toBe(
      scyrianCombatantId,
    );

    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    expect(
      await screen.findByText("Combat inspector — Scyrian cavalry guy · Round 3 · Declaration"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "parry" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Secondary action" }), {
      target: { value: "observe_opponent" },
    });
    fireEvent.change(await screen.findByRole("combobox", { name: "Opponent" }), {
      target: { value: gladiatorCombatantId },
    });
    expect(screen.getByText("The Gladiator: 2 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Declare action" }));

    await waitFor(() => expect(mocks.submitDeclaration).toHaveBeenCalledTimes(1));
    expect(mocks.submitDeclaration.mock.calls[0]?.[0]).toMatchObject({
      scenarioParticipantId: scyrianScenarioParticipantId,
      secondaryActionContext: {
        action: "observe_opponent",
        targetParticipantId: gladiatorCombatantId,
      },
    });
    expect(screen.queryByText("Observe Opponent cannot target the acting participant.")).toBeNull();
  });

  it("consumes the server-issued declaration suffix descriptor exactly once", async () => {
    const { accepted, before } = buildSecondDeclarationReadyEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const finalState = combatRoundStateSchema.parse({
      ...accepted.combatRoundState,
      currentCursor: {
        participantId: "encounter-attacker",
        roundNumber: 1,
        step: "i1",
      },
      currentStep: "initiative_phase_1",
      selectedParticipantId: "encounter-attacker",
      selectedStep: "initiative_phase_1",
    });
    const finalEncounter = encounterSessionSchema.parse({
      ...accepted,
      combatRoundState: finalState,
      updatedAt: "2026-07-23T10:01:03.000Z",
    });
    const deterministicAdvance = {
      executionGroupId: "round:1:declaration:boundary:group:0",
      expectedRevision: accepted.updatedAt,
      taskId: "round:1:declaration:boundary:task:gm",
    };
    mocks.submitDeclaration.mockResolvedValue({
      deterministicAdvance,
      encounter: accepted,
      participant: participants[1],
    });
    mocks.advanceDeterministic.mockResolvedValueOnce({
      encounter: finalEncounter,
      executedTaskIds: [deterministicAdvance.taskId, "round:1:M1:boundary:task:gm"],
      participants,
      stopReason: "blocked_or_human_work",
    });
    const onEncounterUpdated = vi.fn();
    const rendered = render(
      <CombatRoundManagerPanel
        encounter={before}
        onEncounterUpdated={onEncounterUpdated}
        scenarioParticipants={participants}
      />,
    );

    fireEvent.change(await screen.findByRole("combobox", { name: "Action" }), {
      target: { value: "attack_parry" },
    });
    fireEvent.change(await screen.findByRole("combobox", { name: "Target" }), {
      target: { value: "encounter-attacker" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Declare action" }));

    await waitFor(() => expect(mocks.advanceDeterministic).toHaveBeenCalledTimes(1));
    expect(mocks.advanceDeterministic.mock.calls[0]?.[0]).toMatchObject({
      currentEncounter: accepted,
      encounterId: before.id,
      ...deterministicAdvance,
    });
    await waitFor(() => expect(onEncounterUpdated).toHaveBeenCalledWith(finalEncounter));

    rendered.rerender(
      <CombatRoundManagerPanel
        encounter={finalEncounter}
        onEncounterUpdated={onEncounterUpdated}
        scenarioParticipants={participants}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.advanceDeterministic).toHaveBeenCalledTimes(1);
  });

  it("renders and submits the explicit Phase 2 mode from the editable canonical context", async () => {
    const encounter = buildEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.submitDeclaration.mockResolvedValue({
      encounter: {
        ...encounter,
        updatedAt: "2026-07-23T10:00:01.000Z",
      },
      participant: participants[0],
    });

    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "double_attack" },
    });

    const attackModeSelectors = await screen.findAllByRole("combobox", {
      name: "Attack mode",
    });
    expect(attackModeSelectors).toHaveLength(2);
    expect(attackModeSelectors[0]).toHaveValue("mode-1");
    expect(attackModeSelectors[1]).toHaveValue("mode-2");

    const targetSelectors = screen.getAllByRole("combobox", { name: "Target" });
    expect(targetSelectors).toHaveLength(2);
    for (const targetSelector of targetSelectors) {
      fireEvent.change(targetSelector, { target: { value: "encounter-defender" } });
    }

    fireEvent.click(screen.getByRole("button", { name: "Declare action" }));

    await waitFor(() => expect(mocks.submitDeclaration).toHaveBeenCalledTimes(1));
    expect(mocks.submitDeclaration.mock.calls[0]?.[0]).toMatchObject({
      actionId: "double_attack",
      phaseAttackSources: {
        phase1: {
          attackModeId: "mode-1",
          opportunitySlot: "attack_1",
          scenarioItemId: "long-sword-primary",
          slot: "primary",
        },
        phase2: {
          attackModeId: "mode-2",
          opportunitySlot: "attack_2",
          scenarioItemId: "long-sword-secondary",
          slot: "secondary",
        },
      },
      phaseContexts: {
        phase1: {
          attackModeId: "mode-1",
          targetParticipantId: "encounter-defender",
        },
        phase2: {
          attackModeId: "mode-2",
          targetParticipantId: "encounter-defender",
        },
      },
    });
  });

  it("keeps both Movement and Weapon Feint Phase 1 free of attack presentation", async () => {
    const encounter = buildEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];

    render(<CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "feint_attack" },
    });

    const phase1 = screen
      .getAllByText("Phase 1")
      .map((node) => node.closest("section"))
      .find((section): section is HTMLElement =>
        Boolean(section?.textContent?.includes("Feint method")),
      );
    const phase2 = screen
      .getAllByText("Phase 2")
      .map((node) => node.closest("section"))
      .find((section): section is HTMLElement =>
        Boolean(section?.textContent?.includes("Attack mode")),
      );
    expect(phase1).toBeDefined();
    expect(phase2).toBeDefined();

    expect(within(phase1!).queryByText("OB")).not.toBeInTheDocument();
    expect(within(phase1!).queryByText("DMB")).not.toBeInTheDocument();
    expect(within(phase1!).queryByText("DB")).not.toBeInTheDocument();
    expect(within(phase1!).queryByText("Attack mode")).not.toBeInTheDocument();
    expect(within(phase1!).queryByText("Parry context")).not.toBeInTheDocument();
    expect(within(phase2!).getByText("OB")).toBeInTheDocument();
    expect(within(phase2!).getByText("Attack mode")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Feint method" }), {
      target: { value: "weapon" },
    });

    expect(within(phase1!).queryByText("OB")).not.toBeInTheDocument();
    expect(within(phase1!).queryByText("DMB")).not.toBeInTheDocument();
    expect(within(phase1!).queryByText("Attack mode")).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Attack mode" })).toHaveLength(1);
  });
});

describe("CombatRoundManagerPanel GM attack proxy", () => {
  it("moves from the Feint initiator roll to the active defender task without History", async () => {
    const { afterAttackerRoll, beforeAttackerRoll } = buildFeintRollEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.rollFeint.mockResolvedValue({ encounter: afterAttackerRoll });
    const projectedTask = buildCombatProgressionProjection(
      combatRoundStateSchema.parse(beforeAttackerRoll.combatRoundState),
    )
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.state === "executable");
    expect(projectedTask?.kind).toBe("feint_attacker_roll");
    const activePresentation = buildActiveCombatPresentation({
      encounterId: beforeAttackerRoll.id,
      encounterRevision: beforeAttackerRoll.updatedAt,
      resolveStepStatus: ({ status }) => status,
      roundState: combatRoundStateSchema.parse(beforeAttackerRoll.combatRoundState),
      scenarioParticipants: participants,
    });
    expect(activePresentation.currentAction?.taskKind).toBe("feint_attacker_roll");
    expect(activePresentation.currentAction?.primaryAction.label).toBe("Roll Feint");
    expect(activePresentation.currentAction?.primaryAction.viewerMayInvoke).toBe(true);

    render(
      <CombatRoundManagerPanel
        encounter={beforeAttackerRoll}
        onEncounterUpdated={vi.fn()}
        scenarioParticipants={participants}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Roll Feint" }));

    await waitFor(() => expect(mocks.rollFeint).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Roll Feint resistance" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Current task" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume current task" })).not.toBeInTheDocument();
    expect(screen.queryByText("Action selector · History")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Combat inspector — Scyrian cavalry guy · Round 1 ·/),
    ).toBeInTheDocument();
  });

  it("presses the rendered source attack button without requiring Offensive Parry child identity", async () => {
    const encounter = buildAttackReadyEncounter();
    const attackReadyState = combatRoundStateSchema.parse(encounter.combatRoundState);
    const opportunityId = attackReadyState.participants.find(
      (participant) => participant.participantId === "encounter-attacker",
    )?.declaration?.attackOpportunities?.[0]?.id;
    const projectedAttackTask = buildCombatProgressionProjection(attackReadyState)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "attack" && task.state === "executable");
    expect(projectedAttackTask).toBeDefined();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    participants[0] = {
      ...participants[0]!,
      state: {
        ...participants[0]!.state,
        combatEffects: {
          effects: [
            {
              combatModifierBucket: "general",
              combatWide: true,
              createdAt: "2026-07-23T10:01:59.000Z",
              createdInInitiativeGroupId: "round:1:phase:phase1:initiative:7",
              damage: 0,
              description: "Higher-initiative injury",
              effectGroup: "general",
              effectiveAfterInitiativeGroupId: "round:1:phase:phase1:initiative:7",
              generalDamage: 0,
              id: "effect:initiative-7:skill",
              modifierValue: -2,
              sourceEventId: "event:initiative-7:injury",
              status: "pending",
              targetParticipantId: "scenario-attacker",
              type: "general_modifier",
              updatedAt: "2026-07-23T10:01:59.000Z",
            },
          ],
          events: [
            {
              createdAt: "2026-07-23T10:01:59.000Z",
              id: "event:initiative-7:injury",
              sourceLabel: "Higher-initiative injury",
              targetParticipantId: "scenario-attacker",
            },
          ],
        },
      },
    } as ScenarioParticipant;
    mocks.rollAttack.mockResolvedValue({
      commandEnvelope: buildCombatRoundCommandEnvelope({
        state: attackReadyState,
      }),
      encounter,
      participant: participants[0],
    });

    render(
      <CombatRoundManagerPanel
        encounter={encounter}
        onEncounterUpdated={vi.fn()}
        scenarioParticipants={participants}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Current task" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll attack" }));

    await waitFor(() => expect(mocks.rollAttack).toHaveBeenCalledTimes(1));
    const request = mocks.rollAttack.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      actionId: "attack_parry",
      attackIndex: projectedAttackTask?.identity.attackIndex,
      attackModeId: projectedAttackTask?.identity.attackModeId,
      declarationId: "round:1:participant:encounter-attacker:declaration",
      executionGroupId: projectedAttackTask?.executionGroupId,
      expectedRevision: encounter.updatedAt,
      initiativeGroupId: projectedAttackTask?.identity.initiativeGroupId,
      initiativeValue: projectedAttackTask?.identity.initiativeValue,
      modifierValidationTaskId: projectedAttackTask?.id,
      opportunityId,
      phase: projectedAttackTask?.identity.phase,
      scenarioParticipantId: "scenario-attacker",
      taskId: projectedAttackTask?.id,
      weaponSourceId: projectedAttackTask?.identity.weaponSourceId,
      weaponSourceSlot: projectedAttackTask?.identity.weaponSourceSlot,
      weaponTemplateId: projectedAttackTask?.identity.weaponTemplateId,
    });
    expect(request).not.toHaveProperty("attackerModifierFingerprint");
    expect(request).not.toHaveProperty("ob");
    expect(request).not.toHaveProperty("obSkillRaw");
    expect(request).not.toHaveProperty("defenderDb");
    expect(request).not.toHaveProperty("defenderDbParryRaw");
    expect(request).not.toHaveProperty("defenderModifierFingerprint");
    expect(request).not.toHaveProperty("declaredOpponentParticipantId");
    expect(request).not.toHaveProperty("offensiveParryAttemptId");
  });

  it("refreshes a genuine cross-client stale revision without replaying the attack", async () => {
    const encounter = buildAttackReadyEncounter();
    const refreshedEncounter = encounterSessionSchema.parse({
      ...encounter,
      updatedAt: "2026-07-23T10:02:30.000Z",
    });
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.rollAttack.mockRejectedValue(
      new (await import("@/lib/api/apiClient")).ApiRequestError("Combat state changed.", 409, {
        code: "stale_revision",
      }),
    );
    mocks.loadEncounter.mockResolvedValue(refreshedEncounter);
    mocks.loadParticipants.mockResolvedValue(participants);

    render(
      <CombatRoundManagerPanel
        encounter={encounter}
        onEncounterUpdated={vi.fn()}
        scenarioParticipants={participants}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Current task" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll attack" }));

    await waitFor(() => expect(mocks.loadEncounter).toHaveBeenCalledTimes(1));
    expect(mocks.loadParticipants).toHaveBeenCalledTimes(1);
    expect(mocks.rollAttack).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "Combat changed in another view. The current action was refreshed; review it before retrying.",
      ),
    ).toBeInTheDocument();
  });
});

describe("CombatRoundManagerPanel post-mutation task adoption", () => {
  it("adopts remote player declarations as one current tracker, inspector, and log revision", async () => {
    const { before, bothAcceptedAtM1, firstAccepted } = buildRemotePlayerDeclarationEncounters();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const rendered = render(
      <CombatRoundManagerPanel encounter={before} scenarioParticipants={participants} />,
    );

    expect(await screen.findByRole("button", { name: "Declare action" })).toBeEnabled();
    rendered.rerender(
      <CombatRoundManagerPanel encounter={firstAccepted} scenarioParticipants={participants} />,
    );

    expect(
      await screen.findByText(/Combat inspector — Scyrian cavalry guy · Round 1 · Declaration/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Declare action" })).toBeEnabled();
    expect(screen.getByText(/The Gladiator declared Parry/)).toBeInTheDocument();
    const attackerDeclarationCell = screen.getByRole("button", {
      name: /The Gladiator.*Round 1.*DE.*declared by player/i,
    });
    expect(within(attackerDeclarationCell).getByText("✓")).toBeInTheDocument();

    rendered.rerender(
      <CombatRoundManagerPanel encounter={bothAcceptedAtM1} scenarioParticipants={participants} />,
    );

    expect(await screen.findByRole("button", { name: "Complete modifier review" })).toBeEnabled();
    expect(
      screen.getByRole("heading", { name: /Combat inspector — The Gladiator · Round 1/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The Gladiator declared Parry/)).toBeInTheDocument();
    expect(screen.getByText(/Scyrian cavalry guy declared Parry/)).toBeInTheDocument();
    expect(screen.getAllByText(/declared Parry/)).toHaveLength(2);
  });

  it("preserves manual inspection across a remote revision and resumes its newest current task", async () => {
    const { bothAcceptedAtM1, firstAccepted } = buildRemotePlayerDeclarationEncounters();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const rendered = render(
      <CombatRoundManagerPanel encounter={firstAccepted} scenarioParticipants={participants} />,
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /The Gladiator.*Round 1.*DE.*declared by player/i,
      }),
    );

    rendered.rerender(
      <CombatRoundManagerPanel encounter={bothAcceptedAtM1} scenarioParticipants={participants} />,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Combat inspector — The Gladiator · Round 1 · Declaration/,
      }),
    ).toBeInTheDocument();
    const resume = screen.getByRole("button", { name: "Resume current task" });
    expect(resume).toBeEnabled();
    fireEvent.click(resume);
    expect(await screen.findByRole("button", { name: "Complete modifier review" })).toBeEnabled();
  });

  it("routes empty final SU completion through the deterministic suffix", async () => {
    const { beforeFinalReview } = buildFinalParticipantReviewEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    render(
      <CombatRoundManagerPanel
        encounter={beforeFinalReview}
        onEncounterUpdated={vi.fn()}
        scenarioParticipants={participants}
      />,
    );

    await waitFor(() => expect(mocks.advanceDeterministic).toHaveBeenCalledTimes(1));
    expect(mocks.advanceDeterministic.mock.calls[0]?.[0]).toMatchObject({
      encounterId: beforeFinalReview.id,
      expectedRevision: beforeFinalReview.updatedAt,
    });
    expect(
      screen.queryByRole("button", { name: "Complete effect review" }),
    ).not.toBeInTheDocument();
    expect(mocks.commitParticipantReview).not.toHaveBeenCalled();
    expect(mocks.advanceCurrentStep).not.toHaveBeenCalled();
  });

  it("keeps the final observation result passive while exposing the SU board checkpoint", async () => {
    const { afterObservation, beforeObservation, boundaryTask } = buildFinalObservationEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.rollObservation.mockResolvedValue({
      commandEnvelope: buildCombatRoundCommandEnvelope({
        state: combatRoundStateSchema.parse(afterObservation.combatRoundState),
      }),
      encounter: afterObservation,
    });
    render(
      <CombatRoundManagerPanel
        encounter={beforeObservation}
        onEncounterUpdated={vi.fn()}
        scenarioParticipants={participants}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Current task" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll observation" }));
    await waitFor(() => expect(mocks.rollObservation).toHaveBeenCalledTimes(1));

    expect(await screen.findByText("Recent result")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Roll observation" })).not.toBeInTheDocument();
    expect(boundaryTask.expectedCommand).toBe("complete_round");
    expect(screen.getByRole("button", { name: "Open next round" })).toBeEnabled();
    expect(mocks.advanceDeterministic).not.toHaveBeenCalled();
    expect(screen.getByText("Recent result")).toBeInTheDocument();
    expect(mocks.advanceCurrentStep).not.toHaveBeenCalled();
  });
});

const performanceFixtureIt = process.env.GLANTRI_COMBAT_PERF_FIXTURE === "1" ? it : it.skip;

describe("CombatRoundManagerPanel performance fixture", () => {
  performanceFixtureIt("measures tracker and render growth without combat mutations", () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    const rows: Array<{
      combatPanelViewModelMs: number;
      reactCommitMs: number;
      roundNumber: number;
      transientPanelViewModelMs: number;
      transientReactCommitMs: number;
      transientTrackerViewModelMs: number;
      trackerCellCount: number;
      trackerViewModelMs: number;
    }> = [];

    for (const archivedRoundCount of [0, 2, 4, 6]) {
      const samples: Array<{
        combatPanelViewModelMs: number;
        reactCommitMs: number;
        transientPanelViewModelMs: number;
        transientReactCommitMs: number;
        transientTrackerViewModelMs: number;
        trackerCellCount: number;
        trackerViewModelMs: number;
      }> = [];
      for (let sample = 0; sample < 5; sample += 1) {
        const baseEncounter = buildModifierReviewEncounter();
        const baseState = combatRoundStateSchema.parse(baseEncounter.combatRoundState);
        const encounter = encounterSessionSchema.parse({
          ...baseEncounter,
          combatRoundState: {
            ...baseState,
            roundNumber: archivedRoundCount + 1,
            rounds: Array.from({ length: archivedRoundCount }, (_, index) => ({
              currentStep: "round_summary",
              encounterId: baseEncounter.id,
              participants: baseState.participants,
              roundNumber: index + 1,
            })),
          },
          currentRound: archivedRoundCount + 1,
        });
        info.mockClear();
        beginCombatPerformanceInteraction({
          command: "render_fixture",
          encounterId: encounter.id,
          participantCount: 2,
          roundNumber: archivedRoundCount + 1,
        });

        render(
          <CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />,
        );

        const records = info.mock.calls.flatMap((call) => {
          const record = call[1];
          return record && typeof record === "object" ? [record as Record<string, unknown>] : [];
        });
        const tracker = records.find((record) => record.stage === "tracker_view_model");
        const panel = records.find((record) => record.stage === "combat_panel_view_model");
        const commit = records.find((record) => record.stage === "react_commit");
        info.mockClear();
        fireEvent.change(screen.getByLabelText("Workflow"), {
          target: { value: "complete_remaining" },
        });
        const transientRecords = info.mock.calls.flatMap((call) => {
          const record = call[1];
          return record && typeof record === "object" ? [record as Record<string, unknown>] : [];
        });
        const transientTracker = transientRecords.find(
          (record) => record.stage === "tracker_view_model",
        );
        const transientPanel = transientRecords.find(
          (record) => record.stage === "combat_panel_view_model",
        );
        const transientCommit = transientRecords.find((record) => record.stage === "react_commit");
        samples.push({
          combatPanelViewModelMs: Number(panel?.durationMs ?? 0),
          reactCommitMs: Number(commit?.durationMs ?? 0),
          transientPanelViewModelMs: Number(transientPanel?.durationMs ?? 0),
          transientReactCommitMs: Number(transientCommit?.durationMs ?? 0),
          transientTrackerViewModelMs: Number(transientTracker?.durationMs ?? 0),
          trackerCellCount: Number(tracker?.trackerCellCount ?? 0),
          trackerViewModelMs: Number(tracker?.durationMs ?? 0),
        });
        cleanup();
        resetCombatPerformanceForTests();
      }
      const median = (values: number[]) =>
        [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)] ?? 0;
      rows.push({
        combatPanelViewModelMs: median(samples.map((sample) => sample.combatPanelViewModelMs)),
        reactCommitMs: median(samples.map((sample) => sample.reactCommitMs)),
        roundNumber: archivedRoundCount + 1,
        transientPanelViewModelMs: median(
          samples.map((sample) => sample.transientPanelViewModelMs),
        ),
        transientReactCommitMs: median(samples.map((sample) => sample.transientReactCommitMs)),
        transientTrackerViewModelMs: median(
          samples.map((sample) => sample.transientTrackerViewModelMs),
        ),
        trackerCellCount: median(samples.map((sample) => sample.trackerCellCount)),
        trackerViewModelMs: median(samples.map((sample) => sample.trackerViewModelMs)),
      });
    }

    process.stdout.write(`COMBAT_PERF_FIXTURE ${JSON.stringify(rows)}\n`);
  });
});
