import { describe, expect, it } from "vitest";

import { resolveParticipantSkillRollProfile } from "./resolveParticipantSkillRollProfile";

const perceptionSkill = {
  id: "perception",
  linkedStats: ["int", "pow"],
  name: "Perception",
};

const surgerySkill = {
  id: "surgery",
  linkedStats: ["dex", "int"],
  name: "Surgery",
};

const build = {
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
  },
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
    expect(profile.warning).toContain("Linked stats could not be resolved");
  });
});
