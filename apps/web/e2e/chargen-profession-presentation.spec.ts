import { expect, test } from "@playwright/test";

/**
 * The Chargen Profession and acquisition presentation contract, in the browser (Forgejo #372).
 *
 * Section 1 and contract section 10.1: the selected Profession explains the occupation first, then
 * what it can train, then the training routes and their Skills, and only then the acquisition
 * controls. Section 3 and rule decision 0012: the chooser browses by the approved 16-category
 * taxonomy, not by Profession family.
 *
 * `Teacher` on `Scandia` is the deterministic journey. It reaches `Instruction and schooling
 * practice` (K07) whose full reader prose is still unpublished, `Speech and memory practice` (F14)
 * whose prose is published, and a direct route — so one journey exercises the honest-absence row,
 * the published row, and the grouped-then-direct ordering. Its Learning Group memberships also
 * overlap, which is what section 7 must explain.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const SCHOOLING = "Instruction and schooling practice";
const SPEECH = "Speech and memory practice";

/** Forbidden as headline or primary player-facing language by section 1. */
const FORBIDDEN_LABELS = [
  "Core reach",
  "Favored reach",
  "Included training packages",
  "Special access",
  "Choice slots",
];

test("Chargen explains a Profession before it exposes acquisition", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const registration = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      displayName: "Profession presentation player",
      email: `chargen-372-${suffix}@example.test`,
      password: "Disposable-Chargen-372",
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

  // The chooser browses by the approved taxonomy. The Profession-family filter is gone.
  const kindOfWork = page.getByLabel("Kind of work");
  await expect(kindOfWork).toBeVisible();
  await expect(page.getByLabel("Family")).toHaveCount(0);
  await expect(kindOfWork.locator("option")).toHaveCount(17);
  await kindOfWork.selectOption("letters-and-teaching");
  await expect(page.getByText("Transmitting competence and text", { exact: false })).toBeVisible();

  await page.getByRole("radio", { name: /Teacher/ }).click();

  const professionStep = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "5. Choose profession", exact: true }) })
    .first();

  // 1. The occupation, in published reader prose. 2. What it can train. 3. How it trains it.
  await expect(professionStep.getByText("What a practitioner does")).toBeVisible();
  await expect(professionStep.getByText("What can I learn?")).toBeVisible();
  await expect(professionStep.getByText("How am I trained?")).toBeVisible();
  await expect(
    professionStep.getByText("Everything this Profession can train", { exact: false }),
  ).toBeVisible();
  await expect(professionStep.getByText("Ordinary training", { exact: true })).toBeVisible();
  await expect(professionStep.getByText("Direct training", { exact: true })).toBeVisible();
  await expect(
    professionStep.getByText("Choosing a Profession grants no ranks and spends no points", {
      exact: false,
    }),
  ).toBeVisible();

  // A Learning Group with no published full description says so, and does not present its
  // one-line summary as though it were the explanation (#372 section 0.5).
  await expect(
    professionStep
      .getByText("Not yet described in full. The line above is this training’s short summary", {
        exact: false,
      })
      .first(),
  ).toBeVisible();

  // No forbidden or stale label anywhere in the step.
  const stepText = (await professionStep.textContent()) ?? "";
  for (const label of FORBIDDEN_LABELS) expect(stepText).not.toContain(label);

  // Step 6 purchases over the same structure: the same Learning Groups, the same words.
  const schooling = page.locator("section").filter({ hasText: SCHOOLING }).last();
  const speech = page.locator("section").filter({ hasText: SPEECH }).last();
  await expect(schooling.getByText(`What ${SCHOOLING} teaches`)).toBeVisible();
  await expect(speech.getByText(`What ${SPEECH} teaches`)).toBeVisible();

  const ordinaryPoints = page.getByRole("group", { name: "Ordinary points" });
  for (let rank = 0; rank < 3; rank += 1)
    await schooling.getByRole("button", { name: "Add training", exact: true }).click();
  await speech.getByRole("button", { name: "Add training", exact: true }).click();

  // Section 7: a membership the player holds that contributed nothing is explained, not silently
  // listed. This is the overlap rule, and it is a different sentence from a build-cost movement.
  await expect(
    page
      .getByText(
        `Also taught by ${SPEECH}. That training adds nothing further to this skill, because ${SCHOOLING} already covers it.`,
        { exact: false },
      )
      .first(),
  ).toBeVisible();
  await expect(ordinaryPoints).toContainText("Allocated to training");

  // The final review screen carries none of the retired vocabulary either.
  const review = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "10. Review summary", exact: true }) })
    .first();
  const reviewText = (await review.textContent()) ?? "";
  for (const label of [...FORBIDDEN_LABELS, "Ordinary spent", "Selectable pool"])
    expect(reviewText).not.toContain(label);
  expect(reviewText).toContain("Learning Groups trained:");
  expect(reviewText).toContain("allocated to training");

  await page.screenshot({
    path: testInfo.outputPath("chargen-profession-presentation.png"),
    fullPage: true,
  });
});
