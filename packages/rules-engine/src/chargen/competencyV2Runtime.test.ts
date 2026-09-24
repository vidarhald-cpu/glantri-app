import { describe, expect, it } from "vitest";
import {
  competencyContentV2WrittenLanguageCompetencyIds,
  getApprovedTargetChargenContent,
  getApprovedV2RuntimeContent,
} from "@glantri/content";
import { allocateChargenPoint, createChargenProgression } from "./primaryAllocation";
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
});
