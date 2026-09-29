import { describe, expect, it } from "vitest";
import { getApprovedV2RuntimeContent } from "@glantri/content";
import { characterBuildSchema } from "@glantri/domain";
import {
  allocateChargenPoint,
  createChargenProgression,
  finalizeChargenDraft,
  getChargenGroupBundleCost,
  spendPrimaryPoint,
} from "./primaryAllocation";
import { validateTargetChargenBuild } from "./validateTargetChargenBuild";

/**
 * Product Owner ruling, 2026-09-29 (Forgejo #387): the two Profession-specific alternatives in
 * `docs/rules/competency-rules.md` "Professions" are **not** mutually exclusive in V2. *"A
 * Character who genuinely trains in both buys both"* means both may legitimately be acquired and
 * each is paid for independently. The absence of `exclusiveLearningGroupPairs` from the canonical
 * V2 projection is correct, and the retired `getExclusiveProfessionGroupErrors` guard must not be
 * revived.
 *
 * This file is the positive counterpart of that retired negative guard: it pins the permission, so
 * a later change cannot silently reintroduce an exclusion without failing here.
 *
 * Guard, Watcher and Escort is the worked case. Both alternative training routes are reachable
 * from the single `profession:guard-escort` path: `F30` Swashbuckling fencing instruction and
 * `M01` Guard and rough-fighting drill.
 */
const content = getApprovedV2RuntimeContent();
const FENCING_ROUTE_GROUP_ID = "F30";
const CLOSE_COMBAT_ROUTE_GROUP_ID = "M01";
const CORE_ROUTE_GROUP_ID = "K24";
const context = {
  content,
  professionId: "profession:guard-escort",
  societyId: "forager_ritual_tribal",
  societyLevel: 1,
};
const profile = {
  id: "synthetic",
  label: "Synthetic",
  societyLevel: 1,
  distractionLevel: 2,
  rolledStats: {
    str: 10,
    dex: 10,
    con: 10,
    com: 10,
    health: 10,
    siz: 10,
    will: 10,
    int: 10,
    pow: 10,
    cha: 10,
    lck: 10,
  },
};

/** `M01` carries a required pick-one slot; the Character trains in one taught melee family. */
function withCloseCombatSelection<T extends ReturnType<typeof createChargenProgression>>(
  progression: T,
): T {
  const slot = content.skillGroups.find((group) => group.id === CLOSE_COMBAT_ROUTE_GROUP_ID)!
    .selectionSlots![0];
  return {
    ...progression,
    chargenSelections: {
      ...progression.chargenSelections,
      selectedLanguageIds: progression.chargenSelections?.selectedLanguageIds ?? [],
      selectedSkillIds: progression.chargenSelections?.selectedSkillIds ?? [],
      selectedGroupSlots: [
        {
          groupId: CLOSE_COMBAT_ROUTE_GROUP_ID,
          slotId: slot.id,
          selectedSkillIds: slot.candidateSkillIds.slice(0, slot.chooseCount),
        },
      ],
    },
  };
}

function buy(progression: ReturnType<typeof createChargenProgression>, targetId: string) {
  const result = allocateChargenPoint({ ...context, progression, targetId, targetType: "group" });
  expect(result.error).toBeUndefined();
  return result;
}

describe("Profession alternative training routes coexist (#387)", () => {
  it("carries no exclusive-pair encoding anywhere in the canonical V2 projection", () => {
    expect(
      content.professions.filter(
        (profession) =>
          (profession as { exclusiveLearningGroupPairs?: unknown[] }).exclusiveLearningGroupPairs
            ?.length,
      ),
    ).toEqual([]);
  });

  it("exposes both alternative routes on the one Profession path", () => {
    const path = content.competencyV2!.paths.find((row) => row.id === context.professionId)!;
    const routes = new Map(
      path.routes.filter((route) => route.groupId).map((route) => [route.groupId!, route.label]),
    );
    expect(routes.get(FENCING_ROUTE_GROUP_ID)).toBe("Swashbuckling fencing instruction");
    expect(routes.get(CLOSE_COMBAT_ROUTE_GROUP_ID)).toBe("Guard and rough-fighting drill");
  });

  for (const [first, second] of [
    [FENCING_ROUTE_GROUP_ID, CLOSE_COMBAT_ROUTE_GROUP_ID],
    [CLOSE_COMBAT_ROUTE_GROUP_ID, FENCING_ROUTE_GROUP_ID],
  ]) {
    it(`permits ${second} after ${first} through every acquisition entry point`, () => {
      const initial = withCloseCombatSelection(createChargenProgression());
      const purchased = buy(initial, first);

      for (const purchase of [allocateChargenPoint, spendPrimaryPoint]) {
        const both = purchase({
          ...context,
          progression: purchased.progression,
          targetId: second,
          targetType: "group",
        });
        expect(both.error).toBeUndefined();
        expect(both.progression.skillGroups.map((group) => group.groupId)).toEqual(
          expect.arrayContaining([first, second]),
        );
      }
    });
  }

  it("pays for each alternative independently and finalizes a valid build holding both", () => {
    const initial = withCloseCombatSelection(createChargenProgression());
    const fencingOnly = buy(initial, FENCING_ROUTE_GROUP_ID);
    const closeCombatOnly = buy(initial, CLOSE_COMBAT_ROUTE_GROUP_ID);
    const both = buy(fencingOnly.progression, CLOSE_COMBAT_ROUTE_GROUP_ID);

    // Each route is genuinely paid for: neither is free, and buying both costs more than either
    // alone. The bundle is still priced once through the shared acquisition arithmetic, so the
    // total is the bundle price of the pair, not an exclusion and not a discount to one route.
    expect(fencingOnly.spentCost).toBeGreaterThan(0);
    expect(closeCombatOnly.spentCost).toBeGreaterThan(0);
    expect(both.spentCost).toBeGreaterThan(0);
    expect(both.progression.primaryPoolSpent).toBeGreaterThan(
      fencingOnly.progression.primaryPoolSpent,
    );
    expect(both.progression.primaryPoolSpent).toBeGreaterThan(
      closeCombatOnly.progression.primaryPoolSpent,
    );
    expect(both.progression.primaryPoolSpent).toBe(
      getChargenGroupBundleCost({ content, progression: both.progression }).cost,
    );

    const complete = buy(both.progression, CORE_ROUTE_GROUP_ID);
    const finalized = finalizeChargenDraft({
      ...context,
      profile,
      progression: complete.progression,
      name: "Trains in both routes",
    });

    expect(finalized.errors).toEqual([]);

    const build = characterBuildSchema.parse(JSON.parse(JSON.stringify(finalized.build)));
    const heldGroupIds = build.progression.skillGroups.map((group) => group.groupId);

    expect(heldGroupIds).toEqual(
      expect.arrayContaining([FENCING_ROUTE_GROUP_ID, CLOSE_COMBAT_ROUTE_GROUP_ID]),
    );
    expect(validateTargetChargenBuild(build, content)).toEqual([]);
  });
});
