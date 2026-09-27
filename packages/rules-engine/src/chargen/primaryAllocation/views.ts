import type {
  CharacterProgression,
  GlantriCharacteristicKey,
  RolledCharacterProfile,
  SkillDefinition,
} from "@glantri/domain";
import { getCharacterSkillKey } from "@glantri/domain";

import { calculateGroupLevel } from "../../skills/calculateGroupLevel";
import { calculateSpecializationLevel } from "../../skills/calculateSpecializationLevel";
import {
  resolveRelationshipMinimumGrants,
  type SkillRelationshipSourceType,
} from "../../skills/deriveSkillRelationships";
import { getActiveSkillGroupIds } from "../../skills/getActiveSkillGroupIds";
import { selectBestSkillGroupContribution } from "../../skills/selectBestSkillGroupContribution";
import {
  syncChargenLanguageSkillRows,
  syncChargenMotherTongueSkillRow,
  syncChargenSelectionSkillRows,
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
  recalculateProgression,
} from "./_helpers";
import {
  calculateChargenGroupBundle,
  getActiveGroupSkillCost,
  getFlexiblePoolTotal,
  getOrdinaryPoolTotal,
} from "./costs";

export interface ChargenGroupView {
  gms: number;
  groupId: string;
  groupLevel: number;
  /**
   * Price of one further rank in this Learning Group, from the shared canonical acquisition
   * arithmetic. `0` means the Group's whole contribution is already supplied by a stronger
   * Group or a relationship floor, so a further rank would buy no competence.
   */
  marginalPurchaseCost: number;
  name: string;
  primaryRanks: number;
  secondaryRanks: number;
  totalRanks: number;
  /**
   * Weighted useful group competence this Learning Group actually delivers, after the
   * strongest-Group and relationship-floor rules. `0` means the membership is fully
   * suppressed. Presentation of this figure is Forgejo #372 section 7.
   */
  usefulWeightedIncrement: number;
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
  groupId?: string;
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
      skillGroups: input.content.skillGroups,
    }),
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
    ranks: group.ranks,
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
      skillGroups: input.content.skillGroups,
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
          sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .filter(isDefined),
  );
}

