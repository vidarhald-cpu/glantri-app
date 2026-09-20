import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { streamDumpToFile } from "../src/streamingPgDump";
import { assertWorktreeDatabaseRuntimeSafety } from "../src/worktreeDatabaseRuntimeSafety";

function loadDatabaseEnv(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const packageDir = resolve(scriptDir, "..");
  const repoRoot = resolve(packageDir, "..", "..");

  for (const path of [resolve(repoRoot, ".env"), resolve(packageDir, ".env")]) {
    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
}

function getRequiredDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Check the repo root .env or packages/database/.env.");
  }

  return databaseUrl;
}

function buildTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function main(): Promise<void> {
  loadDatabaseEnv();
  const worktreeEnvironment = assertWorktreeDatabaseRuntimeSafety();

  const databaseUrl = getRequiredDatabaseUrl();
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const host = parsed.hostname || "localhost";
  const port = parsed.port || "5432";

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, "..", "..", "..");
  const backupDir = resolve(repoRoot, "data", "snapshots", "local-db");
  const backupFile = resolve(backupDir, `${databaseName}-${buildTimestamp(new Date())}.sql`);

  await mkdir(backupDir, {
    recursive: true,
  });

  const dumpArgs = [
    "--dbname",
    databaseName,
    "--host",
    host,
    "--port",
    port,
    "--username",
    username,
    "--format=plain",
    "--no-owner",
    "--no-privileges",
  ];

  const localDump = await streamDumpToFile({
    args: dumpArgs,
    command: "pg_dump",
    destination: backupFile,
    env: {
      ...process.env,
      PGPASSWORD: password,
    },
  });

  let bytesWritten = localDump.bytesWritten;

  if (localDump.error?.code === "ENOENT") {
    const container = worktreeEnvironment?.container ?? "glantri-postgres";
    const dockerDumpArgs = dumpArgs.map((argument, index) => {
      if (dumpArgs[index - 1] === "--host") {
        return "localhost";
      }

      if (dumpArgs[index - 1] === "--port") {
        return "5432";
      }

      return argument;
    });
    const dockerDump = await streamDumpToFile({
      args: ["exec", "-e", `PGPASSWORD=${password}`, container, "pg_dump", ...dockerDumpArgs],
      command: "docker",
      destination: backupFile,
      env: process.env,
    });

    if (dockerDump.error) {
      throw dockerDump.error;
    }

    if (dockerDump.status !== 0) {
      throw new Error(dockerDump.stderr || "Docker pg_dump backup failed.");
    }

    bytesWritten = dockerDump.bytesWritten;
  } else if (localDump.error) {
    throw localDump.error;
  } else if (localDump.status !== 0) {
    throw new Error(localDump.stderr || "pg_dump backup failed.");
  }

  if (bytesWritten <= 0) {
    await rm(backupFile, { force: true });
    throw new Error("pg_dump produced an empty backup; refusing to present it as a valid backup.");
  }

  console.log(`Local database backup written to ${backupFile} (${bytesWritten} bytes)`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:backup failed: ${message}`);
  process.exitCode = 1;
});
