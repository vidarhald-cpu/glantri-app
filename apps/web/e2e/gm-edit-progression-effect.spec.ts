import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Page,
} from "@playwright/test";
import { defaultCanonicalContent } from "@glantri/content";
import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";
import { buildCharacterSheetSummary, buildCombatStateCharacterInputs } from "@glantri/rules-engine";

import { expandChargenChooser, gotoChargenStep } from "./chargen-step-navigation";
import { API_URL } from "./targets";

/**
 * Forgejo #1068, work order WO-1068-S1 — GM editing and Progression must change the Character
 * that is actually played, not only the screen they are typed into.
 *
 * Every test starts from a Character built through today's Chargen in a real browser, because
 * the defect only exists for Characters whose build carries the target catalogue. Each value
 * the GM or the Progression cycle changes is then read back three ways: the stored server record
 * (`GET /characters/:id`), the rendered Character Sheet, and the combat inputs the live server
 * combat resolvers derive from a Scenario participant snapshot after the GM refreshes it
 * (`buildCombatStateCharacterInputs(buildCharacterSheetSummary(snapshot.build))`, the same call
 * `combatParticipantCalculationResolution.ts` makes).
 */

const EVIDENCE_DIR = process.env.GLANTRI_1068_EVIDENCE_DIR;

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
  return response.json() as Promise<T>;
}

async function capture(page: Page, name: string) {
  if (!EVIDENCE_DIR) return;
  await page.screenshot({ fullPage: true, path: `${EVIDENCE_DIR}/${name}.png` });
}

interface ServerCharacter {
  build: CharacterBuild;
  id: string;
  updatedAt: string;
}

/** A fresh player builds a Character through today's Chargen and finalizes it. */
async function createChargenCharacter(input: {
  browser: Browser;
  label: string;
}): Promise<{ character: ServerCharacter; playerPage: Page; playerUserId: string }> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const context = await input.browser.newContext();
  const page = await context.newPage();
  const registration = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      displayName: `1068 ${input.label} player`,
      email: `issue1068-${input.label}-${suffix}@example.test`,
      password: "Disposable-1068-test-pass",
    },
  });
  expect(registration.status()).toBe(200);
  const me = await json<{ user: { id: string } }>(await page.request.get(`${API_URL}/auth/me`));

  await page.goto("/chargen");
  await page.getByRole("button", { name: "Roll all dice", exact: true }).click();
  await expect(page.locator('input[name="profile"]').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[name="profile"]').first().click();
  await gotoChargenStep(page, "2. Resolve stats");
  await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await gotoChargenStep(page, "3. Choose civilization");
  await expandChargenChooser(page, "civilization");
  await page.getByRole("radio", { name: /Scythians/ }).click();
  await gotoChargenStep(page, "5. Choose profession");
  await expandChargenChooser(page, "profession");
  await page.getByRole("radio", { name: /Courier and Messenger/ }).click();
  await gotoChargenStep(page, "6. Skill allocation");
  await page.getByRole("radio", { name: /Foot courier practice/ }).click();
  await page
    .locator("section")
    .filter({ hasText: "Running and athletic field practice" })
    .last()
    .getByRole("button", { name: "Add training", exact: true })
    .click();
  await expect(page.getByText(/Selected core route complete/)).toBeVisible();
  const individualSkills = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "7. Individual skills", exact: true }) })
    .last();
  await individualSkills.getByRole("button", { name: "Expand", exact: true }).click();
  for (const skillName of ["Brawling", "Fencing", "Dodge", "Combat Experience"]) {
    await page.getByRole("button", { name: `Add ${skillName}`, exact: true }).click();
  }
  // Surgery to 6 so the Chargen-legal Battlefield Surgery specialization (parent level 6) can be
  // bought, giving the GM a specialization row to edit.
  for (let rank = 0; rank < 6; rank++) {
    await page.getByRole("button", { name: "Add Surgery", exact: true }).click();
  }
  for (let rank = 0; rank < 4; rank++) {
    await page.getByRole("button", { name: "Add 1-h edged", exact: true }).click();
  }
  await page.getByLabel("Search specializations").fill("Battlefield");
  await page.getByRole("button", { name: "Add Battlefield Surgery", exact: true }).click();
  await gotoChargenStep(page, "11. Finalize character");
  await page.getByLabel("Character name", { exact: true }).fill(`1068 ${input.label} ${suffix}`);
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/characters\/?$/.test(new URL(r.url()).pathname),
  );
  await page.getByRole("button", { name: "Finalize character", exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(200);
  const character = (await saved.json()).character as ServerCharacter;
  expect(character.build.targetChargen).toBeDefined();
  return { character, playerPage: page, playerUserId: me.user.id };
}

/** The GM rosters the Character in a new campaign and admits it to a live Scenario. */
async function admitToScenario(input: {
  characterId: string;
  gm: APIRequestContext;
  playerUserId: string;
}) {
  const suffix = Date.now();
  const campaign = await json<{ campaign: { id: string } }>(
    await input.gm.post(`${API_URL}/campaigns`, {
      data: { name: `Issue 1068 ${suffix}`, status: "active" },
    }),
  );
  await json(
    await input.gm.post(`${API_URL}/campaigns/${campaign.campaign.id}/roster`, {
      data: { category: "pc", sourceId: input.characterId, sourceType: "character" },
    }),
  );
  const scenario = await json<{ scenario: { id: string } }>(
    await input.gm.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
      data: { name: `Issue 1068 Scenario ${suffix}`, status: "live" },
    }),
  );
  const participant = await json<{ participant: { id: string } }>(
    await input.gm.post(`${API_URL}/scenarios/${scenario.scenario.id}/participants/character`, {
      data: { characterId: input.characterId, controlledByUserId: input.playerUserId },
    }),
  );
  return { participantId: participant.participant.id, scenarioId: scenario.scenario.id };
}

