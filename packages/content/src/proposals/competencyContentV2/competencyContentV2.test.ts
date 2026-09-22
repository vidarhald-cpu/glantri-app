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
  GROUP_SIZE_PREFERRED_CENTRE,
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
  competencyContentV2RetiredProposedGroups,
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
    expect(catalogue.manifest.removedGroups).toBe(13);
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

  it("restores the historical choice-slot structures that survive the membership ruling", () => {
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
    expect(slotCounts.C02).toEqual([1]); // Advanced Craft Specialty — settled at exactly one
    /* Construction Specialty is gone with C03, which the 2026-09-21 membership ruling retires. */
    expect(slotCounts.C03).toBeUndefined();
  });

  it("holds C02 to the settled shape: Appraisal, Bargaining, Teaching and exactly one craft", () => {
    const advancedCraft = competencyContentV2LearningGroups.find((group) => group.id === "C02")!;
    expect([...advancedCraft.fixedSkillIds].sort()).toEqual([
      "skill:appraisal",
      "skill:bargaining",
      "skill:teaching",
    ]);
    expect(advancedCraft.selectionSlots).toHaveLength(1);
    const slot = advancedCraft.selectionSlots![0]!;
    expect(slot.chooseCount).toBe(1);
    expect(slot.chooseCountStatus).toBe("approved");
    // The ruling forbids raising the count under breadth pressure, so nothing records it as open.
    expect(slot.conflictingChooseCounts).toBeUndefined();
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
    expect(lankhmar.spokenName).toBe("Spoken Lankhmaran");
    expect(lankhmar.requiresProductOwnerNamingRuling).toBe(false);
  });

  it("carries no invented Glantri language or script name", () => {
    const withdrawn = [
      "Kethran",
      "Old Latian",
      "Palace Scyrian",
      "Kaldan",
      "Aspardic",
      "Harbour Hand",
      "Hill Script",
      "Palace Syllabary",
      "Wedge Script",
      "Chancery Script",
      "Common Hand",
      "Royal N'kolian",
    ];
    for (const row of competencyContentV2CivilizationLanguages)
      for (const invented of withdrawn) {
        expect(row.spokenName).not.toContain(invented);
        expect(row.writtenName ?? "").not.toContain(invented);
      }
  });

  it("gives every Civilization a rollable written competency unless it has no writing", () => {
    for (const row of competencyContentV2CivilizationLanguages)
      if (row.writtenName !== null) expect(row.writtenName.startsWith("Written ")).toBe(true);
  });

  it("flags Olog for later correction without correcting it here", () => {
    const olog = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "olog",
    )!;
    expect(olog.spokenName).toBe("Spoken Ologian");
    expect(olog.note).toContain("FLAGGED FOR LATER CORRECTION");
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

  it("flags the paths the membership ruling took below the coherence floor, and no others", () => {
    /* The 2026-09-21 Learning-Group membership ruling deliberately narrowed K01, M10, C06 and C07 and
       retired C03, knowing breadth would fall. A flag is a prompt to look, never a defect and never a
       licence to pad, so the flagged set is asserted exactly rather than allowed to drift. Three are
       scholarly paths that lost Mathematics with K01; three are construction paths that lost C03. */
    expect(analysis.reviewPrompts.map((row) => row.professionCode).sort()).toEqual([
      "P39",
      "P40",
      "P49",
      "P64",
      "P65",
      "P67",
    ]);
    for (const prompt of analysis.reviewPrompts)
      expect(prompt.effectiveBreadthNominal).toBeLessThan(BREADTH_REVIEW_FLOOR);
    /* Being flagged is not being broken: every flagged path still satisfies its defining core. */
    for (const prompt of analysis.reviewPrompts) {
      const cores = catalogue.coreRoutes.filter(
        (row) => row.professionCode === prompt.professionCode,
      );
      expect(cores.some((row) => row.satisfied)).toBe(true);
    }
    /* No path is rescued by a narrow-by-design exemption; there is still no such mechanism. */
    expect(analysis.proposed.median).toBeGreaterThanOrEqual(BREADTH_REVIEW_FLOOR);
  });

  it("counts only chooseCount per slot, never the whole candidate pool", () => {
    const melee = catalogue.paths.find((path) => path.pathId === "profession:soldier")!;
    /* M01 chooses 1, M03 chooses 2, M04 chooses 1: six candidate pools, four selections. */
    expect(melee.slotSelections).toBe(4);
    expect(melee.effectiveBreadthNominal).toBe(melee.fixedSkillIds.length + 4);
    expect(melee.effectiveBreadthMinimum).toBe(melee.fixedSkillIds.length);
  });

  it("evaluates mutually exclusive tracks separately", () => {
    const sailor = catalogue.paths.filter((path) => path.professionCode === "P09");
    expect(sailor).toHaveLength(2);
    expect(new Set(sailor.map((path) => path.pathId)).size).toBe(2);
  });
});

