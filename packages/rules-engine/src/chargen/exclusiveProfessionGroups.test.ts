import { describe, expect, it } from "vitest";
import { getApprovedTargetChargenContent } from "@glantri/content";
import { characterBuildSchema } from "@glantri/domain";
import {
  allocateChargenPoint,
  createChargenProgression,
  spendPrimaryPoint,
  removeChargenPoint,
} from "./primaryAllocation";
import { validateTargetChargenBuild } from "./validateTargetChargenBuild";
import { getExclusiveProfessionGroupErrors } from "./exclusiveProfessionGroups";
const content = getApprovedTargetChargenContent();
const profile = {
  id: "synthetic",
  label: "Synthetic",
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
describe("PO-scoped Profession group alternatives", () => {
  for (const [professionId, a, b] of [
    ["profession:sailor", "F09", "G06"],
    ["profession:guard-escort", "F30", "G08"],
  ]) {
    for (const [first, second] of [
      [a, b],
      [b, a],
    ])
      it(`${professionId} refuses ${second} after ${first} without changing pools or state`, () => {
        const context = { content, professionId, societyLevel: 1 };
        const initial = createChargenProgression();
        const purchased = allocateChargenPoint({
          ...context,
          progression: initial,
          targetId: first,
          targetType: "group",
        });
        expect(purchased.error).toBeUndefined();
        const individual = allocateChargenPoint({
          ...context,
          progression: initial,
          targetId: second,
          targetType: "group",
        });
        expect(individual.error).toBeUndefined();
        for (const purchase of [allocateChargenPoint, spendPrimaryPoint]) {
          const rejected = purchase({
            ...context,
            progression: purchased.progression,
            targetId: second,
            targetType: "group",
          });
          expect(rejected.error).toContain("alternative training routes");
          expect(rejected.progression).toEqual(purchased.progression);
        }
        const forged = characterBuildSchema.parse({
          id: "forged",
          name: "Synthetic",
          profile,
          professionId,
          progression: {
            ...purchased.progression,
            primaryPoolSpent:
              purchased.progression.primaryPoolSpent + individual.progression.primaryPoolSpent,
            skillGroups: [
              ...purchased.progression.skillGroups,
              ...individual.progression.skillGroups,
            ],
          },
        });
        expect(
          validateTargetChargenBuild(forged, content).some((e) =>
            e.includes("alternative training routes"),
          ),
        ).toBe(true);
        expect(
          getExclusiveProfessionGroupErrors({
            content,
            professionId: "profession:hunter-trapper",
            progression: forged.progression,
          }),
        ).toEqual([]);
        const refund = removeChargenPoint({
          ...context,
          progression: purchased.progression,
          targetId: first,
          targetType: "group",
        });
        expect(refund.error).toBeUndefined();
        expect(
          allocateChargenPoint({
            ...context,
            progression: refund.progression,
            targetId: second,
            targetType: "group",
          }).error,
        ).toBeUndefined();
        const directId = content.skillGroups.find((g) => g.id === second)!.skillMemberships![0]
          .skillId;
        expect(
          allocateChargenPoint({
            ...context,
            progression: purchased.progression,
            targetId: directId,
            targetType: "skill",
          }).error,
        ).toBeUndefined();
      });
  }
  it("preserves P14 G08 plus F35 and defines no exclusions for other Professions", () => {
    let progression = createChargenProgression();
    for (const targetId of ["G08", "F35"]) {
      const bought = allocateChargenPoint({
        content,
        professionId: "profession:guard-escort",
        societyLevel: 1,
        progression,
        targetId,
        targetType: "group",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
    }
    expect(
      validateTargetChargenBuild(
        characterBuildSchema.parse({
          id: "permitted",
          name: "Synthetic",
          profile,
          professionId: "profession:guard-escort",
          progression,
        }),
        content,
      ),
    ).toEqual([]);
    expect(
      content.professions.filter((p) => p.exclusiveLearningGroupPairs?.length).map((p) => p.id),
    ).toEqual(["profession:sailor", "profession:guard-escort"]);
  });
});
