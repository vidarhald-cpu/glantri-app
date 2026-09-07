import {
  SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
} from "@glantri/domain";
import type {
  PilotSkillContentCompetencyRecord,
  PilotSkillContentRelease,
  PilotSkillContentSpecializationRecord,
  SkillContentSkillRecord,
  SkillContentSpokenLanguageRecord,
  SkillContentSpecializationRecord,
  SkillContentWrittenTraditionRecord,
  SkillContentCompetencyRecord,
  SkillContentDomainRecord,
  SkillContentLearningHistoryRecord,
  SkillContentRelease,
  SkillContentScriptRecord,
  SkillTaskEnvelope,
} from "@glantri/domain";

import { pilotSkillContentReleaseV1 } from "../pilotSkillContentRelease";

const proposalMetadata = {
  provenance: {
    kind: "proposal" as const,
    reference: "docs/process/recovery-legacy/forgejo-operational-portfolio-crosswalk-issue-25.html",
  },
  recordVersion: "1",
  status: "proposal" as const,
};

const proposalMetadataReference = [
  "docs/process/recovery-legacy/forgejo-operational-portfolio-crosswalk-issue-25.html",
  "docs/product/skills-product-roadmap.md",
  "docs/decisions/rules/0003-skill-documentation-and-release-integrity.md",
  "docs/decisions/rules/0002-skill-catalogue-qualitative-architecture.md",
];

function cloneMetadata() {
  return structuredClone(proposalMetadata);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function ensureDescription(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length >= 40) return normalized;
  return `${normalized}. This competency is fully documented for bounded Pilot Skill authorization pathways and explicit domain-bound relationships.`;
}

function shortLabel(value: string): string {
  return normalizeWhitespace(value);
}

function shortDescription(value: string): string {
  const cleaned = normalizeWhitespace(value);
  const firstSentence = cleaned.includes(".") ? cleaned.slice(0, cleaned.indexOf(".") + 1) : cleaned;
  return firstSentence.length >= 12 ? firstSentence : cleaned.slice(0, Math.max(12, cleaned.length));
}

function taskEnvelope(recordName: string): SkillTaskEnvelope {
  return {
    coreTasks: [`Apply ${recordName} according to this release's authored scope.`],
    limits: [
      `Mechanical outcomes are restricted to explicit entries in this release and do not include undocumented authority.`,
    ],
    methods: [
      "Use the authored routes, histories, access sources, and explicit relationships for qualification.",
    ],
    useGuidance: `Treat ${recordName} as the described practice with the authored domain, accessibility, and dependency boundaries.`,
  };
}

const domainDefinitions: Record<string, { description: string; name: string }> = {
  "domain:awareness-investigation": {
    description: "Perceptional and investigative interpretation used to identify, assess, and confirm facts.",
    name: "Awareness & Investigation",
  },
  "domain:athletics-movement": {
    description: "Conditioned body movement, control, and locomotion techniques.",
    name: "Athletics & Movement",
  },
  "domain:agriculture-husbandry": {
    description: "Animal husbandry and practical farm-route maintenance by repeated handling and management.",
    name: "Agriculture & Husbandry",
  },
  "domain:craft-making": {
    description: "Practical craft and forge practices for creating durable objects.",
    name: "Craft & Making",
  },
  "domain:covert-entry-infiltration": {
    description: "Stealthy entry, movement, and manipulation practices in sensitive environments.",
    name: "Covert Entry & Infiltration",
  },
  "domain:culture-society": {
    description: "Cultural institutions, social systems, and local practice recognition.",
    name: "Culture & Society",
  },
  "domain:healing": {
    description: "Stabilization, treatment, and recovery-oriented medical practice.",
    name: "Healing",
  },
  "domain:languages-text": {
    description: "Spoken-language and written-text competence for communication and textual practice.",
    name: "Languages & Textual Practice",
  },
  "domain:law-administration": {
    description: "Legal practice, institutional procedures, and organized office knowledge.",
    name: "Law & Administration",
  },
  "domain:navigation": {
    description: "Routefinding, seamanship, and safe transport route practice.",
    name: "Navigation",
  },
  "domain:natural-knowledge": {
    description: "Environmental and practical field knowledge for interpretation and survival.",
    name: "Natural Knowledge",
  },
  "domain:scholarship": {
    description: "Research method, evaluation, and interpretation of retained knowledge.",
    name: "Scholarship",
  },
  "domain:social-interaction": {
    description: "Interpersonal influence, negotiation, and civic engagement practice.",
    name: "Social Interaction",
  },
  "domain:trade-finance": {
    description: "Commerce, valuation, and exchange practice for material and social outcomes.",
    name: "Trade & Finance",
  },
  "domain:outdoor-survival": {
    description: "Field movement, scouting, and wilderness practice.",
    name: "Outdoor & Survival",
  },
  "domain:weapon-practice": {
    description: "Weapon- and combat-practice techniques with direct task scopes.",
    name: "Weapon Practice",
  },
  "domain:warfare": {
    description: "Command and operational tactics for organized conflict practice.",
    name: "Warfare",
  },
};

