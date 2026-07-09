import {
  getCombatDeclarationAttackPhases,
  getCombatRoundModifierPhaseForStep,
  type CombatRoundStep,
} from "@glantri/domain";

import type { PlayerEncounterActionId } from "@/lib/campaigns/playerEncounter";

export type PlayerCombatModifierDisplayPhase = "phase1" | "phase2";

export function getPlayerCombatModifierDisplayPhase(input: {
  actionId?: PlayerEncounterActionId | "";
  step: CombatRoundStep;
}): PlayerCombatModifierDisplayPhase | undefined {
  const stepPhase = getCombatRoundModifierPhaseForStep(input.step);

  if (input.actionId && input.step === "select_actions") {
    const attackPhases = getCombatDeclarationAttackPhases({ actionId: input.actionId });

    if (attackPhases.length === 1) {
      return attackPhases[0];
    }
  }

  if (input.actionId === "parry_attack" && input.step === "review_action_modifiers") {
    return "phase2";
  }

  return stepPhase;
}
