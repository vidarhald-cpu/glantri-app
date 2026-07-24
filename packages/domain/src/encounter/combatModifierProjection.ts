import type {
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipantState,
} from "../campaign/scenario";
import {
  getCombatEffectEffectiveStatus,
  type CombatEffect,
  type CombatEffectEvent,
  type CombatEffectsState,
} from "./combatEffects";
import {
  isCombatModifierContributionActive,
  normalizeScenarioCombatModifierEntry,
  type CombatModifierContribution,
} from "./combatModifierContributions";

export const PERSISTENT_COMBAT_MODIFIER_SOURCE_TYPE = "character_effect" as const;

export interface ProjectPersistentCombatEffectModifiersInput {
  combatEffects?: CombatEffectsState;
  currentInitiativeGroupId?: string;
  currentRound?: number;
}

export interface PersistentCombatEffectModifierProjection {
  importedEffectIds: string[];
  modifierBuckets: ScenarioParticipantCombatContext["modifierBuckets"];
  pendingModifierEntries: ScenarioCombatModifierEntry[];
  specialEffectIds: string[];
  specialEffectCount: number;
}

export interface MergedCombatModifierTotals {
  dbParry: number;
  generalFatigue: number;
  initiative: number;
  skillOb: number;
}

export interface LiveCombatModifierContributionProjectionInput {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  currentInitiativeGroupId?: string;
  currentRound?: number;
  encounterId?: string;
  ownerParticipantId?: string;
}

/**
 * The live panel adapter is deliberately additive: combatEffects and persisted bucket entries
 * remain the source of truth. It returns normalized contributions plus the original rows keyed
 * by contribution id so existing editors can continue to issue their established row commands.
 * Initiative is the first calculation consumer; all other calculations remain on their
 * existing paths until their respective migration slices.
 */
export interface LiveCombatModifierContributionProjection {
  contributions: CombatModifierContribution[];
  pendingModifierEntries: ScenarioCombatModifierEntry[];
  sourceEntries: ReadonlyMap<string, ScenarioCombatModifierEntry>;
  specialEffectIds: string[];
  specialEffectCount: number;
}

export interface NormalizeCombatModifierRowsForEncounterInput {
  activeProposalIds?: readonly string[];
  combatContext?: ScenarioParticipantCombatContext;
  encounterId: string;
  initializingNewEncounter?: boolean;
  roundNumber: number;
}

const emptyModifierBuckets = (): ScenarioParticipantCombatContext["modifierBuckets"] => ({
  general: [],
  situationDb: [],
  situationInitiative: [],
  situationObSkill: [],
});

/**
 * Keeps scenario-persistent imported effects while preventing temporary combat rows from
 * crossing encounter boundaries. Legacy Feint rows are retained only while their proposal is
 * present in the current encounter; this repairs encounters saved before encounter provenance
 * was added without rewriting archived step snapshots.
 */
export function normalizeCombatModifierRowsForEncounter(
  input: NormalizeCombatModifierRowsForEncounterInput,
): ScenarioParticipantCombatContext {
  const context = input.combatContext ?? { modifierBuckets: emptyModifierBuckets() };
  const activeProposalIds = new Set(input.activeProposalIds ?? []);
  const keep = (entry: ScenarioCombatModifierEntry): boolean => {
    if (entry.imported || isPersistentCombatModifierEntry(entry)) return true;
    if (entry.persistsAcrossEncounters) return true;
    if (entry.sourceEncounterId) {
      if (entry.sourceEncounterId !== input.encounterId) return false;
      const sourceRound = entry.sourceRoundNumber ?? entry.expiresAtRound;
      return sourceRound === undefined || sourceRound >= input.roundNumber;
    }

    const isLegacyFeint =
      entry.sourceType === "feint" ||
      entry.id.startsWith("generated:feint:") ||
      entry.sourceRule?.startsWith("feint:") === true;
    if (isLegacyFeint) {
      return [...activeProposalIds].some((proposalId) =>
        entry.id.startsWith(`generated:feint:${proposalId}:`),
      );
    }

    // A new encounter starts without temporary generated or manual combat rows. Existing
    // encounters keep unknown legacy rows because their ownership cannot be reconstructed.
    return !input.initializingNewEncounter;
  };

  return {
    ...context,
    modifierBuckets: {
      general: context.modifierBuckets.general.filter(keep),
      situationDb: context.modifierBuckets.situationDb.filter(keep),
      situationInitiative: context.modifierBuckets.situationInitiative.filter(keep),
      situationObSkill: context.modifierBuckets.situationObSkill.filter(keep),
    },
  };
}

