import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #835 — rendered evidence that the player declaration surface carries one compact
 * `Position and movement` section, on the **player** view and on the **GM** view that embeds the
 * same `PlayerCombatActionSelectorPanel`.
 *
 * What it binds:
 *
 * - one group named `Position and movement`, and neither `Relative position` nor `Movement and
 *   facing` anywhere on the surface;
 * - a relative row carrying `Intention`, `Person`, `Desired distance` and one compact `+`;
 * - the `+` adds a second compact relative row, and the row count follows the intentions;
 * - a final row holding the `Movement direction` and `Facing` dropdowns, in the same row element;
 * - the explanatory paragraphs are gone from the painted layout: the two #771 R2-8 per-field
 *   sentences are still the selects' `aria-describedby` descriptions, verbatim and inside the
 *   accessibility tree, but paint nothing, and no prose remains visible in the section;
 * - **the preserved semantics are demonstrated, not asserted**: movement direction and facing are
 *   set to two *different* values and both are read back; changing either one leaves the other
 *   exactly as it was; and after the player declares, the encounter the API stores carries both
 *   distinct values. Compacting them onto one row merged nothing.
 *
 * ## Geometry method
 *
 * Every box, computed style and visible text node is read inside **one** `page.evaluate`, in one
 * synchronous pass, and `scrollY` is returned with it. These pages autoscroll after mount, so a
 * read taken across an `await` boundary straddles that scroll and reports phantom movement.
 *
 * ## Capture mode
 *
 * `GLANTRI_835_CAPTURE_BASELINE=1` produces the **before** captures: it asserts the *legacy* two
 * fieldsets instead, so it can only pass against the baseline panel file, exactly as the default
 * run can only pass against the compacted one. The two modes are mutually exclusive on purpose —
 * neither can silently pass against the other's code.
 */
const CAPTURE_BASELINE = process.env.GLANTRI_835_CAPTURE_BASELINE === "1";
const CAPTURE_DIR = resolve(
  process.env.POSITION_CAPTURE_DIR ?? "test-results/position-and-movement",
);
const CAPTURE_PREFIX = CAPTURE_BASELINE ? "before" : "after";

const MOVEMENT_DIRECTION_DESCRIPTION =
  "Movement Direction records the absolute direction in which the character intends to move.";
const FACING_DESCRIPTION =
  "Facing records the direction/orientation the character intends to maintain or reach.";

/** Every text node longer than this that still paints inside the section counts as prose. */
const PROSE_LENGTH_THRESHOLD = 24;

interface SectionRow {
  /** Caption text of each labelled control in the row, in document order. */
  controls: string[];
  hasAddControl: boolean;
  /** Document-coordinate top, so row order can be checked without a second read. */
  top: number;
}

interface SectionDescription {
  display: string;
  id: string;
  paintedHeight: number;
  paintedWidth: number;
  text: string;
  visibility: string;
}

interface PositionSectionMeasurement {
  descriptions: SectionDescription[];
  legends: string[];
  rows: SectionRow[];
  scrollY: number;
  sectionCount: number;
  sectionHeight: number;
  visibleProse: string[];
}

/**
 * Reads the whole position/movement section in one synchronous pass: its legends, its rows and the
 * controls in each, every `aria-describedby` description with its painted box, and every visible
 * text node in it that is long enough to be prose.
 */
