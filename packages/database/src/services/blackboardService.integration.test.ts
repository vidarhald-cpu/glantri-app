import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BlackboardRepository } from "../repositories/blackboardRepository";
import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import {
  BlackboardConflictError,
  BlackboardDetailUnavailableError,
  BlackboardReferenceUnavailableError,
  BlackboardService,
} from "./blackboardService";
import { CampaignService } from "./campaignService";
import { CharacterService } from "./characterService";

const prisma = getTestPrismaClient()!;

if (!prisma) {
  describe.skip("BlackboardService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  const scenarioRepository = createPrismaScenarioRepository(prisma);
  const service = new BlackboardService(
    new BlackboardRepository(prisma),
    new CampaignService(
      scenarioRepository,
      new CharacterService(createPrismaCharacterRepository(prisma)),
    ),
  );

  async function setupCampaign() {
    const gm = await createTestUser(prisma, {
      displayName: "Morgan GM",
      roles: ["game_master"],
    });
    const player = await createTestUser(prisma, { displayName: "Ari Player" });
    const otherPlayer = await createTestUser(prisma, { displayName: "Bea Player" });
    const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
    const character = await createTestCharacter(prisma, player.id, { name: "Ari" });
    await prisma.campaignRosterEntry.create({
      data: {
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      },
    });
    return { campaign, character, gm, otherPlayer, player };
  }

  async function createEligibleArtifact(input: {
    altText?: string;
    campaignId: string;
    gmUserId: string;
    title?: string;
  }) {
    return prisma.campaignAsset.create({
      data: {
        altText: input.altText ?? "A map of the old gate",
        artifactKind: "map",
        audience: "campaign",
        campaignId: input.campaignId,
        createdByUserId: input.gmUserId,
        lifecycleState: "active",
        mediaTypeDetected: "image/png",
        storageState: "ready",
        storageUrl: "artifact-internal:test-map",
        title: input.title ?? "Old gate map",
        type: "map",
        visibility: "visible_to_all",
      },
    });
  }

  async function gameplayDomainCounts() {
    return Promise.all([
      prisma.character.count(),
      prisma.characterEquipmentItem.count(),
      prisma.encounter.count(),
      prisma.encounterActiveCombatState.count(),
      prisma.encounterArchivedCombatRound.count(),
      prisma.scenario.count(),
      prisma.scenarioEventLog.count(),
    ]);
  }

  beforeEach(async () => resetTestDatabase(prisma));
  afterAll(async () => resetTestDatabase(prisma));

  it("persists all four categories and emits byte-identical role-independent common data", async () => {
    const { campaign, gm, player } = await setupCampaign();
    const artifact = await createEligibleArtifact({ campaignId: campaign.id, gmUserId: gm.id });
    const gameplayBefore = await gameplayDomainCounts();

    await service.createEntry(campaign.id, player.id, {
      category: "clue_fact",
      fact: "Blue lantern",
      title: "Gate password",
    });
    await service.createEntry(campaign.id, player.id, {
      category: "document_text",
      documentText: "Meet at the northern arch.",
      title: "Letter",
    });
    await service.createEntry(campaign.id, player.id, {
      category: "image_map",
      sourceArtifactId: artifact.id,
      title: "Gate map",
    });
    await service.createEntry(campaign.id, gm.id, {
      category: "recap",
      recapText: "The group reached the old gate.",
      title: "Session recap",
    });

    const gmBytes = JSON.stringify(await service.getBoard(campaign.id, gm.id));
    const playerBytes = JSON.stringify(await service.getBoard(campaign.id, player.id));
    expect(gmBytes).toBe(playerBytes);
    const board = JSON.parse(gmBytes) as { catalogue: Array<{ category: string }> };
    expect(board.catalogue.map((entry) => entry.category).sort()).toEqual([
      "clue_fact",
      "document_text",
      "image_map",
      "recap",
    ]);
    expect(gmBytes).not.toMatch(
      /storageUrl|storageKey|storageProvider|originalFilename|sha256Digest|sourceUri|unitKey|grant/i,
    );

    await expect(
      service.createEntry(campaign.id, player.id, {
        category: "recap",
        recapText: "Player-approved",
        title: "Not allowed",
      }),
    ).rejects.toBeInstanceOf(BlackboardReferenceUnavailableError);
    expect(await gameplayDomainCounts()).toEqual(gameplayBefore);
  });

  it("keeps Blackboard-local grants Character-bound across correction, delegation, and deletion", async () => {
    const { campaign, character, gm, otherPlayer, player } = await setupCampaign();
    const created = (await service.createEntry(campaign.id, gm.id, {
      category: "document_text",
      documentText: "The public letter.",
      restrictedDetails: [
        { detailText: "The hidden ink names the duke.", label: "Hidden ink", sortOrder: 0 },
      ],
      title: "Sealed letter",
    })) as { entry: { id: string } };
    const audit = await service.getAudit(campaign.id, created.entry.id, gm.id);
    const unit = audit.unitVersions[0]!;
    const bytesBeforeGrant = JSON.stringify(await service.getBoard(campaign.id, player.id));

    await service.changeGrant({
      campaignId: campaign.id,
      characterId: character.id,
      entryId: created.entry.id,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: unit.unitVersion,
      },
      unitKey: unit.unitKey,
      userId: gm.id,
    });
    expect(JSON.stringify(await service.getBoard(campaign.id, gm.id))).toBe(bytesBeforeGrant);
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
        viewerCharacterId: character.id,
      }),
    ).resolves.toMatchObject({
      restrictedDetails: [{ detailText: "The hidden ink names the duke." }],
    });

    await expect(
      service.changeGrant({
        campaignId: campaign.id,
        characterId: character.id,
        entryId: created.entry.id,
        rawInput: {
          action: "grant",
          expectedEntryVersion: 1,
          expectedGrantVersion: 0,
          unitVersion: unit.unitVersion,
        },
        unitKey: unit.unitKey,
        userId: gm.id,
      }),
    ).rejects.toBeInstanceOf(BlackboardConflictError);

    const scenario = await prisma.scenario.create({
      data: {
        campaignId: campaign.id,
        description: "Delegation",
        kind: "social",
        name: "Delegated scene",
        status: "live",
      },
    });
    await prisma.scenarioParticipant.create({
      data: {
        characterId: character.id,
        controlledByUserId: otherPlayer.id,
        isActive: true,
        joinSource: "gm_added",
        role: "player_character",
        scenarioId: scenario.id,
        snapshotJson: {},
        sourceType: "character",
        stateJson: {},
      },
    });
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
        viewerCharacterId: character.id,
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: otherPlayer.id,
        viewerCharacterId: character.id,
      }),
    ).resolves.toMatchObject({ restrictedDetails: [{ label: "Hidden ink" }] });

    await prisma.character.delete({ where: { id: character.id } });
    const stream = await prisma.campaignBlackboardDetailGrantStream.findFirstOrThrow();
    expect(stream.liveCharacterId).toBeNull();
    expect(JSON.stringify(await service.getBoard(campaign.id, gm.id))).toBe(bytesBeforeGrant);
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: otherPlayer.id,
        viewerCharacterId: character.id,
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);
  });

  it("makes changed detail versions dormant and scrubs ordinary history on retraction", async () => {
    const { campaign, character, gm, player } = await setupCampaign();
    const created = (await service.createEntry(campaign.id, gm.id, {
      category: "clue_fact",
      fact: "The bell rings at dusk.",
      restrictedDetails: [{ detailText: "First secret", sortOrder: 0 }],
      title: "Bell",
    })) as { entry: { id: string } };
    const firstAudit = await service.getAudit(campaign.id, created.entry.id, gm.id);
    const firstUnit = firstAudit.unitVersions[0]!;
    await service.changeGrant({
      campaignId: campaign.id,
      characterId: character.id,
      entryId: created.entry.id,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: 1,
      },
      unitKey: firstUnit.unitKey,
      userId: gm.id,
    });

    await service.reviseEntry(campaign.id, created.entry.id, gm.id, {
      category: "clue_fact",
      changeKind: "correction",
      expectedEntryVersion: 1,
      fact: "The bell rings at midnight.",
      restrictedDetails: [
        { detailText: "Second secret", sortOrder: 0, unitKey: firstUnit.unitKey },
      ],
      title: "Bell",
    });
    const secondAudit = await service.getAudit(campaign.id, created.entry.id, gm.id);
    expect(secondAudit.unitVersions.map((unit) => unit.unitVersion)).toEqual([1, 2]);
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
        viewerCharacterId: character.id,
      }),
    ).resolves.toMatchObject({ restrictedDetails: [] });

    await service.retractEntry(campaign.id, created.entry.id, gm.id, {
      expectedEntryVersion: 2,
    });
    const historyBytes = JSON.stringify(
      await service.getHistory(campaign.id, created.entry.id, player.id),
    );
    expect(historyBytes).toContain("Removed");
    expect(historyBytes).not.toMatch(/bell|secret|midnight/i);
  });

  it("fails closed for omitted, invalid, unrostered, and ambiguously controlled Character context", async () => {
    const { campaign, character, gm, otherPlayer, player } = await setupCampaign();
    const otherCharacter = await createTestCharacter(prisma, player.id, { name: "Backup" });
    await prisma.campaignRosterEntry.create({
      data: {
        campaignId: campaign.id,
        category: "pc",
        sourceId: otherCharacter.id,
        sourceType: "character",
      },
    });
    const created = (await service.createEntry(campaign.id, gm.id, {
      category: "document_text",
      documentText: "Common text",
      restrictedDetails: [{ detailText: "Restricted text", sortOrder: 0 }],
      title: "Context check",
    })) as { entry: { id: string } };
    const unit = (await service.getAudit(campaign.id, created.entry.id, gm.id)).unitVersions[0]!;
    await service.changeGrant({
      campaignId: campaign.id,
      characterId: character.id,
      entryId: created.entry.id,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: 1,
      },
      unitKey: unit.unitKey,
      userId: gm.id,
    });

    const omitted = JSON.stringify(
      await service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
      }),
    );
    expect(omitted).toContain("Common text");
    expect(omitted).not.toContain("Restricted text");
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
        viewerCharacterId: "missing-character",
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);

    await prisma.campaignRosterEntry.deleteMany({
      where: { campaignId: campaign.id, sourceId: character.id, sourceType: "character" },
    });
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
        viewerCharacterId: character.id,
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);
    await prisma.campaignRosterEntry.create({
      data: {
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      },
    });
    await expect(
      service.getEntry({
        campaignId: campaign.id,
        entryId: created.entry.id,
        userId: player.id,
        viewerCharacterId: character.id,
      }),
    ).resolves.toMatchObject({ restrictedDetails: [{ detailText: "Restricted text" }] });

    for (const [index, controller] of [player.id, otherPlayer.id].entries()) {
      const scenario = await prisma.scenario.create({
        data: {
          campaignId: campaign.id,
          description: "Conflict",
          kind: "social",
          name: `Conflict ${index}`,
          status: "live",
        },
      });
      await prisma.scenarioParticipant.create({
        data: {
          characterId: character.id,
          controlledByUserId: controller,
          isActive: true,
          joinSource: "gm_added",
          role: "player_character",
          scenarioId: scenario.id,
          snapshotJson: {},
          sourceType: "character",
          stateJson: {},
        },
      });
    }
    for (const userId of [player.id, otherPlayer.id]) {
      await expect(
        service.getEntry({
          campaignId: campaign.id,
          entryId: created.entry.id,
          userId,
          viewerCharacterId: character.id,
        }),
      ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);
    }
  });

  it("preserves image snapshots across source change/withdrawal and enforces layout versions", async () => {
    const { campaign, gm, player } = await setupCampaign();
    const artifact = await createEligibleArtifact({ campaignId: campaign.id, gmUserId: gm.id });
    const created = (await service.createEntry(campaign.id, player.id, {
      category: "image_map",
      sourceArtifactId: artifact.id,
      title: "Pinned map",
    })) as { entry: { id: string } };

    await service.createPlacement(campaign.id, player.id, {
      entryId: created.entry.id,
      expectedLayoutVersion: 0,
      height: 600,
      layer: 1,
      width: 800,
      x: 25,
      y: 40,
    });
    await expect(
      service.createPlacement(campaign.id, gm.id, {
        entryId: created.entry.id,
        expectedLayoutVersion: 0,
        height: 600,
        layer: 1,
        width: 800,
        x: 25,
        y: 40,
      }),
    ).rejects.toBeInstanceOf(BlackboardConflictError);

    await service.updatePlacement(campaign.id, created.entry.id, gm.id, {
      expectedLayoutVersion: 1,
      expectedRowVersion: 1,
      height: 640,
      layer: 3,
      width: 900,
      x: 50,
      y: 75,
    });
    const companion = (await service.createEntry(campaign.id, player.id, {
      category: "clue_fact",
      fact: "The eastern arch is open.",
      title: "Open arch",
    })) as { entry: { id: string } };
    await service.createPlacement(campaign.id, player.id, {
      entryId: companion.entry.id,
      expectedLayoutVersion: 2,
      height: 240,
      layer: 2,
      width: 320,
      x: 500,
      y: 200,
    });
    const grouped = await service.groupPlacements(campaign.id, gm.id, {
      entryIds: [created.entry.id, companion.entry.id],
      expectedLayoutVersion: 3,
      expectedRowVersions: { [created.entry.id]: 2, [companion.entry.id]: 1 },
    });
    expect(grouped.groupId).toEqual(expect.any(String));
    expect(grouped.layout).toMatchObject({
      placements: [
        { entryId: companion.entry.id, groupId: grouped.groupId, rowVersion: 2 },
        { entryId: created.entry.id, groupId: grouped.groupId, rowVersion: 3 },
      ],
      version: 4,
    });

    await prisma.campaignAsset.update({
      data: { altText: "A newly described map", metadataVersion: { increment: 1 } },
      where: { id: artifact.id },
    });
    const changed = JSON.stringify(await service.getBoard(campaign.id, player.id));
    expect(changed).toContain("source_changed");
    expect(changed).toContain("A map of the old gate");
    expect(changed).not.toContain("A newly described map");

    await prisma.campaignAsset.update({
      data: { audience: "gm_private", metadataVersion: { increment: 1 } },
      where: { id: artifact.id },
    });
    const unavailable = JSON.stringify(await service.getBoard(campaign.id, gm.id));
    expect(unavailable).toContain("source_unavailable");
    expect(unavailable).not.toContain('"content"');
    expect(unavailable).not.toMatch(/storageUrl|storageKey|sha256Digest/);

    await service.retractEntry(campaign.id, created.entry.id, player.id, {
      expectedEntryVersion: 1,
    });
    const retracted = await service.getBoard(campaign.id, gm.id);
    expect(retracted).toMatchObject({
      layout: {
        placements: expect.arrayContaining([
          expect.objectContaining({ entryId: created.entry.id, rowVersion: 3 }),
        ]),
        version: 4,
      },
      tombstones: [{ id: created.entry.id, state: "Removed" }],
    });
    await service.updatePlacement(campaign.id, created.entry.id, player.id, {
      expectedLayoutVersion: 4,
      expectedRowVersion: 3,
      groupId: null,
      height: 640,
      layer: 4,
      width: 900,
      x: 75,
      y: 100,
    });
    await service.archiveEntry(campaign.id, created.entry.id, gm.id, {
      expectedEntryVersion: 2,
      expectedLayoutVersion: 5,
    });
    const afterArchive = await service.getBoard(campaign.id, player.id);
    expect(afterArchive.layout.version).toBe(6);
    expect(afterArchive.layout.placements.map((placement) => placement.entryId)).toEqual([
      companion.entry.id,
    ]);
    expect(afterArchive.tombstones).toEqual([]);

    await prisma.campaignAsset.delete({ where: { id: artifact.id } });
    const audit = await service.getAudit(campaign.id, created.entry.id, gm.id);
    expect(audit.revisions[0]).toMatchObject({
      content: { artifact: { altText: "A map of the old gate", id: artifact.id } },
    });
    expect(audit.sourceLinks).toEqual([]);
  });
}
