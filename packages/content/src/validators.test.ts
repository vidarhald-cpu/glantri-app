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
