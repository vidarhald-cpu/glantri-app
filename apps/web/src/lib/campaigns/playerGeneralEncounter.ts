import type {
  EncounterParticipant,
  EncounterSession,
  RoleplayActionLogEntry,
  RoleplayPendingSkillRoll,
  ScenarioParticipant,
} from "@glantri/domain";
import {
  normalizeRoleplayState,
  orderRoleplayEncounterParticipants,
} from "@glantri/domain";

export interface PlayerGeneralEncounterVisibleParticipant {
  description: string;
  id: string;
  name: string;
  shortDescription: string;
}

export interface PlayerGeneralEncounterAssignedRoll {
  difficultyLabel: string;
  id: string;
  mode: "difficulty" | "opposed";
  opponentLabel?: string;
  participantId: string;
  participantName: string;
  skillId: string;
  skillLabel: string;
  supportSkillLabel?: string;
}

export interface PlayerGeneralEncounterRankedResult {
  id: string;
  participantName: string;
  skillLabel: string;
  total: number;
}

export interface PlayerGeneralEncounterView {
  assignedRolls: PlayerGeneralEncounterAssignedRoll[];
  controlledParticipantIds: string[];
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
  participantId: string;
  state: ReturnType<typeof normalizeRoleplayState>;
}): boolean {
  if (input.controlledParticipantIds.has(input.participantId)) {
    return true;
  }

  for (const viewerId of input.controlledParticipantIds) {
    if (input.state.visibility[viewerId]?.[input.participantId]) {
      return true;
    }
  }

  return false;
}

function buildAssignedRoll(input: {
  encounterParticipantsById: Map<string, EncounterParticipant>;
  pendingRoll: RoleplayPendingSkillRoll;
  state: ReturnType<typeof normalizeRoleplayState>;
  visibleParticipantIds: Set<string>;
}): PlayerGeneralEncounterAssignedRoll {
  const participant = input.encounterParticipantsById.get(input.pendingRoll.participantId);
  const opponentVisible =
    input.pendingRoll.opponentParticipantId &&
    !input.pendingRoll.opponentSilent &&
    input.visibleParticipantIds.has(input.pendingRoll.opponentParticipantId);
  const opponentParticipant = opponentVisible
    ? input.encounterParticipantsById.get(input.pendingRoll.opponentParticipantId!)
    : undefined;

  return {
    difficultyLabel: input.pendingRoll.difficulty
      ? difficultyLabels[input.pendingRoll.difficulty] ?? input.pendingRoll.difficulty
      : "No level",
    id: input.pendingRoll.id,
    mode: input.pendingRoll.mode,
    opponentLabel:
      opponentParticipant && input.pendingRoll.opponentSkillLabel
        ? `${getPlayerSafeParticipantName({
            fallbackLabel: opponentParticipant.label,
            participantId: opponentParticipant.id,
            state: input.state,
          })} · ${input.pendingRoll.opponentSkillLabel}`
        : undefined,
    participantId: input.pendingRoll.participantId,
    participantName: participant
      ? getPlayerSafeParticipantName({
          fallbackLabel: participant.label,
          participantId: participant.id,
          state: input.state,
        })
      : "Assigned participant",
    skillId: input.pendingRoll.skillId,
    skillLabel: input.pendingRoll.skillLabel,
    supportSkillLabel: input.pendingRoll.supportSkillLabel,
  };
}

function isPlayerVisibleRankedResult(input: {
  entry: RoleplayActionLogEntry;
  visibleParticipantIds: Set<string>;
}): boolean {
  return (
    input.entry.type === "gm_skill_roll" &&
    input.entry.mode !== "opposed" &&
    !input.entry.silent &&
    input.entry.participantId != null &&
    input.visibleParticipantIds.has(input.entry.participantId) &&
    input.entry.numericSubtotal != null
  );
}

export function buildPlayerGeneralEncounterView(input: {
  currentUserId?: string;
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): PlayerGeneralEncounterView {
  const state = normalizeRoleplayState(input.encounter);
  const orderedParticipants = orderRoleplayEncounterParticipants(input.encounter.participants);
  const encounterParticipantsById = new Map(orderedParticipants.map((participant) => [participant.id, participant]));
  const scenarioParticipantsById = new Map(
    input.scenarioParticipants.map((participant) => [participant.id, participant])
  );
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
          participantId: participant.id,
          state,
        })
      )
      .map((participant) => participant.id)
  );
  const visibleParticipants = orderedParticipants
    .filter((participant) => visibleParticipantIds.has(participant.id))
    .map((participant) => {
      const description = state.participantDescriptions[participant.id];

      return {
        description: "",
        id: participant.id,
        name: description?.name ?? participant.label,
        shortDescription: description?.shortDescription ?? "",
      };
    });
  const assignedRolls = state.pendingSkillRolls
    .filter(
      (roll) =>
        !roll.silent &&
        controlledParticipantIds.has(roll.participantId) &&
        visibleParticipantIds.has(roll.participantId)
    )
    .map((pendingRoll) =>
      buildAssignedRoll({
        encounterParticipantsById,
        pendingRoll,
        state,
        visibleParticipantIds,
      })
    );
  const rankedResults = state.actionLog
    .filter((entry) => isPlayerVisibleRankedResult({ entry, visibleParticipantIds }))
    .sort(
      (left, right) =>
        Number(Boolean(left.fumble)) - Number(Boolean(right.fumble)) ||
        (right.numericSubtotal ?? Number.NEGATIVE_INFINITY) -
          (left.numericSubtotal ?? Number.NEGATIVE_INFINITY) ||
        right.createdAt.localeCompare(left.createdAt)
    )
    .map((entry) => {
      const participant = entry.participantId
        ? encounterParticipantsById.get(entry.participantId)
        : undefined;

      return {
        id: entry.id,
        participantName: participant
          ? getPlayerSafeParticipantName({
              fallbackLabel: participant.label,
              participantId: participant.id,
              state,
            })
          : "Participant",
        skillLabel: entry.skillLabel ?? "Skill",
        total: entry.numericSubtotal ?? entry.finalTotal ?? 0,
      };
    });

  return {
    assignedRolls,
    controlledParticipantIds: [...controlledParticipantIds],
    gmMessage: state.gmMessage,
    rankedResults,
    visibleParticipantIds: [...visibleParticipantIds],
    visibleParticipants,
  };
}
