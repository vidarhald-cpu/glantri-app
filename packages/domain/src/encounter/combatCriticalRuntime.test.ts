import { describe, expect, it } from "vitest";

import {
  accrueCombatCriticalBleed,
  getCombatCriticalBleedEffectiveRate,
  transitionCombatCriticalBleedControl,
} from "./combatCriticalRuntime";

const external = {
  allowedControlStates: ["active", "partial", "staunched_zero", "resolved"] as const,
  controlState: "active" as const,
  currentRate: { denominator: 3, numerator: 1 },
  firstTickRound: 2,
  kind: "external" as const,
  rate: { denominator: 3, numerator: 1 },
  sourceEffectKey: "pointed_weapons|arm|09|03",
  sourceRate: "1 HP / 3 rounds",
};

const internal = {
  allowedControlStates: ["active", "stabilised", "resolved"] as const,
  controlState: "active" as const,
  currentRate: { denominator: 2, numerator: 1 },
  firstTickRound: 2,
  kind: "internal" as const,
  rate: { denominator: 2, numerator: 1 },
  sourceEffectKey: "sharp|chest|09|03",
  sourceRate: "1 HP / 2 rounds",
};

describe("C1 Critical runtime", () => {
  it("adds exact sources before applying whole HP and reduces the carried remainder", () => {
    expect(
      accrueCombatCriticalBleed({
        activeRates: [external.rate, internal.rate],
        previousRemainder: { denominator: 6, numerator: 5 },
      }),
    ).toEqual({
      appliedHp: 1,
      remainder: { denominator: 3, numerator: 2 },
      total: { denominator: 3, numerator: 5 },
    });
  });

  it("supports explicit external partial/staunched states without giving them to internal Bleed", () => {
    const partial = transitionCombatCriticalBleedControl({
      bleed: { ...external, allowedControlStates: [...external.allowedControlStates] },
      nextState: "partial",
      partialRate: { denominator: 6, numerator: 1 },
    });
    const staunched = transitionCombatCriticalBleedControl({
      bleed: partial,
      nextState: "staunched_zero",
    });

    expect(getCombatCriticalBleedEffectiveRate(partial)).toEqual({
      denominator: 6,
      numerator: 1,
    });
    expect(getCombatCriticalBleedEffectiveRate(staunched)).toEqual({
      denominator: 1,
      numerator: 0,
    });
    expect(() =>
      transitionCombatCriticalBleedControl({
        bleed: { ...internal, allowedControlStates: [...internal.allowedControlStates] },
        nextState: "partial",
        partialRate: { denominator: 4, numerator: 1 },
      }),
    ).toThrow("not an allowed control state");
  });
});
