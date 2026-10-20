import { describe, expect, it } from "vitest";

import canonicalContent from "../../data/canonicalContent.json";
import { fullSkillCatalogueProposal } from "../../skillContentPlatform/fullSkillCatalogueProposal";
import { targetLearningGroupCatalogue } from "../../skillContentPlatform/targetLearningGroups";
import { targetProfessionCatalogue } from "../../targetProfessions";
import {
  analyseCompetencyContentV2,
  BREADTH_REVIEW_FLOOR,
  buildCompetencyContentV2Catalogue,
  buildCompetencyContentV2SocietyLevelAvailability,
  competencyContentV2Catalogue,
  competencyContentV2SocietyLevelAvailability,
  EFFECTIVE_BREADTH_SIGNAL,
  GROUP_SIZE_PREFERRED_CENTRE,
  GROUP_SIZE_REVIEW_BAND,
  measureApprovedBaseline,
} from "./competencyContentV2";
import {
  COMPETENCY_CONTENT_V2_AUTHORED_SOCIETY_LEVEL_CEILING,
  COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID,
  COMPETENCY_CONTENT_V2_STATUS,
  competencyContentV2AccessGridDivergences,
  competencyContentV2CanonicalAccessTiers,
  competencyContentV2DirectRouteAvailability,
  competencyContentV2GroupAvailability,
  competencyContentV2ProfessionRouteAvailability,
  competencyContentV2RouteGaps,
  competencyContentV2SocialBands,
  competencyContentV2SocietyLevel1Absences,
  competencyContentV2CivilizationLanguages,
  competencyContentV2WrittenLanguageCompetencyIds,
  v2SpokenCompetencyName,
  v2WrittenCompetencyName,
  competencyContentV2DirectGrantDecisions,
  competencyContentV2Families,
  competencyContentV2LearningGroups,
  competencyContentV2RemovedGroups,
  competencyContentV2RetiredProposedGroups,
} from "./competencyContentV2Source";

const catalogue = competencyContentV2Catalogue;

