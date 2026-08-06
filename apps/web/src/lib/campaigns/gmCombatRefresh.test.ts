import { describe, expect, it, vi } from "vitest";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { pollGmCombatSnapshot } from "./gmCombatRefresh";

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

const participant = { id: "participant-1", scenarioId: "scenario-1" } as ScenarioParticipant;

describe("GM combat snapshot polling", () => {
  it("does not load full combat state or participants for an identical revision", async () => {
    const loadEncounter = vi.fn();
    const loadParticipants = vi.fn();
    const loadRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision: "2026-01-01T00:05:00.000Z",
      status: "active",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });

    await expect(
      pollGmCombatSnapshot({
        acceptedRevision: "2026-01-01T00:05:00.000Z",
        encounterId: "encounter-1",
        loadEncounter,
        loadParticipants,
        loadRevision,
      }),
    ).resolves.toEqual({ kind: "unchanged" });
    expect(loadRevision).toHaveBeenCalledTimes(1);
    expect(loadEncounter).not.toHaveBeenCalled();
    expect(loadParticipants).not.toHaveBeenCalled();
  });

  it("adopts a newer encounter and participant context only after the revision is confirmed", async () => {
    const nextEncounter = encounter("2026-01-01T00:06:00.000Z");
    const loadEncounter = vi.fn().mockResolvedValue(nextEncounter);
    const loadParticipants = vi.fn().mockResolvedValue([participant]);
    const loadRevision = vi.fn().mockResolvedValue({
      encounterId: "encounter-1",
      revision: nextEncounter.updatedAt,
      status: "active",
      updatedAt: nextEncounter.updatedAt,
    });

    await expect(
      pollGmCombatSnapshot({
        acceptedRevision: "2026-01-01T00:05:00.000Z",
        encounterId: "encounter-1",
        loadEncounter,
        loadParticipants,
        loadRevision,
      }),
    ).resolves.toEqual({
      encounter: nextEncounter,
      kind: "updated",
      participants: [participant],
      revision: nextEncounter.updatedAt,
    });
    expect(loadRevision).toHaveBeenCalledTimes(2);
    expect(loadEncounter).toHaveBeenCalledTimes(1);
    expect(loadParticipants).toHaveBeenCalledWith("scenario-1");
  });

  it("rejects a mixed snapshot when another mutation lands during the related reads", async () => {
    const nextEncounter = encounter("2026-01-01T00:06:00.000Z");
    const loadRevision = vi
      .fn()
      .mockResolvedValueOnce({
        encounterId: "encounter-1",
        revision: nextEncounter.updatedAt,
        status: "active",
        updatedAt: nextEncounter.updatedAt,
      })
      .mockResolvedValueOnce({
        encounterId: "encounter-1",
        revision: "2026-01-01T00:07:00.000Z",
        status: "active",
        updatedAt: "2026-01-01T00:07:00.000Z",
      });

    await expect(
      pollGmCombatSnapshot({
        acceptedRevision: "2026-01-01T00:05:00.000Z",
        encounterId: "encounter-1",
        loadEncounter: vi.fn().mockResolvedValue(nextEncounter),
        loadParticipants: vi.fn().mockResolvedValue([participant]),
        loadRevision,
      }),
    ).resolves.toEqual({ kind: "stale" });
  });
});
