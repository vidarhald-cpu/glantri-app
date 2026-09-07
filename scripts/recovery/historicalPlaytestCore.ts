import { createHash } from "node:crypto";

import type {
  RecoveryPrismaClient,
  RecoveryTransactionClient,
} from "../../packages/database/src/recoveryClient";

import {
  RECOVERY_IDENTITY,
  TARGET_MIGRATION_HEAD,
  currentMigrationChecksums,
  mappingInventory,
  readDatabaseComment,
  targetMarker,
  writeDatabaseComment,
  type BackupVerification,
  type HistoricalSourceManifest,
  type SafeDatabaseTarget,
  type TargetPurpose,
} from "./historicalPlaytestSafety";

export const IMPORTER_VERSION = 2;

type QueryClient = RecoveryPrismaClient | RecoveryTransactionClient;
type JsonRecord = Record<string, unknown>;
type Classification = "A" | "B" | "C" | "D" | "E";

interface MappingTable {
  classification: Classification;
  fields: Record<string, Classification>;
  name: string;
  reason: string;
}

interface MappingInventory {
  sourceMigrationHead: string;
  tables: MappingTable[];
  targetMigrationHead: string;
  version: number;
}

interface ImportSpec {
  batchSize?: number;
  columns: string[];
  conflictColumns: string[];
  name: string;
  transform?: (rows: JsonRecord[], analysis: SourceAnalysis) => JsonRecord[];
}

export function selectCompatibleRosterRows(
  rows: JsonRecord[],
  multiCampaignCharacterIds: string[],
): JsonRecord[] {
  return rows.filter(
    (row) =>
      row.sourceType !== "character" || !multiCampaignCharacterIds.includes(String(row.sourceId)),
  );
}

export function transformScenarioRows(rows: JsonRecord[]): JsonRecord[] {
  return rows.map(({ lifecycleCycle: _cycle, lifecycleRevision: _revision, ...row }) => ({
    ...row,
    status: row.status === "closed" ? "completed" : row.status,
  }));
}

export function archiveHistoricalEncounterRows(rows: JsonRecord[]): JsonRecord[] {
  return rows.map((row) => ({ ...row, status: "archived" }));
}

export interface MembershipProvenance {
  campaignId: string;
  campaignName: string;
  characterId: string;
  characterName: string;
  rosterEntryId: string;
}

export interface EquipmentConflict {
  canonicalItemCount: number;
  characterId: string;
  characterName: string;
  embeddedItemCount: number;
}

export interface ScenarioLifecycleProvenance {
  lifecycleCycle: number;
  lifecycleRevision: number;
  scenarioId: string;
  sourceStatus: string;
}

export interface SourceAnalysis {
  compatiblePasswordHashes: number;
  encounterStatusCounts: Record<string, number>;
  equipmentConflicts: EquipmentConflict[];
  multiCampaignCharacterIds: string[];
  multiCampaignMemberships: MembershipProvenance[];
  scenarioLifecycle: ScenarioLifecycleProvenance[];
  scenarioStatusCounts: Record<string, number>;
  totalUsers: number;
}

export interface ReconciliationFamily {
  family: string;
  imported: number;
  omitted: number;
  provenanceOnly: number;
  reason: string;
  source: number;
  transformed: number;
  unresolved: number;
}

export interface HistoricalImportManifest {
  credentialCompatibility: {
    algorithm: "scrypt";
    compatibleHashes: number;
    incompatibleHashes: number;
    totalUsers: number;
  };
  deterministicIdMaps: {
    generated: [];
    strategy: "stable-source-ids";
  };
  historiesNotFabricated: {
    artifactAuditEvents: number;
    characterLedgerEvents: number;
    characterRevisions: number;
    scenarioArtifactReferences: number;
  };
  importer: {
    version: number;
  };
  manifestVersion: 1;
  mappingInventoryVersion: number;
  provenance: {
    embeddedEquipmentConflicts: EquipmentConflict[];
    encounterSourceStatusCounts: Record<string, number>;
    multiCampaignMemberships: MembershipProvenance[];
    scenarioLifecycle: ScenarioLifecycleProvenance[];
    scenarioSourceStatusCounts: Record<string, number>;
  };
  reconciliation: ReconciliationFamily[];
  source: {
    dataFingerprintSha256: string;
    dumpSha256: string;
    migrationHead: string;
    postImportFingerprintSha256: string;
    publicTableCount: number;
  };
  target: {
    dataFingerprintSha256: string;
    migrationHead: string;
  };
  unresolved: [];
}

