import type {
  CampaignBlackboardEntry,
  CampaignBlackboardEntryRevision,
  CampaignBlackboardPlacement,
} from "@prisma/client";

import {
  blackboardArchiveSchema,
  blackboardCommonEntrySchema,
  blackboardCreateSchema,
  blackboardExpandedDetailSchema,
  blackboardExpectedEntryVersionSchema,
  blackboardGmCreateSchema,
  blackboardGmRevisionSchema,
  blackboardGrantCommandSchema,
  blackboardPlacementCreateSchema,
  blackboardPlacementDeleteSchema,
  blackboardPlacementDtoSchema,
  blackboardPlacementGroupSchema,
  blackboardPlacementUpdateSchema,
  blackboardRevisionContentSchema,
  blackboardRevisionSchema,
  blackboardSafeHistorySchema,
  blackboardTombstoneSchema,
  serializeBlackboardCommonDto,
  type ArtifactBlackboardCandidate,
  type BlackboardCommonEntry,
  type BlackboardPlacementDto,
  type BlackboardTombstone,
} from "@glantri/domain";

import {
  BlackboardRepository,
  BlackboardRepositoryConflictError,
} from "../repositories/blackboardRepository";
import { CampaignService } from "./campaignService";

export class BlackboardUnavailableError extends Error {
  constructor() {
    super("Blackboard unavailable.");
    this.name = "BlackboardUnavailableError";
  }
}

export class BlackboardDetailUnavailableError extends Error {
  constructor() {
    super("Blackboard detail unavailable.");
    this.name = "BlackboardDetailUnavailableError";
  }
}

export class BlackboardReferenceUnavailableError extends Error {
  constructor() {
    super("Blackboard reference unavailable.");
    this.name = "BlackboardReferenceUnavailableError";
  }
}

export class BlackboardConflictError extends Error {
  readonly retryable: boolean;

  constructor(retryable = false) {
    super(
      retryable
        ? "Blackboard changed. Refresh and retry."
        : "Blackboard changed. Refresh and review.",
    );
    this.name = "BlackboardConflictError";
    this.retryable = retryable;
  }
}

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}

function artifactSnapshot(revision: CampaignBlackboardEntryRevision) {
  if (
    !revision.sourceArtifactIdSnapshot ||
    !revision.sourceArtifactKind ||
    !revision.sourceArtifactTitle ||
    !revision.sourceArtifactAltText ||
    !revision.sourceArtifactMediaType
  ) {
    throw new BlackboardReferenceUnavailableError();
  }
  return {
    altText: revision.sourceArtifactAltText,
    artifactKind: revision.sourceArtifactKind as "image" | "map",
    id: revision.sourceArtifactIdSnapshot,
    mediaType: revision.sourceArtifactMediaType as "image/jpeg" | "image/png" | "image/webp",
    title: revision.sourceArtifactTitle,
  };
}

function candidateMatchesSnapshot(
  candidate: ArtifactBlackboardCandidate,
  revision: CampaignBlackboardEntryRevision,
) {
  return (
    candidate.id === revision.sourceArtifactIdSnapshot &&
    candidate.artifactKind === revision.sourceArtifactKind &&
    candidate.title === revision.sourceArtifactTitle &&
    candidate.altText === revision.sourceArtifactAltText &&
    candidate.mediaType === revision.sourceArtifactMediaType
  );
}

function mapPlacement(placement: CampaignBlackboardPlacement): BlackboardPlacementDto {
  return blackboardPlacementDtoSchema.parse({
    entryId: placement.entryId,
    groupId: optional(placement.groupId),
    height: placement.height,
    layer: placement.layer,
    rowVersion: placement.rowVersion,
    updatedAt: placement.updatedAt.toISOString(),
    updatedByLabel: placement.updatedByLabelSnapshot,
    width: placement.width,
    x: placement.x,
    y: placement.y,
  });
}

