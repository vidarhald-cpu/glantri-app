import type {
  CivilizationDefinition,
  CharacterChargenGroupSlotSelection,
  CharacterSkill,
  CharacterProgression,
  LanguageDefinition,
  ProfessionDefinition,
  ProfessionFamilyDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SocietyBandSkillAccess,
  SocietyDefinition,
  SocietyLevelAccess
} from "@glantri/domain";
import {
  getAccessibleFoundationalSkillIdsForSocietyBand,
  getCharacterSkillKey,
  getSkillGroupIds
} from "@glantri/domain";

import { resolveEffectiveProfessionPackage } from "../professions/resolveEffectiveProfessionPackage";

/*
  Terminology guardrail:
  Skill group is structural training/access. Skill category is player-facing browsing.
  If chargen selection terminology changes, update packages/domain/src/docs/glantriTerms.ts too.
*/

interface ChargenSelectionContentShape {
  civilizations?: CivilizationDefinition[];
  languages?: LanguageDefinition[];
  professionFamilies: ProfessionFamilyDefinition[];
  professionSkills: ProfessionSkillMap[];
  professions: ProfessionDefinition[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyBandSkillAccess?: SocietyBandSkillAccess[];
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
  selectedOptionalLanguageIds: string[];
  selectedOptionalLanguages: LanguageDefinition[];
}

export interface ChargenMotherTongueSummary {
  displayLabel?: string;
  languageName?: string;
  optionalLanguageNames: string[];
  skill?: SkillDefinition;
  startingLevel: number;
}

export interface ChargenSelectableSkillSummary {
  coreSkillIds: string[];
  coreSkills: SkillDefinition[];
  selectionSlots: ChargenSelectableSkillSlotSummary[];
  selectableSkillIds: string[];
  selectableSkills: SkillDefinition[];
  selectedSkillIds: string[];
  selectedSkills: SkillDefinition[];
}

export interface ChargenSelectableSkillSlotSummary {
  candidateSkillIds: string[];
  candidateSkills: SkillDefinition[];
  chooseCount: number;
  groupId: string;
  groupName: string;
  isSatisfied: boolean;
  label: string;
  required: boolean;
  selectedSkillIds: string[];
  selectedSkills: SkillDefinition[];
  slotId: string;
}

function uniqueIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)];
}

