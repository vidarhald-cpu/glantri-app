import { PrismaClient } from "@prisma/client";

import { assertWorktreeDatabaseRuntimeSafety } from "./worktreeDatabaseRuntimeSafety";

assertWorktreeDatabaseRuntimeSafety();

const globalForMigrationCompatibility = globalThis as unknown as {
  migrationCompatibilityPrisma?: PrismaClient;
};

export const migrationCompatibilityPrisma =
  globalForMigrationCompatibility.migrationCompatibilityPrisma ?? new PrismaClient({ log: [] });

if (process.env.NODE_ENV !== "production") {
  globalForMigrationCompatibility.migrationCompatibilityPrisma = migrationCompatibilityPrisma;
}
