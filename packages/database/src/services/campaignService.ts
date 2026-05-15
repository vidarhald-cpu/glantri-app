import type {
  Campaign,
  CampaignAsset,
  CampaignRosterCategory,
  CampaignRosterEntry,
  CampaignRosterSourceType,
  ReusableEntity,
} from "@glantri/domain";

import {
  createPrismaScenarioRepository,
  type ScenarioRepository,
} from "../repositories/scenarioRepository";
import { CharacterService } from "./characterService";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export class CampaignService {
  constructor(
    private readonly repository: ScenarioRepository = createPrismaScenarioRepository(),
    private readonly characterService = new CharacterService(),
  ) {}

  async createCampaign(input: {
    description?: string;
    gmUserId: string;
    name: string;
    settings?: Campaign["settings"];
    status?: Campaign["status"];
  }): Promise<Campaign> {
    return this.repository.createCampaign({
      description: input.description?.trim() ?? "",
      gmUserId: input.gmUserId,
      name: input.name.trim(),
      settings: input.settings ?? {
        allowPlayerSelfJoin: false,
        defaultVisibility: "hidden",
      },
      slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
      status: input.status ?? "draft",
    });
  }

  async listCampaignsByGameMaster(gmUserId: string): Promise<Campaign[]> {
    return this.repository.listCampaignsByGameMaster(gmUserId);
  }

  async listCampaignsAllowingPlayerSelfJoin(): Promise<Campaign[]> {
    return this.repository.listCampaignsAllowingPlayerSelfJoin();
  }

  async listCampaignsByCharacterRosterAccess(characterId: string): Promise<Campaign[]> {
    return this.repository.listCampaignsByCharacterRosterAccess(characterId);
  }

  async listCampaignsByPlayerAccess(userId: string): Promise<Campaign[]> {
    return this.repository.listCampaignsByPlayerAccess(userId);
  }

  async getCampaignById(campaignId: string): Promise<Campaign | null> {
    return this.repository.getCampaignById(campaignId);
  }

  async listCampaignRosterEntries(campaignId: string): Promise<CampaignRosterEntry[]> {
    return this.repository.listCampaignRosterEntries(campaignId);
  }

  async addCampaignRosterEntry(input: {
    campaignId: string;
    category: CampaignRosterCategory;
    createdByUserId?: string | null;
    notes?: string | null;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<CampaignRosterEntry> {
    const labelSnapshot = await this.resolveCampaignRosterLabel(input);

    return this.repository.createCampaignRosterEntry({
      campaignId: input.campaignId,
      category: input.category,
      createdByUserId: input.createdByUserId,
      labelSnapshot,
      notes: input.notes?.trim() || null,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
    });
  }

  async removeCampaignRosterEntry(input: {
    campaignId: string;
    rosterEntryId: string;
  }): Promise<void> {
    const entry = await this.repository.getCampaignRosterEntryById(input.rosterEntryId);

    if (!entry || entry.campaignId !== input.campaignId) {
      throw new Error("Campaign roster entry not found.");
    }

    await this.repository.deleteCampaignRosterEntry(input.rosterEntryId);
  }

  async removeCampaignRosterEntryBySource(input: {
    campaignId: string;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<void> {
    await this.repository.deleteCampaignRosterEntryBySource(input);
  }

  async createReusableEntity(input: {
    description?: string;
    gmUserId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string;
    snapshot?: unknown;
  }): Promise<ReusableEntity> {
    return this.repository.createReusableEntity({
      description: input.description ?? null,
      gmUserId: input.gmUserId,
      kind: input.kind,
      name: input.name.trim(),
      notes: input.notes ?? null,
      snapshot: input.snapshot,
    });
  }

  async listReusableEntitiesByGameMaster(gmUserId: string): Promise<ReusableEntity[]> {
    return this.repository.listReusableEntitiesByGameMaster(gmUserId);
  }

  async getReusableEntityById(entityId: string): Promise<ReusableEntity | null> {
    return this.repository.getReusableEntityById(entityId);
  }

  async updateReusableEntity(input: {
    description?: string;
    entityId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string;
    snapshot?: unknown;
  }): Promise<ReusableEntity> {
    return this.repository.updateReusableEntity({
      description: input.description ?? null,
      entityId: input.entityId,
      kind: input.kind,
      name: input.name.trim(),
      notes: input.notes ?? null,
      snapshot: input.snapshot,
    });
  }

  async createCampaignAsset(input: {
    campaignId: string;
    createdByUserId: string;
    description?: string;
    mimeType?: string;
    storageUrl: string;
    title: string;
    type: CampaignAsset["type"];
    visibility: CampaignAsset["visibility"];
  }): Promise<CampaignAsset> {
    return this.repository.createCampaignAsset({
      campaignId: input.campaignId,
      createdByUserId: input.createdByUserId,
      description: input.description ?? null,
      mimeType: input.mimeType ?? null,
      storageUrl: input.storageUrl,
      title: input.title.trim(),
      type: input.type,
      visibility: input.visibility,
    });
  }

  async listCampaignAssets(campaignId: string): Promise<CampaignAsset[]> {
    return this.repository.listCampaignAssets(campaignId);
  }

  async getCampaignAssetById(assetId: string): Promise<CampaignAsset | null> {
    return this.repository.getCampaignAssetById(assetId);
  }

  async updateCampaignAssetVisibility(input: {
    assetId: string;
    visibility: CampaignAsset["visibility"];
  }): Promise<CampaignAsset> {
    return this.repository.updateCampaignAssetVisibility(input.assetId, input.visibility);
  }

  private async resolveCampaignRosterLabel(input: {
    category: CampaignRosterCategory;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<string> {
    if (input.sourceType === "character") {
      const character = await this.characterService.getCharacterById(input.sourceId);

      if (!character) {
        throw new Error("Character not found.");
      }

      return character.name;
    }

    const entity = await this.repository.getReusableEntityById(input.sourceId);

    if (!entity) {
      throw new Error("Reusable entity not found.");
    }

    if (input.sourceType === "template" && input.category !== "template") {
      throw new Error("Template roster entries must use the template category.");
    }

    if (input.sourceType === "reusableEntity" && input.category === "template") {
      throw new Error("Reusable entity roster entries cannot use the template category.");
    }

    return entity.name;
  }
}
