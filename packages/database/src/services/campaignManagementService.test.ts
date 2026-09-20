import { describe, expect, it, vi } from "vitest";

import type { CampaignNote } from "@glantri/domain";

import type { CampaignNoteRepository } from "../repositories/campaignNoteRepository";
import { CampaignManagementService, CampaignNoteReferenceError } from "./campaignManagementService";

const now = "2026-09-17T08:00:00.000Z";

function makeNote(overrides: Partial<CampaignNote> = {}): CampaignNote {
  return {
    associations: [],
    campaignId: "campaign-1",
    content: "Watch the western gate.",
    createdAt: now,
    createdByUserId: "gm-1",
    id: "note-1",
    status: "open",
    updatedAt: now,
    updatedByUserId: "gm-1",
    ...overrides,
  };
}

describe("CampaignManagementService", () => {
  it("derives current contexts, objective activity, and prominent versus historical NPCs", async () => {
    const notes: CampaignNoteRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      listByCampaign: vi.fn().mockResolvedValue([makeNote()]),
      update: vi.fn(),
    };
    const campaigns = {
      getCampaignById: vi.fn().mockResolvedValue({
        createdAt: now,
        description: "",
        gmUserId: "gm-1",
        id: "campaign-1",
        name: "Border Trouble",
        settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
        slug: "border-trouble",
        status: "active",
        updatedAt: now,
      }),
      listCampaignAssets: vi.fn().mockResolvedValue([{ id: "asset-1", title: "Old Map" }]),
      listCampaignRosterHistoryEntries: vi.fn().mockResolvedValue([
        {
          campaignId: "campaign-1",
          category: "pc",
          createdAt: now,
          id: "roster-pc-current",
          labelSnapshot: "Ari",
          membershipState: "current",
          sourceId: "character-1",
          sourceType: "character",
          updatedAt: now,
        },
        {
          campaignId: "campaign-1",
          category: "pc",
          createdAt: now,
          id: "roster-pc-former",
          labelSnapshot: "Bryn",
          membershipState: "former",
          sourceId: "character-2",
          sourceType: "character",
          updatedAt: now,
        },
        {
          campaignId: "campaign-1",
          category: "npc",
          createdAt: now,
          id: "roster-npc",
          labelSnapshot: "Captain Harl",
          membershipState: "current",
          sourceId: "npc-prominent",
          sourceType: "reusableEntity",
          updatedAt: now,
        },
      ]),
      listReusableEntitiesByGameMaster: vi.fn().mockResolvedValue([
        { id: "npc-prominent", name: "Captain Harl" },
        { id: "npc-historical", name: "The Courier" },
      ]),
    };
    const scenarios = {
      listScenarioEventLogs: vi.fn(async (scenarioId: string) =>
        scenarioId === "scenario-live"
          ? [
              {
                createdAt: "2026-09-17T09:00:00.000Z",
                eventType: "encounter_started",
                id: "event-1",
                payload: { encounterId: "encounter-1", privateRoll: 99 },
                scenarioId,
                summary: "The gate confrontation began.",
              },
            ]
          : [],
      ),
      listScenarioParticipants: vi.fn(async (scenarioId: string) =>
        scenarioId === "scenario-past"
          ? [
              {
                entityId: "npc-historical",
                snapshot: { displayName: "Masked Courier" },
                sourceType: "entity",
              },
            ]
          : [],
      ),
      listScenariosByCampaign: vi.fn().mockResolvedValue([
        {
          campaignId: "campaign-1",
          createdAt: now,
          description: "",
          id: "scenario-live",
          kind: "mixed",
          name: "Western Gate",
          status: "live",
          updatedAt: "2026-09-17T09:00:00.000Z",
        },
        {
          campaignId: "campaign-1",
          createdAt: now,
          description: "",
          id: "scenario-paused",
          kind: "social",
          name: "Council Chamber",
          status: "paused",
          updatedAt: "2026-09-17T08:30:00.000Z",
        },
        {
          campaignId: "campaign-1",
          createdAt: now,
          description: "",
          id: "scenario-past",
          kind: "travel",
          name: "Old Road",
          status: "completed",
          updatedAt: now,
        },
      ]),
    };
    const encounters = {
      listEncountersByScenario: vi.fn(async (scenarioId: string) =>
        scenarioId === "scenario-live"
          ? [
              {
                combatRoundState: { roundNumber: 1 },
                id: "encounter-1",
                status: "active",
                title: "Gate Skirmish",
                updatedAt: "2026-09-17T09:05:00.000Z",
              },
            ]
          : [],
      ),
    };
    const service = new CampaignManagementService(
      notes,
      campaigns as never,
      scenarios as never,
      encounters as never,
    );

    const overview = await service.getOverview("campaign-1");

    expect(overview?.currentContexts.map((entry) => entry.scenario.id)).toEqual([
      "scenario-live",
      "scenario-paused",
    ]);
    expect(overview?.currentContexts[0]?.encounters[0]).toMatchObject({
      activeCombat: true,
      id: "encounter-1",
    });
    expect(overview?.recentActivity).toEqual([
      expect.objectContaining({
        encounterTitle: "Gate Skirmish",
        scenarioName: "Western Gate",
        summary: "The gate confrontation began.",
      }),
    ]);
    expect(JSON.stringify(overview?.recentActivity)).not.toContain("privateRoll");
    expect(overview?.npcs).toEqual([
      expect.objectContaining({ id: "npc-prominent", prominent: true }),
      expect.objectContaining({ historical: true, id: "npc-historical", prominent: false }),
    ]);
    expect(overview?.references).toEqual(
      expect.arrayContaining([
        { id: "character-2", label: "Bryn", type: "character" },
        { id: "asset-1", label: "Old Map", type: "artifact" },
      ]),
    );
  });
});

