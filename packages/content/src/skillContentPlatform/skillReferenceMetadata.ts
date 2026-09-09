import type {
  SkillContentLearningHistoryRecord,
  SkillContentRelease,
  SkillReferenceArchSkill,
  SkillReferenceArchSociety,
  SkillReferenceHistoricalAvailability,
  SkillReferenceLearningGroup,
  SkillReferenceLearningHistory,
  SkillReferenceManifestation,
  SkillReferenceMetadata,
  SkillReferenceProfession,
  SkillReferenceSocialBand,
  SkillReferenceSocietyLevel,
  SkillReferenceSocietyLevelBandCell,
  SkillReferenceSocietyLevelBandMatrix,
} from "@glantri/domain";
import { pilotSkillContentReleaseV1 } from "../pilotSkillContentRelease";
import { defaultCanonicalContent } from "../seeds/defaultContent";

const SOCIETY_LEVELS: readonly SkillReferenceSocietyLevel[] = [
  { level: 1, label: "Society Level 1" },
  { level: 2, label: "Society Level 2" },
  { level: 3, label: "Society Level 3" },
  { level: 4, label: "Society Level 4" },
  { level: 5, label: "Society Level 5" },
  { level: 6, label: "Society Level 6" },
];

const SOCIAL_BANDS: readonly SkillReferenceSocialBand[] = [
  { id: "L1", label: "Social Band L1" },
  { id: "L2", label: "Social Band L2" },
  { id: "L3", label: "Social Band L3" },
  { id: "L4", label: "Social Band L4" },
];

function referenceMetadata(recordId: string, note: string) {
  return {
    recordVersion: "1",
    status: "proposal" as const,
    provenance: {
      kind: "proposal" as const,
      reference: `packages/content/src/skillContentPlatform/skillReferenceMetadata.ts#${recordId}`,
      note,
    },
  };
}

function evidenceMetadata(recordId: string, reference: string) {
  return {
    recordVersion: "1",
    status: "evidence" as const,
    provenance: {
      kind: "evidence" as const,
      reference,
      note: `Reference-only evidence for ${recordId}; it is not canonical Skill authority.`,
    },
  };
}

function legacyMetadata(recordId: string) {
  return {
    recordVersion: "1",
    status: "legacy" as const,
    provenance: {
      kind: "legacy" as const,
      reference: `packages/content/src/pilotSkillContentRelease/release.ts#${recordId}`,
      note: "Reference-only Pilot suggestion; it is separate from Skill access and mechanics.",
    },
  };
}

function archSkillsForRelease(release: SkillContentRelease): SkillReferenceArchSkill[] {
  return release.domains.map((domain) => ({
    description: `${domain.name} is a navigation context for discovering related Skills. It does not grant competence or define access.`,
    id: `arch-skill:${domain.id.replace(/^domain:/, "")}`,
    mechanics: "none" as const,
    metadata: referenceMetadata(
      domain.id,
      "Projected from the candidate's explicit primary domain.",
    ),
    membershipMeaning: "navigation-only" as const,
    name: domain.name,
    skillMemberships: release.competencies
      .filter((competency) => competency.kind === "skill" && competency.domainId === domain.id)
      .map(({ id }) => ({ placement: "primary" as const, skillId: id })),
  }));
}

function archSocieties(): SkillReferenceArchSociety[] {
  return defaultCanonicalContent.societies.map((society) => ({
    description: society.shortDescription,
    id: `arch-society:${society.id}`,
    metadata: evidenceMetadata(
      society.id,
      "packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts#societies",
    ),
    name: society.name,
    societyLevel: society.societyLevel as SkillReferenceArchSociety["societyLevel"],
  }));
}

function learningHistories(
  histories: readonly SkillContentLearningHistoryRecord[],
): SkillReferenceLearningHistory[] {
  return histories.map((history) => ({
    context: history.context,
    historyId: history.id,
    metadata: history.metadata,
    name: history.name,
    skillIds: [
      ...new Set([
        ...history.fixedCompetencyIds,
        ...history.selectionSlots.flatMap((slot) => slot.candidateCompetencyIds),
      ]),
    ],
  }));
}

