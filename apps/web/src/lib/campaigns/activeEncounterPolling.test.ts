import { describe, expect, it, vi } from "vitest";

import type { EncounterSession } from "@glantri/domain";

import { pollActiveEncounterRevision } from "./activeEncounterPolling";

function encounter(updatedAt: string): EncounterSession {
  return {
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [],
    scenarioId: "scenario-1",
    status: "active",
    title: "Courtyard",
    turnOrderMode: "manual",
    updatedAt,
  };
}

describe("active encounter revision polling", () => {
  it("does not fetch the full encounter when the revision is unchanged", async () => {
    const loadEncounter = vi.fn();
    const loadRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision: "2026-01-01T00:05:00.000Z",
      status: "active",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    await expect(
      pollActiveEncounterRevision({
        acceptedRevision: "2026-01-01T00:05:00.000Z",
        encounterId: "encounter-1",
        loadEncounter,
        loadRevision,
      }),
    ).resolves.toEqual({ kind: "unchanged" });
    expect(loadRevision).toHaveBeenCalledTimes(1);
    expect(loadEncounter).not.toHaveBeenCalled();
  });

  it("fetches the exact full encounter once after a newer revision", async () => {
    const nextEncounter = encounter("2026-01-01T00:06:00.000Z");
    const loadEncounter = vi.fn().mockResolvedValue(nextEncounter);
    const loadRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision: nextEncounter.updatedAt,
      status: "active",
      updatedAt: nextEncounter.updatedAt,
    });
    const onNewerRevision = vi.fn();

    await expect(
      pollActiveEncounterRevision({
        acceptedRevision: "2026-01-01T00:05:00.000Z",
        encounterId: "encounter-1",
        loadEncounter,
        loadRevision,
        onNewerRevision,
      }),
    ).resolves.toEqual({
      encounter: nextEncounter,
      kind: "updated",
    });
    expect(loadRevision).toHaveBeenCalledTimes(1);
    expect(loadEncounter).toHaveBeenCalledTimes(1);
    expect(loadEncounter).toHaveBeenCalledWith("encounter-1");
    expect(onNewerRevision).toHaveBeenCalledTimes(1);
  });

  it("rejects stale or mismatched poll responses without replacing accepted state", async () => {
    const loadEncounter = vi
      .fn()
      .mockResolvedValue(encounter("2026-01-01T00:04:00.000Z"));
    const loadRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision: "2026-01-01T00:06:00.000Z",
      status: "active",
      updatedAt: "2026-01-01T00:06:00.000Z",
    });

    await expect(
      pollActiveEncounterRevision({
        acceptedRevision: "2026-01-01T00:05:00.000Z",
        encounterId: "encounter-1",
        loadEncounter,
        loadRevision,
      }),
    ).resolves.toEqual({ kind: "stale" });
  });
});
