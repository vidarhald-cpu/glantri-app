import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";

/**
 * #771 R2-3 and R2-12 — rendered evidence for a composition change on both Combat surfaces.
 *
 * This spec exists because the coverage that was supposed to protect these controls could not.
 * `CombatRoundManagerPanel.test.ts` asserted only that the four labels appear somewhere in the
 * source text, so it passed whatever the controls' position was; that is how the placement the
 * Product Owner objected to went unnoticed. Everything measured here is read off the rendered
 * layout rather than the source.
 *
 * R2-3 (Product Owner ruling): the four inspection controls belong on the tracker section's top
 * line, left of `Current task`, as small arrow symbols, on the GM surface and the player surface
 * alike — and the top line must not wrap, because the wrap is what severed them from the tracker.
 * R2-12: a historical panel with nothing recorded is omitted rather than reserving a card.
 * R2-2: the `PD` column is gone from the visible tracker on both surfaces, and the twelve columns
 * that were asked for are all still there.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

/** One row of controls at this type scale measures ~34px; a wrapped line roughly doubles that. */
const SINGLE_ROW_HEIGHT_LIMIT = 52;
/** The ruled "realistic narrow width". 1024 is the smallest common desktop/tablet-landscape width. */
const NARROW_VIEWPORT = { height: 900, width: 1024 };
const NAV_NAMES = [
  "Previous participant",
  "Next participant",
  "Previous step",
  "Next step",
] as const;

/**
 * The tracker column set the Product Owner's captures transcribed, minus `PD` (#771 R2-2). Asserted
 * as a whole sequence rather than as "PD is absent", so a removal that also dropped or reordered a
 * wanted column could not pass.
 */
