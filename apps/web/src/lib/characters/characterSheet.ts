import {
  getCharacterSkillKey,
  getSkillGroupIds,
  type CharacterBuild,
  type GlantriCharacteristicKey,
  type SkillDefinition
} from "@glantri/domain";
import {
  selectBestSkillGroupContribution,
  type CharacterSheetSummary
} from "@glantri/rules-engine";

import { getPlayerFacingSkillBucket, groupRowsBySkillType } from "../chargen/chargenBrowse";
import { formatDerivedSkillSourceLabel } from "./derivedSkillLabels";

export interface CharacterSheetContentShape {
  skillGroups: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
  skills: SkillDefinition[];
}

export interface CharacterSheetSkillRow {
  avgStats: number;
  derivedSourceLabel: string | undefined;
  derivedXp: number;
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
          const derivedXp = skillView.derivedSkillLevel ?? 0;
          const totalXp = skillView.effectiveSkillNumber ?? skillGroupXp + skillXp + derivedXp;

          if (totalXp <= 0) {
            return null;
          }

          return {
            avgStats:
              skillView.linkedStatAverage ?? getSkillLinkedStatAverage(input.build.profile, skill),
            derivedSourceLabel: formatDerivedSkillSourceLabel({
              sourceSkillName: skillView.derivedSourceSkillName,
              sourceType: skillView.derivedSourceType
            }),
            derivedXp,
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
