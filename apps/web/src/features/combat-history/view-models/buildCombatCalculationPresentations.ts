import {
  combatSkillContestCalculationSchema,
  type ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import type {
  CombatCalculationDie,
  CombatCalculationLabeledValue,
  CombatCalculationModifier,
  CombatCalculationPresentation,
  CombatCalculationSubject,
  CombatCalculationType,
  CombatCalculationUnit,
  CombatCalculationVisibility,
} from "./combatCalculationPresentation";

type FactRecord = Record<string, unknown>;

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function record(value: unknown): FactRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FactRecord)
    : undefined;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];
}

function subject(
  event: ProjectedCombatHistoryEvent,
  ...roles: Array<ProjectedCombatHistoryEvent["identities"][number]["role"]>
): CombatCalculationSubject | undefined {
  const identity = roles
    .map((role) => event.identities.find((candidate) => candidate.role === role))
    .find(Boolean);
  return identity
    ? {
        label: identity.displayName,
        ...(identity.participantId ? { participantId: identity.participantId } : {}),
      }
    : undefined;
}

function die(calculation: FactRecord): CombatCalculationDie | undefined {
  const rolledValue = number(calculation.rollTotal);
  if (rolledValue === undefined) return undefined;
  return {
    ...(number(calculation.rollD20) === undefined
      ? {}
      : { initialRoll: number(calculation.rollD20) }),
    openEndedComponents: numberArray(calculation.openEndedD10s),
    rolledValue,
  };
}

function modifier(input: {
  id: string;
  label: string;
  unit?: CombatCalculationUnit;
  value: number | undefined;
}): CombatCalculationModifier | undefined {
  return input.value === undefined || input.value === 0
    ? undefined
    : {
        id: input.id,
        label: input.label,
        unit: input.unit ?? "points",
        value: input.value,
      };
}

function modifiersFromRows(input: {
  idPrefix: string;
  rows: unknown;
  unit: CombatCalculationUnit;
}): CombatCalculationModifier[] {
  return Array.isArray(input.rows)
    ? input.rows.flatMap((entry, index) => {
        const row = record(entry);
        const label = text(row?.label);
        const value = number(row?.value);
        const parsed =
          label && value !== undefined
            ? modifier({
                id: text(row?.id) ?? `${input.idPrefix}:${index}`,
                label,
                unit: input.unit,
                value,
              })
            : undefined;
        return parsed ? [parsed] : [];
      })
    : [];
}

function withRecordedModifierTotal(input: {
  calculationId: string;
  modifiers: CombatCalculationModifier[];
  recordedTotal?: number;
  unit: CombatCalculationUnit;
}): {
  modifiers: CombatCalculationModifier[];
  totalModifiers?: { unit: CombatCalculationUnit; value: number };
} {
  if (!input.modifiers.length && (!input.recordedTotal || input.recordedTotal === 0))
    return {
      modifiers: [],
    };
  const itemized = input.modifiers.reduce((sum, entry) => sum + entry.value, 0);
  const recorded = input.recordedTotal ?? itemized;
  const delta = recorded - itemized;
  return {
    modifiers:
      delta === 0
        ? input.modifiers
        : [
            ...input.modifiers,
            {
              id: `${input.calculationId}:recorded-remainder`,
              label: "Other recorded modifiers",
              unit: input.unit,
              value: delta,
            },
          ],
    totalModifiers: { unit: input.unit, value: recorded },
  };
}

function calculation(
  input: Omit<CombatCalculationPresentation, "derivedValues" | "missingFacts"> & {
    derivedValues?: readonly CombatCalculationLabeledValue[];
    missingFacts?: readonly string[];
  },
): CombatCalculationPresentation {
  return {
    ...input,
    derivedValues: input.derivedValues ?? [],
    missingFacts: input.missingFacts ?? [],
  };
}

