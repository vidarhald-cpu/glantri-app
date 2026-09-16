import { expect, test } from "@playwright/test";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";

// One bounded new Slice2 journey; do not retry the known profile prerequisite failure.
test("target competencies through existing Chargen and authoritative persistence", async ({
  page,
}, testInfo) => {
  const api = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
  const name = `Slice2 target ${Date.now()}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `slice2-${Date.now()}@example.test`,
      displayName: "Slice2 browser player",
      password: "Disposable-Slice2-test-168",
    },
  });
  expect(registration.status()).toBe(200);
  await page.goto("/chargen");
  await page.getByRole("button", { name: "Roll all dice", exact: true }).click();
  await page.locator('input[name="profile"]').first().click();
  try {
    await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeVisible({
      timeout: 10000,
    });
  } catch (error) {
    await page.screenshot({
      path: testInfo.outputPath("profile-prerequisite-stop.png"),
      fullPage: true,
    });
    throw new Error(
      `STOP: new Slice2 journey blocked at profile-selection prerequisite. No retry or diagnostics authorized. ${String(error)}`,
    );
  }
  await page.locator('input[name="civilization"]:enabled').first().click();
  await page.locator('input[name="profession"]:enabled').first().click();
  const other = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Other skills/i }) })
    .last();
  await other.getByRole("button", { name: "Expand", exact: true }).click();
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
  await page.getByLabel("Search specializations").fill("Falconry");
  await expect(page.getByText(/Animal Training/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Falconry", exact: true })).toBeDisabled();
  await page.getByLabel("Search specializations").fill("Fencing");
  await page.getByRole("button", { name: "Add Fencing", exact: true }).click();
  await page.getByLabel("Character name", { exact: true }).fill(name);
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/characters\/?$/.test(new URL(r.url()).pathname),
  );
  await page.getByRole("button", { name: "Finalize character", exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(200);
  const character = (await saved.json()).character;
  const skills = character.build.progression.skills;
  for (const id of ["skill:surgery", spoken.id, written.id]) {
    expect(skills.find((row: { skillId: string }) => row.skillId === id)?.targetDefinition.id).toBe(
      id,
    );
  }
  expect(
    character.build.progression.specializations.find(
      (row: { specializationId: string }) => row.specializationId === "fencing",
    )?.secondaryRanks,
  ).toBe(1);
  const read = await page.request.get(`${api}/characters/${character.id}`);
  expect((await read.json()).character.build).toEqual(character.build);
  await page.goto(`/characters/${character.id}`);
  await expect(page.getByText("Surgery", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Surgery", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("target-character-reloaded.png"),
    fullPage: true,
  });
});
