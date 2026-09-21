import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  ownerDatabasePrefix,
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
  // The key must uniquely identify this worktree's own filesystem location, not just its
  // parent directory: sibling worktrees for the same issue (for example a Builder at
  // /private/tmp/glantri-260-builder and QA at /private/tmp/glantri-260-qa) share a parent
  // directory but must never collide on owner marker, container name, or port. A directory
  // basename alone is also not sufficient (two worktrees can share a leaf name under
  // different parents, as in a `.../<random>/glantri-app-forgejo` layout), so the key
  // combines a human-readable label with a short digest of the full resolved path, which is
  // guaranteed distinct for any two distinct worktree locations.
  const resolvedRoot = resolve(repositoryRoot);
  const label = basename(resolvedRoot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // The digest is always a fixed-length 8 hex-character SHA-256 prefix, so it (and therefore
  // the combined key) can never be empty; there is no reachable failure mode here to guard.
  const digest = createHash("sha256").update(resolvedRoot).digest("hex").slice(0, 8);

  return label ? `${label}-${digest}` : digest;
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
  // Container names and ports are not subject to PostgreSQL's 63-byte identifier limit, so the
  // container keeps the full, untruncated owner for readability. Database names go through
  // `ownerDatabasePrefix`, the single shared derivation also used by `validateTaskDatabaseEnvironment`,
  // which truncates only the human-readable label and always preserves the trailing worktree
  // digest that guarantees distinctness between worktrees (see databaseTargetSafety.ts).
  const applicationDatabase = ownerDatabasePrefix(owner);

  return {
    applicationDatabase,
    container: `glantri-task-${owner}-pg16`,
    owner,
    task: normalizedTask,
    testDatabase: `${applicationDatabase}_test`,
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
