import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  BlackboardRepository,
  type BlackboardRepositoryConcurrencyHooks,
} from "./repositories/blackboardRepository";
import { createPrismaCharacterRepository } from "./repositories/characterRepository";
import { createPrismaScenarioRepository } from "./repositories/scenarioRepository";
import {
  BlackboardConflictError,
  BlackboardReferenceUnavailableError,
  BlackboardService,
} from "./services/blackboardService";
import { CampaignService } from "./services/campaignService";
import { CharacterService } from "./services/characterService";
import { createTestCampaign, createTestCharacter, createTestUser } from "./testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "./testing/testDatabase";

const prisma = getTestPrismaClient()!;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

async function waitForBlockedTransactionLock() {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<Array<{ blocked: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS blocked
      FROM pg_locks
      WHERE NOT granted AND locktype = 'transactionid'
    `);
    if (Number(row?.blocked ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The grant did not reach the expected PostgreSQL lock wait.");
}

if (!prisma) {
  describe.skip("Blackboard concurrency tests (DATABASE_URL_TEST not set)", () => {});
} else {
  const scenarioRepository = createPrismaScenarioRepository(prisma);
  const campaignService = new CampaignService(
    scenarioRepository,
    new CharacterService(createPrismaCharacterRepository(prisma)),
  );
  const ordinaryService = new BlackboardService(new BlackboardRepository(prisma), campaignService);

  async function setupGrantedDocument() {
    const gm = await createTestUser(prisma, {
      displayName: "Concurrency GM",
      roles: ["game_master"],
    });
    const player = await createTestUser(prisma, { displayName: "Player" });
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
    const created = (await ordinaryService.createEntry(campaign.id, gm.id, {
      category: "document_text",
      documentText: "Public text",
      restrictedDetails: [{ detailText: "Secret text", sortOrder: 0 }],
      title: "Document",
    })) as { entry: { id: string } };
    const audit = await ordinaryService.getAudit(campaign.id, created.entry.id, gm.id);
    return {
      campaign,
      character,
      entryId: created.entry.id,
      gm,
      player,
      unit: audit.unitVersions[0]!,
    };
  }

  function serviceWithHooks(hooks: BlackboardRepositoryConcurrencyHooks) {
    return new BlackboardService(new BlackboardRepository(prisma, hooks), campaignService);
  }

  beforeEach(async () => resetTestDatabase(prisma));
  afterAll(async () => resetTestDatabase(prisma));

  it("makes correction-first stale grant return 409 semantics with zero grant mutation", async () => {
    const fixture = await setupGrantedDocument();
    const entered = deferred();
    const release = deferred();
    const service = serviceWithHooks({
      afterEntryLock: async (operation) => {
        if (operation !== "revision") return;
        entered.resolve();
        await release.promise;
      },
    });
    const correction = service.reviseEntry(fixture.campaign.id, fixture.entryId, fixture.gm.id, {
      category: "document_text",
      changeKind: "correction",
      documentText: "Corrected public text",
      expectedEntryVersion: 1,
      restrictedDetails: [
        {
          detailText: "Secret text",
          sortOrder: 0,
          unitKey: fixture.unit.unitKey,
        },
      ],
      title: "Document",
    });
    await entered.promise;
    const grant = service.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    const grantResult = grant.then(
      () => null,
      (error: unknown) => error,
    );
    release.resolve();
    await expect(correction).resolves.toBeDefined();
    expect(await grantResult).toMatchObject({ retryable: false });
    expect(await prisma.campaignBlackboardDetailGrantStream.count()).toBe(0);
    expect(await prisma.campaignBlackboardDetailGrantEvent.count()).toBe(0);
  });

  it("allows grant-first unchanged unit to remain effective and serializes duplicate commands", async () => {
    const fixture = await setupGrantedDocument();
    const entered = deferred();
    const release = deferred();
    let armed = true;
    const service = serviceWithHooks({
      afterGrantStreamLock: async () => {
        if (!armed) return;
        armed = false;
        entered.resolve();
        await release.promise;
      },
    });
    const grant = service.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    await entered.promise;
    const correction = service.reviseEntry(fixture.campaign.id, fixture.entryId, fixture.gm.id, {
      category: "document_text",
      changeKind: "correction",
      documentText: "Corrected public text",
      expectedEntryVersion: 1,
      restrictedDetails: [
        {
          detailText: "Secret text",
          sortOrder: 0,
          unitKey: fixture.unit.unitKey,
        },
      ],
      title: "Document",
    });
    release.resolve();
    await expect(grant).resolves.toEqual({ state: "granted" });
    await expect(correction).resolves.toBeDefined();
    expect(
      await prisma.campaignBlackboardRevisionDetailUnit.count({
        where: { unitKey: fixture.unit.unitKey, unitVersion: 1 },
      }),
    ).toBe(2);
    await expect(
      ordinaryService.getEntry({
        campaignId: fixture.campaign.id,
        entryId: fixture.entryId,
        userId: fixture.player.id,
        viewerCharacterId: fixture.character.id,
      }),
    ).resolves.toMatchObject({ restrictedDetails: [{ detailText: "Secret text" }] });

    const duplicateA = ordinaryService.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "revoke",
        expectedEntryVersion: 2,
        expectedGrantVersion: 1,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    const duplicateB = ordinaryService.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "revoke",
        expectedEntryVersion: 2,
        expectedGrantVersion: 1,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    const results = await Promise.allSettled([duplicateA, duplicateB]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.campaignBlackboardDetailGrantEvent.count()).toBe(2);
  });

  it("sanitizes a Character-delete deadlock victim and retry fails closed after deletion", async () => {
    const fixture = await setupGrantedDocument();
    await ordinaryService.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    await ordinaryService.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "revoke",
        expectedEntryVersion: 1,
        expectedGrantVersion: 1,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    const commonBefore = JSON.stringify(
      await ordinaryService.getBoard(fixture.campaign.id, fixture.player.id),
    );
    const characterLocked = deferred();
    const allowDelete = deferred();
    const deletion = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "Character"
        WHERE "id" = ${fixture.character.id}
        FOR UPDATE
      `);
      characterLocked.resolve();
      await allowDelete.promise;
      return tx.character.delete({ where: { id: fixture.character.id } });
    });
    const deletionResult = deletion.then(
      (character) => character,
      (error: unknown) => error,
    );
    await characterLocked.promise;
    const entered = deferred();
    const service = serviceWithHooks({
      afterGrantStreamLock: async (tx) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL deadlock_timeout = '50ms'`);
        entered.resolve();
      },
    });
    const grant = service.changeGrant({
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      entryId: fixture.entryId,
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 2,
        unitVersion: 1,
      },
      unitKey: fixture.unit.unitKey,
      userId: fixture.gm.id,
    });
    const grantResult = grant.then(
      () => null,
      (error: unknown) => error,
    );
    await entered.promise;
    await waitForBlockedTransactionLock();
    allowDelete.resolve();

    expect(await grantResult).toEqual(
      expect.objectContaining<Partial<BlackboardConflictError>>({ retryable: true }),
    );
    expect(await deletionResult).toMatchObject({ id: fixture.character.id });
    expect(await prisma.campaignBlackboardDetailGrantEvent.count()).toBe(2);
    expect(JSON.stringify(await ordinaryService.getBoard(fixture.campaign.id, fixture.gm.id))).toBe(
      commonBefore,
    );
    await expect(
      ordinaryService.changeGrant({
        campaignId: fixture.campaign.id,
        characterId: fixture.character.id,
        entryId: fixture.entryId,
        rawInput: {
          action: "grant",
          expectedEntryVersion: 1,
          expectedGrantVersion: 2,
          unitVersion: 1,
        },
        unitKey: fixture.unit.unitKey,
        userId: fixture.gm.id,
      }),
    ).rejects.toBeInstanceOf(BlackboardReferenceUnavailableError);
  });

  it("serializes concurrent first pins on different entries into one layout head", async () => {
    const gm = await createTestUser(prisma, {
      displayName: "Layout GM",
      roles: ["game_master"],
    });
    const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
    const entries = await Promise.all(
      ["First", "Second"].map((title) =>
        ordinaryService.createEntry(campaign.id, gm.id, {
          category: "clue_fact",
          fact: `${title} fact`,
          title,
        }),
      ),
    );
    const entryIds = entries.map((result) => (result as { entry: { id: string } }).entry.id);
    const bothLocked = deferred();
    const release = deferred();
    let lockCount = 0;
    const service = serviceWithHooks({
      afterEntryLock: async (operation) => {
        if (operation !== "layout") return;
        lockCount += 1;
        if (lockCount === 2) bothLocked.resolve();
        await release.promise;
      },
    });
    const pins = entryIds.map((entryId, index) =>
      service.createPlacement(campaign.id, gm.id, {
        entryId,
        expectedLayoutVersion: 0,
        height: 240,
        layer: index,
        width: 320,
        x: index * 10,
        y: index * 10,
      }),
    );
    await bothLocked.promise;
    release.resolve();

    const results = await Promise.allSettled(pins);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    expect(rejected?.reason).toBeInstanceOf(BlackboardConflictError);
    expect(
      await prisma.campaignBlackboardLayout.findUniqueOrThrow({
        where: { campaignId: campaign.id },
      }),
    ).toMatchObject({ layoutVersion: 1 });
    expect(
      await prisma.campaignBlackboardPlacement.count({
        where: { campaignId: campaign.id },
      }),
    ).toBe(1);
  });
}
