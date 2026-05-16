import type { CSSProperties } from "react";
import type {
  CanonicalContent
} from "@glantri/content";
import type {
  CharacterProgression,
  GlantriCharacteristicKey,
  ProfessionDefinition,
  RolledCharacterProfile,
  SkillDefinition,
  SocietyLevelAccess
} from "@glantri/domain";
import {
  getCharacterSkillKey
} from "@glantri/domain";
import { formatDerivedSkillSourceLabel } from "@/lib/characters/derivedSkillLabels";
import {
  buildChargenDraftView,
  buildChargenSkillAccessSummary,
  evaluateSkillSelection,
  getPrimaryPurchaseCostForSkill,
  getResolvedProfileStats,
  getSecondaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSpecialization,
  getChargenSkillContributionForGroup,
  spendSecondaryPoint,
  type RolledProfileSummary
} from "@glantri/rules-engine";
import type {
  PlayerFacingSkillBucketDefinition,
  ProfessionBrowseItem
} from "@/lib/chargen/chargenBrowse";
import type { AuthUser } from "@glantri/auth";

export const UNIVERSAL_SOCIAL_BANDS = [1, 2, 3, 4] as const;

export type SocialBand = 1 | 2 | 3 | 4;
export type RowActionTargetType = "group" | "skill" | "specialization";
export type RuleStatusTone = "advisory" | "blocked" | "warning";

export interface SocietyOption {
  id: string;
  name: string;
  notes?: string;
  socialBands: Partial<Record<SocialBand, SocietyLevelAccess>>;
}

export interface CivilizationOption {
  historicalAnalogue: string;
  id: string;
  linkedSocietyId: string;
  linkedSocietyLevel: number;
  linkedSocietyName: string;
  motherTongueLanguageName: string;
  name: string;
  notes?: string;
  optionalLanguageNames: string[];
  period: string;
  shortDescription: string;
  spokenLanguageName: string;
  writtenLanguageName?: string;
}

export interface ProfessionBrowseCard extends ProfessionBrowseItem {
  coreGroupNames: string[];
  coreReachableSkillNames: string[];
  favoredDirectOnlySkillNames: string[];
  favoredGroupNames: string[];
  favoredReachableSkillNames: string[];
  familyDescription?: string;
  hasLiteracyFoundation: boolean;
  literacyGatedReachableSkillCount: number;
  normalAccessGroupNames: string[];
  profession: ProfessionDefinition;
  subtypeName: string;
  summary: {
    totalEffectiveCoreReachableSkills: number;
    totalEffectiveFavoredReachableSkills: number;
  };
}

export interface RuleStatusItem {
  code?: string;
  currentLevel?: number;
  message: string;
  requiredLevel?: number;
  skillId?: string;
  tone: RuleStatusTone;
}

export interface SkillBrowseRow {
  grantedSourceLabel?: string;
  displayName: string;
  evaluation: ReturnType<typeof evaluateSkillSelection>;
  isNormalAccess: boolean;
  metrics: SkillAllocationMetrics;
  rowKey: string;
  skill: SkillDefinition;
  sourceLabels: string[];
  sourceTag?: "mother-tongue";
  targetLanguageName?: string;
}

export interface PlayerFacingNormalAccessSection {
  definition: PlayerFacingSkillBucketDefinition;
  directRows: SkillBrowseRow[];
  groups: CanonicalContent["skillGroups"];
}

export interface RolledProfileCardModel {
  originalIndex: number;
  profile: RolledCharacterProfile;
  summary: RolledProfileSummary;
}

export interface SkillAllocationMetrics {
  avgStats: number;
  grantedXp: number;
  flexibleXp: number;
  groupXp: number;
  literacyWarning?: string;
  ordinaryXp: number;
  skillXp: number;
  totalSkillLevel: number;
  totalXp: number;
}

export function getRowActionFeedbackKey(targetId: string, targetType: RowActionTargetType): string {
  return `${targetType}:${targetId}`;
}

export function getAllowedProfessions(
  professions: ProfessionDefinition[],
  societyLevel: SocietyLevelAccess | undefined
): ProfessionDefinition[] {
  if (!societyLevel) {
    return [];
  }

  return professions.filter((profession) => societyLevel.professionIds.includes(profession.id));
}

