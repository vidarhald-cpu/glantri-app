import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";

import {
  buildChargenSkillAccessSummary,
  createChargenProgression,
  getAllowedSecondaryGroupIds,
  spendPrimaryPoint,
  spendSecondaryPoint
} from "./primaryAllocation";

function createFlexibleProgression() {
  return {
    ...createChargenProgression(),
    secondaryPoolTotal: 20
  };
}

describe("imported content chargen integration", () => {
  it("exposes imported professions in society access", () => {
    const importedProfessionIds = new Set(defaultCanonicalContent.professions.map((profession) => profession.id));

    expect(importedProfessionIds.has("temple_scribe")).toBe(true);
    expect(importedProfessionIds.has("merchant")).toBe(true);
    expect(importedProfessionIds.has("military_officer")).toBe(true);
    expect(
      defaultCanonicalContent.societyLevels.some((societyLevel) =>
        societyLevel.professionIds.includes("temple_scribe")
      )
    ).toBe(true);
  });

  it("allows at least one imported ordinary skill purchase through chargen", () => {
    let purchase:
      | ReturnType<typeof spendPrimaryPoint>
      | undefined;

    for (const societyLevel of defaultCanonicalContent.societyLevels) {
      for (const professionId of societyLevel.professionIds) {
        const access = buildChargenSkillAccessSummary({
          content: defaultCanonicalContent,
          professionId,
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel
        });
        const skill = defaultCanonicalContent.skills.find(
          (candidate) =>
            access.normalSkillIds.includes(candidate.id) && candidate.category === "ordinary"
        );

        if (!skill) {
          continue;
        }

        purchase = spendPrimaryPoint({
          content: defaultCanonicalContent,
          professionId,
          progression: createChargenProgression(),
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel,
          targetId: skill.id,
          targetType: "skill"
        });

        if (!purchase.error) {
          break;
        }
      }

      if (purchase && !purchase.error) {
        break;
      }
    }

    expect(purchase?.error).toBeUndefined();
    expect(purchase?.spentCost).toBe(2);
  });

  it("allows at least one imported secondary skill purchase through chargen", () => {
    let purchase:
      | ReturnType<typeof spendSecondaryPoint>
      | undefined;

    for (const societyLevel of defaultCanonicalContent.societyLevels.filter(
      (row) => row.societyLevel < 4
    )) {
      const allowedSecondaryGroupIds = getAllowedSecondaryGroupIds(
        defaultCanonicalContent,
        societyLevel.societyId,
        societyLevel.societyLevel
      );
      const skill = defaultCanonicalContent.skills.find(
        (candidate) =>
          candidate.category === "secondary" &&
          candidate.groupIds.some((groupId) => allowedSecondaryGroupIds.includes(groupId))
      );

      if (!skill) {
        continue;
      }

      purchase = spendSecondaryPoint({
        content: defaultCanonicalContent,
        progression: createFlexibleProgression(),
        societyId: societyLevel.societyId,
        societyLevel: societyLevel.societyLevel,
        targetId: skill.id,
        targetType: "skill"
      });

      if (!purchase.error) {
        break;
      }
    }

    expect(purchase?.error).toBeUndefined();
    expect(purchase?.spentCost).toBe(1);
  });

  it("allows at least one imported specialization purchase through chargen when the gate is satisfied", () => {
    let purchase:
      | ReturnType<typeof spendSecondaryPoint>
      | undefined;

    for (const societyLevel of defaultCanonicalContent.societyLevels.filter(
      (row) => row.societyLevel < 4
    )) {
      const allowedSecondaryGroupIds = getAllowedSecondaryGroupIds(
        defaultCanonicalContent,
        societyLevel.societyId,
        societyLevel.societyLevel
      );

      for (const specialization of defaultCanonicalContent.specializations) {
        const parentSkill = defaultCanonicalContent.skills.find(
          (skill) => skill.id === specialization.skillId
        );
        const parentGroupId = parentSkill?.groupIds.find((groupId) =>
          allowedSecondaryGroupIds.includes(groupId)
        );

        if (!parentSkill || !parentGroupId) {
          continue;
        }

        purchase = spendSecondaryPoint({
          content: defaultCanonicalContent,
          progression: {
            ...createFlexibleProgression(),
            skillGroups: [
              {
                gms: 0,
                grantedRanks: 0,
                groupId: parentGroupId,
                primaryRanks: 1,
                secondaryRanks: 0,
                ranks: 1
              }
            ],
            skills: [
              {
                category: parentSkill.category,
                grantedRanks: 0,
                groupId: parentSkill.groupId,
                level: specialization.minimumParentLevel,
                primaryRanks: specialization.minimumParentLevel,
                ranks: specialization.minimumParentLevel,
                secondaryRanks: 0,
                skillId: parentSkill.id
              }
            ]
          },
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel,
          targetId: specialization.id,
          targetType: "specialization"
        });

        if (!purchase.error) {
          break;
        }
      }

      if (purchase && !purchase.error) {
        break;
      }
    }

    expect(purchase?.error).toBeUndefined();
    expect(purchase?.spentCost).toBeGreaterThan(0);
  });

  it("exposes literacy through society-band foundational access only when the selected band allows it", () => {
    const levelThreeAccess = buildChargenSkillAccessSummary({
      content: defaultCanonicalContent,
      professionId: "temple_scribe",
      societyId: "bronze_age_palace_state",
      societyLevel: 4
    });
    const levelTwoAccess = buildChargenSkillAccessSummary({
      content: defaultCanonicalContent,
      professionId: "merchant",
      societyId: "pastoral_clan_nomadic",
      societyLevel: 4
    });

    expect(levelThreeAccess.normalSkillIds).toContain("literacy");
    expect(levelTwoAccess.normalSkillIds).not.toContain("literacy");
  });
});