function isEffectActiveForRound(
  effect: CombatEffect,
  currentRound?: number,
  currentInitiativeGroupId?: string,
): boolean {
  return (
    getCombatEffectEffectiveStatus(effect, { currentInitiativeGroupId }) === "active" &&
    (currentRound === undefined ||
      effect.expiresAtRound === undefined ||
      effect.expiresAtRound >= currentRound)
  );
}

function getScenarioBucket(
  effect: CombatEffect,
): ScenarioCombatModifierBucket | undefined {
  // Damage, bleed, and healing facts are physical/special effects. Even malformed legacy rows
  // carrying a bucket must not turn those facts into generic numeric combat modifiers.
  if (
    effect.type === "physical_damage" ||
    effect.type === "general_damage" ||
    effect.type === "bleed" ||
    effect.type === "internal_bleed" ||
    effect.type === "healing"
  ) {
    return undefined;
  }

  switch (effect.combatModifierBucket) {
    case "general":
      return "general";
    case "initiative":
      return "situation_initiative";
    case "skill_ob":
      return "situation_ob_skill";
    case "db_parry":
      return "situation_db";
    case undefined:
      return undefined;
  }
}

function getImportedModifierLabel(effect: CombatEffect, event?: CombatEffectEvent): string {
  const sourceLabel = event?.sourceLabel.trim();

  if (sourceLabel && sourceLabel !== "Manual combat effect") {
    return sourceLabel;
  }

  return (
    effect.description?.trim() ||
    event?.description.trim() ||
    effect.type.replaceAll("_", " ")
  );
}

export function isPersistentCombatModifierEntry(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return entry.sourceType === PERSISTENT_COMBAT_MODIFIER_SOURCE_TYPE;
}

function buildImportedEntry(input: {
  effect: CombatEffect;
  event?: CombatEffectEvent;
}): ScenarioCombatModifierEntry {
  return {
    combatWide: input.effect.combatWide,
    expiresAtRound: input.effect.expiresAtRound,
    excludedRollPurposes: input.effect.excludedRollPurposes,
    generated: false,
    id: `import:character_effect:${input.effect.id}:${input.effect.combatModifierBucket}`,
    imported: true,
    notes: getImportedModifierLabel(input.effect, input.event),
    readOnly: true,
    scope: "until",
    sourceDuration: input.effect.duration?.trim() || undefined,
    sourceEffectId: input.effect.id,
    sourceType: PERSISTENT_COMBAT_MODIFIER_SOURCE_TYPE,
    value: input.effect.modifierValue ?? 0,
  };
}

/**
 * Projects ScenarioParticipant.state.combatEffects into deterministic combat rows.
 * Source effects own editing and duration; imported rows are disposable read-only projections.
 */
export function projectPersistentCombatEffectModifiers(
  input: ProjectPersistentCombatEffectModifiersInput,
): PersistentCombatEffectModifierProjection {
  const modifierBuckets = emptyModifierBuckets();
  const importedEffectIds: string[] = [];
  const pendingModifierEntries: ScenarioCombatModifierEntry[] = [];
  const specialEffectIds: string[] = [];
  const eventsById = new Map(
    (input.combatEffects?.events ?? []).map((event) => [event.id, event] as const),
  );
  const effects = [...(input.combatEffects?.effects ?? [])].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const effect of effects) {
    if (
      getCombatEffectEffectiveStatus(effect, {
        currentInitiativeGroupId: input.currentInitiativeGroupId,
      }) === "pending"
    ) {
      if (
        getScenarioBucket(effect) &&
        effect.modifierValue !== undefined &&
        Number.isFinite(effect.modifierValue)
      ) {
        pendingModifierEntries.push(
          buildImportedEntry({ effect, event: eventsById.get(effect.sourceEventId) }),
        );
      }
      continue;
    }
    if (!isEffectActiveForRound(effect, input.currentRound, input.currentInitiativeGroupId)) {
      continue;
    }

    const bucket = getScenarioBucket(effect);
    const hasExplicitModifier =
      effect.modifierValue !== undefined && Number.isFinite(effect.modifierValue);

    if (!bucket || !hasExplicitModifier || !effect.id || !effect.sourceEventId) {
      specialEffectIds.push(effect.id);
      continue;
    }

    const entry = buildImportedEntry({
      effect,
      event: eventsById.get(effect.sourceEventId),
    });
    const bucketKey =
      bucket === "situation_db"
        ? "situationDb"
        : bucket === "situation_initiative"
          ? "situationInitiative"
          : bucket === "situation_ob_skill"
            ? "situationObSkill"
            : "general";
    modifierBuckets[bucketKey].push(entry);
    importedEffectIds.push(effect.id);
  }

  return {
    importedEffectIds,
    modifierBuckets,
    pendingModifierEntries,
    specialEffectCount: specialEffectIds.length,
    specialEffectIds,
  };
}

