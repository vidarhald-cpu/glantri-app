import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";
import type { ReusableEntity } from "@glantri/domain";
import type { EquipmentTemplate } from "@glantri/domain/equipment";

import {
  buildHumanoidNpcArchetypeSnapshot,
  createEmptyHumanoidNpcArchetypeDraft,
  getDefaultSkillLevelForSeniority,
  type HumanoidNpcArchetypeSnapshot,
  loadHumanoidNpcArchetypeDraft,
  listAvailableSkills,
  listProfessionsForSociety,
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

const content = validateCanonicalContent({
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
    { description: "Field soldiering", id: "field_soldiering", name: "Field soldiering", sortOrder: 1 },
    { description: "Urban watch", id: "urban_watch", name: "Urban watch", sortOrder: 2 }
  ],
  skills: [
    {
      allowsSpecializations: false,
      category: "ordinary",
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
});

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
        professionIds: ["guard"],
        skillGroupIds: ["urban_watch"],
        skillIds: [],
        societyId: "glantri",
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
    ).toEqual(["urban_watch", "field_soldiering"]);

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
});
