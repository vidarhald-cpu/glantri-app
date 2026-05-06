import { describe, expect, it } from "vitest";

import { validateCanonicalContent } from "@glantri/content";
import type { RolledCharacterProfile } from "@glantri/domain";

import { buildChargenDraftView, createChargenProgression } from "./primaryAllocation";
import { generateProfiles } from "./generateProfiles";
import {
  applyChargenStatBuild,
  applyChargenStatExchange,
  buildResolvedProfile,
  createChargenStatAdjustmentState,
  resolveGlantriCharacterStats
} from "./statResolution";

describe("chargen stat resolution", () => {
  it("uses rule-set stat roll and exchange counts without changing social/distraction rolls", () => {
    const profiles = generateProfiles({
      rng: () => 0.5,
      ruleSet: {
        exchangeCount: 1,
        flexiblePointFactor: 1,
        ordinarySkillPoints: 60,
        statRollCount: 3
      }
    });
    const initialState = createChargenStatAdjustmentState(profiles[0].rolledStats);
    const firstExchange = applyChargenStatExchange({
      firstStat: "str",
      policy: {
        displayedRollCount: 3,
        flexiblePointFactor: 1,
        maxBuilds: 2,
        maxExchanges: 1,
        primaryPoolTotal: 60,
        secondaryPoolTotal: 0
      },
      secondStat: "dex",
      state: initialState
    });
    const secondExchange = applyChargenStatExchange({
      firstStat: "con",
      policy: {
        displayedRollCount: 3,
        flexiblePointFactor: 1,
        maxBuilds: 2,
        maxExchanges: 1,
        primaryPoolTotal: 60,
        secondaryPoolTotal: 0
      },
      secondStat: "int",
      state: firstExchange.state
    });

    expect(profiles).toHaveLength(3);
    expect(profiles[0].socialClassRoll).toBeGreaterThan(0);
    expect(profiles[0].distractionLevel).toBeGreaterThan(0);
    expect(firstExchange.error).toBeUndefined();
    expect(secondExchange.error).toBe("You can exchange stats at most 1 times.");
  });

  it("uses a single d20 roll for social class", () => {
    const rolls = [0, 0.99, 0.99];
    const [profile] = generateProfiles({
      rollSets: [
        {
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
        }
      ],
      rng: () => rolls.shift() ?? 0
    });

    expect(profile.socialClassRoll).toBe(1);
    expect(profile.socialClassResult).toBe("Bønder");
    expect(profile.distractionLevel).toBe(6);
  });

  it("keeps generated profile rolls raw until the resolution stage", () => {
    const [profile] = generateProfiles({
      rollSets: [
        {
          cha: 12,
          com: 15,
          con: 14,
          dex: 11,
          health: 10,
          int: 9,
          lck: 8,
          pow: 13,
          siz: 16,
          str: 10,
          will: 7
        }
      ]
    });

    expect(profile.rolledStats).toMatchObject({
      cha: 12,
      dex: 11,
      health: 10,
      str: 10
    });
    expect(profile.resolvedStats).toBeUndefined();
  });

  it("applies exchange and build limits while preserving adjusted base stats", () => {
    const initialState = createChargenStatAdjustmentState({
      cha: 10,
      com: 11,
      con: 12,
      dex: 13,
      health: 14,
      int: 15,
      lck: 16,
      pow: 17,
      siz: 18,
      str: 9,
      will: 8
    });

    const exchanged = applyChargenStatExchange({
      firstStat: "str",
      secondStat: "dex",
      state: initialState
    });
    const built = applyChargenStatBuild({
      decreaseStat: "pow",
      increaseStat: "str",
      state: exchanged.state
    });

    expect(exchanged.error).toBeUndefined();
    expect(exchanged.state.exchangesUsed).toBe(1);
    expect(exchanged.state.stats.str).toBe(13);
    expect(exchanged.state.stats.dex).toBe(9);
    expect(built.error).toBeUndefined();
    expect(built.state.buildsUsed).toBe(1);
    expect(built.state.stats.str).toBe(14);
    expect(built.state.stats.pow).toBe(15);
  });

  it("rejects invalid exchange and build operations cleanly", () => {
    const initialState = createChargenStatAdjustmentState({
      cha: 10,
      com: 11,
      con: 12,
      dex: 13,
      health: 14,
      int: 15,
      lck: 16,
      pow: 17,
      siz: 18,
      str: 9,
      will: 8
    });

    expect(
      applyChargenStatExchange({
        firstStat: "str",
        secondStat: "str",
        state: initialState
      }).error
    ).toBe("Choose two different stats to exchange.");
    expect(
      applyChargenStatBuild({
        decreaseStat: "str",
        increaseStat: "str",
        state: initialState
      }).error
    ).toBe("Choose different stats when building.");
  });

  it("resolves workbook-backed stat modifiers only after the adjusted base stats are finalized", () => {
    expect(
      resolveGlantriCharacterStats({
        cha: 12,
        com: 15,
        con: 14,
        dex: 11,
        health: 10,
        int: 9,
        lck: 8,
        pow: 13,
        siz: 16,
        str: 10,
        will: 7
      })
    ).toMatchObject({
      cha: 14,
      dex: 10,
      health: 11,
      str: 12
    });
  });

  it("uses resolved stats for downstream linked-stat calculations while storing adjusted base stats", () => {
    const profile: RolledCharacterProfile = buildResolvedProfile({
      adjustedStats: {
        cha: 12,
        com: 15,
        con: 14,
        dex: 11,
        health: 10,
        int: 9,
        lck: 8,
        pow: 13,
        siz: 16,
        str: 10,
        will: 7
      },
      profile: {
        distractionLevel: 3,
        id: "profile-1",
        label: "Roll 1",
        rolledStats: {
          cha: 12,
          com: 15,
          con: 14,
          dex: 11,
          health: 10,
          int: 9,
          lck: 8,
          pow: 13,
          siz: 16,
          str: 10,
          will: 7
        },
        societyLevel: 0
      }
    });

    const draftView = buildChargenDraftView({
      content: validateCanonicalContent({
        professionFamilies: [],
        professionSkills: [],
        professions: [],
        skillGroups: [
          {
            description: "Martial",
            id: "martial",
            name: "Martial",
            sortOrder: 1
          }
        ],
        skills: [
          {
            allowsSpecializations: false,
            category: "ordinary",
            dependencies: [],
            dependencySkillIds: [],
            groupId: "martial",
            groupIds: ["martial"],
            id: "blade",
            isTheoretical: false,
            linkedStats: ["str", "dex"],
            name: "Blade",
            requiresLiteracy: "no",
            societyLevel: 1,
            sortOrder: 1
          }
        ],
        societyLevels: [],
        specializations: []
      }),
      profile,
      progression: {
        ...createChargenProgression(),
        skills: [
          {
            category: "ordinary",
            grantedRanks: 0,
            groupId: "martial",
            level: 0,
            primaryRanks: 1,
            ranks: 1,
            secondaryRanks: 0,
            skillId: "blade"
          }
        ]
      }
    });

    expect(profile.rolledStats.str).toBe(10);
    expect(profile.resolvedStats?.str).toBe(12);
    expect(draftView.skills[0]?.linkedStatAverage).toBe(11);
  });
});
