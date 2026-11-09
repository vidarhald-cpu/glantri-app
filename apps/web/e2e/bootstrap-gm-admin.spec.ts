import { expect, test } from "@playwright/test";
import { API_URL } from "./targets";

// Forgejo #1089: the one-time first-GM bootstrap claim (made by global-setup for smoke-gm) also
// grants admin. Later GMs are appointed through Admin -> Players and are not admins.
// The claim itself, on an empty database, is covered by the API integration test
// `apps/api/src/routes/authBootstrapGm.integration.test.ts`.

test.describe("First GM bootstrap claim also grants admin (#1089)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("the claimant is GM and admin, appoints a second GM who is not admin, and the claim stays closed", async ({
    browser,
    page,
  }) => {
    const me = await page.request.get(`${API_URL}/auth/me`);
    expect(me.status()).toBe(200);
    const roles = ((await me.json()) as { user: { roles: string[] } }).user.roles;
    expect(roles).toEqual(expect.arrayContaining(["game_master", "admin"]));

    const email = `bootstrap-second-gm-${Date.now()}@test.local`;
    const secondContext = await browser.newContext();
    try {
      const register = await secondContext.request.post(`${API_URL}/auth/register`, {
        data: { displayName: "Second GM", email, password: "smoketest123" },
      });
      expect(register.status()).toBeLessThan(300);

      await page.goto("/admin/players");
      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole("combobox").selectOption("game_master");
      await expect(page.getByText(`Updated ${email} to`)).toBeVisible();

      const secondMe = await secondContext.request.get(`${API_URL}/auth/me`);
      const secondRoles = ((await secondMe.json()) as { user: { roles: string[] } }).user.roles;
      expect(secondRoles).toEqual(["game_master"]);

      // The claim is closed: refused, and not offered.
      const second = await secondContext.request.post(`${API_URL}/auth/bootstrap-gm`);
      expect(second.status()).toBe(403);
      await page.goto("/auth");
      await expect(page.getByText(`Email: smoke-gm@test.local`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /claim/i })).toHaveCount(0);
    } finally {
      await secondContext.close();
    }
  });
});
