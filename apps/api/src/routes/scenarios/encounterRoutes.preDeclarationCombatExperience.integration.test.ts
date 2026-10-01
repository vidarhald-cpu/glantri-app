import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  advanceCombatRoundStep,
  buildCombatProgressionProjection,
  commitCombatRoundEndParticipantReview,
  initializeCombatRoundState,
  isCombatStartExperienceRollRequired,
  prepareCombatRoundEndReview,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

/**
 * #465 / #215 ruling 2, and #465 product-owner rulings 1 and 3.
 *
 * The defect this file exists to prevent was invisible because every test for the pre-declaration
 * step called pure predicates on hand-built states. Not one reached a production entry point, so the
 * step shipped able to host nothing and the GM had no route to the check it exists to carry.
 *
 * So this suite does the opposite in both halves:
 *
 * 1. the state is produced by the **real engine** — `initializeCombatRoundState`, real Combat
 *    Experience rolls, and `advanceCombatRoundStep` walked forward until the engine's *own* schedule
 *    makes checks due for two participants at once. Nothing is hand-constructed, and nothing asserts
 *    a round number the fixture was told to produce;
 * 2. every Combat Experience and declaration operation then goes through the **real HTTP routes**,
 *    including the projection-backed task identity (`taskId` / `executionGroupId`) each route
 *    demands, so the difficulty and roll authorization path is genuinely exercised rather than
 *    bypassed by calling the domain function directly.
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

const PARTICIPANT_IDS = ["gladiator", "guard"] as const;

function encounterParticipant(id: string, order: number) {
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
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as EncounterSession;
}

function scenarioParticipant(id: string): ScenarioParticipant {
  return {
    controlledByUserId: "player-1",
    id: `scenario-${id}`,
    isActive: true,
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: id },
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

function completeCleanRoundEndReview(state: CombatRoundState): CombatRoundState {
  const reviewed = prepareCombatRoundEndReview({
    command: { createdAt: "2026-01-01T00:09:00.000Z", createdByUserId: "gm-1" },
    state,
  });

  return reviewed.participants.reduce<CombatRoundState>((current, participant, index) => {
    if (
      current.roundEndReview?.participantReviews[participant.participantId]?.status === "complete"
    )
      return current;
    return commitCombatRoundEndParticipantReview({
      command: {
        createdAt: `2026-01-01T00:09:${String(index + 1).padStart(2, "0")}.000Z`,
        createdByUserId: "gm-1",
      },
      participantId: participant.participantId,
      scenarioParticipantId: `scenario-${participant.participantId}`,
      state: current,
    }).state;
  }, reviewed);
}

/**
 * Walks the real engine forward from round 1 until it puts the round in `pre_declaration` with **two
 * or more** participants whose Combat Experience check has become due. The round number is whatever
 * the engine's own schedule produces; the test asserts only that it is a later round.
 */
