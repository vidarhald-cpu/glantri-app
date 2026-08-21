import { defineConfig } from "prisma/config";

import { assertWorktreeDatabaseRuntimeSafety } from "./src/worktreeDatabaseRuntimeSafety";

assertWorktreeDatabaseRuntimeSafety();

export default defineConfig({
  migrations: {
    path: "prisma/migrations",
    seed: "node --import tsx ../../scripts/database/guardedDatabaseCommand.ts seed",
  },
  schema: "prisma/schema.prisma",
});