function mapTombstone(entry: CampaignBlackboardEntry): BlackboardTombstone {
  return blackboardTombstoneSchema.parse({
    id: entry.id,
    removedAt: entry.stateChangedAt.toISOString(),
    removedByLabel: entry.stateChangedByLabelSnapshot,
    state: "Removed",
  });
}

function mapRevisionContent(revision: CampaignBlackboardEntryRevision) {
  if (revision.category === "clue_fact" && revision.clueFact) {
    return blackboardRevisionContentSchema.parse({
      category: "clue_fact",
      context: optional(revision.contextText),
      fact: revision.clueFact,
      title: revision.title,
    });
  }
  if (revision.category === "document_text" && revision.documentText) {
    return blackboardRevisionContentSchema.parse({
      category: "document_text",
      context: optional(revision.contextText),
      documentText: revision.documentText,
      title: revision.title,
    });
  }
  if (revision.category === "image_map") {
    return blackboardRevisionContentSchema.parse({
      artifact: artifactSnapshot(revision),
      caption: optional(revision.imageCaption),
      category: "image_map",
      title: revision.title,
    });
  }
  if (
    revision.category === "recap" &&
    revision.recapText &&
    revision.approvedAt &&
    revision.approvedByLabelSnapshot
  ) {
    return blackboardRevisionContentSchema.parse({
      approvedAt: revision.approvedAt.toISOString(),
      approvedByLabel: revision.approvedByLabelSnapshot,
      category: "recap",
      recapText: revision.recapText,
      title: revision.title,
    });
  }
  throw new BlackboardReferenceUnavailableError();
}

export class BlackboardService {
  constructor(
    private readonly repository = new BlackboardRepository(),
    private readonly campaignService = new CampaignService(),
  ) {}

  async getBoard(campaignId: string, userId: string) {
    await this.requireCommonAccess(campaignId, userId);
    const records = await this.repository.loadBoard(campaignId);
    const revisions = new Map(records.revisions.map((revision) => [revision.entryId, revision]));
    const catalogue: BlackboardCommonEntry[] = [];
    const tombstones: BlackboardTombstone[] = [];
    for (const entry of records.entries) {
      if (entry.state === "retracted") {
        tombstones.push(mapTombstone(entry));
        continue;
      }
      const revision = revisions.get(entry.id);
      if (!revision) throw new BlackboardReferenceUnavailableError();
      catalogue.push(await this.mapCommonEntry(entry, revision));
    }
    return serializeBlackboardCommonDto({
      catalogue,
      layout: {
        placements: records.placements.map(mapPlacement),
        version: records.layout?.layoutVersion ?? 0,
      },
      tombstones,
    });
  }

  async getEntry(input: {
    campaignId: string;
    entryId: string;
    userId: string;
    viewerCharacterId?: string;
  }) {
    const access = await this.requireCommonAccess(input.campaignId, input.userId);
    const record = await this.repository.loadEntry(input.campaignId, input.entryId);
    if (!record) throw new BlackboardReferenceUnavailableError();
    if (record.entry.state === "retracted") {
      if (input.viewerCharacterId) throw new BlackboardDetailUnavailableError();
      return { entry: mapTombstone(record.entry) };
    }
    const common = await this.mapCommonEntry(record.entry, record.revision);
    if (!input.viewerCharacterId) return { entry: common };
    if (access.isGm) throw new BlackboardDetailUnavailableError();
    const character = await this.repository.resolveViewerCharacter({
      campaignId: input.campaignId,
      userId: input.userId,
      viewerCharacterId: input.viewerCharacterId,
    });
    if (!character) throw new BlackboardDetailUnavailableError();
    const details = await this.repository.loadExpandedDetails({
      campaignId: input.campaignId,
      characterId: character.id,
      entryId: input.entryId,
    });
    return blackboardExpandedDetailSchema.parse({
      common,
      restrictedDetails: details.map((detail) => ({
        detailText: detail.detailText,
        label: optional(detail.label),
      })),
    });
  }

