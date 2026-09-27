import { getCompetencyV2ReferenceSource, type CompetencyV2ReferenceSource } from "@glantri/content";
import { getMeleeCrossTrainingFactor } from "@glantri/rules-engine";

export type SkillReferenceTab = "skills" | "groups" | "professions" | "societies" | "rules";
export type ReferenceLink = { id: string; key: string; name: string };
export type ReferenceBound = { minSocietyLevel: number; minSocialBand: string; reasons: string[] };
export type ReferenceRelationship = {
  source: ReferenceLink;
  target: ReferenceLink;
  mechanism: "Derived grant" | "Melee cross-training";
  factor?: number;
};

/**
 * The reader-facing prose layers #361 publishes onto canonical V2 runtime content.
 *
 * `description` is the FULL Inspector prose and is `undefined` where it has not been authored yet;
 * it is never a copy of `shortDescription`. `shortDescription` is published only for the subset of
 * Learning Groups whose prose is accepted, so a consumer must fall back to the canonical one-line
 * `description` for the rest rather than render an empty summary.
 */
export type ReferenceReaderContent = {
  shortDescription?: string;
  description?: string;
  typicalActivities?: string[];
  boundaries?: string[];
};
/** One canonical Society Level x Social Band availability cell, reflected without reinterpretation. */
export type ReferenceAccessCell = {
  societyLevel: number;
  socialBand: string;
  availableGroupIds: string[];
  validPathIds: string[];
  reachableCompetencyIds: string[];
};
export type ReferenceAccessGrid = {
  authoredCeiling: number;
  societyLevels: number[];
  socialBands: { id: string; name: string }[];
  cells: ReferenceAccessCell[];
};

export type SkillReferenceSkill = ReferenceLink & {
  description: string;
  shortDescription: string;
  type: "Skill" | "Specialization" | "Spoken language" | "Written tradition";
  category: string;
  linkedStats: string[];
  parent?: ReferenceLink & { minimumLevel: number };
  children: ReferenceLink[];
  groups: (ReferenceLink & { membership: "fixed" | "choice" | "specialization" })[];
  directRoutes: (ReferenceLink & { label: string; bound?: ReferenceBound })[];
  writtenFloor?: number;
  languageContexts: {
    civilization: string;
    societyLevel: number;
    spoken: boolean;
    written: boolean;
  }[];
  routeGaps: { level: number; plausibility: string }[];
  availableBands: { level: number; bands: string[] }[];
  relationships: ReferenceRelationship[];
};
export type SkillReferenceGroup = ReferenceLink & {
  /** The established canonical one-line summary. Retained with its existing meaning. */
  description: string;
  readerContent: ReferenceReaderContent;
  fixedSkills: ReferenceLink[];
  selectionSlots: { id: string; label: string; chooseCount: number; candidates: ReferenceLink[] }[];
  specializations: ReferenceLink[];
  professionRoutes: (ReferenceLink & { label: string; bound?: ReferenceBound })[];
  bound?: ReferenceBound;
};
export type SkillReferenceProfession = ReferenceLink & {
  familyId: string;
  familyCode?: string;
  readerContent: ReferenceReaderContent;
  coreAlternatives: {
    id: string;
    label: string;
    groups: ReferenceLink[];
    skills: ReferenceLink[];
    writtenChoiceCount: number;
  }[];
  choiceSlots: {
    group: ReferenceLink;
    label: string;
    chooseCount: number;
    candidates: ReferenceLink[];
  }[];
  routes: {
    id: string;
    label: string;
    kind: "group" | "direct";
    group?: ReferenceLink;
    skills: ReferenceLink[];
    specializations: ReferenceLink[];
    bound?: ReferenceBound;
  }[];
};
export type SkillReferenceSociety = ReferenceLink & {
  level: number;
  description: string;
  civilizations: {
    name: string;
    description: string;
    spokenLanguage: string;
    writtenLanguage?: string;
  }[];
  archSociety?: { name: string; description: string };
};
export type WithdrawnGroup = {
  id: string;
  name: string;
  reason: string;
  successors: ReferenceLink[];
};
export type SkillReferenceModel = {
  skills: SkillReferenceSkill[];
  learningGroups: SkillReferenceGroup[];
  professions: SkillReferenceProfession[];
  societies: SkillReferenceSociety[];
  withdrawnGroups: WithdrawnGroup[];
  grouplessSkills: ReferenceLink[];
  relationships: ReferenceRelationship[];
  authoredCeiling: number;
  access: ReferenceAccessGrid;
  readerContentCoverage: {
    groups: { canonical: number; published: number; awaiting: number };
    families: { canonical: number; published: number; awaiting: number };
    groupsAwaitingProse: { id: string; name: string }[];
  };
  sourceDigest: string;
  inventory: { learningGroups: number; professionPaths: number; professionFamilies: number };
};

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function publicLinks<T extends { id: string; name: string }>(
  values: readonly T[],
): Map<string, ReferenceLink> {
  const counts = new Map<string, number>();
  return new Map(
    values.map((value) => {
      const base = slug(value.name) || "entry";
      const next = (counts.get(base) ?? 0) + 1;
      counts.set(base, next);
      return [
        value.id,
        { id: value.id, key: next === 1 ? base : `${base}-${next}`, name: value.name },
      ];
    }),
  );
}
function required(map: Map<string, ReferenceLink>, id: string): ReferenceLink {
  const found = map.get(id);
  if (!found) throw new Error(`Missing canonical V2 reference destination ${id}.`);
  return found;
}
function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}
/**
 * Carries the published reader layers through unchanged. A missing full `description` stays missing:
 * the Inspector has to be able to say the prose is unpublished instead of showing a summary as prose.
 */
