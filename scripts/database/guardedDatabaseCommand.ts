import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  formatDatabaseTarget,
  isProtectedSharedDatabase,
  parseDatabaseTarget,
} from "../../packages/database/src/databaseTargetSafety";
import {
  readTaskDatabaseEnvironmentFile,
  validateCurrentWorktreeTaskDatabaseEnvironment,
  type ValidatedCurrentWorktreeTaskDatabaseEnvironment,
} from "../../packages/database/src/worktreeDatabaseOwnership";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const databasePackageDir = resolve(repoRoot, "packages", "database");
const migrationCompatibilityChecker = resolve(scriptDir, "checkMigrationCompatibility.ts");

function fail(message: string): never {
  throw new Error(message);
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseEnvironmentFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      fail(`Invalid environment entry in ${path}.`);
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function isLinkedWorktree(): boolean {
  const gitMarker = resolve(repoRoot, ".git");
  return existsSync(gitMarker) && lstatSync(gitMarker).isFile();
}

function loadPrimaryEnvironment(): NodeJS.ProcessEnv {
  const rootEnvironment = parseEnvironmentFile(resolve(repoRoot, ".env"));
  const packageEnvironment = parseEnvironmentFile(resolve(databasePackageDir, ".env"));

  return {
    ...rootEnvironment,
    ...packageEnvironment,
    ...process.env,
  };
}

function loadWorktreeEnvironment(): {
  environment: NodeJS.ProcessEnv;
  validated: ValidatedCurrentWorktreeTaskDatabaseEnvironment;
} {
  const path = resolve(repoRoot, ".env.task");
  const configured = readTaskDatabaseEnvironmentFile(path);

  for (const name of [
    "DATABASE_URL",
    "DATABASE_URL_TEST",
    "GLANTRI_DB_MODE",
    "GLANTRI_DB_TASK",
    "GLANTRI_DB_OWNER",
    "GLANTRI_DB_CONTAINER",
  ] as const) {
    if (process.env[name] && configured[name] && process.env[name] !== configured[name]) {
      fail(`${name} conflicts with .env.task. Clear the inherited value; the target is ambiguous.`);
    }
  }

  const validated = validateCurrentWorktreeTaskDatabaseEnvironment(repoRoot, configured);
  return { environment: { ...process.env, ...configured }, validated };
}

function printPrimaryPreflight(action: string, environment: NodeJS.ProcessEnv): void {
  const target = parseDatabaseTarget("DATABASE_URL", environment.DATABASE_URL);
  const state = isProtectedSharedDatabase(target)
    ? "protected-shared-user-state"
    : "custom-primary-checkout";
  console.log(
    `Database preflight: action=${action} owner=${state} ${formatDatabaseTarget(target)}`,
  );
}

function printWorktreePreflight(
  action: string,
  validated: ValidatedCurrentWorktreeTaskDatabaseEnvironment,
): void {
  console.log(
    `Database preflight: action=${action} owner=${validated.owner} ${formatDatabaseTarget(validated.application)}`,
  );
}

function guardedEnvironment(action: string): NodeJS.ProcessEnv {
  if (isLinkedWorktree()) {
    const { environment, validated } = loadWorktreeEnvironment();
    printWorktreePreflight(action, validated);
    return environment;
  }

  const environment = loadPrimaryEnvironment();
  printPrimaryPreflight(action, environment);
  return environment;
}

function requireConfirmation(): void {
  if (!process.argv.includes("--confirm")) {
    fail("Refusing to reset a database without --confirm.");
  }
}

function runMigrationCompatibilityCheck(environment: NodeJS.ProcessEnv): void {
  run("node", ["--import", "tsx", migrationCompatibilityChecker], { env: environment });
}

function main(): void {
  const command = process.argv[2];

  if (isLinkedWorktree()) {
    const taskRunner = resolve(scriptDir, "worktreeDatabase.ts");

    switch (command) {
      case "backup":
      case "seed":
        run("node", ["--import", "tsx", taskRunner, command]);
        return;
      case "dev":
        run("node", ["--import", "tsx", taskRunner, "exec", "--", "pnpm", "exec", "turbo", "dev"]);
        return;
      case "migrate":
        run("node", ["--import", "tsx", taskRunner, "migrate", "--target", "application"]);
        return;
      case "reset":
        requireConfirmation();
        run("node", [
          "--import",
          "tsx",
          taskRunner,
          "reset",
          "--target",
          "application",
          "--confirm",
        ]);
        return;
      default:
        break;
    }
  }

  switch (command) {
    case "backup": {
      const environment = guardedEnvironment("backup");
      run("node", ["--import", "tsx", "./scripts/backupLocalDb.ts"], {
        cwd: databasePackageDir,
        env: environment,
      });
      return;
    }
    case "dev": {
      const environment = guardedEnvironment("application-dev");
      runMigrationCompatibilityCheck(environment);
      run("pnpm", ["exec", "turbo", "dev"], { env: environment });
      return;
    }
    case "down":
    case "up": {
      if (isLinkedWorktree()) {
        fail(
          `pnpm db:${command} targets the protected normal container and is disabled in linked worktrees. Use db:task:setup or db:task:cleanup.`,
        );
      }

      run("docker", [
        "compose",
        command === "up" ? "up" : "down",
        ...(command === "up" ? ["-d", "postgres"] : []),
      ]);
      return;
    }
    case "migrate": {
      const environment = guardedEnvironment("migrate");
      runMigrationCompatibilityCheck(environment);
      run("pnpm", ["exec", "prisma", "migrate", "dev"], {
        cwd: databasePackageDir,
        env: environment,
      });
      return;
    }
    case "reset": {
      requireConfirmation();
      const environment = guardedEnvironment("reset");
      run(
        "pnpm",
        ["exec", "prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"],
        { cwd: databasePackageDir, env: environment },
      );
      console.log("Database reset complete. Next step: pnpm db:seed");
      return;
    }
    case "seed": {
      const environment = guardedEnvironment("seed");
      runMigrationCompatibilityCheck(environment);
      run("node", ["--import", "tsx", "./scripts/seedLocalDev.ts"], {
        cwd: databasePackageDir,
        env: environment,
      });
      return;
    }
    case "readiness": {
      const environment = guardedEnvironment("release-readiness");
      runMigrationCompatibilityCheck(environment);
      return;
    }
    default:
      fail("Expected one of: up, down, migrate, backup, reset, seed, dev, readiness.");
  }
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Database safety guard failed: ${message}`);
  process.exitCode = 1;
}
