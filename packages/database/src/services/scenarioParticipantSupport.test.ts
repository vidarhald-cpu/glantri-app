import type { Campaign, CampaignRosterEntry } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { ScenarioService } from "./scenarioService";
import { createCharacterRecord, createScenarioRepositoryStub } from "./scenarioService.testHelpers";

/**
 * Forgejo issue #803 — the one-controlled-Character invariant must not limit GM authority.
 *
 * Product Owner ruling, issue #786 comment 18040, verbatim:
 *
 * > The one-controlled-Character invariant applies only to player-controlled PC assignments.
 * > It does not limit GM authority: the GM may control multiple Characters/participants in the
 * > same Scenario.
 *
 * Every case here is paired. The GM cases assert admission, and the player case run against the
 * **same fixture and the same code path** asserts refusal, so a repair that simply deleted the
 * invariant would fail this file. The exemption is also asserted to fail closed when the
 * Campaign cannot be read, and not to extend to a second user who merely holds control.
 */

const GM_USER_ID = "user-gm";
const PLAYER_USER_ID = "user-player";

function campaignRecord(gmUserId: string): Campaign {
  return {
    createdAt: "2026-04-21T00:00:00.000Z",
    description: "",
    gmUserId,
    id: "campaign-1",
    name: "Campaign One",
    settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
    slug: "campaign-one",
    status: "active",
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
}

function rosterCharacters(rosterEntries: CampaignRosterEntry[], ...characterIds: string[]): void {
  for (const characterId of characterIds) {
    rosterEntries.push({
      campaignId: "campaign-1",
      category: "pc",
      createdAt: "2026-04-21T00:00:00.000Z",
      id: `roster-${characterId}`,
      sourceId: characterId,
      sourceType: "character",
      updatedAt: "2026-04-21T00:00:00.000Z",
    });
  }
}

/**
 * Four rostered Characters in one `live` Scenario of a Campaign whose GM is `GM_USER_ID`.
 * `withCampaign: false` omits the Campaign row so the exemption's fail-closed branch is
 * measurable through exactly the same fixture.
 */
function createFixture(options?: { withCampaign?: boolean }) {
  const { campaigns, participants, repository, rosterEntries, scenario } =
    createScenarioRepositoryStub();
  scenario.status = "live";

  if (options?.withCampaign ?? true) {
    campaigns.push(campaignRecord(GM_USER_ID));
  }

  const characters = new Map(
    [
      ["character-1", "Ari"],
      ["character-2", "Bryn"],
      ["character-3", "Cael"],
      ["character-4", "Dain"],
    ].map(([id, name]) => [
      id!,
      // Distinct owners, because `controlledByUserId: null` on the add path does not mean
      // "unassigned": `addCharacterParticipant` falls back to `character.ownerId`. A shared
      // owner would therefore make the fixture's own setup collide.
      createCharacterRecord({ id: id!, name: name!, ownerId: `owner-${id!}` }),
    ]),
  );
  rosterCharacters(rosterEntries, ...characters.keys());

  const service = new ScenarioService(
    repository,
    {
      getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
    } as never,
    {
      getCharacterEquipmentState: async () => ({
        activeLoadoutByCharacterId: {},
        itemsById: {},
        locationsById: {},
        templatesById: {},
      }),
    } as never,
    undefined,
    {
      ensureCharacterEquipmentInitialized: async () => {},
    } as never,
  );

  const addControlled = (characterId: string, controlledByUserId: string | null) =>
    service.addCharacterParticipant({
      characterId,
      controlledByUserId,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

  const activeControlledCount = (userId: string) =>
    participants.filter(
      (participant) =>
        participant.isActive &&
        participant.role === "player_character" &&
        participant.controlledByUserId === userId,
    ).length;

  return { activeControlledCount, addControlled, participants, service };
}

describe("the controller-conflict rule exempts the GM (#803)", () => {
  it("admits a second and a third GM-controlled player_character on the add path", async () => {
    const { activeControlledCount, addControlled } = createFixture();

    await addControlled("character-1", GM_USER_ID);
    await addControlled("character-2", GM_USER_ID);
    await addControlled("character-3", GM_USER_ID);

    expect(activeControlledCount(GM_USER_ID)).toBe(3);
  });

  it("still refuses a player's second controlled player_character on the add path", async () => {
    const { activeControlledCount, addControlled } = createFixture();

    await addControlled("character-1", PLAYER_USER_ID);

    await expect(addControlled("character-2", PLAYER_USER_ID)).rejects.toThrow(
      "already the active controlled character",
    );
    expect(activeControlledCount(PLAYER_USER_ID)).toBe(1);
  });

  it("admits a second and a third GM-controlled participant on the metadata path", async () => {
    const { activeControlledCount, addControlled, service } = createFixture();

    await addControlled("character-1", GM_USER_ID);
    const second = await addControlled("character-2", null);
    const third = await addControlled("character-3", null);

    await service.updateScenarioParticipantMetadata({
      controlledByUserId: GM_USER_ID,
      participantId: second.id,
      scenarioId: "scenario-1",
    });
    await service.updateScenarioParticipantMetadata({
      controlledByUserId: GM_USER_ID,
      participantId: third.id,
      scenarioId: "scenario-1",
    });

    expect(activeControlledCount(GM_USER_ID)).toBe(3);
  });

  it("still refuses a player's second controlled participant on the metadata path", async () => {
    const { activeControlledCount, addControlled, service } = createFixture();

    await addControlled("character-1", PLAYER_USER_ID);
    const second = await addControlled("character-2", null);

    await expect(
      service.updateScenarioParticipantMetadata({
        controlledByUserId: PLAYER_USER_ID,
        participantId: second.id,
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("already the active controlled character");
    expect(activeControlledCount(PLAYER_USER_ID)).toBe(1);
  });

  it("still refuses a player's reactivation into a second controlled participant", async () => {
    const { activeControlledCount, addControlled, service } = createFixture();

    const first = await addControlled("character-1", PLAYER_USER_ID);
    const second = await addControlled("character-2", null);
    await service.updateScenarioParticipantMetadata({
      isActive: false,
      participantId: first.id,
      scenarioId: "scenario-1",
    });
    await service.updateScenarioParticipantMetadata({
      controlledByUserId: PLAYER_USER_ID,
      participantId: second.id,
      scenarioId: "scenario-1",
    });

    await expect(
      service.updateScenarioParticipantMetadata({
        isActive: true,
        participantId: first.id,
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("already the active controlled character");
    expect(activeControlledCount(PLAYER_USER_ID)).toBe(1);
  });

  it("admits the GM's reactivation into a second controlled participant", async () => {
    const { activeControlledCount, addControlled, service } = createFixture();

    const first = await addControlled("character-1", GM_USER_ID);
    await addControlled("character-2", GM_USER_ID);
    await service.updateScenarioParticipantMetadata({
      isActive: false,
      participantId: first.id,
      scenarioId: "scenario-1",
    });
    expect(activeControlledCount(GM_USER_ID)).toBe(1);

    await service.updateScenarioParticipantMetadata({
      isActive: true,
      participantId: first.id,
      scenarioId: "scenario-1",
    });

    expect(activeControlledCount(GM_USER_ID)).toBe(2);
  });

  it("does not exempt a second user who merely holds a control assignment", async () => {
    const { activeControlledCount, addControlled } = createFixture();

    await addControlled("character-1", GM_USER_ID);
    await addControlled("character-2", PLAYER_USER_ID);

    await expect(addControlled("character-3", PLAYER_USER_ID)).rejects.toThrow(
      "already the active controlled character",
    );
    expect(activeControlledCount(GM_USER_ID)).toBe(1);
    expect(activeControlledCount(PLAYER_USER_ID)).toBe(1);
  });

  it("fails closed and refuses the GM's second Character when the Campaign is unreadable", async () => {
    const { activeControlledCount, addControlled } = createFixture({ withCampaign: false });

    await addControlled("character-1", GM_USER_ID);

    await expect(addControlled("character-2", GM_USER_ID)).rejects.toThrow(
      "already the active controlled character",
    );
    expect(activeControlledCount(GM_USER_ID)).toBe(1);
  });

  it("names the rule it enforces, and names it only for the player case that reaches it", async () => {
    const { addControlled } = createFixture();

    await addControlled("character-1", PLAYER_USER_ID);

    await expect(addControlled("character-2", PLAYER_USER_ID)).rejects.toThrow(
      "Ari is already the active controlled character for this player in the scenario. A player may control only one Character per Scenario.",
    );
  });
});
