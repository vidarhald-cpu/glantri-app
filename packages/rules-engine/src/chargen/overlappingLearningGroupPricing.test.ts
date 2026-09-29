import { describe, expect, it } from "vitest";
import { getApprovedV2RuntimeContent } from "@glantri/content";

import {
  allocateChargenPoint,
  buildChargenDraftView,
  createChargenProgression,
  getChargenGroupBundleCost,
} from "./primaryAllocation";
import { buildChargenSkillAccessSummary } from "./primaryAllocation/access";
import {
  describeChargenGroupTrainingChange,
  getActiveGroupSkillCost,
} from "./primaryAllocation/costs";
import { getBestPurchasedParentGroup } from "./primaryAllocation/_helpers";
import { validateTargetChargenBuild } from "./validateTargetChargenBuild";

/*
 * Forgejo #387: migrated off the retired 59-group legacy accessor onto
 * the canonical V2 runtime content. The pricing properties are unchanged; the overlap shapes are
 * restated with the Learning Groups that actually carry them in the V2 catalogue.
 */
const content = getApprovedV2RuntimeContent();
/**
 * `profession:distiller` reaches both C15 (Pharmacy and Distilling plus Alchemy) and F23
 * (Pharmacy and Distilling alone), so F23's active membership is a strict subset of C15's. This is
 * the canonical overlap shape from Forgejo #381: `docs/rules/pilot-skill-rules-v1.md:57`
 * (`usefulGroup_s = max(0, G_s - relationshipFloor_s)`) and
 * `docs/rules/competency-rules.md` "Overlapping Learning Groups do not stack".
 */
const context = {
  content,
  professionId: "profession:distiller",
  societyId: "feudal_manorial_kingdom",
  societyLevel: 4,
};
const SUPERSET_GROUP_ID = "C15";
const SUBSET_GROUP_ID = "F23";
const SHARED_SKILL_ID = "skill:pharmacy";

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
    expect(subset).toContain(SHARED_SKILL_ID);
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
        societyId: context.societyId,
        societyLevel: context.societyLevel,
      } as never,
      content,
    );

    expect(errors).not.toContain(
      "Recorded Chargen spending does not match authoritative purchase prices.",
    );
  });
});

/**
 * Canonical negative-marginal case. The melee cross-training relationships that produce it are
 * carried unchanged by the V2 corpus, but no pair of the 95 canonical V2 Learning Groups is
 * authored in the shape that triggers it — verified exhaustively over every ordered group pair
 * while retiring the legacy accessor (Forgejo #387). The two overlapping drill Groups are therefore
 * constructed here on top of the canonical V2 content, mirroring the retired catalogue's `F35`
 * (teaching `one_handed_concussion_axe`, `dodge`, `parry`, `brawling`) and `G08` (teaching
 * `one_handed_edged`, `dodge`, `parry`). Melee cross-training at distance 1 means the edged
 * training floors the axe, so competence the axe drill was priced for is supplied without it and
 * the build's total Learning Group cost falls. The resulting spend sequence is identical to the one
 * the retired catalogue produced.
 *
 * Product Owner ruling, 2026-09-27 (Forgejo #385, rule decision 0011): the arithmetic is
 * correct and must not change. The recorded spend sequence is therefore a regression check,
 * not a defect reproduction, and the requirement falls on the presentation.
 */
describe("canonical negative-marginal Learning Group training (#385)", () => {
  const AXE_GROUP_ID = "test:axe-drill";
  const EDGED_GROUP_ID = "test:edged-drill";
  const negativeContent = structuredClone(content);
  negativeContent.skillGroups.push(
    {
      id: AXE_GROUP_ID,
      name: "Axe and mace drill",
      sortOrder: 990,
      skillMemberships: [
        { skillId: "one_handed_concussion_axe", relevance: "core" as const },
        { skillId: "dodge", relevance: "core" as const },
        { skillId: "parry", relevance: "core" as const },
        { skillId: "brawling", relevance: "core" as const },
      ],
    },
    {
      id: EDGED_GROUP_ID,
      name: "Edged weapon drill",
      sortOrder: 991,
      skillMemberships: [
        { skillId: "one_handed_edged", relevance: "core" as const },
        { skillId: "dodge", relevance: "core" as const },
        { skillId: "parry", relevance: "core" as const },
      ],
    },
  );
  negativeContent.chargenCatalogue!.groupIds = [
    ...(negativeContent.chargenCatalogue!.groupIds ?? []),
    AXE_GROUP_ID,
    EDGED_GROUP_ID,
  ];

  function progressionOf(rows: { groupId: string; ranks: number }[]) {
    return {
      ...createChargenProgression(),
      skillGroups: rows.map((row) => ({
        gms: 0,
        grantedRanks: 0,
        groupId: row.groupId,
        primaryRanks: row.ranks,
        ranks: row.ranks,
        secondaryRanks: 0,
      })),
    };
  }

  function bundleCost(rows: { groupId: string; ranks: number }[]) {
    return getChargenGroupBundleCost({
      content: negativeContent,
      progression: progressionOf(rows),
    }).cost;
  }

  it("keeps the ruled recorded spend sequence for the axe drill x3 then the edged drill x3", () => {
    const spent: number[] = [];
    for (const ranks of [1, 2, 3]) spent.push(bundleCost([{ groupId: AXE_GROUP_ID, ranks }]));
    for (const ranks of [1, 2, 3])
      spent.push(
        bundleCost([
          { groupId: AXE_GROUP_ID, ranks: 3 },
          { groupId: EDGED_GROUP_ID, ranks },
        ]),
      );

    expect(spent).toEqual([6, 11, 16, 16, 15, 15]);
  });

  it("classifies added training that lowers the build cost as reduced by overlap", () => {
    const previousProgression = progressionOf([
      { groupId: AXE_GROUP_ID, ranks: 3 },
      { groupId: EDGED_GROUP_ID, ranks: 1 },
    ]);
    const progression = progressionOf([
      { groupId: AXE_GROUP_ID, ranks: 3 },
      { groupId: EDGED_GROUP_ID, ranks: 2 },
    ]);

    const change = describeChargenGroupTrainingChange({
      content: negativeContent,
      previousProgression,
      progression,
    });

    expect(change.previousCost).toBe(16);
    expect(change.cost).toBe(15);
    expect(change.shift).toBe("reduced-by-overlap");
  });

  it("classifies removed training that raises the build cost as raised by overlap", () => {
    const previousProgression = progressionOf([
      { groupId: AXE_GROUP_ID, ranks: 3 },
      { groupId: EDGED_GROUP_ID, ranks: 2 },
    ]);
    const progression = progressionOf([
      { groupId: AXE_GROUP_ID, ranks: 3 },
      { groupId: EDGED_GROUP_ID, ranks: 1 },
    ]);

    const change = describeChargenGroupTrainingChange({
      content: negativeContent,
      previousProgression,
      progression,
    });

    expect(change.previousCost).toBe(15);
    expect(change.cost).toBe(16);
    expect(change.shift).toBe("raised-by-overlap");
  });

  it("classifies an ordinary purchase that raises the build cost as ordinary", () => {
    const previousProgression = createChargenProgression();
    const progression = progressionOf([{ groupId: AXE_GROUP_ID, ranks: 1 }]);

    expect(
      describeChargenGroupTrainingChange({
        content: negativeContent,
        previousProgression,
        progression,
      }).shift,
    ).toBe("ordinary");
  });
});
