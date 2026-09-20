import {
  campaignNoteAssociationKey,
  campaignNoteAssociationLimit,
  campaignNoteAssociationsSchema,
  campaignNoteReferenceSchema,
  campaignNoteRevisionSchema,
  campaignNoteSchema,
  campaignNoteStatusSchema,
  campaignNoteTagId,
  campaignWorkspaceOverviewSchema,
  normalizeCampaignNoteTagLabel,
  type CampaignNote,
  type CampaignNoteReference,
  type CampaignNoteStatus,
  type CampaignNpcSummary,
  type CampaignWorkspaceOverview,
  type ScenarioParticipant,
} from "@glantri/domain";

import {
  createPrismaCampaignNoteRepository,
  type CampaignNoteRepository,
} from "../repositories/campaignNoteRepository";
import { CampaignService } from "./campaignService";
import { EncounterService } from "./encounterService";
import { ScenarioService } from "./scenarioService";

export class CampaignNoteNotFoundError extends Error {
  constructor() {
    super("Campaign note not found.");
    this.name = "CampaignNoteNotFoundError";
  }
}

export class CampaignNoteReferenceError extends Error {
  constructor() {
    super("Campaign note reference is not available in this Campaign.");
    this.name = "CampaignNoteReferenceError";
  }
}

export class CampaignNoteConflictError extends Error {
  constructor(public readonly currentNote: CampaignNote) {
    super("Campaign note changed. Review the current Note before saving again.");
    this.name = "CampaignNoteConflictError";
  }
}

function readEncounterId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const encounterId = (payload as Record<string, unknown>).encounterId;
  return typeof encounterId === "string" && encounterId.length > 0 ? encounterId : undefined;
}

function participantLabel(participant: ScenarioParticipant): string {
  return participant.snapshot.displayName || "Campaign NPC";
}

/**
 * Callers may send the new `associations` list, or the legacy single `reference`.
 * `associations` wins when present; otherwise a legacy reference becomes one association.
 */
function resolveRequestedAssociations(input: {
  associations?: CampaignNoteReference[];
  reference?: CampaignNoteReference | null;
}): CampaignNoteReference[] {
  if (input.associations !== undefined) return input.associations;
  return input.reference ? [input.reference] : [];
}