function combatWithTwoDueChecks(): { dueParticipantIds: string[]; state: CombatRoundState } {
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

  for (let guard = 0; guard < 200; guard += 1) {
    if (state.currentStep === "round_summary") state = completeCleanRoundEndReview(state);
    state = advanceCombatRoundStep(state);
    if (state.currentStep !== "pre_declaration") continue;

    const due = state.participants
      .filter((participant) =>
        isCombatStartExperienceRollRequired({
          participantId: participant.participantId,
          state,
        }),
      )
      .map((participant) => participant.participantId);
    if (due.length >= 2) return { dueParticipantIds: due, state };
  }

  throw new Error("The engine never made two Combat Experience checks due at pre-declaration.");
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

/**
 * Serves one mutable encounter through the real repository seams the routes call, so a sequence of
 * HTTP requests accumulates state exactly as it would in the product.
 */
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
  // The clear-current-step route commits the encounter and every affected participant together when
  // it removes a command that wrote participant state — a Combat Experience roll is one. Without this
  // seam the route's save silently went nowhere and the test read back the pre-clear state.
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

interface ProjectedTask {
  executionGroupId: string;
  id: string;
}

/**
 * The projection-backed identity the routes require. Resolving it here is deliberate: a command that
 * has no projected task cannot be addressed at all, which is exactly the property clause 6 asserts.
 */
function findProjectedTask(
  state: CombatRoundState,
  expectedCommand: string,
  participantId?: string,
): ProjectedTask | undefined {
  const projection = buildCombatProgressionProjection(state);
  return projection.boundary.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .filter((task) => task.expectedCommand === expectedCommand)
    .filter(
      (task) =>
        !participantId ||
        (task.owner?.kind === "combatant" && task.owner.participantId === participantId) ||
        task.identity.participantId === participantId,
    )
    .map((task) => ({ executionGroupId: task.executionGroupId, id: task.id }))[0];
}

function requireProjectedTask(
  state: CombatRoundState,
  expectedCommand: string,
  participantId?: string,
): ProjectedTask {
  const task = findProjectedTask(state, expectedCommand, participantId);
  if (!task) throw new Error(`No projected ${expectedCommand} task for ${participantId ?? "gm"}.`);
  return task;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("#465 — a round with several due Combat Experience checks, driven through the API", () => {
  it("holds the round in pre-declaration until every due check is discharged, and refuses declaration meanwhile", async () => {
    // (1) The real engine produces the state, and (2) two participants are due at once.
    const { dueParticipantIds, state } = combatWithTwoDueChecks();
    expect(dueParticipantIds.length).toBeGreaterThanOrEqual(2);
    expect(state.roundNumber).toBeGreaterThan(1);
    expect(state.currentStep).toBe("pre_declaration");

    const [participantA, participantB] = dueParticipantIds;
    const world = await openWorld(state);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      // (3) The real difficulty route, authorized through the real projection task identity. Start
      // New Round closes the window, so without this the step can host nothing.
      const difficultyTask = requireProjectedTask(
        world.roundState(),
        "set_combat_experience_difficulty",
      );
      const openedWindow = await world.app.inject({
        method: "POST",
        payload: {
          difficulty: 26,
          executionGroupId: difficultyTask.executionGroupId,
          expectedRevision: world.revision(),
          taskId: difficultyTask.id,
        },
        url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
      });
      expect(openedWindow.statusCode).toBe(200);
      expect(world.roundState().currentStep).toBe("pre_declaration");

      // (6) Ordinary action declaration is unavailable while an obligation remains: the boundary
      // projects no `declare_action` task at all, so the route cannot be addressed and refuses.
      expect(findProjectedTask(world.roundState(), "declare_action")).toBeUndefined();
      const earlyDeclaration = await world.app.inject({
        method: "POST",
        payload: {
          actionId: "pass",
          executionGroupId: difficultyTask.executionGroupId,
          expectedParticipantRevision: "2026-07-30T08:00:00.000Z",
          expectedRevision: world.revision(),
          scenarioParticipantId: `scenario-${participantB}`,
          taskId: difficultyTask.id,
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(earlyDeclaration.statusCode).toBe(409);
      expect(world.roundState().currentStep).toBe("pre_declaration");

      // (3) The real roll route for participant A.
      const rollTaskA = requireProjectedTask(
        world.roundState(),
        "roll_combat_experience",
        participantA,
      );
      const rolledA = await world.app.inject({
        method: "POST",
        payload: {
          executionGroupId: rollTaskA.executionGroupId,
          expectedRevision: world.revision(),
          scenarioParticipantId: `scenario-${participantA}`,
          taskId: rollTaskA.id,
        },
        url: "/encounters/encounter-1/combat-round/roll-combat-experience",
      });
      expect(rolledA.statusCode).toBe(200);

      // (4) A is discharged, B is not — the round MUST stay in pre-declaration. Advancing here is
      // what silently skipped B's obligation before this repair.
      expect(
        isCombatStartExperienceRollRequired({
          participantId: participantA,
          state: world.roundState(),
        }),
      ).toBe(false);
      expect(
        isCombatStartExperienceRollRequired({
          participantId: participantB,
          state: world.roundState(),
        }),
      ).toBe(true);
      expect(world.roundState().currentStep).toBe("pre_declaration");

      // (6) again, at the state that used to be `select_actions` with B silently skipped.
      expect(findProjectedTask(world.roundState(), "declare_action")).toBeUndefined();
      const midDeclaration = await world.app.inject({
        method: "POST",
        payload: {
          actionId: "pass",
          executionGroupId: rollTaskA.executionGroupId,
          expectedParticipantRevision: "2026-07-30T08:00:00.000Z",
          expectedRevision: world.revision(),
          scenarioParticipantId: `scenario-${participantB}`,
          taskId: rollTaskA.id,
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(midDeclaration.statusCode).toBe(409);

      // (3) The real roll route for participant B.
      const rollTaskB = requireProjectedTask(
        world.roundState(),
        "roll_combat_experience",
        participantB,
      );
      const rolledB = await world.app.inject({
        method: "POST",
        payload: {
          executionGroupId: rollTaskB.executionGroupId,
          expectedRevision: world.revision(),
          scenarioParticipantId: `scenario-${participantB}`,
          taskId: rollTaskB.id,
        },
        url: "/encounters/encounter-1/combat-round/roll-combat-experience",
      });
      expect(rolledB.statusCode).toBe(200);

      // (5) The final discharge — and only the final discharge — advances the round.
      expect(world.roundState().currentStep).toBe("select_actions");
      for (const participantId of dueParticipantIds) {
        expect(
          isCombatStartExperienceRollRequired({ participantId, state: world.roundState() }),
        ).toBe(false);
      }

      // Declaration is now reachable, which is what makes clause 6 a real restriction rather than a
      // route that never works.
      expect(findProjectedTask(world.roundState(), "declare_action", participantB)).toBeDefined();
    } finally {
      randomSpy.mockRestore();
      await world.app.close();
    }
  });

  it("restores the obligation when the GM clears the pre-declaration step through the real route", async () => {
    // The GM correction control: `POST …/combat-round/clear-current-step` →
    // `clearCurrentCombatRoundStepAndRewind` → `undoLatestCombatRoundCommand`. Undo restored the
    // Combat Experience result but not the due marker the roll had rescheduled, and put the round on
    // `select_actions`, so the obligation evaporated and declaration opened against a removed result.
    const { dueParticipantIds, state } = combatWithTwoDueChecks();
    const [participantA, participantB] = dueParticipantIds;
    const world = await openWorld(state);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const difficultyTask = requireProjectedTask(
        world.roundState(),
        "set_combat_experience_difficulty",
      );
      const openedWindow = await world.app.inject({
        method: "POST",
        payload: {
          difficulty: 26,
          executionGroupId: difficultyTask.executionGroupId,
          expectedRevision: world.revision(),
          taskId: difficultyTask.id,
        },
        url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
      });
      expect(openedWindow.statusCode).toBe(200);

      const dueBefore = world
        .roundState()
        .participants.find(
          (participant) => participant.participantId === participantA,
        )?.combatExperienceDue;
      const experienceBefore = world
        .roundState()
        .participants.find(
          (participant) => participant.participantId === participantA,
        )?.combatExperience;

      const rollTask = requireProjectedTask(
        world.roundState(),
        "roll_combat_experience",
        participantA,
      );
      const rolled = await world.app.inject({
        method: "POST",
        payload: {
          executionGroupId: rollTask.executionGroupId,
          expectedRevision: world.revision(),
          scenarioParticipantId: `scenario-${participantA}`,
          taskId: rollTask.id,
        },
        url: "/encounters/encounter-1/combat-round/roll-combat-experience",
      });
      expect(rolled.statusCode).toBe(200);
      expect(
        isCombatStartExperienceRollRequired({
          participantId: participantA,
          state: world.roundState(),
        }),
      ).toBe(false);

      const cleared = await world.app.inject({
        method: "POST",
        payload: {},
        url: "/encounters/encounter-1/combat-round/clear-current-step",
      });
      expect(cleared.statusCode).toBe(200);

      const afterClear = world.roundState();
      const restored = afterClear.participants.find(
        (participant) => participant.participantId === participantA,
      );

      // The marker is the one that stood before the roll, not a recomputed future-round schedule.
      expect(restored?.combatExperienceDue).toEqual(dueBefore);
      expect(restored?.combatExperience).toEqual(experienceBefore);
      expect(afterClear.currentStep).toBe("pre_declaration");
      expect(
        isCombatStartExperienceRollRequired({ participantId: participantA, state: afterClear }),
      ).toBe(true);
      // The other due participant is untouched: undo must not advance the round for anyone.
      expect(
        isCombatStartExperienceRollRequired({ participantId: participantB, state: afterClear }),
      ).toBe(true);
      // And ordinary declaration is unavailable again, through the real route.
      expect(findProjectedTask(afterClear, "declare_action")).toBeUndefined();
      const declarationAfterClear = await world.app.inject({
        method: "POST",
        payload: {
          actionId: "pass",
          executionGroupId: rollTask.executionGroupId,
          expectedParticipantRevision: "2026-07-30T08:00:00.000Z",
          expectedRevision: world.revision(),
          scenarioParticipantId: `scenario-${participantB}`,
          taskId: rollTask.id,
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      expect(declarationAfterClear.statusCode).toBe(409);
    } finally {
      randomSpy.mockRestore();
      await world.app.close();
    }
  });

  it("keeps the pre-declaration step inside the declaration authorization boundary", async () => {
    const { state } = combatWithTwoDueChecks();
    const projection = buildCombatProgressionProjection(state);

    // Ruling 2: reuse of the existing coarse `declaration` family rather than a new persisted
    // boundary vocabulary member. Falling through to `round_end` is what made both Combat
    // Experience routes 409 regardless of the domain guard.
    expect(projection.boundary.kind).toBe("declaration");
    expect(projection.boundary.processes.map((process) => process.kind)).toContain(
      "combat_experience",
    );
  });
});
