import type {
  CharacterBuild,
  CharacterSkill,
  GlantriCharacteristicKey,
  ProfessionDefinition,
  ProfessionFamilyDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess,
} from "@glantri/domain";
import { deriveCharacterStatLayers, getCharacterSkillKey } from "@glantri/domain";
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
  developedValue: number;
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
  grantedXp: number;
  grantedSourceLabel: string | undefined;
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
  grantedSourceLabel: string | undefined;
  grantedXp: number;
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

/**
 * Forgejo #1068: a GM direct edit sets the owned value of a skill or Learning Group row to exactly
 * `value` (rulings 1, 4 and 7). A raise is recorded in `grantedRanks`, the rank field that is not a
 * Chargen purchase; a lowering removes those ranks first and then the Chargen purchases. The
 * Chargen spending totals are never touched, so the Sheet's "Original" skill points stay frozen.
 */
function setOwnedRanks(
  row: { grantedRanks: number; primaryRanks: number; secondaryRanks: number },
  value: number,
): void {
  const purchased = row.primaryRanks + row.secondaryRanks;

  if (value >= purchased) {
    row.grantedRanks = value - purchased;
    return;
  }

  let excess = purchased - value;
  const fromSecondary = Math.min(row.secondaryRanks, excess);
  row.grantedRanks = 0;
  row.secondaryRanks -= fromSecondary;
  excess -= fromSecondary;
  row.primaryRanks -= excess;
}

/** A new skill row keeps the identity of the definition it comes from, as Chargen does. */
function createSkillRow(skill: SkillDefinition, ownedXp: number): CharacterSkill {
  const isTarget = "catalogueSource" in skill;

  return {
    ...(isTarget ? { targetDefinition: skill } : {}),
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: ownedXp,
    groupId: isTarget ? skill.groupId : (skill.groupIds[0] ?? skill.groupId),
    level: 0,
    primaryRanks: 0,
    ranks: ownedXp,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: skill.id,
  } as CharacterSkill;
}

function updateCurrentStatModifier(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey,
  currentValue: number,
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  const developedValue = deriveCharacterStatLayers(nextBuild).developed[stat];
  const modifier = currentValue - developedValue;
  const nextModifiers = { ...(nextBuild.currentStatModifiers ?? {}) };
  const legacyModifiers = { ...(nextBuild.statModifiers ?? {}) };

  delete legacyModifiers[stat];

  if (modifier === 0) {
    delete nextModifiers[stat];
  } else {
    nextModifiers[stat] = modifier;
  }

  nextBuild.currentStatModifiers = nextModifiers;
  nextBuild.statModifiers = legacyModifiers;
  return nextBuild;
}

/**
 * Forgejo #1068 ruling 3: a GM's permanent stat edit is Developed (`developedStatModifiers`).
 * Original is locked after Chargen. Current keeps its own temporary modifier, so it moves with
 * Developed.
 */
export function setCharacterDevelopedStatValue(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey,
  value: number,
): CharacterBuild {
  const nextBuild = cloneBuild(build);
  const originalValue = deriveCharacterStatLayers(build).original[stat];
  const modifier = clampStatValue(value) - originalValue;
  const nextModifiers = { ...(nextBuild.developedStatModifiers ?? {}) };

  if (modifier === 0) {
    delete nextModifiers[stat];
  } else {
    nextModifiers[stat] = modifier;
  }

  nextBuild.developedStatModifiers = nextModifiers;
  return nextBuild;
}

export function setCharacterCurrentStatValue(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey,
  value: number,
): CharacterBuild {
  const nextCurrentValue = clampStatValue(value);
  return updateCurrentStatModifier(build, stat, nextCurrentValue);
}

export function setCharacterDistractionLevel(build: CharacterBuild, value: number): CharacterBuild {
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
  value: CharacterProfileGender,
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

export function setCharacterSkillGroupLevel(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
  groupId: string;
  level: number;
}): CharacterBuild {
  const nextBuild = cloneBuild(input.build);
  const normalizedLevel = Math.max(0, Math.trunc(input.level));
  const existing = nextBuild.progression.skillGroups.find(
    (group) => group.groupId === input.groupId,
  );

  if (normalizedLevel <= 0) {
    nextBuild.progression.skillGroups = nextBuild.progression.skillGroups.filter(
      (group) => group.groupId !== input.groupId,
    );
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression,
    });
    return nextBuild;
  }

  if (existing) {
    // The shown level is ranks + GMs; the GM types the level.
    setOwnedRanks(existing, Math.max(0, normalizedLevel - (existing.gms ?? 0)));
    existing.ranks = existing.grantedRanks + existing.primaryRanks + existing.secondaryRanks;
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression,
    });
    return nextBuild;
  }

  const definition = input.content.skillGroups.find((group) => group.id === input.groupId);
  nextBuild.progression.skillGroups.push({
    ...(input.build.targetChargen && definition
      ? { targetDefinition: structuredClone(definition) }
      : {}),
    gms: 0,
    grantedRanks: normalizedLevel,
    groupId: input.groupId,
    primaryRanks: 0,
    ranks: normalizedLevel,
    secondaryRanks: 0,
  });

  nextBuild.progression = applyRelationshipMinimumGrants({
    content: input.content,
    progression: nextBuild.progression,
  });
  return nextBuild;
}

