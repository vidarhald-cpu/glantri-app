import { expect, test, type APIResponse } from "@playwright/test";
import type { EncounterSession } from "@glantri/domain";
import { createCharacterForE2e } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

test.describe("Search assignment revision", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("preserves the loaded token through UI assignment and rejects a stale write", async ({
    browser,
    page,
  }, testInfo) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const characterId = `search-revision-${suffix}`;
      await createCharacterForE2e({
        apiUrl: API_URL,
        id: characterId,
        name: "Search Explorer",
        request: playerContext.request,
      });
      const { campaign } = await json<{ campaign: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns`, {
          data: { name: `Search revision ${suffix}`, status: "active" },
        }),
      );
      await json(
        await page.request.post(`${API_URL}/campaigns/${campaign.id}/roster`, {
          data: { category: "pc", sourceId: characterId, sourceType: "character" },
        }),
      );
      const { scenario } = await json<{ scenario: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns/${campaign.id}/scenarios`, {
          data: { name: "Search revision", status: "live" },
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
              id: `search-encounter-${suffix}`,
              kind: "roleplay",
              participantMembershipMode: "explicit",
              participants: [
                {
                  characterId,
                  id: `scenario-${participant.id}`,
                  label: "Search Explorer",
                  participantType: "scenario",
                  scenarioParticipantId: participant.id,
                },
              ],
              scenarioId: scenario.id,
              status: "draft",
              title: "Search room",
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      );
      const endpoint = `${API_URL}/encounters/${encounter.id}`;
      const { encounter: current } = await json<{ encounter: EncounterSession }>(
        await page.request.patch(`${endpoint}/status`, {
          data: { expectedRevision: encounter.updatedAt, status: "active" },
        }),
      );
      const contextQuery = `&scenarioId=${scenario.id}&encounterId=${encounter.id}`;
      await page.goto(`/campaigns/${campaign.id}?tab=skill-rolls${contextQuery}`);
      await page.getByLabel("Roleplay roll 1 skill", { exact: true }).selectOption("search");
      await page.getByLabel("Roleplay roll 1 difficulty", { exact: true }).selectOption("medium");
      const assignmentResponse = page.waitForResponse(
        (response) => response.url() === endpoint && response.request().method() === "PUT",
      );
      await page.getByRole("button", { name: "Assign", exact: true }).click();
      const assignedResponse = await assignmentResponse;
      // A current-state 409 fails immediately; this test never retries assignment.
      expect(assignedResponse.status(), await assignedResponse.text()).toBe(200);
      const submitted = assignedResponse.request().postDataJSON();
      expect(submitted.expectedRevision).toBe(current.updatedAt);
      expect(submitted.session.updatedAt).not.toBe(current.updatedAt);
      const { encounter: assigned } = (await assignedResponse.json()) as {
        encounter: EncounterSession;
      };
      const pending = assigned.roleplayState?.pendingSkillRolls.find(
        (roll) => roll.skillId === "search",
      );
      expect(pending).toBeTruthy();

      const playerPage = await playerContext.newPage();
      await playerPage.goto(`/campaigns/${campaign.id}?tab=player-skill-rolls${contextQuery}`);
      await expect(playerPage.getByText("Assigned roll 1", { exact: false })).toBeVisible();
      await expect(
        playerPage.getByRole("button", { name: "Roll 1d20", exact: true }),
      ).toBeVisible();
      const playerPayload = await json<{ encounter: EncounterSession }>(
        await playerContext.request.get(endpoint),
      );
      expect(
        playerPayload.encounter.roleplayState?.pendingSkillRolls.some(
          (roll) => roll.id === pending!.id,
        ),
      ).toBe(true);
      expect(JSON.stringify(playerPayload)).not.toContain('"gmPrivateClosingNote"');
      await playerPage.reload();
      await expect(playerPage.getByText("Assigned roll 1", { exact: false })).toBeVisible();

      const beforeStale = await json<{ encounter: EncounterSession }>(
        await page.request.get(endpoint),
      );
      const staleResponse = await page.request.put(endpoint, {
        data: {
          expectedRevision: current.updatedAt,
          session: { ...assigned, title: "STALE WRITE MUST NOT PERSIST" },
        },
      });
      expect(staleResponse.status()).toBe(409);
      const afterStale = await json<{ encounter: EncounterSession }>(
        await page.request.get(endpoint),
      );
      expect(afterStale).toEqual(beforeStale);

      const playerRollResponse = playerPage.waitForResponse(
        (response) =>
          response.url() === `${endpoint}/player-roll` && response.request().method() === "POST",
      );
      await playerPage.getByRole("button", { name: "Roll 1d20", exact: true }).click();
      const rolled = await playerRollResponse;
      expect(rolled.status(), await rolled.text()).toBe(200);
      await testInfo.attach("revision-evidence", {
        body: JSON.stringify(
          {
            encounterId: encounter.id,
            originalRevision: current.updatedAt,
            submittedRevision: submitted.expectedRevision,
            localTransitionTimestamp: submitted.session.updatedAt,
            assignmentStatus: assignedResponse.status(),
            pendingRollId: pending!.id,
            playerReceivedAssignment: true,
            staleStatus: staleResponse.status(),
            staleStoredStateUnchanged: true,
            playerRollStatus: rolled.status(),
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } finally {
      await playerContext.close();
    }
  });
});
