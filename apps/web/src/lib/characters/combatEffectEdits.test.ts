import { describe, expect, it } from "vitest";

import type { CombatEffectsState } from "@glantri/domain";

import { buildCombatEffectDraftChange, buildCombatEffectRemovalChange } from "./combatEffectEdits";

describe("shared Physical state combat-effect edits", () => {
  it("adds one effect per selected location plus a manual event for the target", () => {
    const change = buildCombatEffectDraftChange({
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

    if (change.kind !== "save_effect") throw new Error("expected a save");
    expect(change.previousEffect).toBeUndefined();
    expect(change.previousEvent).toBeUndefined();
    expect(change.effects).toHaveLength(2);
    expect(change.effects[0]).toMatchObject({
      damage: 4,
      generalDamage: 0,
      location: "chest",
      targetParticipantId: "participant-npc",
      type: "physical_damage",
    });
    expect(change.effects[1]).toMatchObject({
      damage: 0,
      generalDamage: 4,
      location: undefined,
      type: "general_damage",
    });
    expect(change.event).toMatchObject({
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      sourceLabel: "R2 · physical damage",
      sourceType: "manual",
      targetParticipantId: "participant-npc",
    });
    expect(change.effects[0]?.sourceEventId).toBe(change.event.id);
  });

  it("edits an existing effect and names the effect and event it replaces, as shown", () => {
    const current = {
      effects: [{ id: "effect-a", createdAt: "2026-01-01T00:00:00.000Z" }, { id: "effect-b" }],
      events: [{ id: "event-a", createdAt: "2026-01-01T00:00:00.000Z", description: "Hit" }],
    } as unknown as CombatEffectsState;

    const change = buildCombatEffectDraftChange({
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

    if (change.kind !== "save_effect") throw new Error("expected a save");
    expect(change.previousEffect).toBe(current.effects[0]);
    expect(change.previousEvent).toBe(current.events[0]);
    expect(change.effects.map((effect) => effect.id)).toEqual(["effect-a"]);
    expect(change.effects[0]).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      location: "head",
    });
    expect(change.event).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      description: "Hit",
      id: "event-a",
    });
  });

  it("removes an effect by id only, leaving everything else to the stored state", () => {
    expect(buildCombatEffectRemovalChange("effect-a")).toEqual({
      effectId: "effect-a",
      kind: "remove_effect",
    });
  });
});
