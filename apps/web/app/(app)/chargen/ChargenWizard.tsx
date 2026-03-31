"use client";

import { useEffect, useState, type CSSProperties } from "react";

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
import { getSkillGroupIds } from "@glantri/domain";
import {
  applyProfessionGrants,
  allocateChargenPoint,
  buildChargenDraftView,
  buildChargenSkillAccessSummary,
  createChargenProgression,
  evaluateSkillSelection,
  finalizeChargenDraft,
  generateProfiles,
  getFlexiblePoolTotal,
  getOrdinaryPoolTotal,
  normalizeChargenProgression,
  removeChargenPoint,
  removeSecondaryPoint,
  resolveEffectiveProfessionPackage,
  reviewChargenDraft,
  selectProfile,
  selectBestSkillGroupContribution,
  spendSecondaryPoint,
  summarizeRolledProfile,
  type RolledProfileSummary
} from "@glantri/rules-engine";

import type { LocalCharacterRecord } from "../../../src/lib/offline/glantriDexie";
import {
  filterProfessionBrowseItems,
  filterSpecializationBrowseItems,
  getSkillAccessSourceLabels,
  matchesSkillBrowseFilters,
  type ProfessionBrowseItem,
  type SkillVisibilityFilter
} from "../../../src/lib/chargen/chargenBrowse";
import { getCurrentSessionUser } from "../../../src/lib/api/localServiceClient";
import { ChargenSessionRepository } from "../../../src/lib/offline/repositories/chargenSessionRepository";
import { ContentCacheRepository } from "../../../src/lib/offline/repositories/contentCacheRepository";
import { LocalCharacterRepository } from "../../../src/lib/offline/repositories/localCharacterRepository";

const SESSION_ID = "chargen-vertical-slice";
const CONTENT_CACHE_KEY = "canonical-content";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const chargenSessionRepository = new ChargenSessionRepository();
const contentCacheRepository = new ContentCacheRepository();
const localCharacterRepository = new LocalCharacterRepository();

const rolledProfiles = generateProfiles({});
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

interface ProfessionBrowseCard extends ProfessionBrowseItem {
  coreGroupNames: string[];
  coreReachableSkillNames: string[];
  favoredGroupNames: string[];
  favoredReachableSkillNames: string[];
  familyDescription?: string;
  normalAccessGroupNames: string[];
  profession: ProfessionDefinition;
  summary: {
    totalEffectiveCoreReachableSkills: number;
    totalEffectiveFavoredReachableSkills: number;
  };
}

interface RuleStatusItem {
  message: string;
  tone: RuleStatusTone;
}

