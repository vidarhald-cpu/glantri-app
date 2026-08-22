import { knownDatabaseMigrations } from "./migrationManifest";

export interface KnownMigration {
  checksum: string;
  name: string;
}

export interface AppliedMigrationRow {
  checksum: string;
  finished_at: Date | string | null;
  migration_name: string;
  rolled_back_at: Date | string | null;
}

export interface QueryableMigrationDatabase {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}

export type MigrationCompatibilityClassification =
  | "equal"
  | "checkout_ahead"
  | "database_ahead"
  | "checksum_mismatch"
  | "migration_history_incomplete"
  | "migration_history_diverged"
  | "database_unavailable";

export interface MigrationFingerprint {
  checksum: string;
  name: string;
}

export interface MigrationChecksumMismatch {
  appliedChecksum: string;
  expectedChecksum: string;
  name: string;
}

export interface MigrationCompatibilityResult {
  appliedMigrationCount: number;
  checksumMismatches: MigrationChecksumMismatch[];
  classification: MigrationCompatibilityClassification;
  divergentAppliedMigrations: string[];
  incompleteMigrations: string[];
  knownMigrationCount: number;
  pendingMigrations: string[];
  safeToQuery: boolean;
  unknownAppliedMigrations: MigrationFingerprint[];
}

const SAFE_MIGRATION_IDENTIFIER = /^[A-Za-z0-9_-]+$/;
const SAFE_CHECKSUM = /^[a-f0-9]{64}$/;

function emptyResult(
  classification: MigrationCompatibilityClassification,
  knownMigrationCount: number,
): MigrationCompatibilityResult {
  return {
    appliedMigrationCount: 0,
    checksumMismatches: [],
    classification,
    divergentAppliedMigrations: [],
    incompleteMigrations: [],
    knownMigrationCount,
    pendingMigrations: [],
    safeToQuery: false,
    unknownAppliedMigrations: [],
  };
}

export function evaluateMigrationCompatibility(
  knownMigrations: readonly KnownMigration[],
  history: readonly AppliedMigrationRow[],
): MigrationCompatibilityResult {
  const knownByName = new Map(knownMigrations.map((migration) => [migration.name, migration]));
  const incompleteMigrations = history
    .filter((migration) => migration.finished_at === null && migration.rolled_back_at === null)
    .map((migration) => migration.migration_name);
  const appliedMigrations = history.filter(
    (migration) => migration.finished_at !== null && migration.rolled_back_at === null,
  );
  const appliedByName = new Map<string, AppliedMigrationRow>();
  const duplicateAppliedMigrations: string[] = [];

  for (const migration of appliedMigrations) {
    if (appliedByName.has(migration.migration_name)) {
      duplicateAppliedMigrations.push(migration.migration_name);
    } else {
      appliedByName.set(migration.migration_name, migration);
    }
  }

  const unknownAppliedMigrations = appliedMigrations
    .filter((migration) => !knownByName.has(migration.migration_name))
    .map((migration) => ({
      checksum: migration.checksum,
      name: migration.migration_name,
    }));
  const checksumMismatches = appliedMigrations.flatMap((migration) => {
    const known = knownByName.get(migration.migration_name);

    if (!known || known.checksum === migration.checksum) {
      return [];
    }

    return [
      {
        appliedChecksum: migration.checksum,
        expectedChecksum: known.checksum,
        name: migration.migration_name,
      },
    ];
  });
  const pendingMigrations = knownMigrations
    .filter((migration) => !appliedByName.has(migration.name))
    .map((migration) => migration.name);
  const firstPendingIndex = knownMigrations.findIndex(
    (migration) => !appliedByName.has(migration.name),
  );
  const outOfSequenceMigrations =
    firstPendingIndex < 0
      ? []
      : knownMigrations
          .slice(firstPendingIndex + 1)
          .filter((migration) => appliedByName.has(migration.name))
          .map((migration) => migration.name);
  const divergentAppliedMigrations = [
    ...new Set([...duplicateAppliedMigrations, ...outOfSequenceMigrations]),
  ];

  const base: MigrationCompatibilityResult = {
    appliedMigrationCount: appliedMigrations.length,
    checksumMismatches,
    classification: "equal",
    divergentAppliedMigrations,
    incompleteMigrations,
    knownMigrationCount: knownMigrations.length,
    pendingMigrations,
    safeToQuery: true,
    unknownAppliedMigrations,
  };

  if (incompleteMigrations.length > 0) {
    return { ...base, classification: "migration_history_incomplete", safeToQuery: false };
  }

  if (unknownAppliedMigrations.length > 0) {
    return { ...base, classification: "database_ahead", safeToQuery: false };
  }

  if (checksumMismatches.length > 0) {
    return { ...base, classification: "checksum_mismatch", safeToQuery: false };
  }

  if (divergentAppliedMigrations.length > 0) {
    return { ...base, classification: "migration_history_diverged", safeToQuery: false };
  }

  if (pendingMigrations.length > 0) {
    return { ...base, classification: "checkout_ahead" };
  }

  return base;
}