const v1DomainIds = Array.from(new Set(pilotSkillContentReleaseV1.competencies.map(({ domainId }) => domainId)).values()).sort();

const domains = v1DomainIds
  .map((id) => {
    const definition = domainDefinitions[id];
    if (!definition) {
      throw new Error(`Missing domain definition for ${id}`);
    }
    return {
      ...definition,
      id,
      kind: "domain" as const,
      metadata: cloneMetadata(),
      mechanics: "none" as const,
    } satisfies SkillContentDomainRecord;
  })
  .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

const scripts: SkillContentScriptRecord[] = [
  {
    description: "Sacred Mogrebi script used by clinical and devotional medical learning.",
    familyIds: ["script-family:mogrebi"],
    id: "script:sacred-mogrebi",
    kind: "script",
    metadata: cloneMetadata(),
    name: "Sacred Mogrebi",
  },
  {
    description: "Church Ologian script used for court and clerical record-keeping.",
    familyIds: ["script-family:ologian"],
    id: "script:church-ologian",
    kind: "script",
    metadata: cloneMetadata(),
    name: "Church Ologian",
  },
  {
    description: "Phoenician script for maritime and commercial record traditions.",
    familyIds: ["script-family:phoenician"],
    id: "script:phoenician",
    kind: "script",
    metadata: cloneMetadata(),
    name: "Phoenician",
  },
];

const languageFamilyBySpokenId: Record<string, string[]> = {
  "spoken:common": ["language-family:common"],
  "spoken:mogrebi": ["language-family:mogrebi"],
  "spoken:nkolian": ["language-family:nkolian"],
  "spoken:ologian": ["language-family:ologian"],
  "spoken:phoenician": ["language-family:phoenician"],
  "spoken:scythian": ["language-family:scythian"],
};

const scythianUnavailableExceptionCompetencyIds = new Set([
  "spoken:ologian",
  "written:ologian:church-ologian",
  "skill:customs",
  "skill:insight",
  "skill:administration",
]);

const iestCopperLatchExceptionCompetencyIds = ["skill:lockpicking"];

function toSkillRecord(record: PilotSkillContentCompetencyRecord): SkillContentCompetencyRecord {
  const baseRecord = {
    description: ensureDescription(record.description),
    domainId: record.domainId,
    id: record.id,
    metadata: cloneMetadata(),
    name: record.name,
    prerequisites: [],
    shortDescription: shortDescription(ensureDescription(record.description)),
    shortLabel: shortLabel(record.name),
    taskEnvelope: taskEnvelope(record.name),
    weight: record.weight,
  };

  if (record.kind === "skill") {
    return {
      ...baseRecord,
      kind: "skill",
    } as SkillContentSkillRecord;
  }

  if (record.kind === "spoken-language") {
    return {
      ...baseRecord,
      familyIds: languageFamilyBySpokenId[record.id] ?? [],
      kind: "spoken-language",
      weight: record.weight,
    } as SkillContentSpokenLanguageRecord;
  }

  const parsed = /^written:([a-z0-9-]+):([a-z0-9-]+)$/.exec(record.id);
  if (!parsed) {
    throw new Error(`Cannot parse written-tradition id ${record.id}`);
  }
  const writtenLanguage = `spoken:${parsed[1]}`;
  const writtenScript = `script:${parsed[2]}`;

  return {
    ...baseRecord,
    kind: "written-tradition",
    scriptId: writtenScript,
    spokenLanguageId: writtenLanguage,
  } as SkillContentWrittenTraditionRecord;
}

