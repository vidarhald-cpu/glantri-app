import { formatSignedCombatModifier } from "./formatCombatModifier";

export type CombatCalculationVisibility = "gm_full" | "own" | "shared";
export type CombatCalculationCompleteness = "complete" | "partial" | "legacy_incomplete";
export type CombatCalculationUnit = "points" | "percent";
export type CombatCalculationType =
  | "adjust_distance_roll"
  | "attack"
  | "combat_experience"
  | "continued_contact_maintenance"
  | "critical"
  | "damage"
  | "damage_proposed"
  | "distance_control_roll"
  | "dodge"
  | "feint"
  | "health_check"
  | "hit_location"
  | "initiative"
  | "observe_opponent"
  | "offensive_parry_brawling"
  | "parry";

export interface CombatCalculationSubject {
  readonly label: string;
  readonly participantId?: string;
}

export interface CombatCalculationLabeledValue {
  readonly label: string;
  readonly value: number;
}

export interface CombatCalculationModifier extends CombatCalculationLabeledValue {
  readonly id: string;
  readonly provenance?: string;
  readonly scope?: string;
  readonly unit: CombatCalculationUnit;
}

export interface CombatCalculationModifierTotal {
  readonly unit: CombatCalculationUnit;
  readonly value: number;
}

export interface CombatCalculationDie {
  /** The complete open-ended roll contribution used by the canonical calculation. */
  readonly rolledValue: number;
  /** The initial D20 result, retained only to explain an open-ended roll. */
  readonly initialRoll?: number;
  readonly openEndedComponents: readonly number[];
}

/**
 * Strict presentation contract over one immutable canonical calculation snapshot.
 *
 * This is not a calculation engine. Adapters may derive only bounded arithmetic such as
 * `finalResult - die.rolledValue`; they never consult live participant or rules data.
 */
export interface CombatCalculationPresentation {
  readonly actor?: CombatCalculationSubject;
  readonly calculationId: string;
  readonly calculationType: CombatCalculationType;
  readonly completeness: CombatCalculationCompleteness;
  readonly contributingStat?: CombatCalculationLabeledValue;
  readonly derivedValues: readonly CombatCalculationLabeledValue[];
  readonly die?: CombatCalculationDie;
  readonly finalResult?: CombatCalculationLabeledValue;
  readonly label: string;
  readonly missingFacts: readonly string[];
  readonly modifiers: readonly CombatCalculationModifier[];
  /** Workbook-derived integer point adjustment produced by the raw percentage total. */
  readonly modifierAdjustment?: CombatCalculationLabeledValue;
  readonly preDieTotal?: CombatCalculationLabeledValue;
  readonly skill?: {
    readonly label: string;
    readonly xp: number;
  };
  readonly target?: CombatCalculationSubject;
  readonly totalModifiers?: CombatCalculationModifierTotal;
  readonly visibility: CombatCalculationVisibility;
}

export interface CombatCalculationPresentationRow {
  readonly kind:
    | "stat"
    | "skill"
    | "derived"
    | "modifier_heading"
    | "modifier"
    | "modifier_total"
    | "modifier_adjustment"
    | "pre_die_total"
    | "die"
    | "result";
  readonly key: string;
  readonly text: string;
}

function formatValue(value: number, unit?: CombatCalculationUnit): string {
  const suffix = unit === "percent" ? "%" : "";
  return `${value}${suffix}`;
}

function formatModifier(value: number, unit: CombatCalculationUnit): string {
  return `${formatSignedCombatModifier(value)}${unit === "percent" ? "%" : ""}`;
}

function formatDie(die: CombatCalculationDie): string {
  if (!die.openEndedComponents.length) return String(die.rolledValue);
  const components = [
    ...(die.initialRoll === undefined ? [] : [die.initialRoll]),
    ...die.openEndedComponents,
  ];
  return components.length
    ? `${die.rolledValue} (${components.join(" + ")})`
    : String(die.rolledValue);
}

/**
 * The single row grammar used by both live and archived calculation panels.
 */
export function buildCombatCalculationPresentationRows(
  presentation: CombatCalculationPresentation,
): readonly CombatCalculationPresentationRow[] {
  const rows: CombatCalculationPresentationRow[] = [];
  if (presentation.contributingStat) {
    rows.push({
      key: `${presentation.calculationId}:stat`,
      kind: "stat",
      text: `Stat: ${presentation.contributingStat.label} ${presentation.contributingStat.value}`,
    });
  }
  if (presentation.skill) {
    rows.push({
      key: `${presentation.calculationId}:skill`,
      kind: "skill",
      text: `${presentation.skill.label} XP: ${presentation.skill.xp}`,
    });
  }
  for (const [index, value] of presentation.derivedValues.entries()) {
    rows.push({
      key: `${presentation.calculationId}:derived:${index}`,
      kind: "derived",
      text: `${value.label}: ${value.value}`,
    });
  }
  if (presentation.modifiers.length) {
    rows.push({
      key: `${presentation.calculationId}:modifiers`,
      kind: "modifier_heading",
      text: "Modifiers",
    });
    for (const modifier of presentation.modifiers) {
      rows.push({
        key: `${presentation.calculationId}:modifier:${modifier.id}`,
        kind: "modifier",
        text: `${modifier.label}: ${formatModifier(modifier.value, modifier.unit)}`,
      });
    }
    if (presentation.totalModifiers) {
      rows.push({
        key: `${presentation.calculationId}:modifier-total`,
        kind: "modifier_total",
        text: `Total modifiers: ${formatModifier(
          presentation.totalModifiers.value,
          presentation.totalModifiers.unit,
        )}`,
      });
    }
  }
  if (presentation.modifierAdjustment) {
    rows.push({
      key: `${presentation.calculationId}:modifier-adjustment`,
      kind: "modifier_adjustment",
      text: `${presentation.modifierAdjustment.label}: ${formatSignedCombatModifier(
        presentation.modifierAdjustment.value,
      )}`,
    });
  }
  if (presentation.preDieTotal) {
    rows.push({
      key: `${presentation.calculationId}:pre-die`,
      kind: "pre_die_total",
      text: `${presentation.preDieTotal.label}: ${formatValue(presentation.preDieTotal.value)}`,
    });
  }
  if (presentation.die) {
    rows.push({
      key: `${presentation.calculationId}:die`,
      kind: "die",
      text: `Die roll: ${formatDie(presentation.die)}`,
    });
  }
  if (presentation.finalResult) {
    rows.push({
      key: `${presentation.calculationId}:result`,
      kind: "result",
      text: `${presentation.finalResult.label}: ${formatValue(presentation.finalResult.value)}`,
    });
  }
  return rows;
}

export function buildCombatCalculationPresentationLines(
  presentation: CombatCalculationPresentation,
): readonly string[] {
  return buildCombatCalculationPresentationRows(presentation).map((row) => row.text);
}
