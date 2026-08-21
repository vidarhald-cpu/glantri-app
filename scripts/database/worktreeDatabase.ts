import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  formatDatabaseTarget,
  validateTaskDatabaseEnvironment,
  type TaskDatabaseEnvironment,
} from "../../packages/database/src/databaseTargetSafety";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const databasePackageDir = resolve(repoRoot, "packages", "database");
const defaultEnvironmentFile = resolve(repoRoot, ".env.task");

type TaskTarget = "application" | "test";

interface DockerInspection {
  Config?: {
    Image?: string;
    Labels?: Record<string, string>;
  };
  NetworkSettings?: {
    Ports?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null>;
  };
  State?: {
    Running?: boolean;
  };
}

function fail(message: string): never {
  throw new Error(message);
}

function run(
  command: string,
  args: string[],
  options: { capture?: boolean; cwd?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = options.capture ? (result.stderr || result.stdout || "").trim() : "";
    fail(detail || `${command} exited with status ${result.status ?? 1}.`);
  }

  return options.capture ? result.stdout.trim() : "";
}

function parseEnvironmentFile(path: string): TaskDatabaseEnvironment {
  if (!existsSync(path)) {
    fail(
      `Task database environment is missing at ${path}. Run pnpm db:task:setup -- --task <issue>.`,
    );
  }

  const environment: Record<string, string> = {};

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      fail(`Invalid task database environment entry in ${path}.`);
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    environment[key] = value;
  }

  return environment;
}

function isLinkedWorktree(): boolean {
  const gitMarker = resolve(repoRoot, ".git");
  return existsSync(gitMarker) && lstatSync(gitMarker).isFile();
}

function requireLinkedWorktree(): void {
  if (!isLinkedWorktree()) {
    fail("Task database containers are only supported from an isolated Git worktree.");
  }
}

function getArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireTaskIdentity(): {
  applicationDatabase: string;
  container: string;
  owner: string;
  testDatabase: string;
} {
  const task = getArgument("--task")?.trim();

  if (!task || !/^[a-zA-Z0-9-]+$/.test(task)) {
    fail("--task is required and may contain only letters, numbers, and hyphens.");
  }

  const worktreeKey = basename(dirname(repoRoot))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const owner = `issue-${task}-${worktreeKey}`;
  const databaseOwner = owner.replace(/[^a-z0-9]+/g, "_");

  return {
    applicationDatabase: `glantri_task_${databaseOwner}`,
    container: `glantri-task-${owner}-pg16`,
    owner,
    testDatabase: `glantri_task_${databaseOwner}_test`,
  };
}

function inspectContainer(container: string): DockerInspection | null {
  const result = spawnSync("docker", ["container", "inspect", container], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    return null;
  }

  const inspections = JSON.parse(result.stdout) as DockerInspection[];
  return inspections[0] ?? null;
}

function assertOwnedContainer(
  inspection: DockerInspection,
  expected: { applicationDatabase: string; container: string; owner: string },
): void {
  const labels = inspection.Config?.Labels ?? {};

  if (
    inspection.Config?.Image !== "postgres:16" ||
    labels["glantri.db.kind"] !== "disposable-task" ||
    labels["glantri.db.owner"] !== expected.owner ||
    labels["glantri.db.database"] !== expected.applicationDatabase
  ) {
    fail(
      `Container ${expected.container} exists but is not the expected owned PostgreSQL 16 task target.`,
    );
  }
}

function containerPort(inspection: DockerInspection): string {
  const bindings = inspection.NetworkSettings?.Ports?.["5432/tcp"];
  const port = bindings?.[0]?.HostPort;

  if (!port) {
    fail("Task PostgreSQL container does not expose an explicit loopback port.");
  }

  return port;
}

function waitForPostgres(container: string): void {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.status === 0) {
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }

  fail(`PostgreSQL did not become ready in container ${container}.`);
}

