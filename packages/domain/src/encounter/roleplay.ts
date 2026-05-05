import type {
  EncounterParticipant,
  EncounterSession,
  RoleplayDifficulty,
  RoleplayParticipantDescription,
  RoleplayState,
} from "./session";
import { roleplayStateSchema } from "./session";

export const roleplayDifficultyOptions: Array<{ id: RoleplayDifficulty; label: string }> = [
  { id: "easy", label: "Easy" },
  { id: "medium_minus", label: "Medium -" },
  { id: "medium", label: "Medium" },
  { id: "medium_plus", label: "Medium +" },
  { id: "hard", label: "Hard" },
  { id: "very_hard", label: "Very hard" },
  { id: "critical", label: "Critical" },
  { id: "critical_plus", label: "Critical +" },
  { id: "legendary", label: "Legendary" },
];

export function normalizeRoleplayState(session: EncounterSession): RoleplayState {
  return roleplayStateSchema.parse(session.roleplayState ?? {});
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function withRoleplayState(input: {
  session: EncounterSession;
  state: RoleplayState;
}): EncounterSession {
  return {
    ...input.session,
    roleplayState: roleplayStateSchema.parse(input.state),
    updatedAt: nowIso(),
  };
}

export function updateRoleplayGmMessage(input: {
  message: string;
  session: EncounterSession;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      actionLog: [
        {
          createdAt: nowIso(),
          id: makeId("roleplay-log"),
          silent: true,
          summary: "GM message updated.",
          type: "gm_message_updated",
        },
        ...state.actionLog,
      ],
      gmMessage: input.message,
    },
  });
}

export function updateRoleplayVisibility(input: {
  session: EncounterSession;
  targetParticipantId: string;
  viewerParticipantId: string;
  visible: boolean;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      visibility: {
        ...state.visibility,
        [input.viewerParticipantId]: {
          ...(state.visibility[input.viewerParticipantId] ?? {}),
          [input.targetParticipantId]: input.visible,
        },
      },
    },
  });
}

export function selectAllRoleplayVisibilityForViewer(input: {
  participantIds: string[];
  session: EncounterSession;
  viewerParticipantId: string;
  visible?: boolean;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const row = Object.fromEntries(
    input.participantIds
      .filter((participantId) => participantId !== input.viewerParticipantId)
      .map((participantId) => [participantId, input.visible ?? true])
  );

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      visibility: {
        ...state.visibility,
        [input.viewerParticipantId]: row,
      },
    },
  });
}

export function updateRoleplayParticipantDescription(input: {
  description: RoleplayParticipantDescription;
  participantId: string;
  session: EncounterSession;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      participantDescriptions: {
        ...state.participantDescriptions,
        [input.participantId]: input.description,
      },
    },
  });
}

export function assignRoleplaySkillRoll(input: {
  difficulty: RoleplayDifficulty;
  participantId: string;
  session: EncounterSession;
  silent: boolean;
  skillId: string;
  skillLabel: string;
  skillValue?: number;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const assignedAt = nowIso();

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      actionLog: [
        {
          createdAt: assignedAt,
          difficulty: input.difficulty,
          id: makeId("roleplay-log"),
          participantId: input.participantId,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          summary: `Assigned ${input.skillLabel} roll.`,
          type: "skill_roll_assigned",
        },
        ...state.actionLog,
      ],
      pendingSkillRolls: [
        {
          assignedAt,
          difficulty: input.difficulty,
          id: makeId("roleplay-roll"),
          participantId: input.participantId,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          skillValue: input.skillValue,
        },
        ...state.pendingSkillRolls,
      ],
    },
  });
}

export function recordRoleplayGmSkillRoll(input: {
  calculationText: string;
  difficulty: RoleplayDifficulty;
  participantId: string;
  roll: number;
  session: EncounterSession;
  silent: boolean;
  skillId: string;
  skillLabel: string;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      actionLog: [
        {
          calculationText: input.calculationText,
          createdAt: nowIso(),
          difficulty: input.difficulty,
          id: makeId("roleplay-log"),
          participantId: input.participantId,
          roll: input.roll,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          summary: `GM rolled ${input.skillLabel}.`,
          type: "gm_skill_roll",
        },
        ...state.actionLog,
      ],
    },
  });
}

export function orderRoleplayEncounterParticipants(
  participants: EncounterParticipant[]
): EncounterParticipant[] {
  const order = (participant: EncounterParticipant): number => {
    if (participant.characterId || participant.participantType === "character") {
      return 0;
    }

    if (participant.participantType === "scenario" && participant.id.startsWith("scenario-")) {
      return 1;
    }

    return 2;
  };

  return [...participants].sort(
    (left, right) => order(left) - order(right) || left.label.localeCompare(right.label)
  );
}
