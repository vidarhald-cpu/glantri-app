import { afterEach, describe, expect, it, vi } from "vitest";

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
        actionId: "attack_parry",
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
        scenarioParticipantId: "participant-1",
      }),
    ).resolves.toEqual({ encounter, participant });

    expectFetchCall(fetchMock, {
      body: {
        actionId: "attack_parry",
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
        scenarioParticipantId: "participant-1",
        secondaryActionId: undefined,
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
        initiativeBase: 3,
        initiativeModifierAdjustment: -1,
        scenarioParticipantId: "participant-1",
      }),
    ).resolves.toEqual({ encounter, initiative: { rolls: [6, 2], total: 8 } });

    expectFetchCall(fetchMock, {
      body: {
        initiativeBase: 3,
        initiativeModifierAdjustment: -1,
        scenarioParticipantId: "participant-1",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-initiative",
    });
  });

  it("rolls combat parry through the encounter round domain", async () => {
    const encounter = {
      id: "encounter-1",
      scenarioId: "scenario-1",
    };
    const fetchMock = stubFetch({ encounter });
    const client = await loadClient();

    await expect(
      client.rollCombatParryOnServer({
        attackResultId: "1:phase1:attacker:defender",
        encounterId: "encounter-1",
        modifierBreakdown: [
          { label: "General/Fatigue", value: 0 },
          { label: "DB/Parry", value: -4 },
          { label: "attack result", value: -2 },
        ],
        parryBase: 13,
        parrySourceLabel: "Sword / shield",
        scenarioParticipantId: "participant-2",
        usedMainHand: true,
        usedOffHand: true,
      }),
    ).resolves.toEqual(encounter);

    expectFetchCall(fetchMock, {
      body: {
        attackResultId: "1:phase1:attacker:defender",
        mainHandParryScore: undefined,
        modifierBreakdown: [
          { label: "General/Fatigue", value: 0 },
          { label: "DB/Parry", value: -4 },
          { label: "attack result", value: -2 },
        ],
        offHandParryScore: undefined,
        parryBase: 13,
        parrySourceLabel: "Sword / shield",
        scenarioParticipantId: "participant-2",
        usedMainHand: true,
        usedOffHand: true,
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/roll-parry",
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
        scenarioParticipantId: "participant-1",
      }),
    ).resolves.toEqual({ combatExperience, encounter, participant });

    expectFetchCall(fetchMock, {
      body: {
        scenarioParticipantId: "participant-1",
      },
      method: "POST",
      url: "https://api.example.test/encounters/encounter-1/combat-round/roll-combat-experience",
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
        itemId: "item-1",
        locationId: "location-1",
      }),
    ).resolves.toEqual(state);

    expectFetchCall(fetchMock, {
      body: {
        carryMode: "backpack",
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
