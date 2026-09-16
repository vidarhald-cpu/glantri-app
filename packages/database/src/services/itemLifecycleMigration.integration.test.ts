import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getTestPrismaClient } from "../testing/testDatabase";

const prisma = getTestPrismaClient();
describe.skipIf(!process.env.DATABASE_URL_TEST)("additive Item lifecycle migration", () => {
  it("retains IDs, bindings and byte-identical synthetic historical reference payloads", async () => {
    const schema = `item_migration_${randomUUID().replaceAll("-", "")}`;
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20260916090000_item_lifecycle_inputs/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await prisma!.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(
        'CREATE TABLE "CharacterEquipmentItem" ("id" TEXT PRIMARY KEY, "templateId" TEXT NOT NULL, "category" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL, "itemFactsJson" JSONB)',
      );
      await tx.$executeRawUnsafe(
        'CREATE TABLE "HistoricalReferences" ("kind" TEXT PRIMARY KEY, "itemId" TEXT REFERENCES "CharacterEquipmentItem"("id"), "payload" TEXT NOT NULL)',
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "CharacterEquipmentItem" VALUES ('stable-item', 'weapon-template-dagger', 'weapon', '2026-01-01', '{"version":1,"unknownLegacy":{"keep":false}}')`,
      );
      const payload =
        '{ "itemId": "stable-item", "unknownLegacy": {"keep":false}, "snapshot": [1, 0] }';
      for (const kind of ["Campaign", "loadout", "Scenario", "Encounter", "undo"])
        await tx.$executeRawUnsafe(
          'INSERT INTO "HistoricalReferences" VALUES ($1, $2, $3)',
          kind,
          "stable-item",
          payload,
        );
      const before = await tx.$queryRawUnsafe(
        'SELECT "id", "templateId", "category", "updatedAt", "itemFactsJson"::text FROM "CharacterEquipmentItem"',
      );
      const historicalBefore = await tx.$queryRawUnsafe(
        'SELECT * FROM "HistoricalReferences" ORDER BY "kind"',
      );
      // Dollar-quoted function bodies contain semicolons: split only top-level statements.
      const statements = migration.match(/(?:[^;$]|\$(?!\$)|\$\$[\s\S]*?\$\$)+;/g)!;
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      expect(
        await tx.$queryRawUnsafe(
          'SELECT "id", "templateId", "category", "updatedAt", "itemFactsJson"::text FROM "CharacterEquipmentItem"',
        ),
      ).toEqual(before);
      expect(
        await tx.$queryRawUnsafe('SELECT * FROM "HistoricalReferences" ORDER BY "kind"'),
      ).toEqual(historicalBefore);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  });
});
