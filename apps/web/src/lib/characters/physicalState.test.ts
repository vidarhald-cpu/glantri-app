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

  it("sums active combat effects into hitpoints and effect buckets", () => {
    const view = buildCharacterPhysicalStateView({
      combatEffects: {
        events: [
          {
            createdAt: "2026-05-17T10:00:00.000Z",
            description: "Orc hits The Gladiator with axe",
            id: "event-1",
            roundNumber: 4,
            sourceLabel: "Axe hit",
            sourceType: "manual",
            targetParticipantId: "participant-1",
          },
        ],
        effects: [
          {
            createdAt: "2026-05-17T10:00:00.000Z",
            damage: 5,
            effectGroup: "other",
            generalDamage: 0,
            id: "effect-arm",
            location: "rightArm",
            sourceEventId: "event-1",
            status: "active",
            targetParticipantId: "participant-1",
            type: "physical_damage",
            updatedAt: "2026-05-17T10:00:00.000Z",
          },
          {
            createdAt: "2026-05-17T10:00:00.000Z",
            damage: 0,
            effectGroup: "general",
            generalDamage: 3,
            id: "effect-general",
            sourceEventId: "event-1",
            status: "active",
            targetParticipantId: "participant-1",
            type: "general_damage",
            updatedAt: "2026-05-17T10:00:00.000Z",
          },
          {
            createdAt: "2026-05-17T10:00:00.000Z",
            damage: 0,
            description: "Bleed 1",
            effectGroup: "bleed",
            generalDamage: 0,
            id: "effect-bleed",
            modifierValue: 1,
            sourceEventId: "event-1",
            status: "active",
            targetParticipantId: "participant-1",
            type: "bleed",
            updatedAt: "2026-05-17T10:00:00.000Z",
          },
          {
            createdAt: "2026-05-17T10:00:00.000Z",
            damage: 0,
            description: "Stunned",
            duration: "2 rounds, then CON check",
            effectGroup: "general",
            generalDamage: 0,
            id: "effect-stun",
            modifierValue: -4,
            sourceEventId: "event-1",
            status: "active",
            targetParticipantId: "participant-1",
            type: "general_modifier",
            updatedAt: "2026-05-17T10:00:00.000Z",
          },
          {
            createdAt: "2026-05-17T10:00:00.000Z",
            damage: 99,
            effectGroup: "other",
            generalDamage: 99,
            id: "effect-resolved",
            sourceEventId: "event-1",
            status: "resolved",
            targetParticipantId: "participant-1",
            type: "physical_damage",
            updatedAt: "2026-05-17T10:00:00.000Z",
          },
        ],
      },
      generalHitpoints: 22,
    });

    expect(view.hitpoints.general.damage).toBe(3);
    expect(view.hitpoints.general.current).toBe(19);
    expect(view.hitpoints.locations.find((location) => location.id === "rightArm")).toMatchObject({
      damage: 5,
      current: 3,
      original: 8,
    });
    expect(view.damageByType.map((row) => [row.id, row.currentEffect])).toEqual([
      ["general", -1],
      ["obSkill", 0],
      ["db", 0],
      ["other", 5],
      ["bleed", 1],
      ["special", "—"],
    ]);
    expect(view.hitLog).toHaveLength(5);
    expect(view.hitLog[0]).toMatchObject({
      damage: 5,
      roundNumber: 4,
      source: "Axe hit",
      type: "physical_damage",
    });
  });
});
