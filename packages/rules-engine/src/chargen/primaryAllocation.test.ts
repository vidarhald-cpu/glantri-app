import { describe, expect, it } from "vitest";

import { defaultCanonicalContent, validateCanonicalContent } from "@glantri/content";
import type { CharacterProgression } from "@glantri/domain";

import {
  allocateChargenPoint,
  buildChargenDraftView,
  createChargenProgression,
  finalizeChargenDraft,
  getPrimaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSpecialization,
  reviewChargenDraft,
  spendPrimaryPoint,
  spendSecondaryPoint
} from "./primaryAllocation";

const chargenTestContent = validateCanonicalContent({
  skillGroups: [
    {
      id: "scholarly",
      name: "Scholarly",
      sortOrder: 1
    }
  ],
  skills: [
    {
      id: "literacy",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Literacy",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 1,
      allowsSpecializations: false
    },
    {
      id: "archives",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Archives",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "required",
      sortOrder: 2,
      allowsSpecializations: false
    },
    {
      id: "lore",
      groupId: "scholarly",
      groupIds: ["scholarly"],
      name: "Lore",
      linkedStats: ["int"],
      dependencies: [],
      dependencySkillIds: [],
      category: "ordinary",
      requiresLiteracy: "no",
      sortOrder: 3,
      allowsSpecializations: false
    }
  ],
  specializations: [
    {
      id: "codes",
      skillId: "lore",
      name: "Codes",
      minimumGroupLevel: 1,
      minimumParentLevel: 1,
      sortOrder: 1
    }
  ],
  professionFamilies: [
    {
      id: "scholar",
      name: "Scholar"
    }
  ],
  professions: [
    {
      id: "scribe",
      familyId: "scholar",
      name: "Scribe",
      subtypeName: "Scribe"
    }
  ],
  professionSkills: [
    {
      professionId: "scholar",
      scope: "family",
      grantType: "group",
      skillGroupId: "scholarly",
      isCore: true
    }
  ],
  societyLevels: [
    {
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri",
      socialClass: "Common",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri",
      socialClass: "Guild",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri",
      socialClass: "Patrician",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    },
    {
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri",
      socialClass: "Noble",
      professionIds: ["scribe"],
      skillGroupIds: ["scholarly"]
    }
  ]
});

