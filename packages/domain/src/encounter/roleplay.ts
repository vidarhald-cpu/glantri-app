import type {
  EncounterParticipant,
  EncounterSession,
  RoleplayActionLogEntry,
  RoleplayDifficulty,
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

export interface RoleplayRollModifiers {
  otherMod?: number;
  useDbMod?: boolean;
  useGenMod?: boolean;
  useObSkillMod?: boolean;
}

export interface RoleplayAppliedRollModifier {
  bucket: "general" | "obSkill" | "db" | "other";
  label: string;
  notes?: string;
  source: "manual" | "characterState" | "situationMap" | "equipment" | "gmOverride";
  value: number;
}

export interface RoleplayRollModifierPipeline {
  appliedModifiers: RoleplayAppliedRollModifier[];
  percentageModifier: number;
  rawModifierSum: number;
  warnings: string[];
}

export interface RoleplayCalculationPreview {
  achievedSuccessLevel?: RoleplaySuccessLevel;
  autoSuccess: boolean;
  calculationText: string;
  compactCalculationText: string;
  difficultyText?: string;
  dieText: string;
  finalTotal?: number;
  formulaText: string;
  fumble: boolean;
  hasPlaceholderMods: boolean;
  modifierWarnings: string[];
  numericModifierParts: number[];
  numericModifierSum: number;
  numericSubtotal?: number;
  partial: boolean;
  pendingModifierLabels: string[];
  percentageModifier: number;
  rawModifierSum: number;
  resultText?: string;
  success?: boolean;
}

export interface RoleplayOpposedResult {
  margin: number;
  result: "win" | "loss" | "tie";
  summary: string;
}

export function normalizeRollModifiers(input: RoleplayRollModifiers | undefined): Required<RoleplayRollModifiers> {
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

function formatSignedTerm(value: number): string {
  return `${value >= 0 ? "+" : "-"} ${Math.abs(value)}`;
}

function formatNumericModifierParts(parts: number[]): string {
  return parts.length === 0 ? "" : parts.map(formatSignedNumber).join(" ");
}

function buildFallbackModifierPipeline(otherMod: number): RoleplayRollModifierPipeline {
  return {
    appliedModifiers:
      otherMod === 0
        ? []
        : [{ bucket: "other", label: "Other", source: "manual", value: otherMod }],
    percentageModifier: otherMod,
    rawModifierSum: otherMod,
    warnings: [],
  };
}

export function buildRoleplayCalculationPreview(input: {
  difficulty?: RoleplayDifficulty;
  kind?: RoleplayRollKind;
  modifierPipeline?: RoleplayRollModifierPipeline;
  roll?: RoleplayOpenEndedD20Roll;
  skillLabel: string;
  skillValue?: number;
} & RoleplayRollModifiers): RoleplayCalculationPreview {
  const modifiers = normalizeRollModifiers(input);
  const kind = input.kind ?? "skill";
  const skillValue = input.skillValue ?? 0;
  const modifierPipeline = input.modifierPipeline ?? buildFallbackModifierPipeline(modifiers.otherMod);
  const percentageModifier = modifierPipeline.percentageModifier;
  const rawModifierSum = modifierPipeline.rawModifierSum;
  const effectiveValue = skillValue + percentageModifier;
  const parts = [`${input.skillLabel} ${skillValue}`];
  const numericModifierParts = modifierPipeline.appliedModifiers
    .map((modifier) => modifier.value)
    .filter((value) => value !== 0);
  const numericModifierSum = rawModifierSum;
  const dieText = input.roll == null ? "+ 1d20" : formatSignedTerm(input.roll.dieResult);
  const pendingModifierLabels = [
    modifiers.useGenMod ? "Gen" : undefined,
    modifiers.useObSkillMod ? "OB/Skill" : undefined,
    modifiers.useDbMod ? "DB" : undefined,
  ].filter((label): label is string => Boolean(label));

  if (rawModifierSum !== 0) {
    parts.push(`Raw modifiers ${formatSignedNumber(rawModifierSum)} => ${formatSignedNumber(percentageModifier)}`);
  }

  if (input.roll == null) {
    parts.push("1d20");
  } else {
    parts.push(`roll ${formatRoleplayDieRoll(input.roll)}`);
  }

  const hasPlaceholderMods =
    modifiers.useGenMod || modifiers.useObSkillMod || modifiers.useDbMod;
  const numericSubtotal =
    input.roll == null ? undefined : skillValue + input.roll.dieResult + percentageModifier;
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
  const compactBase = `${input.skillLabel} ${skillValue} + ${compactModifierBracket} ${percentageModifier} ${dieText}`;
  const formulaText = numericSubtotal == null
    ? `${compactBase} = pending`
    : `${compactBase} = ${numericSubtotal}`;
  const resultText =
    autoSuccess
      ? `Automatic success vs ${formatRoleplayDifficulty(input.difficulty!)}`
      : achievedSuccessLevel?.fumble
        ? [
            "FUMBLE",
            success == null ? undefined : `NOT SUCCESSFUL vs ${formatRoleplayDifficulty(input.difficulty!)}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : achievedSuccessLevel
          ? [
              achievedSuccessLevel.label,
              `modifier ${formatSignedNumber(achievedSuccessLevel.resultModifier)}`,
              success == null
                ? undefined
                : success
                  ? `SUCCESS vs ${formatRoleplayDifficulty(input.difficulty!)}`
                  : `NOT SUCCESSFUL vs ${formatRoleplayDifficulty(input.difficulty!)}`,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined;
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
    formulaText,
    fumble: Boolean(achievedSuccessLevel?.fumble),
    hasPlaceholderMods,
    modifierWarnings: modifierPipeline.warnings,
    numericModifierParts,
    numericModifierSum,
    numericSubtotal,
    partial: hasPlaceholderMods,
    pendingModifierLabels,
    percentageModifier,
    rawModifierSum,
    resultText,
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

export function rankRoleplayGmRollResults(
  state: RoleplayState
): RoleplayActionLogEntry[] {
  return state.actionLog
    .filter(
      (entry) =>
        entry.type === "gm_skill_roll" &&
        entry.mode !== "opposed" &&
        !entry.side &&
        entry.numericSubtotal != null
    )
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
