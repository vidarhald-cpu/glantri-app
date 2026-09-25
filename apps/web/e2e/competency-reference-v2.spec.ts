import { expect, test } from "@playwright/test";

test.describe("canonical V2 competency reference", () => {
  test.use({ storageState: "e2e/.auth/player.json" });

  test("shows the mapped Medicine relationship and current Learning Group successor", async ({
    page,
  }) => {
    await page.goto("/skills");
    await expect(page.getByRole("heading", { name: "Skills and training" })).toBeVisible();
    await page
      .getByRole("searchbox", { name: "Search Skills, languages, and writing" })
      .fill("Medicine");
    await page.getByRole("button", { name: /^Medicine Skill/ }).click();
    await expect(page.getByRole("heading", { name: "Medicine", exact: true })).toBeVisible();
    await expect(page.getByText(/Derived grant.*Factor 1\.0/)).toBeVisible();

    await page.goto("/skills#group-G06");
    await expect(page.getByRole("heading", { name: "Working a boat" })).toBeVisible();
    await expect(page.getByText(/Current practice:/)).toBeVisible();
    await page
      .getByText("Current practice:")
      .getByRole("link", { name: "Small-craft boat working" })
      .click();
    await expect(page.getByRole("heading", { name: "Small-craft boat working" })).toBeVisible();
  });

  test("keeps Admin reference restricted to Admin accounts", async ({ page }) => {
    await page.goto("/admin/skills/reference");
    await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  });
});