async function measurePositionSection(page: Page): Promise<PositionSectionMeasurement> {
  return page.evaluate(
    ({ proseThreshold }) => {
      const panel = [...document.querySelectorAll("section")].find((candidate) =>
        (candidate.firstElementChild?.firstElementChild?.textContent ?? "").startsWith(
          "Action selector",
        ),
      );
      if (!panel) throw new Error("no Action selector panel on this page");
      // A capture marker, so the screenshot frames exactly the card this measurement read.
      panel.setAttribute("data-glantri-capture", "action-selector");

      const legendText = (fieldset: Element) =>
        (fieldset.querySelector(":scope > legend")?.textContent ?? "").trim();
      const wanted = new Set(["Position and movement", "Relative position", "Movement and facing"]);
      const sections = [...panel.querySelectorAll("fieldset")].filter((fieldset) =>
        wanted.has(legendText(fieldset)),
      );

      const captionOf = (control: Element): string => {
        const label = control.closest("label");
        return (label?.querySelector(":scope > span")?.textContent ?? "").trim();
      };

      const rows: {
        controls: string[];
        hasAddControl: boolean;
        top: number;
      }[] = [];
      const descriptions: {
        display: string;
        id: string;
        paintedHeight: number;
        paintedWidth: number;
        text: string;
        visibility: string;
      }[] = [];
      const visibleProse: string[] = [];

      for (const fieldset of sections) {
        for (const child of [...fieldset.children]) {
          if (child.tagName === "LEGEND") continue;
          const controls = [...child.querySelectorAll("select, input")].map(captionOf);
          if (controls.length === 0 && !child.querySelector("button")) continue;
          rows.push({
            controls,
            hasAddControl: Boolean(
              child.querySelector('button[aria-label="Add relative intention"]'),
            ),
            top: Math.round(child.getBoundingClientRect().top + window.scrollY),
          });
        }

        for (const paragraph of fieldset.querySelectorAll("[id]")) {
          if (!document.querySelector(`[aria-describedby="${paragraph.id}"]`)) continue;
          const style = window.getComputedStyle(paragraph);
          const rect = paragraph.getBoundingClientRect();
          descriptions.push({
            display: style.display,
            id: paragraph.id,
            paintedHeight: Math.round(rect.height),
            paintedWidth: Math.round(rect.width),
            text: (paragraph.textContent ?? "").replace(/\s+/g, " ").trim(),
            visibility: style.visibility,
          });
        }

        const walker = document.createTreeWalker(fieldset, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
          if (text.length <= proseThreshold) continue;
          const host = node.parentElement;
          if (!host) continue;
          if (["LEGEND", "OPTION", "SCRIPT", "STYLE"].includes(host.tagName)) continue;
          const rect = host.getBoundingClientRect();
          const style = window.getComputedStyle(host);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (rect.height <= 1 || rect.width <= 1) continue;
          visibleProse.push(text);
        }
      }

      return {
        descriptions,
        legends: sections.map(legendText),
        rows,
        scrollY: Math.round(window.scrollY),
        sectionCount: sections.length,
        sectionHeight: Math.round(
          sections.reduce((total, fieldset) => total + fieldset.getBoundingClientRect().height, 0),
        ),
        visibleProse,
      };
    },
    { proseThreshold: PROSE_LENGTH_THRESHOLD },
  );
}

/** Reads both direction values in one pass, so neither read can straddle a re-render. */
async function readDirectionPair(page: Page): Promise<{ facing: string; movement: string }> {
  return page.evaluate(() => {
    const byCaption = (caption: string) => {
      const label = [...document.querySelectorAll("label")].find(
        (candidate) =>
          (candidate.querySelector(":scope > span")?.textContent ?? "").trim() === caption,
      );
      const select = label?.querySelector("select") as HTMLSelectElement | null | undefined;
      if (!select) throw new Error(`no select captioned ${caption}`);
      return select.value;
    };
    return { facing: byCaption("Facing"), movement: byCaption("Movement direction") };
  });
}

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

function fighterPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 240,
        skills: ["brawling", "dodge", "one_handed_edged", "parry"].map((skillId) => ({
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          secondaryRanks: 9,
          skillId,
        })),
      },
    },
  };
}

/**
 * Forgejo #987. `/^Combat inspector — /` also matches `CombatRoundManagerPanel`'s phase-wide
 * heading — `Combat inspector — Round {n} · {step}`, naming no participant — which is the state
 * this precondition exists to exclude. The `Next participant` button it then clicks is rendered
 * only inside the participant arm and never carries `disabled`, so an absent control used to be
 * waited out to the test timeout instead of reported. The matcher now requires the
 * ` · Round <n> · ` that only follows a label, and every read and click carries its own timeout.
 */
const GM_INSPECTOR_PARTICIPANT_HEADING = /^Combat inspector — .+ · Round \d+ · /;
const GM_INSPECTOR_CONTROL_TIMEOUT_MS = 5_000;
/** The panel can take a beat to mount after a `goto`; its controls cannot. */
const GM_INSPECTOR_MOUNT_TIMEOUT_MS = 15_000;

