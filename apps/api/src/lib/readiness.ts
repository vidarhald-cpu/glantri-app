import { inspectMigrationCompatibility, migrationCompatibilityPrisma } from "@glantri/database";

type QueryableDatabase = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

export type ReadinessResult =
  | {
      status: "ready";
    }
  | {
      status: "not_ready";
      reason: string;
    };

export async function checkReadiness(
  database: QueryableDatabase = migrationCompatibilityPrisma,
): Promise<ReadinessResult> {
  const compatibility = await inspectMigrationCompatibility(database);

  if (compatibility.classification === "database_unavailable") {
    return {
      status: "not_ready",
      reason: "database_unavailable",
    };
  }

  if (compatibility.classification === "migration_history_incomplete") {
    return {
      status: "not_ready",
      reason: "unresolved_migrations",
    };
  }

  if (!compatibility.safeToQuery) {
    return {
      status: "not_ready",
      reason: "database_incompatible",
    };
  }

  return { status: "ready" };
}