/** Adds a skill the Character lacks at 1 XP, so the new row is visible and editable. */
export function addCharacterSkill(build: CharacterBuild, skill: SkillDefinition): CharacterBuild {
  if (build.progression.skills.some((entry) => entry.skillId === skill.id)) {
    return cloneBuild(build);
  }

  const nextBuild = cloneBuild(build);
  nextBuild.progression.skills.push(createSkillRow(skill, 1));

  return nextBuild;
}

export function addCharacterSkillGroup(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
  groupId: string;
}): CharacterBuild {
  return setCharacterSkillGroupLevel({
    build: input.build,
    content: input.content,
    groupId: input.groupId,
    level: 1,
  });
}

export function removeCharacterSkill(build: CharacterBuild, skillId: string): CharacterBuild {
  const nextBuild = cloneBuild(build);
  nextBuild.progression.skills = nextBuild.progression.skills.filter(
    (entry) => entry.skillId !== skillId,
  );
  return nextBuild;
}

export function setCharacterSkillXp(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skillGroups" | "skills" | "specializations">;
  skill: SkillDefinition;
  xp: number;
}): CharacterBuild {
  const nextBuild = cloneBuild(input.build);
  const normalizedXp = Math.max(0, Math.trunc(input.xp));
  const existing = nextBuild.progression.skills.find((entry) => entry.skillId === input.skill.id);

  if (existing) {
    // The row keeps its own saved identity (category, group, target definition); a GM edit only
    // changes its value. Forgejo #1068: rewriting identity from another catalogue crashed the page.
    setOwnedRanks(existing, normalizedXp);
    existing.ranks =
      existing.grantedRanks +
      existing.primaryRanks +
      existing.secondaryRanks +
      (existing.relationshipGrantedRanks ?? 0);
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression,
    });
    return nextBuild;
  }

  if (normalizedXp <= 0) {
    return nextBuild;
  }

  nextBuild.progression.skills.push(createSkillRow(input.skill, normalizedXp));

  nextBuild.progression = applyRelationshipMinimumGrants({
    content: input.content,
    progression: nextBuild.progression,
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
    (entry) => entry.specializationId === input.specialization.id,
  );
  // Forgejo #1068 ruling 1: after Chargen a GM edit is bound by no Chargen prerequisite.

  if (normalizedXp <= 0) {
    nextBuild.progression.specializations = nextBuild.progression.specializations.filter(
      (entry) => entry.specializationId !== input.specialization.id,
    );
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression,
    });
    return { build: nextBuild };
  }

  if (existing) {
    existing.secondaryRanks = normalizedXp;
    existing.ranks = normalizedXp + (existing.relationshipGrantedRanks ?? 0);
    existing.skillId = input.specialization.skillId;
    nextBuild.progression = applyRelationshipMinimumGrants({
      content: input.content,
      progression: nextBuild.progression,
    });
    return { build: nextBuild };
  }

  nextBuild.progression.specializations.push({
    ...("catalogueSource" in input.specialization
      ? { targetDefinition: input.specialization }
      : {}),
    level: 0,
    ranks: normalizedXp,
    relationshipGrantedRanks: 0,
    secondaryRanks: normalizedXp,
    skillId: input.specialization.skillId,
    specializationId: input.specialization.id,
  });

  nextBuild.progression = applyRelationshipMinimumGrants({
    content: input.content,
    progression: nextBuild.progression,
  });
  return { build: nextBuild };
}

