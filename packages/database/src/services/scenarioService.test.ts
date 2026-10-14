import { describe, expect, it } from "vitest";

import type { CampaignRosterEntry, ReusableEntity } from "@glantri/domain";

import { ScenarioService } from "./scenarioService";
import { createCharacterRecord, createScenarioRepositoryStub } from "./scenarioService.testHelpers";

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
 * Forgejo issue #599 — the Scenario participant capture boundary initializes the Character's
 * equipment aggregate before it reads the state it is about to project. These unit tests run
 * against repository stubs, so they record the initializer's calls rather than reaching a
 * database, and assert the order the invariant depends on.
 */
function createEquipmentWriteStub(record?: (characterId: string) => void) {
  return {
    ensureCharacterEquipmentInitialized: async (characterId: string) => {
      record?.(characterId);
    },
  } as never;
}

describe("ScenarioService controller assignment", () => {
  it("explicitly refreshes committed equipment while preserving live participant state", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const character = createCharacterRecord({ id: "character-1", name: "Scyrian" });
    rosterCharacters(rosterEntries, character.id);
    let equipmentState: Record<string, unknown> = {
      activeLoadoutByCharacterId: { "character-1": { activeAmmoItemIds: [] } },
      itemsById: {},
      locationsById: {},
      templatesById: {},
    };
    const service = new ScenarioService(
      repository,
      { getCharacterById: async () => character } as never,
      { getCharacterEquipmentState: async () => equipmentState } as never,
      undefined,
      createEquipmentWriteStub(),
    );
    const original = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });
    await repository.updateScenarioParticipantState(original.id, {
      ...original.state,
      health: { ...original.state.health, currentHp: 4 },
    });
    equipmentState = {
      activeLoadoutByCharacterId: {
        "character-1": {
          activeAmmoItemIds: [],
          activeMissileWeaponItemId: "scenario-bow-1",
          activePrimaryWeaponItemId: "scenario-sword-1",
          activeSecondaryWeaponItemId: "scenario-dagger-1",
          characterId: "character-1",
          id: "loadout-1",
          isActive: true,
          name: "Combat",
          quickAccessItemIds: [],
          readyShieldItemId: "scenario-shield-1",
          wornArmorItemId: "scenario-armor-1",
        },
      },
      itemsById: {
        "scenario-sword-1": {
          characterId: "character-1",
          id: "scenario-sword-1",
          isEquipped: true,
          templateId: "sword-template",
        },
        "scenario-dagger-1": {
          characterId: "character-1",
          id: "scenario-dagger-1",
          isEquipped: true,
          templateId: "dagger-template",
        },
        "scenario-bow-1": {
          characterId: "character-1",
          id: "scenario-bow-1",
          isEquipped: true,
          templateId: "bow-template",
        },
        "scenario-shield-1": {
          characterId: "character-1",
          id: "scenario-shield-1",
          isEquipped: true,
          templateId: "shield-template",
        },
        "scenario-armor-1": {
          characterId: "character-1",
          id: "scenario-armor-1",
          isEquipped: true,
          templateId: "armor-template",
        },
      },
      locationsById: {},
      templatesById: {
        "armor-template": { category: "armor", id: "armor-template" },
        "bow-template": { category: "weapon", id: "bow-template" },
        "dagger-template": { category: "weapon", id: "dagger-template" },
        "shield-template": { category: "shield", id: "shield-template" },
        "sword-template": { category: "weapon", id: "sword-template" },
      },
    };

    const refreshed = await service.refreshCharacterParticipantEquipmentSnapshot({
      participantId: original.id,
      scenarioId: "scenario-1",
    });

    expect(refreshed.snapshot.equipmentState).toEqual(equipmentState);
    expect(refreshed.state.equipment.readyItemIds).toEqual([
      "scenario-armor-1",
      "scenario-shield-1",
      "scenario-sword-1",
      "scenario-dagger-1",
      "scenario-bow-1",
    ]);
    expect(refreshed.state.health.currentHp).toBe(4);
  });

  it("prevents one player from being assigned to two active player characters in the same scenario", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      [
        "character-2",
        createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: "user-2" }),
      ],
    ]);
    rosterCharacters(rosterEntries, "character-1", "character-2");
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
      createEquipmentWriteStub(),
    );

    await service.addCharacterParticipant({
      characterId: "character-1",
      controlledByUserId: "user-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.addCharacterParticipant({
        characterId: "character-2",
        controlledByUserId: "user-1",
        joinSource: "gm_added",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("already the active controlled character");
  });

  it("uses Character ownership only while Scenario control is unassigned", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const character = createCharacterRecord({
      id: "character-1",
      name: "Ari",
      ownerId: "owner-1",
    });
    rosterCharacters(rosterEntries, character.id);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async () => character,
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
      createEquipmentWriteStub(),
    );

    const participant = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "owner-1" }),
    ).resolves.toBe(true);

    await repository.updateScenarioParticipantMetadata({
      controlledByUserId: "controller-1",
      participantId: participant.id,
    });

    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "owner-1" }),
    ).resolves.toBe(false);
    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "controller-1" }),
    ).resolves.toBe(true);
  });

  it("denies player access when rostered Character is no longer rostered", async () => {
    const { rosterEntries, repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const character = createCharacterRecord({
      id: "character-1",
      name: "Ari",
      ownerId: "owner-1",
    });
    rosterCharacters(rosterEntries, character.id);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async () => character,
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
      createEquipmentWriteStub(),
    );

    const participant = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "owner-1" }),
    ).resolves.toBe(true);

    rosterEntries.length = 0;
    await repository.updateScenarioParticipantMetadata({
      controlledByUserId: "controller-1",
      participantId: participant.id,
    });

    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "owner-1" }),
    ).resolves.toBe(false);
    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "controller-1" }),
    ).resolves.toBe(false);
  });

  it("allows the same controller to manage multiple non-player participants", async () => {
    const { participants, repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async () => null,
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
      createEquipmentWriteStub(),
    );

    const baseEntity: ReusableEntity = {
      createdAt: "2026-04-21T00:00:00.000Z",
      gmUserId: "gm-1",
      id: "entity-1",
      kind: "npc",
      name: "Guard",
      updatedAt: "2026-04-21T00:00:00.000Z",
    };
    let entityCounter = 0;
    repository.getReusableEntityById = async () => ({
      ...baseEntity,
      id: `entity-${++entityCounter}`,
    });

    await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: "entity-1",
      role: "npc",
      scenarioId: "scenario-1",
    });

    await expect(
      service.addEntityParticipant({
        controlledByUserId: "gm-1",
        entityId: "entity-2",
        role: "npc",
        scenarioId: "scenario-1",
      }),
    ).resolves.toMatchObject({
      controlledByUserId: "gm-1",
      role: "npc",
    });

    expect(participants).toHaveLength(2);
  });

  it("rejects an out-of-roster Character before reading or writing Character state", async () => {
    const { participants, repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    let characterReads = 0;
    const service = new ScenarioService(repository, {
      getCharacterById: async () => {
        characterReads += 1;
        return createCharacterRecord({ id: "character-1", name: "Ari" });
      },
    } as never);

    await expect(
      service.addCharacterParticipant({
        characterId: "character-1",
        joinSource: "gm_added",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("Character is not in the campaign roster.");

    expect(characterReads).toBe(0);
    expect(participants).toEqual([]);
  });

  it("preserves temporary actor build, sheet, and equipment snapshots from entity input", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const sourceBuild = createCharacterRecord({
      id: "template-build-1",
      name: "City Guard",
    }).build;
    const sheetSummary = {
      draftView: {
        skills: [{ skillId: "perception", totalSkill: 18 }],
      },
    };
    const equipmentState = {
      activeLoadoutByCharacterId: {
        "template-build-1": {
          activePrimaryWeaponItemId: "spear-1",
          readyShieldItemId: "shield-1",
        },
      },
      itemsById: {
        "rope-1": { characterId: "template-build-1" },
        "shield-1": { characterId: "template-build-1" },
        "spear-1": { characterId: "template-build-1", isEquipped: true },
      },
    };
    const service = new ScenarioService(repository);

    const participant = await service.addEntityParticipant({
      entityInput: {
        gmUserId: "gm-1",
        kind: "npc",
        name: "City Guard",
        snapshot: {
          actorClass: "template",
          build: sourceBuild,
          equipmentState,
          sheetSummary,
        },
      },
      isTemporary: true,
      role: "npc",
      scenarioId: "scenario-1",
    });

    expect(participant.snapshot).toMatchObject({
      build: sourceBuild,
      displayName: "City Guard",
      equipmentState,
      sheetSummary,
    });
    expect(participant.state.equipment).toMatchObject({
      carriedItemIds: ["rope-1", "shield-1", "spear-1"],
      equippedItemIds: ["spear-1"],
      readyItemIds: ["shield-1", "spear-1"],
    });
  });

  it("reuses one concrete entity identity while creating versioned snapshots in later scenarios", async () => {
    const { participants, repository, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const entity = {
      createdAt: "2026-08-13T08:00:00.000Z",
      gmUserId: "gm-1",
      id: "entity-generated-npc-1",
      kind: "npc" as const,
      name: "Captain Harl",
      snapshot: {
        actorClass: "campaign_npc",
        campaignId: "campaign-1",
        equipmentState: {
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        },
        sheetSummary: { draftView: { skills: [] } },
      },
      updatedAt: "2026-08-13T08:05:00.000Z",
    };
    repository.getReusableEntityById = async (entityId) => (entityId === entity.id ? entity : null);
    repository.getScenarioById = async (scenarioId) => {
      if (
        scenarioId === scenario.id ||
        scenarioId === "scenario-2" ||
        scenarioId === "scenario-3"
      ) {
        return {
          ...scenario,
          id: scenarioId,
        };
      }
      return null;
    };
    const service = new ScenarioService(repository);

    const first = await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: entity.id,
      expectedGmUserId: "gm-1",
      role: "npc",
      scenarioId: "scenario-1",
    });
    const second = await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: entity.id,
      expectedGmUserId: "gm-1",
      role: "npc",
      scenarioId: "scenario-2",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.entityId).toBe(entity.id);
    expect(second.entityId).toBe(entity.id);
    expect(first.snapshot).not.toBe(second.snapshot);
    expect(first.snapshot.sourceUpdatedAt).toBe(entity.updatedAt);
    expect(second.snapshot.sourceUpdatedAt).toBe(entity.updatedAt);
    expect(first.state.snapshotVersion).toBe(1);
    expect(second.state.snapshotVersion).toBe(1);
    expect(participants).toHaveLength(2);

    await expect(
      service.addEntityParticipant({
        entityId: entity.id,
        expectedGmUserId: "other-gm",
        role: "npc",
        scenarioId: "scenario-3",
      }),
    ).rejects.toThrow("Reusable entity not found.");
  });

  it("enforces the active-control rule when participant metadata is reassigned", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      ["character-2", createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: null })],
    ]);
    rosterCharacters(rosterEntries, "character-1", "character-2");
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
      createEquipmentWriteStub(),
    );

    const first = await service.addCharacterParticipant({
      characterId: "character-1",
      controlledByUserId: "user-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });
    const second = await service.addCharacterParticipant({
      characterId: "character-2",
      controlledByUserId: null,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.updateScenarioParticipantMetadata({
        controlledByUserId: "user-1",
        participantId: second.id,
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("already the active controlled character");

    await expect(
      service.updateScenarioParticipantMetadata({
        controlledByUserId: "user-1",
        displayOrder: 10,
        factionId: "red",
        isActive: false,
        participantId: second.id,
        roleTag: "archer",
        scenarioId: "scenario-1",
        tacticalGroupId: "squad-a",
      }),
    ).resolves.toMatchObject({
      controlledByUserId: "user-1",
      displayOrder: 10,
      factionId: "red",
      id: second.id,
      isActive: false,
      roleTag: "archer",
      tacticalGroupId: "squad-a",
    });

    expect(first.controlledByUserId).toBe("user-1");
  });

  /**
   * Forgejo #439. Revoking control is an authorization withdrawal, not a gameplay edit, so it
   * stays reachable in the read-only terminal statuses where general participant metadata
   * updates are correctly refused.
   */
  it.each(["live", "paused", "completed", "archived"] as const)(
    "revokes participant control in a %s Scenario without touching anything else",
    async (status) => {
      const { eventLogs, repository, rosterEntries, scenario } = createScenarioRepositoryStub();
      scenario.status = "live";
      const character = createCharacterRecord({ id: "character-1", name: "Ari" });
      rosterCharacters(rosterEntries, character.id);
      const service = new ScenarioService(
        repository,
        { getCharacterById: async () => character } as never,
        {
          getCharacterEquipmentState: async () => ({
            activeLoadoutByCharacterId: {},
            itemsById: {},
            locationsById: {},
            templatesById: {},
          }),
        } as never,
        undefined,
        createEquipmentWriteStub(),
      );

      const participant = await service.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: "controller-1",
        joinSource: "gm_added",
        roleTag: "scout",
        scenarioId: "scenario-1",
      });

      scenario.status = status;

      const revoked = await service.revokeScenarioParticipantControl({
        participantId: participant.id,
        scenarioId: "scenario-1",
      });

      expect(revoked.controlledByUserId).toBeUndefined();
      expect(revoked.characterId).toBe(character.id);
      expect(revoked.isActive).toBe(true);
      expect(revoked.role).toBe(participant.role);
      expect(revoked.roleTag).toBe("scout");
      expect(revoked.sourceType).toBe("character");
      expect(eventLogs.at(-1)).toMatchObject({
        eventType: "participant_control_revoked",
        participantId: participant.id,
      });
    },
  );

  it.each(["completed", "archived"] as const)(
    "still refuses general participant metadata updates in a %s Scenario",
    async (status) => {
      const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
      scenario.status = "live";
      const character = createCharacterRecord({ id: "character-1", name: "Ari" });
      rosterCharacters(rosterEntries, character.id);
      const service = new ScenarioService(
        repository,
        { getCharacterById: async () => character } as never,
        {
          getCharacterEquipmentState: async () => ({
            activeLoadoutByCharacterId: {},
            itemsById: {},
            locationsById: {},
            templatesById: {},
          }),
        } as never,
        undefined,
        createEquipmentWriteStub(),
      );

      const participant = await service.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: "controller-1",
        joinSource: "gm_added",
        scenarioId: "scenario-1",
      });

      scenario.status = status;

      for (const update of [
        { isActive: false },
        { controlledByUserId: "controller-2" },
        { roleTag: "changed" },
        { tacticalGroupId: "squad-a" },
        { displayOrder: 9 },
        { factionId: "red" },
      ]) {
        await expect(
          service.updateScenarioParticipantMetadata({
            ...update,
            participantId: participant.id,
            scenarioId: "scenario-1",
          }),
        ).rejects.toThrow("Scenario is not editable in its current status.");
      }

      expect(participant.controlledByUserId).toBe("controller-1");
      expect(participant.isActive).toBe(true);
    },
  );

  it("refuses to revoke control on a participant of a different Scenario", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const character = createCharacterRecord({ id: "character-1", name: "Ari" });
    rosterCharacters(rosterEntries, character.id);
    const service = new ScenarioService(
      repository,
      { getCharacterById: async () => character } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        }),
      } as never,
      undefined,
      createEquipmentWriteStub(),
    );

    await service.addCharacterParticipant({
      characterId: character.id,
      controlledByUserId: "controller-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.revokeScenarioParticipantControl({
        participantId: "participant-missing",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("Scenario participant not found.");
  });

  it("rejects Scenario lifecycle regressions not present in the transition matrix", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);

    repository.updateScenario = async (input) => {
      if (input.status) scenario.status = input.status;
      if (input.mapAssetId !== undefined) {
        scenario.mapAssetId = input.mapAssetId ?? undefined;
      }

      return scenario;
    };

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        status: "completed",
      }),
    ).rejects.toThrow("Scenario cannot transition from draft to completed.");

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        status: "archived",
      }),
    ).resolves.toMatchObject({ status: "archived" });
  });

  it("locks completed Scenarios to status-only archived transitions", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);
    let appliedStatus = scenario.status;
    repository.updateScenario = async (input) => {
      if (input.status) {
        scenario.status = input.status;
        appliedStatus = input.status;
      }
      if (input.name !== undefined) scenario.name = input.name;
      if (input.kind !== undefined) scenario.kind = input.kind;
      if (input.mapAssetId !== undefined) scenario.mapAssetId = input.mapAssetId ?? undefined;
      if (input.description !== undefined) scenario.description = input.description;
      return scenario;
    };

    scenario.status = "completed";

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        name: "Completed read-only",
      }),
    ).rejects.toThrow("Scenario is not editable in its current status.");

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        status: "completed",
      }),
    ).rejects.toThrow("Scenario is not editable in its current status.");

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        status: "archived",
        description: "Blocked metadata update.",
      }),
    ).rejects.toThrow("Scenario is not editable in its current status.");

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        status: "archived",
      }),
    ).resolves.toMatchObject({ status: "archived" });

    expect(appliedStatus).toBe("archived");
  });

  it("blocks archived Scenario same-status metadata mutations", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);
    repository.updateScenario = async () => {
      return scenario;
    };

    scenario.status = "archived";

    await expect(
      service.updateScenario({
        scenarioId: "scenario-1",
        status: "archived",
      }),
    ).rejects.toThrow("Scenario is not editable in its current status.");
  });

  it("rejects stale scenario metadata updates before writing", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);
    const updateInvocations: unknown[] = [];
    repository.updateScenario = async (input) => {
      updateInvocations.push(input);
      scenario.status = input.status ?? scenario.status;
      return scenario;
    };
    scenario.updatedAt = "2026-04-21T00:00:00.001Z";

    await expect(
      service.updateScenario({
        expectedRevision: "2026-04-21T00:00:00.000Z",
        scenarioId: "scenario-1",
        status: "live",
      }),
    ).rejects.toMatchObject({ code: "stale_revision" });

    expect(updateInvocations).toHaveLength(0);
  });

  it("blocks participant mutations on non-editable Scenario status", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    rosterCharacters(rosterEntries, "character-1");

    scenario.status = "completed";

    const service = new ScenarioService(repository, {
      getCharacterById: async () => createCharacterRecord({ id: "character-1", name: "Ari" }),
    } as never);

    await expect(
      service.addCharacterParticipant({
        characterId: "character-1",
        joinSource: "gm_added",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("Scenario is not editable in its current status.");
  });

  it("requires live status for session state mutations", async () => {
    const { repository, scenario } = createScenarioRepositoryStub();

    scenario.status = "completed";

    const service = new ScenarioService(repository);

    await expect(
      service.updateScenarioSessionState({
        availableObjects: [],
        expectedRevision: "rev-1",
        gmPrivateNotes: "",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("Scenario is not currently live.");

    await expect(
      service.pickUpScenarioAvailableItem({
        actorUserId: "user-1",
        availabilityId: "item-1",
        expectedRevision: "rev-1",
        requestId: "request-1",
        scenarioId: "scenario-1",
        targetParticipantId: "participant-1",
        viewerMode: "player",
      }),
    ).rejects.toThrow("Scenario is not currently live.");
  });
});

describe("ScenarioService scenario relationships", () => {
  it("lists player-accessible scenarios by campaign from the repository", async () => {
    const { repository } = createScenarioRepositoryStub();
    repository.listScenariosByCampaignPlayerAccess = async (campaignId, userId) =>
      campaignId === "campaign-1" && userId === "player-1"
        ? [
            {
              campaignId: "campaign-1",
              createdAt: "2026-04-21T00:00:00.000Z",
              description: "Accessible scenario",
              id: "scenario-1",
              kind: "combat",
              name: "Arena Bout",
              status: "live",
              updatedAt: "2026-04-21T00:00:00.000Z",
            },
          ]
        : [];
    const service = new ScenarioService(repository);

    await expect(
      service.listScenariosByCampaignPlayerAccess("campaign-1", "player-1"),
    ).resolves.toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        id: "scenario-1",
        name: "Arena Bout",
      }),
    ]);
  });

  it("lists only Scenarios under the player's current control", async () => {
    const { repository } = createScenarioRepositoryStub();
    repository.listScenariosByCampaignPlayerControl = async (campaignId, userId) =>
      campaignId === "campaign-1" && userId === "player-1"
        ? [
            {
              campaignId: "campaign-1",
              createdAt: "2026-04-21T00:00:00.000Z",
              description: "Controlled scenario",
              id: "scenario-controlled",
              kind: "mixed",
              name: "Current Chapter",
              status: "live",
              updatedAt: "2026-04-21T00:00:00.000Z",
            },
          ]
        : [];
    const service = new ScenarioService(repository);

    await expect(
      service.listScenariosByCampaignPlayerControl("campaign-1", "player-1"),
    ).resolves.toEqual([expect.objectContaining({ id: "scenario-controlled" })]);
  });

  it("creates scenarios without continuation links by default", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);

    await expect(
      service.createScenario({
        campaignId: "campaign-1",
        kind: "mixed",
        name: "Standalone Scene",
        status: "draft",
      }),
    ).resolves.toMatchObject({
      campaignId: "campaign-1",
      name: "Standalone Scene",
    });
    expect(scenarioRelationships).toHaveLength(0);
  });

  it("creates a continuation relationship to an earlier campaign scenario", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);

    const scenario = await service.createScenario({
      campaignId: "campaign-1",
      continuesFromScenarioId: "scenario-1",
      kind: "mixed",
      name: "Follow-up Scene",
      status: "draft",
    });

    expect(scenarioRelationships).toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        fromScenarioId: "scenario-1",
        relationType: "continues_from",
        toScenarioId: scenario.id,
      }),
    ]);
    await expect(service.listScenarioRelationshipsByCampaign("campaign-1")).resolves.toHaveLength(
      1,
    );
  });

  it("rejects continuation links to scenarios outside the campaign", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    repository.getScenarioById = async () => ({
      campaignId: "other-campaign",
      createdAt: "2026-04-21T00:00:00.000Z",
      description: "",
      id: "scenario-other",
      kind: "mixed",
      name: "Other Campaign Scene",
      status: "draft",
      updatedAt: "2026-04-21T00:00:00.000Z",
    });
    const service = new ScenarioService(repository);

    await expect(
      service.createScenario({
        campaignId: "campaign-1",
        continuesFromScenarioId: "scenario-other",
        name: "Invalid Follow-up",
      }),
    ).rejects.toThrow("Continuation scenario not found in this campaign.");
    expect(scenarioRelationships).toHaveLength(0);
  });
});

