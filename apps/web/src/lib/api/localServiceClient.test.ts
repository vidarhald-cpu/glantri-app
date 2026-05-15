import { afterEach, describe, expect, it, vi } from "vitest";

type LocalServiceClientModule = typeof import("./localServiceClient");
type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

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
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(init?.body).toBe(JSON.stringify(expected.body));
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
