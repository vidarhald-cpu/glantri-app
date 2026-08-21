import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { knownDatabaseMigrations } from "./migrationManifest";

describe("embedded database migration manifest", () => {
  it("exactly matches the ordered Prisma migration files in this checkout", () => {
    const migrationsDirectory = resolve(__dirname, "../prisma/migrations");
    const migrations = readdirSync(migrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        checksum: createHash("sha256")
          .update(readFileSync(resolve(migrationsDirectory, entry.name, "migration.sql")))
          .digest("hex"),
        name: entry.name,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(knownDatabaseMigrations).toEqual(migrations);
  });
});
