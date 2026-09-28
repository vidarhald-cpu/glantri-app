/**
 * Forgejo #372 section 7 — a Learning Group membership that contributed nothing must be visibly
 * explained, not silently listed against the Skill as though it had.
 *
 * Rule source: `docs/rules/pilot-skill-rules-v1.md:50` — "Only `G_s` from the strongest group
 * counts. Other memberships remain in the explanation output with their group identity and
 * supplied level. They are marked as suppressed by the stronger group; they are not deleted."
 *
 * The marker is derived in the rules view layer, deliberately. A component must not infer it by
 * comparing `contributingGroupId` against `groupIds`: that would reconstruct a rules judgement in
 * the interface, which section 2 of the Chargen experience contract forbids.
 *
 * This is the overlap rule, and only the overlap rule. It is a separate concept from relationship
 * repricing, which moves the total build cost between DIFFERENT Skills (rule decision 0011, and
 * #372 section 0.3). Overlap yields a zero-cost purchase, never a cost reduction.
 *
 * Built on the catalogue Chargen actually loads —
 * `withCompetencyContentV2(buildTargetRuntimeContent(createTargetCompetencyChargenSource(...)))` —
 * as `docs/testing-regression-matrix.md` requires. `profession:hunter-trapper` reaches both G03
 * (tracking and hunting practice) and F41, which both teach `skill:hunting`.
 */
import { describe, expect, it } from "vitest";

import {
  type CanonicalContent,
  defaultCanonicalContent,
  withCompetencyContentV2,
} from "@glantri/content";
import type { CharacterProgression } from "@glantri/domain";
import {
  allocateChargenPoint,
  buildChargenDraftView,
  createChargenProgression,
} from "@glantri/rules-engine";

import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "./targetCompetencyContent";

const SOCIETY_ID = "feudal_manorial_kingdom";
const SOCIAL_BAND = 4;
const PROFESSION_ID = "profession:hunter-trapper";
const SHARED_SKILL_ID = "skill:hunting";
const GROUP_A = "G03";
const GROUP_B = "F41";

const content: CanonicalContent = withCompetencyContentV2(
  buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
);

function shared(progression: CharacterProgression) {
  return {
    content,
    professionId: PROFESSION_ID,
    progression,
    societyId: SOCIETY_ID,
    societyLevel: SOCIAL_BAND,
  };
}

function buy(progression: CharacterProgression, groupId: string): CharacterProgression {
  const result = allocateChargenPoint({
    ...shared(progression),
    targetId: groupId,
    targetType: "group",
  });
  expect(result.error, groupId).toBeUndefined();
  return result.progression;
}

function skillView(progression: CharacterProgression) {
  return buildChargenDraftView({
    content,
    professionId: PROFESSION_ID,
    progression,
    societyId: SOCIETY_ID,
    societyLevel: SOCIAL_BAND,
  }).skills.find((row) => row.skillId === SHARED_SKILL_ID);
}

describe("a covered Learning Group membership is carried by the view layer", () => {
  it("has both Groups teaching the shared Skill in the catalogue Chargen loads", () => {
    const members = (groupId: string) =>
      (content.skillGroups.find((group) => group.id === groupId)?.skillMemberships ?? []).map(
        (membership) => membership.skillId,
      );
    expect(members(GROUP_A)).toContain(SHARED_SKILL_ID);
    expect(members(GROUP_B)).toContain(SHARED_SKILL_ID);
  });

  it("reports no covered membership while only one Group is held", () => {
    let progression: CharacterProgression = {
      ...createChargenProgression(),
      primaryPoolTotal: 200,
      secondaryPoolTotal: 200,
    };
    progression = buy(progression, GROUP_A);

    const view = skillView(progression);
    expect(view?.contributingGroupId).toBe(GROUP_A);
    expect(view?.coveredGroupMemberships).toEqual([]);
  });

  it("names the weaker membership and the Group that covers it once both are held", () => {
    let progression: CharacterProgression = {
      ...createChargenProgression(),
      primaryPoolTotal: 200,
      secondaryPoolTotal: 200,
    };
    /* Two ranks in G03 against one in F41, so G03 is unambiguously the stronger membership. */
    progression = buy(progression, GROUP_A);
    progression = buy(progression, GROUP_A);
    progression = buy(progression, GROUP_B);

    const view = skillView(progression);
    expect(view?.contributingGroupId).toBe(GROUP_A);
    expect(view?.coveredGroupMemberships).toHaveLength(1);
    const covered = view!.coveredGroupMemberships[0]!;
    expect(covered.groupId).toBe(GROUP_B);
    expect(covered.coveredByGroupId).toBe(GROUP_A);
    expect(covered.name).toBe(
      content.skillGroups.find((group) => group.id === GROUP_B)?.name ?? GROUP_B,
    );
    expect(covered.coveredByGroupName).toBe(
      content.skillGroups.find((group) => group.id === GROUP_A)?.name ?? GROUP_A,
    );
    /* The membership is retained with the level it supplied, not deleted. */
    expect(covered.suppliedGroupLevel).toBeGreaterThan(0);
    expect(view?.groupLevel).toBeGreaterThan(covered.suppliedGroupLevel);
  });

  it("keeps the covered membership out of the Skill's counted level", () => {
    let one: CharacterProgression = {
      ...createChargenProgression(),
      primaryPoolTotal: 200,
      secondaryPoolTotal: 200,
    };
    one = buy(one, GROUP_A);
    one = buy(one, GROUP_A);
    const alone = skillView(one)?.groupLevel;

    const both = buy(one, GROUP_B);
    const view = skillView(both);

    /* Only the strongest Group contributes; the covered membership adds nothing to the level. */
    expect(view?.groupLevel).toBe(alone);
    expect(view?.coveredGroupMemberships.map((row) => row.groupId)).toEqual([GROUP_B]);
  });
});
