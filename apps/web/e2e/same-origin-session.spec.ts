import { expect, test, type Page } from "@playwright/test";

const WEB_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const PASSWORD = "smoketest123";

test.use({ trace: "off" });

interface BrowserApiResult<T> {
  body: T;
  status: number;
}

async function browserApi<T>(
  page: Page,
  path: string,
  init?: { body?: unknown; method?: string },
): Promise<BrowserApiResult<T>> {
  return page.evaluate(
    async ({ body, method, path: requestPath }) => {
      const response = await fetch(requestPath, {
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        method: method ?? "GET",
      });
      return {
        body: (await response.json()) as T,
        status: response.status,
      };
    },
    { body: init?.body, method: init?.method, path },
  );
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible({ timeout: 10_000 });
}

function characterPayload(id: string, name: string) {
  return {
    build: {
      equipment: { items: [] },
      currentStatModifiers: {},
      developedStatModifiers: { str: 1 },
      id,
      name,
      profile: {
        description: "Same-origin session verification",
        distractionLevel: 3,
        id: `profile-${id}`,
        label: "Same-origin profile",
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
          str: 12,
          will: 10,
        },
        resolvedStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 13,
          will: 10,
        },
        societyLevel: 0,
        statLayerVersion: 1,
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
  };
}

test("same-origin session survives refresh, authorizes Character/Admin flows, and clears on logout", async ({
  browser,
  browserName,
  context,
  page,
}) => {
  const webOrigin = new URL(WEB_BASE_URL).origin;
  const directApiRequests: string[] = [];
  const webApiRequests: string[] = [];
  await page.route(`${API_URL}/**`, async (route) => {
    directApiRequests.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      webApiRequests.push(request.url());
    }
  });

  await page.goto("/auth");
  await expect(browserApi<{ user: null }>(page, "/api/auth/me")).resolves.toEqual({
    body: expect.objectContaining({ user: null }),
    status: 200,
  });

  await login(page, "smoke-player@test.local");
  const me = await browserApi<{ user: { email: string; id: string; roles: string[] } }>(
    page,
    "/api/auth/me",
  );
  expect(me).toEqual({
    body: expect.objectContaining({
      user: expect.objectContaining({
        email: "smoke-player@test.local",
        roles: ["player"],
      }),
    }),
    status: 200,
  });

  const sessionCookie = (await context.cookies(webOrigin)).find(
    (cookie) => cookie.name === "glantri_session",
  );
  expect(sessionCookie).toBeDefined();
  expect({
    domain: sessionCookie?.domain,
    httpOnly: sessionCookie?.httpOnly,
    path: sessionCookie?.path,
  }).toEqual({
    domain: new URL(webOrigin).hostname,
    httpOnly: true,
    path: "/",
  });

  await page.reload();
  await expect(page.getByText("Email: smoke-player@test.local")).toBeVisible({ timeout: 10_000 });
  await expect(browserApi(page, "/api/auth/me")).resolves.toMatchObject({
    body: { user: { email: "smoke-player@test.local" } },
    status: 200,
  });

  await page.goto("/chargen");
  await expect(page.getByRole("button", { name: "Roll all dice" })).toBeVisible({
    timeout: 15_000,
  });

  const characterRunId = Date.now();
  const characterId = `same-origin-${browserName}-${characterRunId}`;
  const characterName = `Same-origin ${browserName} Character ${characterRunId}`;
  const created = await browserApi<{ character: { id: string; name: string } }>(
    page,
    "/api/characters",
    {
      body: characterPayload(characterId, characterName),
      method: "POST",
    },
  );
  expect(created).toEqual({
    body: { character: expect.objectContaining({ id: characterId, name: characterName }) },
    status: 200,
  });
  await page.goto("/characters");
  await expect(page.getByText(characterName)).toBeVisible({ timeout: 10_000 });

  const forbiddenRoleChange = await browserApi<{ error: string }>(
    page,
    `/api/auth/users/${me.body.user.id}/role`,
    { body: { role: "admin" }, method: "POST" },
  );
  expect(forbiddenRoleChange).toEqual({
    body: { error: "Admin role required." },
    status: 403,
  });

  await page.goto("/auth");
  await page.getByRole("button", { name: "Logout" }).first().click();
  await expect(page.getByText("Signed out.")).toBeVisible();
  expect(
    (await context.cookies(webOrigin)).some((cookie) => cookie.name === "glantri_session"),
  ).toBe(false);
  await expect(browserApi(page, "/api/auth/me")).resolves.toEqual({
    body: expect.objectContaining({ user: null }),
    status: 200,
  });
  await expect(browserApi(page, "/api/characters")).resolves.toEqual({
    body: { error: "Authentication required." },
    status: 401,
  });

  const gmContext = await browser.newContext({ baseURL: WEB_BASE_URL });
  const gmPage = await gmContext.newPage();
  const gmDirectApiRequests: string[] = [];
  await gmPage.route(`${API_URL}/**`, async (route) => {
    gmDirectApiRequests.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  try {
    expect((await gmContext.cookies()).length).toBe(0);
    await login(gmPage, "smoke-gm@test.local");
    await gmPage.goto("/admin/players");
    await expect(gmPage.getByRole("heading", { name: "Players" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(gmPage.getByRole("cell", { name: "smoke-player@test.local" })).toBeVisible();
    await expect(gmPage.getByText("Authentication required.")).toHaveCount(0);
  } finally {
    await gmContext.close();
  }

  expect(directApiRequests).toEqual([]);
  expect(gmDirectApiRequests).toEqual([]);
  expect(webApiRequests.length).toBeGreaterThan(0);
  expect(webApiRequests.every((url) => new URL(url).origin === webOrigin)).toBe(true);
});
