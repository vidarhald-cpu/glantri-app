import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildActiveCombatMutationResponse,
  combatRoundStateSchema,
  encounterSessionSchema,
  type CombatRoundStepSnapshot,
  type EncounterParticipant,
} from "@glantri/domain";

type LocalServiceClientModule = typeof import("./localServiceClient");
type FetchMock = ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

function stubFetch(payload: unknown, status = 200): FetchMock {
  const fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(jsonResponse(payload, status));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loadClient(baseUrl = "https://api.example.test"): Promise<LocalServiceClientModule> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", baseUrl);
  return import("./localServiceClient");
}

function expectFetchCall(
  fetchMock: FetchMock,
  expected: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
    url: string;
  },
): void {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(expected.url);
  expect(init?.credentials).toBe("include");

  if (expected.method) {
    expect(init?.method).toBe(expected.method);
  }

  if (expected.body !== undefined) {
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify(expected.body));
  } else {
    expect(init?.body).toBeUndefined();
    expect((init?.headers as Headers | undefined)?.has("content-type") ?? false).toBe(false);
  }

  if (expected.headers) {
    expect(init?.headers).toBeInstanceOf(Headers);

    for (const [name, value] of Object.entries(expected.headers)) {
      expect((init?.headers as Headers).get(name)).toBe(value);
    }
  }
}

