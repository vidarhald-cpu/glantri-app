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
function createFailingPrismaStub(failures: number, message: string) {
  const state = { attempts: 0 };
  const model = {
    deleteMany: async () => {},
    updateMany: async () => {},
  };
  const firstModel = {
    deleteMany: async () => {
      if (state.attempts <= failures) {
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

  it("does not retry or log for an unrelated reset failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub, state } = createFailingPrismaStub(1, 'relation "Character" does not exist');

    await expect(resetTestDatabase(stub)).rejects.toThrow(/does not exist/);

    expect(state.attempts).toBe(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
