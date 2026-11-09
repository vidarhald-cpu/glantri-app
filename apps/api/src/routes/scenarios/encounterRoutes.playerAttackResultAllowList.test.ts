import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCombatHistorySourceViewFromPersistedSession,
  buildCombatProgressionProjection,
  combatRoundStateSchema,
  deriveCombatRoundStepSnapshots,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  upsertCombatRoundStepSnapshots,
  advanceCombatRoundStep,
  buildCombatRoundDeclaredAttackOpportunities,
  commitCombatRoundPhaseInitiativeResolution,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  resolveEncounterParticipantMembership,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundParticipantInitiative,
  type CombatRoundAttackRollResult,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import { weaponTemplates } from "@glantri/content/equipment";

import {
  ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER,
  ACTIVE_COMBAT_MUTATION_RESPONSE_VERSION,
} from "./combatMutationResponse";

/**
 * Forgejo #1044, WO-1044-R1 — route-level proof by response-key enumeration.
 *
 * #922 declared `extrapolatedWorkbookAdjustments` GM-only, and the Product Owner confirmed it on
 * 2026-11-08 (#1002 comment 23577). #922 repair cycle 1 (`02adfbd5`) allow-listed the player's own
 * attack result on the roll-attack response only; the combat history's snapshot panel still copied
 * the whole stored result, less `rolledByUserId`, to the rolling player. Both now use the one
 * allow-list in `@glantri/domain` (`projectPlayerOwnAttackResult`).
 *
 * This suite drives the **real** roll-attack route and the real engine, with only persistence,
 * authentication and the d20 replaced, against a defender whose committed DB/Parry total runs past
 * the authored workbook grid, so the committed attack really is flagged. It then reads every
 * player-facing response the rolling player receives and enumerates **every key path** in each raw
 * body that names a GM-only attack-result field. The GM reads the same encounter in the same test,
 * and the probe finds the flag in the GM's bodies, so it is shown capable of failing.
 */

const mocks = vi.hoisted(() => {
  const adminUser = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
  const playerUser = { email: "player@example.test", id: "player-1", roles: ["player"] };
  return {
    adminUser,
    campaignService: { getCampaignById: vi.fn(), listCampaignsByUserAccess: vi.fn() },
    combatStateReadService: { getCombatHistorySourceById: vi.fn() },
    encounterService: {
      commitCombatModifierReview: vi.fn(),
      commitCombatModifierReviews: vi.fn(),
      commitCombatParticipantStateMutation: vi.fn(),
      commitCombatParticipantStateMutations: vi.fn(),
      getEncounterById: vi.fn(),
      listEncountersByScenario: vi.fn(),
      updateCombatEncounter: vi.fn(),
      updateEncounter: vi.fn(),
      updateScenarioParticipantState: vi.fn(),
    },
    playerUser,
    requireAdminUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    scenarioService: {
      getScenarioById: vi.fn(),
      listScenarioParticipants: vi.fn(),
      recordScenarioEvent: vi.fn(),
      resolveEquipmentStatuses: vi.fn().mockResolvedValue({}),
      userHasPlayerScenarioAccess: vi.fn(),
    },
  };
});

vi.mock("@glantri/database", () => ({
  ArtifactImportService: vi.fn(() => ({})),
  CampaignCharacterAlreadyRosteredError: class extends Error {},
  CampaignCharacterRosterCandidateNotFoundError: class extends Error {},
  CampaignMapService: vi.fn(() => ({})),
  CampaignMapConflictError: class extends Error {},
  CampaignMapNotFoundError: class extends Error {},
  CampaignMapReferenceError: class extends Error {},
  CampaignManagementService: vi.fn(() => ({})),
  CampaignNoteConflictError: class extends Error {},
  CampaignNoteNotFoundError: class extends Error {},
  CampaignNoteReferenceError: class extends Error {},
  CampaignService: vi.fn(() => mocks.campaignService),
  CharacterEquipmentReadModelService: vi.fn(() => ({})),
  CharacterService: vi.fn(() => ({})),
  CombatItemInteractionService: vi.fn(() => ({})),
  CombatItemUnavailableError: class extends Error {},
  CombatStateReadService: vi.fn(() => mocks.combatStateReadService),
  EncounterCombatWriteError: class extends Error {},
  EncounterService: vi.fn(() => mocks.encounterService),
  EncounterWriteError: class extends Error {},
  ScenarioEquipmentStaleError: class extends Error {},
  ScenarioService: vi.fn(() => mocks.scenarioService),
  ScenarioSessionWriteError: class extends Error {},
}));

