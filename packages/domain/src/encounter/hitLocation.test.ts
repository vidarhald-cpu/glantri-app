import { describe, expect, it } from "vitest";

import {
  chooseTargetedHitLocationRoll,
  expandHitLocationTable,
  getHitLocationFullLabel,
  getHitLocationOrderIndex,
  getHitLocationShortLabel,
  HIT_LOCATION_RULE_TABLE,
  resolveHitLocationRoll,
  resolveHitLocationSelection,
} from "./hitLocation";

describe("hit location helpers", () => {
  it("documents the refreshed hit location source range", () => {
    expect(HIT_LOCATION_RULE_TABLE).toMatchObject({
      id: "combat-hit-location",
      source: {
        range: "A1:C21",
        sheet: "Location table",
        workbook: "docs/source/combat/New_Combat_Arena.xlsx",
      },
      title: "Combat Hit Location",
    });
  });

  it("resolves closed 1d20 rolls to hit locations", () => {
    expect(
      Array.from({ length: 20 }, (_, index) => {
        const roll = 20 - index;

        return [roll, resolveHitLocationRoll(roll)];
      }),
    ).toEqual([
      [20, "head"],
      [19, "head"],
      [18, "rightArm"],
      [17, "rightArm"],
      [16, "leftArm"],
      [15, "leftArm"],
      [14, "chest"],
      [13, "chest"],
      [12, "chest"],
      [11, "chest"],
      [10, "abdomen"],
      [9, "abdomen"],
      [8, "abdomen"],
      [7, "abdomen"],
      [6, "upperRightLeg"],
      [5, "upperRightLeg"],
      [4, "lowerRightLeg"],
      [3, "upperLeftLeg"],
      [2, "upperLeftLeg"],
      [1, "lowerLeftLeg"],
    ]);
  });

  it("expands the canonical table in display order", () => {
    expect(
      expandHitLocationTable().map((row) => ({
        fullLabel: row.fullLabel,
        key: row.key,
        roll: row.roll,
        shortLabel: row.shortLabel,
      })),
    ).toEqual([
      { fullLabel: "Head", key: "head", roll: 20, shortLabel: "Head" },
      { fullLabel: "Head", key: "head", roll: 19, shortLabel: "Head" },
      { fullLabel: "Right arm", key: "rightArm", roll: 18, shortLabel: "R arm" },
      { fullLabel: "Right arm", key: "rightArm", roll: 17, shortLabel: "R arm" },
      { fullLabel: "Left arm", key: "leftArm", roll: 16, shortLabel: "L arm" },
      { fullLabel: "Left arm", key: "leftArm", roll: 15, shortLabel: "L arm" },
      { fullLabel: "Chest", key: "chest", roll: 14, shortLabel: "Chest" },
      { fullLabel: "Chest", key: "chest", roll: 13, shortLabel: "Chest" },
      { fullLabel: "Chest", key: "chest", roll: 12, shortLabel: "Chest" },
      { fullLabel: "Chest", key: "chest", roll: 11, shortLabel: "Chest" },
      { fullLabel: "Abdomen", key: "abdomen", roll: 10, shortLabel: "Abd" },
      { fullLabel: "Abdomen", key: "abdomen", roll: 9, shortLabel: "Abd" },
      { fullLabel: "Abdomen", key: "abdomen", roll: 8, shortLabel: "Abd" },
      { fullLabel: "Abdomen", key: "abdomen", roll: 7, shortLabel: "Abd" },
      { fullLabel: "Upper right leg", key: "upperRightLeg", roll: 6, shortLabel: "R upper" },
      { fullLabel: "Upper right leg", key: "upperRightLeg", roll: 5, shortLabel: "R upper" },
      { fullLabel: "Lower right leg", key: "lowerRightLeg", roll: 4, shortLabel: "R lower" },
      { fullLabel: "Upper left leg", key: "upperLeftLeg", roll: 3, shortLabel: "L upper" },
      { fullLabel: "Upper left leg", key: "upperLeftLeg", roll: 2, shortLabel: "L upper" },
      { fullLabel: "Lower left leg", key: "lowerLeftLeg", roll: 1, shortLabel: "L lower" },
    ]);
  });

  it("labels hit locations for compact and full display", () => {
    expect(getHitLocationShortLabel("rightArm")).toBe("R arm");
    expect(getHitLocationFullLabel("rightArm")).toBe("Right arm");
    expect(getHitLocationShortLabel("lowerRightLeg")).toBe("R lower");
    expect(getHitLocationFullLabel("lowerRightLeg")).toBe("Lower right leg");
  });

  it("exposes stable table order for targeted selection", () => {
    expect(getHitLocationOrderIndex("head")).toBe(0);
    expect(getHitLocationOrderIndex("rightArm")).toBe(1);
    expect(getHitLocationOrderIndex("lowerRightLeg")).toBe(6);
    expect(getHitLocationOrderIndex("lowerLeftLeg")).toBe(8);
    expect(getHitLocationOrderIndex("leftLeg")).toBe(7);
  });

  it("chooses the targeted roll closest to the aimed location", () => {
    expect(chooseTargetedHitLocationRoll("head", 18, 12)).toBe(18);
    expect(chooseTargetedHitLocationRoll("abdomen", 6, 13)).toBe(6);
  });

  it("uses table order rather than raw die distance for targeted selection", () => {
    expect(chooseTargetedHitLocationRoll("chest", 18, 7)).toBe(7);
  });

  it("keeps the first roll when target distance is tied", () => {
    expect(chooseTargetedHitLocationRoll("chest", 10, 15)).toBe(10);
  });

  it("uses one roll when no target is selected", () => {
    expect(chooseTargetedHitLocationRoll("none", 7, 20)).toBe(7);
    expect(chooseTargetedHitLocationRoll(undefined, 4, 20)).toBe(4);
  });

  it("returns a full single-roll hit location selection", () => {
    expect(resolveHitLocationSelection({ rollA: 14 })).toEqual({
      hitLocationRolls: [14],
      hitLocationSelectionReason: "single_roll",
      selectedHitLocation: "chest",
      selectedHitLocationRoll: 14,
      targetLocation: undefined,
    });
  });

  it("returns a full targeted closest hit location selection", () => {
    expect(resolveHitLocationSelection({ rollA: 7, rollB: 14, targetLocation: "head" })).toEqual({
      hitLocationRolls: [7, 14],
      hitLocationSelectionReason: "targeted_closest",
      selectedHitLocation: "chest",
      selectedHitLocationRoll: 14,
      targetLocation: "head",
    });
  });

  it("documents targeted tie behavior as first roll wins", () => {
    expect(resolveHitLocationSelection({ rollA: 10, rollB: 15, targetLocation: "chest" })).toEqual({
      hitLocationRolls: [10, 15],
      hitLocationSelectionReason: "targeted_closest",
      selectedHitLocation: "abdomen",
      selectedHitLocationRoll: 10,
      targetLocation: "chest",
    });
  });

  it("rejects rolls outside closed 1d20", () => {
    expect(() => resolveHitLocationRoll(0)).toThrow(RangeError);
    expect(() => chooseTargetedHitLocationRoll("head", 18, 21)).toThrow(RangeError);
  });
});
