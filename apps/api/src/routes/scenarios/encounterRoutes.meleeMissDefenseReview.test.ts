import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCombatProgressionProjection,
  buildCombatRoundAttackRollResult,
  advanceCombatRoundStep,
  buildCombatRoundDeclaredAttackOpportunities,
  commitCombatRoundPhaseInitiativeResolution,
  getCombatRoundAttackResultId,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  resolveEncounterParticipantMembership,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundParticipantInitiative,
  type CombatRoundAttackRollResult,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import { weaponTemplates } from "@glantri/content/equipment";

/**
 * Forgejo #874, WO-874-S2 acceptance 1 and amendment A1 — route-level proof.
 *
 * Product Owner ruling of 2026-11-08: when the GM records an attack as a miss, the game records the
 * miss, tells the players, skips the defense review entirely and moves on. The defense review is
 * what re-resolves a melee attack for an unaware defender (against the preserved flat DB), so a
 * miss is final at the attack-result commit only when the defender is aware of the attacker. The
 * roll-attack route supplies that awareness from the attacker's scenario visibility — the same
 * default a committed review records as `awarenessDefault`.
 *
 * This suite drives the **real** `POST /encounters/:id/combat-round/roll-attack` route and the real
 * engine, with only persistence, authentication and the d20 replaced. One fixture, one roll: the
 * attack misses against the defender's full DB and would connect against the unaware DB (the #832
 * fixture shape). The only difference between the two cases is the attacker's visibility.
 */

