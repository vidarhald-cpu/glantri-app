import {
  combatEffectEventSchema,
  combatEffectSchema,
  combatEffectsStateSchema,
  type CombatEffect,
  type CombatEffectEvent,
  type CombatEffectsState,
} from "@glantri/domain";

import { parseBodyObject, parseRequiredString } from "./parsing";

/**
 * A GM's combat-effect edit from the Character screen, sent as the change itself (#1126) so the
 * server applies it to the participant's state as stored, not to the copy the screen loaded.
 *
 * - `save_effect` adds the effects and their event. When the GM edited an existing effect or
 *   linked a new effect to an existing event, `previousEffect` / `previousEvent` carry the record
 *   as the screen showed it; it must still be stored unchanged, or the save is refused.
 * - `remove_effect` removes one effect by id. One that is already gone is not an error.
 */
export type ParticipantCombatEffectsChange =
  | {
      effects: CombatEffect[];
      event: CombatEffectEvent;
      kind: "save_effect";
      previousEffect?: CombatEffect;
      previousEvent?: CombatEffectEvent;
    }
  | { effectId: string; kind: "remove_effect" };

export const PARTICIPANT_STATE_CHANGED_MESSAGE =
  "This combatant changed meanwhile; the screen has been refreshed, please apply your change again.";

/** The record the GM edited changed or disappeared since the screen loaded it. */
export class ParticipantCombatEffectsChangeConflict extends Error {
  constructor() {
    super(PARTICIPANT_STATE_CHANGED_MESSAGE);
    this.name = "ParticipantCombatEffectsChangeConflict";
  }
}

export function parseParticipantCombatEffectsChange(
  value: unknown,
): ParticipantCombatEffectsChange {
  const change = parseBodyObject(value, "Combat effects change");

  if (change.kind === "remove_effect") {
    return { effectId: parseRequiredString(change, "effectId"), kind: "remove_effect" };
  }

  if (change.kind !== "save_effect") {
    throw new Error("Combat effects change kind must be save_effect or remove_effect.");
  }

  if (!Array.isArray(change.effects) || change.effects.length === 0) {
    throw new Error("Combat effects change must carry at least one effect.");
  }

  const event = combatEffectEventSchema.parse(change.event);
  const previousEvent =
    change.previousEvent == null ? undefined : combatEffectEventSchema.parse(change.previousEvent);

  if (previousEvent && previousEvent.id !== event.id) {
    throw new Error("The edited combat effect event must keep its id.");
  }

  return {
    effects: change.effects.map((effect) => combatEffectSchema.parse(effect)),
    event,
    kind: "save_effect",
    previousEffect:
      change.previousEffect == null ? undefined : combatEffectSchema.parse(change.previousEffect),
    previousEvent,
  };
}

/** Key-order-independent JSON, so a stored record and the screen's copy compare by content. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested as Record<string, unknown>).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
          ),
        )
      : nested,
  );
}

function sameEffect(stored: CombatEffect, shown: CombatEffect): boolean {
  return canonicalJson(combatEffectSchema.parse(stored)) === canonicalJson(shown);
}

function sameEvent(stored: CombatEffectEvent, shown: CombatEffectEvent): boolean {
  return canonicalJson(combatEffectEventSchema.parse(stored)) === canonicalJson(shown);
}

/**
 * Applies a GM's combat-effect change to the stored combat effects. Everything the change does not
 * name — damage, effects and events written by combat since the screen loaded — is kept as stored.
 *
 * @throws ParticipantCombatEffectsChangeConflict when the change edits a record that changed or
 * disappeared, or adds one whose id is already stored.
 */
export function applyParticipantCombatEffectsChange(input: {
  change: ParticipantCombatEffectsChange;
  combatEffects?: CombatEffectsState;
}): CombatEffectsState {
  const { change } = input;
  const current = combatEffectsStateSchema.parse(input.combatEffects);

  if (change.kind === "remove_effect") {
    return {
      ...current,
      effects: current.effects.filter((effect) => effect.id !== change.effectId),
    };
  }

  const replacedEffectId = change.previousEffect?.id;

  if (change.previousEffect) {
    const stored = current.effects.find((effect) => effect.id === replacedEffectId);

    if (!stored || !sameEffect(stored, change.previousEffect)) {
      throw new ParticipantCombatEffectsChangeConflict();
    }
  }

  const keptEffectIds = new Set(
    current.effects.filter((effect) => effect.id !== replacedEffectId).map((effect) => effect.id),
  );

  if (change.effects.some((effect) => keptEffectIds.has(effect.id))) {
    throw new ParticipantCombatEffectsChangeConflict();
  }

  const storedEvent = current.events.find((event) => event.id === change.event.id);

  if (
    change.previousEvent
      ? !storedEvent || !sameEvent(storedEvent, change.previousEvent)
      : Boolean(storedEvent)
  ) {
    throw new ParticipantCombatEffectsChangeConflict();
  }

  return {
    ...current,
    effects:
      replacedEffectId === undefined
        ? [...current.effects, ...change.effects]
        : current.effects.flatMap((effect) =>
            effect.id === replacedEffectId ? change.effects : [effect],
          ),
    events: storedEvent
      ? current.events.map((event) => (event.id === storedEvent.id ? change.event : event))
      : [...current.events, change.event],
  };
}