function ensureTestDatabase(container: string, database: string): void {
  const exists = run(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname='${database}'`,
    ],
    { capture: true },
  );

  if (exists !== "1") {
    run("docker", ["exec", container, "createdb", "-U", "postgres", database]);
  }
}

function environmentText(environment: Required<TaskDatabaseEnvironment>): string {
  return [
    "# Generated by pnpm db:task:setup. Disposable task database only.",
    `GLANTRI_DB_MODE=${environment.GLANTRI_DB_MODE}`,
    `GLANTRI_DB_OWNER=${environment.GLANTRI_DB_OWNER}`,
    `GLANTRI_DB_CONTAINER=${environment.GLANTRI_DB_CONTAINER}`,
    `DATABASE_URL=${environment.DATABASE_URL}`,
    `DATABASE_URL_TEST=${environment.DATABASE_URL_TEST}`,
    "",
  ].join("\n");
}

function writeTaskEnvironment(path: string, environment: Required<TaskDatabaseEnvironment>): void {
  writeFileSync(path, environmentText(environment), { encoding: "utf8", mode: 0o600 });
}

function assertNoEnvironmentMismatch(environment: TaskDatabaseEnvironment): void {
  for (const name of [
    "DATABASE_URL",
    "DATABASE_URL_TEST",
    "GLANTRI_DB_MODE",
    "GLANTRI_DB_OWNER",
    "GLANTRI_DB_CONTAINER",
  ] as const) {
    const inherited = process.env[name];
    const configured = environment[name];

    if (inherited && configured && inherited !== configured) {
      fail(
        `${name} conflicts with .env.task. Clear the inherited value instead of choosing an ambiguous target.`,
      );
    }
  }
}

function loadValidatedEnvironment(path = defaultEnvironmentFile): {
  environment: NodeJS.ProcessEnv;
  validated: ReturnType<typeof validateTaskDatabaseEnvironment>;
} {
  requireLinkedWorktree();
  const configured = parseEnvironmentFile(path);
  assertNoEnvironmentMismatch(configured);
  const validated = validateTaskDatabaseEnvironment(configured);

  return {
    environment: {
      ...process.env,
      ...configured,
    },
    validated,
  };
}

function printPreflight(
  action: string,
  target: TaskTarget,
  validated: ReturnType<typeof validateTaskDatabaseEnvironment>,
): void {
  const databaseTarget = target === "application" ? validated.application : validated.test;
  console.log(
    `Database preflight: action=${action} owner=${validated.owner} target=${target} ${formatDatabaseTarget(databaseTarget)}`,
  );
}

function verifyOwnedRunningContainer(
  validated: ReturnType<typeof validateTaskDatabaseEnvironment>,
): DockerInspection {
  const inspection = inspectContainer(validated.container);

  if (!inspection) {
    fail(
      `Task container ${validated.container} is missing. Run pnpm db:task:setup -- --task <issue>.`,
    );
  }

  assertOwnedContainer(inspection, {
    applicationDatabase: validated.application.database,
    container: validated.container,
    owner: validated.owner,
  });

  if (!inspection.State?.Running) {
    fail(`Task container ${validated.container} is not running.`);
  }

  const boundPort = containerPort(inspection);

  if (boundPort !== validated.application.port) {
    fail(
      `Task container port ${boundPort} does not match .env.task port ${validated.application.port}.`,
    );
  }

  return inspection;
}

function setup(): void {
  requireLinkedWorktree();
  const identity = requireTaskIdentity();
  const existingEnvironment = existsSync(defaultEnvironmentFile)
    ? parseEnvironmentFile(defaultEnvironmentFile)
    : undefined;

  if (existingEnvironment) {
    const existing = validateTaskDatabaseEnvironment(existingEnvironment);

    if (existing.owner !== identity.owner || existing.container !== identity.container) {
      fail(
        `.env.task belongs to ${existing.owner}; cleanup that target before setting up ${identity.owner}.`,
      );
    }
  }

  let inspection = inspectContainer(identity.container);

  if (inspection) {
    assertOwnedContainer(inspection, identity);

    if (!inspection.State?.Running) {
      run("docker", ["start", identity.container]);
      inspection = inspectContainer(identity.container);
    }
  } else {
    const password = existingEnvironment?.DATABASE_URL
      ? decodeURIComponent(new URL(existingEnvironment.DATABASE_URL).password)
      : randomBytes(24).toString("hex");

    run("docker", [
      "run",
      "-d",
      "--name",
      identity.container,
      "--label",
      "glantri.db.kind=disposable-task",
      "--label",
      `glantri.db.owner=${identity.owner}`,
      "--label",
      `glantri.db.database=${identity.applicationDatabase}`,
      "-e",
      "POSTGRES_USER=postgres",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      `POSTGRES_DB=${identity.applicationDatabase}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:16",
    ]);
    inspection = inspectContainer(identity.container);
  }

  if (!inspection) {
    fail(`Unable to inspect newly created task container ${identity.container}.`);
  }

  assertOwnedContainer(inspection, identity);
  const port = containerPort(inspection);
  const password = existingEnvironment?.DATABASE_URL
    ? decodeURIComponent(new URL(existingEnvironment.DATABASE_URL).password)
    : run(
        "docker",
        [
          "container",
          "inspect",
          "--format",
          "{{range .Config.Env}}{{println .}}{{end}}",
          identity.container,
        ],
        { capture: true },
      )
        .split("\n")
        .find((entry) => entry.startsWith("POSTGRES_PASSWORD="))
        ?.slice("POSTGRES_PASSWORD=".length);

  if (!password) {
    fail("Task container password metadata is missing.");
  }

  waitForPostgres(identity.container);
  ensureTestDatabase(identity.container, identity.testDatabase);

  const environment: Required<TaskDatabaseEnvironment> = {
    DATABASE_URL: `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${identity.applicationDatabase}`,
    DATABASE_URL_TEST: `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${identity.testDatabase}`,
    GLANTRI_DB_CONTAINER: identity.container,
    GLANTRI_DB_MODE: "task",
    GLANTRI_DB_OWNER: identity.owner,
  };

  validateTaskDatabaseEnvironment(environment);
  writeTaskEnvironment(defaultEnvironmentFile, environment);
  const validated = validateTaskDatabaseEnvironment(environment);
  printPreflight("setup", "application", validated);
  printPreflight("setup", "test", validated);
  console.log(`Disposable PostgreSQL 16 task target ${identity.container} is ready.`);
}

