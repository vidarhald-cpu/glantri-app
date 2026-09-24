import type {
  CharacterProgression,
  CompetencyV2CoreRoute,
  CompetencyV2Runtime,
  SkillGroupDefinition,
  SocietyDefinition,
} from "@glantri/domain";

import {
  getSatisfiedCompetencyV2CoreRouteIds,
  resolveCompetencyV2PathAvailability,
} from "../professions/resolveCompetencyV2Path";

interface CoreRouteSelectionContent {
  competencyV2?: CompetencyV2Runtime;
  skillGroups: SkillGroupDefinition[];
  societies?: SocietyDefinition[];
}

export interface ChargenCoreRouteStatus {
  applicableRoutes: CompetencyV2CoreRoute[];
  effectiveRoute?: CompetencyV2CoreRoute;
  isComplete: boolean;
  isSelectionValid: boolean;
  missingGroupIds: string[];
  missingSkillIds: string[];
  missingWrittenLanguageChoices: number;
  requiresSelection: boolean;
  selectedCoreRouteId?: string;
}

/**
 * Resolves the one core route that defines completion without narrowing the wider acquisition
 * union. Availability and completion intentionally use the same canonical route evaluator with
 * different inputs: available content identifies applicable alternatives; persisted purchases
 * determine whether the selected alternative is complete.
 */
export function buildChargenCoreRouteStatus(input: {
  content: CoreRouteSelectionContent;
  professionId?: string;
  progression: CharacterProgression;
  societyId?: string;
  socialBand?: number;
}): ChargenCoreRouteStatus {
  const empty: ChargenCoreRouteStatus = {
    applicableRoutes: [],
    isComplete: true,
    isSelectionValid: true,
    missingGroupIds: [],
    missingSkillIds: [],
    missingWrittenLanguageChoices: 0,
    requiresSelection: false,
    selectedCoreRouteId: input.progression.chargenSelections?.selectedCoreRouteId,
  };

  if (!input.content.competencyV2 || !input.professionId || input.socialBand === undefined) {
    return empty;
  }

  const availability = resolveCompetencyV2PathAvailability({
    content: input.content,
    professionId: input.professionId,
    societyId: input.societyId,
    socialBand: input.socialBand,
  });

  if (!availability?.valid) {
    return { ...empty, isComplete: false, isSelectionValid: false };
  }

  const applicableRouteIds = new Set(availability.satisfiedCoreRouteIds);
  const applicableRoutes = availability.coreRoutes.filter((route) =>
    applicableRouteIds.has(route.id),
  );
  const requiresSelection = applicableRoutes.length > 1;
  const selectedCoreRouteId = input.progression.chargenSelections?.selectedCoreRouteId;
  const selectedRoute = selectedCoreRouteId
    ? applicableRoutes.find((route) => route.id === selectedCoreRouteId)
    : undefined;
  const effectiveRoute = requiresSelection ? selectedRoute : applicableRoutes[0];
  const isSelectionValid = requiresSelection
    ? selectedRoute !== undefined
    : selectedCoreRouteId === undefined || selectedRoute !== undefined;
  const acquiredGroupIds = input.progression.skillGroups
    .filter((group) => group.ranks > 0)
    .map((group) => group.groupId);
  const acquiredSkillIds = input.progression.skills
    .filter((skill) => skill.ranks > 0)
    .map((skill) => skill.skillId);
  const acquiredSkillIdSet = new Set(acquiredSkillIds);
  const acquiredWrittenIds = input.content.competencyV2.writtenCompetencyIds.filter((id) =>
    acquiredSkillIdSet.has(id),
  );
  const completedRouteIds = effectiveRoute
    ? getSatisfiedCompetencyV2CoreRouteIds({
        coreRoutes: [effectiveRoute],
        directSkillIds: acquiredSkillIds,
        groupIds: acquiredGroupIds,
        writtenCompetencyIds: acquiredWrittenIds,
      })
    : [];
  const acquiredGroupIdSet = new Set(acquiredGroupIds);

  return {
    applicableRoutes,
    effectiveRoute,
    isComplete: Boolean(effectiveRoute && completedRouteIds.includes(effectiveRoute.id)),
    isSelectionValid,
    missingGroupIds: effectiveRoute?.groupIds.filter((id) => !acquiredGroupIdSet.has(id)) ?? [],
    missingSkillIds: effectiveRoute?.skillIds.filter((id) => !acquiredSkillIdSet.has(id)) ?? [],
    missingWrittenLanguageChoices: effectiveRoute
      ? Math.max(0, effectiveRoute.writtenLanguageChoiceCount - acquiredWrittenIds.length)
      : 0,
    requiresSelection,
    selectedCoreRouteId,
  };
}
