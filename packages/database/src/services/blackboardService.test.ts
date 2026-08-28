import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BlackboardRepository,
  BlackboardRepositoryConflictError,
} from "../repositories/blackboardRepository";
import {
  BlackboardConflictError,
  BlackboardDetailUnavailableError,
  BlackboardReferenceUnavailableError,
  BlackboardService,
  BlackboardUnavailableError,
} from "./blackboardService";
import { CampaignService } from "./campaignService";

const campaignId = "campaign-1";
const now = new Date("2026-08-25T10:00:00.000Z");

function entry(overrides: Record<string, unknown> = {}) {
  return {
    campaignId,
    category: "clue_fact",
    createdAt: now,
    createdByLabelSnapshot: "Player",
    createdByUserId: "player",
    currentRevisionNumber: 1,
    entryVersion: 1,
    id: "entry-1",
    state: "published",
    stateChangedAt: now,
    stateChangedByLabelSnapshot: "Player",
    stateChangedByUserId: "player",
    updatedAt: now,
    ...overrides,
  };
}

function revision(overrides: Record<string, unknown> = {}) {
  return {
    actorLabelSnapshot: "Player",
    actorUserId: "player",
    approvedAt: null,
    approvedByLabelSnapshot: null,
    approvedByUserId: null,
    campaignId,
    category: "clue_fact",
    changeKind: "initial",
    changedAt: now,
    clueFact: "The east gate is open.",
    contextText: null,
    documentText: null,
    entryId: "entry-1",
    imageCaption: null,
    recapText: null,
    revisionNumber: 1,
    sourceArtifactAltText: null,
    sourceArtifactIdSnapshot: null,
    sourceArtifactKind: null,
    sourceArtifactMediaType: null,
    sourceArtifactTitle: null,
    title: "East gate",
    ...overrides,
  };
}

function placement(overrides: Record<string, unknown> = {}) {
  return {
    campaignId,
    entryId: "entry-1",
    groupId: null,
    height: 240,
    layer: 1,
    rowVersion: 1,
    updatedAt: now,
    updatedByLabelSnapshot: "Player",
    updatedByUserId: "player",
    width: 320,
    x: 10,
    y: 20,
    ...overrides,
  };
}

