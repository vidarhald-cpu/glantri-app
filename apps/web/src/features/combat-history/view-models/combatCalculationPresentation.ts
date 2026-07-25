import { formatSignedCombatModifier } from "./formatCombatModifier";

export interface CombatRollModifierPresentation {
  readonly label: string;
  readonly value: number;
}

export interface CombatRollCalculationPresentation {
  readonly dieResult: number;
  readonly effectiveSkill: number;
  readonly label: string;
  readonly modifierRows: readonly CombatRollModifierPresentation[];
  readonly modifierTotal: number;
  readonly pendingModifierRows: readonly (CombatRollModifierPresentation & {
    readonly activationLabel?: string;
  })[];
  readonly skillValue: number;
  readonly total: number;
}

export interface CombatContestSidePresentation {
  readonly label: string;
  readonly participantId: string;
  readonly roll?: CombatRollCalculationPresentation;
  readonly total: number;
}

export interface CombatContestCalculationPresentation {
  readonly consequence?: string;
  readonly difference: number;
  readonly initiator: CombatContestSidePresentation;
  readonly responder: CombatContestSidePresentation;
  readonly tieResultLabel?: string;
  readonly winnerParticipantId?: string;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatModifier(value: number): string {
  return value === 0 ? "+0" : formatSignedCombatModifier(value);
}

/**
 * Builds display arithmetic from already-resolved roll facts. It does not recalculate a rule
 * result: the persisted final total remains authoritative.
 */
export function buildCombatRollCalculationPresentation(input: {
  readonly calculation?: Record<string, unknown>;
  readonly label: string;
}): CombatRollCalculationPresentation | undefined {
  const calculation = input.calculation;
  if (!calculation) return undefined;

  const skillValue = finiteNumber(calculation.brawlingBaseValue);
  const dieResult = finiteNumber(calculation.rollTotal);
  const total = finiteNumber(calculation.finalTotal);
  if (skillValue === undefined || dieResult === undefined || total === undefined) {
    return undefined;
  }

  const modifierRows = [
    { label: "Parry quality", value: finiteNumber(calculation.parryQualityModifier) ?? 0 },
    { label: "General", value: finiteNumber(calculation.generalModifier) ?? 0 },
    { label: "Skill", value: finiteNumber(calculation.skillModifier) ?? 0 },
  ].filter((row) => row.value !== 0);
  const explicitModifierTotal = [
    finiteNumber(calculation.parryQualityModifier),
    finiteNumber(calculation.generalModifier),
    finiteNumber(calculation.skillModifier),
  ];
  const modifierTotal = explicitModifierTotal.every((value) => value !== undefined)
    ? explicitModifierTotal.reduce<number>((sum, value) => sum + value!, 0)
    : total - skillValue - dieResult;
  const pendingModifierRows = Array.isArray(calculation.pendingModifiers)
    ? calculation.pendingModifiers.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const value = finiteNumber((row as Record<string, unknown>).value);
        const label = (row as Record<string, unknown>).label;
        const activationLabel = (row as Record<string, unknown>).activationLabel;
        return value !== undefined && typeof label === "string"
          ? [
              {
                ...(typeof activationLabel === "string" ? { activationLabel } : {}),
                label,
                value,
              },
            ]
          : [];
      })
    : [];

  return {
    dieResult,
    effectiveSkill: skillValue + modifierTotal,
    label: input.label,
    modifierRows,
    modifierTotal,
    pendingModifierRows,
    skillValue,
    total,
  };
}

export function buildCombatContestCalculationPresentation(input: {
  readonly consequence?: string;
  readonly initiator: CombatContestSidePresentation;
  readonly responder: CombatContestSidePresentation;
  readonly tieResultLabel?: string;
  readonly winnerParticipantId?: string;
}): CombatContestCalculationPresentation {
  return {
    consequence: input.consequence,
    difference: input.initiator.total - input.responder.total,
    initiator: input.initiator,
    responder: input.responder,
    tieResultLabel: input.tieResultLabel,
    winnerParticipantId: input.winnerParticipantId,
  };
}

function rollLines(
  calculation: CombatRollCalculationPresentation,
  heading: string,
): readonly string[] {
  return [
    heading,
    `Skill: ${calculation.skillValue}`,
    `Modifiers: ${formatModifier(calculation.modifierTotal)}`,
    ...calculation.modifierRows.map((row) => `- ${row.label}: ${formatModifier(row.value)}`),
    ...(calculation.pendingModifierRows.length > 0
      ? [
          "Pending:",
          ...calculation.pendingModifierRows.map(
            (row) =>
              `- ${row.label}: ${formatModifier(row.value)}${row.activationLabel ? ` — ${row.activationLabel}` : ""}`,
          ),
        ]
      : []),
    `Effective skill: ${calculation.effectiveSkill}`,
    `Die roll: ${calculation.dieResult}`,
    `Total: ${calculation.total}`,
  ];
}

function differenceLine(
  presentation: CombatContestCalculationPresentation,
  viewerParticipantId?: string,
): string {
  const signed = formatSignedCombatModifier(presentation.difference);
  if (presentation.difference === 0) return "Difference: 0";
  const favored = presentation.difference > 0 ? presentation.initiator : presentation.responder;
  return viewerParticipantId === favored.participantId
    ? `Difference: ${signed} in your favor`
    : `Difference: ${signed} in favor of ${favored.label}`;
}

function resultLine(
  presentation: CombatContestCalculationPresentation,
  viewerParticipantId?: string,
): string {
  if (!presentation.winnerParticipantId) {
    return `Result: ${presentation.tieResultLabel ?? "Tie — no continued contact established"}`;
  }
  if (viewerParticipantId) {
    return presentation.winnerParticipantId === viewerParticipantId
      ? "Result: You win"
      : "Result: You lose";
  }
  const winner =
    presentation.winnerParticipantId === presentation.initiator.participantId
      ? presentation.initiator
      : presentation.responder;
  return `Result: ${winner.label} wins`;
}

export function formatCombatRollCalculationLines(
  presentation: CombatRollCalculationPresentation,
): readonly string[] {
  return rollLines(presentation, presentation.label);
}

export function formatCombatContestCalculationLines(input: {
  readonly presentation: CombatContestCalculationPresentation;
  readonly viewerParticipantId?: string;
}): readonly string[] {
  const { presentation, viewerParticipantId } = input;
  if (viewerParticipantId) {
    const own =
      presentation.initiator.participantId === viewerParticipantId
        ? presentation.initiator
        : presentation.responder.participantId === viewerParticipantId
          ? presentation.responder
          : undefined;
    const opponent =
      own?.participantId === presentation.initiator.participantId
        ? presentation.responder
        : presentation.initiator;
    return [
      ...(own?.roll ? rollLines(own.roll, "Your roll") : []),
      `Opponent total: ${opponent.total}`,
      differenceLine(presentation, viewerParticipantId),
      resultLine(presentation, viewerParticipantId),
      ...(presentation.consequence ? [`Consequence: ${presentation.consequence}`] : []),
    ];
  }

  return [
    ...(presentation.initiator.roll
      ? rollLines(presentation.initiator.roll, presentation.initiator.label)
      : [`${presentation.initiator.label} total: ${presentation.initiator.total}`]),
    ...(presentation.responder.roll
      ? rollLines(presentation.responder.roll, presentation.responder.label)
      : [`${presentation.responder.label} total: ${presentation.responder.total}`]),
    differenceLine(presentation),
    resultLine(presentation),
    ...(presentation.consequence ? [`Consequence: ${presentation.consequence}`] : []),
  ];
}
