import { describe, expect, it, vi } from "vitest";

import {
  assertDatabaseMigrationCompatibility,
  evaluateMigrationCompatibility,
  formatMigrationCompatibilityDiagnostic,
  inspectMigrationCompatibility,
  type AppliedMigrationRow,
  type KnownMigration,
} from "./migrationCompatibility";

const knownMigrations = [
  { name: "20260101000000_first", checksum: "a".repeat(64) },
  { name: "20260202000000_second", checksum: "b".repeat(64) },
  { name: "20260303000000_third", checksum: "c".repeat(64) },
] satisfies KnownMigration[];

function applied(
  migration: KnownMigration,
  overrides: Partial<AppliedMigrationRow> = {},
): AppliedMigrationRow {
  return {
    checksum: migration.checksum,
    finished_at: new Date("2026-01-01T00:00:00Z"),
    migration_name: migration.name,
    rolled_back_at: null,
    ...overrides,
  };
}

function createDatabaseMock(results: unknown[]) {
  const queries: string[] = [];
  const database = {
    $queryRaw: vi.fn().mockImplementation((query: TemplateStringsArray) => {
      queries.push(query.join("?"));
      const next = results.shift();

      if (next instanceof Error) {
        return Promise.reject(next);
      }

      return Promise.resolve(next);
    }),
  };

  return { database, queries };
}

describe("database migration compatibility", () => {
  it("accepts an equal migration history", () => {
    expect(
      evaluateMigrationCompatibility(
        knownMigrations,
        knownMigrations.map((migration) => applied(migration)),
      ),
    ).toMatchObject({
      classification: "equal",
      pendingMigrations: [],
      safeToQuery: true,
    });
  });

  it("accepts normal checkout-ahead pending migrations", () => {
    expect(
      evaluateMigrationCompatibility(knownMigrations, [applied(knownMigrations[0]!)]),
    ).toMatchObject({
      classification: "checkout_ahead",
      pendingMigrations: ["20260202000000_second", "20260303000000_third"],
      safeToQuery: true,
    });
  });

  it("fails closed when the database contains an unknown applied migration", () => {
    const unknown = {
      checksum: "d".repeat(64),
      name: "20260404000000_from_newer_checkout",
    };
    const result = evaluateMigrationCompatibility(knownMigrations, [
      ...knownMigrations.map((migration) => applied(migration)),
      applied(unknown),
    ]);

    expect(result).toMatchObject({
      classification: "database_ahead",
      safeToQuery: false,
      unknownAppliedMigrations: [unknown],
    });
  });

  it("fails closed when an applied checksum differs from the checkout", () => {
    const result = evaluateMigrationCompatibility(knownMigrations, [
      applied(knownMigrations[0]!, { checksum: "f".repeat(64) }),
    ]);

    expect(result).toMatchObject({
      checksumMismatches: [
        {
          appliedChecksum: "f".repeat(64),
          expectedChecksum: "a".repeat(64),
          name: "20260101000000_first",
        },
      ],
      classification: "checksum_mismatch",
      safeToQuery: false,
    });
  });

  it("fails closed for unfinished or non-prefix migration history", () => {
    expect(
      evaluateMigrationCompatibility(knownMigrations, [
        applied(knownMigrations[0]!, { finished_at: null }),
      ]),
    ).toMatchObject({
      classification: "migration_history_incomplete",
      safeToQuery: false,
    });
    expect(
      evaluateMigrationCompatibility(knownMigrations, [applied(knownMigrations[1]!)]),
    ).toMatchObject({
      classification: "migration_history_diverged",
      divergentAppliedMigrations: ["20260202000000_second"],
      safeToQuery: false,
    });
  });

  it("treats a database without migration history as checkout ahead", async () => {
    const { database, queries } = createDatabaseMock([[{ migration_table_exists: false }]]);

    await expect(inspectMigrationCompatibility(database, knownMigrations)).resolves.toMatchObject({
      classification: "checkout_ahead",
      pendingMigrations: knownMigrations.map((migration) => migration.name),
      safeToQuery: true,
    });
    expect(database.$queryRaw).toHaveBeenCalledTimes(1);
    expect(queries.join("\n")).not.toMatch(/\b(?:ALTER|DELETE|DROP|INSERT|TRUNCATE|UPDATE)\b/i);
  });

  it("uses only read queries and refuses ordinary work before an unsafe domain query", async () => {
    const unknownName = "20260404000000_from_newer_checkout";
    const { database, queries } = createDatabaseMock([
      [{ migration_table_exists: true }],
      [applied(knownMigrations[0]!), applied({ name: unknownName, checksum: "d".repeat(64) })],
    ]);
    const domainQuery = vi.fn();

    await expect(
      (async () => {
        await assertDatabaseMigrationCompatibility(database, knownMigrations);
        await domainQuery();
      })(),
    ).rejects.toMatchObject({
      compatibility: { classification: "database_ahead" },
    });
    expect(domainQuery).not.toHaveBeenCalled();
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
    expect(queries.join("\n")).not.toMatch(/\b(?:ALTER|DELETE|DROP|INSERT|TRUNCATE|UPDATE)\b/i);
  });

  it("never includes connection failures or unsafe raw database detail in diagnostics", async () => {
    const secret = "postgresql://private-user:private-password@localhost:5432/glantri";
    const { database } = createDatabaseMock([new Error(secret)]);
    const unavailable = await inspectMigrationCompatibility(database, knownMigrations);
    const unavailableDiagnostic = formatMigrationCompatibilityDiagnostic(unavailable);
    const unsafeNames = evaluateMigrationCompatibility(knownMigrations, [
      applied({ name: `bad-name-${secret}`, checksum: secret }),
    ]);
    const unsafeDiagnostic = formatMigrationCompatibilityDiagnostic(unsafeNames);

    expect(unavailable).toMatchObject({
      classification: "database_unavailable",
      safeToQuery: false,
    });
    expect(unavailableDiagnostic).not.toContain("private");
    expect(unavailableDiagnostic).not.toContain("postgresql://");
    expect(unsafeDiagnostic).toContain("[invalid-migration-identifier]");
    expect(unsafeDiagnostic).toContain("[invalid-checksum]");
    expect(unsafeDiagnostic).not.toContain("private");
    expect(unsafeDiagnostic).not.toContain("postgresql://");
  });
});
