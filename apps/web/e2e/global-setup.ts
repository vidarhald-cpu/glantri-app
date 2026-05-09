import fs from "node:fs";
import path from "node:path";

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
    cookies: [{ domain, expires: -1, httpOnly: true, name, path: "/", sameSite: "Lax", secure: false, value }],
    origins: [],
  };
}

const SMOKE_CHARACTER_ID = "smoke-char-00001";
const SMOKE_GM_EMAIL = "smoke-gm@test.local";
const SMOKE_PLAYER_EMAIL = "smoke-player@test.local";
const SMOKE_PASSWORD = "smoketest123";

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
      "/campaigns/accessible",
      gmCookie,
    );
    const found = campaigns.find((c) => c.name === "Smoke Test Campaign");
    if (!found) throw new Error("Could not create or find Smoke Test Campaign");
    campaignId = found.id;
  }

  // --- Player user: register or login ---
  let playerCookie: string;
  try {
    const { sessionCookie } = await apiPost<unknown>("/auth/register", {
      displayName: "Smoke Player",
      email: SMOKE_PLAYER_EMAIL,
      password: SMOKE_PASSWORD,
    });
    playerCookie = sessionCookie!;
  } catch {
    const { sessionCookie } = await apiPost<unknown>("/auth/login", {
      email: SMOKE_PLAYER_EMAIL,
      password: SMOKE_PASSWORD,
    });
    playerCookie = sessionCookie!;
  }

  // --- Character for player ---
  try {
    await apiPost(
      "/characters",
      {
        build: {
          equipment: { items: [] },
          id: SMOKE_CHARACTER_ID,
          name: "Smoke Character",
          profile: {
            description: "",
            distractionLevel: 3,
            id: `profile-${SMOKE_CHARACTER_ID}`,
            label: "Profile",
            rolledStats: { cha: 10, com: 10, con: 10, dex: 10, health: 10, int: 10, lck: 10, pow: 10, siz: 10, str: 10, will: 10 },
            societyLevel: 0,
          },
          progression: {
            chargenMode: "standard",
            educationPoints: 0,
            flexiblePointFactor: 1,
            level: 1,
            primaryPoolSpent: 0,
            primaryPoolTotal: 60,
            secondaryPoolSpent: 0,
            secondaryPoolTotal: 0,
            skillGroups: [],
            skills: [],
            specializations: [],
          },
          progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
        },
      },
      playerCookie,
    );
  } catch {
    // Character already exists — idempotent
  }

  // --- Save browser auth state ---
  const domain = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").hostname;
  fs.writeFileSync(path.join(authDir, "player.json"), JSON.stringify(buildStorageState(playerCookie, domain)));
  fs.writeFileSync(path.join(authDir, "gm.json"), JSON.stringify(buildStorageState(gmCookie, domain)));

  // --- Save test IDs for use in specs ---
  fs.writeFileSync(
    path.join(__dirname, "test-state.json"),
    JSON.stringify({ campaignId, characterId: SMOKE_CHARACTER_ID }),
  );
}
