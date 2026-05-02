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

  it("retires duplicate generated performer variants while preserving canonical performers", () => {
    const retiredPerformerIds = [
      "entertainers_dancer_acrobat",
      "entertainers_singer_musician",
      "entertainers_trickster_fool"
    ];
    const canonicalPerformerIds = [
      "actor",
      "dancer_acrobat",
      "entertainer",
      "folk_performer",
      "mourner",
      "musician"
    ];
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
    const categoryBySkillId = new Map(
      defaultCanonicalContent.skills.map((skill) => [skill.id, skill.categoryId])
    );

    for (const retiredProfessionId of retiredPerformerIds) {
      expect(
        defaultCanonicalContent.professions.some(
          (profession) => profession.id === retiredProfessionId
        )
      ).toBe(false);
      expect(allowedRowsFor(retiredProfessionId)).toEqual([]);
      expect(
        defaultCanonicalContent.professionSkills.some(
          (grant) => grant.professionId === retiredProfessionId
        )
      ).toBe(false);
    }

    for (const professionId of canonicalPerformerIds) {
      expect(
        defaultCanonicalContent.professions.some((profession) => profession.id === professionId)
      ).toBe(true);
      expect(allowedRowsFor(professionId).length).toBeGreaterThan(0);
    }

    expect(canonicalSocietyLevelsFor("entertainer")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("entertainer")).toEqual([1, 2, 3, 4]);
    expect(canonicalSocietyLevelsFor("folk_performer")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("folk_performer")).toEqual([1, 2, 3, 4]);
    expect(canonicalSocietyLevelsFor("dancer_acrobat")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(classBandsFor("dancer_acrobat")).toEqual([1, 2, 3, 4]);
    expect(canonicalSocietyLevelsFor("musician")).toEqual([2, 3, 4, 5, 6]);
    expect(classBandsFor("musician")).toEqual([2, 3, 4]);
    expect(canonicalSocietyLevelsFor("actor")).toEqual([3, 4, 5, 6]);
    expect(classBandsFor("actor")).toEqual([3, 4]);
    expect(canonicalSocietyLevelsFor("mourner")).toEqual([2, 3, 4, 5, 6]);
    expect(classBandsFor("mourner")).toEqual([2, 3, 4]);
    expect(categoryBySkillId.get("singing")).toBe("performance");
    expect(categoryBySkillId.get("music")).toBe("performance");
    expect(categoryBySkillId.get("dancing")).toBe("performance");
    expect(categoryBySkillId.get("acting")).toBe("performance");
    expect(categoryBySkillId.get("storytelling")).toBe("performance");
    expect(defaultCanonicalContent.skills.some((skill) => skill.id === "specific_language")).toBe(
      false
    );
  });

  it("distinguishes Companion from elite Courtesan without duplicating high-society slots", () => {
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
    const skillReachFor = (professionId: string) => {
      const groupIds = groupIdsFor(professionId);
      const skillIdsFromGroups = defaultCanonicalContent.skills
        .filter((skill) =>
          (skill.groupIds ?? [skill.groupId]).some((groupId) => groupIds.includes(groupId))
        )
        .map((skill) => skill.id);

      return new Set([...skillIdsFromGroups, ...directSkillIdsFor(professionId)]).size;
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
    const categoryBySkillId = new Map(
      defaultCanonicalContent.skills.map((skill) => [skill.id, skill.categoryId])
    );

    expect(
      defaultCanonicalContent.professionFamilies.some((family) => family.id === "social_companion")
    ).toBe(true);
    expect(professionById.get("courtesan")).toMatchObject({
      familyId: "courtier_diplomat",
      id: "courtesan",
      name: "Courtesan"
    });
    expect(professionById.get("prostitute_courtesan")).toMatchObject({
      familyId: "social_companion",
      id: "prostitute_courtesan",
      name: "Companion"
    });

    expect(canonicalSocietyLevelsFor("courtesan")).toEqual([4, 5, 6]);
    expect(classBandsFor("courtesan")).toEqual([4]);
    expect(groupIdsFor("courtesan")).toEqual(
      expect.arrayContaining(["courtly_formation", "political_acumen"])
    );

    expect(canonicalSocietyLevelsFor("prostitute_courtesan")).toEqual([2, 3, 4, 5]);
    expect(classBandsFor("prostitute_courtesan")).toEqual([2, 3]);
    expect(groupIdsFor("prostitute_courtesan")).toEqual(
      expect.arrayContaining(["social_reading", "performance_basics", "formal_performance"])
    );
    expect(groupIdsFor("prostitute_courtesan")).not.toContain("courtly_formation");
    expect(groupIdsFor("prostitute_courtesan")).not.toContain("political_acumen");
    expect(directSkillIdsFor("prostitute_courtesan")).toEqual(["seduction", "bargaining"]);
    expect(skillReachFor("prostitute_courtesan")).toBeGreaterThanOrEqual(10);

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      const canonicalSocietyLevel = canonicalSocietyLevelById.get(societyLevel.societyId);

      if (canonicalSocietyLevel && canonicalSocietyLevel >= 4 && societyLevel.societyLevel === 4) {
        expect(
          societyLevel.professionIds.includes("courtesan") &&
            societyLevel.professionIds.includes("prostitute_courtesan")
        ).toBe(false);
      }
    }

    expect(categoryBySkillId.get("seduction")).toBe("social");
    expect(categoryBySkillId.get("social_perception")).toBe("social");
    expect(categoryBySkillId.get("acting")).toBe("performance");
    expect(categoryBySkillId.get("etiquette")).toBe("high-society");
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
        "first_aid",
        "weapon_maintenance",
        "perception"
      ])
    );
    expect(membershipsFor("veteran_soldiering").filter((skillId) =>
      ["dodge", "parry", "brawling"].includes(skillId)
    )).toEqual([]);
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

  it("normalizes retired active skill group definitions before validating legacy snapshots", () => {
    const legacyContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === "dodge"
          ? {
              ...skill,
              groupIds: [
                ...new Set([
                  ...skill.groupIds,
                  "defensive_soldiering",
                  "veteran_soldiering"
                ])
              ]
            }
          : skill.id === "parry"
            ? {
                ...skill,
                groupIds: [...new Set([...skill.groupIds, "defensive_soldiering"])]
              }
            : skill.id === "self_control"
              ? {
                  ...skill,
                  groupIds: [...new Set([...skill.groupIds, "defensive_soldiering"])]
                }
            : skill.id === "combat_experience"
              ? {
                  ...skill,
                  groupIds: skill.groupIds.filter((groupId) => groupId !== "defensive_soldiering")
                }
            : skill
      ),
      skillGroups: [
        ...defaultCanonicalContent.skillGroups.map((group) =>
          group.id === "defensive_soldiering"
            ? {
                ...group,
                skillMemberships: [
                  ...(group.skillMemberships
                    ?.filter((membership) => membership.skillId !== "combat_experience") ?? []),
                  { skillId: "self_control", relevance: "optional" as const },
                  { skillId: "dodge", relevance: "optional" as const },
                  { skillId: "parry", relevance: "optional" as const }
                ]
              }
            : group.id === "veteran_soldiering"
            ? {
                ...group,
                skillMemberships: [
                  ...(group.skillMemberships?.map((membership) =>
                    membership.skillId === "battlefield_awareness"
                      ? {
                          ...membership,
                          relevance: "optional" as const
                        }
                      : membership
                  ) ?? []),
                  { skillId: "dodge", relevance: "optional" as const }
                ]
              }
            : group.id === "veteran_leadership"
              ? {
                  ...group,
                  skillMemberships: group.skillMemberships?.map((membership) =>
                    membership.skillId === "captaincy" || membership.skillId === "tactics"
                      ? {
                          ...membership,
                          relevance: "optional" as const
                        }
                      : membership
                  )
                }
              : group
        ),
        {
          id: "trap_and_intrusion_work",
          name: "Trap and Intrusion Work",
          skillMemberships: [
            { skillId: "search", relevance: "optional" as const },
            { skillId: "trap_handling", relevance: "optional" as const },
            { skillId: "lockpicking", relevance: "optional" as const }
          ],
          sortOrder: 1000
        },
        {
          id: "field_soldiering",
          name: "Field Soldiering",
          skillMemberships: [
            { skillId: "dodge", relevance: "optional" as const },
            { skillId: "perception", relevance: "optional" as const },
            { skillId: "battlefield_awareness", relevance: "optional" as const }
          ],
          sortOrder: 1001
        },
        {
          id: "officer_training",
          name: "Officer Training",
          skillMemberships: [
            { skillId: "tactics", relevance: "optional" as const },
            { skillId: "captaincy", relevance: "optional" as const },
            { skillId: "perception", relevance: "optional" as const }
          ],
          sortOrder: 1002
        }
      ]
    };

    const normalizedContent = validateCanonicalContent(legacyContent);
    const groupById = new Map(normalizedContent.skillGroups.map((group) => [group.id, group]));
    const membershipBySkillIdFor = (groupId: string) =>
      new Map(
        groupById
          .get(groupId)
          ?.skillMemberships?.map((membership) => [membership.skillId, membership]) ?? []
      );

    expect(groupById.has("field_soldiering")).toBe(false);
    expect(groupById.has("officer_training")).toBe(false);
    expect(groupById.has("trap_and_intrusion_work")).toBe(false);
    expect(groupById.get("veteran_soldiering")).toMatchObject({
      id: "veteran_soldiering",
      name: "Veteran Soldiering"
    });
    expect(groupById.get("veteran_leadership")).toMatchObject({
      id: "veteran_leadership",
      name: "Veteran Leadership"
    });
    expect(groupById.get("covert_entry")).toMatchObject({
      id: "covert_entry",
      name: "Covert Entry"
    });
    expect([...membershipBySkillIdFor("defensive_soldiering").keys()]).toEqual([
      "formation_fighting",
      "battlefield_awareness",
      "perception",
      "combat_experience",
      "first_aid"
    ]);
    expect([...membershipBySkillIdFor("defensive_soldiering").keys()].filter((skillId) =>
      ["dodge", "parry", "brawling"].includes(skillId)
    )).toEqual([]);
    expect(membershipBySkillIdFor("veteran_soldiering").get("battlefield_awareness")).toMatchObject({
      relevance: "core"
    });
    expect([...membershipBySkillIdFor("veteran_soldiering").keys()]).toEqual([
      "combat_experience",
      "battlefield_awareness",
      "perception",
      "first_aid",
      "weapon_maintenance"
    ]);
    expect([...membershipBySkillIdFor("veteran_soldiering").keys()].filter((skillId) =>
      ["dodge", "parry", "brawling"].includes(skillId)
    )).toEqual([]);
    expect(membershipBySkillIdFor("veteran_leadership").get("captaincy")).toMatchObject({
      relevance: "core"
    });
    expect(membershipBySkillIdFor("veteran_leadership").get("tactics")).toMatchObject({
      relevance: "core"
    });
    expect([...membershipBySkillIdFor("covert_entry").keys()]).toEqual(
      expect.arrayContaining(["search", "trap_handling", "lockpicking"])
    );
    expect(normalizedContent.skills.find((skill) => skill.id === "dodge")?.groupIds).not.toEqual(
      expect.arrayContaining(["defensive_soldiering", "veteran_soldiering"])
    );
    expect(normalizedContent.skills.find((skill) => skill.id === "parry")?.groupIds).not.toEqual(
      expect.arrayContaining(["defensive_soldiering"])
    );
    expect(normalizedContent.skills.find((skill) => skill.id === "self_control")?.groupIds).not.toEqual(
      expect.arrayContaining(["defensive_soldiering"])
    );
    expect(normalizedContent.skills.find((skill) => skill.id === "combat_experience")?.groupIds).toEqual(
      expect.arrayContaining(["defensive_soldiering"])
    );
  });

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
      "longbow",
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
    expect(groupSelectionCandidateIdsFor("basic_missile_training")).toEqual(
      expect.arrayContaining(["throwing", "bow", "longbow", "crossbow"])
    );
    expect(groupSkillIdsFor("basic_missile_training")).toEqual(
      expect.arrayContaining(["perception", "concentration", "weapon_maintenance"])
    );
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
    expect(groupSelectionCandidateIdsFor("advanced_missile_training")).toEqual(
      expect.arrayContaining(["throwing", "bow", "longbow", "crossbow"])
    );
    expect(groupSkillIdsFor("advanced_missile_training")).toEqual(
      expect.arrayContaining([
        "perception",
        "concentration",
        "weapon_maintenance",
        "battlefield_awareness",
        "combat_experience"
      ])
    );
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
