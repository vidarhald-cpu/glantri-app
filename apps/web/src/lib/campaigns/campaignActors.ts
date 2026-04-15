import type { ReusableEntity } from "@glantri/domain";

export type CampaignActorClass = "template" | "campaign_npc";

export interface CampaignActorMetadata {
  actorClass: CampaignActorClass;
  campaignId?: string;
  allegiance?: string;
  roleLabel?: string;
  tags?: string[];
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
    roleLabel: typeof snapshot.roleLabel === "string" ? snapshot.roleLabel : undefined,
    tags: parseTags(snapshot.tags)
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
