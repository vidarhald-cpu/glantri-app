import { describe, expect, it } from "vitest";
import {
  getApprovedTargetChargenContent,
  targetLearningGroupCatalogue,
  targetProfessionCatalogue,
} from "@glantri/content";
import { createChargenProgression, getActiveGroupSkillCost } from "@glantri/rules-engine";
import { buildSkillReferenceModel } from "./skillReferenceModel";

const model = buildSkillReferenceModel();

function readerText(): string {
  return [
    ...model.skills.flatMap((skill) => [
      skill.name,
      skill.description,
      skill.shortDescription,
      ...skill.typicalUses,
    ]),
    ...model.learningGroups.flatMap((group) => [
      group.name,
      group.description,
      group.shortDescription,
      group.equipment ?? "",
    ]),
    ...model.professions.flatMap((profession) => [
      profession.name,
      profession.description,
      profession.exclusivityNote ?? "",
      ...profession.opportunities.flatMap((opportunity) => [
        opportunity.name,
        opportunity.route,
        opportunity.description,
      ]),
    ]),
    ...model.societies.flatMap((society) => [
      society.name,
      society.description,
      ...society.examples.flatMap((example) => [example.name, example.description, example.period]),
    ]),
  ].join(" ");
}

describe("player and GM Skill reference model", () => {
  it("projects every current inventory and relationship without a copied catalogue", () => {
    expect(model.inventory).toEqual({
      competencies: 172,
      baseSkills: 131,
      specializations: 26,
      spokenLanguages: 12,
      writtenTraditions: 3,
      learningGroups: 59,
      baseMemberships: 151,
      specializationMemberships: 9,
      grouplessBaseSkills: 41,
      professionFamilies: 84,
      explicitTracks: 21,
      groupOpportunities: 115,
      directOpportunities: 88,
      societyModels: 11,
      civilizationExamples: 16,
    });
    expect(model.skills.flatMap((skill) => skill.learningGroups)).toHaveLength(160);
    expect(model.professions.flatMap((profession) => profession.opportunities)).toHaveLength(203);
    expect(model.professions.flatMap((profession) => profession.tracks)).toHaveLength(21);
  });

  it("uses the current Chargen calculation for every displayed group price", () => {
    const content = getApprovedTargetChargenContent();
    const progression = createChargenProgression();
    const names = new Map(model.learningGroups.map((group) => [group.name, group]));

    for (const group of targetLearningGroupCatalogue.groups) {
      expect(names.get(group.name)?.price).toBe(
        getActiveGroupSkillCost({ content, groupId: group.id, progression }).cost,
      );
    }
  });

  it("keeps Specialization parentage, access-only membership, and Profession scope explicit", () => {
    const nested = model.skills.filter(
      (skill) =>
        skill.type === "Specialization" &&
        model.skills.find((parent) => parent.key === skill.parent?.key)?.type === "Specialization",
    );
    expect(nested.length).toBeGreaterThan(0);
    expect(model.skills.filter((skill) => skill.type === "Specialization")).toHaveLength(26);
    expect(model.learningGroups.flatMap((group) => group.specializations)).toHaveLength(9);
    expect(
      model.professions
        .flatMap((profession) => profession.opportunities)
        .filter((opportunity) => opportunity.kind !== "Learning Group"),
    ).toHaveLength(88);
  });

  it("records only the two approved Profession exclusivity cases", () => {
    const exclusive = model.professions.filter((profession) => profession.exclusivityNote);
    expect(exclusive.map((profession) => profession.name)).toEqual([
      "Guard, Watcher and Escort",
      "Sailor and Boat Worker",
    ]);
    expect(
      exclusive.find((profession) => profession.name.startsWith("Sailor"))?.exclusivityNote,
    ).toContain("alternative training routes");
    expect(
      exclusive.find((profession) => profession.name.startsWith("Guard"))?.exclusivityNote,
    ).toContain("mutually exclusive");
    expect(targetProfessionCatalogue.families.flatMap((family) => family.tracks)).toHaveLength(21);
  });

  it("keeps internal development language out of reader text", () => {
    for (const term of [
      "target catalogue",
      "legacy catalogue",
      "migration",
      "compatibility seam",
      "membership rows",
      "provenance",
      "slice 2",
      "slice 3",
      "slice 4",
      "implementation id",
      "database",
      "candidate",
      "proposal",
      "digest",
      "audit",
    ]) {
      const text = readerText().toLowerCase();
      const index = text.indexOf(term);
      expect(
        index < 0 ? "" : text.slice(Math.max(0, index - 80), index + term.length + 80),
        term,
      ).toBe("");
    }
    expect(readerText()).not.toMatch(/\b[GF]\d{2}\b|(?:skill|spec|profession|written):/i);
  });
});
