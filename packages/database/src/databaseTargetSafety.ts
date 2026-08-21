export const PROTECTED_SHARED_DATABASE = {
  database: "glantri",
  host: "localhost",
  port: "5432",
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

function ownerDatabasePrefix(owner: string): string {
  return `glantri_task_${owner
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
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
