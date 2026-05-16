import type {
  EncounterSession,
  RoleplayDifficulty,
  RoleplayOpenEndedD20Roll,
  RoleplayParticipantDescription,
  RoleplayRollModifiers,
  RoleplayState,
  RoleplaySuccessLevel,
} from "@glantri/domain";
import { normalizeRoleplayState, normalizeRollModifiers, roleplayStateSchema } from "@glantri/domain";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollOpenEndedRoleplayD20(rng: () => number = Math.random): RoleplayOpenEndedD20Roll {
  const rollD20 = rollDie(20, rng);
  const openEndedD10s: number[] = [];
  let dieResult = rollD20;

  if (rollD20 === 20 || rollD20 === 1) {
    const direction = rollD20 === 20 ? 1 : -1;
    let keepRolling = true;

    while (keepRolling) {
      const d10 = rollDie(10, rng);
      openEndedD10s.push(d10);
      dieResult += direction * d10;
      keepRolling = d10 === 10;
    }
  }

  return { dieResult, openEndedD10s, rollD20 };
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
          autoSuccess: false,
          createdAt: nowIso(),
          fumble: false,
          id: makeId("roleplay-log"),
          mode: "difficulty",
          openEndedD10s: [],
          opponentFumble: false,
          opponentOpenEndedD10s: [],
          opponentSilent: false,
          partial: false,
          silent: true,
          summary: "GM message updated.",
          supportOpenEndedD10s: [],
          type: "gm_message_updated",
        },
        ...state.actionLog,
      ],
      gmMessage: input.message,
    },
  });
}

