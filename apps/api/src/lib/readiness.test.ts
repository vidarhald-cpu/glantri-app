import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./readiness";

function createDatabaseMock(results: unknown[]) {
  return {
    $queryRaw: vi.fn().mockImplementation(() => {
      const next = results.shift();

      if (next instanceof Error) {
        return Promise.reject(next);
      }

      return Promise.resolve(next);
    })
  };
}

describe("readiness checks", () => {
  it("returns ready when the database responds and migrations are resolved", async () => {
    const database = createDatabaseMock([1, [{ unresolved_count: 0 }]]);

    await expect(checkReadiness(database)).resolves.toEqual({ status: "ready" });
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("returns not ready when migrations are unresolved", async () => {
    const database = createDatabaseMock([1, [{ unresolved_count: 1 }]]);

    await expect(checkReadiness(database)).resolves.toEqual({
      status: "not_ready",
      reason: "unresolved_migrations"
    });
  });

  it("returns not ready when the database query fails", async () => {
    const database = createDatabaseMock([new Error("connection refused")]);

    await expect(checkReadiness(database)).resolves.toEqual({
      status: "not_ready",
      reason: "database_unavailable"
    });
  });
});
