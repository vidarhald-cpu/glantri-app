import { describe, expect, it } from "vitest";
import {
  competencyContentV2WrittenLanguageCompetencyIds,
  getApprovedTargetChargenContent,
  getApprovedV2RuntimeContent,
} from "@glantri/content";
import {
  allocateChargenPoint,
  buildChargenSkillAccessSummary,
  chooseChargenPool,
  createChargenProgression,
  getActiveGroupSkillCost,
  getAllowedSecondaryGroupIds,
  getChargenGroupBundleCost,
  isSpecializationAccessOnlyChargenGroup,
  SPECIALIZATION_ACCESS_ONLY_GROUP_UNPURCHASABLE_MESSAGE,
} from "./primaryAllocation";
import { buildChargenCoreRouteStatus } from "./coreRouteSelection";
import {
  buildChargenMotherTongueSummary,
  buildChargenSelectableSkillSummary,
} from "./selectionStructure";
import {
  getSatisfiedCompetencyV2CoreRouteIds,
  resolveCompetencyV2PathAvailability,
} from "../professions/resolveCompetencyV2Path";

const content = getApprovedV2RuntimeContent();
const projection = content.competencyV2!;

function available(pathId: string, societyLevel: number, socialBand: number) {
  return resolveCompetencyV2PathAvailability({
    content,
    professionId: pathId,
    societyLevel,
    socialBand,
  })!;
}

