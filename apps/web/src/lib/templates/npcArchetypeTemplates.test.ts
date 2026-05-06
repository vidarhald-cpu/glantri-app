import { describe, expect, it } from "vitest";

import type { CanonicalContent } from "@glantri/content";
import type { ReusableEntity } from "@glantri/domain";
import type { EquipmentTemplate } from "@glantri/domain/equipment";

import {
  buildGeneratedHumanoidNpcSnapshot,
  buildHumanoidNpcArchetypeSnapshot,
  createEmptyHumanoidNpcArchetypeDraft,
  generateHumanoidNpcFromTemplate,
  getDefaultSkillLevelForSeniority,
  getDefaultSkillLevelForRelevance,
  getOptionalSkillLevelForSeniority,
  type HumanoidNpcArchetypeSnapshot,
  loadHumanoidNpcArchetypeDraft,
  listAvailableSkills,
  listProfessionsForSociety,
  parseGeneratedHumanoidNpcEntity,
  listSuggestedSkills,
  listSocietyOptions,
  listSuggestedSkillGroupIds,
  parseHumanoidNpcArchetypeTemplate
} from "./npcArchetypeTemplates";

const testEquipmentTemplates = [
  {
    category: "weapon",
    id: "weapon-1",
    name: "Sword"
  },
  {
    category: "gear",
    id: "gear-1",
    name: "Rope"
  }
] as EquipmentTemplate[];

