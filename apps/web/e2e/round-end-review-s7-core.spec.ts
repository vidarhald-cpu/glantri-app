import { expect, test, type APIResponse } from "@playwright/test";
import {
  buildCombatExperiencePersistentLifecycle,
  combatRoundStateSchema,
  initializeCombatRoundState,
  prepareCombatRoundEndReview,
  type CombatEffectsState,
  type EncounterSession,
} from "@glantri/domain";
import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

test.describe("S7 reduced Round End presentation", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("shows two consequential participants in order while the quiet third stays selectable", async ({
    browser,
    page,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const otherContext = await browser.newContext({ storageState: "e2e/.auth/non-holder.json" });
    try {
      const player = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      const gm = await json<{ user: { id: string } }>(await page.request.get(`${API_URL}/auth/me`));
      const other = await json<{ user: { id: string } }>(
        await otherContext.request.get(`${API_URL}/auth/me`),
      );
      const campaign = await json<{ campaign: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns`, {
          data: { name: `S7 core ${suffix}`, status: "active" },
        }),
      );
      const scenario = await json<{ scenario: { id: string } }>(
        await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
          data: { name: `S7 core ${suffix}`, status: "live" },
        }),
      );

      const members: Array<{
        encounterId: string;
        label: string;
        scenario: { id: string; state: Record<string, unknown> };
      }> = [];
      for (const [index, label] of ["Timed hero", "Timed ally", "Quiet hero"].entries()) {
        const controller = index === 0 ? playerContext : index === 1 ? undefined : otherContext;
        const controllerId =
          index === 0 ? player.user.id : index === 1 ? gm.user.id : other.user.id;
        const characterId = `s7-core-${index}-${suffix}`;
        await createCharacterForE2e({
          apiUrl: API_URL,
          id: characterId,
          name: `${label} ${suffix}`,
          request: controller?.request ?? page.request,
        });
        await json(
          await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/roster`, {
            data: { category: "pc", sourceId: characterId, sourceType: "character" },
          }),
        );
        const created = await json<{
          participant: { id: string; state: Record<string, unknown> };
        }>(
          await page.request.post(
            `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
            { data: { characterId, controlledByUserId: controllerId } },
          ),
        );
        members.push({
          encounterId: `s7-core-member-${index}-${suffix}`,
          label,
          scenario: created.participant,
        });
      }
      const now = new Date().toISOString();
      const encounterId = `s7-core-encounter-${suffix}`;
      await json<{ encounter: EncounterSession }>(
        await page.request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
          data: {
            session: {
              campaignId: campaign.campaign.id,
              createdAt: now,
              currentRound: 3,
              id: encounterId,
              kind: "combat",
              participantMembershipMode: "explicit",
              participants: members.map((member) => ({
                id: member.encounterId,
                label: member.label,
                participantType: "scenario",
                scenarioParticipantId: member.scenario.id,
              })),
              scenarioId: scenario.scenario.id,
              status: "active",
              title: `S7 core ${suffix}`,
              updatedAt: now,
            },
          },
        }),
      );
      const refreshed = await json<{ encounter: EncounterSession }>(
        await page.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      const activated = await json<{ encounter: EncounterSession }>(
        await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
          data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
        }),
      );

      const effectInputs: Record<string, { combatEffects: CombatEffectsState }> = {};
      for (const [index, member] of members.entries()) {
        if (index === 2) continue;
        const effectId = `s7-core-effect-${index}-${suffix}`;
        const eventId = `s7-core-event-${index}-${suffix}`;
        const lifecycle = {
          ...buildCombatExperiencePersistentLifecycle({
            context: {
              commandId: `s7-core-created-${index}`,
              createdAt: now,
              createdRevision: `s7-core-revision-${index}`,
              createdSequence: index + 1,
              encounterId,
              eventId,
              ownerParticipantId: member.scenario.id,
              roundNumber: 2,
            },
            durationRounds: 2,
            effectId,
            modifierValue: -2,
            status: "active",
          }),
          publicLabel: `${member.label} effect`,
        };
        const effects: CombatEffectsState = {
          effects: [
            {
              canonicalLifecycle: lifecycle,
              createdAt: now,
              damage: 0,
              description: `${member.label} effect`,
              duration: "2 rounds",
              effectGroup: "general",
              generalDamage: 0,
              id: effectId,
              modifierValue: -2,
              roundNumber: 2,
              sourceEventId: eventId,
              status: "active",
              targetParticipantId: member.scenario.id,
              type: "general_modifier",
              updatedAt: now,
            },
          ],
          events: [
            {
              createdAt: now,
              description: `${member.label} effect`,
              id: eventId,
              sourceLabel: "Combat Experience",
              sourceType: "manual",
              targetParticipantId: member.scenario.id,
            },
          ],
        };
        await json(
          await page.request.put(
            `${API_URL}/scenarios/${scenario.scenario.id}/participants/${member.scenario.id}/state`,
            { data: { state: { ...member.scenario.state, combatEffects: effects } } },
          ),
        );
        effectInputs[member.encounterId] = { combatEffects: effects };
      }

      const roundState = combatRoundStateSchema.parse({
        ...initializeCombatRoundState({ encounter: activated.encounter }),
        currentCursor: { participantId: members[0]!.encounterId, roundNumber: 3, step: "SU" },
        currentStep: "round_summary",
        roundNumber: 3,
        selectedParticipantId: members[0]!.encounterId,
        selectedStep: "round_summary",
      });
      const prepared = prepareCombatRoundEndReview({
        participantInputs: effectInputs,
        state: roundState,
      });
      await json(
        await page.request.put(`${API_URL}/encounters/${encounterId}`, {
          data: {
            expectedRevision: activated.encounter.updatedAt,
            session: { ...activated.encounter, combatRoundState: prepared, currentRound: 3 },
          },
        }),
      );
      const workspaceUrl = `/campaigns/${campaign.campaign.id}?tab=combat&scenarioId=${scenario.scenario.id}&encounterId=${encounterId}`;
      await page.goto(workspaceUrl);
      const navigation = page.getByLabel("Round End Review navigation");
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole("button", { name: "Timed hero" })).toHaveCount(2);
      await expect(navigation.getByRole("button", { name: "Timed ally" })).toHaveCount(2);
      await expect(navigation.getByRole("button", { name: "Quiet hero" })).toHaveCount(1);

      await navigation.getByRole("button", { name: "Timed hero" }).first().click();
      const chronology = page.getByLabel("Round End Effects chronology");
      await expect(chronology).toContainText("Timed hero effect");
      const entries = await chronology.locator("li").allTextContents();
      expect(entries[0]).toContain("Active timed effect");
      expect(entries[1]).toContain("Countdown / checkpoint");
      expect(entries[1]).toContain("2 rounds → 1 round");
      await navigation
        .getByText("Inspect any combatant")
        .locator("..")
        .getByRole("button", { name: "Quiet hero" })
        .click();
      await expect(
        page.getByRole("heading", { name: /Combat inspector — Quiet hero/ }),
      ).toBeVisible();

      const playerPage = await playerContext.newPage();
      await playerPage.goto(workspaceUrl);
      const playerChronology = playerPage.getByLabel("Round End Effects chronology");
      await expect(playerChronology).toContainText("Timed hero effect");
      const playerEntries = await playerChronology.locator("li").allTextContents();
      expect(playerEntries[0]).toContain("Active timed effect");
      expect(playerEntries[1]).toContain("2 rounds → 1 round");
      await expect(playerChronology).not.toContainText("Timed ally effect");

      const current = await json<{ encounter: EncounterSession }>(
        await page.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      expect(current.encounter.combatRoundState?.roundNumber).toBe(3);
      expect(current.encounter.combatRoundState?.currentStep).toBe("round_summary");
    } finally {
      await playerContext.close();
      await otherContext.close();
    }
  });
});
