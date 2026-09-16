import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyEquipmentItemFacts, resolveEffectiveItemTemplate } from "@glantri/domain";
import { equipmentTemplatesById } from "@glantri/content";
import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";

const prisma = getTestPrismaClient();
describe.skipIf(!process.env.DATABASE_URL_TEST)("persistent GM Item lifecycle", () => {
  beforeEach(async () => resetTestDatabase(prisma!));
  async function fixture() {
    const gm = await createTestUser(prisma!, { roles: ["game_master"] });
    const campaign = await createTestCampaign(prisma!, gm.id);
    const npc = await createTestCharacter(prisma!, gm.id, { name: "Keeper" });
    const pc = await createTestCharacter(prisma!, gm.id, { name: "Armand" });
    await prisma!.campaignRosterEntry.createMany({
      data: [npc, pc].map((character, index) => ({
        campaignId: campaign.id,
        category: index ? "pc" : "npc",
        createdByUserId: gm.id,
        sourceId: character.id,
        sourceType: "character",
      })),
    });
    const repository = createPrismaCharacterEquipmentRepository(prisma!);
    const service = new CharacterEquipmentWriteService(repository);
    await service.ensureCharacterEquipmentInitialized(npc.id);
    await service.ensureCharacterEquipmentInitialized(pc.id);
    const evidence = { actorAuthority: "campaign_gm" as const, actorUserId: gm.id };
    const npcRevision = (await repository.getCharacterEquipmentAggregateState(npc.id)).revision;
    const pcRevision = (await repository.getCharacterEquipmentAggregateState(pc.id)).revision;
    return { gm, campaign, npc, pc, repository, service, evidence, npcRevision, pcRevision };
  }
  it("persists one descriptive Item through NPC assignment, transfer, movement and rediscovery", async () => {
    const f = await fixture();
    const letter = await f.service.createCampaignEquipmentItem({
      campaignId: f.campaign.id,
      templateId: null,
      displayName: "Letter from Prince Jaggar",
      notes: "The seal is unbroken.",
      physicalBaseEncumbrance: 0.1,
      itemFacts: createEmptyEquipmentItemFacts(),
    });
    const assigned = await f.service.assignCampaignEquipmentItem({
      campaignId: f.campaign.id,
      itemId: letter.id,
      expectedItemRevision: letter.revision,
      targetCharacterId: f.npc.id,
      targetExpectedRevision: f.npcRevision,
      evidence: f.evidence,
    });
    const transferred = await f.service.transferCampaignEquipmentItem({
      campaignId: f.campaign.id,
      itemId: letter.id,
      expectedItemRevision: assigned.revision,
      sourceCharacterId: f.npc.id,
      sourceExpectedRevision: f.npcRevision + 1,
      targetCharacterId: f.pc.id,
      targetExpectedRevision: f.pcRevision,
      evidence: f.evidence,
    });
    const state = await f.repository.getCharacterEquipmentAggregateState(f.pc.id);
    const pack = state.locations.find((location) => location.type === "backpack_system")!;
    await f.service.moveCharacterEquipmentItem(
      f.pc.id,
      letter.id,
      pack.id,
      "backpack",
      state.revision,
    );
    const reopened = await f.repository.getCanonicalEquipmentItemById(letter.id);
    expect(reopened).toMatchObject({
      id: letter.id,
      holderCharacterId: f.pc.id,
      templateId: null,
      category: null,
      notes: letter.notes,
      physicalBaseEncumbrance: 0.1,
      storageAssignment: { locationId: pack.id },
    });
    expect(reopened!.revision! > transferred.revision!).toBe(true);
    expect(await prisma!.characterEquipmentItem.count()).toBe(1);
    const current = await f.repository.getCharacterEquipmentAggregateState(f.pc.id);
    await expect(
      f.service.setCharacterActiveWeapon(f.pc.id, "primary", letter.id, current.revision),
    ).rejects.toThrow();
  });
  it("rejects a real second-session stale edit and an edit racing assignment without partial state", async () => {
    const f = await fixture();
    const created = await f.service.createCampaignEquipmentItem({
      campaignId: f.campaign.id,
      templateId: "weapon-template-dagger",
      itemFacts: createEmptyEquipmentItemFacts(),
    });
    const sessionB = new CharacterEquipmentWriteService(
      createPrismaCharacterEquipmentRepository(prisma!),
    );
    const save = {
      campaignId: f.campaign.id,
      itemId: created.id,
      expectedItemRevision: created.revision!,
      itemFacts: created.itemFacts,
    };
    const results = await Promise.allSettled([
      f.service.updateCampaignEquipmentItemAuthoring({ ...save, displayName: "A" }),
      sessionB.updateCampaignEquipmentItemAuthoring({ ...save, displayName: "B" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const latest = (await f.repository.getCanonicalEquipmentItemById(created.id))!;
    expect(latest.revision! > created.revision!).toBe(true);
    await expect(
      f.service.assignCampaignEquipmentItem({
        campaignId: f.campaign.id,
        itemId: created.id,
        expectedItemRevision: created.revision,
        targetCharacterId: f.pc.id,
        targetExpectedRevision: f.pcRevision,
        evidence: f.evidence,
      }),
    ).rejects.toThrow();
    expect((await f.repository.getCharacterEquipmentAggregateState(f.pc.id)).revision).toBe(
      f.pcRevision,
    );
    const moved = await f.service.assignCampaignEquipmentItem({
      campaignId: f.campaign.id,
      itemId: created.id,
      expectedItemRevision: latest.revision,
      targetCharacterId: f.pc.id,
      targetExpectedRevision: f.pcRevision,
      evidence: f.evidence,
    });
    await expect(
      sessionB.updateCampaignEquipmentItemAuthoring({
        ...save,
        expectedItemRevision: latest.revision!,
        displayName: "stale",
      }),
    ).rejects.toThrow();
    expect((await f.repository.getCanonicalEquipmentItemById(created.id))!.displayName).toBe(
      moved.displayName,
    );
  });
  it.each(["move", "equip"] as const)(
    "serializes authoring against a competing %s without partial changes",
    async (operation) => {
      const f = await fixture();
      const created = await f.service.createCampaignEquipmentItem({
        campaignId: f.campaign.id,
        holderCharacterId: f.pc.id,
        templateId: "weapon-template-dagger",
        itemFacts: createEmptyEquipmentItemFacts(),
      });
      const aggregate = await f.repository.getCharacterEquipmentAggregateState(f.pc.id);
      const competing = new CharacterEquipmentWriteService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const pack = aggregate.locations.find((location) => location.type === "backpack_system")!;
      const results = await Promise.allSettled([
        f.service.updateCampaignEquipmentItemAuthoring({
          campaignId: f.campaign.id,
          itemId: created.id,
          expectedItemRevision: created.revision!,
          displayName: "Authored",
          itemFacts: created.itemFacts,
        }),
        operation === "equip"
          ? competing.setCharacterActiveWeapon(f.pc.id, "primary", created.id, aggregate.revision)
          : competing.moveCharacterEquipmentItem(
              f.pc.id,
              created.id,
              pack.id,
              "backpack",
              aggregate.revision,
            ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const final = (await f.repository.getCanonicalEquipmentItemById(created.id))!;
      expect(final.revision! > created.revision!).toBe(true);
      expect((await f.repository.getCharacterEquipmentAggregateState(f.pc.id)).revision).toBe(
        aggregate.revision + 1,
      );
    },
  );

  it("round-trips explicit zero, reverts, protects unknown stored facts and separates GM/holder payloads", async () => {
    const f = await fixture();
    const created = await f.service.createCampaignEquipmentItem({
      campaignId: f.campaign.id,
      holderCharacterId: f.pc.id,
      templateId: "weapon-template-dagger",
      itemFacts: createEmptyEquipmentItemFacts(),
      mechanicalOverrides: [
        { kind: "input", property: "baseEncumbrance", value: 0, visibility: "gm_only" },
      ],
    });
    await prisma!.characterEquipmentItem.update({
      where: { id: created.id },
      data: {
        itemFactsJson: JSON.parse(
          JSON.stringify({
            ...createEmptyEquipmentItemFacts(),
            preservedExtension: { source: "unchanged" },
          }),
        ),
      },
    });
    const latest = (await f.repository.getCanonicalEquipmentItemById(created.id))!;
    expect(resolveEffectiveItemTemplate(latest, equipmentTemplatesById)?.baseEncumbrance).toBe(0);
    const reader = new CharacterEquipmentReadModelService(f.repository);
    const holder = await reader.getCharacterEquipmentState(f.pc.id, {
      kind: "holder",
      characterId: f.pc.id,
    });
    expect(holder.itemsById[created.id].mechanicalOverrides).toEqual([]);
    expect(JSON.stringify(holder)).not.toContain("preservedExtension");
    const reverted = await f.service.updateCampaignEquipmentItemAuthoring({
      campaignId: f.campaign.id,
      itemId: created.id,
      expectedItemRevision: latest.revision!,
      mechanicalOverrides: [],
      itemFacts: latest.itemFacts,
    });
    expect(reverted.mechanicalOverrides).toEqual([]);
    expect(resolveEffectiveItemTemplate(reverted, equipmentTemplatesById)?.baseEncumbrance).toBe(
      equipmentTemplatesById[created.templateId!].baseEncumbrance,
    );
    expect(
      (await prisma!.characterEquipmentItem.findUniqueOrThrow({ where: { id: created.id } }))
        .itemFactsJson,
    ).toMatchObject({ preservedExtension: { source: "unchanged" } });
  });
  it("advances Item revision even for same-timestamp writes and preserves supported exhausted ammunition", async () => {
    const f = await fixture();
    const ammo = await f.service.createCampaignEquipmentItem({
      campaignId: f.campaign.id,
      templateId: "gear-template-arrows",
      quantity: 20,
      itemFacts: createEmptyEquipmentItemFacts(),
    });
    await prisma!.characterEquipmentItem.update({
      where: { id: ammo.id },
      data: { quantity: 0, updatedAt: new Date(ammo.revision!) },
    });
    const empty = (await f.repository.getCanonicalEquipmentItemById(ammo.id))!;
    expect(empty.quantity).toBe(0);
    expect(empty.revision! > ammo.revision!).toBe(true);
    await prisma!.characterEquipmentItem.update({
      where: { id: ammo.id },
      data: { quantity: 1, updatedAt: new Date(ammo.revision!) },
    });
    expect(
      (await f.repository.getCanonicalEquipmentItemById(ammo.id))!.revision! > empty.revision!,
    ).toBe(true);
  });
});
