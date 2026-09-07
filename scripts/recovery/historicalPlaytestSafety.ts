import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { RecoveryPrismaClient } from "../../packages/database/src/recoveryClient";

export const ISSUE = "61";
export const WORKTREE_KEY = "d543";
export const SOURCE_DATABASE = "glantri_task_issue_61_d543_r5c_source";
export const SOURCE_CONTAINER = "glantri-task-issue-61-d543-r5c-source-pg16";
export const SOURCE_READER_ROLE = "glantri_r5c_reader";
export const EXPECTED_DUMP_SHA256 =
  "6fa92f4486ba97328e3abe26e5bafe1c46f51628d012dfa17dd26e61b929bed1";
export const TARGET_MIGRATION_HEAD = "20260829103000_add_retained_character_ledger";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, "..", "..");
export const mappingPath = resolve(scriptDirectory, "historical-playtest-mapping.json");
export const migrationsDirectory = resolve(
  repositoryRoot,
  "packages",
  "database",
  "prisma",
  "migrations",
);

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const FORBIDDEN_PORTS = new Set(["5432", "5433"]);
const FORBIDDEN_DATABASES = new Set(["glantri", "glantri_playtest", "glantri_restore_verify"]);

export type TargetPurpose = "target-a" | "target-b" | "failure";

const TARGETS: Record<TargetPurpose, { container: string; database: string }> = {
  "target-a": {
    container: "glantri-task-issue-61-d543-r5c-target-a-pg16",
    database: "glantri_task_issue_61_d543_r5c_target_a",
  },
  "target-b": {
    container: "glantri-task-issue-61-d543-r5c-target-b-pg16",
    database: "glantri_task_issue_61_d543_r5c_target_b",
  },
  failure: {
    container: "glantri-task-issue-61-d543-r5c-failure-pg16",
    database: "glantri_task_issue_61_d543_r5c_failure",
  },
};

export interface SafeDatabaseTarget {
  database: string;
  host: string;
  port: string;
  url: string;
  username: string;
}

interface ContainerInspection {
  Config?: {
    Image?: string;
    Labels?: Record<string, string>;
  };
  Name?: string;
  NetworkSettings?: {
    Ports?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null>;
  };
  State?: {
    Running?: boolean;
  };
}

export interface BackupVerification {
  dumpSha256: string;
  sourceManifest: HistoricalSourceManifest;
}

export interface HistoricalSourceManifest {
  historical_source: {
    database_name: string;
    image_ref: string;
    server_version: string;
  };
  public_row_counts: Array<{ row_count: number; table: string }>;
  public_table_count: number;
  successful_migration_count: number;
  successful_migrations: Array<{ checksum: string; name: string }>;
}

function fail(message: string): never {
  throw new Error(message);
}

function parsePostgresUrl(name: string, value: string): SafeDatabaseTarget {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    fail(`${name} must be a valid PostgreSQL URL.`);
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail(`${name} must use postgresql://.`);
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const port = parsed.port || "5432";
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!LOOPBACK_HOSTS.has(host)) {
    fail(`${name} must use an explicit loopback host.`);
  }

  if (FORBIDDEN_PORTS.has(port)) {
    fail(`${name} refuses protected or persistent port ${port}.`);
  }

  if (!database || FORBIDDEN_DATABASES.has(database)) {
    fail(`${name} refuses protected, persistent, or ambiguous database ${database || "<empty>"}.`);
  }

  return {
    database,
    host,
    port,
    url: value,
    username: decodeURIComponent(parsed.username),
  };
}

function inspectContainer(container: string): ContainerInspection {
  const result = spawnSync("docker", ["container", "inspect", container], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error || result.status !== 0) {
    fail(`Expected disposable recovery container ${container} is unavailable.`);
  }

  const inspections = JSON.parse(result.stdout) as ContainerInspection[];
  const inspection = inspections[0];

  if (!inspection) {
    fail(`Expected disposable recovery container ${container} returned no metadata.`);
  }

  return inspection;
}

function assertContainer(
  container: string,
  purpose: "source" | TargetPurpose,
  target: SafeDatabaseTarget,
): void {
  const inspection = inspectContainer(container);
  const labels = inspection.Config?.Labels ?? {};
  const binding = inspection.NetworkSettings?.Ports?.["5432/tcp"]?.[0];

  if (
    inspection.Config?.Image !== "postgres:16" ||
    inspection.State?.Running !== true ||
    labels["glantri.db.kind"] !== "disposable-recovery" ||
    labels["glantri.db.issue"] !== ISSUE ||
    labels["glantri.db.worktree"] !== WORKTREE_KEY ||
    labels["glantri.db.purpose"] !== purpose ||
    binding?.HostIp !== "127.0.0.1" ||
    binding.HostPort !== target.port
  ) {
    fail(`Container ${container} is not the expected owned PostgreSQL 16 ${purpose} resource.`);
  }
}

