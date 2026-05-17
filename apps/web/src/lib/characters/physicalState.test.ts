import { describe, expect, it } from "vitest";

import {
  buildCharacterPhysicalStateView,
  calculateLocationHitpoints,
  HIT_LOCATION_DEFINITIONS,
} from "./physicalState";

describe("character physical state read model", () => {
  it("defines all hit locations and weights total 40/11", () => {
    expect(HIT_LOCATION_DEFINITIONS.map((location) => location.label)).toEqual([
      "Head",
      "Left arm",
      "Right arm",
      "Chest/back",
      "Abdomen/lower back",
      "Upper left leg",
      "Lower left leg",
      "Upper right leg",
      "Lower right leg",
    ]);

    const totalNumerator = HIT_LOCATION_DEFINITIONS.reduce(
      (total, location) => total + location.weightNumerator,
      0,
    );

    expect(totalNumerator).toBe(40);
    expect(HIT_LOCATION_DEFINITIONS.map((location) => location.weightNumerator)).toEqual([
      4,
      4,
      4,
      6,
      6,
      4,
      4,
      4,
      4,
    ]);
  });

  it("keeps location display labels free of weight text", () => {
    expect(HIT_LOCATION_DEFINITIONS.map((location) => location.label)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("/11"),
        expect.stringContaining("weight"),
      ]),
    );
  });

  it("rounds location hitpoints with Math.round and keeps positive locations at least 1", () => {
    expect(
      calculateLocationHitpoints({
        generalHitpoints: 22,
        weightDenominator: 11,
        weightNumerator: 4,
      }),
    ).toBe(8);
    expect(
      calculateLocationHitpoints({
        generalHitpoints: 1,
        weightDenominator: 11,
        weightNumerator: 4,
      }),
    ).toBe(1);
  });

  it("builds location hitpoints from the expanded combat-effect location weights", () => {
    const view = buildCharacterPhysicalStateView({ generalHitpoints: 22 });
    const totalLocationHitpoints = view.hitpoints.locations.reduce(
      (total, location) => total + location.original,
      0,
    );

    expect(view.hitpoints.general.original).toBe(22);
    expect(totalLocationHitpoints).toBe(80);
  });

  it("uses corrected calculated general hitpoints as the location base", () => {
    const view = buildCharacterPhysicalStateView({ generalHitpoints: 17 });

    expect(view.hitpoints.general.original).toBe(17);
    expect(view.hitpoints.general.original).not.toBe(7);
    expect(view.hitpoints.locations.find((location) => location.id === "head")).toMatchObject({
      original: 6,
      current: 6,
    });
    expect(
      view.hitpoints.locations.find((location) => location.id === "chestBack"),
    ).toMatchObject({
      original: 9,
      current: 9,
    });
  });

  it("subtracts general and location damage from current hitpoints", () => {
    const view = buildCharacterPhysicalStateView({
      generalDamage: 3,
      generalHitpoints: 22,
      locationDamageById: {
        head: 2,
      },
    });

    expect(view.hitpoints.general).toEqual({
      current: 19,
      damage: 3,
      original: 22,
    });
    expect(view.hitpoints.locations.find((location) => location.id === "head")).toMatchObject({
      current: 6,
      damage: 2,
      original: 8,
    });
  });

  it("defaults damage by type and hit log to empty scaffold values", () => {
    const view = buildCharacterPhysicalStateView({ generalHitpoints: 10 });

    expect(view.damageByType.map((row) => [row.label, row.currentEffect])).toEqual([
      ["General", 0],
      ["OB/Skill", 0],
      ["DB", 0],
      ["Other", 0],
      ["Bleed", 0],
      ["Special", "—"],
    ]);
    expect(view.hitLog).toEqual([]);
  });
});
