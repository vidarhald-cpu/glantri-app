import { buildLiveCombatModifierContributionProjection } from "./combatModifierProjection";
import {
  isCombatModifierContributionActive,
  normalizeScenarioCombatModifierEntry,
  type CombatModifierContributionBucket,
} from "./combatModifierContributions";
import type { CombatEffectsState } from "./combatEffects";
import type { CombatRoundStep } from "./combatRoundStep";
import type {
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "../campaign/scenario";

/**
 * The canonical combat modifier-row projection.
 *
 * This moved out of `apps/web` for #951: the server derives and persists each committed step's
 * authoritative snapshot, and `modifierSummary.rows` is part of that snapshot. A second
 * server-side implementation of the same grouping would be a duplicate calculation path, so the
 * one implementation lives here and both the live GM/player panels and the server-side step
 * snapshot deriver call it. Presentation-only extras — per-entry duration labels — stay with the
 * caller and are supplied through `buildDurationLabels`.
 */

export type CombatModifierRowPhaseKey = "phase1" | "phase2";

export interface CombatModifierRowDisplayEntry {
  application?: ScenarioCombatModifierEntry["application"];
  canonicalLifecycle?: unknown;
  details?: string;
  id: string;
  scopeLabel: string;
  sourceLabel: string;
  value: number;
}

export interface CombatModifierRowBucketView {
  bucketKey: ScenarioCombatModifierBucket;
  characterStateEntries?: CombatModifierRowDisplayEntry[];
  derivedEntries?: CombatModifierRowDisplayEntry[];
  /** Known durations by entry id; set only when the caller opts in to duration presentation. */
  durationLabels?: Record<string, string>;
  entries: ScenarioCombatModifierEntry[];
  fatigueTotal?: number;
  label: string;
  locked?: boolean;
  total: number;
}

/**
 * The opponent-specific and legacy contributions a caller has already resolved. Typed
 * structurally so the web `EncounterLiveCombatModifierSummary` satisfies it without this module
 * depending on the web layer.
 */
export interface CombatModifierRowLiveInput {
  legacyGeneralEffectEntries?: readonly { id: string; label: string; value: number }[];
  opponentLabel?: string;
  opponentSpecificContributions?: readonly {
    bucket: CombatModifierContributionBucket;
    canonicalLifecycle?: unknown;
    id: string;
    label: string;
    value: number;
  }[];
}

export interface CombatModifierRowProjectionInput {
  buildDurationLabels?: (
    entries: readonly ScenarioCombatModifierEntry[],
  ) => Record<string, string> | undefined;
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  currentInitiativeGroupId?: string;
  currentRound?: number;
  encounterId?: string;
  includeAllPhases?: boolean;
  /** Opt in to per-row duration labels. Only the player's own live view sets this. */
  includeEntryDurations?: boolean;
  liveModifiers?: CombatModifierRowLiveInput;
  ownerParticipantId?: string;
  phaseKey?: CombatModifierRowPhaseKey;
  visibleAtStep?: CombatRoundStep;
}

export function createEmptyCombatModifierContext(): ScenarioParticipantCombatContext {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
  };
}

export function isMeaningfulCombatModifierEntry(entry: ScenarioCombatModifierEntry): boolean {
  return entry.value !== 0 || Boolean(entry.notes?.trim()) || Boolean(entry.sourceRule?.trim());
}

export function sanitizeCombatModifierEntries(
  entries: readonly ScenarioCombatModifierEntry[],
): ScenarioCombatModifierEntry[] {
  return entries.filter(isMeaningfulCombatModifierEntry);
}

export function filterCombatModifierEntriesForPhase(
  entries: ScenarioCombatModifierEntry[],
  phaseKey?: CombatModifierRowPhaseKey,
): ScenarioCombatModifierEntry[] {
  return entries.filter(
    (entry) => !entry.sourcePhase || (phaseKey != null && entry.sourcePhase === phaseKey),
  );
}

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
 * The phase key a step's recorded modifier rows are read under. `round_summary` and the two
 * pre-resolution steps carry no phase, exactly as the panels read them.
 */
export function getCombatModifierRowPhaseKeyForStep(
  step: CombatRoundStep,
): CombatModifierRowPhaseKey | undefined {
  if (
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage" ||
    step === "phase_2_damage"
  ) {
    return "phase2";
  }

  return step === "round_summary" ? undefined : "phase1";
}

