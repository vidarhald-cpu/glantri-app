import type { CharacterBuild, ChargenRuleSetParameters } from "@glantri/domain";

import { applyRelationshipMinimumGrants } from "../../skills/deriveSkillRelationships";
import { createChargenMethodPolicy } from "../policy";
import {
  buildChargenLanguageSelectionSummary,
  buildChargenSelectableSkillSummary,
  syncChargenLanguageSkillRows,
  syncChargenMotherTongueSkillRow,
  syncChargenSelectionSkillRows
} from "../selectionStructure";
import {
  getProfessionById,
  recalculateProgression
} from "./_helpers";
import {
  type ChargenRuleSetInput,
  type ReviewChargenDraftInput,
  reviewChargenDraft
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

export function finalizeChargenDraft(
  input: FinalizeChargenDraftInput
): FinalizeChargenDraftResult {
  const review = reviewChargenDraft(input);

  if (!review.canFinalize || !input.profile) {
    return {
      errors: review.errors,
      warnings: review.warnings
    };
  }

  let progression = recalculateProgression(structuredClone(input.progression));
  progression = recalculateProgression(
    syncChargenSelectionSkillRows({
      content: input.content,
      progression
    })
  );
  progression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression,
      societyId: input.societyId
    })
  );
  progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: review.draftView.education.theoreticalSkillCount,
      progression
    })
  );
  progression.educationPoints = review.draftView.education.theoreticalSkillCount;
  const languageSummary = buildChargenLanguageSelectionSummary({
    civilizationId: input.civilizationId,
    content: input.content,
    progression,
    societyId: input.societyId
  });
  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content: input.content,
    professionId: input.professionId,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  progression.chargenSelections = {
    selectedLanguageIds: languageSummary.selectedLanguageIds,
    selectedSkillIds: selectableSkillSummary.selectedSkillIds,
    selectedGroupSlots: progression.chargenSelections?.selectedGroupSlots ?? []
  };
  progression = recalculateProgression(
    applyRelationshipMinimumGrants({
      content: input.content,
      progression
    })
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
      statRollCount: ruleSetPolicy.displayedRollCount
    },
    equipment: {
      items: []
    },
    id:
      globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `character-${Date.now()}`,
    name:
      input.name?.trim() ||
      `${profession?.name ?? "Character"} ${input.profile.label}`.trim(),
    profile: input.profile,
    professionId: input.professionId,
    progression,
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: []
    },
    socialClass: input.socialClass,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  };

  return {
    build,
    errors: [],
    warnings: review.warnings
  };
}
