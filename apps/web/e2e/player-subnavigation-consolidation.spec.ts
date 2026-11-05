import { expect, test, type APIResponse } from "@playwright/test";
import type { EncounterSession } from "@glantri/domain";
import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

/**
 * #787: the player active-play surface must expose one contextual sub-navigation
 * row, with one Map entry and one Blackboard entry, and must lose no route.
 *
 * Every rendered read happens inside ONE `page.evaluate`: the Combat page
 * autoscrolls after mount, so reads split across awaits straddle the scroll.
 */
test.describe("Player active-play sub-navigation", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("renders one contextual nav row with one Map and one Blackboard entry", async ({
    browser,
    page,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const characterId = `subnav-787-${suffix}`;
      await createCharacterForE2e({
        apiUrl: API_URL,
        id: characterId,
        name: "Subnav Explorer",
        request: playerContext.request,
      });
      const { campaign } = await json<{ campaign: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns`, {
          data: { name: `Player sub-navigation ${suffix}`, status: "active" },
        }),
      );
      await json(
        await page.request.post(`${API_URL}/campaigns/${campaign.id}/roster`, {
          data: { category: "pc", sourceId: characterId, sourceType: "character" },
        }),
      );
      const { scenario } = await json<{ scenario: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns/${campaign.id}/scenarios`, {
          data: { name: "Subnav scene", status: "live" },
        }),
      );
      // #786 keeps a NULL `controlledByUserId` participant out of the Encounter
      // surface entirely. The healthy state this issue is characterized against
      // binds the participant to the player's own user id.
      const { participant } = await json<{ participant: { id: string } }>(
        await page.request.post(`${API_URL}/scenarios/${scenario.id}/participants/character`, {
          data: { characterId, controlledByUserId: player.user.id },
        }),
      );
      const { encounter } = await json<{ encounter: EncounterSession }>(
        await page.request.post(`${API_URL}/scenarios/${scenario.id}/encounters`, {
          data: {
            session: {
              campaignId: campaign.id,
              createdAt: new Date().toISOString(),
              id: `subnav-encounter-${suffix}`,
              kind: "combat",
              participantMembershipMode: "explicit",
              participants: [
                {
                  characterId,
                  id: `encounter-${participant.id}`,
                  label: "Subnav Explorer",
                  participantType: "scenario",
                  scenarioParticipantId: participant.id,
                },
              ],
              scenarioId: scenario.id,
              status: "draft",
              title: "Subnav combat",
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      );
      await json(
        await page.request.patch(`${API_URL}/encounters/${encounter.id}/status`, {
          data: { expectedRevision: encounter.updatedAt, status: "active" },
        }),
      );

      const playerPage = await playerContext.newPage();
      await playerPage.goto(
        `/campaigns/${campaign.id}?tab=scenario&scenarioId=${scenario.id}&encounterId=${encounter.id}`,
      );
      await expect(playerPage.getByRole("navigation", { name: "Play views" })).toBeVisible();

      // One atomic read of the whole rendered navigation state.
      const rendered = await playerPage.evaluate(() => {
        const label = (element: Element) =>
          element.getAttribute("aria-label") ?? element.getAttribute("aria-labelledby") ?? "";
        const navs = Array.from(document.querySelectorAll("nav")).map((nav) => ({
          label: label(nav),
          links: Array.from(nav.querySelectorAll("a")).map((anchor) => ({
            current: anchor.getAttribute("aria-current") === "page",
            href: anchor.getAttribute("href") ?? "",
            text: (anchor.textContent ?? "").trim(),
          })),
        }));
        const allLinks = Array.from(document.querySelectorAll("a")).map((anchor) => ({
          href: anchor.getAttribute("href") ?? "",
          text: (anchor.textContent ?? "").trim(),
        }));
        return {
          allLinks,
          mapEntries: allLinks.filter((link) => /^Maps?$/.test(link.text)).length,
          blackboardEntries: allLinks.filter((link) => link.text === "Blackboard").length,
          navLabels: navs.map((nav) => nav.label),
          navs,
          scrollY: window.scrollY,
        };
      });

      // Recorded inventory for the issue evidence.
      console.log(`#787 INVENTORY ${JSON.stringify(rendered, null, 2)}`);

      // Counts, not presence: a duplicate-removal check that only asserts
      // "Map exists" passes on the unrepaired baseline too.
      expect(rendered.mapEntries).toBe(1);
      expect(rendered.blackboardEntries).toBe(1);

      // Exactly one navigation level above the content (#849): the Play views
      // row. The unlabelled row is the global application nav outside this
      // surface. #787 left a Campaign row and a Scenario/Encounter breadcrumb
      // above it; both repeated names the row and the app navigation carry.
      expect(rendered.navLabels.filter((label) => label !== "")).toEqual(["Play views"]);
      expect(rendered.navLabels.filter((label) => label === "Retained Play entry points")).toEqual(
        [],
      );

      const playViews = rendered.navs.find((nav) => nav.label === "Play views");
      expect(playViews?.links.map((link) => link.text)).toEqual([
        "Situation",
        // #848 renamed this row entry from `Action` to the name of the
        // destination it already carried.
        "Skill rolls",
        "Map",
        "Blackboard",
        "Character",
        "Combat",
      ]);

      // No capability lost: every Play route is still reachable from this row.
      const base = `/campaigns/${campaign.id}`;
      const context = `scenarioId=${scenario.id}&encounterId=${encounter.id}`;
      expect(playViews?.links.map((link) => link.href)).toEqual([
        `${base}?tab=scenario&${context}`,
        `${base}?tab=player-skill-rolls&${context}`,
        `${base}?tab=maps&${context}`,
        `${base}?tab=blackboard&${context}`,
        `${base}?tab=character&${context}`,
        `${base}?tab=player-combat&${context}`,
      ]);
    } finally {
      await playerContext.close();
    }
  });
});
