import {
  campaignNoteReferenceSchema,
  campaignNoteRevisionSchema,
  campaignNoteSchema,
  campaignNoteStatusSchema,
  campaignWorkspaceOverviewSchema,
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
      ...allEncounters.map((encounter) => ({
        id: encounter.id,
        label: encounter.title,
        type: "encounter" as const,
      })),
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
    });
  }

  async createNote(input: {
    actorUserId: string;
    campaignId: string;
    content: string;
    reference?: CampaignNoteReference;
  }): Promise<CampaignNote> {
    const content = campaignNoteSchema.shape.content.parse(input.content);
    const reference =
      (await this.validateReference(input.campaignId, input.reference)) ?? undefined;
    return this.notes.create({ ...input, content, reference });
  }

  async updateNote(input: {
    actorUserId: string;
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
    const reference = await this.validateReference(input.campaignId, input.reference);
    const updated = await this.notes.update({
      actorUserId: input.actorUserId,
      content,
      expectedRevision,
      noteId: input.noteId,
      reference,
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

  private async validateReference(
    campaignId: string,
    reference?: CampaignNoteReference | null,
  ): Promise<CampaignNoteReference | undefined | null> {
    if (reference === undefined || reference === null) return reference;
    const parsed = campaignNoteReferenceSchema.parse(reference);
    const overview = await this.getOverview(campaignId);
    const canonical = overview?.references.find(
      (candidate) => candidate.type === parsed.type && candidate.id === parsed.id,
    );
    if (!canonical) throw new CampaignNoteReferenceError();
    return canonical;
  }
}
