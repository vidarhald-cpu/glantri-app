import { describe, expect, it } from "vitest";

import { fullSkillCatalogueProposal } from "../../skillContentPlatform/fullSkillCatalogueProposal";
import { targetLearningGroupCatalogue } from "../../skillContentPlatform/targetLearningGroups";
import { targetProfessionCatalogue } from "../../targetProfessions";
import {
  analyseCompetencyContentV2,
  BREADTH_REVIEW_FLOOR,
  buildCompetencyContentV2Catalogue,
  competencyContentV2Catalogue,
  EFFECTIVE_BREADTH_SIGNAL,
  GROUP_SIZE_REVIEW_BAND,
  measureApprovedBaseline,
} from "./competencyContentV2";
import {
  COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID,
  COMPETENCY_CONTENT_V2_STATUS,
  competencyContentV2CivilizationLanguages,
  competencyContentV2DirectGrantDecisions,
  competencyContentV2Families,
  competencyContentV2LearningGroups,
  competencyContentV2RemovedGroups,
} from "./competencyContentV2Source";

const catalogue = competencyContentV2Catalogue;

describe("Competency Content V2 proposal status", () => {
  it("is marked non-canonical", () => {
    expect(COMPETENCY_CONTENT_V2_STATUS).toBe("non-canonical-product-owner-proposal");
    expect(catalogue.status).toBe("non-canonical-product-owner-proposal");
  });

  it("leaves the approved catalogues untouched", () => {
    expect(targetProfessionCatalogue.families).toHaveLength(84);
    expect(targetLearningGroupCatalogue.manifest.groups).toBe(59);
    expect(fullSkillCatalogueProposal.manifest.baseSkills).toBe(131);
  });
});