function replaceImportedEntries(
  existing: readonly ScenarioCombatModifierEntry[],
  projected: readonly ScenarioCombatModifierEntry[],
  sourceEffectsProvided: boolean,
): ScenarioCombatModifierEntry[] {
  // Older scenario snapshots may contain imported rows without the source combatEffects
  // collection. Preserve those rows until the authoritative collection is available; an
  // explicitly supplied collection (including an empty one) is the source-of-truth refresh.
  if (!sourceEffectsProvided) return [...existing];
  return [...existing.filter((entry) => !isPersistentCombatModifierEntry(entry)), ...projected];
}

export function mergePersistentCombatEffectModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  currentInitiativeGroupId?: string;
  currentRound?: number;
}): ScenarioParticipantCombatContext {
  const current = input.combatContext ?? { modifierBuckets: emptyModifierBuckets() };
  const projected = projectPersistentCombatEffectModifiers(input);

  return {
    ...current,
    modifierBuckets: {
      general: replaceImportedEntries(
        current.modifierBuckets.general,
        projected.modifierBuckets.general,
        input.combatEffects !== undefined,
      ),
      situationDb: replaceImportedEntries(
        current.modifierBuckets.situationDb,
        projected.modifierBuckets.situationDb,
        input.combatEffects !== undefined,
      ),
      situationInitiative: replaceImportedEntries(
        current.modifierBuckets.situationInitiative,
        projected.modifierBuckets.situationInitiative,
        input.combatEffects !== undefined,
      ),
      situationObSkill: replaceImportedEntries(
        current.modifierBuckets.situationObSkill,
        projected.modifierBuckets.situationObSkill,
        input.combatEffects !== undefined,
      ),
    },
  };
}

const LIVE_PROJECTION_BUCKETS: readonly [
  ScenarioCombatModifierBucket,
  keyof ScenarioParticipantCombatContext["modifierBuckets"],
][] = [
  ["general", "general"],
  ["situation_initiative", "situationInitiative"],
  ["situation_ob_skill", "situationObSkill"],
  ["situation_db", "situationDb"],
];

/**
 * Builds the single normalized contribution projection used by live modifier panels.
 *
 * Existing effects and bucket rows are never mutated or written back. Imported persistent
 * rows are refreshed from combatEffects for the supplied round, then all rows are normalized,
 * filtered for lifetime/provenance, de-duplicated by their stable row id, and returned in a
 * deterministic bucket/id order. Unsupported active effects are reported separately so callers
 * can display a special-effects count without treating damage as a numeric modifier.
 */
export function buildLiveCombatModifierContributionProjection(
  input: LiveCombatModifierContributionProjectionInput,
): LiveCombatModifierContributionProjection {
  const ownerParticipantId = input.ownerParticipantId ?? "unknown-participant";
  const combatContext = mergePersistentCombatEffectModifiers({
    combatContext: input.combatContext,
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.currentRound,
  });
  const persistentProjection = projectPersistentCombatEffectModifiers({
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.currentRound,
  });
  const resolutionContext = {
    ownerParticipantId,
    ...(input.encounterId ? { encounterId: input.encounterId } : {}),
    ...(input.currentRound !== undefined ? { roundNumber: input.currentRound } : {}),
  };
  const seenIds = new Set<string>();
  const contributions: CombatModifierContribution[] = [];
  const sourceEntries = new Map<string, ScenarioCombatModifierEntry>();

  for (const [bucket, bucketKey] of LIVE_PROJECTION_BUCKETS) {
    // Persisted bucket order is the existing user-facing order. Preserve it while de-duplicating;
    // persisted source order is stable, so projection refreshes do not reorder the panel.
    const entries = combatContext.modifierBuckets[bucketKey];

    for (const entry of entries) {
      // Flat DB points are composed directly into DB after percentage adjustment. They are not
      // percentage contributions and must never affect Parry merely because legacy storage
      // shares the situationDb bucket.
      if (entry.application === "flat_db") continue;
      if (seenIds.has(entry.id)) continue;

      const contribution = normalizeScenarioCombatModifierEntry({
        bucket,
        currentRound: input.currentRound,
        entry,
        ownerParticipantId,
      });
      if (!contribution || !isCombatModifierContributionActive(contribution, resolutionContext)) {
        continue;
      }

      seenIds.add(entry.id);
      sourceEntries.set(contribution.id, entry);
      contributions.push(contribution);
    }
  }

  return {
    contributions,
    pendingModifierEntries: persistentProjection.pendingModifierEntries,
    sourceEntries,
    specialEffectCount: persistentProjection.specialEffectCount,
    specialEffectIds: persistentProjection.specialEffectIds,
  };
}

