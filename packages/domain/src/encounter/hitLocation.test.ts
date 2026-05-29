import { describe, expect, it } from "vitest";

import {
  chooseTargetedHitLocationRoll,
  getHitLocationFullLabel,
  getHitLocationShortLabel,
  resolveHitLocationRoll,
} from "./hitLocation";

describe("hit location helpers", () => {
  it("resolves closed 1d20 rolls to hit locations", () => {
    expect(resolveHitLocationRoll(20)).toBe("head");
    expect(resolveHitLocationRoll(19)).toBe("head");
    expect(resolveHitLocationRoll(18)).toBe("rightArm");
    expect(resolveHitLocationRoll(17)).toBe("rightArm");
    expect(resolveHitLocationRoll(16)).toBe("leftArm");
    expect(resolveHitLocationRoll(15)).toBe("leftArm");
    expect(resolveHitLocationRoll(14)).toBe("chest");
    expect(resolveHitLocationRoll(13)).toBe("chest");
    expect(resolveHitLocationRoll(12)).toBe("chest");
    expect(resolveHitLocationRoll(11)).toBe("chest");
    expect(resolveHitLocationRoll(10)).toBe("abdomen");
    expect(resolveHitLocationRoll(9)).toBe("abdomen");
    expect(resolveHitLocationRoll(8)).toBe("abdomen");
    expect(resolveHitLocationRoll(7)).toBe("abdomen");
    expect(resolveHitLocationRoll(6)).toBe("rightLeg");
    expect(resolveHitLocationRoll(5)).toBe("rightLeg");
    expect(resolveHitLocationRoll(4)).toBe("rightLeg");
    expect(resolveHitLocationRoll(3)).toBe("leftLeg");
    expect(resolveHitLocationRoll(2)).toBe("leftLeg");
    expect(resolveHitLocationRoll(1)).toBe("leftLeg");
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