export function sortSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function sortSkillGroups(groups: CanonicalContent["skillGroups"]): CanonicalContent["skillGroups"] {
  return [...groups].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getSkillDisplayGroupId(input: {
  content: CanonicalContent;
  draftView: ReturnType<typeof buildChargenDraftView>;
  skill: SkillDefinition;
  skillAccess: ReturnType<typeof buildChargenSkillAccessSummary>;
}): string | undefined {
  const purchasedSkill =
    input.draftView.skills.find(
      (candidate) => candidate.skillId === input.skill.id && candidate.sourceTag === "mother-tongue"
    ) ??
    input.draftView.skills.find(
      (candidate) => candidate.skillId === input.skill.id && candidate.languageName
    ) ??
    input.draftView.skills.find((candidate) => candidate.skillId === input.skill.id);

  const canonicalVisibleGroupIds = [
    ...(input.skill.groupIds ?? []),
    input.skill.groupId
  ]
    .filter((groupId): groupId is string => Boolean(groupId))
    .filter((groupId) => input.skillAccess.normalSkillGroupIds.includes(groupId));

  for (const canonicalVisibleGroupId of canonicalVisibleGroupIds) {
    const canonicalVisibleGroup = input.content.skillGroups.find(
      (group) => group.id === canonicalVisibleGroupId
    );
    const requiresMaterializedMembership =
      (canonicalVisibleGroup?.selectionSlots?.length ?? 0) > 0;
    const isFixedGroupMembership =
      canonicalVisibleGroup?.skillMemberships?.some(
        (membership) => membership.skillId === input.skill.id
      ) ?? false;

    if (!requiresMaterializedMembership || isFixedGroupMembership) {
      return canonicalVisibleGroupId;
    }

    if (purchasedSkill?.contributingGroupId === canonicalVisibleGroupId) {
      return canonicalVisibleGroupId;
    }
  }

  if (purchasedSkill?.contributingGroupId && input.skillAccess.normalSkillIds.includes(input.skill.id)) {
    return purchasedSkill.contributingGroupId;
  }

  return undefined;
}

export function getGroupSlotCandidateSkillIds(input: {
  selectionSlots: Array<{
    candidateSkillIds: string[];
  }>;
}): Set<string> {
  return new Set(
    input.selectionSlots.flatMap((slot) => slot.candidateSkillIds)
  );
}

export function getSkillDisplayName(input: {
  languageName?: string;
  skill: Pick<SkillDefinition, "name">;
}): string {
  return input.languageName ? `${input.skill.name} (${input.languageName})` : input.skill.name;
}

export function formatSkillStatLabel(stat: string): string {
  return stat.toUpperCase();
}

export function formatSkillStats(skill: SkillDefinition): string {
  const uniqueStats = [...new Set(skill.linkedStats)];
  return uniqueStats.map((stat) => formatSkillStatLabel(stat)).join(" / ");
}

export function formatProfileSocialBand(profile: RolledCharacterProfile): string {
  if (profile.socialClassRoll === undefined) {
    return "Not rolled";
  }

  return `Band ${getSocialBand(profile.socialClassRoll)} (${profile.socialClassRoll})`;
}

export function formatPlayerLabel(user: AuthUser | null | undefined): string {
  if (user === undefined) {
    return "Loading session...";
  }

  if (!user) {
    return "Not signed in";
  }

  if (user.displayName) {
    return `${user.displayName} (${user.email})`;
  }

  return user.email;
}

export function formatActionError(error: string | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  if (error.includes("Not enough")) {
    return "No points left";
  }

  if (error.includes("No allocated") || error.includes("No primary-point")) {
    return "Nothing to remove";
  }

  if (error.includes("outside your normal") || error.includes("other skill")) {
    return "Flexible only";
  }

  if (error.startsWith("Requires ")) {
    return error.replace(" skill group.", "");
  }

  if (error.includes("Literacy is required") || error.includes("requires Literacy")) {
    return "Literacy required";
  }

  return error;
}

export function formatPreviewList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

export function getSpecializationPurchaseState(input: {
  specializationId: string;
  skillAllocationContext:
    | {
        content: CanonicalContent;
        professionId: string;
        profile: RolledCharacterProfile | undefined;
        progression: CharacterProgression;
        societyId: string | undefined;
        societyLevel: number;
      }
    | undefined;
}): {
  canAllocate: boolean;
  nextCost?: number;
  previewMessage?: string;
} {
  if (!input.skillAllocationContext) {
    return {
      canAllocate: false
    };
  }

  const result = spendSecondaryPoint({
    ...input.skillAllocationContext,
    targetId: input.specializationId,
    targetType: "specialization"
  });

  if (result.error) {
    return {
      canAllocate: false,
      previewMessage: formatActionError(result.error) ?? result.error
    };
  }

  const specializationDefinition = input.skillAllocationContext.content.specializations.find(
    (specialization) => specialization.id === input.specializationId
  );

  return {
    canAllocate: true,
    nextCost: specializationDefinition
      ? getSecondaryPurchaseCostForSpecialization(
          input.skillAllocationContext.progression,
          specializationDefinition
        )
      : undefined
  };
}

export function getOrdinarySkillNextCost(input: {
  isNormalAccess: boolean;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): number {
  return input.isNormalAccess
    ? getPrimaryPurchaseCostForSkill(input.progression, input.skill)
    : getSecondaryPurchaseCostForSkill(input.progression, input.skill);
}

export function formatSocietyBandLabels(society: SocietyOption): string {
  return [1, 2, 3, 4]
    .map((band) => {
      const access = society.socialBands[band as SocialBand];
      return access ? `${band}: ${access.socialClass}` : null;
    })
    .filter((value) => value !== null)
    .join(" • ");
}

export function getSkillTierLabel(skill: Pick<SkillDefinition, "category">): string {
  return skill.category === "ordinary" ? "Primary" : "Secondary";
}

export function getSkillTierTone(skill: Pick<SkillDefinition, "category">): CSSProperties {
  return skill.category === "ordinary" ? getBadgeStyle() : getBadgeStyle({ muted: true });
}

export function getRuleStatusColor(tone: RuleStatusTone): string {
  switch (tone) {
    case "blocked":
      return "#8a2d1f";
    case "warning":
      return "#7a4b00";
    case "advisory":
      return "#5e5a50";
  }
}

export function getBadgeStyle(input?: { muted?: boolean }): CSSProperties {
  return {
    background: input?.muted ? "#f2efe6" : "#eef3ea",
    border: "1px solid #d9ddd8",
    borderRadius: 999,
    color: "#4a4f45",
    fontSize: "0.75rem",
    padding: "0.15rem 0.5rem"
  };
}

export function getRuleStatusItems(input: {
  advisories: {
    code?: string;
    currentLevel?: number;
    message: string;
    requiredLevel?: number;
    skillId?: string;
  }[];
  blockingReasons: {
    code?: string;
    currentLevel?: number;
    message: string;
    requiredLevel?: number;
    skillId?: string;
  }[];
  warnings: {
    code?: string;
    currentLevel?: number;
    message: string;
    requiredLevel?: number;
    skillId?: string;
  }[];
}): RuleStatusItem[] {
  return [
    ...input.blockingReasons.map((reason) => ({
      code: reason.code,
      currentLevel: reason.currentLevel,
      message: reason.message,
      requiredLevel: reason.requiredLevel,
      skillId: reason.skillId,
      tone: "blocked" as const
    })),
    ...input.warnings.map((warning) => ({
      code: warning.code,
      currentLevel: warning.currentLevel,
      message: warning.message,
      requiredLevel: warning.requiredLevel,
      skillId: warning.skillId,
      tone: "warning" as const
    })),
    ...input.advisories.map((advisory) => ({
      code: advisory.code,
      currentLevel: advisory.currentLevel,
      message: advisory.message,
      requiredLevel: advisory.requiredLevel,
      skillId: advisory.skillId,
      tone: "advisory" as const
    }))
  ];
}

export function dedupeRuleStatusItems(items: RuleStatusItem[]): RuleStatusItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizeRuleMessageMeaning(item.message);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function normalizeRuleMessageMeaning(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.]+$/g, "")
    .toLowerCase();
}