/**
 * Refreshes the disposable persistent-effect rows in a live scenario participant state.
 * The participant's combatEffects collection remains the source of truth; recorded combat
 * history snapshots are intentionally outside this boundary and are never rewritten here.
 */
export function refreshScenarioParticipantPersistentCombatModifiers(input: {
  currentRound?: number;
  state: ScenarioParticipantState;
}): ScenarioParticipantState {
  return {
    ...input.state,
    combat: {
      ...input.state.combat,
      combatContext: mergePersistentCombatEffectModifiers({
        combatContext: input.state.combat.combatContext,
        combatEffects: input.state.combatEffects,
        currentRound: input.currentRound,
      }),
    },
  };
}

function sum(
  entries: readonly ScenarioCombatModifierEntry[],
  application: ScenarioCombatModifierEntry["application"] = "percentage",
): number {
  return entries
    .filter((entry) => (entry.application ?? "percentage") === application)
    .reduce((total, entry) => total + entry.value, 0);
}

export function getMergedCombatModifierTotals(
  combatContext?: ScenarioParticipantCombatContext,
): MergedCombatModifierTotals {
  const buckets = combatContext?.modifierBuckets ?? emptyModifierBuckets();

  return {
    dbParry: sum(buckets.situationDb),
    generalFatigue: sum(buckets.general),
    initiative: sum(buckets.situationInitiative),
    skillOb: sum(buckets.situationObSkill),
  };
}

/** Returns the canonical initiative-bucket total for one live combat phase. */
export function getMergedCombatInitiativeModifierTotal(input: {
  combatContext?: ScenarioParticipantCombatContext;
  phase?: "phase1" | "phase2";
}): number {
  if (!input.combatContext || !input.phase) {
    return getMergedCombatModifierTotals(input.combatContext).initiative;
  }

  return getMergedCombatModifierTotals({
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationInitiative: input.combatContext.modifierBuckets.situationInitiative.filter(
        (entry) => !entry.sourcePhase || entry.sourcePhase === input.phase,
      ),
    },
  }).initiative;
}

/** Returns the canonical Skill/OB-bucket total for one live combat phase. */
export function getMergedCombatSkillObModifierTotal(input: {
  combatContext?: ScenarioParticipantCombatContext;
  phase?: "phase1" | "phase2";
}): number {
  if (!input.combatContext || !input.phase) {
    return getMergedCombatModifierTotals(input.combatContext).skillOb;
  }

  return getMergedCombatModifierTotals({
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationObSkill: input.combatContext.modifierBuckets.situationObSkill.filter(
        (entry) => !entry.sourcePhase || entry.sourcePhase === input.phase,
      ),
    },
  }).skillOb;
}

/** Returns the canonical DB/Parry-bucket total for one live combat phase. */
export function getMergedCombatDbParryModifierTotal(input: {
  combatContext?: ScenarioParticipantCombatContext;
  phase?: "phase1" | "phase2";
}): number {
  if (!input.combatContext || !input.phase) {
    return getMergedCombatModifierTotals(input.combatContext).dbParry;
  }

  return getMergedCombatModifierTotals({
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationDb: input.combatContext.modifierBuckets.situationDb.filter(
        (entry) => !entry.sourcePhase || entry.sourcePhase === input.phase,
      ),
    },
  }).dbParry;
}

/** Flat DB points are applied after workbook percentage adjustment and never affect Parry. */
export function getMergedCombatDbFlatAdjustmentTotal(input: {
  combatContext?: ScenarioParticipantCombatContext;
  phase?: "phase1" | "phase2";
}): number {
  const entries = input.combatContext?.modifierBuckets.situationDb ?? [];
  return sum(
    entries.filter(
      (entry) => !input.phase || !entry.sourcePhase || entry.sourcePhase === input.phase,
    ),
    "flat_db",
  );
}
