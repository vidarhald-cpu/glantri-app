import fs from "node:fs";
import path from "node:path";
import { characterPayload } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function apiPost<T = unknown>(
  endpoint: string,
  body: unknown,
  sessionCookie?: string,
): Promise<{ data: T; sessionCookie?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${endpoint} → ${res.status}: ${text}`);
  }

  const data = (await res.json()) as T;
  const setCookie = res.headers.get("set-cookie");
  const outCookie = setCookie ? (setCookie.split(";")[0] ?? undefined) : undefined;
  return { data, sessionCookie: outCookie };
}

async function apiGet<T = unknown>(endpoint: string, sessionCookie: string): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Cookie: sessionCookie },
  });
  if (!res.ok) {
    throw new Error(`GET ${endpoint} → ${res.status}`);
  }
  return (await res.json()) as T;
}

function buildStorageState(cookieHeader: string, domain: string): object {
  const nameValue = (cookieHeader.split(";")[0] ?? "").trim();
  const eqIdx = nameValue.indexOf("=");
  const name = nameValue.slice(0, eqIdx).trim();
  const value = nameValue.slice(eqIdx + 1).trim();
  return {
    cookies: [
      {
        domain,
        expires: -1,
        httpOnly: true,
        name,
        path: "/",
        sameSite: "Lax",
        secure: false,
        value,
      },
    ],
    origins: [],
  };
}

const SMOKE_CHARACTER_ID = "smoke-char-00001";
const SMOKE_NON_HOLDER_CHARACTER_ID = "smoke-char-00002";
const SMOKE_DELEGATED_CHARACTER_ID = "smoke-char-00003";
const SMOKE_GM_EMAIL = "smoke-gm@test.local";
const SMOKE_NON_HOLDER_EMAIL = "smoke-non-holder@test.local";
const SMOKE_PLAYER_EMAIL = "smoke-player@test.local";
const SMOKE_UNRELATED_EMAIL = "smoke-unrelated@test.local";
const SMOKE_PASSWORD = "smoketest123";

async function loginOrRegister(email: string, displayName: string): Promise<string> {
  try {
    const { sessionCookie } = await apiPost<unknown>("/auth/register", {
      displayName,
      email,
      password: SMOKE_PASSWORD,
    });
    return sessionCookie!;
  } catch {
    const { sessionCookie } = await apiPost<unknown>("/auth/login", {
      email,
      password: SMOKE_PASSWORD,
    });
    return sessionCookie!;
  }
}

export default async function globalSetup() {
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  // --- GM user: register or login, then claim GM role ---
  let gmCookie: string;
  try {
    const { sessionCookie } = await apiPost<unknown>("/auth/register", {
      displayName: "Smoke GM",
      email: SMOKE_GM_EMAIL,
      password: SMOKE_PASSWORD,
    });
    gmCookie = sessionCookie!;
    // First user — claim GM role via bootstrap (only works when no GM exists yet)
    await apiPost("/auth/bootstrap-gm", {}, gmCookie);
  } catch {
    const { sessionCookie } = await apiPost<unknown>("/auth/login", {
      email: SMOKE_GM_EMAIL,
      password: SMOKE_PASSWORD,
    });
    gmCookie = sessionCookie!;
  }

  // --- Campaign + scenario (create once, reuse if already present) ---
  let campaignId: string;
  try {
    const { data } = await apiPost<{ campaign: { id: string } }>(
      "/campaigns",
      { name: "Smoke Test Campaign" },
      gmCookie,
    );
    campaignId = data.campaign.id;
    await apiPost(`/campaigns/${campaignId}/scenarios`, { name: "Smoke Test Scenario" }, gmCookie);
  } catch {
    const { campaigns } = await apiGet<{ campaigns: Array<{ id: string; name: string }> }>(
      "/campaigns",
      gmCookie,
    );
    const found = campaigns.find((c) => c.name === "Smoke Test Campaign");
    if (!found) throw new Error("Could not create or find Smoke Test Campaign");
    campaignId = found.id;
  }

  // --- Player user: register or login ---
  const playerCookie = await loginOrRegister(SMOKE_PLAYER_EMAIL, "Smoke Player");
  const nonHolderCookie = await loginOrRegister(SMOKE_NON_HOLDER_EMAIL, "Smoke Non-holder");
  const unrelatedCookie = await loginOrRegister(SMOKE_UNRELATED_EMAIL, "Smoke Unrelated");
  const { user: nonHolderUser } = await apiGet<{ user: { id: string } }>(
    "/auth/me",
    nonHolderCookie,
  );

  // --- Character for player ---
  try {
    await apiPost(
      "/characters",
      characterPayload(SMOKE_CHARACTER_ID, "Smoke Character"),
      playerCookie,
    );
  } catch {
    // Character already exists — idempotent
  }

  try {
    await apiPost(
      "/characters",
      characterPayload(SMOKE_NON_HOLDER_CHARACTER_ID, "Smoke Non-holder Character"),
      nonHolderCookie,
    );
  } catch {
    // Character already exists — idempotent
  }

  try {
    await apiPost(
      "/characters",
      characterPayload(SMOKE_DELEGATED_CHARACTER_ID, "Smoke Delegated Character"),
      playerCookie,
    );
  } catch {
    // Character already exists — idempotent
  }

  // --- B2 campaign with the player's Character available for initial item assignment ---
  const { data: b2CampaignData } = await apiPost<{ campaign: { id: string } }>(
    "/campaigns",
    { name: `B2 Item Workshop ${Date.now()}` },
    gmCookie,
  );
  const b2CampaignId = b2CampaignData.campaign.id;
  await apiPost(
    `/campaigns/${b2CampaignId}/roster`,
    {
      category: "pc",
      sourceId: SMOKE_CHARACTER_ID,
      sourceType: "character",
    },
    gmCookie,
  );
  await apiPost(
    `/campaigns/${b2CampaignId}/roster`,
    {
      category: "pc",
      sourceId: SMOKE_NON_HOLDER_CHARACTER_ID,
      sourceType: "character",
    },
    gmCookie,
  );
  const { data: b2ScenarioData } = await apiPost<{ scenario: { id: string } }>(
    `/campaigns/${b2CampaignId}/scenarios`,
    { name: "B2 Perspective Scenario", status: "live" },
    gmCookie,
  );
  await apiPost(
    `/scenarios/${b2ScenarioData.scenario.id}/participants/character`,
    { characterId: SMOKE_CHARACTER_ID },
    playerCookie,
  );
  await apiPost(
    `/scenarios/${b2ScenarioData.scenario.id}/participants/character`,
    { characterId: SMOKE_NON_HOLDER_CHARACTER_ID },
    nonHolderCookie,
  );

  // --- Campaign Home privacy: owner keeps Campaign access while Scenario control is delegated ---
  const delegatedCampaignName = `Delegated Privacy Campaign ${Date.now()}`;
  const delegatedScenarioName = "Delegated Private Scenario";
  const delegatedScenarioDescription = "Private to delegated controller";
  const { data: delegatedCampaignData } = await apiPost<{ campaign: { id: string } }>(
    "/campaigns",
    { name: delegatedCampaignName, status: "active" },
    gmCookie,
  );
  const delegatedCampaignId = delegatedCampaignData.campaign.id;
  await apiPost(
    `/campaigns/${delegatedCampaignId}/roster`,
    {
      category: "pc",
      sourceId: SMOKE_DELEGATED_CHARACTER_ID,
      sourceType: "character",
    },
    gmCookie,
  );
  const { data: delegatedScenarioData } = await apiPost<{ scenario: { id: string } }>(
    `/campaigns/${delegatedCampaignId}/scenarios`,
    {
      description: delegatedScenarioDescription,
      name: delegatedScenarioName,
      status: "live",
    },
    gmCookie,
  );
  const delegatedScenarioId = delegatedScenarioData.scenario.id;
  const { data: delegatedParticipantData } = await apiPost<{ participant: { id: string } }>(
    `/scenarios/${delegatedScenarioId}/participants/character`,
    {
      characterId: SMOKE_DELEGATED_CHARACTER_ID,
      controlledByUserId: nonHolderUser.id,
    },
    gmCookie,
  );
  const delegatedEncounterName = "Delegated Private Encounter";
  const delegatedEncounterDescription = "Controller-only moment";
  const delegatedEncounterSeed = Date.now();
  const delegatedEncounterTimestamp = new Date().toISOString();
  const { data: delegatedEncounterData } = await apiPost<{ encounter: { id: string } }>(
    `/scenarios/${delegatedScenarioId}/encounters`,
    {
      session: {
        campaignId: delegatedCampaignId,
        createdAt: delegatedEncounterTimestamp,
        description: delegatedEncounterDescription,
        id: `delegated-encounter-${delegatedEncounterSeed}`,
        kind: "roleplay",
        participantMembershipMode: "explicit",
        participants: [
          {
            characterId: SMOKE_DELEGATED_CHARACTER_ID,
            id: `delegated-encounter-participant-${delegatedEncounterSeed}`,
            label: "Smoke Delegated Character",
            participantType: "scenario",
            scenarioParticipantId: delegatedParticipantData.participant.id,
          },
        ],
        roleplayState: {
          actionLog: [],
          gmMessage: delegatedEncounterDescription,
          participantDescriptions: {},
          pendingSkillRolls: [],
          visibility: {},
        },
        scenarioId: delegatedScenarioId,
        status: "active",
        title: delegatedEncounterName,
        updatedAt: delegatedEncounterTimestamp,
      },
    },
    gmCookie,
  );
  const delegatedEncounterId = delegatedEncounterData.encounter.id;

  // --- Save browser auth state ---
  const domain = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").hostname;
  fs.writeFileSync(
    path.join(authDir, "player.json"),
    JSON.stringify(buildStorageState(playerCookie, domain)),
  );
  fs.writeFileSync(
    path.join(authDir, "gm.json"),
    JSON.stringify(buildStorageState(gmCookie, domain)),
  );
  fs.writeFileSync(
    path.join(authDir, "non-holder.json"),
    JSON.stringify(buildStorageState(nonHolderCookie, domain)),
  );
  fs.writeFileSync(
    path.join(authDir, "unrelated.json"),
    JSON.stringify(buildStorageState(unrelatedCookie, domain)),
  );

  // --- Save test IDs for use in specs ---
  fs.writeFileSync(
    path.join(__dirname, "test-state.json"),
    JSON.stringify({
      b2CampaignId,
      campaignId,
      characterId: SMOKE_CHARACTER_ID,
      delegatedCampaignId,
      delegatedCampaignName,
      delegatedEncounterDescription,
      delegatedEncounterId,
      delegatedEncounterName,
      delegatedScenarioDescription,
      delegatedScenarioId,
      delegatedScenarioName,
      nonHolderCharacterId: SMOKE_NON_HOLDER_CHARACTER_ID,
    }),
  );
}
