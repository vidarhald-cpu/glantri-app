import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";
import {
  calculateDistanceObPenalty,
  combatDistanceSchema,
  getNearestPreferredDistance,
  type CombatDistance,
} from "./combatDistance";
import type { MovementIntent } from "./combatMovementIntent";

export const ATTACK_PARRY_DB_PARRY_MODIFIER_ID = "generated:attack-parry:phase1:db-parry";
export const ATTACK_PARRY_DB_PARRY_SOURCE_RULE = "attack-parry-db-parry-phase1";
export const PARRY_ATTACK_DB_PARRY_MODIFIER_ID = "generated:parry-attack:phase2:db-parry";
export const PARRY_ATTACK_DB_PARRY_SOURCE_RULE = "parry-attack-db-parry-phase2";
export const DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID = "generated:double-attack:phase1:ob-skill";
export const DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE = "double-attack-ob-skill-phase1";
export const DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID = "generated:double-attack:phase2:ob-skill";
export const DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE = "double-attack-ob-skill-phase2";
export const DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID = "generated:double-attack:phase1:db-parry";
export const DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE = "double-attack-db-parry-phase1";
export const DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID = "generated:double-attack:phase2:db-parry";
export const DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE = "double-attack-db-parry-phase2";
export const DOUBLE_ATTACK_CANCELLED_PHASE2_DB_PARRY_SOURCE_RULE =
  "double-attack-cancelled-db-parry-phase2";
export const ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID =
  "generated:adjust-range-attack:phase1:db-parry";
export const ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE = "adjust-range-phase1-db-parry";
/** Legacy placeholder row: retained only so refresh can remove saved copies. */
export const ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID =
  "generated:adjust-range-attack:phase2:db-parry";
export const ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE = "adjust-range-attack-phase2-db-parry";
export const DISTANCE_OB_SKILL_SOURCE_RULE = "distance-ob-skill";
export const REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID =
  "generated:parry-attack:phase2:initiative";
export const REACTIVE_ATTACK_PHASE2_INITIATIVE_SOURCE_RULE =
  "parry-attack-phase2-initiative";

export interface CombatActionGeneratedDistanceModifierInput {
  actualDistance: CombatDistance | number;
  actualDistanceBasis?: "current" | "declared_intent";
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  sourceActionId?: string;
  weaponName?: string;
}

function normalizeCombatDistanceValues(
  distances: readonly (CombatDistance | number)[],
): CombatDistance[] {
  return distances.map((distance) => combatDistanceSchema.parse(distance));
}

export function getSingleAttackDeclaredDistanceForPenalty(input: {
  actionId?: string;
  movementIntent?: MovementIntent;
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  targetParticipantId?: string;
}): CombatDistance | undefined {
  if (
    input.actionId !== "attack_parry" ||
    input.phase !== "phase1" ||
    input.movementIntent?.mode !== "set_distance_preferences" ||
    !input.targetParticipantId
  ) {
    return undefined;
  }

  const preferredDistances = normalizeCombatDistanceValues(input.preferredDistances);

  if (preferredDistances.length === 0) {
    return undefined;
  }

  const longestAttackDistance = Math.max(...preferredDistances);
  const matchingPreference = input.movementIntent.distancePreferences.find((preference) => {
    const preferencePhase = preference.phase ?? "round";

    return (
      preference.targetParticipantId === input.targetParticipantId &&
      (preferencePhase === "round" || preferencePhase === input.phase) &&
      preference.desiredDistance > longestAttackDistance
    );
  });

  return matchingPreference?.desiredDistance;
}

