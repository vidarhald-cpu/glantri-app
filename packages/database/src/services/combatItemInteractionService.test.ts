import { CanonicalEquipmentItemSchema } from "@glantri/domain";
import { describe, expect, it, vi } from "vitest";

import type {
  CharacterEquipmentRepository,
  CombatItemInteractionRecord,
} from "../repositories/characterEquipmentRepository";
import {
  CombatItemInteractionService,
  CombatItemUnavailableError,
} from "./combatItemInteractionService";

function record(input: {
  availableInEncounter?: boolean;
  hidden?: boolean;
  holderCharacterId: string | null;
  id: string;
  itemFacts?: unknown;
  presentEncounterId?: string;
  templateId?: string;
}): CombatItemInteractionRecord {
  return {
    availableInEncounter: input.availableInEncounter ?? true,
    hidden: input.hidden ?? false,
    item: CanonicalEquipmentItemSchema.parse({
      campaignContextId: "campaign-1",
      category: "weapon",
      characterId: input.holderCharacterId,
      conditionState: "intact",
      displayName: input.id,
      holderCharacterId: input.holderCharacterId,
      id: input.id,
      isEquipped: false,
      isStackable: false,
      itemFacts: input.itemFacts,
      material: "steel",
      quality: "standard",
      quantity: 1,
      revision: "2026-08-16T10:00:00.000Z",
      specificityType: "specific",
      storageAssignment: input.holderCharacterId
        ? { carryMode: "on_person", locationId: `${input.holderCharacterId}:loc-person` }
        : null,
      templateId: input.templateId ?? "weapon-template-dagger",
    }),
    presentEncounterId: input.presentEncounterId,
  };
}

function repository(records: CombatItemInteractionRecord[]) {
  return {
    applyCombatItemInteraction: vi.fn(),
    getCombatItemInteractionRecords: vi.fn(async () => records),
  } as unknown as CharacterEquipmentRepository;
}

const participants = [
  { characterId: "character-1", label: "Aster", participantId: "participant-1" },
  { characterId: "character-2", label: "Bram", participantId: "participant-2" },
  { label: "Unsupported NPC", participantId: "participant-npc" },
];

