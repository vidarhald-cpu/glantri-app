import { describe, expect, it } from "vitest";
import { buildSkillReferenceModel } from "@/lib/skills/skillReferenceModel";
import {
  accessLabel,
  accessOverviewRows,
  earliestAccess,
  earliestAccessIndex,
  groupTraining,
  professionTraining,
  rangeLabel,
  readerProse,
} from "./referenceCatalogue";

const model = buildSkillReferenceModel();
const specializationIds = new Set(
  model.skills.filter((skill) => skill.type === "Specialization").map((skill) => skill.id),
);
const isSpecialization = (id: string) => specializationIds.has(id);
const professionByName = (name: string) => {
  const found = model.professions.find((row) => row.name === name);
  if (!found) throw new Error(`No canonical Profession named ${name}.`);
  return found;
};

describe("reader prose publication layers", () => {
  it("falls back to the canonical one-line description where no short description is published", () => {
    const published = model.learningGroups.filter((group) => group.readerContent.shortDescription);
    const awaiting = model.learningGroups.filter((group) => !group.readerContent.shortDescription);
    expect(published).toHaveLength(model.readerContentCoverage.groups.published);
    expect(awaiting).toHaveLength(model.readerContentCoverage.groups.awaiting);
    for (const group of model.learningGroups)
      expect(readerProse(group.readerContent, group.description).summary.length).toBeGreaterThan(0);
  });

  it("never presents a short description as the full description", () => {
    for (const group of model.learningGroups) {
      const prose = readerProse(group.readerContent, group.description);
      if (!group.readerContent.description) expect(prose.full).toBeUndefined();
      else expect(prose.full).toBe(group.readerContent.description);
    }
  });

  it("publishes full Profession family prose for every canonical Profession", () => {
    for (const profession of model.professions)
      expect(readerProse(profession.readerContent, "").full).toBeTruthy();
  });
});

describe("effective breadth follows the settled counting rules", () => {
  it("counts only chooseCount and never substitutes possible reach", () => {
    /* The Carpenter reaches one taught craft out of an eleven-Skill candidate pool. */
    const training = professionTraining(professionByName("Carpenter"), model);
    expect(training.effectiveBaseSkills.max).toBeLessThan(training.possibleBaseSkillReach);
    for (const profession of model.professions) {
      const row = professionTraining(profession, model);
      expect(row.effectiveBaseSkills.max).toBeLessThanOrEqual(row.possibleBaseSkillReach);
      expect(row.effectiveBaseSkills.min).toBeGreaterThan(0);
    }
  });

  it("excludes unselected alternatives and reports the resulting range", () => {
    /* The Soldier's three core drills are alternatives: only one defines a practitioner. */
    const training = professionTraining(professionByName("Soldier"), model);
    expect(training.coreAlternatives).toHaveLength(3);
    expect(training.effectiveBaseSkills.min).toBeLessThan(training.effectiveBaseSkills.max);
    expect(rangeLabel(training.effectiveBaseSkills)).toContain("–");
    for (const core of training.coreAlternatives)
      expect(core.baseSkills).toBeLessThanOrEqual(training.effectiveBaseSkills.max);
  });

  it("excludes Specializations from base-Skill totals and deduplicates the reachable list", () => {
    for (const profession of model.professions) {
      const row = professionTraining(profession, model);
      expect(new Set(row.reachable.map((entry) => entry.link.id)).size).toBe(row.reachable.length);
      const specializations = row.reachable.filter((entry) => entry.specialization);
      for (const entry of specializations) expect(isSpecialization(entry.link.id)).toBe(true);
      expect(row.effectiveBaseSkills.max).toBeLessThanOrEqual(
        row.reachable.filter((entry) => !entry.specialization).length,
      );
    }
  });

  it("orders training routes as core, then additional, then direct", () => {
    const training = professionTraining(professionByName("Hunter and Trapper"), model);
    expect(training.coreAlternatives[0]!.label).toBe("Ordinary hunting apprenticeship");
    expect(training.coreAlternatives[0]!.entries.map((entry) => entry.group?.name)).toEqual([
      "Tracking and hunting practice",
    ]);
    expect(training.additional.every((entry) => entry.group !== undefined)).toBe(true);
    expect(training.additional.length).toBeGreaterThan(0);
    expect(training.direct).toHaveLength(1);
    expect(training.direct[0]!.group).toBeUndefined();
  });

  it("keeps taught choices in the canonical reader wording inside their own route", () => {
    const training = professionTraining(professionByName("Carpenter"), model);
    const choices = [
      ...training.coreAlternatives.flatMap((core) => core.entries),
      ...training.additional,
      ...training.direct,
    ].flatMap((entry) => entry.choices);
    expect(choices.map((choice) => choice.label)).toContain("Choose one taught craft");
    for (const choice of choices) expect(choice.label.toLowerCase()).not.toContain("choice slot");
  });
});

describe("Learning Group counts", () => {
  it("counts fixed base Skills, taught choices, Specializations and Profession routes", () => {
    const group = model.learningGroups.find((row) => row.id === "N01")!;
    const counts = groupTraining(group, isSpecialization);
    expect(counts.fixedBaseSkills).toBe(4);
    expect(counts.trainingChoices).toBe(0);
    expect(counts.professionRoutes).toBeGreaterThan(0);
  });
});

describe("availability is reflected, never invented", () => {
  it("reports the earliest authored Society Level and Social Band", () => {
    const grid = model.access;
    expect(
      accessLabel(
        grid,
        earliestAccess(grid, (cell) => cell.availableGroupIds.includes("N01")),
      ),
    ).toBe("Society Level 1");
    /* C01 is bound to the Trades and Guilds stratum from Society Level 2. */
    expect(
      accessLabel(
        grid,
        earliestAccess(grid, (cell) => cell.availableGroupIds.includes("C01")),
      ),
    ).toBe("Level 2, Trades and Guilds");
    expect(accessLabel(grid, undefined)).toBe("No authored route");
  });

  it("indexes earliest access identically to a direct scan", () => {
    const index = earliestAccessIndex(model.access, (cell) => cell.availableGroupIds);
    for (const group of model.learningGroups)
      expect(index.get(group.id)).toEqual(
        earliestAccess(model.access, (cell) => cell.availableGroupIds.includes(group.id)),
      );
  });

  it("marks Society Levels above the authored ceiling as unauthored rather than absent", () => {
    const rows = accessOverviewRows(model.access, () => "Available");
    expect(rows.filter((row) => row.authored).map((row) => row.societyLevel)).toEqual([1, 2, 3]);
    for (const row of rows)
      if (row.societyLevel > model.access.authoredCeiling) expect(row.authored).toBe(false);
    const authored = rows.find((row) => row.authored)!;
    expect(authored.authored && authored.cells).toHaveLength(model.access.socialBands.length);
  });
});
