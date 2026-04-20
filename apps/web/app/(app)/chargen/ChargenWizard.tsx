"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  CharacterProgression,
  GlantriCharacteristicKey,
  ProfessionDefinition,
  RolledCharacterProfile,
  SkillDefinition,
  SocietyLevelAccess
} from "@glantri/domain";
import {
  getSkillGroupIds,
  glantriCharacteristicLabels,
  glantriCharacteristicOrder
} from "@glantri/domain";
import {
  applyProfessionGrants,
  buildChargenLanguageSelectionSummary,
  applyChargenStatBuild,
  applyChargenStatExchange,
  allocateChargenPoint,
  buildResolvedProfile,
  buildChargenDraftView,
  buildChargenSelectableSkillSummary,
  buildChargenSkillAccessSummary,
  createChargenStatAdjustmentState,
  createChargenProgression,
  evaluateSkillSelection,
  finalizeChargenDraft,
  generateProfiles,
  removeChargenPoint,
  removeSecondaryPoint,
  resolveEffectiveProfessionPackage,
  STANDARD_CHARGEN_METHOD_POLICY,
  reviewChargenDraft,
  selectProfile,
  selectBestSkillGroupContribution,
  spendSecondaryPoint,
  summarizeRolledProfile,
  getResolvedProfileStats,
  type ChargenStatAdjustmentState,
  type RolledProfileSummary
} from "@glantri/rules-engine";

import type { LocalCharacterRecord } from "../../../src/lib/offline/glantriDexie";
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
} from "../../../src/lib/chargen/chargenBrowse";
import {
  getCurrentSessionUser,
  saveCharacterToServer
} from "../../../src/lib/api/localServiceClient";
import { ChargenSessionRepository } from "../../../src/lib/offline/repositories/chargenSessionRepository";
import { ContentCacheRepository } from "../../../src/lib/offline/repositories/contentCacheRepository";
import { LocalCharacterRepository } from "../../../src/lib/offline/repositories/localCharacterRepository";

const SESSION_ID = "chargen-vertical-slice";
const CONTENT_CACHE_KEY = "canonical-content";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
  name: string;
  notes?: string;
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
  evaluation: ReturnType<typeof evaluateSkillSelection>;
  isNormalAccess: boolean;
  metrics: SkillAllocationMetrics;
  skill: SkillDefinition;
  sourceLabels: string[];
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