export function suppressBridgeOverlapStatusItems(input: {
  bridgeParentSkillId?: string;
  items: RuleStatusItem[];
}): RuleStatusItem[] {
  if (!input.bridgeParentSkillId) {
    return input.items;
  }

  return input.items.filter((item) => {
    if (item.skillId !== input.bridgeParentSkillId) {
      return true;
    }

    return ![
      "missing-required-dependency",
      "missing-recommended-dependency",
      "missing-helpful-dependency"
    ].includes(item.code ?? "");
  });
}

export function getSkillRowMessages(input: {
  persistedRowFeedback?: string;
  skill: SkillDefinition;
  evaluation: ReturnType<typeof evaluateSkillSelection>;
}): {
  feedback?: string;
  statusItems: RuleStatusItem[];
} {
  const statusItems = suppressBridgeOverlapStatusItems({
    bridgeParentSkillId: input.skill.specializationBridge?.parentSkillId,
    items: dedupeRuleStatusItems(getRuleStatusItems(input.evaluation))
  });
  const feedback = input.persistedRowFeedback;

  if (!feedback) {
    return { statusItems };
  }

  if (
    statusItems.some(
      (item) => normalizeRuleMessageMeaning(item.message) === normalizeRuleMessageMeaning(feedback)
    )
  ) {
    return { statusItems };
  }

  return {
    feedback,
    statusItems
  };
}

