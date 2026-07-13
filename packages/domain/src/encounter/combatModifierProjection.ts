import type {
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
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

const emptyModifierBuckets = (): ScenarioParticipantCombatContext["modifierBuckets"] => ({
  general: [],
  situationDb: [],
  situationInitiative: [],
  situationObSkill: [],
});

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
