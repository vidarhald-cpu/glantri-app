import { expect, test, type APIResponse } from "@playwright/test";
import type { EncounterSession } from "@glantri/domain";
import { createCharacterForE2e } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

test.describe("Player Action composition", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("stacks active Combat above Skill Roll while GM inspection stays read-only", async ({
    browser,
    page,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const characterId = `action-composition-${suffix}`;
      await createCharacterForE2e({
        apiUrl: API_URL,
        id: characterId,
        name: "Action Explorer",
        request: playerContext.request,
      });
      const { campaign } = await json<{ campaign: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns`, {
          data: { name: `Action composition ${suffix}`, status: "active" },
        }),
      );
      await json(
        await page.request.post(`${API_URL}/campaigns/${campaign.id}/roster`, {
          data: { category: "pc", sourceId: characterId, sourceType: "character" },
        }),
      );
      const { scenario } = await json<{ scenario: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns/${campaign.id}/scenarios`, {
          data: { name: "Action scene", status: "live" },
        }),
      );
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
              id: `action-encounter-${suffix}`,
              kind: "combat",
              participantMembershipMode: "explicit",
              participants: [
                {
                  characterId,
                  id: `encounter-${participant.id}`,
                  label: "Action Explorer",
                  participantType: "scenario",
                  scenarioParticipantId: participant.id,
                },
              ],
              scenarioId: scenario.id,
              status: "draft",
              title: "Action combat",
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

      const actionHref = `/campaigns/${campaign.id}?tab=player-skill-rolls&scenarioId=${scenario.id}&encounterId=${encounter.id}`;
      await page.goto(actionHref);
      await expect(page.getByRole("heading", { name: /Player skill rolls/ })).toBeVisible();
      await expect(page.getByText("Combat history", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Skill roll grid" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Clear", exact: true })).toBeDisabled();

      const playerPage = await playerContext.newPage();
      await playerPage.goto(actionHref);
      const combatHistory = playerPage.getByText("Combat history", { exact: true });
      const skillRollGrid = playerPage.getByRole("heading", { name: "Skill roll grid" });
      await expect(combatHistory).toBeVisible();
      await expect(skillRollGrid).toBeVisible();
      expect((await combatHistory.boundingBox())!.y).toBeLessThan(
        (await skillRollGrid.boundingBox())!.y,
      );
      await expect
        .poll(() =>
          playerPage.evaluate(
            (campaignId) =>
              localStorage.getItem(`glantri.remembered-selection.workspace-tab:${campaignId}`),
            campaign.id,
          ),
        )
        .toBe("player-skill-rolls");
    } finally {
      await playerContext.close();
    }
  });
});
