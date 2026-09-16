import { validateTargetChargenBuild } from "../validateTargetChargenBuild";
import type { CharacterBuild, ChargenRuleSetParameters } from "@glantri/domain";

import { applyRelationshipMinimumGrants } from "../../skills/deriveSkillRelationships";
import { createChargenMethodPolicy } from "../policy";
import {
  buildChargenLanguageSelectionSummary,
  buildChargenSelectableSkillSummary,
  syncChargenLanguageSkillRows,
  syncChargenMotherTongueSkillRow,
  syncChargenSelectionSkillRows,
} from "../selectionStructure";
import { getProfessionById, recalculateProgression } from "./_helpers";
import {
  type ChargenRuleSetInput,
  type ReviewChargenDraftInput,
  reviewChargenDraft,
} from "./review";

export interface FinalizeChargenDraftInput extends ReviewChargenDraftInput {
  name?: string;
}

export interface FinalizeChargenDraftResult {
  build?: CharacterBuild;
  errors: string[];
  warnings: string[];
}

function getRuleSetParameters(ruleSet?: ChargenRuleSetInput): Partial<ChargenRuleSetParameters> {
  return ruleSet?.parameters ?? {};
}

export function finalizeChargenDraft(input: FinalizeChargenDraftInput): FinalizeChargenDraftResult {
  const review = reviewChargenDraft(input);

  if (!review.canFinalize || !input.profile) {
    return {
      errors: review.errors,
      warnings: review.warnings,
    };
  }

  let progression = recalculateProgression(structuredClone(input.progression));
  progression = recalculateProgression(
    syncChargenSelectionSkillRows({
      content: input.content,
      progression,
    }),
  );
  progression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression,
      societyId: input.societyId,
    }),
  );
  progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: review.draftView.education.theoreticalSkillCount,
      progression,
    }),
  );
  progression.educationPoints = review.draftView.education.theoreticalSkillCount;
  const languageSummary = buildChargenLanguageSelectionSummary({
    civilizationId: input.civilizationId,
    content: input.content,
    progression,
    societyId: input.societyId,
  });
  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content: input.content,
    professionId: input.professionId,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel,
  });
  progression.chargenSelections = {
    selectedLanguageIds: languageSummary.selectedLanguageIds,
    selectedSkillIds: selectableSkillSummary.selectedSkillIds,
    selectedGroupSlots: progression.chargenSelections?.selectedGroupSlots ?? [],
  };
  const catalogue = input.content.chargenCatalogue;
  const retainedSkillIds = new Set(progression.skills.map(({ skillId }) => skillId));
  const retainedSpecializationIds = new Set(
    progression.specializations.map(({ specializationId }) => specializationId),
  );
  const relationshipContent = catalogue
    ? {
        ...input.content,
        skills: input.content.skills.filter(
          ({ id }) => catalogue.skillIds.includes(id) || retainedSkillIds.has(id),
        ),
        specializations: input.content.specializations.filter(
          ({ id }) => catalogue.specializationIds.includes(id) || retainedSpecializationIds.has(id),
        ),
      }
    : input.content;
  progression = recalculateProgression(
    applyRelationshipMinimumGrants({
      content: relationshipContent,
      progression,
    }),
  );

  const profession = getProfessionById(input.content, input.professionId);
  const ruleSetParameters = getRuleSetParameters(input.ruleSet);
  const ruleSetPolicy = createChargenMethodPolicy(ruleSetParameters);
  const build: CharacterBuild = {
    chargenRuleSet: {
      exchangeCount: ruleSetPolicy.maxExchanges,
      flexiblePointFactor: ruleSetPolicy.flexiblePointFactor,
      id: input.ruleSet?.id,
      name: input.ruleSet?.name?.trim() || "Legacy default",
      ordinarySkillPoints: ruleSetPolicy.primaryPoolTotal,
      statRollCount: ruleSetPolicy.displayedRollCount,
    },
    equipment: {
      items: [],
    },
    id:
      globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `character-${Date.now()}`,
    name: input.name?.trim() || `${profession?.name ?? "Character"} ${input.profile.label}`.trim(),
    profile: input.profile,
    professionId: input.professionId,
    targetChargen:
      input.content.chargenCatalogue?.professionSourceDigest && profession
        ? {
            familyId: profession.familyId,
            trackId: profession.id === profession.familyId ? undefined : profession.id,
            professionName: profession.name,
            sourceDigest: input.content.chargenCatalogue.professionSourceDigest,
            groupSourceDigest: input.content.chargenCatalogue.groupSourceDigest!,
          }
        : undefined,
    progression,
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
    civilizationId: input.civilizationId,
    socialClass: input.socialClass,
    societyId: input.societyId,
    societyLevel: input.societyLevel,
  };

  const targetErrors = validateTargetChargenBuild(build, input.content);
  if (targetErrors.length) return { errors: targetErrors, warnings: review.warnings };
  return {
    build,
    errors: [],
    warnings: review.warnings,
  };
}
