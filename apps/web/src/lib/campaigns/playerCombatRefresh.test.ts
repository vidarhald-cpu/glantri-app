import {
  encounterSessionSchema,
  type CombatHistoryProjection,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import { describe, expect, it, vi } from "vitest";

import {
  adoptCoherentPlayerCombatSnapshot,
  createPlayerCombatHistoryRequestCoordinator,
  createPlayerCombatRefreshRequestCoordinator,
  getPlayerCombatProjectionCacheKey,
  isMatchingPlayerCombatHistory,
  isPlayerCombatHistoryRevisionMismatch,
  loadPlayerCombatSlowContext,
  pollPlayerCombatSnapshot,
  shouldAcceptPlayerCombatEncounter,
  PLAYER_COMBAT_SNAPSHOT_RETRY_DELAYS_MS,
  type PlayerCombatSnapshotPollResult,
} from "./playerCombatRefresh";

function history(input: {
  currentConsequences?: CombatHistoryProjection["currentConsequences"];
  encounterId: string;
  revision: string;
}): CombatHistoryProjection {
  return {
    activeRound: { events: [], observationRelationships: [], roundNumber: 1, snapshots: [] },
    archivedRounds: [],
    currentConsequences: input.currentConsequences ?? [],
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
    const currentConsequences = [
      {
        summary: "Bleed 5/10 HP per round",
      },
    ];

    await expect(
      pollPlayerCombatSnapshot({
        acceptedRevision: "2026-01-01T00:01:00.000Z",
        encounterId: "encounter-1",
        loadEncounter: vi.fn().mockResolvedValue(nextEncounter),
        loadHistory: vi.fn().mockResolvedValue({
          history: history({
            currentConsequences,
            encounterId: "encounter-1",
            revision: nextEncounter.updatedAt,
          }),
          identity: { encounterId: "encounter-1", revision: nextEncounter.updatedAt },
        }),
        loadParticipants: vi.fn().mockResolvedValue(participants),
        loadProjection: vi.fn().mockResolvedValue(projection),
        loadRevision,
      }),
    ).resolves.toEqual({
      encounter: nextEncounter,
      history: {
        history: history({
          currentConsequences,
          encounterId: "encounter-1",
          revision: nextEncounter.updatedAt,
        }),
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
          history: history({
            currentConsequences: [
              {
                summary: "Stale consequence must not be adopted",
              },
            ],
            encounterId: "encounter-1",
            revision,
          }),
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

  /**
   * Forgejo #1011 — the mount-time revision race.
   *
   * The cases below pin the two sentences the investigation found unpinned, and the schedule's
   * relation to the writer it exists to survive. Neither sentence had an assertion anywhere in the
   * repository before this.
   */
  describe("mount-time revision race (#1011)", () => {
    const RACED_ENCOUNTER = {
      ...encounter("encounter-1", "2026-01-01T00:02:00.000Z"),
      scenarioId: "scenario-1",
    };

    function racedPoll(input: {
      loadHistory: (candidate: EncounterSession) => Promise<never> | Promise<unknown>;
    }) {
      return pollPlayerCombatSnapshot({
        encounterId: "encounter-1",
        loadEncounter: async () => RACED_ENCOUNTER,
        loadHistory: input.loadHistory as never,
        loadParticipants: async () => [],
        loadProjection: async () => ({ scenario: { id: "scenario-1" } }) as never,
        loadRevision: async () => ({
          encounterId: "encounter-1",
          revision: RACED_ENCOUNTER.updatedAt,
          status: "active",
          updatedAt: RACED_ENCOUNTER.updatedAt,
        }),
      });
    }

    it("routes a history revision mismatch into the retryable stale path instead of rejecting", async () => {
      // The real coordinator, so the rejection under test is the product's own, not a stand-in.
      const coordinator = createPlayerCombatHistoryRequestCoordinator({
        loadHistory: async (encounterId) =>
          history({ encounterId, revision: "2026-01-01T00:03:00.000Z" }),
      });

      await expect(
        racedPoll({
          loadHistory: (candidate) =>
            coordinator.request({
              encounterId: candidate.id,
              revision: candidate.updatedAt,
            }) as never,
        }),
      ).resolves.toEqual({ kind: "stale" });
    });

    it("keeps the coordinator's own rejection typed and worded as it was", async () => {
      const coordinator = createPlayerCombatHistoryRequestCoordinator({
        loadHistory: async (encounterId) =>
          history({ encounterId, revision: "2026-01-01T00:03:00.000Z" }),
      });
      const caught = await coordinator
        .request({ encounterId: "encounter-1", revision: "2026-01-01T00:02:00.000Z" })
        .then(
          () => undefined,
          (error: unknown) => error,
        );

      expect(isPlayerCombatHistoryRevisionMismatch(caught)).toBe(true);
      expect((caught as Error).message).toBe(
        "Combat history did not match the accepted encounter revision.",
      );
    });

    it("still rejects a history failure that is not a revision race", async () => {
      await expect(
        racedPoll({
          loadHistory: async () => {
            throw new Error("Encounter not found.");
          },
        }),
      ).rejects.toThrow("Encounter not found.");
    });

    const coherent = {
      encounter: RACED_ENCOUNTER,
      history: {
        history: history({ encounterId: "encounter-1", revision: RACED_ENCOUNTER.updatedAt }),
        identity: { encounterId: "encounter-1", revision: RACED_ENCOUNTER.updatedAt },
      },
      kind: "updated",
      participants: [],
      projection: { scenario: { id: "scenario-1" } },
    } as unknown as PlayerCombatSnapshotPollResult;

    it("retries a revision race and adopts the first coherent attempt", async () => {
      const results: PlayerCombatSnapshotPollResult[] = [
        { kind: "stale" },
        { kind: "stale" },
        coherent,
      ];
      const loadSnapshot = vi.fn(async () => results.shift() ?? { kind: "stale" as const });
      const slept: number[] = [];

      await expect(
        adoptCoherentPlayerCombatSnapshot({
          loadSnapshot,
          sleep: async (ms) => {
            slept.push(ms);
          },
        }),
      ).resolves.toBe(coherent);
      expect(loadSnapshot).toHaveBeenCalledTimes(3);
      expect(slept).toEqual([150, 300]);
    });

    /**
     * The number this schedule answers to. The GM's autonomous round advance held a chain of
     * writes open for 1233 ms (#1004 comment 22644), and an immediate single retry with no
     * backoff is what that chain defeated. A schedule whose total span fell back under the
     * measured writer would restore the defect while still looking like a retry.
     */
    it("spans more than the measured 1233 ms GM write chain", () => {
      const totalBackoffMs = PLAYER_COMBAT_SNAPSHOT_RETRY_DELAYS_MS.reduce(
        (total, delay) => total + delay,
        0,
      );

      expect(PLAYER_COMBAT_SNAPSHOT_RETRY_DELAYS_MS.length).toBeGreaterThan(1);
      expect(totalBackoffMs).toBeGreaterThan(1_233);
    });

    it("gives up with one named sentence only after the whole schedule is spent", async () => {
      const loadSnapshot = vi.fn(async () => ({ kind: "stale" }) as PlayerCombatSnapshotPollResult);

      await expect(
        adoptCoherentPlayerCombatSnapshot({ loadSnapshot, sleep: async () => {} }),
      ).rejects.toThrow("Unable to adopt one coherent player combat revision.");
      expect(loadSnapshot).toHaveBeenCalledTimes(PLAYER_COMBAT_SNAPSHOT_RETRY_DELAYS_MS.length + 1);
    });

    it("stops retrying as soon as the mount is abandoned", async () => {
      const loadSnapshot = vi.fn(async () => ({ kind: "stale" }) as PlayerCombatSnapshotPollResult);

      await expect(
        adoptCoherentPlayerCombatSnapshot({
          isAbandoned: () => true,
          loadSnapshot,
          sleep: async () => {},
        }),
      ).rejects.toThrow("Unable to adopt one coherent player combat revision.");
      expect(loadSnapshot).toHaveBeenCalledTimes(1);
    });

    it("does not retry a rejection, so a refusal still reaches the surface at once", async () => {
      const loadSnapshot = vi.fn(async () => {
        throw new Error("Encounter not found.");
      });

      await expect(
        adoptCoherentPlayerCombatSnapshot({ loadSnapshot, sleep: async () => {} }),
      ).rejects.toThrow("Encounter not found.");
      expect(loadSnapshot).toHaveBeenCalledTimes(1);
    });
  });
});
