import type {
  CombatEffect,
  CombatEffectsState,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import {
  getMergedCombatInitiativeModifierTotal,
  getMergedCombatSkillObModifierTotal,
} from "@glantri/domain";
import {
  calculateWorkbookPercentageAdjustmentTrace,
  lookupWorkbookPercentageAdjustment,
  type WorkbookRawModifier,
} from "@glantri/rules-engine";

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
  initiativeRaw: number;
  modifierNoteLabels: string[];
  obSkillRaw: number;
}

export type EncounterCombatPhaseKey = "phase1" | "phase2";

export interface EncounterDbParryModifierCalculation {
  baseValue: number;
  finalValue: number;
  percentageAdjustment: number;
  rawModifierTotal: number;
  rawModifiers: WorkbookRawModifier[];
}

export interface EncounterInitiativeModifierCalculation {
  baseInitiative: number;
  modifiedInitiative: number;
  modifierAdjustment: number;
  rawModifierTotal: number;
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
    .filter(
      (effect) =>
        contributesToModifier(effect) &&
        (effect.type === "fatigue" || effect.effectGroup === "fatigue"),
    )
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
  phaseKey?: EncounterCombatPhaseKey;
}): EncounterLiveCombatModifierSummary {
  const effectSums = sumEncounterCombatEffectModifiers(input.combatEffects);
  const phaseAwareCombatContext = input.combatContext
    ? {
        ...input.combatContext,
        modifierBuckets: {
          general: filterCombatModifierEntriesForPhase(
            input.combatContext.modifierBuckets.general,
            input.phaseKey,
          ),
          situationDb: filterCombatModifierEntriesForPhase(
            input.combatContext.modifierBuckets.situationDb,
            input.phaseKey,
          ),
          situationInitiative: filterCombatModifierEntriesForPhase(
            input.combatContext.modifierBuckets.situationInitiative,
            input.phaseKey,
          ),
          situationObSkill: filterCombatModifierEntriesForPhase(
            input.combatContext.modifierBuckets.situationObSkill,
            input.phaseKey,
          ),
        },
      }
    : undefined;
  const contextTotals = getPlayerEncounterCombatModifierTotals(phaseAwareCombatContext);

  return {
    // dbRaw uses the legacy situationDb storage bucket, now presented as DB/Parry.
    dbRaw: effectSums.db + contextTotals.situationDbTotal,
    generalFatigueRaw: effectSums.generalFatigue,
    initiativeRaw: getMergedCombatInitiativeModifierTotal({
      combatContext: phaseAwareCombatContext,
    }),
    modifierNoteLabels: [
      "Gen/Fatigue",
      "Initiative",
      "OB/Skill",
      "DB/Parry",
      "Enc",
      "Equipment",
    ],
    obSkillRaw: getMergedCombatSkillObModifierTotal({
      combatContext: phaseAwareCombatContext,
    }),
  };
}

export function filterCombatModifierEntriesForPhase(
  entries: ScenarioCombatModifierEntry[],
  phaseKey?: EncounterCombatPhaseKey,
): ScenarioCombatModifierEntry[] {
  return entries.filter(
    (entry) => !entry.sourcePhase || (phaseKey != null && entry.sourcePhase === phaseKey),
  );
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

export function buildEncounterInitiativeModifierCalculation(input: {
  baseInitiative: number;
  combatContext?: ScenarioParticipantCombatContext;
  phaseKey?: EncounterCombatPhaseKey;
}): EncounterInitiativeModifierCalculation {
  const rawModifierTotal = getMergedCombatInitiativeModifierTotal({
    combatContext: input.combatContext,
    phase: input.phaseKey,
  });
  const modifiedInitiative = applyLiveRawModifierToCombatValue({
    baseValue: input.baseInitiative,
    rawModifier: rawModifierTotal,
  });

  return {
    baseInitiative: input.baseInitiative,
    modifiedInitiative,
    modifierAdjustment: modifiedInitiative - input.baseInitiative,
    rawModifierTotal,
  };
}

export function buildEncounterDbParryModifierCalculation(input: {
  baseValue: number;
  extraRawModifiers?: readonly WorkbookRawModifier[];
  liveModifiers?: EncounterLiveCombatModifierSummary;
}): EncounterDbParryModifierCalculation | null {
  const rawModifiers: WorkbookRawModifier[] = [
    {
      label: "General/Fatigue",
      value: input.liveModifiers?.generalFatigueRaw ?? 0,
    },
    {
      label: "DB/Parry",
      value: input.liveModifiers?.dbRaw ?? 0,
    },
    ...(input.extraRawModifiers ?? []),
  ].filter((modifier) => modifier.value !== 0);
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: input.baseValue,
    rawModifiers,
  });

  if (!trace) {
    return null;
  }

  return trace;
}