function migrateTarget(
  target: TaskTarget,
  environment: NodeJS.ProcessEnv,
  validated: ReturnType<typeof validateTaskDatabaseEnvironment>,
): void {
  printPreflight("migrate", target, validated);
  const url = target === "application" ? environment.DATABASE_URL : environment.DATABASE_URL_TEST;
  run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: databasePackageDir,
    env: {
      ...environment,
      DATABASE_URL: url,
      GLANTRI_DB_APPLICATION_URL: environment.DATABASE_URL,
    },
  });
}

function migrate(): void {
  const { environment, validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  const requested = getArgument("--target") ?? "both";

  if (!new Set(["application", "test", "both"]).has(requested)) {
    fail("--target must be application, test, or both.");
  }

  if (requested === "application" || requested === "both") {
    migrateTarget("application", environment, validated);
  }

  if (requested === "test" || requested === "both") {
    migrateTarget("test", environment, validated);
  }
}

function reset(): void {
  if (!process.argv.includes("--confirm")) {
    fail("Refusing to reset a disposable task database without --confirm.");
  }

  const { environment, validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  const requested = getArgument("--target") ?? "application";

  if (requested !== "application" && requested !== "test") {
    fail("--target must be application or test.");
  }

  printPreflight("reset", requested, validated);
  const url =
    requested === "application" ? environment.DATABASE_URL : environment.DATABASE_URL_TEST;
  run("pnpm", ["exec", "prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"], {
    cwd: databasePackageDir,
    env: {
      ...environment,
      DATABASE_URL: url,
      GLANTRI_DB_APPLICATION_URL: environment.DATABASE_URL,
    },
  });
}

function seed(): void {
  const { environment, validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  printPreflight("seed", "application", validated);
  run("node", ["--import", "tsx", "./scripts/seedLocalDev.ts"], {
    cwd: databasePackageDir,
    env: { ...environment, DATABASE_URL: environment.DATABASE_URL },
  });
}

function backup(): void {
  const { environment, validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  printPreflight("backup", "application", validated);
  run("node", ["--import", "tsx", "./scripts/backupLocalDb.ts"], {
    cwd: databasePackageDir,
    env: { ...environment, DATABASE_URL: environment.DATABASE_URL },
  });
}

function integrationTest(): void {
  const { environment, validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  migrateTarget("test", environment, validated);
  printPreflight("integration-test", "test", validated);
  run("pnpm", ["--filter", "@glantri/database", "test"], {
    env: {
      ...environment,
      DATABASE_URL_TEST: environment.DATABASE_URL_TEST,
    },
  });
}

function execute(): void {
  const separator = process.argv.indexOf("--");

  if (separator < 0 || !process.argv[separator + 1]) {
    fail("Provide a command after --, for example pnpm db:task:exec -- pnpm dev.");
  }

  const { environment, validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  printPreflight("application", "application", validated);
  printPreflight("application-test", "test", validated);
  run(process.argv[separator + 1]!, process.argv.slice(separator + 2), { env: environment });
}

function verify(): void {
  const { validated } = loadValidatedEnvironment();
  verifyOwnedRunningContainer(validated);
  waitForPostgres(validated.container);
  printPreflight("verify", "application", validated);
  printPreflight("verify", "test", validated);

  for (const database of [validated.application.database, validated.test.database]) {
    const result = run(
      "docker",
      [
        "exec",
        validated.container,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-tAc",
        "SELECT current_database()",
      ],
      { capture: true },
    );

    if (result !== database) {
      fail(`Database identity verification failed for ${database}.`);
    }
  }

  console.log(
    `Task database ownership and PostgreSQL 16 container ${validated.container} verified.`,
  );
}

function cleanup(): void {
  const configured = parseEnvironmentFile(defaultEnvironmentFile);
  const validated = validateTaskDatabaseEnvironment(configured);
  const inspection = inspectContainer(validated.container);

  if (inspection) {
    assertOwnedContainer(inspection, {
      applicationDatabase: validated.application.database,
      container: validated.container,
      owner: validated.owner,
    });
    printPreflight("cleanup", "application", validated);
    printPreflight("cleanup", "test", validated);
    run("docker", ["rm", "-f", validated.container]);
  }

  unlinkSync(defaultEnvironmentFile);
  console.log(`Removed disposable task target ${validated.container} and .env.task.`);
}

const command = process.argv[2];

try {
  switch (command) {
    case "backup":
      backup();
      break;
    case "cleanup":
      cleanup();
      break;
    case "exec":
      execute();
      break;
    case "migrate":
      migrate();
      break;
    case "reset":
      reset();
      break;
    case "seed":
      seed();
      break;
    case "setup":
      setup();
      break;
    case "test":
      integrationTest();
      break;
    case "verify":
      verify();
      break;
    default:
      fail("Expected one of: setup, verify, migrate, reset, seed, backup, test, exec, cleanup.");
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Task database command failed: ${message}`);
  process.exitCode = 1;
}
