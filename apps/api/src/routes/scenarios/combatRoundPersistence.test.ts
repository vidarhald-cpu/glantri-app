import { describe, expect, it } from "vitest";

import { combatRoundStateSchema } from "@glantri/domain";

import { combatRoundStatesDiffer } from "./combatRoundPersistence";

describe("combat round persistence comparison", () => {
  it("ignores object-key order and optional undefined properties removed by JSON persistence", () => {
    const materialized = {
      ...combatRoundStateSchema.parse({
        currentStep: "select_actions",
        roundNumber: 1,
      }),
      activeParticipantId: undefined,
      phaseResolutionCursor: undefined,
      roundEndReview: undefined,
    };
    const persisted = JSON.parse(JSON.stringify(materialized)) as typeof materialized;

    expect(Object.hasOwn(materialized, "activeParticipantId")).toBe(true);
    expect(materialized.activeParticipantId).toBeUndefined();
    expect(Object.hasOwn(persisted, "activeParticipantId")).toBe(false);
    expect(JSON.stringify(materialized)).toBe(JSON.stringify(persisted));
    expect(combatRoundStatesDiffer(materialized, persisted)).toBe(false);
    expect(
      combatRoundStatesDiffer(
        Object.fromEntries(Object.entries(materialized).reverse()) as typeof materialized,
        persisted,
      ),
    ).toBe(false);
  });

  it("detects a semantic persisted-state repair", () => {
    const persisted = combatRoundStateSchema.parse({
      currentStep: "select_actions",
      roundNumber: 1,
    });
    const repaired = { ...persisted, currentStep: "review_action_modifiers" as const };

    expect(combatRoundStatesDiffer(repaired, persisted)).toBe(true);
  });
});
