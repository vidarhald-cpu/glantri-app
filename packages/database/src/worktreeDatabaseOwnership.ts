import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";

import {
  validateTaskDatabaseEnvironment,
  type TaskDatabaseEnvironment,
  type ValidatedTaskDatabaseEnvironment,
} from "./databaseTargetSafety";

export interface CurrentWorktreeTaskDatabaseIdentity {
  applicationDatabase: string;
  container: string;
  owner: string;
  task: string;
  testDatabase: string;
  worktreeKey: string;
}

export interface TaskContainerInspection {
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

export interface ValidatedCurrentWorktreeTaskDatabaseEnvironment extends ValidatedTaskDatabaseEnvironment {
  worktreeKey: string;
}

function normalizeWorktreeKey(repositoryRoot: string): string {
  const key = basename(dirname(repositoryRoot))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!key) {
    throw new Error("Unable to derive a stable identity for the current linked worktree.");
  }

  return key;
}

export function deriveCurrentWorktreeTaskDatabaseIdentity(
  repositoryRoot: string,
  task: string,
): CurrentWorktreeTaskDatabaseIdentity {
  const normalizedTask = task.trim();

  if (!normalizedTask || !/^[a-zA-Z0-9-]+$/.test(normalizedTask)) {
    throw new Error("Task identity may contain only letters, numbers, and hyphens.");
  }

  const worktreeKey = normalizeWorktreeKey(repositoryRoot);
  const owner = `issue-${normalizedTask}-${worktreeKey}`;
  const databaseOwner = owner.replace(/[^a-z0-9]+/g, "_");

  return {
    applicationDatabase: `glantri_task_${databaseOwner}`,
    container: `glantri-task-${owner}-pg16`,
    owner,
    task: normalizedTask,
    testDatabase: `glantri_task_${databaseOwner}_test`,
    worktreeKey,
  };
}

export function validateCurrentWorktreeTaskDatabaseEnvironment(
  repositoryRoot: string,
  environment: TaskDatabaseEnvironment,
): ValidatedCurrentWorktreeTaskDatabaseEnvironment {
  const validated = validateTaskDatabaseEnvironment(environment);
  const expected = deriveCurrentWorktreeTaskDatabaseIdentity(repositoryRoot, validated.task);

  if (
    validated.owner !== expected.owner ||
    validated.container !== expected.container ||
    validated.application.database !== expected.applicationDatabase ||
    validated.test.database !== expected.testDatabase
  ) {
    throw new Error(
      `Task database ownership belongs to ${validated.owner}, not current worktree ${expected.worktreeKey}. Run setup in this worktree; never copy .env.task.`,
    );
  }

  return { ...validated, worktreeKey: expected.worktreeKey };
}

export function assertTaskEnvironmentFileSecurity(path: string): void {
  const status = lstatSync(path);
  const permissions = status.mode & 0o777;

  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(
      `Task database environment ${path} must be a regular file owned by this worktree.`,
    );
  }

  if (permissions !== 0o600) {
    throw new Error(
      `Task database environment ${path} must use mode 0600; found ${permissions.toString(8).padStart(4, "0")}. Fix permissions before setup or database access.`,
    );
  }
}

export function readTaskDatabaseEnvironmentFile(path: string): TaskDatabaseEnvironment {
  if (!existsSync(path)) {
    throw new Error(
      `Task database environment is missing at ${path}. Run pnpm db:task:setup -- --task <issue>.`,
    );
  }

  assertTaskEnvironmentFileSecurity(path);
  const environment: Record<string, string> = {};

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      throw new Error(`Invalid task database environment entry in ${path}.`);
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

export function containerPort(inspection: TaskContainerInspection): string {
  const bindings = inspection.NetworkSettings?.Ports?.["5432/tcp"];
  const port = bindings?.[0]?.HostPort;

  if (!port) {
    throw new Error("Task PostgreSQL container does not expose an explicit loopback port.");
  }

  return port;
}

export function assertCurrentWorktreeTaskContainer(
  inspection: TaskContainerInspection,
  expected: ValidatedCurrentWorktreeTaskDatabaseEnvironment,
): void {
  const labels = inspection.Config?.Labels ?? {};

  if (
    inspection.Config?.Image !== "postgres:16" ||
    labels["glantri.db.kind"] !== "disposable-task" ||
    labels["glantri.db.owner"] !== expected.owner ||
    labels["glantri.db.database"] !== expected.application.database ||
    labels["glantri.db.task"] !== expected.task ||
    labels["glantri.db.worktree"] !== expected.worktreeKey
  ) {
    throw new Error(
      `Container ${expected.container} is not the expected PostgreSQL 16 target for current worktree ${expected.worktreeKey}.`,
    );
  }

  if (!inspection.State?.Running) {
    throw new Error(`Task container ${expected.container} is not running.`);
  }

  const boundPort = containerPort(inspection);

  if (boundPort !== expected.application.port) {
    throw new Error(
      `Task container port ${boundPort} does not match the owned target port ${expected.application.port}.`,
    );
  }
}

export function taskContainerRemovalArguments(
  inspection: TaskContainerInspection,
  expected: ValidatedCurrentWorktreeTaskDatabaseEnvironment,
): string[] {
  assertCurrentWorktreeTaskContainer(inspection, expected);
  return ["rm", "--force", "--volumes", expected.container];
}
