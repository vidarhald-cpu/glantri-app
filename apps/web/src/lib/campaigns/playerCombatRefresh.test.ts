import {
  encounterSessionSchema,
  type CombatHistoryProjection,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import { describe, expect, it, vi } from "vitest";

import {
  createPlayerCombatHistoryRequestCoordinator,
  createPlayerCombatRefreshRequestCoordinator,
  getPlayerCombatProjectionCacheKey,
  isMatchingPlayerCombatHistory,
  loadPlayerCombatSlowContext,
  pollPlayerCombatSnapshot,
  shouldAcceptPlayerCombatEncounter,
} from "./playerCombatRefresh";

function history(input: { encounterId: string; revision: string }): CombatHistoryProjection {
  return {
    activeRound: { events: [], observationRelationships: [], roundNumber: 1, snapshots: [] },
    archivedRounds: [],
    rows: [],
    sourceEncounterId: input.encounterId,
    sourceUpdatedAt: input.revision,
  };
}

function encounter(id: string, updatedAt: string): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    id,
    kind: "combat",
    participants: [],
    status: "active",
    title: "Test combat",
    updatedAt,
  });
}

describe("player combat refresh coordination", () => {
  it("adopts a newer encounter, participant context, and history only as one coherent revision", async () => {
    const nextEncounter = {
      ...encounter("encounter-1", "2026-01-01T00:02:00.000Z"),
      scenarioId: "scenario-1",
    };
    const loadRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision: nextEncounter.updatedAt,
      status: "active",
      updatedAt: nextEncounter.updatedAt,
    });
    const participants = [{ id: "participant-1" }] as unknown as ScenarioParticipant[];
    const projection = { scenario: { id: "scenario-1" } } as never;

    await expect(
      pollPlayerCombatSnapshot({
        acceptedRevision: "2026-01-01T00:01:00.000Z",
        encounterId: "encounter-1",
        loadEncounter: vi.fn().mockResolvedValue(nextEncounter),
        loadHistory: vi.fn().mockResolvedValue({
          history: history({ encounterId: "encounter-1", revision: nextEncounter.updatedAt }),
          identity: { encounterId: "encounter-1", revision: nextEncounter.updatedAt },
        }),
        loadParticipants: vi.fn().mockResolvedValue(participants),
        loadProjection: vi.fn().mockResolvedValue(projection),
        loadRevision,
      }),
    ).resolves.toEqual({
      encounter: nextEncounter,
      history: {
        history: history({ encounterId: "encounter-1", revision: nextEncounter.updatedAt }),
        identity: { encounterId: "encounter-1", revision: nextEncounter.updatedAt },
      },
      kind: "updated",
      participants,
      projection,
    });
    expect(loadRevision).toHaveBeenCalledTimes(2);
  });

  it("performs no context reload for an equivalent revision and rejects a mixed snapshot", async () => {
    const revision = "2026-01-01T00:02:00.000Z";
    const loadEncounter = vi.fn();
    const loadHistory = vi.fn();
    const loadParticipants = vi.fn();
    const projection = { scenario: { id: "scenario-1" } } as never;
    const loadProjection = vi.fn().mockResolvedValue(projection);
    const unchangedRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision,
      status: "active",
      updatedAt: revision,
    });
    await expect(
      pollPlayerCombatSnapshot({
        acceptedRevision: revision,
        acceptedProjectionKey: getPlayerCombatProjectionCacheKey(projection),
        encounterId: "encounter-1",
        loadEncounter,
        loadHistory,
        loadParticipants,
        loadProjection,
        loadRevision: unchangedRevision,
      }),
    ).resolves.toEqual({ kind: "unchanged", projection });
    expect(loadEncounter).not.toHaveBeenCalled();
    expect(loadHistory).not.toHaveBeenCalled();
    expect(loadParticipants).not.toHaveBeenCalled();
    expect(loadProjection).toHaveBeenCalledTimes(1);

    const nextEncounter = {
      ...encounter("encounter-1", "2026-01-01T00:03:00.000Z"),
      scenarioId: "scenario-1",
    };
    await expect(
      pollPlayerCombatSnapshot({
        acceptedRevision: revision,
        encounterId: "encounter-1",
        loadEncounter: vi.fn().mockResolvedValue(nextEncounter),
        loadHistory: vi.fn().mockResolvedValue({
          history: history({ encounterId: "encounter-1", revision }),
          identity: { encounterId: "encounter-1", revision },
        }),
        loadParticipants: vi.fn().mockResolvedValue([]),
        loadProjection: vi.fn().mockResolvedValue(projection),
        loadRevision: vi.fn().mockResolvedValue({
          encounterId: "encounter-1",
          revision: nextEncounter.updatedAt,
          status: "active",
          updatedAt: nextEncounter.updatedAt,
        }),
      }),
    ).resolves.toEqual({ kind: "stale" });
  });

  it("reloads a coherent player-safe snapshot when only Scenario visibility changes", async () => {
    const revision = "2026-01-01T00:02:00.000Z";
    const nextEncounter = {
      ...encounter("encounter-1", revision),
      scenarioId: "scenario-1",
    };
    const visibleProjection = {
      scenario: { id: "scenario-1" },
      visibleParticipants: [{ id: "participant-hidden-next" }],
    } as never;
    const restrictedProjection = {
      scenario: { id: "scenario-1" },
      visibleParticipants: [],
    } as never;
    const onProjectionChanged = vi.fn();
    const refreshedHistory = {
      history: history({ encounterId: "encounter-1", revision }),
      identity: { encounterId: "encounter-1", revision },
    };

    await expect(
      pollPlayerCombatSnapshot({
        acceptedProjectionKey: getPlayerCombatProjectionCacheKey(visibleProjection),
        acceptedRevision: revision,
        encounterId: "encounter-1",
        loadEncounter: vi.fn().mockResolvedValue(nextEncounter),
        loadHistory: vi.fn().mockResolvedValue(refreshedHistory),
        loadParticipants: vi.fn().mockResolvedValue([]),
        loadProjection: vi.fn().mockResolvedValue(restrictedProjection),
        loadRevision: vi.fn().mockResolvedValue({
          encounterId: "encounter-1",
          revision,
          status: "active",
          updatedAt: revision,
        }),
        onProjectionChanged,
      }),
    ).resolves.toEqual({
      encounter: nextEncounter,
      history: refreshedHistory,
      kind: "updated",
      participants: [],
      projection: restrictedProjection,
    });
    expect(onProjectionChanged).toHaveBeenCalledWith(restrictedProjection);
  });

  it("changes the projection cache identity when a visible participant is revoked", () => {
    const visible = {
      controlledParticipantId: "participant-a",
      scenario: { id: "scenario-1" },
      visibleParticipants: [
        { displayName: "Player A", id: "participant-a" },
        { displayName: "Hidden next poll", id: "participant-b" },
      ],
    };
    const restricted = {
      ...visible,
      visibleParticipants: [visible.visibleParticipants[0]],
    };

    expect(getPlayerCombatProjectionCacheKey(restricted as never)).not.toBe(
      getPlayerCombatProjectionCacheKey(visible as never),
    );
    expect(getPlayerCombatProjectionCacheKey(structuredClone(visible) as never)).toBe(
      getPlayerCombatProjectionCacheKey(visible as never),
    );
  });

  it("rejects delayed projection refreshes after a newer request or invalidation", () => {
    const coordinator = createPlayerCombatRefreshRequestCoordinator();
    const delayedVisibleResponse = coordinator.begin();
    const newerRestrictedResponse = coordinator.begin();

    expect(coordinator.isCurrent(delayedVisibleResponse)).toBe(false);
    expect(coordinator.isCurrent(newerRestrictedResponse)).toBe(true);

    coordinator.invalidate();
    expect(coordinator.isCurrent(newerRestrictedResponse)).toBe(false);
  });

  it("loads each slow-changing context source exactly once", async () => {
    const loadContent = vi.fn().mockResolvedValue({ version: 1 });
    const loadParticipants = vi.fn().mockResolvedValue([{ id: "participant-1" }]);
    const loadProjection = vi.fn().mockResolvedValue({ scenarioId: "scenario-1" });

    await expect(
      loadPlayerCombatSlowContext({
        loadContent,
        loadParticipants,
        loadProjection,
      }),
    ).resolves.toEqual({
      content: { version: 1 },
      participants: [{ id: "participant-1" }],
      projection: { scenarioId: "scenario-1" },
    });
    expect(loadContent).toHaveBeenCalledTimes(1);
    expect(loadParticipants).toHaveBeenCalledTimes(1);
    expect(loadProjection).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent and completed history requests for one revision", async () => {
    let resolveHistory!: (value: CombatHistoryProjection) => void;
    const loadHistory = vi.fn(
      () =>
        new Promise<CombatHistoryProjection>((resolve) => {
          resolveHistory = resolve;
        }),
    );
    const coordinator = createPlayerCombatHistoryRequestCoordinator({ loadHistory });
    const identity = {
      encounterId: "encounter-1",
      revision: "2026-01-01T00:01:00.000Z",
    };

    const first = coordinator.request(identity);
    const second = coordinator.request(identity);
    expect(loadHistory).toHaveBeenCalledTimes(1);

    resolveHistory(history(identity));
    const accepted = await first;
    await expect(second).resolves.toBe(accepted);
    await expect(coordinator.request(identity)).resolves.toBe(accepted);
    expect(loadHistory).toHaveBeenCalledTimes(1);
  });

  it("keeps GM perspectives independent and rejects mismatched history identity", async () => {
    const loadHistory = vi.fn(
      async (encounterId: string, options: { perspectiveParticipantId?: string }) =>
        history({
          encounterId,
          revision:
            options.perspectiveParticipantId === "participant-a" ? "revision-a" : "revision-b",
        }),
    );
    const coordinator = createPlayerCombatHistoryRequestCoordinator({ loadHistory });

    await coordinator.request({
      encounterId: "encounter-1",
      perspectiveParticipantId: "participant-a",
      revision: "revision-a",
    });
    await coordinator.request({
      encounterId: "encounter-1",
      perspectiveParticipantId: "participant-b",
      revision: "revision-b",
    });

    expect(loadHistory).toHaveBeenCalledTimes(2);
    await expect(
      coordinator.request({
        encounterId: "encounter-1",
        perspectiveParticipantId: "participant-a",
        revision: "wrong-revision",
      }),
    ).rejects.toThrow("did not match");
  });

  it("rejects older encounter responses and matches history by the full request identity", () => {
    const accepted = encounter("encounter-1", "2026-01-01T00:02:00.000Z");

    expect(
      shouldAcceptPlayerCombatEncounter({
        accepted,
        candidate: encounter("encounter-1", "2026-01-01T00:01:00.000Z"),
        expectedEncounterId: "encounter-1",
      }),
    ).toBe(false);
    expect(
      shouldAcceptPlayerCombatEncounter({
        accepted,
        candidate: encounter("encounter-2", "2026-01-01T00:03:00.000Z"),
        expectedEncounterId: "encounter-1",
      }),
    ).toBe(false);
    expect(
      isMatchingPlayerCombatHistory({
        candidate: {
          history: history({
            encounterId: "encounter-1",
            revision: accepted.updatedAt,
          }),
          identity: {
            encounterId: "encounter-1",
            perspectiveParticipantId: "participant-a",
            revision: accepted.updatedAt,
          },
        },
        identity: {
          encounterId: "encounter-1",
          perspectiveParticipantId: "participant-b",
          revision: accepted.updatedAt,
        },
      }),
    ).toBe(false);
  });
});
