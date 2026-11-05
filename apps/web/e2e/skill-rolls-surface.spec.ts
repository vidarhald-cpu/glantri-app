import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import type { EncounterSession } from "@glantri/domain";
import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

/**
 * #848 — `Skill rolls` is a reachable player surface that an active Combat
 * Encounter does not take over.
 *
 * This file replaces `action-composition.spec.ts`, which asserted the opposite:
 * that the row entry then labelled `Action` stacked the player Combat surface
 * ABOVE the Skill roll grid whenever the Scenario was live and its Encounter
 * active. That mount is the mover the Product Owner saw as "a brief Skill-roll
 * render followed by a Combat redirect": the URL never changed, so what moved
 * the player was composition rather than routing.
 *
 * ## Why the assertion is held open rather than taken once
 *
 * The takeover is not visible on the first paint. The shell mounted the Combat
 * child immediately, but that child returns `null` until its own projection
 * shows an active combat Encounter whose round has a current step, so a click
 * followed by an immediate assertion passes against the unrepaired baseline.
 *
 * The hold window is therefore *measured* rather than guessed: the same player
 * first opens `?tab=player-combat` and the time until the Combat surface renders
 * is recorded. The Skill rolls assertion is then held for at least three times
 * that latency (and never less than six seconds), which is the interval in which
 * the baseline's takeover demonstrably arrives.
 */

const COMBAT_SURFACE_MARKER = "Combat history";
const SKILL_ROLL_SURFACE_MARKER = "Skill roll grid";

function playViews(page: Page) {
  return page.getByRole("navigation", { name: "Play views" });
}

/**
 * Holds a negative rendered assertion open for `holdMs`, re-reading the live
 * page rather than trusting one sample. It throws on the first sample in which
 * the Combat surface appears or the tab leaves `player-skill-rolls`.
 */
async function assertStaysOnSkillRolls(input: { holdMs: number; page: Page; where: string }) {
  const deadline = Date.now() + input.holdMs;
  let samples = 0;

  while (Date.now() < deadline) {
    const reading = await input.page.evaluate((combatMarker) => {
      const texts = Array.from(document.querySelectorAll("*"))
        .filter((element) => element.children.length === 0)
        .map((element) => (element.textContent ?? "").trim());
      return {
        combatMarkers: texts.filter((text) => text === combatMarker).length,
        tab: new URL(window.location.href).searchParams.get("tab"),
        url: window.location.href,
      };
    }, COMBAT_SURFACE_MARKER);

    samples += 1;
    expect(
      reading.combatMarkers,
      `${input.where}: the Combat surface appeared on Skill rolls at sample ${samples} (${reading.url})`,
    ).toBe(0);
    expect(
      reading.tab,
      `${input.where}: the tab left player-skill-rolls at sample ${samples} (${reading.url})`,
    ).toBe("player-skill-rolls");

    await input.page.waitForTimeout(250);
  }

  await expect(
    input.page.getByRole("heading", { name: SKILL_ROLL_SURFACE_MARKER }),
    `${input.where}: the Skill roll grid must still be rendered after the hold`,
  ).toBeVisible();
  console.log(`#848 HELD ${input.where}: ${samples} samples over ${input.holdMs}ms`);
}

interface SkillRollsFixture {
  campaignId: string;
  encounterId: string;
  scenarioId: string;
}

