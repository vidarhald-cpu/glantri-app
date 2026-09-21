export const PROTECTED_SHARED_DATABASE = {
  database: "glantri",
  host: "localhost",
  port: "5432",
} as const;

export const PROTECTED_PLAYTEST_DATABASE = {
  database: "glantri_playtest",
  port: "5433",
} as const;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

export interface DatabaseTarget {
  database: string;
  host: string;
  port: string;
}

export interface TaskDatabaseEnvironment {
  DATABASE_URL?: string;
  DATABASE_URL_TEST?: string;
  GLANTRI_DB_CONTAINER?: string;
  GLANTRI_DB_MODE?: string;
  GLANTRI_DB_OWNER?: string;
  GLANTRI_DB_TASK?: string;
}

export interface ValidatedTaskDatabaseEnvironment {
  application: DatabaseTarget;
  container: string;
  owner: string;
  task: string;
  test: DatabaseTarget;
}

export interface ValidatedPlaytestDatabaseEnvironment {
  database: DatabaseTarget;
}

function decodeDatabaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

export function parseDatabaseTarget(name: string, value: string | undefined): DatabaseTarget {
  if (!value?.trim()) {
    throw new Error(`${name} is required and must be an explicit PostgreSQL URL.`);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${name} must use the postgresql:// protocol.`);
  }

  const database = decodeDatabaseName(url);

  if (!url.hostname || !database) {
    throw new Error(`${name} must include an explicit host and database name.`);
  }

  return {
    database,
    host: url.hostname.toLowerCase().replace(/\.$/, ""),
    port: url.port || "5432",
  };
}

export function formatDatabaseTarget(target: DatabaseTarget): string {
  return `host=${target.host} port=${target.port} database=${target.database}`;
}

export function isProtectedSharedDatabase(target: DatabaseTarget): boolean {
  return (
    LOOPBACK_HOSTS.has(target.host) &&
    target.port === PROTECTED_SHARED_DATABASE.port &&
    target.database === PROTECTED_SHARED_DATABASE.database
  );
}

export function validatePlaytestDatabaseEnvironment(environment: {
  DATABASE_URL?: string;
  GLANTRI_DB_MODE?: string;
}): ValidatedPlaytestDatabaseEnvironment {
  if (environment.GLANTRI_DB_MODE !== "playtest") {
    throw new Error('GLANTRI_DB_MODE must be exactly "playtest" for the standing runtime.');
  }

  const database = parseDatabaseTarget("DATABASE_URL", environment.DATABASE_URL);

  if (
    !LOOPBACK_HOSTS.has(database.host) ||
    database.port !== PROTECTED_PLAYTEST_DATABASE.port ||
    database.database !== PROTECTED_PLAYTEST_DATABASE.database
  ) {
    throw new Error(
      `Standing playtest DATABASE_URL must target loopback port ${PROTECTED_PLAYTEST_DATABASE.port}/${PROTECTED_PLAYTEST_DATABASE.database}; received ${formatDatabaseTarget(database)}.`,
    );
  }

  return { database };
}

// PostgreSQL identifiers are silently truncated to 63 bytes: a name built by naive
// concatenation of an owner label (which can be long, e.g. a Codex task id plus a worktree
// label) and a trailing uniqueness digest can overflow that limit, and PostgreSQL truncates
// from the end -- removing exactly the digest that keeps two distinct worktrees from
// colliding on one database. `deriveCurrentWorktreeTaskDatabaseIdentity` always appends the
// worktree digest as the final 8 characters of `owner` (see worktreeDatabaseOwnership.ts), so
// this function reserves and preserves those trailing 8 characters unconditionally and only
// ever truncates the human-readable label in front of them. The budget is sized against the
// longest name this owner will ever produce -- the `_test` suffixed database -- so both the
// application and test database names are guaranteed to fit within 63 bytes.
export const DATABASE_IDENTIFIER_BYTE_LIMIT = 63;
const DATABASE_NAME_PREFIX = "glantri_task_";
const DATABASE_TEST_SUFFIX = "_test";
const OWNER_DIGEST_LENGTH = 8;

