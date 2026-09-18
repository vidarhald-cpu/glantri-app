import { expect, test, type Page } from "@playwright/test";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const PASSWORD = "Disposable-Chargen-230";

async function register(page: Page, email: string, displayName: string) {
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: { displayName, email, password: PASSWORD },
  });

  expect(response.status()).toBe(200);
  return (await response.json()).user as { id: string };
}

async function logout(page: Page) {
  const response = await page.request.post(`${API_URL}/auth/logout`);
  expect(response.status()).toBe(200);
}

async function login(page: Page, email: string) {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password: PASSWORD },
  });

  expect(response.status()).toBe(200);
}

async function chargenDraftOwners(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("glantri-app");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction("chargenSessions", "readonly");
          const request = transaction.objectStore("chargenSessions").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            resolve(
              (request.result as Array<{ ownerId?: string }>)
                .map(({ ownerId }) => ownerId)
                .filter((ownerId): ownerId is string => Boolean(ownerId))
                .sort(),
            );
            database.close();
          };
        };
      }),
  );
}

async function completeAndFinalizeCharacter(page: Page) {
  await page.locator('input[name="profile"]').first().click();
  await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeVisible();
  await page.locator('input[name="civilization"]:enabled').first().click();
  await page.locator('input[name="profession"]:enabled').first().click();

  const otherSkills = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Other skills/i }) })
    .last();
  await otherSkills.getByRole("button", { name: "Expand", exact: true }).click();
  const spoken = fullSkillCatalogueProposal.entries.find(
    ({ competencyType }) => competencyType === "spoken-language",
  )!;
  const written = fullSkillCatalogueProposal.entries.find(
    ({ competencyType }) => competencyType === "written-tradition",
  )!;

  for (const skillName of ["Surgery", spoken.name, written.name]) {
    await page.getByRole("button", { name: `Add ${skillName}`, exact: true }).click();
  }

  for (let rank = 0; rank < 6; rank++) {
    await page.getByRole("button", { name: "Add 1-h edged", exact: true }).click();
  }

  await page.getByLabel("Show all blocked rows").check();
  await page.getByLabel("Search specializations").fill("Fencing");
  await page.getByRole("button", { name: "Add Fencing", exact: true }).click();
  await page.getByLabel("Character name", { exact: true }).fill("Account A finalized");

  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      /\/characters\/?$/.test(new URL(candidate.url()).pathname),
  );
  await page.getByRole("button", { name: "Finalize character", exact: true }).click();

  const saved = await response;
  expect(saved.status()).toBe(200);
  return (await saved.json()).character as { id: string };
}

test("Chargen drafts stay account-scoped on one browser origin", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const accountAEmail = `chargen-230-a-${suffix}@example.test`;
  const accountBEmail = `chargen-230-b-${suffix}@example.test`;
  const accountA = await register(page, accountAEmail, "Chargen account A");

  await page.goto("/chargen");
  await page.getByRole("button", { name: "Roll all dice", exact: true }).click();
  await page.getByLabel("Character name", { exact: true }).fill("Account A draft");
  await expect.poll(() => chargenDraftOwners(page)).toEqual([accountA.id]);

  await logout(page);
  const accountB = await register(page, accountBEmail, "Chargen account B");
  await page.goto("/chargen");
  await expect(page.getByRole("button", { name: "Roll all dice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toHaveCount(0);
  await page.getByRole("button", { name: "Roll all dice", exact: true }).click();
  await page.getByLabel("Character name", { exact: true }).fill("Account B draft");
  await expect.poll(() => chargenDraftOwners(page)).toEqual([accountA.id, accountB.id].sort());

  await logout(page);
  await login(page, accountAEmail);
  await page.goto("/chargen");
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toBeVisible();
  await expect(page.getByText("1. Stats")).toHaveCount(0);
  await page.getByRole("button", { name: "Resume saved Character" }).click();
  await expect(page.getByLabel("Character name", { exact: true })).toHaveValue("Account A draft");

  await logout(page);
  await login(page, accountBEmail);
  await page.goto("/chargen");
  await page.getByRole("button", { name: "Create new Character" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "will replace" })).toBeVisible();
  await page.getByRole("button", { name: "Keep saved draft" }).click();
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toBeVisible();
  await page.getByRole("button", { name: "Resume saved Character" }).click();
  await expect(page.getByLabel("Character name", { exact: true })).toHaveValue("Account B draft");

  await logout(page);
  await login(page, accountAEmail);
  await page.goto("/chargen");
  await page.getByRole("button", { name: "Resume saved Character" }).click();
  const finalizedCharacter = await completeAndFinalizeCharacter(page);
  await expect(page).toHaveURL(new RegExp(`/characters/${finalizedCharacter.id}$`));
  await expect.poll(() => chargenDraftOwners(page)).toEqual([accountB.id]);

  await page.goto("/chargen");
  await expect(page.getByRole("button", { name: "Roll all dice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toHaveCount(0);
  await expect.poll(() => chargenDraftOwners(page)).toEqual([accountB.id]);

  await logout(page);
  await login(page, accountBEmail);
  await page.goto("/chargen");
  await page.getByRole("button", { name: "Resume saved Character" }).click();
  await expect(page.getByLabel("Character name", { exact: true })).toHaveValue("Account B draft");
});
