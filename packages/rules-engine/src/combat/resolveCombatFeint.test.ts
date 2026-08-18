import { describe, expect, it } from "vitest";
import type { SkillDefinition } from "@glantri/domain";

import {
  resolveCombatFeintSkillContest,
  resolveCombatFeintSkillPreview,
  resolveCombatFeintSkillProfile,
  resolveCombatFeintTable,
  resolveHighestCombatFeintResistanceProfile,
} from "./resolveCombatFeint";

describe("resolveCombatFeintTable", () => {
  it.each([
    [-16, 2, -4, "defender_strong"],
    [-15, 0, -2, "defender_edge"],
    [-6, 0, -2, "defender_edge"],
    [-5, 0, -1, "balanced"],
    [0, 0, -1, "balanced"],
    [1, -2, 0, "attacker_edge"],
    [10, -2, 0, "attacker_edge"],
    [11, -4, 0, "attacker_strong"],
  ] as const)(
    "maps difference %i to defender %i and attacker %i",
    (difference, defenderObDbModifier, attackerPhase1DbParryModifier, band) => {
      expect(resolveCombatFeintTable(difference)).toEqual({
        attackerPhase1DbParryModifier,
        band,
        defenderObDbModifier,
        difference,
      });
    },
  );
});

describe("combat feint skill profiles", () => {
  const skill = (input: { id: string; name: string; totalSkill: number }): SkillDefinition =>
    ({
      categoryId: "combat",
      groupId: "combat_group",
      groupIds: ["combat_group"],
      id: input.id,
      linkedStats: ["str", "dex"],
      name: input.name,
      totalSkill: input.totalSkill,
    }) as unknown as SkillDefinition;
  const sheetSummary = {
    adjustedStats: { dex: 8, int: 14, str: 20 },
    draftView: {
      skills: [
        { effectiveSkillNumber: 5, skillId: "brawling", totalSkill: 13 },
        { effectiveSkillNumber: 3, skillId: "sword", totalSkill: 17 },
      ],
    },
  };

  it("uses Dexterity for the attacker without changing canonical skill XP", () => {
    const profile = resolveCombatFeintSkillProfile({
      characteristic: "dex",
      sheetSummary,
      skill: skill({ id: "brawling", name: "Brawling", totalSkill: 13 }),
    });

    expect(profile).toMatchObject({ avgStats: 8, rollBaseValue: 13, totalXP: 5 });
  });

  it("selects the highest total-XP close-combat resistance using Intelligence", () => {
    const profile = resolveHighestCombatFeintResistanceProfile({
      sheetSummary,
      skills: [
        skill({ id: "brawling", name: "Brawling", totalSkill: 13 }),
        skill({ id: "sword", name: "Sword", totalSkill: 17 }),
      ],
    });

    expect(profile).toMatchObject({
      avgStats: 14,
      rollBaseValue: 13,
      skillId: "brawling",
      totalXP: 5,
    });
  });
});

