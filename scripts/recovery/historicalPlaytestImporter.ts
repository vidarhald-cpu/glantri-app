import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createRecoveryClient } from "../../packages/database/src/recoveryClient";

import {
  analyzeSource,
  assertSourceMigrations,
  assertSourceReadOnly,
  assertSourceSchemaInventory,
  loadMappingInventory,
  prepareTarget,
  runImport,
  sourceCounts,
  assertSourceManifestCounts,
} from "./historicalPlaytestCore";
import {
  SOURCE_READER_ROLE,
  sanitizeError,
  sanitizedTarget,
  validateSourceEndpoint,
  validateTargetEndpoint,
  verifyBackupDirectory,
  type TargetPurpose,
} from "./historicalPlaytestSafety";

function fail(message: string): never {
  throw new Error(message);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArgument(name: string): string {
  const value = argument(name)?.trim();
  return value || fail(`${name} is required.`);
}

function purposeArgument(): TargetPurpose {
  const purpose = requiredArgument("--purpose");
  if (purpose !== "target-a" && purpose !== "target-b" && purpose !== "failure") {
    fail("--purpose must be target-a, target-b, or failure.");
  }
  return purpose;
}

function readerUrl(adminUrl: string): string {
  const parsed = new URL(adminUrl);
  parsed.username = SOURCE_READER_ROLE;
  parsed.password = "";
  return parsed.toString();
}

async function prepareSourceCommand(): Promise<void> {
  const backup = await verifyBackupDirectory(requiredArgument("--backup-dir"));
  const sourceUrl = requiredArgument("--source-url");
  const sourceContainer = requiredArgument("--source-container");
  const endpoint = validateSourceEndpoint(sourceUrl, sourceContainer);

  if (endpoint.username !== "postgres") {
    fail("Source preparation requires the disposable container's postgres administration role.");
  }

  const source = createRecoveryClient(sourceUrl);
  try {
    const inventory = loadMappingInventory();
    await assertSourceSchemaInventory(source, inventory);
    const counts = await sourceCounts(source, inventory);
    assertSourceManifestCounts(counts, backup.sourceManifest);
    await assertSourceMigrations(source, backup.sourceManifest, inventory.sourceMigrationHead);

    await source.$executeRawUnsafe(`
      DO $r5c$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${SOURCE_READER_ROLE}') THEN
          CREATE ROLE ${SOURCE_READER_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
        END IF;
      END
      $r5c$;
    `);
    await source.$executeRawUnsafe(
      `ALTER ROLE ${SOURCE_READER_ROLE} SET default_transaction_read_only = on`,
    );
    await source.$executeRawUnsafe(
      `REVOKE ALL ON DATABASE "${endpoint.database}" FROM ${SOURCE_READER_ROLE}`,
    );
    await source.$executeRawUnsafe(
      `GRANT CONNECT ON DATABASE "${endpoint.database}" TO ${SOURCE_READER_ROLE}`,
    );
    await source.$executeRawUnsafe(`REVOKE ALL ON SCHEMA public FROM ${SOURCE_READER_ROLE}`);
    await source.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${SOURCE_READER_ROLE}`);
    await source.$executeRawUnsafe(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${SOURCE_READER_ROLE}`,
    );
    await source.$executeRawUnsafe(
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${SOURCE_READER_ROLE}`,
    );
  } finally {
    await source.$disconnect();
  }

  const readOnlySource = createRecoveryClient(readerUrl(sourceUrl));
  try {
    await assertSourceReadOnly(readOnlySource);
    await analyzeSource(readOnlySource);
  } finally {
    await readOnlySource.$disconnect();
  }

  console.log(
    `Prepared read-only historical source: ${sanitizedTarget(endpoint)} role=${SOURCE_READER_ROLE}`,
  );
}

async function prepareTargetCommand(): Promise<void> {
  const purpose = purposeArgument();
  const targetUrl = requiredArgument("--target-url");
  const targetContainer = requiredArgument("--target-container");
  const confirmation = requiredArgument("--confirm-disposable-target");

  if (confirmation !== `issue-61-d543-${purpose}`) {
    fail("Disposable target confirmation does not match issue, worktree, and purpose.");
  }

  const endpoint = validateTargetEndpoint(targetUrl, purpose, targetContainer);
  const target = createRecoveryClient(targetUrl);
  try {
    await prepareTarget(target, endpoint, purpose);
  } finally {
    await target.$disconnect();
  }

  console.log(`Prepared disposable import target: purpose=${purpose} ${sanitizedTarget(endpoint)}`);
}

async function importCommand(): Promise<void> {
  const backup = await verifyBackupDirectory(requiredArgument("--backup-dir"));
  const purpose = purposeArgument();
  const sourceUrl = requiredArgument("--source-url");
  const sourceContainer = requiredArgument("--source-container");
  const targetUrl = requiredArgument("--target-url");
  const targetContainer = requiredArgument("--target-container");
  const output = resolve(requiredArgument("--manifest-out"));
  const sourceEndpoint = validateSourceEndpoint(sourceUrl, sourceContainer);
  const targetEndpoint = validateTargetEndpoint(targetUrl, purpose, targetContainer);

  if (sourceEndpoint.username !== SOURCE_READER_ROLE) {
    fail(`Importer source must use the constrained ${SOURCE_READER_ROLE} role.`);
  }

  console.log(
    `Historical import source: ${sanitizedTarget(sourceEndpoint)} role=${SOURCE_READER_ROLE}`,
  );
  console.log(`Historical import target: purpose=${purpose} ${sanitizedTarget(targetEndpoint)}`);

  const source = createRecoveryClient(sourceUrl);
  const target = createRecoveryClient(targetUrl);
  try {
    const manifest = await runImport({
      backup,
      failAfterFamily: argument("--fail-after-family"),
      purpose,
      source,
      target,
    });
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    console.log(
      `Historical import complete: campaigns=${
        manifest.reconciliation.find((entry) => entry.family === "Campaign")?.imported ?? 0
      } characters=${
        manifest.reconciliation.find((entry) => entry.family === "Character")?.imported ?? 0
      } unresolved=${manifest.unresolved.length} manifest=${output}`,
    );
  } finally {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "prepare-source") {
    await prepareSourceCommand();
  } else if (command === "prepare-target") {
    await prepareTargetCommand();
  } else if (command === "import") {
    await importCommand();
  } else {
    fail("Expected prepare-source, prepare-target, or import.");
  }
}

main().catch((error: unknown) => {
  console.error(`Historical playtest importer failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
