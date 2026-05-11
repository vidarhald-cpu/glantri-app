import { prisma } from "@glantri/database";

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

export async function checkReadiness(database: QueryableDatabase = prisma): Promise<ReadinessResult> {
  try {
    await database.$queryRaw`SELECT 1`;

    const migrationRows = await database.$queryRaw<Array<{ unresolved_count: number | bigint | string }>>`
      SELECT COUNT(*)::int AS unresolved_count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    const unresolvedCount = Number(migrationRows[0]?.unresolved_count ?? 0);

    if (unresolvedCount > 0) {
      return {
        status: "not_ready",
        reason: "unresolved_migrations"
      };
    }

    return { status: "ready" };
  } catch {
    return {
      status: "not_ready",
      reason: "database_unavailable"
    };
  }
}
