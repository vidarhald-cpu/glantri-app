import { describe, expect, it } from "vitest";

import type { CharacterBuild, SkillDefinition, SkillGroupDefinition } from "@glantri/domain";

import { resolveParticipantSkillRollProfile } from "./resolveParticipantSkillRollProfile";

const perceptionSkill: Pick<SkillDefinition, "groupId" | "groupIds" | "id" | "linkedStats" | "name"> = {
  groupId: "watchfulness",
  groupIds: ["watchfulness"],
  id: "perception",
  linkedStats: ["int", "pow"],
  name: "Perception",
};

const surgerySkill: Pick<SkillDefinition, "groupId" | "groupIds" | "id" | "linkedStats" | "name"> = {
  groupId: "medicine_group",
  groupIds: ["medicine_group"],
  id: "surgery",
  linkedStats: ["dex", "int"],
  name: "Surgery",
};

const firstAidSkill: SkillDefinition = {
  allowsSpecializations: false,
  category: "secondary",
  dependencies: [],
  dependencySkillIds: [],
  groupId: "healing_practice",
  groupIds: ["healing_practice"],
  id: "first_aid",
  isTheoretical: false,
  linkedStats: ["int", "dex"],
  name: "First aid",
  requiresLiteracy: "no",
  societyLevel: 1,
  sortOrder: 1,
};

const medicineSkill: SkillDefinition = {
  ...firstAidSkill,
  category: "ordinary",
  derivedGrants: [{ factor: 1, skillId: "first_aid" }],
  id: "medicine",
  linkedStats: ["int"],
  name: "Medicine",
  sortOrder: 2,
};

const healingGroup: SkillGroupDefinition = {
  description: "",
  id: "healing_practice",
  name: "Healing Practice",
  skillMemberships: [{ relevance: "core", skillId: "first_aid" }],
  selectionSlots: [],
  sortOrder: 1,
};

const content = {
  professionFamilies: [],
  professionSkills: [],
  professions: [],
  skillGroups: [healingGroup],
  skills: [firstAidSkill, medicineSkill],
  societyLevels: [],
  specializations: [],
};

const build: CharacterBuild = {
  equipment: { items: [] },
  id: "character-1",
  name: "The Gladiator",
  profile: {
    id: "profile-1",
    label: "Test profile",
    distractionLevel: 2,
    rolledStats: {
      cha: 8,
      com: 8,
      con: 11,
      dex: 14,
      health: 10,
      int: 16,
      lck: 9,
      pow: 12,
      siz: 10,
      str: 10,
      will: 13,
    },
    societyLevel: 0,
  },
  progression: {
    chargenMode: "standard",
    educationPoints: 0,
    flexiblePointFactor: 1,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: 60,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: 20,
    skillGroups: [],
    skills: [],
    specializations: [],
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: [],
  },
  statModifiers: {},
};

