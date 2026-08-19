import {
  ACCESS_BANDS,
  DEVELOPMENT_STAGES,
  LEARNING_HISTORY_KINDS,
  type AccessBand,
  type DevelopmentStage,
  type SkillSemanticFixture,
  type SkillSemanticNode,
} from "@glantri/domain";

export const SKILL_SEMANTIC_POLICY_GAPS = [
  {
    code: "GROUP_ECONOMICS_UNRESOLVED",
    detail:
      "Learning-group economics, overlap behavior, repeated-rank behavior, and lifecycle remain unresolved.",
  },
  {
    code: "RELATIONSHIP_FACTORS_UNRESOLVED",
    detail: "Exact transfer, familiarity, learning, and reinforcement factors remain unresolved.",
  },
  {
    code: "SPECIALIZATION_CAPS_UNRESOLVED",
    detail: "Specialization thresholds, caps, and bounded reverse reinforcement remain unresolved.",
  },
  {
    code: "LONGBOW_CLASSIFICATION_PROVISIONAL",
    detail:
      "Longbow is represented as a provisional concrete skill; its final classification remains open.",
  },
  {
    code: "AUTHORED_CONTENT_AUTHORITY_UNRESOLVED",
    detail:
      "The authoritative authored-content format, ownership, and versioning pipeline remain unresolved.",
  },
] as const;

export type SkillSemanticPolicyGap = (typeof SKILL_SEMANTIC_POLICY_GAPS)[number];

export interface SkillSemanticDiagnostic {
  code: string;
  fixtureId: string;
  message: string;
  path: string;
}

export interface SkillSemanticFixtureValidation {
  diagnostics: readonly SkillSemanticDiagnostic[];
  fixtureId: string;
  title: string;
  valid: boolean;
}

export interface SkillSemanticValidationResult {
  diagnostics: readonly SkillSemanticDiagnostic[];
  fixtures: readonly SkillSemanticFixtureValidation[];
  policyGaps: readonly SkillSemanticPolicyGap[];
  valid: boolean;
}

const DEVELOPMENT_STAGE_SET = new Set<string>(DEVELOPMENT_STAGES);
const ACCESS_BAND_SET = new Set<string>(ACCESS_BANDS);
const LEARNING_HISTORY_KIND_SET = new Set<string>(LEARNING_HISTORY_KINDS);
const CONCEPTUAL_NODE_ECONOMIC_FIELDS = [
  "cost",
  "economicClass",
  "economicallyActive",
  "price",
  "xpCost",
] as const;
const CONCEPTUAL_NODE_MECHANICAL_FIELDS = [
  "derivedGrants",
  "eligibility",
  "eligibilityRules",
  "mechanicallyActive",
  "mechanicalEffects",
  "transfer",
  "transferFactor",
] as const;
const RELATIONSHIP_FACTOR_FIELDS = [
  "effectFactor",
  "factor",
  "familiarityFactor",
  "learningFactor",
  "reinforcementFactor",
  "reverseFactor",
  "transferFactor",
] as const;

function isDevelopmentStage(value: unknown): value is DevelopmentStage {
  return typeof value === "string" && DEVELOPMENT_STAGE_SET.has(value);
}

function isAccessBand(value: unknown): value is AccessBand {
  return typeof value === "string" && ACCESS_BAND_SET.has(value);
}

function compareDiagnostics(left: SkillSemanticDiagnostic, right: SkillSemanticDiagnostic): number {
  return (
    left.fixtureId.localeCompare(right.fixtureId) ||
    left.code.localeCompare(right.code) ||
    left.path.localeCompare(right.path) ||
    left.message.localeCompare(right.message)
  );
}

