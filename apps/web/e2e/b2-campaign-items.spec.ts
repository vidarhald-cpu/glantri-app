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

test.describe("B2 campaign item authoring and reveal", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("creates unassigned and assigned items, reveals a trait, and preserves player self-service", async ({
    browser,
    page,
  }) => {
    const { b2CampaignId, characterId } = loadTestState();
    const itemName = `B2 Silverston sword ${b2CampaignId}`;
    const assignmentItemName = `B2 assignment dagger ${b2CampaignId}`;
    const hiddenTrait = `B2 hidden Silverston engraving ${b2CampaignId}`;
    await page.goto(`/campaigns/${b2CampaignId}?tab=items`);
    await expect(page.getByRole("heading", { name: "Campaign items" })).toBeVisible();

    await page.getByRole("button", { name: "Create item" }).click();
    await page.getByLabel("Template").selectOption("weapon-template-dagger");
    await page.getByLabel("Item name (optional)").fill(assignmentItemName);
    await page.getByRole("button", { name: "Create item" }).click();
    await expect(page.getByRole("status")).toHaveText("Item created.");
    await expect(page.getByText("Unassigned / in campaign", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Unassigned / in campaign", { exact: true })).toBeVisible();

    const beforeAssignmentPayload = await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json();
    const assignmentItem = Object.values(beforeAssignmentPayload.state.itemsById).find(
      (item) => (item as { displayName?: string }).displayName === assignmentItemName,
    ) as { id: string } | undefined;
    expect(assignmentItem?.id).toBeTruthy();

    await page.setViewportSize({ height: 844, width: 390 });
    let assignmentCard = page.locator("article").filter({ hasText: assignmentItemName });
    await assignmentCard.getByRole("button", { name: "Assign item" }).click();
    await expect(page.getByRole("heading", { name: `Assign ${assignmentItemName}` })).toBeVisible();
    await page.getByLabel("Receiving Character").selectOption(characterId);
    await page.getByRole("button", { name: "Assign item" }).click();
    await expect(page.getByRole("status")).toContainText(`${assignmentItemName} assigned`);
    assignmentCard = page.locator("article").filter({ hasText: assignmentItemName });
    await expect(assignmentCard.getByText("Held by Smoke Character")).toBeVisible();
    const assignedPayload = await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json();
    expect(assignedPayload.state.itemsById[assignmentItem!.id]).toMatchObject({
      holderCharacterId: characterId,
      id: assignmentItem!.id,
    });

    await assignmentCard.getByRole("button", { name: "Return to campaign" }).click();
    await page.getByRole("button", { name: "Return to campaign" }).click();
    await expect(page.getByRole("status")).toContainText(`${assignmentItemName} returned`);
    await page.reload();
    assignmentCard = page.locator("article").filter({ hasText: assignmentItemName });
    await expect(
      assignmentCard.getByText("Unassigned / in campaign", { exact: true }),
    ).toBeVisible();
    const unassignedPayload = await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json();
    expect(unassignedPayload.state.itemsById[assignmentItem!.id]).toMatchObject({
      holderCharacterId: null,
      id: assignmentItem!.id,
    });
    await page.setViewportSize({ height: 900, width: 1280 });

    await page.getByRole("button", { name: "Create item" }).click();
    await page.getByLabel("Template").selectOption("weapon-template-rapier");
    await page.getByLabel("Item name (optional)").fill(itemName);
    await page.getByLabel("Description (optional)").fill("A balanced sword prepared by the GM.");
    await page.getByLabel("Initial assignment").selectOption(characterId);
    await page.getByLabel("Use a different initiative").check();
    await page.getByLabel("Actual initiative").fill("1");
    await page.getByLabel("Add final attack OB contribution").check();
    await page.getByLabel("Final attack OB", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Add descriptive trait" }).click();
    await expect(page.getByRole("combobox", { name: "Trait 1 category" })).toBeVisible();
    await page.getByLabel("Trait 1", { exact: true }).fill(hiddenTrait);
    await page.getByRole("button", { name: "Add recorded capability" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Guiding light");
    await page.getByLabel("Rules text").fill("The sword can cast a guiding light.");
    await page.getByLabel("Usage (optional)").fill("Once per day");
    await page.getByRole("button", { name: "Create item" }).click();

    await expect(page.getByText(itemName, { exact: true })).toBeVisible();
    await expect(page.getByText("Initiative 1 (standard 2)")).toBeVisible();
    await expect(
      page.getByText("Recorded capabilities — not calculated or tracked by the app"),
    ).toBeVisible();

    const gmPayload = await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json();
    const authoredItem = Object.values(gmPayload.state.itemsById).find(
      (item) => (item as { displayName?: string }).displayName === itemName,
    ) as { id: string } | undefined;
    expect(authoredItem?.id).toBeTruthy();

    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/campaigns/${b2CampaignId}`);
    await expect(playerPage.getByRole("link", { name: "Items", exact: true })).toHaveCount(0);

    const nonHolderContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const nonHolderAuthoring = await nonHolderContext.request.get(
      `${API_URL}/campaigns/${b2CampaignId}/items`,
    );
    expect(nonHolderAuthoring.status()).toBe(403);
    expect(await nonHolderAuthoring.text()).not.toContain(hiddenTrait);
    const nonHolderEquipment = await nonHolderContext.request.get(
      `${API_URL}/characters/${characterId}/equipment`,
    );
    expect(nonHolderEquipment.status()).toBe(404);
    expect(await nonHolderEquipment.text()).not.toContain(hiddenTrait);

    const unrelatedContext = await browser.newContext({
      storageState: "e2e/.auth/unrelated.json",
    });
    const unrelatedEquipment = await unrelatedContext.request.get(
      `${API_URL}/characters/${characterId}/equipment`,
    );
    expect(unrelatedEquipment.status()).toBe(404);
    expect(await unrelatedEquipment.text()).not.toContain(hiddenTrait);

    const deniedLegacyWrites = [
      { expectedStatus: 400, label: "holder", request: playerContext.request },
      { expectedStatus: 404, label: "non-holder", request: nonHolderContext.request },
      { expectedStatus: 404, label: "unrelated", request: unrelatedContext.request },
    ];
    for (const perspective of deniedLegacyWrites) {
      const metadataResponse = await perspective.request.post(
        `${API_URL}/characters/${characterId}/equipment/items/metadata`,
        {
          data: {
            conditionState: "damaged",
            displayName: `Unauthorized ${perspective.label} rewrite`,
            isFavorite: true,
            itemId: authoredItem!.id,
            notes: `Unauthorized ${perspective.label} notes`,
          },
        },
      );
      expect(metadataResponse.status(), `${perspective.label} metadata write`).toBe(
        perspective.expectedStatus,
      );
      expect(await metadataResponse.text()).not.toContain(hiddenTrait);

      const removeResponse = await perspective.request.post(
        `${API_URL}/characters/${characterId}/equipment/items/remove`,
        { data: { itemId: authoredItem!.id } },
      );
      expect(removeResponse.status(), `${perspective.label} deletion`).toBe(
        perspective.expectedStatus,
      );
      expect(await removeResponse.text()).not.toContain(hiddenTrait);
    }

    const unchangedGmPayload = await (
      await page.request.get(`${API_URL}/campaigns/${b2CampaignId}/items`)
    ).json();
    expect(unchangedGmPayload.state.itemsById[authoredItem!.id]).toMatchObject({
      conditionState: "intact",
      displayName: itemName,
      notes: "A balanced sword prepared by the GM.",
    });

    await seedOwnedCharacterMirror(playerPage, characterId);
    const beforePayloadPromise = playerPage.waitForResponse(
      (response) =>
        response.url().startsWith(API_URL) &&
        response.url().endsWith(`/characters/${characterId}/equipment`) &&
        response.request().method() === "GET",
    );
    await playerPage.goto(`/characters/${characterId}/equipment`);
    const beforePayload = await (await beforePayloadPromise).text();
    expect(beforePayload).not.toContain(hiddenTrait);
    expect(beforePayload).not.toContain("gm_only");
    await expect(playerPage.locator(`input[value="${itemName}"]`)).toBeVisible();
    await expect(playerPage.getByText(hiddenTrait)).toHaveCount(0);
    const campaignItemRow = playerPage
      .locator("tr")
      .filter({ has: playerPage.locator(`input[value="${itemName}"]`) });
    await expect(campaignItemRow.getByRole("button", { name: "Edit" })).toBeDisabled();
    await expect(campaignItemRow.getByRole("button", { name: "Remove item" })).toBeDisabled();
    await expect(campaignItemRow.getByText("Item details are managed by the GM")).toBeVisible();

    const itemCard = page.locator("article").filter({ hasText: itemName });
    await itemCard.getByRole("button", { name: "Edit item" }).click();
    await page.getByLabel("Trait 1 visibility").selectOption("revealed");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Item changes saved.");

    const afterPayloadPromise = playerPage.waitForResponse(
      (response) =>
        response.url().startsWith(API_URL) &&
        response.url().endsWith(`/characters/${characterId}/equipment`) &&
        response.request().method() === "GET",
    );
    await playerPage.reload();
    const afterPayload = await (await afterPayloadPromise).text();
    expect(afterPayload).toContain(hiddenTrait);
    await expect(playerPage.getByText(hiddenTrait)).toBeVisible();

    await playerPage.getByLabel("Template").selectOption("weapon-template-dagger");
    await playerPage.getByLabel("Initial location").selectOption({ label: "With you: Equipped" });
    await playerPage.getByLabel("Display name").fill("B2 player standard dagger");
    await playerPage.getByRole("button", { name: "Add item" }).click();
    await expect(playerPage.locator('input[value="B2 player standard dagger"]')).toBeVisible();

    const playerEquipmentPayload = await (
      await playerPage.request.get(`${API_URL}/characters/${characterId}/equipment`)
    ).json();
    expect(Object.values(playerEquipmentPayload.state.itemsById)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: authoredItem!.id }),
        expect.objectContaining({ displayName: "B2 player standard dagger", isEquipped: true }),
      ]),
    );

    await playerContext.close();
    await nonHolderContext.close();
    await unrelatedContext.close();
  });
});