describe("canonical V2 runtime projection", () => {
  it("resolves the canonical inventories through runtime fields", () => {
    expect(content.chargenCatalogue?.sourceId).toBe("competency-content-v2");
    expect(content.skillGroups).toHaveLength(95);
    expect(content.professionFamilies).toHaveLength(84);
    expect(projection.paths).toHaveLength(86);
    expect(projection.paths.flatMap((path) => path.coreRoutes)).toHaveLength(90);
    expect(
      new Set(projection.paths.filter((path) => path.trackId).map((path) => path.familyId)),
    ).toEqual(new Set(["profession:sailor", "profession:surgeon"]));
    expect(content.skillGroups.flatMap((group) => group.selectionSlots ?? [])).toHaveLength(7);
    expect(getApprovedTargetChargenContent().skillGroups).toHaveLength(59);
  });

  it("reaches all 42 offered Specialization and parent pairs from projected paths", () => {
    const specializations = new Map(content.specializations.map((row) => [row.id, row]));
    let pairs = 0;
    for (const path of projection.paths) {
      const groups = path.routes
        .filter((route) => route.groupId)
        .map((route) => content.skillGroups.find((group) => group.id === route.groupId)!);
      const offered = new Set([
        ...path.routes.flatMap((route) => route.specializationIds),
        ...groups.flatMap((group) => group.specializationIds ?? []),
      ]);
      const reachable = new Set([
        ...path.routes.flatMap((route) => route.skillIds),
        ...groups.flatMap((group) => [
          ...(group.skillMemberships ?? []).map((row) => row.skillId),
          ...(group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds),
        ]),
        ...offered,
      ]);
      for (const id of offered) {
        const specialization = specializations.get(id);
        expect(specialization, `${path.id}/${id}`).toBeDefined();
        expect(reachable.has(specialization!.skillId), `${path.id}/${id}`).toBe(true);
        pairs++;
      }
    }
    expect(pairs).toBe(42);
  });

  it("resolves all written competencies and a Civilization with and without writing", () => {
    expect(projection.writtenCompetencyIds).toEqual(
      competencyContentV2WrittenLanguageCompetencyIds,
    );
    expect(projection.writtenCompetencyIds).toHaveLength(11);
    for (const id of projection.writtenCompetencyIds) {
      const skill = content.skills.find((row) => row.id === id)!;
      expect("competencyType" in skill ? skill.competencyType : undefined).toBe(
        "written-tradition",
      );
      expect(skill?.linkedStats).toEqual(["int", "int"]);
      expect(projection.civilizationLanguages.some((row) => row.writtenCompetencyId === id)).toBe(
        true,
      );
    }
    expect(
      projection.civilizationLanguages.find((row) => row.civilizationId === "scandia")
        ?.writtenCompetencyId,
    ).toBe("written:scandian:runic-scandian");
    expect(
      projection.civilizationLanguages.find((row) => row.civilizationId === "san_forager_bands")
        ?.writtenCompetencyId,
    ).toBeUndefined();
    const scandian = buildChargenMotherTongueSummary({
      content,
      civilizationId: "scandia",
      educationLevel: 0,
    });
    const tuu = buildChargenMotherTongueSummary({
      content,
      civilizationId: "san_forager_bands",
      educationLevel: 0,
    });
    expect(scandian).toMatchObject({
      languageName: "Scandian",
      spokenCompetencyId: "spoken:scandian",
      writtenCompetencyId: "written:scandian:runic-scandian",
    });
    expect(tuu).toMatchObject({ languageName: "Tuu", spokenCompetencyId: "spoken:tuu" });
    expect(tuu.writtenCompetencyId).toBeUndefined();
  });

  it("recognizes any one applicable core alternative, and rejects none", () => {
    const courier = projection.paths.find((path) => path.id === "profession:courier")!;
    expect(courier.coreRoutes).toHaveLength(3);
    expect(
      getSatisfiedCompetencyV2CoreRouteIds({
        coreRoutes: courier.coreRoutes,
        groupIds: ["F04"],
        directSkillIds: [],
        writtenCompetencyIds: [],
      }),
    ).toEqual(["profession:courier:core:foot"]);
    expect(
      getSatisfiedCompetencyV2CoreRouteIds({
        coreRoutes: courier.coreRoutes,
        groupIds: ["G05"],
        directSkillIds: [],
        writtenCompetencyIds: [],
      }),
    ).toEqual(["profession:courier:core:mounted"]);
    expect(
      getSatisfiedCompetencyV2CoreRouteIds({
        coreRoutes: courier.coreRoutes,
        groupIds: [],
        directSkillIds: [],
        writtenCompetencyIds: [],
      }),
    ).toEqual([]);
  });

  it("resolves 24 non-empty availability cells monotonically in both dimensions", () => {
    const cells = new Map<string, Set<string>>();
    for (let societyLevel = 1; societyLevel <= 6; societyLevel++) {
      for (let socialBand = 1; socialBand <= 4; socialBand++) {
        const valid = projection.paths
          .filter((path) => available(path.id, societyLevel, socialBand).valid)
          .map((path) => path.id);
        expect(valid.length, `${societyLevel}/L${socialBand}`).toBeGreaterThan(0);
        cells.set(`${societyLevel}/L${socialBand}`, new Set(valid));
      }
    }
    expect(cells.size).toBe(24);
    for (let societyLevel = 1; societyLevel <= 6; societyLevel++) {
      for (let socialBand = 1; socialBand <= 4; socialBand++) {
        const current = cells.get(`${societyLevel}/L${socialBand}`)!;
        for (const higher of [
          societyLevel < 6 ? cells.get(`${societyLevel + 1}/L${socialBand}`) : undefined,
          socialBand < 4 ? cells.get(`${societyLevel}/L${socialBand + 1}`) : undefined,
        ]) {
          if (higher) for (const id of current) expect(higher.has(id), id).toBe(true);
        }
      }
    }
  });

  it("makes pick-N slots affect actual purchases", () => {
    const base = {
      content,
      professionId: "profession:soldier",
      societyId: "renaissance_city_state",
      societyLevel: 4,
      targetId: "M03",
      targetType: "group" as const,
    };
    const progression = createChargenProgression();
    const slot = buildChargenSelectableSkillSummary({ ...base, progression }).selectionSlots.find(
      (row) => row.groupId === "M03",
    )!;
    expect(slot.chooseCount).toBe(2);
    expect(allocateChargenPoint({ ...base, progression }).error).toContain(slot.label);
    const selected = {
      ...progression,
      chargenSelections: {
        ...progression.chargenSelections,
        selectedLanguageIds: progression.chargenSelections?.selectedLanguageIds ?? [],
        selectedSkillIds: progression.chargenSelections?.selectedSkillIds ?? [],
        selectedGroupSlots: [
          {
            groupId: slot.groupId,
            slotId: slot.slotId,
            selectedSkillIds: slot.candidateSkillIds.slice(0, slot.chooseCount),
          },
        ],
      },
    };
    expect(allocateChargenPoint({ ...base, progression: selected }).error).toBeUndefined();
  });

  it("gates a route at low Society Level and Social Band during acquisition", () => {
    const base = {
      content,
      professionId: "profession:field-guide",
      targetId: "F06",
      targetType: "group" as const,
      progression: createChargenProgression(),
    };
    expect(
      allocateChargenPoint({ ...base, societyId: "forager_ritual_tribal", societyLevel: 2 }).error,
    ).toContain("not part of the selected profession");
    expect(
      allocateChargenPoint({ ...base, societyId: "pastoral_clan_nomadic", societyLevel: 1 }).error,
    ).toContain("not part of the selected profession");
    expect(
      allocateChargenPoint({ ...base, societyId: "pastoral_clan_nomadic", societyLevel: 2 }).error,
    ).toBeUndefined();
  });

  it("keeps every base Skill discoverable on the individual purchase surface", () => {
    const access = buildChargenSkillAccessSummary({
      content,
      professionId: "profession:soldier",
      societyId: "renaissance_city_state",
      societyLevel: 4,
    });
    const baseSkillIds = content.skills
      .filter((skill) => !skill.specializationOfSkillId)
      .map((skill) => skill.id);

    expect(access.otherSkillIds).toEqual(expect.arrayContaining(baseSkillIds));
    expect(access.otherSkillIds).toContain("brawling");
    expect(access.otherSkillIds).toEqual(expect.arrayContaining(access.normalSkillIds));
  });

  it("resolves V2 flexible group access at band 4 without a Profession filter", () => {
    const allowed = getAllowedSecondaryGroupIds(content, "renaissance_city_state", 4);
    const courier = available("profession:courier", 6, 4);

    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.some((groupId) => !courier.availableGroupIds.includes(groupId))).toBe(true);
    expect(allowed).toEqual(
      expect.arrayContaining(
        projection.groupBounds
          .filter(
            (bound) =>
              (bound.minSocietyLevel ?? 1) <= 6 &&
              Number((bound.minSocialBand ?? "L1").slice(1)) <= 4,
          )
          .map((bound) => bound.groupId),
      ),
    );
  });

  it("persists one applicable core route for completion without narrowing acquisition", () => {
    const base = {
      content,
      professionId: "profession:courier",
      societyId: "pastoral_clan_nomadic",
      societyLevel: 1,
    };
    const progression = createChargenProgression();
    const missingSelection = buildChargenCoreRouteStatus({
      ...base,
      progression,
      socialBand: base.societyLevel,
    });

    expect(missingSelection.applicableRoutes).toHaveLength(3);
    expect(missingSelection.requiresSelection).toBe(true);
    expect(missingSelection.isSelectionValid).toBe(false);

    progression.chargenSelections = {
      ...progression.chargenSelections!,
      selectedCoreRouteId: "profession:courier:core:foot",
    };
    const before = buildChargenCoreRouteStatus({
      ...base,
      progression,
      socialBand: base.societyLevel,
    });
    expect(before.effectiveRoute?.id).toBe("profession:courier:core:foot");
    expect(before.isComplete).toBe(false);

    const foot = allocateChargenPoint({
      ...base,
      progression,
      targetId: "F04",
      targetType: "group",
    });
    expect(foot.error).toBeUndefined();
    expect(
      buildChargenCoreRouteStatus({
        ...base,
        progression: foot.progression,
        socialBand: base.societyLevel,
      }).isComplete,
    ).toBe(true);

    const otherRoutePurchase = allocateChargenPoint({
      ...base,
      progression: foot.progression,
      targetId: "G05",
      targetType: "group",
    });
    expect(otherRoutePurchase.error).toBeUndefined();
    expect(otherRoutePurchase.progression.chargenSelections?.selectedCoreRouteId).toBe(
      "profession:courier:core:foot",
    );
  });

  it("uses the sole applicable core route without persisting an artificial choice", () => {
    const progression = createChargenProgression();
    const status = buildChargenCoreRouteStatus({
      content,
      professionId: "profession:courier",
      progression,
      societyId: "forager_ritual_tribal",
      socialBand: 1,
    });

    expect(status.applicableRoutes.map((route) => route.id)).toEqual([
      "profession:courier:core:foot",
    ]);
    expect(status.requiresSelection).toBe(false);
    expect(status.isSelectionValid).toBe(true);
    expect(status.effectiveRoute?.id).toBe("profession:courier:core:foot");
    expect(progression.chargenSelections?.selectedCoreRouteId).toBeUndefined();
  });

  it("splits one eligible purchase across Ordinary then Flexible funds", () => {
    expect(
      chooseChargenPool({
        cost: 7,
        normalAccess: true,
        progression: {
          ...createChargenProgression(),
          primaryPoolSpent: 58,
          secondaryPoolTotal: 5,
        },
      }),
    ).toEqual({ primary: 2, secondary: 5 });
  });

  it("reallocates identical builds deterministically regardless of purchase order", () => {
    const context = {
      content,
      professionId: "profession:courier",
      societyId: "pastoral_clan_nomadic",
      societyLevel: 1,
    };
    const buyInOrder = (skillIds: string[]) => {
      let progression = {
        ...createChargenProgression(),
        primaryPoolTotal: 1,
        secondaryPoolTotal: 20,
      };
      for (const targetId of skillIds) {
        const result = allocateChargenPoint({
          ...context,
          progression,
          targetId,
          targetType: "skill",
        });
        expect(result.error).toBeUndefined();
        progression = result.progression;
      }
      return progression;
    };
    const first = buyInOrder(["skill:wayfinding", "skill:deception"]);
    const second = buyInOrder(["skill:deception", "skill:wayfinding"]);

    expect(first.primaryPoolSpent).toBe(second.primaryPoolSpent);
    expect(first.secondaryPoolSpent).toBe(second.secondaryPoolSpent);
    expect(
      first.skills
        .map(({ skillId, category, primaryRanks, secondaryRanks }) => ({
          skillId,
          category,
          primaryRanks,
          secondaryRanks,
        }))
        .sort((left, right) => left.skillId.localeCompare(right.skillId)),
    ).toEqual(
      second.skills
        .map(({ skillId, category, primaryRanks, secondaryRanks }) => ({
          skillId,
          category,
          primaryRanks,
          secondaryRanks,
        }))
        .sort((left, right) => left.skillId.localeCompare(right.skillId)),
    );
  });

  it("gives a Specialization-only Learning Group no price and no purchase action", () => {
    const specializedContent = structuredClone(content);
    specializedContent.skillGroups.push({
      id: "test:specialization-only",
      name: "Specialization-only instruction",
      specializationIds: ["fencing"],
      sortOrder: 999,
    });
    const courier = specializedContent.competencyV2!.paths.find(
      (path) => path.id === "profession:courier",
    )!;
    courier.routes.push({
      groupId: "test:specialization-only",
      id: "test:specialization-only-route",
      kind: "group",
      label: "Specialization-only route",
      skillIds: [],
      specializationIds: [],
    });
    const progression = createChargenProgression();

    // Rule decision 0011, Product Owner 2026-09-27: a Learning Group with no base-Skill
    // contribution that only supplies access to a genuine Specialization has a Group
    // purchase cost of 0 and no XP-buy action for the Group itself. The incidental flat
    // price of 1 is retired, and a zero-cost purchase that still records a purchase is not
    // what was ruled, so the Group is not purchasable at all.
    expect(
      isSpecializationAccessOnlyChargenGroup({
        content: specializedContent,
        groupId: "test:specialization-only",
        progression,
      }),
    ).toBe(true);
    expect(
      getActiveGroupSkillCost({
        content: specializedContent,
        groupId: "test:specialization-only",
        progression,
      }),
    ).toEqual({ error: SPECIALIZATION_ACCESS_ONLY_GROUP_UNPURCHASABLE_MESSAGE });
    expect(
      getChargenGroupBundleCost({
        content: specializedContent,
        progression: {
          ...progression,
          skillGroups: [
            {
              gms: 0,
              grantedRanks: 0,
              groupId: "test:specialization-only",
              primaryRanks: 2,
              ranks: 2,
              secondaryRanks: 0,
            },
          ],
        },
      }).cost,
    ).toBe(0);
    const purchase = allocateChargenPoint({
      content: specializedContent,
      professionId: "profession:courier",
      progression,
      societyId: "pastoral_clan_nomadic",
      societyLevel: 1,
      targetId: "test:specialization-only",
      targetType: "group",
    });
    expect(purchase.error).toBe(SPECIALIZATION_ACCESS_ONLY_GROUP_UNPURCHASABLE_MESSAGE);
    expect(purchase.progression.skillGroups).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: "test:specialization-only", primaryRanks: 1 }),
      ]),
    );
    expect(purchase.progression.specializations).toHaveLength(0);
  });
});
