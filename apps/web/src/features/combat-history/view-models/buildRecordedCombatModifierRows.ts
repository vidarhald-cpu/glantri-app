import type { CombatEffectsState, ScenarioParticipantCombatContext } from "@glantri/domain";

import { buildPlayerCombatModifierRows } from "@/features/player-combat/PlayerCombatPanels";
import { buildEncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";

/**
 * Historical rows are the complete modifier set recorded at a step. Phase
 * applicability remains a calculation concern and must not hide recorded rows.
 */
export function buildRecordedCombatModifierRows(input: {
  combatContext: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
}) {
  return buildPlayerCombatModifierRows({
    combatContext: input.combatContext,
    combatEffects: input.combatEffects,
    includeAllPhases: true,
    liveModifiers: buildEncounterLiveCombatModifierSummary(input),
  });
}
