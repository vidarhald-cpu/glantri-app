import type {
  CombatEffectsState,
  CombatRoundStep,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";

import { buildPlayerCombatModifierRows } from "@/features/player-combat/PlayerCombatPanels";
import { buildEncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";

/**
 * Historical rows are the complete modifier set recorded at a step. Phase
 * applicability remains a calculation concern and must not hide recorded rows.
 */
export function buildRecordedCombatModifierRows(input: {
  combatContext: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  step: CombatRoundStep;
}) {
  return buildPlayerCombatModifierRows({
    combatContext: input.combatContext,
    combatEffects: input.combatEffects,
    liveModifiers: buildEncounterLiveCombatModifierSummary(input),
    phaseKey:
      input.step === "review_phase_2_modifiers" ||
      input.step === "initiative_phase_2" ||
      input.step === "phase_2_actions" ||
      input.step === "review_phase_2_damage" ||
      input.step === "phase_2_damage"
        ? "phase2"
        : input.step === "round_summary"
          ? undefined
          : "phase1",
    visibleAtStep: input.step,
  });
}
