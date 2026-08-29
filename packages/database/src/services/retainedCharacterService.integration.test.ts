import { beforeEach, describe, expect, it } from "vitest";

import { createParticipantSnapshotFromCharacter, type CharacterBuild } from "@glantri/domain";

import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaRetainedCharacterRepository } from "../repositories/retainedCharacterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCampaign, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { CampaignService } from "./campaignService";
import { CharacterService } from "./characterService";
import {
  createPilotCharacterVersionEnvelope,
  RetainedCharacterService,
} from "./retainedCharacterService";

const prisma = getTestPrismaClient();

function build(characterId: string, name: string): CharacterBuild {
  return {
    equipment: { items: [] },
    id: characterId,
    name,
    profile: {
      description: "Headless retained Character",
      distractionLevel: 3,
      id: `profile:${characterId}`,
      label: "Retained profile",
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
      secondaryPoolTotal: 26,
      skillGroups: [],
      skills: [],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
  };
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("RetainedCharacterService integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("RetainedCharacterService integration", () => {
    beforeEach(async () => resetTestDatabase(prisma!));

    function services() {
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const retained = new RetainedCharacterService(
        createPrismaRetainedCharacterRepository(prisma!),
        characterService,
      );
      return {
        campaign: new CampaignService(createPrismaScenarioRepository(prisma!), characterService),
        characterService,
        retained,
      };
    }

    it("finalizes, reloads, and idempotently retries all three required canonical builds", async () => {
      const owner = await createTestUser(prisma!);
      const { retained } = services();
      const fixtures = [
        "character:pilot:glantrian-retainer-veteran",
        "character:pilot:mogrebi-temple-physician",
        "character:pilot:nkolian-caravan-scout",
      ];

      for (const [index, pilotCharacterId] of fixtures.entries()) {
        const characterBuild = build(`retained-${index}`, `Retained ${index}`);
        const command = {
          build: characterBuild,
          configuration: { flexBudget: 26, formationBudget: 60, id: "campaign-chargen:pilot" },
          idempotencyKey: `finalize-${index}`,
          pilotCharacterId,
        };
        const first = await retained.finalizeHeadless({
          actor: { isAdmin: false, userId: owner.id },
          command,
        });
        const reloaded = await retained.getRevision(characterBuild.id, first.revision.id);
        const retry = await retained.finalizeHeadless({
          actor: { isAdmin: false, userId: owner.id },
          command,
        });

        expect(reloaded).toMatchObject({
          effectiveSkills: first.revision.effectiveSkills,
          events: first.revision.events,
          state: first.revision.state,
          versionEnvelope: first.revision.versionEnvelope,
        });
        expect(retry.revision).toEqual(first.revision);
        expect(retry.character.retainedRevision?.characterRevisionId).toBe(first.revision.id);
      }
      await expect(prisma!.character.count()).resolves.toBe(3);
      await expect(prisma!.characterRevision.count()).resolves.toBe(3);
    });

    it("advances a durable history, rejects stale work, and keeps Profession changes inert", async () => {
      const owner = await createTestUser(prisma!);
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const { campaign, retained } = services();
      const finalized = await retained.finalizeHeadless({
        actor: { isAdmin: false, userId: owner.id },
        command: {
          build: build("veteran", "Veteran"),
          configuration: { flexBudget: 26, formationBudget: 60, id: "pilot" },
          idempotencyKey: "finalize-veteran",
          pilotCharacterId: "character:pilot:glantrian-retainer-veteran",
        },
      });
      const activeCampaign = await createTestCampaign(prisma!, gm.id, { status: "active" });
      await campaign.addCampaignRosterEntry({
        actorUserId: gm.id,
        campaignId: activeCampaign.id,
        category: "pc",
        sourceId: "veteran",
        sourceType: "character",
      });
      const history = finalized.revision.state.histories.find((entry) => entry.level === 2)!;
      const advanced = await retained.advanceLearningHistory({
        actor: { isAdmin: false, userId: gm.id },
        characterId: "veteran",
        expectedRevisionId: finalized.revision.id,
        historyInstanceId: history.instanceId,
        idempotencyKey: "advance-western-border",
        reason: "Veteran campaign training approved by the GM.",
        targetLevel: 5,
      });
      await expect(
        retained.advanceLearningHistory({
          actor: { isAdmin: false, userId: gm.id },
          characterId: "veteran",
          expectedRevisionId: finalized.revision.id,
          historyInstanceId: history.instanceId,
          idempotencyKey: "advance-western-border",
          reason: "Veteran campaign training approved by the GM.",
          targetLevel: 5,
        }),
      ).resolves.toEqual(advanced);
      await expect(
        retained.advanceLearningHistory({
          actor: { isAdmin: false, userId: gm.id },
          characterId: "veteran",
          expectedRevisionId: finalized.revision.id,
          historyInstanceId: history.instanceId,
          idempotencyKey: "advance-western-border",
          reason: "Changed payload",
          targetLevel: 6,
        }),
      ).rejects.toMatchObject({ code: "retained_character_idempotency_conflict" });
      const swordBefore = finalized.revision.effectiveSkills.rows.find(
        (row) => row.competencyId === "skill:sword",
      )!;
      const swordAfter = advanced.effectiveSkills.rows.find(
        (row) => row.competencyId === "skill:sword",
      )!;
      expect(swordBefore.effectiveLevel).toBe(6);
      expect(swordAfter).toMatchObject({
        directAcquisition: 2,
        effectiveLevel: 7,
        strongestHistoryContribution: 5,
      });
      expect(
        advanced.events.find((entry) => entry.eventKind === "learning_history_advanced"),
      ).toMatchObject({
        eventKind: "learning_history_advanced",
        valueAfter: 5,
        valueBefore: 2,
      });

      await expect(
        retained.advanceLearningHistory({
          actor: { isAdmin: false, userId: gm.id },
          characterId: "veteran",
          expectedRevisionId: finalized.revision.id,
          historyInstanceId: history.instanceId,
          idempotencyKey: "stale-advance",
          reason: "Stale",
          targetLevel: 6,
        }),
      ).rejects.toMatchObject({ code: "retained_character_stale_revision" });

      const changed = await retained.changeProfessionContext({
        actor: { isAdmin: false, userId: owner.id },
        characterId: "veteran",
        expectedRevisionId: advanced.id,
        idempotencyKey: "profession-context",
        professionId: "profession:retired-guard",
        reason: "Now works as a caravan factor.",
      });
      expect(changed.state.professionId).toBe("profession:retired-guard");
      expect(changed.effectiveSkills.rows).toEqual(advanced.effectiveSkills.rows);
    });

    it("previews without mutation, applies and rolls back through explicit retained lineage", async () => {
      const owner = await createTestUser(prisma!);
      const { retained } = services();
      const finalized = await retained.finalizeHeadless({
        actor: { isAdmin: false, userId: owner.id },
        command: {
          build: build("physician", "Physician"),
          configuration: { flexBudget: 26, formationBudget: 60, id: "pilot-v1" },
          idempotencyKey: "finalize-physician",
          pilotCharacterId: "character:pilot:mogrebi-temple-physician",
        },
      });
      const snapshot = createParticipantSnapshotFromCharacter({
        build: finalized.character.build,
        retainedCharacterRevision: finalized.character.retainedRevision ?? undefined,
        sourceUpdatedAt: finalized.character.updatedAt,
      }).snapshot;
      const targetEnvelope = createPilotCharacterVersionEnvelope({
        flexBudget: 26,
        formationBudget: 60,
        id: "pilot-maintenance-accepted",
      });
      const preview = await retained.previewMigration({
        actor: { isAdmin: false, userId: owner.id },
        characterId: "physician",
        expectedRevisionId: finalized.revision.id,
        migrationId: "migration:representative-v1",
        targetEnvelope,
      });
      expect(preview.mutatesCharacter).toBe(false);
      expect(await retained.getRevision("physician", finalized.revision.id)).toEqual(
        finalized.revision,
      );

      const migrated = await retained.applyMigration({
        actor: { isAdmin: false, userId: owner.id },
        idempotencyKey: "apply-migration",
        preview,
      });
      expect(migrated).toMatchObject({
        migrationLineage: {
          migrationId: "migration:representative-v1",
          sourceRevisionId: finalized.revision.id,
          status: "migration_applied",
        },
        parentRevisionId: finalized.revision.id,
        revisionState: "current",
      });
      expect(await retained.getRevision("physician", finalized.revision.id)).toMatchObject({
        revisionState: "historical",
      });

      const rolledBack = await retained.rollbackMigration({
        actor: { isAdmin: false, userId: owner.id },
        characterId: "physician",
        expectedRevisionId: migrated.id,
        idempotencyKey: "rollback-migration",
        migrationRevisionId: migrated.id,
      });
      expect(rolledBack.versionEnvelope).toEqual(finalized.revision.versionEnvelope);
      expect(rolledBack.migrationLineage).toMatchObject({
        rollbackOfRevisionId: migrated.id,
        sourceRevisionId: finalized.revision.id,
        status: "rollback_applied",
      });
      expect(rolledBack.revisionState).toBe("current");
      expect(await retained.getRevision("physician", migrated.id)).toMatchObject({
        revisionState: "historical",
      });
      expect(snapshot.retainedCharacterRevision?.characterRevisionId).toBe(finalized.revision.id);
      expect(snapshot.retainedCharacterRevision?.characterRevisionId).not.toBe(rolledBack.id);
    });

    it("requires the current Campaign GM to apply maintenance for a rostered Character", async () => {
      const owner = await createTestUser(prisma!, { email: "migration-owner@example.test" });
      const gm = await createTestUser(prisma!, {
        email: "migration-gm@example.test",
        roles: ["game_master"],
      });
      const { campaign, retained } = services();
      const finalized = await retained.finalizeHeadless({
        actor: { isAdmin: false, userId: owner.id },
        command: {
          build: build("rostered-migration", "Rostered migration"),
          configuration: { flexBudget: 26, formationBudget: 60, id: "pilot-v1" },
          idempotencyKey: "finalize-rostered-migration",
          pilotCharacterId: "character:pilot:mogrebi-temple-physician",
        },
      });
      const activeCampaign = await createTestCampaign(prisma!, gm.id, { status: "active" });
      await campaign.addCampaignRosterEntry({
        actorUserId: gm.id,
        campaignId: activeCampaign.id,
        category: "pc",
        sourceId: finalized.character.id,
        sourceType: "character",
      });
      const preview = await retained.previewMigration({
        actor: { isAdmin: false, userId: owner.id },
        characterId: finalized.character.id,
        expectedRevisionId: finalized.revision.id,
        migrationId: "migration:rostered-maintenance",
        targetEnvelope: createPilotCharacterVersionEnvelope({
          flexBudget: 26,
          formationBudget: 60,
          id: "pilot-rostered-maintenance",
        }),
      });

      await expect(
        retained.applyMigration({
          actor: { isAdmin: false, userId: owner.id },
          idempotencyKey: "owner-cannot-apply-rostered",
          preview,
        }),
      ).rejects.toMatchObject({ code: "retained_character_unauthorized" });

      await expect(
        retained.applyMigration({
          actor: { isAdmin: false, userId: gm.id },
          idempotencyKey: "gm-applies-rostered",
          preview,
        }),
      ).resolves.toMatchObject({
        actorUserId: gm.id,
        migrationLineage: { status: "migration_applied" },
      });
    });
  });
}