vi.mock("../../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { scenariosRoutes } from "../scenarios";

function makeMovementBurdenEquipmentState(input: { characterId: string; load?: number }) {
  const locationId = `location-${input.characterId}-person`;
  const templateId = `template-${input.characterId}-load`;
  const itemId = `item-${input.characterId}-load`;
  return {
    activeLoadoutByCharacterId: {
      [input.characterId]: {
        activeAmmoItemIds: [],
        characterId: input.characterId,
        id: `loadout-${input.characterId}`,
        isActive: true,
        name: "Combat",
        quickAccessItemIds: [],
      },
    },
    itemsById: {
      [itemId]: {
        category: "gear",
        characterId: input.characterId,
        conditionState: "intact",
        id: itemId,
        isStackable: false,
        material: "steel",
        quality: "standard",
        quantity: 1,
        revision: "2026-07-30T07:59:00.000Z",
        specificityType: "generic",
        storageAssignment: { carryMode: "on_person", locationId },
        templateId,
      },
    },
    locationsById: {
      [locationId]: {
        availabilityClass: "with_you",
        characterId: input.characterId,
        id: locationId,
        isAccessibleInEncounter: true,
        isMobile: true,
        name: "On person",
        type: "person_system",
      },
    },
    templatesById: {
      [templateId]: {
        baseEncumbrance: input.load ?? 10,
        baseValue: null,
        category: "gear",
        defaultMaterial: "steel",
        id: templateId,
        name: "Combat load",
        specificityTypeDefault: "generic",
        tags: [],
      },
    },
  };
}

function makeCanonicalWeaponDefenseEquipmentState(input: {
  characterId: string;
  templateId: string;
}) {
  const state = makeMovementBurdenEquipmentState({ characterId: input.characterId });
  const template = weaponTemplates.find((candidate) => candidate.id === input.templateId);
  if (!template) throw new Error(`Missing weapon fixture ${input.templateId}.`);
  const itemId = `item-${input.templateId}`;
  const locationId = `location-${input.characterId}-equipped`;
  const templatesById = { ...state.templatesById, [template.id]: template };

  return {
    ...state,
    activeLoadoutByCharacterId: {
      [input.characterId]: {
        ...state.activeLoadoutByCharacterId[input.characterId],
        activePrimaryWeaponItemId: itemId,
      },
    },
    itemsById: {
      ...state.itemsById,
      [itemId]: {
        acquiredFrom: null,
        category: "weapon",
        characterId: input.characterId,
        conditionState: "intact",
        displayName: null,
        id: itemId,
        isFavorite: false,
        isStackable: false,
        material: "steel",
        quality: "standard",
        quantity: 1,
        revision: "2026-07-30T07:59:00.000Z",
        specificityType: "generic",
        storageAssignment: { carryMode: "equipped", locationId },
        templateId: template.id,
      },
    },
    locationsById: {
      ...state.locationsById,
      [locationId]: {
        availabilityClass: "with_you",
        characterId: input.characterId,
        id: locationId,
        isAccessibleInEncounter: true,
        isMobile: true,
        name: "Equipped",
        type: "equipped_system",
      },
    },
    templates: { templatesById },
    templatesById,
  };
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

function makeDodgeCharacterBuild(id: string, name: string) {
  const base = makeCombatExperienceCharacterBuild({ id, name });
  return {
    ...base,
    profile: { ...base.profile, id: `profile-${id}`, label: name },
    progression: {
      ...base.progression,
      skills: [
        ...base.progression.skills,
        {
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          secondaryRanks: 8,
          skillId: "dodge",
        },
      ],
    },
  };
}

function makeCanonicalCombatCalculationSnapshot(input: {
  characterId: string;
  displayName: string;
}) {
  const primary = weaponTemplates.find((candidate) => candidate.name === "Long sword");
  const secondary = weaponTemplates.find((candidate) => candidate.name === "Dagger");
  if (!primary || !secondary) throw new Error("Missing canonical combat calculation fixtures.");
  const state = makeCanonicalWeaponDefenseEquipmentState({
    characterId: input.characterId,
    templateId: primary.id,
  });
  const secondaryItemId = `item-${input.characterId}-${secondary.id}`;
  const secondaryLocationId = `location-${input.characterId}-secondary`;
  const build = makeDodgeCharacterBuild(input.characterId, input.displayName);
  return {
    build: {
      ...build,
      progression: {
        ...build.progression,
        skills: [
          ...build.progression.skills,
          {
            category: "secondary",
            categoryId: "combat",
            groupId: "basic_melee_training",
            secondaryRanks: 8,
            skillId: "parry",
          },
        ],
      },
    },
    displayName: input.displayName,
    equipmentState: {
      ...state,
      activeLoadoutByCharacterId: {
        [input.characterId]: {
          ...state.activeLoadoutByCharacterId[input.characterId],
          activeSecondaryWeaponItemId: secondaryItemId,
        },
      },
      itemsById: {
        ...state.itemsById,
        [secondaryItemId]: {
          acquiredFrom: null,
          category: "weapon",
          characterId: input.characterId,
          conditionState: "intact",
          displayName: null,
          id: secondaryItemId,
          isFavorite: false,
          isStackable: false,
          material: "steel",
          quality: "standard",
          quantity: 1,
          revision: "2026-07-30T07:59:00.000Z",
          specificityType: "generic",
          storageAssignment: { carryMode: "equipped", locationId: secondaryLocationId },
          templateId: secondary.id,
        },
      },
      locationsById: {
        ...state.locationsById,
        [secondaryLocationId]: {
          availabilityClass: "with_you",
          characterId: input.characterId,
          id: secondaryLocationId,
          isAccessibleInEncounter: true,
          isMobile: true,
          name: "Secondary",
          type: "equipped_system",
        },
      },
      templates: {
        templatesById: { ...state.templatesById, [secondary.id]: secondary },
      },
      templatesById: { ...state.templatesById, [secondary.id]: secondary },
    },
    sourceUpdatedAt: "2026-07-30T07:59:00.000Z",
  };
}

const ATTACKER = "encounter-participant-1";
const DEFENDER = "encounter-participant-2";
const PARTICIPANT_REVISION = "2026-07-30T08:00:00.000Z";

const emptyBuckets = () => ({
  general: [],
  situationDb: [],
  situationInitiative: [],
  situationObSkill: [],
});

function encounterParticipant(id: string, label: string, order: number, scenarioId: string) {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id,
    initiative: 0,
    label,
    order,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: scenarioId,
  };
}

function scenarioParticipant(input: {
  controlledByUserId: string;
  id: string;
  name: string;
  situationDbRawTotal?: number;
}): ScenarioParticipant {
  const characterId = `character-${input.id}`;
  const snapshot = makeCanonicalCombatCalculationSnapshot({
    characterId,
    displayName: input.name,
  });
  return {
    characterId,
    controlledByUserId: input.controlledByUserId,
    createdAt: PARTICIPANT_REVISION,
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { ...snapshot, displayName: input.name },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            ...emptyBuckets(),
            situationDb:
              input.situationDbRawTotal === undefined
                ? []
                : [
                    {
                      application: "percentage",
                      id: "gm-db-parry-row",
                      notes: "GM DB/Parry",
                      scope: "until",
                      value: input.situationDbRawTotal,
                    },
                  ],
          },
        },
      },
      conditions: [],
      equipment: {},
      health: { currentHp: 20, maxHp: 20 },
      modifiers: [],
      resources: {},
    },
    updatedAt: PARTICIPANT_REVISION,
  } as unknown as ScenarioParticipant;
}

