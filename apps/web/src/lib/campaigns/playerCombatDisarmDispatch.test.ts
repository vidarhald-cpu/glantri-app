import { describe, expect, it, vi } from "vitest";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history/view-models/currentActionPresentation";
import {
  dispatchPlayerCombatDisarmRoll,
  getPlayerParryDisarmAttemptId,
} from "./playerCombatDisarmDispatch";

function descriptor(input: {
  kind: "actor" | "holder";
  participantId: string;
}): CurrentActionCommandDescriptor {
  return {
    commandType: "roll_disarm",
    disarmAttemptId: "disarm:round:3:phase1:actor:actor",
    encounterId: "encounter-1",
    executionGroupId: "execution-disarm",
    expectedBoundary: "phase1_resolution",
    expectedRevision: "revision-1",
    participantId: input.participantId,
    taskId: `disarm-${input.kind}-task`,
  };
}

describe("player Disarm dispatch", () => {
  it.each([
    ["actor", "actor"],
    ["holder", "holder"],
  ] as const)(
    "dispatches the projected %s roll with its exact attempt identity",
    async (kind, id) => {
      const send = vi.fn(async () => ({ id: "encounter-1" })) as never;
      const result = await dispatchPlayerCombatDisarmRoll({
        characteristicChoice: "dexterity",
        descriptor: descriptor({ kind, participantId: id }),
        encounterId: "encounter-1",
        send,
        skillChoice: "parry",
      });

      expect(result).toEqual({ id: "encounter-1" });
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: "disarm:round:3:phase1:actor:actor",
          scenarioParticipantId: id,
          taskId: `disarm-${kind}-task`,
        }),
      );
    },
  );

  it("forwards the reactive special-Parry attempt and no ordinary-Parry identity", () => {
    expect(
      getPlayerParryDisarmAttemptId({
        ...descriptor({ kind: "actor", participantId: "actor" }),
        commandType: "roll_parry",
        parryPurpose: "parry_disarm",
      }),
    ).toBe("disarm:round:3:phase1:actor:actor");
    expect(
      getPlayerParryDisarmAttemptId({
        ...descriptor({ kind: "actor", participantId: "actor" }),
        commandType: "roll_parry",
        parryPurpose: "ordinary_defense",
      }),
    ).toBeUndefined();
  });
});