describe("ScenarioService equipment aggregate initialization boundary", () => {
  /**
   * Forgejo issue #599. A Character finalized through Chargen reaches the roster with an
   * uninitialized equipment aggregate, and lazy initialization advances
   * `CharacterEquipmentAggregate.revision`. If the projection is captured first, the next
   * equipment read invalidates it and `assertScenarioEquipmentCurrent` refuses every Item
   * interaction and canonical Disarm in that Scenario with a 409. Capture must therefore follow
   * initialization, not precede it.
   */
  it("initializes the Character equipment aggregate before capturing the participant projection", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const character = createCharacterRecord({ id: "character-1", name: "Scyrian" });
    rosterCharacters(rosterEntries, character.id);
    const order: string[] = [];
    const service = new ScenarioService(
      repository,
      { getCharacterById: async () => character } as never,
      {
        getCharacterEquipmentState: async (characterId: string) => {
          order.push(`read:${characterId}`);
          return {
            activeLoadoutByCharacterId: {},
            itemsById: {},
            locationsById: {},
            revision: 1,
            templatesById: {},
          };
        },
      } as never,
      undefined,
      createEquipmentWriteStub((characterId) => order.push(`initialize:${characterId}`)),
    );

    const participant = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    expect(order).toEqual(["initialize:character-1", "read:character-1"]);
    expect(participant.snapshot.equipmentProjection?.aggregateRevision).toBe(1);
  });

  it("initializes the aggregate before an explicit GM reconcile recaptures the projection", async () => {
    const { repository, rosterEntries, scenario } = createScenarioRepositoryStub();
    scenario.status = "live";
    const character = createCharacterRecord({ id: "character-1", name: "Scyrian" });
    rosterCharacters(rosterEntries, character.id);
    const order: string[] = [];
    const service = new ScenarioService(
      repository,
      { getCharacterById: async () => character } as never,
      {
        getCharacterEquipmentState: async (characterId: string) => {
          order.push(`read:${characterId}`);
          return {
            activeLoadoutByCharacterId: {},
            itemsById: {},
            locationsById: {},
            revision: 1,
            templatesById: {},
          };
        },
      } as never,
      undefined,
      createEquipmentWriteStub((characterId) => order.push(`initialize:${characterId}`)),
    );
    const participant = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });
    order.length = 0;

    await service.refreshCharacterParticipantEquipmentSnapshot({
      participantId: participant.id,
      scenarioId: "scenario-1",
    });

    expect(order).toEqual(["initialize:character-1", "read:character-1"]);
  });
});
