import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";
import type { CharacterBuild } from "@glantri/domain";

import {
  addCharacterProgressionCheck,
  approveCharacterProgressionCheck,
  buildCharacterProgressionView,
  buyCharacterProgressionAttempt,
  grantCharacterProgressionPoints,
  requestCharacterProgressionCheck,
  resolveCharacterProgressionAttempts,
  rollOpenEndedProgressionD20,
  spendAdvancementPoint
} from "./advanceCharacter";
import { buildCharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";

const content = validateCanonicalContent({
  professionFamilies: [{ id: "scholar", name: "Scholar" }],
  professions: [{ familyId: "scholar", id: "scribe", name: "Scribe", subtypeName: "Scribe" }],
  professionSkills: [],
  skillGroups: [
    {
      id: "scholarly",
      name: "Scholarly",
      skillMemberships: [{ relevance: "core", skillId: "lore" }],
      sortOrder: 1
    },
    {
      id: "slot_group",
      name: "Slot Group",
      selectionSlots: [
        {
          candidateSkillIds: ["lore", "knife"],
          chooseCount: 1,
          id: "slot_choice",
          label: "Choose one",
          required: true
        }
      ],
      skillMemberships: [{ relevance: "core", skillId: "focus" }],
      sortOrder: 2
    },
    {
      id: "physical_group",
      name: "Physical Group",
      skillMemberships: [{ relevance: "core", skillId: "swim" }],
      sortOrder: 3
    }
  ],
  skills: [
    {
      allowsSpecializations: true,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "scholarly",
      groupIds: ["scholarly", "slot_group"],
      id: "lore",
      linkedStats: ["int"],
      name: "Lore",
      requiresLiteracy: "no",
      sortOrder: 1
    },
    {
      allowsSpecializations: false,
      category: "secondary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "slot_group",
      groupIds: ["slot_group"],
      id: "knife",
      linkedStats: ["dex"],
      name: "Knife",
      requiresLiteracy: "no",
      sortOrder: 2
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "slot_group",
      groupIds: ["slot_group"],
      id: "focus",
      linkedStats: ["int"],
      name: "Focus",
      requiresLiteracy: "no",
      sortOrder: 3
    },
    {
      allowsSpecializations: false,
      category: "ordinary",
      dependencies: [],
      dependencySkillIds: [],
      groupId: "physical_group",
      groupIds: ["physical_group"],
      id: "swim",
      linkedStats: ["str"],
      name: "Swim",
      requiresLiteracy: "no",
      sortOrder: 4
    }
  ],
  societyLevels: [],
  specializations: [
    {
      id: "codes",
      minimumGroupLevel: 1,
      minimumParentLevel: 1,
      name: "Codes",
      skillId: "lore",
      sortOrder: 1
    }
  ]
});

function createBuild(): CharacterBuild {
  return {
    equipment: { items: [] },
    id: "character-1",
    name: "Progressor",
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: []
    },
    profile: {
      distractionLevel: 3,
      id: "profile-1",
      label: "Profile 1",
      resolvedStats: {
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
      chargenMode: "standard",
      chargenSelections: {
        selectedGroupSlots: [
          {
            groupId: "slot_group",
            selectedSkillIds: ["knife"],
            slotId: "slot_choice"
          }
        ],
        selectedLanguageIds: [],
        selectedSkillIds: []
      },
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: [
        {
          gms: 0,
          grantedRanks: 0,
          groupId: "scholarly",
          primaryRanks: 5,
          ranks: 5,
          secondaryRanks: 0
        },
        {
          gms: 0,
          grantedRanks: 0,
          groupId: "slot_group",
          primaryRanks: 1,
          ranks: 1,
          secondaryRanks: 0
        }
      ],
      skills: [
        {
          category: "ordinary",
          categoryId: "knowledge",
          grantedRanks: 0,
          groupId: "scholarly",
          level: 0,
          primaryRanks: 3,
          ranks: 12,
          relationshipGrantedRanks: 4,
          secondaryRanks: 0,
          skillId: "lore"
        }
      ],
      specializations: [
        {
          level: 0,
          ranks: 2,
          secondaryRanks: 2,
          skillId: "lore",
          specializationId: "codes"
        }
      ]
    }
  };
}

function rngFromRolls(d20: number, d10s: number[] = []): () => number {
  const rolls = [(d20 - 0.5) / 20, ...d10s.map((roll) => (roll - 0.5) / 10)];
  return () => rolls.shift() ?? 0;
}

describe("character progression rolls", () => {
  it.each([
    { d10s: [], d20: 12, total: 12 },
    { d10s: [4], d20: 20, total: 24 },
    { d10s: [10, 1], d20: 20, total: 31 },
    { d10s: [10, 10, 5], d20: 20, total: 45 }
  ])("rolls open-ended d20 totals", ({ d10s, d20, total }) => {
    const result = rollOpenEndedProgressionD20(rngFromRolls(d20, d10s));

    expect(result.rollTotal).toBe(total);
  });

  it("uses total skill XP, not total skill level, as the skill threshold", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: rngFromRolls(12)
    });

    expect(purchased.error).toBeUndefined();
    expect(resolved.history[0]).toMatchObject({
      afterValue: 13,
      beforeValue: 12,
      rollD20: 12,
      rollTotal: 12,
      success: true,
      threshold: 12
    });
  });

  it("fails when the d20 roll is below threshold", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: rngFromRolls(11)
    });

    expect(resolved.history[0]).toMatchObject({
      afterValue: 12,
      beforeValue: 12,
      rollD20: 11,
      rollTotal: 11,
      success: false,
      threshold: 12
    });
  });

  it.each([
    { d10s: [], d20: 20, threshold: 20, success: true },
    { d10s: [4], d20: 20, threshold: 24, success: true },
    { d10s: [10, 1], d20: 20, threshold: 31, success: true },
    { d10s: [10, 10, 5], d20: 20, threshold: 45, success: true },
    { d10s: [10, 10, 4], d20: 20, threshold: 45, success: false }
  ])("records open-ended success and failure against threshold", ({ d10s, d20, success, threshold }) => {
    const build = createBuild();
    build.progression.skillGroups[0] = {
      ...build.progression.skillGroups[0]!,
      primaryRanks: threshold,
      ranks: threshold
    };
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 1, build }),
      content,
      targetId: "scholarly",
      targetType: "skillGroup"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "scholarly",
      targetType: "skillGroup"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: rngFromRolls(d20, d10s)
    });

    expect(resolved.history[0]).toMatchObject({
      success,
      threshold
    });
  });
});

