import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { TaskDatabaseEnvironment } from "./databaseTargetSafety";
import {
  assertCurrentWorktreeTaskContainer,
  readTaskDatabaseEnvironmentFile,
  validateCurrentWorktreeTaskDatabaseEnvironment,
  type TaskContainerInspection,
  type ValidatedCurrentWorktreeTaskDatabaseEnvironment,
} from "./worktreeDatabaseOwnership";

export function findRepositoryRoot(start: string): { linked: boolean; root: string } | null {
  let directory = resolve(start);

  while (true) {
    const gitMarker = resolve(directory, ".git");

    if (existsSync(gitMarker)) {
      return { linked: lstatSync(gitMarker).isFile(), root: directory };
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return null;
    }

    directory = parent;
  }
}

function inspectContainer(container: string): TaskContainerInspection {
  const result = spawnSync("docker", ["container", "inspect", container], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    throw new Error(`Unable to inspect owned task container ${container}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Owned task container ${container} is missing or cannot be inspected. Run pnpm db:task:verify.`,
    );
  }

  const inspections = JSON.parse(result.stdout) as TaskContainerInspection[];
  const inspection = inspections[0];

  if (!inspection) {
    throw new Error(`Owned task container ${container} returned no inspection metadata.`);
  }

  return inspection;
}

function hasDatabaseEnvironment(environment: NodeJS.ProcessEnv): boolean {
  return [
    "DATABASE_URL",
    "DATABASE_URL_TEST",
    "GLANTRI_DB_APPLICATION_URL",
    "GLANTRI_DB_CONTAINER",
    "GLANTRI_DB_MODE",
    "GLANTRI_DB_OWNER",
    "GLANTRI_DB_TASK",
  ].some((name) => Boolean(environment[name]));
}

function assertActiveEnvironmentMatchesFile(
  configured: TaskDatabaseEnvironment,
  active: NodeJS.ProcessEnv,
): void {
  const activeApplicationUrl = active.GLANTRI_DB_APPLICATION_URL ?? active.DATABASE_URL;

  for (const name of [
    "DATABASE_URL_TEST",
    "GLANTRI_DB_CONTAINER",
    "GLANTRI_DB_MODE",
    "GLANTRI_DB_OWNER",
    "GLANTRI_DB_TASK",
  ] as const) {
    if (active[name] !== configured[name]) {
      throw new Error(
        `${name} does not match the current worktree .env.task. Clear inherited values and use pnpm db:task:exec.`,
      );
    }
  }

  if (activeApplicationUrl !== configured.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL does not match the current worktree application target. Clear inherited values and use pnpm db:task:exec.",
    );
  }
}

export function validateWorktreeDatabaseRuntimeEnvironment(
  repositoryRoot: string,
  configured: TaskDatabaseEnvironment,
  active: NodeJS.ProcessEnv,
): ValidatedCurrentWorktreeTaskDatabaseEnvironment {
  validateCurrentWorktreeTaskDatabaseEnvironment(repositoryRoot, configured);
  assertActiveEnvironmentMatchesFile(configured, active);

  const applicationUrl = active.GLANTRI_DB_APPLICATION_URL ?? active.DATABASE_URL;
  const activeValidated = validateCurrentWorktreeTaskDatabaseEnvironment(repositoryRoot, {
    ...active,
    DATABASE_URL: applicationUrl,
  });

  if (active.DATABASE_URL !== applicationUrl && active.DATABASE_URL !== active.DATABASE_URL_TEST) {
    throw new Error(
      "Database command target must be the explicitly owned application or test database.",
    );
  }

  return activeValidated;
}

export function assertWorktreeDatabaseRuntimeSafety():
  | ValidatedCurrentWorktreeTaskDatabaseEnvironment
  | undefined {
  const repository =
    findRepositoryRoot(process.cwd()) ??
    (typeof __dirname === "string" ? findRepositoryRoot(__dirname) : null);

  if (!repository?.linked) {
    return undefined;
  }

  for (const path of [
    resolve(repository.root, ".env"),
    resolve(repository.root, "packages", "database", ".env"),
  ]) {
    if (existsSync(path)) {
      throw new Error(
        `Refusing database access because linked worktree contains ${path}. Remove it and use the generated .env.task.`,
      );
    }
  }

  if (!hasDatabaseEnvironment(process.env)) {
    return undefined;
  }

  const environmentPath = resolve(repository.root, ".env.task");
  const configured = readTaskDatabaseEnvironmentFile(environmentPath);
  const activeValidated = validateWorktreeDatabaseRuntimeEnvironment(
    repository.root,
    configured,
    process.env,
  );

  assertCurrentWorktreeTaskContainer(inspectContainer(activeValidated.container), activeValidated);

  return activeValidated;
}
