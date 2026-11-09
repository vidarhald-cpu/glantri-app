import { afterAll, describe, expect, it } from "vitest";

import { buildTransactionOptions } from "./transactionOptions";
import { getTestPrismaClient } from "./testing/testDatabase";

// #1100: simulates Azure latency with pg_sleep inside an interactive transaction.
// The shared test client has no client-level transactionOptions (Prisma defaults: 5 s timeout),
// so the Glantri defaults are applied per call here; client.ts passes the same builder output
// as the client-level transactionOptions.
const prisma = getTestPrismaClient();

if (!prisma) {
  describe.skip("Transaction timeout (DATABASE_URL_TEST not set)", () => {});
} else {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const slow = async (tx: Pick<typeof prisma, "$queryRaw">) => {
    await tx.$queryRaw`SELECT pg_sleep(3)::text`;
    await tx.$queryRaw`SELECT pg_sleep(3)::text`;
    return "ok";
  };

  describe("interactive transaction timeout", () => {
    it("a ~6s transaction fails under Prisma's default 5s timeout", async () => {
      await expect(prisma.$transaction(slow)).rejects.toThrow(/Transaction already closed/);
    }, 40_000);

    it("a ~6s transaction succeeds with the Glantri default options", async () => {
      await expect(prisma.$transaction(slow, buildTransactionOptions({}))).resolves.toBe("ok");
    }, 40_000);

    it("an explicit per-call timeout still overrides", async () => {
      await expect(prisma.$transaction(slow, { timeout: 1000 })).rejects.toThrow(
        /Transaction already closed/,
      );
    }, 40_000);
  });
}