describe("deterministic catalogue checks", () => {
  it("builds without a validation failure and is stable", () => {
    expect(buildCompetencyContentV2Catalogue().manifest.digest).toBe(catalogue.manifest.digest);
  });

  it("keeps every one of the 84 Profession families", () => {
    expect(catalogue.manifest.families).toBe(84);
    expect(new Set(competencyContentV2Families.map((family) => family.code)).size).toBe(84);
    const approvedCodes = targetProfessionCatalogue.families.map((family) => family.code).sort();
    expect(competencyContentV2Families.map((family) => family.code).sort()).toEqual(approvedCodes);
  });

  it("accounts for every approved Learning Group as retained, revised or removed", () => {
    const accounted = new Set([
      ...competencyContentV2LearningGroups.map((group) => group.id),
      ...competencyContentV2RemovedGroups.map((group) => group.id),
    ]);
    for (const group of targetLearningGroupCatalogue.groups) expect(accounted).toContain(group.id);
    expect(catalogue.manifest.removedGroups).toBe(11);
  });

  it("preserves the 131 base-Skill catalogue without adding or renaming a Skill", () => {
    expect(catalogue.coverage.baseSkills).toBe(131);
    const approvedIds = new Set(fullSkillCatalogueProposal.entries.map((entry) => entry.id));
    const used = new Set(
      competencyContentV2LearningGroups.flatMap((group) => [
        ...group.fixedSkillIds,
        ...(group.specializationIds ?? []),
        ...(group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds),
      ]),
    );
    for (const id of used) expect(approvedIds).toContain(id);
  });

  it("restores first-class pick-N choice slots", () => {
    expect(catalogue.manifest.groupsWithSelectionSlots).toBeGreaterThanOrEqual(7);
    for (const group of competencyContentV2LearningGroups)
      for (const slot of group.selectionSlots ?? []) {
        expect(slot.chooseCount).toBeGreaterThan(0);
        expect(slot.candidateSkillIds.length).toBeGreaterThanOrEqual(slot.chooseCount);
        for (const candidate of slot.candidateSkillIds)
          expect(group.fixedSkillIds).not.toContain(candidate);
      }
  });

  it("restores the seven historical choice-slot structures", () => {
    const slotCounts = Object.fromEntries(
      competencyContentV2LearningGroups
        .filter((group) => group.selectionSlots?.length)
        .map((group) => [group.id, group.selectionSlots!.map((slot) => slot.chooseCount)]),
    );
    expect(slotCounts.M01).toEqual([1]); // Basic Melee Training
    expect(slotCounts.M02).toEqual([3]); // Advanced Melee Training
    expect(slotCounts.M04).toEqual([1]); // Basic Missile Training
    expect(slotCounts.M05).toEqual([3]); // Advanced Missile Training
    expect(slotCounts.C01).toEqual([1]); // Craft Specialty
    expect(slotCounts.C02).toHaveLength(1); // Advanced Craft Specialty — count deliberately unsettled
    expect(slotCounts.C03).toEqual([2]); // Construction Specialty
  });

  it("leaves the Advanced Craft Specialty count unresolved rather than settling it by breadth pressure", () => {
    const advancedCraft = competencyContentV2LearningGroups.find((group) => group.id === "C02")!;
    const slot = advancedCraft.selectionSlots![0]!;
    expect(slot.chooseCountStatus).toBe("unresolved-source-conflict");
    expect(slot.conflictingChooseCounts).toEqual([1, 2, 3]);
    // The proposal counts the lowest evidenced value so no content depends on the open question.
    expect(slot.chooseCount).toBe(Math.min(...slot.conflictingChooseCounts!));
  });

  it("records the approved Advanced Melee count with its conflict kept as provenance", () => {
    const advancedMelee = competencyContentV2LearningGroups.find((group) => group.id === "M02")!;
    const slot = advancedMelee.selectionSlots![0]!;
    expect(slot.chooseCount).toBe(3);
    expect(slot.chooseCountStatus).toBe("approved");
    expect(slot.conflictingChooseCounts).toEqual([2, 3]);
  });

  it("gives combat alternative weapon families choice slots rather than fixed charges", () => {
    const weaponFamilies = [
      "one_handed_edged",
      "one_handed_concussion_axe",
      "two_handed_edged",
      "two_handed_concussion_axe",
      "polearms",
    ];
    for (const group of competencyContentV2LearningGroups) {
      const fixedFamilies = group.fixedSkillIds.filter((id) => weaponFamilies.includes(id));
      // F30 is a single named fencing tradition; F32 is defined by the lance.
      if (group.id === "F30" || group.id === "F32") continue;
      expect(fixedFamilies).toHaveLength(0);
    }
  });

  it("restores general 2-h edged access", () => {
    const routes = competencyContentV2LearningGroups.filter((group) =>
      (group.selectionSlots ?? []).some((slot) =>
        slot.candidateSkillIds.includes("two_handed_edged"),
      ),
    );
    expect(routes.map((group) => group.id).sort()).toEqual(["M01", "M02", "M03"]);
  });

  it("keeps Specializations out of base-Skill breadth", () => {
    for (const path of catalogue.paths)
      for (const specializationId of path.reachableSpecializationIds)
        expect(path.fixedSkillIds).not.toContain(specializationId);
  });

  it("supplies every reachable Specialization's immediate parent inside the same path", () => {
    expect(catalogue.coverage.specializationsWhoseParentIsUnreachableInTheSameFamily).toEqual([]);
  });

  it("closes the Herald parent-access gaps", () => {
    const herald = catalogue.paths.find((path) => path.professionCode === "P76")!;
    expect(herald.reachableSpecializationIds).toContain("spec:genealogy");
    expect(herald.reachableSpecializationIds).toContain("spec:courtly-protocol");
    expect(herald.fixedSkillIds).toContain("history");
    expect(herald.fixedSkillIds).toContain("skill:customs");
  });

  it("applies the approved Medicine -> Obstetrics correction for the Birth Attendant", () => {
    const midwife = catalogue.paths.find((path) => path.professionCode === "P33")!;
    expect(midwife.reachableSpecializationIds).toContain("obstetrics");
    expect(midwife.fixedSkillIds).toContain("skill:medicine");
    expect(midwife.effectiveBreadthNominal).toBeGreaterThanOrEqual(BREADTH_REVIEW_FLOOR);
  });

  it("does not resolve the blocked or deliberately absent routes", () => {
    expect(catalogue.coverage.baseSkillsWithoutAnyRoute.map((skill) => skill.id)).toEqual([
      "skill:poisons",
    ]);
    expect(catalogue.coverage.specializationsWithoutAnyRoute.map((skill) => skill.id)).toEqual([
      "spec:warded-lock-entry",
    ]);
    const scribe = competencyContentV2Families.find((family) => family.code === "P65")!;
    expect(scribe.note).toContain("#113");
  });

  it("requires a stated route for every opportunity", () => {
    for (const family of competencyContentV2Families) {
      const bodies = [family, ...(family.tracks ?? [])];
      for (const body of bodies) {
        for (const route of body.groups ?? []) expect(route.route.trim().length).toBeGreaterThan(0);
        if ((body.skillIds?.length ?? 0) + (body.specializationIds?.length ?? 0) > 0)
          expect(body.directRoute?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

describe("player-facing Skill categories", () => {
  it("assigns a real category to every competency and retires special-access", () => {
    expect(catalogue.categories).toHaveLength(131 + 26);
    for (const row of catalogue.categories)
      expect(row.categoryId).not.toBe(COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID);
  });

  it("preserves and uses the language category", () => {
    expect(catalogue.categories.every((row) => row.categoryId !== "language")).toBe(true);
    // Languages are contextual competencies, not base Skills; the bucket is reserved for them.
    expect(competencyContentV2CivilizationLanguages.length).toBeGreaterThan(0);
  });
});

describe("Civilization language competencies", () => {
  it("covers every canonical Civilization with a spoken competency", () => {
    expect(competencyContentV2CivilizationLanguages).toHaveLength(16);
    for (const row of competencyContentV2CivilizationLanguages)
      expect(row.spokenName.startsWith("Spoken ")).toBe(true);
  });

  it("proposes a written tradition unless the Civilization is authored as having no writing", () => {
    const withoutWriting = competencyContentV2CivilizationLanguages.filter(
      (row) => row.writtenName === null,
    );
    expect(withoutWriting.map((row) => row.civilizationId).sort()).toEqual([
      "san_forager_bands",
      "scythians",
    ]);
  });

  it("replaces the real-world analogue names it can settle and flags the rest", () => {
    const lankhmar = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "lankhmar",
    )!;
    expect(lankhmar.replacesAnalogueSpokenName).toBe("Spoken Phoenician");
    expect(lankhmar.requiresProductOwnerNamingRuling).toBe(false);
    for (const row of competencyContentV2CivilizationLanguages)
      if (row.replacesAnalogueSpokenName && row.civilizationId !== "lankhmar")
        expect(row.requiresProductOwnerNamingRuling).toBe(true);
  });
});

describe("quantitative effective-breadth analysis", () => {
  const analysis = analyseCompetencyContentV2();

  it("measures the approved baseline over all 99 valid paths", () => {
    expect(measureApprovedBaseline()).toHaveLength(99);
    expect(analysis.approved.median).toBeLessThan(BREADTH_REVIEW_FLOOR);
  });

  it("treats the ~10 signal as a diagnostic, not a floor every path must clear", () => {
    expect(EFFECTIVE_BREADTH_SIGNAL).toBe(10);
    expect(analysis.proposed.paths).toBe(catalogue.manifest.validPaths);
    expect(analysis.proposed.median).toBeGreaterThanOrEqual(BREADTH_REVIEW_FLOOR);
    expect(analysis.proposed.median).toBeLessThanOrEqual(EFFECTIVE_BREADTH_SIGNAL);
  });

  it("leaves no path below the review floor except those marked narrow by design", () => {
    expect(analysis.reviewPrompts).toEqual([]);
    expect(analysis.narrowByDesignPaths.length).toBeGreaterThan(0);
  });

  it("counts only chooseCount per slot, never the whole candidate pool", () => {
    const melee = catalogue.paths.find(
      (path) => path.pathId === "profession:soldier:formation-soldier",
    )!;
    expect(melee.slotSelections).toBe(2);
    expect(melee.effectiveBreadthNominal).toBe(melee.fixedSkillIds.length + 2);
    expect(melee.effectiveBreadthMinimum).toBe(melee.fixedSkillIds.length);
  });

  it("evaluates mutually exclusive tracks separately", () => {
    const sailor = catalogue.paths.filter((path) => path.professionCode === "P09");
    expect(sailor).toHaveLength(2);
    expect(new Set(sailor.map((path) => path.pathId)).size).toBe(2);
  });
});

describe("Learning Group size review", () => {
  it("has no group outside the 2-4 band without a stated justification", () => {
    for (const row of catalogue.groupSizes)
      if (row.band !== "in-band") expect(row.justification?.length ?? 0).toBeGreaterThan(0);
  });

  it("retired the one-Skill groups the size review found", () => {
    expect(catalogue.manifest.groupsBelowSizeBand).toBe(0);
    expect(competencyContentV2LearningGroups.some((group) => group.id === "F16")).toBe(false);
    const seasonalKitchen = competencyContentV2LearningGroups.find((group) => group.id === "F22")!;
    expect(seasonalKitchen.fixedSkillIds.length).toBeGreaterThan(1);
  });

  it("keeps every above-band group advanced, compound or choice-driven", () => {
    for (const row of catalogue.groupSizes.filter((candidate) => candidate.band === "above-band"))
      expect(row.slotSize).toBeGreaterThan(0);
    expect(GROUP_SIZE_REVIEW_BAND).toEqual([2, 4]);
  });

  it("keeps the fixed purchase burden of any group within reason", () => {
    expect(catalogue.manifest.maximumFixedGroupBurden).toBeLessThanOrEqual(6);
  });
});

describe("direct-grant review", () => {
  it("records a rationale for every reviewed grant", () => {
    expect(competencyContentV2DirectGrantDecisions.length).toBeGreaterThan(0);
    for (const decision of competencyContentV2DirectGrantDecisions) {
      expect(decision.rationale.trim().length).toBeGreaterThan(0);
      expect(decision.removedFrom.length + decision.retainedIn.length).toBeGreaterThan(0);
    }
  });

  it("matches the authored catalogue exactly", () => {
    for (const decision of competencyContentV2DirectGrantDecisions) {
      for (const code of decision.removedFrom) {
        const family = competencyContentV2Families.find((candidate) => candidate.code === code)!;
        expect(family.skillIds ?? []).not.toContain(decision.skillId);
      }
      for (const code of decision.retainedIn) {
        const family = competencyContentV2Families.find((candidate) => candidate.code === code)!;
        expect(family.skillIds ?? []).toContain(decision.skillId);
      }
    }
  });

  it("substantially reduces the direct-grant count", () => {
    expect(catalogue.manifest.directSkillOpportunities).toBeLessThan(150);
  });
});
