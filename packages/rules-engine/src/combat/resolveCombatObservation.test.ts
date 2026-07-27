import { describe, expect, it } from "vitest";
import type { SkillDefinition } from "@glantri/domain";

import { resolveCombatObservationSkillProfile } from "./resolveCombatObservation";

function skill(input: {
  groupIds?: string[];
  id: string;
  name: string;
}): SkillDefinition {
  return {
    categoryId: "combat",
    groupId: input.groupIds?.[0] ?? "combat_group",
    groupIds: input.groupIds ?? ["combat_group"],
    id: input.id,
    linkedStats: ["dex"],
    name: input.name,
  } as SkillDefinition;
}

describe("Observe Opponent skill profile", () => {
  it("uses Intelligence with canonical total skill XP and chooses the better basis", () => {
    const profile = resolveCombatObservationSkillProfile({
      sheetSummary: {
        adjustedStats: { dex: 7, int: 14 },
        draftView: {
          skills: [
            { effectiveSkillNumber: 2, skillId: "dodge", totalSkill: 9 },
            { effectiveSkillNumber: 5, skillId: "sword", totalSkill: 12 },
          ],
        },
      },
      skills: [
        skill({ id: "dodge", name: "Dodge" }),
        skill({ id: "sword", name: "Sword" }),
      ],
    });

    expect(profile).toMatchObject({
      baseValue: 19,
      skillId: "sword",
      skillLabel: "Sword",
      profile: {
        avgStats: 14,
        totalXP: 5,
      },
    });
  });
});