describe("character progression state", () => {
  it("ignores invalid check targets", () => {
    const build = createBuild();
    const withInvalidSkill = addCharacterProgressionCheck({
      build,
      content,
      targetId: "missing_skill",
      targetType: "skill"
    });
    const withInvalidGroup = addCharacterProgressionCheck({
      build: withInvalidSkill,
      content,
      targetId: "missing_group",
      targetType: "skillGroup"
    });
    const withInvalidSpecialization = addCharacterProgressionCheck({
      build: withInvalidGroup,
      content,
      targetId: "missing_specialization",
      targetType: "specialization"
    });
    const withInvalidStat = addCharacterProgressionCheck({
      build: withInvalidSpecialization,
      content,
      targetId: "not_a_stat",
      targetType: "stat"
    });

    expect(withInvalidStat.progressionState?.checks ?? []).toHaveLength(0);
  });

  it("requires checks before buying attempts and deducts progression points", () => {
    const unchecked = grantCharacterProgressionPoints({ amount: 2, build: createBuild() });
    const rejected = buyCharacterProgressionAttempt({
      build: unchecked,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const checked = addCharacterProgressionCheck({
      build: unchecked,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "lore",
      targetType: "skill"
    });

    expect(rejected.error).toContain("GM-approved check");
    expect(purchased.error).toBeUndefined();
    expect(purchased.build.progressionState?.availablePoints).toBe(0);
    expect(purchased.build.progressionState?.pendingAttempts).toHaveLength(1);
  });

  it("shows full progression rows even before checks exist", () => {
    const view = buildCharacterProgressionView({
      build: createBuild(),
      content
    });

    expect(view.rows.some((row) => row.targetType === "stat" && row.targetId === "str")).toBe(true);
    expect(view.rows.some((row) => row.targetType === "skillGroup" && row.targetId === "scholarly")).toBe(true);
    expect(view.rows.some((row) => row.targetType === "skill" && row.targetId === "lore")).toBe(true);
    expect(view.rows.some((row) => row.targetType === "specialization" && row.targetId === "codes")).toBe(true);
  });

  it("lets players request checks but requires GM approval before buying attempts", () => {
    const requested = requestCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const requestedView = buildCharacterProgressionView({ build: requested, content });
    const requestedRow = requestedView.rows.find(
      (row) => row.targetType === "skill" && row.targetId === "lore"
    );
    const rejected = buyCharacterProgressionAttempt({
      build: requested,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const approved = approveCharacterProgressionCheck({
      build: requested,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const approvedView = buildCharacterProgressionView({ build: approved, content });
    const approvedRow = approvedView.rows.find(
      (row) => row.targetType === "skill" && row.targetId === "lore"
    );
    const purchased = buyCharacterProgressionAttempt({
      build: approved,
      content,
      targetId: "lore",
      targetType: "skill"
    });

    expect(requested.progressionState?.checks[0]).toMatchObject({ status: "requested" });
    expect(requestedRow).toMatchObject({
      approved: false,
      checked: false,
      requested: true
    });
    expect(rejected.error).toBe("This target needs a GM-approved check before buying a progression attempt.");
    expect(approved.progressionState?.checks[0]).toMatchObject({ status: "approved" });
    expect(approvedRow).toMatchObject({
      approved: true,
      checked: true,
      requested: false
    });
    expect(purchased.error).toBeUndefined();
    expect(purchased.build.progressionState?.availablePoints).toBe(0);
  });

  it("shows requested and approved provisional skills in the progression view", () => {
    const requested = requestCharacterProgressionCheck({
      build: createBuild(),
      content,
      provisional: true,
      targetId: "swim",
      targetType: "skill"
    });
    const requestedView = buildCharacterProgressionView({ build: requested, content });
    const requestedRow = requestedView.rows.find(
      (row) => row.targetType === "skill" && row.targetId === "swim"
    );
    const approved = approveCharacterProgressionCheck({
      build: requested,
      content,
      targetId: "swim",
      targetType: "skill"
    });
    const approvedView = buildCharacterProgressionView({ build: approved, content });
    const approvedRow = approvedView.rows.find(
      (row) => row.targetType === "skill" && row.targetId === "swim"
    );

    expect(requestedRow).toMatchObject({
      approved: false,
      currentValue: 0,
      label: "Swim",
      provisional: true,
      requested: true
    });
    expect(approvedRow).toMatchObject({
      approved: true,
      currentValue: 0,
      label: "Swim",
      provisional: true,
      requested: false
    });
  });

  it("does not leak an older pending attempt cost through the legacy spend wrapper", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const rejected = spendAdvancementPoint({
      build: purchased.build,
      content,
      targetId: "swim",
      targetType: "skill"
    });

    expect(purchased.attempt?.cost).toBe(2);
    expect(rejected.error).toContain("GM-approved check");
    expect(rejected.spentCost).toBeUndefined();
  });

  it("allows negative point grants as a clamped GM correction", () => {
    const credited = grantCharacterProgressionPoints({ amount: 5, build: createBuild() });
    const corrected = grantCharacterProgressionPoints({ amount: -7, build: credited });

    expect(corrected.progressionState?.availablePoints).toBe(0);
  });

  it("prices skill groups from active fixed and selected slot skills", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 3, build: createBuild() }),
      content,
      targetId: "slot_group",
      targetType: "skillGroup"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "slot_group",
      targetType: "skillGroup"
    });

    expect(purchased.error).toBeUndefined();
    expect(purchased.build.progressionState?.availablePoints).toBe(2);
    expect(purchased.build.progressionState?.pendingAttempts[0]?.cost).toBe(1);
  });

  it("shows provisional skill checks with 0 XP and makes them real on success", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      provisional: true,
      targetId: "swim",
      targetType: "skill"
    });
    const view = buildCharacterProgressionView({
      build: checked,
      content
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "swim",
      targetType: "skill"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: rngFromRolls(1)
    });

    expect(view.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentValue: 0,
          label: "Swim",
          provisional: true,
          targetId: "swim"
        })
      ])
    );
    expect(resolved.history[0]).toMatchObject({
      afterValue: 1,
      beforeValue: 0,
      success: true
    });
    expect(resolved.build.progression.skills.find((skill) => skill.skillId === "swim")?.ranks).toBe(1);
  });

  it("records failed provisional skill attempts without creating a direct skill row and consumes the check", () => {
    const build = createBuild();
    build.progression.skills = [];
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build }),
      content,
      provisional: true,
      targetId: "lore",
      targetType: "skill"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "lore",
      targetType: "skill"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: rngFromRolls(4)
    });

    expect(resolved.history[0]).toMatchObject({
      beforeValue: 5,
      success: false,
      threshold: 5
    });
    expect(resolved.build.progression.skills.find((skill) => skill.skillId === "lore")).toBeUndefined();
    expect(resolved.build.progressionState?.checks).toHaveLength(0);
  });

  it("uses specialization total as threshold", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      targetId: "codes",
      targetType: "specialization"
    });
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "codes",
      targetType: "specialization"
    });
    const resolved = resolveCharacterProgressionAttempts({
      build: purchased.build,
      content,
      rng: rngFromRolls(4)
    });

    expect(resolved.history[0]).toMatchObject({
      beforeValue: 4,
      success: true,
      threshold: 4
    });
  });

  it("keeps stat checks visible but not spendable in v1", () => {
    const checked = addCharacterProgressionCheck({
      build: grantCharacterProgressionPoints({ amount: 2, build: createBuild() }),
      content,
      targetId: "str",
      targetType: "stat"
    });
    const view = buildCharacterProgressionView({
      build: checked,
      content
    });
    const row = view.rows.find(
      (candidate) => candidate.targetType === "stat" && candidate.targetId === "str"
    );
    const purchased = buyCharacterProgressionAttempt({
      build: checked,
      content,
      targetId: "str",
      targetType: "stat"
    });

    expect(row).toMatchObject({
      checked: true,
      currentValue: 10,
      disabledReason: "Stat advancement is not enabled yet."
    });
    expect(purchased.error).toBe("Stat advancement is not enabled yet.");
  });

  it("records stale pending stat attempts as failed no-ops", () => {
    const checked = addCharacterProgressionCheck({
      build: createBuild(),
      content,
      targetId: "str",
      targetType: "stat"
    });
    const statCheck = checked.progressionState?.checks[0];
    const malformed = {
      ...checked,
      progressionState: {
        availablePoints: 0,
        checks: checked.progressionState?.checks ?? [],
        history: [],
        pendingAttempts: statCheck
          ? [
              {
                checkId: statCheck.id,
                cost: 1,
                id: "attempt-stat",
                purchasedAt: "2026-01-01T00:00:00.000Z",
                targetId: "str",
                targetLabel: "STR",
                targetType: "stat" as const
              }
            ]
          : []
      }
    };
    const resolved = resolveCharacterProgressionAttempts({
      build: malformed,
      content,
      rng: rngFromRolls(20, [10, 10, 5])
    });

    expect(resolved.history[0]).toMatchObject({
      afterValue: 10,
      beforeValue: 10,
      rollTotal: 45,
      success: false,
      threshold: 10
    });
    expect(resolved.build.progressionState?.pendingAttempts).toHaveLength(0);
    expect(resolved.build.progressionState?.checks).toHaveLength(0);
  });

  it("counts only successful resolved progression costs as current skill-point gains", () => {
    const build: CharacterBuild = {
      ...createBuild(),
      progression: {
        ...createBuild().progression,
        primaryPoolSpent: 10,
        secondaryPoolSpent: 3
      },
      progressionState: {
        availablePoints: 99,
        checks: [],
        history: [
          {
            afterValue: 13,
            beforeValue: 12,
            cost: 2,
            id: "history-success",
            openEndedD10s: [],
            resolvedAt: "2026-01-01T00:00:00.000Z",
            rollD20: 12,
            rollTotal: 12,
            success: true,
            targetId: "lore",
            targetLabel: "Lore",
            targetType: "skill",
            threshold: 12
          },
          {
            afterValue: 12,
            beforeValue: 12,
            cost: 2,
            id: "history-failure",
            openEndedD10s: [],
            resolvedAt: "2026-01-01T00:00:00.000Z",
            rollD20: 11,
            rollTotal: 11,
            success: false,
            targetId: "lore",
            targetLabel: "Lore",
            targetType: "skill",
            threshold: 12
          }
        ],
        pendingAttempts: [
          {
            checkId: "check-pending",
            cost: 4,
            id: "attempt-pending",
            purchasedAt: "2026-01-01T00:00:00.000Z",
            targetId: "codes",
            targetLabel: "Codes",
            targetType: "specialization"
          }
        ]
      }
    };
    const summary = buildCharacterSheetSummary({ build, content });

    expect(summary.skillPoints).toEqual({
      current: 15,
      original: 13,
      successfulProgressionGains: 2
    });
  });
});
