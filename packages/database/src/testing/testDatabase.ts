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
//
// Vitest's default `hookTimeout` is 10_000ms and this helper runs inside `beforeEach`, so the
// containment only satisfies requirement 4 of issue #296 if exhaustion *reports* the deadlock
// well inside that budget. If the helper is still retrying at 10s the suite reports a generic
// "Hook timed out in 10000ms" and the deadlock is never named - exactly the failure mode the
// containment exists to prevent. The budget below is therefore derived from measurement, not
// from a global timeout increase (no configuration file is touched).
//
// Measured against a real PostgreSQL 16 deadlock (container default `deadlock_timeout = 1s`,
// which is what both the task container and the CI postgres service use): a deadlocked reset
// attempt costs 1008-1045ms - the deadlock_timeout plus ~10-45ms of reset work. Five attempts
// at that rate plus the original 250/500/1000/2000ms backoff measured 8840ms and 8866ms of the
// 10_000ms hook budget: an 11% margin.
//
// Two changes bring the margin back:
//  * the backoff is shortened to 100/200/400/800ms (1500ms total). The backoff is not what
//    lets the straggler transaction die - each deadlocked attempt already blocks for a full
//    deadlock_timeout. What matters is total elapsed time, and that must comfortably exceed
//    Prisma's own 5s default transaction timeout, which bounds how long an abandoned
//    interactive transaction can keep holding locks.
//  * a total elapsed budget of 7000ms. Before each retry the helper checks whether the budget
//    can still accommodate the backoff plus another attempt, using the worst attempt cost it
//    has actually observed in this call (never below a 1200ms floor derived from the 1045ms
//    measurement). If it cannot, it stops immediately and fails naming the deadlock.
//
// What that actually guarantees is worth stating exactly, because it is not a single window.
// Write c for the cost of one deadlocked attempt, B(k) for the cumulative backoff after k retries
// (100/300/700/1500ms), and W = max(1200ms, worst attempt cost observed so far in this call). The
// fail-fast check runs after attempt k, so attempt k+1 starts only if k*c + B(k) + W <= 7000. With
// a steady per-attempt cost that yields five bands, not one window:
//
//   c <= 1075ms      5 attempts (the attempt bound), exits at 5c + 1500  (<= 6875ms)
//   1076..1575ms     4 attempts, exits at 4c +  700  (5004..7000ms)
//   1576..2233ms     3 attempts, exits at 3c +  300  (5028..6999ms)
//   2234..3450ms     2 attempts, exits at 2c +  100  (4568..7000ms)
//   c >= 3451ms      1 attempt and no retry at all, exits at c
//
// The measured cost above (1008-1045ms: the stock `postgres:16` deadlock_timeout plus reset work)
// sits in the first band, so the task container and CI both exhaust the full five attempts at
// ~6540-6725ms. That is the normal case, not a floor. There is deliberately no lower bound: the
// fourth band exits as early as ~4568ms, and the fifth retries nothing at all.
//
// The three invariants that do hold across every band:
//  * Elapsed time overruns the 7000ms budget only by the amount, if any, by which the *final*
//    attempt cost more than every earlier attempt and more than the 1200ms floor — the check that
//    authorised that attempt had already reserved W for it. Where attempt costs do not grow,
//    elapsed is a flat <= 7000ms. This is what the adaptive `worstAttemptMs` below buys: pinned to
//    the static 1200ms floor, a host at c = 2500ms would start a third attempt and exit at 7800ms,
//    past the helper's own budget. `testDatabaseResetRetry.test.ts` pins that divergence so the
//    adaptation cannot be removed without a test failing.
//  * The failure names the deadlock rather than degrading into a generic "Hook timed out in
//    10000ms", because <= 7000ms is inside Vitest's default `hookTimeout`. The single exception is
//    the fifth band with c > 10_000ms, where one reset attempt alone outlasts the hook; no budget
//    here can bound the cost of a single `deleteMany` chain against a wedged database.
//  * The attempt count degrades monotonically as c rises (5, 4, 3, 2, 1), so a slower host gives
//    up earlier rather than later.
const RESET_LOCK_CONFLICT_BACKOFF_MS = [100, 200, 400, 800] as const;
const RESET_LOCK_CONFLICT_MAX_ATTEMPTS = RESET_LOCK_CONFLICT_BACKOFF_MS.length + 1;
const RESET_LOCK_CONFLICT_BUDGET_MS = 7_000;
const RESET_LOCK_CONFLICT_ASSUMED_ATTEMPT_MS = 1_200;

