import type {
  CombatEffect,
  CombatEffectsState,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import { lookupWorkbookPercentageAdjustment } from "@glantri/rules-engine";

import { getPlayerEncounterCombatModifierTotals } from "./playerEncounter";

export interface EncounterCombatEffectModifierSums {
  db: number;
  fatigue: number;
  general: number;
  generalFatigue: number;
  obSkill: number;
}

export interface EncounterLiveCombatModifierSummary {
  dbRaw: number;
  generalFatigueRaw: number;
  modifierNoteLabels: string[];
  obSkillRaw: number;
}

function isActiveCombatEffect(effect: CombatEffect): boolean {
  return effect.status === "active";
}

function getEffectMagnitude(effect: CombatEffect): number {
  if (effect.modifierValue != null) {
    return effect.modifierValue;
  }

  if (effect.damage !== 0) {
    return effect.damage;
  }

  return effect.generalDamage;
}

function contributesToModifier(effect: CombatEffect): boolean {
  return (
    effect.type !== "physical_damage" &&
    effect.type !== "general_damage" &&
    effect.type !== "bleed" &&
    effect.type !== "internal_bleed"
  );
}

export function sumEncounterCombatEffectModifiers(
  combatEffects?: CombatEffectsState,
): EncounterCombatEffectModifierSums {
  const activeEffects = combatEffects?.effects.filter(isActiveCombatEffect) ?? [];
  const fatigue = activeEffects
    .filter((effect) => contributesToModifier(effect) && (effect.type === "fatigue" || effect.effectGroup === "fatigue"))
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);
  const general = activeEffects
    .filter(
      (effect) =>
        contributesToModifier(effect) &&
        effect.effectGroup === "general" &&
        effect.type !== "fatigue",
    )
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);
  const obSkill = activeEffects
    .filter((effect) => contributesToModifier(effect) && effect.effectGroup === "obSkill")
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);
  const db = activeEffects
    .filter((effect) => contributesToModifier(effect) && effect.effectGroup === "db")
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);

  return {
    db,
    fatigue,
    general,
    generalFatigue: general + fatigue,
    obSkill,
  };
}

export function buildEncounterLiveCombatModifierSummary(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
}): EncounterLiveCombatModifierSummary {
  const effectSums = sumEncounterCombatEffectModifiers(input.combatEffects);
  const contextTotals = getPlayerEncounterCombatModifierTotals(input.combatContext);

  return {
    dbRaw: effectSums.db + contextTotals.situationDbTotal,
    generalFatigueRaw: effectSums.generalFatigue,
    modifierNoteLabels: ["Gen/Fatigue", "OB/Skill", "DB", "Enc", "Equipment"],
    obSkillRaw: effectSums.obSkill + contextTotals.situationObSkillTotal,
  };
}

export function applyLiveRawModifierToCombatValue(input: {
  baseValue: number;
  rawModifier: number;
}): number {
  if (input.rawModifier === 0) {
    return input.baseValue;
  }

  const adjustment = lookupWorkbookPercentageAdjustment(
    input.baseValue,
    Math.abs(input.rawModifier),
  );

  if (adjustment == null) {
    return input.baseValue;
  }

  return input.rawModifier > 0 ? input.baseValue + adjustment : input.baseValue - adjustment;
}
