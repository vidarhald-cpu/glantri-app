import type { SkillCatalogueAuthoringDocument } from "@glantri/domain";

import { representativeSkillCatalogueAuthoringDocument } from "./fixtures";

type Mutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

function invalidDocument(
  id: string,
  mutate: (document: Mutable<SkillCatalogueAuthoringDocument>) => void,
): SkillCatalogueAuthoringDocument {
  const document = structuredClone(
    representativeSkillCatalogueAuthoringDocument,
  ) as unknown as Mutable<SkillCatalogueAuthoringDocument>;
  document.id = id;
  mutate(document);
  return document;
}

export const invalidSkillCatalogueAuthoringDocuments = [
  invalidDocument("catalogue:invalid:duplicate-stable-id", (document) => {
    document.learningGroups.push(structuredClone(document.learningGroups[0]!));
  }),
  invalidDocument("catalogue:invalid:active-domain", (document) => {
    const domain = document.domains[0] as unknown as {
      mechanicalEffects: string[];
      purchasable: boolean;
      xpBearing: boolean;
    };
    domain.purchasable = true;
    domain.xpBearing = true;
    domain.mechanicalEffects = ["pricing"];
  }),
  invalidDocument("catalogue:invalid:missing-relationship-target", (document) => {
    document.relationships[0]!.targetCompetencyId = "skill:missing:first-aid";
  }),
  invalidDocument("catalogue:invalid:partial-inclusion", (document) => {
    const inclusion = document.relationships[0] as unknown as {
      includedCorePercent: number;
    };
    inclusion.includedCorePercent = 75;
  }),
  invalidDocument("catalogue:invalid:specialization-prerequisite", (document) => {
    document.relationships[3]!.sourceCompetencyId = "language:proposal:old-serevan";
    document.specializations[0]!.transferEdgeIds = [];
  }),
  invalidDocument("catalogue:invalid:written-tradition-binding", (document) => {
    document.writtenTraditions[0]!.spokenLanguageId = "language:missing:old-serevan";
    document.writtenTraditions[0]!.scriptId = "script:missing:temple-hand";
  }),
  invalidDocument("catalogue:invalid:learning-group", (document) => {
    document.learningGroups[0]!.context.description = "";
    document.learningGroups[0]!.fixedCompetencyIds[0] = "skill:missing:medicine";
  }),
  invalidDocument("catalogue:invalid:applicability", (document) => {
    const profile = document.applicabilityProfiles[0]!;
    (profile as unknown as { developmentStage: string }).developmentStage = "AB2";
    (profile.accessBandDefaults[0] as unknown as { accessBand: string }).accessBand = "DS2";
    profile.defaults[0]!.competencyId = "skill:missing:physic";
    profile.overrides[0]!.attributionId = "";
  }),
  invalidDocument("catalogue:invalid:applicability-basis", (document) => {
    (document.applicabilityProfiles[0]!.overrides[0] as unknown as { basis: string }).basis =
      "rumor";
  }),
  invalidDocument("catalogue:invalid:domain-applicability", (document) => {
    document.applicabilityProfiles[0]!.domainOverrides.push({
      accessBand: "DS2" as "AB1",
      attributionId: "profile-trait:invalid:wrong-domain-kind",
      availability: "restricted",
      basis: "profile",
      domainId: "skill:proposal:first-aid",
      explanation: "This invalid probe targets a competency instead of a domain.",
    });
  }),
  invalidDocument("catalogue:invalid:undifferentiated-proposal", (document) => {
    delete (document.skills[0] as unknown as { metadata?: unknown }).metadata;
  }),
  invalidDocument("catalogue:invalid:live-pricing", (document) => {
    const weight = document.skills[2]!.economicWeight as unknown as {
      price: number;
      pricingAuthority: string;
    };
    weight.pricingAuthority = "runtime";
    weight.price = 1;
  }),
  invalidDocument("catalogue:invalid:inferred-mechanics", (document) => {
    (document.policies as unknown as { reverseRelationships: string }).reverseRelationships =
      "inferred";
    (document.families[0] as unknown as { membershipMeaning: string }).membershipMeaning =
      "automatic-transfer";
    (document.relationships[1] as unknown as { reverseEdge: string }).reverseEdge = "inferred";
  }),
  invalidDocument("catalogue:invalid:related-arithmetic", (document) => {
    (document.relationships[1] as unknown as { factor: number }).factor = 0.5;
  }),
  invalidDocument("catalogue:invalid:collection-kind-mismatch", (document) => {
    (document.skills[4] as unknown as { kind: string }).kind = "domain";
  }),
  invalidDocument("catalogue:invalid:specialization-transfer-unrelated", (document) => {
    document.relationships[4]!.sourceCompetencyId = "language:proposal:old-serevan";
  }),
] as const;
