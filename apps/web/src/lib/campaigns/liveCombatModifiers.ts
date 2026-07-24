import type {
  CombatEffect,
  CombatEffectsState,
  CombatRoundStep,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import {
  getCombatEffectEffectiveStatus,
  getMergedCombatDbParryModifierTotal,
  getMergedCombatDbFlatAdjustmentTotal,
  getMergedCombatInitiativeModifierTotal,
  getMergedCombatSkillObModifierTotal,
} from "@glantri/domain";
import {
  calculateWorkbookPercentageAdjustmentTrace,
  lookupWorkbookPercentageAdjustment,
  type WorkbookRawModifier,
} from "@glantri/rules-engine";

export interface EncounterCombatEffectModifierSums {
  combatWideGeneral: number;
  db: number;
  fatigue: number;
  general: number;
  generalFatigue: number;
  obSkill: number;
}

export interface EncounterLiveCombatModifierSummary {
  dbFlatAdjustment?: number;
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
  currentInitiativeGroupId?: string,
): EncounterCombatEffectModifierSums {
  const activeEffects =
    combatEffects?.effects.filter(
      (effect) =>
        getCombatEffectEffectiveStatus(effect, { currentInitiativeGroupId }) === "active",
    ) ?? [];
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
  const combatWideGeneral = activeEffects
    .filter(
      (effect) =>
        contributesToModifier(effect) &&
        effect.effectGroup === "general" &&
        effect.type !== "fatigue" &&
        effect.combatWide === true,
    )
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);
  const obSkill = activeEffects
    .filter((effect) => contributesToModifier(effect) && effect.effectGroup === "obSkill")
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);
  const db = activeEffects
    .filter((effect) => contributesToModifier(effect) && effect.effectGroup === "db")
    .reduce((total, effect) => total + getEffectMagnitude(effect), 0);

  return {
    combatWideGeneral,
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
  currentInitiativeGroupId?: string;
  phaseKey?: EncounterCombatPhaseKey;
}): EncounterLiveCombatModifierSummary {
  const effectSums = sumEncounterCombatEffectModifiers(
    input.combatEffects,
    input.currentInitiativeGroupId,
  );
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
  return {
    // dbRaw uses the legacy situationDb storage bucket, now presented as DB/Parry.
    dbRaw:
      getMergedCombatDbParryModifierTotal({
        combatContext: phaseAwareCombatContext,
      }) + effectSums.combatWideGeneral,
    dbFlatAdjustment: getMergedCombatDbFlatAdjustmentTotal({
      combatContext: phaseAwareCombatContext,
    }),
    generalFatigueRaw: effectSums.generalFatigue,
    initiativeRaw:
      getMergedCombatInitiativeModifierTotal({
        combatContext: phaseAwareCombatContext,
      }) + effectSums.combatWideGeneral,
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

/** Rows applied to a calculation. Future-phase rows are deliberately excluded. */
export const getCombatModifierRowsApplicableToPhase = filterCombatModifierEntriesForPhase;

/**
 * Rows visible for review at a combat step. M1 and the phase-1 resolution chain show the
 * participant's complete remaining round commitment; M2 and phase 2 hide expired P1 rows.
 * This display projection must not be used to calculate phase totals.
 */
export function getCombatModifierRowsVisibleAtStep(
  entries: ScenarioCombatModifierEntry[],
  step?: CombatRoundStep,
): ScenarioCombatModifierEntry[] {
  if (!step) return entries;

  const phase1AndFutureSteps: CombatRoundStep[] = [
    "select_actions",
    "review_action_modifiers",
    "initiative_phase_1",
    "phase_1_actions",
    "review_phase_2_actions",
    "phase_1_damage",
  ];
  if (phase1AndFutureSteps.includes(step)) return entries;

  const phase2Steps: CombatRoundStep[] = [
    "review_phase_2_modifiers",
    "initiative_phase_2",
    "phase_2_actions",
    "review_phase_2_damage",
    "phase_2_damage",
  ];
  if (phase2Steps.includes(step)) {
    return entries.filter((entry) => entry.sourcePhase !== "phase1");
  }

  return entries.filter((entry) => !entry.sourcePhase);
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
