import { describe, expect, it } from "vitest";
import type { SkillDefinition } from "@glantri/domain";

import {
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

  it("selects the highest close-combat resistance using Intelligence", () => {
    const profile = resolveHighestCombatFeintResistanceProfile({
      sheetSummary,
      skills: [
        skill({ id: "brawling", name: "Brawling", totalSkill: 13 }),
        skill({ id: "sword", name: "Sword", totalSkill: 17 }),
      ],
    });

    expect(profile).toMatchObject({
      avgStats: 14,
      rollBaseValue: 17,
      skillId: "sword",
      totalXP: 3,
    });
  });
});
