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
    validateTaskDatabaseEnvironment(process.env);
  }
}
