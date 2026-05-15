import type {
  EncounterParticipant,
  EncounterSession,
  RoleplayDifficulty,
  RoleplayActionLogEntry,
  RoleplayPendingSkillRoll,
  ScenarioParticipant,
} from "@glantri/domain";
import {
  normalizeRoleplayState,
  orderRoleplayEncounterParticipants,
  resolveEncounterParticipantByRollParticipantId,
  resolveEncounterParticipantMembership,
} from "@glantri/domain";

export interface PlayerGeneralEncounterVisibleParticipant {
  description: string;
  id: string;
  name: string;
  shortDescription: string;
}

export interface PlayerGeneralEncounterAssignedRoll {
  comparison?: string;
  difficulty?: RoleplayDifficulty;
  difficultyLabel: string;
  id: string;
  mode: "difficulty" | "opposed";
  otherMod: number;
  opponentLabel?: string;
  participantId: string;
  participantName: string;
  skillId: string;
  skillLabel: string;
  skillValue?: number;
  result?: PlayerGeneralEncounterRollResult;
  rollSetId?: string;
  supportResult?: PlayerGeneralEncounterRollResult;
  supportSkillId?: string;
  supportSkillLabel?: string;
  supportSkillValue?: number;
  useDbMod: boolean;
  useGenMod: boolean;
  useObSkillMod: boolean;
}

export interface PlayerGeneralEncounterRollResult {
  dieResult?: number;
  fumble: boolean;
  id: string;
  openEndedD10s: number[];
  rollD20?: number;
  total?: number;
}

export interface PlayerGeneralEncounterRankedResult {
  id: string;
  participantId?: string;
  participantName: string;
  pendingRollId?: string;
  rollSetId?: string;
  skillId?: string;
  skillLabel: string;
  total: number;
}

export interface PlayerGeneralEncounterLogEntry {
  detail: string;
  id: string;
  skillLabel: string;
  timestamp: string;
  total?: number;
}

export interface PlayerGeneralEncounterView {
  assignedRolls: PlayerGeneralEncounterAssignedRoll[];
  characterLog: PlayerGeneralEncounterLogEntry[];
  controlledParticipantIds: string[];
  currentRollRoundId?: string;
  currentRollRoundResultId?: string;
  gmMessage: string;
  rankedResults: PlayerGeneralEncounterRankedResult[];
  visibleParticipantIds: string[];
  visibleParticipants: PlayerGeneralEncounterVisibleParticipant[];
}

const difficultyLabels: Record<string, string> = {
  critical: "Critical",
  easy: "Easy",
  godly: "Godly",
  hard: "Hard",
  legendary: "Legendary",
  medium: "Medium",
  medium_minus: "Medium -",
  medium_plus: "Medium +",
  trivial_success: "Trivial success",
  very_hard: "Very hard",
};

function getScenarioParticipantControllerId(
  encounterParticipant: EncounterParticipant,
  scenarioParticipantsById: Map<string, ScenarioParticipant>
): string | undefined {
  if (!encounterParticipant.scenarioParticipantId) {
    return undefined;
  }

  return scenarioParticipantsById.get(encounterParticipant.scenarioParticipantId)?.controlledByUserId;
}

function getPlayerSafeParticipantName(input: {
  fallbackLabel: string;
  participantId: string;
  state: ReturnType<typeof normalizeRoleplayState>;
}): string {
  return input.state.participantDescriptions[input.participantId]?.name ?? input.fallbackLabel;
}

function isParticipantVisibleToPlayer(input: {
  controlledParticipantIds: Set<string>;
  defaultVisibleWhenNoMatrix?: boolean;
  participantId: string;
  state: ReturnType<typeof normalizeRoleplayState>;
}): boolean {
  if (input.controlledParticipantIds.has(input.participantId)) {
    return true;
  }

  for (const viewerId of input.controlledParticipantIds) {
    const viewerVisibility = input.state.visibility[viewerId];

    if (viewerVisibility?.[input.participantId]) {
      return true;
    }

    if (
      input.defaultVisibleWhenNoMatrix &&
      (!viewerVisibility || Object.keys(viewerVisibility).length === 0)
    ) {
      return true;
    }
  }

  return false;
}

