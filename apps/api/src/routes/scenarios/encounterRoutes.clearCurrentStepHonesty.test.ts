import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

/**
 * #1001 — `POST …/combat-round/clear-current-step` must either make real progress or refuse with a
 * reason. When nothing in the round could be undone it answered 200 with the encounter unchanged,
 * so the GM was told the recovery control had worked when it had not.
 *
 * The browser half of #1001 — the clear at a stuck initiative step being re-run behind the GM — is
 * covered by `apps/web/e2e/template-archetype-round-stall.spec.ts` and by the participation
 * projection's own hold test in `packages/domain/src/encounter/combatParticipation.test.ts`.
 */

const mocks = vi.hoisted(() => {
  const adminUser = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
  return {
    adminUser,
    campaignService: { getCampaignById: vi.fn() },
    encounterService: {
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

const PARTICIPANT_IDS = ["hero", "guard"] as const;

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
    participants: PARTICIPANT_IDS.map((id, order) => ({
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
    })),
    scenarioId: "scenario-1",
    status: "active",
    title: "Nothing left to clear",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as EncounterSession;
}

function scenarioParticipant(id: string): ScenarioParticipant {
  return {
    controlledByUserId: "gm-1",
    id: `scenario-${id}`,
    isActive: true,
    role: "npc",
    scenarioId: "scenario-1",
    snapshot: { displayName: id },
    sourceType: "entity",
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

async function openWorld(initialState: CombatRoundState) {
  let encounter: Record<string, unknown> = {
    ...(baseEncounter() as unknown as Record<string, unknown>),
    combatRoundState: initialState,
    currentRound: initialState.roundNumber,
  };
  const participants = PARTICIPANT_IDS.map((id) => scenarioParticipant(id));
  const save = async (update: { session: Record<string, unknown> }) => {
    encounter = update.session;
    return encounter;
  };

  mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
  mocks.encounterService.getEncounterById.mockImplementation(async () => encounter);
  mocks.encounterService.updateEncounter.mockImplementation(save);
  mocks.encounterService.updateCombatEncounter.mockImplementation(save);
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { participantId: string }) =>
      participants.find((entry) => entry.id === update.participantId),
  );
  mocks.encounterService.commitCombatParticipantStateMutations.mockImplementation(
    async (update: { participants: { participant: { id: string } }[]; session: never }) => ({
      encounter: await save({ session: update.session }),
      participants: update.participants.map((entry) =>
        participants.find((participant) => participant.id === entry.participant.id),
      ),
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

  const app = Fastify({ logger: false });
  await app.register(scenariosRoutes);
  return {
    app,
    clear: (payload: Record<string, unknown> = {}) =>
      app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/clear-current-step",
      }),
    roundState: () => encounter.combatRoundState as CombatRoundState,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("#1001 — clear-current-step is honest", () => {
  it("refuses with a reason, and writes nothing, when the round has nothing to undo", async () => {
    const world = await openWorld(initializeCombatRoundState({ encounter: baseEncounter() }));
    const before = JSON.stringify(world.roundState());

    const response = await world.clear();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "nothing_to_clear",
      error: expect.stringContaining("Nothing was changed"),
    });
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.commitCombatParticipantStateMutations).not.toHaveBeenCalled();
    expect(JSON.stringify(world.roundState())).toBe(before);
    await world.app.close();
  });

  it("still answers 200 for a clear that undoes a recorded command, then refuses once none is left", async () => {
    let state = setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: initializeCombatRoundState({ encounter: baseEncounter() }),
    });
    state = rollCombatRoundCombatExperience({
      command: { createdAt: "2026-01-01T00:01:00.000Z", createdByUserId: "gm-1" },
      participantId: "hero",
      rng: () => 0.5,
      skillTotal: 0,
      state,
    }).state;
    const world = await openWorld(state);
    const recorded = world.roundState().commands.length;
    expect(recorded).toBeGreaterThan(0);

    const statuses: number[] = [];
    for (let attempt = 0; attempt <= recorded + 1; attempt += 1) {
      const before = JSON.stringify(world.roundState());
      const response = await world.clear();
      statuses.push(response.statusCode);
      if (response.statusCode === 200) {
        expect(JSON.stringify(world.roundState()), "a 200 clear changed the round").not.toBe(
          before,
        );
        continue;
      }
      expect(response.json()).toMatchObject({ code: "nothing_to_clear" });
      expect(JSON.stringify(world.roundState())).toBe(before);
      break;
    }

    expect(statuses[0]).toBe(200);
    expect(statuses.at(-1)).toBe(409);
    expect(world.roundState().commands).toHaveLength(0);
    await world.app.close();
  });
});
