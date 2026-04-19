import { describe, expect, it } from "vitest";

import {
  filterProfessionBrowseItems,
  filterSpecializationBrowseItems,
  getSkillAccessSourceLabels,
  getPlayerFacingSkillBucket,
  isRelevantSpecializationBrowseItem,
  matchesSkillBrowseFilters
} from "./chargenBrowse";

describe("chargenBrowse helpers", () => {
  it("filters professions by family and search text", () => {
    const items = [
      {
        description: "Records temple law and scripture.",
        familyName: "Scholar / Scribe",
        id: "temple_scribe",
        name: "Temple Scribe"
      },
      {
        description: "Keeps caravans moving.",
        familyName: "Merchant / Trader",
        id: "local_trader",
        name: "Local Trader"
      }
    ];

    expect(
      filterProfessionBrowseItems({
        familyFilter: "Merchant / Trader",
        items,
        search: "local"
      }).map((item) => item.id)
    ).toEqual(["local_trader"]);
  });

  it("orders and deduplicates skill access source labels", () => {
    expect(
      getSkillAccessSourceLabels([
        "society-skill",
        "profession-group",
        "profession-skill",
        "profession-group"
      ])
    ).toEqual(["Direct profession skill", "Profession group", "Society access"]);
  });

  it("matches skill browse filters for owned, blocked, and purchasable rows", () => {
    expect(
      matchesSkillBrowseFilters({
        isAllowed: true,
        isOwned: false,
        name: "Lockpicking",
        search: "lock",
        visibilityFilter: "purchasable"
      })
    ).toBe(true);
    expect(
      matchesSkillBrowseFilters({
        isAllowed: false,
        isOwned: false,
        name: "Lockpicking",
        search: "lock",
        visibilityFilter: "blocked"
      })
    ).toBe(true);
    expect(
      matchesSkillBrowseFilters({
        isAllowed: true,
        isOwned: true,
        name: "Lockpicking",
        search: "lock",
        visibilityFilter: "owned"
      })
    ).toBe(true);
  });

  it("hides fully blocked specializations by default but keeps near-relevant ones", () => {
    const blockedFar = {
      evaluation: {
        advisories: [],
        blockingReasons: [{ message: "Requires Parry." }],
        isAllowed: false,
        warnings: []
      },
      parentSkillLevel: 0,
      specializationLevel: 0,
      specializationName: "Fencing"
    };
    const blockedNear = {
      evaluation: {
        advisories: [],
        blockingReasons: [{ message: "Needs parent level 3." }],
        isAllowed: false,
        warnings: []
      },
      parentSkillLevel: 2,
      specializationLevel: 0,
      specializationName: "Longbow"
    };

    expect(isRelevantSpecializationBrowseItem(blockedFar)).toBe(false);
    expect(isRelevantSpecializationBrowseItem(blockedNear)).toBe(true);
    expect(
      filterSpecializationBrowseItems({
        includeBlocked: false,
        items: [blockedFar, blockedNear],
        search: ""
      }).map((item) => item.specializationName)
    ).toEqual(["Longbow"]);
  });

  it("can reveal blocked specializations when requested", () => {
    const items = [
      {
        evaluation: {
          advisories: [],
          blockingReasons: [{ message: "Missing parent." }],
          isAllowed: false,
          warnings: []
        },
        parentSkillLevel: 0,
        specializationLevel: 0,
        specializationName: "Crossbow"
      }
    ];

    expect(
      filterSpecializationBrowseItems({
        includeBlocked: true,
        items,
        search: "cross"
      }).map((item) => item.specializationName)
    ).toEqual(["Crossbow"]);
  });

  it("classifies mounted warrior weapon skills as combat", () => {
    expect(
      getPlayerFacingSkillBucket({
        categoryId: "combat",
        groupId: "mounted_warrior_training",
        groupIds: ["mounted_warrior_training", "combat_group"],
        id: "one_handed_edged"
      })
    ).toBe("combat");

    expect(
      getPlayerFacingSkillBucket({
        categoryId: "combat",
        groupId: "mounted_warrior_training",
        groupIds: ["mounted_warrior_training", "combat_group"],
        id: "lance"
      })
    ).toBe("combat");
  });

  it("prefers explicit skill category over legacy group inference", () => {
    expect(
      getPlayerFacingSkillBucket({
        categoryId: "fieldcraft",
        groupId: "combat_group",
        groupIds: ["combat_group"],
        id: "test_skill"
      })
    ).toBe("fieldcraft");
  });
});
