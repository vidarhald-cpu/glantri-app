import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceCombatRoundStep,
  backOutCombatRoundPhaseAttack,
  buildCombatRoundAttackRollResult,
  combatRoundParticipantHasExecutablePhaseAttack,
  combatRoundParticipantHasPhaseAttack,
  combatRoundParticipantWasAttackedInPhase,
  commitCombatRoundEndDistanceControl,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseDamage,
  commitCombatRoundPhaseInitiativeResolution,
  ensureCombatRoundPhaseResolutionResultsForPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundParticipantPhaseStepStatus,
  initializeCombatRoundState,
  prepareCombatRoundEndReview,
  rollCombatRoundCombatExperience,
  rollCombatRoundEndDistanceControl,
  recordCombatRoundAttackResult,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDeclaration,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundParryResult,
  recordCombatRoundParticipantStepReview,
  type CombatRoundState,
  type CombatEffectsState,
  type EncounterSession,
  getDistanceBetween,
  makeDistancePairKey,
  setDistanceBetween,
  setCombatRoundCombatExperienceDifficulty,
} from "@glantri/domain";
import { weaponTemplates } from "@glantri/content/equipment";

const mocks = vi.hoisted(() => {
  const adminUser = {
    email: "gm@example.test",
    id: "gm-1",
    roles: ["game_master"],
  };
  const playerUser = {
    email: "player@example.test",
    id: "player-1",
    roles: ["player"],
  };
  const campaignService = {
    createCampaign: vi.fn(),
    getCampaignById: vi.fn(),
    listCampaignRosterEntries: vi.fn(),
    listCampaignsByCharacterRosterAccess: vi.fn(),
    listCampaignsByGameMaster: vi.fn(),
    listCampaignsByPlayerAccess: vi.fn(),
    removeCampaignRosterEntryBySource: vi.fn(),
  };
  const characterService = {
    getCharacterById: vi.fn(),
    getOwnedCharacter: vi.fn(),
  };
  const encounterService = {
    createEncounter: vi.fn(),
    getEncounterById: vi.fn(),
    listEncountersByScenario: vi.fn(),
    updateEncounter: vi.fn(),
    updateScenarioParticipantState: vi.fn(),
  };
  const scenarioService = {
    createScenario: vi.fn(),
    addCharacterParticipant: vi.fn(),
    getScenarioById: vi.fn(),
    listScenariosByCampaignPlayerAccess: vi.fn(),
    listScenariosByCampaign: vi.fn(),
    listScenarioParticipants: vi.fn(),
    recordScenarioEvent: vi.fn(),
    refreshCharacterParticipantEquipmentSnapshot: vi.fn(),
    updateScenario: vi.fn(),
    userHasPlayerScenarioAccess: vi.fn(),
  };
  return {
    adminUser,
    campaignService,
    characterService,
    encounterService,
    playerUser,
    requireAdminUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    scenarioService,
  };
});

vi.mock("@glantri/database", () => ({
  CampaignService: vi.fn(() => mocks.campaignService),
  CharacterService: vi.fn(() => mocks.characterService),
  EncounterService: vi.fn(() => mocks.encounterService),
  ScenarioService: vi.fn(() => mocks.scenarioService),
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { scenariosRoutes } from "./scenarios";

function emptyModifierBuckets() {
  return {
    general: [],
    situationDb: [],
    situationInitiative: [],
    situationObSkill: [],
  };
}

const attackParryDbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:attack-parry:phase1:db-parry",
  notes: "single attack",
  scope: "until",
  sourceActionId: "attack_parry",
  sourcePhase: "phase1",
  sourceRule: "attack-parry-db-parry-phase1",
  value: -4,
};
const attackParryDbParryModifier = expect.objectContaining(attackParryDbParryModifierEntry);
const parryAttackDbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:parry-attack:phase2:db-parry",
  notes: "reactive attack",
  scope: "until",
  sourceActionId: "parry_attack",
  sourcePhase: "phase2",
  sourceRule: "parry-attack-db-parry-phase2",
  value: -4,
};
const parryAttackDbParryModifier = expect.objectContaining(parryAttackDbParryModifierEntry);
const doubleAttackPhase1ObSkillModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase1:ob-skill",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  sourceRule: "double-attack-ob-skill-phase1",
  value: -1,
};
const doubleAttackPhase2ObSkillModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase2:ob-skill",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  sourceRule: "double-attack-ob-skill-phase2",
  value: -1,
};
const doubleAttackPhase1DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase1:db-parry",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  sourceRule: "double-attack-db-parry-phase1",
  value: -4,
};
const doubleAttackPhase2DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase2:db-parry",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  sourceRule: "double-attack-db-parry-phase2",
  value: -4,
};
const adjustRangePhase1DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:adjust-range-attack:phase1:db-parry",
  notes: "adjust range",
  scope: "until",
  sourceActionId: "adjust_range_attack",
  sourcePhase: "phase1",
  sourceRule: "adjust-range-phase1-db-parry",
  value: -2,
};
const doubleAttackPhase1ObSkillModifier = expect.objectContaining(
  doubleAttackPhase1ObSkillModifierEntry,
);
const doubleAttackPhase2ObSkillModifier = expect.objectContaining(
  doubleAttackPhase2ObSkillModifierEntry,
);
const doubleAttackPhase1DbParryModifier = expect.objectContaining(
  doubleAttackPhase1DbParryModifierEntry,
);
const doubleAttackPhase2DbParryModifier = expect.objectContaining(
  doubleAttackPhase2DbParryModifierEntry,
);
const adjustRangePhase1DbParryModifier = expect.objectContaining(
  adjustRangePhase1DbParryModifierEntry,
);

async function buildScenarioTestApp() {
  const app = Fastify({
    logger: false,
  });
  await app.register(scenariosRoutes);
  return app;
}

function testCombatPhaseContext(targetParticipantId: string) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId,
  };
}

function makeTwoCombatEncounterParticipants() {
  return [
    makeCombatEncounter().participants[0],
    {
      ...makeCombatEncounter().participants[0],
      id: "encounter-participant-2",
      label: "City guard",
      scenarioParticipantId: "participant-2",
    },
  ];
}

function makeEncounterCombatParticipant(input: {
  id: string;
  label: string;
  order: number;
  scenarioParticipantId: string;
}) {
  return {
    ...makeCombatEncounter().participants[0],
    id: input.id,
    label: input.label,
    order: input.order,
    scenarioParticipantId: input.scenarioParticipantId,
  };
}

function makeFourCombatEncounterParticipants() {
  return [
    makeEncounterCombatParticipant({
      id: "encounter-participant-1",
      label: "The Gladiator",
      order: 0,
      scenarioParticipantId: "participant-1",
    }),
    makeEncounterCombatParticipant({
      id: "encounter-participant-2",
      label: "City guard",
      order: 1,
      scenarioParticipantId: "participant-2",
    }),
    makeEncounterCombatParticipant({
      id: "encounter-participant-3",
      label: "North archer",
      order: 2,
      scenarioParticipantId: "participant-3",
    }),
    makeEncounterCombatParticipant({
      id: "encounter-participant-4",
      label: "South archer",
      order: 3,
      scenarioParticipantId: "participant-4",
    }),
  ];
}

function addPrivateDamageReviewToResolution(input: {
  attackResultId: string;
  state: CombatRoundState;
}): CombatRoundState {
  return {
    ...input.state,
    phaseResolutionResults: input.state.phaseResolutionResults.map((result) =>
      result.attackResultId === input.attackResultId && result.damageResult
        ? {
            ...result,
            damageResult: {
              ...result.damageResult,
              review: {
                ...(result.damageResult.review ?? {}),
                additionalEffects: result.damageResult.review?.additionalEffects ?? [],
                notes: "secret-gm-review",
                operationalConsequences: result.damageResult.review?.operationalConsequences ?? [],
                reviewedAt: "2026-01-01T00:05:30.000Z",
                reviewedByUserId: "gm-1",
                totalDamageOverride: result.damageResult.totalDamage + 1,
              },
            },
          }
        : result,
    ),
  };
}

function makeCriticalRollMutationFixture() {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const combatEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const attackHit = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackerParticipantId: "encounter-participant-1",
    defenderDb: 10,
    defenderParticipantId: "encounter-participant-2",
    ob: 10,
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: {
      createdAt: attackHit.rolledAt,
      createdByUserId: "gm-1",
    },
    participantId: "encounter-participant-1",
    result: attackHit,
    state: initializeCombatRoundState({ encounter: combatEncounter }),
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:00.000Z",
      createdByUserId: "gm-1",
    },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:30.000Z",
      createdByUserId: "gm-1",
    },
    hitLocationRolls: [12],
    rolledByParticipantId: "encounter-participant-1",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:05:00.000Z",
      createdByUserId: "gm-1",
    },
    defenderDm: 0,
    dmb: 8,
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const attackResultId = "1:phase1:encounter-participant-1:encounter-participant-2";

  return {
    attackResultId,
    encounterParticipants,
    scenarioParticipants: [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ],
    state: addPrivateDamageReviewToResolution({
      attackResultId,
      state: afterDamage,
    }),
  };
}

function makeCombatReadProjectionFixture() {
  const encounterParticipants = makeFourCombatEncounterParticipants();
  const combatEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const attackHit = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackerParticipantId: "encounter-participant-1",
    defenderDb: 10,
    defenderParticipantId: "encounter-participant-2",
    ob: 10,
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: {
      createdAt: attackHit.rolledAt,
      createdByUserId: "gm-1",
    },
    participantId: "encounter-participant-1",
    result: attackHit,
    state: initializeCombatRoundState({ encounter: combatEncounter }),
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:00.000Z",
      createdByUserId: "gm-1",
    },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:30.000Z",
      createdByUserId: "gm-1",
    },
    hitLocationRolls: [12],
    rolledByParticipantId: "encounter-participant-1",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:05:00.000Z",
      createdByUserId: "gm-1",
    },
    defenderDm: 0,
    dmb: 8,
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const attackResultId = "1:phase1:encounter-participant-1:encounter-participant-2";

  return {
    attackResultId,
    encounterParticipants,
    scenarioParticipants: [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "uninvolved-player",
        id: "participant-3",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "fourth-player",
        id: "participant-4",
      }),
    ],
    state: addPrivateDamageReviewToResolution({
      attackResultId,
      state: afterDamage,
    }),
  };
}

function makeOpenPhase1AttackRoundState(
  input: {
    distance?: number;
    modifierEntries?: Array<Record<string, unknown>>;
    snapshotOb?: string;
    snapshotWeaponName?: string;
  } = {},
) {
  const stepStatuses = {
    initiative_phase_1: "submitted",
    initiative_phase_2: "pending",
    phase_1_actions: "submitted",
    phase_2_actions: "pending",
    review_action_modifiers: "complete",
    review_phase_2_actions: "pending",
    review_phase_2_damage: "pending",
    review_phase_2_modifiers: "pending",
    round_summary: "pending",
    select_actions: "submitted",
  };
  const modifierEntries = input.modifierEntries ?? [];
  const modifierTotal = modifierEntries.reduce(
    (sum, entry) => sum + (typeof entry.value === "number" ? entry.value : 0),
    0,
  );

  return {
    ...(input.distance === undefined
      ? {}
      : {
          distanceState: setDistanceBetween({
            distance: input.distance,
            participantAId: "encounter-participant-1",
            participantBId: "encounter-participant-2",
            source: "gm_set",
          }),
        }),
    commands: [
      {
        afterCursor: {
          participantId: "encounter-participant-1",
          roundNumber: 1,
          step: "i1",
        },
        beforeCursor: {
          participantId: "encounter-participant-1",
          roundNumber: 1,
          step: "i1",
        },
        createdAt: "2026-01-01T00:01:30.000Z",
        facts: {},
        id: "command-i1",
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "i1",
        type: "roll_initiative_phase1",
      },
    ],
    currentCursor: {
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "A1",
    },
    currentStep: "phase_1_actions",
    participants: [
      {
        attackResults: {},
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: {
              targetParticipantId: "participant-2",
            },
          },
          roundNumber: 1,
          submittedAt: "2026-01-01T00:01:00.000Z",
          submittedBy: "player",
        },
        initiatives: {
          phase1: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [6],
            rollTotal: 6,
            total: 6,
          },
        },
        label: "The Gladiator",
        participantId: "encounter-participant-1",
        stepStatuses,
      },
      {
        attackResults: {},
        initiatives: {
          phase1: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
        },
        label: "City guard",
        participantId: "encounter-participant-2",
        stepStatuses,
      },
    ],
    phaseResolutionCursor: {
      participantId: "encounter-participant-1",
      phase: "phase1",
      substep: "attack",
    },
    phaseResolutionResults: [],
    phaseResolutionStatuses: {},
    roundNumber: 1,
    stepSnapshots: [
      {
        attackSummary: {
          attackMode: "C",
          dmb: "8",
          initiative: "3",
          maxCrits: "FS",
          ob: input.snapshotOb ?? "10",
          weaponName: input.snapshotWeaponName ?? "Long sword",
        },
        committedAt: "2026-01-01T00:02:00.000Z",
        id: "snapshot-attack",
        ...(modifierEntries.length > 0
          ? {
              modifierSummary: {
                dbRaw: 0,
                generalFatigueRaw: 0,
                initiativeRaw: 0,
                obSkillRaw: modifierTotal,
                rows: [
                  {
                    bucketKey: "situation_ob_skill",
                    entries: modifierEntries,
                    label: "Skill/OB",
                    total: modifierTotal,
                  },
                ],
              },
            }
          : {}),
        participantId: "encounter-participant-1",
        participantLabel: "The Gladiator",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
      {
        committedAt: "2026-01-01T00:02:00.000Z",
        defenseSummary: {
          db: "11",
          dm: "0",
          parry: "9",
          sourceName: "Sword / shield",
        },
        id: "snapshot-defense",
        participantId: "encounter-participant-2",
        participantLabel: "City guard",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
    ],
  };
}

function makeCombatScenarioParticipant(overrides: Record<string, unknown> = {}) {
  return {
    controlledByUserId: "player-1",
    id: "participant-1",
    isActive: true,
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      displayName: "The Gladiator",
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
      conditions: [],
      equipment: {},
      health: {},
      modifiers: [],
      resources: {},
    },
    ...overrides,
  };
}

function makeCanonicalAttackModifierParticipantState() {
  return {
    ...makeCombatScenarioParticipant().state,
    combat: {
      combatContext: {
        modifierBuckets: {
          general: [{ id: "general-not-ob", scope: "until", value: 99 }],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [
            {
              id: "import:character_effect:skill-ob:skill_ob",
              imported: true,
              readOnly: true,
              scope: "until",
              sourceEffectId: "skill-ob",
              sourceType: "character_effect",
              value: 2,
            },
            {
              generated: true,
              id: "generated-phase1-ob",
              scope: "until",
              sourcePhase: "phase1",
              value: -1,
            },
            { id: "manual-ob", scope: "until", value: 1 },
            {
              generated: true,
              id: "other-phase-ob",
              scope: "until",
              sourcePhase: "phase2",
              value: 99,
            },
          ],
        },
      },
    },
  };
}

function makeWeaponEquipmentState(input: {
  characterId?: string;
  name: string;
  range: string;
  templateId?: string;
}) {
  const characterId = input.characterId ?? "character-1";
  const templateId =
    input.templateId ?? `template-${input.name.toLowerCase().replace(/\s+/g, "-")}`;
  const itemId = `item-${templateId}`;

  return {
    activeLoadoutByCharacterId: {
      [characterId]: {
        activePrimaryWeaponItemId: itemId,
      },
    },
    itemsById: {
      [itemId]: {
        id: itemId,
        templateId,
      },
    },
    locationsById: {},
    templates: {
      templatesById: {
        [templateId]: {
          category: "weapon",
          id: templateId,
          name: input.name,
          range: input.range,
        },
      },
    },
  };
}

function makeServerWeaponEquipmentState(input: {
  characterId?: string;
  name: string;
  range: string;
  templateId?: string;
}) {
  const webState = makeWeaponEquipmentState(input);

  return {
    activeLoadoutByCharacterId: webState.activeLoadoutByCharacterId,
    itemsById: webState.itemsById,
    locationsById: webState.locationsById,
    templatesById: webState.templates.templatesById,
  };
}

function makeCombatScenarioParticipantWithWeapon(
  overrides: Record<string, unknown> & { weaponName?: string; weaponRange?: string } = {},
) {
  const characterId = (overrides.characterId as string | undefined) ?? "character-1";

  return makeCombatScenarioParticipant({
    ...overrides,
    characterId,
    snapshot: {
      displayName: "The Gladiator",
      equipmentState: makeWeaponEquipmentState({
        characterId,
        name: overrides.weaponName ?? "Long sword",
        range: overrides.weaponRange ?? "3.0",
      }),
      ...((overrides.snapshot as Record<string, unknown> | undefined) ?? {}),
    },
  });
}

