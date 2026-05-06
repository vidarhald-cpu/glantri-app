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
  { id: "trivial_success", label: "Trivial success" },
  { id: "easy", label: "Easy" },
  { id: "medium_minus", label: "Medium -" },
  { id: "medium", label: "Medium" },
  { id: "medium_plus", label: "Medium +" },
  { id: "hard", label: "Hard" },
  { id: "very_hard", label: "Very hard" },
  { id: "critical", label: "Critical" },
  { id: "legendary", label: "Legendary" },
  { id: "godly", label: "Godly" },
];

export type RoleplayRollKind = "skill" | "stat";
export type RoleplaySuccessLevelId =
  | "fumble"
  | "trivial_success"
  | "easy"
  | "medium_minus"
  | "medium"
  | "medium_plus"
  | "hard"
  | "very_hard"
  | "critical"
  | "legendary"
  | "godly";

export interface RoleplaySuccessLevel {
  fumble: boolean;
  id: RoleplaySuccessLevelId;
  label: string;
  rank: number;
  range: string;
  resultModifier: number;
}

export interface RoleplayOpenEndedD20Roll {
  dieResult: number;
  openEndedD10s: number[];
  rollD20: number;
}

const ROLEPLAY_SUCCESS_LEVELS: RoleplaySuccessLevel[] = [
  { fumble: true, id: "fumble", label: "Fumble", rank: 0, range: "Fumble", resultModifier: -2 },
  { fumble: false, id: "trivial_success", label: "Trivial success", rank: 1, range: "Trivial success", resultModifier: 0 },
  { fumble: false, id: "easy", label: "Easy", rank: 2, range: "Easy", resultModifier: 0 },
  { fumble: false, id: "medium_minus", label: "Medium -", rank: 3, range: "Medium -", resultModifier: 0 },
  { fumble: false, id: "medium", label: "Medium", rank: 4, range: "Medium", resultModifier: 0 },
  { fumble: false, id: "medium_plus", label: "Medium +", rank: 5, range: "Medium +", resultModifier: 1 },
  { fumble: false, id: "hard", label: "Hard", rank: 6, range: "Hard", resultModifier: 1 },
  { fumble: false, id: "very_hard", label: "Very hard", rank: 7, range: "Very hard", resultModifier: 2 },
  { fumble: false, id: "critical", label: "Critical", rank: 8, range: "Critical", resultModifier: 2 },
  { fumble: false, id: "legendary", label: "Legendary", rank: 9, range: "Legendary", resultModifier: 3 },
  { fumble: false, id: "godly", label: "Godly", rank: 10, range: "Godly", resultModifier: 3 },
];

const SUCCESS_LEVEL_BY_ID = new Map(ROLEPLAY_SUCCESS_LEVELS.map((level) => [level.id, level]));
const SKILL_REQUIRED_LOWER_THRESHOLD: Record<RoleplayDifficulty, number> = {
  trivial_success: 11,
  easy: 16,
  medium_minus: 21,
  medium: 26,
  medium_plus: 31,
  hard: 36,
  very_hard: 41,
  critical: 46,
  legendary: 51,
  godly: 56,
};
const STAT_REQUIRED_LOWER_THRESHOLD: Record<RoleplayDifficulty, number> = {
  trivial_success: 6,
  easy: 11,
  medium_minus: 16,
  medium: 21,
  medium_plus: 26,
  hard: 31,
  very_hard: 36,
  critical: 41,
  legendary: 46,
  godly: 51,
};

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
  achievedSuccessLevel?: RoleplaySuccessLevel;
  autoSuccess: boolean;
  calculationText: string;
  compactCalculationText: string;
  difficultyText?: string;
  dieText: string;
  finalTotal?: number;
  fumble: boolean;
  hasPlaceholderMods: boolean;
  numericModifierParts: number[];
  numericModifierSum: number;
  numericSubtotal?: number;
  partial: boolean;
  pendingModifierLabels: string[];
  success?: boolean;
}