function observationCalculation(input: {
  calculation: FactRecord;
  event: ProjectedCombatHistoryEvent;
  label: string;
  role: "observer" | "opponent";
  visibility: CombatCalculationVisibility;
}): CombatCalculationPresentation | undefined {
  const finalResult = number(input.calculation.finalTotal);
  const roll = die(input.calculation);
  if (finalResult === undefined || !roll) return undefined;
  const calculationId = `${input.event.id}:${input.role}`;
  const percentage = withRecordedModifierTotal({
    calculationId,
    modifiers: modifiersFromRows({
      idPrefix: `${calculationId}:modifier`,
      rows: input.calculation.appliedModifiers,
      unit: "percent",
    }),
    recordedTotal: number(input.calculation.percentageModifierTotal),
    unit: "percent",
  });
  const skillLabel = text(input.calculation.skillLabel);
  const skillXp = number(input.calculation.skillXp);
  const intelligence = number(input.calculation.intelligenceValue);
  const intelligenceXp = number(input.calculation.intelligenceXp);
  const effectiveSkill = number(input.calculation.effectiveSkillValue);
  return calculation({
    actor:
      input.role === "observer"
        ? subject(input.event, "actor", "roller")
        : subject(input.event, "target"),
    calculationId,
    calculationType: "observe_opponent",
    completeness:
      skillLabel &&
      skillXp !== undefined &&
      intelligence !== undefined &&
      effectiveSkill !== undefined
        ? "complete"
        : "legacy_incomplete",
    contributingStat:
      intelligence === undefined ? undefined : { label: "Intelligence", value: intelligence },
    derivedValues: [
      ...(intelligenceXp === undefined
        ? []
        : [{ label: "Intelligence XP", value: intelligenceXp }]),
      ...(number(input.calculation.baseValue) === undefined
        ? []
        : [{ label: "Base skill", value: number(input.calculation.baseValue)! }]),
      ...(number(input.calculation.percentageAdjustment) === undefined
        ? []
        : [
            {
              label: "Percentage adjustment",
              value: number(input.calculation.percentageAdjustment)!,
            },
          ]),
    ],
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: input.label,
    missingFacts: [
      ...(skillLabel ? [] : ["skill.label"]),
      ...(skillXp === undefined ? ["skill.xp"] : []),
      ...(intelligence === undefined ? ["stat.intelligence"] : []),
      ...(effectiveSkill === undefined ? ["preDieTotal"] : []),
    ],
    modifiers: percentage.modifiers,
    preDieTotal:
      effectiveSkill === undefined ? undefined : { label: "Skill total", value: effectiveSkill },
    skill: skillLabel && skillXp !== undefined ? { label: skillLabel, xp: skillXp } : undefined,
    target: subject(input.event, "target"),
    totalModifiers: percentage.totalModifiers,
    visibility: input.visibility,
  });
}

function brawlingCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const finalResult = number(facts.finalTotal);
  const roll = die(facts);
  if (finalResult === undefined || !roll) return undefined;
  const calculationId = `${event.id}:brawling`;
  const rows = [
    modifier({
      id: `${calculationId}:parry-quality`,
      label: "Parry quality",
      unit: number(facts.percentageModifierTotal) === undefined ? "points" : "percent",
      value: number(facts.parryQualityModifier),
    }),
    modifier({
      id: `${calculationId}:general`,
      label: "General/Fatigue",
      unit: number(facts.percentageModifierTotal) === undefined ? "points" : "percent",
      value: number(facts.generalModifier),
    }),
    modifier({
      id: `${calculationId}:skill`,
      label: "Skill/OB",
      unit: number(facts.percentageModifierTotal) === undefined ? "points" : "percent",
      value: number(facts.skillModifier),
    }),
  ].filter((entry): entry is CombatCalculationModifier => Boolean(entry));
  const usesPercentage = number(facts.percentageModifierTotal) !== undefined;
  const normalized = withRecordedModifierTotal({
    calculationId,
    modifiers: rows,
    recordedTotal: usesPercentage ? number(facts.percentageModifierTotal) : undefined,
    unit: usesPercentage ? "percent" : "points",
  });
  const skillXp = number(facts.brawlingSkillXp);
  const characteristic = number(facts.characteristicAverage);
  const preDie = number(facts.effectiveSkillValue) ?? finalResult - roll.rolledValue;
  return calculation({
    actor: subject(event, "roller", "actor"),
    calculationId,
    calculationType:
      event.type === "continued_contact_maintenance"
        ? "continued_contact_maintenance"
        : "offensive_parry_brawling",
    completeness:
      skillXp === undefined || characteristic === undefined ? "legacy_incomplete" : "complete",
    contributingStat:
      characteristic === undefined
        ? undefined
        : { label: "Characteristic average", value: characteristic },
    derivedValues: [
      ...(number(facts.brawlingBaseValue) === undefined
        ? []
        : [{ label: "Base skill", value: number(facts.brawlingBaseValue)! }]),
      ...(number(facts.percentageAdjustment) === undefined
        ? []
        : [{ label: "Percentage adjustment", value: number(facts.percentageAdjustment)! }]),
    ],
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: subject(event, "roller", "actor")?.label ?? "Brawling",
    missingFacts: [
      ...(skillXp === undefined ? ["skill.xp"] : []),
      ...(characteristic === undefined ? ["stat.characteristicAverage"] : []),
    ],
    modifiers: normalized.modifiers,
    preDieTotal: { label: "Skill total", value: preDie },
    skill: skillXp === undefined ? undefined : { label: "Brawling", xp: skillXp },
    target: subject(event, "target"),
    totalModifiers: normalized.totalModifiers,
    visibility: "own",
  });
}

