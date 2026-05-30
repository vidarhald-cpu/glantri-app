import type { CombatRoundPhaseContexts } from "./combatRoundManager";

export type CombatDeclarationPhaseKey = "phase1" | "phase2";

export interface CombatDeclarationTargetValidationResult {
  missingPhases: CombatDeclarationPhaseKey[];
  message?: string;
  valid: boolean;
}

const ATTACK_ACTION_IDS = new Set([
  "attack_parry",
  "parry_attack",
  "double_attack",
  "feint_attack",
  "adjust_range_attack",
  "counterattack",
  "disarm",
]);

function isAttackAction(actionId?: string): boolean {
  return Boolean(actionId && ATTACK_ACTION_IDS.has(actionId));
}

export function getCombatDeclarationAttackPhases(input: {
  actionId?: string;
  secondaryActionId?: string;
}): CombatDeclarationPhaseKey[] {
  switch (input.actionId) {
    case "attack_parry":
      return ["phase1"];
    case "parry_attack":
      return ["phase2"];
    case "double_attack":
      return ["phase1", "phase2"];
    default:
      break;
  }

  const phases: CombatDeclarationPhaseKey[] = [];
  if (isAttackAction(input.actionId)) {
    phases.push("phase1");
  }
  if (isAttackAction(input.secondaryActionId)) {
    phases.push("phase2");
  }

  return phases;
}

function formatMissingTargetMessage(
  missingPhases: CombatDeclarationPhaseKey[],
): string | undefined {
  if (missingPhases.length === 0) {
    return undefined;
  }

  if (missingPhases.length === 1) {
    return `Select a target for ${missingPhases[0] === "phase1" ? "Phase 1" : "Phase 2"}.`;
  }

  return "Select targets for Phase 1 and Phase 2.";
}

export function validateCombatDeclarationTargets(input: {
  actionId?: string;
  phaseContexts?: CombatRoundPhaseContexts;
  secondaryActionId?: string;
}): CombatDeclarationTargetValidationResult {
  const attackPhases = getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  });
  const missingPhases = attackPhases.filter((phaseKey) => {
    const targetParticipantId = input.phaseContexts?.[phaseKey]?.targetParticipantId;
    return !targetParticipantId || targetParticipantId.trim().length === 0;
  });

  return {
    missingPhases,
    message: formatMissingTargetMessage(missingPhases),
    valid: missingPhases.length === 0,
  };
}
