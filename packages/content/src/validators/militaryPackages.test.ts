import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";

describe("validateCanonicalContent", () => {
  it("keeps broad soldier grants separate from officer command education", () => {
    const affectedOrdinaryProfessionIds = [
      "tribal_warrior",
      "clan_warriors",
      "levy_infantry",
      "caravan_guard",
      "watchman",
      "jailer",
      "light_infantry",
      "heavy_infantry",
      "village_guard",
      "militia_fighter",
      "garrison_soldier",
      "cavalry",
      "cavalry_mounted_retainer",
      "bodyguard",
      "gladiator",
      "outrider_scout",
      "champion"
    ];
    const soldierFamily = defaultCanonicalContent.professionFamilies.find(
      (family) => family.id === "soldier"
    );
    const grantsFor = (professionId: string) => {
      const profession = defaultCanonicalContent.professions.find(
        (candidate) => candidate.id === professionId
      );

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType === "group")
        .map((grant) => grant.skillGroupId);
    const skillIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.skillId)
        .map((grant) => grant.skillId!);
    const groupSkillIdsFor = (groupId: string) =>
      defaultCanonicalContent.skillGroups
        .find((group) => group.id === groupId)
        ?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const groupSelectionCandidateIdsFor = (groupId: string) =>
      defaultCanonicalContent.skillGroups
        .find((group) => group.id === groupId)
        ?.selectionSlots?.flatMap((slot) => slot.candidateSkillIds) ?? [];
    const skillById = new Map(defaultCanonicalContent.skills.map((skill) => [skill.id, skill]));
    const skillWeightFor = (skillId: string) =>
      skillById.get(skillId)?.category === "secondary" ? 1 : 2;
    const groupWeightedValueFor = (groupId: string) =>
      groupSkillIdsFor(groupId).reduce((total, skillId) => total + skillWeightFor(skillId), 0);
    const minimumSlotWeightedValueFor = (groupId: string) =>
      defaultCanonicalContent.skillGroups
        .find((group) => group.id === groupId)
        ?.selectionSlots?.reduce((total, slot) => {
          const candidateWeights = slot.candidateSkillIds.map((skillId) => skillWeightFor(skillId));
          const minimumCandidateWeight = Math.min(...candidateWeights);

          return total + minimumCandidateWeight * slot.chooseCount;
        }, 0) ?? 0;
    const directOnlySkillIdsFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return skillIdsFor(professionId).filter((skillId) => !skillIdsFromGroups.includes(skillId));
    };
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return new Set([...skillIdsFromGroups, ...directOnlySkillIdsFor(professionId)]).size;
    };
    const familySkillIdsFor = (professionFamilyId: string) =>
      defaultCanonicalContent.professionSkills
        .filter(
          (grant) =>
            grant.scope === "family" &&
            grant.professionId === professionFamilyId &&
            grant.skillId
        )
        .map((grant) => grant.skillId!);

    expect(soldierFamily).toBeDefined();
    expect(familySkillIdsFor("soldier")).toEqual([]);
    expect(groupIdsFor("tribal_warrior")).toEqual(
      expect.arrayContaining(["basic_melee_training", "veteran_soldiering"])
    );

    for (const professionId of affectedOrdinaryProfessionIds) {
      const groupIds = groupIdsFor(professionId);
      const skillIds = skillIdsFor(professionId);

      expect(groupIds).not.toContain("veteran_leadership");
      expect(skillIds).not.toContain("captaincy");
      expect(skillIds).not.toContain("tactics");
      expect(new Set(groupIds).size).toBe(groupIds.length);
      expect(groupIds.length).toBeGreaterThanOrEqual(2);
    }

    expect(groupIdsFor("watchman")).toEqual(
      expect.arrayContaining(["basic_melee_training", "defensive_soldiering", "watch_civic_guard"])
    );
    expect(groupIdsFor("jailer")).toEqual(
      expect.arrayContaining(["basic_melee_training", "defensive_soldiering", "watch_civic_guard"])
    );
    expect(groupIdsFor("cavalry")).toEqual(
      expect.arrayContaining(["mounted_warrior_training", "veteran_soldiering"])
    );
    expect(groupIdsFor("light_infantry")).toEqual(
      expect.arrayContaining([
        "basic_missile_training",
        "basic_melee_training",
        "defensive_soldiering",
        "veteran_soldiering"
      ])
    );
    expect(skillIdsFor("light_infantry")).toEqual([]);
    expect(skillReachFor("light_infantry")).toBeGreaterThanOrEqual(15);
    expect(groupSelectionCandidateIdsFor("basic_missile_training")).toEqual([
      "throwing",
      "sling",
      "bow",
      "crossbow"
    ]);
    expect(groupSkillIdsFor("basic_missile_training")).toEqual(
      expect.arrayContaining(["perception", "concentration", "weapon_maintenance"])
    );
    expect(groupSkillIdsFor("basic_missile_training")).not.toContain("longbow");
    expect(groupSkillIdsFor("basic_missile_training")).not.toContain("self_control");
    expect(groupSkillIdsFor("basic_missile_training").filter((skillId) =>
      ["dodge", "parry", "veteran_leadership", "captaincy", "tactics"].includes(skillId)
    )).toEqual([]);
    expect(groupSkillIdsFor("basic_missile_training").filter((skillId) =>
      [
        "one_handed_edged",
        "one_handed_concussion_axe",
        "two_handed_edged",
        "two_handed_concussion_axe",
        "polearms",
        "lance"
      ].includes(skillId)
    )).toEqual([]);
    expect(groupWeightedValueFor("basic_missile_training")).toBeGreaterThanOrEqual(5);
    expect(
      groupWeightedValueFor("basic_missile_training") +
        minimumSlotWeightedValueFor("basic_missile_training")
    ).toBeGreaterThanOrEqual(6);
    expect(groupSelectionCandidateIdsFor("advanced_missile_training")).toEqual([
      "throwing",
      "sling",
      "bow",
      "crossbow"
    ]);
    expect(groupSkillIdsFor("advanced_missile_training")).toEqual(
      expect.arrayContaining([
        "perception",
        "concentration",
        "weapon_maintenance",
        "battlefield_awareness",
        "combat_experience"
      ])
    );
    expect(groupSkillIdsFor("advanced_missile_training")).not.toContain("longbow");
    expect(groupSkillIdsFor("advanced_missile_training")).not.toContain("self_control");
    expect(groupSkillIdsFor("advanced_missile_training").filter((skillId) =>
      ["dodge", "parry", "veteran_leadership", "captaincy", "tactics"].includes(skillId)
    )).toEqual([]);
    expect(groupSelectionCandidateIdsFor("basic_melee_training")).toEqual(
      expect.arrayContaining(["one_handed_edged", "polearms"])
    );
    expect(groupSkillIdsFor("basic_melee_training")).toEqual(
      expect.arrayContaining(["dodge", "parry", "brawling"])
    );
    expect(defaultCanonicalContent.skills.find((skill) => skill.id === "longbow")).toMatchObject({
      specializationOfSkillId: "bow"
    });
    expect(groupSkillIdsFor("defensive_soldiering")).toEqual(
      expect.arrayContaining([
        "formation_fighting",
        "battlefield_awareness",
        "perception",
        "combat_experience",
        "first_aid"
      ])
    );
    expect(groupSkillIdsFor("defensive_soldiering")).not.toContain("self_control");
    expect(groupSkillIdsFor("defensive_soldiering").filter((skillId) =>
      ["dodge", "parry", "brawling"].includes(skillId)
    )).toEqual([]);
    expect(groupWeightedValueFor("defensive_soldiering")).toBeGreaterThanOrEqual(6);
    expect(defaultCanonicalContent.skills.find((skill) => skill.id === "self_control")).toBeDefined();
    expect(defaultCanonicalContent.skillGroups
      .filter((group) =>
        (group.skillMemberships ?? []).some((membership) => membership.skillId === "self_control")
      )
      .map((group) => group.id)
      .sort()).toEqual(["mental_discipline", "mental_group"]);
    expect(groupSkillIdsFor("veteran_soldiering")).toEqual(
      expect.arrayContaining([
        "combat_experience",
        "battlefield_awareness",
        "perception",
        "first_aid",
        "weapon_maintenance"
      ])
    );
    expect(groupSkillIdsFor("veteran_soldiering").filter((skillId) =>
      ["dodge", "parry", "brawling"].includes(skillId)
    )).toEqual([]);
    expect(groupWeightedValueFor("veteran_soldiering")).toBeGreaterThanOrEqual(6);
    expect(skillById.get("dodge")?.groupIds).not.toEqual(
      expect.arrayContaining([
        "basic_missile_training",
        "advanced_missile_training",
        "defensive_soldiering",
        "veteran_soldiering"
      ])
    );
    expect(skillById.get("parry")?.groupIds).not.toEqual(
      expect.arrayContaining(["defensive_soldiering", "veteran_soldiering"])
    );
    for (const group of defaultCanonicalContent.skillGroups) {
      const groupSkillIds = group.skillMemberships?.map((membership) => membership.skillId) ?? [];
      const hasDodgeOrParry = groupSkillIds.some((skillId) =>
        ["dodge", "parry"].includes(skillId)
      );

      if (!hasDodgeOrParry) {
        continue;
      }

      expect(groupSkillIds).toEqual(expect.arrayContaining(["dodge", "parry"]));
      expect(
        group.selectionSlots?.some((slot) => slot.candidateSkillIds.length > 0) ||
          groupSkillIds.some((skillId) =>
            [
              "one_handed_edged",
              "one_handed_concussion_axe",
              "two_handed_edged",
              "two_handed_concussion_axe",
              "polearms",
              "lance"
            ].includes(skillId)
          )
      ).toBe(true);
    }
    expect(groupIdsFor("military_officer")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "defensive_soldiering",
        "veteran_leadership",
        "veteran_soldiering"
      ])
    );
    expect(skillIdsFor("military_officer")).toEqual(
      expect.arrayContaining(["captaincy", "tactics"])
    );
    expect(groupIdsFor("military_officer").length).toBeGreaterThan(
      groupIdsFor("tribal_warrior").length
    );

    expect(skillIdsFor("watchman")).not.toContain("riding");
    expect(skillIdsFor("jailer")).not.toContain("riding");
    expect(skillIdsFor("caravan_guard")).not.toContain("formation_fighting");
    expect(skillIdsFor("bodyguard")).not.toContain("formation_fighting");
    expect(skillIdsFor("champion")).not.toContain("formation_fighting");
    expect(skillIdsFor("heavy_infantry")).toContain("formation_fighting");
  });

  it("gives civic guard professions a watch-focused skill group without officer training", () => {
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
        .map((grant) => grant.skillGroupId ?? "");
    const directOnlySkillIdsFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);
      const directSkillIds = grantsFor(professionId)
        .filter((grant) => grant.grantType !== "group" && grant.skillId)
        .map((grant) => grant.skillId ?? "");

      return directSkillIds.filter((skillId) => !skillIdsFromGroups.includes(skillId));
    };
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return new Set([...skillIdsFromGroups, ...directOnlySkillIdsFor(professionId)]).size;
    };

    const watchGroup = groupById.get("watch_civic_guard");
    const watchMembershipIds =
      watchGroup?.skillMemberships?.map((membership) => membership.skillId) ?? [];

    expect(watchGroup).toMatchObject({
      id: "watch_civic_guard",
      name: "Watch / Civic Guard"
    });
    expect(watchMembershipIds).toEqual(
      expect.arrayContaining([
        "perception",
        "search",
        "law",
        "insight",
        "social_perception"
      ])
    );
    expect(watchMembershipIds).not.toContain("parry");
    expect(watchMembershipIds).not.toContain("dodge");
    expect(watchMembershipIds).not.toContain("brawling");
    expect(watchMembershipIds).not.toContain("one_handed_edged");
    expect(watchMembershipIds).not.toContain("one_handed_concussion_axe");
    expect(watchMembershipIds).not.toContain("two_handed_edged");
    expect(watchMembershipIds).not.toContain("two_handed_concussion_axe");
    expect(watchMembershipIds).not.toContain("polearms");
    expect(watchMembershipIds).not.toContain("lance");
    expect(watchMembershipIds).not.toContain("captaincy");
    expect(watchMembershipIds).not.toContain("tactics");
    expect(watchMembershipIds).not.toContain("veteran_leadership");

    for (const professionId of ["watchman", "jailer"]) {
      const groupIds = groupIdsFor(professionId);

      expect(groupIds).toEqual(
        expect.arrayContaining([
          "basic_melee_training",
          "defensive_soldiering",
          "watch_civic_guard"
        ])
      );
      expect(groupIds).not.toContain("veteran_leadership");
      expect(new Set(groupIds).size).toBe(groupIds.length);
      expect(groupIds.length).toBeGreaterThanOrEqual(2);
      expect(skillReachFor(professionId)).toBeGreaterThan(10);
    }

    expect(directOnlySkillIdsFor("watchman")).not.toContain("search");
    expect(directOnlySkillIdsFor("jailer")).not.toContain("perception");
  });

  it("gives Caravan Guard route-security training without officer or isolated combat group leakage", () => {
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
        .map((grant) => grant.skillGroupId ?? "");
    const directSkillIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType !== "group" && grant.skillId)
        .map((grant) => grant.skillId ?? "");
    const directOnlySkillIdsFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );
    };
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return new Set([...skillIdsFromGroups, ...directOnlySkillIdsFor(professionId)]).size;
    };

    const routeGroup = groupById.get("route_security");
    const routeMembershipIds =
      routeGroup?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const caravanGroupIds = groupIdsFor("caravan_guard");

    expect(routeGroup).toMatchObject({
      id: "route_security",
      name: "Route Security"
    });
    expect(routeMembershipIds).toEqual(
      expect.arrayContaining([
        "perception",
        "search",
        "riding",
        "animal_care",
        "teamstering",
        "first_aid"
      ])
    );
    expect(routeMembershipIds).not.toContain("captaincy");
    expect(routeMembershipIds).not.toContain("tactics");
    expect(routeMembershipIds).not.toContain("veteran_leadership");
    expect(routeMembershipIds).not.toContain("parry");
    expect(routeMembershipIds).not.toContain("dodge");
    expect(routeMembershipIds).not.toContain("brawling");
    expect(routeMembershipIds).not.toContain("one_handed_edged");
    expect(routeMembershipIds).not.toContain("one_handed_concussion_axe");
    expect(routeMembershipIds).not.toContain("two_handed_edged");
    expect(routeMembershipIds).not.toContain("two_handed_concussion_axe");
    expect(routeMembershipIds).not.toContain("polearms");
    expect(routeMembershipIds).not.toContain("lance");

    expect(caravanGroupIds).toEqual(
      expect.arrayContaining(["basic_melee_training", "route_security", "veteran_soldiering"])
    );
    expect(caravanGroupIds).not.toContain("veteran_leadership");
    expect(new Set(caravanGroupIds).size).toBe(caravanGroupIds.length);
    expect(caravanGroupIds.length).toBeGreaterThanOrEqual(2);
    expect(skillReachFor("caravan_guard")).toBeGreaterThan(10);
    expect(directOnlySkillIdsFor("caravan_guard")).toEqual(["throwing"]);
    expect(directOnlySkillIdsFor("caravan_guard")).not.toContain("formation_fighting");
    expect(directOnlySkillIdsFor("caravan_guard")).not.toContain("weapon_maintenance");
    expect(directOnlySkillIdsFor("caravan_guard")).not.toContain("perception");
    expect(directOnlySkillIdsFor("caravan_guard")).not.toContain("riding");
    expect(directOnlySkillIdsFor("caravan_guard")).not.toContain("first_aid");

    const watchMembershipIds =
      groupById.get("watch_civic_guard")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];

    expect(watchMembershipIds).not.toContain("parry");
  });

  it("gives Gladiator arena-fighter training without battlefield command inheritance", () => {
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
        .map((grant) => grant.skillGroupId ?? "");
    const directSkillIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType !== "group" && grant.skillId)
        .map((grant) => grant.skillId ?? "");
    const directOnlySkillIdsFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );
    };
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return new Set([...skillIdsFromGroups, ...directOnlySkillIdsFor(professionId)]).size;
    };

    const arenaGroup = groupById.get("arena_training");
    const arenaMembershipIds =
      arenaGroup?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const gladiator = professionById.get("gladiator");
    const gladiatorGroupIds = groupIdsFor("gladiator");

    expect(
      defaultCanonicalContent.professionFamilies.some((family) => family.id === "arena_fighter")
    ).toBe(true);
    expect(gladiator).toMatchObject({
      familyId: "arena_fighter",
      id: "gladiator",
      name: "Gladiator"
    });
    expect(arenaGroup).toMatchObject({
      id: "arena_training",
      name: "Arena Training"
    });
    expect(arenaMembershipIds).toEqual(
      expect.arrayContaining([
        "combat_experience",
        "perception",
        "acting",
        "oratory",
        "weapon_maintenance"
      ])
    );
    expect(arenaMembershipIds).not.toContain("dodge");
    expect(arenaMembershipIds).not.toContain("brawling");
    expect(arenaMembershipIds).not.toContain("captaincy");
    expect(arenaMembershipIds).not.toContain("tactics");
    expect(arenaMembershipIds).not.toContain("veteran_leadership");
    expect(arenaMembershipIds).not.toContain("formation_fighting");
    expect(arenaMembershipIds).not.toContain("parry");
    expect(arenaMembershipIds).not.toContain("one_handed_edged");
    expect(arenaMembershipIds).not.toContain("one_handed_concussion_axe");
    expect(arenaMembershipIds).not.toContain("two_handed_edged");
    expect(arenaMembershipIds).not.toContain("two_handed_concussion_axe");
    expect(arenaMembershipIds).not.toContain("polearms");
    expect(arenaMembershipIds).not.toContain("lance");

    expect(gladiatorGroupIds).toEqual(
      expect.arrayContaining(["advanced_melee_training", "arena_training"])
    );
    expect(gladiatorGroupIds).not.toContain("veteran_soldiering");
    expect(gladiatorGroupIds).not.toContain("veteran_leadership");
    expect(new Set(gladiatorGroupIds).size).toBe(gladiatorGroupIds.length);
    expect(gladiatorGroupIds.length).toBeGreaterThanOrEqual(2);
    expect(skillReachFor("gladiator")).toBeGreaterThan(10);
    expect(directSkillIdsFor("gladiator")).not.toContain("formation_fighting");
    expect(directSkillIdsFor("gladiator")).not.toContain("captaincy");
    expect(directSkillIdsFor("gladiator")).not.toContain("tactics");

    const watchMembershipIds =
      groupById.get("watch_civic_guard")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];
    const routeMembershipIds =
      groupById.get("route_security")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];

    expect(watchMembershipIds).not.toContain("parry");
    expect(routeMembershipIds).not.toContain("captaincy");
    expect(routeMembershipIds).not.toContain("tactics");
    expect(routeMembershipIds).not.toContain("veteran_leadership");
  });

  it("gives Ships Officer maritime command training without promoting ordinary sailors", () => {
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
        .map((grant) => grant.skillGroupId ?? "");
    const directSkillIdsFor = (professionId: string) =>
      grantsFor(professionId)
        .filter((grant) => grant.grantType !== "group" && grant.skillId)
        .map((grant) => grant.skillId ?? "");
    const directOnlySkillIdsFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );
    };
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return new Set([...skillIdsFromGroups, ...directOnlySkillIdsFor(professionId)]).size;
    };

    const shipCommandGroup = groupById.get("ship_command");
    const shipCommandMembershipIds =
      shipCommandGroup?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const shipsOfficerGroupIds = groupIdsFor("ships_officer");

    expect(shipCommandGroup).toMatchObject({
      id: "ship_command",
      name: "Ship Command"
    });
    expect(shipCommandMembershipIds).toEqual(
      expect.arrayContaining([
        "captaincy",
        "sailing",
        "navigation",
        "perception",
        "insight",
        "oratory",
        "administration"
      ])
    );
    expect(shipCommandMembershipIds).not.toContain("veteran_leadership");
    expect(shipCommandMembershipIds).not.toContain("tactics");
    expect(shipCommandMembershipIds).not.toContain("dodge");
    expect(shipCommandMembershipIds).not.toContain("brawling");
    expect(shipCommandMembershipIds).not.toContain("parry");
    expect(shipCommandMembershipIds).not.toContain("one_handed_edged");
    expect(shipCommandMembershipIds).not.toContain("one_handed_concussion_axe");
    expect(shipCommandMembershipIds).not.toContain("two_handed_edged");
    expect(shipCommandMembershipIds).not.toContain("two_handed_concussion_axe");
    expect(shipCommandMembershipIds).not.toContain("polearms");
    expect(shipCommandMembershipIds).not.toContain("lance");

    expect(shipsOfficerGroupIds).toEqual(
      expect.arrayContaining(["maritime_crew_training", "maritime_navigation", "ship_command"])
    );
    expect(shipsOfficerGroupIds).not.toContain("veteran_leadership");
    expect(new Set(shipsOfficerGroupIds).size).toBe(shipsOfficerGroupIds.length);
    expect(skillReachFor("ships_officer")).toBeGreaterThan(10);
    expect(directOnlySkillIdsFor("ships_officer")).toEqual(
      expect.arrayContaining(["language", "trading"])
    );
    expect(directOnlySkillIdsFor("ships_officer")).not.toContain("captaincy");
    expect(directOnlySkillIdsFor("ships_officer")).not.toContain("navigation");
    expect(directOnlySkillIdsFor("ships_officer")).not.toContain("perception");

    for (const ordinarySailorId of ["sailor", "deck_sailor", "fisher"]) {
      expect(groupIdsFor(ordinarySailorId)).not.toContain("ship_command");
    }

    const watchMembershipIds =
      groupById.get("watch_civic_guard")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];
    const routeMembershipIds =
      groupById.get("route_security")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];
    const arenaMembershipIds =
      groupById.get("arena_training")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];

    expect(watchMembershipIds).not.toContain("parry");
    expect(routeMembershipIds).not.toContain("captaincy");
    expect(routeMembershipIds).not.toContain("tactics");
    expect(routeMembershipIds).not.toContain("veteran_leadership");
    expect(arenaMembershipIds).not.toContain("dodge");
    expect(arenaMembershipIds).not.toContain("brawling");
    expect(arenaMembershipIds).not.toContain("parry");
    expect(arenaMembershipIds).not.toContain("captaincy");
    expect(arenaMembershipIds).not.toContain("tactics");
    expect(arenaMembershipIds).not.toContain("veteran_leadership");
    expect(arenaMembershipIds).not.toContain("formation_fighting");
  });

});
