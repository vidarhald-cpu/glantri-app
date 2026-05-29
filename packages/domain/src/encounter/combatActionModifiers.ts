import type {
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "../campaign/scenario";

export const ATTACK_PARRY_DB_PARRY_MODIFIER_ID =
  "generated:attack-parry:phase1:db-parry";
export const ATTACK_PARRY_DB_PARRY_SOURCE_RULE = "attack-parry-db-parry-phase1";

export function isAttackParryGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === ATTACK_PARRY_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ATTACK_PARRY_DB_PARRY_SOURCE_RULE
  );
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

export function applyCombatActionGeneratedModifiers(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
}): ScenarioParticipantCombatContext {
  const situationDbWithoutAttackParry =
    input.combatContext.modifierBuckets.situationDb.filter(
      (entry) => !isAttackParryGeneratedDbParryModifier(entry),
    );

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      // The stored key remains situationDb for backward compatibility, while the
      // product-facing bucket is now DB/Parry.
      situationDb:
        input.actionId === "attack_parry"
          ? [
              ...situationDbWithoutAttackParry,
              buildAttackParryGeneratedDbParryModifier(),
            ]
          : situationDbWithoutAttackParry,
    },
  };
}