export function buildDistanceGeneratedObSkillModifier(input: {
  actualDistance: CombatDistance | number;
  actualDistanceBasis?: "current" | "declared_intent";
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  sourceActionId?: string;
  weaponName?: string;
}): ScenarioCombatModifierEntry | undefined {
  const actualDistance = combatDistanceSchema.parse(input.actualDistance);
  const preferredDistances = normalizeCombatDistanceValues(input.preferredDistances);
  const value = calculateDistanceObPenalty(actualDistance, preferredDistances);
  const nearestPreferredDistance = getNearestPreferredDistance(actualDistance, preferredDistances);

  if (value >= 0) {
    return undefined;
  }

  const preferredLabel =
    preferredDistances.length === 1
      ? String(preferredDistances[0])
      : `${Math.min(...preferredDistances)}-${Math.max(...preferredDistances)}`;
  const distanceLabel =
    input.actualDistanceBasis === "declared_intent"
      ? `declared ${actualDistance}`
      : `actual ${actualDistance}`;

  return scenarioCombatModifierEntrySchema.parse({
    durationRounds: 1,
    generated: true,
    id: `generated:distance:${input.phase}:ob-skill`,
    notes: `distance: ${input.weaponName ? `${input.weaponName} ` : ""}preferred ${preferredLabel} · ${distanceLabel} · nearest ${nearestPreferredDistance} · Skill/OB ${value}`,
    scope: "until",
    sourceActionId: input.sourceActionId,
    sourcePhase: input.phase,
    sourceRule: `${DISTANCE_OB_SKILL_SOURCE_RULE}-${input.phase}`,
    value,
  } satisfies ScenarioCombatModifierEntry);
}

export function isDistanceGeneratedObSkillModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id.startsWith("generated:distance:") ||
    entry.sourceRule === DISTANCE_OB_SKILL_SOURCE_RULE ||
    entry.sourceRule === `${DISTANCE_OB_SKILL_SOURCE_RULE}-phase1` ||
    entry.sourceRule === `${DISTANCE_OB_SKILL_SOURCE_RULE}-phase2`
  );
}

export function isAttackParryGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id === ATTACK_PARRY_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ATTACK_PARRY_DB_PARRY_SOURCE_RULE
  );
}

export function isParryAttackGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id === PARRY_ATTACK_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === PARRY_ATTACK_DB_PARRY_SOURCE_RULE
  );
}

export function isDoubleAttackGeneratedObSkillModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE ||
    entry.id === DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE
  );
}

export function isDoubleAttackGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE ||
    entry.id === DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE
  );
}

export function isAdjustRangeAttackGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE ||
    entry.id === ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE
  );
}

export function isReactiveAttackGeneratedInitiativeModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID ||
    entry.sourceRule === REACTIVE_ATTACK_PHASE2_INITIATIVE_SOURCE_RULE
  );
}

function isCombatActionGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    isAttackParryGeneratedDbParryModifier(entry) ||
    isParryAttackGeneratedDbParryModifier(entry) ||
    isDoubleAttackGeneratedDbParryModifier(entry) ||
    isAdjustRangeAttackGeneratedDbParryModifier(entry)
  );
}

function isCombatActionGeneratedObSkillModifier(entry: ScenarioCombatModifierEntry): boolean {
  return isDoubleAttackGeneratedObSkillModifier(entry) || isDistanceGeneratedObSkillModifier(entry);
}

function isCombatActionGeneratedInitiativeModifier(entry: ScenarioCombatModifierEntry): boolean {
  return isReactiveAttackGeneratedInitiativeModifier(entry);
}

export function applyDistanceGeneratedObSkillModifier(input: {
  actualDistance: CombatDistance | number;
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  sourceActionId?: string;
  weaponName?: string;
}): ScenarioParticipantCombatContext {
  const modifier = buildDistanceGeneratedObSkillModifier(input);
  const situationObSkillWithoutDistanceModifier =
    input.combatContext.modifierBuckets.situationObSkill.filter(
      (entry) => !(isDistanceGeneratedObSkillModifier(entry) && entry.sourcePhase === input.phase),
    );

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationObSkill: modifier
        ? [...situationObSkillWithoutDistanceModifier, modifier]
        : situationObSkillWithoutDistanceModifier,
    },
  };
}

export function clearDistanceGeneratedObSkillModifierForPhase(input: {
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
}): ScenarioParticipantCombatContext {
  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationObSkill: input.combatContext.modifierBuckets.situationObSkill.filter(
        (entry) =>
          !(isDistanceGeneratedObSkillModifier(entry) && entry.sourcePhase === input.phase),
      ),
    },
  };
}

export function removeDistanceGeneratedObSkillModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command?: { facts?: Record<string, unknown> };
  modifierIds?: readonly unknown[];
}): ScenarioParticipantCombatContext {
  const currentContext = scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {});
  const modifierIds = new Set(
    (
      input.modifierIds ??
      (Array.isArray(input.command?.facts?.createdCombatModifierIds)
        ? input.command.facts.createdCombatModifierIds
        : [])
    ).filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
  );

  if (modifierIds.size === 0) {
    return currentContext;
  }

  return {
    ...currentContext,
    modifierBuckets: {
      ...currentContext.modifierBuckets,
      situationObSkill: currentContext.modifierBuckets.situationObSkill.filter(
        (entry) => !(modifierIds.has(entry.id) && isDistanceGeneratedObSkillModifier(entry)),
      ),
    },
  };
}