async function getCharacter(request: APIRequestContext, id: string): Promise<ServerCharacter> {
  return (
    await json<{ character: ServerCharacter }>(await request.get(`${API_URL}/characters/${id}`))
  ).character;
}

/** The combat inputs the live server combat resolvers derive from a participant snapshot. */
async function refreshedParticipantCombatInputs(input: {
  gm: APIRequestContext;
  participantId: string;
  scenarioId: string;
}) {
  await json(
    await input.gm.post(
      `${API_URL}/scenarios/${input.scenarioId}/participants/${input.participantId}/refresh-character-equipment`,
      { data: {} },
    ),
  );
  const participants = await json<{
    participants: Array<{ id: string; snapshot: { build: unknown } }>;
  }>(await input.gm.get(`${API_URL}/scenarios/${input.scenarioId}/participants`));
  const participant = participants.participants.find((p) => p.id === input.participantId);
  const build = characterBuildSchema.parse(participant?.snapshot.build);
  const sheet = buildCharacterSheetSummary({ build, content: defaultCanonicalContent });
  return { build, inputs: buildCombatStateCharacterInputs(sheet), sheet };
}

function summarize(build: CharacterBuild) {
  return buildCharacterSheetSummary({ build, content: defaultCanonicalContent });
}

/** Reads the rendered Character Sheet skill rows: name -> rendered cells. */
async function readSheetSkillRows(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find(
      (h) => h.textContent?.trim() === "Skills",
    );
    const section = heading?.parentElement;
    const rows: Record<string, string[]> = {};
    for (const row of section?.querySelectorAll("section > div") ?? []) {
      const cells = [...row.children].map((cell) => (cell.textContent ?? "").trim());
      if (cells.length === 8) {
        const name = (row.children[0]?.firstElementChild?.textContent ?? cells[0] ?? "").trim();
        rows[name] = cells;
      }
    }
    return rows;
  });
}

