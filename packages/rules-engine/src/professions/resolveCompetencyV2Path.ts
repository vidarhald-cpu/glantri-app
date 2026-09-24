import type {
  CompetencyV2CoreRoute,
  CompetencyV2Runtime,
  SkillGroupDefinition,
  SocietyDefinition,
} from "@glantri/domain";

interface V2ContentShape {
  competencyV2?: CompetencyV2Runtime;
  skillGroups: SkillGroupDefinition[];
  societies?: SocietyDefinition[];
}

export interface CompetencyV2PathAvailability {
  pathId: string;
  valid: boolean;
  availableGroupIds: string[];
  availableDirectSkillIds: string[];
  availableSpecializationIds: string[];
  satisfiedCoreRouteIds: string[];
  coreRoutes: CompetencyV2CoreRoute[];
}

export function getSatisfiedCompetencyV2CoreRouteIds(input: {
  coreRoutes: readonly CompetencyV2CoreRoute[];
  groupIds: readonly string[];
  directSkillIds: readonly string[];
  writtenCompetencyIds: readonly string[];
}): string[] {
  const groups = new Set(input.groupIds);
  const directSkills = new Set(input.directSkillIds);
  const written = new Set(input.writtenCompetencyIds);
  return input.coreRoutes
    .filter(
      (core) =>
        core.groupIds.every((id) => groups.has(id)) &&
        core.skillIds.every((id) => directSkills.has(id)) &&
        core.writtenLanguageChoiceCount <= written.size,
    )
    .map((core) => core.id);
}

/** An available path must still satisfy at least one alternative defining core route. */
export function resolveCompetencyV2PathAvailability(input: {
  content: V2ContentShape;
  professionId: string;
  societyId?: string;
  societyLevel?: number;
  socialBand: number;
}): CompetencyV2PathAvailability | undefined {
  const projection = input.content.competencyV2;
  if (!projection) return undefined;
  const path = projection.paths.find((candidate) => candidate.id === input.professionId);
  if (!path) throw new Error(`Unknown V2 Profession path ${input.professionId}.`);
  const societyLevel =
    input.societyLevel ??
    input.content.societies?.find((society) => society.id === input.societyId)?.societyLevel;
  if (!societyLevel || input.socialBand < 1 || input.socialBand > 4) {
    return {
      pathId: path.id,
      valid: false,
      availableGroupIds: [],
      availableDirectSkillIds: [],
      availableSpecializationIds: [],
      satisfiedCoreRouteIds: [],
      coreRoutes: path.coreRoutes,
    };
  }
  const routes = path.routes.filter(
    (route) =>
      (route.minSocietyLevel ?? 1) <= societyLevel &&
      Number((route.minSocialBand ?? "L1").slice(1)) <= input.socialBand,
  );
  const groupIds = [...new Set(routes.flatMap((route) => (route.groupId ? [route.groupId] : [])))];
  const directSkillIds = [
    ...new Set(
      routes.filter((route) => route.kind === "direct").flatMap((route) => route.skillIds),
    ),
  ];
  const directSpecializationIds = [
    ...new Set(
      routes.filter((route) => route.kind === "direct").flatMap((route) => route.specializationIds),
    ),
  ];
  const specializationIds = [
    ...new Set([
      ...directSpecializationIds,
      ...input.content.skillGroups
        .filter((group) => groupIds.includes(group.id))
        .flatMap((group) => group.specializationIds ?? []),
    ]),
  ];
  const writtenCompetencyIds = projection.writtenCompetencyFloors
    .filter((row) => row.minSocietyLevel <= societyLevel)
    .map((row) => row.competencyId);
  const satisfiedCoreRouteIds = getSatisfiedCompetencyV2CoreRouteIds({
    coreRoutes: path.coreRoutes,
    groupIds,
    directSkillIds,
    writtenCompetencyIds,
  });
  return {
    pathId: path.id,
    valid: satisfiedCoreRouteIds.length > 0,
    availableGroupIds: groupIds,
    availableDirectSkillIds: directSkillIds,
    availableSpecializationIds: specializationIds,
    satisfiedCoreRouteIds,
    coreRoutes: path.coreRoutes,
  };
}
