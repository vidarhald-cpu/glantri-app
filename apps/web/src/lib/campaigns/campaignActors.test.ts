import { describe, expect, it } from "vitest";

import { defaultCanonicalContent, equipmentTemplates } from "@glantri/content";
import {
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  characterBuildSchema,
  createParticipantSnapshotFromEntity,
  getPlayerFacingSkillCategoryId,
  type ReusableEntity,
} from "@glantri/domain";
import { resolveParticipantSkillRollProfile } from "@glantri/rules-engine";

import {
  buildCampaignNpcSnapshotFromTemplate,
  buildConcreteGeneratedNpcSnapshot,
  buildScenarioActorInputFromTemplate,
  getCampaignActorMetadata,
  splitCampaignActors,
} from "./campaignActors";

function createEntity(
  input: Partial<ReusableEntity> & Pick<ReusableEntity, "id" | "name">,
): ReusableEntity {
  return {
    createdAt: input.createdAt ?? "2026-04-15T10:00:00.000Z",
    description: input.description,
    gmUserId: input.gmUserId ?? "gm-1",
    id: input.id,
    kind: input.kind ?? "npc",
    name: input.name,
    notes: input.notes,
    snapshot: input.snapshot,
    updatedAt: input.updatedAt ?? "2026-04-15T10:00:00.000Z",
  };
}

