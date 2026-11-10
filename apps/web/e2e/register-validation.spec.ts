import { expect, test } from "@playwright/test";
import { API_URL } from "./targets";

// Forgejo #1112: registration with a too-short password or invalid email is a clear 400 with a
// field message (not a generic 500), and the auth page states the password rule.

test.describe("Registration validation (#1112)", () => {
  test("API answers 400 per field, never echoes the password, and keeps 409 and success", async ({
    playwright,
  }) => {
    const api = await playwright.request.newContext();
    try {
      const stamp = Date.now();
      const short = await api.post(`${API_URL}/auth/register`, {
        data: { email: `short-${stamp}@test.local`, password: "sevench" },
      });
      expect(short.status()).toBe(400);
      expect(await short.text()).not.toContain("sevench");
      expect(((await short.json()) as { error: string }).error).toBe(
        "Password must be at least 8 characters.",
      );

      const badEmail = await api.post(`${API_URL}/auth/register`, {
        data: { email: "not-an-email", password: "longenough1" },
      });
      expect(badEmail.status()).toBe(400);
      expect(((await badEmail.json()) as { error: string }).error).toBe(
        "Enter a valid email address.",
      );

      const email = `valid-${stamp}@test.local`;
      const ok = await api.post(`${API_URL}/auth/register`, {
        data: { email, password: "longenough1" },
      });
      expect(ok.status()).toBeLessThan(300);

      const dup = await api.post(`${API_URL}/auth/register`, {
        data: { email, password: "longenough1" },
      });
      expect(dup.status()).toBe(409);
    } finally {
      await api.dispose();
    }
  });

  test("auth page shows the rule, the specific short-password message, and registers a valid account", async ({
    page,
  }) => {
    await page.goto("/auth");
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible({ timeout: 15_000 });

    const stamp = Date.now();
    await page.getByLabel("Email").fill(`ui-short-${stamp}@test.local`);
    await page.getByLabel(/^Password/).fill("sevench");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(
      page.getByText("Password must be at least 8 characters.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Request failed with status/)).toHaveCount(0);

    const email = `ui-valid-${stamp}@test.local`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Password/).fill("longenough1");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText(`Registered and signed in as ${email}.`)).toBeVisible();
  });
});