describe("CombatItemInteractionService privacy and declaration authority", () => {
  it("shows only controlled Items and revealed Encounter-present Items to a player", async () => {
    const service = new CombatItemInteractionService(
      repository([
        record({ holderCharacterId: "character-1", id: "owned-dagger" }),
        record({ hidden: true, holderCharacterId: "character-1", id: "hidden-owned-dagger" }),
        record({ holderCharacterId: "character-2", id: "other-dagger" }),
        record({
          availableInEncounter: false,
          holderCharacterId: "character-1",
          id: "stored-elsewhere",
        }),
        record({
          holderCharacterId: null,
          id: "visible-dagger",
          presentEncounterId: "encounter-1",
        }),
        record({
          hidden: true,
          holderCharacterId: null,
          id: "hidden-dagger",
          presentEncounterId: "encounter-1",
        }),
      ]),
    );

    const options = await service.getOptions({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      participants,
      viewer: {
        controlledParticipantIds: new Set(["participant-1"]),
        kind: "player",
        visibleParticipantIds: new Set(["participant-1"]),
      },
    });

    expect(options.actors).toHaveLength(1);
    expect(options.actors[0]?.items.map((item) => item.id)).toEqual(["owned-dagger"]);
    expect(options.presentItems.map((item) => item.id)).toEqual(["visible-dagger"]);
    expect(JSON.stringify(options)).not.toContain("hidden-dagger");
    expect(JSON.stringify(options)).not.toContain("hidden-owned-dagger");
    expect(JSON.stringify(options)).not.toContain("other-dagger");
    expect(JSON.stringify(options)).not.toContain("stored-elsewhere");
    expect(options.recipients).toEqual([{ label: "Aster", participantId: "participant-1" }]);
    expect(JSON.stringify(options)).not.toContain("Bram");
    expect(JSON.stringify(options)).not.toContain("participant-2");
  });

  it("gives the GM precise unsupported actor state without inventing NPC Item holders", async () => {
    const service = new CombatItemInteractionService(
      repository([
        record({ hidden: true, holderCharacterId: "character-1", id: "hidden-owned-dagger" }),
      ]),
    );
    const options = await service.getOptions({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      participants,
      viewer: { kind: "gm" },
    });

    expect(options.actors.find((actor) => actor.participantId === "participant-npc")).toMatchObject(
      {
        items: [],
        unsupportedReason: "Canonical Item interactions currently require a Character participant.",
      },
    );
    expect(options.actors[0]?.items.map((item) => item.id)).toContain("hidden-owned-dagger");
    expect(options.recipients).toEqual([
      { label: "Aster", participantId: "participant-1" },
      { label: "Bram", participantId: "participant-2" },
    ]);
  });

  it("makes hidden, nonexistent, wrong-owner, and forged-revision declarations fail identically", async () => {
    const service = new CombatItemInteractionService(
      repository([
        record({ holderCharacterId: "character-2", id: "other-dagger" }),
        record({
          hidden: true,
          holderCharacterId: null,
          id: "hidden-dagger",
          presentEncounterId: "encounter-1",
        }),
      ]),
    );
    const attempt = (itemId: string) =>
      service.resolveDeclaration({
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        expectedItemRevision: "2026-08-16T09:00:00.000Z",
        itemId,
        operation: "pickup",
        ownerParticipantId: "participant-1",
        participants,
        viewer: {
          controlledParticipantIds: new Set(["participant-1"]),
          kind: "player",
          visibleParticipantIds: new Set(["participant-1"]),
        },
      });

    for (const itemId of ["hidden-dagger", "missing-dagger", "other-dagger"]) {
      await expect(attempt(itemId)).rejects.toEqual(new CombatItemUnavailableError());
    }
  });

  it("makes hidden and nonexistent pass recipients fail identically", async () => {
    const service = new CombatItemInteractionService(
      repository([record({ holderCharacterId: "character-1", id: "owned-dagger" })]),
    );
    const attempt = (recipientParticipantId: string) =>
      service.resolveDeclaration({
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        expectedItemRevision: "2026-08-16T10:00:00.000Z",
        itemId: "owned-dagger",
        operation: "pass",
        ownerParticipantId: "participant-1",
        participants,
        recipientParticipantId,
        viewer: {
          controlledParticipantIds: new Set(["participant-1"]),
          kind: "player",
          visibleParticipantIds: new Set(["participant-1"]),
        },
      });

    await expect(attempt("participant-2")).rejects.toEqual(new CombatItemUnavailableError());
    await expect(attempt("participant-missing")).rejects.toEqual(new CombatItemUnavailableError());
  });

  it("resolves canonical Disarm snapshots and honors per-Item capability add/remove overrides", async () => {
    const actor = record({
      holderCharacterId: "character-1",
      id: "main-gauche",
      templateId: "weapon-template-main-gauche",
    });
    const target = record({ holderCharacterId: "character-2", id: "target-dagger" });
    const viewer = {
      controlledParticipantIds: new Set(["participant-1"]),
      kind: "player" as const,
      visibleParticipantIds: new Set(["participant-1", "participant-2"]),
    };
    const resolve = (
      service: CombatItemInteractionService,
      acting: CombatItemInteractionRecord,
      method: "proactive" | "reactive_parry" = "proactive",
    ) =>
      service.resolveDisarmDeclaration({
        actingItemId: acting.item.id,
        actingItemRevision: acting.item.revision!,
        actingParticipantId: "participant-1",
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        method,
        participants,
        phase: "phase1",
        targetItemId: target.item.id,
        targetItemRevision: target.item.revision!,
        targetParticipantId: "participant-2",
        viewer,
      });

    await expect(
      resolve(new CombatItemInteractionService(repository([actor, target])), actor),
    ).resolves.toMatchObject({
      actingWeapon: { capability: "trap", itemId: "main-gauche" },
      targetWeapon: { itemId: "target-dagger" },
    });

    const added = record({
      holderCharacterId: "character-1",
      id: "modified-dagger",
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [],
        templateOverrides: [
          {
            id: "add-disarm",
            kind: "weapon_disarm_capability_override",
            scope: "all_attack_modes",
            value: "trap",
            visibility: "revealed",
          },
        ],
        unsupportedCapabilities: [],
        version: 1,
      },
    });
    await expect(
      resolve(
        new CombatItemInteractionService(repository([added, target])),
        added,
        "reactive_parry",
      ),
    ).resolves.toMatchObject({
      actingWeapon: { capability: "trap", itemId: "modified-dagger" },
    });

    const removed = record({
      holderCharacterId: "character-1",
      id: "modified-main-gauche",
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [],
        templateOverrides: [
          {
            id: "remove-disarm",
            kind: "weapon_disarm_capability_override",
            scope: "all_attack_modes",
            value: "none",
            visibility: "revealed",
          },
        ],
        unsupportedCapabilities: [],
        version: 1,
      },
      templateId: "weapon-template-main-gauche",
    });
    await expect(
      resolve(new CombatItemInteractionService(repository([removed, target])), removed),
    ).rejects.toEqual(new CombatItemUnavailableError());
  });

  it("makes hidden and nonexistent Disarm targets fail identically", async () => {
    const actor = record({
      holderCharacterId: "character-1",
      id: "main-gauche",
      templateId: "weapon-template-main-gauche",
    });
    const hiddenTarget = record({
      hidden: true,
      holderCharacterId: "character-2",
      id: "hidden-target",
    });
    const service = new CombatItemInteractionService(repository([actor, hiddenTarget]));
    const attempt = (targetItemId: string) =>
      service.resolveDisarmDeclaration({
        actingItemId: actor.item.id,
        actingItemRevision: actor.item.revision!,
        actingParticipantId: "participant-1",
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        method: "proactive",
        participants,
        phase: "phase1",
        targetItemId,
        targetItemRevision: hiddenTarget.item.revision!,
        targetParticipantId: "participant-2",
        viewer: {
          controlledParticipantIds: new Set(["participant-1"]),
          kind: "player",
          visibleParticipantIds: new Set(["participant-1", "participant-2"]),
        },
      });

    await expect(attempt("hidden-target")).rejects.toEqual(new CombatItemUnavailableError());
    await expect(attempt("missing-target")).rejects.toEqual(new CombatItemUnavailableError());
  });
});
