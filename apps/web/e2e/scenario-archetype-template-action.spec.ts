import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { API_URL } from "./targets";

/**
 * Forgejo #851, UI half (WO-851-S1). On the Scenario page's Template sources section a page-authored
 * humanoid archetype Template is not offered as a direct-field source: the server refuses to field
 * one (`generate_npc_from_template_first`, #1001), so offering "Create temporary actor" for it would
 * hand the GM an action that cannot succeed.
 *
 * The Templates page's "Generate NPC" tab is local page state with no deep link or route state, so it
 * cannot be offered from the Scenario page without editing the Templates feature. The archetype is
 * therefore hidden from the add-to-fight list (option (a)); generation stays on the Templates page.
 *
 * A Template that carries its own build (the Training Bandit shape, #666) keeps "Create temporary
 * actor" unchanged. The archetype is authored through the Templates page editor, as a GM does it.
 *
 * Set GLANTRI_E2E_CAPTURE_DIR (and optionally GLANTRI_E2E_CAPTURE_PHASE) to write 1280/1024 captures.
 */

const SEEDED_TRAINING_BANDIT_SNAPSHOT = { health: { currentHp: 12, maxHp: 12 } };

async function authorArchetypeTemplate(page: Page, name: string) {
  await page.goto("/templates");
  await page.getByRole("button", { name: "Create template" }).first().click();
  await page.getByPlaceholder("City Guard").fill(name);
  const next = page.getByRole("button", { name: "Next", exact: true });
  await page.getByRole("button").filter({ hasText: "Society level" }).first().click();
  await next.click();
  await page.locator("xpath=//section[h3[normalize-space()='Profession']]//button").first().click();
  await next.click();
  await page.getByRole("button").filter({ hasText: "Core group" }).first().click();
  await next.click();
  await page
    .getByRole("button")
    .filter({ hasText: /• Level \d+/ })
    .first()
    .click();
  for (let attempt = 0; attempt < 6 && (await next.count()); attempt += 1) {
    await next.click();
  }
  await page.getByRole("button", { name: "Save archetype template" }).click();
  await expect(page.getByText(`Created archetype template ${name}.`)).toBeVisible();
}

async function capture(page: Page, kind: string) {
  const dir = process.env.GLANTRI_E2E_CAPTURE_DIR;
  if (!dir) return;
  const phase = process.env.GLANTRI_E2E_CAPTURE_PHASE ?? "after";
  mkdirSync(dir, { recursive: true });
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ height: 900, width });
    await page.screenshot({ fullPage: true, path: join(dir, `${phase}-${width}-${kind}.png`) });
  }
  await page.setViewportSize({ height: 720, width: 1280 });
}

test.describe("Scenario Template sources and archetype Templates (#851)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("offers no Create temporary actor for an authored archetype Template, and keeps it for a build-carrying one", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const archetypeName = `Archetype 851 ${suffix}`;
    const banditName = `Training Bandit 851 ${suffix}`;

    await authorArchetypeTemplate(page, archetypeName);
    const created = await page.request.post(`${API_URL}/templates`, {
      data: { kind: "npc", name: banditName, snapshot: SEEDED_TRAINING_BANDIT_SNAPSHOT },
    });
    expect(created.ok(), await created.text()).toBe(true);

    const campaign = await page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Issue 851 ${suffix}`, status: "active" },
    });
    expect(campaign.ok()).toBe(true);
    const campaignId = (await campaign.json()).campaign.id as string;
    const scenario = await page.request.post(`${API_URL}/campaigns/${campaignId}/scenarios`, {
      data: { name: `Issue 851 Scenario ${suffix}`, status: "live" },
    });
    expect(scenario.ok()).toBe(true);
    const scenarioId = (await scenario.json()).scenario.id as string;

    await page.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}`);
    const picker = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "(template library)" }) })
      .first();
    await expect(picker).toBeVisible();
    const createButton = page.getByRole("button", { name: "Create temporary actor" });

    const labels = await picker.locator("option").allTextContents();
    const dir = process.env.GLANTRI_E2E_CAPTURE_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${process.env.GLANTRI_E2E_CAPTURE_PHASE ?? "after"}-picker-options.json`),
        JSON.stringify(labels, null, 2),
      );
    }

    // Captures: the archetype selected where the build allows it, and the Bandit selected.
    const archetypeOption = picker.locator("option", { hasText: archetypeName });
    if ((await archetypeOption.count()) > 0) {
      await picker.selectOption({ label: `${archetypeName} (template library)` });
      await capture(page, "archetype");
    }
    await picker.selectOption({ label: `${banditName} (template library)` });
    await capture(page, "bandit");

    // The archetype is not offered; the build-carrying Template is.
    await expect(archetypeOption).toHaveCount(0);
    expect(labels).not.toContain(`${archetypeName} (template library)`);
    expect(labels).toContain(`${banditName} (template library)`);

    // The Bandit still uses Create temporary actor unchanged.
    await expect(createButton).toBeVisible();
    await createButton.click();
    await expect(page.getByText(`Created temporary actor ${banditName}.`)).toBeVisible();
  });
});
