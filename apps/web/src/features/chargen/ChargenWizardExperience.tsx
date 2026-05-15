"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/*
  Terminology guardrail:
  Chargen exposes both mechanical Type and player-facing Skill category.
  Keep those terms distinct in filters and tables, and update
  packages/domain/src/docs/glantriTerms.ts whenever the wording changes.
*/

import {
  defaultCanonicalContent,
  type CanonicalContent,
  validateCanonicalContent
} from "@glantri/content";
import type { AuthUser } from "@glantri/auth";
import type {
  ChargenRuleSet,
  CharacterProgression,
  GlantriCharacteristicKey,
  ProfessionDefinition,
  RolledCharacterProfile,
  SkillDefinition,
  SocietyLevelAccess
} from "@glantri/domain";
import {
  DEFAULT_CHARGEN_RULE_SET,
  getCharacterSkillKey,
  glantriCharacteristicLabels
} from "@glantri/domain";
import { formatDerivedSkillSourceLabel } from "@/lib/characters/derivedSkillLabels";
import {
  applyProfessionGrants,
  buildChargenLanguageSelectionSummary,
  buildChargenMotherTongueSummary,
  applyChargenStatBuild,
  applyChargenStatExchange,
  allocateChargenPoint,
  buildResolvedProfile,
  buildChargenDraftView,
  buildChargenSelectableSkillSummary,
  buildChargenSkillAccessSummary,
  createChargenStatAdjustmentState,
  createChargenMethodPolicy,
  createChargenProgression,
  evaluateSkillSelection,
  finalizeChargenDraft,
  generateProfiles,
  getChargenSkillContributionForGroup,
  getPrimaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSpecialization,
  removeChargenPoint,
  removeSecondaryPoint,
  resolveEffectiveProfessionPackage,
  reviewChargenDraft,
  selectProfile,
  spendSecondaryPoint,
  summarizeRolledProfile,
  getResolvedProfileStats,
  type ChargenStatAdjustmentState,
  type RolledProfileSummary
} from "@glantri/rules-engine";

import {
  filterProfessionBrowseItems,
  filterSpecializationBrowseItems,
  formatDependencyOwnershipSummary,
  groupRowsBySkillType,
  getSkillAccessSourceLabels,
  getPlayerFacingSkillBucket,
  getPlayerFacingSkillBucketDefinitions,
  mergeSkillBrowseRowsBySkillId,
  matchesSkillBrowseFilters,
  type PlayerFacingSkillBucketDefinition,
  type SkillBrowseTypeFilter,
  type ProfessionBrowseItem,
  type SkillVisibilityFilter
} from "@/lib/chargen/chargenBrowse";
import {
  getCurrentSessionUser,
  loadActiveChargenRuleSet,
  saveCharacterToServer
} from "@/lib/api/localServiceClient";
import { API_BASE_URL } from "@/lib/api/apiConfig";
import { ChargenSessionRepository } from "@/lib/offline/repositories/chargenSessionRepository";
import { ContentCacheRepository } from "@/lib/offline/repositories/contentCacheRepository";
import { LocalCharacterRepository } from "@/lib/offline/repositories/localCharacterRepository";
import { FeedbackPanel } from "./components";
import { ResolveStatsStep } from "./steps/ResolveStatsStep";
import { StatsStep } from "./steps/StatsStep";
import { StartStep } from "./steps/StartStep";
import styles from "./ChargenWizardExperience.module.css";

const SESSION_ID = "chargen-vertical-slice";
const CONTENT_CACHE_KEY = "canonical-content";

const chargenSessionRepository = new ChargenSessionRepository();
const contentCacheRepository = new ContentCacheRepository();
const localCharacterRepository = new LocalCharacterRepository();
const UNIVERSAL_SOCIAL_BANDS = [1, 2, 3, 4] as const;

interface ContentResponse {
  content: CanonicalContent;
}

type SocialBand = 1 | 2 | 3 | 4;
type RowActionTargetType = "group" | "skill" | "specialization";
type RuleStatusTone = "advisory" | "blocked" | "warning";

interface SocietyOption {
  id: string;
  name: string;
  notes?: string;
  socialBands: Partial<Record<SocialBand, SocietyLevelAccess>>;
}

