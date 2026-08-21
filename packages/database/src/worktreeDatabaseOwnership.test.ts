import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { TaskDatabaseEnvironment } from "./databaseTargetSafety";
import {
  assertCurrentWorktreeTaskContainer,
  assertTaskEnvironmentFileSecurity,
  deriveCurrentWorktreeTaskDatabaseIdentity,
  validateCurrentWorktreeTaskDatabaseEnvironment,
  type TaskContainerInspection,
} from "./worktreeDatabaseOwnership";
import { validateWorktreeDatabaseRuntimeEnvironment } from "./worktreeDatabaseRuntimeSafety";

function taskEnvironment(repositoryRoot: string): Required<TaskDatabaseEnvironment> {
  const identity = deriveCurrentWorktreeTaskDatabaseIdentity(repositoryRoot, "312");

  return {
    DATABASE_URL: `postgresql://postgres:secret@127.0.0.1:55432/${identity.applicationDatabase}`,
    DATABASE_URL_TEST: `postgresql://postgres:secret@127.0.0.1:55432/${identity.testDatabase}`,
    GLANTRI_DB_CONTAINER: identity.container,
    GLANTRI_DB_MODE: "task",
    GLANTRI_DB_OWNER: identity.owner,
    GLANTRI_DB_TASK: identity.task,
  };
}

function inspection(
  repositoryRoot: string,
  overrides: Record<string, string> = {},
): TaskContainerInspection {
  const identity = deriveCurrentWorktreeTaskDatabaseIdentity(repositoryRoot, "312");

  return {
    Config: {
      Image: "postgres:16",
      Labels: {
        "glantri.db.database": identity.applicationDatabase,
        "glantri.db.kind": "disposable-task",
        "glantri.db.owner": identity.owner,
        "glantri.db.task": identity.task,
        "glantri.db.worktree": identity.worktreeKey,
        ...overrides,
      },
    },
    NetworkSettings: { Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }] } },
    State: { Running: true },
  };
}

describe("current worktree database ownership", () => {
  const worktreeA = "/tmp/glantri-312-cross-a/repository";
  const worktreeB = "/tmp/glantri-312-cross-b/repository";

  it("accepts only the current worktree-derived task identity and container labels", () => {
    const validated = validateCurrentWorktreeTaskDatabaseEnvironment(
      worktreeA,
      taskEnvironment(worktreeA),
    );

    expect(validated.worktreeKey).toBe("glantri-312-cross-a");
    expect(() =>
      assertCurrentWorktreeTaskContainer(inspection(worktreeA), validated),
    ).not.toThrow();
    expect(() =>
      assertCurrentWorktreeTaskContainer(
        inspection(worktreeA, { "glantri.db.worktree": "glantri-312-cross-b" }),
        validated,
      ),
    ).toThrow("current worktree");
  });

  it("refuses a copied foreign .env.task before verify, reset, or cleanup can select its target", () => {
    expect(() =>
      validateCurrentWorktreeTaskDatabaseEnvironment(worktreeA, taskEnvironment(worktreeB)),
    ).toThrow("not current worktree");
  });

  it("refuses a foreign full environment on the normal client/runtime path", () => {
    expect(() =>
      validateWorktreeDatabaseRuntimeEnvironment(
        worktreeB,
        taskEnvironment(worktreeB),
        taskEnvironment(worktreeA),
      ),
    ).toThrow("does not match the current worktree .env.task");
  });

  it("refuses direct integration-test setup with missing ownership and a foreign test URL", () => {
    const foreign = taskEnvironment(worktreeA);

    expect(() =>
      validateWorktreeDatabaseRuntimeEnvironment(worktreeB, taskEnvironment(worktreeB), {
        DATABASE_URL_TEST: foreign.DATABASE_URL_TEST,
      }),
    ).toThrow("does not match the current worktree .env.task");
  });

  it("requires .env.task to remain a regular mode-0600 file", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "glantri-task-env-"));
    const path = resolve(directory, ".env.task");

    try {
      writeFileSync(path, "GLANTRI_DB_MODE=task\n", { mode: 0o600 });
      expect(() => assertTaskEnvironmentFileSecurity(path)).not.toThrow();
      chmodSync(path, 0o644);
      expect(() => assertTaskEnvironmentFileSecurity(path)).toThrow(
        "must use mode 0600; found 0644",
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