export function buildCombatModifierRowProjection(
  input: CombatModifierRowProjectionInput,
): CombatModifierRowBucketView[] {
  const projection = buildLiveCombatModifierContributionProjection({
    combatContext: input.combatContext ?? createEmptyCombatModifierContext(),
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.currentRound,
    encounterId: input.encounterId,
    ownerParticipantId: input.ownerParticipantId,
  });
  const entriesForContributions = (bucket: CombatModifierContributionBucket) =>
    projection.contributions
      .filter((contribution) => contribution.bucket === bucket)
      .map((contribution) => projection.sourceEntries.get(contribution.id))
      .filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));
  const entriesForDisplay = (entries: ScenarioCombatModifierEntry[]) =>
    input.includeAllPhases
      ? entries
      : input.visibleAtStep
        ? getCombatModifierRowsVisibleAtStep(entries, input.visibleAtStep)
        : filterCombatModifierEntriesForPhase(entries, input.phaseKey);
  const activeFlatDbEntries = (input.combatContext?.modifierBuckets.situationDb ?? []).filter(
    (entry) => {
      if (entry.application !== "flat_db") return false;
      const contribution = normalizeScenarioCombatModifierEntry({
        bucket: "situation_db",
        currentRound: input.currentRound,
        entry,
        ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
      });
      return Boolean(
        contribution &&
          isCombatModifierContributionActive(contribution, {
            ...(input.encounterId ? { encounterId: input.encounterId } : {}),
            ...(input.currentRound !== undefined ? { roundNumber: input.currentRound } : {}),
            ownerParticipantId: input.ownerParticipantId ?? "unknown-participant",
          }),
      );
    },
  );
  const visibleFlatDbEntries = entriesForDisplay(activeFlatDbEntries);
  const displayModifierBuckets = {
    general: sanitizeCombatModifierEntries(
      entriesForDisplay(entriesForContributions("general_fatigue")),
    ),
    situationDb: sanitizeCombatModifierEntries([
      ...entriesForDisplay(entriesForContributions("db_parry")),
      ...visibleFlatDbEntries,
    ]),
    situationInitiative: sanitizeCombatModifierEntries(
      entriesForDisplay(entriesForContributions("initiative")),
    ),
    situationObSkill: sanitizeCombatModifierEntries(
      entriesForDisplay(entriesForContributions("skill_ob")),
    ),
  };
  const applicableContributions = projection.contributions.filter(
    (contribution) =>
      !contribution.applicability.phase ||
      (input.phaseKey !== undefined && contribution.applicability.phase === input.phaseKey),
  );
  const opponentSpecificContributions = input.liveModifiers?.opponentSpecificContributions ?? [];
  const derivedEntriesByBucket = new Map<
    CombatModifierContributionBucket,
    CombatModifierRowDisplayEntry[]
  >();
  for (const contribution of opponentSpecificContributions) {
    const entries = derivedEntriesByBucket.get(contribution.bucket) ?? [];
    entries.push({
      application: "percentage",
      canonicalLifecycle: contribution.canonicalLifecycle,
      id: contribution.id,
      scopeLabel: "Opponent",
      sourceLabel: `${contribution.label}${
        input.liveModifiers?.opponentLabel ? ` · ${input.liveModifiers.opponentLabel}` : ""
      }`,
      value: contribution.value,
    });
    derivedEntriesByBucket.set(contribution.bucket, entries);
  }
  const legacyGeneralEntries = (input.liveModifiers?.legacyGeneralEffectEntries ?? []).map(
    (entry): CombatModifierRowDisplayEntry => ({
      application: "percentage",
      id: `legacy-effect:${entry.id}`,
      scopeLabel: "Active",
      sourceLabel: entry.label,
      value: entry.value,
    }),
  );
  const totals = {
    dbParry:
      applicableContributions
        .filter((contribution) => contribution.bucket === "db_parry")
        .reduce((total, contribution) => total + contribution.value, 0) +
      visibleFlatDbEntries.reduce((total, entry) => total + entry.value, 0) +
      opponentSpecificContributions
        .filter((contribution) => contribution.bucket === "db_parry")
        .reduce((total, contribution) => total + contribution.value, 0),
    generalFatigue:
      applicableContributions
        .filter((contribution) => contribution.bucket === "general_fatigue")
        .reduce((total, contribution) => total + contribution.value, 0) +
      legacyGeneralEntries.reduce((total, entry) => total + entry.value, 0),
    initiative: applicableContributions
      .filter((contribution) => contribution.bucket === "initiative")
      .reduce((total, contribution) => total + contribution.value, 0),
    skillOb:
      applicableContributions
        .filter((contribution) => contribution.bucket === "skill_ob")
        .reduce((total, contribution) => total + contribution.value, 0) +
      opponentSpecificContributions
        .filter((contribution) => contribution.bucket === "skill_ob")
        .reduce((total, contribution) => total + contribution.value, 0),
  };

  const durationLabelsFor = (entries: readonly ScenarioCombatModifierEntry[]) =>
    input.includeEntryDurations ? input.buildDurationLabels?.(entries) : undefined;

  return [
    {
      bucketKey: "general",
      derivedEntries: legacyGeneralEntries,
      durationLabels: durationLabelsFor(displayModifierBuckets.general),
      entries: displayModifierBuckets.general,
      label: "General/Fatigue",
      locked: true,
      total: totals.generalFatigue,
    },
    {
      bucketKey: "situation_initiative",
      durationLabels: durationLabelsFor(displayModifierBuckets.situationInitiative),
      entries: displayModifierBuckets.situationInitiative,
      label: "Initiative",
      total: totals.initiative,
    },
    {
      bucketKey: "situation_ob_skill",
      durationLabels: durationLabelsFor(displayModifierBuckets.situationObSkill),
      entries: displayModifierBuckets.situationObSkill,
      derivedEntries: derivedEntriesByBucket.get("skill_ob"),
      label: "Skill/OB",
      total: totals.skillOb,
    },
    {
      bucketKey: "situation_db",
      durationLabels: durationLabelsFor(displayModifierBuckets.situationDb),
      entries: displayModifierBuckets.situationDb,
      derivedEntries: derivedEntriesByBucket.get("db_parry"),
      label: "DB/Parry",
      total: totals.dbParry,
    },
  ];
}