  async getHistory(campaignId: string, entryId: string, userId: string) {
    await this.requireCommonAccess(campaignId, userId);
    const history = await this.repository.loadSafeHistory(campaignId, entryId);
    if (!history) throw new BlackboardReferenceUnavailableError();
    if (history.entry.state === "retracted") return { entry: mapTombstone(history.entry) };
    return blackboardSafeHistorySchema.parse({
      currentEntryVersion: history.entry.entryVersion,
      entryId,
      revisions: history.revisions.map((revision) => ({
        changeKind: revision.changeKind,
        changedAt: revision.changedAt.toISOString(),
        changedByLabel: revision.actorLabelSnapshot,
        content: mapRevisionContent(revision),
        revisionNumber: revision.revisionNumber,
      })),
    });
  }

  async getAudit(campaignId: string, entryId: string, userId: string) {
    await this.requireOwningGm(campaignId, userId);
    const audit = await this.repository.loadGmAudit(campaignId, entryId);
    if (!audit) throw new BlackboardReferenceUnavailableError();
    return {
      entry: {
        category: audit.entry.category,
        createdAt: audit.entry.createdAt.toISOString(),
        createdByLabel: audit.entry.createdByLabelSnapshot,
        createdByUserId: audit.entry.createdByUserId,
        currentRevisionNumber: audit.entry.currentRevisionNumber,
        entryVersion: audit.entry.entryVersion,
        id: audit.entry.id,
        state: audit.entry.state,
      },
      entryEvents: audit.events.map((event) => ({
        action: event.action,
        actorLabel: event.actorLabelSnapshot,
        actorUserId: event.actorUserId,
        entryVersion: event.entryVersion,
        occurredAt: event.occurredAt.toISOString(),
        revisionNumber: event.revisionNumber ?? undefined,
      })),
      grantEvents: audit.grantEvents.map((event) => ({
        actorLabel: event.actorLabelSnapshot,
        actorUserId: event.actorUserId,
        entryRevisionNumber: event.entryRevisionNumber,
        occurredAt: event.occurredAt.toISOString(),
        resultState: event.resultState,
        streamVersion: event.streamVersion,
        targetCharacterId: event.targetCharacterIdSnapshot,
        targetCharacterLabel: event.targetCharacterLabelSnapshot,
        unitKey: event.unitKey,
        unitVersion: event.unitVersion,
      })),
      grantStreams: audit.grants.map((grant) => ({
        currentEntryRevisionNumber: grant.currentEntryRevisionNumber,
        liveCharacterId: grant.liveCharacterId ?? undefined,
        state: grant.state,
        streamVersion: grant.streamVersion,
        targetCharacterId: grant.targetCharacterIdSnapshot,
        unitKey: grant.unitKey,
        unitVersion: grant.unitVersion,
      })),
      memberships: audit.memberships,
      revisions: audit.revisions.map((revision) => ({
        actorLabel: revision.actorLabelSnapshot,
        actorUserId: revision.actorUserId,
        changeKind: revision.changeKind,
        changedAt: revision.changedAt.toISOString(),
        content: mapRevisionContent(revision),
        revisionNumber: revision.revisionNumber,
      })),
      sourceLinks: audit.sources,
      unitLineages: audit.lineages,
      unitVersions: audit.versions.map((version) => ({
        createdAt: version.createdAt.toISOString(),
        createdByLabel: version.createdByLabelSnapshot,
        createdByUserId: version.createdByUserId,
        detailText: version.detailText,
        label: version.labelSnapshot ?? undefined,
        unitKey: version.unitKey,
        unitVersion: version.unitVersion,
      })),
    };
  }