function baseEncounter(): EncounterSession {
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
      encounterParticipant(ATTACKER, "The Gladiator", 0, "participant-1"),
      encounterParticipant(DEFENDER, "City guard", 1, "participant-2"),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Issue 874",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as EncounterSession;
}

/**
 * Round 1 walked by the real engine to the attacker's open phase-1 attack: Combat Experience,
 * a Single Attack against a defender who only parries, phase-1 initiative committed.
 */
function openAttackEncounter(): EncounterSession {
  const encounter = baseEncounter();
  const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString();
  let state = setCombatRoundCombatExperienceDifficulty({
    difficulty: 26,
    state: initializeCombatRoundState({ encounter }),
  });
  for (const [index, participantId] of [ATTACKER, DEFENDER].entries()) {
    state = rollCombatRoundCombatExperience({
      command: { createdAt: at(index + 1) },
      participantId,
      rng: () => 0.6,
      skillTotal: 26,
      state,
    }).state;
  }
  const phaseContexts = {
    phase1: { modifierBuckets: emptyBuckets(), targetParticipantId: DEFENDER },
  };
  state = recordCombatRoundDeclaration({
    command: { createdAt: at(10), createdByUserId: "gm-1" },
    declaration: {
      actionId: "attack_parry",
      attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
        actionId: "attack_parry",
        participantId: ATTACKER,
        phaseContexts,
        roundNumber: state.roundNumber,
        sources: {
          phase1: {
            attackModeId: "mode-1",
            sourceKind: "unarmed",
            weaponSourceId: "unarmed:virtual-weapon-template-punch",
            weaponSourceSlot: "virtual",
            weaponTemplateId: "virtual-weapon-template-punch",
          },
        },
      }),
      combatContext: { modifierBuckets: emptyBuckets() },
      id: "declaration-attacker",
      phaseContexts,
      roundNumber: state.roundNumber,
      submittedAt: at(10),
    },
    participantId: ATTACKER,
    state,
    submittedBy: "gm",
  });
  state = recordCombatRoundDeclaration({
    command: { createdAt: at(11), createdByUserId: "gm-1" },
    declaration: {
      actionId: "parry",
      combatContext: { modifierBuckets: emptyBuckets(), selectedOpponentId: ATTACKER },
      id: "declaration-defender",
      roundNumber: state.roundNumber,
      submittedAt: at(11),
    },
    participantId: DEFENDER,
    state,
    submittedBy: "gm",
  });
  for (let guard = 0; guard < 20 && state.currentStep !== "initiative_phase_1"; guard += 1) {
    state = advanceCombatRoundStep(state);
  }
  if (state.currentStep !== "initiative_phase_1") throw new Error("Did not reach initiative.");
  for (const [participantId, total] of [
    [ATTACKER, 6],
    [DEFENDER, 4],
  ] as const) {
    state = setCombatRoundParticipantInitiative({
      initiative: {
        baseInitiative: 0,
        modifierAdjustment: 0,
        rolls: [total],
        rollTotal: total,
        total,
      },
      participantId,
      phase: "phase1",
      state,
    });
  }
  state = commitCombatRoundPhaseInitiativeResolution({
    command: { createdAt: at(20), createdByUserId: "gm-1" },
    phase: "phase1",
    state,
    visibility: { [ATTACKER]: { [DEFENDER]: true }, [DEFENDER]: { [ATTACKER]: true } },
  }).state;
  return { ...encounter, combatRoundState: state };
}