function validateFixture(fixture: SkillSemanticFixture): SkillSemanticDiagnostic[] {
  const diagnostics: SkillSemanticDiagnostic[] = [];
  const looseFixture = fixture as unknown as Record<string, unknown>;
  const add = (code: string, path: string, message: string) => {
    diagnostics.push({ code, fixtureId: fixture.id, message, path });
  };
  const nodeById = new Map<string, SkillSemanticNode>();

  fixture.nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    const existing = nodeById.get(node.id);
    const looseNode = node as unknown as Record<string, unknown>;

    if (existing) {
      add("DUPLICATE_NODE_ID", `${path}.id`, `Node id "${node.id}" is duplicated.`);
    } else {
      nodeById.set(node.id, node);
    }

    if (node.kind === "domain" || node.kind === "category") {
      if ((node as { purchasable?: unknown }).purchasable !== false) {
        add(
          "CONCEPTUAL_NODE_PURCHASABLE",
          `${path}.purchasable`,
          `${node.kind === "domain" ? "Domain" : "Category"} "${node.name}" (${node.id}) must be non-purchasable.`,
        );
      }

      if ((node as { xpBearing?: unknown }).xpBearing !== false) {
        add(
          "CONCEPTUAL_NODE_XP_BEARING",
          `${path}.xpBearing`,
          `${node.kind === "domain" ? "Domain" : "Category"} "${node.name}" (${node.id}) cannot carry XP.`,
        );
      }

      for (const field of CONCEPTUAL_NODE_ECONOMIC_FIELDS) {
        if (looseNode[field] !== undefined) {
          add(
            "CONCEPTUAL_NODE_ECONOMIC_FIELD",
            `${path}.${field}`,
            `${node.kind === "domain" ? "Domain" : "Category"} "${node.name}" (${node.id}) cannot define economic field "${field}".`,
          );
        }
      }

      for (const field of CONCEPTUAL_NODE_MECHANICAL_FIELDS) {
        if (looseNode[field] !== undefined) {
          add(
            "CONCEPTUAL_NODE_MECHANICAL_FIELD",
            `${path}.${field}`,
            `${node.kind === "domain" ? "Domain" : "Category"} "${node.name}" (${node.id}) cannot define mechanical field "${field}".`,
          );
        }
      }
    }

    if (node.kind === "category") {
      if (
        (node as { categoryMembershipIsMechanical?: unknown }).categoryMembershipIsMechanical !==
        false
      ) {
        add(
          "CATEGORY_MEMBERSHIP_MECHANICALLY_ACTIVE",
          `${path}.categoryMembershipIsMechanical`,
          `Category "${node.name}" (${node.id}) membership must remain editorial and mechanically inactive.`,
        );
      }

      if (looseNode.mechanicalEffects !== undefined) {
        add(
          "CATEGORY_MECHANICALLY_ACTIVE",
          `${path}.mechanicalEffects`,
          `Category "${node.name}" (${node.id}) cannot define mechanical effects.`,
        );
      }
    }

    if (node.kind === "skill" || node.kind === "specialization") {
      if (looseNode.purchasable !== true || looseNode.xpBearing !== true) {
        add(
          "CONCRETE_COMPETENCY_NOT_XP_BEARING",
          path,
          `Concrete ${node.kind} "${node.name}" (${node.id}) must be purchasable and XP-bearing.`,
        );
      }
    }
  });

  for (const [index, node] of fixture.nodes.entries()) {
    const path = `nodes[${index}]`;

    if (node.kind === "category" || node.kind === "skill" || node.kind === "specialization") {
      if (nodeById.get(node.domainId)?.kind !== "domain") {
        add(
          "INVALID_DOMAIN_REFERENCE",
          `${path}.domainId`,
          `Node "${node.name}" (${node.id}) must reference a domain node; received "${node.domainId}".`,
        );
      }
    }

    if (node.kind === "skill") {
      for (const categoryId of node.categoryIds) {
        if (nodeById.get(categoryId)?.kind !== "category") {
          add(
            "INVALID_CATEGORY_REFERENCE",
            `${path}.categoryIds`,
            `Skill "${node.name}" (${node.id}) references non-category "${categoryId}".`,
          );
        }
      }
    }

    if (node.kind === "specialization" && nodeById.get(node.parentSkillId)?.kind !== "skill") {
      add(
        "SPECIALIZATION_PARENT_NOT_CONCRETE_SKILL",
        `${path}.parentSkillId`,
        `Specialization "${node.name}" (${node.id}) must have a concrete skill parent; received "${node.parentSkillId}".`,
      );
    }
  }

  const surgeryNodes = fixture.nodes.filter((node) => node.name.trim().toLowerCase() === "surgery");

  if (surgeryNodes.length > 0 && surgeryNodes.every((node) => node.kind === "specialization")) {
    add(
      "SURGERY_ONLY_NESTED_SPECIALIZATION",
      "nodes",
      "Surgery must be represented as a distinct concrete skill, not only as a nested specialization.",
    );
  }

  fixture.learningHistories.forEach((history, index) => {
    const path = `learningHistories[${index}]`;
    const looseHistory = history as unknown as Record<string, unknown>;

    if (history.basis !== "shared-training-history") {
      add(
        "LEARNING_HISTORY_TAXONOMY_BUCKET",
        `${path}.basis`,
        `Learning history "${history.id}" is a taxonomy bucket; it must identify one narratable shared-training history.`,
      );
    }

    if (
      !history.identity?.name?.trim() ||
      !history.identity?.sharedContext?.trim() ||
      !history.identity?.kind
    ) {
      add(
        "LEARNING_HISTORY_IDENTITY_MISSING",
        `${path}.identity`,
        `Learning history "${history.id}" must name a narratable institution, crew, unit, household, campaign, office, workshop, or apprenticeship.`,
      );
    }

    if (!LEARNING_HISTORY_KIND_SET.has(String(history.identity?.kind))) {
      add(
        "LEARNING_HISTORY_IDENTITY_KIND_INVALID",
        `${path}.identity.kind`,
        `Learning history "${history.id}" identity kind "${String(history.identity?.kind)}" is not narratable shared-training history; categories and taxonomy labels cannot masquerade as learning histories.`,
      );
    }

    if (looseHistory.economicallyActive !== undefined || looseHistory.cost !== undefined) {
      add(
        "UNRESOLVED_GROUP_ECONOMICS_ASSUMPTION",
        path,
        `Learning history "${history.id}" cannot decide unresolved group economics in this fixture slice.`,
      );
    }

    for (const competencyId of history.competencyIds) {
      const competency = nodeById.get(competencyId);

      if (competency?.kind !== "skill" && competency?.kind !== "specialization") {
        add(
          "LEARNING_HISTORY_NON_CONCRETE_MEMBER",
          `${path}.competencyIds`,
          `Learning history "${history.id}" references non-concrete competency "${competencyId}".`,
        );
      }
    }
  });

  const policy = fixture.relationshipPolicy as unknown as Record<string, unknown>;
  const requiredRelationshipPolicy = {
    availability: "availability-first",
    recursion: "non-recursive",
    sourceSelection: "strongest-source-only",
    sourceValues: "authored-only",
    stacking: "non-stacking",
  } as const;

  for (const [key, expected] of Object.entries(requiredRelationshipPolicy)) {
    if (policy[key] !== expected) {
      add(
        "RELATIONSHIP_POLICY_AMBIGUOUS",
        `relationshipPolicy.${key}`,
        `Relationship policy "${key}" must be "${expected}"; received "${String(policy[key])}".`,
      );
    }
  }

  fixture.relationships.forEach((relationship, index) => {
    const path = `relationships[${index}]`;
    const looseRelationship = relationship as unknown as Record<string, unknown>;
    const source = nodeById.get(relationship.sourceCompetencyId);
    const target = nodeById.get(relationship.targetCompetencyId);

    if (source?.kind !== "skill" && source?.kind !== "specialization") {
      add(
        "RELATIONSHIP_SOURCE_NOT_CONCRETE",
        `${path}.sourceCompetencyId`,
        `Relationship "${relationship.id}" source "${relationship.sourceCompetencyId}" must be a concrete competency.`,
      );
    }

    if (target?.kind !== "skill" && target?.kind !== "specialization") {
      add(
        "RELATIONSHIP_TARGET_NOT_CONCRETE",
        `${path}.targetCompetencyId`,
        `Relationship "${relationship.id}" target "${relationship.targetCompetencyId}" must be a concrete competency.`,
      );
    }

    if ((relationship as { sourceValue?: unknown }).sourceValue !== "authored") {
      add(
        "RELATIONSHIP_DERIVED_VALUE_AS_SOURCE",
        `${path}.sourceValue`,
        `Relationship "${relationship.id}" must use an authored source value; relationship-derived values cannot source another relationship.`,
      );
    }

    for (const field of RELATIONSHIP_FACTOR_FIELDS) {
      if (looseRelationship[field] !== undefined) {
        add(
          "RELATIONSHIP_FACTOR_UNRESOLVED",
          `${path}.${field}`,
          `Relationship "${relationship.id}" cannot define unresolved numeric/effect factor field "${field}" in this fixture slice.`,
        );
      }
    }
  });

  const looseLanguagePolicy = fixture.languagePolicy as unknown as Record<string, unknown>;

  if (looseLanguagePolicy.allowCampaignAuthoredStableIds !== true) {
    add(
      "CAMPAIGN_AUTHORED_LANGUAGE_IDS_DISABLED",
      "languagePolicy.allowCampaignAuthoredStableIds",
      "Language/script policy must allow campaign-authored stable IDs.",
    );
  }

  if (
    looseLanguagePolicy.closedVocabulary !== false ||
    looseLanguagePolicy.allowedEntityIds !== undefined
  ) {
    add(
      "LANGUAGE_CLOSED_VOCABULARY",
      "languagePolicy",
      "Language/script identities must remain campaign-authorable and cannot be restricted to a closed built-in list.",
    );
  }

  if (looseLanguagePolicy.universalLiteracySkill !== false) {
    add(
      "UNIVERSAL_LITERACY_AUTHORITY",
      "languagePolicy.universalLiteracySkill",
      "A universal generic Literacy skill cannot be the authority for campaign-authored language/script competence.",
    );
  }

  const languageEntityById = new Map<string, (typeof fixture.languageEntities)[number]>();

  fixture.languageEntities.forEach((entity, index) => {
    if (languageEntityById.has(entity.id)) {
      add(
        "DUPLICATE_LANGUAGE_ENTITY_ID",
        `languageEntities[${index}].id`,
        `Language/script entity id "${entity.id}" is duplicated.`,
      );
    } else {
      languageEntityById.set(entity.id, entity);
    }

    if (
      !entity.id.trim() ||
      entity.authoredBy?.kind !== "campaign" ||
      !entity.authoredBy.campaignId.trim()
    ) {
      add(
        "LANGUAGE_ENTITY_NOT_CAMPAIGN_AUTHORED",
        `languageEntities[${index}]`,
        `Language/script entity "${entity.id}" must have a stable id and attributable campaign author.`,
      );
    }
  });

  fixture.languageCompetencies.forEach((competency, index) => {
    const path = `languageCompetencies[${index}]`;
    const node = nodeById.get(competency.competencyId);
    const entity = languageEntityById.get(competency.entityId);

    if (node?.kind !== "skill") {
      add(
        "LANGUAGE_COMPETENCY_NOT_CONCRETE_SKILL",
        `${path}.competencyId`,
        `Language competency "${competency.competencyId}" must reference a concrete skill.`,
      );
    }

    if (
      !entity ||
      (competency.mode === "spoken" && entity.kind !== "spoken-language") ||
      (competency.mode === "written" && entity.kind !== "script")
    ) {
      add(
        "LANGUAGE_MODE_ENTITY_MISMATCH",
        `${path}.entityId`,
        `${competency.mode === "spoken" ? "Spoken" : "Written"} competency "${competency.competencyId}" must reference a ${competency.mode === "spoken" ? "spoken-language" : "script"} entity.`,
      );
    }

    if (
      competency.mode === "written" &&
      (!competency.facets?.includes("reading") || !competency.facets.includes("writing"))
    ) {
      add(
        "WRITTEN_COMPETENCY_FACETS_MISSING",
        `${path}.facets`,
        `Written competency "${competency.competencyId}" must initially represent reading and writing as facets.`,
      );
    }
  });

  fixture.civilizationProfiles.forEach((profile, profileIndex) => {
    const path = `civilizationProfiles[${profileIndex}]`;
    const looseProfile = profile as unknown as Record<string, unknown>;

    if (!isDevelopmentStage(profile.developmentStage)) {
      add(
        "INVALID_DEVELOPMENT_STAGE",
        `${path}.developmentStage`,
        `Civilization profile "${profile.id}" developmentStage must be DS1-DS6; received "${String(profile.developmentStage)}".`,
      );
    }

    for (const overloadedName of ["accessBand", "societyLevel", "socialBand"]) {
      if (looseProfile[overloadedName] !== undefined) {
        add(
          "ACCESS_AXIS_NAMING_CONFLATION",
          `${path}.${overloadedName}`,
          `Civilization profile "${profile.id}" uses conflated axis field "${overloadedName}"; use developmentStage plus accessRoutes[].accessBand.`,
        );
      }
    }

    const referencedCompetencyIds = [
      ...profile.defaultAvailableCompetencyIds,
      ...profile.accessRoutes.flatMap((route) => route.competencyIds),
      ...profile.availabilityExceptions.map((exception) => exception.competencyId),
    ];

    for (const competencyId of referencedCompetencyIds) {
      const competency = nodeById.get(competencyId);

      if (competency?.kind !== "skill" && competency?.kind !== "specialization") {
        add(
          "PROFILE_UNKNOWN_COMPETENCY",
          path,
          `Civilization profile "${profile.id}" references unknown or non-concrete competency "${competencyId}".`,
        );
      }
    }

    profile.accessRoutes.forEach((route, routeIndex) => {
      if (!isAccessBand(route.accessBand)) {
        add(
          "INVALID_ACCESS_BAND",
          `${path}.accessRoutes[${routeIndex}].accessBand`,
          `Access route for civilization profile "${profile.id}" must be AB1-AB4; received "${String(route.accessBand)}".`,
        );
      }
    });

    profile.availabilityExceptions.forEach((exception, exceptionIndex) => {
      if (!exception.attribution.trim()) {
        add(
          "AVAILABILITY_EXCEPTION_UNATTRIBUTED",
          `${path}.availabilityExceptions[${exceptionIndex}].attribution`,
          `Availability exception for "${exception.competencyId}" must be explicit and attributable.`,
        );
      }
    });
  });

  if (looseFixture.runtimeContent !== undefined || looseFixture.runtimeBehavior !== undefined) {
    add(
      "LIVE_RUNTIME_CONTENT_FORBIDDEN",
      "runtimeContent",
      "Semantic fixtures cannot contain or switch live runtime content or behavior.",
    );
  }

  return diagnostics.sort(compareDiagnostics);
}

export function validateSkillSemanticFixtures(
  fixtures: readonly SkillSemanticFixture[],
): SkillSemanticValidationResult {
  const fixtureIds = new Set<string>();
  const fixtureResults = [...fixtures]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((fixture) => {
      const diagnostics = validateFixture(fixture);

      if (fixtureIds.has(fixture.id)) {
        diagnostics.push({
          code: "DUPLICATE_FIXTURE_ID",
          fixtureId: fixture.id,
          message: `Fixture id "${fixture.id}" is duplicated.`,
          path: "id",
        });
      }

      fixtureIds.add(fixture.id);
      diagnostics.sort(compareDiagnostics);

      return {
        diagnostics,
        fixtureId: fixture.id,
        title: fixture.title,
        valid: diagnostics.length === 0,
      };
    });
  const diagnostics = fixtureResults
    .flatMap((fixture) => fixture.diagnostics)
    .sort(compareDiagnostics);

  return {
    diagnostics,
    fixtures: fixtureResults,
    policyGaps: SKILL_SEMANTIC_POLICY_GAPS,
    valid: diagnostics.length === 0,
  };
}
