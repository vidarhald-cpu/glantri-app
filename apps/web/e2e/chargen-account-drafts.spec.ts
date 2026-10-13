import { expect, test, type Page } from "@playwright/test";
import { getApprovedV2RuntimeContent } from "@glantri/content";

import { expandChargenChooser, gotoChargenStep } from "./chargen-step-navigation";

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
  await expandChargenChooser(page, "stats");
  await page.locator('input[name="profile"]').first().click();
  await gotoChargenStep(page, "2. Resolve stats");
  await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeVisible();
  await gotoChargenStep(page, "3. Choose civilization");
  await expandChargenChooser(page, "civilization");
  await page.getByRole("radio", { name: /Scythians/ }).click();
  await gotoChargenStep(page, "5. Choose profession");
  await expandChargenChooser(page, "profession");
  await page.getByRole("radio", { name: /Courier and Messenger/ }).click();
  await gotoChargenStep(page, "6. Skill allocation");
  await expect(
    page.getByRole("heading", { name: "Choose your Profession core route", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Foot courier practice/ }).click();
  const footCourierGroup = page
    .locator("section")
    .filter({ hasText: "Running and athletic field practice" })
    .last();
  await footCourierGroup.getByRole("button", { name: "Add training", exact: true }).click();
  await expect(page.getByText(/Selected core route complete/)).toBeVisible();

  const individualSkills = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "7. Individual skills", exact: true }) })
    .last();
  await individualSkills.getByRole("button", { name: "Expand", exact: true }).click();
  const competencyContent = getApprovedV2RuntimeContent();
  const spoken = competencyContent.skills.find(
    (skill) => "competencyType" in skill && skill.competencyType === "spoken-language",
  )!;
  const written = competencyContent.skills.find(
    (skill) => "competencyType" in skill && skill.competencyType === "written-tradition",
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
  await gotoChargenStep(page, "11. Finalize character");
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
  await gotoChargenStep(page, "11. Finalize character");
  await page.getByLabel("Character name", { exact: true }).fill("Account A draft");
  await expect.poll(() => chargenDraftOwners(page)).toEqual([accountA.id]);

  await logout(page);
  const accountB = await register(page, accountBEmail, "Chargen account B");
  await page.goto("/chargen");
  await expect(page.getByRole("button", { name: "Roll all dice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toHaveCount(0);
  await page.getByRole("button", { name: "Roll all dice", exact: true }).click();
  await gotoChargenStep(page, "11. Finalize character");
  await page.getByLabel("Character name", { exact: true }).fill("Account B draft");
  await expect.poll(() => chargenDraftOwners(page)).toEqual([accountA.id, accountB.id].sort());

  await logout(page);
  await login(page, accountAEmail);
  await page.goto("/chargen");
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toBeVisible();
  await expect(page.getByText("1. Stats")).toHaveCount(0);
  await page.getByRole("button", { name: "Resume saved Character" }).click();
  await gotoChargenStep(page, "11. Finalize character");
  await expect(page.getByLabel("Character name", { exact: true })).toHaveValue("Account A draft");

  await logout(page);
  await login(page, accountBEmail);
  await page.goto("/chargen");
  await page.getByRole("button", { name: "Create new Character" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "will replace" })).toBeVisible();
  await page.getByRole("button", { name: "Keep saved draft" }).click();
  await expect(page.getByRole("button", { name: "Resume saved Character" })).toBeVisible();
  await page.getByRole("button", { name: "Resume saved Character" }).click();
  await gotoChargenStep(page, "11. Finalize character");
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
  await gotoChargenStep(page, "11. Finalize character");
  await expect(page.getByLabel("Character name", { exact: true })).toHaveValue("Account B draft");
});