function buildAssignedRoll(input: {
  encounterParticipantsById: Map<string, EncounterParticipant>;
  pendingRoll: RoleplayPendingSkillRoll;
  participant?: EncounterParticipant;
  result?: RoleplayActionLogEntry;
  state: ReturnType<typeof normalizeRoleplayState>;
  visibleParticipantIds: Set<string>;
}): PlayerGeneralEncounterAssignedRoll {
  const participant =
    input.participant ?? input.encounterParticipantsById.get(input.pendingRoll.participantId);
  const opponentVisible =
    input.pendingRoll.opponentParticipantId &&
    !input.pendingRoll.opponentSilent &&
    input.visibleParticipantIds.has(input.pendingRoll.opponentParticipantId);
  const opponentParticipant = opponentVisible
    ? input.encounterParticipantsById.get(input.pendingRoll.opponentParticipantId!)
    : undefined;
  const participantName = participant
    ? getPlayerSafeParticipantName({
        fallbackLabel: participant.label,
        participantId: participant.id,
        state: input.state,
      })
    : "Assigned participant";
  const opponentName = opponentParticipant
    ? getPlayerSafeParticipantName({
        fallbackLabel: opponentParticipant.label,
        participantId: opponentParticipant.id,
        state: input.state,
      })
    : undefined;
  const opponentResult =
    input.pendingRoll.mode === "opposed" && input.pendingRoll.rollSetId && opponentParticipant
      ? input.state.actionLog.find(
          (entry) =>
            entry.type === "gm_skill_roll" &&
            !entry.silent &&
            entry.rollSetId === input.pendingRoll.rollSetId &&
            (
              (
                entry.side === "opponent" &&
                entry.participantId === opponentParticipant.id &&
                entry.numericSubtotal != null
              ) ||
              (
                !entry.side &&
                !entry.opponentSilent &&
                entry.opponentParticipantId === opponentParticipant.id &&
                entry.opponentNumericSubtotal != null
              )
            )
        )
      : undefined;
  const ownTotal = input.result?.numericSubtotal ?? input.result?.finalTotal;
  const opponentTotal =
    opponentResult?.side === "opponent"
      ? opponentResult.numericSubtotal ?? opponentResult.finalTotal
      : opponentResult?.opponentNumericSubtotal;
  const comparison =
    ownTotal != null && opponentTotal != null && opponentName
      ? ownTotal === opponentTotal
        ? "Tie."
        : ownTotal > opponentTotal
          ? `${participantName} wins by ${ownTotal - opponentTotal}.`
          : `${opponentName} wins by ${opponentTotal - ownTotal}.`
      : undefined;

  return {
    comparison,
    difficulty: input.pendingRoll.difficulty,
    difficultyLabel: input.pendingRoll.difficulty
      ? difficultyLabels[input.pendingRoll.difficulty] ?? input.pendingRoll.difficulty
      : "No level",
    id: input.pendingRoll.id,
    mode: input.pendingRoll.mode,
    otherMod: input.pendingRoll.otherMod,
    opponentLabel:
      opponentParticipant && input.pendingRoll.opponentSkillLabel
        ? `${getPlayerSafeParticipantName({
            fallbackLabel: opponentParticipant.label,
            participantId: opponentParticipant.id,
            state: input.state,
          })} · ${input.pendingRoll.opponentSkillLabel}`
        : undefined,
    participantId: participant?.id ?? input.pendingRoll.participantId,
    participantName,
    result: input.result
      ? {
          dieResult: input.result.dieResult,
          fumble: input.result.fumble,
          id: input.result.id,
          openEndedD10s: input.result.openEndedD10s,
          rollD20: input.result.rollD20,
          total: input.result.numericSubtotal ?? input.result.finalTotal,
      }
      : undefined,
    rollSetId: input.pendingRoll.rollSetId,
    skillId: input.pendingRoll.skillId,
    skillLabel: input.pendingRoll.skillLabel,
    skillValue: input.pendingRoll.skillValue,
    supportSkillId: input.pendingRoll.supportSkillId,
    supportSkillLabel: input.pendingRoll.supportSkillLabel,
    supportSkillValue: input.pendingRoll.supportSkillValue,
    supportResult: input.result?.supportDieResult != null && input.result.supportRollD20 != null
      ? {
          dieResult: input.result.supportDieResult,
          fumble: false,
          id: `${input.result.id}-support`,
          openEndedD10s: input.result.supportOpenEndedD10s,
          rollD20: input.result.supportRollD20,
          total: input.result.supportNumericSubtotal,
        }
      : undefined,
    useDbMod: input.pendingRoll.useDbMod,
    useGenMod: input.pendingRoll.useGenMod,
    useObSkillMod: input.pendingRoll.useObSkillMod,
  };
}