/**
 * The attacker is the player's character; the defender belongs to another player. The defender's
 * committed DB/Parry total of -20 runs past the authored workbook grid, which is what flags the
 * committed attack (the #922 fixture shape, `scenarios.test.ts`).
 */
function openWorld(input: { user: typeof mocks.playerUser | typeof mocks.adminUser }) {
  let encounter = openAttackEncounter();
  const participants = [
    scenarioParticipant({
      controlledByUserId: "player-1",
      id: "participant-1",
      name: "The Gladiator",
    }),
    scenarioParticipant({
      controlledByUserId: "player-2",
      id: "participant-2",
      name: "City guard",
      situationDbRawTotal: -20,
    }),
  ];
  mocks.requireAuthenticatedUser.mockResolvedValue(input.user);
  mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
  mocks.encounterService.getEncounterById.mockImplementation(async () => encounter);
  mocks.encounterService.listEncountersByScenario.mockImplementation(async () => [encounter]);
  const save = async (update: { session: EncounterSession }) => {
    encounter = update.session;
    return encounter;
  };
  mocks.encounterService.updateEncounter.mockImplementation(save);
  mocks.encounterService.updateCombatEncounter.mockImplementation(save);
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { participantId: string }) =>
      participants.find((entry) => entry.id === update.participantId),
  );
  mocks.encounterService.commitCombatParticipantStateMutation.mockImplementation(
    async (update: { participant: ScenarioParticipant; session: EncounterSession }) => ({
      encounter: await save({ session: update.session }),
      participant: update.participant,
    }),
  );
  mocks.encounterService.commitCombatParticipantStateMutations.mockImplementation(
    async (update: {
      participants: Array<{ participant: ScenarioParticipant }>;
      session: EncounterSession;
    }) => ({
      encounter: await save({ session: update.session }),
      participants: update.participants.map((entry) => entry.participant),
    }),
  );
  mocks.combatStateReadService.getCombatHistorySourceById.mockImplementation(async () =>
    buildCombatHistorySourceViewFromPersistedSession({
      metadata: {
        campaignId: encounter.campaignId,
        createdAt: encounter.createdAt,
        encounterId: encounter.id,
        revision: encounter.updatedAt,
        scenarioId: encounter.scenarioId,
        status: encounter.status,
        title: encounter.title,
      },
      sessionJson: encounter,
    }),
  );
  mocks.scenarioService.listScenarioParticipants.mockImplementation(async () => participants);
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
  mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([{ id: "campaign-1" }]);
  mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
  return {
    get encounter() {
      return encounter;
    },
    set encounter(next: EncounterSession) {
      encounter = next;
    },
    participants,
  };
}