describe("campaignActors", () => {
  it("defaults legacy reusable entities to templates", () => {
    const metadata = getCampaignActorMetadata(
      createEntity({
        id: "legacy-1",
        name: "City Guard",
      }),
    );

    expect(metadata.actorClass).toBe("template");
  });

  it("preserves generated npc actor class from snapshot metadata", () => {
    const metadata = getCampaignActorMetadata(
      createEntity({
        id: "generated-1",
        name: "Town watch 101",
        snapshot: {
          actorClass: "generated_npc",
          profession: "guard",
          templateId: "template-guard",
        },
      }),
    );

    expect(metadata.actorClass).toBe("generated_npc");
  });

  it("splits templates and campaign npcs using snapshot metadata", () => {
    const result = splitCampaignActors([
      createEntity({
        id: "template-1",
        name: "Merchant Clerk",
        snapshot: {
          actorClass: "template",
          roleLabel: "Shop staff",
        },
      }),
      createEntity({
        id: "npc-1",
        name: "Captain Harl",
        snapshot: {
          actorClass: "campaign_npc",
          allegiance: "Harbor watch",
        },
      }),
    ]);

    expect(result.templates.map((entity) => entity.id)).toEqual(["template-1"]);
    expect(result.campaignNpcs.map((entity) => entity.id)).toEqual(["npc-1"]);
  });

  it("filters campaign npcs to the active campaign when campaign id is provided", () => {
    const result = splitCampaignActors(
      [
        createEntity({
          id: "npc-a",
          name: "Captain Harl",
          snapshot: {
            actorClass: "campaign_npc",
            campaignId: "campaign-a",
          },
        }),
        createEntity({
          id: "npc-b",
          name: "Steward Brenna",
          snapshot: {
            actorClass: "campaign_npc",
            campaignId: "campaign-b",
          },
        }),
      ],
      "campaign-a",
    );

    expect(result.campaignNpcs.map((entity) => entity.id)).toEqual(["npc-a"]);
  });

  it("maps template metadata into campaign npc and temporary scenario actor inputs", () => {
    const template = createEntity({
      description: "Harbor guard template",
      id: "template-guard",
      kind: "npc",
      name: "City Guard",
      snapshot: {
        actorClass: "template",
        equipmentProfile: "Mail shirt and spear",
        humanoidNpcArchetype: {
          skills: [{ skillId: "perception", skillName: "Perception", targetLevel: 13 }],
          stats: {
            final: {
              cha: 10,
              com: 10,
              con: 10,
              dex: 10,
              health: 10,
              int: 14,
              lck: 10,
              pow: 12,
              siz: 10,
              str: 10,
              will: 10,
            },
          },
        },
        profession: "guard",
        roleLabel: "Town watch",
        socialClass: "Common",
        tags: ["urban", "watch"],
      },
    });

    expect(
      buildCampaignNpcSnapshotFromTemplate({
        campaignId: "campaign-1",
        template,
      }),
    ).toMatchObject({
      actorClass: "campaign_npc",
      campaignId: "campaign-1",
      equipmentProfile: "Mail shirt and spear",
      profession: "guard",
      socialClass: "Common",
      templateId: "template-guard",
      templateName: "City Guard",
    });

    expect(
      buildScenarioActorInputFromTemplate({
        name: "North Gate Guard",
        template,
      }),
    ).toMatchObject({
      description: "Harbor guard template",
      kind: "npc",
      name: "North Gate Guard",
      snapshot: {
        actorClass: "template",
        humanoidNpcArchetype: {
          skills: [{ skillId: "perception", skillName: "Perception", targetLevel: 13 }],
        },
        profession: "guard",
        templateId: "template-guard",
      },
    });
  });

  it("projects one generated NPC through canonical build, sheet, equipment, and encounter facts", () => {
    const weapon = equipmentTemplates.find((template) => template.category === "weapon");
    const skill = defaultCanonicalContent.skills.find(
      (candidate) =>
        weapon?.category === "weapon" &&
        candidate.name.trim().toLowerCase() === weapon.weaponSkill.trim().toLowerCase(),
    );

    if (!weapon || !skill) {
      throw new Error("Canonical generated NPC fixtures are unavailable.");
    }

    const stats = {
      cha: 10,
      com: 10,
      con: 14,
      dex: 12,
      health: 11,
      int: 10,
      lck: 10,
      pow: 10,
      siz: 12,
      str: 13,
      will: 10,
    };
    const snapshot = buildConcreteGeneratedNpcSnapshot({
      campaignId: "campaign-1",
      content: defaultCanonicalContent,
      equipmentTemplates,
      npc: {
        actorClass: "generated_npc",
        actorId: "generated-npc-1",
        description: "A concrete watch officer.",
        displayName: "Captain Harl",
        gearNames: [weapon.name],
        gearTemplateIds: [weapon.id],
        kind: "npc",
        professionId: "guard",
        professionName: "Guard",
        roleLabel: "Watch officer",
        seniority: "veteran",
        skills: [
          {
            categoryId: getPlayerFacingSkillCategoryId(skill),
            groupIds:
              skill.groupIds ?? [skill.groupId].filter((value): value is string => Boolean(value)),
            isCore: true,
            skillId: skill.id,
            skillName: skill.name,
            targetLevel: 8,
          },
        ],
        societyId: "glantri",
        societyName: "Glantri",
        sourceTemplateId: "template-guard",
        sourceTemplateName: "City Guard",
        stats: { base: stats, final: stats },
        tags: ["urban", "watch"],
      },
    });
    const build = characterBuildSchema.parse(snapshot.build);
    const sheetSummary = snapshot.sheetSummary as {
      draftView: {
        skills: Array<{ effectiveSkillNumber: number; skillId: string; totalSkill: number }>;
      };
    };
    const equipmentState = snapshot.equipmentState as {
      activeLoadoutByCharacterId: Record<string, unknown>;
      itemsById: Record<string, unknown>;
      locationsById: Record<string, unknown>;
    };
    const participantSnapshot = createParticipantSnapshotFromEntity({
      entity: {
        description: "A concrete watch officer.",
        kind: "npc",
        name: "Captain Harl",
        notes: "GM-only generation notes",
        snapshot,
      },
      sourceUpdatedAt: "2026-08-13T08:00:00.000Z",
    });
    const skillProfile = resolveParticipantSkillRollProfile({
      build: participantSnapshot.snapshot.build,
      content: defaultCanonicalContent,
      participantId: "participant-1",
      participantName: "Captain Harl",
      sheetSummary: participantSnapshot.snapshot.sheetSummary,
      skill,
    });

    expect(snapshot).toMatchObject({
      actorClass: "campaign_npc",
      campaignId: "campaign-1",
      generatedHumanoidNpc: {
        actorId: "generated-npc-1",
        sourceTemplateId: "template-guard",
      },
      generationProvenance: {
        kind: "humanoid_npc_generator",
        sourceTemplateId: "template-guard",
      },
    });
    expect(build.id).toBe("generated-npc-1");
    expect(sheetSummary.draftView.skills).toContainEqual(
      expect.objectContaining({
        effectiveSkillNumber: 8,
        skillId: skill.id,
      }),
    );
    expect(skillProfile).toMatchObject({
      known: true,
      sourceQuality: "full",
      totalXP: 8,
      warning: undefined,
    });
    expect(
      Object.values(equipmentState.itemsById).every(
        (item) => EquipmentItemSchema.safeParse(item).success,
      ),
    ).toBe(true);
    expect(
      Object.values(equipmentState.locationsById).every(
        (location) => StorageLocationSchema.safeParse(location).success,
      ),
    ).toBe(true);
    expect(
      CharacterLoadoutSchema.safeParse(equipmentState.activeLoadoutByCharacterId["generated-npc-1"])
        .success,
    ).toBe(true);
    expect(participantSnapshot.snapshot).toMatchObject({
      build,
      displayName: "Captain Harl",
      equipmentState,
      sheetSummary,
      sourceUpdatedAt: "2026-08-13T08:00:00.000Z",
    });
    expect(participantSnapshot.state).toMatchObject({
      health: {
        currentHp: 13,
        maxHp: 13,
      },
      snapshotVersion: 1,
    });
  });
});
