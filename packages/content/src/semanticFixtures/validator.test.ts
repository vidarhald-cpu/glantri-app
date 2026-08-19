import { describe, expect, it } from "vitest";

import { antiOptimizationSkillSemanticFixtures } from "./invalidFixtures";
import { validateSkillSemanticFixtures } from "./validator";

describe("skill semantic anti-optimization validation", () => {
  const diagnosticsByFixture = new Map(
    validateSkillSemanticFixtures(antiOptimizationSkillSemanticFixtures).fixtures.map((fixture) => [
      fixture.fixtureId,
      fixture.diagnostics,
    ]),
  );

  it.each([
    [
      "invalid-domain-economic-field",
      "CONCEPTUAL_NODE_ECONOMIC_FIELD",
      "nodes[0].economic",
      'Domain "Medicine" (domain:medicine) cannot define economic field "economic".',
    ],
    [
      "invalid-category-economic-field",
      "CONCEPTUAL_NODE_ECONOMIC_FIELD",
      "nodes[1].economic",
      'Category "Construction" (category:construction) cannot define economic field "economic".',
    ],
    [
      "invalid-purchasable-domain",
      "CONCEPTUAL_NODE_PURCHASABLE",
      "nodes[0].purchasable",
      'Domain "Medicine"',
    ],
    [
      "invalid-purchasable-category",
      "CONCEPTUAL_NODE_PURCHASABLE",
      "nodes[1].purchasable",
      'Category "Construction"',
    ],
    [
      "invalid-conceptual-node-hidden-mechanics",
      "CONCEPTUAL_NODE_ECONOMIC_FIELD",
      "nodes[0].cost",
      'cannot define economic field "cost"',
    ],
    [
      "invalid-conceptual-node-hidden-mechanics",
      "CONCEPTUAL_NODE_MECHANICAL_FIELD",
      "nodes[0].mechanicalEffects",
      'cannot define mechanical field "mechanicalEffects"',
    ],
    [
      "invalid-taxonomy-economic-group",
      "LEARNING_HISTORY_TAXONOMY_BUCKET",
      "learningHistories[0].basis",
      "taxonomy bucket",
    ],
    [
      "invalid-taxonomy-economic-group",
      "UNRESOLVED_GROUP_ECONOMICS_ASSUMPTION",
      "learningHistories[0]",
      "cannot decide unresolved group economics",
    ],
    [
      "invalid-category-history-identity",
      "LEARNING_HISTORY_IDENTITY_KIND_INVALID",
      "learningHistories[0].identity.kind",
      "categories and taxonomy labels cannot masquerade",
    ],
    [
      "invalid-nested-specialization-parent",
      "SPECIALIZATION_PARENT_NOT_CONCRETE_SKILL",
      "nodes[6].parentSkillId",
      "must have a concrete skill parent",
    ],
    [
      "invalid-surgery-only-specialization",
      "SURGERY_ONLY_NESTED_SPECIALIZATION",
      "nodes",
      "distinct concrete skill",
    ],
    [
      "invalid-closed-language-list",
      "LANGUAGE_CLOSED_VOCABULARY",
      "languagePolicy",
      "closed built-in list",
    ],
    [
      "invalid-closed-language-list",
      "UNIVERSAL_LITERACY_AUTHORITY",
      "languagePolicy.universalLiteracySkill",
      "universal generic Literacy skill",
    ],
    [
      "invalid-relationship-recursion-stacking",
      "RELATIONSHIP_POLICY_AMBIGUOUS",
      "relationshipPolicy.recursion",
      "non-recursive",
    ],
    [
      "invalid-relationship-recursion-stacking",
      "RELATIONSHIP_POLICY_AMBIGUOUS",
      "relationshipPolicy.sourceSelection",
      "strongest-source-only",
    ],
    [
      "invalid-relationship-recursion-stacking",
      "RELATIONSHIP_POLICY_AMBIGUOUS",
      "relationshipPolicy.stacking",
      "non-stacking",
    ],
    [
      "invalid-mechanical-category",
      "CATEGORY_MEMBERSHIP_MECHANICALLY_ACTIVE",
      "nodes[1].categoryMembershipIsMechanical",
      "mechanically inactive",
    ],
    [
      "invalid-mechanical-category",
      "CATEGORY_MECHANICALLY_ACTIVE",
      "nodes[1].mechanicalEffects",
      "cannot define mechanical effects",
    ],
    [
      "invalid-derived-relationship-source",
      "RELATIONSHIP_DERIVED_VALUE_AS_SOURCE",
      "relationships[0].sourceValue",
      "cannot source another relationship",
    ],
    [
      "invalid-relationship-factor",
      "RELATIONSHIP_FACTOR_UNRESOLVED",
      "relationships[0].factor",
      'cannot define unresolved numeric/effect factor field "factor"',
    ],
    [
      "invalid-campaign-authored-language-ids-disabled",
      "CAMPAIGN_AUTHORED_LANGUAGE_IDS_DISABLED",
      "languagePolicy.allowCampaignAuthoredStableIds",
      "must allow campaign-authored stable IDs",
    ],
    [
      "invalid-axis-conflation",
      "INVALID_DEVELOPMENT_STAGE",
      "civilizationProfiles[0].developmentStage",
      "must be DS1-DS6",
    ],
    [
      "invalid-axis-conflation",
      "INVALID_ACCESS_BAND",
      "civilizationProfiles[0].accessRoutes[0].accessBand",
      "must be AB1-AB4",
    ],
    [
      "invalid-axis-conflation",
      "ACCESS_AXIS_NAMING_CONFLATION",
      "civilizationProfiles[0].societyLevel",
      "use developmentStage plus accessRoutes[].accessBand",
    ],
  ])("reports %s with %s", (fixtureId, code, path, messagePart) => {
    expect(diagnosticsByFixture.get(fixtureId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code,
          fixtureId,
          message: expect.stringContaining(messagePart),
          path,
        }),
      ]),
    );
  });

  it("reports exact diagnostics for economic-only conceptual nodes", () => {
    expect(diagnosticsByFixture.get("invalid-domain-economic-field")).toEqual([
      {
        code: "CONCEPTUAL_NODE_ECONOMIC_FIELD",
        fixtureId: "invalid-domain-economic-field",
        message: 'Domain "Medicine" (domain:medicine) cannot define economic field "economic".',
        path: "nodes[0].economic",
      },
    ]);
    expect(diagnosticsByFixture.get("invalid-category-economic-field")).toEqual([
      {
        code: "CONCEPTUAL_NODE_ECONOMIC_FIELD",
        fixtureId: "invalid-category-economic-field",
        message:
          'Category "Construction" (category:construction) cannot define economic field "economic".',
        path: "nodes[1].economic",
      },
    ]);
  });

  it("returns diagnostics in deterministic order", () => {
    const first = validateSkillSemanticFixtures(antiOptimizationSkillSemanticFixtures);
    const second = validateSkillSemanticFixtures(
      [...antiOptimizationSkillSemanticFixtures].reverse(),
    );

    expect(second.diagnostics).toEqual(first.diagnostics);
  });
});
