import { PrismaClient } from "@prisma/client";

import { buildTransactionOptions } from "./transactionOptions";
import { assertWorktreeDatabaseRuntimeSafety } from "./worktreeDatabaseRuntimeSafety";

assertWorktreeDatabaseRuntimeSafety();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
    transactionOptions: buildTransactionOptions(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
