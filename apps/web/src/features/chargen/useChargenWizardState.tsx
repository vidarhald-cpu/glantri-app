"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultCanonicalContent,
  withCompetencyContentV2,
  type CanonicalContent,
  validateCanonicalContent,
} from "@glantri/content";
import type { AuthUser } from "@glantri/auth";
import type {
  ChargenRuleSet,
  CharacterProgression,
  GlantriCharacteristicKey,
  RolledCharacterProfile,
} from "@glantri/domain";
import {
  DEFAULT_CHARGEN_RULE_SET,
  getCharacterSkillKey,
  glantriCharacteristicLabels,
} from "@glantri/domain";
import {
  applyProfessionGrants,
  buildChargenLanguageSelectionSummary,
  buildChargenMotherTongueSummary,
  buildChargenCoreRouteStatus,
  applyChargenStatBuild,
  applyChargenStatExchange,
  allocateChargenPoint,
  buildResolvedProfile,
  buildChargenDraftView,
  buildChargenSelectableSkillSummary,
  buildChargenSkillAccessSummary,
  createChargenStatAdjustmentState,
  describeChargenGroupTrainingChange,
  createChargenMethodPolicy,
  createChargenProgression,
  evaluateSkillSelection,
  finalizeChargenDraft,
  generateProfiles,
  removeChargenPoint,
  removeSecondaryPoint,
  resolveEffectiveProfessionPackage,
  reviewChargenDraft,
  selectProfile,
  spendSecondaryPoint,
  summarizeRolledProfile,
  getResolvedProfileStats,
  type ChargenStatAdjustmentState,
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
  type SkillBrowseTypeFilter,
  type SkillVisibilityFilter,
} from "@/lib/chargen/chargenBrowse";
import {
  getCurrentSessionUser,
  loadActiveChargenRuleSet,
  saveCharacterToServer,
} from "@/lib/api/localServiceClient";
import { loadCanonicalContentFromServer } from "@/lib/api/contentClient";
import type { CachedContentRecord, ChargenSessionDraft } from "@/lib/offline/glantriDexie";
import { ChargenSessionRepository } from "@/lib/offline/repositories/chargenSessionRepository";
import { ContentCacheRepository } from "@/lib/offline/repositories/contentCacheRepository";
import { LocalCharacterRepository } from "@/lib/offline/repositories/localCharacterRepository";
import { formatDerivedSkillSourceLabel } from "@/lib/characters/derivedSkillLabels";
import {
  getAllowedProfessions,
  buildSocietyOptions,
  buildCivilizationOptions,
  compareRolledProfileCards,
  formatActionError,
  formatSkillStats,
  getBadgeStyle,
  getGroupSlotCandidateSkillIds,
  getOrdinarySkillNextCost,
  getRowActionFeedbackKey,
  getRuleStatusColor,
  getSkillAllocationMetrics,
  getSkillDisplayGroupId,
  getSkillDisplayName,
  getSkillRowMessages,
  getSkillTierLabel,
  getSkillTierTone,
  getSocialBand,
  sortSkills,
  sortSkillGroups,
  type ProfessionBrowseCard,
  type SkillBrowseRow,
} from "./chargenWizardHelpers";
import { buildProfessionTrainingAccess } from "./professionTrainingAccess";
import {
  createTargetCompetencyChargenSource,
  buildTargetRuntimeContent,
  getTargetCompetencyActivationBlockers,
} from "./targetCompetencyContent";
import {
  CHARGEN_CONTENT_CACHE_KEY,
  CHARGEN_STALE_CONTENT_DIAGNOSTIC_KEY,
  EMPTY_CHARGEN_CONTENT,
  evaluateCachedChargenContent,
  evaluateChargenContent,
  formatChargenContentDiagnostics,
  type ChargenContentDiagnostics,
} from "./chargenContentAvailability";
import { useProfessionBrowseModel } from "./components/ProfessionTraining";
import { persistAuthenticatedFinalizedCharacter } from "./finalizeCharacterAuthority";
import { ChargenDraftPersistenceCoordinator } from "./chargenDraftPersistenceCoordinator";

const CONTENT_CACHE_KEY = CHARGEN_CONTENT_CACHE_KEY;

const chargenSessionRepository = new ChargenSessionRepository();
const contentCacheRepository = new ContentCacheRepository();
const localCharacterRepository = new LocalCharacterRepository();

/**
 * Retains a rejected snapshot under a separate diagnostic key so the failure stays reproducible,
 * then evicts the record Chargen reads from. Preservation never blocks eviction: if the snapshot
 * cannot be retained the unusable record is still removed, because leaving it in place is what
 * keeps a profile wedged.
 */
async function preserveAndEvictRejectedSnapshot(
  record: CachedContentRecord,
  diagnostics: ChargenContentDiagnostics,
): Promise<void> {
  console.warn(formatChargenContentDiagnostics(diagnostics, "cached snapshot"));

  try {
    await contentCacheRepository.save(
      CHARGEN_STALE_CONTENT_DIAGNOSTIC_KEY,
      record.value,
      `rejected:${diagnostics.reason}:${record.version}`,
    );
  } catch (error) {
    console.warn(error);
  }

  await contentCacheRepository.delete(CONTENT_CACHE_KEY);
}