function professionReferences(): SkillReferenceProfession[] {
  return pilotSkillContentReleaseV1.professions.map((profession) => ({
    id: profession.id,
    learningHistoryIds: [...profession.suggestedHistoryIds],
    metadata: legacyMetadata(profession.id),
    name: profession.name,
    suggestedSkillIds: [...profession.suggestedCompetencyIds],
  }));
}

export function buildSocietyLevelBandMatrix(
  historicalAvailability: readonly SkillReferenceHistoricalAvailability[],
  societyLevels: readonly SkillReferenceSocietyLevel[] = SOCIETY_LEVELS,
  socialBands: readonly SkillReferenceSocialBand[] = SOCIAL_BANDS,
): SkillReferenceSocietyLevelBandMatrix {
  const cells: SkillReferenceSocietyLevelBandCell[] = [];
  for (const societyLevel of societyLevels) {
    for (const socialBand of socialBands) {
      const records = historicalAvailability.filter(
        (record) =>
          record.societyLevel === societyLevel.level && record.socialBand === socialBand.id,
      );
      const statuses = new Set(records.map(({ status }) => status));
      cells.push({
        historicalAvailabilityIds: records.map(({ id }) => id),
        socialBand: socialBand.id,
        societyLevel: societyLevel.level,
        status:
          records.length === 0 || statuses.has("unresolved") || statuses.has("review-required")
            ? "unresolved"
            : statuses.size > 1
              ? "context-dependent"
              : "recorded",
      });
    }
  }
  return { cells, societyLevels, socialBands };
}

export function buildSkillReferenceMetadata(release: SkillContentRelease): SkillReferenceMetadata {
  const societies = archSocieties();
  const referenceSkill = release.competencies.find(({ id }) => id === "skill:medicine");
  const referenceSociety = societies[0];
  const historicalAvailability: SkillReferenceHistoricalAvailability[] =
    referenceSkill && referenceSociety
      ? [
          {
            archSocietyId: referenceSociety.id,
            explanation:
              "No authored historical availability fact is supplied for this exact Skill and Arch Society pair; review is required.",
            id: `historical-availability:${referenceSkill.id}:${referenceSociety.id}`,
            metadata: referenceMetadata(
              `historical-availability:${referenceSkill.id}:${referenceSociety.id}`,
              "Explicit unresolved review record; no availability was inferred.",
            ),
            skillId: referenceSkill.id,
            socialBand: "L1",
            societyLevel: referenceSociety.societyLevel,
            status: "unresolved",
          },
        ]
      : [];
  const manifestations: SkillReferenceManifestation[] =
    referenceSkill && referenceSociety
      ? [
          {
            archSocietyId: referenceSociety.id,
            explanation:
              "The exact Skill and Arch Society manifestation has not been authored yet; review is required.",
            id: `manifestation:${referenceSkill.id}:${referenceSociety.id}`,
            metadata: referenceMetadata(
              `manifestation:${referenceSkill.id}:${referenceSociety.id}`,
              "Explicit unresolved review record; no society applicability was inferred.",
            ),
            skillId: referenceSkill.id,
            status: "unresolved",
          },
        ]
      : [];
  const skillSocietyFloors =
    referenceSkill && referenceSociety
      ? [
          {
            explanation:
              "No structural Society-Level floor is supplied for this Skill; the floor is held for review.",
            id: `skill-society-floor:${referenceSkill.id}`,
            metadata: referenceMetadata(
              `skill-society-floor:${referenceSkill.id}`,
              "Explicit held review record; no floor was inferred.",
            ),
            skillId: referenceSkill.id,
            status: "held" as const,
          },
        ]
      : [];
  const societyApplicability =
    referenceSkill && referenceSociety
      ? [
          {
            archSocietyId: referenceSociety.id,
            explanation:
              "Applicability for this exact Skill and Arch Society pair is unresolved; no group membership confers availability.",
            id: `society-applicability:${referenceSkill.id}:${referenceSociety.id}`,
            manifestationId: manifestations[0]?.id,
            metadata: referenceMetadata(
              `society-applicability:${referenceSkill.id}:${referenceSociety.id}`,
              "Explicit unresolved review record; no applicability was inferred.",
            ),
            skillId: referenceSkill.id,
            standaloneRouteIds: [],
            status: "unresolved" as const,
            supportingLearningGroupIds: [],
          },
        ]
      : [];
  const learningGroups: SkillReferenceLearningGroup[] = [];
  return {
    archSkills: archSkillsForRelease(release),
    archSocieties: societies,
    historicalAvailability,
    learningGroups,
    learningHistories: learningHistories(release.histories),
    manifestations,
    professionReferences: professionReferences(),
    schemaVersion: "skill-reference-metadata/v1",
    skillSocietyFloors,
    societyApplicability,
    societyLevelBandMatrix: buildSocietyLevelBandMatrix(historicalAvailability),
  };
}

