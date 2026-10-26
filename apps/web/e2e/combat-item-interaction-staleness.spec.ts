import { expect, test, type APIRequestContext } from "@playwright/test";
import { createCharacterForE2e } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

/**
 * Forgejo issue #599 — the trigger the existing ACoV4 Item spec steps over.
 *
 * `acov4-combat-item-interactions.spec.ts` POSTs `reconcile-character-equipment` before its first
 * page visit, which is exactly the state that clears the staleness 409, and it only ever exercises
 * a Combat that has an Item. So it stayed green through a defect that made every Item interaction
 * and canonical Disarm permanently unavailable on an ordinary Scenario:
 *
 * 1. a Character finalized through Chargen reached the roster with an uninitialized equipment
 *    aggregate — the Chargen UI's finalize is `POST /characters`, the same write
 *    `createCharacterForE2e` performs, and neither it nor the roster initialized the aggregate;
 * 2. the participant snapshot captured that uninitialized aggregate revision;
 * 3. the player's own Combat page then issued `GET /characters/:id/equipment`, whose lazy
 *    initialization advanced the revision;
 * 4. the snapshot no longer matched, so the Item options endpoint answered 409 for the rest of the
 *    Combat, for every viewer;
 * 5. and the panel's loading branch was simply "no options yet", so that permanent failure
 *    rendered as "Loading Items…" indefinitely.
 *
 * This spec therefore uses an ordinary Chargen-path Character, creates no Item at all, and
 * deliberately never reconciles. Adding a reconcile to its setup would reintroduce precisely the
 * blind spot that let the defect escape.
 */

async function postJson<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`${API_URL}${endpoint}`, { data });
  expect(response.ok(), `${endpoint}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

async function itemOptionsStatus(request: APIRequestContext, encounterId: string): Promise<number> {
  const response = await request.get(
    `${API_URL}/encounters/${encounterId}/combat-round/item-interactions/options`,
  );
  return response.status();
}

test.describe("Combat Item interactions on an unreconciled ordinary Scenario", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("keeps Item options available across the Combat page's own equipment read and resolves the panel", async ({
    browser,
    page: gmPage,
  }) => {
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerPage = await playerContext.newPage();
    playerPage.setDefaultTimeout(20_000);
    const playerMe = (await (await playerContext.request.get(`${API_URL}/auth/me`)).json()) as {
      user: { id: string };
    };

    const characterId = `staleness-player-${suffix}`;
    const characterName = `Staleness Source ${suffix}`;
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterId,
      name: characterName,
      request: playerContext.request,
    });

    const campaign = await postJson<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Staleness Item Combat ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    await postJson(gmPage.request, `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    const scenario = await postJson<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Staleness Item Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participant = await postJson<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: playerMe.user.id },
    );

    const now = new Date().toISOString();
    const createdEncounter = await postJson<{ encounter: { id: string; updatedAt: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `staleness-item-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId,
              id: `staleness-source-${suffix}`,
              label: characterName,
              participantType: "scenario",
              scenarioParticipantId: participant.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Staleness Item Encounter ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = createdEncounter.encounter.id;
    const refreshed = (await (
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`)
    ).json()) as { encounter: { updatedAt: string } };
    const started = await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
    });
    expect(started.ok(), await started.text()).toBe(true);

    // No Item is created and no reconcile is performed anywhere in this spec.
    expect(await itemOptionsStatus(playerContext.request, encounterId)).toBe(200);

    // The exact request the Combat page issues for itself, and the step that used to poison the
    // Scenario. Its lazy initialization must now be a no-op, because the participant capture
    // boundary already initialized the aggregate.
    const equipmentRead = await playerContext.request.get(
      `${API_URL}/characters/${characterId}/equipment`,
    );
    expect(equipmentRead.ok(), await equipmentRead.text()).toBe(true);
    expect(await itemOptionsStatus(playerContext.request, encounterId)).toBe(200);
    expect(await itemOptionsStatus(playerContext.request, encounterId)).toBe(200);
    expect(await itemOptionsStatus(gmPage.request, encounterId)).toBe(200);

    // The workspace polls `GET /encounters/:id/revision` every few seconds, so `networkidle`
    // never settles here. Wait for the document and then for the panel's own resolved state.
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`, {
      waitUntil: "domcontentloaded",
    });
    const panel = playerPage.getByLabel("Items in this Combat");
    await expect(panel).toHaveCount(1);
    // A Combat with no Items must reach the resolved empty state, not sit on the loading branch.
    await expect(panel.getByText("No available Items.")).toBeVisible();
    await expect(panel.getByText("Loading Items…")).toHaveCount(0);
    // Forgejo issue #771 R2-4: the failed-load line is now the short `Items unavailable.`, not
    // the server's reconciliation sentence. Narrowed to the new text; the property is the same
    // one — a healthy load must not reach the failed state.
    await expect(panel.getByText("Items unavailable.")).toHaveCount(0);
    await expect(
      panel.getByText("Scenario equipment changed outside play.", { exact: false }),
    ).toHaveCount(0);

    await playerContext.close();
  });
});
