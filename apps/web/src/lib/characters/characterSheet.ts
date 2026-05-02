import {
  getCharacterSkillKey,
  getSkillGroupIds,
  type CharacterBuild,
  type GlantriCharacteristicBlock,
  type GlantriCharacteristicKey,
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type SkillDefinition,
  type SkillSpecialization
} from "@glantri/domain";
import {
  getCharacteristicGm,
  getResolvedProfileStats,
  selectBestSkillGroupContribution,
  type CharacterSheetSummary
} from "@glantri/rules-engine";

import { getPlayerFacingSkillBucket, groupRowsBySkillType } from "../chargen/chargenBrowse";
import { formatDerivedSkillSourceLabel } from "./derivedSkillLabels";

export interface CharacterSheetContentShape {
  specializations: SkillSpecialization[];
  skillGroups: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
  skills: SkillDefinition[];
}

export interface CharacterSheetSkillRow {
  avgStats: number;
  grantedSourceLabel: string | undefined;
  grantedXp: number;
  skillGroupXp: number;
  skillId: string;
  skillKey: string;
  skillName: string;
  skillType: ReturnType<typeof getPlayerFacingSkillBucket>;
  skillXp: number;
  stats: string;
  totalSkillLevel: number;
  totalXp: number;
}

export interface CharacterSheetSpecializationRow {
  grantedSourceLabel: string | undefined;
  grantedXp: number;
  parentSkillName: string;
  specializationId: string;
  specializationName: string;
  total: number;
  xp: number;
}

export const characterSheetStatsTableColumns = [
  "Stat",
  "Stats die roll",
  "Original",
  "Current",
  "GM"
] as const;

export const characterSheetSkillsTableColumns = [
  "Skill",
  "Stats",
  "Avg stats",
  "Group XP",
  "Skill XP",
  "Derived XP",
  "Total XP",
  "Total skill level"
] as const;

export const characterSheetSpecializationsTableColumns = [
  "Specialization",
  "Parent skill",
  "Specialization XP",
  "Derived XP",
  "Total"
] as const;

export interface CharacterSheetProfileStatRow {
  currentValue: number;
  gmValue: number;
  label: string;
  originalValue: number;
  stat: GlantriCharacteristicKey;
  statsDieRollValue: number;
}

function sortSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((left, right) => left.sortOrder - right.sortOrder);
}

function formatSkillStats(skill: SkillDefinition): string {
  return [...new Set(skill.linkedStats)].map((stat) => stat.toUpperCase()).join(" / ");
}

function getSkillLinkedStatAverage(
  profile: CharacterBuild["profile"],
  skill: SkillDefinition
): number {
  const total = skill.linkedStats.reduce(
    (sum, stat) => sum + (profile.rolledStats[stat as GlantriCharacteristicKey] ?? 0),
    0
  );

  return Math.floor(total / skill.linkedStats.length);
}

export function buildCharacterSheetProfileStatRows(
  build: Pick<CharacterBuild, "profile">
): CharacterSheetProfileStatRow[] {
  const resolvedStats = getResolvedProfileStats(build.profile) ?? build.profile.rolledStats;

  return glantriCharacteristicOrder.map((stat) => {
    const statsDieRollValue = build.profile.rolledStats[stat];
    const originalValue = resolvedStats[stat] ?? statsDieRollValue;
    const currentValue = originalValue;
    const currentStatsForGm = {
      ...resolvedStats,
      [stat]: currentValue
    } as GlantriCharacteristicBlock;

    return {
      currentValue,
      gmValue: getCharacteristicGm(stat, currentStatsForGm),
      label: glantriCharacteristicLabels[stat],
      originalValue,
      stat,
      statsDieRollValue
    };
  });
}

export function buildCharacterSheetSkillRows(input: {
  build: CharacterBuild;
  content: CharacterSheetContentShape;
  sheetSummary: CharacterSheetSummary;
}): Array<{
  bucketId: ReturnType<typeof getPlayerFacingSkillBucket>;
  label: string;
  rows: CharacterSheetSkillRow[];
}> {
  const rows = sortSkills(input.content.skills)
    .flatMap((skill) => {
      if (skill.specializationOfSkillId) {
        return [];
      }

      const matchingViews = input.sheetSummary.draftView.skills.filter((item) => item.skillId === skill.id);
      const bestContributingGroup = selectBestSkillGroupContribution(
        getSkillGroupIds(skill)
          .map((groupId) => {
            const groupView = input.sheetSummary.draftView.groups.find((group) => group.groupId === groupId);
            const groupDefinition = input.content.skillGroups.find((group) => group.id === groupId);

            if (!groupView || groupView.groupLevel <= 0) {
              return null;
            }

            return {
              groupId,
              groupLevel: groupView.groupLevel,
              name: groupDefinition?.name ?? groupId,
              sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
            };
          })
          .filter((group): group is NonNullable<typeof group> => group !== null)
      );

      return matchingViews
        .map((skillView) => {
          const skillGroupXp = bestContributingGroup?.groupLevel ?? skillView.groupLevel ?? 0;
          const skillXp = skillView.specificSkillLevel ?? 0;
          const grantedXp = skillView.relationshipGrantedSkillLevel ?? 0;
          const totalXp = skillView.effectiveSkillNumber ?? skillGroupXp + skillXp + grantedXp;

          if (totalXp <= 0) {
            return null;
          }

          return {
            avgStats:
              skillView.linkedStatAverage ?? getSkillLinkedStatAverage(input.build.profile, skill),
            grantedSourceLabel: formatDerivedSkillSourceLabel({
              sourceSkillName: skillView.relationshipSourceSkillName,
              sourceType: skillView.relationshipSourceType
            }),
            grantedXp,
            skillGroupXp,
            skillId: skill.id,
            skillKey: getCharacterSkillKey({
              languageName: skillView.languageName,
              skillId: skill.id
            }),
            skillName: skillView.languageName ? `${skill.name} (${skillView.languageName})` : skill.name,
            skillType: getPlayerFacingSkillBucket(skill),
            skillXp,
            stats: formatSkillStats(skill),
            totalSkillLevel:
              skillView.totalSkill ??
              getSkillLinkedStatAverage(input.build.profile, skill) + totalXp,
            totalXp
          } satisfies CharacterSheetSkillRow;
        })
        .filter((row): row is CharacterSheetSkillRow => row !== null);
    });

  return groupRowsBySkillType(rows);
}

export function buildCharacterSheetSpecializationRows(input: {
  content: Pick<CharacterSheetContentShape, "specializations">;
  sheetSummary: CharacterSheetSummary;
}): CharacterSheetSpecializationRow[] {
  return input.sheetSummary.draftView.specializations
    .map((specializationView) => {
      const definition = input.content.specializations.find(
        (specialization) => specialization.id === specializationView.specializationId
      );

      if (!definition) {
        return null;
      }

      return {
        grantedSourceLabel: formatDerivedSkillSourceLabel({
          sourceSkillName: specializationView.relationshipGrantedSourceSkillName,
          sourceType: specializationView.relationshipGrantedSourceType
        }),
        grantedXp: specializationView.relationshipGrantedSpecializationLevel ?? 0,
        parentSkillName: specializationView.parentSkillName,
        specializationId: definition.id,
        specializationName: definition.name,
        total: specializationView.effectiveSpecializationNumber,
        xp: specializationView.secondaryRanks
      } satisfies CharacterSheetSpecializationRow;
    })
    .filter((row): row is CharacterSheetSpecializationRow => row !== null)
    .sort((left, right) => left.specializationName.localeCompare(right.specializationName));
}