function makeDoubleAttackWeaponParticipant(templateId = "weapon-template-dagger") {
  const template = weaponTemplates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Missing weapon fixture ${templateId}.`);
  const itemId = `item-${templateId}`;

  return makeCombatScenarioParticipant({
    characterId: "character-1",
    snapshot: {
      displayName: "The Gladiator",
      equipmentState: {
        activeLoadoutByCharacterId: {
          "character-1": { activePrimaryWeaponItemId: itemId },
        },
        itemsById: {
          [itemId]: { id: itemId, templateId },
          [`unready-${itemId}`]: { id: `unready-${itemId}`, templateId },
        },
        locationsById: {},
        templatesById: { [templateId]: template },
      },
    },
  });
}

function makeDoubleAttackTwoWeaponParticipant() {
  const templateIds = ["weapon-template-fencing-sword", "weapon-template-main-gauche"] as const;
  const templates = Object.fromEntries(
    templateIds.map((templateId) => {
      const template = weaponTemplates.find((candidate) => candidate.id === templateId);
      if (!template) throw new Error(`Missing weapon fixture ${templateId}.`);
      return [templateId, template];
    }),
  );

  return makeCombatScenarioParticipant({
    characterId: "character-1",
    snapshot: {
      displayName: "The Gladiator",
      equipmentState: {
        activeLoadoutByCharacterId: {
          "character-1": {
            activePrimaryWeaponItemId: "scenario-fencing-sword",
            activeSecondaryWeaponItemId: "scenario-main-gauche",
          },
        },
        itemsById: {
          "scenario-fencing-sword": {
            id: "scenario-fencing-sword",
            templateId: templateIds[0],
          },
          "scenario-main-gauche": {
            id: "scenario-main-gauche",
            templateId: templateIds[1],
          },
        },
        locationsById: {},
        templatesById: templates,
      },
    },
  });
}

function makeWeaponAttackSourceRef(input: {
  attackModeId?: string;
  itemId: string;
  opportunitySlot: "attack_1" | "attack_2";
  slot?: "primary" | "secondary" | "throwing" | "other";
  templateId: string;
}) {
  return {
    attackModeId: input.attackModeId ?? "mode-1",
    opportunitySlot: input.opportunitySlot,
    scenarioItemId: input.itemId,
    slot: input.slot ?? "primary",
    sourceKind: "weapon",
    templateId: input.templateId,
  } as const;
}

function makeUnarmedAttackSourceRef(input: {
  opportunitySlot: "attack_1" | "attack_2";
  templateId: string;
}) {
  return {
    attackModeId: "mode-1",
    opportunitySlot: input.opportunitySlot,
    slot: "virtual",
    sourceKind: "unarmed",
    templateId: input.templateId,
  } as const;
}

function makeCombatExperienceCharacterBuild(overrides: Record<string, unknown> = {}) {
  return {
    equipment: {
      items: [],
    },
    id: "character-1",
    name: "The Gladiator",
    profile: {
      distractionLevel: 3,
      id: "profile-1",
      label: "The Gladiator",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 11,
      secondaryPoolTotal: 20,
      skillGroups: [],
      skills: [
        {
          category: "secondary",
          categoryId: "military",
          groupId: "veteran_soldiering",
          secondaryRanks: 11,
          skillId: "combat_experience",
        },
      ],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
    statModifiers: {},
    ...overrides,
  };
}

function makeCombatEncounter(overrides: Record<string, unknown> = {}) {
  return {
    actionLog: [],
    campaignId: "campaign-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      {
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: "encounter-participant-1",
        initiative: 0,
        label: "The Gladiator",
        order: 0,
        orientation: "neutral",
        participantType: "scenario",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: "participant-1",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function withResolvedCombatStartExperience(encounter: Record<string, unknown>) {
  const state = initializeCombatRoundState({ encounter: encounter as EncounterSession });

  if (state.roundNumber !== 1) {
    return encounter;
  }

  return {
    ...encounter,
    combatRoundState: {
      ...state,
      participants: state.participants.map((participant) =>
        participant.combatExperience
          ? participant
          : {
              ...participant,
              combatExperience: {
                difficulty: 26,
                difficultyShift: 5,
                durationRounds: 0,
                effectiveTableTotal: 21,
                finalTotal: 26,
                label: "Active",
                modifierValue: 0,
                needsEffectRow: false,
                noRollRequired: true,
                note: "combat exp active",
                openEndedD10s: [],
                resultBand: "active",
                rolledAt: "2026-01-01T00:00:30.000Z",
                roundNumber: state.roundNumber,
                skillTotal: 26,
                trigger: "combat_start",
              },
            },
      ),
    },
  };
}

function makeCombatEncounterWithResolvedCombatExperience(
  overrides: Record<string, unknown> = {},
): EncounterSession {
  return withResolvedCombatStartExperience(makeCombatEncounter(overrides)) as EncounterSession;
}

function setupCombatDeclarationRoute(
  input: {
    combatExperienceDifficulty?: number;
    combatExperienceResolved?: boolean;
    combatExperienceWindowOpen?: boolean;
    encounter?: Record<string, unknown>;
    participant?: Record<string, unknown>;
    participants?: Array<Record<string, unknown>>;
    user?: typeof mocks.playerUser | typeof mocks.adminUser;
  } = {},
) {
  const baseEncounter = makeCombatEncounter(input.encounter);
  const unresolvedEncounter =
    input.combatExperienceResolved === false && input.combatExperienceWindowOpen
      ? {
          ...baseEncounter,
          combatRoundState: setCombatRoundCombatExperienceDifficulty({
            difficulty: input.combatExperienceDifficulty ?? 26,
            state: initializeCombatRoundState({ encounter: baseEncounter as EncounterSession }),
          }),
        }
      : baseEncounter;
  const encounter =
    input.combatExperienceResolved === false
      ? unresolvedEncounter
      : withResolvedCombatStartExperience(baseEncounter);
  const participant = makeCombatScenarioParticipant(input.participant);
  const participants = input.participants
    ? input.participants.map((entry) => makeCombatScenarioParticipant(entry))
    : [participant];

  if (input.user) {
    mocks.requireAuthenticatedUser.mockResolvedValue(input.user);
  }

  mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { state: unknown }) => ({
      ...participant,
      state: update.state,
    }),
  );
  mocks.encounterService.updateEncounter.mockImplementation(
    async (update: { session: unknown }) => update.session,
  );
  mocks.scenarioService.getScenarioById.mockResolvedValue({
    campaignId: "campaign-1",
    id: "scenario-1",
    kind: "combat",
    name: "Bridge Ambush",
    status: "live",
  });
  mocks.campaignService.getCampaignById.mockResolvedValue({
    gmUserId: "gm-1",
    id: "campaign-1",
    name: "Border Trouble",
    status: "active",
  });
  mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
  mocks.scenarioService.listScenarioParticipants.mockResolvedValue(participants);

  return { encounter, participant, participants };
}

function setupMutableCombatRouteState(input: {
  encounter: EncounterSession;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
  user?: typeof mocks.playerUser | typeof mocks.adminUser;
}) {
  let currentEncounter = input.encounter;
  let currentParticipants = input.participants;

  mocks.requireAuthenticatedUser.mockResolvedValue(input.user ?? mocks.adminUser);
  mocks.requireAdminUser.mockResolvedValue(input.user ?? mocks.adminUser);
  mocks.encounterService.getEncounterById.mockImplementation(async () => currentEncounter);
  mocks.encounterService.updateEncounter.mockImplementation(
    async (update: { session: EncounterSession }) => {
      currentEncounter = update.session;
      return currentEncounter;
    },
  );
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { participantId: string; state: unknown }) => {
      const updatedParticipant = {
        ...currentParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      } as ReturnType<typeof makeCombatScenarioParticipant>;
      currentParticipants = currentParticipants.map((participant) =>
        participant.id === update.participantId ? updatedParticipant : participant,
      );

      return updatedParticipant;
    },
  );
  mocks.scenarioService.getScenarioById.mockResolvedValue({
    campaignId: "campaign-1",
    id: "scenario-1",
    kind: "combat",
    name: "Bridge Ambush",
    status: "live",
  });
  mocks.campaignService.getCampaignById.mockResolvedValue({
    gmUserId: "gm-1",
    id: "campaign-1",
    name: "Border Trouble",
    status: "active",
  });
  mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
  mocks.scenarioService.listScenarioParticipants.mockImplementation(
    async () => currentParticipants,
  );

  return {
    get encounter() {
      return currentEncounter;
    },
    get participants() {
      return currentParticipants;
    },
  };
}

function makeDistanceControlReviewFixture(): {
  encounter: EncounterSession;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
  proposalId: string;
} {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const baseEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const resolvedEncounter = withResolvedCombatStartExperience(baseEncounter) as EncounterSession;
  const baseState =
    resolvedEncounter.combatRoundState ?? initializeCombatRoundState({ encounter: baseEncounter });
  const distanceState = setDistanceBetween({
    distance: 3,
    participantAId: "encounter-participant-1",
    participantBId: "encounter-participant-2",
    source: "gm_set",
    state: baseState.distanceState,
  });
  const gladiatorDeclared = recordCombatRoundDeclaration({
    declaration: {
      movementIntent: {
        distancePreferences: [
          {
            desiredDistance: 3,
            source: "player_declared",
            targetParticipantId: "participant-2",
          },
        ],
        mode: "set_distance_preferences",
      },
      roundNumber: baseState.roundNumber,
    },
    participantId: "encounter-participant-1",
    state: { ...baseState, distanceState },
    submittedBy: "player",
  });
  const scyrianDeclared = recordCombatRoundDeclaration({
    declaration: {
      movementIntent: {
        distancePreferences: [
          {
            desiredDistance: 2,
            source: "player_declared",
            targetParticipantId: "participant-1",
          },
        ],
        mode: "set_distance_preferences",
      },
      roundNumber: baseState.roundNumber,
    },
    participantId: "encounter-participant-2",
    state: gladiatorDeclared,
    submittedBy: "player",
  });
  const reviewed = prepareCombatRoundEndReview({
    participantInputs: {
      "encounter-participant-1": {
        distanceControl: {
          dodgeSkillTotal: 8,
          generalFatigueModifier: -1,
        },
      },
      "encounter-participant-2": {
        distanceControl: {
          dodgeSkillTotal: 4,
          generalFatigueModifier: 0,
        },
      },
    },
    state: {
      ...scyrianDeclared,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    },
  });
  const proposalId = reviewed.roundEndReview?.proposedDistances[0]?.id;

  if (!proposalId) {
    throw new Error("Distance control fixture did not create a proposal.");
  }

  return {
    encounter: {
      ...resolvedEncounter,
      combatRoundState: reviewed,
      currentRound: reviewed.roundNumber,
    },
    participants: [
      makeCombatScenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          displayName: "Scyrian cavalry guy",
        },
      }),
    ],
    proposalId,
  };
}

function rollDistanceControlFixtureBothSides(input: {
  encounter: EncounterSession;
  proposalId: string;
}): CombatRoundState {
  const firstRoll = rollCombatRoundEndDistanceControl({
    command: {
      createdAt: "2026-01-01T00:11:00.000Z",
      createdByUserId: "player-1",
    },
    distanceProposalId: input.proposalId,
    participantId: "encounter-participant-1",
    roll: {
      dieResult: 10,
      openEndedD10s: [],
      rollD20: 10,
    },
    rolledBy: "player",
    state:
      input.encounter.combatRoundState ??
      initializeCombatRoundState({ encounter: input.encounter }),
  });
  const secondRoll = rollCombatRoundEndDistanceControl({
    command: {
      createdAt: "2026-01-01T00:11:30.000Z",
      createdByUserId: "gm-1",
    },
    distanceProposalId: input.proposalId,
    participantId: "encounter-participant-2",
    roll: {
      dieResult: 12,
      openEndedD10s: [],
      rollD20: 12,
    },
    rolledBy: "gm_proxy",
    state: firstRoll.state,
  });

  return secondRoll.state;
}

function commitDistanceControlFixture(input: {
  proposalId: string;
  state: CombatRoundState;
}): CombatRoundState {
  return commitCombatRoundEndDistanceControl({
    command: {
      createdAt: "2026-01-01T00:12:00.000Z",
      createdByUserId: "gm-1",
    },
    distanceProposalId: input.proposalId,
    state: input.state,
  }).state;
}

function makeHealthCheckReviewFixture(): {
  encounter: EncounterSession;
  healthRollId: string;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
} {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const baseEncounter = makeCombatEncounter({
    currentRound: 10,
    participants: encounterParticipants,
  }) as EncounterSession;
  const baseState = initializeCombatRoundState({ encounter: baseEncounter });
  const combatEffects: CombatEffectsState = {
    effects: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        damage: 0,
        effectGroup: "bleed",
        generalDamage: 0,
        id: "player-bleed",
        modifierValue: 2,
        roundNumber: 1,
        sourceEventId: "bleed-event",
        status: "active",
        targetParticipantId: "participant-1",
        type: "bleed",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    events: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        description: "Bleeding wound",
        id: "bleed-event",
        sourceLabel: "Bleeding wound",
        sourceType: "manual",
        targetParticipantId: "participant-1",
      },
    ],
  };
  const reviewed = prepareCombatRoundEndReview({
    participantInputs: {
      "encounter-participant-1": {
        combatEffects,
        healthStat: 6,
      },
    },
    state: {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 10,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    },
  });
  const healthRollId =
    reviewed.roundEndReview?.participantReviews["encounter-participant-1"]?.proposedHealthRolls[0]
      ?.id;

  if (!healthRollId) {
    throw new Error("Health check fixture did not create a pending health roll.");
  }

  return {
    encounter: {
      ...baseEncounter,
      combatRoundState: reviewed,
      currentRound: reviewed.roundNumber,
    },
    healthRollId,
    participants: [
      makeCombatScenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects,
        },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          displayName: "Scyrian cavalry guy",
        },
      }),
    ],
  };
}

function preparePhaseCombatExperienceBackOutRouteFixture(
  input: {
    gladiatorInitiative?: number;
    guardInitiative?: number;
  } = {},
): {
  encounter: EncounterSession;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
  roundState: CombatRoundState;
} {
  const encounterParticipants = [
    makeCombatEncounter().participants[0],
    {
      ...makeCombatEncounter().participants[0],
      id: "encounter-participant-2",
      label: "City guard",
      scenarioParticipantId: "participant-2",
    },
  ];
  const visibility = {
    "participant-1": { "participant-2": true },
    "participant-2": { "participant-1": true },
  };
  const baseEncounter = makeCombatEncounter({
    currentRound: 2,
    participants: encounterParticipants,
    roleplayState: {
      visibility,
    },
  }) as EncounterSession;
  const withGladiatorDeclaration = recordCombatRoundDeclaration({
    declaration: {
      actionId: "double_attack",
      phaseContexts: {
        phase1: testCombatPhaseContext("participant-2"),
        phase2: testCombatPhaseContext("participant-2"),
      },
      roundNumber: 2,
    },
    participantId: "encounter-participant-1",
    state: initializeCombatRoundState({ encounter: baseEncounter }),
    submittedBy: "gm",
  });
  const withDeclarations = recordCombatRoundDeclaration({
    declaration: {
      actionId: "double_attack",
      phaseContexts: {
        phase1: testCombatPhaseContext("participant-1"),
        phase2: testCombatPhaseContext("participant-1"),
      },
      roundNumber: 2,
    },
    participantId: "encounter-participant-2",
    state: withGladiatorDeclaration,
    submittedBy: "gm",
  });
  const phase1Initiative = advanceCombatRoundStep(advanceCombatRoundStep(withDeclarations));
  const afterGladiatorInitiative = recordCombatRoundInitiative({
    command: {
      createdAt: "2026-01-01T00:02:00.000Z",
      createdByUserId: "gm-1",
    },
    initiative: {
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [Math.min(6, input.gladiatorInitiative ?? 5)],
      rollTotal: input.gladiatorInitiative ?? 5,
      total: input.gladiatorInitiative ?? 5,
    },
    participantId: "encounter-participant-1",
    phase: "phase1",
    state: phase1Initiative,
    submittedBy: "gm",
    visibility,
  });
  const roundState = recordCombatRoundInitiative({
    command: {
      createdAt: "2026-01-01T00:02:30.000Z",
      createdByUserId: "gm-1",
    },
    initiative: {
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [Math.min(6, input.guardInitiative ?? 5)],
      rollTotal: input.guardInitiative ?? 5,
      total: input.guardInitiative ?? 5,
    },
    participantId: "encounter-participant-2",
    phase: "phase1",
    state: afterGladiatorInitiative,
    submittedBy: "gm",
    visibility,
  });
  const participants = [
    makeCombatScenarioParticipant({
      id: "participant-1",
      state: {
        ...makeCombatScenarioParticipant().state,
        combat: {
          combatContext: {
            modifierBuckets: {
              general: [],
              situationDb: [
                doubleAttackPhase1DbParryModifierEntry,
                doubleAttackPhase2DbParryModifierEntry,
              ],
              situationInitiative: [],
              situationObSkill: [
                doubleAttackPhase1ObSkillModifierEntry,
                doubleAttackPhase2ObSkillModifierEntry,
              ],
            },
          },
        },
      },
    }),
    makeCombatScenarioParticipant({
      controlledByUserId: "other-player",
      id: "participant-2",
      snapshot: {
        displayName: "City guard",
        sheetSummary: {
          draftView: {
            skills: [
              {
                effectiveSkillNumber: 7,
                linkedStatAverage: 19,
                name: "Combat Experience",
                skillId: "combat_experience",
                totalSkill: 26,
              },
            ],
          },
        },
      },
    }),
  ];

  return {
    encounter: {
      ...baseEncounter,
      combatRoundState: roundState,
      currentRound: roundState.roundNumber,
    },
    participants,
    roundState,
  };
}

describe("scenarios route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
  });

  it("lists campaigns for the authenticated game master", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByGameMaster.mockResolvedValue([campaign]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      campaigns: [campaign],
    });
    expect(mocks.campaignService.listCampaignsByGameMaster).toHaveBeenCalledWith("gm-1");
  });

  it("lists player-accessible campaigns through live scenario access only", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-live",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    };
    mocks.campaignService.listCampaignsByPlayerAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaignPlayerAccess.mockResolvedValue([scenario]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/accessible",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accessibleCampaigns: [
        {
          campaign,
          scenarios: [scenario],
        },
      ],
    });
    expect(mocks.campaignService.listCampaignsByPlayerAccess).toHaveBeenCalledWith("player-1");
    expect(mocks.scenarioService.listScenariosByCampaignPlayerAccess).toHaveBeenCalledWith(
      "campaign-1",
      "player-1",
    );
  });

  it("returns a validation error instead of calling the service for invalid campaign creation", async () => {
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        status: "active",
      },
      url: "/campaigns",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "name is required.",
    });
    expect(mocks.campaignService.createCampaign).not.toHaveBeenCalled();
  });

  it("creates a scenario under a campaign owned by the game master", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "prepared",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.createScenario.mockResolvedValue(scenario);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        kind: "combat",
        name: "Bridge Ambush",
        status: "prepared",
      },
      url: "/campaigns/campaign-1/scenarios",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scenario,
    });
    expect(mocks.scenarioService.createScenario).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      continuesFromScenarioId: undefined,
      description: undefined,
      kind: "combat",
      mapAssetId: undefined,
      name: "Bridge Ambush",
      status: "prepared",
    });
  });

  it("lists live roster-eligible scenarios for a character without campaign self-join", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.campaignService.listCampaignsByCharacterRosterAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaign.mockResolvedValue([
      {
        campaignId: "campaign-1",
        id: "scenario-live",
        kind: "mixed",
        name: "Live Scene",
        status: "live",
      },
      {
        campaignId: "campaign-1",
        id: "scenario-draft",
        kind: "mixed",
        name: "Draft Scene",
        status: "draft",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/joinable?characterId=character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      joinableScenarios: [
        {
          campaignId: "campaign-1",
          campaignName: "Border Trouble",
          kind: "mixed",
          scenarioId: "scenario-live",
          scenarioName: "Live Scene",
          status: "live",
        },
      ],
    });
    expect(mocks.campaignService.listCampaignsByCharacterRosterAccess).toHaveBeenCalledWith(
      "character-1",
    );
  });

  it("removes a campaign character roster membership by source identity", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "character-1",
      sourceType: "character",
    });
  });

  it("accepts UUID character source ids on the source-key removal route", async () => {
    const sourceId = "23831e49-9060-493d-9eaf-65667c210ce5";
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: `/campaigns/campaign-1/roster-membership/character/${sourceId}`,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId,
      sourceType: "character",
    });
  });

  it("removes a campaign template roster membership by source identity", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/template/template-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "template-1",
      sourceType: "template",
    });
  });

  it("rejects roster membership removal outside the game master's campaign", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
      error: "Campaign not found.",
      route: "source-key",
    });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).not.toHaveBeenCalled();
  });

  it("keeps query-based roster membership removal as a compatibility no-op path", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource
      .mockResolvedValueOnce({ removed: true })
      .mockResolvedValueOnce({ removed: false });
    const app = await buildScenarioTestApp();

    const firstResponse = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership?sourceType=character&sourceId=character-1",
    });
    const secondResponse = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership?sourceType=character&sourceId=character-1",
    });

    await app.close();

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({ ok: true, removed: true, route: "source-query" });
    expect(secondResponse.json()).toEqual({ ok: true, removed: false, route: "source-query" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledTimes(2);
  });

  it("treats missing source-key roster membership removal as successful and idempotent", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: false });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/missing-character",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: false, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "missing-character",
      sourceType: "character",
    });
  });

  it("returns source-key diagnostics when roster membership removal fails", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockRejectedValue(
      new Error("Synthetic delete failure"),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "CAMPAIGN_ROSTER_REMOVE_FAILED",
      details: {
        campaignId: "campaign-1",
        causeMessage: "Synthetic delete failure",
        causeName: "Error",
        route: "source-key",
        sourceId: "character-1",
        sourceType: "character",
      },
      error: "Synthetic delete failure",
      route: "source-key",
    });
  });

  it("returns a useful validation error for invalid roster source types", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/pc/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "INVALID_ROSTER_SOURCE_TYPE",
      error: "Invalid roster source type. Expected character, reusableEntity, or template.",
      route: "source-key",
    });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).not.toHaveBeenCalled();
  });

  it("allows a player-owned roster character to join a live scenario", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: {
        allowPlayerSelfJoin: false,
      },
      status: "active",
    };
    const participant = {
      characterId: "character-1",
      controlledByUserId: "player-1",
      id: "participant-1",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.characterService.getOwnedCharacter.mockResolvedValue({
      id: "character-1",
      ownerId: "player-1",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([
      {
        campaignId: "campaign-1",
        id: "roster-1",
        sourceId: "character-1",
        sourceType: "character",
      },
    ]);
    mocks.scenarioService.addCharacterParticipant.mockResolvedValue(participant);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "character-1",
        controlledByUserId: "player-1",
        joinSource: "player_joined",
        role: "player_character",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ participant });
    expect(mocks.scenarioService.addCharacterParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "character-1",
        joinSource: "player_joined",
        scenarioId: "scenario-1",
      }),
    );
  });

  it("rejects player scenario join when the character is not in the campaign roster", async () => {
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: {
        allowPlayerSelfJoin: false,
      },
      status: "active",
    });
    mocks.characterService.getOwnedCharacter.mockResolvedValue({
      id: "character-1",
      ownerId: "player-1",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "character-1",
        joinSource: "player_joined",
        role: "player_character",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "This character is not currently assigned to a campaign.",
    });
    expect(mocks.scenarioService.addCharacterParticipant).not.toHaveBeenCalled();
  });

  it("lets the scenario GM explicitly refresh a character participant equipment snapshot", async () => {
    const participant = { characterId: "character-1", id: "participant-1" };
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.refreshCharacterParticipantEquipmentSnapshot.mockResolvedValue(
      participant,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/scenarios/scenario-1/participants/participant-1/refresh-character-equipment",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ participant });
    expect(mocks.scenarioService.refreshCharacterParticipantEquipmentSnapshot).toHaveBeenCalledWith(
      { participantId: "participant-1", scenarioId: "scenario-1" },
    );
  });

  it("lists encounters for a player with scenario workspace access", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const encounter = {
      id: "encounter-1",
      name: "Courtyard",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounter]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      encounters: [encounter],
    });
    expect(mocks.scenarioService.userHasPlayerScenarioAccess).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      userId: "player-1",
    });
    expect(mocks.encounterService.listEncountersByScenario).toHaveBeenCalledWith("scenario-1");
  });

  it("returns player-safe roleplay visibility for a player's encounter", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "A slightly less new hope",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const encounter = {
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "The Gladiator",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
        {
          id: "scenario-participant-2",
          label: "City guard",
          participantType: "scenario",
          scenarioParticipantId: "participant-2",
        },
        {
          id: "scenario-participant-3",
          label: "Hidden spy",
          participantType: "scenario",
          scenarioParticipantId: "participant-3",
        },
      ],
      roleplayState: {
        actionLog: [],
        gmMessage: "The courtyard is tense.",
        participantDescriptions: {
          "scenario-participant-2": {
            detailedDescription: "Visible guard detail.",
            name: "City guard",
            shortDescription: "Armored guard",
          },
          "scenario-participant-3": {
            detailedDescription: "Hidden spy detail.",
            name: "Hidden spy",
            shortDescription: "Quiet figure",
          },
        },
        pendingSkillRolls: [],
        visibility: {
          "scenario-participant-1": {
            "scenario-participant-2": true,
          },
        },
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "A doubtful success",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "The Gladiator" },
        sourceType: "character",
      },
      {
        id: "participant-2",
        isActive: true,
        role: "npc",
        scenarioId: "scenario-1",
        snapshot: { displayName: "City guard" },
        sourceType: "entity",
      },
      {
        id: "participant-3",
        isActive: true,
        role: "npc",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Hidden spy" },
        sourceType: "entity",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.roleplayState).toMatchObject({
      participantDescriptions: {
        "scenario-participant-2": {
          detailedDescription: "Visible guard detail.",
          name: "City guard",
          shortDescription: "Armored guard",
        },
      },
      visibility: {
        "scenario-participant-1": {
          "scenario-participant-2": true,
        },
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Hidden spy detail");
  });

  it("returns projected combat history without raw events or hidden participant ids", async () => {
    const encounterParticipants = [
      {
        id: "encounter-participant-1",
        label: "Player hero",
        participantType: "scenario",
        scenarioParticipantId: "participant-1",
      },
      {
        id: "encounter-participant-2",
        label: "Visible guard",
        participantType: "scenario",
        scenarioParticipantId: "participant-2",
      },
      {
        id: "encounter-participant-hidden",
        label: "Hidden spy",
        participantType: "scenario",
        scenarioParticipantId: "participant-hidden",
      },
    ];
    const canonicalEvent = {
      completeness: "complete",
      encounterId: "encounter-1",
      facts: {
        gmReview: { privateNote: "secret override" },
        involvedOutcome: { outcome: "hit" },
        publicOutcome: {},
        rollerPrivate: { rollD20: 18, total: 22 },
      },
      id: "event-attack",
      missingFacts: [],
      occurredAt: "2026-01-01T00:01:00.000Z",
      rollerParticipantId: "encounter-participant-hidden",
      roundNumber: 1,
      schemaVersion: 1,
      sequence: 0,
      source: { kind: "canonical", sourceIds: [] },
      status: "recorded",
      step: "phase_1_actions",
      type: "attack",
      visibility: {
        identityRefs: [
          {
            hiddenIdentityFallback: "unseen_attacker",
            participantId: "encounter-participant-hidden",
            role: "attacker",
          },
          { participantId: "encounter-participant-1", role: "defender" },
        ],
        involvedParticipantIds: ["encounter-participant-hidden", "encounter-participant-1"],
        outcomeScope: "perceived",
        rollerParticipantId: "encounter-participant-hidden",
      },
    };
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        events: [canonicalEvent],
        roundNumber: 1,
      },
      participants: encounterParticipants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": {
            "encounter-participant-2": true,
          },
        },
      },
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        { controlledByUserId: "player-1", id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
        { controlledByUserId: "other-player", id: "participant-hidden" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    const encounterResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.sourceUpdatedAt).toBe(encounter.updatedAt);
    expect(response.json().history.rows).toEqual([
      { displayName: "Player hero", participantId: "encounter-participant-1" },
      { displayName: "Visible guard", participantId: "encounter-participant-2" },
    ]);
    expect(response.json().history.activeRound.events[0]).toMatchObject({
      facts: { involvedOutcome: { outcome: "hit" }, publicOutcome: {} },
      identities: expect.arrayContaining([
        { displayName: "an unseen attacker", role: "attacker", visibility: "unseen" },
      ]),
    });
    const serialized = JSON.stringify(response.json());
    expect(serialized).not.toContain("secret override");
    expect(serialized).not.toContain("rollD20");
    expect(serialized).not.toContain("encounter-participant-hidden");
    expect(response.json()).not.toHaveProperty("encounter");
    expect(encounterResponse.json().encounter.combatRoundState).toMatchObject({
      events: [],
      rounds: [],
      stepSnapshots: [],
    });
    expect(JSON.stringify(encounterResponse.json())).not.toContain("secret override");
  });

  it("returns the full projected fact groups to a GM combat-history reader", async () => {
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        events: [
          {
            completeness: "complete",
            encounterId: "encounter-1",
            facts: {
              gmReview: { privateNote: "GM fact" },
              involvedOutcome: { outcome: "hit" },
              publicOutcome: {},
              rollerPrivate: { rollD20: 18 },
            },
            id: "event-gm",
            missingFacts: [],
            occurredAt: "2026-01-01T00:01:00.000Z",
            rollerParticipantId: "encounter-participant-1",
            roundNumber: 1,
            schemaVersion: 1,
            sequence: 0,
            source: { kind: "canonical", sourceIds: [] },
            status: "recorded",
            step: "initiative_phase_1",
            type: "initiative",
            visibility: {
              identityRefs: [{ participantId: "encounter-participant-1", role: "roller" }],
              involvedParticipantIds: ["encounter-participant-1"],
              outcomeScope: "involved",
              rollerParticipantId: "encounter-participant-1",
            },
          },
        ],
        roundNumber: 1,
      },
    });
    setupCombatDeclarationRoute({ encounter, user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.activeRound.events[0].facts).toMatchObject({
      gmReview: { privateNote: "GM fact" },
      privateCalculation: { rollD20: 18 },
    });
  });

  it("lets a GM request the selected participant's player-safe history perspective", async () => {
    const participants = [
      {
        id: "encounter-participant-1",
        label: "The Gladiator",
        participantType: "scenario",
        scenarioParticipantId: "participant-1",
      },
      {
        id: "encounter-participant-2",
        label: "Other player",
        participantType: "scenario",
        scenarioParticipantId: "participant-2",
      },
    ];
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        events: [
          {
            completeness: "complete",
            encounterId: "encounter-1",
            facts: {
              gmReview: { privateNote: "GM only" },
              involvedOutcome: { hit: true },
              publicOutcome: {},
              rollerPrivate: { rollD20: 19, total: 23 },
            },
            id: "other-player-attack",
            missingFacts: [],
            occurredAt: "2026-01-01T00:01:00.000Z",
            rollerParticipantId: "encounter-participant-2",
            roundNumber: 1,
            schemaVersion: 1,
            sequence: 0,
            source: { kind: "canonical", sourceIds: [] },
            status: "recorded",
            step: "phase_1_actions",
            type: "attack",
            visibility: {
              identityRefs: [
                { participantId: "encounter-participant-2", role: "attacker" },
                { participantId: "encounter-participant-1", role: "defender" },
              ],
              involvedParticipantIds: ["encounter-participant-2", "encounter-participant-1"],
              outcomeScope: "involved",
              rollerParticipantId: "encounter-participant-2",
            },
          },
        ],
        roundNumber: 1,
      },
      participants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": { "encounter-participant-2": true },
        },
      },
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        { controlledByUserId: "player-1", id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history?perspectiveParticipantId=participant-1",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.activeRound.events[0].facts).toEqual({
      involvedOutcome: { hit: true },
      publicOutcome: {},
    });
    expect(JSON.stringify(response.json())).not.toContain("GM only");
    expect(JSON.stringify(response.json())).not.toContain("rollD20");
  });

  it("filters scenario participants for player workspace access", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const controlledParticipant = {
      controlledByUserId: "player-1",
      id: "participant-1",
      isActive: true,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Player hero",
      },
      sourceType: "character",
    };
    const otherParticipant = {
      controlledByUserId: "other-player",
      id: "participant-2",
      isActive: true,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Other hero",
      },
      sourceType: "character",
    };
    const inactiveControlledParticipant = {
      controlledByUserId: "player-1",
      id: "participant-3",
      isActive: false,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Inactive hero",
      },
      sourceType: "character",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      controlledParticipant,
      otherParticipant,
      inactiveControlledParticipant,
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      participants: [
        {
          displayName: "Player hero",
          id: "participant-1",
          isActive: true,
          isControlledByPlayer: false,
          role: "player_character",
          sourceType: "character",
        },
      ],
    });
  });

  it("creates an encounter under the path-authorized scenario and campaign", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const bodySession = {
      campaignId: "campaign-evil",
      combatRoundState: {
        currentCursor: {
          roundNumber: 2,
          step: "A1",
        },
        currentStep: "phase_1_actions",
        participants: [],
        roundNumber: 2,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 2,
      id: "encounter-1",
      scenarioId: "scenario-evil",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const encounter = {
      ...bodySession,
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.createEncounter.mockResolvedValue(encounter);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        session: bodySession,
      },
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.createEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      createdByUserId: "gm-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        campaignId: "campaign-evil",
        combatRoundState: undefined,
        currentRound: 1,
        id: "encounter-1",
        scenarioId: "scenario-evil",
      }),
    });
  });

  it("updates the path-authorized encounter instead of trusting body ids", async () => {
    const existingEncounter = {
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const bodySession = {
      campaignId: "campaign-evil",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-evil",
      scenarioId: "scenario-evil",
      title: "Renamed courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.updateEncounter.mockResolvedValue({
      ...bodySession,
      campaignId: "campaign-1",
      id: "encounter-1",
      participants: [],
      scenarioId: "scenario-1",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      payload: {
        session: bodySession,
      },
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        campaignId: "campaign-evil",
        id: "encounter-evil",
        scenarioId: "scenario-evil",
      }),
    });
  });

  it("updates encounter status through a narrow payload without requiring full encounter state", async () => {
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      status: "active",
      title: "Courtyard",
    });
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        status: "paused",
      },
      url: "/encounters/encounter-1/status",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.status).toBe("paused");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        status: "paused",
      }),
    });
    expect(mocks.scenarioService.recordScenarioEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          previousStatus: "active",
          status: "paused",
        }),
      }),
    );
  });

  it("archives an encounter through the narrow status payload", async () => {
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      status: "paused",
      title: "Courtyard",
    });
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        status: "archived",
      },
      url: "/encounters/encounter-1/status",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.status).toBe("archived");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        status: "archived",
      }),
    });
  });

  it("updates encounter participants through a narrow payload while preserving server combat state", async () => {
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participantMembershipMode: "explicit",
      status: "active",
      title: "Courtyard",
    });
    const participants = [
      {
        id: "scenario-participant-2",
        initiative: 0,
        label: "Scyrian cavalry guy",
        order: 1,
        participantType: "scenario",
        scenarioParticipantId: "participant-2",
      },
    ];
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        participantMembershipMode: "explicit",
        participants,
      },
      url: "/encounters/encounter-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.participants).toHaveLength(1);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        participantMembershipMode: "explicit",
        participants: expect.arrayContaining([
          expect.objectContaining({
            id: "scenario-participant-2",
            scenarioParticipantId: "participant-2",
          }),
        ]),
      }),
    });
  });

  it("removes encounter participants through the narrow participants payload", async () => {
    const existingParticipant = {
      id: "scenario-participant-2",
      initiative: 0,
      label: "Scyrian cavalry guy",
      order: 1,
      participantType: "scenario",
      scenarioParticipantId: "participant-2",
    };
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participantMembershipMode: "explicit",
      participants: [existingParticipant],
      status: "active",
      title: "Courtyard",
    });
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        participantMembershipMode: "explicit",
        participants: [],
      },
      url: "/encounters/encounter-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.participants).toEqual([]);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        participantMembershipMode: "explicit",
        participants: [],
      }),
    });
  });

  it("allows a player to submit their own non-silent assigned roleplay roll", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "medium",
            id: "roll-1",
            mode: "difficulty",
            otherMod: 0,
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 10,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      pendingRollId: "roll-1",
      participantId: "scenario-participant-1",
      rollD20: 12,
      silent: false,
      skillId: "perception",
      type: "gm_skill_roll",
    });
  });

  it("allows a GM to submit a selected participant's player-facing assigned roleplay roll", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const encounter = {
      actionLog: [],
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Absent hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "medium",
            id: "roll-1",
            mode: "difficulty",
            otherMod: 0,
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 10,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "other-player",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Absent hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      pendingRollId: "roll-1",
      participantId: "scenario-participant-1",
      rollD20: 12,
      silent: false,
      skillId: "perception",
      type: "gm_skill_roll",
    });
  });

  it("preserves roll set and actor side when a player submits an assigned opposed roll", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            mode: "opposed",
            otherMod: 0,
            opponentParticipantId: "scenario-participant-2",
            opponentSkillId: "brawling",
            opponentSkillLabel: "Brawling",
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            skillValue: 24,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 26,
          openEndedD10s: [6],
          rollD20: 20,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      mode: "opposed",
      pendingRollId: "roll-1",
      rollSetId: "roll-set-1",
      side: "actor",
      participantId: "scenario-participant-1",
      skillId: "dodge",
      numericSubtotal: 50,
    });
  });

  it("rejects player roleplay rolls for other-participant assignments", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-other-participant",
          label: "Other hero",
          participantType: "scenario",
          scenarioParticipantId: "other-participant",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            participantId: "scenario-other-participant",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
          },
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "silent-roll",
            participantId: "scenario-other-participant",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
      {
        controlledByUserId: "other-player",
        id: "other-participant",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Other hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows a player to declare combat action for their assigned participant during DE", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                durationRounds: 2,
                id: "gm-initiative-mod",
                notes: "Quick start",
                scope: "until",
                value: 1,
              },
            ],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            mainHandParryDirection: "left",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            offHandParryDirection: "right_forward",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [attackParryDbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [attackParryDbParryModifier],
        }),
      }),
      movementId: "hold",
      phaseContexts: {
        phase1: expect.objectContaining({
          mainHandParryDirection: "left",
        }),
        phase2: expect.objectContaining({
          offHandParryDirection: "right_forward",
        }),
      },
      roundNumber: 1,
      submittedBy: "player",
      submittedByUserId: "player-1",
    });
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      createdByUserId: "player-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("lets a GM recommit the canonical declaration during DE without duplicate phase attacks", async () => {
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: makeTwoCombatEncounterParticipants(),
    });
    const participants = [
      makeCombatScenarioParticipant(),
      makeCombatScenarioParticipant({
        controlledByUserId: "player-2",
        id: "participant-2",
        snapshot: { displayName: "City guard" },
      }),
    ];
    const mutable = setupMutableCombatRouteState({
      encounter,
      participants,
      user: mocks.adminUser,
    });
    const combatContext = makeCombatScenarioParticipant().state.combat.combatContext;
    const app = await buildScenarioTestApp();
    const submit = (input: {
      actionId: "attack_parry" | "parry_attack";
      additionalActionNotes: string;
      phase: "phase1" | "phase2";
    }) =>
      app.inject({
        method: "POST",
        payload: {
          actionId: input.actionId,
          additionalActionNotes: input.additionalActionNotes,
          combatContext,
          movementId: "hold",
          phaseContexts: {
            [input.phase]: testCombatPhaseContext("participant-2"),
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

    const first = await submit({
      actionId: "attack_parry",
      additionalActionNotes: "First draft",
      phase: "phase1",
    });
    const corrected = await submit({
      actionId: "parry_attack",
      additionalActionNotes: "Corrected draft",
      phase: "phase2",
    });

    await app.close();

    expect(first.statusCode, JSON.stringify(first.json())).toBe(200);
    expect(corrected.statusCode, JSON.stringify(corrected.json())).toBe(200);
    const state = mutable.encounter.combatRoundState!;
    const declaration = state.participants.find(
      (participant) => participant.participantId === "encounter-participant-1",
    )?.declaration;
    expect(state.currentStep).toBe("select_actions");
    expect(declaration).toMatchObject({
      actionId: "parry_attack",
      additionalActionNotes: "Corrected draft",
      submittedBy: "gm",
    });
    expect(state.commands.filter((command) => command.type === "declare_action")).toHaveLength(2);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "encounter-participant-1",
        phase: "phase2",
        state,
      }),
    ).toBe(true);
  });

  it("keeps a valid player declaration single-submit while GM progression remains at DE", async () => {
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: makeTwoCombatEncounterParticipants(),
    });
    const participants = [
      makeCombatScenarioParticipant(),
      makeCombatScenarioParticipant({
        controlledByUserId: "player-2",
        id: "participant-2",
        snapshot: { displayName: "City guard" },
      }),
    ];
    setupMutableCombatRouteState({ encounter, participants, user: mocks.playerUser });
    const combatContext = makeCombatScenarioParticipant().state.combat.combatContext;
    const app = await buildScenarioTestApp();
    const payload = {
      actionId: "attack_parry",
      combatContext,
      movementId: "hold",
      phaseContexts: {
        phase1: testCombatPhaseContext("participant-2"),
      },
      scenarioParticipantId: "participant-1",
    };

    const first = await app.inject({
      method: "POST",
      payload,
      url: "/encounters/encounter-1/combat-declaration",
    });
    const retry = await app.inject({
      method: "POST",
      payload: { ...payload, additionalActionNotes: "Player retry" },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(first.statusCode, JSON.stringify(first.json())).toBe(200);
    expect(retry.statusCode).toBe(409);
    expect(retry.json()).toMatchObject({ error: "Declaration is closed for this round." });
  });

  it("persists player-declared distance movement intent from the combat declaration route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();

    setupCombatDeclarationRoute({
      encounter: {
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "step",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "gm_proxy",
              targetParticipantId: "participant-2",
            },
          ],
          mode: "set_distance_preferences",
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;

    expect(updateStateCall.state.combat.lastMovementIntent).toEqual({
      distancePreferences: [
        {
          desiredDistance: 3,
          source: "player_declared",
          targetParticipantId: "participant-2",
        },
      ],
      mode: "set_distance_preferences",
    });
    expect(updatedEncounter.combatRoundState.participants[0].declaration.movementIntent).toEqual({
      distancePreferences: [
        {
          desiredDistance: 3,
          source: "player_declared",
          targetParticipantId: "participant-2",
        },
      ],
      mode: "set_distance_preferences",
    });
  });

  it("generates a declaration-time distance Skill/OB row for an out-of-range attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = {
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      distanceState: setDistanceBetween({
        distance: 3,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
      }),
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const distanceRows =
      updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill;
    const dbRows = updateStateCall.state.combat.combatContext.modifierBuckets.situationDb;
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;

    expect(dbRows).toEqual([attackParryDbParryModifier]);
    expect(distanceRows).toEqual([
      expect.objectContaining({
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("distance: Broad sword preferred 2"),
        sourcePhase: "phase1",
        sourceRule: "distance-ob-skill-phase1",
        value: -2,
      }),
    ]);
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual([expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 })]);
  });

  it("uses Single attack declared farther distance for the declaration-time Skill/OB row", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = {
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      distanceState: setDistanceBetween({
        distance: 2,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
      }),
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 4,
              source: "player_declared",
              targetParticipantId: "participant-2",
            },
          ],
          mode: "set_distance_preferences",
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const distanceRows =
      updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill;

    expect(distanceRows).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("declared 4"),
        value: -4,
      }),
    ]);
  });

  it("generates Scyrian's Broad sword distance row when the browser submits a scenario target id", async () => {
    const encounterParticipants = [
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-gladiator",
        id: "gladiator",
        label: "The Gladiator",
        scenarioParticipantId: "scenario-gladiator",
      },
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-scyrian",
        id: "scyrian",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "scenario-scyrian",
      },
    ];
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = {
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      distanceState: setDistanceBetween({
        distance: 3,
        participantAId: "gladiator",
        participantBId: "scyrian",
        source: "gm_set",
      }),
    };
    const scyrianParticipant = makeCombatScenarioParticipant({
      characterId: "character-scyrian",
      controlledByUserId: "other-player",
      id: "scenario-scyrian",
      role: "non_player_character",
      snapshot: {
        displayName: "Scyrian cavalry guy",
        equipmentState: makeServerWeaponEquipmentState({
          characterId: "character-scyrian",
          name: "Broad sword",
          range: "2.0",
        }),
      },
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participant: scyrianParticipant,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
          },
        }),
        scyrianParticipant,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "scenario-gladiator",
          },
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "scenario-scyrian",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const persistedCombatContext = updateStateCall.state.combat.combatContext;
    const persistedDeclaration = updatedEncounter.combatRoundState.participants[1].declaration;

    expect(updateStateCall).toMatchObject({
      participantId: "scenario-scyrian",
    });
    expect(persistedDeclaration.phaseContexts.phase1.targetParticipantId).toBe(
      "scenario-gladiator",
    );
    expect(persistedCombatContext.modifierBuckets.situationDb).toEqual([
      attackParryDbParryModifier,
    ]);
    expect(persistedCombatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining(
          "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
        ),
        sourcePhase: "phase1",
        sourceRule: "distance-ob-skill-phase1",
        value: -2,
      }),
    ]);
    expect(persistedDeclaration.combatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 }),
    ]);
  });

  it("materializes default distance before declaration so no matrix save is required", async () => {
    const encounterParticipants = [
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-gladiator",
        id: "gladiator",
        label: "The Gladiator",
        scenarioParticipantId: "scenario-gladiator",
      },
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-scyrian",
        id: "scyrian",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "scenario-scyrian",
      },
    ];
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const scyrianParticipant = makeCombatScenarioParticipant({
      characterId: "character-scyrian",
      controlledByUserId: "other-player",
      id: "scenario-scyrian",
      role: "non_player_character",
      snapshot: {
        displayName: "Scyrian cavalry guy",
        equipmentState: makeServerWeaponEquipmentState({
          characterId: "character-scyrian",
          name: "Broad sword",
          range: "2.0",
        }),
      },
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: baseEncounter.combatRoundState,
        participants: encounterParticipants,
      },
      participant: scyrianParticipant,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-gladiator",
              name: "Long sword",
              range: "3.0",
            }),
          },
        }),
        scyrianParticipant,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "scenario-gladiator",
          },
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "scenario-scyrian",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const pairKey = makeDistancePairKey("gladiator", "scyrian");
    const materializedEdge = updatedEncounter.combatRoundState.distanceState.edges[pairKey];

    expect(materializedEdge).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(materializedEdge.notes).toBeUndefined();
    expect(
      getDistanceBetween(updatedEncounter.combatRoundState.distanceState, "gladiator", "scyrian"),
    ).toBe(3);
    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationDb).toEqual([
      attackParryDbParryModifier,
    ]);
    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining(
          "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
        ),
        value: -2,
      }),
    ]);
    expect(
      updatedEncounter.combatRoundState.participants[1].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual([expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 })]);
  });

  it("allows a player to complete an incomplete submitted combat declaration during DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "select_actions",
          participants: [
            {
              attackResults: {},
              declaration: {
                actionId: "attack_parry",
                movementId: "hold",
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
                submittedByUserId: "player-1",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      phaseContexts: {
        phase1: expect.objectContaining({
          targetParticipantId: "encounter-target-1",
        }),
      },
      submittedBy: "player",
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      createdByUserId: "player-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
  });

  it("records a GM declare_action command during DE", async () => {
    setupCombatDeclarationRoute({
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      createdByUserId: "gm-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("allows a GM to roll combat-start Combat Experience and creates a General modifier row", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 10,
                  linkedStatAverage: 0,
                  skillId: "combat_experience",
                  totalSkill: 10,
                },
              ],
            },
          },
        },
      },
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      difficultyShift: 5,
      durationRounds: 4,
      effectiveTableTotal: 10,
      finalTotal: 15,
      modifierValue: -2,
      resultBand: "passive",
      rollD20: 5,
      skillTotal: 10,
      trigger: "combat_start",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].combatExperience).toMatchObject({
      durationRounds: 4,
      effectiveTableTotal: 10,
      modifierValue: -2,
      resultBand: "passive",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        difficulty: 26,
        difficultyShift: 5,
        effectiveTableTotal: 10,
        modifierValue: -2,
        skillTotal: 10,
      }),
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                description: "combat exp passive",
                duration: "4 rounds",
                effectGroup: "general",
                modifierValue: -2,
                type: "general_modifier",
              }),
            ],
          }),
        }),
      }),
    );
  });

  it("applies a GM-set Combat Experience difficulty to the outcome", async () => {
    setupCombatDeclarationRoute({
      combatExperienceDifficulty: 36,
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 19,
                  linkedStatAverage: 0,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 19,
                },
              ],
            },
          },
        },
      },
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.36);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 36,
      difficultyShift: 15,
      durationRounds: 2,
      effectiveTableTotal: 12,
      finalTotal: 27,
      modifierValue: -2,
      resultBand: "active_penalty",
      rollD20: 8,
      rollTotal: 8,
      skillTotal: 19,
      trigger: "combat_start",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        difficulty: 36,
        difficultyShift: 15,
        effectiveTableTotal: 12,
        finalTotal: 27,
        modifierValue: -2,
        resultBand: "active_penalty",
      }),
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                description: "combat exp active -2",
                duration: "2 rounds",
                effectGroup: "general",
                modifierValue: -2,
                type: "general_modifier",
              }),
            ],
          }),
        }),
      }),
    );
  });

  it("lets a player roll their own combat-start Combat Experience using the displayed total", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 14,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 21,
                },
              ],
            },
          },
        },
      },
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      effectiveTableTotal: 21,
      finalTotal: 26,
      rollD20: 5,
      skillTotal: 21,
      skillTotalSource: "participant.snapshot.sheetSummary.draftView.skills.totalSkill",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      createdByUserId: "player-1",
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
  });

  it("rejects player Combat Experience rolls before the GM opens CE rolls", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 10,
                  linkedStatAverage: 0,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 10,
                },
              ],
            },
          },
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "Combat Experience rolls are not open. Set Combat Experience difficulty first.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("rejects player Combat Experience rolls for another participant", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      encounter: {
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "City guard",
            sheetSummary: {
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 10,
                    linkedStatAverage: 0,
                    skillId: "combat_experience",
                    totalSkill: 10,
                  },
                ],
              },
            },
          },
        }),
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("lets a player roll their own round-end distance-control requirement", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const proposal = updatedEncounter.combatRoundState.roundEndReview.proposedDistances[0];
    expect(proposal).toMatchObject({
      status: "pending_rolls",
      winnerParticipantId: undefined,
    });
    expect(proposal.participantA).toMatchObject({
      result: expect.objectContaining({
        finalTotal: 12,
        rolledBy: "player",
        rolledByUserId: "player-1",
      }),
      status: "rolled",
    });
    expect(proposal.participantB).toMatchObject({
      status: "pending",
    });
    expect(proposal.participantB.result).toBeUndefined();
    const responseProposal =
      response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];
    expect(responseProposal.participantA).toMatchObject({
      desiredDistance: 3,
      result: expect.objectContaining({
        finalTotal: 12,
        rolledBy: "player",
      }),
      status: "rolled",
    });
    expect(responseProposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "pending",
    });
    expect(responseProposal.participantB.desiredDistance).toBeUndefined();
    expect(responseProposal.participantB.result).toBeUndefined();
    expect(response.json().command.facts.nextProposal.participantB.desiredDistance).toBeUndefined();
  });

  it("rejects player round-end distance-control rolls for another participant", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("lets a GM proxy each round-end distance-control side and computes the proposal after both rolls", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const firstResponse = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });
    const firstUpdatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]
      ?.session as EncounterSession;
    mocks.encounterService.getEncounterById.mockResolvedValue(firstUpdatedEncounter);
    randomSpy.mockReturnValue(0.1);
    const secondResponse = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[1]?.[0]?.session;
    const proposal = updatedEncounter.combatRoundState.roundEndReview.proposedDistances[0];
    expect(proposal).toMatchObject({
      outcome: "participant_a_wins",
      proposedDistance: 3,
      status: "rolled",
      winnerParticipantId: "encounter-participant-1",
    });
    expect(proposal.participantA.result).toMatchObject({
      rolledBy: "gm_proxy",
      rolledByUserId: "gm-1",
    });
    expect(proposal.participantB.result).toMatchObject({
      rolledBy: "gm_proxy",
      rolledByUserId: "gm-1",
    });
  });

  it("reloads an applied contested distance and starts the next round exactly once", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    const appliedState = commitDistanceControlFixture({
      proposalId: fixture.proposalId,
      state: rolledState,
    });
    const firstReview = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:13:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-1",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-1",
      state: appliedState,
    }).state;
    const completedState = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:14:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-2",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-2",
      state: firstReview,
    }).state;
    const persistedState = {
      ...JSON.parse(JSON.stringify(completedState)),
      currentCursor: { roundNumber: completedState.roundNumber, step: "SU" },
      roundEndReview: {
        ...completedState.roundEndReview,
        proposedDistances: completedState.roundEndReview?.proposedDistances.map((proposal) => ({
          ...proposal,
          // Browser reproduction: apply/event facts persisted, but this lifecycle field was stale.
          appliedDistance: undefined,
          status: "rolled",
        })),
      },
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "select_actions",
    } as CombatRoundState;
    const participantWithExpiredFeint = {
      ...fixture.participants[0],
      state: {
        ...fixture.participants[0].state,
        combat: {
          combatContext: {
            modifierBuckets: {
              general: [
                { id: "imported", imported: true, sourceType: "character_effect", value: 1 },
              ],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [
                {
                  durationRounds: 1,
                  expiresAtRound: completedState.roundNumber,
                  generated: true,
                  id: "generated:feint:old:ob",
                  sourcePhase: "phase2",
                  sourceRule: `feint:combat-feint:round:${completedState.roundNumber}:old:phase2:ob-skill`,
                  sourceType: "feint",
                  value: -2,
                },
              ],
            },
          },
        },
      },
    } as unknown as ReturnType<typeof makeCombatScenarioParticipant>;
    const lifecycle = setupMutableCombatRouteState({
      encounter: {
        ...fixture.encounter,
        combatRoundState: persistedState,
        currentRound: persistedState.roundNumber,
      },
      participants: [participantWithExpiredFeint, fixture.participants[1]],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { stepSnapshots: [] },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const nextState = response.json().encounter.combatRoundState as CombatRoundState;
    expect(nextState.roundNumber).toBe(completedState.roundNumber + 1);
    expect(nextState.rounds).toHaveLength(1);
    expect(nextState.rounds[0]?.roundNumber).toBe(completedState.roundNumber);
    expect(
      getDistanceBetween(
        nextState.distanceState,
        "encounter-participant-1",
        "encounter-participant-2",
      ),
    ).toBe(3);
    expect(lifecycle.encounter.combatRoundState?.roundNumber).toBe(completedState.roundNumber + 1);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                general: [expect.objectContaining({ id: "imported" })],
                situationObSkill: [],
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("rejects starting the next round while a resolved distance still awaits apply", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    setupMutableCombatRouteState({
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { stepSnapshots: [] },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Distance control for The Gladiator ↔ City guard must be applied before starting the next round.",
    );
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("lets a GM roll the canonical current distance-control task through a narrow route", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const staleInspectionState = {
      ...fixture.encounter.combatRoundState,
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "select_actions",
    } as CombatRoundState;
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: staleInspectionState,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/roll-current-distance-control",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Object.keys(payload).sort()).toEqual(["commandEnvelope", "encounter"]);
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    const updatedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    const proposal = updatedState.roundEndReview?.proposedDistances[0];
    expect(proposal?.participantA).toMatchObject({
      result: expect.objectContaining({
        rolledBy: "gm_proxy",
        rolledByUserId: "gm-1",
      }),
      status: "rolled",
    });
    expect(proposal?.participantB.status).toBe("pending");
    expect(updatedState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_round_end_distance_control",
    });
  });

  it("rejects players from the canonical GM distance-control route", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/roll-current-distance-control",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("returns player-safe pending distance-control proposals with own details only", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];
    const opponentRoundParticipant = response
      .json()
      .encounter.combatRoundState.participants.find(
        (participant: { participantId?: string }) =>
          participant.participantId === "encounter-participant-2",
      );

    expect(proposal).toMatchObject({
      currentDistance: 3,
      outcome: "contest_pending",
      status: "pending_rolls",
    });
    expect(proposal.participantA).toMatchObject({
      desiredDistance: 3,
      dodgeSkillTotal: 8,
      generalFatigueModifier: -1,
      status: "pending",
    });
    expect(proposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "pending",
    });
    expect(proposal.participantB.desiredDistance).toBeUndefined();
    expect(proposal.participantB.result).toBeUndefined();
    expect(proposal.proposedDistance).toBeUndefined();
    expect(proposal.winnerParticipantId).toBeUndefined();
    expect(opponentRoundParticipant?.declaration?.movementIntent).toBeUndefined();
  });

  it("hides opponent roll details and proposed outcome before distance-control commit", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];

    expect(proposal).toMatchObject({
      outcome: "contest_pending",
      status: "rolled",
    });
    expect(proposal.participantA.result).toMatchObject({
      finalTotal: 17,
      rollD20: 10,
      rollTotal: 10,
    });
    expect(proposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "rolled",
    });
    expect(proposal.participantB.desiredDistance).toBeUndefined();
    expect(proposal.participantB.result).toBeUndefined();
    expect(proposal.proposedDistance).toBeUndefined();
    expect(proposal.winnerParticipantId).toBeUndefined();
  });

  it("keeps GM distance-control live state fully visible", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];

    expect(proposal).toMatchObject({
      outcome: "participant_a_wins",
      proposedDistance: 3,
      status: "rolled",
      winnerParticipantId: "encounter-participant-1",
    });
    expect(proposal.participantB).toMatchObject({
      desiredDistance: 2,
      result: expect.objectContaining({
        finalTotal: 16,
        rollD20: 12,
        rollTotal: 12,
      }),
    });
  });

  it("returns public committed distance outcome in player-safe live state", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    const committedState = commitDistanceControlFixture({
      proposalId: fixture.proposalId,
      state: rolledState,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: committedState,
        currentRound: committedState.roundNumber,
      },
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];

    expect(proposal).toMatchObject({
      appliedDistance: 3,
      proposedDistance: 3,
      status: "committed",
    });
    expect(proposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "rolled",
    });
    expect(proposal.participantB.desiredDistance).toBeUndefined();
    expect(proposal.participantB.result).toBeUndefined();
  });

  it("lets a player roll their own round-end health check", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const healthRoll =
      updatedEncounter.combatRoundState.roundEndReview.participantReviews["encounter-participant-1"]
        .proposedHealthRolls[0];
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;

    expect(healthRoll).toMatchObject({
      result: expect.objectContaining({
        rolledBy: "player",
        rolledByUserId: "player-1",
        success: true,
      }),
      status: "rolled",
    });
    expect(
      updatedEncounter.combatRoundState.roundEndReview.participantReviews["encounter-participant-1"]
        .status,
    ).toBe("review_ready");
    expect(updatedParticipantState.combatEffects.effects[0]).toMatchObject({
      id: "player-bleed",
      modifierValue: 1,
    });
  });

  it("rejects player round-end health checks for another participant", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("lets a GM proxy a pending round-end health check", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const command = updatedEncounter.combatRoundState.commands.at(-1);
    const healthRoll =
      updatedEncounter.combatRoundState.roundEndReview.participantReviews["encounter-participant-1"]
        .proposedHealthRolls[0];

    expect(command).toMatchObject({
      facts: expect.objectContaining({
        rolledBy: "gm_proxy",
      }),
      type: "roll_round_end_health_check",
    });
    expect(healthRoll.result).toMatchObject({
      rolledBy: "gm_proxy",
      rolledByUserId: "gm-1",
    });
  });

  it("restores pending round-end health check state when the GM clears the health roll", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    const rollResponse = await app.inject({
      method: "POST",
      payload: {
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });
    const rolledEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]
      ?.session as EncounterSession;
    mocks.encounterService.getEncounterById.mockResolvedValue(rolledEncounter);
    const clearResponse = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(rollResponse.statusCode).toBe(200);
    expect(clearResponse.statusCode).toBe(200);
    const clearedEncounter = mocks.encounterService.updateEncounter.mock.calls[1]?.[0]?.session;
    const restoredReview =
      clearedEncounter.combatRoundState.roundEndReview.participantReviews[
        "encounter-participant-1"
      ];

    expect(restoredReview.status).toBe("health_roll_pending");
    expect(restoredReview.proposedHealthRolls[0]).toMatchObject({
      result: undefined,
      status: "pending",
    });
  });

  it("lets a player confirm no-roll Combat Experience when displayed skill total meets difficulty", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 19,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 26,
                },
              ],
            },
          },
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      effectiveTableTotal: 21,
      finalTotal: 26,
      modifierValue: 0,
      noRollRequired: true,
      skillTotal: 26,
      skillTotalSource: "participant.snapshot.sheetSummary.draftView.skills.totalSkill",
    });
    expect(response.json().combatExperience.rollD20).toBeUndefined();
    expect(response.json().combatExperience.rollTotal).toBeUndefined();
    expect(
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combatEffects
        .effects,
    ).toEqual([]);
  });

  it("uses the shared GM Combat Experience difficulty for player rolls", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const roundState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 36,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: roundState,
      },
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 19,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 26,
                },
              ],
            },
          },
        },
      },
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 36,
      effectiveTableTotal: 16,
      finalTotal: 31,
      noRollRequired: false,
      rollD20: 5,
      skillTotal: 26,
    });
  });

  it("lets a player submit back-out for their own phase initiative choice", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/back-out-phase-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationDb).toEqual([
      doubleAttackPhase1DbParryModifier,
      doubleAttackPhase2DbParryModifier,
    ]);
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      doubleAttackPhase1ObSkillModifier,
      doubleAttackPhase2ObSkillModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        choice: "back_out",
        reason: "Backed out while attacked",
        skippedAttack: true,
        softenedModifierIds: ["generated:double-attack:phase1:db-parry"],
        source: "phase_initiative_resolution",
      }),
      participantId: "encounter-participant-1",
      phase: "phase1",
      step: "i1",
      type: "submit_phase_initiative_choice",
    });
    expect(
      updatedEncounter.combatRoundState.commands.some(
        (command: { type: string }) => command.type === "roll_combat_experience",
      ),
    ).toBe(false);
    expect(updatedEncounter.combatRoundState.participants[0]?.stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
  });

  it("lets a higher-initiative player submit back-out without required CE", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture({
      gladiatorInitiative: 9,
      guardInitiative: 4,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/back-out-phase-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationDb).toEqual([
      doubleAttackPhase1DbParryModifier,
      doubleAttackPhase2DbParryModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        backOutAvailableReason: "attacked_while_attacking",
        ceWasRequired: false,
        choice: "back_out",
        initiativeComparison: [
          expect.objectContaining({
            attackerParticipantId: "encounter-participant-2",
            initiativeDifference: 5,
            reason: "higher_initiative",
          }),
        ],
        skippedAttack: true,
      }),
      participantId: "encounter-participant-1",
      phase: "phase1",
      step: "i1",
      type: "submit_phase_initiative_choice",
    });
    expect(
      updatedEncounter.combatRoundState.commands.some(
        (command: { type: string }) => command.type === "roll_combat_experience",
      ),
    ).toBe(false);
    expect(updatedEncounter.combatRoundState.participants[0]?.combatExperience).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0]?.stepStatuses.phase_1_actions).toBe(
      "pending",
    );
  });

  it("lets the GM commit submitted phase initiative back-out and softens the phase DB/Parry modifier", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: backedOut.state,
      },
      participants: [
        {
          ...fixture.participants[0],
          state: {
            ...fixture.participants[0]?.state,
            combat: {
              ...fixture.participants[0]?.state.combat,
              combatContext: backedOut.combatContext,
            },
          },
        },
        fixture.participants[1]!,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
      },
      url: "/encounters/encounter-1/combat-round/commit-phase-initiative-resolution",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const gladiatorUpdate = mocks.encounterService.updateScenarioParticipantState.mock.calls.find(
      ([update]) => update.participantId === "participant-1",
    )?.[0]?.state;
    expect(gladiatorUpdate.combat.combatContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "generated:double-attack:phase1:db-parry",
        value: -2,
      }),
      doubleAttackPhase2DbParryModifier,
    ]);
    expect(gladiatorUpdate.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      doubleAttackPhase1ObSkillModifier,
      doubleAttackPhase2ObSkillModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        appliedChoices: expect.arrayContaining([
          expect.objectContaining({
            choice: "back_out",
            participantId: "encounter-participant-1",
          }),
        ]),
        source: "phase_initiative_resolution_commit",
      }),
      phase: "phase1",
      type: "commit_phase_initiative_resolution",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toMatchObject({
      phase: "phase1",
      substep: "attack",
    });
    expect(updatedEncounter.combatRoundState.participants[0]?.stepStatuses.phase_1_actions).toBe(
      "skipped",
    );
  });

  it("returns a canonical command envelope opening Reactive A2 after i2 commit", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      currentRound: 5,
      participants: encounterParticipants,
    });
    const baseState = initializeCombatRoundState({ encounter: combatEncounter });
    const withDeclarations = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-1"),
        },
        roundNumber: baseState.roundNumber,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "parry_attack",
          phaseContexts: {
            phase2: testCombatPhaseContext("participant-2"),
          },
          roundNumber: baseState.roundNumber,
        },
        participantId: "encounter-participant-1",
        state: baseState,
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const withGladiatorM1Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      state: withDeclarations,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const withScyrianM1Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:10.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      state: withGladiatorM1Reviewed,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const atI1 = advanceCombatRoundStep(withScyrianM1Reviewed);
    const withGladiatorI1 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: atI1,
      submittedBy: "gm",
    });
    const atI1Review = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:10.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 7,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: withGladiatorI1,
      submittedBy: "gm",
    });
    const atA1 = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:02:20.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase1",
      state: atI1Review,
    }).state;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-2",
      defenderDb: 13,
      defenderParticipantId: "encounter-participant-1",
      ob: 10,
      phase: "phase1",
      rollD20: 5,
      rollTotal: 5,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterA1 = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      result: attackResult,
      state: atA1,
      submittedBy: "gm",
    });
    const withGladiatorM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      state: afterA1,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const withScyrianM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:40.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      state: withGladiatorM2Reviewed,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const atI2 = advanceCombatRoundStep(withScyrianM2Reviewed);
    const withScyrianI2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 5,
      participantId: "encounter-participant-2",
      phase: "phase2",
      state: atI2,
      submittedBy: "gm",
    });
    const afterI2Rolls = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:10.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 8,
      participantId: "encounter-participant-1",
      phase: "phase2",
      state: withScyrianI2,
      submittedBy: "gm",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterI2Rolls,
        currentRound: afterI2Rolls.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: { displayName: "Scyrian cavalry guy" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase2",
      },
      url: "/encounters/encounter-1/combat-round/commit-phase-initiative-resolution",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedEncounter = payload.encounter;

    expect(payload.commandEnvelope).toMatchObject({
      currentTask: {
        cursorStep: "A2",
        participantId: "encounter-participant-1",
        step: "phase_2_actions",
      },
      latestResult: {
        kind: "phase_initiative_commit",
        phase: "phase2",
      },
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(updatedEncounter).toMatchObject({
      id: "encounter-1",
      combatRoundState: expect.objectContaining({
        currentStep: "phase_2_actions",
      }),
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toMatchObject({
      participantId: "encounter-participant-1",
      step: "A2",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_2_actions");
    expect(
      combatRoundParticipantWasAttackedInPhase({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state: updatedEncounter.combatRoundState,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "encounter-participant-1",
        phase: "phase2",
        state: updatedEncounter.combatRoundState,
      }),
    ).toBe(true);
  });

  it("advances the current combat round step through a narrow command route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const reviewState: CombatRoundState = {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "M1",
      },
      currentStep: "review_action_modifiers",
      participants: baseState.participants.map((participant) => ({
        ...participant,
        stepStatuses: {
          ...participant.stepStatuses,
          select_actions: "submitted",
        },
      })),
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "review_action_modifiers",
    };
    const stepSnapshot = {
      committedAt: "2026-01-01T00:02:00.000Z",
      id: "1:encounter-participant-1:review_action_modifiers",
      modifierSummary: {
        dbRaw: 0,
        generalFatigueRaw: 0,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [],
      },
      participantId: "encounter-participant-1",
      participantLabel: "The Gladiator",
      roundNumber: reviewState.roundNumber,
      step: "review_action_modifiers",
    };

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: reviewState,
        currentRound: reviewState.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        },
        {
          id: "participant-2",
          snapshot: { displayName: "City guard" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        stepSnapshots: [stepSnapshot],
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedEncounter = payload.encounter;

    expect(payload).toHaveProperty("encounter");
    expect(payload.commandEnvelope).toMatchObject({
      currentStep: "initiative_phase_1",
      currentTask: {
        cursorStep: "i1",
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(updatedEncounter.combatRoundState).toMatchObject({
      currentStep: "initiative_phase_1",
      stepSnapshots: expect.arrayContaining([expect.objectContaining(stepSnapshot)]),
    });
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          combatRoundState: expect.objectContaining({
            currentStep: "initiative_phase_1",
          }),
        }),
      }),
    );
  });

  it("prepares round-end review from persisted state without a request payload", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const summaryState: CombatRoundState = {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: summaryState,
        currentRound: summaryState.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1", snapshot: { displayName: "The Gladiator" } },
        { id: "participant-2", snapshot: { displayName: "City guard" } },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/prepare-round-end-review",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.combatRoundState.roundEndReview).toMatchObject({
      roundNumber: summaryState.roundNumber,
    });
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          combatRoundState: expect.objectContaining({
            roundEndReview: expect.objectContaining({ roundNumber: summaryState.roundNumber }),
          }),
        }),
      }),
    );
  });

  it("skips the canonical current phase action through a narrow command route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const openState = {
      ...makeOpenPhase1AttackRoundState(),
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "round_summary",
    } as unknown as CombatRoundState;

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: openState,
        currentRound: openState.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        },
        {
          id: "participant-2",
          snapshot: { displayName: "City guard" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/skip-current-action",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedState = payload.encounter.combatRoundState as CombatRoundState;

    expect(payload).toHaveProperty("encounter");
    expect(payload.commandEnvelope).toMatchObject({
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(updatedState.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facts: expect.objectContaining({
            phase: "phase1",
            status: "skipped",
          }),
          participantId: "encounter-participant-1",
          step: "A1",
          type: "skip_phase_action",
        }),
      ]),
    );
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "encounter-participant-1",
        state: updatedState,
        step: "phase_1_actions",
      }),
    ).toBe("skipped");
    expect(updatedState.commands).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: "encounter-participant-2",
          type: "skip_phase_action",
        }),
      ]),
    );
  });

  it("rejects player phase attack back-out for another participant", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/back-out-phase-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
  });

  it("hides other participants' pending phase initiative choices from player encounter state", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const ownChoice = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    const otherChoice = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[1]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "other-player",
      },
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: ownChoice.state,
      updatedAt: "2026-01-01T00:03:30.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: otherChoice.state,
      },
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const phaseChoiceCommands = response
      .json()
      .encounter.combatRoundState.commands.filter(
        (command: { type: string }) => command.type === "submit_phase_initiative_choice",
      );
    expect(
      phaseChoiceCommands.map((command: { participantId: string }) => command.participantId),
    ).toEqual(["encounter-participant-1"]);
  });

  it("keeps all pending phase initiative choices in GM encounter state", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const ownChoice = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    const otherChoice = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[1]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "other-player",
      },
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: ownChoice.state,
      updatedAt: "2026-01-01T00:03:30.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: otherChoice.state,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const phaseChoiceCommands = response
      .json()
      .encounter.combatRoundState.commands.filter(
        (command: { type: string }) => command.type === "submit_phase_initiative_choice",
      );
    expect(
      phaseChoiceCommands.map((command: { participantId: string }) => command.participantId),
    ).toEqual(["encounter-participant-1", "encounter-participant-2"]);
  });

  it("clears a committed phase initiative back-out and restores the generated DB/Parry modifier", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    const committed = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      participants: {
        "encounter-participant-1": {
          combatContext: backedOut.combatContext,
          scenarioParticipantId: "participant-1",
          skillTotal: 26,
        },
        "encounter-participant-2": {
          combatContext: fixture.participants[1]!.state.combat.combatContext,
          scenarioParticipantId: "participant-2",
          skillTotal: 26,
        },
      },
      phase: "phase1",
      rng: () => 0.8,
      state: backedOut.state,
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    const committedGladiatorContext =
      committed.combatContextsByParticipantId["encounter-participant-1"] ?? backedOut.combatContext;

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: committed.state,
      },
      participants: [
        {
          ...fixture.participants[0],
          state: {
            ...fixture.participants[0]?.state,
            combat: {
              ...fixture.participants[0]?.state.combat,
              combatContext: committedGladiatorContext,
            },
          },
        },
        fixture.participants[1]!,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationDb).toEqual([
      doubleAttackPhase1DbParryModifier,
      doubleAttackPhase2DbParryModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 2,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
  });

  it("stores GM-edited Combat Experience difficulty on the active round", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        difficulty: 36,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().difficulty).toBe(36);
    expect(response.json().windowOpen).toBe(true);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.combatExperienceDifficulty).toBe(36);
  });

  it("lets the GM set a shared pairwise combat distance", async () => {
    const baseEncounter = makeCombatEncounter();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        participants: [
          baseEncounter.participants[0],
          {
            ...baseEncounter.participants[0],
            id: "encounter-participant-2",
            label: "City guard",
            scenarioParticipantId: "participant-2",
          },
        ],
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distance: 4,
        participantAId: "encounter-participant-2",
        participantBId: "encounter-participant-1",
      },
      url: "/encounters/encounter-1/combat-round/pair-distance",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().edge).toMatchObject({
      distance: 4,
      participantAId: "encounter-participant-1",
      participantBId: "encounter-participant-2",
      source: "gm_set",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.distanceState.edges).toMatchObject({
      "encounter-participant-1::encounter-participant-2": expect.objectContaining({
        distance: 4,
      }),
    });
  });

  it("recomputes visible declaration distance modifiers after a GM distance edit", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: baseEncounter }),
      submittedBy: "player",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          id: "participant-1",
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distance: 3,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
      },
      url: "/encounters/encounter-1/combat-round/pair-distance",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;

    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("distance: Broad sword preferred 2"),
        value: -2,
      }),
    ]);
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual([expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 })]);
    expect(response.json().participants).toHaveLength(1);
  });

  it("returns player-safe visible pair distances without unrelated hidden pairs", async () => {
    const baseEncounter = makeCombatEncounter();
    const combatEncounter = makeCombatEncounter({
      participants: [
        baseEncounter.participants[0],
        {
          ...baseEncounter.participants[0],
          id: "encounter-participant-2",
          label: "Scyrian cavalry guy",
          scenarioParticipantId: "participant-2",
        },
        {
          ...baseEncounter.participants[0],
          id: "encounter-participant-3",
          label: "Hidden scout",
          scenarioParticipantId: "participant-3",
        },
      ],
      roleplayState: {
        actionLog: [],
        participantDescriptions: {},
        pendingSkillRolls: [],
        visibility: {
          "encounter-participant-1": {
            "encounter-participant-2": true,
          },
        },
      },
    }) as EncounterSession;
    const roundState = initializeCombatRoundState({ encounter: combatEncounter });
    const visibleDistanceState = setDistanceBetween({
      distance: 3,
      participantAId: "encounter-participant-1",
      participantBId: "encounter-participant-2",
      source: "gm_set",
      state: roundState.distanceState,
    });
    const distanceState = setDistanceBetween({
      distance: 4,
      participantAId: "encounter-participant-1",
      participantBId: "encounter-participant-3",
      source: "gm_set",
      state: visibleDistanceState,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...combatEncounter,
        combatRoundState: {
          ...roundState,
          distanceState,
        },
      },
      participants: [
        makeCombatScenarioParticipant({
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        }),
        makeCombatScenarioParticipant({
          controlledByUserId: undefined,
          id: "participant-2",
          role: "npc",
          snapshot: { displayName: "Scyrian cavalry guy" },
          sourceType: "entity",
        }),
        makeCombatScenarioParticipant({
          controlledByUserId: undefined,
          id: "participant-3",
          role: "npc",
          snapshot: { displayName: "Hidden scout" },
          sourceType: "entity",
        }),
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.combatRoundState.distanceState.edges).toMatchObject({
      "encounter-participant-1::encounter-participant-2": expect.objectContaining({
        distance: 3,
      }),
    });
    expect(
      response.json().encounter.combatRoundState.distanceState.edges[
        "encounter-participant-1::encounter-participant-3"
      ],
    ).toBeUndefined();
  });

  it("returns materialized default pair distances from active server equipment without a GM save", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: [
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-gladiator",
          id: "gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-gladiator",
        },
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-scyrian",
          id: "scyrian",
          label: "Scyrian cavalry guy",
          scenarioParticipantId: "scenario-scyrian",
        },
      ],
    }) as EncounterSession;

    setupCombatDeclarationRoute({
      encounter: combatEncounter,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-gladiator",
              name: "Long sword",
              range: "3.0",
            }),
          },
        }),
        makeCombatScenarioParticipant({
          characterId: "character-scyrian",
          controlledByUserId: undefined,
          id: "scenario-scyrian",
          role: "npc",
          snapshot: {
            displayName: "Scyrian cavalry guy",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-scyrian",
              name: "Broad sword",
              range: "2.0",
            }),
          },
          sourceType: "entity",
        }),
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const distanceState = response.json().encounter.combatRoundState.distanceState;
    const edge = distanceState.edges[makeDistancePairKey("gladiator", "scyrian")];

    expect(edge).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(edge.notes).toBeUndefined();
    expect(getDistanceBetween(distanceState, "gladiator", "scyrian")).toBe(3);
  });

  it("returns player-safe materialized default pair distances without a GM save", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: [
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-gladiator",
          id: "gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-gladiator",
        },
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-scyrian",
          id: "scyrian",
          label: "Scyrian cavalry guy",
          scenarioParticipantId: "scenario-scyrian",
        },
      ],
      roleplayState: {
        actionLog: [],
        participantDescriptions: {},
        pendingSkillRolls: [],
        visibility: {
          gladiator: {
            scyrian: true,
          },
        },
      },
    }) as EncounterSession;

    setupCombatDeclarationRoute({
      encounter: combatEncounter,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          controlledByUserId: "player-1",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-gladiator",
              name: "Long sword",
              range: "3.0",
            }),
          },
        }),
        makeCombatScenarioParticipant({
          characterId: "character-scyrian",
          controlledByUserId: undefined,
          id: "scenario-scyrian",
          role: "npc",
          snapshot: {
            displayName: "Scyrian cavalry guy",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-scyrian",
              name: "Broad sword",
              range: "2.0",
            }),
          },
          sourceType: "entity",
        }),
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const safeDistanceState = response.json().encounter.combatRoundState.distanceState;

    expect(getDistanceBetween(safeDistanceState, "gladiator", "scyrian")).toBe(3);
    expect(safeDistanceState.edges[makeDistancePairKey("gladiator", "scyrian")]).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
  });

  it("rejects player attempts to set pairwise combat distance", async () => {
    const baseEncounter = makeCombatEncounter();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        participants: [
          baseEncounter.participants[0],
          {
            ...baseEncounter.participants[0],
            id: "encounter-participant-2",
            label: "City guard",
            scenarioParticipantId: "participant-2",
          },
        ],
      },
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distance: 4,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
      },
      url: "/encounters/encounter-1/combat-round/pair-distance",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects GM Combat Experience difficulty changes after a CE result exists", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const openedRoundState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
    });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      skillTotal: 26,
      state: openedRoundState,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: rolled.state,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        difficulty: 36,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error:
        "Combat Experience difficulty cannot be changed after rolls have been recorded. Clear Combat Experience results first.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("uses the live character sheet displayed Combat Experience total when the participant snapshot omits skill data", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        characterId: "character-1",
        snapshot: {
          displayName: "The Gladiator",
        },
      },
      user: mocks.adminUser,
    });
    mocks.characterService.getCharacterById.mockResolvedValue({
      build: makeCombatExperienceCharacterBuild(),
      id: "character-1",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.characterService.getCharacterById).toHaveBeenCalledWith("character-1");
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      difficultyShift: 5,
      durationRounds: 0,
      effectiveTableTotal: 21,
      finalTotal: 26,
      modifierValue: 0,
      noRollRequired: false,
      resultBand: "active",
      rollD20: 5,
      rollTotal: 5,
      skillTotal: 21,
      skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
      trigger: "combat_start",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        difficulty: 26,
        difficultyShift: 5,
        effectiveTableTotal: 21,
        finalTotal: 26,
        rollTotal: 5,
        skillTotal: 21,
        skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
      }),
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
    expect(
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combatEffects
        .effects,
    ).toEqual([]);
  });

  it("rejects attack declarations without the required phase target", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 1.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects GM Double Attack declarations unless both attack phases have targets", async () => {
    setupCombatDeclarationRoute({ user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        phaseAttackSources: {
          phase1: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_1",
            templateId: "virtual-weapon-template-punch",
          }),
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-kick",
          }),
        },
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 2.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("normalizes the browser scenario-participant Feint target into the encounter command identity", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "City guard",
            sheetSummary: {
              adjustedStats: { dex: 9, int: 12 },
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 6,
                    name: "Brawling",
                    skillId: "brawling",
                    totalSkill: 18,
                  },
                ],
              },
            },
          },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        additionalActionNotes: "A quick change of footing.",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        feint: {
          attackerSkillId: "dodge",
          method: "movement",
          targetParticipantId: "participant-2",
        },
        phaseAttackSources: {
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-punch",
          }),
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
          phase2: testCombatPhaseContext("stale-participant"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const declaration = updatedEncounter.combatRoundState.participants[0].declaration;
    expect(declaration).toMatchObject({
      actionId: "feint_attack",
      attackOpportunities: [
        expect.objectContaining({
          origin: "feint_attack",
          phase: "phase2",
          slot: "attack_2",
          targetParticipantId: "encounter-participant-2",
        }),
      ],
      feint: {
        attackerSkillId: "dodge",
        defenderSkillId: "brawling",
        method: "movement",
        targetParticipantId: "encounter-participant-2",
      },
      phaseContexts: {
        phase1: expect.objectContaining({
          targetParticipantId: "encounter-participant-2",
        }),
        phase2: expect.objectContaining({
          targetParticipantId: "encounter-participant-2",
        }),
      },
    });
    expect(updatedEncounter.combatRoundState.feintProposals).toEqual([
      expect.objectContaining({
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        method: "movement",
        status: "awaiting_action_turn",
      }),
    ]);
  });

  it("derives a weapon Feint skill from the committed source instead of client input", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const weaponParticipant = makeDoubleAttackWeaponParticipant("weapon-template-dagger");
    const weaponTemplate = weaponTemplates.find(
      (candidate) => candidate.id === "weapon-template-dagger",
    );
    if (!weaponTemplate) throw new Error("Missing dagger fixture.");
    const modeId = weaponTemplate.attackModes?.[0]?.id;
    if (!modeId) throw new Error("Missing fencing sword mode fixture.");
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [
        {
          ...weaponParticipant,
          snapshot: {
            ...weaponParticipant.snapshot,
            sheetSummary: {
              adjustedStats: { dex: 12, int: 9 },
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 8,
                    name: weaponTemplate.weaponSkill,
                    skillId: "one_handed_edged",
                    totalSkill: 24,
                  },
                ],
              },
            },
          },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "City guard",
            sheetSummary: {
              adjustedStats: { dex: 9, int: 12 },
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 6,
                    name: "Brawling",
                    skillId: "brawling",
                    totalSkill: 18,
                  },
                ],
              },
            },
          },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-dagger";
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        feint: {
          attackerSkillId: "unrelated-client-skill",
          method: "weapon",
          targetParticipantId: "participant-2",
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            attackModeId: modeId,
            itemId,
            opportunitySlot: "attack_1",
            templateId: weaponTemplate.id,
          }),
          phase2: makeWeaponAttackSourceRef({
            attackModeId: modeId,
            itemId,
            opportunitySlot: "attack_2",
            templateId: weaponTemplate.id,
          }),
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
          phase2: testCombatPhaseContext("participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const declaration =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .participants[0].declaration;
    expect(declaration.feint).toMatchObject({
      attackerSkillId: "one_handed_edged",
      attackerSkillLabel: weaponTemplate.weaponSkill,
      method: "weapon",
    });
    expect(declaration.phaseContexts.phase1.targetParticipantId).toBe("encounter-participant-2");
    expect(declaration.phaseContexts.phase2.targetParticipantId).toBe("encounter-participant-2");
    expect(declaration.attackOpportunities[0].targetParticipantId).toBe("encounter-participant-2");
    expect(declaration.feint.attackerSkillId).not.toBe("unrelated-client-skill");
  });

  it("rejects a genuinely missing Feint target with the player-facing target error", async () => {
    setupCombatDeclarationRoute({ user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        feint: {
          attackerSkillId: "dodge",
          method: "movement",
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-2"),
          phase2: testCombatPhaseContext("encounter-participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Select a target for the Feint." });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects Adjust Range - Attack without a Phase 2 target", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select an opponent for Adjust Distance-Attack.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("normalizes one Adjust Distance target and persists the A1 proposal plus A2 attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [{ id: "participant-1" }, { id: "participant-2" }],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        adjustDistance: {
          requestedDistance: 1,
          targetParticipantId: "participant-2",
        },
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-punch",
          }),
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
          phase2: testCombatPhaseContext("participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const roundState =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState;
    expect(roundState.participants[0].declaration).toMatchObject({
      actionId: "adjust_range_attack",
      adjustDistance: {
        requestedDistance: 1,
        targetParticipantId: "encounter-participant-2",
      },
      attackOpportunities: [
        expect.objectContaining({
          origin: "adjust_range_attack",
          phase: "phase2",
          targetParticipantId: "encounter-participant-2",
        }),
      ],
      phaseContexts: {
        phase1: expect.objectContaining({ targetParticipantId: "encounter-participant-2" }),
        phase2: expect.objectContaining({ targetParticipantId: "encounter-participant-2" }),
      },
    });
    expect(roundState.adjustDistanceProposals).toEqual([
      expect.objectContaining({
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        requestedDistance: 1,
        status: "awaiting_action_turn",
      }),
    ]);
  });

  it("creates the phase 2 DB/Parry modifier when a player declares Reactive attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "parry_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [parryAttackDbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "parry_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [parryAttackDbParryModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("creates phase 1 and phase 2 Skill/OB and DB/Parry modifiers when a player declares Double Attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        phaseAttackSources: {
          phase1: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_1",
            templateId: "virtual-weapon-template-punch",
          }),
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-kick",
          }),
        },
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "double_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [doubleAttackPhase1DbParryModifier, doubleAttackPhase2DbParryModifier],
                situationObSkill: [
                  doubleAttackPhase1ObSkillModifier,
                  doubleAttackPhase2ObSkillModifier,
                ],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "double_attack",
      attackOpportunities: [
        expect.objectContaining({ attackModeId: "mode-1", phase: "phase1", slot: "attack_1" }),
        expect.objectContaining({ attackModeId: "mode-1", phase: "phase2", slot: "attack_2" }),
      ],
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [doubleAttackPhase1DbParryModifier, doubleAttackPhase2DbParryModifier],
          situationObSkill: [doubleAttackPhase1ObSkillModifier, doubleAttackPhase2ObSkillModifier],
        }),
      }),
      roundNumber: 1,
      phaseContexts: {
        phase1: expect.objectContaining({ attackModeId: "mode-1" }),
        phase2: expect.objectContaining({ attackModeId: "mode-1" }),
      },
      submittedBy: "player",
    });
  });

  it("persists the selected eligible mode for both same-source Double Attack opportunities", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-dagger";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_2",
            templateId: "weapon-template-dagger",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    const declaration =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .participants[0].declaration;
    expect(declaration.phaseContexts).toMatchObject({
      phase1: { attackModeId: "mode-1" },
      phase2: { attackModeId: "mode-1" },
    });
    expect(declaration.attackOpportunities).toEqual([
      expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_1" }),
      expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_2" }),
    ]);
  });

  it.each([
    ["distinct committed weapons", "scenario-main-gauche", "secondary"],
    ["the same committed repeated-thrust weapon", "scenario-fencing-sword", "primary"],
  ] as const)(
    "accepts browser-equivalent scenario source references for %s",
    async (_label, phase2ItemId, phase2Slot) => {
      setupCombatDeclarationRoute({ participant: makeDoubleAttackTwoWeaponParticipant() });
      const app = await buildScenarioTestApp();
      const phase2TemplateId =
        phase2ItemId === "scenario-fencing-sword"
          ? "weapon-template-fencing-sword"
          : "weapon-template-main-gauche";

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "double_attack",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          phaseAttackSources: {
            phase1: makeWeaponAttackSourceRef({
              itemId: "scenario-fencing-sword",
              opportunitySlot: "attack_1",
              slot: "primary",
              templateId: "weapon-template-fencing-sword",
            }),
            phase2: makeWeaponAttackSourceRef({
              attackModeId: phase2ItemId === "scenario-main-gauche" ? "mode-2" : "mode-1",
              itemId: phase2ItemId,
              opportunitySlot: "attack_2",
              slot: phase2Slot,
              templateId: phase2TemplateId,
            }),
          },
          phaseContexts: {
            phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
            phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      await app.close();
      expect(response.statusCode).toBe(200);
      expect(
        mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
          .participants[0].declaration.attackOpportunities,
      ).toEqual([
        expect.objectContaining({ itemId: "scenario-fencing-sword", slot: "attack_1" }),
        expect.objectContaining({ itemId: phase2ItemId, slot: "attack_2" }),
      ]);
    },
  );

  it("rejects an external or template ID submitted in place of a scenario item ID", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackTwoWeaponParticipant() });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "weapon-template-fencing-sword",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-fencing-sword",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId: "scenario-main-gauche",
            opportunitySlot: "attack_2",
            slot: "secondary",
            templateId: "weapon-template-main-gauche",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "The selected Phase 1 weapon source is missing.",
    });
  });

  it.each([
    ["1-h Javelin", "weapon-template-1-h-javelin"],
    ["Rapier", "weapon-template-rapier"],
  ])(
    "accepts the committed ready %s source for both Double Attack phases",
    async (_label, templateId) => {
      setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant(templateId) });
      const app = await buildScenarioTestApp();
      const itemId = `item-${templateId}`;

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "double_attack",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          phaseAttackSources: {
            phase1: makeWeaponAttackSourceRef({
              itemId,
              opportunitySlot: "attack_1",
              templateId,
            }),
            phase2: makeWeaponAttackSourceRef({
              itemId,
              opportunitySlot: "attack_2",
              templateId,
            }),
          },
          phaseContexts: {
            phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
            phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      await app.close();
      expect(response.statusCode).toBe(200);
      expect(
        mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
          .participants[0].declaration.attackOpportunities,
      ).toEqual([
        expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_1" }),
        expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_2" }),
      ]);
    },
  );

  it("distinguishes a missing Double Attack source from an unready equipped item", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const missingSourceApp = await buildScenarioTestApp();
    const basePayload = {
      actionId: "double_attack",
      combatContext: { modifierBuckets: emptyModifierBuckets() },
      phaseContexts: {
        phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
      },
      scenarioParticipantId: "participant-1",
    };
    const missingSource = await missingSourceApp.inject({
      method: "POST",
      payload: {
        ...basePayload,
        phaseAttackSources: {
          phase2: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-dagger",
            opportunitySlot: "attack_2",
            templateId: "weapon-template-dagger",
          }),
        },
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await missingSourceApp.close();

    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const unreadySourceApp = await buildScenarioTestApp();
    const unreadySource = await unreadySourceApp.inject({
      method: "POST",
      payload: {
        ...basePayload,
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "unready-item-weapon-template-dagger",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId: "unready-item-weapon-template-dagger",
            opportunitySlot: "attack_2",
            templateId: "weapon-template-dagger",
          }),
        },
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await unreadySourceApp.close();

    expect(missingSource.json()).toEqual({
      error: "Double Attack requires an attack source for both phases.",
    });
    expect(unreadySource.json()).toEqual({
      error: "The selected Phase 1 weapon is not ready.",
    });
  });

  it("distinguishes an invalid Double Attack mode from source readiness", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-dagger";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
          phase2: {
            ...makeWeaponAttackSourceRef({
              itemId,
              opportunitySlot: "attack_2",
              templateId: "weapon-template-dagger",
            }),
            attackModeId: "missing-mode",
          },
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Dagger does not have the selected Phase 2 attack mode.",
    });
  });

  it("creates only the phase 1 DB/Parry risk when declaring a closer Adjust Distance-Attack", async () => {
    setupCombatDeclarationRoute({
      encounter: { participants: makeTwoCombatEncounterParticipants() },
      participants: [{ id: "participant-1" }, { id: "participant-2" }],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        adjustDistance: {
          requestedDistance: 1,
          targetParticipantId: "participant-2",
        },
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseAttackSources: {
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-punch",
          }),
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "adjust_range_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [adjustRangePhase1DbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "adjust_range_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [adjustRangePhase1DbParryModifier],
        }),
      }),
      phaseContexts: {
        phase1: expect.any(Object),
        phase2: expect.objectContaining({
          targetParticipantId: "encounter-participant-2",
        }),
      },
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("preserves existing combat modifier buckets when a player declares", async () => {
    setupCombatDeclarationRoute({
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [
                  {
                    id: "gm-db-mod",
                    notes: "GM cover",
                    scope: "until",
                    value: 2,
                  },
                ],
                situationInitiative: [
                  {
                    durationRounds: 2,
                    id: "gm-initiative-mod",
                    notes: "Ready",
                    scope: "until",
                    value: 1,
                  },
                ],
                situationObSkill: [
                  {
                    id: "gm-ob-mod",
                    notes: "GM footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
            },
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [
              {
                id: "player-db-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
            situationInitiative: [
              {
                id: "player-initiative-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
            situationObSkill: [
              {
                id: "player-ob-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
          },
          selectedOpponentId: "guard",
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: {
                general: [],
                situationDb: [
                  {
                    id: "gm-db-mod",
                    notes: "GM cover",
                    scope: "until",
                    value: 2,
                  },
                  attackParryDbParryModifier,
                ],
                situationInitiative: [
                  {
                    durationRounds: 2,
                    id: "gm-initiative-mod",
                    notes: "Ready",
                    scope: "until",
                    value: 1,
                  },
                ],
                situationObSkill: [
                  {
                    id: "gm-ob-mod",
                    notes: "GM footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
              selectedOpponentId: "guard",
            }),
          }),
        }),
      }),
    );
  });

  it("allows a GM to declare combat action for another player's participant after DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                durationRounds: 2,
                id: "gm-initiative-mod",
                notes: "Quick start",
                scope: "until",
                value: 1,
              },
            ],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_action_modifiers");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "gmEdited",
    );
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [attackParryDbParryModifier],
          situationInitiative: [
            {
              durationRounds: 2,
              id: "gm-initiative-mod",
              notes: "Quick start",
              scope: "until",
              value: 1,
            },
          ],
        }),
      }),
      roundNumber: 1,
      submittedBy: "gm",
      submittedByUserId: "gm-1",
    });
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("gmEdited");
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "M1",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "M1",
      },
      type: "review_modifiers_phase1",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("allows a GM to declare Reactive attack for another player's participant after DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "parry_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [parryAttackDbParryModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "gm",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [parryAttackDbParryModifier],
              }),
            }),
            lastDeclaredActionId: "parry_attack",
            lastDeclaredEncounterId: "encounter-1",
          }),
        }),
      }),
    );
  });

  it("allows a GM to review and override generated phase 2 modifiers", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_phase_2_modifiers",
          participants: [
            {
              declaration: {
                actionId: "parry_attack",
                combatContext: {
                  modifierBuckets: {
                    general: [],
                    situationDb: [parryAttackDbParryModifierEntry],
                    situationInitiative: [],
                    situationObSkill: [],
                  },
                },
                phaseContexts: {
                  phase2: testCombatPhaseContext("encounter-target-1"),
                },
                roundNumber: 1,
                submittedBy: "gm",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                generated: true,
                id: "generated:parry-attack:phase2:initiative",
                notes: "GM reviewed reactive attack",
                scope: "until",
                sourceActionId: "parry_attack",
                sourcePhase: "phase2",
                sourceRule: "parry-attack-phase2-initiative",
                value: 5,
              },
            ],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase2: testCombatPhaseContext("encounter-target-1"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_phase_2_modifiers,
    ).toBe("gmEdited");
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationInitiative,
    ).toEqual([
      expect.objectContaining({
        id: "generated:parry-attack:phase2:initiative",
        notes: "GM reviewed reactive attack",
        value: 5,
      }),
    ]);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "M2",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "M2",
      },
      type: "review_modifiers_phase2",
    });
  });

  it("keeps Reactive attack executable through the browser/API persisted lifecycle", async () => {
    const encounterParticipants = [
      makeEncounterCombatParticipant({
        id: "encounter-participant-1",
        label: "The Gladiator",
        order: 0,
        scenarioParticipantId: "participant-1",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-2",
        label: "Scyrian cavalry guy",
        order: 1,
        scenarioParticipantId: "participant-2",
      }),
    ];
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const baseRoundState =
      baseEncounter.combatRoundState ?? initializeCombatRoundState({ encounter: baseEncounter });
    const combatRoundState = {
      ...baseRoundState,
      distanceState: setDistanceBetween({
        distance: 2,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
        state: baseRoundState.distanceState,
      }),
    };
    const fixture = setupMutableCombatRouteState({
      encounter: {
        ...baseEncounter,
        combatRoundState,
        currentRound: combatRoundState.roundNumber,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          characterId: "character-1",
          id: "participant-1",
          snapshot: {
            displayName: "The Gladiator",
          },
          weaponName: "Long sword",
          weaponRange: "3.0",
        }),
        makeCombatScenarioParticipantWithWeapon({
          characterId: "character-2",
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "Scyrian cavalry guy",
          },
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const emptyCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const roundState = () => fixture.encounter.combatRoundState as CombatRoundState;
    const participantState = (participantId: string) =>
      roundState().participants.find((participant) => participant.participantId === participantId);
    const commitCurrentStepViaBrowserPut = async () => {
      const startingStep = roundState().currentStep;

      for (let index = 0; index <= encounterParticipants.length; index += 1) {
        const current = roundState();
        const committedAt = `2026-01-01T00:10:0${index}.000Z`;
        const stateForCommit =
          current.currentStep === "review_phase_2_modifiers"
            ? ensureCombatRoundPhaseResolutionResultsForPhase({
                phase: "phase1",
                state: current,
                updatedAt: committedAt,
              })
            : current;
        const nextState = advanceCombatRoundStep(stateForCommit, {
          command: {
            createdAt: committedAt,
            participantId:
              stateForCommit.currentCursor?.participantId ??
              stateForCommit.selectedParticipantId ??
              "encounter-participant-1",
          },
          stepSnapshots: [],
        });
        const response = await app.inject({
          method: "PUT",
          payload: {
            session: {
              ...fixture.encounter,
              combatRoundState: nextState,
              currentRound: nextState.roundNumber,
            },
          },
          url: "/encounters/encounter-1",
        });

        expect(response.statusCode).toBe(200);

        if (roundState().currentStep !== startingStep) {
          return;
        }
      }
    };
    const rollInitiative = async (scenarioParticipantId: string, initiativeBase = 0) => {
      const response = await app.inject({
        method: "POST",
        payload: {
          initiativeBase,
          scenarioParticipantId,
        },
        url: "/encounters/encounter-1/combat-initiative",
      });

      expect(response.statusCode).toBe(200);
    };
    const commitPhaseInitiative = async (phase: "phase1" | "phase2") => {
      const response = await app.inject({
        method: "POST",
        payload: { phase },
        url: "/encounters/encounter-1/combat-round/commit-phase-initiative-resolution",
      });

      expect(response.statusCode).toBe(200);
    };

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const gladiatorDeclarationResponse = await app.inject({
        method: "POST",
        payload: {
          actionId: "parry_attack",
          combatContext: emptyCombatContext,
          movementId: "set_preferred_distance",
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 3,
                source: "gm_proxy",
                targetParticipantId: "participant-2",
              },
            ],
            mode: "set_distance_preferences",
          },
          phaseContexts: {
            phase2: testCombatPhaseContext("participant-2"),
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      const scyrianDeclarationResponse = await app.inject({
        method: "POST",
        payload: {
          actionId: "attack_parry",
          combatContext: emptyCombatContext,
          movementId: "hold",
          phaseContexts: {
            phase1: testCombatPhaseContext("participant-1"),
          },
          scenarioParticipantId: "participant-2",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      expect(
        gladiatorDeclarationResponse.statusCode,
        JSON.stringify(gladiatorDeclarationResponse.json()),
      ).toBe(200);
      expect(
        scyrianDeclarationResponse.statusCode,
        JSON.stringify(scyrianDeclarationResponse.json()),
      ).toBe(200);
      expect(participantState("encounter-participant-1")?.declaration).toMatchObject({
        actionId: "parry_attack",
        phaseContexts: {
          phase2: {
            targetParticipantId: "participant-2",
          },
        },
      });
      expect(participantState("encounter-participant-2")?.declaration).toMatchObject({
        actionId: "attack_parry",
        phaseContexts: {
          phase1: {
            targetParticipantId: "participant-1",
          },
        },
      });
      expect(
        participantState("encounter-participant-1")?.declaration?.combatContext?.modifierBuckets
          .situationDb,
      ).toEqual([parryAttackDbParryModifier]);
      expect(
        participantState("encounter-participant-1")?.declaration?.combatContext?.modifierBuckets
          .situationInitiative,
      ).toEqual([
        expect.objectContaining({
          id: "generated:parry-attack:phase2:initiative",
          sourceRule: "parry-attack-phase2-initiative",
          value: 6,
        }),
      ]);
      await commitCurrentStepViaBrowserPut();
      expect(roundState().currentStep).toBe("review_action_modifiers");
      await commitCurrentStepViaBrowserPut();
      expect(roundState().currentStep).toBe("initiative_phase_1");
      expect(
        participantState("encounter-participant-1")?.declaration?.phaseContexts?.phase2,
      ).toMatchObject({
        targetParticipantId: "participant-2",
      });

      await rollInitiative("participant-1");
      await rollInitiative("participant-2");
      expect(roundState().currentStep).toBe("initiative_phase_1");

      await commitPhaseInitiative("phase1");
      expect(roundState().currentStep).toBe("phase_1_actions");
      expect(roundState().currentCursor).toMatchObject({
        participantId: "encounter-participant-2",
        step: "A1",
      });
      expect(
        getCombatRoundParticipantPhaseStepStatus({
          participantId: "encounter-participant-1",
          state: roundState(),
          step: "phase_1_actions",
        }),
      ).toBe("skipped");

      const attackResponse = await app.inject({
        method: "POST",
        payload: {
          defenderDb: 99,
          defenderDbParryRaw: 0,
          defenderScenarioParticipantId: "participant-1",
          ob: 0,
          obSkillRaw: 0,
          phase: "phase1",
          scenarioParticipantId: "participant-2",
          weaponName: "Broad sword",
        },
        url: "/encounters/encounter-1/combat-round/roll-attack",
      });

      expect(attackResponse.statusCode).toBe(200);
      expect(
        getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: "encounter-participant-2",
          phase: "phase1",
          state: roundState(),
        }),
      ).toMatchObject({
        attackerParticipantId: "encounter-participant-2",
        defenderParticipantId: "encounter-participant-1",
        hit: false,
      });
      expect(
        getCombatRoundParticipantPhaseStepStatus({
          participantId: "encounter-participant-2",
          state: roundState(),
          step: "phase_1_actions",
        }),
      ).toBe("gmEdited");
      expect(roundState().commands.at(-1)).toMatchObject({
        participantId: "encounter-participant-2",
        type: "roll_attack",
      });
      expect(
        combatRoundParticipantWasAttackedInPhase({
          participantId: "encounter-participant-1",
          phase: "phase1",
          state: roundState(),
        }),
      ).toBe(true);
      expect(
        participantState("encounter-participant-1")?.declaration?.combatContext?.modifierBuckets
          .situationInitiative,
      ).toEqual([
        expect.objectContaining({
          id: "generated:parry-attack:phase2:initiative",
          notes: "reactive attack: phase 1 attack missed; no parry needed",
          value: 6,
        }),
      ]);

      expect(roundState().currentStep).toBe("review_phase_2_modifiers");
      for (const [scenarioParticipantId, roundParticipantId] of [
        ["participant-1", "encounter-participant-1"],
        ["participant-2", "encounter-participant-2"],
      ] as const) {
        const declaration = participantState(roundParticipantId)?.declaration;
        const reviewResponse = await app.inject({
          method: "POST",
          payload: {
            actionId: declaration?.actionId,
            combatContext: declaration?.combatContext ?? emptyCombatContext,
            movementId: declaration?.movementId,
            movementIntent: declaration?.movementIntent,
            phaseContexts: declaration?.phaseContexts,
            scenarioParticipantId,
            secondaryActionId: declaration?.secondaryActionId,
          },
          url: "/encounters/encounter-1/combat-declaration",
        });

        expect(reviewResponse.statusCode, JSON.stringify(reviewResponse.json())).toBe(200);
        expect(
          getCombatRoundOutgoingAttackResultForParticipantPhase({
            participantId: "encounter-participant-2",
            phase: "phase1",
            state: roundState(),
          }),
        ).toMatchObject({ hit: false });
      }

      await commitCurrentStepViaBrowserPut();
      expect(roundState().currentStep).toBe("initiative_phase_2");
      expect(
        participantState("encounter-participant-1")?.declaration?.phaseContexts?.phase2,
      ).toMatchObject({
        targetParticipantId: "participant-2",
      });
      expect(
        combatRoundParticipantHasExecutablePhaseAttack({
          participantId: "encounter-participant-1",
          phase: "phase2",
          state: roundState(),
        }),
      ).toBe(true);

      await rollInitiative("participant-1", 6);
      await rollInitiative("participant-2");
      expect(roundState().currentStep).toBe("initiative_phase_2");

      await commitPhaseInitiative("phase2");
      expect(roundState().currentStep).toBe("phase_2_actions");
      expect(roundState().currentCursor).toMatchObject({
        participantId: "encounter-participant-1",
        step: "A2",
      });
      expect(roundState().roundEndReview).toBeUndefined();
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("rejects a player combat declaration after DE has advanced", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationObSkill: [],
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows a player to roll phase 1 initiative for their assigned participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [{ id: "general-not-initiative", scope: "until", value: -99 }],
                situationDb: [],
                situationInitiative: [
                  {
                    id: "import:character_effect:initiative-penalty:initiative",
                    imported: true,
                    readOnly: true,
                    scope: "until",
                    sourceEffectId: "initiative-penalty",
                    sourceType: "character_effect",
                    value: -1,
                  },
                ],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        initiativeBase: 3,
        initiativeModifierAdjustment: -1,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().initiative.total).toBeGreaterThanOrEqual(1);
    expect(response.json().initiative.rolls.length).toBeGreaterThanOrEqual(1);
    expect(response.json().initiative.baseInitiative).toBe(3);
    expect(response.json().initiative.modifierAdjustment).toBe(-1);
    expect(response.json().initiative.total).toBe(
      response.json().initiative.baseInitiative +
        response.json().initiative.modifierAdjustment +
        response.json().initiative.rollTotal,
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      rolls: response.json().initiative.rolls,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.initiative_phase_1).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "i1",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "i1",
      },
      participantId: "encounter-participant-1",
      type: "roll_initiative_phase1",
    });
    expect(updatedEncounter.combatRoundState.events[0].facts.rollerPrivate).toMatchObject({
      baseInitiative: 3,
      modifierAdjustment: -1,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
  });

  it("allows a GM to roll initiative for another player's participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_2",
          participants: [
            {
              initiatives: { phase1: { rolls: [6, 6], total: 12 } },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "complete",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [{ id: "general-not-initiative", scope: "until", value: -99 }],
                situationDb: [],
                situationInitiative: [
                  {
                    id: "import:character_effect:initiative-bonus:initiative",
                    imported: true,
                    readOnly: true,
                    scope: "until",
                    sourceEffectId: "initiative-bonus",
                    sourceType: "character_effect",
                    value: 2,
                  },
                  {
                    generated: true,
                    id: "generated-phase2",
                    scope: "until",
                    sourcePhase: "phase2",
                    value: 3,
                  },
                  { id: "manual-initiative", scope: "until", value: 1 },
                  {
                    generated: true,
                    id: "generated-phase1",
                    scope: "until",
                    sourcePhase: "phase1",
                    value: 99,
                  },
                ],
                situationObSkill: [],
              },
            },
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        initiativeBase: 10,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().initiative).toMatchObject({
      baseInitiative: 10,
      modifierAdjustment: 6,
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase2).toMatchObject({
      rolls: response.json().initiative.rolls,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.initiative_phase_2).toBe(
      "gmEdited",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "i2",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "i2",
      },
      type: "roll_initiative_phase2",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_2");
  });

  it("rejects player initiative rolls for another participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          participants: [
            {
              initiatives: {},
              label: "Other hero",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        controlledByUserId: "other-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows the current attacking player to roll the open phase 1 attack once", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const stepStatuses = {
      initiative_phase_1: "submitted",
      initiative_phase_2: "pending",
      phase_1_actions: "submitted",
      phase_2_actions: "pending",
      review_action_modifiers: "complete",
      review_phase_2_actions: "pending",
      review_phase_2_damage: "pending",
      review_phase_2_modifiers: "pending",
      round_summary: "pending",
      select_actions: "submitted",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          commands: [
            {
              afterCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i1",
              },
              beforeCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i1",
              },
              createdAt: "2026-01-01T00:01:30.000Z",
              facts: {},
              id: "command-i1",
              participantId: "encounter-participant-1",
              roundNumber: 1,
              step: "i1",
              type: "roll_initiative_phase1",
            },
          ],
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: [
            {
              attackResults: {},
              declaration: {
                actionId: "attack_parry",
                phaseContexts: {
                  phase1: {
                    targetParticipantId: "participant-2",
                  },
                },
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
              },
              initiatives: {
                phase1: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [6],
                  rollTotal: 6,
                  total: 6,
                },
              },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses,
            },
            {
              attackResults: {},
              initiatives: {
                phase1: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [4],
                  rollTotal: 4,
                  total: 4,
                },
              },
              label: "City guard",
              participantId: "encounter-participant-2",
              stepStatuses,
            },
          ],
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase1",
            substep: "attack",
          },
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          roundNumber: 1,
          stepSnapshots: [
            {
              attackSummary: {
                attackMode: "C",
                dmb: "8",
                initiative: "3",
                maxCrits: "FS",
                ob: "10",
                weaponName: "Long sword",
              },
              committedAt: "2026-01-01T00:02:00.000Z",
              id: "snapshot-attack",
              participantId: "encounter-participant-1",
              participantLabel: "The Gladiator",
              phase: "phase1",
              roundNumber: 1,
              step: "phase_1_actions",
            },
            {
              committedAt: "2026-01-01T00:02:00.000Z",
              defenseSummary: {
                db: "11",
                dm: "0",
                parry: "9",
                sourceName: "Sword / shield",
              },
              id: "snapshot-defense",
              participantId: "encounter-participant-2",
              participantLabel: "City guard",
              phase: "phase1",
              roundNumber: 1,
              step: "phase_1_actions",
            },
          ],
        },
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;
    expect(attackResult).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 11,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      weaponName: "Long sword",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        obSkillRaw: 0,
      },
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(
      updatedEncounter.combatRoundState.commands.at(-1)?.facts.distanceModifier,
    ).toBeUndefined();
    expect(payload.command).toMatchObject({
      facts: expect.objectContaining({
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
      }),
      type: "roll_attack",
    });
    expect(payload.commandEnvelope).toMatchObject({
      latestEvent: expect.objectContaining({
        resultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        shortTitle: "Attack rolled",
      }),
      latestResult: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        kind: "attack",
        phase: "phase1",
      },
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload.encounter).toMatchObject({
      id: "encounter-1",
      combatRoundState: expect.objectContaining({
        currentStep: expect.any(String),
      }),
    });
    expect(payload.encounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      phase: "phase1",
    });
  });

  it("rejects a new live attack that omits the required Skill/OB total", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState(),
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        { id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 999,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "obSkillRaw must be an integer." });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it.each([
    ["player", mocks.playerUser],
    ["GM proxy", mocks.adminUser],
  ])("uses canonical Skill/OB for a %s attack", async (_label, user) => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const attackerState = makeCanonicalAttackModifierParticipantState();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({ snapshotOb: "10" }),
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1", state: attackerState },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
      user,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 14,
        obSkillRaw: 2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      ob: 14,
      phase: "phase1",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        obSkillRaw: 2,
      },
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.events.at(-1)?.facts.rollerPrivate).toMatchObject({
      ob: 14,
    });
  });

  it("rejects a live attack when the submitted Skill/OB total is stale", async () => {
    const attackerState = makeCanonicalAttackModifierParticipantState();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState(),
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        { id: "participant-1", state: attackerState },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 14,
        obSkillRaw: 1,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Attack modifiers changed. Refresh combat before rolling.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("uses the existing generated distance Skill/OB row for the current player phase 1 attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const distanceModifierEntry = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      notes: "distance: Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -4,
    };
    const participantState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [distanceModifierEntry],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({
          distance: 5,
          modifierEntries: [distanceModifierEntry],
          snapshotOb: "6",
        }),
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1", state: participantState },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 6,
        obSkillRaw: -4,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;

    expect(attackResult).toMatchObject({
      ob: 6,
      phase: "phase1",
      weaponName: "Long sword",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        distanceModifier: {
          createdCombatModifierIds: [],
          modifierId: "generated:distance:phase1:ob-skill",
          notes: "distance: Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
          preferredDistances: [],
          value: -4,
        },
      },
      type: "roll_attack",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("applies a persisted generated distance row when the attack snapshot OB is stale", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const distanceModifierEntry = {
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
    const participantState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [distanceModifierEntry],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({
          distance: 3,
          snapshotOb: "12",
          snapshotWeaponName: "Broad sword",
        }),
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-1",
        state: participantState,
      },
      participants: [
        {
          id: "participant-1",
          state: participantState,
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;

    expect(attackResult).toMatchObject({
      ob: 10,
      phase: "phase1",
      weaponName: "Broad sword",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)?.facts.distanceModifier).toMatchObject(
      {
        modifierId: "generated:distance:phase1:ob-skill",
        notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
        value: -2,
      },
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("does not replace or duplicate generated distance rows in the attack route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const staleDistanceModifier = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -2,
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({
          distance: 5,
          modifierEntries: [staleDistanceModifier],
          snapshotOb: "8",
        }),
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [staleDistanceModifier],
              },
            },
          },
        },
      },
      participants: [
        {
          id: "participant-1",
          state: {
            ...makeCombatScenarioParticipant().state,
            combat: {
              combatContext: {
                modifierBuckets: {
                  general: [],
                  situationDb: [],
                  situationInitiative: [],
                  situationObSkill: [staleDistanceModifier],
                },
              },
            },
          },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 8,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;

    expect(attackResult.ob).toBe(8);
    expect(updatedEncounter.combatRoundState.commands.at(-1)?.facts.distanceModifier).toMatchObject(
      {
        createdCombatModifierIds: [],
        modifierId: "generated:distance:phase1:ob-skill",
        value: -2,
      },
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("resolves the canonical encounter target when rolling an open Feint phase 2 attack", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const stepStatuses = {
      initiative_phase_1: "submitted",
      initiative_phase_2: "submitted",
      phase_1_actions: "complete",
      phase_2_actions: "submitted",
      review_action_modifiers: "complete",
      review_phase_2_actions: "complete",
      review_phase_2_damage: "pending",
      review_phase_2_modifiers: "complete",
      round_summary: "pending",
      select_actions: "submitted",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          commands: [
            {
              afterCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i2",
              },
              beforeCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i2",
              },
              createdAt: "2026-01-01T00:01:30.000Z",
              facts: {},
              id: "command-i2",
              participantId: "encounter-participant-1",
              roundNumber: 1,
              step: "i2",
              type: "roll_initiative_phase2",
            },
          ],
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "A2",
          },
          currentStep: "phase_2_actions",
          participants: [
            {
              attackResults: {},
              declaration: {
                actionId: "feint_attack",
                attackOpportunities: [
                  {
                    id: "feint-a2",
                    origin: "feint_attack",
                    phase: "phase2",
                    slot: "attack_2",
                    status: "committed",
                    targetParticipantId: "encounter-participant-2",
                  },
                ],
                feint: {
                  attackerSkillId: "dodge",
                  attackerSkillLabel: "Dodge",
                  defenderSkillId: "one-handed-edged",
                  defenderSkillLabel: "1-h edged",
                  method: "movement",
                  targetParticipantId: "encounter-participant-2",
                },
                phaseContexts: {
                  phase1: {},
                  phase2: {},
                },
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
              },
              initiatives: {
                phase2: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [6],
                  rollTotal: 6,
                  total: 6,
                },
              },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses,
            },
            {
              attackResults: {
                phase1: {
                  actionId: "attack_parry",
                  attackerParticipantId: "encounter-participant-2",
                  defenderDb: 10,
                  defenderParryModifier: 0,
                  defenderParticipantId: "encounter-participant-1",
                  grazing: false,
                  hit: false,
                  kind: "attackRoll",
                  lookupTotal: 8,
                  marginOverMissThreshold: -2,
                  ob: 10,
                  openEndedD10s: [],
                  phase: "phase1",
                  rollD20: 8,
                  rollTotal: 8,
                  rolledAt: "2026-01-01T00:01:00.000Z",
                  tableResult: "Miss",
                  weaponName: "Long sword",
                },
              },
              initiatives: {
                phase2: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [4],
                  rollTotal: 4,
                  total: 4,
                },
              },
              label: "City guard",
              participantId: "encounter-participant-2",
              stepStatuses,
            },
          ],
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase2",
            substep: "attack",
          },
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          roundNumber: 1,
          stepSnapshots: [
            {
              attackSummary: {
                attackMode: "P",
                dmb: "6",
                initiative: "3",
                maxCrits: "EP",
                ob: "9",
                weaponName: "Long sword",
              },
              committedAt: "2026-01-01T00:02:00.000Z",
              id: "snapshot-attack-phase-2",
              participantId: "encounter-participant-1",
              participantLabel: "The Gladiator",
              phase: "phase2",
              roundNumber: 1,
              step: "phase_2_actions",
            },
            {
              committedAt: "2026-01-01T00:02:00.000Z",
              defenseSummary: {
                db: "11",
                dm: "0",
                parry: "9",
                sourceName: "Sword / shield",
              },
              id: "snapshot-defense-phase-2",
              modifierSummary: {
                dbRaw: -2,
                generalFatigueRaw: 0,
                initiativeRaw: 0,
                obSkillRaw: 0,
                rows: [],
              },
              participantId: "encounter-participant-2",
              participantLabel: "City guard",
              phase: "phase2",
              roundNumber: 1,
              step: "phase_2_actions",
            },
          ],
        },
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          state: {
            ...makeCombatScenarioParticipant().state,
            combat: {
              combatContext: {
                modifierBuckets: {
                  general: [{ id: "general-not-defense", scope: "until", value: 99 }],
                  situationDb: [
                    {
                      id: "import:character_effect:defense-2:db_parry",
                      imported: true,
                      readOnly: true,
                      scope: "until",
                      sourceEffectId: "defense-2",
                      sourceType: "character_effect",
                      value: -2,
                    },
                  ],
                  situationInitiative: [],
                  situationObSkill: [],
                },
              },
            },
          },
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderParticipantId: "encounter-participant-2",
        ob: 9,
        obSkillRaw: 0,
        phase: "phase2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase2;
    expect(attackResult).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 11,
      defenderParticipantId: "encounter-participant-2",
      ob: 9,
      phase: "phase2",
      weaponName: "Long sword",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        attackResultId: "1:phase2:encounter-participant-1:encounter-participant-2",
      },
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
  });

  it("rejects duplicate player attack rolls for the same current phase action", async () => {
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 11,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: [
            {
              attackResults: {
                phase1: attackResult,
              },
              declaration: {
                actionId: "attack_parry",
                phaseContexts: {
                  phase1: {
                    targetParticipantId: "participant-2",
                  },
                },
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                phase_1_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
        participants: [
          makeCombatEncounter().participants[0],
          {
            ...makeCombatEncounter().participants[0],
            id: "encounter-participant-2",
            label: "City guard",
            scenarioParticipantId: "participant-2",
          },
        ],
      },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows the current defending player to roll the open phase 1 parry once", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterAttackWithStaleInspection: CombatRoundState = {
      ...afterAttack,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1",
    };
    const canonicalDefenderState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [{ id: "general-not-defense", scope: "until", value: 99 }],
            situationDb: [
              {
                id: "import:character_effect:defense-1:db_parry",
                imported: true,
                readOnly: true,
                scope: "until",
                sourceEffectId: "defense-1",
                sourceType: "character_effect",
                value: -2,
              },
              {
                generated: true,
                id: "generated-defense",
                scope: "until",
                sourcePhase: "phase1",
                value: -1,
              },
              { id: "manual-defense", scope: "until", value: 1 },
            ],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterAttackWithStaleInspection,
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-2",
        state: canonicalDefenderState,
      },
      participants: [
        {
          controlledByUserId: "other-player",
          id: "participant-1",
        },
        {
          controlledByUserId: "player-1",
          id: "participant-2",
          state: canonicalDefenderState,
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const parryPayload = {
      attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
      parryBase: 13,
      parrySourceLabel: "Sword / shield",
      scenarioParticipantId: "participant-2",
      usedMainHand: true,
      usedOffHand: true,
    };
    const missingRawResponse = await app.inject({
      method: "POST",
      payload: parryPayload,
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });
    const staleRawResponse = await app.inject({
      method: "POST",
      payload: { ...parryPayload, dbParryRaw: -3 },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        ...parryPayload,
        dbParryRaw: -2,
      },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });

    await app.close();

    expect(missingRawResponse.statusCode).toBe(400);
    expect(staleRawResponse.statusCode).toBe(409);
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.commandEnvelope).toMatchObject({
      latestResult: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        defenderParticipantId: "encounter-participant-2",
        kind: "parry",
        phase: "phase1",
      },
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        defenderParticipantId: "encounter-participant-2",
      }),
      participantId: "encounter-participant-2",
      type: "roll_parry",
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.parryResolution,
    ).toMatchObject({
      combinedParryScore: 13,
      modifierBreakdown: [{ label: "DB/Parry", value: -2 }],
      parrySourceLabel: "Sword / shield",
      status: "resolved",
    });
  });

  it("advances current phase resolution through a narrow GM route using canonical cursor", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const stateWithStaleInspection: CombatRoundState = {
      ...afterAttack,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithStaleInspection,
        participants: encounterParticipants,
      },
      participants: [
        {
          controlledByUserId: "other-player",
          id: "participant-1",
        },
        {
          controlledByUserId: "player-1",
          id: "participant-2",
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/advance-current-phase-resolution",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedState = payload.encounter.combatRoundState as CombatRoundState;

    expect(payload.commandEnvelope).toMatchObject({
      currentCursor: {
        participantId: "encounter-participant-2",
        step: "D1",
      },
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(updatedState.phaseResolutionCursor).toMatchObject({
      participantId: "encounter-participant-2",
      phase: "phase1",
      substep: "damage",
    });
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "encounter-participant-2",
        state: updatedState,
        step: "phase_1_damage",
      }),
    ).toBe("pending");
  });

  it("commits the canonical current damage review through a narrow GM route", async () => {
    const fixture = makeCriticalRollMutationFixture();
    const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.state,
    });

    expect(attackResult).toBeDefined();
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: attackResult!,
      command: {
        createdAt: "2026-01-01T00:05:45.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "encounter-participant-1",
      state: fixture.state,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:45.000Z",
    });
    const stateWithStaleInspection: CombatRoundState = {
      ...afterCritical,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithStaleInspection,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        review: {
          additionalEffects: [],
          notes: "Reviewed by GM",
          operationalConsequences: [],
        },
      },
      url: "/encounters/encounter-1/combat-round/commit-phase-damage",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Object.keys(payload).sort()).toEqual(["commandEnvelope", "encounter"]);
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload.commandEnvelope.currentCursor).not.toEqual(
      expect.objectContaining({ step: "round_summary" }),
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-2",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: expect.arrayContaining([
              expect.objectContaining({ targetParticipantId: "participant-2" }),
            ]),
          }),
        }),
      }),
    );
    const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    expect(savedState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-2",
      type: "commit_phase_damage",
    });
  });

  it("saves the canonical current damage review without committing effects", async () => {
    const fixture = makeCriticalRollMutationFixture();
    const stateWithStaleInspection: CombatRoundState = {
      ...fixture.state,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithStaleInspection,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        review: {
          additionalEffects: [],
          notes: "Saved current review",
          operationalConsequences: [],
          totalDamageOverride: 7,
        },
      },
      url: "/encounters/encounter-1/combat-round/save-damage-review",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Object.keys(payload).sort()).toEqual(["commandEnvelope", "encounter"]);
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload.commandEnvelope.currentCursor).toMatchObject({
      participantId: "encounter-participant-2",
      step: "D1",
    });
    const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    const savedResolution = savedState.phaseResolutionResults.find(
      (result) => result.attackResultId === fixture.attackResultId,
    );
    expect(savedResolution?.damageResult?.review).toMatchObject({
      notes: "Saved current review",
      reviewedByUserId: "gm-1",
      totalDamageOverride: 7,
    });
    expect(savedResolution?.damageProposal.status).toBe("drafted");
    expect(savedState.commands.some((command) => command.type === "commit_phase_damage")).toBe(
      false,
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("rejects player use of the GM damage review save route", async () => {
    setupCombatDeclarationRoute({ user: mocks.playerUser });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { review: {} },
      url: "/encounters/encounter-1/combat-round/save-damage-review",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("rejects player use of the GM phase damage commit route", async () => {
    setupCombatDeclarationRoute({ user: mocks.playerUser });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { review: {} },
      url: "/encounters/encounter-1/combat-round/commit-phase-damage",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("completes current phase resolution through a narrow GM route using canonical cursor", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const stateWithStaleInspection = {
      ...makeOpenPhase1AttackRoundState(),
      currentCursor: {
        participantId: "encounter-participant-2",
        roundNumber: 1,
        step: "A1",
      },
      phaseResolutionCursor: {
        participantId: "encounter-participant-2",
        phase: "phase1",
        substep: "effects",
      },
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1",
    } as unknown as CombatRoundState;

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithStaleInspection,
        participants: encounterParticipants,
      },
      participants: [
        {
          controlledByUserId: "other-player",
          id: "participant-1",
        },
        {
          controlledByUserId: "player-1",
          id: "participant-2",
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/complete-current-phase-resolution",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedState = payload.encounter.combatRoundState as CombatRoundState;

    expect(payload.commandEnvelope).toMatchObject({
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(
      getCombatRoundParticipantPhaseStepStatus({
        participantId: "encounter-participant-2",
        state: updatedState,
        step: "phase_1_actions",
      }),
    ).toBe("skipped");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          combatRoundState: expect.any(Object),
          currentRound: updatedState.roundNumber,
        }),
      }),
    );
  });

  it("allows the attacking player to roll hit location for a pending D1 result", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterParry,
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-hit-location",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        rolledByParticipantId: "encounter-participant-1",
        rollPrivilege: "attacker",
      }),
      participantId: "encounter-participant-2",
      type: "roll_hit_location",
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.hitLocationRoll.status,
    ).toBe("rolled");
  });

  it("drafts damage from player hit-location roll when combat snapshots are available", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        characterId: "guard-character",
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          displayName: "City guard",
          equipmentState: {
            activeLoadoutByCharacterId: {
              "guard-character": {
                wornArmorItemId: "armor-item-test-coverage",
              },
            },
            itemsById: {
              "armor-item-test-coverage": {
                id: "armor-item-test-coverage",
                templateId: "armor-template-test-coverage",
              },
            },
            locationsById: {},
            templates: {
              templatesById: {
                "armor-template-test-coverage": {
                  category: "armor",
                  criticalModifierByArea: {
                    abdomen: 1,
                    backArm: 1,
                    backFoot: 1,
                    backThigh: 1,
                    chest: 1,
                    frontArm: 1,
                    frontFoot: 1,
                    frontThigh: 1,
                    head: 1,
                  },
                  id: "armor-template-test-coverage",
                  locationTypes: {
                    abdomen: "B",
                    backArm: "B",
                    backFoot: "B",
                    backThigh: "B",
                    chest: "B",
                    frontArm: "B",
                    frontFoot: "B",
                    frontThigh: "B",
                    head: "B",
                  },
                  locationValues: {
                    abdomen: 3,
                    backArm: 3,
                    backFoot: 3,
                    backThigh: 3,
                    chest: 3,
                    frontArm: 3,
                    frontFoot: 3,
                    frontThigh: 3,
                    head: 3,
                  },
                  name: "Test coverage armor",
                },
              },
            },
          },
        },
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterParry,
          stepSnapshots: [
            {
              attackSummary: {
                attackMode: "C",
                dmb: "8",
                initiative: "3",
                maxCrits: "FS",
                ob: "10",
                weaponName: "Broad sword",
              },
              committedAt: "2026-01-01T00:02:00.000Z",
              id: "snapshot-attack-damage",
              participantId: "encounter-participant-1",
              participantLabel: "The Gladiator",
              phase: "phase1",
              roundNumber: afterParry.roundNumber,
              step: "phase_1_actions",
            },
            {
              committedAt: "2026-01-01T00:02:00.000Z",
              defenseSummary: {
                db: "11",
                dm: "0",
                parry: "9",
                sourceName: "Sword / shield",
              },
              id: "snapshot-defense-damage",
              participantId: "encounter-participant-2",
              participantLabel: "City guard",
              phase: "phase1",
              roundNumber: afterParry.roundNumber,
              step: "phase_1_actions",
            },
          ],
        },
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-hit-location",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(
      updatedEncounter.combatRoundState.commands
        .slice(-2)
        .map((command: { type: string }) => command.type),
    ).toEqual(["roll_hit_location", "resolve_damage"]);
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageProposal.status).toBe(
      "drafted",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult).toMatchObject(
      {
        armorClass: "B",
        armorCoverageLabel: "3B",
        armorValue: 3,
        defenderDm: 0,
        dmb: 8,
        weaponArmorClass: "C",
      },
    );
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult.armorWarnings,
    ).toEqual([]);
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult.armorModifierSource,
    ).toMatchObject({
      armorClass: "B",
      status: "applied",
      weaponArmorClass: "C",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "pending",
    );
  });

  it("allows the attacking player to roll critical for their critical damage proposal", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordCombatRoundHitLocationRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-1",
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterDamage,
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        rolledByParticipantId: "encounter-participant-1",
        rollPrivilege: "attacker",
      }),
      participantId: "encounter-participant-2",
      type: "roll_critical",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "rolled",
    );
  });

  it("returns player-safe combat roll mutation responses without unrelated phase results or attack rolls", async () => {
    const encounterParticipants = makeFourCombatEncounterParticipants();
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const relevantAttack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterRelevantAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: relevantAttack.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: relevantAttack,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const unrelatedAttack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-3",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-4",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:30.000Z",
      weaponName: "Short sword",
    });
    const afterUnrelatedAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: unrelatedAttack.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-3",
      result: unrelatedAttack,
      state: afterRelevantAttack,
      submittedBy: "gm",
    });
    const afterUnrelatedParry = recordCombatRoundParryResult({
      attackResult: unrelatedAttack,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterUnrelatedAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterUnrelatedLocation = recordCombatRoundHitLocationRoll({
      attackResult: unrelatedAttack,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-3",
      state: afterUnrelatedParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterUnrelatedDamage = recordCombatRoundDamageResult({
      attackResult: unrelatedAttack,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterUnrelatedLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const stateWithPrivateUnrelatedReview = addPrivateDamageReviewToResolution({
      attackResultId: "1:phase1:encounter-participant-3:encounter-participant-4",
      state: afterUnrelatedDamage,
    });
    const combatRoundState = {
      ...stateWithPrivateUnrelatedReview,
      currentCursor: afterRelevantAttack.currentCursor,
      currentStep: afterRelevantAttack.currentStep,
      phaseResolutionCursor: afterRelevantAttack.phaseResolutionCursor,
      selectedParticipantId: afterRelevantAttack.selectedParticipantId,
      selectedStep: afterRelevantAttack.selectedStep,
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState,
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-2",
      },
      participants: [
        {
          controlledByUserId: "other-player",
          id: "participant-1",
        },
        {
          controlledByUserId: "player-1",
          id: "participant-2",
        },
        {
          controlledByUserId: "other-player",
          id: "participant-3",
        },
        {
          controlledByUserId: "other-player",
          id: "participant-4",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        dbParryRaw: 0,
        parryBase: 13,
        parrySourceLabel: "Sword / shield",
        scenarioParticipantId: "participant-2",
        usedMainHand: true,
        usedOffHand: true,
      },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseRoundState.phaseResolutionResults[0]).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
    });
    expect(JSON.stringify(responseRoundState.phaseResolutionResults)).not.toContain(
      "encounter-participant-3",
    );
    expect(JSON.stringify(responseRoundState.phaseResolutionResults)).not.toContain(
      "secret-gm-review",
    );
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-3",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-4",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
    });
  });

  it("strips damage review details from player critical roll mutation responses", async () => {
    const fixture = makeCriticalRollMutationFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(fixture.scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: fixture.attackResultId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseResolution = response.json().encounter.combatRoundState.phaseResolutionResults[0];
    expect(responseResolution.criticalRoll.status).toBe("rolled");
    expect(responseResolution.damageResult.review).toBeUndefined();
    expect(JSON.stringify(responseResolution)).not.toContain("secret-gm-review");
  });

  it("keeps GM combat roll mutation responses fully detailed", async () => {
    const fixture = makeCriticalRollMutationFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(fixture.scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: fixture.attackResultId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseResolution = response.json().encounter.combatRoundState.phaseResolutionResults[0];
    expect(responseResolution.criticalRoll.status).toBe("rolled");
    expect(responseResolution.damageResult.review).toMatchObject({
      notes: "secret-gm-review",
      reviewedByUserId: "gm-1",
    });
  });

  it("returns involved current-round combat result facts to the attacker on encounter read", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    const responseResolution = responseRoundState.phaseResolutionResults[0];
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseResolution).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      hitLocationRoll: {
        status: "rolled",
      },
    });
    expect(responseResolution.damageResult).toMatchObject({
      attackResultId: fixture.attackResultId,
      defenderParticipantId: "encounter-participant-2",
      hitLocationRolls: [12],
      totalDamage: expect.any(Number),
    });
    expect(responseResolution.damageResult.review).toBeUndefined();
    expect(JSON.stringify(responseRoundState)).not.toContain("secret-gm-review");
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
      rollD20: 14,
    });
  });

  it("returns involved current-round combat result facts to the defender on encounter read", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: {
        ...mocks.playerUser,
        id: "other-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseRoundState.phaseResolutionResults[0]).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      parryResolution: {
        status: "resolved",
      },
    });
    expect(responseRoundState.phaseResolutionResults[0].damageResult.review).toBeUndefined();
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
      rollD20: 14,
    });
  });

  it("omits unrelated current-round combat result details for an uninvolved player on encounter read", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: {
        ...mocks.playerUser,
        id: "uninvolved-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toEqual([]);
    expect(JSON.stringify(responseRoundState)).not.toContain("secret-gm-review");
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-2",
      )?.attackResults,
    ).toEqual({});
  });

  it("keeps GM encounter read responses fully detailed", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseRoundState.phaseResolutionResults[0].damageResult.review).toMatchObject({
      notes: "secret-gm-review",
      reviewedByUserId: "gm-1",
    });
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
      rollD20: 14,
    });
  });

  it("clears DE declarations and participant action selections for GM correction", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "select_actions",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              selectedOpponentId: "guard",
              modifierBuckets: {
                general: [],
                situationDb: [
                  attackParryDbParryModifierEntry,
                  parryAttackDbParryModifierEntry,
                  doubleAttackPhase1DbParryModifierEntry,
                  doubleAttackPhase2DbParryModifierEntry,
                ],
                situationInitiative: [],
                situationObSkill: [
                  doubleAttackPhase1ObSkillModifierEntry,
                  doubleAttackPhase2ObSkillModifierEntry,
                ],
              },
            },
            lastDeclaredActionId: "parry_attack",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "pending",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredMovementId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("keeps declaration-time distance Skill/OB modifiers when undoing a phase attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const distanceModifierEntry = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      notes: "Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -4,
    };
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 6,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        facts: {
          distanceModifier: {
            createdCombatModifierIds: [],
            modifierId: "generated:distance:phase1:ob-skill",
            notes: "distance: Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
            preferredDistances: [],
            value: -4,
          },
        },
      },
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const participantState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [distanceModifierEntry],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-1",
        state: participantState,
      },
      participants: [
        {
          id: "participant-1",
          state: participantState,
        },
        makeCombatScenarioParticipant({ id: "participant-2" }),
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      distanceModifierEntry,
    ]);
  });

  it("clears a command-backed DE cell by restoring the command before cursor", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience();
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              selectedOpponentId: "guard",
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalled();
  });

  it("clears a combat-start Combat Experience roll and removes only its created effect row", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const baseState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
    });
    const existingEffect = {
      createdAt: "2026-01-01T00:00:00.000Z",
      damage: 0,
      description: "Existing modifier",
      effectGroup: "general" as const,
      generalDamage: 0,
      id: "existing-modifier",
      modifierValue: -1,
      sourceEventId: "existing-event",
      status: "active" as const,
      targetParticipantId: "participant-1",
      type: "general_modifier" as const,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const rolled = rollCombatRoundCombatExperience({
      combatEffects: {
        effects: [existingEffect],
        events: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            description: "Existing modifier",
            id: "existing-event",
            sourceLabel: "Manual",
            sourceType: "manual",
            targetParticipantId: "participant-1",
          },
        ],
      },
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      rng: () => 0.2,
      scenarioParticipantId: "participant-1",
      skillTotal: 10,
      state: baseState,
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: rolled.state,
      },
      participant: {
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: rolled.combatEffects,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].combatExperience).toBeUndefined();

    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combatEffects.effects).toEqual([
      expect.objectContaining({
        id: "existing-modifier",
      }),
    ]);
    expect(
      updatedParticipantState.combatEffects.effects.some(
        (effect: { description?: string }) => effect.description === "combat exp active -2",
      ),
    ).toBe(false);
  });

  it("repairs unsupported A1 persisted state even when Clear has nothing to undo", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: combatEncounter });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...baseState,
          commands: [],
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: baseState.roundNumber,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: baseState.participants.map((participant) => ({
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              phase_1_actions: "gmEdited",
            },
          })),
          phaseResolutionCursor: undefined,
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
          stepSnapshots: [],
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: baseState.roundNumber,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.phaseResolutionResults).toEqual([]);
  });

  it("persists repaired state when loading an encounter with stale out-of-encounter target A1", async () => {
    const combatEncounter = makeCombatEncounter({
      participants: [
        {
          declaration: {
            actionType: "none",
            defenseFocus: "none",
            defensePosture: "none",
            targetLocation: "any",
          },
          facing: "north",
          id: "encounter-participant-1",
          initiative: 0,
          label: "The Gladiator",
          order: 0,
          orientation: "neutral",
          participantType: "scenario",
          position: { x: 0, y: 0, zone: "center" },
          scenarioParticipantId: "participant-1",
        },
        {
          declaration: {
            actionType: "none",
            defenseFocus: "none",
            defensePosture: "none",
            targetLocation: "any",
          },
          facing: "north",
          id: "encounter-participant-2",
          initiative: 0,
          label: "Lankhmarian veteran thief",
          order: 1,
          orientation: "neutral",
          participantType: "scenario",
          position: { x: 0, y: 0, zone: "center" },
          scenarioParticipantId: "participant-2",
        },
      ],
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: combatEncounter });
    const staleRoundState = {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-2",
        roundNumber: baseState.roundNumber,
        step: "A1" as const,
      },
      currentStep: "phase_1_actions" as const,
      participants: baseState.participants.map((participant) =>
        participant.participantId === "encounter-participant-2"
          ? {
              ...participant,
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
                    targetParticipantId: "stale-scyrian",
                  },
                },
                roundNumber: baseState.roundNumber,
                submittedBy: "gm" as const,
              },
              stepStatuses: {
                ...participant.stepStatuses,
                phase_1_actions: "gmEdited" as const,
                select_actions: "gmEdited" as const,
              },
            }
          : participant,
      ),
      phaseResolutionCursor: {
        participantId: "encounter-participant-2",
        phase: "phase1" as const,
        substep: "attack" as const,
      },
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "phase_1_actions" as const,
    };
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: staleRoundState,
        participants: combatEncounter.participants,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: baseState.roundNumber,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[1].declaration).toBeUndefined();
  });

  it("clears a player-originated command-backed DE declaration", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience();
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "player-1",
      },
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
            targetParticipantId: "participant-2",
          },
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "player",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredMovementId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("clears M1 and rewinds without erasing submitted DE declarations", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears a top-advance M1 command after the UI has landed on i1", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const reviewPhase1 = advanceCombatRoundStep(
      initializeCombatRoundState({ encounter: combatEncounter }),
    );
    const topAdvanced = advanceCombatRoundStep(reviewPhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "encounter-participant-1",
      },
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: topAdvanced,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "M1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_action_modifiers");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("review_action_modifiers");
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("pending");
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears a command-backed i1 cell by restoring the command before cursor", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const initiativeState = {
      ...initializeCombatRoundState({ encounter: combatEncounter }),
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const stateWithCommand = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toBeUndefined();
  });

  it("clears a top-advance i1 command without leaving no-action A1 state selected", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const initiativePhase1 = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: combatEncounter })),
    );
    const topAdvanced = advanceCombatRoundStep(initiativePhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "encounter-participant-1",
      },
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...topAdvanced,
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase1",
            substep: "damage",
          },
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_phase_2_actions,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_damage).toBe(
      "pending",
    );
  });

  it("falls back from an empty selected A1 cell to the latest i1 command undo", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-1"),
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: testCombatPhaseContext("encounter-participant-2"),
          },
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const initiativeState = {
      ...declaredState,
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterGuardRoll,
          currentStep: "phase_1_actions",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_initiative_phase1",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears the latest attack command even when the inspected cell is an older i1", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-1"),
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: testCombatPhaseContext("encounter-participant-2"),
          },
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const initiativeState = {
      ...declaredState,
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const gladiatorMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterGladiatorMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: gladiatorMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: gladiatorMiss,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const guardMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-2",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-1",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:04:00.000Z",
      weaponName: "Spear",
    });
    const afterGuardMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: guardMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      result: guardMiss,
      state: afterGladiatorMiss,
      submittedBy: "gm",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterGuardMiss,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(3);
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "A1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      total: 14,
    });
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toMatchObject({
      total: 12,
    });
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toEqual(
      gladiatorMiss,
    );
    expect(updatedEncounter.combatRoundState.participants[1].attackResults.phase1).toBeUndefined();
  });

  it("clears the latest parry command even when the inspected cell is an older i1", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: declaredState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterParry,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(3);
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "P1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_phase_2_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("review_phase_2_actions");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toEqual(
      attackHit,
    );
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      total: 14,
    });
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toMatchObject({
      total: 12,
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.parryResolution.status,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageRoll.status).toBe(
      "pending",
    );
  });

  it("clears the latest committed damage command and removes only its combat effect rows", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: declaredState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordCombatRoundHitLocationRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-1",
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "encounter-participant-1",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          description: "Existing row",
          effectGroup: "general",
          generalDamage: 0,
          id: "existing-effect",
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "participant-2",
          type: "special",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing event",
          sourceType: "manual",
          targetParticipantId: "participant-2",
        },
      ],
    };
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "participant-1",
      command: {
        commandId: "commit-d1-api",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      defenderScenarioParticipantId: "participant-2",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const expectedCommitEventId =
      "commit-d1-api:r1:phase1:1-phase1-encounter-participant-1-encounter-participant-2:1-phase1-encounter-participant-1-encounter-participant-2-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d1-api:r1:phase1:1-phase1-encounter-participant-1-encounter-participant-2:1-phase1-encounter-participant-1-encounter-participant-2-damage:combat-effect:physical-damage-chestBack";
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        id: "participant-2",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: committed.combatEffects,
        },
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...committed.state,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    mocks.encounterService.updateScenarioParticipantState.mockImplementation(
      async (update: { participantId: string; state: unknown }) => ({
        ...scenarioParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      }),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      type: "roll_critical",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "D1",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_damage");
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "rolled",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageProposal.status).toBe(
      "drafted",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-2",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                id: "existing-effect",
              }),
            ],
            events: [
              expect.objectContaining({
                id: "existing-event",
              }),
            ],
          }),
        }),
      }),
    );
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEffectId }),
    );
    expect(updatedParticipantState.combatEffects.events).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEventId }),
    );
  });

  it("clears an SU participant review commit and restores effect duration state", async () => {
    const encounterParticipants = makeCombatEncounter().participants;
    const base = initializeCombatRoundState({
      encounter: makeCombatEncounter({ participants: encounterParticipants }) as EncounterSession,
    });
    const roundSummaryState = {
      ...base,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: base.roundNumber,
        step: "SU" as const,
      },
      currentStep: "round_summary" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary" as const,
    };
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          description: "Bleeding wound",
          bleedState: {
            accumulatedTenths: 8,
            initializedRound: 1,
          },
          duration: "2 rounds",
          effectGroup: "bleed",
          generalDamage: 0,
          id: "bleed-1",
          modifierValue: 2,
          roundNumber: 1,
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "participant-1",
          type: "bleed",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing bleed",
          sourceType: "manual",
          targetParticipantId: "participant-1",
        },
      ],
    };
    const reviewed = prepareCombatRoundEndReview({
      command: {
        commandId: "prepare-su-api",
        createdAt: "2026-01-01T00:09:00.000Z",
        createdByUserId: "gm-1",
      },
      participantInputs: {
        "encounter-participant-1": {
          combatEffects: existingCombatEffects,
          healthStat: 9,
        },
      },
      state: roundSummaryState,
    });
    const committed = commitCombatRoundEndParticipantReview({
      command: {
        commandId: "commit-su-api",
        createdAt: "2026-01-01T00:10:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      participantId: "encounter-participant-1",
      scenarioParticipantId: "participant-1",
      state: reviewed,
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: committed.combatEffects,
        },
      }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: committed.state,
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    mocks.encounterService.updateScenarioParticipantState.mockImplementation(
      async (update: { participantId: string; state: unknown }) => ({
        ...scenarioParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      }),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledTimes(1);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;

    expect(updatedParticipantState.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        duration: "2 rounds",
        id: "bleed-1",
        status: "active",
      }),
    );
    expect(
      updatedParticipantState.combatEffects.effects.find(
        (effect: { id?: string }) => effect.id === "bleed-1",
      )?.bleedState?.accumulatedTenths,
    ).toBe(8);
    expect(
      updatedParticipantState.combatEffects.effects.some(
        (effect: { generalDamage?: number; type?: string }) =>
          effect.type === "general_damage" && effect.generalDamage === 1,
      ),
    ).toBe(false);
  });

  it("fallback DE undo from an empty selected A1 cell clears mirrored declaration state", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithCommand,
          currentStep: "phase_1_actions",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("clears the selected A1 cell without rewinding to initiative", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
  });

  it("clears an auto-opened defender P1 cell back to the attacker A1 redo point", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "review_phase_2_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "review_phase_2_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(
      updatedEncounter.combatRoundState.participants[1].stepStatuses.review_phase_2_actions,
    ).toBe("pending");
  });

  it("does not allow players to clear combat round steps", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects duplicate player submissions for the same assigned roll side", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [
          {
            createdAt: "2026-01-01T00:01:00.000Z",
            id: "existing-result",
            mode: "opposed",
            participantId: "scenario-participant-1",
            pendingRollId: "roll-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            summary: "Player rolled Dodge.",
            type: "gm_skill_roll",
          },
        ],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            mode: "opposed",
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects player roleplay rolls for silent assignments", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "silent-roll",
            participantId: "scenario-participant-1",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "silent-roll",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });
});