function skillContestCalculationPresentation(input: {
  actor?: CombatCalculationSubject;
  calculationType: CombatCalculationType;
  facts: FactRecord;
  label?: string;
  target?: CombatCalculationSubject;
  visibility?: CombatCalculationVisibility;
}): CombatCalculationPresentation | undefined {
  const parsed = combatSkillContestCalculationSchema.safeParse(input.facts.skillContestCalculation);
  if (!parsed.success) return undefined;
  const snapshot = parsed.data;
  return calculation({
    actor: input.actor,
    calculationId: snapshot.calculationId,
    calculationType: input.calculationType,
    completeness: snapshot.completeness,
    contributingStat: {
      label: snapshot.governingStat.label,
      value: snapshot.governingStat.value,
    },
    derivedValues: [{ label: "Base skill", value: snapshot.baseSkill }],
    die: {
      initialRoll: snapshot.openEndedDie.rollD20,
      openEndedComponents: snapshot.openEndedDie.openEndedD10s,
      rolledValue: snapshot.openEndedDie.rollTotal,
    },
    finalResult: { label: "Result", value: snapshot.finalResult },
    label: input.label ?? snapshot.skill.label,
    missingFacts: snapshot.missingContributionPoints,
    modifierAdjustment: {
      label: "Derived adjustment",
      value: snapshot.derivedIntegerAdjustment,
    },
    modifiers: snapshot.percentageContributions.map((contribution) => ({
      id: contribution.id,
      label: contribution.label,
      provenance: contribution.provenance,
      unit: "percent" as const,
      value: contribution.value,
    })),
    preDieTotal: { label: "Skill total", value: snapshot.preDieTotal },
    skill: { label: snapshot.skill.label, xp: snapshot.skill.totalXp },
    target: input.target,
    totalModifiers: {
      unit: "percent",
      value: snapshot.totalPercentageAdjustment,
    },
    visibility: input.visibility ?? "own",
  });
}

function feintCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const side = text(event.facts.involvedOutcome?.side);
  const canonical = skillContestCalculationPresentation({
    actor: subject(event, "roller", side === "defender" ? "defender" : "attacker"),
    calculationType: "feint",
    facts,
    label: side === "defender" ? "Defender" : "Initiator",
    target: subject(event, "target"),
  });
  if (canonical) return canonical;
  const finalResult = number(facts.finalTotal);
  const roll = die(facts);
  if (finalResult === undefined || !roll) return undefined;
  const skillLabel = text(facts.skillLabel);
  const skillXp = number(facts.skillXp);
  const characteristicValue = number(facts.characteristicValue);
  const adjustment = modifier({
    id: `${event.id}:feint:adjustment`,
    label: "Adjustment",
    value: number(facts.adjustment),
  });
  return calculation({
    actor: subject(event, "roller", side === "defender" ? "defender" : "attacker"),
    calculationId: `${event.id}:feint`,
    calculationType: "feint",
    completeness:
      skillLabel && skillXp !== undefined && characteristicValue !== undefined
        ? "complete"
        : "legacy_incomplete",
    contributingStat:
      characteristicValue === undefined
        ? undefined
        : {
            label: text(facts.characteristic) === "int" ? "Intelligence" : "Dexterity",
            value: characteristicValue,
          },
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: side === "defender" ? "Defender" : "Initiator",
    missingFacts: [
      ...(skillLabel ? [] : ["skill.label"]),
      ...(skillXp === undefined ? ["skill.xp"] : []),
      ...(characteristicValue === undefined ? ["stat.value"] : []),
    ],
    modifiers: adjustment ? [adjustment] : [],
    preDieTotal: { label: "Skill total", value: finalResult - roll.rolledValue },
    skill: skillLabel && skillXp !== undefined ? { label: skillLabel, xp: skillXp } : undefined,
    target: subject(event, "target"),
    totalModifiers: adjustment ? { unit: "points", value: adjustment.value } : undefined,
    visibility: "own",
  });
}

function attackCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const ob = number(facts.ob);
  const defenderDb = number(facts.defenderDb);
  const finalResult = number(facts.lookupTotal);
  const roll = die(facts);
  if (ob === undefined || defenderDb === undefined || finalResult === undefined || !roll) {
    return undefined;
  }
  const calculationId = `${event.id}:attack`;
  const percentage = withRecordedModifierTotal({
    calculationId,
    modifiers: modifiersFromRows({
      idPrefix: `${calculationId}:opponent`,
      rows: facts.opponentSpecificObModifierRows,
      unit: "percent",
    }),
    recordedTotal: number(facts.opponentSpecificObRaw),
    unit: "percent",
  });
  const baseOb = number(facts.obBeforeOpponentSpecificModifier);
  return calculation({
    actor: subject(event, "attacker", "actor"),
    calculationId,
    calculationType: "attack",
    completeness: "legacy_incomplete",
    derivedValues: [
      { label: baseOb === undefined ? "OB" : "Base OB", value: baseOb ?? ob },
      ...(number(facts.opponentSpecificObPercentageAdjustment) === undefined
        ? []
        : [
            {
              label: "Percentage adjustment",
              value: number(facts.opponentSpecificObPercentageAdjustment)!,
            },
          ]),
      ...(baseOb === undefined ? [] : [{ label: "Adjusted OB", value: ob }]),
      { label: "Defender DB", value: defenderDb },
    ],
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: "Attack",
    missingFacts: ["stat", "skill"],
    modifiers: percentage.modifiers,
    preDieTotal: { label: "Combat total", value: ob - defenderDb },
    target: subject(event, "defender", "target"),
    totalModifiers: percentage.totalModifiers,
    visibility: "own",
  });
}

function parryCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const finalResult = number(facts.total);
  const roll = die(facts);
  if (finalResult === undefined || !roll) return undefined;
  const calculationId = `${event.id}:parry`;
  const breakdown = modifiersFromRows({
    idPrefix: `${calculationId}:modifier`,
    rows: facts.modifierBreakdown,
    unit: "points",
  });
  const adjustment =
    number(facts.modifierAdjustment) ??
    finalResult - roll.rolledValue - (number(facts.combinedParryScore) ?? 0);
  const normalized = withRecordedModifierTotal({
    calculationId,
    modifiers: breakdown,
    recordedTotal: adjustment,
    unit: "points",
  });
  const combined = number(facts.combinedParryScore);
  return calculation({
    actor: subject(event, "defender", "roller", "actor"),
    calculationId,
    calculationType: "parry",
    completeness: "legacy_incomplete",
    derivedValues: combined === undefined ? [] : [{ label: "Base Parry", value: combined }],
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: "Parry",
    missingFacts: ["stat", "skill"],
    modifiers: normalized.modifiers,
    preDieTotal: { label: "Combat total", value: finalResult - roll.rolledValue },
    target: subject(event, "attacker", "target"),
    totalModifiers: normalized.totalModifiers,
    visibility: "own",
  });
}

