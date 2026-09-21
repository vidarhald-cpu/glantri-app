import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  AI_INTAKE_PRODUCER,
  artifactPackageSchema,
  type ArtifactPackage,
  type ArtifactRelationshipBinding,
} from "@glantri/domain";
import type { ArtifactBinaryStore } from "../artifacts/artifactBinaryStore";
import { ArtifactImportRepository } from "../repositories/artifactImportRepository";
import {
  buildDescriptiveCampaignEquipmentItem,
  campaignEquipmentItemCreateData,
  createPrismaCharacterEquipmentRepository,
} from "../repositories/characterEquipmentRepository";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { ArtifactImportService } from "./artifactImportService";
import { ArtifactConflictError } from "./artifactService";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";

const prisma = getTestPrismaClient();
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function* stream(bytes: Buffer) {
  yield bytes;
}

class Store implements ArtifactBinaryStore {
  readonly provider = "local" as const;
  objects = new Map<string, Buffer>();
  async put(input: { key: string; content: AsyncIterable<Uint8Array> }) {
    const chunks: Buffer[] = [];
    for await (const chunk of input.content) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    this.objects.set(input.key, bytes);
    return { byteSize: bytes.length, sha256Digest: digest(bytes) };
  }
  async stat(key: string) {
    const bytes = this.objects.get(key);
    return bytes ? { byteSize: bytes.length, sha256Digest: digest(bytes) } : null;
  }
  async read({ key }: { key: string }) {
    const bytes = this.objects.get(key)!;
    return { byteSize: bytes.length, content: stream(bytes) };
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

/** The shape the intake panel stages: an Item with its Artifact representation. */
function intakeManifest(options: { relationshipLabel?: string } = {}): ArtifactPackage {
  return artifactPackageSchema.parse({
    schemaVersion: 1,
    producer: AI_INTAKE_PRODUCER,
    packageId: "ai-intake-test",
    version: "1",
    title: "AI intake: Torn Treasure Map",
    resources: [{ id: "resource-1", mediaType: "image/png", sha256: digest(png) }],
    objects: [
      {
        id: "artifact-1",
        type: "Artifact",
        optional: true,
        resourceId: "resource-1",
        metadata: {
          title: "Torn Treasure Map",
          artifactKind: "map",
          altText: "A torn sea chart",
          description: "A salt-stained half of a sea chart.",
          provenanceKind: "user_upload",
        },
      },
      {
        id: "item-1",
        type: "Item",
        optional: true,
        attachments: [{ kind: "local", id: "artifact-1" }],
        gmNotes: "The harbourmaster holds the missing half.",
        itemMetadata: {
          title: "Torn Treasure Map",
          description: "A salt-stained half of a sea chart.",
        },
        ...(options.relationshipLabel ? { relationshipLabel: options.relationshipLabel } : {}),
      },
    ],
  });
}

function pureArtifactManifest(relationshipLabel?: string): ArtifactPackage {
  return artifactPackageSchema.parse({
    schemaVersion: 1,
    producer: AI_INTAKE_PRODUCER,
    packageId: "ai-intake-portrait",
    version: "1",
    title: "AI intake: Captain Varro",
    resources: [{ id: "resource-1", mediaType: "image/png", sha256: digest(png) }],
    objects: [
      {
        id: "artifact-1",
        type: "Artifact",
        optional: true,
        resourceId: "resource-1",
        gmNotes: "Suggested tags: harbour",
        metadata: {
          title: "Captain Varro",
          artifactKind: "portrait",
          altText: "A weathered captain",
          provenanceKind: "user_upload",
        },
        ...(relationshipLabel ? { relationshipLabel } : {}),
      },
    ],
  });
}

if (!prisma) describe.skip("AI intake staging (owned DB required)", () => {});
else
  describe("AI-assisted intake stages before it creates", () => {
    beforeEach(async () => resetTestDatabase(prisma));
    afterAll(async () => resetTestDatabase(prisma));

    async function setup() {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma!, gm.id, { status: "active" });
      const store = new Store();
      const service = new ArtifactImportService(store, new ArtifactImportRepository(prisma!));
      async function stage(data: ArtifactPackage) {
        const session = await service.begin(campaign.id, gm.id, data);
        for (const resource of data.resources)
          await service.uploadResource({
            campaignId: campaign.id,
            userId: gm.id,
            id: session.id,
            resourceId: resource.id,
            content: stream(png),
            mediaType: resource.mediaType,
          });
        return service.finish(campaign.id, gm.id, session.id);
      }
      async function existingItem(title: string) {
        const item = buildDescriptiveCampaignEquipmentItem({
          campaignId: campaign.id,
          description: null,
          id: `${campaign.id}:item-${title.replace(/\W+/g, "-")}`,
          title,
        });
        await prisma!.characterEquipmentItem.create({
          data: campaignEquipmentItemCreateData(item),
        });
        return item;
      }
      async function counts() {
        return {
          artifacts: await prisma!.campaignAsset.count(),
          attachments: await prisma!.campaignItemArtifactAttachment.count(),
          items: await prisma!.characterEquipmentItem.count(),
        };
      }
      return { campaign, counts, existingItem, gm, service, stage, store };
    }

    it("creates nothing before confirmation and then creates Item plus attached Artifact", async () => {
      const { campaign, counts, gm, service, stage, store } = await setup();
      const preview = await stage(intakeManifest());

      expect(await counts()).toEqual({ artifacts: 0, attachments: 0, items: 0 });
      expect(preview.valid).toBe(true);

      const artifactProposal = preview.items.find((entry) => entry.id === "artifact-1")!;
      expect(artifactProposal.objectType).toBe("Artifact");
      expect(artifactProposal.derived).toMatchObject({
        byteSize: png.length,
        mediaType: "image/png",
        sha256: digest(png),
        storageProvider: "local",
      });
      const itemProposal = preview.items.find((entry) => entry.id === "item-1")!;
      expect(itemProposal.objectType).toBe("Item");
      expect(itemProposal.attachedObjectIds).toEqual(["artifact-1"]);

      const accepted = await service.accept(
        campaign.id,
        gm.id,
        preview.id,
        preview.previewToken,
        [],
      );
      expect(await counts()).toEqual({ artifacts: 1, attachments: 1, items: 1 });

      const artifact = (await prisma!.campaignAsset.findMany())[0]!;
      expect(artifact.sha256Digest).toBe(digest(png));
      expect(artifact.mimeType).toBe("image/png");
      expect(Number(artifact.byteSize)).toBe(png.length);
      expect(artifact.audience).toBe("gm_private");
      expect(store.objects.get(artifact.storageKey!)).toEqual(png);

      const item = (await prisma!.characterEquipmentItem.findMany())[0]!;
      expect(item.displayName).toBe("Torn Treasure Map");
      expect(item.campaignContextId).toBe(campaign.id);
      expect(item.holderCharacterId).toBeNull();
      // The player-visible description is the described object's description;
      // the GM's private prose lives in the GM-only column.
      expect(item.notes).toBe("A salt-stained half of a sea chart.");
      expect(item.gmNotes).toBe("The harbourmaster holds the missing half.");
      expect(accepted.result!["item-1"]).toBe(item.id);

      const attachment = (await prisma!.campaignItemArtifactAttachment.findMany())[0]!;
      expect(attachment).toMatchObject({ artifactId: artifact.id, itemId: item.id });
    });

    it("leaves no residue at all when a staged proposal is abandoned", async () => {
      const { campaign, counts, gm, service, stage, store } = await setup();
      const preview = await stage(intakeManifest());
      expect(store.objects.size).toBe(1);

      await service.cleanup(campaign.id, gm.id, preview.id);

      expect(await counts()).toEqual({ artifacts: 0, attachments: 0, items: 0 });
      expect(await prisma!.artifactRevision.count()).toBe(0);
      expect(store.objects.size).toBe(0);
    });

    it("surfaces an ambiguous relationship instead of guessing, and accepts once bound", async () => {
      const { campaign, counts, existingItem, gm, service, stage } = await setup();
      const first = await existingItem("Captain Varro");
      await prisma!.characterEquipmentItem.create({
        data: campaignEquipmentItemCreateData(
          buildDescriptiveCampaignEquipmentItem({
            campaignId: campaign.id,
            description: null,
            id: `${campaign.id}:item-varro-2`,
            title: "captain varro",
          }),
        ),
      });
      const preview = await stage(pureArtifactManifest("Captain Varro"));

      const proposal = preview.items[0]!;
      expect(proposal.relationship?.status).toBe("ambiguous");
      expect(proposal.relationship?.candidates).toHaveLength(2);
      expect(proposal.status).toBe("invalid");
      // The explanation is shown once, under the relationship. It is not
      // repeated into the problem list beneath it.
      expect(proposal.reasons).not.toContain(proposal.relationship!.explanation);
      expect(proposal.reasons).toEqual([]);
      expect(preview.valid).toBe(false);
      await expect(
        service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []),
      ).rejects.toBeInstanceOf(ArtifactConflictError);
      // Only the two Items that already existed; the proposal created nothing.
      expect(await counts()).toEqual({ artifacts: 0, attachments: 0, items: 2 });

      const bindings: ArtifactRelationshipBinding[] = [
        { objectId: "artifact-1", target: { kind: "item", itemId: first.id } },
      ];
      const bound = await service.preview(campaign.id, gm.id, preview.id, ["artifact-1"], bindings);
      expect(bound.items[0]!.relationship?.status).toBe("bound");
      expect(bound.valid).toBe(true);

      await service.accept(campaign.id, gm.id, preview.id, bound.previewToken, []);
      const attachment = (await prisma!.campaignItemArtifactAttachment.findMany())[0]!;
      expect(attachment.itemId).toBe(first.id);
    });

    it("surfaces a relationship with no match and blocks confirmation until it is cleared", async () => {
      const { campaign, counts, gm, service, stage } = await setup();
      const preview = await stage(pureArtifactManifest("Somebody Who Does Not Exist"));

      expect(preview.items[0]!.relationship?.status).toBe("not_found");
      expect(preview.valid).toBe(false);
      await expect(
        service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []),
      ).rejects.toBeInstanceOf(ArtifactConflictError);
      expect(await counts()).toEqual({ artifacts: 0, attachments: 0, items: 0 });

      const cleared = await service.preview(
        campaign.id,
        gm.id,
        preview.id,
        ["artifact-1"],
        [{ objectId: "artifact-1", target: null }],
      );
      expect(cleared.items[0]!.relationship?.status).toBe("cleared");
      expect(cleared.valid).toBe(true);
      await service.accept(campaign.id, gm.id, preview.id, cleared.previewToken, []);
      expect(await counts()).toEqual({ artifacts: 1, attachments: 0, items: 0 });
    });