async function selectGmInspectorParticipant(input: { label: string; page: Page }): Promise<void> {
  const heading = input.page.getByRole("heading", { name: GM_INSPECTOR_PARTICIPANT_HEADING });
  await expect(
    heading,
    "the GM inspector is on a participant, not on its phase-wide row",
  ).toBeVisible({ timeout: GM_INSPECTOR_MOUNT_TIMEOUT_MS });
  const seen: string[] = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await heading.innerText({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS });
    if (current.includes(input.label)) return;
    seen.push(current);
    await input.page
      .getByRole("button", { name: "Next participant" })
      .click({ timeout: GM_INSPECTOR_CONTROL_TIMEOUT_MS });
  }
  throw new Error(
    `The GM inspector never reached ${input.label}; it showed ${JSON.stringify(seen)}.`,
  );
}

/** The compact composition, asserted on whichever surface is passed in. */
async function assertCompactComposition(input: {
  label: string;
  page: Page;
}): Promise<PositionSectionMeasurement> {
  const { label, page } = input;
  const panel = page.locator('[data-glantri-capture="action-selector"]');

  if (CAPTURE_BASELINE) {
    // Before capture: the legacy two-fieldset presentation, which only the baseline file renders.
    const baseline = await measurePositionSection(page);
    await expect(panel).toHaveCount(1);
    expect(baseline.legends, `${label} baseline legends`).toEqual([
      "Relative position",
      "Movement and facing",
    ]);
    console.log(`#835 ${label} BEFORE: ${JSON.stringify(baseline)}`);
    await panel.screenshot({ path: `${CAPTURE_DIR}/${CAPTURE_PREFIX}-${label}-panel.png` });
    return baseline;
  }

  // ---- One compact section, and neither retired heading anywhere on the surface. ----
  await expect(page.getByRole("group", { name: "Position and movement" })).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Relative position" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Movement and facing" })).toHaveCount(0);
  const surfaceText = await page.evaluate(() => document.body.innerText);
  expect(surfaceText, `${label} surface still shows a retired heading`).not.toContain(
    "Relative position",
  );
  expect(surfaceText, `${label} surface still shows a retired heading`).not.toContain(
    "Movement and facing",
  );

  const group = page.getByRole("group", { name: "Position and movement" });
  for (const name of ["Movement direction", "Facing"]) {
    await expect(group.getByRole("combobox", { name }), `${label}: ${name}`).toHaveCount(1);
  }
  const addControl = group.getByRole("button", { name: "Add relative intention" });
  await expect(addControl).toHaveCount(1);
  expect(await addControl.innerText()).toBe("+");

  // ---- A declaration starts with no relative intention: the `+` row, then the final row. ----
  const empty = await measurePositionSection(page);
  console.log(`#835 ${label} no relative intention: ${JSON.stringify(empty)}`);
  expect(empty.sectionCount, `${label} section count`).toBe(1);
  expect(empty.legends, `${label} legends`).toEqual(["Position and movement"]);
  expect(empty.rows.length, `${label} rows: ${JSON.stringify(empty.rows)}`).toBe(2);
  expect(empty.rows[0]!.controls).toEqual([]);
  expect(empty.rows[0]!.hasAddControl).toBe(true);
  expect(empty.rows[1]!.controls).toEqual(["Movement direction", "Facing"]);
  expect(empty.visibleProse, `${label} visible prose with no relative intention`).toEqual([]);
  /*
   * The before capture measured the same state — a declaration with no relative intention — at
   * 261px of combined fieldset height on both surfaces, with two 32px paragraphs painting in it.
   * This is the one directly comparable number between the two runs.
   */
  expect(
    empty.sectionHeight,
    `${label} combined section height against the 261px two-fieldset before capture`,
  ).toBeLessThan(261);

  // ---- One relative row with intention + person + desired distance + the `+`. ----
  await addControl.click();
  await expect(group.getByRole("combobox", { name: "Intention" })).toHaveCount(1);
  for (const name of ["Intention", "Person", "Desired distance"]) {
    await expect(group.getByRole("combobox", { name }), `${label}: ${name}`).toHaveCount(1);
  }
  const single = await measurePositionSection(page);
  console.log(`#835 ${label} one relative intention: ${JSON.stringify(single)}`);
  expect(single.sectionCount, `${label} section count`).toBe(1);
  expect(single.legends, `${label} legends`).toEqual(["Position and movement"]);
  expect(single.rows.length, `${label} rows: ${JSON.stringify(single.rows)}`).toBe(2);
  expect(single.rows[0]!.controls, `${label} relative row`).toEqual([
    "Intention",
    "Person",
    "Desired distance",
  ]);
  expect(single.rows[0]!.hasAddControl, `${label} relative row carries the + control`).toBe(true);
  // The final row holds both direction dropdowns, in one row element rather than two sections.
  expect(single.rows[1]!.controls, `${label} final row`).toEqual(["Movement direction", "Facing"]);
  expect(single.rows[1]!.hasAddControl).toBe(false);
  expect(single.rows[1]!.top, `${label} final row is last`).toBeGreaterThan(single.rows[0]!.top);

  // ---- The explanatory paragraphs are gone from the painted layout. ----
  expect(single.descriptions.map((entry) => entry.text).sort(), `${label} descriptions`).toEqual(
    [FACING_DESCRIPTION, MOVEMENT_DIRECTION_DESCRIPTION].sort(),
  );
  for (const description of single.descriptions) {
    const context = `${label} description ${description.id}: ${JSON.stringify(description)}`;
    expect(description.paintedHeight, context).toBeLessThanOrEqual(1);
    expect(description.paintedWidth, context).toBeLessThanOrEqual(1);
    // Still in the accessibility tree: visually hidden, not removed.
    expect(description.display, context).not.toBe("none");
    expect(description.visibility, context).not.toBe("hidden");
  }
  expect(single.visibleProse, `${label} visible prose in the section`).toEqual([]);

  // ---- A second relative intention adds a second compact row. ----
  await addControl.click();
  await expect(group.getByRole("combobox", { name: "Intention" })).toHaveCount(2);
  const pair = await measurePositionSection(page);
  console.log(`#835 ${label} two relative intentions: ${JSON.stringify(pair)}`);
  expect(pair.sectionCount, `${label} still one section`).toBe(1);
  expect(pair.rows.length, `${label} rows: ${JSON.stringify(pair.rows)}`).toBe(3);
  expect(pair.rows[0]!.controls).toEqual(["Intention", "Person", "Desired distance"]);
  expect(pair.rows[1]!.controls).toEqual(["Intention", "Person", "Desired distance"]);
  expect(pair.rows[2]!.controls).toEqual(["Movement direction", "Facing"]);
  // Exactly one `+`, on the last relative row.
  expect(pair.rows.map((row) => row.hasAddControl)).toEqual([false, true, false]);
  expect(pair.visibleProse, `${label} visible prose with two rows`).toEqual([]);

  // Back to one, so the independence proof below runs on the ordinary single-intention surface.
  await group.getByRole("button", { name: "Remove" }).last().click();
  await expect(group.getByRole("combobox", { name: "Intention" })).toHaveCount(1);

  await panel.screenshot({ path: `${CAPTURE_DIR}/${CAPTURE_PREFIX}-${label}-panel.png` });
  return single;
}

