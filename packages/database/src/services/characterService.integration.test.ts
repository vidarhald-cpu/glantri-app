import { getApprovedTargetSkillDefinition } from "@glantri/content";
import { beforeEach, describe, expect, it } from "vitest";
import { characterBuildSchema } from "@glantri/domain";

import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { CampaignService } from "./campaignService";
import { CharacterService } from "./characterService";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("CharacterService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("CharacterService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("creates a character and retrieves it by owner", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!, { email: "owner@example.com" });
      const character = await createTestCharacter(prisma!, user.id, { name: "Brave Warrior" });

      const results = await service.listCharacters(user.id);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(character.id);
      expect(results[0].name).toBe("Brave Warrior");
      expect(results[0].ownerId).toBe(user.id);
    });

    it("persists a group-free target definition and retains owner-scoped reads", async () => {
      const service = new CharacterService(createPrismaCharacterRepository(prisma!));
      const owner = await createTestUser(prisma!, { email: "target-owner@example.test" });
      const unrelated = await createTestUser(prisma!, {
        email: "target-unrelated@example.test",
        roles: ["admin"],
      });
      const seed = await createTestCharacter(prisma!, owner.id);
      const original = await service.getCharacterById(seed.id);
      const targetDefinition = getApprovedTargetSkillDefinition("skill:poisons")!;
      const build = characterBuildSchema.parse({
        ...original!.build,
        id: "issue168-persisted-target",
        name: "Saved target",
        progression: {
          ...original!.build.progression,
          secondaryPoolSpent: 1,
          skills: [
            {
              skillId: targetDefinition.id,
              targetDefinition,
              category: "secondary",
              secondaryRanks: 1,
              ranks: 1,
            },
          ],
        },
      });
      await service.saveCharacter({ id: build.id, name: build.name, ownerId: owner.id, build });
      const reloaded = await service.getOwnedCharacter(owner.id, build.id);
      expect(reloaded?.build).toEqual(build);
      expect(reloaded?.build.progression.skills[0].groupId).toBeUndefined();
      expect(reloaded?.build.progression.skills[0].targetDefinition).toEqual(targetDefinition);
      expect(await service.getOwnedCharacter(unrelated.id, build.id)).toBeNull();
      expect((await service.listCharacters(unrelated.id)).some(({ id }) => id === build.id)).toBe(
        false,
      );
    });

    it("does not return another user's character via getOwnedCharacter", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const owner = await createTestUser(prisma!, { email: "owner@example.com" });
      const other = await createTestUser(prisma!, { email: "other@example.com" });
      const character = await createTestCharacter(prisma!, owner.id);

      const result = await service.getOwnedCharacter(other.id, character.id);

      expect(result).toBeNull();
    });

    it("lists characters filtered by ownerId", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const userA = await createTestUser(prisma!, { email: "a@example.com" });
      const userB = await createTestUser(prisma!, { email: "b@example.com" });

      await createTestCharacter(prisma!, userA.id, { name: "Character A" });
      await createTestCharacter(prisma!, userB.id, { name: "Character B" });

      const forA = await service.listCharacters(userA.id);
      const forB = await service.listCharacters(userB.id);

      expect(forA).toHaveLength(1);
      expect(forA[0].name).toBe("Character A");
      expect(forB).toHaveLength(1);
      expect(forB[0].name).toBe("Character B");
    });

    it("limits a GM list to owned characters and characters rostered in that GM's campaigns", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const otherGm = await createTestUser(prisma!, { roles: ["game_master"] });
      const player = await createTestUser(prisma!);
      const ownedByGm = await createTestCharacter(prisma!, gm.id, { name: "GM-owned" });
      const rostered = await createTestCharacter(prisma!, player.id, { name: "Rostered" });
      const outside = await createTestCharacter(prisma!, player.id, { name: "Outside" });
      const campaign = await createTestCampaign(prisma!, gm.id);
      const otherCampaign = await createTestCampaign(prisma!, otherGm.id);
      await prisma!.campaignRosterEntry.createMany({
        data: [
          {
            campaignId: campaign.id,
            category: "pc",
            sourceId: rostered.id,
            sourceType: "character",
          },
          {
            campaignId: otherCampaign.id,
            category: "pc",
            sourceId: outside.id,
            sourceType: "character",
          },
        ],
      });

      const accessible = await service.listAccessibleCharacters({
        isAdmin: false,
        isGameMaster: true,
        userId: gm.id,
      });

      expect(accessible.map((character) => character.id).sort()).toEqual(
        [ownedByGm.id, rostered.id].sort(),
      );
    });

    it("getOwnedCharacter returns the character when the ownerId matches", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!, { email: "owner2@example.com" });
      const character = await createTestCharacter(prisma!, user.id, { name: "My Hero" });

      const result = await service.getOwnedCharacter(user.id, character.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(character.id);
      expect(result!.ownerId).toBe(user.id);
    });

    it("getCharacterById returns the full character build with serialized fields", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id, {
        level: 2,
        name: "Serialized Hero",
      });

      const result = await service.getCharacterById(character.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(character.id);
      expect(result!.name).toBe("Serialized Hero");
      expect(result!.build.id).toBe(character.id);
      expect(result!.build.progression.level).toBe(2);
      expect(Array.isArray(result!.build.progression.skills)).toBe(true);
    });

    it("saveExistingCharacter returns null when the character does not exist", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const existing = await service.getCharacterById(character.id);

      const result = await service.saveExistingCharacter({
        build: existing!.build,
        characterId: "nonexistent-character-id-xyz",
        expectedUpdatedAt: existing!.updatedAt,
      });

      expect(result).toBeNull();
    });

    it("saveExistingCharacter updates an existing character and persists the new name", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id, { name: "Before Update" });

      const existing = await service.getCharacterById(character.id);
      expect(existing).not.toBeNull();

      const updatedBuild = { ...existing!.build, name: "After Update" };

      const result = await service.saveExistingCharacter({
        build: updatedBuild,
        characterId: character.id,
        expectedUpdatedAt: existing!.updatedAt,
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe("After Update");
      expect(result!.id).toBe(character.id);

      const refetched = await service.getCharacterById(character.id);
      expect(refetched!.name).toBe("After Update");
    });

    it("rejects divergent finalization under an existing id and leaves the canonical row unchanged", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);
      const owner = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Canonical" });
      const canonical = await service.getCharacterById(character.id);

      await expect(
        service.saveCharacter({
          build: { ...canonical!.build, name: "Divergent retry" },
          id: character.id,
          name: "Divergent retry",
          ownerId: owner.id,
        }),
      ).rejects.toMatchObject({ code: "character_already_exists" });

      await expect(service.getCharacterById(character.id)).resolves.toMatchObject({
        build: canonical!.build,
        name: "Canonical",
        ownerId: owner.id,
        updatedAt: canonical!.updatedAt,
      });
      await expect(prisma!.character.count({ where: { id: character.id } })).resolves.toBe(1);
    });

    it("rejects a stale second update and preserves the newer server build", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id, { name: "Original" });
      await prisma!.character.update({
        data: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
        where: { id: character.id },
      });
      const original = await service.getCharacterById(character.id);

      const first = await service.saveExistingCharacter({
        build: { ...original!.build, name: "First writer" },
        characterId: character.id,
        expectedUpdatedAt: original!.updatedAt,
      });

      await expect(
        service.saveExistingCharacter({
          build: { ...original!.build, name: "Stale writer" },
          characterId: character.id,
          expectedUpdatedAt: original!.updatedAt,
        }),
      ).rejects.toMatchObject({ code: "stale_character" });
      expect(first?.name).toBe("First writer");
      await expect(service.getCharacterById(character.id)).resolves.toMatchObject({
        name: "First writer",
      });
    });

    it("deletes the canonical character while preserving an immutable scenario snapshot", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);
      const owner = await createTestUser(prisma!);
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma!, gm.id);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Snapshotted Hero" });
      await prisma!.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const scenario = await prisma!.scenario.create({
        data: {
          campaignId: campaign.id,
          description: "Snapshot boundary",
          kind: "mixed",
          name: "Recorded scene",
          status: "draft",
        },
      });
      const snapshot = {
        build: { id: character.id, name: character.name },
        displayName: character.name,
        sourceUpdatedAt: "2026-08-13T00:00:00.000Z",
      };
      const participant = await prisma!.scenarioParticipant.create({
        data: {
          characterId: character.id,
          joinSource: "gm_added",
          role: "player_character",
          scenarioId: scenario.id,
          snapshotJson: snapshot,
          sourceType: "character",
          stateJson: { health: { currentHp: 8 } },
        },
      });
      const existing = await service.getCharacterById(character.id);

      await service.deleteExistingCharacter({
        characterId: character.id,
        expectedUpdatedAt: existing!.updatedAt,
      });

      await expect(service.getCharacterById(character.id)).resolves.toBeNull();
      await expect(
        prisma!.campaignRosterEntry.count({
          where: { sourceId: character.id, sourceType: "character" },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma!.scenarioParticipant.findUnique({ where: { id: participant.id } }),
      ).resolves.toMatchObject({
        characterId: null,
        snapshotJson: snapshot,
        stateJson: { health: { currentHp: 8 } },
      });
    });
    describe("current authorized control read access", () => {
      let controlFixtureSequence = 0;

      async function createControlFixture(overrides?: {
        isActive?: boolean;
        participantRole?: "player_character" | "npc";
        scenarioStatus?: "draft" | "live" | "paused" | "completed" | "archived";
      }) {
        const fixtureId = `${Date.now()}-${(controlFixtureSequence += 1)}`;
        const gm = await createTestUser(prisma!, {
          email: `control-gm-${fixtureId}@example.test`,
        });
        const player = await createTestUser(prisma!, {
          email: `control-player-${fixtureId}@example.test`,
        });
        const campaign = await createTestCampaign(prisma!, gm.id);
        const character = await createTestCharacter(prisma!, gm.id, { name: "GM Pregen" });
        const scenario = await prisma!.scenario.create({
          data: {
            campaignId: campaign.id,
            description: "Control fixture",
            kind: "combat",
            name: "Control fixture",
            status: overrides?.scenarioStatus ?? "live",
          },
        });
        await prisma!.scenarioParticipant.create({
          data: {
            characterId: character.id,
            controlledByUserId: player.id,
            isActive: overrides?.isActive ?? true,
            joinSource: "gm_added",
            role: overrides?.participantRole ?? "player_character",
            scenarioId: scenario.id,
            snapshotJson: { displayName: "GM Pregen" },
            sourceType: "character",
            stateJson: { combat: {}, equipment: {}, health: {}, resources: {} },
          },
        });

        return { campaign, character, gm, player, scenario };
      }

      it("reads a controlled Character whose ownerId is null", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture();
        await prisma!.character.update({
          data: { ownerId: null },
          where: { id: fixture.character.id },
        });

        const result = await service.getCharacterUnderPlayerControl(
          fixture.player.id,
          fixture.character.id,
        );

        expect(result?.id).toBe(fixture.character.id);
        expect(result?.ownerId).toBeNull();
        expect(await service.getOwnedCharacter(fixture.player.id, fixture.character.id)).toBeNull();
      });

      it("reads a controlled Character owned by another user", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture();

        const result = await service.getCharacterUnderPlayerControl(
          fixture.player.id,
          fixture.character.id,
        );

        expect(result?.id).toBe(fixture.character.id);
        expect(result?.ownerId).toBe(fixture.gm.id);
      });

      it("refuses an inactive participant row", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture({ isActive: false });

        await expect(
          service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
        ).resolves.toBeNull();
      });

      it("refuses control recorded on a Scenario that never opened for play", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture({ scenarioStatus: "draft" });

        await expect(
          service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
        ).resolves.toBeNull();
      });

      it("refuses a participant row that is not a player Character", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture({ participantRole: "npc" });

        await expect(
          service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
        ).resolves.toBeNull();
      });

      it("refuses control that was withdrawn from the participant row", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture();
        await prisma!.scenarioParticipant.updateMany({
          data: { controlledByUserId: null },
          where: { characterId: fixture.character.id },
        });

        await expect(
          service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
        ).resolves.toBeNull();
      });

      it("does not reach an unrelated Character in the same Scenario", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture();
        const otherPlayer = await createTestUser(prisma!, {
          email: `control-other-${Date.now()}-${(controlFixtureSequence += 1)}@example.test`,
        });
        const otherCharacter = await createTestCharacter(prisma!, otherPlayer.id, {
          name: "Someone Else",
        });
        await prisma!.scenarioParticipant.create({
          data: {
            characterId: otherCharacter.id,
            controlledByUserId: otherPlayer.id,
            isActive: true,
            joinSource: "gm_added",
            role: "player_character",
            scenarioId: fixture.scenario.id,
            snapshotJson: {},
            sourceType: "character",
            stateJson: {},
          },
        });

        await expect(
          service.getCharacterUnderPlayerControl(fixture.player.id, otherCharacter.id),
        ).resolves.toBeNull();
      });

      it("keeps a Scenario the player still reads readable after it completes", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture({ scenarioStatus: "completed" });

        await expect(
          service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
        ).resolves.not.toBeNull();
      });

      it("grants in every readable Scenario status and refuses only draft", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));

        for (const scenarioStatus of ["live", "paused", "completed", "archived"] as const) {
          const fixture = await createControlFixture({ scenarioStatus });

          expect(
            await service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
          ).not.toBeNull();
        }

        const draftFixture = await createControlFixture({ scenarioStatus: "draft" });

        expect(
          await service.getCharacterUnderPlayerControl(
            draftFixture.player.id,
            draftFixture.character.id,
          ),
        ).toBeNull();
      });

      /**
       * Forgejo #439 floor-QA finding F3. A participant may carry a `characterId` while being
       * sourced from a reusable entity — nothing in the schema forbids it — and such a row is
       * **not** an authorized Character-control assignment. The `sourceType: "character"`
       * conjunct in `findUnderPlayerControl` is what denies it, and this case exists so that
       * conjunct cannot be deleted without a failing test.
       */
      it("refuses an entity-sourced participant that carries a characterId", async () => {
        const service = new CharacterService(createPrismaCharacterRepository(prisma!));
        const fixture = await createControlFixture();
        await prisma!.scenarioParticipant.updateMany({
          data: { sourceType: "entity" },
          where: { characterId: fixture.character.id },
        });

        const participant = await prisma!.scenarioParticipant.findFirstOrThrow({
          where: { characterId: fixture.character.id },
        });

        expect(participant.sourceType).toBe("entity");
        expect(participant.characterId).toBe(fixture.character.id);
        expect(participant.controlledByUserId).toBe(fixture.player.id);
        expect(participant.isActive).toBe(true);
        expect(participant.role).toBe("player_character");

        expect(
          await service.getCharacterUnderPlayerControl(fixture.player.id, fixture.character.id),
        ).toBeNull();
      });

      describe("revocation reachability", () => {
        for (const scenarioStatus of ["completed", "archived"] as const) {
          it(`revokes control through the dedicated path in a ${scenarioStatus} Scenario`, async () => {
            const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
            const scenarioRepository = createPrismaScenarioRepository(prisma!);
            const scenarioService = new ScenarioService(scenarioRepository);
            const fixture = await createControlFixture({ scenarioStatus });
            const participant = await prisma!.scenarioParticipant.findFirstOrThrow({
              where: { characterId: fixture.character.id },
            });

            expect(
              await characterService.getCharacterUnderPlayerControl(
                fixture.player.id,
                fixture.character.id,
              ),
            ).not.toBeNull();

            await scenarioService.revokeScenarioParticipantControl({
              participantId: participant.id,
              scenarioId: fixture.scenario.id,
            });

            expect(
              await characterService.getCharacterUnderPlayerControl(
                fixture.player.id,
                fixture.character.id,
              ),
            ).toBeNull();

            const afterRevocation = await prisma!.scenarioParticipant.findFirstOrThrow({
              where: { id: participant.id },
            });

            expect(afterRevocation.controlledByUserId).toBeNull();
            expect(afterRevocation.characterId).toBe(fixture.character.id);
            expect(afterRevocation.isActive).toBe(true);
            expect(afterRevocation.role).toBe(participant.role);
            expect(afterRevocation.sourceType).toBe(participant.sourceType);
          });

          it(`leaves everything else in a ${scenarioStatus} Scenario immutable`, async () => {
            const scenarioRepository = createPrismaScenarioRepository(prisma!);
            const scenarioService = new ScenarioService(scenarioRepository);
            const fixture = await createControlFixture({ scenarioStatus });
            const participant = await prisma!.scenarioParticipant.findFirstOrThrow({
              where: { characterId: fixture.character.id },
            });

            await expect(
              scenarioService.updateScenarioParticipantMetadata({
                isActive: false,
                participantId: participant.id,
                scenarioId: fixture.scenario.id,
              }),
            ).rejects.toThrow("Scenario is not editable in its current status.");

            await expect(
              scenarioService.updateScenarioParticipantMetadata({
                participantId: participant.id,
                roleTag: "changed",
                scenarioId: fixture.scenario.id,
              }),
            ).rejects.toThrow("Scenario is not editable in its current status.");

            const unchanged = await prisma!.scenarioParticipant.findFirstOrThrow({
              where: { id: participant.id },
            });

            expect(unchanged.isActive).toBe(true);
            expect(unchanged.roleTag).toBeNull();
            expect(unchanged.controlledByUserId).toBe(fixture.player.id);
          });
        }

        it("ends the grant when the Character's Campaign roster membership ends", async () => {
          const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
          const scenarioRepository = createPrismaScenarioRepository(prisma!);
          const campaignService = new CampaignService(
            scenarioRepository,
            new CharacterService(createPrismaCharacterRepository(prisma!)),
          );
          const fixture = await createControlFixture({ scenarioStatus: "completed" });
          const participant = await prisma!.scenarioParticipant.findFirstOrThrow({
            where: { characterId: fixture.character.id },
          });
          const rosterEntry = await campaignService.addCampaignRosterEntry({
            campaignId: fixture.campaign.id,
            category: "pc",
            sourceId: fixture.character.id,
            sourceType: "character",
          });

          expect(
            await characterService.getCharacterUnderPlayerControl(
              fixture.player.id,
              fixture.character.id,
            ),
          ).not.toBeNull();

          await campaignService.removeCampaignRosterEntry({
            campaignId: fixture.campaign.id,
            rosterEntryId: rosterEntry.id,
          });

          expect(
            await characterService.getCharacterUnderPlayerControl(
              fixture.player.id,
              fixture.character.id,
            ),
          ).toBeNull();

          const afterRemoval = await prisma!.scenarioParticipant.findFirst({
            where: { id: participant.id },
          });

          expect(afterRemoval).not.toBeNull();
          expect(afterRemoval?.controlledByUserId).toBeNull();
          expect(afterRemoval?.characterId).toBe(fixture.character.id);
          expect(afterRemoval?.isActive).toBe(true);
          expect(afterRemoval?.role).toBe(participant.role);

          const remainingRosterEntry = await prisma!.campaignRosterEntry.findFirstOrThrow({
            where: { id: rosterEntry.id },
          });

          expect(remainingRosterEntry.membershipState).toBe("former");
        });

        it("ends the grant when the player leaves the Campaign with their own Character", async () => {
          const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
          const scenarioRepository = createPrismaScenarioRepository(prisma!);
          const campaignService = new CampaignService(
            scenarioRepository,
            new CharacterService(createPrismaCharacterRepository(prisma!)),
          );
          const fixture = await createControlFixture({ scenarioStatus: "archived" });
          const participant = await prisma!.scenarioParticipant.findFirstOrThrow({
            where: { characterId: fixture.character.id },
          });
          await campaignService.addCampaignRosterEntry({
            campaignId: fixture.campaign.id,
            category: "pc",
            sourceId: fixture.character.id,
            sourceType: "character",
          });

          await campaignService.leaveCampaign({
            campaignId: fixture.campaign.id,
            characterId: fixture.character.id,
            ownerUserId: fixture.gm.id,
          });

          expect(
            await characterService.getCharacterUnderPlayerControl(
              fixture.player.id,
              fixture.character.id,
            ),
          ).toBeNull();

          const afterRemoval = await prisma!.scenarioParticipant.findFirst({
            where: { id: participant.id },
          });

          expect(afterRemoval).not.toBeNull();
          expect(afterRemoval?.controlledByUserId).toBeNull();
          expect(afterRemoval?.isActive).toBe(true);
        });

        it("does not disturb participants of another Campaign when a roster membership ends", async () => {
          const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
          const scenarioRepository = createPrismaScenarioRepository(prisma!);
          const campaignService = new CampaignService(
            scenarioRepository,
            new CharacterService(createPrismaCharacterRepository(prisma!)),
          );
          const removed = await createControlFixture({ scenarioStatus: "completed" });
          const untouched = await createControlFixture({ scenarioStatus: "completed" });
          const rosterEntry = await campaignService.addCampaignRosterEntry({
            campaignId: removed.campaign.id,
            category: "pc",
            sourceId: removed.character.id,
            sourceType: "character",
          });

          await campaignService.removeCampaignRosterEntry({
            campaignId: removed.campaign.id,
            rosterEntryId: rosterEntry.id,
          });

          expect(
            await characterService.getCharacterUnderPlayerControl(
              untouched.player.id,
              untouched.character.id,
            ),
          ).not.toBeNull();
        });
      });
    });
  });
}