export interface CombatActionGeneratedModifierSofteningChange {
  bucketKey: "situationDb";
  modifierId: string;
  nextEntry: ScenarioCombatModifierEntry;
  previousEntry: ScenarioCombatModifierEntry;
}

function combatActionGeneratedDbParryModifierMatchesPhase(input: {
  entry: ScenarioCombatModifierEntry;
  phase: "phase1" | "phase2";
}): boolean {
  if (input.entry.sourcePhase === input.phase) {
    return true;
  }

  if (input.phase === "phase1") {
    return (
      input.entry.sourceRule === ATTACK_PARRY_DB_PARRY_SOURCE_RULE ||
      input.entry.sourceRule === DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE
    );
  }

  return (
    input.entry.sourceRule === PARRY_ATTACK_DB_PARRY_SOURCE_RULE ||
    input.entry.sourceRule === DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE
  );
}

function isSoftenableBackOutAttackDbParryModifier(input: {
  actionId?: string;
  entry: ScenarioCombatModifierEntry;
  phase: "phase1" | "phase2";
}): boolean {
  return Boolean(
    input.entry.generated &&
    input.entry.value === -4 &&
    isCombatActionGeneratedDbParryModifier(input.entry) &&
    combatActionGeneratedDbParryModifierMatchesPhase({
      entry: input.entry,
      phase: input.phase,
    }) &&
    (!input.actionId || input.entry.sourceActionId === input.actionId),
  );
}

export function softenCombatActionGeneratedBackOutModifier(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
}): {
  combatContext: ScenarioParticipantCombatContext;
  softenedModifiers: CombatActionGeneratedModifierSofteningChange[];
  warning?: string;
} {
  const softenedModifiers: CombatActionGeneratedModifierSofteningChange[] = [];
  const situationDb = input.combatContext.modifierBuckets.situationDb.map((entry) => {
    if (
      softenedModifiers.length > 0 ||
      !isSoftenableBackOutAttackDbParryModifier({
        actionId: input.actionId,
        entry,
        phase: input.phase,
      })
    ) {
      return entry;
    }

    const nextEntry = {
      ...entry,
      value: -2,
    };

    softenedModifiers.push({
      bucketKey: "situationDb",
      modifierId: entry.id,
      nextEntry,
      previousEntry: entry,
    });

    return nextEntry;
  });

  return {
    combatContext: {
      ...input.combatContext,
      modifierBuckets: {
        ...input.combatContext.modifierBuckets,
        situationDb,
      },
    },
    softenedModifiers,
    warning:
      softenedModifiers.length === 0
        ? "No generated attack DB/Parry -4 modifier was found to soften."
        : undefined,
  };
}

function parseCombatActionGeneratedModifierSofteningChange(
  value: unknown,
): CombatActionGeneratedModifierSofteningChange | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (record.bucketKey !== "situationDb" || typeof record.modifierId !== "string") {
    return undefined;
  }

  const previousEntry = scenarioCombatModifierEntrySchema.safeParse(record.previousEntry);
  const nextEntry = scenarioCombatModifierEntrySchema.safeParse(record.nextEntry);

  if (!previousEntry.success || !nextEntry.success) {
    return undefined;
  }

  return {
    bucketKey: "situationDb",
    modifierId: record.modifierId,
    nextEntry: nextEntry.data,
    previousEntry: previousEntry.data,
  };
}

export function restoreCombatActionGeneratedBackOutModifiers(input: {
  combatContext: ScenarioParticipantCombatContext;
  softenedModifiers?: readonly unknown[];
}): ScenarioParticipantCombatContext {
  const softenedModifiers = (input.softenedModifiers ?? [])
    .map(parseCombatActionGeneratedModifierSofteningChange)
    .filter((entry): entry is CombatActionGeneratedModifierSofteningChange => Boolean(entry));

  if (softenedModifiers.length === 0) {
    return input.combatContext;
  }

  const previousEntryById = new Map(
    softenedModifiers.map((change) => [change.modifierId, change.previousEntry]),
  );
  const restoredIds = new Set<string>();
  const situationDb = input.combatContext.modifierBuckets.situationDb.map((entry) => {
    const previousEntry = previousEntryById.get(entry.id);

    if (!previousEntry) {
      return entry;
    }

    restoredIds.add(entry.id);
    return previousEntry;
  });

  for (const change of softenedModifiers) {
    if (!restoredIds.has(change.modifierId)) {
      situationDb.push(change.previousEntry);
    }
  }

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationDb,
    },
  };
}

