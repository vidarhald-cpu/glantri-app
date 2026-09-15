import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

function loadTestState(): { b2CampaignId: string; characterId: string } {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "test-state.json"), "utf-8")) as {
    b2CampaignId: string;
    characterId: string;
  };
}

async function seedOwnedCharacterMirror(page: Page, characterId: string): Promise<void> {
  const response = await page.request.get(`${API_URL}/characters`);
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    characters: Array<{
      build: unknown;
      createdAt: string;
      id: string;
      ownerId: string | null;
      updatedAt: string;
    }>;
  };
  const character = payload.characters.find((candidate) => candidate.id === characterId);
  expect(character).toBeTruthy();

  await page.goto("/characters");
  await expect(page.getByText("Smoke Character", { exact: true })).toBeVisible();
  await page.evaluate((serverCharacter) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("glantri-app");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("localCharacters", "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore("localCharacters").put({
          build: serverCharacter.build,
          createdAt: serverCharacter.createdAt,
          creatorId: serverCharacter.ownerId ?? undefined,
          finalizedAt: serverCharacter.createdAt,
          id: serverCharacter.id,
          syncStatus: "synced",
          updatedAt: serverCharacter.updatedAt,
        });
      };
    });
  }, character!);
}

test("creates twenty ammunition through Campaign and personal forms and preserves reload", async ({
  browser,
  page,
}) => {
  const { b2CampaignId, characterId } = loadTestState();
  await page
    .context()
    .addCookies(JSON.parse(fs.readFileSync(path.join(__dirname, ".auth/gm.json"), "utf8")).cookies);
  await page.goto(`/campaigns/${b2CampaignId}?tab=items`);
  await page.getByRole("button", { name: "Create item" }).click();
  await page
    .getByRole("combobox", { name: "Template", exact: true })
    .selectOption("gear-template-arrows");
  await page.getByLabel("Quantity", { exact: true }).fill("20");
  await page.getByLabel("Item name (optional)").fill("Twenty campaign arrows");
  await page.getByRole("button", { name: "Create item" }).click();
  await expect(page.getByRole("status")).toHaveText("Item created.");
  await page.reload();
  const campaignPayload = await (
    await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
  ).json();
  const arrows = Object.values(campaignPayload.state.itemsById).find(
    (item) => (item as { displayName?: string }).displayName === "Twenty campaign arrows",
  );
  expect(arrows).toMatchObject({ quantity: 20 });

  const player = await browser.newContext({ storageState: "e2e/.auth/player.json" });
  const playerPage = await player.newPage();
  await seedOwnedCharacterMirror(playerPage, characterId);
  await playerPage.goto(`/characters/${characterId}/equipment`);
  await playerPage
    .getByRole("combobox", { name: "Template", exact: true })
    .selectOption("gear-template-arrows");
  await playerPage.getByLabel("Quantity", { exact: true }).first().fill("20");
  await playerPage.getByLabel("Display name", { exact: true }).fill("Twenty personal arrows");
  await playerPage.getByRole("button", { name: "Add item" }).click();
  await expect(playerPage.locator('input[value="Twenty personal arrows"]')).toBeVisible();
  await playerPage.reload();
  const personal = await (
    await playerPage.request.get(`${API_URL}/characters/${characterId}/equipment`)
  ).json();
  expect(
    Object.values(personal.state.itemsById).find(
      (item) => (item as { displayName?: string }).displayName === "Twenty personal arrows",
    ),
  ).toMatchObject({ quantity: 20 });
  await player.close();
});