const content = {
  languages: [
    {
      id: "glantri_language",
      name: "Glantri",
      sourceSocietyId: "glantri"
    }
  ],
  civilizations: [
    {
      historicalAnalogue: "Late medieval magocracy",
      id: "glantri_civ",
      linkedSocietyId: "glantri",
      linkedSocietyLevel: 4,
      motherTongueLanguageName: "Glantri",
      name: "Principalities of Glantri",
      notes: "Test civilization",
      optionalLanguageNames: [],
      period: "Current age",
      shortDescription: "Courtly magical civilization",
      spokenLanguageName: "Glantri",
      writtenLanguageName: "Glantri"
    },
    {
      historicalAnalogue: "Feudal kingdom",
      id: "glantri_peer_civ",
      linkedSocietyId: "other_society",
      linkedSocietyLevel: 4,
      motherTongueLanguageName: "Common",
      name: "Thyatis",
      notes: "Same society level should still appear",
      optionalLanguageNames: [],
      period: "Current age",
      shortDescription: "Imperial peer civilization",
      spokenLanguageName: "Common",
      writtenLanguageName: "Common"
    }
  ],
  professionFamilies: [{ id: "military", name: "Military" }],
  professionSkills: [
    {
      grantType: "group",
      isCore: true,
      professionId: "military",
      scope: "family",
      skillGroupId: "field_soldiering"
    },
    {
      grantType: "ordinary-skill",
      isCore: true,
      professionId: "guard",
      scope: "profession",
      skillId: "leadership"
    }
  ],
  professions: [
    {
      familyId: "military",
      id: "guard",
      name: "Guard",
      subtypeName: "Guard"
    }
  ],
  skillGroups: [
    {
      description: "Field soldiering",
      id: "field_soldiering",
      name: "Field soldiering",
      skillMemberships: [{ relevance: "core", skillId: "shield_use" }],
      sortOrder: 1
    },
    {
      description: "Urban watch",
      id: "urban_watch",
      name: "Urban watch",
      skillMemberships: [{ relevance: "core", skillId: "leadership" }],
      sortOrder: 2
    }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "combat",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "field_soldiering",
      groupIds: ["field_soldiering"],
      id: "shield_use",
      linkedStats: ["dex"],
      name: "Shield Use",
      requiresLiteracy: "no",
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      categoryId: "social",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "urban_watch",
      groupIds: ["urban_watch"],
      id: "leadership",
      linkedStats: ["cha"],
      name: "Leadership",
      requiresLiteracy: "no",
      sortOrder: 2
    }
  ],
  societies: [
    {
      baselineLanguageIds: ["glantri_language"],
      id: "glantri",
      name: "Glantri",
      shortDescription: "Ranked feudal magocracy with courtly and urban institutions.",
      societyLevel: 4
    }
  ],
  societyLevels: [
    {
      professionIds: ["guard"],
      skillGroupIds: ["urban_watch"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 1,
      societyName: "Glantri"
    },
    {
      professionIds: ["guard"],
      skillGroupIds: ["urban_watch"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 2,
      societyName: "Glantri"
    },
    {
      professionIds: ["guard"],
      skillGroupIds: ["urban_watch"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 3,
      societyName: "Glantri"
    },
    {
      professionIds: ["guard"],
      skillGroupIds: ["urban_watch"],
      skillIds: [],
      socialClass: "Common",
      societyId: "glantri",
      societyLevel: 4,
      societyName: "Glantri"
    }
  ],
  specializations: []
} as unknown as CanonicalContent;

function createEntity(snapshot: unknown): ReusableEntity {
  return {
    createdAt: "2026-04-16T10:00:00.000Z",
    gmUserId: "gm-1",
    id: "template-1",
    kind: "npc",
    name: "City Guard",
    snapshot,
    updatedAt: "2026-04-16T10:00:00.000Z"
  };
}

describe("npcArchetypeTemplates", () => {
  it("builds society and profession options from canonical content", () => {
    expect(listSocietyOptions(content)).toEqual([
      {
        civilizationNames: ["Principalities of Glantri", "Thyatis"],
        professionIds: ["guard"],
        skillGroupIds: ["urban_watch"],
        skillIds: [],
        shortDescription: "Ranked feudal magocracy with courtly and urban institutions.",
        societyId: "glantri",
        societyLevel: 4,
        societyName: "Glantri"
      }
    ]);
    expect(listProfessionsForSociety({ content, societyId: "glantri" }).map((entry) => entry.id)).toEqual([
      "guard"
    ]);
  });

  it("combines society and profession suggestions for skill groups and skills", () => {
    expect(
      listSuggestedSkillGroupIds({
        content,
        professionId: "guard",
        societyId: "glantri"
      })
    ).toEqual(["field_soldiering", "urban_watch"]);

    expect(
      listAvailableSkills({
        content,
        professionId: "guard",
        selectedSkillGroupIds: ["field_soldiering"],
        societyId: "glantri"
      }).map((skill) => skill.id)
    ).toEqual(["leadership", "shield_use"]);

    expect(
      listSuggestedSkills({
        content,
        professionId: "guard",
        selectedSkillGroupIds: ["field_soldiering"],
        societyId: "glantri"
      }).map((skill) => skill.id)
    ).toEqual(["leadership", "shield_use"]);
  });

  it("maps seniority presets to default skill target levels", () => {
    expect(getDefaultSkillLevelForSeniority("unskilled")).toBe(0);
    expect(getDefaultSkillLevelForSeniority("basic")).toBe(3);
    expect(getDefaultSkillLevelForSeniority("under_training")).toBe(8);
    expect(getDefaultSkillLevelForSeniority("fully_trained")).toBe(13);
    expect(getDefaultSkillLevelForSeniority("veteran")).toBe(17);
    expect(getDefaultSkillLevelForSeniority("expert")).toBe(21);
    expect(getOptionalSkillLevelForSeniority("unskilled")).toBe(0);
    expect(getOptionalSkillLevelForSeniority("fully_trained")).toBe(8);
    expect(getDefaultSkillLevelForRelevance({ relevance: "core", seniority: "fully_trained" })).toBe(13);
    expect(getDefaultSkillLevelForRelevance({ relevance: "optional", seniority: "fully_trained" })).toBe(8);
    expect(getDefaultSkillLevelForRelevance({ relevance: "other", seniority: "fully_trained" })).toBe(13);
  });

  it("builds a reusable humanoid npc archetype snapshot with future generator metadata", () => {
    const draft = createEmptyHumanoidNpcArchetypeDraft();
    const sword = testEquipmentTemplates.find((template) => template.category === "weapon");
    const rope = testEquipmentTemplates.find((template) => template.category === "gear");

    draft.name = "City Guard";
    draft.professionId = "guard";
    draft.roleLabel = "Town watch";
    draft.seniority = "veteran";
    draft.selectedGearTemplateIds = [sword?.id ?? "", rope?.id ?? ""].filter(Boolean);
    draft.selectedSkillGroupIds = ["field_soldiering", "urban_watch"];
    draft.skillSelections = [{ skillId: "shield_use", targetLevel: 12 }];
    draft.societyId = "glantri";
    draft.tags = "urban, guard";

    const snapshot = buildHumanoidNpcArchetypeSnapshot({
      content,
      draft,
      equipmentTemplates: testEquipmentTemplates
    }) as Record<string, unknown>;

    expect(snapshot.actorClass).toBe("template");
    expect(snapshot.templateKind).toBe("humanoid_npc_archetype");
    expect(snapshot.profession).toBe("Guard");
    expect(snapshot.humanoidNpcArchetype).toMatchObject({
      gear: {
        templateIds: draft.selectedGearTemplateIds
      },
      profession: {
        familyId: "military",
        id: "guard",
        name: "Guard"
      },
      seniority: "veteran",
      society: {
        societyId: "glantri",
        societyName: "Glantri"
      },
      variability: {
        skillVariance: 2,
        statVariance: 1
      }
    });
    expect((snapshot.humanoidNpcArchetype as { generationHints: HumanoidNpcArchetypeSnapshot["generationHints"] }).generationHints.competencyBands).toContainEqual({
      label: "unskilled",
      max: 0,
      min: 0
    });
    expect((snapshot.humanoidNpcArchetype as { generationHints: HumanoidNpcArchetypeSnapshot["generationHints"] }).generationHints.suitabilityScale).toContainEqual({
      bonus: 0,
      label: "ordinary"
    });
  });

  it("parses humanoid npc archetype summaries back out of template snapshots", () => {
    const summary = parseHumanoidNpcArchetypeTemplate(
      createEntity({
        actorClass: "template",
        equipmentProfile: "Sword, Rope",
        humanoidNpcArchetype: {
          gear: {
            templateIds: ["weapon-1"],
            templateNames: ["Sword"]
          },
          profession: {
            id: "guard",
            name: "Guard"
          },
          skillGroupIds: ["field_soldiering"],
          skills: [{ skillId: "shield_use", skillName: "Shield Use", targetLevel: 12 }],
          society: {
            societyId: "glantri",
            societyName: "Glantri"
          },
          stats: {
            base: createEmptyHumanoidNpcArchetypeDraft().stats,
            final: createEmptyHumanoidNpcArchetypeDraft().stats
          },
          variability: {
            skillVariance: 2,
            statVariance: 1
          }
        },
        profession: "Guard",
        roleLabel: "Town watch",
        tags: ["urban", "guard"],
        templateKind: "humanoid_npc_archetype"
      })
    );

    expect(summary).toMatchObject({
      actorClass: "template",
      equipmentProfile: "Sword, Rope",
      gearNames: ["Sword"],
      isHumanoidNpcArchetype: true,
      profession: "Guard",
      roleLabel: "Town watch",
      seniority: "fully_trained",
      skillCount: 1,
      skillGroupCount: 1,
      societyName: "Glantri",
      tags: ["urban", "guard"],
      variability: {
        skillVariance: 2,
        statVariance: 1
      }
    });
  });

  it("loads humanoid npc archetype templates back into editable draft state", () => {
    const loaded = loadHumanoidNpcArchetypeDraft(
      createEntity({
        actorClass: "template",
        humanoidNpcArchetype: {
          gear: {
            notes: "Optional rope",
            templateIds: ["weapon-1"],
            templateNames: ["Sword"]
          },
          profession: {
            id: "guard",
            name: "Guard"
          },
          skillGroupIds: ["field_soldiering"],
          skills: [{ skillId: "shield_use", skillName: "Shield Use", targetLevel: 12 }],
          seniority: "expert",
          society: {
            societyId: "glantri",
            societyName: "Glantri"
          },
          stats: {
            base: createEmptyHumanoidNpcArchetypeDraft().stats,
            final: createEmptyHumanoidNpcArchetypeDraft().stats
          },
          variability: {
            gearSubstitutionNotes: "Swap spear for halberd",
            notes: "Veteran captain variant",
            skillVariance: 3,
            statVariance: 2
          }
        },
        roleLabel: "Town watch",
        tags: ["urban", "guard"]
      })
    );

    expect(loaded.isHumanoidNpcArchetype).toBe(true);
    expect(loaded.draft).toMatchObject({
      gearNotes: "Optional rope",
      professionId: "guard",
      roleLabel: "Town watch",
      seniority: "expert",
      selectedGearTemplateIds: ["weapon-1"],
      selectedSkillGroupIds: ["field_soldiering"],
      skillSelections: [{ skillId: "shield_use", targetLevel: 12 }],
      societyId: "glantri",
      tags: "urban, guard",
      variability: {
        gearSubstitutionNotes: "Swap spear for halberd",
        notes: "Veteran captain variant",
        skillVariance: 3,
        statVariance: 2
      }
    });
  });

  it("generates a humanoid npc from an archetype template using seniority defaults", () => {
    const snapshot = buildHumanoidNpcArchetypeSnapshot({
      content,
      draft: {
        ...createEmptyHumanoidNpcArchetypeDraft(),
        description: "Reliable town guard.",
        name: "City Guard",
        professionId: "guard",
        roleLabel: "Town watch",
        selectedSkillGroupIds: ["field_soldiering", "urban_watch"],
        skillSelections: [
          { skillId: "leadership", targetLevel: 12 },
          { skillId: "shield_use", targetLevel: 12 }
        ],
        societyId: "glantri",
        stats: {
          ...createEmptyHumanoidNpcArchetypeDraft().stats,
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          siz: 10,
          str: 10
        },
        variability: {
          gearSubstitutionNotes: "",
          notes: "",
          skillVariance: 0,
          statVariance: 0
        }
      },
      equipmentTemplates: testEquipmentTemplates
    });
    const template = {
      ...createEntity(snapshot),
      description: "Reliable town guard."
    };

    const npc = generateHumanoidNpcFromTemplate({
      content,
      equipmentTemplates: testEquipmentTemplates,
      seniority: "fully_trained",
      template
    });

    expect(npc).toMatchObject({
      actorClass: "generated_npc",
      description: "Reliable town guard.",
      kind: "npc",
      professionName: "Guard",
      roleLabel: "Town watch",
      seniority: "fully_trained",
      societyName: "Glantri",
      sourceTemplateId: "template-1",
      sourceTemplateName: "City Guard"
    });
    expect(npc.skills).toEqual([
      {
        categoryId: "social",
        groupIds: ["urban_watch"],
        isCore: true,
        skillId: "leadership",
        skillName: "Leadership",
        targetLevel: 13
      },
      {
        categoryId: "combat",
        groupIds: ["field_soldiering"],
        isCore: true,
        skillId: "shield_use",
        skillName: "Shield Use",
        targetLevel: 13
      }
    ]);
    expect(npc.stats.base).toEqual({
      ...createEmptyHumanoidNpcArchetypeDraft().stats,
      cha: 10,
      com: 10,
      con: 10,
      dex: 10,
      health: 10,
      int: 10,
      siz: 10,
      str: 10
    });
  });

  it("parses generated humanoid npc snapshots back out of saved entities", () => {
    const summary = parseGeneratedHumanoidNpcEntity(
      createEntity(
        buildGeneratedHumanoidNpcSnapshot({
          actorClass: "generated_npc",
          displayName: "Town watch 101",
          gearNames: ["Sword"],
          kind: "npc",
          professionName: "Guard",
          roleLabel: "Town watch",
          seniority: "veteran",
          skills: [
            {
              categoryId: "combat",
              groupIds: ["field_soldiering"],
              isCore: true,
              skillId: "shield_use",
              skillName: "Shield Use",
              targetLevel: 17
            }
          ],
          societyName: "Glantri",
          sourceTemplateId: "template-1",
          sourceTemplateName: "City Guard",
          stats: {
            base: createEmptyHumanoidNpcArchetypeDraft().stats,
            final: createEmptyHumanoidNpcArchetypeDraft().stats
          },
          tags: ["urban", "guard"]
        })
      )
    );

    expect(summary).toMatchObject({
      actorClass: "generated_npc",
      gearNames: ["Sword"],
      isGeneratedHumanoidNpc: true,
      profession: "Guard",
      roleLabel: "Town watch",
      seniority: "veteran",
      skillCount: 1,
      societyName: "Glantri",
      sourceTemplateName: "City Guard",
      tags: ["urban", "guard"]
    });
  });
});