/**
 * The #771 R2-8 distinction, demonstrated: two different values, both read back, and neither one
 * disturbed when the other changes.
 */
async function assertDirectionsAreSeparatelySettable(input: {
  label: string;
  page: Page;
}): Promise<void> {
  const { label, page } = input;
  const group = page.getByRole("group", { name: "Position and movement" });
  const movement = group.getByRole("combobox", { name: "Movement direction" });
  const facing = group.getByRole("combobox", { name: "Facing" });

  await movement.selectOption("forward_right");
  await facing.selectOption("backward_left");
  const distinct = await readDirectionPair(page);
  console.log(`#835 ${label} distinct pair: ${JSON.stringify(distinct)}`);
  expect(distinct, `${label} two different values must both hold`).toEqual({
    facing: "backward_left",
    movement: "forward_right",
  });

  // Changing movement direction does not move facing.
  await movement.selectOption("left");
  const afterMovement = await readDirectionPair(page);
  console.log(`#835 ${label} after movement change: ${JSON.stringify(afterMovement)}`);
  expect(afterMovement, `${label} facing followed movement direction`).toEqual({
    facing: "backward_left",
    movement: "left",
  });

  // Changing facing does not move movement direction.
  await facing.selectOption("right");
  const afterFacing = await readDirectionPair(page);
  console.log(`#835 ${label} after facing change: ${JSON.stringify(afterFacing)}`);
  expect(afterFacing, `${label} movement direction followed facing`).toEqual({
    facing: "right",
    movement: "left",
  });

  // And blanking one leaves the other exactly as it was.
  await movement.selectOption("");
  const afterBlank = await readDirectionPair(page);
  console.log(`#835 ${label} after blanking movement: ${JSON.stringify(afterBlank)}`);
  expect(afterBlank, `${label} blanking movement direction disturbed facing`).toEqual({
    facing: "right",
    movement: "",
  });
  await movement.selectOption("left");
}

