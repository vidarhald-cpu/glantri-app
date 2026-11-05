import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { API_URL, BROWSER_API_URL } from "./targets";

interface CanonicalCharacter {
  build: {
    name: string;
    progressionState?: {
      availablePoints?: number;
    };
  };
  id: string;
}

function loadCharacterId(): string {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, "test-state.json"), "utf-8")) as {
    characterId: string;
  };

  return state.characterId;
}

async function loadCanonicalCharacter(
  page: Page,
  characterId: string,
): Promise<CanonicalCharacter> {
  const response = await page.request.get(`${API_URL}/characters/${characterId}`);
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { character: CanonicalCharacter };
  return payload.character;
}

async function failCharacterUpdates(page: Page, characterId: string): Promise<void> {
  await page.route(`${BROWSER_API_URL}/**`, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (request.method() === "PUT" && requestUrl.pathname === `/characters/${characterId}`) {
      await route.abort("failed");
      return;
    }

    if (API_URL !== BROWSER_API_URL) {
      await route.continue({
        url: `${API_URL}${requestUrl.pathname}${requestUrl.search}`,
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Character Sheet failed-save recovery", () => {
  test.use({ storageState: "e2e/.auth/player.json" });

  test("shows one coherent Rolled/Base, Original, Developed, and Current stat chain", async ({
    page,
  }) => {
    const characterId = loadCharacterId();
    await page.goto(`/characters/${characterId}`);

    const headers = page.getByRole("columnheader");
    await expect(headers).toContainText([
      "Stat",
      "Rolled / base",
      "Original",
      "Developed",
      "Current",
      "GM",
    ]);
    const strengthCells = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "Str", exact: true }) })
      .getByRole("cell");
    await expect(strengthCells.nth(1)).toHaveText("12");
    await expect(strengthCells.nth(2)).toHaveText("13");
    await expect(strengthCells.nth(3)).toHaveText("14");
    await expect(strengthCells.nth(4)).toHaveText("14");
  });

  test("keeps canonical truth visible while a failed identity draft is reviewed or discarded", async ({
    page,
  }) => {
    const characterId = loadCharacterId();
    const canonical = await loadCanonicalCharacter(page, characterId);
    const attemptedName = `${canonical.build.name} offline attempt`;
    await failCharacterUpdates(page, characterId);

    await page.goto(`/characters/${characterId}`);
    const nameInput = page.locator("#character-sheet-name");
    await expect(nameInput).toHaveValue(canonical.build.name);

    await nameInput.fill(attemptedName);
    await page.getByRole("button", { name: "Save identity" }).click();

    await expect(page.getByText("Local draft retained", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `Character Sheet — ${canonical.build.name}` }),
    ).toBeVisible();
    await expect(nameInput).toHaveValue(canonical.build.name);
    await expect(
      page.getByText("The current server Character is visible.", { exact: false }),
    ).toBeVisible();
    await expect((await loadCanonicalCharacter(page, characterId)).build.name).toBe(
      canonical.build.name,
    );

    await page.getByRole("button", { name: "Review retained draft" }).click();
    await expect(nameInput).toHaveValue(attemptedName);
    await expect(
      page.getByRole("heading", { name: `Character Sheet — ${attemptedName}` }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Return to current server version" }).click();
    await expect(nameInput).toHaveValue(canonical.build.name);

    await page.reload();
    await expect(page.getByText("Local draft retained", { exact: true })).toBeVisible();
    await expect(nameInput).toHaveValue(canonical.build.name);

    await page.getByRole("button", { name: "Discard draft and keep server version" }).click();
    await expect(page.getByText("Local draft retained", { exact: true })).toBeHidden();
    await expect(nameInput).toHaveValue(canonical.build.name);

    await page.reload();
    await expect(page.getByText("Local draft retained", { exact: true })).toBeHidden();
    await expect(nameInput).toHaveValue(canonical.build.name);
  });
});

test.describe("GM Character edit failed-save recovery", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("restores canonical progression after failure and retains explicit recovery controls", async ({
    page,
  }) => {
    const characterId = loadCharacterId();
    const canonical = await loadCanonicalCharacter(page, characterId);
    const canonicalPoints = canonical.build.progressionState?.availablePoints ?? 0;
    await failCharacterUpdates(page, characterId);

    await page.goto(`/characters/${characterId}/edit`);
    const canonicalPointsLabel = `Available points: ${canonicalPoints}`;
    const attemptedPointsLabel = `Available points: ${canonicalPoints + 1}`;
    await expect(page.getByText(canonicalPointsLabel, { exact: true })).toBeVisible();

    await page.getByLabel("Points to add").fill("1");
    await page.getByRole("button", { name: "Grant points" }).click();
    await expect(page.getByText(attemptedPointsLabel, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Local draft retained", { exact: true })).toBeVisible();
    await expect(page.getByText(canonicalPointsLabel, { exact: true })).toBeVisible();
    await expect(page.getByText(attemptedPointsLabel, { exact: true })).toBeHidden();

    await page.getByRole("button", { name: "Review retained draft" }).click();
    await expect(page.getByText(attemptedPointsLabel, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Return to current server version" }).click();
    await expect(page.getByText(canonicalPointsLabel, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Local draft retained", { exact: true })).toBeVisible();
    await expect(page.getByText(canonicalPointsLabel, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Discard draft and keep server version" }).click();
    await expect(page.getByText("Local draft retained", { exact: true })).toBeHidden();
    await expect(page.getByText(canonicalPointsLabel, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Local draft retained", { exact: true })).toBeHidden();
    await expect(page.getByText(canonicalPointsLabel, { exact: true })).toBeVisible();
    await expect(
      (await loadCanonicalCharacter(page, characterId)).build.progressionState?.availablePoints ??
        0,
    ).toBe(canonicalPoints);
  });
});
