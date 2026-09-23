import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetTestDatabase } from "./testDatabase";

// `resetTestDatabase` contains the containment for issue #296: an abandoned test's straggler
// transaction can deadlock the next test's reset. The containment is only worth having if it is
// observable and bounded, so these tests pin all three required properties — it logs loudly, it
// stops retrying, and it fails naming the deadlock — without needing a real lock cycle.

const LOCK_CONFLICT_MESSAGE =
  "Error occurred during query execution: ConnectorError(ConnectorError { kind: " +
  'QueryError(PostgresError { code: "40P01", message: "deadlock detected" }) })';

/**
 * A stand-in for PrismaClient whose first model rejects on the first `failures` reset attempts.
 * `resetTestDatabase` always starts an attempt at `equipmentTransitionEvent`, so accesses of that
 * model count the attempts the helper actually made.
 */
function createFailingPrismaStub(failures: number, message: string, onAttempt?: () => void) {
  const state = { attempts: 0 };
  const model = {
    deleteMany: async () => {},
    updateMany: async () => {},
  };
  const firstModel = {
    deleteMany: async () => {
      if (state.attempts <= failures) {
        onAttempt?.();

        throw new Error(message);
      }
    },
    updateMany: async () => {},
  };

  const stub = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "equipmentTransitionEvent") {
          state.attempts += 1;

          return firstModel;
        }

        return model;
      },
    },
  ) as unknown as PrismaClient;

  return { stub, state };
}

describe("resetTestDatabase lock-conflict containment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs every deadlock retry loudly and then succeeds", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub, state } = createFailingPrismaStub(2, LOCK_CONFLICT_MESSAGE);

    await resetTestDatabase(stub);

    expect(state.attempts).toBe(3);
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls[0]?.[0]).toContain("[resetTestDatabase] DEADLOCK RETRY 1/4");
    expect(consoleError.mock.calls[1]?.[0]).toContain("[resetTestDatabase] DEADLOCK RETRY 2/4");
    expect(consoleError.mock.calls[0]?.[0]).toContain("40P01");
  });

  it("bounds the retries and fails naming the deadlock once they are exhausted", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub, state } = createFailingPrismaStub(
      Number.POSITIVE_INFINITY,
      LOCK_CONFLICT_MESSAGE,
    );

    await expect(resetTestDatabase(stub)).rejects.toThrow(
      /PostgreSQL lock conflict \(40P01\) persisted across all 5 reset attempts/,
    );

    // Bounded: five attempts total, four logged retries, and no further attempt after that.
    expect(state.attempts).toBe(5);
    expect(consoleError).toHaveBeenCalledTimes(4);
  }, 15_000);

  it("retries serialization failures reported as 40001", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub } = createFailingPrismaStub(
      1,
      "Raw query failed. Code: `40001`. Message: `could not serialize access due to concurrent update`",
    );

    await resetTestDatabase(stub);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain("40001");
  });

  it("stops early, still naming the deadlock, once the elapsed budget cannot fit another attempt", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      // A slow host, where each deadlocked attempt costs 2000ms rather than the ~1045ms
      // measured locally. The attempt bound alone would spend well past the 10s hook timeout,
      // so the elapsed budget must cut in first and the failure must still name the deadlock.
      const { stub, state } = createFailingPrismaStub(
        Number.POSITIVE_INFINITY,
        LOCK_CONFLICT_MESSAGE,
        () => {
          vi.advanceTimersByTime(2_000);
        },
      );

      await expect(resetTestDatabase(stub)).rejects.toThrow(
        /PostgreSQL lock conflict \(40P01\) persisted for \d+ms .* can no longer fit another attempt/s,
      );

      expect(state.attempts).toBeLessThan(5);
      expect(consoleError.mock.calls.length).toBe(state.attempts - 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not treat a message that merely contains the digits 40001 as a lock conflict", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // A bare substring test classified this as a PostgreSQL serialization failure, retried it
    // five times and mislabelled the failure. Only the delimited SQLSTATE form counts.
    const { stub, state } = createFailingPrismaStub(
      1,
      "Invalid `prisma.character.delete()` invocation: record clx40001abc not found",
    );

    await expect(resetTestDatabase(stub)).rejects.toThrow(/clx40001abc not found/);

    expect(state.attempts).toBe(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not retry or log for an unrelated reset failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub, state } = createFailingPrismaStub(1, 'relation "Character" does not exist');

    await expect(resetTestDatabase(stub)).rejects.toThrow(/does not exist/);

    expect(state.attempts).toBe(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
