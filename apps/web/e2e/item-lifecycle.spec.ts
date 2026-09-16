import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
test.describe("GM Item lifecycle", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });
  test("discovers 100 Items, creates three, retains a failed draft and resolves two-session conflict", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(15_000);
    const { b2CampaignId, characterId } = JSON.parse(
      fs.readFileSync(path.join(__dirname, "test-state.json"), "utf8"),
    );
    const prefix = `Lifecycle ${Date.now()}`;
    const endpoint = `${API}/campaigns/${b2CampaignId}/items`;
    for (let index = 0; index < 100; index++) {
      const response = await page.request.post(endpoint, {
        data: {
          templateId: index % 2 ? "weapon-template-dagger" : null,
          displayName: `${prefix} collection ${index}`,
          facts: {},
        },
      });
      expect(response.ok()).toBe(true);
    }
    await page.goto(`/campaigns/${b2CampaignId}?tab=items`);
    await page.getByLabel("Find Items").fill(`${prefix} collection`);
    await expect(page.locator("article")).toHaveCount(100);
    await page.getByLabel("Item category").selectOption("descriptive");
    await expect(page.locator("article")).toHaveCount(50);
    await page.getByLabel("Holder", { exact: true }).selectOption("unassigned");
    await page.reload();
    await expect(page.locator("article")).toHaveCount(50);
    await page.getByLabel("Find Items").fill("not-present-in-this-campaign");
    await expect(page.getByText("No Items match these filters.")).toBeVisible();
    await page.getByLabel("Item category").selectOption("");
    await page.getByLabel("Find Items").fill(prefix);
    await page.getByRole("button", { name: "Create item", exact: true }).click();
    await page.getByRole("combobox", { name: "Template", exact: true }).selectOption("");
    for (let index = 0; index < 3; index++) {
      await page.getByLabel("Item name", { exact: false }).fill(`${prefix} Letter ${index}`);
      await page.getByRole("button", { name: "Create and add another" }).click();
      await expect(page.getByRole("status")).toContainText(`Letter ${index} created`);
      await expect(page.getByRole("combobox", { name: "Template", exact: true })).toHaveValue("");
    }
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(103);
    await page.getByRole("button", { name: "Create item", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Template", exact: true })
      .selectOption("weapon-template-dagger");
    const longName = `${prefix} ${"A very long named ceremonial blade ".repeat(8)}`.trim();
    await page.getByLabel("Item name (optional)").fill(longName);
    await page.locator("summary").filter({ hasText: "Equipment inputs" }).click();
    await page.getByLabel("Override Base ENC", { exact: true }).check();
    await page.getByRole("spinbutton", { name: "Base ENC override", exact: true }).fill("0");
    await page.route(endpoint, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Retry fixture" }),
          })
        : route.continue(),
    );
    await page.getByRole("button", { name: "Create item", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Retry fixture" })).toBeVisible();
    await expect(page.getByLabel("Item name (optional)")).toHaveValue(longName);
    await page.unroute(endpoint);
    await page.getByRole("button", { name: "Create item", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Item created.");
    const payload = await (await page.request.get(endpoint)).json();
    const item = Object.values(
      payload.state.itemsById as Record<
        string,
        { displayName?: string; id: string; revision: string }
      >,
    ).find((entry) => entry.displayName === longName) as { id: string; revision: string };
    expect(item).toBeTruthy();
    const other = await browser.newContext({ storageState: "e2e/.auth/gm.json" });
    const second = await other.newPage();
    await second.goto(`/campaigns/${b2CampaignId}?tab=items&itemId=${item.id}`);
    await expect(second.getByRole("heading", { name: "Edit item", exact: true })).toBeVisible();
    await page
      .locator("article")
      .filter({ hasText: longName })
      .getByRole("button", { name: "Edit item", exact: true })
      .click();
    await page.getByLabel("Description (optional)").fill("First session saved");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Item changes saved.");
    await second.getByLabel("Description (optional)").fill("Second session draft");
    await second.getByRole("button", { name: "Save changes" }).click();
    await expect(second.getByRole("alert").filter({ hasText: "changed" })).toBeVisible();
    await expect(second.getByLabel("Description (optional)")).toHaveValue("Second session draft");
    await second.getByRole("button", { name: "Load latest Item for comparison" }).click();
    await expect(second.getByText(/First session saved/)).toBeVisible();
    await second.getByRole("button", { name: "Replace draft with latest Item" }).click();
    await expect(second.getByLabel("Description (optional)")).toHaveValue("First session saved");
    await second.locator("summary").filter({ hasText: "Equipment inputs" }).click();
    await second.getByRole("button", { name: "Revert Base ENC to Template" }).click();
    await second.getByRole("button", { name: "Save changes" }).click();
    await expect(second.getByRole("status")).toHaveText("Item changes saved.");
    const reverted = await (await page.request.get(endpoint)).json();
    expect(reverted.state.itemsById[item.id].mechanicalOverrides).toEqual([]);
    await other.close();
    await page.screenshot({ path: "test-results/item-lifecycle-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByLabel("Find Items")).toHaveValue(prefix);
    await page.getByLabel("Find Items").fill(longName);
    await expect(page.locator("article")).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.getByLabel("Find Items").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Item category")).toBeFocused();
    await page.screenshot({ path: "test-results/item-lifecycle-390.png", fullPage: true });
    await page.goto(`/characters/${characterId}/equipment`);
    await page.getByRole("link", { name: /^Create Campaign Item for/ }).click();
    await expect(page.getByLabel("Initial assignment")).toHaveValue(characterId);
    await page.getByRole("combobox", { name: "Template", exact: true }).selectOption("");
    await page.getByLabel("Item name", { exact: false }).fill(`${prefix} Character-context letter`);
    await page.getByRole("button", { name: "Create item", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Item created.");
    await page.getByRole("link", { name: "Return to Character inventory" }).click();
    await expect(page.locator(`input[value="${prefix} Character-context letter"]`)).toBeVisible();
  });
});
