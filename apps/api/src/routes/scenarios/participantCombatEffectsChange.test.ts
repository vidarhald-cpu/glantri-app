import { describe, expect, it } from "vitest";

import type { CombatEffect, CombatEffectEvent, CombatEffectsState } from "@glantri/domain";

import {
  applyParticipantCombatEffectsChange,
  ParticipantCombatEffectsChangeConflict,
  parseParticipantCombatEffectsChange,
} from "./participantCombatEffectsChange";

const NOW = "2026-11-10T20:00:00.000Z";

function effect(id: string, overrides: Partial<CombatEffect> = {}): CombatEffect {
  return {
    createdAt: NOW,
    damage: 2,
    effectGroup: "none",
    generalDamage: 0,
    id,
    location: "chest",
    sourceEventId: `${id}-event`,
    status: "active",
    targetParticipantId: "npc-1",
    type: "physical_damage",
    updatedAt: NOW,
    ...overrides,
  };
}

function event(id: string, overrides: Partial<CombatEffectEvent> = {}): CombatEffectEvent {
  return {
    createdAt: NOW,
    description: id,
    id,
    sourceLabel: id,
    sourceType: "manual",
    targetParticipantId: "npc-1",
    ...overrides,
  };
}

/** What the GM's screen loaded. */
const shown: CombatEffectsState = {
  effects: [effect("gm-cut")],
  events: [event("gm-cut-event")],
};

/** What is stored when the save arrives: combat added a hit meanwhile. */
const stored: CombatEffectsState = {
  effects: [...shown.effects, effect("combat-hit", { damage: 4 })],
  events: [...shown.events, event("combat-hit-event", { sourceType: "combat_action" })],
};

const ids = (state: CombatEffectsState) => state.effects.map((entry) => entry.id);

describe("applyParticipantCombatEffectsChange (#1126)", () => {
  it("adds the GM's effect and event to the stored state, keeping what combat wrote meanwhile", () => {
    const next = applyParticipantCombatEffectsChange({
      change: {
        effects: [effect("gm-new")],
        event: event("gm-new-event"),
        kind: "save_effect",
      },
      combatEffects: stored,
    });

    expect(ids(next)).toEqual(["gm-cut", "combat-hit", "gm-new"]);
    expect(next.events.map((entry) => entry.id)).toEqual([
      "gm-cut-event",
      "combat-hit-event",
      "gm-new-event",
    ]);
  });

  it("removes only the named effect, and treats one already gone as done", () => {
    expect(
      ids(
        applyParticipantCombatEffectsChange({
          change: { effectId: "gm-cut", kind: "remove_effect" },
          combatEffects: stored,
        }),
      ),
    ).toEqual(["combat-hit"]);
    expect(
      applyParticipantCombatEffectsChange({
        change: { effectId: "expired-meanwhile", kind: "remove_effect" },
        combatEffects: stored,
      }),
    ).toEqual(stored);
  });

  it("edits an unchanged effect in place, splitting it across locations, and keeps the rest", () => {
    const next = applyParticipantCombatEffectsChange({
      change: {
        effects: [effect("gm-cut", { damage: 5 }), effect("gm-cut-head", { location: "head" })],
        event: event("gm-cut-event", { description: "Edited" }),
        kind: "save_effect",
        previousEffect: shown.effects[0],
        previousEvent: shown.events[0],
      },
      combatEffects: stored,
    });

    expect(ids(next)).toEqual(["gm-cut", "gm-cut-head", "combat-hit"]);
    expect(next.effects[0]?.damage).toBe(5);
    expect(next.events[0]?.description).toBe("Edited");
    expect(next.events).toHaveLength(2);
  });

  it("links a new effect to an unchanged existing event", () => {
    const next = applyParticipantCombatEffectsChange({
      change: {
        effects: [effect("gm-linked", { sourceEventId: "gm-cut-event" })],
        event: event("gm-cut-event"),
        kind: "save_effect",
        previousEvent: shown.events[0],
      },
      combatEffects: stored,
    });

    expect(ids(next)).toEqual(["gm-cut", "combat-hit", "gm-linked"]);
    expect(next.events).toHaveLength(2);
  });

  it("compares the edited records by content, whatever their key order", () => {
    const reordered = Object.fromEntries(
      Object.entries(shown.effects[0]!).reverse(),
    ) as CombatEffect;

    expect(() =>
      applyParticipantCombatEffectsChange({
        change: {
          effects: [effect("gm-cut", { damage: 1 })],
          event: event("gm-cut-event"),
          kind: "save_effect",
          previousEffect: reordered,
          previousEvent: shown.events[0],
        },
        combatEffects: stored,
      }),
    ).not.toThrow();
  });

  it.each([
    [
      "the edited effect changed meanwhile",
      {
        effects: [effect("combat-hit", { damage: 9 })],
        event: event("combat-hit-event"),
        previousEffect: effect("combat-hit", { damage: 1 }),
        previousEvent: event("combat-hit-event", { sourceType: "combat_action" }),
      },
    ],
    [
      "the edited effect is gone",
      {
        effects: [effect("expired-meanwhile")],
        event: event("gm-cut-event"),
        previousEffect: effect("expired-meanwhile"),
        previousEvent: shown.events[0],
      },
    ],
    [
      "the event it links to changed meanwhile",
      {
        effects: [effect("gm-linked")],
        event: event("combat-hit-event"),
        previousEvent: event("combat-hit-event"),
      },
    ],
    [
      "the event it creates already exists",
      { effects: [effect("gm-linked")], event: event("combat-hit-event") },
    ],
    [
      "an effect it adds already exists",
      { effects: [effect("combat-hit")], event: event("gm-new-event") },
    ],
  ])("refuses, writing nothing, when %s", (_label, change) => {
    expect(() =>
      applyParticipantCombatEffectsChange({
        change: { kind: "save_effect", ...change },
        combatEffects: stored,
      }),
    ).toThrow(ParticipantCombatEffectsChangeConflict);
  });
});

describe("parseParticipantCombatEffectsChange (#1126)", () => {
  it("accepts the two change kinds and validates their records", () => {
    expect(parseParticipantCombatEffectsChange({ effectId: "x", kind: "remove_effect" })).toEqual({
      effectId: "x",
      kind: "remove_effect",
    });
    expect(
      parseParticipantCombatEffectsChange({
        effects: [effect("a")],
        event: event("a-event"),
        kind: "save_effect",
        previousEffect: null,
      }),
    ).toMatchObject({
      effects: [{ id: "a" }],
      event: { id: "a-event" },
      previousEffect: undefined,
    });
  });

  it.each([
    [{ kind: "replace_all" }],
    [{ kind: "remove_effect" }],
    [{ effects: [], event: event("e"), kind: "save_effect" }],
    [{ effects: [{ id: "bad" }], event: event("e"), kind: "save_effect" }],
    [
      {
        effects: [effect("a")],
        event: event("e"),
        kind: "save_effect",
        previousEvent: event("other"),
      },
    ],
  ])("rejects a malformed change %#", (change) => {
    expect(() => parseParticipantCombatEffectsChange(change)).toThrow();
  });
});