const IMPORT_SPECS: ImportSpec[] = [
  {
    columns: ["id", "email", "displayName", "passwordHash", "createdAt", "updatedAt"],
    conflictColumns: ["id"],
    name: "User",
  },
  {
    columns: ["id", "name", "createdAt", "updatedAt"],
    conflictColumns: ["id"],
    name: "Role",
  },
  {
    columns: ["userId", "roleId", "assignedAt"],
    conflictColumns: ["userId", "roleId"],
    name: "UserRole",
  },
  {
    columns: [
      "id",
      "name",
      "slug",
      "description",
      "gmUserId",
      "status",
      "settingsJson",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "Campaign",
  },
  {
    columns: ["id", "name", "level", "build", "ownerId", "createdAt", "updatedAt"],
    conflictColumns: ["id"],
    name: "Character",
  },
  {
    columns: [
      "id",
      "gmUserId",
      "name",
      "kind",
      "description",
      "notes",
      "snapshotJson",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "ReusableEntity",
  },
  {
    columns: [
      "id",
      "campaignId",
      "type",
      "title",
      "description",
      "storageUrl",
      "mimeType",
      "visibility",
      "createdByUserId",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "CampaignAsset",
  },
  {
    columns: [
      "id",
      "characterId",
      "name",
      "type",
      "parentLocationId",
      "isMobile",
      "isAccessibleInEncounter",
      "notes",
      "createdAt",
      "updatedAt",
      "availabilityClass",
    ],
    conflictColumns: ["id"],
    name: "CharacterStorageLocation",
  },
  {
    columns: [
      "id",
      "holderCharacterId",
      "campaignContextId",
      "templateId",
      "category",
      "displayName",
      "specificityType",
      "quantity",
      "isStackable",
      "material",
      "quality",
      "locationId",
      "carryMode",
      "previousLocationId",
      "previousCarryMode",
      "conditionState",
      "durabilityCurrent",
      "durabilityMax",
      "encumbranceOverride",
      "valueOverride",
      "itemFactsJson",
      "notes",
      "isEquipped",
      "isFavorite",
      "acquiredFrom",
      "statusTagsJson",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "CharacterEquipmentItem",
  },
  {
    columns: [
      "id",
      "characterId",
      "name",
      "isActive",
      "wornArmorItemId",
      "readyShieldItemId",
      "activePrimaryWeaponItemId",
      "activeSecondaryWeaponItemId",
      "activeMissileWeaponItemId",
      "activeAmmoItemIds",
      "quickAccessItemIdsJson",
      "notes",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "CharacterLoadout",
  },
  {
    columns: [
      "id",
      "campaignId",
      "sourceType",
      "sourceId",
      "category",
      "labelSnapshot",
      "notes",
      "createdByUserId",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "CampaignRosterEntry",
    transform: (rows, analysis) =>
      selectCompatibleRosterRows(rows, analysis.multiCampaignCharacterIds),
  },
  {
    columns: [
      "id",
      "campaignId",
      "name",
      "description",
      "kind",
      "status",
      "mapAssetId",
      "liveStateJson",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "Scenario",
    transform: transformScenarioRows,
  },
  {
    columns: [
      "id",
      "campaignId",
      "fromScenarioId",
      "toScenarioId",
      "relationType",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "ScenarioRelationship",
  },
  {
    columns: [
      "id",
      "scenarioId",
      "sourceType",
      "characterId",
      "entityId",
      "role",
      "controlledByUserId",
      "factionId",
      "tacticalGroupId",
      "roleTag",
      "displayOrder",
      "joinSource",
      "initiativeSlot",
      "positionJson",
      "visibilityOverridesJson",
      "stateJson",
      "snapshotJson",
      "isActive",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "ScenarioParticipant",
  },
  {
    batchSize: 250,
    columns: [
      "id",
      "scenarioId",
      "roundNumber",
      "phase",
      "eventType",
      "actorUserId",
      "participantId",
      "summary",
      "payloadJson",
      "createdAt",
    ],
    conflictColumns: ["id"],
    name: "ScenarioEventLog",
  },
  {
    columns: [
      "id",
      "name",
      "campaignId",
      "scenarioId",
      "status",
      "sessionJson",
      "combatStorageMode",
      "combatArchiveCount",
      "createdByUserId",
      "createdAt",
      "updatedAt",
    ],
    conflictColumns: ["id"],
    name: "Encounter",
    transform: archiveHistoricalEncounterRows,
  },
  {
    columns: ["encounterId", "revision", "stateJson", "schemaVersion", "createdAt", "updatedAt"],
    conflictColumns: ["encounterId"],
    name: "EncounterActiveCombatState",
  },
  {
    columns: [
      "id",
      "encounterId",
      "roundNumber",
      "roundJson",
      "sourceRevision",
      "schemaVersion",
      "createdAt",
    ],
    conflictColumns: ["id"],
    name: "EncounterArchivedCombatRound",
  },
  {
    columns: ["id", "name", "baseOb", "createdAt", "updatedAt"],
    conflictColumns: ["id"],
    name: "Weapon",
  },
];

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier ${value}.`);
  }
  return `"${value}"`;
}

function rowsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function numericRecord(rows: Array<{ count: number; value: string }>): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.value, row.count]));
}

export function loadMappingInventory(): MappingInventory {
  const inventory = mappingInventory() as MappingInventory;
  const classifications = new Set<Classification>(["A", "B", "C", "D", "E"]);

  if (inventory.version !== 1 || inventory.tables.length !== 23) {
    throw new Error("Historical mapping inventory is missing or incomplete.");
  }

  for (const table of inventory.tables) {
    if (!classifications.has(table.classification) || !Object.keys(table.fields).length) {
      throw new Error(`Historical mapping inventory is incomplete for ${table.name}.`);
    }
    for (const classification of Object.values(table.fields)) {
      if (!classifications.has(classification)) {
        throw new Error(
          `Historical mapping inventory has an invalid field class in ${table.name}.`,
        );
      }
    }
  }

  return inventory;
}

export async function assertSourceSchemaInventory(
  source: RecoveryPrismaClient,
  inventory: MappingInventory,
): Promise<void> {
  const rows = await source.$queryRaw<Array<{ column_name: string; table_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;

  const actual = new Map<string, string[]>();
  for (const row of rows) {
    actual.set(row.table_name, [...(actual.get(row.table_name) ?? []), row.column_name]);
  }

  const expected = new Map(
    inventory.tables.map((table) => [table.name, Object.keys(table.fields)]),
  );

  if (actual.size !== expected.size) {
    throw new Error("Restored source table inventory differs from the approved mapping inventory.");
  }

  for (const [table, columns] of expected) {
    if (!rowsEqual(actual.get(table), columns)) {
      throw new Error(`Restored source fields differ from the approved mapping for ${table}.`);
    }
  }
}

export async function assertSourceReadOnly(source: RecoveryPrismaClient): Promise<void> {
  const state = await source.$queryRaw<
    Array<{
      current_user: string;
      read_only: string;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolsuper: boolean;
    }>
  >`
    SELECT
      current_user,
      current_setting('transaction_read_only') AS read_only,
      rolsuper,
      rolcreatedb,
      rolcreaterole,
      rolbypassrls
    FROM pg_roles
    WHERE rolname = current_user
  `;
  const role = state[0];

  if (
    !role ||
    role.current_user !== "glantri_r5c_reader" ||
    role.read_only !== "on" ||
    role.rolsuper ||
    role.rolcreatedb ||
    role.rolcreaterole ||
    role.rolbypassrls
  ) {
    throw new Error("Historical source connection is not the constrained read-only importer role.");
  }

  const privilegeRows = await source.$queryRaw<Array<{ unsafe: boolean; unreadable: boolean }>>`
    SELECT
      bool_or(
        has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'INSERT') OR
        has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'UPDATE') OR
        has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'DELETE') OR
        has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'TRUNCATE')
      ) AS unsafe,
      bool_or(NOT has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'SELECT')) AS unreadable
    FROM pg_tables
    WHERE schemaname = 'public'
  `;

  if (privilegeRows[0]?.unsafe || privilegeRows[0]?.unreadable) {
    throw new Error("Historical source role has unsafe or incomplete table privileges.");
  }
}

async function tableCount(client: QueryClient, table: string): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`,
  );
  return rows[0]?.count ?? 0;
}

export async function sourceCounts(
  source: RecoveryPrismaClient,
  inventory: MappingInventory,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of inventory.tables) {
    counts[table.name] = await tableCount(source, table.name);
  }
  return counts;
}

export function assertSourceManifestCounts(
  counts: Record<string, number>,
  manifest: HistoricalSourceManifest,
): void {
  const expected = Object.fromEntries(
    manifest.public_row_counts.map((entry) => [
      entry.table.replace(/^public\./, ""),
      entry.row_count,
    ]),
  );

  const names = new Set([...Object.keys(counts), ...Object.keys(expected)]);
  for (const name of names) {
    if (counts[name] !== expected[name]) {
      throw new Error(`Restored source row count differs from the R5B manifest for ${name}.`);
    }
  }
}

export async function assertSourceMigrations(
  source: RecoveryPrismaClient,
  manifest: HistoricalSourceManifest,
  expectedHead: string,
): Promise<void> {
  const rows = await source.$queryRaw<Array<{ checksum: string; migration_name: string }>>`
    SELECT migration_name, checksum
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY started_at, migration_name
  `;

  const actual = rows.map((row) => ({ checksum: row.checksum, name: row.migration_name }));
  const expected = manifest.successful_migrations.map(({ checksum, name }) => ({ checksum, name }));

  if (!rowsEqual(actual, expected) || actual.at(-1)?.name !== expectedHead) {
    throw new Error("Restored source migration lineage differs from the verified R5B manifest.");
  }
}

async function tableJsonRows(client: QueryClient, table: string): Promise<JsonRecord[]> {
  const rows = await client.$queryRawUnsafe<Array<{ row: JsonRecord }>>(
    `SELECT to_jsonb(t) AS row FROM ${quoteIdentifier(table)} AS t ORDER BY to_jsonb(t)::text`,
  );
  return rows.map((entry) => entry.row);
}

export async function databaseFingerprint(
  client: RecoveryPrismaClient,
  tables?: string[],
): Promise<string> {
  const selectedTables =
    tables ??
    (
      await client.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    ).map((entry) => entry.table_name);
  const hash = createHash("sha256");

  for (const table of [...selectedTables].sort()) {
    hash.update(`${table}\n`);
    for (const row of await tableJsonRows(client, table)) {
      hash.update(JSON.stringify(row));
      hash.update("\n");
    }
  }

  return hash.digest("hex");
}

export async function analyzeSource(source: RecoveryPrismaClient): Promise<SourceAnalysis> {
  const passwordRows = await source.$queryRaw<Array<{ compatible: number; total: number }>>`
    SELECT
      COUNT(*) FILTER (WHERE "passwordHash" ~ '^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$')::int AS compatible,
      COUNT(*)::int AS total
    FROM "User"
  `;
  const password = passwordRows[0] ?? { compatible: 0, total: 0 };

  if (password.compatible !== password.total) {
    throw new Error(
      `Password compatibility proof failed for ${password.total - password.compatible} User rows.`,
    );
  }

  const membershipRows = await source.$queryRaw<MembershipProvenance[]>`
    SELECT
      r.id AS "rosterEntryId",
      r."sourceId" AS "characterId",
      c.name AS "characterName",
      r."campaignId" AS "campaignId",
      campaign.name AS "campaignName"
    FROM "CampaignRosterEntry" r
    JOIN "Character" c ON c.id = r."sourceId"
    JOIN "Campaign" campaign ON campaign.id = r."campaignId"
    WHERE r."sourceType" = 'character'
      AND r."sourceId" IN (
        SELECT "sourceId"
        FROM "CampaignRosterEntry"
        WHERE "sourceType" = 'character'
        GROUP BY "sourceId"
        HAVING COUNT(*) > 1
      )
    ORDER BY r."sourceId", r."campaignId", r.id
  `;

  const equipmentConflicts = await source.$queryRaw<EquipmentConflict[]>`
    SELECT
      c.id AS "characterId",
      c.name AS "characterName",
      jsonb_array_length(c.build -> 'equipment' -> 'items')::int AS "embeddedItemCount",
      COUNT(i.*)::int AS "canonicalItemCount"
    FROM "Character" c
    LEFT JOIN "CharacterEquipmentItem" i ON i."holderCharacterId" = c.id
    GROUP BY c.id, c.name, c.build
    HAVING jsonb_array_length(c.build -> 'equipment' -> 'items') <> COUNT(i.*)
    ORDER BY c.id
  `;

  const scenarioLifecycle = await source.$queryRaw<ScenarioLifecycleProvenance[]>`
    SELECT
      id AS "scenarioId",
      status::text AS "sourceStatus",
      "lifecycleRevision"::int AS "lifecycleRevision",
      "lifecycleCycle"::int AS "lifecycleCycle"
    FROM "Scenario"
    ORDER BY id
  `;
  const scenarioStatuses = await source.$queryRaw<Array<{ count: number; value: string }>>`
    SELECT status::text AS value, COUNT(*)::int AS count
    FROM "Scenario"
    GROUP BY status
    ORDER BY status
  `;
  const compatibleScenarioStatuses = new Set([
    "draft",
    "prepared",
    "live",
    "completed",
    "archived",
    "closed",
  ]);

  for (const row of scenarioStatuses) {
    if (!compatibleScenarioStatuses.has(row.value)) {
      throw new Error(`Unresolved populated Scenario status ${row.value} (${row.count} rows).`);
    }
  }

  const encounterStatuses = await source.$queryRaw<Array<{ count: number; value: string }>>`
    SELECT status AS value, COUNT(*)::int AS count
    FROM "Encounter"
    GROUP BY status
    ORDER BY status
  `;

  return {
    compatiblePasswordHashes: password.compatible,
    encounterStatusCounts: numericRecord(encounterStatuses),
    equipmentConflicts,
    multiCampaignCharacterIds: [...new Set(membershipRows.map((row) => row.characterId))].sort(),
    multiCampaignMemberships: membershipRows,
    scenarioLifecycle,
    scenarioStatusCounts: numericRecord(scenarioStatuses),
    totalUsers: password.total,
  };
}

export async function assertTargetMigrations(target: RecoveryPrismaClient): Promise<void> {
  const expected = currentMigrationChecksums();
  const rows = await target.$queryRaw<Array<{ checksum: string; migration_name: string }>>`
    SELECT migration_name, checksum
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name
  `;
  const actual = rows.map((row) => ({ checksum: row.checksum, name: row.migration_name }));

  if (!rowsEqual(actual, expected) || actual.at(-1)?.name !== TARGET_MIGRATION_HEAD) {
    throw new Error("Target does not match the exact current committed migration head.");
  }
}

async function nonMigrationRowCount(target: RecoveryPrismaClient): Promise<number> {
  const tables = await target.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;
  let count = 0;
  for (const table of tables) {
    count += await tableCount(target, table.table_name);
  }
  return count;
}

export async function prepareTarget(
  target: RecoveryPrismaClient,
  endpoint: SafeDatabaseTarget,
  purpose: TargetPurpose,
): Promise<void> {
  const tables = await target.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;

  if ((tables[0]?.count ?? 0) !== 0 || (await readDatabaseComment(target)) !== null) {
    throw new Error("Target preparation requires a fresh, unmarked, zero-schema database.");
  }

  await writeDatabaseComment(target, endpoint.database, targetMarker(purpose));
}

async function assertTargetImportState(
  target: RecoveryPrismaClient,
  purpose: TargetPurpose,
  sourceFingerprint: string,
): Promise<void> {
  const marker = await readDatabaseComment(target);
  const base = targetMarker(purpose, "").replace(/:$/, "");

  if (marker === `${base}:prepared`) {
    if ((await nonMigrationRowCount(target)) !== 0) {
      throw new Error("Prepared target contains non-migration data and is ambiguous.");
    }
    return;
  }

  const fingerprintPrefix = sourceFingerprint.slice(0, 16);
  if (
    marker?.startsWith(`${base}:importing-${fingerprintPrefix}-`) ||
    marker?.startsWith(`${base}:imported-${fingerprintPrefix}-`)
  ) {
    return;
  }

  throw new Error("Target marker is missing, foreign, stale, or ambiguous.");
}

function importSql(spec: ImportSpec): string {
  const columns = spec.columns.map(quoteIdentifier).join(", ");
  const conflicts = spec.conflictColumns.map(quoteIdentifier).join(", ");
  const updateColumns = spec.columns.filter((column) => !spec.conflictColumns.includes(column));
  const update = updateColumns.length
    ? `DO UPDATE SET ${updateColumns
        .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
        .join(", ")}`
    : "DO NOTHING";

  return `
    INSERT INTO ${quoteIdentifier(spec.name)} (${columns})
    SELECT ${columns}
    FROM jsonb_populate_recordset(NULL::${quoteIdentifier(spec.name)}, $1::jsonb)
    ON CONFLICT (${conflicts}) ${update}
  `;
}

async function importRows(
  target: RecoveryPrismaClient,
  spec: ImportSpec,
  rows: JsonRecord[],
): Promise<void> {
  const batchSize = spec.batchSize ?? 100;
  const sql = importSql(spec);

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    await target.$transaction(
      (transaction) => transaction.$executeRawUnsafe(sql, JSON.stringify(batch)),
      { timeout: 30_000 },
    );
  }
}