const mocks = vi.hoisted(() => {
  const adminUser = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
  return {
    adminUser,
    campaignService: { getCampaignById: vi.fn() },
    encounterService: {
      commitCombatModifierReview: vi.fn(),
      commitCombatModifierReviews: vi.fn(),
      commitCombatParticipantStateMutation: vi.fn(),
      commitCombatParticipantStateMutations: vi.fn(),
      getEncounterById: vi.fn(),
      updateCombatEncounter: vi.fn(),
      updateEncounter: vi.fn(),
      updateScenarioParticipantState: vi.fn(),
    },
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
  CombatStateReadService: vi.fn(() => ({})),
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
  hidden?: boolean;
  id: string;
  name: string;
}): ScenarioParticipant {
  const characterId = `character-${input.id}`;
  const snapshot = makeCanonicalCombatCalculationSnapshot({
    characterId,
    displayName: input.name,
  });
  return {
    characterId,
    controlledByUserId: "player-1",
    createdAt: PARTICIPANT_REVISION,
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { ...snapshot, displayName: input.name },
    sourceType: "character",
    state: {
      combat: { combatContext: { modifierBuckets: emptyBuckets() } },
      conditions: [],
      equipment: {},
      health: {},
      modifiers: [],
      resources: {},
    },
    updatedAt: PARTICIPANT_REVISION,
    ...(input.hidden ? { visibilityOverrides: { visibility: "hidden" } } : {}),
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

function openWorld(input: { attackerHidden: boolean }) {
  let encounter = openAttackEncounter();
  const participants = [
    scenarioParticipant({
      hidden: input.attackerHidden,
      id: "participant-1",
      name: "The Gladiator",
    }),
    scenarioParticipant({ id: "participant-2", name: "City guard" }),
  ];
  mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
  mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
  mocks.encounterService.getEncounterById.mockImplementation(async () => encounter);
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
  mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
  return {
    get encounter() {
      return encounter;
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

function projectedCommands(state: CombatRoundState): string[] {
  return buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks ?? [])
    .map((task) => task.expectedCommand);
}

/**
 * d20 = 11 (`rollOpenEndedD20` maps 0.5 to 11, which does not open-end). Against this fixture's
 * canonical OB 1 and DB 10 that is lookup 2, a miss; against the unaware DB 0 it is lookup 12, a
 * hit. That is the #832 shape (OB 20 / roll 3 / DB 20: lookup 3 misses, 23 connects) at this
 * fixture's canonical figures, which the guard below measures rather than assumes.
 */
const ROLL_ELEVEN = 0.5;

async function rollTheMiss(input: { attackerHidden: boolean }) {
  const world = openWorld(input);
  const app = Fastify({ logger: false });
  await app.register(scenariosRoutes);
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(ROLL_ELEVEN);
  try {
    const response = await app.inject({
      method: "POST",
      payload: rollAttackPayload(world.encounter, world.participants),
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });
    expect(response.statusCode, response.body).toBe(200);
  } finally {
    randomSpy.mockRestore();
    await app.close();
  }
  const state = world.encounter.combatRoundState as CombatRoundState;
  const command = state.commands.at(-1)!;
  const attacker = state.participants.find((entry) => entry.participantId === ATTACKER)!;
  const result = Object.values(attacker.attackResultsByOpportunity ?? {})[0]!;
  return { command, result, state };
}

/**
 * Fixture guard: the #832 shape. The attack misses against the defender's full DB and would
 * connect against the unaware DB an unaware review re-resolves it with, so only awareness can
 * decide whether a review is owed.
 */
function expectTheMissWouldConnectAgainstTheUnawareDb(input: {
  command: CombatRoundState["commands"][number];
  label: string;
  result: CombatRoundAttackRollResult;
}) {
  const unawareDb =
    (input.command.facts.defenderCalculation as { flatDbAdjustment?: number } | undefined)
      ?.flatDbAdjustment ?? 0;
  const againstUnawareDb = buildCombatRoundAttackRollResult({
    ...input.result,
    defenderDb: unawareDb,
  });
  console.log(
    `#874 route fixture (${input.label}): ob=${input.result.ob} rollTotal=${input.result.rollTotal} defenderDb=${input.result.defenderDb} lookupTotal=${input.result.lookupTotal} hit=${input.result.hit} unawareDb=${unawareDb} hitAgainstUnawareDb=${againstUnawareDb.hit}`,
  );
  expect(input.result.hit).toBe(false);
  expect(againstUnawareDb.hit).toBe(true);
}

describe("roll-attack route: a melee miss and the defense review (#874)", () => {
  afterEach(() => vi.clearAllMocks());

  it("records a visible attacker's melee miss at the attack commit and schedules no review", async () => {
    const { command, result, state } = await rollTheMiss({ attackerHidden: false });
    expectTheMissWouldConnectAgainstTheUnawareDb({ command, label: "visible", result });

    expect(projectedCommands(state)).not.toContain("commit_defense_review");
    expect(state.phaseResolutionCursor?.substep).not.toBe("defense");
    expect(state.phaseResolutionStatuses[ATTACKER]?.phase1?.substep).toBe("done");
    const resolution = state.phaseResolutionResults.find(
      (entry) => entry.attackResultId === getCombatRoundAttackResultId({ result, roundNumber: 1 }),
    );
    expect(resolution).toBeDefined();
    expect(resolution?.defenseSnapshotId).toBeUndefined();
    expect(state.defenseSnapshots).toEqual([]);
    expect(command.type).toBe("roll_attack");
    expect(command.facts.defenseReviewNotOwed).toBe(true);
    const event = state.events.find((entry) => entry.commandId === command.id);
    expect(event?.facts.publicOutcome).toMatchObject({ hit: false });
  });

  it("keeps the review for a hidden attacker's miss that an unaware review could turn into a hit", async () => {
    const { command, result, state } = await rollTheMiss({ attackerHidden: true });
    expectTheMissWouldConnectAgainstTheUnawareDb({ command, label: "hidden", result });

    expect(projectedCommands(state)).toContain("commit_defense_review");
    expect(state.phaseResolutionCursor).toMatchObject({
      participantId: DEFENDER,
      phase: "phase1",
      substep: "defense",
    });
    expect(state.phaseResolutionResults).toEqual([]);
    expect(command.facts).not.toHaveProperty("defenseReviewNotOwed");
  });
});
