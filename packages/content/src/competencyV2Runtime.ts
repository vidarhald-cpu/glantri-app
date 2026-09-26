import {
  professionDefinitionSchema,
  professionFamilyDefinitionSchema,
  professionSkillMapSchema,
  skillGroupDefinitionSchema,
  targetRuntimeSkillDefinitionSchema,
  type CompetencyV2CoreRoute,
  type CompetencyV2Path,
  type CompetencyV2Route,
  type CompetencyV2RouteBound,
} from "@glantri/domain";
import { canonicalJsonSha256 } from "./integrity/canonicalSha256";
import {
  competencyContentV2Catalogue,
  competencyContentV2CivilizationLanguages,
  competencyContentV2DirectRouteAvailability,
  competencyContentV2Families,
  competencyContentV2GroupAvailability,
  competencyContentV2ProfessionRouteAvailability,
  competencyContentV2SocietyLevelAvailability,
  competencyContentV2FamilyReaderProse,
  competencyContentV2GroupReaderProse,
  competencyContentV2WrittenLanguageCompetencyIds,
  v2SpokenCompetencyName,
  v2WrittenCompetencyName,
  type V2Family,
  type V2PathBody,
  type V2RouteAvailability,
} from "./proposals/competencyContentV2";
import type { CanonicalContent } from "./types";

const bandOrder = ["L1", "L2", "L3", "L4"] as const;

function combineBounds(
  first?: V2RouteAvailability,
  second?: V2RouteAvailability,
): CompetencyV2RouteBound {
  const minSocietyLevel = Math.max(first?.minSocietyLevel ?? 1, second?.minSocietyLevel ?? 1);
  const minSocialBand =
    bandOrder[
      Math.max(
        bandOrder.indexOf(first?.minSocialBand ?? "L1"),
        bandOrder.indexOf(second?.minSocialBand ?? "L1"),
      )
    ];
  return {
    ...(minSocietyLevel > 1 ? { minSocietyLevel } : {}),
    ...(minSocialBand !== "L1" ? { minSocialBand } : {}),
  };
}

function projectCoreRoutes(body: V2PathBody): CompetencyV2CoreRoute[] {
  return (body.coreRoutes ?? []).map((core) => ({
    id: core.id,
    label: core.label,
    groupIds: [...core.groupIds],
    skillIds: [...(core.skillIds ?? [])],
    writtenLanguageChoiceCount: core.writtenLanguageChoiceCount ?? 0,
  }));
}

function projectBodyRoutes(
  family: V2Family,
  body: V2PathBody,
  scopeId: string,
  trackId?: string,
): CompetencyV2Route[] {
  const groupRoutes: CompetencyV2Route[] = (body.groups ?? []).map((route) => ({
    id: `${scopeId}/group/${route.groupId}`,
    kind: "group",
    label: route.route,
    groupId: route.groupId,
    skillIds: [],
    specializationIds: [],
    ...combineBounds(
      competencyContentV2GroupAvailability[route.groupId],
      competencyContentV2ProfessionRouteAvailability.find(
        (bound) =>
          bound.professionCode === family.code &&
          bound.trackId === trackId &&
          bound.groupId === route.groupId,
      ),
    ),
  }));
  if (!(body.skillIds?.length || body.specializationIds?.length)) return groupRoutes;
  const directBound = competencyContentV2DirectRouteAvailability.find(
    (bound) => bound.professionCode === family.code && bound.trackId === trackId,
  );
  return [
    ...groupRoutes,
    {
      id: `${scopeId}/direct`,
      kind: "direct",
      label: body.directRoute!,
      skillIds: [...(body.skillIds ?? [])],
      specializationIds: [...(body.specializationIds ?? [])],
      ...combineBounds(directBound),
    },
  ];
}

function projectPaths(): CompetencyV2Path[] {
  return competencyContentV2Families.flatMap((family) => {
    const familyRoutes = projectBodyRoutes(family, family, family.id);
    if (!family.tracks?.length) {
      return [
        {
          id: family.id,
          familyId: family.id,
          familyCode: family.code,
          routes: familyRoutes,
          coreRoutes: projectCoreRoutes(family),
        },
      ];
    }
    return family.tracks.map((track) => ({
      id: track.id,
      familyId: family.id,
      familyCode: family.code,
      trackId: track.id,
      routes: [...familyRoutes, ...projectBodyRoutes(family, track, track.id, track.id)],
      coreRoutes: projectCoreRoutes(track).length
        ? projectCoreRoutes(track)
        : projectCoreRoutes(family),
    }));
  });
}

