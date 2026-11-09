import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { buildTransactionOptions } from "./transactionOptions";

// #1100: simulates Azure latency with pg_sleep inside an interactive transaction.
if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Transaction timeout (DATABASE_URL_TEST not set)", () => {});
} else {
  const url = process.env.DATABASE_URL_TEST;
  const clients: PrismaClient[] = [];
  const make = (withOptions: boolean) => {
    const c = new PrismaClient({
      datasources: { db: { url } },
      ...(withOptions ? { transactionOptions: buildTransactionOptions() } : {}),
    });
    clients.push(c);
    return c;
  };
  afterAll(async () => {
    await Promise.all(clients.map((c) => c.$disconnect()));
  });

  describe("interactive transaction timeout", () => {
    it("a ~6s transaction succeeds with the Glantri defaults", async () => {
      const prisma = make(true);
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_sleep(3)::text`;
          await tx.$queryRaw`SELECT pg_sleep(3)::text`;
          return "ok";
        }),
      ).resolves.toBe("ok");
    }, 40_000);

    it("a per-call timeout still overrides the client default", async () => {
      const prisma = make(true);
      await expect(
        prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT pg_sleep(3)::text`;
          },
          { timeout: 1000 },
        ),
      ).rejects.toThrow(/Transaction already closed|expired/);
    }, 40_000);
  });
}
