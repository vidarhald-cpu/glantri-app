import { expect, test } from "@playwright/test";

/**
 * Overlapping Learning Group training, in the browser.
 *
 * Product Owner ruling, 2026-09-27 (Forgejo #385, rule decision 0011): Chargen exposes
 * training as an edit to the Character's allocation, not as an irreversible purchase ledger,
 * and no cost result is ever visible without an explanation.
 *
 * `Teacher` on `Scandia` reaches both `Instruction and schooling practice` (Teaching,
 * Mnemonics, Oratory) and `Speech and memory practice` (Oratory, Mnemonics) — a strict subset.
 * Once the first is trained, the second adds no competence, so it costs nothing. That is the
 * #381 repair, and the zero cost has to be stated rather than left blank. The access holds for
 * every social band the roll can produce (1-4), so this journey is deterministic.
 *
 * The canonical `F35`/`G08` case, where added training makes the build cost *fall*, is **not
 * reachable through this surface**: those Learning Groups exist only in the `/skills` content
 * projection, not in the one Chargen consumes. The before/after notice for that case is
 * covered at `src/features/chargen/components/TrainingCostChangeNotice.component.test.tsx`,
 * and the arithmetic at
 * `packages/rules-engine/src/chargen/overlappingLearningGroupPricing.test.ts`.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const SCHOOLING = "Instruction and schooling practice";
const SPEECH = "Speech and memory practice";

test("overlapping training is an allocation edit and never an unexplained cost result", async ({
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
  await page.getByRole("radio", { name: /Scandia/ }).click();
  await page.getByRole("radio", { name: /Teacher/ }).click();

  // The pool is an allocation, not a spend ledger, and the per-group ranks no longer borrow
  // the pool's label.
  const ordinaryPoints = page.getByRole("group", { name: "Ordinary points" });
  await expect(ordinaryPoints).toContainText("Allocated to training 0 /");
  await expect(page.getByText("Ordinary spent")).toHaveCount(0);
  await expect(page.getByText("Buy / raise skill group")).toHaveCount(0);
  await expect(page.getByText("-1 skill group")).toHaveCount(0);

  const schooling = page.locator("section").filter({ hasText: SCHOOLING }).last();
  const speech = page.locator("section").filter({ hasText: SPEECH }).last();
  await expect(schooling.getByText("Ranks from ordinary points")).toBeVisible();

  // Three ranks of the schooling practice. The cost rises monotonically: 4, 8, 12.
  for (const expectedTotal of [4, 8, 12]) {
    await schooling.getByRole("button", { name: "Add training", exact: true }).click();
    await expect(ordinaryPoints).toContainText(`Allocated to training ${expectedTotal} /`);
  }

  // The overlapping speech practice teaches nothing this Character does not already have, so
  // it costs nothing — and the interface says so before and after the change, rather than
  // leaving an unmoved total unexplained.
  await expect(speech.getByText("Adding one rank costs nothing", { exact: false })).toBeVisible();
  await speech.getByRole("button", { name: "Add training", exact: true }).click();
  await expect(ordinaryPoints).toContainText("Allocated to training 12 /");
  await expect(speech.getByText("Ranks from ordinary points")).toBeVisible();
  await expect(speech.getByText("Adding one rank costs nothing", { exact: false })).toBeVisible();

  // Training is editable, not an irreversible purchase.
  await speech.getByRole("button", { name: "Remove training", exact: true }).click();
  await expect(ordinaryPoints).toContainText("Allocated to training 12 /");
  await schooling.getByRole("button", { name: "Remove training", exact: true }).click();
  await expect(ordinaryPoints).toContainText("Allocated to training 8 /");

  await page.screenshot({
    path: testInfo.outputPath("overlapping-training-cost.png"),
    fullPage: true,
  });
});