export function buildDodgeCalculationPresentationFromSnapshot(input: {
  actor?: CombatCalculationSubject;
  calculationId: string;
  calculationType: Extract<CombatCalculationType, "adjust_distance_roll" | "distance_control_roll">;
  facts: FactRecord;
  label?: string;
  target?: CombatCalculationSubject;
  visibility?: CombatCalculationVisibility;
}): CombatCalculationPresentation | undefined {
  const { facts } = input;
  const canonical = skillContestCalculationPresentation(input);
  if (canonical) return canonical;
  const finalResult = number(facts.finalTotal);
  const roll = die(facts);
  if (finalResult === undefined || !roll) return undefined;
  const calculationId = input.calculationId;
  const recordedModifiers = modifiersFromRows({
    idPrefix: `${calculationId}:modifier`,
    rows: facts.appliedModifiers,
    unit: "percent",
  });
  const modifiers = recordedModifiers.length
    ? recordedModifiers
    : [
        modifier({
          id: `${calculationId}:general-fatigue`,
          label: "General/Fatigue",
          unit: "percent",
          value: number(facts.generalFatigueModifier),
        }),
        modifier({
          id: `${calculationId}:situational`,
          label: "GM maneuver adjustment",
          unit: "percent",
          value: number(facts.situationalAdjustment),
        }),
      ].filter((entry): entry is CombatCalculationModifier => Boolean(entry));
  const normalized = withRecordedModifierTotal({
    calculationId,
    modifiers,
    recordedTotal: number(facts.totalModifiers),
    unit: "percent",
  });
  const skillLabel = text(facts.dodgeSkillLabel);
  const skillXp = number(facts.dodgeSkillXp);
  const statLabel = text(facts.dodgeStatLabel);
  const statValue = number(facts.dodgeStatValue);
  const preDieTotal = number(facts.preDieTotal) ?? finalResult - roll.rolledValue;
  return calculation({
    actor: input.actor,
    calculationId,
    calculationType: input.calculationType,
    // Snapshots without the typed Skill Contest contract may use the retired
    // DB-derived Adjust Distance arithmetic. Keep them readable, but never
    // certify them as source-conformant Dodge calculations.
    completeness: "legacy_incomplete",
    contributingStat:
      statLabel && statValue !== undefined ? { label: statLabel, value: statValue } : undefined,
    derivedValues:
      number(facts.dodgeSkillTotal) === undefined
        ? []
        : [{ label: "Dodge base", value: number(facts.dodgeSkillTotal)! }],
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: input.label ?? "Dodge",
    missingFacts: [
      ...(statLabel && statValue !== undefined ? [] : ["stat"]),
      ...(skillLabel && skillXp !== undefined ? [] : ["skill.xp"]),
    ],
    modifiers: normalized.modifiers,
    preDieTotal: { label: "Skill total", value: preDieTotal },
    skill: skillLabel && skillXp !== undefined ? { label: skillLabel, xp: skillXp } : undefined,
    target: input.target,
    totalModifiers: normalized.totalModifiers,
    visibility: input.visibility ?? "own",
  });
}

function initiativeCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const finalResult = number(facts.total);
  const rollTotal = number(facts.rollTotal);
  if (finalResult === undefined || rollTotal === undefined) return undefined;
  const adjustment = modifier({
    id: `${event.id}:initiative:modifier`,
    label: "Initiative modifier",
    value: number(facts.modifierAdjustment),
  });
  return calculation({
    actor: subject(event, "roller", "actor"),
    calculationId: `${event.id}:initiative`,
    calculationType: "initiative",
    completeness: "legacy_incomplete",
    derivedValues:
      number(facts.baseInitiative) === undefined
        ? []
        : [{ label: "Base initiative", value: number(facts.baseInitiative)! }],
    die: {
      openEndedComponents: numberArray(facts.rolls).slice(1),
      rolledValue: rollTotal,
      ...(numberArray(facts.rolls)[0] === undefined
        ? {}
        : { initialRoll: numberArray(facts.rolls)[0] }),
    },
    finalResult: { label: "Result", value: finalResult },
    label: "Initiative",
    missingFacts: ["stat", "skill"],
    modifiers: adjustment ? [adjustment] : [],
    preDieTotal: { label: "Initiative total", value: finalResult - rollTotal },
    totalModifiers: adjustment ? { unit: "points", value: adjustment.value } : undefined,
    visibility: "own",
  });
}

function simpleRollCalculation(input: {
  event: ProjectedCombatHistoryEvent;
  facts: FactRecord;
  label: string;
  preDieLabel: string;
  stat?: CombatCalculationLabeledValue;
  type: Extract<CombatCalculationType, "combat_experience" | "health_check">;
}): CombatCalculationPresentation | undefined {
  const finalResult = number(input.facts.finalTotal);
  const roll = die(input.facts);
  if (finalResult === undefined || !roll) return undefined;
  const recordedPreDieTotal = number(input.facts.skillTotal);
  return calculation({
    actor: subject(input.event, "roller", "actor"),
    calculationId: `${input.event.id}:${input.type}`,
    calculationType: input.type,
    completeness: "legacy_incomplete",
    contributingStat: input.stat,
    die: roll,
    finalResult: { label: "Result", value: finalResult },
    label: input.label,
    missingFacts: input.stat ? [] : ["stat"],
    modifiers: [],
    preDieTotal: {
      label: input.preDieLabel,
      value: recordedPreDieTotal ?? finalResult - roll.rolledValue,
    },
    visibility: "own",
  });
}

function criticalCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const finalResult = number(facts.finalCriticalRoll);
  const dieTotal = number(facts.criticalDiceTotal);
  if (finalResult === undefined || dieTotal === undefined) return undefined;
  const calculationId = `${event.id}:critical`;
  const modifiers = [
    modifier({
      id: `${calculationId}:type`,
      label: "Critical type",
      value: number(facts.criticalTypeModifier),
    }),
    modifier({
      id: `${calculationId}:armor`,
      label: "Armor",
      value: number(facts.armorCriticalModifier),
    }),
  ].filter((entry): entry is CombatCalculationModifier => Boolean(entry));
  const normalized = withRecordedModifierTotal({
    calculationId,
    modifiers,
    unit: "points",
  });
  return calculation({
    actor: subject(event, "attacker", "roller", "actor"),
    calculationId,
    calculationType: "critical",
    completeness: "legacy_incomplete",
    die: {
      openEndedComponents: numberArray(facts.criticalDice).slice(1),
      rolledValue: dieTotal,
      ...(numberArray(facts.criticalDice)[0] === undefined
        ? {}
        : { initialRoll: numberArray(facts.criticalDice)[0] }),
    },
    finalResult: { label: "Result", value: finalResult },
    label: "Critical",
    missingFacts: ["stat", "skill"],
    modifiers: normalized.modifiers,
    preDieTotal: { label: "Critical modifier total", value: finalResult - dieTotal },
    target: subject(event, "defender", "target"),
    totalModifiers: normalized.totalModifiers,
    visibility: "own",
  });
}

function hitLocationCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const selected = number(facts.selectedHitLocationRoll);
  const rolls = numberArray(facts.hitLocationRolls);
  const rolledValue = selected ?? rolls[0];
  if (rolledValue === undefined) return undefined;
  return calculation({
    actor: subject(event, "attacker", "roller", "actor"),
    calculationId: `${event.id}:hit-location`,
    calculationType: "hit_location",
    completeness: "legacy_incomplete",
    die: { openEndedComponents: [], rolledValue },
    label: "Hit location",
    missingFacts: ["stat", "skill"],
    modifiers: [],
    target: subject(event, "defender", "target"),
    visibility: "own",
  });
}

function damageCalculation(
  event: ProjectedCombatHistoryEvent,
  facts: FactRecord,
): CombatCalculationPresentation | undefined {
  const result = number(facts.damageLookupTotal);
  if (result === undefined) return undefined;
  const calculationId = `${event.id}:damage`;
  const modifiers = [
    modifier({
      id: `${calculationId}:dmb`,
      label: "DMB",
      value: number(facts.dmb),
    }),
    modifier({
      id: `${calculationId}:defender-dm`,
      label: "Defender DM",
      value: number(facts.defenderDm),
    }),
    modifier({
      id: `${calculationId}:armor`,
      label: "Armor",
      value: number(facts.armorModifier),
    }),
  ].filter((entry): entry is CombatCalculationModifier => Boolean(entry));
  const normalized = withRecordedModifierTotal({
    calculationId,
    modifiers,
    unit: "points",
  });
  const damageRoll = record(facts.damageRoll);
  const rollTotal = number(damageRoll?.total);
  return calculation({
    actor: subject(event, "attacker", "actor"),
    calculationId,
    calculationType: "damage",
    completeness: "legacy_incomplete",
    derivedValues:
      number(facts.hitLookupTotal) === undefined
        ? []
        : [{ label: "Hit lookup total", value: number(facts.hitLookupTotal)! }],
    die:
      rollTotal === undefined
        ? undefined
        : {
            openEndedComponents: numberArray(damageRoll?.rolls).slice(1),
            rolledValue: rollTotal,
            ...(numberArray(damageRoll?.rolls)[0] === undefined
              ? {}
              : { initialRoll: numberArray(damageRoll?.rolls)[0] }),
          },
    finalResult: { label: "Result", value: result },
    label: "Damage",
    missingFacts: ["stat", "skill"],
    modifiers: normalized.modifiers,
    preDieTotal: { label: "Damage total", value: result - (rollTotal ?? 0) },
    target: subject(event, "defender", "target"),
    totalModifiers: normalized.totalModifiers,
    visibility: "own",
  });
}

/**
 * Adapts only allowlisted immutable arithmetic facts. Unknown fields, internal identifiers, and
 * outcome prose are intentionally ignored.
 */