/** Projects only the mechanics used by runtime acquisition, with no reference browse metadata. */
export function withCompetencyContentV2(content: CanonicalContent): CanonicalContent {
  const groups = competencyContentV2Catalogue.groups;
  const families = competencyContentV2Families;
  const paths = projectPaths();
  const targetSkillIds = new Set(content.chargenCatalogue!.skillIds);
  const existingSkillIds = new Set(content.skills.map((skill) => skill.id));
  const spokenStats = content.compatibilityContent?.skills.find(
    (skill) => skill.id === "language",
  )?.linkedStats;
  if (!spokenStats?.length)
    throw new Error("V2 spoken-language projection requires approved Language linked stats.");
  const newLanguageSkills = competencyContentV2CivilizationLanguages.flatMap((row) => {
    const definitions = [
      {
        id: row.spokenCompetencyId,
        name: v2SpokenCompetencyName(row),
        description: row.spokenRoute,
        competencyType: "spoken-language" as const,
        linkedStats: spokenStats,
      },
      ...(row.writtenCompetencyId
        ? [
            {
              id: row.writtenCompetencyId,
              name: v2WrittenCompetencyName(row)!,
              description: row.writtenRoute!,
              competencyType: "written-tradition" as const,
              // Product Owner V1 rule, Forgejo #306 (2026-09-24): all 11 written competencies.
              linkedStats: ["int", "int"],
            },
          ]
        : []),
    ];
    return definitions.filter((definition) => !existingSkillIds.has(definition.id));
  });
  const newLanguageSkillsById = [
    ...new Map(newLanguageSkills.map((skill) => [skill.id, skill])).values(),
  ];
  const groupIdsBySkill = new Map<string, string[]>();
  for (const group of groups) {
    for (const skillId of [
      ...group.fixedSkillIds,
      ...(group.selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds),
    ]) {
      const ids = groupIdsBySkill.get(skillId) ?? [];
      if (!ids.includes(group.id)) ids.push(group.id);
      groupIdsBySkill.set(skillId, ids);
    }
  }
  const professionSkills = families.flatMap((family) => {
    const bodyMaps = (body: V2PathBody, professionId: string, scope: "family" | "profession") => [
      ...(body.groups ?? []).map((route) =>
        professionSkillMapSchema.parse({
          professionId,
          scope,
          grantType: "group",
          skillGroupId: route.groupId,
          isCore: false,
        }),
      ),
      ...(body.skillIds ?? []).map((skillId) =>
        professionSkillMapSchema.parse({
          professionId,
          scope,
          grantType: "ordinary-skill",
          skillId,
          isCore: false,
        }),
      ),
      ...(body.specializationIds ?? []).map((specializationId) =>
        professionSkillMapSchema.parse({
          professionId,
          scope,
          grantType: "ordinary-skill",
          specializationId,
          isCore: false,
        }),
      ),
    ];
    return [
      ...bodyMaps(family, family.id, "family"),
      ...(family.tracks ?? []).flatMap((track) => bodyMaps(track, track.id, "profession")),
    ];
  });
  /*
   * Reader content (#361). A family's `note` is authoring provenance ("Core settled by the
   * 2026-09-21 Profession-cores ruling..."), so it is never published as a description; the accepted
   * Profession catalogue prose is. Tracks are forms of the same occupation and share the family's
   * prose, because the accepted source authors one entry per family.
   */
  const familyReaderContent = (family: V2Family) => {
    const prose = competencyContentV2FamilyReaderProse[family.code];
    if (!prose) return {};
    return {
      description: prose.shortDescription,
      shortDescription: prose.shortDescription,
      fullDescription: prose.fullDescription,
      ...(prose.typicalActivities ? { typicalActivities: [...prose.typicalActivities] } : {}),
      ...(prose.boundaries ? { boundaries: [...prose.boundaries] } : {}),
    };
  };
  return {
    ...content,
    professionFamilies: families.map((family) =>
      professionFamilyDefinitionSchema.parse({
        id: family.id,
        name: family.name,
        ...familyReaderContent(family),
      }),
    ),
    professions: paths.map((path) => {
      const family = families.find((candidate) => candidate.id === path.familyId)!;
      const track = family.tracks?.find((candidate) => candidate.id === path.trackId);
      return professionDefinitionSchema.parse({
        id: path.id,
        familyId: family.id,
        name: track ? `${family.name} — ${track.name}` : family.name,
        subtypeName: track?.name ?? family.name,
        ...familyReaderContent(family),
      });
    }),
    professionSkills,
    skillGroups: groups.map((group, sortOrder) =>
      skillGroupDefinitionSchema.parse({
        id: group.id,
        name: group.name,
        /*
         * `description` keeps the one-line meaning every existing consumer already relies on.
         * `fullDescription` is the new Inspector layer and is absent, never substituted, for a group
         * whose prose is still being authored under #365.
         */
        description: group.shortDescription,
        shortDescription: group.shortDescription,
        ...(competencyContentV2GroupReaderProse[group.id]
          ? {
              fullDescription: competencyContentV2GroupReaderProse[group.id]!.fullDescription,
              ...(competencyContentV2GroupReaderProse[group.id]!.boundaries
                ? { boundaries: [...competencyContentV2GroupReaderProse[group.id]!.boundaries!] }
                : {}),
            }
          : {}),
        sortOrder,
        skillMemberships: group.fixedSkillIds.map((skillId) => ({ skillId, relevance: "core" })),
        specializationIds: [...(group.specializationIds ?? [])],
        selectionSlots: (group.selectionSlots ?? []).map((slot) => ({
          id: slot.id,
          label: slot.label,
          chooseCount: slot.chooseCount,
          candidateSkillIds: [...slot.candidateSkillIds],
          required: slot.required,
        })),
      }),
    ),
    skills: [
      ...content.skills.map((skill) => {
        if (!targetSkillIds.has(skill.id) || !("catalogueSource" in skill)) return skill;
        const groupIds = groupIdsBySkill.get(skill.id) ?? [];
        return targetRuntimeSkillDefinitionSchema.parse({
          ...skill,
          catalogueSource: "competency-content-v2",
          groupId: groupIds[0],
          groupIds,
        });
      }),
      ...newLanguageSkillsById.map((skill, index) =>
        targetRuntimeSkillDefinitionSchema.parse({
          ...skill,
          catalogueSource: "competency-content-v2",
          shortDescription: skill.description,
          groupId: undefined,
          groupIds: [],
          category: "secondary",
          sortOrder: content.skills.length + index,
        }),
      ),
    ],
    chargenCatalogue: {
      ...content.chargenCatalogue!,
      sourceId: "competency-content-v2",
      professionSourceDigest: competencyContentV2Catalogue.manifest.digest,
      groupSourceDigest: canonicalJsonSha256(groups),
      professionIds: paths.map((path) => path.id),
      groupIds: groups.map((group) => group.id),
      skillIds: [
        ...content.chargenCatalogue!.skillIds,
        ...newLanguageSkillsById.map((skill) => skill.id),
      ],
    },
    competencyV2: {
      sourceId: "competency-content-v2",
      sourceDigest: competencyContentV2Catalogue.manifest.digest,
      paths,
      civilizationLanguages: competencyContentV2CivilizationLanguages.map((row) => ({
        civilizationId: row.civilizationId,
        spokenCompetencyId: row.spokenCompetencyId,
        ...(row.writtenCompetencyId ? { writtenCompetencyId: row.writtenCompetencyId } : {}),
      })),
      writtenCompetencyIds: [...competencyContentV2WrittenLanguageCompetencyIds],
      writtenCompetencyFloors:
        competencyContentV2SocietyLevelAvailability.writtenCompetencyFloors.map((row) => ({
          competencyId: row.competencyId,
          minSocietyLevel: row.minSocietyLevel,
        })),
      groupBounds: groups.map((group) => ({
        groupId: group.id,
        ...combineBounds(competencyContentV2GroupAvailability[group.id]),
      })),
    },
  };
}

export function getCompetencyV2Path(content: CanonicalContent, id: string) {
  return content.competencyV2?.paths.find((path) => path.id === id);
}

export function getCompetencyV2CivilizationLanguage(content: CanonicalContent, id: string) {
  return content.competencyV2?.civilizationLanguages.find((row) => row.civilizationId === id);
}
