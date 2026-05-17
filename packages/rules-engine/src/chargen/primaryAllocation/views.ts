import type {
  CharacterProgression,
  RolledCharacterProfile,
  SkillDefinition
} from "@glantri/domain";
import { getCharacterSkillKey } from "@glantri/domain";

import { calculateGroupLevel } from "../../skills/calculateGroupLevel";
import { calculateSpecializationLevel } from "../../skills/calculateSpecializationLevel";
import {
  resolveRelationshipMinimumGrants,
  type SkillRelationshipSourceType
} from "../../skills/deriveSkillRelationships";
import { getActiveSkillGroupIds } from "../../skills/getActiveSkillGroupIds";
import { selectBestSkillGroupContribution } from "../../skills/selectBestSkillGroupContribution";
import {
  syncChargenLanguageSkillRows,
  syncChargenMotherTongueSkillRow,
  syncChargenSelectionSkillRows
} from "../selectionStructure";
import {
  type CanonicalContentShape,
  buildEducationBreakdown,
  getBestGroupIdByDefinitionOrder,
  getLinkedStatAverage,
  getProgressionSkillRows,
  getSkillById,
  getSkillDefinitionGroupIds,
  getSkillGroupDefinition,
  getSpecializationById,
  hasLiteracy,
  isDefined,
  recalculateProgression
} from "./_helpers";
import { getFlexiblePoolTotal, getOrdinaryPoolTotal } from "./costs";

export interface ChargenGroupView {
  gms: number;
  groupId: string;
  groupLevel: number;
  name: string;
  primaryRanks: number;
  secondaryRanks: number;
  totalRanks: number;
}

export interface ChargenSkillView {
  category: "ordinary" | "secondary";
  categoryId?: SkillDefinition["categoryId"];
  contributingGroupId?: string;
  relationshipGrantedPreviewLevel?: number;
  relationshipGrantedSkillLevel?: number;
  relationshipSourceSkillId?: string;
  relationshipSourceSkillName?: string;
  relationshipSourceType?: SkillRelationshipSourceType;
  // Canonical workbook-equivalent combat skill XP. This is the full skill XP
  // used by combat math, combining the best contributing group with direct
  // skill ranks, before any linked-stat average is added.
  effectiveSkillNumber: number;
  groupId: string;
  groupIds: string[];
  groupLevel: number;
  languageName?: string;
  linkedStatAverage: number;
  literacyWarning?: string;
  name: string;
  primaryRanks: number;
  requiresLiteracy: SkillDefinition["requiresLiteracy"];
  secondaryRanks: number;
  skillId: string;
  skillKey: string;
  sourceTag?: import("@glantri/domain").CharacterSkill["sourceTag"];
  specificSkillLevel: number;
  totalSkill: number;
}

export interface ChargenSpecializationView {
  relationshipGrantedPreviewLevel?: number;
  relationshipGrantedSourceSkillId?: string;
  relationshipGrantedSourceSkillName?: string;
  relationshipGrantedSourceType?: "specialization-bridge-parent";
  relationshipGrantedSpecializationLevel?: number;
  effectiveSpecializationNumber: number;
  name: string;
  parentSkillName: string;
  secondaryRanks: number;
  specializationId: string;
  specializationLevel: number;
}

export interface ChargenDraftView {
  education: import("../../education/calculateEducation").EducationBreakdown;
  groups: ChargenGroupView[];
  primaryPoolAvailable: number;
  secondaryPoolAvailable: number;
  skills: ChargenSkillView[];
  specializations: ChargenSpecializationView[];
  totalSkillPointsInvested: number;
}

export function getCombatSkillXp(skill: Pick<ChargenSkillView, "effectiveSkillNumber">): number {
  return skill.effectiveSkillNumber;
}

export function getChargenSkillContributionForGroup(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): number {
  const progression = recalculateProgression(structuredClone(input.progression));
  const activeGroupIds = new Set(
    getActiveSkillGroupIds({
      progression,
      skill: input.skill,
      skillGroups: input.content.skillGroups
    })
  );

  if (!activeGroupIds.has(input.groupId)) {
    return 0;
  }

  const group = progression.skillGroups.find((candidate) => candidate.groupId === input.groupId);

  if (!group || group.ranks <= 0) {
    return 0;
  }

  return calculateGroupLevel({
    gms: group.gms,
    ranks: group.ranks
  });
}

