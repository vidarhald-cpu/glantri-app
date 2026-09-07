import { describe, expect, it } from "vitest";

import {
  combatEffectsStateSchema,
  getCombatEffectEffectiveStatus,
  transitionCombatCriticalBleedEffect,
} from "./combatEffects";

describe("combat effect state", () => {
  it("persists an auditable exact-rate Critical Bleed treatment transition", () => {
    const transitioned = transitionCombatCriticalBleedEffect({
      combatEffects: {
        effects: [
          {
            createdAt: "2026-09-06T10:00:00.000Z",
            criticalRuntime: {
              bleed: {
                allowedControlStates: ["active", "partial", "staunched_zero", "resolved"],
                controlState: "active",
                currentRate: { denominator: 2, numerator: 1 },
                firstTickRound: 3,
                kind: "external",
                rate: { denominator: 2, numerator: 1 },
                sourceEffectKey: "blunt|arm|12|03",
                sourceRate: "1 HP / 2 rounds",
              },
              criticalKey: "blunt|arm|12",
              fixtureVersion: "c1-five-key-post-393-2026-09-06",
              kind: "bleed",
            },
            damage: 0,
            effectGroup: "bleed",
            generalDamage: 0,
            id: "critical-bleed",
            sourceEventId: "critical-event",
            status: "active",
            targetParticipantId: "participant-1",
            type: "bleed",
            updatedAt: "2026-09-06T10:00:00.000Z",
          },
        ],
        events: [],
      },
      createdAt: "2026-09-06T10:05:00.000Z",
      createdByUserId: "gm-1",
      effectId: "critical-bleed",
      encounterId: "encounter-1",
      nextState: "partial",
      partialRate: { denominator: 4, numerator: 1 },
      roundNumber: 2,
      scenarioId: "scenario-1",
    });

    expect(transitioned).toMatchObject({
      nextState: "partial",
      previousState: "active",
      rate: { denominator: 4, numerator: 1 },
    });
    expect(transitioned.combatEffects.effects[0]?.criticalRuntime).toMatchObject({
      bleed: { controlState: "partial", currentRate: { denominator: 4, numerator: 1 } },
    });
    expect(transitioned.combatEffects.events[0]).toMatchObject({
      sourceType: "healing",
      targetParticipantId: "participant-1",
    });
  });

  it("derives pending initiative effects as active after their group boundary closes", () => {
    const effect = combatEffectsStateSchema.parse({
      effects: [
        {
          createdAt: "2026-07-24T10:00:00.000Z",
          createdInInitiativeGroupId: "round:2:phase:phase1:initiative:4",
          damage: 0,
          effectGroup: "general",
          effectiveAfterInitiativeGroupId: "round:2:phase:phase1:initiative:4",
          generalDamage: 0,
          id: "effect-pending",
          sourceEventId: "event-pending",
          status: "pending",
          targetParticipantId: "participant-1",
          type: "general_modifier",
          updatedAt: "2026-07-24T10:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-07-24T10:00:00.000Z",
          id: "event-pending",
          sourceLabel: "Initiative 4 consequence",
          targetParticipantId: "participant-1",
        },
      ],
    }).effects[0]!;

    expect(
      getCombatEffectEffectiveStatus(effect, {
        currentInitiativeGroupId: "round:2:phase:phase1:initiative:4",
      }),
    ).toBe("pending");
    expect(
      getCombatEffectEffectiveStatus(effect, {
        currentInitiativeGroupId: "round:2:phase:phase1:initiative:3",
      }),
    ).toBe("active");
  });

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

  it("accepts internal bleed as a combat effect type", () => {
    const parsed = combatEffectsStateSchema.parse({
      effects: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          damage: 0,
          description: "Internal bleed 2",
          effectGroup: "bleed",
          generalDamage: 0,
          id: "effect-internal-bleed",
          modifierValue: 2,
          sourceEventId: "event-1",
          status: "active",
          targetParticipantId: "participant-1",
          type: "internal_bleed",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          id: "event-1",
          sourceLabel: "Internal wound",
          targetParticipantId: "participant-1",
        },
      ],
    });

    expect(parsed.effects[0]?.type).toBe("internal_bleed");
  });

  it("accepts fatigue as a mechanical combat effect group", () => {
    const parsed = combatEffectsStateSchema.parse({
      effects: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          damage: 0,
          description: "Exhausted",
          effectGroup: "fatigue",
          generalDamage: 0,
          id: "effect-fatigue",
          modifierValue: 2,
          sourceEventId: "event-1",
          status: "active",
          targetParticipantId: "participant-1",
          type: "fatigue",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          id: "event-1",
          sourceLabel: "Long chase",
          targetParticipantId: "participant-1",
        },
      ],
    });

    expect(parsed.effects[0]?.effectGroup).toBe("fatigue");
  });

  it("keeps legacy modifier-style effect types parseable for saved combat effects", () => {
    const parsed = combatEffectsStateSchema.parse({
      effects: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          damage: 0,
          effectGroup: "obSkill",
          generalDamage: 0,
          id: "effect-legacy-ob",
          modifierValue: -4,
          sourceEventId: "event-legacy",
          status: "active",
          targetParticipantId: "participant-1",
          type: "ob_skill_modifier",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-05-17T10:00:00.000Z",
          id: "event-legacy",
          sourceLabel: "Older saved effect",
          targetParticipantId: "participant-1",
        },
      ],
    });

    expect(parsed.effects[0]?.type).toBe("ob_skill_modifier");
    expect(parsed.effects[0]?.combatModifierBucket).toBeUndefined();
  });

  it("accepts an explicit Initiative combat modifier bucket", () => {
    const parsed = combatEffectsStateSchema.parse({
      effects: [
        {
          combatModifierBucket: "initiative",
          createdAt: "2026-05-17T10:00:00.000Z",
          damage: 0,
          effectGroup: "other",
          generalDamage: 0,
          id: "effect-haste",
          modifierValue: 3,
          sourceEventId: "event-haste",
          status: "active",
          targetParticipantId: "participant-1",
          type: "other_modifier",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
      events: [],
    });

    expect(parsed.effects[0]?.combatModifierBucket).toBe("initiative");
  });
});
