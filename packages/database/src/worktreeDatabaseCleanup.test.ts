import { describe, expect, it } from "vitest";

import type { TaskDatabaseEnvironment } from "./databaseTargetSafety";
import {
  deriveCurrentWorktreeTaskDatabaseIdentity,
  taskContainerRemovalArguments,
  validateCurrentWorktreeTaskDatabaseEnvironment,
  type TaskContainerInspection,
} from "./worktreeDatabaseOwnership";

const repositoryRoot = "/tmp/glantri-55-cleanup/repository";

function validatedEnvironment() {
  const identity = deriveCurrentWorktreeTaskDatabaseIdentity(repositoryRoot, "55");
  const environment: Required<TaskDatabaseEnvironment> = {
    DATABASE_URL: `postgresql://postgres:secret@127.0.0.1:55432/${identity.applicationDatabase}`,
    DATABASE_URL_TEST: `postgresql://postgres:secret@127.0.0.1:55432/${identity.testDatabase}`,
    GLANTRI_DB_CONTAINER: identity.container,
    GLANTRI_DB_MODE: "task",
    GLANTRI_DB_OWNER: identity.owner,
    GLANTRI_DB_TASK: identity.task,
  };

  return validateCurrentWorktreeTaskDatabaseEnvironment(repositoryRoot, environment);
}

function inspection(overrides: Record<string, string> = {}): TaskContainerInspection {
  const validated = validatedEnvironment();

  return {
    Config: {
      Image: "postgres:16",
      Labels: {
        "glantri.db.database": validated.application.database,
        "glantri.db.kind": "disposable-task",
        "glantri.db.owner": validated.owner,
        "glantri.db.task": validated.task,
        "glantri.db.worktree": validated.worktreeKey,
        ...overrides,
      },
    },
    NetworkSettings: { Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }] } },
    State: { Running: true },
  };
}

describe("owned task database cleanup", () => {
  it("removes anonymous volumes only through the exact verified task container", () => {
    const validated = validatedEnvironment();

    expect(taskContainerRemovalArguments(inspection(), validated)).toEqual([
      "rm",
      "--force",
      "--volumes",
      validated.container,
    ]);
  });

  it("refuses foreign ownership before producing any removal command", () => {
    const validated = validatedEnvironment();

    expect(() =>
      taskContainerRemovalArguments(
        inspection({ "glantri.db.owner": "issue-55-another-worktree" }),
        validated,
      ),
    ).toThrow("not the expected PostgreSQL 16 target");
  });
});
