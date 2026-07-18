import type {
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipantState,
} from "../campaign/scenario";
import type { CombatEffect, CombatEffectEvent, CombatEffectsState } from "./combatEffects";

export const PERSISTENT_COMBAT_MODIFIER_SOURCE_TYPE = "character_effect" as const;

export interface ProjectPersistentCombatEffectModifiersInput {
  combatEffects?: CombatEffectsState;
  currentRound?: number;
}

export interface PersistentCombatEffectModifierProjection {
  importedEffectIds: string[];
  modifierBuckets: ScenarioParticipantCombatContext["modifierBuckets"];
  specialEffectIds: string[];
  specialEffectCount: number;
}

export interface MergedCombatModifierTotals {
  dbParry: number;
  generalFatigue: number;
  initiative: number;
  skillOb: number;
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

function isEffectActiveForRound(effect: CombatEffect, currentRound?: number): boolean {
  return (
    effect.status === "active" &&
    (currentRound === undefined ||
      effect.expiresAtRound === undefined ||
      effect.expiresAtRound >= currentRound)
  );
}

function getScenarioBucket(
  effect: CombatEffect,
): ScenarioCombatModifierBucket | undefined {
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
    expiresAtRound: input.effect.expiresAtRound,
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
  const specialEffectIds: string[] = [];
  const eventsById = new Map(
    (input.combatEffects?.events ?? []).map((event) => [event.id, event] as const),
  );
  const effects = [...(input.combatEffects?.effects ?? [])].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const effect of effects) {
    if (!isEffectActiveForRound(effect, input.currentRound)) {
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
    specialEffectCount: specialEffectIds.length,
    specialEffectIds,
  };
}

function replaceImportedEntries(
  existing: readonly ScenarioCombatModifierEntry[],
  projected: readonly ScenarioCombatModifierEntry[],
): ScenarioCombatModifierEntry[] {
  return [...existing.filter((entry) => !isPersistentCombatModifierEntry(entry)), ...projected];
}

export function mergePersistentCombatEffectModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
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
      ),
      situationDb: replaceImportedEntries(
        current.modifierBuckets.situationDb,
        projected.modifierBuckets.situationDb,
      ),
      situationInitiative: replaceImportedEntries(
        current.modifierBuckets.situationInitiative,
        projected.modifierBuckets.situationInitiative,
      ),
      situationObSkill: replaceImportedEntries(
        current.modifierBuckets.situationObSkill,
        projected.modifierBuckets.situationObSkill,
      ),
    },
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

function sum(entries: readonly ScenarioCombatModifierEntry[]): number {
  return entries.reduce((total, entry) => total + entry.value, 0);
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
