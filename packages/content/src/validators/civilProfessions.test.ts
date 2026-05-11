import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";

describe("validateCanonicalContent", () => {
  it("cleans criminal availability and distinguishes burglar and smuggler packages", () => {
    const canonicalSocietyLevelById = new Map(
      defaultCanonicalContent.societies.map((society) => [society.id, society.societyLevel])
    );
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
    const groupIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
          .map((grant) => grant.skillGroupId ?? "")
      )
    ];
    const directSkillIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType !== "group" && grant.skillId)
          .map((grant) => grant.skillId ?? "")
      )
    ];
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

    expect(canonicalSocietyLevelsFor("beggar")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("beggar")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("bandit")).toEqual([1, 2, 3, 4]);
    expect(classBandsFor("bandit")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("street_thug")).toEqual([1, 2, 3, 4, 5]);
    expect(classBandsFor("street_thug")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("pickpocket")).toEqual([2, 3, 4, 5]);
    expect(classBandsFor("pickpocket")).toEqual([2, 3]);

    for (const professionId of ["beggar", "bandit", "street_thug", "pickpocket"]) {
      expect(professionById.has(professionId)).toBe(true);
      expect(allowedRowsFor(professionId).length).toBeGreaterThan(0);
      expect(allowedRowsFor(professionId).some((row) => row.societyLevel === 4)).toBe(false);
    }

    expect(professionById.has("thief")).toBe(true);
    expect(professionById.has("burglar")).toBe(true);
    expect(groupIdsFor("thief")).toEqual(
      expect.arrayContaining(["street_theft", "covert_entry", "fieldcraft_stealth"])
    );
    expect(groupIdsFor("burglar")).toEqual(
      expect.arrayContaining(["street_theft", "covert_entry", "fieldcraft_stealth", "security"])
    );
    expect(groupIdsFor("burglar")).not.toEqual(groupIdsFor("thief"));
    expect(skillReachFor("burglar")).toBeGreaterThan(10);

    const smugglingGroup = groupById.get("smuggling_illicit_trade");
    const smugglingSkillIds =
      smugglingGroup?.skillMemberships?.map((membership) => membership.skillId) ?? [];

    expect(
      defaultCanonicalContent.professionFamilies.some((family) => family.id === "illicit_trader")
    ).toBe(true);
    expect(professionById.get("smuggler")).toMatchObject({
      familyId: "illicit_trader",
      name: "Smuggler"
    });
    expect(smugglingGroup).toMatchObject({
      id: "smuggling_illicit_trade",
      name: "Smuggling / Illicit Trade"
    });
    expect(smugglingSkillIds).toEqual(
      expect.arrayContaining([
        "conceal_object",
        "stealth",
        "trading",
        "bargaining",
        "teamstering",
        "sailing",
        "appraisal",
        "insight"
      ])
    );
    expect(smugglingSkillIds).not.toContain("captaincy");
    expect(smugglingSkillIds).not.toContain("tactics");
    expect(smugglingSkillIds).not.toContain("veteran_leadership");
    expect(smugglingSkillIds).not.toContain("brawling");
    expect(smugglingSkillIds).not.toContain("parry");
    expect(groupIdsFor("smuggler")).toEqual(
      expect.arrayContaining(["smuggling_illicit_trade", "covert_entry"])
    );
    expect(groupIdsFor("smuggler")).not.toContain("mercantile_practice");
    expect(groupIdsFor("smuggler")).not.toContain("commercial_administration");
    expect(directOnlySkillIdsFor("smuggler")).toEqual(["language"]);
    expect(skillReachFor("smuggler")).toBeGreaterThanOrEqual(12);
    expect(groupIdsFor("smuggler")).not.toContain("veteran_leadership");
    expect(directSkillIdsFor("smuggler")).not.toContain("captaincy");
    expect(directSkillIdsFor("smuggler")).not.toContain("tactics");

    expect(groupIdsFor("bounty_hunter")).not.toContain("veteran_leadership");
    expect(directSkillIdsFor("bounty_hunter")).not.toContain("captaincy");
    expect(directSkillIdsFor("bounty_hunter")).not.toContain("tactics");
    expect(professionById.get("prostitute_courtesan")).toMatchObject({
      familyId: "social_companion",
      name: "Companion"
    });
    expect(professionById.get("courtesan")).toMatchObject({
      familyId: "courtier_diplomat",
      name: "Courtesan"
    });
    expect(professionById.has("master_thief")).toBe(false);
    expect(professionById.has("court_spy")).toBe(false);
    expect(professionById.has("intelligence_agent")).toBe(false);
    expect(professionById.has("political_assassin")).toBe(false);

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("narrows merchant-family grants and improves craft and chariot packages", () => {
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
    const groupIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
          .map((grant) => grant.skillGroupId ?? "")
      )
    ];
    const directSkillIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType !== "group" && grant.skillId)
          .map((grant) => grant.skillId ?? "")
      )
    ];
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
    const packageSignatureFor = (professionId: string) =>
      JSON.stringify({
        directOnlySkillIds: directOnlySkillIdsFor(professionId).sort(),
        groupIds: groupIdsFor(professionId).sort()
      });
    const merchantFamilyGrantIds = defaultCanonicalContent.professionSkills
      .filter((grant) => grant.scope === "family" && grant.professionId === "merchant_trader")
      .map((grant) => grant.skillGroupId ?? grant.skillId);

    expect(merchantFamilyGrantIds).toEqual([]);
    expect(groupIdsFor("local_trader")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "commercial_administration",
        "social_reading"
      ])
    );
    expect(directOnlySkillIdsFor("local_trader")).toEqual(["language"]);
    expect(groupIdsFor("local_trader")).not.toContain("transport_and_caravan_work");
    expect(directSkillIdsFor("local_trader")).not.toContain("sailing");
    expect(directSkillIdsFor("local_trader")).not.toContain("banking");

    expect(groupIdsFor("peddler")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "transport_and_caravan_work",
        "mounted_service",
        "social_reading"
      ])
    );
    expect(directOnlySkillIdsFor("peddler")).toEqual(["language"]);
    expect(directSkillIdsFor("peddler")).not.toContain("sailing");
    expect(directSkillIdsFor("peddler")).not.toContain("banking");

    expect(groupIdsFor("merchant")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "commercial_administration",
        "transport_and_caravan_work"
      ])
    );
    expect(directOnlySkillIdsFor("merchant")).toEqual(["language", "banking", "insight"]);

    expect(groupIdsFor("inn_keeper")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "commercial_administration",
        "social_reading"
      ])
    );
    expect(directOnlySkillIdsFor("inn_keeper")).toEqual(["baking", "brewing"]);
    expect(directSkillIdsFor("inn_keeper")).not.toContain("sailing");
    expect(directSkillIdsFor("inn_keeper")).not.toContain("banking");

    expect(groupIdsFor("homemaker")).toEqual(
      expect.arrayContaining(["craft_group", "social_reading"])
    );
    expect(groupIdsFor("homemaker")).not.toContain("mercantile_practice");
    expect(groupIdsFor("homemaker")).not.toContain("commercial_administration");
    expect(directOnlySkillIdsFor("homemaker")).toEqual(["bargaining"]);

    expect(groupIdsFor("prostitute")).toEqual(
      expect.arrayContaining(["mercantile_practice", "social_reading", "performance_basics"])
    );
    expect(groupIdsFor("prostitute")).not.toContain("commercial_administration");
    expect(directOnlySkillIdsFor("prostitute")).toEqual(["seduction"]);
    expect(directSkillIdsFor("prostitute")).not.toContain("teamstering");
    expect(directSkillIdsFor("prostitute")).not.toContain("riding");
    expect(directSkillIdsFor("prostitute")).not.toContain("sailing");
    expect(directSkillIdsFor("prostitute")).not.toContain("banking");

    expect(groupIdsFor("fixer")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "commercial_administration",
        "political_acumen"
      ])
    );
    expect(directOnlySkillIdsFor("fixer")).toEqual(["language", "etiquette", "banking"]);
    expect(directSkillIdsFor("fixer")).not.toContain("teamstering");
    expect(directSkillIdsFor("fixer")).not.toContain("riding");
    expect(directSkillIdsFor("fixer")).not.toContain("sailing");

    expect(
      new Set(
        [
          "local_trader",
          "peddler",
          "merchant",
          "inn_keeper",
          "homemaker",
          "prostitute"
        ].map(packageSignatureFor)
      ).size
    ).toBe(6);

    expect(professionById.get("smuggler")).toMatchObject({
      familyId: "illicit_trader",
      name: "Smuggler"
    });
    expect(groupIdsFor("smuggler")).toEqual(
      expect.arrayContaining(["smuggling_illicit_trade", "covert_entry"])
    );
    expect(groupIdsFor("smuggler")).not.toContain("mercantile_practice");
    expect(groupIdsFor("smuggler")).not.toContain("commercial_administration");
    expect(directOnlySkillIdsFor("smuggler")).toEqual(["language"]);

    expect(professionById.get("crafter")).toMatchObject({ familyId: "craft_guild" });
    expect(professionById.get("master_craftsmen")).toMatchObject({ familyId: "craft_guild" });
    expect(professionById.get("builder_master_mason")).toMatchObject({
      familyId: "craft_guild"
    });
    expect(groupIdsFor("crafter")).toEqual(
      expect.arrayContaining(["technical_measurement", "craft_specialty"])
    );
    expect(groupIdsFor("master_craftsmen")).toEqual(
      expect.arrayContaining([
        "technical_measurement",
        "craft_specialty_advanced",
        "mercantile_practice",
        "commercial_administration"
      ])
    );
    expect(groupIdsFor("builder_master_mason")).toEqual(
      expect.arrayContaining([
        "technical_measurement",
        "construction_specialty",
        "commercial_administration",
        "civic_learning"
      ])
    );
    expect(groupIdsFor("crafter")).not.toContain("craft_group");
    expect(groupIdsFor("master_craftsmen")).not.toContain("craft_group");
    expect(groupIdsFor("builder_master_mason")).not.toContain("craft_group");
    expect(directSkillIdsFor("crafter")).toEqual([]);
    expect(directSkillIdsFor("master_craftsmen")).toEqual([]);
    expect(directSkillIdsFor("builder_master_mason")).toEqual([]);
    expect(skillReachFor("crafter")).toBeGreaterThanOrEqual(10);
    expect(skillReachFor("master_craftsmen")).toBeGreaterThan(skillReachFor("crafter"));
    expect(skillReachFor("builder_master_mason")).toBeGreaterThanOrEqual(12);

    const craftSpecialtySlot = groupById.get("craft_specialty")?.selectionSlots?.[0];
    const advancedCraftSpecialtySlot =
      groupById.get("craft_specialty_advanced")?.selectionSlots?.[0];
    const constructionSpecialtySlot =
      groupById.get("construction_specialty")?.selectionSlots?.[0];

    expect(groupById.get("craft_specialty")?.skillMemberships).toEqual([]);
    expect(groupById.get("craft_specialty_advanced")?.skillMemberships).toEqual([]);
    expect(groupById.get("construction_specialty")?.skillMemberships).toEqual([]);
    expect(craftSpecialtySlot).toMatchObject({
      chooseCount: 1,
      id: "craft_specialty_choice",
      required: true
    });
    expect(craftSpecialtySlot?.candidateSkillIds).toEqual(
      expect.arrayContaining(["smithing", "carpentry", "leatherworking", "weaving", "pottery"])
    );
    expect(advancedCraftSpecialtySlot).toMatchObject({
      chooseCount: 1,
      id: "advanced_craft_specialty_choices",
      required: true
    });
    expect(advancedCraftSpecialtySlot?.candidateSkillIds).toEqual(
      craftSpecialtySlot?.candidateSkillIds
    );
    expect(constructionSpecialtySlot).toMatchObject({
      chooseCount: 2,
      id: "construction_specialty_choices",
      required: true
    });
    expect(constructionSpecialtySlot?.candidateSkillIds).toEqual(
      expect.arrayContaining(["stoneworking", "carpentry", "smithing", "mechanics"])
    );
    expect(constructionSpecialtySlot?.candidateSkillIds).not.toContain("brewing");
    expect(constructionSpecialtySlot?.candidateSkillIds).not.toContain("weaving");

    expect(groupIdsFor("chariot_driver")).toEqual(
      expect.arrayContaining([
        "animal_husbandry",
        "mounted_service",
        "transport_and_caravan_work",
        "route_security"
      ])
    );
    expect(directOnlySkillIdsFor("chariot_driver")).toEqual(["bargaining", "throwing"]);
    expect(directSkillIdsFor("chariot_driver")).not.toContain("captaincy");
    expect(directSkillIdsFor("chariot_driver")).not.toContain("tactics");
    expect(directSkillIdsFor("chariot_driver")).not.toContain("veteran_leadership");
    expect(skillReachFor("chariot_driver")).toBeGreaterThanOrEqual(10);

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("adds elite commercial professions and constrains ordinary trade/labor elite availability", () => {
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
    const groupIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
          .map((grant) => grant.skillGroupId ?? "")
      )
    ];
    const directSkillIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType !== "group" && grant.skillId)
          .map((grant) => grant.skillId ?? "")
      )
    ];
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
    const packageSignatureFor = (professionId: string) =>
      JSON.stringify({
        directOnlySkillIds: directOnlySkillIdsFor(professionId).sort(),
        groupIds: groupIdsFor(professionId).sort()
      });

    expect(professionById.get("guild_master")).toMatchObject({
      familyId: "merchant_trader",
      name: "Guild Master"
    });
    expect(canonicalSocietyLevelsFor("guild_master")).toEqual([4, 5, 6]);
    expect(classBandsFor("guild_master")).toEqual([3, 4]);
    expect(groupIdsFor("guild_master")).toEqual(
      expect.arrayContaining([
        "craft_group",
        "mercantile_practice",
        "commercial_administration",
        "civic_learning",
        "political_acumen"
      ])
    );
    expect(skillReachFor("guild_master")).toBeGreaterThanOrEqual(16);
    expect(packageSignatureFor("guild_master")).not.toEqual(packageSignatureFor("master_craftsmen"));

    expect(professionById.get("merchant_factor")).toMatchObject({
      familyId: "merchant_trader",
      name: "Merchant Factor"
    });
    expect(canonicalSocietyLevelsFor("merchant_factor")).toEqual([4, 5, 6]);
    expect(classBandsFor("merchant_factor")).toEqual([3, 4]);
    expect(groupIdsFor("merchant_factor")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "commercial_administration",
        "operations",
        "civic_learning",
        "political_acumen",
        "social_reading"
      ])
    );
    expect(directOnlySkillIdsFor("merchant_factor")).toEqual(["language", "etiquette"]);
    expect(skillReachFor("merchant_factor")).toBeGreaterThanOrEqual(15);
    expect(packageSignatureFor("merchant_factor")).not.toEqual(packageSignatureFor("merchant"));
    expect(packageSignatureFor("merchant_factor")).not.toEqual(packageSignatureFor("fixer"));

    expect(professionById.get("banker_moneylender")).toMatchObject({
      familyId: "merchant_trader",
      name: "Banker / Moneylender"
    });
    expect(canonicalSocietyLevelsFor("banker_moneylender")).toEqual([4, 5, 6]);
    expect(classBandsFor("banker_moneylender")).toEqual([3, 4]);
    expect(groupIdsFor("banker_moneylender")).toEqual(
      expect.arrayContaining([
        "commercial_administration",
        "mercantile_practice",
        "operations",
        "civic_learning",
        "social_reading"
      ])
    );
    expect(directOnlySkillIdsFor("banker_moneylender")).toEqual([]);
    expect(skillReachFor("banker_moneylender")).toBeGreaterThanOrEqual(15);

    expect(professionById.get("great_merchant")).toMatchObject({
      familyId: "merchant_trader",
      name: "Great Merchant"
    });
    expect(canonicalSocietyLevelsFor("great_merchant")).toEqual([5, 6]);
    expect(classBandsFor("great_merchant")).toEqual([4]);
    expect(groupIdsFor("great_merchant")).toEqual(
      expect.arrayContaining([
        "mercantile_practice",
        "commercial_administration",
        "operations",
        "political_acumen",
        "courtly_formation",
        "civic_learning"
      ])
    );
    expect(directOnlySkillIdsFor("great_merchant")).toEqual(["language"]);
    expect(skillReachFor("great_merchant")).toBeGreaterThan(skillReachFor("merchant"));

    for (const professionId of ["farmer", "herder", "peddler", "local_trader", "merchant", "inn_keeper", "fisher", "docker"]) {
      expect(professionById.has(professionId)).toBe(true);
      expect(allowedRowsFor(professionId).length).toBeGreaterThan(0);
    }

    expect(canonicalSocietyLevelsFor("farmer")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("farmer")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("herdsman_subtype")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("herdsman_subtype")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("herder")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("herder")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("fisher")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("fisher")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("woodcutter")).toEqual([1, 2, 3, 4, 5]);
    expect(classBandsFor("woodcutter")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("peddler")).toEqual([1, 2, 3, 4, 5]);
    expect(classBandsFor("peddler")).toEqual([1, 2, 3]);
    expect(canonicalSocietyLevelsFor("local_trader")).toEqual([2, 3, 4, 5]);
    expect(classBandsFor("local_trader")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("inn_keeper")).toEqual([2, 3, 4, 5]);
    expect(classBandsFor("inn_keeper")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("docker")).toEqual([2, 3, 4, 5]);
    expect(classBandsFor("docker")).toEqual([2, 3]);
    expect(canonicalSocietyLevelsFor("merchant")).toEqual([2, 3, 4, 5, 6]);
    expect(classBandsFor("merchant")).toEqual([2, 3, 4]);
    expect(canonicalSocietyLevelsFor("master_craftsmen")).toEqual([3, 4, 5, 6]);
    expect(classBandsFor("master_craftsmen")).toEqual([3, 4]);
    expect(canonicalSocietyLevelsFor("builder_master_mason")).toEqual([3, 4, 5, 6]);
    expect(classBandsFor("builder_master_mason")).toEqual([3, 4]);

    for (const professionId of [
      "farmer",
      "herdsman_subtype",
      "herder",
      "fisher",
      "woodcutter",
      "peddler",
      "local_trader",
      "inn_keeper",
      "docker"
    ]) {
      expect(allowedRowsFor(professionId).some((row) => row.societyLevel === 4)).toBe(false);
    }
    expect(canonicalSocietyLevelsFor("woodcutter")).not.toContain(6);
    expect(canonicalSocietyLevelsFor("peddler")).not.toContain(6);
    expect(canonicalSocietyLevelsFor("local_trader")).not.toContain(6);
    expect(canonicalSocietyLevelsFor("inn_keeper")).not.toContain(6);
    expect(canonicalSocietyLevelsFor("docker")).not.toContain(6);

    expect(professionById.get("smuggler")).toMatchObject({
      familyId: "illicit_trader",
      name: "Smuggler"
    });
    expect(groupIdsFor("smuggler")).toEqual(
      expect.arrayContaining(["smuggling_illicit_trade", "covert_entry"])
    );
    expect(groupIdsFor("smuggler")).not.toContain("mercantile_practice");
    expect(directSkillIdsFor("chariot_driver")).not.toContain("captaincy");
    expect(groupIdsFor("master_craftsmen")).toEqual(
      expect.arrayContaining(["technical_measurement", "craft_specialty_advanced"])
    );
    expect(groupIdsFor("builder_master_mason")).toEqual(
      expect.arrayContaining(["technical_measurement", "construction_specialty"])
    );

    for (const ordinaryTradeProfessionId of [
      "guild_master",
      "merchant_factor",
      "banker_moneylender",
      "great_merchant",
      "local_trader",
      "peddler",
      "merchant",
      "inn_keeper",
      "homemaker",
      "prostitute",
      "fixer"
    ]) {
      expect(groupIdsFor(ordinaryTradeProfessionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(ordinaryTradeProfessionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(ordinaryTradeProfessionId)).not.toContain("tactics");
    }

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("improves rural, local, and resource profession packages without command leakage", () => {
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
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
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
          .map((grant) => grant.skillGroupId ?? "")
      )
    ];
    const directSkillIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType !== "group" && grant.skillId)
          .map((grant) => grant.skillId ?? "")
      )
    ];
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
    const groupSkillIdsFor = (groupId: string) =>
      groupById.get(groupId)?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const skillWeightFor = (skillId: string) =>
      defaultCanonicalContent.skills.find((skill) => skill.id === skillId)?.category === "secondary"
        ? 1
        : 2;
    const groupWeightedValueFor = (groupId: string) =>
      groupSkillIdsFor(groupId).reduce((total, skillId) => total + skillWeightFor(skillId), 0);
    const expectNoCommandOrCombatLeak = (professionId: string) => {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toEqual(
        expect.arrayContaining([
          "captaincy",
          "tactics",
          "veteran_leadership",
          "dodge",
          "parry",
          "brawling",
          "one_handed_edged",
          "one_handed_concussion_axe",
          "two_handed_edged",
          "two_handed_concussion_axe",
          "polearms",
          "lance",
          "throwing",
          "sling",
          "bow",
          "longbow",
          "crossbow"
        ])
      );
    };

    expect(groupSkillIdsFor("pastoral_work")).toEqual([
      "perception",
      "search",
      "animal_care",
      "herding",
      "riding",
      "first_aid"
    ]);
    expect(groupSkillIdsFor("farm_household_work")).toEqual([
      "animal_care",
      "herding",
      "baking",
      "brewing",
      "carpentry",
      "first_aid"
    ]);
    expect(groupSkillIdsFor("coastal_fishing")).toEqual([
      "perception",
      "search",
      "sailing",
      "ropework",
      "boat_handling",
      "swim",
      "first_aid"
    ]);
    expect(groupSkillIdsFor("forestry_resource_work")).toEqual([
      "perception",
      "search",
      "climb",
      "run",
      "carpentry",
      "first_aid"
    ]);
    expect(groupSkillIdsFor("forestry_resource_work")).not.toContain("self_control");
    expect(groupWeightedValueFor("forestry_resource_work")).toBeGreaterThanOrEqual(6);
    expect(groupSkillIdsFor("mining_extraction")).toEqual([
      "perception",
      "search",
      "climb",
      "run",
      "stoneworking",
      "mechanics",
      "first_aid"
    ]);
    expect(groupSkillIdsFor("mining_extraction")).not.toContain("self_control");
    expect(groupWeightedValueFor("mining_extraction")).toBeGreaterThanOrEqual(6);

    expect(professionById.get("herder")).toMatchObject({ familyId: "herdsman_rider" });
    expect(professionById.get("herdsman_subtype")).toMatchObject({
      familyId: "herdsman_rider",
      name: "Herdsman"
    });
    expect(groupIdsFor("herder")).toEqual(
      expect.arrayContaining(["animal_husbandry", "pastoral_work"])
    );
    expect(groupIdsFor("herdsman_subtype")).toEqual(
      expect.arrayContaining(["animal_handling", "pastoral_work"])
    );
    expect(groupIdsFor("herdsman_subtype")).not.toEqual(groupIdsFor("herder"));
    expect(skillReachFor("herder")).toBeGreaterThanOrEqual(10);
    expect(skillReachFor("herdsman_subtype")).toBeGreaterThan(skillReachFor("herder"));

    expect(professionById.get("messenger")).toMatchObject({
      familyId: "rural_local_service",
      name: "Messenger"
    });
    expect(groupIdsFor("messenger")).toEqual(
      expect.arrayContaining([
        "mounted_service",
        "transport_and_caravan_work",
        "route_security",
        "athletic_conditioning"
      ])
    );
    expect(directOnlySkillIdsFor("messenger")).toEqual(["language"]);
    expect(skillReachFor("messenger")).toBeGreaterThanOrEqual(10);

    expect(groupIdsFor("animal_trainer")).toEqual(
      expect.arrayContaining(["animal_husbandry", "animal_handling", "route_security"])
    );
    expect(skillReachFor("animal_trainer")).toBeGreaterThanOrEqual(10);

    expect(groupIdsFor("farmer")).toEqual(
      expect.arrayContaining(["animal_husbandry", "farm_household_work"])
    );
    expect(skillReachFor("farmer")).toBeGreaterThanOrEqual(10);

    expect(professionById.get("fisher")).toMatchObject({ familyId: "maritime_labor" });
    expect(groupIdsFor("fisher")).toEqual(
      expect.arrayContaining(["maritime_crew_training", "coastal_fishing"])
    );
    expect(groupIdsFor("fisher")).not.toContain("maritime_navigation");
    expect(skillReachFor("fisher")).toBeGreaterThanOrEqual(10);

    expect(professionById.get("woodcutter")).toMatchObject({ familyId: "resource_labor" });
    expect(groupIdsFor("woodcutter")).toEqual([
      "technical_measurement",
      "forestry_resource_work"
    ]);
    expect(directOnlySkillIdsFor("woodcutter")).toEqual([]);
    expect(skillReachFor("woodcutter")).toBeGreaterThanOrEqual(9);

    expect(professionById.get("miner")).toMatchObject({ familyId: "resource_labor" });
    expect(groupIdsFor("miner")).toEqual(["technical_measurement", "mining_extraction"]);
    expect(directOnlySkillIdsFor("miner")).toEqual([]);
    expect(skillReachFor("miner")).toBeGreaterThanOrEqual(10);

    for (const professionId of [
      "herder",
      "herdsman_subtype",
      "messenger",
      "animal_trainer",
      "farmer",
      "fisher",
      "woodcutter",
      "miner"
    ]) {
      expect(allowedRowsFor(professionId).length).toBeGreaterThan(0);
      expect(canonicalSocietyLevelsFor(professionId).length).toBeGreaterThan(0);
      expect(classBandsFor(professionId).some((classBand) => classBand <= 2)).toBe(true);
      expectNoCommandOrCombatLeak(professionId);
    }

    expect(groupIdsFor("smuggler")).toEqual(
      expect.arrayContaining(["smuggling_illicit_trade", "covert_entry"])
    );
    expect(directSkillIdsFor("chariot_driver")).not.toContain("captaincy");
    expect(groupIdsFor("guild_master")).toEqual(
      expect.arrayContaining(["mercantile_practice", "commercial_administration"])
    );

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
    }
  });

  it("improves scholar, bureaucratic, religion, and healing packages without broad constraints", () => {
    const professionById = new Map(
      defaultCanonicalContent.professions.map((profession) => [profession.id, profession])
    );
    const groupById = new Map(
      defaultCanonicalContent.skillGroups.map((group) => [group.id, group])
    );
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
    const grantsFor = (professionId: string) => {
      const profession = professionById.get(professionId);

      return defaultCanonicalContent.professionSkills.filter(
        (grant) =>
          (grant.scope === "family" && grant.professionId === profession?.familyId) ||
          (grant.scope === "profession" && grant.professionId === professionId)
      );
    };
    const groupIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
          .map((grant) => grant.skillGroupId ?? "")
      )
    ];
    const directSkillIdsFor = (professionId: string) => [
      ...new Set(
        grantsFor(professionId)
          .filter((grant) => grant.grantType !== "group" && grant.skillId)
          .map((grant) => grant.skillId ?? "")
      )
    ];
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
    const groupSkillIdsFor = (groupId: string) =>
      groupById.get(groupId)?.skillMemberships?.map((membership) => membership.skillId) ?? [];
    const expectNoCommandLeak = (professionId: string) => {
      expect(groupIdsFor(professionId)).not.toContain("veteran_leadership");
      expect(directSkillIdsFor(professionId)).not.toEqual(
        expect.arrayContaining(["captaincy", "tactics", "veteran_leadership"])
      );
    };

    expect(groupSkillIdsFor("scholarly_formation")).toEqual([
      "history",
      "philosophy",
      "rhetorical_composition",
      "memory"
    ]);
    expect(groupSkillIdsFor("scholarly_formation")).not.toEqual(
      expect.arrayContaining(["theology", "etiquette", "courtly_protocol"])
    );
    expect(groupSkillIdsFor("legal_practice")).toEqual([
      "law",
      "oratory",
      "bureaucratic_writing",
      "rhetorical_composition",
      "insight"
    ]);
    expect(groupSkillIdsFor("fiscal_administration")).toEqual([
      "administration",
      "bookkeeping",
      "law",
      "bargaining",
      "appraisal"
    ]);
    expect(groupSkillIdsFor("temple_service")).toEqual([
      "theology",
      "ritual_interpretation",
      "administration",
      "oratory",
      "etiquette"
    ]);
    expect(groupSkillIdsFor("mortuary_practice")).toEqual([
      "medicine",
      "pharmacy",
      "ritual_interpretation",
      "theology",
      "concentration"
    ]);

    expect(groupIdsFor("scribe")).toEqual(
      expect.arrayContaining([
        "literate_foundation",
        "civic_learning",
        "commercial_administration",
        "scholarly_formation"
      ])
    );
    expect(groupIdsFor("student")).toEqual(
      expect.arrayContaining(["literate_foundation", "scholarly_formation", "mental_discipline"])
    );
    expect(groupIdsFor("philosopher")).toEqual(
      expect.arrayContaining(["scholarly_formation", "mental_discipline", "social_reading"])
    );
    expect(groupIdsFor("scribe")).not.toEqual(groupIdsFor("student"));
    expect(groupIdsFor("student")).not.toEqual(groupIdsFor("philosopher"));
    expect(directOnlySkillIdsFor("scribe")).toEqual([]);
    expect(directOnlySkillIdsFor("student")).toEqual([]);
    expect(directOnlySkillIdsFor("philosopher")).toEqual([]);

    expect(groupIdsFor("lawyer")).toEqual(
      expect.arrayContaining(["legal_practice", "scholarly_formation", "courtly_formation"])
    );
    expect(groupIdsFor("tax_collector")).toEqual(
      expect.arrayContaining(["fiscal_administration", "commercial_administration"])
    );
    expect(groupIdsFor("court_scribe_clerk")).toEqual(
      expect.arrayContaining(["commercial_administration", "courtly_formation"])
    );
    expect(groupIdsFor("bureaucrat")).toEqual(
      expect.arrayContaining(["fiscal_administration", "legal_practice", "courtly_formation"])
    );
    expect(canonicalSocietyLevelsFor("lawyer")).toEqual([4, 5, 6]);
    expect(classBandsFor("lawyer")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("tax_collector")).toEqual([4, 5, 6]);
    expect(classBandsFor("tax_collector")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("court_scribe_clerk")).toEqual([4, 5, 6]);
    expect(classBandsFor("court_scribe_clerk")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("bureaucrat")).toEqual([4, 5, 6]);
    expect(classBandsFor("bureaucrat")).toEqual([4]);

    expect(groupIdsFor("temple_scribe")).toEqual(
      expect.arrayContaining(["sacred_learning", "temple_service", "scholarly_formation"])
    );
    expect(groupIdsFor("priest")).toEqual(
      expect.arrayContaining(["sacred_learning", "omen_and_ritual_practice", "temple_service"])
    );
    expect(groupIdsFor("embalmer")).toEqual(
      expect.arrayContaining(["mortuary_practice", "sacred_learning"])
    );
    expect(groupIdsFor("mourner")).toEqual(
      expect.arrayContaining(["performance_basics", "omen_and_ritual_practice", "temple_service"])
    );
    expect(groupIdsFor("mourner")).not.toContain("mortuary_practice");

    expect(groupIdsFor("folk_healer")).toEqual(
      expect.arrayContaining(["healing_practice", "herb_and_remedy_craft", "social_reading"])
    );
    expect(groupIdsFor("healer")).toEqual(
      expect.arrayContaining(["healing_practice", "herb_and_remedy_craft", "mental_discipline"])
    );
    expect(groupIdsFor("herbalist")).toEqual(
      expect.arrayContaining(["herb_and_remedy_craft", "mercantile_practice"])
    );
    expect(groupIdsFor("folk_healer")).not.toEqual(groupIdsFor("healer"));
    expect(groupIdsFor("healer")).not.toEqual(groupIdsFor("herbalist"));
    expect(canonicalSocietyLevelsFor("folk_healer")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("folk_healer")).toEqual([1, 2, 3, 4]);

    for (const professionId of [
      "scribe",
      "student",
      "philosopher",
      "temple_scribe",
      "court_scribe_clerk",
      "bureaucrat",
      "lawyer",
      "tax_collector",
      "folk_healer",
      "healer",
      "herbalist",
      "shaman",
      "soothsayer",
      "priest",
      "mourner",
      "embalmer"
    ]) {
      expect(skillReachFor(professionId)).toBeGreaterThanOrEqual(10);
      expectNoCommandLeak(professionId);
    }

    expect(groupIdsFor("herder")).toEqual(expect.arrayContaining(["pastoral_work"]));
    expect(groupIdsFor("guild_master")).toEqual(
      expect.arrayContaining(["mercantile_practice", "commercial_administration"])
    );
    expect(groupIdsFor("great_merchant")).toEqual(
      expect.arrayContaining(["mercantile_practice", "commercial_administration"])
    );

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      expect(new Set(societyLevel.professionIds).size).toBe(societyLevel.professionIds.length);
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

});
