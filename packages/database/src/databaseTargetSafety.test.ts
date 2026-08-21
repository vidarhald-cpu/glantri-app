import { describe, expect, it } from "vitest";

import {
  formatDatabaseTarget,
  isProtectedSharedDatabase,
  parseDatabaseTarget,
  validateTaskDatabaseEnvironment,
  validateTestDatabaseTarget,
} from "./databaseTargetSafety";

const taskEnvironment = {
  DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:55432/glantri_task_issue_312_a1b2",
  DATABASE_URL_TEST:
    "postgresql://postgres:secret@127.0.0.1:55432/glantri_task_issue_312_a1b2_test",
  GLANTRI_DB_CONTAINER: "glantri-task-issue-312-a1b2-pg16",
  GLANTRI_DB_MODE: "task",
  GLANTRI_DB_OWNER: "issue-312-a1b2",
  GLANTRI_DB_TASK: "312",
};

describe("database target safety", () => {
  it("identifies the protected shared local database without exposing credentials", () => {
    const target = parseDatabaseTarget(
      "DATABASE_URL",
      "postgresql://private-user:private-password@localhost:5432/glantri",
    );

    expect(isProtectedSharedDatabase(target)).toBe(true);
    expect(formatDatabaseTarget(target)).toBe("host=localhost port=5432 database=glantri");
    expect(formatDatabaseTarget(target)).not.toContain("private");
  });

  it("accepts explicitly owned, distinct application and test databases", () => {
    expect(validateTaskDatabaseEnvironment(taskEnvironment)).toMatchObject({
      application: { database: "glantri_task_issue_312_a1b2" },
      owner: "issue-312-a1b2",
      test: { database: "glantri_task_issue_312_a1b2_test" },
    });
  });

  it.each([
    [{ ...taskEnvironment, DATABASE_URL: undefined }, "DATABASE_URL is required"],
    [{ ...taskEnvironment, DATABASE_URL_TEST: undefined }, "DATABASE_URL_TEST is required"],
    [{ ...taskEnvironment, GLANTRI_DB_MODE: undefined }, "GLANTRI_DB_MODE"],
    [{ ...taskEnvironment, GLANTRI_DB_TASK: undefined }, "GLANTRI_DB_TASK"],
    [{ ...taskEnvironment, GLANTRI_DB_OWNER: undefined }, "GLANTRI_DB_OWNER"],
    [
      { ...taskEnvironment, DATABASE_URL: "postgresql://postgres:x@localhost:5432/glantri" },
      "protected shared database",
    ],
    [
      {
        ...taskEnvironment,
        DATABASE_URL_TEST: "postgresql://postgres:x@127.0.0.1:55432/glantri_task_someone_else_test",
      },
      "ownership mismatch",
    ],
  ])(
    "fails closed for missing, protected, or mismatched task ownership",
    (environment, message) => {
      expect(() => validateTaskDatabaseEnvironment(environment)).toThrow(message);
    },
  );

  it("refuses normal development and production-like test targets", () => {
    expect(() =>
      validateTestDatabaseTarget("postgresql://postgres:x@localhost:5432/glantri"),
    ).toThrow("protected shared database");
    expect(() =>
      validateTestDatabaseTarget("postgresql://postgres:x@db.example.com:5432/glantri_test"),
    ).toThrow("local disposable PostgreSQL target");
    expect(() =>
      validateTestDatabaseTarget("postgresql://postgres:x@localhost:5432/glantri_dev"),
    ).toThrow("must end in _test");
  });

  it("refuses a test URL that aliases the application database", () => {
    const url = "postgresql://postgres:x@127.0.0.1:55432/glantri_task_issue_312_a1b2_test";

    expect(() => validateTestDatabaseTarget(url, url)).toThrow(
      "must not point at the same database",
    );
  });
});