/** The exact projected attack task, as the GM client sends it. */
function rollAttackPayload(encounter: EncounterSession, participants: ScenarioParticipant[]) {
  const membership = resolveEncounterParticipantMembership({
    encounter,
    scenarioParticipants: participants,
  });
  const state = initializeCombatRoundState({
    encounter: { ...encounter, participants: membership.participants },
  });
  const task = buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .find((candidate) => candidate.expectedCommand === "roll_attack");
  if (!task)
    throw new Error(
      `The fixture must project one roll_attack task: ${JSON.stringify(
        buildCombatProgressionProjection(state).boundary.processes.map((process) => ({
          kind: process.kind,
          tasks: process.stages.flatMap((stage) => stage.tasks.map((t) => t.expectedCommand)),
        })),
      )} boundary=${buildCombatProgressionProjection(state).boundary.kind} blockers=${JSON.stringify(buildCombatProgressionProjection(state).blockers.map((b) => b.message))}`,
    );
  return {
    actionId: task.identity.actionId,
    attackIndex: task.identity.attackIndex,
    attackModeId: task.identity.attackModeId,
    declarationId: task.identity.declarationId,
    defenderParticipantId: task.identity.defenderParticipantId ?? DEFENDER,
    executionGroupId: task.executionGroupId,
    expectedParticipantRevision: PARTICIPANT_REVISION,
    expectedRevision: encounter.updatedAt,
    opportunityId: task.identity.opportunityId,
    phase: "phase1",
    scenarioParticipantId: "participant-1",
    taskId: task.id,
    weaponInstanceId: task.identity.weaponInstanceId,
    weaponSourceId: task.identity.weaponSourceId,
    weaponSourceSlot: task.identity.weaponSourceSlot,
    weaponTemplateId: task.identity.weaponTemplateId,
  };
}

/** d20 = 11 (`rollOpenEndedD20` maps 0.5 to 11, which does not open-end). */
const ROLL_ELEVEN = 0.5;

const GM_ONLY_ATTACK_RESULT_FIELDS = [
  "extrapolatedWorkbookAdjustments",
  "rolledByUserId",
  "weaponDmbRoll",
  "weaponModeSourceMetadata",
] as const;

/** Every key path in a raw JSON body whose last key is one of the GM-only attack-result fields. */
function gmOnlyKeyPaths(body: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        if ((GM_ONLY_ATTACK_RESULT_FIELDS as readonly string[]).includes(key)) {
          found.push(`${path}.${key}`);
        }
        walk(nested, `${path}.${key}`);
      }
    }
  };
  walk(body, "$");
  return found;
}