describe("Competency Content V2 proposal status", () => {
  it("is marked canonical", () => {
    expect(COMPETENCY_CONTENT_V2_STATUS).toBe("canonical-product-owner-accepted");
    expect(catalogue.status).toBe("canonical-product-owner-accepted");
  });

  it("leaves the approved catalogues untouched", () => {
    expect(targetProfessionCatalogue.families).toHaveLength(84);
    expect(targetLearningGroupCatalogue.manifest.groups).toBe(59);
    expect(fullSkillCatalogueProposal.manifest.baseSkills).toBe(133);
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

  it("preserves the 133 base-Skill catalogue without adding or renaming a Skill", () => {
    /* 133, not 131: rule decision 0010 rulings 1 and 2 reclassify Fencing and Longbow from
       Specializations to base Skills. The 172-entry roster is unchanged — two entries moved
       between types, and no Skill was added or renamed. */
    expect(catalogue.coverage.baseSkills).toBe(133);
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
    /* P65 is no longer partially blocked: the note records the settlement, not a dependency. */
    expect(scribe.note).toContain("SETTLED");
    expect(scribe.note).not.toContain("PARTIALLY BLOCKED");
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
  it("covers every canonical Civilization with a rollable spoken competency", () => {
    expect(competencyContentV2CivilizationLanguages).toHaveLength(16);
    for (const row of competencyContentV2CivilizationLanguages) {
      expect(v2SpokenCompetencyName(row).startsWith("Spoken ")).toBe(true);
      expect(row.spokenCompetencyId.startsWith("spoken:")).toBe(true);
      expect(row.spokenRoute.trim().length).toBeGreaterThan(0);
    }
  });

  it("proposes a written competency unless the Civilization is authored as having no writing", () => {
    const withoutWriting = competencyContentV2CivilizationLanguages.filter(
      (row) => row.writtenCompetencyId === null,
    );
    expect(withoutWriting.map((row) => row.civilizationId).sort()).toEqual([
      "san_forager_bands",
      "scythians",
    ]);
    for (const row of competencyContentV2CivilizationLanguages)
      if (row.writtenCompetencyId !== null) {
        expect(v2WrittenCompetencyName(row)!.startsWith("Written ")).toBe(true);
        expect(row.writtenCompetencyId.startsWith("written:")).toBe(true);
        expect((row.writtenRoute ?? "").trim().length).toBeGreaterThan(0);
      }
  });

  /**
   * The ruling's sharpest constraint. Every language atom must come from the canonical Glantri
   * language roster, so an invented but plausible-sounding name cannot pass as authored content.
   */
  it("uses only names attested in the canonical Glantri language roster", () => {
    const roster = new Set(canonicalContent.languages.map((language) => language.name));
    for (const row of competencyContentV2CivilizationLanguages) {
      expect(roster.has(row.spokenLanguageName)).toBe(true);
      for (const atom of [row.writtenLanguageName, row.writtenTraditionName])
        if (atom !== null) expect(roster.has(atom)).toBe(true);
    }
  });

  it("agrees with the canonical Civilization records on which language is spoken and written", () => {
    for (const canonical of canonicalContent.civilizations) {
      const row = competencyContentV2CivilizationLanguages.find(
        (candidate) => candidate.civilizationId === canonical.id,
      )!;
      expect(row).toBeDefined();
      expect(row.spokenLanguageName).toBe(canonical.spokenLanguageName);
      if (canonical.writtenLanguageName === null) {
        expect(row.writtenCompetencyId).toBeNull();
      } else {
        expect([row.writtenLanguageName, row.writtenTraditionName]).toContain(
          canonical.writtenLanguageName,
        );
      }
    }
  });

  it("withdraws the invented Lankhmaran and restores the established Phoenician names", () => {
    const lankhmar = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "lankhmar",
    )!;
    expect(lankhmar.replacesProposedSpokenName).toBe("Spoken Lankhmaran");
    expect(v2SpokenCompetencyName(lankhmar)).toBe("Spoken Phoenician");
    expect(lankhmar.spokenCompetencyId).toBe("spoken:phoenician");
    expect(lankhmar.writtenCompetencyId).toBe("written:phoenician:phoenician");
    expect(lankhmar.requiresProductOwnerNamingRuling).toBe(false);
  });

  it("restores Royal N'kolian and Runic Scandian, which are established rather than invented", () => {
    const nkolo = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "nkolo",
    )!;
    expect(nkolo.writtenTraditionName).toBe("Royal N'kolian");
    expect(v2WrittenCompetencyName(nkolo)).toBe("Written N'kolian in Royal N'kolian");
    const scandia = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "scandia",
    )!;
    expect(scandia.writtenTraditionName).toBe("Runic Scandian");
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
      "Lankhmaran",
    ];
    for (const row of competencyContentV2CivilizationLanguages)
      for (const invented of withdrawn) {
        expect(v2SpokenCompetencyName(row)).not.toContain(invented);
        expect(v2WrittenCompetencyName(row) ?? "").not.toContain(invented);
      }
  });

  it("keeps one identity per name and one name per identity", () => {
    const byId = new Map<string, string>();
    for (const row of competencyContentV2CivilizationLanguages) {
      const pairs: [string, string][] = [[row.spokenCompetencyId, v2SpokenCompetencyName(row)]];
      if (row.writtenCompetencyId !== null)
        pairs.push([row.writtenCompetencyId, v2WrittenCompetencyName(row)!]);
      for (const [id, name] of pairs) {
        if (byId.has(id)) expect(byId.get(id)).toBe(name);
        byId.set(id, name);
      }
    }
    /* 13 spoken (12 approved plus Tuu) and 11 written across the 14 literate Civilizations. */
    expect([...byId.keys()].filter((id) => id.startsWith("spoken:"))).toHaveLength(13);
    expect(competencyContentV2WrittenLanguageCompetencyIds).toHaveLength(11);
  });

  it("reuses approved catalogue identities exactly rather than redefining them", () => {
    const approved = new Map(
      fullSkillCatalogueProposal.entries.map((entry) => [entry.id, entry] as const),
    );
    for (const row of competencyContentV2CivilizationLanguages) {
      const spoken = approved.get(row.spokenCompetencyId);
      if (spoken) {
        expect(spoken.competencyType).toBe("spoken-language");
        expect(spoken.name).toBe(v2SpokenCompetencyName(row));
      }
      const written =
        row.writtenCompetencyId === null ? undefined : approved.get(row.writtenCompetencyId);
      if (written) {
        expect(written.competencyType).toBe("written-tradition");
        expect(written.name).toBe(v2WrittenCompetencyName(row));
      }
    }
    /* Exactly the three written traditions the approved catalogue already holds are reused. */
    expect(
      competencyContentV2WrittenLanguageCompetencyIds.filter((id) => approved.has(id)).sort(),
    ).toEqual([
      "written:mogrebi:sacred-mogrebi",
      "written:ologian:church-ologian",
      "written:phoenician:phoenician",
    ]);
  });

  it("flags Olog for later correction without correcting it here", () => {
    const olog = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "olog",
    )!;
    expect(v2SpokenCompetencyName(olog)).toBe("Spoken Ologian");
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

  it("records no blocked core route, because the last one is settled", () => {
    expect(catalogue.coreRoutes.filter((row) => row.blockedBy)).toHaveLength(0);
    expect(catalogue.manifest.coreRoutesBlocked).toBe(0);
  });

  it("expresses the Scribe core as a written-language choice, not as base Skills", () => {
    const scribe = catalogue.coreRoutes.filter((row) => row.professionCode === "P65");
    expect(scribe).toHaveLength(1);
    expect(scribe[0]!.groupIds).toEqual(["G11"]);
    expect(scribe[0]!.skillIds).toEqual([]);
    expect(scribe[0]!.writtenLanguageChoiceCount).toBe(1);
    expect(scribe[0]!.satisfied).toBe(true);
    expect(scribe[0]!.blockedBy).toBeUndefined();
    /* G11 plus the one choice is exactly two requirements — the core maximum, unchanged. */
    expect(scribe[0]!.groupIds.length + scribe[0]!.skillIds.length + 1).toBe(2);
    /* No written-language competency was smuggled in as a base Skill to fit the old shape. */
    const writtenIds = new Set(competencyContentV2WrittenLanguageCompetencyIds);
    for (const row of catalogue.coreRoutes)
      for (const skillId of row.skillIds) {
        expect(writtenIds.has(skillId)).toBe(false);
        expect(
          fullSkillCatalogueProposal.entries.find((entry) => entry.id === skillId)!.competencyType,
        ).toBe("base-skill");
      }
  });

  it("keeps the written-language choice satisfiable and reachable", () => {
    for (const row of catalogue.coreRoutes)
      if (row.writtenLanguageChoiceCount > 0)
        expect(competencyContentV2WrittenLanguageCompetencyIds.length).toBeGreaterThanOrEqual(
          row.writtenLanguageChoiceCount,
        );
    /* Every written competency a choice may be satisfied from is owned by a Civilization and has a
       stated route; none is an orphan identity. */
    for (const id of competencyContentV2WrittenLanguageCompetencyIds) {
      const owners = competencyContentV2CivilizationLanguages.filter(
        (row) => row.writtenCompetencyId === id,
      );
      expect(owners.length).toBeGreaterThan(0);
      for (const owner of owners)
        expect((owner.writtenRoute ?? "").trim().length).toBeGreaterThan(0);
    }
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
    /* F41 is gone from the Soldier package by the 2026-09-27 ruling: the military longbow route is
       M04/M05, which charges no Hunting. Independent access to F41 by another Character history
       remains possible; it is simply not part of this Profession. */
    expect(groupIds).toEqual(expect.arrayContaining(["M01", "M03", "M04", "M06"]));
    expect(groupIds).not.toContain("F41");
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

  it("settles the Scribe core as G11 plus one freely chosen written language", () => {
    const scribe = catalogue.coreRoutes.filter((row) => row.professionCode === "P65");
    expect(scribe).toHaveLength(1);
    expect(scribe[0]!.groupIds).toEqual(["G11"]);
    expect(scribe[0]!.writtenLanguageChoiceCount).toBe(1);
    expect(scribe[0]!.blockedBy).toBeUndefined();
    expect(scribe[0]!.label).toContain("written language");
    /* The content half of the old blocker is discharged too: the proposal now authors more written
       competencies than the approved catalogue's three, covering every literate Civilization. */
    const approvedWritten = fullSkillCatalogueProposal.entries.filter(
      (entry) => entry.competencyType === "written-tradition",
    );
    expect(approvedWritten).toHaveLength(3);
    expect(competencyContentV2WrittenLanguageCompetencyIds.length).toBeGreaterThan(
      approvedWritten.length,
    );
    expect(
      competencyContentV2CivilizationLanguages.filter((row) => row.writtenCompetencyId !== null),
    ).toHaveLength(14);
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
      if (row.writtenCompetencyId === null)
        expect((row.writtenAbsenceReason ?? "").trim().length).toBeGreaterThan(0);
  });

  it("settles Tuu with the appropriate historical name and invents nothing", () => {
    const san = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "san_forager_bands",
    )!;
    expect(v2SpokenCompetencyName(san)).toBe("Spoken Tuu");
    expect(san.spokenCompetencyId).toBe("spoken:tuu");
    expect(san.writtenCompetencyId).toBeNull();
  });

  it("gives the Common and Old Common written traditions rollable competencies now", () => {
    for (const civilizationId of ["iest", "thyatis", "glantri", "scyria", "byzantine_empire"]) {
      const row = competencyContentV2CivilizationLanguages.find(
        (candidate) => candidate.civilizationId === civilizationId,
      )!;
      expect(v2WrittenCompetencyName(row)).toMatch(/^Written /);
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

describe("Society Level and Social Band route availability", () => {
  const availability = competencyContentV2SocietyLevelAvailability;
  const cell = (societyLevel: number, socialBand: string) =>
    availability.cells.find(
      (row) => row.societyLevel === societyLevel && row.socialBand === socialBand,
    )!;

  it("builds deterministically and fails the build rather than a test", () => {
    expect(() => buildCompetencyContentV2SocietyLevelAvailability()).not.toThrow();
    expect(availability.cells).toHaveLength(24);
  });

  it("authors only the Society Level 1-2 boundary", () => {
    expect(COMPETENCY_CONTENT_V2_AUTHORED_SOCIETY_LEVEL_CEILING).toBe(3);
    const bounds = [
      ...Object.values(competencyContentV2GroupAvailability),
      ...competencyContentV2ProfessionRouteAvailability,
      ...competencyContentV2DirectRouteAvailability,
    ];
    for (const bound of bounds) {
      expect(bound.reason.trim().length).toBeGreaterThan(0);
      expect(bound.minSocietyLevel ?? 2).toBeGreaterThanOrEqual(2);
      expect(bound.minSocietyLevel ?? 2).toBeLessThanOrEqual(
        COMPETENCY_CONTENT_V2_AUTHORED_SOCIETY_LEVEL_CEILING,
      );
      /* A Social Band bound above the boundary would be a claim this pass does not author. */
      if (bound.minSocialBand) expect(bound.minSocietyLevel ?? 1).toBeLessThanOrEqual(2);
    }
  });

  it("uses the canonical Social Band names and access tiers rather than invented ones", () => {
    expect(competencyContentV2SocialBands.map((band) => band.name)).toEqual([
      "Common Folk",
      "Trades and Guilds",
      "Established Households",
      "Court and Elite",
    ]);
    const societyLevelRows = canonicalContent.societyLevels as readonly {
      socialClass: string;
      societyLevel: number;
    }[];
    for (const band of competencyContentV2SocialBands)
      expect(
        societyLevelRows.some(
          (row) =>
            row.socialClass === band.name && row.societyLevel === Number(band.id.replace("L", "")),
        ),
      ).toBe(true);
    expect(
      competencyContentV2CanonicalAccessTiers.map(
        (tier) => `${tier.minSocietyLevel}/${tier.minSocialBand}`,
      ),
    ).toEqual(["1/L1", "2/L2", "3/L3", "4/L4"]);
  });

  it("reproduces the canonical shape: Society Level 1 offers the same routes at every band", () => {
    /* The canonical grid gives the Society Level 1 society one set across all four bands. It is not
       constructed that way here: it follows from bounds authored one group at a time. */
    const base = cell(1, "L1").availableGroupIds;
    for (const band of ["L2", "L3", "L4"]) expect(cell(1, band).availableGroupIds).toEqual(base);
    expect(cell(1, "L4").reachableBaseSkillIds).toEqual(cell(1, "L1").reachableBaseSkillIds);
  });

  it("reproduces the canonical shape: a Society Level 2 ladder stops at the trades tier", () => {
    const trades = cell(2, "L2").availableGroupIds;
    for (const band of ["L3", "L4"]) expect(cell(2, band).availableGroupIds).toEqual(trades);
    expect(cell(2, "L1").availableGroupIds.length).toBeLessThan(trades.length);
  });

  it("never shrinks availability upward", () => {
    for (const row of availability.cells) {
      const higherLevel = availability.cells.find(
        (other) =>
          other.societyLevel === row.societyLevel + 1 && other.socialBand === row.socialBand,
      );
      for (const target of [higherLevel].filter(Boolean))
        for (const skillId of row.reachableBaseSkillIds)
          expect(target!.reachableBaseSkillIds).toContain(skillId);
    }
  });

  it("makes no Skill globally unreachable as a side effect", () => {
    /* Poisons is the one deliberately routeless Skill, exactly as before this pass. */
    const widest = new Set(cell(6, "L4").reachableBaseSkillIds);
    const withRoutes = catalogue.coverage.baseSkills - widest.size;
    expect(withRoutes).toBe(1);
    expect(cell(6, "L4").unreachableBaseSkillIds).toEqual(["skill:poisons"]);
  });

  it("keeps every Profession core and every valid path satisfiable somewhere", () => {
    expect(catalogue.manifest.validPaths).toBe(86);
    expect(catalogue.coreRoutes.filter((row) => row.satisfied).length).toBeGreaterThan(0);
    for (const path of catalogue.paths)
      expect(availability.cells.some((row) => row.validPathIds.includes(path.pathId))).toBe(true);
    expect(cell(3, "L2").validPathIds).toHaveLength(86);
  });

  it("keeps P65 Scribe's written-language core satisfiable wherever the Scribe exists", () => {
    const scribeCells = availability.cells.filter((row) =>
      row.validPathIds.includes("profession:scribe"),
    );
    /* G11 is a records office, so the Scribe first exists at Society Level 3 — at every band, because
       this pass authors no band bound above the Society Level 1-2 boundary. */
    expect(scribeCells).toHaveLength(16);
    expect(scribeCells.every((row) => row.societyLevel >= 3)).toBe(true);
    expect(competencyContentV2WrittenLanguageCompetencyIds.length).toBeGreaterThan(0);
    const scribe = competencyContentV2Families.find((family) => family.code === "P65")!;
    const choiceCount = scribe.coreRoutes?.[0]?.writtenLanguageChoiceCount;
    expect(choiceCount).toBe(1);
    /* The choice is satisfied from the set reachable AT THE CELL, so a written competency suppressed
       by a literacy route's bound surfaces here as a core-satisfiability failure rather than as an
       obvious routing one. */
    for (const row of scribeCells)
      expect(row.reachableWrittenCompetencyIds.length).toBeGreaterThanOrEqual(choiceCount!);
    expect(cell(3, "L1").reachableWrittenCompetencyIds).toHaveLength(4);
  });

  it("offers no Specialization whose parent the same restricted path no longer reaches", () => {
    for (const row of availability.cells) expect(row.specializationsWithoutTheirParent).toEqual([]);
  });

  it("records the three restriction shapes the settled model allows, and no fourth", () => {
    /* 50, not 51: F30's bound is withdrawn by the 2026-09-27 ruling. Fencing carries no elevated
       generic Society-Level restriction, and F30's former reason — "a named school of a specific
       urban fencing tradition" — was exactly the cultural/Setting restriction that must not be
       encoded in generic combat content. F30 is now unbounded like M01, the ordinary
       one-handed-edged route; Fencing's availability horizon belongs to Setting logic
       (architecture decision 0006). M03's own force-structure bound is untouched. */
    expect(Object.keys(competencyContentV2GroupAvailability)).toHaveLength(50);
    expect(competencyContentV2GroupAvailability.F30).toBeUndefined();
    expect(competencyContentV2GroupAvailability.M01).toBeUndefined();
    expect(competencyContentV2ProfessionRouteAvailability).toHaveLength(4);
    expect(competencyContentV2DirectRouteAvailability).toHaveLength(7);
    expect(availability.summary.unrestrictedGroups).toBe(45);
    expect(availability.summary.groupsFromSocietyLevel2).toBe(28);
    expect(availability.summary.groupsAboveSocietyLevel2).toBe(22);
  });

  it("keeps each Profession route restriction genuinely narrower than the group's own bound", () => {
    for (const bound of competencyContentV2ProfessionRouteAvailability) {
      const group = competencyContentV2GroupAvailability[bound.groupId];
      const groupLevel = group?.minSocietyLevel ?? 1;
      const groupBand = group?.minSocialBand ?? "L1";
      const narrower =
        (bound.minSocietyLevel ?? 1) > groupLevel || (bound.minSocialBand ?? "L1") > groupBand;
      expect(narrower).toBe(true);
    }
  });

  it("withdraws nothing from a direct route without accounting for it", () => {
    const accountedFor = new Set(
      competencyContentV2SocietyLevel1Absences.map((row) => row.skillId),
    );
    for (const bound of competencyContentV2DirectRouteAvailability) {
      const family = competencyContentV2Families.find(
        (candidate) => candidate.code === bound.professionCode,
      )!;
      const below = (bound.minSocietyLevel ?? 1) - 1;
      const stillValid = availability.cells.some(
        (row) => row.societyLevel === below && row.professionCodes.includes(bound.professionCode),
      );
      if (!stillValid) continue;
      const reachable = new Set(cell(below, "L4").reachableBaseSkillIds);
      /* Where the Profession does still exist below the bound, every Skill the bound withdraws is
         either still reached by another route at that level, or is itself an absence this pass has
         recorded and argued. Nothing disappears unaccounted for. */
      for (const skillId of family.skillIds ?? [])
        expect(reachable.has(skillId) || accountedFor.has(skillId)).toBe(true);
    }
  });

  it("accounts for every Skill absent at Society Level 1, exactly", () => {
    expect(competencyContentV2SocietyLevel1Absences).toHaveLength(51);
    expect(
      competencyContentV2SocietyLevel1Absences.filter((row) => row.disposition === "route-gap"),
    ).toHaveLength(8);
    expect(
      competencyContentV2SocietyLevel1Absences.filter((row) => row.disposition === "deliberate"),
    ).toHaveLength(43);
    expect([...cell(1, "L1").unreachableBaseSkillIds].sort()).toEqual(
      competencyContentV2SocietyLevel1Absences.map((row) => row.skillId).sort(),
    );
  });

  it("flags the route gaps rather than closing them with new routes", () => {
    expect(competencyContentV2RouteGaps.map((gap) => gap.skillId).sort()).toEqual([
      "camouflage",
      "skill:leadership",
      "skill:politics",
      "skill:teaching",
      "skill:trade",
      "skill:trapmaking",
      "throwing",
      "weapon_maintenance",
    ]);
    for (const gap of competencyContentV2RouteGaps) {
      expect(gap.closedRoutes.length).toBeGreaterThan(0);
      expect(gap.plausibility.trim().length).toBeGreaterThan(0);
      /* A flag must be true where it is raised, and false somewhere above it, or it is not a gap. */
      expect(cell(gap.unreachableAtSocietyLevel, "L4").reachableBaseSkillIds).not.toContain(
        gap.skillId,
      );
      expect(cell(6, "L4").reachableBaseSkillIds).toContain(gap.skillId);
    }
    /* No group gained a member and no Profession gained a route to close a gap. */
    expect(catalogue.manifest.groups).toBe(95);
    /* 107, not 106: the 2026-09-27 ruling restores P01's accepted direct ordinary-archery route to
       `bow`, which the approved Profession catalogue already justifies for the non-longbow
       bow-hunting branch. No route gap was closed by it — `bow` was never flagged as one — and the
       eight route gaps above are unchanged. */
    expect(catalogue.manifest.directSkillOpportunities).toBe(107);
  });

  it("records the distribution the pass produces", () => {
    /* Each cell gains exactly the two reclassified base Skills and loses nothing: Fencing through
       F30, now unbounded, and Longbow through F41. Ordinary Bow keeps its Society Level 1 route
       through P01's restored direct access, so nothing became absent. */
    expect(cell(1, "L1").reachableBaseSkillIds).toHaveLength(82);
    /* Smelting and Smithing join the Society Level 2 common-folk cell under the Product Owner
       content ruling of 2026-10-20 (Forgejo #732): F24 keeps its furnace requirement as a Society
       Level bound and no longer carries a trades-tier Social Band, so the two Skills that group
       teaches are reached at Social Band L1 from Society Level 2. Society Level 1 is unchanged. */
    expect(cell(2, "L1").reachableBaseSkillIds).toHaveLength(98);
    for (const id of ["skill:smelting", "skill:smithing"]) {
      expect(cell(2, "L1").reachableBaseSkillIds).toContain(id);
      expect(cell(1, "L4").reachableBaseSkillIds).not.toContain(id);
    }
    expect(cell(2, "L2").reachableBaseSkillIds).toHaveLength(112);
    expect(cell(3, "L2").reachableBaseSkillIds).toHaveLength(132);
    for (const id of ["bow", "fencing", "longbow"])
      expect(cell(1, "L1").reachableBaseSkillIds).toContain(id);
    expect(cell(1, "L1").professionCodes).toHaveLength(42);
    expect(cell(2, "L2").professionCodes).toHaveLength(63);
    expect(cell(3, "L2").professionCodes).toHaveLength(84);
  });

  /*
   * Product Owner content ruling of 2026-10-20 (Forgejo #732). Social Band 1 alone must not exclude
   * the Smith and the Smelter, while the metalworking infrastructure requirement is preserved. The
   * two halves are asserted separately, because the point of the ruling is that they are different
   * things: the band no longer excludes, the furnace still does.
   */
  it("admits the Smith and the Smelter at Social Band L1 wherever the society runs furnaces", () => {
    for (const pathId of ["profession:smith", "profession:smelter"]) {
      for (const societyLevel of [2, 3, 4, 5, 6])
        expect(cell(societyLevel, "L1").validPathIds).toContain(pathId);
      /* The infrastructure requirement survives: no furnaces, no entry, at any stratum. */
      for (const band of ["L1", "L2", "L3", "L4"])
        expect(cell(1, band).validPathIds).not.toContain(pathId);
    }
    /* F24 is the group the ruling corrects, and it carries a Society Level bound and no band. */
    const f24 = availability.groupBounds.find((row) => row.groupId === "F24")!;
    expect(f24.minSocietyLevel).toBe(2);
    expect(f24.minSocialBand).toBe("L1");
    expect(competencyContentV2GroupAvailability.F24!.minSocialBand).toBeUndefined();
    /* The Miner reaches F24 only as a secondary route, so this does not open that occupation. */
    expect(cell(2, "L1").validPathIds).not.toContain("profession:miner");
  });
});

describe("fourth ruling set — SL1 authority and Latial Chiefdoms (settled 2026-09-22)", () => {
  const availability = competencyContentV2SocietyLevelAvailability;
  const cell = (societyLevel: number, socialBand: string) =>
    availability.cells.find(
      (row) => row.societyLevel === societyLevel && row.socialBand === socialBand,
    )!;
  const latialWritten = "written:old-latin:old-italic";

  it("records the access-grid divergences as settled rulings rather than open questions", () => {
    expect(competencyContentV2AccessGridDivergences.map((row) => row.id)).toEqual([
      "sl1-learned-access",
      "writing-below-society-level-3",
    ]);
    for (const row of competencyContentV2AccessGridDivergences) {
      expect(row.resolution).toContain("2026-09-22");
      /* The reconciliation note is the part the ruling asks for: other implementation may still
         consume the grid, and has to be reconciled against the route model later. */
      expect(row.reconciliation.trim().length).toBeGreaterThan(0);
      expect(row.gridPosition.trim().length).toBeGreaterThan(0);
      expect(row.contentV2Position.trim().length).toBeGreaterThan(0);
    }
    expect(availability.accessGridDivergences).toBe(competencyContentV2AccessGridDivergences);
  });

  it("does not restore the learned access the older grid admits at Society Level 1", () => {
    /* Ruling 1 ratifies the authoring: the grid's Society Level 1 base set does not win. */
    for (const groupId of ["K01", "K02", "K07", "K21", "F11", "F12", "F13", "G12"])
      expect(cell(1, "L4").availableGroupIds).not.toContain(groupId);
  });

  it("keeps Latial Chiefdoms writing-capable at Society Level 2", () => {
    const latial = competencyContentV2CivilizationLanguages.find(
      (row) => row.civilizationId === "latial_chiefdoms",
    )!;
    expect(latial.writtenCompetencyId).toBe(latialWritten);
    expect(latial.writtenTraditionName).toBe("Old Italic");
    for (const band of ["L1", "L2", "L3", "L4"])
      expect(cell(2, band).reachableWrittenCompetencyIds).toContain(latialWritten);
  });

  it("derives every written competency's floor from its own Civilization, not from a literacy route", () => {
    const floors = new Map(
      availability.writtenCompetencyFloors.map((row) => [row.competencyId, row.minSocietyLevel]),
    );
    expect(floors.size).toBe(competencyContentV2WrittenLanguageCompetencyIds.length);
    expect(floors.size).toBe(11);
    expect(floors.get(latialWritten)).toBe(2);
    expect(availability.summary.lowestWrittenCompetencySocietyLevel).toBe(2);
    /* The generic `literacy` Skill keeps its own canonical Society Level 3, and that floor does not
       reach the Civilization's own written language. That separation IS the ruling. */
    const literacy = canonicalContent.skills.find((row) => row.id === "literacy")!;
    expect(literacy.societyLevel).toBe(3);
    expect(floors.get(latialWritten)).toBeLessThan(literacy.societyLevel);
    for (const row of availability.writtenCompetencyFloors)
      expect(row.minSocietyLevel).toBe(Math.min(...row.civilizations.map((c) => c.societyLevel)));
  });

  it("loses no other Civilization's written competency", () => {
    expect(cell(6, "L4").reachableWrittenCompetencyIds.slice().sort()).toEqual(
      [...competencyContentV2WrittenLanguageCompetencyIds].sort(),
    );
    expect(cell(1, "L4").reachableWrittenCompetencyIds).toEqual([]);
    expect(cell(2, "L4").reachableWrittenCompetencyIds).toEqual([latialWritten]);
    expect(cell(3, "L4").reachableWrittenCompetencyIds).toHaveLength(4);
    expect(cell(5, "L4").reachableWrittenCompetencyIds).toHaveLength(11);
  });

  it("moves no group, Profession, path or Skill distribution", () => {
    expect(availability.summary.groups).toBe(95);
    expect(availability.summary.unrestrictedGroups).toBe(45);
    expect(availability.summary.professionRouteRestrictions).toBe(4);
    expect(availability.summary.directRouteRestrictions).toBe(7);
    expect(availability.summary.routeGaps).toBe(8);
    expect(cell(1, "L1").reachableBaseSkillIds).toHaveLength(82);
    expect(cell(2, "L2").reachableBaseSkillIds).toHaveLength(112);
    expect(cell(3, "L2").reachableBaseSkillIds).toHaveLength(132);
    expect(cell(3, "L2").validPathIds).toHaveLength(86);
  });
});
