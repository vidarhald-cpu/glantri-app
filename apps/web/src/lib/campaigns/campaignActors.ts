import { createDefaultEquipmentLocations, type CanonicalContent } from "@glantri/content";
import {
  CHARACTER_STAT_LAYER_VERSION,
  characterBuildSchema,
  type CharacterBuild,
  type ReusableEntity,
} from "@glantri/domain";
import type { EquipmentTemplate } from "@glantri/domain/equipment";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";

import {
  buildGeneratedHumanoidNpcSnapshot,
  type GeneratedHumanoidNpc,
} from "@/lib/templates/npcArchetypeTemplates";

export type CampaignActorClass = "template" | "campaign_npc" | "generated_npc";

export interface CampaignActorMetadata {
  actorClass: CampaignActorClass;
  campaignId?: string;
  allegiance?: string;
  equipmentProfile?: string;
  profession?: string;
  roleLabel?: string;
  socialClass?: string;
  tags?: string[];
  templateId?: string;
  templateName?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags = value.filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
  return tags.length > 0 ? tags : undefined;
}

export function getCampaignActorMetadata(entity: ReusableEntity): CampaignActorMetadata {
  const snapshot = entity.snapshot;

  if (!isObject(snapshot)) {
    return { actorClass: "template" };
  }

  const actorClass = snapshot.actorClass;

  return {
    actorClass:
      actorClass === "campaign_npc"
        ? "campaign_npc"
        : actorClass === "generated_npc"
          ? "generated_npc"
          : "template",
    campaignId: typeof snapshot.campaignId === "string" ? snapshot.campaignId : undefined,
    allegiance: typeof snapshot.allegiance === "string" ? snapshot.allegiance : undefined,
    equipmentProfile:
      typeof snapshot.equipmentProfile === "string" ? snapshot.equipmentProfile : undefined,
    profession: typeof snapshot.profession === "string" ? snapshot.profession : undefined,
    roleLabel: typeof snapshot.roleLabel === "string" ? snapshot.roleLabel : undefined,
    socialClass: typeof snapshot.socialClass === "string" ? snapshot.socialClass : undefined,
    tags: parseTags(snapshot.tags),
    templateId: typeof snapshot.templateId === "string" ? snapshot.templateId : undefined,
    templateName: typeof snapshot.templateName === "string" ? snapshot.templateName : undefined,
  };
}

export function splitCampaignActors(
  entities: ReusableEntity[],
  campaignId?: string,
): {
  campaignNpcs: ReusableEntity[];
  templates: ReusableEntity[];
} {
  const templates: ReusableEntity[] = [];
  const campaignNpcs: ReusableEntity[] = [];

  for (const entity of entities) {
    const metadata = getCampaignActorMetadata(entity);

    if (metadata.actorClass === "campaign_npc") {
      if (!campaignId || metadata.campaignId === campaignId) {
        campaignNpcs.push(entity);
      }
    } else {
      templates.push(entity);
    }
  }

  return { campaignNpcs, templates };
}

export function buildCampaignNpcSnapshotFromTemplate(input: {
  campaignId: string;
  name?: string;
  template: ReusableEntity;
}): Record<string, unknown> {
  const metadata = getCampaignActorMetadata(input.template);

  return {
    actorClass: "campaign_npc",
    campaignId: input.campaignId,
    equipmentProfile: metadata.equipmentProfile,
    profession: metadata.profession,
    roleLabel: metadata.roleLabel,
    socialClass: metadata.socialClass,
    tags: metadata.tags,
    templateId: input.template.id,
    templateName: input.template.name,
  };
}

export function buildScenarioActorInputFromTemplate(input: {
  name?: string;
  template: ReusableEntity;
}): {
  description?: string;
  kind: ReusableEntity["kind"];
  name: string;
  snapshot: Record<string, unknown>;
} {
  const metadata = getCampaignActorMetadata(input.template);
  const sourceSnapshot = isObject(input.template.snapshot) ? input.template.snapshot : {};

  return {
    description: input.template.description,
    kind: input.template.kind,
    name: input.name?.trim() || input.template.name,
    snapshot: {
      ...sourceSnapshot,
      actorClass: metadata.actorClass === "generated_npc" ? "generated_npc" : "template",
      equipmentProfile: metadata.equipmentProfile,
      profession: metadata.profession,
      roleLabel: metadata.roleLabel,
      socialClass: metadata.socialClass,
      tags: metadata.tags,
      templateId: input.template.id,
      templateName: input.template.name,
    },
  };
}

function indexById<T extends { id: string }>(values: T[]): Record<string, T> {
  return Object.fromEntries(values.map((value) => [value.id, value]));
}

function findWeaponSkillId(input: {
  content: CanonicalContent;
  template: EquipmentTemplate;
}): string | undefined {
  if (input.template.category !== "weapon" || !input.template.weaponSkill) {
    return undefined;
  }

  const normalizedName = input.template.weaponSkill.trim().toLowerCase();
  return input.content.skills.find((skill) => skill.name.trim().toLowerCase() === normalizedName)
    ?.id;
}