/**
 * The player-facing reads of an encounter. `GET /scenarios/:id/encounters` is a player read only:
 * a GM receives the management projection there, which is not built from the round state.
 */
const PLAYER_READS = [
  "/encounters/encounter-1",
  "/encounters/encounter-1/combat-history",
  "/scenarios/scenario-1/player-projection",
  "/scenarios/scenario-1/encounters",
] as const;
const GM_READS = ["/encounters/encounter-1", "/encounters/encounter-1/combat-history"] as const;

/**
 * The real roll-attack route, rolled by `user` on `contract`, against the flagging fixture. Then
 * the attack step's server-side snapshot record is derived from the state the route persisted, by
 * the same domain function the server's boundary commit calls (`deriveCombatRoundStepSnapshots`,
 * via `withDerivedCombatRoundStepSnapshots`), so the combat history has the snapshot panel that
 * leaked. Walking the remaining parry and damage steps to reach that boundary is not needed for
 * the projection under test.
 */
async function rollFlaggedAttack(input: {
  contract: "active-v1" | "legacy";
  user: typeof mocks.playerUser | typeof mocks.adminUser;
}) {
  const world = openWorld({ user: input.user });
  const app = Fastify({ logger: false });
  await app.register(scenariosRoutes);
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(ROLL_ELEVEN);
  let response;
  try {
    response = await app.inject({
      headers:
        input.contract === "active-v1"
          ? { [ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER]: ACTIVE_COMBAT_MUTATION_RESPONSE_VERSION }
          : undefined,
      method: "POST",
      payload: rollAttackPayload(world.encounter, world.participants),
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });
  } finally {
    randomSpy.mockRestore();
  }
  expect(response.statusCode, response.body).toBe(200);

  const rolled = combatRoundStateSchema.parse(world.encounter.combatRoundState);
  const stored = getCombatRoundOutgoingAttackResultForParticipantPhase({
    participantId: ATTACKER,
    phase: "phase1",
    state: rolled,
  }) as CombatRoundAttackRollResult;
  world.encounter = {
    ...world.encounter,
    combatRoundState: upsertCombatRoundStepSnapshots({
      snapshots: deriveCombatRoundStepSnapshots({
        committedAt: "2026-01-01T00:01:00.000Z",
        encounterId: "encounter-1",
        state: rolled,
        step: "phase_1_actions",
      }),
      state: rolled,
    }),
  };

  async function read(user: typeof mocks.playerUser | typeof mocks.adminUser, url: string) {
    mocks.requireAuthenticatedUser.mockResolvedValue(user);
    const result = await app.inject({ method: "GET", url });
    expect(result.statusCode, `${url}: ${result.body}`).toBe(200);
    return result.json() as unknown;
  }

  return { app, read, rollBody: response.json() as Record<string, unknown>, stored };
}

const SNAPSHOT_FLAG_PATH =
  "panels.actionResult.attackResult.extrapolatedWorkbookAdjustments" as const;

