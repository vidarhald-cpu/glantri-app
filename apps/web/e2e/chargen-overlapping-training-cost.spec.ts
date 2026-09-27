import { expect, test } from "@playwright/test";

/**
 * Canonical negative-marginal Learning Group training, in the browser.
 *
 * `Weapon Instructor` reaches both `Guard and rough-fighting drill` (which teaches the
 * one-handed concussion axe) and `One-handed edged close-combat practice`. Because closely
 * related melee training carries over, the edged training supplies competence the guard drill
 * was already priced for, and the build's recorded ordinary spend falls from `16` to `15`
 * while the player is still adding training.
 *
 * Product Owner ruling, 2026-09-27 (Forgejo #385, rule decision 0011): the lower recomputed
 * cost is correct and the arithmetic must not change, but Chargen must not present it as a
 * purchase refund. A reduction must show the before and after build cost with a concise
 * explanation, and the visible result must never be simply "added training, points spent went
 * down".
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const GUARD_DRILL = "Guard and rough-fighting drill";
const EDGED_PRACTICE = "One-handed edged close-combat practice";

test("adding overlapping training shows the before/after build cost and explains it", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const registration = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      displayName: "Overlapping training player",
      email: `chargen-385-${suffix}@example.test`,
      password: "Disposable-Chargen-385",
    },
  });
  expect(registration.status()).toBe(200);

  await page.goto("/chargen");
  await page.getByRole("button", { name: "Roll all dice", exact: true }).click();
  await page.locator('input[name="profile"]').first().click();
  await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("radio", { name: /Scythians/ }).click();
  await page.getByRole("radio", { name: /Weapon Instructor/ }).click();

  const guardDrill = page.locator("section").filter({ hasText: GUARD_DRILL }).last();
  const edgedPractice = page.locator("section").filter({ hasText: EDGED_PRACTICE }).last();

  // Three ranks of the guard drill. Ordinary cost rises monotonically: 6, 11, 16.
  for (const expectedTotal of [6, 11, 16]) {
    await guardDrill.getByRole("button", { name: "Add training", exact: true }).click();
    await expect(page.getByText(`Allocated to training ${expectedTotal} /`)).toBeVisible();
  }
  await expect(page.getByText("Training cost went down")).toHaveCount(0);

  // The first rank of the overlapping edged training buys no competence, so it costs nothing
  // and the total does not move. That must be stated, not left blank.
  await expect(
    edgedPractice.getByText("Adding one rank costs nothing", { exact: false }),
  ).toBeVisible();
  await edgedPractice.getByRole("button", { name: "Add training", exact: true }).click();
  await expect(page.getByText("Allocated to training 16 /")).toBeVisible();
  await expect(page.getByText("Training cost went down")).toHaveCount(0);

  // The second rank raises the melee cross-training carry-over far enough that competence the
  // guard drill was priced for no longer needs it, so the build costs one ordinary point less.
  await edgedPractice.getByRole("button", { name: "Add training", exact: true }).click();
  await expect(page.getByText("Allocated to training 15 /")).toBeVisible();

  // The decrease is never unexplained: before/after build cost, then the reason.
  await expect(page.getByText("Training cost went down: 16 → 15 ordinary points.")).toBeVisible();
  await expect(
    page.getByText(
      "Overlapping training does not stack. The new training covers ground the earlier training was already priced for, so this build costs less than before.",
    ),
  ).toBeVisible();

  // The training controls are an allocation edit, not a purchase ledger.
  await expect(page.getByText("Buy / raise skill group")).toHaveCount(0);
  await expect(page.getByText("Ordinary spent")).toHaveCount(0);

  // Removing that training puts the cost back up, and that direction is explained too.
  await edgedPractice.getByRole("button", { name: "Remove training", exact: true }).click();
  await expect(page.getByText("Allocated to training 16 /")).toBeVisible();
  await expect(page.getByText("Training cost went up: 15 → 16 ordinary points.")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("overlapping-training-cost.png"),
    fullPage: true,
  });
});
