import type {
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "../campaign/scenario";

export const ATTACK_PARRY_DB_PARRY_MODIFIER_ID =
  "generated:attack-parry:phase1:db-parry";
export const ATTACK_PARRY_DB_PARRY_SOURCE_RULE = "attack-parry-db-parry-phase1";
export const PARRY_ATTACK_DB_PARRY_MODIFIER_ID =
  "generated:parry-attack:phase2:db-parry";
export const PARRY_ATTACK_DB_PARRY_SOURCE_RULE = "parry-attack-db-parry-phase2";
export const DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID =
  "generated:double-attack:phase1:ob-skill";
export const DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE = "double-attack-ob-skill-phase1";
export const DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID =
  "generated:double-attack:phase2:ob-skill";
export const DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE = "double-attack-ob-skill-phase2";
export const DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID =
  "generated:double-attack:phase1:db-parry";
export const DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE = "double-attack-db-parry-phase1";
export const DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID =
  "generated:double-attack:phase2:db-parry";
export const DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE = "double-attack-db-parry-phase2";

export function isAttackParryGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === ATTACK_PARRY_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ATTACK_PARRY_DB_PARRY_SOURCE_RULE
  );
}

export function isParryAttackGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
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

function isCombatActionGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    isAttackParryGeneratedDbParryModifier(entry) ||
    isParryAttackGeneratedDbParryModifier(entry) ||
    isDoubleAttackGeneratedDbParryModifier(entry)
  );
}

function isCombatActionGeneratedObSkillModifier(entry: ScenarioCombatModifierEntry): boolean {
  return isDoubleAttackGeneratedObSkillModifier(entry);
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
          : [];
  const generatedObSkillModifiers =
    input.actionId === "double_attack" ? buildDoubleAttackGeneratedObSkillModifiers() : [];

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      // The stored key remains situationDb for backward compatibility, while the
      // product-facing bucket is now DB/Parry.
      situationDb: [
        ...situationDbWithoutGeneratedActionModifiers,
        ...generatedDbParryModifiers,
      ],
      situationObSkill: [
        ...situationObSkillWithoutGeneratedActionModifiers,
        ...generatedObSkillModifiers,
      ],
    },
  };
}
