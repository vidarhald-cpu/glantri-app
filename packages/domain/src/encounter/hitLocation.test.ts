import { describe, expect, it } from "vitest";

import {
  chooseTargetedHitLocationRoll,
  expandHitLocationTable,
  getHitLocationFullLabel,
  getHitLocationShortLabel,
  resolveHitLocationRoll,
} from "./hitLocation";

describe("hit location helpers", () => {
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
      [6, "rightLeg"],
      [5, "rightLeg"],
      [4, "rightLeg"],
      [3, "leftLeg"],
      [2, "leftLeg"],
      [1, "leftLeg"],
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
      { fullLabel: "Right leg", key: "rightLeg", roll: 6, shortLabel: "R leg" },
      { fullLabel: "Right leg", key: "rightLeg", roll: 5, shortLabel: "R leg" },
      { fullLabel: "Right leg", key: "rightLeg", roll: 4, shortLabel: "R leg" },
      { fullLabel: "Left leg", key: "leftLeg", roll: 3, shortLabel: "L leg" },
      { fullLabel: "Left leg", key: "leftLeg", roll: 2, shortLabel: "L leg" },
      { fullLabel: "Left leg", key: "leftLeg", roll: 1, shortLabel: "L leg" },
    ]);
  });

  it("labels hit locations for compact and full display", () => {
    expect(getHitLocationShortLabel("rightArm")).toBe("R arm");
    expect(getHitLocationFullLabel("rightArm")).toBe("Right arm");
  });

  it("chooses the targeted roll closest to the aimed location", () => {
    expect(chooseTargetedHitLocationRoll("head", 18, 12)).toBe(18);
    expect(chooseTargetedHitLocationRoll("abdomen", 6, 13)).toBe(6);
  });

  it("keeps the first roll when target distance is tied", () => {
    expect(chooseTargetedHitLocationRoll("chest", 10, 15)).toBe(10);
  });

  it("uses one roll when no target is selected", () => {
    expect(chooseTargetedHitLocationRoll("none", 7, 20)).toBe(7);
    expect(chooseTargetedHitLocationRoll(undefined, 4, 20)).toBe(4);
  });

  it("rejects rolls outside closed 1d20", () => {
    expect(() => resolveHitLocationRoll(0)).toThrow(RangeError);
    expect(() => chooseTargetedHitLocationRoll("head", 18, 21)).toThrow(RangeError);
  });
});