async function createActiveCombatFixture(input: {
  page: Page;
  playerRequest: APIRequestContext;
  playerUserId: string;
  suffix: number;
}): Promise<SkillRollsFixture> {
  const characterId = `skill-rolls-848-${input.suffix}`;
  await createCharacterForE2e({
    apiUrl: API_URL,
    id: characterId,
    name: "Skill Roll Explorer",
    request: input.playerRequest,
  });
  const { campaign } = await json<{ campaign: { id: string } }>(
    await input.page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Skill rolls surface ${input.suffix}`, status: "active" },
    }),
  );
  await json(
    await input.page.request.post(`${API_URL}/campaigns/${campaign.id}/roster`, {
      data: { category: "pc", sourceId: characterId, sourceType: "character" },
    }),
  );
  const { scenario } = await json<{ scenario: { id: string } }>(
    await input.page.request.post(`${API_URL}/campaigns/${campaign.id}/scenarios`, {
      data: { name: "Skill rolls scene", status: "live" },
    }),
  );
  // A NULL `controlledByUserId` participant is kept out of the Encounter surface
  // entirely (#786), so the fixture binds the participant to the player's user.
  const { participant } = await json<{ participant: { id: string } }>(
    await input.page.request.post(`${API_URL}/scenarios/${scenario.id}/participants/character`, {
      data: { characterId, controlledByUserId: input.playerUserId },
    }),
  );
  const { encounter } = await json<{ encounter: EncounterSession }>(
    await input.page.request.post(`${API_URL}/scenarios/${scenario.id}/encounters`, {
      data: {
        session: {
          campaignId: campaign.id,
          createdAt: new Date().toISOString(),
          id: `skill-rolls-encounter-${input.suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId,
              id: `encounter-${participant.id}`,
              label: "Skill Roll Explorer",
              participantType: "scenario",
              scenarioParticipantId: participant.id,
            },
          ],
          scenarioId: scenario.id,
          status: "draft",
          title: "Skill rolls combat",
          updatedAt: new Date().toISOString(),
        },
      },
    }),
  );
  // Encounter create stores a draft; activation is a separate status PATCH.
  await json(
    await input.page.request.patch(`${API_URL}/encounters/${encounter.id}/status`, {
      data: { expectedRevision: encounter.updatedAt, status: "active" },
    }),
  );

  return { campaignId: campaign.id, encounterId: encounter.id, scenarioId: scenario.id };
}

/**
 * Opens the player's own Combat surface and returns how long it took to render.
 * That latency is the only honest bound for the Skill rolls hold window: it is
 * the interval in which the unrepaired baseline's takeover arrives.
 */