describe("Learning Group shape ruling", () => {
  it("centres the catalogue on 3-4 effective base Skills", () => {
    expect(GROUP_SIZE_PREFERRED_CENTRE).toEqual([3, 4]);
    expect(GROUP_SIZE_REVIEW_BAND).toEqual([2, 4]);
    expect(catalogue.manifest.groupsInPreferredCentre).toBeGreaterThan(
      catalogue.manifest.groupsAtTwo,
    );
  });

  it("leaves no group at one effective base Skill", () => {
    expect(catalogue.manifest.groupsNeedingReconsideration).toBe(0);
    expect(catalogue.manifest.groupsBelowSizeBand).toBe(0);
  });

  it("justifies every group at five or more", () => {
    const large = catalogue.groupSizes.filter((row) => row.shape === "justified-large");
    expect(large.length).toBeGreaterThan(0);
    for (const row of large) expect(row.justification?.length ?? 0).toBeGreaterThan(0);
  });

  it("retires F16 and F22 while preserving their Specialization routes", () => {
    for (const id of ["F16", "F22"]) {
      expect(competencyContentV2LearningGroups.some((group) => group.id === id)).toBe(false);
      expect(competencyContentV2RemovedGroups.some((group) => group.id === id)).toBe(true);
    }
    for (const specializationId of ["spec:genealogy", "spec:food-preservation"])
      expect(
        catalogue.paths.filter((path) => path.reachableSpecializationIds.includes(specializationId))
          .length,
      ).toBeGreaterThan(0);
  });

  it("applies the named group corrections", () => {
    const masterArtisan = competencyContentV2LearningGroups.find((group) => group.id === "C02")!;
    expect([...masterArtisan.fixedSkillIds].sort()).toEqual(
      ["skill:appraisal", "skill:bargaining", "skill:teaching"].sort(),
    );
    expect(masterArtisan.selectionSlots?.[0]?.chooseCount).toBe(1);

    expect(competencyContentV2LearningGroups.some((group) => group.id === "F32")).toBe(false);
    const mounted = competencyContentV2LearningGroups.find((group) => group.id === "M11")!;
    expect([...mounted.fixedSkillIds].sort()).toEqual(["mounted_combat", "skill:riding"].sort());
    const lance = competencyContentV2LearningGroups.find((group) => group.id === "M12")!;
    expect([...lance.fixedSkillIds].sort()).toEqual(["formation_fighting", "lance"].sort());
  });

  it("keeps the fixed purchase burden of any group within reason", () => {
    expect(catalogue.manifest.maximumFixedGroupBurden).toBeLessThanOrEqual(6);
  });
});