export function buildAttackParryGeneratedDbParryModifier(): ScenarioCombatModifierEntry {
  return {
    durationRounds: 1,
    generated: true,
    id: ATTACK_PARRY_DB_PARRY_MODIFIER_ID,
    notes: "single attack",
    scope: "until",
    sourceActionId: "attack_parry",
    sourcePhase: "phase1",
    sourceRule: ATTACK_PARRY_DB_PARRY_SOURCE_RULE,
    value: -4,
  };
}

export function buildParryAttackGeneratedDbParryModifier(): ScenarioCombatModifierEntry {
  return {
    durationRounds: 1,
    generated: true,
    id: PARRY_ATTACK_DB_PARRY_MODIFIER_ID,
    notes: "reactive attack",
    scope: "until",
    sourceActionId: "parry_attack",
    sourcePhase: "phase2",
    sourceRule: PARRY_ATTACK_DB_PARRY_SOURCE_RULE,
    value: -4,
  };
}

export function buildReactiveAttackPhase2GeneratedInitiativeModifier(input: {
  reason: string;
  value: number;
}): ScenarioCombatModifierEntry {
  return scenarioCombatModifierEntrySchema.parse({
    durationRounds: 1,
    generated: true,
    id: REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
    notes: `reactive attack: ${input.reason}`,
    scope: "until",
    sourceActionId: "parry_attack",
    sourcePhase: "phase2",
    sourceRule: REACTIVE_ATTACK_PHASE2_INITIATIVE_SOURCE_RULE,
    value: input.value,
  } satisfies ScenarioCombatModifierEntry);
}

export function buildDoubleAttackGeneratedObSkillModifiers(): ScenarioCombatModifierEntry[] {
  return [
    {
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase1",
      sourceRule: DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE,
      value: -1,
    },
    {
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase2",
      sourceRule: DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE,
      value: -1,
    },
  ];
}

export function buildDoubleAttackGeneratedDbParryModifiers(): ScenarioCombatModifierEntry[] {
  return [
    {
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase1",
      sourceRule: DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE,
      value: -4,
    },
    {
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase2",
      sourceRule: DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE,
      value: -4,
    },
  ];
}

/**
 * Applies the rule consequence of cancelling Double Attack's second attack after phase 1.
 * Phase-1 rows are recorded facts and remain untouched; only the phase-2 attack penalty is
 * removed and the phase-2 defensive penalty is reduced from -4 to -2.
 */
export function cancelDoubleAttackPhase2GeneratedModifiers(
  combatContext: ScenarioParticipantCombatContext,
): ScenarioParticipantCombatContext {
  return scenarioParticipantCombatContextSchema.parse({
    ...combatContext,
    modifierBuckets: {
      ...combatContext.modifierBuckets,
      situationDb: combatContext.modifierBuckets.situationDb.map((entry) =>
        entry.id === DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID
          ? {
              ...entry,
              notes: "double attack cancelled after Attack 1",
              sourceRule: DOUBLE_ATTACK_CANCELLED_PHASE2_DB_PARRY_SOURCE_RULE,
              value: -2,
            }
          : entry,
      ),
      situationObSkill: combatContext.modifierBuckets.situationObSkill.filter(
        (entry) => entry.id !== DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
      ),
    },
  });
}

