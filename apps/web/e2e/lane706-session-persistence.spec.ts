/**
 * Lane-scoped rendered proof for Forgejo #706.
 *
 * The session cookie's security posture used to follow `NODE_ENV`, so a production container
 * served over plain HTTP emitted `SameSite=None; Secure`. The login response still returned 200
 * with the user body, so the UI reported success, but any browser without a localhost exemption
 * for `Secure` dropped the cookie and every later `/auth/me` returned `user: null`.
 *
 * This spec logs in through the UI in each configured engine and then exercises ordinary
 * navigation, a hard refresh, a direct authenticated URL and logout, asserting both the rendered
 * result and the API's own view of the session. It is run by hand against a lane-owned production
 * container stack; see `playwright.lane706.config.ts`.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { WEB_URL, API_URL } from "./targets";

const SEEDED_EMAIL = process.env.LANE706_SEED_EMAIL ?? "local-gm@example.com";
const SEEDED_PASSWORD = process.env.LANE706_SEED_PASSWORD ?? "devpassword123";

const SIGNED_OUT_MARKERS = [
  "You need to sign in before you can use this part of the app.",
  "Sign in to see your Campaigns and continue playing.",
  "No active local-service session.",
];

type SessionProbe = {
  readonly status: number;
  readonly email: string | null;
  readonly roles: readonly string[] | null;
};

/** Reads `/auth/me` from inside the page, so the browser's own cookie rules decide what is sent. */
async function readSessionFromBrowser(page: Page): Promise<SessionProbe> {
  return page.evaluate(async (apiUrl) => {
    const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
    const body = (await response.json()) as {
      user: { email: string; roles: string[] } | null;
    };

    return {
      email: body.user?.email ?? null,
      roles: body.user?.roles ?? null,
      status: response.status,
    };
  }, API_URL);
}

async function readStatusFromBrowser(page: Page, path: string): Promise<number> {
  return page.evaluate(
    async ({ apiUrl, requestPath }) => {
      const response = await fetch(`${apiUrl}${requestPath}`, { credentials: "include" });
      return response.status;
    },
    { apiUrl: API_URL, requestPath: path },
  );
}

async function expectRenderedAsSignedIn(page: Page): Promise<void> {
  await expect(page.getByText("Loading session...")).toHaveCount(0, { timeout: 15_000 });

  for (const marker of SIGNED_OUT_MARKERS) {
    await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
  }
}

async function sessionCookie(context: BrowserContext) {
  const cookies = await context.cookies(WEB_URL);
  return cookies.find((cookie) => cookie.name === "glantri_session");
}

async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Auth" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible({ timeout: 15_000 });
}

test.describe("#706 production session cookie survives navigation and refresh", () => {
  test("seeded dual-role account: login, navigation, refresh, direct URL, logout", async ({
    page,
    context,
  }) => {
    // 1. Log in through the UI.
    await loginThroughUi(page, SEEDED_EMAIL, SEEDED_PASSWORD);

    const issued = await sessionCookie(context);
    expect(issued, "the browser stored the session cookie the API issued").toBeDefined();
    expect(issued?.secure, "a plain-HTTP deployment must not mark the cookie Secure").toBe(false);
    expect(issued?.httpOnly).toBe(true);
    expect(issued?.sameSite).toBe("Lax");

    const afterLogin = await readSessionFromBrowser(page);
    expect(afterLogin.status).toBe(200);
    expect(afterLogin.email).toBe(SEEDED_EMAIL);

    // 2. Land on another authenticated page.
    await page.goto("/campaigns");
    await expectRenderedAsSignedIn(page);
    expect((await readSessionFromBrowser(page)).email).toBe(SEEDED_EMAIL);

    // 3. Navigate across several authenticated routes.
    for (const route of ["/characters", "/skills", "/chargen", "/admin"]) {
      await page.goto(route);
      await expectRenderedAsSignedIn(page);
      const probe = await readSessionFromBrowser(page);
      expect(probe.email, `session held on ${route}`).toBe(SEEDED_EMAIL);
    }

    // 4. Hard refresh.
    await page.reload();
    await expectRenderedAsSignedIn(page);
    expect((await readSessionFromBrowser(page)).email).toBe(SEEDED_EMAIL);

    // 5. Open a direct authenticated URL in a fresh page of the same browser session.
    const directPage = await context.newPage();
    await directPage.goto(`${WEB_URL}/admin/players`);
    await expectRenderedAsSignedIn(directPage);

    // 6. The session is still authenticated, and the API agrees.
    const direct = await readSessionFromBrowser(directPage);
    expect(direct.email).toBe(SEEDED_EMAIL);
    expect(direct.roles).toEqual(expect.arrayContaining(["player", "game_master"]));
    expect(await readStatusFromBrowser(directPage, "/auth/users")).toBe(200);
    await directPage.close();

    // 7. Log out, and prove the session is gone rather than merely hidden.
    await page.goto("/auth");
    await expect(page.getByText(`Email: ${SEEDED_EMAIL}`)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Logout", exact: true }).first().click();
    await expect(page.getByText("Signed out.")).toBeVisible({ timeout: 15_000 });

    const cleared = await sessionCookie(context);
    expect(cleared, "the session cookie is removed from the browser").toBeUndefined();

    const afterLogout = await readSessionFromBrowser(page);
    expect(afterLogout.email, "the API no longer recognises a session").toBeNull();
    expect(
      await readStatusFromBrowser(page, "/auth/users"),
      "a protected API call is refused after logout",
    ).toBe(401);
  });

  test("a registered player-only account is player-only and holds its session", async ({
    page,
    context,
  }) => {
    const email = `lane706-player-${Date.now()}-${process.env.TEST_PARALLEL_INDEX ?? "0"}-${Math.floor(
      Math.random() * 100_000,
    )}@example.invalid`;
    const password = "lane706-player-password";

    await page.goto("/auth");
    await page.getByLabel("Display name").fill("Lane 706 Player");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Register", exact: true }).click();
    await expect(page.getByText(`Registered and signed in as ${email}.`)).toBeVisible({
      timeout: 15_000,
    });

    const issued = await sessionCookie(context);
    expect(issued).toBeDefined();
    expect(issued?.secure).toBe(false);

    // Roles read back from the API, not from the rendered page.
    const probe = await readSessionFromBrowser(page);
    expect(probe.email).toBe(email);
    expect(probe.roles, "the registered account is genuinely player-only").toEqual(["player"]);

    // The shared session mechanism holds across navigation and refresh for this account too.
    await page.goto("/characters");
    await expectRenderedAsSignedIn(page);
    await page.reload();
    expect((await readSessionFromBrowser(page)).email).toBe(email);

    // Player-only means player-only: an admin-scoped API call is refused with 403, not 401.
    expect(await readStatusFromBrowser(page, "/auth/users")).toBe(403);

    await page.goto("/auth");
    await page.getByRole("button", { name: "Logout", exact: true }).first().click();
    await expect(page.getByText("Signed out.")).toBeVisible({ timeout: 15_000 });
    expect(await sessionCookie(context)).toBeUndefined();
    expect((await readSessionFromBrowser(page)).email).toBeNull();
  });
});