    it("refuses to treat an Artifact as the game-world object when the pair is unsupported", async () => {
      const { campaign, gm, stage } = await setup();
      await prisma!.campaignAsset.create({
        data: {
          audience: "gm_private",
          campaignId: campaign.id,
          createdByUserId: gm.id,
          id: "existing-portrait",
          lifecycleState: "active",
          storageState: "ready",
          storageUrl: "artifact-internal:existing-portrait",
          title: "Harbour Watch",
          type: "image",
          artifactKind: "portrait",
          visibility: "gm_only",
        },
      });
      const preview = await stage(pureArtifactManifest("Harbour Watch"));
      expect(preview.items[0]!.relationship?.status).toBe("unsupported");
      expect(preview.valid).toBe(false);
    });

    it("never delivers an intake Item's GM notes to the player holding it", async () => {
      const { campaign, gm, service, stage } = await setup();
      const preview = await stage(intakeManifest());
      await service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []);

      const secret = "The harbourmaster holds the missing half.";
      const item = (await prisma!.characterEquipmentItem.findMany())[0]!;

      // The GM hands the Item to a rostered Character through the ordinary
      // assignment route, exactly as they would with any campaign Item.
      const player = await createTestUser(prisma!, { roles: ["player"] });
      const character = await createTestCharacter(prisma!, player.id);
      await prisma!.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          createdByUserId: gm.id,
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const repository = createPrismaCharacterEquipmentRepository(prisma!);
      const writeService = new CharacterEquipmentWriteService(repository);
      await writeService.ensureCharacterEquipmentInitialized(character.id);
      const aggregate = await repository.getCharacterEquipmentAggregateState(character.id);
      await writeService.assignCampaignEquipmentItem({
        campaignId: campaign.id,
        evidence: { actorAuthority: "campaign_gm", actorUserId: gm.id },
        itemId: item.id,
        targetCharacterId: character.id,
        targetExpectedRevision: aggregate.revision,
      });

      const readService = new CharacterEquipmentReadModelService(repository);
      const held = await readService.getCharacterEquipmentState(character.id, {
        kind: "holder",
        characterId: character.id,
      });

      // Assert on the payload the player actually receives, not on the UI.
      const holderPayload = JSON.stringify(held);
      expect(held.itemsById[item.id]).toBeDefined();
      expect(holderPayload).not.toContain(secret);
      expect(holderPayload).not.toContain("gmNotes");
      expect(Object.keys(held.itemsById[item.id]!)).not.toContain("gmNotes");
      // The player-visible description still arrives.
      expect(held.itemsById[item.id]!.notes).toBe("A salt-stained half of a sea chart.");

      // The campaign-wide equipment read model is reachable by players through
      // the encounter routes, so it must not carry the notes either.
      const campaignState = await readService.getCampaignEquipmentState(campaign.id);
      expect(JSON.stringify(campaignState)).not.toContain(secret);
      expect(JSON.stringify(campaignState)).not.toContain("gmNotes");

      // Every repository read every service and route sits on top of: the
      // holder list, the campaign list, the single canonical read and the
      // whole character aggregate. None of them carries the field.
      const payloads = await Promise.all([
        repository.getCharacterEquipmentItems(character.id),
        repository.getCampaignEquipmentItems(campaign.id),
        repository.getCanonicalEquipmentItemById(item.id),
        repository.getCharacterEquipmentState(character.id),
        repository.getCharacterEquipmentAggregateState(character.id),
      ]);
      for (const payload of payloads) {
        expect(JSON.stringify(payload)).not.toContain(secret);
        expect(JSON.stringify(payload)).not.toContain("gmNotes");
      }

      // The GM-scoped read, and only it, returns them.
      expect(item.gmNotes).toBe(secret);
      expect(await readService.getCampaignEquipmentGmNotes(campaign.id)).toEqual({
        [item.id]: secret,
      });
    });
  });
