import { getPlayerFacingSkillCategoryId, type PlayerFacingSkillCategoryId, type SkillDefinition } from "@glantri/domain";
import type { ChargenSkillAccessSource } from "@glantri/rules-engine";

/*
  Terminology guardrail:
  This module exposes player-facing Skill category buckets.
  They are distinct from mechanical Type (ordinary / secondary / specialization).
  Prefer explicit skill.categoryId when available; only fall back to legacy
  primary-group inference for older transitional data.
  If this wording changes, update packages/domain/src/docs/glantriTerms.ts too.
*/

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

export type PlayerFacingSkillBucketId = PlayerFacingSkillCategoryId;

export type SkillBrowseTypeFilter = "all" | PlayerFacingSkillBucketId;

export interface PlayerFacingSkillBucketDefinition {
  description: string;
  id: PlayerFacingSkillBucketId;
  label: string;
}

export interface SkillBrowseRowLike {
  skill: {
    id: string;
  };
  sourceLabels: string[];
}

export interface SkillTypeGroupedRow {
  skillName: string;
  skillType: PlayerFacingSkillBucketId;
}

export interface SkillTypeGroup<T extends SkillTypeGroupedRow> {
  bucketId: PlayerFacingSkillBucketId;
  label: string;
  rows: T[];
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

const PLAYER_FACING_SKILL_BUCKETS: PlayerFacingSkillBucketDefinition[] = [
  {
    description: "Weapons, direct fighting, and practical battle skills.",
    id: "combat",
    label: "Combat"
  },
  {
    description: "Soldiering, battlefield work, and organized service training.",
    id: "military",
    label: "Military"
  },
  {
    description: "Command, tactics, authority, and coordinated action.",
    id: "leadership",
    label: "Leadership"
  },
  {
    description: "Travel, stealthy movement, animals, survival, and field utility.",
    id: "fieldcraft",
    label: "Fieldcraft"
  },
  {
    description: "Ships, small craft, crews, and navigation.",
    id: "maritime",
    label: "Maritime"
  },
  {
    description: "Care, remedies, diagnosis, and treatment.",
    id: "healing",
    label: "Healing"
  },
  {
    description: "Commerce, records, administration, and practical livelihoods.",
    id: "trade",
    label: "Trade"
  },
  {
    description: "Etiquette, influence, performance, and elite social reading.",
    id: "court-social",
    label: "Court / Social"
  },
  {
    description: "Infiltration, security work, theft, and deception.",
    id: "covert",
    label: "Covert"
  },
  {
    description: "Literacy, scholarship, natural inquiry, and learned culture.",
    id: "knowledge",
    label: "Knowledge"
  },
  {
    description: "Focus, discipline, inner control, and mental resilience.",
    id: "mental",
    label: "Mental"
  },
  {
    description: "Ritual, omen-reading, magical theory, and mystical practice.",
    id: "mystical",
    label: "Mystical"
  },
  {
    description: "Making, shaping, and artisan work.",
    id: "craft",
    label: "Craft"
  },
  {
    description: "Athletic conditioning, mobility, and body training.",
    id: "physical",
    label: "Physical"
  },
  {
    description: "Standalone direct profession skills outside the main training groups.",
    id: "special-access",
    label: "Special access"
  }
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

  if (
    input.skillTypeFilter &&
    input.skillTypeFilter !== "all" &&
    input.skillType !== input.skillTypeFilter
  ) {
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

export function getPlayerFacingSkillBucketDefinitions(): PlayerFacingSkillBucketDefinition[] {
  return [...PLAYER_FACING_SKILL_BUCKETS];
}

export function getPlayerFacingSkillBucket(
  skill:
    | Pick<SkillDefinition, "id" | "categoryId" | "groupId" | "groupIds">
    | { id: string; categoryId?: string; groupId?: string; groupIds?: string[] },
  options?: { preferDirectProfession?: boolean }
): PlayerFacingSkillBucketId {
  return getPlayerFacingSkillCategoryId(skill, options);
}

export function mergeSkillBrowseRowsBySkillId<T extends SkillBrowseRowLike>(rows: T[]): T[] {
  const merged = new Map<string, T>();

  for (const row of rows) {
    const existing = merged.get(row.skill.id);

    if (!existing) {
      merged.set(row.skill.id, {
        ...row,
        sourceLabels: [...row.sourceLabels]
      });
      continue;
    }

    merged.set(row.skill.id, {
      ...existing,
      ...row,
      sourceLabels: [...new Set([...existing.sourceLabels, ...row.sourceLabels])]
    });
  }

  return [...merged.values()];
}

export function formatDependencyOwnershipSummary(input: {
  dependencyName: string;
  directSkillLevel: number;
  effectiveSkillLevel: number;
}): string {
  if (input.directSkillLevel <= 0 && input.effectiveSkillLevel > 0) {
    return `${input.dependencyName}: currently counts as level ${input.effectiveSkillLevel} from your current skill ownership.`;
  }

  return `${input.dependencyName}: currently counts as level ${input.effectiveSkillLevel}.`;
}

export function groupRowsBySkillType<T extends SkillTypeGroupedRow>(rows: T[]): SkillTypeGroup<T>[] {
  const grouped = new Map<PlayerFacingSkillBucketId, T[]>();

  for (const row of rows) {
    const existing = grouped.get(row.skillType) ?? [];
    existing.push(row);
    grouped.set(row.skillType, existing);
  }

  return PLAYER_FACING_SKILL_BUCKETS
    .map((definition) => {
      const bucketRows = grouped.get(definition.id);

      if (!bucketRows || bucketRows.length === 0) {
        return null;
      }

      return {
        bucketId: definition.id,
        label: definition.label,
        rows: [...bucketRows].sort((left, right) => left.skillName.localeCompare(right.skillName))
      } satisfies SkillTypeGroup<T>;
    })
    .filter((group): group is SkillTypeGroup<T> => group !== null);
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
