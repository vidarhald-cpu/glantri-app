import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";
import {
  buildChargenSkillAccessSummary,
  getActiveGroupSkillPurchaseCost,
  buildChargenSelectableSkillSummary,
  syncChargenSelectionSkillRows,
  finalizeChargenDraft,
  allocateChargenPoint,
  buildChargenDraftView,
  buildCharacterSheetSummary,
  createChargenProgression,
  removeChargenPoint,
  spendSecondaryPoint,
  resolveEffectiveProfessionPackage,
} from "@glantri/rules-engine";

import {
  characterBuildSchema,
  characterProgressionSchema,
  characterSkillSchema,
} from "@glantri/domain";

import { characterPayload } from "../../../e2e/character-fixture";
import { localDb } from "../../lib/offline/glantriDexie";
import { CharacterDraftRepository } from "../../lib/offline/repositories/characterDraftRepository";
import { LocalCharacterRepository } from "../../lib/offline/repositories/localCharacterRepository";
import {
  buildCharacterSheetSkillRows,
  buildCharacterSheetSpecializationRows,
} from "../../lib/characters/characterSheet";
import { getLegacySocietyChargenContext } from "./chargenContentContextSource";
import {
  buildTargetChargenDefinitions,
  buildTargetRuntimeContent,
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

  it("uses approved linked stats and preserves unambiguous legacy counterparts", () => {
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
        linkedStats: { status: "approved" },
      });
    }
    for (const entry of entries.filter(
      ({ competencyType }) => competencyType === "written-tradition",
    )) {
      expect(entry).toMatchObject({ linkedStats: { status: "approved" } });
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
    expect(getTargetCompetencyActivationBlockers(source)).toEqual([]);
    expect(
      entries.filter((entry) => "linkedStats" in entry && entry.linkedStats.status === "approved"),
    ).toHaveLength(61);
    expect(entries.find(({ id }) => id === "skill:campaign-strategy")).toMatchObject({
      linkedStats: { linkedStats: ["int", "int"] },
    });
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
    expect(buildTargetChargenDefinitions(source).skills).toHaveLength(146);
    const incomplete = structuredClone(source);
    incomplete.catalogue.content.entries = [];
    expect(() => buildTargetChargenDefinitions(incomplete)).toThrow("complete approved competency");
  });

  it("activates the complete runtime catalogue without new memberships or Profession data", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    expect(content.chargenCatalogue?.skillIds).toHaveLength(146);
    expect(content.chargenCatalogue?.specializationIds).toHaveLength(26);
    expect(content.skillGroups).toEqual(defaultCanonicalContent.skillGroups);
    expect(content.professions).toEqual(defaultCanonicalContent.professions);
    const surgery = content.skills.find(({ id }) => id === "skill:surgery")!;
    expect(surgery.groupId).toBeUndefined();
    expect(surgery.groupIds).toEqual([]);
    const handling = content.skills.find(({ id }) => id === "skill:animal-handling")!;
    for (const id of ["spec:animal-training", "spec:falconry"]) {
      expect(content.specializations.find((spec) => spec.id === id)).toMatchObject({
        linkedStats: handling.linkedStats,
      });
    }
  });

  it("spends and refunds group-free targets, rejects excluded legacy purchases, and reopens saved targets", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    const progression = { ...createChargenProgression(), secondaryPoolTotal: 100 };
    const input = {
      content,
      progression,
      professionId: defaultCanonicalContent.professions[0].id,
      societyLevel: 1,
      targetId: "skill:surgery",
      targetType: "skill" as const,
    };
    const bought = allocateChargenPoint(input);
    expect(bought.error).toBeUndefined();
    expect(bought.spentCost).toBe(1);
    expect(bought.progression.primaryPoolSpent).toBe(0);
    expect(bought.progression.skills[0]).toMatchObject({
      skillId: "skill:surgery",
      secondaryRanks: 1,
    });
    expect(bought.progression.skills[0].groupId).toBeUndefined();
    const saved = characterProgressionSchema.parse(JSON.parse(JSON.stringify(bought.progression)));
    const view = buildChargenDraftView({
      content: defaultCanonicalContent,
      progression: saved,
      skillLinkedStats: { int: 12, dex: 10 },
    });
    expect(view.skills.find(({ skillId }) => skillId === "skill:surgery")).toMatchObject({
      name: "Surgery",
      specificSkillLevel: 1,
    });
    expect(
      removeChargenPoint({ ...input, progression: saved }).progression.secondaryPoolSpent,
    ).toBe(0);
    expect(allocateChargenPoint({ ...input, targetId: "literacy" }).error).toContain(
      "not a target acquisition",
    );
    expect(characterSkillSchema.safeParse({ skillId: "legacy-without-group" }).success).toBe(false);
    expect(
      characterSkillSchema.safeParse({ ...saved.skills[0], skillId: "mismatched-target" }).success,
    ).toBe(false);
  });

  it("requires Falconry's immediate parent and persists its readable parent label", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    let progression = { ...createChargenProgression(), secondaryPoolTotal: 200 };
    for (let i = 0; i < 11; i++) {
      const bought = allocateChargenPoint({
        content,
        progression,
        professionId: defaultCanonicalContent.professions[0].id,
        societyLevel: 1,
        targetId: "skill:animal-handling",
        targetType: "skill",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
    }
    const buy = (id: string) =>
      spendSecondaryPoint({
        content,
        progression,
        societyLevel: 1,
        targetId: id,
        targetType: "specialization",
      });
    expect(buy("spec:falconry").error).toBeDefined();
    for (let i = 0; i < 11; i++) {
      const bought = buy("spec:animal-training");
      expect(bought.error).toBeUndefined();
      expect(bought.spentCost).toBe(i === 0 ? 4 : 2);
      progression = bought.progression;
    }
    const falconry = buy("spec:falconry");
    expect(falconry.error).toBeUndefined();
    expect(falconry.spentCost).toBe(4);
    const saved = characterProgressionSchema.parse(
      JSON.parse(JSON.stringify(falconry.progression)),
    );
    expect(
      buildChargenDraftView({
        content: defaultCanonicalContent,
        progression: saved,
      }).specializations.find(({ specializationId }) => specializationId === "spec:falconry"),
    ).toMatchObject({ name: "Falconry", parentSkillName: "Animal Training", secondaryRanks: 1 });
  });

  it("preserves target and legacy rows through local Character and retained-draft repositories", async () => {
    // Named legacy-content fixtures demonstrate readable obsolete identities;
    // they are not added to canonical content or the target catalogue.
    const aliases = ["sword", "shield", "knife_dagger", "spear"].map((id) => ({
      ...defaultCanonicalContent.skills.find(({ id }) => id === "one_handed_edged")!,
      id,
      name: id === "sword" ? "Sword" : id,
    }));
    const legacyContent = {
      ...defaultCanonicalContent,
      skills: [...defaultCanonicalContent.skills, ...aliases],
    };
    const content = buildTargetRuntimeContent(createTargetCompetencyChargenSource(legacyContent));
    for (const alias of aliases) {
      expect(
        allocateChargenPoint({
          content,
          progression: createChargenProgression(),
          professionId: defaultCanonicalContent.professions[0].id,
          societyLevel: 1,
          targetId: alias.id,
          targetType: "skill",
        }).error,
      ).toContain("not a target acquisition");
    }
    const bought = allocateChargenPoint({
      content,
      progression: { ...createChargenProgression(), secondaryPoolTotal: 100 },
      professionId: defaultCanonicalContent.professions[0].id,
      societyLevel: 1,
      targetId: "skill:surgery",
      targetType: "skill",
    });
    const legacy = aliases[0];
    bought.progression.skills.push(
      characterSkillSchema.parse({
        skillId: legacy.id,
        groupId: legacy.groupId,
        secondaryRanks: 2,
        ranks: 2,
      }),
    );
    const build = characterBuildSchema.parse({
      ...characterPayload("issue168-target-local", "Target and legacy").build,
      progression: bought.progression,
    });
    const characters = new LocalCharacterRepository();
    const drafts = new CharacterDraftRepository();
    try {
      await characters.save({ build, creatorId: "issue168-owner" });
      const loaded = await characters.get(build.id);
      expect(loaded?.creatorId).toBe("issue168-owner");
      expect(loaded?.build.progression).toEqual(build.progression);
      await drafts.createFromCharacter(loaded!);
      const retained = await drafts.get(build.id);
      expect(retained?.build).toEqual(build);
      const sheetSummary = buildCharacterSheetSummary({
        build: retained!.build,
        content: legacyContent,
      });
      const rows = buildCharacterSheetSkillRows({
        build: retained!.build,
        content: legacyContent,
        sheetSummary,
      }).flatMap(({ rows }) => rows);
      expect(rows.find(({ skillId }) => skillId === "skill:surgery")?.skillName).toBe("Surgery");
      expect(rows.find(({ skillId }) => skillId === legacy.id)?.skillName).toBe(legacy.name);
      expect(
        buildCharacterSheetSpecializationRows({
          content: legacyContent,
          sheetSummary: {
            ...sheetSummary,
            draftView: {
              ...sheetSummary.draftView,
              specializations: [
                {
                  name: "Falconry",
                  parentSkillName: "Animal Training",
                  specializationId: "spec:falconry",
                  specializationLevel: 1,
                  secondaryRanks: 1,
                  effectiveSpecializationNumber: 1,
                },
              ],
            },
          },
        })[0],
      ).toMatchObject({ specializationName: "Falconry", parentSkillName: "Animal Training" });
    } finally {
      await drafts.delete(build.id);
      await localDb.localCharacters.delete(build.id);
    }
  });

  it("keeps every required slot satisfiable using only exact target identities", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    const targetIds = new Set(content.chargenCatalogue!.skillIds);
    const counts = new Map<string, number>();
    for (const group of content.skillGroups) {
      for (const slot of group.selectionSlots ?? []) {
        expect(
          slot.candidateSkillIds.filter((id) => targetIds.has(id)).length,
        ).toBeGreaterThanOrEqual(slot.chooseCount);
      }
    }
    for (const society of content.societyLevels) {
      for (const professionId of society.professionIds) {
        const summary = buildChargenSelectableSkillSummary({
          content,
          professionId,
          progression: createChargenProgression(),
          societyId: society.societyId,
          societyLevel: society.societyLevel,
        });
        for (const slot of summary.selectionSlots) {
          expect(slot.candidateSkillIds.every((id) => targetIds.has(id))).toBe(true);
          expect(slot.candidateSkillIds.length).toBeGreaterThanOrEqual(slot.chooseCount);
          counts.set(slot.groupId, slot.candidateSkillIds.length);
        }
      }
    }
    expect(Object.fromEntries(counts)).toMatchObject({
      craft_specialty: 6,
      craft_specialty_advanced: 6,
      construction_specialty: 2,
      basic_melee_training: 6,
      advanced_melee_training: 6,
      basic_missile_training: 4,
    });
    const synced = syncChargenSelectionSkillRows({
      content,
      progression: {
        ...createChargenProgression(),
        chargenSelections: {
          selectedLanguageIds: [],
          selectedSkillIds: ["smithing", "brewing", "one_handed_edged"],
          selectedGroupSlots: [],
        },
      },
    });
    expect(synced.skills.map(({ skillId }) => skillId)).toEqual(["one_handed_edged"]);
  });

  it("finalizes explicit target types without transferring spoken and written ranks", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    const spoken = content.skills.find(
      (skill) => "competencyType" in skill && skill.competencyType === "spoken-language",
    )!;
    const written = content.skills.find(
      (skill) => "competencyType" in skill && skill.competencyType === "written-tradition",
    )!;
    const profile = characterBuildSchema.parse(
      characterPayload("target-final", "Target final").build,
    ).profile;
    const professionId = defaultCanonicalContent.professions[0].id;
    let progression = { ...createChargenProgression(), secondaryPoolTotal: 100 };
    for (const targetId of [spoken.id, written.id]) {
      const bought = allocateChargenPoint({
        content,
        progression,
        profile,
        professionId,
        societyLevel: 1,
        targetId,
        targetType: "skill",
      });
      expect(bought.error).toBeUndefined();
      progression = bought.progression;
      expect(progression.skills.find(({ skillId }) => skillId === spoken.id)?.secondaryRanks).toBe(
        1,
      );
    }
    const finalized = finalizeChargenDraft({
      content,
      progression,
      profile,
      professionId,
      societyLevel: 1,
      name: "Target final",
    });
    expect(finalized.errors).toEqual([]);
    const saved = characterBuildSchema.parse(JSON.parse(JSON.stringify(finalized.build)));
    expect(
      saved.progression.skills.find(({ skillId }) => skillId === spoken.id)?.targetDefinition
        ?.competencyType,
    ).toBe("spoken-language");
    expect(
      saved.progression.skills.find(({ skillId }) => skillId === written.id)?.targetDefinition
        ?.competencyType,
    ).toBe("written-tradition");
    expect(saved.progression.skills.some(({ skillId }) => skillId === "literacy")).toBe(false);
  });

  it("matches legacy ordinary-route spending/refunds and compatibility Group prices", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    const skillId = "carpentry";
    const route = defaultCanonicalContent.societyLevels
      .flatMap((society) =>
        society.professionIds.map((professionId) => ({
          professionId,
          societyId: society.societyId,
          societyLevel: society.societyLevel,
        })),
      )
      .find((route) =>
        buildChargenSkillAccessSummary({
          content: defaultCanonicalContent,
          ...route,
        }).normalSkillIds.includes(skillId),
      );
    expect(route).toBeDefined();
    const input = {
      ...route!,
      progression: createChargenProgression(),
      targetId: skillId,
      targetType: "skill" as const,
    };
    const legacy = allocateChargenPoint({ ...input, content: defaultCanonicalContent });
    const target = allocateChargenPoint({ ...input, content });
    expect(legacy.error).toBeUndefined();
    expect(target.error).toBeUndefined();
    expect(target.spentCost).toBe(legacy.spentCost);
    expect(target.progression.primaryPoolSpent).toBe(legacy.progression.primaryPoolSpent);
    expect(
      removeChargenPoint({ ...input, content, progression: target.progression }).spentCost,
    ).toBe(
      removeChargenPoint({
        ...input,
        content: defaultCanonicalContent,
        progression: legacy.progression,
      }).spentCost,
    );
    const progression = {
      ...createChargenProgression(),
      chargenSelections: {
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [
          {
            groupId: "basic_melee_training",
            slotId: "melee_weapon_choice",
            selectedSkillIds: ["one_handed_edged"],
          },
        ],
      },
    };
    expect(
      getActiveGroupSkillPurchaseCost({ content, progression, groupId: "basic_melee_training" }),
    ).toEqual(
      getActiveGroupSkillPurchaseCost({
        content: defaultCanonicalContent,
        progression,
        groupId: "basic_melee_training",
      }),
    );
  });

  it("prices retained target IDs by access route while keeping legacy category prices", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    const routes = content.societyLevels.flatMap((society) =>
      society.professionIds.map((professionId) => ({
        professionId,
        societyId: society.societyId,
        societyLevel: society.societyLevel,
      })),
    );
    const ordinary = routes.find((route) =>
      buildChargenSkillAccessSummary({ content, ...route }).normalSkillIds.includes(
        "one_handed_edged",
      ),
    )!;
    const flexible = routes.find(
      (route) =>
        !buildChargenSkillAccessSummary({ content, ...route }).normalSkillIds.includes(
          "one_handed_edged",
        ),
    )!;
    expect(ordinary).toBeDefined();
    expect(flexible).toBeDefined();
    const input = {
      progression: { ...createChargenProgression(), secondaryPoolTotal: 100 },
      targetId: "one_handed_edged",
      targetType: "skill" as const,
    };
    expect(
      allocateChargenPoint({ ...input, ...ordinary, content: defaultCanonicalContent }).spentCost,
    ).toBe(1);
    const bought = allocateChargenPoint({ ...input, ...ordinary, content });
    expect(bought.spentCost).toBe(2);
    expect(
      removeChargenPoint({ ...input, ...ordinary, content, progression: bought.progression })
        .spentCost,
    ).toBe(2);
    expect(allocateChargenPoint({ ...input, ...flexible, content }).spentCost).toBe(1);
    expect(spendSecondaryPoint({ ...input, ...ordinary, content }).spentCost).toBe(2);
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
