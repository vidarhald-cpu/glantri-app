import type { CharacterProgression, RolledCharacterProfile } from "@glantri/domain";

import { evaluateSkillSelection } from "../../skills/evaluateSkillSelection";
import {
  buildChargenSelectableSkillSummary,
  syncChargenLanguageSkillRows,
  syncChargenMotherTongueSkillRow
} from "../selectionStructure";
import {
  type CanonicalContentShape,
  buildEducationBreakdown,
  getEvaluationMessages,
  getSkillById,
  getSpecializationById,
  recalculateProgression
} from "./_helpers";
import { buildChargenSkillAccessSummaryInternal } from "./access";
import { getFlexiblePoolTotal, getOrdinaryPoolTotal } from "./costs";
import { type ChargenDraftView, buildChargenDraftView } from "./views";

export interface ChargenRuleSetInput {
  id?: string;
  name?: string;
  parameters?: Partial<import("@glantri/domain").ChargenRuleSetParameters>;
}

export interface ReviewChargenDraftInput {
  civilizationId?: string;
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  ruleSet?: ChargenRuleSetInput;
  socialClass?: string;
  societyId?: string;
  societyLevel?: number;
}

export interface ReviewChargenDraftResult {
  canFinalize: boolean;
  draftView: ChargenDraftView;
  errors: string[];
  warnings: string[];
}

function getReadableErrors(errors: Iterable<string>): string[] {
  return [...new Set(errors)];
}

export function reviewChargenDraft(
  input: ReviewChargenDraftInput
): ReviewChargenDraftResult {
  const normalizedProgression = recalculateProgression(input.progression);
  const languageSyncedProgression = recalculateProgression(
    syncChargenLanguageSkillRows({
      civilizationId: input.civilizationId,
      content: input.content,
      progression: normalizedProgression,
      societyId: input.societyId
    })
  );
  const education = buildEducationBreakdown({
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression: languageSyncedProgression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });
  const progression = recalculateProgression(
    syncChargenMotherTongueSkillRow({
      civilizationId: input.civilizationId,
      content: input.content,
      educationLevel: education.theoreticalSkillCount,
      progression: languageSyncedProgression
    })
  );
  const access =
    input.professionId && input.societyLevel !== undefined
      ? buildChargenSkillAccessSummaryInternal({
          content: input.content,
          professionId: input.professionId,
          societyId: input.societyId,
          societyLevel: input.societyLevel
        })
      : {
          normalSkillGroupIds: [],
          normalSkillIds: [],
          otherSkillIds: input.content.skills.map((skill) => skill.id),
          skillSources: {}
        };
  const draftView = buildChargenDraftView({
    civilizationId: input.civilizationId,
    content: input.content,
    professionId: input.professionId,
    profile: input.profile,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  const errorSet = new Set<string>();
  const warningSet = new Set<string>();

  if (!input.profile) {
    errorSet.add("Select a rolled profile before finalizing.");
  }

  if (input.societyLevel === undefined) {
    errorSet.add("Select a society before finalizing.");
  }

  if (!input.professionId) {
    errorSet.add("Select a profession before finalizing.");
  }

  if (progression.primaryPoolSpent > getOrdinaryPoolTotal(progression)) {
    errorSet.add("Ordinary pool is overspent.");
  }

  if (progression.secondaryPoolSpent > getFlexiblePoolTotal(input.profile, progression)) {
    errorSet.add("Flexible pool is overspent.");
  }

  for (const group of progression.skillGroups) {
    if (group.primaryRanks > 0 && !access.normalSkillGroupIds.includes(group.groupId)) {
      errorSet.add(`Ordinary spending on ${group.groupId} is not allowed for this profession and society.`);
    }
  }

  for (const skill of progression.skills) {
    const definition = getSkillById(input.content, skill.skillId);

    if (!definition) {
      errorSet.add(`Missing skill definition for ${skill.skillId}.`);
      continue;
    }

    if (skill.primaryRanks > 0 && !access.normalSkillIds.includes(definition.id)) {
      errorSet.add(`${definition.name} is not valid for ordinary-pool spending in this build.`);
    }

    const dependencyEvaluation = evaluateSkillSelection({
      content: input.content,
      progression,
      target: {
        skill: definition,
        targetType: "skill"
      }
    });

    for (const reason of dependencyEvaluation.blockingReasons) {
      errorSet.add(reason.message);
    }

    for (const message of getEvaluationMessages(dependencyEvaluation)) {
      warningSet.add(message);
    }
  }

  for (const specialization of progression.specializations) {
    const definition = getSpecializationById(input.content, specialization.specializationId);

    if (!definition) {
      errorSet.add(`Missing specialization definition for ${specialization.specializationId}.`);
      continue;
    }

    const specializationEvaluation = evaluateSkillSelection({
      content: input.content,
      progression,
      target: {
        specialization: definition,
        targetType: "specialization"
      }
    });

    for (const reason of specializationEvaluation.blockingReasons) {
      errorSet.add(reason.message);
    }

    for (const message of getEvaluationMessages(specializationEvaluation)) {
      warningSet.add(message);
    }
  }

  const selectableSkillSummary = buildChargenSelectableSkillSummary({
    content: input.content,
    professionId: input.professionId,
    progression,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  const ownedGroupIds = new Set(
    progression.skillGroups
      .filter((group) => (group.ranks ?? 0) > 0 || (group.grantedRanks ?? 0) > 0)
      .map((group) => group.groupId)
  );

  for (const slot of selectableSkillSummary.selectionSlots) {
    if (!ownedGroupIds.has(slot.groupId)) {
      continue;
    }

    if (slot.required && !slot.isSatisfied) {
      errorSet.add(`${slot.groupName}: ${slot.label}.`);
    }
  }

  return {
    canFinalize: errorSet.size === 0,
    draftView,
    errors: getReadableErrors(errorSet),
    warnings: getReadableErrors(warningSet)
  };
}
