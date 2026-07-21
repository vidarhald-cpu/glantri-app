import { describe, expect, it } from "vitest";
import { combatRoundStateSchema } from "@glantri/domain";

import { updateCombatRoundViewState } from "./combatRoundViewState";

describe("combat round view state", () => {
  it("keeps the accepted mutation revision on local state updates", () => {
    const state = combatRoundStateSchema.parse({
      currentStep: "select_actions",
      roundNumber: 1,
    });

    expect(
      updateCombatRoundViewState({
        current: {
          encounterId: "encounter-1",
          encounterRevision: "revision-7",
        },
        encounterId: "encounter-1",
        state,
      }),
    ).toEqual({
      encounterId: "encounter-1",
      encounterRevision: "revision-7",
      state,
    });

    expect(
      updateCombatRoundViewState({
        current: { encounterId: "encounter-1", encounterRevision: "revision-7" },
        encounterId: "encounter-1",
        encounterRevision: "revision-8",
        state,
      }).encounterRevision,
    ).toBe("revision-8");
  });
});
