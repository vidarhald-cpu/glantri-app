import {
  scenarioCombatModifierEntrySchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";

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
export const ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID =
  "generated:adjust-range-attack:phase1:db-parry";
export const ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE = "adjust-range-phase1-db-parry";
export const ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID =
  "generated:adjust-range-attack:phase2:db-parry";
export const ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE = "adjust-range-attack-phase2-db-parry";

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

function isCombatActionGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    isAttackParryGeneratedDbParryModifier(entry) ||
    isParryAttackGeneratedDbParryModifier(entry) ||
    isDoubleAttackGeneratedDbParryModifier(entry) ||
    isAdjustRangeAttackGeneratedDbParryModifier(entry)
  );
}

function isCombatActionGeneratedObSkillModifier(entry: ScenarioCombatModifierEntry): boolean {
  return isDoubleAttackGeneratedObSkillModifier(entry);
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
    input.entry.sourceRule === DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE ||
    input.entry.sourceRule === ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE
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
    notes: "attack parry",
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
    notes: "parry attack",
    scope: "until",
    sourceActionId: "parry_attack",
    sourcePhase: "phase2",
    sourceRule: PARRY_ATTACK_DB_PARRY_SOURCE_RULE,
    value: -4,
  };
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

export function buildAdjustRangeAttackGeneratedDbParryModifiers(): ScenarioCombatModifierEntry[] {
  return [
    {
      durationRounds: 1,
      generated: true,
      id: ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
      notes: "adjust range",
      scope: "until",
      sourceActionId: "adjust_range_attack",
      sourcePhase: "phase1",
      sourceRule: ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE,
      value: -2,
    },
    {
      durationRounds: 1,
      generated: true,
      id: ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID,
      notes: "adjust range attack",
      scope: "until",
      sourceActionId: "adjust_range_attack",
      sourcePhase: "phase2",
      sourceRule: ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE,
      value: -4,
    },
  ];
}

export function applyCombatActionGeneratedModifiers(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
}): ScenarioParticipantCombatContext {
  const situationDbWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationDb.filter(
      (entry) => !isCombatActionGeneratedDbParryModifier(entry),
    );
  const situationObSkillWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationObSkill.filter(
      (entry) => !isCombatActionGeneratedObSkillModifier(entry),
    );
  const generatedDbParryModifiers =
    input.actionId === "attack_parry"
      ? [buildAttackParryGeneratedDbParryModifier()]
      : input.actionId === "parry_attack"
        ? [buildParryAttackGeneratedDbParryModifier()]
        : input.actionId === "double_attack"
          ? buildDoubleAttackGeneratedDbParryModifiers()
          : input.actionId === "adjust_range_attack"
            ? buildAdjustRangeAttackGeneratedDbParryModifiers()
            : [];
  const generatedObSkillModifiers =
    input.actionId === "double_attack" ? buildDoubleAttackGeneratedObSkillModifiers() : [];

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      // The stored key remains situationDb for backward compatibility, while the
      // product-facing bucket is now DB/Parry.
      situationDb: [...situationDbWithoutGeneratedActionModifiers, ...generatedDbParryModifiers],
      situationObSkill: [
        ...situationObSkillWithoutGeneratedActionModifiers,
        ...generatedObSkillModifiers,
      ],
    },
  };
}
