import type {
  CharacterBuild,
  GlantriCharacteristicKey,
  ProfessionDefinition,
  ProfessionFamilyDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";
import { getCharacterSkillKey } from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  getCharacteristicGm,
  type CharacterSheetSummary,
} from "@glantri/rules-engine";

export interface CharacterEditContentShape {
  professionFamilies: ProfessionFamilyDefinition[];
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface CharacterEditStatRow {
  currentValue: number;
  gmValue: number;
  isDirectEdit?: boolean;
  label: string;
  originalValue: number;
  stat: GlantriCharacteristicKey | "distraction";
}

export interface CharacterEditSkillGroupRow {
  groupId: string;
  level: number;
  name: string;
}

export interface CharacterEditSkillRow {
  canRemoveDirectXp: boolean;
  groupXp: number;
  skillId: string;
  skillKey: string;
  skillName: string;
  stats: number;
  total: number;
  totalXp: number;
  xp: number;
}

function clampStatValue(value: number): number {
  return Math.max(1, Math.min(25, Math.trunc(value)));
}

function clampDistractionValue(value: number): number {
  return Math.max(2, Math.min(6, Math.trunc(value)));
}

function cloneBuild(build: CharacterBuild): CharacterBuild {
  return structuredClone(build);
}

function updateStatModifier(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey,
  modifier: number
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  const nextModifiers = { ...(nextBuild.statModifiers ?? {}) };

  if (modifier === 0) {
    delete nextModifiers[stat];
  } else {
    nextModifiers[stat] = modifier;
  }

  nextBuild.statModifiers = nextModifiers;
  return nextBuild;
}

export function setCharacterOriginalStatValue(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey,
  value: number
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  const nextOriginalValue = clampStatValue(value);
  const currentValue =
    (build.profile.rolledStats[stat] ?? 0) + (build.statModifiers?.[stat] ?? 0);

  nextBuild.profile.rolledStats[stat] = nextOriginalValue;

  return updateStatModifier(nextBuild, stat, currentValue - nextOriginalValue);
}

export function setCharacterCurrentStatValue(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey,
  value: number
): CharacterBuild {
  const nextCurrentValue = clampStatValue(value);
  const originalValue = build.profile.rolledStats[stat] ?? 0;

  return updateStatModifier(build, stat, nextCurrentValue - originalValue);
}

export function setCharacterDistractionLevel(
  build: CharacterBuild,
  value: number
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.profile.distractionLevel = clampDistractionValue(value);
  return nextBuild;
}

export function setCharacterSkillGroupLevel(
  build: CharacterBuild,
  groupId: string,
  level: number
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  const normalizedLevel = Math.max(0, Math.trunc(level));
  const existing = nextBuild.progression.skillGroups.find((group) => group.groupId === groupId);

  if (normalizedLevel <= 0) {
    nextBuild.progression.skillGroups = nextBuild.progression.skillGroups.filter(
      (group) => group.groupId !== groupId
    );
    return nextBuild;
  }

  if (existing) {
    const grantedRanks = existing.grantedRanks ?? 0;
    existing.primaryRanks = Math.max(0, normalizedLevel - grantedRanks);
    existing.secondaryRanks = 0;
    existing.ranks = normalizedLevel;
    return nextBuild;
  }

  nextBuild.progression.skillGroups.push({
    gms: 0,
    grantedRanks: 0,
    groupId,
    primaryRanks: normalizedLevel,
    ranks: normalizedLevel,
    secondaryRanks: 0
  });

  return nextBuild;
}

export function addCharacterSkill(build: CharacterBuild, skill: SkillDefinition): CharacterBuild {
  if (build.progression.skills.some((entry) => entry.skillId === skill.id)) {
    return cloneBuild(build);
  }

  const nextBuild = cloneBuild(build);
  nextBuild.progression.skills.push({
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: 0,
    groupId: skill.groupIds[0] ?? skill.groupId,
    level: 0,
    primaryRanks: 0,
    ranks: 0,
    secondaryRanks: 0,
    skillId: skill.id
  });

  return nextBuild;
}

export function addCharacterSkillGroup(build: CharacterBuild, groupId: string): CharacterBuild {
  return setCharacterSkillGroupLevel(build, groupId, 1);
}

export function removeCharacterSkill(build: CharacterBuild, skillId: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.progression.skills = nextBuild.progression.skills.filter(
    (entry) => entry.skillId !== skillId
  );
  return nextBuild;
}

export function setCharacterSkillXp(
  build: CharacterBuild,
  skill: SkillDefinition,
  xp: number
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  const normalizedXp = Math.max(0, Math.trunc(xp));
  const existing = nextBuild.progression.skills.find((entry) => entry.skillId === skill.id);

  if (normalizedXp <= 0 && existing) {
    existing.primaryRanks = 0;
    existing.secondaryRanks = 0;
    existing.ranks = 0;
    return nextBuild;
  }

  if (existing) {
    const grantedRanks = existing.grantedRanks ?? 0;
    existing.primaryRanks = Math.max(0, normalizedXp - grantedRanks);
    existing.secondaryRanks = 0;
    existing.ranks = normalizedXp;
    existing.category = skill.category;
    existing.categoryId = skill.categoryId;
    existing.groupId = skill.groupIds[0] ?? skill.groupId;
    return nextBuild;
  }

  nextBuild.progression.skills.push({
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: 0,
    groupId: skill.groupIds[0] ?? skill.groupId,
    level: 0,
    primaryRanks: normalizedXp,
    ranks: normalizedXp,
    secondaryRanks: 0,
    skillId: skill.id
  });

  return nextBuild;
}

export function buildCharacterEditStatRows(
  build: CharacterBuild,
  sheetSummary: CharacterSheetSummary,
  labels: Record<GlantriCharacteristicKey, string>,
  orderedStats: readonly GlantriCharacteristicKey[]
): CharacterEditStatRow[] {
  return [
    ...orderedStats.map((stat) => {
      const originalValue = build.profile.rolledStats[stat];
      const currentValue = sheetSummary.adjustedStats[stat] ?? originalValue;
      const gmValue = getCharacteristicGm(stat, {
        ...build.profile.rolledStats,
        ...sheetSummary.adjustedStats
      });

      return {
        currentValue,
        gmValue,
        label: labels[stat],
        originalValue,
        stat
      };
    }),
    {
      currentValue: build.profile.distractionLevel,
      gmValue: build.profile.distractionLevel,
      isDirectEdit: true,
      label: "Distraction",
      originalValue: build.profile.distractionLevel,
      stat: "distraction" as const
    }
  ];
}

export function buildCharacterEditSkillGroupRows(input: {
  content: Pick<CharacterEditContentShape, "skillGroups">;
  sheetSummary: CharacterSheetSummary;
}): CharacterEditSkillGroupRow[] {
  const groupsById = new Map(
    input.sheetSummary.draftView.groups.map((group) => [group.groupId, group] as const)
  );

  return [...input.content.skillGroups]
    .map((group) => {
      const groupView = groupsById.get(group.id);
      const level = groupView?.groupLevel ?? 0;

      if (level <= 0) {
        return null;
      }

      return {
        groupId: group.id,
        level,
        name: group.name
      };
    })
    .filter((row): row is CharacterEditSkillGroupRow => row !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildAvailableCharacterEditSkillGroups(input: {
  content: Pick<CharacterEditContentShape, "skillGroups">;
  sheetSummary: CharacterSheetSummary;
}): CharacterEditSkillGroupRow[] {
  const visibleGroupIds = new Set(
    buildCharacterEditSkillGroupRows(input).map((group) => group.groupId)
  );

  return [...input.content.skillGroups]
    .filter((group) => !visibleGroupIds.has(group.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((group) => ({
      groupId: group.id,
      level: 0,
      name: group.name
    }));
}

export function buildCharacterEditSkillRows(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skills">;
  sheetSummary: CharacterSheetSummary;
}): CharacterEditSkillRow[] {
  const directSkillKeys = new Set(
    input.build.progression.skills.map((entry) =>
      getCharacterSkillKey({
        languageName: entry.languageName,
        skillId: entry.skillId
      })
    )
  );

  return input.sheetSummary.draftView.skills
    .map((skillView) => {
      const definition = input.content.skills.find((skill) => skill.id === skillView.skillId);

      if (!definition) {
        return null;
      }

      return {
        canRemoveDirectXp: directSkillKeys.has(skillView.skillKey),
        groupXp: skillView.groupLevel,
        skillId: definition.id,
        skillKey: skillView.skillKey,
        skillName: skillView.languageName
          ? `${definition.name} (${skillView.languageName})`
          : definition.name,
        stats: skillView.linkedStatAverage,
        total: skillView.totalSkill,
        totalXp: skillView.effectiveSkillNumber,
        xp: skillView.specificSkillLevel
      };
    })
    .filter((row): row is CharacterEditSkillRow => row !== null)
    .sort((left, right) => left.skillName.localeCompare(right.skillName));
}

export function getCharacterEditSheetSummary(
  build: CharacterBuild,
  content: CharacterEditContentShape
): CharacterSheetSummary {
  return buildCharacterSheetSummary({
    build,
    content
  });
}