describe("localServiceClient wire contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("loads the projected combat-history payload", async () => {
    const history = {
      activeRound: { events: [], roundNumber: 2, snapshots: [] },
      archivedRounds: [],
      rows: [],
      sourceEncounterId: "encounter-1",
      sourceUpdatedAt: "revision-2",
    };
    const fetchMock = stubFetch({ history });
    const client = await loadClient();

    await expect(client.loadCombatHistory("encounter-1")).resolves.toEqual(history);
    expectFetchCall(fetchMock, {
      method: "GET",
      url: "https://api.example.test/encounters/encounter-1/combat-history",
    });
  });

  it("loads Campaign-scoped privacy-safe Character roster candidates", async () => {
    const characters = [
      {
        alreadyRostered: false,
        id: "character-1",
        name: "Ari",
        ownerLabel: "Player One",
      },
    ];
    const fetchMock = stubFetch({ characters });
    const client = await loadClient();

    await expect(client.loadCampaignCharacterRosterCandidates("campaign-1")).resolves.toEqual(
      characters,
    );
    expectFetchCall(fetchMock, {
      method: "GET",
      url: "https://api.example.test/campaigns/campaign-1/roster-candidates/characters",
    });
  });

  it("requests a selected participant perspective for GM Player Combat history", async () => {
    const history = {
      activeRound: { events: [], roundNumber: 1, snapshots: [] },
      archivedRounds: [],
      rows: [],
      sourceEncounterId: "encounter-1",
      sourceUpdatedAt: "revision-1",
    };
    const fetchMock = stubFetch({ history });
    const client = await loadClient();

    await client.loadCombatHistory("encounter-1", {
      perspectiveParticipantId: "participant/one",
    });

    expectFetchCall(fetchMock, {
      method: "GET",
      url: "https://api.example.test/encounters/encounter-1/combat-history?perspectiveParticipantId=participant%2Fone",
    });
  });

  it("uses the configured API base URL for auth session lookup", async () => {
    const fetchMock = stubFetch({
      user: {
        email: "player@example.test",
        id: "user-1",
        roles: ["player"],
      },
    });
    const client = await loadClient("https://api.example.test");

    await expect(client.getCurrentSessionUser()).resolves.toMatchObject({
      id: "user-1",
    });

    expectFetchCall(fetchMock, {
      url: "https://api.example.test/auth/me",
    });
  });

  it("posts auth credentials as JSON and returns the user payload", async () => {
    const fetchMock = stubFetch({
      user: {
        email: "gm@example.test",
        id: "user-gm",
        roles: ["game_master"],
      },
    });
    const client = await loadClient();

    await expect(
      client.loginLocalUser({
        email: "gm@example.test",
        password: "secret",
      }),
    ).resolves.toMatchObject({
      id: "user-gm",
    });

    expectFetchCall(fetchMock, {
      body: {
        email: "gm@example.test",
        password: "secret",
      },
      method: "POST",
      url: "https://api.example.test/auth/login",
    });
  });

  it("preserves caller-provided headers while posting JSON bodies", async () => {
    const fetchMock = stubFetch({ ok: true });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const { sendJson } = await import("./apiClient");

    await expect(
      sendJson("/custom", {
        body: JSON.stringify({ ok: true }),
        headers: {
          "x-request-id": "request-1",
        },
        method: "POST",
      }),
    ).resolves.toEqual({ ok: true });

    expectFetchCall(fetchMock, {
      body: { ok: true },
      headers: {
        "x-request-id": "request-1",
      },
      method: "POST",
      url: "https://api.example.test/custom",
    });
  });

  it("posts character builds under the characters domain", async () => {
    const character = {
      build: {
        name: "Ada",
      },
      createdAt: "2026-05-09T12:00:00.000Z",
      id: "character-1",
      level: 1,
      name: "Ada",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const fetchMock = stubFetch({ character });
    const client = await loadClient();
    const build = character.build as unknown as Parameters<
      LocalServiceClientModule["saveCharacterToServer"]
    >[0];

    await expect(client.saveCharacterToServer(build)).resolves.toEqual(character);

    expectFetchCall(fetchMock, {
      body: {
        build,
      },
      method: "POST",
      url: "https://api.example.test/characters",
    });
  });

  it("sends the canonical character revision with update and delete mutations", async () => {
    const character = {
      build: { id: "character-1", name: "Ada revised" },
      createdAt: "2026-05-09T12:00:00.000Z",
      id: "character-1",
      level: 1,
      name: "Ada revised",
      updatedAt: "2026-05-09T13:00:00.000Z",
    };
    const expectedUpdatedAt = "2026-05-09T12:00:00.000Z";
    const updateFetch = stubFetch({ character });
    const client = await loadClient();
    const build = character.build as unknown as Parameters<
      LocalServiceClientModule["updateServerCharacter"]
    >[0]["build"];

    await expect(
      client.updateServerCharacter({
        build,
        characterId: character.id,
        expectedUpdatedAt,
      }),
    ).resolves.toEqual(character);
    expectFetchCall(updateFetch, {
      body: { build, expectedUpdatedAt },
      method: "PUT",
      url: "https://api.example.test/characters/character-1",
    });

    const deleteFetch = stubFetch(undefined, 204);
    await expect(
      client.deleteServerCharacter({
        characterId: character.id,
        expectedUpdatedAt: character.updatedAt,
      }),
    ).resolves.toBeUndefined();
    expectFetchCall(deleteFetch, {
      body: { expectedUpdatedAt: character.updatedAt },
      method: "DELETE",
      url: "https://api.example.test/characters/character-1",
    });
  });

  it("posts campaign creation under the campaign domain", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const fetchMock = stubFetch({ campaign });
    const client = await loadClient();

    await expect(
      client.createCampaignOnServer({
        description: "Frontier campaign",
        name: "Border Trouble",
      }),
    ).resolves.toEqual(campaign);

    expectFetchCall(fetchMock, {
      body: {
        description: "Frontier campaign",
        name: "Border Trouble",
      },
      method: "POST",
      url: "https://api.example.test/campaigns",
    });
  });

  it("deletes campaign roster membership by stable source identity", async () => {
    const fetchMock = stubFetch({ ok: true });
    const client = await loadClient();

    await expect(
      client.removeCampaignRosterEntryOnServer({
        campaignId: "campaign-1",
        sourceId: "character-1",
        sourceType: "character",
      }),
    ).resolves.toBeUndefined();

    expectFetchCall(fetchMock, {
      method: "DELETE",
      url: "https://api.example.test/campaigns/campaign-1/roster-membership/character/character-1",
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).has("content-type")).toBe(false);
  });

  it("preserves template source type when deleting campaign roster membership", async () => {
    const fetchMock = stubFetch({ ok: true });
    const client = await loadClient();

    await expect(
      client.removeCampaignRosterEntryOnServer({
        campaignId: "campaign-1",
        sourceId: "template-1",
        sourceType: "template",
      }),
    ).resolves.toBeUndefined();

    expectFetchCall(fetchMock, {
      method: "DELETE",
      url: "https://api.example.test/campaigns/campaign-1/roster-membership/template/template-1",
    });
  });

  it("puts scenario updates under the scenario domain", async () => {
    const scenario = {
      campaignId: "campaign-1",
      createdAt: "2026-05-09T12:00:00.000Z",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "draft",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const fetchMock = stubFetch({ scenario });
    const client = await loadClient();

    await expect(
      client.updateScenarioOnServer({
        name: "Bridge Ambush",
        scenarioId: "scenario-1",
        status: "live",
      }),
    ).resolves.toEqual(scenario);

    expectFetchCall(fetchMock, {
      body: {
        description: undefined,
        kind: undefined,
        mapAssetId: undefined,
        name: "Bridge Ambush",
        status: "live",
      },
      method: "PUT",
      url: "https://api.example.test/scenarios/scenario-1",
    });
  });

  it("loads encounters from the encounter domain", async () => {
    const encounter = {
      id: "encounter-1",
      name: "Courtyard",
      scenarioId: "scenario-1",
    };
    const fetchMock = stubFetch({ encounter });
    const client = await loadClient();

    await expect(client.loadEncounterById("encounter-1")).resolves.toEqual(encounter);

    expectFetchCall(fetchMock, {
      method: "GET",
      url: "https://api.example.test/encounters/encounter-1",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe("no-store");
  });

  it("loads compact encounter summaries and active revision metadata", async () => {
    const summary = {
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:05:00.000Z",
    };
    const revision = {
      encounterId: "encounter-1",
      revision: summary.updatedAt,
      status: "active",
      updatedAt: summary.updatedAt,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ encounters: [summary] }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ encounter: revision }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = await loadClient();

    await expect(client.loadScenarioEncounterSummaries("scenario-1")).resolves.toEqual([summary]);
    await expect(client.loadEncounterRevision("encounter-1")).resolves.toEqual(revision);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.example.test/scenarios/scenario-1/encounter-summaries",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://api.example.test/encounters/encounter-1/revision",
    );
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("GET");
    expect(fetchMock.mock.calls[1]?.[1]?.cache).toBe("no-store");
  });

  it("updates encounter status through the narrow status endpoint", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "paused",
    };
    const fetchMock = stubFetch({ encounter });
    const client = await loadClient();

    await expect(
      client.updateEncounterStatusOnServer({
        encounterId: "encounter-1",
        expectedRevision: "revision-1",
        status: "paused",
      }),
    ).resolves.toEqual(encounter);

    expectFetchCall(fetchMock, {
      body: {
        expectedRevision: "revision-1",
        status: "paused",
      },
      method: "PATCH",
      url: "https://api.example.test/encounters/encounter-1/status",
    });
  });

  it("updates encounter participants through the narrow participants endpoint", async () => {
    const encounter = {
      id: "encounter-1",
      participantMembershipMode: "explicit",
      scenarioId: "scenario-1",
    };
    const participants: EncounterParticipant[] = [
      {
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: "scenario-participant-1",
        initiative: 0,
        label: "The Gladiator",
        order: 0,
        orientation: "neutral",
        participantType: "scenario",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: "participant-1",
      },
    ];
    const fetchMock = stubFetch({ encounter });
    const client = await loadClient();

    await expect(
      client.updateEncounterParticipantsOnServer({
        encounterId: "encounter-1",
        expectedRevision: "revision-1",
        participantMembershipMode: "explicit",
        participants,
      }),
    ).resolves.toEqual(encounter);

    expectFetchCall(fetchMock, {
      body: {
        expectedRevision: "revision-1",
        participantMembershipMode: "explicit",
        participants,
      },
      method: "PATCH",
      url: "https://api.example.test/encounters/encounter-1/participants",
    });
  });

  it("submits combat declarations through the encounter domain", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const participant = {
      id: "participant-1",
    };
    const fetchMock = stubFetch({ encounter, participant });
    const client = await loadClient();

    await expect(
      client.submitCombatDeclarationOnServer({
        actionId: "double_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [
              {
                durationRounds: 2,
                id: "modifier-1",
                notes: "High ground",
                scope: "until",
                value: 1,
              },
            ],
          },
        },
        encounterId: "encounter-1",
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
        phaseAttackSources: {
          phase1: {
            attackModeId: "mode-1",
            opportunitySlot: "attack_1",
            scenarioItemId: "scenario-fencing-sword",
            slot: "primary",
            sourceKind: "weapon",
            templateId: "weapon-template-fencing-sword",
          },
          phase2: {
            attackModeId: "mode-2",
            opportunitySlot: "attack_2",
            scenarioItemId: "scenario-main-gauche",
            slot: "secondary",
            sourceKind: "weapon",
            templateId: "weapon-template-main-gauche",
          },
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "participant-1",
        executionGroupId: "group-declaration",
        expectedRevision: "revision-1",
        taskId: "task-declaration",
      }),
    ).resolves.toEqual({ encounter, participant });

    expectFetchCall(fetchMock, {
      body: {
        actionId: "double_attack",
        additionalActionNotes: undefined,
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [
              {
                durationRounds: 2,
                id: "modifier-1",
                notes: "High ground",
                scope: "until",
                value: 1,
              },
            ],
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
        phaseAttackSources: {
          phase1: {
            attackModeId: "mode-1",
            opportunitySlot: "attack_1",
            scenarioItemId: "scenario-fencing-sword",
            slot: "primary",
            sourceKind: "weapon",
            templateId: "weapon-template-fencing-sword",
          },
          phase2: {
            attackModeId: "mode-2",
            opportunitySlot: "attack_2",
            scenarioItemId: "scenario-main-gauche",
            slot: "secondary",
            sourceKind: "weapon",
            templateId: "weapon-template-main-gauche",
          },
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        executionGroupId: "group-declaration",
        expectedRevision: "revision-1",
        scenarioParticipantId: "participant-1",
        secondaryActionId: undefined,
        taskId: "task-declaration",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-declaration",
    });
  });

  it("sends the canonical Observe target without rewriting it as the acting participant", async () => {
    const gladiatorCombatantId = "scenario-cmp6v9wpm000fzgisztx5bho0";
    const scyrianScenarioParticipantId = "cmp6vb3gw000lzgisw3s2cojw";
    const encounter = { id: "encounter-1", scenarioId: "scenario-1" };
    const participant = { id: scyrianScenarioParticipantId };
    const fetchMock = stubFetch({ encounter, participant });
    const client = await loadClient();

    await client.submitCombatDeclarationOnServer({
      actionId: "parry",
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      encounterId: encounter.id,
      executionGroupId: "group-declaration",
      expectedRevision: "revision-1",
      scenarioParticipantId: scyrianScenarioParticipantId,
      secondaryActionContext: {
        action: "observe_opponent",
        targetParticipantId: gladiatorCombatantId,
      },
      secondaryActionId: "observe_opponent",
      taskId: "task-declaration",
    });

    expectFetchCall(fetchMock, {
      body: {
        actionId: "parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        executionGroupId: "group-declaration",
        expectedRevision: "revision-1",
        scenarioParticipantId: scyrianScenarioParticipantId,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: gladiatorCombatantId,
        },
        secondaryActionId: "observe_opponent",
        taskId: "task-declaration",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-declaration",
    });
  });

  it("rolls combat initiative through the encounter domain", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const fetchMock = stubFetch({ encounter, initiative: { rolls: [6, 2], total: 8 } });
    const client = await loadClient();

    await expect(
      client.rollCombatInitiativeOnServer({
        encounterId: "encounter-1",
        executionGroupId: "group-initiative",
        expectedParticipantRevision: "participant-revision-1",
        expectedRevision: "revision-1",
        scenarioParticipantId: "participant-1",
        taskId: "task-initiative",
      }),
    ).resolves.toEqual({ encounter, initiative: { rolls: [6, 2], total: 8 } });

    expectFetchCall(fetchMock, {
      body: {
        scenarioParticipantId: "participant-1",
        executionGroupId: "group-initiative",
        expectedParticipantRevision: "participant-revision-1",
        expectedRevision: "revision-1",
        taskId: "task-initiative",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-initiative",
    });
  });

  it("adopts an active-only combat mutation response and preserves local archived rounds", async () => {
    const currentEncounter = encounterSessionSchema.parse({
      combatRoundState: combatRoundStateSchema.parse({
        encounterId: "encounter-1",
        participants: [{ label: "Aria", participantId: "aria" }],
        rounds: [{ encounterId: "encounter-1", roundNumber: 1 }],
      }),
      createdAt: "2026-07-26T09:00:00.000Z",
      id: "encounter-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-07-26T10:00:00.000Z",
    });
    const nextEncounter = encounterSessionSchema.parse({
      ...currentEncounter,
      combatRoundState: {
        ...currentEncounter.combatRoundState!,
        currentStep: "initiative_phase_1",
      },
      updatedAt: "2026-07-26T10:01:00.000Z",
    });
    const response = buildActiveCombatMutationResponse({
      encounter: nextEncounter,
      mutationPresentation: {
        initiative: { rolls: [6, 2], total: 8 },
      },
    });
    const fetchMock = stubFetch(response);
    const client = await loadClient();

    await expect(
      client.rollCombatInitiativeOnServer({
        currentEncounter,
        encounterId: "encounter-1",
        executionGroupId: "group-initiative",
        expectedParticipantRevision: "participant-revision-1",
        expectedRevision: currentEncounter.updatedAt,
        scenarioParticipantId: "participant-1",
        taskId: "task-initiative",
      }),
    ).resolves.toMatchObject({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          rounds: [{ encounterId: "encounter-1", roundNumber: 1 }],
        },
        updatedAt: "2026-07-26T10:01:00.000Z",
      },
      initiative: { rolls: [6, 2], total: 8 },
    });
    expectFetchCall(fetchMock, {
      body: {
        scenarioParticipantId: "participant-1",
        executionGroupId: "group-initiative",
        expectedParticipantRevision: "participant-revision-1",
        expectedRevision: currentEncounter.updatedAt,
        taskId: "task-initiative",
      },
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-initiative",
    });
  });

  it("submits one descriptor-bound request for GM bulk step completion", async () => {
    const currentEncounter = encounterSessionSchema.parse({
      combatRoundState: combatRoundStateSchema.parse({
        currentStep: "review_action_modifiers",
        encounterId: "encounter-1",
        participants: [{ label: "Aria", participantId: "aria" }],
      }),
      createdAt: "2026-07-26T09:00:00.000Z",
      id: "encounter-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-07-26T10:00:00.000Z",
    });
    const nextEncounter = encounterSessionSchema.parse({
      ...currentEncounter,
      updatedAt: "2026-07-26T10:01:00.000Z",
    });
    const fetchMock = stubFetch(
      buildActiveCombatMutationResponse({
        encounter: nextEncounter,
        mutationPresentation: {
          blocker: {
            code: "initiative_player_owned",
            message: "Bulk initiative stopped at Bera: initiative is player-owned.",
            participantId: "bera",
          },
          completedParticipantIds: ["aria"],
        },
      }),
    );
    const client = await loadClient();

    await expect(
      client.completeRemainingCombatStepOnServer({
        currentEncounter,
        encounterId: "encounter-1",
        executionGroupId: "group-modifiers",
        expectedRevision: currentEncounter.updatedAt,
        participantId: "aria",
        phase: "phase1",
        processId: "process-modifiers",
        stageId: "stage-review",
        taskId: "task-modifiers",
      }),
    ).resolves.toMatchObject({
      blocker: {
        code: "initiative_player_owned",
        participantId: "bera",
      },
      completedParticipantIds: ["aria"],
      encounter: { updatedAt: "2026-07-26T10:01:00.000Z" },
    });
    expectFetchCall(fetchMock, {
      body: {
        encounterId: "encounter-1",
        executionGroupId: "group-modifiers",
        expectedRevision: currentEncounter.updatedAt,
        participantId: "aria",
        phase: "phase1",
        processId: "process-modifiers",
        stageId: "stage-review",
        taskId: "task-modifiers",
      },
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/complete-remaining-step",
    });
  });

  it("sends the CE mutation through the active-v1 production client without a load signal", async () => {
    const currentEncounter = encounterSessionSchema.parse({
      combatRoundState: combatRoundStateSchema.parse({
        encounterId: "encounter-1",
        participants: [{ label: "Aria", participantId: "aria" }],
        rounds: [{ encounterId: "encounter-1", roundNumber: 1 }],
      }),
      createdAt: "2026-07-26T09:00:00.000Z",
      id: "encounter-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-07-26T10:00:00.000Z",
    });
    const response = buildActiveCombatMutationResponse({
      encounter: {
        ...currentEncounter,
        updatedAt: "2026-07-26T10:01:00.000Z",
      },
      mutationPresentation: {
        difficulty: 26,
        windowOpen: true,
      },
    });
    const fetchMock = stubFetch(response);
    const client = await loadClient();

    await expect(
      client.setCombatExperienceDifficultyOnServer({
        currentEncounter,
        difficulty: 26,
        encounterId: "encounter-1",
        executionGroupId: "group-ce",
        expectedRevision: currentEncounter.updatedAt,
        taskId: "task-ce",
      }),
    ).resolves.toMatchObject({
      difficulty: 26,
      encounter: {
        updatedAt: "2026-07-26T10:01:00.000Z",
      },
    });

    expectFetchCall(fetchMock, {
      body: {
        difficulty: 26,
        executionGroupId: "group-ce",
        expectedRevision: currentEncounter.updatedAt,
        taskId: "task-ce",
      },
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("does not serialize the local authoritative encounter in a generic mutation body", async () => {
    const currentEncounter = encounterSessionSchema.parse({
      combatRoundState: combatRoundStateSchema.parse({
        encounterId: "encounter-1",
        participants: [{ label: "Aria", participantId: "aria" }],
        rounds: [{ encounterId: "encounter-1", roundNumber: 1 }],
      }),
      createdAt: "2026-07-26T09:00:00.000Z",
      id: "encounter-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-07-26T10:00:00.000Z",
    });
    const response = buildActiveCombatMutationResponse({
      encounter: {
        ...currentEncounter,
        updatedAt: "2026-07-26T10:01:00.000Z",
      },
    });
    const fetchMock = stubFetch(response);
    const client = await loadClient();

    await client.respondCombatAdjustDistanceOnServer({
      currentEncounter,
      encounterId: "encounter-1",
      executionGroupId: "adjust-distance-group",
      expectedRevision: currentEncounter.updatedAt,
      proposalId: "adjust-distance-proposal",
      response: "allow",
      scenarioParticipantId: "aria",
      taskId: "adjust-distance-task",
    });

    expectFetchCall(fetchMock, {
      body: {
        encounterId: "encounter-1",
        executionGroupId: "adjust-distance-group",
        expectedRevision: currentEncounter.updatedAt,
        proposalId: "adjust-distance-proposal",
        response: "allow",
        scenarioParticipantId: "aria",
        taskId: "adjust-distance-task",
      },
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/respond-adjust-distance",
    });
  });

  it("rolls player Parry-Disarm with the exact attempt identity", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const fetchMock = stubFetch({ encounter });
    const client = await loadClient();

    await expect(
      client.rollCombatParryOnServer({
        attackResultId: "1:phase1:attacker:defender",
        attackerParticipantId: "attacker",
        commandType: "roll_parry",
        defenderParticipantId: "defender",
        disarmAttemptId: "disarm-attempt-1",
        encounterId: "encounter-1",
        executionGroupId: "parry-group",
        expectedParticipantRevision: "participant-revision-2",
        expectedRevision: "2026-07-22T10:00:00.000Z",
        modifierValidationTaskId: "parry-task",
        opportunityId: "attack-opportunity",
        parryPurpose: "parry_disarm",
        parrySourceId: "item-main-gauche",
        phase: "phase1",
        processId: "attack-process",
        scenarioParticipantId: "participant-2",
        taskId: "parry-task",
        stageId: "defense-stage",
        usedMainHand: true,
        usedOffHand: true,
      }),
    ).resolves.toEqual(encounter);

    expectFetchCall(fetchMock, {
      body: {
        attackResultId: "1:phase1:attacker:defender",
        attackerParticipantId: "attacker",
        commandType: "roll_parry",
        defenderParticipantId: "defender",
        disarmAttemptId: "disarm-attempt-1",
        executionGroupId: "parry-group",
        expectedParticipantRevision: "participant-revision-2",
        expectedRevision: "2026-07-22T10:00:00.000Z",
        modifierValidationTaskId: "parry-task",
        opportunityId: "attack-opportunity",
        parryPurpose: "parry_disarm",
        parrySourceId: "item-main-gauche",
        phase: "phase1",
        processId: "attack-process",
        scenarioParticipantId: "participant-2",
        taskId: "parry-task",
        stageId: "defense-stage",
        usedMainHand: true,
        usedOffHand: true,
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/roll-parry",
    });
  });

  it("rolls GM combat parry and keeps the command envelope summary", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const commandEnvelope = {
      currentStep: "phase_1_damage",
      latestResult: {
        attackResultId: "1:phase1:attacker:defender",
        kind: "parry",
      },
      warnings: [],
    };
    const fetchMock = stubFetch({ commandEnvelope, encounter });
    const client = await loadClient();

    await expect(
      client.rollCombatParryCommandOnServer({
        attackResultId: "1:phase1:attacker:defender",
        attackerParticipantId: "attacker",
        commandType: "roll_parry",
        defenderParticipantId: "defender",
        encounterId: "encounter-1",
        executionGroupId: "parry-group",
        expectedParticipantRevision: "participant-revision-2",
        expectedRevision: "2026-07-22T10:00:00.000Z",
        modifierValidationTaskId: "parry-task",
        opportunityId: "attack-opportunity",
        parryPurpose: "ordinary_defense",
        parrySourceId: "auto",
        phase: "phase1",
        processId: "attack-process",
        scenarioParticipantId: "participant-2",
        taskId: "parry-task",
        stageId: "defense-stage",
        usedMainHand: true,
      }),
    ).resolves.toEqual({ commandEnvelope, encounter });

    expectFetchCall(fetchMock, {
      body: {
        attackResultId: "1:phase1:attacker:defender",
        attackerParticipantId: "attacker",
        commandType: "roll_parry",
        defenderParticipantId: "defender",
        executionGroupId: "parry-group",
        expectedParticipantRevision: "participant-revision-2",
        expectedRevision: "2026-07-22T10:00:00.000Z",
        modifierValidationTaskId: "parry-task",
        opportunityId: "attack-opportunity",
        parryPurpose: "ordinary_defense",
        parrySourceId: "auto",
        phase: "phase1",
        processId: "attack-process",
        scenarioParticipantId: "participant-2",
        taskId: "parry-task",
        stageId: "defense-stage",
        usedMainHand: true,
        usedOffHand: undefined,
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/roll-parry",
    });
  });

  it("commits one exact GM defense review with awareness and source choices", async () => {
    const encounter = { id: "encounter-1", scenarioId: "scenario-1" };
    const commandEnvelope = { currentStep: "review_phase_2_actions", warnings: [] };
    const defenseSnapshot = { id: "defense-snapshot:attack-1" };
    const fetchMock = stubFetch({ commandEnvelope, defenseSnapshot, encounter });
    const client = await loadClient();

    await client.commitCombatDefenseReviewOnServer({
      attackId: "1:opportunity:attack-1",
      attackerParticipantId: "attacker",
      aware: false,
      defenderParticipantId: "defender",
      encounterId: "encounter-1",
      executionGroupId: "defense-review-group-1",
      expectedRevision: "2026-08-18T10:00:00.000Z",
      phase: "phase1",
      sourceSelections: [
        { included: true, itemId: "weapon-1" },
        { included: false, itemId: "shield-1" },
      ],
      taskId: "defense-review-task-1",
    });

    expectFetchCall(fetchMock, {
      body: {
        attackId: "1:opportunity:attack-1",
        attackerParticipantId: "attacker",
        aware: false,
        defenderParticipantId: "defender",
        encounterId: "encounter-1",
        executionGroupId: "defense-review-group-1",
        expectedRevision: "2026-08-18T10:00:00.000Z",
        phase: "phase1",
        sourceSelections: [
          { included: true, itemId: "weapon-1" },
          { included: false, itemId: "shield-1" },
        ],
        taskId: "defense-review-task-1",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/commit-defense-review",
    });
  });

  it("rolls Continued Contact maintenance with the exact contest and task lineage", async () => {
    const encounter = { id: "encounter-1", scenarioId: "scenario-1" };
    const commandEnvelope = { currentStep: "round_summary", warnings: [] };
    const fetchMock = stubFetch({ commandEnvelope, encounter });
    const client = await loadClient();

    await expect(
      client.rollContinuedContactMaintenanceOnServer({
        contestId: "maintenance-contest-1",
        continuedContactId: "continued-contact-1",
        encounterId: "encounter-1",
        executionGroupId: "maintenance-group-1",
        expectedRevision: "revision-1",
        opponentParticipantId: "encounter-participant-2",
        processId: "maintenance-process-1",
        scenarioParticipantId: "participant-1",
        stageId: "maintenance-stage-1",
        taskId: "maintenance-task-1",
      }),
    ).resolves.toEqual({ commandEnvelope, encounter });

    expectFetchCall(fetchMock, {
      body: {
        commandType: "roll_continued_contact_maintenance",
        contestId: "maintenance-contest-1",
        continuedContactId: "continued-contact-1",
        executionGroupId: "maintenance-group-1",
        expectedRevision: "revision-1",
        opponentParticipantId: "encounter-participant-2",
        processId: "maintenance-process-1",
        rollPurpose: "escape_continued_contact",
        scenarioParticipantId: "participant-1",
        stageId: "maintenance-stage-1",
        taskId: "maintenance-task-1",
      },
      method: "POST",
      url:
        "https://api.example.test/encounters/encounter-1/combat-round/" +
        "roll-continued-contact-maintenance",
    });
  });

  it("clears the current combat round step through the encounter domain", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const participants = [{ id: "participant-1" }];
    const fetchMock = stubFetch({ encounter, participants });
    const client = await loadClient();

    await expect(
      client.clearCurrentCombatRoundStepOnServer({
        encounterId: "encounter-1",
      }),
    ).resolves.toEqual({ encounter, participants });

    expectFetchCall(fetchMock, {
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/clear-current-step",
    });
  });

  it("advances the current combat round step through the encounter command endpoint", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const commandEnvelope = {
      currentStep: "review_action_modifiers",
      warnings: [],
    };
    const stepSnapshots: CombatRoundStepSnapshot[] = [
      {
        committedAt: "2026-01-01T00:00:00.000Z",
        id: "1:encounter-participant-1:select_actions",
        participantId: "encounter-participant-1",
        participantLabel: "The Gladiator",
        roundNumber: 1,
        step: "select_actions",
      },
    ];
    const fetchMock = stubFetch({ commandEnvelope, encounter });
    const client = await loadClient();

    await expect(
      client.advanceCombatRoundCurrentStepOnServer({
        commandType: "advance_combat_boundary",
        encounterId: "encounter-1",
        executionGroupId: "group:declaration:advance",
        expectedBoundary: "declaration",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        stepSnapshots,
        taskId: "task:declaration:advance",
        targetBoundary: "phase1_modifier_review",
      }),
    ).resolves.toEqual({ commandEnvelope, encounter });

    expectFetchCall(fetchMock, {
      body: {
        commandType: "advance_combat_boundary",
        executionGroupId: "group:declaration:advance",
        expectedBoundary: "declaration",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        stepSnapshots,
        taskId: "task:declaration:advance",
        targetBoundary: "phase1_modifier_review",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/advance-current-step",
    });
  });

  it("prepares round-end review without uploading encounter history", async () => {
    const encounter = { id: "encounter-1", scenarioId: "scenario-1" };
    const fetchMock = stubFetch({ encounter });
    const client = await loadClient();

    await expect(
      client.prepareCombatRoundEndReviewOnServer({
        encounterId: "encounter-1",
        executionGroupId: "group-round-end",
        expectedRevision: "revision-1",
        taskId: "task-round-end",
      }),
    ).resolves.toEqual({ encounter });

    expectFetchCall(fetchMock, {
      body: {
        executionGroupId: "group-round-end",
        expectedRevision: "revision-1",
        taskId: "task-round-end",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/prepare-round-end-review",
    });
  });

  it("rolls Combat Experience through the encounter command endpoint", async () => {
    const combatExperience = {
      difficulty: 26,
      durationRounds: 1,
      finalTotal: 19,
      label: "Active",
      modifierValue: -1,
      needsEffectRow: true,
      note: "combat exp active -1",
      resultBand: "active_penalty",
      rollD20: 5,
      rollTotal: 5,
      roundNumber: 1,
      skillTotal: 14,
      trigger: "combat_start",
    };
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const participant = {
      id: "participant-1",
    };
    const fetchMock = stubFetch({ combatExperience, encounter, participant });
    const client = await loadClient();

    await expect(
      client.rollCombatExperienceOnServer({
        encounterId: "encounter-1",
        executionGroupId: "group-ce",
        expectedRevision: "revision-1",
        scenarioParticipantId: "participant-1",
        taskId: "task-ce",
      }),
    ).resolves.toEqual({ combatExperience, encounter, participant });

    expectFetchCall(fetchMock, {
      body: {
        scenarioParticipantId: "participant-1",
        executionGroupId: "group-ce",
        expectedRevision: "revision-1",
        taskId: "task-ce",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/roll-combat-experience",
    });
  });

  it("backs out of a phase attack through the encounter command endpoint", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const participant = {
      id: "participant-1",
    };
    const fetchMock = stubFetch({ encounter, participant });
    const client = await loadClient();

    await expect(
      client.backOutPhaseAttackOnServer({
        encounterId: "encounter-1",
        executionGroupId: "group-choice",
        expectedRevision: "revision-1",
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        taskId: "task-choice",
      }),
    ).resolves.toEqual({ encounter, participant });

    expectFetchCall(fetchMock, {
      body: {
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        executionGroupId: "group-choice",
        expectedRevision: "revision-1",
        taskId: "task-choice",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/back-out-phase-attack",
    });
  });

  it("passes selected combat round cell details when clearing a specific step", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const participants = [{ id: "participant-1" }];
    const fetchMock = stubFetch({ encounter, participants });
    const client = await loadClient();

    await expect(
      client.clearCurrentCombatRoundStepOnServer({
        encounterId: "encounter-1",
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      }),
    ).resolves.toEqual({ encounter, participants });

    expectFetchCall(fetchMock, {
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/clear-current-step",
    });
  });

  it("posts equipment moves under the character equipment domain", async () => {
    const state = {
      inventory: [],
    };
    const fetchMock = stubFetch({ state });
    const client = await loadClient();

    await expect(
      client.moveCharacterEquipmentItemOnServer({
        carryMode: "backpack",
        characterId: "character-1",
        expectedRevision: 0,
        itemId: "item-1",
        locationId: "location-1",
      }),
    ).resolves.toEqual(state);

    expectFetchCall(fetchMock, {
      body: {
        carryMode: "backpack",
        expectedRevision: 0,
        itemId: "item-1",
        locationId: "location-1",
      },
      method: "POST",
      url: "https://api.example.test/characters/character-1/equipment/move",
    });
  });

  it("puts admin content through the admin content endpoint", async () => {
    const saved = {
      content: {
        skills: [],
      },
      savedAt: "2026-05-09T12:00:00.000Z",
    };
    const input = {
      content: {
        skills: [],
      },
      expectedVersion: "version-1",
    } as unknown as Parameters<LocalServiceClientModule["saveAdminCanonicalContentToServer"]>[0];
    const fetchMock = stubFetch(saved);
    const client = await loadClient();

    await expect(client.saveAdminCanonicalContentToServer(input)).resolves.toEqual(saved);

    expectFetchCall(fetchMock, {
      body: input,
      method: "PUT",
      url: "https://api.example.test/api/admin/content",
    });
  });

  it("maps API error payloads into ApiRequestError", async () => {
    const fetchMock = stubFetch(
      {
        error: "Invalid request.",
        issues: ["Name is required."],
      },
      400,
    );
    const client = await loadClient();

    await expect(client.loadCampaignById("missing")).rejects.toMatchObject({
      message: "Invalid request. Name is required.",
      payload: {
        error: "Invalid request.",
        issues: ["Name is required."],
      },
      status: 400,
    });

    expectFetchCall(fetchMock, {
      method: "GET",
      url: "https://api.example.test/campaigns/missing",
    });
  });
});
