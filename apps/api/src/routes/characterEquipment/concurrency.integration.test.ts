import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthService,
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
} from "@glantri/database";
import {
  createTestCampaign,
  createTestCharacter,
  createTestUser,
  getTestPrismaClient,
  resetTestDatabase,
} from "@glantri/database/testing";
import { createPrismaCharacterEquipmentRepository } from "@glantri/database/repositories/characterEquipmentRepository";

import { buildApiServer } from "../../app";
import { SESSION_COOKIE_NAME } from "../../lib/sessionAuth";

// Use the guarded, owned test database for every real API service and session.
vi.mock("@glantri/database/client", async (importOriginal) => {
  const { getTestPrismaClient } = await import("@glantri/database/testing/testDatabase");
  const testClient = getTestPrismaClient();
  return testClient ? { prisma: testClient } : importOriginal();
});

const prisma = getTestPrismaClient();

describe.skipIf(!prisma)("Equipment GET concurrency integration", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetTestDatabase(prisma!);
    app = buildApiServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function cookieFor(userId: string) {
    const { token } = await new AuthService().createSessionForUser(userId);
    return `${SESSION_COOKIE_NAME}=${token}`;
  }

  it.each(["new", "aggregate only", "initialized"])(
    "serves concurrent GETs (initialized: %s)",
    async (initialized) => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      if (initialized === "aggregate only") {
        await prisma!.characterEquipmentAggregate.create({ data: { characterId: character.id } });
      }
      if (initialized === "initialized") {
        await new CharacterEquipmentWriteService().ensureCharacterEquipmentInitialized(
          character.id,
        );
      }
      const { token } = await new AuthService().createSessionForUser(user.id);
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          app.inject({
            method: "GET",
            url: `/characters/${character.id}/equipment`,
            headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
          }),
        ),
      );
      expect(
        responses.map((response) => ({
          status: response.statusCode,
          error: response.json().error,
        })),
      ).toEqual(responses.map(() => ({ status: 200, error: undefined })));
      const states = responses.map((response) => response.json().state);
      for (const state of states) expect(state).toEqual(states[0]);
      expect(
        await prisma!.characterEquipmentAggregate.count({ where: { characterId: character.id } }),
      ).toBe(1);
      expect(await prisma!.characterLoadout.count({ where: { characterId: character.id } })).toBe(
        1,
      );
      expect(states[0].revision).toBe(1);
      expect(Object.keys(states[0].locationsById).length).toBeGreaterThan(0);
    },
  );

  it("serves two blocked GETs at the committed revision after an atomic equipment update", async () => {
    const user = await createTestUser(prisma!);
    const character = await createTestCharacter(prisma!, user.id);
    const service = new CharacterEquipmentWriteService();
    const initialized = await service.ensureCharacterEquipmentInitialized(character.id);
    const item = await service.addCharacterEquipmentItem(character.id, {
      templateId: "weapon-template-dagger",
      quantity: 1,
      initialCarryMode: "on_person",
      initialLocationId: initialized.locations.find(
        (location) => location.type === "person_system",
      )!.id,
    });
    const repo = createPrismaCharacterEquipmentRepository(prisma!);
    const before = await repo.getCharacterEquipmentAggregateState(character.id);
    const cookie = await cookieFor(user.id);
    let release!: () => void;
    let locked!: () => void;
    const releaseWriter = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writerLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const writer = repo.mutateCharacterEquipmentAggregate({
      characterId: character.id,
      expectedRevision: before.revision,
      mutation: async (transaction) => {
        await transaction.updateCharacterEquipmentItem({ ...item, quantity: 2 });
        locked();
        await releaseWriter;
      },
    });
    await Promise.race([writerLocked, writer]);
    const requests = Array.from({ length: 2 }, () =>
      app.inject({
        method: "GET",
        url: `/characters/${character.id}/equipment`,
        headers: { cookie },
      }),
    );
    const responsesPromise = Promise.all(requests);
    try {
      // Observe actual PostgreSQL lock waits rather than hoping the requests overlap.
      const deadline = Date.now() + 3000;
      let blocked = 0;
      while (blocked < 2 && Date.now() < deadline) {
        const rows = await prisma!.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%CharacterEquipmentAggregate%' AND query LIKE '%FOR SHARE%'
        `;
        blocked = rows[0].count;
        if (blocked < 2) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(2);
    } finally {
      release();
      await writer;
      await responsesPromise;
    }
    const responses = await responsesPromise;
    for (const response of responses) {
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().state.revision).toBe(before.revision + 1);
      expect(response.json().state.itemsById[item.id]).toMatchObject({ id: item.id, quantity: 2 });
    }
    expect(await repo.getCharacterEquipmentAggregateState(character.id)).toMatchObject({
      revision: before.revision + 1,
      loadouts: before.loadouts,
    });
    await expect(
      service.updateCharacterEquipmentQuantity(character.id, item.id, 9, before.revision),
    ).rejects.toThrow("Character equipment changed");
    expect((await repo.getCanonicalEquipmentItemById(item.id))?.quantity).toBe(2);
  });

  it("preserves relationship authority and private Item projection during concurrent reads", async () => {
    const owner = await createTestUser(prisma!);
    const gm = await createTestUser(prisma!, { roles: ["game_master"] });
    const outsiders = await Promise.all([
      createTestUser(prisma!),
      createTestUser(prisma!, { roles: ["game_master"] }),
      createTestUser(prisma!, { roles: ["admin"] }),
    ]);
    const character = await createTestCharacter(prisma!, owner.id);
    const campaign = await createTestCampaign(prisma!, gm.id);
    await prisma!.campaignRosterEntry.create({
      data: {
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      },
    });
    const item = await new CharacterEquipmentWriteService().createCampaignEquipmentItem({
      campaignId: campaign.id,
      holderCharacterId: character.id,
      templateId: "weapon-template-dagger",
      itemFacts: {
        version: 1,
        activeMechanics: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
        descriptiveTraits: [
          {
            id: "private-history",
            category: "history",
            text: "Secret former owner",
            visibility: "gm_only",
          },
        ],
      },
    });
    const perspectives = await Promise.all(
      [owner, gm, ...outsiders].map(async (user) => ({
        id: user.id,
        cookie: await cookieFor(user.id),
      })),
    );
    await Promise.all(
      perspectives.map(async (viewer) => {
        const responses = await Promise.all(
          Array.from({ length: 2 }, () =>
            app.inject({
              method: "GET",
              url: `/characters/${character.id}/equipment`,
              headers: { cookie: viewer.cookie },
            }),
          ),
        );
        for (const response of responses) {
          if (viewer.id === gm.id || viewer.id === owner.id) {
            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().state.itemsById[item.id].id).toBe(item.id);
            if (viewer.id === gm.id) expect(response.body).toContain("Secret former owner");
            else {
              expect(response.body).not.toContain("Secret former owner");
              expect(response.body).not.toContain("private-history");
            }
          } else {
            expect(response.statusCode).toBe(404);
            expect(response.json()).toEqual({ error: "Character not found." });
          }
        }
      }),
    );
  });

  it("waits for a committed revision without 40001 and blocks writers between component reads", async () => {
    const user = await createTestUser(prisma!);
    const character = await createTestCharacter(prisma!, user.id);
    const service = new CharacterEquipmentWriteService();
    const initialized = await service.ensureCharacterEquipmentInitialized(character.id);
    const person = initialized.locations.find((location) => location.type === "person_system")!;
    const item = await service.addCharacterEquipmentItem(character.id, {
      templateId: "valuable-template-gold-coins",
      quantity: 1,
      initialCarryMode: "on_person",
      initialLocationId: person.id,
    });
    const repo = createPrismaCharacterEquipmentRepository(prisma!);
    const readService = new CharacterEquipmentReadModelService(repo);
    const before = await readService.getCharacterEquipmentState(character.id);
    const queryFailures: unknown[] = [];
    let beforeItemQuery: (() => Promise<void>) | undefined;
    const observedClient = prisma!.$extends({
      query: {
        async $queryRaw({ args, query }) {
          try {
            return await query(args);
          } catch (error) {
            queryFailures.push(error);
            throw error;
          }
        },
        characterEquipmentItem: {
          async findMany({ args, query }) {
            const hook = beforeItemQuery;
            beforeItemQuery = undefined;
            await hook?.();
            return query(args);
          },
        },
      },
    });
    const observedReadService = new CharacterEquipmentReadModelService(
      createPrismaCharacterEquipmentRepository(
        observedClient as unknown as NonNullable<typeof prisma>,
      ),
    );
    async function updateComponents(transaction: typeof repo, quantity: number) {
      await transaction.updateCharacterEquipmentItem({ ...item, quantity });
      await transaction.createCharacterEquipmentItem({
        ...item,
        id: `${item.id}:extra-${quantity}`,
      });
      await transaction.createCharacterStorageLocation({
        ...person,
        id: `${character.id}:home-${quantity}`,
        type: "home",
        name: `Home ${quantity}`,
        availabilityClass: "elsewhere",
        isAccessibleInEncounter: false,
        isMobile: false,
      });
      await transaction.upsertCharacterLoadout({
        ...before.activeLoadoutByCharacterId[character.id],
        notes: `Loadout ${quantity}`,
      });
    }
    async function waitForLocks(clause: string, count: number) {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const rows = await prisma!.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%CharacterEquipmentAggregate%' AND query LIKE ${`%${clause}%`}
        `;
        if (rows[0].count === count) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Expected ${count} aggregate lock waits for ${clause}`);
    }

    let release!: () => void;
    let locked!: () => void;
    const releaseWriter = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writerLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const writer = repo.mutateCharacterEquipmentAggregate({
      characterId: character.id,
      expectedRevision: before.revision,
      mutation: async (transaction) => {
        await updateComponents(transaction, 2);
        locked();
        await releaseWriter;
      },
    });
    await Promise.race([writerLocked, writer]);
    const reads = Promise.all(
      Array.from({ length: 2 }, () => observedReadService.getCharacterEquipmentState(character.id)),
    );
    try {
      await waitForLocks("FOR SHARE", 2);
    } finally {
      release();
      await writer;
      await reads;
    }
    const committed = await readService.getCharacterEquipmentState(character.id);
    expect(committed.revision).toBe(before.revision + 1);
    expect(committed.itemsById[item.id].quantity).toBe(2);
    expect(committed.itemsById[`${item.id}:extra-2`].id).toBe(`${item.id}:extra-2`);
    expect(committed.locationsById[`${character.id}:home-2`].name).toBe("Home 2");
    expect(committed.activeLoadoutByCharacterId[character.id].notes).toBe("Loadout 2");
    for (const state of await reads) expect(state).toEqual(committed);

    // Start a second writer after revision lookup but before Item lookup. It
    // must remain blocked until every component of the reader has been loaded.
    let secondWriter: ReturnType<typeof repo.mutateCharacterEquipmentAggregate> | undefined;
    beforeItemQuery = async () => {
      secondWriter = repo.mutateCharacterEquipmentAggregate({
        characterId: character.id,
        expectedRevision: committed.revision,
        mutation: (transaction) => updateComponents(transaction, 3),
      });
      void secondWriter.catch(() => undefined);
      await waitForLocks("FOR UPDATE", 1);
    };
    let whileWriting: typeof committed;
    try {
      whileWriting = await observedReadService.getCharacterEquipmentState(character.id);
    } finally {
      await secondWriter;
    }
    expect(whileWriting).toEqual(committed);
    const after = await readService.getCharacterEquipmentState(character.id);
    expect(after.revision).toBe(committed.revision + 1);
    expect(after.itemsById[item.id].quantity).toBe(3);
    expect(after.itemsById[`${item.id}:extra-3`].id).toBe(`${item.id}:extra-3`);
    expect(after.locationsById[`${character.id}:home-3`].name).toBe("Home 3");
    expect(after.activeLoadoutByCharacterId[character.id].notes).toBe("Loadout 3");
    expect(queryFailures).toEqual([]);
  }, 15000);
});
