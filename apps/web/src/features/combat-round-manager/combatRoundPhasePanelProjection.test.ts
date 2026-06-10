import { describe, expect, it } from "vitest";

import type {
  CombatRoundParryResolution,
  CombatRoundStep,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";

import type {
  PlayerCombatAttackStatsView,
  PlayerCombatDefenseStatsView,
  PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";

import { buildCombatRoundPhasePanelProjection } from "./combatRoundPhasePanelProjection";

const phaseCard: PlayerCombatPhaseCardView = {
  description: "",
  phaseLabel: "Phase 1",
  stats: [],
  title: "",
};

const phaseContext: ScenarioParticipantCombatContext = {
  incomingAttackSide: "front",
  mainHandParryDirection: "left_forward",
  modifierBuckets: {
    general: [],
    situationDb: [],
    situationInitiative: [],
    situationObSkill: [],
  },
  offHandParryDirection: "left",
};

const attackStats: PlayerCombatAttackStatsView = {
  attackMode: "C",
  dmb: "8",
  initiative: "3",
  maxCrits: "FS",
  ob: "9",
  weaponName: "Long sword",
};

const phaseDefenseStats: PlayerCombatDefenseStatsView = {
  db: "14",
  dm: "0",
  parry: "13",
  sourceName: "Sword / shield",
};

function buildProjection(input: {
  selectedResolutionContext?: Parameters<typeof buildCombatRoundPhasePanelProjection>[0]["selectedResolutionContext"];
  selectedStep?: CombatRoundStep;
} = {}) {
  return buildCombatRoundPhasePanelProjection({
    actionId: "double_attack",
    attackStats,
    liveModifiers: {
      dbRaw: -4,
      generalFatigueRaw: 0,
      initiativeRaw: 0,
      modifierNoteLabels: [],
      obSkillRaw: -1,
    },
    participantId: "defender",
    phaseCard,
    phaseContext,
    phaseDefenseStats,
    phaseKey: "phase1",
    secondaryActionId: "attack_parry",
    selectedResolutionContext: input.selectedResolutionContext,
    selectedStep: input.selectedStep ?? "phase_1_actions",
  });
}

describe("buildCombatRoundPhasePanelProjection", () => {
  it("uses phase-aware attack rows for the selected context", () => {
    const projection = buildProjection();

    expect(projection.attackRows?.ob).toBe("9");
    expect(projection.phaseModel.attackStats?.ob).toBe("9");
    expect(projection.modifierContext.phaseModifiers.obSkillRaw).toBe(-1);
  });

  it("uses phase-aware defense rows without adding situational modifiers by default", () => {
    const projection = buildProjection();

    expect(projection.defenseRows).toMatchObject({
      db: "14",
      parry: "13",
      sourceName: "Sword / shield",
    });
    expect(projection.modifierContext.phaseModifiers.dbRaw).toBe(-4);
    expect(projection.modifierContext.situationalModifiers).toEqual([]);
  });

  it("applies the attack-result parry modifier only in the selected incoming context", () => {
    const projection = buildProjection({
      selectedResolutionContext: {
        attackResultId: "round:phase1:attacker:defender",
        parryBase: 13,
        parryModifierCalculation: {
          baseValue: 13,
          finalValue: 7,
          percentageAdjustment: -6,
          rawModifierTotal: -6,
          rawModifiers: [
            { label: "DB/Parry", value: -4 },
            { label: "attack result", value: -2 },
          ],
        },
        parrySourceLabel: "Sword / shield",
      },
      selectedStep: "review_phase_2_actions",
    });

    expect(projection.contextAttackResultId).toBe("round:phase1:attacker:defender");
    expect(projection.defenseRows?.parry).toBe("7");
    expect(projection.modifierContext.situationalModifiers).toEqual([
      { label: "attack result", source: "attackResult", value: -2 },
    ]);
  });

  it("drops the prior incoming attack situational modifier when context moves elsewhere", () => {
    const projection = buildProjection({
      selectedStep: "phase_1_actions",
    });

    expect(projection.contextAttackResultId).toBeUndefined();
    expect(projection.defenseRows?.parry).toBe("13");
    expect(projection.modifierContext.situationalModifiers).toEqual([]);
  });

  it("preserves separate parry histories for separate selected contexts", () => {
    const firstParry: CombatRoundParryResolution = {
      combinedParryScore: 13,
      modifiedParryBeforeRoll: 7,
      modifierAdjustment: -6,
      modifierBreakdown: [
        { label: "DB/Parry", value: -4 },
        { label: "attack result", value: -2 },
      ],
      openEndedD10s: [],
      parrySourceLabel: "Sword / shield",
      rawModifierTotal: -6,
      resultLabel: "Parry failed",
      rollD20: 14,
      rollTotal: 14,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 21,
    };
    const secondParry: CombatRoundParryResolution = {
      combinedParryScore: 12,
      modifiedParryBeforeRoll: 9,
      modifierAdjustment: -3,
      modifierBreakdown: [
        { label: "DB/Parry", value: -1 },
        { label: "attack result", value: -2 },
      ],
      openEndedD10s: [],
      parrySourceLabel: "Medium shield",
      rawModifierTotal: -3,
      resultLabel: "Parry successful",
      rollD20: 15,
      rollTotal: 15,
      status: "resolved",
      success: true,
      targetNumber: 21,
      total: 24,
    };

    const firstProjection = buildProjection({
      selectedResolutionContext: {
        attackResultId: "round:phase1:first:defender",
        parryResolution: firstParry,
      },
      selectedStep: "review_phase_2_actions",
    });
    const secondProjection = buildProjection({
      selectedResolutionContext: {
        attackResultId: "round:phase1:second:defender",
        parryResolution: secondParry,
      },
      selectedStep: "review_phase_2_actions",
    });

    expect(firstProjection.defenseRows).toMatchObject({
      parry: "7",
      sourceName: "Sword / shield",
    });
    expect(secondProjection.defenseRows).toMatchObject({
      parry: "9",
      sourceName: "Medium shield",
    });
  });

  it("replays stored parry context instead of current live recalculation", () => {
    const projection = buildProjection({
      selectedResolutionContext: {
        attackResultId: "round:phase1:attacker:defender",
        parryBase: 13,
        parryModifierCalculation: {
          baseValue: 13,
          finalValue: 99,
          percentageAdjustment: 86,
          rawModifierTotal: 86,
          rawModifiers: [{ label: "attack result", value: 86 }],
        },
        parryResolution: {
          combinedParryScore: 13,
          modifiedParryBeforeRoll: 7,
          modifierAdjustment: -6,
          modifierBreakdown: [
            { label: "DB/Parry", value: -4 },
            { label: "attack result", value: -2 },
          ],
          openEndedD10s: [],
          parrySourceLabel: "Sword / shield",
          rawModifierTotal: -6,
          resultLabel: "Parry failed",
          rollD20: 14,
          rollTotal: 14,
          status: "resolved",
          success: false,
          targetNumber: 21,
          total: 21,
        },
      },
      selectedStep: "review_phase_2_actions",
    });

    expect(projection.defenseRows?.parry).toBe("7");
    expect(projection.modifierContext.situationalModifiers).toEqual([
      { label: "attack result", source: "attackResult", value: -2 },
    ]);
  });

  it("keeps the player current view on the active context rather than stale situational context", () => {
    const activeAttackProjection = buildProjection({
      selectedStep: "phase_1_actions",
    });
    const activeParryProjection = buildProjection({
      selectedResolutionContext: {
        attackResultId: "round:phase1:active:defender",
        parryBase: 13,
        parryModifierCalculation: {
          baseValue: 13,
          finalValue: 7,
          percentageAdjustment: -6,
          rawModifierTotal: -6,
          rawModifiers: [
            { label: "DB/Parry", value: -4 },
            { label: "attack result", value: -2 },
          ],
        },
        parrySourceLabel: "Sword / shield",
      },
      selectedStep: "review_phase_2_actions",
    });

    expect(activeAttackProjection.modifierContext.situationalModifiers).toEqual([]);
    expect(activeAttackProjection.defenseRows?.parry).toBe("13");
    expect(activeParryProjection.modifierContext.situationalModifiers).toEqual([
      { label: "attack result", source: "attackResult", value: -2 },
    ]);
    expect(activeParryProjection.defenseRows?.parry).toBe("7");
  });
});
