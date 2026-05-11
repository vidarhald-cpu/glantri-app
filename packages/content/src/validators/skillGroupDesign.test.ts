import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";
import { validateCanonicalContent } from "./index";

describe("validateCanonicalContent", () => {
  it("rejects skill-group design regressions for weak groups and isolated combat skills", () => {
    const withGroupMembership = (groupId: string, skillId: string) => ({
      ...defaultCanonicalContent,
      skillGroups: defaultCanonicalContent.skillGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              skillMemberships: [
                ...(group.skillMemberships ?? []),
                { skillId, relevance: "optional" as const }
              ]
            }
          : group
      ),
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === skillId
          ? {
              ...skill,
              groupIds: [...new Set([...skill.groupIds, groupId])]
            }
          : skill
      )
    });
    const weakGroupContent = {
      ...defaultCanonicalContent,
      skillGroups: [
        ...defaultCanonicalContent.skillGroups,
        {
          id: "too_small_group",
          name: "Too Small Group",
          skillMemberships: [{ skillId: "perception", relevance: "optional" as const }],
          sortOrder: 9999
        }
      ],
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === "perception"
          ? {
              ...skill,
              groupIds: [...skill.groupIds, "too_small_group"]
            }
          : skill
      )
    };

    expect(() => validateCanonicalContent(weakGroupContent)).toThrow(
      /insufficient weighted value/
    );
    expect(() => validateCanonicalContent(withGroupMembership("watch_civic_guard", "parry")))
      .toThrow(/contains Parry without Dodge and melee weapon context/);
    expect(() => validateCanonicalContent(withGroupMembership("watch_civic_guard", "dodge")))
      .toThrow(/contains Dodge outside a coherent melee\/defensive combat package/);
    expect(() => validateCanonicalContent(withGroupMembership("watch_civic_guard", "brawling")))
      .toThrow(/contains Brawling outside a coherent melee combat package/);
    expect(() => validateCanonicalContent(withGroupMembership("route_security", "bow")))
      .toThrow(/contains weapon skills or weapon-choice slots/);
  });

  it("keeps known combat packages and context groups inside skill-group design guardrails", () => {
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const groupSkillIdsFor = (groupId: string) =>
      groupById.get(groupId)?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const groupSelectionCandidateIdsFor = (groupId: string) =>
      groupById.get(groupId)?.selectionSlots?.flatMap((slot) => slot.candidateSkillIds) ?? [];
    const combatFundamentalSkillIds = ["dodge", "parry", "brawling"];
    const weaponSkillIds = [
      "one_handed_edged",
      "one_handed_concussion_axe",
      "two_handed_edged",
      "two_handed_concussion_axe",
      "polearms",
      "lance",
      "throwing",
      "sling",
      "bow",
      "crossbow"
    ];
    const meleeWeaponSkillIds = weaponSkillIds.slice(0, 6);
    const contextGroupIds = [
      "watch_civic_guard",
      "route_security",
      "arena_training",
      "ship_command",
      "scholarly_formation",
      "legal_practice",
      "fiscal_administration",
      "temple_service",
      "mortuary_practice",
      "pastoral_work",
      "farm_household_work",
      "coastal_fishing",
      "forestry_resource_work",
      "mining_extraction",
      "smuggling_illicit_trade",
      "craft_specialty",
      "craft_specialty_advanced",
      "construction_specialty"
    ];
    const directCombatGuardrailProfessionIds = [
      "light_infantry",
      "bounty_hunter",
      "gladiator",
      "bodyguard",
      "champion",
      "watchman",
      "jailer"
    ];
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };

    for (const groupId of [
      "basic_melee_training",
      "advanced_melee_training",
      "mounted_warrior_training"
    ]) {
      const fixedSkillIds = groupSkillIdsFor(groupId);
      const slotSkillIds = groupSelectionCandidateIdsFor(groupId);

      expect(fixedSkillIds).toEqual(expect.arrayContaining(["dodge", "parry"]));
      expect(
        fixedSkillIds.some((skillId) => meleeWeaponSkillIds.includes(skillId)) ||
          slotSkillIds.some((skillId) => meleeWeaponSkillIds.includes(skillId))
      ).toBe(true);
    }

    for (const groupId of contextGroupIds) {
      const skillIds = [
        ...groupSkillIdsFor(groupId),
        ...groupSelectionCandidateIdsFor(groupId)
      ];

      expect(skillIds.filter((skillId) =>
        [...combatFundamentalSkillIds, ...weaponSkillIds].includes(skillId)
      )).toEqual([]);
    }

    for (const professionId of directCombatGuardrailProfessionIds) {
      const directSkillIds = grantsFor(professionId)
        .filter((grant) => grant.grantType !== "group" && grant.skillId)
        .map((grant) => grant.skillId ?? "");

      expect(directSkillIds.filter((skillId) =>
        [...combatFundamentalSkillIds, ...weaponSkillIds].includes(skillId)
      )).toEqual([]);
    }
  });

});