async function measureCombatRenderLatency(input: {
  fixture: SkillRollsFixture;
  page: Page;
}): Promise<number> {
  const { campaignId, encounterId, scenarioId } = input.fixture;
  await input.page.goto(
    `/campaigns/${campaignId}?tab=player-combat&scenarioId=${scenarioId}&encounterId=${encounterId}`,
  );
  const startedAt = Date.now();
  await expect(input.page.getByText(COMBAT_SURFACE_MARKER, { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
  const latency = Date.now() - startedAt;
  console.log(`#848 COMBAT RENDER LATENCY ${latency}ms`);
  return latency;
}

test.describe("Player Skill rolls surface", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("names the row entry Skill rolls and stays on it while Combat is active", async ({
    browser,
    page,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const fixture = await createActiveCombatFixture({
        page,
        playerRequest: playerContext.request,
        playerUserId: player.user.id,
        suffix,
      });
      const { campaignId, encounterId, scenarioId } = fixture;
      const playerPage = await playerContext.newPage();
      const situationHref = `/campaigns/${campaignId}?tab=scenario&scenarioId=${scenarioId}&encounterId=${encounterId}`;

      // Acceptance 2: `Action` is gone from the player row and `Skill rolls` is
      // in it, in the position that entry occupied.
      await playerPage.goto(situationHref);
      await expect(playViews(playerPage)).toBeVisible();
      const rowLabels = await playViews(playerPage)
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => (link.textContent ?? "").trim()));
      console.log(`#848 PLAY ROW ${JSON.stringify(rowLabels)}`);
      expect(rowLabels).toEqual([
        "Situation",
        "Skill rolls",
        "Map",
        "Blackboard",
        "Character",
        "Combat",
      ]);
      expect(rowLabels).not.toContain("Action");
      expect(rowLabels).not.toContain("Player combat");

      // The measured bound for the hold window below.
      const combatLatency = await measureCombatRenderLatency({ fixture, page: playerPage });
      const holdMs = Math.max(6_000, combatLatency * 3);

      // Acceptance 1: the player opens `Skill rolls` by that name and remains on
      // it with the Combat Encounter active.
      await playerPage.goto(situationHref);
      await playViews(playerPage).getByRole("link", { name: "Skill rolls" }).click();
      await playerPage.waitForURL(/tab=player-skill-rolls/);
      await expect(
        playerPage.getByRole("heading", { name: SKILL_ROLL_SURFACE_MARKER }),
      ).toBeVisible();
      await assertStaysOnSkillRolls({
        holdMs,
        page: playerPage,
        where: "clicked the Skill rolls row entry",
      });

      // Acceptance 4: no player capability is lost — Combat keeps its own entry
      // in the same row and still opens the active Combat.
      await playViews(playerPage).getByRole("link", { name: "Combat", exact: true }).click();
      await playerPage.waitForURL(/tab=player-combat/);
      await expect(
        playerPage.getByText(COMBAT_SURFACE_MARKER, { exact: true }).first(),
      ).toBeVisible({ timeout: 60_000 });
    } finally {
      await playerContext.close();
    }
  });

  test("stays on the Skill rolls route reached directly with Combat active", async ({
    browser,
    page,
  }) => {
    const suffix = Date.now() + 1;
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const fixture = await createActiveCombatFixture({
        page,
        playerRequest: playerContext.request,
        playerUserId: player.user.id,
        suffix,
      });
      const { campaignId, encounterId, scenarioId } = fixture;
      const playerPage = await playerContext.newPage();

      /*
       * Label-independent on purpose. The repair has two halves on one registry
       * row, and this half must be attributable on its own: this test never
       * reads the row's label, so a baseline failure here is the takeover and
       * nothing else.
       */
      const combatLatency = await measureCombatRenderLatency({ fixture, page: playerPage });
      const holdMs = Math.max(6_000, combatLatency * 3);

      await playerPage.goto(
        `/campaigns/${campaignId}?tab=player-skill-rolls&scenarioId=${scenarioId}&encounterId=${encounterId}`,
      );
      await expect(
        playerPage.getByRole("heading", { name: SKILL_ROLL_SURFACE_MARKER }),
      ).toBeVisible();
      await assertStaysOnSkillRolls({
        holdMs,
        page: playerPage,
        where: "opened ?tab=player-skill-rolls directly",
      });

      // A reload must not move the player either.
      await playerPage.reload();
      await expect(
        playerPage.getByRole("heading", { name: SKILL_ROLL_SURFACE_MARKER }),
      ).toBeVisible();
      await assertStaysOnSkillRolls({
        holdMs,
        page: playerPage,
        where: "reloaded ?tab=player-skill-rolls",
      });
    } finally {
      await playerContext.close();
    }
  });

  test("keeps every other destination in the player row opening", async ({ browser, page }) => {
    const suffix = Date.now() + 2;
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const { campaignId, encounterId, scenarioId } = await createActiveCombatFixture({
        page,
        playerRequest: playerContext.request,
        playerUserId: player.user.id,
        suffix,
      });
      const playerPage = await playerContext.newPage();
      const start = `/campaigns/${campaignId}?tab=scenario&scenarioId=${scenarioId}&encounterId=${encounterId}`;

      // Acceptance 3: Situation, Map, Blackboard, Character and the Combat entry
      // all still open. #849 renamed the Combat entry from `Player combat`.
      for (const [label, tab] of [
        ["Situation", "scenario"],
        ["Skill rolls", "player-skill-rolls"],
        ["Map", "maps"],
        ["Blackboard", "blackboard"],
        ["Character", "character"],
        ["Combat", "player-combat"],
      ] as const) {
        await playerPage.goto(start);
        await expect(playViews(playerPage)).toBeVisible();
        await playViews(playerPage).getByRole("link", { name: label, exact: true }).click();
        await playerPage.waitForURL(new RegExp(`tab=${tab}(&|$)`));
        await expect(
          playViews(playerPage).getByRole("link", { name: label, exact: true }),
          `${label} must be the current Play view after opening it`,
        ).toHaveAttribute("aria-current", "page");
        console.log(`#848 OPENED ${label} -> ${new URL(playerPage.url()).search}`);
      }
    } finally {
      await playerContext.close();
    }
  });
});