export function buildCombatCalculationPresentations(
  event: ProjectedCombatHistoryEvent,
): readonly CombatCalculationPresentation[] {
  const facts = event.facts.privateCalculation;
  if (!facts) {
    const rawGrazingDamage = number(event.facts.involvedOutcome?.rawGrazingDamage);
    if (event.type !== "damage_proposed" || rawGrazingDamage === undefined) return [];
    return [
      calculation({
        actor: subject(event, "attacker", "actor"),
        calculationId: `${event.id}:graze-damage`,
        calculationType: "damage",
        completeness: "legacy_incomplete",
        die: { openEndedComponents: [], rolledValue: rawGrazingDamage },
        label: "Graze damage",
        missingFacts: ["damageLookupTotal"],
        modifiers: [],
        target: subject(event, "defender", "target"),
        visibility: "own",
      }),
    ];
  }
  switch (event.type) {
    case "observation": {
      const observer = observationCalculation({
        calculation: facts,
        event,
        label: `Observer — ${subject(event, "actor", "roller")?.label ?? "Observer"}`,
        role: "observer",
        visibility: "own",
      });
      const targetFacts = record(event.facts.gmReview?.targetCalculation);
      const opponent = targetFacts
        ? observationCalculation({
            calculation: targetFacts,
            event,
            label: `Opponent — ${subject(event, "target")?.label ?? "Opponent"}`,
            role: "opponent",
            visibility: "gm_full",
          })
        : undefined;
      return [observer, opponent].filter((entry): entry is CombatCalculationPresentation =>
        Boolean(entry),
      );
    }
    case "offensive_parry_brawling":
    case "continued_contact_maintenance": {
      const result = brawlingCalculation(event, facts);
      return result ? [result] : [];
    }
    case "feint_roll": {
      const result = feintCalculation(event, facts);
      return result ? [result] : [];
    }
    case "attack": {
      const result = attackCalculation(event, facts);
      return result ? [result] : [];
    }
    case "parry": {
      const result = parryCalculation(event, facts);
      return result ? [result] : [];
    }
    case "adjust_distance_roll":
    case "distance_control_roll": {
      const result = buildDodgeCalculationPresentationFromSnapshot({
        actor: subject(event, "roller", "actor"),
        calculationId: `${event.id}:dodge`,
        calculationType: event.type,
        facts,
        target: subject(event, "target"),
      });
      return result ? [result] : [];
    }
    case "initiative": {
      const result = initiativeCalculation(event, facts);
      return result ? [result] : [];
    }
    case "combat_experience": {
      const result = simpleRollCalculation({
        event,
        facts,
        label: "Combat Experience",
        preDieLabel: "Skill total",
        type: "combat_experience",
      });
      return result ? [result] : [];
    }
    case "health_check": {
      const health = number(facts.healthStat);
      const result = simpleRollCalculation({
        event,
        facts,
        label: "Health check",
        preDieLabel: "Health total",
        stat: health === undefined ? undefined : { label: "Health", value: health },
        type: "health_check",
      });
      return result ? [result] : [];
    }
    case "hit_location": {
      const result = hitLocationCalculation(event, facts);
      return result ? [result] : [];
    }
    case "critical": {
      const result = criticalCalculation(event, facts);
      return result ? [result] : [];
    }
    case "damage_proposed":
    case "damage_committed": {
      const result = damageCalculation(event, facts);
      return result ? [result] : [];
    }
    default:
      return [];
  }
}

/**
 * Bounded compatibility entry point for active inspector snapshots that have not yet been
 * published into the event ledger. It delegates to the same family adapters as current/history
 * result presentation and never flattens arbitrary fields.
 */
export function buildCombatCalculationPresentationFromSnapshot(input: {
  calculationId: string;
  calculationType:
    | "attack"
    | "parry"
    | "hit_location"
    | "critical"
    | "damage_proposed"
    | "distance_control_roll"
    | "feint_roll";
  facts: FactRecord;
  label?: string;
}): CombatCalculationPresentation | undefined {
  const presentation = buildCombatCalculationPresentations({
    completeness: "complete",
    facts: { privateCalculation: input.facts, publicOutcome: {} },
    id: input.calculationId,
    identities: [],
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    sequence: 0,
    status: "recorded",
    step: "phase_1_actions",
    type: input.calculationType,
  })[0];
  return presentation && input.label ? { ...presentation, label: input.label } : presentation;
}
