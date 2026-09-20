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

type SchemaProbeRow = {
  has_migrations: boolean | null;
  has_session: boolean | null;
  has_user: boolean | null;
};

function notReady(reason: string): ReadinessResult {
  return {
    status: "not_ready",
    reason,
  };
}

/**
 * Readiness signal, not a deep health probe.
 *
 * Normal use depends on database-backed initialization: a configured and
 * reachable database, applied migration history, and the authentication tables
 * every session-bearing route needs. Reporting "ready" without those makes the
 * readiness signal lie while login and every DB-backed route is broken, so each
 * is covered by one small constant-cost query.
 */
export async function checkReadiness(
  database: QueryableDatabase = prisma,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ReadinessResult> {
  if (!environment.DATABASE_URL?.trim()) {
    return notReady("database_not_configured");
  }

  try {
    await database.$queryRaw`SELECT 1`;
  } catch {
    return notReady("database_unavailable");
  }

  let schema: SchemaProbeRow | undefined;

  try {
    const schemaRows = await database.$queryRaw<SchemaProbeRow[]>`
      SELECT
        to_regclass('"_prisma_migrations"') IS NOT NULL AS has_migrations,
        to_regclass('"User"') IS NOT NULL AS has_user,
        to_regclass('"Session"') IS NOT NULL AS has_session
    `;

    schema = schemaRows[0];
  } catch {
    return notReady("database_unavailable");
  }

  if (!schema?.has_migrations || !schema.has_user || !schema.has_session) {
    return notReady("schema_not_initialized");
  }

  try {
    const migrationRows = await database.$queryRaw<
      Array<{ unresolved_count: number | bigint | string }>
    >`
      SELECT COUNT(*)::int AS unresolved_count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    const unresolvedCount = Number(migrationRows[0]?.unresolved_count ?? 0);

    if (unresolvedCount > 0) {
      return notReady("unresolved_migrations");
    }
  } catch {
    return notReady("database_unavailable");
  }

  return { status: "ready" };
}