const EXPECTED_TRACKER_COLUMNS = [
  "DE",
  "M1",
  "i1",
  "A1",
  "P1",
  "D1",
  "M2",
  "i2",
  "A2",
  "P2",
  "D2",
  "SU",
] as const;

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown = {},
): Promise<T> {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

interface Box {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

interface HeaderGeometry {
  readonly currentTask: Box;
  readonly grid: Box;
  readonly heading: Box;
  readonly nav: Box;
  readonly navButtons: readonly (Box & { readonly label: string | null })[];
  readonly scrollY: number;
}

/**
 * Every box this spec compares is read in **one** `page.evaluate`, in **document** coordinates
 * (`getBoundingClientRect()` plus the current scroll offset).
 *
 * Both halves of that are load-bearing, and getting it wrong is what CI caught on the first head
 * of this branch (run 1635, task 9389): the assertion below reported a 754 px spread for three
 * controls that are 30 px apart. `locator.boundingBox()` is viewport-relative, exactly like
 * `getBoundingClientRect()`, and this page scrolls itself after mount — `CombatLog` runs
 * `scrollIntoView` on the newest event (`CombatLog.tsx:30-38`), which on the GM surface leaves
 * `window.scrollY` at 655 with no interaction from the test. Locally that scroll had settled
 * before the first read, so four sequential reads shared one frame and agreed. In the slower CI
 * container it landed *between* reads, and every box read after it was offset by the scroll
 * delta. Measured directly: forcing a 720 px scroll between two sequential reads moved the same
 * instrument from 30 to 95, while this atomic document-relative reading stayed at 30.
 *
 * So the 754 was the instrument, not the layout, and the limit below is unchanged. The replacement
 * is still sensitive to a real wrap: measured 30 px at 1024 and 768, and 67 px at 700 and 640,
 * where the header genuinely does wrap.
 */
async function readHeaderGeometry(input: {
  heading: Locator;
  page: Page;
}): Promise<HeaderGeometry> {
  const nav = input.page.getByRole("region", { name: "Tracker inspection navigation" });
  await expect(nav).toBeVisible();
  await expect(input.page.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();
  await expect(input.heading).toBeVisible();
  const headingHandle = await input.heading.elementHandle();
  if (!headingHandle) throw new Error("The panel heading is visible but has no element handle.");

  const geometry = await input.page.evaluate((headingElement) => {
    const docRect = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return {
        bottom: rect.bottom + window.scrollY,
        height: rect.height,
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
      };
    };
    const navSection = document.querySelector(
      'section[aria-label="Tracker inspection navigation"]',
    );
    const grid = document.querySelector('[aria-label="Combat round timeline grid"]');
    const currentTasks = Array.from(document.querySelectorAll("button")).filter((node) =>
      ["Current task", "Resume current task"].includes((node.textContent ?? "").trim()),
    );
    if (!navSection || !grid || currentTasks.length !== 1 || !(headingElement instanceof Element)) {
      return {
        currentTaskCount: currentTasks.length,
        hasGrid: Boolean(grid),
        hasNav: Boolean(navSection),
      };
    }
    return {
      currentTask: docRect(currentTasks[0]!),
      grid: docRect(grid),
      heading: docRect(headingElement),
      nav: docRect(navSection),
      navButtons: Array.from(navSection.querySelectorAll("button")).map((node) => ({
        label: node.getAttribute("aria-label"),
        ...docRect(node),
      })),
      scrollY: window.scrollY,
    };
  }, headingHandle);

  if (!("nav" in geometry)) {
    throw new Error(
      `Tracker header geometry is incomplete: ${JSON.stringify(geometry)}. Exactly one Current task button, one nav region and one tracker grid are expected.`,
    );
  }
  return geometry as HeaderGeometry;
}

/**
 * The measurement behind "the top line does not wrap". A wrapped flex row places its later
 * children on a second line, so the union of every control's box grows by a whole row; one line
 * keeps it inside a single row's height whatever the individual control heights are.
 */
function unionHeight(boxes: readonly Box[]): number {
  return (
    Math.max(...boxes.map((entry) => entry.bottom)) - Math.min(...boxes.map((entry) => entry.top))
  );
}

/**
 * R2-2, read off the rendered header row rather than the step list that produced it.
 */
async function assertVisibleTrackerColumns(input: { page: Page; surface: string }): Promise<void> {
  const grid = input.page.locator('[aria-label="Combat round timeline grid"]');
  await expect(grid).toBeVisible();
  const stepHeaders = grid.locator("thead tr").nth(1).locator("th");
  const rendered = (await stepHeaders.allInnerTexts()).map((text) => text.trim());
  expect(rendered, `${input.surface}: rendered tracker columns`).toEqual([
    ...EXPECTED_TRACKER_COLUMNS,
  ]);
  expect(rendered, `${input.surface}: PD must not be a visible column`).not.toContain("PD");
  // The hover help for the removed step must not survive as an invisible column either.
  await expect(
    grid.locator('th[title="Pre-declaration Combat Experience check"]'),
    `${input.surface}: no PD column header`,
  ).toHaveCount(0);
}

/**
 * Proves the ruled placement on whichever surface is passed: the arrows sit above the tracker
 * grid, on the heading's own line, entirely to the left of `Current task`, and that line is one
 * line at a realistically narrow width.
 */
async function assertRuledNavigationPlacement(input: {
  heading: Locator;
  page: Page;
  surface: string;
}): Promise<void> {
  const { page } = input;
  const geometry = await readHeaderGeometry({ heading: input.heading, page });

  // "They belong in the section above": the controls render above the tracker, not below it.
  expect(
    geometry.nav.bottom,
    `${input.surface}: arrows above the tracker grid (scrollY ${geometry.scrollY})`,
  ).toBeLessThanOrEqual(geometry.grid.top);
  // "to the left of the current task".
  expect(geometry.nav.right, `${input.surface}: arrows left of Current task`).toBeLessThanOrEqual(
    geometry.currentTask.left,
  );
  // "on the top line" — the arrows, the panel heading and `Current task` share one row.
  expect(
    unionHeight([geometry.heading, geometry.nav, geometry.currentTask]),
    `${input.surface}: top line must not wrap at ${NARROW_VIEWPORT.width}px (scrollY ${geometry.scrollY})`,
  ).toBeLessThan(SINGLE_ROW_HEIGHT_LIMIT);

  // The accessible names survive the move to icon-only buttons. Two running e2e specs and one
  // component test resolve these controls this way, and two more specs that use them are silenced
  // by the `testIgnore` defect (#769), so they would not have reported a break. Resolution is
  // proved through `getByRole`, the way those specs do it; the sizes come from the one atomic
  // geometry read, and the four labels are required to belong to the nav region itself.
  expect(
    geometry.navButtons.map((button) => button.label),
    `${input.surface}: the nav region holds exactly the four named controls`,
  ).toEqual([...NAV_NAMES]);
  for (const name of NAV_NAMES) {
    await expect(
      page.getByRole("button", { name, exact: true }),
      `${input.surface}: "${name}" must still resolve by accessible name`,
    ).toHaveCount(1);
    const navButton = geometry.navButtons.find((button) => button.label === name)!;
    // Still a usable hit target after becoming a glyph, and still showing a focus indicator.
    expect(navButton.width, `${input.surface}: "${name}" hit-target width`).toBeGreaterThanOrEqual(
      26,
    );
    expect(
      navButton.height,
      `${input.surface}: "${name}" hit-target height`,
    ).toBeGreaterThanOrEqual(26);
  }

  /*
   * The focus indicator, measured in the hard case on purpose. Chromium applies `:focus-visible`
   * — and therefore the user-agent focus ring — by input modality, so a bare `locator.focus()`
   * reports `outline-style: none` whenever the previous interaction was a mouse click. An earlier
   * version of this check called `focus()` with no preceding click and passed for that reason
   * alone, which is the shape of assertion that looks like coverage and is not. So: click
   * something inert to put the page in mouse modality, then arrive at the button by keyboard.
   */
  const focused = page.getByRole("button", { name: "Next participant", exact: true });
  await input.heading.click();
  await focused.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(focused).toBeFocused();
  const outlineStyle = await focused.evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outlineStyle, `${input.surface}: keyboard focus must stay visible`).not.toBe("none");
}

test.describe("Combat tracker inspection navigation and empty historical panels (#771)", () => {
  test.use({ storageState: "e2e/.auth/gm.json", viewport: NARROW_VIEWPORT });

  test("renders the ruled arrow controls on both surfaces and omits unrecorded historical panels", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({
      storageState: "e2e/.auth/player.json",
      viewport: NARROW_VIEWPORT,
    });
    const secondContext = await browser.newContext({ storageState: "e2e/.auth/non-holder.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );
    const secondUser = await json<{ user: { id: string } }>(
      await secondContext.request.get(`${API_URL}/auth/me`),
    );

    // Two player-held characters, so participant navigation has somewhere to go on both surfaces.
    // One account may hold only one active character per scenario, hence two accounts.
    const characters = [
      {
        context: playerContext,
        id: `nav-player-${suffix}`,
        name: `Nav Player ${suffix}`,
        userId: playerUser.user.id,
      },
      {
        context: secondContext,
        id: `nav-second-${suffix}`,
        name: `Nav Second ${suffix}`,
        userId: secondUser.user.id,
      },
    ];
    for (const character of characters) {
      const created = await character.context.request.post(`${API_URL}/characters`, {
        data: characterPayload(character.id, character.name),
      });
      expect(created.ok(), await created.text()).toBe(true);
    }

    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 771 Tracker Nav ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const character of characters) {
      await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
    }
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 771 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participantIdByCharacterId: Record<string, string> = {};
    for (const character of characters) {
      const participant = await post<{ participant: { id: string } }>(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/character`,
        { characterId: character.id, controlledByUserId: character.userId },
      );
      participantIdByCharacterId[character.id] = participant.participant.id;
      await post(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
      );
    }

    const now = new Date().toISOString();
    const combatantIds = characters.map((character) => `issue-771-${character.id}`);
    const created = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-771-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: characters.map((character, index) => ({
            characterId: character.id,
            id: combatantIds[index]!,
            label: character.name,
            participantType: "scenario",
            scenarioParticipantId: participantIdByCharacterId[character.id],
          })),
          scenarioId,
          status: "active",
          title: `Issue 771 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = created.encounter.id;
    const refreshed = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const activated = await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
    });
    expect(activated.ok(), await activated.text()).toBe(true);
    const activeEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );

    // Round 1 opens on the Combat Experience check, which gates the declaration controls.
    // Resolving it is scaffolding, exactly as the GM panel's own component fixture does it.
    const combatRoundState = combatantIds.reduce(
      (state, participantId, index) =>
        rollCombatRoundCombatExperience({
          command: { createdAt: new Date(Date.now() + index).toISOString() },
          participantId,
          rng: () => 0.6,
          skillTotal: 26,
          state,
        }).state,
      setCombatRoundCombatExperienceDifficulty({
        difficulty: 26,
        state: initializeCombatRoundState({ encounter: activeEncounter.encounter }),
      }),
    );
    expect(combatRoundState.currentStep).toBe("select_actions");
    const stateUpdate = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: activeEncounter.encounter.updatedAt,
        session: {
          ...activeEncounter.encounter,
          combatRoundState,
          currentRound: 1,
          status: "active",
        },
      },
    });
    expect(stateUpdate.ok(), await stateUpdate.text()).toBe(true);

    // ---- GM surface ----
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    const gmHeading = gmPage.getByRole("heading", { name: "Combat Round Manager" });
    await expect(gmHeading).toBeVisible();
    const inspectorHeading = gmPage.getByRole("heading", { name: /^Combat inspector — / });
    await expect(inspectorHeading).toBeVisible();
    await assertRuledNavigationPlacement({ heading: gmHeading, page: gmPage, surface: "GM" });
    await assertVisibleTrackerColumns({ page: gmPage, surface: "GM" });

    // The controls still do their job from the new position: participant navigation moves the
    // inspection selection to the other combatant and back.
    /*
     * Which participant the cursor opens on is not fixed by this fixture, so the direction with a
     * neighbour is chosen from the rendered row order rather than assumed. An earlier version of
     * this block hard-coded "Next participant" and passed or failed depending on that ordering.
     */
    const rowLabels = await gmPage
      .locator('[aria-label="Combat round timeline grid"] tbody tr td:first-child strong')
      .allInnerTexts();
    expect(rowLabels.length).toBeGreaterThan(1);
    const inspectedLabel = async () =>
      (await inspectorHeading.innerText()).replace(/^Combat inspector — /, "").split(" · ")[0]!;
    const startLabel = await inspectedLabel();
    const startIndex = rowLabels.indexOf(startLabel);
    expect(
      startIndex,
      "the inspected participant must be a rendered tracker row",
    ).toBeGreaterThanOrEqual(0);
    const forward = startIndex < rowLabels.length - 1;
    const neighbourLabel = rowLabels[startIndex + (forward ? 1 : -1)]!;
    await gmPage
      .getByRole("button", {
        exact: true,
        name: forward ? "Next participant" : "Previous participant",
      })
      .click();
    await expect(inspectorHeading).toContainText(neighbourLabel);
    await gmPage
      .getByRole("button", {
        exact: true,
        name: forward ? "Previous participant" : "Next participant",
      })
      .click();
    await expect(inspectorHeading).toContainText(startLabel);

    // ---- R2-12, on the GM historical surface ----
    // The round is in Declaration, so stepping forward selects a step the round has not reached.
    // `inspectorIsHistorical` is true for any selection that is not the current progression, so
    // this is the historical inspector with nothing recorded — the exact state that used to
    // reserve four full-height "no information available" cards.
    await expect(inspectorHeading).toContainText("Declaration");
    await expect(gmPage.getByText("No information available for this panel.")).toHaveCount(0);
    await gmPage.getByRole("button", { name: "Next step", exact: true }).click();
    await expect(inspectorHeading).toContainText("Review phase 1 modifiers");
    await expect(
      gmPage.getByText("No information available for this panel."),
      "GM: an unrecorded historical panel must be omitted, not reserved",
    ).toHaveCount(0);
    // The omission is per-panel, not a blanked workspace: the inspector itself still renders.
    await expect(inspectorHeading).toBeVisible();
    await expect(gmPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();
    // Stepping back returns to the live selection, so the navigation is reversible from here too.
    await gmPage.getByRole("button", { name: "Previous step", exact: true }).click();
    await expect(inspectorHeading).toContainText("Declaration");
    await expect(inspectorHeading).toContainText(startLabel);

    // ---- Player surface ----
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    const playerHeading = playerPage.getByText("Combat history", { exact: true });
    await expect(playerHeading).toBeVisible();
    await assertRuledNavigationPlacement({
      heading: playerHeading,
      page: playerPage,
      surface: "Player",
    });
    await assertVisibleTrackerColumns({ page: playerPage, surface: "Player" });

    /*
     * The player buttons are presentation over the navigation the player's arrow keys already
     * drove; the claim in the PR is that they add no reach. So this measures the keyboard move
     * first, proving the fixture really can move, then proves the button reproduces it. The
     * observable is the `Current task` / `Resume current task` label, which is exactly whether a
     * history inspection selection is held.
     */
    const playerCurrentTask = playerPage.getByRole("button", {
      name: /^(Current task|Resume current task)$/,
    });
    await expect(playerCurrentTask).toHaveText("Current task");
    /*
     * `ArrowUp` and not `ArrowDown`: measured on this fixture, the player's only inspectable
     * neighbour is the row above, because `inspectable` needs a current, selected, snapshotted or
     * result-carrying cell and the row below has none of those yet. So the equivalent button here
     * is "Previous participant". That asymmetry is a property of the fixture, not of the controls.
     */
    await playerPage.locator('[aria-label="Combat round timeline grid"]').focus();
    await playerPage.keyboard.press("ArrowUp");
    await expect(
      playerCurrentTask,
      "Player: arrow-key tracker navigation must already move, or this fixture proves nothing",
    ).toHaveText("Resume current task");
    await playerCurrentTask.click();
    await expect(playerCurrentTask).toHaveText("Current task");
    await playerPage.getByRole("button", { name: "Previous participant", exact: true }).click();
    await expect(
      playerCurrentTask,
      "Player: the arrow button must reproduce the arrow key's move, not exceed it",
    ).toHaveText("Resume current task");
    await expect(playerPage.getByText("No information available for this panel.")).toHaveCount(0);

    await playerPage.close();
    await playerContext.close();
    await secondContext.close();
  });
});
