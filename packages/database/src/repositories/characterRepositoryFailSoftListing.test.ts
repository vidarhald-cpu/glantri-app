import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getApprovedV2RuntimeContent } from "@glantri/content";

import { createPrismaCharacterRepository } from "./characterRepository";

/**
 * Forgejo #764: one Character whose catalogue snapshot no longer matches must not deny the
 * owner the whole list. `GET /characters` returned 500 and the Product Owner lost access to
 * both of their Characters.
 *
 * These are unit tests over a stub Prisma client, so they run without a database.
 */

const divergentGroup = getApprovedV2RuntimeContent().skillGroups.find(
  (group) => (group.skillMemberships?.length ?? 0) > 0,
)!;

function buildFor(input: { id: string; name: string; skillGroups?: unknown[] }) {
  return {
    equipment: { items: [] },
    id: input.id,
    name: input.name,
    profile: {
      description: "Fixture profile",
      distractionLevel: 3,
      id: `profile-${input.id}`,
      label: "Profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: input.skillGroups ?? [],
      skills: [],
      specializations: [],
    },
    progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
  };
}

const validRow = {
  build: buildFor({ id: "character-valid", name: "Validates" }),
  createdAt: new Date("2026-10-22T16:06:05.994Z"),
  id: "character-valid",
  level: 1,
  name: "Validates",
  owner: null,
  ownerId: "owner-1",
  updatedAt: new Date("2026-10-22T16:06:05.994Z"),
};

/** A real mechanical divergence: the stored snapshot claims a different sortOrder. */
const divergentRow = {
  build: buildFor({
    id: "character-divergent",
    name: "Does not validate",
    skillGroups: [
      {
        grantedRanks: 0,
        groupId: divergentGroup.id,
        primaryRanks: 0,
        ranks: 0,
        secondaryRanks: 0,
        targetDefinition: { ...divergentGroup, sortOrder: divergentGroup.sortOrder + 1 },
      },
    ],
  }),
  createdAt: new Date("2026-10-20T14:29:29.344Z"),
  id: "character-divergent",
  level: 1,
  name: "Does not validate",
  owner: null,
  ownerId: "owner-1",
  updatedAt: new Date("2026-10-20T14:29:29.344Z"),
};

function stubClient(rows: unknown[]): PrismaClient {
  return {
    character: {
      findMany: async () => rows,
      findFirst: async () => rows[0] ?? null,
      findUnique: async () => rows[0] ?? null,
    },
    campaignRosterEntry: {
      findMany: async () => rows.map((row) => ({ sourceId: (row as { id: string }).id })),
    },
  } as unknown as PrismaClient;
}

describe("GET /characters fails soft per Character (#764)", () => {
  it("returns the Character that validates alongside the one that does not", async () => {
    const repository = createPrismaCharacterRepository(stubClient([validRow, divergentRow]));

    const characters = await repository.listByOwner("owner-1");

    expect(characters.map(({ id }) => id)).toEqual(["character-valid", "character-divergent"]);
  });

  it("marks the one that does not validate, and leaves the other unmarked", async () => {
    const repository = createPrismaCharacterRepository(stubClient([validRow, divergentRow]));

    const [valid, divergent] = await repository.listByOwner("owner-1");

    expect(valid.snapshotIntegrity).toBeUndefined();
    expect(divergent.snapshotIntegrity).toEqual({
      reasons: [
        `Learning Group ${divergentGroup.id} does not match the approved target definition.`,
      ],
      status: "snapshot-mismatch",
    });
  });

  it("marks rather than swallows: the reasons are still reported in full", async () => {
    const repository = createPrismaCharacterRepository(stubClient([divergentRow]));

    const [divergent] = await repository.listAll();

    expect(divergent.snapshotIntegrity?.reasons).not.toEqual([]);
    expect(divergent.snapshotIntegrity?.reasons.join(" ")).toContain(divergentGroup.id);
  });

  it("applies to every list path, not only the owner list", async () => {
    for (const list of ["listAll", "listByOwner", "listInGmCampaigns"] as const) {
      const repository = createPrismaCharacterRepository(stubClient([divergentRow]));
      const characters = await repository[list]("owner-1");
      expect(characters, list).toHaveLength(1);
      expect(characters[0].snapshotIntegrity?.status, list).toBe("snapshot-mismatch");
    }
  });

  it("returns the persisted build untouched — no read-path write, no self-heal", async () => {
    const stored = structuredClone(divergentRow.build);
    const repository = createPrismaCharacterRepository(stubClient([divergentRow]));

    const [divergent] = await repository.listAll();

    expect(divergent.build.progression.skillGroups[0].targetDefinition!.sortOrder).toBe(
      divergentGroup.sortOrder + 1,
    );
    // The row object the "database" handed over is byte-identical afterwards.
    expect(divergentRow.build).toEqual(stored);
  });

  it("still fails hard on a single-Character read, which is unchanged behaviour", async () => {
    const repository = createPrismaCharacterRepository(stubClient([divergentRow]));

    await expect(repository.findById("character-divergent")).rejects.toThrow(
      /does not match the approved target definition/,
    );
  });
});