describe("combat group structure", () => {
  const instructionGroupIds = [
    "M01",
    "M02",
    "M03",
    "M04",
    "M05",
    "M10",
    "M11",
    "M12",
    "F30",
    "F41",
  ];

  it("keeps Combat Experience out of every weapon-training group", () => {
    for (const id of instructionGroupIds) {
      const group = competencyContentV2LearningGroups.find((candidate) => candidate.id === id)!;
      expect(group.fixedSkillIds).not.toContain("combat_experience");
      for (const slot of group.selectionSlots ?? [])
        expect(slot.candidateSkillIds).not.toContain("combat_experience");
    }
  });

  it("supplies Combat Experience only through experiential routes", () => {
    const sources = competencyContentV2LearningGroups.filter((group) =>
      group.fixedSkillIds.includes("combat_experience"),
    );
    expect(sources.map((group) => group.id).sort()).toEqual(["K23", "M06"]);
    for (const family of competencyContentV2Families)
      expect(family.skillIds ?? []).not.toContain("combat_experience");
    expect(
      catalogue.paths.filter((path) => path.fixedSkillIds.includes("combat_experience")).length,
    ).toBeGreaterThan(0);
    expect(
      catalogue.paths.some(
        (path) => path.professionCode === "P82" && path.fixedSkillIds.includes("combat_experience"),
      ),
    ).toBe(false);
  });

  it("offers a focused melee package of guard, defence and one chosen weapon", () => {
    const focused = competencyContentV2LearningGroups.find((group) => group.id === "M01")!;
    expect([...focused.fixedSkillIds].sort()).toEqual(["dodge", "parry"]);
    expect(focused.selectionSlots?.[0]?.chooseCount).toBe(1);
  });

  it("lets broad groups pool across melee, missile, throwing and unarmed", () => {
    const broad = competencyContentV2LearningGroups.find((group) => group.id === "M02")!;
    const pool = broad.selectionSlots?.[0]?.candidateSkillIds ?? [];
    expect(pool).toContain("brawling");
    expect(pool).toContain("throwing");
    expect(
      competencyContentV2LearningGroups.find((group) => group.id === "M03")!.selectionSlots![0]!
        .candidateSkillIds,
    ).toContain("sling");
  });

  it("treats overlap between combat groups as intentional, not as an error", () => {
    const m01 = competencyContentV2LearningGroups.find((group) => group.id === "M01")!;
    const m03 = competencyContentV2LearningGroups.find((group) => group.id === "M03")!;
    const shared = m01.fixedSkillIds.filter((id) => m03.fixedSkillIds.includes(id));
    expect(shared.length).toBeGreaterThan(0);
    // Overlap never becomes a double charge: see the cost-invariant checks.
  });
});

describe("core routes and cost invariants", () => {
  it("gives every valid path at least one satisfied defining core route", () => {
    for (const path of catalogue.paths) {
      const cores = catalogue.coreRoutes.filter((row) => row.pathId === path.pathId);
      expect(cores.length).toBeGreaterThan(0);
      expect(cores.some((row) => row.satisfied)).toBe(true);
    }
  });

  it("records the blocked Scribe written-tradition core without inventing it", () => {
    const blocked = catalogue.coreRoutes.filter((row) => row.blockedBy);
    expect(blocked.length).toBeGreaterThan(0);
    for (const row of blocked) expect(row.blockedBy).toContain("#113");
  });

  it("never charges twice for the same competency on one path", () => {
    for (const row of catalogue.costInvariants) {
      expect(row.duplicatesAvoided).toBeGreaterThanOrEqual(0);
      expect(row.distinctCharged).toBeLessThanOrEqual(row.chargedAppearances);
    }
    expect(catalogue.manifest.duplicatePaymentsAvoided).toBeGreaterThan(0);
  });

  it("makes the final charged set independent of purchase order", () => {
    for (const row of catalogue.costInvariants) expect(row.orderIndependent).toBe(true);
  });
});