export async function inspectMigrationCompatibility(
  database: QueryableMigrationDatabase,
  knownMigrations: readonly KnownMigration[] = knownDatabaseMigrations,
): Promise<MigrationCompatibilityResult> {
  try {
    const tableRows = await database.$queryRaw<Array<{ migration_table_exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_tables
        WHERE schemaname = current_schema()
          AND tablename = '_prisma_migrations'
      ) AS migration_table_exists
    `;

    if (!tableRows[0]?.migration_table_exists) {
      return evaluateMigrationCompatibility(knownMigrations, []);
    }

    const history = await database.$queryRaw<AppliedMigrationRow[]>`
      SELECT migration_name, checksum, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at, migration_name
    `;

    return evaluateMigrationCompatibility(knownMigrations, history);
  } catch {
    return emptyResult("database_unavailable", knownMigrations.length);
  }
}

function safeMigrationIdentifier(name: string): string {
  return SAFE_MIGRATION_IDENTIFIER.test(name) ? name : "[invalid-migration-identifier]";
}

function safeChecksum(checksum: string): string {
  return SAFE_CHECKSUM.test(checksum) ? checksum : "[invalid-checksum]";
}

function formatFingerprints(fingerprints: readonly MigrationFingerprint[]): string {
  return fingerprints
    .map(
      (migration) =>
        `${safeMigrationIdentifier(migration.name)} checksum=${safeChecksum(migration.checksum)}`,
    )
    .join(", ");
}

function formatIdentifiers(identifiers: readonly string[]): string {
  return identifiers.map(safeMigrationIdentifier).join(", ");
}

export function formatMigrationCompatibilityDiagnostic(
  result: MigrationCompatibilityResult,
): string {
  const summary = `Database migration compatibility: ${result.classification} (applied=${result.appliedMigrationCount} known=${result.knownMigrationCount})`;

  switch (result.classification) {
    case "checkout_ahead":
      return `${summary}; pending=${formatIdentifiers(result.pendingMigrations)}`;
    case "database_ahead":
      return `${summary}; unknown-applied=${formatFingerprints(result.unknownAppliedMigrations)}`;
    case "checksum_mismatch":
      return `${summary}; mismatches=${result.checksumMismatches
        .map(
          (mismatch) =>
            `${safeMigrationIdentifier(mismatch.name)} expected=${safeChecksum(mismatch.expectedChecksum)} applied=${safeChecksum(mismatch.appliedChecksum)}`,
        )
        .join(", ")}`;
    case "migration_history_incomplete":
      return `${summary}; incomplete=${formatIdentifiers(result.incompleteMigrations)}`;
    case "migration_history_diverged":
      return `${summary}; divergent=${formatIdentifiers(result.divergentAppliedMigrations)}`;
    case "database_unavailable":
      return `${summary}; migration history could not be inspected`;
    case "equal":
      return summary;
  }
}

export class DatabaseMigrationCompatibilityError extends Error {
  readonly compatibility: MigrationCompatibilityResult;

  constructor(compatibility: MigrationCompatibilityResult) {
    super(formatMigrationCompatibilityDiagnostic(compatibility));
    this.name = "DatabaseMigrationCompatibilityError";
    this.compatibility = compatibility;
  }
}

export async function assertDatabaseMigrationCompatibility(
  database: QueryableMigrationDatabase,
  knownMigrations: readonly KnownMigration[] = knownDatabaseMigrations,
): Promise<MigrationCompatibilityResult> {
  const compatibility = await inspectMigrationCompatibility(database, knownMigrations);

  if (!compatibility.safeToQuery) {
    throw new DatabaseMigrationCompatibilityError(compatibility);
  }

  return compatibility;
}