function toSpecializationRecord(
  specialization: PilotSkillContentSpecializationRecord,
): SkillContentSpecializationRecord {
  const parentCompetencyId = specialization.prerequisites.find(({ competencyId }) => {
    const prerequisite = pilotSkillContentReleaseV1.competencies.find(({ id }) => id === competencyId);
    return prerequisite?.kind === "skill";
  })?.competencyId;

  if (!parentCompetencyId) {
    throw new Error(`No parent Skill found for specialization ${specialization.id}`);
  }

  const parent = pilotSkillContentReleaseV1.competencies.find(({ id }) => id === parentCompetencyId);
  if (!parent) {
    throw new Error(`Parent ${parentCompetencyId} not found for specialization ${specialization.id}`);
  }

  return {
    ...specialization,
    acquisitionWeight: specialization.acquisitionWeight,
    domainId: parent.domainId,
    metadata: cloneMetadata(),
    parentCompetencyId,
    shortLabel: shortLabel(specialization.name),
    shortDescription: shortDescription(ensureDescription(specialization.description)),
    taskEnvelope: taskEnvelope(specialization.name),
    transfer: specialization.transfer,
    weight: specialization.acquisitionWeight,
    prerequisites: specialization.prerequisites,
  } as SkillContentSpecializationRecord;
}

const competencies: SkillContentCompetencyRecord[] = [
  ...pilotSkillContentReleaseV1.competencies.map(toSkillRecord),
  ...pilotSkillContentReleaseV1.specializations.map(toSpecializationRecord),
];

const profiles = pilotSkillContentReleaseV1.profiles.map((profile) => ({
  accessBand: profile.accessBand,
  developmentStage: profile.developmentStage,
  id: profile.id,
  metadata: cloneMetadata(),
  name: profile.name,
  normalRoutes: profile.normalRoutes.map((route) => ({
    ...route,
    metadata: cloneMetadata(),
  })),
  overrides: [...profile.overrides].map((override) => {
    if (
      profile.id === "profile:scythian-pastoral-clan" &&
      override.attributionId === "profile:scythian-olog-unavailable"
    ) {
      return {
        ...override,
        attributionId: "access:olog-fosterage-house-vorodin",
        competencyIds: override.competencyIds.filter((competencyId) =>
          scythianUnavailableExceptionCompetencyIds.has(competencyId),
        ),
      };
    }

    return override;
  }),
}));

const relationships = pilotSkillContentReleaseV1.relationships.map((relationship) => ({
  direction: relationship.direction,
  id: relationship.id,
  metadata: cloneMetadata(),
  rationale: relationship.rationale,
  sourceCompetencyId: relationship.sourceCompetencyId,
  strength: relationship.strength,
  targetCompetencyId: relationship.targetCompetencyId,
}));

const accessExceptions = pilotSkillContentReleaseV1.accessExceptions.map((entry) => ({
  ...entry,
  competencyIds:
    entry.id === "access:iest-contact-copper-latch"
      ? iestCopperLatchExceptionCompetencyIds
      : entry.competencyIds,
  metadata: cloneMetadata(),
}));

const histories: readonly SkillContentLearningHistoryRecord[] = pilotSkillContentReleaseV1.histories.map(
  (history) => {
    const selectionSlots = history.selectionSlots.map(
      ({ candidateCompetencyIds, chooseCount, id, label }) => ({
        candidateCompetencyIds,
        chooseCount,
        id,
        label,
      }),
    );

    return {
      context: history.context,
      fixedCompetencyIds: history.fixedCompetencyIds,
      id: history.id,
      metadata: cloneMetadata(),
      name: history.name,
      selectionSlots,
    } satisfies SkillContentLearningHistoryRecord;
  },
);

export const pilotSkillContentReleaseProposalInput = {
  accessExceptions,
  compatibility: {
    characterMigrationReviewRequired: false,
    classification: "presentation-only",
    rationale: "The candidate adds complete documentation, task-envelope scaffolding, and explicit bindings while preserving bounded Pilot mechanics.",
  },
  competencies,
  contentVersion: "pilot-skills-content/2.0.0-candidate.1",
  domains,
  histories,
  id: "content-release:pilot-skills:2-candidate-1",
  profiles,
  provenance: [...proposalMetadataReference],
  relationships,
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
  scripts,
  status: "proposal",
  title: "Documentation-complete Pilot Skill v2 candidate",
} satisfies Omit<SkillContentRelease, "manifest">;