async function readSheetStatRows(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find(
      (h) => h.textContent?.trim() === "Profile Stats",
    );
    const rows: Record<string, string[]> = {};
    for (const row of heading?.parentElement?.querySelectorAll("tbody tr") ?? []) {
      const cells = [...row.querySelectorAll("td")].map((c) => (c.textContent ?? "").trim());
      rows[cells[0] ?? ""] = cells;
    }
    return rows;
  });
}

function editStatRow(page: Page, label: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Profile Stats", exact: true }) })
    .locator("tbody tr")
    .filter({ has: page.locator("td").first().getByText(label, { exact: true }) });
}

function editSkillRow(page: Page, name: string) {
  return page
    .locator("tr")
    .filter({ has: page.locator("td").first().getByText(name, { exact: true }) })
    .first();
}

async function openEdit(page: Page, id: string) {
  await page.goto(`/characters/${id}/edit`);
  await expect(page.getByRole("heading", { name: /Character Edit/ })).toBeVisible({
    timeout: 30_000,
  });
}

async function saveEdit(page: Page) {
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Character edits saved to the server.")).toBeVisible({
    timeout: 20_000,
  });
}

const OWNER_REFUSAL = "Only a GM or admin can change";

interface Fixture {
  before: ReturnType<typeof summarize>;
  character: ServerCharacter;
  id: string;
  playerPage: Page;
  scenario: { participantId: string; scenarioId: string };
}

async function setUp(browser: Browser, gm: APIRequestContext, label: string): Promise<Fixture> {
  const { character, playerPage, playerUserId } = await createChargenCharacter({ browser, label });
  const scenario = await admitToScenario({ characterId: character.id, gm, playerUserId });
  return { before: summarize(character.build), character, id: character.id, playerPage, scenario };
}

function skillView(summary: ReturnType<typeof summarize>, skillId: string, languageName?: string) {
  return summary.draftView.skills.find(
    (skill) => skill.skillId === skillId && skill.languageName === languageName,
  );
}

/** Saves, reads the stored record, and checks the Chargen totals stayed frozen. */
async function saveAndRead(page: Page, fixture: Fixture) {
  await saveEdit(page);
  const stored = await getCharacter(page.request, fixture.id);
  expect(stored.build.progression.primaryPoolSpent).toBe(
    fixture.character.build.progression.primaryPoolSpent,
  );
  expect(stored.build.progression.secondaryPoolSpent).toBe(
    fixture.character.build.progression.secondaryPoolSpent,
  );
  const after = summarize(stored.build);
  // A GM correction is not seniority (ruling 5).
  expect(after.skillPoints).toEqual(fixture.before.skillPoints);
  return { after, stored };
}

