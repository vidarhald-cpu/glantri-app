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
  applyRelationshipMinimumGrants,
  buildCharacterSheetSummary,
  evaluateSkillSelection,
  getCharacteristicGm,
  type CharacterSheetSummary,
} from "@glantri/rules-engine";
import { formatDerivedSkillSourceLabel } from "./derivedSkillLabels";

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
  derivedXp: number;
  derivedSourceLabel: string | undefined;
  groupXp: number;
  skillId: string;
  skillKey: string;
  skillName: string;
  stats: number;
  total: number;
  totalXp: number;
  xp: number;
}

export interface CharacterEditSpecializationRow {
  blockingMessage?: string;
  canDecreaseDirectXp: boolean;
  canIncreaseDirectXp: boolean;
  derivedSourceLabel: string | undefined;
  derivedXp: number;
  parentSkillName: string;
  parentSkillXp: number;
  requiredParentLevel: number;
  specializationId: string;
  specializationName: string;
  total: number;
  xp: number;
}

export type CharacterProfileGender = "male" | "female" | "other" | "";

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

export function setCharacterName(build: CharacterBuild, value: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.name = value;
  return nextBuild;
}

export function setCharacterTitle(build: CharacterBuild, value: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.profile.title = value;
  return nextBuild;
}

export function setCharacterAge(build: CharacterBuild, value: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.profile.age = value;
  return nextBuild;
}

export function setCharacterGender(
  build: CharacterBuild,
  value: CharacterProfileGender
): CharacterBuild {
  const nextBuild = cloneBuild(build);

  if (value) {
    nextBuild.profile.gender = value;
  } else {
    delete nextBuild.profile.gender;
  }

  return nextBuild;
}

export function setCharacterNotes(build: CharacterBuild, value: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.profile.notes = value;
  return nextBuild;
}

export function setCharacterSkillGroupLevel(
  input: {
    build: CharacterBuild;
    content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
    groupId: string;
    level: number;
  }
): CharacterBuild {
  const nextBuild = cloneBuild(input.build);
  const normalizedLevel = Math.max(0, Math.trunc(input.level));
  const existing = nextBuild.progression.skillGroups.find(
    (group) => group.groupId === input.groupId
  );

  if (normalizedLevel <= 0) {
    nextBuild.progression.skillGroups = nextBuild.progression.skillGroups.filter(
      (group) => group.groupId !== input.groupId
    );
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression
    });
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
    groupId: input.groupId,
    primaryRanks: normalizedLevel,
    ranks: normalizedLevel,
    secondaryRanks: 0
  });

  nextBuild.progression = applyRelationshipMinimumGrants({
    content: input.content,
    progression: nextBuild.progression
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

export function addCharacterSkillGroup(
  input: {
    build: CharacterBuild;
    content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
    groupId: string;
  }
): CharacterBuild {
  return setCharacterSkillGroupLevel({
    build: input.build,
    content: input.content,
    groupId: input.groupId,
    level: 1
  });
}

export function removeCharacterSkill(build: CharacterBuild, skillId: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.progression.skills = nextBuild.progression.skills.filter(
    (entry) => entry.skillId !== skillId
  );
  return nextBuild;
}

export function setCharacterSkillXp(
  input: {
    build: CharacterBuild;
    content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
    skill: SkillDefinition;
    xp: number;
  }
): CharacterBuild {
  const nextBuild = cloneBuild(input.build);
  const normalizedXp = Math.max(0, Math.trunc(input.xp));
  const existing = nextBuild.progression.skills.find(
    (entry) => entry.skillId === input.skill.id
  );

  if (normalizedXp <= 0 && existing) {
    existing.primaryRanks = 0;
    existing.secondaryRanks = 0;
    existing.ranks = existing.grantedRanks ?? 0;
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression
    });
    return nextBuild;
  }

  if (existing) {
    const grantedRanks = existing.grantedRanks ?? 0;
    existing.primaryRanks = Math.max(0, normalizedXp - grantedRanks);
    existing.secondaryRanks = 0;
    existing.ranks =
      grantedRanks +
      existing.primaryRanks +
      (existing.relationshipGrantedRanks ?? 0);
    existing.category = input.skill.category;
    existing.categoryId = input.skill.categoryId;
    existing.groupId = input.skill.groupIds[0] ?? input.skill.groupId;
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression
    });
    return nextBuild;
  }

  nextBuild.progression.skills.push({
    category: input.skill.category,
    categoryId: input.skill.categoryId,
    grantedRanks: 0,
    groupId: input.skill.groupIds[0] ?? input.skill.groupId,
    level: 0,
    primaryRanks: normalizedXp,
    ranks: normalizedXp,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: input.skill.id
  });

  nextBuild.progression = applyRelationshipMinimumGrants({
    content: input.content,
    progression: nextBuild.progression
  });
  return nextBuild;
}

