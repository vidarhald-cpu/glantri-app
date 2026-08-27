import {
  ACCESS_BANDS,
  DEVELOPMENT_STAGES,
  PROVISIONAL_SKILL_SCOPE_CLASSES,
  SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION,
  SKILL_CATALOGUE_AUTHORING_STATUSES,
  SKILL_LEARNING_CONTEXT_KINDS,
  type SkillCatalogueAuthoringDocument,
  type SkillCatalogueCompetencyAuthoringRecord,
  type SkillCatalogueRecordMetadata,
} from "@glantri/domain";

export interface SkillCatalogueAuthoringDiagnostic {
  code: string;
  documentId: string;
  message: string;
  path: string;
}

export interface SkillCatalogueAuthoringValidationResult {
  diagnostics: readonly SkillCatalogueAuthoringDiagnostic[];
  documentId: string;
  valid: boolean;
}

type AuthoredRecord =
  | SkillCatalogueAuthoringDocument["applicabilityProfiles"][number]
  | SkillCatalogueAuthoringDocument["categories"][number]
  | SkillCatalogueAuthoringDocument["domains"][number]
  | SkillCatalogueAuthoringDocument["families"][number]
  | SkillCatalogueAuthoringDocument["learningGroups"][number]
  | SkillCatalogueAuthoringDocument["relationships"][number]
  | SkillCatalogueAuthoringDocument["scripts"][number]
  | SkillCatalogueAuthoringDocument["skills"][number]
  | SkillCatalogueAuthoringDocument["specializations"][number]
  | SkillCatalogueAuthoringDocument["spokenLanguages"][number]
  | SkillCatalogueAuthoringDocument["writtenTraditions"][number];

interface RecordEntry<T extends AuthoredRecord = AuthoredRecord> {
  path: string;
  record: T;
}

interface CollectionRecordEntry<T extends AuthoredRecord = AuthoredRecord> extends RecordEntry<T> {
  expectedKinds: readonly string[];
}

const STABLE_AUTHORING_ID_PATTERN = /^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/;
const STATUS_SET = new Set<string>(SKILL_CATALOGUE_AUTHORING_STATUSES);
const STAGE_SET = new Set<string>(DEVELOPMENT_STAGES);
const ACCESS_BAND_SET = new Set<string>(ACCESS_BANDS);
const SCOPE_SET = new Set<string>(PROVISIONAL_SKILL_SCOPE_CLASSES);
const LEARNING_CONTEXT_SET = new Set<string>(SKILL_LEARNING_CONTEXT_KINDS);
const COMPETENCY_KINDS = new Set([
  "skill",
  "specialization",
  "spoken-language",
  "written-tradition",
]);
const RELATED_EFFECTS = new Set(["familiarity", "learning-advantage", "reinforcement", "transfer"]);
const APPLICABILITY_OVERRIDE_BASES = new Set([
  "biography",
  "contact",
  "institution",
  "profile",
  "teacher",
  "text",
  "tradition",
]);
const PROVENANCE_KIND_BY_STATUS = {
  canonical: "decision",
  evidence: "evidence",
  legacy: "legacy",
  proposal: "proposal",
} as const;
const FORBIDDEN_MECHANICAL_FIELDS = [
  "derivedGrants",
  "eligibility",
  "eligibilityRules",
  "mechanicalEffects",
  "transfer",
  "transferFactor",
] as const;
const FORBIDDEN_PRICE_FIELDS = ["baseCost", "cost", "price", "priceFactor", "xpCost"] as const;
const FORBIDDEN_RELATIONSHIP_ARITHMETIC_FIELDS = [
  "factor",
  "percentage",
  "ratio",
  "rounding",
  "strength",
  "transferFactor",
] as const;

function compareDiagnostics(
  left: SkillCatalogueAuthoringDiagnostic,
  right: SkillCatalogueAuthoringDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    left.path.localeCompare(right.path) ||
    left.message.localeCompare(right.message)
  );
}