export function validateSourceEndpoint(
  url: string,
  container = SOURCE_CONTAINER,
): SafeDatabaseTarget {
  const target = parsePostgresUrl("--source-url", url);

  if (target.database !== SOURCE_DATABASE) {
    fail(`--source-url must name the issue #61 restored source database.`);
  }

  assertContainer(container, "source", target);
  return target;
}

export function validateTargetEndpoint(
  url: string,
  purpose: TargetPurpose,
  container: string,
): SafeDatabaseTarget {
  const target = parsePostgresUrl("--target-url", url);
  const expected = TARGETS[purpose];

  if (target.database !== expected.database || container !== expected.container) {
    fail(`--target-url and --target-container must name the exact ${purpose} resource.`);
  }

  assertContainer(container, purpose, target);
  return target;
}

async function sha256File(path: string): Promise<string> {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveDigest(hash.digest("hex")));
  });
}

export async function verifyBackupDirectory(directory: string): Promise<BackupVerification> {
  const sumsPath = resolve(directory, "SHA256SUMS");
  const wrapperPath = resolve(directory, "SHA256SUMS.sha256");

  if (!existsSync(sumsPath) || !existsSync(wrapperPath)) {
    fail("The R5B backup directory must contain SHA256SUMS and SHA256SUMS.sha256.");
  }

  const wrapper = readFileSync(wrapperPath, "utf8")
    .trim()
    .match(/^([0-9a-f]{64}) {2}SHA256SUMS$/);

  if (!wrapper || (await sha256File(sumsPath)) !== wrapper[1]) {
    fail("SHA256SUMS wrapper verification failed.");
  }

  const entries = readFileSync(sumsPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.match(/^([0-9a-f]{64}) {2}([^/].*)$/));

  if (entries.some((entry) => !entry)) {
    fail("SHA256SUMS contains an invalid or unsafe entry.");
  }

  for (const entry of entries) {
    const [, expectedDigest, filename] = entry!;
    const path = resolve(directory, filename);

    if (dirname(path) !== resolve(directory) || !existsSync(path)) {
      fail(`Checksum entry ${filename} is missing or escapes the backup directory.`);
    }

    if ((await sha256File(path)) !== expectedDigest) {
      fail(`Checksum verification failed for ${filename}.`);
    }
  }

  const dumpEntry = entries.find((entry) => entry?.[2].endsWith(".dump"));

  if (!dumpEntry || dumpEntry[1] !== EXPECTED_DUMP_SHA256) {
    fail("The verified custom dump fingerprint is not the accepted R5B fingerprint.");
  }

  const sourceManifestPath = resolve(directory, "historical-source-manifest-20260907T112751Z.json");
  const sourceManifest = JSON.parse(
    readFileSync(sourceManifestPath, "utf8"),
  ) as HistoricalSourceManifest;

  return { dumpSha256: dumpEntry[1], sourceManifest };
}

export function currentMigrationChecksums(): Array<{ checksum: string; name: string }> {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sqlPath = resolve(migrationsDirectory, entry.name, "migration.sql");
      return {
        checksum: createHash("sha256").update(readFileSync(sqlPath)).digest("hex"),
        name: entry.name,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function targetMarker(purpose: TargetPurpose, state = "prepared"): string {
  return `glantri:r5c:issue-61:worktree-d543:${purpose}:${state}`;
}

export async function readDatabaseComment(client: RecoveryPrismaClient): Promise<string | null> {
  const rows = await client.$queryRaw<Array<{ comment: string | null }>>`
    SELECT shobj_description(oid, 'pg_database') AS comment
    FROM pg_database
    WHERE datname = current_database()
  `;
  return rows[0]?.comment ?? null;
}

export async function writeDatabaseComment(
  client: RecoveryPrismaClient,
  database: string,
  comment: string,
): Promise<void> {
  if (!/^glantri_task_issue_61_d543_r5c_(target_a|target_b|failure)$/.test(database)) {
    fail("Refusing to comment an unexpected database.");
  }

  if (
    !/^glantri:r5c:issue-61:worktree-d543:(target-a|target-b|failure):[a-z0-9:-]+$/.test(comment)
  ) {
    fail("Refusing an invalid recovery target marker.");
  }

  await client.$executeRawUnsafe(`COMMENT ON DATABASE "${database}" IS '${comment}'`);
}

export function sanitizedTarget(target: SafeDatabaseTarget): string {
  return `host=${target.host} port=${target.port} database=${target.database}`;
}

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "<redacted-postgresql-url>");
}

export function mappingInventory(): unknown {
  return JSON.parse(readFileSync(mappingPath, "utf8"));
}

export function backupFilename(path: string): string {
  return basename(path);
}
