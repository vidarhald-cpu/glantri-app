import { describe, expect, it } from "vitest";

import type { CombatEffectsState } from "@glantri/domain";

import { applyCombatEffectDraft, removeCombatEffect } from "./combatEffectEdits";

describe("shared Physical state combat-effect edits", () => {
  it("adds one effect per selected location plus a manual event for the target", () => {
    const next = applyCombatEffectDraft({
      draft: {
        damage: 4,
        effectGroup: "damage",
        locationIds: ["chest", "general"],
        roundNumber: 2,
        status: "active",
        type: "physical_damage",
      } as never,
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      targetParticipantId: "participant-npc",
    });

    expect(next.effects).toHaveLength(2);
    expect(next.effects[0]).toMatchObject({
      damage: 4,
      generalDamage: 0,
      location: "chest",
      targetParticipantId: "participant-npc",
      type: "physical_damage",
    });
    expect(next.effects[1]).toMatchObject({
      damage: 0,
      generalDamage: 4,
      location: undefined,
      type: "general_damage",
    });
    expect(next.events).toHaveLength(1);
    expect(next.events[0]).toMatchObject({
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      sourceLabel: "R2 · physical damage",
      sourceType: "manual",
      targetParticipantId: "participant-npc",
    });
    expect(next.effects[0]?.sourceEventId).toBe(next.events[0]?.id);
  });

  it("edits an existing effect in place and removes effects by id", () => {
    const current = {
      effects: [{ id: "effect-a", createdAt: "2026-01-01T00:00:00.000Z" }, { id: "effect-b" }],
      events: [{ id: "event-a", createdAt: "2026-01-01T00:00:00.000Z", description: "Hit" }],
    } as unknown as CombatEffectsState;

    const edited = applyCombatEffectDraft({
      combatEffects: current,
      draft: {
        damage: 2,
        effectGroup: "damage",
        effectId: "effect-a",
        locationIds: ["head"],
        sourceEventId: "event-a",
        status: "active",
        type: "physical_damage",
      } as never,
      targetParticipantId: "participant-npc",
    });

    expect(edited.effects.map((effect) => effect.id)).toEqual(["effect-a", "effect-b"]);
    expect(edited.effects[0]).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      location: "head",
    });
    expect(edited.events).toHaveLength(1);
    expect(edited.events[0]).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "event-a",
    });

    expect(removeCombatEffect(current, "effect-a").effects.map((effect) => effect.id)).toEqual([
      "effect-b",
    ]);
    expect(removeCombatEffect(undefined, "effect-a")).toEqual({ effects: [], events: [] });
  });
});