export function getSpecializationRowMessages(input: {
  evaluation: ReturnType<typeof evaluateSkillSelection>;
  persistedRowFeedback?: string;
  purchaseState: {
    canAllocate: boolean;
    nextCost?: number;
    previewMessage?: string;
  };
}): {
  feedback?: string;
  statusItems: RuleStatusItem[];
} {
  const statusItems = dedupeRuleStatusItems(getRuleStatusItems(input.evaluation));
  const feedback = input.purchaseState.previewMessage ?? input.persistedRowFeedback;

  if (!feedback) {
    return { statusItems };
  }

  if (
    statusItems.some(
      (item) => normalizeRuleMessageMeaning(item.message) === normalizeRuleMessageMeaning(feedback)
    )
  ) {
    return { statusItems };
  }

  return {
    feedback,
    statusItems
  };
}

export function getSocialBand(roll: number): SocialBand {
  if (roll <= 10) {
    return 1;
  }

  if (roll <= 15) {
    return 2;
  }

  if (roll <= 18) {
    return 3;
  }

  return 4;
}

export function getBandRangeLabel(band: SocialBand): string {
  switch (band) {
    case 1:
      return "1-10";
    case 2:
      return "11-15";
    case 3:
      return "16-18";
    case 4:
      return "19-20";
  }
}

