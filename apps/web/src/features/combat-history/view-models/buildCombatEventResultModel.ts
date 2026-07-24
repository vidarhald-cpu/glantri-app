import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import { formatSignedCombatModifier } from "./formatCombatModifier";
import {
  buildCombatRollCalculationPresentation,
  formatCombatRollCalculationLines,
} from "./combatCalculationPresentation";

export interface CombatEventResultItemModel {
  calculationRows: CombatEventResultFactRow[];
  completenessLabel?: string;
  id: string;
  outcomeRows: CombatEventResultFactRow[];
  sequence: number;
  summary: string;
  title: string;
  type: ProjectedCombatHistoryEvent["type"];
}

export interface CombatEventResultFactRow {
  key: string;
  text: string;
}

export interface CombatEventResultModel {
  items: CombatEventResultItemModel[];
}

const EVENT_TITLES: Record<ProjectedCombatHistoryEvent["type"], string> = {
  attack: "Attack",
  combat_experience: "Combat Experience",
  critical: "Critical",
  damage_committed: "Damage committed",
  damage_proposed: "Damage proposed",
  declaration: "Declaration",
  distance_control_applied: "Distance control applied",
  distance_control_result: "Distance control result",
  distance_control_roll: "Distance control roll",
  health_check: "Health check",
  hit_location: "Hit location",
  initiative: "Initiative",
  parry: "Parry",
  offensive_parry_brawling: "Offensive Parry — Brawling",
  participant_su_review: "Participant SU review",
  feint_feasibility: "Feint ruling",
  feint_roll: "Feint roll",
  feint_result: "Opposed result",
  feint_committed: "Feint committed",
  feint_impossible: "Feint ruling",
  adjust_distance_response: "Defender response",
  adjust_distance_adjustment: "Maneuver adjustment",
  adjust_distance_roll: "Dodge roll",
  adjust_distance_result: "Distance proposal",
  adjust_distance_committed: "Distance adjustment committed",
};

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatValue(value: unknown, identityById: ReadonlyMap<string, string>): string {
  if (Array.isArray(value))
    return value.map((entry) => formatValue(entry, identityById)).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${humanize(key)} ${formatValue(nested, identityById)}`)
      .join(" · ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "—";
  return typeof value === "string"
    ? (identityById.get(value) ?? (value.includes("_") ? humanize(value) : value))
    : String(value);
}

function isMeaningfulCalculationValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function calculationFactRows(
  eventId: string,
  facts: Record<string, unknown> | undefined,
  identityById: ReadonlyMap<string, string>,
): CombatEventResultFactRow[] {
  if (!facts) return [];
  return Object.entries(facts).flatMap(([fieldKey, value], index) =>
    isMeaningfulCalculationValue(value)
      ? [
          {
            key: `${eventId}:calculation:${fieldKey}:${index}`,
            text: `${humanize(fieldKey)}: ${formatValue(value, identityById)}`,
          },
        ]
      : [],
  );
}

function identity(event: ProjectedCombatHistoryEvent, role: string): string | undefined {
  return event.identities.find((candidate) => candidate.role === role)?.displayName;
}

function attackOutcome(event: ProjectedCombatHistoryEvent): string {
  const involved = event.facts.involvedOutcome;
  if (typeof involved?.tableResult === "string") return involved.tableResult;
  const grazing = involved?.grazing ?? event.facts.publicOutcome.grazing;
  if (grazing === true) return "Grazing hit";
  const hit = involved?.hit ?? event.facts.publicOutcome.hit;
  return hit === true ? "Hit" : "Miss";
}

function attackCalculationRows(event: ProjectedCombatHistoryEvent): CombatEventResultFactRow[] {
  const calculation = event.facts.privateCalculation;
  if (!calculation) return [];
  const ob = calculation.ob;
  const roll = calculation.rollTotal;
  const db = calculation.defenderDb;
  const total = calculation.lookupTotal;
  if (
    typeof ob === "number" &&
    typeof roll === "number" &&
    typeof db === "number" &&
    typeof total === "number"
  ) {
    return [
      {
        key: `${event.id}:calculation:attack-total`,
        text: `OB ${ob} + roll ${roll} - DB ${db} = ${total}`,
      },
    ];
  }

  return [
    ["ob", "OB"],
    ["rollTotal", "Roll"],
    ["defenderDb", "DB"],
    ["lookupTotal", "Total"],
  ].flatMap(([field, label]) => {
    const value = calculation[field];
    return typeof value === "number"
      ? [{ key: `${event.id}:calculation:attack:${field}`, text: `${label}: ${value}` }]
      : [];
  });
}

export function buildConciseDodgeCalculationRows(input: {
  calculation?: Record<string, unknown>;
  detailRows?: readonly string[];
  eventId: string;
  outcome?: string;
}): CombatEventResultFactRow[] {
  const calculation = input.calculation;
  if (!calculation) return [];
  const skill = calculation.dodgeSkillTotal;
  const die = calculation.rollD20;
  const rollTotal = calculation.rollTotal;
  const result = calculation.finalTotal;
  if (
    typeof skill !== "number" ||
    typeof die !== "number" ||
    typeof rollTotal !== "number" ||
    typeof result !== "number"
  ) {
    return calculationFactRows(input.eventId, calculation, new Map());
  }
  const general = typeof calculation.generalFatigueModifier === "number" ? calculation.generalFatigueModifier : 0;
  const adjustment = typeof calculation.situationalAdjustment === "number" ? calculation.situationalAdjustment : 0;
  const modifier = general + adjustment;
  const openEnded = Array.isArray(calculation.openEndedD10s) ? calculation.openEndedD10s : [];
  const dieText = openEnded.length
    ? `${die} (${openEnded.join(" + ")})`
    : String(die);
  const standardOutcome = input.outcome;
  const rows: CombatEventResultFactRow[] = [
    { key: `${input.eventId}:calculation:skill`, text: `Skill: Dodge ${skill}` },
    { key: `${input.eventId}:calculation:modifier`, text: `Modifier: ${formatSignedCombatModifier(modifier)}` },
    { key: `${input.eventId}:calculation:die`, text: `Die roll: ${dieText}` },
    { key: `${input.eventId}:calculation:result`, text: `Result: ${result}` },
    {
      key: `${input.eventId}:calculation:outcome`,
      text: `Outcome: ${standardOutcome ?? "Roll recorded"}`,
    },
  ];
  for (const [index, detail] of (input.detailRows ?? []).entries()) {
    rows.push({ key: `${input.eventId}:calculation:detail:${index}`, text: detail });
  }
  return rows;
}

function dodgeCalculationRows(event: ProjectedCombatHistoryEvent): CombatEventResultFactRow[] {
  const standardOutcome = factLabel(factValue(event, "standardOutcome"));
  const situationalAdjustment = event.facts.privateCalculation?.situationalAdjustment;
  return buildConciseDodgeCalculationRows({
    calculation: event.facts.privateCalculation,
    detailRows:
      event.type === "adjust_distance_roll" && typeof situationalAdjustment === "number"
        ? [`Maneuver adjustment: ${formatSignedCombatModifier(situationalAdjustment)}`]
        : undefined,
    eventId: event.id,
    outcome: standardOutcome,
  });
}

function offensiveParryBrawlingCalculationRows(
  event: ProjectedCombatHistoryEvent,
): CombatEventResultFactRow[] {
  const calculation = buildCombatRollCalculationPresentation({
    calculation: event.facts.privateCalculation,
    label: identity(event, "roller") ?? "Brawling",
  });
  return calculation
    ? formatCombatRollCalculationLines(calculation).map((text, index) => ({
        key: `${event.id}:calculation:brawling:${index}`,
        text,
      }))
    : [];
}

function factValue(event: ProjectedCombatHistoryEvent, ...keys: string[]): unknown {
  for (const key of keys) {
    const involved = event.facts.involvedOutcome?.[key];
    if (involved !== undefined && involved !== null && involved !== "") return involved;
    const publicValue = event.facts.publicOutcome[key];
    if (publicValue !== undefined && publicValue !== null && publicValue !== "") return publicValue;
  }
  return undefined;
}

function factLabel(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.includes("_") ? humanize(value) : value;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return factLabel(record.label) ?? factLabel(record.name) ?? factLabel(record.id);
  }
  return typeof value === "number" ? String(value) : undefined;
}

function resultRow(event: ProjectedCombatHistoryEvent, text?: string): CombatEventResultFactRow[] {
  return text ? [{ key: `${event.id}:outcome:result`, text }] : [];
}

function eventPresentation(event: ProjectedCombatHistoryEvent): {
  outcomeRows: CombatEventResultFactRow[];
  summary: string;
} {
  const attacker = identity(event, "attacker") ?? identity(event, "actor");
  const defender = identity(event, "defender") ?? identity(event, "target");
  const roller = identity(event, "roller") ?? identity(event, "actor");

  switch (event.type) {
    case "combat_experience": {
      const success = factValue(event, "success");
      const finalTotal = factLabel(factValue(event, "finalTotal"));
      const difficulty = factLabel(factValue(event, "difficulty"));
      return {
        outcomeRows: resultRow(
          event,
          finalTotal && difficulty ? `Result: ${finalTotal} vs ${difficulty}` : undefined,
        ),
        summary:
          success === true
            ? `${roller ?? "Participant"} succeeded the Combat Experience roll.`
            : success === false
              ? `${roller ?? "Participant"} failed the Combat Experience roll.`
              : `${roller ?? "Participant"} completed the Combat Experience roll.`,
      };
    }
    case "attack": {
      const weapon = event.facts.involvedOutcome?.weaponName;
      return {
        outcomeRows: resultRow(event, `Result: ${attackOutcome(event)}`),
        summary:
          attacker && defender
            ? `${attacker} attacked ${defender}${typeof weapon === "string" ? ` with a ${weapon}` : ""}.`
            : "Attack recorded.",
      };
    }
    case "parry": {
      const resultLabel = factLabel(factValue(event, "resultLabel"));
      const success = factValue(event, "success");
      const result =
        resultLabel ??
        (success === true ? "Parry succeeded" : success === false ? "Parry failed" : undefined);
      return {
        outcomeRows: resultRow(event, result ? `Result: ${result}` : undefined),
        summary:
          defender && attacker
            ? `${defender} attempted to parry ${attacker}.`
            : `${roller ?? "Defender"} attempted to parry.`,
      };
    }
    case "offensive_parry_brawling": {
      const resolved = factValue(event, "resolved") === true;
      const contactEstablished = factValue(event, "contactEstablished") === true;
      const winnerParticipantId = factValue(event, "winnerParticipantId");
      const winner =
        typeof winnerParticipantId === "string"
          ? event.identities.find(
              (candidate) => candidate.participantId === winnerParticipantId,
            )?.displayName
          : undefined;
      return {
        outcomeRows: resolved
          ? resultRow(
              event,
              contactEstablished
                ? `${winner ?? defender ?? "The defender"} won the Brawling contest.`
                : winner
                  ? `${winner} won the Brawling contest.`
                  : "The Brawling contest was tied.",
            )
          : [],
        summary: resolved
          ? contactEstablished
            ? "Continued contact was established and the attacker became Unbalanced."
            : "Continued contact was not established."
          : `${roller ?? "Participant"} rolled Brawling.`,
      };
    }
    case "hit_location": {
      const location = factLabel(factValue(event, "selectedHitLocation", "hitLocation"));
      return {
        outcomeRows: [],
        summary:
          defender && location
            ? `${defender} was hit in the ${location.toLowerCase()}.`
            : location
              ? `Hit location: ${location}.`
              : "Hit location resolved.",
      };
    }
    case "critical": {
      const grade = factLabel(factValue(event, "criticalGrade"))?.toUpperCase();
      const result = factLabel(factValue(event, "resultLabel", "effectLabel", "title"));
      return {
        outcomeRows: resultRow(event, result ? `Result: ${result}` : undefined),
        summary: grade
          ? `Critical ${grade}${defender ? ` against ${defender}` : ""}.`
          : defender
            ? `Critical result against ${defender}.`
            : "Critical result resolved.",
      };
    }
    case "damage_proposed": {
      const total = factLabel(factValue(event, "totalDamage", "proposedDamage"));
      const grade = factLabel(factValue(event, "criticalGrade"))?.toUpperCase();
      const details = [total, grade ? `Critical ${grade}` : undefined].filter(Boolean).join(" · ");
      return {
        outcomeRows: [],
        summary: defender
          ? `Proposed damage to ${defender}${details ? `: ${details}` : ""}.`
          : details
            ? `Proposed damage: ${details}.`
            : "Damage proposed.",
      };
    }
    case "damage_committed": {
      const total = factLabel(factValue(event, "finalCommittedDamage", "totalDamage"));
      const location = factLabel(factValue(event, "hitLocation", "selectedHitLocation"));
      const grade = factLabel(factValue(event, "criticalGrade"))?.toUpperCase();
      return {
        outcomeRows: resultRow(event, grade ? `Critical ${grade} committed.` : undefined),
        summary:
          defender && total
            ? `${defender} received ${total} damage${location ? ` to the ${location.toLowerCase()}` : ""}.`
            : defender
              ? `Damage committed against ${defender}.`
              : "Damage committed.",
      };
    }
    case "distance_control_roll": {
      const total = factLabel(factValue(event, "total"));
      return {
        outcomeRows: resultRow(event, total ? `Total: ${total}` : undefined),
        summary:
          roller && defender
            ? `${roller} rolled distance control against ${defender}.`
            : `${roller ?? "Participant"} rolled distance control.`,
      };
    }
    case "distance_control_result": {
      const result = factLabel(factValue(event, "resultLabel", "outcome"));
      const distance = factLabel(factValue(event, "proposedDistance"));
      return {
        outcomeRows: [
          ...resultRow(event, result ? `Result: ${result}` : undefined),
          ...(distance
            ? [{ key: `${event.id}:outcome:distance`, text: `Proposed distance: ${distance}` }]
            : []),
        ],
        summary: "Distance-control pair result resolved.",
      };
    }
    case "distance_control_applied": {
      const applied = factLabel(factValue(event, "appliedDistance"));
      const previous = factLabel(factValue(event, "previousDistance"));
      return {
        outcomeRows: [
          ...(applied
            ? [{ key: `${event.id}:outcome:applied`, text: `Applied distance: ${applied}` }]
            : []),
          ...(previous
            ? [{ key: `${event.id}:outcome:previous`, text: `Previous distance: ${previous}` }]
            : []),
        ],
        summary: "The next-round distance was applied.",
      };
    }
    case "health_check": {
      const result = factLabel(factValue(event, "resultLabel", "outcome"));
      return {
        outcomeRows: resultRow(event, result ? `Result: ${result}` : undefined),
        summary: `${roller ?? "Participant"} made a health check.`,
      };
    }
    case "participant_su_review":
      return { outcomeRows: [], summary: `${attacker ?? "Participant"} completed SU review.` };
    case "initiative": {
      const total = factLabel(factValue(event, "total"));
      return {
        outcomeRows: resultRow(event, total ? `Total: ${total}` : undefined),
        summary: `${roller ?? "Participant"} rolled initiative.`,
      };
    }
    case "declaration": {
      const action = factLabel(factValue(event, "actionLabel"));
      return {
        outcomeRows: resultRow(event, action ? `Action: ${action}` : undefined),
        summary: `${attacker ?? "Participant"} declared an action.`,
      };
    }
    case "feint_feasibility":
    case "feint_impossible": {
      const feasibility = factLabel(factValue(event, "feasibility"));
      const method = factLabel(factValue(event, "method"))?.toLowerCase();
      return {
        outcomeRows: resultRow(
          event,
          event.type === "feint_impossible"
            ? "Feint ruled impossible."
            : feasibility
              ? `Feint ${feasibility.toLowerCase()}.`
              : "Feint permitted.",
        ),
        summary:
          attacker && defender
            ? `${attacker} attempted a ${method ?? ""} feint against ${defender}.`.replace(
                "a  feint",
                "a feint",
              )
            : "Feint feasibility reviewed.",
      };
    }
    case "feint_roll": {
      const side = factLabel(factValue(event, "side"));
      const method = factLabel(factValue(event, "method"))?.toLowerCase();
      return {
        outcomeRows: [],
        summary:
          side?.toLowerCase() === "defender"
            ? `${roller ?? defender ?? "Defender"} rolled feint resistance.`
            : attacker && defender
              ? `${attacker} attempted a ${method ?? ""} feint against ${defender}.`.replace(
                  "a  feint",
                  "a feint",
                )
              : `${roller ?? attacker ?? "Attacker"} rolled the feint.`,
      };
    }
    case "feint_result": {
      const difference = factValue(event, "difference");
      return {
        outcomeRows:
          typeof difference === "number"
            ? resultRow(
                event,
                difference > 0
                  ? `${attacker ?? "Attacker"} won the feint contest by ${difference}.`
                  : difference < 0
                    ? `${defender ?? "Defender"} won the feint contest by ${Math.abs(difference)}.`
                    : "The feint contest was tied.",
              )
            : [],
        summary: "The opposed feint result was resolved.",
      };
    }
    case "feint_committed": {
      const skillOb = factValue(event, "defenderPhase2SkillObModifier");
      const dbParry = factValue(event, "defenderPhase2DbParryModifier");
      const attackerDb = factValue(event, "attackerPhase1DbParryModifier");
      return {
        outcomeRows: [
          ...(typeof attackerDb === "number"
            ? [
                {
                  key: `${event.id}:outcome:attacker-db`,
                  text: `${attacker ?? "Attacker"} DB/Parry ${attackerDb >= 0 ? "+" : ""}${attackerDb} in Phase 1.`,
                },
              ]
            : []),
          ...(typeof skillOb === "number" && typeof dbParry === "number"
            ? [
                {
                  key: `${event.id}:outcome:defender-modifiers`,
                  text: `${defender ?? "Defender"} receives Skill/OB ${skillOb >= 0 ? "+" : ""}${skillOb} and DB/Parry ${dbParry >= 0 ? "+" : ""}${dbParry} in Phase 2.`,
                },
              ]
            : []),
        ],
        summary: "The GM committed the feint result.",
      };
    }
    case "adjust_distance_response": {
      const response = factValue(event, "response");
      return { outcomeRows: resultRow(event, response === "allow" ? `${defender ?? "Defender"} allowed the distance adjustment.` : `${defender ?? "Defender"} opposed the distance adjustment.`), summary: "The defender responded to the maneuver." };
    }
    case "adjust_distance_adjustment":
      return { outcomeRows: [], summary: "The GM confirmed the maneuver adjustment." };
    case "adjust_distance_roll": {
      const side = factLabel(factValue(event, "side"));
      const outcome = side?.toLowerCase() === "defender" ? "to resist the distance adjustment" : "to adjust distance";
      return { outcomeRows: [], summary: `${roller ?? attacker ?? defender ?? "Participant"} rolled Dodge ${outcome}.` };
    }
    case "adjust_distance_result": {
      const proposed = factValue(event, "standardProposedDistance");
      return { outcomeRows: typeof proposed === "number" ? resultRow(event, `Proposed distance: ${proposed}.`) : [], summary: "The maneuver proposal was resolved." };
    }
    case "adjust_distance_committed": {
      const previous = factValue(event, "previousDistance");
      const committed = factValue(event, "committedDistance");
      return { outcomeRows: typeof committed === "number" ? resultRow(event, previous === committed ? `Distance remained ${committed}.` : `Distance changed from ${previous} to ${committed}.`) : [], summary: "The GM committed the distance adjustment." };
    }
  }
}

export function buildCombatEventResultModel(
  events: readonly ProjectedCombatHistoryEvent[],
): CombatEventResultModel {
  return {
    items: [...events]
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
      .map((event) => {
        const identityById = new Map(
          event.identities.flatMap((entry) =>
            entry.participantId ? [[entry.participantId, entry.displayName] as const] : [],
          ),
        );
        const attack = event.type === "attack";
        const presentation = eventPresentation(event);
        return {
          calculationRows: attack
            ? attackCalculationRows(event)
            : event.type === "adjust_distance_roll" || event.type === "distance_control_roll"
              ? dodgeCalculationRows(event)
              : event.type === "offensive_parry_brawling"
                ? offensiveParryBrawlingCalculationRows(event)
              : calculationFactRows(event.id, event.facts.privateCalculation, identityById),
          completenessLabel:
            event.completeness === "complete"
              ? undefined
              : event.completeness === "legacy_derived"
                ? "Legacy-derived history"
                : "Incomplete history",
          id: event.id,
          outcomeRows: presentation.outcomeRows,
          sequence: event.sequence,
          summary: presentation.summary,
          title: EVENT_TITLES[event.type],
          type: event.type,
        };
      }),
  };
}
