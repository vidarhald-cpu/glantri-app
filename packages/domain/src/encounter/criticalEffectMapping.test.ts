import { describe, expect, it } from "vitest";

import {
  mapCombatHitLocationToCriticalLocation,
  mapFinalCriticalRollToCritIndex,
  mapWeaponCriticalCodeToFamily,
  mapWeaponCriticalInputToFamily,
  mapWeaponDamageClassToCriticalFamily,
} from "./criticalEffectMapping";

describe("critical effect combat mapping", () => {
  it("maps weapon damage class to critical table family", () => {
    expect(mapWeaponDamageClassToCriticalFamily("edged")).toEqual({
      status: "mapped",
      value: "sharp",
    });
    expect(mapWeaponDamageClassToCriticalFamily("pointed")).toEqual({
      status: "mapped",
      value: "pointed_weapons",
    });
    expect(mapWeaponDamageClassToCriticalFamily("blunt")).toEqual({
      status: "mapped",
      value: "blunt",
    });
  });

  it("maps only unambiguous MC codes without damage class", () => {
    expect(mapWeaponCriticalCodeToFamily("BS")).toEqual({
      status: "mapped",
      value: "sharp",
    });
    expect(mapWeaponCriticalCodeToFamily("DP")).toEqual({
      status: "mapped",
      value: "pointed_weapons",
    });
    expect(mapWeaponCriticalCodeToFamily("DC")).toEqual({
      status: "mapped",
      value: "blunt",
    });
    expect(mapWeaponCriticalCodeToFamily("FS")).toMatchObject({
      status: "ambiguous",
    });
  });

  it("prefers damage class over ambiguous MC code when both are available", () => {
    expect(
      mapWeaponCriticalInputToFamily({
        weaponCriticalCode: "FS",
        weaponDamageClass: "edged",
      }),
    ).toEqual({
      status: "mapped",
      value: "sharp",
    });
  });

  it("maps combat hit locations to critical table locations conservatively", () => {
    expect(mapCombatHitLocationToCriticalLocation("head")).toEqual({
      status: "mapped",
      value: "head",
    });
    expect(mapCombatHitLocationToCriticalLocation("leftArm")).toEqual({
      status: "mapped",
      value: "arm",
    });
    expect(mapCombatHitLocationToCriticalLocation("abdomen")).toEqual({
      status: "mapped",
      value: "abdomen",
    });
    expect(mapCombatHitLocationToCriticalLocation("rightLeg")).toMatchObject({
      status: "ambiguous",
    });
  });

  it("maps final critical roll directly to supported critIndex range without clamping", () => {
    expect(mapFinalCriticalRollToCritIndex(1)).toEqual({ status: "mapped", value: 1 });
    expect(mapFinalCriticalRollToCritIndex(16)).toEqual({ status: "mapped", value: 16 });
    expect(mapFinalCriticalRollToCritIndex(0)).toMatchObject({ status: "unsupported" });
    expect(mapFinalCriticalRollToCritIndex(17)).toMatchObject({ status: "unsupported" });
  });
});
