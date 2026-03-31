import type { ChargenSkillAccessSource } from "@glantri/rules-engine";

export interface ProfessionBrowseItem {
  description?: string;
  familyName: string;
  id: string;
  name: string;
}

export type SkillVisibilityFilter = "all" | "blocked" | "owned" | "purchasable";

export interface RuleEvaluationSummary {
  advisories: { message: string }[];
  blockingReasons: { message: string }[];
  isAllowed: boolean;
  warnings: { message: string }[];
}

export interface SpecializationBrowseItem {
  evaluation: RuleEvaluationSummary;
  parentSkillLevel: number;
  specializationLevel: number;
  specializationName: string;
}

const ACCESS_SOURCE_LABELS: Record<ChargenSkillAccessSource, string> = {
  "profession-group": "Profession group",
  "profession-skill": "Direct profession skill",
  "society-skill": "Society access"
};

const ACCESS_SOURCE_ORDER: ChargenSkillAccessSource[] = [
  "profession-skill",
  "profession-group",
  "society-skill"
];

export function filterProfessionBrowseItems<T extends ProfessionBrowseItem>(input: {
  familyFilter: string;
  items: T[];
  search: string;
}): T[] {
  const normalizedSearch = input.search.trim().toLowerCase();

  return input.items.filter((item) => {
    const matchesFamily =
      input.familyFilter === "all" || item.familyName === input.familyFilter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.familyName.toLowerCase().includes(normalizedSearch) ||
      item.description?.toLowerCase().includes(normalizedSearch);

    return matchesFamily && matchesSearch;
  });
}

export function getSkillAccessSourceLabels(
  sources: ChargenSkillAccessSource[] | undefined
): string[] {
  if (!sources || sources.length === 0) {
    return [];
  }

  const sourceSet = new Set(sources);

  return ACCESS_SOURCE_ORDER.filter((source) => sourceSet.has(source)).map(
    (source) => ACCESS_SOURCE_LABELS[source]
  );
}

export function matchesSkillBrowseFilters(input: {
  isAllowed: boolean;
  isOwned: boolean;
  name: string;
  search: string;
  visibilityFilter: SkillVisibilityFilter;
}): boolean {
  const normalizedSearch = input.search.trim().toLowerCase();
  const matchesSearch =
    normalizedSearch.length === 0 || input.name.toLowerCase().includes(normalizedSearch);

  if (!matchesSearch) {
    return false;
  }

  switch (input.visibilityFilter) {
    case "all":
      return true;
    case "blocked":
      return !input.isAllowed;
    case "owned":
      return input.isOwned;
    case "purchasable":
      return input.isAllowed;
  }
}

export function isRelevantSpecializationBrowseItem(
  item: SpecializationBrowseItem
): boolean {
  return (
    item.evaluation.isAllowed ||
    item.specializationLevel > 0 ||
    item.parentSkillLevel > 0 ||
    item.evaluation.warnings.length > 0 ||
    item.evaluation.advisories.length > 0
  );
}

export function filterSpecializationBrowseItems<T extends SpecializationBrowseItem>(input: {
  includeBlocked: boolean;
  items: T[];
  search: string;
}): T[] {
  const normalizedSearch = input.search.trim().toLowerCase();

  return input.items.filter((item) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      item.specializationName.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    return input.includeBlocked || isRelevantSpecializationBrowseItem(item);
  });
}
