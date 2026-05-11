import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";

describe("validateCanonicalContent", () => {
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
    expect(skillReachFor("veteran_sergeant")).toBeLessThanOrEqual(23);

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
    expect(skillReachFor("city_watch_officer")).toBeLessThanOrEqual(24);
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
    expect(skillReachFor("imperial_officer")).toBeLessThanOrEqual(30);

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
    expect(skillReachFor("cavalry")).toBeLessThanOrEqual(19);

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

  it("separates bodyguard, champion, and elite guard officer packages", () => {
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
    const expectNoDirectCommandEducation = (professionId: string) => {
      expect(directSkillIdsFor(professionId)).not.toContain("captaincy");
      expect(directSkillIdsFor(professionId)).not.toContain("tactics");
    };

    expect(professionById.get("bodyguard")).toMatchObject({
      familyId: "military_security",
      name: "Bodyguard"
    });
    expect(groupIdsFor("bodyguard")).toEqual(
      expect.arrayContaining([
        "advanced_melee_training",
        "watch_civic_guard",
        "defensive_soldiering",
        "courtly_formation"
      ])
    );
    expect(groupIdsFor("bodyguard")).not.toContain("veteran_leadership");
    expect(groupIdsFor("bodyguard")).not.toContain("veteran_soldiering");
    expect(directSkillIdsFor("bodyguard")).toEqual([]);
    expect(skillReachFor("bodyguard")).toBeGreaterThanOrEqual(14);
    expect(skillReachFor("bodyguard")).toBeLessThanOrEqual(21);

    expect(professionById.get("champion")).toMatchObject({
      familyId: "military_security",
      name: "Champion"
    });
    expect(groupIdsFor("champion")).toEqual(
      expect.arrayContaining(["advanced_melee_training", "arena_training", "courtly_formation"])
    );
    expect(groupIdsFor("champion")).not.toContain("veteran_leadership");
    expect(groupIdsFor("champion")).not.toContain("veteran_soldiering");
    expect(directSkillIdsFor("champion")).toEqual([]);
    expect(directSkillIdsFor("champion")).not.toContain("brawling");
    expect(skillReachFor("champion")).toBeGreaterThanOrEqual(14);
    expect(skillReachFor("champion")).toBeLessThanOrEqual(18);

    expect(professionById.get("elite_guard_officer")).toMatchObject({
      familyId: "military_security",
      name: "Elite Guard Officer"
    });
    expect(canonicalSocietyLevelsFor("elite_guard_officer")).toEqual([5, 6]);
    expect(classBandsFor("elite_guard_officer")).toEqual([4]);
    expect(groupIdsFor("elite_guard_officer")).toEqual(
      expect.arrayContaining([
        "watch_civic_guard",
        "basic_melee_training",
        "defensive_soldiering",
        "courtly_formation",
        "veteran_soldiering",
        "veteran_leadership",
        "political_acumen"
      ])
    );
    expect(directSkillIdsFor("elite_guard_officer")).toEqual([]);
    expect(groupIdsFor("elite_guard_officer")).not.toEqual(groupIdsFor("military_officer"));
    expect(groupIdsFor("elite_guard_officer")).not.toEqual(groupIdsFor("city_watch_officer"));
    expect(skillReachFor("elite_guard_officer")).toBeGreaterThanOrEqual(18);
    expect(skillReachFor("elite_guard_officer")).toBeLessThanOrEqual(26);

    expect(canonicalSocietyLevelsFor("military_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("military_officer")).toEqual([4]);
    expect(canonicalSocietyLevelsFor("city_watch_officer")).toEqual([4, 5, 6]);
    expect(classBandsFor("city_watch_officer")).toEqual([3, 4]);
    expectNoDirectCommandEducation("bodyguard");
    expectNoDirectCommandEducation("champion");
    expect(groupIdsFor("cavalry")).not.toContain("veteran_leadership");
    expect(groupIdsFor("cavalry_mounted_retainer")).not.toContain("veteran_leadership");
    expect(groupIdsFor("cavalry_officer")).toEqual(
      expect.arrayContaining(["mounted_warrior_training", "veteran_leadership"])
    );
    expect(directSkillIdsFor("bounty_hunter")).not.toContain("captaincy");
    expect(groupIdsFor("bounty_hunter")).not.toContain("veteran_leadership");

    expect(
      groupById.get("watch_civic_guard")?.skillMemberships?.map((membership) => membership.skillId)
    ).not.toContain("parry");
    const arenaTrainingSkillIds =
      groupById.get("arena_training")?.skillMemberships?.map((membership) => membership.skillId) ??
      [];
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

});
