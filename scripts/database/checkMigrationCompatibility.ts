import {
  assertDatabaseMigrationCompatibility,
  DatabaseMigrationCompatibilityError,
  formatMigrationCompatibilityDiagnostic,
} from "../../packages/database/src/migrationCompatibility";
import { migrationCompatibilityPrisma } from "../../packages/database/src/migrationCompatibilityClient";

async function main(): Promise<void> {
  try {
    const compatibility = await assertDatabaseMigrationCompatibility(migrationCompatibilityPrisma);
    console.log(formatMigrationCompatibilityDiagnostic(compatibility));
  } catch (error: unknown) {
    const message =
      error instanceof DatabaseMigrationCompatibilityError
        ? error.message
        : "Database migration compatibility check failed before history could be inspected.";
    console.error(message);
    process.exitCode = 1;
  } finally {
    try {
      await migrationCompatibilityPrisma.$disconnect();
    } catch {
      console.error("Database migration compatibility client did not close cleanly.");
      process.exitCode = 1;
    }
  }
}

void main();