describe("derived skill relationships in chargen drafts", () => {
  it("previews relationship minimum grants by raising a lower skill up to the best minimum", () => {
    const derivedSkillContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "medicine_group",
          name: "Medicine",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          derivedGrants: [{ factor: 1, skillId: "first_aid" }],
          groupId: "medicine_group",
          groupIds: ["medicine_group"],
          id: "medicine",
          linkedStats: ["int"],
          name: "Medicine",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "medicine_group",
          groupIds: ["medicine_group"],
          id: "first_aid",
          linkedStats: ["int"],
          name: "First aid",
          requiresLiteracy: "no",
          sortOrder: 2
        }
      ],
      specializations: [],
      professionFamilies: [{ id: "scholar", name: "Scholar" }],
      professions: [{ id: "physician", familyId: "scholar", name: "Physician", subtypeName: "Physician" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "scholar",
          scope: "family",
          skillGroupId: "medicine_group"
        }
      ],
      societyLevels: [
        {
          professionIds: ["physician"],
          skillGroupIds: ["medicine_group"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: ["physician"],
          skillGroupIds: ["medicine_group"],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: ["physician"],
          skillGroupIds: ["medicine_group"],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: ["physician"],
          skillGroupIds: ["medicine_group"],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });
    const progression = createChargenProgression();
    progression.skills = [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "medicine_group",
        level: 10,
        primaryRanks: 10,
        ranks: 10,
        secondaryRanks: 0,
        skillId: "medicine"
      },
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "medicine_group",
        level: 3,
        primaryRanks: 3,
        ranks: 3,
        secondaryRanks: 0,
        skillId: "first_aid"
      }
    ];

    const draftView = buildChargenDraftView({
      content: derivedSkillContent,
      professionId: "physician",
      progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.find((skill) => skill.skillId === "medicine")).toMatchObject({
      effectiveSkillNumber: 10,
      relationshipGrantedSkillLevel: 0,
      specificSkillLevel: 10
    });
    expect(draftView.skills.find((skill) => skill.skillId === "first_aid")).toMatchObject({
      effectiveSkillNumber: 10,
      relationshipGrantedSkillLevel: 7,
      relationshipSourceSkillId: "medicine",
      specificSkillLevel: 3
    });
  });

  it("materializes specialization-bridge specializations from parent base XP without surfacing proxy skills as ordinary rows", () => {
    const bridgeContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "combat_group",
          name: "Combat",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "bow",
          linkedStats: ["dex"],
          name: "Bow",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "crossbow",
          linkedStats: ["dex"],
          name: "Crossbow",
          requiresLiteracy: "no",
          sortOrder: 2
        },
        {
          allowsSpecializations: false,
          category: "secondary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "longbow",
          linkedStats: ["dex"],
          name: "Longbow",
          requiresLiteracy: "no",
          sortOrder: 3,
          specializationOfSkillId: "bow"
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "one_handed_edged",
          linkedStats: ["dex"],
          name: "1-h edged",
          requiresLiteracy: "no",
          sortOrder: 4
        }
      ],
      specializations: [
        {
          id: "longbow",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Longbow",
          skillId: "bow",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "bow",
            reverseFactor: 1,
            threshold: 6
          }
        },
        {
          id: "fencing",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Fencing",
          skillId: "one_handed_edged",
          sortOrder: 2,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "one_handed_edged",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ],
      professionFamilies: [{ id: "soldier", name: "Soldier" }],
      professions: [{ id: "soldier", familyId: "soldier", name: "Soldier", subtypeName: "Soldier" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "soldier",
          scope: "family",
          skillGroupId: "combat_group"
        }
      ],
      societyLevels: [
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: ["soldier"],
          skillGroupIds: ["combat_group"],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });
    const progression = createChargenProgression();
    progression.skills = [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "combat_group",
        level: 10,
        primaryRanks: 10,
        ranks: 10,
        secondaryRanks: 0,
        skillId: "bow"
      },
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "combat_group",
        level: 10,
        primaryRanks: 10,
        ranks: 10,
        secondaryRanks: 0,
        skillId: "one_handed_edged"
      }
    ];

    const draftView = buildChargenDraftView({
      content: bridgeContent,
      professionId: "soldier",
      progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.find((skill) => skill.skillId === "longbow")).toBeUndefined();
    expect(
      draftView.specializations.find((specialization) => specialization.specializationId === "longbow")
    ).toMatchObject({
      relationshipGrantedSourceSkillId: "bow",
      relationshipGrantedSourceType: "specialization-bridge-parent",
      relationshipGrantedSpecializationLevel: 5,
      specializationLevel: 5
    });
    expect(draftView.specializations.find((specialization) => specialization.specializationId === "fencing")).toMatchObject({
      relationshipGrantedSourceSkillId: "one_handed_edged",
      relationshipGrantedSourceType: "specialization-bridge-parent",
      relationshipGrantedSpecializationLevel: 5,
      specializationLevel: 5
    });
    expect(draftView.secondaryPoolAvailable).toBe(0);
  });

  it("uses individual skill pricing rather than relationship grants when deriving ordinary skill purchase cost", () => {
    const progression = createChargenProgression();
    progression.skills = [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "scholarly",
        level: 8,
        primaryRanks: 0,
        ranks: 8,
        relationshipGrantedRanks: 8,
        secondaryRanks: 0,
        skillId: "lore"
      }
    ];

    expect(
      getPrimaryPurchaseCostForSkill(progression, chargenTestContent.skills.find((skill) => skill.id === "lore")!)
    ).toBe(2);
    expect(
      getSecondaryPurchaseCostForSkill(
        progression,
        chargenTestContent.skills.find((skill) => skill.id === "lore")!
      )
    ).toBe(2);

    const purchased = spendPrimaryPoint({
      content: chargenTestContent,
      professionId: "scribe",
      progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "lore",
      targetType: "skill"
    });

    expect(purchased.error).toBeUndefined();
    expect(purchased.spentCost).toBe(2);
    expect(
      getPrimaryPurchaseCostForSkill(
        purchased.progression,
        chargenTestContent.skills.find((skill) => skill.id === "lore")!
      )
    ).toBe(2);
  });

  it("keeps group purchase pricing separate from child skill pricing", () => {
    const progression = {
      ...createChargenProgression(),
      skillGroups: [
        {
          gms: 0,
          grantedRanks: 0,
          groupId: "scholarly",
          primaryRanks: 1,
          ranks: 1,
          secondaryRanks: 0
        }
      ]
    };
    const literacy = chargenTestContent.skills.find((skill) => skill.id === "literacy")!;

    expect(getPrimaryPurchaseCostForSkill(progression, literacy)).toBe(2);

    const groupPurchase = allocateChargenPoint({
      content: chargenTestContent,
      professionId: "scribe",
      progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "scholarly",
      targetType: "group"
    });
    const skillPurchase = allocateChargenPoint({
      content: chargenTestContent,
      professionId: "scribe",
      progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "literacy",
      targetType: "skill"
    });

    expect(groupPurchase.error).toBeUndefined();
    expect(groupPurchase.spentCost).toBe(3);
    expect(skillPurchase.error).toBeUndefined();
    expect(skillPurchase.spentCost).toBe(2);
  });

  it("prices canonical group purchases from active fixed and selected slot skills", () => {
    const rowFor = (professionId: string, groupId: string) => {
      const row = defaultCanonicalContent.societyLevels.find(
        (societyLevel) =>
          societyLevel.professionIds.includes(professionId) &&
          societyLevel.skillGroupIds.includes(groupId)
      );

      expect(row).toBeDefined();

      return row!;
    };
    const buyGroup = (input: {
      groupId: string;
      professionId: string;
      selectedGroupSlots?: CharacterProgression["chargenSelections"]["selectedGroupSlots"];
    }) => {
      const row = rowFor(input.professionId, input.groupId);
      const progression = {
        ...createChargenProgression(),
        chargenSelections: {
          selectedGroupSlots: input.selectedGroupSlots ?? [],
          selectedLanguageIds: [],
          selectedSkillIds: []
        }
      };

      return allocateChargenPoint({
        content: defaultCanonicalContent,
        professionId: input.professionId,
        progression,
        societyId: row.societyId,
        societyLevel: row.societyLevel,
        targetId: input.groupId,
        targetType: "group"
      });
    };

    expect(buyGroup({
      groupId: "mercantile_practice",
      professionId: "master_craftsmen"
    }).spentCost).toBe(3);
    expect(buyGroup({
      groupId: "technical_measurement",
      professionId: "master_craftsmen"
    }).spentCost).toBe(3);
    expect(buyGroup({
      groupId: "basic_melee_training",
      professionId: "light_infantry",
      selectedGroupSlots: [
        {
          groupId: "basic_melee_training",
          selectedSkillIds: ["polearms"],
          slotId: "melee_weapon_choice"
        }
      ]
    }).spentCost).toBe(2);
    expect(buyGroup({
      groupId: "basic_missile_training",
      professionId: "light_infantry",
      selectedGroupSlots: [
        {
          groupId: "basic_missile_training",
          selectedSkillIds: ["bow"],
          slotId: "missile_weapon_choice"
        }
      ]
    }).spentCost).toBe(3);
    expect(buyGroup({
      groupId: "craft_specialty_advanced",
      professionId: "master_craftsmen",
      selectedGroupSlots: [
        {
          groupId: "craft_specialty_advanced",
          selectedSkillIds: ["smithing"],
          slotId: "advanced_craft_specialty_choices"
        }
      ]
    }).spentCost).toBe(1);
  });

  it("treats Longbow as a Bow specialization rather than a missile weapon slot choice", () => {
    const lightInfantryRow = defaultCanonicalContent.societyLevels.find((societyLevel) =>
      societyLevel.professionIds.includes("light_infantry") &&
      societyLevel.skillGroupIds.includes("basic_missile_training")
    );
    const basicMissileTraining = defaultCanonicalContent.skillGroups.find(
      (group) => group.id === "basic_missile_training"
    );

    expect(lightInfantryRow).toBeDefined();
    expect(basicMissileTraining?.selectionSlots?.[0]?.candidateSkillIds).toEqual([
      "throwing",
      "sling",
      "bow",
      "crossbow"
    ]);
    expect(basicMissileTraining?.selectionSlots?.[0]?.candidateSkillIds).not.toContain("longbow");
    expect(defaultCanonicalContent.skills.find((skill) => skill.id === "longbow")).toMatchObject({
      specializationOfSkillId: "bow"
    });

    const progression = {
      ...createChargenProgression(),
      chargenSelections: {
        selectedGroupSlots: [
          {
            groupId: "basic_missile_training",
            selectedSkillIds: ["bow"],
            slotId: "missile_weapon_choice"
          }
        ],
        selectedLanguageIds: [],
        selectedSkillIds: []
      },
      skillGroups: [
        {
          gms: 0,
          grantedRanks: 0,
          groupId: "basic_missile_training",
          primaryRanks: 6,
          ranks: 6,
          secondaryRanks: 0
        }
      ]
    };
    const draftView = buildChargenDraftView({
      content: defaultCanonicalContent,
      professionId: "light_infantry",
      progression,
      societyId: lightInfantryRow!.societyId,
      societyLevel: lightInfantryRow!.societyLevel
    });

    expect(draftView.skills.find((skill) => skill.skillId === "bow")).toMatchObject({
      groupLevel: 6,
      groupId: "basic_missile_training",
      skillId: "bow"
    });
    expect(draftView.skills.find((skill) => skill.skillId === "longbow")).toBeUndefined();
    expect(
      draftView.specializations.find((specialization) => specialization.specializationId === "longbow")
    ).toMatchObject({
      relationshipGrantedSourceSkillId: "bow",
      relationshipGrantedSourceType: "specialization-bridge-parent"
    });
  });

  it("blocks required-slot group purchases until required choices are selected", () => {
    const row = defaultCanonicalContent.societyLevels.find(
      (societyLevel) =>
        societyLevel.professionIds.includes("master_craftsmen") &&
        societyLevel.skillGroupIds.includes("craft_specialty_advanced")
    );

    expect(row).toBeDefined();

    const purchase = allocateChargenPoint({
      content: defaultCanonicalContent,
      professionId: "master_craftsmen",
      progression: createChargenProgression(),
      societyId: row!.societyId,
      societyLevel: row!.societyLevel,
      targetId: "craft_specialty_advanced",
      targetType: "group"
    });

    expect(purchase.spentCost).toBeUndefined();
    expect(purchase.error).toBe("Advanced Craft Specialty: Choose one craft specialty.");
  });

  it("uses rule-set ordinary points and flexible-point factor in chargen pools", () => {
    const progression = createChargenProgression("standard", {
      exchangeCount: 2,
      flexiblePointFactor: 0.5,
      ordinarySkillPoints: 40,
      statRollCount: 20
    });
    const profile = {
      distractionLevel: 0,
      id: "profile-rule-set",
      label: "Rule Set Profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 20,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10
      },
      societyLevel: 0
    };

    const draftView = buildChargenDraftView({
      content: chargenTestContent,
      professionId: undefined,
      profile,
      progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(progression.primaryPoolTotal).toBe(40);
    expect(progression.flexiblePointFactor).toBe(0.5);
    expect(draftView.primaryPoolAvailable).toBe(40);
    expect(draftView.secondaryPoolAvailable).toBe(15);
  });

  it("uses individual skill pricing for other skills outside normal group access", () => {
    const otherSkillContent = validateCanonicalContent({
      ...chargenTestContent,
      skillGroups: [
        ...chargenTestContent.skillGroups,
        {
          id: "courtly",
          name: "Courtly",
          sortOrder: 2
        }
      ],
      skills: [
        ...chargenTestContent.skills,
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "courtly",
          groupIds: ["courtly"],
          id: "etiquette",
          linkedStats: ["cha"],
          name: "Etiquette",
          requiresLiteracy: "no",
          sortOrder: 4
        }
      ]
    });
    const progression = createChargenProgression();
    const ordinaryOtherSkill = otherSkillContent.skills.find((skill) => skill.id === "etiquette")!;

    expect(getSecondaryPurchaseCostForSkill(progression, ordinaryOtherSkill)).toBe(2);

    const purchase = allocateChargenPoint({
      content: otherSkillContent,
      professionId: "scribe",
      profile: {
        distractionLevel: 0,
        id: "profile-flexible",
        label: "Flexible",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        societyLevel: 0
      },
      progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "etiquette",
      targetType: "skill"
    });

    expect(purchase.error).toBeUndefined();
    expect(purchase.spentCost).toBe(2);
  });

  it("allows specialization-bridge purchases without the legacy society-level specialization block when the bridge parent gate is satisfied", () => {
    const bridgePurchaseContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "combat_group",
          name: "Combat",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: true,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "one_handed_edged",
          linkedStats: ["dex"],
          name: "1-h edged",
          requiresLiteracy: "no",
          sortOrder: 1
        }
      ],
      specializations: [
        {
          id: "fencing",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Fencing",
          skillId: "one_handed_edged",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "one_handed_edged",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ],
      professionFamilies: [],
      professions: [],
      professionSkills: [],
      societyLevels: [
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });
    const progression = createChargenProgression();
    progression.secondaryPoolTotal = 10;
    progression.skillGroups = [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "combat_group",
        primaryRanks: 8,
        ranks: 8,
        secondaryRanks: 0
      }
    ];
    progression.skills = [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "combat_group",
        level: 8,
        primaryRanks: 8,
        ranks: 8,
        secondaryRanks: 0,
        skillId: "one_handed_edged"
      }
    ];

    const result = spendSecondaryPoint({
      content: bridgePurchaseContent,
      progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "fencing",
      targetType: "specialization"
    });

    expect(result.error).toBeUndefined();
    expect(result.progression.specializations).toContainEqual(
      expect.objectContaining({
        ranks: 1,
        secondaryRanks: 1,
        skillId: "one_handed_edged",
        specializationId: "fencing"
      })
    );
    expect(result.warnings).toEqual([]);
  });

  it("does not count derived specialization XP as flexible-point spend and uses the same profile-based flexible pool as the page summary", () => {
    const bridgePurchaseContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "combat_group",
          name: "Combat",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: true,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "combat_group",
          groupIds: ["combat_group"],
          id: "one_handed_edged",
          linkedStats: ["dex"],
          name: "1-h edged",
          requiresLiteracy: "no",
          sortOrder: 1
        }
      ],
      specializations: [
        {
          id: "fencing",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Fencing",
          skillId: "one_handed_edged",
          sortOrder: 1,
          specializationBridge: {
            parentExcessOffset: 5,
            parentSkillId: "one_handed_edged",
            reverseFactor: 1,
            threshold: 6
          }
        }
      ],
      professionFamilies: [],
      professions: [],
      professionSkills: [],
      societyLevels: [
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });
    const progression = createChargenProgression();
    progression.skillGroups = [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "combat_group",
        primaryRanks: 6,
        ranks: 6,
        secondaryRanks: 0
      }
    ];
    progression.skills = [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "combat_group",
        level: 6,
        primaryRanks: 6,
        ranks: 6,
        secondaryRanks: 0,
        skillId: "one_handed_edged"
      }
    ];
    const flexibleProfile = {
      distractionLevel: 0,
      id: "profile-fencer",
      label: "Fencer",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 20,
        lck: 13,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10
      },
      societyLevel: 0
    };

    const beforeDraft = buildChargenDraftView({
      content: bridgePurchaseContent,
      professionId: undefined,
      profile: flexibleProfile,
      progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(beforeDraft.secondaryPoolAvailable).toBe(33);
    expect(beforeDraft.specializations.find((specialization) => specialization.specializationId === "fencing")).toMatchObject({
      secondaryRanks: 0
    });
    expect(progression.secondaryPoolSpent).toBe(0);
    expect(
      getSecondaryPurchaseCostForSpecialization(progression, bridgePurchaseContent.specializations[0]!)
    ).toBe(4);

    const firstPurchase = spendSecondaryPoint({
      content: bridgePurchaseContent,
      profile: flexibleProfile,
      progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "fencing",
      targetType: "specialization"
    });

    expect(firstPurchase.error).toBeUndefined();
    expect(firstPurchase.spentCost).toBe(4);
    expect(firstPurchase.progression.secondaryPoolSpent).toBe(4);

    const afterFirstDraft = buildChargenDraftView({
      content: bridgePurchaseContent,
      professionId: undefined,
      profile: flexibleProfile,
      progression: firstPurchase.progression,
      societyId: "glantri",
      societyLevel: 1
    });

    expect(afterFirstDraft.secondaryPoolAvailable).toBe(29);
    expect(afterFirstDraft.specializations.find((specialization) => specialization.specializationId === "fencing")).toMatchObject({
      secondaryRanks: 1,
      effectiveSpecializationNumber: expect.any(Number)
    });
    expect(
      getSecondaryPurchaseCostForSpecialization(
        firstPurchase.progression,
        bridgePurchaseContent.specializations[0]!
      )
    ).toBe(2);

    const secondPurchase = spendSecondaryPoint({
      content: bridgePurchaseContent,
      profile: flexibleProfile,
      progression: firstPurchase.progression,
      societyId: "glantri",
      societyLevel: 1,
      targetId: "fencing",
      targetType: "specialization"
    });

    expect(secondPurchase.error).toBeUndefined();
    expect(secondPurchase.spentCost).toBe(2);
    expect(secondPurchase.progression.secondaryPoolSpent).toBe(6);

    const exhausted = spendSecondaryPoint({
      content: bridgePurchaseContent,
      profile: flexibleProfile,
      progression: {
        ...progression,
        secondaryPoolSpent: 33
      },
      societyId: "glantri",
      societyLevel: 1,
      targetId: "fencing",
      targetType: "specialization"
    });

    expect(exhausted.error).toBe("Not enough secondary points remaining for that specialization purchase.");
  });

  it("returns a clearer legacy specialization access message for non-bridge rows", () => {
    const content = validateCanonicalContent({
      skillGroups: [
        {
          id: "medicine_group",
          name: "Medicine",
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: true,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          derivedGrants: [],
          groupId: "medicine_group",
          groupIds: ["medicine_group"],
          id: "surgery_parent",
          linkedStats: ["int"],
          name: "Surgery Parent",
          requiresLiteracy: "no",
          sortOrder: 1
        }
      ],
      specializations: [
        {
          id: "surgery",
          minimumGroupLevel: 6,
          minimumParentLevel: 6,
          name: "Surgery",
          skillId: "surgery_parent",
          sortOrder: 1
        }
      ],
      professionFamilies: [],
      professions: [],
      professionSkills: [],
      societyLevels: [
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: [],
          skillGroupIds: [],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });

    const result = spendSecondaryPoint({
      content,
      progression: {
        ...createChargenProgression(),
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "medicine_group",
            level: 6,
            primaryRanks: 6,
            ranks: 6,
            secondaryRanks: 0,
            skillId: "surgery_parent"
          }
        ]
      },
      targetId: "surgery",
      targetType: "specialization",
      societyId: "glantri",
      societyLevel: 1
    });

    expect(result.error).toBe(
      "This specialization is outside the current society/profession access for its parent skill."
    );
  });
});

