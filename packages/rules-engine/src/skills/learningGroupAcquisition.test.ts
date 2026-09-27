import { describe, expect, it } from "vitest";

import {
  calculateLearningGroupAcquisition,
  priceLearningGroupBundle,
} from "./learningGroupAcquisition";
import { calculatePilotLearningGroupBundle } from "./pilotSkillRulesV1";

describe("shared Learning Group acquisition arithmetic", () => {
  it("prices the complete bundle once with the canonical ceiling", () => {
    // docs/rules/pilot-skill-rules-v1.md section 4: group bundle cost = ceil(2/3 * weightedUseful).
    expect(priceLearningGroupBundle(0)).toBe(0);
    expect(priceLearningGroupBundle(1)).toBe(1);
    expect(priceLearningGroupBundle(6)).toBe(4);
    expect(priceLearningGroupBundle(7)).toBe(5);
  });

  it("counts only the strongest Group and charges nothing for a suppressed membership", () => {
    const result = calculateLearningGroupAcquisition({
      competencies: [{ competencyId: "sword", weight: 2 }],
      memberships: [
        { competencyId: "sword", groupId: "cityWatch", groupLevel: 4, groupName: "City Watch" },
        { competencyId: "sword", groupId: "veteran", groupLevel: 2, groupName: "Veteran" },
      ],
    });

    expect(result.byCompetencyId.sword).toMatchObject({
      bestGroupContribution: 4,
      bestGroupId: "cityWatch",
      usefulIncrementalCompetence: 4,
      weightedUsefulIncrement: 8,
    });
    expect(result.weightedUsefulIncrement).toBe(8);
    expect(result.bundleCost).toBe(6);
    expect(result.memberships.find((membership) => membership.groupId === "veteran")).toMatchObject(
      {
        selectedAsStrongest: false,
        suppressedByGroupId: "cityWatch",
        usefulIncrementalCompetence: 0,
        weightedUsefulIncrement: 0,
      },
    );
  });

  it("treats a relationship floor as a non-additive minimum, never an extra price", () => {
    const withoutFloor = calculateLearningGroupAcquisition({
      competencies: [{ competencyId: "firstAid", weight: 2 }],
      memberships: [
        { competencyId: "firstAid", groupId: "infirmary", groupLevel: 4, groupName: "Infirmary" },
      ],
    });
    const flooredExactly = calculateLearningGroupAcquisition({
      competencies: [{ competencyId: "firstAid", relationshipFloor: 4, weight: 2 }],
      memberships: [
        { competencyId: "firstAid", groupId: "infirmary", groupLevel: 4, groupName: "Infirmary" },
      ],
    });
    const flooredAbove = calculateLearningGroupAcquisition({
      competencies: [{ competencyId: "firstAid", relationshipFloor: 6, weight: 2 }],
      memberships: [
        { competencyId: "firstAid", groupId: "infirmary", groupLevel: 4, groupName: "Infirmary" },
      ],
    });

    expect(withoutFloor.bundleCost).toBe(6);
    expect(flooredExactly.bundleCost).toBe(0);
    expect(flooredExactly.byCompetencyId.firstAid?.usefulIncrementalCompetence).toBe(0);
    expect(flooredAbove.bundleCost).toBe(0);
    expect(flooredAbove.byCompetencyId.firstAid?.usefulIncrementalCompetence).toBe(0);
  });

  it("is order independent over the supplied memberships", () => {
    const memberships = [
      { competencyId: "sword", groupId: "a", groupLevel: 2, groupName: "A" },
      { competencyId: "sword", groupId: "b", groupLevel: 4, groupName: "B" },
      { competencyId: "shield", groupId: "b", groupLevel: 4, groupName: "B" },
    ];
    const competencies = [
      { competencyId: "shield", weight: 1 },
      { competencyId: "sword", weight: 2 },
    ];
    const forward = calculateLearningGroupAcquisition({ competencies, memberships });
    const reversed = calculateLearningGroupAcquisition({
      competencies: [...competencies].reverse(),
      memberships: [...memberships].reverse(),
    });

    expect(forward).toEqual(reversed);
    // Group A adds nothing over Group B, so the bundle is ceil(2/3 * (4*2 + 4*1)) = 8.
    expect(forward.bundleCost).toBe(8);
  });

  it("is the same arithmetic the Pilot v1 group bundle reports", () => {
    const pilot = calculatePilotLearningGroupBundle({
      competencies: [
        { id: "shield", kind: "skill", name: "Shield", weight: 1 },
        { id: "sword", kind: "skill", name: "Sword", weight: 2 },
      ],
      groups: [
        { competencyIds: ["sword"], id: "a", level: 2, name: "A" },
        { competencyIds: ["shield", "sword"], id: "b", level: 4, name: "B" },
      ],
    });
    const shared = calculateLearningGroupAcquisition({
      competencies: [
        { competencyId: "shield", weight: 1 },
        { competencyId: "sword", weight: 2 },
      ],
      memberships: [
        { competencyId: "sword", groupId: "a", groupLevel: 2, groupName: "A" },
        { competencyId: "shield", groupId: "b", groupLevel: 4, groupName: "B" },
        { competencyId: "sword", groupId: "b", groupLevel: 4, groupName: "B" },
      ],
    });

    expect(pilot.bundleCost).toBe(shared.bundleCost);
    expect(pilot.weightedUsefulIncrement).toBe(shared.weightedUsefulIncrement);
    expect(pilot.memberships).toEqual(shared.memberships);
  });
});
