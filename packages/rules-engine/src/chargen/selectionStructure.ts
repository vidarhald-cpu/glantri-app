import type {
  CharacterProgression,
  LanguageDefinition,
  ProfessionDefinition,
  ProfessionFamilyDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SocietyDefinition,
  SocietyLevelAccess
} from "@glantri/domain";
import { getSkillGroupIds } from "@glantri/domain";

import { resolveEffectiveProfessionPackage } from "../professions/resolveEffectiveProfessionPackage";

/*
  Terminology guardrail:
  Skill group is structural training/access. Skill category is player-facing browsing.
  If chargen selection terminology changes, update packages/domain/src/docs/glantriTerms.ts too.
*/

interface ChargenSelectionContentShape {
  languages?: LanguageDefinition[];
  professionFamilies: ProfessionFamilyDefinition[];
  professionSkills: ProfessionSkillMap[];
  professions: ProfessionDefinition[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societies?: SocietyDefinition[];
  societyLevels: SocietyLevelAccess[];
}

export interface ChargenLanguageSelectionSummary {
  requiredLanguageIds: string[];
  requiredLanguages: LanguageDefinition[];
  selectableLanguageIds: string[];
  selectableLanguages: LanguageDefinition[];
  selectedLanguageIds: string[];
  selectedLanguages: LanguageDefinition[];
}

export interface ChargenSelectableSkillSummary {
  coreSkillIds: string[];
  coreSkills: SkillDefinition[];
  selectableSkillIds: string[];
  selectableSkills: SkillDefinition[];
  selectedSkillIds: string[];
  selectedSkills: SkillDefinition[];
}

function uniqueIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)];
}

function sortLanguageIds(content: ChargenSelectionContentShape, ids: string[]): string[] {
  const orderById = new Map(
    (content.languages ?? []).map((language, index) => [language.id, [language.name, index] as const])
  );

  return [...ids].sort((left, right) => {
    const leftOrder = orderById.get(left) ?? [left, Number.MAX_SAFE_INTEGER];
    const rightOrder = orderById.get(right) ?? [right, Number.MAX_SAFE_INTEGER];

    return leftOrder[0].localeCompare(rightOrder[0]) || leftOrder[1] - rightOrder[1];
  });
}

function sortSkillIds(content: ChargenSelectionContentShape, ids: string[]): string[] {
  const orderById = new Map(
    content.skills.map((skill, index) => [skill.id, [skill.sortOrder, index] as const])
  );

  return [...ids].sort((left, right) => {
    const leftOrder = orderById.get(left) ?? [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    const rightOrder = orderById.get(right) ?? [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

    if (leftOrder[0] !== rightOrder[0]) {
      return leftOrder[0] - rightOrder[0];
    }

    return leftOrder[1] - rightOrder[1] || left.localeCompare(right);
  });
}

function getSocietyDefinition(
  content: ChargenSelectionContentShape,
  societyId: string | undefined
): SocietyDefinition | undefined {
  if (!societyId) {
    return undefined;
  }

  return (content.societies ?? []).find((society) => society.id === societyId);
}

function getSocietyAccess(
  content: ChargenSelectionContentShape,
  societyLevel: number | undefined,
  societyId?: string
): SocietyLevelAccess | undefined {
  if (societyLevel === undefined) {
    return undefined;
  }

  return content.societyLevels.find(
    (item) =>
      item.societyLevel === societyLevel && (societyId === undefined || item.societyId === societyId)
  );
}

export function buildChargenLanguageSelectionSummary(input: {
  content: ChargenSelectionContentShape;
  progression: CharacterProgression;
  societyId?: string;
}): ChargenLanguageSelectionSummary {
  const society = getSocietyDefinition(input.content, input.societyId);
  const requiredLanguageIds = sortLanguageIds(
    input.content,
    uniqueIds(society?.baselineLanguageIds ?? [])
  );
  const selectableLanguageIds: string[] = [];
  const selectableLanguageIdSet = new Set(selectableLanguageIds);
  const selectedOptionalLanguageIds = (input.progression.chargenSelections?.selectedLanguageIds ?? [])
    .filter((languageId) => selectableLanguageIdSet.has(languageId));
  const selectedLanguageIds = sortLanguageIds(
    input.content,
    uniqueIds([...requiredLanguageIds, ...selectedOptionalLanguageIds])
  );
  const languagesById = new Map(
    (input.content.languages ?? []).map((language) => [language.id, language])
  );

  return {
    requiredLanguageIds,
    requiredLanguages: requiredLanguageIds
      .map((languageId) => languagesById.get(languageId))
      .filter((language): language is LanguageDefinition => language !== undefined),
    selectableLanguageIds,
    selectableLanguages: [],
    selectedLanguageIds,
    selectedLanguages: selectedLanguageIds
      .map((languageId) => languagesById.get(languageId))
      .filter((language): language is LanguageDefinition => language !== undefined)
  };
}

export function buildChargenSelectableSkillSummary(input: {
  content: ChargenSelectionContentShape;
  professionId?: string;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel?: number;
}): ChargenSelectableSkillSummary {
  if (!input.professionId || input.societyLevel === undefined) {
    return {
      coreSkillIds: [],
      coreSkills: [],
      selectableSkillIds: [],
      selectableSkills: [],
      selectedSkillIds: [],
      selectedSkills: []
    };
  }

  const professionPackage = resolveEffectiveProfessionPackage({
    content: input.content,
    subtypeId: input.professionId
  });
  const societyAccess = getSocietyAccess(input.content, input.societyLevel, input.societyId);
  const allowedGroupIds = uniqueIds(
    societyAccess?.skillGroupIds.filter((groupId) =>
      [
        ...professionPackage.core.finalEffectiveGroupIds,
        ...professionPackage.favored.finalEffectiveGroupIds
      ].includes(groupId)
    ) ?? []
  );
  const normalSkillIds = uniqueIds([
    ...input.content.skills
      .filter((skill) => getSkillGroupIds(skill).some((groupId) => allowedGroupIds.includes(groupId)))
      .map((skill) => skill.id),
    ...(societyAccess?.skillIds ?? []),
    ...professionPackage.core.finalEffectiveSkillIds,
    ...professionPackage.favored.finalEffectiveSkillIds
  ]);
  const normalSkillIdSet = new Set(normalSkillIds);
  const coreSkillIds = sortSkillIds(
    input.content,
    professionPackage.core.finalEffectiveReachableSkillIds.filter((skillId) =>
      normalSkillIdSet.has(skillId)
    )
  );
  const coreSkillIdSet = new Set(coreSkillIds);
  const selectableSkillIds = sortSkillIds(
    input.content,
    normalSkillIds.filter((skillId) => !coreSkillIdSet.has(skillId))
  );
  const selectableSkillIdSet = new Set(selectableSkillIds);
  const selectedSkillIds = sortSkillIds(
    input.content,
    (input.progression.chargenSelections?.selectedSkillIds ?? []).filter((skillId) =>
      selectableSkillIdSet.has(skillId)
    )
  );
  const skillsById = new Map(input.content.skills.map((skill) => [skill.id, skill]));

  return {
    coreSkillIds,
    coreSkills: coreSkillIds
      .map((skillId) => skillsById.get(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined),
    selectableSkillIds,
    selectableSkills: selectableSkillIds
      .map((skillId) => skillsById.get(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined),
    selectedSkillIds,
    selectedSkills: selectedSkillIds
      .map((skillId) => skillsById.get(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined)
  };
}
