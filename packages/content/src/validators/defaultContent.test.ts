import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "../seeds/defaultContent";
import { validateCanonicalContent } from "./index";

describe("validateCanonicalContent", () => {
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

  it("normalizes stale missile weapon slots before validating legacy Longbow candidates", () => {
    const legacyContent = {
      ...defaultCanonicalContent,
      skills: defaultCanonicalContent.skills.map((skill) =>
        skill.id === "longbow"
          ? {
              ...skill,
              groupIds: [
                ...new Set([
                  ...skill.groupIds,
                  "basic_missile_training",
                  "advanced_missile_training"
                ])
              ]
            }
          : skill
      ),
      skillGroups: defaultCanonicalContent.skillGroups.map((group) =>
        group.id === "basic_missile_training"
          ? {
              ...group,
              selectionSlots: group.selectionSlots?.map((slot) =>
                slot.id === "missile_weapon_choice"
                  ? {
                      ...slot,
                      candidateSkillIds: [
                        "throwing",
                        "sling",
                        "bow",
                        "longbow",
                        "crossbow"
                      ]
                    }
                  : slot
              )
            }
          : group.id === "advanced_missile_training"
            ? {
                ...group,
                selectionSlots: group.selectionSlots?.map((slot) =>
                  slot.id === "advanced_missile_weapon_choices"
                    ? {
                        ...slot,
                        candidateSkillIds: [
                          "throwing",
                          "sling",
                          "bow",
                          "longbow",
                          "crossbow"
                        ]
                      }
                    : slot
                )
              }
            : group
      )
    };

    const normalizedContent = validateCanonicalContent(legacyContent);
    const groupById = new Map(normalizedContent.skillGroups.map((group) => [group.id, group]));
    const slotCandidateIdsFor = (groupId: string, slotId: string) =>
      groupById.get(groupId)?.selectionSlots?.find((slot) => slot.id === slotId)
        ?.candidateSkillIds ?? [];
    const longbow = normalizedContent.skills.find((skill) => skill.id === "longbow");

    expect(slotCandidateIdsFor("basic_missile_training", "missile_weapon_choice")).toEqual([
      "throwing",
      "sling",
      "bow",
      "crossbow"
    ]);
    expect(
      slotCandidateIdsFor("advanced_missile_training", "advanced_missile_weapon_choices")
    ).toEqual(["throwing", "sling", "bow", "crossbow"]);
    expect(longbow).toMatchObject({
      specializationOfSkillId: "bow"
    });
    expect(longbow?.groupIds).not.toEqual(
      expect.arrayContaining(["basic_missile_training", "advanced_missile_training"])
    );
  });

});