function buildAssociationService(noteRepository: Partial<CampaignNoteRepository> = {}) {
  const notes: CampaignNoteRepository = {
    create: vi.fn(async (input) => makeNote({ associations: input.associations ?? [] })),
    getById: vi.fn(),
    listByCampaign: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    ...noteRepository,
  };
  const campaigns = {
    getCampaignById: vi.fn().mockResolvedValue({
      createdAt: now,
      description: "",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "border-trouble",
      status: "active",
      updatedAt: now,
    }),
    listCampaignAssets: vi.fn().mockResolvedValue([]),
    listCampaignRosterHistoryEntries: vi.fn().mockResolvedValue([
      {
        campaignId: "campaign-1",
        category: "pc",
        createdAt: now,
        id: "roster-pc",
        labelSnapshot: "Ari",
        membershipState: "current",
        sourceId: "character-1",
        sourceType: "character",
        updatedAt: now,
      },
      {
        campaignId: "campaign-1",
        category: "npc",
        createdAt: now,
        id: "roster-npc",
        labelSnapshot: "Captain Harl",
        membershipState: "current",
        sourceId: "npc-1",
        sourceType: "reusableEntity",
        updatedAt: now,
      },
    ]),
    listReusableEntitiesByGameMaster: vi
      .fn()
      .mockResolvedValue([{ id: "npc-1", name: "Captain Harl" }]),
  };
  const scenarios = {
    listScenarioEventLogs: vi.fn().mockResolvedValue([]),
    listScenarioParticipants: vi.fn().mockResolvedValue([]),
    listScenariosByCampaign: vi.fn().mockResolvedValue([
      {
        campaignId: "campaign-1",
        createdAt: now,
        description: "",
        id: "scenario-live",
        kind: "mixed",
        name: "Western Gate",
        status: "live",
        updatedAt: now,
      },
    ]),
  };
  const encounters = {
    listEncountersByScenario: vi.fn(async (scenarioId: string) =>
      scenarioId === "scenario-live"
        ? [{ id: "encounter-1", status: "active", title: "Gate Skirmish", updatedAt: now }]
        : [],
    ),
  };
  return {
    notes,
    service: new CampaignManagementService(
      notes,
      campaigns as never,
      scenarios as never,
      encounters as never,
    ),
  };
}

describe("CampaignManagementService Note associations", () => {
  it("exposes the owning Scenario on Encounter references so the index can link to its canonical home", async () => {
    const { service } = buildAssociationService();

    const overview = await service.getOverview("campaign-1");

    expect(overview?.references).toEqual(
      expect.arrayContaining([
        {
          id: "encounter-1",
          label: "Gate Skirmish",
          scenarioId: "scenario-live",
          type: "encounter",
        },
      ]),
    );
  });

  it("stores multiple Campaign-scoped associations and normalizes custom tags", async () => {
    const { notes, service } = buildAssociationService();

    await service.createNote({
      actorUserId: "gm-1",
      associations: [
        { id: "scenario-live", label: "Spoofed label", type: "scenario" },
        { id: "encounter-1", label: "Gate Skirmish", type: "encounter" },
        { id: "character-1", label: "Ari", type: "character" },
        { id: "npc-1", label: "Captain Harl", type: "npc" },
        { id: "ignored", label: "  Loose   End  ", type: "tag" },
      ],
      campaignId: "campaign-1",
      content: "Follow the courier.",
    });

    expect(notes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        associations: [
          // The canonical label wins over whatever the caller sent.
          { id: "scenario-live", label: "Western Gate", type: "scenario" },
          {
            id: "encounter-1",
            label: "Gate Skirmish",
            scenarioId: "scenario-live",
            type: "encounter",
          },
          { id: "character-1", label: "Ari", type: "character" },
          { id: "npc-1", label: "Captain Harl", type: "npc" },
          { id: "loose end", label: "Loose End", type: "tag" },
        ],
      }),
    );
  });

  it("fails closed when an association is not material of this Campaign", async () => {
    const { notes, service } = buildAssociationService();

    await expect(
      service.createNote({
        actorUserId: "gm-1",
        associations: [
          { id: "scenario-from-another-campaign", label: "Elsewhere", type: "scenario" },
        ],
        campaignId: "campaign-1",
        content: "Should not persist.",
      }),
    ).rejects.toThrow(CampaignNoteReferenceError);
    expect(notes.create).not.toHaveBeenCalled();
  });

  it("still accepts a legacy single reference payload", async () => {
    const { notes, service } = buildAssociationService();

    await service.createNote({
      actorUserId: "gm-1",
      campaignId: "campaign-1",
      content: "Legacy caller.",
      reference: { id: "scenario-live", label: "Western Gate", type: "scenario" },
    });

    expect(notes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        associations: [{ id: "scenario-live", label: "Western Gate", type: "scenario" }],
      }),
    );
  });

  it("reports the distinct tags this Campaign's Notes already use", async () => {
    const { service } = buildAssociationService({
      listByCampaign: vi.fn().mockResolvedValue([
        makeNote({ associations: [{ id: "prep", label: "Prep", type: "tag" }], id: "note-1" }),
        makeNote({
          associations: [
            { id: "prep", label: "Prep", type: "tag" },
            { id: "rumour", label: "Rumour", type: "tag" },
            { id: "scenario-live", label: "Western Gate", type: "scenario" },
          ],
          id: "note-2",
        }),
      ]),
    });

    const overview = await service.getOverview("campaign-1");

    expect(overview?.tags).toEqual([
      { id: "prep", label: "Prep", type: "tag" },
      { id: "rumour", label: "Rumour", type: "tag" },
    ]);
  });
});
