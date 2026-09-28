import { describe, expect, it } from "vitest";

import { sha256 } from "../integrity/canonicalSha256";
import {
  FULL_SKILL_CATALOGUE_SOURCE_SHA256,
  FULL_SKILL_CATALOGUE_SOURCE_SIZE,
  fullSkillCatalogueProposal,
} from "./fullSkillCatalogueProposal";
import { fullSkillCatalogueProposalSourceMarkdown } from "./fullSkillCatalogueProposalSource";

describe("full Skill catalogue proposal", () => {
  it("preserves the exact authored source bytes and acquisition inventory", () => {
    expect(sha256(fullSkillCatalogueProposalSourceMarkdown)).toBe(
      FULL_SKILL_CATALOGUE_SOURCE_SHA256,
    );
    expect(new TextEncoder().encode(fullSkillCatalogueProposalSourceMarkdown)).toHaveLength(
      FULL_SKILL_CATALOGUE_SOURCE_SIZE,
    );
    expect(fullSkillCatalogueProposal.manifest).toMatchObject({
      baseSkills: 133,
      competencies: 172,
      specializations: 24,
      spokenLanguages: 12,
      supportScripts: 3,
      unresolvedBindings: 9,
      writtenTraditions: 3,
    });
    expect(new Set(fullSkillCatalogueProposal.entries.map(({ id }) => id)).size).toBe(172);
  });

  it("retains every required reader field without manufacturing mechanics", () => {
    fullSkillCatalogueProposal.entries.forEach((entry) => {
      expect(entry.shortDescription).not.toBe("");
      expect(entry.description).not.toBe("");
      expect(entry.typicalUses.length).toBeGreaterThanOrEqual(2);
      expect(entry.boundaries.length).toBeGreaterThan(0);
      expect(entry.context).not.toBe("");
      expect(entry.learningGroupAnnotation).not.toBe("");
      expect(entry.archSkillAnnotation).not.toBe("");
      expect(entry.idStatus).not.toBe("");
      expect(entry.provenance).not.toBe("");
      expect(entry).not.toHaveProperty("weight");
      expect(entry).not.toHaveProperty("prerequisites");
      expect(entry).not.toHaveProperty("transfer");
    });
  });

  it("represents authored nested Specialization parentage exactly", () => {
    expect(
      fullSkillCatalogueProposal.entries.find(({ id }) => id === "spec:falconry")?.parent,
    ).toMatchObject({ id: "spec:animal-training", name: "Animal Training" });
    expect(
      fullSkillCatalogueProposal.entries.find(({ id }) => id === "spec:animal-training")?.parent,
    ).toEqual({ id: "skill:animal-handling", name: "Animal Handling", note: undefined });
    expect(
      fullSkillCatalogueProposal.entries.find(({ id }) => id === "spec:steppe-remount-training")
        ?.parent,
    ).toMatchObject({ id: "skill:animal-husbandry", name: "Animal Husbandry" });
    expect(
      fullSkillCatalogueProposal.entries.filter(
        ({ competencyType }) => competencyType === "specialization",
      ),
    ).toHaveLength(24);
    // Rule decision 0010 rulings 1 and 2: Fencing and Longbow are base combat Skills, so they
    // carry no Specialization parent and are absent from the Specialization roster.
    for (const id of ["fencing", "longbow"]) {
      const entry = fullSkillCatalogueProposal.entries.find((candidate) => candidate.id === id)!;
      expect(entry.competencyType).toBe("base-skill");
      expect(entry.parent).toBeUndefined();
    }
    expect(
      fullSkillCatalogueProposal.entries
        .filter(({ competencyType }) => competencyType === "specialization")
        .every(({ parent }) => parent !== undefined),
    ).toBe(true);
  });

  it("keeps support, unresolved, held, and excluded cases outside acquisitions", () => {
    const names = new Set(fullSkillCatalogueProposal.entries.map(({ name }) => name));
    expect(names.has("Heart Surgery")).toBe(false);
    expect(names.has("Self-Control")).toBe(false);
    expect(names.has("Formation Command")).toBe(false);
    expect(fullSkillCatalogueProposal.supportScripts.map(({ id }) => id)).toEqual([
      "script:sacred-mogrebi",
      "script:church-ologian",
      "script:phoenician",
    ]);
    expect(fullSkillCatalogueProposal.unresolvedBindings).toHaveLength(9);
    expect(fullSkillCatalogueProposal.exceptions.map(({ item }) => item)).toEqual(
      expect.arrayContaining(["Self-Control", "Formation Command", "Falconry's nested parent"]),
    );
  });

  it("preserves the Pilot groups separately from authored full-catalogue annotations", () => {
    expect(fullSkillCatalogueProposal.manifest).toMatchObject({
      archSkills: 46,
      learningGroups: 21,
      pilotLearningGroupLinks: 46,
      pilotLearningGroups: 18,
    });
    expect(
      fullSkillCatalogueProposal.pilotLearningGroups.find(({ id }) => id === "G08")?.skillIds,
    ).toEqual(["skill:dodge", "skill:sword", "skill:shield", "skill:knife-dagger", "skill:spear"]);
    expect(
      fullSkillCatalogueProposal.learningGroups.find(({ id }) => id === "G08")?.participantIds,
    ).toEqual(["dodge"]);
    expect(
      fullSkillCatalogueProposal.learningGroups.find(({ id }) => id === "G01")?.participantIds,
    ).toEqual(["skill:first-aid", "skill:medicine", "nursing"]);
    expect(
      fullSkillCatalogueProposal.learningGroups.find(({ id }) => id === "F01")?.participantIds,
    ).toEqual(["surveying", "skill:cartography"]);
  });

  it("uses the authored Arch-Skill catalogue rather than deriving it from Domains", () => {
    expect(fullSkillCatalogueProposal.archSkills).toHaveLength(46);
    expect(fullSkillCatalogueProposal.archSkills.find(({ id }) => id === "A01")).toMatchObject({
      name: "Immediate injury care",
      participantIds: ["skill:first-aid", "nursing", "poison_treatment", "battlefield_surgery"],
    });
    expect(fullSkillCatalogueProposal.archSkills.map(({ id }) => id)).toContain("X05");
  });
});
