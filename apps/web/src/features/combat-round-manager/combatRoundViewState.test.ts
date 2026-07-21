import { describe, expect, it } from "vitest";
import { combatRoundStateSchema } from "@glantri/domain";

import {
  canAcceptCombatRoundViewRevision,
  getCombatRoundDescriptorRevision,
  updateCombatRoundViewState,
} from "./combatRoundViewState";

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
          encounterRevision: "2026-07-21T09:00:07.000Z",
          state,
        },
        encounterId: "encounter-1",
        state,
      }),
    ).toEqual({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-21T09:00:07.000Z",
      state,
    });

    expect(
      updateCombatRoundViewState({
        current: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:07.000Z",
          state,
        },
        encounterId: "encounter-1",
        encounterRevision: "2026-07-21T09:00:08.000Z",
        state,
      }).encounterRevision,
    ).toBe("2026-07-21T09:00:08.000Z");
  });

  it("does not let a delayed mutation response recreate an obsolete boundary descriptor", () => {
    const declaration = combatRoundStateSchema.parse({
      currentStep: "select_actions",
      roundNumber: 1,
    });
    const modifierReview = combatRoundStateSchema.parse({
      currentStep: "review_action_modifiers",
      roundNumber: 1,
    });
    const accepted = {
      encounterId: "encounter-1",
      encounterRevision: "2026-07-21T09:00:08.000Z",
      state: modifierReview,
    };

    expect(
      canAcceptCombatRoundViewRevision({
        accepted,
        candidateEncounterId: "encounter-1",
        candidateRevision: "2026-07-21T09:00:07.000Z",
      }),
    ).toBe(false);
    expect(
      updateCombatRoundViewState({
        current: accepted,
        encounterId: "encounter-1",
        encounterRevision: "2026-07-21T09:00:07.000Z",
        state: declaration,
      }),
    ).toBe(accepted);
    expect(
      updateCombatRoundViewState({
        current: accepted,
        encounterId: "encounter-1",
        encounterRevision: "2026-07-21T09:00:08.000Z",
        state: modifierReview,
      }),
    ).toEqual(accepted);
    expect(
      updateCombatRoundViewState({
        current: accepted,
        encounterId: "encounter-1",
        encounterRevision: "2026-07-21T09:00:08.000Z",
        state: declaration,
      }),
    ).toBe(accepted);
  });

  it("suppresses a descriptor while its task set trails the accepted encounter revision", () => {
    expect(
      getCombatRoundDescriptorRevision({
        acceptedEncounter: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:08.000Z",
        },
        currentView: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:07.000Z",
        },
      }),
    ).toBeUndefined();
  });

  it("binds a descriptor only to the synchronized or newer accepted task set", () => {
    expect(
      getCombatRoundDescriptorRevision({
        acceptedEncounter: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:08.000Z",
        },
        currentView: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:08.000Z",
        },
      }),
    ).toBe("2026-07-21T09:00:08.000Z");
    expect(
      getCombatRoundDescriptorRevision({
        acceptedEncounter: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:08.000Z",
        },
        currentView: {
          encounterId: "encounter-1",
          encounterRevision: "2026-07-21T09:00:09.000Z",
        },
      }),
    ).toBe("2026-07-21T09:00:09.000Z");
  });
});