  async createEntry(campaignId: string, userId: string, rawInput: unknown) {
    const access = await this.requireCommonAccess(campaignId, userId);
    const content = access.isGm
      ? blackboardGmCreateSchema.parse(rawInput)
      : blackboardCreateSchema.parse(rawInput);
    if (!access.isGm && content.category === "recap") {
      throw new BlackboardReferenceUnavailableError();
    }
    try {
      const entryId = await this.repository.createEntry({
        actor: access.actor,
        campaignId,
        content,
      });
      return this.getEntry({ campaignId, entryId, userId });
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async reviseEntry(campaignId: string, entryId: string, userId: string, rawInput: unknown) {
    const access = await this.requireCommonAccess(campaignId, userId);
    const content = access.isGm
      ? blackboardGmRevisionSchema.parse(rawInput)
      : blackboardRevisionSchema.parse(rawInput);
    if (!access.isGm && content.category === "recap") {
      throw new BlackboardReferenceUnavailableError();
    }
    try {
      await this.repository.reviseEntry({
        actor: access.actor,
        campaignId,
        content,
        entryId,
        isGm: access.isGm,
      });
      return this.getEntry({ campaignId, entryId, userId });
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async retractEntry(campaignId: string, entryId: string, userId: string, rawInput: unknown) {
    const access = await this.requireCommonAccess(campaignId, userId);
    const command = blackboardExpectedEntryVersionSchema.parse(rawInput);
    try {
      await this.repository.retractEntry({
        actor: access.actor,
        campaignId,
        entryId,
        expectedEntryVersion: command.expectedEntryVersion,
        isGm: access.isGm,
      });
      return this.getEntry({ campaignId, entryId, userId });
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async archiveEntry(campaignId: string, entryId: string, userId: string, rawInput: unknown) {
    const access = await this.requireOwningGm(campaignId, userId);
    const command = blackboardArchiveSchema.parse(rawInput);
    try {
      await this.repository.archiveEntry({
        actor: access.actor,
        campaignId,
        entryId,
        expectedEntryVersion: command.expectedEntryVersion,
        expectedLayoutVersion: command.expectedLayoutVersion,
      });
      return { archived: true, entryId };
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async changeGrant(input: {
    campaignId: string;
    characterId: string;
    entryId: string;
    rawInput: unknown;
    unitKey: string;
    userId: string;
  }) {
    const access = await this.requireOwningGm(input.campaignId, input.userId);
    const command = blackboardGrantCommandSchema.parse(input.rawInput);
    try {
      await this.repository.changeGrant({
        action: command.action === "grant" ? "granted" : "revoked",
        actor: access.actor,
        campaignId: input.campaignId,
        characterId: input.characterId,
        entryId: input.entryId,
        expectedEntryVersion: command.expectedEntryVersion,
        expectedGrantVersion: command.expectedGrantVersion,
        unitKey: input.unitKey,
        unitVersion: command.unitVersion,
      });
      return { state: command.action === "grant" ? "granted" : "revoked" };
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async createPlacement(campaignId: string, userId: string, rawInput: unknown) {
    const access = await this.requireCommonAccess(campaignId, userId);
    const placement = blackboardPlacementCreateSchema.parse(rawInput);
    try {
      await this.repository.createPlacement({ actor: access.actor, campaignId, ...placement });
      return this.getBoard(campaignId, userId);
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async updatePlacement(campaignId: string, entryId: string, userId: string, rawInput: unknown) {
    const access = await this.requireCommonAccess(campaignId, userId);
    const placement = blackboardPlacementUpdateSchema.parse(rawInput);
    try {
      await this.repository.updatePlacement({
        actor: access.actor,
        campaignId,
        entryId,
        ...placement,
      });
      return this.getBoard(campaignId, userId);
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async deletePlacement(campaignId: string, entryId: string, userId: string, rawInput: unknown) {
    await this.requireCommonAccess(campaignId, userId);
    const command = blackboardPlacementDeleteSchema.parse(rawInput);
    try {
      await this.repository.deletePlacement({ campaignId, entryId, ...command });
      return this.getBoard(campaignId, userId);
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  async groupPlacements(campaignId: string, userId: string, rawInput: unknown) {
    const access = await this.requireCommonAccess(campaignId, userId);
    const command = blackboardPlacementGroupSchema.parse(rawInput);
    try {
      const groupId = await this.repository.groupPlacements({
        actor: access.actor,
        campaignId,
        ...command,
      });
      return { groupId, ...(await this.getBoard(campaignId, userId)) };
    } catch (error) {
      this.translateRepositoryError(error);
    }
  }

  private async mapCommonEntry(
    entry: CampaignBlackboardEntry,
    revision: CampaignBlackboardEntryRevision,
  ): Promise<BlackboardCommonEntry> {
    const base = {
      entryVersion: entry.entryVersion,
      id: entry.id,
      state: revision.revisionNumber === 1 ? ("Current" as const) : ("Corrected" as const),
      updatedAt: revision.changedAt.toISOString(),
      updatedByLabel: revision.actorLabelSnapshot,
    };
    if (revision.category === "clue_fact" && revision.clueFact) {
      return blackboardCommonEntrySchema.parse({
        ...base,
        category: "clue_fact",
        context: optional(revision.contextText),
        fact: revision.clueFact,
        title: revision.title,
      });
    }
    if (revision.category === "document_text" && revision.documentText) {
      return blackboardCommonEntrySchema.parse({
        ...base,
        category: "document_text",
        context: optional(revision.contextText),
        documentText: revision.documentText,
        title: revision.title,
      });
    }
    if (revision.category === "image_map") {
      const snapshot = artifactSnapshot(revision);
      const [link, candidate] = await Promise.all([
        this.repository.getArtifactSourceLink(entry.campaignId, entry.id, revision.revisionNumber),
        this.repository.getArtifactCandidate(entry.campaignId, snapshot.id),
      ]);
      const available = Boolean(link && candidate);
      const sourceStatus = !available
        ? "source_unavailable"
        : candidateMatchesSnapshot(candidate!, revision)
          ? "unchanged"
          : "source_changed";
      return blackboardCommonEntrySchema.parse({
        ...base,
        artifact: snapshot,
        caption: optional(revision.imageCaption),
        category: "image_map",
        content: available ? { artifactId: snapshot.id } : undefined,
        sourceStatus,
        title: revision.title,
      });
    }
    if (
      revision.category === "recap" &&
      revision.recapText &&
      revision.approvedAt &&
      revision.approvedByLabelSnapshot
    ) {
      return blackboardCommonEntrySchema.parse({
        ...base,
        approvedAt: revision.approvedAt.toISOString(),
        approvedByLabel: revision.approvedByLabelSnapshot,
        category: "recap",
        recapText: revision.recapText,
        title: revision.title,
      });
    }
    throw new BlackboardReferenceUnavailableError();
  }

  private async requireCommonAccess(campaignId: string, userId: string) {
    const actor = await this.repository.getCampaignActor(campaignId, userId);
    if (!actor) throw new BlackboardUnavailableError();
    if (!actor.isGm) {
      const campaigns = await this.campaignService.listCampaignsByUserAccess(userId);
      if (!campaigns.some((campaign) => campaign.id === campaignId)) {
        throw new BlackboardUnavailableError();
      }
    }
    return actor;
  }

  private async requireOwningGm(campaignId: string, userId: string) {
    const access = await this.requireCommonAccess(campaignId, userId);
    if (!access.isGm) throw new BlackboardReferenceUnavailableError();
    return access;
  }

  private translateRepositoryError(error: unknown): never {
    if (error instanceof BlackboardRepositoryConflictError) {
      if (error.reason === "reference") throw new BlackboardReferenceUnavailableError();
      throw new BlackboardConflictError(error.reason === "retryable");
    }
    throw error;
  }
}