export function buildChargenDraftView(input: {
  civilizationId?: string;
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  skillLinkedStats?: Partial<Record<GlantriCharacteristicKey, number>>;
  societyId?: string;
  societyLevel?: number;
}): ChargenDraftView {
  // Saved target definitions keep group-free and nested competencies readable
  // when a character is reopened with the unchanged legacy content bundle.
  const savedSkills = input.progression.skills.flatMap((row) =>
    row.targetDefinition ? [row.targetDefinition] : [],
  );
  const savedSpecializations = input.progression.specializations.flatMap((row) =>
    row.targetDefinition ? [row.targetDefinition] : [],
  );
  const savedSkillIds = new Set(savedSkills.map(({ id }) => id));
  const savedSpecializationIds = new Set(savedSpecializations.map(({ id }) => id));
  input = {
    ...input,
    content: {
      ...input.content,
      skills: [...input.content.skills.filter(({ id }) => !savedSkillIds.has(id)), ...savedSkills],
      specializations: [
        ...input.content.specializations.filter(({ id }) => !savedSpecializationIds.has(id)),
        ...savedSpecializations,
      ],
    },
  };
  const selectionSyncedProgression = recalculateProgression(
    syncChargenSelectionSkillRows({
      content: input.content,
      progression: recalculateProgression(input.progression),
    }),
  );
  const languageSyncedProgression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression: selectionSyncedProgression,
      societyId: input.societyId,
    }),
  );
  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression: languageSyncedProgression,
    societyId: input.societyId,
    societyLevel: input.societyLevel,
  });
  const progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: education.theoreticalSkillCount,
      progression: languageSyncedProgression,
    }),
  );

  // Carry the useful-increment figure from the shared canonical Learning Group arithmetic
  // into the view model (Forgejo #381). What the UI renders from it is Forgejo #372 section 7.
  const groupBundle = calculateChargenGroupBundle({ content: input.content, progression });
  const groups = progression.skillGroups
    .map((group) => {
      const definition = input.content.skillGroups.find((item) => item.id === group.groupId);

      return {
        gms: group.gms,
        groupId: group.groupId,
        groupLevel: calculateGroupLevel({
          gms: group.gms,
          ranks: group.ranks,
        }),
        marginalPurchaseCost:
          getActiveGroupSkillCost({
            content: input.content,
            groupId: group.groupId,
            progression,
          }).cost ?? 0,
        name: definition?.name ?? group.groupId,
        primaryRanks: group.primaryRanks,
        secondaryRanks: group.secondaryRanks,
        totalRanks: group.ranks,
        usefulWeightedIncrement:
          groupBundle.weightedUsefulIncrementByGroupId.get(group.groupId) ?? 0,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const groupViewById = new Map(groups.map((group) => [group.groupId, group]));
  const relationshipGrants = resolveRelationshipMinimumGrants({
    content: input.content,
    progression,
  });

  const skills = input.content.skills
    .filter(
      ({ id }) =>
        !input.content.chargenCatalogue ||
        input.content.chargenCatalogue.skillIds.includes(id) ||
        progression.skills.some(({ skillId }) => skillId === id),
    )
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
        skill: definition,
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

      if (!resolvedGroupId && !("catalogueSource" in definition)) {
        return [];
      }

      return skillRows.map((skill) => {
        const specificSkillLevel =
          (skill?.grantedRanks ?? 0) + (skill?.primaryRanks ?? 0) + (skill?.secondaryRanks ?? 0);
        const rowRelationshipGrantedLevel = skill?.languageName ? 0 : relationshipGrantedLevel;
        const relationshipGrantedPreviewLevel = skill?.languageName
          ? 0
          : (relationshipGrant?.previewAdditionalRanks ?? 0);
        const shouldSurfaceRelationshipSource =
          rowRelationshipGrantedLevel > 0 || relationshipGrantedPreviewLevel > 0;
        const effectiveSkillNumber =
          groupContribution + specificSkillLevel + rowRelationshipGrantedLevel;
        const linkedStatAverage = getLinkedStatAverage(
          input.profile,
          definition,
          input.skillLinkedStats,
        );
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
              ? (relationshipGrant?.sourceSkillId ?? skill?.relationshipGrantSourceSkillId)
              : undefined,
          relationshipSourceSkillName: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceSkillName ?? skill?.relationshipGrantSourceName)
              : undefined,
          relationshipSourceType: skill?.languageName
            ? undefined
            : shouldSurfaceRelationshipSource
              ? (relationshipGrant?.sourceType ?? skill?.relationshipGrantSourceType)
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
            skillId: definition.id,
          }),
          sourceTag: skill?.sourceTag,
          specificSkillLevel,
          totalSkill: effectiveSkillNumber + linkedStatAverage,
        };

        return view;
      });
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        (left.languageName ?? "").localeCompare(right.languageName ?? ""),
    );

  const specializations = progression.specializations
    .map((specialization) => specialization.specializationId)
    .concat(
      input.content.specializations
        .filter(
          (definition) =>
            (relationshipGrants.bySpecializationId.get(definition.id)?.relationshipGrantedRanks ??
              0) > 0,
        )
        .map((definition) => definition.id),
    )
    .filter(
      (specializationId, index, specializationIds) =>
        specializationIds.indexOf(specializationId) === index,
    )
    .map((specializationId) => {
      const progressionSpecialization = progression.specializations.find(
        (specialization) => specialization.specializationId === specializationId,
      );
      const definition = getSpecializationById(input.content, specializationId);
      const parentSkillDefinition = definition
        ? getSkillById(input.content, definition.skillId)
        : undefined;
      const parentSpecializationDefinition = definition
        ? getSpecializationById(input.content, definition.skillId)
        : undefined;
      // No Learning Group of the parent Skill is resolved here. Rule decision 0010 ruling 3
      // clauses 1, 4, 5 and 6 keep Group XP on the Group's base Skills, so a Specialization
      // takes nothing from any Group — including the one that teaches it.

      if (!definition || (!parentSkillDefinition && !parentSpecializationDefinition)) {
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
      const specializationLevel = calculateSpecializationLevel({
        ownedSpecializationXp: progressionSpecialization?.secondaryRanks ?? 0,
        relationshipGrantedXp: relationshipGrantedSpecializationLevel,
      });

      const view: ChargenSpecializationView = {
        effectiveSpecializationNumber: specializationLevel,
        relationshipGrantedPreviewLevel,
        relationshipGrantedSourceSkillId: shouldSurfaceRelationshipSource
          ? (relationshipGrant?.sourceSkillId ??
            progressionSpecialization?.relationshipGrantSourceSkillId)
          : undefined,
        relationshipGrantedSourceSkillName: shouldSurfaceRelationshipSource
          ? (relationshipGrant?.sourceSkillName ??
            progressionSpecialization?.relationshipGrantSourceName)
          : undefined,
        relationshipGrantedSourceType: shouldSurfaceRelationshipSource
          ? (relationshipGrant?.sourceType ?? persistedRelationshipSourceType)
          : undefined,
        relationshipGrantedSpecializationLevel,
        name: definition.name,
        parentSkillName: (parentSkillDefinition ?? parentSpecializationDefinition)!.name,
        secondaryRanks: progressionSpecialization?.secondaryRanks ?? 0,
        specializationId: definition.id,
        specializationLevel,
      };

      return view;
    })
    .filter(isDefined)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    education,
    groups,
    primaryPoolAvailable: Math.max(
      0,
      getOrdinaryPoolTotal(progression) - progression.primaryPoolSpent,
    ),
    secondaryPoolAvailable: Math.max(
      0,
      getFlexiblePoolTotal(input.profile, progression) - progression.secondaryPoolSpent,
    ),
    skills,
    specializations,
    totalSkillPointsInvested: progression.primaryPoolSpent + progression.secondaryPoolSpent,
  };
}
