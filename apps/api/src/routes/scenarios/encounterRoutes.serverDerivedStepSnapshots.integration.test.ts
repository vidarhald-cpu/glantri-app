import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { weaponTemplates } from "@glantri/content/equipment";

import {
  COMBAT_ROUND_STEPS,
  buildCombatProgressionProjection,
  advanceCombatRoundStep,
  buildCombatHistorySourceViewFromPersistedSession,
  commitCombatRoundEndParticipantReview,
  prepareCombatRoundEndReview,
  recordCombatRoundDeclaration,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  deriveCombatRoundStepSnapshots,
  getCurrentExecutableCombatTasks,
  withDerivedCombatRoundStepSnapshots,
  getCommittedCombatRoundSteps,
  initializeCombatRoundState,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepSnapshot,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

/**
 * #951 / #889 — the server derives and persists each committed step's authoritative snapshot.
 *
 * Product Owner ruling of 2026-11-06. The six acceptance items are asserted here, each named.
 * Nothing in this file hand-builds a `stepSnapshots` row: every record under assertion was
 * written by a real route handler, and every count is taken from `state.stepSnapshots` rows
 * rather than from rendered or serialized text — the #951 survey matched live-round header lines
 * and reported four phantom records that way.
 */

const mocks = vi.hoisted(() => {
  const adminUser = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
  const playerUser = { email: "player@example.test", id: "player-1", roles: ["player"] };
  const otherPlayerUser = { email: "other@example.test", id: "player-2", roles: ["player"] };
  const strangerUser = { email: "stranger@example.test", id: "player-3", roles: ["player"] };
  return {
    adminUser,
    otherPlayerUser,
    playerUser,
    strangerUser,
    campaignService: { getCampaignById: vi.fn(), listCampaignsByUserAccess: vi.fn() },
    combatStateReadService: { getCombatHistorySourceById: vi.fn() },
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
import {
  buildCombatStepSnapshotFiguresResolver,
  buildCombatStepSnapshotSources,
} from "./combatStepSnapshotFigures";

const PARTICIPANT_IDS = ["gladiator", "guard"] as const;
const CONTROLLER_BY_PARTICIPANT: Record<string, string> = {
  gladiator: "player-1",
  guard: "player-2",
};

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
    title: "Server-derived step snapshots",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as EncounterSession;
}

function scenarioParticipant(id: string): ScenarioParticipant {
  return {
    controlledByUserId: CONTROLLER_BY_PARTICIPANT[id],
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

interface RouteWorld {
  readonly app: Awaited<ReturnType<typeof buildApp>>;
  revision(): string;
  roundState(): CombatRoundState;
  snapshotKeys(): string[];
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(scenariosRoutes);
  return app;
}

async function openWorld(initialState?: CombatRoundState): Promise<RouteWorld> {
  const state = initialState ?? initializeCombatRoundState({ encounter: baseEncounter() });
  let encounter: Record<string, unknown> = {
    ...(baseEncounter() as unknown as Record<string, unknown>),
    combatRoundState: state,
    currentRound: state.roundNumber,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  let participants = PARTICIPANT_IDS.map((id) => scenarioParticipant(id));

  mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
  mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
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
  mocks.encounterService.commitCombatModifierReview.mockImplementation(
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
  mocks.combatStateReadService.getCombatHistorySourceById.mockImplementation(async () =>
    buildCombatHistorySourceViewFromPersistedSession({
      metadata: {
        campaignId: "campaign-1",
        createdAt: encounter.createdAt as string,
        encounterId: "encounter-1",
        revision: encounter.updatedAt as string,
        scenarioId: "scenario-1",
        status: "active",
        title: encounter.title as string,
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
  mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([
    { gmUserId: "gm-1", id: "campaign-1", name: "Border Trouble", status: "active" },
  ]);
  mocks.campaignService.getCampaignById.mockResolvedValue({
    gmUserId: "gm-1",
    id: "campaign-1",
    name: "Border Trouble",
    status: "active",
  });
  mocks.scenarioService.userHasPlayerScenarioAccess.mockImplementation(
    async (_scenarioId: string, userId: string) => userId !== "player-3",
  );

  const roundState = () => encounter.combatRoundState as CombatRoundState;

  return {
    app: await buildApp(),
    revision: () => encounter.updatedAt as string,
    roundState,
    snapshotKeys: () =>
      roundState().stepSnapshots.map((snapshot) => `${snapshot.step}:${snapshot.participantId}`),
  };
}

interface ProjectedTask {
  blockerCount: number;
  executionGroupId: string;
  id: string;
  expectedCommand: string;
  kind: string;
  scenarioParticipantId?: string;
  transition?: { currentBoundary: string; targetBoundary: string };
}

function projectedTasks(state: CombatRoundState): ProjectedTask[] {
  const all = buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => [...stage.tasks, ...stage.executionGroups.flatMap((group) => group.tasks)])
    .map((task) => ({
      blockerCount: task.blockerIds.length,
      executionGroupId: task.executionGroupId,
      expectedCommand: task.expectedCommand,
      id: task.id,
      kind: task.kind,
      scenarioParticipantId: (() => {
        const participantId =
          (task.owner?.kind === "combatant" ? task.owner.participantId : undefined) ??
          task.identity.participantId;
        return participantId ? `scenario-${participantId}` : undefined;
      })(),
      transition: task.transition
        ? {
            currentBoundary: task.transition.currentBoundary,
            targetBoundary: task.transition.targetBoundary,
          }
        : undefined,
    }));
  return [...new Map(all.map((task) => [task.id, task])).values()];
}

function findBoundaryTask(state: CombatRoundState): ProjectedTask | undefined {
  return projectedTasks(state).find((task) => task.kind === "gm_advance_boundary");
}

/**
 * Round 1 opens at `select_actions` with the Combat Experience difficulty and two rolls blocking
 * the declaration boundary. Discharging them through the real routes is what makes a boundary
 * advance addressable at all.
 */
async function dischargeCombatExperience(world: RouteWorld): Promise<void> {
  const difficulty = projectedTasks(world.roundState()).find(
    (task) => task.expectedCommand === "set_combat_experience_difficulty",
  );
  if (difficulty) {
    const response = await world.app.inject({
      method: "POST",
      payload: {
        difficulty: 26,
        executionGroupId: difficulty.executionGroupId,
        expectedRevision: world.revision(),
        taskId: difficulty.id,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });
    if (response.statusCode !== 200) {
      throw new Error(`difficulty route ${response.statusCode}: ${response.body}`);
    }
  }
  for (let guard = 0; guard < 8; guard += 1) {
    const roll = projectedTasks(world.roundState()).find(
      (task) => task.expectedCommand === "roll_combat_experience" && task.blockerCount === 0,
    );
    if (!roll) return;
    const response = await world.app.inject({
      method: "POST",
      payload: {
        executionGroupId: roll.executionGroupId,
        expectedRevision: world.revision(),
        scenarioParticipantId: roll.scenarioParticipantId,
        taskId: roll.id,
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });
    if (response.statusCode !== 200) {
      throw new Error(`roll route ${response.statusCode}: ${response.body}`);
    }
  }
}

async function declareEveryParticipant(world: RouteWorld): Promise<void> {
  for (const participantId of PARTICIPANT_IDS) {
    const declared = world
      .roundState()
      .participants.find((participant) => participant.participantId === participantId)
      ?.declaration?.actionId;
    if (declared) continue;
    const task = projectedTasks(world.roundState()).find(
      (candidate) =>
        candidate.expectedCommand === "declare_action" &&
        candidate.blockerCount === 0 &&
        candidate.scenarioParticipantId === `scenario-${participantId}` &&
        !candidate.id.endsWith(":gm-edit"),
    );
    if (!task) continue;
    const response = await world.app.inject({
      method: "POST",
      payload: {
        actionId: "pass",
        executionGroupId: task.executionGroupId,
        expectedParticipantRevision: "2026-07-30T08:00:00.000Z",
        expectedRevision: world.revision(),
        scenarioParticipantId: task.scenarioParticipantId,
        taskId: task.id,
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    if (response.statusCode !== 200) {
      throw new Error(`declaration route ${response.statusCode}: ${response.body}`);
    }
  }
}

/**
 * Commits each participant's modifier review through the real declaration route. This is the
 * #889 surface: the review commit is what used to leave every participant but the acted one
 * without a record of the review step.
 */
async function commitModifierReviews(world: RouteWorld): Promise<void> {
  for (let guard = 0; guard < 8; guard += 1) {
    const task = projectedTasks(world.roundState()).find(
      (candidate) =>
        (candidate.expectedCommand === "review_modifiers_phase1" ||
          candidate.expectedCommand === "review_modifiers_phase2") &&
        candidate.blockerCount === 0,
    );
    if (!task) return;
    const participant = world
      .roundState()
      .participants.find(
        (candidate) => `scenario-${candidate.participantId}` === task.scenarioParticipantId,
      );
    const response = await world.app.inject({
      method: "POST",
      payload: {
        actionId: participant?.declaration?.actionId ?? "pass",
        combatContext: participant?.declaration?.combatContext,
        executionGroupId: task.executionGroupId,
        expectedParticipantRevision: "2026-07-30T08:00:00.000Z",
        expectedRevision: world.revision(),
        scenarioParticipantId: task.scenarioParticipantId,
        taskId: task.id,
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    if (response.statusCode !== 200) {
      throw new Error(`review route ${response.statusCode}: ${response.body}`);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("#951 / #889 — the server derives and persists each committed step's snapshot", () => {
  /**
   * Acceptance item 1 — all relevant steps.
   *
   * The census is 13. Scope is stated by construction: the steps the round actually passes
   * through under this fixture's declarations get a record, and the walk reports which those are.
   */
  it("item 1 — all 13 steps are recorded for every participant, with the round's own walk", () => {
    // The census is 13 and all 13 are in scope: a round passes through, or jumps over, every one
    // of them, and the inspector can select any of them. The walk below is the engine's own
    // (`advanceCombatRoundStep`), with the server-side derivation applied at each commit exactly
    // as the three transition routes apply it.
    expect(COMBAT_ROUND_STEPS).toHaveLength(13);
    let state = initializeCombatRoundState({ encounter: baseEncounter() });
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
    for (const participant of state.participants) {
      state = recordCombatRoundDeclaration({
        declaration: {
          actionId: "pass",
          roundNumber: state.roundNumber,
          submittedAt: "2026-01-01T00:02:00.000Z",
          submittedByUserId: "gm-1",
        },
        participantId: participant.participantId,
        state,
        submittedBy: "gm",
      });
    }

    const walked: CombatRoundStep[] = [state.currentStep];
    for (let guard = 0; guard < 80; guard += 1) {
      if (state.currentStep === "round_summary") {
        const reviewed = prepareCombatRoundEndReview({
          command: { createdAt: "2026-01-01T00:09:00.000Z", createdByUserId: "gm-1" },
          state,
        });
        state = reviewed.participants.reduce<CombatRoundState>(
          (current, participant, index) =>
            current.roundEndReview?.participantReviews[participant.participantId]?.status ===
            "complete"
              ? current
              : commitCombatRoundEndParticipantReview({
                  command: {
                    createdAt: `2026-01-01T00:09:${String(index + 1).padStart(2, "0")}.000Z`,
                    createdByUserId: "gm-1",
                  },
                  participantId: participant.participantId,
                  scenarioParticipantId: `scenario-${participant.participantId}`,
                  state: current,
                }).state,
          reviewed,
        );
      }
      const previous = state;
      const next = advanceCombatRoundStep(previous, {
        command: { createdAt: "2026-01-01T00:05:00.000Z", createdByUserId: "gm-1" },
      });
      state = withDerivedCombatRoundStepSnapshots({
        committedAt: "2026-01-01T00:05:00.000Z",
        nextState: next,
        previousState: previous,
      });
      if (state.currentStep !== walked.at(-1)) walked.push(state.currentStep);
      if (state.roundNumber > 2) break;
      if (state.roundNumber > previous.roundNumber) {
        // Round 2 opens at `pre_declaration`, so declarations are made again for it.
        for (const participant of state.participants) {
          state = recordCombatRoundDeclaration({
            declaration: {
              actionId: "pass",
              roundNumber: state.roundNumber,
              submittedAt: "2026-01-01T00:12:00.000Z",
              submittedByUserId: "gm-1",
            },
            participantId: participant.participantId,
            state,
            submittedBy: "gm",
          });
        }
        continue;
      }
      if (state.currentStep === previous.currentStep) {
        walked.push(`STALLED@${previous.currentStep}` as CombatRoundStep);
        break;
      }
    }

    expect(
      walked.filter((step) => String(step).startsWith("STALLED")),
      `walk: ${walked.join(" -> ")}`,
    ).toEqual([]);

    // Counted from `stepSnapshots` rows, never from text: the archived rounds' own records.
    const roundOne = state.rounds.find((round) => round.roundNumber === 1);
    const roundTwo = state.rounds.find((round) => round.roundNumber === 2);
    expect(roundOne, `round 1 never closed; walk: ${walked.join(" -> ")}`).toBeDefined();
    expect(roundTwo, `round 2 never closed; walk: ${walked.join(" -> ")}`).toBeDefined();

    // Scope, stated: round 1 opens at `select_actions`, so it never occupies `pre_declaration`
    // and has 12 of the 13 steps. Every later round opens there, and records it.
    expect([...new Set(roundOne!.stepSnapshots.map((snapshot) => snapshot.step))].sort()).toEqual(
      [...COMBAT_ROUND_STEPS].filter((step) => step !== "pre_declaration").sort(),
    );
    expect(roundOne!.stepSnapshots).toHaveLength(12 * PARTICIPANT_IDS.length);
    expect([...new Set(roundTwo!.stepSnapshots.map((snapshot) => snapshot.step))].sort()).toEqual(
      [...COMBAT_ROUND_STEPS].sort(),
    );
    expect(roundTwo!.stepSnapshots).toHaveLength(13 * PARTICIPANT_IDS.length);

    const recorded = new Map<string, Set<string>>();
    for (const snapshot of [...roundOne!.stepSnapshots, ...roundTwo!.stepSnapshots]) {
      const owners = recorded.get(snapshot.step) ?? new Set<string>();
      owners.add(snapshot.participantId);
      recorded.set(snapshot.step, owners);
    }
    expect([...recorded.keys()].sort()).toEqual([...COMBAT_ROUND_STEPS].sort());
    for (const step of COMBAT_ROUND_STEPS) {
      expect([...(recorded.get(step) ?? [])].sort(), `step ${step}`).toEqual(
        [...PARTICIPANT_IDS].sort(),
      );
    }
  });

  /**
   * Acceptance item 2a — the GM's manual boundary advance, driven on its own.
   */
  it("item 2a — the manual boundary advance records the step it leaves", async () => {
    const world = await openWorld();
    try {
      expect(world.snapshotKeys()).toEqual([]);
      await dischargeCombatExperience(world);
      await declareEveryParticipant(world);
      const task = findBoundaryTask(world.roundState());
      if (!task?.transition) {
        throw new Error(
          `no boundary task at ${world.roundState().currentStep}: ${JSON.stringify(
            projectedTasks(world.roundState()).map(
              (candidate) =>
                `${candidate.kind}|${candidate.expectedCommand}|blockers=${candidate.blockerCount}`,
            ),
          )}`,
        );
      }
      const response = await world.app.inject({
        method: "POST",
        payload: {
          commandType: task!.expectedCommand,
          executionGroupId: task!.executionGroupId,
          expectedBoundary: task!.transition!.currentBoundary,
          expectedRevision: world.revision(),
          targetBoundary: task!.transition!.targetBoundary,
          taskId: task!.id,
        },
        url: "/encounters/encounter-1/combat-round/advance-current-step",
      });

      expect(response.statusCode).toBe(200);
      expect(world.snapshotKeys().sort()).toEqual([
        "select_actions:gladiator",
        "select_actions:guard",
      ]);
    } finally {
      await world.app.close();
    }
  });

  /**
   * Acceptance item 2b — `advance-deterministic`, driven on its own. This route carried no
   * snapshots at all before the repair and could not: its body is an execution group, a revision
   * and a task id.
   */
  it("item 2b — the deterministic auto-advance records the step it leaves", async () => {
    const world = await openWorld();
    try {
      await dischargeCombatExperience(world);
      await declareEveryParticipant(world);
      const before = world.roundState();
      expect(world.snapshotKeys()).toEqual([]);
      const task = projectedTasks(before).find(
        (candidate) => candidate.kind === "gm_advance_boundary",
      );
      expect(task).toBeDefined();
      const response = await world.app.inject({
        method: "POST",
        payload: {
          executionGroupId: task!.executionGroupId,
          expectedRevision: world.revision(),
          taskId: task!.id,
        },
        url: "/encounters/encounter-1/combat-round/advance-deterministic",
      });

      expect(response.statusCode).toBe(200);
      expect(world.roundState().currentStep).not.toBe(before.currentStep);
      expect(world.snapshotKeys().length).toBeGreaterThan(0);
      for (const key of world.snapshotKeys()) {
        expect(COMBAT_ROUND_STEPS).toContain(key.split(":")[0] as CombatRoundStep);
      }
      expect(
        world
          .roundState()
          .stepSnapshots.map((snapshot) => snapshot.participantId)
          .sort(),
      ).toContain("guard");
    } finally {
      await world.app.close();
    }
  });

  /**
   * Acceptance item 2c — `run-gm-step-workflow`, driven on its own. Reachable only through the
   * GM automation controls, which is why a single end-to-end walk cannot distinguish it.
   */
  it("item 2c — the GM step workflow records the step it leaves", async () => {
    const world = await openWorld();
    try {
      await dischargeCombatExperience(world);
      await declareEveryParticipant(world);
      const before = world.roundState();
      expect(world.snapshotKeys()).toEqual([]);
      const executable = getCurrentExecutableCombatTasks(
        buildCombatProgressionProjection(before),
      )[0];
      expect(executable, `no executable task at ${before.currentStep}`).toBeDefined();
      const response = await world.app.inject({
        method: "POST",
        payload: {
          encounterId: "encounter-1",
          expectedExecutionGroupId: executable!.executionGroupId,
          expectedProcessId: executable!.processId,
          expectedRevision: world.revision(),
          expectedRound: before.roundNumber,
          expectedStep: before.currentStep,
          expectedTaskId: executable!.id,
          operationFamily: "accept_remaining",
          runId: "run-951",
          schemaVersion: 1,
        },
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });

      expect(response.statusCode, response.body).toBe(200);
      const keys = world.snapshotKeys();
      expect(keys.length, `workflow wrote no record from ${before.currentStep}`).toBeGreaterThan(0);
      expect(keys.sort()).toEqual([...new Set(keys)].sort());
      expect(keys.every((key) => key.endsWith(":gladiator") || key.endsWith(":guard"))).toBe(true);
    } finally {
      await world.app.close();
    }
  });

  /**
   * #889, at the route — the modifier-review commit records the review step for EVERY
   * participant, from the post-review state. Before the repair the one client-built snapshot was
   * `.find()`-ed down to the single acted participant, so every other combatant got no
   * `review_action_modifiers` record even on the good path.
   */
  it("item 2d — the modifier-review commit records the review step for every participant", async () => {
    const world = await openWorld();
    try {
      await dischargeCombatExperience(world);
      await declareEveryParticipant(world);
      const boundary = findBoundaryTask(world.roundState());
      expect(boundary?.transition).toBeDefined();
      const advanced = await world.app.inject({
        method: "POST",
        payload: {
          commandType: boundary!.expectedCommand,
          executionGroupId: boundary!.executionGroupId,
          expectedBoundary: boundary!.transition!.currentBoundary,
          expectedRevision: world.revision(),
          targetBoundary: boundary!.transition!.targetBoundary,
          taskId: boundary!.id,
        },
        url: "/encounters/encounter-1/combat-round/advance-current-step",
      });
      expect(advanced.statusCode, advanced.body).toBe(200);
      expect(world.roundState().currentStep).toBe("review_action_modifiers");

      await commitModifierReviews(world);

      const reviewRecords = world
        .roundState()
        .stepSnapshots.filter((snapshot) => snapshot.step === "review_action_modifiers");
      expect(reviewRecords.map((snapshot) => snapshot.participantId).sort()).toEqual(
        [...PARTICIPANT_IDS].sort(),
      );
      // The record is the server's: its id is derived, not supplied.
      expect(reviewRecords.map((snapshot) => snapshot.id).sort()).toEqual([
        "1:gladiator:review_action_modifiers",
        "1:guard:review_action_modifiers",
      ]);
    } finally {
      await world.app.close();
    }
  });

  /**
   * Acceptance item 5 — an omitted, malformed or hostile client snapshot cannot alter the
   * authoritative stored one.
   *
   * Three payloads to the same route from the same state. The stored record is compared field for
   * field across all three with only the server clock excluded, so a client payload that
   * disagrees with the server's derivation cannot win, cannot corrupt, and cannot be detected in
   * the record at all.
   */
  it("item 5 — omitted, malformed and hostile client snapshots leave an identical stored record", async () => {
    const hostileSnapshot: CombatRoundStepSnapshot = {
      attackSummary: {
        attackMode: "ZZZ",
        dmb: "999",
        initiative: "999",
        maxCrits: "9",
        ob: "999",
        weaponName: "Hostile blade",
      },
      committedAt: "1999-01-01T00:00:00.000Z",
      defenseSummary: { db: "999", dm: "99", parry: "999", sourceName: "Hostile shield" },
      id: "hostile",
      participantId: "gladiator",
      participantLabel: "Impostor",
      roundNumber: 1,
      step: "pre_declaration",
    };
    const payloads: Record<string, unknown>[] = [
      {},
      { stepSnapshots: "not-an-array" },
      { stepSnapshots: [{ nonsense: true }] },
      { stepSnapshots: [hostileSnapshot] },
    ];
    const stored: string[] = [];
    // The Combat Experience roll is the only unseeded input in this fixture, and its result lands
    // in the recorded modifier rows. Seeding it makes the four worlds differ in the client payload
    // and in nothing else.
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    for (const extra of payloads) {
      const world = await openWorld();
      try {
        await dischargeCombatExperience(world);
        await declareEveryParticipant(world);
        const task = findBoundaryTask(world.roundState());
        const response = await world.app.inject({
          method: "POST",
          payload: {
            commandType: task!.expectedCommand,
            executionGroupId: task!.executionGroupId,
            expectedBoundary: task!.transition!.currentBoundary,
            expectedRevision: world.revision(),
            targetBoundary: task!.transition!.targetBoundary,
            taskId: task!.id,
            ...extra,
          },
          url: "/encounters/encounter-1/combat-round/advance-current-step",
        });
        expect(response.statusCode, JSON.stringify(extra)).toBe(200);
        // Every server-authored timestamp is normalised, because each payload runs in its own
        // world and the Combat Experience effect carries its own real clock. Nothing a client
        // can influence is normalised, so a payload that reached the record would still differ.
        stored.push(
          JSON.stringify(world.roundState().stepSnapshots).replace(
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,
            "<server clock>",
          ),
        );
      } finally {
        await world.app.close();
      }
    }

    randomSpy.mockRestore();
    expect(stored).toHaveLength(4);
    expect(
      new Set(stored).size,
      `a client payload changed the stored record:\n${stored.join("\n---\n")}`,
    ).toBe(1);
    for (const record of stored) {
      expect(record).not.toContain("Hostile");
      expect(record).not.toContain("Impostor");
      expect(record).not.toContain('"dmb":"999"');
      expect(record).not.toContain('"id":"hostile"');
      expect(record).toContain('"step":"select_actions"');
    }
  });

  /**
   * Floor class 2 — a player read by response key across the combat-history endpoints, with a
   * paired alive-instrument control so an empty body is distinguishable from a clean one.
   */
  it("floor class 2 — records created for previously-empty steps leak no new key to any player", async () => {
    const world = await openWorld();
    try {
      await dischargeCombatExperience(world);
      await declareEveryParticipant(world);
      const boundary = findBoundaryTask(world.roundState());
      if (boundary?.transition) {
        const advanced = await world.app.inject({
          method: "POST",
          payload: {
            commandType: boundary.expectedCommand,
            executionGroupId: boundary.executionGroupId,
            expectedBoundary: boundary.transition.currentBoundary,
            expectedRevision: world.revision(),
            targetBoundary: boundary.transition.targetBoundary,
            taskId: boundary.id,
          },
          url: "/encounters/encounter-1/combat-round/advance-current-step",
        });
        expect(advanced.statusCode, advanced.body).toBe(200);
      }
      const snapshotCount =
        world.roundState().stepSnapshots.length +
        world.roundState().rounds.flatMap((round) => round.stepSnapshots).length;
      expect(snapshotCount, "nothing was recorded, so this proves nothing").toBeGreaterThan(0);

      const viewers = [
        { expectAccess: true, label: "controlling player", user: mocks.playerUser },
        {
          expectAccess: true,
          label: "another player in the Encounter",
          user: mocks.otherPlayerUser,
        },
        { expectAccess: false, label: "a player with no access", user: mocks.strangerUser },
      ];
      const urls = ["/encounters/encounter-1/combat-history", "/encounters/encounter-1"];

      for (const viewer of viewers) {
        mocks.requireAuthenticatedUser.mockResolvedValue(viewer.user);
        for (const url of urls) {
          const response = await world.app.inject({ method: "GET", url });
          const raw = response.body;
          if (!viewer.expectAccess) {
            expect([403, 404], `${viewer.label} ${url}`).toContain(response.statusCode);
            continue;
          }
          // Alive instrument: the body must actually carry this encounter, otherwise a clean
          // read is indistinguishable from an empty one.
          expect(response.statusCode, `${viewer.label} ${url}: ${raw}`).toBe(200);
          expect(raw, `${viewer.label} ${url} returned nothing recognisable`).toContain(
            "encounter-1",
          );
          // No player-facing body carries the private loadout figures a snapshot can hold.
          expect(raw, `${viewer.label} ${url}`).not.toContain("defenseSummary");
          expect(raw, `${viewer.label} ${url}`).not.toContain("attackSummary");
        }
      }
    } finally {
      mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
      await world.app.close();
    }
  });
});

describe("#951 — the committed-step set a transition leaves behind", () => {
  it("records the steps a boundary jump skips, and refreshes the step a review commit holds", () => {
    // `phase1_resolution:phase2_modifier_review` skips `review_phase_2_actions` and
    // `phase_1_damage` without ever making them current; those steps are selectable in the
    // inspector, so each is recorded from the state that was committed when it was passed.
    expect(
      getCommittedCombatRoundSteps({
        nextStep: "review_phase_2_modifiers",
        previousStep: "phase_1_actions",
        startsNextRound: false,
      }),
    ).toEqual(["phase_1_actions", "review_phase_2_actions", "phase_1_damage"]);
    // A commit that does not move the step refreshes that step's own record.
    expect(
      getCommittedCombatRoundSteps({
        nextStep: "review_action_modifiers",
        previousStep: "review_action_modifiers",
        startsNextRound: false,
      }),
    ).toEqual(["review_action_modifiers"]);
    // The round boundary completes the round: every remaining step is recorded.
    expect(
      getCommittedCombatRoundSteps({
        nextStep: "pre_declaration",
        previousStep: "round_summary",
        startsNextRound: true,
      }),
    ).toEqual(["round_summary"]);
  });

  /**
   * Acceptance item 3 — historical inspection never carries another step's figures under the
   * selected label. Driven across all 13 steps with the at-or-before fallback left in place.
   */
  it("item 3 — the panel resolver reports EXACT at all 13 steps once every step is recorded", () => {
    const state = initializeCombatRoundState({ encounter: baseEncounter() });
    const snapshots = COMBAT_ROUND_STEPS.flatMap((step) =>
      deriveCombatRoundStepSnapshots({ committedAt: "2026-01-01T00:00:00.000Z", state, step }),
    );
    expect(snapshots).toHaveLength(13 * PARTICIPANT_IDS.length);

    const selectedStepIndex = (step: CombatRoundStep) => COMBAT_ROUND_STEPS.indexOf(step);
    const resolve = (participantId: string, selectedStep: CombatRoundStep) =>
      snapshots
        .map((snapshot, sourceIndex) => ({ snapshot, sourceIndex }))
        .filter(
          ({ snapshot }) =>
            snapshot.roundNumber === state.roundNumber &&
            snapshot.participantId === participantId &&
            selectedStepIndex(snapshot.step) >= 0 &&
            selectedStepIndex(snapshot.step) <= selectedStepIndex(selectedStep),
        )
        .sort(
          (left, right) =>
            selectedStepIndex(right.snapshot.step) - selectedStepIndex(left.snapshot.step) ||
            right.sourceIndex - left.sourceIndex,
        )[0]?.snapshot;

    const verdicts = PARTICIPANT_IDS.flatMap((participantId) =>
      COMBAT_ROUND_STEPS.map((step) => {
        const resolved = resolve(participantId, step);
        return `${participantId}:${step}:${
          !resolved ? "NO SNAPSHOT" : resolved.step === step ? "EXACT" : `CARRIED:${resolved.step}`
        }`;
      }),
    );

    expect(verdicts.filter((verdict) => !verdict.endsWith(":EXACT"))).toEqual([]);
    expect(verdicts).toHaveLength(26);
  });
});

/**
 * Acceptance item 4 — the resolution-side latest-snapshot lookups.
 *
 * Six reads at four call sites consume `stepSnapshots` to decide a roll. Each is a
 * `.reverse().find()` over the round's records, so creating records where none existed changes
 * which record it selects. This block reproduces each predicate exactly and measures the
 * selection before and after.
 */
describe("#951 item 4 — resolution-side latest-snapshot lookups, before and after", () => {
  const roundState = () => initializeCombatRoundState({ encounter: baseEncounter() });

  function derivedSnapshots(): CombatRoundStepSnapshot[] {
    const state = roundState();
    return COMBAT_ROUND_STEPS.flatMap((step) =>
      deriveCombatRoundStepSnapshots({ committedAt: "2026-01-01T00:00:00.000Z", state, step }),
    );
  }

  /** The predicate at `encounterRoutes.ts` attack-roll, hit-location and damage routes. */
  const latestWithAttackSummary = (
    snapshots: readonly CombatRoundStepSnapshot[],
    phase: "phase1" | "phase2",
  ) =>
    [...snapshots]
      .reverse()
      .find(
        (snapshot) =>
          snapshot.roundNumber === 1 &&
          snapshot.participantId === "gladiator" &&
          snapshot.phase === phase &&
          snapshot.attackSummary,
      );

  const latestWithDefenseSummary = (
    snapshots: readonly CombatRoundStepSnapshot[],
    phase: "phase1" | "phase2",
  ) =>
    [...snapshots]
      .reverse()
      .find(
        (snapshot) =>
          snapshot.roundNumber === 1 &&
          snapshot.participantId === "guard" &&
          snapshot.phase === phase &&
          snapshot.defenseSummary,
      );

  /** `combatProgressionProjection/resolution.ts` graze expression, keyed to the exact step. */
  const grazeStepSnapshot = (
    snapshots: readonly CombatRoundStepSnapshot[],
    phase: "phase1" | "phase2",
  ) =>
    [...snapshots]
      .reverse()
      .find(
        (snapshot) =>
          snapshot.roundNumber === 1 &&
          snapshot.participantId === "gladiator" &&
          snapshot.phase === phase &&
          snapshot.step === (phase === "phase1" ? "phase_1_actions" : "phase_2_actions") &&
          snapshot.attackSummary,
      );

  /** `resolution.ts:963` weapon label — no round, no phase and no step filter at all. */
  const lastSnapshotForParticipant = (snapshots: readonly CombatRoundStepSnapshot[]) =>
    [...snapshots].reverse().find((snapshot) => snapshot.participantId === "gladiator");

  it("every attack-summary and defence-summary read is unchanged, because no record carries one", () => {
    const after = derivedSnapshots();

    // Before the repair the three previously-written steps were the only candidates; here the
    // baseline is the empty set, which is what the three unsnapshotted transition paths left.
    for (const phase of ["phase1", "phase2"] as const) {
      expect(latestWithAttackSummary([], phase)).toBeUndefined();
      expect(latestWithDefenseSummary([], phase)).toBeUndefined();
      expect(grazeStepSnapshot([], phase)).toBeUndefined();
      // After: records exist at every step, and not one of them carries a summary, because this
      // fixture's participants have no Character-sourced equipment aggregate and the deriver
      // omits a fact it cannot read rather than publishing one nobody authored.
      expect(latestWithAttackSummary(after, phase)).toBeUndefined();
      expect(latestWithDefenseSummary(after, phase)).toBeUndefined();
      expect(grazeStepSnapshot(after, phase)).toBeUndefined();
    }
  });

  it("the unfiltered weapon-label read now selects the last recorded step, which is round_summary", () => {
    const after = derivedSnapshots();

    expect(lastSnapshotForParticipant([])).toBeUndefined();
    // This is the one measured change in selection: with records at every step, the unfiltered
    // read at `resolution.ts:963` selects the last one in array order. It reads only
    // `phasePanels[phase].attackSummary.weaponName`, as a fallback behind
    // `attackResult.weaponName`, so the figure it can return is a weapon name and nothing else.
    expect(lastSnapshotForParticipant(after)?.step).toBe("round_summary");
    expect(lastSnapshotForParticipant(after)?.phasePanels).toBeUndefined();
  });
});

/**
 * The figures half of the record, measured against a participant that actually has a Character
 * build and an equipped weapon.
 *
 * This is the proof that moving the derivation server-side does not *lose* the attack and defence
 * figures the one good path used to carry from the client: the server resolves them from the
 * participant's own canonical equipment aggregate, through the same adapters live resolution
 * uses, and omits a fact the aggregate cannot supply rather than publishing one nobody authored.
 */
describe("#951 — the server-resolved loadout figures", () => {
  function armedParticipant(id: string): ScenarioParticipant {
    const characterId = `character-${id}`;
    const primary = weaponTemplates.find((template) => template.name === "Long sword");
    if (!primary) throw new Error("Missing canonical weapon fixture.");
    const itemId = `item-${id}`;
    const locationId = `location-${id}`;
    return {
      characterId,
      controlledByUserId: CONTROLLER_BY_PARTICIPANT[id],
      createdAt: "2026-08-07T10:00:00.000Z",
      id: `scenario-${id}`,
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        build: {
          equipment: { items: [] },
          id: characterId,
          name: id,
          profile: {
            distractionLevel: 3,
            id: `profile-${id}`,
            label: id,
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
            secondaryPoolSpent: 16,
            secondaryPoolTotal: 40,
            skillGroups: [],
            skills: [
              {
                category: "secondary",
                categoryId: "combat",
                groupId: "basic_melee_training",
                secondaryRanks: 8,
                skillId: "dodge",
              },
              {
                category: "secondary",
                categoryId: "combat",
                groupId: "basic_melee_training",
                secondaryRanks: 8,
                skillId: "parry",
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
        },
        displayName: id,
        equipmentState: {
          activeLoadoutByCharacterId: {
            [characterId]: {
              activeAmmoItemIds: [],
              activePrimaryWeaponItemId: itemId,
              characterId,
              id: `loadout-${id}`,
              isActive: true,
              name: "Combat",
              quickAccessItemIds: [],
            },
          },
          itemsById: {
            [itemId]: {
              acquiredFrom: null,
              category: "weapon",
              characterId,
              conditionState: "intact",
              displayName: null,
              id: itemId,
              isFavorite: false,
              isStackable: false,
              material: "steel",
              quality: "standard",
              quantity: 1,
              revision: "2026-08-07T09:00:00.000Z",
              specificityType: "generic",
              storageAssignment: { carryMode: "equipped", locationId },
              templateId: primary.id,
            },
          },
          locationsById: {
            [locationId]: {
              availabilityClass: "with_you",
              characterId,
              id: locationId,
              isAccessibleInEncounter: true,
              isMobile: true,
              name: "Equipped",
              type: "equipped_system",
            },
          },
          templatesById: { [primary.id]: primary },
        },
        sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
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
      updatedAt: "2026-08-07T10:00:00.000Z",
    } as unknown as ScenarioParticipant;
  }

  it("resolves a defence summary from the participant's own equipment aggregate", () => {
    const encounter = baseEncounter();
    const scenarioParticipants = PARTICIPANT_IDS.map((id) => armedParticipant(id));
    const state = initializeCombatRoundState({ encounter });
    const resolver = buildCombatStepSnapshotFiguresResolver({ encounter, scenarioParticipants });
    const figures = resolver({
      participantId: "gladiator",
      state,
      step: "review_action_modifiers",
    });

    expect(figures, "no figures for an armed participant").toBeDefined();
    expect(
      figures!.phase1.defenseSummary,
      "defence summary absent for an armed participant",
    ).toBeDefined();
    expect(Number(figures!.phase1.defenseSummary!.db)).toBeTypeOf("number");
    expect(Number.isNaN(Number(figures!.phase1.defenseSummary!.dm))).toBe(false);
    expect(figures!.phase1.mainHandParryItemLabel).toBe("Long sword");
    // The target list is the roster minus the participant, derived from the Encounter.
    expect(figures!.phase1.targetOptions?.map((option) => option.id)).toEqual(["guard"]);
  });

  it("records the defence summary on the step snapshot the server writes", () => {
    const encounter = baseEncounter();
    const scenarioParticipants = PARTICIPANT_IDS.map((id) => armedParticipant(id));
    const state = initializeCombatRoundState({ encounter });
    const snapshots = deriveCombatRoundStepSnapshots({
      committedAt: "2026-01-01T00:05:00.000Z",
      encounterId: encounter.id,
      resolveParticipantFigures: buildCombatStepSnapshotFiguresResolver({
        encounter,
        scenarioParticipants,
      }),
      sourceByParticipantId: buildCombatStepSnapshotSources({
        encounter,
        scenarioParticipants,
        state,
      }),
      state,
      step: "review_action_modifiers",
    });

    expect(snapshots).toHaveLength(2);
    for (const snapshot of snapshots) {
      expect(snapshot.step).toBe("review_action_modifiers");
      expect(snapshot.phase).toBe("phase1");
      expect(
        snapshot.defenseSummary,
        `${snapshot.participantId} has no defence summary`,
      ).toBeDefined();
      expect(snapshot.modifierSummary?.rows.map((row) => row.bucketKey)).toEqual([
        "general",
        "situation_initiative",
        "situation_ob_skill",
        "situation_db",
      ]);
    }
  });

  /**
   * Acceptance item 4, with real figures in play: the resolution-side reads now have candidates
   * where they previously had none, so the selection is measured before and after.
   */
  it("item 4 — the resolution-side defence read now selects a record, and which one is stated", () => {
    const encounter = baseEncounter();
    const scenarioParticipants = PARTICIPANT_IDS.map((id) => armedParticipant(id));
    const state = initializeCombatRoundState({ encounter });
    const resolveParticipantFigures = buildCombatStepSnapshotFiguresResolver({
      encounter,
      scenarioParticipants,
    });
    const sourceByParticipantId = buildCombatStepSnapshotSources({
      encounter,
      scenarioParticipants,
      state,
    });

    const before: CombatRoundStepSnapshot[] = [];
    const after = COMBAT_ROUND_STEPS.flatMap((step) =>
      deriveCombatRoundStepSnapshots({
        committedAt: "2026-01-01T00:05:00.000Z",
        encounterId: encounter.id,
        resolveParticipantFigures,
        sourceByParticipantId,
        state,
        step,
      }),
    );

    const latestDefence = (snapshots: readonly CombatRoundStepSnapshot[]) =>
      [...snapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === 1 &&
            snapshot.participantId === "guard" &&
            snapshot.phase === "phase1" &&
            snapshot.defenseSummary,
        );

    // Before: the three unsnapshotted transition paths left nothing for this read at all.
    expect(latestDefence(before)).toBeUndefined();
    // After: five phase-1 steps carry a defence summary, and the `.reverse().find()` selects the
    // last of them in array order, which is `phase_1_damage`.
    const phaseOneWithDefence = after.filter(
      (snapshot) =>
        snapshot.participantId === "guard" &&
        snapshot.phase === "phase1" &&
        snapshot.defenseSummary,
    );
    expect(phaseOneWithDefence.map((snapshot) => snapshot.step)).toEqual([
      "review_action_modifiers",
      "initiative_phase_1",
      "phase_1_actions",
      "review_phase_2_actions",
      "phase_1_damage",
    ]);
    expect(latestDefence(after)?.step).toBe("phase_1_damage");
    // Every one of those five carries the same figures, because they are derived from one state.
    expect(
      new Set(phaseOneWithDefence.map((snapshot) => JSON.stringify(snapshot.defenseSummary))).size,
    ).toBe(1);
  });
});