export function useChargenWizardState() {
  const router = useRouter();
  const draftPersistenceRef = useRef<ChargenDraftPersistenceCoordinator | null>(null);

  if (!draftPersistenceRef.current) {
    draftPersistenceRef.current = new ChargenDraftPersistenceCoordinator((error) => {
      console.error(error);
    });
  }

  const draftPersistence = draftPersistenceRef.current;
  const [characterName, setCharacterName] = useState("");
  const [contentSource, setContentSource] = useState(() =>
    createTargetCompetencyChargenSource(defaultCanonicalContent),
  );
  const [contentUnavailable, setContentUnavailable] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [hasStartedChargen, setHasStartedChargen] = useState(false);
  const [historicalDraft, setHistoricalDraft] = useState<ChargenSessionDraft>();
  const [resumableDraft, setResumableDraft] = useState<ChargenSessionDraft>();
  const [hydrated, setHydrated] = useState(false);
  const [profileAdjustments, setProfileAdjustments] = useState<
    Record<string, ChargenStatAdjustmentState>
  >({});
  const [progression, setProgression] = useState<CharacterProgression>(createChargenProgression());
  const [rowActionFeedback, setRowActionFeedback] = useState<Record<string, string>>({});
  /**
   * Set when a Learning Group training change moved the build's training cost the opposite
   * way to the training itself. Rule decision 0011 makes that canonical, so the interface
   * must show the before/after cost and say why rather than let the number move unexplained.
   */
  const [groupTrainingCostChange, setGroupTrainingCostChange] = useState<
    | {
        previousTotal: number;
        shift: "raised-by-overlap" | "reduced-by-overlap";
        total: number;
      }
    | undefined
  >(undefined);
  const [rolledProfiles, setRolledProfiles] = useState<RolledCharacterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string>();
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();
  /* #577: the three chooser sections arrive collapsed, so a first arrival is a section heading and
     its expand control rather than the whole list. Nothing is auto-selected; expanding reveals the
     same chooser, and a selection still collapses the section through the handlers below. */
  const [showRolledProfileOptions, setShowRolledProfileOptions] = useState(false);
  const [showCivilizationChooser, setShowCivilizationChooser] = useState(false);
  const [showProfessionChooser, setShowProfessionChooser] = useState(false);
  const [expandedProfessionId, setExpandedProfessionId] = useState<string>();
  const [professionCategoryFilter, setProfessionCategoryFilter] = useState("all");
  const [professionSearch, setProfessionSearch] = useState("");
  const [chargenRuleSet, setChargenRuleSet] = useState<ChargenRuleSet>(DEFAULT_CHARGEN_RULE_SET);
  const [expandedAllocationSections, setExpandedAllocationSections] = useState<string[]>([]);
  const [expandedSkillDetails, setExpandedSkillDetails] = useState<string[]>([]);
  const [showOtherSkills, setShowOtherSkills] = useState(false);
  const [showSpecializations, setShowSpecializations] = useState(false);
  const [skillVisibilityFilter, setSkillVisibilityFilter] = useState<SkillVisibilityFilter>("all");
  const [skillSearch, setSkillSearch] = useState("");
  const [skillTypeFilter, setSkillTypeFilter] = useState<SkillBrowseTypeFilter>("all");
  const [specializationSearch, setSpecializationSearch] = useState("");
  const [showAllSpecializations, setShowAllSpecializations] = useState(false);
  const [exchangeFirstStat, setExchangeFirstStat] = useState<GlantriCharacteristicKey>("str");
  const [exchangeSecondStat, setExchangeSecondStat] = useState<GlantriCharacteristicKey>("dex");
  const [buildIncreaseStat, setBuildIncreaseStat] = useState<GlantriCharacteristicKey>("str");
  const [buildDecreaseStat, setBuildDecreaseStat] = useState<GlantriCharacteristicKey>("dex");

  /**
   * `buildTargetRuntimeContent` throws by design when the source carries unresolved linked-stat
   * mappings. Asking the existing activation-blocker guard first keeps that rejection out of the
   * React render phase: an unusable source yields an explicitly empty catalogue and the wizard
   * renders its unavailable state instead of tearing the tree down. No other catalogue is
   * substituted.
   */
  const contentProjection = useMemo(() => {
    const blockers = getTargetCompetencyActivationBlockers(contentSource);

    if (blockers.length > 0) {
      return { blockers, content: EMPTY_CHARGEN_CONTENT };
    }

    return {
      blockers,
      content: withCompetencyContentV2(buildTargetRuntimeContent(contentSource)),
    };
  }, [contentSource]);
  const content: CanonicalContent = contentProjection.content;
  const chargenContentUnavailable = contentUnavailable || contentProjection.blockers.length > 0;
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
          profile: selectedRolledProfile,
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
        profile: selectedRolledProfile,
      })
    : undefined;
  const sortedRolledProfiles = rolledProfiles
    .map((profile, originalIndex) => ({
      originalIndex,
      profile,
      summary: summarizeRolledProfile({
        profile,
      }),
    }))
    .sort(compareRolledProfileCards);
  const societies = buildSocietyOptions(content.societyLevels);
  const civilizations = buildCivilizationOptions(content);
  const selectedCivilization = civilizations.find(
    (civilization) => civilization.id === selectedCivilizationId,
  );
  const selectedSocietyId = selectedCivilization?.linkedSocietyId;
  const selectedSociety = societies.find((society) => society.id === selectedSocietyId);
  const selectedSocietyAccess =
    selectedSociety && selectedSocialBand !== undefined
      ? selectedSociety.socialBands[selectedSocialBand]
      : undefined;
  const selectedSocietyBand = selectedSociety ? selectedSocialBand : undefined;
  // Civilization/Society still drives existing Profession compatibility calculations.
  // Target acquisitions use the separate explicit unbound/general source context.
  const activeSocietyId = selectedSocietyId;
  const activeSocialBand = selectedSocietyBand;
  const availableProfessions = content.chargenCatalogue?.professionIds
    ? content.professions
    : getAllowedProfessions(content.professions, selectedSocietyAccess);
  const selectedProfession = availableProfessions.find((item) => item.id === selectedProfessionId);
  const sortedSkillGroups = sortSkillGroups(content.skillGroups);
  const playerFacingSkillBucketDefinitions = getPlayerFacingSkillBucketDefinitions();
  /* The one canonical Profession projection, shared with the `/skills` reference (#372 §0.6). */
  const professionBrowseModel = useProfessionBrowseModel();
  /*
   * The Profession chooser and the selected-Profession presentation both read the one canonical
   * Profession projection (#372 section 0.6). The card carries only reader-facing content: the
   * approved browsing category, the published short description, and the family name a player may
   * search by. Implementation-derived counts stayed out deliberately — section 1 forbids leading
   * with them, and a card that exposes a field merely because it exists is how a provenance `note`
   * reached this chooser before (#361 QA).
   */
  const professionBrowseById = new Map(
    professionBrowseModel.professions.map((profession) => [profession.id, profession]),
  );
  const availableProfessionCards: ProfessionBrowseCard[] = [...availableProfessions]
    .map((profession) => {
      const professionPackage = resolveEffectiveProfessionPackage({
        content,
        subtypeId: profession.id,
      });
      const browse = professionBrowseById.get(profession.id);
      const readerContent = browse?.readerContent;
      const hasLiteracyFoundation =
        professionPackage.core.finalEffectiveReachableSkillIds.includes("literacy") ||
        professionPackage.favored.finalEffectiveReachableSkillIds.includes("literacy") ||
        [
          ...professionPackage.core.finalEffectiveReachableSkillIds,
          ...professionPackage.favored.finalEffectiveReachableSkillIds,
        ].some((skillId) => {
          const skill = content.skills.find((candidate) => candidate.id === skillId);
          return skill !== undefined && skill.requiresLiteracy !== "no";
        });

      return {
        browse,
        categoryId: browse?.browsingCategory?.id,
        categoryName: browse?.browsingCategory?.name,
        description: readerContent?.shortDescription ?? profession.description,
        familyDescription: professionPackage.family.description,
        familyName: professionPackage.family.name,
        hasLiteracyFoundation,
        id: profession.id,
        name: profession.name,
        profession,
        subtypeName: profession.name,
        /*
         * Intentional inaccessibility, made understandable (#635). Absent whenever the Profession
         * has training this Character can reach, so the card is unchanged for every working
         * combination.
         */
        trainingAccess: buildProfessionTrainingAccess({
          civilizationName: selectedCivilization?.name,
          content,
          professionId: profession.id,
          socialBand: activeSocialBand,
          societyId: activeSocietyId,
        }),
      };
    })
    .sort((left, right) => {
      const categoryComparison = (left.categoryName ?? "").localeCompare(right.categoryName ?? "");

      if (categoryComparison !== 0) {
        return categoryComparison;
      }

      return left.name.localeCompare(right.name);
    });
  /* Decision 0012's approved roster, in its authored order, restricted to what is offered here. */
  const offeredCategoryIds = new Set(
    availableProfessionCards.flatMap((card) => (card.categoryId ? [card.categoryId] : [])),
  );
  const professionCategoryOptions = professionBrowseModel.professionCategories
    .filter((category) => offeredCategoryIds.has(category.id))
    .map((category) => ({
      count: availableProfessionCards.filter((card) => card.categoryId === category.id).length,
      ...category,
    }));
  const visibleProfessionCards = filterProfessionBrowseItems({
    categoryFilter: professionCategoryFilter,
    items: availableProfessionCards,
    search: professionSearch,
  });
  const activeProfessionPreviewId = expandedProfessionId ?? selectedProfessionId;
  const selectedProfessionCard = availableProfessionCards.find(
    (profession) => profession.id === selectedProfessionId,
  );
  const skillAllocationContext =
    selectedProfessionId && activeSocietyId && activeSocialBand !== undefined
      ? {
          content,
          professionId: selectedProfessionId,
          profile: selectedProfile,
          progression,
          societyId: activeSocietyId,
          societyLevel: activeSocialBand,
        }
      : undefined;
  const draftView = buildChargenDraftView({
    civilizationId: selectedCivilizationId,
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    societyId: activeSocietyId,
    societyLevel: activeSocialBand,
  });
  const educationLinkedSkillCount = Math.max(
    0,
    draftView.education.theoreticalSkillCount -
      draftView.education.baseEducation -
      draftView.education.socialClassEducationValue,
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
      parameters: chargenRuleSet,
    },
    socialClass: selectedSocietyAccess?.socialClass,
    societyId: activeSocietyId,
    societyLevel: activeSocialBand,
  });
  const motherTongueSummary = buildChargenMotherTongueSummary({
    civilizationId: selectedCivilizationId,
    content,
    educationLevel: draftView.education.theoreticalSkillCount,
  });
  const languageSelectionSummary = buildChargenLanguageSelectionSummary({
    civilizationId: selectedCivilizationId,
    content,
    progression,
    societyId: activeSocietyId,
  });
  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content,
    professionId: selectedProfessionId,
    progression,
    societyId: activeSocietyId,
    societyLevel: activeSocialBand,
  });
  const coreRouteStatus = buildChargenCoreRouteStatus({
    content,
    professionId: selectedProfessionId,
    progression,
    societyId: activeSocietyId,
    socialBand: activeSocialBand,
  });
  const groupSlotCandidateSkillIds = getGroupSlotCandidateSkillIds(selectableSkillSummary);
  const skillAccess =
    selectedProfessionId && activeSocietyId && activeSocialBand !== undefined
      ? buildChargenSkillAccessSummary({
          content,
          professionId: selectedProfessionId,
          societyId: activeSocietyId,
          societyLevel: activeSocialBand,
        })
      : {
          normalSkillGroupIds: [],
          normalSkillIds: [],
          otherSkillIds: content.skills
            .filter((skill) => !skill.specializationOfSkillId)
            .map((skill) => skill.id),
          skillSources: {},
        };
  const visibleSkillDefinitions = content.skills.filter((skill) =>
    content.chargenCatalogue!.skillIds.includes(skill.id),
  );
  const normalSkillGroups = sortedSkillGroups.filter((group) =>
    skillAccess.normalSkillGroupIds.includes(group.id),
  );
  const concreteLanguageRows: SkillBrowseRow[] = [];
  const languageSkillViews = draftView.skills
    .filter((skill) => skill.skillId === "language")
    .sort(
      (left, right) =>
        Number(right.sourceTag === "mother-tongue") - Number(left.sourceTag === "mother-tongue") ||
        (left.languageName ?? "").localeCompare(right.languageName ?? ""),
    );
  const skillDisplayGroupIds = new Map(
    visibleSkillDefinitions.map((skill) => [
      skill.id,
      getSkillDisplayGroupId({
        content,
        draftView,
        skill,
        skillAccess,
      }),
    ]),
  );
  const additionalAllowedSkills = sortSkills(
    visibleSkillDefinitions.filter(
      (skill) =>
        skill.id !== "language" &&
        skillAccess.normalSkillIds.includes(skill.id) &&
        !groupSlotCandidateSkillIds.has(skill.id) &&
        skillDisplayGroupIds.get(skill.id) === undefined,
    ),
  );
  const otherSkills = sortSkills(
    visibleSkillDefinitions.filter(
      (skill) => skill.id !== "language" && !skill.specializationOfSkillId,
    ),
  );
  const skillRowsById = new Map<string, SkillBrowseRow>(
    sortSkills(visibleSkillDefinitions).map((skill) => {
      const skillView =
        draftView.skills.find(
          (item) => item.skillId === skill.id && item.sourceTag === "mother-tongue",
        ) ??
        draftView.skills.find((item) => item.skillId === skill.id && item.languageName) ??
        draftView.skills.find((item) => item.skillId === skill.id);
      const metrics = getSkillAllocationMetrics({
        content,
        draftView,
        profile: selectedProfile,
        skill,
      });
      const evaluation = evaluateSkillSelection({
        content,
        progression,
        target: {
          skill,
          targetType: "skill",
        },
      });

      return [
        skill.id,
        {
          grantedSourceLabel: formatDerivedSkillSourceLabel({
            sourceSkillName: skillView?.relationshipSourceSkillName,
            sourceType: skillView?.relationshipSourceType,
          }),
          displayName: getSkillDisplayName({
            languageName: skillView?.languageName,
            skill,
          }),
          evaluation,
          isNormalAccess: skillAccess.normalSkillIds.includes(skill.id),
          metrics,
          rowKey: skill.id,
          skill,
          sourceLabels: getSkillAccessSourceLabels(skillAccess.skillSources[skill.id]),
          sourceTag: skillView?.sourceTag,
        },
      ];
    }),
  );
  const additionalAllowedSkillRows = additionalAllowedSkills
    .map((skill) => skillRowsById.get(skill.id))
    .filter((row): row is SkillBrowseRow => row !== undefined);
  const societyGrantedSkillRows = mergeSkillBrowseRowsBySkillId(
    additionalAllowedSkillRows.filter(
      (row) =>
        skillAccess.skillSources[row.skill.id]?.includes("society-foundational-skill") ?? false,
    ),
  );
  const professionDirectSkillRows = mergeSkillBrowseRowsBySkillId(
    additionalAllowedSkillRows.filter(
      (row) =>
        !(skillAccess.skillSources[row.skill.id]?.includes("society-foundational-skill") ?? false),
    ),
  );
  const visibleOtherSkillRows = [
    ...otherSkills
      .map((skill) => skillRowsById.get(skill.id))
      .filter((row): row is SkillBrowseRow => row !== undefined),
    ...concreteLanguageRows,
  ].filter((row) =>
    matchesSkillBrowseFilters({
      isAllowed: row.evaluation.isAllowed,
      isOwned: row.metrics.totalXp > 0,
      name: row.displayName,
      search: skillSearch,
      skillType: getPlayerFacingSkillBucket(row.skill),
      skillTypeFilter,
      visibilityFilter: skillVisibilityFilter,
    }),
  );
  const otherSkillFilterActive =
    skillSearch.trim().length > 0 || skillVisibilityFilter !== "all" || skillTypeFilter !== "all";
  const otherSkillTypeOptions = playerFacingSkillBucketDefinitions.filter(
    (definition) =>
      definition.id !== "special-access" &&
      [...otherSkills, ...concreteLanguageRows.map((row) => row.skill)].some(
        (skill) => getPlayerFacingSkillBucket(skill) === definition.id,
      ),
  );
  const normalAccessSections = playerFacingSkillBucketDefinitions
    .map((definition) => ({
      definition,
      directRows: mergeSkillBrowseRowsBySkillId(
        professionDirectSkillRows.filter(
          (row) =>
            getPlayerFacingSkillBucket(row.skill, {
              preferDirectProfession:
                skillAccess.skillSources[row.skill.id]?.includes("profession-skill") ?? false,
            }) === definition.id,
        ),
      ),
      groups: normalSkillGroups.filter(
        (group) =>
          getPlayerFacingSkillBucket(
            {
              id: group.id,
              groupId: group.id,
              groupIds: [group.id],
            },
            {
              preferDirectProfession: false,
            },
          ) === definition.id,
      ),
    }))
    .filter((section) => section.directRows.length > 0 || section.groups.length > 0);
  const coreProfessionSections = normalAccessSections.filter(
    (section) => section.definition.id !== "special-access" || section.groups.length > 0,
  );
  const specialAccessSection =
    normalAccessSections.find(
      (section) => section.definition.id === "special-access" && section.groups.length === 0,
    ) ?? null;
  const defaultExpandedAllocationSections = useMemo(
    () => [
      ...(coreProfessionSections.length > 0 ? ["core-profession-skills"] : []),
      ...(specialAccessSection ? ["special-access"] : []),
    ],
    [coreProfessionSections.length, Boolean(specialAccessSection)],
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
              skillId: skill.id,
            }),
            skillName: getSkillDisplayName({
              languageName: skillView.languageName,
              skill,
            }),
            skillXp: skillView.specificSkillLevel,
            stats: formatSkillStats(skill),
            totalSkillLevel: skillView.totalSkill,
            totalXp: skillView.effectiveSkillNumber,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    });
  const groupedPlayerSkillTableRows = groupRowsBySkillType(playerSkillTableRows);
  const specializationRows = content.specializations
    .filter(({ id }) => content.chargenCatalogue!.specializationIds.includes(id))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((specialization) => {
      const parentSkill = content.skills.find((skill) => skill.id === specialization.skillId);
      const parentSpecialization = content.specializations.find(
        ({ id }) => id === specialization.skillId,
      );
      const parentMetrics = parentSkill
        ? getSkillAllocationMetrics({
            content,
            draftView,
            profile: selectedProfile,
            skill: parentSkill,
          })
        : undefined;
      const specializationView = draftView.specializations.find(
        (item) => item.specializationId === specialization.id,
      );
      const evaluation = evaluateSkillSelection({
        content,
        progression,
        target: {
          specialization,
          targetType: "specialization",
        },
      });

      return {
        grantedSourceLabel: specializationView
          ? formatDerivedSkillSourceLabel({
              sourceSkillName: specializationView.relationshipGrantedSourceSkillName,
              sourceType: specializationView.relationshipGrantedSourceType,
            })
          : undefined,
        grantedSpecializationLevel: specializationView?.relationshipGrantedSpecializationLevel ?? 0,
        evaluation,
        parentSkillLevel: parentSpecialization
          ? (progression.specializations.find(
              ({ specializationId }) => specializationId === parentSpecialization.id,
            )?.secondaryRanks ?? 0)
          : (parentMetrics?.groupXp ?? 0) + (parentMetrics?.skillXp ?? 0),
        parentSkillName: parentSkill?.name ?? parentSpecialization?.name ?? specialization.skillId,
        secondaryRanks: specializationView?.secondaryRanks ?? 0,
        specialization,
        specializationName: specialization.name,
        specializationLevel: specializationView?.specializationLevel ?? 0,
      };
    });
  const visibleSpecializationRows = filterSpecializationBrowseItems({
    includeBlocked: showAllSpecializations,
    items: specializationRows,
    search: specializationSearch,
  });
  const specializationFilterActive =
    specializationSearch.trim().length > 0 || showAllSpecializations;

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [cachedContent, sessionUser, activeRuleSet] = await Promise.all([
        contentCacheRepository.get(CONTENT_CACHE_KEY),
        getCurrentSessionUser().catch(() => null),
        loadActiveChargenRuleSet().catch(() => DEFAULT_CHARGEN_RULE_SET),
      ]);

      const savedDraft = sessionUser
        ? await chargenSessionRepository.getForOwner(sessionUser.id)
        : undefined;

      if (cancelled) {
        return;
      }

      /**
       * The persisted snapshot is validated with the existing activation-blocker mechanism before
       * it is used to construct runtime content. A snapshot that cannot be used is retained as
       * diagnostic evidence, evicted, and replaced by reacquired authoritative content below.
       */
      const cachedEvaluation = evaluateCachedChargenContent(cachedContent);
      const evictedStaleCache = cachedEvaluation?.status === "unusable";

      if (cachedEvaluation?.status === "unusable" && cachedContent) {
        await preserveAndEvictRejectedSnapshot(cachedContent, cachedEvaluation.diagnostics);
      }

      const startingContent =
        cachedEvaluation?.status === "usable" ? cachedEvaluation.content : defaultCanonicalContent;

      if (cachedEvaluation?.status === "usable") {
        setContentSource(cachedEvaluation.source);
      }

      setCurrentUser(sessionUser);
      setChargenRuleSet(activeRuleSet);
      setProgression((current) => ({
        ...current,
        flexiblePointFactor: activeRuleSet.flexiblePointFactor,
        primaryPoolTotal: activeRuleSet.ordinarySkillPoints,
      }));

      const startingEvaluation = evaluateChargenContent(startingContent);
      const activeCatalogue =
        startingEvaluation.status === "usable"
          ? withCompetencyContentV2(buildTargetRuntimeContent(startingEvaluation.source))
              .chargenCatalogue
          : undefined;
      const isHistoricalDraft =
        savedDraft &&
        ((savedDraft.selectedProfessionId &&
          !activeCatalogue?.professionIds?.includes(savedDraft.selectedProfessionId)) ||
          savedDraft.progression.skillGroups.some(
            (g) => !activeCatalogue?.groupIds?.includes(g.groupId),
          ));
      if (isHistoricalDraft) {
        setHistoricalDraft(savedDraft);
      } else if (savedDraft) {
        setResumableDraft(savedDraft);
      }
      setHydrated(true);

      try {
        const freshContent = await loadCanonicalContentFromServer();

        if (cancelled) {
          return;
        }

        const normalizedContent = validateCanonicalContent(freshContent);
        const freshEvaluation = evaluateChargenContent(normalizedContent);

        if (freshEvaluation.status === "unusable") {
          // The current authoritative content itself cannot be activated. Chargen reports that
          // rather than keeping itself operational on an older or bundled catalogue.
          console.warn(
            formatChargenContentDiagnostics(
              freshEvaluation.diagnostics,
              "current authoritative content",
            ),
          );
          setContentUnavailable(true);
          return;
        }

        setContentSource(freshEvaluation.source);
        setContentUnavailable(false);
        await contentCacheRepository.save(CONTENT_CACHE_KEY, freshEvaluation.content, "v1");
      } catch {
        if (evictedStaleCache) {
          // The persisted snapshot was unusable and authoritative content could not be reacquired,
          // so there is no content this profile can be trusted to build a Character from.
          setContentUnavailable(true);
          return;
        }

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
          ruleSet: chargenRuleSet,
        }),
      );
    }
  }, [
    availableProfessions,
    chargenRuleSet,
    content,
    hydrated,
    selectedProfessionId,
    selectedSocietyAccess,
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
        [selectedRolledProfile.id]: createChargenStatAdjustmentState(
          selectedRolledProfile.rolledStats,
        ),
      };
    });
  }, [selectedRolledProfile]);

  useEffect(() => {
    if (!hydrated || !hasStartedChargen || !currentUser || historicalDraft) {
      return;
    }

    draftPersistence.enqueue(() =>
      chargenSessionRepository.save({
        ownerId: currentUser.id,
        characterName,
        rolledProfiles,
        profileAdjustments,
        selectedCivilizationId,
        progression,
        selectedProfessionId,
        selectedProfile,
        selectedSocialClass: selectedSocietyAccess?.socialClass,
        selectedSocietyId: activeSocietyId,
        selectedSocietyLevel: activeSocialBand,
      }),
    );
  }, [
    draftPersistence,
    historicalDraft,
    rolledProfiles,
    profileAdjustments,
    characterName,
    selectedCivilizationId,
    hasStartedChargen,
    hydrated,
    currentUser,
    progression,
    selectedProfessionId,
    selectedProfile,
    activeSocialBand,
    selectedSocietyAccess,
    activeSocietyId,
  ]);

  function handleCivilizationChange(civilizationId: string) {
    const nextCivilization = civilizations.find(
      (civilization) => civilization.id === civilizationId,
    );
    const nextSocietyId = nextCivilization?.linkedSocietyId;
    const societyChanged = nextSocietyId !== selectedSocietyId;

    setSelectedCivilizationId(civilizationId);
    setShowCivilizationChooser(false);

    if (!societyChanged) {
      setFeedback(["Civilization updated. Society and profession access remain unchanged."]);
      return;
    }

    setSelectedProfessionId(undefined);
    /* The society changed, so the Profession selection is cleared. Step 5 is then a first arrival
       with no selection and shows its collapsed section rather than all 86 options (#577). */
    setShowProfessionChooser(false);
    setProgression(createChargenProgression("standard", chargenRuleSet));
    setRowActionFeedback({});
    setGroupTrainingCostChange(undefined);
    setExpandedSkillDetails([]);
    setFeedback([
      "Changing civilization changed the inferred society, so profession access and point allocation were reset.",
    ]);
  }

  function handleProfessionChange(professionId: string) {
    setSelectedProfessionId(professionId);
    setShowProfessionChooser(false);
    setExpandedProfessionId(professionId);
    setProgression(
      applyProfessionGrants({
        content,
        professionId,
        ruleSet: chargenRuleSet,
      }),
    );
    setRowActionFeedback({});
    setGroupTrainingCostChange(undefined);
    setExpandedSkillDetails([]);
    setFeedback(["Profession access loaded. Skill allocation, education, and review are ready."]);
  }

  function handleSelectGroupSlotSkill(groupId: string, slotId: string, skillId: string) {
    setProgression((current) => {
      const selectableSummary = buildChargenSelectableSkillSummary({
        content,
        professionId: selectedProfessionId,
        progression: current,
        societyId: activeSocietyId,
        societyLevel: activeSocialBand,
      });
      const slot = selectableSummary.selectionSlots.find(
        (candidate) => candidate.groupId === groupId && candidate.slotId === slotId,
      );

      if (!slot || !slot.candidateSkillIds.includes(skillId)) {
        return current;
      }

      const existingSelections = current.chargenSelections?.selectedGroupSlots ?? [];
      const nextSelections = existingSelections.filter(
        (selection) => !(selection.groupId === groupId && selection.slotId === slotId),
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
        slotId,
      });

      return {
        ...current,
        chargenSelections: {
          selectedCoreRouteId: current.chargenSelections?.selectedCoreRouteId,
          selectedLanguageIds: current.chargenSelections?.selectedLanguageIds ?? [],
          selectedGroupSlots: nextSelections,
          selectedSkillIds: current.chargenSelections?.selectedSkillIds ?? [],
        },
      };
    });
  }

  function handleSelectCoreRoute(routeId: string) {
    if (
      !coreRouteStatus.requiresSelection ||
      !coreRouteStatus.applicableRoutes.some((route) => route.id === routeId)
    ) {
      return;
    }

    setProgression((current) => ({
      ...current,
      chargenSelections: {
        selectedCoreRouteId: routeId,
        selectedGroupSlots: current.chargenSelections?.selectedGroupSlots ?? [],
        selectedLanguageIds: current.chargenSelections?.selectedLanguageIds ?? [],
        selectedSkillIds: current.chargenSelections?.selectedSkillIds ?? [],
      },
    }));
    setFeedback(["Profession core route selected. Its requirements now govern completion."]);
  }

  function handleToggleLanguageSelection(languageId: string) {
    setProgression((current) => {
      const currentLanguageSummary = buildChargenLanguageSelectionSummary({
        civilizationId: selectedCivilizationId,
        content,
        progression: current,
        societyId: activeSocietyId,
      });

      if (!currentLanguageSummary.selectableLanguageIds.includes(languageId)) {
        return current;
      }

      const language = currentLanguageSummary.selectableLanguages.find(
        (candidate) => candidate.id === languageId,
      );

      if (!language) {
        return current;
      }

      const languageSkillKey = getCharacterSkillKey({
        languageName: language.name,
        skillId: "language",
      });
      const existingSkill = current.skills.find(
        (skill) => getCharacterSkillKey(skill) === languageSkillKey,
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
          selectedCoreRouteId: current.chargenSelections?.selectedCoreRouteId,
          selectedLanguageIds: [...currentSelections],
          selectedGroupSlots: current.chargenSelections?.selectedGroupSlots ?? [],
          selectedSkillIds: current.chargenSelections?.selectedSkillIds ?? [],
        },
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
        : [...current, skillId],
    );
  }

  function toggleAllocationSection(sectionId: string) {
    setExpandedAllocationSections((current) =>
      current.includes(sectionId)
        ? current.filter((candidate) => candidate !== sectionId)
        : [...current, sectionId],
    );
  }

  function handleProfileSelect(profileId: string) {
    setSelectedProfileId(profileId);
    setShowRolledProfileOptions(false);
    setRowActionFeedback({});
    setGroupTrainingCostChange(undefined);
  }

  function handleResetStatAdjustments() {
    if (!selectedRolledProfile) {
      return;
    }

    setProfileAdjustments((current) => ({
      ...current,
      [selectedRolledProfile.id]: createChargenStatAdjustmentState(
        selectedRolledProfile.rolledStats,
      ),
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
      state: selectedAdjustment,
    });

    if (result.error) {
      setFeedback([result.error]);
      return;
    }

    setProfileAdjustments((current) => ({
      ...current,
      [selectedRolledProfile.id]: result.state,
    }));
    setFeedback([
      `${glantriCharacteristicLabels[exchangeFirstStat]} and ${glantriCharacteristicLabels[exchangeSecondStat]} were exchanged.`,
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
      state: selectedAdjustment,
    });

    if (result.error) {
      setFeedback([result.error]);
      return;
    }

    setProfileAdjustments((current) => ({
      ...current,
      [selectedRolledProfile.id]: result.state,
    }));
    setFeedback([
      `${glantriCharacteristicLabels[buildIncreaseStat]} increased by 1 and ${glantriCharacteristicLabels[buildDecreaseStat]} decreased by 2.`,
    ]);
  }

  async function handleStartChargen() {
    if (!currentUser) {
      setFeedback(["Sign in before starting a Character."]);
      return;
    }

    await draftPersistence.suspendAndDrain();

    try {
      await chargenSessionRepository.deleteForOwner(currentUser.id);
    } finally {
      draftPersistence.resume();
    }

    setHistoricalDraft(undefined);
    setResumableDraft(undefined);
    setHasStartedChargen(true);
    setRolledProfiles(generateProfiles({ ruleSet: chargenRuleSet }));
    setProfileAdjustments({});
    setCharacterName("");
    setFeedback([]);
    setProgression(createChargenProgression("standard", chargenRuleSet));
    setRowActionFeedback({});
    setGroupTrainingCostChange(undefined);
    setSelectedProfileId(undefined);
    setSelectedProfessionId(undefined);
    setSelectedCivilizationId(undefined);
    /* #597: rolling the dice is the action whose result the Stats section holds, so that one
       section opens on the rolled values rather than reporting them behind another control.
       The Civilization and Profession choosers stay collapsed on arrival per #577/#587 — they
       hold choices the roll did not make, and the Profession list is 86 options. */
    setShowRolledProfileOptions(true);
    setShowCivilizationChooser(false);
    setShowProfessionChooser(false);
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

  function handleResumeChargen() {
    if (!resumableDraft) {
      return;
    }

    draftPersistence.resume();
    setCharacterName(resumableDraft.characterName ?? "");
    setSelectedCivilizationId(resumableDraft.selectedCivilizationId);
    setRolledProfiles(
      resumableDraft.rolledProfiles ??
        (resumableDraft.selectedProfile ? [resumableDraft.selectedProfile] : []),
    );
    setProfileAdjustments(resumableDraft.profileAdjustments ?? {});
    setSelectedProfileId(resumableDraft.selectedProfile?.id);
    setSelectedProfessionId(resumableDraft.selectedProfessionId);
    setProgression(resumableDraft.progression);
    setResumableDraft(undefined);
    setHasStartedChargen(true);
  }

  /**
   * Record a Learning Group training change whose cost moved the opposite way to the
   * training itself, so the interface can show the before/after build cost and explain it.
   * The classification comes from the rules layer; nothing here re-derives the rule.
   */
  function recordGroupTrainingCostChange(
    previousProgression: CharacterProgression,
    nextProgression: CharacterProgression,
  ) {
    const change = describeChargenGroupTrainingChange({
      content,
      previousProgression,
      progression: nextProgression,
    });

    setGroupTrainingCostChange(
      change.shift === "ordinary"
        ? undefined
        : {
            previousTotal: previousProgression.primaryPoolSpent,
            shift: change.shift,
            total: nextProgression.primaryPoolSpent,
          },
    );
  }

  function handleAllocate(
    targetId: string,
    targetType: "group" | "skill",
    targetLanguageName?: string,
  ) {
    if (!skillAllocationContext) {
      return;
    }

    setGroupTrainingCostChange(undefined);

    const result = allocateChargenPoint({
      ...skillAllocationContext,
      targetLanguageName,
      targetId,
      targetType,
    });
    const feedbackTargetId =
      targetType === "skill"
        ? getCharacterSkillKey({
            languageName: targetLanguageName,
            skillId: targetId,
          })
        : targetId;

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      if (targetType === "skill") {
        setRowActionFeedback((current) => ({
          ...current,
          [getRowActionFeedbackKey(feedbackTargetId, targetType)]: message,
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

    if (targetType === "group") {
      recordGroupTrainingCostChange(progression, result.progression);
      setFeedback([
        (result.spentCost ?? 0) > 0
          ? `Training added for ${result.spentCost} ordinary ${
              result.spentCost === 1 ? "point" : "points"
            }.`
          : "Training added at no extra cost.",
        ...result.warnings,
      ]);
      return;
    }

    setFeedback([`Allocated ${result.spentCost ?? 0} point to the skill.`, ...result.warnings]);
  }

  function handleRemoveAllocation(
    targetId: string,
    targetType: "group" | "skill",
    targetLanguageName?: string,
  ) {
    if (!skillAllocationContext) {
      return;
    }

    setGroupTrainingCostChange(undefined);

    const result = removeChargenPoint({
      ...skillAllocationContext,
      targetLanguageName,
      targetId,
      targetType,
    });
    const feedbackTargetId =
      targetType === "skill"
        ? getCharacterSkillKey({
            languageName: targetLanguageName,
            skillId: targetId,
          })
        : targetId;

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      if (targetType === "skill") {
        setRowActionFeedback((current) => ({
          ...current,
          [getRowActionFeedbackKey(feedbackTargetId, targetType)]: message,
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

    if (targetType === "group") {
      recordGroupTrainingCostChange(progression, result.progression);
      setFeedback(["Training removed.", ...result.warnings]);
      return;
    }

    setFeedback([`Removed ${result.spentCost ?? 0} point from the skill.`, ...result.warnings]);
  }

  function handleAllocateSpecialization(specializationId: string) {
    if (!skillAllocationContext) {
      return;
    }

    const result = spendSecondaryPoint({
      ...skillAllocationContext,
      targetId: specializationId,
      targetType: "specialization",
    });

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      setRowActionFeedback((current) => ({
        ...current,
        [getRowActionFeedbackKey(specializationId, "specialization")]: message,
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
      ...result.warnings,
    ]);
  }

  function handleRemoveSpecialization(specializationId: string) {
    if (!skillAllocationContext) {
      return;
    }

    const result = removeSecondaryPoint({
      ...skillAllocationContext,
      targetId: specializationId,
      targetType: "specialization",
    });

    if (result.error) {
      const message = formatActionError(result.error) ?? result.error;

      setRowActionFeedback((current) => ({
        ...current,
        [getRowActionFeedbackKey(specializationId, "specialization")]: message,
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
      ...result.warnings,
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
          overflowX: "auto",
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
              "minmax(180px, 2fr) repeat(5, minmax(72px, 84px)) minmax(150px, 1fr)",
            padding: "0.75rem 1rem",
          }}
        >
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
              skill: row.skill,
            });
            const skillType = getPlayerFacingSkillBucket(row.skill);
            const skillTypeLabel =
              playerFacingSkillBucketDefinitions.find((definition) => definition.id === skillType)
                ?.label ?? skillType;
            const isDetailOpen = expandedSkillDetails.includes(row.rowKey);
            /*
             * Forgejo #372 section 7. Training the player already holds that teaches this Skill but
             * supplied none of its level. The judgement is made in the rules view layer and only
             * read here; the interface does not reconstruct it.
             */
            const coveredGroupMemberships =
              draftView.skills.find(
                (candidate) =>
                  candidate.skillId === row.skill.id &&
                  candidate.languageName === row.targetLanguageName,
              )?.coveredGroupMemberships ?? [];
            const nextCost = getOrdinarySkillNextCost({
              isNormalAccess: row.isNormalAccess,
              progression,
              skill: row.skill,
            });
            const dependencySummaries = row.skill.dependencies.map((dependency) => {
              const dependencyRow = skillRowsById.get(dependency.skillId);
              const dependencySkill = content.skills.find(
                (skill) => skill.id === dependency.skillId,
              );

              return {
                dependency,
                dependencyName: dependencySkill?.name ?? dependency.skillId,
                dependencyRow,
              };
            });

            return (
              <div
                key={row.rowKey}
                style={{
                  borderTop: "1px solid #f0eadf",
                  display: "grid",
                  gap: "0.35rem",
                  padding: "0.75rem 1rem",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) repeat(5, minmax(72px, 84px)) minmax(150px, 1fr)",
                  }}
                >
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <span>{row.displayName}</span>
                      <span style={getSkillTierTone(row.skill)}>
                        {getSkillTierLabel(row.skill)}
                      </span>
                      {row.sourceTag === "mother-tongue" ? (
                        <span style={getBadgeStyle({ muted: true })}>Mother tongue</span>
                      ) : null}
                      {row.skill.id === "literacy" &&
                      selectedProfessionCard?.hasLiteracyFoundation ? (
                        <span style={getBadgeStyle()}>Foundation skill</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {input.showTypeBadge ? (
                        <span
                          key={`${row.rowKey}-${skillType}`}
                          style={getBadgeStyle({ muted: true })}
                        >
                          {skillTypeLabel}
                        </span>
                      ) : null}
                      {input.showOutsideNormalAccessBadge && !row.isNormalAccess ? (
                        <span style={getBadgeStyle({ muted: true })}>Outside normal access</span>
                      ) : null}
                      <button onClick={() => toggleSkillDetails(row.rowKey)} type="button">
                        {isDetailOpen ? "Hide details" : "Details"}
                      </button>
                    </div>
                    <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                      Next cost {nextCost} {row.isNormalAccess ? "ordinary/flexible" : "flexible"}{" "}
                      points
                    </div>
                  </div>
                  <div>{row.metrics.groupXp}</div>
                  <div>{row.metrics.ordinaryXp}</div>
                  <div>{row.metrics.flexibleXp}</div>
                  <div>{row.metrics.grantedXp}</div>
                  <div>{row.metrics.totalXp}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <button
                      aria-label={`Add ${row.skill.name}`}
                      disabled={!skillAllocationContext || !row.evaluation.isAllowed}
                      onClick={() => handleAllocate(row.skill.id, "skill", row.targetLanguageName)}
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
                    style={{
                      color: getRuleStatusColor(status.tone),
                      fontSize: "0.85rem",
                    }}
                  >
                    {status.message}
                  </div>
                ))}
                {coveredGroupMemberships.length > 0 ? (
                  <div role="status" style={{ color: "#6d665a", fontSize: "0.85rem" }}>
                    Also taught by{" "}
                    {coveredGroupMemberships.map((membership) => membership.name).join(", ")}. That
                    training adds nothing further to this skill, because{" "}
                    {coveredGroupMemberships[0]?.coveredByGroupName} already covers it.
                  </div>
                ) : null}
                {isDetailOpen ? (
                  <div
                    style={{
                      background: "#f6f5ef",
                      border: "1px solid #e7e2d7",
                      borderRadius: 8,
                      display: "grid",
                      gap: "0.5rem",
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ color: "#4a4f45", fontSize: "0.9rem" }}>
                      {row.skill.shortDescription ??
                        row.skill.description ??
                        "No short description yet."}
                    </div>
                    {row.skill.description &&
                    row.skill.description !== row.skill.shortDescription ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        {row.skill.description}
                      </div>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <span style={getBadgeStyle({ muted: true })}>
                        Owned XP {row.metrics.skillXp}
                      </span>
                      <span style={getBadgeStyle({ muted: true })}>
                        Group-derived value {row.metrics.groupXp}
                      </span>
                      <span style={getBadgeStyle({ muted: true })}>
                        Derived/cross-training XP {row.metrics.grantedXp}
                      </span>
                      <span style={getBadgeStyle({ muted: true })}>
                        Effective total {row.metrics.totalXp}
                      </span>
                    </div>
                    {row.grantedSourceLabel ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        {row.grantedSourceLabel}
                      </div>
                    ) : null}
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
                        {dependencySummaries.map(
                          ({ dependency, dependencyName, dependencyRow }) => (
                            <div
                              key={`${row.rowKey}-${dependency.skillId}`}
                              style={{ fontSize: "0.82rem" }}
                            >
                              {`${dependency.strength}. ${formatDependencyOwnershipSummary({
                                dependencyName,
                                directSkillLevel: dependencyRow?.metrics.skillXp ?? 0,
                                effectiveSkillLevel: dependencyRow?.metrics.totalXp ?? 0,
                              })}`}
                            </div>
                          ),
                        )}
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
    if (!activeSocietyId || activeSocialBand === undefined) {
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
        parameters: chargenRuleSet,
      },
      socialClass: selectedSocietyAccess?.socialClass,
      societyId: activeSocietyId,
      societyLevel: activeSocialBand,
    });

    if (!result.build) {
      setFeedback([...result.errors, ...result.warnings]);
      return;
    }

    const finalizedBuild = result.build;

    if (!currentUser) {
      setFeedback([
        "Sign in before finalizing. A Character is complete only after the server confirms its canonical record.",
      ]);
      return;
    }

    setIsFinalizing(true);
    let finalizedDraftDeleted = false;

    try {
      const finalizedRecord = await persistAuthenticatedFinalizedCharacter(
        { build: finalizedBuild, currentUser },
        {
          saveCharacterToServer,
          saveLocalCharacter: (input) => localCharacterRepository.save(input),
        },
      );

      await draftPersistence.suspendAndDrain();
      await chargenSessionRepository.deleteForOwner(currentUser.id);
      finalizedDraftDeleted = true;
      router.push(`/characters/${finalizedRecord.id}`);
    } catch (error) {
      if (!finalizedDraftDeleted) {
        draftPersistence.resume();
      }

      const message =
        error instanceof Error ? error.message : "Unable to finalize and save the character.";
      setFeedback([message]);
    } finally {
      setIsFinalizing(false);
    }
  }

  return {
    contentUnavailable: chargenContentUnavailable,
    historicalDraft,
    resumableDraft,
    activeProfessionPreviewId,
    availableProfessions,
    availableProfessionCards,
    buildDecreaseStat,
    buildDisabled,
    buildIncreaseStat,
    characterName,
    chargenRuleSet,
    chargenPolicy,
    civilizations,
    content,
    coreRouteStatus,
    coreProfessionSections,
    specialAccessSection,
    currentUser,
    draftView,
    educationLinkedSkillCount,
    expandedAllocationSections,
    exchangeDisabled,
    exchangeFirstStat,
    exchangeSecondStat,
    feedback,
    groupedPlayerSkillTableRows,
    groupSlotCandidateSkillIds,
    hasStartedChargen,
    hydrated,
    isFinalizing,
    languageSelectionSummary,
    languageSkillViews,
    motherTongueSummary,
    normalSkillGroups,
    otherSkillFilterActive,
    otherSkillTypeOptions,
    playerFacingSkillBucketDefinitions,
    professionBrowseModel,
    professionCategoryFilter,
    professionCategoryOptions,
    professionSearch,
    progression,
    renderSkillRowsTable,
    review,
    groupTrainingCostChange,
    rowActionFeedback,
    selectableSkillSummary,
    selectedAdjustment,
    selectedCivilization,
    selectedCivilizationId,
    selectedProfession,
    selectedProfessionCard,
    selectedProfessionId,
    selectedProfile,
    selectedProfileId,
    selectedRolledProfile,
    selectedRolledProfileSummary,
    selectedResolvedStats,
    selectedSocialBand,
    selectedSociety,
    selectedSocietyAccess,
    selectedSocietyBand,
    selectedSocietyId,
    showAllSpecializations,
    showCivilizationChooser,
    showOtherSkills,
    showProfessionChooser,
    showRolledProfileOptions,
    showSpecializations,
    skillAccess,
    skillAllocationContext,
    skillDisplayGroupIds,
    skillRowsById,
    skillSearch,
    skillTypeFilter,
    skillVisibilityFilter,
    societies,
    societyGrantedSkillRows,
    sortedRolledProfiles,
    sortedSkillGroups,
    specializationFilterActive,
    specializationRows,
    specializationSearch,
    visibleOtherSkillRows,
    visibleProfessionCards,
    visibleSpecializationRows,
    handleAllocate,
    handleAllocateSpecialization,
    handleBuildStats,
    handleCivilizationChange,
    handleExchangeStats,
    handleFinalize,
    handleProfessionChange,
    handleProfileSelect,
    handleRemoveAllocation,
    handleRemoveSpecialization,
    handleResumeChargen,
    handleResetStatAdjustments,
    handleSelectGroupSlotSkill,
    handleSelectCoreRoute,
    handleStartChargen,
    handleToggleLanguageSelection,
    setBuildDecreaseStat,
    setBuildIncreaseStat,
    setCharacterName,
    setExchangeFirstStat,
    setExchangeSecondStat,
    setProfessionCategoryFilter,
    setProfessionSearch,
    setShowAllSpecializations,
    setShowCivilizationChooser,
    setShowOtherSkills,
    setShowProfessionChooser,
    setShowRolledProfileOptions,
    setShowSpecializations,
    setSkillSearch,
    setSkillTypeFilter,
    setSkillVisibilityFilter,
    setSpecializationSearch,
    skillAllocationContextRef: skillAllocationContext,
    toggleAllocationSection,
    toggleProfessionPreview,
    toggleSkillDetails,
  };
}
