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

    // Independently computed expected value (not re-derived through the function under test):
    // basename("repository") + "-" + sha256("/tmp/glantri-312-cross-a/repository").hex.slice(0, 8).
    expect(validated.worktreeKey).toBe("repository-f3808e29");
    expect(validated.owner).toBe("issue-312-repository-f3808e29");
    expect(validated.application.database).toBe("glantri_task_issue_312_repository_f3808e29");
    expect(validated.test.database).toBe("glantri_task_issue_312_repository_f3808e29_test");
    expect(() =>
      assertCurrentWorktreeTaskContainer(inspection(worktreeA), validated),
    ).not.toThrow();
    expect(() =>
      assertCurrentWorktreeTaskContainer(
        inspection(worktreeA, {
          "glantri.db.worktree": deriveCurrentWorktreeTaskDatabaseIdentity(worktreeB, "312")
            .worktreeKey,
        }),
        validated,
      ),
    ).toThrow("current worktree");
  });

  it("derives distinct keys, owners, containers, and ports for sibling worktrees sharing a parent directory", () => {
    const sibling1 = "/private/tmp/glantri-260-builder";
    const sibling2 = "/private/tmp/glantri-260-qa";

    const identity1 = deriveCurrentWorktreeTaskDatabaseIdentity(sibling1, "260");
    const identity2 = deriveCurrentWorktreeTaskDatabaseIdentity(sibling2, "260");

    expect(identity1.worktreeKey).not.toBe(identity2.worktreeKey);
    expect(identity1.owner).not.toBe(identity2.owner);
    expect(identity1.container).not.toBe(identity2.container);
    expect(identity1.applicationDatabase).not.toBe(identity2.applicationDatabase);
    expect(identity1.testDatabase).not.toBe(identity2.testDatabase);

    // Stable/deterministic: deriving again from the same path yields the same identity.
    expect(deriveCurrentWorktreeTaskDatabaseIdentity(sibling1, "260")).toEqual(identity1);
  });

  it("keeps database names within PostgreSQL's 63-byte limit and preserves the digest for a long Codex-style task id", () => {
    // Reproduces the QA #260 regression scenario: a long task id under the canonical Codex
    // worktree layout previously produced a 28-character worktree key, pushing the composed
    // database name past 63 bytes and losing the trailing digest to PostgreSQL's own silent
    // truncation.
    const longTaskRepositoryRoot = "/private/tmp/glantri-app-forgejo-copy-a";
    const identity = deriveCurrentWorktreeTaskDatabaseIdentity(
      longTaskRepositoryRoot,
      "codex-24-admin-skill-reference",
    );
    const expectedDigest = identity.worktreeKey.slice(-8);

    expect(identity.applicationDatabase.length).toBeLessThanOrEqual(63);
    expect(identity.testDatabase.length).toBeLessThanOrEqual(63);
    expect(identity.testDatabase).toBe(`${identity.applicationDatabase}_test`);
    expect(identity.applicationDatabase.endsWith(expectedDigest)).toBe(true);
    expect(identity.testDatabase.endsWith(`${expectedDigest}_test`)).toBe(true);
    expect(identity.applicationDatabase).not.toBe(identity.testDatabase);
  });

  it("keeps distinct database names for two long, overflowing sibling worktrees after truncation", () => {
    const overflowSibling1 = "/private/tmp/glantri-app-forgejo-codex-24-admin-skill-reference-a";
    const overflowSibling2 = "/private/tmp/glantri-app-forgejo-codex-24-admin-skill-reference-b";
    const task = "codex-24-admin-skill-reference";

    const identity1 = deriveCurrentWorktreeTaskDatabaseIdentity(overflowSibling1, task);
    const identity2 = deriveCurrentWorktreeTaskDatabaseIdentity(overflowSibling2, task);

    expect(identity1.applicationDatabase.length).toBeLessThanOrEqual(63);
    expect(identity2.applicationDatabase.length).toBeLessThanOrEqual(63);
    expect(identity1.testDatabase.length).toBeLessThanOrEqual(63);
    expect(identity2.testDatabase.length).toBeLessThanOrEqual(63);
    expect(identity1.applicationDatabase).not.toBe(identity2.applicationDatabase);
    expect(identity1.testDatabase).not.toBe(identity2.testDatabase);

    // Stability holds under overflow too.
    expect(deriveCurrentWorktreeTaskDatabaseIdentity(overflowSibling1, task)).toEqual(identity1);
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
