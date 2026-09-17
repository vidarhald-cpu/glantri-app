import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { CampaignMapRepository, CampaignMapConflictError } from "../repositories/mapRepository";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { CampaignMapService } from "./mapService";

const prisma = getTestPrismaClient();

if (!prisma) {
  describe.skip("Campaign Map integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Campaign Map integration", () => {
    beforeEach(async () => resetTestDatabase(prisma));
    afterAll(async () => resetTestDatabase(prisma));

    it("keeps stable identity through graph, marker, background and stale-save edits", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const player = await createTestUser(prisma);
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const character = await createTestCharacter(prisma, player.id);
      await prisma.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          labelSnapshot: character.name,
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const repository = new CampaignMapRepository(prisma);
      const service = new CampaignMapService(repository);
      const mapA = await service.create({
        actorUserId: gm.id,
        campaignId: campaign.id,
        payload: { name: "Map A" },
      });
      const mapB = await service.create({
        actorUserId: gm.id,
        campaignId: campaign.id,
        payload: { name: "Map B" },
      });
      const mapC = await service.create({
        actorUserId: gm.id,
        campaignId: campaign.id,
        payload: { name: "Map C" },
      });

      const updatedA = await service.replaceAggregate({
        actorUserId: gm.id,
        campaignId: campaign.id,
        mapId: mapA.id,
        payload: {
          access: "players",
          backgroundArtifactId: null,
          description: "Five annotations can be added without a background.",
          expectedVersion: mapA.version,
          layers: [
            {
              id: "layer-a",
              markers: [
                {
                  description: "Map-only position",
                  destinationMapId: null,
                  entityLabelSnapshot: character.name,
                  entityReferenceId: character.id,
                  entityReferenceType: "character",
                  id: "character-marker",
                  kind: "entity_reference",
                  label: "The traveller",
                  presentation: "T",
                  sortOrder: 0,
                  visibility: "player_visible",
                  x: 0.25,
                  y: 0.75,
                },
                {
                  description: "To B",
                  destinationMapId: mapB.id,
                  entityLabelSnapshot: null,
                  entityReferenceId: null,
                  entityReferenceType: null,
                  id: "a-to-b",
                  kind: "map_link",
                  label: "Road to B",
                  presentation: "↗",
                  sortOrder: 1,
                  visibility: "inherit",
                  x: 0.8,
                  y: 0.2,
                },
              ],
              name: "Places",
              sortOrder: 0,
              visibility: "player_visible",
            },
          ],
          name: "Map A",
          role: "area",
        },
      });
      expect(updatedA.id).toBe(mapA.id);
      expect(updatedA.version).toBe(2);

      await service.replaceAggregate({
        actorUserId: gm.id,
        campaignId: campaign.id,
        mapId: mapB.id,
        payload: {
          access: "players",
          backgroundArtifactId: null,
          description: "Cycle back to A",
          expectedVersion: mapB.version,
          layers: [
            {
              id: "layer-b",
              markers: [
                {
                  description: "Back to A",
                  destinationMapId: mapA.id,
                  entityLabelSnapshot: null,
                  entityReferenceId: null,
                  entityReferenceType: null,
                  id: "b-to-a",
                  kind: "map_link",
                  label: "Return to A",
                  presentation: "↗",
                  sortOrder: 0,
                  visibility: "inherit",
                  x: 0.5,
                  y: 0.5,
                },
              ],
              name: "Links",
              sortOrder: 0,
              visibility: "player_visible",
            },
          ],
          name: "Map B",
          role: "area",
        },
      });
      await service.replaceAggregate({
        actorUserId: gm.id,
        campaignId: campaign.id,
        mapId: mapC.id,
        payload: {
          access: "gm_only",
          backgroundArtifactId: null,
          description: "Second inbound link",
          expectedVersion: mapC.version,
          layers: [
            {
              id: "layer-c",
              markers: [
                {
                  description: "Also to B",
                  destinationMapId: mapB.id,
                  entityLabelSnapshot: null,
                  entityReferenceId: null,
                  entityReferenceType: null,
                  id: "c-to-b",
                  kind: "map_link",
                  label: "Another road",
                  presentation: "↗",
                  sortOrder: 0,
                  visibility: "inherit",
                  x: 0.5,
                  y: 0.5,
                },
              ],
              name: "Links",
              sortOrder: 0,
              visibility: "gm_only",
            },
          ],
          name: "Map C",
          role: "world_region",
        },
      });
      expect(await prisma.campaignMapMarker.count({ where: { destinationMapId: mapB.id } })).toBe(
        2,
      );

      await expect(
        service.replaceAggregate({
          actorUserId: gm.id,
          campaignId: campaign.id,
          mapId: mapA.id,
          payload: {
            access: "gm_only",
            backgroundArtifactId: null,
            description: "Stale overwrite",
            expectedVersion: mapA.version,
            layers: [],
            name: "Stale",
            role: "area",
          },
        }),
      ).rejects.toBeInstanceOf(CampaignMapConflictError);
      expect(
        await prisma.campaignMapMarker.findUnique({ where: { id: "character-marker" } }),
      ).toMatchObject({
        x: 0.25,
        y: 0.75,
      });

      await prisma.campaignRosterEntry.updateMany({
        data: { membershipState: "former" },
        where: { campaignId: campaign.id, sourceId: character.id },
      });
      expect(await service.authoringOptions(campaign.id, gm.id)).toMatchObject({
        entities: expect.arrayContaining([
          { id: character.id, label: character.name, type: "character" },
        ]),
      });
      const former = await service.getForUser(campaign.id, mapA.id, gm.id);
      expect(former.mode).toBe("gm");
      if (former.mode === "gm") {
        expect(former.map.layers[0]?.markers[0]).toMatchObject({
          id: "character-marker",
          referenceStatus: "available",
        });
      }

      await prisma.campaignRosterEntry.deleteMany({
        where: { campaignId: campaign.id, sourceId: character.id },
      });
      const broken = await service.getForUser(campaign.id, mapA.id, gm.id);
      expect(broken.mode).toBe("gm");
      if (broken.mode === "gm") {
        expect(broken.map.layers[0]?.markers[0]).toMatchObject({
          id: "character-marker",
          referenceStatus: "unavailable",
          x: 0.25,
          y: 0.75,
        });
        await expect(
          service.replaceAggregate({
            actorUserId: gm.id,
            campaignId: campaign.id,
            mapId: mapA.id,
            payload: {
              access: broken.map.access,
              backgroundArtifactId: null,
              description: "Broken reference preserved",
              expectedVersion: broken.map.version,
              layers: broken.map.layers.map((layer) => ({
                ...layer,
                markers: layer.markers.map(({ referenceStatus: _status, ...marker }) => marker),
              })),
              name: broken.map.name,
              role: broken.map.role,
            },
          }),
        ).resolves.toMatchObject({ id: mapA.id, version: 3 });
      }

      await expect(
        prisma.campaignMapMarker.update({
          data: { x: 1.2 },
          where: { id: "character-marker" },
        }),
      ).rejects.toThrow();
    });
  });
}