export function resetRoleplayRankedRollStack(input: {
  rollSetId: string;
  session: EncounterSession;
}): EncounterSession {
  const state = normalizeRoleplayState(input.session);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      currentRankedRollStackId: input.rollSetId,
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
  difficulty?: RoleplayDifficulty;
  mode?: "difficulty" | "opposed";
  opponentParticipantId?: string;
  opponentParticipantName?: string;
  opponentSkillId?: string;
  opponentSkillLabel?: string;
  opponentSkillValue?: number;
  opponentSilent?: boolean;
  opponentSupportSkillId?: string;
  opponentSupportSkillLabel?: string;
  participantId: string;
  participantName?: string;
  rollSetId?: string;
  session: EncounterSession;
  side?: "actor" | "opponent";
  silent: boolean;
  skillId: string;
  skillLabel: string;
  skillValue?: number;
  supportSkillId?: string;
  supportSkillLabel?: string;
  supportSkillValue?: number;
} & RoleplayRollModifiers): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const assignedAt = nowIso();
  const modifiers = normalizeRollModifiers(input);
  const mode = input.mode ?? "difficulty";
  const rollSetId = input.rollSetId ?? makeId("roleplay-roll-set");
  const pendingRollId = makeId("roleplay-roll");
  const side = input.side ?? (mode === "opposed" ? "actor" : undefined);

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      actionLog: [
        {
          autoSuccess: false,
          createdAt: assignedAt,
          difficulty: input.difficulty,
          fumble: false,
          id: makeId("roleplay-log"),
          mode,
          openEndedD10s: [],
          opponentFumble: false,
          opponentOpenEndedD10s: [],
          opponentParticipantId: input.opponentParticipantId,
          opponentParticipantName: input.opponentParticipantName,
          opponentSilent: Boolean(input.opponentSilent),
          opponentSkillId: input.opponentSkillId,
          opponentSkillLabel: input.opponentSkillLabel,
          opponentSupportSkillId: input.opponentSupportSkillId,
          opponentSupportSkillLabel: input.opponentSupportSkillLabel,
          otherMod: modifiers.otherMod,
          partial: false,
          pendingRollId,
          participantId: input.participantId,
          participantName: input.participantName,
          rollSetId,
          side,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          summary:
            mode === "opposed" && input.opponentSkillLabel
              ? `Assigned opposed ${input.skillLabel} vs ${input.opponentSkillLabel} roll.`
              : `Assigned ${input.skillLabel} roll.`,
          supportSkillId: input.supportSkillId,
          supportSkillLabel: input.supportSkillLabel,
          supportSkillValue: input.supportSkillValue,
          supportOpenEndedD10s: [],
          type: "skill_roll_assigned",
          useDbMod: modifiers.useDbMod,
          useGenMod: modifiers.useGenMod,
          useObSkillMod: modifiers.useObSkillMod,
        },
        ...state.actionLog,
      ],
      currentRankedRollStackId: mode === "opposed" ? state.currentRankedRollStackId : rollSetId,
      pendingSkillRolls: [
        {
          assignedAt,
          difficulty: input.difficulty,
          id: pendingRollId,
          mode,
          opponentParticipantId: input.opponentParticipantId,
          opponentParticipantName: input.opponentParticipantName,
          opponentSilent: Boolean(input.opponentSilent),
          opponentSkillId: input.opponentSkillId,
          opponentSkillLabel: input.opponentSkillLabel,
          opponentSkillValue: input.opponentSkillValue,
          opponentSupportSkillId: input.opponentSupportSkillId,
          opponentSupportSkillLabel: input.opponentSupportSkillLabel,
          otherMod: modifiers.otherMod,
          participantId: input.participantId,
          rollSetId,
          side,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          skillValue: input.skillValue,
          supportSkillId: input.supportSkillId,
          supportSkillLabel: input.supportSkillLabel,
          supportSkillValue: input.supportSkillValue,
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
  achievedSuccessLevel?: RoleplaySuccessLevel;
  autoSuccess?: boolean;
  calculationText: string;
  dieResult?: number;
  difficulty?: RoleplayDifficulty;
  finalTotal?: number;
  fumble?: boolean;
  mode?: "difficulty" | "opposed";
  openEndedD10s?: number[];
  opposedMargin?: number;
  opposedResult?: "win" | "loss" | "tie" | "pending";
  opponentAchievedSuccessLevel?: RoleplaySuccessLevel;
  opponentCalculationText?: string;
  opponentDieResult?: number;
  opponentFumble?: boolean;
  opponentNumericSubtotal?: number;
  opponentOpenEndedD10s?: number[];
  opponentParticipantId?: string;
  opponentParticipantName?: string;
  opponentRoll?: RoleplayOpenEndedD20Roll;
  opponentSilent?: boolean;
  opponentSkillId?: string;
  opponentSkillLabel?: string;
  opponentSupportSkillId?: string;
  opponentSupportSkillLabel?: string;
  pendingRollId?: string;
  participantId: string;
  partial?: boolean;
  roll: RoleplayOpenEndedD20Roll;
  rollSetId?: string;
  session: EncounterSession;
  side?: "actor" | "opponent";
  silent: boolean;
  skillId: string;
  skillLabel: string;
  skillValue?: number;
  numericSubtotal?: number;
  participantName?: string;
  success?: boolean;
  supportCalculationText?: string;
  supportNumericSubtotal?: number;
  supportRoll?: RoleplayOpenEndedD20Roll;
  supportSkillId?: string;
  supportSkillLabel?: string;
  supportSkillValue?: number;
  summary?: string;
} & RoleplayRollModifiers): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const modifiers = normalizeRollModifiers(input);
  const achievedSuccessLevel = input.achievedSuccessLevel;
  const mode = input.mode ?? "difficulty";
  const opponentRoll = input.opponentRoll;

  return withRoleplayState({
    session: input.session,
    state: {
      ...state,
      actionLog: [
        {
          achievedSuccessLevelId: achievedSuccessLevel?.id,
          achievedSuccessLevelLabel: achievedSuccessLevel?.label,
          autoSuccess: Boolean(input.autoSuccess),
          calculationText: input.calculationText,
          createdAt: nowIso(),
          dieResult: input.dieResult ?? input.roll.dieResult,
          difficulty: input.difficulty,
          finalTotal: input.finalTotal ?? input.numericSubtotal,
          fumble: Boolean(input.fumble),
          id: makeId("roleplay-log"),
          mode,
          numericSubtotal: input.numericSubtotal,
          openEndedD10s: input.openEndedD10s ?? input.roll.openEndedD10s,
          opposedMargin: input.opposedMargin,
          opposedResult: input.opposedResult,
          opponentAchievedSuccessLevelLabel: input.opponentAchievedSuccessLevel?.label,
          opponentDieResult: input.opponentDieResult ?? opponentRoll?.dieResult,
          opponentFumble: Boolean(input.opponentFumble),
          opponentNumericSubtotal: input.opponentNumericSubtotal,
          opponentOpenEndedD10s: input.opponentOpenEndedD10s ?? opponentRoll?.openEndedD10s ?? [],
          opponentParticipantId: input.opponentParticipantId,
          opponentParticipantName: input.opponentParticipantName,
          opponentRollD20: opponentRoll?.rollD20,
          opponentSilent: Boolean(input.opponentSilent),
          opponentSkillId: input.opponentSkillId,
          opponentSkillLabel: input.opponentSkillLabel,
          opponentSupportSkillId: input.opponentSupportSkillId,
          opponentSupportSkillLabel: input.opponentSupportSkillLabel,
          otherMod: modifiers.otherMod,
          partial: Boolean(input.partial),
          pendingRollId: input.pendingRollId,
          participantId: input.participantId,
          participantName: input.participantName,
          resultModifier: achievedSuccessLevel?.resultModifier,
          roll: input.roll.rollD20,
          rollD20: input.roll.rollD20,
          rollSetId: input.rollSetId,
          side: input.side,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          skillValue: input.skillValue,
          success: input.success,
          summary: input.summary ?? (
            mode === "opposed" && input.opponentSkillLabel
              ? `GM rolled opposed ${input.skillLabel} vs ${input.opponentSkillLabel}.`
              : input.participantName
                ? `GM rolled ${input.skillLabel} for ${input.participantName}.`
                : `GM rolled ${input.skillLabel}.`
          ),
          supportCalculationText: input.supportCalculationText,
          supportDieResult: input.supportRoll?.dieResult,
          supportNumericSubtotal: input.supportNumericSubtotal,
          supportOpenEndedD10s: input.supportRoll?.openEndedD10s ?? [],
          supportRollD20: input.supportRoll?.rollD20,
          supportSkillId: input.supportSkillId,
          supportSkillLabel: input.supportSkillLabel,
          supportSkillValue: input.supportSkillValue,
          type: "gm_skill_roll",
          useDbMod: modifiers.useDbMod,
          useGenMod: modifiers.useGenMod,
          useObSkillMod: modifiers.useObSkillMod,
        },
        ...state.actionLog,
      ],
      currentRankedRollStackId:
        mode === "opposed" || !input.rollSetId ? state.currentRankedRollStackId : input.rollSetId,
    },
  });
}