function sortLanguageIds(
  content: Pick<ChargenSelectionContentShape, "languages">,
  ids: string[]
): string[] {
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

function createEmptySkillProgressionRow(skill: SkillDefinition) {
  return {
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: 0,
    groupId: skill.groupId,
    languageName: undefined,
    level: 0,
    primaryRanks: 0,
    ranks: 0,
    secondaryRanks: 0,
    skillId: skill.id,
    sourceTag: undefined
  } satisfies CharacterProgression["skills"][number];
}

function createEmptyLanguageSkillProgressionRow(
  skill: SkillDefinition,
  languageName: string
) {
  return {
    ...createEmptySkillProgressionRow(skill),
    languageName
  } satisfies CharacterProgression["skills"][number];
}

function findSkillIndex(
  skills: CharacterProgression["skills"],
  target: Pick<CharacterSkill, "skillId" | "languageName">
): number {
  const targetKey = getCharacterSkillKey(target);
  return skills.findIndex((skill) => getCharacterSkillKey(skill) === targetKey);
}

const MOTHER_TONGUE_SKILL_ID = "language";

function getCivilizationDefinition(
  content: Pick<ChargenSelectionContentShape, "civilizations">,
  civilizationId: string | undefined
): CivilizationDefinition | undefined {
  if (!civilizationId) {
    return undefined;
  }

  return (content.civilizations ?? []).find((civilization) => civilization.id === civilizationId);
}

export function buildChargenMotherTongueSummary(input: {
  content: Pick<ChargenSelectionContentShape, "civilizations" | "skills">;
  civilizationId?: string;
  educationLevel: number;
}): ChargenMotherTongueSummary {
  const civilization = getCivilizationDefinition(input.content, input.civilizationId);
  const skill = input.content.skills.find((candidate) => candidate.id === MOTHER_TONGUE_SKILL_ID);

  if (!civilization || !skill) {
    return {
      displayLabel: undefined,
      languageName: undefined,
      optionalLanguageNames: [],
      skill: undefined,
      startingLevel: 0
    };
  }

  const startingLevel = Math.max(11, input.educationLevel);
  const languageName = civilization.motherTongueLanguageName;

  return {
    displayLabel: `${skill.name} (${languageName})`,
    languageName,
    optionalLanguageNames: civilization.optionalLanguageNames ?? [],
    skill,
    startingLevel
  };
}

function normalizeGroupSlotSelections(
  selections: CharacterChargenGroupSlotSelection[]
): CharacterChargenGroupSlotSelection[] {
  const normalizedByKey = new Map<string, CharacterChargenGroupSlotSelection>();

  for (const selection of selections) {
    normalizedByKey.set(`${selection.groupId}:${selection.slotId}`, {
      groupId: selection.groupId,
      selectedSkillIds: uniqueIds(selection.selectedSkillIds ?? []),
      slotId: selection.slotId
    });
  }

  return [...normalizedByKey.values()];
}

function getStoredGroupSlotSelections(progression: CharacterProgression): CharacterChargenGroupSlotSelection[] {
  return normalizeGroupSlotSelections(progression.chargenSelections?.selectedGroupSlots ?? []);
}

function getResolvedSelectedSlotSkillIds(input: {
  progression: CharacterProgression;
  skillGroups: SkillGroupDefinition[];
}): string[] {
  const activeGroupIds = new Set(
    input.progression.skillGroups
      .filter((group) => (group.ranks ?? 0) > 0 || (group.grantedRanks ?? 0) > 0)
      .map((group) => group.groupId)
  );
  const groupById = new Map(input.skillGroups.map((group) => [group.id, group]));

  return uniqueIds(
    getStoredGroupSlotSelections(input.progression)
      .filter((selection) => activeGroupIds.has(selection.groupId))
      .flatMap((selection) => {
        const group = groupById.get(selection.groupId);
        const slot = group?.selectionSlots?.find((candidate) => candidate.id === selection.slotId);

        if (!slot) {
          return [];
        }

        return selection.selectedSkillIds
          .filter((skillId) => slot.candidateSkillIds.includes(skillId))
          .slice(0, slot.chooseCount);
      })
  );
}

function getSocietyDefinition(
  content: Pick<ChargenSelectionContentShape, "societies">,
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

function getLanguageDefinitionMaps(content: Pick<ChargenSelectionContentShape, "languages">) {
  const languages = content.languages ?? [];

  return {
    byId: new Map(languages.map((language) => [language.id, language])),
    byName: new Map(languages.map((language) => [language.name, language]))
  };
}

export function buildChargenLanguageSelectionSummary(input: {
  content: Pick<ChargenSelectionContentShape, "civilizations" | "languages" | "societies">;
  civilizationId?: string;
  progression: CharacterProgression;
  societyId?: string;
}): ChargenLanguageSelectionSummary {
  const society = getSocietyDefinition(input.content, input.societyId);
  const civilization = getCivilizationDefinition(input.content, input.civilizationId);
  const languageMaps = getLanguageDefinitionMaps(input.content);
  const requiredLanguageIds = sortLanguageIds(
    input.content,
    uniqueIds(society?.baselineLanguageIds ?? [])
  );
  const requiredLanguageIdSet = new Set(requiredLanguageIds);
  const selectableLanguageIds = sortLanguageIds(
    input.content,
    uniqueIds(
      (civilization?.optionalLanguageNames ?? [])
        .map((languageName) => languageMaps.byName.get(languageName)?.id)
        .filter((languageId): languageId is string => languageId !== undefined)
        .filter((languageId) => !requiredLanguageIdSet.has(languageId))
    )
  );
  const selectableLanguageIdSet = new Set(selectableLanguageIds);
  const selectedOptionalLanguageIds = sortLanguageIds(
    input.content,
    (input.progression.chargenSelections?.selectedLanguageIds ?? []).filter((languageId) =>
      selectableLanguageIdSet.has(languageId)
    )
  );
  const selectedLanguageIds = sortLanguageIds(
    input.content,
    uniqueIds([...requiredLanguageIds, ...selectedOptionalLanguageIds])
  );

  return {
    requiredLanguageIds,
    requiredLanguages: requiredLanguageIds
      .map((languageId) => languageMaps.byId.get(languageId))
      .filter((language): language is LanguageDefinition => language !== undefined),
    selectableLanguageIds,
    selectableLanguages: selectableLanguageIds
      .map((languageId) => languageMaps.byId.get(languageId))
      .filter((language): language is LanguageDefinition => language !== undefined),
    selectedLanguageIds,
    selectedLanguages: selectedLanguageIds
      .map((languageId) => languageMaps.byId.get(languageId))
      .filter((language): language is LanguageDefinition => language !== undefined),
    selectedOptionalLanguageIds,
    selectedOptionalLanguages: selectedOptionalLanguageIds
      .map((languageId) => languageMaps.byId.get(languageId))
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
      selectionSlots: [],
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
    ...getAccessibleFoundationalSkillIdsForSocietyBand(
      input.content.societyBandSkillAccess ?? [],
      {
        socialBand: input.societyLevel,
        societyId: input.societyId ?? ""
      }
    ),
    ...professionPackage.core.finalEffectiveSkillIds,
    ...professionPackage.favored.finalEffectiveSkillIds
  ]);
  const normalSkillIdSet = new Set(normalSkillIds);
  const skillsById = new Map(input.content.skills.map((skill) => [skill.id, skill]));
  const groupById = new Map(input.content.skillGroups.map((group) => [group.id, group]));
  const storedGroupSlotSelections = getStoredGroupSlotSelections(input.progression);
  const selectionSlots = allowedGroupIds.flatMap((groupId) => {
    const group = groupById.get(groupId);

    return (group?.selectionSlots ?? []).map((slot) => {
      const candidateSkillIds = sortSkillIds(
        input.content,
        uniqueIds(slot.candidateSkillIds.filter((skillId) => skillsById.has(skillId)))
      );
      const candidateSkillIdSet = new Set(candidateSkillIds);
      const storedSelection = storedGroupSlotSelections.find(
        (selection) => selection.groupId === groupId && selection.slotId === slot.id
      );
      const selectedSkillIds = sortSkillIds(
        input.content,
        uniqueIds(
          (storedSelection?.selectedSkillIds ?? []).filter((skillId) => candidateSkillIdSet.has(skillId))
        ).slice(0, slot.chooseCount)
      );

      return {
        candidateSkillIds,
        candidateSkills: candidateSkillIds
          .map((skillId) => skillsById.get(skillId))
          .filter((skill): skill is SkillDefinition => skill !== undefined),
        chooseCount: slot.chooseCount,
        groupId,
        groupName: group?.name ?? groupId,
        isSatisfied: !slot.required || selectedSkillIds.length >= slot.chooseCount,
        label: slot.label,
        required: slot.required,
        selectedSkillIds,
        selectedSkills: selectedSkillIds
          .map((skillId) => skillsById.get(skillId))
          .filter((skill): skill is SkillDefinition => skill !== undefined),
        slotId: slot.id
      } satisfies ChargenSelectableSkillSlotSummary;
    });
  });
  const slotCandidateSkillIdSet = new Set(selectionSlots.flatMap((slot) => slot.candidateSkillIds));
  const coreSkillIds = sortSkillIds(
    input.content,
    professionPackage.core.finalEffectiveReachableSkillIds.filter(
      (skillId) => normalSkillIdSet.has(skillId) && !slotCandidateSkillIdSet.has(skillId)
    )
  );
  const coreSkillIdSet = new Set(coreSkillIds);
  const selectableSkillIds = sortSkillIds(
    input.content,
    normalSkillIds.filter(
      (skillId) => !coreSkillIdSet.has(skillId) && !slotCandidateSkillIdSet.has(skillId)
    )
  );
  const filteredSelectableSkillIds = sortSkillIds(
    input.content,
    selectableSkillIds
  );
  const selectableSkillIdSet = new Set(filteredSelectableSkillIds);
  const selectedFreeChoiceSkillIds = sortSkillIds(
    input.content,
    (input.progression.chargenSelections?.selectedSkillIds ?? []).filter((skillId) =>
      selectableSkillIdSet.has(skillId)
    )
  );
  const selectedSkillIds = sortSkillIds(
    input.content,
    uniqueIds([
      ...selectedFreeChoiceSkillIds,
      ...selectionSlots.flatMap((slot) => slot.selectedSkillIds)
    ])
  );

  return {
    coreSkillIds,
    coreSkills: coreSkillIds
      .map((skillId) => skillsById.get(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined),
    selectionSlots,
    selectableSkillIds: filteredSelectableSkillIds,
    selectableSkills: filteredSelectableSkillIds
      .map((skillId) => skillsById.get(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined),
    selectedSkillIds,
    selectedSkills: selectedSkillIds
      .map((skillId) => skillsById.get(skillId))
      .filter((skill): skill is SkillDefinition => skill !== undefined)
  };
}

export function syncChargenSelectionSkillRows(input: {
  content: Pick<ChargenSelectionContentShape, "skillGroups" | "skills">;
  progression: CharacterProgression;
}): CharacterProgression {
  const selectedSkillIds = new Set([
    ...(input.progression.chargenSelections?.selectedSkillIds ?? []),
    ...getResolvedSelectedSlotSkillIds({
      progression: input.progression,
      skillGroups: input.content.skillGroups
    })
  ]);
  const selectedDefinitions = input.content.skills.filter((skill) => selectedSkillIds.has(skill.id));
  const nextSkills = [...input.progression.skills];

  for (const skill of selectedDefinitions) {
    if (!nextSkills.some((candidate) => candidate.skillId === skill.id)) {
      nextSkills.push(createEmptySkillProgressionRow(skill));
    }
  }

  const nextSkillIdSet = new Set(selectedDefinitions.map((skill) => skill.id));
  const cleanedSkills = nextSkills.filter((skill) => {
    if (nextSkillIdSet.has(skill.skillId)) {
      return true;
    }

    return (
      (skill.grantedRanks ?? 0) > 0 ||
      (skill.primaryRanks ?? 0) > 0 ||
      (skill.secondaryRanks ?? 0) > 0 ||
      (skill.ranks ?? 0) > 0
    );
  });

  return {
    ...input.progression,
    skills: cleanedSkills
  };
}

export function syncChargenLanguageSkillRows(input: {
  content: Pick<ChargenSelectionContentShape, "civilizations" | "languages" | "skills">;
  civilizationId?: string;
  progression: CharacterProgression;
  societyId?: string;
}): CharacterProgression {
  const languageSkill = input.content.skills.find((skill) => skill.id === MOTHER_TONGUE_SKILL_ID);

  if (!languageSkill) {
    return input.progression;
  }

  const languageSelectionSummary = buildChargenLanguageSelectionSummary({
    civilizationId: input.civilizationId,
    content: input.content,
    progression: input.progression,
    societyId: input.societyId
  });
  const selectedLanguageKeys = new Set(
    languageSelectionSummary.selectedOptionalLanguages.map((language) =>
      getCharacterSkillKey({
        languageName: language.name,
        skillId: MOTHER_TONGUE_SKILL_ID
      })
    )
  );
  const nextSkills = [...input.progression.skills];

  for (const language of languageSelectionSummary.selectedOptionalLanguages) {
    if (
      findSkillIndex(nextSkills, {
        languageName: language.name,
        skillId: MOTHER_TONGUE_SKILL_ID
      }) >= 0
    ) {
      continue;
    }

    nextSkills.push(createEmptyLanguageSkillProgressionRow(languageSkill, language.name));
  }

  const cleanedSkills = nextSkills.filter((skill) => {
    if (skill.skillId !== MOTHER_TONGUE_SKILL_ID || skill.sourceTag === "mother-tongue") {
      return true;
    }

    if (!skill.languageName) {
      return true;
    }

    if (selectedLanguageKeys.has(getCharacterSkillKey(skill))) {
      return true;
    }

    return (
      (skill.grantedRanks ?? 0) > 0 ||
      (skill.primaryRanks ?? 0) > 0 ||
      (skill.secondaryRanks ?? 0) > 0 ||
      (skill.ranks ?? 0) > 0
    );
  });

  return {
    ...input.progression,
    skills: cleanedSkills
  };
}

export function syncChargenMotherTongueSkillRow(input: {
  content: Pick<ChargenSelectionContentShape, "civilizations" | "skills">;
  civilizationId?: string;
  educationLevel: number;
  progression: CharacterProgression;
}): CharacterProgression {
  const motherTongue = buildChargenMotherTongueSummary({
    content: input.content,
    civilizationId: input.civilizationId,
    educationLevel: input.educationLevel
  });
  const nextSkills = [...input.progression.skills];
  const motherTongueIndex = nextSkills.findIndex(
    (skill) => skill.skillId === MOTHER_TONGUE_SKILL_ID && skill.sourceTag === "mother-tongue"
  );
  const legacyGenericLanguageRows = nextSkills
    .map((skill, index) => ({ index, skill }))
    .filter(
      ({ skill }) =>
        skill.skillId === MOTHER_TONGUE_SKILL_ID &&
        skill.sourceTag !== "mother-tongue" &&
        !skill.languageName
    );

  if (!motherTongue.skill || !motherTongue.languageName) {
    if (motherTongueIndex < 0) {
      return input.progression;
    }

    const existing = nextSkills[motherTongueIndex];

    if (existing?.sourceTag !== "mother-tongue") {
      return input.progression;
    }

    const clearedSkill = {
      ...existing,
      grantedRanks: 0,
      languageName: undefined,
      ranks: (existing.primaryRanks ?? 0) + (existing.secondaryRanks ?? 0),
      sourceTag: undefined
    };

    if ((clearedSkill.primaryRanks ?? 0) <= 0 && (clearedSkill.secondaryRanks ?? 0) <= 0) {
      nextSkills.splice(motherTongueIndex, 1);
    } else {
      nextSkills[motherTongueIndex] = clearedSkill;
    }

    return {
      ...input.progression,
      skills: nextSkills
    };
  }

  const matchingLanguageIndex = findSkillIndex(nextSkills, {
    languageName: motherTongue.languageName,
    skillId: MOTHER_TONGUE_SKILL_ID
  });
  const legacyGenericLanguageSkill = legacyGenericLanguageRows[0]?.skill;
  const legacyAdditionalPrimaryRanks = legacyGenericLanguageRows
    .slice(1)
    .reduce((total, row) => total + (row.skill.primaryRanks ?? 0), 0);
  const legacyAdditionalSecondaryRanks = legacyGenericLanguageRows
    .slice(1)
    .reduce((total, row) => total + (row.skill.secondaryRanks ?? 0), 0);
  const baseSkill =
    motherTongueIndex >= 0
      ? nextSkills[motherTongueIndex]
      : matchingLanguageIndex >= 0
        ? nextSkills[matchingLanguageIndex]
        : legacyGenericLanguageSkill ?? createEmptySkillProgressionRow(motherTongue.skill);
  const syncedSkill = {
    ...baseSkill,
    category: motherTongue.skill.category,
    grantedRanks: motherTongue.startingLevel,
    groupId: motherTongue.skill.groupId,
    languageName: motherTongue.languageName,
    primaryRanks: (baseSkill.primaryRanks ?? 0) + legacyAdditionalPrimaryRanks,
    ranks:
      motherTongue.startingLevel +
      (baseSkill.primaryRanks ?? 0) +
      legacyAdditionalPrimaryRanks +
      (baseSkill.secondaryRanks ?? 0) +
      legacyAdditionalSecondaryRanks,
    secondaryRanks: (baseSkill.secondaryRanks ?? 0) + legacyAdditionalSecondaryRanks,
    sourceTag: "mother-tongue" as const
  };

  if (motherTongueIndex >= 0) {
    nextSkills[motherTongueIndex] = syncedSkill;
  } else if (matchingLanguageIndex >= 0) {
    nextSkills[matchingLanguageIndex] = syncedSkill;
  } else {
    nextSkills.push(syncedSkill);
  }

  const legacyGenericLanguageIndexes = new Set(legacyGenericLanguageRows.map((row) => row.index));

  return {
    ...input.progression,
    skills: nextSkills.filter(
      (skill, index) =>
        !legacyGenericLanguageIndexes.has(index) ||
        getCharacterSkillKey(skill) === getCharacterSkillKey(syncedSkill)
    )
  };
}
