import type { ChargenSkillAccessSource } from "@glantri/rules-engine";

type PlayerFacingSkillBucketId = "ordinary" | "secondary" | "special-access";

export type SkillBrowseTypeFilter = "all" | PlayerFacingSkillBucketId;

export interface PlayerFacingSkillBucketDefinition {
  description: string;
  id: PlayerFacingSkillBucketId;
  label: string;
}

const PLAYER_FACING_BUCKET_DEFINITIONS: PlayerFacingSkillBucketDefinition[] = [
  {
    description: "Skills accessible through your profession and society connections",
    id: "ordinary",
    label: "Primary Skills"
  },
  {
    description: "Secondary skills derived from investing in primary skills",
    id: "secondary",
    label: "Secondary Skills"
  },
  {
    description: "Theoretical and esoteric skills with unique or limited access requirements",
    id: "special-access",
    label: "Special Access"
  }
];

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
  skillType?: PlayerFacingSkillBucketId;
  skillTypeFilter?: SkillBrowseTypeFilter;
  visibilityFilter: SkillVisibilityFilter;
}): boolean {
  const normalizedSearch = input.search.trim().toLowerCase();
  const matchesSearch =
    normalizedSearch.length === 0 || input.name.toLowerCase().includes(normalizedSearch);

  if (!matchesSearch) {
    return false;
  }

  if (input.skillTypeFilter && input.skillTypeFilter !== "all" && input.skillType !== input.skillTypeFilter) {
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

export function getPlayerFacingSkillBucketDefinitions(): PlayerFacingSkillBucketDefinition[] {
  return PLAYER_FACING_BUCKET_DEFINITIONS;
}

export function getPlayerFacingSkillBucket(
  skill: {
    category?: "ordinary" | "secondary";
    groupId: string;
    groupIds: string[];
    id: string;
    isTheoretical?: boolean;
    secondaryOfSkillId?: string;
  },
  options?: { preferDirectProfession?: boolean }
): PlayerFacingSkillBucketId {
  if (skill.category === "secondary" || skill.secondaryOfSkillId !== undefined) {
    return "secondary";
  }

  if (skill.isTheoretical && !options?.preferDirectProfession) {
    return "special-access";
  }

  return "ordinary";
}

export function mergeSkillBrowseRowsBySkillId<T extends { skill: { id: string } }>(
  rows: T[]
): T[] {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (seen.has(row.skill.id)) {
      return false;
    }

    seen.add(row.skill.id);
    return true;
  });
}

export function groupRowsBySkillType<T extends { skillType: PlayerFacingSkillBucketId }>(
  rows: T[]
): { bucketId: PlayerFacingSkillBucketId; label: string; rows: T[] }[] {
  const bucketMap = new Map<PlayerFacingSkillBucketId, T[]>();

  for (const row of rows) {
    const existing = bucketMap.get(row.skillType);

    if (existing) {
      existing.push(row);
    } else {
      bucketMap.set(row.skillType, [row]);
    }
  }

  return PLAYER_FACING_BUCKET_DEFINITIONS.filter((def) => bucketMap.has(def.id)).map((def) => ({
    bucketId: def.id,
    label: def.label,
    rows: bucketMap.get(def.id)!
  }));
}

export function formatDependencyOwnershipSummary(input: {
  dependencyName: string;
  directSkillLevel: number;
  effectiveSkillLevel: number;
}): string {
  if (input.effectiveSkillLevel === 0) {
    return `${input.dependencyName}: Not owned`;
  }

  if (input.directSkillLevel === 0) {
    return `${input.dependencyName}: Level ${input.effectiveSkillLevel} (via group)`;
  }

  if (input.directSkillLevel < input.effectiveSkillLevel) {
    return `${input.dependencyName}: Level ${input.effectiveSkillLevel} (${input.directSkillLevel} direct + group)`;
  }

  return `${input.dependencyName}: Level ${input.effectiveSkillLevel}`;
}
