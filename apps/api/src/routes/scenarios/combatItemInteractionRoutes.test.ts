import Fastify from "fastify";
import {
  encounterSessionSchema,
  initializeCombatRoundState,
  type CombatGenericAction,
} from "@glantri/domain";
import { CombatItemRevisionError, CombatItemUnavailableError } from "@glantri/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn() }));
vi.mock("../../lib/sessionAuth", () => ({
  requireAuthenticatedUser: auth.requireAuthenticatedUser,
}));

import {
  createCombatItemInteractionRoutes,
  type CombatItemInteractionRouteServices,
} from "./combatItemInteractionRoutes";

const player = { email: "player@example.test", id: "player-1", roles: ["player"] };
const gm = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
const revision = "2026-08-16T10:00:00.000Z";

function encounterWithActions(genericActions: CombatGenericAction[] = []) {
  const base = encounterSessionSchema.parse({
    campaignId: "campaign-1",
    createdAt: "2026-08-16T09:00:00.000Z",
    currentRound: 1,
    id: "encounter-1",
    kind: "combat",
    participants: [
      {
        characterId: "character-1",
        id: "participant-1",
        label: "Aster",
        participantType: "character",
        scenarioParticipantId: "scenario-participant-1",
      },
      {
        characterId: "character-2",
        id: "participant-2",
        label: "Bram",
        participantType: "character",
        scenarioParticipantId: "scenario-participant-2",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Bridge fight",
    updatedAt: revision,
  });
  const state = initializeCombatRoundState({ encounter: base });
  return encounterSessionSchema.parse({
    ...base,
    combatRoundState: { ...state, genericActions },
  });
}

function itemAction(status: CombatGenericAction["status"] = "active"): CombatGenericAction {
  return {
    createdAt: "2026-08-16T09:30:00.000Z",
    duration: { kind: "gm_decided" },
    id: "action-1",
    intent: "Pass / give Silver dagger to Bram",
    itemInteraction: {
      itemId: "item-1",
      itemLabel: "Silver dagger",
      itemRevision: "2026-08-16T09:29:00.000Z",
      operation: "pass",
      recipientParticipantId: "participant-2",
      stateAtDeclaration: "held",
      visibleToParticipantIds: ["participant-1", "participant-2"],
    },
    lastUpdatedAt: "2026-08-16T09:31:00.000Z",
    ownerParticipantId: "participant-1",
    preset: "item_interaction",
    progress: { completedRounds: 0 },
    reference: {
      itemId: "item-1",
      kind: "item",
      label: "Silver dagger",
      ownerParticipantId: "participant-1",
    },
    status,
  };
}

function services(currentEncounter = encounterWithActions()): CombatItemInteractionRouteServices {
  return {
    campaignService: {
      getCampaignById: vi.fn(async () => ({ gmUserId: gm.id, id: "campaign-1" })),
    } as unknown as CombatItemInteractionRouteServices["campaignService"],
    encounterService: {
      getEncounterById: vi.fn(async () => currentEncounter),
      updateCombatEncounter: vi.fn(async (input) => input.session),
    } as unknown as CombatItemInteractionRouteServices["encounterService"],
    itemService: {
      apply: vi.fn(async () => ({ alreadyApplied: false })),
      commitResolution: vi.fn(async (input) => ({
        encounter: input.encounterSession,
        item: { alreadyApplied: false },
      })),
      getOptions: vi.fn(async () => ({ actors: [], presentItems: [], recipients: [] })),
      resolveDeclaration: vi.fn(async () => ({
        interaction: {
          itemId: "item-1",
          itemLabel: "Silver dagger",
          itemRevision: "2026-08-16T09:29:00.000Z",
          operation: "drop",
          stateAtDeclaration: "held",
          visibleToParticipantIds: ["participant-1"],
        },
        reference: {
          itemId: "item-1",
          kind: "item",
          label: "Silver dagger",
          ownerParticipantId: "participant-1",
        },
      })),
    } as unknown as CombatItemInteractionRouteServices["itemService"],
    scenarioService: {
      getScenarioById: vi.fn(async () => ({ campaignId: "campaign-1", id: "scenario-1" })),
      listScenarioParticipants: vi.fn(async () => [
        {
          characterId: "character-1",
          controlledByUserId: player.id,
          id: "scenario-participant-1",
          isActive: true,
          snapshot: { displayName: "Aster" },
        },
        {
          characterId: "character-2",
          controlledByUserId: "player-2",
          id: "scenario-participant-2",
          isActive: true,
          snapshot: { displayName: "Bram" },
        },
      ]),
      recordScenarioEvent: vi.fn(),
      userHasPlayerScenarioAccess: vi.fn(async () => true),
    } as unknown as CombatItemInteractionRouteServices["scenarioService"],
  };
}

async function appWith(routeServices: CombatItemInteractionRouteServices) {
  const app = Fastify({ logger: false });
  await app.register(createCombatItemInteractionRoutes(routeServices));
  return app;
}

describe("canonical Combat Item interaction routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAuthenticatedUser.mockResolvedValue(player);
  });

  it("returns player-scoped canonical options without a snapshot Item authority", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-round/item-interactions/options",
    });

    expect(response.statusCode).toBe(200);
    expect(routeServices.itemService.getOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        viewer: expect.objectContaining({ kind: "player" }),
      }),
    );
    const viewer = vi.mocked(routeServices.itemService.getOptions).mock.calls[0]?.[0].viewer;
    expect(viewer.kind === "player" && viewer.controlledParticipantIds?.has("participant-1")).toBe(
      true,
    );
    expect(viewer.kind === "player" && viewer.controlledParticipantIds?.has("participant-2")).toBe(
      false,
    );
    await app.close();
  });

  it("declares one exact Item/revision with GM-decided timing and no canonical mutation", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "action-declare",
        expectedItemRevision: "2026-08-16T09:29:00.000Z",
        expectedRevision: revision,
        itemId: "item-1",
        itemOperation: "drop",
        operation: "declare",
        participantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(response.statusCode).toBe(200);
    expect(routeServices.itemService.resolveDeclaration).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedItemRevision: "2026-08-16T09:29:00.000Z",
        itemId: "item-1",
        operation: "drop",
        ownerParticipantId: "participant-1",
      }),
    );
    expect(routeServices.itemService.apply).not.toHaveBeenCalled();
    const saved = vi
      .mocked(routeServices.encounterService.updateCombatEncounter)
      .mock.calls[0]?.[0].session.combatRoundState?.genericActions.at(-1);
    expect(saved).toMatchObject({
      duration: { kind: "gm_decided" },
      itemInteraction: { itemId: "item-1", operation: "drop" },
      preset: "item_interaction",
      status: "declared",
    });
    await app.close();
  });

  it("records a basic use intent for GM adjudication without creating an executable roll", async () => {
    const routeServices = services();
    vi.mocked(routeServices.itemService.resolveDeclaration).mockResolvedValue({
      interaction: {
        itemId: "item-1",
        itemLabel: "Silver dagger",
        itemRevision: "2026-08-16T09:29:00.000Z",
        operation: "use",
        stateAtDeclaration: "held",
        visibleToParticipantIds: ["participant-1"],
      },
      reference: {
        itemId: "item-1",
        kind: "item",
        label: "Silver dagger",
        ownerParticipantId: "participant-1",
      },
    });
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "action-use",
        expectedItemRevision: "2026-08-16T09:29:00.000Z",
        expectedRevision: revision,
        intentDetail: "test the balance against the sealed door",
        itemId: "item-1",
        itemOperation: "use",
        operation: "declare",
        participantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(response.statusCode).toBe(200);
    const saved = vi
      .mocked(routeServices.encounterService.updateCombatEncounter)
      .mock.calls[0]?.[0].session.combatRoundState?.genericActions.at(-1);
    expect(saved).toMatchObject({
      intent: "Use / interact with Silver dagger — test the balance against the sealed door",
      itemInteraction: { itemId: "item-1", operation: "use" },
      status: "declared",
    });
    expect(saved?.rollRequest).toBeUndefined();
    expect(routeServices.itemService.apply).not.toHaveBeenCalled();
    await app.close();
  });

  it("makes hidden, nonexistent, wrong-owner, and forged-revision declarations indistinguishable", async () => {
    const routeServices = services();
    vi.mocked(routeServices.itemService.resolveDeclaration).mockRejectedValue(
      new CombatItemUnavailableError(),
    );
    const app = await appWith(routeServices);
    const responses = await Promise.all(
      ["hidden-item", "nonexistent-item"].map((itemId) =>
        app.inject({
          method: "POST",
          payload: {
            actionId: `action-${itemId}`,
            expectedItemRevision: "forged-revision",
            expectedRevision: revision,
            itemId,
            itemOperation: "pickup",
            operation: "declare",
            participantId: "participant-1",
          },
          url: "/encounters/encounter-1/combat-round/item-interactions",
        }),
      ),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404]);
    expect(responses[0]?.body).toBe(responses[1]?.body);
    expect(responses[0]?.body).not.toContain("hidden-item");
    expect(routeServices.itemService.apply).not.toHaveBeenCalled();
    expect(routeServices.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets the GM resolve through one canonical mutation and records the player-safe result", async () => {
    auth.requireAuthenticatedUser.mockResolvedValue(gm);
    const routeServices = services(encounterWithActions([itemAction()]));
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "action-1",
        expectedRevision: revision,
        operation: "resolve",
        resultText: "Bram receives the same Silver dagger.",
        visibleToParticipantIds: ["participant-1", "participant-2"],
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(response.statusCode).toBe(200);
    expect(routeServices.itemService.commitResolution).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "action-1",
        ownerCharacterId: "character-1",
        recipientCharacterId: "character-2",
      }),
    );
    expect(routeServices.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(routeServices.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
    const saved = vi.mocked(routeServices.itemService.commitResolution).mock.calls[0]?.[0]
      .encounterSession.combatRoundState?.genericActions[0];
    expect(saved).toMatchObject({
      resolution: { text: "Bram receives the same Silver dagger." },
      status: "completed",
    });
    await app.close();
  });

  it("rejects an early fixed-duration resolve before any canonical Item or Encounter mutation", async () => {
    auth.requireAuthenticatedUser.mockResolvedValue(gm);
    const earlyAction: CombatGenericAction = {
      ...itemAction(),
      duration: { kind: "rounds", rounds: 3 },
      progress: {
        completedRounds: 0,
        startedRoundNumber: 1,
        startedStep: "select_actions",
        totalRounds: 3,
      },
    };
    const routeServices = services(encounterWithActions([earlyAction]));
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "action-1",
        expectedRevision: revision,
        operation: "resolve",
        resultText: "Too early",
        visibleToParticipantIds: ["participant-1"],
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("before its reviewed timing completes");
    expect(routeServices.itemService.commitResolution).not.toHaveBeenCalled();
    expect(routeServices.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(routeServices.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
    await app.close();
  });

  it("never applies an Item mutation after the action was interrupted", async () => {
    auth.requireAuthenticatedUser.mockResolvedValue(gm);
    const routeServices = services(encounterWithActions([itemAction("interrupted")]));
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "action-1",
        expectedRevision: revision,
        operation: "resolve",
        resultText: "Forged late completion",
        visibleToParticipantIds: ["participant-1"],
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(response.statusCode).toBe(400);
    expect(routeServices.itemService.commitResolution).not.toHaveBeenCalled();
    expect(routeServices.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a stale canonical Item revision without persisting a false completion", async () => {
    auth.requireAuthenticatedUser.mockResolvedValue(gm);
    const routeServices = services(encounterWithActions([itemAction()]));
    vi.mocked(routeServices.itemService.commitResolution).mockRejectedValue(
      new CombatItemRevisionError(),
    );
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "action-1",
        expectedRevision: revision,
        operation: "resolve",
        resultText: "Forged completion",
        visibleToParticipantIds: ["participant-1"],
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(response.statusCode).toBe(409);
    expect(routeServices.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    await app.close();
  });
});