export async function runImport(input: {
  backup: BackupVerification;
  failAfterFamily?: string;
  purpose: TargetPurpose;
  source: RecoveryPrismaClient;
  target: RecoveryPrismaClient;
}): Promise<HistoricalImportManifest> {
  const inventory = loadMappingInventory();
  await assertSourceReadOnly(input.source);
  await assertSourceSchemaInventory(input.source, inventory);
  const counts = await sourceCounts(input.source, inventory);
  assertSourceManifestCounts(counts, input.backup.sourceManifest);
  await assertSourceMigrations(
    input.source,
    input.backup.sourceManifest,
    inventory.sourceMigrationHead,
  );
  const sourceFingerprint = await databaseFingerprint(
    input.source,
    inventory.tables.map((table) => table.name),
  );
  const analysis = await analyzeSource(input.source);

  await assertTargetMigrations(input.target);
  await assertTargetImportState(input.target, input.purpose, sourceFingerprint);
  await writeDatabaseComment(
    input.target,
    TARGET_DATABASE[input.purpose],
    targetMarker(input.purpose, `importing-${sourceFingerprint.slice(0, 16)}-0`),
  );

  const importedCounts: Record<string, number> = {};
  for (const [index, spec] of IMPORT_SPECS.entries()) {
    const sourceRows = await tableJsonRows(input.source, spec.name);
    const transformedRows = spec.transform ? spec.transform(sourceRows, analysis) : sourceRows;
    await importRows(input.target, spec, transformedRows);
    importedCounts[spec.name] = transformedRows.length;
    await writeDatabaseComment(
      input.target,
      TARGET_DATABASE[input.purpose],
      targetMarker(input.purpose, `importing-${sourceFingerprint.slice(0, 16)}-${index + 1}`),
    );

    if (input.failAfterFamily === spec.name) {
      throw new Error(`Injected failure after committed family ${spec.name}.`);
    }
  }

  const sourcePostFingerprint = await databaseFingerprint(
    input.source,
    inventory.tables.map((table) => table.name),
  );
  if (sourcePostFingerprint !== sourceFingerprint) {
    throw new Error("Historical source fingerprint changed during importer execution.");
  }

  const historiesNotFabricated = {
    artifactAuditEvents: await tableCount(input.target, "ArtifactAuditEvent"),
    characterLedgerEvents: await tableCount(input.target, "CharacterLedgerEvent"),
    characterRevisions: await tableCount(input.target, "CharacterRevision"),
    scenarioArtifactReferences: await tableCount(input.target, "ScenarioArtifactReference"),
  };
  if (Object.values(historiesNotFabricated).some((count) => count !== 0)) {
    throw new Error("Importer fabricated a modern history or provenance record.");
  }

  if ((await tableCount(input.target, "Session")) !== 0) {
    throw new Error("Historical Sessions were imported unexpectedly.");
  }

  const importedEncounterStatuses = await input.target.$queryRaw<
    Array<{ count: number; status: string }>
  >`
    SELECT status, COUNT(*)::int AS count
    FROM "Encounter"
    GROUP BY status
    ORDER BY status
  `;
  if (
    importedEncounterStatuses.length !== 1 ||
    importedEncounterStatuses[0]?.status !== "archived" ||
    importedEncounterStatuses[0].count !== counts.Encounter
  ) {
    throw new Error("Historical Encounters are not fully isolated from current live play.");
  }

  const targetTables = (
    await input.target.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `
  ).map((entry) => entry.table_name);
  const targetFingerprint = await databaseFingerprint(input.target, targetTables);
  const manifest = buildManifest({
    analysis,
    backup: input.backup,
    counts,
    historiesNotFabricated,
    importedCounts,
    inventory,
    sourceFingerprint,
    sourcePostFingerprint,
    targetFingerprint,
  });
  const manifestDigest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  await writeDatabaseComment(
    input.target,
    TARGET_DATABASE[input.purpose],
    targetMarker(
      input.purpose,
      `imported-${sourceFingerprint.slice(0, 16)}-${manifestDigest.slice(0, 16)}`,
    ),
  );
  return manifest;
}

const TARGET_DATABASE: Record<TargetPurpose, string> = {
  "target-a": RECOVERY_IDENTITY.targets["target-a"].database,
  "target-b": RECOVERY_IDENTITY.targets["target-b"].database,
  failure: RECOVERY_IDENTITY.targets.failure.database,
};

function buildManifest(input: {
  analysis: SourceAnalysis;
  backup: BackupVerification;
  counts: Record<string, number>;
  historiesNotFabricated: HistoricalImportManifest["historiesNotFabricated"];
  importedCounts: Record<string, number>;
  inventory: MappingInventory;
  sourceFingerprint: string;
  sourcePostFingerprint: string;
  targetFingerprint: string;
}): HistoricalImportManifest {
  const multiMemberships = input.analysis.multiCampaignMemberships.length;
  const transformedScenarioStatuses = input.analysis.scenarioStatusCounts.closed ?? 0;
  const reconciliation = input.inventory.tables.map((table): ReconciliationFamily => {
    const source = input.counts[table.name] ?? 0;
    const imported = input.importedCounts[table.name] ?? 0;
    let transformed = 0;
    let provenanceOnly = 0;
    let omitted = 0;

    if (table.name === "CampaignRosterEntry") {
      provenanceOnly = multiMemberships;
    } else if (table.name === "Scenario") {
      transformed = transformedScenarioStatuses;
      provenanceOnly = source;
    } else if (table.name === "Encounter") {
      transformed = source;
    } else if (table.classification === "C") {
      provenanceOnly = source;
    } else if (table.classification === "D") {
      omitted = source;
    }

    return {
      family: table.name,
      imported,
      omitted,
      provenanceOnly,
      reason: table.reason,
      source,
      transformed,
      unresolved: 0,
    };
  });

  reconciliation.push(
    {
      family: "CharacterRevision",
      imported: 0,
      omitted: 0,
      provenanceOnly: 0,
      reason: "No historical source table exists; no modern Character history was fabricated.",
      source: 0,
      transformed: 0,
      unresolved: 0,
    },
    {
      family: "CharacterLedgerEvent",
      imported: 0,
      omitted: 0,
      provenanceOnly: 0,
      reason:
        "No historical source table exists; no acquisition or provenance history was fabricated.",
      source: 0,
      transformed: 0,
      unresolved: 0,
    },
    {
      family: "ArtifactAuditEvent/ScenarioArtifactReference",
      imported: 0,
      omitted: 0,
      provenanceOnly: 0,
      reason: "No historical source tables exist; no modern artifact history was fabricated.",
      source: 0,
      transformed: 0,
      unresolved: 0,
    },
  );

  return {
    credentialCompatibility: {
      algorithm: "scrypt",
      compatibleHashes: input.analysis.compatiblePasswordHashes,
      incompatibleHashes: input.analysis.totalUsers - input.analysis.compatiblePasswordHashes,
      totalUsers: input.analysis.totalUsers,
    },
    deterministicIdMaps: { generated: [], strategy: "stable-source-ids" },
    historiesNotFabricated: input.historiesNotFabricated,
    importer: { version: IMPORTER_VERSION },
    manifestVersion: 1,
    mappingInventoryVersion: input.inventory.version,
    provenance: {
      embeddedEquipmentConflicts: input.analysis.equipmentConflicts,
      encounterSourceStatusCounts: input.analysis.encounterStatusCounts,
      multiCampaignMemberships: input.analysis.multiCampaignMemberships,
      scenarioLifecycle: input.analysis.scenarioLifecycle,
      scenarioSourceStatusCounts: input.analysis.scenarioStatusCounts,
    },
    reconciliation,
    source: {
      dataFingerprintSha256: input.sourceFingerprint,
      dumpSha256: input.backup.dumpSha256,
      migrationHead: input.inventory.sourceMigrationHead,
      postImportFingerprintSha256: input.sourcePostFingerprint,
      publicTableCount: input.inventory.tables.length,
    },
    target: {
      dataFingerprintSha256: input.targetFingerprint,
      migrationHead: input.inventory.targetMigrationHead,
    },
    unresolved: [],
  };
}