test.describe("Position and movement composition (#835)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("renders one compact Position and movement section on the player and GM surfaces", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(CAPTURE_DIR, { recursive: true });
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    const characterId = `position-835-${suffix}`;
    const characterName = `Position Fighter ${suffix}`;
    const created = await playerContext.request.post(`${API_URL}/characters`, {
      data: fighterPayload(characterId, characterName),
    });
    expect(created.ok(), await created.text()).toBe(true);

    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 835 Position ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 835 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participant = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: playerUser.user.id },
    );
    await post(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
    );
    const targetName = `Position Target ${suffix}`;
    const target = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: targetName, snapshot: { displayName: targetName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const fighterCombatantId = `issue-835-fighter-${suffix}`;
    const targetCombatantId = `issue-835-target-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-835-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId,
              id: fighterCombatantId,
              label: characterName,
              participantType: "scenario",
              scenarioParticipantId: participant.participant.id,
            },
            {
              id: targetCombatantId,
              label: targetName,
              participantType: "scenario",
              scenarioParticipantId: target.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 835 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = encounter.encounter.id;
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
    // Round 1 opens with the Combat Experience check that gates the declaration controls.
    const combatRoundState = [fighterCombatantId, targetCombatantId].reduce(
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

    // ================= PLAYER SURFACE =================
    const playerPage = await playerContext.newPage();
    await playerPage.setViewportSize({ height: 900, width: 1440 });
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    const playerAction = playerPage.getByRole("combobox", { name: "Action" }).first();
    await expect(playerAction).toBeVisible();
    await playerAction.selectOption("move_only");

    const playerMeasurement = await assertCompactComposition({ label: "player", page: playerPage });
    expect(playerMeasurement.sectionHeight).toBeGreaterThan(0);

    if (!CAPTURE_BASELINE) {
      await assertDirectionsAreSeparatelySettable({ label: "player", page: playerPage });
    }

    // ================= GM SURFACE (imports the same panel) =================
    await gmPage.setViewportSize({ height: 900, width: 1440 });
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await selectGmInspectorParticipant({ label: characterName, page: gmPage });
    const gmAction = gmPage.getByRole("combobox", { name: "Action" }).first();
    await expect(gmAction).toBeVisible();
    await gmAction.selectOption("move_only");

    const gmMeasurement = await assertCompactComposition({ label: "gm", page: gmPage });
    expect(gmMeasurement.sectionHeight).toBeGreaterThan(0);
    if (!CAPTURE_BASELINE) {
      await assertDirectionsAreSeparatelySettable({ label: "gm", page: gmPage });

      /*
       * ---- The two distinct values survive the real declaration write path. ----
       * This runs last. Declaring moves the round on, and the GM inspector that embeds this same
       * panel is then no longer showing an open `select_actions` declaration, so the GM half of
       * the rendered evidence has to be taken before this point.
       */
      const declare = playerPage.getByRole("button", { name: "Declare action" }).first();
      await expect(declare).toBeEnabled();
      await declare.click();
      await expect(playerPage.getByText("Action declared.").first()).toBeVisible();
      const stored = await json<{ encounter: EncounterSession }>(
        await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      const storedJson = JSON.stringify(stored.encounter);
      console.log(
        `#835 stored declaration intent: ${JSON.stringify(
          storedJson.match(/"(movementDirection|facing)":"[a-z_]*"/g) ?? [],
        )}`,
      );
      expect(storedJson, "stored movement direction").toContain('"movementDirection":"left"');
      expect(storedJson, "stored facing").toContain('"facing":"right"');
    }

    console.log(
      `#835 captures: ${CAPTURE_DIR}/${CAPTURE_PREFIX}-player-panel.png, ${CAPTURE_DIR}/${CAPTURE_PREFIX}-gm-panel.png`,
    );
  });
});