describe("canonical Feint Skill Contests", () => {
  it("previews initiator modifiers without Observe or unrelated combat buckets", () => {
    const contribution = (input: {
      bucket: "general_fatigue" | "skill_ob" | "db_parry";
      id: string;
      sourceId: string;
      value: number;
    }) => ({
      applicability: {},
      bucket: input.bucket,
      editPolicy: "system_only" as const,
      id: input.id,
      label: input.id,
      lifetime: { kind: "round" as const, status: "active" as const },
      ownerParticipantId: "attacker",
      readOnly: true,
      schemaVersion: 1,
      sourceId: input.sourceId,
      sourceKind: "system_derived" as const,
      value: input.value,
    });
    const preview = resolveCombatFeintSkillPreview({
      context: {
        actionId: "feint_attack",
        encounterId: "encounter-1",
        ownerParticipantId: "attacker",
        phase: "phase1",
        roundNumber: 1,
        skillId: "dodge",
        step: "phase_1_actions",
      },
      governingStatValue: 16,
      method: "movement",
      modifierContributions: [
        contribution({ bucket: "general_fatigue", id: "ce", sourceId: "ce-effect", value: -2 }),
        contribution({ bucket: "skill_ob", id: "observe", sourceId: "observe-link", value: 8 }),
        contribution({ bucket: "db_parry", id: "db", sourceId: "weapon-db", value: -4 }),
      ],
      observationRelationshipIds: new Set(["observe-link"]),
      participantId: "attacker",
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(preview).toMatchObject({ baseSkill: 22, preDieTotal: 18 });
    expect(preview.percentageContributions.map((entry) => entry.id)).toEqual(["ce"]);
  });

  const roll = { dieResult: 6, openEndedD10s: [] as number[], rollD20: 6 };
  const relationships = [
    {
      bestBonus: 1,
      completedAttempts: 1,
      id: "observation:a:b",
      observerParticipantId: "a",
      roundsTowardNextAttempt: 0,
      targetParticipantId: "b",
    },
    {
      bestBonus: 3,
      completedAttempts: 1,
      id: "observation:b:a",
      observerParticipantId: "b",
      roundsTowardNextAttempt: 0,
      targetParticipantId: "a",
    },
  ];

  it("uses Dexterity plus total Dodge XP for Movement Feint without MM or Observe", () => {
    const result = resolveCombatFeintSkillContest({
      calculationId: "feint:a:movement",
      governingStatValue: 16,
      method: "movement",
      observationRelationships: relationships,
      opponentParticipantId: "b",
      participantId: "a",
      percentageContributions: [
        {
          category: "general_fatigue",
          id: "fatigue",
          label: "Fatigue",
          unit: "percentage",
          value: -1,
        },
      ],
      roll,
      side: "initiator",
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(result).toMatchObject({
      baseSkill: 22,
      contestType: "movement_feint",
      finalResult: 26,
      missingContributionPoints: ["withdrawal_backout"],
      preDieTotal: 20,
      role: "movement_feint_initiator",
      totalPercentageAdjustment: -1,
    });
    expect(result.percentageContributions.map((entry) => entry.category)).toEqual([
      "general_fatigue",
    ]);
    expect(result.movementBurden).toBeUndefined();
  });

  it("uses the selected weapon skill XP without accepting weapon-resolution values", () => {
    const result = resolveCombatFeintSkillContest({
      calculationId: "feint:a:weapon",
      governingStatValue: 16,
      method: "weapon",
      observationRelationships: relationships,
      opponentParticipantId: "b",
      participantId: "a",
      roll,
      side: "initiator",
      skill: { id: "sword", label: "Sword", totalXp: 8 },
    });

    expect(result).toMatchObject({
      baseSkill: 24,
      contestType: "weapon_feint",
      finalResult: 30,
      preDieTotal: 24,
      role: "weapon_feint_initiator",
    });
    expect(result.percentageContributions).toEqual([]);
  });

  it("gives only the defending observer one directional relationship contribution", () => {
    const defender = resolveCombatFeintSkillContest({
      calculationId: "feint:b:defense",
      governingStatValue: 14,
      method: "weapon",
      observationRelationships: relationships,
      opponentParticipantId: "a",
      participantId: "b",
      roll,
      side: "defender",
      skill: { id: "sword", label: "Sword", totalXp: 8 },
    });
    const unrelated = resolveCombatFeintSkillContest({
      calculationId: "feint:b:unrelated",
      governingStatValue: 14,
      method: "weapon",
      observationRelationships: relationships,
      opponentParticipantId: "c",
      participantId: "b",
      roll,
      side: "defender",
      skill: { id: "sword", label: "Sword", totalXp: 8 },
    });

    expect(defender).toMatchObject({
      baseSkill: 22,
      derivedIntegerAdjustment: 7,
      finalResult: 35,
      role: "feint_defender",
      totalPercentageAdjustment: 3,
    });
    expect(defender.percentageContributions).toEqual([
      expect.objectContaining({ category: "relationship", value: 3 }),
    ]);
    expect(unrelated.percentageContributions).toEqual([]);
  });

  it("applies one GM adjustment through the combined workbook percentage path", () => {
    const result = resolveCombatFeintSkillContest({
      calculationId: "feint:a:gm",
      governingStatValue: 16,
      gmAdjustment: 1,
      method: "movement",
      observationRelationships: [],
      opponentParticipantId: "b",
      participantId: "a",
      percentageContributions: [
        {
          category: "skill_ob",
          id: "skill-ob",
          label: "Skill/OB",
          unit: "percentage",
          value: 1,
        },
      ],
      roll,
      side: "initiator",
      skill: { id: "dodge", label: "Dodge", totalXp: 6 },
    });

    expect(result).toMatchObject({
      baseSkill: 22,
      derivedIntegerAdjustment: 4,
      finalResult: 32,
      preDieTotal: 26,
      totalPercentageAdjustment: 2,
    });
    expect(result.percentageContributions.map((entry) => entry.category)).toEqual([
      "skill_ob",
      "gm_adjustment",
    ]);
  });
});
