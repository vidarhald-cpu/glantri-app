import { describe, expect, it } from "vitest";
import { getApprovedTargetChargenContent } from "@glantri/content";

import {
  allocateChargenPoint,
  buildChargenDraftView,
  createChargenProgression,
  removeChargenPoint,
} from "./primaryAllocation";
import { buildChargenSkillAccessSummary } from "./primaryAllocation/access";
import {
  describeChargenGroupTrainingChange,
  getActiveGroupSkillCost,
} from "./primaryAllocation/costs";
import { getBestPurchasedParentGroup } from "./primaryAllocation/_helpers";
import { validateTargetChargenBuild } from "./validateTargetChargenBuild";

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
      (
        content.skillGroups.find((group) => group.id === SUPERSET_GROUP_ID)!.skillMemberships ?? []
      ).map((membership) => membership.skillId),
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

  it("reports the suppressed Group's zero useful increment through the draft view seam", () => {
    let progression = createChargenProgression();
    progression = buy(progression, SUPERSET_GROUP_ID).progression;
    progression = buy(progression, SUPERSET_GROUP_ID).progression;
    progression = buy(progression, SUBSET_GROUP_ID).progression;

    const view = buildChargenDraftView({ ...context, progression });
    const superset = view.groups.find((group) => group.groupId === SUPERSET_GROUP_ID)!;
    const subset = view.groups.find((group) => group.groupId === SUBSET_GROUP_ID)!;

    expect(superset.usefulWeightedIncrement).toBeGreaterThan(0);
    expect(superset.marginalPurchaseCost).toBeGreaterThan(0);
    expect(subset.usefulWeightedIncrement).toBe(0);
    expect(subset.marginalPurchaseCost).toBe(0);
  });

  it("keeps the recorded spend the finalize-time validator recomputes", () => {
    let progression = createChargenProgression();
    progression = buy(progression, SUPERSET_GROUP_ID).progression;
    progression = buy(progression, SUPERSET_GROUP_ID).progression;
    progression = buy(progression, SUBSET_GROUP_ID).progression;

    const errors = validateTargetChargenBuild(
      {
        civilizationId: "scandia",
        professionId: context.professionId,
        progression,
        societyLevel: 1,
      } as never,
      content,
    );

    expect(errors).not.toContain(
      "Recorded Chargen spending does not match authoritative purchase prices.",
    );
  });
});

/**
 * Canonical negative-marginal case. `profession:weapon-instructor` reaches both `F35`
 * (teaching `one_handed_concussion_axe`, `dodge`, `parry`, `brawling`) and `G08` (teaching
 * `one_handed_edged`, `dodge`, `parry`). Melee cross-training at distance 1 means the edged
 * training floors the axe, so competence `F35` was priced for is supplied without it and the
 * build's total Learning Group cost falls.
 *
 * Product Owner ruling, 2026-09-27 (Forgejo #385, rule decision 0011): the arithmetic is
 * correct and must not change. The recorded spend sequence is therefore a regression check,
 * not a defect reproduction, and the requirement falls on the presentation.
 */
describe("canonical negative-marginal Learning Group training (#385)", () => {
  const negativeContext = {
    content,
    professionId: "profession:weapon-instructor",
    societyLevel: 1,
  };

  function buyNegative(progression: ReturnType<typeof createChargenProgression>, targetId: string) {
    const result = allocateChargenPoint({
      ...negativeContext,
      progression,
      targetId,
      targetType: "group",
    });
    expect(result.error).toBeUndefined();
    return result.progression;
  }

  it("keeps the ruled recorded spend sequence for F35 x3 then G08 x3", () => {
    let progression = createChargenProgression();
    const spent: number[] = [];

    for (const groupId of ["F35", "F35", "F35", "G08", "G08", "G08"]) {
      progression = buyNegative(progression, groupId);
      spent.push(progression.primaryPoolSpent);
    }

    expect(spent).toEqual([6, 11, 16, 16, 15, 15]);
  });

  it("classifies added training that lowers the build cost as reduced by overlap", () => {
    let progression = createChargenProgression();
    progression = buyNegative(progression, "F35");
    progression = buyNegative(progression, "F35");
    progression = buyNegative(progression, "F35");
    progression = buyNegative(progression, "G08");
    const previousProgression = progression;
    progression = buyNegative(progression, "G08");

    const change = describeChargenGroupTrainingChange({
      content,
      previousProgression,
      progression,
    });

    expect(previousProgression.primaryPoolSpent).toBe(16);
    expect(progression.primaryPoolSpent).toBe(15);
    expect(change.previousCost).toBe(16);
    expect(change.cost).toBe(15);
    expect(change.shift).toBe("reduced-by-overlap");
  });

  it("classifies removed training that raises the build cost as raised by overlap", () => {
    let progression = createChargenProgression();
    for (const groupId of ["F35", "F35", "F35", "G08", "G08"]) {
      progression = buyNegative(progression, groupId);
    }
    const previousProgression = progression;
    const removal = removeChargenPoint({
      ...negativeContext,
      progression,
      targetId: "G08",
      targetType: "group",
    });
    expect(removal.error).toBeUndefined();

    const change = describeChargenGroupTrainingChange({
      content,
      previousProgression,
      progression: removal.progression,
    });

    expect(change.previousCost).toBe(15);
    expect(change.cost).toBe(16);
    expect(change.shift).toBe("raised-by-overlap");
  });

  it("classifies an ordinary purchase that raises the build cost as ordinary", () => {
    const previousProgression = createChargenProgression();
    const progression = buyNegative(previousProgression, "F35");

    expect(
      describeChargenGroupTrainingChange({ content, previousProgression, progression }).shift,
    ).toBe("ordinary");
  });
});
