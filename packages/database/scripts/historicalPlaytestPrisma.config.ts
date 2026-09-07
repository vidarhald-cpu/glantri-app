import { resolve } from "node:path";

import { defineConfig } from "prisma/config";

import {
  repositoryRoot,
  validateTargetEndpoint,
  type TargetPurpose,
} from "../../../scripts/recovery/historicalPlaytestSafety";

const purpose = process.env.R5C_TARGET_PURPOSE as TargetPurpose | undefined;
const targetUrl = process.env.R5C_TARGET_URL;
const targetContainer = process.env.R5C_TARGET_CONTAINER;

if (!purpose || !targetUrl || !targetContainer) {
  throw new Error(
    "R5C_TARGET_PURPOSE, R5C_TARGET_URL, and R5C_TARGET_CONTAINER are required for recovery migration.",
  );
}

validateTargetEndpoint(targetUrl, purpose, targetContainer);
process.env.DATABASE_URL = targetUrl;

export default defineConfig({
  datasource: { url: targetUrl },
  migrations: {
    path: resolve(repositoryRoot, "packages", "database", "prisma", "migrations"),
  },
  schema: resolve(repositoryRoot, "packages", "database", "prisma", "schema.prisma"),
});