function readerContentOf(value: ReferenceReaderContent | undefined): ReferenceReaderContent {
  return {
    shortDescription: value?.shortDescription,
    description: value?.description,
    typicalActivities: value?.typicalActivities ? [...value.typicalActivities] : undefined,
    boundaries: value?.boundaries ? [...value.boundaries] : undefined,
  };
}

export function buildSkillReferenceModel(
  source: CompetencyV2ReferenceSource = getCompetencyV2ReferenceSource(),
): SkillReferenceModel {
  const competencyLinks = publicLinks([...source.skills, ...source.specializations]);
  const groupLinks = publicLinks(source.groups);
  const professionLinks = publicLinks(source.professions);
  const societyLinks = publicLinks(source.societies);
  const skillById = new Map(source.skills.map((row) => [row.id, row]));
  const specializationById = new Map(source.specializations.map((row) => [row.id, row]));
  const groupById = new Map(source.groups.map((row) => [row.id, row]));
  const familyById = new Map(source.families.map((row) => [row.id, row]));
  const professionById = new Map(source.professions.map((row) => [row.id, row]));
  const familyReaderById = new Map(
    source.families.map((row) => [row.id, { code: row.code, readerContent: row.readerContent }]),
  );
  const categoryById = new Map(source.categories.map((row) => [row.competencyId, row.categoryId]));
  const groupDescriptionById = new Map(
    source.groupDescriptions.map((row) => [row.id, row.description]),
  );
  const writtenFloorById = new Map(
    source.availability.writtenCompetencyFloors.map((row) => [row.competencyId, row]),
  );
  const groupBoundById = new Map(source.availability.groupBounds.map((row) => [row.groupId, row]));
  const civilizationById = new Map(source.civilizations.map((row) => [row.id, row]));
  const societyById = new Map(source.societies.map((row) => [row.id, row]));
  const linkSkill = (id: string) => required(competencyLinks, id);
  const linkGroup = (id: string) => required(groupLinks, id);
  const linkProfession = (id: string) => required(professionLinks, id);

  const boundFor = (
    route: (typeof source.paths)[number]["routes"][number],
    path: (typeof source.paths)[number],
  ): ReferenceBound | undefined => {
    const sources =
      route.kind === "group"
        ? [
            route.groupId ? groupBoundById.get(route.groupId) : undefined,
            source.availability.professionRouteBounds.find(
              (row) =>
                row.professionCode === path.familyCode &&
                row.trackId === path.trackId &&
                row.groupId === route.groupId,
            ),
          ]
        : [
            source.availability.directRouteBounds.find(
              (row) => row.professionCode === path.familyCode && row.trackId === path.trackId,
            ),
          ];
    const reasons = sources.flatMap((row) => (row?.reason ? [row.reason] : []));
    if (!route.minSocietyLevel && !route.minSocialBand && reasons.length === 0) return undefined;
    return {
      minSocietyLevel: route.minSocietyLevel ?? 1,
      minSocialBand: route.minSocialBand ?? "L1",
      reasons,
    };
  };

  const professions: SkillReferenceProfession[] = source.paths
    .map((path) => {
      const definition = professionById.get(path.id);
      if (!definition || !familyById.has(path.familyId))
        throw new Error(`Missing V2 Profession ${path.id}.`);
      const routes = path.routes.map((route) => ({
        id: route.id,
        label: route.label,
        kind: route.kind,
        group: route.groupId ? linkGroup(route.groupId) : undefined,
        skills: route.skillIds.map(linkSkill),
        specializations: route.specializationIds.map(linkSkill),
        bound: boundFor(route, path),
      }));
      const usedGroupIds = [
        ...new Set(path.routes.flatMap((route) => (route.groupId ? [route.groupId] : []))),
      ];
      return {
        ...linkProfession(path.id),
        familyId: path.familyId,
        familyCode: familyReaderById.get(path.familyId)?.code,
        readerContent: readerContentOf(familyReaderById.get(path.familyId)?.readerContent),
        coreAlternatives: path.coreRoutes.map((core) => ({
          id: core.id,
          label: core.label,
          groups: core.groupIds.map(linkGroup),
          skills: core.skillIds.map(linkSkill),
          writtenChoiceCount: core.writtenLanguageChoiceCount,
        })),
        choiceSlots: usedGroupIds.flatMap((groupId) =>
          (groupById.get(groupId)?.selectionSlots ?? []).map((slot) => ({
            group: linkGroup(groupId),
            label: slot.label,
            chooseCount: slot.chooseCount,
            candidates: slot.candidateSkillIds.map(linkSkill),
          })),
        ),
        routes,
      };
    })
    .sort(byName);

  const groups: SkillReferenceGroup[] = source.groups
    .map((group) => {
      const bound = groupBoundById.get(group.id);
      return {
        ...linkGroup(group.id),
        description: groupDescriptionById.get(group.id) ?? group.description ?? "",
        readerContent: readerContentOf(group.readerContent),
        fixedSkills: group.fixedSkillIds.map(linkSkill).sort(byName),
        selectionSlots: group.selectionSlots.map((slot) => ({
          id: slot.id,
          label: slot.label,
          chooseCount: slot.chooseCount,
          candidates: slot.candidateSkillIds.map(linkSkill).sort(byName),
        })),
        specializations: group.specializationIds.map(linkSkill).sort(byName),
        professionRoutes: professions.flatMap((profession) =>
          profession.routes
            .filter((route) => route.group?.id === group.id)
            .map((route) => ({
              ...linkProfession(profession.id),
              label: route.label,
              bound: route.bound,
            })),
        ),
        bound: bound
          ? {
              minSocietyLevel: bound.minSocietyLevel,
              minSocialBand: bound.minSocialBand,
              reasons: [bound.reason],
            }
          : undefined,
      };
    })
    .sort(byName);

  const relationships: ReferenceRelationship[] = [
    ...source.relationships.grants.map((grant) => ({
      source: linkSkill(grant.sourceId),
      target: linkSkill(grant.targetId),
      mechanism: "Derived grant" as const,
      factor: grant.factor,
    })),
    ...source.relationships.meleeSources.flatMap((from) =>
      source.relationships.meleeSources.flatMap((to) => {
        if (from.skillId === to.skillId) return [];
        const factor = getMeleeCrossTrainingFactor({ source: from, target: to });
        return factor > 0
          ? [
              {
                source: linkSkill(from.skillId),
                target: linkSkill(to.skillId),
                mechanism: "Melee cross-training" as const,
                factor,
              },
            ]
          : [];
      }),
    ),
  ];
  const languageContextById = new Map<string, SkillReferenceSkill["languageContexts"]>();
  for (const row of source.civilizationLanguages) {
    const civilization = civilizationById.get(row.civilizationId);
    const level = civilization
      ? societyById.get(civilization.linkedSocietyId)?.societyLevel
      : undefined;
    if (!civilization || !level)
      throw new Error(`Missing V2 language context ${row.civilizationId}.`);
    for (const [id, spoken, written] of [
      [row.spokenCompetencyId, true, false],
      [row.writtenCompetencyId, false, true],
    ] as const) {
      if (!id) continue;
      const entries = languageContextById.get(id) ?? [];
      entries.push({ civilization: civilization.name, societyLevel: level, spoken, written });
      languageContextById.set(id, entries);
    }
  }
  const linkedStats = (id: string, seen = new Set<string>()): string[] => {
    const skill = skillById.get(id);
    if (skill) return skill.linkedStats.map((stat) => stat.toUpperCase());
    if (seen.has(id)) throw new Error(`Cyclic V2 Specialization parent ${id}.`);
    seen.add(id);
    const specialization = specializationById.get(id);
    if (!specialization) throw new Error(`Missing V2 Specialization parent ${id}.`);
    return linkedStats(specialization.parentId, seen);
  };
  const skills: SkillReferenceSkill[] = [...source.skills, ...source.specializations]
    .map((entry) => {
      const specialization = specializationById.get(entry.id);
      const runtimeSkill = skillById.get(entry.id);
      const kind = runtimeSkill?.competencyType;
      const floor = writtenFloorById.get(entry.id);
      const id = entry.id;
      return {
        ...linkSkill(id),
        description: entry.description ?? runtimeSkill?.shortDescription ?? "",
        shortDescription: runtimeSkill?.shortDescription ?? entry.description ?? "",
        type: (specialization
          ? "Specialization"
          : kind === "spoken-language"
            ? "Spoken language"
            : kind === "written-tradition"
              ? "Written tradition"
              : "Skill") as SkillReferenceSkill["type"],
        category: categoryById.get(id) ?? "other",
        linkedStats: linkedStats(id),
        parent: specialization
          ? {
              ...linkSkill(specialization.parentId),
              minimumLevel: specialization.minimumParentLevel,
            }
          : undefined,
        children: source.specializations
          .filter((row) => row.parentId === id)
          .map((row) => linkSkill(row.id))
          .sort(byName),
        groups: groups.flatMap((group) => [
          ...group.fixedSkills
            .filter((row) => row.id === id)
            .map(() => ({ ...linkGroup(group.id), membership: "fixed" as const })),
          ...group.selectionSlots
            .filter((slot) => slot.candidates.some((row) => row.id === id))
            .map(() => ({ ...linkGroup(group.id), membership: "choice" as const })),
          ...group.specializations
            .filter((row) => row.id === id)
            .map(() => ({ ...linkGroup(group.id), membership: "specialization" as const })),
        ]),
        directRoutes: professions.flatMap((profession) =>
          profession.routes
            .filter(
              (route) =>
                route.kind === "direct" &&
                [...route.skills, ...route.specializations].some((row) => row.id === id),
            )
            .map((route) => ({
              ...linkProfession(profession.id),
              label: route.label,
              bound: route.bound,
            })),
        ),
        writtenFloor: floor?.minSocietyLevel,
        languageContexts: languageContextById.get(id) ?? [],
        routeGaps: source.availability.routeGaps
          .filter((row) => row.skillId === id)
          .map((row) => ({ level: row.unreachableAtSocietyLevel, plausibility: row.plausibility })),
        availableBands: source.availability.cells
          .filter((cell) => cell.societyLevel <= source.availability.authoredCeiling)
          .reduce<{ level: number; bands: string[] }[]>((rows, cell) => {
            if (!rows.some((row) => row.level === cell.societyLevel))
              rows.push({ level: cell.societyLevel, bands: [] });
            if (
              [
                ...cell.reachableBaseSkillIds,
                ...cell.reachableSpecializationIds,
                ...cell.reachableWrittenCompetencyIds,
              ].includes(id)
            )
              rows.find((row) => row.level === cell.societyLevel)!.bands.push(cell.socialBand);
            return rows;
          }, []),
        relationships: relationships.filter((row) => row.source.id === id || row.target.id === id),
      };
    })
    .sort(byName);
  const societies: SkillReferenceSociety[] = source.societies
    .map((society) => ({
      ...required(societyLinks, society.id),
      level: society.societyLevel,
      description: society.description,
      civilizations: source.civilizations
        .filter((row) => row.linkedSocietyId === society.id)
        .map((row) => ({
          name: row.name,
          description: row.description,
          spokenLanguage: row.spokenLanguageName,
          writtenLanguage: row.writtenLanguageName ?? undefined,
        }))
        .sort(byName),
      archSociety: source.archSocieties.find((row) => row.id === `arch-society:${society.id}`),
    }))
    .sort((a, b) => a.level - b.level || byName(a, b));
  const groupMembershipIds = new Set(
    groups
      .flatMap((group) => [
        ...group.fixedSkills,
        ...group.selectionSlots.flatMap((slot) => slot.candidates),
      ])
      .map((row) => row.id),
  );
  return {
    skills,
    learningGroups: groups,
    professions,
    societies,
    relationships,
    withdrawnGroups: source.removedGroups.map((row) => ({
      id: row.id,
      name: row.name,
      reason: row.reason,
      successors: row.replacedBy.map(linkGroup),
    })),
    grouplessSkills: skills
      .filter((row) => row.type === "Skill" && !groupMembershipIds.has(row.id))
      .map((row) => ({ id: row.id, key: row.key, name: row.name })),
    authoredCeiling: source.availability.authoredCeiling,
    access: {
      authoredCeiling: source.availability.authoredCeiling,
      societyLevels: [...new Set(source.availability.cells.map((cell) => cell.societyLevel))].sort(
        (a, b) => a - b,
      ),
      socialBands: source.availability.socialBands.map((band) => ({
        id: band.id,
        name: band.name,
      })),
      cells: source.availability.cells.map((cell) => ({
        societyLevel: cell.societyLevel,
        socialBand: cell.socialBand,
        availableGroupIds: [...cell.availableGroupIds],
        validPathIds: [...cell.validPathIds],
        /* The canonical reachable competencies of this cell, kept as one set because a reader asks
           "can this be learned here", not "which of three canonical arrays listed it". */
        reachableCompetencyIds: [
          ...cell.reachableBaseSkillIds,
          ...cell.reachableSpecializationIds,
          ...cell.reachableWrittenCompetencyIds,
        ],
      })),
    },
    readerContentCoverage: {
      groups: { ...source.readerContentCoverage.groups },
      families: { ...source.readerContentCoverage.families },
      groupsAwaitingProse: source.readerContentCoverage.groupsAwaitingProse.map((row) => ({
        id: row.id,
        name: row.name,
      })),
    },
    sourceDigest: source.sourceDigest,
    inventory: {
      learningGroups: groups.length,
      professionPaths: professions.length,
      professionFamilies: source.families.length,
    },
  };
}