export interface RoleplayOpposedResult {
  margin: number;
  result: "win" | "loss" | "tie";
  summary: string;
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

function getSuccessLevelFromTotal(input: {
  finalTotal: number;
  initialD20?: number;
  kind: RoleplayRollKind;
}): RoleplaySuccessLevel {
  if (input.initialD20 === 1) {
    return ROLEPLAY_SUCCESS_LEVELS[0]!;
  }

  const total = input.finalTotal;

  if (input.kind === "stat") {
    if (total <= 5) return ROLEPLAY_SUCCESS_LEVELS[0]!;
    if (total <= 10) return ROLEPLAY_SUCCESS_LEVELS[1]!;
    if (total <= 15) return ROLEPLAY_SUCCESS_LEVELS[2]!;
    if (total <= 20) return ROLEPLAY_SUCCESS_LEVELS[3]!;
    if (total <= 25) return ROLEPLAY_SUCCESS_LEVELS[4]!;
    if (total <= 30) return ROLEPLAY_SUCCESS_LEVELS[5]!;
    if (total <= 35) return ROLEPLAY_SUCCESS_LEVELS[6]!;
    if (total <= 40) return ROLEPLAY_SUCCESS_LEVELS[7]!;
    if (total <= 45) return ROLEPLAY_SUCCESS_LEVELS[8]!;
    if (total <= 50) return ROLEPLAY_SUCCESS_LEVELS[9]!;
    return ROLEPLAY_SUCCESS_LEVELS[10]!;
  }

  if (total <= 10) return ROLEPLAY_SUCCESS_LEVELS[0]!;
  if (total <= 15) return ROLEPLAY_SUCCESS_LEVELS[1]!;
  if (total <= 20) return ROLEPLAY_SUCCESS_LEVELS[2]!;
  if (total <= 25) return ROLEPLAY_SUCCESS_LEVELS[3]!;
  if (total <= 30) return ROLEPLAY_SUCCESS_LEVELS[4]!;
  if (total <= 35) return ROLEPLAY_SUCCESS_LEVELS[5]!;
  if (total <= 40) return ROLEPLAY_SUCCESS_LEVELS[6]!;
  if (total <= 45) return ROLEPLAY_SUCCESS_LEVELS[7]!;
  if (total <= 50) return ROLEPLAY_SUCCESS_LEVELS[8]!;
  if (total <= 55) return ROLEPLAY_SUCCESS_LEVELS[9]!;
  return ROLEPLAY_SUCCESS_LEVELS[10]!;
}

export function getSkillRollSuccessLevel(
  finalTotal: number,
  initialD20?: number
): RoleplaySuccessLevel {
  return getSuccessLevelFromTotal({ finalTotal, initialD20, kind: "skill" });
}

export function getStatRollSuccessLevel(
  finalTotal: number,
  initialD20?: number
): RoleplaySuccessLevel {
  return getSuccessLevelFromTotal({ finalTotal, initialD20, kind: "stat" });
}

export function getRoleplayRequiredLowerThreshold(
  difficulty: RoleplayDifficulty,
  kind: RoleplayRollKind = "skill"
): number {
  return kind === "stat"
    ? STAT_REQUIRED_LOWER_THRESHOLD[difficulty]
    : SKILL_REQUIRED_LOWER_THRESHOLD[difficulty];
}

function formatRoleplayDieRoll(roll: RoleplayOpenEndedD20Roll): string {
  if (roll.openEndedD10s.length === 0) {
    return String(roll.rollD20);
  }

  const separator = roll.rollD20 === 1 ? "-" : "+";
  return `${roll.rollD20}${separator}${roll.openEndedD10s.join(separator)}`;
}

function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatNumericModifierParts(parts: number[]): string {
  return parts.length === 0 ? "" : parts.map(formatSignedNumber).join(" ");
}

export function buildRoleplayCalculationPreview(input: {
  difficulty?: RoleplayDifficulty;
  kind?: RoleplayRollKind;
  roll?: RoleplayOpenEndedD20Roll;
  skillLabel: string;
  skillValue?: number;
} & RoleplayRollModifiers): RoleplayCalculationPreview {
  const modifiers = normalizeRollModifiers(input);
  const kind = input.kind ?? "skill";
  const skillValue = input.skillValue ?? 0;
  const effectiveValue = skillValue + modifiers.otherMod;
  const parts = [`${input.skillLabel} ${skillValue}`];
  const numericModifierParts = modifiers.otherMod === 0 ? [] : [modifiers.otherMod];
  const numericModifierSum = numericModifierParts.reduce((sum, value) => sum + value, 0);
  const dieText = input.roll == null ? "<die>" : String(input.roll.dieResult);
  const pendingModifierLabels = [
    modifiers.useGenMod ? "Gen" : undefined,
    modifiers.useObSkillMod ? "OB/Skill" : undefined,
    modifiers.useDbMod ? "DB" : undefined,
  ].filter((label): label is string => Boolean(label));

  if (input.roll == null) {
    parts.push("<DIE ROLL>");
  } else {
    parts.push(`roll ${formatRoleplayDieRoll(input.roll)}`);
  }

  if (modifiers.otherMod !== 0) {
    parts.push(`Other ${modifiers.otherMod > 0 ? "+" : ""}${modifiers.otherMod}`);
  }

  const hasPlaceholderMods =
    modifiers.useGenMod || modifiers.useObSkillMod || modifiers.useDbMod;
  const numericSubtotal =
    input.roll == null ? undefined : skillValue + input.roll.dieResult + modifiers.otherMod;
  const achievedSuccessLevel =
    numericSubtotal == null
      ? undefined
      : getSuccessLevelFromTotal({
          finalTotal: numericSubtotal,
          initialD20: input.roll?.rollD20,
          kind,
        });
  const success =
    achievedSuccessLevel && input.difficulty
      ? !achievedSuccessLevel.fumble &&
        achievedSuccessLevel.rank >= (SUCCESS_LEVEL_BY_ID.get(input.difficulty)?.rank ?? 0)
      : undefined;
  const autoSuccess =
    input.roll == null &&
    input.difficulty != null &&
    effectiveValue >= getRoleplayRequiredLowerThreshold(input.difficulty, kind) + 5;
  const calculationText =
    autoSuccess
      ? `${parts.join(" + ")} = pending vs ${formatRoleplayDifficulty(input.difficulty!)} · Automatic success — no roll needed`
      : numericSubtotal == null
      ? `${parts.join(" + ")} = pending${input.difficulty ? ` vs ${formatRoleplayDifficulty(input.difficulty)}` : ""}`
      : [
          `${parts.join(" + ")} = ${numericSubtotal}`,
          achievedSuccessLevel?.fumble
            ? "FUMBLE — automatic fail"
            : achievedSuccessLevel
              ? `${achievedSuccessLevel.label}, modifier ${achievedSuccessLevel.resultModifier >= 0 ? "+" : ""}${achievedSuccessLevel.resultModifier}`
              : undefined,
          success == null ? undefined : success ? `SUCCESS vs ${formatRoleplayDifficulty(input.difficulty!)}` : `NOT SUCCESSFUL vs ${formatRoleplayDifficulty(input.difficulty!)}`,
        ]
          .filter(Boolean)
          .join(" → ");
  const compactModifierBracket =
    numericModifierParts.length === 0 ? "[ ]" : `[ ${formatNumericModifierParts(numericModifierParts)} ]`;
  const compactBase = `${input.skillLabel} ${skillValue} + ${compactModifierBracket} ${numericModifierSum} + ${dieText}`;
  const compactCalculationText =
    autoSuccess
      ? `${compactBase} = pending vs ${formatRoleplayDifficulty(input.difficulty!)} · Automatic success`
      : numericSubtotal == null
      ? `${compactBase} = pending${input.difficulty ? ` vs ${formatRoleplayDifficulty(input.difficulty)}` : ""}`
      : [
          `${compactBase} = ${numericSubtotal}`,
          achievedSuccessLevel?.fumble
            ? "FUMBLE"
            : achievedSuccessLevel
              ? achievedSuccessLevel.label
              : undefined,
          success == null ? undefined : success ? `SUCCESS vs ${formatRoleplayDifficulty(input.difficulty!)}` : `NOT SUCCESSFUL vs ${formatRoleplayDifficulty(input.difficulty!)}`,
        ]
          .filter(Boolean)
          .join(" · ");

  return {
    achievedSuccessLevel,
    autoSuccess,
    calculationText,
    compactCalculationText,
    dieText,
    finalTotal: numericSubtotal,
    fumble: Boolean(achievedSuccessLevel?.fumble),
    hasPlaceholderMods,
    numericModifierParts,
    numericModifierSum,
    numericSubtotal,
    partial: hasPlaceholderMods,
    pendingModifierLabels,
    success,
  };
}

export function compareRoleplayOpposedRolls(input: {
  actorLabel: string;
  actorPreview: RoleplayCalculationPreview;
  opponentLabel: string;
  opponentPreview: RoleplayCalculationPreview;
}): RoleplayOpposedResult {
  const actorTotal = input.actorPreview.numericSubtotal;
  const opponentTotal = input.opponentPreview.numericSubtotal;

  if (actorTotal == null || opponentTotal == null) {
    return { margin: 0, result: "tie", summary: "Opposed result pending." };
  }

  if (input.actorPreview.fumble && !input.opponentPreview.fumble) {
    return {
      margin: Math.abs(actorTotal - opponentTotal),
      result: "loss",
      summary: `${input.opponentLabel} wins; ${input.actorLabel} fumbled.`,
    };
  }

  if (input.opponentPreview.fumble && !input.actorPreview.fumble) {
    return {
      margin: Math.abs(actorTotal - opponentTotal),
      result: "win",
      summary: `${input.actorLabel} wins; ${input.opponentLabel} fumbled.`,
    };
  }

  if (input.actorPreview.fumble && input.opponentPreview.fumble) {
    return { margin: 0, result: "tie", summary: "Both sides fumbled; tied result." };
  }

  if (actorTotal > opponentTotal) {
    return {
      margin: actorTotal - opponentTotal,
      result: "win",
      summary: `${input.actorLabel} wins by ${actorTotal - opponentTotal}.`,
    };
  }

  if (opponentTotal > actorTotal) {
    return {
      margin: opponentTotal - actorTotal,
      result: "loss",
      summary: `${input.opponentLabel} wins by ${opponentTotal - actorTotal}.`,
    };
  }

  return { margin: 0, result: "tie", summary: "Tie." };
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
  session: EncounterSession;
  silent: boolean;
  skillId: string;
  skillLabel: string;
  skillValue?: number;
  supportSkillId?: string;
  supportSkillLabel?: string;
} & RoleplayRollModifiers): EncounterSession {
  const state = normalizeRoleplayState(input.session);
  const assignedAt = nowIso();
  const modifiers = normalizeRollModifiers(input);
  const mode = input.mode ?? "difficulty";
  const rollSetId = makeId("roleplay-roll-set");

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
          participantId: input.participantId,
          rollSetId,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          summary:
            mode === "opposed" && input.opponentSkillLabel
              ? `Assigned opposed ${input.skillLabel} vs ${input.opponentSkillLabel} roll.`
              : `Assigned ${input.skillLabel} roll.`,
          supportSkillId: input.supportSkillId,
          supportSkillLabel: input.supportSkillLabel,
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
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          skillValue: input.skillValue,
          supportSkillId: input.supportSkillId,
          supportSkillLabel: input.supportSkillLabel,
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
  participantId: string;
  partial?: boolean;
  roll: RoleplayOpenEndedD20Roll;
  rollSetId?: string;
  session: EncounterSession;
  silent: boolean;
  skillId: string;
  skillLabel: string;
  numericSubtotal?: number;
  success?: boolean;
  supportSkillId?: string;
  supportSkillLabel?: string;
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
          participantId: input.participantId,
          resultModifier: achievedSuccessLevel?.resultModifier,
          roll: input.roll.rollD20,
          rollD20: input.roll.rollD20,
          rollSetId: input.rollSetId,
          silent: input.silent,
          skillId: input.skillId,
          skillLabel: input.skillLabel,
          success: input.success,
          summary:
            mode === "opposed" && input.opponentSkillLabel
              ? `GM rolled opposed ${input.skillLabel} vs ${input.opponentSkillLabel}.`
              : `GM rolled ${input.skillLabel}.`,
          supportSkillId: input.supportSkillId,
          supportSkillLabel: input.supportSkillLabel,
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
        Number(Boolean(left.fumble)) - Number(Boolean(right.fumble)) ||
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