interface CivilizationOption {
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

interface ProfessionBrowseCard extends ProfessionBrowseItem {
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

interface RuleStatusItem {
  code?: string;
  currentLevel?: number;
  message: string;
  requiredLevel?: number;
  skillId?: string;
  tone: RuleStatusTone;
}

interface SkillBrowseRow {
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

interface PlayerFacingNormalAccessSection {
  definition: PlayerFacingSkillBucketDefinition;
  directRows: SkillBrowseRow[];
  groups: CanonicalContent["skillGroups"];
}

function getRowActionFeedbackKey(targetId: string, targetType: RowActionTargetType): string {
  return `${targetType}:${targetId}`;
}

function getAllowedProfessions(
  professions: ProfessionDefinition[],
  societyLevel: SocietyLevelAccess | undefined
): ProfessionDefinition[] {
  if (!societyLevel) {
    return [];
  }

  return professions.filter((profession) => societyLevel.professionIds.includes(profession.id));
}

function sortSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((left, right) => left.sortOrder - right.sortOrder);
}

function sortSkillGroups(groups: CanonicalContent["skillGroups"]): CanonicalContent["skillGroups"] {
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

function getSkillDisplayName(input: {
  languageName?: string;
  skill: Pick<SkillDefinition, "name">;
}): string {
  return input.languageName ? `${input.skill.name} (${input.languageName})` : input.skill.name;
}

function formatSkillStatLabel(stat: string): string {
  return stat.toUpperCase();
}

function formatSkillStats(skill: SkillDefinition): string {
  const uniqueStats = [...new Set(skill.linkedStats)];
  return uniqueStats.map((stat) => formatSkillStatLabel(stat)).join(" / ");
}

function formatProfileSocialBand(profile: RolledCharacterProfile): string {
  if (profile.socialClassRoll === undefined) {
    return "Not rolled";
  }

  return `Band ${getSocialBand(profile.socialClassRoll)} (${profile.socialClassRoll})`;
}

function formatPlayerLabel(user: AuthUser | null | undefined): string {
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

function formatActionError(error: string | undefined): string | undefined {
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

function formatPreviewList(values: string[]): string {
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

function getOrdinarySkillNextCost(input: {
  isNormalAccess: boolean;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): number {
  return input.isNormalAccess
    ? getPrimaryPurchaseCostForSkill(input.progression, input.skill)
    : getSecondaryPurchaseCostForSkill(input.progression, input.skill);
}

function formatSocietyBandLabels(society: SocietyOption): string {
  return [1, 2, 3, 4]
    .map((band) => {
      const access = society.socialBands[band as SocialBand];
      return access ? `${band}: ${access.socialClass}` : null;
    })
    .filter((value) => value !== null)
    .join(" • ");
}

function getSkillTierLabel(skill: Pick<SkillDefinition, "category">): string {
  return skill.category === "ordinary" ? "Primary" : "Secondary";
}

function getSkillTierClass(skill: Pick<SkillDefinition, "category">): string {
  return skill.category === "ordinary" ? styles.badge : styles.badgeMuted;
}

function getRuleStatusClass(tone: RuleStatusTone): string {
  switch (tone) {
    case "blocked":
      return styles.statusBlocked;
    case "warning":
      return styles.statusWarning;
    case "advisory":
      return styles.statusAdvisory;
  }
}

function getBadgeClass(input?: { muted?: boolean }): string {
  return input?.muted ? styles.badgeMuted : styles.badge;
}

function getRuleStatusItems(input: {
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

function dedupeRuleStatusItems(items: RuleStatusItem[]): RuleStatusItem[] {
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

function normalizeRuleMessageMeaning(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.]+$/g, "")
    .toLowerCase();
}

function suppressBridgeOverlapStatusItems(input: {
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

function getSocialBand(roll: number): SocialBand {
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

function getBandRangeLabel(band: SocialBand): string {
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

function buildSocietyOptions(societyLevels: SocietyLevelAccess[]): SocietyOption[] {
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

function buildCivilizationOptions(content: CanonicalContent): CivilizationOption[] {
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

interface RolledProfileCardModel {
  originalIndex: number;
  profile: RolledCharacterProfile;
  summary: RolledProfileSummary;
}

interface SkillAllocationMetrics {
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

function compareRolledProfileCards(
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

function getSkillLinkedStatAverage(
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

export default function ChargenWizard() {
  const router = useRouter();
  const [characterName, setCharacterName] = useState("");
  const [content, setContent] = useState<CanonicalContent>(defaultCanonicalContent);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [hasStartedChargen, setHasStartedChargen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [profileAdjustments, setProfileAdjustments] = useState<
    Record<string, ChargenStatAdjustmentState>
  >({});
  const [progression, setProgression] = useState<CharacterProgression>(createChargenProgression());
  const [rowActionFeedback, setRowActionFeedback] = useState<Record<string, string>>({});
  const [rolledProfiles, setRolledProfiles] = useState<RolledCharacterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string>();
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();
  const [showRolledProfileOptions, setShowRolledProfileOptions] = useState(true);
  const [showCivilizationChooser, setShowCivilizationChooser] = useState(true);
  const [showProfessionChooser, setShowProfessionChooser] = useState(true);
  const [expandedProfessionId, setExpandedProfessionId] = useState<string>();
  const [professionFamilyFilter, setProfessionFamilyFilter] = useState("all");
  const [professionSearch, setProfessionSearch] = useState("");
  const [chargenRuleSet, setChargenRuleSet] = useState<ChargenRuleSet>(DEFAULT_CHARGEN_RULE_SET);
  const [expandedAllocationSections, setExpandedAllocationSections] = useState<string[]>([]);
  const [expandedSkillDetails, setExpandedSkillDetails] = useState<string[]>([]);
  const [showOtherSkills, setShowOtherSkills] = useState(false);
  const [showSpecializations, setShowSpecializations] = useState(false);
  const [skillVisibilityFilter, setSkillVisibilityFilter] =
    useState<SkillVisibilityFilter>("all");
  const [skillSearch, setSkillSearch] = useState("");
  const [skillTypeFilter, setSkillTypeFilter] = useState<SkillBrowseTypeFilter>("all");
  const [specializationSearch, setSpecializationSearch] = useState("");
  const [showAllSpecializations, setShowAllSpecializations] = useState(false);
  const [exchangeFirstStat, setExchangeFirstStat] = useState<GlantriCharacteristicKey>("str");
  const [exchangeSecondStat, setExchangeSecondStat] = useState<GlantriCharacteristicKey>("dex");
  const [buildIncreaseStat, setBuildIncreaseStat] = useState<GlantriCharacteristicKey>("str");
  const [buildDecreaseStat, setBuildDecreaseStat] = useState<GlantriCharacteristicKey>("dex");

  const selectedRolledProfile = selectedProfileId
    ? selectProfile({ profileId: selectedProfileId, profiles: rolledProfiles })
    : undefined;
  const selectedAdjustment =
    selectedRolledProfile &&
    (profileAdjustments[selectedRolledProfile.id] ??
      createChargenStatAdjustmentState(selectedRolledProfile.rolledStats));
  const selectedProfile =
    selectedRolledProfile && selectedAdjustment
      ? buildResolvedProfile({
          adjustedStats: selectedAdjustment.stats,
          profile: selectedRolledProfile
        })
      : undefined;
  const selectedSocialBand =
    selectedProfile?.socialClassRoll !== undefined
      ? getSocialBand(selectedProfile.socialClassRoll)
      : undefined;
  const selectedResolvedStats = getResolvedProfileStats(selectedProfile);
  const chargenPolicy = createChargenMethodPolicy(chargenRuleSet);
  const exchangeDisabled =
    !selectedAdjustment ||
    exchangeFirstStat === exchangeSecondStat ||
    selectedAdjustment.exchangesUsed >= chargenPolicy.maxExchanges;
  const buildDisabled =
    !selectedAdjustment ||
    buildIncreaseStat === buildDecreaseStat ||
    selectedAdjustment.buildsUsed >= chargenPolicy.maxBuilds ||
    selectedAdjustment.stats[buildDecreaseStat] - 2 < 1 ||
    selectedAdjustment.stats[buildIncreaseStat] + 1 > 25;
  const selectedRolledProfileSummary = selectedRolledProfile
    ? summarizeRolledProfile({
        profile: selectedRolledProfile
      })
    : undefined;
  const sortedRolledProfiles = rolledProfiles
    .map((profile, originalIndex) => ({
      originalIndex,
      profile,
      summary: summarizeRolledProfile({
        profile
      })
    }))
    .sort(compareRolledProfileCards);
  const societies = buildSocietyOptions(content.societyLevels);
  const civilizations = buildCivilizationOptions(content);
  const selectedCivilization = civilizations.find(
    (civilization) => civilization.id === selectedCivilizationId
  );
  const selectedSocietyId = selectedCivilization?.linkedSocietyId;
  const selectedSociety = societies.find((society) => society.id === selectedSocietyId);
  const selectedSocietyAccess =
    selectedSociety && selectedSocialBand !== undefined
      ? selectedSociety.socialBands[selectedSocialBand]
      : undefined;
  const selectedSocietyBand = selectedSociety ? selectedSocialBand : undefined;
  const availableProfessions = getAllowedProfessions(content.professions, selectedSocietyAccess);
  const selectedProfession = availableProfessions.find((item) => item.id === selectedProfessionId);
  const sortedSkillGroups = sortSkillGroups(content.skillGroups);
  const playerFacingSkillBucketDefinitions = getPlayerFacingSkillBucketDefinitions();
  const availableProfessionCards: ProfessionBrowseCard[] = [...availableProfessions]
    .map((profession) => {
      const professionAccess =
        selectedSocietyId && selectedSocietyBand !== undefined
          ? buildChargenSkillAccessSummary({
              content,
              professionId: profession.id,
              societyId: selectedSocietyId,
              societyLevel: selectedSocietyBand
            })
          : undefined;
      const professionPackage = resolveEffectiveProfessionPackage({
        content,
        subtypeId: profession.id
      });
      const coreReachableSkills = professionPackage.core.finalEffectiveReachableSkillIds
        .map((skillId) => content.skills.find((skill) => skill.id === skillId))
        .filter((skill): skill is SkillDefinition => skill !== undefined);
      const favoredReachableSkills = professionPackage.favored.finalEffectiveReachableSkillIds
        .map((skillId) => content.skills.find((skill) => skill.id === skillId))
        .filter((skill): skill is SkillDefinition => skill !== undefined);
      const literacyGatedReachableSkillCount = [
        ...coreReachableSkills,
        ...favoredReachableSkills
      ].filter((skill) => skill.requiresLiteracy !== "no").length;
      const hasLiteracyFoundation =
        professionPackage.core.finalEffectiveReachableSkillIds.includes("literacy") ||
        professionPackage.favored.finalEffectiveReachableSkillIds.includes("literacy") ||
        literacyGatedReachableSkillCount > 0;

      return {
        coreGroupNames: professionPackage.core.finalEffectiveGroupIds.map(
          (groupId) => content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId
        ),
        coreReachableSkillNames: professionPackage.core.finalEffectiveReachableSkillIds.map(
          (skillId) => content.skills.find((skill) => skill.id === skillId)?.name ?? skillId
        ),
        description: profession.description,
        familyDescription: professionPackage.family.description,
        favoredDirectOnlySkillNames: professionPackage.favored.directOnlySkillIds.map(
          (skillId) => content.skills.find((skill) => skill.id === skillId)?.name ?? skillId
        ),
        familyName: professionPackage.family.name,
        favoredGroupNames: professionPackage.favored.finalEffectiveGroupIds.map(
          (groupId) => content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId
        ),
        favoredReachableSkillNames: professionPackage.favored.finalEffectiveReachableSkillIds.map(
          (skillId) => content.skills.find((skill) => skill.id === skillId)?.name ?? skillId
        ),
        hasLiteracyFoundation,
        id: profession.id,
        literacyGatedReachableSkillCount,
        name: profession.name,
        normalAccessGroupNames: sortedSkillGroups
          .filter((group) => professionAccess?.normalSkillGroupIds.includes(group.id))
          .map((group) => group.name),
        profession,
        summary: professionPackage.summary
        ,
        subtypeName: profession.name
      };
    })
    .sort((left, right) => {
      const familyComparison = left.familyName.localeCompare(right.familyName);

      if (familyComparison !== 0) {
        return familyComparison;
      }

      return left.name.localeCompare(right.name);
    });
  const professionFamilyOptions = [...new Set(availableProfessionCards.map((item) => item.familyName))];
  const visibleProfessionCards = filterProfessionBrowseItems({
    familyFilter: professionFamilyFilter,
    items: availableProfessionCards,
    search: professionSearch
  });
  const activeProfessionPreviewId = expandedProfessionId ?? selectedProfessionId;
  const selectedProfessionCard = availableProfessionCards.find(
    (profession) => profession.id === selectedProfessionId
  );
  const skillAllocationContext =
    selectedProfessionId && selectedSocietyId && selectedSocietyBand !== undefined
      ? {
          content,
          professionId: selectedProfessionId,
          profile: selectedProfile,
          progression,
          societyId: selectedSocietyId,
          societyLevel: selectedSocietyBand
        }
      : undefined;
  const draftView = buildChargenDraftView({
    civilizationId: selectedCivilizationId,
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const educationLinkedSkillCount = Math.max(
    0,
    draftView.education.theoreticalSkillCount -
      draftView.education.baseEducation -
      draftView.education.socialClassEducationValue
  );
  const review = reviewChargenDraft({
    civilizationId: selectedCivilizationId,
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    ruleSet: {
      id: chargenRuleSet.id,
      name: chargenRuleSet.name,
      parameters: chargenRuleSet
    },
    socialClass: selectedSocietyAccess?.socialClass,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const motherTongueSummary = buildChargenMotherTongueSummary({
    civilizationId: selectedCivilizationId,
    content,
    educationLevel: draftView.education.theoreticalSkillCount
  });
  const languageSelectionSummary = buildChargenLanguageSelectionSummary({
    civilizationId: selectedCivilizationId,
    content,
    progression,
    societyId: selectedSocietyId
  });
  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content,
    professionId: selectedProfessionId,
    progression,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const groupSlotCandidateSkillIds = getGroupSlotCandidateSkillIds(
    selectableSkillSummary
  );
  const skillAccess =
    selectedProfessionId && selectedSocietyId && selectedSocietyBand !== undefined
      ? buildChargenSkillAccessSummary({
          content,
          professionId: selectedProfessionId,
          societyId: selectedSocietyId,
          societyLevel: selectedSocietyBand
        })
      : {
          normalSkillGroupIds: [],
          normalSkillIds: [],
          otherSkillIds: content.skills
            .filter((skill) => !skill.specializationOfSkillId)
            .map((skill) => skill.id),
          skillSources: {}
        };
  const visibleSkillDefinitions = content.skills.filter((skill) => !skill.specializationOfSkillId);
  const normalSkillGroups = sortedSkillGroups.filter((group) =>
    skillAccess.normalSkillGroupIds.includes(group.id)
  );
  const concreteLanguageRows = buildConcreteLanguageBrowseRows({
    content,
    draftView,
    profile: selectedProfile,
    progression
  });
  const languageSkillViews = draftView.skills
    .filter((skill) => skill.skillId === "language")
    .sort(
      (left, right) =>
        Number(right.sourceTag === "mother-tongue") - Number(left.sourceTag === "mother-tongue") ||
        (left.languageName ?? "").localeCompare(right.languageName ?? "")
    );
  const skillDisplayGroupIds = new Map(
    visibleSkillDefinitions.map((skill) => [
      skill.id,
      getSkillDisplayGroupId({
        content,
        draftView,
        skill,
        skillAccess
      })
    ])
  );
  const additionalAllowedSkills = sortSkills(
    visibleSkillDefinitions.filter(
      (skill) =>
        skill.id !== "language" &&
        skillAccess.normalSkillIds.includes(skill.id) &&
        !groupSlotCandidateSkillIds.has(skill.id) &&
        skillDisplayGroupIds.get(skill.id) === undefined
    )
  );
  const otherSkills = sortSkills(
    visibleSkillDefinitions.filter(
      (skill) =>
        skill.id !== "language" &&
        skillDisplayGroupIds.get(skill.id) === undefined &&
        !skillAccess.normalSkillIds.includes(skill.id)
    )
  );
  const skillRowsById = new Map<string, SkillBrowseRow>(
    sortSkills(visibleSkillDefinitions).map((skill) => {
      const skillView =
        draftView.skills.find((item) => item.skillId === skill.id && item.sourceTag === "mother-tongue") ??
        draftView.skills.find((item) => item.skillId === skill.id && item.languageName) ??
        draftView.skills.find((item) => item.skillId === skill.id);
      const metrics = getSkillAllocationMetrics({
        content,
        draftView,
        profile: selectedProfile,
        skill
      });
      const evaluation = evaluateSkillSelection({
        content,
        progression,
        target: {
          skill,
          targetType: "skill"
        }
      });

      return [
        skill.id,
        {
        grantedSourceLabel: formatDerivedSkillSourceLabel({
          sourceSkillName: skillView?.relationshipSourceSkillName,
          sourceType: skillView?.relationshipSourceType
        }),
          displayName: getSkillDisplayName({
            languageName: skillView?.languageName,
            skill
          }),
          evaluation,
          isNormalAccess: skillAccess.normalSkillIds.includes(skill.id),
          metrics,
          rowKey: skill.id,
          skill,
          sourceLabels: getSkillAccessSourceLabels(skillAccess.skillSources[skill.id]),
          sourceTag: skillView?.sourceTag
        }
      ];
    })
  );
  const additionalAllowedSkillRows = additionalAllowedSkills
    .map((skill) => skillRowsById.get(skill.id))
    .filter((row): row is SkillBrowseRow => row !== undefined);
  const societyGrantedSkillRows = mergeSkillBrowseRowsBySkillId(
    additionalAllowedSkillRows.filter(
      (row) =>
        skillAccess.skillSources[row.skill.id]?.includes("society-foundational-skill") ?? false
    )
  );
  const professionDirectSkillRows = mergeSkillBrowseRowsBySkillId(
    additionalAllowedSkillRows.filter(
      (row) =>
        !(skillAccess.skillSources[row.skill.id]?.includes("society-foundational-skill") ?? false)
    )
  );
  const visibleOtherSkillRows = [
    ...otherSkills
      .map((skill) => skillRowsById.get(skill.id))
      .filter((row): row is SkillBrowseRow => row !== undefined),
    ...concreteLanguageRows
  ]
    .filter((row) =>
      matchesSkillBrowseFilters({
        isAllowed: row.evaluation.isAllowed,
        isOwned: row.metrics.totalXp > 0,
        name: row.displayName,
        search: skillSearch,
        skillType: getPlayerFacingSkillBucket(row.skill),
        skillTypeFilter,
        visibilityFilter: skillVisibilityFilter
      })
    );
  const otherSkillFilterActive =
    skillSearch.trim().length > 0 ||
    skillVisibilityFilter !== "all" ||
    skillTypeFilter !== "all";
  const otherSkillTypeOptions = playerFacingSkillBucketDefinitions.filter(
    (definition) =>
      definition.id !== "special-access" &&
      [...otherSkills, ...concreteLanguageRows.map((row) => row.skill)].some(
        (skill) => getPlayerFacingSkillBucket(skill) === definition.id
      )
  );
  const normalAccessSections: PlayerFacingNormalAccessSection[] = playerFacingSkillBucketDefinitions
    .map((definition) => ({
      definition,
      directRows: mergeSkillBrowseRowsBySkillId(
        professionDirectSkillRows.filter(
          (row) =>
            getPlayerFacingSkillBucket(row.skill, {
              preferDirectProfession:
                skillAccess.skillSources[row.skill.id]?.includes("profession-skill") ?? false
            }) === definition.id
        )
      ),
      groups: normalSkillGroups.filter(
        (group) =>
          getPlayerFacingSkillBucket(
            {
              id: group.id,
              groupId: group.id,
              groupIds: [group.id]
            },
            {
              preferDirectProfession: false
            }
          ) === definition.id
      )
    }))
    .filter((section) => section.directRows.length > 0 || section.groups.length > 0);
  const coreProfessionSections = normalAccessSections.filter(
    (section) => section.definition.id !== "special-access"
  );
  const specialAccessSection =
    normalAccessSections.find((section) => section.definition.id === "special-access") ?? null;
  const defaultExpandedAllocationSections = useMemo(
    () => [
      ...(coreProfessionSections.length > 0 ? ["core-profession-skills"] : []),
      ...(specialAccessSection ? ["special-access"] : [])
    ],
    [coreProfessionSections.length, Boolean(specialAccessSection)]
  );
  const playerSkillTableRows = sortSkills(content.skills)
    .filter((skill) => !skill.specializationOfSkillId)
    .flatMap((skill) => {
      const matchingViews = draftView.skills.filter((item) => item.skillId === skill.id);
      const views = matchingViews.length > 0 ? matchingViews : [];

      return views
        .map((skillView) => {
          if (skillView.effectiveSkillNumber <= 0) {
            return null;
          }

          return {
            avgStats: skillView.linkedStatAverage,
            grantedSkillXp: skillView.relationshipGrantedSkillLevel ?? 0,
            literacyWarning: skillView.literacyWarning,
            skillType: getPlayerFacingSkillBucket(skill),
            skillGroupXp: skillView.groupLevel,
            skillId: getCharacterSkillKey({
              languageName: skillView.languageName,
              skillId: skill.id
            }),
            skillName: getSkillDisplayName({
              languageName: skillView.languageName,
              skill
            }),
            skillXp: skillView.specificSkillLevel,
            stats: formatSkillStats(skill),
            totalSkillLevel: skillView.totalSkill,
            totalXp: skillView.effectiveSkillNumber
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    });
  const groupedPlayerSkillTableRows = groupRowsBySkillType(playerSkillTableRows);
  const specializationRows = [...content.specializations]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((specialization) => {
      const parentSkill = content.skills.find((skill) => skill.id === specialization.skillId);
      const parentMetrics = parentSkill
        ? getSkillAllocationMetrics({
            content,
            draftView,
            profile: selectedProfile,
            skill: parentSkill
          })
        : undefined;
      const specializationView = draftView.specializations.find(
        (item) => item.specializationId === specialization.id
      );
      const evaluation = evaluateSkillSelection({
        content,
        progression,
        target: {
          specialization,
          targetType: "specialization"
        }
      });

      return {
        grantedSourceLabel: specializationView
          ? formatDerivedSkillSourceLabel({
              sourceSkillName: specializationView.relationshipGrantedSourceSkillName,
              sourceType: specializationView.relationshipGrantedSourceType
            })
          : undefined,
        grantedSpecializationLevel:
          specializationView?.relationshipGrantedSpecializationLevel ?? 0,
        evaluation,
        parentSkillLevel: (parentMetrics?.groupXp ?? 0) + (parentMetrics?.skillXp ?? 0),
        parentSkillName: parentSkill?.name ?? specialization.skillId,
        secondaryRanks: specializationView?.secondaryRanks ?? 0,
        specialization,
        specializationName: specialization.name,
        specializationLevel: specializationView?.specializationLevel ?? 0
      };
    });
  const visibleSpecializationRows = filterSpecializationBrowseItems({
    includeBlocked: showAllSpecializations,
    items: specializationRows,
    search: specializationSearch
  });
  const specializationFilterActive =
    specializationSearch.trim().length > 0 || showAllSpecializations;

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [cachedContent, sessionUser, activeRuleSet] = await Promise.all([
        contentCacheRepository.get(CONTENT_CACHE_KEY),
        getCurrentSessionUser().catch(() => null),
        loadActiveChargenRuleSet().catch(() => DEFAULT_CHARGEN_RULE_SET)
      ]);

      if (cancelled) {
        return;
      }

      const startingContent = cachedContent
        ? validateCanonicalContent(cachedContent.value)
        : defaultCanonicalContent;

      if (cachedContent) {
        setContent(startingContent);
      }

      setCurrentUser(sessionUser);
      setChargenRuleSet(activeRuleSet);
      setProgression((current) => ({
        ...current,
        flexiblePointFactor: activeRuleSet.flexiblePointFactor,
        primaryPoolTotal: activeRuleSet.ordinarySkillPoints
      }));

      setHydrated(true);

      try {
        const response = await fetch(`${API_BASE_URL}/content`);

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ContentResponse;

        if (cancelled) {
          return;
        }

        const normalizedContent = validateCanonicalContent(payload.content);

        setContent(normalizedContent);
        await contentCacheRepository.save(CONTENT_CACHE_KEY, normalizedContent, "v1");
      } catch {
        // Seed and cache already cover the local-first case.
      }
    }

    hydrate().catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedCivilizationId) {
      return;
    }

    if (civilizations.length === 1) {
      setSelectedCivilizationId(civilizations[0].id);
      setShowCivilizationChooser(false);
    }
  }, [civilizations, selectedCivilizationId]);

  useEffect(() => {
    if (!hydrated || selectedProfessionId || !selectedSocietyAccess) {
      return;
    }

    if (availableProfessions.length === 1) {
      setSelectedProfessionId(availableProfessions[0].id);
      setShowProfessionChooser(false);
      setProgression(
        applyProfessionGrants({
          content,
          professionId: availableProfessions[0].id,
          ruleSet: chargenRuleSet
        })
      );
    }
  }, [
    availableProfessions,
    chargenRuleSet,
    content,
    hydrated,
    selectedProfessionId,
    selectedSocietyAccess
  ]);

  useEffect(() => {
    if (!hydrated || !hasStartedChargen) {
      return;
    }

    if (
      selectedProfessionId &&
      !availableProfessions.some((profession) => profession.id === selectedProfessionId)
    ) {
      setSelectedProfessionId(undefined);
      setProgression(createChargenProgression("standard", chargenRuleSet));
      setFeedback(["Profession selection was cleared because society access changed."]);
    }
  }, [availableProfessions, chargenRuleSet, hydrated, selectedProfessionId]);

  useEffect(() => {
    if (
      expandedProfessionId &&
      !availableProfessions.some((profession) => profession.id === expandedProfessionId)
    ) {
      setExpandedProfessionId(undefined);
    }
  }, [availableProfessions, expandedProfessionId]);

  useEffect(() => {
    setExpandedAllocationSections(defaultExpandedAllocationSections);
    setShowOtherSkills(false);
    setShowSpecializations(false);
  }, [defaultExpandedAllocationSections, selectedProfessionId]);

  useEffect(() => {
    if (!selectedRolledProfile) {
      return;
    }

    setProfileAdjustments((current) => {
      if (current[selectedRolledProfile.id]) {
        return current;
      }

      return {
        ...current,
        [selectedRolledProfile.id]: createChargenStatAdjustmentState(selectedRolledProfile.rolledStats)
      };
    });
  }, [selectedRolledProfile]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    chargenSessionRepository
      .save({
        id: SESSION_ID,
        progression,
        selectedProfessionId,
        selectedProfile,
        selectedSocialClass: selectedSocietyAccess?.socialClass,
        selectedSocietyId,
        selectedSocietyLevel: selectedSocietyBand
      })
      .catch((error) => {
        console.error(error);
      });
  }, [
    hasStartedChargen,
    hydrated,
    progression,
    selectedProfessionId,
    selectedProfile,
    selectedSocietyBand,
    selectedSocietyAccess,
    selectedSocietyId
  ]);

  function handleCivilizationChange(civilizationId: string) {
    const nextCivilization = civilizations.find((civilization) => civilization.id === civilizationId);
    const nextSocietyId = nextCivilization?.linkedSocietyId;
    const societyChanged = nextSocietyId !== selectedSocietyId;

    setSelectedCivilizationId(civilizationId);
    setShowCivilizationChooser(false);

    if (!societyChanged) {
      setFeedback(["Civilization updated. Society and profession access remain unchanged."]);
      return;
    }

    setSelectedProfessionId(undefined);
    setShowProfessionChooser(true);
    setProgression(createChargenProgression("standard", chargenRuleSet));
    setRowActionFeedback({});
    setExpandedSkillDetails([]);
    setFeedback(["Changing civilization changed the inferred society, so profession access and point allocation were reset."]);
  }

  function handleProfessionChange(professionId: string) {
    setSelectedProfessionId(professionId);
    setShowProfessionChooser(false);
    setExpandedProfessionId(professionId);
    setProgression(
      applyProfessionGrants({
        content,
        professionId,
        ruleSet: chargenRuleSet
      })
    );
    setRowActionFeedback({});
    setExpandedSkillDetails([]);
    setFeedback(["Profession access loaded. Skill allocation, education, and review are ready."]);
  }

  function handleSelectGroupSlotSkill(groupId: string, slotId: string, skillId: string) {
    setProgression((current) => {
      const selectableSummary = buildChargenSelectableSkillSummary({
        content,
        professionId: selectedProfessionId,
        progression: current,
        societyId: selectedSocietyId,
        societyLevel: selectedSocietyBand
      });
      const slot = selectableSummary.selectionSlots.find(
        (candidate) => candidate.groupId === groupId && candidate.slotId === slotId
      );

      if (!slot || !slot.candidateSkillIds.includes(skillId)) {
        return current;
      }

      const existingSelections = current.chargenSelections?.selectedGroupSlots ?? [];
      const nextSelections = existingSelections.filter(
        (selection) => !(selection.groupId === groupId && selection.slotId === slotId)
      );
      const selectedSkillIds = new Set(slot.selectedSkillIds);

      if (selectedSkillIds.has(skillId)) {
        selectedSkillIds.delete(skillId);
      } else if (slot.chooseCount === 1) {
        selectedSkillIds.clear();
        selectedSkillIds.add(skillId);
      } else if (selectedSkillIds.size < slot.chooseCount) {
        selectedSkillIds.add(skillId);
      } else {
        return current;
      }

      nextSelections.push({
        groupId,
        selectedSkillIds: [...selectedSkillIds],
        slotId
      });

      return {
        ...current,
        chargenSelections: {
          selectedLanguageIds: current.chargenSelections?.selectedLanguageIds ?? [],
          selectedGroupSlots: nextSelections,
          selectedSkillIds: current.chargenSelections?.selectedSkillIds ?? []
        }
      };
    });
  }

  function handleToggleLanguageSelection(languageId: string) {
    setProgression((current) => {
      const currentLanguageSummary = buildChargenLanguageSelectionSummary({
        civilizationId: selectedCivilizationId,
        content,
        progression: current,
        societyId: selectedSocietyId
      });

      if (!currentLanguageSummary.selectableLanguageIds.includes(languageId)) {
        return current;
      }

      const language = currentLanguageSummary.selectableLanguages.find(
        (candidate) => candidate.id === languageId
      );

      if (!language) {
        return current;
      }

      const languageSkillKey = getCharacterSkillKey({
        languageName: language.name,
        skillId: "language"
      });
      const existingSkill = current.skills.find(
        (skill) => getCharacterSkillKey(skill) === languageSkillKey
      );
      const currentSelections = new Set(current.chargenSelections?.selectedLanguageIds ?? []);

      if (currentSelections.has(languageId)) {
        const investedRanks =
          (existingSkill?.grantedRanks ?? 0) +
          (existingSkill?.primaryRanks ?? 0) +
          (existingSkill?.secondaryRanks ?? 0);

        if (investedRanks > 0) {
          setFeedback([`Remove ranks from Language (${language.name}) before unselecting it.`]);
          return current;
        }

        currentSelections.delete(languageId);
      } else {
        currentSelections.add(languageId);
      }

      return {
        ...current,
        chargenSelections: {
          selectedLanguageIds: [...currentSelections],
          selectedGroupSlots: current.chargenSelections?.selectedGroupSlots ?? [],
          selectedSkillIds: current.chargenSelections?.selectedSkillIds ?? []
        }
      };
    });
  }

  function toggleProfessionPreview(professionId: string) {
    setExpandedProfessionId((current) => (current === professionId ? undefined : professionId));
  }

  function toggleSkillDetails(skillId: string) {
    setExpandedSkillDetails((current) =>
      current.includes(skillId)
        ? current.filter((candidate) => candidate !== skillId)
        : [...current, skillId]
    );
  }

  function toggleAllocationSection(sectionId: string) {
    setExpandedAllocationSections((current) =>
      current.includes(sectionId)
        ? current.filter((candidate) => candidate !== sectionId)
        : [...current, sectionId]
    );
  }

  function handleProfileSelect(profileId: string) {
    setSelectedProfileId(profileId);
    setShowRolledProfileOptions(false);
    setRowActionFeedback({});
  }

  function handleResetStatAdjustments() {
    if (!selectedRolledProfile) {
      return;
    }

    setProfileAdjustments((current) => ({
      ...current,
      [selectedRolledProfile.id]: createChargenStatAdjustmentState(selectedRolledProfile.rolledStats)
    }));
    setFeedback(["Stat exchanges and builds were reset to the selected roll."]);
  }

  function handleExchangeStats() {
    if (!selectedRolledProfile || !selectedAdjustment) {
      return;
    }

    const result = applyChargenStatExchange({
      firstStat: exchangeFirstStat,
      policy: chargenPolicy,
      secondStat: exchangeSecondStat,
      state: selectedAdjustment
    });

    if (result.error) {
      setFeedback([result.error]);
      return;
    }

    setProfileAdjustments((current) => ({
      ...current,
      [selectedRolledProfile.id]: result.state
    }));
    setFeedback([
      `${glantriCharacteristicLabels[exchangeFirstStat]} and ${glantriCharacteristicLabels[exchangeSecondStat]} were exchanged.`
    ]);
  }

  function handleBuildStats() {
    if (!selectedRolledProfile || !selectedAdjustment) {
      return;
    }

    const result = applyChargenStatBuild({
      decreaseStat: buildDecreaseStat,
      increaseStat: buildIncreaseStat,
      policy: chargenPolicy,
      state: selectedAdjustment
    });

    if (result.error) {
      setFeedback([result.error]);
      return;
    }

    setProfileAdjustments((current) => ({
      ...current,
      [selectedRolledProfile.id]: result.state
    }));
    setFeedback([
      `${glantriCharacteristicLabels[buildIncreaseStat]} increased by 1 and ${glantriCharacteristicLabels[buildDecreaseStat]} decreased by 2.`
    ]);
  }

  async function handleStartChargen() {
    await chargenSessionRepository.delete(SESSION_ID);

    setHasStartedChargen(true);
    setRolledProfiles(generateProfiles({ ruleSet: chargenRuleSet }));
    setProfileAdjustments({});
    setCharacterName("");
    setFeedback([]);
    setProgression(createChargenProgression("standard", chargenRuleSet));
    setRowActionFeedback({});
    setSelectedProfileId(undefined);
    setSelectedProfessionId(undefined);
    setSelectedCivilizationId(undefined);
    setShowRolledProfileOptions(true);
    setShowCivilizationChooser(true);
    setShowProfessionChooser(true);
    setExpandedProfessionId(undefined);
    setExpandedAllocationSections([]);
    setExpandedSkillDetails([]);
    setShowOtherSkills(false);
    setShowSpecializations(false);
    setSkillVisibilityFilter("all");
    setSkillSearch("");
    setSkillTypeFilter("all");
    setSpecializationSearch("");
    setShowAllSpecializations(false);
  }

  function handleAllocate(
    targetId: string,
    targetType: "group" | "skill",
    targetLanguageName?: string
  ) {
    if (!skillAllocationContext) {
      return;
    }

    const result = allocateChargenPoint({
      ...skillAllocationContext,
      targetLanguageName,
      targetId,
      targetType
    });
    const feedbackTargetId =
      targetType === "skill"
        ? getCharacterSkillKey({
            languageName: targetLanguageName,
            skillId: targetId
          })
        : targetId;

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      if (targetType === "skill") {
        setRowActionFeedback((current) => ({
          ...current,
          [getRowActionFeedbackKey(feedbackTargetId, targetType)]: message
        }));

        if (result.warnings.length > 0) {
          setFeedback(result.warnings);
        }

        return;
      }

      setFeedback([message, ...result.warnings]);
      return;
    }

    setRowActionFeedback((current) => {
      const next = { ...current };
      delete next[getRowActionFeedbackKey(feedbackTargetId, targetType)];
      return next;
    });
    setProgression(result.progression);
    setFeedback([
      `Allocated ${result.spentCost ?? 0} point to ${
        targetType === "group" ? "the skill group" : "the skill"
      }.`,
      ...result.warnings
    ]);
  }

  function handleRemoveAllocation(
    targetId: string,
    targetType: "group" | "skill",
    targetLanguageName?: string
  ) {
    if (!skillAllocationContext) {
      return;
    }

    const result = removeChargenPoint({
      ...skillAllocationContext,
      targetLanguageName,
      targetId,
      targetType
    });
    const feedbackTargetId =
      targetType === "skill"
        ? getCharacterSkillKey({
            languageName: targetLanguageName,
            skillId: targetId
          })
        : targetId;

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      if (targetType === "skill") {
        setRowActionFeedback((current) => ({
          ...current,
          [getRowActionFeedbackKey(feedbackTargetId, targetType)]: message
        }));

        if (result.warnings.length > 0) {
          setFeedback(result.warnings);
        }

        return;
      }

      setFeedback([message, ...result.warnings]);
      return;
    }

    setRowActionFeedback((current) => {
      const next = { ...current };
      delete next[getRowActionFeedbackKey(feedbackTargetId, targetType)];
      return next;
    });
    setProgression(result.progression);
    setFeedback([
      `Removed ${result.spentCost ?? 0} point from ${
        targetType === "group" ? "the skill group" : "the skill"
      }.`,
      ...result.warnings
    ]);
  }

  function handleAllocateSpecialization(specializationId: string) {
    if (!skillAllocationContext) {
      return;
    }

    const result = spendSecondaryPoint({
      ...skillAllocationContext,
      targetId: specializationId,
      targetType: "specialization"
    });

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      setRowActionFeedback((current) => ({
        ...current,
        [getRowActionFeedbackKey(specializationId, "specialization")]: message
      }));

      if (result.warnings.length > 0) {
        setFeedback(result.warnings);
      }

      return;
    }

    setRowActionFeedback((current) => {
      const next = { ...current };
      delete next[getRowActionFeedbackKey(specializationId, "specialization")];
      return next;
    });
    setProgression(result.progression);
    setFeedback([
      `Allocated ${result.spentCost ?? 0} flexible point to the specialization.`,
      ...result.warnings
    ]);
  }

  function handleRemoveSpecialization(specializationId: string) {
    if (!skillAllocationContext) {
      return;
    }

    const result = removeSecondaryPoint({
      ...skillAllocationContext,
      targetId: specializationId,
      targetType: "specialization"
    });

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      setRowActionFeedback((current) => ({
        ...current,
        [getRowActionFeedbackKey(specializationId, "specialization")]: message
      }));

      if (result.warnings.length > 0) {
        setFeedback(result.warnings);
      }

      return;
    }

    setRowActionFeedback((current) => {
      const next = { ...current };
      delete next[getRowActionFeedbackKey(specializationId, "specialization")];
      return next;
    });
    setProgression(result.progression);
    setFeedback([
      `Removed ${result.spentCost ?? 0} flexible point from the specialization.`,
      ...result.warnings
    ]);
  }

  function renderSkillRowsTable(input: {
    emptyMessage: string;
    rows: SkillBrowseRow[];
    showOutsideNormalAccessBadge?: boolean;
    showTypeBadge?: boolean;
  }) {
    return (
      <div className={styles.tableContainer}>
        <div className={`${styles.tableHeader} ${styles.skillTableHeader}`}>
          <strong>Skill</strong>
          <strong>Group XP</strong>
          <strong>Ordinary</strong>
          <strong>Flexible</strong>
          <strong>Derived XP</strong>
          <strong>Total XP</strong>
          <strong>Actions</strong>
        </div>

        {input.rows.length > 0 ? (
          input.rows.map((row) => {
            const { feedback: rowFeedback, statusItems: ruleStatusItems } = getSkillRowMessages({
              evaluation: row.evaluation,
              persistedRowFeedback: rowActionFeedback[getRowActionFeedbackKey(row.rowKey, "skill")],
              skill: row.skill
            });
            const skillType = getPlayerFacingSkillBucket(row.skill);
            const skillTypeLabel =
              playerFacingSkillBucketDefinitions.find((definition) => definition.id === skillType)
                ?.label ?? skillType;
            const isDetailOpen = expandedSkillDetails.includes(row.rowKey);
            const nextCost = getOrdinarySkillNextCost({
              isNormalAccess: row.isNormalAccess,
              progression,
              skill: row.skill
            });
            const dependencySummaries = row.skill.dependencies.map((dependency) => {
              const dependencyRow = skillRowsById.get(dependency.skillId);
              const dependencySkill = content.skills.find((skill) => skill.id === dependency.skillId);

              return {
                dependency,
                dependencyName: dependencySkill?.name ?? dependency.skillId,
                dependencyRow
              };
            });

            return (
              <div key={row.rowKey} className={styles.skillTableRow}>
                <div className={styles.skillTableRowCols}>
                  <div className={styles.grid035}>
                    <div className={styles.flexWrap05}>
                      <span>{row.displayName}</span>
                      <span className={getSkillTierClass(row.skill)}>{getSkillTierLabel(row.skill)}</span>
                      {row.sourceTag === "mother-tongue" ? (
                        <span className={getBadgeClass({ muted: true })}>Mother tongue</span>
                      ) : null}
                      {row.skill.id === "literacy" && selectedProfessionCard?.hasLiteracyFoundation ? (
                        <span className={getBadgeClass()}>Foundation skill</span>
                      ) : null}
                    </div>
                    <div className={styles.flexWrap035}>
                      {input.showTypeBadge ? (
                        <span key={`${row.rowKey}-${skillType}`} className={getBadgeClass({ muted: true })}>
                          {skillTypeLabel}
                        </span>
                      ) : null}
                      {input.showOutsideNormalAccessBadge ? (
                        <span className={getBadgeClass({ muted: true })}>Outside normal access</span>
                      ) : null}
                      <button onClick={() => toggleSkillDetails(row.rowKey)} type="button">
                        {isDetailOpen ? "Hide details" : "Details"}
                      </button>
                    </div>
                    <div className={styles.mutedXs}>
                      Next cost {nextCost} {row.isNormalAccess ? "ordinary/flexible" : "flexible"} points
                    </div>
                  </div>
                  <div>{row.metrics.groupXp}</div>
                  <div>{row.metrics.ordinaryXp}</div>
                  <div>{row.metrics.flexibleXp}</div>
                  <div>{row.metrics.grantedXp}</div>
                  <div>{row.metrics.totalXp}</div>
                  <div className={styles.flexWrap05}>
                    <button
                      aria-label={`Add ${row.skill.name}`}
                      disabled={!skillAllocationContext || !row.evaluation.isAllowed}
                      onClick={() =>
                        handleAllocate(row.skill.id, "skill", row.targetLanguageName)
                      }
                      type="button"
                    >
                      +
                    </button>
                    <button
                      aria-label={`Remove ${row.skill.name}`}
                      disabled={!skillAllocationContext}
                      onClick={() =>
                        handleRemoveAllocation(row.skill.id, "skill", row.targetLanguageName)
                      }
                      type="button"
                    >
                      -
                    </button>
                  </div>
                </div>
                {ruleStatusItems.map((status) => (
                  <div
                    key={`${row.rowKey}-${status.tone}-${status.message}`}
                    role="status"
                    className={getRuleStatusClass(status.tone)}
                  >
                    {status.message}
                  </div>
                ))}
                {isDetailOpen ? (
                  <div className={styles.innerCard}>
                    <div className={styles.darkMuted}>
                      {row.skill.shortDescription ?? row.skill.description ?? "No short description yet."}
                    </div>
                    {row.skill.description &&
                    row.skill.description !== row.skill.shortDescription ? (
                      <div className={styles.mutedSm}>
                        {row.skill.description}
                      </div>
                    ) : null}
                    <div className={styles.flexWrap05}>
                      <span className={getBadgeClass({ muted: true })}>
                        Owned XP {row.metrics.skillXp}
                      </span>
                      <span className={getBadgeClass({ muted: true })}>
                        Group-derived value {row.metrics.groupXp}
                      </span>
                      <span className={getBadgeClass({ muted: true })}>
                        Derived/cross-training XP {row.metrics.grantedXp}
                      </span>
                      <span className={getBadgeClass({ muted: true })}>
                        Effective total {row.metrics.totalXp}
                      </span>
                    </div>
                    {row.grantedSourceLabel ? (
                      <div className={styles.mutedXs}>
                        {row.grantedSourceLabel}
                      </div>
                    ) : null}
                    <div className={styles.mutedXs}>
                      Access:{" "}
                      {row.sourceLabels.length > 0
                        ? row.sourceLabels.join(", ")
                        : input.showOutsideNormalAccessBadge
                          ? "Outside normal access"
                          : "Current section access"}
                    </div>
                    {dependencySummaries.length > 0 ? (
                      <div className={styles.grid025}>
                        <strong className={styles.textSm}>Prerequisites and support</strong>
                        {dependencySummaries.map(({ dependency, dependencyName, dependencyRow }) => (
                          <div key={`${row.rowKey}-${dependency.skillId}`} className={styles.textXs}>
                            {`${dependency.strength}. ${formatDependencyOwnershipSummary({
                              dependencyName,
                              directSkillLevel: dependencyRow?.metrics.skillXp ?? 0,
                              effectiveSkillLevel: dependencyRow?.metrics.totalXp ?? 0
                            })}`}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {row.skill.requiresLiteracy !== "no" ? (
                      <div className={styles.mutedXs}>
                        {row.skill.requiresLiteracy === "required"
                          ? "Literacy is functionally required for full use of this skill."
                          : "Literacy is recommended for fuller use of this skill."}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {rowFeedback ? (
                  <div role="status" className={styles.statusWarning}>
                    {rowFeedback}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className={styles.emptyTableRow}>{input.emptyMessage}</div>
        )}
      </div>
    );
  }

  async function handleFinalize() {
    if (!selectedSocietyId || selectedSocialBand === undefined) {
      return;
    }

    if (isFinalizing) {
      return;
    }

    const result = finalizeChargenDraft({
      civilizationId: selectedCivilizationId,
      content,
      name: characterName,
      professionId: selectedProfessionId,
      profile: selectedProfile,
      progression,
      ruleSet: {
        id: chargenRuleSet.id,
        name: chargenRuleSet.name,
        parameters: chargenRuleSet
      },
      socialClass: selectedSocietyAccess?.socialClass,
      societyId: selectedSocietyId,
      societyLevel: selectedSocialBand
    });

    if (!result.build) {
      setFeedback([...result.errors, ...result.warnings]);
      return;
    }

    const finalizedBuild = result.build;
    setIsFinalizing(true);

    try {
      const existingRecord = await localCharacterRepository.get(finalizedBuild.id);

      if (existingRecord?.syncStatus === "synced") {
        await chargenSessionRepository.delete(SESSION_ID);
        router.push(`/characters/${existingRecord.id}`);
        return;
      }

      let finalizedRecord;

      if (currentUser) {
        const serverRecord = await saveCharacterToServer(finalizedBuild);

        finalizedRecord = await localCharacterRepository.save({
          build: serverRecord.build,
          createdAt: serverRecord.createdAt,
          creatorDisplayName: currentUser.displayName,
          creatorEmail: currentUser.email,
          creatorId: currentUser.id,
          finalizedAt: serverRecord.createdAt,
          syncStatus: "synced",
          updatedAt: serverRecord.updatedAt
        });
      } else {
        finalizedRecord = await localCharacterRepository.save({
          build: finalizedBuild
        });
      }

      await chargenSessionRepository.delete(SESSION_ID);
      router.push(`/characters/${finalizedRecord.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to finalize and save the character.";
      setFeedback([message]);
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <section className={styles.root}>
      <div className={styles.chargenHeader}>
        <h1>Chargen</h1>
        <div className={styles.chargenSubtitle}>Draft saved locally.</div>
      </div>

      <FeedbackPanel messages={feedback} />

      {!hasStartedChargen ? <StartStep onStart={() => void handleStartChargen()} /> : null}

      {hasStartedChargen ? (
        <>

      <StatsStep
        formatProfileSocialBand={formatProfileSocialBand}
        onExpandStats={() => setShowRolledProfileOptions(true)}
        onProfileSelect={handleProfileSelect}
        onToggleStats={() => setShowRolledProfileOptions((current) => !current)}
        selectedProfileId={selectedProfileId}
        selectedRolledProfile={selectedRolledProfile}
        selectedRolledProfileSummary={selectedRolledProfileSummary}
        showRolledProfileOptions={showRolledProfileOptions}
        sortedRolledProfiles={sortedRolledProfiles}
      />
      <ResolveStatsStep
        buildDecreaseStat={buildDecreaseStat}
        buildDisabled={buildDisabled}
        buildIncreaseStat={buildIncreaseStat}
        buildLimit={chargenPolicy.maxBuilds}
        exchangeDisabled={exchangeDisabled}
        exchangeFirstStat={exchangeFirstStat}
        exchangeLimit={chargenPolicy.maxExchanges}
        exchangeSecondStat={exchangeSecondStat}
        onBuildDecreaseStatChange={setBuildDecreaseStat}
        onBuildIncreaseStatChange={setBuildIncreaseStat}
        onBuildStats={handleBuildStats}
        onExchangeFirstStatChange={setExchangeFirstStat}
        onExchangeSecondStatChange={setExchangeSecondStat}
        onExchangeStats={handleExchangeStats}
        onResetStatAdjustments={handleResetStatAdjustments}
        selectedAdjustment={selectedAdjustment}
        selectedProfile={selectedProfile}
        selectedResolvedStats={selectedResolvedStats}
        selectedRolledProfile={selectedRolledProfile}
      />
      <section className={`${styles.stepSection}${!selectedProfile ? ` ${styles.dimmed}` : ""}`}>
        <h2 className={styles.heading}>3. Choose civilization</h2>
        <div className={styles.hint}>
          Choose the civilization that frames this character&apos;s culture and language naming.
          Chargen will infer the linked society automatically for class labels, foundational
          access, education, and profession access.
        </div>
        {selectedCivilization && !showCivilizationChooser ? (
          <div className={styles.card}>
            <div className={styles.twoColAuto}>
              <div className={styles.grid035}>
                <strong>{selectedCivilization.name}</strong>
                <div className={styles.muted}>
                  {selectedCivilization.shortDescription ??
                    "Selected civilization for cultural framing and language naming."}
                </div>
              </div>
              <button
                disabled={!selectedProfile}
                onClick={() => setShowCivilizationChooser(true)}
                type="button"
              >
                Change civilization
              </button>
            </div>
            <div className={`${styles.grid035} ${styles.textNote}`}>
              <div>
                Spoken language: {selectedCivilization.spokenLanguageName}
                {selectedCivilization.writtenLanguageName &&
                selectedCivilization.writtenLanguageName !== selectedCivilization.spokenLanguageName
                  ? ` • Written ${selectedCivilization.writtenLanguageName}`
                  : ""}
              </div>
              <div>
                Inferred society: {selectedCivilization.linkedSocietyName} • Level{" "}
                {selectedCivilization.linkedSocietyLevel}
              </div>
              {motherTongueSummary.displayLabel ? (
                <div>
                  Mother tongue: {motherTongueSummary.displayLabel} • Starting XP{" "}
                  {motherTongueSummary.startingLevel}
                </div>
              ) : null}
              {languageSelectionSummary.selectableLanguages.length > 0 ? (
                <div>
                  Optional languages:{" "}
                  {languageSelectionSummary.selectableLanguages.map((language) => language.name).join(", ")}
                </div>
              ) : null}
              <div>Band labels: {selectedSociety ? formatSocietyBandLabels(selectedSociety) : "—"}</div>
              {selectedCivilization.historicalAnalogue ? (
                <div>Historical analogue: {selectedCivilization.historicalAnalogue}</div>
              ) : null}
              {selectedCivilization.period ? <div>Period: {selectedCivilization.period}</div> : null}
              {selectedCivilization.notes ? <div>{selectedCivilization.notes}</div> : null}
              {civilizations.length === 1 ? <div>Only available civilization at present.</div> : null}
            </div>
          </div>
        ) : (
          <div className={styles.grid075}>
            {selectedCivilization ? (
              <div className={styles.flexEnd}>
                <button
                  disabled={!selectedProfile}
                  onClick={() => setShowCivilizationChooser(false)}
                  type="button"
                >
                  Collapse selected summary
                </button>
              </div>
            ) : null}
            {civilizations.map((civilization) => (
              <label
                key={civilization.id}
                className={selectedProfile ? styles.optionLabel : styles.optionLabelDisabled}
              >
                <div className={styles.flexCenter075}>
                  <input
                    checked={selectedCivilizationId === civilization.id}
                    disabled={!selectedProfile}
                    name="civilization"
                    onChange={() => handleCivilizationChange(civilization.id)}
                    type="radio"
                  />
                  <strong>{civilization.name}</strong>
                </div>
                <div className={styles.detailMt05}>
                  {civilization.shortDescription}
                </div>
                <div className={styles.detailMt025}>
                  Spoken language: {civilization.spokenLanguageName}
                  {civilization.writtenLanguageName &&
                  civilization.writtenLanguageName !== civilization.spokenLanguageName
                    ? ` • Written ${civilization.writtenLanguageName}`
                    : ""}
                </div>
                <div className={styles.detailMt025}>
                  Society: {civilization.linkedSocietyName} • Level {civilization.linkedSocietyLevel}
                </div>
                {civilization.historicalAnalogue ? (
                  <div className={styles.detailMt025}>
                    Historical analogue: {civilization.historicalAnalogue}
                  </div>
                ) : null}
                {civilizations.length === 1 ? (
                  <div className={styles.detailMt025}>Only available civilization at present.</div>
                ) : null}
                {civilization.notes ? (
                  <div className={styles.detailMt025}>{civilization.notes}</div>
                ) : null}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className={`${styles.stepSection}${!(selectedProfile && selectedSociety) ? ` ${styles.dimmed}` : ""}`}>
        <h2 className={styles.heading}>4. Social class</h2>
        <div className={styles.hint}>
          Your social roll maps to one of four universal bands. Civilization is the cultural
          selector, while the inferred society determines the structural class label for that band.
        </div>
        <div className={styles.socialClassCard}>
          {selectedProfile && selectedSociety && selectedSocialBand !== undefined && selectedSocietyAccess ? (
            <>
              <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
              <div>Society: {selectedSociety.name}</div>
              <div>Roll: {selectedProfile.socialClassRoll ?? "?"}</div>
              <div>
                Band: {selectedSocialBand} ({getBandRangeLabel(selectedSocialBand)})
              </div>
              <div>
                Social class: <strong>{selectedSocietyAccess.socialClass}</strong>
              </div>
              <div className={styles.socialClassMt05}>
                This result determines later skill, base education, and profession access.
              </div>
            </>
          ) : (
            <span>Select a rolled profile to reveal social status.</span>
          )}
        </div>
      </section>

      <section className={`${styles.stepSection}${!selectedSocietyAccess ? ` ${styles.dimmed}` : ""}`}>
        <h2 className={styles.heading}>5. Choose profession</h2>
        <div className={styles.hint}>
          Pick a profession subtype, then review the included profession packages. Favored package
          preview shows likely reach, not a direct grant by itself.
        </div>
        <div className={styles.grid075}>
          {availableProfessions.length > 0 ? (
            <>
              {selectedProfessionCard && !showProfessionChooser ? (
                <section className={styles.card}>
                  <div className={styles.twoColAuto}>
                    <div className={styles.grid035}>
                      <div className={styles.flexWrap05}>
                        <strong>{selectedProfessionCard.subtypeName}</strong>
                        <span className={getBadgeClass()}>{selectedProfessionCard.familyName}</span>
                      </div>
                      <div className={styles.muted}>
                        {selectedProfessionCard.description ??
                          selectedProfessionCard.familyDescription ??
                          "No notes yet."}
                      </div>
                    </div>
                    <button onClick={() => setShowProfessionChooser(true)} type="button">
                      Change profession
                    </button>
                  </div>
                  <div className={styles.flexWrap05}>
                    <span className={getBadgeClass({ muted: true })}>
                      Core reach {selectedProfessionCard.summary.totalEffectiveCoreReachableSkills}
                    </span>
                    <span className={getBadgeClass({ muted: true })}>
                      Favored reach {selectedProfessionCard.summary.totalEffectiveFavoredReachableSkills}
                    </span>
                    <span className={getBadgeClass({ muted: true })}>
                      Included training packages {selectedProfessionCard.normalAccessGroupNames.length}
                    </span>
                    {selectedProfessionCard.hasLiteracyFoundation ? (
                      <span className={getBadgeClass()}>Literacy matters here</span>
                    ) : null}
                  </div>
                  <div className={`${styles.grid035} ${styles.textNote}`}>
                    <div>
                      Included training packages:{" "}
                      {formatPreviewList(selectedProfessionCard.normalAccessGroupNames)}
                    </div>
                    <div>
                      Favored direct skills worth watching:{" "}
                      {formatPreviewList(selectedProfessionCard.favoredDirectOnlySkillNames)}
                    </div>
                    {selectedProfessionCard.hasLiteracyFoundation ? (
                      <div>
                        Literacy foundation: this profession path reaches{" "}
                        {selectedProfessionCard.literacyGatedReachableSkillCount} literacy-linked
                        skill
                        {selectedProfessionCard.literacyGatedReachableSkillCount === 1 ? "" : "s"}.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : (
                <>
                  <div className={styles.searchBar2Col}>
                    <label className={styles.grid035}>
                      <span>Search professions</span>
                      <input
                        onChange={(event) => setProfessionSearch(event.target.value)}
                        placeholder="Search by subtype, family, or notes"
                        type="search"
                        value={professionSearch}
                      />
                    </label>
                    <label className={styles.grid035}>
                      <span>Family</span>
                      <select
                        onChange={(event) => setProfessionFamilyFilter(event.target.value)}
                        value={professionFamilyFilter}
                      >
                        <option value="all">All families</option>
                        {professionFamilyOptions.map((familyName) => (
                          <option key={familyName} value={familyName}>
                            {familyName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {visibleProfessionCards.length > 0 ? (
                    visibleProfessionCards.map((profession) => {
                      const isExpanded = activeProfessionPreviewId === profession.id;

                      return (
                        <section
                          key={profession.id}
                          className={selectedProfessionId === profession.id ? styles.cardWhiteSelected : styles.cardWhite}
                        >
                          <div className={styles.twoColAuto}>
                            <div className={styles.grid035}>
                              <label
                                className={selectedSociety ? styles.optionLabelFlex : styles.optionLabelFlexDisabled}
                              >
                                <input
                                  checked={selectedProfessionId === profession.id}
                                  disabled={!selectedSociety}
                                  name="profession"
                                  onChange={() => handleProfessionChange(profession.id)}
                                  type="radio"
                                />
                                <strong>{profession.subtypeName}</strong>
                                <span className={getBadgeClass()}>{profession.familyName}</span>
                                {selectedProfessionId === profession.id ? (
                                  <span className={getBadgeClass()}>Selected</span>
                                ) : null}
                              </label>
                              <div className={styles.muted}>
                                {profession.description ?? profession.familyDescription ?? "No notes yet."}
                              </div>
                              <div className={styles.flexWrap05}>
                                <span className={getBadgeClass({ muted: true })}>
                                  Core reach {profession.summary.totalEffectiveCoreReachableSkills}
                                </span>
                                <span className={getBadgeClass({ muted: true })}>
                                  Favored reach {profession.summary.totalEffectiveFavoredReachableSkills}
                                </span>
                                <span className={getBadgeClass({ muted: true })}>
                                  Included training packages {profession.normalAccessGroupNames.length}
                                </span>
                                {profession.hasLiteracyFoundation ? (
                                  <span className={getBadgeClass()}>Literacy matters here</span>
                                ) : null}
                              </div>
                            </div>

                            <button
                              onClick={() => toggleProfessionPreview(profession.id)}
                              type="button"
                            >
                              {isExpanded ? "Hide details" : "Preview"}
                            </button>
                          </div>

                          {isExpanded ? (
                            <div className={styles.innerCard}>
                              <div className={styles.muted}>
                                Skill areas organize the allocation view. Inside each area, you may
                                have included training packages, and those packages open into the
                                actual skills you can raise.
                              </div>
                              <div className={styles.grid035}>
                                <div className={styles.flexCenter075}>
                                  <strong>Included profession package</strong>
                                  <span className={getBadgeClass()}>Direct grant</span>
                                </div>
                                <div>
                                  Included training packages: {formatPreviewList(profession.coreGroupNames)}
                                </div>
                                <div>
                                  Actual reachable skills (
                                  {profession.summary.totalEffectiveCoreReachableSkills}):{" "}
                                  {formatPreviewList(profession.coreReachableSkillNames)}
                                </div>
                              </div>
                              <div className={styles.grid035}>
                                <div className={styles.flexCenter075}>
                                  <strong>Favored package preview</strong>
                                  <span className={getBadgeClass({ muted: true })}>Preview only</span>
                                </div>
                                <div>
                                  Included training packages: {formatPreviewList(profession.favoredGroupNames)}
                                </div>
                                <div>
                                  Actual reachable skills (
                                  {profession.summary.totalEffectiveFavoredReachableSkills}):{" "}
                                  {formatPreviewList(profession.favoredReachableSkillNames)}
                                </div>
                              </div>
                              <div className={styles.grid035}>
                                <div className={styles.flexCenter075}>
                                  <strong>Normal-access skill areas in this society</strong>
                                  <span className={getBadgeClass({ muted: true })}>Allocation view</span>
                                </div>
                                <div>
                                  Buckets include: {formatPreviewList(profession.normalAccessGroupNames)}
                                </div>
                              </div>
                              {profession.hasLiteracyFoundation ? (
                                <div className={styles.grid035}>
                                  <div className={styles.flexCenter075}>
                                    <strong>Literacy foundation</strong>
                                    <span className={getBadgeClass()}>Important</span>
                                  </div>
                                  <div>
                                    This profession path reaches {profession.literacyGatedReachableSkillCount} literacy-linked skill
                                    {profession.literacyGatedReachableSkillCount === 1 ? "" : "s"}.
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </section>
                      );
                    })
                  ) : (
                    <div className={styles.cardPlaceholder}>
                      No professions match the current family filter and search text.
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className={styles.cardPlaceholder}>
              Select a rolled profile and civilization first.
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.stepSection}${!selectedProfession ? ` ${styles.dimmed}` : ""}`}>
        <div className={styles.grid1}>
          <div className={styles.allocationStickyBar}>
            <div className={styles.grid02}>
              <h2 className={styles.allocationStickyHeading}>6. Skill allocation</h2>
              <strong className={styles.allocationStickyLabel}>Culture</strong>
              <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
              <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
            </div>
            <div className={styles.grid02}>
              <strong className={styles.allocationStickyLabel}>Access</strong>
              <div>
                Social status:{" "}
                {selectedSocietyAccess && selectedSocietyBand !== undefined
                  ? `${selectedSocietyAccess.socialClass} (Band ${selectedSocietyBand})`
                  : "Not selected"}
              </div>
              <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
            </div>
            <div className={styles.poolCard}>
              <strong className={styles.allocationStickyLabel}>Ordinary points</strong>
              <div>
                Ordinary spent {progression.primaryPoolSpent} / Remaining {draftView.primaryPoolAvailable}
              </div>
            </div>
            <div className={styles.poolCard}>
              <strong className={styles.allocationStickyLabel}>Flexible points</strong>
              <div>
                Flexible spent {progression.secondaryPoolSpent} / Remaining {draftView.secondaryPoolAvailable}
              </div>
            </div>
          </div>

          <section className={styles.cardLight}>
            <strong>Society granted skills</strong>

            {renderSkillRowsTable({
              emptyMessage: "No society-granted foundational skills are currently available.",
              rows: societyGrantedSkillRows
            })}
          </section>

          <section className={styles.cardLight}>
            <strong>Profession skills</strong>

            {coreProfessionSections.length > 0 ? (
              <section className={styles.cardLight}>
                <div className={styles.twoColAuto}>
                  <div className={styles.grid025}>
                    <strong>Profession groups</strong>
                  </div>
                  <button onClick={() => toggleAllocationSection("core-profession-skills")} type="button">
                    {expandedAllocationSections.includes("core-profession-skills") ? "Collapse" : "Expand"}
                  </button>
                </div>

                {expandedAllocationSections.includes("core-profession-skills") ? (
                  <div className={styles.grid1}>
                    {motherTongueSummary.displayLabel || languageSelectionSummary.selectableLanguages.length > 0 ? (
                      <section className={styles.innerCardLight}>
                        <div className={styles.grid025}>
                          <strong>Languages</strong>
                          <div className={styles.muted}>
                            Mother tongue is granted automatically. Extra civilization languages become real
                            {" "}Language entries when selected here.
                          </div>
                        </div>

                        {motherTongueSummary.displayLabel ? (
                          <div className={styles.darkMuted}>
                            Mother tongue: {motherTongueSummary.displayLabel} • Starting XP{" "}
                            {motherTongueSummary.startingLevel}
                          </div>
                        ) : null}

                        {languageSelectionSummary.selectableLanguages.length > 0 ? (
                          <div className={styles.grid05}>
                            <div className={styles.flexWrap05}>
                              <span className={getBadgeClass({ muted: true })}>Optional language choices</span>
                              <span className={styles.mutedSm}>
                                Select any civilization languages you want available in this draft.
                              </span>
                            </div>
                            <div className={styles.flexWrap05}>
                              {languageSelectionSummary.selectableLanguages.map((language) => {
                                const isSelected =
                                  languageSelectionSummary.selectedOptionalLanguageIds.includes(language.id);

                                return (
                                  <button
                                    key={language.id}
                                    className={isSelected ? styles.toggleButtonSelected : styles.toggleButton}
                                    onClick={() => handleToggleLanguageSelection(language.id)}
                                    type="button"
                                  >
                                    {language.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {languageSkillViews.length > 0 ? (
                          <div className={styles.grid05}>
                            {languageSkillViews.map((skillView) => {
                              const rowFeedback = rowActionFeedback[
                                getRowActionFeedbackKey(skillView.skillKey, "skill")
                              ];
                              const addPreview = skillAllocationContext
                                ? allocateChargenPoint({
                                    ...skillAllocationContext,
                                    targetId: skillView.skillId,
                                    targetLanguageName: skillView.languageName,
                                    targetType: "skill"
                                  })
                                : undefined;

                              return (
                                <div
                                  key={skillView.skillKey}
                                  className={styles.languageSkillRow}
                                >
                                  <div className={styles.languageSkillRowCols}>
                                    <div className={styles.grid025}>
                                      <div className={styles.flexWrap05}>
                                        <span>{getSkillDisplayName({ languageName: skillView.languageName, skill: { name: skillView.name } })}</span>
                                        <span className={getSkillTierClass({ category: skillView.category })}>
                                          {getSkillTierLabel({ category: skillView.category })}
                                        </span>
                                        {skillView.sourceTag === "mother-tongue" ? (
                                          <span className={getBadgeClass({ muted: true })}>Mother tongue</span>
                                        ) : null}
                                        {languageSelectionSummary.selectedOptionalLanguages.some(
                                          (language) => language.name === skillView.languageName
                                        ) ? (
                                          <span className={getBadgeClass({ muted: true })}>Selected option</span>
                                        ) : null}
                                      </div>
                                      {addPreview?.spentCost ? (
                                        <div className={styles.mutedXs}>
                                          Next purchase cost: {addPreview.spentCost}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div>{skillView.groupLevel}</div>
                                    <div>{skillView.primaryRanks}</div>
                                    <div>{skillView.secondaryRanks}</div>
                                    <div>{skillView.effectiveSkillNumber}</div>
                                    <div className={styles.flexWrap05}>
                                      <button
                                        disabled={!skillAllocationContext}
                                        onClick={() =>
                                          handleAllocate(skillView.skillId, "skill", skillView.languageName)
                                        }
                                        type="button"
                                      >
                                        +
                                      </button>
                                      <button
                                        disabled={!skillAllocationContext}
                                        onClick={() =>
                                          handleRemoveAllocation(skillView.skillId, "skill", skillView.languageName)
                                        }
                                        type="button"
                                      >
                                        -
                                      </button>
                                    </div>
                                  </div>
                                  {rowFeedback ? (
                                    <div role="status" className={styles.statusWarning}>
                                      {rowFeedback}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {coreProfessionSections.map((section) => (
                      <section
                        key={section.definition.id}
                        className={styles.innerCardWhite}
                      >
                        <div className={styles.grid025}>
                          <strong>{section.definition.label}</strong>
                          <div className={styles.muted}>
                            {section.definition.description}
                          </div>
                        </div>

                        {section.groups.map((group) => {
                          const groupView = draftView.groups.find((item) => item.groupId === group.id);
                          const groupSelectionSlots = selectableSkillSummary.selectionSlots.filter(
                            (slot) => slot.groupId === group.id
                          );
                          const selectedGroupSlotSkillIds = new Set(
                            groupSelectionSlots.flatMap((slot) => slot.selectedSkillIds)
                          );
                          const addPreview = skillAllocationContext
                            ? allocateChargenPoint({
                                ...skillAllocationContext,
                                targetId: group.id,
                                targetType: "group"
                              })
                            : undefined;
                          const groupSkillRows = sortSkills(
                            content.skills.filter(
                              (skill) =>
                                skillDisplayGroupIds.get(skill.id) === group.id ||
                                selectedGroupSlotSkillIds.has(skill.id)
                            )
                          )
                            .map((skill) => {
                              const row = skillRowsById.get(skill.id);

                              if (!row) {
                                return undefined;
                              }

                              return {
                                ...row,
                                metrics: getGroupScopedSkillAllocationMetrics({
                                  content,
                                  draftView,
                                  groupId: group.id,
                                  profile: selectedProfile,
                                  progression,
                                  skill: row.skill,
                                  targetLanguageName: row.targetLanguageName
                                })
                              };
                            })
                            .filter((row): row is SkillBrowseRow => row !== undefined);
                          const visibleSkillRows = mergeSkillBrowseRowsBySkillId(groupSkillRows);
                          const hasOwnedContent =
                            (groupView?.totalRanks ?? 0) > 0 ||
                            visibleSkillRows.some((row) => row.metrics.totalXp > 0);

                          return (
                            <section
                              key={group.id}
                              className={styles.innerCardLight}
                            >
                              <div className={styles.twoColAuto}>
                                <div className={styles.grid02}>
                                  <strong>{group.name}</strong>
                                  <div className={styles.mutedSm}>
                                    Included training package • {visibleSkillRows.length} actual skill
                                    {visibleSkillRows.length === 1 ? "" : "s"}
                                    {hasOwnedContent ? " • currently invested" : ""}
                                  </div>
                                </div>
                                <div className={styles.groupControlsRow}>
                                  <button
                                    disabled={!skillAllocationContext}
                                    onClick={() => handleAllocate(group.id, "group")}
                                    type="button"
                                  >
                                    Buy / raise skill group
                                  </button>
                                  <button
                                    disabled={!skillAllocationContext}
                                    onClick={() => handleRemoveAllocation(group.id, "group")}
                                    type="button"
                                  >
                                    -1 skill group
                                  </button>
                                </div>
                              </div>

                              <div className={styles.groupStatsGrid}>
                                <div>
                                  <div className={styles.textSm}>Ordinary spent</div>
                                  <strong>{groupView?.primaryRanks ?? 0}</strong>
                                </div>
                                <div>
                                  <div className={styles.textSm}>Flexible spent</div>
                                  <strong>{groupView?.secondaryRanks ?? 0}</strong>
                                </div>
                                <div>
                                  <div className={styles.textSm}>Current total</div>
                                  <strong>{groupView?.totalRanks ?? 0}</strong>
                                </div>
                              </div>

                              {addPreview?.spentCost ? <div>Next purchase cost: {addPreview.spentCost}</div> : null}
                              {addPreview?.error ? (
                                <div className={styles.errorText}>
                                  {addPreview.error}
                                </div>
                              ) : null}

                              {groupSelectionSlots.length > 0 ? (
                                <div className={styles.grid05}>
                                  {groupSelectionSlots.map((slot) => (
                                    <div
                                      key={`${group.id}:${slot.slotId}`}
                                      className={styles.groupSlotItem}
                                    >
                                      <div className={styles.flexWrap05}>
                                        <span className={getBadgeClass({ muted: !slot.isSatisfied })}>
                                          {slot.required ? "Required" : "Optional"} • Choose {slot.chooseCount}
                                        </span>
                                      </div>
                                      <div className={styles.flexWrap05}>
                                        {slot.candidateSkills.map((skill) => {
                                          const isSelected = slot.selectedSkillIds.includes(skill.id);

                                          return (
                                            <button
                                              key={`${slot.slotId}-${skill.id}`}
                                              className={isSelected ? styles.toggleButtonSelected : styles.toggleButton}
                                              onClick={() =>
                                                handleSelectGroupSlotSkill(slot.groupId, slot.slotId, skill.id)
                                              }
                                              type="button"
                                            >
                                              {skill.name} • Type {skill.category}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {renderSkillRowsTable({
                                emptyMessage: "No skills in this group are currently available.",
                                rows: visibleSkillRows
                              })}
                            </section>
                          );
                        })}

                        {section.directRows.length > 0 ? (
                          <div className={styles.grid05}>
                            <div className={styles.flexCenter075}>
                              <strong>Direct skills in this area</strong>
                              <span className={getBadgeClass({ muted: true })}>No separate included package</span>
                            </div>
                            {renderSkillRowsTable({
                              emptyMessage: "No direct normal-access skills in this area.",
                              rows: section.directRows
                            })}
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {specialAccessSection ? (
              <section className={styles.cardLight}>
                <div className={styles.twoColAuto}>
                  <div className={styles.grid025}>
                    <strong>Special-access granted skills</strong>
                  </div>
                  <button onClick={() => toggleAllocationSection("special-access")} type="button">
                    {expandedAllocationSections.includes("special-access") ? "Collapse" : "Expand"}
                  </button>
                </div>

                {expandedAllocationSections.includes("special-access")
                  ? renderSkillRowsTable({
                      emptyMessage: "No direct profession-linked skills are currently available.",
                      rows: specialAccessSection.directRows
                    })
                  : null}
              </section>
            ) : null}
          </section>

          <section className={styles.cardLight} style={{ order: 8 }}>
        <h2 className={styles.heading}>8. Specializations</h2>

        <div className={styles.hint}>
          Specializations use flexible points and are gated by the parent skill. The default list
          hides distant blocked rows so parentless entries do not overwhelm the page.
        </div>
        <div className={styles.specializationSearchBar}>
          <label className={styles.grid035}>
            <span>Search specializations</span>
            <input
              onChange={(event) => setSpecializationSearch(event.target.value)}
              placeholder="Search specialization name"
              type="search"
              value={specializationSearch}
            />
          </label>
          <label className={styles.checkboxLabel}>
            <input
              checked={showAllSpecializations}
              onChange={(event) => setShowAllSpecializations(event.target.checked)}
              type="checkbox"
            />
            Show all blocked rows
          </label>
          <button onClick={() => setShowSpecializations((current) => !current)} type="button">
            {showSpecializations || specializationFilterActive ? "Collapse" : "Expand"}
          </button>
        </div>

        <div className={styles.mutedSm}>
          Showing {visibleSpecializationRows.length} of {specializationRows.length} specialization
          rows.
        </div>

        {showSpecializations || specializationFilterActive ? (
          <div className={styles.tableContainer}>
            <div className={`${styles.tableHeader} ${styles.specializationTableHeader}`}>
              <strong>Specialization</strong>
              <strong>Parent skill</strong>
              <strong>Parent level</strong>
              <strong>Flexible</strong>
              <strong>Actions</strong>
            </div>

            {visibleSpecializationRows.map((row) => {
              const purchaseState = getSpecializationPurchaseState({
                skillAllocationContext,
                specializationId: row.specialization.id
              });
              const { feedback: rowFeedback, statusItems: ruleStatusItems } =
                getSpecializationRowMessages({
                  evaluation: row.evaluation,
                  persistedRowFeedback: rowActionFeedback[
                    getRowActionFeedbackKey(row.specialization.id, "specialization")
                  ],
                  purchaseState
                });

              return (
                <div
                  key={row.specialization.id}
                  className={styles.specializationTableRow}
                  style={{
                    opacity:
                      !row.evaluation.isAllowed && row.parentSkillLevel === 0 && row.specializationLevel === 0
                        ? 0.72
                        : 1
                  }}
                >
                  <div className={styles.specializationTableRowCols}>
                    <div className={styles.grid025}>
                      <div className={styles.flexWrap05}>
                        <span>{row.specialization.name}</span>
                        <span className={getBadgeClass({ muted: true })}>Specialization</span>
                      </div>
                      {row.grantedSourceLabel ? (
                        <div className={styles.mutedXs}>
                          {row.grantedSourceLabel}
                        </div>
                      ) : null}
                      {purchaseState.nextCost !== undefined ? (
                        <div className={styles.mutedXs}>
                          Next cost {purchaseState.nextCost} flexible points
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div>{row.parentSkillName}</div>
                      <div className={styles.mutedXs}>
                        Needs level {row.specialization.minimumParentLevel}
                      </div>
                    </div>
                    <div>{row.parentSkillLevel}</div>
                    <div>
                      <div>{row.secondaryRanks}</div>
                      {row.grantedSpecializationLevel > 0 ? (
                        <div className={styles.mutedXs}>
                          +{row.grantedSpecializationLevel} derived preview
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.flexWrap05}>
                      <button
                        aria-label={`Add ${row.specialization.name}`}
                        disabled={!purchaseState.canAllocate}
                        onClick={() => handleAllocateSpecialization(row.specialization.id)}
                        type="button"
                      >
                        +
                      </button>
                      <button
                        aria-label={`Remove ${row.specialization.name}`}
                        disabled={!skillAllocationContext}
                        onClick={() => handleRemoveSpecialization(row.specialization.id)}
                        type="button"
                      >
                        -
                      </button>
                    </div>
                  </div>
                  {ruleStatusItems.map((status) => (
                    <div
                      key={`${row.specialization.id}-${status.tone}-${status.message}`}
                      className={getRuleStatusClass(status.tone)}
                      role="status"
                    >
                      {status.message}
                    </div>
                  ))}
                  {rowFeedback ? (
                    <div role="status" className={styles.statusWarning}>
                      {rowFeedback}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {visibleSpecializationRows.length === 0 ? (
              <div className={styles.emptyTableRow}>
                No specializations match the current search or visibility setting.
              </div>
            ) : null}
          </div>
        ) : null}
          </section>

          <section className={styles.cardLight} style={{ order: 7 }}>
        <h2 className={styles.heading}>7. Other skills</h2>
        <div className={styles.grid075}>
            <div className={styles.twoColAuto}>
              <div className={styles.grid025}>
                <div className={styles.textNote}>Other skills use flexible points</div>
                <div className={styles.mutedSm}>
                  {visibleOtherSkillRows.length} other skill
                  {visibleOtherSkillRows.length === 1 ? "" : "s"} visible
                </div>
              </div>
              <button onClick={() => setShowOtherSkills((current) => !current)} type="button">
                {showOtherSkills || (otherSkillFilterActive && visibleOtherSkillRows.length > 0)
                  ? "Collapse"
                  : "Expand"}
              </button>
            </div>
        </div>

        {showOtherSkills || (otherSkillFilterActive && visibleOtherSkillRows.length > 0) ? (
          <div className={styles.grid075}>
            <div className={styles.searchBar3Col}>
              <label className={styles.grid035}>
                <span>Search skills</span>
                <input
                  className={styles.otherSkillSearchInput}
                  onChange={(event) => setSkillSearch(event.target.value)}
                  placeholder="Search by skill name"
                  type="search"
                  value={skillSearch}
                />
              </label>
              <label className={styles.grid035}>
                <span>Show</span>
                <select
                  onChange={(event) =>
                    setSkillVisibilityFilter(event.target.value as SkillVisibilityFilter)
                  }
                  value={skillVisibilityFilter}
                >
                  <option value="all">All visible skills</option>
                  <option value="purchasable">Purchasable now</option>
                  <option value="owned">Owned</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <label className={styles.grid035}>
                <span>Skill category</span>
                <select
                  onChange={(event) =>
                    setSkillTypeFilter(event.target.value as SkillBrowseTypeFilter)
                  }
                  value={skillTypeFilter}
                >
                  <option value="all">All categories</option>
                  {otherSkillTypeOptions.map((definition) => (
                    <option key={definition.id} value={definition.id}>
                      {definition.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {renderSkillRowsTable({
              emptyMessage: "No other skills match the current search or filter.",
              rows: visibleOtherSkillRows,
              showOutsideNormalAccessBadge: true,
              showTypeBadge: true
            })}
          </div>
        ) : null}
          </section>
        </div>
      </section>

      <section className={styles.cardLight} style={{ order: 9 }}>
        <h2 className={styles.heading}>9. Skills table</h2>

        {groupedPlayerSkillTableRows.length > 0 ? (
          <div className={styles.grid1}>
            {groupedPlayerSkillTableRows.map((group) => (
              <section
                key={group.bucketId}
                className={styles.tableContainer}
              >
                <div className={styles.skillsSummaryBucketHeader}>
                  <strong>{group.label}</strong>
                  <span className={styles.mutedSm}>
                    {group.rows.length} skill{group.rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className={`${styles.tableHeader} ${styles.skillsSummaryTableHeader}`}>
                  <strong>Skill</strong>
                  <strong>Stats</strong>
                  <strong>Avg stats</strong>
                  <strong>Skill group XP</strong>
                  <strong>Owned XP</strong>
                  <strong>Derived preview</strong>
                  <strong>Total XP</strong>
                  <strong>Total skill level</strong>
                </div>

                {group.rows.map((skill) => (
                  <div
                    key={skill.skillId}
                    className={styles.skillsSummaryTableRow}
                  >
                    <div>
                      <div>{skill.skillName}</div>
                      {skill.literacyWarning ? (
                        <div className={styles.mutedXs}>
                          {skill.literacyWarning}
                        </div>
                      ) : null}
                    </div>
                    <div>{skill.stats}</div>
                    <div>{skill.avgStats}</div>
                    <div>{skill.skillGroupXp}</div>
                    <div>{skill.skillXp}</div>
                    <div>{skill.grantedSkillXp}</div>
                    <div>{skill.totalXp}</div>
                    <div>{skill.totalSkillLevel}</div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div>No skills in the draft yet.</div>
        )}
      </section>

      <section className={styles.cardLight} style={{ order: 10 }}>
        <h2 className={styles.heading}>9b. Specialization Table</h2>
        {draftView.specializations.length > 0 ? (
          <div className={styles.tableContainer}>
            <div className={`${styles.tableHeader} ${styles.specializationSummaryHeader}`}>
              <strong>Specialization</strong>
              <strong>Parent skill</strong>
              <strong>Direct XP</strong>
              <strong>Derived preview</strong>
              <strong>Total</strong>
            </div>

            {draftView.specializations.map((specialization) => (
              <div
                key={specialization.specializationId}
                className={styles.specializationSummaryRow}
              >
                <div>
                  <div>{specialization.name}</div>
                  {specialization.relationshipGrantedSourceSkillName ? (
                    <div className={styles.mutedXs}>
                      {formatDerivedSkillSourceLabel({
                        sourceSkillName: specialization.relationshipGrantedSourceSkillName,
                        sourceType: specialization.relationshipGrantedSourceType
                      })}
                    </div>
                  ) : null}
                </div>
                <div>{specialization.parentSkillName}</div>
                <div>{specialization.secondaryRanks}</div>
                <div>{specialization.relationshipGrantedPreviewLevel ?? 0}</div>
                <div>{specialization.effectiveSpecializationNumber}</div>
              </div>
            ))}
          </div>
        ) : (
          <div>No specializations in the draft yet.</div>
        )}
      </section>

      <section className={styles.cardLight} style={{ order: 11 }}>
        <h2 className={styles.heading}>10. Review summary</h2>

        <div className={styles.reviewGrid}>
          <div className={styles.reviewCard}>
            <strong>Character summary</strong>
            <div>Chargen rules: {chargenRuleSet.name}</div>
            <div>Profile: {selectedProfile?.label ?? "Not selected"}</div>
            <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
            <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
            <div>Social band: {selectedSocialBand ?? "Not selected"}</div>
            <div>Social class: {selectedSocietyAccess?.socialClass ?? "Not selected"}</div>
            <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
            <div>
              Mother tongue:{" "}
              {motherTongueSummary.displayLabel
                ? `${motherTongueSummary.displayLabel} • XP ${motherTongueSummary.startingLevel}`
                : "Not selected"}
            </div>
            <div>Selected extra languages: {languageSelectionSummary.selectedOptionalLanguageIds.length}</div>
            <div>Skill groups: {draftView.groups.length}</div>
            <div>Skills: {draftView.skills.length}</div>
            <div>Core skills: {selectableSkillSummary.coreSkillIds.length}</div>
            <div>Required group choices: {selectableSkillSummary.selectionSlots.length}</div>
            <div>Selectable pool: {selectableSkillSummary.selectableSkillIds.length}</div>
            <div>Chosen skills: {selectableSkillSummary.selectedSkillIds.length}</div>
            <div>Specializations: {draftView.specializations.length}</div>
          </div>

          <div className={styles.reviewCard}>
            <strong>Points and education</strong>
            <div>
              Rule set: {chargenRuleSet.name} ({chargenRuleSet.ordinarySkillPoints} ordinary, flexible x
              {chargenRuleSet.flexiblePointFactor})
            </div>
            <div>
              Ordinary points: {progression.primaryPoolSpent} spent /{" "}
              {draftView.primaryPoolAvailable} remaining
            </div>
            <div>
              Flexible points: {progression.secondaryPoolSpent} spent /{" "}
              {draftView.secondaryPoolAvailable} remaining
            </div>
            <div>Education: {draftView.education.theoreticalSkillCount}</div>
            <div>Base education: {draftView.education.baseEducation}</div>
            <div>Social class education value: {draftView.education.socialClassEducationValue}</div>
            <div>Education-linked skills: {educationLinkedSkillCount}</div>
            <small className={styles.noteMuted}>
              Education-linked skills are learned skills that add to Education. Review skill
              metadata in Admin -&gt; Skills.
            </small>
            <div>Total skill points invested: {draftView.totalSkillPointsInvested}</div>
          </div>

        </div>
      </section>

      <section className={styles.cardLight} style={{ order: 12 }}>
        <h2 className={styles.heading}>11. Finalize character</h2>
        <div className={styles.hint}>
          Confirm the name and create the local character record. The signed-in player is stored as
          the creator for attribution.
        </div>
        <div className={styles.finalizeGrid}>
          <label className={styles.grid035}>
            <span>Character name</span>
            <input
              onChange={(event) => setCharacterName(event.target.value)}
              placeholder="Leave blank to use the default generated name"
              type="text"
              value={characterName}
            />
          </label>
          <div className={styles.grid035}>
            <strong>Creator attribution</strong>
            <div>{formatPlayerLabel(currentUser)}</div>
            <button
              className={styles.finalizeButton}
              disabled={!review.canFinalize || currentUser === undefined || isFinalizing}
              onClick={() => {
                handleFinalize().catch((error) => {
                  console.error(error);
                });
              }}
              type="button"
            >
              {isFinalizing ? "Saving character..." : "Finalize character"}
            </button>
          </div>
        </div>
      </section>
        </>
      ) : null}
    </section>
  );
}