/** Distinct custom tags already used by this Campaign's Notes, offered for reuse. */
function collectCampaignNoteTags(notes: CampaignNote[]): CampaignNoteReference[] {
  const tagsById = new Map<string, CampaignNoteReference>();
  for (const note of notes) {
    for (const association of note.associations) {
      if (association.type !== "tag" || tagsById.has(association.id)) continue;
      tagsById.set(association.id, association);
    }
  }
  return [...tagsById.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export class CampaignManagementService {
  constructor(
    private readonly notes: CampaignNoteRepository = createPrismaCampaignNoteRepository(),
    private readonly campaigns = new CampaignService(),
    private readonly scenarios = new ScenarioService(),
    private readonly encounters = new EncounterService(),
  ) {}

  async getOverview(campaignId: string): Promise<CampaignWorkspaceOverview | null> {
    const campaign = await this.campaigns.getCampaignById(campaignId);
    if (!campaign) return null;

    const [scenarioRecords, roster, notes, assets, entities] = await Promise.all([
      this.scenarios.listScenariosByCampaign(campaignId),
      this.campaigns.listCampaignRosterHistoryEntries(campaignId),
      this.notes.listByCampaign(campaignId),
      this.campaigns.listCampaignAssets(campaignId),
      this.campaigns.listReusableEntitiesByGameMaster(campaign.gmUserId),
    ]);
    const scenarioDetails = await Promise.all(
      scenarioRecords.map(async (scenario) => {
        const [participants, eventLogs, encounters] = await Promise.all([
          this.scenarios.listScenarioParticipants(scenario.id),
          this.scenarios.listScenarioEventLogs(scenario.id),
          this.encounters.listEncountersByScenario(scenario.id),
        ]);
        return { encounters, eventLogs, participants, scenario };
      }),
    );
    const allEncounters = scenarioDetails.flatMap((entry) => entry.encounters);
    const encounterById = new Map(allEncounters.map((encounter) => [encounter.id, encounter]));
    const prominentNpcIds = new Set(
      roster
        .filter(
          (entry) =>
            entry.category === "npc" &&
            entry.sourceType === "reusableEntity" &&
            (entry.membershipState ?? "current") === "current",
        )
        .map((entry) => entry.sourceId),
    );
    const npcById = new Map<string, CampaignNpcSummary>();

    for (const rosterEntry of roster) {
      if (rosterEntry.category !== "npc" || rosterEntry.sourceType !== "reusableEntity") continue;
      npcById.set(rosterEntry.sourceId, {
        historical: false,
        id: rosterEntry.sourceId,
        label: rosterEntry.labelSnapshot ?? "Campaign NPC",
        prominent: prominentNpcIds.has(rosterEntry.sourceId),
        scenarioIds: [],
      });
    }
    for (const { participants, scenario } of scenarioDetails) {
      for (const participant of participants) {
        if (participant.sourceType !== "entity" || !participant.entityId) continue;
        const existing = npcById.get(participant.entityId);
        const scenarioIds = new Set(existing?.scenarioIds ?? []);
        scenarioIds.add(scenario.id);
        npcById.set(participant.entityId, {
          historical: true,
          id: participant.entityId,
          label:
            entities.find((entity) => entity.id === participant.entityId)?.name ??
            existing?.label ??
            participantLabel(participant),
          prominent: prominentNpcIds.has(participant.entityId),
          scenarioIds: [...scenarioIds],
        });
      }
    }

    const references: CampaignNoteReference[] = [
      { id: campaign.id, label: campaign.name, type: "campaign" },
      ...scenarioRecords.map((scenario) => ({
        id: scenario.id,
        label: scenario.name,
        type: "scenario" as const,
      })),
      // Encounter references carry their owning Scenario so the Campaign index can
      // link straight to the Encounter's canonical home.
      ...scenarioDetails.flatMap(({ encounters, scenario }) =>
        encounters.map((encounter) => ({
          id: encounter.id,
          label: encounter.title,
          scenarioId: scenario.id,
          type: "encounter" as const,
        })),
      ),
      ...roster
        .filter((entry) => entry.category === "pc" && entry.sourceType === "character")
        .map((entry) => ({
          id: entry.sourceId,
          label: entry.labelSnapshot ?? "Campaign PC",
          type: "character" as const,
        })),
      ...[...npcById.values()].map((npc) => ({
        id: npc.id,
        label: npc.label,
        type: "npc" as const,
      })),
      ...assets.map((asset) => ({
        id: asset.id,
        label: asset.title,
        type: "artifact" as const,
      })),
    ].map((reference) => campaignNoteReferenceSchema.parse(reference));

    const currentContexts = scenarioDetails
      .filter(({ scenario }) => scenario.status === "live" || scenario.status === "paused")
      .map(({ encounters, scenario }) => ({
        encounters: encounters
          .filter((encounter) => encounter.status === "active" || encounter.status === "paused")
          .map((encounter) => ({
            activeCombat: encounter.status === "active" && Boolean(encounter.combatRoundState),
            id: encounter.id,
            status: encounter.status,
            title: encounter.title,
            updatedAt: encounter.updatedAt,
          })),
        scenario: {
          id: scenario.id,
          name: scenario.name,
          status: scenario.status,
          updatedAt: scenario.updatedAt,
        },
      }))
      .sort(
        (left, right) =>
          Date.parse(right.scenario.updatedAt) - Date.parse(left.scenario.updatedAt) ||
          left.scenario.name.localeCompare(right.scenario.name),
      );
    const recentActivity = scenarioDetails
      .flatMap(({ eventLogs, scenario }) =>
        eventLogs.map((event) => {
          const encounterId = readEncounterId(event.payload);
          const encounter = encounterId ? encounterById.get(encounterId) : undefined;
          return {
            createdAt: event.createdAt,
            encounterId,
            encounterTitle: encounter?.title,
            eventType: event.eventType,
            id: event.id,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            summary: event.summary,
          };
        }),
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 12);

    return campaignWorkspaceOverviewSchema.parse({
      campaign,
      currentContexts,
      notes,
      npcs: [...npcById.values()].sort(
        (left, right) =>
          Number(right.prominent) - Number(left.prominent) || left.label.localeCompare(right.label),
      ),
      recentActivity,
      references,
      roster,
      tags: collectCampaignNoteTags(notes),
    });
  }

  async createNote(input: {
    actorUserId: string;
    associations?: CampaignNoteReference[];
    campaignId: string;
    content: string;
    reference?: CampaignNoteReference;
  }): Promise<CampaignNote> {
    const content = campaignNoteSchema.shape.content.parse(input.content);
    const associations = await this.validateAssociations(
      input.campaignId,
      resolveRequestedAssociations(input),
    );
    return this.notes.create({
      actorUserId: input.actorUserId,
      associations,
      campaignId: input.campaignId,
      content,
    });
  }

  async updateNote(input: {
    actorUserId: string;
    associations?: CampaignNoteReference[];
    campaignId: string;
    content: string;
    expectedRevision: string;
    noteId: string;
    reference?: CampaignNoteReference | null;
  }): Promise<CampaignNote> {
    const note = await this.requireNote(input.campaignId, input.noteId);
    const content = campaignNoteSchema.shape.content.parse(input.content);
    const expectedRevision = campaignNoteRevisionSchema.parse(input.expectedRevision);
    if (note.updatedAt !== expectedRevision) throw new CampaignNoteConflictError(note);
    const associations = await this.validateAssociations(
      input.campaignId,
      resolveRequestedAssociations(input),
    );
    const updated = await this.notes.update({
      actorUserId: input.actorUserId,
      associations,
      content,
      expectedRevision,
      noteId: input.noteId,
    });
    if (updated) return updated;
    throw new CampaignNoteConflictError(await this.requireNote(input.campaignId, input.noteId));
  }

  async setNoteStatus(input: {
    actorUserId: string;
    campaignId: string;
    expectedRevision: string;
    noteId: string;
    status: CampaignNoteStatus;
  }): Promise<CampaignNote> {
    const note = await this.requireNote(input.campaignId, input.noteId);
    const expectedRevision = campaignNoteRevisionSchema.parse(input.expectedRevision);
    if (note.updatedAt !== expectedRevision) throw new CampaignNoteConflictError(note);
    const status = campaignNoteStatusSchema.parse(input.status);
    if (note.status === status) return note;
    const updated = await this.notes.update({
      actorUserId: input.actorUserId,
      expectedRevision,
      noteId: input.noteId,
      status,
    });
    if (updated) return updated;
    throw new CampaignNoteConflictError(await this.requireNote(input.campaignId, input.noteId));
  }

  private async requireNote(campaignId: string, noteId: string): Promise<CampaignNote> {
    const note = await this.notes.getById(noteId);
    if (!note || note.campaignId !== campaignId) throw new CampaignNoteNotFoundError();
    return note;
  }

  /**
   * Fail-closed, Campaign-scoped association validation.
   *
   * Every object association must resolve to material this Campaign actually offers,
   * and the stored label/Scenario always comes from that canonical entry rather than
   * from the caller, so a caller cannot smuggle in a foreign object or a false label.
   * Custom tags are Campaign-local by construction and are only normalized.
   */
  private async validateAssociations(
    campaignId: string,
    requested: CampaignNoteReference[],
  ): Promise<CampaignNoteReference[]> {
    const parsed = campaignNoteAssociationsSchema.parse(
      requested.map((association) => campaignNoteReferenceSchema.parse(association)),
    );
    if (parsed.length === 0) return [];

    const tags: CampaignNoteReference[] = [];
    const objectAssociations: CampaignNoteReference[] = [];
    for (const association of parsed) {
      if (association.type === "tag") {
        const label = normalizeCampaignNoteTagLabel(association.label);
        if (!label) throw new CampaignNoteReferenceError();
        tags.push({ id: campaignNoteTagId(label), label, type: "tag" });
      } else {
        objectAssociations.push(association);
      }
    }

    const resolved: CampaignNoteReference[] = [];
    if (objectAssociations.length > 0) {
      const overview = await this.getOverview(campaignId);
      const canonicalByKey = new Map(
        (overview?.references ?? []).map((reference) => [
          campaignNoteAssociationKey(reference),
          reference,
        ]),
      );
      for (const association of objectAssociations) {
        const canonical = canonicalByKey.get(campaignNoteAssociationKey(association));
        if (!canonical) throw new CampaignNoteReferenceError();
        resolved.push(canonical);
      }
    }

    // Deduplicate after normalization, keeping the caller's ordering.
    const seen = new Set<string>();
    const associations: CampaignNoteReference[] = [];
    for (const association of [...resolved, ...tags]) {
      const key = campaignNoteAssociationKey(association);
      if (seen.has(key)) continue;
      seen.add(key);
      associations.push(association);
    }
    if (associations.length > campaignNoteAssociationLimit) throw new CampaignNoteReferenceError();
    return associations;
  }
}