// Matched against the error text rather than a typed code because these surface through several
// Prisma shapes: a raw ConnectorError carrying `code: "40P01"`, the P2034 message for an
// interactive transaction, and the raw-query 40001 serialization message.
//
// The SQLSTATE codes are matched only in their delimited form. A bare substring test treats any
// message that merely contains those five characters - a cuid such as `clx40001abc`, an id, a
// byte offset - as a PostgreSQL serialization failure, which mislabels the error and burns the
// whole backoff on something that will never succeed.
const RESET_LOCK_CONFLICT_PATTERNS = [
  { label: "40P01", pattern: /(?<![0-9A-Za-z])40P01(?![0-9A-Za-z])/ },
  { label: "40001", pattern: /(?<![0-9A-Za-z])40001(?![0-9A-Za-z])/ },
  { label: "deadlock detected", pattern: /deadlock detected/ },
  { label: "write conflict or a deadlock", pattern: /write conflict or a deadlock/ },
  { label: "could not serialize access", pattern: /could not serialize access/ },
] as const;

function findLockConflictSignature(error: unknown): string | undefined {
  const message = error instanceof Error ? `${error.message}` : String(error);

  return RESET_LOCK_CONFLICT_PATTERNS.find(({ pattern }) => pattern.test(message))?.label;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function describeOriginalError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function resetTestDatabase(prisma: PrismaClient): Promise<void> {
  const startedAt = Date.now();
  let worstAttemptMs = RESET_LOCK_CONFLICT_ASSUMED_ATTEMPT_MS;

  for (let attempt = 1; ; attempt += 1) {
    const attemptStartedAt = Date.now();

    try {
      await deleteAllTestData(prisma);
      return;
    } catch (error) {
      const signature = findLockConflictSignature(error);

      if (signature === undefined) {
        throw error;
      }

      worstAttemptMs = Math.max(worstAttemptMs, Date.now() - attemptStartedAt);
      const elapsedMs = Date.now() - startedAt;
      const backoffMs = RESET_LOCK_CONFLICT_BACKOFF_MS[attempt - 1];

      if (attempt >= RESET_LOCK_CONFLICT_MAX_ATTEMPTS || backoffMs === undefined) {
        throw new Error(
          `resetTestDatabase: PostgreSQL lock conflict (${signature}) persisted across all ` +
            `${RESET_LOCK_CONFLICT_MAX_ATTEMPTS} reset attempts in ${elapsedMs}ms. This is a ` +
            `deadlock or serialization failure against a transaction still running outside this ` +
            `reset, not a generic reset error. Original error: ${describeOriginalError(error)}`,
          { cause: error },
        );
      }

      if (elapsedMs + backoffMs + worstAttemptMs > RESET_LOCK_CONFLICT_BUDGET_MS) {
        throw new Error(
          `resetTestDatabase: PostgreSQL lock conflict (${signature}) persisted for ${elapsedMs}ms ` +
            `across ${attempt} reset attempts, and the remaining ` +
            `${RESET_LOCK_CONFLICT_BUDGET_MS}ms retry budget can no longer fit another attempt ` +
            `(${backoffMs}ms backoff + ${worstAttemptMs}ms observed attempt cost). Failing now so ` +
            `this is reported as the deadlock it is rather than as a generic hook timeout. This ` +
            `is a deadlock or serialization failure against a transaction still running outside ` +
            `this reset, not a generic reset error. Original error: ${describeOriginalError(error)}`,
          { cause: error },
        );
      }

      console.error(
        `[resetTestDatabase] DEADLOCK RETRY ${attempt}/${RESET_LOCK_CONFLICT_MAX_ATTEMPTS - 1}: ` +
          `PostgreSQL lock conflict (${signature}) during test database reset. A transaction ` +
          `outside this reset is still holding locks. Retrying in ${backoffMs}ms ` +
          `(${elapsedMs}ms of the ${RESET_LOCK_CONFLICT_BUDGET_MS}ms budget used).`,
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