function normalizeOwnerForDatabase(owner: string): string {
  return owner
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ownerDatabasePrefix(owner: string): string {
  const normalizedOwner = normalizeOwnerForDatabase(owner);
  const digest = normalizedOwner.slice(-OWNER_DIGEST_LENGTH);
  const label = normalizedOwner.slice(0, -OWNER_DIGEST_LENGTH).replace(/_+$/, "");

  const budgetForLabelAndSeparator =
    DATABASE_IDENTIFIER_BYTE_LIMIT -
    DATABASE_TEST_SUFFIX.length -
    DATABASE_NAME_PREFIX.length -
    digest.length;

  if (label.length === 0 || budgetForLabelAndSeparator <= 0) {
    return `${DATABASE_NAME_PREFIX}${digest}`;
  }

  const truncatedLabel = label.slice(0, budgetForLabelAndSeparator - 1).replace(/_+$/, "");

  return truncatedLabel.length > 0
    ? `${DATABASE_NAME_PREFIX}${truncatedLabel}_${digest}`
    : `${DATABASE_NAME_PREFIX}${digest}`;
}

export function validateTestDatabaseTarget(
  databaseUrlTest: string | undefined,
  databaseUrl?: string,
): DatabaseTarget {
  const testTarget = parseDatabaseTarget("DATABASE_URL_TEST", databaseUrlTest);

  if (isProtectedSharedDatabase(testTarget)) {
    throw new Error(
      "DATABASE_URL_TEST points at the protected shared database localhost:5432/glantri. Use a disposable task test database.",
    );
  }

  if (!LOOPBACK_HOSTS.has(testTarget.host)) {
    throw new Error(
      `DATABASE_URL_TEST must use a local disposable PostgreSQL target; received ${formatDatabaseTarget(testTarget)}.`,
    );
  }

  if (!testTarget.database.endsWith("_test")) {
    throw new Error(
      `DATABASE_URL_TEST database must end in _test; received ${formatDatabaseTarget(testTarget)}.`,
    );
  }

  if (databaseUrl) {
    const applicationTarget = parseDatabaseTarget("DATABASE_URL", databaseUrl);

    if (
      applicationTarget.host === testTarget.host &&
      applicationTarget.port === testTarget.port &&
      applicationTarget.database === testTarget.database
    ) {
      throw new Error("DATABASE_URL_TEST must not point at the same database as DATABASE_URL.");
    }
  }

  return testTarget;
}

export function validateTaskDatabaseEnvironment(
  environment: TaskDatabaseEnvironment,
): ValidatedTaskDatabaseEnvironment {
  if (environment.GLANTRI_DB_MODE !== "task") {
    throw new Error('GLANTRI_DB_MODE must be exactly "task" in an isolated worktree.');
  }

  const owner = environment.GLANTRI_DB_OWNER?.trim();
  const container = environment.GLANTRI_DB_CONTAINER?.trim();
  const task = environment.GLANTRI_DB_TASK?.trim();

  if (!task || !/^[a-zA-Z0-9-]+$/.test(task)) {
    throw new Error(
      "GLANTRI_DB_TASK is required and may contain only letters, numbers, and hyphens.",
    );
  }

  if (!owner) {
    throw new Error("GLANTRI_DB_OWNER is required in an isolated worktree.");
  }

  if (!container) {
    throw new Error("GLANTRI_DB_CONTAINER is required in an isolated worktree.");
  }

  if (!owner.startsWith(`issue-${task}-`)) {
    throw new Error(`GLANTRI_DB_OWNER does not match GLANTRI_DB_TASK=${task}.`);
  }

  const application = parseDatabaseTarget("DATABASE_URL", environment.DATABASE_URL);
  const test = validateTestDatabaseTarget(environment.DATABASE_URL_TEST, environment.DATABASE_URL);
  const expectedApplicationDatabase = ownerDatabasePrefix(owner);
  const expectedTestDatabase = `${expectedApplicationDatabase}_test`;

  if (isProtectedSharedDatabase(application)) {
    throw new Error(
      "DATABASE_URL points at the protected shared database localhost:5432/glantri. Isolated worktrees may never use it.",
    );
  }

  if (
    application.database !== expectedApplicationDatabase ||
    test.database !== expectedTestDatabase
  ) {
    throw new Error(
      `Task database ownership mismatch for ${owner}: expected ${expectedApplicationDatabase} and ${expectedTestDatabase}.`,
    );
  }

  if (application.host !== test.host || application.port !== test.port) {
    throw new Error(
      "DATABASE_URL and DATABASE_URL_TEST must use the task container's same host and port.",
    );
  }

  return {
    application,
    container,
    owner,
    task,
    test,
  };
}
