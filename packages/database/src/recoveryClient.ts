import { Prisma, PrismaClient } from "@prisma/client";

import { parseDatabaseTarget } from "./databaseTargetSafety";
import { deriveCurrentWorktreeTaskDatabaseIdentity } from "./worktreeDatabaseOwnership";
import {
  assertWorktreeDatabaseRuntimeSafety,
  findRepositoryRoot,
} from "./worktreeDatabaseRuntimeSafety";

export type RecoveryPrismaClient = PrismaClient;
export type RecoveryTransactionClient = Prisma.TransactionClient;

export interface RecoveryClientEndpoint {
  database: string;
  host: string;
  issue: string;
  port: string;
  worktreeKey: string;
}

export function assertRecoveryClientEndpoint(url: string, expected: RecoveryClientEndpoint): void {
  const repository = findRepositoryRoot(process.cwd());

  if (!repository?.linked) {
    throw new Error("Historical recovery database access requires a linked task worktree.");
  }

  const current = deriveCurrentWorktreeTaskDatabaseIdentity(repository.root, expected.issue);
  if (current.worktreeKey !== expected.worktreeKey) {
    throw new Error(
      `Recovery database ownership belongs to worktree ${expected.worktreeKey}, not current worktree ${current.worktreeKey}.`,
    );
  }

  const actual = parseDatabaseTarget("recovery database URL", url);
  if (
    actual.database !== expected.database ||
    actual.host !== expected.host ||
    actual.port !== expected.port
  ) {
    throw new Error(
      "Explicit recovery database URL does not match validated current-worktree ownership.",
    );
  }
}

export function createRecoveryClient(url: string, expected: RecoveryClientEndpoint): PrismaClient {
  assertRecoveryClientEndpoint(url, expected);

  // Preserve the repository-wide linked-worktree environment guard as an additional boundary.
  assertWorktreeDatabaseRuntimeSafety();
  return new PrismaClient({ datasourceUrl: url, log: ["error"] });
}
