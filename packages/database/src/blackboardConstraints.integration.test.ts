import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BlackboardRepository } from "./repositories/blackboardRepository";
import { createPrismaCharacterRepository } from "./repositories/characterRepository";
import { createPrismaScenarioRepository } from "./repositories/scenarioRepository";
import { BlackboardService } from "./services/blackboardService";
import { CampaignService } from "./services/campaignService";
import { CharacterService } from "./services/characterService";
import { createTestCampaign, createTestCharacter, createTestUser } from "./testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "./testing/testDatabase";

const prisma = getTestPrismaClient()!;

if (!prisma) {
  describe.skip("Blackboard constraints (DATABASE_URL_TEST not set)", () => {});
} else {
  const scenarioRepository = createPrismaScenarioRepository(prisma);
  const service = new BlackboardService(
    new BlackboardRepository(prisma),
    new CampaignService(
      scenarioRepository,
      new CharacterService(createPrismaCharacterRepository(prisma)),
    ),
  );

  beforeEach(async () => resetTestDatabase(prisma));
  afterAll(async () => resetTestDatabase(prisma));

  it("installs every reviewed composite key and deferred head constraint exactly", async () => {
    const constraints = await prisma.$queryRaw<
      Array<{
        condeferrable: boolean;
        condeferred: boolean;
        confdeltype: string;
        confupdtype: string;
        conname: string;
        definition: string;
      }>
    >(Prisma.sql`
      SELECT
        con.conname,
        con.condeferrable,
        con.condeferred,
        con.confdeltype::text,
        con.confupdtype::text,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      WHERE con.conname LIKE 'bb_%'
      ORDER BY con.conname
    `);
    const byName = new Map(constraints.map((constraint) => [constraint.conname, constraint]));
    const expectedConstraintNames = [
      "bb_artifact_source_asset_fk",
      "bb_artifact_source_link_pkey",
      "bb_artifact_source_revision_fk",
      "bb_entry_actor_label_check",
      "bb_entry_campaign_fk",
      "bb_entry_category_check",
      "bb_entry_created_actor_fk",
      "bb_entry_current_revision_fk",
      "bb_entry_event_action_check",
      "bb_entry_event_actor_fk",
      "bb_entry_event_actor_label_check",
      "bb_entry_event_entry_fk",
      "bb_entry_event_pkey",
      "bb_entry_event_revision_check",
      "bb_entry_event_version_check",
      "bb_entry_revision_check",
      "bb_entry_state_actor_fk",
      "bb_entry_state_check",
      "bb_entry_version_check",
      "bb_grant_event_actor_fk",
      "bb_grant_event_label_check",
      "bb_grant_event_pkey",
      "bb_grant_event_revision_unit_fk",
      "bb_grant_event_state_check",
      "bb_grant_event_stream_fk",
      "bb_grant_event_version_check",
      "bb_grant_stream_character_identity_check",
      "bb_grant_stream_current_event_fk",
      "bb_grant_stream_entry_fk",
      "bb_grant_stream_live_character_fk",
      "bb_grant_stream_pkey",
      "bb_grant_stream_state_check",
      "bb_grant_stream_unit_version_fk",
      "bb_grant_stream_version_check",
      "bb_layout_campaign_fk",
      "bb_layout_version_check",
      "bb_placement_actor_fk",
      "bb_placement_actor_label_check",
      "bb_placement_bounds_check",
      "bb_placement_entry_fk",
      "bb_placement_layout_fk",
      "bb_placement_pkey",
      "bb_placement_row_version_check",
      "bb_revision_actor_fk",
      "bb_revision_actor_label_check",
      "bb_revision_approver_fk",
      "bb_revision_content_check",
      "bb_revision_entry_category_fk",
      "bb_revision_kind_check",
      "bb_revision_number_check",
      "bb_revision_pkey",
      "bb_revision_title_check",
      "bb_revision_unit_pkey",
      "bb_revision_unit_revision_fk",
      "bb_revision_unit_sort_check",
      "bb_revision_unit_version_check",
      "bb_revision_unit_version_fk",
      "bb_unit_lineage_pkey",
      "bb_unit_lineage_entry_fk",
      "bb_unit_lineage_key_check",
      "bb_unit_version_actor_fk",
      "bb_unit_version_actor_label_check",
      "bb_unit_version_label_check",
      "bb_unit_version_lineage_fk",
      "bb_unit_version_number_check",
      "bb_unit_version_pkey",
      "bb_unit_version_text_check",
    ].sort();
    expect([...byName.keys()]).toEqual(expectedConstraintNames);
    for (const name of [
      "bb_entry_current_revision_fk",
      "bb_grant_event_revision_unit_fk",
      "bb_grant_stream_current_event_fk",
      "bb_grant_stream_unit_version_fk",
      "bb_revision_unit_version_fk",
    ]) {
      expect(byName.get(name)).toMatchObject({ condeferrable: true, condeferred: true });
    }
    expect(byName.get("bb_grant_stream_live_character_fk")).toMatchObject({
      confdeltype: "n",
      confupdtype: "r",
    });
    expect(byName.get("bb_grant_event_revision_unit_fk")).toMatchObject({
      confdeltype: "a",
      confupdtype: "r",
    });
    expect(byName.get("bb_entry_current_revision_fk")?.definition).toContain(
      '("campaignId", id, "currentRevisionNumber")',
    );
    expect(byName.get("bb_entry_current_revision_fk")?.definition).toContain(
      'REFERENCES "CampaignBlackboardEntryRevision"("campaignId", "entryId", "revisionNumber")',
    );
    expect(byName.get("bb_revision_entry_category_fk")?.definition).toContain(
      'FOREIGN KEY ("campaignId", "entryId", category) REFERENCES "CampaignBlackboardEntry"("campaignId", id, category)',
    );
    expect(byName.get("bb_revision_unit_version_fk")?.definition).toContain(
      'FOREIGN KEY ("campaignId", "entryId", "unitKey", "unitVersion") REFERENCES "CampaignBlackboardDetailUnitVersion"("campaignId", "entryId", "unitKey", "unitVersion")',
    );
    expect(byName.get("bb_grant_event_revision_unit_fk")?.definition).toContain(
      'FOREIGN KEY ("campaignId", "entryId", "entryRevisionNumber", "unitKey", "unitVersion") REFERENCES "CampaignBlackboardRevisionDetailUnit"("campaignId", "entryId", "revisionNumber", "unitKey", "unitVersion")',
    );
    expect(byName.get("bb_grant_stream_current_event_fk")?.definition).toContain(
      'FOREIGN KEY ("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion", state, "currentEntryRevisionNumber") REFERENCES "CampaignBlackboardDetailGrantEvent"("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion", "resultState", "entryRevisionNumber")',
    );

    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>(
      Prisma.sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE 'bb_%'
      `,
    );
    expect(indexes.map((index) => index.indexname)).toEqual(
      expect.arrayContaining([
        "bb_entry_campaign_id_id_category_key",
        "bb_entry_campaign_id_id_key",
        "bb_grant_event_head_key",
        "bb_revision_unit_exact_key",
        "bb_revision_unit_sort_key",
      ]),
    );
    const indexesByName = new Map(indexes.map((index) => [index.indexname, index.indexdef]));
    expect(indexesByName.get("bb_entry_campaign_id_id_category_key")).toContain(
      '("campaignId", id, category)',
    );
    expect(indexesByName.get("bb_revision_unit_exact_key")).toContain(
      '("campaignId", "entryId", "revisionNumber", "unitKey", "unitVersion")',
    );
    expect(indexesByName.get("bb_grant_event_head_key")).toContain(
      '("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion", "resultState", "entryRevisionNumber")',
    );

    const columns = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>(
      Prisma.sql`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CampaignBlackboardDetailGrantStream'
      `,
    );
    expect(columns.find((column) => column.column_name === "liveCharacterId")?.is_nullable).toBe(
      "YES",
    );
    expect(
      columns.find((column) => column.column_name === "targetCharacterIdSnapshot")?.is_nullable,
    ).toBe("NO");
  });

  it("rejects headless/mismatched grant audit and partial membership deletion at commit", async () => {
    const gm = await createTestUser(prisma, {
      displayName: "Constraint GM",
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
    const created = (await service.createEntry(campaign.id, gm.id, {
      category: "document_text",
      documentText: "Public",
      restrictedDetails: [{ detailText: "Restricted", sortOrder: 0 }],
      title: "Document",
    })) as { entry: { id: string } };
    const audit = await service.getAudit(campaign.id, created.entry.id, gm.id);
    const unit = audit.unitVersions[0]!;
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

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.campaignBlackboardDetailGrantStream.updateMany({
          data: { currentEntryRevisionNumber: 99 },
          where: { campaignId: campaign.id, entryId: created.entry.id },
        });
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.campaignBlackboardRevisionDetailUnit.deleteMany({
          where: { campaignId: campaign.id, entryId: created.entry.id, revisionNumber: 1 },
        });
      }),
    ).rejects.toThrow();
    expect(await prisma.campaignBlackboardDetailGrantStream.count()).toBe(1);
    expect(await prisma.campaignBlackboardDetailGrantEvent.count()).toBe(1);
    expect(await prisma.campaignBlackboardRevisionDetailUnit.count()).toBe(1);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    expect(await prisma.campaignBlackboardEntry.count()).toBe(0);
    expect(await prisma.campaignBlackboardDetailGrantEvent.count()).toBe(0);
  });

  it("rejects foreign revision/category/unit/source relations", async () => {
    const gm = await createTestUser(prisma, { roles: ["game_master"] });
    const campaignA = await createTestCampaign(prisma, gm.id, { status: "active" });
    const campaignB = await createTestCampaign(prisma, gm.id, { status: "active" });
    const created = (await service.createEntry(campaignA.id, gm.id, {
      category: "clue_fact",
      fact: "Fact",
      title: "Clue",
    })) as { entry: { id: string } };

    await expect(
      prisma.campaignBlackboardEntryRevision.create({
        data: {
          actorLabelSnapshot: "GM",
          actorUserId: gm.id,
          campaignId: campaignB.id,
          category: "clue_fact",
          changeKind: "correction",
          clueFact: "Foreign",
          entryId: created.entry.id,
          revisionNumber: 2,
          title: "Foreign",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.campaignBlackboardDetailUnitVersion.create({
        data: {
          campaignId: campaignA.id,
          createdByLabelSnapshot: "GM",
          createdByUserId: gm.id,
          detailText: "Orphan",
          entryId: created.entry.id,
          unitKey: "missing-lineage",
          unitVersion: 1,
        },
      }),
    ).rejects.toThrow();
  });
}
