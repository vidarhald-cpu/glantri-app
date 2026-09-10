import Fastify from "fastify";
import {
  CanonicalEquipmentItemSchema,
  encounterSessionSchema,
  initializeCombatRoundState,
  type CombatGenericAction,
} from "@glantri/domain";
import {
  CombatItemInteractionService,
  CombatItemRevisionError,
  CombatItemUnavailableError,
} from "@glantri/database";
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

function encounterWithHiddenRecipient() {
  const encounter = encounterWithActions();
  const base = encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: undefined,
    participants: [
      ...encounter.participants,
      {
        characterId: "character-3",
        id: "participant-inactive",
        label: "Inactive Cora",
        participantType: "character",
        scenarioParticipantId: "scenario-participant-3",
      },
      {
        adHocName: "Unauthorized stranger",
        id: "participant-unauthorized",
        label: "Unauthorized stranger",
        participantType: "ad-hoc",
      },
    ],
    roleplayState: {
      visibility: {
        "participant-1": { "participant-1": true, "participant-2": true },
      },
    },
  });
  return encounterSessionSchema.parse({
    ...base,
    combatRoundState: initializeCombatRoundState({ encounter: base }),
  });
}

function realItemService() {
  const item = CanonicalEquipmentItemSchema.parse({
    campaignContextId: "campaign-1",
    category: "weapon",
    characterId: "character-1",
    conditionState: "intact",
    displayName: "Silver dagger",
    holderCharacterId: "character-1",
    id: "item-1",
    isEquipped: false,
    isStackable: false,
    material: "steel",
    quality: "standard",
    quantity: 1,
    revision: "2026-08-16T09:29:00.000Z",
    specificityType: "specific",
    storageAssignment: { carryMode: "on_person", locationId: "character-1:loc-person" },
    templateId: "weapon-template-dagger",
  });
  return new CombatItemInteractionService(
    {
      getCombatItemInteractionRecords: vi.fn(async () => [
        { availableInEncounter: true, hidden: false, item },
      ]),
    } as never,
    {
      encounter: { findUnique: vi.fn(async () => ({ scenarioId: "scenario-1" })) },
      scenarioParticipant: { findMany: vi.fn(async () => []) },
    } as never,
  );
}

function services(currentEncounter = encounterWithActions()): CombatItemInteractionRouteServices {
  return {
    campaignService: {
      listCampaignsByUserAccess: vi.fn(async () => [{ id: "campaign-1" }]),
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
          role: "player_character",
          scenarioId: "scenario-1",
          snapshot: { displayName: "Aster" },
        },
        {
          characterId: "character-2",
          controlledByUserId: "player-2",
          id: "scenario-participant-2",
          isActive: true,
          role: "player_character",
          scenarioId: "scenario-1",
          snapshot: { displayName: "Bram" },
          visibilityOverrides: { visibility: "gm_only" },
        },
        {
          characterId: "character-3",
          controlledByUserId: "player-3",
          id: "scenario-participant-3",
          isActive: false,
          role: "player_character",
          scenarioId: "scenario-1",
          snapshot: { displayName: "Inactive Cora" },
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

  it.each([
    ["unrelated Admin", { email: "admin@example.test", id: "admin-1", roles: ["admin"] }],
    ["GM of another Campaign", { email: "gm-b@example.test", id: "gm-2", roles: ["game_master"] }],
  ])("does not let an %s inspect or mutate Campaign Combat Items", async (_label, user) => {
    auth.requireAuthenticatedUser.mockResolvedValue(user);
    const routeServices = services();
    vi.mocked(routeServices.scenarioService.userHasPlayerScenarioAccess).mockResolvedValue(false);
    vi.mocked(routeServices.campaignService.listCampaignsByUserAccess).mockResolvedValue([]);
    const app = await appWith(routeServices);
    const read = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-round/item-interactions/options",
    });
    const mutate = await app.inject({
      method: "POST",
      payload: {
        actionId: "forged-action",
        expectedItemRevision: "forged-revision",
        expectedRevision: revision,
        itemId: "private-item",
        itemOperation: "drop",
        operation: "declare",
        participantId: "participant-1",
        visibleToParticipantIds: [],
      },
      url: "/encounters/encounter-1/combat-round/item-interactions",
    });

    expect(read.statusCode).toBe(404);
    expect(mutate.statusCode).toBe(404);
    expect(read.body).not.toContain("private-item");
    expect(mutate.body).not.toContain("private-item");
    expect(routeServices.itemService.getOptions).not.toHaveBeenCalled();
    expect(routeServices.itemService.resolveDeclaration).not.toHaveBeenCalled();
    await app.close();
  });

  it("omits hidden pass recipients and rejects hidden/nonexistent recipient forgeries identically", async () => {
    const routeServices = services(encounterWithHiddenRecipient());
    routeServices.itemService = realItemService();
    const app = await appWith(routeServices);
    const optionsResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-round/item-interactions/options",
    });

    expect(optionsResponse.statusCode).toBe(200);
    expect(optionsResponse.body).toContain("Aster");
    expect(optionsResponse.body).not.toContain("Bram");
    expect(optionsResponse.body).not.toContain("participant-2");
    expect(optionsResponse.body).not.toContain("Inactive Cora");
    expect(optionsResponse.body).not.toContain("participant-inactive");
    expect(optionsResponse.body).not.toContain("Unauthorized stranger");
    expect(optionsResponse.body).not.toContain("participant-unauthorized");
    expect(optionsResponse.json().options.recipients).toEqual([
      { label: "Aster", participantId: "participant-1" },
    ]);

    const attempt = (recipientParticipantId: string) =>
      app.inject({
        method: "POST",
        payload: {
          actionId: `action-pass-${recipientParticipantId}`,
          expectedItemRevision: "2026-08-16T09:29:00.000Z",
          expectedRevision: revision,
          itemId: "item-1",
          itemOperation: "pass",
          operation: "declare",
          participantId: "participant-1",
          recipientParticipantId,
        },
        url: "/encounters/encounter-1/combat-round/item-interactions",
      });
    const responses = await Promise.all(
      [
        "participant-2",
        "participant-missing",
        "participant-inactive",
        "participant-out-of-context",
        "participant-unauthorized",
      ].map(attempt),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404, 404, 404]);
    expect(new Set(responses.map((response) => response.body))).toHaveLength(1);
    expect(responses[0]?.body).not.toContain("participant-2");
    expect(routeServices.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(routeServices.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
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