describe("BlackboardService public and privileged projections", () => {
  let repositoryMock: Record<string, ReturnType<typeof vi.fn>>;
  let campaignMock: { listCampaignsByUserAccess: ReturnType<typeof vi.fn> };
  let service: BlackboardService;

  beforeEach(() => {
    repositoryMock = {
      archiveEntry: vi.fn().mockResolvedValue(undefined),
      changeGrant: vi.fn().mockResolvedValue(undefined),
      createEntry: vi.fn().mockResolvedValue("entry-1"),
      createPlacement: vi.fn().mockResolvedValue(undefined),
      deletePlacement: vi.fn().mockResolvedValue(undefined),
      getArtifactCandidate: vi.fn().mockResolvedValue({
        altText: "A map of the eastern road",
        artifactKind: "map",
        id: "artifact-1",
        mediaType: "image/png",
        title: "Eastern road",
      }),
      getArtifactSourceLink: vi.fn().mockResolvedValue({ artifactId: "artifact-1" }),
      getCampaignActor: vi.fn().mockImplementation((_campaignId: string, userId: string) =>
        Promise.resolve(
          userId === "missing"
            ? null
            : {
                actor: { id: userId, label: userId === "gm" ? "Game Master" : "Player" },
                isGm: userId === "gm",
              },
        ),
      ),
      groupPlacements: vi.fn().mockResolvedValue("group-1"),
      loadBoard: vi
        .fn()
        .mockResolvedValue({ entries: [], layout: null, placements: [], revisions: [] }),
      loadEntry: vi.fn().mockResolvedValue({
        entry: entry(),
        placement: null,
        revision: revision(),
      }),
      loadExpandedDetails: vi
        .fn()
        .mockResolvedValue([{ detailText: "The gatekeeper is bribed.", label: "Rumour" }]),
      loadGmAudit: vi.fn(),
      loadSafeHistory: vi.fn(),
      resolveViewerCharacter: vi.fn().mockResolvedValue({ id: "character-1" }),
      retractEntry: vi.fn().mockResolvedValue(undefined),
      reviseEntry: vi.fn().mockResolvedValue(undefined),
      updatePlacement: vi.fn().mockResolvedValue(undefined),
    };
    campaignMock = {
      listCampaignsByUserAccess: vi.fn().mockResolvedValue([{ id: campaignId }]),
    };
    service = new BlackboardService(
      repositoryMock as unknown as BlackboardRepository,
      campaignMock as unknown as CampaignService,
    );
  });

  it("maps all common categories, tombstones, and shared layout without privileged facts", async () => {
    repositoryMock.loadBoard.mockResolvedValue({
      entries: [
        entry(),
        entry({ category: "document_text", id: "entry-2" }),
        entry({ category: "image_map", id: "entry-3" }),
        entry({ category: "recap", id: "entry-4" }),
        entry({ id: "entry-5", state: "retracted" }),
      ],
      layout: { campaignId, layoutVersion: 7, updatedAt: now },
      placements: [placement({ entryId: "entry-3" })],
      revisions: [
        revision(),
        revision({
          category: "document_text",
          clueFact: null,
          documentText: "A public letter.",
          entryId: "entry-2",
          title: "Letter",
        }),
        revision({
          category: "image_map",
          clueFact: null,
          entryId: "entry-3",
          imageCaption: "Old road",
          sourceArtifactAltText: "A map of the eastern road",
          sourceArtifactIdSnapshot: "artifact-1",
          sourceArtifactKind: "map",
          sourceArtifactMediaType: "image/png",
          sourceArtifactTitle: "Eastern road",
          title: "Road map",
        }),
        revision({
          approvedAt: now,
          approvedByLabelSnapshot: "Game Master",
          approvedByUserId: "gm",
          category: "recap",
          clueFact: null,
          entryId: "entry-4",
          recapText: "The party arrived.",
          title: "Recap",
        }),
      ],
    });

    const board = await service.getBoard(campaignId, "player");
    expect(board.catalogue.map((item) => item.category).sort()).toEqual([
      "clue_fact",
      "document_text",
      "image_map",
      "recap",
    ]);
    expect(board).toMatchObject({
      layout: { placements: [{ entryId: "entry-3" }], version: 7 },
      tombstones: [{ id: "entry-5", state: "Removed" }],
    });
    expect(JSON.stringify(board)).not.toMatch(/grant|unitKey|actorUserId|storageUrl/i);
  });

  it("derives viewer capabilities from exact user ownership rather than colliding labels", async () => {
    repositoryMock.loadBoard.mockResolvedValue({
      entries: [
        entry({ createdByUserId: "player-a", id: "entry-owned" }),
        entry({ createdByUserId: "player-b", id: "entry-other" }),
        entry({ category: "recap", createdByUserId: "gm", id: "entry-recap" }),
        entry({ id: "entry-removed", state: "retracted" }),
      ],
      layout: null,
      placements: [],
      revisions: [],
    });

    await expect(service.getViewerCapabilities(campaignId, "player-a")).resolves.toEqual({
      entries: [
        { canCorrect: false, canRemove: false, entryId: "entry-other" },
        { canCorrect: true, canRemove: true, entryId: "entry-owned" },
        { canCorrect: false, canRemove: false, entryId: "entry-recap" },
      ],
    });
    await expect(service.getViewerCapabilities(campaignId, "gm")).resolves.toEqual({
      entries: [
        { canCorrect: true, canRemove: true, entryId: "entry-other" },
        { canCorrect: true, canRemove: true, entryId: "entry-owned" },
        { canCorrect: true, canRemove: true, entryId: "entry-recap" },
      ],
    });
  });

  it("keeps Character-sensitive expansion explicit and fail-closed", async () => {
    await expect(
      service.getEntry({
        campaignId,
        entryId: "entry-1",
        userId: "player",
        viewerCharacterId: "character-1",
      }),
    ).resolves.toMatchObject({ restrictedDetails: [{ label: "Rumour" }] });
    await expect(
      service.getEntry({
        campaignId,
        entryId: "entry-1",
        userId: "gm",
        viewerCharacterId: "character-1",
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);

    repositoryMock.resolveViewerCharacter.mockResolvedValueOnce(null);
    await expect(
      service.getEntry({
        campaignId,
        entryId: "entry-1",
        userId: "player",
        viewerCharacterId: "invalid",
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);

    repositoryMock.loadEntry.mockResolvedValue({
      entry: entry({ state: "retracted" }),
      placement: placement(),
      revision: revision(),
    });
    await expect(
      service.getEntry({ campaignId, entryId: "entry-1", userId: "player" }),
    ).resolves.toMatchObject({ entry: { state: "Removed" } });
    await expect(
      service.getEntry({
        campaignId,
        entryId: "entry-1",
        userId: "player",
        viewerCharacterId: "character-1",
      }),
    ).rejects.toBeInstanceOf(BlackboardDetailUnavailableError);
  });

  it("projects public history and keeps retracted or absent history privacy-safe", async () => {
    repositoryMock.loadSafeHistory.mockResolvedValue({
      entry: entry({ entryVersion: 4 }),
      revisions: [revision(), revision({ changeKind: "correction", revisionNumber: 2 })],
    });
    await expect(service.getHistory(campaignId, "entry-1", "player")).resolves.toMatchObject({
      currentEntryVersion: 4,
      revisions: [{ revisionNumber: 1 }, { revisionNumber: 2 }],
    });

    repositoryMock.loadSafeHistory.mockResolvedValueOnce({
      entry: entry({ state: "retracted" }),
      revisions: [],
    });
    await expect(service.getHistory(campaignId, "entry-1", "player")).resolves.toMatchObject({
      entry: { state: "Removed" },
    });
    repositoryMock.loadSafeHistory.mockResolvedValueOnce(null);
    await expect(service.getHistory(campaignId, "entry-1", "player")).rejects.toBeInstanceOf(
      BlackboardReferenceUnavailableError,
    );
  });

  it("exposes full lineage and grant provenance only through the GM audit operation", async () => {
    repositoryMock.loadGmAudit.mockResolvedValue({
      entry: entry(),
      events: [
        {
          action: "initial",
          actorLabelSnapshot: "Game Master",
          actorUserId: "gm",
          entryVersion: 1,
          occurredAt: now,
          revisionNumber: 1,
        },
      ],
      grantEvents: [
        {
          actorLabelSnapshot: "Game Master",
          actorUserId: "gm",
          entryRevisionNumber: 1,
          occurredAt: now,
          resultState: "granted",
          streamVersion: 1,
          targetCharacterIdSnapshot: "character-1",
          targetCharacterLabelSnapshot: "Ari",
          unitKey: "unit-1",
          unitVersion: 1,
        },
      ],
      grants: [
        {
          currentEntryRevisionNumber: 1,
          liveCharacterId: "character-1",
          state: "granted",
          streamVersion: 1,
          targetCharacterIdSnapshot: "character-1",
          unitKey: "unit-1",
          unitVersion: 1,
        },
      ],
      lineages: [{ unitKey: "unit-1" }],
      memberships: [{ revisionNumber: 1, unitKey: "unit-1", unitVersion: 1 }],
      revisions: [revision()],
      sources: [],
      versions: [
        {
          createdAt: now,
          createdByLabelSnapshot: "Game Master",
          createdByUserId: "gm",
          detailText: "Restricted",
          labelSnapshot: "Secret",
          unitKey: "unit-1",
          unitVersion: 1,
        },
      ],
    });

    await expect(service.getAudit(campaignId, "entry-1", "gm")).resolves.toMatchObject({
      grantEvents: [{ targetCharacterLabel: "Ari" }],
      unitVersions: [{ detailText: "Restricted" }],
    });
    await expect(service.getAudit(campaignId, "entry-1", "player")).rejects.toBeInstanceOf(
      BlackboardReferenceUnavailableError,
    );
    repositoryMock.loadGmAudit.mockResolvedValueOnce(null);
    await expect(service.getAudit(campaignId, "missing", "gm")).rejects.toBeInstanceOf(
      BlackboardReferenceUnavailableError,
    );
  });

  it("validates and delegates catalogue, lifecycle, grant, and layout commands", async () => {
    await service.createEntry(campaignId, "player", {
      category: "clue_fact",
      fact: "Fact",
      title: "Clue",
    });
    await service.reviseEntry(campaignId, "entry-1", "player", {
      category: "clue_fact",
      changeKind: "correction",
      expectedEntryVersion: 1,
      fact: "Corrected fact",
      title: "Clue",
    });
    await service.retractEntry(campaignId, "entry-1", "player", { expectedEntryVersion: 2 });
    await service.archiveEntry(campaignId, "entry-1", "gm", {
      expectedEntryVersion: 3,
      expectedLayoutVersion: 1,
    });
    await service.changeGrant({
      campaignId,
      characterId: "character-1",
      entryId: "entry-1",
      rawInput: {
        action: "grant",
        expectedEntryVersion: 1,
        expectedGrantVersion: 0,
        unitVersion: 1,
      },
      unitKey: "unit-1",
      userId: "gm",
    });
    await service.createPlacement(campaignId, "player", {
      entryId: "entry-1",
      expectedLayoutVersion: 0,
      height: 240,
      layer: 1,
      width: 320,
      x: 0,
      y: 0,
    });
    await service.updatePlacement(campaignId, "entry-1", "player", {
      expectedLayoutVersion: 1,
      expectedRowVersion: 1,
      height: 260,
      layer: 2,
      width: 340,
      x: 10,
      y: 20,
    });
    await service.deletePlacement(campaignId, "entry-1", "player", {
      expectedLayoutVersion: 2,
      expectedRowVersion: 2,
    });
    await expect(
      service.groupPlacements(campaignId, "player", {
        entryIds: ["entry-1"],
        expectedLayoutVersion: 3,
        expectedRowVersions: { "entry-1": 2 },
      }),
    ).resolves.toMatchObject({ groupId: "group-1" });

    expect(repositoryMock.createEntry).toHaveBeenCalledOnce();
    expect(repositoryMock.reviseEntry).toHaveBeenCalledOnce();
    expect(repositoryMock.retractEntry).toHaveBeenCalledOnce();
    expect(repositoryMock.archiveEntry).toHaveBeenCalledOnce();
    expect(repositoryMock.changeGrant).toHaveBeenCalledOnce();
    expect(repositoryMock.createPlacement).toHaveBeenCalledOnce();
    expect(repositoryMock.updatePlacement).toHaveBeenCalledOnce();
    expect(repositoryMock.deletePlacement).toHaveBeenCalledOnce();
    expect(repositoryMock.groupPlacements).toHaveBeenCalledOnce();
  });

  it("fails closed for absent access, player recap/GM operations, and repository conflicts", async () => {
    await expect(service.getBoard(campaignId, "missing")).rejects.toBeInstanceOf(
      BlackboardUnavailableError,
    );
    campaignMock.listCampaignsByUserAccess.mockResolvedValueOnce([]);
    await expect(service.getBoard(campaignId, "player")).rejects.toBeInstanceOf(
      BlackboardUnavailableError,
    );
    await expect(
      service.createEntry(campaignId, "player", {
        category: "recap",
        recapText: "Player recap",
        title: "Recap",
      }),
    ).rejects.toBeInstanceOf(BlackboardReferenceUnavailableError);
    await expect(
      service.archiveEntry(campaignId, "entry-1", "player", {
        expectedEntryVersion: 2,
        expectedLayoutVersion: 0,
      }),
    ).rejects.toBeInstanceOf(BlackboardReferenceUnavailableError);

    repositoryMock.createEntry.mockRejectedValueOnce(
      new BlackboardRepositoryConflictError("retryable"),
    );
    await expect(
      service.createEntry(campaignId, "player", {
        category: "clue_fact",
        fact: "Fact",
        title: "Clue",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<BlackboardConflictError>>({ retryable: true }),
    );
  });
});
