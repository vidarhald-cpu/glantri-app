import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

function loadTestState(): {
  b2CampaignId: string;
  characterId: string;
  nonHolderCharacterId: string;
} {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "test-state.json"), "utf-8")) as {
    b2CampaignId: string;
    characterId: string;
    nonHolderCharacterId: string;
  };
}

async function seedOwnedCharacterMirror(page: Page, characterId: string): Promise<void> {
  const response = await page.request.get(`${API_URL}/characters`);
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    characters: Array<{
      build: { name: string };
      createdAt: string;
      id: string;
      ownerId: string | null;
      updatedAt: string;
    }>;
  };
  const character = payload.characters.find((candidate) => candidate.id === characterId);
  expect(character).toBeTruthy();

  await page.goto("/characters");
  await expect(page.getByText(character!.build.name, { exact: true })).toBeVisible();
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

test.describe("B3 canonical item transfer", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("moves the same item between roster Characters and recalculates every perspective", async ({
    browser,
    page,
  }) => {
    const { b2CampaignId, characterId, nonHolderCharacterId } = loadTestState();
    const itemName = `B3 Silverston ${b2CampaignId}`;
    const hiddenTrait = `B3 hidden lineage ${b2CampaignId}`;
    const revealedTrait = `B3 revealed maker mark ${b2CampaignId}`;

    await page.request.get(`${API_URL}/characters/${characterId}/equipment`);
    await page.request.get(`${API_URL}/characters/${nonHolderCharacterId}/equipment`);
    await page.goto(`/campaigns/${b2CampaignId}?tab=items`);
    await page.getByRole("button", { name: "Create item" }).click();
    await page.getByLabel("Template").selectOption("weapon-template-rapier");
    await page.getByLabel("Item name (optional)").fill(itemName);
    await page.getByLabel("Description (optional)").fill("The same storied blade changes hands.");
    await page.getByLabel("Initial assignment").selectOption(characterId);
    await page.getByRole("button", { name: "Add descriptive trait" }).click();
    await page.getByLabel("Trait 1", { exact: true }).fill(hiddenTrait);
    await page.getByRole("button", { name: "Add descriptive trait" }).click();
    await page.getByLabel("Trait 2", { exact: true }).fill(revealedTrait);
    await page.getByLabel("Trait 2 visibility").selectOption("revealed");
    await page.getByRole("button", { name: "Create item" }).click();
    await expect(page.getByRole("status")).toHaveText("Item created.");

    const gmBefore = (await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json()) as {
      state: { itemsById: Record<string, Record<string, unknown>> };
    };
    const itemBefore = Object.values(gmBefore.state.itemsById).find(
      (item) => item.displayName === itemName,
    );
    expect(itemBefore).toBeTruthy();
    const itemId = itemBefore!.id as string;

    const sourceContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const sourcePage = await sourceContext.newPage();
    await seedOwnedCharacterMirror(sourcePage, characterId);
    await sourcePage.goto(`/characters/${characterId}/equipment`);
    await expect(sourcePage.locator(`input[value="${itemName}"]`)).toBeVisible();
    await expect(sourcePage.getByText(revealedTrait)).toBeVisible();
    await expect(sourcePage.getByText(hiddenTrait)).toHaveCount(0);

    const equipResponse = await sourceContext.request.post(
      `${API_URL}/characters/${characterId}/equipment/loadout/active-primary-weapon`,
      { data: { itemId } },
    );
    expect(equipResponse.ok()).toBe(true);
    const equippedState = (await equipResponse.json()) as {
      state: {
        activeLoadoutByCharacterId: Record<string, { activePrimaryWeaponItemId: string | null }>;
        itemsById: Record<string, { isEquipped: boolean }>;
      };
    };
    expect(equippedState.state.activeLoadoutByCharacterId[characterId]).toMatchObject({
      activePrimaryWeaponItemId: itemId,
    });
    expect(equippedState.state.itemsById[itemId]?.isEquipped).toBe(true);

    const targetContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const targetBefore = await targetContext.request.get(
      `${API_URL}/characters/${nonHolderCharacterId}/equipment`,
    );
    expect(targetBefore.ok()).toBe(true);
    expect(await targetBefore.text()).not.toContain(itemId);

    const unrelatedContext = await browser.newContext({
      storageState: "e2e/.auth/unrelated.json",
    });
    const unrelatedBefore = await unrelatedContext.request.get(
      `${API_URL}/characters/${characterId}/equipment`,
    );
    expect(unrelatedBefore.status()).toBe(404);
    expect(await unrelatedBefore.text()).not.toContain(hiddenTrait);

    const itemCard = page.locator("article").filter({ hasText: itemName });
    await itemCard.getByRole("button", { name: "Transfer item" }).click();
    await expect(page.getByRole("heading", { name: `Transfer ${itemName}` })).toBeFocused();
    await page.getByLabel("Receiving Character").selectOption(nonHolderCharacterId);
    await expect(
      page.getByText(
        `Transfer ${itemName} from Smoke Character to Smoke Non-holder Character. It will be On person and will not be equipped.`,
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Transfer item" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `${itemName} transferred from Smoke Character to Smoke Non-holder Character. It is On person and not equipped.`,
    );

    const gmAfter = (await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json()) as {
      state: { itemsById: Record<string, Record<string, unknown>> };
    };
    const matchingItems = Object.values(gmAfter.state.itemsById).filter(
      (item) => item.id === itemId,
    );
    expect(matchingItems).toHaveLength(1);
    expect(matchingItems[0]).toMatchObject({
      campaignContextId: b2CampaignId,
      displayName: itemName,
      holderCharacterId: nonHolderCharacterId,
      id: itemId,
      isEquipped: false,
      itemFacts: itemBefore!.itemFacts,
      notes: itemBefore!.notes,
      templateId: itemBefore!.templateId,
    });

    const sourceAfter = (await (
      await sourceContext.request.get(`${API_URL}/characters/${characterId}/equipment`)
    ).json()) as {
      state: {
        activeLoadoutByCharacterId: Record<string, Record<string, unknown>>;
        itemsById: Record<string, unknown>;
      };
    };
    expect(sourceAfter.state.itemsById[itemId]).toBeUndefined();
    expect(JSON.stringify(sourceAfter.state.activeLoadoutByCharacterId)).not.toContain(itemId);
    await sourcePage.reload();
    await expect(sourcePage.locator(`input[value="${itemName}"]`)).toHaveCount(0);

    const targetPage = await targetContext.newPage();
    await seedOwnedCharacterMirror(targetPage, nonHolderCharacterId);
    const targetPayloadPromise = targetPage.waitForResponse(
      (response) =>
        response.url().startsWith(API_URL) &&
        response.url().endsWith(`/characters/${nonHolderCharacterId}/equipment`) &&
        response.request().method() === "GET",
    );
    await targetPage.goto(`/characters/${nonHolderCharacterId}/equipment`);
    const targetPayloadText = await (await targetPayloadPromise).text();
    expect(targetPayloadText).toContain(itemId);
    expect(targetPayloadText).toContain(revealedTrait);
    expect(targetPayloadText).not.toContain(hiddenTrait);
    const targetPayload = JSON.parse(targetPayloadText) as {
      state: {
        activeLoadoutByCharacterId: Record<string, Record<string, unknown>>;
        itemsById: Record<
          string,
          { holderCharacterId: string; isEquipped: boolean; storageAssignment: unknown }
        >;
      };
    };
    expect(targetPayload.state.itemsById[itemId]).toMatchObject({
      holderCharacterId: nonHolderCharacterId,
      isEquipped: false,
      storageAssignment: {
        carryMode: "on_person",
        locationId: `${nonHolderCharacterId}:loc-person`,
      },
    });
    expect(JSON.stringify(targetPayload.state.activeLoadoutByCharacterId)).not.toContain(itemId);
    await expect(targetPage.locator(`input[value="${itemName}"]`)).toBeVisible();
    await expect(targetPage.getByText(revealedTrait)).toBeVisible();
    await expect(targetPage.getByText(hiddenTrait)).toHaveCount(0);

    const stale = await page.request.post(
      `${API_URL}/characters/${characterId}/equipment/items/${itemId}/transfer`,
      { data: { campaignId: b2CampaignId, targetCharacterId: nonHolderCharacterId } },
    );
    expect(stale.status()).toBe(409);
    expect(await stale.text()).toContain("already moved");
    const afterStale = (await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json()) as { state: { itemsById: Record<string, { holderCharacterId: string }> } };
    expect(afterStale.state.itemsById[itemId]?.holderCharacterId).toBe(nonHolderCharacterId);

    await page.reload();
    const reloadedCard = page.locator("article").filter({ hasText: itemName });
    await expect(reloadedCard.getByText("Held by Smoke Non-holder Character")).toBeVisible();
    await expect(reloadedCard.getByText(hiddenTrait)).toBeVisible();
    const unrelatedAfter = await unrelatedContext.request.get(
      `${API_URL}/characters/${nonHolderCharacterId}/equipment`,
    );
    expect(unrelatedAfter.status()).toBe(404);
    expect(await unrelatedAfter.text()).not.toContain(hiddenTrait);

    await sourceContext.close();
    await targetContext.close();
    await unrelatedContext.close();
  });
});
