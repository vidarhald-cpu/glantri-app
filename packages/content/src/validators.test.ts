import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "./seeds/defaultContent";
import { validateCanonicalContent } from "./validators";

describe("validateCanonicalContent", () => {
  const firstSociety = defaultCanonicalContent.societyLevels[0];
  const firstSkill = defaultCanonicalContent.skills[0];
  const secondSkill = defaultCanonicalContent.skills[1];
  const firstSecondarySkill = defaultCanonicalContent.skills.find(
    (skill) => skill.category === "secondary"
  );

  it("accepts the default society band content", () => {
    const normalizedContent = validateCanonicalContent(defaultCanonicalContent);

    expect(normalizedContent.skillGroups).toEqual(defaultCanonicalContent.skillGroups);
    expect(normalizedContent.societyLevels).toEqual(defaultCanonicalContent.societyLevels);
    expect(normalizedContent.societyBandSkillAccess).toEqual(
      defaultCanonicalContent.societyBandSkillAccess
    );
    expect(normalizedContent.skills.map((skill) => skill.id)).toEqual(
      defaultCanonicalContent.skills.map((skill) => skill.id)
    );
  });

  it("includes the imported Glantri subset in the default content", () => {
    expect(defaultCanonicalContent.skills.some((skill) => skill.id === "literacy")).toBe(true);
    expect(defaultCanonicalContent.skills.some((skill) => skill.id === "history")).toBe(true);
    expect(
      defaultCanonicalContent.skills.some((skill) => skill.id === "one_handed_edged")
    ).toBe(true);
    expect(
      defaultCanonicalContent.specializations.some((specialization) => specialization.id === "fencing")
    ).toBe(true);
    expect(
      defaultCanonicalContent.skillGroups.some((group) => group.id === "literate_foundation")
    ).toBe(true);
    expect(
      defaultCanonicalContent.professionFamilies.some((family) => family.id === "scholar_scribe")
    ).toBe(true);
    expect(
      defaultCanonicalContent.professions.some((profession) => profession.id === "temple_scribe")
    ).toBe(true);
    expect(
      defaultCanonicalContent.professions.some((profession) => profession.id === "military_officer")
    ).toBe(true);
  });

  it("resolves the cleaned player-facing skill categories in default content", () => {
    const categoryBySkillId = new Map(
      defaultCanonicalContent.skills.map((skill) => [skill.id, skill.categoryId])
    );

    expect(categoryBySkillId.get("teamstering")).toBe("fieldcraft");
    expect(categoryBySkillId.get("seduction")).toBe("social");
    expect(categoryBySkillId.get("banking")).toBe("trade");
    expect(categoryBySkillId.get("gambling")).toBe("social");
    expect(categoryBySkillId.get("captaincy")).toBe("military");
    expect(categoryBySkillId.get("tactics")).toBe("military");
    expect(categoryBySkillId.get("insight")).toBe("social");
    expect(categoryBySkillId.get("courtly_protocol")).toBe("high-society");
    expect(categoryBySkillId.get("etiquette")).toBe("high-society");
    expect(categoryBySkillId.get("heraldry")).toBe("high-society");
    expect(categoryBySkillId.get("intrigue")).toBe("high-society");
    expect(categoryBySkillId.get("singing")).toBe("performance");
    expect(categoryBySkillId.get("music")).toBe("performance");
    expect(categoryBySkillId.get("dancing")).toBe("performance");
    expect(categoryBySkillId.get("acting")).toBe("performance");
    expect(categoryBySkillId.get("storytelling")).toBe("performance");
    expect(categoryBySkillId.get("social_perception")).toBe("social");
    expect([...categoryBySkillId.values()]).toContain("social");
    expect([...categoryBySkillId.values()]).not.toContain("court-social");
    expect([...categoryBySkillId.values()]).not.toContain("leadership");
    expect(defaultCanonicalContent.specializations.find(
      (specialization) => specialization.id === "etiquette_by_culture"
    )).toMatchObject({
      name: "Etiquette by Culture",
      skillId: "etiquette"
    });
    expect(defaultCanonicalContent.languages.map((language) => language.name)).toEqual(
      expect.arrayContaining(["Common", "Old Common"])
    );
    expect(defaultCanonicalContent.skills.some((skill) => skill.id === "specific_language")).toBe(
      false
    );
  });

  it("merges retired skill groups into canonical target groups", () => {
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
    const membershipsFor = (groupId: string) =>
      groupById.get(groupId)?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const groupGrantKeys = defaultCanonicalContent.professionSkills
      .filter((grant) => grant.grantType === "group")
      .map((grant) => `${grant.professionId}:${grant.scope}:${grant.skillGroupId}`);

    expect(groupById.has("field_soldiering")).toBe(false);
    expect(groupById.has("officer_training")).toBe(false);
    expect(groupById.has("trap_and_intrusion_work")).toBe(false);
    expect(membershipsFor("veteran_soldiering")).toEqual(
      expect.arrayContaining([
        "battlefield_awareness",
        "combat_experience",
        "dodge",
        "perception"
      ])
    );
    expect(membershipsFor("veteran_leadership")).toEqual(
      expect.arrayContaining(["captaincy", "combat_experience", "perception", "tactics"])
    );
    expect(membershipsFor("covert_entry")).toEqual(
      expect.arrayContaining(["hide", "lockpicking", "search", "stealth", "trap_handling"])
    );
    expect(membershipsFor("mounted_warrior_training")).toEqual(
      expect.arrayContaining([
        "dodge",
        "lance",
        "mounted_combat",
        "one_handed_edged",
        "parry",
        "riding"
      ])
    );
    expect(groupGrantKeys.some((key) => key.endsWith(":field_soldiering"))).toBe(false);
    expect(groupGrantKeys.some((key) => key.endsWith(":officer_training"))).toBe(false);
    expect(groupGrantKeys.some((key) => key.endsWith(":trap_and_intrusion_work"))).toBe(false);
    expect(new Set(groupGrantKeys).size).toBe(groupGrantKeys.length);
  });

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
        .map((grant) => grant.skillId);
    const familySkillIdsFor = (professionFamilyId: string) =>
      defaultCanonicalContent.professionSkills
        .filter(
          (grant) =>
            grant.scope === "family" &&
            grant.professionId === professionFamilyId &&
            grant.skillId
        )
        .map((grant) => grant.skillId);

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

  it("restricts informal warrior availability to low-society low-class grids", () => {
    const canonicalSocietyLevelById = new Map(
      defaultCanonicalContent.societies.map((society) => [society.id, society.societyLevel])
    );
    const allowedRowsFor = (professionId: string) =>
      defaultCanonicalContent.societyLevels.filter((societyLevel) =>
        societyLevel.professionIds.includes(professionId)
      );
    const canonicalSocietyLevelsFor = (professionId: string) => [
      ...new Set(
        allowedRowsFor(professionId)
          .map((societyLevel) => canonicalSocietyLevelById.get(societyLevel.societyId))
          .filter((societyLevel): societyLevel is number => typeof societyLevel === "number")
      )
    ].sort((left, right) => left - right);
    const classBandsFor = (professionId: string) => [
      ...new Set(allowedRowsFor(professionId).map((societyLevel) => societyLevel.societyLevel))
    ].sort((left, right) => left - right);

    expect(canonicalSocietyLevelsFor("tribal_warrior")).toEqual([1, 2]);
    expect(classBandsFor("tribal_warrior")).toEqual([1, 2]);
    expect(canonicalSocietyLevelsFor("clan_warriors")).toEqual([1, 2]);
    expect(classBandsFor("clan_warriors")).toEqual([1, 2]);
    expect(
      allowedRowsFor("tribal_warrior").some(
        (societyLevel) => (canonicalSocietyLevelById.get(societyLevel.societyId) ?? 0) >= 3
      )
    ).toBe(false);
    expect(
      allowedRowsFor("clan_warriors").some(
        (societyLevel) => (canonicalSocietyLevelById.get(societyLevel.societyId) ?? 0) >= 3
      )
    ).toBe(false);
    expect(allowedRowsFor("tribal_warrior").some((societyLevel) => societyLevel.societyLevel >= 3))
      .toBe(false);
    expect(allowedRowsFor("clan_warriors").some((societyLevel) => societyLevel.societyLevel >= 3))
      .toBe(false);
    expect(canonicalSocietyLevelsFor("military_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("military_officer")).toEqual([4]);

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("adds low and mid military coverage with constrained availability and no command leakage", () => {
    const canonicalSocietyLevelById = new Map(
      defaultCanonicalContent.societies.map((society) => [society.id, society.societyLevel])
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
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);
      const directOnlySkillIds = directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );

      return new Set([...skillIdsFromGroups, ...directOnlySkillIds]).size;
    };
    const allowedRowsFor = (professionId: string) =>
      defaultCanonicalContent.societyLevels.filter((societyLevel) =>
        societyLevel.professionIds.includes(professionId)
      );
    const canonicalSocietyLevelsFor = (professionId: string) => [
      ...new Set(
        allowedRowsFor(professionId)
          .map((societyLevel) => canonicalSocietyLevelById.get(societyLevel.societyId))
          .filter((societyLevel): societyLevel is number => typeof societyLevel === "number")
      )
    ].sort((left, right) => left - right);
    const classBandsFor = (professionId: string) => [
      ...new Set(allowedRowsFor(professionId).map((societyLevel) => societyLevel.societyLevel))
    ].sort((left, right) => left - right);
    const expectNoCommandEducation = (professionId: string) => {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(professionId)).not.toContain("tactics");
    };

    expect(professionById.get("village_guard")).toMatchObject({
      familyId: "military_security",
      name: "Village Guard"
    });
    expect(groupIdsFor("village_guard")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "watch_civic_guard",
        "defensive_soldiering"
      ])
    );
    expect(directSkillIdsFor("village_guard")).toEqual([]);
    expect(canonicalSocietyLevelsFor("village_guard")).toEqual([1, 2]);
    expect(classBandsFor("village_guard")).toEqual([1, 2]);

    expect(professionById.get("militia_fighter")).toMatchObject({
      familyId: "military_security",
      name: "Militia Fighter"
    });
    expect(groupIdsFor("militia_fighter")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "basic_missile_training",
        "defensive_soldiering"
      ])
    );
    expect(directSkillIdsFor("militia_fighter")).toEqual([]);
    expect(canonicalSocietyLevelsFor("militia_fighter")).toEqual([1, 2, 3]);
    expect(classBandsFor("militia_fighter")).toEqual([1, 2, 3]);

    expect(professionById.get("garrison_soldier")).toMatchObject({
      familyId: "military_security",
      name: "Garrison Soldier"
    });
    expect(groupIdsFor("garrison_soldier")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "defensive_soldiering",
        "veteran_soldiering"
      ])
    );
    expect(directSkillIdsFor("garrison_soldier")).toEqual([]);
    expect(canonicalSocietyLevelsFor("garrison_soldier")).toEqual([3, 4, 5]);
    expect(classBandsFor("garrison_soldier")).toEqual([2, 3]);

    for (const professionId of ["village_guard", "militia_fighter", "garrison_soldier"]) {
      const groupIds = groupIdsFor(professionId);

      expectNoCommandEducation(professionId);
      expect(groupIds.length).toBeGreaterThanOrEqual(2);
      expect(new Set(groupIds).size).toBe(groupIds.length);
      expect(skillReachFor(professionId)).toBeGreaterThan(10);
    }

    expect(canonicalSocietyLevelsFor("watchman")).toEqual([3, 4, 5]);
    expect(classBandsFor("watchman")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("jailer")).toEqual([3, 4, 5]);
    expect(classBandsFor("jailer")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("levy_infantry")).toEqual([2, 3, 4]);
    expect(classBandsFor("levy_infantry")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("heavy_infantry")).toEqual([3, 4, 5]);
    expect(classBandsFor("heavy_infantry")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("military_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("military_officer")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("tribal_warrior")).toEqual([1, 2]);
    expect(classBandsFor("tribal_warrior")).toEqual([1, 2]);
    expect(canonicalSocietyLevelsFor("clan_warriors")).toEqual([1, 2]);
    expect(classBandsFor("clan_warriors")).toEqual([1, 2]);

    for (const professionId of [
      "watchman",
      "jailer",
      "levy_infantry",
      "heavy_infantry"
    ]) {
      expectNoCommandEducation(professionId);
    }

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("adds small-unit and civic command professions without cloning full military officer", () => {
    const canonicalSocietyLevelById = new Map(
      defaultCanonicalContent.societies.map((society) => [society.id, society.societyLevel])
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
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);
      const directOnlySkillIds = directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );

      return new Set([...skillIdsFromGroups, ...directOnlySkillIds]).size;
    };
    const allowedRowsFor = (professionId: string) =>
      defaultCanonicalContent.societyLevels.filter((societyLevel) =>
        societyLevel.professionIds.includes(professionId)
      );
    const canonicalSocietyLevelsFor = (professionId: string) => [
      ...new Set(
        allowedRowsFor(professionId)
          .map((societyLevel) => canonicalSocietyLevelById.get(societyLevel.societyId))
          .filter((societyLevel): societyLevel is number => typeof societyLevel === "number")
      )
    ].sort((left, right) => left - right);
    const classBandsFor = (professionId: string) => [
      ...new Set(allowedRowsFor(professionId).map((societyLevel) => societyLevel.societyLevel))
    ].sort((left, right) => left - right);

    expect(professionById.get("veteran_sergeant")).toMatchObject({
      familyId: "military_security",
      name: "Veteran Sergeant"
    });
    expect(canonicalSocietyLevelsFor("veteran_sergeant")).toEqual([3, 4, 5]);
    expect(classBandsFor("veteran_sergeant")).toEqual([3]);
    expect(classBandsFor("veteran_sergeant")).not.toContain(4);
    expect(groupIdsFor("veteran_sergeant")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "basic_missile_training",
        "defensive_soldiering",
        "veteran_soldiering",
        "veteran_leadership"
      ])
    );
    expect(directSkillIdsFor("veteran_sergeant")).toEqual([]);
    expect(skillReachFor("veteran_sergeant")).toBeGreaterThanOrEqual(16);
    expect(skillReachFor("veteran_sergeant")).toBeLessThanOrEqual(20);

    expect(professionById.get("city_watch_officer")).toMatchObject({
      familyId: "military_security",
      name: "City Watch Officer"
    });
    expect(canonicalSocietyLevelsFor("city_watch_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("city_watch_officer")).toEqual([3, 4]);
    expect(groupIdsFor("city_watch_officer")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "watch_civic_guard",
        "defensive_soldiering",
        "veteran_leadership",
        "civic_learning"
      ])
    );
    expect(directSkillIdsFor("city_watch_officer")).toEqual([]);
    expect(skillReachFor("city_watch_officer")).toBeGreaterThanOrEqual(16);
    expect(skillReachFor("city_watch_officer")).toBeLessThanOrEqual(22);
    expect(groupIdsFor("city_watch_officer")).not.toContain("veteran_soldiering");
    expect(groupIdsFor("city_watch_officer")).not.toEqual(groupIdsFor("military_officer"));

    expect(canonicalSocietyLevelsFor("military_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("military_officer")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("watchman")).toEqual([3, 4, 5]);
    expect(classBandsFor("watchman")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("jailer")).toEqual([3, 4, 5]);
    expect(classBandsFor("jailer")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("village_guard")).toEqual([1, 2]);
    expect(classBandsFor("village_guard")).toEqual([1, 2]);
    expect(canonicalSocietyLevelsFor("militia_fighter")).toEqual([1, 2, 3]);
    expect(classBandsFor("militia_fighter")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("garrison_soldier")).toEqual([3, 4, 5]);
    expect(classBandsFor("garrison_soldier")).toEqual([2, 3]);

    for (const professionId of [
      "village_guard",
      "militia_fighter",
      "garrison_soldier",
      "watchman",
      "jailer",
      "levy_infantry",
      "heavy_infantry"
    ]) {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(professionId)).not.toContain("tactics");
    }

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("adds formal high-society military and staff professions with distinct packages", () => {
    const canonicalSocietyLevelById = new Map(
      defaultCanonicalContent.societies.map((society) => [society.id, society.societyLevel])
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
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);
      const directOnlySkillIds = directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );

      return new Set([...skillIdsFromGroups, ...directOnlySkillIds]).size;
    };
    const allowedRowsFor = (professionId: string) =>
      defaultCanonicalContent.societyLevels.filter((societyLevel) =>
        societyLevel.professionIds.includes(professionId)
      );
    const canonicalSocietyLevelsFor = (professionId: string) => [
      ...new Set(
        allowedRowsFor(professionId)
          .map((societyLevel) => canonicalSocietyLevelById.get(societyLevel.societyId))
          .filter((societyLevel): societyLevel is number => typeof societyLevel === "number")
      )
    ].sort((left, right) => left - right);
    const classBandsFor = (professionId: string) => [
      ...new Set(allowedRowsFor(professionId).map((societyLevel) => societyLevel.societyLevel))
    ].sort((left, right) => left - right);

    expect(professionById.get("quartermaster")).toMatchObject({
      familyId: "military_security",
      name: "Quartermaster"
    });
    expect(canonicalSocietyLevelsFor("quartermaster")).toEqual([4, 5, 6]);
    expect(classBandsFor("quartermaster")).toEqual([3, 4]);
    expect(groupIdsFor("quartermaster")).toEqual(
      expect.arrayContaining([
        "civic_learning",
        "commercial_administration",
        "literate_foundation",
        "route_security",
        "defensive_soldiering"
      ])
    );
    expect(groupIdsFor("quartermaster")).not.toContain("basic_melee_training");
    expect(groupIdsFor("quartermaster")).not.toContain("veteran_leadership");
    expect(groupIdsFor("quartermaster")).not.toContain("veteran_soldiering");
    expect(directSkillIdsFor("quartermaster")).toEqual([]);
    expect(skillReachFor("quartermaster")).toBeGreaterThanOrEqual(16);
    expect(skillReachFor("quartermaster")).toBeLessThanOrEqual(22);

    expect(professionById.get("staff_officer")).toMatchObject({
      familyId: "military_security",
      name: "Staff Officer"
    });
    expect(canonicalSocietyLevelsFor("staff_officer")).toEqual([5, 6]);
    expect(classBandsFor("staff_officer")).toEqual([4]);
    expect(groupIdsFor("staff_officer")).toEqual(
      expect.arrayContaining([
        "veteran_leadership",
        "civic_learning",
        "literate_foundation",
        "veteran_soldiering",
        "courtly_formation",
        "commercial_administration",
        "political_acumen"
      ])
    );
    expect(groupIdsFor("staff_officer")).not.toContain("basic_melee_training");
    expect(directSkillIdsFor("staff_officer")).toEqual([]);
    expect(skillReachFor("staff_officer")).toBeGreaterThanOrEqual(18);
    expect(skillReachFor("staff_officer")).toBeLessThanOrEqual(24);
    expect(groupIdsFor("staff_officer")).not.toEqual(groupIdsFor("military_officer"));

    expect(professionById.get("imperial_officer")).toMatchObject({
      familyId: "military_security",
      name: "Imperial / Bureaucratic Officer"
    });
    expect(canonicalSocietyLevelsFor("imperial_officer")).toEqual([6]);
    expect(classBandsFor("imperial_officer")).toEqual([4]);
    expect(groupIdsFor("imperial_officer")).toEqual(
      expect.arrayContaining([
        "basic_melee_training",
        "defensive_soldiering",
        "veteran_soldiering",
        "veteran_leadership",
        "civic_learning",
        "literate_foundation",
        "courtly_formation",
        "political_acumen"
      ])
    );
    expect(directSkillIdsFor("imperial_officer")).toEqual([]);
    expect(skillReachFor("imperial_officer")).toBeGreaterThan(skillReachFor("military_officer"));
    expect(skillReachFor("imperial_officer")).toBeGreaterThanOrEqual(22);
    expect(skillReachFor("imperial_officer")).toBeLessThanOrEqual(28);

    expect(canonicalSocietyLevelsFor("military_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("military_officer")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("veteran_sergeant")).toEqual([3, 4, 5]);
    expect(classBandsFor("veteran_sergeant")).toEqual([3]);
    expect(canonicalSocietyLevelsFor("city_watch_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("city_watch_officer")).toEqual([3, 4]);

    for (const professionId of [
      "village_guard",
      "militia_fighter",
      "garrison_soldier",
      "watchman",
      "jailer",
      "levy_infantry",
      "heavy_infantry"
    ]) {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(professionId)).not.toContain("tactics");
    }

    expect(defaultCanonicalContent.skills.some((skill) => skill.id === "logistics")).toBe(false);
    expect(defaultCanonicalContent.skills.some((skill) => skill.id === "military_strategy"))
      .toBe(false);

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("separates mounted retainer, cavalry, and cavalry officer packages", () => {
    const canonicalSocietyLevelById = new Map(
      defaultCanonicalContent.societies.map((society) => [society.id, society.societyLevel])
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
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);
      const directOnlySkillIds = directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );

      return new Set([...skillIdsFromGroups, ...directOnlySkillIds]).size;
    };
    const allowedRowsFor = (professionId: string) =>
      defaultCanonicalContent.societyLevels.filter((societyLevel) =>
        societyLevel.professionIds.includes(professionId)
      );
    const canonicalSocietyLevelsFor = (professionId: string) => [
      ...new Set(
        allowedRowsFor(professionId)
          .map((societyLevel) => canonicalSocietyLevelById.get(societyLevel.societyId))
          .filter((societyLevel): societyLevel is number => typeof societyLevel === "number")
      )
    ].sort((left, right) => left - right);
    const classBandsFor = (professionId: string) => [
      ...new Set(allowedRowsFor(professionId).map((societyLevel) => societyLevel.societyLevel))
    ].sort((left, right) => left - right);
    const expectNoOfficerEducation = (professionId: string) => {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(professionId)).not.toContain("tactics");
    };

    expect(professionById.get("cavalry")).toMatchObject({
      familyId: "soldier",
      name: "Cavalry"
    });
    expect(canonicalSocietyLevelsFor("cavalry")).toEqual([3, 4, 5]);
    expect(classBandsFor("cavalry")).toEqual([2, 3]);
    expect(groupIdsFor("cavalry")).toEqual(
      expect.arrayContaining([
        "mounted_warrior_training",
        "veteran_soldiering",
        "basic_melee_training",
        "defensive_soldiering"
      ])
    );
    expectNoOfficerEducation("cavalry");
    expect(skillReachFor("cavalry")).toBeGreaterThanOrEqual(14);
    expect(skillReachFor("cavalry")).toBeLessThanOrEqual(18);

    expect(professionById.get("cavalry_mounted_retainer")).toMatchObject({
      familyId: "military_security",
      name: "Mounted Retainer"
    });
    expect(canonicalSocietyLevelsFor("cavalry_mounted_retainer")).toEqual([2, 3, 4]);
    expect(classBandsFor("cavalry_mounted_retainer")).toEqual([2, 3]);
    expect(groupIdsFor("cavalry_mounted_retainer")).toEqual(
      expect.arrayContaining([
        "mounted_warrior_training",
        "mounted_service",
        "courtly_formation",
        "route_security"
      ])
    );
    expect(groupIdsFor("cavalry_mounted_retainer")).not.toContain("veteran_soldiering");
    expect(groupIdsFor("cavalry_mounted_retainer")).not.toEqual(groupIdsFor("cavalry"));
    expectNoOfficerEducation("cavalry_mounted_retainer");
    expect(skillReachFor("cavalry_mounted_retainer")).toBeGreaterThanOrEqual(14);
    expect(skillReachFor("cavalry_mounted_retainer")).toBeLessThanOrEqual(18);

    expect(professionById.get("cavalry_officer")).toMatchObject({
      familyId: "military_security",
      name: "Cavalry Officer"
    });
    expect(canonicalSocietyLevelsFor("cavalry_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("cavalry_officer")).toEqual([3, 4]);
    expect(groupIdsFor("cavalry_officer")).toEqual(
      expect.arrayContaining([
        "mounted_warrior_training",
        "veteran_soldiering",
        "veteran_leadership",
        "defensive_soldiering",
        "civic_learning",
        "courtly_formation"
      ])
    );
    expect(directSkillIdsFor("cavalry_officer")).toEqual([]);
    expect(groupIdsFor("cavalry_officer")).not.toEqual(groupIdsFor("military_officer"));
    expect(skillReachFor("cavalry_officer")).toBeGreaterThanOrEqual(18);
    expect(skillReachFor("cavalry_officer")).toBeLessThanOrEqual(24);

    expect(canonicalSocietyLevelsFor("military_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("military_officer")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("veteran_sergeant")).toEqual([3, 4, 5]);
    expect(classBandsFor("veteran_sergeant")).toEqual([3]);

    for (const professionId of [
      "village_guard",
      "militia_fighter",
      "garrison_soldier",
      "watchman",
      "jailer",
      "levy_infantry",
      "heavy_infantry",
      "cavalry",
      "cavalry_mounted_retainer"
    ]) {
      expectNoOfficerEducation(professionId);
    }

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("keeps Bounty Hunter as pursuit security without command education", () => {
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
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
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);
      const directOnlySkillIds = directSkillIdsFor(professionId).filter(
        (skillId) => !skillIdsFromGroups.includes(skillId)
      );

      return new Set([...skillIdsFromGroups, ...directOnlySkillIds]).size;
    };
    const expectNoOfficerEducation = (professionId: string) => {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(professionId)).not.toContain("tactics");
    };

    expect(professionById.get("bounty_hunter")).toMatchObject({
      familyId: "thief_infiltrator",
      name: "Bounty Hunter"
    });
    expect(groupIdsFor("bounty_hunter")).toEqual(
      expect.arrayContaining([
        "street_theft",
        "covert_entry",
        "fieldcraft_stealth",
        "watch_civic_guard"
      ])
    );
    expect(new Set(groupIdsFor("bounty_hunter")).size).toBe(groupIdsFor("bounty_hunter").length);
    expect(directSkillIdsFor("bounty_hunter")).toEqual(
      expect.arrayContaining(["detect_lies", "search", "perception"])
    );
    expect(directSkillIdsFor("bounty_hunter")).not.toContain("one_handed_edged");
    expect(directSkillIdsFor("bounty_hunter")).not.toContain("brawling");
    expectNoOfficerEducation("bounty_hunter");
    expect(skillReachFor("bounty_hunter")).toBeGreaterThanOrEqual(10);

    expectNoOfficerEducation("cavalry");
    expectNoOfficerEducation("cavalry_mounted_retainer");
    expect(groupIdsFor("cavalry_officer")).toEqual(
      expect.arrayContaining(["mounted_warrior_training", "veteran_leadership"])
    );

    expect(
      groupById.get("watch_civic_guard")?.skillMemberships?.map((membership) => membership.skillId)
    ).not.toContain("parry");
    const routeSecuritySkillIds =
      groupById.get("route_security")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];
    const arenaTrainingSkillIds =
      groupById.get("arena_training")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];

    for (const forbiddenSkillId of ["captaincy", "tactics", "veteran_leadership"]) {
      expect(routeSecuritySkillIds).not.toContain(forbiddenSkillId);
    }
    for (const forbiddenSkillId of [
      "dodge",
      "brawling",
      "parry",
      "one_handed_edged",
      "captaincy",
      "tactics",
      "veteran_leadership",
      "formation_fighting"
    ]) {
      expect(arenaTrainingSkillIds).not.toContain(forbiddenSkillId);
    }

    for (const ordinarySailorId of ["sailor", "deck_sailor", "fisher"]) {
      expect(groupIdsFor(ordinarySailorId)).not.toContain("ship_command");
    }
  });

  it("includes the updated civilization language naming and Lankhmar seed entry", () => {
    expect(
      defaultCanonicalContent.civilizations.find((civilization) => civilization.id === "glantri")
    ).toMatchObject({
      motherTongueLanguageName: "Common",
      optionalLanguageNames: ["Old Common"],
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    });
    expect(
      defaultCanonicalContent.civilizations.find((civilization) => civilization.id === "iest")
    ).toMatchObject({
      motherTongueLanguageName: "Common",
      optionalLanguageNames: [],
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    });
    expect(
      defaultCanonicalContent.civilizations.find((civilization) => civilization.id === "scyria")
    ).toMatchObject({
      motherTongueLanguageName: "Old Common",
      optionalLanguageNames: [],
      spokenLanguageName: "Old Common",
      writtenLanguageName: "Old Common"
    });
    expect(
      defaultCanonicalContent.civilizations.find((civilization) => civilization.id === "thyatis")
    ).toMatchObject({
      motherTongueLanguageName: "Common",
      optionalLanguageNames: [],
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    });
    expect(
      defaultCanonicalContent.civilizations.find(
        (civilization) => civilization.id === "byzantine_empire"
      )
    ).toMatchObject({
      motherTongueLanguageName: "Old Common",
      optionalLanguageNames: [],
      spokenLanguageName: "Old Common",
      writtenLanguageName: "Old Common"
    });
    expect(
      defaultCanonicalContent.civilizations.find((civilization) => civilization.id === "lankhmar")
    ).toMatchObject({
      linkedSocietyId: "imperial_classical_high_civ",
      linkedSocietyLevel: 5,
      motherTongueLanguageName: "Phoenician",
      optionalLanguageNames: [],
      spokenLanguageName: "Phoenician",
      writtenLanguageName: "Phoenician"
    });
    expect(
      defaultCanonicalContent.languages.some((language) => language.name === "Common")
    ).toBe(true);
    expect(
      defaultCanonicalContent.languages.some((language) => language.name === "Old Common")
    ).toBe(true);
    expect(
      defaultCanonicalContent.languages.some((language) => language.name === "Phoenician")
    ).toBe(true);
    expect(
      defaultCanonicalContent.languages.some(
        (language) => language.name === "Bronze Age palace state"
      )
    ).toBe(false);
  });

  it("fails clearly on duplicate society band rows", () => {
    const duplicateBandContent = {
      ...defaultCanonicalContent,
      societyLevels: [
        ...defaultCanonicalContent.societyLevels,
        {
          ...defaultCanonicalContent.societyLevels[0]
        }
      ]
    };

    expect(() => validateCanonicalContent(duplicateBandContent)).toThrow(
      `Duplicate social band row for society "${firstSociety.societyName}" (${firstSociety.societyId}), band ${firstSociety.societyLevel}.`
    );
  });

  it("fails on invalid society-band skill access skill references", () => {
    const invalidContent = {
      ...defaultCanonicalContent,
      societyBandSkillAccess: defaultCanonicalContent.societyBandSkillAccess.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              skillId: "missing-skill"
            }
          : entry
      )
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Society-band skill access "${defaultCanonicalContent.societyBandSkillAccess[0]?.societyId}:L${defaultCanonicalContent.societyBandSkillAccess[0]?.socialBand}:missing-skill" references unknown skill "missing-skill".`
    );
  });

  it("fails on invalid society-band row references", () => {
    const targetEntry = defaultCanonicalContent.societyBandSkillAccess[0];
    const invalidContent = {
      ...defaultCanonicalContent,
      societyLevels: defaultCanonicalContent.societyLevels.filter(
        (row) =>
          !(
            row.societyId === targetEntry?.societyId &&
            row.societyLevel === targetEntry?.socialBand
          )
      )
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Society "${targetEntry?.societyName}" (${targetEntry?.societyId}) is missing social band(s): ${targetEntry?.socialBand}.`
    );
  });

  it("fails on duplicate society-band skill access rows", () => {
    const duplicateEntry = defaultCanonicalContent.societyBandSkillAccess[0];
    const invalidContent = {
      ...defaultCanonicalContent,
      societyBandSkillAccess: [
        ...defaultCanonicalContent.societyBandSkillAccess,
        duplicateEntry
      ]
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Duplicate society-band skill access row "${duplicateEntry?.societyId}:L${duplicateEntry?.socialBand}:${duplicateEntry?.skillId}".`
    );
  });

  it("fails clearly when a society is missing a universal band", () => {
    const missingBandContent = {
      ...defaultCanonicalContent,
      societyLevels: defaultCanonicalContent.societyLevels.filter(
        (societyLevel) =>
          !(
            societyLevel.societyId === firstSociety.societyId &&
            societyLevel.societyLevel === 4
          )
      )
    };

    expect(() => validateCanonicalContent(missingBandContent)).toThrow(
      `Society "${firstSociety.societyName}" (${firstSociety.societyId}) is missing social band(s): 4.`
    );
  });

  it("normalizes legacy label content to societyName", () => {
    const legacyLabelContent = {
      ...defaultCanonicalContent,
      societyLevels: defaultCanonicalContent.societyLevels.map((societyLevel) => ({
        ...societyLevel,
        label: societyLevel.societyName,
        societyName: undefined
      }))
    };

    const normalizedContent = validateCanonicalContent(legacyLabelContent);

    expect(
      normalizedContent.societyLevels.every((societyLevel, index) =>
        societyLevel.societyName === defaultCanonicalContent.societyLevels[index]?.societyName
      )
    ).toBe(true);
  });

  it("fails on self-dependent skills", () => {
    const invalidContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === firstSkill.id
          ? {
              ...skill,
              dependencySkillIds: [firstSkill.id]
            }
          : skill
      )
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Skill "${firstSkill.name}" (${firstSkill.id}) cannot depend on itself.`
    );
  });

  it("fails on circular skill dependency chains", () => {
    const invalidContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) => {
        if (skill.id === firstSkill.id) {
          return {
            ...skill,
            dependencySkillIds: [secondSkill.id]
          };
        }

        if (skill.id === secondSkill.id) {
          return {
            ...skill,
            dependencySkillIds: [firstSkill.id]
          };
        }

        return skill;
      })
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Circular skill dependency chain detected: ${firstSkill.id} -> ${secondSkill.id} -> ${firstSkill.id}.`
    );
  });

  it("fails on invalid skill group references", () => {
    const invalidContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === firstSkill.id
          ? {
              ...skill,
              groupId: "missing-group",
              groupIds: ["missing-group"]
            }
          : skill
      )
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Skill "${firstSkill.name}" (${firstSkill.id}) references unknown skill group "missing_group".`
    );
  });

  it("fails on invalid explicit skill categories", () => {
    const invalidContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === firstSkill.id
          ? {
              ...skill,
              categoryId: "not-a-real-category"
            }
          : skill
      )
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow();
  });

  it("normalizes Language to the explicit language player-facing category", () => {
    const normalizedContent = validateCanonicalContent({
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === "language"
          ? {
              ...skill,
              category: "secondary",
              categoryId: "knowledge"
            }
          : skill
      )
    });

    expect(normalizedContent.skills.find((skill) => skill.id === "language")).toMatchObject({
      category: "ordinary",
      categoryId: "language"
    });
  });

  it("fails on invalid skill-group selection slot references", () => {
    expect(() =>
      validateCanonicalContent({
        civilizations: [],
        languages: [],
        professionFamilies: [],
        professionSkills: [],
        professions: [],
        societies: [],
        societyLevels: [],
        skillGroups: [
          {
            id: "test_group",
            name: "Test group",
            selectionSlots: [
              {
                candidateSkillIds: ["missing-skill"],
                chooseCount: 1,
                id: "missing_choice",
                label: "Choose one missing skill",
                required: true
              }
            ],
            sortOrder: 1
          }
        ],
        skills: [],
        specializations: []
      })
    ).toThrow(
      `Skill group "Test group" (test_group) selection slot "missing_choice" references unknown skill "missing-skill".`
    );
  });

  it("fails on invalid secondary or specialization skill parents", () => {
    expect(firstSecondarySkill).toBeDefined();

    const invalidContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === firstSecondarySkill?.id
          ? {
              ...skill,
              secondaryOfSkillId: "missing-secondary-parent",
              specializationOfSkillId: "missing-specialization-parent"
            }
          : skill
      )
    };

    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Skill "${firstSecondarySkill?.name}" (${firstSecondarySkill?.id}) references unknown secondary-of skill "missing-secondary-parent".`
    );
    expect(() => validateCanonicalContent(invalidContent)).toThrow(
      `Skill "${firstSecondarySkill?.name}" (${firstSecondarySkill?.id}) references unknown specialization-of skill "missing-specialization-parent".`
    );
  });

  it("normalizes away legacy language specializations", () => {
    const normalizedContent = validateCanonicalContent({
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === "language"
          ? {
              ...skill,
              allowsSpecializations: true
            }
          : skill
      ),
      specializations: [
        ...defaultCanonicalContent.specializations,
        {
          id: "specific_language_specialization",
          skillId: "language",
          name: "Specific Language Specialization",
          minimumGroupLevel: 1,
          minimumParentLevel: 1,
          sortOrder: Number.MAX_SAFE_INTEGER
        }
      ]
    });

    expect(normalizedContent.skills.find((skill) => skill.id === "language")?.allowsSpecializations).toBe(
      false
    );
    expect(
      normalizedContent.specializations.some(
        (specialization) => specialization.skillId === "language"
      )
    ).toBe(false);
  });

  it("applies manual skill relationship metadata for explicit and melee-derived skills", () => {
    expect(defaultCanonicalContent.skills.find((skill) => skill.id === "medicine")?.derivedGrants).toEqual([
      {
        factor: 1,
        skillId: "first_aid"
      }
    ]);
    expect(
      defaultCanonicalContent.skills.find((skill) => skill.id === "one_handed_edged")
        ?.meleeCrossTraining
    ).toEqual({
      attackStyle: "slash",
      handClass: "one-handed"
    });
    expect(defaultCanonicalContent.skills.find((skill) => skill.id === "history")?.derivedGrants ?? []).toEqual([]);
  });
});
