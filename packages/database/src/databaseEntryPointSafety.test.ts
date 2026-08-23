import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(__dirname, "../../..");
const excludedDirectories = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "generated",
  "node_modules",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name) ? [] : sourceFiles(path);
    }

    return entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

describe("repository-owned Prisma client entry points", () => {
  it("keeps the complete direct-construction inventory behind the worktree runtime guard", () => {
    const entryPoints = sourceFiles(repositoryRoot)
      .filter((path) => /new\s+PrismaClient\s*\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(repositoryRoot, path))
      .sort();

    expect(entryPoints).toEqual([
      "packages/database/scripts/profileCombatPersistenceSplit.ts",
      "packages/database/src/client.ts",
      "packages/database/src/testing/scenarioPrivacy.ts",
      "packages/database/src/testing/testDatabase.ts",
    ]);

    for (const path of entryPoints) {
      expect(readFileSync(resolve(repositoryRoot, path), "utf8")).toContain(
        "assertWorktreeDatabaseRuntimeSafety",
      );
    }
  });

  it("keeps direct external database process entry points behind current ownership checks", () => {
    const entryPoints = sourceFiles(repositoryRoot)
      .filter((path) => /["'](?:pg_dump|psql)["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(repositoryRoot, path))
      .sort();

    expect(entryPoints).toEqual([
      "packages/database/scripts/backupLocalDb.ts",
      "scripts/database/worktreeDatabase.ts",
    ]);
    expect(readFileSync(resolve(repositoryRoot, entryPoints[0]!), "utf8")).toContain(
      "assertWorktreeDatabaseRuntimeSafety",
    );
    expect(readFileSync(resolve(repositoryRoot, entryPoints[1]!), "utf8")).toContain(
      "validateCurrentWorktreeTaskDatabaseEnvironment",
    );
  });
});
