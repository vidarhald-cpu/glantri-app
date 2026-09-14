import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";
import {
  buildChargenSkillAccessSummary,
  resolveEffectiveProfessionPackage,
} from "@glantri/rules-engine";

import { getLegacySocietyChargenContext } from "./chargenContentContextSource";
import {
  buildTargetChargenDefinitions,
  createTargetCompetencyChargenSource,
  getTargetCompetencyActivationBlockers,
} from "./targetCompetencyContent";

describe("target competency Chargen projection", () => {
  it("consumes exactly the approved 131/26/12/3 identities, not legacy or support choices", () => {
    const source = createTargetCompetencyChargenSource(defaultCanonicalContent);
    const { entries } = source.catalogue.content;
    expect(entries.map(({ id }) => id)).toEqual(
      fullSkillCatalogueProposal.entries.map(({ id }) => id),
    );
    expect(new Set(entries.map(({ id }) => id)).size).toBe(172);
    expect(
      Object.fromEntries(
        ["base-skill", "specialization", "spoken-language", "written-tradition"].map((type) => [
          type,
          entries.filter(({ competencyType }) => competencyType === type).length,
        ]),
      ),
    ).toEqual({
      "base-skill": 131,
      specialization: 26,
      "spoken-language": 12,
      "written-tradition": 3,
    });
    expect(entries.map(({ name }) => name)).not.toEqual(
      defaultCanonicalContent.skills.map(({ name }) => name),
    );
    expect(
      entries.some(({ id }) =>
        ["skill:sword", "skill:shield", "skill:knife-dagger", "skill:spear", "literacy"].includes(
          id,
        ),
      ),
    ).toBe(false);
    for (const support of fullSkillCatalogueProposal.supportScripts) {
      expect(entries.some(({ id }) => id === support.id)).toBe(false);
    }
  });

  it("preserves all named parents, including the immediate Specialization parent of Falconry", () => {
    const { entries } =
      createTargetCompetencyChargenSource(defaultCanonicalContent).catalogue.content;
    const namedParents = Object.fromEntries(
      entries.filter(({ parent }) => parent).map((entry) => [entry.name, entry.parent!.name]),
    );
    expect(namedParents).toMatchObject({
      Fencing: "1-h edged",
      Longbow: "Bow",
      Weaponsmithing: "Smithing",
      "Battlefield Surgery": "Surgery",
      "Animal Training": "Animal Handling",
      Falconry: "Animal Training",
      "Steppe Remount Training": "Animal Husbandry",
    });
    expect(entries.find(({ name }) => name === "Surgery")?.competencyType).toBe("base-skill");
    expect(entries.find(({ name }) => name === "Falconry")?.parent?.id).toBe(
      "spec:animal-training",
    );
    expect(entries.find(({ name }) => name === "Animal Training")?.parent?.id).toBe(
      "skill:animal-handling",
    );
    expect(entries.find(({ name }) => name === "Fencing")).toMatchObject({ minimumParentLevel: 6 });
    expect(entries.find(({ name }) => name === "Falconry")).toMatchObject({
      minimumParentLevel: 11,
    });
  });

  it("preserves clear legacy counterpart stats without manufacturing missing base or written stats", () => {
    const content = structuredClone(defaultCanonicalContent);
    const source = createTargetCompetencyChargenSource(content);
    const { entries } = source.catalogue.content;
    const edged = entries.find(({ name }) => name === "1-h edged");
    expect(edged).toMatchObject({
      linkedStats: {
        status: "legacy-counterpart",
        legacySkillId: "one_handed_edged",
        linkedStats: ["str", "dex"],
      },
    });
    for (const name of ["Armoring", "Sailmaking", "Surgery"]) {
      expect(entries.find((entry) => entry.name === name)).toMatchObject({
        linkedStats: { status: "pending-linked-stats" },
      });
    }
    for (const entry of entries.filter(
      ({ competencyType }) => competencyType === "written-tradition",
    )) {
      expect(entry).toMatchObject({ linkedStats: { status: "pending-linked-stats" } });
      expect(getTargetCompetencyActivationBlockers(source)).toContain(entry.id);
    }
    for (const entry of entries.filter(
      ({ competencyType }) => competencyType === "spoken-language",
    )) {
      expect(entry).toMatchObject({
        linkedStats: {
          status: "legacy-counterpart",
          legacySkillId: "language",
          linkedStats: ["int", "int"],
        },
      });
    }
    content.skills.find(({ id }) => id === "one_handed_edged")!.linkedStats[0] = "int";
    expect(edged).toMatchObject({ linkedStats: { linkedStats: ["str", "dex"] } });
    expect(getTargetCompetencyActivationBlockers(source)).toContain("skill:surgery");
    expect(getTargetCompetencyActivationBlockers(source)).toHaveLength(61);
    for (const [name, legacySkillId] of [
      ["Poisons", "poison_lore"],
      ["Trade", "trading"],
      ["Plant Lore", "herb_lore"],
      ["Running", "run"],
      ["Swimming", "swim"],
      ["Lockpicking", "lockpicking"],
      ["Customs", "etiquette"],
      ["Cart Driving", "teamstering"],
    ]) {
      expect(entries.find((entry) => entry.name === name)).toMatchObject({
        linkedStats: {
          status: "legacy-counterpart",
          legacySkillId,
          linkedStats: defaultCanonicalContent.skills.find(({ id }) => id === legacySkillId)!
            .linkedStats,
        },
      });
    }
    expect(() => buildTargetChargenDefinitions(source)).toThrow(
      "Target linked stats await approval",
    );
    const incomplete = structuredClone(source);
    incomplete.catalogue.content.entries = [];
    expect(() => buildTargetChargenDefinitions(incomplete)).toThrow("complete approved competency");
  });

  it("leaves ambiguous counterpart names unresolved", () => {
    const content = structuredClone(defaultCanonicalContent);
    content.skills.push({
      ...content.skills.find(({ id }) => id === "medicine")!,
      id: "ambiguous-medicine",
      linkedStats: ["int"],
    });
    const source = createTargetCompetencyChargenSource(content);
    expect(source.catalogue.content.entries.find(({ name }) => name === "Medicine")).toMatchObject({
      linkedStats: { status: "pending-linked-stats" },
    });
  });

  it("keeps unbound context separate from unchanged legacy Profession and Group calculations", () => {
    const source = createTargetCompetencyChargenSource(defaultCanonicalContent);
    expect(source.acquisitionContext).toEqual({ kind: "unbound", scope: "general" });
    expect(getLegacySocietyChargenContext(source)).toBeUndefined();
    expect(source.compatibilityContent).toBe(defaultCanonicalContent);
    expect(source.catalogue.content).not.toHaveProperty("learningGroups");
    expect(source.catalogue.content).not.toHaveProperty("professions");
    const access = defaultCanonicalContent.societyLevels.find(
      ({ professionIds }) => professionIds.length > 0,
    )!;
    const input = {
      professionId: access.professionIds[0]!,
      societyId: access.societyId,
      societyLevel: access.societyLevel,
    };
    expect(
      buildChargenSkillAccessSummary({ content: source.compatibilityContent, ...input }),
    ).toEqual(buildChargenSkillAccessSummary({ content: defaultCanonicalContent, ...input }));
    expect(
      resolveEffectiveProfessionPackage({
        content: source.compatibilityContent,
        subtypeId: input.professionId,
      }),
    ).toEqual(
      resolveEffectiveProfessionPackage({
        content: defaultCanonicalContent,
        subtypeId: input.professionId,
      }),
    );
  });
});

describe("target Skill access-route prices", () => {
  it("uses the approved route rather than competency type", async () => {
    const { chargenTargetSkillDefinitionSchema } = await import("@glantri/domain");
    const { getSkillSpendCost } = await import("@glantri/rules-engine");
    for (const competencyType of ["base-skill", "spoken-language", "written-tradition"]) {
      const target = chargenTargetSkillDefinitionSchema.parse({
        competencyType,
        id: "test:target",
        name: "Target fixture",
        description: "Synthetic cost fixture",
        shortDescription: "Fixture",
        linkedStats: ["int"],
      });
      expect(getSkillSpendCost(target, "ordinary")).toBe(2);
      expect(getSkillSpendCost(target, "flexible")).toBe(1);
      // @ts-expect-error Target purchases must explicitly resolve their access route.
      expect(() => getSkillSpendCost(target)).toThrow("active access route");
    }
  });
});
