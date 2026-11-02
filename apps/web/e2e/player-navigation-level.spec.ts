import { expect, test, type APIResponse, type Page } from "@playwright/test";
import type { EncounterSession } from "@glantri/domain";
import { createCharacterForE2e } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

const COMBAT_SURFACE_MARKER = "Combat history";
const SKILL_ROLL_SURFACE_MARKER = "Skill roll grid";

/**
 * #849: one player play-navigation level, a Campaign landing that carries the
 * former Campaign Home content, and a row entry named `Combat`.
 *
 * Every geometry read is ONE `page.evaluate`: the Combat page autoscrolls after
 * mount, and `boundingBox()` is viewport-relative, so reads split across awaits
 * straddle the scroll.
 */
test.describe("Player play-navigation level", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  async function createFixture(input: {
    browser: import("@playwright/test").Browser;
    gmPage: Page;
  }) {
    const suffix = Date.now();
    // A fresh player who belongs to exactly one Campaign: the product's own case
    // ("A player belongs to one Campaign"). The shared `player.json` user is in
    // many Campaigns after other specs, which would keep the multi-Campaign list.
    const playerContext = await input.browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const registered = await json<{ user: { id: string } }>(
      await playerContext.request.post(`${API_URL}/auth/register`, {
        data: {
          displayName: "Navigation Player",
          email: `nav-849-${suffix}@test.local`,
          password: "navtest12345",
        },
      }),
    );
    const characterId = `nav-849-${suffix}`;
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterId,
      name: "Brenna Ashford",
      request: playerContext.request,
    });
    const { campaign } = await json<{ campaign: { id: string } }>(
      await input.gmPage.request.post(`${API_URL}/campaigns`, {
        data: {
          description: "A tense week at court.",
          name: `Nav level ${suffix}`,
          status: "active",
        },
      }),
    );
    await json(
      await input.gmPage.request.post(`${API_URL}/campaigns/${campaign.id}/roster`, {
        data: { category: "pc", sourceId: characterId, sourceType: "character" },
      }),
    );
    const { scenario } = await json<{ scenario: { id: string } }>(
      await input.gmPage.request.post(`${API_URL}/campaigns/${campaign.id}/scenarios`, {
        data: { name: "today", status: "live" },
      }),
    );
    const { participant } = await json<{ participant: { id: string } }>(
      await input.gmPage.request.post(
        `${API_URL}/scenarios/${scenario.id}/participants/character`,
        { data: { characterId, controlledByUserId: registered.user.id } },
      ),
    );
    const { encounter } = await json<{ encounter: EncounterSession }>(
      await input.gmPage.request.post(`${API_URL}/scenarios/${scenario.id}/encounters`, {
        data: {
          session: {
            campaignId: campaign.id,
            createdAt: new Date().toISOString(),
            id: `nav-849-encounter-${suffix}`,
            kind: "combat",
            participantMembershipMode: "explicit",
            participants: [
              {
                characterId,
                id: `encounter-${participant.id}`,
                label: "Brenna Ashford",
                participantType: "scenario",
                scenarioParticipantId: participant.id,
              },
            ],
            scenarioId: scenario.id,
            status: "draft",
            title: "yet another test",
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    await json(
      await input.gmPage.request.patch(`${API_URL}/encounters/${encounter.id}/status`, {
        data: { expectedRevision: encounter.updatedAt, status: "active" },
      }),
    );
    return {
      campaignId: campaign.id,
      encounterId: encounter.id,
      playerContext,
      scenarioId: scenario.id,
    };
  }

  test("Campaigns opens the landing, which carries Your character, the Current scenario and Continue combat", async ({
    browser,
    page,
  }) => {
    const fixture = await createFixture({ browser, gmPage: page });
    try {
      const playerPage = await fixture.playerContext.newPage();
      const landing = `/campaigns/${fixture.campaignId}?tab=campaign`;
      const combat = `/campaigns/${fixture.campaignId}?tab=player-combat&scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}`;

      await playerPage.goto("/campaigns");
      await expect(playerPage).toHaveURL(new RegExp(`${landing.replace("?", "\\?")}`), {
        timeout: 15_000,
      });

      // The folded Campaign Home content, on the Campaign landing.
      await expect(playerPage.getByText("Your character", { exact: true })).toBeVisible();
      await expect(playerPage.getByText("Brenna Ashford", { exact: true })).toBeVisible();
      const currentScenario = playerPage.getByRole("region", {
        name: "Current Scenario and Encounter",
      });
      await expect(currentScenario.getByText("today", { exact: true })).toBeVisible();
      await expect(currentScenario.getByText("Playing as Brenna Ashford")).toBeVisible();
      await expect(currentScenario.getByText("yet another test")).toBeVisible();
      const resume = playerPage.getByRole("link", { name: "Continue combat" });
      await expect(resume).toHaveAttribute("href", combat);
      // No second player Campaign concept: the standalone page's name is gone.
      await expect(playerPage.getByRole("heading", { name: "Campaign Home" })).toHaveCount(0);

      // `Continue combat` opens the active Combat.
      await resume.click();
      await playerPage.waitForURL(/tab=player-combat/);
      await expect(
        playerPage.getByText(COMBAT_SURFACE_MARKER, { exact: true }).first(),
      ).toBeVisible({ timeout: 60_000 });

      // From inside play, `Campaigns` in the application navigation returns to
      // the landing: it is the way back now that the in-shell Campaign row is gone.
      await playerPage.getByRole("link", { name: "Campaigns", exact: true }).click();
      await expect(playerPage).toHaveURL(new RegExp(`${landing.replace("?", "\\?")}`), {
        timeout: 15_000,
      });
      await expect(playerPage.getByText("Your character", { exact: true })).toBeVisible();
    } finally {
      await fixture.playerContext.close();
    }
  });

  test("renders one navigation level, opens every row destination, and keeps Skill rolls and Combat apart", async ({
    browser,
    page,
  }, testInfo) => {
    const fixture = await createFixture({ browser, gmPage: page });
    try {
      const playerPage = await fixture.playerContext.newPage();
      const context = `scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}`;
      const start = `/campaigns/${fixture.campaignId}?tab=scenario&${context}`;

      for (const width of [1280, 390]) {
        await playerPage.setViewportSize({ height: 900, width });
        await playerPage.goto(start);
        await expect(playerPage.getByRole("navigation", { name: "Play views" })).toBeVisible();

        const rendered = await playerPage.evaluate(() => {
          const scrollY = window.scrollY;
          const labelled = Array.from(document.querySelectorAll("nav, section[aria-label]"))
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom + scrollY,
                label: element.getAttribute("aria-label") ?? "",
                left: rect.left,
                right: rect.right,
                top: rect.top + scrollY,
              };
            })
            .filter((entry) =>
              [
                "Campaign navigation",
                "Campaign tasks",
                "Related Campaign tools",
                "Scenario and Encounter context",
                "Play header",
                "Play views",
              ].includes(entry.label),
            );
          const header = document.querySelector('section[aria-label="Play header"]');
          const row = document.querySelector('nav[aria-label="Play views"]');
          const visualLines = new Set<number>();
          for (const element of Array.from(
            (header?.parentElement ?? document.body).querySelectorAll("a, strong, span"),
          )) {
            const rect = element.getBoundingClientRect();
            if (rect.height > 0) visualLines.add(Math.round((rect.top + scrollY) / 6));
          }
          return {
            contextLinks: header ? header.querySelectorAll("a").length : -1,
            innerWidth: window.innerWidth,
            labelled,
            rowText: Array.from(row?.querySelectorAll("a") ?? []).map((a) =>
              (a.textContent ?? "").trim(),
            ),
            sameParent: Boolean(header && row && header.parentElement === row.parentElement),
            scrollWidth: document.documentElement.scrollWidth,
            stackBottom: Math.max(...labelled.map((entry) => entry.bottom)),
            stackTop: Math.min(...labelled.map((entry) => entry.top)),
            visualLines: visualLines.size,
          };
        });
        console.log(`#849 GEOMETRY ${width} ${JSON.stringify(rendered)}`);
        await testInfo.attach(`play-navigation-${width}.png`, {
          body: await playerPage.screenshot(),
          contentType: "image/png",
        });

        // One navigation level: no Campaign row, no breadcrumb, one labelled
        // `nav` (the Play views row) plus the link-free compact context.
        expect(rendered.labelled.map((entry) => entry.label).sort()).toEqual([
          "Play header",
          "Play views",
        ]);
        expect(rendered.contextLinks).toBe(0);
        expect(rendered.sameParent).toBe(true);
        expect(rendered.rowText).toEqual([
          "Situation",
          "Skill rolls",
          "Map",
          "Blackboard",
          "Character",
          "Combat",
        ]);
        if (width === 1280) {
          // Four stacked strips measured 142px tall and four lines high at this
          // width on `dev` 847fb53a; the one row is a single line.
          expect(rendered.visualLines).toBe(1);
          expect(rendered.stackBottom - rendered.stackTop).toBeLessThan(40);
        } else {
          expect(rendered.stackBottom - rendered.stackTop).toBeLessThan(100);
        }
        // The row stays inside the viewport.
        for (const entry of rendered.labelled) {
          expect(entry.right).toBeLessThanOrEqual(rendered.innerWidth);
          expect(entry.left).toBeGreaterThanOrEqual(0);
        }
      }

      // Every row destination opens, and is the current entry once open.
      await playerPage.setViewportSize({ height: 900, width: 1280 });
      for (const [label, tab] of [
        ["Situation", "scenario"],
        ["Skill rolls", "player-skill-rolls"],
        ["Map", "maps"],
        ["Blackboard", "blackboard"],
        ["Character", "character"],
        ["Combat", "player-combat"],
      ] as const) {
        await playerPage.goto(start);
        const row = playerPage.getByRole("navigation", { name: "Play views" });
        await expect(row).toBeVisible();
        await row.getByRole("link", { name: label, exact: true }).click();
        await playerPage.waitForURL(new RegExp(`tab=${tab}(&|$)`));
        await expect(row.getByRole("link", { name: label, exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
        if (tab === "player-combat") {
          // `Combat` opens the active Combat.
          await expect(
            playerPage.getByText(COMBAT_SURFACE_MARKER, { exact: true }).first(),
          ).toBeVisible({ timeout: 60_000 });
        }
        if (tab === "player-skill-rolls") {
          await expect(
            playerPage.getByRole("heading", { name: SKILL_ROLL_SURFACE_MARKER }),
          ).toBeVisible();
        }
      }

      // #848 must not regress: with the Combat active, `Skill rolls` stays the
      // roleplaying surface and Combat never takes it over.
      await playerPage.goto(start);
      await playerPage
        .getByRole("navigation", { name: "Play views" })
        .getByRole("link", { name: "Skill rolls", exact: true })
        .click();
      await playerPage.waitForURL(/tab=player-skill-rolls/);
      const deadline = Date.now() + 6_000;
      while (Date.now() < deadline) {
        const reading = await playerPage.evaluate((marker) => {
          const texts = Array.from(document.querySelectorAll("*"))
            .filter((element) => element.children.length === 0)
            .map((element) => (element.textContent ?? "").trim());
          return {
            combatMarkers: texts.filter((text) => text === marker).length,
            tab: new URL(window.location.href).searchParams.get("tab"),
          };
        }, COMBAT_SURFACE_MARKER);
        expect(reading.combatMarkers).toBe(0);
        expect(reading.tab).toBe("player-skill-rolls");
        await playerPage.waitForTimeout(250);
      }
      await expect(
        playerPage.getByRole("heading", { name: SKILL_ROLL_SURFACE_MARKER }),
      ).toBeVisible();
    } finally {
      await fixture.playerContext.close();
    }
  });

  test("leaves the GM's navigation rows unchanged", async ({ browser, page }, testInfo) => {
    const fixture = await createFixture({ browser, gmPage: page });
    try {
      await page.goto(
        `/campaigns/${fixture.campaignId}?tab=scenario&scenarioId=${fixture.scenarioId}&encounterId=${fixture.encounterId}`,
      );
      await expect(
        page.getByRole("navigation", { name: "Scenario and Encounter tools" }),
      ).toBeVisible();

      const rendered = await page.evaluate(() => ({
        navs: Array.from(document.querySelectorAll("nav"))
          .map((nav) => ({
            label: nav.getAttribute("aria-label") ?? "",
            links: Array.from(nav.querySelectorAll("a")).map((a) => (a.textContent ?? "").trim()),
          }))
          .filter((nav) => nav.label !== ""),
      }));
      await testInfo.attach("gm-navigation.png", {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      expect(rendered.navs.map((nav) => nav.label)).toEqual([
        "Campaign tasks",
        "Related Campaign tools",
        "Scenario and Encounter context",
        "Scenario and Encounter tools",
      ]);
      expect(
        rendered.navs.find((nav) => nav.label === "Scenario and Encounter tools")?.links,
      ).toEqual(["Scenario", "Encounter", "Character", "Skill rolls", "Combat", "Player combat"]);
      expect(rendered.navs.find((nav) => nav.label === "Campaign tasks")?.links).toEqual([
        "Campaigns",
        "Campaign home",
        "Membership",
        "Scenarios",
        "Campaign history",
        "Create material",
        "Notes & material",
      ]);
    } finally {
      await fixture.playerContext.close();
    }
  });
});