export function setCharacterSpecializationXp(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
  specialization: SkillSpecialization;
  xp: number;
}): {
  build: CharacterBuild;
  error?: string;
} {
  const nextBuild = cloneBuild(input.build);
  const normalizedXp = Math.max(0, Math.trunc(input.xp));
  const existing = nextBuild.progression.specializations.find(
    (entry) => entry.specializationId === input.specialization.id
  );
  const currentXp = existing?.secondaryRanks ?? 0;

  if (normalizedXp > currentXp) {
    const evaluation = evaluateSkillSelection({
      content: input.content,
      progression: nextBuild.progression,
      target: {
        specialization: input.specialization,
        targetType: "specialization"
      }
    });

    if (!evaluation.isAllowed) {
      return {
        build: input.build,
        error: evaluation.blockingReasons[0]?.message ?? "Specialization purchase is blocked."
      };
    }
  }

  if (normalizedXp <= 0) {
    nextBuild.progression.specializations = nextBuild.progression.specializations.filter(
      (entry) => entry.specializationId !== input.specialization.id
    );
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression
    });
    return { build: nextBuild };
  }

  if (existing) {
    existing.secondaryRanks = normalizedXp;
    existing.ranks = normalizedXp + (existing.relationshipGrantedRanks ?? 0);
    existing.skillId = input.specialization.skillId;
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression
    });
    return { build: nextBuild };
  }

  nextBuild.progression.specializations.push({
    level: 0,
    ranks: normalizedXp,
    relationshipGrantedRanks: 0,
    secondaryRanks: normalizedXp,
    skillId: input.specialization.skillId,
    specializationId: input.specialization.id
  });

  nextBuild.progression = applyRelationshipMinimumGrants({
    content: input.content,
    progression: nextBuild.progression
  });
  return { build: nextBuild };
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
    input.build.progression.skills
      .filter((entry) => (entry.primaryRanks ?? 0) + (entry.secondaryRanks ?? 0) > 0)
      .map((entry) =>
        getCharacterSkillKey({
          languageName: entry.languageName,
          skillId: entry.skillId
        })
      )
  );

  const rows = input.sheetSummary.draftView.skills
    .map((skillView) => {
      const definition = input.content.skills.find((skill) => skill.id === skillView.skillId);

      if (!definition) {
        return null;
      }

      return {
        canRemoveDirectXp: directSkillKeys.has(skillView.skillKey),
        derivedXp: skillView.relationshipGrantedSkillLevel ?? 0,
        derivedSourceLabel: formatDerivedSkillSourceLabel({
          sourceSkillName: skillView.relationshipSourceSkillName,
          sourceType: skillView.relationshipSourceType
        }),
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
    .filter((row): row is CharacterEditSkillRow => row !== null);

  return rows.sort((left, right) => left.skillName.localeCompare(right.skillName));
}

export function buildCharacterEditSpecializationRows(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
  sheetSummary: CharacterSheetSummary;
}): CharacterEditSpecializationRow[] {
  const rows: CharacterEditSpecializationRow[] = [];

  for (const specializationView of input.sheetSummary.draftView.specializations) {
    const definition = input.content.specializations.find(
      (specialization) => specialization.id === specializationView.specializationId
    );

    if (!definition) {
      continue;
    }

    const evaluation = evaluateSkillSelection({
      content: input.content,
      progression: input.build.progression,
      target: {
        specialization: definition,
        targetType: "specialization"
      }
    });
    const parentSkillView = input.sheetSummary.draftView.skills.find(
      (skillView) => skillView.skillId === definition.skillId && !skillView.languageName
    );
    const parentSkillXp =
      (parentSkillView?.groupLevel ?? 0) + (parentSkillView?.specificSkillLevel ?? 0);

    rows.push({
      blockingMessage: evaluation.blockingReasons[0]?.message,
      canDecreaseDirectXp: (specializationView.secondaryRanks ?? 0) > 0,
      canIncreaseDirectXp: evaluation.isAllowed,
      derivedSourceLabel: formatDerivedSkillSourceLabel({
        sourceSkillName: specializationView.relationshipGrantedSourceSkillName,
        sourceType: specializationView.relationshipGrantedSourceType
      }),
      derivedXp: specializationView.relationshipGrantedSpecializationLevel ?? 0,
      parentSkillName: specializationView.parentSkillName,
      parentSkillXp,
      requiredParentLevel: definition.minimumParentLevel,
      specializationId: definition.id,
      specializationName: definition.name,
      total: specializationView.effectiveSpecializationNumber,
      xp: specializationView.secondaryRanks ?? 0
    });
  }

  return rows.sort((left, right) => left.specializationName.localeCompare(right.specializationName));
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