const motherTongueTestContent = {
  ...chargenTestContent,
  civilizations: [
    {
      historicalAnalogue: "Test analogue",
      id: "glantri_civ",
      linkedSocietyId: "glantri",
      linkedSocietyLevel: 1,
      motherTongueLanguageName: "Common",
      name: "Glantri",
      optionalLanguageNames: ["Old Common"],
      period: "Test period",
      shortDescription: "Test civilization",
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    }
  ],
  languages: [
    {
      id: "glantri_language",
      name: "Common",
      sourceSocietyId: "glantri"
    },
    {
      id: "old_common_language",
      name: "Old Common",
      sourceSocietyId: "glantri"
    }
  ],
  societies: [
    {
      baselineLanguageIds: ["glantri_language"],
      id: "glantri",
      name: "Glantri",
      shortDescription: "Test society",
      societyLevel: 1
    }
  ],
  skills: [
    ...chargenTestContent.skills,
    {
      allowsSpecializations: true,
      category: "ordinary" as const,
      categoryId: "language" as const,
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scholarly",
      groupIds: ["scholarly"],
      id: "language",
      isTheoretical: false,
      linkedStats: ["int"],
      name: "Language",
      requiresLiteracy: "no" as const,
      societyLevel: 1,
      sortOrder: 4
    }
  ]
};

