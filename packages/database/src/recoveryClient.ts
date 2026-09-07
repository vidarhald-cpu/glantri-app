import { Prisma, PrismaClient } from "@prisma/client";

import { assertWorktreeDatabaseRuntimeSafety } from "./worktreeDatabaseRuntimeSafety";

export type RecoveryPrismaClient = PrismaClient;
export type RecoveryTransactionClient = Prisma.TransactionClient;

export function createRecoveryClient(url: string): PrismaClient {
  // Preserve the repository-wide linked-worktree guard before the narrower R5C checks.
  assertWorktreeDatabaseRuntimeSafety();
  return new PrismaClient({ datasourceUrl: url, log: ["error"] });
}
