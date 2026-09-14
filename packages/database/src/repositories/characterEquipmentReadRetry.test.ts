import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createPrismaCharacterEquipmentRepository,
  retryCharacterEquipmentRead,
  StaleCharacterEquipmentAggregateError,
} from "./characterEquipmentRepository";

function databaseError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("test conflict", {
    clientVersion: "test",
    code,
    meta,
  });
}

describe("equipment read conflict recovery", () => {
  it.each([
    databaseError("P2034"),
    databaseError("P2010", { code: "40001" }),
    databaseError("P2002", { modelName: "CharacterEquipmentAggregate", target: ["characterId"] }),
    new StaleCharacterEquipmentAggregateError(),
  ])("restarts a recoverable read/initialization conflict", async (error) => {
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ revision: 7 });
    expect(await retryCharacterEquipmentRead(read)).toEqual({ revision: 7 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("bounds repeated conflicts and preserves the last failure", async () => {
    const error = databaseError("P2010", { code: "40001" });
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryCharacterEquipmentRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it.each([
    new Error("invalid Item"),
    databaseError("P2010", { code: "23503" }),
    databaseError("P2002", { modelName: "CharacterLoadout", target: ["id"] }),
    databaseError("P2002", { modelName: "CharacterEquipmentAggregate", target: ["other"] }),
  ])("does not hide unrelated failures", async (error) => {
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryCharacterEquipmentRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("does not retry inside a caller-owned transaction", async () => {
    const error = databaseError("P2034");
    const upsert = vi.fn().mockRejectedValue(error);
    const transaction = {
      characterEquipmentAggregate: { upsert },
    } as unknown as Prisma.TransactionClient;
    const repo = createPrismaCharacterEquipmentRepository(transaction);
    await expect(repo.getCharacterEquipmentAggregateState("character-1")).rejects.toBe(error);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