describe("#1044 no player-facing response carries a GM-only attack-result field", () => {
  afterEach(() => vi.clearAllMocks());

  it("drives a really flagged attack, recorded on the attack step's snapshot", async () => {
    const { app, stored } = await rollFlaggedAttack({ contract: "legacy", user: mocks.playerUser });
    await app.close();

    // Fixture guard: without a populated flag every absence below would be vacuous.
    expect(stored.extrapolatedWorkbookAdjustments).toEqual(["defender_db"]);
    expect(stored.rolledByUserId).toBe("player-1");
  });

  it("the rolling player's roll-attack bodies, on both contracts, name no GM-only field", async () => {
    for (const contract of ["legacy", "active-v1"] as const) {
      const player = await rollFlaggedAttack({ contract, user: mocks.playerUser });
      const gm = await rollFlaggedAttack({ contract, user: mocks.adminUser });
      await player.app.close();
      await gm.app.close();

      expect(gmOnlyKeyPaths(player.rollBody), contract).toEqual([]);
      // Discrimination: the GM's body for the same roll does carry the flag.
      expect(gmOnlyKeyPaths(gm.rollBody), contract).toContain(
        contract === "legacy"
          ? "$.attackResult.extrapolatedWorkbookAdjustments"
          : "$.mutationPresentation.attackResult.extrapolatedWorkbookAdjustments",
      );
    }
  });

  it("every player read of the flagged encounter names no GM-only field; the GM's reads do", async () => {
    const world = await rollFlaggedAttack({ contract: "legacy", user: mocks.playerUser });
    const measured: Record<string, string[]> = {};
    for (const url of PLAYER_READS) {
      measured[`player ${url}`] = gmOnlyKeyPaths(await world.read(mocks.playerUser, url));
    }
    for (const url of GM_READS) {
      measured[`gm ${url}`] = gmOnlyKeyPaths(await world.read(mocks.adminUser, url));
    }
    await world.app.close();

    for (const url of PLAYER_READS) {
      expect(measured[`player ${url}`], url).toEqual([]);
    }
    // The probe sees the flag where the ruling says it belongs, on both GM reads.
    expect(measured["gm /encounters/encounter-1"]).toContain(
      "$.encounter.combatRoundState.participants[0].attackResults.phase1.extrapolatedWorkbookAdjustments",
    );
    expect(
      measured["gm /encounters/encounter-1/combat-history"].filter((path) =>
        path.endsWith(SNAPSHOT_FLAG_PATH),
      ),
    ).toHaveLength(1);
    expect(measured["gm /encounters/encounter-1/combat-history"][0]).toMatch(
      /^\$\.history\.activeRound\.snapshots\[\d+\]\.panels\.actionResult\.attackResult\.extrapolatedWorkbookAdjustments$/,
    );
  });

  it("the player keeps every other field of their own attack, on the history and the roll", async () => {
    const world = await rollFlaggedAttack({ contract: "legacy", user: mocks.playerUser });
    const history = (await world.read(
      mocks.playerUser,
      "/encounters/encounter-1/combat-history",
    )) as {
      history: {
        activeRound: {
          snapshots: Array<{
            panels: { actionResult: { attackResult?: Record<string, unknown> } };
            participant: { participantId: string };
            step: string;
          }>;
        };
      };
    };
    const gmHistory = (await world.read(
      mocks.adminUser,
      "/encounters/encounter-1/combat-history",
    )) as typeof history;
    await world.app.close();

    const stored = JSON.parse(JSON.stringify(world.stored)) as Record<string, unknown>;
    const expectedPlayer = Object.fromEntries(
      Object.entries(stored).filter(
        ([key]) => !(GM_ONLY_ATTACK_RESULT_FIELDS as readonly string[]).includes(key),
      ),
    );
    const ownSnapshot = (body: typeof history) =>
      body.history.activeRound.snapshots.find(
        (snapshot) =>
          snapshot.participant.participantId === ATTACKER && snapshot.step === "phase_1_actions",
      );

    expect(ownSnapshot(history)?.panels.actionResult.attackResult).toEqual(expectedPlayer);
    expect(world.rollBody["attackResult"]).toEqual(expectedPlayer);
    // The GM's snapshot is the stored result less the roller account, as before #1044.
    const { rolledByUserId: _roller, ...expectedGm } = stored;
    expect(ownSnapshot(gmHistory)?.panels.actionResult.attackResult).toEqual(expectedGm);
  });

  /*
   * A GM perspective read impersonates the player (#925 item 3) and goes through the player
   * projection, so it now matches what the player receives. The GM's own read is unchanged.
   */
  it("a GM perspective read of the rolling player matches the player's", async () => {
    const world = await rollFlaggedAttack({ contract: "legacy", user: mocks.playerUser });
    const perspective = await world.read(
      mocks.adminUser,
      `/encounters/encounter-1/combat-history?perspectiveParticipantId=${ATTACKER}`,
    );
    const player = await world.read(mocks.playerUser, "/encounters/encounter-1/combat-history");
    await world.app.close();

    expect(gmOnlyKeyPaths(perspective)).toEqual([]);
    expect(
      JSON.stringify((perspective as { history: { activeRound: unknown } }).history.activeRound),
    ).toBe(JSON.stringify((player as { history: { activeRound: unknown } }).history.activeRound));
  });
});
