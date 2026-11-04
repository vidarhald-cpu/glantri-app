import type {
  CombatCalculationContext,
  CombatEffect,
  CombatEffectsState,
  CombatModifierContribution,
  CombatObservationRelationship,
  CombatRoundStep,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import {
  buildCombatObservationModifierContributions,
  buildLiveCombatModifierContributionProjection,
  createCombatParticipantPairKey,
  getCombatEffectEffectiveStatus,
  getMergedCombatInitiativeModifierTotal,
  isCombatModifierContributionActive,
  normalizeScenarioCombatModifierEntry,
  resolveCombatModifierContributions,
} from "@glantri/domain";
import {
  calculateWorkbookPercentageAdjustmentTrace,
  resolveWorkbookPercentageAdjustment,
  type WorkbookPercentageAdjustmentAxis,
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
  legacyGeneralEffectEntries?: readonly {
    id: string;
    label: string;
    value: number;
  }[];
  modifierNoteLabels: string[];
  obSkillRaw: number;
  opponentLabel?: string;
  opponentParticipantId?: string;
  opponentSpecificContributions?: readonly CombatModifierContribution[];
  provisional?: boolean;
  specialEffectCount?: number;
  specialEffectIds?: readonly string[];
}

/**
 * Complete presentation context for one live participant/opponent calculation.
 *
 * Source modifier rows, effects, and observation relationships remain canonical.
 * This context only supplies the same identities used by the domain applicability
 * resolver so the live panel and mini-tables can present the applicable subset.
 */
export interface EncounterLiveCombatModifierContext {
  actionId?: string;
  encounterId?: string;
  opponentCombatantId?: string;
  opponentLabel?: string;
  opponentParticipantId?: string;
  opportunityId?: string;
  ownerCombatantId?: string;
  ownerParticipantId?: string;
  pairKey?: string;
  phaseKey?: EncounterCombatPhaseKey;
  proposalId?: string;
  provisional?: boolean;
  relationships?: readonly CombatObservationRelationship[];
  rollType?: string;
  roundNumber?: number;
  step?: CombatRoundStep;
}

export interface EncounterLiveCombatModifierParticipantIdentity {
  characterId?: string;
  id: string;
  label?: string;
  scenarioParticipantId?: string;
}

/**
 * Resolves the encounter-combatant and scenario-participant aliases once so every
 * live presentation consumer uses the same ordered actor -> opponent identity.
 */
export function resolveEncounterLiveCombatModifierContext(input: {
  actionId?: string;
  encounterId?: string;
  ownerCombatantId?: string;
  ownerParticipantId?: string;
  participants: readonly EncounterLiveCombatModifierParticipantIdentity[];
  phaseKey?: EncounterCombatPhaseKey;
  provisional?: boolean;
  relationships?: readonly CombatObservationRelationship[];
  roundNumber?: number;
  step?: CombatRoundStep;
  targetParticipantId?: string;
}): EncounterLiveCombatModifierContext {
  const candidateOpponent = input.targetParticipantId
    ? input.participants.find(
        (participant) =>
          participant.id === input.targetParticipantId ||
          participant.scenarioParticipantId === input.targetParticipantId ||
          participant.characterId === input.targetParticipantId,
      )
    : undefined;
  const ownerAliases = new Set(
    [input.ownerCombatantId, input.ownerParticipantId].filter((identity): identity is string =>
      Boolean(identity),
    ),
  );
  const opponentAliases = [
    candidateOpponent?.id,
    candidateOpponent?.scenarioParticipantId,
    candidateOpponent?.characterId,
  ].filter((identity): identity is string => Boolean(identity));
  // A stale declaration/selection may point back at the inspected participant through another
  // alias. That is not an opponent context and must not be allowed to fabricate a self-pair.
  const opponent = opponentAliases.some((identity) => ownerAliases.has(identity))
    ? undefined
    : candidateOpponent;

  return {
    actionId: input.actionId,
    encounterId: input.encounterId,
    opponentCombatantId: opponent?.id,
    opponentLabel: opponent?.label,
    opponentParticipantId: opponent?.scenarioParticipantId ?? opponent?.id,
    ownerCombatantId: input.ownerCombatantId,
    ownerParticipantId: input.ownerParticipantId,
    phaseKey: input.phaseKey,
    provisional: input.provisional,
    relationships: input.relationships,
    roundNumber: input.roundNumber,
    step: input.step,
  };
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
  /**
   * Whether the percentage adjustment this figure used was resolved past the edge of the authored
   * workbook grid (#922). Carried for review; no surface displays it yet — that is #940.
   */
  extrapolated: boolean;
  /**
   * Which grid edges the adjustment was resolved outside. Taken from the rules-engine type rather
   * than restated, so a new edge — `base_below_zero` under the #922 ruling — cannot be carried by
   * the lookup and silently dropped by this type (#922).
   */
  extrapolatedAxes: readonly WorkbookPercentageAdjustmentAxis[];
  modifiedInitiative: number;
  modifierAdjustment: number;
  rawModifierTotal: number;
  /**
   * `false` when the rule had no reading of the input at all, so `modifiedInitiative` is the
   * unadjusted base and `rawModifierTotal` was not applied to it (#922).
   *
   * Carried because without it a refused adjustment is indistinguishable in this object from a
   * figure the rule answered with no adjustment: both report `modifierAdjustment: 0` beside a
   * non-zero `rawModifierTotal`. Which surfaces display it is #940 and a Product Owner decision;
   * nothing here renders it.
   */
  resolved: boolean;
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

const NON_OPERATIONAL_SPECIAL_EFFECT_TYPES = new Set<CombatEffect["type"]>([
  "physical_damage",
  "general_damage",
  "bleed",
  "internal_bleed",
  "healing",
]);

export function sumEncounterCombatEffectModifiers(
  combatEffects?: CombatEffectsState,
  currentInitiativeGroupId?: string,
  currentRound?: number,
): EncounterCombatEffectModifierSums {
  const activeEffects =
    combatEffects?.effects.filter(
      (effect) =>
        getCombatEffectEffectiveStatus(effect, { currentInitiativeGroupId }) === "active" &&
        (currentRound === undefined ||
          effect.expiresAtRound === undefined ||
          effect.expiresAtRound >= currentRound),
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
  currentRound?: number;
  encounterId?: string;
  ownerParticipantId?: string;
  phaseKey?: EncounterCombatPhaseKey;
}): EncounterLiveCombatModifierSummary {
  const effectSums = sumEncounterCombatEffectModifiers(
    input.combatEffects,
    input.currentInitiativeGroupId,
    input.currentRound,
  );
  const liveProjection = buildLiveCombatModifierContributionProjection({
    combatContext: input.combatContext,
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.currentRound,
    encounterId: input.encounterId,
    ownerParticipantId: input.ownerParticipantId,
  });
  const projectedIds = new Set(liveProjection.contributions.map((contribution) => contribution.id));
  const legacySourceContributions = (
    [
      ["general", input.combatContext?.modifierBuckets.general ?? []],
      ["situation_initiative", input.combatContext?.modifierBuckets.situationInitiative ?? []],
      ["situation_ob_skill", input.combatContext?.modifierBuckets.situationObSkill ?? []],
      ["situation_db", input.combatContext?.modifierBuckets.situationDb ?? []],
    ] as const
  ).flatMap(([bucket, entries]) =>
    entries.flatMap((entry) => {
      if (entry.application === "flat_db" || projectedIds.has(entry.id)) return [];
      const contribution = normalizeScenarioCombatModifierEntry({
        bucket,
        currentRound: input.currentRound,
        entry,
        ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
      });
      return contribution &&
        isCombatModifierContributionActive(contribution, {
          encounterId: input.encounterId,
          ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
          roundNumber: input.currentRound,
        })
        ? [contribution]
        : [];
    }),
  );
  const phaseContributions = [...liveProjection.contributions, ...legacySourceContributions].filter(
    (contribution) =>
      !contribution.applicability.phase ||
      (input.phaseKey !== undefined && contribution.applicability.phase === input.phaseKey),
  );
  const sumBucket = (bucket: CombatModifierContribution["bucket"]) =>
    phaseContributions
      .filter((contribution) => contribution.bucket === bucket)
      .reduce((total, contribution) => total + contribution.value, 0);
  const dbFlatAdjustment = (input.combatContext?.modifierBuckets.situationDb ?? [])
    .filter(
      (entry) =>
        entry.application === "flat_db" &&
        (!entry.sourcePhase ||
          (input.phaseKey !== undefined && entry.sourcePhase === input.phaseKey)),
    )
    .reduce((total, entry) => {
      const contribution = normalizeScenarioCombatModifierEntry({
        bucket: "situation_db",
        currentRound: input.currentRound,
        entry,
        ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
      });
      return contribution &&
        isCombatModifierContributionActive(contribution, {
          encounterId: input.encounterId,
          ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
          roundNumber: input.currentRound,
        })
        ? total + entry.value
        : total;
    }, 0);
  const effectById = new Map(
    (input.combatEffects?.effects ?? []).map((effect) => [effect.id, effect] as const),
  );
  const specialEffectIds = liveProjection.specialEffectIds.filter((effectId) => {
    const effect = effectById.get(effectId);
    return Boolean(effect && !NON_OPERATIONAL_SPECIAL_EFFECT_TYPES.has(effect.type));
  });
  const legacyGeneralEffectEntries = (input.combatEffects?.effects ?? [])
    .filter(
      (effect) =>
        effect.combatModifierBucket === undefined &&
        contributesToModifier(effect) &&
        (effect.effectGroup === "general" || effect.effectGroup === "fatigue") &&
        getCombatEffectEffectiveStatus(effect, {
          currentInitiativeGroupId: input.currentInitiativeGroupId,
        }) === "active" &&
        (input.currentRound === undefined ||
          effect.expiresAtRound === undefined ||
          effect.expiresAtRound >= input.currentRound),
    )
    .map((effect) => ({
      id: effect.id,
      label: effect.description?.trim() || effect.type.replaceAll("_", " "),
      value: getEffectMagnitude(effect),
    }))
    .filter((entry) => entry.value !== 0);
  return {
    // dbRaw uses the legacy situationDb storage bucket, now presented as DB/Parry.
    dbRaw: sumBucket("db_parry") + effectSums.combatWideGeneral,
    dbFlatAdjustment,
    generalFatigueRaw: effectSums.generalFatigue,
    initiativeRaw: sumBucket("initiative") + effectSums.combatWideGeneral,
    modifierNoteLabels: ["Gen/Fatigue", "Initiative", "OB/Skill", "DB/Parry", "Enc", "Equipment"],
    legacyGeneralEffectEntries,
    obSkillRaw: sumBucket("skill_ob") + effectSums.combatWideGeneral,
    opponentSpecificContributions: [],
    provisional: false,
    specialEffectCount: specialEffectIds.length,
    specialEffectIds,
  };
}

function buildObservationCalculationContext(
  context: EncounterLiveCombatModifierContext,
): CombatCalculationContext | undefined {
  if (!context.ownerParticipantId || !context.opponentParticipantId) return undefined;

  return {
    actionId: context.actionId,
    encounterId: context.encounterId,
    opponentParticipantId: context.opponentParticipantId,
    opportunityId: context.opportunityId,
    ownerParticipantId: context.ownerParticipantId,
    pairKey:
      context.pairKey ??
      createCombatParticipantPairKey(context.ownerParticipantId, context.opponentParticipantId),
    phase: context.phaseKey,
    proposalId: context.proposalId,
    rollType: context.rollType,
    roundNumber: context.roundNumber,
    step: context.step,
  };
}

/**
 * Adds only opponent-specific canonical contributions to an already phase-aware
 * live summary. Ordinary round modifiers are already represented in the loadout
 * model and must not be applied a second time.
 */
export function buildTargetAwareEncounterLiveCombatModifierSummary(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  context: EncounterLiveCombatModifierContext;
  currentInitiativeGroupId?: string;
}): EncounterLiveCombatModifierSummary {
  const base = buildEncounterLiveCombatModifierSummary({
    combatContext: input.combatContext,
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.context.roundNumber,
    encounterId: input.context.encounterId,
    ownerParticipantId: input.context.ownerParticipantId,
    phaseKey: input.context.phaseKey,
  });
  const calculationContext = buildObservationCalculationContext(input.context);
  if (
    !calculationContext ||
    !input.context.ownerCombatantId ||
    !input.context.opponentCombatantId
  ) {
    return {
      ...base,
      provisional: input.context.provisional === true,
    };
  }

  const opponentSpecificContributions = buildCombatObservationModifierContributions({
    encounterId: input.context.encounterId,
    observerCombatantId: input.context.ownerCombatantId,
    observerParticipantId: calculationContext.ownerParticipantId,
    opponentCombatantId: input.context.opponentCombatantId,
    opponentParticipantId: calculationContext.opponentParticipantId!,
    relationships: input.context.relationships ?? [],
  });
  const skillOb = resolveCombatModifierContributions({
    bucket: "skill_ob",
    context: calculationContext,
    contributions: opponentSpecificContributions,
  });
  const dbParry = resolveCombatModifierContributions({
    bucket: "db_parry",
    context: calculationContext,
    contributions: opponentSpecificContributions,
  });

  return {
    ...base,
    dbRaw: base.dbRaw + dbParry.total,
    obSkillRaw: base.obSkillRaw + skillOb.total,
    opponentLabel: input.context.opponentLabel,
    opponentParticipantId: input.context.opponentParticipantId,
    opponentSpecificContributions: [...skillOb.rows, ...dbParry.rows],
    provisional: input.context.provisional === true,
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

/**
 * One live percentage adjustment and whether the open-ended rule resolved it past the edge of the
 * authored workbook grid (#922 repair cycle 1, finding 4).
 *
 * `#922` opened `lookupWorkbookPercentageAdjustment` for every caller, which activated this one:
 * where it used to return the base unchanged past the grid's last authored row, it now returns an
 * extrapolated figure. Measured delta, base `a14c5c73` against the first #922 candidate:
 * `{baseValue: 9, rawModifier: -20}` returned 9 and now returns −11; `{9, -16}` returned 9 and now
 * returns −7; `{60, -3}` returned 60 and now returns 42; `{9, -15}` is −6 at both heads. So a
 * displayed combat figure changed value at exactly the inputs #922 is about, and the Product
 * Owner's ruling says every extrapolation is flagged for review.
 *
 * The flag is carried as data, here and on `EncounterInitiativeModifierCalculation`. **It has no
 * screen yet, deliberately:** which GM-visible surfaces show it, and how, is #940 and a Product
 * Owner decision naming surfaces and widths, so nothing here renders it.
 *
 * A base below zero is no longer one of those inputs. Under the Product Owner's ruling on #922
 * (comment 20793) the rule answers it at one point per raw step, flagged `base_below_zero`, so this
 * function now returns a resolved extrapolated figure where it used to return the base unchanged.
 * `{baseValue: -3, rawModifier: -4}` returned −3 at the previous candidate and returns −7 here.
 *
 * `extrapolated` is `false` when the rule has no reading of the input at all, which after the
 * ruling means a non-integer base or modifier. That is not an understatement: no adjustment is
 * applied in that case and the base is returned unchanged, so there is no extrapolated figure to
 * flag. The absent adjustment itself is reported by `resolved`, which
 * `buildEncounterInitiativeModifierCalculation` now carries onto the calculation so an unapplied
 * modifier is not recorded as an ordinary figure.
 */
export interface LiveRawModifierAdjustment {
  extrapolated: boolean;
  extrapolatedAxes: readonly WorkbookPercentageAdjustmentAxis[];
  /** `false` when the rule has no reading of the input and `value` is the unadjusted base. */
  resolved: boolean;
  value: number;
}

export function resolveLiveRawModifierAdjustment(input: {
  baseValue: number;
  rawModifier: number;
}): LiveRawModifierAdjustment {
  if (input.rawModifier === 0) {
    return { extrapolated: false, extrapolatedAxes: [], resolved: true, value: input.baseValue };
  }

  const adjustment = resolveWorkbookPercentageAdjustment(
    input.baseValue,
    Math.abs(input.rawModifier),
  );

  if (adjustment == null) {
    return { extrapolated: false, extrapolatedAxes: [], resolved: false, value: input.baseValue };
  }

  return {
    extrapolated: adjustment.extrapolated,
    extrapolatedAxes: adjustment.extrapolatedAxes,
    resolved: true,
    value:
      input.rawModifier > 0
        ? input.baseValue + adjustment.value
        : input.baseValue - adjustment.value,
  };
}

export function applyLiveRawModifierToCombatValue(input: {
  baseValue: number;
  rawModifier: number;
}): number {
  return resolveLiveRawModifierAdjustment(input).value;
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
  const adjustment = resolveLiveRawModifierAdjustment({
    baseValue: input.baseInitiative,
    rawModifier: rawModifierTotal,
  });

  return {
    baseInitiative: input.baseInitiative,
    extrapolated: adjustment.extrapolated,
    extrapolatedAxes: adjustment.extrapolatedAxes,
    modifiedInitiative: adjustment.value,
    modifierAdjustment: adjustment.value - input.baseInitiative,
    rawModifierTotal,
    resolved: adjustment.resolved,
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
