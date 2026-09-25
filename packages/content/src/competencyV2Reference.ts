import { defaultCanonicalContent } from "./seeds/defaultContent";
import type { CanonicalContent } from "./types";
import { getApprovedV2RuntimeContent } from "./targetCompetencies";
import { archSocieties } from "./skillContentPlatform/skillReferenceMetadata";
import {
  competencyContentV2Catalogue,
  competencyContentV2RemovedGroups,
  competencyContentV2SocietyLevelAvailability,
  competencyContentV2SocialBands,
} from "./proposals/competencyContentV2";

// The existing approved mechanics use seed identities. These are the complete explicit
// reference mappings for their endpoints; this is never an acquisition transform.
export const competencyV2RelationshipIdentityMap: Readonly<Record<string, string>> = Object.freeze({
  bow: "bow",
  crossbow: "crossbow",
  medicine: "skill:medicine",
  first_aid: "skill:first-aid",
  lance: "lance",
  one_handed_concussion_axe: "one_handed_concussion_axe",
  one_handed_edged: "one_handed_edged",
  polearms: "polearms",
  two_handed_concussion_axe: "two_handed_concussion_axe",
  two_handed_edged: "two_handed_edged",
  longbow: "longbow",
  fencing: "fencing",
});

export function projectCompetencyV2ReferenceRelationships(
  relationshipContent: Pick<CanonicalContent, "skills" | "specializations">,
  canonicalIds: ReadonlySet<string>,
) {
  const mappingGaps = new Set<string>();
  function mapEndpoint(id: string): string | undefined {
    const mapped = competencyV2RelationshipIdentityMap[id];
    if (!mapped || !canonicalIds.has(mapped)) {
      mappingGaps.add(id);
      return undefined;
    }
    return mapped;
  }

  const grants = relationshipContent.skills.flatMap((skill) =>
    (skill.derivedGrants ?? []).flatMap((grant) => {
      const sourceId = mapEndpoint(skill.id);
      const targetId = mapEndpoint(grant.skillId);
      return sourceId && targetId ? [{ sourceId, targetId, factor: grant.factor }] : [];
    }),
  );
  const meleeSources = relationshipContent.skills.flatMap((skill) => {
    if (!skill.meleeCrossTraining) return [];
    const skillId = mapEndpoint(skill.id);
    return skillId ? [{ skillId, ...skill.meleeCrossTraining }] : [];
  });
  const bridges = relationshipContent.specializations.flatMap((specialization) => {
    const bridge = specialization.specializationBridge;
    if (!bridge) return [];
    const specializationId = mapEndpoint(specialization.id);
    const parentSkillId = mapEndpoint(bridge.parentSkillId);
    return specializationId && parentSkillId
      ? [
          {
            specializationId,
            parentSkillId,
            reverseFactor: bridge.reverseFactor,
            threshold: bridge.threshold,
            parentExcessOffset: bridge.parentExcessOffset,
          },
        ]
      : [];
  });
  if (mappingGaps.size) {
    throw new Error(
      `Unmapped canonical V2 relationship endpoints: ${[...mappingGaps].sort().join(", ")}`,
    );
  }
  return { grants, meleeSources, bridges };
}

export function getCompetencyV2ReferenceSource() {
  const content = getApprovedV2RuntimeContent();
  const runtime = content.competencyV2;
  if (!runtime || content.chargenCatalogue?.sourceId !== "competency-content-v2") {
    throw new Error("Canonical Competency V2 runtime projection is unavailable.");
  }
  const skillIds = new Set(content.chargenCatalogue.skillIds);
  const specializationIds = new Set(content.chargenCatalogue.specializationIds);
  const allIds = new Set([...skillIds, ...specializationIds]);
  const relationships = projectCompetencyV2ReferenceRelationships(defaultCanonicalContent, allIds);

  const skills = content.skills
    .filter((skill) => skillIds.has(skill.id))
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      shortDescription: skill.shortDescription,
      linkedStats: [...skill.linkedStats],
      competencyType: "competencyType" in skill ? skill.competencyType : undefined,
    }));
  const specializations = content.specializations
    .filter((specialization) => specializationIds.has(specialization.id))
    .map((specialization) => ({
      id: specialization.id,
      name: specialization.name,
      description: specialization.description,
      parentId: specialization.skillId,
      minimumParentLevel: specialization.minimumParentLevel,
    }));
  const groups = content.skillGroups
    .filter((group) => runtime.groupBounds.some((row) => row.groupId === group.id))
    .map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      fixedSkillIds: (group.skillMemberships ?? []).map((row) => row.skillId),
      specializationIds: [...(group.specializationIds ?? [])],
      selectionSlots: (group.selectionSlots ?? []).map((slot) => ({
        id: slot.id,
        label: slot.label,
        chooseCount: slot.chooseCount,
        candidateSkillIds: [...slot.candidateSkillIds],
      })),
    }));
  const families = content.professionFamilies
    .filter((family) => runtime.paths.some((path) => path.familyId === family.id))
    .map((family) => ({
      id: family.id,
      name: family.name,
    }));
  const professions = content.professions
    .filter((profession) => runtime.paths.some((path) => path.id === profession.id))
    .map((profession) => ({
      id: profession.id,
      name: profession.name,
    }));
  return {
    sourceDigest: runtime.sourceDigest,
    skills,
    specializations,
    groups,
    paths: runtime.paths,
    civilizationLanguages: runtime.civilizationLanguages,
    families,
    professions,
    groupDescriptions: competencyContentV2Catalogue.groups.map((group) => ({
      id: group.id,
      description: group.shortDescription,
    })),
    categories: competencyContentV2Catalogue.categories,
    removedGroups: competencyContentV2RemovedGroups,
    availability: {
      authoredCeiling: competencyContentV2SocietyLevelAvailability.authoredCeiling,
      cells: competencyContentV2SocietyLevelAvailability.cells,
      groupBounds: competencyContentV2SocietyLevelAvailability.groupBounds,
      professionRouteBounds: competencyContentV2SocietyLevelAvailability.professionRouteBounds,
      directRouteBounds: competencyContentV2SocietyLevelAvailability.directRouteBounds,
      routeGaps: competencyContentV2SocietyLevelAvailability.routeGaps,
      writtenCompetencyFloors: competencyContentV2SocietyLevelAvailability.writtenCompetencyFloors,
      accessGridDivergences: competencyContentV2SocietyLevelAvailability.accessGridDivergences,
      socialBands: competencyContentV2SocialBands,
    },
    societies: defaultCanonicalContent.societies.map((society) => ({
      id: society.id,
      name: society.name,
      description: society.shortDescription,
      societyLevel: society.societyLevel,
    })),
    civilizations: defaultCanonicalContent.civilizations.map((civilization) => ({
      id: civilization.id,
      name: civilization.name,
      description: civilization.shortDescription,
      linkedSocietyId: civilization.linkedSocietyId,
      spokenLanguageName: civilization.spokenLanguageName,
      writtenLanguageName: civilization.writtenLanguageName,
    })),
    archSocieties: archSocieties().map((society) => ({
      id: society.id,
      name: society.name,
      description: society.description,
      societyLevel: society.societyLevel,
    })),
    relationships,
  };
}

export type CompetencyV2ReferenceSource = ReturnType<typeof getCompetencyV2ReferenceSource>;
