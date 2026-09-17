import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getTestPrismaClient } from "../testing/testDatabase";

const prisma = getTestPrismaClient();

describe.skipIf(!process.env.DATABASE_URL_TEST)("additive Map Workspace migration", () => {
  it("applies over a populated pre-change fixture without rewriting existing Campaign data", async () => {
    const schema = `map_migration_${randomUUID().replaceAll("-", "")}`;
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20260917124500_map_workspace_v1/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    await prisma!.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(
        'CREATE TABLE "Campaign" ("id" TEXT PRIMARY KEY, "payload" JSONB NOT NULL)',
      );
      await tx.$executeRawUnsafe(
        'CREATE TABLE "CampaignAsset" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "title" TEXT NOT NULL, UNIQUE ("campaignId", "id"))',
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "Campaign" VALUES ('campaign-stable', '{"unknownLegacy":{"keep":true},"order":[2,1]}')`,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "CampaignAsset" VALUES ('artifact-stable', 'campaign-stable', 'Existing background')`,
      );
      const campaignBefore = await tx.$queryRawUnsafe(
        'SELECT "id", "payload"::text FROM "Campaign"',
      );
      const artifactBefore = await tx.$queryRawUnsafe(
        'SELECT "id", "campaignId", "title" FROM "CampaignAsset"',
      );

      for (const statement of migration
        .replace(/--.*$/gm, "")
        .split(";")
        .map((value) => value.trim())
        .filter(Boolean)) {
        await tx.$executeRawUnsafe(statement);
      }

      expect(await tx.$queryRawUnsafe('SELECT "id", "payload"::text FROM "Campaign"')).toEqual(
        campaignBefore,
      );
      expect(
        await tx.$queryRawUnsafe('SELECT "id", "campaignId", "title" FROM "CampaignAsset"'),
      ).toEqual(artifactBefore);
      expect(await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM "CampaignMap"')).toEqual([
        { count: 0 },
      ]);

      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  });
});
