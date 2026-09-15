import { encounterSessionSchema } from "@glantri/domain";
import { assignRoleplaySkillRoll } from "@glantri/rules-engine";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateEncounterOnServer } from "./encounterClient";

const original = encounterSessionSchema.parse({
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "encounter-revision-test",
  kind: "roleplay",
  participants: [],
  status: "active",
  title: "Search revision",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("encounter update revision serialization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends the original revision after a Skill assignment changes the local timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:01:00.000Z"));
    const next = assignRoleplaySkillRoll({
      difficulty: "medium",
      participantId: "player-1",
      session: original,
      silent: false,
      skillId: "search",
      skillLabel: "Search",
      skillValue: 12,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ encounter: next }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateEncounterOnServer({
      encounterId: original.id,
      expectedRevision: original.updatedAt,
      session: next,
    });

    expect(next.updatedAt).not.toBe(original.updatedAt);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expectedRevision: original.updatedAt,
      session: next,
    });
    expect(next.roleplayState?.pendingSkillRolls[0]?.skillId).toBe("search");
  });

  it("preserves the legacy body when no explicit revision was supplied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ encounter: original }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await updateEncounterOnServer({ encounterId: original.id, session: original });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ session: original });
  });

  it("propagates a stale revision conflict without retrying or replacing the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Encounter revision changed." }), { status: 409 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      updateEncounterOnServer({
        encounterId: original.id,
        expectedRevision: original.updatedAt,
        session: original,
      }),
    ).rejects.toThrow("Encounter revision changed.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).expectedRevision).toBe(original.updatedAt);
  });
});
