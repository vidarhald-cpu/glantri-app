import type { CombatProgressionExpectedCommand, CombatRoundStep } from "@glantri/domain";

import type {
  CombatResultGroupPresentation,
  CombatStepResultPresentation,
} from "@/features/combat-history";

export interface CombatPostResultHoldSource {
  readonly participantId: string;
  readonly roundNumber: number;
  readonly step: CombatRoundStep;
}

export interface CombatPostResultHoldCandidate {
  readonly commandType: CombatProgressionExpectedCommand;
  readonly source: CombatPostResultHoldSource;
  readonly sourceGroupFingerprints: Readonly<Record<string, string>>;
  readonly sourceTaskId: string;
}

export interface CombatPostResultHold {
  readonly acceptedRevision: string;
  readonly commandType: CombatProgressionExpectedCommand;
  readonly createdFromTaskId: string;
  readonly groupId: string;
  readonly holdId: string;
  readonly resultIds: readonly string[];
  readonly rootResultId: string;
  readonly source: CombatPostResultHoldSource;
  readonly sourceEventIds: readonly string[];
  readonly status: "active";
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

const SAME_CELL_HOLD_COMMANDS = new Set<CombatProgressionExpectedCommand>([
  "roll_round_end_health_check",
]);

function groupFingerprint(group: CombatResultGroupPresentation): string {
  return JSON.stringify({
    resultIds: group.provenance.resultIds,
    sourceEventIds: group.provenance.sourceEventIds,
  });
}

function sourceAdvanced(input: {
  commandType: CombatProgressionExpectedCommand;
  deterministicSuffixPending?: boolean;
  nextSelection?: { readonly participantId?: string; readonly step: CombatRoundStep };
  source: CombatPostResultHoldSource;
}): boolean {
  if (SAME_CELL_HOLD_COMMANDS.has(input.commandType)) return true;
  if (input.deterministicSuffixPending) return true;
  return Boolean(
    input.nextSelection &&
    (input.nextSelection.participantId !== input.source.participantId ||
      input.nextSelection.step !== input.source.step),
  );
}

export function createCombatPostResultHoldCandidate(input: {
  readonly commandType: CombatProgressionExpectedCommand;
  readonly presentation?: CombatStepResultPresentation;
  readonly source: CombatPostResultHoldSource;
  readonly sourceTaskId: string;
}): CombatPostResultHoldCandidate | undefined {
  if (!input.presentation || !RESULT_PRODUCING_COMMANDS.has(input.commandType)) return undefined;
  return {
    commandType: input.commandType,
    source: input.source,
    sourceGroupFingerprints: Object.fromEntries(
      (input.presentation.groups ?? []).map((group) => [group.groupId, groupFingerprint(group)]),
    ),
    sourceTaskId: input.sourceTaskId,
  };
}

export function resolveCombatPostResultHold(input: {
  readonly acceptedPresentation?: CombatStepResultPresentation;
  readonly acceptedRevision: string;
  readonly candidate: CombatPostResultHoldCandidate;
  readonly deterministicSuffixPending?: boolean;
  readonly nextSelection?: { readonly participantId?: string; readonly step: CombatRoundStep };
}): CombatPostResultHold | undefined {
  const presentation = input.acceptedPresentation;
  if (
    !presentation ||
    presentation.participantId !== input.candidate.source.participantId ||
    presentation.roundNumber !== input.candidate.source.roundNumber ||
    !sourceAdvanced({
      commandType: input.candidate.commandType,
      deterministicSuffixPending: input.deterministicSuffixPending,
      nextSelection: input.nextSelection,
      source: input.candidate.source,
    })
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
    holdId: `combat-post-result-hold:${input.acceptedRevision}:${group.groupId}`,
    resultIds: [...group.provenance.resultIds],
    rootResultId: group.rootResultId,
    source: input.candidate.source,
    sourceEventIds: [...group.provenance.sourceEventIds],
    status: "active",
  };
}

export function selectCombatPostResultHoldPresentation(input: {
  readonly hold: CombatPostResultHold;
  readonly presentation?: CombatStepResultPresentation;
}): CombatStepResultPresentation | undefined {
  const presentation = input.presentation;
  if (
    !presentation ||
    presentation.participantId !== input.hold.source.participantId ||
    presentation.roundNumber !== input.hold.source.roundNumber
  ) {
    return undefined;
  }
  const group = presentation.groups?.find((candidate) => candidate.groupId === input.hold.groupId);
  if (!group) return undefined;
  const resultIds = new Set(input.hold.resultIds);
  const sourceEventIds = new Set(input.hold.sourceEventIds);
  const subordinateResults = group.subordinateResults.filter(
    (result) =>
      result.resultEnvelopes.some((envelope) => resultIds.has(envelope.resultId)) ||
      result.sourceEventIds.some((eventId) => sourceEventIds.has(eventId)),
  );
  const heldGroup: CombatResultGroupPresentation = {
    ...group,
    firstSequence: subordinateResults[0]?.sequence ?? group.firstSequence,
    lastSequence: subordinateResults.at(-1)?.sequence ?? group.lastSequence,
    provenance: {
      ...group.provenance,
      resultIds: input.hold.resultIds,
      sourceEventIds: input.hold.sourceEventIds,
    },
    subordinateResults,
  };
  return {
    ...presentation,
    entries: presentation.entries.filter((entry) =>
      entry.sourceEventIds.some((eventId) => sourceEventIds.has(eventId)),
    ),
    groups: [heldGroup],
  };
}

export function isCombatPostResultHoldSourceSelection(input: {
  readonly hold?: CombatPostResultHold;
  readonly participantId?: string;
  readonly roundNumber: number;
  readonly step: CombatRoundStep;
}): boolean {
  return Boolean(
    input.hold &&
    input.hold.source.participantId === input.participantId &&
    input.hold.source.roundNumber === input.roundNumber &&
    input.hold.source.step === input.step,
  );
}
