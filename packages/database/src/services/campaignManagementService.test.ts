import { describe, expect, it, vi } from "vitest";

import type { CampaignNote } from "@glantri/domain";

import type { CampaignNoteRepository } from "../repositories/campaignNoteRepository";
import { CampaignManagementService } from "./campaignManagementService";

const now = "2026-09-17T08:00:00.000Z";

function makeNote(overrides: Partial<CampaignNote> = {}): CampaignNote {
  return {
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
