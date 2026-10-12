import { expect, test } from "@playwright/test";
import { getApprovedV2RuntimeContent } from "@glantri/content";

import { gotoChargenStep } from "./chargen-step-navigation";

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
  await gotoChargenStep(page, "2. Resolve stats");
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
  await gotoChargenStep(page, "3. Choose civilization");
  await page.getByRole("radio", { name: /Scythians/ }).click();
  await gotoChargenStep(page, "5. Choose profession");
  await page.getByRole("radio", { name: /Courier and Messenger/ }).click();
  await gotoChargenStep(page, "6. Skill allocation");
  await expect(
    page.getByRole("heading", { name: "Choose your Profession core route", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Foot courier practice/ }).click();
  await expect(
    page.getByText("Mounted travel and animal care", { exact: true }).first(),
  ).toBeVisible();
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
  await expect(
    individualSkills.getByRole("button", { name: "Add Brawling", exact: true }),
  ).toBeVisible();
  const competencyContent = getApprovedV2RuntimeContent();
  const spoken = competencyContent.skills.find(
    (skill) => "competencyType" in skill && skill.competencyType === "spoken-language",
  )!;
  const written = competencyContent.skills.find(
    (skill) => "competencyType" in skill && skill.competencyType === "written-tradition",
  )!;
  /* Fencing is a base combat Skill under rule decision 0010 ruling 1, so it is purchased from the
     individual-skill list rather than from the specialization search, and it needs no parent level. */
  for (const skillName of ["Surgery", "Fencing", spoken.name, written.name]) {
    await page.getByRole("button", { name: `Add ${skillName}`, exact: true }).click();
  }
  for (let rank = 0; rank < 6; rank++) {
    await page.getByRole("button", { name: "Add 1-h edged", exact: true }).click();
  }
  /* The parent-skill assertion names the Specializations step explicitly. A page-wide
     `getByText(/Animal Training/).first()` used to be satisfied by whichever step happened to be
     mounted first, which was never the row this journey is about; the Falconry row's own parent
     skill is what has to be on screen. */
  const specializations = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "8. Specializations", exact: true }) })
    .last();
  await page.getByLabel("Show all blocked rows").check();
  await page.getByLabel("Search specializations").fill("Falconry");
  await expect(specializations.getByText(/Animal Training/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Falconry", exact: true })).toBeDisabled();
  /* Fencing is no longer offered as a Specialization: searching the Specializations step for it
     returns no rows at all, while the Skill itself was purchased above from the individual-skill
     list. */
  await page.getByLabel("Search specializations").fill("Fencing");
  await expect(specializations.getByText(/Showing 0 of/)).toBeVisible();
  await expect(
    specializations.getByRole("button", { name: "Add Fencing", exact: true }),
  ).toHaveCount(0);
  await gotoChargenStep(page, "11. Finalize character");
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
  /* Fencing is saved as an ordinary Skill row, and no Specialization row is created for it. */
  expect(skills.find((row: { skillId: string }) => row.skillId === "fencing")).toBeDefined();
  expect(
    character.build.progression.specializations.some(
      (row: { specializationId: string }) => row.specializationId === "fencing",
    ),
  ).toBe(false);
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
