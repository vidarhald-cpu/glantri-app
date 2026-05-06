import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function loadDatabaseEnv(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const packageDir = resolve(scriptDir, "..");
  const repoRoot = resolve(packageDir, "..", "..");

  process.loadEnvFile(resolve(repoRoot, ".env"));
  process.loadEnvFile(resolve(packageDir, ".env"));
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

function runDumpCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): { error?: NodeJS.ErrnoException | null; status: number | null; stderr: string; stdout: Buffer } {
  const result = spawnSync(command, args, {
    env,
    encoding: "buffer"
  });

  return {
    error: result.error,
    status: result.status,
    stderr: Buffer.from(result.stderr ?? []).toString("utf8"),
    stdout: Buffer.from(result.stdout ?? [])
  };
}

async function main(): Promise<void> {
  loadDatabaseEnv();

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
    recursive: true
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
    "--no-privileges"
  ];

  const localDump = runDumpCommand("pg_dump", dumpArgs, {
    ...process.env,
    PGPASSWORD: password
  });

  let dumpOutput = localDump.stdout;
  let dumpError = localDump.stderr;

  if (localDump.error?.code === "ENOENT") {
    const dockerDump = runDumpCommand(
      "docker",
      ["exec", "-e", `PGPASSWORD=${password}`, "glantri-postgres", "pg_dump", ...dumpArgs],
      process.env
    );

    dumpOutput = dockerDump.stdout;
    dumpError = dockerDump.stderr;

    if (dockerDump.error) {
      throw dockerDump.error;
    }

    if (dockerDump.status !== 0) {
      throw new Error(dumpError || "Docker pg_dump backup failed.");
    }
  } else if (localDump.error) {
    throw localDump.error;
  } else if (localDump.status !== 0) {
    throw new Error(dumpError || "pg_dump backup failed.");
  }

  await writeFile(backupFile, dumpOutput);

  console.log(`Local database backup written to ${backupFile}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:backup failed: ${message}`);
  process.exitCode = 1;
});