/** Restores the committed phase-2 Double Attack rows without touching unrelated rows. */
export function continueDoubleAttackPhase2GeneratedModifiers(
  combatContext: ScenarioParticipantCombatContext,
): ScenarioParticipantCombatContext {
  const dbRows = buildDoubleAttackGeneratedDbParryModifiers();
  const obRows = buildDoubleAttackGeneratedObSkillModifiers();
  const phase2Db = dbRows.find((entry) => entry.sourcePhase === "phase2");
  const phase2Ob = obRows.find((entry) => entry.sourcePhase === "phase2");

  return scenarioParticipantCombatContextSchema.parse({
    ...combatContext,
    modifierBuckets: {
      ...combatContext.modifierBuckets,
      situationDb: [
        ...combatContext.modifierBuckets.situationDb.filter(
          (entry) => entry.id !== DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID,
        ),
        ...(phase2Db ? [phase2Db] : []),
      ],
      situationObSkill: [
        ...combatContext.modifierBuckets.situationObSkill.filter(
          (entry) => entry.id !== DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
        ),
        ...(phase2Ob ? [phase2Ob] : []),
      ],
    },
  });
}

export function buildAdjustRangeAttackGeneratedDbParryModifiers(input?: {
  currentDistance?: number;
  requestedDistance?: number;
  roundNumber?: number;
}): ScenarioCombatModifierEntry[] {
  if (
    input?.currentDistance === undefined ||
    input.requestedDistance === undefined ||
    input.requestedDistance >= input.currentDistance
  ) {
    return [];
  }
  return [
    {
      durationRounds: 1,
      ...(input.roundNumber ? { expiresAtRound: input.roundNumber } : {}),
      generated: true,
      id: ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
      notes: "adjust range",
      scope: "until",
      sourceActionId: "adjust_range_attack",
      sourcePhase: "phase1",
      sourceRule: ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE,
      value: -2,
    },
  ];
}

export function expireAdjustDistanceAttackGeneratedModifiersBeforeRound(
  combatContext: ScenarioParticipantCombatContext | undefined,
  roundNumber: number,
): ScenarioParticipantCombatContext {
  const context = scenarioParticipantCombatContextSchema.parse(combatContext ?? {});
  return scenarioParticipantCombatContextSchema.parse({
    ...context,
    modifierBuckets: {
      ...context.modifierBuckets,
      situationDb: context.modifierBuckets.situationDb.filter(
        (entry) =>
          !isAdjustRangeAttackGeneratedDbParryModifier(entry) ||
          entry.expiresAtRound === undefined ||
          entry.expiresAtRound >= roundNumber,
      ),
    },
  });
}

export function applyCombatActionGeneratedModifiers(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  distanceModifiers?: readonly CombatActionGeneratedDistanceModifierInput[];
  initiativeModifiers?: readonly ScenarioCombatModifierEntry[];
  adjustDistance?: { currentDistance: number; requestedDistance: number; roundNumber?: number };
}): ScenarioParticipantCombatContext {
  const situationDbWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationDb.filter(
      (entry) => !isCombatActionGeneratedDbParryModifier(entry),
    );
  const situationObSkillWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationObSkill.filter(
      (entry) => !isCombatActionGeneratedObSkillModifier(entry),
    );
  const situationInitiativeWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationInitiative.filter(
      (entry) => !isCombatActionGeneratedInitiativeModifier(entry),
    );
  const generatedDbParryModifiers =
    input.actionId === "attack_parry"
      ? [buildAttackParryGeneratedDbParryModifier()]
      : input.actionId === "parry_attack"
        ? [buildParryAttackGeneratedDbParryModifier()]
        : input.actionId === "double_attack"
          ? buildDoubleAttackGeneratedDbParryModifiers()
          : input.actionId === "adjust_range_attack"
            ? buildAdjustRangeAttackGeneratedDbParryModifiers(input.adjustDistance)
            : [];
  const generatedObSkillModifiers =
    input.actionId === "double_attack" ? buildDoubleAttackGeneratedObSkillModifiers() : [];
  const generatedDistanceObSkillModifiers = (input.distanceModifiers ?? [])
    .map((modifierInput) =>
      buildDistanceGeneratedObSkillModifier({
        ...modifierInput,
        sourceActionId: modifierInput.sourceActionId ?? input.actionId,
      }),
    )
    .filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      // The stored key remains situationDb for backward compatibility, while the
      // product-facing bucket is now DB/Parry.
      situationDb: [...situationDbWithoutGeneratedActionModifiers, ...generatedDbParryModifiers],
      situationInitiative: [
        ...situationInitiativeWithoutGeneratedActionModifiers,
        ...(input.initiativeModifiers ?? []),
      ],
      situationObSkill: [
        ...situationObSkillWithoutGeneratedActionModifiers,
        ...generatedObSkillModifiers,
        ...generatedDistanceObSkillModifiers,
      ],
    },
  };
}