export function buildCharacterEditStatRows(
  build: CharacterBuild,
  sheetSummary: CharacterSheetSummary,
  labels: Record<GlantriCharacteristicKey, string>,
  orderedStats: readonly GlantriCharacteristicKey[],
): CharacterEditStatRow[] {
  return [
    ...orderedStats.map((stat) => {
      const statLayers = sheetSummary.statLayers ?? deriveCharacterStatLayers(build);
      const originalValue = statLayers.original[stat];
      const developedValue = statLayers.developed[stat];
      const currentValue = statLayers.current[stat];
      const gmValue = getCharacteristicGm(stat, {
        ...statLayers.current,
      });

      return {
        currentValue,
        developedValue,
        gmValue,
        label: labels[stat],
        originalValue,
        stat,
      };
    }),
    {
      currentValue: build.profile.distractionLevel,
      developedValue: build.profile.distractionLevel,
      gmValue: build.profile.distractionLevel,
      isDirectEdit: true,
      label: "Distraction",
      originalValue: build.profile.distractionLevel,
      stat: "distraction" as const,
    },
  ];
}

export function buildCharacterEditSkillGroupRows(input: {
  content: Pick<CharacterEditContentShape, "skillGroups">;
  sheetSummary: CharacterSheetSummary;
}): CharacterEditSkillGroupRow[] {
  const groupsById = new Map(
    input.sheetSummary.draftView.groups.map((group) => [group.groupId, group] as const),
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
        name: group.name,
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
    buildCharacterEditSkillGroupRows(input).map((group) => group.groupId),
  );

  return [...input.content.skillGroups]
    .filter((group) => !visibleGroupIds.has(group.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((group) => ({
      groupId: group.id,
      level: 0,
      name: group.name,
    }));
}

export function buildCharacterEditSkillRows(input: {
  build: CharacterBuild;
  content: Pick<CharacterEditContentShape, "skills">;
  sheetSummary: CharacterSheetSummary;
}): CharacterEditSkillRow[] {
  const directSkillKeys = new Set(
    input.build.progression.skills
      .filter(
        (entry) =>
          (entry.grantedRanks ?? 0) + (entry.primaryRanks ?? 0) + (entry.secondaryRanks ?? 0) > 0,
      )
      .map((entry) =>
        getCharacterSkillKey({
          languageName: entry.languageName,
          skillId: entry.skillId,
        }),
      ),
  );

  const rows = input.sheetSummary.draftView.skills
    .map((skillView) => {
      const definition = input.content.skills.find((skill) => skill.id === skillView.skillId);

      if (!definition || definition.specializationOfSkillId) {
        return null;
      }

      return {
        canRemoveDirectXp: directSkillKeys.has(skillView.skillKey),
        grantedXp: skillView.relationshipGrantedSkillLevel ?? 0,
        grantedSourceLabel: formatDerivedSkillSourceLabel({
          sourceSkillName: skillView.relationshipSourceSkillName,
          sourceType: skillView.relationshipSourceType,
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
        xp: skillView.specificSkillLevel,
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
      (specialization) => specialization.id === specializationView.specializationId,
    );

    if (!definition) {
      continue;
    }

    const evaluation = evaluateSkillSelection({
      content: input.content,
      progression: input.build.progression,
      target: {
        specialization: definition,
        targetType: "specialization",
      },
    });
    const parentSkillView = input.sheetSummary.draftView.skills.find(
      (skillView) => skillView.skillId === definition.skillId && !skillView.languageName,
    );
    const parentSkillXp =
      (parentSkillView?.groupLevel ?? 0) + (parentSkillView?.specificSkillLevel ?? 0);

    rows.push({
      blockingMessage: evaluation.blockingReasons[0]?.message,
      canDecreaseDirectXp: (specializationView.secondaryRanks ?? 0) > 0,
      canIncreaseDirectXp: true,
      grantedSourceLabel: formatDerivedSkillSourceLabel({
        sourceSkillName: specializationView.relationshipGrantedSourceSkillName,
        sourceType: specializationView.relationshipGrantedSourceType,
      }),
      grantedXp: specializationView.relationshipGrantedSpecializationLevel ?? 0,
      parentSkillName: specializationView.parentSkillName,
      parentSkillXp,
      requiredParentLevel: definition.minimumParentLevel,
      specializationId: definition.id,
      specializationName: definition.name,
      total: specializationView.effectiveSpecializationNumber,
      xp: specializationView.secondaryRanks ?? 0,
    });
  }

  return rows.sort((left, right) =>
    left.specializationName.localeCompare(right.specializationName),
  );
}

export function getCharacterEditSheetSummary(
  build: CharacterBuild,
  content: CharacterEditContentShape,
): CharacterSheetSummary {
  return buildCharacterSheetSummary({
    build,
    content,
  });
}
