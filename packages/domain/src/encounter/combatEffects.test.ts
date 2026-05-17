import { describe, expect, it } from "vitest";

import { combatEffectsStateSchema } from "./combatEffects";

describe("combat effect state", () => {
  it("defaults old participant state combat effects to empty collections", () => {
    expect(combatEffectsStateSchema.parse(undefined)).toEqual({
      effects: [],
      events: [],
    });
  });

  it("supports one manual combat event creating multiple linked effect rows", () => {
    const parsed = combatEffectsStateSchema.parse({
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
          id: "effect-damage",
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
          description: "Bleed 1",
          duration: "until stopped",
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
          damage: 0,
          description: "Dropped weapon",
          effectGroup: "special",
          generalDamage: 0,
          id: "effect-special",
          sourceEventId: "event-1",
          status: "active",
          targetParticipantId: "participant-1",
          type: "special",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
    });

    expect(parsed.effects).toHaveLength(4);
    expect(new Set(parsed.effects.map((effect) => effect.sourceEventId))).toEqual(
      new Set(["event-1"]),
    );
  });

  it("allows effect rows with no modifier/effect group", () => {
    const parsed = combatEffectsStateSchema.parse({
      effects: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          damage: 5,
          effectGroup: "none",
          generalDamage: 0,
          id: "effect-damage",
          location: "rightArm",
          sourceEventId: "event-1",
          status: "active",
          targetParticipantId: "participant-1",
          type: "physical_damage",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          id: "event-1",
          sourceLabel: "Axe hit",
          targetParticipantId: "participant-1",
        },
      ],
    });

    expect(parsed.effects[0]?.effectGroup).toBe("none");
  });
});
