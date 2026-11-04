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

  it("consumes Parry's Dodge-derived value as a raw percentage modifier", () => {
    expect(
      resolveCombatParry({
        parryBase: 15,
        rawModifiers: [{ label: "Parry", value: 3 }],
        rollTotal: 1,
      }),
    ).toMatchObject({
      modifierAdjustment: 5,
      rawModifierTotal: 3,
      total: 21,
    });
  });

  it("#922 applies the modifiers on a parry base below zero", () => {
    // Product Owner ruling on #922, comment 20793: a base of zero or below moves one point per raw
    // step. This call site used to receive a no-answer here and fall through as
    // `modifierAdjustment: 0` beside `rawModifierTotal: 0`, which reports a parry resolved with no
    // modifiers rather than one whose modifiers were dropped.
    const resolved = resolveCombatParry({
      parryBase: -3,
      rawModifiers: [{ label: "DB/Parry", value: -4 }],
      rollTotal: 15,
    });

    expect(resolved.rawModifierTotal).toBe(-4);
    expect(resolved.modifierAdjustment).toBe(-4);
    expect(resolved.modifierAdjustment).not.toBe(0);
    expect(resolved.total).toBe(8);
  });

  it("#922 refuses rather than resolving a parry whose modifiers the rule cannot read", () => {
    // What remains of the no-answer after the ruling is a non-integer figure. This resolver already
    // refuses its own two inputs for exactly that, so it refuses here the same way instead of
    // resolving on a total it knows is wrong.
    expect(() =>
      resolveCombatParry({
        parryBase: 9,
        rawModifiers: [{ label: "DB/Parry", value: -2.5 }],
        rollTotal: 15,
      }),
    ).toThrow(RangeError);

    // And the honest cases are untouched: no modifiers at all is still a parry with no adjustment.
    expect(resolveCombatParry({ parryBase: 9, rollTotal: 12 })).toMatchObject({
      modifierAdjustment: 0,
      rawModifierTotal: 0,
    });
  });
});