export function validateSkillReferenceMetadata(input: unknown): string[] {
  if (!input || typeof input !== "object") return ["Reference metadata must be an object."];
  const metadata = input as Partial<SkillReferenceMetadata>;
  const errors: string[] = [];
  const ids = new Map<string, string>();
  const register = (id: string, path: string) => {
    const previous = ids.get(id);
    if (previous)
      errors.push(`Duplicate reference identity "${id}" at ${path}; first used at ${previous}.`);
    else ids.set(id, path);
  };
  const societies = new Set((metadata.archSocieties ?? []).map(({ id }) => id));
  const learningGroups = new Set((metadata.learningGroups ?? []).map(({ id }) => id));
  const manifestations = new Set((metadata.manifestations ?? []).map(({ id }) => id));
  const assertSkillReference = (value: string, path: string) => {
    if (!value) errors.push(`Missing Skill identity at ${path}.`);
  };

  (metadata.archSkills ?? []).forEach((record, index) => {
    register(record.id, `archSkills[${index}]`);
    record.skillMemberships.forEach((membership, membershipIndex) =>
      assertSkillReference(
        membership.skillId,
        `archSkills[${index}].skillMemberships[${membershipIndex}]`,
      ),
    );
  });
  (metadata.learningGroups ?? []).forEach((record, index) => {
    register(record.id, `learningGroups[${index}]`);
    record.skillMemberships.forEach((membership, membershipIndex) => {
      if (!membership.skillId)
        errors.push(
          `Missing Skill identity at learningGroups[${index}].skillMemberships[${membershipIndex}].`,
        );
    });
  });
  (metadata.archSocieties ?? []).forEach((record, index) =>
    register(record.id, `archSocieties[${index}]`),
  );
  (metadata.manifestations ?? []).forEach((record, index) => {
    register(record.id, `manifestations[${index}]`);
    assertSkillReference(record.skillId, `manifestations[${index}].skillId`);
    if (!societies.has(record.archSocietyId))
      errors.push(
        `Unknown Arch Society "${record.archSocietyId}" at manifestations[${index}].archSocietyId.`,
      );
  });
  (metadata.historicalAvailability ?? []).forEach((record, index) => {
    register(record.id, `historicalAvailability[${index}]`);
    assertSkillReference(record.skillId, `historicalAvailability[${index}].skillId`);
    if (!societies.has(record.archSocietyId))
      errors.push(
        `Unknown Arch Society "${record.archSocietyId}" at historicalAvailability[${index}].archSocietyId.`,
      );
  });
  (metadata.skillSocietyFloors ?? []).forEach((record, index) => {
    register(record.id, `skillSocietyFloors[${index}]`);
    assertSkillReference(record.skillId, `skillSocietyFloors[${index}].skillId`);
  });
  (metadata.societyApplicability ?? []).forEach((record, index) => {
    register(record.id, `societyApplicability[${index}]`);
    assertSkillReference(record.skillId, `societyApplicability[${index}].skillId`);
    if (!societies.has(record.archSocietyId))
      errors.push(
        `Unknown Arch Society "${record.archSocietyId}" at societyApplicability[${index}].archSocietyId.`,
      );
    if (record.manifestationId && !manifestations.has(record.manifestationId))
      errors.push(
        `Unknown manifestation "${record.manifestationId}" at societyApplicability[${index}].manifestationId.`,
      );
    record.supportingLearningGroupIds.forEach((groupId, groupIndex) => {
      if (!learningGroups.has(groupId))
        errors.push(
          `Unknown Learning Group "${groupId}" at societyApplicability[${index}].supportingLearningGroupIds[${groupIndex}].`,
        );
    });
  });
  if (metadata.schemaVersion !== "skill-reference-metadata/v1")
    errors.push("Unsupported reference metadata schema version.");
  return errors.sort();
}
