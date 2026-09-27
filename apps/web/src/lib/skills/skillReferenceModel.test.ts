import { describe, expect, it } from "vitest";
import {
  defaultCanonicalContent,
  getCompetencyV2ReferenceSource,
  competencyV2RelationshipIdentityMap,
  projectCompetencyV2ReferenceRelationships,
} from "@glantri/content";
import { getMeleeCrossTrainingFactor } from "@glantri/rules-engine";
import { buildSkillReferenceModel } from "./skillReferenceModel";

const source = getCompetencyV2ReferenceSource();
const model = buildSkillReferenceModel(source);

describe("canonical V2 competency reference", () => {
  it("uses only canonical V2 identities and preserves the complete approved inventory", () => {
    expect(model.inventory).toEqual({
      learningGroups: 95,
      professionPaths: 86,
      professionFamilies: 84,
    });
    expect(model.withdrawnGroups).toHaveLength(13);
    const ids = new Set([...source.skills, ...source.specializations].map((row) => row.id));
    expect(model.skills.map((row) => row.id).sort()).toEqual([...ids].sort());
    expect(ids.has("medicine")).toBe(false);
    expect(ids.has("first_aid")).toBe(false);
    expect(ids.has("skill:medicine")).toBe(true);
    expect(ids.has("skill:first-aid")).toBe(true);
    expect(
      model.relationships.every((row) => ids.has(row.source.id) && ids.has(row.target.id)),
    ).toBe(true);
  });

  it("projects explicit approved mechanics onto V2 endpoints and publishes no bridge row", () => {
    expect(competencyV2RelationshipIdentityMap.medicine).toBe("skill:medicine");
    expect(competencyV2RelationshipIdentityMap.first_aid).toBe("skill:first-aid");
    expect(source.relationships.grants).toContainEqual({
      sourceId: "skill:medicine",
      targetId: "skill:first-aid",
      factor: 1,
    });
    expect(model.relationships).toContainEqual(
      expect.objectContaining({
        source: expect.objectContaining({ id: "skill:medicine" }),
        target: expect.objectContaining({ id: "skill:first-aid" }),
        mechanism: "Derived grant",
        factor: 1,
      }),
    );
    /* Rule decision 0010 ruling 5 deletes the `specializationBridge` mechanism, so the reference
       publishes no bridge row and no numeric factor for either competency. The authored qualitative
       `helpful` Bow dependency is preserved as authored and is NOT a relationship row here: it stays
       a dependency, never a graded transfer. */
    expect(model.relationships.map((row) => row.mechanism as string)).not.toContain(
      "Specialization bridge",
    );
    for (const id of ["longbow", "fencing"]) {
      expect(
        model.relationships.filter((row) => row.source.id === id || row.target.id === id),
      ).toEqual([]);
    }
    expect(
      defaultCanonicalContent.skills.find((skill) => skill.id === "longbow")!.dependencies,
    ).toEqual([{ skillId: "bow", strength: "helpful" }]);
    expect(model.relationships.some((row) => row.mechanism === "Melee cross-training")).toBe(true);
    expect(model.relationships.every((row) => row.factor !== 0.25)).toBe(true);
    const mapped = (id: string) => competencyV2RelationshipIdentityMap[id]!;
    const expected = [
      ...defaultCanonicalContent.skills.flatMap((skill) =>
        (skill.derivedGrants ?? []).map((grant) => [
          "Derived grant",
          mapped(skill.id),
          mapped(grant.skillId),
          grant.factor,
        ]),
      ),
      ...defaultCanonicalContent.skills.flatMap((from) =>
        from.meleeCrossTraining
          ? defaultCanonicalContent.skills.flatMap((to) => {
              if (!to.meleeCrossTraining || from.id === to.id) return [];
              const factor = getMeleeCrossTrainingFactor({
                source: from.meleeCrossTraining!,
                target: to.meleeCrossTraining,
              });
              return factor > 0
                ? [["Melee cross-training", mapped(from.id), mapped(to.id), factor]]
                : [];
            })
          : [],
      ),
    ]
      .map((row) => JSON.stringify(row))
      .sort();
    const actual = model.relationships
      .map((row) => JSON.stringify([row.mechanism, row.source.id, row.target.id, row.factor]))
      .sort();
    expect(actual).toEqual(expected);
    /* 31, not 33: the two bridge rows are gone and nothing replaced them. */
    expect(actual).toHaveLength(31);
  });

  it("names an unmapped endpoint and withholds the reference projection", () => {
    const canonicalIds = new Set(
      [...source.skills, ...source.specializations].map((row) => row.id),
    );
    const medicine = defaultCanonicalContent.skills.find((row) => row.id === "medicine")!;
    expect(() =>
      projectCompetencyV2ReferenceRelationships(
        {
          skills: [{ ...medicine, derivedGrants: [{ skillId: "unmapped-test", factor: 0.5 }] }],
          specializations: [],
        },
        canonicalIds,
      ),
    ).toThrow("Unmapped canonical V2 relationship endpoints: unmapped-test");
  });

  it("retains authored route choices, gaps, writing floor, and removed-group replacements", () => {
    expect(
      model.professions.find((row) => row.id === "profession:courier")?.coreAlternatives,
    ).toHaveLength(3);
    expect(
      model.professions
        .find((row) => row.id === "profession:soldier")
        ?.choiceSlots.map((row) => row.chooseCount),
    ).toEqual([1, 2, 1]);
    expect(
      model.withdrawnGroups.find((row) => row.id === "G06")?.successors.map((row) => row.id),
    ).toEqual(["N01"]);
    expect(model.withdrawnGroups.find((row) => row.id === "F16")?.successors).toEqual([]);
    expect(model.withdrawnGroups.some((row) => row.successors.length > 1)).toBe(true);
    expect(source.availability.routeGaps).toHaveLength(8);
    expect(source.availability.accessGridDivergences.map((row) => row.id)).toEqual([
      "sl1-learned-access",
      "writing-below-society-level-3",
    ]);
    expect(model.skills.find((row) => row.id === "camouflage")?.routeGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 1, plausibility: expect.any(String) }),
      ]),
    );
    expect(model.authoredCeiling).toBe(3);
    const written = model.skills.filter((row) => row.type === "Written tradition");
    expect(written).toHaveLength(11);
    expect(written.every((row) => row.linkedStats.join("/") === "INT/INT")).toBe(true);
    expect(Math.min(...written.map((row) => row.writtenFloor ?? Infinity))).toBe(2);
    expect(model.societies.some((row) => row.archSociety)).toBe(true);
    expect(
      model.professions.some((row) =>
        row.routes.some((route) => route.bound?.minSocialBand === "L2"),
      ),
    ).toBe(true);
  });

  it("records the V2 source digest the authorized corpus corrections produce", () => {
    expect(model.sourceDigest).toBe(source.sourceDigest);
    // Digest intentionally moved by Product Owner ruling (2026-09-27, issue #365): C02's
    // canonical short description said "across several crafts", contradicting its own
    // settled choose-one membership/note. Fixing the short description text changed the
    // corpus digest. This is authorized content correction, not silent drift.
    //
    // Moved again by issue #389 (rule decision 0010 rulings 1, 2 and 5): Fencing and Longbow are
    // base combat Skills, F30 and F41 teach them directly, Longbow joins the M04/M05 pools, and the
    // `specializationBridge` mechanism and its two bridge rows are deleted. Recomputed, not relaxed.
    expect(source.sourceDigest).toBe(
      "sha256:9896c39a895a3f3dd54dab96ada8c968d24f9a8237c3733f3ee67f65a67b294e",
    );
  });
});
