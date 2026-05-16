"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  RolledCharacterProfile
} from "@glantri/domain";
import {
  DEFAULT_CHARGEN_RULE_SET,
  getCharacterSkillKey,
  glantriCharacteristicLabels
} from "@glantri/domain";
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
  removeChargenPoint,
  removeSecondaryPoint,
  resolveEffectiveProfessionPackage,
  reviewChargenDraft,
  selectProfile,
  spendSecondaryPoint,
  summarizeRolledProfile,
  getResolvedProfileStats,
  type ChargenStatAdjustmentState
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
  type SkillVisibilityFilter
} from "@/lib/chargen/chargenBrowse";
import {
  getCurrentSessionUser,
  loadActiveChargenRuleSet,
  saveCharacterToServer
} from "@/lib/api/localServiceClient";
import { loadCanonicalContentFromServer } from "@/lib/api/contentClient";
import { ChargenSessionRepository } from "@/lib/offline/repositories/chargenSessionRepository";
import { ContentCacheRepository } from "@/lib/offline/repositories/contentCacheRepository";
import { LocalCharacterRepository } from "@/lib/offline/repositories/localCharacterRepository";
import { formatDerivedSkillSourceLabel } from "@/lib/characters/derivedSkillLabels";
import {
  getAllowedProfessions,
  buildSocietyOptions,
  buildCivilizationOptions,
  buildConcreteLanguageBrowseRows,
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
  type SkillBrowseRow
} from "./chargenWizardHelpers";

const SESSION_ID = "chargen-vertical-slice";
const CONTENT_CACHE_KEY = "canonical-content";

const chargenSessionRepository = new ChargenSessionRepository();
const contentCacheRepository = new ContentCacheRepository();
const localCharacterRepository = new LocalCharacterRepository();

export function useChargenWizardState() {
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
        .filter((skill): skill is NonNullable<typeof skill> => skill !== undefined);
      const favoredReachableSkills = professionPackage.favored.finalEffectiveReachableSkillIds
        .map((skillId) => content.skills.find((skill) => skill.id === skillId))
        .filter((skill): skill is NonNullable<typeof skill> => skill !== undefined);
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
        summary: professionPackage.summary,
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
  const normalAccessSections = playerFacingSkillBucketDefinitions
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
        const freshContent = await loadCanonicalContentFromServer();

        if (cancelled) {
          return;
        }

        const normalizedContent = validateCanonicalContent(freshContent);

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
              "minmax(180px, 2fr) repeat(5, minmax(72px, 84px)) minmax(150px, 1fr)",
            padding: "0.75rem 1rem"
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
              <div
                key={row.rowKey}
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
                      "minmax(180px, 2fr) repeat(5, minmax(72px, 84px)) minmax(150px, 1fr)"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <span>{row.displayName}</span>
                      <span style={getSkillTierTone(row.skill)}>{getSkillTierLabel(row.skill)}</span>
                      {row.sourceTag === "mother-tongue" ? (
                        <span style={getBadgeStyle({ muted: true })}>Mother tongue</span>
                      ) : null}
                      {row.skill.id === "literacy" && selectedProfessionCard?.hasLiteracyFoundation ? (
                        <span style={getBadgeStyle()}>Foundation skill</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {input.showTypeBadge ? (
                        <span key={`${row.rowKey}-${skillType}`} style={getBadgeStyle({ muted: true })}>
                          {skillTypeLabel}
                        </span>
                      ) : null}
                      {input.showOutsideNormalAccessBadge ? (
                        <span style={getBadgeStyle({ muted: true })}>Outside normal access</span>
                      ) : null}
                      <button onClick={() => toggleSkillDetails(row.rowKey)} type="button">
                        {isDetailOpen ? "Hide details" : "Details"}
                      </button>
                    </div>
                    <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                      Next cost {nextCost} {row.isNormalAccess ? "ordinary/flexible" : "flexible"} points
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
                        {dependencySummaries.map(({ dependency, dependencyName, dependencyRow }) => (
                          <div key={`${row.rowKey}-${dependency.skillId}`} style={{ fontSize: "0.82rem" }}>
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

  return {
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
    isFinalizing,
    languageSelectionSummary,
    languageSkillViews,
    motherTongueSummary,
    normalSkillGroups,
    otherSkillFilterActive,
    otherSkillTypeOptions,
    playerFacingSkillBucketDefinitions,
    professionFamilyFilter,
    professionFamilyOptions,
    professionSearch,
    progression,
    renderSkillRowsTable,
    review,
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
    handleResetStatAdjustments,
    handleSelectGroupSlotSkill,
    handleStartChargen,
    handleToggleLanguageSelection,
    setBuildDecreaseStat,
    setBuildIncreaseStat,
    setCharacterName,
    setExchangeFirstStat,
    setExchangeSecondStat,
    setProfessionFamilyFilter,
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
    toggleSkillDetails
  };
}

