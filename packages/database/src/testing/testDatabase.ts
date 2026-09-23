import { PrismaClient } from "@prisma/client";

import { validateTestDatabaseTarget } from "../databaseTargetSafety";
import { assertWorktreeDatabaseRuntimeSafety } from "../worktreeDatabaseRuntimeSafety";

let testClient: PrismaClient | undefined;

export function getTestPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL_TEST) {
    return null;
  }

  const worktreeEnvironment = assertWorktreeDatabaseRuntimeSafety();

  if (!worktreeEnvironment) {
    validateTestDatabaseTarget(process.env.DATABASE_URL_TEST, process.env.DATABASE_URL);
  }

  if (!testClient) {
    testClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST,
        },
      },
      log: ["warn", "error"],
    });
  }

  return testClient;
}

// A test abandoned mid-flight — in practice a Vitest timeout — does not stop the interactive
// transaction it started. That transaction keeps holding its row locks until Prisma's own
// transaction timeout rolls it back. The next test's `beforeEach` reset then scans the same rows
// in a different order, PostgreSQL finds the lock cycle, and kills one side with SQLSTATE 40P01
// (or 40001 under Serializable). The victim is usually the reset, so a single slow test fails
// innocent neighbours and the failing set moves from run to run.
//
// Containment, deliberately observable rather than silent: retry the reset a bounded number of
// times with backoff so the straggler's remaining lifetime can elapse, log every retry loudly so
// a genuine future locking regression is visible in every database suite rather than hidden, and
// fail normally — naming the deadlock — once the bound is exhausted.
const RESET_LOCK_CONFLICT_BACKOFF_MS = [250, 500, 1000, 2000] as const;
const RESET_LOCK_CONFLICT_MAX_ATTEMPTS = RESET_LOCK_CONFLICT_BACKOFF_MS.length + 1;

// Matched against the error text rather than a typed code because these surface through several
// Prisma shapes: a raw ConnectorError carrying `code: "40P01"`, the P2034 message for an
// interactive transaction, and the raw-query 40001 serialization message.
const RESET_LOCK_CONFLICT_SIGNATURES = [
  "40P01",
  "40001",
  "deadlock detected",
  "write conflict or a deadlock",
  "could not serialize access",
] as const;

function findLockConflictSignature(error: unknown): string | undefined {
  const message = error instanceof Error ? `${error.message}` : String(error);

  return RESET_LOCK_CONFLICT_SIGNATURES.find((signature) => message.includes(signature));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function resetTestDatabase(prisma: PrismaClient): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await deleteAllTestData(prisma);
      return;
    } catch (error) {
      const signature = findLockConflictSignature(error);

      if (signature === undefined) {
        throw error;
      }

      if (attempt >= RESET_LOCK_CONFLICT_MAX_ATTEMPTS) {
        throw new Error(
          `resetTestDatabase: PostgreSQL lock conflict (${signature}) persisted across all ` +
            `${RESET_LOCK_CONFLICT_MAX_ATTEMPTS} reset attempts. This is a deadlock or ` +
            `serialization failure against a transaction still running outside this reset, not a ` +
            `generic reset error. Original error: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }

      const backoffMs = RESET_LOCK_CONFLICT_BACKOFF_MS[attempt - 1]!;

      console.error(
        `[resetTestDatabase] DEADLOCK RETRY ${attempt}/${RESET_LOCK_CONFLICT_MAX_ATTEMPTS - 1}: ` +
          `PostgreSQL lock conflict (${signature}) during test database reset. A transaction ` +
          `outside this reset is still holding locks. Retrying in ${backoffMs}ms.`,
      );

      await delay(backoffMs);
    }
  }
}

async function deleteAllTestData(prisma: PrismaClient): Promise<void> {
  // Delete in dependency order: leaf tables first, then parent tables.
  // Each group uses deleteMany({}) which bypasses FK checks within a group
  // as long as the group ordering respects referencing → referenced direction.
  await prisma.equipmentTransitionEvent.deleteMany({});
  await prisma.scenarioEventLog.deleteMany({});
  await prisma.artifactAuditEvent.deleteMany({});
  await prisma.campaignItemArtifactAttachment.deleteMany({});
  await prisma.scenarioArtifactReference.deleteMany({});
  // Map links may form cycles, so markers must be removed before their maps.
  await prisma.campaignMapMarker.deleteMany({});
  await prisma.campaignMapLayer.deleteMany({});
  await prisma.campaignMap.deleteMany({});
  await prisma.scenarioParticipant.deleteMany({});
  await prisma.scenarioRelationship.deleteMany({});
  await prisma.campaignRosterEntry.deleteMany({});
  await prisma.campaignBlackboardEntry.deleteMany({});
  await prisma.campaignBlackboardLayout.deleteMany({});
  await prisma.characterLoadout.deleteMany({});
  await prisma.characterEquipmentItem.deleteMany({});
  await prisma.characterStorageLocation.deleteMany({});
  await prisma.scenario.deleteMany({});
  await prisma.campaignAsset.updateMany({ data: { currentRevisionId: null } });
  await prisma.artifactSourceMapping.deleteMany({});
  await prisma.artifactRevision.deleteMany({});
  await prisma.artifactImportSession.deleteMany({});
  await prisma.campaignAsset.deleteMany({});
  await prisma.reusableEntity.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.character.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.weapon.deleteMany({});
  await prisma.encounter.deleteMany({});
  await prisma.canonicalContentSnapshot.deleteMany({});
}
