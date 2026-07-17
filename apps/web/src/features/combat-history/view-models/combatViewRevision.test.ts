import { describe, expect, it } from "vitest";

import { isCombatViewRevisionAtLeast, isCombatViewRevisionUnchanged } from "./combatViewRevision";

describe("combat view revision acceptance", () => {
  it("rejects a delayed encounter or history response older than the accepted mutation", () => {
    expect(
      isCombatViewRevisionAtLeast({
        acceptedUpdatedAt: "2026-07-16T12:00:02.000Z",
        candidateUpdatedAt: "2026-07-16T12:00:01.000Z",
      }),
    ).toBe(false);
  });

  it("accepts newer revisions and identifies identical polling responses", () => {
    expect(
      isCombatViewRevisionAtLeast({
        acceptedUpdatedAt: "2026-07-16T12:00:01.000Z",
        candidateUpdatedAt: "2026-07-16T12:00:02.000Z",
      }),
    ).toBe(true);
    expect(
      isCombatViewRevisionUnchanged({
        acceptedUpdatedAt: "2026-07-16T12:00:02.000Z",
        candidateUpdatedAt: "2026-07-16T12:00:02.000Z",
      }),
    ).toBe(true);
    expect(
      isCombatViewRevisionUnchanged({
        acceptedUpdatedAt: "2026-07-16T12:00:01.000Z",
        candidateUpdatedAt: "2026-07-16T12:00:02.000Z",
      }),
    ).toBe(false);
  });
});