export function buildSocietyOptions(societyLevels: SocietyLevelAccess[]): SocietyOption[] {
  const societies = new Map<string, SocietyOption>();

  for (const societyLevel of societyLevels) {
    if (!UNIVERSAL_SOCIAL_BANDS.includes(societyLevel.societyLevel as SocialBand)) {
      throw new Error(
        `Society "${societyLevel.societyName}" (${societyLevel.societyId}) uses unsupported social band ${societyLevel.societyLevel}.`
      );
    }

    const band = societyLevel.societyLevel as SocialBand;
    const existing = societies.get(societyLevel.societyId);

    if (existing) {
      if (existing.socialBands[band]) {
        throw new Error(
          `Duplicate social band row for society "${societyLevel.societyName}" (${societyLevel.societyId}), band ${band}.`
        );
      }

      existing.notes ??= societyLevel.notes;
      existing.socialBands[band] = societyLevel;
      continue;
    }

    societies.set(societyLevel.societyId, {
      id: societyLevel.societyId,
      name: societyLevel.societyName,
      notes: societyLevel.notes,
      socialBands: {
        [band]: societyLevel
      }
    });
  }

  for (const society of societies.values()) {
    const missingBands = UNIVERSAL_SOCIAL_BANDS.filter((band) => !society.socialBands[band]);

    if (missingBands.length > 0) {
      throw new Error(
        `Society "${society.name}" (${society.id}) is missing social band(s): ${missingBands.join(", ")}.`
      );
    }
  }

  return [...societies.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function buildCivilizationOptions(content: CanonicalContent): CivilizationOption[] {
  const societiesById = new Map(content.societies.map((society) => [society.id, society]));

  return [...content.civilizations]
    .map((civilization) => ({
      historicalAnalogue: civilization.historicalAnalogue,
      id: civilization.id,
      linkedSocietyId: civilization.linkedSocietyId,
      linkedSocietyLevel: civilization.linkedSocietyLevel,
      linkedSocietyName:
        societiesById.get(civilization.linkedSocietyId)?.name ?? civilization.linkedSocietyId,
      motherTongueLanguageName: civilization.motherTongueLanguageName,
      name: civilization.name,
      notes: civilization.notes,
      optionalLanguageNames: civilization.optionalLanguageNames ?? [],
      period: civilization.period,
      shortDescription: civilization.shortDescription,
      spokenLanguageName: civilization.spokenLanguageName,
      writtenLanguageName: civilization.writtenLanguageName ?? undefined
    }))
    .sort(
      (left, right) =>
        left.linkedSocietyLevel - right.linkedSocietyLevel ||
        left.name.localeCompare(right.name)
    );
}

export function compareRolledProfileCards(
  left: RolledProfileCardModel,
  right: RolledProfileCardModel
): number {
  if (left.summary.totalCharacteristicSum !== right.summary.totalCharacteristicSum) {
    return right.summary.totalCharacteristicSum - left.summary.totalCharacteristicSum;
  }

  if (left.summary.distractionLevel !== right.summary.distractionLevel) {
    return left.summary.distractionLevel - right.summary.distractionLevel;
  }

  return left.originalIndex - right.originalIndex;
}

export function getSkillLinkedStatAverage(
  profile: RolledCharacterProfile | undefined,
  skill: SkillDefinition
): number {
  const resolvedStats = getResolvedProfileStats(profile);

  if (!resolvedStats) {
    return 0;
  }

  const total = skill.linkedStats.reduce(
    (sum, stat) => sum + (resolvedStats[stat as GlantriCharacteristicKey] ?? 0),
    0
  );

  return Math.floor(total / skill.linkedStats.length);
}

export function getSkillAllocationMetrics(input: {
  content: CanonicalContent;
  draftView: ReturnType<typeof buildChargenDraftView>;
  profile: RolledCharacterProfile | undefined;
  skill: SkillDefinition;
  targetLanguageName?: string;
}): SkillAllocationMetrics {
  const skillView = input.targetLanguageName
    ? input.draftView.skills.find(
        (item) =>
          item.skillId === input.skill.id && item.languageName === input.targetLanguageName
      )
    : input.draftView.skills.find(
        (item) => item.skillId === input.skill.id && item.sourceTag === "mother-tongue"
      ) ??
      input.draftView.skills.find((item) => item.skillId === input.skill.id && item.languageName) ??
      input.draftView.skills.find((item) => item.skillId === input.skill.id);
  const groupXp = skillView?.groupLevel ?? 0;
  const grantedXp = skillView?.relationshipGrantedSkillLevel ?? 0;
  const skillXp = skillView?.specificSkillLevel ?? 0;
  const avgStats = skillView?.linkedStatAverage ?? getSkillLinkedStatAverage(input.profile, input.skill);
  const totalXp = groupXp + skillXp + grantedXp;

  return {
    avgStats,
    grantedXp,
    flexibleXp: skillView?.secondaryRanks ?? 0,
    groupXp,
    literacyWarning: skillView?.literacyWarning,
    ordinaryXp: skillView?.primaryRanks ?? 0,
    skillXp,
    totalSkillLevel: avgStats + totalXp,
    totalXp
  };
}

export function getGroupScopedSkillAllocationMetrics(input: {
  content: CanonicalContent;
  draftView: ReturnType<typeof buildChargenDraftView>;
  groupId: string;
  profile: RolledCharacterProfile | undefined;
  progression: CharacterProgression;
  skill: SkillDefinition;
  targetLanguageName?: string;
}): SkillAllocationMetrics {
  const metrics = getSkillAllocationMetrics(input);
  const groupXp = getChargenSkillContributionForGroup({
    content: input.content,
    groupId: input.groupId,
    progression: input.progression,
    skill: input.skill
  });
  const totalXp = groupXp + metrics.skillXp + metrics.grantedXp;

  return {
    ...metrics,
    groupXp,
    totalSkillLevel: metrics.avgStats + totalXp,
    totalXp
  };
}

export function buildConcreteLanguageBrowseRows(input: {
  content: CanonicalContent;
  draftView: ReturnType<typeof buildChargenDraftView>;
  profile: RolledCharacterProfile | undefined;
  progression: CharacterProgression;
}): SkillBrowseRow[] {
  const languageSkill = input.content.skills.find((skill) => skill.id === "language");

  if (!languageSkill) {
    return [];
  }

  return [...(input.content.languages ?? [])]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((language) => {
      const skillView =
        input.draftView.skills.find(
          (item) => item.skillId === languageSkill.id && item.languageName === language.name
        ) ??
        input.draftView.skills.find(
          (item) =>
            item.skillId === languageSkill.id &&
            item.sourceTag === "mother-tongue" &&
            item.languageName === language.name
        );
      const rowKey = getCharacterSkillKey({
        languageName: language.name,
        skillId: languageSkill.id
      });

      return {
        grantedSourceLabel: formatDerivedSkillSourceLabel({
          sourceSkillName: skillView?.relationshipSourceSkillName,
          sourceType: skillView?.relationshipSourceType
        }),
        displayName: getSkillDisplayName({
          languageName: language.name,
          skill: languageSkill
        }),
        evaluation: evaluateSkillSelection({
          content: input.content,
          progression: input.progression,
          target: {
            skill: languageSkill,
            targetType: "skill"
          }
        }),
        isNormalAccess: false,
        metrics: getSkillAllocationMetrics({
          content: input.content,
          draftView: input.draftView,
          profile: input.profile,
          skill: languageSkill,
          targetLanguageName: language.name
        }),
        rowKey,
        skill: languageSkill,
        sourceLabels: [],
        sourceTag: skillView?.sourceTag,
        targetLanguageName: language.name
      } satisfies SkillBrowseRow;
    });
}
