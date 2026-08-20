import { describe, expect, expectTypeOf, it } from "vitest";

import type { AccessBand, DevelopmentStage } from "@glantri/domain";

import { defaultCanonicalContent } from "../seeds/defaultContent";
import { validateCanonicalContent } from "../validators";
import { representativeSkillSemanticFixtures } from "./fixtures";
import { validateSkillSemanticFixtures } from "./validator";

describe("representative skill semantic fixtures", () => {
  it("validates all eight accepted representative fixtures", () => {
    const result = validateSkillSemanticFixtures(representativeSkillSemanticFixtures);

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.fixtures.map((fixture) => fixture.fixtureId)).toEqual([
      "engineering-construction",
      "finance-trade",
      "language-literacy",
      "law-administration",
      "medicine",
      "navigation",
      "warfare-tactics",
      "weapon-practice",
    ]);
  });

  it("keeps DevelopmentStage and AccessBand as distinct structural types", () => {
    expectTypeOf<DevelopmentStage>().not.toEqualTypeOf<AccessBand>();

    const stages = representativeSkillSemanticFixtures.flatMap((fixture) =>
      fixture.civilizationProfiles.map((profile) => profile.developmentStage),
    );
    const bands = representativeSkillSemanticFixtures.flatMap((fixture) =>
      fixture.civilizationProfiles.flatMap((profile) =>
        profile.accessRoutes.map((route) => route.accessBand),
      ),
    );

    expect(stages.every((stage) => stage.startsWith("DS"))).toBe(true);
    expect(bands.every((band) => band.startsWith("AB"))).toBe(true);
  });

  it("represents lower-stage Surgery and higher-stage specialized Surgery without nesting Surgery", () => {
    const medicine = representativeSkillSemanticFixtures.find(
      (fixture) => fixture.id === "medicine",
    )!;
    const surgery = medicine.nodes.find((node) => node.id === "skill:surgery");
    const lowerStage = medicine.civilizationProfiles.find(
      (profile) => profile.developmentStage === "DS2",
    )!;
    const higherStage = medicine.civilizationProfiles.find(
      (profile) => profile.developmentStage === "DS6",
    )!;

    expect(surgery?.kind).toBe("skill");
    expect(lowerStage.defaultAvailableCompetencyIds).toContain("skill:surgery");
    expect(lowerStage.accessRoutes[0]?.accessBand).toBe("AB1");
    expect(higherStage.accessRoutes[0]?.competencyIds).toEqual(
      expect.arrayContaining([
        "skill:surgery",
        "specialization:surgery:battlefield",
        "specialization:surgery:vascular",
      ]),
    );
    expect(
      medicine.nodes
        .filter((node) => node.kind === "specialization")
        .every((node) => node.parentSkillId === "skill:surgery"),
    ).toBe(true);
  });

  it("separates conceptual nodes, narratable histories, and typed relationship policy", () => {
    for (const fixture of representativeSkillSemanticFixtures) {
      expect(
        fixture.nodes
          .filter((node) => node.kind === "domain" || node.kind === "category")
          .every((node) => !node.purchasable && !node.xpBearing),
      ).toBe(true);
      expect(
        fixture.learningHistories.every(
          (history) =>
            history.basis === "shared-training-history" &&
            history.identity.name.length > 0 &&
            history.identity.sharedContext.length > 0,
        ),
      ).toBe(true);
      expect(fixture.relationshipPolicy).toEqual({
        availability: "availability-first",
        recursion: "non-recursive",
        sourceSelection: "strongest-source-only",
        sourceValues: "authored-only",
        stacking: "non-stacking",
      });
      expect(
        fixture.relationships.every((relationship) => relationship.sourceValue === "authored"),
      ).toBe(true);
    }

    expect(
      representativeSkillSemanticFixtures.flatMap((fixture) =>
        fixture.relationships.map((relationship) => relationship.effect),
      ),
    ).toEqual(
      expect.arrayContaining([
        "familiarity",
        "learning-advantage",
        "reinforcement",
        "specialization",
      ]),
    );
  });

  it("uses campaign-authored spoken language and script identities without universal Literacy", () => {
    const fixture = representativeSkillSemanticFixtures.find(
      (candidate) => candidate.id === "language-literacy",
    )!;

    expect(fixture.languagePolicy).toEqual({
      allowCampaignAuthoredStableIds: true,
      closedVocabulary: false,
      universalLiteracySkill: false,
    });
    expect(fixture.languageEntities.map((entity) => entity.kind)).toEqual([
      "spoken-language",
      "script",
    ]);
    expect(fixture.languageEntities.every((entity) => entity.authoredBy.kind === "campaign")).toBe(
      true,
    );
    expect(fixture.languageCompetencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: "spoken" }),
        expect.objectContaining({ facets: ["reading", "writing"], mode: "written" }),
      ]),
    );
    expect(fixture.nodes.some((node) => String(node.name) === "Literacy")).toBe(false);
  });

  it("does not mutate or replace live canonical content", () => {
    const before = JSON.stringify(defaultCanonicalContent);

    validateSkillSemanticFixtures(representativeSkillSemanticFixtures);

    expect(JSON.stringify(defaultCanonicalContent)).toBe(before);
    expect(validateCanonicalContent(defaultCanonicalContent)).toEqual(defaultCanonicalContent);
  });
});
