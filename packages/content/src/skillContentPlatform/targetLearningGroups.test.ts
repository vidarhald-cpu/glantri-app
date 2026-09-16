import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildTargetLearningGroupCatalogue,
  parseTargetLearningGroupPages,
  targetLearningGroupCatalogue as catalogue,
} from "./targetLearningGroups";
import {
  fullLearningGroupsSource,
  martialLearningGroupsSource,
} from "./targetLearningGroupsSource";
import { fullSkillCatalogueProposal } from "./fullSkillCatalogueProposal";
import { sha256 } from "../integrity/canonicalSha256";

describe("approved target Learning Groups", () => {
  it("preserves the supplied bytes in durable sources and produces a deterministic complete graph", () => {
    for (const [index, markdown] of [
      fullLearningGroupsSource,
      martialLearningGroupsSource,
    ].entries()) {
      const source = catalogue.sources[index]!;
      const disk = readFileSync(
        fileURLToPath(new URL(`../../../../${source.path}`, import.meta.url)),
        "utf8",
      );
      expect(disk).toBe(markdown);
      expect(sha256(disk)).toBe(source.sha256);
    }
    expect(buildTargetLearningGroupCatalogue()).toEqual(catalogue);
    expect(catalogue.manifest).toMatchObject({
      groups: 59,
      baseMemberships: 151,
      specializationMemberships: 9,
      totalMemberships: 160,
      groupedBaseSkills: 90,
      grouplessBaseSkills: 41,
      pilotGroups: 18,
      pilotLinks: 46,
    });
  });
  it("replaces exactly four pages, adds seven, and preserves the other 48 complete pages", () => {
    const baseline = parseTargetLearningGroupPages(
      fullLearningGroupsSource,
      catalogue.sources[0]!.path,
      catalogue.sources[0]!.sha256,
    );
    const martial = parseTargetLearningGroupPages(
      martialLearningGroupsSource,
      catalogue.sources[1]!.path,
      catalogue.sources[1]!.sha256,
    );
    const changed = new Set(martial.map((group) => group.id));
    const unchanged = baseline.filter((group) => !changed.has(group.id));
    expect(unchanged).toHaveLength(48);
    for (const group of [...unchanged, ...martial])
      expect(catalogue.groups.find((value) => value.id === group.id)).toEqual(group);
    const ids = (id: string) =>
      catalogue.groups
        .find((group) => group.id === id)!
        .members.map((member) => member.competencyId);
    expect(ids("G08")).toEqual(["one_handed_edged", "dodge", "parry"]);
    expect(ids("F30")).toEqual(["one_handed_edged", "dodge", "parry", "fencing"]);
    expect(ids("F31")).toEqual([
      "polearms",
      "one_handed_edged",
      "throwing",
      "dodge",
      "parry",
      "brawling",
      "formation_fighting",
    ]);
    const remainingMartial = {
      F32: [
        "lance",
        "one_handed_edged",
        "dodge",
        "parry",
        "brawling",
        "mounted_combat",
        "formation_fighting",
      ],
      F35: ["one_handed_concussion_axe", "dodge", "parry", "brawling"],
      F36: [
        "one_handed_edged",
        "one_handed_concussion_axe",
        "dodge",
        "parry",
        "brawling",
        "formation_fighting",
      ],
      F37: ["two_handed_edged", "two_handed_concussion_axe", "dodge", "parry", "brawling"],
      F38: ["bow", "formation_fighting"],
      F39: ["crossbow", "formation_fighting"],
      F40: ["skill:firearms", "formation_fighting"],
      F41: ["bow", "skill:hunting", "longbow"],
    };
    for (const [id, members] of Object.entries(remainingMartial)) expect(ids(id)).toEqual(members);
  });
  it("keeps Pilot provenance separate and preserves every exact original link", () => {
    expect(catalogue.pilotLearningGroups).toEqual(fullSkillCatalogueProposal.pilotLearningGroups);
    expect(catalogue.pilotLearningGroups.find((group) => group.id === "G08")!.skillIds).toEqual([
      "skill:dodge",
      "skill:sword",
      "skill:shield",
      "skill:knife-dagger",
      "skill:spear",
    ]);
    const targetIds = catalogue.groups.flatMap((group) =>
      group.members.map((member) => member.competencyId),
    );
    for (const id of ["skill:sword", "skill:shield", "skill:knife-dagger", "skill:spear"])
      expect(targetIds).not.toContain(id);
  });
  it("resolves explicit identities and parents without inheritance or synthetic groupless groups", () => {
    for (const member of catalogue.groups.flatMap((group) => group.members)) {
      const entry = fullSkillCatalogueProposal.entries.find(
        (entry) => entry.id === member.competencyId,
      )!;
      expect(member.name).toBe(entry.name);
      expect(member.kind).toBe(entry.competencyType);
      expect(member.parentId).toBe(entry.parent?.id);
    }
    const falconry = catalogue.groups
      .flatMap((group) => group.members)
      .find((member) => member.competencyId === "spec:falconry")!;
    expect(falconry.parentId).toBe("spec:animal-training");
    expect(
      fullSkillCatalogueProposal.entries.find((entry) => entry.id === falconry.parentId)!.parent
        ?.id,
    ).toBe("skill:animal-handling");
    const grouped = new Set(
      catalogue.groups.flatMap((group) =>
        group.members
          .filter((member) => member.kind === "base-skill")
          .map((member) => member.competencyId),
      ),
    );
    expect(catalogue.grouplessBaseSkillIds.every((id) => !grouped.has(id))).toBe(true);
    expect(new Set([...grouped, ...catalogue.grouplessBaseSkillIds]).size).toBe(131);
  });
  it("rejects unknown IDs, changed types, parents and duplicate membership instead of guessing", () => {
    for (const source of [
      fullLearningGroupsSource.replace("`nursing` — Nursing", "`invented` — Nursing"),
      fullLearningGroupsSource.replace("| Base Skill |", "| Unknown |"),
      fullLearningGroupsSource.replace(
        "parent: `spec:animal-training`",
        "parent: `skill:animal-handling`",
      ),
    ]) {
      expect(() => parseTargetLearningGroupPages(source, "test", "test")).toThrow();
    }
  });
});
