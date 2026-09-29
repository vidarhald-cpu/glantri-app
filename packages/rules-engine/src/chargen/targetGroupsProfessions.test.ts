import { describe, expect, it } from "vitest";
import { getApprovedV2RuntimeContent } from "@glantri/content";
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

/*
 * Forgejo #387: migrated off the retired 59-group legacy accessor onto
 * the canonical V2 runtime content every Chargen and Character path actually loads. The properties
 * asserted here are unchanged; only the catalogue and its Profession/Learning Group identifiers are
 * restated in current V2 vocabulary.
 */
const content = getApprovedV2RuntimeContent();
const context = {
  content,
  professionId: "profession:distiller",
  societyId: "feudal_manorial_kingdom",
  societyLevel: 4,
};
const profile = {
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
};
describe("combined target Chargen", () => {
  it("uses unbound Profession access and never creates ranks from selection", () => {
    const access = buildChargenSkillAccessSummary(context);
    expect(access.normalSkillGroupIds).toEqual(["F23", "C10", "C15"]);
    const p = applyProfessionGrants(context);
    expect(p.skills.every((s) => s.ranks === 0)).toBe(true);
    expect(p.skillGroups.every((g) => g.ranks === 0)).toBe(true);
  });
  it("refuses flexible-only group access without mutating pools", () => {
    const progression = createChargenProgression();
    progression.secondaryPoolTotal = 100;
    // `G01` is reachable through flexible funds at this society, but is not part of the Distiller
    // Profession package, so the ordinary group purchase must refuse it.
    expect(buildChargenSkillAccessSummary(context).normalSkillGroupIds).not.toContain("G01");
    const result = allocateChargenPoint({
      ...context,
      progression,
      targetId: "G01",
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
      targetId: "F23",
    });
    expect(group.error).toBeUndefined();
    expect(group.progression.skillGroups[0]).toMatchObject({
      primaryRanks: 1,
      secondaryRanks: 0,
    });
    expect(group.progression.primaryPoolSpent).toBe(0);
    // ceil(2/3 * weightedUseful) from the shared canonical Learning Group arithmetic
    // (docs/rules/pilot-skill-rules-v1.md section 4).
    expect(group.progression.secondaryPoolSpent).toBe(3);
    const direct = allocateChargenPoint({
      ...context,
      progression,
      targetType: "skill",
      targetId: "skill:swimming",
    });
    expect(direct.error).toBeUndefined();
    expect(direct.progression.skillGroups).toEqual([]);
    expect(
      direct.progression.skills.find((s) => s.skillId === "skill:swimming")?.secondaryRanks,
    ).toBe(1);
  });
  it("prices only base memberships and refunds symmetrically", () => {
    const progression = createChargenProgression();
    expect(getActiveGroupSkillCost({ content, groupId: "F23", progression }).cost).toBe(3);
    const input = { ...context, progression, targetId: "F23", targetType: "group" as const };
    const purchased = allocateChargenPoint(input);
    expect(purchased.error).toBeUndefined();
    const refunded = removeChargenPoint({ ...input, progression: purchased.progression });
    expect(refunded.error).toBeUndefined();
    expect(refunded.progression.primaryPoolSpent).toBe(0);
  });
  it("keeps nested Specializations separate, priced 4/2 and protected on removal", () => {
    /* Animal Training sits on Animal Handling and Falconry sits on Animal Training, both at level
       11, so the nested pair is bought through flexible funds and Falconry cannot be reached until
       its immediate parent Specialization is trained. */
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
    /* `C15` teaches Pharmacy alongside Alchemy and Distilling; `F23` teaches Pharmacy and
       Distilling only, so `F23`'s membership is a strict subset of `C15`'s. */
    let progression = createChargenProgression();
    for (const targetId of ["C15", "F23"]) {
      const bought = allocateChargenPoint({
        ...context,
        progression,
        targetId,
        targetType: "group",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
    }
    const bought = allocateChargenPoint({
      ...context,
      progression,
      targetId: content.skills.find((s) => s.name === "Pharmacy")!.id,
      targetType: "skill",
    });
    expect(bought.error).toBeUndefined();
    const rows = buildChargenDraftView({
      ...context,
      progression: bought.progression,
    }).skills.filter((s) => s.skillId === content.skills.find((s) => s.name === "Pharmacy")!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ groupLevel: 1, primaryRanks: 1, effectiveSkillNumber: 2 });
  });
  it("rejects forged track, group and price submissions", () => {
    const coreRoutes = content.competencyV2!.paths.find(
      (path) => path.id === context.professionId,
    )!.coreRoutes;
    let progression: ReturnType<typeof createChargenProgression> = {
      ...createChargenProgression(),
      chargenSelections: {
        selectedCoreRouteId: coreRoutes[0].id,
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [],
      },
    };
    for (const targetId of coreRoutes[0].groupIds) {
      const bought = allocateChargenPoint({
        ...context,
        progression,
        targetId,
        targetType: "group",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
    }
    const build = characterBuildSchema.parse({
      id: "synthetic",
      name: "Synthetic",
      professionId: context.professionId,
      profile,
      progression,
      societyId: context.societyId,
      societyLevel: context.societyLevel,
    });
    expect(validateTargetChargenBuild(build, content)).toEqual([]);
    expect(
      validateTargetChargenBuild(
        { ...build, professionId: "profession:distiller:invented" },
        content,
      ),
    ).toContain("Unknown target Profession or track.");
    build.progression.primaryPoolSpent = 1;
    expect(validateTargetChargenBuild(build, content)).toContain(
      "Recorded Chargen spending does not match authoritative purchase prices.",
    );
  });
});