function findVisibleResultForPendingRoll(input: {
  entries: RoleplayActionLogEntry[];
  pendingRoll: RoleplayPendingSkillRoll;
}): RoleplayActionLogEntry | undefined {
  const matchingEntries = input.entries.filter(
    (entry) =>
      entry.type === "gm_skill_roll" &&
      !entry.silent &&
      ((entry.pendingRollId && entry.pendingRollId === input.pendingRoll.id) ||
        (entry.participantId === input.pendingRoll.participantId &&
          entry.skillId === input.pendingRoll.skillId &&
          (input.pendingRoll.rollSetId ? entry.rollSetId === input.pendingRoll.rollSetId : true) &&
          (input.pendingRoll.side ? entry.side === input.pendingRoll.side : true)))
  );

  return matchingEntries.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function isPlayerVisibleRankedResult(input: {
  entry: RoleplayActionLogEntry;
  opposedRollSetIds: Set<string>;
  visibleParticipantIds: Set<string>;
}): boolean {
  return (
    input.entry.type === "gm_skill_roll" &&
    input.entry.mode !== "opposed" &&
    !input.entry.side &&
    (!input.entry.rollSetId || !input.opposedRollSetIds.has(input.entry.rollSetId)) &&
    !input.entry.silent &&
    input.entry.participantId != null &&
    input.visibleParticipantIds.has(input.entry.participantId) &&
    input.entry.numericSubtotal != null
  );
}

function hasSameRankedStackIdentity(left: RoleplayActionLogEntry, right: RoleplayActionLogEntry): boolean {
  return Boolean(
    left.rollSetId &&
      right.rollSetId &&
      left.rollSetId === right.rollSetId &&
      left.participantId &&
      right.participantId &&
      left.participantId === right.participantId &&
      left.skillId &&
      right.skillId &&
      left.skillId === right.skillId
  );
}

function isSamePlayerRankedEntry(left: RoleplayActionLogEntry, right: RoleplayActionLogEntry): boolean {
  if (left.pendingRollId && right.pendingRollId) {
    return left.pendingRollId === right.pendingRollId;
  }

  if (left.pendingRollId || right.pendingRollId) {
    return hasSameRankedStackIdentity(left, right);
  }

  if (hasSameRankedStackIdentity(left, right)) {
    return true;
  }

  return left.id === right.id;
}

function dedupePlayerRankedEntries(entries: RoleplayActionLogEntry[]): RoleplayActionLogEntry[] {
  const deduped: RoleplayActionLogEntry[] = [];

  for (const entry of entries) {
    const existingIndex = deduped.findIndex((existing) => isSamePlayerRankedEntry(existing, entry));

    if (existingIndex >= 0) {
      deduped[existingIndex] = entry;
    } else {
      deduped.push(entry);
    }
  }

  return deduped;
}

function buildPlayerCharacterLog(input: {
  controlledParticipantIds: Set<string>;
  entries: RoleplayActionLogEntry[];
  resolveParticipant: (participantId?: string | null) => EncounterParticipant | undefined;
}): PlayerGeneralEncounterLogEntry[] {
  return input.entries
    .filter(
      (entry) => {
        const participant = input.resolveParticipant(entry.participantId);

        return (
          entry.type === "gm_skill_roll" &&
          !entry.silent &&
          participant != null &&
          input.controlledParticipantIds.has(participant.id)
        );
      }
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((entry) => {
      const total = entry.numericSubtotal ?? entry.finalTotal;
      const modifier = entry.otherMod ?? 0;
      const detail = [
        entry.participantName,
        entry.skillLabel,
        entry.supportCalculationText ? `support ${entry.supportCalculationText}` : undefined,
        entry.skillValue == null ? undefined : `skill ${entry.skillValue}`,
        `mod ${modifier >= 0 ? "+" : ""}${modifier}`,
        entry.dieResult == null ? undefined : `roll ${entry.dieResult}`,
        total == null ? undefined : `total ${total}`,
        entry.opposedResult && entry.opposedMargin != null
          ? `${entry.opposedResult === "win" ? "won" : entry.opposedResult === "loss" ? "lost" : "tied"} opposed${entry.opposedResult === "tie" ? "" : ` by ${entry.opposedMargin}`}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        detail,
        id: entry.id,
        skillLabel: entry.skillLabel ?? "Skill",
        timestamp: entry.createdAt,
        total,
      };
    });
}

export function buildPlayerGeneralEncounterView(input: {
  currentUserId?: string;
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): PlayerGeneralEncounterView {
  const state = normalizeRoleplayState(input.encounter);
  const opposedRollSetIds = new Set(
    [
      ...state.pendingSkillRolls
        .filter((roll) => roll.mode === "opposed" && roll.rollSetId)
        .map((roll) => roll.rollSetId),
      ...state.actionLog
        .filter((entry) => (entry.mode === "opposed" || Boolean(entry.side)) && entry.rollSetId)
        .map((entry) => entry.rollSetId),
    ].filter((rollSetId): rollSetId is string => Boolean(rollSetId))
  );
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
  const effectiveEncounterParticipants = membership.participants;
  const usesFallbackParticipants = membership.source === "defaultFallback";
  const orderedParticipants = orderRoleplayEncounterParticipants(effectiveEncounterParticipants);
  const encounterParticipantsById = new Map(orderedParticipants.map((participant) => [participant.id, participant]));
  const scenarioParticipantsById = new Map(
    input.scenarioParticipants.map((participant) => [participant.id, participant])
  );
  const resolveParticipant = (participantId?: string | null): EncounterParticipant | undefined => {
    return resolveEncounterParticipantByRollParticipantId({
      participantId,
      participants: orderedParticipants,
    });
  };
  const controlledParticipantIds = new Set(
    orderedParticipants
      .filter(
        (participant) =>
          input.currentUserId &&
          getScenarioParticipantControllerId(participant, scenarioParticipantsById) === input.currentUserId
      )
      .map((participant) => participant.id)
  );
  const visibleParticipantIds = new Set(
    orderedParticipants
      .filter((participant) =>
        isParticipantVisibleToPlayer({
          controlledParticipantIds,
          defaultVisibleWhenNoMatrix: usesFallbackParticipants,
          participantId: participant.id,
          state,
        })
      )
      .map((participant) => participant.id)
  );
  const visibleParticipants = orderedParticipants
    .filter(
      (participant) =>
        visibleParticipantIds.has(participant.id) && !controlledParticipantIds.has(participant.id)
    )
    .map((participant) => {
      const description = state.participantDescriptions[participant.id];

      return {
        description: "",
        id: participant.id,
        name: description?.name ?? participant.label,
        shortDescription: description?.shortDescription ?? "",
      };
    });
  const visiblePendingRolls = state.pendingSkillRolls.filter(
    (roll) => {
      const participant = resolveParticipant(roll.participantId);

      return (
        !roll.silent &&
        participant != null &&
        controlledParticipantIds.has(participant.id) &&
        visibleParticipantIds.has(participant.id)
      );
    }
  );
  const latestPendingRoll = [...visiblePendingRolls].sort((left, right) =>
    right.assignedAt.localeCompare(left.assignedAt)
  )[0];
  const latestPendingRollSetId = latestPendingRoll?.rollSetId;
  const assignedRolls = visiblePendingRolls
    .filter((roll) =>
      latestPendingRollSetId
        ? roll.rollSetId === latestPendingRollSetId
        : latestPendingRoll
          ? roll.id === latestPendingRoll.id
          : false
    )
    .map((pendingRoll) =>
      buildAssignedRoll({
        encounterParticipantsById,
        pendingRoll,
        participant: resolveParticipant(pendingRoll.participantId),
        result: findVisibleResultForPendingRoll({
          entries: state.actionLog,
          pendingRoll,
        }),
        state,
        visibleParticipantIds,
      })
    );
  const visibleRankedEntries = state.actionLog.filter((entry) => {
    const participant = resolveParticipant(entry.participantId);

    return (
      participant != null &&
      isPlayerVisibleRankedResult({
        entry,
        opposedRollSetIds,
        visibleParticipantIds: new Set(
          visibleParticipantIds.has(participant.id) ? [entry.participantId ?? participant.id] : []
        ),
      })
    );
  });
  const currentRollRoundId = state.currentRankedRollStackId ?? latestPendingRollSetId;
  const currentRollRoundResultId = undefined;
  const rankedResults = dedupePlayerRankedEntries(visibleRankedEntries)
    .filter((entry) =>
      currentRollRoundId
        ? entry.rollSetId === currentRollRoundId
        : currentRollRoundResultId
          ? entry.id === currentRollRoundResultId
          : false
    )
    .sort(
      (left, right) =>
        Number(Boolean(left.fumble)) - Number(Boolean(right.fumble)) ||
        (right.numericSubtotal ?? Number.NEGATIVE_INFINITY) -
          (left.numericSubtotal ?? Number.NEGATIVE_INFINITY) ||
        right.createdAt.localeCompare(left.createdAt)
    )
    .map((entry) => {
      const participant = resolveParticipant(entry.participantId);

      return {
        id: entry.id,
        participantId: participant?.id ?? entry.participantId,
        participantName: participant
          ? getPlayerSafeParticipantName({
              fallbackLabel: participant.label,
              participantId: participant.id,
              state,
            })
          : "Participant",
        pendingRollId: entry.pendingRollId,
        rollSetId: entry.rollSetId,
        skillId: entry.skillId,
        skillLabel: entry.skillLabel ?? "Skill",
        total: entry.numericSubtotal ?? entry.finalTotal ?? 0,
      };
    });
  const characterLog = buildPlayerCharacterLog({
    controlledParticipantIds,
    entries: state.actionLog,
    resolveParticipant,
  });

  return {
    assignedRolls,
    characterLog,
    controlledParticipantIds: [...controlledParticipantIds],
    currentRollRoundId,
    currentRollRoundResultId,
    gmMessage: state.gmMessage,
    rankedResults,
    visibleParticipantIds: [...visibleParticipantIds],
    visibleParticipants,
  };
}