function createProgressionWithLore(): CharacterProgression {
  const progression = createChargenProgression();

  return {
    ...progression,
    skillGroups: [
      {
        gms: 0,
        grantedRanks: 0,
        groupId: "scholarly",
        primaryRanks: 1,
        secondaryRanks: 0,
        ranks: 1
      }
    ],
    skills: [
      {
        category: "ordinary",
        grantedRanks: 0,
        groupId: "scholarly",
        level: 1,
        primaryRanks: 1,
        ranks: 1,
        secondaryRanks: 0,
        skillId: "lore"
      }
    ]
  };
}

describe("chargen purchase gate integration", () => {
  it("includes group-granted skills in the draft view even without a direct skill row", () => {
    const combatContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "basic_melee_training",
          name: "Basic Melee Training",
          sortOrder: 1
        }
      ],
      skills: [
        {
          id: "dodge",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Dodge",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 1,
          allowsSpecializations: false
        },
        {
          id: "parry",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Parry",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 2,
          allowsSpecializations: false
        },
        {
          id: "one_h_edged",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "1-h edged",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 3,
          allowsSpecializations: false
        }
      ],
      specializations: [],
      professionFamilies: [
        {
          id: "soldier",
          name: "Soldier"
        }
      ],
      professions: [
        {
          id: "fighter",
          familyId: "soldier",
          name: "Fighter",
          subtypeName: "Fighter"
        }
      ],
      professionSkills: [
        {
          professionId: "soldier",
          scope: "family",
          grantType: "group",
          skillGroupId: "basic_melee_training",
          isCore: true
        }
      ],
      societyLevels: [
        {
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri",
          socialClass: "Common",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri",
          socialClass: "Guild",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri",
          socialClass: "Patrician",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri",
          socialClass: "Noble",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "fighter",
      progression: {
        ...createChargenProgression(),
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ],
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "basic_melee_training",
            level: 1,
            primaryRanks: 1,
            ranks: 1,
            secondaryRanks: 0,
            skillId: "one_h_edged"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    const dodge = draftView.skills.find((skill) => skill.skillId === "dodge");
    const parry = draftView.skills.find((skill) => skill.skillId === "parry");
    const edged = draftView.skills.find((skill) => skill.skillId === "one_h_edged");
    const meleeGroup = draftView.groups.find((group) => group.groupId === "basic_melee_training");

    expect(meleeGroup?.groupLevel).toBeGreaterThan(0);
    expect(dodge).toMatchObject({
      effectiveSkillNumber: meleeGroup?.groupLevel,
      name: "Dodge",
      specificSkillLevel: 0,
    });
    expect(parry).toMatchObject({
      effectiveSkillNumber: meleeGroup?.groupLevel,
      name: "Parry",
      specificSkillLevel: 0,
    });
    expect(edged).toMatchObject({
      effectiveSkillNumber: (meleeGroup?.groupLevel ?? 0) + 1,
      name: "1-h edged",
      specificSkillLevel: 1,
    });
  });

  it("includes chosen group-slot skills in the draft view like normal skills", () => {
    const combatContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "basic_melee_training",
          name: "Basic Melee Training",
          selectionSlots: [
            {
              candidateSkillIds: ["one_h_edged"],
              chooseCount: 1,
              id: "melee_choice",
              label: "Choose one melee weapon skill",
              required: true
            }
          ],
          skillMemberships: [
            {
              relevance: "core",
              skillId: "dodge"
            },
            {
              relevance: "core",
              skillId: "parry"
            }
          ],
          sortOrder: 1
        },
        {
          id: "combat_group",
          name: "Combat group",
          sortOrder: 2
        }
      ],
      skills: [
        {
          id: "dodge",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Dodge",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 1,
          allowsSpecializations: false,
          categoryId: "combat"
        },
        {
          id: "parry",
          groupId: "basic_melee_training",
          groupIds: ["basic_melee_training"],
          name: "Parry",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 2,
          allowsSpecializations: false,
          categoryId: "combat"
        },
        {
          id: "one_h_edged",
          groupId: "combat_group",
          groupIds: ["combat_group", "basic_melee_training"],
          name: "1-h edged",
          linkedStats: ["dex"],
          dependencies: [],
          dependencySkillIds: [],
          category: "ordinary",
          requiresLiteracy: "no",
          sortOrder: 3,
          allowsSpecializations: false,
          categoryId: "combat"
        }
      ],
      specializations: [],
      professionFamilies: [
        {
          id: "soldier",
          name: "Soldier"
        }
      ],
      professions: [
        {
          id: "fighter",
          familyId: "soldier",
          name: "Fighter",
          subtypeName: "Fighter"
        }
      ],
      professionSkills: [
        {
          professionId: "soldier",
          scope: "family",
          grantType: "group",
          skillGroupId: "basic_melee_training",
          isCore: true
        }
      ],
      societyLevels: [
        {
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri",
          socialClass: "Common",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri",
          socialClass: "Guild",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri",
          socialClass: "Patrician",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        },
        {
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri",
          socialClass: "Noble",
          professionIds: ["fighter"],
          skillGroupIds: ["basic_melee_training"]
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatContent,
      professionId: "fighter",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedGroupSlots: [
            {
              groupId: "basic_melee_training",
              selectedSkillIds: ["one_h_edged"],
              slotId: "melee_choice"
            }
          ],
          selectedLanguageIds: [],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ],
        skills: []
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.find((skill) => skill.skillId === "one_h_edged")).toMatchObject({
      name: "1-h edged",
      specificSkillLevel: 0
    });
  });

  it("requires required group-slot choices before finalizing", () => {
    const review = reviewChargenDraft({
      content: validateCanonicalContent({
        skillGroups: [
          {
            id: "basic_melee_training",
            name: "Basic Melee Training",
            selectionSlots: [
              {
                candidateSkillIds: ["one_h_edged"],
                chooseCount: 1,
                id: "melee_choice",
                label: "Choose one melee weapon skill",
                required: true
              }
            ],
            skillMemberships: [
              {
                relevance: "core",
                skillId: "dodge"
              },
              {
                relevance: "core",
                skillId: "parry"
              }
            ],
            sortOrder: 1
          },
          {
            id: "combat_group",
            name: "Combat group",
            sortOrder: 2
          }
        ],
        skills: [
          {
            id: "dodge",
            groupId: "basic_melee_training",
            groupIds: ["basic_melee_training"],
            name: "Dodge",
            linkedStats: ["dex"],
            dependencies: [],
            dependencySkillIds: [],
            category: "ordinary",
            requiresLiteracy: "no",
            sortOrder: 1,
            allowsSpecializations: false,
            categoryId: "combat"
          },
          {
            id: "parry",
            groupId: "basic_melee_training",
            groupIds: ["basic_melee_training"],
            name: "Parry",
            linkedStats: ["dex"],
            dependencies: [],
            dependencySkillIds: [],
            category: "ordinary",
            requiresLiteracy: "no",
            sortOrder: 2,
            allowsSpecializations: false,
            categoryId: "combat"
          },
          {
            id: "one_h_edged",
            groupId: "combat_group",
            groupIds: ["combat_group", "basic_melee_training"],
            name: "1-h edged",
            linkedStats: ["dex"],
            dependencies: [],
            dependencySkillIds: [],
            category: "ordinary",
            requiresLiteracy: "no",
            sortOrder: 3,
            allowsSpecializations: false,
            categoryId: "combat"
          }
        ],
        specializations: [],
        professionFamilies: [
          {
            id: "soldier",
            name: "Soldier"
          }
        ],
        professions: [
          {
            id: "fighter",
            familyId: "soldier",
            name: "Fighter",
            subtypeName: "Fighter"
          }
        ],
        professionSkills: [
          {
            professionId: "soldier",
            scope: "family",
            grantType: "group",
            skillGroupId: "basic_melee_training",
            isCore: true
          }
        ],
        societyLevels: [
          {
            societyId: "glantri",
            societyLevel: 1,
            societyName: "Glantri",
            socialClass: "Common",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          },
          {
            societyId: "glantri",
            societyLevel: 2,
            societyName: "Glantri",
            socialClass: "Guild",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          },
          {
            societyId: "glantri",
            societyLevel: 3,
            societyName: "Glantri",
            socialClass: "Patrician",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          },
          {
            societyId: "glantri",
            societyLevel: 4,
            societyName: "Glantri",
            socialClass: "Noble",
            professionIds: ["fighter"],
            skillGroupIds: ["basic_melee_training"]
          }
        ]
      }),
      professionId: "fighter",
      profile: {
        distractionLevel: 0,
        id: "profile-baseline",
        label: "Baseline",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ]
      },
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1
    });

    expect(review.canFinalize).toBe(false);
    expect(review.errors).toContain("Basic Melee Training: Choose one melee weapon skill.");
  });

  it("uses the evaluator result for literacy-gated skill purchases", () => {
    const result = spendPrimaryPoint({
      content: chargenTestContent,
      professionId: "scribe",
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "archives",
      targetType: "skill"
    });

    expect(result.error).toBe("Archives requires Literacy.");
    expect(result.warnings).toEqual([]);
  });

  it("uses the evaluator result for specialization availability gating", () => {
    const result = spendSecondaryPoint({
      content: chargenTestContent,
      progression: createProgressionWithLore(),
      societyId: "glantri",
      societyLevel: 1,
      targetId: "codes",
      targetType: "specialization"
    });

    expect(result.error).toBe("Lore does not allow specializations like Codes.");
    expect(result.warnings).toEqual([]);
  });

  it("adds civilization mother tongue as a granted Language row in the draft view", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      profile: {
        distractionLevel: 0,
        id: "profile-linguist",
        label: "Linguist",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: createChargenProgression(),
      societyId: "glantri",
      societyLevel: 1
    });
    const languageView = draftView.skills.find((skill) => skill.skillId === "language");

    expect(languageView?.category).toBe("ordinary");
    expect(languageView?.categoryId).toBe("language");
    expect(languageView?.languageName).toBe("Common");
    expect(languageView?.specificSkillLevel).toBe(12);
  });

  it("exposes education components in the chargen draft view", () => {
    const educationContent = validateCanonicalContent({
      ...motherTongueTestContent,
      skills: motherTongueTestContent.skills.map((skill) =>
        skill.id === "lore" ? { ...skill, isTheoretical: true } : skill
      ),
      societyLevels: motherTongueTestContent.societyLevels.map((societyLevel) =>
        societyLevel.societyId === "glantri" && societyLevel.societyLevel === 1
          ? { ...societyLevel, baseEducation: 3 }
          : societyLevel
      )
    });
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: educationContent,
      profile: {
        distractionLevel: 0,
        id: "profile-education",
        label: "Education",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        skills: [
          {
            category: "ordinary",
            categoryId: "lore",
            level: 0,
            primaryRanks: 1,
            ranks: 1,
            secondaryRanks: 0,
            skillId: "lore"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.education.baseEducation).toBe(3);
    expect(draftView.education.socialClassEducationValue).toBe(12);
    expect(
      draftView.education.theoreticalSkillCount -
        draftView.education.baseEducation -
        draftView.education.socialClassEducationValue
    ).toBe(1);
    expect(draftView.education.theoreticalSkillCount).toBe(16);
  });

  it("finalizes mother tongue without spending ordinary or flexible points", () => {
    const result = finalizeChargenDraft({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      professionId: "scribe",
      profile: {
        distractionLevel: 0,
        id: "profile-linguist",
        label: "Linguist",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: createChargenProgression(),
      ruleSet: {
        id: "chargen-rule-standard",
        name: "Standard chargen",
        parameters: {
          exchangeCount: 2,
          flexiblePointFactor: 1,
          ordinarySkillPoints: 60,
          statRollCount: 20
        }
      },
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1
    });
    const motherTongueSkill = result.build?.progression.skills.find((skill) => skill.skillId === "language");

    expect(result.errors).toEqual([]);
    expect(motherTongueSkill?.category).toBe("ordinary");
    expect(motherTongueSkill?.categoryId).toBe("language");
    expect(motherTongueSkill?.languageName).toBe("Common");
    expect(motherTongueSkill?.grantedRanks).toBe(12);
    expect(motherTongueSkill?.sourceTag).toBe("mother-tongue");
    expect(result.build?.progression.primaryPoolSpent).toBe(0);
    expect(result.build?.progression.secondaryPoolSpent).toBe(0);
    expect(result.build?.chargenRuleSet).toMatchObject({
      id: "chargen-rule-standard",
      name: "Standard chargen",
      ordinarySkillPoints: 60
    });
  });

  it("materializes selected optional civilization languages as concrete chargen skill rows", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      profile: {
        distractionLevel: 0,
        id: "profile-linguist",
        label: "Linguist",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: ["old_common_language"],
          selectedGroupSlots: [],
          selectedSkillIds: []
        }
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      draftView.skills
        .filter((skill) => skill.skillId === "language")
        .map((skill) => ({
          languageName: skill.languageName,
          sourceTag: skill.sourceTag,
          specificSkillLevel: skill.specificSkillLevel
        }))
    ).toEqual([
      {
        languageName: "Common",
        sourceTag: "mother-tongue",
        specificSkillLevel: 12
      },
      {
        languageName: "Old Common",
        sourceTag: undefined,
        specificSkillLevel: 0
      }
    ]);
  });

  it("emits separate concrete Language entries when progression contains multiple picked languages", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      profile: {
        distractionLevel: 0,
        id: "profile-linguist",
        label: "Linguist",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        skills: [
          {
            category: "ordinary",
            grantedRanks: 2,
            groupId: "scholarly",
            languageName: "Phoenician",
            level: 0,
            primaryRanks: 0,
            ranks: 2,
            secondaryRanks: 0,
            skillId: "language"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      draftView.skills
        .filter((skill) => skill.skillId === "language")
        .map((skill) => ({
          languageName: skill.languageName,
          skillKey: skill.skillKey,
          sourceTag: skill.sourceTag,
          specificSkillLevel: skill.specificSkillLevel
        }))
    ).toEqual([
      {
        languageName: "Common",
        skillKey: "language::language:Common",
        sourceTag: "mother-tongue",
        specificSkillLevel: 12
      },
      {
        languageName: "Phoenician",
        skillKey: "language::language:Phoenician",
        sourceTag: undefined,
        specificSkillLevel: 2
      }
    ]);
  });

  it("migrates legacy generic Language rows into the concrete mother tongue entry", () => {
    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: motherTongueTestContent,
      profile: {
        distractionLevel: 0,
        id: "profile-linguist",
        label: "Linguist",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "scholarly",
            level: 0,
            primaryRanks: 2,
            ranks: 2,
            secondaryRanks: 0,
            skillId: "language"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(
      draftView.skills
        .filter((skill) => skill.skillId === "language")
        .map((skill) => ({
          languageName: skill.languageName,
          sourceTag: skill.sourceTag,
          specificSkillLevel: skill.specificSkillLevel
        }))
    ).toEqual([
      {
        languageName: "Common",
        sourceTag: "mother-tongue",
        specificSkillLevel: 14
      }
    ]);
  });

  it("repairs legacy undefined mother-tongue rows and strips legacy language specializations", () => {
    const legacyLanguageContent = {
      ...motherTongueTestContent,
      specializations: [
        {
          id: "specific_language_specialization",
          skillId: "language",
          name: "Specific Language Specialization",
          minimumGroupLevel: 1,
          minimumParentLevel: 1,
          sortOrder: 1
        }
      ],
      skills: motherTongueTestContent.skills.map((skill) =>
        skill.id === "language"
          ? {
              ...skill,
              allowsSpecializations: true
            }
          : skill
      )
    };

    const draftView = buildChargenDraftView({
      civilizationId: "glantri_civ",
      content: legacyLanguageContent,
      professionId: "scribe",
      profile: {
        distractionLevel: 0,
        id: "profile-linguist",
        label: "Linguist",
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 10,
          will: 10
        },
        socialClassEducationValue: 12,
        societyLevel: 0
      },
      progression: {
        ...createChargenProgression(),
        specializations: [
          {
            level: 1,
            ranks: 1,
            secondaryRanks: 1,
            skillId: "language",
            specializationId: "specific_language_specialization"
          }
        ],
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "scholarly",
            languageName: "undefined",
            level: 0,
            primaryRanks: 0,
            ranks: 0,
            secondaryRanks: 0,
            skillId: "language",
            sourceTag: "mother-tongue"
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });
    expect(
      draftView.skills
        .filter((skill) => skill.skillId === "language")
        .map((skill) => ({
          languageName: skill.languageName,
          sourceTag: skill.sourceTag
        }))
    ).toEqual([
      {
        languageName: "Common",
        sourceTag: "mother-tongue"
      }
    ]);
    expect(draftView.specializations).toEqual([]);
  });

  it("materializes multi-pick combat slot selections as ordinary weapon skill rows", () => {
    const combatPickerContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "advanced_melee_training",
          name: "Advanced Melee Training",
          selectionSlots: [
            {
              candidateSkillIds: ["sword", "axe", "spear"],
              chooseCount: 3,
              id: "advanced_melee_weapons",
              label: "Choose three melee weapon skills",
              required: true
            }
          ],
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "sword",
          linkedStats: ["dex"],
          name: "Sword",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "axe",
          linkedStats: ["dex"],
          name: "Axe",
          requiresLiteracy: "no",
          sortOrder: 2
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "spear",
          linkedStats: ["dex"],
          name: "Spear",
          requiresLiteracy: "no",
          sortOrder: 3
        }
      ],
      specializations: [],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professions: [{ familyId: "warrior", id: "captain", name: "Captain", subtypeName: "Captain" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "warrior",
          scope: "family",
          skillGroupId: "advanced_melee_training"
        }
      ],
      societyLevels: [
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatPickerContent,
      professionId: "captain",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: [],
          selectedGroupSlots: [
            {
              groupId: "advanced_melee_training",
              selectedSkillIds: ["sword", "axe", "spear"],
              slotId: "advanced_melee_weapons"
            }
          ],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "advanced_melee_training",
            primaryRanks: 1,
            secondaryRanks: 0,
            ranks: 1
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.map((skill) => skill.skillId).sort()).toEqual(["axe", "spear", "sword"]);
  });

  it("only grants combat group XP to fixed skills plus selected slot skills", () => {
    const combatPickerContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "advanced_melee_training",
          name: "Advanced Melee Training",
          selectionSlots: [
            {
              candidateSkillIds: ["sword", "axe", "spear", "mace"],
              chooseCount: 3,
              id: "advanced_melee_weapons",
              label: "Choose three melee weapon skills",
              required: true
            }
          ],
          skillMemberships: [
            { relevance: "core", skillId: "dodge" },
            { relevance: "core", skillId: "parry" },
            { relevance: "core", skillId: "brawling" }
          ],
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "dodge",
          linkedStats: ["dex"],
          name: "Dodge",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "parry",
          linkedStats: ["dex"],
          name: "Parry",
          requiresLiteracy: "no",
          sortOrder: 2
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "brawling",
          linkedStats: ["str"],
          name: "Brawling",
          requiresLiteracy: "no",
          sortOrder: 3
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "sword",
          linkedStats: ["dex"],
          name: "Sword",
          requiresLiteracy: "no",
          sortOrder: 4
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "axe",
          linkedStats: ["dex"],
          name: "Axe",
          requiresLiteracy: "no",
          sortOrder: 5
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "spear",
          linkedStats: ["dex"],
          name: "Spear",
          requiresLiteracy: "no",
          sortOrder: 6
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "mace",
          linkedStats: ["dex"],
          name: "Mace",
          requiresLiteracy: "no",
          sortOrder: 7
        }
      ],
      specializations: [],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professions: [{ familyId: "warrior", id: "captain", name: "Captain", subtypeName: "Captain" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "warrior",
          scope: "family",
          skillGroupId: "advanced_melee_training"
        }
      ],
      societyLevels: [
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatPickerContent,
      professionId: "captain",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: [],
          selectedGroupSlots: [
            {
              groupId: "advanced_melee_training",
              selectedSkillIds: ["sword", "axe", "spear"],
              slotId: "advanced_melee_weapons"
            }
          ],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "advanced_melee_training",
            primaryRanks: 2,
            secondaryRanks: 0,
            ranks: 2
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });
    const meleeGroup = draftView.groups.find((group) => group.groupId === "advanced_melee_training");

    expect(
      draftView.skills
        .filter((skill) =>
          ["dodge", "parry", "brawling", "sword", "axe", "spear"].includes(skill.skillId)
        )
        .map((skill) => ({
          effectiveSkillNumber: skill.effectiveSkillNumber,
          skillId: skill.skillId
        }))
        .sort((left, right) => left.skillId.localeCompare(right.skillId))
    ).toEqual([
      { effectiveSkillNumber: meleeGroup?.groupLevel ?? 0, skillId: "axe" },
      { effectiveSkillNumber: meleeGroup?.groupLevel ?? 0, skillId: "brawling" },
      { effectiveSkillNumber: meleeGroup?.groupLevel ?? 0, skillId: "dodge" },
      { effectiveSkillNumber: meleeGroup?.groupLevel ?? 0, skillId: "parry" },
      { effectiveSkillNumber: meleeGroup?.groupLevel ?? 0, skillId: "spear" },
      { effectiveSkillNumber: meleeGroup?.groupLevel ?? 0, skillId: "sword" }
    ]);
    expect(draftView.skills.find((skill) => skill.skillId === "mace")).toBeUndefined();
  });

  it("does not double-count melee cross-training on selected Advanced Melee Training weapons", () => {
    const progression = {
      ...createChargenProgression(),
      chargenSelections: {
        selectedLanguageIds: [],
        selectedGroupSlots: [
          {
            groupId: "advanced_melee_training",
            selectedSkillIds: ["one_handed_edged", "two_handed_edged", "polearms"],
            slotId: "advanced_melee_weapon_choices"
          }
        ],
        selectedSkillIds: []
      },
      skillGroups: [
        {
          gms: 0,
          grantedRanks: 0,
          groupId: "advanced_melee_training",
          primaryRanks: 11,
          ranks: 11,
          secondaryRanks: 0
        }
      ]
    };
    const draftView = buildChargenDraftView({
      content: defaultCanonicalContent,
      professionId: "bodyguard",
      progression,
      societyId: "glantri",
      societyLevel: 4
    });
    const selectedWeaponRows = ["one_handed_edged", "two_handed_edged", "polearms"].map(
      (skillId) => draftView.skills.find((skill) => skill.skillId === skillId)
    );
    const unselectedRelatedRow = draftView.skills.find(
      (skill) => skill.skillId === "one_handed_concussion_axe"
    );

    expect(selectedWeaponRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectiveSkillNumber: 11,
          groupLevel: 11,
          relationshipGrantedPreviewLevel: 0,
          relationshipGrantedSkillLevel: 0,
          skillId: "one_handed_edged"
        }),
        expect.objectContaining({
          effectiveSkillNumber: 11,
          groupLevel: 11,
          relationshipGrantedPreviewLevel: 0,
          relationshipGrantedSkillLevel: 0,
          skillId: "two_handed_edged"
        }),
        expect.objectContaining({
          effectiveSkillNumber: 11,
          groupLevel: 11,
          relationshipGrantedPreviewLevel: 0,
          relationshipGrantedSkillLevel: 0,
          skillId: "polearms"
        })
      ])
    );
    expect(unselectedRelatedRow).toMatchObject({
      groupLevel: 0,
      relationshipGrantedPreviewLevel: 8,
      relationshipGrantedSkillLevel: 8,
      relationshipSourceType: "melee-cross-training"
    });
  });

  it("caps combat slot group XP to the canonical choose count", () => {
    const combatPickerContent = validateCanonicalContent({
      skillGroups: [
        {
          id: "advanced_melee_training",
          name: "Advanced Melee Training",
          selectionSlots: [
            {
              candidateSkillIds: ["sword", "axe", "spear", "mace"],
              chooseCount: 3,
              id: "advanced_melee_weapons",
              label: "Choose three melee weapon skills",
              required: true
            }
          ],
          skillMemberships: [{ relevance: "core", skillId: "dodge" }],
          sortOrder: 1
        }
      ],
      skills: [
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "dodge",
          linkedStats: ["dex"],
          name: "Dodge",
          requiresLiteracy: "no",
          sortOrder: 1
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "sword",
          linkedStats: ["dex"],
          name: "Sword",
          requiresLiteracy: "no",
          sortOrder: 2
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "axe",
          linkedStats: ["dex"],
          name: "Axe",
          requiresLiteracy: "no",
          sortOrder: 3
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "spear",
          linkedStats: ["dex"],
          name: "Spear",
          requiresLiteracy: "no",
          sortOrder: 4
        },
        {
          allowsSpecializations: false,
          category: "ordinary",
          dependencies: [],
          dependencySkillIds: [],
          groupId: "advanced_melee_training",
          groupIds: ["advanced_melee_training"],
          id: "mace",
          linkedStats: ["dex"],
          name: "Mace",
          requiresLiteracy: "no",
          sortOrder: 5
        }
      ],
      specializations: [],
      professionFamilies: [{ id: "warrior", name: "Warrior" }],
      professions: [{ familyId: "warrior", id: "captain", name: "Captain", subtypeName: "Captain" }],
      professionSkills: [
        {
          grantType: "group",
          isCore: true,
          professionId: "warrior",
          scope: "family",
          skillGroupId: "advanced_melee_training"
        }
      ],
      societyLevels: [
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Common",
          societyId: "glantri",
          societyLevel: 1,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Guild",
          societyId: "glantri",
          societyLevel: 2,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Patrician",
          societyId: "glantri",
          societyLevel: 3,
          societyName: "Glantri"
        },
        {
          professionIds: ["captain"],
          skillGroupIds: ["advanced_melee_training"],
          skillIds: [],
          socialClass: "Noble",
          societyId: "glantri",
          societyLevel: 4,
          societyName: "Glantri"
        }
      ]
    });

    const draftView = buildChargenDraftView({
      content: combatPickerContent,
      professionId: "captain",
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: [],
          selectedGroupSlots: [
            {
              groupId: "advanced_melee_training",
              selectedSkillIds: ["sword", "axe", "spear", "mace"],
              slotId: "advanced_melee_weapons"
            }
          ],
          selectedSkillIds: []
        },
        skillGroups: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "advanced_melee_training",
            primaryRanks: 2,
            secondaryRanks: 0,
            ranks: 2
          }
        ]
      },
      societyId: "glantri",
      societyLevel: 1
    });

    expect(draftView.skills.find((skill) => skill.skillId === "mace")).toBeUndefined();
    expect(
      draftView.skills
        .map((skill) => skill.skillId)
        .sort((left, right) => left.localeCompare(right))
    ).toEqual(["axe", "dodge", "spear", "sword"]);
  });
});
