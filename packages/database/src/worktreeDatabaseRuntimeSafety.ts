import { existsSync, lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { validateTaskDatabaseEnvironment } from "./databaseTargetSafety";

function findRepositoryRoot(start: string): { linked: boolean; root: string } | null {
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

export function assertWorktreeDatabaseRuntimeSafety(): void {
  const repository =
    findRepositoryRoot(process.cwd()) ??
    (typeof __dirname === "string" ? findRepositoryRoot(__dirname) : null);

  if (!repository?.linked) {
    return;
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

  if (process.env.DATABASE_URL) {
    const applicationUrl = process.env.GLANTRI_DB_APPLICATION_URL ?? process.env.DATABASE_URL;
    const validated = validateTaskDatabaseEnvironment({
      ...process.env,
      DATABASE_URL: applicationUrl,
    });

    if (
      process.env.GLANTRI_DB_APPLICATION_URL &&
      process.env.DATABASE_URL !== applicationUrl &&
      process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST
    ) {
      throw new Error(
        "Database command target must be the explicitly owned application or test database.",
      );
    }

    if (validated.application.database === validated.test.database) {
      throw new Error("Owned application and test databases must remain distinct.");
    }
  }
}
