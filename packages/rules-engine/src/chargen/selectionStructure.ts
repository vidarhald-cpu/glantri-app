import type {
  CivilizationDefinition,
  CharacterChargenGroupSlotSelection,
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

function createEmptySkillProgressionRow(skill: SkillDefinition) {
  return {
    category: skill.category,
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

function getResolvedSelectedSlotSkillIds(progression: CharacterProgression): string[] {
  const activeGroupIds = new Set(
    progression.skillGroups
      .filter((group) => (group.ranks ?? 0) > 0 || (group.grantedRanks ?? 0) > 0)
      .map((group) => group.groupId)
  );

  return uniqueIds(
    getStoredGroupSlotSelections(progression)
      .filter((selection) => activeGroupIds.has(selection.groupId))
      .flatMap((selection) => selection.selectedSkillIds)
  );
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
  const ownedGroupIds = new Set(
    input.progression.skillGroups
      .filter((group) => (group.ranks ?? 0) > 0 || (group.grantedRanks ?? 0) > 0)
      .map((group) => group.groupId)
  );
  const selectionSlots = allowedGroupIds.filter((groupId) => ownedGroupIds.has(groupId)).flatMap((groupId) => {
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
  content: Pick<ChargenSelectionContentShape, "skills">;
  progression: CharacterProgression;
}): CharacterProgression {
  const selectedSkillIds = new Set([
    ...(input.progression.chargenSelections?.selectedSkillIds ?? []),
    ...getResolvedSelectedSlotSkillIds(input.progression)
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
  const languageIndex = nextSkills.findIndex((skill) => skill.skillId === MOTHER_TONGUE_SKILL_ID);

  if (!motherTongue.skill || !motherTongue.languageName) {
    if (languageIndex < 0) {
      return input.progression;
    }

    const existing = nextSkills[languageIndex];

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
      nextSkills.splice(languageIndex, 1);
    } else {
      nextSkills[languageIndex] = clearedSkill;
    }

    return {
      ...input.progression,
      skills: nextSkills
    };
  }

  const baseSkill =
    languageIndex >= 0 ? nextSkills[languageIndex] : createEmptySkillProgressionRow(motherTongue.skill);
  const syncedSkill = {
    ...baseSkill,
    category: motherTongue.skill.category,
    grantedRanks: motherTongue.startingLevel,
    groupId: motherTongue.skill.groupId,
    languageName: motherTongue.languageName,
    ranks:
      motherTongue.startingLevel + (baseSkill.primaryRanks ?? 0) + (baseSkill.secondaryRanks ?? 0),
    sourceTag: "mother-tongue" as const
  };

  if (languageIndex >= 0) {
    nextSkills[languageIndex] = syncedSkill;
  } else {
    nextSkills.push(syncedSkill);
  }

  return {
    ...input.progression,
    skills: nextSkills
  };
}