function getSkillDisplayGroupId(input: {
  content: CanonicalContent;
  draftView: ReturnType<typeof buildChargenDraftView>;
  skill: SkillDefinition;
  skillAccess: ReturnType<typeof buildChargenSkillAccessSummary>;
}): string | undefined {
  const purchasedSkill = input.draftView.skills.find((candidate) => candidate.skillId === input.skill.id);

  if (purchasedSkill?.contributingGroupId) {
    return purchasedSkill.contributingGroupId;
  }

  const normalGroupIdSet = new Set(input.skillAccess.normalSkillGroupIds);
  const candidateGroupIds = getSkillGroupIds(input.skill).filter((groupId) => normalGroupIdSet.has(groupId));

  if (candidateGroupIds.length === 0) {
    return undefined;
  }

  return selectBestSkillGroupContribution(
    candidateGroupIds.map((groupId) => {
      const groupDefinition = input.content.skillGroups.find((group) => group.id === groupId);
      const groupView = input.draftView.groups.find((group) => group.groupId === groupId);

      return {
        groupId,
        groupLevel: groupView?.groupLevel ?? 0,
        name: groupDefinition?.name ?? groupId,
        sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
      };
    })
  )?.groupId;
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

function formatSavedCharacterCreator(record: LocalCharacterRecord): string {
  if (record.creatorDisplayName && record.creatorEmail) {
    return `${record.creatorDisplayName} (${record.creatorEmail})`;
  }

  return record.creatorDisplayName ?? record.creatorEmail ?? "Not recorded";
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

function getSkillTierTone(skill: Pick<SkillDefinition, "category">): CSSProperties {
  return skill.category === "ordinary" ? getBadgeStyle() : getBadgeStyle({ muted: true });
}

function getRuleStatusColor(tone: RuleStatusTone): string {
  switch (tone) {
    case "blocked":
      return "#8a2d1f";
    case "warning":
      return "#7a4b00";
    case "advisory":
      return "#5e5a50";
  }
}

function getBadgeStyle(input?: { muted?: boolean }): CSSProperties {
  return {
    background: input?.muted ? "#f2efe6" : "#eef3ea",
    border: "1px solid #d9ddd8",
    borderRadius: 999,
    color: "#4a4f45",
    fontSize: "0.75rem",
    padding: "0.15rem 0.5rem"
  };
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
      name: civilization.name,
      notes: civilization.notes,
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

function getCivilizationLanguageLabels(
  civilization: CivilizationOption | undefined
): string[] {
  if (!civilization) {
    return [];
  }

  return [
    civilization.spokenLanguageName,
    ...(civilization.writtenLanguageName &&
    civilization.writtenLanguageName !== civilization.spokenLanguageName
      ? [civilization.writtenLanguageName]
      : [])
  ];
}

interface RolledProfileCardModel {
  originalIndex: number;
  profile: RolledCharacterProfile;
  summary: RolledProfileSummary;
}

interface SkillAllocationMetrics {
  avgStats: number;
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

function getSkillAllocationMetrics(input: {
  content: CanonicalContent;
  draftView: ReturnType<typeof buildChargenDraftView>;
  profile: RolledCharacterProfile | undefined;
  skill: SkillDefinition;
}): SkillAllocationMetrics {
  const skillView = input.draftView.skills.find((item) => item.skillId === input.skill.id);
  const bestContributingGroup = selectBestSkillGroupContribution(
    getSkillGroupIds(input.skill)
      .map((groupId) => {
        const groupView = input.draftView.groups.find((group) => group.groupId === groupId);
        const groupDefinition = input.content.skillGroups.find((group) => group.id === groupId);

        if (!groupView || groupView.groupLevel <= 0) {
          return null;
        }

        return {
          groupId,
          groupLevel: groupView.groupLevel,
          name: groupDefinition?.name ?? groupId,
          sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null)
  );
  const groupXp = bestContributingGroup?.groupLevel ?? skillView?.groupLevel ?? 0;
  const skillXp = skillView?.specificSkillLevel ?? 0;
  const avgStats = skillView?.linkedStatAverage ?? getSkillLinkedStatAverage(input.profile, input.skill);
  const totalXp = groupXp + skillXp;

  return {
    avgStats,
    flexibleXp: skillView?.secondaryRanks ?? 0,
    groupXp,
    literacyWarning: skillView?.literacyWarning,
    ordinaryXp: skillView?.primaryRanks ?? 0,
    skillXp,
    totalSkillLevel: avgStats + totalXp,
    totalXp
  };
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
  const [savedCharacters, setSavedCharacters] = useState<LocalCharacterRecord[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string>();
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();
  const [showRolledProfileOptions, setShowRolledProfileOptions] = useState(true);
  const [showCivilizationChooser, setShowCivilizationChooser] = useState(true);
  const [showProfessionChooser, setShowProfessionChooser] = useState(true);
  const [expandedProfessionId, setExpandedProfessionId] = useState<string>();
  const [professionFamilyFilter, setProfessionFamilyFilter] = useState("all");
  const [professionSearch, setProfessionSearch] = useState("");
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
  const exchangeDisabled =
    !selectedAdjustment ||
    exchangeFirstStat === exchangeSecondStat ||
    selectedAdjustment.exchangesUsed >= STANDARD_CHARGEN_METHOD_POLICY.maxExchanges;
  const buildDisabled =
    !selectedAdjustment ||
    buildIncreaseStat === buildDecreaseStat ||
    selectedAdjustment.buildsUsed >= STANDARD_CHARGEN_METHOD_POLICY.maxBuilds ||
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
  const civilizationLanguageLabels = getCivilizationLanguageLabels(selectedCivilization);
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
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const review = reviewChargenDraft({
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    socialClass: selectedSocietyAccess?.socialClass,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const languageSelectionSummary = buildChargenLanguageSelectionSummary({
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
          otherSkillIds: content.skills.map((skill) => skill.id),
          skillSources: {}
        };
  const normalSkillGroups = sortedSkillGroups.filter((group) =>
    skillAccess.normalSkillGroupIds.includes(group.id)
  );
  const skillDisplayGroupIds = new Map(
    content.skills.map((skill) => [
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
    content.skills.filter(
      (skill) =>
        skillAccess.normalSkillIds.includes(skill.id) &&
        skillDisplayGroupIds.get(skill.id) === undefined
    )
  );
  const otherSkills = sortSkills(
    content.skills.filter(
      (skill) =>
        skillDisplayGroupIds.get(skill.id) === undefined &&
        !skillAccess.normalSkillIds.includes(skill.id)
    )
  );
  const skillRowsById = new Map<string, SkillBrowseRow>(
    sortSkills(content.skills).map((skill) => {
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
          evaluation,
          isNormalAccess: skillAccess.normalSkillIds.includes(skill.id),
          metrics,
          skill,
          sourceLabels: getSkillAccessSourceLabels(skillAccess.skillSources[skill.id])
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
  const displayedLanguageLabels =
    civilizationLanguageLabels.length > 0
      ? civilizationLanguageLabels
      : languageSelectionSummary.selectedLanguages.map((language) => language.name);
  const visibleOtherSkillRows = otherSkills
    .map((skill) => skillRowsById.get(skill.id))
    .filter((row): row is SkillBrowseRow => row !== undefined)
    .filter((row) =>
      matchesSkillBrowseFilters({
        isAllowed: row.evaluation.isAllowed,
        isOwned: row.metrics.totalXp > 0,
        name: row.skill.name,
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
      otherSkills.some((skill) => getPlayerFacingSkillBucket(skill) === definition.id)
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
    .map((skill) => {
      const skillMetrics = getSkillAllocationMetrics({
        content,
        draftView,
        profile: selectedProfile,
        skill
      });

      if (skillMetrics.totalXp <= 0) {
        return null;
      }

      return {
        avgStats: skillMetrics.avgStats,
        literacyWarning: skillMetrics.literacyWarning,
        skillType: getPlayerFacingSkillBucket(skill),
        skillGroupXp: skillMetrics.groupXp,
        skillId: skill.id,
        skillName: skill.name,
        skillXp: skillMetrics.skillXp,
        stats: formatSkillStats(skill),
        totalSkillLevel: skillMetrics.totalSkillLevel,
        totalXp: skillMetrics.totalXp
      };
    })
    .filter((skill): skill is NonNullable<typeof skill> => skill !== null);
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
        evaluation,
        parentSkillLevel: parentMetrics?.totalXp ?? 0,
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
      const [cachedContent, existingCharacters, sessionUser] = await Promise.all([
        contentCacheRepository.get(CONTENT_CACHE_KEY),
        localCharacterRepository.listFinalized(),
        getCurrentSessionUser().catch(() => null)
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

      setSavedCharacters(existingCharacters);
      setCurrentUser(sessionUser);

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
          professionId: availableProfessions[0].id
        })
      );
    }
  }, [
    availableProfessions,
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
      setProgression(createChargenProgression());
      setFeedback(["Profession selection was cleared because society access changed."]);
    }
  }, [availableProfessions, hydrated, selectedProfessionId]);

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
    setProgression(createChargenProgression());
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
        professionId
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
    setRolledProfiles(generateProfiles({}));
    setProfileAdjustments({});
    setCharacterName("");
    setFeedback([]);
    setProgression(createChargenProgression());
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

  function handleAllocate(targetId: string, targetType: "group" | "skill") {
    if (!skillAllocationContext) {
      return;
    }

    const result = allocateChargenPoint({
      ...skillAllocationContext,
      targetId,
      targetType
    });

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      if (targetType === "skill") {
        setRowActionFeedback((current) => ({
          ...current,
          [getRowActionFeedbackKey(targetId, targetType)]: message
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
      delete next[getRowActionFeedbackKey(targetId, targetType)];
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

  function handleRemoveAllocation(targetId: string, targetType: "group" | "skill") {
    if (!skillAllocationContext) {
      return;
    }

    const result = removeChargenPoint({
      ...skillAllocationContext,
      targetId,
      targetType
    });

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      if (targetType === "skill") {
        setRowActionFeedback((current) => ({
          ...current,
          [getRowActionFeedbackKey(targetId, targetType)]: message
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
      delete next[getRowActionFeedbackKey(targetId, targetType)];
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
      <div
        style={{
          border: "1px solid #e7e2d7",
          borderRadius: 10,
          overflowX: "auto"
        }}
      >
        <div
          style={{
            borderBottom: "1px solid #e7e2d7",
            color: "#5e5a50",
            display: "grid",
            fontSize: "0.8rem",
            gap: "0.75rem",
            gridTemplateColumns:
              "minmax(180px, 2fr) repeat(4, minmax(72px, 84px)) minmax(150px, 1fr)",
            padding: "0.75rem 1rem"
          }}
        >
          <strong>Skill</strong>
          <strong>Group XP</strong>
          <strong>Ordinary</strong>
          <strong>Flexible</strong>
          <strong>Total XP</strong>
          <strong>Actions</strong>
        </div>

        {input.rows.length > 0 ? (
          input.rows.map((row) => {
            const ruleStatusItems = getRuleStatusItems(row.evaluation);
            const rowFeedback = rowActionFeedback[getRowActionFeedbackKey(row.skill.id, "skill")];
            const skillType = getPlayerFacingSkillBucket(row.skill);
            const skillTypeLabel =
              playerFacingSkillBucketDefinitions.find((definition) => definition.id === skillType)
                ?.label ?? skillType;
            const isDetailOpen = expandedSkillDetails.includes(row.skill.id);
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
              <div
                key={row.skill.id}
                style={{
                  borderTop: "1px solid #f0eadf",
                  display: "grid",
                  gap: "0.35rem",
                  padding: "0.75rem 1rem"
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) repeat(4, minmax(72px, 84px)) minmax(150px, 1fr)"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <span>{row.skill.name}</span>
                      <span style={getSkillTierTone(row.skill)}>{getSkillTierLabel(row.skill)}</span>
                      {row.skill.id === "literacy" && selectedProfessionCard?.hasLiteracyFoundation ? (
                        <span style={getBadgeStyle()}>Foundation skill</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {input.showTypeBadge ? (
                        <span key={`${row.skill.id}-${skillType}`} style={getBadgeStyle({ muted: true })}>
                          {skillTypeLabel}
                        </span>
                      ) : null}
                      {input.showOutsideNormalAccessBadge ? (
                        <span style={getBadgeStyle({ muted: true })}>Outside normal access</span>
                      ) : null}
                      <button onClick={() => toggleSkillDetails(row.skill.id)} type="button">
                        {isDetailOpen ? "Hide details" : "Details"}
                      </button>
                    </div>
                  </div>
                  <div>{row.metrics.groupXp}</div>
                  <div>{row.metrics.ordinaryXp}</div>
                  <div>{row.metrics.flexibleXp}</div>
                  <div>{row.metrics.totalXp}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <button
                      aria-label={`Add ${row.skill.name}`}
                      disabled={!skillAllocationContext || !row.evaluation.isAllowed}
                      onClick={() => handleAllocate(row.skill.id, "skill")}
                      type="button"
                    >
                      +
                    </button>
                    <button
                      aria-label={`Remove ${row.skill.name}`}
                      disabled={!skillAllocationContext}
                      onClick={() => handleRemoveAllocation(row.skill.id, "skill")}
                      type="button"
                    >
                      -
                    </button>
                  </div>
                </div>
                {ruleStatusItems.map((status) => (
                  <div
                    key={`${row.skill.id}-${status.tone}-${status.message}`}
                    role="status"
                    style={{
                      color: getRuleStatusColor(status.tone),
                      fontSize: "0.85rem"
                    }}
                  >
                    {status.message}
                  </div>
                ))}
                {isDetailOpen ? (
                  <div
                    style={{
                      background: "#f6f5ef",
                      border: "1px solid #e7e2d7",
                      borderRadius: 8,
                      display: "grid",
                      gap: "0.5rem",
                      padding: "0.75rem"
                    }}
                  >
                    <div style={{ color: "#4a4f45", fontSize: "0.9rem" }}>
                      {row.skill.shortDescription ?? row.skill.description ?? "No short description yet."}
                    </div>
                    {row.skill.description &&
                    row.skill.description !== row.skill.shortDescription ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        {row.skill.description}
                      </div>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <span style={getBadgeStyle({ muted: true })}>
                        Direct ranks {row.metrics.skillXp}
                      </span>
                      <span style={getBadgeStyle({ muted: true })}>
                        Group-derived value {row.metrics.groupXp}
                      </span>
                      <span style={getBadgeStyle({ muted: true })}>
                        Effective total {row.metrics.totalXp}
                      </span>
                    </div>
                    <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                      Access:{" "}
                      {row.sourceLabels.length > 0
                        ? row.sourceLabels.join(", ")
                        : input.showOutsideNormalAccessBadge
                          ? "Outside normal access"
                          : "Current section access"}
                    </div>
                    {dependencySummaries.length > 0 ? (
                      <div style={{ display: "grid", gap: "0.25rem" }}>
                        <strong style={{ fontSize: "0.85rem" }}>Prerequisites and support</strong>
                        {dependencySummaries.map(({ dependency, dependencyName, dependencyRow }) => (
                          <div key={`${row.skill.id}-${dependency.skillId}`} style={{ fontSize: "0.82rem" }}>
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
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        {row.skill.requiresLiteracy === "required"
                          ? "Literacy is functionally required for full use of this skill."
                          : "Literacy is recommended for fuller use of this skill."}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {rowFeedback ? (
                  <div role="status" style={{ color: "#7a4b00", fontSize: "0.85rem" }}>
                    {rowFeedback}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div style={{ padding: "1rem" }}>{input.emptyMessage}</div>
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
      content,
      name: characterName,
      professionId: selectedProfessionId,
      profile: selectedProfile,
      progression,
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
    <section style={{ display: "grid", gap: "1.5rem", maxWidth: 1080 }}>
      <div>
        <h1 style={{ marginBottom: "0.25rem" }}>Chargen</h1>
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Draft saved locally.</div>
      </div>

      {feedback.length > 0 ? (
        <div
          style={{
            background: "#fff8e1",
            border: "1px solid #e6d38c",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          {feedback.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      ) : null}

      {!hasStartedChargen ? (
        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            padding: "1rem"
          }}
        >
          <div style={{ fontSize: "0.95rem" }}>
            Start a new character by rolling the full set of stats.
          </div>
          <div>
            <button onClick={() => void handleStartChargen()} type="button">
              Roll all dice
            </button>
          </div>
        </section>
      ) : null}

      {hasStartedChargen ? (
        <>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: "0.75rem",
            justifyContent: "space-between"
          }}
        >
          <h2 style={{ margin: 0 }}>1. Stats</h2>
          <button
            onClick={() => setShowRolledProfileOptions((current) => !current)}
            type="button"
          >
            {showRolledProfileOptions ? "Collapse stats" : "Expand stats"}
          </button>
        </div>
        {selectedRolledProfile && !showRolledProfileOptions ? (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem"
            }}
          >
            <div
              style={{
                alignItems: "baseline",
                display: "flex",
                gap: "0.75rem",
                justifyContent: "space-between"
              }}
            >
              <strong>{selectedRolledProfile.label}</strong>
              <button onClick={() => setShowRolledProfileOptions(true)} type="button">
                Expand stats
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <div>Total {selectedRolledProfileSummary?.totalCharacteristicSum ?? 0}</div>
              <div>Distraction {selectedRolledProfile.distractionLevel}</div>
              <div>Social band {formatProfileSocialBand(selectedRolledProfile)}</div>
            </div>
          </div>
        ) : showRolledProfileOptions ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {sortedRolledProfiles.map(({ profile, summary }) => {
              return (
                <label
                  key={profile.id}
                  style={{
                    border: "1px solid #d9ddd8",
                    borderRadius: 12,
                    cursor: "pointer",
                    padding: "1rem"
                  }}
                >
                  <input
                    checked={selectedProfileId === profile.id}
                    name="profile"
                    onChange={() => handleProfileSelect(profile.id)}
                    type="radio"
                  />
                  <div
                    style={{
                      alignItems: "baseline",
                      display: "flex",
                      gap: "0.75rem",
                      justifyContent: "space-between",
                      marginTop: "0.5rem"
                    }}
                  >
                    <strong>{profile.label}</strong>
                    <strong>Total {summary.totalCharacteristicSum}</strong>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      marginTop: "0.75rem"
                    }}
                  >
                    <div>Distraction level: {summary.distractionLevel}</div>
                    <div>Social band: {formatProfileSocialBand(profile)}</div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "0.25rem",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      marginTop: "0.75rem"
                    }}
                  >
                    {summary.characteristics.map((characteristic) => (
                      <div
                        key={characteristic.key}
                        style={{ borderTop: "1px solid #ece8da", paddingTop: "0.5rem" }}
                      >
                        <div style={{ fontSize: "0.85rem" }}>{characteristic.label}</div>
                        <strong>{characteristic.value}</strong>
                      </div>
                    ))}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              color: "#5e5a50",
              padding: "1rem"
            }}
          >
            Expand stats to review the rolled profiles.
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem", opacity: selectedRolledProfile ? 1 : 0.6 }}>
        <h2 style={{ margin: 0 }}>2. Resolve stats</h2>
        {selectedRolledProfile && selectedAdjustment && selectedProfile && selectedResolvedStats ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "1rem",
                padding: "1rem"
              }}
            >
              <div
                style={{
                  alignItems: "start",
                  display: "grid",
                  gap: "1rem",
                  gridTemplateColumns: "minmax(0, 520px) minmax(280px, 1fr)"
                }}
              >
                <div
                  style={{
                    border: "1px solid #e6e2d5",
                    borderRadius: 10,
                    maxWidth: 520,
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      background: "#ece8da",
                      display: "grid",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      gap: "0.5rem",
                      gridTemplateColumns: "minmax(92px, 1fr) 56px 68px 56px",
                      letterSpacing: "0.02em",
                      padding: "0.55rem 0.75rem",
                      textTransform: "uppercase"
                    }}
                  >
                    <span>Stat</span>
                    <span style={{ textAlign: "right" }}>Base</span>
                    <span style={{ textAlign: "right" }}>Adjusted</span>
                    <span style={{ textAlign: "right" }}>Final</span>
                  </div>
                  <div style={{ display: "grid" }}>
                    {glantriCharacteristicOrder.map((stat, index) => (
                      <div
                        key={`stat-row-${stat}`}
                        style={{
                          background: index % 2 === 0 ? "#f6f5ef" : "#f2efe6",
                          borderTop: index === 0 ? "none" : "1px solid #e6e2d5",
                          display: "grid",
                          fontSize: "0.92rem",
                          gap: "0.5rem",
                          gridTemplateColumns: "minmax(92px, 1fr) 56px 68px 56px",
                          padding: "0.5rem 0.75rem"
                        }}
                      >
                        <span>{glantriCharacteristicLabels[stat]}</span>
                        <strong style={{ textAlign: "right" }}>
                          {selectedRolledProfile.rolledStats[stat]}
                        </strong>
                        <strong style={{ textAlign: "right" }}>{selectedAdjustment.stats[stat]}</strong>
                        <strong style={{ textAlign: "right" }}>{selectedResolvedStats[stat]}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    background: "#f2efe6",
                    border: "1px solid #e6e2d5",
                    borderRadius: 10,
                    display: "grid",
                    gap: "0.75rem",
                    padding: "0.85rem"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <div style={{ display: "grid", gap: "0.25rem" }}>
                      <strong style={{ fontSize: "0.9rem", fontWeight: 600 }}>Exchange</strong>
                      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                        Exchanges: {selectedAdjustment.exchangesUsed} /{" "}
                        {STANDARD_CHARGEN_METHOD_POLICY.maxExchanges}
                      </div>
                    </div>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.9rem" }}>Stat A</span>
                      <select
                        onChange={(event) =>
                          setExchangeFirstStat(event.target.value as GlantriCharacteristicKey)
                        }
                        value={exchangeFirstStat}
                      >
                        {glantriCharacteristicOrder.map((stat) => (
                          <option key={`exchange-a-${stat}`} value={stat}>
                            {glantriCharacteristicLabels[stat]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.9rem" }}>Stat B</span>
                      <select
                        onChange={(event) =>
                          setExchangeSecondStat(event.target.value as GlantriCharacteristicKey)
                        }
                        value={exchangeSecondStat}
                      >
                        {glantriCharacteristicOrder.map((stat) => (
                          <option key={`exchange-b-${stat}`} value={stat}>
                            {glantriCharacteristicLabels[stat]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={exchangeDisabled} onClick={handleExchangeStats} type="button">
                      Swap
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <div style={{ display: "grid", gap: "0.25rem" }}>
                      <strong style={{ fontSize: "0.9rem", fontWeight: 600 }}>Build</strong>
                      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                        Builds: {selectedAdjustment.buildsUsed} /{" "}
                        {STANDARD_CHARGEN_METHOD_POLICY.maxBuilds}
                      </div>
                    </div>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.9rem" }}>+ Stat</span>
                      <select
                        onChange={(event) =>
                          setBuildIncreaseStat(event.target.value as GlantriCharacteristicKey)
                        }
                        value={buildIncreaseStat}
                      >
                        {glantriCharacteristicOrder.map((stat) => (
                          <option key={`build-plus-${stat}`} value={stat}>
                            {glantriCharacteristicLabels[stat]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.9rem" }}>- Stat</span>
                      <select
                        onChange={(event) =>
                          setBuildDecreaseStat(event.target.value as GlantriCharacteristicKey)
                        }
                        value={buildDecreaseStat}
                      >
                        {glantriCharacteristicOrder.map((stat) => (
                          <option key={`build-minus-${stat}`} value={stat}>
                            {glantriCharacteristicLabels[stat]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={buildDisabled} onClick={handleBuildStats} type="button">
                      Apply
                    </button>
                  </div>
                  <div style={{ paddingTop: "0.25rem" }}>
                    <button onClick={handleResetStatAdjustments} type="button">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              color: "#5e5a50",
              padding: "1rem"
            }}
          >
            Choose a rolled profile first to exchange or build stats.
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem", opacity: selectedProfile ? 1 : 0.6 }}>
        <h2 style={{ margin: 0 }}>3. Choose civilization</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Choose the civilization that frames this character&apos;s culture and language naming.
          Chargen will infer the linked society automatically for class labels, foundational
          access, education, and profession access.
        </div>
        {selectedCivilization && !showCivilizationChooser ? (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem"
            }}
          >
            <div
              style={{
                alignItems: "start",
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "minmax(0, 1fr) auto"
              }}
            >
              <div style={{ display: "grid", gap: "0.35rem" }}>
                <strong>{selectedCivilization.name}</strong>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
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
            <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem" }}>
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
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {selectedCivilization ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  cursor: selectedProfile ? "pointer" : "not-allowed",
                  padding: "1rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    checked={selectedCivilizationId === civilization.id}
                    disabled={!selectedProfile}
                    name="civilization"
                    onChange={() => handleCivilizationChange(civilization.id)}
                    type="radio"
                  />
                  <strong>{civilization.name}</strong>
                </div>
                <div style={{ marginTop: "0.5rem", color: "#5e5a50", fontSize: "0.9rem" }}>
                  {civilization.shortDescription}
                </div>
                <div style={{ marginTop: "0.25rem" }}>
                  Spoken language: {civilization.spokenLanguageName}
                  {civilization.writtenLanguageName &&
                  civilization.writtenLanguageName !== civilization.spokenLanguageName
                    ? ` • Written ${civilization.writtenLanguageName}`
                    : ""}
                </div>
                <div style={{ marginTop: "0.25rem" }}>
                  Society: {civilization.linkedSocietyName} • Level {civilization.linkedSocietyLevel}
                </div>
                {civilization.historicalAnalogue ? (
                  <div style={{ marginTop: "0.25rem" }}>
                    Historical analogue: {civilization.historicalAnalogue}
                  </div>
                ) : null}
                {civilizations.length === 1 ? (
                  <div style={{ marginTop: "0.25rem" }}>Only available civilization at present.</div>
                ) : null}
                {civilization.notes ? (
                  <div style={{ marginTop: "0.25rem" }}>{civilization.notes}</div>
                ) : null}
              </label>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedProfile && selectedSociety ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>4. Social class</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Your social roll maps to one of four universal bands. Civilization is the cultural
          selector, while the inferred society determines the structural class label for that band.
        </div>
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
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
              <div style={{ marginTop: "0.5rem" }}>
                This result determines later skill, base education, and profession access.
              </div>
            </>
          ) : (
            <span>Select a rolled profile to reveal social status.</span>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedSocietyAccess ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>5. Choose profession</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Pick a profession subtype, then review the included profession packages. Favored package
          preview shows likely reach, not a direct grant by itself.
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {availableProfessions.length > 0 ? (
            <>
              {selectedProfessionCard && !showProfessionChooser ? (
                <section
                  style={{
                    background: "#f6f5ef",
                    border: "1px solid #d9ddd8",
                    borderRadius: 12,
                    display: "grid",
                    gap: "0.75rem",
                    padding: "1rem"
                  }}
                >
                  <div
                    style={{
                      alignItems: "start",
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns: "minmax(0, 1fr) auto"
                    }}
                  >
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        <strong>{selectedProfessionCard.subtypeName}</strong>
                        <span style={getBadgeStyle()}>{selectedProfessionCard.familyName}</span>
                      </div>
                      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                        {selectedProfessionCard.description ??
                          selectedProfessionCard.familyDescription ??
                          "No notes yet."}
                      </div>
                    </div>
                    <button onClick={() => setShowProfessionChooser(true)} type="button">
                      Change profession
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span style={getBadgeStyle({ muted: true })}>
                      Core reach {selectedProfessionCard.summary.totalEffectiveCoreReachableSkills}
                    </span>
                    <span style={getBadgeStyle({ muted: true })}>
                      Favored reach {selectedProfessionCard.summary.totalEffectiveFavoredReachableSkills}
                    </span>
                    <span style={getBadgeStyle({ muted: true })}>
                      Included training packages {selectedProfessionCard.normalAccessGroupNames.length}
                    </span>
                    {selectedProfessionCard.hasLiteracyFoundation ? (
                      <span style={getBadgeStyle()}>Literacy matters here</span>
                    ) : null}
                  </div>
                  <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem" }}>
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
                  <div
                    style={{
                      alignItems: "end",
                      background: "#f6f5ef",
                      border: "1px solid #d9ddd8",
                      borderRadius: 12,
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 280px)",
                      padding: "1rem"
                    }}
                  >
                    <label style={{ display: "grid", gap: "0.35rem" }}>
                      <span>Search professions</span>
                      <input
                        onChange={(event) => setProfessionSearch(event.target.value)}
                        placeholder="Search by subtype, family, or notes"
                        type="search"
                        value={professionSearch}
                      />
                    </label>
                    <label style={{ display: "grid", gap: "0.35rem" }}>
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
                          style={{
                            background: selectedProfessionId === profession.id ? "#fbfaf5" : "#fff",
                            border: "1px solid #d9ddd8",
                            borderRadius: 12,
                            display: "grid",
                            gap: "0.75rem",
                            padding: "1rem"
                          }}
                        >
                          <div
                            style={{
                              alignItems: "start",
                              display: "grid",
                              gap: "0.75rem",
                              gridTemplateColumns: "minmax(0, 1fr) auto"
                            }}
                          >
                            <div style={{ display: "grid", gap: "0.45rem" }}>
                              <label
                                style={{
                                  alignItems: "center",
                                  cursor: selectedSociety ? "pointer" : "not-allowed",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "0.75rem"
                                }}
                              >
                                <input
                                  checked={selectedProfessionId === profession.id}
                                  disabled={!selectedSociety}
                                  name="profession"
                                  onChange={() => handleProfessionChange(profession.id)}
                                  type="radio"
                                />
                                <strong>{profession.subtypeName}</strong>
                                <span style={getBadgeStyle()}>{profession.familyName}</span>
                                {selectedProfessionId === profession.id ? (
                                  <span style={getBadgeStyle()}>Selected</span>
                                ) : null}
                              </label>
                              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                                {profession.description ?? profession.familyDescription ?? "No notes yet."}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                <span style={getBadgeStyle({ muted: true })}>
                                  Core reach {profession.summary.totalEffectiveCoreReachableSkills}
                                </span>
                                <span style={getBadgeStyle({ muted: true })}>
                                  Favored reach {profession.summary.totalEffectiveFavoredReachableSkills}
                                </span>
                                <span style={getBadgeStyle({ muted: true })}>
                                  Included training packages {profession.normalAccessGroupNames.length}
                                </span>
                                {profession.hasLiteracyFoundation ? (
                                  <span style={getBadgeStyle()}>Literacy matters here</span>
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
                            <div
                              style={{
                                background: "#f6f5ef",
                                border: "1px solid #e7e2d7",
                                borderRadius: 10,
                                display: "grid",
                                gap: "0.75rem",
                                padding: "1rem"
                              }}
                            >
                              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                                Skill areas organize the allocation view. Inside each area, you may
                                have included training packages, and those packages open into the
                                actual skills you can raise.
                              </div>
                              <div style={{ display: "grid", gap: "0.35rem" }}>
                                <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                  <strong>Included profession package</strong>
                                  <span style={getBadgeStyle()}>Direct grant</span>
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
                              <div style={{ display: "grid", gap: "0.35rem" }}>
                                <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                  <strong>Favored package preview</strong>
                                  <span style={getBadgeStyle({ muted: true })}>Preview only</span>
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
                              <div style={{ display: "grid", gap: "0.35rem" }}>
                                <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                  <strong>Normal-access skill areas in this society</strong>
                                  <span style={getBadgeStyle({ muted: true })}>Allocation view</span>
                                </div>
                                <div>
                                  Buckets include: {formatPreviewList(profession.normalAccessGroupNames)}
                                </div>
                              </div>
                              {profession.hasLiteracyFoundation ? (
                                <div style={{ display: "grid", gap: "0.35rem" }}>
                                  <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                    <strong>Literacy foundation</strong>
                                    <span style={getBadgeStyle()}>Important</span>
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
                    <div
                      style={{
                        background: "#f6f5ef",
                        border: "1px solid #d9ddd8",
                        borderRadius: 12,
                        padding: "1rem"
                      }}
                    >
                      No professions match the current family filter and search text.
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                padding: "1rem"
              }}
            >
              Select a rolled profile and civilization first.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedProfession ? 1 : 0.6
        }}
      >
        <div style={{ display: "grid", gap: "1rem" }}>
          <div
            style={{
              background: "rgba(246, 245, 239, 0.96)",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              boxShadow: "0 6px 18px rgba(80, 72, 55, 0.08)",
              display: "grid",
              gap: "0.65rem",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              padding: "0.75rem 0.9rem",
              position: "sticky",
              top: "0.5rem",
              zIndex: 4
            }}
          >
            <div style={{ display: "grid", gap: "0.2rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>6. Skill allocation</h2>
              <strong style={{ fontSize: "0.9rem" }}>Culture</strong>
              <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
              <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
            </div>
            <div style={{ display: "grid", gap: "0.2rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Access</strong>
              <div>
                Social status:{" "}
                {selectedSocietyAccess && selectedSocietyBand !== undefined
                  ? `${selectedSocietyAccess.socialClass} (Band ${selectedSocietyBand})`
                  : "Not selected"}
              </div>
              <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
            </div>
            <div
              style={{
                background: "#fbfaf5",
                border: "1px solid #e7e2d7",
                borderRadius: 10,
                display: "grid",
                gap: "0.2rem",
                padding: "0.65rem 0.8rem"
              }}
            >
              <strong style={{ fontSize: "0.9rem" }}>Ordinary points</strong>
              <div>
                Ordinary spent {progression.primaryPoolSpent} / Remaining {draftView.primaryPoolAvailable}
              </div>
            </div>
            <div
              style={{
                background: "#fbfaf5",
                border: "1px solid #e7e2d7",
                borderRadius: 10,
                display: "grid",
                gap: "0.2rem",
                padding: "0.65rem 0.8rem"
              }}
            >
              <strong style={{ fontSize: "0.9rem" }}>Flexible points</strong>
              <div>
                Flexible spent {progression.secondaryPoolSpent} / Remaining {draftView.secondaryPoolAvailable}
              </div>
            </div>
          </div>

          <section
            style={{
              background: "#fbfaf5",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "1rem",
              padding: "1rem"
            }}
          >
            <strong>Society granted skills</strong>

            {renderSkillRowsTable({
              emptyMessage: "No society-granted foundational skills are currently available.",
              rows: societyGrantedSkillRows
            })}
          </section>

          <section
            style={{
              background: "#fbfaf5",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "1rem",
              padding: "1rem"
            }}
          >
            <strong>Profession skills</strong>

            {coreProfessionSections.length > 0 ? (
              <section
                style={{
                  background: "#fbfaf5",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "1rem",
                  padding: "1rem"
                }}
              >
                <div
                  style={{
                    alignItems: "start",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(0, 1fr) auto"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <strong>Profession groups</strong>
                  </div>
                  <button onClick={() => toggleAllocationSection("core-profession-skills")} type="button">
                    {expandedAllocationSections.includes("core-profession-skills") ? "Collapse" : "Expand"}
                  </button>
                </div>

                {expandedAllocationSections.includes("core-profession-skills") ? (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {coreProfessionSections.map((section) => (
                      <section
                        key={section.definition.id}
                        style={{
                          background: "#fff",
                          border: "1px solid #e7e2d7",
                          borderRadius: 10,
                          display: "grid",
                          gap: "0.75rem",
                          padding: "1rem"
                        }}
                      >
                        <div style={{ display: "grid", gap: "0.25rem" }}>
                          <strong>{section.definition.label}</strong>
                          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                            {section.definition.description}
                          </div>
                        </div>

                        {section.groups.map((group) => {
                          const groupView = draftView.groups.find((item) => item.groupId === group.id);
                          const groupSelectionSlots = selectableSkillSummary.selectionSlots.filter(
                            (slot) => slot.groupId === group.id
                          );
                          const addPreview = skillAllocationContext
                            ? allocateChargenPoint({
                                ...skillAllocationContext,
                                targetId: group.id,
                                targetType: "group"
                              })
                            : undefined;
                          const groupSkillRows = sortSkills(
                            content.skills.filter((skill) => skillDisplayGroupIds.get(skill.id) === group.id)
                          )
                            .map((skill) => skillRowsById.get(skill.id))
                            .filter((row): row is SkillBrowseRow => row !== undefined);
                          const visibleSkillRows = mergeSkillBrowseRowsBySkillId(groupSkillRows);
                          const hasOwnedContent =
                            (groupView?.totalRanks ?? 0) > 0 ||
                            visibleSkillRows.some((row) => row.metrics.totalXp > 0);

                          return (
                            <section
                              key={group.id}
                              style={{
                                background: "#fbfaf5",
                                border: "1px solid #e7e2d7",
                                borderRadius: 10,
                                display: "grid",
                                gap: "0.75rem",
                                padding: "1rem"
                              }}
                            >
                              <div
                                style={{
                                  alignItems: "start",
                                  display: "grid",
                                  gap: "0.75rem",
                                  gridTemplateColumns: "minmax(0, 1fr) auto"
                                }}
                              >
                                <div style={{ display: "grid", gap: "0.2rem" }}>
                                  <strong>{group.name}</strong>
                                  <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                                    Included training package • {visibleSkillRows.length} actual skill
                                    {visibleSkillRows.length === 1 ? "" : "s"}
                                    {hasOwnedContent ? " • currently invested" : ""}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    alignItems: "center",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.5rem",
                                    justifyContent: "flex-end"
                                  }}
                                >
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

                              <div
                                style={{
                                  display: "grid",
                                  gap: "0.5rem",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: "0.85rem" }}>Ordinary spent</div>
                                  <strong>{groupView?.primaryRanks ?? 0}</strong>
                                </div>
                                <div>
                                  <div style={{ fontSize: "0.85rem" }}>Flexible spent</div>
                                  <strong>{groupView?.secondaryRanks ?? 0}</strong>
                                </div>
                                <div>
                                  <div style={{ fontSize: "0.85rem" }}>Current total</div>
                                  <strong>{groupView?.totalRanks ?? 0}</strong>
                                </div>
                              </div>

                              {addPreview?.spentCost ? <div>Next purchase cost: {addPreview.spentCost}</div> : null}

                              {groupSelectionSlots.length > 0 ? (
                                <div style={{ display: "grid", gap: "0.5rem" }}>
                                  {groupSelectionSlots.map((slot) => (
                                    <div
                                      key={`${group.id}:${slot.slotId}`}
                                      style={{
                                        borderTop: "1px solid #e7e2d7",
                                        display: "grid",
                                        gap: "0.5rem",
                                        paddingTop: "0.75rem"
                                      }}
                                    >
                                      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                        <span style={getBadgeStyle({ muted: !slot.isSatisfied })}>
                                          {slot.required ? "Required" : "Optional"} • Choose {slot.chooseCount}
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                        {slot.candidateSkills.map((skill) => {
                                          const isSelected = slot.selectedSkillIds.includes(skill.id);

                                          return (
                                            <button
                                              key={`${slot.slotId}-${skill.id}`}
                                              onClick={() =>
                                                handleSelectGroupSlotSkill(slot.groupId, slot.slotId, skill.id)
                                              }
                                              style={{
                                                background: isSelected ? "#ece8da" : "#fff",
                                                border: isSelected
                                                  ? "1px solid #8b7345"
                                                  : "1px solid #d9ddd8",
                                                borderRadius: 999,
                                                cursor: "pointer",
                                                padding: "0.4rem 0.75rem"
                                              }}
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
                          <div style={{ display: "grid", gap: "0.5rem" }}>
                            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                              <strong>Direct skills in this area</strong>
                              <span style={getBadgeStyle({ muted: true })}>No separate included package</span>
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
              <section
                style={{
                  background: "#fbfaf5",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "1rem",
                  padding: "1rem"
                }}
              >
                <div
                  style={{
                    alignItems: "start",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(0, 1fr) auto"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.25rem" }}>
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

          <section
            style={{
              background: "#fbfaf5",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "1rem",
              padding: "1rem"
            }}
          >
        <h2 style={{ margin: 0 }}>7. Specializations</h2>

        <div style={{ fontSize: "0.95rem" }}>
          Specializations use flexible points and are gated by the parent skill. The default list
          hides distant blocked rows so parentless entries do not overwhelm the page.
        </div>
        <div
          style={{
            alignItems: "end",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "minmax(220px, 1fr) auto auto"
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Search specializations</span>
            <input
              onChange={(event) => setSpecializationSearch(event.target.value)}
              placeholder="Search specialization name"
              type="search"
              value={specializationSearch}
            />
          </label>
          <label
            style={{
              alignItems: "center",
              display: "flex",
              gap: "0.5rem",
              justifySelf: "start"
            }}
          >
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

        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
          Showing {visibleSpecializationRows.length} of {specializationRows.length} specialization
          rows.
        </div>

        {showSpecializations || specializationFilterActive ? (
          <div
            style={{
              border: "1px solid #e7e2d7",
              borderRadius: 10,
              overflowX: "auto"
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #e7e2d7",
                color: "#5e5a50",
                display: "grid",
                fontSize: "0.8rem",
                gap: "0.75rem",
                gridTemplateColumns:
                  "minmax(180px, 2fr) minmax(160px, 1.6fr) repeat(2, minmax(88px, 104px)) minmax(150px, 1fr)",
                padding: "0.75rem 1rem"
              }}
            >
              <strong>Specialization</strong>
              <strong>Parent skill</strong>
              <strong>Parent level</strong>
              <strong>Flexible</strong>
              <strong>Actions</strong>
            </div>

            {visibleSpecializationRows.map((row) => {
              const ruleStatusItems = getRuleStatusItems(row.evaluation);
              const rowFeedback =
                rowActionFeedback[
                  getRowActionFeedbackKey(row.specialization.id, "specialization")
                ];

              return (
                <div
                  key={row.specialization.id}
                  style={{
                    borderTop: "1px solid #f0eadf",
                    display: "grid",
                    gap: "0.35rem",
                    opacity:
                      !row.evaluation.isAllowed && row.parentSkillLevel === 0 && row.specializationLevel === 0
                        ? 0.72
                        : 1,
                    padding: "0.75rem 1rem"
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns:
                        "minmax(180px, 2fr) minmax(160px, 1.6fr) repeat(2, minmax(88px, 104px)) minmax(150px, 1fr)"
                    }}
                  >
                    <div style={{ display: "grid", gap: "0.25rem" }}>
                      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span>{row.specialization.name}</span>
                        <span style={getBadgeStyle({ muted: true })}>Specialization</span>
                      </div>
                    </div>
                    <div>
                      <div>{row.parentSkillName}</div>
                      <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                        Needs level {row.specialization.minimumParentLevel}
                      </div>
                    </div>
                    <div>{row.parentSkillLevel}</div>
                    <div>{row.secondaryRanks}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <button
                        aria-label={`Add ${row.specialization.name}`}
                        disabled={!skillAllocationContext || !row.evaluation.isAllowed}
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
                      role="status"
                      style={{
                        color: getRuleStatusColor(status.tone),
                        fontSize: "0.85rem"
                      }}
                    >
                      {status.message}
                    </div>
                  ))}
                  {rowFeedback ? (
                    <div role="status" style={{ color: "#7a4b00", fontSize: "0.85rem" }}>
                      {rowFeedback}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {visibleSpecializationRows.length === 0 ? (
              <div style={{ padding: "1rem" }}>
                No specializations match the current search or visibility setting.
              </div>
            ) : null}
          </div>
        ) : null}
          </section>

          <section
            style={{
              background: "#fbfaf5",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem"
            }}
          >
        <h2 style={{ margin: 0 }}>8. Other skills</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                alignItems: "start",
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "minmax(0, 1fr) auto"
              }}
            >
              <div style={{ display: "grid", gap: "0.3rem" }}>
                <div style={{ fontSize: "0.9rem" }}>Other skills use flexible points</div>
                <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
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
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                alignItems: "end",
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns:
                  "minmax(220px, 1fr) minmax(180px, 220px) minmax(180px, 240px)",
                padding: "1rem"
              }}
            >
              <label style={{ display: "grid", gap: "0.35rem" }}>
                <span>Search skills</span>
                <input
                  className="other-skill-search-input"
                  onChange={(event) => setSkillSearch(event.target.value)}
                  placeholder="Search by skill name"
                  type="search"
                  value={skillSearch}
                />
              </label>
              <label style={{ display: "grid", gap: "0.35rem" }}>
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
              <label style={{ display: "grid", gap: "0.35rem" }}>
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

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>9. Skills table</h2>

        {groupedPlayerSkillTableRows.length > 0 ? (
          <div
            style={{ display: "grid", gap: "1rem" }}
          >
            {groupedPlayerSkillTableRows.map((group) => (
              <section
                key={group.bucketId}
                style={{
                  border: "1px solid #e7e2d7",
                  borderRadius: 10,
                  overflowX: "auto"
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: "#f6f5ef",
                    borderBottom: "1px solid #e7e2d7",
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem"
                  }}
                >
                  <strong>{group.label}</strong>
                  <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                    {group.rows.length} skill{group.rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div
                  style={{
                    borderBottom: "1px solid #e7e2d7",
                    color: "#5e5a50",
                    display: "grid",
                    fontSize: "0.8rem",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(5, minmax(72px, 88px))",
                    padding: "0.75rem 1rem"
                  }}
                >
                  <strong>Skill</strong>
                  <strong>Stats</strong>
                  <strong>Avg stats</strong>
                  <strong>Skill group XP</strong>
                  <strong>Skill XP</strong>
                  <strong>Total XP</strong>
                  <strong>Total skill level</strong>
                </div>

                {group.rows.map((skill) => (
                  <div
                    key={skill.skillId}
                    style={{
                      borderTop: "1px solid #f0eadf",
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns:
                        "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(5, minmax(72px, 88px))",
                      padding: "0.75rem 1rem"
                    }}
                  >
                    <div>
                      <div>{skill.skillName}</div>
                      {skill.literacyWarning ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                          {skill.literacyWarning}
                        </div>
                      ) : null}
                    </div>
                    <div>{skill.stats}</div>
                    <div>{skill.avgStats}</div>
                    <div>{skill.skillGroupXp}</div>
                    <div>{skill.skillXp}</div>
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

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>10. Review summary</h2>

        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
          }}
        >
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #e7e2d7",
              borderRadius: 10,
              display: "grid",
              gap: "0.35rem",
              padding: "1rem"
            }}
          >
            <strong>Character summary</strong>
            <div>Profile: {selectedProfile?.label ?? "Not selected"}</div>
            <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
            <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
            <div>Social band: {selectedSocialBand ?? "Not selected"}</div>
            <div>Social class: {selectedSocietyAccess?.socialClass ?? "Not selected"}</div>
            <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
            <div>
              Languages:{" "}
              {displayedLanguageLabels.length > 0
                ? displayedLanguageLabels.join(", ")
                : "None"}
            </div>
            <div>Skill groups: {draftView.groups.length}</div>
            <div>Skills: {draftView.skills.length}</div>
            <div>Core skills: {selectableSkillSummary.coreSkillIds.length}</div>
            <div>Required group choices: {selectableSkillSummary.selectionSlots.length}</div>
            <div>Selectable pool: {selectableSkillSummary.selectableSkillIds.length}</div>
            <div>Chosen skills: {selectableSkillSummary.selectedSkillIds.length}</div>
            <div>Specializations: {draftView.specializations.length}</div>
          </div>

          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #e7e2d7",
              borderRadius: 10,
              display: "grid",
              gap: "0.35rem",
              padding: "1rem"
            }}
          >
            <strong>Points and education</strong>
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
            <div>GM_int: {draftView.education.gmInt}</div>
            <div>Total skill points invested: {draftView.totalSkillPointsInvested}</div>
          </div>

        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>11. Finalize character</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Confirm the name and create the local character record. The signed-in player is stored as
          the creator for attribution.
        </div>
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)",
            padding: "1rem"
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Character name</span>
            <input
              onChange={(event) => setCharacterName(event.target.value)}
              placeholder="Leave blank to use the default generated name"
              type="text"
              value={characterName}
            />
          </label>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <strong>Creator attribution</strong>
            <div>{formatPlayerLabel(currentUser)}</div>
            <button
              disabled={!review.canFinalize || currentUser === undefined || isFinalizing}
              onClick={() => {
                handleFinalize().catch((error) => {
                  console.error(error);
                });
              }}
              style={{ width: "fit-content" }}
              type="button"
            >
              {isFinalizing ? "Saving character..." : "Finalize character"}
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>12. Saved local characters</h2>
        {savedCharacters.length > 0 ? (
          savedCharacters.map((character) => (
            <div
              key={character.id}
              style={{
                borderTop: "1px solid #e7e2d7",
                display: "grid",
                gap: "0.25rem",
                paddingTop: "0.75rem"
              }}
            >
              <strong>{character.build.name}</strong>
              <div>Profile: {character.build.profile.label}</div>
              <div>Profession: {character.build.professionId ?? "None"}</div>
              <div>Social class: {character.build.socialClass ?? "None"}</div>
              <div>Creator: {formatSavedCharacterCreator(character)}</div>
              <div>Finalized: {character.finalizedAt}</div>
            </div>
          ))
        ) : (
          <div>No local characters have been finalized yet.</div>
        )}
      </section>

      <style jsx>{`
        .other-skill-search-input {
          appearance: none;
          -webkit-appearance: none;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.4;
          padding: 0.5rem;
        }

        .other-skill-search-input::placeholder {
          color: #6b6558;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.4;
          opacity: 1;
        }
      `}</style>
        </>
      ) : null}
    </section>
  );
}
