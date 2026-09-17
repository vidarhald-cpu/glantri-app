import {
  campaignCharacterRosterCandidateSchema,
  type CampaignCharacterRosterCandidate,
  type Campaign,
  type CampaignAsset,
  type CampaignRosterCategory,
  type CampaignRosterEntry,
  type CampaignRosterSourceType,
  type CharacterRecord,
  type ReusableEntity,
} from "@glantri/domain";

import {
  CampaignRosterPersistenceConflictError,
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

function normalizeCampaignNpcSnapshot(input: {
  campaignId: string;
  snapshot?: unknown;
}): Record<string, unknown> {
  const snapshot =
    input.snapshot && typeof input.snapshot === "object" && !Array.isArray(input.snapshot)
      ? (input.snapshot as Record<string, unknown>)
      : {};

  return {
    ...snapshot,
    actorClass: "campaign_npc",
    campaignId: input.campaignId,
  };
}

export class CampaignCharacterRosterCandidateNotFoundError extends Error {
  constructor() {
    super("Campaign character candidate not found.");
    this.name = "CampaignCharacterRosterCandidateNotFoundError";
  }
}

export class CampaignCharacterAlreadyRosteredError extends Error {
  constructor(readonly activeCampaignId: string) {
    super(
      "This Character already belongs to another active Campaign. Leave or ask that Campaign's GM to remove it before joining this Campaign.",
    );
    this.name = "CampaignCharacterAlreadyRosteredError";
  }
}

/** Server Character records are finalized; browser-local drafts never reach this boundary. */
export function isEligibleCampaignCharacterRosterCandidate(
  character: CharacterRecord | null | undefined,
): character is CharacterRecord {
  return character != null;
}

function buildCampaignCharacterOwnerLabel(input: {
  actorUserId: string;
  character: CharacterRecord;
}): string {
  if (input.character.ownerId === input.actorUserId) {
    return "You";
  }

  const displayName = input.character.owner?.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  return input.character.ownerId ? "Another player" : "No assigned owner";
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

  async listCampaignsByUserAccess(userId: string): Promise<Campaign[]> {
    const ownedCharacters = await this.characterService.listCharacters(userId);
    const [liveScenarioCampaigns, ...rosterCampaignGroups] = await Promise.all([
      this.repository.listCampaignsByPlayerAccess(userId),
      ...ownedCharacters.map((character) =>
        this.repository.listCampaignsByCharacterRosterAccess(character.id),
      ),
    ]);
    const accessibleById = new Map(
      [...liveScenarioCampaigns, ...rosterCampaignGroups.flat()]
        .filter((campaign) => campaign.status === "active")
        .map((campaign) => [campaign.id, campaign]),
    );

    return [...accessibleById.values()].sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
        left.name.localeCompare(right.name),
    );
  }

  async listPlayerCampaignCharacters(input: {
    campaignId: string;
    userId: string;
  }): Promise<Array<{ id: string; name: string }>> {
    const [ownedCharacters, rosterEntries] = await Promise.all([
      this.characterService.listCharacters(input.userId),
      this.repository.listCampaignRosterEntries(input.campaignId),
    ]);
    const rosterCharacterIds = new Set(
      rosterEntries
        .filter((entry) => entry.sourceType === "character")
        .map((entry) => entry.sourceId),
    );

    return ownedCharacters
      .filter((character) => rosterCharacterIds.has(character.id))
      .map((character) => ({ id: character.id, name: character.name }));
  }

  async getCampaignById(campaignId: string): Promise<Campaign | null> {
    return this.repository.getCampaignById(campaignId);
  }

  async listCampaignRosterEntries(campaignId: string): Promise<CampaignRosterEntry[]> {
    return this.repository.listCampaignRosterEntries(campaignId);
  }

  async listCampaignRosterHistoryEntries(campaignId: string): Promise<CampaignRosterEntry[]> {
    return this.repository.listCampaignRosterHistoryEntries(campaignId);
  }

  async listCampaignCharacterRosterCandidates(input: {
    actorUserId: string;
    campaignId: string;
  }): Promise<CampaignCharacterRosterCandidate[]> {
    const [characters, rosterEntries] = await Promise.all([
      this.characterService.listCharacters(),
      this.repository.listCampaignRosterHistoryEntries(input.campaignId),
    ]);
    const rosterEntryByCharacterId = new Map(
      rosterEntries
        .filter((entry) => entry.sourceType === "character")
        .map((entry) => [entry.sourceId, entry]),
    );
    const histories = await Promise.all(
      characters.map((character) =>
        this.repository.listCharacterRosterHistoryEntries(character.id),
      ),
    );

    return characters
      .filter(isEligibleCampaignCharacterRosterCandidate)
      .map((character, index) => {
        const selectedMembership = rosterEntryByCharacterId.get(character.id);
        const currentElsewhere = (histories[index] ?? []).some(
          (entry) =>
            entry.campaignId !== input.campaignId &&
            (entry.membershipState ?? "current") === "current",
        );

        return campaignCharacterRosterCandidateSchema.parse({
          alreadyRostered:
            selectedMembership != null &&
            (selectedMembership.membershipState ?? "current") === "current",
          currentElsewhere,
          id: character.id,
          membershipState: selectedMembership
            ? (selectedMembership.membershipState ?? "current")
            : "none",
          name: character.name,
          ownerLabel: buildCampaignCharacterOwnerLabel({
            actorUserId: input.actorUserId,
            character,
          }),
        });
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async addCampaignRosterEntry(input: {
    actorIsAdmin?: boolean;
    actorUserId?: string;
    campaignId: string;
    category: CampaignRosterCategory;
    createdByUserId?: string | null;
    notes?: string | null;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<CampaignRosterEntry> {
    const labelSnapshot = await this.resolveCampaignRosterLabel(input);

    try {
      return await this.repository.createCampaignRosterEntry({
        campaignId: input.campaignId,
        category: input.category,
        createdByUserId: input.createdByUserId,
        labelSnapshot,
        notes: input.notes?.trim() || null,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      });
    } catch (error) {
      if (error instanceof CampaignRosterPersistenceConflictError) {
        throw new CampaignCharacterAlreadyRosteredError(error.activeCampaignId);
      }
      throw error;
    }
  }

  async removeCampaignRosterEntry(input: {
    campaignId: string;
    rosterEntryId: string;
  }): Promise<void> {
    const entry = await this.repository.getCampaignRosterEntryById(input.rosterEntryId);

    if (!entry) {
      return;
    }

    if (entry.campaignId !== input.campaignId) {
      throw new Error("Campaign roster entry not found.");
    }

    if (entry.sourceType === "character") {
      if ((entry.membershipState ?? "current") === "current") {
        await this.repository.updateCampaignRosterMembershipState({
          entryId: entry.id,
          membershipState: "former",
        });
      }
      return;
    }

    await this.repository.deleteCampaignRosterEntry(input.rosterEntryId);
  }

  async removeCampaignRosterEntryBySource(input: {
    campaignId: string;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<{ removed: boolean }> {
    const entry = (await this.repository.listCampaignRosterHistoryEntries(input.campaignId)).find(
      (candidate) =>
        candidate.sourceId === input.sourceId && candidate.sourceType === input.sourceType,
    );

    if (!entry) {
      return { removed: false };
    }

    if (entry.sourceType === "character") {
      if ((entry.membershipState ?? "current") === "former") {
        return { removed: false };
      }
      await this.repository.updateCampaignRosterMembershipState({
        entryId: entry.id,
        membershipState: "former",
      });
      return { removed: true };
    }

    const removedCount = await this.repository.deleteCampaignRosterEntryBySource(input);

    return {
      removed: removedCount > 0,
    };
  }

  async leaveCampaign(input: {
    campaignId: string;
    characterId: string;
    ownerUserId: string;
  }): Promise<{ removed: boolean }> {
    const ownedCharacter = await this.characterService.getOwnedCharacter(
      input.ownerUserId,
      input.characterId,
    );
    if (!ownedCharacter) {
      throw new CampaignCharacterRosterCandidateNotFoundError();
    }
    return this.removeCampaignRosterEntryBySource({
      campaignId: input.campaignId,
      sourceId: input.characterId,
      sourceType: "character",
    });
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

  async createCampaignNpc(input: {
    campaignId: string;
    createdByUserId?: string;
    description?: string;
    gmUserId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string;
    snapshot?: unknown;
  }): Promise<{ entity: ReusableEntity; rosterEntry: CampaignRosterEntry }> {
    return this.repository.createCampaignNpcWithRosterEntry({
      campaignId: input.campaignId,
      createdByUserId: input.createdByUserId ?? input.gmUserId,
      description: input.description ?? null,
      gmUserId: input.gmUserId,
      kind: input.kind,
      name: input.name.trim(),
      notes: input.notes ?? null,
      snapshot: normalizeCampaignNpcSnapshot({
        campaignId: input.campaignId,
        snapshot: input.snapshot,
      }),
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

  async activateCampaign(input: {
    actorIsAdmin?: boolean;
    actorUserId: string;
    campaignId: string;
  }): Promise<Campaign> {
    const campaign = await this.repository.getCampaignById(input.campaignId);

    if (!campaign || campaign.gmUserId !== input.actorUserId) {
      throw new Error("Campaign not found.");
    }

    if (campaign.status !== "draft") {
      throw new Error("Campaign can only be activated from draft status.");
    }

    const next = await this.repository.activateCampaignFromDraft({
      campaignId: input.campaignId,
    });

    if (!next) {
      throw new Error("Campaign activation is stale and must be retried.");
    }

    return next;
  }

  private async resolveCampaignRosterLabel(input: {
    actorIsAdmin?: boolean;
    actorUserId?: string;
    campaignId: string;
    category: CampaignRosterCategory;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<string> {
    if (input.sourceType === "character") {
      if (input.category !== "pc") {
        throw new CampaignCharacterRosterCandidateNotFoundError();
      }

      const character = await this.characterService.getCharacterById(input.sourceId);

      if (!isEligibleCampaignCharacterRosterCandidate(character)) {
        throw new CampaignCharacterRosterCandidateNotFoundError();
      }

      return character.name;
    }

    if (input.sourceType === "template" && input.category !== "template") {
      throw new Error("Template roster entries must use the template category.");
    }

    if (input.sourceType === "reusableEntity" && input.category === "template") {
      throw new Error("Reusable entity roster entries cannot use the template category.");
    }

    const entity = await this.repository.getReusableEntityById(input.sourceId);

    if (!entity) {
      throw new Error("Reusable entity not found.");
    }

    if (input.sourceType === "reusableEntity") {
      const campaign = await this.repository.getCampaignById(input.campaignId);
      const isOwnedRequest =
        campaign?.gmUserId === input.actorUserId && entity.gmUserId === input.actorUserId;

      if (!campaign || !isOwnedRequest) {
        throw new Error("Reusable entity not found.");
      }

      const snapshot =
        entity.snapshot && typeof entity.snapshot === "object" && !Array.isArray(entity.snapshot)
          ? (entity.snapshot as Record<string, unknown>)
          : undefined;

      if (snapshot?.actorClass === "campaign_npc" && snapshot.campaignId !== input.campaignId) {
        throw new Error("Reusable entity not found.");
      }
    }

    return entity.name;
  }
}
