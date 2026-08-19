import type { SkillSemanticFixture } from "@glantri/domain";

import { representativeSkillSemanticFixtures } from "./fixtures";

const medicineFixture: SkillSemanticFixture = representativeSkillSemanticFixtures.find(
  (fixture) => fixture.id === "medicine",
)!;
const languageFixture: SkillSemanticFixture = representativeSkillSemanticFixtures.find(
  (fixture) => fixture.id === "language-literacy",
)!;
const navigationFixture: SkillSemanticFixture = representativeSkillSemanticFixtures.find(
  (fixture) => fixture.id === "navigation",
)!;
const engineeringFixture: SkillSemanticFixture = representativeSkillSemanticFixtures.find(
  (fixture) => fixture.id === "engineering-construction",
)!;

function asInvalidFixture(value: unknown): SkillSemanticFixture {
  return value as SkillSemanticFixture;
}

/** Deliberately malformed design evidence used only to prove anti-optimization diagnostics. */
export const antiOptimizationSkillSemanticFixtures = [
  asInvalidFixture({
    ...medicineFixture,
    id: "invalid-purchasable-domain",
    title: "Invalid: purchasable arch-skill",
    nodes: medicineFixture.nodes.map((node) =>
      node.kind === "domain" ? { ...node, purchasable: true, xpBearing: true } : node,
    ),
  }),
  asInvalidFixture({
    ...engineeringFixture,
    id: "invalid-purchasable-category",
    title: "Invalid: purchasable category",
    nodes: engineeringFixture.nodes.map((node) =>
      node.kind === "category" ? { ...node, purchasable: true, xpBearing: true } : node,
    ),
  }),
  asInvalidFixture({
    ...navigationFixture,
    id: "invalid-taxonomy-economic-group",
    title: "Invalid: taxonomy group treated as economic history",
    learningHistories: navigationFixture.learningHistories.map((history) => ({
      ...history,
      basis: "taxonomy",
      economicallyActive: true,
      identity: {
        kind: "category",
        name: "Navigation",
        sharedContext: "These competencies share a subject theme.",
      },
    })),
  }),
  asInvalidFixture({
    ...medicineFixture,
    id: "invalid-nested-specialization-parent",
    title: "Invalid: specialization parent is another specialization",
    nodes: medicineFixture.nodes.map((node) =>
      node.id === "specialization:surgery:vascular"
        ? { ...node, parentSkillId: "specialization:surgery:battlefield" }
        : node,
    ),
  }),
  asInvalidFixture({
    ...medicineFixture,
    id: "invalid-surgery-only-specialization",
    title: "Invalid: Surgery exists only as a nested specialization",
    nodes: medicineFixture.nodes.map((node) =>
      node.id === "skill:surgery"
        ? {
            ...node,
            categoryIds: undefined,
            kind: "specialization",
            parentSkillId: "skill:medicine",
          }
        : node,
    ),
  }),
  asInvalidFixture({
    ...languageFixture,
    id: "invalid-closed-language-list",
    title: "Invalid: closed built-in language list",
    languagePolicy: {
      ...languageFixture.languagePolicy,
      allowedEntityIds: languageFixture.languageEntities.map((entity) => entity.id),
      closedVocabulary: true,
      universalLiteracySkill: true,
    },
  }),
  asInvalidFixture({
    ...navigationFixture,
    id: "invalid-relationship-recursion-stacking",
    title: "Invalid: recursive and stacking relationship policy",
    relationshipPolicy: {
      ...navigationFixture.relationshipPolicy,
      recursion: "recursive",
      sourceSelection: "all-sources",
      stacking: "stacking",
    },
  }),
  asInvalidFixture({
    ...engineeringFixture,
    id: "invalid-mechanical-category",
    title: "Invalid: mechanically active category membership",
    nodes: engineeringFixture.nodes.map((node) =>
      node.kind === "category"
        ? {
            ...node,
            categoryMembershipIsMechanical: true,
            mechanicalEffects: ["transfer", "eligibility"],
          }
        : node,
    ),
  }),
  asInvalidFixture({
    ...navigationFixture,
    id: "invalid-derived-relationship-source",
    title: "Invalid: relationship-derived value used recursively as a source",
    relationships: navigationFixture.relationships.map((relationship) => ({
      ...relationship,
      sourceValue: "derived",
    })),
  }),
  asInvalidFixture({
    ...navigationFixture,
    id: "invalid-axis-conflation",
    title: "Invalid: development and access axes interchanged",
    civilizationProfiles: navigationFixture.civilizationProfiles.map((profile) => ({
      ...profile,
      accessRoutes: profile.accessRoutes.map((route) => ({
        ...route,
        accessBand: "DS2",
      })),
      developmentStage: "AB2",
      societyLevel: 2,
    })),
  }),
] as const;
