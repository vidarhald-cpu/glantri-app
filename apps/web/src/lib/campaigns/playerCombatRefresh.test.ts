import {
  encounterSessionSchema,
  type CombatHistoryProjection,
  type EncounterSession,
} from "@glantri/domain";
import { describe, expect, it, vi } from "vitest";

import {
  createPlayerCombatHistoryRequestCoordinator,
  isMatchingPlayerCombatHistory,
  loadPlayerCombatSlowContext,
  shouldAcceptPlayerCombatEncounter,
} from "./playerCombatRefresh";

function history(input: {
  encounterId: string;
  revision: string;
}): CombatHistoryProjection {
  return {
    activeRound: { events: [], roundNumber: 1, snapshots: [] },
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
            options.perspectiveParticipantId === "participant-a"
              ? "revision-a"
              : "revision-b",
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
