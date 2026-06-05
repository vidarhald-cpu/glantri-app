import { describe, expect, it } from "vitest";

import { resolveCombatParry } from "./resolveCombatParry";

describe("resolveCombatParry", () => {
  it("succeeds when parry total reaches 21", () => {
    expect(
      resolveCombatParry({
        parryBase: 9,
        rollTotal: 12,
      }),
    ).toMatchObject({
      modifierAdjustment: 0,
      success: true,
      targetNumber: 21,
      total: 21,
    });
  });

  it("fails below target number 21", () => {
    expect(
      resolveCombatParry({
        parryBase: 9,
        rollTotal: 11,
      }),
    ).toMatchObject({
      success: false,
      total: 20,
    });
  });

  it("applies General/Fatigue and DB/Parry through the workbook percentage adjustment", () => {
    expect(
      resolveCombatParry({
        parryBase: 9,
        rawModifiers: [
          { label: "General/Fatigue", value: -1 },
          { label: "DB/Parry", value: -2 },
        ],
        rollTotal: 15,
      }),
    ).toMatchObject({
      modifierAdjustment: -3,
      rawModifierTotal: -3,
      success: true,
      total: 21,
    });
  });
});
