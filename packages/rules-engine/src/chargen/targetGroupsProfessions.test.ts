import { describe, expect, it } from "vitest";
import { getApprovedTargetChargenContent } from "@glantri/content";
import {
  createChargenProgression,
  allocateChargenPoint,
  removeChargenPoint,
  applyProfessionGrants,
  spendSecondaryPoint,
  removeSecondaryPoint,
  buildChargenDraftView,
} from "./primaryAllocation";
import { getActiveGroupSkillCost } from "./primaryAllocation/costs";
import { buildChargenSkillAccessSummary } from "./primaryAllocation/access";
import { validateTargetChargenBuild } from "./validateTargetChargenBuild";
import { characterBuildSchema } from "@glantri/domain";
const content = getApprovedTargetChargenContent();
const context = { content, professionId: "profession:hunter-trapper", societyLevel: 1 };
describe("combined target Chargen", () => {
  it("uses unbound Profession access and never creates ranks from selection", () => {
    const access = buildChargenSkillAccessSummary(context);
    expect(access.normalSkillGroupIds).toEqual(["G03", "G04", "F34", "F41"]);
    const p = applyProfessionGrants(context);
    expect(p.skills.every((s) => s.ranks === 0)).toBe(true);
    expect(p.skillGroups.every((g) => g.ranks === 0)).toBe(true);
  });
  it("refuses flexible-only group access without mutating pools", () => {
    const progression = createChargenProgression();
    progression.secondaryPoolTotal = 100;
    const result = allocateChargenPoint({
      ...context,
      progression,
      targetId: "F39",
      targetType: "group",
    });
    expect(result.error).toBeTruthy();
    expect(result.progression).toEqual(progression);
  });
  it("uses flexible funds only for an approved group and buys groupless competencies directly", () => {
    const progression = {
      ...createChargenProgression(),
      primaryPoolTotal: 0,
      secondaryPoolTotal: 100,
    };
    const group = allocateChargenPoint({
      ...context,
      progression,
      targetType: "group",
      targetId: "G03",
    });
    expect(group.error).toBeUndefined();
    expect(group.progression.skillGroups[0]).toMatchObject({
      primaryRanks: 1,
      secondaryRanks: 0,
    });
    expect(group.progression.primaryPoolSpent).toBe(0);
    // ceil(2/3 * weightedUseful) from the shared canonical Learning Group arithmetic
    // (docs/rules/pilot-skill-rules-v1.md section 4).
    expect(group.progression.secondaryPoolSpent).toBe(6);
    const direct = allocateChargenPoint({
      ...context,
      progression,
      targetType: "skill",
      targetId: "skill:surgery",
    });
    expect(direct.error).toBeUndefined();
    expect(direct.progression.skillGroups).toEqual([]);
    expect(
      direct.progression.skills.find((s) => s.skillId === "skill:surgery")?.secondaryRanks,
    ).toBe(1);
  });
  it("prices only base memberships and refunds symmetrically", () => {
    const progression = createChargenProgression();
    expect(getActiveGroupSkillCost({ content, groupId: "F07", progression }).cost).toBe(3);
    const input = { ...context, progression, targetId: "G03", targetType: "group" as const };
    const purchased = allocateChargenPoint(input);
    expect(purchased.error).toBeUndefined();
    const refunded = removeChargenPoint({ ...input, progression: purchased.progression });
    expect(refunded.error).toBeUndefined();
    expect(refunded.progression.primaryPoolSpent).toBe(0);
  });
  it("keeps nested Specializations separate, priced 4/2 and protected on removal", () => {
    let progression = { ...createChargenProgression(), secondaryPoolTotal: 200 };
    for (let i = 0; i < 11; i++) {
      const bought = allocateChargenPoint({
        ...context,
        progression,
        targetId: "skill:animal-handling",
        targetType: "skill",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
    }
    const buy = (targetId: string) =>
      spendSecondaryPoint({ ...context, progression, targetId, targetType: "specialization" });
    const denied = buy("spec:falconry");
    expect(denied.error).toBeTruthy();
    expect(denied.progression).toEqual(progression);
    for (let i = 0; i < 11; i++) {
      const bought = buy("spec:animal-training");
      expect(bought.error).toBeUndefined();
      expect(bought.spentCost).toBe(i === 0 ? 4 : 2);
      progression = bought.progression;
    }
    const falconry = buy("spec:falconry");
    expect(falconry.error).toBeUndefined();
    expect(falconry.spentCost).toBe(4);
    progression = falconry.progression;
    const removed = removeSecondaryPoint({
      ...context,
      progression,
      targetId: "spec:animal-training",
      targetType: "specialization",
    });
    expect(removed.error).toBeTruthy();
    expect(removed.progression).toEqual(progression);
    const refund = removeSecondaryPoint({
      ...context,
      progression,
      targetId: "spec:falconry",
      targetType: "specialization",
    });
    expect(refund.error).toBeUndefined();
    expect(progression.secondaryPoolSpent - refund.progression.secondaryPoolSpent).toBe(4);
  });
  it("uses the strongest overlapping group once and adds owned direct XP once", () => {
    const archer = { ...context, professionId: "profession:soldier:military-archer" };
    let progression = createChargenProgression();
    for (const targetId of ["F36", "F38"]) {
      const bought = allocateChargenPoint({
        ...archer,
        progression,
        targetId,
        targetType: "group",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
    }
    const bought = allocateChargenPoint({
      ...archer,
      progression,
      targetId: content.skills.find((s) => s.name === "Formation Fighting")!.id,
      targetType: "skill",
    });
    expect(bought.error).toBeUndefined();
    const rows = buildChargenDraftView({
      ...archer,
      progression: bought.progression,
    }).skills.filter(
      (s) => s.skillId === content.skills.find((s) => s.name === "Formation Fighting")!.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ groupLevel: 1, primaryRanks: 1, effectiveSkillNumber: 2 });
  });
  it("rejects forged track, group and price submissions", () => {
    const progression = createChargenProgression();
    const build = characterBuildSchema.parse({
      id: "synthetic",
      name: "Synthetic",
      professionId: "profession:hunter-trapper",
      profile: {
        id: "profile",
        label: "Profile",
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
      },
      progression,
    });
    expect(validateTargetChargenBuild(build, content)).toEqual([]);
    expect(
      validateTargetChargenBuild(
        { ...build, professionId: "profession:soldier:invented" },
        content,
      ),
    ).toContain("Unknown target Profession or track.");
    build.progression.primaryPoolSpent = 1;
    expect(validateTargetChargenBuild(build, content)).toContain(
      "Recorded Chargen spending does not match authoritative purchase prices.",
    );
  });
});