function getRecordEntries(document: SkillCatalogueAuthoringDocument): CollectionRecordEntry[] {
  return [
    ...document.domains.map((record, index) => ({
      expectedKinds: ["domain"],
      path: `domains[${index}]`,
      record,
    })),
    ...document.categories.map((record, index) => ({
      expectedKinds: ["category"],
      path: `categories[${index}]`,
      record,
    })),
    ...document.skills.map((record, index) => ({
      expectedKinds: ["skill"],
      path: `skills[${index}]`,
      record,
    })),
    ...document.specializations.map((record, index) => ({
      expectedKinds: ["specialization"],
      path: `specializations[${index}]`,
      record,
    })),
    ...document.spokenLanguages.map((record, index) => ({
      expectedKinds: ["spoken-language"],
      path: `spokenLanguages[${index}]`,
      record,
    })),
    ...document.scripts.map((record, index) => ({
      expectedKinds: ["script"],
      path: `scripts[${index}]`,
      record,
    })),
    ...document.writtenTraditions.map((record, index) => ({
      expectedKinds: ["written-tradition"],
      path: `writtenTraditions[${index}]`,
      record,
    })),
    ...document.families.map((record, index) => ({
      expectedKinds: ["language-family", "script-family"],
      path: `families[${index}]`,
      record,
    })),
    ...document.learningGroups.map((record, index) => ({
      expectedKinds: ["learning-group"],
      path: `learningGroups[${index}]`,
      record,
    })),
    ...document.relationships.map((record, index) => ({
      expectedKinds: ["inclusion", "prerequisite", "related"],
      path: `relationships[${index}]`,
      record,
    })),
    ...document.applicabilityProfiles.map((record, index) => ({
      expectedKinds: ["applicability-profile"],
      path: `applicabilityProfiles[${index}]`,
      record,
    })),
  ];
}

