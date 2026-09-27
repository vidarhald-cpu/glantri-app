import { describe, expect, it } from "vitest";
import { getApprovedTargetChargenContent } from "@glantri/content";

import { allocateChargenPoint, createChargenProgression } from "./primaryAllocation";
import { buildChargenSkillAccessSummary } from "./primaryAllocation/access";
import { getActiveGroupSkillCost } from "./primaryAllocation/costs";
import { getBestPurchasedParentGroup } from "./primaryAllocation/_helpers";

const content = getApprovedTargetChargenContent();
/**
 * `profession:smith` reaches both F24 (Smithing + one more base member) and G13
 * (Smithing alone), so G13's active membership is a strict subset of F24's. This is the
 * canonical overlap shape from Forgejo #381: `docs/rules/pilot-skill-rules-v1.md:57`
 * (`usefulGroup_s = max(0, G_s - relationshipFloor_s)`) and
 * `docs/rules/competency-rules.md` "Overlapping Learning Groups do not stack".
 */
const context = { content, professionId: "profession:smith", societyLevel: 1 };
const SUPERSET_GROUP_ID = "F24";
const SUBSET_GROUP_ID = "G13";
const SHARED_SKILL_ID = "skill:smithing";

function buy(progression: ReturnType<typeof createChargenProgression>, targetId: string) {
  const result = allocateChargenPoint({ ...context, progression, targetId, targetType: "group" });
  expect(result.error).toBeUndefined();
  return result;
}

function sharedSkillGroupContribution(progression: ReturnType<typeof createChargenProgression>) {
  const definition = content.skills.find((skill) => skill.id === SHARED_SKILL_ID)!;
  return getBestPurchasedParentGroup(content, progression, definition)?.ranks ?? 0;
}

describe("overlapping Learning Group pricing (#381)", () => {
  it("exposes both groups to the same Profession with a strict subset membership", () => {
    const access = buildChargenSkillAccessSummary(context);
    expect(access.normalSkillGroupIds).toContain(SUPERSET_GROUP_ID);
    expect(access.normalSkillGroupIds).toContain(SUBSET_GROUP_ID);
    const superset = new Set(
      (content.skillGroups.find((group) => group.id === SUPERSET_GROUP_ID)!.skillMemberships ?? [])
        .map((membership) => membership.skillId),
    );
    const subset = (
      content.skillGroups.find((group) => group.id === SUBSET_GROUP_ID)!.skillMemberships ?? []
    ).map((membership) => membership.skillId);
    expect(subset).toEqual([SHARED_SKILL_ID]);
    expect(subset.every((skillId) => superset.has(skillId))).toBe(true);
    expect(superset.size).toBeGreaterThan(subset.length);
  });

  it("charges nothing for a suppressed subset group bought after the stronger group", () => {
    let progression = createChargenProgression();
    progression = buy(progression, SUPERSET_GROUP_ID).progression;
    progression = buy(progression, SUPERSET_GROUP_ID).progression;

    const contributionBefore = sharedSkillGroupContribution(progression);
    const spentBefore = progression.primaryPoolSpent;
    expect(contributionBefore).toBe(2);

    const quote = getActiveGroupSkillCost({ content, groupId: SUBSET_GROUP_ID, progression });
    expect(quote.error).toBeUndefined();
    expect(quote.cost).toBe(0);

    const purchased = buy(progression, SUBSET_GROUP_ID);
    expect(sharedSkillGroupContribution(purchased.progression)).toBe(contributionBefore);
    expect(purchased.progression.primaryPoolSpent).toBe(spentBefore);
    expect(purchased.spentCost).toBe(0);
  });

  it("charges nothing for the stronger group's suppressed overlap in the reverse order", () => {
    let progression = createChargenProgression();
    progression = buy(progression, SUBSET_GROUP_ID).progression;
    const spentAfterSubset = progression.primaryPoolSpent;

    progression = buy(progression, SUPERSET_GROUP_ID).progression;
    progression = buy(progression, SUPERSET_GROUP_ID).progression;

    // Reverse order must reach the same total as buying the superset first and then the
    // suppressed subset group: overlap never multiplies the purchase.
    let forward = createChargenProgression();
    forward = buy(forward, SUPERSET_GROUP_ID).progression;
    forward = buy(forward, SUPERSET_GROUP_ID).progression;
    forward = buy(forward, SUBSET_GROUP_ID).progression;

    expect(progression.primaryPoolSpent).toBe(forward.primaryPoolSpent);
    expect(spentAfterSubset).toBeGreaterThan(0);
  });
});
