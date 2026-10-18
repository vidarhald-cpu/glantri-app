import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCombatProgressionProjection,
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import { weaponTemplates } from "@glantri/content";

/**
 * #691 — the write-side half of the Alpha blocker.
 *
 * `createCombatParticipantPairKey` refuses a pair of identical participants, and that refusal was
 * reached only when the round was **read**. A declaration whose attack targeted its own declarer
 * was therefore accepted and persisted whenever nothing else happened to detect the mismatch — a
 * virtual unarmed source is legitimately owned by every participant, so weapon-ownership
 * resolution never fired — after which every read of the encounter raised
 * `409 "A participant pair requires two distinct participants."`, the round could not advance, and
 * "Clear current step" did not recover it.
 *
 * This suite drives the **real HTTP declaration route** against state produced by the **real
 * engine**, and asserts the three properties the control-plane ruling names:
 *
 * 1. a declaration whose attack targets its own attacker is refused **before persistence**,
 *    for an unarmed source (the case that used to persist) and for a real weapon alike;
 * 2. an attack source the actor does not own is refused, so actor/source ownership is enforced on
 *    write and not merely on the panel;
 * 3. the refusals are inert — the encounter stays readable afterwards, every participant can still
 *    declare normally, and the round advances.
 */

const mocks = vi.hoisted(() => {
  const adminUser = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
  return {
    adminUser,
    campaignService: {
      getCampaignById: vi.fn(),
    },
    encounterService: {
      commitCombatParticipantStateMutation: vi.fn(),
      commitCombatParticipantStateMutations: vi.fn(),
      commitCombatModifierReview: vi.fn(),
      commitCombatModifierReviews: vi.fn(),
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

/** The armed participant, then the unarmed one. Both halves of the defect in one encounter. */
const ARMED_ID = "swordsman";
const UNARMED_ID = "brawler";
const PARTICIPANT_IDS = [ARMED_ID, UNARMED_ID] as const;

const PUNCH_TEMPLATE_ID = "virtual-weapon-template-punch";
const PUNCH_ATTACK_MODE_ID = "mode-1";

const broadSwordTemplate = weaponTemplates.find((template) => template.name === "Broad sword");
const SWORD_TEMPLATE_ID = broadSwordTemplate?.id ?? "weapon-template-broad-sword";
const SWORD_ITEM_ID = `item-${SWORD_TEMPLATE_ID}`;
const SWORD_ATTACK_MODE_ID = broadSwordTemplate?.attackModes?.[0]?.id ?? "mode-1";

function encounterParticipant(id: string, order: number) {
  return {
    characterId: `character-${id}`,
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id,
    initiative: 0,
    label: id,
    order,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${id}`,
  };
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
    participants: PARTICIPANT_IDS.map((id, index) => encounterParticipant(id, index)),
    scenarioId: "scenario-1",
    status: "active",
    title: "Actor and target are not the same combatant",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as EncounterSession;
}

/** One ready Broad sword in the primary weapon slot, in the shape the route's resolver reads. */
function swordEquipmentState(characterId: string) {
  return {
    activeLoadoutByCharacterId: {
      [characterId]: { activePrimaryWeaponItemId: SWORD_ITEM_ID },
    },
    itemsById: {
      [SWORD_ITEM_ID]: { id: SWORD_ITEM_ID, templateId: SWORD_TEMPLATE_ID },
    },
    locationsById: {},
    templatesById: { [SWORD_TEMPLATE_ID]: broadSwordTemplate },
  };
}

function scenarioParticipant(id: string): ScenarioParticipant {
  return {
    characterId: `character-${id}`,
    controlledByUserId: "player-1",
    id: `scenario-${id}`,
    isActive: true,
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      displayName: id,
      ...(id === ARMED_ID ? { equipmentState: swordEquipmentState(`character-${id}`) } : {}),
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
      combatEffects: undefined,
      conditions: [],
      equipment: {},
      health: {},
      modifiers: [],
      resources: {},
    },
    updatedAt: "2026-07-30T08:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

/** The real engine, walked only as far as the declaration step the defect lives on. */
function combatAtDeclaration(): CombatRoundState {
  let state: CombatRoundState = initializeCombatRoundState({ encounter: baseEncounter() });
  state = setCombatRoundCombatExperienceDifficulty({ difficulty: 26, state });
  for (const participant of state.participants) {
    state = rollCombatRoundCombatExperience({
      command: { createdAt: "2026-01-01T00:01:00.000Z", createdByUserId: "gm-1" },
      participantId: participant.participantId,
      rng: () => 0.5,
      skillTotal: 0,
      state,
    }).state;
  }
  if (state.currentStep !== "select_actions") {
    throw new Error(`The engine did not reach select_actions (got ${state.currentStep}).`);
  }
  return state;
}

interface RouteWorld {
  readonly app: Awaited<ReturnType<typeof buildApp>>;
  roundState(): CombatRoundState;
  revision(): string;
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(scenariosRoutes);
  return app;
}

async function openWorld(initialState: CombatRoundState): Promise<RouteWorld> {
  let encounter: Record<string, unknown> = {
    ...(baseEncounter() as unknown as Record<string, unknown>),
    combatRoundState: initialState,
    currentRound: initialState.roundNumber,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  let participants = PARTICIPANT_IDS.map((id) => scenarioParticipant(id));

  mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
  mocks.encounterService.getEncounterById.mockImplementation(async () => encounter);
  mocks.encounterService.updateEncounter.mockImplementation(
    async (update: { session: Record<string, unknown> }) => {
      encounter = update.session;
      return encounter;
    },
  );
  mocks.encounterService.updateCombatEncounter.mockImplementation(
    async (update: { session: Record<string, unknown> }) => {
      encounter = update.session;
      return encounter;
    },
  );
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { participantId: string; state: unknown }) => {
      participants = participants.map((entry) =>
        entry.id === update.participantId
          ? ({ ...entry, state: update.state } as ScenarioParticipant)
          : entry,
      );
      return participants.find((entry) => entry.id === update.participantId);
    },
  );
  mocks.encounterService.commitCombatParticipantStateMutation.mockImplementation(
    async (update: {
      participant: { id: string };
      session: Record<string, unknown>;
      state: unknown;
    }) => {
      const saved = await mocks.encounterService.updateEncounter({ session: update.session });
      const participant = await mocks.encounterService.updateScenarioParticipantState({
        participantId: update.participant.id,
        state: update.state,
      });
      return { encounter: saved, participant };
    },
  );
  mocks.encounterService.commitCombatParticipantStateMutations.mockImplementation(
    async (update: {
      participants: { participant: { id: string }; state: unknown }[];
      session: Record<string, unknown>;
    }) => {
      const saved = await mocks.encounterService.updateEncounter({ session: update.session });
      const changed: unknown[] = [];
      for (const entry of update.participants) {
        changed.push(
          await mocks.encounterService.updateScenarioParticipantState({
            participantId: entry.participant.id,
            state: entry.state,
          }),
        );
      }
      return { encounter: saved, participants: changed };
    },
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
    app: await buildApp(),
    revision: () => encounter.updatedAt as string,
    roundState: () => encounter.combatRoundState as CombatRoundState,
  };
}

function requireDeclarationTask(
  state: CombatRoundState,
  participantId: string,
): { executionGroupId: string; id: string } {
  const projection = buildCombatProgressionProjection(state);
  const task = projection.boundary.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .filter((candidate) => candidate.expectedCommand === "declare_action")
    .find(
      (candidate) =>
        (candidate.owner?.kind === "combatant" &&
          candidate.owner.participantId === participantId) ||
        candidate.identity.participantId === participantId,
    );
  if (!task) throw new Error(`No projected declare_action task for ${participantId}.`);
  return { executionGroupId: task.executionGroupId, id: task.id };
}

/** The canonical GM boundary-advance task for whatever boundary the round currently sits on. */
function requireBoundaryAdvance(state: CombatRoundState): {
  commandType: "advance_combat_boundary" | "complete_round";
  executionGroupId: string;
  expectedBoundary: string;
  id: string;
  targetBoundary: string;
} {
  const projection = buildCombatProgressionProjection(state);
  const task = projection.boundary.processes
    .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
    .find(
      (candidate) =>
        candidate.kind === "gm_advance_boundary" && Boolean(candidate.transition?.targetBoundary),
    );
  if (!task) throw new Error("No projected boundary-advance task.");
  if (
    task.expectedCommand !== "advance_combat_boundary" &&
    task.expectedCommand !== "complete_round"
  ) {
    throw new Error(`Unexpected boundary command ${task.expectedCommand}.`);
  }
  return {
    commandType: task.expectedCommand,
    executionGroupId: task.executionGroupId,
    expectedBoundary: projection.boundary.kind,
    id: task.id,
    targetBoundary: task.transition!.targetBoundary,
  };
}

function unarmedSource() {
  return {
    attackModeId: PUNCH_ATTACK_MODE_ID,
    opportunitySlot: "attack_1" as const,
    slot: "virtual" as const,
    sourceKind: "unarmed" as const,
    templateId: PUNCH_TEMPLATE_ID,
  };
}

function swordSource() {
  return {
    attackModeId: SWORD_ATTACK_MODE_ID,
    opportunitySlot: "attack_1" as const,
    scenarioItemId: SWORD_ITEM_ID,
    slot: "primary" as const,
    sourceKind: "weapon" as const,
    templateId: SWORD_TEMPLATE_ID,
  };
}

function declarationPayload(input: {
  actorId: string;
  source: Record<string, unknown>;
  targetId: string;
  task: { executionGroupId: string; id: string };
  revision: string;
}) {
  return {
    actionId: "attack_parry",
    combatContext: {},
    executionGroupId: input.task.executionGroupId,
    expectedRevision: input.revision,
    phaseAttackSources: { phase1: input.source },
    phaseContexts: { phase1: { targetParticipantId: input.targetId } },
    scenarioParticipantId: `scenario-${input.actorId}`,
    taskId: input.task.id,
  };
}

function declarationFor(state: CombatRoundState, participantId: string) {
  return state.participants.find((participant) => participant.participantId === participantId)
    ?.declaration;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("#691 — the declaration route refuses impossible actor/target and actor/source combinations", () => {
  it("refuses a self-targeted attack before persistence, unarmed and armed, and leaves the encounter readable and advanceable", async () => {
    const world = await openWorld(combatAtDeclaration());
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const revisionBeforeRefusals = world.revision();

      // (1) The unarmed case — the one that used to be accepted and persisted, because a virtual
      // unarmed template is a source both participants legitimately own, so nothing detected that
      // the declarer and the target were the same combatant.
      const unarmedSelf = await world.app.inject({
        method: "POST",
        payload: declarationPayload({
          actorId: UNARMED_ID,
          revision: world.revision(),
          source: unarmedSource(),
          targetId: UNARMED_ID,
          task: requireDeclarationTask(world.roundState(), UNARMED_ID),
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(unarmedSelf.statusCode).toBe(400);
      expect(unarmedSelf.json()).toMatchObject({
        error: "An attack cannot target its own attacker.",
      });
      expect(declarationFor(world.roundState(), UNARMED_ID)).toBeUndefined();

      // (1) again, with a real weapon the actor genuinely owns, so the refusal is the invariant
      // rather than a weapon-ownership failure standing in for it.
      const armedSelf = await world.app.inject({
        method: "POST",
        payload: declarationPayload({
          actorId: ARMED_ID,
          revision: world.revision(),
          source: swordSource(),
          targetId: ARMED_ID,
          task: requireDeclarationTask(world.roundState(), ARMED_ID),
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(armedSelf.statusCode).toBe(400);
      expect(armedSelf.json()).toMatchObject({
        error: "An attack cannot target its own attacker.",
      });
      expect(declarationFor(world.roundState(), ARMED_ID)).toBeUndefined();

      // (2) Actor/source ownership: the unarmed participant names the swordsman's item. The actor
      // does not own it, so the source cannot be resolved for them.
      const foreignSource = await world.app.inject({
        method: "POST",
        payload: declarationPayload({
          actorId: UNARMED_ID,
          revision: world.revision(),
          source: swordSource(),
          targetId: ARMED_ID,
          task: requireDeclarationTask(world.roundState(), UNARMED_ID),
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(foreignSource.statusCode).toBe(400);
      expect(foreignSource.json().error).toContain("Phase 1 weapon source is missing");
      expect(declarationFor(world.roundState(), UNARMED_ID)).toBeUndefined();

      // (3) Every refusal was inert: nothing was written at all.
      expect(world.revision()).toBe(revisionBeforeRefusals);
      expect(world.roundState().currentStep).toBe("select_actions");

      // (3) The encounter is still readable through its own route — the symptom of the wedge was a
      // 409 on exactly this read.
      const read = await world.app.inject({
        method: "GET",
        url: "/encounters/encounter-1",
      });
      expect(read.statusCode).toBe(200);
      expect(read.json().encounter.combatRoundState.currentStep).toBe("select_actions");

      // (3) And it is recoverable: both participants declare normally against each other, with the
      // same sources the refused requests used.
      const unarmedValid = await world.app.inject({
        method: "POST",
        payload: declarationPayload({
          actorId: UNARMED_ID,
          revision: world.revision(),
          source: unarmedSource(),
          targetId: ARMED_ID,
          task: requireDeclarationTask(world.roundState(), UNARMED_ID),
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(unarmedValid.statusCode, unarmedValid.body).toBe(200);
      expect(declarationFor(world.roundState(), UNARMED_ID)?.actionId).toBe("attack_parry");

      const armedValid = await world.app.inject({
        method: "POST",
        payload: declarationPayload({
          actorId: ARMED_ID,
          revision: world.revision(),
          source: swordSource(),
          targetId: UNARMED_ID,
          task: requireDeclarationTask(world.roundState(), ARMED_ID),
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(armedValid.statusCode, armedValid.body).toBe(200);
      expect(declarationFor(world.roundState(), ARMED_ID)?.actionId).toBe("attack_parry");

      // (3) The round then advances off the declaration boundary through the real GM route, which
      // the wedged encounter could never do, and the encounter is still readable afterwards.
      const boundary = requireBoundaryAdvance(world.roundState());
      const advanced = await world.app.inject({
        method: "POST",
        payload: {
          commandType: boundary.commandType,
          executionGroupId: boundary.executionGroupId,
          expectedBoundary: boundary.expectedBoundary,
          expectedRevision: world.revision(),
          targetBoundary: boundary.targetBoundary,
          taskId: boundary.id,
        },
        url: "/encounters/encounter-1/combat-round/advance-current-step",
      });
      expect(advanced.statusCode, advanced.body).toBe(200);
      expect(world.roundState().currentStep).not.toBe("select_actions");

      const afterAdvance = await world.app.inject({
        method: "GET",
        url: "/encounters/encounter-1",
      });
      expect(afterAdvance.statusCode).toBe(200);
      expect(afterAdvance.json().encounter.combatRoundState.currentStep).not.toBe("select_actions");
    } finally {
      randomSpy.mockRestore();
      await world.app.close();
    }
  });
});
