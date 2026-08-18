import { describe, expect, it } from "vitest";

import {
  isCombatViewRevisionAtLeast,
  isCombatViewRevisionUnchanged,
  selectLatestCombatViewRevision,
} from "./combatViewRevision";

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

  it("does not let an older overlapping refresh replace the final mutation response", async () => {
    let accepted = { id: "encounter-1", updatedAt: "2026-07-20T12:00:00.000Z" };
    let resolveOlderRefresh!: (value: typeof accepted) => void;
    const olderRefresh = new Promise<typeof accepted>((resolve) => {
      resolveOlderRefresh = resolve;
    });
    const finalReviewResponse = Promise.resolve({
      id: "encounter-1",
      updatedAt: "2026-07-20T12:00:02.000Z",
    });
    const accept = (candidate: typeof accepted) => {
      accepted = selectLatestCombatViewRevision({ accepted, candidate });
    };

    const delayedAcceptance = olderRefresh.then(accept);
    accept(await finalReviewResponse);
    resolveOlderRefresh({ id: "encounter-1", updatedAt: "2026-07-20T12:00:01.000Z" });
    await delayedAcceptance;

    expect(accepted.updatedAt).toBe("2026-07-20T12:00:02.000Z");
  });
});
