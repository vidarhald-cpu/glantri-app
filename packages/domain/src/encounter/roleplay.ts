import type {
  EncounterParticipant,
  EncounterSession,
  RoleplayActionLogEntry,
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

export interface RoleplayRollModifiers {
  otherMod?: number;
  useDbMod?: boolean;
  useGenMod?: boolean;
  useObSkillMod?: boolean;
}

export interface RoleplayCalculationPreview {
  calculationText: string;
  difficultyText?: string;
  hasPlaceholderMods: boolean;
  numericSubtotal?: number;
}

function normalizeRollModifiers(input: RoleplayRollModifiers | undefined): Required<RoleplayRollModifiers> {
  return {
    otherMod: normalizeRoleplayOtherMod(input?.otherMod),
    useDbMod: Boolean(input?.useDbMod),
    useGenMod: Boolean(input?.useGenMod),
    useObSkillMod: Boolean(input?.useObSkillMod),
  };
}

export function normalizeRoleplayOtherMod(value: unknown): number {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.trunc(numeric);
}

export function buildRoleplayCalculationPreview(input: {
  difficulty?: RoleplayDifficulty;
  roll?: number;
  skillLabel: string;
  skillValue?: number;
} & RoleplayRollModifiers): RoleplayCalculationPreview {
  const modifiers = normalizeRollModifiers(input);
  const skillValue = input.skillValue ?? 0;
  const parts = [`${input.skillLabel} ${skillValue}`];

  if (input.roll == null) {
    parts.push("<DIE ROLL>");
  } else {
    parts.push(`roll ${input.roll}`);
  }

  if (modifiers.useGenMod) {
    parts.push("Gen mod");
  }

  if (modifiers.useObSkillMod) {
    parts.push("OB/Skill mod");
  }

  if (modifiers.useDbMod) {
    parts.push("DB mod");
  }

  if (modifiers.otherMod !== 0) {
    parts.push(`Other ${modifiers.otherMod > 0 ? "+" : ""}${modifiers.otherMod}`);
  }

  const hasPlaceholderMods =
    modifiers.useGenMod || modifiers.useObSkillMod || modifiers.useDbMod;
  const numericSubtotal =
    input.roll == null ? undefined : skillValue + input.roll + modifiers.otherMod;
  const calculationText =
    numericSubtotal == null
      ? `${parts.join(" + ")} = pending`
      : hasPlaceholderMods
        ? `${parts.join(" + ")} = ${numericSubtotal} before placeholder mods`
        : `${parts.join(" + ")} = ${numericSubtotal}`;
  const difficultyText = input.difficulty
    ? `Difficulty: ${formatRoleplayDifficulty(input.difficulty)} · Result: calculation pending difficulty rules`
    : undefined;

  return {
    calculationText,
    difficultyText,
    hasPlaceholderMods,
    numericSubtotal,
  };
}

export function assignRoleplaySkillRoll(input: {
  difficulty: RoleplayDifficulty;
  participantId: string;
  session: EncounterSession;
  silent: boolean;
  skillId: string;
  skillLabel: string;
  skillValue?: number;
} & RoleplayRollModifiers): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const assignedAt = nowIso();
  const modifiers = normalizeRollModifiers(input);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      actionLog: [
        {
          createdAt: assignedAt,
          difficulty: input.difficulty,
          id: makeId("roleplay-log"),
          otherMod: modifiers.otherMod,
          participantId: input.participantId,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          summary: `Assigned ${input.skillLabel} roll.`,
          type: "skill_roll_assigned",
          useDbMod: modifiers.useDbMod,
          useGenMod: modifiers.useGenMod,
          useObSkillMod: modifiers.useObSkillMod,
        },
        ...state.actionLog,
      ],
      pendingSkillRolls: [
        {
          assignedAt,
          difficulty: input.difficulty,
          id: makeId("roleplay-roll"),
          otherMod: modifiers.otherMod,
          participantId: input.participantId,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          skillValue: input.skillValue,
          useDbMod: modifiers.useDbMod,
          useGenMod: modifiers.useGenMod,
          useObSkillMod: modifiers.useObSkillMod,
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
  numericSubtotal?: number;
} & RoleplayRollModifiers): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const modifiers = normalizeRollModifiers(input);

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
          numericSubtotal: input.numericSubtotal,
          otherMod: modifiers.otherMod,
          participantId: input.participantId,
          roll: input.roll,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          summary: `GM rolled ${input.skillLabel}.`,
          type: "gm_skill_roll",
          useDbMod: modifiers.useDbMod,
          useGenMod: modifiers.useGenMod,
          useObSkillMod: modifiers.useObSkillMod,
        },
        ...state.actionLog,
      ],
    },
  });
}

export function rankRoleplayGmRollResults(
  state: RoleplayState
): RoleplayActionLogEntry[] {
  return state.actionLog
    .filter((entry) => entry.type === "gm_skill_roll" && entry.numericSubtotal != null)
    .sort(
      (left, right) =>
        (right.numericSubtotal ?? Number.NEGATIVE_INFINITY) -
          (left.numericSubtotal ?? Number.NEGATIVE_INFINITY) ||
        right.createdAt.localeCompare(left.createdAt)
    );
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

function formatRoleplayDifficulty(value: RoleplayDifficulty): string {
  return roleplayDifficultyOptions.find((option) => option.id === value)?.label ?? value;
}
