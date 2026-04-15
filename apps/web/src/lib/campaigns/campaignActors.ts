import type { ReusableEntity } from "@glantri/domain";

export type CampaignActorClass = "template" | "campaign_npc";

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

  const tags = value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  return tags.length > 0 ? tags : undefined;
}

export function getCampaignActorMetadata(entity: ReusableEntity): CampaignActorMetadata {
  const snapshot = entity.snapshot;

  if (!isObject(snapshot)) {
    return { actorClass: "template" };
  }

  const actorClass = snapshot.actorClass;

  return {
    actorClass: actorClass === "campaign_npc" ? "campaign_npc" : "template",
    campaignId: typeof snapshot.campaignId === "string" ? snapshot.campaignId : undefined,
    allegiance: typeof snapshot.allegiance === "string" ? snapshot.allegiance : undefined,
    equipmentProfile:
      typeof snapshot.equipmentProfile === "string" ? snapshot.equipmentProfile : undefined,
    profession: typeof snapshot.profession === "string" ? snapshot.profession : undefined,
    roleLabel: typeof snapshot.roleLabel === "string" ? snapshot.roleLabel : undefined,
    socialClass: typeof snapshot.socialClass === "string" ? snapshot.socialClass : undefined,
    tags: parseTags(snapshot.tags),
    templateId: typeof snapshot.templateId === "string" ? snapshot.templateId : undefined,
    templateName: typeof snapshot.templateName === "string" ? snapshot.templateName : undefined
  };
}

export function splitCampaignActors(
  entities: ReusableEntity[],
  campaignId?: string
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
    templateName: input.template.name
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

  return {
    description: input.template.description,
    kind: input.template.kind,
    name: input.name?.trim() || input.template.name,
    snapshot: {
      actorClass: "template",
      equipmentProfile: metadata.equipmentProfile,
      profession: metadata.profession,
      roleLabel: metadata.roleLabel,
      socialClass: metadata.socialClass,
      tags: metadata.tags,
      templateId: input.template.id,
      templateName: input.template.name
    }
  };
}
