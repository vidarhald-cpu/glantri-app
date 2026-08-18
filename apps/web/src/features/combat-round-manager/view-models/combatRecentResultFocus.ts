import type { CombatProgressionExpectedCommand, CombatRoundStep } from "@glantri/domain";

import type {
  CombatResultGroupPresentation,
  CombatStepResultPresentation,
} from "@/features/combat-history";

export interface CombatRecentResultSource {
  readonly participantId: string;
  readonly roundNumber: number;
  readonly step: CombatRoundStep;
}

export interface CombatRecentResultCandidate {
  readonly commandType: CombatProgressionExpectedCommand;
  readonly source: CombatRecentResultSource;
  readonly sourceGroupFingerprints: Readonly<Record<string, string>>;
  readonly sourceTaskId: string;
}

export interface CombatRecentResultFocus {
  readonly acceptedRevision: string;
  readonly commandType: CombatProgressionExpectedCommand;
  readonly createdFromTaskId: string;
  readonly groupId: string;
  readonly groupingIdentity?: string;
  readonly groupingIdentitySource: CombatResultGroupPresentation["provenance"]["groupingIdentitySource"];
  readonly focusId: string;
  readonly resultIds: readonly string[];
  readonly rootResultId: string;
  readonly source: CombatRecentResultSource;
  readonly sourceEventIds: readonly string[];
  readonly status: "focused";
}

const RESULT_PRODUCING_COMMANDS = new Set<CombatProgressionExpectedCommand>([
  "commit_adjust_distance",
  "commit_feint_result",
  "commit_phase_damage",
  "commit_round_end_distance_control",
  "resolve_damage",
  "roll_adjust_distance",
  "roll_attack",
  "roll_combat_experience",
  "roll_continued_contact_maintenance",
  "roll_critical",
  "roll_feint",
  "roll_hit_location",
  "roll_initiative_phase1",
  "roll_initiative_phase2",
  "roll_observation",
  "roll_offensive_parry_brawling",
  "roll_parry",
  "roll_round_end_distance_control",
  "roll_round_end_health_check",
  "submit_phase_initiative_choice",
]);

function groupFingerprint(group: CombatResultGroupPresentation): string {
  return JSON.stringify({
    resultIds: group.provenance.resultIds,
    sourceEventIds: group.provenance.sourceEventIds,
  });
}

export function createCombatRecentResultCandidate(input: {
  readonly commandType: CombatProgressionExpectedCommand;
  readonly presentation?: CombatStepResultPresentation;
  readonly source: CombatRecentResultSource;
  readonly sourceTaskId: string;
}): CombatRecentResultCandidate | undefined {
  if (!RESULT_PRODUCING_COMMANDS.has(input.commandType)) return undefined;
  return {
    commandType: input.commandType,
    source: input.source,
    sourceGroupFingerprints: Object.fromEntries(
      (input.presentation?.groups ?? []).map((group) => [group.groupId, groupFingerprint(group)]),
    ),
    sourceTaskId: input.sourceTaskId,
  };
}

export function resolveCombatRecentResultFocus(input: {
  readonly acceptedPresentation?: CombatStepResultPresentation;
  readonly acceptedRevision: string;
  readonly candidate: CombatRecentResultCandidate;
}): CombatRecentResultFocus | undefined {
  const presentation = input.acceptedPresentation;
  if (
    !presentation ||
    presentation.participantId !== input.candidate.source.participantId ||
    presentation.roundNumber !== input.candidate.source.roundNumber
  ) {
    return undefined;
  }

  const changedGroups = (presentation.groups ?? []).filter(
    (group) => input.candidate.sourceGroupFingerprints[group.groupId] !== groupFingerprint(group),
  );
  const group = changedGroups.sort(
    (left, right) =>
      right.lastSequence - left.lastSequence || right.groupId.localeCompare(left.groupId),
  )[0];
  if (!group) return undefined;

  return {
    acceptedRevision: input.acceptedRevision,
    commandType: input.candidate.commandType,
    createdFromTaskId: input.candidate.sourceTaskId,
    groupId: group.groupId,
    groupingIdentity: group.provenance.groupingIdentity,
    groupingIdentitySource: group.provenance.groupingIdentitySource,
    focusId: `combat-recent-result:${input.acceptedRevision}:${group.groupId}`,
    resultIds: [...group.provenance.resultIds],
    rootResultId: group.rootResultId,
    source: input.candidate.source,
    sourceEventIds: [...group.provenance.sourceEventIds],
    status: "focused",
  };
}

export function selectCombatRecentResultPresentation(input: {
  readonly focus: CombatRecentResultFocus;
  readonly presentation?: CombatStepResultPresentation;
}): CombatStepResultPresentation | undefined {
  const presentation = input.presentation;
  if (
    !presentation ||
    presentation.participantId !== input.focus.source.participantId ||
    presentation.roundNumber !== input.focus.source.roundNumber
  ) {
    return undefined;
  }
  const group = presentation.groups?.find((candidate) => candidate.groupId === input.focus.groupId);
  if (!group) return undefined;
  const resultIds = new Set(input.focus.resultIds);
  const sourceEventIds = new Set(input.focus.sourceEventIds);
  const subordinateResults = group.subordinateResults.filter(
    (result) =>
      result.resultEnvelopes.some((envelope) => resultIds.has(envelope.resultId)) ||
      result.sourceEventIds.some((eventId) => sourceEventIds.has(eventId)),
  );
  const focusedGroup: CombatResultGroupPresentation = {
    ...group,
    firstSequence: subordinateResults[0]?.sequence ?? group.firstSequence,
    lastSequence: subordinateResults.at(-1)?.sequence ?? group.lastSequence,
    provenance: {
      ...group.provenance,
      resultIds: input.focus.resultIds,
      sourceEventIds: input.focus.sourceEventIds,
    },
    subordinateResults,
  };
  return {
    ...presentation,
    entries: presentation.entries.filter((entry) =>
      entry.sourceEventIds.some((eventId) => sourceEventIds.has(eventId)),
    ),
    groups: [focusedGroup],
  };
}