async function openSheet(page: Page, id: string) {
  await page.goto(`/characters/${id}`);
  await expect(page.getByRole("heading", { name: "Skills", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("GM editing and Progression change the played Character (#1068)", () => {
  test.use({ actionTimeout: 15_000, storageState: "e2e/.auth/gm.json" });
  test.setTimeout(180_000);

  test("Developed and Current stat edits reach the Sheet and combat; Original is read-only", async ({
    browser,
    page,
  }) => {
    const fixture = await setUp(browser, page.request, "stats");
    const { before, id } = fixture;
    await openEdit(page, id);
    await capture(page, "stats-edit-before");
    const strRow = editStatRow(page, "Str");
    expect.soft(await strRow.locator("td").nth(1).locator("input").count()).toBe(0);
    const developedStr = before.statLayers!.developed.str + 2;
    await strRow.locator("td").nth(2).locator("input").fill(String(developedStr));
    const currentDex = before.statLayers!.current.dex + 1;
    await editStatRow(page, "Dex").locator("td").nth(3).locator("input").fill(String(currentDex));
    const { after } = await saveAndRead(page, fixture);
    expect(after.statLayers!.developed.str).toBe(developedStr);
    expect(after.statLayers!.current.str).toBe(before.statLayers!.current.str + 2);
    expect(after.statLayers!.current.dex).toBe(currentDex);
    expect(after.statLayers!.original).toEqual(before.statLayers!.original);

    await openEdit(page, id);
    await expect(editStatRow(page, "Str").locator("td").nth(2).locator("input")).toHaveValue(
      String(developedStr),
    );
    await openSheet(page, id);
    const stats = await readSheetStatRows(page);
    expect(stats["Str"]?.[2]).toBe(String(before.statLayers!.original.str));
    expect(stats["Str"]?.[3]).toBe(String(developedStr));
    expect(stats["Str"]?.[4]).toBe(String(after.statLayers!.current.str));
    expect(stats["Dex"]?.[4]).toBe(String(currentDex));
    await capture(page, "stats-sheet-after");

    const combat = await refreshedParticipantCombatInputs({
      gm: page.request,
      ...fixture.scenario,
    });
    expect(combat.inputs.strength).toBe(after.statLayers!.current.str);
    expect(combat.inputs.dexterity).toBe(currentDex);
    await fixture.playerPage.context().close();
  });

  test("raising an existing Chargen skill and the mother tongue reaches the Sheet and combat", async ({
    browser,
    page,
  }) => {
    const fixture = await setUp(browser, page.request, "skill");
    const { before, id } = fixture;
    await openEdit(page, id);
    await editSkillRow(page, "1-h edged").locator('input[type="number"]').fill("6");
    await editSkillRow(page, "Language (Scythian)").locator('input[type="number"]').fill("12");
    await capture(page, "skill-edit-typed");
    const { after } = await saveAndRead(page, fixture);
    expect(skillView(after, "one_handed_edged")?.specificSkillLevel).toBe(6);
    expect(skillView(after, "language", "Scythian")?.specificSkillLevel).toBe(12);

    await openEdit(page, id);
    await expect(editSkillRow(page, "1-h edged").locator('input[type="number"]')).toHaveValue("6");
    await openSheet(page, id);
    const rows = await readSheetSkillRows(page);
    expect(rows["1-h edged"]?.[4]).toBe("6");
    expect(rows["1-h edged"]?.[6]).toBe(
      String(skillView(after, "one_handed_edged")!.effectiveSkillNumber),
    );
    expect(rows["Language (Scythian)"]?.[4]).toBe("12");

    const combat = await refreshedParticipantCombatInputs({
      gm: page.request,
      ...fixture.scenario,
    });
    expect(combat.inputs.combatSkillXpByCompetencyId["one_handed_edged"]).toBe(
      skillView(before, "one_handed_edged")!.effectiveSkillNumber + 2,
    );
    await fixture.playerPage.context().close();
  });

  test("adding a new target skill stores it and combat uses it", async ({ browser, page }) => {
    const fixture = await setUp(browser, page.request, "newskill");
    const { id } = fixture;
    await openEdit(page, id);
    await page.locator("select").filter({ hasText: "Add skill..." }).selectOption({
      label: "Deception",
    });
    await page.getByRole("button", { name: "Add skill", exact: true }).click();
    await editSkillRow(page, "Deception").locator('input[type="number"]').fill("3");
    const { after } = await saveAndRead(page, fixture);
    expect(skillView(after, "skill:deception")?.specificSkillLevel).toBe(3);
    await openSheet(page, id);
    expect((await readSheetSkillRows(page))["Deception"]?.[4]).toBe("3");
    const combat = await refreshedParticipantCombatInputs({
      gm: page.request,
      ...fixture.scenario,
    });
    expect(combat.inputs.combatSkillXpByCompetencyId["skill:deception"]).toBe(3);
    await fixture.playerPage.context().close();
  });

  test("the Character's Chargen skill group is shown and its level edit reaches the Sheet", async ({
    browser,
    page,
  }) => {
    const fixture = await setUp(browser, page.request, "group");
    const { before, id } = fixture;
    await openEdit(page, id);
    await editSkillRow(page, "Running and athletic field practice")
      .locator('input[type="number"]')
      .fill("2");
    const { after } = await saveAndRead(page, fixture);
    expect(after.draftView.groups.find((g) => g.groupId === "F04")?.groupLevel).toBe(2);
    await openSheet(page, id);
    await expect(page.getByText("Running and athletic field practice (Level 2)")).toBeVisible();
    const combat = await refreshedParticipantCombatInputs({
      gm: page.request,
      ...fixture.scenario,
    });
    const runningBefore = before.draftView.skills.find((s) => s.groupLevel > 0);
    expect(runningBefore).toBeDefined();
    expect(combat.sheet.draftView.groups.find((g) => g.groupId === "F04")?.groupLevel).toBe(2);
    await fixture.playerPage.context().close();
  });

  test("a specialization edit reaches the Sheet and the participant", async ({ browser, page }) => {
    const fixture = await setUp(browser, page.request, "spec");
    const { id } = fixture;
    await openEdit(page, id);
    await editSkillRow(page, "Battlefield Surgery").getByRole("button", { name: "+" }).click();
    const { after } = await saveAndRead(page, fixture);
    const spec = after.draftView.specializations.find(
      (s) => s.specializationId === "battlefield_surgery",
    );
    expect(spec?.secondaryRanks).toBe(2);
    await openSheet(page, id);
    await expect(page.getByText("Battlefield Surgery", { exact: true }).first()).toBeVisible();
    const combat = await refreshedParticipantCombatInputs({
      gm: page.request,
      ...fixture.scenario,
    });
    expect(
      combat.sheet.draftView.specializations.find(
        (s) => s.specializationId === "battlefield_surgery",
      )?.effectiveSpecializationNumber,
    ).toBe(spec?.effectiveSpecializationNumber);
    await fixture.playerPage.context().close();
  });

  test("the owning player cannot raise a skill or a stat directly", async ({ browser, page }) => {
    const fixture = await setUp(browser, page.request, "guard");
    const { id, playerPage } = fixture;
    const read = await getCharacter(playerPage.request, id);
    const raisedSkill = structuredClone(read.build);
    const brawling = raisedSkill.progression.skills.find((s) => s.skillId === "brawling")!;
    brawling.secondaryRanks += 3;
    brawling.ranks += 3;
    const skillRefusal = await playerPage.request.put(`${API_URL}/characters/${id}`, {
      data: { build: raisedSkill, expectedUpdatedAt: read.updatedAt },
    });
    expect(skillRefusal.status()).toBe(400);
    expect(await skillRefusal.text()).toContain(OWNER_REFUSAL);
    const raisedStat = structuredClone(read.build);
    raisedStat.developedStatModifiers = { ...(raisedStat.developedStatModifiers ?? {}), str: 9 };
    const statRefusal = await playerPage.request.put(`${API_URL}/characters/${id}`, {
      data: { build: raisedStat, expectedUpdatedAt: read.updatedAt },
    });
    expect(statRefusal.status()).toBe(400);
    expect(await statRefusal.text()).toContain(OWNER_REFUSAL);
    expect((await getCharacter(page.request, id)).updatedAt).toBe(read.updatedAt);
    await playerPage.context().close();
  });

  test("a Progression success and a failure store, and the Sheet shows the seniority", async ({
    browser,
    page,
  }) => {
    const fixture = await setUp(browser, page.request, "progression");
    const { before, character, id, playerPage } = fixture;
    const brawlingBefore = skillView(before, "brawling")!;
    const surgeryBefore = skillView(before, "skill:surgery")!;

    // 1. The GM grants points.
    await openEdit(page, id);
    await page.locator("label").filter({ hasText: "Points to add" }).locator("input").fill("20");
    await page.getByRole("button", { name: "Grant points", exact: true }).click();
    await saveEdit(page);

    // 2. The player requests checks for Brawling (XP 1) and Surgery (XP 6).
    const openAdvance = async () => {
      await playerPage.goto(`/characters/${id}/advance`);
      await expect(playerPage.getByText(/Available points:/).first()).toBeVisible({
        timeout: 30_000,
      });
    };
    await openAdvance();
    for (const name of ["Brawling", "Surgery"]) {
      const box = playerPage.getByLabel(`${name} requested check`, { exact: true });
      await box.click();
      await expect(box).toBeChecked();
    }
    await playerPage.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(playerPage.getByText("Changes saved to server.")).toBeVisible({ timeout: 20_000 });

    // 3. The GM approves both.
    await openEdit(page, id);
    for (const targetId of ["brawling", "skill:surgery"]) {
      const box = page.getByLabel(`${targetId} approved progression check`, { exact: true });
      await box.click();
      await expect(box).toBeChecked();
    }
    await saveEdit(page);

    // 4–6. The player buys, resolves with a forced success and a forced failure, and saves.
    await openAdvance();
    for (const name of ["Brawling", "Surgery"]) {
      await playerPage
        .locator("tr")
        .filter({ has: playerPage.locator("td").first().getByText(name, { exact: true }) })
        .getByRole("button", { name: "Buy", exact: true })
        .click();
      await expect(playerPage.getByText(/Progression attempt purchased/)).toBeVisible();
    }
    // d20 = floor(r * 20) + 1, in pending-attempt order: Brawling 15 (>= 1, success),
    // Surgery 1 (< 6, failure).
    await playerPage.evaluate(() => {
      const queue = [0.7, 0.0];
      const original = Math.random;
      Math.random = () => (queue.length ? queue.shift()! : original());
    });
    await playerPage.getByRole("button", { name: "Resolve checks", exact: true }).click();
    await expect(playerPage.getByText(/Resolved 2 progression attempts; 1 succeeded/)).toBeVisible({
      timeout: 20_000,
    });
    await capture(playerPage, "progression-after-resolve");
    const playerSave = playerPage.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes(`/characters/${id}`),
    );
    await playerPage.getByRole("button", { name: "Save changes", exact: true }).click();
    const playerSaveResponse = await playerSave;
    expect(playerSaveResponse.status(), await playerSaveResponse.text()).toBe(200);
    await expect(playerPage.getByText("Changes saved to server.")).toBeVisible({ timeout: 20_000 });

    const stored = await getCharacter(page.request, id);
    const state = stored.build.progressionState;
    expect(state.pendingAttempts).toEqual([]);
    expect(state.history.map((h) => [h.targetId, h.success])).toEqual([
      ["brawling", true],
      ["skill:surgery", false],
    ]);
    const gained = state.history.filter((h) => h.success).reduce((sum, h) => sum + h.cost, 0);
    expect(gained).toBeGreaterThan(0);
    const after = summarize(stored.build);
    expect(skillView(after, "brawling")!.effectiveSkillNumber).toBe(
      brawlingBefore.effectiveSkillNumber + 1,
    );
    expect(skillView(after, "skill:surgery")!.effectiveSkillNumber).toBe(
      surgeryBefore.effectiveSkillNumber,
    );
    expect(stored.build.progression.primaryPoolSpent).toBe(
      character.build.progression.primaryPoolSpent,
    );
    expect(stored.build.progression.secondaryPoolSpent).toBe(
      character.build.progression.secondaryPoolSpent,
    );
    expect(after.skillPoints.original).toBe(before.skillPoints.original);
    expect(after.skillPoints.successfulProgressionGains).toBe(gained);

    // The Sheet shows the increase and the seniority line.
    await openSheet(playerPage, id);
    await expect(
      playerPage.getByText(
        `Original ${before.skillPoints.original} + successful progression ${gained}`,
      ),
    ).toBeVisible();
    const rows = await readSheetSkillRows(playerPage);
    expect(rows["Brawling"]?.[6]).toBe(String(brawlingBefore.effectiveSkillNumber + 1));
    await capture(playerPage, "progression-sheet-after");

    // Combat uses the improved skill after the GM refreshes the participant.
    const combat = await refreshedParticipantCombatInputs({
      gm: page.request,
      ...fixture.scenario,
    });
    expect(combat.inputs.brawlingCombatSkillXp).toBe(brawlingBefore.effectiveSkillNumber + 1);
    await playerPage.context().close();
  });
});