function buildGeneratedNpcCharacterBuild(input: {
  content: CanonicalContent;
  equipmentTemplates: EquipmentTemplate[];
  npc: GeneratedHumanoidNpc;
}): CharacterBuild {
  const selectedTemplates = input.equipmentTemplates.filter((template) =>
    input.npc.gearTemplateIds.includes(template.id),
  );
  const equippedCategoryIds = new Set<string>();
  const equipmentItems = selectedTemplates.flatMap((template, index) => {
    if (
      template.category !== "weapon" &&
      template.category !== "shield" &&
      template.category !== "armor"
    ) {
      return [];
    }

    const equipped = !equippedCategoryIds.has(template.category);
    if (equipped) {
      equippedCategoryIds.add(template.category);
    }

    return [
      {
        armorLabel: template.category === "armor" ? template.name : undefined,
        armorValue:
          template.category === "armor"
            ? (template.generalArmorRounded ?? template.armorRating ?? 0)
            : 0,
        equipped,
        id: `${input.npc.actorId}:build-gear:${index + 1}`,
        itemType: template.category,
        name: template.name,
        shieldBonus: template.category === "shield" ? (template.shieldBonus ?? 0) : 0,
        slot:
          template.category === "weapon"
            ? "main-hand"
            : template.category === "shield"
              ? "off-hand"
              : "body",
        weaponBonus: 0,
        weaponSkillId: findWeaponSkillId({ content: input.content, template }),
      },
    ];
  });
  const skillGroupIds = [...new Set(input.npc.skills.flatMap((skill) => skill.groupIds))];

  return characterBuildSchema.parse({
    equipment: { items: equipmentItems },
    id: input.npc.actorId,
    name: input.npc.displayName,
    profile: {
      description: input.npc.description,
      distractionLevel: 2,
      id: `${input.npc.actorId}:profile`,
      label: input.npc.displayName,
      rolledStats: input.npc.stats.base,
      resolvedStats: input.npc.stats.final,
      statLayerVersion: CHARACTER_STAT_LAYER_VERSION,
      societyLevel: 0,
    },
    professionId: input.npc.professionId,
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: skillGroupIds.map((groupId) => ({
        gms: 0,
        grantedRanks: 0,
        groupId,
        primaryRanks: 0,
        ranks: 0,
        secondaryRanks: 0,
      })),
      skills: input.npc.skills.map((skill) => ({
        category:
          input.content.skills.find((definition) => definition.id === skill.skillId)?.category ??
          "ordinary",
        categoryId: skill.categoryId,
        grantedRanks: skill.targetLevel,
        groupId: skill.groupIds[0] ?? "ungrouped",
        groupIds: skill.groupIds,
        level: skill.targetLevel,
        primaryRanks: 0,
        ranks: skill.targetLevel,
        secondaryRanks: 0,
        skillId: skill.skillId,
      })),
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
    societyId: input.npc.societyId,
    societyLevel: 0,
    currentStatModifiers: {},
  });
}

function buildGeneratedNpcEquipmentState(input: {
  campaignId: string;
  equipmentTemplates: EquipmentTemplate[];
  npc: GeneratedHumanoidNpc;
}): Record<string, unknown> {
  const selectedTemplates = input.equipmentTemplates.filter((template) =>
    input.npc.gearTemplateIds.includes(template.id),
  );
  const firstTemplateByCategory = new Map<string, string>();
  const items = selectedTemplates.map((template, index) => {
    const itemId = `${input.npc.actorId}:gear:${index + 1}`;
    const equipped =
      (template.category === "weapon" ||
        template.category === "shield" ||
        template.category === "armor") &&
      !firstTemplateByCategory.has(template.category);

    if (equipped) {
      firstTemplateByCategory.set(template.category, itemId);
    }

    return {
      campaignContextId: input.campaignId,
      category: template.category,
      characterId: input.npc.actorId,
      conditionState: "intact" as const,
      durabilityCurrent:
        template.category === "weapon"
          ? (template.durabilityProfile?.maxDurabilityDefault ?? null)
          : null,
      durabilityMax:
        template.category === "weapon"
          ? (template.durabilityProfile?.maxDurabilityDefault ?? null)
          : null,
      holderCharacterId: input.npc.actorId,
      id: itemId,
      isEquipped: equipped,
      isStackable: false,
      material: template.defaultMaterial,
      quality: "standard" as const,
      quantity: 1,
      specificityType: template.specificityTypeDefault,
      storageAssignment: {
        carryMode: equipped ? ("equipped" as const) : ("on_person" as const),
        locationId: `${input.npc.actorId}:${equipped ? "loc-equipped" : "loc-person"}`,
      },
      templateId: template.id,
    };
  });
  const loadout = {
    activeAmmoItemIds: [],
    activeMissileWeaponItemId: null,
    activePrimaryWeaponItemId: firstTemplateByCategory.get("weapon") ?? null,
    activeSecondaryWeaponItemId: null,
    characterId: input.npc.actorId,
    id: `${input.npc.actorId}:loadout`,
    isActive: true,
    name: "Generated NPC loadout",
    notes: null,
    quickAccessItemIds: [],
    readyShieldItemId: firstTemplateByCategory.get("shield") ?? null,
    wornArmorItemId: firstTemplateByCategory.get("armor") ?? null,
  };

  return {
    activeLoadoutByCharacterId: { [input.npc.actorId]: loadout },
    itemsById: indexById(items),
    locationsById: indexById(createDefaultEquipmentLocations(input.npc.actorId)),
    templatesById: indexById(selectedTemplates),
  };
}

export function buildConcreteGeneratedNpcSnapshot(input: {
  campaignId: string;
  content: CanonicalContent;
  equipmentTemplates: EquipmentTemplate[];
  npc: GeneratedHumanoidNpc;
}): Record<string, unknown> {
  const build = buildGeneratedNpcCharacterBuild(input);
  const sheetSummary = buildCharacterSheetSummary({
    build,
    content: input.content,
  });

  return {
    ...buildGeneratedHumanoidNpcSnapshot(input.npc),
    actorClass: "campaign_npc",
    build,
    campaignId: input.campaignId,
    equipmentState: buildGeneratedNpcEquipmentState(input),
    generationProvenance: {
      kind: "humanoid_npc_generator",
      sourceTemplateId: input.npc.sourceTemplateId,
      sourceTemplateName: input.npc.sourceTemplateName,
    },
    sheetSummary,
  };
}
