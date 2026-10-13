import { expect, type Page } from "@playwright/test";

/**
 * Chargen step navigation for the browser suite (Forgejo #568 / PR #574).
 *
 * The wizard used to mount every step at once, so a spec could reach any control on the page
 * without saying which step owned it. It now renders only the active step behind a step
 * navigation, while all wizard state still lives in `useChargenWizardState` on the wizard itself
 * and therefore survives switching steps. These helpers are the navigation the specs now need:
 * they do not change what any spec asserts, they only move the suite to the step that owns the
 * control the assertion was always about.
 *
 * The labels are the navigation's own button labels, which are the step headings verbatim. The
 * numbering gap after `6. Skill allocation` is deliberate: steps 7 and 8 (`Individual skills` and
 * `Specializations`) are rendered inside the skill-allocation step rather than as their own
 * navigation entries.
 */
export const chargenStepLabels = [
  "1. Stats",
  "2. Resolve stats",
  "3. Choose civilization",
  "4. Social class",
  "5. Choose profession",
  "6. Skill allocation",
  "9. Skills table",
  "9b. Specialization Table",
  "10. Review summary",
  "11. Finalize character",
] as const;

export type ChargenStepLabel = (typeof chargenStepLabels)[number];

function chargenStepNav(page: Page) {
  return page.getByRole("navigation", { name: "Chargen steps" });
}

/**
 * Activate one Chargen step and wait until the navigation reports it as the current step, so a
 * following assertion can never race the step swap.
 */
export async function gotoChargenStep(page: Page, label: ChargenStepLabel): Promise<void> {
  const nav = chargenStepNav(page);
  const stepButton = nav.getByRole("button", { exact: true, name: label });
  await expect(stepButton).toBeVisible();
  await stepButton.click();
  await expect(stepButton).toHaveAttribute("aria-current", "step");
}

/**
 * The three Chargen chooser sections that arrive collapsed (Forgejo #577), as narrowed by #597.
 *
 * Step 1, step 3 and step 5 used to render their full chooser on first arrival. They now show a
 * collapsed section with an always-visible `Expand <chooser>` control, so a spec that selects from
 * one of them has to reveal it first. This adds navigation only: no assertion changes, and the
 * revealed chooser is the same chooser, with the same controls, filters and rows.
 *
 * Forgejo #597 narrows that for Stats: `Roll all dice` now opens step 1 on the values it just
 * rolled, so a spec that rolls does **not** expand Stats. `"stats"` remains in this list because a
 * *resumed* draft is a return rather than a roll and still arrives collapsed, which
 * `chargen-account-drafts.spec.ts` exercises. Civilization and Profession are unchanged.
 */
export const chargenChoosers = ["stats", "civilization", "profession"] as const;

export type ChargenChooser = (typeof chargenChoosers)[number];

/**
 * Reveal one collapsed chooser on the active step and wait until it is open, so a following
 * selection can never race the reveal.
 *
 * `.first()` is deliberate: a collapsed Stats section with a profile already chosen carries both
 * the header toggle and the summary card's own `Expand stats` control, and either one opens it.
 */
export async function expandChargenChooser(page: Page, chooser: ChargenChooser): Promise<void> {
  const expand = page.getByRole("button", { exact: true, name: `Expand ${chooser}` }).first();
  await expect(expand).toBeVisible();
  await expand.click();
  await expect(
    page.getByRole("button", { exact: true, name: `Collapse ${chooser}` }),
  ).toBeVisible();
}

/**
 * Run one set of assertions against every Chargen step in turn.
 *
 * A page-wide `toHaveCount(0)` used to cover the whole wizard because every step was mounted
 * together. Visiting each step keeps exactly that reach for absence assertions — retired
 * vocabulary must appear on no step — rather than quietly narrowing them to the active one.
 */
export async function forEachChargenStep(
  page: Page,
  assertOnStep: (label: ChargenStepLabel) => Promise<void>,
): Promise<void> {
  for (const label of chargenStepLabels) {
    await gotoChargenStep(page, label);
    await assertOnStep(label);
  }
}