function getCompetencyEntries(
  document: SkillCatalogueAuthoringDocument,
): RecordEntry<SkillCatalogueCompetencyAuthoringRecord>[] {
  return [
    ...document.skills.flatMap((record, index) =>
      record.kind === "skill" ? [{ path: `skills[${index}]`, record }] : [],
    ),
    ...document.specializations.flatMap((record, index) =>
      record.kind === "specialization" ? [{ path: `specializations[${index}]`, record }] : [],
    ),
    ...document.spokenLanguages.flatMap((record, index) =>
      record.kind === "spoken-language" ? [{ path: `spokenLanguages[${index}]`, record }] : [],
    ),
    ...document.writtenTraditions.flatMap((record, index) =>
      record.kind === "written-tradition" ? [{ path: `writtenTraditions[${index}]`, record }] : [],
    ),
  ];
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateSkillCatalogueAuthoringDocument(
  document: SkillCatalogueAuthoringDocument,
): SkillCatalogueAuthoringValidationResult {
  const diagnostics: SkillCatalogueAuthoringDiagnostic[] = [];
  const documentId = isNonBlank(document.id) ? document.id : "<unknown-document>";
  const add = (code: string, path: string, message: string) => {
    diagnostics.push({ code, documentId, message, path });
  };

  if (document.schemaVersion !== SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION) {
    add(
      "UNSUPPORTED_AUTHORING_SCHEMA_VERSION",
      "schemaVersion",
      `Skill Catalogue authoring schema must be "${SKILL_CATALOGUE_AUTHORING_SCHEMA_VERSION}"; received "${String(document.schemaVersion)}".`,
    );
  }

  if (!STABLE_AUTHORING_ID_PATTERN.test(document.id) || !isNonBlank(document.catalogueVersion)) {
    add(
      "INVALID_DOCUMENT_IDENTITY",
      "id",
      "Skill Catalogue authoring documents need a stable namespaced id and non-empty catalogueVersion.",
    );
  }

  if (document.runtimeIntegration !== "none") {
    add(
      "LIVE_RUNTIME_INTEGRATION_FORBIDDEN",
      "runtimeIntegration",
      "Skill Catalogue authoring documents must remain authoring-only and cannot activate runtime content.",
    );
  }

  const expectedPolicies = {
    categoryAndFamilyMechanics: "none",
    inclusionSemantics: "explicit-directed-100-percent",
    relationshipArithmetic: "unresolved-except-inclusion",
    relationshipInference: "explicit-edges-only",
    relationshipSourceCombination: "non-stacking",
    reverseRelationships: "not-inferred",
    runtimeEligibility: "not-implemented",
    runtimePricing: "not-implemented",
  } as const;
  const loosePolicies = document.policies as unknown as Record<string, unknown>;

  for (const [key, expected] of Object.entries(expectedPolicies)) {
    if (loosePolicies[key] !== expected) {
      add(
        "AUTHORING_POLICY_RUNTIME_OR_INFERENCE_LEAK",
        `policies.${key}`,
        `Authoring policy "${key}" must be "${expected}"; received "${String(loosePolicies[key])}".`,
      );
    }
  }

  const recordEntries = getRecordEntries(document);
  const recordById = new Map<string, AuthoredRecord>();

  for (const { expectedKinds, path, record } of recordEntries) {
    if (!expectedKinds.includes(record.kind)) {
      add(
        "COLLECTION_KIND_MISMATCH",
        `${path}.kind`,
        `Authoring collection entry "${path}" must declare ${expectedKinds.map((kind) => `kind "${kind}"`).join(" or ")}; received "${String(record.kind)}".`,
      );
    }

    if (!STABLE_AUTHORING_ID_PATTERN.test(record.id)) {
      add(
        "INVALID_STABLE_ID",
        `${path}.id`,
        `Authoring record id "${record.id}" must be a stable lowercase namespaced identity such as "skill:proposal:first-aid".`,
      );
    }

    if (recordById.has(record.id)) {
      add(
        "DUPLICATE_STABLE_ID",
        `${path}.id`,
        `Stable authoring identity "${record.id}" is duplicated.`,
      );
    } else {
      recordById.set(record.id, record);
    }

    if (!isNonBlank(record.name)) {
      add("MISSING_AUTHORING_NAME", `${path}.name`, `Record "${record.id}" needs a natural name.`);
    }

    const metadata = (record as { metadata?: SkillCatalogueRecordMetadata }).metadata;
    const looseMetadata = metadata as unknown as Record<string, unknown> | undefined;
    const looseProvenance = looseMetadata?.provenance as Record<string, unknown> | undefined;

    if (
      !metadata ||
      !STATUS_SET.has(String(looseMetadata?.status)) ||
      !isNonBlank(looseMetadata?.recordVersion) ||
      !isNonBlank(looseProvenance?.reference)
    ) {
      add(
        "AUTHORING_STATUS_OR_PROVENANCE_MISSING",
        `${path}.metadata`,
        `Record "${record.id}" must state recordVersion, canonical/proposal/evidence/legacy status, and attributable provenance.`,
      );
    } else {
      const expectedKind =
        PROVENANCE_KIND_BY_STATUS[metadata.status as keyof typeof PROVENANCE_KIND_BY_STATUS];

      if (metadata.provenance.kind !== expectedKind) {
        add(
          "AUTHORING_STATUS_PROVENANCE_MISMATCH",
          `${path}.metadata.provenance.kind`,
          `Record "${record.id}" status "${metadata.status}" requires "${expectedKind}" provenance, not "${metadata.provenance.kind}".`,
        );
      }
    }
  }

  const domains = document.domains.filter((record) => record.kind === "domain");
  const categories = document.categories.filter((record) => record.kind === "category");
  const scripts = document.scripts.filter((record) => record.kind === "script");
  const families = document.families.filter(
    (record) => record.kind === "language-family" || record.kind === "script-family",
  );
  const relationships = document.relationships.filter(
    (record) =>
      record.kind === "inclusion" || record.kind === "prerequisite" || record.kind === "related",
  );
  const spokenLanguages = document.spokenLanguages.filter(
    (record) => record.kind === "spoken-language",
  );
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const competencyEntries = getCompetencyEntries(document);
  const competencyById = new Map(competencyEntries.map(({ record }) => [record.id, record]));
  const relationshipById = new Map(relationships.map((edge) => [edge.id, edge]));
  const familyById = new Map(families.map((family) => [family.id, family]));
  const languageById = new Map(spokenLanguages.map((language) => [language.id, language]));
  const scriptById = new Map(scripts.map((script) => [script.id, script]));

  const validateNonMechanicalIdentity = (entry: RecordEntry) => {
    const { path, record } = entry;
    const looseRecord = record as unknown as Record<string, unknown>;

    if (
      looseRecord.purchasable !== false ||
      looseRecord.xpBearing !== false ||
      looseRecord.mechanics !== "none"
    ) {
      add(
        "NON_MECHANICAL_IDENTITY_MARKED_ACTIVE",
        path,
        `${record.kind} "${record.name}" (${record.id}) must be non-purchasable, non-XP-bearing, and mechanically inert.`,
      );
    }

    for (const field of [...FORBIDDEN_MECHANICAL_FIELDS, ...FORBIDDEN_PRICE_FIELDS]) {
      if (looseRecord[field] !== undefined) {
        add(
          "NON_MECHANICAL_IDENTITY_HAS_ACTIVE_FIELD",
          `${path}.${field}`,
          `${record.kind} "${record.name}" (${record.id}) cannot define active field "${field}".`,
        );
      }
    }
  };

  document.domains.forEach((record, index) => {
    if (record.kind !== "domain") return;
    validateNonMechanicalIdentity({ path: `domains[${index}]`, record });
  });
  document.categories.forEach((record, index) => {
    if (record.kind !== "category") return;
    const path = `categories[${index}]`;
    validateNonMechanicalIdentity({ path, record });

    if (record.membershipMeaning !== "navigation-only") {
      add(
        "CATEGORY_MEMBERSHIP_MECHANICALLY_ACTIVE",
        `${path}.membershipMeaning`,
        `Category "${record.name}" (${record.id}) membership must be navigation-only.`,
      );
    }

    for (const domainId of record.domainIds) {
      if (!domainById.has(domainId)) {
        add(
          "CATEGORY_UNKNOWN_DOMAIN",
          `${path}.domainIds`,
          `Category "${record.name}" (${record.id}) references unknown domain "${domainId}".`,
        );
      }
    }
  });
  document.scripts.forEach((record, index) => {
    if (record.kind !== "script") return;
    validateNonMechanicalIdentity({ path: `scripts[${index}]`, record });
  });
  document.families.forEach((record, index) => {
    if (record.kind !== "language-family" && record.kind !== "script-family") return;
    const path = `families[${index}]`;
    validateNonMechanicalIdentity({ path, record });

    if (record.membershipMeaning !== "authoring-only") {
      add(
        "FAMILY_MEMBERSHIP_MECHANICALLY_ACTIVE",
        `${path}.membershipMeaning`,
        `Family "${record.name}" (${record.id}) membership must remain authoring-only.`,
      );
    }

    for (const memberId of record.memberIds) {
      const member = recordById.get(memberId);
      const expectedKind = record.kind === "language-family" ? "spoken-language" : "script";

      if (member?.kind !== expectedKind) {
        add(
          "FAMILY_INVALID_MEMBER",
          `${path}.memberIds`,
          `${record.kind} "${record.name}" (${record.id}) references non-${expectedKind} member "${memberId}".`,
        );
      }
    }
  });

  for (const { path, record } of competencyEntries) {
    const looseRecord = record as unknown as Record<string, unknown>;
    const looseWeight = record.economicWeight as unknown as Record<string, unknown>;

    if (looseRecord.purchasable !== true || looseRecord.xpBearing !== true) {
      add(
        "CONCRETE_COMPETENCY_NOT_PURCHASABLE",
        path,
        `Concrete competency "${record.name}" (${record.id}) must be purchasable and XP-bearing in authoring semantics.`,
      );
    }

    if (!domainById.has(record.domainId)) {
      add(
        "COMPETENCY_UNKNOWN_DOMAIN",
        `${path}.domainId`,
        `Competency "${record.name}" (${record.id}) references unknown domain "${record.domainId}".`,
      );
    }

    for (const categoryId of record.categoryIds) {
      if (!categoryById.has(categoryId)) {
        add(
          "COMPETENCY_UNKNOWN_CATEGORY",
          `${path}.categoryIds`,
          `Competency "${record.name}" (${record.id}) references unknown category "${categoryId}".`,
        );
      }
    }

    if (
      !isNonBlank(record.description) ||
      !isNonBlank(record.taskEnvelope.useGuidance) ||
      record.taskEnvelope.coreTasks.length === 0 ||
      record.taskEnvelope.methods.length === 0 ||
      record.taskEnvelope.limits.length === 0 ||
      [
        ...record.taskEnvelope.coreTasks,
        ...record.taskEnvelope.methods,
        ...record.taskEnvelope.limits,
      ].some((value) => !isNonBlank(value))
    ) {
      add(
        "INCOMPLETE_TASK_ENVELOPE",
        `${path}.taskEnvelope`,
        `Competency "${record.name}" (${record.id}) needs a description plus non-empty core tasks, methods, limits, and use guidance.`,
      );
    }

    if (
      looseWeight.status !== "provisional" ||
      looseWeight.pricingAuthority !== "none" ||
      !SCOPE_SET.has(String(looseWeight.relativeScope)) ||
      !isNonBlank(looseWeight.rationale)
    ) {
      add(
        "ECONOMIC_WEIGHT_NOT_INERT",
        `${path}.economicWeight`,
        `Competency "${record.name}" (${record.id}) economic weight must remain a provisional relative-scope note with no pricing authority.`,
      );
    }

    for (const field of FORBIDDEN_PRICE_FIELDS) {
      if (looseRecord[field] !== undefined || looseWeight[field] !== undefined) {
        add(
          "LIVE_PRICING_FIELD_FORBIDDEN",
          `${path}.economicWeight.${field}`,
          `Competency "${record.name}" (${record.id}) cannot turn provisional scope metadata into live pricing field "${field}".`,
        );
      }
    }
  }

  document.spokenLanguages.forEach((language, index) => {
    if (language.kind !== "spoken-language") return;
    for (const familyId of language.familyIds) {
      if (familyById.get(familyId)?.kind !== "language-family") {
        add(
          "LANGUAGE_UNKNOWN_FAMILY",
          `spokenLanguages[${index}].familyIds`,
          `Spoken language "${language.name}" (${language.id}) references unknown language family "${familyId}".`,
        );
      }
    }
  });

  document.scripts.forEach((script, index) => {
    if (script.kind !== "script") return;
    for (const familyId of script.familyIds) {
      if (familyById.get(familyId)?.kind !== "script-family") {
        add(
          "SCRIPT_UNKNOWN_FAMILY",
          `scripts[${index}].familyIds`,
          `Script "${script.name}" (${script.id}) references unknown script family "${familyId}".`,
        );
      }
    }
  });

  document.writtenTraditions.forEach((tradition, index) => {
    if (tradition.kind !== "written-tradition") return;
    const path = `writtenTraditions[${index}]`;

    if (!languageById.has(tradition.spokenLanguageId)) {
      add(
        "WRITTEN_TRADITION_UNKNOWN_LANGUAGE",
        `${path}.spokenLanguageId`,
        `Written tradition "${tradition.name}" (${tradition.id}) needs a valid spoken-language identity; received "${tradition.spokenLanguageId}".`,
      );
    }

    if (!scriptById.has(tradition.scriptId)) {
      add(
        "WRITTEN_TRADITION_UNKNOWN_SCRIPT",
        `${path}.scriptId`,
        `Written tradition "${tradition.name}" (${tradition.id}) needs a valid script identity; received "${tradition.scriptId}".`,
      );
    }
  });

  document.relationships.forEach((relationship, index) => {
    if (
      relationship.kind !== "inclusion" &&
      relationship.kind !== "prerequisite" &&
      relationship.kind !== "related"
    ) {
      return;
    }
    const path = `relationships[${index}]`;
    const looseRelationship = relationship as unknown as Record<string, unknown>;
    const source = competencyById.get(relationship.sourceCompetencyId);
    const target = competencyById.get(relationship.targetCompetencyId);

    if (!source || !COMPETENCY_KINDS.has(source.kind)) {
      add(
        "RELATIONSHIP_UNKNOWN_SOURCE",
        `${path}.sourceCompetencyId`,
        `Relationship "${relationship.name}" (${relationship.id}) references unknown concrete source "${relationship.sourceCompetencyId}".`,
      );
    }

    if (!target || !COMPETENCY_KINDS.has(target.kind)) {
      add(
        "RELATIONSHIP_UNKNOWN_TARGET",
        `${path}.targetCompetencyId`,
        `Relationship "${relationship.name}" (${relationship.id}) references unknown concrete target "${relationship.targetCompetencyId}".`,
      );
    }

    if (
      relationship.direction !== "source-to-target" ||
      relationship.reverseEdge !== "not-inferred"
    ) {
      add(
        "RELATIONSHIP_DIRECTION_OR_REVERSE_IMPLIED",
        path,
        `Relationship "${relationship.name}" (${relationship.id}) must be explicitly source-to-target and must not infer a reverse edge.`,
      );
    }

    if (relationship.kind === "inclusion") {
      if (
        (relationship as { includedCorePercent?: unknown }).includedCorePercent !== 100 ||
        relationship.semantics !== "complete-core-task-envelope"
      ) {
        add(
          "INCLUSION_NOT_EXACT_100_PERCENT",
          `${path}.includedCorePercent`,
          `Inclusion "${relationship.name}" (${relationship.id}) must mean explicit 100% containment of the target core task envelope.`,
        );
      }
    }

    if (relationship.kind === "related") {
      if (relationship.calibration !== "unresolved" || !RELATED_EFFECTS.has(relationship.effect)) {
        add(
          "RELATED_RELATIONSHIP_CALIBRATION_DECIDED",
          path,
          `Related edge "${relationship.name}" (${relationship.id}) must name an allowed effect while leaving arithmetic unresolved.`,
        );
      }

      for (const field of FORBIDDEN_RELATIONSHIP_ARITHMETIC_FIELDS) {
        if (looseRelationship[field] !== undefined) {
          add(
            "UNRESOLVED_RELATIONSHIP_ARITHMETIC_FIELD",
            `${path}.${field}`,
            `Related edge "${relationship.name}" (${relationship.id}) cannot define unresolved arithmetic field "${field}".`,
          );
        }
      }
    }

    if (
      relationship.kind === "prerequisite" &&
      (relationship.enforcement !== "not-implemented" ||
        relationship.threshold?.status !== "placeholder" ||
        !isNonBlank(relationship.threshold?.label))
    ) {
      add(
        "PREREQUISITE_THRESHOLD_STRUCTURE_INVALID",
        `${path}.threshold`,
        `Prerequisite "${relationship.name}" (${relationship.id}) needs a named placeholder threshold and cannot enforce eligibility.`,
      );
    }
  });

  document.specializations.forEach((specialization, index) => {
    if (specialization.kind !== "specialization") return;
    const path = `specializations[${index}]`;
    const validBaseSkillIds = new Set<string>();

    if (specialization.basePrerequisiteEdgeIds.length === 0) {
      add(
        "SPECIALIZATION_BASE_PREREQUISITE_MISSING",
        `${path}.basePrerequisiteEdgeIds`,
        `Specialization "${specialization.name}" (${specialization.id}) needs at least one authored base-skill prerequisite edge.`,
      );
    }

    for (const edgeId of specialization.basePrerequisiteEdgeIds) {
      const edge = relationshipById.get(edgeId);
      const source = edge ? competencyById.get(edge.sourceCompetencyId) : undefined;

      if (
        edge?.kind !== "prerequisite" ||
        edge.targetCompetencyId !== specialization.id ||
        source?.kind !== "skill"
      ) {
        add(
          "SPECIALIZATION_INVALID_BASE_PREREQUISITE",
          `${path}.basePrerequisiteEdgeIds`,
          `Specialization "${specialization.name}" (${specialization.id}) prerequisite edge "${edgeId}" must run from a concrete base skill to this specialization.`,
        );
      } else if (
        edge.enforcement === "not-implemented" &&
        edge.threshold?.status === "placeholder" &&
        isNonBlank(edge.threshold?.label)
      ) {
        validBaseSkillIds.add(source.id);
      }
    }

    for (const edgeId of specialization.transferEdgeIds) {
      const edge = relationshipById.get(edgeId);
      const otherEndpointId =
        edge?.sourceCompetencyId === specialization.id
          ? edge.targetCompetencyId
          : edge?.targetCompetencyId === specialization.id
            ? edge.sourceCompetencyId
            : undefined;

      if (edge?.kind !== "related" || !otherEndpointId || !validBaseSkillIds.has(otherEndpointId)) {
        add(
          "SPECIALIZATION_INVALID_TRANSFER_EDGE",
          `${path}.transferEdgeIds`,
          `Specialization "${specialization.name}" (${specialization.id}) transfer edge "${edgeId}" must explicitly connect this specialization with one of its valid authored base skills.`,
        );
      }
    }
  });

  document.learningGroups.forEach((group, index) => {
    if (group.kind !== "learning-group") return;
    const path = `learningGroups[${index}]`;

    if (
      !LEARNING_CONTEXT_SET.has(String(group.context?.kind)) ||
      !isNonBlank(group.context?.description)
    ) {
      add(
        "LEARNING_GROUP_CONTEXT_MISSING",
        `${path}.context`,
        `Learning group "${group.name}" (${group.id}) needs a narratable household, apprenticeship, crew, campaign, institution, office, unit, teacher, or workshop context.`,
      );
    }

    const allMembershipIds = [
      ...group.fixedCompetencyIds,
      ...group.selectedMemberships.flatMap((slot) => slot.candidateCompetencyIds),
    ];

    if (allMembershipIds.length === 0) {
      add(
        "LEARNING_GROUP_EMPTY",
        path,
        `Learning group "${group.name}" (${group.id}) must define fixed or selected concrete competency membership.`,
      );
    }

    for (const competencyId of allMembershipIds) {
      if (!competencyById.has(competencyId)) {
        add(
          "LEARNING_GROUP_UNKNOWN_MEMBER",
          path,
          `Learning group "${group.name}" (${group.id}) references unknown concrete competency "${competencyId}".`,
        );
      }
    }

    group.selectedMemberships.forEach((slot, slotIndex) => {
      if (
        !STABLE_AUTHORING_ID_PATTERN.test(slot.id) ||
        !isNonBlank(slot.label) ||
        !Number.isInteger(slot.chooseCount) ||
        slot.chooseCount < 1 ||
        slot.chooseCount > slot.candidateCompetencyIds.length
      ) {
        add(
          "LEARNING_GROUP_SELECTION_INVALID",
          `${path}.selectedMemberships[${slotIndex}]`,
          `Learning group "${group.name}" (${group.id}) has a malformed selected-membership slot.`,
        );
      }
    });
  });

  document.applicabilityProfiles.forEach((profile, profileIndex) => {
    if (profile.kind !== "applicability-profile") return;
    const path = `applicabilityProfiles[${profileIndex}]`;

    if (!STAGE_SET.has(String(profile.developmentStage))) {
      add(
        "INVALID_DEVELOPMENT_STAGE",
        `${path}.developmentStage`,
        `Applicability profile "${profile.name}" (${profile.id}) must use DS1-DS6; received "${String(profile.developmentStage)}".`,
      );
    }

    if (profile.eligibilityEnforcement !== "not-implemented") {
      add(
        "APPLICABILITY_BECAME_LIVE_ELIGIBILITY",
        `${path}.eligibilityEnforcement`,
        `Applicability profile "${profile.name}" (${profile.id}) cannot enforce eligibility in the authoring foundation.`,
      );
    }

    profile.defaults.forEach((entry, entryIndex) => {
      if (!competencyById.has(entry.competencyId) || !isNonBlank(entry.note)) {
        add(
          "APPLICABILITY_DEFAULT_REFERENCE_INVALID",
          `${path}.defaults[${entryIndex}]`,
          `Applicability default in "${profile.name}" references unknown competency "${entry.competencyId}" or lacks an author explanation.`,
        );
      }
    });

    profile.accessBandDefaults.forEach((entry, entryIndex) => {
      if (!ACCESS_BAND_SET.has(String(entry.accessBand))) {
        add(
          "INVALID_ACCESS_BAND",
          `${path}.accessBandDefaults[${entryIndex}].accessBand`,
          `Applicability profile "${profile.name}" (${profile.id}) must use AB1-AB4; received "${String(entry.accessBand)}".`,
        );
      }

      if (
        !isNonBlank(entry.routeDescription) ||
        entry.competencyIds.some((competencyId) => !competencyById.has(competencyId))
      ) {
        add(
          "ACCESS_BAND_DEFAULT_REFERENCE_INVALID",
          `${path}.accessBandDefaults[${entryIndex}]`,
          `Access-band default in "${profile.name}" needs a narratable route and valid concrete competency references.`,
        );
      }
    });

    profile.domainOverrides.forEach((override, overrideIndex) => {
      const overridePath = `${path}.domainOverrides[${overrideIndex}]`;

      if (!ACCESS_BAND_SET.has(String(override.accessBand))) {
        add(
          "INVALID_ACCESS_BAND",
          `${overridePath}.accessBand`,
          `Domain-scoped applicability override in "${profile.name}" (${profile.id}) must use AB1-AB4; received "${String(override.accessBand)}".`,
        );
      }

      if (
        !domainById.has(override.domainId) ||
        !APPLICABILITY_OVERRIDE_BASES.has(String(override.basis)) ||
        !isNonBlank(override.attributionId) ||
        !isNonBlank(override.explanation)
      ) {
        add(
          "DOMAIN_APPLICABILITY_OVERRIDE_REFERENCE_INVALID",
          overridePath,
          `Domain-scoped applicability override in "${profile.name}" needs a valid domain plus an explicit profile/contact/teacher/institution/biography/text/tradition attribution and explanation.`,
        );
      }
    });

    profile.overrides.forEach((override, overrideIndex) => {
      if (
        !APPLICABILITY_OVERRIDE_BASES.has(String(override.basis)) ||
        !competencyById.has(override.competencyId) ||
        !isNonBlank(override.attributionId) ||
        !isNonBlank(override.explanation)
      ) {
        add(
          "APPLICABILITY_OVERRIDE_REFERENCE_INVALID",
          `${path}.overrides[${overrideIndex}]`,
          `Applicability override in "${profile.name}" needs a valid competency plus an explicit profile/contact/teacher/institution/biography/text/tradition attribution and explanation.`,
        );
      }
    });
  });

  diagnostics.sort(compareDiagnostics);

  return {
    diagnostics,
    documentId,
    valid: diagnostics.length === 0,
  };
}
