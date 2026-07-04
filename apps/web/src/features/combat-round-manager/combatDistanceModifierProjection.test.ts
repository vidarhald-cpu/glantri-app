import { describe, expect, it } from "vitest";

import type {
  CombatRoundPhaseContexts,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";

import { buildPlayerCombatModifierRows } from "@/features/player-combat/PlayerCombatPanels";

import { projectCombatActionGeneratedModifiers } from "./combatDistanceModifierProjection";

const attackParryDistanceRow: ScenarioCombatModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:distance:phase1:ob-skill",
  notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
  scope: "until",
  sourceActionId: "attack_parry",
  sourcePhase: "phase1",
  sourceRule: "distance-ob-skill-phase1",
  value: -2,
};

const phaseContexts: CombatRoundPhaseContexts = {
  phase1: {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId: "scenario-gladiator",
  },
};

function buildCommittedContext(): ScenarioParticipantCombatContext {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [
        {
          durationRounds: 1,
          generated: true,
          id: "generated:attack-parry:phase1:db-parry",
          notes: "attack parry",
          scope: "until",
          sourceActionId: "attack_parry",
          sourcePhase: "phase1",
          sourceRule: "attack-parry-db-parry-phase1",
          value: -4,
        },
      ],
      situationInitiative: [],
      situationObSkill: [attackParryDistanceRow],
    },
  };
}

describe("projectCombatActionGeneratedModifiers", () => {
  it("keeps a committed declaration distance row when the browser display projection lacks phase weapon names", () => {
    const declarationCombatContext = buildCommittedContext();
    const staleScenarioParticipantCombatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: declarationCombatContext.modifierBuckets.situationDb,
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: declarationCombatContext,
      phaseContexts,
    });
    const modifierRows = buildPlayerCombatModifierRows({
      combatContext: projectedContext,
      phaseKey: "phase1",
    });
    const skillObRow = modifierRows.find((row) => row.bucketKey === "situation_ob_skill");
    const browserVisibleTrace = {
      currentRoundNumber: 1,
      declarationExists: true,
      declarationSituationObSkill:
        declarationCombatContext.modifierBuckets.situationObSkill,
      finalCombatContext: projectedContext,
      finalRenderedModifierRows: modifierRows,
      finalRenderedSkillObSummary: skillObRow?.total,
      finalSkillObRows: skillObRow?.entries ?? [],
      scenarioParticipantSituationObSkill:
        staleScenarioParticipantCombatContext.modifierBuckets.situationObSkill,
      selectedParticipantId: "scyrian",
      selectedScenarioParticipantId: "scenario-scyrian",
      selectedStep: "review_action_modifiers",
    };

    expect(projectedContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "generated:attack-parry:phase1:db-parry",
        value: -4,
      }),
    ]);
    expect(projectedContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("Broad sword preferred 2"),
        sourcePhase: "phase1",
        value: -2,
      }),
    ]);
    expect(browserVisibleTrace).toMatchObject({
      declarationExists: true,
      finalRenderedSkillObSummary: -2,
      finalSkillObRows: [
        expect.objectContaining({
          id: "generated:distance:phase1:ob-skill",
          value: -2,
        }),
      ],
      scenarioParticipantSituationObSkill: [],
      selectedParticipantId: "scyrian",
      selectedScenarioParticipantId: "scenario-scyrian",
    });
  });

  it("removes a committed distance row when the action no longer has an attack phase", () => {
    const projectedContext = projectCombatActionGeneratedModifiers({
      actionId: "full_defense",
      combatContext: buildCommittedContext(),
      phaseContexts,
    });

    expect(projectedContext.modifierBuckets.situationObSkill).toEqual([]);
  });
});
