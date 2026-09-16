import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTestPrismaClient } from "../testing/testDatabase";
const prisma = getTestPrismaClient();
if (!prisma) describe.skip("AM1 migration compatibility (owned database required)", () => {});
else
  describe("AM1 populated legacy migration", () => {
    it("preserves IDs and bytes, backfills only managed ready live rows and preserves every classification", async () => {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("CREATE SCHEMA am1_migration_fixture");
        await tx.$executeRawUnsafe("SET LOCAL search_path TO am1_migration_fixture");
        await tx.$executeRawUnsafe(
          `CREATE TABLE "CampaignAsset" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "storageState" TEXT NOT NULL, "lifecycleState" TEXT NOT NULL, "storageProvider" TEXT NOT NULL, "storageKey" TEXT, "mediaTypeDetected" TEXT, "byteSize" BIGINT, "sha256Digest" TEXT, "originalFilename" TEXT, "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("campaignId","id"))`,
        );
        await tx.$executeRawUnsafe(
          `CREATE TABLE "ArtifactAuditEvent" ("action" TEXT CONSTRAINT "ArtifactAuditEvent_action_check" CHECK ("action" IN ('upload'))) `,
        );
        for (const state of ["ready", "legacy_reference", "pending", "failed", "deleted"])
          await tx.$executeRawUnsafe(
            `INSERT INTO "CampaignAsset" ("id","campaignId","storageState","lifecycleState","storageProvider","storageKey","mediaTypeDetected","byteSize","sha256Digest","createdByUserId") VALUES ($1,'campaign',$1,$2,'local',$1,'image/png',12,$3,'gm')`,
            state,
            state === "deleted" ? "deleted" : "active",
            "a".repeat(64),
          );
        const sql = readFileSync(
          new URL(
            "../../prisma/migrations/20260916120000_artifact_am1_revisions_import/migration.sql",
            import.meta.url,
          ),
          "utf8",
        );
        for (const statement of sql
          .replace(/--.*$/gm, "")
          .split(";")
          .map((x) => x.trim())
          .filter(Boolean))
          await tx.$executeRawUnsafe(statement);
        const rows = await tx.$queryRawUnsafe<
          Array<{ id: string; currentRevisionId: string | null }>
        >('SELECT "id", "currentRevisionId" FROM "CampaignAsset" ORDER BY "id"');
        expect(rows).toHaveLength(5);
        expect(rows.find((x) => x.id === "ready")!.currentRevisionId).toBe("initial:ready");
        expect(
          rows.filter((x) => x.id !== "ready").every((x) => x.currentRevisionId === null),
        ).toBe(true);
        expect(
          await tx.$queryRawUnsafe(
            'SELECT "artifactId", "storageKey", "byteSize" FROM "ArtifactRevision"',
          ),
        ).toEqual([{ artifactId: "ready", storageKey: "ready", byteSize: 12n }]);
        await tx.$executeRawUnsafe("DROP SCHEMA am1_migration_fixture CASCADE");
      });
    });
  });