function getBestActiveGroupContribution(input: {
  content: CanonicalContentShape;
  groupViewById: Map<string, ChargenGroupView>;
  progression: CharacterProgression;
  skill: SkillDefinition;
}):
  | {
      groupId: string;
      groupLevel: number;
      name: string;
      sortOrder: number;
    }
  | undefined {
  return selectBestSkillGroupContribution(
    getActiveSkillGroupIds({
      progression: input.progression,
      skill: input.skill,
      skillGroups: input.content.skillGroups
    })
      .map((groupId) => {
        const groupView = input.groupViewById.get(groupId);
        const groupDefinition = getSkillGroupDefinition(input.content, groupId);

        if (!groupView) {
          return null;
        }

        return {
          groupId,
          groupLevel: groupView.groupLevel,
          name: groupView.name,
          sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
        };
      })
      .filter(isDefined)
  );
}

export function buildChargenDraftView(input: {
  civilizationId?: string;
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel?: number;
}): ChargenDraftView {
  const selectionSyncedProgression = recalculateProgression(
    syncChargenSelectionSkillRows({
      content: input.content,
      progression: recalculateProgression(input.progression)
    })
  );
  const languageSyncedProgression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression: selectionSyncedProgression,
      societyId: input.societyId
    })
  );
  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression: languageSyncedProgression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  const progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: education.theoreticalSkillCount,
      progression: languageSyncedProgression
    })
  );

  const groups = progression.skillGroups
    .map((group) => {
      const definition = input.content.skillGroups.find((item) => item.id === group.groupId);

      return {
        gms: group.gms,
        groupId: group.groupId,
        groupLevel: calculateGroupLevel({
          gms: group.gms,
          ranks: group.ranks
        }),
        name: definition?.name ?? group.groupId,
        primaryRanks: group.primaryRanks,
        secondaryRanks: group.secondaryRanks,
        totalRanks: group.ranks
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const groupViewById = new Map(groups.map((group) => [group.groupId, group]));
  const relationshipGrants = resolveRelationshipMinimumGrants({
    content: input.content,
    progression
  });

  const skills = input.content.skills
    .flatMap((definition) => {
      if (definition.specializationOfSkillId) {
        return [];
      }

      const progressionSkillRows = getProgressionSkillRows(progression, definition.id);
      const groupIds = getSkillDefinitionGroupIds(definition);
      const bestContributingGroup = getBestActiveGroupContribution({
        content: input.content,
        groupViewById,
        progression,
        skill: definition
      });
      const fallbackGroupId = getBestGroupIdByDefinitionOrder(input.content, groupIds);
      const resolvedGroupId = bestContributingGroup?.groupId ?? fallbackGroupId;
      const groupContribution = bestContributingGroup?.groupLevel ?? 0;
      const relationshipGrant = relationshipGrants.bySkillId.get(definition.id);
      const relationshipGrantedLevel = relationshipGrant?.relationshipGrantedRanks ?? 0;
      const skillRows =
        progressionSkillRows.length > 0
          ? progressionSkillRows
          : groupContribution > 0 || relationshipGrantedLevel > 0
            ? [undefined]
            : [];

      if (!resolvedGroupId) {
        return [];
      }

      return skillRows.map((skill) => {
        const specificSkillLevel =
          (skill?.grantedRanks ?? 0) + (skill?.primaryRanks ?? 0) + (skill?.secondaryRanks ?? 0);
        const rowRelationshipGrantedLevel = skill?.languageName ? 0 : relationshipGrantedLevel;
        const relationshipGrantedPreviewLevel = skill?.languageName
          ? 0
          : relationshipGrant?.previewAdditionalRanks ?? 0;
        const shouldSurfaceRelationshipSource =
          rowRelationshipGrantedLevel > 0 || relationshipGrantedPreviewLevel > 0;
        const effectiveSkillNumber =
          groupContribution + specificSkillLevel + rowRelationshipGrantedLevel;
        const linkedStatAverage = getLinkedStatAverage(input.profile, definition);
        const literacyWarning =
          definition.requiresLiteracy === "recommended" && !hasLiteracy(progression)
            ? "Literacy recommended"
            : undefined;

        const view: ChargenSkillView = {
          category: skill?.category ?? definition.category,
          categoryId: skill?.categoryId ?? definition.categoryId,
          contributingGroupId: bestContributingGroup?.groupId,
          relationshipGrantedPreviewLevel,
          relationshipGrantedSkillLevel: rowRelationshipGrantedLevel,
          relationshipSourceSkillId: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceSkillId ??
                skill?.relationshipGrantSourceSkillId)
              : undefined,
          relationshipSourceSkillName: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceSkillName ??
                skill?.relationshipGrantSourceName)
              : undefined,
          relationshipSourceType: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceType ??
                skill?.relationshipGrantSourceType)
              : undefined,
          effectiveSkillNumber,
          groupId: resolvedGroupId,
          groupIds,
          groupLevel: groupContribution,
          languageName: skill?.languageName,
          linkedStatAverage,
          literacyWarning,
          name: definition.name,
          primaryRanks: skill?.primaryRanks ?? 0,
          requiresLiteracy: definition.requiresLiteracy,
          secondaryRanks: skill?.secondaryRanks ?? 0,
          skillId: definition.id,
          skillKey: getCharacterSkillKey({
            languageName: skill?.languageName,
            skillId: definition.id
          }),
          sourceTag: skill?.sourceTag,
          specificSkillLevel,
          totalSkill: effectiveSkillNumber + linkedStatAverage
        };

        return view;
      });
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        (left.languageName ?? "").localeCompare(right.languageName ?? "")
    );

  const specializations = progression.specializations
    .map((specialization) => specialization.specializationId)
    .concat(
      input.content.specializations
        .filter(
          (definition) =>
            (relationshipGrants.bySpecializationId.get(definition.id)?.relationshipGrantedRanks ??
              0) > 0
        )
        .map((definition) => definition.id)
    )
    .filter((specializationId, index, specializationIds) => specializationIds.indexOf(specializationId) === index)
    .map((specializationId) => {
      const progressionSpecialization = progression.specializations.find(
        (specialization) => specialization.specializationId === specializationId
      );
      const definition = getSpecializationById(input.content, specializationId);
      const parentSkillDefinition = definition
        ? getSkillById(input.content, definition.skillId)
        : undefined;
      const groupView = parentSkillDefinition
        ? selectBestSkillGroupContribution(
            getActiveSkillGroupIds({
              progression,
              skill: parentSkillDefinition,
              skillGroups: input.content.skillGroups
            })
              .map((groupId) => {
                const groupView = groupViewById.get(groupId);
                const groupDefinition = getSkillGroupDefinition(input.content, groupId);

                if (!groupView) {
                  return null;
                }

                return {
                  groupId,
                  groupLevel: groupView.groupLevel,
                  name: groupView.name,
                  sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
                };
              })
              .filter(isDefined)
          )
        : undefined;

      if (!definition || !parentSkillDefinition) {
        return null;
      }

      const relationshipGrant = relationshipGrants.bySpecializationId.get(definition.id);
      const relationshipGrantedSpecializationLevel =
        relationshipGrant?.relationshipGrantedRanks ?? 0;
      const relationshipGrantedPreviewLevel = relationshipGrant?.previewAdditionalRanks ?? 0;
      const shouldSurfaceRelationshipSource =
        relationshipGrantedSpecializationLevel > 0 || relationshipGrantedPreviewLevel > 0;
      const persistedRelationshipSourceType =
        progressionSpecialization?.relationshipGrantSourceType === "specialization-bridge-parent"
          ? progressionSpecialization.relationshipGrantSourceType
          : undefined;
      const specializationLevel =
        (progressionSpecialization?.secondaryRanks ?? 0) +
        relationshipGrantedSpecializationLevel;

      const view: ChargenSpecializationView = {
        effectiveSpecializationNumber: calculateSpecializationLevel({
          groupLevel: groupView?.groupLevel ?? 0,
          specializationLevel
        }),
        relationshipGrantedPreviewLevel,
        relationshipGrantedSourceSkillId:
          shouldSurfaceRelationshipSource
            ? (relationshipGrant?.sourceSkillId ??
              progressionSpecialization?.relationshipGrantSourceSkillId)
            : undefined,
        relationshipGrantedSourceSkillName:
          shouldSurfaceRelationshipSource
            ? (relationshipGrant?.sourceSkillName ??
              progressionSpecialization?.relationshipGrantSourceName)
            : undefined,
        relationshipGrantedSourceType:
          shouldSurfaceRelationshipSource
            ? relationshipGrant?.sourceType ?? persistedRelationshipSourceType
            : undefined,
        relationshipGrantedSpecializationLevel,
        name: definition.name,
        parentSkillName: parentSkillDefinition.name,
        secondaryRanks: progressionSpecialization?.secondaryRanks ?? 0,
        specializationId: definition.id,
        specializationLevel
      };

      return view;
    })
    .filter(isDefined)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    education,
    groups,
    primaryPoolAvailable: Math.max(0, getOrdinaryPoolTotal(progression) - progression.primaryPoolSpent),
    secondaryPoolAvailable: Math.max(
      0,
      getFlexiblePoolTotal(input.profile, progression) - progression.secondaryPoolSpent
    ),
    skills,
    specializations,
    totalSkillPointsInvested: progression.primaryPoolSpent + progression.secondaryPoolSpent
  };
}