describe("resolveParticipantSkillRollProfile", () => {
  it("uses the Character Sheet total skill level for known skills", () => {
    const profile = resolveParticipantSkillRollProfile({
      build,
      participantId: "encounter-participant-1",
      participantName: "The Gladiator",
      sheetSummary: {
        draftView: {
          skills: [
            {
              effectiveSkillNumber: 7,
              groupLevel: 4,
              linkedStatAverage: 14,
              relationshipGrantedSkillLevel: 1,
              skillId: "perception",
              specificSkillLevel: 2,
              totalSkill: 21,
            },
          ],
        },
      },
      skill: perceptionSkill,
    });

    expect(profile).toMatchObject({
      avgStats: 14,
      derivedXP: 1,
      groupXP: 4,
      known: true,
      rollBaseValue: 21,
      skillXP: 2,
      sourceQuality: "full",
      totalSkillLevel: 21,
      totalXP: 7,
      unknownSkillPenalty: 0,
      warning: undefined,
    });
  });

  it("falls back to linked stat average and -3 default penalty for unknown skills", () => {
    const profile = resolveParticipantSkillRollProfile({
      build,
      sheetSummary: {
        draftView: {
          skills: [],
        },
      },
      skill: surgerySkill,
    });

    expect(profile.known).toBe(false);
    expect(profile.avgStats).toBe(15);
    expect(profile.rollBaseValue).toBe(15);
    expect(profile.totalXP).toBe(0);
    expect(profile.unknownSkillPenalty).toBe(-3);
    expect(profile.warning).toContain("Skill not known");
  });

  it("rebuilds the Character Sheet summary from a scenario snapshot build for known skills", () => {
    const gladiatorBuild: CharacterBuild = {
      ...build,
      progression: {
        ...build.progression,
        skillGroups: [
          {
            gms: 0,
            groupId: "healing_practice",
            grantedRanks: 0,
            primaryRanks: 6,
            ranks: 6,
            secondaryRanks: 0,
          },
        ],
        skills: [
          {
            category: "secondary",
            grantedRanks: 0,
            groupId: "healing_practice",
            level: 2,
            primaryRanks: 0,
            ranks: 2,
            relationshipGrantedRanks: 0,
            secondaryRanks: 2,
            skillId: "first_aid",
          },
        ],
      },
    };

    const profile = resolveParticipantSkillRollProfile({
      build: gladiatorBuild,
      content,
      sheetSummary: {},
      skill: firstAidSkill,
    });

    expect(profile).toMatchObject({
      avgStats: 15,
      groupXP: 6,
      skillXP: 2,
      derivedXP: 0,
      totalXP: 8,
      totalSkillLevel: 23,
      rollBaseValue: 23,
      known: true,
      unknownSkillPenalty: 0,
      warning: undefined,
    });
  });

  it("counts group-only Character Sheet rows as known skills", () => {
    const profile = resolveParticipantSkillRollProfile({
      sheetSummary: {
        draftView: {
          groups: [{ groupId: "healing_practice", groupLevel: 6, name: "Healing Practice" }],
          skills: [
            {
              linkedStatAverage: 15,
              skillId: "first_aid",
              specificSkillLevel: 0,
            },
          ],
        },
      },
      skill: firstAidSkill,
    });

    expect(profile).toMatchObject({
      known: true,
      groupXP: 6,
      skillXP: 0,
      totalXP: 6,
      totalSkillLevel: 21,
      rollBaseValue: 21,
      warning: undefined,
    });
  });

  it("counts derived-only Character Sheet rows as known skills", () => {
    const profile = resolveParticipantSkillRollProfile({
      sheetSummary: {
        draftView: {
          groups: [],
          skills: [
            {
              linkedStatAverage: 15,
              relationshipGrantedSkillLevel: 4,
              skillId: "first_aid",
              specificSkillLevel: 0,
            },
          ],
        },
      },
      skill: firstAidSkill,
    });

    expect(profile).toMatchObject({
      known: true,
      derivedXP: 4,
      totalXP: 4,
      totalSkillLevel: 19,
      rollBaseValue: 19,
      warning: undefined,
    });
  });

  it("does not mutate snapshot skill data when resolving an unknown skill", () => {
    const sheetSummary = {
      draftView: {
        skills: [] as unknown[],
      },
    };

    resolveParticipantSkillRollProfile({
      build,
      sheetSummary,
      skill: surgerySkill,
    });

    expect(sheetSummary.draftView.skills).toEqual([]);
  });

  it("uses the selected support skill independently of the main skill", () => {
    const supportProfile = resolveParticipantSkillRollProfile({
      build,
      sheetSummary: {
        draftView: {
          skills: [
            {
              effectiveSkillNumber: 5,
              linkedStatAverage: 15,
              skillId: "surgery",
              totalSkill: 20,
            },
          ],
        },
      },
      skill: surgerySkill,
    });

    expect(supportProfile.known).toBe(true);
    expect(supportProfile.rollBaseValue).toBe(20);
  });

  it("keeps opponent participant skill snapshots separate from actor snapshots", () => {
    const actorProfile = resolveParticipantSkillRollProfile({
      build,
      sheetSummary: {
        draftView: {
          skills: [
            {
              effectiveSkillNumber: 2,
              linkedStatAverage: 14,
              skillId: "perception",
              totalSkill: 16,
            },
          ],
        },
      },
      skill: perceptionSkill,
    });
    const opponentProfile = resolveParticipantSkillRollProfile({
      build,
      sheetSummary: {
        draftView: {
          skills: [
            {
              effectiveSkillNumber: 9,
              linkedStatAverage: 14,
              skillId: "perception",
              totalSkill: 23,
            },
          ],
        },
      },
      skill: perceptionSkill,
    });

    expect(actorProfile.rollBaseValue).toBe(16);
    expect(opponentProfile.rollBaseValue).toBe(23);
  });

  it("uses generated temporary actor stats for unknown skills", () => {
    const profile = resolveParticipantSkillRollProfile({
      build: {
        actorClass: "generated_npc",
        generatedHumanoidNpc: {
          stats: {
            final: {
              cha: 10,
              com: 10,
              con: 10,
              dex: 11,
              health: 10,
              int: 14,
              lck: 10,
              pow: 16,
              siz: 10,
              str: 10,
              will: 10,
            },
          },
        },
      },
      skill: perceptionSkill,
    });

    expect(profile).toMatchObject({
      avgStats: 15,
      known: false,
      rollBaseValue: 15,
      sourceQuality: "snapshot",
      unknownSkillPenalty: -3,
    });
    expect(profile.warning).toContain("Skill not known");
  });

  it("uses generated temporary actor target levels for known skills", () => {
    const profile = resolveParticipantSkillRollProfile({
      build: {
        actorClass: "generated_npc",
        generatedHumanoidNpc: {
          skills: [{ skillId: "perception", skillName: "Perception", targetLevel: 18 }],
          stats: {
            final: {
              cha: 10,
              com: 10,
              con: 10,
              dex: 11,
              health: 10,
              int: 14,
              lck: 10,
              pow: 16,
              siz: 10,
              str: 10,
              will: 10,
            },
          },
        },
      },
      skill: perceptionSkill,
    });

    expect(profile).toMatchObject({
      avgStats: 15,
      known: true,
      rollBaseValue: 18,
      sourceQuality: "snapshot",
      totalSkillLevel: 18,
      unknownSkillPenalty: 0,
      warning: undefined,
    });
  });

  it("uses humanoid archetype snapshot stats for temporary actors created directly from templates", () => {
    const profile = resolveParticipantSkillRollProfile({
      build: {
        actorClass: "template",
        humanoidNpcArchetype: {
          stats: {
            final: {
              cha: 10,
              com: 10,
              con: 10,
              dex: 11,
              health: 10,
              int: 13,
              lck: 10,
              pow: 15,
              siz: 10,
              str: 10,
              will: 10,
            },
          },
        },
      },
      skill: perceptionSkill,
    });

    expect(profile).toMatchObject({
      avgStats: 14,
      known: false,
      rollBaseValue: 14,
      sourceQuality: "snapshot",
      unknownSkillPenalty: -3,
    });
  });

  it("returns a safe missing-source fallback for temporary actors without stats", () => {
    const profile = resolveParticipantSkillRollProfile({
      sheetSummary: {},
      skill: surgerySkill,
    });

    expect(profile).toMatchObject({
      avgStats: 0,
      known: false,
      rollBaseValue: 0,
      sourceQuality: "missing",
      unknownSkillPenalty: -3,
    });
    expect(profile.warning).toBe("No stats available for this actor.");
  });
});