interface SkillBrowseRow {
  evaluation: ReturnType<typeof evaluateSkillSelection>;
  isNormalAccess: boolean;
  metrics: SkillAllocationMetrics;
  skill: SkillDefinition;
  sourceLabels: string[];
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
  advisories: { message: string }[];
  blockingReasons: { message: string }[];
  warnings: { message: string }[];
}): RuleStatusItem[] {
  return [
    ...input.blockingReasons.map((reason) => ({
      message: reason.message,
      tone: "blocked" as const
    })),
    ...input.warnings.map((warning) => ({
      message: warning.message,
      tone: "warning" as const
    })),
    ...input.advisories.map((advisory) => ({
      message: advisory.message,
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
  if (!profile) {
    return 0;
  }

  const total = skill.linkedStats.reduce(
    (sum, stat) => sum + (profile.rolledStats[stat as GlantriCharacteristicKey] ?? 0),
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
  const [characterName, setCharacterName] = useState("");
  const [content, setContent] = useState<CanonicalContent>(defaultCanonicalContent);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>();
  const [feedback, setFeedback] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [progression, setProgression] = useState<CharacterProgression>(createChargenProgression());
  const [rowActionFeedback, setRowActionFeedback] = useState<Record<string, string>>({});
  const [savedCharacters, setSavedCharacters] = useState<LocalCharacterRecord[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [selectedSocietyId, setSelectedSocietyId] = useState<string>();
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();
  const [showRolledProfileOptions, setShowRolledProfileOptions] = useState(true);
  const [expandedProfessionId, setExpandedProfessionId] = useState<string>();
  const [professionFamilyFilter, setProfessionFamilyFilter] = useState("all");
  const [professionSearch, setProfessionSearch] = useState("");
  const [expandedSkillGroups, setExpandedSkillGroups] = useState<string[]>([]);
  const [showOtherSkills, setShowOtherSkills] = useState(false);
  const [showSpecializations, setShowSpecializations] = useState(false);
  const [skillVisibilityFilter, setSkillVisibilityFilter] =
    useState<SkillVisibilityFilter>("all");
  const [skillSearch, setSkillSearch] = useState("");
  const [specializationSearch, setSpecializationSearch] = useState("");
  const [showAllSpecializations, setShowAllSpecializations] = useState(false);

  const selectedProfile = selectedProfileId
    ? selectProfile({ profileId: selectedProfileId, profiles: rolledProfiles })
    : undefined;
  const selectedSocialBand =
    selectedProfile?.socialClassRoll !== undefined
      ? getSocialBand(selectedProfile.socialClassRoll)
      : undefined;
  const selectedProfileSummary = selectedProfile
    ? summarizeRolledProfile({
        profile: selectedProfile
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
  const selectedSociety = societies.find((society) => society.id === selectedSocietyId);
  const selectedSocietyAccess =
    selectedSociety && selectedSocialBand !== undefined
      ? selectedSociety.socialBands[selectedSocialBand]
      : undefined;
  const selectedSocietyBand = selectedSociety ? selectedSocialBand : undefined;
  const availableProfessions = getAllowedProfessions(content.professions, selectedSocietyAccess);
  const selectedProfession = availableProfessions.find((item) => item.id === selectedProfessionId);
  const ordinaryPoolTotal = getOrdinaryPoolTotal();
  const flexiblePoolTotal = getFlexiblePoolTotal(selectedProfile);
  const sortedSkillGroups = sortSkillGroups(content.skillGroups);
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

      return {
        coreGroupNames: professionPackage.core.finalEffectiveGroupIds.map(
          (groupId) => content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId
        ),
        coreReachableSkillNames: professionPackage.core.finalEffectiveReachableSkillIds.map(
          (skillId) => content.skills.find((skill) => skill.id === skillId)?.name ?? skillId
        ),
        description: profession.description,
        familyDescription: professionPackage.family.description,
        familyName: professionPackage.family.name,
        favoredGroupNames: professionPackage.favored.finalEffectiveGroupIds.map(
          (groupId) => content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId
        ),
        favoredReachableSkillNames: professionPackage.favored.finalEffectiveReachableSkillIds.map(
          (skillId) => content.skills.find((skill) => skill.id === skillId)?.name ?? skillId
        ),
        id: profession.id,
        name: profession.name,
        normalAccessGroupNames: sortedSkillGroups
          .filter((group) => professionAccess?.normalSkillGroupIds.includes(group.id))
          .map((group) => group.name),
        profession,
        summary: professionPackage.summary
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
    content.skills.filter((skill) => skillDisplayGroupIds.get(skill.id) === undefined)
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
  const visibleAdditionalAllowedSkillRows = additionalAllowedSkills
    .map((skill) => skillRowsById.get(skill.id))
    .filter((row): row is SkillBrowseRow => row !== undefined)
    .filter((row) =>
      matchesSkillBrowseFilters({
        isAllowed: row.evaluation.isAllowed,
        isOwned: row.metrics.totalXp > 0,
        name: row.skill.name,
        search: skillSearch,
        visibilityFilter: skillVisibilityFilter
      })
    );
  const visibleOtherSkillRows = otherSkills
    .map((skill) => skillRowsById.get(skill.id))
    .filter((row): row is SkillBrowseRow => row !== undefined)
    .filter((row) =>
      matchesSkillBrowseFilters({
        isAllowed: row.evaluation.isAllowed,
        isOwned: row.metrics.totalXp > 0,
        name: row.skill.name,
        search: skillSearch,
        visibilityFilter: skillVisibilityFilter
      })
    );
  const skillFilterActive =
    skillSearch.trim().length > 0 || skillVisibilityFilter !== "all";
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
  const specializationRows = [...content.specializations]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((specialization) => {
      const parentSkill = content.skills.find((skill) => skill.id === specialization.skillId);
      const purchasedParentSkill = progression.skills.find(
        (skill) => skill.skillId === specialization.skillId
      );
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
        parentSkillLevel: purchasedParentSkill?.ranks ?? 0,
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
      const [cachedContent, savedDraft, existingCharacters, sessionUser] = await Promise.all([
        contentCacheRepository.get(CONTENT_CACHE_KEY),
        chargenSessionRepository.get(SESSION_ID),
        localCharacterRepository.list(),
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

      if (savedDraft) {
        setSelectedProfileId(savedDraft.selectedProfile?.id);
        setShowRolledProfileOptions(!savedDraft.selectedProfile?.id);
        setSelectedProfessionId(savedDraft.selectedProfessionId);
        setSelectedSocietyId(savedDraft.selectedSocietyId);

        const normalized = normalizeChargenProgression(savedDraft.progression);
        const hasSavedAllocation =
          normalized.primaryPoolSpent > 0 ||
          normalized.secondaryPoolSpent > 0 ||
          normalized.skillGroups.length > 0 ||
          normalized.skills.length > 0 ||
          normalized.specializations.length > 0;

        if (savedDraft.selectedProfessionId && !hasSavedAllocation) {
          setProgression(
            applyProfessionGrants({
              content: startingContent,
              professionId: savedDraft.selectedProfessionId
            })
          );
        } else {
          setProgression(normalized);
        }
      }

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
    if (selectedSocietyId) {
      return;
    }

    if (societies.length === 1) {
      setSelectedSocietyId(societies[0].id);
    }
  }, [selectedSocietyId, societies]);

  useEffect(() => {
    if (!hydrated || selectedProfessionId || !selectedSocietyAccess) {
      return;
    }

    if (availableProfessions.length === 1) {
      setSelectedProfessionId(availableProfessions[0].id);
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
    if (!hydrated) {
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
    setExpandedSkillGroups([]);
    setShowOtherSkills(false);
    setShowSpecializations(false);
  }, [selectedProfessionId]);

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
    hydrated,
    progression,
    selectedProfessionId,
    selectedProfile,
    selectedSocietyBand,
    selectedSocietyAccess,
    selectedSocietyId
  ]);

  function handleSocietyChange(societyId: string) {
    setSelectedSocietyId(societyId);
    setSelectedProfessionId(undefined);
    setProgression(createChargenProgression());
    setRowActionFeedback({});
    setFeedback(["Changing society resets profession access and point allocation."]);
  }

  function handleProfessionChange(professionId: string) {
    setSelectedProfessionId(professionId);
    setExpandedProfessionId(professionId);
    setProgression(
      applyProfessionGrants({
        content,
        professionId
      })
    );
    setRowActionFeedback({});
    setFeedback(["Profession access loaded. Skill allocation, education, and review are ready."]);
  }

  function toggleProfessionPreview(professionId: string) {
    setExpandedProfessionId((current) => (current === professionId ? undefined : professionId));
  }

  function toggleSkillGroup(groupId: string) {
    setExpandedSkillGroups((current) =>
      current.includes(groupId)
        ? current.filter((candidate) => candidate !== groupId)
        : [...current, groupId]
    );
  }

  function handleProfileSelect(profileId: string) {
    setSelectedProfileId(profileId);
    setShowRolledProfileOptions(false);
    setRowActionFeedback({});
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

  async function handleFinalize() {
    if (!selectedSocietyId || selectedSocialBand === undefined) {
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

    await localCharacterRepository.save({
      build: result.build,
      creatorDisplayName: currentUser?.displayName,
      creatorEmail: currentUser?.email,
      creatorId: currentUser?.id
    });
    await chargenSessionRepository.delete(SESSION_ID);

    setSavedCharacters(await localCharacterRepository.list());
    setCharacterName("");
    setSelectedProfileId(undefined);
    setSelectedProfessionId(undefined);
    setSelectedSocietyId(societies.length === 1 ? societies[0].id : undefined);
    setShowRolledProfileOptions(true);
    setProgression(createChargenProgression());
    setRowActionFeedback({});
    setFeedback([
      `Saved local character record: ${result.build.name}.`,
      ...result.warnings
    ]);
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

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>1. Pick a rolled profile</h2>
        {selectedProfile && !showRolledProfileOptions ? (
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
              <strong>{selectedProfile.label}</strong>
              <button onClick={() => setShowRolledProfileOptions(true)} type="button">
                Change roll
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <div>Total {selectedProfileSummary?.totalCharacteristicSum ?? 0}</div>
              <div>Distraction {selectedProfile.distractionLevel}</div>
              <div>Social band {formatProfileSocialBand(selectedProfile)}</div>
            </div>
          </div>
        ) : (
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
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem", opacity: selectedProfile ? 1 : 0.6 }}>
        <h2 style={{ margin: 0 }}>2. Choose society</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Choose the society used for this character. Society determines the class labels and later
          skill, education, and profession access.
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {societies.map((society) => (
            <label
              key={society.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                cursor: selectedProfile ? "pointer" : "not-allowed",
                padding: "1rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  checked={selectedSocietyId === society.id}
                  disabled={!selectedProfile}
                  name="society"
                  onChange={() => handleSocietyChange(society.id)}
                  type="radio"
                />
                <strong>{society.name}</strong>
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                Band labels:{" "}
                {[1, 2, 3, 4]
                  .map((band) => {
                    const access = society.socialBands[band as SocialBand];
                    return access ? `${band}: ${access.socialClass}` : null;
                  })
                  .filter((value) => value !== null)
                  .join(" • ")}
              </div>
              {societies.length === 1 ? (
                <div style={{ marginTop: "0.25rem" }}>Only available society at present.</div>
              ) : null}
              {society.notes ? <div style={{ marginTop: "0.25rem" }}>{society.notes}</div> : null}
            </label>
          ))}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedProfile && selectedSociety ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>3. Social class</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Your social roll maps to one of four universal bands. The selected society determines the
          class name for that band.
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
        <h2 style={{ margin: 0 }}>4. Choose profession</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Filter the list first, then open one profession to inspect its package. The favored
          package is a preview of likely reach, not a direct grant by itself.
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {availableProfessions.length > 0 ? (
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
                            <strong>{profession.name}</strong>
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
                              Normal groups {profession.normalAccessGroupNames.length}
                            </span>
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
                            Core package feeds the profession’s main training package. Favored
                            package shows useful follow-on reach, but it does not automatically make
                            every favored skill directly selectable in the allocation table.
                          </div>
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                              <strong>Core package</strong>
                              <span style={getBadgeStyle()}>Profession grant</span>
                            </div>
                            <div>Groups: {formatPreviewList(profession.coreGroupNames)}</div>
                            <div>
                              Reachable skills ({profession.summary.totalEffectiveCoreReachableSkills}
                              ): {formatPreviewList(profession.coreReachableSkillNames)}
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                              <strong>Favored package</strong>
                              <span style={getBadgeStyle({ muted: true })}>Preview only</span>
                            </div>
                            <div>Groups: {formatPreviewList(profession.favoredGroupNames)}</div>
                            <div>
                              Reachable skills (
                              {profession.summary.totalEffectiveFavoredReachableSkills}):{" "}
                              {formatPreviewList(profession.favoredReachableSkillNames)}
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                              <strong>Current normal access in this society</strong>
                              <span style={getBadgeStyle({ muted: true })}>Chargen selectors</span>
                            </div>
                            <div>Groups: {formatPreviewList(profession.normalAccessGroupNames)}</div>
                          </div>
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
          ) : (
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                padding: "1rem"
              }}
            >
              Select a rolled profile and society first.
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
        <h2 style={{ margin: 0 }}>5. Skill allocation</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Normal access is what you can buy directly with ordinary points. Favored package preview
          from the profession step is guidance only. Other skills sit outside normal access and use
          flexible points.
        </div>
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            padding: "1rem"
          }}
        >
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <strong>Normal access</strong>
            <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
            <div>Social status: {selectedSocietyAccess?.socialClass ?? "Not selected"}</div>
            <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
          </div>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <strong>Access summary</strong>
            <div>
              Normal-access groups:{" "}
              {normalSkillGroups.length > 0
                ? normalSkillGroups.map((group) => group.name).join(", ")
                : "None"}
            </div>
            <div>
              Direct normal-access skills:{" "}
              {additionalAllowedSkills.length > 0
                ? additionalAllowedSkills.map((skill) => skill.name).join(", ")
                : "None"}
            </div>
            <div>Other skills are still visible below, but they require flexible points.</div>
            <div>
              Social band:{" "}
              {selectedSocietyBand !== undefined
                ? `${selectedSocietyBand} (${getBandRangeLabel(selectedSocietyBand)})`
                : "Not selected"}
            </div>
          </div>
        </div>

        <div
          style={{
            alignItems: "end",
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 220px)",
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
        </div>

        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <div>
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>Ordinary</strong>
              <div>Total: {ordinaryPoolTotal}</div>
              <div>Spent: {progression.primaryPoolSpent}</div>
              <div>Remaining: {draftView.primaryPoolAvailable}</div>
            </div>
          </div>
          <div>
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>Flexible</strong>
              <div>Total: {flexiblePoolTotal}</div>
              <div>Spent: {progression.secondaryPoolSpent}</div>
              <div>Remaining: {draftView.secondaryPoolAvailable}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {normalSkillGroups.map((group) => {
            const groupView = draftView.groups.find((item) => item.groupId === group.id);
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
            const visibleSkillRows = groupSkillRows.filter((row) =>
              matchesSkillBrowseFilters({
                isAllowed: row.evaluation.isAllowed,
                isOwned: row.metrics.totalXp > 0,
                name: row.skill.name,
                search: skillSearch,
                visibilityFilter: skillVisibilityFilter
              })
            );
            const hasOwnedContent =
              (groupView?.totalRanks ?? 0) > 0 ||
              groupSkillRows.some((row) => row.metrics.totalXp > 0);
            const isExpanded =
              expandedSkillGroups.includes(group.id) ||
              hasOwnedContent ||
              (skillFilterActive && visibleSkillRows.length > 0);

            if (skillFilterActive && visibleSkillRows.length === 0 && !hasOwnedContent) {
              return null;
            }

            return (
              <section
                key={group.id}
                style={{
                  background: "#fbfaf5",
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
                  <div style={{ display: "grid", gap: "0.2rem" }}>
                    <strong>Skill group: {group.name}</strong>
                    <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                      {visibleSkillRows.length} visible skill{visibleSkillRows.length === 1 ? "" : "s"}
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
                    <button onClick={() => toggleSkillGroup(group.id)} type="button">
                      {isExpanded ? "Collapse" : "Expand"}
                    </button>
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

                {isExpanded ? (
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

                    {visibleSkillRows.length > 0 ? (
                      visibleSkillRows.map((row) => {
                        const ruleStatusItems = getRuleStatusItems(row.evaluation);
                        const rowFeedback =
                          rowActionFeedback[getRowActionFeedbackKey(row.skill.id, "skill")];

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
                                <div>{row.skill.name}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                  {row.sourceLabels.map((label) => (
                                    <span key={`${row.skill.id}-${label}`} style={getBadgeStyle()}>
                                      {label}
                                    </span>
                                  ))}
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
                            {rowFeedback ? (
                              <div
                                role="status"
                                style={{ color: "#7a4b00", fontSize: "0.85rem" }}
                              >
                                {rowFeedback}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: "1rem" }}>
                        No skills in this group match the current search or filter.
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

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
                <strong>Other and ungrouped skills</strong>
                <div style={{ fontSize: "0.9rem" }}>
                  This section stays collapsed by default. It includes true other skills plus any
                  direct normal-access skills that do not sit inside one of your normal-access groups.
                </div>
                <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                  {visibleAdditionalAllowedSkillRows.length} direct normal-access skill
                  {visibleAdditionalAllowedSkillRows.length === 1 ? "" : "s"} visible •{" "}
                  {visibleOtherSkillRows.length} other skill
                  {visibleOtherSkillRows.length === 1 ? "" : "s"} visible
                </div>
              </div>
              <button onClick={() => setShowOtherSkills((current) => !current)} type="button">
                {showOtherSkills || (skillFilterActive && visibleOtherSkillRows.length > 0)
                  ? "Collapse"
                  : "Expand"}
              </button>
            </div>
          </div>

          {showOtherSkills || (skillFilterActive && visibleOtherSkillRows.length > 0) ? (
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

              {[...visibleAdditionalAllowedSkillRows, ...visibleOtherSkillRows].map((row) => {
                const ruleStatusItems = getRuleStatusItems(row.evaluation);
                const rowFeedback =
                  rowActionFeedback[getRowActionFeedbackKey(row.skill.id, "skill")];

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
                        <div>{row.skill.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {row.sourceLabels.length > 0 ? (
                            row.sourceLabels.map((label) => (
                              <span key={`${row.skill.id}-${label}`} style={getBadgeStyle()}>
                                {label}
                              </span>
                            ))
                          ) : (
                            <span style={getBadgeStyle({ muted: true })}>Outside normal access</span>
                          )}
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
                    {rowFeedback ? (
                      <div role="status" style={{ color: "#7a4b00", fontSize: "0.85rem" }}>
                        {rowFeedback}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {visibleAdditionalAllowedSkillRows.length === 0 && visibleOtherSkillRows.length === 0 ? (
                <div style={{ padding: "1rem" }}>
                  No other or ungrouped skills match the current search or filter.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
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
        <h2 style={{ margin: 0 }}>6. Specializations</h2>

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
                    <div>{row.specialization.name}</div>
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
          gap: "1rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>7. Skills table</h2>

        {playerSkillTableRows.length > 0 ? (
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

            {playerSkillTableRows.map((skill) => (
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
                    <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>{skill.literacyWarning}</div>
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
        <h2 style={{ margin: 0 }}>8. Review summary</h2>

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
            <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
            <div>Social band: {selectedSocialBand ?? "Not selected"}</div>
            <div>Social class: {selectedSocietyAccess?.socialClass ?? "Not selected"}</div>
            <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
            <div>Skill groups: {draftView.groups.length}</div>
            <div>Skills: {draftView.skills.length}</div>
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
        <h2 style={{ margin: 0 }}>9. Finalize character</h2>
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
              disabled={!review.canFinalize || currentUser === undefined}
              onClick={() => {
                handleFinalize().catch((error) => {
                  console.error(error);
                });
              }}
              style={{ width: "fit-content" }}
              type="button"
            >
              Finalize to local character record
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
        <h2 style={{ margin: 0 }}>10. Saved local characters</h2>
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
    </section>
  );
}
