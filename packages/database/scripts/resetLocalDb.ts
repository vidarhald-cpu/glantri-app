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

function main(): void {
  loadDatabaseEnv();

  if (!process.argv.includes("--confirm")) {
    console.error("Refusing to reset the local database without --confirm.");
    console.error("This command destroys local auth users, sessions, characters, campaigns, scenarios, and other Postgres-backed data.");
    console.error("Recommended workflow: pnpm db:backup && pnpm db:reset:local -- --confirm && pnpm db:seed");
    process.exitCode = 1;
    return;
  }

  const result = spawnSync(
    "pnpm",
    ["exec", "prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"],
    {
      cwd: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
      stdio: "inherit"
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return;
  }

  console.log("Local database reset complete.");
  console.log("Next step: pnpm db:seed");
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:reset:local failed: ${message}`);
  process.exitCode = 1;
}
