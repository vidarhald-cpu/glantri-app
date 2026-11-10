import type { CombatEffect, CombatEffectEvent, CombatEffectsState } from "@glantri/domain";

import type { CombatEffectEditorDraft } from "@/features/equipment/components/PhysicalStateSection";

/**
 * Shared Physical state combat-effect edits (add/edit and remove), used by the
 * Character loadout view and by the GM-only NPC Physical state view (#1118).
 * Both callers persist the returned state through the participant-state route.
 */

function createCombatEffectId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function buildCombatEffectSourceLabel(draft: CombatEffectEditorDraft): string {
  if (draft.sourceLabel?.trim()) {
    return draft.sourceLabel.trim();
  }

  const roundLabel = draft.roundNumber ? `R${draft.roundNumber}` : "Manual";
  const detail =
    draft.eventDescription?.trim() || draft.description?.trim() || draft.type.replaceAll("_", " ");

  return `${roundLabel} · ${detail}`;
}

function buildCombatEffectsFromDraft(input: {
  draft: CombatEffectEditorDraft;
  eventId: string;
  existingEffect?: CombatEffect;
  now: string;
  targetParticipantId: string;
}): CombatEffect[] {
  const { draft, eventId, existingEffect, now, targetParticipantId } = input;
  const selectedLocations = draft.locationIds.length > 0 ? draft.locationIds : [""];

  return selectedLocations.map((selectedLocation, index) => {
    const isGeneralDamage = selectedLocation === "general";
    const isBodyLocation = Boolean(selectedLocation && selectedLocation !== "general");
    const effectType =
      isGeneralDamage && draft.type === "physical_damage" ? "general_damage" : draft.type;
    const reusableExistingEffect = index === 0 ? existingEffect : undefined;

    return {
      checkRequired: reusableExistingEffect?.checkRequired,
      checkSkillOrStat: reusableExistingEffect?.checkSkillOrStat,
      combatModifierBucket: draft.combatModifierBucket,
      createdAt: reusableExistingEffect?.createdAt ?? now,
      damage: isBodyLocation ? draft.damage : 0,
      description: draft.description,
      duration: draft.duration,
      effectGroup: draft.effectGroup,
      expiresAtRound: reusableExistingEffect?.expiresAtRound,
      generalDamage: isGeneralDamage ? draft.damage : 0,
      id: reusableExistingEffect?.id ?? createCombatEffectId("combat-effect"),
      location: isBodyLocation ? selectedLocation : undefined,
      modifierValue: draft.modifierValue,
      roundNumber: draft.roundNumber,
      sourceEventId: eventId,
      status: draft.status,
      targetParticipantId,
      type: effectType,
      updatedAt: now,
    };
  });
}

export function applyCombatEffectDraft(input: {
  combatEffects?: CombatEffectsState;
  draft: CombatEffectEditorDraft;
  encounterId?: string;
  scenarioId?: string;
  targetParticipantId: string;
}): CombatEffectsState {
  const { draft, targetParticipantId } = input;
  const now = new Date().toISOString();
  const currentCombatEffects = input.combatEffects ?? { effects: [], events: [] };
  const eventId = draft.sourceEventId ?? createCombatEffectId("combat-event");
  const existingEvent = currentCombatEffects.events.find((event) => event.id === eventId);
  const nextEvent: CombatEffectEvent = {
    createdAt: existingEvent?.createdAt ?? now,
    createdByUserId: existingEvent?.createdByUserId,
    description: draft.eventDescription ?? existingEvent?.description ?? "",
    encounterId: input.encounterId || undefined,
    id: eventId,
    phase: existingEvent?.phase,
    roundNumber: draft.roundNumber,
    scenarioId: input.scenarioId || undefined,
    sourceActorId: existingEvent?.sourceActorId,
    sourceLabel: buildCombatEffectSourceLabel(draft),
    sourceType: existingEvent?.sourceType ?? "manual",
    targetParticipantId,
  };

  const existingEffect = draft.effectId
    ? currentCombatEffects.effects.find((effect) => effect.id === draft.effectId)
    : undefined;
  const nextEffectsFromDraft = buildCombatEffectsFromDraft({
    draft,
    eventId,
    existingEffect,
    now,
    targetParticipantId,
  });

  return {
    effects: existingEffect
      ? currentCombatEffects.effects.flatMap((effect) =>
          effect.id === existingEffect.id ? nextEffectsFromDraft : [effect],
        )
      : [...currentCombatEffects.effects, ...nextEffectsFromDraft],
    events: existingEvent
      ? currentCombatEffects.events.map((event) =>
          event.id === existingEvent.id ? nextEvent : event,
        )
      : [...currentCombatEffects.events, nextEvent],
  };
}

export function removeCombatEffect(
  combatEffects: CombatEffectsState | undefined,
  effectId: string,
): CombatEffectsState {
  const currentCombatEffects = combatEffects ?? { effects: [], events: [] };

  return {
    ...currentCombatEffects,
    effects: currentCombatEffects.effects.filter((effect) => effect.id !== effectId),
  };
}