describe("Specialization access is access, not a grant", () => {
  it("never counts a Specialization toward base-Skill breadth", () => {
    const specializationIds = new Set(
      fullSkillCatalogueProposal.entries
        .filter((entry) => entry.competencyType === "specialization")
        .map((entry) => entry.id),
    );
    for (const path of catalogue.paths)
      for (const skillId of path.fixedSkillIds) expect(specializationIds.has(skillId)).toBe(false);
  });

  it("keeps the parent Skill reachable on every path that offers the Specialization", () => {
    expect(catalogue.coverage.specializationsWhoseParentIsUnreachableInTheSameFamily).toEqual([]);
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

  it("moves coherent direct-grant clusters into Learning Groups", () => {
    for (const id of ["K22", "K24", "K25", "M10"])
      expect(competencyContentV2LearningGroups.some((group) => group.id === id)).toBe(true);
    for (const code of ["P14", "P18", "P74", "P75", "P82"]) {
      const family = competencyContentV2Families.find((candidate) => candidate.code === code)!;
      expect((family.skillIds ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("second ruling set — track discipline", () => {
  it("keeps a track only where the defining training genuinely differs", () => {
    for (const family of competencyContentV2Families)
      for (const track of family.tracks ?? [])
        expect(track.coreRoutes?.length ?? 0).toBeGreaterThan(0);
  });

  it("retires every track that expressed only a weapon, Skill or equipment choice", () => {
    const withoutTracks = ["P14", "P22", "P24", "P25", "P26", "P82"];
    for (const code of withoutTracks) {
      const family = competencyContentV2Families.find((candidate) => candidate.code === code)!;
      expect(family.tracks ?? []).toHaveLength(0);
      expect(catalogue.paths.filter((path) => path.professionCode === code)).toHaveLength(1);
    }
  });

  it("collapses the four Soldier tracks into one identity reached through several combat groups", () => {
    const soldier = competencyContentV2Families.find((family) => family.code === "P22")!;
    const groupIds = (soldier.groups ?? []).map((route) => route.groupId);
    expect(groupIds).toEqual(expect.arrayContaining(["M01", "M03", "M04", "F41", "M06"]));
    const paths = catalogue.paths.filter((path) => path.professionCode === "P22");
    expect(paths).toHaveLength(1);
    expect(paths[0]!.groupIds).toContain("M06");
  });

  it("keeps the tracks whose cores differ", () => {
    const tracked = competencyContentV2Families.filter((family) => family.tracks?.length);
    expect(tracked.map((family) => family.code).sort()).toEqual(["P09", "P31"]);
  });
});

describe("second ruling set — core minimality", () => {
  it("keeps every core route minimal rather than a rigid class build", () => {
    for (const row of catalogue.coreRoutes)
      expect(row.groupIds.length + row.skillIds.length).toBeLessThanOrEqual(2);
  });

  it("expresses most cores as a single requirement", () => {
    const single = catalogue.coreRoutes.filter(
      (row) => row.groupIds.length + row.skillIds.length === 1,
    );
    expect(single.length).toBeGreaterThan(catalogue.coreRoutes.length / 2);
  });
});

describe("Profession cores ruling — 2026-09-21", () => {
  /**
   * The ruling rejects the premise that a core must discriminate one Profession from every other.
   * A core is a necessary defining training route; sharing one is legitimate where the training is
   * genuinely defining for each Profession. The affirmed cores are asserted so that a later breadth
   * or uniqueness pressure cannot quietly move them again.
   */
  const coreRequirements = (code: string): string[][] =>
    [
      ...new Map(
        catalogue.coreRoutes
          .filter((row) => row.professionCode === code)
          .map((row) => [row.coreRouteId, row]),
      ).values(),
    ].map((row) => [...row.groupIds, ...row.skillIds].sort());

  it("keeps the shared Learning Group cores the ruling affirms", () => {
    const affirmed: Record<string, string> = {
      P60: "G10",
      P61: "G10",
      P63: "G10",
      P58: "G11",
      P54: "C10",
      P35: "G02",
      P36: "F24",
      P37: "F24",
      P48: "F27",
      P81: "F04",
      P27: "M07",
      P26: "M07",
      P30: "G01",
    };
    for (const [code, groupId] of Object.entries(affirmed))
      expect(coreRequirements(code)).toEqual([[groupId]]);
  });

  it("lets a Learning Group be the core of more than one Profession", () => {
    const shared = new Map<string, string[]>();
    for (const row of catalogue.coreRoutes)
      for (const groupId of row.groupIds)
        shared.set(groupId, [...new Set([...(shared.get(groupId) ?? []), row.professionCode])]);
    /* G10 is the core of three Professions and G11, F24, M07 and F04 of two each. Under the ruling
       that is correct content, not a defect to be designed away. */
    expect(shared.get("G10")!.sort()).toEqual(["P60", "P61", "P63"]);
    for (const groupId of ["G11", "F24", "M07", "F04"]) expect(shared.get(groupId)!.length).toBe(2);
  });

  it("makes the direct competency route core for the Cook, the Gatherer and the Carpenter", () => {
    expect(coreRequirements("P53")).toEqual([["skill:cooking"]]);
    expect(coreRequirements("P02")).toEqual([["skill:plant-lore"]]);
    expect(coreRequirements("P39")).toEqual([["carpentry"]]);
    /* The displaced groups stay reachable as ordinary optional routes. */
    const groupsOf = (code: string) =>
      catalogue.paths.find((path) => path.professionCode === code)!.groupIds;
    expect(groupsOf("P53")).toContain("C10");
    expect(groupsOf("P02")).toContain("G02");
    expect(groupsOf("P39")).toContain("F27");
  });

  it("gives the Courier three alternative core routes rather than three tracks", () => {
    expect(coreRequirements("P12").flat().sort()).toEqual(["F04", "F06", "G05"]);
    const courier = competencyContentV2Families.find((family) => family.code === "P12")!;
    expect(courier.tracks ?? []).toHaveLength(0);
    /* Each alternative must be genuinely reachable, not merely declared. */
    for (const row of catalogue.coreRoutes.filter((r) => r.professionCode === "P12"))
      expect(row.satisfied).toBe(true);
  });

  it("removes M06 from the Soldier core and keeps it as an experiential route", () => {
    expect(coreRequirements("P22").flat().sort()).toEqual(["M01", "M03", "M04"]);
    const soldier = competencyContentV2Families.find((family) => family.code === "P22")!;
    expect(soldier.tracks ?? []).toHaveLength(0);
    expect((soldier.groups ?? []).map((route) => route.groupId)).toContain("M06");
    for (const row of catalogue.coreRoutes.filter((r) => r.professionCode === "P22"))
      expect(row.satisfied).toBe(true);
  });

  it("never makes Campaign service experience the core of any Profession", () => {
    for (const row of catalogue.coreRoutes) expect(row.groupIds).not.toContain("M06");
  });

  it("retains the Smuggler's two-route core and the Surgeon's track cores", () => {
    expect(coreRequirements("P20")).toEqual([["G12", "K18"]]);
    const surgeonCores = catalogue.coreRoutes.filter((row) => row.professionCode === "P31");
    expect(surgeonCores.map((row) => row.groupIds.join("+")).sort()).toEqual(["F29", "G18"]);
  });

  it("records the Scribe core as G11 plus a written-language route that stays blocked on #113", () => {
    const scribe = catalogue.coreRoutes.filter((row) => row.professionCode === "P65");
    expect(scribe).toHaveLength(1);
    expect(scribe[0]!.groupIds).toEqual(["G11"]);
    expect(scribe[0]!.blockedBy).toContain("#113");
    expect(scribe[0]!.blockedBy).toContain("written-language");
    /* The blocker is real: no path body can carry a written-tradition competency, and the approved
       catalogue holds fewer written traditions than this proposal gives Civilizations. */
    const writtenTraditions = fullSkillCatalogueProposal.entries.filter(
      (entry) => entry.competencyType === "written-tradition",
    );
    expect(writtenTraditions.length).toBeLessThan(
      competencyContentV2CivilizationLanguages.filter((row) => row.writtenName !== null).length,
    );
    for (const row of catalogue.coreRoutes)
      for (const skillId of row.skillIds)
        expect(
          fullSkillCatalogueProposal.entries.find((entry) => entry.id === skillId)!.competencyType,
        ).toBe("base-skill");
  });

  it("does not invent a Learning Group to manufacture a unique core", () => {
    /* Four cores moved in this reconciliation and not one of them added a Learning Group: three
       became an existing direct competency route and three became alternatives over groups the
       Profession already had. F06 was added to the Courier as an ordinary route, not as a group. */
    expect(catalogue.manifest.groups).toBe(95);
    expect(catalogue.manifest.newGroups).toBe(49);
  });
});

describe("second ruling set — combat is an explicit exception", () => {
  it("allows a large, choice-heavy group only where the exception covers it", () => {
    const large = catalogue.groupSizes.filter((row) => row.shape === "justified-large");
    expect(large.map((row) => row.id).sort()).toEqual(["M02", "M03", "M05"]);
    for (const row of large) expect(row.slotSize).toBeGreaterThan(0);
  });

  it("states the exception positively rather than apologising for the size", () => {
    for (const row of catalogue.groupSizes.filter((r) => r.shape === "justified-large"))
      expect(row.justification).toContain("combat exception");
  });

  it("keeps the focused melee package exactly as ruled", () => {
    const m01 = competencyContentV2LearningGroups.find((group) => group.id === "M01")!;
    expect([...m01.fixedSkillIds].sort()).toEqual(["dodge", "parry"]);
    expect(m01.selectionSlots![0]!.chooseCount).toBe(1);
  });
});

describe("second ruling set — Combat Experience route audit", () => {
  it("exposes Combat Experience only through an authored experiential route", () => {
    const exposed = catalogue.paths.filter((path) =>
      path.fixedSkillIds.includes("combat_experience"),
    );
    expect(exposed.length).toBeGreaterThan(0);
    for (const path of exposed)
      expect(path.groupIds.some((groupId) => groupId === "M06" || groupId === "K23")).toBe(true);
  });

  it("leaves the instructing and supporting Professions without it", () => {
    const withoutExposure = ["P82", "P14", "P26"];
    for (const code of withoutExposure)
      for (const path of catalogue.paths.filter((p) => p.professionCode === code))
        expect(path.fixedSkillIds).not.toContain("combat_experience");
  });
});

describe("second ruling set — Specializations never count toward breadth or group cost", () => {
  it("keeps every Specialization out of the Skills a group charges for", () => {
    for (const group of competencyContentV2LearningGroups) {
      const charged = new Set([
        ...group.fixedSkillIds,
        ...(group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds),
      ]);
      for (const specializationId of group.specializationIds ?? [])
        expect(charged.has(specializationId)).toBe(false);
    }
  });

  it("keeps the effective size of a group independent of the Specializations it unlocks", () => {
    for (const row of catalogue.groupSizes) {
      const group = competencyContentV2LearningGroups.find((g) => g.id === row.id)!;
      expect(row.effectiveSize).toBe(
        group.fixedSkillIds.length +
          (group.selectionSlots ?? []).reduce((sum, slot) => sum + slot.chooseCount, 0),
      );
    }
  });

  it("reaches the parent Skill on the path without requiring it in the same group", () => {
    expect(catalogue.coverage.specializationsWhoseParentIsUnreachableInTheSameFamily).toEqual([]);
  });
});

describe("second ruling set — simplified category roster", () => {
  it("retires the categories that were narrow or described a milieu", () => {
    for (const row of catalogue.categories)
      expect(["special-access", "mental", "high-society"]).not.toContain(row.categoryId as string);
  });

  it("leaves no category too narrow to be guessable", () => {
    const counts = new Map<string, number>();
    for (const row of catalogue.categories)
      counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    for (const [, count] of counts) expect(count).toBeGreaterThanOrEqual(4);
  });

  it("places the re-bucketed competencies where a player would look for them", () => {
    const at = (id: string) =>
      catalogue.categories.find((row) => row.competencyId === id)?.categoryId;
    expect(at("meditation")).toBe("mystical");
    expect(at("skill:mnemonics")).toBe("knowledge");
    expect(at("heraldry")).toBe("knowledge");
    expect(at("skill:politics")).toBe("social");
    expect(at("spec:courtly-protocol")).toBe("social");
  });

  it("stops splitting the living-animal competencies between two categories", () => {
    const at = (id: string) =>
      catalogue.categories.find((row) => row.competencyId === id)?.categoryId;
    expect(at("skill:animal-handling")).toBe("fieldcraft");
    expect(at("herding")).toBe("fieldcraft");
    expect(at("skill:cart-driving")).toBe("trade");
  });
});

describe("second ruling set — the language blocker is removed", () => {
  it("settles every Civilization name rather than deferring to a further ruling", () => {
    for (const row of competencyContentV2CivilizationLanguages)
      expect(row.requiresProductOwnerNamingRuling).toBe(false);
  });

  it("authors the absence of writing rather than leaving it blank", () => {
    for (const row of competencyContentV2CivilizationLanguages)
      if (row.writtenName === null)
        expect((row.writtenAbsenceReason ?? "").trim().length).toBeGreaterThan(0);
  });

  it("settles Tuu with the appropriate historical name and invents nothing", () => {
    const san = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "san_forager_bands",
    )!;
    expect(san.spokenName).toBe("Spoken Tuu");
    expect(san.writtenName).toBeNull();
  });

  it("gives the Common and Old Common written traditions rollable competencies now", () => {
    for (const civilizationId of ["iest", "thyatis", "glantri", "scyria", "byzantine_empire"]) {
      const row = competencyContentV2CivilizationLanguages.find(
        (candidate) => candidate.civilizationId === civilizationId,
      )!;
      expect(row.writtenName).toMatch(/^Written /);
      expect(row.requiresProductOwnerNamingRuling).toBe(false);
    }
  });
});

describe("third ruling set — Learning Group membership (settled)", () => {
  it("holds the four retained groups to their settled memberships, with no choice slot", () => {
    const settled: Record<string, string[]> = {
      K01: ["skill:mnemonics", "skill:research"],
      M10: ["skill:teaching", "weapon_maintenance"],
      C06: ["skill:masonry", "skill:sculpture"],
      C07: ["climb", "skill:mining"],
    };
    for (const [groupId, members] of Object.entries(settled)) {
      const group = competencyContentV2LearningGroups.find(
        (candidate) => candidate.id === groupId,
      )!;
      expect([...group.fixedSkillIds].sort()).toEqual(members);
      expect(group.selectionSlots ?? []).toHaveLength(0);
    }
  });

  it("removes exactly the four members the ruling names, and no others", () => {
    const fixedOf = (groupId: string) =>
      competencyContentV2LearningGroups.find((group) => group.id === groupId)!.fixedSkillIds;
    expect(fixedOf("K01")).not.toContain("mathematics");
    expect(fixedOf("M10")).not.toContain("skill:athletics");
    expect(fixedOf("C06")).not.toContain("skill:mining");
    expect(fixedOf("C07")).not.toContain("skill:survival");
  });

  it("leaves each removed competence reachable through the route the ruling names", () => {
    const fixedOf = (groupId: string) =>
      competencyContentV2LearningGroups.find((group) => group.id === groupId)!.fixedSkillIds;
    expect(fixedOf("K21")).toContain("mathematics");
    expect(fixedOf("K03")).toContain("mathematics");
    expect(fixedOf("F04")).toContain("skill:athletics");
    expect(fixedOf("C07")).toContain("skill:mining");
    expect(fixedOf("G04")).toContain("skill:survival");
  });

  it("retires C03 without leaving a one-Skill Learning Group in its place", () => {
    expect(competencyContentV2LearningGroups.some((group) => group.id === "C03")).toBe(false);
    /* No surviving group teaches Surveying alone, which is the shape the ruling refuses. */
    for (const group of competencyContentV2LearningGroups)
      expect(group.fixedSkillIds.length === 1 && group.fixedSkillIds[0] === "surveying").toBe(
        false,
      );
    expect(catalogue.manifest.groupsNeedingReconsideration).toBe(0);
  });

  it("creates no Learning Group to absorb the retirement", () => {
    /* 96 before the membership ruling, one retired, none added. */
    expect(catalogue.manifest.groups).toBe(95);
  });

  it("records what became of every route into the retired group", () => {
    const c03 = competencyContentV2RetiredProposedGroups.find((row) => row.id === "C03")!;
    expect(c03.rehousing.map((row) => row.professionCode).sort()).toEqual([
      "P28",
      "P39",
      "P40",
      "P46",
      "P48",
      "P49",
    ]);
    for (const row of c03.rehousing) expect(row.disposition.length).toBeGreaterThan(40);
    for (const family of competencyContentV2Families)
      for (const body of [family, ...(family.tracks ?? [])])
        for (const route of body.groups ?? []) expect(route.groupId).not.toBe("C03");
  });

  it("supplies Surveying to the two rehoused occupations that keep it", () => {
    for (const code of ["P39", "P48"]) {
      const family = competencyContentV2Families.find((candidate) => candidate.code === code)!;
      expect(family.skillIds ?? []).toContain("surveying");
      expect(family.directRoute?.trim()).toBeTruthy();
    }
    /* The siege engineer, mason and building designer keep it through F28 instead. */
    for (const code of ["P28", "P46", "P49"]) {
      const path = catalogue.paths.find((row) => row.professionCode === code)!;
      expect(path.fixedSkillIds).toContain("surveying");
      expect(
        competencyContentV2Families.find((candidate) => candidate.code === code)!.skillIds ?? [],
      ).not.toContain("surveying");
    }
  });

  it("keeps the Mason's and Miner's replacement routes available", () => {
    const mason = competencyContentV2Families.find((family) => family.code === "P46")!;
    expect((mason.groups ?? []).map((route) => route.groupId)).toContain("C07");
    const miner = competencyContentV2Families.find((family) => family.code === "P47")!;
    expect((miner.groups ?? []).map((route) => route.groupId)).toContain("G04");
    const masonPath = catalogue.paths.find((row) => row.professionCode === "P46")!;
    expect(masonPath.fixedSkillIds).toContain("skill:mining");
    const minerPath = catalogue.paths.find((row) => row.professionCode === "P47")!;
    expect(minerPath.fixedSkillIds).toContain("skill:survival");
  });

  it("keeps every core the membership change touches satisfiable", () => {
    for (const code of ["P46", "P47", "P82", "P68", "P70"]) {
      const cores = catalogue.coreRoutes.filter((row) => row.professionCode === code);
      expect(cores.length).toBeGreaterThan(0);
      expect(cores.some((row) => row.satisfied)).toBe(true);
    }
    expect(catalogue.coreRoutes.every((row) => row.satisfied || !row.groupIds.length)).toBe(true);
  });

  it("leaves every valid path satisfying an applicable core route", () => {
    for (const path of catalogue.paths) {
      const cores = catalogue.coreRoutes.filter((row) => row.pathId === path.pathId);
      expect(cores.some((row) => row.satisfied)).toBe(true);
    }
  });

  it("orphans no base Skill by the membership change", () => {
    expect(catalogue.coverage.baseSkillsWithoutAnyRoute.map((row) => row.id)).toEqual([
      "skill:poisons",
    ]);
  });

  it("refuses to restore a removed member under breadth pressure", () => {
    /* The build asserts the settled shapes, so a reversal fails the build rather than a review. */
    expect(() => buildCompetencyContentV2Catalogue()).not.toThrow();
    const k01 = competencyContentV2LearningGroups.find((group) => group.id === "K01")!;
    expect(k01.note).toContain("membership ruling");
  });
});
